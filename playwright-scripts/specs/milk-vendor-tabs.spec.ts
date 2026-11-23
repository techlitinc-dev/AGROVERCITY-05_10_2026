import { test, expect } from '@playwright/test';
import { PERSONAS } from '../lib/personas';
import { seedAuth, perfShim } from '../lib/harness';

/**
 * Milk vendor sidebar navigation must switch the rendered desk tab on every
 * click — no refresh needed. Regression guard for the initialTab bug: route
 * changes reused the mounted desk component and ignored the new initialTab
 * prop until a full reload.
 */

const persona = PERSONAS.find((p) => p.id === 'milkSeller')!;

const activeVendorDeskTab = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const active = document.querySelector('main nav button.bg-emerald-600');
    return active?.textContent?.trim() ?? null;
  });

const activeLegacyDeskTab = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const active = document.querySelector('main .bg-slate-100 button.bg-white');
    return active?.textContent?.trim() ?? null;
  });

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

test('vendor desk family: each sidebar click switches the page without refresh', async ({ page }) => {
  await seedAuth(page.context(), persona);
  await page.goto('http://localhost:5173/milkSeller/vendor');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // [sidebar label, expected URL, expected desk tab]
  const cases: Array<[string, string, string]> = [
    ['Todays Schedule', '/milkSeller/vendor', 'Today'],
    ['Clients', '/milkSeller/vendor/clients', 'Clients'],
    ['Bills & Payments', '/milkSeller/vendor/bills', 'Bills & Payments'],
    ['Milk and Rates', '/milkSeller/vendor/rates', 'Milk & Rates'],
    ['Todays Schedule', '/milkSeller/vendor', 'Today'],
  ];

  for (const [label, path, expectedTab] of cases) {
    await page.locator('aside a', { hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
    // Poll for the expected tab (not just any tab) — the desk re-applies the
    // route's tab in a passive effect after navigation.
    await expect
      .poll(async () => (await activeVendorDeskTab(page)) ?? '', { timeout: 5_000 })
      .toContain(expectedTab);
  }
});

test('legacy desk family: each sidebar click switches the page without refresh', async ({ page }) => {
  await seedAuth(page.context(), persona);
  await page.goto('http://localhost:5173/milkSeller');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // [sidebar label, expected URL, expected desk tab]
  const cases: Array<[string, string, string]> = [
    ['Customer Passbook', '/milkSeller/clients', 'Clients'],
    ['Monthly Billing and Pay', '/milkSeller/bills', 'Bills'],
    ['Delivery Analytics', '/milkSeller/analytics', 'Analytics'],
    ['Punch Sheet', '/milkSeller', 'Deliveries'],
  ];

  for (const [label, path, expectedTab] of cases) {
    await page.locator('aside a', { hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
    await expect
      .poll(async () => (await activeLegacyDeskTab(page)) ?? '', { timeout: 5_000 })
      .toContain(expectedTab);
  }
});
