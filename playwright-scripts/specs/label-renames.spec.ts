import { test, expect } from '@playwright/test';
import { seedAuth, perfShim, attachWatchers, Watch } from '../lib/harness';
import { BASE_URL } from '../lib/env';
import type { PersonaDef } from '../lib/personas';

/**
 * Verifies the feature-label rename pass: new names appear in navigation and
 * page headings, old names are gone, and every touched page still renders.
 */

const FARMER = {
  id: 'farmer',
  label: 'Farmer / Kisan',
  roleplay: 'smoke',
  quickLogin: 'farmer',
  home: '/farmer',
  routes: [],
} as unknown as PersonaDef;

const TRANSPORTER = {
  id: 'transporter',
  label: 'Transporter / Gadi',
  roleplay: 'smoke',
  quickLogin: 'transport',
  home: '/transporter',
  routes: [],
} as unknown as PersonaDef;

const NEW_SIDEBAR_LABELS = [
  'Agri Market',
  'AI Advisor (Kisan Mitra)',
  'AI Crop Scanner',
  'Agriculture News & Audio',
  'Government Schemes',
  'Weather & Water',
  'My Land Records (7/12)',
  'Tree Plantation',
  'Invite & Earn',
  'Payments & Transactions',
  'Ratings & Reviews',
  'Saved & Following',
];

const OLD_SIDEBAR_LABELS = [
  'Shopping Mall',
  'Govt Schemes',
  'Water & Weather',
  '7/12 Land Records',
  'Refer & Earn',
  'Tree Plantation Hub',
  'AI Scanner',
  'AI Agronomist',
];

const PAGE_HEADINGS: Array<[string, RegExp]> = [
  ['/community/trees', /Tree Plantation/],
  ['/mall', /Agri Market/],
  ['/community/scan', /AI Crop Scanner/],
  ['/community/ai', /AI Advisor/],
  ['/farmer/schemes', /Government Schemes/],
  ['/farmer/712', /My Land Records \(7\/12\)/],
  ['/farmer/water', /Weather & Water/],
  ['/farmer/referrals', /Invite & Earn/],
  ['/community/news', /Agriculture News & Audio/],
  ['/payments', /Payments & Transactions/],
  ['/ratings', /Ratings & Reviews/],
  ['/saved', /Saved & Following/],
];

test.describe('renamed labels — farmer workspace', () => {
  test.beforeEach(async ({ context }) => {
    await perfShim(context);
    await seedAuth(context, FARMER);
  });

  test('sidebar shows new names and not the old ones', async ({ page }) => {
    await page.goto(BASE_URL + '/farmer');
    const aside = page.locator('aside');
    await expect(aside).toBeVisible();
    for (const label of NEW_SIDEBAR_LABELS) {
      await expect(aside).toContainText(label);
    }
    for (const label of OLD_SIDEBAR_LABELS) {
      await expect(aside).not.toContainText(label);
    }
  });

  test('My Learning removed from Ecosystem Hubs but reachable via Courses', async ({ page }) => {
    const watch = new Watch();
    attachWatchers(page, watch);
    await page.goto(BASE_URL + '/farmer');
    const aside = page.locator('aside');
    await expect(aside).not.toContainText('My Learning');
    await expect(aside).toContainText('Courses');

    // flow preserved: Courses page exposes My Learning
    await page.goto(BASE_URL + '/academy');
    await page.getByRole('link', { name: /My Learning/ }).first().click();
    await expect(page).toHaveURL(/\/academy\/my-learning$/);
    await expect(page.locator('body')).toContainText('My Learning', { timeout: 30_000 });
    expect(watch.pageErrors).toEqual([]);
  });

  test('renamed pages render with their new headings', async ({ page }) => {
    const watch = new Watch();
    attachWatchers(page, watch);
    for (const [path, heading] of PAGE_HEADINGS) {
      await page.goto(BASE_URL + path);
      await expect(page.locator('body')).toContainText(heading, { timeout: 60_000 });
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '(\\?.*)?$'), { timeout: 30_000 });
    }
    expect(watch.pageErrors, 'uncaught page errors on renamed pages').toEqual([]);
  });
});

test.describe('renamed labels — transporter workspace', () => {
  test.beforeEach(async ({ context }) => {
    await perfShim(context);
    await seedAuth(context, TRANSPORTER);
  });

  test('advertisements renamed to Ads & Promotions', async ({ page }) => {
    const watch = new Watch();
    attachWatchers(page, watch);
    await page.goto(BASE_URL + '/transporter');
    const aside = page.locator('aside');
    await expect(aside).toContainText('Ads & Promotions');
    await expect(aside).not.toContainText('Advertisements');
    await page.goto(BASE_URL + '/transporter/ads');
    await expect(page.locator('h1').first()).toContainText('Ads & Promotions');
    expect(watch.pageErrors).toEqual([]);
  });
});
