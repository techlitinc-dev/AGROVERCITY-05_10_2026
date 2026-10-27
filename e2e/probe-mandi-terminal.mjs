/** Verify the rewritten mandi terminal UI: tabs, board, detail sheet, mobile cards. */
import { chromium } from '@playwright/test';

const WEB = process.env.WEB || 'http://localhost:5173';
const API = 'http://localhost:8000/v1';
const phone = '+919822000001';

const sent = await (await fetch(`${API}/auth/otp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })).json();
const session = await (await fetch(`${API}/auth/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp: sent.devOtp }) })).json();

const browser = await chromium.launch();

async function newSessionPage(viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript((sess) => {
    localStorage.setItem('agrovercity_access_token', sess.accessToken);
    localStorage.setItem('agrovercity_refresh_token', sess.refreshToken);
    localStorage.setItem('agrovercity_user', JSON.stringify(sess.user));
    localStorage.setItem('agrovercity_active_persona', 'farmer');
  }, session);
  return ctx.newPage();
}

// ---------- desktop ----------
const page = await newSessionPage({ width: 1440, height: 900 });
page.on('pageerror', (e) => console.log('PAGE-ERR>', String(e).slice(0, 200)));
await page.goto(`${WEB}/farmer/mandi`, { waitUntil: 'networkidle', timeout: 90000 });
await page.getByRole('heading', { name: /Mandi Rates/i }).waitFor({ timeout: 20000 });
await page.waitForTimeout(1500);

console.log('stats cards:', await page.locator('.grid.grid-cols-2.lg\\:grid-cols-4 > div').count());
console.log('desktop table rows:', await page.locator('table tbody tr').count());

// open detail from a table row
await page.locator('table tbody tr').first().click();
await page.waitForTimeout(1500);
console.log('detail sheet open:', (await page.getByText(/7-Day Forecast/i).count()) > 0);
console.log('arbitrage section:', (await page.getByText(/Best Yards to Sell/i).count()) > 0);
await page.screenshot({ path: '/tmp/mandi-detail.png' });
await page.keyboard.press('Escape');

// watchlist toggle via star
await page.locator('table tbody tr td:last-child button').first().click();
await page.waitForTimeout(700);
await page.locator('button:has-text("Watchlist (")').first().click();
await page.waitForTimeout(700);
console.log('watch-only rows:', await page.locator('table tbody tr').count());
await page.screenshot({ path: '/tmp/mandi-watchlist.png' });
await page.locator('button:has-text("Watchlist (")').first().click();

// tabs
await page.locator('button:has-text("Local Yards")').first().click();
await page.waitForTimeout(1200);
console.log('yards tab saved-markets:', (await page.getByText(/Saved Markets/i).count()) > 0);
await page.screenshot({ path: '/tmp/mandi-yards.png' });
await page.locator('button:has-text("My Alerts")').first().click();
await page.waitForTimeout(800);
console.log('alerts tab open:', (await page.getByText(/My Price Alerts/i).count()) > 0);
await page.screenshot({ path: '/tmp/mandi-alerts.png' });

// ---------- mobile ----------
const m = await newSessionPage({ width: 390, height: 844 });
await m.goto(`${WEB}/farmer/mandi`, { waitUntil: 'networkidle', timeout: 90000 });
await m.waitForTimeout(1500);
console.log('mobile cards:', await m.locator('.lg\\:hidden.divide-y > div').count());
await m.screenshot({ path: '/tmp/mandi-mobile.png' });
// open detail as bottom sheet
await m.locator('.lg\\:hidden.divide-y > div').first().click();
await m.waitForTimeout(1200);
console.log('mobile sheet open:', (await m.getByText(/7-Day Forecast/i).count()) > 0);
await m.screenshot({ path: '/tmp/mandi-mobile-sheet.png' });

await browser.close();
console.log('done');
