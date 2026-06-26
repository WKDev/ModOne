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
const KNOWN_NONFATAL = [/reading 'geometry'/i, /reading 'count'/i];
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
    // The sheet editor now renders on a PIXI <canvas> (was SVG).
    const hasCanvas = !!root?.querySelector('[data-testid="panel-container"] canvas, main canvas');
    const failed = /Failed to load/i.test(root?.innerText ?? '');
    return { hasSvg: hasCanvas, failed };
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
  console.log(`  sheet PIXI canvas rendered: ${open.hasSvg}; load error: ${open.failed}`);
  if (!open.hasSvg || open.failed) errors.push('sheet editor did not render');

  // Add a rectangle (placed at page center, auto-selected) and verify it
  // renders + selects, then drag it to smoke-test the PIXI interaction.
  console.log('→ Add rectangle + drag');
  await page.click('[title="Add Rectangle"]');
  await page.waitForTimeout(500);
  const elCount1 = await page.evaluate(() => /(\d+) el\b/.exec(document.getElementById('root')?.innerText ?? '')?.[1] ?? '?');
  const hasDelete = await page.locator('[title="Delete"]').count();
  console.log(`  elements after add: ${elCount1}; delete-button (selected): ${hasDelete > 0}`);
  await shot(page, '2b-rect-added');
  if (elCount1 !== '1') errors.push(`expected 1 element after add, got ${elCount1}`);
  if (hasDelete === 0) errors.push('rect not auto-selected (no Delete button)');

  // Drag from the page centre (the rect's centre) to move it.
  const canvas = page.locator('[data-testid="panel-container"] canvas, main canvas').first();
  const box = await canvas.boundingBox();
  if (box) {
    const cxp = box.x + box.width / 2;
    const cyp = box.y + box.height / 2;
    await page.mouse.move(cxp, cyp);
    await page.mouse.down();
    await page.mouse.move(cxp + 60, cyp + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    await shot(page, '2c-after-drag');
  }
  const elCount2 = await page.evaluate(() => /(\d+) el\b/.exec(document.getElementById('root')?.innerText ?? '')?.[1] ?? '?');
  console.log(`  elements after drag: ${elCount2}`);
  if (elCount2 !== '1') errors.push(`element count changed during drag: ${elCount2}`);

  // Inline text editing: add a text element, double-click it, type, commit.
  console.log('→ Add text + inline edit (double-click)');
  await page.click('[title="Add Text"]');
  await page.waitForTimeout(400);
  if (box) {
    // Mirror SheetCanvasHost's fit: zoom = min(cw/pageW, ch/pageH) * 0.9, page
    // centered. Text element is placed at world (pageW/2-25, pageH/2-15).
    const pageW = 297, pageH = 210;
    const z = Math.min(box.width / pageW, box.height / pageH) * 0.9;
    const tx = pageW / 2 - 25 + 8; // a little inside the text
    const ty = pageH / 2 - 15;
    const dcx = box.x + box.width / 2 + (tx - pageW / 2) * z;
    const dcy = box.y + box.height / 2 + (ty - pageH / 2) * z;
    await page.mouse.dblclick(dcx, dcy);
    await page.waitForTimeout(300);
    await shot(page, '2d-dblclick');
    console.log(`  dblclick at screen (${Math.round(dcx)}, ${Math.round(dcy)}); canvas box x=${Math.round(box.x)} y=${Math.round(box.y)} w=${Math.round(box.width)} h=${Math.round(box.height)}`);
    const editorOpen = await page.locator('[data-testid="sheet-inline-editor"]').count();
    console.log(`  inline editor opened: ${editorOpen > 0}`);
    if (editorOpen === 0) errors.push('inline editor did not open on double-click of text');
    else {
      await page.fill('[data-testid="sheet-inline-editor"]', 'Hello PIXI');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      await shot(page, '2d-text-edited');
      // Re-open the editor and confirm the committed value round-trips.
      await page.mouse.dblclick(dcx, dcy);
      await page.waitForTimeout(300);
      const val = await page.locator('[data-testid="sheet-inline-editor"]').inputValue().catch(() => '');
      console.log(`  committed text round-trips: ${val === 'Hello PIXI'} (got "${val}")`);
      if (val !== 'Hello PIXI') errors.push(`inline text edit did not persist: "${val}"`);
      await page.keyboard.press('Escape');
    }
  }

  // Delete the (still-selected) element via the keyboard shortcut.
  console.log('→ Delete via keyboard');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  const elCount3 = await page.evaluate(() => /(\d+) el\b/.exec(document.getElementById('root')?.innerText ?? '')?.[1] ?? '?');
  console.log(`  elements after Delete: ${elCount3}`);
  if (elCount3 !== '1') errors.push(`Delete shortcut did not remove the selected element: ${elCount3}`);

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
