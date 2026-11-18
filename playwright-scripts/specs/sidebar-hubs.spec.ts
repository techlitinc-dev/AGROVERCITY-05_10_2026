import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;
const seller = PERSONAS.find((p) => p.id === 'seller')!;

const EXPECTED_HUBS = [
  'Agri Market',
  'Courses',
  'Agriculture News & Audio',
  'Payment & Transactions',
  'Ratings & Reviews',
  'Saved & Following',
  'AI Advisor',
  'Government Schemes',
  'Climate & Water',
  'My Land Records (7/12)',
  'My Diary',
  'AI Crop Scanner',
  'Tree Plantation',
  'Invite & Earn',
  'Ads & Promotions',
  'Profit & Loss',
  'Coins & Rewards',
  'Women Hub',
];

const EXPECTED_FARMER_MENU = [
  'Dashboard',
  'My Crops / माझी पिके',
  'AI Crop Plan / पीक नियोजन',
  'AI Doctor',
  'Rent Machinery',
  'My Produce / माझे उत्पादन',
  'Vyapari Requirement',
  'Rent Land',
  'My Connections / माझे संपर्क',
  'Mandi Prices / बाजारभाव',
  'Book Vehicle',
  ...EXPECTED_HUBS,
];

test('non-farmer sidebar keeps the 18 Ecosystem Hubs in order', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), seller);
  await page.goto('/seller');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const hubsSection = page
    .locator('aside')
    .getByText('Ecosystem Hubs', { exact: true })
    .locator('xpath=..');
  await expect(hubsSection).toBeVisible();

  const links = hubsSection.locator('a');
  expect(await links.count()).toBe(18);
  const labels: string[] = [];
  for (let i = 0; i < (await links.count()); i += 1) {
    labels.push((await links.nth(i).textContent())?.trim() ?? '');
  }
  expect(labels).toEqual(EXPECTED_HUBS);

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('farmer sidebar shows exactly the 29 approved features, no hubs block, no duplicates', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/farmer');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // No universal hubs section for farmer — everything lives in the farmer menu.
  await expect(page.locator('aside').getByText('Ecosystem Hubs', { exact: true })).toHaveCount(0);

  const allLinks = page.locator('aside a');
  expect(await allLinks.count()).toBe(29);
  const labels: string[] = [];
  for (let i = 0; i < (await allLinks.count()); i += 1) {
    labels.push((await allLinks.nth(i).textContent())?.trim() ?? '');
  }
  expect(labels).toEqual(EXPECTED_FARMER_MENU);

  // Removed / merged duplicates.
  for (const gone of [
    'Post to Buyers / खरेदीदारांना ऑफर',
    'Agri Export / कृषी निर्यात',
    'Farm Diary',
    'Weather & Water',
    'Kisan Coins',
    'Farmer Cockpit',
  ]) {
    await expect(page.locator('aside').getByText(gone)).toHaveCount(0);
  }

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('Ads & Promotions page renders with real campaign surface', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/ads');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await expect(
    page.getByRole('heading', { name: 'Ads & Promotions', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My Campaigns', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /create campaign/i })).toBeVisible();

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
