// Final visual check after full stack restart.
import { chromium } from '@playwright/test';

const WEB = 'http://65.20.92.22:5173';
const api = async (method, path, body, token) => {
  const r = await fetch(`${WEB}/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const phone = `+9199${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
const sent = await api('POST', '/auth/otp/send', { phone });
const v = await api('POST', '/auth/otp/verify', { phone, otp: sent.body.devOtp, name: 'Final Probe' });
const token = v.body.accessToken;
await api('POST', '/users/me/profiles/transport/activate', null, token);
const me = await api('GET', '/users/me', null, token);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
await context.addInitScript(
  ({ access, refresh, user }) => {
    localStorage.setItem('agrovercity_access_token', access);
    localStorage.setItem('agrovercity_refresh_token', refresh);
    localStorage.setItem('agrovercity_user', JSON.stringify(user));
    localStorage.setItem('agrovercity_active_persona', 'transport');
  },
  { access: token, refresh: v.body.refreshToken, user: me.body }
);
const page = await context.newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
for (const p of ['/transporter/loads', '/transporter/trips', '/transporter/bilty']) {
  await page.goto(`${WEB}${p}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log(`${p} → ${page.url()}`);
  await page.screenshot({ path: `final-${p.split('/').pop()}.png` });
}
await browser.close();
console.log('done');
