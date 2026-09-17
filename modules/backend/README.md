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

The tests use temporary folders and cover byte totals, lazy expansion, snapshot consistency, cancellation (including a worker that outlives its evicted session), two simultaneous scans, the shared memory budget and its eviction, recovery after limit failures, wide folders, scan expiry, invalid paths, item/depth limits, HTTP errors, CORS and the retired routes. A symbolic-link test is skipped when the operating system does not permit creating links.

## Scan API

| Method and path                                                | Result                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `POST /scans`, JSON `{"path":"C:\\Users\\example\\Documents"}` | `202` with a scan status                                                       |
| `GET /scans/{id}`                                              | Progress, completion or failure                                                |
| `DELETE /scans/{id}`                                           | Cancels active work; repeated cancellation is safe                             |
| `GET /scans/{id}/directory?path=...`                           | Completed snapshot node with its direct children; URL-encode the absolute path |

The status object contains `id`, `path`, `status`, `processedFiles`, `processedDirectories`, `processedBytes`, `skippedCount`, `error` and `root`. `status` is `SCANNING`, `COMPLETE`, `CANCELLED` or `ERROR`. `root` is present only for completed scans; it contains one level of children. Poll progress while the status is `SCANNING`.

Each directory node retains `name`, `absolutePath`, `type` and `subdirectories`, and adds:

- `sizeBytes`: recursive logical file bytes, not allocated disk space. Hard links are counted once per discovered path.
- `fileCount`: recursive file count (one for a file node).
- `directoryCount`: descendant folder count, excluding the node itself.
- `hasChildren`: whether the snapshot contains direct children.
- `childrenLoaded`: whether those children are included in this response. Folder previews have `false`; request the directory endpoint when expanding them.
- `partial`: some content was inaccessible, excluded or beyond the depth limit. Treat its totals as lower bounds.
- `error`: explanation for a failed/excluded node; otherwise `null`.

Scans read filesystem metadata and never open file contents. Symbolic links and special files are not followed. Inaccessible paths become explicit partial/error nodes; a failure to read the root produces an `ERROR` scan. A scan is an immutable snapshot: changed files require a new scan, and expansion never silently reads newer filesystem state.

### Resource limits

| Limit                  | Value                                                | When it is reached                                                                     |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Active scans           | 2                                                    | `429`; cancel one or wait.                                                             |
| Entries per scan       | 250,000 files, folders and skipped items             | The scan fails with `ERROR` and asks for a smaller folder. No totals are shown.        |
| Depth                  | 512                                                  | The affected subtree is marked partial.                                                |
| Retained sessions      | 3                                                    | The oldest finished session expires when a new scan starts.                            |
| Shared snapshot budget | a quarter of the JVM's maximum heap, at most 256 MiB | Oldest completed snapshots expire first; if none is left, the scan fails with `ERROR`. |

The budget is shared by running scans and retained snapshots. Each entry is charged an estimate of `512 + 4 × path length` bytes, deliberately above what it costs: a measurement of 40,801 entries with 150–200 character paths on JDK 17 retained about 510 bytes per entry against an estimate of about 1,350. With the default heap (a quarter of physical memory), the budget is 256 MiB and fits roughly 200,000–300,000 entries depending on path length, so the entry limit and the budget bind at similar sizes. A whole system drive usually holds more than that and will fail with a message asking for a smaller folder.

What the budget does **not** bound:

- The rest of the JVM: Spring, the traversal itself, garbage-collection headroom and any other allocation. An `OutOfMemoryError` during a scan is reported as a constant `ERROR` message on a best-effort basis; the JVM may still be unstable afterwards, and restarting the backend is the recovery.
- Response size. `GET /scans/{id}` and `GET /scans/{id}/directory` return every direct child of the requested folder; a folder with 100,000 files produces a 100,000-item response, built while the service lock is held. Paginating direct children is a separate decision.
- The heap size. `-Xmx` (or the platform default) decides the budget; raising the limits in code without raising the heap only moves the failure.

Cancelled and failed scans release their working tree as soon as their worker stops; a cancelled worker keeps its reservation until then, even if its session has already expired. Expired sessions answer `404`, so a client can lose a snapshot it is still displaying when newer scans need the memory. Restarting the backend clears all sessions.

Errors use JSON `{"message":"..."}`: invalid paths return `400`, unreadable roots `403`, expired/missing scans `404`, directory reads before completion `409`, and a busy scanner `429`.

## Retired endpoints

`GET /directory` and `GET /directory/mock` were removed; the desktop app never called them. They now answer Spring's default `404`, not the `{"message"}` body above. Use the scan API instead.

## Local application boundary

The server binds to loopback. Allowed browser origins are `localhost` and `127.0.0.1` on ports `3000`, `5173` and `8080`, plus the `null` origin used by Electron's local-file renderer. Credentials are not enabled. This is a trusted local API without authentication; CORS is a browser policy, not access control for other local processes. Do not expose this service publicly without an authentication and path-access design.

## Docker

From this directory, run `docker compose up --build`. The compose file binds the published port to host loopback and listens on all interfaces inside the container. The scanner sees the container's filesystem; selecting host folders requires an explicitly configured read-only volume mount and the corresponding container path.
