// One-off diagnostic: open the transporter pages and dump console errors.
import { chromium } from 'playwright';

const BASE = 'http://65.20.92.22:5173';
const paths = ['/transporter/loads', '/transporter/trips', '/transporter/bilty'];

const browser = await chromium.launch();
const page = await browser.newPage();

const logs = [];
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

for (const p of paths) {
  logs.length = 0;
  await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => logs.push(`[nav] ${e.message}`));
  await page.waitForTimeout(1500);
  // Detect a blank-ish app root
  const appHtml = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML.length : -1;
  });
  console.log(`\n=== ${p} (root html length: ${appHtml}) ===`);
  for (const l of logs) console.log(l);
}

await browser.close();
