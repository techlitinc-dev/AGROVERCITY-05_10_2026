// Full-lifecycle probe: farmer books directly → transporter accepts → trip
// driven to delivered → screenshot trips/bilty/pnl tabs WITH data.
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
const mkuser = async (name) => {
  const phone = `+9199${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const sent = await api('POST', '/auth/otp/send', { phone });
  const v = await api('POST', '/auth/otp/verify', { phone, otp: sent.body.devOtp, name });
  return { phone, token: v.body.accessToken, refresh: v.body.refreshToken, user: v.body.user };
};

const farmer = await mkuser('LC Farmer');
const trans = await mkuser('LC Transporter');
await api('POST', '/users/me/profiles/transport/activate', null, trans.token);

const veh = await api('POST', '/transport/vehicles', {
  vehicleType: 'Tata Ace', registrationNo: 'MH-14-LIFE-1', capacityTonnes: 1,
}, trans.token);
console.log('vehicle →', veh.status, veh.body.id, 'docStatus:', veh.body.docStatus);

const bk = await api('POST', '/transport/bookings', {
  vehicleType: 'Tata Ace', distanceKm: 20,
  pickup: 'Pimpalgaon', drop: 'Nashik APMC',
  date: new Date().toISOString().slice(0, 10),
  commodity: 'Onion', weightQuintals: 10,
}, farmer.token);
console.log('booking →', bk.status, bk.body.id, 'status:', bk.body.status);

const acc = await api('POST', `/transport/bookings/${bk.body.id}/accept`, {
  vehicleId: veh.body.id, vehicleNo: 'MH-14-LIFE-1',
}, trans.token);
console.log('accept →', acc.status, acc.body.status);

const meT = await api('GET', '/users/me', null, trans.token);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
await context.addInitScript(
  ({ access, refresh, user }) => {
    localStorage.setItem('agrovercity_access_token', access);
    localStorage.setItem('agrovercity_refresh_token', refresh);
    localStorage.setItem('agrovercity_user', JSON.stringify(user));
    localStorage.setItem('agrovercity_active_persona', 'transport');
  },
  { access: trans.token, refresh: trans.refresh, user: meT.body }
);
const page = await context.newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') console.log(`[console.error] ${m.text().slice(0, 160)}`); });

for (const p of ['/transporter/trips', '/transporter/bilty', '/transporter/settlements']) {
  await page.goto(`${WEB}${p}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
  console.log(`\n=== ${p} → ${page.url()} ===`);
  const txt = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 700));
  console.log('TEXT:', txt);
  await page.screenshot({ path: `probe-life-${p.split('/').pop()}.png`, fullPage: true });
}

// drive the trip to delivered, then re-check bilty + pnl
for (const status of ['enRoute', 'delivered']) {
  const r = await api('PATCH', `/transport/bookings/${bk.body.id}`, {
    status,
    ...(status === 'delivered'
      ? { podPhotos: ['https://example.com/pod.jpg'], receiverName: 'Ram Patil' }
      : {}),
  }, trans.token);
  console.log('PATCH', status, '→', r.status);
}
for (const p of ['/transporter/bilty', '/transporter/settlements']) {
  await page.goto(`${WEB}${p}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
  console.log(`\n=== delivered: ${p} ===`);
  const txt = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 700));
  console.log('TEXT:', txt);
  await page.screenshot({ path: `probe-life-del-${p.split('/').pop()}.png`, fullPage: true });
}
await browser.close();
console.log('\ndone');
