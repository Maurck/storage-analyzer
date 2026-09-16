const { contextBridge, ipcRenderer } = require("electron");

const backendArgument = process.argv.find((argument) =>
  argument.startsWith("--storage-analyzer-api-url="),
);
const backendUrl = backendArgument
  ? decodeURIComponent(
      backendArgument.slice("--storage-analyzer-api-url=".length),
    )
  : "http://localhost:5000";

contextBridge.exposeInMainWorld(
  "storageAnalyzer",
  Object.freeze({
    backendUrl,
    selectDirectory: () =>
      ipcRenderer.invoke("storage-analyzer:select-directory"),
  }),
);
