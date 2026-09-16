const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const frontendPath = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(frontendPath, 'main.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(frontendPath, 'preload.js'), 'utf8');

async function loadDesktop({ backendUrl, platform = 'win32', openDialog } = {}) {
    const windows = [];
    const handlers = new Map();
    const appEvents = new Map();
    const dialogCalls = [];
    let quitCount = 0;
    class BrowserWindow {
        constructor(options) {
            this.options = options;
            this.events = new Map();
            this.webEvents = new Map();
            this.destroyed = false;
            this.webContents = {
                mainFrame: { url: pathToFileURL(path.join(frontendPath, 'index.html')).href },
                setWindowOpenHandler: handler => { this.openHandler = handler; },
                on: (name, handler) => this.webEvents.set(name, handler),
            };
            windows.push(this);
        }
        on(name, handler) { this.events.set(name, handler); }
        isDestroyed() { return this.destroyed; }
        loadFile(filename) { this.loadedFile = filename; return Promise.resolve(); }
        static getAllWindows() { return windows.filter(window => !window.destroyed); }
    }
    const app = {
        whenReady: () => Promise.resolve(),
        on: (name, handler) => appEvents.set(name, handler),
        quit: () => { quitCount += 1; },
    };
    const electron = {
        app, BrowserWindow,
        ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
        dialog: { showOpenDialog: (window, options) => {
            dialogCalls.push({ window, options });
            return openDialog ? openDialog() : Promise.resolve({ canceled: false, filePaths: ['C:\\Data'] });
        } },
    };
    vm.runInNewContext(mainSource, {
        require: name => name === 'electron' ? electron : require(name),
        __dirname: frontendPath,
        process: { env: backendUrl === undefined ? {} : { STORAGE_ANALYZER_API_URL: backendUrl }, platform },
        URL, console,
    });
    await Promise.resolve();
    return { windows, handlers, appEvents, dialogCalls, quitCount: () => quitCount };
}

function windowEvent(window) {
    return { sender: window.webContents, senderFrame: window.webContents.mainFrame };
}

test('renderer is isolated and only receives a loopback API origin', async () => {
    const { windows } = await loadDesktop({ backendUrl: 'http://127.0.0.1:5050/' });
    const window = windows[0];
    assert.equal(window.options.webPreferences.nodeIntegration, false);
    assert.equal(window.options.webPreferences.contextIsolation, true);
    assert.equal(window.options.webPreferences.sandbox, true);
    assert.equal(window.options.webPreferences.preload, path.join(frontendPath, 'preload.js'));
    assert.equal(window.options.webPreferences.additionalArguments[0], '--storage-analyzer-api-url=http%3A%2F%2F127.0.0.1%3A5050');
    assert.equal(window.loadedFile, path.join(frontendPath, 'index.html'));
    assert.equal(window.options.minWidth, 360);
});

test('unsupported backend origins, credentials, paths, queries or fragments are rejected', async () => {
    for (const backendUrl of [
        'https://example.com', 'file:///C:/Data', 'http://localhost.evil.test',
        'http://user:password@localhost:5000', 'http://localhost:5000/api',
        'http://localhost:5000/?remote=true', 'http://localhost:5000/#api',
        'http://[::1]:5000', 'https://[::1]:5000',
    ]) {
        await assert.rejects(loadDesktop({ backendUrl }), /loopback origin/);
    }
    const local = await loadDesktop({ backendUrl: 'https://localhost:5000' });
    assert.equal(local.windows.length, 1);
});

test('folder dialog belongs to the main window and cancellation returns null', async () => {
    let canceled = false;
    const desktop = await loadDesktop({ openDialog: async () => ({ canceled, filePaths: ['C:\\Selected'] }) });
    const select = desktop.handlers.get('storage-analyzer:select-directory');
    assert.equal(await select(windowEvent(desktop.windows[0])), 'C:\\Selected');
    assert.equal(desktop.dialogCalls[0].window, desktop.windows[0]);
    assert.deepEqual(Array.from(desktop.dialogCalls[0].options.properties), ['openDirectory']);
    canceled = true;
    assert.equal(await select(windowEvent(desktop.windows[0])), null);
});

test('untrusted senders, subframes and navigated pages cannot open native dialogs', async () => {
    const desktop = await loadDesktop();
    const window = desktop.windows[0];
    const select = desktop.handlers.get('storage-analyzer:select-directory');
    await assert.rejects(select({ ...windowEvent(window), sender: {} }), /application window/);
    await assert.rejects(select({ ...windowEvent(window), senderFrame: { url: window.webContents.mainFrame.url } }), /application window/);
    window.webContents.mainFrame.url = 'https://example.com';
    await assert.rejects(select(windowEvent(window)), /application window/);
    assert.equal(desktop.dialogCalls.length, 0);
});

test('overlapping requests reuse one native dialog', async () => {
    let resolveDialog;
    const desktop = await loadDesktop({ openDialog: () => new Promise(resolve => { resolveDialog = resolve; }) });
    const select = desktop.handlers.get('storage-analyzer:select-directory');
    const first = select(windowEvent(desktop.windows[0]));
    const second = select(windowEvent(desktop.windows[0]));
    assert.equal(desktop.dialogCalls.length, 1);
    resolveDialog({ canceled: false, filePaths: ['C:\\Selected'] });
    assert.deepEqual(await Promise.all([first, second]), ['C:\\Selected', 'C:\\Selected']);
});

test('new windows and navigation outside the application file are denied', async () => {
    const { windows } = await loadDesktop();
    const window = windows[0];
    assert.equal(window.openHandler().action, 'deny');
    for (const eventName of ['will-navigate', 'will-redirect']) {
        let prevented = 0;
        const event = { preventDefault: () => { prevented += 1; } };
        window.webEvents.get(eventName)(event, 'https://example.com');
        window.webEvents.get(eventName)(event, pathToFileURL(path.join(frontendPath, 'preload.js')).href);
        assert.equal(prevented, 2);
        window.webEvents.get(eventName)(event, `${window.webContents.mainFrame.url}#selected`);
        assert.equal(prevented, 2);
    }
});

test('Windows quits on close while macOS can recreate its window', async () => {
    const windowsDesktop = await loadDesktop();
    windowsDesktop.appEvents.get('window-all-closed')();
    assert.equal(windowsDesktop.quitCount(), 1);
    const macDesktop = await loadDesktop({ platform: 'darwin' });
    const window = macDesktop.windows[0];
    window.destroyed = true;
    window.events.get('closed')();
    macDesktop.appEvents.get('window-all-closed')();
    assert.equal(macDesktop.quitCount(), 0);
    macDesktop.appEvents.get('activate')();
    assert.equal(macDesktop.windows.length, 2);
});

test('preload exposes only backend configuration and the fixed folder-selection operation', async () => {
    let exposed;
    const calls = [];
    vm.runInNewContext(preloadSource, {
        require: name => {
            assert.equal(name, 'electron');
            return {
                contextBridge: { exposeInMainWorld: (name, api) => { exposed = { name, api }; } },
                ipcRenderer: { invoke: async (...args) => { calls.push(args); return 'C:\\Selected'; } },
            };
        },
        process: { argv: ['electron', '--storage-analyzer-api-url=http%3A%2F%2Flocalhost%3A5050'] },
    });
    assert.equal(exposed.name, 'storageAnalyzer');
    assert.deepEqual(Object.keys(exposed.api), ['backendUrl', 'selectDirectory']);
    assert.equal(Object.isFrozen(exposed.api), true);
    assert.equal(exposed.api.backendUrl, 'http://localhost:5050');
    assert.equal(await exposed.api.selectDirectory('untrusted-channel'), 'C:\\Selected');
    assert.deepEqual(calls, [['storage-analyzer:select-directory']]);
});
