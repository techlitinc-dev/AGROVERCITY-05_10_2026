import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

test('KYC case dropdown offers only the active persona', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/kyc');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const select = page.locator('select').first();
  await expect(select).toBeVisible();

  // Exactly one option — the active persona.
  const options = select.locator('option');
  expect(await options.count()).toBe(1);
  await expect(options.first()).toHaveText('Farmer / Kisan');
  await expect(select).toHaveValue('farmer');

  // Other persona labels are gone from the picker.
  for (const label of [/Agri Vyapari/, /Transporter/, /Equipment Owner/, /Industrial Buyer/, /Instructor/, /Agri Market Seller/]) {
    await expect(select.getByText(label)).toHaveCount(0);
  }

  // Opening / refreshing the case still works for the active persona.
  await page.getByRole('button', { name: /open \/ refresh case/i }).click();
  await expect(page.getByText(/KYC case opened for farmer/i)).toBeVisible({ timeout: 15_000 });

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
