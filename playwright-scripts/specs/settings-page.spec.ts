import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

test('settings page shows only the kept sections', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/settings');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // Kept sections.
  for (const heading of ['My Data Export', 'Blocked Users', 'Change MPIN']) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /sign out on this device/i })).toBeVisible();

  // Removed sections.
  for (const heading of ['Profile', 'App Preferences', 'Data Consents', 'Active Sessions', 'Ratings & Reviews']) {
    await expect(page.getByRole('heading', { name: heading })).toHaveCount(0);
  }

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('navbar profile menu has no Billing & Plans entry', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/farmer');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await page.locator('header button:has(div.rounded-xl.bg-emerald-700)').first().click();
  const menu = page.locator('header .absolute').last();
  await expect(menu.getByText('Settings & Privacy')).toBeVisible();
  await expect(menu.getByText('Billing & Plans')).toHaveCount(0);
  await expect(menu.getByText('KYC Verification')).toBeVisible();

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('settings page has no editable profile card', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/settings');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await expect(page.getByRole('heading', { name: 'Profile' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /save profile/i })).toHaveCount(0);
  await expect(page.locator('input[type="text"]')).toHaveCount(0);

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
