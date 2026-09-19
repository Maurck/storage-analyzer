# Storage Analyzer backend

Java 17 and Spring Boot. The filesystem API is read-only and runs on `http://127.0.0.1:5000`.

## Run and test

The Electron app runs this server for you when launched with `npm start`, so this section is for running the API on its own. On Windows, `start-backend.ps1` at the repository root prepares the toolchain and runs the server:

```powershell
npm run start:backend                 # same as .\start-backend.ps1
npm run start:backend -- -Goal test   # any other Maven goal
```

The script pins `JAVA_HOME` to a JDK 17 and refuses to build on a newer one, because Lombok 1.18.30 (pinned by Spring Boot 3.2.0) skips annotation processing there and the build then fails with `cannot find symbol` on every generated accessor. It prefers a JDK and Maven repository under `.tools/` when that folder exists, and otherwise falls back to `JAVA_HOME` and the default repository, downloading dependencies on the first run. Pass `-Online` for goals whose plugins are missing from the local repository, such as `clean`, and `-Force` to build on a JDK other than 17 anyway.

Stopping the script stops the whole server. `spring-boot:run` forks its own JVM, so the script puts it in a job object that Windows tears down together with the script, releasing port 5000 even when the script is killed outright.

To drive Maven yourself, install a Java 17 JDK, set `JAVA_HOME`, then run from `modules/backend`:

```powershell
.\mvnw.cmd -B --no-transfer-progress test
.\mvnw.cmd spring-boot:run
```

On macOS/Linux, use `./mvnw` instead; the start script is Windows-only. Maven is provided by the wrapper. For a packaged application:

```powershell
.\mvnw.cmd -B --no-transfer-progress package
java -jar target/sa-backend.jar
```

The tests use temporary folders and cover the health document, error codes, progress timing, current path and volume, byte totals, lazy expansion, snapshot consistency, cancellation (including a worker that outlives its evicted session), two simultaneous scans, the shared memory budget and its eviction, recovery after limit failures, wide folders, scan expiry, invalid paths, item/depth limits, HTTP errors, CORS and the retired routes. A symbolic-link test is skipped when the operating system does not permit creating links.

## Scan API

| Method and path                                                | Result                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `POST /scans`, JSON `{"path":"C:\\Users\\example\\Documents"}` | `202` with a scan status                                                       |
| `GET /scans/{id}`                                              | Progress, completion or failure                                                |
| `DELETE /scans/{id}`                                           | Cancels active work; repeated cancellation is safe                             |
| `GET /scans/{id}/directory?path=...`                           | Completed snapshot node with its direct children; URL-encode the absolute path |
| `GET /scans/{id}/entry?path=...`                               | One node of a completed scan without children; confirms the path belongs to it |
| `GET /scans/{id}/largest?limit=100&minSizeBytes=0`             | Largest files of a completed scan (see below)                                  |
| `GET /scans/{id}/skipped?offset=0&limit=100`                   | Items a completed scan skipped or only partly read, by path                    |
| `GET /capacity`                                                | How much one analysis can hold on this computer                                |
| `GET /health`                                                  | `{"application":"storage-analyzer","apiVersion":1,"status":"UP"}`              |

The status object contains `id`, `path`, `status`, `processedFiles`, `processedDirectories`, `processedBytes`, `skippedCount`, `error`, `errorCode`, `errorParams`, `elapsedMillis`, `millisSinceActivity`, `currentPath`, `volume` and `root`. `status` is `SCANNING`, `COMPLETE`, `CANCELLED` or `ERROR`. `root` is present only for completed scans; it contains one level of children. Poll progress while the status is `SCANNING`.

- `elapsedMillis`: time since the scan started, frozen once it ends (including when it is cancelled).
- `millisSinceActivity` and `currentPath`: time since the last recorded entry and the folder being read, only while scanning; otherwise `null`. A long quiet period can be a slow folder, not a hang.
- `volume`: `{"totalBytes", "usableBytes"}` of the scanned volume when the scan started, or `null` when the platform cannot tell. It is not the space the scanned files take.
- `errorCode` and `errorParams`: why a scan ended in `ERROR`: `ROOT_UNREADABLE`, `ENTRY_LIMIT` (with `limit`), `MEMORY_BUDGET`, `OUT_OF_MEMORY` or `SCAN_FAILED`. `error` holds an English fallback.

Each directory node retains `name`, `absolutePath`, `type` and `subdirectories`, and adds:

- `sizeBytes`: recursive logical file bytes, not allocated disk space. Hard links are counted once per discovered path.
- `fileCount`: recursive file count (one for a file node).
- `directoryCount`: descendant folder count, excluding the node itself.
- `hasChildren`: whether the snapshot contains direct children.
- `childrenLoaded`: whether those children are included in this response. Folder previews have `false`; request the directory endpoint when expanding them.
- `partial`: some content was inaccessible, excluded or beyond the depth limit. Treat its totals as lower bounds.
- `error` and `errorCode`: why a node is excluded, unreadable or partial (`EXCLUDED_LINK`, `DEPTH_LIMIT`, `PATH_UNREADABLE`, `CONTENTS_PARTIALLY_UNREADABLE`); otherwise `null`. The message is an English fallback.

Scans read filesystem metadata and never open file contents. Symbolic links and special files are not followed. Inaccessible paths become explicit partial/error nodes; a failure to read the root produces an `ERROR` scan. A scan is an immutable snapshot: changed files require a new scan, and expansion never silently reads newer filesystem state.

### Resource limits

| Limit                  | Value                                                    | When it is reached                                                                                       |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Active scans           | 2                                                        | `429`; cancel one or wait.                                                                               |
| Entries per scan       | derived from the heap (see below), 100,000 to 50 million | The scan fails with `ERROR` (`ENTRY_LIMIT`) and asks for a smaller folder. No totals are shown.          |
| Depth                  | 512                                                      | The affected subtree is marked partial.                                                                  |
| Retained sessions      | 3                                                        | The oldest finished session expires when a new scan starts.                                              |
| Shared snapshot budget | half of the JVM's maximum heap, by estimate              | Oldest completed snapshots expire first; if none is left, the scan fails with `ERROR` (`MEMORY_BUDGET`). |

Limits follow the computer running the backend. The JVM sizes its maximum heap from physical memory (a quarter of it by default, or whatever `-Xmx` sets), snapshots may hold half of that heap by estimate, and the entry limit is that budget divided by the estimate for a 120-character path. `GET /capacity` returns `maxHeapBytes`, `snapshotBudgetBytes`, `maxEntries` and `referencePathLength`, and the desktop app shows the entry limit in Settings.

Each entry is charged `400 + 1.3 × path length` bytes, or `400 + 2.6 × path length` when the path has characters outside Latin-1 (Java then stores it in UTF-16). This is a calibration, not a guess: 40,801 entries at average path lengths of 62, 114 and 234 characters retained 370, 420 and 545 bytes each on JDK 17 after garbage collection, about 307 bytes plus one byte per character, so the estimate carries a margin of about 30%.

| Physical memory | Default heap | Budget  | About (120-character paths) |
| --------------- | ------------ | ------- | --------------------------- |
| 8 GB            | 2 GiB        | 1 GiB   | 1.9 million entries         |
| 16 GB           | 4 GiB        | 2 GiB   | 3.9 million entries         |
| 32 GB           | 8 GiB        | 4 GiB   | 7.7 million entries         |
| 48 GB           | 11.8 GiB     | 5.9 GiB | 11.4 million entries        |

Shorter paths reach the entry limit first; longer ones reach the budget first.

What the budget does **not** bound:

- The rest of the JVM: Spring, the traversal itself, garbage-collection headroom and any other allocation. An `OutOfMemoryError` during a scan is reported as a constant `ERROR` message on a best-effort basis; the JVM may still be unstable afterwards, and restarting the backend is the recovery.
- Response size. `GET /scans/{id}` and `GET /scans/{id}/directory` return every direct child of the requested folder; a folder with 100,000 files produces a 100,000-item response, built while the service lock is held. Paginating direct children is a separate decision.
- The heap size. `-Xmx` (or the platform default) decides the budget; raising the limits in code without raising the heap only moves the failure.
- Available memory. The heap is a ceiling, not a reservation: on a computer already short of memory, a scan near the limit can make the system page before the budget is reached.

Cancelled and failed scans release their working tree as soon as their worker stops; a cancelled worker keeps its reservation until then, even if its session has already expired. Expired sessions answer `404`, so a client can lose a snapshot it is still displaying when newer scans need the memory. Restarting the backend clears all sessions.

Errors use JSON `{"code":"...","message":"..."}`. Clients translate `code`; `message` is an English fallback and may change.

| Status | Codes                                                                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `INVALID_REQUEST`, `INVALID_PARAMETER`, `PATH_REQUIRED`, `PATH_INVALID`, `PATH_NOT_ABSOLUTE`, `FOLDER_NOT_FOUND`, `NOT_A_FOLDER`, `PATH_OUTSIDE_SCAN` |
| `403`  | `FOLDER_UNREADABLE`                                                                                                                                   |
| `404`  | `SCAN_NOT_FOUND`, `PATH_NOT_IN_SCAN`                                                                                                                  |
| `409`  | `SCAN_NOT_COMPLETE`                                                                                                                                   |
| `429`  | `SCANS_AT_CAPACITY`, `SCANNER_BUSY`                                                                                                                   |

## Ranking, skipped items and entries

`GET /scans/{id}/largest` returns `scanId`, `root`, `partial`, `limit`, `minSizeBytes`, `matchingFiles` and `files`, each with `name`, `absolutePath`, `relativePath` (from the root, including the name) and `sizeBytes`. Only files are ranked, largest first, ties by path, so the order never depends on hashing. `limit` goes from 1 to 500 and `minSizeBytes` is inclusive. The first request ranks the snapshot once with a bounded heap of 500; later ones only filter that ranking and count matching files, so `matchingFiles` can exceed `files.length`. `partial` means files inside skipped items are missing from the ranking.

`GET /scans/{id}/skipped` lists the items flagged with a node code, by path: `total` equals the scan's `skippedCount`, `recorded` is how many can be listed (at most 10,000) and each item has `name`, `absolutePath`, `relativePath`, `type` and `code`. `limit` goes from 1 to 500.

`GET /scans/{id}/entry` answers one node without its children. The desktop app uses it before showing an item in Explorer: the path must belong to the scan by whole name elements, never by a text prefix, and the canonical path from the snapshot is the one shown.

All three need a completed scan (`409 SCAN_NOT_COMPLETE` otherwise) and answer `400 INVALID_PARAMETER` for malformed or out-of-range parameters.

## Health and compatibility

`GET /health` lets the desktop app tell this service apart from any other program on the port. It checks `application` and `apiVersion`; an open port alone proves nothing. Increase `HealthResource.API_VERSION`, together with `API_VERSION` in `modules/frontend/backend-process.js` and `directory.api.ts`, whenever a change would break a client built for the previous version. The endpoint reads no files and has no side effects.

## Retired endpoints

`GET /directory` and `GET /directory/mock` were removed; the desktop app never called them. They now answer Spring's default `404`, not the `{"code","message"}` body above. Use the scan API instead.

## Lifetime

With `--storage-analyzer.parent-pid=<pid>`, the backend exits as soon as that process ends, or right away if it is already gone. The installed desktop app passes its own process id, so a killed app never leaves a JVM holding the port. Without the property, as when started by hand or by `start-backend.ps1`, nothing is watched.

## Local application boundary

The server binds to loopback. Allowed browser origins are `localhost` and `127.0.0.1` on ports `3000`, `5173` and `8080`, plus the `null` origin used by Electron's local-file renderer. Credentials are not enabled. This is a trusted local API without authentication; CORS is a browser policy, not access control for other local processes. Do not expose this service publicly without an authentication and path-access design.

## Docker

From this directory, run `docker compose up --build`. The compose file binds the published port to host loopback and listens on all interfaces inside the container. The scanner sees the container's filesystem; selecting host folders requires an explicitly configured read-only volume mount and the corresponding container path.
