import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

const ADDR_1 = {
  id: 'addr_home1',
  label: 'Home',
  customLabel: null,
  line1: 'Gat 312, Pimpalgaon Baswant',
  landmark: 'Near Shiva Mandir',
  village: 'Pimpalgaon Baswant',
  district: 'Nashik',
  state: 'Maharashtra',
  pincode: '422209',
  isDefault: true,
};

const ADDR_2 = {
  id: 'addr_farm1',
  label: 'Farm',
  customLabel: null,
  line1: 'Survey 45/2, Niphad Road',
  village: 'Niphad',
  district: 'Nashik',
  state: 'Maharashtra',
  pincode: '422303',
  isDefault: false,
};

test('edit profile shows the Zomato-style saved addresses list', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  let rows: unknown[] = [ADDR_1, ADDR_2];
  await page.route('**/v1/addresses**', (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: rows }),
      });
    }
    if (req.method() === 'DELETE') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }
    return route.continue();
  });

  await seedAuth(page.context(), farmer);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await expect(page.getByRole('heading', { name: 'Saved Addresses', exact: true })).toBeVisible();
  await expect(page.getByText('Home').first()).toBeVisible();
  await expect(page.getByText('Farm').first()).toBeVisible();
  await expect(page.getByText('Gat 312, Pimpalgaon Baswant')).toBeVisible();
  await expect(page.getByText('Default', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /add new/i })).toBeVisible();

  // Set-as-default on the Farm address.
  await page.route('**/v1/addresses/addr_farm1', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ...ADDR_2, isDefault: true } }),
    })
  );
  await page.getByRole('button', { name: 'Set as default' }).click();
  await expect(page.locator('li').filter({ hasText: 'Farm' }).getByText('Default')).toBeVisible();

  // Delete the Home address (accept the confirm dialog).
  page.once('dialog', (d) => void d.accept());
  rows = [ADDR_2];
  await page
    .locator('li')
    .filter({ hasText: 'Home' })
    .getByTitle('Delete')
    .click();
  await expect(page.getByText('Gat 312, Pimpalgaon Baswant')).toHaveCount(0);

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('add-new opens the shared address picker modal', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await page.route('**/v1/addresses**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    }
    return route.continue();
  });

  await seedAuth(page.context(), farmer);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await expect(page.getByText(/No saved addresses yet/)).toBeVisible();
  await page.getByRole('button', { name: /add new/i }).click();

  // The shared AddressPicker modal opens (its own form is covered by its own flows).
  await expect(page.getByText(/add.*address|new address/i).first()).toBeVisible();

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
