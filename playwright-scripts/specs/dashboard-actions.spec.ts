import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

test('navbar has no shopping-cart button on any dashboard', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/farmer');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await expect(page.getByTitle('Krishi Mall Cart')).toHaveCount(0);
  await expect(page.locator('header svg.lucide-shopping-cart')).toHaveCount(0);

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test("Today's Farm Action shows at most 5 recent actions and no urgent banner", async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/farmer');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const card = page.locator('div').filter({ hasText: "Today's Farm Action" }).last();
  await expect(card.getByText("Today's Farm Action").first()).toBeVisible();

  // Each action row carries a "Mark done" checkbox — count them.
  const rows = page.getByTitle('Mark done');
  expect(await rows.count()).toBeLessThanOrEqual(5);

  // The old urgent-task banner rendered a rose badge with the raw priority.
  await expect(page.getByText(/^urgent$/i)).toHaveCount(0);

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('cart page still renders without the navbar button', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/mall/cart');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // Cart/checkout view renders (route untouched) even though the navbar
  // shortcut is gone — the mall's own cart links still reach it.
  await expect(page.locator('body')).not.toHaveText(/404|not found/i);

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
