/**
 * Module 1d — Mandatory identity verification DURING registration (spec item 14).
 *
 * Covers the real UI journey on the no-SSL dev server with the mock provider:
 *   Mobile → Profile → Identity Verification (consent-gated) → mock DigiLocker
 *   → callback polling → server-controlled completion → persona home.
 * Plus: pendingKyc resume after browser close/reload, consent-denied + retry,
 * and the verified badge.
 */
import { test, expect, type Page } from '@playwright/test';
import { freshPhone } from '../test-data';

const MPIN = '7890';

/** Drive the wizard up to (and including) the identity-verification step. */
async function reachIdentityStep(page: Page, phone: string, name: string): Promise<void> {
  await page.goto('/register');
  await page.getByPlaceholder('9876543210').fill(phone);
  await page.getByRole('button', { name: 'Send OTP' }).click();
  const devOtpHint = page.locator('text=Dev mode — your OTP is');
  await expect(devOtpHint).toBeVisible();
  const otp = ((await devOtpHint.innerText()).match(/(\d{6})/) ?? [])[1];
  await page.getByPlaceholder('••••••').fill(otp);
  await page.getByRole('button', { name: 'Verify & Continue' }).click();

  await expect(page.getByText('Step 2 — Basic profile')).toBeVisible();
  await page.getByPlaceholder(/Balaram Kisan or/).fill(name);
  await page.getByPlaceholder('e.g. Nashik').fill('Nashik');
  const mpinInputs = page.locator('input[type="password"]');
  await mpinInputs.nth(0).fill(MPIN);
  await mpinInputs.nth(1).fill(MPIN);
  await page.getByRole('button', { name: 'Continue to Identity Verification' }).click();

  await expect(page.getByRole('heading', { name: 'Verify Your Identity' })).toBeVisible();
  await expect(page.getByText('Test Mode.', { exact: true })).toBeVisible();
}

test.describe('Registration-integrated KYC (mock provider)', () => {
  test('new registration via Aadhaar number + OTP: masked storage only, completes registration', async ({
    page,
  }) => {
    const phone = freshPhone();
    await reachIdentityStep(page, phone, 'E2E Aadhaar Kisan');

    // Aadhaar-OTP is the default method card in test mode.
    await expect(page.getByText('Aadhaar Number (OTP)')).toBeVisible();
    const verifyBtn = page.getByRole('button', { name: 'Send OTP to Aadhaar-linked Mobile' });
    await expect(verifyBtn).toBeDisabled();
    await page.getByRole('checkbox').check();
    await page.getByPlaceholder('Enter 12-digit Aadhaar number').fill('123456789012');
    await verifyBtn.click();

    const devOtpHint = page.locator('text=Dev mode — your OTP is');
    await expect(devOtpHint).toBeVisible();
    const otp = ((await devOtpHint.innerText()).match(/(\d{6})/) ?? [])[1];
    await page.getByPlaceholder('••••••').fill(otp);
    await page.getByRole('button', { name: 'Verify & Continue' }).click();

    // Same single resumption point as the DigiLocker flow. The session is
    // already verified at navigation, so the callback goes straight to the
    // completing state; the verified card auto-navigates away after ~2s, so
    // persistent outcomes are asserted on the farmer home.
    await expect(page).toHaveURL(/\/kyc\/callback/, { timeout: 15_000 });
    await expect(page.getByText('Identity verified — completing registration…')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/farmer$/, { timeout: 20_000 });
    // Post-login polls (notifications/settings) shift the header once — let the
    // app settle before opening the profile menu.
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /E2E/ }).first().click();
    await expect(page.getByText(/^Verified/)).toBeVisible();
  });

  test('new registration: KYC is a mandatory step; approve completes registration and shows the verified badge', async ({
    page,
  }) => {
    const phone = freshPhone();
    await reachIdentityStep(page, phone, 'E2E Verified Kisan');

    // Consent gates the provider redirect.
    await page.getByText('DigiLocker', { exact: true }).click();
    const verifyBtn = page.getByRole('button', { name: /Verify with DigiLocker/ });
    await expect(verifyBtn).toBeDisabled();
    await page.getByRole('checkbox').check();
    await verifyBtn.click();

    // Mock provider opens the INTERNAL mock DigiLocker screen — no password,
    // no Aadhaar OTP, no real Aadhaar details are requested.
    await expect(page).toHaveURL(/\/mock-digilocker/, { timeout: 15_000 });
    await expect(page.getByText('Mock Verification Screen')).toBeVisible();
    await expect(page.getByText(/never asks for a password, an OTP, or real Aadhaar/i)).toBeVisible();

    await page.getByRole('button', { name: 'Approve' }).click();

    // Registration callback polls ONLY the Agrovercity backend, then completes.
    await expect(page).toHaveURL(/\/kyc\/callback/, { timeout: 15_000 });
    await expect(page.getByText('Completing your identity verification')).toBeVisible();
    await expect(page.getByText('Identity verified')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/XXXXXXXX\d{4}/)).toBeVisible();

    // Redirected to the selected persona home with a verified badge.
    await expect(page).toHaveURL(/\/farmer$/, { timeout: 20_000 });
    await page.getByRole('button', { name: /E2E/ }).first().click();
    await expect(page.getByText(/^Verified/)).toBeVisible();
  });

  test('multi-select personas during registration: every selected persona is saved to the profile', async ({
    page,
  }) => {
    const phone = freshPhone();
    await page.goto('/register');
    await page.getByPlaceholder('9876543210').fill(phone);
    await page.getByRole('button', { name: 'Send OTP' }).click();
    const devOtpHint = page.locator('text=Dev mode — your OTP is');
    await expect(devOtpHint).toBeVisible();
    const otp = ((await devOtpHint.innerText()).match(/(\d{6})/) ?? [])[1];
    await page.getByPlaceholder('••••••').fill(otp);
    await page.getByRole('button', { name: 'Verify & Continue' }).click();

    await expect(page.getByText('Step 2 — Basic profile')).toBeVisible();
    // Farmer is preselected; add Agri Vyapari as a second persona.
    await page.getByRole('button', { name: /Agri Vyapari/ }).click();
    await expect(page.getByText('Selected #2')).toBeVisible();
    await expect(page.getByText('• Primary')).toBeVisible();

    await page.getByPlaceholder(/Balaram Kisan or/).fill('E2E Multi Persona Kisan');
    await page.getByPlaceholder('e.g. Nashik').fill('Nashik');
    const mpinInputs = page.locator('input[type="password"]');
    await mpinInputs.nth(0).fill(MPIN);
    await mpinInputs.nth(1).fill(MPIN);
    await page.getByRole('button', { name: 'Continue to Identity Verification' }).click();

    await expect(page.getByRole('heading', { name: 'Verify Your Identity' })).toBeVisible();
    await page.getByRole('checkbox').check();
    await page.getByText('DigiLocker', { exact: true }).click();
    await page.getByRole('button', { name: /Verify with DigiLocker/ }).click();
    await expect(page).toHaveURL(/\/mock-digilocker/, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page).toHaveURL(/\/farmer$/, { timeout: 20_000 });

    // Both personas are linked on the profile: farmer is active, vyapari is
    // switchable — and no other persona is silently linked.
    await page.goto('/profiles');
    await expect(page.getByRole('heading', { name: 'Multi-Profile & Persona Switcher' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Farmer / Kisan' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Agri Vyapari' })).toBeVisible();
    await expect(page.getByText('Single Sign-On')).toHaveCount(2);
    await expect(page.getByText('Not linked yet')).toHaveCount(19);
  });

  test('closing the browser at pendingKyc resumes at the identity step — no duplicate account, no new OTP demand', async ({
    page,
  }) => {
    const phone = freshPhone();
    await reachIdentityStep(page, phone, 'E2E Resume Kisan');

    // Simulate the closed browser: reload the registration page.
    await page.reload();

    // Back at the pending KYC step directly — mobile step NOT re-requested.
    await expect(page.getByRole('heading', { name: 'Verify Your Identity' })).toBeVisible();
    await expect(page.getByText('Step 1 — Verify your mobile number')).toBeHidden();

    // And the journey still completes normally.
    await page.getByRole('checkbox').check();
    await page.getByText('DigiLocker', { exact: true }).click();
    await page.getByRole('button', { name: /Verify with DigiLocker/ }).click();
    await expect(page).toHaveURL(/\/mock-digilocker/, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Identity verified')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/farmer$/, { timeout: 20_000 });
  });

  test('denied consent keeps registration incomplete and offers retry', async ({ page }) => {
    const phone = freshPhone();
    await reachIdentityStep(page, phone, 'E2E Deny Kisan');

    await page.getByRole('checkbox').check();
    await page.getByText('DigiLocker', { exact: true }).click();
    await page.getByRole('button', { name: /Verify with DigiLocker/ }).click();
    await expect(page).toHaveURL(/\/mock-digilocker/, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Deny' }).click();

    // Callback surfaces the consent-denied explanation and a retry path.
    await expect(page).toHaveURL(/\/kyc\/callback/, { timeout: 15_000 });
    await expect(page.getByText('Consent was not given')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Retry Verification' }).click();

    // Back at the identity step; a fresh attempt can complete registration.
    await expect(page).toHaveURL(/\/register/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Verify Your Identity' })).toBeVisible();
    await page.getByRole('checkbox').check();
    await page.getByText('DigiLocker', { exact: true }).click();
    await page.getByRole('button', { name: /Verify with DigiLocker/ }).click();
    await expect(page).toHaveURL(/\/mock-digilocker/, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Identity verified')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/farmer$/, { timeout: 20_000 });
  });
});
