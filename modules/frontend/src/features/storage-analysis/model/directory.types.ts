export interface DirectoryNode {
  name: string;
  absolutePath: string;
  type: "FOLDER" | "FILE" | "ERROR";
  subdirectories: DirectoryNode[];
  sizeBytes: number;
  fileCount: number;
  directoryCount: number;
  hasChildren: boolean;
  childrenLoaded: boolean;
  partial: boolean;
  /** English fallback; `errorCode` is what the interface translates. */
  error?: string | null;
  errorCode?: string | null;
}

export interface Volume {
  totalBytes: number;
  usableBytes: number;
}

export interface Scan {
  id: string;
  path: string;
  status: "SCANNING" | "COMPLETE" | "CANCELLED" | "ERROR";
  processedFiles: number;
  processedDirectories: number;
  processedBytes: number;
  skippedCount: number;
  error?: string | null;
  errorCode?: string | null;
  errorParams?: Record<string, number> | null;
  /** Frozen once the scan ends. */
  elapsedMillis: number;
  /** Only while scanning. */
  millisSinceActivity?: number | null;
  /** Only while scanning. */
  currentPath?: string | null;
  /** Capacity of the scanned volume at the start; null when unknown. */
  volume?: Volume | null;
  root?: DirectoryNode | null;
}

export interface Health {
  application: string;
  apiVersion: number;
}

export interface RankedFile {
  name: string;
  absolutePath: string;
  /** From the scan root, including the file name. */
  relativePath: string;
  sizeBytes: number;
}

export interface LargestFiles {
  scanId: string;
  root: string;
  /** The scan skipped something, so files there are missing. */
  partial: boolean;
  limit: number;
  minSizeBytes: number;
  /** Files at or above the minimum; may exceed `files.length`. */
  matchingFiles: number;
  files: RankedFile[];
}

export interface SkippedItem {
  name: string;
  absolutePath: string;
  /** From the scan root; empty for the root itself. */
  relativePath: string;
  type: DirectoryNode["type"];
  code: string;
}

export interface SkippedItems {
  scanId: string;
  /** Equals the scan's skippedCount. */
  total: number;
  /** Lower than `total` when the list was truncated. */
  recorded: number;
  offset: number;
  items: SkippedItem[];
}

/** What this computer can hold per analysis, from the backend's heap. */
export interface Capacity {
  maxHeapBytes: number;
  snapshotBudgetBytes: number;
  maxEntries: number;
  referencePathLength: number;
}

export type NodeCache = Record<string, DirectoryNode>;
