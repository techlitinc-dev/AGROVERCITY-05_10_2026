import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const landlord = PERSONAS.find((p) => p.id === 'landlord')!;
const LISTING_ID = readFileSync('/tmp/zz_listing_id', 'utf8').trim();
const ADMIN_TOKEN = readFileSync('/tmp/zz_admin_token', 'utf8').trim();
const API = 'http://127.0.0.1:8000';

test('ZZ: Land Verification page — full document lifecycle', async ({ page }) => {
  await seedAuth(page.context(), landlord);
  await page.goto('/landlord/verification');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // Page renders with the test listing, not-submitted state.
  await expect(page.getByRole('heading', { name: 'Land Verification' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('ZZ Verify Nagar')).toBeVisible();
  await expect(page.getByText('Docs Not Submitted')).toBeVisible();
  console.log('STATE_1_NOT_SUBMITTED=true');

  // Upload a document through the UI.
  await page.locator('input[type=file]').first().setInputFiles('/tmp/zz-doc.png');
  await expect(page.getByText(/document\(s\) submitted/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Docs Under Review')).toBeVisible();
  console.log('STATE_2_PENDING=true');

  // Admin rejects with a reason.
  const reject = await page.request.post(`${API}/v1/land/listings/${LISTING_ID}/verify-documents`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    data: { approved: false, reason: 'Test: name mismatch on 7/12' },
  });
  expect(reject.status()).toBe(200);

  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByText('Docs Rejected')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Rejection reason: Test: name mismatch on 7\/12/)).toBeVisible();
  console.log('STATE_3_REJECTED_WITH_REASON=true');

  // Landlord uploads corrected documents (button label reflects rejection).
  await expect(page.getByText('Upload Corrected Documents')).toBeVisible();
  await page.locator('input[type=file]').first().setInputFiles('/tmp/zz-doc.png');
  await expect(page.getByText(/document\(s\) submitted/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Docs Under Review')).toBeVisible();
  console.log('STATE_4_RESUBMITTED=true');

  // Admin approves.
  const approve = await page.request.post(`${API}/v1/land/listings/${LISTING_ID}/verify-documents`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    data: { approved: true },
  });
  expect(approve.status()).toBe(200);

  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByText('Land Docs Verified').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/shows the "Land Docs Verified" badge to farmers/)).toBeVisible();
  console.log('STATE_5_VERIFIED=true');
});

test('ZZ: sidebar Land Verification opens the real page + cross-link works', async ({ page }) => {
  await seedAuth(page.context(), landlord);
  await page.goto('/landlord');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await page.getByRole('link', { name: 'Land Verification' }).click();
  await expect(page).toHaveURL(/\/landlord\/verification$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Land Verification' })).toBeVisible({ timeout: 15_000 });
  console.log('SIDEBAR_OPENS_REAL_PAGE=true');

  await page.goto('/landlord/listings');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.getByRole('link', { name: /Open Land Verification/ }).click();
  await expect(page).toHaveURL(/\/landlord\/verification$/, { timeout: 15_000 });
  console.log('CROSS_LINK_OK=true');
});
