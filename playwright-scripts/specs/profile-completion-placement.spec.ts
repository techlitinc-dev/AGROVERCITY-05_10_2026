import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

/** A fully-filled profile (15/15) for the "complete" scenario. */
const COMPLETE_ME = {
  id: 'dev-user-1',
  name: 'Ram Singh',
  phone: '+919999999999',
  kycStatus: 'verified',
  email: 'ram@example.com',
  dateOfBirth: '1985-06-15',
  gender: 'male',
  whatsapp: '9898989898',
  addressLine: 'Gat 312',
  village: 'Pimpalgaon Baswant',
  district: 'Nashik',
  state: 'Maharashtra',
  pincode: '422209',
  landAreaAcres: 4.5,
  soilType: 'Black Cotton',
  irrigationType: 'Drip',
  photoUrl: 'https://example.com/photo.jpg',
};

test('incomplete profile: nudge shows on home, bar hidden on My Profile', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await seedAuth(page.context(), farmer);
  await page.goto('/farmer');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // The seeded demo farmer is incomplete — home shows the nudge.
  const nudge = page.getByText(/Profile \d+% complete/);
  await expect(nudge).toBeVisible();
  await expect(page.getByRole('link', { name: /complete profile/i })).toBeVisible();
  await expect(page.getByText(/Add .* to reach 100%/)).toBeVisible();

  // Click through to My Profile — the completion bar is NOT there.
  await page.getByRole('link', { name: /complete profile/i }).click();
  await expect(page).toHaveURL(/\/profile/, { timeout: 15_000 });
  await expect(page.getByText('Profile Completion')).toHaveCount(0);

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('complete profile: bar shows on My Profile, nudge hidden on home', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await page.route('**/v1/users/me', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: COMPLETE_ME }),
    });
  });

  await seedAuth(page.context(), farmer);
  await page.goto('/farmer');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // Complete — no nagging on the dashboard.
  await expect(page.getByText(/Profile \d+% complete/)).toHaveCount(0);

  await page.goto('/profile');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByText('Profile Completion')).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await expect(page.getByText(/15 of 15 completed — your profile is complete!/)).toBeVisible();

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
