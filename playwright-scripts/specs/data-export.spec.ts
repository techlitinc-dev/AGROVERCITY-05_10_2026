import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

const ARCHIVE = {
  userId: 'dev-user-1',
  generatedAt: '2026-11-18T06:30:00+00:00',
  profile: { name: 'Ram Singh', phone: '9999999999', village: 'Nashik' },
  collections: {
    diary_entries: [
      { id: 'd1', type: 'income', category: 'Crop Sale', amount: 38000, crop: 'Soybean' },
      { id: 'd2', type: 'expense', category: 'Seeds', amount: 4200, crop: 'Wheat' },
    ],
    orders: [{ id: 'o1', status: 'delivered', orderValuePaisa: 9500000 }],
  },
};

test('data export: request shows ready link and CSV/Excel downloads generate from the real archive', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await page.route('**/v1/users/me/data-export', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ready',
        url: '/fake-export.json',
        createdAt: '2026-11-18T06:30:00+00:00',
      }),
    })
  );
  await page.route('**/fake-export.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ARCHIVE) })
  );

  await seedAuth(page.context(), farmer);
  await page.goto('/settings');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await page.getByRole('button', { name: /request data export/i }).click();
  await expect(page.getByText(/Your data export is ready/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Latest export: ready/)).toBeVisible();

  // All four format actions appear.
  await expect(page.getByRole('link', { name: 'JSON' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CSV' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excel' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PDF' })).toBeVisible();

  // CSV download fires with real content from the archive.
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV' }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toBe('agrovercity-data-export.csv');
  const csvPath = await csv.path();
  const fs = await import('node:fs');
  const csvText = fs.readFileSync(csvPath, 'utf-8');
  expect(csvText).toContain('diary_entries');
  expect(csvText).toContain('38000');
  expect(csvText).toContain('profile');

  // Excel (SpreadsheetML) download fires as a real workbook.
  const xlsDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel' }).click();
  const xls = await xlsDownload;
  expect(xls.suggestedFilename()).toBe('agrovercity-data-export.xls');
  const xlsText = fs.readFileSync(await xls.path(), 'utf-8');
  expect(xlsText).toContain('urn:schemas-microsoft-com:office:spreadsheet');
  expect(xlsText).toContain('<Worksheet');

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
