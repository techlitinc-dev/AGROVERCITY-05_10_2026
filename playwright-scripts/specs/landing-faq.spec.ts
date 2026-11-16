import { test, expect } from '@playwright/test';
import { perfShim, attachWatchers, Watch } from '../lib/harness';
import { BASE_URL } from '../lib/env';

/**
 * The landing FAQ ("Got Questions? We Have Answers.") is a searchable
 * accordion whose content is organized around the 9 finalized personas:
 * 18 Q&As (2 per persona), persona filter chips, and live text search.
 */

test.describe('landing FAQ — searchable 9-persona accordion', () => {
  test('persona chips and live search filter the answers', async ({ page, context }) => {
    await perfShim(context);
    const watch = new Watch();
    attachWatchers(page, watch);

    await page.goto(BASE_URL + '/');
    const faq = page.locator('#faqs');
    await expect(faq).toContainText('Got Questions? We Have Answers.', { timeout: 30_000 });

    const itemSelector = 'div.rounded-2xl.border.shadow-xs.overflow-hidden';
    const list = faq.locator('div.space-y-3').last();

    // "All" filter shows only the 5 latest questions (persona chips stay full)
    await expect(list.locator(itemSelector)).toHaveCount(5, { timeout: 15_000 });
    await expect(faq).toContainText('Showing the 5 latest questions');

    // Persona chip narrows to that persona's 2 questions
    await faq.getByRole('button', { name: '🪔 Women Hub', exact: true }).click();
    await expect(list.locator(itemSelector)).toHaveCount(2);
    await expect(faq).toContainText('How do SHG monthly savings and micro-loans work on the platform?');
    await faq.getByRole('button', { name: '🪔 Women Hub', exact: true }).click(); // toggle off

    // Back to "All" → capped at 5 again
    await expect(list.locator(itemSelector)).toHaveCount(5);

    // Live search matches FEATURE TAGS only (answer prose is excluded)
    await faq.getByPlaceholder('Search by feature or persona…').fill('escrow');
    await expect(list.locator(itemSelector)).toHaveCount(3);
    await expect(faq).toContainText('B2B Escrow guarantee 100% payment safety');

    // Search also matches persona labels
    await faq.getByPlaceholder('Search by feature or persona…').fill('vyapari');
    await expect(list.locator(itemSelector)).toHaveCount(2);

    // Answer-body prose is deliberately NOT searchable ("NDVI" appears only in the PMFBY answer)
    await faq.getByPlaceholder('Search by feature or persona…').fill('ndvi');
    await expect(faq).toContainText('No answers match your search');

    // Empty state for no matches
    await faq.getByPlaceholder('Search by feature or persona…').fill('zzzznotarealword');
    await expect(faq).toContainText('No answers match your search');

    expect(watch.pageErrors, 'uncaught page errors on FAQ interactions').toEqual([]);
  });
});
