import { test, expect } from '@playwright/test';
import { perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

test('profile editing: name locked on /profile, no profile card on /settings', async ({ page }) => {
  await seedAuth(page.context(), farmer);

  await page.goto('/profile');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByRole('heading', { name: 'Profile Details', exact: true })).toBeVisible();
  // Full name is static (locked); editable fields exist.
  await expect(page.getByText('Ram Singh (किसान)', { exact: true }).first()).toBeVisible();
  expect(await page.locator('input[type="email"]').count()).toBe(1);
  expect(await page.getByRole('button', { name: /save profile/i }).count()).toBe(1);

  await page.goto('/settings');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByRole('heading', { name: 'Profile' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'My Data Export' })).toBeVisible();
});
