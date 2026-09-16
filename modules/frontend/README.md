# Storage Analyzer frontend

React 18, TypeScript, React Query 3, Webpack and Electron. The interface and fonts are bundled locally; no UI CDN or chart library is required.

## Run

Install Node.js 22 or newer, then run from this directory:

```sh
npm ci
npm run build
npm start
```

Start the [Java backend](../backend/README.md) separately. Use **Select folder** to open the native folder picker. Scans only read filesystem metadata. Sizes are logical bytes in binary units (KiB, MiB, GiB), not allocated disk space.

For development, run `npm run build:watch` in another terminal, then reload Electron after the build finishes. The watcher rebuilds bundles; it does not provide hot module replacement.

`STORAGE_ANALYZER_API_URL` configures the local service origin before launching Electron (default `http://localhost:5000`). Only HTTP(S) loopback origins using `localhost` or `127.0.0.1` are accepted. The sandboxed preload exposes exactly `backendUrl` and `selectDirectory()`.

For a local browser preview:

```sh
npm run build
node tests/serve.cjs
```

Open `http://127.0.0.1:8080`. Browser mode asks for an absolute folder path on the backend machine because the native picker is only available inside Electron.

## Verification

```sh
npm run typecheck
npm run test:data
npm run test:desktop
npm run build
npm test
```

Browser tests use installed Google Chrome on Windows if available. Otherwise run `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a compatible Chromium executable. Tests start a loopback static server and use deterministic API fixtures; no personal files are scanned by the UI suite.

- Data tests: HTTP errors, cancellation, timeout cleanup, response validation and binary formatting.
- Desktop tests: context isolation, restricted IPC, navigation, native dialog cancellation and window lifecycle.
- Browser tests: initial/loading/completed/error states, folder-entry validation, selection, keyboard tree navigation, lazy branches, filtering, sorting, pagination, cancellation, restart recovery, compact drawer and focus restoration.
- axe checks cover the initial and result views plus enlarged text. These checks complement manual keyboard and assistive-technology review; they are not a WCAG certification.

Optional real integration: with the backend running, execute `node tests/electron-smoke.cjs`. It launches and hides Electron, substitutes the native dialog selection with this project's `src/shared/ui` folder, and checks its real file count/byte total through the isolated preload and HTTP API. `STORAGE_ANALYZER_API_URL` can select another loopback port. The test closes its own Electron instance afterward.

## Interaction and data rules

- Choose a folder to start an asynchronous scan. Progress displays discovered files and bytes; Cancel scan stops it cooperatively.
- A completed scan remains visible while a new scan runs. A failed or cancelled replacement does not discard prior results.
- Expand folders with Right Arrow; collapse or go to the parent with Left Arrow. Up/Down, Home/End and type-ahead move focus. Enter/Space select. Focus and selection are distinct.
- Branch data is fetched only when needed and cached by scan ID and absolute path. Search in the explorer covers **loaded items**; it never claims to search the entire filesystem.
- The contents table searches the selected folder, filters by type and sorts by name/size. Its pages contain 25 items. The tree is not paginated.
- Chart and table share the same measured values. Zero-byte and skipped items stay available in the table. Partial values are lower bounds.
- Backend restarts expire sessions. The interface releases the active scan and offers a fresh selection; old displayed results remain a snapshot.
- At compact widths, Explorer opens a native modal dialog. Escape closes it and returns focus to its trigger. At desktop widths, the splitter works with pointer, arrows, Home and End.

## Architecture

The active application is `App.tsx` → `StorageAnalysisPage`, loaded as a separate production chunk. Domain components/hooks/API/types live in `features/storage-analysis`, shared accessible primitives in `shared`, and structural components in `layouts`.

Styles are plain CSS with ordered layers: `tokens`, `reset`, `components`, `app`, `utilities`. See [design-system guidance](../../docs/design-system.md). Legacy source files are retained outside the active import graph while the migration and existing local edits are reviewed; they are not shipped in the bundle.
