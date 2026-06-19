// 실제 앱에 CDP로 붙어 Tauri 백엔드 커맨드를 직접 호출하는 동작 테스트 유틸
// usage: node scripts/cdp-invoke.mjs <command> '<json-args>'
import { chromium } from 'playwright';

const CDP = 'http://localhost:9222';
const cmd = process.argv[2];
const args = process.argv[3] ? JSON.parse(process.argv[3]) : {};

const browser = await chromium.connectOverCDP(CDP);
const page = browser.contexts()[0].pages().find((p) => p.url().includes('7051'));

const res = await page.evaluate(
  async ([c, a]) => {
    try {
      const r = await window.__TAURI_INTERNALS__.invoke(c, a);
      return { ok: true, value: r };
    } catch (e) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  },
  [cmd, args],
);

console.log('INVOKE', cmd, JSON.stringify(args));
console.log('RESULT', JSON.stringify(res, null, 2));
await browser.close();
