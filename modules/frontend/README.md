# Storage Analyzer frontend

React 18, TypeScript, React Query 3, Webpack and Electron. The interface and fonts are bundled locally; no UI CDN or chart library is required.

## Run

Install Node.js 22 or newer, then run from this directory:

```sh
npm ci
npm run build
npm start
```

The interface ships in English and Spanish. The **Settings** button in the header opens a dialog with the language picker; the choice applies immediately, is remembered in `localStorage` and sets the `lang` attribute so screen readers switch voice with it. Without a stored choice the app follows the browser's language and falls back to English. Each language is a separate chunk loaded on demand. Numbers, sizes and percentages follow the system's regional format, as Windows Explorer does, whichever language is selected: the desktop app passes that locale through the preload, and a browser preview uses the browser's language.

On Windows, `npm start` also starts the [Java backend](../backend/README.md) and stops it when the window closes, when the app quits, or when the command is interrupted. Before starting it, the app asks `GET /health` who is on the port: a compatible backend is reused and left running, while another program or another API version is reported instead of being mistaken for the engine. On macOS and Linux, start the backend separately; the app says so and keeps checking. Use **New analysis** (Ctrl+O) to open the native folder picker; the button next to it lists recent and common folders. Saving recent folders can be turned off in Settings, separately from clearing them. Scans only read filesystem metadata. Sizes are logical bytes shown in the units Windows Explorer uses (KB, MB, GB as powers of 1024), not allocated disk space.

For development, run `npm run build:watch` in another terminal, then reload Electron after the build finishes. The watcher rebuilds bundles; it does not provide hot module replacement.

`STORAGE_ANALYZER_API_URL` configures the local service origin before launching Electron (default `http://localhost:5000`). Only HTTP(S) loopback origins using `localhost` or `127.0.0.1` are accepted. The sandboxed preload exposes exactly `backendUrl`, `numberLocale`, `selectDirectory()`, `getBackendStatus()`, `retryBackend()`, `showItemInFolder(scanId, path)`, `getCommonFolders()` and `onBackendStatus(callback)`; the callback receives the status only, never the IPC event. `showItemInFolder` never trusts the path it receives: the main process asks the backend whether it belongs to that scan, uses the backend's canonical path, checks the item still exists and only then opens Explorer at it. It never opens or runs the item.

For a local browser preview:

```sh
npm run build
node tests/serve.cjs
```

Open `http://127.0.0.1:8080`. Browser mode asks for an absolute folder path on the backend machine because the native picker is only available inside Electron.

## Windows installer

`npm run dist` builds the interface, runs `scripts/prepare-package.cjs` and calls electron-builder:

1. The script tests and packages the backend with `start-backend.ps1`, then uses `jlink` from the JDK 17 in `.tools/java17` (or `JAVA_HOME`) to create `package-resources/runtime` with only the modules the backend needs (from `jdeps`, plus charsets and locale data), and copies the JAR beside it.
2. electron-builder produces `dist/Storage-Analyzer-Setup-<version>.exe`: an NSIS installer, per user and without elevation, that ships the app, the runtime and the JAR (about 152 MiB; 396 MiB installed). Only English and Spanish Chromium locales are kept. The installer is not code-signed.

Once installed, `app.isPackaged` makes the app manage its own backend without `--start-backend`: it runs `resources/runtime/bin/java.exe -jar resources/backend/sa-backend.jar` with `--storage-analyzer.parent-pid` set to its own process, so the backend exits with the app even when the app is killed. Backend output goes to `logs/backend.log` in the app's data folder (`%APPDATA%\Storage Analyzer`), rotated to `backend.old.log` past 5 MB. Uninstalling removes that folder; updating keeps it.

`scripts/verify-install.ps1 -Installer <setup.exe> [-UpdateInstaller <newer setup.exe>]` checks the installer end to end: per-user install into a folder with spaces and non-ASCII characters, start with a `PATH` that has no developer tools, a scan of a Unicode fixture, forced and normal close without a leftover JVM, update keeping data, and uninstall removing app, data and shortcuts. `scripts/sandbox/start-sandbox.ps1` runs the same checks in Windows Sandbox, a clean Windows without network access; enabling Windows Sandbox needs an administrator once.

## Verification

```sh
npm run typecheck
npm run test:data
npm run test:desktop
npm run build
npm test
```

Browser tests use installed Google Chrome on Windows if available. Otherwise run `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a compatible Chromium executable. Tests start a loopback static server and use deterministic API fixtures; no personal files are scanned by the UI suite.

- Data tests: HTTP errors and their codes, cancellation, timeouts, response and health validation (rankings, search pages and their order, ancestors, skipped items), request encoding, size/number/percentage/duration formatting in more than one locale.
- Desktop tests: context isolation, restricted IPC, navigation, native dialog cancellation, window lifecycle, the managed backend's states and retries, and the health probe against real local servers (compatible, other service, other version, closed and unresponsive ports).
- Browser tests: initial/loading/completed/error states, engine readiness (not responding, starting, each failure reason, another service, a crash after results), progress details, logical-size and drive notes, coded errors in Spanish with system number formats, forced colors, folder-entry validation, selection, keyboard tree navigation, lazy branches, filtering, sorting, pagination, cancellation, restart recovery, compact drawer and focus restoration, the way from a ranked file to its folder and back (T6), and searching the whole analysis or one folder — counts, pages, scopes, empty results, late answers and where Ctrl+F lands (T7) — in both window sizes and in Spanish.
- axe checks cover the initial, starting, unavailable, progress and result views, Spanish, enlarged text and forced colors (without its color-contrast rule, which cannot read the system palette). These checks complement manual keyboard and assistive-technology review; they are not a WCAG certification.

Optional real integration: with the backend running, `node tests/electron-first-finding.cjs` walks the first finding on a generated fixture (choose a folder, find a file six levels deep in the ranking without opening the tree, show it in Explorer with the keyboard, search for a file that is too small for the ranking and sits in a branch nobody opened, open its folder from its details and come back to the same row, then see a moved file explained). It uses no visible text, so it works in any interface language, and deletes its fixture afterwards. `node tests/electron-smoke.cjs` also needs the backend. It launches and hides Electron, substitutes the native dialog selection with this project's `src/shared/ui` folder, and checks its real file count/byte total through the isolated preload and HTTP API. `STORAGE_ANALYZER_API_URL` can select another loopback port. The test closes its own Electron instance afterward.

## Interaction and data rules

- Analyses unlock only once the engine answers its health check. Until then a banner says whether it is connecting, starting, not responding, stopped, busy with another program or another version, and offers **Try again**. Only that button restarts a managed engine; checks alone never do.
- If the engine stops after a scan, its results stay on screen as a snapshot. New scans and folders that have not loaded yet stay unavailable until it responds.
- **Largest files** ranks the 100 largest files of the whole analysis, with their location from the analyzed folder and a minimum size (any, 100 MB, 1 GB, 10 GB). It never needs the tree to be expanded and says when files are missing because something was skipped. **Folder contents** is the per-folder view; selecting a folder in the tree returns to it.
- The same view holds the **search**: typing in its field asks the backend (`/files`) for every file whose name or path from the analyzed folder contains the text, largest first, in pages of 50 with the exact number of matches. It reaches files no ranking lists and branches nobody opened. Above it, **Search in** shows the scope in words — the whole analysis or a folder with its subfolders, offered once a folder is selected in the explorer — and a line spells out what is being searched. The minimum size applies to the search as well, and both apply before paging. Typing waits a moment before asking; while the answer is on its way the previous rows stay dimmed, marked busy, and the footer says it is searching, so old rows never pass for matches. An answer to an earlier question is discarded.
- The folder table's field **filters that folder's direct items**; when it holds text, a line says so and offers **Search “…” in {folder} and subfolders**, which moves to the search with that scope. Ctrl+F always focuses the search of the view on screen; where there is none (a file, an empty folder, a file's details) it opens the file search, whose scope is written next to it. It never focuses the explorer's search, which covers loaded items only.
- Activating a listed file's name opens its **details** in place of the list: size, share of what the analysis measured, position, folder and full path, with **View folder in the analysis**, **Show in Explorer** and **Copy path** as buttons with text. **View folder in the analysis** asks the backend for the folders that lead to the file (`/ancestors`, one request), opens only that chain in the tree, shows the folder on the table page that holds the file, marks its row ("From largest files") and moves focus to it. **Back to largest files** — **Back to search results** when the file came from a search — returns from the details or from that folder to the list with the same minimum size, search, scope and page, the file's row marked and focused and the page scrolled where it was, without asking again. A late answer for an earlier file or another analysis is ignored.
- What each view shows belongs to the analysis: the search text, its scope, page, minimum size and last opened file, and each folder table's filter, type, sort and page survive switching views and folders. A new analysis starts with none of them.
- **Show in Explorer** is offered only in the desktop app, for ranked files, a file's details and the selected item. A moved or deleted item is explained instead of shown.
- **View skipped items** lists what a partial analysis skipped and why, page by page, and says when the list was truncated.
- The welcome view lists the last five analyzed folders (stored in `localStorage`, removable) and the common folders the system resolves; one click starts an analysis.
- Shortcuts: Ctrl+O chooses a folder, F5 rescans, Ctrl+F focuses the visible search and Alt+Left goes to the parent folder. They do nothing while typing in a text field or with a dialog open (a radio or checkbox holding focus does not stop them), and Settings lists them together with how many items one analysis can hold on this computer.
- Choose a folder to start an asynchronous scan. Progress displays discovered files and bytes, the elapsed time and the folder being read. After ten seconds without new items it says so; if the engine stops answering it says that instead. There is no percentage, because the total is unknown. Cancel scan stops it cooperatively.
- The summary states that sizes are logical, not disk usage, and shows the drive's free space and capacity when the scan started, or that they are unknown.
- Errors are shown from the backend's codes in the chosen language. An unknown code gets a generic message rather than the backend's English text.
- A completed scan remains visible while a new scan runs. A failed or cancelled replacement does not discard prior results.
- Expand folders with Right Arrow; collapse or go to the parent with Left Arrow. Up/Down, Home/End and type-ahead move focus. Enter/Space select. Focus and selection are distinct.
- Branch data is fetched only when needed and cached by scan ID and absolute path. Search in the explorer covers **loaded items**; it never claims to search the entire filesystem.
- The contents table filters the selected folder's direct items, by name and type, and sorts by name/size. Its pages contain 25 items; search result pages contain 50, and pages stop after the first 10,000 matches with a line asking to narrow the search. The tree is not paginated.
- Chart and table share the same measured values. Zero-byte and skipped items stay available in the table. Partial values are lower bounds.
- Backend restarts expire sessions. The interface releases the active scan and offers a fresh selection; old displayed results remain a snapshot.
- At compact widths, Explorer opens a native modal dialog from either view. Escape closes it and returns focus to its trigger. At desktop widths, the splitter works with pointer, arrows, Home and End.

## Architecture

The active application is `App.tsx` → `StorageAnalysisPage`, loaded as a separate production chunk. Domain components/hooks/API/types live in `features/storage-analysis`, shared accessible primitives in `shared`, and structural components in `layouts`.

Styles are plain CSS with ordered layers: `tokens`, `reset`, `components`, `app`, `utilities`. The order is declared at the top of `tokens.css`, the first stylesheet the page receives; see [design-system guidance](../../docs/design-system.md).
