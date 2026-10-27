import { chromium } from '@playwright/test';

const login = await fetch('http://localhost:8000/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '+919822000001', mpin: '4321' }),
}).then((r) => r.json());

const browser = await chromium.launch();
const context = await browser.newContext();
await context.addInitScript(
  ({ access, refresh, user }) => {
    localStorage.setItem('agrovercity_access_token', access);
    localStorage.setItem('agrovercity_refresh_token', refresh);
    localStorage.setItem('agrovercity_user', JSON.stringify(user));
    localStorage.setItem('agrovercity_active_persona', 'farmer');
  },
  { access: login.accessToken, refresh: login.refreshToken, user: login.user }
);
const page = await context.newPage();
page.on('response', async (r) => {
  if (r.url().includes('/v1/')) {
    const body = await r.text().catch(() => '');
    console.log('[resp]', r.status(), r.url().split('5173')[1]?.slice(0, 60), '→', body.slice(0, 90));
  }
});
await page.goto('http://localhost:5173/farmer/lots');
// Mimic the test: open the modal immediately, no waiting.
await page.getByRole('button', { name: /post new produce lot/i }).click();
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(1000);
  const n = await page.locator('#lot-crop-options option').count();
  const lots = await page.getByText(/My Listed Produce Lots/).innerText().catch(() => '?');
  console.log(`t=${i + 1}s options=${n} lots="${lots}"`);
  if (n > 0) break;
}
await browser.close();
