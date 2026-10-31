// Verify the farmer transport page renders with a real booking (the crash case).
import { chromium } from '@playwright/test';

const WEB = 'http://65.20.92.22:5173';
const B = 'http://65.20.92.22:8000/v1';
const api = async (m, p, body, token) => {
  const r = await fetch(`${B}${p}`, { method: m,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const mk = async (name) => {
  const phone = `+9199${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const s = await api('POST', '/auth/otp/send', { phone });
  const v = await api('POST', '/auth/otp/verify', { phone, otp: s.body.devOtp, name });
  return v.body.accessToken;
};
const farmer = await mk('CrashTest Farmer');
const trans = await mk('CrashTest Trans');
await api('POST', '/users/me/profiles/transport/activate', null, trans);
const veh = await api('POST', '/transport/vehicles', { vehicleType: 'Tata Ace', registrationNo: 'MH-14-CT-1', capacityTonnes: 1 }, trans);
const load = await api('POST', '/transport/loads', { pickupLocation: 'Pimpalgaon, Nashik', dropLocation: 'Nashik APMC, Nashik', crop: 'Onion', quantityQuintals: 20, preferredVehicleType: 'Tata Ace', pickupDate: '2026-10-29', targetFare: 2500, termsAccepted: true }, farmer);
await api('PUT', `/transport/vehicles/${veh.body.id}/availability`, { availableDates: ['2026-10-29'] }, trans);
const bid = await api('POST', `/transport/loads/${load.body.id}/bid`, { quotedFare: 2400, termsAccepted: true, vehicleId: veh.body.id }, trans);
const acc = await api('POST', `/transport/loads/${load.body.id}/accept-bid`, { bidId: bid.body.id, termsAccepted: true }, farmer);
console.log('booking created:', acc.body.booking?.id);

const me = await api('GET', '/users/me', null, farmer);
const s = await api('POST', '/auth/otp/send', { phone: '+91990000000' });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
await ctx.addInitScript(({ access, user }) => {
  localStorage.setItem('agrovercity_access_token', access);
  localStorage.setItem('agrovercity_user', JSON.stringify(user));
  localStorage.setItem('agrovercity_active_persona', 'farmer');
}, { access: farmer, user: me.body });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${WEB}/farmer/transport`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2500);
const txt = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 500));
console.log('page errors:', errs.length ? errs : 'none');
console.log('TEXT:', txt);
await page.screenshot({ path: 'farmer-transport-check.png', fullPage: true });
await browser.close();
