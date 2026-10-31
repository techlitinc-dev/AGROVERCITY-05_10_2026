// One-off diagnostic: seed a vehicle + load + bid + accepted trip, then
// screenshot the three transporter tabs WITH data rows.
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

const farmer = await mkuser('Probe Farmer');
const trans = await mkuser('Probe Transporter');
await api('POST', '/users/me/profiles/transport/activate', null, trans.token);
console.log('users ready');

// transporter: add a vehicle (plan gate: free tier allows 1)
const veh = await api('POST', '/transport/vehicles', {
  vehicleType: 'Tata Ace', registrationNo: 'MH-14-PRO-BE', capacityTonnes: 1,
}, trans.token);
console.log('vehicle →', veh.status, JSON.stringify(veh.body).slice(0, 140));

// farmer: post a load with terms
const load = await api('POST', '/transport/loads', {
  pickupLocation: 'Pimpalgaon', dropLocation: 'Nashik APMC', crop: 'Onion',
  quantityQuintals: 20, preferredVehicleType: 'Tata Ace',
  pickupDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  targetFare: 2500, termsAccepted: true,
}, farmer.token);
console.log('load →', load.status, load.body.id);

// transporter: bid with terms (no MPIN set → gate skipped)
const bid = await api('POST', `/transport/loads/${load.body.id}/bid`, {
  quotedFare: 2400, termsAccepted: true, vehicleId: veh.body.id,
}, trans.token);
console.log('bid →', bid.status, bid.body.id);

// farmer: accept with pre-reveal terms
const acc = await api('POST', `/transport/loads/${load.body.id}/accept-bid`, {
  bidId: bid.body.id, termsAccepted: true,
}, farmer.token);
console.log('accept →', acc.status, acc.body.booking?.id);

const meT = await api('GET', '/users/me', null, trans.token);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
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

for (const p of ['/transporter/loads', '/transporter/trips', '/transporter/bilty', '/transporter/settlements']) {
  await page.goto(`${WEB}${p}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
  console.log(`\n=== ${p} → ${page.url()} ===`);
  const text = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 600));
  console.log('TEXT:', text);
  await page.screenshot({ path: `probe-data-${p.split('/').pop()}.png` });
}
await browser.close();
console.log('\ndone');
