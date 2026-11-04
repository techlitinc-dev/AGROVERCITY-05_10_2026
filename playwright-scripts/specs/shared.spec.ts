import { test } from '@playwright/test';
import { SHARED_ROUTES } from '../lib/personas';
import { seedAuth, walkPersona, assertClean, perfShim } from '../lib/harness';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

/** Shared account surfaces (notifications, KYC, chat, billing, …) walked as a farmer. */
const sharedPersona = {
  id: 'shared',
  label: 'Shared account surfaces',
  roleplay: 'Any signed-in user opening the common account pages from the app shell.',
  quickLogin: 'farmer',
  home: '/farmer',
  routes: SHARED_ROUTES,
};

test(`shared — ${SHARED_ROUTES.length} common pages (notifications, kyc, chat, billing, …)`, async ({ page }) => {
  await seedAuth(page.context(), sharedPersona);
  const report = await walkPersona(page, sharedPersona);
  assertClean(sharedPersona.label, report);
});
