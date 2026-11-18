import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

/** The 9 personas that must remain in every frontend picker. */
const KEPT = [
  /Farmer \/ Kisan/i,
  /Farm Landlord/i,
  /Transporter/i,
  /Agri Vyapari/i,
  /Equipment Owner/i,
  /Milk Vendor/i,
  /Mahila Gruh Udyog/i,
  /Gurukul Instructor/i,
  /Agri Market Seller/i,
];

/** The 5 personas removed from the frontend (routes stay, pickers hide them). */
const REMOVED = [
  /International Exporter/i,
  /Industrial Buyer/i,
  /Plant Nursery/i,
  /Cold Storage/i,
  /Gaushala/i,
  /E-Market Customer/i,
];

test('navbar persona switcher lists exactly the 9 kept personas', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/farmer');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await page.getByRole('button', { name: /farmer \/ kisan/i }).first().click();
  const menu = page.locator('header .w-72').first();
  await expect(menu).toBeVisible();

  const options = menu.getByRole('button');
  await expect(options).toHaveCount(9);
  for (const label of KEPT) {
    await expect(menu.getByText(label).first()).toBeVisible();
  }
  for (const label of REMOVED) {
    await expect(menu.getByText(label)).toHaveCount(0);
  }

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('switching to Agri Market Seller opens the Krishi Mall home cleanly', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/farmer');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await page.getByRole('button', { name: /farmer \/ kisan/i }).first().click();
  const menu = page.locator('header .w-72').first();
  await menu.getByText(/Agri Market Seller/i).first().click();

  await expect(page).toHaveURL(/\/customer/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // The quick-login account is shared with other suites — switch back so the
  // backend-active persona stays 'farmer' for seeded persona walks.
  await page.getByRole('button', { name: /agri market seller/i }).first().click();
  const menuBack = page.locator('header .w-72').first();
  await menuBack.getByText(/Farmer \/ Kisan/i).first().click();
  await expect(page).toHaveURL(/\/farmer/, { timeout: 15_000 });

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('profile-switch page lists exactly the 9 kept personas', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/profiles');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const main = page.locator('main, [role="main"], body').first();
  for (const label of KEPT) {
    await expect(main.getByText(label).first()).toBeVisible();
  }
  for (const label of REMOVED) {
    await expect(main.getByText(label)).toHaveCount(0);
  }

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
