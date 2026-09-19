const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// Exercise the shipped TypeScript target, including native Error subclassing.
// The hook is confined to this test process and does not emit build artifacts.
const frontendPath = path.resolve(__dirname, '..');
const config = ts.readConfigFile(path.join(frontendPath, 'tsconfig.json'), ts.sys.readFile);
assert.equal(config.error, undefined);
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, frontendPath);
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { ...options, module: ts.ModuleKind.CommonJS },
  });
  module._compile(outputText, filename);
};

const { createFormatters, resolveNumberLocale, percentOf, UNAVAILABLE } = require('../src/shared/lib/format.ts');
const { AppError, request, errorMessage } = require('../src/shared/lib/http.ts');
const {
  validateDirectory, validateScan, validateHealth, startScan, getScan, cancelScan, getDirectory, getHealth,
  validateLargest, validateSkipped, validateCapacity, getLargest, getSkipped, getCapacity,
  validateAncestry, getAncestors, validateSearch, searchFiles,
} = require('../src/features/storage-analysis/api/directory.api.ts');
const recentFolders = require('../src/shared/lib/recentFolders.ts');
// Pinned: the default formatters follow this machine's regional settings.
const { formatBytes, formatNumber } = createFormatters('en-US');

function directory(overrides = {}) {
  return {
    name: 'Documents', absolutePath: 'C:\\Documents', type: 'FOLDER',
    subdirectories: [], sizeBytes: 0, fileCount: 0, directoryCount: 0,
    hasChildren: false, childrenLoaded: true, partial: false, error: null,
    ...overrides,
  };
}

function scan(overrides = {}) {
  return {
    id: 'scan-1', path: 'C:\\Documents', status: 'SCANNING',
    processedFiles: 0, processedDirectories: 0, processedBytes: 0, skippedCount: 0,
    elapsedMillis: 0, error: null, root: null, ...overrides,
  };
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function assertAppError(error, message, status = 0, code) {
  assert.ok(error instanceof AppError, 'error retains the AppError prototype');
  assert.equal(error.name, 'AppError');
  assert.match(error.message, message);
  assert.equal(error.status, status);
  if (code !== undefined) assert.equal(error.code, code);
  return true;
}

// Every expected size below is the literal output of Windows'
// StrFormatByteSize for the same byte count, so the application and the file
// manager never disagree about a folder.
test('size formatting matches Windows Explorer at unit, digit and truncation boundaries', () => {
  for (const [input, output] of [
    [0, '0 B'], [1, '1 B'], [1023, '1,023 B'],
    [1024, '1.00 KB'],
    [1536, '1.50 KB'],
    [1024 ** 2, '1.00 MB'],
    [1024 ** 3, '1.00 GB'],
    [1024 ** 4, '1.00 TB'],
    [1024 ** 5, '1.00 PB'],
    [1.25 * 1024 ** 3, '1.25 GB'],
    // A unit is left behind at 1000 of it, not at 1024.
    [1023999, '999 KB'],
    [1024000, '0.97 MB'],
    // Dropped digits are truncated, never rounded up.
    [1048575, '0.99 MB'],
    [1073741823, '0.99 GB'],
    // Whole units are counted one step below the displayed one: 1,471,152,128 B
    // is the first to reach 1403 MB, and 33,316,061,315,072 B the first to
    // reach 31,028 GB. Dividing the byte count directly moves both a digit up.
    [1471152127, '1.36 GB'],
    [1471152128, '1.37 GB'],
    [33316061315071, '30.2 TB'],
    [33316061315072, '30.3 TB'],
    // Three significant digits: two decimals, then one, then none.
    [1480582601, '1.37 GB'],
    [11115519, '10.5 MB'],
    [11115520, '10.6 MB'],
    [110677197, '105 MB'],
    [-1, UNAVAILABLE], [NaN, UNAVAILABLE], [Infinity, UNAVAILABLE],
  ]) assert.equal(formatBytes(input), output, `formatBytes(${input})`);
  assert.equal(formatNumber(1234567), '1,234,567');
});

test('numbers follow the regional format, including grouping of four-digit values', () => {
  const es = createFormatters('es-ES');
  assert.equal(es.formatBytes(1023), '1.023 B');
  assert.equal(es.formatBytes(1536), '1,50 KB');
  assert.equal(es.formatBytes(110677197), '105 MB');
  assert.equal(es.formatNumber(1234567), '1.234.567');
  assert.equal(es.formatNumber(1234), '1.234');
  assert.equal(createFormatters('en-US').formatPercent(75), '75.0%');
  assert.match(es.formatPercent(75), /^75,0\s%$/);
  assert.equal(es.formatPercent(NaN), UNAVAILABLE);
  assert.equal(formatNumber(NaN), UNAVAILABLE);
});

test('durations use a clock format that does not depend on the interface language', () => {
  const { formatDuration } = createFormatters('en-US');
  for (const [input, output] of [
    [0, '0:00'], [999, '0:00'], [7000, '0:07'], [65000, '1:05'],
    [754000, '12:34'], [3723000, '1:02:03'], [-1, UNAVAILABLE], [NaN, UNAVAILABLE],
  ]) assert.equal(formatDuration(input), output, 'formatDuration(' + input + ')');
});

test('analysis dates follow the regional format and reject invalid instants', () => {
  const { formatDateTime } = createFormatters('en-US');
  const iso = '2026-03-04T05:06:07Z';
  const expected = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(Date.parse(iso));
  assert.equal(formatDateTime(iso), expected);
  assert.match(formatDateTime(iso), /Mar 4, 2026|Mar 3, 2026|Mar 5, 2026/);
  assert.equal(formatDateTime('yesterday'), UNAVAILABLE);
});

test('the number locale comes from the system, then the browser, then English', () => {
  assert.equal(resolveNumberLocale(['es-PE', 'en-GB']), 'es-PE');
  assert.equal(resolveNumberLocale([undefined, 'en-GB']), 'en-GB');
  assert.equal(resolveNumberLocale(['', 'not a locale!', 42]), 'en-US');
  assert.equal(resolveNumberLocale([]), 'en-US');
});

test('percentages never exceed the valid range or divide by zero', () => {
  assert.equal(percentOf(25, 100), 25);
  assert.equal(percentOf(150, 100), 100);
  assert.equal(percentOf(-10, 100), 0);
  assert.equal(percentOf(10, 0), 0);
  assert.equal(percentOf(0, 0), 0);
  assert.equal(percentOf(10, -5), 0);
});

test('HTTP requests preserve JSON, request headers, and an internal abort signal', async t => {
  const body = scan();
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => response(body));
  assert.deepEqual(await request('http://localhost:5000', '/scans', {
    method: 'POST', body: '{"path":"C:\\\\Documents"}', headers: { 'X-Request-ID': 'test' },
  }), body);
  const [url, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, 'http://localhost:5000/scans');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.get('Accept'), 'application/json');
  assert.equal(init.headers.get('Content-Type'), 'application/json');
  assert.equal(init.headers.get('X-Request-ID'), 'test');
  assert.ok(init.signal instanceof AbortSignal);
  assert.equal(init.signal.aborted, false);
});

test('HTTP callers can supply Headers instances or tuples without losing their values', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => response({}));
  await request('http://localhost:5000', '/scans', {
    body: '{}', headers: new Headers({ Accept: 'application/problem+json', 'Content-Type': 'application/custom+json' }),
  });
  await request('http://localhost:5000', '/scans', { headers: [['X-Request-ID', 'tuple-value']] });
  const first = fetchMock.mock.calls[0].arguments[1].headers;
  assert.equal(first.get('Accept'), 'application/problem+json');
  assert.equal(first.get('Content-Type'), 'application/custom+json');
  assert.equal(fetchMock.mock.calls[1].arguments[1].headers.get('X-Request-ID'), 'tuple-value');
});

test('HTTP non-success responses retain the server message and status', async t => {
  t.mock.method(globalThis, 'fetch', async () => response({ message: 'This folder is not readable.' }, 403));
  await assert.rejects(request('http://localhost:5000', '/scans'),
    error => assertAppError(error, /This folder is not readable\./, 403));
});

test('HTTP errors keep the backend code so the interface can translate them', async t => {
  t.mock.method(globalThis, 'fetch', async () => response({ code: 'FOLDER_NOT_FOUND', message: 'The selected folder does not exist.' }, 400));
  await assert.rejects(request('http://localhost:5000', '/scans'), error => {
    assertAppError(error, /does not exist/, 400);
    assert.equal(error.apiCode, 'FOLDER_NOT_FOUND');
    assert.equal(error.code, undefined);
    return true;
  });
});

test('HTTP error codes are kept without a message and ignored when malformed', async t => {
  const bodies = [
    [{ code: 'SCAN_NOT_FOUND' }, 'SCAN_NOT_FOUND', undefined],
    [{ code: 'lowercase', message: 'x' }, undefined, undefined],
    [{ code: '<script>' }, undefined, 'request-failed'],
    [{ code: 42 }, undefined, 'request-failed'],
  ];
  for (const [body, apiCode, code] of bodies) {
    t.mock.method(globalThis, 'fetch', async () => response(body, 404));
    await assert.rejects(request('http://localhost:5000', '/scans'), error => {
      assert.equal(error.apiCode, apiCode, JSON.stringify(body));
      assert.equal(error.code, code, JSON.stringify(body));
      return true;
    });
    t.mock.restoreAll();
  }
});

test('HTTP failures without a safe message use the actionable fallback', async t => {
  t.mock.method(globalThis, 'fetch', async () => response({ message: { internal: 'detail' } }, 500));
  await assert.rejects(request('http://localhost:5000', '/scans'),
    error => assertAppError(error, /request could not be completed.*try again/i, 500));
});

test('network failure provides a recovery message without leaking raw errors', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch internal details'); });
  await assert.rejects(request('http://localhost:5000', '/scans'),
    error => assertAppError(error, /Could not connect.*ready/i, 0, 'offline'));
});

test('unreadable JSON preserves its HTTP status and can be retried', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Invalid JSON'); } }));
  await assert.rejects(request('http://localhost:5000', '/scans'),
    error => assertAppError(error, /unreadable response.*try again/i, 200));
});

test('successful requests remove external abort listeners and clear their timeout', async t => {
  const caller = new AbortController();
  const add = t.mock.method(caller.signal, 'addEventListener');
  const remove = t.mock.method(caller.signal, 'removeEventListener');
  const clear = t.mock.method(globalThis, 'clearTimeout');
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => response({ result: 'ok' }));
  await request('http://localhost:5000', '/scans', { signal: caller.signal });
  assert.equal(add.mock.calls.length, 1);
  assert.equal(remove.mock.calls.length, 1);
  assert.equal(remove.mock.calls[0].arguments[0], 'abort');
  assert.equal(remove.mock.calls[0].arguments[1], add.mock.calls[0].arguments[1]);
  assert.equal(clear.mock.calls.length, 1);
  const internalSignal = fetchMock.mock.calls[0].arguments[1].signal;
  caller.abort();
  assert.equal(internalSignal.aborted, false, 'the completed request is detached from later caller aborts');
});

test('caller cancellation aborts fetch and removes listeners even when the request fails', async t => {
  const caller = new AbortController();
  const add = t.mock.method(caller.signal, 'addEventListener');
  const remove = t.mock.method(caller.signal, 'removeEventListener');
  const clear = t.mock.method(globalThis, 'clearTimeout');
  let internalSignal;
  t.mock.method(globalThis, 'fetch', (_url, init) => {
    internalSignal = init.signal;
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    });
  });
  const pending = request('http://localhost:5000', '/scans', { signal: caller.signal });
  const rejection = assert.rejects(pending, error => {
    assert.equal(error.name, 'AbortError');
    assert.match(error.message, /cancelled/i);
    assert.equal(error instanceof AppError, false, 'cancellation must not become a retryable service error');
    return true;
  });
  caller.abort();
  await rejection;
  assert.equal(internalSignal.aborted, true);
  assert.equal(remove.mock.calls.length, 1);
  assert.equal(remove.mock.calls[0].arguments[1], add.mock.calls[0].arguments[1]);
  assert.equal(clear.mock.calls.length, 1);
});

test('a signal aborted before the request reaches fetch remains aborted', async t => {
  const caller = new AbortController();
  caller.abort();
  const remove = t.mock.method(caller.signal, 'removeEventListener');
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal(init.signal.aborted, true);
    throw new DOMException('Cancelled', 'AbortError');
  });
  await assert.rejects(request('http://localhost:5000', '/scans', { signal: caller.signal }), { name: 'AbortError' });
  assert.equal(remove.mock.calls.length, 1);
});

test('cancellation while reading JSON remains cancellation instead of a malformed-response error', async t => {
  const caller = new AbortController();
  let startBody;
  const bodyStarted = new Promise(resolve => { startBody = resolve; });
  t.mock.method(globalThis, 'fetch', async (_url, init) => ({
    ok: true, status: 200,
    json: () => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Cancelled body', 'AbortError')), { once: true });
      startBody();
    }),
  }));
  const pending = request('http://localhost:5000', '/scans', { signal: caller.signal });
  const rejection = assert.rejects(pending, { name: 'AbortError' });
  await bodyStarted;
  caller.abort();
  await rejection;
});

test('the request timeout aborts fetch and gives a retryable timeout message', async t => {
  let timeoutCallback;
  const timer = { testTimer: true };
  t.mock.method(globalThis, 'setTimeout', (callback, duration) => {
    assert.equal(duration, 20000);
    timeoutCallback = callback;
    return timer;
  });
  const clear = t.mock.method(globalThis, 'clearTimeout', () => {});
  t.mock.method(globalThis, 'fetch', (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')), { once: true });
  }));
  const pending = request('http://localhost:5000', '/scans');
  const rejection = assert.rejects(pending, error => assertAppError(error, /took too long.*retry/i));
  timeoutCallback();
  await rejection;
  assert.equal(clear.mock.calls.length, 1);
  assert.equal(clear.mock.calls[0].arguments[0], timer);
});

test('a timeout while reading JSON is reported as a timeout', async t => {
  let timeoutCallback;
  let startBody;
  const bodyStarted = new Promise(resolve => { startBody = resolve; });
  t.mock.method(globalThis, 'setTimeout', callback => { timeoutCallback = callback; return {}; });
  t.mock.method(globalThis, 'clearTimeout', () => {});
  t.mock.method(globalThis, 'fetch', async (_url, init) => ({
    ok: true, status: 200,
    json: () => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted body', 'AbortError')), { once: true });
      startBody();
    }),
  }));
  const pending = request('http://localhost:5000', '/scans');
  const rejection = assert.rejects(pending, error => assertAppError(error, /took too long.*retry/i));
  await bodyStarted;
  timeoutCallback();
  await rejection;
});

test('errorMessage exposes known Error messages and has a fallback for unknown values', () => {
  assert.equal(errorMessage(new Error('Retry this action.')), 'Retry this action.');
  assert.equal(errorMessage(new AppError('Folder unavailable', 404)), 'Folder unavailable');
  assert.match(errorMessage(null), /Something went wrong.*try again/i);
  assert.match(errorMessage({ message: 'Not an Error' }), /Something went wrong/i);
});

test('a request can use a shorter timeout than the default', async t => {
  const durations = [];
  t.mock.method(globalThis, 'setTimeout', (_callback, duration) => { durations.push(duration); return {}; });
  t.mock.method(globalThis, 'clearTimeout', () => {});
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal('timeoutMs' in init, false, 'the option is not passed to fetch');
    return response({});
  });
  await request('http://localhost:5000', '/health', { timeoutMs: 3000 });
  assert.deepEqual(durations, [3000]);
});

test('valid directory trees retain partial results and unloaded child metadata', () => {
  const node = directory({
    sizeBytes: 2048, fileCount: 1, directoryCount: 1, hasChildren: true, partial: true,
    subdirectories: [directory({ name: 'Nested', absolutePath: 'C:\\Documents\\Nested', hasChildren: true, childrenLoaded: false, sizeBytes: 2048, fileCount: 1 })],
  });
  assert.equal(validateDirectory(node), node);
  assert.equal(validateDirectory(directory({ type: 'ERROR', partial: true, error: 'Permission denied' })).type, 'ERROR');
  assert.equal(validateDirectory(directory({ type: 'ERROR', partial: true, errorCode: 'PATH_UNREADABLE' })).errorCode, 'PATH_UNREADABLE');
});

test('malformed directories and malformed descendants are rejected before rendering', () => {
  for (const node of [
    null, undefined, {}, [],
    directory({ name: null }), directory({ absolutePath: 5 }), directory({ type: 'LINK' }),
    directory({ subdirectories: null }), directory({ sizeBytes: -1 }), directory({ sizeBytes: Infinity }),
    directory({ fileCount: '2' }), directory({ directoryCount: NaN }), directory({ hasChildren: 'true' }),
    directory({ fileCount: 1.5 }), directory({ sizeBytes: Number.MAX_SAFE_INTEGER + 1 }),
    directory({ childrenLoaded: undefined }), directory({ partial: null }),
    directory({ absolutePath: '' }), directory({ error: { message: 'Cannot render this object' } }),
    directory({ subdirectories: [directory({ absolutePath: null })] }),
    directory({ subdirectories: [null] }),
    directory({ errorCode: 'path-unreadable' }), directory({ errorCode: 3 }),
  ]) {
    assert.throws(() => validateDirectory(node), error => assertAppError(error, /analysis data is incomplete/i, 0, 'invalid-data'));
  }
});

test('duplicate directory identities are rejected to prevent recursive rendering cycles', () => {
  const duplicateChild = directory({ name: 'Duplicate of parent' });
  assert.throws(() => validateDirectory(directory({ hasChildren: true, subdirectories: [duplicateChild] })),
    error => assertAppError(error, /analysis data is incomplete/i));
  const child = directory({ name: 'child', absolutePath: 'C:\\Documents\\child' });
  assert.throws(() => validateDirectory(directory({ hasChildren: true, subdirectories: [child, { ...child }] })),
    error => assertAppError(error, /analysis data is incomplete/i));
});

test('scan validation accepts the supported lifecycle and requires a root when complete', () => {
  for (const status of ['SCANNING', 'CANCELLED', 'ERROR']) {
    const value = scan({ status });
    assert.equal(validateScan(value), value);
  }
  const completed = scan({ status: 'COMPLETE', root: directory() });
  assert.equal(validateScan(completed), completed);
  assert.throws(() => validateScan(scan({ status: 'COMPLETE' })),
    error => assertAppError(error, /completed analysis did not include a folder/i, 0, 'incomplete-scan'));
  const detailed = scan({
    millisSinceActivity: 12000, currentPath: 'C:\\Documents\\Slow', elapsedMillis: 65000,
    volume: { totalBytes: 500, usableBytes: 200 },
  });
  assert.equal(validateScan(detailed), detailed);
  const dated = scan({ status: 'COMPLETE', root: directory(), startedAt: '2026-03-04T05:06:07.123Z', finishedAt: '2026-03-04T05:07:00.330417700Z' });
  assert.equal(validateScan(dated), dated);
  const running = scan({ startedAt: '2026-03-04T05:06:07Z', finishedAt: null });
  assert.equal(validateScan(running), running);
  const failed = scan({ status: 'ERROR', errorCode: 'ENTRY_LIMIT', errorParams: { limit: 250000 }, volume: null });
  assert.equal(validateScan(failed), failed);
});

test('malformed scan progress and nested roots are rejected', () => {
  for (const value of [
    null, undefined, {}, [], scan({ id: 3 }), scan({ path: null }), scan({ status: 'DONE' }),
    scan({ processedFiles: -1 }), scan({ processedDirectories: '1' }),
    scan({ processedBytes: Infinity }), scan({ skippedCount: NaN }),
    scan({ processedFiles: 1.5 }), scan({ id: '' }), scan({ path: '' }),
    scan({ error: { message: 'Invalid message' } }),
    scan({ elapsedMillis: undefined }), scan({ elapsedMillis: -1 }),
    scan({ millisSinceActivity: 1.5 }), scan({ currentPath: 7 }),
    scan({ errorCode: 'entry limit' }), scan({ errorParams: { limit: -1 } }),
    scan({ errorParams: { 'bad key': 1 } }), scan({ errorParams: [1] }),
    scan({ volume: { totalBytes: 100, usableBytes: 200 } }), scan({ volume: { totalBytes: 100 } }),
    scan({ volume: 'C:' }),
    scan({ startedAt: 1700000000 }), scan({ startedAt: 'yesterday' }), scan({ finishedAt: '2026-13-45T99:00:00Z' }),
  ]) {
    assert.throws(() => validateScan(value), error => assertAppError(error, /invalid scan/i, 0, 'invalid-scan'));
  }
  assert.throws(() => validateScan(scan({ root: directory({ sizeBytes: -1 }) })),
    error => assertAppError(error, /analysis data is incomplete/i));
  for (const root of [false, 0, '', 'folder', []]) {
    assert.throws(() => validateScan(scan({ root })),
      error => assertAppError(error, /analysis data is incomplete/i));
  }
});

test('API requests encode identifiers and folder paths and honor the preload service URL', async t => {
  const oldWindow = globalThis.window;
  globalThis.window = { storageAnalyzer: { backendUrl: 'http://127.0.0.1:5050' } };
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    return response(url.includes('/directory?') ? directory() : scan());
  });
  const folder = 'C:\\Research & Design\\#Drafts';
  await startScan(folder);
  await getScan('scan/id?one');
  await cancelScan('scan/id?one');
  await getDirectory('scan/id?one', folder);
  assert.equal(calls[0].url, 'http://127.0.0.1:5050/scans');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { path: folder });
  assert.equal(calls[1].url, 'http://127.0.0.1:5050/scans/scan%2Fid%3Fone');
  assert.equal(calls[2].init.method, 'DELETE');
  assert.equal(calls[3].url, `http://127.0.0.1:5050/scans/scan%2Fid%3Fone/directory?path=${encodeURIComponent(folder)}`);
});

test('API entry points validate responses rather than accepting successful malformed JSON', async t => {
  const oldWindow = globalThis.window;
  globalThis.window = {};
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; });
  t.mock.method(globalThis, 'fetch', async () => response({ id: 'missing-progress' }));
  await assert.rejects(getScan('scan-1'), error => assertAppError(error, /invalid scan/i));
  await assert.rejects(getDirectory('scan-1', 'C:\\Documents'), error => assertAppError(error, /analysis data is incomplete/i));
});

test('health documents are validated before the app trusts them', async t => {
  const health = { application: 'storage-analyzer', apiVersion: 1, status: 'UP' };
  assert.equal(validateHealth(health), health);
  for (const value of [null, [], 'UP', { application: 'storage-analyzer' }, { apiVersion: 1 }]) {
    assert.throws(() => validateHealth(value), error => assertAppError(error, /Another service/i, 0, 'service-unavailable'));
  }
  const oldWindow = globalThis.window;
  globalThis.window = { storageAnalyzer: { backendUrl: 'http://127.0.0.1:5050' } };
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; });
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => response(health));
  assert.deepEqual(await getHealth(), health);
  assert.equal(fetchMock.mock.calls[0].arguments[0], 'http://127.0.0.1:5050/health');
});

function largest(overrides = {}) {
  return {
    scanId: 'scan-1', root: 'C:\\Data', partial: false, limit: 100, minSizeBytes: 0, matchingFiles: 1,
    files: [{ name: 'a.bin', absolutePath: 'C:\\Data\\a.bin', relativePath: 'a.bin', sizeBytes: 5 }],
    ...overrides,
  };
}

test('rankings are validated before they are shown', () => {
  const valid = largest();
  assert.equal(validateLargest(valid), valid);
  assert.equal(validateLargest(largest({ files: [], matchingFiles: 0 })).files.length, 0);
  const file = valid.files[0];
  for (const value of [
    null, [], largest({ partial: 'no' }), largest({ limit: -1 }), largest({ files: null }),
    largest({ limit: 0 }), // more files than the limit
    largest({ minSizeBytes: 6 }), // a file under the requested minimum
    largest({ files: [file, { ...file }] }), // duplicate identity
    largest({ files: [{ ...file, sizeBytes: 1.5 }] }), largest({ files: [{ ...file, absolutePath: '' }] }),
    largest({ files: [{ ...file, relativePath: 3 }] }),
  ]) {
    assert.throws(() => validateLargest(value), error => assertAppError(error, /analysis data is incomplete/i, 0, 'invalid-data'));
  }
});

function ancestry() {
  const file = directory({ name: 'a.bin', absolutePath: 'C:\\Data\\x\\a.bin', type: 'FILE', sizeBytes: 5, fileCount: 1 });
  const preview = directory({ name: 'x', absolutePath: 'C:\\Data\\x', hasChildren: true, childrenLoaded: false });
  return {
    scanId: 'scan-1',
    entry: file,
    ancestors: [
      directory({ name: 'Data', absolutePath: 'C:\\Data', hasChildren: true, subdirectories: [preview] }),
      directory({ name: 'x', absolutePath: 'C:\\Data\\x', hasChildren: true, subdirectories: [{ ...file }] }),
    ],
  };
}

test('the way to an entry is validated as an unbroken chain of loaded folders', async t => {
  const valid = ancestry();
  assert.equal(validateAncestry(valid), valid);
  assert.equal(validateAncestry({ ...valid, entry: valid.ancestors[0], ancestors: [] }).ancestors.length, 0);
  const [root, parent] = valid.ancestors;
  for (const value of [
    null, { ...valid, scanId: 1 }, { ...valid, ancestors: null }, { ...valid, entry: null },
    { ...valid, ancestors: [root, root] }, // a folder that does not list the next link
    { ...valid, ancestors: [root] }, // stops before the entry's parent
    { ...valid, ancestors: [{ ...root, childrenLoaded: false }, parent] },
    { ...valid, ancestors: [root, { ...parent, type: 'FILE' }] },
  ]) {
    assert.throws(() => validateAncestry(value), error => assertAppError(error, /analysis data is incomplete/i, 0, 'invalid-data'));
  }

  const oldWindow = globalThis.window;
  globalThis.window = { storageAnalyzer: { backendUrl: 'http://127.0.0.1:5050' } };
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; });
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => response(ancestry()));
  await getAncestors('scan/1', 'C:\\Data\\x\\a b.bin');
  assert.equal(fetchMock.mock.calls[0].arguments[0],
    'http://127.0.0.1:5050/scans/scan%2F1/ancestors?path=C%3A%5CData%5Cx%5Ca%20b.bin');
});

function search(overrides = {}) {
  return {
    scanId: 'scan-1', root: 'C:\\Data', scope: 'C:\\Data\\Photos', partial: false, query: 'sun',
    minSizeBytes: 0, offset: 50, limit: 50, matchingFiles: 120,
    files: [
      { name: 'sun.jpg', absolutePath: 'C:\\Data\\Photos\\sun.jpg', relativePath: 'Photos\\sun.jpg', sizeBytes: 9 },
      { name: 'sunset.jpg', absolutePath: 'C:\\Data\\Photos\\sunset.jpg', relativePath: 'Photos\\sunset.jpg', sizeBytes: 4 },
    ],
    ...overrides,
  };
}

test('search pages are validated as an ordered page of a larger count', () => {
  const valid = search();
  assert.equal(validateSearch(valid), valid);
  assert.equal(validateSearch(search({ files: [], matchingFiles: 50 })).files.length, 0);
  const [first, second] = valid.files;
  for (const value of [
    null, search({ scope: '' }), search({ query: 3 }), search({ offset: -1 }), search({ partial: 'no' }),
    search({ limit: 1 }), // more files than the limit
    search({ matchingFiles: 51 }), // a page that claims more files than the count
    search({ files: [second, first] }), // out of order, so pages could repeat or skip
    search({ minSizeBytes: 5 }), // a file under the requested minimum
    search({ files: [first, { ...first }] }), // duplicate identity
  ]) {
    assert.throws(() => validateSearch(value), error => assertAppError(error, /analysis data is incomplete/i, 0, 'invalid-data'));
  }
});

test('a search request encodes its query, scope and page', async t => {
  const oldWindow = globalThis.window;
  globalThis.window = { storageAnalyzer: { backendUrl: 'http://127.0.0.1:5050' } };
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; });
  const urls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    urls.push(url);
    return response(search({ offset: 0, files: [], matchingFiles: 0, query: 'a b&c' }));
  });
  await searchFiles('scan/1', { query: 'a b&c', scope: 'C:\\Data\\Photos', minSizeBytes: 104857600, offset: 100, limit: 50 });
  await searchFiles('scan-2');
  assert.deepEqual(urls, [
    'http://127.0.0.1:5050/scans/scan%2F1/files?query=a+b%26c&minSizeBytes=104857600&offset=100&limit=50&scope=C%3A%5CData%5CPhotos',
    'http://127.0.0.1:5050/scans/scan-2/files?query=&minSizeBytes=0&offset=0&limit=50',
  ]);
});

test('skipped-item pages and capacity are validated', () => {
  const page = {
    scanId: 'scan-1', total: 3, recorded: 2, offset: 0,
    items: [{ name: 'deep', absolutePath: 'C:\\Data\\deep', relativePath: 'deep', type: 'ERROR', code: 'DEPTH_LIMIT' }],
  };
  assert.equal(validateSkipped(page), page);
  for (const value of [
    { ...page, recorded: 4 }, { ...page, total: -1 }, { ...page, items: [{ ...page.items[0], code: 'depth' }] },
    { ...page, items: [{ ...page.items[0], type: 'LINK' }] }, { ...page, items: null },
  ]) {
    assert.throws(() => validateSkipped(value), error => assertAppError(error, /analysis data is incomplete/i));
  }
  const capacity = { maxHeapBytes: 4, snapshotBudgetBytes: 2, maxEntries: 100000, referencePathLength: 120 };
  assert.equal(validateCapacity(capacity), capacity);
  assert.throws(() => validateCapacity({ ...capacity, maxEntries: '100000' }), error => assertAppError(error, /incomplete/i));
});

test('ranking, skipped and capacity requests encode their parameters', async t => {
  const oldWindow = globalThis.window;
  globalThis.window = { storageAnalyzer: { backendUrl: 'http://127.0.0.1:5050' } };
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; });
  const urls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    urls.push(url);
    return response(url.includes('/largest') ? largest({ limit: 10, minSizeBytes: 0 })
      : url.includes('/skipped') ? { scanId: 'x', total: 0, recorded: 0, offset: 5, items: [] }
      : { maxHeapBytes: 1, snapshotBudgetBytes: 1, maxEntries: 1, referencePathLength: 120 });
  });
  await getLargest('scan/1', { limit: 10, minSizeBytes: 104857600 });
  await getSkipped('scan/1', 5, 100);
  await getCapacity();
  assert.deepEqual(urls, [
    'http://127.0.0.1:5050/scans/scan%2F1/largest?limit=10&minSizeBytes=104857600',
    'http://127.0.0.1:5050/scans/scan%2F1/skipped?offset=5&limit=100',
    'http://127.0.0.1:5050/capacity',
  ]);
});

test('recent folders keep five, most recent first, and survive blocked storage', t => {
  const oldWindow = globalThis.window;
  const store = new Map();
  globalThis.window = { localStorage: {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  } };
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; });
  const { readRecentFolders, rememberFolder, forgetFolder, clearRecentFolders, folderName } = recentFolders;
  let folders = readRecentFolders();
  assert.deepEqual(folders, []);
  for (const folder of ['A', 'B', 'C', 'D', 'E', 'F']) folders = rememberFolder(folders, folder);
  assert.deepEqual(folders, ['F', 'E', 'D', 'C', 'B']);
  folders = rememberFolder(folders, 'C');
  assert.deepEqual(readRecentFolders(), ['C', 'F', 'E', 'D', 'B']);
  assert.deepEqual(forgetFolder(folders, 'F'), ['C', 'E', 'D', 'B']);
  assert.deepEqual(clearRecentFolders(), []);
  assert.deepEqual(readRecentFolders(), []);

  store.set('storage-analyzer:recent-folders', '{"not":"a list"}');
  assert.deepEqual(readRecentFolders(), []);
  store.set('storage-analyzer:recent-folders', JSON.stringify(['ok', 3, '', 'x'.repeat(40000)]));
  assert.deepEqual(readRecentFolders(), ['ok']);
  globalThis.window = { localStorage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } };
  assert.deepEqual(readRecentFolders(), []);
  assert.deepEqual(rememberFolder([], 'G'), ['G'], 'a list that cannot be stored still works');

  assert.equal(folderName('C:\\Users\\me\\Downloads'), 'Downloads');
  assert.equal(folderName('C:\\Users\\me\\Downloads\\'), 'Downloads');
  assert.equal(folderName('/home/me/Videos'), 'Videos');
  assert.equal(folderName('C:\\'), 'C:\\');
});

test('saving recent folders is a preference that is on by default and does not clear the list', t => {
  const oldWindow = globalThis.window;
  const store = new Map();
  globalThis.window = { localStorage: {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  } };
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; });
  const { readRememberRecent, writeRememberRecent, rememberFolder, readRecentFolders } = recentFolders;
  assert.equal(readRememberRecent(), true);
  rememberFolder([], 'A');
  writeRememberRecent(false);
  assert.equal(readRememberRecent(), false);
  assert.deepEqual(readRecentFolders(), ['A'], 'turning it off is not the same as clearing');
  writeRememberRecent(true);
  assert.equal(readRememberRecent(), true);
  globalThis.window = { localStorage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } };
  assert.equal(readRememberRecent(), true);
  assert.doesNotThrow(() => writeRememberRecent(false));
});
