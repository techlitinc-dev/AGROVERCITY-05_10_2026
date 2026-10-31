/**
 * Module 1 — Account / Onboarding (web-testable parts)
 * TC-FRM-01: Unregistered number on the login page → OTP → registration journey
 * TC-FRM-02: Login with phone + MPIN
 * TC-FRM-03: Wrong MPIN error (uses a throwaway account so the shared
 *            farmer's rate-limit counter is never touched)
 */
import { test, expect } from '../fixtures/auth';
import { api, loginWithMpin, requestOtp, verifyOtp } from '../fixtures/api';
import { FARMER, freshPhone } from '../test-data';

test.describe('Module 1 — Account (TC-FRM-01/02/03)', () => {
  test('TC-FRM-01: unregistered number on login is treated as a new registration — OTP first, then the registration journey', async ({
    page,
  }) => {
    const phone = freshPhone();
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill(phone);
    await page.getByRole('button', { name: /continue|आगे/i }).click();

    // Unregistered number → OTP, with the new-account copy surfaced.
    await expect(page.getByText('New Number — Account Setup')).toBeVisible();
    await expect(page.getByText(/not registered yet/i)).toBeVisible();

    // Dev auto-OTP path — verify via the same button a user would tap.
    await page.getByRole('button', { name: /auto-fill & verify/i }).click();

    // Restricted onboarding session: straight into the registration journey
    // (profile step) — no marketplace access before registration completes.
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByText('Step 2 — Basic profile')).toBeVisible();
  });

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

  test('TC-FRM-04: new account via login→OTP→register MUST be asked for an MPIN (regression: "MPIN is not set for this account")', async ({
    page,
  }) => {
    const phone = freshPhone();
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill(phone);
    await page.getByRole('button', { name: /continue|आगे/i }).click();
    await page.getByRole('button', { name: /auto-fill & verify/i }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByText('Step 2 — Basic profile')).toBeVisible();

    // The MPIN-set fields must be visible even though the signup entered via
    // the login page (the wizard's own mobile step was skipped).
    await expect(page.getByText(/choose 4-digit mpin/i)).toBeVisible();
    const mpinInputs = page.locator('input[type="password"]');
    await expect(mpinInputs).toHaveCount(2);

    await page.getByPlaceholder(/Balaram Kisan or/).fill('FRM04 Mpin Kisan');
    await page.getByPlaceholder('e.g. Nashik').fill('Nashik');
    await mpinInputs.nth(0).fill(FARMER.mpin);
    await mpinInputs.nth(1).fill(FARMER.mpin);
    await page.getByRole('button', { name: 'Continue to Identity Verification' }).click();

    // Complete registration through the mock DigiLocker flow.
    await page.getByRole('checkbox').check();
    await page.getByText('DigiLocker', { exact: true }).click();
    await page.getByRole('button', { name: /Verify with DigiLocker/ }).click();
    await expect(page).toHaveURL(/\/mock-digilocker/, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page).toHaveURL(/\/farmer$/, { timeout: 20_000 });

    // The account now has a working MPIN — no "MPIN is not set" at next login.
    const session = await loginWithMpin(phone, FARMER.mpin);
    expect(session.user.name).toBe('FRM04 Mpin Kisan');
  });
});
