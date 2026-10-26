/**
 * Module 2 — Home & Dashboard
 * TC-FRM-15: Web farmer home dashboard
 * TC-FRM-17: Today's farm actions — mark done / dismiss
 */
import { test, expect, FARMER } from '../fixtures/auth';

test.describe('Module 2 — Home & Dashboard', () => {
  test('TC-FRM-15: farmer home shows greeting, weather tile, KPI cards, launchpad', async ({ farmerPage: page }) => {
    await page.goto('/farmer');
    const main = page.getByRole('main');
    // Greeting + identity + 7/12 line
    await expect(main.getByRole('heading', { name: /ram ram, ramesh/i })).toBeVisible();
    await expect(main.getByText(/pimpalgaon baswant, nashik/i)).toBeVisible();
    // Weather tile with spray window
    await expect(main.getByText(/spray window/i)).toBeVisible();
    // KPI cards deep-link to the right routes
    const kpiChecks: [RegExp, RegExp][] = [
      [/active lots/i, /\/farmer\/lots/],
      [/live mandi rates/i, /\/farmer\/mandi/],
      [/booked transport/i, /\/farmer\/transport/],
      [/kisan coins/i, /\/farmer\/coins/],
    ];
    for (const [label, route] of kpiChecks) {
      await main.getByRole('link', { name: label }).first().click();
      await expect(page).toHaveURL(route);
      await page.goto('/farmer');
    }
    // Quick launchpad cards
    const launchpad = [/ai crop doctor/i, /post crop lot/i, /book gadi/i, /rent yantra/i, /farm diary/i];
    for (const label of launchpad) {
      await expect(main.getByRole('link', { name: label }).first()).toBeVisible();
    }
    // Nearby mandi section + tasks + advisory
    await expect(main.getByRole('heading', { name: /nearby mandi live rates/i })).toBeVisible();
    await expect(main.getByRole('heading', { name: /today's farm action/i })).toBeVisible();
    await expect(main.getByRole('heading', { name: /agronomist advisory/i })).toBeVisible();
  });

  test('TC-FRM-17: mark a farm action done, dismiss another', async ({ farmerPage: page }) => {
    await page.goto('/farmer');
    const main = page.getByRole('main');
    const doneChip = main.getByText(/\d+\/\d+ done/i);
    await expect(doneChip.first()).toBeVisible();
    const before = await doneChip.first().innerText();

    // Mark the first visible task done.
    await main.getByRole('button', { name: /mark done/i }).first().click();
    await expect
      .poll(async () => (await doneChip.first().innerText()) !== before, { timeout: 15_000 })
      .toBe(true);

    // Dismiss another task — list shrinks or chip total drops.
    const dismissButtons = main.getByRole('button', { name: /dismiss/i });
    if (await dismissButtons.count() > 0) {
      const tasksBefore = await main.getByRole('button', { name: /mark done/i }).count();
      await dismissButtons.first().click();
      await expect
        .poll(async () => (await main.getByRole('button', { name: /mark done/i }).count()) < tasksBefore, {
          timeout: 15_000,
        })
        .toBe(true);
    }
  });
});
