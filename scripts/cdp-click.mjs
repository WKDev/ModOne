// 실제 앱 창에 CDP로 붙어 요소를 클릭하고 결과를 캡처하는 조작 테스트
import { chromium } from 'playwright';

const CDP = 'http://localhost:9222';
const label = process.argv[2] ?? 'Integration (Modbus / OPC UA)';
const out = process.argv[3] ?? '.sisyphus/app-click.png';

const browser = await chromium.connectOverCDP(CDP);
const page = browser.contexts()[0].pages().find((p) => p.url().includes('7051'));

const before = await page.title();
await page.getByText(label, { exact: false }).first().click({ timeout: 5000 });
await page.waitForTimeout(700);
await page.screenshot({ path: out });

console.log('CLICKED :', label);
console.log('TITLE   :', before, '->', await page.title());
console.log('SAVED   :', out);
await browser.close();
