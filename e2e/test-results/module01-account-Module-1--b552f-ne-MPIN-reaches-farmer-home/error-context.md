# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: module01-account.spec.ts >> Module 1 — Account (TC-FRM-02/03) >> TC-FRM-02: login with phone + MPIN reaches farmer home
- Location: specs/module01-account.spec.ts:12:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/4-digit security mpin/i)
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/4-digit security mpin/i) with timeout 10000ms
  - waiting for getByText(/4-digit security mpin/i)

```

```yaml
- banner:
  - link "AGROVERCITY OS Kisan Setu • Digital Agri Operating System":
    - /url: /
    - img
    - text: AGROVERCITY OS
    - paragraph: Kisan Setu • Digital Agri Operating System
  - button "English":
    - img
    - text: English
    - img
  - link "Krishi Mall Cart":
    - /url: /mall/cart
    - img
  - link "Log In":
    - /url: /login
- main:
  - link "AGROVERCITY Kisan Setu OS 2.0":
    - /url: /
    - img
    - text: AGROVERCITY Kisan Setu OS 2.0
  - text: 28 States APMC Mandi Network Live
  - heading "Empowering Every Hand That Feeds The Nation" [level=2]
  - paragraph: Unified role-gated cockpit connecting 20 agricultural stakeholders with 100% escrow trade security, live mandi radar, smart digital bilty, and AI agronomy.
  - img
  - text: 100% Escrow Trade Vault Zero-default instant gate OTP payment release
  - img
  - text: Mahabhulekh 7/12 Digital Vault Automated revenue sync & KCC digital underwriting
  - img
  - text: FT-1 Digital Bilty & GPS Radar Hourly waiting fees & cold-chain telematics
  - img
  - text: FAT/SNF Computerized Dairy Automated milk analyzer & instant passbook credits “Through Agrovercity, I sold 150 quintals of soybean directly to an institutional buyer. Full payment reached my bank the second gate OTP was verified!” Rameshwar Patil • Farmer, Latur
  - img
  - text: Escrow Settled
  - heading "Sign In to Workspace Kisan Setu" [level=3]
  - paragraph: Enter mobile number or select a 1-click verified demo persona.
  - button "Mobile":
    - img
    - text: Mobile
  - button "1-Click Demo":
    - img
    - text: 1-Click Demo
  - img
  - text: "Verification OTP generated. (Dev Auto-OTP: 461660) One-Time First Login Verification"
  - paragraph:
    - text: Enter 6-digit code sent to
    - strong: +91 9822000001
  - button "Change mobile number"
  - text: "Dev Auto-OTP:"
  - strong: "461660"
  - button "Auto-Fill & Verify"
  - textbox
  - textbox
  - textbox
  - textbox
  - textbox
  - textbox
  - button "Have an MPIN? Switch to MPIN Login"
  - text: New to Agrovercity?
  - link "Register New Farm Account":
    - /url: /register
    - text: Register New Farm Account
    - img
  - img
  - text: 256-Bit Escrow Security Vault
  - 'link "Helpline: 1800-AGRO-SETU"':
    - /url: tel:180024767388
    - img
    - text: "Helpline: 1800-AGRO-SETU"
- button "AI Agronomist (Kisan Mitra)":
  - img
  - text: AI Agronomist (Kisan Mitra)
```

# Test source

```ts
  1  | /**
  2  |  * Module 1 — Account / Onboarding (web-testable parts)
  3  |  * TC-FRM-02: Login with phone + MPIN
  4  |  * TC-FRM-03: Wrong MPIN error (uses a throwaway account so the shared
  5  |  *            farmer's rate-limit counter is never touched)
  6  |  */
  7  | import { test, expect } from '../fixtures/auth';
  8  | import { api, loginWithMpin, requestOtp, verifyOtp } from '../fixtures/api';
  9  | import { FARMER, freshPhone } from '../test-data';
  10 | 
  11 | test.describe('Module 1 — Account (TC-FRM-02/03)', () => {
  12 |   test('TC-FRM-02: login with phone + MPIN reaches farmer home', async ({ page }) => {
  13 |     await page.goto('/login');
  14 |     const phoneInput = page.locator('input[type="tel"]');
  15 |     await phoneInput.fill(FARMER.phoneLocal);
  16 |     await page.getByRole('button', { name: /continue|आगे/i }).click();
  17 |     // Existing user path → MPIN pad (personalised title once /auth/check returns the name).
> 18 |     await expect(page.getByText(/4-digit security mpin/i)).toBeVisible();
     |                                                            ^ Error: expect(locator).toBeVisible() failed
  19 |     for (const digit of FARMER.mpin) {
  20 |       await page.getByRole('button', { name: digit, exact: true }).click();
  21 |     }
  22 |     await expect(page).toHaveURL(/\/farmer/);
  23 |     // Home greets with first name + village line (see TC-FRM-15 expected text).
  24 |     await expect(page.getByRole('heading', { name: /ram ram, ramesh/i })).toBeVisible();
  25 |     await expect(page.getByText(new RegExp(FARMER.village, 'i')).first()).toBeVisible();
  26 |   });
  27 | 
  28 |   test('TC-FRM-03: wrong MPIN shows clear error, no login', async ({ page }) => {
  29 |     // Arrange a fresh account with known MPIN via the dev OTP flow.
  30 |     const phone = freshPhone();
  31 |     const { devOtp, otpSessionId } = await requestOtp(phone);
  32 |     const verified = await verifyOtp(phone, devOtp!, otpSessionId);
  33 |     expect(verified.status).toBe(200);
  34 |     const onboard = await api.post('/auth/onboard', {
  35 |       phone,
  36 |       name: 'FRM03 Throwaway',
  37 |       mpin: FARMER.mpin,
  38 |       persona: 'farmer',
  39 |       state: FARMER.state,
  40 |       district: FARMER.district,
  41 |     });
  42 |     expect(onboard.status).toBe(200);
  43 |     // Sanity: correct MPIN works through the same API the UI calls.
  44 |     await loginWithMpin(phone, FARMER.mpin);
  45 | 
  46 |     await page.goto('/login');
  47 |     await page.locator('input[type="tel"]').fill(phone.slice(-10));
  48 |     await page.getByRole('button', { name: /continue|आगे/i }).click();
  49 |     await expect(page.getByText(/4-digit security mpin/i)).toBeVisible();
  50 |     for (const digit of '9999') {
  51 |       await page.getByRole('button', { name: digit, exact: true }).click();
  52 |     }
  53 |     await expect(page.getByText(/wrong|incorrect|invalid/i).first()).toBeVisible({ timeout: 15_000 });
  54 |     await expect(page).not.toHaveURL(/\/farmer/);
  55 |   });
  56 | });
  57 | 
```