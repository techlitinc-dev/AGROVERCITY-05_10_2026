import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

test('profile page hides Persona Visibility and the removed Edit Profile fields', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await expect(page.getByText('Edit Profile')).toBeVisible();
  await expect(page.getByText('Persona Visibility')).toHaveCount(0);
  await expect(page.getByText('Vernacular name (नाम)')).toHaveCount(0);
  await expect(page.getByText('Alternate phone (10-digit)')).toHaveCount(0);
  await expect(page.getByText('Active crops (comma separated)')).toHaveCount(0);
  // Remaining fields still render.
  await expect(page.getByText('Full name')).toBeVisible();
  await expect(page.getByText('WhatsApp number (10-digit)')).toBeVisible();
  await expect(page.getByText('Land area (acres)')).toBeVisible();

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('profile save still works after the field removals', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const nameInput = page.locator('input[type="text"]').first();
  const original = await nameInput.inputValue();
  try {
    await nameInput.fill(`${original}`.trim() || 'Test Kisan');
    await page.getByRole('button', { name: /save profile/i }).click();
    await expect(page.getByText('Profile updated.')).toBeVisible({ timeout: 15_000 });
  } finally {
    // Restore the shared demo account's name.
    await nameInput.fill(original);
    await page.getByRole('button', { name: /save profile/i }).click();
    await expect(page.getByText('Profile updated.')).toBeVisible({ timeout: 15_000 });
  }

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
