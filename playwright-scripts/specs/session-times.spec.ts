import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

test('navbar shows log in and last log out times', async ({ page, context }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await context.addInitScript(() => {
    localStorage.setItem('agrovercity_last_login', '2026-11-18T09:15:00+05:30');
    localStorage.setItem('agrovercity_last_logout', '2026-11-17T18:30:00+05:30');
  });
  await seedAuth(context, farmer);
  await page.goto('/farmer');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const chip = page.locator('div[title*="Logged in"]').first();
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('In 09:15');
  await expect(chip).toContainText('Out 18:30');
  await expect(chip).toHaveAttribute('title', /Last logout/);

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('fresh session without timestamps shows dashes honestly', async ({ page, context }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(context, farmer);
  await page.goto('/farmer');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const chip = page.locator('div[title*="Logged in"]').first();
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('In —');
  await expect(chip).toContainText('Out —');

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
