import { AppError, isApiCode, request } from "../../../shared/lib/http";
import { backendUrl } from "../../../shared/lib/desktopBridge";
import { DirectoryNode, Health, Scan, Volume } from "../model/directory.types";

/** Must match HealthResource in the backend and API_VERSION in backend-process.js. */
export const APPLICATION = "storage-analyzer";
export const API_VERSION = 1;

const validCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const validError = (value: unknown): value is string | null | undefined =>
  value == null || typeof value === "string";
const validCode = (value: unknown) => value == null || isApiCode(value);
const optionalCount = (value: unknown) => value == null || validCount(value);
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
