import { test } from '@playwright/test';
import { PERSONAS } from '../lib/personas';
import { seedAuth, walkPersona, assertClean, perfShim } from '../lib/harness';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

/**
 * One test per persona. Each walks EVERY option in that persona's website
 * navigation like a human would: open the page, let it render, flip tabs,
 * peek at create-dialogs, and record console errors + failed API calls.
 */
for (const persona of PERSONAS) {
  test(`${persona.id} — ${persona.label} walks all ${persona.routes.length} options`, async ({ page }) => {
    await seedAuth(page.context(), persona);
    const report = await walkPersona(page, persona);
    assertClean(persona.label, report);
  });
}
