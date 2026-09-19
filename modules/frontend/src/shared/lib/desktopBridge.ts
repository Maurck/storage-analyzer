/** Why a backend managed by the desktop app is not available. */
export type BackendFailureReason =
  | "port-in-use"
  | "incompatible"
  | "unsupported-platform"
  | "timeout"
  | "exited";

/** The desktop app's view of the backend it manages (see main.js). */
export type BackendLifecycle =
  | { managed: false; state: "external" }
  | { managed: true; state: "starting" | "ready" }
  | { managed: true; state: "failed"; reason: BackendFailureReason };

/** What preload.js exposes. Absent in a browser preview. */
export interface DesktopBridge {
  backendUrl: string;
  numberLocale?: string;
  /** The labels appear in the native dialog; missing ones fall back to English. */
  selectDirectory(labels?: {
    title: string;
    buttonLabel: string;
  }): Promise<string | null>;
  getBackendStatus?(): Promise<BackendLifecycle>;
  retryBackend?(): Promise<BackendLifecycle>;
  onBackendStatus?(callback: (status: BackendLifecycle) => void): () => void;
  showItemInFolder?(scanId: string, path: string): Promise<ShowItemResult>;
  getCommonFolders?(): Promise<CommonFolder[]>;
}

/** `code` is a backend API code or one of the desktop codes below. */
export type ShowItemResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "ITEM_MISSING"
        | "ITEM_UNAVAILABLE"
        | "SERVICE_UNAVAILABLE"
        | "INVALID_REQUEST"
        | string;
    };

export type CommonFolderId =
  | "home"
  | "desktop"
  | "documents"
  | "downloads"
  | "pictures"
  | "music"
  | "videos";

export interface CommonFolder {
  id: CommonFolderId;
  path: string;
}

declare global {
  interface Window {
    storageAnalyzer?: DesktopBridge;
  }
}

export const desktopBridge = (): DesktopBridge | undefined =>
  globalThis.window?.storageAnalyzer;

export const backendUrl = () =>
  desktopBridge()?.backendUrl ?? "http://localhost:5000";
