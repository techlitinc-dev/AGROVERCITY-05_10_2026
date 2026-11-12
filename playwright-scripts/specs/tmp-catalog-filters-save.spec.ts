/**
 * Temporary verification — Learn page (/academy) filters/search hardened, and
 * saved courses must appear in every Saved option.
 * Run: npx playwright test specs/tmp-catalog-filters-save.spec.ts
 */
import { test, expect, type Browser } from '@playwright/test';
import { PERSONA_MAP } from '../lib/personas';
import { seedAuth, perfShim } from '../lib/harness';
import { BASE_URL } from '../lib/env';

async function boot(browser: Browser, personaId: string) {
  const context = await browser.newContext();
  await perfShim(context);
  await seedAuth(context, PERSONA_MAP.get(personaId)!);
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  return { context, page, pageErrors };
}

test.describe.configure({ mode: 'serial' });

test.describe('Learn page filters + save display', () => {
  test('farmer: search/filters work, recommended respects filters, categories stay stable', async ({ browser }) => {
    const { context, page, pageErrors } = await boot(browser, 'farmer');
    await page.goto(BASE_URL + '/academy');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);

    // Baseline: 4 catalog cards (Save for later buttons), recommended visible.
    await expect(page.getByText('Recommended for you')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Save for later' })).toHaveCount(4, { timeout: 20_000 });

    // Rapid type-ahead: "drip" typed fast → debounced to ONE final state.
    const search = page.getByPlaceholder(/Search crop/);
    await search.click();
    await search.pressSequentially('drip', { delay: 60 });
    await expect(page.getByText('Recommended for you')).toBeHidden({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Save for later' })).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByText('Drip Irrigation Automation')).toBeVisible();

    // Free checkbox on top of search "drip" → drip is paid → empty state.
    await page.getByRole('checkbox', { name: 'Free', exact: true }).check();
    await expect(page.getByText('No published courses match your filters.')).toBeVisible({ timeout: 15_000 });

    // Category dropdown still offers all options even with 0 results.
    const select = page.locator('select').first();
    await expect(select.locator('option')).toHaveText(['All', 'Organic Farming', 'Greenhouse & Hydroponics', 'Livestock & Dairy', 'Machinery & Automation']);
    await select.selectOption('Machinery & Automation');
    await page.getByRole('checkbox', { name: 'Free', exact: true }).uncheck();
    await search.fill('');
    await expect(page.getByText('No published courses match your filters.')).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Save for later' })).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByText('Drip Irrigation Automation')).toBeVisible();

    // Reset filters.
    await select.selectOption('All');
    await page.getByRole('checkbox', { name: 'Free', exact: true }).uncheck();
    await expect(page.getByRole('button', { name: 'Save for later' })).toHaveCount(4, { timeout: 15_000 });
    await expect(page.getByText('Recommended for you')).toBeVisible();

    expect(pageErrors).toEqual([]);
    await context.close();
  });

  test('farmer: save a course → appears in BOTH Saved options → remove → gone', async ({ browser }) => {
    const { context, page, pageErrors } = await boot(browser, 'farmer');

    // Deterministic start: remove anything this account already saved.
    await page.goto(BASE_URL + '/academy');
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
    const token = await page.evaluate(() => localStorage.getItem('agrovercity_access_token'));
    const api = process.env.API_URL || 'http://localhost:8000';
    const mine = await page.request.get(`${api}/v1/courses/my-learning`, { headers: { Authorization: `Bearer ${token}` } });
    const savedRows = ((await mine.json()) as { savedCourses?: { courseId: string }[] }).savedCourses ?? [];
    for (const row of savedRows) {
      await page.request.delete(`${api}/v1/courses/${row.courseId}/save`, { headers: { Authorization: `Bearer ${token}` } });
    }

    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    await expect(page.getByRole('button', { name: 'Save for later' }).first()).toBeVisible({ timeout: 20_000 });

    const firstCard = page.locator('div.grid > div').filter({ has: page.getByRole('button', { name: 'Save for later' }) }).first();
    const title = (await firstCard.locator('h3').innerText()).trim();
    await firstCard.getByRole('button', { name: 'Save for later' }).click();
    await expect(page.getByText(/Saved .+ for later/)).toBeVisible({ timeout: 10_000 });

    // Saved option 1: My Learning → Saved Courses.
    await page.goto(BASE_URL + '/academy/my-learning?tab=saved');
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
    // ...and its Remove button works.
    await page.getByRole('button', { name: /Remove/ }).first().click();
    await expect(page.getByText(/Removed .+ from saved courses/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/No saved courses yet\./)).toBeVisible({ timeout: 10_000 });

    // Saved option 2: Browse Instructors → Saved Courses (re-save to check, then reset).
    await page.goto(BASE_URL + '/academy');
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
    const card2 = page.locator('div.grid > div').filter({ has: page.getByRole('button', { name: 'Save for later' }) }).first();
    const title2 = (await card2.locator('h3').innerText()).trim();
    await card2.getByRole('button', { name: 'Save for later' }).click();
    await expect(page.getByText(/Saved .+ for later/)).toBeVisible({ timeout: 10_000 });
    await page.goto(BASE_URL + '/academy/instructors?tab=saved');
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
    await expect(page.getByText(title2).first()).toBeVisible({ timeout: 20_000 });

    // Reset: remove everything again via the My Learning Saved tab UI.
    await page.goto(BASE_URL + '/academy/my-learning?tab=saved');
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
    for (let i = 0; i < 10; i++) {
      const removeBtn = page.getByRole('button', { name: /Remove/ }).first();
      if (!(await removeBtn.isVisible().catch(() => false))) break;
      await removeBtn.click();
      await expect(page.getByText(/Removed .+ from saved courses/)).toBeVisible({ timeout: 10_000 });
    }
    await expect(page.getByText(/No saved courses yet\./)).toBeVisible({ timeout: 10_000 });

    expect(pageErrors).toEqual([]);
    await context.close();
  });
});
