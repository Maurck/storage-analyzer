import { expect, Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type {
  DirectoryNode,
  FileSearch,
  LargestFiles,
  RankedFile,
  Scan,
  SkippedItems,
} from "../src/features/storage-analysis/model/directory.types";
import type { BackendLifecycle } from "../src/shared/lib/desktopBridge";

const MB = 1024 ** 2;
const GB = 1024 ** 3;
const CORS = { "Access-Control-Allow-Origin": "*" };
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

function file(name: string, parent: string, sizeBytes: number): DirectoryNode {
  return {
    name,
    absolutePath: `${parent}/${name}`,
    type: "FILE",
    sizeBytes,
    fileCount: 1,
    directoryCount: 0,
    hasChildren: false,
    childrenLoaded: true,
    partial: false,
    subdirectories: [],
  };
}
function folder(
  name: string,
  absolutePath: string,
  children: DirectoryNode[],
): DirectoryNode {
  return {
    name,
    absolutePath,
    type: "FOLDER",
    sizeBytes: children.reduce((sum, child) => sum + child.sizeBytes, 0),
    fileCount: children.reduce((sum, child) => sum + child.fileCount, 0),
    directoryCount: children.reduce(
      (sum, child) =>
        sum + child.directoryCount + (child.type === "FOLDER" ? 1 : 0),
      0,
    ),
    hasChildren: children.length > 0,
    childrenLoaded: true,
    partial: false,
    subdirectories: children,
  };
}
/**
 * a/b/c/d/e/f holds movie.mkv after 30 larger files, so the table lists it
 * on its second page.
 */
function deepFolder(): DirectoryNode {
  const leaf = "/fixture/a/b/c/d/e/f";
  let node = folder("f", leaf, [
    file("movie.mkv", leaf, 150 * MB),
    ...Array.from({ length: 30 }, (_, index) =>
      file(`clip-${String(index + 1).padStart(2, "0")}.bin`, leaf, 200 * MB),
    ),
  ]);
  for (const name of ["e", "d", "c", "b", "a"]) {
    const path = node.absolutePath.slice(0, node.absolutePath.lastIndexOf("/"));
    node = folder(name, path, [node]);
  }
  return node;
}

function fixture(extraFiles = 0, deep = false) {
  const projects = folder("Projects", "/fixture/Projects", [
    file("package.zip", "/fixture/Projects", 512 * MB),
    file("assets.png", "/fixture/Projects", 256 * MB),
  ]);
  const photos = folder("Photos", "/fixture/Photos", [
    file("sun.jpg", "/fixture/Photos", 256 * MB),
  ]);
  const empty = folder("Empty", "/fixture/Empty", []);
  const root = folder("Fixture", "/fixture", [
    ...(deep ? [deepFolder()] : []),
    projects,
    photos,
    empty,
    file("readme.txt", "/fixture", 0),
    ...Array.from({ length: extraFiles }, (_, index) =>
      file(`note-${String(index + 1).padStart(2, "0")}.txt`, "/fixture", 0),
    ),
  ]);
  const nodes = new Map<string, DirectoryNode>();
  const index = (node: DirectoryNode) => {
    nodes.set(node.absolutePath, node);
    node.subdirectories.forEach(index);
  };
  index(root);
  const preview = (node: DirectoryNode): DirectoryNode => ({
    ...node,
    subdirectories: node.subdirectories.map((child) => ({
      ...child,
      childrenLoaded: !child.hasChildren,
      subdirectories: [],
    })),
  });
  return { root, nodes, preview };
}

interface ApiOptions {
  extraFiles?: number;
  pending?: boolean;
  startErrors?: number;
  pollErrors?: number;
  branchErrors?: number;
  health?: "up" | "down" | "other-service" | "api-version";
  /** Added to every scan the mock returns, including its status. */
  scanExtras?: Partial<Scan>;
  /** What preload.js exposes; lifecycle methods only when a lifecycle is given. */
  bridge?: {
    lifecycle?: BackendLifecycle;
    numberLocale?: string;
    common?: { id: string; path: string }[];
  };
  /** Marks the analysis partial, as if something had been skipped. */
  partialRoot?: boolean;
  /** Files ranked by GET /largest; by default the fixture's own files. */
  ranking?: RankedFile[];
  skipped?: Omit<SkippedItems, "scanId" | "offset">;
  /** Adds a/b/c/d/e/f with movie.mkv on the second page of its folder. */
  deep?: boolean;
  /** GET /ancestors answers PATH_NOT_IN_SCAN this many times. */
  ancestorErrors?: number;
}

function rankFiles(root: DirectoryNode): RankedFile[] {
  const files: RankedFile[] = [];
  const visit = (node: DirectoryNode) => {
    if (node.type === "FILE")
      files.push({
        name: node.name,
        absolutePath: node.absolutePath,
        relativePath: node.absolutePath.slice(root.absolutePath.length + 1),
        sizeBytes: node.sizeBytes,
      });
    node.subdirectories.forEach(visit);
  };
  visit(root);
  return files.sort(
    (a, b) =>
      b.sizeBytes - a.sizeBytes || (a.absolutePath < b.absolutePath ? -1 : 1),
  );
}
async function prepare(page: Page, options: ApiOptions = {}) {
  const data = fixture(options.extraFiles, options.deep);
  if (options.partialRoot) data.root.partial = true;
  const ranking = options.ranking ?? rankFiles(data.root);
  const requests = {
    starts: 0,
    polls: 0,
    branches: [] as string[],
    cancels: 0,
    health: 0,
    largest: [] as string[],
    skipped: [] as string[],
    ancestors: [] as string[],
    files: [] as string[],
  };
  const state = {
    pending: !!options.pending,
    startErrors: options.startErrors ?? 0,
    pollErrors: options.pollErrors ?? 0,
    branchErrors: options.branchErrors ?? 0,
    expiredId: "",
    cancelGate: undefined as Promise<void> | undefined,
    health: options.health ?? "up",
    extras: options.scanExtras ?? ({} as Partial<Scan>),
    expiredQueries: false,
    ancestorErrors: options.ancestorErrors ?? 0,
    /** Holds GET /ancestors for this path until the promise settles. */
    ancestorGates: new Map<string, Promise<void>>(),
    /** Holds GET /files for this query until the promise settles. */
    fileGates: new Map<string, Promise<void>>(),
  };
  const scan = (
    status: Scan["status"],
    id = `scan-fixture-${requests.starts}`,
  ): Scan => ({
    id,
    path: "/fixture",
    status,
    processedFiles: data.root.fileCount,
    processedDirectories: data.root.directoryCount + 1,
    processedBytes: data.root.sizeBytes,
    skippedCount: 0,
    elapsedMillis: 1000,
    startedAt: "2026-03-04T05:06:07Z",
    finishedAt: status === "SCANNING" ? null : "2026-03-04T05:06:08Z",
    volume: { totalBytes: 500 * GB, usableBytes: 200 * GB },
    root: status === "COMPLETE" ? data.preview(data.root) : null,
    ...state.extras,
  });
  await page.addInitScript((bridge) => {
    const listeners: ((status: BackendLifecycle) => void)[] = [];
    const backend = {
      status: bridge.lifecycle,
      retries: 0,
      onRetry: undefined as BackendLifecycle | undefined,
      emit(status: BackendLifecycle) {
        backend.status = status;
        listeners.forEach((listener) => listener(status));
      },
    };
    (window as any).__backend = backend;
    const desktop = {
      shown: [] as { scanId: string; path: string }[],
      showResult: { ok: true } as { ok: boolean; code?: string },
    };
    (window as any).__desktop = desktop;
    window.storageAnalyzer = {
      backendUrl: "http://localhost:5000",
      numberLocale: bridge.numberLocale,
      selectDirectory: async () => "/fixture",
      showItemInFolder: async (scanId: string, path: string) => {
        desktop.shown.push({ scanId, path });
        return desktop.showResult;
      },
      getCommonFolders: async () => bridge.common ?? [],
      ...(bridge.lifecycle && {
        getBackendStatus: async () => backend.status!,
        retryBackend: async () => {
          backend.retries += 1;
          backend.status = backend.onRetry ?? backend.status;
          return backend.status!;
        },
        onBackendStatus: (listener: (status: BackendLifecycle) => void) => {
          listeners.push(listener);
          return () => {};
        },
      }),
    };
  }, options.bridge ?? {});
  await page.route("http://localhost:5000/health", async (route) => {
    requests.health += 1;
    if (state.health === "down") await route.abort("connectionrefused");
    else if (state.health === "other-service")
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html>Another dev server</html>",
        headers: CORS,
      });
    else
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify({
          application: "storage-analyzer",
          apiVersion: state.health === "api-version" ? 2 : 1,
          status: "UP",
        }),
      });
  });
  await page.route("http://localhost:5000/capacity", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({
        maxHeapBytes: 4 * GB,
        snapshotBudgetBytes: 2 * GB,
        maxEntries: 3862380,
        referencePathLength: 120,
      }),
    }),
  );
  await page.route("http://localhost:5000/scans**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (state.health === "down") {
      await route.abort("connectionrefused");
      return;
    }
    const respond = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
        headers: CORS,
      });
    if (request.method() === "OPTIONS") {
      await respond({});
      return;
    }
    if (request.method() === "POST") {
      requests.starts += 1;
      expect(request.postDataJSON()).toEqual({ path: "/fixture" });
      if (state.startErrors-- > 0)
        await respond({ message: "The local service is unavailable." }, 503);
      else await respond(scan("SCANNING"), 202);
    } else if (request.method() === "DELETE") {
      requests.cancels += 1;
      if (state.cancelGate) await state.cancelGate;
      await respond(scan("CANCELLED", url.pathname.split("/")[2]));
    } else if (url.pathname.endsWith("/largest")) {
      requests.largest.push(url.search);
      const limit = Number(url.searchParams.get("limit"));
      const minSizeBytes = Number(url.searchParams.get("minSizeBytes"));
      if (state.expiredQueries) {
        await respond(
          { code: "SCAN_NOT_FOUND", message: "This scan has expired." },
          404,
        );
        return;
      }
      const matching = ranking.filter((file) => file.sizeBytes >= minSizeBytes);
      const body: LargestFiles = {
        scanId: url.pathname.split("/")[2],
        root: data.root.absolutePath,
        partial: data.root.partial,
        limit,
        minSizeBytes,
        matchingFiles: matching.length,
        files: matching.slice(0, limit),
      };
      await respond(body);
    } else if (url.pathname.endsWith("/files")) {
      // Every file under the scope, like the backend: never only the ranking.
      requests.files.push(url.search);
      const query = (url.searchParams.get("query") ?? "").trim();
      const scope = url.searchParams.get("scope") ?? data.root.absolutePath;
      const minSizeBytes = Number(url.searchParams.get("minSizeBytes"));
      const offset = Number(url.searchParams.get("offset"));
      const limit = Number(url.searchParams.get("limit"));
      await state.fileGates.get(query);
      const needle = query.toLowerCase().replace(/\\/g, "/");
      const matching = rankFiles(data.root).filter(
        (file) =>
          file.absolutePath.startsWith(scope + "/") &&
          file.sizeBytes >= minSizeBytes &&
          file.relativePath.toLowerCase().includes(needle),
      );
      const body: FileSearch = {
        scanId: url.pathname.split("/")[2],
        root: data.root.absolutePath,
        scope,
        partial: data.nodes.get(scope)!.partial,
        query,
        minSizeBytes,
        offset,
        limit,
        matchingFiles: matching.length,
        files: matching.slice(offset, offset + limit),
      };
      // The page may have given up on a request it no longer needs.
      await respond(body).catch(() => {});
    } else if (url.pathname.endsWith("/ancestors")) {
      const path = url.searchParams.get("path")!;
      requests.ancestors.push(path);
      await state.ancestorGates.get(path);
      const chain: DirectoryNode[] = [];
      const find = (node: DirectoryNode): DirectoryNode | undefined => {
        if (node.absolutePath === path) return node;
        for (const child of node.subdirectories) {
          const found = find(child);
          if (found) {
            chain.unshift(node);
            return found;
          }
        }
      };
      const entry = find(data.root);
      if (!entry || state.ancestorErrors-- > 0)
        await respond(
          { code: "PATH_NOT_IN_SCAN", message: "Not in this scan." },
          404,
        );
      else
        await respond({
          scanId: url.pathname.split("/")[2],
          entry: {
            ...entry,
            childrenLoaded: entry.type !== "FOLDER",
            subdirectories: [],
          },
          ancestors: chain.map(data.preview),
        });
    } else if (url.pathname.endsWith("/skipped")) {
      requests.skipped.push(url.search);
      const offset = Number(url.searchParams.get("offset"));
      const limit = Number(url.searchParams.get("limit"));
      const skipped = options.skipped ?? { total: 0, recorded: 0, items: [] };
      const body: SkippedItems = {
        ...skipped,
        scanId: url.pathname.split("/")[2],
        offset,
        items: skipped.items.slice(offset, offset + limit),
      };
      await respond(body);
    } else if (url.pathname.endsWith("/directory")) {
      const path = url.searchParams.get("path")!;
      requests.branches.push(path);
      if (state.branchErrors-- > 0)
        await respond(
          { code: "SCANNER_BUSY", message: "The scanner is busy." },
          429,
        );
      else {
        const node = data.nodes.get(path);
        await respond(
          node ? data.preview(node) : { message: "Folder not found." },
          node ? 200 : 404,
        );
      }
    } else {
      requests.polls += 1;
      if (url.pathname.split("/")[2] === state.expiredId)
        await respond(
          {
            code: "SCAN_NOT_FOUND",
            message: "This scan has expired. Start a new scan.",
          },
          404,
        );
      else if (state.pollErrors-- > 0)
        await respond({ message: "The local service disconnected." }, 503);
      else
        await respond(
          scan(
            state.pending ? "SCANNING" : "COMPLETE",
            url.pathname.split("/")[2],
          ),
        );
    }
  });
  await page.goto("/");
  return { data, requests, state };
}

async function analyze(page: Page) {
  await page
    .getByRole("button", { name: "New analysis", exact: true })
    .first()
    .click();
  if ((page.viewportSize()?.width ?? 1440) < 768) {
    await page.getByRole("button", { name: "Explorer", exact: true }).click();
  }
  await expect(
    page.getByRole("tree", { name: "Folders and files" }),
  ).toBeVisible();
}
function treeNode(page: Page, name: string) {
  return page.getByRole("treeitem", { name: new RegExp(`^${name},`) });
}
async function checkAccessibility(page: Page, skipRules: string[] = []) {
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async (skip) => {
    const result = await (window as any).axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
      rules: Object.fromEntries(
        skip.map((rule: string) => [rule, { enabled: false }]),
      ),
    });
    return result.violations.map((violation: any) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node: any) => node.target),
    }));
  }, skipRules);
  expect(violations).toEqual([]);
}

test("initial state explains the next action and passes accessibility checks", async ({
  page,
}) => {
  const { requests } = await prepare(page);
  await expect(
    page.getByRole("button", { name: "New analysis", exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("tree")).toHaveCount(0);
  expect(requests.starts).toBe(0);
  await checkAccessibility(page);
  await page.screenshot({ path: "test-results/welcome.png", fullPage: true });
});

test("cancelling the native folder picker does not start a scan", async ({
  page,
}) => {
  const { requests } = await prepare(page);
  await page.evaluate(() => {
    window.storageAnalyzer!.selectDirectory = async () => null;
  });
  await page
    .getByRole("button", { name: "New analysis", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "New analysis", exact: true }).first(),
  ).toBeEnabled();
  await expect(page.getByRole("tree")).toHaveCount(0);
  expect(requests.starts).toBe(0);
});

test("browser folder entry preserves input and recovers from validation errors", async ({
  page,
}) => {
  await prepare(page, { startErrors: 1 });
  await page.evaluate(() => {
    delete window.storageAnalyzer;
  });
  await page.getByRole("button", { name: "New analysis", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a folder" });
  const input = dialog.getByRole("textbox", { name: "Folder path" });
  await expect(input).toBeFocused();
  await input.fill("/fixture");
  await dialog.getByRole("button", { name: "Analyze folder" }).click();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveValue("/fixture");
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Analyze folder" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("table", { name: /^Contents of Fixture/ }),
  ).toBeVisible();
});

test("a completed analysis displays actual sizes and an accessible table", async ({
  page,
}) => {
  await prepare(page);
  await analyze(page);
  const table = page.getByRole("table", { name: /^Contents of Fixture/ });
  await expect(table.getByRole("row", { name: /Projects/ })).toContainText(
    "768 MB",
  );
  await expect(table.getByRole("row", { name: /Projects/ })).toContainText(
    "75.0%",
  );
  await expect(table.getByRole("row", { name: /Photos/ })).toContainText(
    "256 MB",
  );
  await expect(table.getByRole("row", { name: /Photos/ })).toContainText(
    "25.0%",
  );
  await expect(
    page.getByRole("figure", { name: /Fixture: 1.00 GB/ }),
  ).toBeVisible();
  await checkAccessibility(page);
  await page.screenshot({ path: "test-results/overview.png", fullPage: true });
});

test("the tree supports keyboard navigation, selection and lazy folder expansion", async ({
  page,
}) => {
  const { requests } = await prepare(page);
  await analyze(page);
  const root = treeNode(page, "Fixture");
  const projects = treeNode(page, "Projects");
  await root.focus();
  await page.keyboard.press("ArrowRight");
  await expect(projects).toBeFocused();
  expect(requests.branches).toEqual([]);
  await page.keyboard.press("ArrowRight");
  await expect(projects).toHaveAttribute("aria-expanded", "true");
  await expect(treeNode(page, "package.zip")).toBeVisible();
  expect(requests.branches).toContain("/fixture/Projects");
  await page.keyboard.press("ArrowRight");
  await expect(treeNode(page, "package.zip")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(treeNode(page, "assets.png")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(treeNode(page, "package.zip")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(projects).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(projects).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(projects).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("End");
  await expect(treeNode(page, "readme.txt")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(root).toBeFocused();
  await page.keyboard.press("Space");
  await expect(root).toHaveAttribute("aria-selected", "true");
});

test("loaded-item search preserves ancestors and reports no results", async ({
  page,
}) => {
  await prepare(page);
  await analyze(page);
  const search = page.getByRole("searchbox", { name: "Search loaded items" });
  await search.fill("Photos");
  await expect(treeNode(page, "Fixture")).toBeVisible();
  await expect(treeNode(page, "Photos")).toBeVisible();
  await expect(treeNode(page, "Projects")).toHaveCount(0);
  await search.fill("not-present");
  await expect(page.getByText(/No loaded items match/)).toBeVisible();
  await search.fill("");
  await expect(treeNode(page, "Projects")).toBeVisible();
});

test("contents search, type filtering, sorting and pagination remain consistent", async ({
  page,
}) => {
  await prepare(page, { extraFiles: 28 });
  await analyze(page);
  const table = page.getByRole("table", { name: /^Contents of Fixture/ });
  await expect(table.locator("tbody tr")).toHaveCount(25);
  await expect(
    page.getByText("1–25 of 32 items", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(table.locator("tbody tr")).toHaveCount(7);
  await expect(
    page.getByRole("button", { name: "Next page", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Filter by type" })
    .selectOption("FOLDER");
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await expect(
    page.getByRole("navigation", { name: "Contents pagination" }),
  ).toHaveCount(0);
  await table.getByRole("button", { name: "Name", exact: true }).click();
  await expect(table.locator("tbody tr").first()).toContainText("Empty");
  await expect(
    table.getByRole("columnheader", { name: "Name" }),
  ).toHaveAttribute("aria-sort", "ascending");
  await page
    .getByRole("searchbox", { name: "Filter this folder’s items" })
    .fill("Photos");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("searchbox", { name: "Filter this folder’s items" })
    .fill("missing");
  await expect(
    page.getByRole("heading", { name: "No matching items" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(table.locator("tbody tr")).toHaveCount(25);
});

test("a failed scan start shows an actionable error and can be retried", async ({
  page,
}) => {
  const { requests } = await prepare(page, { startErrors: 1 });
  await page
    .getByRole("button", { name: "New analysis", exact: true })
    .first()
    .click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await page
    .getByRole("button", { name: /Try again|Retry|Rescan/ })
    .first()
    .click();
  await expect(
    page.getByRole("tree", { name: "Folders and files" }),
  ).toBeVisible();
  expect(requests.starts).toBe(2);
});

test("a temporary polling error recovers without losing the scan", async ({
  page,
}) => {
  const { requests } = await prepare(page, { pollErrors: 1 });
  await analyze(page);
  expect(requests.starts).toBe(1);
  expect(requests.polls).toBeGreaterThanOrEqual(2);
  await expect(
    page.getByRole("table", { name: /^Contents of Fixture/ }),
  ).toBeVisible();
});

test("a persistent polling failure offers recovery for the existing scan", async ({
  page,
}) => {
  const { requests, state } = await prepare(page, { pollErrors: 20 });
  await page
    .getByRole("button", { name: "New analysis", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "reported a problem without explaining it" }),
  ).toBeVisible();
  state.pollErrors = 0;
  await page
    .getByRole("button", { name: /Try again|Retry/ })
    .first()
    .click();
  await expect(
    page.getByRole("tree", { name: "Folders and files" }),
  ).toBeVisible();
  expect(requests.starts).toBe(1);
});

test("a failed lazy folder request can be retried without discarding the analysis", async ({
  page,
}) => {
  const { requests } = await prepare(page, { branchErrors: 2 });
  await analyze(page);
  const projects = treeNode(page, "Projects");
  await projects.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("alert").filter({ hasText: "The analysis engine is busy." }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: /^Contents of Fixture/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Try again|Retry/ })
    .first()
    .click();
  await expect(treeNode(page, "package.zip")).toBeVisible();
  expect(requests.branches).toEqual([
    "/fixture/Projects",
    "/fixture/Projects",
    "/fixture/Projects",
  ]);
  expect(requests.starts).toBe(1);
});

test("a rescan retains previous results while scanning and after cancellation", async ({
  page,
}) => {
  const { requests, state } = await prepare(page);
  await analyze(page);
  state.pending = true;
  await page
    .getByRole("button", { name: "Rescan Fixture", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancel scan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: /^Contents of Fixture/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel scan", exact: true }).click();
  await expect(
    page.getByText(/Analysis cancelled|Scan cancelled/).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: /^Contents of Fixture/ }),
  ).toBeVisible();
  expect(requests.starts).toBe(2);
  expect(requests.cancels).toBe(1);
});

test("an active scan can be cancelled and started again", async ({ page }) => {
  const { requests, state } = await prepare(page, { pending: true });
  await page
    .getByRole("button", { name: "New analysis", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Cancel scan", exact: true }).click();
  await expect(
    page.getByText(/Analysis cancelled|Scan cancelled/).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel scan", exact: true }),
  ).toHaveCount(0);
  expect(requests.cancels).toBe(1);
  state.pending = false;
  await page
    .getByRole("button", { name: "New analysis", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("tree", { name: "Folders and files" }),
  ).toBeVisible();
  expect(requests.starts).toBe(2);
});

test("an expired scan releases controls and can be replaced", async ({
  page,
}) => {
  const { state, requests } = await prepare(page, { pending: true });
  state.expiredId = "scan-fixture-1";
  await page.getByRole("button", { name: "New analysis", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Analysis session expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New analysis", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Cancel scan", exact: true }),
  ).toHaveCount(0);
  expect(requests.polls).toBe(1);
  state.pending = false;
  await page.getByRole("button", { name: "Select another folder" }).click();
  await expect(
    page.getByRole("table", { name: /^Contents of Fixture/ }),
  ).toBeVisible();
  expect(requests.starts).toBe(2);
});

test("a pending cancellation cannot overwrite a replacement scan", async ({
  page,
}) => {
  const { state, requests } = await prepare(page, { pending: true });
  let releaseCancel: () => void = () => {};
  state.cancelGate = new Promise<void>((resolve) => {
    releaseCancel = resolve;
  });
  await page.getByRole("button", { name: "New analysis", exact: true }).click();
  await page.getByRole("button", { name: "Cancel scan", exact: true }).click();
  await expect.poll(() => requests.cancels).toBe(1);
  state.pending = false;
  await expect(
    page.getByRole("table", { name: /^Contents of Fixture/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New analysis", exact: true }),
  ).toBeDisabled();
  releaseCancel();
  await expect(
    page.getByRole("button", { name: "New analysis", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "New analysis", exact: true }).click();
  await expect.poll(() => requests.starts).toBe(2);
  await expect(page.locator(".header-status")).toHaveText("Analysis complete");
  await expect(
    page.getByRole("table", { name: /^Contents of Fixture/ }),
  ).toBeVisible();
});

test("compact windows and 200 percent text retain reachable content without body overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await analyze(page);
  const dialog = page.getByRole("dialog", {
    name: "File explorer",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Explorer", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Explorer", exact: true }).click();
  await treeNode(page, "Fixture").press("Enter");
  await expect(
    page.getByRole("heading", { name: "Fixture", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page.setViewportSize({ width: 768, height: 900 });
  const sizes = () =>
    page.evaluate(() =>
      [
        "h1",
        ".work-path",
        "table tbody .item-link span",
        ".table-footer span",
      ].map((selector) =>
        parseFloat(
          getComputedStyle(document.querySelector(selector)!).fontSize,
        ),
      ),
    );
  const before = await sizes();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  // Text follows the preferred size instead of staying pinned to 16px, which
  // a px-based scale would do while the overflow check below still passed.
  expect(await sizes()).toEqual(before.map((size) => size * 2));
  await expect(
    page.getByRole("button", { name: "New analysis", exact: true }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  // Nothing that holds text is clipped by a size fixed in pixels.
  const clipped = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("select, td, th, dt"))
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => element.className || element.tagName),
  );
  expect(clipped).toEqual([]);
  await checkAccessibility(page);
});

test("the language can be switched from settings and survives a reload", async ({
  page,
}) => {
  await prepare(page);
  // playwright.config.ts pins the browser to en-US, so the app starts in
  // English and this exercises a real change of language.
  await expect(
    page.getByRole("heading", { name: "Storage overview." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByLabel("Language").selectOption("es");

  // The dialog translates in place, so its accessible name changes with it.
  await expect(
    page.getByRole("dialog", { name: "Configuración" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.getByRole("button", { name: "Listo" }).click();
  await expect(
    page.getByRole("dialog", { name: "Configuración" }),
  ).not.toBeVisible();

  await expect(
    page.getByRole("heading", { name: "Resumen de almacenamiento." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nuevo análisis", exact: true }).first(),
  ).toBeVisible();
  await checkAccessibility(page);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Resumen de almacenamiento." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("switching language keeps the analysis and the Explorer sizes", async ({
  page,
}) => {
  await prepare(page);
  await analyze(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Language").selectOption("es");
  await page.getByRole("button", { name: "Listo" }).click();

  const table = page.getByRole("table", { name: /^Contenido de Fixture/ });
  await expect(table).toBeVisible();
  await expect(table.getByRole("row", { name: /Projects/ })).toContainText(
    "768 MB",
  );
  await expect(table.getByRole("row", { name: /Photos/ })).toContainText(
    "256 MB",
  );
  await expect(
    page.getByRole("figure", { name: /Fixture: 1\.00 GB/ }),
  ).toBeVisible();
});

const selectFolder = (page: Page) =>
  page.getByRole("button", { name: "New analysis", exact: true });

test("analyses wait until the engine answers its health check", async ({
  page,
}) => {
  const { state, requests } = await prepare(page, { health: "down" });
  const banner = page.locator(".service-banner");
  await expect(banner).toContainText("The analysis engine is not responding");
  await expect(selectFolder(page)).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Choose a folder", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".header-status")).toHaveText("Engine unavailable");
  await checkAccessibility(page);
  state.health = "up";
  await expect(selectFolder(page)).toBeEnabled({ timeout: 6000 });
  await expect(banner).toHaveCount(0);
  expect(requests.starts).toBe(0);
  await analyze(page);
});

test("a starting engine is explained and analyses unlock once it is ready", async ({
  page,
}) => {
  const { state } = await prepare(page, {
    health: "down",
    bridge: { lifecycle: { managed: true, state: "starting" } },
  });
  await expect(page.getByText("Preparing the analysis engine…")).toBeVisible();
  await expect(page.locator(".header-status")).toHaveText(
    "Starting the engine",
  );
  await expect(selectFolder(page)).toBeDisabled();
  await checkAccessibility(page);
  state.health = "up";
  await page.evaluate(() =>
    (window as any).__backend.emit({ managed: true, state: "ready" }),
  );
  await expect(selectFolder(page)).toBeEnabled();
  await expect(page.getByText("Preparing the analysis engine…")).toHaveCount(0);
});

for (const [reason, title] of [
  ["port-in-use", "Another program is using the engine’s address"],
  ["incompatible", "The analysis engine is a different version"],
  ["timeout", "The analysis engine is taking too long to start"],
  ["exited", "The analysis engine stopped"],
  ["unsupported-platform", "Start the analysis engine separately"],
] as const) {
  test(`a failed start (${reason}) explains itself and only retries on request`, async ({
    page,
  }) => {
    const { state } = await prepare(page, {
      health: "down",
      bridge: { lifecycle: { managed: true, state: "failed", reason } },
    });
    const alert = page.getByRole("alert").filter({ hasText: title });
    await expect(alert).toBeVisible();
    if (reason === "port-in-use")
      await expect(alert).toContainText("localhost:5000");
    await expect(selectFolder(page)).toBeDisabled();
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as any).__backend.retries)).toBe(
      0,
    );
    state.health = "up";
    await page.evaluate(() => {
      (window as any).__backend.onRetry = { managed: true, state: "ready" };
    });
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(selectFolder(page)).toBeEnabled();
    expect(await page.evaluate(() => (window as any).__backend.retries)).toBe(
      1,
    );
  });
}

test("another program or another engine version on the port is never used", async ({
  page,
}) => {
  const { state, requests } = await prepare(page, { health: "other-service" });
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Another program is using the engine’s address" }),
  ).toBeVisible();
  await expect(selectFolder(page)).toBeDisabled();
  state.health = "api-version";
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "The analysis engine is a different version" }),
  ).toBeVisible();
  await expect(selectFolder(page)).toBeDisabled();
  expect(requests.starts).toBe(0);
});

test("results stay visible when the engine stops and analyses resume when it returns", async ({
  page,
}) => {
  const { state } = await prepare(page);
  await analyze(page);
  const rescan = page.getByRole("button", {
    name: "Rescan Fixture",
    exact: true,
  });
  await expect(rescan).toBeEnabled();
  state.health = "down";
  const banner = page.locator(".service-banner");
  await expect(banner).toContainText("The analysis engine stopped responding", {
    timeout: 8000,
  });
  await expect(banner).toContainText(
    "The results on screen are from the last analysis",
  );
  await expect(
    page.getByRole("table", { name: /^Contents of Fixture/ }),
  ).toBeVisible();
  await expect(rescan).toBeDisabled();
  await expect(page.locator(".header-status")).toHaveText("Engine unavailable");
  await expect(page.locator(".state-tag")).toHaveText(
    "Kept from the last analysis",
  );
  state.health = "up";
  await banner.getByRole("button", { name: "Try again" }).click();
  await expect(banner).toHaveCount(0);
  await expect(rescan).toBeEnabled();
  await expect(page.locator(".state-tag")).toHaveText("Complete");
});

test("a long scan shows elapsed time, the folder being read and quiet periods", async ({
  page,
}) => {
  const { state } = await prepare(page, {
    pending: true,
    scanExtras: {
      elapsedMillis: 65000,
      millisSinceActivity: 12000,
      currentPath: "/fixture/Projects/very/deep",
    },
  });
  await selectFolder(page).click();
  const progress = page.getByRole("region", { name: "Analysis progress" });
  await expect(progress).toContainText("1:05 elapsed");
  await expect(progress).toContainText("Reading /fixture/Projects/very/deep");
  await expect(
    progress.getByRole("status").filter({ hasText: "No new items" }),
  ).toBeVisible();
  await checkAccessibility(page);

  state.extras = {
    elapsedMillis: 66000,
    millisSinceActivity: 200,
    currentPath: "/fixture/Photos",
  };
  await expect(progress).toContainText("Reading /fixture/Photos");
  await expect(progress).toContainText("1:06 elapsed");
  await expect(progress).not.toContainText("No new items");

  state.pollErrors = 50;
  await expect(progress).toContainText(
    "Waiting for the analysis engine to answer",
  );
  await expect(
    progress.getByRole("button", { name: "Cancel scan" }),
  ).toBeEnabled();
});

test("the summary separates logical sizes from the drive's capacity", async ({
  page,
}) => {
  const { state } = await prepare(page);
  await analyze(page);
  const help = page.getByText("How sizes are calculated");
  await expect(page.getByText(/not the space they take on disk/)).toBeHidden();
  await help.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/not the space they take on disk/)).toBeVisible();
  await expect(page.getByText(/not live monitoring/)).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Analysis summary" })
      .getByText("Logical file size, not disk usage"),
  ).toBeVisible();
  await expect(
    page.getByText("Drive at the start of the analysis: 200 GB free of 500 GB"),
  ).toBeVisible();
  state.extras = { volume: null };
  await page
    .getByRole("button", { name: "Rescan Fixture", exact: true })
    .click();
  await expect(page.getByText("Drive capacity: unknown")).toBeVisible();
});

test("coded errors follow the interface language while numbers follow the system", async ({
  page,
}) => {
  const { state } = await prepare(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Language").selectOption("es");
  await page.getByRole("button", { name: "Listo" }).click();

  state.extras = {
    status: "ERROR",
    error: "This scan exceeded the limit of 250000 items.",
    errorCode: "ENTRY_LIMIT",
    errorParams: { limit: 250000 },
  };
  await page
    .getByRole("button", { name: "Nuevo análisis", exact: true })
    .click();
  // The browser locale is en-US, so the number keeps English separators.
  await expect(
    page.getByText(
      "Esta carpeta contiene más de 250,000 elementos, el máximo que admite un análisis en este equipo. Elige una carpeta más pequeña.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/exceeded the limit/)).toHaveCount(0);

  state.extras = {};
  state.branchErrors = 2; // the tree retries a failed branch once
  await page.getByRole("button", { name: "Reintentar" }).first().click();
  await expect(
    page.getByRole("tree", { name: "Carpetas y archivos" }),
  ).toBeVisible();
  await treeNode(page, "Projects").focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "El motor de análisis está ocupado." }),
  ).toBeVisible();
  await expect(page.getByText(/scanner is busy/)).toHaveCount(0);
  await checkAccessibility(page);
});

test("the system's regional format applies even with an English interface", async ({
  page,
}) => {
  await prepare(page, { bridge: { numberLocale: "es-ES" } });
  await analyze(page);
  const table = page.getByRole("table", { name: /^Contents of Fixture/ });
  await expect(table.getByRole("row", { name: /Projects/ })).toContainText(
    /75,0\s%/,
  );
  await expect(
    page.getByRole("figure", { name: /Fixture: 1,00 GB/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Analysis of Fixture", level: 1 }),
  ).toBeVisible();
  // The analysis date follows the system's regional format too.
  const date = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(Date.parse("2026-03-04T05:06:08Z"));
  await expect(page.locator(".work-meta time")).toHaveText(`Analyzed ${date}`);
  await expect(page.locator(".work-meta time")).toHaveAttribute(
    "datetime",
    "2026-03-04T05:06:08Z",
  );
});

test("forced colors keep the selection and share bars distinguishable", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" });
  await prepare(page);
  await analyze(page);
  const root = treeNode(page, "Fixture");
  await expect(root).toHaveAttribute("aria-selected", "true");
  const row = root.locator(".tree-row").first();
  expect(
    await row.evaluate((element) => getComputedStyle(element).borderTopWidth),
  ).toBe("2px");
  // Unselected rows blend their border into the background.
  const other = treeNode(page, "Photos").locator(".tree-row").first();
  expect(
    await other.evaluate((element) => {
      const style = getComputedStyle(element);
      const canvas = getComputedStyle(document.body).backgroundColor;
      return style.borderTopColor === canvas;
    }),
  ).toBe(true);
  const bar = page.locator(".share-bar").first();
  expect(
    await bar.evaluate((element) => getComputedStyle(element).borderTopStyle),
  ).toBe("solid");
  // axe measures contrast from author colors, which forced colors replace
  // with the system palette; the other WCAG rules still apply.
  await checkAccessibility(page, ["color-contrast"]);
  await page.screenshot({
    path: "test-results/forced-colors.png",
    fullPage: true,
  });
});

async function showLargest(page: Page) {
  await page.getByRole("radio", { name: "Largest files" }).check();
  return page.getByRole("table", { name: /^Largest files in Fixture/ });
}

test("the largest files of the whole analysis are found without opening folders", async ({
  page,
}) => {
  const { requests } = await prepare(page);
  await analyze(page);
  const table = await showLargest(page);
  const rows = table.locator("tbody tr");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("package.zip");
  await expect(rows.nth(0)).toContainText("Projects");
  await expect(rows.nth(0)).toContainText("512 MB");
  // Equal sizes keep the backend's order: by path.
  await expect(rows.nth(1)).toContainText("sun.jpg");
  await expect(rows.nth(2)).toContainText("assets.png");
  await expect(rows.nth(3)).toContainText("readme.txt");
  await expect(rows.nth(3)).toContainText("Top of the analyzed folder");
  await expect(
    page.getByText("Showing 4 of 4 matching files", { exact: true }),
  ).toBeVisible();
  expect(requests.branches).toEqual([]);
  await checkAccessibility(page);

  await page.getByRole("radio", { name: "100 MB or more" }).check();
  await expect(rows).toHaveCount(3);
  await page.getByRole("radio", { name: "1.00 GB or more" }).check();
  await expect(page.getByText("No file is 1.00 GB or larger.")).toBeVisible();
  expect(requests.largest).toEqual([
    "?limit=100&minSizeBytes=0",
    "?limit=100&minSizeBytes=104857600",
    "?limit=100&minSizeBytes=1073741824",
  ]);

  await treeNode(page, "Photos").click();
  await expect(
    page.getByRole("radio", { name: "Folder contents" }),
  ).toBeChecked();
  await expect(
    page.getByRole("heading", { name: "Photos", exact: true }),
  ).toBeVisible();
});

test("deep files and duplicate names are told apart by their location", async ({
  page,
}) => {
  const file = (relativePath: string, sizeBytes: number) => ({
    name: relativePath.split("/").pop()!,
    absolutePath: `/fixture/${relativePath}`,
    relativePath,
    sizeBytes,
  });
  await prepare(page, {
    ranking: [
      file("a/b/c/d/e/f/movie.mkv", 3 * GB),
      file("left/copy.bin", GB),
      file("right/copy.bin", GB),
    ],
  });
  await analyze(page);
  const rows = (await showLargest(page)).locator("tbody tr");
  await expect(rows.nth(0)).toContainText("movie.mkv");
  await expect(rows.nth(0)).toContainText("a/b/c/d/e/f");
  await expect(rows.nth(0)).toContainText("3.00 GB");
  await expect(rows.nth(1)).toContainText("left");
  await expect(rows.nth(2)).toContainText("right");
  await expect(rows.filter({ hasText: "copy.bin" })).toHaveCount(2);
});

test("show in Explorer targets the chosen item and explains a moved one", async ({
  page,
}) => {
  await prepare(page);
  await analyze(page);
  await showLargest(page);
  const shown = () => page.evaluate(() => (window as any).__desktop.shown);
  await page
    .getByRole("button", { name: "Show package.zip in Explorer" })
    .focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(shown)
    .toEqual([
      { scanId: "scan-fixture-1", path: "/fixture/Projects/package.zip" },
    ]);

  await page.evaluate(() => {
    (window as any).__desktop.showResult = {
      ok: false,
      code: "ITEM_MISSING",
    };
  });
  await page.getByRole("button", { name: "Show sun.jpg in Explorer" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not show sun.jpg" }),
  ).toContainText("It is no longer where the analysis found it");

  await page.evaluate(() => {
    (window as any).__desktop.showResult = { ok: true };
  });
  await page.getByRole("radio", { name: "Folder contents" }).check();
  await page
    .getByRole("button", { name: "Show in Explorer", exact: true })
    .click();
  await expect.poll(async () => (await shown()).length).toBe(3);
  expect((await shown())[2].path).toBe("/fixture");
});

test("a browser preview never offers to show items in Explorer", async ({
  page,
}) => {
  await prepare(page);
  await page.evaluate(() => {
    delete (window as any).storageAnalyzer.showItemInFolder;
  });
  await analyze(page);
  await showLargest(page);
  await expect(page.getByRole("button", { name: /in Explorer$/ })).toHaveCount(
    0,
  );
  await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(
    0,
  );
});

test("the ranking says it is loading until the files arrive", async ({
  page,
}) => {
  await prepare(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Registered last, so it runs first and then hands over to the fixture.
  await page.route(
    (url) => url.pathname.endsWith("/largest"),
    async (route) => {
      await gate;
      await route.fallback();
    },
  );
  await analyze(page);
  await page.getByRole("radio", { name: "Largest files" }).check();
  const loading = page.getByRole("status").filter({ hasText: "Ranking files" });
  await expect(loading).toBeAttached();
  await expect(
    page.getByRole("table", { name: /^Largest files in Fixture/ }),
  ).toHaveCount(0);
  release();
  await expect(
    page.getByRole("table", { name: /^Largest files in Fixture/ }),
  ).toBeVisible();
  await expect(loading).toHaveCount(0);
});

test("an expired analysis explains why the ranking is unavailable", async ({
  page,
}) => {
  const { state } = await prepare(page);
  await analyze(page);
  state.expiredQueries = true;
  await page.getByRole("radio", { name: "Largest files" }).check();
  const error = page
    .getByRole("alert")
    .filter({ hasText: "Could not rank the files" });
  await expect(error).toContainText(
    "This analysis has expired or no longer exists. Start a new one.",
  );
});

test("a partial analysis warns about its ranking and lists what it skipped", async ({
  page,
}) => {
  await prepare(page, {
    partialRoot: true,
    scanExtras: { skippedCount: 3 },
    skipped: {
      total: 3,
      recorded: 2,
      items: [
        {
          name: "deep",
          absolutePath: "/fixture/Projects/deep",
          relativePath: "Projects/deep",
          type: "ERROR",
          code: "DEPTH_LIMIT",
        },
        {
          name: "Fixture",
          absolutePath: "/fixture",
          relativePath: "",
          type: "FOLDER",
          code: "CONTENTS_PARTIALLY_UNREADABLE",
        },
      ],
    },
  });
  await analyze(page);
  await expect(page.locator(".state-tag")).toHaveText("Partial");
  await showLargest(page);
  const card = page.locator(".largest-card");
  await expect(card).toContainText(
    "This analysis skipped some items, so files inside them are not ranked.",
  );
  const open = card.getByRole("button", { name: "View skipped items" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Skipped items" });
  await expect(dialog).toBeVisible();
  const rows = dialog.getByRole("table").locator("tbody tr");
  await expect(rows.nth(0)).toContainText("Projects/deep");
  await expect(rows.nth(0)).toContainText(
    "Too deep to analyze; its contents are not counted.",
  );
  await expect(rows.nth(1)).toContainText("The analyzed folder");
  await expect(rows.nth(1)).toContainText(
    "Some of its items could not be read.",
  );
  await expect(dialog).toContainText("1–2 of 3 skipped items");
  await expect(dialog).toContainText("Only the first 2 of 3 were recorded.");
  await checkAccessibility(page);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(open).toBeFocused();
  // The summary opens the same list.
  await expect(
    page
      .getByRole("region", { name: "Analysis summary" })
      .getByRole("button", { name: "View skipped items" }),
  ).toBeVisible();
});

test("recent and common folders start an analysis in one click", async ({
  page,
}) => {
  const { requests } = await prepare(page, {
    bridge: { common: [{ id: "downloads", path: "/fixture" }] },
  });
  const quick = page.getByRole("region", { name: "Start quickly" });
  await expect(
    quick.getByRole("heading", { name: "Recent folders" }),
  ).toHaveCount(0);
  await quick.getByRole("button", { name: /^Downloads/ }).click();
  await expect(
    page.getByRole("tree", { name: "Folders and files" }),
  ).toBeVisible();
  expect(requests.starts).toBe(1);

  await page.reload();
  await expect(
    quick.getByRole("heading", { name: "Recent folders" }),
  ).toBeVisible();
  await checkAccessibility(page);
  await quick.getByRole("button", { name: "fixture /fixture" }).click();
  await expect(
    page.getByRole("tree", { name: "Folders and files" }),
  ).toBeVisible();
  expect(requests.starts).toBe(2);

  await page.reload();
  await quick
    .getByRole("button", { name: "Remove fixture from recent folders" })
    .click();
  await expect(
    quick.getByRole("heading", { name: "Recent folders" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    quick.getByRole("heading", { name: "Recent folders" }),
  ).toHaveCount(0);
});

test("keyboard shortcuts work outside fields and dialogs", async ({ page }) => {
  const { requests } = await prepare(page);
  await expect(selectFolder(page)).toBeEnabled();
  await expect(selectFolder(page)).toHaveAttribute(
    "aria-keyshortcuts",
    "Control+O",
  );
  await page.keyboard.press("Control+O");
  await expect(
    page.getByRole("tree", { name: "Folders and files" }),
  ).toBeVisible();
  expect(requests.starts).toBe(1);

  await page.keyboard.press("F5");
  await expect.poll(() => requests.starts).toBe(2);
  await expect(
    page.getByRole("table", { name: /^Contents of Fixture/ }),
  ).toBeVisible();

  await treeNode(page, "Projects").click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(
    page.getByRole("heading", { name: "Fixture", exact: true }),
  ).toBeVisible();

  await page.keyboard.press("Control+F");
  const search = page.getByRole("searchbox", { name: "Filter this folder’s items" });
  await expect(search).toBeFocused();
  await page.keyboard.press("Control+O");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.keyboard.press("Control+O");
  await page.waitForTimeout(300);
  expect(requests.starts).toBe(2);

  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings).toContainText(
    "one analysis can hold about 3,862,380 items with paths of about 120 characters",
  );
  await expect(settings).toContainText("Ctrl+O");
  await expect(settings).toContainText("Go to the parent folder");
  await checkAccessibility(page);
});

test("the ranking works in Spanish on a narrow window", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await analyze(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Language").selectOption("es");
  await page.getByRole("button", { name: "Listo" }).click();
  await page.getByRole("radio", { name: "Archivos más grandes" }).check();
  const table = page.getByRole("table", {
    name: /^Archivos más grandes de Fixture/,
  });
  await expect(table.locator("tbody tr")).toHaveCount(4);
  await expect(table).toContainText("Raíz de la carpeta analizada");
  // The location moves under the name instead of a truncated column.
  await expect(table.locator(".location-inline").first()).toBeVisible();
  await expect(table.locator(".location-inline").first()).toHaveText(
    "Projects",
  );
  await expect(
    table.getByRole("columnheader", { name: "Ubicación" }),
  ).toBeHidden();
  await page.evaluate(() => {
    (window as any).__desktop.showResult = {
      ok: false,
      code: "ITEM_MISSING",
    };
  });
  await page
    .getByRole("button", { name: "Mostrar package.zip en el Explorador" })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "No se pudo mostrar package.zip" }),
  ).toContainText("Ya no está donde lo encontró el análisis");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await checkAccessibility(page);
  await page.screenshot({
    path: "test-results/largest-compact-es.png",
    fullPage: true,
  });
});

test("forced colors keep the chosen view and filter visible", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" });
  await prepare(page);
  await analyze(page);
  await showLargest(page);
  const checked = page.locator(".sa-segmented__option.is-checked");
  await expect(checked).toHaveCount(2);
  for (const option of await checked.all()) {
    expect(
      await option.evaluate(
        (element) => getComputedStyle(element).outlineStyle,
      ),
    ).toBe("solid");
  }
  // See the other forced-colors test for why color-contrast is skipped.
  await checkAccessibility(page, ["color-contrast"]);
  await page.screenshot({
    path: "test-results/largest-forced-colors.png",
    fullPage: true,
  });
});

/** Rows of the visible table that end above the fold, with no page scroll. */
async function visibleRows(page: Page) {
  return page.evaluate(() => {
    if (window.scrollY !== 0) return -1;
    return Array.from(document.querySelectorAll("tbody tr")).filter(
      (row) => row.getBoundingClientRect().bottom <= window.innerHeight,
    ).length;
  });
}

/**
 * The four screen sizes every layout change is measured at, in CSS pixels.
 * Windows scaling is what a person actually sees: a 4K screen at the 200% it
 * defaults to gives the CSS pixels of FHD, and QHD at 150% gives 1707×960, so
 * FHD is the common case and UHD is the unscaled extreme.
 */
const SCREENS = [
  { name: "HD", width: 1280, height: 720, rows: 3, footer: false },
  { name: "FHD", width: 1920, height: 1080, rows: 10, footer: true },
  { name: "QHD", width: 2560, height: 1440, rows: 16, footer: true },
  { name: "UHD", width: 3840, height: 2160, rows: 20, footer: true },
];

for (const screen of SCREENS) {
  test(`${screen.name} (${screen.width}×${screen.height}) spends its height on rows`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: screen.width, height: screen.height });
    await prepare(page, { extraFiles: 60 });
    await analyze(page);
    const fits = async (view: string) => {
      expect(
        await visibleRows(page),
        `${view} rows at ${screen.name}`,
      ).toBeGreaterThanOrEqual(screen.rows);
      // Below a useful height the rows keep the page's scroll instead of a
      // region of their own, and the count then sits under the fold.
      if (screen.footer)
        await expect(page.locator(".table-footer").first()).toBeInViewport({
          ratio: 1,
        });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `${view} without sideways page scroll at ${screen.name}`,
      ).toBe(true);
    };
    await fits("folder contents");
    await page.getByRole("radio", { name: "Largest files" }).check();
    await page
      .getByRole("searchbox", { name: "Search files by name or path" })
      .fill("note");
    await expect(page.getByText("1–50 of 60 matching files")).toBeVisible();
    await fits("search results");
    // Where you are, which list you read and what filters it stay on screen.
    for (const name of ["Folder contents", "Largest files"])
      await expect(page.getByRole("radio", { name })).toBeInViewport({
        ratio: 1,
      });
    await expect(
      page.getByRole("searchbox", { name: "Search files by name or path" }),
    ).toBeInViewport({ ratio: 1 });
    await checkAccessibility(page);
    await page.screenshot({
      path: `test-results/workspace-${screen.name.toLowerCase()}.png`,
    });
  });
}

test("at 1280×720 the controls, a one-line composition and the first rows fit (T5)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await prepare(page);
  await analyze(page);
  const table = page.getByRole("table", { name: /^Contents of Fixture/ });
  const firstRow = table.locator("tbody tr").first();
  await expect(firstRow).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // How many rows a window of this height is worth: the guarantee is stated
  // per window height, because no page size fits every screen and scaling.
  expect(await visibleRows(page)).toBeGreaterThanOrEqual(3);
  for (const name of ["New analysis", "Rescan Fixture", "Show in Explorer"])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("heading", { name: "Analysis of Fixture", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".state-tag")).toHaveText("Complete");
  // A compact stacked bar sums up the rows it precedes; its key selects.
  const figure = page.getByRole("figure", { name: /Fixture: 1.00 GB/ });
  await expect(figure).toBeInViewport({ ratio: 1 });
  const figureBox = (await figure.boundingBox())!;
  expect(figureBox.y).toBeLessThan((await table.boundingBox())!.y);
  expect(figureBox.height).toBeLessThan(64);
  await expect(page.getByRole("button", { name: /chart/i })).toHaveCount(0);
  await expect(figure).toContainText("Projects");
  // Named on the same line, so it does not read as a progress bar.
  await expect(figure.locator("figcaption")).toHaveText(
    /^Distribution\s*1\.00 GB$/,
  );
  await expect(figure).toContainText("Projects · 768 MB · 75.0%");
  // The size explanation opens from the keyboard; the essentials stay visible.
  const summary = page.getByRole("region", { name: "Analysis summary" });
  await expect(summary).toContainText("Logical file size, not disk usage");
  await expect(
    summary.getByText(/not the space they take on disk/),
  ).toBeHidden();
  await summary.getByText("How sizes are calculated").focus();
  await page.keyboard.press("Enter");
  await expect(
    summary.getByText(/not the space they take on disk/),
  ).toBeVisible();
  await checkAccessibility(page);
  await page.screenshot({ path: "test-results/workspace-1280x720.png" });
  await figure.getByRole("button", { name: /^Projects/ }).click();
  await expect(
    page.getByRole("heading", { name: "Projects", level: 2 }),
  ).toBeVisible();
});

test("at 390 px the compact summary and bar do not push results below the fold", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, { partialRoot: true, scanExtras: { skippedCount: 2 } });
  await analyze(page);
  await page.keyboard.press("Escape");
  const summary = page.getByRole("region", { name: "Analysis summary" });
  expect((await summary.boundingBox())!.height).toBeLessThan(200);
  // The partial warning stays visible even though the summary is compact.
  await expect(
    page.getByText("Some items could not be measured"),
  ).toBeVisible();
  const table = page.getByRole("table", { name: /^Contents of Fixture/ });
  const figure = page.getByRole("figure", { name: /Fixture: 1.00 GB/ });
  const figureBox = (await figure.boundingBox())!;
  expect(figureBox.y).toBeLessThan((await table.boundingBox())!.y);
  expect(figureBox.height).toBeLessThan(80);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/workspace-390.png" });
});

test("recent folders are reachable from New analysis and can stop being saved (T5)", async ({
  page,
}) => {
  const { requests } = await prepare(page, {
    bridge: { common: [{ id: "downloads", path: "/fixture" }] },
  });
  await analyze(page);
  const toggle = page.getByRole("button", {
    name: "Recent and common folders",
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  const menu = page.getByRole("region", { name: "Recent and common folders" });
  await expect(
    menu.getByRole("heading", { name: "Recent folders", exact: true }),
  ).toBeVisible();
  await expect(
    menu.getByRole("heading", { name: "Common folders", exact: true }),
  ).toBeVisible();
  await checkAccessibility(page);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  // Analyzing from the menu closes it and starts right away.
  await toggle.click();
  await menu.getByRole("button", { name: "fixture /fixture" }).click();
  await expect(menu).toHaveCount(0);
  await expect.poll(() => requests.starts).toBe(2);

  // Turning the preference off hides the list without deleting it.
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  const remember = settings.getByRole("checkbox", {
    name: "Save recent folders",
  });
  await expect(remember).toBeChecked();
  await expect(settings).toContainText("1 saved");
  await remember.uncheck();
  await settings.getByRole("button", { name: "Done" }).click();
  await toggle.click();
  await expect(
    menu.getByRole("heading", { name: "Recent folders", exact: true }),
  ).toHaveCount(0);
  await expect(
    menu.getByRole("heading", { name: "Common folders", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.reload();
  const quick = page.getByRole("region", { name: "Start quickly" });
  await expect(
    quick.getByRole("heading", { name: "Common folders", exact: true }),
  ).toBeVisible();
  await expect(
    quick.getByRole("heading", { name: "Recent folders", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("storage-analyzer:remember-recent"),
    ),
  ).toBe("false");

  // Clearing is a separate, named operation.
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(remember).not.toBeChecked();
  await remember.check();
  await expect(settings).toContainText("1 saved");
  await settings.getByRole("button", { name: "Clear recent folders" }).click();
  await expect(
    settings.getByRole("status").filter({ hasText: "Recent folders cleared" }),
  ).toBeVisible();
  await expect(
    settings.getByRole("button", { name: "Clear recent folders" }),
  ).toBeDisabled();
  await settings.getByRole("button", { name: "Done" }).click();
  await expect(
    quick.getByRole("heading", { name: "Recent folders", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("storage-analyzer:recent-folders"),
    ),
  ).toBe("[]");
});

test("an engine that stops during a scan is reported once, by its banner", async ({
  page,
}) => {
  const { state } = await prepare(page, { pending: true });
  await selectFolder(page).click();
  const progress = page.getByRole("region", { name: "Analysis progress" });
  await expect(progress).toBeVisible();
  state.health = "down";
  await expect(page.locator(".service-banner")).toContainText(
    "The analysis engine stopped responding",
    { timeout: 8000 },
  );
  await expect(progress).toContainText(
    "Waiting for the analysis engine to answer",
  );
  await expect(page.getByText("Connection interrupted")).toHaveCount(0);
});

/** How far the rows of the files card are scrolled inside their own region. */
async function regionScroll(page: Page) {
  return page.evaluate(
    () => document.querySelector(".largest-card .table-scroll")!.scrollTop,
  );
}

async function openFinding(page: Page, name: string) {
  await page
    .getByRole("table", { name: /^Largest files in Fixture/ })
    .getByRole("button", { name, exact: true })
    .click();
  const heading = page.getByRole("heading", { name, exact: true });
  await expect(heading).toBeFocused();
  return heading;
}

test("a deep ranked file opens in its folder and the way back keeps the list (T6)", async ({
  page,
}) => {
  const { requests } = await prepare(page, { deep: true });
  await analyze(page);
  const table = await showLargest(page);
  await page.getByRole("radio", { name: "100 MB or more" }).check();
  await expect(table.locator("tbody tr")).toHaveCount(34);
  const movieRow = table.getByRole("button", {
    name: "movie.mkv",
    exact: true,
  });
  await movieRow.scrollIntoViewIfNeeded();
  // The rows scroll in their own region, so the page itself stays put and the
  // count and the column header remain on screen.
  const listScroll = await regionScroll(page);
  expect(listScroll).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator(".largest-card .table-footer")).toBeInViewport({
    ratio: 1,
  });
  await expect(
    table.getByRole("columnheader", { name: "Size" }),
  ).toBeInViewport({ ratio: 1 });

  // The details say what the file is, where it sits and what to do next.
  await openFinding(page, "movie.mkv");
  const detail = page.getByRole("region", { name: "movie.mkv" });
  await expect(detail).toContainText("150 MB");
  await expect(detail).toContainText(
    "No. 34 among the largest files in this analysis",
  );
  await expect(detail).toContainText("a/b/c/d/e/f");
  await expect(detail).toContainText("/fixture/a/b/c/d/e/f/movie.mkv");
  await page.screenshot({ path: "test-results/finding-detail.png" });
  await expect(
    detail.getByRole("button", { name: "Show in Explorer", exact: true }),
  ).toBeVisible();
  await checkAccessibility(page);

  // Its folder opens with only the folders that lead to it.
  await detail
    .getByRole("button", { name: "View folder in the analysis" })
    .click();
  await expect(
    page.getByRole("radio", { name: "Folder contents" }),
  ).toBeChecked();
  await expect(
    page.getByRole("heading", { name: "f", exact: true }),
  ).toBeVisible();
  expect(requests.ancestors).toEqual(["/fixture/a/b/c/d/e/f/movie.mkv"]);
  expect(requests.branches).toEqual([]);
  await expect(
    page.locator('[role="treeitem"][aria-expanded="true"]'),
  ).toHaveCount(6); // the root and a to e
  await expect(treeNode(page, "f")).toHaveAttribute("aria-selected", "true");
  await expect(treeNode(page, "Projects")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(
    page.getByRole("navigation", { name: "Folder path" }).getByRole("button"),
  ).toHaveText(["Fixture", "a", "b", "c", "d", "e", "f"]);
  // Thirty larger files come first: the file is on the second page, marked
  // with text and focused.
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  const revealed = page
    .getByRole("table", { name: /^Contents of f\./ })
    .getByRole("button", { name: /^movie\.mkv/ });
  await expect(revealed).toBeFocused();
  await expect(revealed).toHaveAttribute("aria-current", "true");
  await expect(revealed).toContainText("From largest files");
  await page.screenshot({ path: "test-results/finding-folder.png" });
  await expect(
    page.getByText("You came here from movie.mkv in Largest files."),
  ).toBeVisible();
  await checkAccessibility(page);

  // Coming back restores the filter, the row, the scroll and the focus.
  await page.getByRole("button", { name: "Back to largest files" }).click();
  await expect(
    page.getByRole("radio", { name: "Largest files" }),
  ).toBeChecked();
  await expect(
    page.getByRole("radio", { name: "100 MB or more" }),
  ).toBeChecked();
  await expect(movieRow).toBeFocused();
  await expect(movieRow).toHaveAttribute("aria-current", "true");
  expect(
    Math.abs((await regionScroll(page)) - listScroll),
  ).toBeLessThanOrEqual(2);
  // Nothing was ranked again for the way back.
  expect(requests.largest).toEqual([
    "?limit=100&minSizeBytes=0",
    "?limit=100&minSizeBytes=104857600",
  ]);

  // Closing the details alone also returns to the same row.
  await openFinding(page, "sun.jpg");
  await page.getByRole("button", { name: "Back to largest files" }).click();
  await expect(
    table.getByRole("button", { name: "sun.jpg", exact: true }),
  ).toBeFocused();

  // Forced colors drop the row's background, so an outline marks it.
  await page.emulateMedia({ forcedColors: "active" });
  expect(
    await page
      .locator("tbody tr.is-selected")
      .evaluate((row) => getComputedStyle(row).outlineStyle),
  ).toBe("solid");
});

test("folder tables keep their search when switching views and a new analysis starts clean", async ({
  page,
}) => {
  await prepare(page, { extraFiles: 30 });
  await analyze(page);
  const search = page.getByRole("searchbox", { name: "Filter this folder’s items" });
  await search.fill("note");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await showLargest(page);
  await page.getByRole("radio", { name: "100 MB or more" }).check();
  await page.getByRole("radio", { name: "Folder contents" }).check();
  await expect(search).toHaveValue("note");
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await page.getByRole("radio", { name: "Largest files" }).check();
  await expect(
    page.getByRole("radio", { name: "100 MB or more" }),
  ).toBeChecked();

  // Filters belong to their analysis, not to the next one.
  await page.getByRole("button", { name: "Rescan Fixture" }).click();
  await expect(page.getByRole("radio", { name: "Any size" })).toBeChecked();
  await page.getByRole("radio", { name: "Folder contents" }).check();
  await expect(search).toHaveValue("");
});

test("a late answer for another file never takes over, and a failed lookup is explained", async ({
  page,
}) => {
  const { requests, state } = await prepare(page, {
    deep: true,
    // One retry is allowed, as for folders, so both attempts fail.
    ancestorErrors: 2,
  });
  await analyze(page);
  await showLargest(page);

  await openFinding(page, "sun.jpg");
  const view = page.getByRole("button", {
    name: "View folder in the analysis",
  });
  await view.click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Could not open the folder of sun.jpg" }),
  ).toContainText("This item was not found in the analysis.");
  await expect(
    page.getByRole("radio", { name: "Largest files" }),
  ).toBeChecked();

  // The first file's answer is held back while the second one opens.
  let release!: () => void;
  state.ancestorGates.set(
    "/fixture/Photos/sun.jpg",
    new Promise<void>((resolve) => (release = resolve)),
  );
  await view.click();
  await expect(view).toBeDisabled();
  await page.getByRole("button", { name: "Back to largest files" }).click();
  await openFinding(page, "package.zip");
  await page
    .getByRole("button", { name: "View folder in the analysis" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  release();
  await expect.poll(() => requests.ancestors.length).toBe(4);
  await page.waitForTimeout(200);
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("You came here from package.zip in Largest files."),
  ).toBeVisible();
});

test("compact windows open a finding as a view and the explorer from both views (T6)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, { deep: true });
  await analyze(page);
  await page.keyboard.press("Escape");
  await showLargest(page);
  const explorer = page.getByRole("button", { name: "Explorer", exact: true });
  await explorer.click();
  const dialog = page.getByRole("dialog", {
    name: "File explorer",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(explorer).toBeFocused();

  await openFinding(page, "movie.mkv");
  await page
    .getByRole("button", { name: "View folder in the analysis" })
    .click();
  await expect(
    page.getByRole("heading", { name: "f", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^movie\.mkv/ })).toBeFocused();
  // The drawer's tree shows the same path, opened only that far.
  await page.getByRole("button", { name: "Explorer", exact: true }).click();
  await expect(treeNode(page, "f")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await checkAccessibility(page);

  await page.getByRole("button", { name: "Back to largest files" }).click();
  await expect(
    page.getByRole("button", { name: "movie.mkv", exact: true }),
  ).toBeFocused();
});

test("the finding and its way back read in Spanish", async ({ page }) => {
  await prepare(page, { deep: true });
  await analyze(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Language").selectOption("es");
  await page.getByRole("button", { name: "Listo" }).click();
  await page.getByRole("radio", { name: "Archivos más grandes" }).check();
  await page.getByRole("button", { name: "movie.mkv", exact: true }).click();
  await expect(
    page.getByText("N.º 34 entre los archivos más grandes de este análisis"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ver carpeta en el análisis" })
    .click();
  await expect(page.getByText("Desde los más grandes")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Volver a los archivos más grandes" }),
  ).toBeVisible();
  await checkAccessibility(page);
});

function fileSearch(page: Page) {
  return page.getByRole("searchbox", { name: "Search files by name or path" });
}
function results(page: Page) {
  return page.getByRole("table", { name: /that match the search/ });
}

test("search finds files in folders never opened, counts every match and pages them (T7)", async ({
  page,
}) => {
  const { requests } = await prepare(page, { deep: true, extraFiles: 60 });
  await analyze(page);
  await showLargest(page);
  const search = fileSearch(page);
  // Without a query the line explains the ranking; a search replaces it with
  // what that search covers.
  await expect(
    page.getByText(
      "The largest files found in Fixture. Only what this analysis covered is included, not the whole disk. To search one folder and its subfolders, select it in the explorer first.",
    ),
  ).toBeVisible();

  // A deep file, in a branch nobody expanded.
  await search.fill("MOVIE");
  await expect(
    page.getByText(
      "Search covers every file in the whole analysis, including folders you have not opened. To search one folder and its subfolders, select it in the explorer first.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Files in this analysis" }),
  ).toBeVisible();
  const table = results(page);
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody tr").first()).toContainText("a/b/c/d/e/f");
  await expect(page.getByText("1–1 of 1 matching files")).toBeVisible();
  expect(requests.branches).toEqual([]);
  // Typing waits for a pause, so one question is asked, not one per letter.
  expect(requests.files).toEqual([
    "?query=MOVIE&minSizeBytes=0&offset=0&limit=50",
  ]);
  await checkAccessibility(page);

  // Sixty matches: the count covers all of them and pages hold fifty.
  await search.fill("note");
  await expect(page.getByText("1–50 of 60 matching files")).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(50);
  await page
    .getByRole("navigation", { name: "Search results pagination" })
    .getByRole("button", { name: "Next page" })
    .click();
  await expect(page.getByText("51–60 of 60 matching files")).toBeVisible();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(10);
  // A new criterion starts again from the first page and applies before paging.
  await page.getByRole("radio", { name: "100 MB or more" }).check();
  await expect(
    page.getByRole("heading", { name: "No matching files" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No file in the whole analysis has “note” in its name or path. Only files of 100 MB or more are included.",
    ),
  ).toBeVisible();
  expect(requests.files.at(-1)).toBe(
    "?query=note&minSizeBytes=104857600&offset=0&limit=50",
  );
  await page
    .getByRole("button", { name: "Include files of any size" })
    .click();
  await expect(page.getByText("1–50 of 60 matching files")).toBeVisible();
  await search.fill("");
  await expect(
    page.getByRole("heading", { name: "Largest files in this analysis" }),
  ).toBeVisible();
});

test("a folder and its subfolders can be searched, with the scope written out", async ({
  page,
}) => {
  const { requests } = await prepare(page, { deep: true });
  await analyze(page);
  await treeNode(page, "a").click();
  await showLargest(page);
  const scopes = page.getByRole("group", { name: "Search in" });
  await expect(scopes.getByRole("radio")).toHaveCount(2);
  await scopes.getByRole("radio", { name: "a and subfolders" }).check();
  await expect(
    page.getByRole("heading", { name: "Files in a and its subfolders" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Search covers every file in a and its subfolders, including folders you have not opened.",
    ),
  ).toBeVisible();
  // No text is needed: a scope alone lists its files, largest first.
  await expect(page.getByText("1–31 of 31 matching files")).toBeVisible();
  expect(requests.files.at(-1)).toBe(
    "?query=&minSizeBytes=0&offset=0&limit=50&scope=%2Ffixture%2Fa",
  );

  // Selecting another folder keeps the chosen one and offers the new one.
  await treeNode(page, "Photos").click();
  await page.getByRole("radio", { name: "Largest files" }).check();
  await expect(scopes.getByRole("radio")).toHaveCount(3);
  await expect(
    scopes.getByRole("radio", { name: "a and subfolders" }),
  ).toBeChecked();
  await fileSearch(page).fill("sun");
  await expect(
    page.getByRole("heading", { name: "No matching files" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No file in a and its subfolders has “sun” in its name or path.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Search the whole analysis" })
    .click();
  await expect(
    scopes.getByRole("radio", { name: "Whole analysis" }),
  ).toBeChecked();
  await expect(results(page).locator("tbody tr")).toHaveCount(1);
  await expect(results(page)).toContainText("sun.jpg");
  await checkAccessibility(page);
  await page.emulateMedia({ forcedColors: "active" });
  await checkAccessibility(page, ["color-contrast"]);
});

test("Ctrl+F reaches the visible search, and a folder filter hands over to a deeper search", async ({
  page,
}) => {
  const { requests } = await prepare(page);
  await analyze(page);
  await page.keyboard.press("Control+F");
  const filter = page.getByRole("searchbox", {
    name: "Filter this folder’s items",
  });
  await expect(filter).toBeFocused();
  // The folder filter reads direct items and says so; going deeper is a search.
  await filter.fill("sun");
  await expect(
    page.getByRole("heading", { name: "No matching items" }),
  ).toBeVisible();
  await expect(
    page.getByText("The filter only reads items directly in Fixture."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Search “sun” in Fixture and subfolders" })
    .click();
  await expect(
    page.getByRole("radio", { name: "Largest files" }),
  ).toBeChecked();
  await expect(fileSearch(page)).toBeFocused();
  await expect(fileSearch(page)).toHaveValue("sun");
  await expect(results(page)).toContainText("Photos");

  // Outside the field, Ctrl+F comes back to the search of this view.
  await page.getByRole("heading", { name: "Files in this analysis" }).click();
  await page.keyboard.press("Control+F");
  await expect(fileSearch(page)).toBeFocused();

  // From a file's details, it returns to the list and its search.
  await page.getByRole("button", { name: "sun.jpg", exact: true }).click();
  const detail = page.getByRole("region", { name: "sun.jpg" });
  await expect(detail).toContainText("No. 1 of 1 matching files, by size");
  await page.keyboard.press("Control+F");
  await expect(fileSearch(page)).toBeFocused();
  await expect(fileSearch(page)).toHaveValue("sun");

  // A file has no list to filter, so the file search takes over.
  await page.getByRole("radio", { name: "Folder contents" }).check();
  await filter.fill("");
  await page
    .getByRole("table", { name: /^Contents of Fixture/ })
    .getByRole("button", { name: /^readme\.txt/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "File details" }),
  ).toBeVisible();
  await page.keyboard.press("Control+F");
  await expect(fileSearch(page)).toBeFocused();
  expect(requests.branches).toEqual([]);
});

test("a late answer never replaces the current search, and the way back keeps query and page (T6, T7)", async ({
  page,
}) => {
  const { requests, state } = await prepare(page, { extraFiles: 60 });
  await analyze(page);
  await showLargest(page);
  const search = fileSearch(page);
  let release!: () => void;
  state.fileGates.set(
    "readme",
    new Promise<void>((resolve) => (release = resolve)),
  );
  await search.fill("readme");
  await expect.poll(() => requests.files.length).toBe(1);
  await search.fill("package");
  const table = results(page);
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("package.zip");
  release();
  await page.waitForTimeout(300);
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("package.zip");
  await expect(page.getByText("1–1 of 1 matching files")).toBeVisible();

  // Earlier rows stay while the next search runs, marked as out of date.
  let next!: () => void;
  state.fileGates.set(
    "note",
    new Promise<void>((resolve) => (next = resolve)),
  );
  await search.fill("note");
  await expect(page.locator(".table-scroll.is-stale")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Searching…" }),
  ).toBeVisible();
  await expect(
    table.getByRole("button", { name: "package.zip", exact: true }),
  ).toBeDisabled();
  next();
  await expect(page.getByText("1–50 of 60 matching files")).toBeVisible();
  await expect(page.locator(".table-scroll.is-stale")).toHaveCount(0);

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("51–60 of 60 matching files")).toBeVisible();
  const row = table.getByRole("button", { name: "note-55.txt", exact: true });
  await row.click();
  await expect(page.getByRole("region", { name: "note-55.txt" })).toContainText(
    "No. 55 of 60 matching files, by size",
  );
  await page
    .getByRole("button", { name: "View folder in the analysis" })
    .click();
  const revealed = page
    .getByRole("table", { name: /^Contents of Fixture\./ })
    .getByRole("button", { name: /^note-55\.txt/ });
  await expect(revealed).toBeFocused();
  await expect(revealed).toContainText("From search results");
  await expect(
    page.getByText("You came here from note-55.txt in your search results."),
  ).toBeVisible();
  const asked = requests.files.length;
  await page.getByRole("button", { name: "Back to search results" }).click();
  await expect(search).toHaveValue("note");
  await expect(page.getByText("51–60 of 60 matching files")).toBeVisible();
  await expect(row).toBeFocused();
  await expect(row).toHaveAttribute("aria-current", "true");
  expect(requests.files.length).toBe(asked);
});

test("search reads in Spanish on a narrow window and never focuses the closed explorer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, { deep: true });
  await analyze(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Language").selectOption("es");
  await page.getByRole("button", { name: "Listo" }).click();
  await page.getByRole("radio", { name: "Archivos más grandes" }).check();
  await page.keyboard.press("Control+F");
  const search = page.getByRole("searchbox", {
    name: "Buscar archivos por nombre o ruta",
  });
  await expect(search).toBeFocused();
  await search.fill("mkv");
  await expect(
    page.getByText("1–1 de 1 archivos que coinciden"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Archivos de este análisis" }),
  ).toBeVisible();
  await expect(page.locator(".location-inline").first()).toHaveText(
    "a/b/c/d/e/f",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await checkAccessibility(page);
  await page.screenshot({
    path: "test-results/search-compact-es.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "movie.mkv", exact: true }).click();
  await expect(
    page.getByText("N.º 1 de 1 archivos que coinciden, por tamaño"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ver carpeta en el análisis" })
    .click();
  await expect(page.getByText("Desde la búsqueda")).toBeVisible();
  await page.getByRole("button", { name: "Volver a los resultados" }).click();
  await expect(search).toHaveValue("mkv");
});
