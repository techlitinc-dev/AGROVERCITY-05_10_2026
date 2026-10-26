/**
 * Module 1 — Account / Onboarding (web-testable parts)
 * TC-FRM-02: Login with phone + MPIN
 * TC-FRM-03: Wrong MPIN error (uses a throwaway account so the shared
 *            farmer's rate-limit counter is never touched)
 */
import { test, expect } from '../fixtures/auth';
import { api, loginWithMpin, requestOtp, verifyOtp } from '../fixtures/api';
import { FARMER, freshPhone } from '../test-data';

test.describe('Module 1 — Account (TC-FRM-02/03)', () => {
  test('TC-FRM-02: login with phone + MPIN reaches farmer home', async ({ page }) => {
    await page.goto('/login');
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill(FARMER.phoneLocal);
    await page.getByRole('button', { name: /continue|आगे/i }).click();
    // Existing user path → MPIN pad (personalised title once /auth/check returns the name).
    await expect(page.getByText(/4-digit security mpin/i)).toBeVisible();
    for (const digit of FARMER.mpin) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }
    await expect(page).toHaveURL(/\/farmer/);
    // Home greets with first name + village line (see TC-FRM-15 expected text).
    await expect(page.getByRole('heading', { name: /ram ram, ramesh/i })).toBeVisible();
    await expect(page.getByText(new RegExp(FARMER.village, 'i')).first()).toBeVisible();
  });

  test('TC-FRM-03: wrong MPIN shows clear error, no login', async ({ page }) => {
    // Arrange a fresh account with known MPIN via the dev OTP flow.
    const phone = freshPhone();
    const { devOtp, otpSessionId } = await requestOtp(phone);
    const verified = await verifyOtp(phone, devOtp!, otpSessionId);
    expect(verified.status).toBe(200);
    const onboard = await api.post('/auth/onboard', {
      phone,
      name: 'FRM03 Throwaway',
      mpin: FARMER.mpin,
      persona: 'farmer',
      state: FARMER.state,
      district: FARMER.district,
    });
    expect(onboard.status).toBe(200);
    // Sanity: correct MPIN works through the same API the UI calls.
    await loginWithMpin(phone, FARMER.mpin);

    await page.goto('/login');
    await page.locator('input[type="tel"]').fill(phone.slice(-10));
    await page.getByRole('button', { name: /continue|आगे/i }).click();
    await expect(page.getByText(/4-digit security mpin/i)).toBeVisible();
    for (const digit of '9999') {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }
    await expect(page.getByText(/wrong|incorrect|invalid/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/farmer/);
  });
});
