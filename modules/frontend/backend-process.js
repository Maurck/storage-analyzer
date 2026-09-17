const { spawn } = require("node:child_process");
const path = require("node:path");

// The start script lives at the repository root and already owns the server's
// lifetime: it pins the JDK and holds a job object that kills the JVM that
// spring-boot:run forks. Reusing it keeps one definition of how to run the API.
const scriptPath = path.join(__dirname, "..", "..", "start-backend.ps1");

// Must match HealthResource in the backend. A different version means the two
// halves of the app were built from different sources.
const APPLICATION = "storage-analyzer";
const API_VERSION = 1;

let child = null;

/**
 * Asks whatever answers on the backend origin who it is. Returns
 * `compatible`, `incompatible` (with `other-service` or `api-version`),
 * `unresponsive` (a connection that never answered) or `unreachable`.
 * An open port alone proves nothing: another program may be holding it.
 */
async function probeBackend(
  backendUrl,
  { timeoutMs = 1500, fetchImpl = globalThis.fetch } = {},
) {
  let response;
  try {
    response = await fetchImpl(new URL("/health", backendUrl), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return error?.name === "TimeoutError"
      ? { state: "unresponsive" }
      : { state: "unreachable" };
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON: someone else is serving this port.
  }
  if (!response.ok || !body || body.application !== APPLICATION) {
    return { state: "incompatible", reason: "other-service" };
  }
  if (body.apiVersion !== API_VERSION) {
    return { state: "incompatible", reason: "api-version" };
  }
  return { state: "compatible" };
}

/**
 * Starts the backend for this desktop session unless something already
 * answers on its origin. Returns what it did:
 * `started`, `running` (our process is still alive), `already-running`
 * (a compatible backend started elsewhere), `port-in-use`, `incompatible`
 * or `unsupported-platform`.
 */
async function startBackend(
  backendUrl,
  {
    probe = probeBackend,
    spawnImpl = spawn,
    platform = process.platform,
    onExit,
  } = {},
) {
  if (child) return "running";
  const found = await probe(backendUrl);
  if (found.state === "compatible") return "already-running";
  if (found.state === "unresponsive") return "port-in-use";
  if (found.state === "incompatible") {
    return found.reason === "api-version" ? "incompatible" : "port-in-use";
  }
  if (platform !== "win32") return "unsupported-platform";

  const started = spawnImpl(
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
  const forget = () => {
    if (child !== started) return false;
    child = null;
    return true;
  };
  started.once("exit", (code) => {
    if (forget()) onExit?.(code);
  });
  started.once("error", (error) => {
    console.error("Could not start the backend:", error.message);
    if (forget()) onExit?.(null);
  });
  return "started";
}

/**
 * Polls the health endpoint until the backend answers, the process this app
 * started exits, or the timeout passes. Resolves `ready`, `exited`,
 * `incompatible`, `port-in-use` or `timeout`. Never restarts anything.
 */
async function waitForBackend(
  backendUrl,
  {
    timeoutMs = 120_000,
    intervalMs = 500,
    probe = probeBackend,
    isAlive = isRunning,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = Date.now,
  } = {},
) {
  const deadline = now() + timeoutMs;
  for (;;) {
    const found = await probe(backendUrl);
    if (found.state === "compatible") return "ready";
    if (found.state === "incompatible") {
      return found.reason === "api-version" ? "incompatible" : "port-in-use";
    }
    if (!isAlive()) return "exited";
    if (now() >= deadline) return "timeout";
    await sleep(intervalMs);
  }
}

function isRunning() {
  return child !== null;
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

module.exports = {
  API_VERSION,
  APPLICATION,
  isRunning,
  probeBackend,
  scriptPath,
  startBackend,
  stopBackend,
  waitForBackend,
};
