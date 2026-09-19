const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');

const frontendPath = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(frontendPath, 'main.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(frontendPath, 'preload.js'), 'utf8');

async function loadDesktop({ backendUrl, platform = 'win32', openDialog, argv, launch = {}, systemLocale = 'es-PE', fetchImpl, paths = {}, isPackaged } = {}) {
    const windows = [];
    const sent = [];
    const shown = [];
    const fetches = [];
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
                send: (channel, payload) => sent.push({ channel, payload }),
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
        getSystemLocale: () => systemLocale,
        isPackaged,
        getPath: name => {
            if (!(name in paths)) throw new Error(`Unknown path ${name}`);
            return paths[name];
        },
    };
    const backendCalls = [];
    const outcomes = [...(launch.outcomes ?? ['started'])];
    const waits = [...(launch.waits ?? ['ready'])];
    const backend = {
        startBackend: (url, options) => {
            backendCalls.push({ call: 'start', url, installed: options?.installed });
            backend.onExit = options?.onExit;
            return Promise.resolve(outcomes.length > 1 ? outcomes.shift() : outcomes[0]);
        },
        waitForBackend: url => {
            backendCalls.push({ call: 'wait', url });
            return Promise.resolve(waits.length > 1 ? waits.shift() : waits[0]);
        },
        probeBackend: url => {
            backendCalls.push({ call: 'probe', url });
            return Promise.resolve(launch.probe ?? { state: 'compatible' });
        },
        stopBackend: () => { backendCalls.push({ call: 'stop' }); return true; },
    };
    const electron = {
        app, BrowserWindow,
        shell: { showItemInFolder: item => shown.push(item) },
        ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
        dialog: { showOpenDialog: (window, options) => {
            dialogCalls.push({ window, options });
            return openDialog ? openDialog() : Promise.resolve({ canceled: false, filePaths: ['C:\\Data'] });
        } },
    };
    vm.runInNewContext(mainSource, {
        require: name => name === 'electron' ? electron
            : name === './backend-process' ? backend
            : require(name),
        __dirname: frontendPath,
        process: {
            env: backendUrl === undefined ? {} : { STORAGE_ANALYZER_API_URL: backendUrl },
            platform, argv, resourcesPath: 'C:\\Program Files\\Storage Analyzer\\resources',
        },
        URL, console, AbortSignal,
        fetch: async (url, init) => {
            fetches.push(url);
            if (!fetchImpl) throw new TypeError('fetch failed');
            return fetchImpl(url, init);
        },
    });
    await settle();
    return { windows, handlers, appEvents, dialogCalls, backendCalls, backend, sent, shown, fetches, quitCount: () => quitCount };
}

function settle() {
    return new Promise(resolve => setImmediate(resolve));
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
    assert.equal(window.options.webPreferences.additionalArguments[1], '--storage-analyzer-number-locale=es-PE');
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

function loadPreload(argv) {
    let exposed;
    const calls = [];
    const listeners = new Map();
    vm.runInNewContext(preloadSource, {
        require: name => {
            assert.equal(name, 'electron');
            return {
                contextBridge: { exposeInMainWorld: (name, api) => { exposed = { name, api }; } },
                ipcRenderer: {
                    invoke: async (...args) => { calls.push(args); return 'C:\\Selected'; },
                    on: (channel, listener) => listeners.set(channel, listener),
                    removeListener: (channel, listener) => {
                        if (listeners.get(channel) === listener) listeners.delete(channel);
                    },
                },
            };
        },
        process: { argv },
    });
    return { exposed, calls, listeners };
}

test('preload exposes only backend configuration, service status and fixed operations', async () => {
    const { exposed, calls, listeners } = loadPreload([
        'electron',
        '--storage-analyzer-api-url=http%3A%2F%2Flocalhost%3A5050',
        '--storage-analyzer-number-locale=es-PE',
    ]);
    assert.equal(exposed.name, 'storageAnalyzer');
    assert.deepEqual(Object.keys(exposed.api), [
        'backendUrl', 'numberLocale', 'selectDirectory', 'getBackendStatus', 'retryBackend',
        'showItemInFolder', 'getCommonFolders', 'onBackendStatus',
    ]);
    assert.equal(Object.isFrozen(exposed.api), true);
    assert.equal(exposed.api.backendUrl, 'http://localhost:5050');
    assert.equal(exposed.api.numberLocale, 'es-PE');
    assert.equal(await exposed.api.selectDirectory('untrusted-channel'), 'C:\\Selected');
    await exposed.api.selectDirectory({ title: 'Elige una carpeta', buttonLabel: 'Analizar', extra: 'dropped' });
    await exposed.api.selectDirectory({ title: 'x'.repeat(500) });
    await exposed.api.getBackendStatus('ignored');
    await exposed.api.retryBackend('ignored');
    await exposed.api.showItemInFolder('scan-id', 'C:\\Data\\file.bin', 'ignored');
    await exposed.api.getCommonFolders('ignored');
    // Copy objects made inside the vm context, whose prototypes differ from ours.
    assert.deepEqual(calls.map(args => args.map(value => value && typeof value === 'object' ? { ...value } : value)), [
        ['storage-analyzer:select-directory', undefined],
        ['storage-analyzer:select-directory', { title: 'Elige una carpeta', buttonLabel: 'Analizar' }],
        ['storage-analyzer:select-directory', { title: 'x'.repeat(120), buttonLabel: '' }],
        ['storage-analyzer:get-backend-status'],
        ['storage-analyzer:retry-backend'],
        ['storage-analyzer:show-item', 'scan-id', 'C:\\Data\\file.bin'],
        ['storage-analyzer:common-folders'],
    ]);

    const received = [];
    const unsubscribe = exposed.api.onBackendStatus(status => received.push(status));
    listeners.get('storage-analyzer:backend-status')({ sender: 'must not reach the page' }, { state: 'ready' });
    assert.deepEqual(received, [{ state: 'ready' }]);
    unsubscribe();
    assert.equal(listeners.has('storage-analyzer:backend-status'), false);
    assert.equal(typeof exposed.api.onBackendStatus('not a function'), 'function');
    assert.equal(listeners.size, 0);
});

test('preload drops a malformed number locale', () => {
    for (const locale of ['', 'x', 'es_PE', 'es-PE%3Bdrop', '%3Cscript%3E']) {
        const { exposed } = loadPreload(['electron', `--storage-analyzer-number-locale=${locale}`]);
        assert.equal(exposed.api.numberLocale, undefined, locale);
    }
    assert.equal(loadPreload(['electron']).exposed.api.numberLocale, undefined);
});

function statusOf(desktop) {
    return desktop.handlers.get('storage-analyzer:get-backend-status')(windowEvent(desktop.windows[0]));
}

test('a managed backend moves from starting to ready and tells the window', async () => {
    const desktop = await loadDesktop({ argv: ['electron', '.', '--start-backend'] });
    assert.deepEqual(desktop.backendCalls, [
        { call: 'start', url: 'http://localhost:5000', installed: undefined },
        { call: 'wait', url: 'http://localhost:5000' },
    ]);
    assert.deepEqual({ ...statusOf(desktop) }, { managed: true, state: 'ready' });
    assert.deepEqual(desktop.sent.map(message => message.payload.state), ['ready']);
    assert.ok(desktop.sent.every(message => message.channel === 'storage-analyzer:backend-status'));
});

test('an unmanaged app reports an external backend and never starts one on retry', async () => {
    const desktop = await loadDesktop();
    assert.deepEqual({ ...statusOf(desktop) }, { managed: false, state: 'external' });
    const retry = desktop.handlers.get('storage-analyzer:retry-backend');
    assert.equal((await retry(windowEvent(desktop.windows[0]))).state, 'external');
    assert.deepEqual(desktop.backendCalls, []);
});

test('failed starts keep their reason and only a person can retry them', async () => {
    for (const [launch, reason] of [
        [{ outcomes: ['port-in-use'] }, 'port-in-use'],
        [{ outcomes: ['incompatible'] }, 'incompatible'],
        [{ outcomes: ['unsupported-platform'] }, 'unsupported-platform'],
        [{ waits: ['timeout'] }, 'timeout'],
        [{ waits: ['exited'] }, 'exited'],
    ]) {
        const desktop = await loadDesktop({ argv: ['electron', '.', '--start-backend'], launch });
        assert.deepEqual({ ...statusOf(desktop) }, { managed: true, state: 'failed', reason });
        await settle();
        const starts = desktop.backendCalls.filter(call => call.call === 'start').length;
        assert.equal(starts, 1, `${reason} is not retried automatically`);
    }

    const desktop = await loadDesktop({
        argv: ['electron', '.', '--start-backend'],
        launch: { outcomes: ['port-in-use', 'started'], waits: ['ready'] },
    });
    assert.equal(statusOf(desktop).reason, 'port-in-use');
    const retried = await desktop.handlers.get('storage-analyzer:retry-backend')(windowEvent(desktop.windows[0]));
    assert.deepEqual({ ...retried }, { managed: true, state: 'ready' });
    assert.deepEqual(desktop.sent.map(message => message.payload.state), ['failed', 'starting', 'ready']);
});

test('a managed backend that exits after starting is reported as stopped', async () => {
    const desktop = await loadDesktop({ argv: ['electron', '.', '--start-backend'] });
    assert.equal(statusOf(desktop).state, 'ready');
    desktop.backend.onExit(1);
    assert.deepEqual({ ...statusOf(desktop) }, { managed: true, state: 'failed', reason: 'exited' });
});

test('a retry starts the app’s own backend only once a reused one stops answering', async () => {
    const answering = await loadDesktop({
        argv: ['electron', '.', '--start-backend'],
        launch: { outcomes: ['already-running'] },
    });
    const retryAnswering = answering.handlers.get('storage-analyzer:retry-backend');
    assert.equal((await retryAnswering(windowEvent(answering.windows[0]))).state, 'ready');
    assert.deepEqual(answering.backendCalls.map(call => call.call), ['start', 'probe']);

    const stopped = await loadDesktop({
        argv: ['electron', '.', '--start-backend'],
        launch: { outcomes: ['already-running', 'started'], waits: ['ready'], probe: { state: 'unreachable' } },
    });
    const retryStopped = stopped.handlers.get('storage-analyzer:retry-backend');
    assert.deepEqual({ ...(await retryStopped(windowEvent(stopped.windows[0]))) }, { managed: true, state: 'ready' });
    assert.deepEqual(stopped.backendCalls.map(call => call.call), ['start', 'probe', 'start', 'wait']);

    const occupied = await loadDesktop({
        argv: ['electron', '.', '--start-backend'],
        launch: { outcomes: ['already-running'], probe: { state: 'incompatible', reason: 'other-service' } },
    });
    await occupied.handlers.get('storage-analyzer:retry-backend')(windowEvent(occupied.windows[0]));
    assert.deepEqual(occupied.backendCalls.map(call => call.call), ['start', 'probe'],
        'something else on the port is left to the next status check');
});

test('service status and retries are only available to the application window', async () => {
    const desktop = await loadDesktop({ argv: ['electron', '.', '--start-backend'] });
    const window = desktop.windows[0];
    for (const channel of ['storage-analyzer:get-backend-status', 'storage-analyzer:retry-backend']) {
        await assert.rejects(async () => desktop.handlers.get(channel)({ ...windowEvent(window), sender: {} }),
            /only available to the application window/);
    }
    assert.equal(desktop.backendCalls.filter(call => call.call === 'start').length, 1);
});

test('the backend is only managed when the app was started through npm', async () => {
    const plain = await loadDesktop();
    assert.deepEqual(plain.backendCalls, [], 'without the flag the backend is left alone');
    plain.appEvents.get('will-quit')();
    assert.deepEqual(plain.backendCalls, [{ call: 'stop' }], 'quitting never stops someone else’s backend');

    const managed = await loadDesktop({ argv: ['electron', '.', '--start-backend'] });
    assert.deepEqual(managed.backendCalls.map(call => call.call), ['start', 'wait']);
    assert.equal(managed.backendCalls[0].url, 'http://localhost:5000');
});

test('quitting stops the backend the app started, whichever way the app is closed', async () => {
    const managed = await loadDesktop({ argv: ['electron', '.', '--start-backend'] });
    managed.windows[0].events.get('closed')();
    managed.appEvents.get('window-all-closed')();
    assert.equal(managed.quitCount(), 1, 'closing the last window quits the app');
    managed.appEvents.get('will-quit')();
    assert.deepEqual(managed.backendCalls.at(-1), { call: 'stop' });
});

async function withServer(handler, run) {
    const sockets = new Set();
    const server = http.createServer(handler);
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        return await run(`http://127.0.0.1:${server.address().port}`);
    } finally {
        sockets.forEach(socket => socket.destroy());
        await new Promise(resolve => server.close(resolve));
    }
}

function json(body, status = 200) {
    return (_request, response) => {
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(body));
    };
}

const backendProcess = require('../backend-process');

test('the health probe tells the backend apart from other services on the port', async () => {
    const { probeBackend, APPLICATION, API_VERSION } = backendProcess;
    const cases = [
        [json({ application: APPLICATION, apiVersion: API_VERSION, status: 'UP' }), { state: 'compatible' }],
        [json({ application: APPLICATION, apiVersion: API_VERSION + 1 }), { state: 'incompatible', reason: 'api-version' }],
        [json({ application: 'something-else', apiVersion: API_VERSION }), { state: 'incompatible', reason: 'other-service' }],
        [json({ message: 'Not found' }, 404), { state: 'incompatible', reason: 'other-service' }],
        [(_request, response) => response.end('<html>dev server</html>'), { state: 'incompatible', reason: 'other-service' }],
    ];
    for (const [handler, expected] of cases) {
        let path;
        await withServer((request, response) => { path = request.url; handler(request, response); }, async url => {
            assert.deepEqual(await probeBackend(url), expected);
        });
        assert.equal(path, '/health');
    }
});

test('the health probe separates a closed port from one that never answers', async () => {
    const { probeBackend } = backendProcess;
    const closedUrl = await withServer(json({}), async url => url);
    assert.deepEqual(await probeBackend(closedUrl), { state: 'unreachable' });
    await withServer(() => { /* accepts the request and never answers */ }, async url => {
        assert.deepEqual(await probeBackend(url, { timeoutMs: 100 }), { state: 'unresponsive' });
    });
});

function fakeChild() {
    const child = new EventEmitter();
    child.killed = 0;
    child.kill = () => { child.killed += 1; };
    return child;
}

test('starting the backend never spawns over an occupied port', async () => {
    const { startBackend } = backendProcess;
    const spawned = [];
    const spawnImpl = () => { spawned.push(1); return fakeChild(); };
    for (const [found, outcome] of [
        [{ state: 'compatible' }, 'already-running'],
        [{ state: 'incompatible', reason: 'other-service' }, 'port-in-use'],
        [{ state: 'unresponsive' }, 'port-in-use'],
        [{ state: 'incompatible', reason: 'api-version' }, 'incompatible'],
    ]) {
        assert.equal(await startBackend('http://localhost:5000', { probe: async () => found, spawnImpl }), outcome);
    }
    assert.equal(await startBackend('http://localhost:5000', {
        probe: async () => ({ state: 'unreachable' }), spawnImpl, platform: 'darwin',
    }), 'unsupported-platform');
    assert.equal(spawned.length, 0);
});

test('a started backend reports its exit once and stopping it is silent', async () => {
    const { startBackend, stopBackend, isRunning } = backendProcess;
    const probe = async () => ({ state: 'unreachable' });
    const exits = [];
    const first = fakeChild();
    assert.equal(await startBackend('http://localhost:5000', { probe, spawnImpl: () => first, platform: 'win32', onExit: code => exits.push(code) }), 'started');
    assert.equal(isRunning(), true);
    assert.equal(await startBackend('http://localhost:5000', { probe, spawnImpl: () => assert.fail('no second process') }), 'running');
    first.emit('exit', 1);
    assert.deepEqual(exits, [1]);
    assert.equal(isRunning(), false);

    const second = fakeChild();
    await startBackend('http://localhost:5000', { probe, spawnImpl: () => second, platform: 'win32', onExit: code => exits.push(code) });
    assert.equal(stopBackend(), true);
    assert.equal(second.killed, 1);
    second.emit('exit', null);
    assert.deepEqual(exits, [1], 'a deliberate stop is not reported as a crash');
    assert.equal(stopBackend(), false);
});

test('waiting for the backend is bounded and never restarts it', async () => {
    const { waitForBackend } = backendProcess;
    const run = async (states, { alive = () => true, timeoutMs = 1000 } = {}) => {
        let time = 0;
        const queue = [...states];
        return waitForBackend('http://localhost:5000', {
            timeoutMs, intervalMs: 250,
            probe: async () => queue.length > 1 ? queue.shift() : queue[0],
            isAlive: alive,
            now: () => time,
            sleep: async ms => { time += ms; },
        });
    };
    const unreachable = { state: 'unreachable' };
    assert.equal(await run([unreachable, unreachable, { state: 'compatible' }]), 'ready');
    assert.equal(await run([unreachable]), 'timeout');
    assert.equal(await run([unreachable], { alive: () => false }), 'exited');
    assert.equal(await run([unreachable, { state: 'incompatible', reason: 'other-service' }]), 'port-in-use');
    assert.equal(await run([{ state: 'incompatible', reason: 'api-version' }]), 'incompatible');
});

const scanId = '0f8b5f0e-3c4a-4d8e-9f10-1234567890ab';

function jsonResponse(body, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('showing an item uses the path the backend scanned, and only if it still exists', async () => {
    const existing = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'sa-show-'));
    try {
        const desktop = await loadDesktop({ fetchImpl: async () => jsonResponse({ absolutePath: existing }) });
        const show = desktop.handlers.get('storage-analyzer:show-item');
        const result = await show(windowEvent(desktop.windows[0]), scanId, existing + path.sep + '.' + path.sep);
        assert.deepEqual({ ...result }, { ok: true });
        assert.deepEqual(desktop.shown, [existing], 'the canonical path from the backend is shown');
        const requested = new URL(desktop.fetches[0]);
        assert.equal(requested.pathname, `/scans/${scanId}/entry`);
        assert.equal(requested.searchParams.get('path'), existing + path.sep + '.' + path.sep);
    } finally {
        fs.rmSync(existing, { recursive: true, force: true });
    }
});

test('showing an item explains why it cannot, without opening anything', async () => {
    const missing = path.join(require('node:os').tmpdir(), 'sa-show-missing-' + Date.now());
    const cases = [
        [async () => jsonResponse({ code: 'PATH_NOT_IN_SCAN', message: 'x' }, 404), 'PATH_NOT_IN_SCAN'],
        [async () => jsonResponse({ code: 'SCAN_NOT_FOUND', message: 'x' }, 404), 'SCAN_NOT_FOUND'],
        [async () => jsonResponse({ code: '<bad>' }, 500), 'SERVICE_UNAVAILABLE'],
        [async () => jsonResponse({ unexpected: true }), 'SERVICE_UNAVAILABLE'],
        [undefined, 'SERVICE_UNAVAILABLE'],
        [async () => jsonResponse({ absolutePath: missing }), 'ITEM_MISSING'],
    ];
    for (const [fetchImpl, code] of cases) {
        const desktop = await loadDesktop({ fetchImpl });
        const result = await desktop.handlers.get('storage-analyzer:show-item')(windowEvent(desktop.windows[0]), scanId, missing);
        assert.deepEqual({ ...result }, { ok: false, code });
        assert.deepEqual(desktop.shown, []);
    }
});

test('show-item requests are validated before anything is asked of the backend', async () => {
    const desktop = await loadDesktop({ fetchImpl: async () => assert.fail('no request') });
    const show = desktop.handlers.get('storage-analyzer:show-item');
    const event = windowEvent(desktop.windows[0]);
    for (const [id, item] of [
        ['not-a-scan', 'C:\\Data'], [scanId, ''], [scanId, 7], [42, 'C:\\Data'], [scanId, 'x'.repeat(32768)],
    ]) {
        assert.deepEqual({ ...(await show(event, id, item)) }, { ok: false, code: 'INVALID_REQUEST' });
    }
    await assert.rejects(async () => show({ ...event, sender: {} }, scanId, 'C:\\Data'), /only available to the application window/);
    assert.deepEqual(desktop.fetches, []);
    assert.deepEqual(desktop.shown, []);
});

test('common folders come from the system and only when they exist', async () => {
    const home = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'sa-home-'));
    try {
        const desktop = await loadDesktop({
            paths: { home, desktop: home, documents: path.join(home, 'missing'), downloads: home + path.sep },
        });
        const folders = await desktop.handlers.get('storage-analyzer:common-folders')(windowEvent(desktop.windows[0]));
        assert.deepEqual(Array.from(folders, folder => ({ ...folder })), [
            { id: 'home', path: home },
            { id: 'downloads', path: home + path.sep },
        ]);
        await assert.rejects(async () => desktop.handlers.get('storage-analyzer:common-folders')({ ...windowEvent(desktop.windows[0]), sender: {} }),
            /only available to the application window/);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test('the native folder dialog uses the interface language and falls back to English', async () => {
    const desktop = await loadDesktop();
    const select = desktop.handlers.get('storage-analyzer:select-directory');
    const event = windowEvent(desktop.windows[0]);
    await select(event, { title: 'Elige una carpeta para analizar', buttonLabel: 'Analizar la carpeta' });
    await select(event, { title: '', buttonLabel: 'x'.repeat(121) });
    await select(event, 'not labels');
    assert.deepEqual(desktop.dialogCalls.map(call => [call.options.title, call.options.buttonLabel]), [
        ['Elige una carpeta para analizar', 'Analizar la carpeta'],
        ['Select a folder to analyze', 'Analyze folder'],
        ['Select a folder to analyze', 'Analyze folder'],
    ]);
});

test('the installed app always runs its own backend from the bundled runtime', async () => {
    const installed = await loadDesktop({ isPackaged: true, paths: { userData: 'C:\\Users\\me\\AppData\\Roaming\\Storage Analyzer' } });
    const start = installed.backendCalls.find(call => call.call === 'start');
    assert.ok(start, 'no --start-backend flag is needed once installed');
    assert.deepEqual({ ...start.installed }, {
        java: path.join('C:\\Program Files\\Storage Analyzer\\resources', 'runtime', 'bin', 'java.exe'),
        jar: path.join('C:\\Program Files\\Storage Analyzer\\resources', 'backend', 'sa-backend.jar'),
        logFile: path.join('C:\\Users\\me\\AppData\\Roaming\\Storage Analyzer', 'logs', 'backend.log'),
    });
    const development = await loadDesktop({ argv: ['electron', '.', '--start-backend'] });
    assert.equal(development.backendCalls[0].installed, undefined, 'development keeps the start script');
});

test('the installed backend runs with the bundled Java, watches the app and logs to a bounded file', async () => {
    const { startBackend, stopBackend, MAX_LOG_BYTES } = backendProcess;
    const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'sa-log-'));
    try {
        const logFile = path.join(dir, 'logs', 'backend.log');
        const spawned = [];
        const spawnImpl = (command, args, options) => { spawned.push({ command, args, options }); return fakeChild(); };
        const installed = { java: 'C:\\App\\runtime\\bin\\java.exe', jar: 'C:\\App\\backend\\sa-backend.jar', logFile };
        const probe = async () => ({ state: 'unreachable' });
        assert.equal(await startBackend('http://localhost:5123', { probe, spawnImpl, platform: 'win32', installed }), 'started');
        stopBackend();
        assert.equal(spawned[0].command, installed.java);
        assert.deepEqual(spawned[0].args, [
            '-Dfile.encoding=UTF-8', '-jar', installed.jar,
            '--server.port=5123', `--storage-analyzer.parent-pid=${process.pid}`,
        ]);
        assert.equal(spawned[0].options.windowsHide, true);
        assert.equal(spawned[0].options.stdio[0], 'ignore');
        assert.ok(fs.existsSync(logFile), 'the log exists before the backend writes to it');

        fs.writeFileSync(logFile, Buffer.alloc(MAX_LOG_BYTES + 1));
        await startBackend('http://localhost:5123', { probe, spawnImpl, platform: 'win32', installed });
        stopBackend();
        assert.equal(fs.statSync(logFile).size, 0, 'an oversized log starts over');
        assert.equal(fs.statSync(path.join(dir, 'logs', 'backend.old.log')).size, MAX_LOG_BYTES + 1);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
