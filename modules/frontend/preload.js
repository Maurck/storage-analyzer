const { contextBridge, ipcRenderer } = require("electron");

function argument(name) {
  const prefix = `--storage-analyzer-${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : undefined;
}

const backendUrl = argument("api-url") ?? "http://localhost:5000";
// A BCP 47 tag or nothing; the renderer falls back to the browser locale.
const locale = argument("number-locale");
const numberLocale =
  locale && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(locale)
    ? locale
    : undefined;

contextBridge.exposeInMainWorld(
  "storageAnalyzer",
  Object.freeze({
    backendUrl,
    numberLocale,
    // Only two short strings reach the main process, which checks them again.
    selectDirectory: (labels) =>
      ipcRenderer.invoke(
        "storage-analyzer:select-directory",
        labels && typeof labels === "object"
          ? {
              title: String(labels.title ?? "").slice(0, 120),
              buttonLabel: String(labels.buttonLabel ?? "").slice(0, 120),
            }
          : undefined,
      ),
    getBackendStatus: () =>
      ipcRenderer.invoke("storage-analyzer:get-backend-status"),
    retryBackend: () => ipcRenderer.invoke("storage-analyzer:retry-backend"),
    // The main process confirms with the backend that the path was scanned.
    showItemInFolder: (scanId, path) =>
      ipcRenderer.invoke("storage-analyzer:show-item", scanId, path),
    getCommonFolders: () =>
      ipcRenderer.invoke("storage-analyzer:common-folders"),
    onBackendStatus: (callback) => {
      if (typeof callback !== "function") return () => {};
      // Pass only the status, never the IPC event, to the page.
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("storage-analyzer:backend-status", listener);
      return () =>
        ipcRenderer.removeListener("storage-analyzer:backend-status", listener);
    },
  }),
);
