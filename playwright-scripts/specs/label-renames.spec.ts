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

/** Milk Vendor / Doodh Vala — the ecosystem hubs block rendered in its sidebar. */
const MILKSELLER = {
  id: 'milkSeller',
  label: 'Milk Vendor / Doodh Vala',
  roleplay: 'smoke',
  onboard: { phone: '+919100000102', name: 'PW Test Milk Vendor' },
  home: '/milkSeller',
  routes: [],
} as unknown as PersonaDef;

/** Gurukul (instructor) — persona sequence in its sidebar. */
const INSTRUCTOR = {
  id: 'instructor',
  label: 'Gurukul Instructor',
  roleplay: 'smoke',
  onboard: { phone: '+919100000104', name: 'PW Test Instructor' },
  home: '/instructor/home',
  routes: [],
} as unknown as PersonaDef;

// Dashboard added; Academy Studio → Academic Studio; Course Builder and
// Batches & Questions were already exact. Locked in the agreed order.
const INSTRUCTOR_SEQUENCE = ['Dashboard', 'Academic Studio', 'Course Builder', 'Batches & Questions'];

// Agreed rename map (Shopping Mall → Agri Market, AI Agronomist → AI Advisor,
// Water & Weather → Climate & Water, Kisan Coin → Coins & Rewards, …) in the
// agreed sidebar order. Locked for the milk vendor workspace.
const MILKSELLER_HUB_LABELS = [
  'Agri Market',
  'Courses',
  'Agriculture News & Audio',
  'Payment & Transactions',
  'Ratings & Reviews',
  'Saved & Following',
  'AI Advisor',
  'Government Schemes',
  'Climate & Water',
  'My Land Records (7/12)',
  'My Diary',
  'AI Crop Scanner',
  'Tree Plantation',
  'Invite & Earn',
  'Ads & Promotions',
  'Profit & Loss',
  'Coins & Rewards',
  'Women Hub',
];

// Agreed persona sequence: new Dashboard first, Today → Todays Schedule,
// Milk & Rates → Milk and Rates, Daily Delivery Punch-Sheet → Punch Sheet,
// Customer Passbooks → Customer Passbook, Monthly Billing & Pay →
// Monthly Billing and Pay; Settings removed from the sidebar.
const MILKSELLER_SEQUENCE = [
  'Dashboard',
  'Todays Schedule',
  'Clients',
  'Bills & Payments',
  'Milk and Rates',
  'Punch Sheet',
  'Customer Passbook',
  'Monthly Billing and Pay',
  'Delivery Analytics',
];

const MILKSELLER_RENAMED_AWAY = [
  'Today',
  'Daily Delivery Punch-Sheet',
  'Customer Passbooks',
  'Milk & Rates',
  'Monthly Billing & Pay',
  'Settings',
];

const MILKSELLER_OLD_LABELS = [
  'Shopping Mall',
  'Govt Schemes',
  'Water & Weather',
  '7/12 Land Records',
  'Refer & Earn',
  'Tree Plantation Hub',
  'AI Scanner',
  'AI Agronomist',
  'Kisan Coin',
];

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

test.describe('renamed labels — instructor workspace', () => {
  test.beforeEach(async ({ context }) => {
    await perfShim(context);
    await seedAuth(context, INSTRUCTOR);
  });

  test('sidebar shows the agreed instructor sequence in order', async ({ page }) => {
    await page.goto(BASE_URL + '/instructor/home');
    const aside = page.locator('aside');
    await expect(aside).toBeVisible();

    const labels = (await aside.locator('a').allTextContents()).map((t) => t.trim());

    const positions = INSTRUCTOR_SEQUENCE.map((l) => labels.indexOf(l));
    expect(positions.filter((i) => i < 0), 'missing instructor entries').toEqual([]);
    for (const label of INSTRUCTOR_SEQUENCE) {
      expect(labels.filter((l) => l === label), `duplicate instructor entry: ${label}`).toHaveLength(1);
    }
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    await expect(aside).not.toContainText('Academy Studio');
  });
});

test.describe('renamed labels — milk vendor workspace', () => {
  test.beforeEach(async ({ context }) => {
    await perfShim(context);
    await seedAuth(context, MILKSELLER);
  });

  test('sidebar shows the agreed hub names in the agreed order', async ({ page }) => {
    await page.goto(BASE_URL + '/milkSeller');
    const aside = page.locator('aside');
    await expect(aside).toBeVisible();

    const labels = (await aside.locator('a').allTextContents()).map((t) => t.trim());

    // Persona sequence: present, exactly once each, in the agreed order.
    const seqPositions = MILKSELLER_SEQUENCE.map((l) => labels.indexOf(l));
    expect(seqPositions.filter((i) => i < 0), 'missing persona entries').toEqual([]);
    for (const label of MILKSELLER_SEQUENCE) {
      expect(labels.filter((l) => l === label), `duplicate persona entry: ${label}`).toHaveLength(1);
    }
    expect(seqPositions).toEqual([...seqPositions].sort((a, b) => a - b));

    // Renamed-away labels (and Settings) are gone from the sidebar.
    for (const label of MILKSELLER_RENAMED_AWAY) {
      expect(labels, `sidebar still lists: ${label}`).not.toContain(label);
    }

    // All 18 agreed hub labels are present…
    const positions = MILKSELLER_HUB_LABELS.map((l) => labels.indexOf(l));
    expect(positions.filter((i) => i < 0), 'missing hub labels').toEqual([]);

    // …exactly once each, and in the agreed order.
    for (const label of MILKSELLER_HUB_LABELS) {
      expect(labels.filter((l) => l === label), `duplicate hub label: ${label}`).toHaveLength(1);
    }
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    for (const label of MILKSELLER_OLD_LABELS) {
      await expect(aside).not.toContainText(label);
    }
  });
});
