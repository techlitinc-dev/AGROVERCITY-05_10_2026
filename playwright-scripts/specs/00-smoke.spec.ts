import { test, expect } from '@playwright/test';
import { API_URL, BASE_URL, SUPERADMIN_URL } from '../lib/env';

/** Pre-flight: services answer and headless chromium actually launches. */
test('backend API health', async () => {
  const res = await fetch(`${API_URL}/v1/health`);
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ status: 'ok' });
});

test('website serves the SPA', async ({ page }) => {
  const res = await page.goto(BASE_URL + '/');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/agrovercity/i);
});

test('superadmin serves the SPA', async ({ page }) => {
  const res = await page.goto(SUPERADMIN_URL + '/');
  expect(res?.status()).toBe(200);
});
