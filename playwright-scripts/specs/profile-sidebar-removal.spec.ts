import { test, expect } from '@playwright/test';
import { PERSONAS } from '../lib/personas';
import { seedAuth, perfShim } from '../lib/harness';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

// Personas whose sidebar used to carry a profile/verification entry.
// The routes stay reachable (deep links / home-page CTAs); only the sidebar
// entries were removed.
const SCOPED = ['seller', 'equipmentOwner', 'exporter', 'directBuyer', 'nursery'];

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
