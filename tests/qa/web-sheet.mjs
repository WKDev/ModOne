/**
 * Sheet Editor QA for the browser runtime: create a sheet file via the File
 * menu, confirm it appears in the Explorer (virtual FS), open it (the SVG sheet
 * canvas must render — a fresh file is seeded with a valid default sheet XML),
 * then reload + reopen to confirm persistence. Runs without the e2e tauri mocks.
 *
 * Usage: node tests/qa/web-sheet.mjs   (dev server must be running)
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:7051';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '__output__');
mkdirSync(OUT_DIR, { recursive: true });

const IGNORED = [/\[browser-runtime\] unhandled command/i, /Failed to load resource/i, /GL Driver/i];
const KNOWN_NONFATAL = [/reading 'geometry'/i];
const ignorable = (t) => IGNORED.some((re) => re.test(t));
const isKnown = (t) => KNOWN_NONFATAL.some((re) => re.test(t));
const errors = [];
const warnings = [];

async function shot(page, name) {
  await page.screenshot({ path: join(OUT_DIR, `sheet-${name}.png`) });
  console.log(`  ✓ ${name}`);
}

async function sheetRendered(page) {
  return page.evaluate(() => {
    const root = document.getElementById('root');
    const hasSvg = !!root?.querySelector('main svg, [data-testid="panel-container"] svg');
    const failed = /Failed to load/i.test(root?.innerText ?? '');
    return { hasSvg, failed };
  });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const record = (msg) => {
    if (ignorable(msg)) return;
    (isKnown(msg) ? warnings : errors).push(msg);
  };
  page.on('console', (m) => {
    if (m.type() === 'error') record(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => record(`pageerror: ${e.message}`));

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    for (const db of (await indexedDB.databases?.()) ?? []) if (db.name) indexedDB.deleteDatabase(db.name);
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => (document.getElementById('root')?.innerText?.length ?? 0) > 0);
  await page.waitForTimeout(800);

  console.log('→ Create project');
  await page.getByRole('button', { name: 'New Project', exact: true }).last().click();
  await page.waitForSelector('#savePath', { timeout: 5000 });
  await page.getByRole('button', { name: '생성', exact: true }).click();
  await page.waitForSelector('#savePath', { state: 'detached', timeout: 8000 });
  await page.waitForTimeout(800);

  console.log('→ New Sheet file (File → Add → New Sheet)');
  await page.getByText('File', { exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByText('Add', { exact: true }).first().hover();
  await page.waitForTimeout(400);
  await page.getByText('New Sheet', { exact: true }).first().click();
  await page.waitForSelector('[data-testid="new-file-dialog"]', { timeout: 5000 });
  await page.fill('[data-testid="file-name-input"]', 'cover');
  await page.click('[data-testid="create-file-btn"]');
  await page.waitForSelector('[data-testid="new-file-dialog"]', { state: 'detached', timeout: 8000 });
  await page.waitForTimeout(800);
  await shot(page, '1-file-created');

  console.log('→ Open sheet file');
  await page.getByText('sheets', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.getByText('cover.sheet.xml', { exact: false }).first().dblclick({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '2-sheet-open');
  const open = await sheetRendered(page);
  console.log(`  sheet SVG rendered: ${open.hasSvg}; load error: ${open.failed}`);
  if (!open.hasSvg || open.failed) errors.push('sheet editor did not render');

  console.log('→ Reload + reopen from Explorer');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => (document.getElementById('root')?.innerText?.length ?? 0) > 0);
  await page.waitForTimeout(1800);
  if ((await page.getByText('cover.sheet.xml', { exact: false }).count()) === 0) {
    await page.getByText('sheets', { exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(400);
  }
  const fileStillThere = (await page.getByText('cover.sheet.xml', { exact: false }).count()) > 0;
  await page.getByText('cover.sheet.xml', { exact: false }).first().dblclick().catch(() => {});
  await page.waitForTimeout(1500);
  const reopened = (await sheetRendered(page)).hasSvg;
  await shot(page, '3-after-reload');
  console.log(`  file survived reload: ${fileStillThere}; reopened sheet: ${reopened}`);
  if (!fileStillThere || !reopened) errors.push('persistence: sheet did not survive reload / reopen');

  if (warnings.length) {
    console.log(`\n⚠ Known non-fatal (${warnings.length}):`);
    [...new Set(warnings)].slice(0, 5).forEach((e) => console.log('  - ' + e));
  }
  if (errors.length) {
    console.log(`\n✗ Errors (${errors.length}):`);
    [...new Set(errors)].slice(0, 25).forEach((e) => console.log('  - ' + e));
  } else {
    console.log('\n✓ No fatal console/page errors');
  }
  await browser.close();
  process.exit(errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error('Harness failed:', err);
  process.exit(1);
});
