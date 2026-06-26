/**
 * Symbol Editor clipboard QA: verifies the newly-wired command shortcuts
 * (Ctrl+A select-all, Ctrl+D duplicate) actually mutate the symbol. Draws one
 * rect + one pin, selects all, duplicates, saves, and asserts the persisted
 * symbol now has 2 graphics and 2 pins.
 *
 * Usage: node tests/qa/web-symbol-clipboard.mjs   (dev server must be running)
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
  await page.screenshot({ path: join(OUT_DIR, `clip-${name}.png`) });
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

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    for (const db of (await indexedDB.databases?.()) ?? []) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => (document.getElementById('root')?.innerText?.length ?? 0) > 0);
  await page.waitForTimeout(800);

  console.log('→ Create project');
  await page.getByRole('button', { name: 'New Project', exact: true }).last().click();
  await page.waitForSelector('#savePath', { timeout: 5000 });
  await page.getByRole('button', { name: '생성', exact: true }).click();
  await page.waitForSelector('#savePath', { state: 'detached', timeout: 8000 });
  await page.waitForTimeout(1000);

  console.log('→ Open Symbol Editor');
  await page.click('[data-testid="open-symbol-editor"]');
  await page.waitForSelector('[data-testid="symbol-editor"]', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(800);

  const canvas = page.locator('[data-testid="symbol-editor-canvas"]');
  const box = await canvas.boundingBox();

  // Draw a rect by dragging.
  console.log('→ Draw rect');
  await page.click('[data-testid="tool-rect"]');
  await page.mouse.move(box.x + 220, box.y + 160);
  await page.mouse.down();
  await page.mouse.move(box.x + 320, box.y + 240, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  // Place a pin (opens the ADD PIN dialog).
  console.log('→ Place a pin');
  await page.click('[data-testid="tool-pin"]');
  await page.mouse.click(box.x + 160, box.y + 180);
  await page.waitForTimeout(300);
  await page.fill('input[placeholder="e.g. VCC"]', 'P1');
  await page.getByRole('button', { name: 'Add Pin', exact: true }).click();
  await page.waitForTimeout(400);
  await shot(page, '1-before-duplicate');

  // Select-all + duplicate via the new shortcuts.
  console.log('→ Ctrl+A select-all, Ctrl+D duplicate');
  await page.click('[data-testid="tool-select"]');
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(200);
  await page.keyboard.press('Control+d');
  await page.waitForTimeout(400);
  await shot(page, '2-after-duplicate');

  console.log('→ Save symbol');
  await page.getByRole('button', { name: 'Save Symbol', exact: true }).click();
  await page.waitForTimeout(800);

  const symbols = await readSymbolStore(page);
  console.log('\n=== RESULT ===');
  let graphics = -1;
  let pins = -1;
  if (Array.isArray(symbols) && symbols.length) {
    const d = symbols[0]?.definition;
    graphics = d?.graphics?.length ?? -1;
    pins = d?.pins?.length ?? -1;
    console.log(`  graphics=${graphics} pins=${pins}`);
  } else {
    console.log(`  store=${symbols}`);
  }

  if (errors.length) {
    console.log(`\n✗ Errors (${errors.length}):`);
    [...new Set(errors)].slice(0, 25).forEach((e) => console.log('  - ' + e));
  } else {
    console.log('\n✓ No console/page errors');
  }
  await browser.close();

  // After duplicate: 1 rect → 2 graphics, 1 pin → 2 pins.
  const ok = errors.length === 0 && graphics === 2 && pins === 2;
  console.log(ok ? '\n✓ DUPLICATE WORKED (2 graphics, 2 pins)' : '\n✗ CHECK ABOVE');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('Harness failed:', err);
  process.exit(1);
});
