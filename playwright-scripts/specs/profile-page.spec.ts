import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

test('profile details: full name is locked, every other field is editable', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await expect(page.getByRole('heading', { name: 'Profile Details', exact: true })).toBeVisible();

  // Full name: static text + lock note, no input.
  await expect(page.getByText('Ram Singh (किसान)', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Set at registration — contact support to change/)).toBeVisible();
  await expect(page.locator('input').first()).not.toHaveValue('Ram Singh (किसान)');

  // The other fields are real editable inputs.
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible();
  await emailInput.click();
  await emailInput.pressSequentially('r@gmail.com', { delay: 30 });
  expect(await emailInput.inputValue()).toContain('r@gmail.com');
  await emailInput.fill('');

  await expect(page.getByRole('button', { name: /save profile/i })).toBeVisible();

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('editable fields save and stick (name untouched)', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // Name stays locked.
  await expect(page.getByText('Ram Singh (किसान)', { exact: true }).first()).toBeVisible();

  // Edit the Village field and save.
  const villageInput = page.locator('input[type="text"]').nth(1); // 0 = address line, 1 = village
  const originalVillage = await villageInput.inputValue();
  await villageInput.fill(`${originalVillage} Edited`);
  await page.getByRole('button', { name: /save profile/i }).click();
  await expect(page.getByText('Profile updated.')).toBeVisible({ timeout: 15_000 });

  // Client-side round trip keeps the new value.
  await page.locator('aside a', { hasText: 'Dashboard' }).first().click();
  await expect(page).toHaveURL(/\/farmer/, { timeout: 15_000 });
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Profile Details', exact: true })).toBeVisible();
  expect(await page.locator('input[type="text"]').nth(1).inputValue()).toBe(`${originalVillage} Edited`);

  // restore
  await page.locator('input[type="text"]').nth(1).fill(originalVillage);
  await page.getByRole('button', { name: /save profile/i }).click();
  await expect(page.getByText('Profile updated.')).toBeVisible({ timeout: 15_000 });

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('View Profile shows read-only registration details in a modal', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await page.getByRole('button', { name: /view profile/i }).click();

  await expect(page.getByText('Registration Details', { exact: true })).toBeVisible();
  await expect(page.getByText(/The details used when you registered/)).toBeVisible();
  await expect(page.getByText('Full name', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Ram Singh (किसान)', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Phone', { exact: true })).toBeVisible();
  await expect(page.getByText('Registered personas', { exact: true })).toBeVisible();
  await expect(page.getByText('Member since', { exact: true })).toBeVisible();
  await expect(page.getByText('KYC status', { exact: true })).toBeVisible();

  // Read-only: the modal contains no inputs.
  const modal = page.locator('div').filter({ hasText: 'Registration Details' }).last();
  expect(await modal.locator('input').count()).toBe(0);

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Registration Details', { exact: true })).toHaveCount(0);

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('saved addresses still manage from the profile page', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await page.route('**/v1/addresses**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    }
    return route.continue();
  });

  await seedAuth(page.context(), farmer);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await expect(page.getByRole('heading', { name: 'Saved Addresses', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /add new/i })).toBeVisible();

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
