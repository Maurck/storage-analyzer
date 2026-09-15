# Storage Analyzer backend

Java 17 and Spring Boot. The filesystem API is read-only and runs on `http://127.0.0.1:5000`.

## Run and test

Install a Java 17 JDK, set `JAVA_HOME`, then run from `modules/backend`:

```powershell
.\mvnw.cmd -B --no-transfer-progress test
.\mvnw.cmd spring-boot:run
```

On macOS/Linux, use `./mvnw` instead. Maven is provided by the wrapper. For a packaged application:

```powershell
.\mvnw.cmd -B --no-transfer-progress package
java -jar target/sa-backend.jar
```

The tests use temporary folders and cover byte totals, lazy expansion, snapshot consistency, cancellation, bounded concurrency, scan expiry, invalid paths, item/depth limits, HTTP errors, CORS and compatibility routes. A symbolic-link test is skipped when the operating system does not permit creating links.

## Scan API

| Method and path | Result |
| --- | --- |
| `POST /scans`, JSON `{"path":"C:\\Users\\example\\Documents"}` | `202` with a scan status |
| `GET /scans/{id}` | Progress, completion or failure |
| `DELETE /scans/{id}` | Cancels active work; repeated cancellation is safe |
| `GET /scans/{id}/directory?path=...` | Completed snapshot node with its direct children; URL-encode the absolute path |

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

Resource limits are two active scans, 100,000 entries per scan, depth 128, and five retained sessions. The oldest terminal sessions expire as new scans start. Exceeding the item limit fails the scan with a message asking for a smaller folder. Exceeding depth marks the affected subtree partial. Cancellation releases working data cooperatively; restarting the backend clears all sessions.

Errors use JSON `{"message":"..."}`: invalid paths return `400`, unreadable roots `403`, expired/missing scans `404`, directory reads before completion `409`, and a busy scanner `429`.

## Compatibility endpoints

`GET /directory?path=...` returns a bounded four-level preview, with at most 10,000 entries. Without `path`, it uses the current user's home folder on any platform. A depth/item limit sets `partial`; use the scan API for full recursive metrics.

`GET /directory/mock` returns seeded demonstration data and synthetic byte counts. It does not inspect the filesystem.

## Local application boundary

The server binds to loopback. Allowed browser origins are `localhost` and `127.0.0.1` on ports `3000`, `5173` and `8080`, plus the `null` origin used by Electron's local-file renderer. Credentials are not enabled. This is a trusted local API without authentication; CORS is a browser policy, not access control for other local processes. Do not expose this service publicly without an authentication and path-access design.

## Docker

From this directory, run `docker compose up --build`. The compose file binds the published port to host loopback and listens on all interfaces inside the container. The scanner sees the container's filesystem; selecting host folders requires an explicitly configured read-only volume mount and the corresponding container path.
