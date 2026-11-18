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
  for (const heading of ['Profile', 'My Data Export', 'Blocked Users', 'Change MPIN']) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /sign out on this device/i })).toBeVisible();

  // Removed sections.
  for (const heading of ['App Preferences', 'Data Consents', 'Active Sessions', 'Ratings & Reviews']) {
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

test('settings profile save still works after the removals', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/settings');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const nameInput = page.locator('input[type="text"]').first();
  const original = await nameInput.inputValue();
  try {
    await nameInput.fill(original.trim() || 'Test Kisan');
    await page.getByRole('button', { name: /save profile/i }).click();
    await expect(page.getByText('Profile updated.')).toBeVisible({ timeout: 15_000 });
  } finally {
    await nameInput.fill(original);
    await page.getByRole('button', { name: /save profile/i }).click();
    await expect(page.getByText('Profile updated.')).toBeVisible({ timeout: 15_000 });
  }

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
