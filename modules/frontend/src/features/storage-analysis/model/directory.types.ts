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
  error?: string | null;
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
  root?: DirectoryNode | null;
}

export type NodeCache = Record<string, DirectoryNode>;

declare global {
  interface Window {
    storageAnalyzer?: {
      backendUrl: string;
      selectDirectory(): Promise<string | null>;
    };
  }
}
