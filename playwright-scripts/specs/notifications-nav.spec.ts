import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

const FAKE_NOTIFICATION = {
  id: 'ntf_navtest1',
  userId: 'dev-user-1',
  title: 'Mandi rate alert',
  body: 'Lasalgaon onion modal rate jumped today.',
  type: 'mandi',
  read: false,
  createdAt: '2026-11-18T05:00:00+00:00',
  data: { type: 'mandi', deepLink: '/dashboard/p/mandi' },
};

test('clicking a notification in the bell drawer opens its target page', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  // Serve one notification carrying a deepLink for every GET list call.
  await page.route('**/v1/notifications**', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [FAKE_NOTIFICATION], page: 1, pageSize: 50, total: 1 }),
    });
  });

  await seedAuth(page.context(), farmer);
  await page.goto('/farmer');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await page.locator('button[title="Notifications"]').first().click();
  const drawer = page.locator('text=Notifications').locator('xpath=ancestor::div[contains(@class,"shadow-2xl")]').first();
  await expect(drawer.getByText('Mandi rate alert')).toBeVisible();

  await drawer.getByText('Mandi rate alert').click();

  // /dashboard/p/mandi resolves through DeepLinkRedirect to the mandi page.
  await expect(page).toHaveURL(/\/farmer\/mandi/, { timeout: 15_000 });

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('clicking a notification in the full inbox opens its target page', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await page.route('**/v1/notifications**', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [FAKE_NOTIFICATION], page: 1, pageSize: 15, total: 1 }),
    });
  });

  await seedAuth(page.context(), farmer);
  await page.goto('/notifications');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await page.getByText('Mandi rate alert').click();
  await expect(page).toHaveURL(/\/farmer\/mandi/, { timeout: 15_000 });

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
