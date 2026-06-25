/**
 * Web smoke / UI-QA harness for the Tauri-less browser runtime.
 *
 * Loads the app in a real browser WITHOUT the e2e tauri mocks, so it exercises
 * the production browser runtime shim (src/platform/browser). Designed to be
 * run repeatedly by an AI pair during UI/UX QA: it captures console/page
 * errors, verifies the app renders, optionally walks a basic flow, and writes
 * screenshots for visual inspection.
 *
 * Usage:
 *   node tests/qa/web-smoke.mjs                 # smoke: boot + render + console errors
 *   BASE_URL=http://localhost:7051 node tests/qa/web-smoke.mjs
 *
 * Exit code 0 = healthy boot (no fatal console/page errors), 1 = problems.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:7051';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '__output__');
mkdirSync(OUT_DIR, { recursive: true });

// Console messages that are noise, not failures, in a backend-less web build.
const IGNORED_ERROR_PATTERNS = [
  /\[browser-runtime\] unhandled command/i,
  /Failed to load resource/i, // favicon etc.
];

function isIgnorable(text) {
  return IGNORED_ERROR_PATTERNS.some((re) => re.test(text));
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnorable(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  console.log(`→ Navigating to ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });

  // App is considered "rendered" once #root has meaningful DOM.
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return !!root && root.childElementCount > 0 && root.innerText.trim().length > 0;
    },
    { timeout: 20_000 }
  );

  await page.waitForTimeout(1500); // let startup effects settle

  const rootText = await page.evaluate(() => document.getElementById('root')?.innerText ?? '');
  const shotPath = join(OUT_DIR, 'boot.png');
  await page.screenshot({ path: shotPath, fullPage: false });

  console.log('\n=== SMOKE RESULT ===');
  console.log(`rendered: ${rootText.length > 0 ? 'yes' : 'NO'}`);
  console.log(`screenshot: ${shotPath}`);
  console.log(`first 200 chars of UI text: ${JSON.stringify(rootText.slice(0, 200))}`);

  if (pageErrors.length) {
    console.log(`\n✗ Page errors (${pageErrors.length}):`);
    pageErrors.forEach((e) => console.log('  - ' + e));
  }
  if (consoleErrors.length) {
    console.log(`\n✗ Console errors (${consoleErrors.length}):`);
    [...new Set(consoleErrors)].slice(0, 20).forEach((e) => console.log('  - ' + e));
  }

  await browser.close();

  const healthy = pageErrors.length === 0 && consoleErrors.length === 0 && rootText.length > 0;
  console.log(`\n${healthy ? '✓ HEALTHY' : '✗ PROBLEMS DETECTED'}`);
  process.exit(healthy ? 0 : 1);
}

main().catch((err) => {
  console.error('Harness failed:', err);
  process.exit(1);
});
