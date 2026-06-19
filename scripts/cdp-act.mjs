// 실제 앱에 CDP로 붙어 라벨을 클릭하고, 이후 콘솔 메시지와 화면을 보고하는 조작 프로브
import { chromium } from 'playwright';

const CDP = 'http://localhost:9222';
const label = process.argv[2];
const out = process.argv[3] ?? '.sisyphus/app-act.png';

const browser = await chromium.connectOverCDP(CDP);
const page = browser.contexts()[0].pages().find((p) => p.url().includes('7051'));

const msgs = [];
page.on('console', (m) => msgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message}`));

if (label) {
  let loc = page.getByText(label, { exact: true });
  if ((await loc.count()) === 0) loc = page.getByText(label, { exact: false });
  await loc.first().click({ timeout: 5000 });
  console.log('CLICKED :', label);
}
await page.waitForTimeout(1200);
await page.screenshot({ path: out });

console.log('CONSOLE :', msgs.length);
for (const m of msgs.slice(-25)) console.log('   ', m);
console.log('SAVED   :', out);
await browser.close();
