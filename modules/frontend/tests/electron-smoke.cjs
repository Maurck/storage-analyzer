// Requires the real backend at http://localhost:5000 and a production build.
// Selectors avoid visible text so the check works in any interface language.
// Native dialog selection is stubbed; Electron's isolated IPC bridge and the
// complete HTTP scan path run unchanged against the real application.
const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const frontend = path.resolve(__dirname, '..');
  const apiUrl = process.env.STORAGE_ANALYZER_API_URL || 'http://localhost:5000';
  const fixture = path.join(frontend, 'src', 'shared', 'ui');
  const files = await fs.readdir(fixture, { withFileTypes: true });
  const expectedFiles = files.filter(file => file.isFile());
  const bytes = (await Promise.all(expectedFiles.map(file => fs.stat(path.join(fixture, file.name))))).reduce((sum, stat) => sum + stat.size, 0);
  const app = await electron.launch({ args: [frontend], env: { ...process.env, STORAGE_ANALYZER_API_URL: apiUrl } });
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.hide()));
    await app.evaluate(({ dialog }, selectedPath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedPath] }); }, fixture);
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await expect(page.locator('#page-title')).toBeVisible();
    const bridge = await page.evaluate(() => ({ keys: Object.keys(window.storageAnalyzer), nodeAvailable: typeof window.require !== 'undefined' }));
    expect(bridge.keys.sort()).toEqual(['backendUrl', 'getBackendStatus', 'getCommonFolders', 'numberLocale', 'onBackendStatus', 'retryBackend', 'selectDirectory', 'showItemInFolder']);
    expect(bridge.nodeAvailable).toBe(false);
    await page.locator('button[aria-keyshortcuts="Control+O"]').click();
    await expect(page.locator('.contents-card table')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.summary-strip')).toContainText(String(expectedFiles.length));
    const table = page.locator('.contents-card table');
    await expect(table.locator('tbody tr')).toHaveCount(expectedFiles.length);
    const scan = await page.evaluate(async (folder) => {
      const response = await fetch(`${window.storageAnalyzer.backendUrl}/scans`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: folder }) });
      return response.json();
    }, fixture);
    const endpoint = `${apiUrl}/scans/${scan.id}`;
    let completed = scan;
    for (let attempt = 0; attempt < 30 && completed.status === 'SCANNING'; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      completed = await (await fetch(endpoint)).json();
    }
    expect(completed.status).toBe('COMPLETE');
    expect(completed.root.sizeBytes).toBe(bytes);
    expect(completed.root.fileCount).toBe(expectedFiles.length);
    expect(errors).toEqual([]);
    await fs.mkdir(path.join(frontend, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(frontend, 'test-results', 'electron-live.png'), fullPage: true });
    console.log(`Electron integration passed: ${expectedFiles.length} real files, ${bytes} bytes, isolated preload, production chunks, zero renderer errors.`);
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
