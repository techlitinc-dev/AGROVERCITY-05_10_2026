import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

test('My Crops: Update Stage saves through the real API and refreshes the card', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/farmer/crops');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // The cycle card renders with the Update Stage action.
  await page.getByRole('button', { name: /update stage/i }).first().click();

  // Modal opens (title = crop + season); its selects are unique on the page.
  await expect(page.getByText(/Update Soybean/)).toBeVisible();
  await page.locator('select').first().selectOption('harvest');
  await page.getByRole('button', { name: /save update/i }).click();

  // Success notice + the card re-renders at the new stage.
  await expect(page.getByText('Crop cycle updated.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Harvest \/ काढणी/).first()).toBeVisible();

  // Put the cycle back to a growing stage so the demo data stays sensible.
  await page.getByRole('button', { name: /update stage/i }).first().click();
  await expect(page.getByText(/Update Soybean/)).toBeVisible();
  await page.locator('select').first().selectOption('germination');
  await page.getByRole('button', { name: /save update/i }).click();
  await expect(page.getByText('Crop cycle updated.')).toBeVisible({ timeout: 15_000 });

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
