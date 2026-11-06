import { test, expect } from '@playwright/test';
import { seedAuth, perfShim, attachWatchers, Watch } from '../lib/harness';
import { BASE_URL, SUPERADMIN_URL } from '../lib/env';
import type { PersonaDef } from '../lib/personas';

/**
 * Regression guard for the "7 pages + Mahila Gruh Udyog hub" frontend removal.
 * Asserts the pages are gone from navigation, their URLs redirect somewhere
 * safe (no 404 / blank), and the surrounding flows still render.
 */

const FARMER = {
  id: 'farmer',
  label: 'Farmer / Kisan',
  roleplay: 'smoke',
  quickLogin: 'farmer',
  home: '/farmer',
  routes: [],
} as unknown as PersonaDef;

const REMOVED_SIDEBAR_LABELS = [
  'Pashu Dhan',
  'Mahila Bachat Gat',
  'KCC & Agri Loans',
  'Bank Accounts',
  'PMFBY Crop Insurance',
  'Document Vault',
  'Carbon Footprint & Eco',
];

const REDIRECTS: Array<[string, RegExp]> = [
  ['/farmer/loans', /\/farmer$/],
  ['/farmer/loans/abc', /\/farmer$/],
  ['/farmer/bank-accounts', /\/farmer$/],
  ['/farmer/insurance', /\/farmer$/],
  ['/farmer/insurance/policies', /\/farmer$/],
  ['/farmer/insurance/claims/abc', /\/farmer$/],
  ['/farmer/vault', /\/farmer$/],
  ['/farmer/livestock', /\/farmer$/],
  ['/community/carbon', /\/community\/trees$/],
  ['/community/women', /\/mall$/],
  ['/womenShg', /\/mall$/],
  ['/womenShg/products', /\/mall$/],
  ['/womenShg/savings', /\/mall$/],
  ['/gruhUdyog', /\/mall$/],
  ['/women/directory', /\/mall$/],
  ['/bank-accounts', /\/profile$/],
];

test.describe('removed pages stay unreachable', () => {
  test.beforeEach(async ({ context }) => {
    await perfShim(context);
    await seedAuth(context, FARMER);
  });

  test('farmer sidebar no longer lists the removed pages', async ({ page }) => {
    await page.goto(BASE_URL + '/farmer');
    await expect(page).toHaveURL(/\/farmer$/);
    const aside = page.locator('aside');
    await expect(aside).toBeVisible();
    for (const label of REMOVED_SIDEBAR_LABELS) {
      await expect(aside).not.toContainText(label);
    }
    // surrounding entries survive
    for (const label of ['Farmer Cockpit', 'Govt Schemes', 'Tree Plantation Hub', '7/12 Land Records']) {
      await expect(aside).toContainText(label);
    }
  });

  test('removed routes redirect instead of rendering', async ({ page }) => {
    const watch = new Watch();
    attachWatchers(page, watch);
    for (const [path, pattern] of REDIRECTS) {
      await page.goto(BASE_URL + path);
      await expect(page).toHaveURL(pattern, { timeout: 30_000 });
    }
    expect(watch.pageErrors, 'uncaught page errors while walking redirects').toEqual([]);
  });

  test('core flows still render', async ({ page }) => {
    const watch = new Watch();
    attachWatchers(page, watch);

    await page.goto(BASE_URL + '/farmer');
    await expect(page.locator('main, [role=main]').first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/Welcome back to your farm cockpit/i);

    await page.goto(BASE_URL + '/farmer/schemes');
    await expect(page.locator('body')).toContainText('Govt Schemes');
    await expect(page.locator('body')).not.toContainText('Document Vault');

    await page.goto(BASE_URL + '/community/trees');
    await expect(page.locator('body')).toContainText('Tree Plantation Hub');
    await expect(page.locator('body')).not.toContainText('Carbon Footprint');

    await page.goto(BASE_URL + '/mall');
    await expect(page.locator('body')).not.toContainText('Explore the women hub');

    await page.goto(BASE_URL + '/farmer/lots');
    await expect(page.locator('body')).toContainText('Produce');

    expect(watch.pageErrors, 'uncaught page errors on core flows').toEqual([]);
  });

  test('profile dropdown no longer offers Bank Accounts', async ({ page }) => {
    await page.goto(BASE_URL + '/farmer');
    await page.getByRole('button', { name: /Ram/ }).first().click();
    await expect(page.locator('body')).toContainText('KYC Verification');
    await expect(page.locator('body')).not.toContainText('Bank Accounts');
  });
});

test.describe('superadmin surfaces', () => {
  test('standalone superadmin app hides removed persona desks', async ({ page }) => {
    const watch = new Watch();
    attachWatchers(page, watch);
    await page.goto(SUPERADMIN_URL + '/');
    const body = page.locator('body');
    await expect(body).toContainText('Farmer Governance', { timeout: 30_000 });
    for (const label of ['Livestock Hub', 'Mahila Graha Udyog', 'Banking & Insurance']) {
      await expect(body).not.toContainText(label);
    }
    expect(watch.pageErrors, 'uncaught page errors on standalone superadmin').toEqual([]);
  });
});
