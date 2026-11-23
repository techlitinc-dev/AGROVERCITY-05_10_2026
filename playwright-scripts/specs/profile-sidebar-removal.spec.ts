import { test, expect } from '@playwright/test';
import { PERSONAS } from '../lib/personas';
import { seedAuth, perfShim } from '../lib/harness';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

// Personas whose sidebar used to carry a profile/verification entry.
// The routes stay reachable (deep links / home-page CTAs); only the sidebar
// entries were removed.
const SCOPED = ['seller', 'equipmentOwner', 'exporter', 'directBuyer', 'nursery', 'landlord'];

for (const id of SCOPED) {
  const persona = PERSONAS.find((p) => p.id === id)!;
  test(`${id} sidebar has no profile/verification entry`, async ({ page }) => {
    await seedAuth(page.context(), persona);
    await page.goto(persona.home);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const aside = page.locator('aside');
    const labels = (await aside.locator('a').allTextContents()).map((t) => t.trim());
    console.log(`${id.toUpperCase()}_MENU=` + JSON.stringify(labels));

    expect(
      labels.filter((l) => /profile|verification/i.test(l)),
      `sidebar still lists a profile/verification entry: ${labels.join(', ')}`
    ).toEqual([]);
  });
}

// Milk Vendor / Doodh Vala — the avatar dropdown (not the sidebar) used to
// carry the shared "My Profile" and "KYC Verification" links, and the global
// KYC nudge popup used to fire for the unverified vendor. Both are hidden
// for this persona. The /profile and /kyc routes themselves stay reachable.
test('milkSeller hides My Profile and KYC Verification everywhere in nav', async ({ page }) => {
  const persona = PERSONAS.find((p) => p.id === 'milkSeller')!;
  await seedAuth(page.context(), persona);
  await page.goto(persona.home);
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const aside = page.locator('aside');
  const asideLabels = (await aside.locator('a').allTextContents()).map((t) => t.trim());
  expect(
    asideLabels.filter((l) => /profile|verification/i.test(l)),
    `milk vendor sidebar lists a profile/verification entry: ${asideLabels.join(', ')}`
  ).toEqual([]);

  // The one-per-session KYC nudge popup must not fire for the milk vendor
  // (this account is unverified, so pre-change the popup covered the page).
  await page.waitForTimeout(800);
  expect(
    await page.getByRole('button', { name: /complete kyc now|remind me later/i }).count(),
    'milk vendor still gets the KYC nudge popup'
  ).toBe(0);

  // Avatar dropdown (top-right profile menu).
  await page.locator('header button:has(div.bg-emerald-700)').click();
  const menu = page.locator('header .absolute.right-0.mt-2.w-60');
  await menu.waitFor({ state: 'visible' });
  const labels = (await menu.locator('a, button').allTextContents()).map((t) => t.trim());
  console.log('MILKSELLER_MENU=' + JSON.stringify(labels));

  expect(
    labels.filter((l) => /^(my profile|kyc verification)$/i.test(l)),
    `milk vendor dropdown still lists My Profile / KYC Verification: ${labels.join(', ')}`
  ).toEqual([]);
  // The rest of the dropdown stays intact.
  expect(labels.some((l) => /settings & privacy/i.test(l))).toBe(true);
  expect(labels.some((l) => /sign out/i.test(l))).toBe(true);
});

// Guard against over-hiding: every other persona keeps both dropdown entries,
// and the KYC nudge popup still fires for other unverified personas.
test('other personas keep My Profile, KYC Verification and the nudge', async ({ page }) => {
  const persona = PERSONAS.find((p) => p.id === 'farmer')!;
  await seedAuth(page.context(), persona);
  await page.goto(persona.home);
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await page.locator('header button:has(div.bg-emerald-700)').click();
  const menu = page.locator('header .absolute.right-0.mt-2.w-60');
  await menu.waitFor({ state: 'visible' });
  const labels = (await menu.locator('a, button').allTextContents()).map((t) => t.trim());

  expect(labels.some((l) => /^my profile$/i.test(l))).toBe(true);
  expect(labels.some((l) => /^kyc verification$/i.test(l))).toBe(true);
});

test('other unverified personas still get the KYC nudge popup', async ({ page }) => {
  const persona = PERSONAS.find((p) => p.id === 'womenShg')!;
  await seedAuth(page.context(), persona);
  await page.goto(persona.home);
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await page.waitForTimeout(800);
  await expect(
    page.getByRole('button', { name: /complete kyc now|remind me later/i }).first()
  ).toBeVisible();
});
