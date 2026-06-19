// WebView2 CDP에 붙어 실제 앱 창을 캡처/검사하는 동작 테스트 프로브
import { chromium } from 'playwright';

const CDP = 'http://localhost:9222';
const OUT = process.argv[2] ?? '.sisyphus/app-cdp.png';

const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const pages = ctx.pages();
const page = pages.find((p) => p.url().includes('7051')) ?? pages[0];

const msgs = [];
page.on('console', (m) => msgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message}`));

await page.waitForLoadState('domcontentloaded').catch(() => {});
await page.waitForTimeout(800);

const title = await page.title().catch((e) => String(e));
const hasTauri = await page
  .evaluate(() => Boolean(window.__TAURI_INTERNALS__))
  .catch((e) => String(e));
const bodyText = await page
  .evaluate(() => document.body?.innerText?.slice(0, 200) ?? '')
  .catch((e) => String(e));

await page.screenshot({ path: OUT });

console.log('TITLE   :', title);
console.log('URL     :', page.url());
console.log('HASTAURI:', hasTauri);
console.log('BODY200 :', JSON.stringify(bodyText));
console.log('CONSOLE :', msgs.length, 'messages');
for (const m of msgs.slice(0, 20)) console.log('   ', m);
console.log('SAVED   :', OUT);

await browser.close();
