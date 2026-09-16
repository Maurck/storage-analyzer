# Storage Analyzer

Explore a folder's storage usage with an accessible desktop workspace: asynchronous scans, live progress and cancellation, keyboard-navigable directories, size charts, and searchable/sortable contents.

The interface is available in English and Spanish. Analysis runs locally and reads filesystem metadata. Results show logical file bytes; partial or inaccessible items are explained explicitly. Sizes are reported the way Windows Explorer reports them.

## Running it

On Windows, from the repository root:

```powershell
npm start   # the Electron window, and the Java API it needs
```

The desktop app starts the backend itself and stops it again when the window closes or the command is interrupted. A backend already serving `http://127.0.0.1:5000` is reused and left running, so a server you started by hand keeps its logs and survives closing the window. Use `npm run start:backend` to run the API on its own.

The frontend needs `npm ci` and `npm run build` inside `modules/frontend` before its first start. The guides below cover both, including macOS and Linux, where the two processes are started separately.

[Frontend Installation](./modules/frontend/README.md)

[Backend Installation](./modules/backend/README.md)

[Design system and architecture](./docs/design-system.md)

## Contributing

Feel free to fork this repository or create an issue if you want to.
