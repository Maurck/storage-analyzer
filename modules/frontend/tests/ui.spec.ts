import { expect, Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type {
  DirectoryNode,
  Scan,
} from "../src/features/storage-analysis/model/directory.types";

const MiB = 1024 ** 2;
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
function fixture(extraFiles = 0) {
  const projects = folder("Projects", "/fixture/Projects", [
    file("package.zip", "/fixture/Projects", 512 * MiB),
    file("assets.png", "/fixture/Projects", 256 * MiB),
  ]);
  const photos = folder("Photos", "/fixture/Photos", [
    file("sun.jpg", "/fixture/Photos", 256 * MiB),
  ]);
  const empty = folder("Empty", "/fixture/Empty", []);
  const root = folder("Fixture", "/fixture", [
    projects,
    photos,
    empty,
    file("readme.txt", "/fixture", 0),
    ...Array.from({ length: extraFiles }, (_, index) =>
      file(`note-${String(index + 1).padStart(2, "0")}.txt`, "/fixture", 0),
    ),
  ]);
  const nodes = new Map(
    [root, projects, photos, empty].map((node) => [node.absolutePath, node]),
  );
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
}
async function prepare(page: Page, options: ApiOptions = {}) {
  const data = fixture(options.extraFiles);
  const requests = {
    starts: 0,
    polls: 0,
    branches: [] as string[],
    cancels: 0,
  };
  const state = {
    pending: !!options.pending,
    startErrors: options.startErrors ?? 0,
    pollErrors: options.pollErrors ?? 0,
    branchErrors: options.branchErrors ?? 0,
    expiredId: "",
    cancelGate: undefined as Promise<void> | undefined,
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
    root: status === "COMPLETE" ? data.preview(data.root) : null,
  });
  await page.addInitScript(() => {
    window.storageAnalyzer = {
      backendUrl: "http://localhost:5000",
      selectDirectory: async () => "/fixture",
    };
  });
  await page.route("http://localhost:5000/scans**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const respond = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
        headers: { "Access-Control-Allow-Origin": "*" },
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
    } else if (url.pathname.endsWith("/directory")) {
      const path = url.searchParams.get("path")!;
      requests.branches.push(path);
      if (state.branchErrors-- > 0)
        await respond({ message: "This folder could not be loaded." }, 503);
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
          { message: "This scan has expired. Start a new scan." },
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
    .getByRole("button", { name: "Select folder", exact: true })
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
async function checkAccessibility(page: Page) {
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async () => {
    const result = await (window as any).axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
    });
    return result.violations.map((violation: any) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node: any) => node.target),
    }));
  });
  expect(violations).toEqual([]);
}

test("initial state explains the next action and passes accessibility checks", async ({
  page,
}) => {
  const { requests } = await prepare(page);
  await expect(
    page.getByRole("button", { name: "Select folder", exact: true }).first(),
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
    .getByRole("button", { name: "Select folder", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Select folder", exact: true }).first(),
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
  await page
    .getByRole("button", { name: "Select folder", exact: true })
    .click();
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
    "768 MiB",
  );
  await expect(table.getByRole("row", { name: /Projects/ })).toContainText(
    "75.0%",
  );
  await expect(table.getByRole("row", { name: /Photos/ })).toContainText(
    "256 MiB",
  );
  await expect(table.getByRole("row", { name: /Photos/ })).toContainText(
    "25.0%",
  );
  await expect(
    page.getByRole("figure", { name: /Fixture: 1 GiB/ }),
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
    .getByRole("searchbox", { name: "Search this folder" })
    .fill("Photos");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("searchbox", { name: "Search this folder" })
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
    .getByRole("button", { name: "Select folder", exact: true })
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
    .getByRole("button", { name: "Select folder", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "The local service disconnected." }),
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
    page
      .getByRole("alert")
      .filter({ hasText: "This folder could not be loaded." }),
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
  await page.getByRole("button", { name: "Rescan", exact: true }).click();
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
    .getByRole("button", { name: "Select folder", exact: true })
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
    .getByRole("button", { name: "Select folder", exact: true })
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
  await page
    .getByRole("button", { name: "Select folder", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Analysis session expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select folder", exact: true }),
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
  await page
    .getByRole("button", { name: "Select folder", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel scan", exact: true }).click();
  await expect.poll(() => requests.cancels).toBe(1);
  state.pending = false;
  await expect(
    page.getByRole("table", { name: /^Contents of Fixture/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select folder", exact: true }),
  ).toBeDisabled();
  releaseCancel();
  await expect(
    page.getByRole("button", { name: "Select folder", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Select folder", exact: true })
    .click();
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
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect(
    page.getByRole("button", { name: "Select folder", exact: true }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await checkAccessibility(page);
});
