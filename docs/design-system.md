# Interface foundations and extension guide

## Scope

The implemented product has one storage-analysis workspace. New primitives should be extracted when a real feature needs them; do not prebuild unused Avatar, Radio, Tabs, Toast or CRUD abstractions. React, TypeScript, React Query and plain CSS remain the application stack.

## Tokens

`modules/frontend/src/styles/tokens.css` is the source of truth. Primary 50–950, neutral 50–950, surfaces, text, borders, selection, focus and semantic colors are CSS custom properties. The default theme is dark blue with neutral panels, blue actions, and secondary chart colors. Components use `currentColor` SVGs and local system fonts.

| Pair                                          | Approximate contrast |
| --------------------------------------------- | -------------------- |
| Primary text `#F8FAFC` / background `#0B1220` | 17.89:1              |
| Secondary text `#CBD5E1` / surface `#111C2E`  | 11.51:1              |
| Muted text `#94A3B8` / surface                | 6.66:1               |
| White / primary `#2563EB`                     | 5.17:1               |
| Focus `#60A5FA` / surface                     | 6.72:1               |
| Interactive border `#64748B` / surface        | 3.59:1               |

The layer order is declared at the top of `tokens.css`, the first stylesheet injected; a declaration in `index.css` would arrive after the imported files and let `app` override `utilities`, which silently disabled the forced-colors rules before.

Decorative borders may use a quieter token. Controls need the stronger border. Never use color as the sole explanation for errors or partial analysis. Add text and an icon. The chart's exact values remain in its adjacent legend and contents table.

Spacing follows a 4px scale with a 2px half step. Shared typography uses rem units, medium/bold weights and a system font stack. Radius tokens cover 4/8/12/16px and pill shapes. Shadows are reserved for overlays. Z-index tokens define sticky, dropdown, overlay, dialog, toast and tooltip layers. Motion is short and reduced-motion preferences disable nonessential animation.

## Component ownership

```text
src/
  App.tsx                      providers and lazy feature entry
  layouts/                     shell and resizable split layout
  features/storage-analysis/
    api/                       HTTP endpoints and runtime DTO validation
    model/                     directory/scan contracts
    hooks/                     query and scan lifecycle
    components/                explorer, chart, contents and scan presentation
    StorageAnalysisPage.tsx    feature composition and selection
  features/settings/
    SettingsDialog.tsx         language, recent-folder preference, capacity and shortcuts
  shared/
    ui/                        Button, IconButton, Icon, Text, Spinner, Skeleton, SegmentedControl
    components/                Alert, EmptyState, ErrorState
    hooks/                     media query subscription
    i18n/                      language context, dictionaries and error wording
    lib/                       HTTP errors and pure formatting
  styles/                      tokens, reset, primitives and workspace layout
```

Shared UI must not import feature code. Domain types remain with their feature. Use native HTML controls first. Components forward native attributes so labels, focus and form behavior remain available. Button variants are primary, secondary, ghost and danger; sizes are sm/md/lg. IconButton requires a visible-purpose accessible label.

## States and navigation

- Results first: with results, a compact work header (the root, its state as text, "Analyzed {date}" from the scan contract, the path and the actions) and a summary strip replace the welcome heading and cards. Long explanations go in a native `<details>`; warnings that change how to read the numbers (logical size, partial analysis, drive capacity) stay visible. Charts follow the table they complement and can be hidden. Acceptance: at 1280×720 and 100 % the actions and the first row are visible without scrolling.
- Commands name their object ("Rescan {name}", "Show in Explorer" with text) and never depend on a tooltip. A menu button such as the one next to "New analysis" is a disclosure: `aria-expanded`, Escape returns focus to it, and a click outside or tabbing away closes it.
- One cause, one message: when the engine's banner explains a failure, the page does not repeat it in another alert.
- Personal data: remembering recent folders can be turned off, which hides the list without deleting it; clearing it is a separate, named action.
- Service readiness: actions that need the analysis engine stay disabled until its health check answers. Explain the reason (connecting, starting, not responding, stopped, another program or version on the port, unsupported platform) with a real recovery action. Never restart the engine without the person asking; checks may repeat with a growing interval.
- Loading: preserve geometry, show a status message and expose busy state. No invented percentage for indeterminate scans. Long scans show elapsed time and the folder being read outside live regions; only fixed sentences (a quiet period, no response) are announced.
- Empty: distinguish no scan, an empty folder, no filter results and no measurable bytes.
- Error: include context and a recovery action; keep prior successful data. Word errors from stable codes in the chosen language; never show the backend's English fallback.
- Sizes: say that they are logical file sizes, not disk usage, and keep the drive's capacity separate from them. Unknown values are shown as unknown, never as zero.
- Success: update the persistent status; avoid toasts for routine expansion/selection.
- Partial: explain exclusions and prefix affected table sizes with a lower-bound marker.
- Search: use visible scope, native search input, persistent label and a reset action.
- Views and filters with a few exclusive options use `SegmentedControl`: native radio buttons, so arrow keys and forms work, with a visible or screen-reader legend. The chosen option is marked with an outline in forced colors.
- Rankings say what they cover ("in this analysis", the root, partial coverage) and that the list is limited; they never claim to cover a whole disk.
- Native actions on items exist only in the desktop app; a browser preview hides them rather than pretending. Their failures are explained next to where they were triggered.
- Shortcuts are window-level, ignored while typing or with a dialog open, listed in Settings and announced with `aria-keyshortcuts`.
- Sorting: expose `aria-sort`; preserve stable path identities.
- Folder navigation: breadcrumbs describe the filesystem hierarchy. No application router is needed until a second feature exists.
- Modal: use `<dialog>.showModal()`, a named dialog, Escape, and focus restoration. Keep lengthy exploration in the workspace.
- Destructive actions: none exist. If added later, require an explicit target, consequence and appropriately named confirmation; do not reuse scan cancellation as a deletion pattern.
- Forms: label each input; connect hints/errors with IDs; preserve values after failure.
- Language: every visible string and accessible name comes from `shared/i18n`, so a new one means a key in both dictionaries; English defines the key type, so a missing Spanish entry fails the build. Settings stay in a dialog rather than a page, which keeps the application free of a router. Sizes, counts and percentages follow the system's regional format, never the selected language, so they keep matching Windows Explorer: the desktop app passes the system locale through the preload and `shared/lib/format.ts` groups four-digit numbers the way Windows does. Durations use a language-neutral clock format. Dictionaries load on demand, one chunk per language, to keep the initial bundle under the warning threshold.

## Responsive and keyboard acceptance

Compact mode is below 768px; regular mode is 768–1199px; wide is 1200px and above. Breakpoint values are documented tokens but media queries use literal values because CSS custom properties cannot be media conditions.

Test keyboard-only operation, 390px windows, long paths, 200% text, 400% browser zoom/reflow and Windows forced colors. In forced colors, selection uses a thicker `Highlight` border, bars get a `CanvasText` outline and a `Highlight` fill, and status dots keep a system color; values are always written out as text. Focus indicators are distinct from selection. Decorative icons are hidden from assistive technology. ARIA tree navigation follows the [W3C tree-view pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/); the target is [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/).

## Scaling rules

Scans are snapshots; keys include scan ID and absolute path. Fetch direct children on expansion, retain aggregate sizes from the snapshot, and never mix measurements from different scans. Only polling state is updated during a scan. Recover explicitly from expired sessions and reject malformed responses before rendering.

The backend bounds concurrency, depth, entries, retained sessions and an estimated memory budget shared by all snapshots (see the [backend limits](../modules/backend/README.md#resource-limits)). The budget covers retained snapshots only: it does not bound the whole JVM or the size of a response. A snapshot the workspace is displaying can expire when newer scans need memory, which reaches the interface as the existing expired-session state. Increasing those limits increases memory and CPU costs: lazy HTTP branches reduce payload size, but a wide folder still returns and renders all its direct children at once. Profile a representative large directory before introducing tree virtualization, and preserve its keyboard and ARIA hierarchy if doing so.

Production separates the workspace into a lazy chunk. The initial JavaScript bundle remains below Webpack's default warning threshold without adding a chart library or styling dependency. Run the documented checks before committing changes to shared primitives or interaction contracts.
