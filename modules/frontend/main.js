const { BrowserWindow, app, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  probeBackend,
  startBackend,
  stopBackend,
  waitForBackend,
} = require("./backend-process");

const indexPath = path.join(__dirname, "index.html");
const indexUrl = pathToFileURL(indexPath).href;
const selectDirectoryChannel = "storage-analyzer:select-directory";
const backendStatusChannel = "storage-analyzer:backend-status";
const getBackendStatusChannel = "storage-analyzer:get-backend-status";
const retryBackendChannel = "storage-analyzer:retry-backend";
const showItemChannel = "storage-analyzer:show-item";
const commonFoldersChannel = "storage-analyzer:common-folders";
const scanIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Folders the system itself resolves; their names differ by language and user.
const commonFolderIds = [
  "home",
  "desktop",
  "documents",
  "downloads",
  "pictures",
  "music",
  "videos",
];
const backendUrl = getBackendUrl(process.env.STORAGE_ANALYZER_API_URL);
// `npm start` passes this flag. Launching Electron without it leaves the
// backend to be started separately, which is what the test harness does.
const managesBackend = (
  Array.isArray(process.argv) ? process.argv : []
).includes("--start-backend");
let mainWindow = null;
let pendingDirectoryDialog = null;
// What the renderer is told about the backend this app manages. Without
// --start-backend the app manages nothing and the renderer relies on its own
// health checks alone.
let backendStatus = managesBackend
  ? { managed: true, state: "starting" }
  : { managed: false, state: "external" };
let backendLaunch = null;

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
        // Sizes and counts follow the regional format, not the UI language.
        `--storage-analyzer-number-locale=${encodeURIComponent(systemLocale())}`,
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

function systemLocale() {
  // The regional format (Windows "Region" settings), which Explorer follows.
  try {
    return app.getSystemLocale?.() || "";
  } catch {
    return "";
  }
}

function setBackendStatus(next) {
  backendStatus = next;
  const window = mainWindow;
  if (window && !window.isDestroyed()) {
    window.webContents.send(backendStatusChannel, backendStatus);
  }
}

/**
 * Runs the managed start sequence once at a time. It never restarts the
 * backend on its own: a failed start waits for the person to retry.
 */
function launchBackend() {
  if (backendLaunch) return backendLaunch;
  setBackendStatus({ managed: true, state: "starting" });
  backendLaunch = (async () => {
    try {
      const outcome = await startBackend(backendUrl, {
        onExit: () => {
          if (!backendLaunch) {
            setBackendStatus({
              managed: true,
              state: "failed",
              reason: "exited",
            });
          }
        },
      });
      if (outcome === "already-running") {
        console.log(`Using the backend already serving ${backendUrl}.`);
        return setBackendStatus({ managed: true, state: "ready" });
      }
      if (outcome !== "started" && outcome !== "running") {
        return setBackendStatus({
          managed: true,
          state: "failed",
          reason: outcome,
        });
      }
      const result = await waitForBackend(backendUrl);
      setBackendStatus(
        result === "ready"
          ? { managed: true, state: "ready" }
          : { managed: true, state: "failed", reason: result },
      );
    } catch (error) {
      console.error("Could not start the backend:", error.message);
      setBackendStatus({ managed: true, state: "failed", reason: "exited" });
    } finally {
      backendLaunch = null;
    }
  })();
  return backendLaunch;
}

/**
 * Asks the backend whether a path belongs to a scan. The renderer's path is never
 * trusted on its own: only a node the backend scanned, matched by whole name
 * elements rather than a text prefix, is used, and in its canonical form.
 */
async function scannedPath(scanId, itemPath) {
  let response;
  try {
    response = await fetch(
      `${backendUrl}/scans/${encodeURIComponent(scanId)}/entry?path=${encodeURIComponent(itemPath)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      },
    );
  } catch {
    return { ok: false, code: "SERVICE_UNAVAILABLE" };
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Handled below as an unusable answer.
  }
  if (!response.ok) {
    const code = body?.code;
    return {
      ok: false,
      code:
        typeof code === "string" && /^[A-Z_]{1,64}$/.test(code)
          ? code
          : "SERVICE_UNAVAILABLE",
    };
  }
  return typeof body?.absolutePath === "string"
    ? { ok: true, path: body.absolutePath }
    : { ok: false, code: "SERVICE_UNAVAILABLE" };
}

/** Shows a scanned item in the file manager. Never opens or runs it. */
async function showScannedItem(scanId, itemPath) {
  if (
    typeof scanId !== "string" ||
    !scanIdPattern.test(scanId) ||
    typeof itemPath !== "string" ||
    !itemPath ||
    itemPath.length > 32767
  ) {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  const found = await scannedPath(scanId, itemPath);
  if (!found.ok) return found;
  // The snapshot can be older than the disk: check the item is still there.
  try {
    await fs.promises.lstat(found.path);
  } catch (error) {
    return {
      ok: false,
      code:
        error.code === "ENOENT" || error.code === "ENOTDIR"
          ? "ITEM_MISSING"
          : "ITEM_UNAVAILABLE",
    };
  }
  shell.showItemInFolder(found.path);
  return { ok: true };
}

function commonFolders() {
  const folders = [];
  for (const id of commonFolderIds) {
    try {
      const folder = app.getPath(id);
      if (
        folder &&
        fs.existsSync(folder) &&
        !folders.some((entry) => entry.path === folder)
      ) {
        folders.push({ id, path: folder });
      }
    } catch {
      // Not every system defines every folder.
    }
  }
  return folders;
}

function assertAppSender(event, action) {
  const window = mainWindow;
  if (
    !window ||
    window.isDestroyed() ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    !isAppUrl(event.senderFrame.url)
  ) {
    throw new Error(`${action} is only available to the application window.`);
  }
  return window;
}

app.whenReady().then(() => {
  if (managesBackend) void launchBackend();
  ipcMain.handle(getBackendStatusChannel, (event) => {
    assertAppSender(event, "Service status");
    return backendStatus;
  });
  ipcMain.handle(retryBackendChannel, async (event) => {
    assertAppSender(event, "Restarting the service");
    // A start that is still running keeps its attempt. Without --start-backend
    // nothing here is ours to start.
    if (backendLaunch) {
      await backendLaunch;
    } else if (backendStatus.state === "failed") {
      await launchBackend();
    } else if (backendStatus.state === "ready") {
      // A reused external backend can stop after start-up without this app
      // noticing. Start our own only once nothing answers on the port.
      const found = await probeBackend(backendUrl);
      if (found.state === "unreachable") await launchBackend();
    }
    return backendStatus;
  });
  ipcMain.handle(showItemChannel, async (event, scanId, itemPath) => {
    assertAppSender(event, "Showing items");
    return showScannedItem(scanId, itemPath);
  });
  ipcMain.handle(commonFoldersChannel, (event) => {
    assertAppSender(event, "Common folders");
    return commonFolders();
  });
  ipcMain.handle(selectDirectoryChannel, async (event) => {
    const window = assertAppSender(event, "Folder selection");
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
