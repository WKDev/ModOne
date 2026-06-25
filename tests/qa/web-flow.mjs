/**
 * End-to-end UI flow QA for the browser runtime: create a project and enter
 * the editors, capturing screenshots + console/page errors at each step.
 *
 * Runs WITHOUT the e2e tauri mocks, so it validates the real browser shim
 * (src/platform/browser) + IndexedDB persistence.
 *
 * Usage: node tests/qa/web-flow.mjs   (dev server must be running)
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
const steps = [];

async function shot(page, name) {
  const p = join(OUT_DIR, `flow-${name}.png`);
  await page.screenshot({ path: p });
  steps.push(`  ✓ ${name} → ${p}`);
  console.log(`  ✓ ${name}`);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => {
    if (m.type() === 'error' && !ignorable(m.text())) errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  // Clear IndexedDB so the run is deterministic.
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    for (const db of await indexedDB.databases?.() ?? []) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => (document.getElementById('root')?.innerText?.length ?? 0) > 0, {
    timeout: 20_000,
  });
  await page.waitForTimeout(1000);
  await shot(page, '1-welcome');

  // --- Create a project ---
  console.log('→ Creating project');
  await page.getByRole('button', { name: 'New Project', exact: true }).last().click();
  await page.waitForSelector('#savePath', { timeout: 5000 });
  await page.waitForTimeout(400);
  await shot(page, '2-new-project-dialog');
  await page.getByRole('button', { name: '생성', exact: true }).click();
  // Dialog should close and the project workspace should load.
  await page.waitForSelector('#savePath', { state: 'detached', timeout: 8000 });
  await page.waitForTimeout(1500);
  await shot(page, '3-project-open');

  // --- Schematic (Canvas / OneCanvas) ---
  console.log('→ Schematic editor (Canvas tab)');
  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
  await shot(page, '4-schematic');

  // --- Symbol editor (toolbar) ---
  console.log('→ Symbol editor');
  await page.getByRole('button', { name: 'Symbol', exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await shot(page, '5-symbol-editor');

  console.log('\n=== FLOW STEPS ===');
  steps.forEach((s) => console.log(s));
  if (errors.length) {
    console.log(`\n✗ Errors (${errors.length}):`);
    [...new Set(errors)].slice(0, 25).forEach((e) => console.log('  - ' + e));
  } else {
    console.log('\n✓ No console/page errors during flow');
  }
  await browser.close();
  process.exit(errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error('Flow harness failed:', err);
  process.exit(1);
});
