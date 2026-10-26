/** Verify: no preview box / no demo leaves; photo required; scan flow; delete report. */
import { chromium } from '@playwright/test';

const WEB = 'http://localhost:5173';
const API = 'http://localhost:8000/v1';
const phone = '+919822000001';
const sent = await (await fetch(`${API}/auth/otp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })).json();
const session = await (await fetch(`${API}/auth/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp: sent.devOtp }) })).json();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((sess) => {
  localStorage.setItem('agrovercity_access_token', sess.accessToken);
  localStorage.setItem('agrovercity_refresh_token', sess.refreshToken);
  localStorage.setItem('agrovercity_user', JSON.stringify(sess.user));
  localStorage.setItem('agrovercity_active_persona', 'farmer');
}, session);
const page = await ctx.newPage();
page.on('response', async (r) => {
  if (r.url().includes('/v1/advisory/disease-scans') && r.request().method() === 'DELETE') {
    console.log('DELETE report ->', r.status());
  }
});

await page.goto(`${WEB}/farmer/crop-doctor`, { waitUntil: 'networkidle' });

const checks = {
  demoSectionGone: (await page.getByText(/demo diseased leaf/i).count()) === 0,
  previewBoxGone: (await page.locator('img[alt="Crop specimen"]').count()) === 0,
  diagnoseDisabledWithoutPhoto: await page.getByRole('button', { name: /diagnose|निदान/i }).first().isDisabled(),
};
console.log('initial checks:', JSON.stringify(checks));

// Flow: pick photo -> chip -> diagnose
await page.setInputFiles('input[type="file"] >> nth=0', '/tmp/phone_photo.jpg');
await page.waitForTimeout(400);
console.log('chip visible:', (await page.getByText(/Ready to diagnose|जांच के लिए तैयार/i).count()) > 0);
await page.screenshot({ path: '/tmp/v2-1-with-photo.png' });

await page.getByRole('button', { name: /diagnose|निदान/i }).first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/v2-2-progress.png' });
await page.getByText(/Match Score|Confirmed Diagnosis/i).first().waitFor({ timeout: 30000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/v2-3-result.png' });

// Delete newest history row
const historyRows = page.locator('button:has(h5)');
const rowCountBefore = await historyRows.count();
const firstDelete = page.locator('button[title="Delete this report"]').first();
if (await firstDelete.count()) {
  await firstDelete.click();
  await page.waitForTimeout(800);
}
const rowCountAfter = await historyRows.count();
console.log(`history rows: ${rowCountBefore} -> ${rowCountAfter}`);
await page.screenshot({ path: '/tmp/v2-4-after-delete.png', fullPage: false });

await browser.close();
console.log('done');
