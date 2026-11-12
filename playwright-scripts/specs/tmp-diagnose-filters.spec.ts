/**
 * TEMPORARY diagnostic v2 — correct request capture + save journey.
 */
import { test, expect } from '@playwright/test';
import { PERSONA_MAP } from '../lib/personas';
import { seedAuth, perfShim } from '../lib/harness';
import { BASE_URL } from '../lib/env';

test('diagnose v2: request ordering + save journey', async ({ browser }) => {
  const context = await browser.newContext();
  await perfShim(context);
  await seedAuth(context, PERSONA_MAP.get('farmer')!);
  const page = await context.newPage();

  const reqs: string[] = [];
  page.on('response', async (r) => {
    if (r.url().includes('/v1/courses') && r.url().includes('search=')) {
      const body = await r.json().catch(() => null);
      reqs.push(
        `${r.url().split('/v1/courses?')[1]} -> total=${body?.total} (${(body?.data || []).map((c: { title: string }) => c.title.slice(0, 12)).join(', ')})`,
      );
    }
  });

  await page.goto(BASE_URL + '/academy');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(800);

  // Type "drip" fast like a real user.
  const search = page.getByPlaceholder(/Search crop/);
  await search.click();
  await search.pressSequentially('drip', { delay: 90 });
  await page.waitForTimeout(3_000);
  console.log('SEARCH request/response order:');
  reqs.forEach((r) => console.log('  ', r));

  const catalogCount = await page.getByRole('button', { name: 'Save for later' }).count();
  console.log('catalog cards with Save button:', catalogCount);

  // SAVE journey: save the first catalog course, then check Saved tabs.
  await search.fill('');
  await page.waitForTimeout(1_500);
  const firstSave = page.getByRole('button', { name: 'Save for later' }).first();
  const card = page.locator('div.grid > div').filter({ has: firstSave }).first();
  const title = (await card.locator('h3').innerText()).trim();
  console.log('saving course:', title);
  await firstSave.click();
  await expect(page.getByText(/Saved .+ for later|Removed .+ from saved/)).toBeVisible({ timeout: 8_000 });
  await page.waitForTimeout(1_000);

  // My Learning -> Saved Courses tab.
  await page.goto(BASE_URL + '/academy/my-learning?tab=saved');
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
  console.log('My Learning -> Saved tab SHOWS the course ✓');

  // Instructors -> Saved Courses tab.
  await page.goto(BASE_URL + '/academy/instructors?tab=saved');
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
  console.log('Instructors -> Saved Courses tab SHOWS the course ✓');

  // Reset: unsave from My Learning Saved tab (Remove button).
  await page.goto(BASE_URL + '/academy/my-learning?tab=saved');
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  const removeBtn = page.getByRole('button', { name: /Remove/ }).first();
  if (await removeBtn.isVisible().catch(() => false)) {
    await removeBtn.click();
    await expect(page.getByText(/Removed .+ from saved courses/)).toBeVisible({ timeout: 8_000 });
    console.log('unsave via Remove button works ✓');
  }

  await context.close();
});
