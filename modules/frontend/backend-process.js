const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

// The start script lives at the repository root and already owns the server's
// lifetime: it pins the JDK and holds a job object that kills the JVM that
// spring-boot:run forks. Reusing it keeps one definition of how to run the API.
const scriptPath = path.join(__dirname, "..", "..", "start-backend.ps1");

let child = null;

function isPortOpen(port, host, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

/**
 * Starts the backend for this desktop session. Returns what it did, so callers
 * can report an API that was already running instead of a failed port bind.
 */
async function startBackend(backendUrl) {
  if (child) return "running";
  if (process.platform !== "win32") return "unsupported-platform";

  const url = new URL(backendUrl);
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  // A backend started by hand keeps port 5000, and a second one would only fail
  // to bind it. Leave that instance alone and use it.
  if (await isPortOpen(port, url.hostname)) return "already-running";

  const started = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      // The script exits when this process disappears, so a killed Electron
      // never leaves the server holding the port.
      "-ParentProcessId",
      String(process.pid),
    ],
    { stdio: "inherit", windowsHide: true },
  );
  child = started;
  started.once("exit", () => {
    if (child === started) child = null;
  });
  started.once("error", (error) => {
    if (child === started) child = null;
    console.error("Could not start the backend:", error.message);
  });
  return "started";
}

/** Stops a backend this process started. Backends started elsewhere are left alone. */
function stopBackend() {
  if (!child) return false;
  const stopping = child;
  child = null;
  // Terminating the script closes its job object, which is what stops the JVM.
  stopping.kill();
  return true;
}

module.exports = { startBackend, stopBackend, scriptPath };
