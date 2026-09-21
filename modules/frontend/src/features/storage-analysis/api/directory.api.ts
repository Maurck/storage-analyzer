import { AppError, isApiCode, request } from "../../../shared/lib/http";
import { backendUrl } from "../../../shared/lib/desktopBridge";
import {
  Ancestry,
  Capacity,
  DirectoryNode,
  FILE_CATEGORIES,
  FILE_ORDERS,
  FileCategory,
  FileFacts,
  FileOrder,
  FileSearch,
  Health,
  LargestFiles,
  RankedFile,
  Scan,
  SkippedItems,
  TypeBreakdown,
  Volume,
} from "../model/directory.types";

/** Must match HealthResource in the backend and API_VERSION in backend-process.js. */
export const APPLICATION = "storage-analyzer";
export const API_VERSION = 1;

const validCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const validError = (value: unknown): value is string | null | undefined =>
  value == null || typeof value === "string";
const validCode = (value: unknown) => value == null || isApiCode(value);
const optionalCount = (value: unknown) => value == null || validCount(value);
const validInstant = (value: unknown) =>
  value == null ||
  (typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !Number.isNaN(Date.parse(value)));
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isCategory = (value: unknown): value is FileCategory =>
  (FILE_CATEGORIES as readonly unknown[]).includes(value);
const validCategory = (value: unknown) => value == null || isCategory(value);
/** As the backend's catalog spells it: lower case, no dot, no separator. */
const isExtension = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[^.\\/]{1,32}$/.test(value) &&
  value === value.toLowerCase();
const validExtension = (value: unknown) => value == null || isExtension(value);
/** Date, extension and category of a file; each may be absent or null. */
const validFacts = (facts: FileFacts) =>
  validInstant(facts.lastModified) &&
  validExtension(facts.extension) &&
  validCategory(facts.category);

function validParams(value: unknown) {
  return (
    value == null ||
    (isRecord(value) &&
      Object.entries(value).every(
        ([key, entry]) => /^[a-zA-Z]{1,32}$/.test(key) && validCount(entry),
      ))
  );
}

function validVolume(value: unknown) {
  if (value == null) return true;
  if (!isRecord(value)) return false;
  const { totalBytes, usableBytes } = value as Partial<Volume>;
  return (
    validCount(totalBytes) &&
    validCount(usableBytes) &&
    usableBytes <= totalBytes
  );
}

const invalidData = () =>
  new AppError(
    "The analysis data is incomplete. Check that the frontend and backend are up to date.",
    0,
    "invalid-data",
  );

export function validateDirectory(value: unknown): DirectoryNode {
  return validateNode(value, new Set<string>());
}

function validateNode(value: unknown, paths: Set<string>): DirectoryNode {
  const node = value as DirectoryNode | null;
  if (
    !isRecord(node) ||
    typeof node.name !== "string" ||
    typeof node.absolutePath !== "string" ||
    node.absolutePath.length === 0 ||
    paths.has(node.absolutePath) ||
    !["FOLDER", "FILE", "ERROR"].includes(node.type) ||
    !Array.isArray(node.subdirectories) ||
    !validCount(node.sizeBytes) ||
    !validCount(node.fileCount) ||
    !validCount(node.directoryCount) ||
    typeof node.hasChildren !== "boolean" ||
    typeof node.childrenLoaded !== "boolean" ||
    typeof node.partial !== "boolean" ||
    !validError(node.error) ||
    !validCode(node.errorCode) ||
    !validFacts(node)
  ) {
    throw invalidData();
  }
  paths.add(node.absolutePath);
  node.subdirectories.forEach((child) => validateNode(child, paths));
  return node;
}

export function validateScan(value: unknown): Scan {
  const scan = value as Scan | null;
  if (
    !isRecord(scan) ||
    typeof scan.id !== "string" ||
    scan.id.length === 0 ||
    typeof scan.path !== "string" ||
    scan.path.length === 0 ||
    !["SCANNING", "COMPLETE", "CANCELLED", "ERROR"].includes(scan.status) ||
    ![
      scan.processedFiles,
      scan.processedDirectories,
      scan.processedBytes,
      scan.skippedCount,
      scan.elapsedMillis,
    ].every(validCount) ||
    !optionalCount(scan.millisSinceActivity) ||
    !validError(scan.error) ||
    !validCode(scan.errorCode) ||
    !validParams(scan.errorParams) ||
    !validError(scan.currentPath) ||
    !validInstant(scan.startedAt) ||
    !validInstant(scan.finishedAt) ||
    !validVolume(scan.volume)
  ) {
    throw new AppError(
      "The local service returned an invalid scan. Please restart the analysis.",
      0,
      "invalid-scan",
    );
  }
  if (scan.root != null) validateDirectory(scan.root);
  if (scan.status === "COMPLETE" && !scan.root)
    throw new AppError(
      "The completed analysis did not include a folder. Please try again.",
      0,
      "incomplete-scan",
    );
  return scan;
}

export function validateHealth(value: unknown): Health {
  const health = value as Health | null;
  if (
    !isRecord(health) ||
    typeof health.application !== "string" ||
    typeof health.apiVersion !== "number"
  ) {
    throw new AppError(
      "Another service is answering on the analysis port.",
      0,
      "service-unavailable",
    );
  }
  return health;
}

export const getHealth = async (signal?: AbortSignal) =>
  validateHealth(
    await request(backendUrl(), "/health", { signal, timeoutMs: 3000 }),
  );
export const startScan = async (path: string) =>
  validateScan(
    await request(backendUrl(), "/scans", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  );
export const getScan = async (id: string, signal?: AbortSignal) =>
  validateScan(
    await request(backendUrl(), `/scans/${encodeURIComponent(id)}`, {
      signal,
    }),
  );
export const cancelScan = async (id: string) =>
  validateScan(
    await request(backendUrl(), `/scans/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  );
export const getDirectory = async (
  id: string,
  path: string,
  signal?: AbortSignal,
) =>
  validateDirectory(
    await request(
      backendUrl(),
      `/scans/${encodeURIComponent(id)}/directory?path=${encodeURIComponent(path)}`,
      { signal },
    ),
  );

const text = (value: unknown): value is string => typeof value === "string";

export function validateAncestry(value: unknown): Ancestry {
  const ancestry = value as Ancestry | null;
  if (
    !isRecord(ancestry) ||
    !text(ancestry.scanId) ||
    !Array.isArray(ancestry.ancestors)
  )
    throw invalidData();
  validateDirectory(ancestry.entry);
  ancestry.ancestors.forEach(validateDirectory);
  // Each folder must list the next one, ending with the entry: a chain, not a set.
  const chain = [...ancestry.ancestors, ancestry.entry];
  if (
    ancestry.ancestors.some(
      (ancestor, index) =>
        ancestor.type !== "FOLDER" ||
        !ancestor.childrenLoaded ||
        !ancestor.subdirectories.some(
          (child) => child.absolutePath === chain[index + 1].absolutePath,
        ),
    )
  )
    throw invalidData();
  return ancestry;
}

export const getAncestors = async (
  id: string,
  path: string,
  signal?: AbortSignal,
) =>
  validateAncestry(
    await request(
      backendUrl(),
      `/scans/${encodeURIComponent(id)}/ancestors?path=${encodeURIComponent(path)}`,
      { signal },
    ),
  );

const timeOf = (file: RankedFile) =>
  file.lastModified ? Date.parse(file.lastModified) : null;

/** Whether `file` may follow `previous` in a list sorted this way. */
function follows(previous: RankedFile, file: RankedFile, order: FileOrder) {
  const bySize = file.sizeBytes <= previous.sizeBytes;
  if (order === "LARGEST") return bySize;
  const before = timeOf(previous);
  const after = timeOf(file);
  // Unknown dates come last in both directions; size settles ties.
  if (before === null) return after === null && bySize;
  if (after === null) return true;
  if (before === after) return bySize;
  return order === "OLDEST" ? before < after : before > after;
}

/** Distinct files at or above the minimum, in order, no more than the limit. */
function validFiles(list: LargestFiles | FileSearch, order: FileOrder) {
  const paths = new Set<string>();
  return (
    Array.isArray(list.files) &&
    list.files.length <= list.limit &&
    list.files.every((file, index) => {
      const valid =
        isRecord(file) &&
        text(file.name) &&
        text(file.absolutePath) &&
        file.absolutePath.length > 0 &&
        !paths.has(file.absolutePath) &&
        text(file.relativePath) &&
        validCount(file.sizeBytes) &&
        validFacts(file) &&
        file.sizeBytes >= list.minSizeBytes &&
        (index === 0 || follows(list.files[index - 1], file, order));
      if (valid) paths.add(file.absolutePath);
      return valid;
    })
  );
}

/** Every file of a page satisfies the type and date filters it echoes. */
function matchesFilters(search: FileSearch) {
  const from = search.modifiedFrom ? Date.parse(search.modifiedFrom) : null;
  const before = search.modifiedBefore
    ? Date.parse(search.modifiedBefore)
    : null;
  return search.files.every((file) => {
    const time = timeOf(file);
    return (
      (!search.category || file.category === search.category) &&
      (!search.extension || file.extension === search.extension) &&
      (from === null || (time !== null && time >= from)) &&
      (before === null || (time !== null && time < before))
    );
  });
}

export function validateLargest(value: unknown): LargestFiles {
  const largest = value as LargestFiles | null;
  if (
    !isRecord(largest) ||
    !text(largest.scanId) ||
    !text(largest.root) ||
    typeof largest.partial !== "boolean" ||
    ![largest.limit, largest.minSizeBytes, largest.matchingFiles].every(
      validCount,
    ) ||
    !validFiles(largest, "LARGEST")
  ) {
    throw invalidData();
  }
  return largest;
}

export function validateSearch(value: unknown): FileSearch {
  const search = value as FileSearch | null;
  if (
    !isRecord(search) ||
    !text(search.scanId) ||
    !text(search.root) ||
    !text(search.scope) ||
    search.scope.length === 0 ||
    !text(search.query) ||
    typeof search.partial !== "boolean" ||
    !validCategory(search.category) ||
    !validExtension(search.extension) ||
    !validInstant(search.modifiedFrom) ||
    !validInstant(search.modifiedBefore) ||
    (search.order != null && !FILE_ORDERS.includes(search.order)) ||
    ![
      search.minSizeBytes,
      search.offset,
      search.limit,
      search.matchingFiles,
    ].every(validCount) ||
    !validFiles(search, search.order ?? "LARGEST") ||
    !matchesFilters(search) ||
    // A page never claims more files than the count it belongs to.
    search.offset + search.files.length > search.matchingFiles
  ) {
    throw invalidData();
  }
  return search;
}

export function validateTypes(value: unknown): TypeBreakdown {
  const types = value as TypeBreakdown | null;
  if (
    !isRecord(types) ||
    !text(types.scanId) ||
    !text(types.root) ||
    !text(types.scope) ||
    types.scope.length === 0 ||
    typeof types.partial !== "boolean" ||
    ![types.catalogVersion, types.totalBytes, types.totalFiles].every(
      validCount,
    ) ||
    !Array.isArray(types.categories)
  )
    throw invalidData();
  const seen = new Set<string>();
  let bytes = 0;
  let files = 0;
  for (const total of types.categories) {
    if (
      !isRecord(total) ||
      !isCategory(total.category) ||
      seen.has(total.category) ||
      ![total.sizeBytes, total.fileCount, total.extensionCount].every(
        validCount,
      ) ||
      total.fileCount === 0 ||
      !Array.isArray(total.extensions) ||
      total.extensions.length > total.extensionCount ||
      !total.extensions.every(
        (extension) =>
          isRecord(extension) &&
          isExtension(extension.extension) &&
          validCount(extension.sizeBytes) &&
          validCount(extension.fileCount) &&
          extension.sizeBytes <= total.sizeBytes &&
          extension.fileCount <= total.fileCount,
      )
    )
      throw invalidData();
    seen.add(total.category);
    bytes += total.sizeBytes;
    files += total.fileCount;
  }
  // Each file counts once: the categories add up to the totals.
  if (bytes !== types.totalBytes || files !== types.totalFiles)
    throw invalidData();
  return types;
}

export function validateSkipped(value: unknown): SkippedItems {
  const skipped = value as SkippedItems | null;
  if (
    !isRecord(skipped) ||
    !text(skipped.scanId) ||
    ![skipped.total, skipped.recorded, skipped.offset].every(validCount) ||
    skipped.recorded > skipped.total ||
    !Array.isArray(skipped.items) ||
    !skipped.items.every(
      (item) =>
        isRecord(item) &&
        text(item.name) &&
        text(item.absolutePath) &&
        text(item.relativePath) &&
        text(item.type) &&
        ["FOLDER", "FILE", "ERROR"].includes(item.type) &&
        isApiCode(item.code),
    )
  ) {
    throw invalidData();
  }
  return skipped;
}

export function validateCapacity(value: unknown): Capacity {
  const capacity = value as Capacity | null;
  if (
    !isRecord(capacity) ||
    ![
      capacity.maxHeapBytes,
      capacity.snapshotBudgetBytes,
      capacity.maxEntries,
      capacity.referencePathLength,
    ].every(validCount)
  ) {
    throw invalidData();
  }
  return capacity;
}

export const getLargest = async (
  id: string,
  { limit = 100, minSizeBytes = 0 } = {},
  signal?: AbortSignal,
) =>
  validateLargest(
    await request(
      backendUrl(),
      `/scans/${encodeURIComponent(id)}/largest?limit=${limit}&minSizeBytes=${minSizeBytes}`,
      { signal },
    ),
  );
export const searchFiles = async (
  id: string,
  {
    query = "",
    scope,
    minSizeBytes = 0,
    category,
    extension,
    modifiedFrom,
    modifiedBefore,
    order = "LARGEST",
    offset = 0,
    limit = 50,
  }: {
    query?: string;
    /** A folder of the analysis; the whole analysis when absent. */
    scope?: string;
    minSizeBytes?: number;
    category?: FileCategory;
    extension?: string;
    /** ISO-8601 instant, inclusive. */
    modifiedFrom?: string;
    /** ISO-8601 instant, exclusive. */
    modifiedBefore?: string;
    order?: FileOrder;
    offset?: number;
    limit?: number;
  } = {},
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams({
    query,
    minSizeBytes: String(minSizeBytes),
    offset: String(offset),
    limit: String(limit),
  });
  if (scope) params.set("scope", scope);
  if (category) params.set("category", category);
  if (extension) params.set("extension", extension);
  if (modifiedFrom) params.set("modifiedFrom", modifiedFrom);
  if (modifiedBefore) params.set("modifiedBefore", modifiedBefore);
  // Left out when it is the default, so older services keep answering.
  if (order !== "LARGEST") params.set("order", order);
  return validateSearch(
    await request(
      backendUrl(),
      `/scans/${encodeURIComponent(id)}/files?${params}`,
      { signal },
    ),
  );
};
export const getTypes = async (
  id: string,
  scope?: string,
  signal?: AbortSignal,
) =>
  validateTypes(
    await request(
      backendUrl(),
      `/scans/${encodeURIComponent(id)}/types${scope ? `?scope=${encodeURIComponent(scope)}` : ""}`,
      { signal },
    ),
  );
export const getSkipped = async (
  id: string,
  offset: number,
  limit: number,
  signal?: AbortSignal,
) =>
  validateSkipped(
    await request(
      backendUrl(),
      `/scans/${encodeURIComponent(id)}/skipped?offset=${offset}&limit=${limit}`,
      { signal },
    ),
  );
export const getCapacity = async (signal?: AbortSignal) =>
  validateCapacity(
    await request(backendUrl(), "/capacity", { signal, timeoutMs: 3000 }),
  );
