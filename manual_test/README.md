# Agrovercity — Manual Test Suite (Final Acceptance / UAT)

This folder contains the **manual user-acceptance test suite** for Agrovercity. It is written for
**multi-tester roleplay**: each tester picks a persona, acts as that persona in the app, and follows
the step-by-step scripts. Several scripts involve **two testers acting at the same time** (for
example, a Farmer posts a transport request while a Transporter bids on it) — these are the
end-to-end (E2E) flows and are the most important part of the final test.

> **Read this file first.** Every persona document follows the conventions defined here.

---

## 1. What is being tested

Agrovercity is an agri-platform with 6 user personas covered by this suite:

| # | Persona | Document | Test-ID prefix |
|---|---------|----------|----------------|
| 1 | Farmer (Kisan) | [01_farmer.md](01_farmer.md) | `FRM` |
| 2 | Transporter | [02_transporter.md](02_transporter.md) | `TRN` |
| 3 | Vyapari (Trader / Merchant) | [03_vyapari.md](03_vyapari.md) | `VYP` |
| 4 | Mahila Graha Udyog (Women Home-Enterprise / SHG) | [04_mahila_gruh_udyog.md](04_mahila_gruh_udyog.md) | `MGU` |
| 5 | Nursery (Plant Nursery Owner) | [05_nursery.md](05_nursery.md) | `NRS` |
| 6 | E-Market Customer (Agri-mall Buyer) | [06_emarket_customer.md](06_emarket_customer.md) | `EMC` |
| — | Cross-persona E2E roleplay (multi-user) | [07_cross_persona_e2e.md](07_cross_persona_e2e.md) | `XP` |

There is also a Super-Admin web panel. It is **not** a persona under test, but admin actions are
used where a flow needs admin approval (KYC, moderation, settlements). Those steps are marked
**[ADMIN]**.

---

## 2. Roles in this test (who plays whom)

Minimum team: **2 testers** (Testers A and B). Recommended: **3 testers**, one of whom can act as
Admin on the super-admin web panel.

| Role | Task |
|------|------|
| Tester A | Primary actor for Farmer, Vyapari, E-Market Customer scripts |
| Tester B | Primary actor for Transporter, Nursery, Mahila Graha Udyog scripts |
| Tester C (optional) | Super-Admin panel actions **[ADMIN]**, and second device for simultaneous roleplay |

Each tester keeps **one phone number = one account** for the whole run. Do not share accounts
between testers — flows must be checked with *different* users to catch permission leaks.

### Roleplay rules (important for a valid final test)

1. **Stay in character.** Use only the screens, buttons and menus your persona would see. If you
   see another persona's private data or action buttons, that is a **defect** — file it.
2. **Test both happy path and failure path.** Every form: submit it empty, with invalid values, and
   with valid values. Every status: try an illegal transition (e.g., cancel an already-delivered order).
3. **Check notifications.** After every action that should notify someone, open the bell icon /
   notification list of the *other* actor and verify the notification arrived with correct text.
4. **Check money.** Wherever money moves (order payment, wallet, settlement, payout), verify the
   amount on *both* sides and the commission deduction.
5. **One device per persona.** Simultaneous flows (XP scripts) need two devices logged in as two
   different personas at the same time.
6. **Language toggle.** The app supports English / हिन्दी. Run at least the onboarding and one core
   flow of your persona in हिन्दी and verify labels do not overflow or show English placeholders.

---

## 3. Test environment

| Item | Value | Notes |
|------|-------|-------|
| Backend API | `http://<host>:8000` (per deployment) | Check `backend/.env`; docs at `/docs` |
| Customer web app | `website/` (React) | Buyer/e-market, farmer web views |
| Super-admin web | `superadmin/` (React) | **[ADMIN]** steps |
| Mobile app | Flutter app in `backup/apps/mobile` | Primary surface for Farmer / Transporter / Women / Customer |
| Test OTP | OTP is returned in API response in dev (SMS provider not wired) | Use the `otp`/`devOtp` field from `/auth/otp/send` response |
| Demo MPIN | `1234` for demo users | Use phone+MPIN login for seeded accounts |
| Demo users | `dev-*` / `omni-*` seeded accounts | See `backend/app/data` or ask the dev team for the demo user list |

**Before Day 1, confirm:**
- [ ] Backend is running and `/health` returns OK.
- [ ] Website builds and opens; super-admin opens.
- [ ] Mobile app builds (or use `flutter run` with a debug device per tester).
- [ ] Fresh test accounts can be created (OTP flow works).
- [ ] Test bank/UPI details for payout flows (use the sandbox/test UPI ID agreed with the team).

---

## 4. How each test case is written

Every test case uses this format:

```
### TC-FRM-07: Post a mandi price alert
- **Module:** Mandi / Price Alerts      **Priority:** P1 (P0 = blocker, P1 = major, P2 = minor)
- **Roleplay:** You are Ramesh, a grape farmer. You want to be alerted when Nashik grape prices cross ₹80/kg.
- **Preconditions:** Logged in as Farmer; KYC approved; at least 1 crop added.
- **Test data:** Crop = Grapes (Nashik).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Home → tap "Mandi Prices" | Mandi screen opens; prices list loads without error |
| 2 | ... | ... |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________
```

**How to execute:** do the steps in order, compare what you *actually see* with the *Expected result*
column, then mark Pass/Fail and write notes for every Fail (what you saw instead, screenshot).

**Priority meaning:**
- **P0** — money, login, or a core persona flow. A P0 failure blocks release.
- **P1** — a major feature of the persona. Must pass for release.
- **P2** — polish / edge case. Should pass; release can proceed with known P2 bugs listed.

**Coverage rules used while writing:** every screen, every visible button/menu item, every form
field (valid + invalid), every lifecycle status transition, every notification, every money
movement, and the cross-persona hand-offs.

---

## 5. Defect logging

For every Fail, raise a defect with this template (one per distinct defect):

```
Defect ID:      DEF-001
Test case:      TC-FRM-07
Date / Tester:  2026-10-22 / Tester A
Severity:       Blocker / Major / Minor
Environment:    Staging, backend commit abc1234
Steps:          (numbered)
Actual:         (what you saw — attach screenshot/screen recording)
Expected:       (from the Expected result column)
Personas hit:   Farmer, Vyapari (who else is affected)
```

---

## 6. Execution order (recommended)

1. **Setup day** — create all accounts (Section "Account & test data" in each persona doc), verify
   environment checklist above.
2. **Onboarding & profile tests** in all 6 persona docs (TC-…-01 … -05 range).
3. **Persona solo flows** — each tester runs their persona(s) module by module.
4. **Cross-persona E2E** — [07_cross_persona_e2e.md](07_cross_persona_e2e.md). Run with both testers
   simultaneously. Do **not** skip these; they are the final proof the marketplace works.
5. **Regression sweep** — re-run every P0 and every failed case after fixes.
6. **Sign-off** — fill the matrix below.

## 7. Sign-off matrix

| Persona doc | Total cases | P0 passed | P1 passed | Open defects | Tester sign & date |
|-------------|------------:|----------:|----------:|-------------:|--------------------|
| 01 Farmer | | | | | |
| 02 Transporter | | | | | |
| 03 Vyapari | | | | | |
| 04 Mahila Graha Udyog | | | | | |
| 05 Nursery | | | | | |
| 06 E-Market Customer | | | | | |
| 07 Cross-persona E2E | | | | | |

**Release gate:** all P0 pass, ≥ 95% P1 pass, and zero open Blocker defects.
