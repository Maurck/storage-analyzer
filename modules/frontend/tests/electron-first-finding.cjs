// H2 walkthrough against the real backend and Electron, on a generated
// fixture only: choose a folder, find a deep file in the ranking without
// opening the tree, show it in Explorer, then see a moved file explained.
// Requires the backend at http://localhost:5000 and a production build.
// Selectors avoid visible text so the check works in any interface language.
const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const frontend = path.resolve(__dirname, '..');
  const apiUrl = process.env.STORAGE_ANALYZER_API_URL || 'http://localhost:5000';
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-first-finding-'));
  const deep = path.join(fixture, 'a', 'b', 'c', 'd', 'e', 'f');
  await fs.mkdir(deep, { recursive: true });
  const target = path.join(deep, 'target.bin');
  await fs.writeFile(target, Buffer.alloc(3 * 1024 * 1024));
  for (const side of ['left', 'right']) {
    await fs.mkdir(path.join(fixture, side));
    await fs.writeFile(path.join(fixture, side, 'copy.bin'), Buffer.alloc(1024 * 1024));
  }
  await fs.writeFile(path.join(fixture, 'small.txt'), 'small');

  // STORAGE_ANALYZER_EXECUTABLE runs the walkthrough against an installed app,
  // which starts its own bundled backend.
  const installed = process.env.STORAGE_ANALYZER_EXECUTABLE;
  const env = { ...process.env, STORAGE_ANALYZER_API_URL: apiUrl };
  const app = await electron.launch(installed ? { executablePath: installed, env } : { args: [frontend], env });
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.hide()));
    await app.evaluate(({ dialog, shell }, selectedPath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedPath] });
      globalThis.shownItems = [];
      shell.showItemInFolder = item => globalThis.shownItems.push(item);
    }, fixture);
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    // 1. Choose the folder once the engine is ready.
    const choose = page.locator('button[aria-keyshortcuts="Control+O"]');
    await expect(choose).toBeEnabled({ timeout: 30000 });
    await choose.click();
    await expect(page.locator('input[name="workspace-view"][value="largest"]')).toBeVisible({ timeout: 30000 });

    // 2. The deep file leads the ranking; the tree was never expanded.
    await page.locator('input[name="workspace-view"][value="largest"]').check();
    const rows = page.locator('.largest-card tbody tr');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText('target.bin');
    await expect(rows.nth(0).locator('.location-column')).toHaveText(['a', 'b', 'c', 'd', 'e', 'f'].join(path.sep));
    await expect(rows.filter({ hasText: 'copy.bin' })).toHaveCount(2);
    await expect(page.locator('[role="treeitem"][aria-expanded="true"]')).toHaveCount(1); // only the root

    // 3. Show it in Explorer with the keyboard.
    await rows.nth(0).locator('.action-column button').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => app.evaluate(() => globalThis.shownItems)).toEqual([target]);

    // 4. A file moved after the analysis is explained, never shown.
    await fs.rm(target);
    await rows.nth(0).locator('.action-column button').click();
    await expect(page.locator('.largest-feedback [role="alert"]')).toBeVisible();
    expect(await app.evaluate(() => globalThis.shownItems)).toEqual([target]);

    const capacity = await page.evaluate(async url => (await fetch(`${url}/capacity`)).json(), apiUrl);
    expect(errors).toEqual([]);
    await fs.mkdir(path.join(frontend, 'test-results'), { recursive: true });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.show()));
    await page.screenshot({ path: path.join(frontend, 'test-results', 'electron-first-finding.png') });
    console.log(`First finding passed: deep file ranked first and shown, moved file explained. This computer holds about ${capacity.maxEntries.toLocaleString('en-US')} items per analysis (heap ${(capacity.maxHeapBytes / 1024 ** 3).toFixed(1)} GiB).`);
  } finally {
    await app.close();
    await fs.rm(fixture, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
