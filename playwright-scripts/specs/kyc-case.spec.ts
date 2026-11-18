import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

test('KYC page shows verification for the active persona with no persona dropdown', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/kyc');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await expect(page.getByText('KYC Verification')).toBeVisible();
  // Active persona shown as a static label — no dropdown anywhere on the page.
  await expect(page.locator('select')).toHaveCount(0);
  await expect(page.getByText('Farmer / Kisan').first()).toBeVisible();

  // Other persona labels are not offered as choices.
  for (const label of [/Agri Vyapari/, /Transporter/, /Equipment Owner/, /Industrial Buyer/, /Instructor/, /Agri Market Seller/]) {
    await expect(page.getByText(label)).toHaveCount(0);
  }

  // Opening / refreshing the case still works for the active persona.
  await page.getByRole('button', { name: /open \/ refresh case/i }).click();
  await expect(page.getByText(/KYC case opened for farmer/i)).toBeVisible({ timeout: 15_000 });

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
