// Post-deploy check: the live site boots to the login screen with no script
// errors, on both the root URL and the old PWA start_url (/payments.html).
// Usage: node scripts/smoke-live.mjs https://schedual-fdde7.web.app/
import { chromium } from 'playwright';

const base = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'he-IL', viewport: { width: 400, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

for (const path of ['', 'payments.html']) {
  const res = await page.goto(base + path, { waitUntil: 'load' });
  if (!res || !res.ok()) throw new Error(`${base + path}: HTTP ${res && res.status()}`);
  await page.getByText('המשך עם Google').waitFor({ timeout: 30000 });
  console.log(`ok: ${base + path}`);
}
await browser.close();
if (errors.length) throw new Error('page errors:\n' + errors.join('\n'));
console.log('live smoke test passed');
