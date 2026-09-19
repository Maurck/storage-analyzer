import { AppError, isApiCode, request } from "../../../shared/lib/http";
import { backendUrl } from "../../../shared/lib/desktopBridge";
import {
  Capacity,
  DirectoryNode,
  Health,
  LargestFiles,
  Scan,
  SkippedItems,
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
    !validCode(node.errorCode)
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

export function validateLargest(value: unknown): LargestFiles {
  const largest = value as LargestFiles | null;
  const paths = new Set<string>();
  if (
    !isRecord(largest) ||
    !text(largest.scanId) ||
    !text(largest.root) ||
    typeof largest.partial !== "boolean" ||
    ![largest.limit, largest.minSizeBytes, largest.matchingFiles].every(
      validCount,
    ) ||
    !Array.isArray(largest.files) ||
    largest.files.length > largest.limit ||
    !largest.files.every((file) => {
      const valid =
        isRecord(file) &&
        text(file.name) &&
        text(file.absolutePath) &&
        file.absolutePath.length > 0 &&
        !paths.has(file.absolutePath) &&
        text(file.relativePath) &&
        validCount(file.sizeBytes) &&
        file.sizeBytes >= largest.minSizeBytes;
      if (valid) paths.add(file.absolutePath);
      return valid;
    })
  ) {
    throw invalidData();
  }
  return largest;
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
