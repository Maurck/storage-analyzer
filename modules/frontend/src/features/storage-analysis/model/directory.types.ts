/**
 * Families of file extensions, from the backend's versioned catalog. A category
 * says what a file is called, never what it contains.
 */
export const FILE_CATEGORIES = [
  "VIDEO",
  "IMAGE",
  "AUDIO",
  "DOCUMENT",
  "ARCHIVE",
  "DISK_IMAGE",
  "PROGRAM",
  "OTHER",
  "NO_EXTENSION",
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

/** How a search sorts its matches. Unknown dates come last either way. */
export const FILE_ORDERS = ["LARGEST", "OLDEST", "NEWEST"] as const;
export type FileOrder = (typeof FILE_ORDERS)[number];

/** What a file carries besides its size; absent from services older than H4c. */
export interface FileFacts {
  /** ISO-8601 instant the file was last written, as the scan read it; null when unknown. */
  lastModified?: string | null;
  /** Lower-case text after the last dot of the name; null when there is none. */
  extension?: string | null;
  category?: FileCategory | null;
}

/** Folders and skipped items carry no file facts. */
export interface DirectoryNode extends FileFacts {
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
  /** ISO-8601 instant; absent from services older than this contract. */
  startedAt?: string | null;
  /** ISO-8601 instant once the scan ended; null while scanning. */
  finishedAt?: string | null;
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

export interface RankedFile extends FileFacts {
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

/**
 * One page of the files under a folder of the analysis, subfolders included,
 * that match every filter at once, in the order asked for.
 */
export interface FileSearch {
  scanId: string;
  root: string;
  /** The folder searched; the root for the whole analysis. */
  scope: string;
  /** Something under the scope was skipped, so files there cannot match. */
  partial: boolean;
  query: string;
  minSizeBytes: number;
  /** The filters below are echoed back; null or absent means any. */
  category?: FileCategory | null;
  extension?: string | null;
  /** Inclusive. */
  modifiedFrom?: string | null;
  /** Exclusive. A file whose date is unknown never matches either bound. */
  modifiedBefore?: string | null;
  /** Absent from services older than H4c, which sort by size only. */
  order?: FileOrder;
  offset: number;
  limit: number;
  /** Every match under the scope, not only this page. */
  matchingFiles: number;
  files: RankedFile[];
}

export interface ExtensionTotal {
  extension: string;
  sizeBytes: number;
  fileCount: number;
}

export interface CategoryTotal {
  category: FileCategory;
  sizeBytes: number;
  fileCount: number;
  /** Distinct extensions in the category; `extensions` lists the largest. */
  extensionCount: number;
  extensions: ExtensionTotal[];
}

/**
 * The files under a folder of the analysis grouped by category. Each file
 * counts once, so the categories add up to the totals.
 */
export interface TypeBreakdown {
  scanId: string;
  root: string;
  scope: string;
  /** Something under the scope was skipped, so its files are missing here too. */
  partial: boolean;
  catalogVersion: number;
  totalBytes: number;
  totalFiles: number;
  /** Categories with at least one file, largest first. */
  categories: CategoryTotal[];
}

/** Where an entry sits in a completed scan. */
export interface Ancestry {
  scanId: string;
  /** The entry itself, without children, with the snapshot's own path. */
  entry: DirectoryNode;
  /** Root first, down to the entry's parent, each with its direct children. */
  ancestors: DirectoryNode[];
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
