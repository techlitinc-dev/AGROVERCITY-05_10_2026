import { test, expect } from '@playwright/test';
import { perfShim, attachWatchers, Watch } from '../lib/harness';
import { BASE_URL } from '../lib/env';

/**
 * The landing "Live Mandi Price Radar" must render genuinely dynamic prices
 * from the anonymous government open-data endpoint (GET /mandi/public/live),
 * with a reported-date/source label — never only the hardcoded benchmark rows.
 */

test.describe('landing mandi radar live feed', () => {
  test('anonymous visitors see live government mandi prices', async ({ page, context }) => {
    await perfShim(context);
    const watch = new Watch();
    attachWatchers(page, watch);

    let liveStatus = 0;
    page.on('response', (res) => {
      if (res.url().includes('/mandi/public/live')) liveStatus = res.status();
    });

    await page.goto(BASE_URL + '/');
    await expect(page.locator('body')).toContainText('Live Mandi Price Radar', { timeout: 30_000 });
    await expect(page.locator('body')).toContainText('Live feed · reported', { timeout: 30_000 });
    await expect(page.locator('body')).toContainText('APMC', { timeout: 30_000 });

    expect(liveStatus, 'GET /mandi/public/live should respond 200 for anonymous visitors').toBe(200);
    expect(watch.pageErrors, 'uncaught page errors on landing').toEqual([]);
  });
});
