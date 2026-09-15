import { AppError, request } from "../../../shared/lib/http";
import { DirectoryNode, Scan } from "../model/directory.types";

const baseUrl = () =>
  window.storageAnalyzer?.backendUrl ?? "http://localhost:5000";
const validCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const validError = (value: unknown): value is string | null | undefined =>
  value == null || typeof value === "string";

export function validateDirectory(value: unknown): DirectoryNode {
  return validateNode(value, new Set<string>());
}

function validateNode(value: unknown, paths: Set<string>): DirectoryNode {
  const node = value as DirectoryNode | null;
  if (
    !node ||
    typeof node !== "object" ||
    Array.isArray(node) ||
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
    !validError(node.error)
  ) {
    throw new AppError(
      "The analysis data is incomplete. Check that the frontend and backend are up to date.",
    );
  }
  paths.add(node.absolutePath);
  node.subdirectories.forEach((child) => validateNode(child, paths));
  return node;
}

export function validateScan(value: unknown): Scan {
  const scan = value as Scan | null;
  if (
    !scan ||
    typeof scan !== "object" ||
    Array.isArray(scan) ||
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
    ].every(validCount) ||
    !validError(scan.error)
  ) {
    throw new AppError(
      "The local service returned an invalid scan. Please restart the analysis.",
    );
  }
  if (scan.root != null) validateDirectory(scan.root);
  if (scan.status === "COMPLETE" && !scan.root)
    throw new AppError(
      "The completed analysis did not include a folder. Please try again.",
    );
  return scan;
}

export const startScan = async (path: string) =>
  validateScan(
    await request(baseUrl(), "/scans", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  );
export const getScan = async (id: string, signal?: AbortSignal) =>
  validateScan(
    await request(baseUrl(), `/scans/${encodeURIComponent(id)}`, { signal }),
  );
export const cancelScan = async (id: string) =>
  validateScan(
    await request(baseUrl(), `/scans/${encodeURIComponent(id)}`, {
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
      baseUrl(),
      `/scans/${encodeURIComponent(id)}/directory?path=${encodeURIComponent(path)}`,
      { signal },
    ),
  );
