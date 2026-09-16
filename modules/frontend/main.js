const { BrowserWindow, app, dialog, ipcMain } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { startBackend, stopBackend } = require("./backend-process");

const indexPath = path.join(__dirname, "index.html");
const indexUrl = pathToFileURL(indexPath).href;
const selectDirectoryChannel = "storage-analyzer:select-directory";
const backendUrl = getBackendUrl(process.env.STORAGE_ANALYZER_API_URL);
// `npm start` passes this flag. Launching Electron without it leaves the
// backend to be started separately, which is what the test harness does.
const managesBackend = (
  Array.isArray(process.argv) ? process.argv : []
).includes("--start-backend");
let mainWindow = null;
let pendingDirectoryDialog = null;

function getBackendUrl(value = "http://localhost:5000") {
  const url = new URL(value);
  // CSP host sources do not support literal IPv6 addresses; localhost may resolve to IPv6.
  const localHosts = new Set(["localhost", "127.0.0.1"]);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !localHosts.has(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "STORAGE_ANALYZER_API_URL must be an HTTP(S) loopback origin using localhost or 127.0.0.1.",
    );
  }
  return url.origin;
}

function isAppUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href === indexUrl;
  } catch {
    return false;
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 360,
    minHeight: 480,
    backgroundColor: "#0B1220",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      additionalArguments: [
        `--storage-analyzer-api-url=${encodeURIComponent(backendUrl)}`,
      ],
    },
    icon: path.join(__dirname, "icon.ico"),
  });
  mainWindow = window;
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  window.webContents.on("will-redirect", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  window.loadFile(indexPath).catch((error) => {
    console.error("Could not load Storage Analyzer:", error);
    app.quit();
  });
}

app.whenReady().then(() => {
  if (managesBackend) {
    startBackend(backendUrl)
      .then((outcome) => {
        if (outcome === "already-running") {
          console.log(`Using the backend already serving ${backendUrl}.`);
        }
      })
      .catch((error) => {
        // The window still opens: it reports an unreachable API on its own.
        console.error("Could not start the backend:", error.message);
      });
  }
  ipcMain.handle(selectDirectoryChannel, async (event) => {
    const window = mainWindow;
    if (
      !window ||
      window.isDestroyed() ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !isAppUrl(event.senderFrame.url)
    ) {
      throw new Error(
        "Folder selection is only available to the application window.",
      );
    }
    // Keep repeated clicks from creating overlapping native dialogs.
    if (!pendingDirectoryDialog) {
      pendingDirectoryDialog = dialog
        .showOpenDialog(window, {
          title: "Select a folder to analyze",
          buttonLabel: "Analyze folder",
          properties: ["openDirectory"],
        })
        .then((result) =>
          result.canceled ? null : (result.filePaths[0] ?? null),
        )
        .finally(() => {
          pendingDirectoryDialog = null;
        });
    }
    return pendingDirectoryDialog;
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Closing the window, quitting the app and interrupting `npm start` all end
// here. A forced kill does not, which is why the script also watches this
// process and exits on its own when it disappears.
app.on("will-quit", () => {
  stopBackend();
});
