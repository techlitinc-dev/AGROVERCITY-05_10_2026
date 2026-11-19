import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const transporter = PERSONAS.find((p) => p.id === 'transporter')!;
const seller = PERSONAS.find((p) => p.id === 'seller')!;

test('ZZ: transporter sidebar — ratings/ads/diary/profile removed', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), transporter);
  await page.goto('/transporter');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const aside = page.locator('aside');
  const personaLabels = (await aside.locator('a').allTextContents()).map((t) => t.trim());
  console.log('TRANSPORTER_MENU=' + JSON.stringify(personaLabels));

  // Persona menu: cockpit, fleet and inbox remain; Profile removed.
  expect(personaLabels).toContain('Dashboard');
  expect(personaLabels).toContain('Vehicles and Drivers');
  expect(personaLabels).toContain('Booking Requests');
  expect(personaLabels).toContain('My Connections');
  expect(personaLabels).not.toContain('Profile');
  expect(personaLabels).not.toContain('Ratings');
  expect(personaLabels).not.toContain('Diary');
  const adsInMenu = personaLabels.filter((l) => l === 'Ads & Promotions').length;
  expect(adsInMenu).toBe(0);

  // Hubs: 15 entries — Ratings & Reviews, Ads & Promotions and My Diary hidden.
  const hubs = aside.getByText('Ecosystem Hubs', { exact: true }).locator('xpath=..');
  const hubLabels = (await hubs.locator('a').allTextContents()).map((t) => t.trim());
  console.log('TRANSPORTER_HUB_COUNT=' + hubLabels.length);
  expect(hubLabels.length).toBe(15);
  expect(hubLabels).not.toContain('Ratings & Reviews');
  expect(hubLabels).not.toContain('Ads & Promotions');
  expect(hubLabels).not.toContain('My Diary');

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('ZZ: transporter cockpit quick links — ratings/ads/diary/profile removed', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), transporter);
  await page.goto('/transporter');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  for (const kept of ['/transporter/fleet', '/transporter/inbox']) {
    await expect(page.locator(`main a[href="${kept}"]`).first()).toBeVisible();
  }
  for (const removed of ['/transporter/ratings', '/transporter/ads', '/transporter/diary', '/transporter/profile']) {
    await expect(page.locator(`main a[href="${removed}"]`)).toHaveCount(0);
  }

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('ZZ: transporter connections page renders with My Connections heading', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), transporter);
  await page.goto('/transporter/connections');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByRole('heading', { name: 'My Connections' })).toBeVisible();

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('ZZ: removed routes still render directly (deep links intact)', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), transporter);
  for (const route of ['/transporter/ratings', '/transporter/ads', '/transporter/diary', '/transporter/profile']) {
    await page.goto(route);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const body = await page.locator('body').textContent() ?? '';
    const blank = body.replace(/\s+/g, '').length < 50;
    console.log(`ROUTE ${route} renders=${!blank}`);
    expect(blank).toBe(false);
  }

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('ZZ: seller sidebar unaffected — hubs still 18', async ({ page }) => {
  await seedAuth(page.context(), seller);
  await page.goto('/seller');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const hubs = page.locator('aside').getByText('Ecosystem Hubs', { exact: true }).locator('xpath=..');
  const hubLabels = (await hubs.locator('a').allTextContents()).map((t) => t.trim());
  console.log('SELLER_HUB_COUNT=' + hubLabels.length);
  expect(hubLabels.length).toBe(18);
  expect(hubLabels).toContain('Ratings & Reviews');
  expect(hubLabels).toContain('Ads & Promotions');
});
