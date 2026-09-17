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
  selectDirectory(): Promise<string | null>;
  getBackendStatus?(): Promise<BackendLifecycle>;
  retryBackend?(): Promise<BackendLifecycle>;
  onBackendStatus?(callback: (status: BackendLifecycle) => void): () => void;
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
