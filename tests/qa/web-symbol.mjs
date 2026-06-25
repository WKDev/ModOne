/**
 * Symbol Editor QA for the browser runtime: open the editor via the command
 * palette (no files needed), draw a primitive, save, and assert the symbol was
 * persisted to IndexedDB. Runs without the e2e tauri mocks.
 *
 * Usage: node tests/qa/web-symbol.mjs   (dev server must be running)
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:7051';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '__output__');
mkdirSync(OUT_DIR, { recursive: true });

const IGNORED = [/\[browser-runtime\] unhandled command/i, /Failed to load resource/i];
const ignorable = (t) => IGNORED.some((re) => re.test(t));
const errors = [];

async function shot(page, name) {
  await page.screenshot({ path: join(OUT_DIR, `symbol-${name}.png`) });
  console.log(`  ✓ ${name}`);
}

async function readSymbolStore(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open('modone-db');
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('symbols')) return resolve([]);
          const os = db.transaction('symbols', 'readonly').objectStore('symbols');
          const all = os.getAll();
          all.onsuccess = () => resolve(all.result);
          all.onerror = () => resolve('ERR');
        };
        req.onerror = () => resolve('ERR-open');
      })
  );
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => {
    if (m.type() === 'error' && !ignorable(m.text())) errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  // Fresh state
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    for (const db of (await indexedDB.databases?.()) ?? []) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => (document.getElementById('root')?.innerText?.length ?? 0) > 0);
  await page.waitForTimeout(800);

  // Need an open project so symbol_save has a projectDir.
  console.log('→ Create project');
  await page.getByRole('button', { name: 'New Project', exact: true }).last().click();
  await page.waitForSelector('#savePath', { timeout: 5000 });
  await page.getByRole('button', { name: '생성', exact: true }).click();
  await page.waitForSelector('#savePath', { state: 'detached', timeout: 8000 });
  await page.waitForTimeout(1000);

  // Open Symbol Editor via the toolbar button (data-testid="open-symbol-editor")
  console.log('→ Open Symbol Editor');
  await page.click('[data-testid="open-symbol-editor"]');
  await page.waitForSelector('[data-testid="symbol-editor"]', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(800);
  await shot(page, '1-editor-open');

  // A saveable symbol needs >=1 pin (validateSymbol: at_least_one_pin).
  // Placing a pin opens an "ADD PIN" dialog that must be filled in.
  console.log('→ Place a pin');
  const canvas = page.locator('[data-testid="symbol-editor-canvas"]');
  const box = await canvas.boundingBox();
  await page.click('[data-testid="tool-pin"]');
  if (box) await page.mouse.click(box.x + 160, box.y + 180);
  await page.waitForTimeout(300);
  await page.fill('input[placeholder="e.g. VCC"]', 'P1');
  await page.getByRole('button', { name: 'Add Pin', exact: true }).click();
  await page.waitForTimeout(400);
  await shot(page, '2-pin-added');

  // Save via the Properties panel "Save Symbol" button (the header "Save" and
  // this one share data-testid="save-symbol-btn"; only this one persists).
  console.log('→ Save symbol');
  await page.getByRole('button', { name: 'Save Symbol', exact: true }).click();
  await page.waitForTimeout(800);
  await shot(page, '3-after-save');

  const symbols = await readSymbolStore(page);
  console.log('\n=== PERSISTENCE ===');
  console.log(`IndexedDB symbols store entries: ${Array.isArray(symbols) ? symbols.length : symbols}`);
  if (Array.isArray(symbols) && symbols.length) {
    const d = symbols[0]?.definition;
    console.log(`  first: id=${d?.id} name=${d?.name} graphics=${d?.graphics?.length}`);
  }

  if (errors.length) {
    console.log(`\n✗ Errors (${errors.length}):`);
    [...new Set(errors)].slice(0, 25).forEach((e) => console.log('  - ' + e));
  } else {
    console.log('\n✓ No console/page errors');
  }
  await browser.close();
  const ok = errors.length === 0 && Array.isArray(symbols) && symbols.length > 0;
  console.log(ok ? '\n✓ SYMBOL PERSISTED' : '\n✗ CHECK ABOVE');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('Harness failed:', err);
  process.exit(1);
});
