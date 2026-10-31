// One-off diagnostic: register a fresh transporter on the remote dev server and
// screenshot the transporter pages.
import { chromium } from '@playwright/test';

const WEB = 'http://65.20.92.22:5173';
const api = async (method, path, body, token) => {
  const r = await fetch(`${WEB}/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const phone = `+9199${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
console.log('registering', phone);

const sent = await api('POST', '/auth/otp/send', { phone });
console.log('otp/send →', sent.status, JSON.stringify(sent.body).slice(0, 160));
const otp = sent.body.devOtp || sent.body.otp;
const verified = await api('POST', '/auth/otp/verify', { phone, otp, name: 'Probe Transporter' });
console.log('otp/verify →', verified.status, JSON.stringify(verified.body).slice(0, 200));

const token = verified.body.accessToken;
if (!token) process.exit(1);

const act = await api('POST', '/users/me/profiles/transport/activate', null, token);
console.log('activate transport →', act.status, 'active:', act.body.activeProfile);
const activeUser = act.body.user ?? verified.body.user;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await context.addInitScript(
  ({ access, refresh, user }) => {
    localStorage.setItem('agrovercity_access_token', access);
    localStorage.setItem('agrovercity_refresh_token', refresh);
    localStorage.setItem('agrovercity_user', JSON.stringify(user));
    localStorage.setItem('agrovercity_active_persona', 'transport');
  },
  { access: token, refresh: verified.body.refreshToken, user: activeUser, persona: 'transport' }
);
const page = await context.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console.error] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

for (const p of ['/transporter/loads', '/transporter/trips', '/transporter/bilty']) {
  logs.length = 0;
  await page.goto(`${WEB}${p}`, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => logs.push(`[nav] ${e.message}`));
  await page.waitForTimeout(2500);
  console.log(`\n=== ${p} → ${page.url()} ===`);
  for (const l of logs.slice(0, 8)) console.log(l);
  const text = await page.evaluate(() => document.body.innerText.slice(0, 500).replace(/\n+/g, ' | '));
  console.log('TEXT:', text);
  await page.screenshot({ path: `probe-auth-${p.split('/').pop()}.png` });
}
await browser.close();
console.log('\ndone');
