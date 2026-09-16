# Storage Analyzer

Explore a folder's storage usage with an accessible desktop workspace: asynchronous scans, live progress and cancellation, keyboard-navigable directories, size charts, and searchable/sortable contents.

Analysis runs locally and reads filesystem metadata. Results show logical file bytes; partial or inaccessible items are explained explicitly. Sizes are reported the way Windows Explorer reports them.

## Running it

The application is two processes. On Windows, from the repository root:

```powershell
npm run start:backend   # Java API on http://127.0.0.1:5000
npm start               # Electron window, in a second terminal
```

`npm run start:backend` wraps `start-backend.ps1`, which picks a JDK 17 and stops the forked server JVM together with the script. The frontend needs `npm ci` and `npm run build` inside `modules/frontend` before its first start. The guides below cover both, including macOS and Linux.

[Frontend Installation](./modules/frontend/README.md)

[Backend Installation](./modules/backend/README.md)

[Design system and architecture](./docs/design-system.md)

## Contributing

Feel free to fork this repository or create an issue if you want to.
