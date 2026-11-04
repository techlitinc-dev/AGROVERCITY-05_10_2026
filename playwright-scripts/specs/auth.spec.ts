import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS_DIR } from '../lib/env';
import { Watch, attachWatchers, humanType, perfShim } from '../lib/harness';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

/**
 * Real UI auth journeys — no session injection. These are the exact paths a
 * human tester follows on the login page.
 */

const shot = async (page: Page, name: string) => {
  const dir = path.join(RESULTS_DIR, 'auth', 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
};

const freshPhone = () => `98${String(Date.now()).slice(-8)}`;

test('MPIN login — phone → MPIN → farmer dashboard', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await page.goto('/login');
  await humanType(page, page.locator('input[type="tel"]'), '9999999999');
  await page.getByRole('button', { name: /continue|आगे बढ़ें/i }).click();
  await page.getByRole('button', { name: /quick dev mpin/i }).click();

  await expect(page).toHaveURL(/\/farmer/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await shot(page, '01-mpin-login-landing');

  const { pageErrors, consoleErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
  const hard = consoleErrors.filter((e) => e.type === 'error');
  expect(hard, `console errors: ${hard.map((e) => e.text).join('; ')}`).toEqual([]);
});

test('OTP registration — brand-new number → auto-OTP → registration journey', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await page.goto('/login');
  const phone = freshPhone();
  await humanType(page, page.locator('input[type="tel"]'), phone);
  await page.getByRole('button', { name: /continue|आगे बढ़ें/i }).click();

  // Dev backend renders the auto-OTP strip with a 1-click verify button.
  const auto = page.getByRole('button', { name: /auto-fill & verify/i });
  await expect(auto).toBeVisible({ timeout: 15_000 });
  await shot(page, '02-otp-screen-with-dev-otp');
  await auto.click();

  // New users are routed into the registration/KYC journey — either page is a
  // legitimate landing; a bounce back to /login or a crash is not.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await shot(page, '03-after-otp-verify');
  expect(page.url()).not.toContain('/login');

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('1-Click Demo tab — persona card launches its cockpit', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  await page.goto('/login');
  await page.getByRole('button', { name: /1-click demo/i }).click();
  const card = page.getByRole('button', { name: /tushar chaudhari/i });
  await expect(card).toBeVisible();
  await card.click();

  await expect(page).toHaveURL(/\/farmer/, { timeout: 15_000 });
  await shot(page, '04-demo-login-landing');

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
