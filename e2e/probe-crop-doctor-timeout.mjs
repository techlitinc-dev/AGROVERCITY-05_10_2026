/** Diagnostic: reproduce the 90s page.goto timeout on /farmer/crop-doctor. */
import { chromium } from '@playwright/test';

const WEB = process.env.WEB || 'http://65.20.92.22:5173';
const API = 'http://localhost:8000/v1';
const phone = '+919822000001';

const sent = await (await fetch(`${API}/auth/otp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })).json();
const session = await (await fetch(`${API}/auth/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp: sent.devOtp }) })).json();
console.log('session ok, user:', session.user?.id);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((sess) => {
  localStorage.setItem('agrovercity_access_token', sess.accessToken);
  localStorage.setItem('agrovercity_refresh_token', sess.refreshToken);
  localStorage.setItem('agrovercity_user', JSON.stringify(sess.user));
  localStorage.setItem('agrovercity_active_persona', 'farmer');
}, session);
const page = await ctx.newPage();

let inFlight = 0;
let total = 0;
const neverFinished = new Set();
page.on('request', (r) => { inFlight++; total++; neverFinished.add(r); });
page.on('requestfinished', (r) => {
  inFlight--; neverFinished.delete(r);
  const ms = Math.round(r.timing().responseEnd || 0);
  if (ms > 3000) console.log(`SLOW  ${ms}ms  ${r.url().slice(0, 130)}`);
});
page.on('requestfailed', (r) => {
  inFlight--; neverFinished.delete(r);
  console.log(`FAILED ${r.url().slice(0, 130)} ${r.failure()?.errorText}`);
});

const t0 = Date.now();
try {
  await page.goto(`${WEB}/farmer/crop-doctor`, { waitUntil: 'networkidle', timeout: 90000 });
  console.log(`RESULT networkidle OK in ${Date.now() - t0}ms, total requests: ${total}`);
} catch (e) {
  console.log(`RESULT networkidle FAILED after ${Date.now() - t0}ms: ${String(e).split('\n')[0]}`);
  console.log(`total requests fired: ${total}, still in flight: ${inFlight}`);
  for (const r of neverFinished) console.log('  IN-FLIGHT>', r.url().slice(0, 130));
}
await browser.close();
