// Prepares what the installer ships next to the app: the backend JAR and a
// trimmed Java runtime made with jlink, so the installed app needs neither a
// JDK, Maven nor a network connection. Windows only, like the installer.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const frontend = path.resolve(__dirname, "..");
const repository = path.resolve(frontend, "..", "..");
const output = path.join(frontend, "package-resources");
const jar = path.join(
  repository,
  "modules",
  "backend",
  "target",
  "sa-backend.jar",
);

// From `jdeps --print-module-deps` on the backend JAR and its libraries, plus
// charsets and locale data so file names and messages behave on any Windows.
const modules = [
  "java.base",
  "java.compiler",
  "java.desktop",
  "java.instrument",
  "java.management",
  "java.naming",
  "java.net.http",
  "java.prefs",
  "java.rmi",
  "java.scripting",
  "java.security.jgss",
  "java.sql",
  "jdk.jfr",
  "jdk.unsupported",
  "jdk.charsets",
  "jdk.localedata",
  "jdk.crypto.ec",
  "jdk.zipfs",
];

function findJdk() {
  const bundled = path.join(repository, ".tools", "java17");
  const candidates = [];
  if (fs.existsSync(bundled)) {
    for (const entry of fs.readdirSync(bundled)) {
      if (entry.startsWith("jdk-")) candidates.push(path.join(bundled, entry));
    }
  }
  if (process.env.JAVA_HOME) candidates.push(process.env.JAVA_HOME);
  const jdk = candidates.find(
    (home) =>
      fs.existsSync(path.join(home, "bin", "jlink.exe")) &&
      fs.existsSync(path.join(home, "jmods", "java.base.jmod")),
  );
  if (!jdk)
    throw new Error(
      "A JDK 17 with jlink and jmods is needed: restore .tools/java17 or set JAVA_HOME.",
    );
  const release = fs.readFileSync(path.join(jdk, "release"), "utf8");
  if (!/JAVA_VERSION="17[."]/.test(release))
    throw new Error(`${jdk} is not a JDK 17.`);
  return jdk;
}

function run(command, args, options = {}) {
  console.log(`> ${path.basename(command)} ${args.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit", ...options });
}

if (process.platform !== "win32")
  throw new Error("The installer is built on Windows.");

// 1. The backend, tested and packaged with the project's own toolchain.
run("powershell.exe", [
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  path.join(repository, "start-backend.ps1"),
  "-Goal",
  "package",
]);
if (!fs.existsSync(jar))
  throw new Error(`The backend build did not produce ${jar}.`);

// 2. A runtime with only the modules the backend uses.
const jdk = findJdk();
fs.rmSync(output, { recursive: true, force: true });
run(path.join(jdk, "bin", "jlink.exe"), [
  "--add-modules",
  modules.join(","),
  "--strip-debug",
  "--no-man-pages",
  "--no-header-files",
  "--compress=2",
  "--output",
  path.join(output, "runtime"),
]);

// 3. The JAR beside it.
fs.mkdirSync(path.join(output, "backend"), { recursive: true });
fs.copyFileSync(jar, path.join(output, "backend", "sa-backend.jar"));

const size = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const full = path.join(dir, entry.name);
    return total + (entry.isDirectory() ? size(full) : fs.statSync(full).size);
  }, 0);
console.log(
  `Runtime: ${(size(path.join(output, "runtime")) / 1024 ** 2).toFixed(1)} MiB, backend: ${(fs.statSync(jar).size / 1024 ** 2).toFixed(1)} MiB`,
);
