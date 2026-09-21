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

The tests use temporary folders and cover the health document, error codes, progress timing, current path and volume, byte totals, lazy expansion, the chain of folders leading to an entry, searches over the whole snapshot (case, separators, scope, paging, counts and the bounds of each parameter), modification times (unknown ones included), the extension catalog, the breakdown by type and that it adds up to its folder, type and date filters combined with the others, the order by date and that they leave the service free for another scan's progress and cancellation, snapshot consistency, cancellation (including a worker that outlives its evicted session), two simultaneous scans, the shared memory budget and its eviction, recovery after limit failures, wide folders, scan expiry, invalid paths, item/depth limits, HTTP errors, CORS and the retired routes. A symbolic-link test is skipped when the operating system does not permit creating links.

## Scan API

| Method and path                                                | Result                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `POST /scans`, JSON `{"path":"C:\\Users\\example\\Documents"}` | `202` with a scan status                                                       |
| `GET /scans/{id}`                                              | Progress, completion or failure                                                |
| `DELETE /scans/{id}`                                           | Cancels active work; repeated cancellation is safe                             |
| `GET /scans/{id}/directory?path=...`                           | Completed snapshot node with its direct children; URL-encode the absolute path |
| `GET /scans/{id}/entry?path=...`                               | One node of a completed scan without children; confirms the path belongs to it |
| `GET /scans/{id}/ancestors?path=...`                           | An entry and the folders leading to it, each with its direct children          |
| `GET /scans/{id}/largest?limit=100&minSizeBytes=0`             | Largest files of a completed scan (see below)                                  |
| `GET /scans/{id}/files?query=&scope=&minSizeBytes=0&category=&extension=&modifiedFrom=&modifiedBefore=&order=LARGEST&offset=0&limit=50` | One page of the files matching every filter (see below) |
| `GET /scans/{id}/types?scope=`                                 | The files of a folder, subfolders included, grouped by type (see below)        |
| `GET /scans/{id}/skipped?offset=0&limit=100`                   | Items a completed scan skipped or only partly read, by path                    |
| `GET /capacity`                                                | How much one analysis can hold on this computer                                |
| `GET /health`                                                  | `{"application":"storage-analyzer","apiVersion":1,"status":"UP"}`              |

The status object contains `id`, `path`, `status`, `processedFiles`, `processedDirectories`, `processedBytes`, `skippedCount`, `error`, `errorCode`, `errorParams`, `startedAt`, `finishedAt`, `elapsedMillis`, `millisSinceActivity`, `currentPath`, `volume` and `root`. `status` is `SCANNING`, `COMPLETE`, `CANCELLED` or `ERROR`. `root` is present only for completed scans; it contains one level of children. Poll progress while the status is `SCANNING`.

- `startedAt` and `finishedAt`: ISO-8601 instants in UTC. `finishedAt` is `null` while scanning and is set once, when the scan completes, fails or is cancelled. The interface shows it as "Analyzed {date}".
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
- `lastModified`, `extension` and `category`: files only, `null` for folders and skipped items. See "Dates and types" below.

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

Each entry is charged `400 + 1.3 × path length` bytes, or `400 + 2.6 × path length` when the path has characters outside Latin-1 (Java then stores it in UTF-16). This is a calibration, not a guess: 40,801 entries at average path lengths of 62, 114 and 234 characters retained 370, 420 and 545 bytes each on JDK 17 after garbage collection, about 307 bytes plus one byte per character. Keeping each file's modification time added exactly 8 bytes per entry (40,021 entries at average paths of 164 and 234 characters: 474.6 → 482.6 and 540.2 → 548.2 bytes), so about 315 bytes plus one per character now, and the estimate still carries a margin of about 27%.

| Physical memory | Default heap | Budget  | About (120-character paths) |
| --------------- | ------------ | ------- | --------------------------- |
| 8 GB            | 2 GiB        | 1 GiB   | 1.9 million entries         |
| 16 GB           | 4 GiB        | 2 GiB   | 3.9 million entries         |
| 32 GB           | 8 GiB        | 4 GiB   | 7.7 million entries         |
| 48 GB           | 11.8 GiB     | 5.9 GiB | 11.4 million entries        |

Shorter paths reach the entry limit first; longer ones reach the budget first.

What the budget does **not** bound:

- The rest of the JVM: Spring, the traversal itself, garbage-collection headroom and any other allocation. An `OutOfMemoryError` during a scan is reported as a constant `ERROR` message on a best-effort basis; the JVM may still be unstable afterwards, and restarting the backend is the recovery.
- Response size. `GET /scans/{id}` and `GET /scans/{id}/directory` return every direct child of the requested folder; a folder with 100,000 files produces a 100,000-item response. Paginating direct children is a separate decision. Searches are paged, at most 100 files at a time.
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

## Ranking, search, skipped items and entries

Queries over a completed scan take the service monitor only to find the session and its entries; the walk, the sorting and the response are built outside it, because a completed snapshot never changes. Progress, cancellation and other scans are therefore not delayed by a long query. Measured on this computer (48 GB of RAM, heap 11.8 GiB) with a synthetic fixture of 177,075 entries, 10 runs each: ranking 97 ms the first time and 7 ms afterwards; a search over the whole analysis 89 ms (p95 97 ms), 8 ms within one folder, 93 ms for the hundredth page; one folder of 20,000 children 32 ms; the ancestors of a file four levels down 1 ms. While a second scan of the same fixture ran under 24 concurrent searches, its status answered in 1 ms (p95 3 ms, max 3 ms), it reached 92,601 files in 600 ms and it cancelled in 1 ms. The JVM held 617 MiB with two snapshots and 631 MiB after 30 more searches.

`GET /scans/{id}/largest` returns `scanId`, `root`, `partial`, `limit`, `minSizeBytes`, `matchingFiles` and `files`, each with `name`, `absolutePath`, `relativePath` (from the root, including the name) and `sizeBytes`. Only files are ranked, largest first, ties by path, so the order never depends on hashing. `limit` goes from 1 to 500 and `minSizeBytes` is inclusive. The first request ranks the snapshot once with a bounded heap of 500; later ones only filter that ranking and count matching files, so `matchingFiles` can exceed `files.length`. `partial` means files inside skipped items are missing from the ranking.

`GET /scans/{id}/files` searches the files of one scope: it returns `scanId`, `root`, `scope`, `partial`, `query`, `minSizeBytes`, `category`, `extension`, `modifiedFrom`, `modifiedBefore`, `order`, `offset`, `limit`, `matchingFiles` and one page of `files`, shaped as the ranking's. Only files are listed. Every criterion applies at once (AND) and before the page is cut.

- `query` is matched against each file's path from the root, name included, ignoring case and treating `/` and `\` as the same separator. Surrounding spaces are stripped and an empty query matches every file. At most 1,024 characters.
- `scope` is a folder of the scan, searched with all its subfolders; without it the whole analysis is searched. A path outside the scan answers `PATH_OUTSIDE_SCAN`, one that is not in it `PATH_NOT_IN_SCAN` and a file `NOT_A_FOLDER`.
- `minSizeBytes` is inclusive. Every file under the scope is filtered before the page is cut, so `matchingFiles` counts all of them, not the page, and a match is found wherever it sits: beyond the ranking's 500 and inside branches no client ever expanded.
- `limit` goes from 1 to 100 and `offset + limit` may not exceed 10,000, so a client narrows a search instead of paging through millions of rows.
- `category` is one of the catalog's categories below and `extension` an extension with or without its dot, in any case (echoed in lower case without it). An extension of another category matches nothing rather than failing; one with a dot or a separator, or longer than 32 characters, answers `INVALID_PARAMETER`.
- `modifiedFrom` (inclusive) and `modifiedBefore` (exclusive) are ISO-8601 instants such as `2026-09-20T00:00:00Z`. A file whose time is unknown never satisfies either bound. A range whose start is not before its end answers `INVALID_PARAMETER`.
- `order` is `LARGEST` (default: largest first), `OLDEST` or `NEWEST`. Files whose time is unknown come last in both date orders; size and then path settle ties, so pages never overlap or skip.
- `partial` refers to the scope: something under it was skipped, so files there cannot match.

`GET /scans/{id}/types` groups the files of a scope (the root without `scope`) by category: `scanId`, `root`, `scope`, `partial`, `catalogVersion`, `totalBytes`, `totalFiles` and `categories`, largest first, each with `category`, `sizeBytes`, `fileCount`, `extensionCount` and its ten largest `extensions` (`extension`, `sizeBytes`, `fileCount`). Every file counts once, so the categories add up to the totals, which equal the folder's own `sizeBytes` and `fileCount`. Only categories with files are listed.

`GET /scans/{id}/skipped` lists the items flagged with a node code, by path: `total` equals the scan's `skippedCount`, `recorded` is how many can be listed (at most 10,000) and each item has `name`, `absolutePath`, `relativePath`, `type` and `code`. `limit` goes from 1 to 500.

`GET /scans/{id}/entry` answers one node without its children. The desktop app uses it before showing an item in Explorer: the path must belong to the scan by whole name elements, never by a text prefix, and the canonical path from the snapshot is the one shown.

`GET /scans/{id}/ancestors` returns `scanId`, `entry` (the node without children, with the snapshot's own path) and `ancestors`: the folders from the root down to the entry's parent, root first, each with its direct children, so a client can open the folder of a ranked file without expanding anything else. The chain is empty for the root. The path is checked like `entry`, and the whole chain comes from one snapshot; its size is the sum of those folders' direct children, as if each had been requested with `directory`.

All six need a completed scan (`409 SCAN_NOT_COMPLETE` otherwise) and answer `400 INVALID_PARAMETER` for malformed or out-of-range parameters.

### Dates and types

Each file keeps the modification time the file system reported when it was read. It is sent as an ISO-8601 instant in `lastModified`, or `null` when unknown: Windows and FAT write zero for a time that was never set, so nothing at or before 1970-01-01 is taken as a date. A time after the scan is kept as read; clients mark it. It says when a file was last written, not when it was last opened or used. Folders carry no time of their own.

`extension` is the lower-case text after the last dot of the name, or `null` when there is none, the dot is the first or last character (`.gitignore`, `trailing.`) or the text is longer than 32 characters. `category` comes from a small catalog versioned as `catalogVersion` (`FileTypes.VERSION`, now 1): `VIDEO`, `IMAGE`, `AUDIO`, `DOCUMENT`, `ARCHIVE`, `DISK_IMAGE`, `PROGRAM`, `OTHER` for any other extension and `NO_EXTENSION`. It is an approximation by name; contents are never read. `.ts` is left in `OTHER` because it is as often TypeScript as a video stream. Raise the version whenever an extension changes category.

Measured on this computer with a synthetic fixture of 172,186 entries (172,001 files, eleven extensions, dates over five years), 10 runs each after a first one: a search by category 14 ms (p95 52 ms), by extension 12 ms (p95 19 ms), by date 6 ms (p95 8 ms), with every filter and text at once 10 ms (p95 14 ms), the hundredth page of a category 19 ms (p95 23 ms); a breakdown of the whole analysis 14 ms (p95 25 ms), of a twelfth of it 1 ms. They walk the snapshot outside the service monitor, like the other queries.

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
