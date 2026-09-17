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

export type NodeCache = Record<string, DirectoryNode>;
