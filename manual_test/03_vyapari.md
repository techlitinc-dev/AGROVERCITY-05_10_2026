# Vyapari (Trader / Merchant) — Manual Test Script (Final UAT)

> This script is for **Tester A** roleplaying **Anil Agrawal**, an onion & grape trader (vyapari). It contains **131 test cases** covering the full web seller panel (`/seller/*`) plus the backend and the mobile seller screens. Estimated effort: **2 working days** (plus cross-persona steps run together with Tester B).

---

## 0. Roleplay card

| Field | Value |
|-------|-------|
| **Name** | Anil Agrawal |
| **Age** | 45 |
| **Background** | Onion & grape trader with a shop at **Lasalgaon APMC, Nashik (Maharashtra)**. Buys produce from farmers at the mandi and from platform lots; sells onward to buyers in Delhi/Azadpur. Also runs a Krishi Mall storefront (seeds, fertilizer, cattle feed) for walk-in farmers. |
| **Language** | Marathi/Hindi speaker; runs most flows in **हिन्दी**, some in English |
| **Device** | Laptop with Chrome (primary — web seller panel); Android phone with the Agrovercity app (occasional — only seller products & analytics screens exist on mobile) |
| **Goal for this test** | Prove I can register & get KYC-verified, discover and book farmer lots, run the full purchase lifecycle with escrow & QC, negotiate offers, post demands & mandi rates, record J-forms, manage stock/resale, run POS & khata, run my storefront, create contracts, and read my settlements/P&L — with every rupee accounted for. |
| **Linked personas** | **Farmer** (Ramesh Patil — lists lots, reveals handover OTP, accepts my offers/contracts), **E-Market Customer / DirectBuyer / Exporter** (books my resale listings, receives my supply quotes, buys my mall products), **Broker/Dalal** (second account used in this script), **[ADMIN]** (approves KYC, moderates rates, releases settlement holds) — see `07_cross_persona_e2e.md` |

---

## 1. Account & test data setup

1. Confirm the backend is running: open `http://<host>:8000/health` → must return OK. API docs (Swagger) are at `http://<host>:8000/docs`.
2. Confirm the website opens: `http://<host>:3000` (per deployment; check `website/.env`). This is the **Seller Web Panel** base for all cases below.
3. Create Anil's account: on the website landing page choose **Login / Register** → enter phone → in dev the OTP comes back in the API response (`otp` / `devOtp` field of `POST /auth/otp/send`, visible in browser DevTools → Network) → enter it. Alternatively use the seeded demo account with phone + MPIN `1234` (see `backend/app/data` demo-user list).
4. At role selection choose **"I trade / buy produce"** and sub-type **Trader (Vyapari)**. Set MPIN `1234` when asked. Keep this phone = this account for the whole test.
5. Log in to the web panel with phone + MPIN; confirm you land on `/seller` ("Agri Vyapari & Retailer Suite").
6. Agree a **second account with the `broker` role** (same phone may hold both profiles, or use a second demo account) for Module 18 — the Broker/Dalal desk is a separate role.
7. Tester B prepares the linked personas: Farmer (Ramesh Patil, Nashik), one E-Market Customer, one DirectBuyer (buyer-org with procurement/finance/qa members if available).

**Test data (use these exact values everywhere):**

| Item | Value |
|------|-------|
| Anil's phone | `+91 98220 40001` (demo: use the seeded vyapari/demo account phone) |
| MPIN | `1234` (demo users only) |
| Shop name | `Anil Agro Traders` |
| Business type | `mandi_trader` |
| GSTIN (valid) | `27ABCDE1234F1Z5` (15 chars) |
| GSTIN (invalid, for negative test) | `27ABCDE1234F1Z` (14 chars) |
| APMC licence no. | `APMCLSG-2019-04567` (Lasalgaon) |
| Operating states | Maharashtra, Delhi, Haryana |
| Mandis | Lasalgaon, Nashik, Azadpur (Delhi) |
| Bank account | A/C `50100234567890`, IFSC `HDFC0001234`, holder `Anil Agrawal` (penny-drop sandbox) |
| UPI (test) | `anil.agrawal@upi` |
| Crops | Onion (Lasalgaon), Grapes (Nashik), Soybean |
| Reference lot (posted by Farmer Ramesh) | Onion, Grade A, `100` quintals, rate `₹1,450/q`, location Nashik |
| Booking qty / totals | Book `40` q → total `₹58,000`; 15% advance prefilled = `₹8,700`; min advance `₹100` |
| QC scenario | Accepted `39` q, Rejected `1` q → final `39 × 1,450 = ₹56,550` |
| Commission | 2%, min ₹50 → on ₹58,000 = `₹1,160`; farmer payout = `₹58,000 − 1,160 = ₹56,840` |
| POS sale | Buyer `Raju Vegetable Mart` (ph `98220 40003`), item `Onion`, qty `50` kg, rate `₹16/kg`, mandi fee `2%` → gross `₹800`, fee `₹16`, net `₹816` |
| Storefront product | Title `Kisan Urea 45kg`, Brand `AgroGrow`, Category `Fertilizers`, Price `₹280`, MRP `₹300`, Stock `100` |
| Team member | `Sham Wakode`, phone `98220 40002`, role `agent` |
| Mandi rate to post | Onion @ Lasalgaon, `₹18/kg` (check the live ±25% band hint first) |
| Demand to post | Crop Onion, qty `500` quintal, unit quintal, max price `₹1,500/q`, delivery Nashik, frequency `weekly` |
| Contract | Target farmer Ramesh Patil, crop Onion, `200` q total, priceType `fixed`, baseRate `₹1,500/q`, paymentTermsDays `7` |
| Farmer persona (Tester B) | Ramesh Patil — phone `+91 98220 00001`, MPIN `1234` |
| DirectBuyer persona (Tester B) | Delhi buyer-org account |

---

## 2. Preconditions checklist (verify once before starting)

- [ ] Backend `/health` returns OK; Swagger `/docs` loads.
- [ ] Website seller panel opens and login works (OTP or MPIN).
- [ ] Super-admin panel opens (for **[ADMIN]** steps).
- [ ] Anil's account created, role = seller (vyapari), MPIN set.
- [ ] Anil's **seller KYC case submitted and APPROVED** (docs: `apmc_licence` + `gst`) — needed by Modules 6, 8 and for the KYC-gate tests.
- [ ] Anil has **one penny-drop-verified primary bank account**.
- [ ] Second account with **broker role** ready for Module 18; its broker KYC (`arhtiya_licence` + `gst`) submitted.
- [ ] Farmer (Ramesh Patil) logged in on a second device; KYC approved; at least one OPEN lot posted (Onion Grade A, 100 q, ₹1,450/q) — needed from Module 3 onward.
- [ ] DirectBuyer / E-Market customer account ready for resale-booking and storefront steps.
- [ ] Language toggle English/हिन्दी visible in the web header or profile menu.
- [ ] Bell icon (notifications) visible in the web header.
- [ ] Commission config confirmed with dev team: `sellerPct` 2%, `sellerMinRupees` ₹50 (used in money-check steps).

---

## 3. Test cases

### MODULE 1 — Role Registration & Onboarding (auth, profile, KYC, bank, gates)

Covers: OTP/MPIN auth, role selection, business profile, seller KYC doc matrix (`apmc_licence` + `gst`), bank + penny-drop, language toggle, and the Shop-KYC gates.

---

### TC-VYP-01: Login with phone + MPIN (returning user)
- **Module:** 1. Registration & Onboarding / Login — **Priority:** P0
- **Roleplay:** You are Anil Agrawal. You open your shop laptop in the morning and log in to the seller panel.
- **Preconditions:** Account exists; MPIN set.
- **Test data:** Phone `+91 98220 40001` (or seeded demo phone); MPIN `1234`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `http://<host>:3000` | Landing page loads without errors |
| 2 | Choose **Login**, enter the phone number, continue | Phone accepted; password/MPIN screen appears (if the account exists the app skips OTP — `/auth/check` returns `exists`/`hasMpin`) |
| 3 | Enter MPIN `1234` | Login succeeds; you land on `/seller` — "Agri Vyapari & Retailer Suite" |
| 4 | Look at the page header | Your shop/name and the **KYC status badge** are visible |
| 5 | Refresh the browser (F5) | Session persists; no forced re-login |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-02: Register a NEW vyapari account via OTP with role selection
- **Module:** 1. Registration & Onboarding / Registration — **Priority:** P0
- **Roleplay:** You are a NEW trader who just heard about Agrovercity. Register a fresh account choosing the trade role.
- **Preconditions:** A spare phone number not yet registered; dev OTP readable from API response.
- **Test data:** New phone `+91 98220 40009`; name `Test Trader`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the site → **Register** → enter new phone `98220 40009` | OTP send succeeds (in dev, read `otp`/`devOtp` from the `/auth/otp/send` response in DevTools → Network) |
| 2 | Enter the OTP → verify | Phone verified; registration form opens |
| 3 | At role selection choose **"I trade / buy produce"** | Sub-type choices appear: **Trader / Commission Agent / Processor / Exporter** |
| 4 | Select **Trader**, fill name, state `Maharashtra`, district `Nashik`, village `Lasalgaon`, set MPIN `1234` | Registration completes; `activeProfile` = seller; dashboard seeds; you land on `/seller` |
| 5 | Open browser DevTools → find the `/auth/register` (or `/auth/onboard`) request | Response shows `profiles[]` containing `seller`, `primaryProfile`, `linkedProfiles`, `activeProfile` |
| 6 | Try registering again with the same phone | System detects existing account (`/auth/check` → `exists: true`) and routes to login, not a duplicate account |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-03: Complete the Vyapari Business Profile (valid + empty-submit negative)
- **Module:** 1. Registration & Onboarding / Business Profile — **Priority:** P0
- **Roleplay:** You are Anil. Your profile is incomplete; fill your firm & trade identity so farmers trust you.
- **Preconditions:** Logged in as seller.
- **Test data:** Shop `Anil Agro Traders`; type `Mandi Trader`; years `18`; capacity `2L–10L`; states Maharashtra/Delhi/Haryana; mandis Lasalgaon, Nashik, Azadpur.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/profile` ("Vyapari Business Profile & APMC Mandi Registration") | Profile form loads with sections: Shop KYC gate banner, Firm & Trade Identity, Operating States chips, Mandis chips |
| 2 | Clear the **Shop Name** field → click **Save Business Profile** | Save is rejected with a message that **shop name is required** (backend `422`) |
| 3 | Enter Shop Name `Anil Agro Traders`; Business type `Mandi Trader`; Years in trade `18`; Capacity band `2L–10L`; logo URL (any https image URL) | Values accepted; no validation errors |
| 4 | Click Operating States chips **Maharashtra, Delhi, Haryana** | All 11 states are offered as chips; the 3 chosen chips stay selected |
| 5 | Add mandis **Lasalgaon, Nashik, Azadpur** | Mandi chips are added and removable |
| 6 | Click **Save Business Profile** | "Profile saved" confirmation; on reload the values persist (verify via `GET /seller/profile`) |
| 7 | Check the header badge and the buttons **Complete Shop KYC**, **Bank Accounts (payouts)** | KYC status badge visible; buttons navigate to `/kyc` and `/bank-accounts` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-04: Field validation on business profile (GSTIN, enums, years)
- **Module:** 1. Registration & Onboarding / Business Profile validation — **Priority:** P1
- **Roleplay:** You are Anil. You mistype your GSTIN and try odd values — the form must stop you.
- **Preconditions:** Logged in; on `/seller/profile`.
- **Test data:** Invalid GSTIN `27ABCDE1234F1Z` (14 chars); valid GSTIN `27ABCDE1234F1Z5`; years `-1` and `81`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Enter GSTIN `27ABCDE1234F1Z` (14 chars) → Save | Rejected: `INVALID_GSTIN` / "GSTIN must be 15 characters" (`422`) |
| 2 | Enter GSTIN `27ABCDE1234F1Z5` → Save | Saved OK |
| 3 | Clear the GSTIN field → Save | Saved OK — blank GSTIN is allowed and clears the stored value |
| 4 | Enter Years in trade `-1` → try Save | Rejected (allowed range `0–80`) |
| 5 | Enter Years in trade `81` → try Save | Rejected (allowed range `0–80`) |
| 6 | Via Swagger (`/docs`), `PUT /seller/profile` with `businessType: "invalid_type"` | `422`/`400` validation error — only `mandi_trader\|wholesaler\|processor\|retailer\|exporter` accepted |
| 7 | Via Swagger, `PUT /seller/profile` with `buyingCapacityBand: "5l_7l"` | Validation error — only `under_50k\|50k_2l\|2l_10l\|above_10l` accepted |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-05: Submit seller KYC case (doc matrix: apmc_licence + gst)
- **Module:** 1. Registration & Onboarding / KYC — **Priority:** P0
- **Roleplay:** You are Anil. To unlock rate posting and J-form procurement you must get your shop KYC verified.
- **Preconditions:** Logged in; profile saved.
- **Test data:** `apmc_licence` no. `APMCLSG-2019-04567`; `gst` no. `27ABCDE1234F1Z5`; a clear photo/JPG of each document.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | From `/seller/profile` click **Complete Shop KYC** → `/kyc` | KYC screen opens for persona seller |
| 2 | Start a new KYC case (`POST /kyc/cases`, persona `seller`) | Case created; the document checklist shows exactly two required doc types: **APMC Licence** and **GST** |
| 3 | Upload a photo for the APMC licence (`POST /kyc/cases/{caseId}/docs/{docId}/upload`) | Upload succeeds; doc marked uploaded |
| 4 | Upload a photo for the GST certificate | Upload succeeds |
| 5 | Open `GET /kyc/status` (via Swagger or the status shown on `/kyc`) | Case status is `PENDING` / `L2_REVIEW` (2-level verification flow: PENDING → L2_REVIEW → VERIFIED/REJECTED/RFI) |
| 6 | Check the `/seller/profile` header badge | Badge shows KYC **pending/under review**, not verified yet |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-06: [ADMIN] Approve seller KYC → VERIFIED badge
- **Module:** 1. Registration & Onboarding / KYC approval — **Priority:** P0
- **Roleplay:** You are Anil waiting for verification; Tester C acts as Admin.
- **Preconditions:** TC-VYP-05 submitted; super-admin panel access.
- **Test data:** Anil's KYC case.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | [ADMIN] Open the super-admin panel → KYC queue | Anil's seller case is listed with both docs (`apmc_licence`, `gst`) attached |
| 2 | [ADMIN] Review and **approve** the case | Case status flips to `VERIFIED` |
| 3 | Back as Anil, reload `/seller/profile` | Header badge now shows **VERIFIED**; the Shop KYC gate banner no longer blocks |
| 4 | Reload `/seller` dashboard | KYC-gated cards (rate posting, J-form) are now active |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-07: Add bank account + penny-drop verify + set primary
- **Module:** 1. Registration & Onboarding / Bank Accounts — **Priority:** P0
- **Roleplay:** You are Anil. You add your HDFC current account so settlements can be paid out.
- **Preconditions:** Logged in.
- **Test data:** A/C `50100234567890`, IFSC `HDFC0001234`, name `Anil Agrawal`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | From `/seller/profile` click **Bank Accounts (payouts)** → `/bank-accounts` | Bank accounts page opens (empty state if first time) |
| 2 | Click **Add Bank Account**, enter account no., IFSC, holder name → save | Account created (`POST /bank-accounts`); listed with status **unverified** |
| 3 | Click **Verify** on the new account (`POST /bank-accounts/{id}/verify`) | Penny-drop verification runs; status becomes **verified** (sandbox returns success) |
| 4 | Click **Set Primary** (`POST /bank-accounts/{id}/set-primary`) | Account marked primary; it shows as the payout account |
| 5 | Add a second (dummy) account → click **Delete** on it (`DELETE /bank-accounts/{id}`) | Second account is removed; primary account unchanged |
| 6 | Open `/seller/settlements` | Payout Account card shows the verified primary account, masked A/C + IFSC |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-08: Negative login — wrong MPIN, logout, session list
- **Module:** 1. Registration & Onboarding / Auth negatives — **Priority:** P1
- **Roleplay:** You are Anil. You fumble your MPIN and want to check where you're logged in.
- **Preconditions:** Logged in on one browser; second browser available.
- **Test data:** Wrong MPIN `9999`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Log out; on login enter MPIN `9999` | Login rejected with "wrong MPIN" (401); no session created |
| 2 | Repeat wrong MPIN quickly 10+ times | Rate limit kicks in (10 logins / 10 min per IP+phone) — further attempts rejected with a rate-limit message |
| 3 | Wait out the limit / use demo bypass, log in again | Login succeeds |
| 4 | Open account/session settings; call `GET /auth/sessions` via Swagger | Active sessions list shows this device |
| 5 | `POST /auth/logout` then call a protected API like `GET /seller/profile` | `401` — token invalid after logout |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-09: हिन्दी language — onboarding labels & dashboard
- **Module:** 1. Registration & Onboarding / Language — **Priority:** P1
- **Roleplay:** You are Anil. You prefer हिन्दी; switch the panel and check labels.
- **Preconditions:** Logged in.
- **Test data:** Language = हिन्दी.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open profile/settings → switch language to **हिन्दी** (registration field `language` = `hi`) | UI reloads in हिन्दी |
| 2 | Open `/seller` | Dashboard cards, KPI labels and the 4 tabs show हिन्दी labels — no English placeholder text, no overflowing/truncated labels |
| 3 | Open `/seller/profile` | Section titles and business-type options appear in हिन्दी (e.g., trader labels translated) |
| 4 | Switch back to English | UI returns to English cleanly |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-10: Shop KYC gate — rate posting & J-form blocked before KYC (negative)
- **Module:** 1. Registration & Onboarding / KYC gate — **Priority:** P0
- **Roleplay:** You are a brand-new trader whose KYC is NOT yet approved. The platform must block KYC-gated actions.
- **Preconditions:** Use the **unverified** account from TC-VYP-02 (do NOT approve its KYC), or temporarily flag Anil's as unverified via Swagger.
- **Test data:** Rate: Onion @ Lasalgaon ₹18/kg; J-form: any entry.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | As the unverified trader, open `/seller/rates` → **Post Rate** → submit Onion @ Lasalgaon ₹18/kg | Blocked: `403 SHOP_KYC_REQUIRED` with a message to complete Shop KYC |
| 2 | Open `/seller/procure` → **Generate New J-Form** → submit any valid entry | Blocked: `403 SHOP_KYC_REQUIRED` |
| 3 | Open `/seller/profile` | Shop KYC gate banner still shows the blocked features (rate posting, J-form procurement) |
| 4 | (Cleanup) Re-verify Anil's main account per TC-VYP-06 for later modules | Gate lifted again |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 2 — Home / Dashboard

Covers: `/seller` landing with 8 parallel endpoints, KPI cards, pickups/escrow cards, Enterprise Hub (23 modules), and the 4 tabs — Store Products, Mall Orders, Procurement (J-Form), Khata & POS — plus cashflow.

---

### TC-VYP-11: Dashboard loads all sections and shows 4 KPI cards
- **Module:** 2. Home / Dashboard — **Priority:** P1
- **Roleplay:** You are Anil starting your day — check today's numbers at a glance.
- **Preconditions:** Logged in; at least one prior booking so KPIs are non-zero (else verify empty-state zeros).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller` | "Agri Vyapari & Retailer Suite" loads with no errors (it calls 8 endpoints in parallel: dashboard, cashflow, products, orders, procurement, ledgers, stock, purchases) |
| 2 | Check **KPI card 1 — Today's Procurement** | Shows ₹ amount, quantity and lot count (matches your actual bookings today, else 0) |
| 3 | Check **KPI card 2 — Pending Farmer Payments** | Shows ₹ + count and is "pinned" on the card; matches `pendingFarmerPayments` |
| 4 | Check **KPI card 3 — Udhar Outstanding** | Shows ₹ + debtor count; matches `udhaarOutstanding.netPaisa` |
| 5 | Check **KPI card 4 — Open Offers/Negotiations** | Shows count of offers with rates pending review |
| 6 | Check the **Upcoming Pickups & Logistics** card | Lists crop, qty, date/slot, vehicle, grace minutes; **View All →** goes to `/seller/purchases` |
| 7 | Check **Pending Advances & Trade Alerts** card | "Escrow Queue" item shows a **Deposit** button → `/seller/purchases` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-12: Enterprise Hub — 23-module feature directory grid
- **Module:** 2. Home / Dashboard / Enterprise Hub — **Priority:** P2
- **Roleplay:** You are Anil exploring what the suite offers.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller` scroll to "Vyapari Enterprise Hub — Full Feature Directory (23 Modules)" | Grid of 23 module tiles is rendered |
| 2 | Click the tiles for Lots, Purchases, Demands, Rates, Stock, POS, Orders, Settlements | Each tile opens the matching `/seller/...` screen without error |
| 3 | Click the remaining tiles one by one | All 23 tiles link to working screens (no dead links, no blank pages) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-13: Store Products tab — SKU table, ±10 restock, Add New SKU
- **Module:** 2. Home / Dashboard / Store Products tab — **Priority:** P1
- **Roleplay:** You are Anil adding your first shop SKU from the dashboard.
- **Preconditions:** Logged in.
- **Test data:** Title `Kisan Urea 45kg`, Brand `AgroGrow`, Category `Fertilizers`, Price `280`, MRP `300`, Stock `100`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller` open tab **Store Products** | SKU table loads with columns title/brand/batchNo, category, price/MRP, stock |
| 2 | Click **Add New SKU** | Modal opens with fields: Title*, Brand*, Category (Seeds / Fertilizers / Crop Protection / Tools & Machinery / Cattle Feed), Price*, MRP, Stock qty* |
| 3 | Click Save with all fields empty | Validation errors on Title, Brand, Price, Stock (required) |
| 4 | Fill the test data → Save | SKU created; an auto **batchNo `SLR-…`** is assigned; row appears in the table; followers get a "New listing / नई लिस्टिंग" notification (check bell) |
| 5 | On the new row click **+10** then **−10** | Stock cell updates `100 → 110 → 100` immediately |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-14: Mall Orders tab — order cards, status badge, per-status action
- **Module:** 2. Home / Dashboard / Mall Orders tab — **Priority:** P1
- **Roleplay:** You are Anil checking customer orders for your store.
- **Preconditions:** Logged in; at least one order exists (place one as the E-Market Customer persona first if empty — 🔄).
- **Test data:** Any customer order.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller` open tab **Mall Orders** | Order cards list with buyer info, status badge and total ₹ |
| 2 | Look at a `placed` order card | Action button **Confirm** (or equivalent per-status action) + **Detail** link are present |
| 3 | Click **Detail** | Opens `/seller/orders/{id}` with items, timeline and status-advance button |
| 4 | Return to the tab; check cards in other statuses | Each status shows its correct action button (see TC-VYP-083 for full transition walk) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-15: Procurement (J-Form) tab — stats + Generate New J-Form modal
- **Module:** 2. Home / Dashboard / Procurement (J-Form) tab — **Priority:** P1
- **Roleplay:** You are Anil recording mandi arrivals at your shop counter.
- **Preconditions:** Logged in; Shop KYC verified (TC-VYP-06).
- **Test data:** Farmer `Ramesh Patil` (ph `98220 00001`), Crop `Onion`, net qty `25` q, rate `₹1,450/q`, deduction `2%`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller` open tab **Procurement (J-Form)** | Stats line shows totalProcuredQuintals, totalPayoutAmount, pendingPayouts, totalLots; J-form list below |
| 2 | Click **Generate New J-Form** | Modal opens: farmer name*, farmer phone, crop*, net qty q*, rate ₹/q*, quality deduction % (0–50) with **live gross → net calculation** |
| 3 | Enter qty `25`, rate `1450`, deduction `2%` | Live calc shows gross `₹36,250` → deduction `₹725` → final `₹35,525` |
| 4 | Enter deduction `51%` → try to submit | Rejected — deduction must be within 0–50 |
| 5 | Submit with deduction `2%` | J-form created with auto number `JFORM-YYYYMMDD-XXXX`; appears in the list (full farmer-mirror checks in Module 6) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-16: Khata & POS tab — udhar banner, top khata accounts, Record Counter Sale
- **Module:** 2. Home / Dashboard / Khata & POS tab — **Priority:** P1
- **Roleplay:** You are Anil selling over the counter on credit (udhaar) to regular buyers.
- **Preconditions:** Logged in; Shop KYC verified.
- **Test data:** Buyer `Raju Vegetable Mart`, item `Onion`, qty `50`, unit `kg`, rate `16`, mode `cash`, amount paid `816`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller` open tab **Khata & POS** | Udhar summary banner shows total outstanding + Top Khata Accounts list; **Open Full POS Desk → /seller/pos** button present |
| 2 | Click **Record Counter Sale** | Modal opens: buyer*, item*, qty*, rate*, payment mode (cash / upi / bank_transfer / credit), amount paid |
| 3 | Click Save with buyer/qty/rate empty | Validation errors on required fields |
| 4 | Fill the test data (mode `cash`, paid `816`) → Save | Sale recorded; auto bill number `INV-YYYYMMDD-XXXX`; banner totals update (full POS checks in Module 8) |
| 5 | Click **Open Full POS Desk** | `/seller/pos` opens |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-17: Cashflow totals & breakdowns
- **Module:** 2. Home / Dashboard / Cashflow — **Priority:** P1
- **Roleplay:** You are Anil reviewing money in vs money out.
- **Preconditions:** Logged in; some sales and purchases recorded.
- **Test data:** Date range: last 30 days.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller` find the cashflow section (or open `/seller/pos` → Cashflow panel) | Cashflow loads via `GET /seller/cashflow?from=&to=` |
| 2 | Check totals | Shows **inflow, outflow, net** for the range |
| 3 | Check the byMonth chart/data | Last 12 months listed with per-month in/out |
| 4 | Check breakdowns | Four buckets present: procurementOut, purchasePaymentsOut, salesIn, purchaseCollectionsIn |
| 5 | Enter an invalid date format in the API via Swagger (`GET /seller/cashflow?from=22-10-2026`) | Rejected — dates must be `YYYY-MM-DD` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.1 — Produce Discovery & Booking (buying from farmers)

Covers: `/seller/lots` and `/seller/procure` browse, crop/grade chips, radius, client-side filters, sorting, map view, saved searches with alerts, Make Offer, Book Lot with 15% advance escrow, partial-quantity booking, and probation caps.

---

### TC-VYP-18: Browse lots — chips, filters, sort, map view
- **Module:** 3.1 Produce Discovery & Booking / Browse — **Priority:** P0
- **Roleplay:** You are Anil looking for onion lots near Nashik to buy.
- **Preconditions:** Logged in; Farmer Ramesh has posted the reference lot (Onion Grade A 100 q ₹1,450/q, Nashik).
- **Test data:** Crop chip Onion; grade A; radius 100 km; filters min qty `20` q, max ₹/qt `1600`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/lots` (fallback `/seller/procure`) | Lot discovery loads; lot cards show crop, grade, qty, rate, distance/location |
| 2 | Check the crop chips | Chips: All, Soybean, Onion, Wheat, Cotton, Maize, Tomato, Turmeric, Chilli; select **Onion** — list filters |
| 3 | Select grade filter **A** and grades list | Grades offered: All / A / B / C / Ungraded; list filters further |
| 4 | Move the radius slider to `100` km | Only lots within 100 km show (slider range 10–500 km) |
| 5 | Apply client filters: min qty `20` q, max rate `₹1600/q` | Ramesh's lot (100 q @ ₹1,450) remains visible; out-of-range lots disappear |
| 6 | Change sort: nearest → price asc → price desc → recency | List re-orders correctly for each sort |
| 7 | Switch to **Map View** | Mock cluster pins render; click a pin → lot summary with **Book** option appears |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-19: Save this search & set alerts
- **Module:** 3.1 Produce Discovery & Booking / Saved searches — **Priority:** P2
- **Roleplay:** You are Anil. You don't want to re-filter every morning — save the search with alerts.
- **Preconditions:** On `/seller/lots` with filters applied (Onion, Maharashtra).
- **Test data:** queryText `Onion Nashik under 1600`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Click **Save This Search & Set Alerts** | Dialog with query text, crop, state, alerts toggle |
| 2 | Enable alerts → **Activate Alert** (`POST /saved-searches`) | "Search saved / alert activated" confirmation; saved search listed in your profile/searches |
| 3 | Re-run the same save | A duplicate is created or the existing one updates without error (no crash) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-20: Make Offer on a lot (95% prefill + validation)
- **Module:** 3.1 Produce Discovery & Booking / Offers — **Priority:** P1
- **Roleplay:** You are Anil. ₹1,450 is steep; you offer slightly less per quintal.
- **Preconditions:** On `/seller/lots`; reference lot visible.
- **Test data:** Offer `₹1,380/q` (prefilled suggestion = 95% of ₹1,450 = `₹1,377.5`); invalid offer `-50`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On Ramesh's lot card click **Make Offer** | Modal opens: bid ₹/q field **prefilled at 95% of list price**, qty, message |
| 2 | Without changing anything click Send | Offer sent at the prefilled 95% value (`POST /offers` targetType `lot`) |
| 3 | Open Make Offer again, enter `-50` → Send | Rejected — price must be positive |
| 4 | Send a real offer at `₹1,380/q` qty `40` q with message "A-grade Nashik onion, regular buyer" | Offer created; appears under Offers I Sent with status `pending` and **expiry countdown "Expires in Xh Ym"** (24 h expiry) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-21: Book a lot — Book Lot modal, 15% advance escrow prefill, booking created
- **Module:** 3.1 Produce Discovery & Booking / Book Lot — **Priority:** P0 (money)
- **Roleplay:** You are Anil. You agree to the rate and book 40 quintals, paying the advance into escrow.
- **Preconditions:** On `/seller/lots`; reference lot OPEN; escrow channel test UPI ready.
- **Test data:** Qty `40` q → total `₹58,000`; advance prefilled 15% = `₹8,700`; UTR `UTRTEST001`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the lot card click **Book Lot** | Modal shows lot summary + advance escrow ₹ field **prefilled at 15% of total** |
| 2 | Change advance to `₹50` → try to continue | Rejected — minimum advance is ₹100 |
| 3 | Keep prefilled `₹8,700`; choose channel **UPI Escrow (Instant)**; enter UTR `UTRTEST001` → Confirm | `POST /purchases` {lotId, quantity 40} creates a purchase (status `confirmed`); advance auto-pays; payment of ₹8,700 recorded (kind `advance`) |
| 4 | Open `/seller/purchases` | New purchase visible under tab **All Orders** (and Needs Advance until advance clears) |
| 5 | 🔄 Second tester: on Farmer Ramesh's device, open the bell | Farmer received `booking_confirmed` notification naming Anil/crop/qty (see 07_cross_persona_e2e.md) |
| 6 | 🔄 Farmer opens the purchase chat | A chat room was auto-created post-booking; farmer can message Anil |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-22: Partial-quantity booking decrements the lot; drained lot → sold; booking a closed lot fails
- **Module:** 3.1 Produce Discovery & Booking / Partial qty — **Priority:** P1
- **Roleplay:** You are Anil. You buy in parts; the remaining lot must shrink for everyone.
- **Preconditions:** Reference lot (100 q) still open after TC-VYP-21 (60 q remain).
- **Test data:** Second booking qty `60` q (all remaining).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | After the 40 q booking, reload `/seller/lots` | Ramesh's lot now shows `60` q available (partial booking decremented it) |
| 2 | Book the remaining `60` q with a valid advance | Booking succeeds; lot qty drops to 0 and lot status flips to `sold` |
| 3 | Try to book the same (now sold) lot again (`POST /purchases` with its lotId via Swagger) | `409 LOT_NOT_OPEN` — booking rejected |
| 4 | Via Swagger, `POST /purchases` with quantity `0` | `422` — quantity must be positive; with qty above availability it clamps to the available quantity |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-23: Probation caps — max 3 bookings / ₹50k escrow for unverified vyapari
- **Module:** 3.1 Produce Discovery & Booking / Probation — **Priority:** P1
- **Roleplay:** You are a NEW trader without the Verified badge yet. The system must cap your exposure.
- **Preconditions:** Use an unverified seller account (no `vyapariVerified` flag). Ensure several open lots exist (ask Ramesh to post more).
- **Test data:** 4 bookings; one booking with advance > ₹50,000 cumulative.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | With the unverified account, book 3 lots successfully | First 3 bookings succeed (count non-cancelled bookings) |
| 2 | Attempt a 4th booking (`POST /purchases` via Swagger) | `403 PROBATION_BOOKING_CAP` — max 3 concurrent bookings on probation |
| 3 | Attempt an advance/escrow that pushes cumulative escrow above `₹50,000` | `403 PROBATION_ESCROW_CAP` |
| 4 | Complete 3 bookings end-to-end (lifecycle from TC-VYP-29…TC-VYP-35, can be done over the test week) | After the 3rd completed booking the account auto-receives `vyapariVerified` + `vyapariVerifiedAt`; the **Verified Vyapari badge** surfaces to farmers |
| 5 | After verification, attempt the 4th booking again | Now succeeds — caps are probation-only |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.2 — Purchase Lifecycle / My Purchases (core state machine)

Covers: `/seller/purchases` status tabs; state machine `confirmed → advancePaid → pickupScheduled → inTransit → delivered → completed | qcDisputed → completed`, `cancelled` from confirmed/advancePaid/pickupScheduled; escrow rules (advance = escrow funding, hold/release/refund, release clock via OTP, dispute freeze); handover OTP; QC; balance payment; GST invoice; receipt & commission; disputes; ratings; chat. Also the ⚠️ spec-delta cases at the end of the module.

---

### TC-VYP-24: Purchases screen — status tabs, 5-step stepper, banners
- **Module:** 3.2 Purchase Lifecycle / Purchases screen — **Priority:** P1
- **Roleplay:** You are Anil checking where your orders stand.
- **Preconditions:** At least one purchase in `confirmed` state (from TC-VYP-21).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/purchases` | Status tabs: **All Orders / Needs Advance (confirmed) / Ready for Pickup (advancePaid) / Pickup Scheduled / In Transit / QC & Acceptance (delivered) / Completed** |
| 2 | Open the confirmed purchase card | 5-step stepper shown: 1. Confirmed → 2. Advance Paid → 3. Pickup Set → 4. Dispatched → 5. QC & Settled; current step highlighted |
| 3 | Inspect card banners | Pickup banner (date/slot/agent/vehicle/grace), QC banner, escrow banner present as applicable |
| 4 | Check buttons on a `confirmed` card | **Deposit Advance Escrow**, **Fund Full Escrow**, **Cancel Per Policy**, **Dispute** (+ **Chat** once confirmed) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-25: Deposit advance escrow (channels, min/max, farmer notification)
- **Module:** 3.2 Purchase Lifecycle / Advance escrow — **Priority:** P0 (money)
- **Roleplay:** You are Anil. Your booking is confirmed; you fund the advance into escrow so the farmer sees you're serious.
- **Preconditions:** Purchase in `confirmed`; test UPI/NEFT references ready.
- **Test data:** Advance `₹8,700`; UTR `UTRTEST002`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the confirmed purchase click **Deposit Advance Escrow** | Modal: amount (min ₹100, max total `₹58,000`, prefilled 15%), channel select **UPI Escrow (Instant) / NEFT-RTGS / Kisan Setu Escrow Wallet**, UTR ref |
| 2 | Enter amount `₹58,001` → try submit | Rejected — advance cannot exceed total |
| 3 | Enter `₹8,700`, channel **UPI Escrow (Instant)**, UTR `UTRTEST002` → confirm | `POST /purchases/{id}/advance` succeeds; purchase → `advancePaid`; escrow status `held`; payment (kind `advance`) appears in `payments[]` |
| 4 | 🔄 Farmer bell | Ramesh receives `payment_received`/`escrow_funded` notification (advance amount shown) |
| 5 | Verify money on both sides | Buyer side: ₹8,700 debited from your payment method, escrow shows `held ₹8,700`. Farmer side: shows escrow held (not yet payout) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-26: Fund full escrow (amount ≤ total; already-held conflict)
- **Module:** 3.2 Purchase Lifecycle / Full escrow — **Priority:** P1
- **Roleplay:** You are Anil. For a smaller lot you fund the entire amount upfront instead of an advance.
- **Preconditions:** A second purchase in `confirmed` state (book another small lot with Ramesh, e.g. 5 q).
- **Test data:** Full amount = total (e.g. `₹7,250` for 5 q @ ₹1,450).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the small confirmed purchase click **Fund Full Escrow** | Modal prefilled with the full total `₹7,250` |
| 2 | Try amount `₹7,251` | Rejected — amount must be 1..totalAmount |
| 3 | Confirm prefilled full amount (`POST /purchases/{id}/escrow/fund`) | Escrow `held` for full amount; payment kind `escrow` recorded |
| 4 | Try **Fund Full Escrow** again on the same purchase | `409` — escrow already held |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-27: Cancel per policy from confirmed — reason + auto escrow refund
- **Module:** 3.2 Purchase Lifecycle / Cancel — **Priority:** P0 (money)
- **Roleplay:** You are Anil. The farmer hasn't arranged transport; you cancel under policy.
- **Preconditions:** A purchase in `confirmed` with advance funded (use a separate small booking for this case).
- **Test data:** Reason "Moisture above agreed 8% at farm gate; mutually cancelled."

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the confirmed purchase click **Cancel Per Policy** | Modal with reason textarea (prefilled moisture text) |
| 2 | Submit with empty reason | Validation — reason required |
| 3 | Enter the reason → Confirm (`POST /purchases/{id}/cancel`) | Purchase → `cancelled` (terminal); escrow auto-refunded: status `refunded`, amount returned |
| 4 | Verify refund | Your payment method/ledger shows the advance refunded in full; commission NOT charged on cancelled purchase |
| 5 | 🔄 Farmer bell | Ramesh receives `booking_cancelled` notification with the reason |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-28: Negative — cancel an already-delivered purchase
- **Module:** 3.2 Purchase Lifecycle / Cancel illegal transition — **Priority:** P1
- **Roleplay:** You are Anil trying to wriggle out of a done deal — the system must refuse.
- **Preconditions:** A purchase already in `delivered` (run TC-VYP-31 first).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the delivered purchase look for **Cancel Per Policy** | Button absent |
| 2 | Via Swagger call `POST /purchases/{id}/cancel` | `409`/error — cancel allowed only from `confirmed`/`advancePaid`/`pickupScheduled` |
| 3 | Try `POST /purchases/{id}/pay` on a `cancelled` or `completed` purchase | Rejected — terminal purchases reject payments |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-29: Schedule pickup slot & agent
- **Module:** 3.2 Purchase Lifecycle / Pickup scheduling — **Priority:** P0
- **Roleplay:** You are Anil. Advance is paid; you book a pickup slot and assign your agent Sham.
- **Preconditions:** Purchase in `advancePaid` (from TC-VYP-25).
- **Test data:** Tomorrow's date; slot `09-11`; agent from list; grace `60 min`; vehicle `MH-12-AB-1234`; type `Bolero Pickup`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the advancePaid purchase click **Schedule Pickup Slot & Agent** | Modal: date*, slot select (**06-07 / 07-08 / 09-11 / 14-16 / 17-19**), agent select (loads `GET /pickup/agents` — seeded agents `pa_sham`, `pa_suresh`), grace (**30 / 60 / 120**), vehicle number (default `MH-12-AB-1234`), vehicle type (default Bolero Pickup), farmgate address |
| 2 | Try submitting without a date | Validation — date required |
| 3 | Fill test data → Confirm (`POST /purchases/{id}/pickup`) | Purchase → `pickupScheduled`; pickup banner shows date/slot/agent/vehicle/grace; note "24h & 2h FCM alerts" shown |
| 4 | 🔄 Farmer bell | Ramesh receives `pickup_scheduled` notification (date, slot, vehicle) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-30: Mark dispatch (pickupScheduled → inTransit)
- **Module:** 3.2 Purchase Lifecycle / Dispatch — **Priority:** P1
- **Roleplay:** You are Anil. Sham has loaded the vehicle; you mark dispatch.
- **Preconditions:** Purchase in `pickupScheduled`.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the purchase click **Mark Dispatch** (`POST /purchases/{id}/dispatch`) | Purchase → `inTransit`; stepper advances to Dispatched |
| 2 | 🔄 Farmer bell | Ramesh receives `dispatched` notification |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-31: Mark delivered + farmer asked to share handover OTP
- **Module:** 3.2 Purchase Lifecycle / Delivered — **Priority:** P1
- **Roleplay:** You are Anil. The vehicle reached your shop; you mark delivery.
- **Preconditions:** Purchase in `inTransit`.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the purchase click **Mark Delivered** (`POST /purchases/{id}/deliver`) | Purchase → `delivered`; QC banner appears |
| 2 | 🔄 Farmer bell | Ramesh receives `delivered` notification — **"share the handover OTP now"**; the handover OTP (6-digit, 15-min validity) is visible to the farmer on the purchase |
| 3 | Check your own card | **Verify Handover OTP** button present; the OTP itself is NOT visible to you (buyer view redacted) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-32: Verify handover OTP — correct OTP starts the release clock
- **Module:** 3.2 Purchase Lifecycle / Handover OTP — **Priority:** P0 (money)
- **Roleplay:** You are Anil. Ramesh reads out the OTP at unloading; you verify it to unlock settlement.
- **Preconditions:** Purchase `delivered`; escrow `held`; farmer (Tester B) has the OTP on his screen.
- **Test data:** 6-digit OTP from Ramesh's screen.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Ask 🔄 Ramesh (second tester) to open the purchase and read the 6-digit handover OTP | Farmer shows OTP (generatedAt/expiresAt visible; valid 15 min) |
| 2 | Enter the OTP → **Verify** (`POST /purchases/{id}/handover/verify`) | OTP accepted; `handover.verifiedAt` set; **escrow release clock starts** (start_clock) |
| 3 | 🔄 Farmer bell | Ramesh receives `handover_verified` notification |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-33: OTP negatives — wrong OTP, 5-attempt lock, single use, not-generated
- **Module:** 3.2 Purchase Lifecycle / Handover OTP negatives — **Priority:** P1
- **Roleplay:** You are Anil typing the OTP in a hurry — mistakes must be handled safely.
- **Preconditions:** A second delivered purchase (book + advance + pickup + dispatch + deliver quickly, or reuse another lot).
- **Test data:** Wrong OTP `000000` (5 times).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On a delivered purchase enter a wrong OTP → Verify | Rejected — attempt counted (handover.attempts increments); helpful error |
| 2 | Repeat wrong OTP until 5 attempts | 5th attempt → `429 TOO_MANY_ATTEMPTS`; OTP verification locked |
| 3 | 🔄 Ask Ramesh to regenerate the OTP (`GET /purchases/{id}/handover-otp` regenerates when expired — may need to wait for expiry) | New OTP issued to farmer |
| 4 | Verify the new OTP, then try the same OTP again | Second verify → `409 ALREADY_VERIFIED` (single use) |
| 5 | Via Swagger on a fresh delivered purchase with no farmer reveal, call handover/verify | `400 OTP_NOT_GENERATED` — farmer must reveal first |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-34: Negative — QC before handover OTP verified
- **Module:** 3.2 Purchase Lifecycle / QC gate — **Priority:** P1
- **Roleplay:** You are Anil trying to run QC before OTP — the system must force OTP first when escrow is held.
- **Preconditions:** Purchase `delivered`, escrow `held`, OTP NOT yet verified.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Look for **Conduct Digital QC Inspection** before OTP verification | Button hidden/disabled, or |
| 2 | Via Swagger call `POST /purchases/{id}/qc` directly | `400 HANDOVER_REQUIRED` — QC allowed only after handover verified when escrow is held |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-35: Digital QC — approve & release settlement (accepted = booked qty)
- **Module:** 3.2 Purchase Lifecycle / QC & release — **Priority:** P0 (money)
- **Roleplay:** You are Anil. The full 40 q arrived in good shape; you accept everything and release settlement.
- **Preconditions:** Purchase `delivered`; OTP verified (TC-VYP-32).
- **Test data:** Grade A; accepted `40` q; rejected `0`; notes "Good dry onion, sorted".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Click **Conduct Digital QC Inspection** | Modal: grade select (**Grade A / B / C / Rejected**), accepted qty*, rejected qty*, notes |
| 2 | Enter accepted `39`, rejected `0` → try Approve | Rejected — **accepted + rejected must equal booked qty 40** (client + server enforced, ±0.001) |
| 3 | Enter accepted `40`, rejected `0` → **Approve & Release Settlement** (`POST /purchases/{id}/qc`) | Purchase → `completed`; finalAmount = ₹58,000; escrow released = finalAmount − commission (2% min ₹50 → **₹1,160**); farmer payout **₹56,840** |
| 4 | Verify money on both sides | Your escrow shows `released`; farmer wallet/ledger shows payout ₹56,840 (gross 58,000 − 1,160) — **check both sides + commission** |
| 5 | 🔄 Farmer bell | Ramesh receives `deal_completed` notification with invoice/receipt no. |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-36: QC with rejections → qcDisputed → resolve → completed
- **Module:** 3.2 Purchase Lifecycle / QC dispute & resolve — **Priority:** P1 (money)
- **Roleplay:** You are Anil. 1 quintal arrived wet; you reject it and the escrow release pauses until resolved.
- **Preconditions:** A delivered purchase with OTP verified (book another 40 q lot with Ramesh, e.g. grapes this time).
- **Test data:** Accepted `39` q; rejected `1` q; final = `39 × 1,450 = ₹56,550`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Run QC with accepted `39`, rejected `1` → Approve | Purchase → `qcDisputed` (not completed); `escrow.disputeOpenedAt` set — **release paused**; farmer notified `qc_disputed` 🔄 |
| 2 | Check escrow banner | Shows release paused pending resolution |
| 3 | After agreeing with Ramesh, click **Resolve** / call `POST /purchases/{id}/resolve` with resolution note "1 q wet, pro-rata accepted" | Purchase → `completed`; escrow released at finalAmount ₹56,550 − commission ₹1,131 (2%) = **₹55,419** to farmer |
| 4 | Verify both sides | Farmer payout = ₹55,419; your ledger shows ₹56,550 settled |
| 5 | 🔄 Farmer bell | Ramesh receives `dispute_resolved` notification |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-37: QC photos (max 5; only in delivered/qcDisputed)
- **Module:** 3.2 Purchase Lifecycle / QC photos — **Priority:** P2
- **Roleplay:** You are Anil photographing the rejected bags as evidence.
- **Preconditions:** Purchase in `delivered` or `qcDisputed`.
- **Test data:** 5 photos of the lot.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Upload 5 QC photos (`POST /purchases/{id}/qc/photos`) | All 5 accepted and listed |
| 2 | Attempt a 6th photo | Rejected — max 5 |
| 3 | On a `completed` purchase attempt a QC photo | Rejected — photos allowed only in `delivered`/`qcDisputed` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-38: Pay balance (≤ due; exceeds-due 409; UTR auto)
- **Module:** 3.2 Purchase Lifecycle / Balance payment — **Priority:** P1 (money)
- **Roleplay:** You are Anil. After settlement you owe the farmer the balance by bank transfer.
- **Preconditions:** A `completed` purchase with due balance (e.g. J-form-linked or partially-paid purchase).
- **Test data:** Balance due e.g. `₹20,000`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the completed purchase click **Pay Balance** | Modal: amount (≤ due), kind `balance`, method `bank_transfer` |
| 2 | Enter amount above due (e.g. due+1) → submit | `409 PAYMENT_EXCEEDS_DUE` |
| 3 | Enter exact due → Confirm (`POST /purchases/{id}/pay`) | Payment recorded; UTR auto-generated; purchase `payments[]` shows kind `balance`; due → 0 |
| 4 | 🔄 Farmer bell | Ramesh receives `payment_received` with the balance amount |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-39: Invoice PDF download (GST invoice, 5% agri slab, CGST/SGST vs IGST)
- **Module:** 3.2 Purchase Lifecycle / Invoice — **Priority:** P1
- **Roleplay:** You are Anil. Your accountant needs the GST invoice for the purchase.
- **Preconditions:** A `completed` purchase.
- **Test data:** Purchase from TC-VYP-35 (₹58,000, intra-state Maharashtra).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the completed purchase click **Invoice (PDF)** (`GET /purchases/{id}/invoice.pdf`) | PDF downloads; opens without corruption |
| 2 | Check invoice contents | GST invoice with seller/buyer GSTIN, line amount ₹58,000, **5% agri slab**; intra-state shows **CGST 2.5% + SGST 2.5%** (of GST component) split |
| 3 | Check an inter-state purchase invoice (your Delhi-linked purchase if any, else note) | Inter-state shows **IGST** instead of CGST+SGST |
| 4 | Compare invoice totals with purchase | Taxable value, tax, grand total match the purchase finalAmount |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-40: Receipt with commission line (2% min ₹50, farmerPayout)
- **Module:** 3.2 Purchase Lifecycle / Receipt — **Priority:** P1 (money)
- **Roleplay:** You are Anil. You check the platform receipt to see what commission was taken.
- **Preconditions:** A `completed` purchase (TC-VYP-35).
- **Test data:** Commission 2% min ₹50 → ₹1,160 on ₹58,000.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `GET /purchases/{id}/receipt` (via Swagger or Receipt link) | Receipt shows **receiptNo `RCP-…`**, amount, commission block |
| 2 | Check commission block | `{pct: 2, amount: 1160, chargedFrom: 'buyer', farmerPayout: 56840}` — matches config 2% min ₹50 |
| 3 | Verify with the farmer side | Ramesh's receipt shows the same farmerPayout ₹56,840 — both sides agree |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-41: Open a dispute + append evidence (escrow paused; cancelled-purchase blocked)
- **Module:** 3.2 Purchase Lifecycle / Disputes — **Priority:** P1 (money)
- **Roleplay:** You are Anil. A delivery is short by 2 q; you open a dispute to freeze the escrow.
- **Preconditions:** A purchase in flight (delivered) that you will dispute; keep escrow held.
- **Test data:** Category `quantity`; reason "Only 38 q unloaded vs 40 q booked"; 2 photo URLs as evidence.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the purchase click **Dispute** | Modal: category (**quality / payment / delivery / quantity / other**), reason* |
| 2 | Submit with empty reason | Validation — reason required |
| 3 | Submit category `quantity` + reason (`POST /purchases/{id}/disputes`) | Dispute opened; **"escrow release paused"** shown; escrow `disputeOpenedAt` set |
| 4 | Append evidence (`POST /purchases/{id}/disputes/{did}/evidence` {note, photoUrls[2]}) | Evidence attached and listed |
| 5 | Try opening a second dispute on the same purchase | Rejected — one open dispute per purchase |
| 6 | On a `cancelled` purchase attempt `POST /purchases/{id}/disputes` | `409` — dispute blocked on cancelled purchase |
| 7 | Resolve the dispute (admin/tester agreed outcome) | Escrow release resumes (`disputeResolvedAt`); `dispute_resolved` notification to both 🔄 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-42: Rate the farmer (stars, tags, comment; one-time only)
- **Module:** 3.2 Purchase Lifecycle / Rating — **Priority:** P1
- **Roleplay:** You are Anil rating Ramesh for the smooth deal.
- **Preconditions:** A `completed` purchase not yet rated.
- **Test data:** 5 stars; tags `honest_weight`, `quality_produce`, `on_time`; comment "Clean sorted onion, on time."

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the completed purchase click **Rate Farmer** | Modal: 1–5 stars, tag chips (**fair_price / on_time / honest_weight / quality_produce / proper_packing**), comment |
| 2 | Submit with 0 stars | Validation — rating 1–5 required |
| 3 | Select 5 stars + 3 tags + comment → Submit (`POST /purchases/{id}/rate`) | Rating saved (target `farmer`); shown on the purchase |
| 4 | Try rating the same purchase again | `409 ALREADY_RATED` — one rating per direction |
| 5 | Via Swagger try rating a non-completed purchase | Rejected — rating allowed only on completed purchases |
| 6 | 🔄 Ramesh's ratings screen | Your rating appears on the farmer's profile |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-43: Purchase chat, OTP redaction on buyer API, pickup reminders
- **Module:** 3.2 Purchase Lifecycle / Chat & misc — **Priority:** P2
- **Roleplay:** You are Anil coordinating with the farmer in the purchase chat.
- **Preconditions:** A non-cancelled purchase.
- **Test data:** Message "Vehicle reaching by 10 AM, keep bags ready."

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Click **Chat** on the purchase → `GET /purchases/{id}/chat-room` → `/chat?room=…` | Chat room opens (auto-created at booking); you can send/receive messages |
| 2 | 🔄 Exchange 2 messages with Ramesh | Both sides see messages in real time |
| 3 | Via Swagger call `GET /purchases/{id}` as the buyer | Response contains the purchase but the **handover OTP is redacted** for buyer role |
| 4 | Check FCM/in-app reminders before the pickup slot | 24 h and 2 h pickup reminders arrive ("FCM 24h/2h Armed") |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-44: ⚠️ PAYMENT_HELD state & E18 unfunded-booking auto-cancel (spec delta)
- **Module:** 3.2 Purchase Lifecycle / Spec deltas — **Priority:** P1 ⚠️
- **Roleplay:** You are Anil. Per the spec, a booking that is not funded within the window should be auto-cancelled (E18) and pass through a PAYMENT_HELD state.
- **Preconditions:** A `confirmed` purchase with NO advance paid; ability to wait/observe (or ask dev to trigger the job).
- **Test data:** Unfunded booking observed for the auto-cancel window.

> **Known issue in current build — performing this case will likely FAIL; raise a defect.** The spec's richer booking states (PAYMENT_HELD, E18 unfunded-booking auto-cancel) are only partially realized; implemented states are confirmed/advancePaid/…/cancelled only.

| # | Step (what YOU do) | Expected result (CORRECT behavior per spec) |
|---|--------------------|-----------------|
| 1 | Create a booking and do NOT pay any advance | Booking exists in a `PAYMENT_HELD`/awaiting-payment state |
| 2 | Wait for the unfunded-booking window (per spec E18) or ask dev to run the job | Booking auto-cancels; farmer notified; lot quantity restored |
| 3 | Check the purchase status history | A `PAYMENT_HELD` status (or equivalent) exists in events[] |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-45: ⚠️ NO_SHOW states & no-show credits ₹300 (farmer) / ₹200 (buyer) (spec delta)
- **Module:** 3.2 Purchase Lifecycle / Spec deltas — **Priority:** P1 ⚠️
- **Roleplay:** You are Anil. Your pickup agent drives to the farm and the farmer never shows up; per spec the farmer gets a no-show flag and a ₹300 credit is due to you. Conversely if your agent no-shows, ₹200 is due to the farmer.
- **Preconditions:** A `pickupScheduled` purchase.
- **Test data:** No-show at the slot (agent arrives, farmer absent).

> **Known issue in current build — performing this case will likely FAIL; raise a defect.** NO_SHOW_* statuses, no-show credits (₹300/₹200) and the E1–E22 penalty matrix are not implemented.

| # | Step (what YOU do) | Expected result (CORRECT behavior per spec) |
|---|--------------------|-----------------|
| 1 | Let the pickup slot pass with no handover (farmer absent) | Purchase moves to a `NO_SHOW_FARMER` status; no-show recorded against the farmer |
| 2 | Check your account | ₹300 no-show credit applied to you; escrow refunded |
| 3 | Reverse scenario (your agent never arrives) | `NO_SHOW_BUYER` status; ₹200 credit to the farmer |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-46: ⚠️ Escrow T+24h auto-release (spec delta)
- **Module:** 3.2 Purchase Lifecycle / Spec deltas — **Priority:** P1 ⚠️
- **Roleplay:** You are Anil. Per spec, if you (the buyer) don't raise a dispute within 24 h of OTP-verified delivery, escrow auto-releases to the farmer.
- **Preconditions:** A delivered purchase with OTP verified; ability to observe for 24 h (or dev-triggered clock).
- **Test data:** —

> **Known issue in current build — performing this case will likely FAIL; raise a defect.** Escrow T+24h auto-release is listed as spec-only; implemented release paths are QC-approve and resolve.

| # | Step (what YOU do) | Expected result (CORRECT behavior per spec) |
|---|--------------------|-----------------|
| 1 | OTP-verify delivery and do nothing further | Release clock running (implemented) |
| 2 | Wait 24 h (T+24h) without QC/dispute | Escrow **auto-releases** to farmer at finalAmount − commission |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-47: ⚠️ 2-hour free-cancellation window & E1–E22 penalty matrix (spec delta)
- **Module:** 3.2 Purchase Lifecycle / Spec deltas — **Priority:** P2 ⚠️
- **Roleplay:** You are Anil. Per spec, cancelling within 2 h of booking is free; after that, the E-penalty matrix applies.
- **Preconditions:** Two bookings: one fresh (<2 h), one older (>2 h).
- **Test data:** —

> **Known issue in current build — performing this case will likely FAIL; raise a defect.** The 2h free-cancellation window and E1–E22 penalties are spec-only; implemented cancel is policy-based with auto refund and no penalty tiers.

| # | Step (what YOU do) | Expected result (CORRECT behavior per spec) |
|---|--------------------|-----------------|
| 1 | Cancel the fresh booking (<2 h old) | Free cancellation — full refund, **no penalty** |
| 2 | Cancel the older booking (>2 h old) | Penalty per E-matrix deducted from refund; penalty rule shown (e.g. E-tier) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-48: ⚠️ DISPUTED status should reflect on the purchase lifecycle (spec delta)
- **Module:** 3.2 Purchase Lifecycle / Spec deltas — **Priority:** P2 ⚠️
- **Roleplay:** You are Anil. You opened a dispute — per spec the purchase itself should show a DISPUTED lifecycle state, not just an escrow pause.
- **Preconditions:** A purchase with an open dispute (from TC-VYP-41).
- **Test data:** —

> **Known issue in current build — performing this case will likely FAIL; raise a defect.** Implemented behavior: dispute freezes escrow but the purchase status does not change to DISPUTED/CLOSED.

| # | Step (what YOU do) | Expected result (CORRECT behavior per spec) |
|---|--------------------|-----------------|
| 1 | Open a dispute on a delivered purchase | Purchase status shows **DISPUTED** (or CLOSED after resolution) in the stepper/tabs |
| 2 | Check `/seller/purchases` tabs | A DISPUTED filter/tab (or equivalent) lists disputed purchases |
| 3 | Resolve the dispute | Status flows DISPUTED → CLOSED with the resolution note in events[] |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.3 — Structured Offers / Negotiation engine

Covers: `POST /offers` (lot & demand targets, 24 h expiry, max 3 rounds), `/offers/mine?filter=sent|received`, accept → purchase creation (incl. partial-quantity accept), withdraw/reject/counter, expiry errors, and the `/seller/demands` manager sections (Offers I Sent / Offers Received).

---

### TC-VYP-49: Offers manager — tabs, statuses, expiry countdown, negotiation log
- **Module:** 3.3 Offers / Negotiation — **Priority:** P1
- **Roleplay:** You are Anil tracking every offer you've sent and received.
- **Preconditions:** TC-VYP-20 sent an offer; a demand of yours received an offer (from TC-VYP-52).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/demands` → section **Offers I Sent** | Each offer card shows status badge (pending/countered/accepted/rejected/withdrawn/expired), crop, counterparty, price ₹/q |
| 2 | Check a live offer card | **Expiry countdown "Expires in Xh Ym"** visible (24 h from creation) |
| 3 | Open an offer with negotiation history | **Negotiation log shows "Round n/3"** — max 3 rounds |
| 4 | Switch to **Offers Received** | Offers made against YOUR demands listed with pending status |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-50: Counter chain — farmer counters, you counter back, farmer accepts → purchase created
- **Module:** 3.3 Offers / Negotiation rounds — **Priority:** P1
- **Roleplay:** You are Anil haggling over grapes with Ramesh. After a counter-round you settle and he accepts — a purchase must be born from the accepted offer.
- **Preconditions:** An offer of yours is pending on a lot (counterparty = farmer). 🔄 Tester B (Ramesh) acts at each marked step.
- **Test data:** Your offer ₹1,380/q; farmer counters ₹1,430/q; you counter ₹1,410/q; farmer accepts at partial qty.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ramesh (farmer) opens the received offer and taps **Counter** at ₹1,430/q | On your side the offer shows `countered`, Round 2/3, price ₹1,430 |
| 2 | Open the offer → **Counter** → enter ₹1,410/q → send (`POST /offers/{id}/counter`) | Counter accepted; log shows Round 3/3 |
| 3 | Try to counter once more (via Swagger `POST /offers/{id}/counter`) | `409` — max 3 negotiation rounds reached |
| 4 | 🔄 Ramesh taps **Accept** for a partial quantity (e.g. 20 q of 40 q) | `create_purchase_from_offer` runs: a new purchase appears in your `/seller/purchases` (status `confirmed`, source offer, qty 20 q); the lot decrements by 20 q only |
| 5 | Check the offer status | Offer → `accepted` |
| 6 | If the offer was against a farmer DEMAND instead: farmer accepting your offer marks the demand `fulfilled` | Demand status `fulfilled` (ask 🔄 Ramesh to verify on his side) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-51: Withdraw an offer; expiry and reject errors
- **Module:** 3.3 Offers / Withdraw & expiry — **Priority:** P1
- **Roleplay:** You are Anil. You change your mind on one offer; another one sits past 24 h.
- **Preconditions:** One pending offer to withdraw; one offer you can let expire (or backdate via dev).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On a pending offer click **Withdraw** (`POST /offers/{id}/withdraw`) | Offer → `withdrawn`; farmer no longer sees it as actionable |
| 2 | Try accepting/withdrawing an already-`accepted` offer (via Swagger) | `400 OFFER_NOT_ACCEPTABLE` / not allowed — only `pending`/`countered` offers are actionable |
| 3 | After 24 h, try to accept the expired offer (via Swagger) | `400 OFFER_EXPIRED` |
| 4 | 🔄 Let Ramesh **reject** one of your pending offers | Offer → `rejected`; you see the rejection with his reason if given |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-52: Offers Received on my demand — Accept / Counter / Reject
- **Module:** 3.3 Offers / Received offers — **Priority:** P1
- **Roleplay:** You are Anil. Farmers quoted against your onion demand; you pick the best.
- **Preconditions:** A posted demand (TC-VYP-54) with at least one farmer offer. 🔄 Ramesh sends an offer to your demand.
- **Test data:** Farmer offer: Onion 100 q @ ₹1,390/q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ramesh sends an offer against your open demand | It appears in **Offers Received** with status `pending` |
| 2 | Open it → **Counter** → enter ₹1,400/q → send | Counter sent; negotiation log Round 2/3 |
| 3 | 🔄 Ramesh accepts your counter | Demand shows progress toward `fulfilled`; you are notified |
| 4 | On a second received offer click **Reject** with reason | Offer → `rejected`; farmer notified |
| 5 | Via Swagger try accepting your own offer | `400`/`403` — you cannot accept an offer you sent |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-53: Send Offer Quote against an open buyer demand
- **Module:** 3.3 Offers / Demand quotes — **Priority:** P1
- **Roleplay:** You are Anil. A Delhi buyer posted a demand for onion; you quote supply.
- **Preconditions:** A direct-buyer demand is open (visible in `/seller/demands` → Open Buyer Demands).
- **Test data:** Price ₹1,520/q; qty 200 q; message "Nashik red onion, 55mm+"; pickup date +7 days; payment terms 15 days; transport mode `buyerPickup`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/demands` → **Open Buyer Demands** | Demand cards show company, buyer, crop/variety, qty, max price, delivery location, valid-until |
| 2 | On a demand card click **Send Offer Quote** | Modal: price ₹/q*, qty*, message/specs, pickup date, payment terms days (0–120), transport mode (**buyerArranges / farmerDelivers / buyerPickup**) |
| 3 | Enter payment terms `121` | Rejected — allowed 0–120 days |
| 4 | Fill the test data → Send (`POST /offers` targetType `demand`) | Offer created and listed in **Offers I Sent**; the buyer sees it in their received offers 🔄 |
| 5 | 🔄 Buyer accepts | You receive an acceptance notification; status `accepted` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.4 — Demand Posting (reverse listing)

Covers: `POST /demands`, list with filters, edit (open only), close/reopen, delete (blocked by live offers), and standing orders.

---

### TC-VYP-54: Post a demand
- **Module:** 3.4 Demand Posting — **Priority:** P1
- **Roleplay:** You are Anil. You need 500 q onion every week for your Delhi channel, so you post a demand.
- **Preconditions:** Logged in.
- **Test data:** Crop `Onion`, variety `Red Nashik`, qty `500`, unit `quintal`, grade `A`, max price `₹1,500/q`, delivery `Nashik warehouse, Pathardi Rd`, neededBy +10 days, frequency `weekly`, notes "55mm+ sorted".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/demands` → click **Post Demand** | Modal with all fields: crop*, variety, quantity*, unit (**quintal / kg / tonne / litre**), qualityGrade (A/B/C), maxPrice*, deliveryLocation, neededBy, frequency (**oneTime / weekly / monthly**), notes |
| 2 | Submit with crop/qty/maxPrice empty | Validation errors on required fields |
| 3 | Enter qty `-10` | Rejected — quantity must be positive |
| 4 | Fill the test data → Submit (`POST /demands`) | Demand created, status `open`; it appears in your demands list and in farmers' demand exchange 🔄 |
| 5 | Via Swagger `GET /demands?status=open&crop=Onion` | Your demand listed; filters work |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-55: Edit / close / reopen a demand (+ illegal-edit negative)
- **Module:** 3.4 Demand Posting / Lifecycle — **Priority:** P2
- **Roleplay:** You are Anil tweaking your demand and pausing it when your godown is full.
- **Preconditions:** TC-VYP-54 demand is `open`.
- **Test data:** New max price `₹1,550/q`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the demand → **Edit** → change max price to `₹1,550/q` → save (`PUT /demands/{id}`) | Update saved; farmers see the new price |
| 2 | Click **Close** (`POST /demands/{id}/close`) | Status → `closed`; no longer listed as open |
| 3 | Try editing the closed demand (`PUT /demands/{id}`) | Rejected — edit allowed only on `open` demands |
| 4 | Click **Reopen** (`POST /demands/{id}/reopen`) | Status → `open` again |
| 5 | Via Swagger reopen an already-open demand | Error — reopen requires a `closed` demand |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-56: Delete demand blocked by live offers; delete succeeds after withdraw
- **Module:** 3.4 Demand Posting / Delete rules — **Priority:** P1
- **Roleplay:** You are Anil. You can't delete a demand that farmers are actively quoting on.
- **Preconditions:** An open demand with one live (pending) farmer offer on it.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Try **Delete** on the demand with the live offer (`DELETE /demands/{id}`) | `409 DEMAND_HAS_OFFERS` — blocked |
| 2 | 🔄 Ask Ramesh to withdraw/reject his offer (or you reject it) | Offer no longer live |
| 3 | Delete again | Demand deleted and disappears from the list |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-57: Standing (recurring) order
- **Module:** 3.4 Demand Posting / Standing orders — **Priority:** P2
- **Roleplay:** You are Anil setting a recurring weekly soybean requirement.
- **Preconditions:** Logged in.
- **Test data:** Crop `Soybean`, min ₹3,800/q, max ₹4,200/q, qty/slot `50` q, frequency `weekly`, start +3 days, end +90 days.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller/demands` click **Post Standing Order** | Modal: crop*, minPrice*, maxPrice*, quantityPerSlot*, frequency (**daily / weekly / monthly**), startDate*, endDate* |
| 2 | Submit with endDate before startDate | Rejected by date validation |
| 3 | Fill the test data → Submit (`POST /direct-buyer/standing-orders`) | Standing order created; listed in your standing orders |
| 4 | Open the standing board (`GET /demands/standing`) | Your order appears for matching sellers/farmers |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.5 — Mandi Rate Posting (S2)

Covers: `POST /seller/rates` (Shop-KYC gate, ±25% band vs Agmarknet modal, AI manipulation flag), 2-hour edit window, My Posted Rates statuses, and the APMC modal reference table.

---

### TC-VYP-58: Post a mandi rate (band hint, pending moderation, [ADMIN] approval)
- **Module:** 3.5 Mandi Rates / Post — **Priority:** P1
- **Roleplay:** You are Anil at Lasalgaon. Onion is trading at ₹18/kg today; you post the rate.
- **Preconditions:** Shop KYC VERIFIED (else 403 — tested in TC-VYP-10).
- **Test data:** Crop `Onion`, mandi `Lasalgaon`, rate `₹18/kg`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/rates` → click **Post Rate** | Modal: crop*, mandi*, ₹/kg with **live allowed-band hint** (±25% around Agmarknet modal) |
| 2 | Read the band hint, then enter `18` within the band → Submit (`POST /seller/rates`) | Rate submitted; status `pending` (moderation queue) |
| 3 | Check **My Posted Rates** | New rate shows as **pending** with the legend (pending = moderation queue / approved / rejected) |
| 4 | [ADMIN] Open super-admin rate moderation queue → approve the rate | Rate status → `approved` |
| 5 | Reload `/seller/rates` | Your rate now shows `approved`; visible in mandi price references |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-59: Out-of-band rate rejected (±25%) with हिन्दी message
- **Module:** 3.5 Mandi Rates / Band validation — **Priority:** P1
- **Roleplay:** You are Anil accidentally posting ₹99/kg for onion — the band check must stop manipulation.
- **Preconditions:** On `/seller/rates`; modal's band hint visible.
- **Test data:** Rate far above band, e.g. `₹99/kg`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | In Post Rate modal enter `₹99/kg` (outside the shown minAllowed–maxAllowed) → Submit | Rejected: `422 RATE_OUT_OF_BAND` showing **minAllowed/maxAllowed** |
| 2 | Switch language to **हिन्दी** and repeat | Error message in हिन्दी: **"मंडी भाव ₹X के ±25% सीमा से बाहर"** (labels render correctly, no overflow) |
| 3 | Check an extreme repeated pattern | Rates with AI `manipulation_signal` > 0.8 get flagged `admin_review` (dev/admin can confirm the flag) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-60: Edit a rate within 2 hours; after the window it is locked
- **Module:** 3.5 Mandi Rates / Edit window — **Priority:** P2
- **Roleplay:** You are Anil fixing a typo in the rate you just posted.
- **Preconditions:** A rate posted <2 h ago; dev help (or waiting) for the >2 h case.
- **Test data:** Correct ₹18 → ₹18.50/kg.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On your pending/approved rate click **Edit** → change to `18.50` → save (`PATCH /seller/rates/{rate_id}`) | Edit accepted; band check re-runs (must stay within ±25%); rate updated |
| 2 | After 2 h from original posting, attempt another edit | `422 RATE_EDIT_WINDOW_CLOSED` — edits allowed only within 2 hours |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-61: My Posted Rates list + APMC Modal Reference table
- **Module:** 3.5 Mandi Rates / Reference — **Priority:** P1
- **Roleplay:** You are Anil cross-checking your rates against official APMC modal prices.
- **Preconditions:** At least 2 rates posted (one approved, one pending, one rejected if possible — ask admin to reject one).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/rates` → **My Posted Rates** | All your rates listed with correct status badges: pending / approved / rejected |
| 2 | Rejected rate row | Shows rejection reason (from moderation) |
| 3 | Scroll to **APMC Modal Reference** table | Columns: commodity · mandi, min–max, modal; contains Onion · Lasalgaon with official modal range |
| 4 | Compare your approved rate vs modal | Your rate sits within the ±25% band of the modal shown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.6 — J-Form Procurement (mandi weighbridge)

Covers: `GET/POST /seller/procurement` (auto JFORM number, gross − quality deduction = final, farmer mirror), pay (UTR + RCP receipt + audit), payment-status (Idempotency-Key, paid/udhaar), and the farmer-side mirror/receipt.

---

### TC-VYP-62: Record a J-form procurement — farmer sees mirror trust card
- **Module:** 3.6 J-Form Procurement / Record — **Priority:** P0 (money)
- **Roleplay:** You are Anil weighing Ramesh's 25 q onion at your shop; the J-form auto-computes the payout.
- **Preconditions:** Shop KYC verified (403 otherwise — tested in TC-VYP-10).
- **Test data:** Farmer `Ramesh Patil` ph `98220 00001`; crop Onion; net 25 q; ₹1,450/q; deduction 2% → gross ₹36,250 → final ₹35,525.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/procure` → **Generate New J-Form** (or the dashboard tab) | Modal as in TC-VYP-15 |
| 2 | Enter farmer name, phone, crop, net qty 25, rate 1450, deduction 2% → Submit (`POST /seller/procurement`) | J-form created: auto **jFormNumber `JFORM-YYYYMMDD-XXXX`**; gross/deduction/final computed server-side: ₹36,250 − ₹725 = **₹35,525**; stats (totalProcuredQuintals, totalPayoutAmount, pendingPayouts, totalLots) update |
| 3 | 🔄 Ramesh opens his app → procurement section | A **mirror trust card** of this J-form appears in his `procurement_payments` (matched by his phone) with the same amounts — farmer sees pending payout ₹35,525 |
| 4 | Record a second J-form for an unknown farmer phone (e.g. `99999 00000`) | J-form saved; no mirror card anywhere (no matched farmer) — no error |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-63: Mark J-form paid — UTR + receipt number + audit log
- **Module:** 3.6 J-Form Procurement / Pay — **Priority:** P0 (money)
- **Roleplay:** You are Anil paying Ramesh by bank transfer at the end of the day.
- **Preconditions:** Unpaid J-form from TC-VYP-62.
- **Test data:** paymentMode `bank_transfer`, utrNo `UTRNEFT777`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the J-form click **Mark Paid (Bank Transfer)** → enter UTR `UTRNEFT777` → confirm (`POST /seller/procurement/{id}/pay?paymentMode=bank_transfer&utrNo=UTRNEFT777`) | Marked paid; **UTR stored + receiptNo `RCP-…` generated**; pendingPayouts decreases |
| 2 | 🔄 Ramesh's trust card | Shows **paid** with UTR + receipt number |
| 3 | [ADMIN] Check audit logs | A row exists for this payment transition |
| 4 | Try marking the same J-form paid again | Rejected / no-op — already paid |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-64: Udhaar payment-status with Idempotency-Key + replay
- **Module:** 3.6 J-Form Procurement / Udhaar — **Priority:** P1
- **Roleplay:** You are Anil letting a trusted farmer take the produce on udhaar (credit).
- **Preconditions:** An unpaid J-form.
- **Test data:** Header `Idempotency-Key: jform-udhaar-001`; body `{status: "udhaar"}`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Via Swagger call `POST /seller/procurement/{id}/payment-status` **with** header Idempotency-Key `jform-udhaar-001`, body `{"status":"udhaar"}` | Status → `udhaar`; recorded once; audit row written |
| 2 | Repeat the exact same call (same key + body) | Idempotent replay — same result, **no duplicate** record/audit row |
| 3 | 🔄 Ramesh's pendingCount | His udhaar pendingCount includes this entry |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-65: J-form payment-status negatives — missing Idempotency-Key, bad status, bad amount
- **Module:** 3.6 J-Form Procurement / Validation — **Priority:** P1
- **Roleplay:** You are Anil (or a script) probing the payment endpoint for robustness.
- **Preconditions:** An unpaid J-form.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Call `payment-status` **without** the Idempotency-Key header | `400` — key is mandatory |
| 2 | Call with body `{"status":"paid_later"}` | Rejected — status must be `paid` or `udhaar` |
| 3 | Call with `{"status":"udhaar","amountPaisa":-500}` | Rejected — amountPaisa must be a non-negative integer |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-66: Farmer-side receipt locked until paid (409 RECEIPT_NOT_AVAILABLE)
- **Module:** 3.6 J-Form Procurement / Farmer mirror — **Priority:** P1
- **Roleplay:** 🔄 You verify the farmer can't download a receipt before you pay.
- **Preconditions:** An **unpaid/udhaar** J-form against Ramesh's phone.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 As Ramesh call `GET /seller/procurement/mine` (farmer role) | His J-form list + `pendingCount` of udhaar entries shown |
| 2 | 🔄 Ramesh calls `GET /seller/procurement/mine/{payment_id}/receipt` on the unpaid entry | `409 RECEIPT_NOT_AVAILABLE` — receipt locked until paid |
| 3 | Pay the J-form (TC-VYP-63 flow), then repeat the receipt call | Receipt downloads with UTR + RCP number |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.7 — Seller Stock & Resale Exchange

Covers: manual stock lines, adjust (delta, floor, exhausted), intake from a delivered purchase (idempotent), resale listings (reserve, browse, book by directBuyer/exporter/seller, drain → sold), delist.

---

### TC-VYP-67: Add manual stock line + stock KPIs
- **Module:** 3.7 Stock & Resale / Stock — **Priority:** P1
- **Roleplay:** You are Anil entering godown stock you bought offline.
- **Preconditions:** Logged in.
- **Test data:** Crop `Grapes`, qty `30` q, rate `₹2,800/q`, grade `A`, location `Nashik godown 2`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/stock` | KPIs on top: Stock Lines, Available q, Stock Value, Open Resale Listings; Position-by-Crop table |
| 2 | Click **Add Stock Line** (or equivalent) | Form: crop, quantityQuintals, ratePerQuintal, grade, location |
| 3 | Submit with qty `0` or negative | Rejected — quantity must be positive |
| 4 | Fill the test data → Submit (`POST /seller/stock`) | Stock line created (id `stk_…`, status `active`, reservedQuintals 0); KPIs and by-crop summary update (avgRate + totals) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-68: Adjust stock — delta ≠ 0, can't go below available, exhausted status
- **Module:** 3.7 Stock & Resale / Adjust — **Priority:** P1
- **Roleplay:** You are Anil correcting stock after repacking losses and then selling out a line.
- **Preconditions:** Stock line from TC-VYP-67 (30 q).
- **Test data:** Adjust `-2` q (repack loss); then `-28` q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the stock line click **Adjust** → enter delta `0` → submit | Rejected — delta must be non-zero |
| 2 | Enter delta `-2`, reason `Repack loss` → submit (`POST /seller/stock/{id}/adjust`) | Quantity 30 → 28 q; events[] records the adjustment with reason |
| 3 | Try delta `-29` (more than available 28) | Rejected — cannot exceed available quantity (available = qty − reserved) |
| 4 | Enter delta `-28` | Quantity 0 → line status `exhausted` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-69: Intake stock from a delivered/completed purchase (idempotent)
- **Module:** 3.7 Stock & Resale / Intake — **Priority:** P1
- **Roleplay:** You are Anil moving your QC-accepted onions from a purchase straight into sellable stock.
- **Preconditions:** A `completed`/`delivered` purchase with acceptedQty 40 q (TC-VYP-35), not yet converted.
- **Test data:** Valuation rate `₹1,520/q`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller/stock` click **Intake from Purchase** | Select lists your completed purchases; choose the 40 q onion purchase, enter valuation rate ₹1,520/q → confirm (request sends **Idempotency-Key**) |
| 2 | Submit (`POST /seller/stock/from-purchase/{purchase_id}`) | Stock line created with qty = qc.acceptedQty (40 q); purchase marked `stockConverted` + stockId |
| 3 | Repeat the same intake call | `409 STOCK_ALREADY_CONVERTED` — idempotent, no second line |
| 4 | Via Swagger, call intake on someone else's purchase id | `403` — only the buyer can convert |
| 5 | Via Swagger, call intake on a `confirmed` (not delivered) purchase | `409 PURCHASE_NOT_DELIVERED` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-70: Create a resale listing (reserves stock; qty ≤ available)
- **Module:** 3.7 Stock & Resale / Listings — **Priority:** P1
- **Roleplay:** You are Anil listing your onion stock for Delhi buyers.
- **Preconditions:** Stock line with available qty (e.g. 40 q from TC-VYP-69).
- **Test data:** Qty `40` q, asking rate `₹1,650/q`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the stock line click **Resale List** | Modal: stock select, qty, asking rate |
| 2 | Enter qty `41` (above available 40) | Rejected — listing qty must be ≤ available |
| 3 | Enter qty `40`, rate `₹1,650/q` → Submit (`POST /resale-listings` with Idempotency-Key) | Listing created, status `open`; stock **reserved** 40 q → available 0 |
| 4 | Open **My Resale Listings** on `/seller/stock` | Listing shown with purchaseCount 0 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-71: A DirectBuyer books my resale listing — drains to sold, notifies me
- **Module:** 3.7 Stock & Resale / Booking — **Priority:** P1 (money)
- **Roleplay:** 🔄 A Delhi buyer (Tester B as DirectBuyer) books your listing; you watch it drain.
- **Preconditions:** Open resale listing (TC-VYP-70). 🔄 DirectBuyer logged in.
- **Test data:** Booking qty 40 q; requiredDate +5 days; delivery address `Azadpur Mandi, Delhi`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 DirectBuyer browses resale listings (`GET /resale-listings?crop=Onion`) | Your listing visible (directBuyer, seller and exporter roles can browse; farmers excluded) |
| 2 | 🔄 DirectBuyer calls `POST /resale-listings/{id}/book` {quantityQuintals: 40, requiredDate, deliveryAddress} | Booking succeeds → creates a **purchase (status `confirmed`, source `resale_listing`)** at agreedRate × qty |
| 3 | 🔄 DirectBuyer tries booking your listing as you (own listing) — verify via Swagger | `403 OWN_LISTING` — you cannot book your own listing |
| 4 | Check your bell | `booking_confirmed` notification ("Booking confirmed" for your resale listing) |
| 5 | Check My Resale Listings + stock | Listing drained to `sold`; stock decremented; line status `exhausted` (reserved 0) |
| 6 | Verify the buyer's purchase follows the standard lifecycle | The resale-sourced purchase shows the same stepper (escrow/QC/etc.) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-72: Delist a resale listing; farmers excluded from browsing
- **Module:** 3.7 Stock & Resale / Delist & roles — **Priority:** P2
- **Roleplay:** You are Anil pulling a listing because prices spiked.
- **Preconditions:** A second open listing (create one more from stock or reuse before booking).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the open listing click **Delist** (`DELETE /resale-listings/{id}`) | Listing closed; **reserved stock released** back to available |
| 2 | Via Swagger try booking a closed listing | Rejected — only `open` listings can be booked |
| 3 | 🔄 As Ramesh (farmer role) call `GET /resale-listings` | Farmers get no listings (`403`/empty) — role guard works |
| 4 | Via Swagger try `minQtyPerBuyer`: book below the listing's minQtyPerBuyer | Rejected — minimum per-buyer quantity honored |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.8 — POS Sales, Buyer Khata (udhaar) & Cashflow

Covers: `POST /seller/sales` (modes, auto bill number, mandi fee, paid/partial/credit), `GET /seller/sales` stats, invoice PDF (Pro entitlement), buyer ledgers (`GET/POST /seller/ledgers`), and the `/seller/pos` desk.

---

### TC-VYP-73: Record a counter sale (all payment modes, auto bill number)
- **Module:** 3.8 POS / Counter sale — **Priority:** P0 (money)
- **Roleplay:** You are Anil at your shop counter selling to a walk-in buyer.
- **Preconditions:** Logged in.
- **Test data:** Buyer `Raju Vegetable Mart` (ph `98220 40003`), item `Onion`, qty `50`, unit `kg`, rate `₹16`, modes: cash / upi / bank_transfer / credit.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/pos` → click **Record Counter Sale** | KPIs on top: Revenue / Received / Udhar Outstanding / Net Cash; modal as in TC-VYP-16 |
| 2 | Submit empty | Validation — buyer, item, qty, rate required |
| 3 | Record sale 1: mode `cash`, amount paid `816` | Sale saved; **auto billNumber `INV-YYYYMMDD-XXXX`**; status `paid`; Revenue/Received/Net Cash update |
| 4 | Record sale 2: mode `upi`, UPI ref `anil.agrawal@upi`, paid full | Status `paid` |
| 5 | Record sale 3: mode `bank_transfer`, paid full | Status `paid` |
| 6 | Record sale 4: mode `credit`, amount paid `0` | Status `credit`; an unpaid balance **auto-creates a `credit_sale` ledger entry** in the buyer's khata (check in TC-VYP-75) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-74: Mandi fee math + auto full-payment when amountPaid = 0
- **Module:** 3.8 POS / Fee & auto-pay — **Priority:** P1 (money)
- **Roleplay:** You are Anil adding the 2% mandi fee on top of the sale.
- **Preconditions:** Logged in.
- **Test data:** Item Grapes, qty `100` kg, rate `₹60`, mandiFeePct `2%` → gross `₹6,000`, fee `₹120`, net `₹6,120`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Record a sale: qty 100, rate 60, fee 2%, mode `cash`, **amountPaid `0`** | Backend computes gross ₹6,000, mandiFee ₹120, **net ₹6,120**; since mode is cash and paid=0 → **auto full payment**, status `paid` |
| 2 | Record the same with mode `credit`, amountPaid `3000` | Status `partial`; unpaid `₹3,120` feeds the khata |
| 3 | Verify with `GET /seller/sales` | Stats: totalRevenue, totalReceived, totalOutstanding, totalInvoices all consistent with the sales you recorded |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-75: Buyer Khata — record payment received, running balance
- **Module:** 3.8 POS / Khata — **Priority:** P0 (money)
- **Roleplay:** You are Anil. Raju from the vegetable mart comes to clear part of his udhaar.
- **Preconditions:** Raju has a `credit_sale` balance (from TC-VYP-73 sale 4 / TC-VYP-74 partial).
- **Test data:** Payment `₹500`, mode `cash`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/pos` → **Buyer Khata** | Buyer cards grouped by name+phone with running `balanceAfterPaisa` per entry; totals show totalCreditOutstanding + totalDebtors |
| 2 | On Raju's card click **Record Payment Received** | Modal: amount, mode (**cash / upi / bank_transfer**) |
| 3 | Enter `₹500`, mode `cash` → confirm (`POST /seller/ledgers`) | Ledger entry `payment_received` (−) created; Raju's running balance drops by ₹500; Udhar Outstanding KPI updates |
| 4 | Enter a negative amount via Swagger | Rejected — amount must be positive |
| 5 | Check ledger entry types | Types limited to `credit_sale` (+), `payment_received` (−), `adjustment` (±) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-76: Manual ledger adjustment entry
- **Module:** 3.8 POS / Khata adjustments — **Priority:** P1
- **Roleplay:** You are Anil writing off a small disputed shortage against Raju's khata.
- **Preconditions:** Raju has an outstanding balance.
- **Test data:** Adjustment `−₹100`, note "Weight shortage write-off".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Via Swagger `POST /seller/ledgers` create entry type `adjustment`, amount −₹100, note as above | Entry created; Raju's running balance decreases by ₹100 |
| 2 | Open Buyer Khata on `/seller/pos` | Adjustment visible in his entry list with the note and new running balance |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-77: POS invoice PDF — Pro entitlement (402 on Free, works after upgrade)
- **Module:** 3.8 POS / Invoicing — **Priority:** P1
- **Roleplay:** You are Anil. A buyer asks for a GST bill; on the Free plan the platform says it's a Pro feature.
- **Preconditions:** An account on the **Free** plan; a recorded sale.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller/pos` Sales Invoices table, click the row's **PDF** button (`GET /seller/sales/{id}/invoice.pdf`) | On Free: `402 ENTITLEMENT_EXCEEDED` with **planId + feature** in the error body; friendly upsell message shown |
| 2 | Upgrade this account to Pro (TC-VYP-113), then click PDF again | Invoice PDF downloads with the sale details + bill number |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-78: POS page cashflow panel & invoice table
- **Module:** 3.8 POS / Cashflow — **Priority:** P1
- **Roleplay:** You are Anil checking that the books add up.
- **Preconditions:** Several sales + payments recorded.
- **Test data:** Date range this month.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/pos` → Cashflow panel | Inflow, outflow, net for the range; breakdown: procurementOut, purchasePaymentsOut, salesIn, purchaseCollectionsIn |
| 2 | Sales Invoices table | Every sale listed with bill number, buyer, amount, status; each row has a PDF button |
| 3 | Totals cross-check | KPI Revenue − Received = Udhar Outstanding ± rounding |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.9 — Krishi Mall Storefront (products & orders)

Covers: `POST/PUT /seller/products` (auto batchNo, follower `new_listing`, `price_drop`, `restock` notifications), order list/detail, order status transitions, delivered → buyer rating prompt, and the mobile seller screens.

---

### TC-VYP-79: Add a product — auto batch number + follower "New listing" notification
- **Module:** 3.9 Storefront / Catalog — **Priority:** P1
- **Roleplay:** You are Anil listing urea bags in your Krishi Mall store.
- **Preconditions:** Logged in.
- **Test data:** Title `Kisan Urea 45kg`, Brand `AgroGrow`, Category `Fertilizers`, Price `₹280`, MRP `₹300`, Stock `100`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/products` (or dashboard Store Products tab) → **Add New SKU** | Form fields as in TC-VYP-13 |
| 2 | Fill the test data → Save (`POST /seller/products`) | Product created with auto **batchNo `SLR-…`**; appears in catalog |
| 3 | 🔄 A farmer/customer who follows your store opens the bell | Notification **"New listing / नई लिस्टिंग"** for `Kisan Urea 45kg` |
| 4 | Edit the product price to `₹290` and save | Update succeeds (owner-only) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-80: Edit product — price_drop & restock notifications; owner-only 403
- **Module:** 3.9 Storefront / Edit & alerts — **Priority:** P1
- **Roleplay:** You are Anil dropping the urea price for a festival sale and restocking.
- **Preconditions:** Product from TC-VYP-79; a follower subscribed to product alerts; a second seller account available for the 403 check.
- **Test data:** Price 290 → `₹270`; stock 100 → `0` → `50`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Drop price to `₹270` → save (`PUT /seller/products/{id}`) | Follower receives **`price_drop` notification** naming product + new price |
| 2 | Set stock to `0` → save | Stock shows 0 / out-of-stock state |
| 3 | Restock to `50` → save | Follower receives **`restock` notification** |
| 4 | Via Swagger, as the SECOND seller, `PUT /seller/products/{anilProductId}` | `403` — owner-only update |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-81: Mall order — status transitions with note
- **Module:** 3.9 Storefront / Orders — **Priority:** P1
- **Roleplay:** You are Anil fulfilling a customer's urea order.
- **Preconditions:** An order exists in `placed` (🔄 E-Market Customer places it).
- **Test data:** Note "Packed 40kg bags, dispatching via Nashik-Delhi parcel".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/orders` → click the order → `/seller/orders/{id}` | Detail shows Items, buyer, timeline |
| 2 | Click the status-advance button → in the note modal enter the test note → Confirm (`PATCH /seller/orders/{id}/status`) | `placed → confirmed`; note stored; timeline updates |
| 3 | Advance again | `confirmed → shipped` |
| 4 | Advance again | `shipped → out_for_delivery` |
| 5 | Advance again | `out_for_delivery → delivered` |
| 6 | 🔄 Customer's order screen | Each transition reflected on the buyer side with your note visible |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-82: Illegal order transition negative + delivered opens buyer rating prompt
- **Module:** 3.9 Storefront / Order rules — **Priority:** P2
- **Roleplay:** You are Anil trying to skip shipping and jump to delivered — the system must refuse.
- **Preconditions:** A fresh `placed` order.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Via Swagger `PATCH /seller/orders/{id}/status` with `status: "shipped"` on a `placed` order | Rejected — from `placed` only `confirmed` is allowed (transitions: placed→confirmed; paid→confirmed\|shipped; confirmed→shipped; shipped→out_for_delivery; out_for_delivery→delivered) |
| 2 | Deliver an order per TC-VYP-81 | Status `delivered` |
| 3 | 🔄 Customer's app | **rating_prompt** shown to the buyer for this order |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-83: Mobile app seller screens — products & analytics (only mobile seller surfaces)
- **Module:** 3.9 Storefront / Mobile — **Priority:** P1
- **Roleplay:** You are Anil on your phone at the mandi; the mobile app covers only seller products & analytics.
- **Preconditions:** Flutter app installed (`backup/apps/mobile`), logged in as Anil.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the app → seller **Products** screen (`SellerProductsView`) | Catalog lists your products with stock |
| 2 | Use the inline **±stock stepper** on a product | Stock updates immediately |
| 3 | Open **Add/Edit** (`SellerProductFormSheet`) | Form mirrors the web fields (title, brand, category, price, MRP, stock); save works |
| 4 | Open seller **Analytics** (`SellerAnalyticsView`) | Analytics KPIs/charts load for your store |
| 5 | Look for other seller modules on mobile | Only products + analytics exist — do NOT file a defect for missing modules; full toolkit is web-only (per design) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.10 — Team Accounts (spec V10)

Covers: `POST /seller/team/invites` (name ≥2, phone ≥10, role enum), duplicate-phone 409, role change, removal.

---

### TC-VYP-84: Invite a team member (validation + success)
- **Module:** 3.10 Team — **Priority:** P1
- **Roleplay:** You are Anil adding your agent Sham as a team member.
- **Preconditions:** Logged in.
- **Test data:** Name `Sham Wakode`, phone `98220 40002`, role `agent`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the team management screen (from `/seller/profile` or the Enterprise Hub) | Team page opens (empty) |
| 2 | Click **Invite Member** → enter name `S` (1 char), phone `123`, role `agent` → submit | Validation: name ≥2 chars, phone ≥10 digits |
| 3 | Try role `supervisor` via Swagger | Rejected — role must be `agent\|accountant\|manager\|procurement` |
| 4 | Fill the test data → Send invite (`POST /seller/team/invites`) | Member invited/created; listed via `GET /seller/team/members` with role `agent` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-85: Duplicate active member → 409
- **Module:** 3.10 Team / Duplicate — **Priority:** P1
- **Roleplay:** You are Anil accidentally inviting Sham twice.
- **Preconditions:** Sham active from TC-VYP-84.
- **Test data:** Same phone `98220 40002`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Invite another member with the same phone `98220 40002` | `409 MEMBER_ALREADY_EXISTS` — active same-phone member exists |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-86: Change member role and remove member
- **Module:** 3.10 Team / Manage — **Priority:** P2
- **Roleplay:** You are Anil promoting Sham to procurement and later removing a temp helper.
- **Preconditions:** Sham active.
- **Test data:** New role `procurement`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On Sham's row change role → `procurement` (`PUT /seller/team/members/{id}/role`) | Role updated and displayed |
| 2 | Invite a temp helper, then click **Remove** (`DELETE /seller/team/members/{id}`) | Member status → `removed`; disappears from the active list |
| 3 | `GET /seller/team/members` | Removed member not in active list |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.11 — Contracts (grow-for-us / contract farming, as buyer)

Covers: `POST /contracts` (KYC gate per business type, entitlement cap, fields), offer → farmer MPIN e-sign accept → active, edit/cancel, delivery slot generation (idempotent, creates a contract-sourced purchase), analytics, and contract QC Pro entitlement.

---

### TC-VYP-87: Create a contract offer for a farmer
- **Module:** 3.11 Contracts / Create — **Priority:** P1
- **Roleplay:** You are Anil contracting Ramesh to grow 200 q onion for you at a fixed rate.
- **Preconditions:** Logged in; KYC docs verified (mandi_trader → GST required).
- **Test data:** farmerId = Ramesh; crop Onion; qtyTotal `200` q; priceType `fixed`; baseRate `₹1,500/q`; paymentTermsDays `7`; schedule monthly deliveries.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the contracts screen (Enterprise Hub → Contracts) → **Create Contract** | Form: farmerId*, crop, quantityTotal, priceType (**fixed / mandiLinked**), baseRate, premiumPerQuintal, mandiName, schedule, spec, paymentTermsDays |
| 2 | Submit with farmer/qty empty | Validation errors |
| 3 | Fill the test data → Submit (`POST /contracts`) | Contract created, status `offered`; spec snapshot attached |
| 4 | 🔄 Ramesh's bell | Farmer receives `contract_offer_received` notification |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-88: Contract KYC gate — 403 KYC_REQUIRED with deepLink
- **Module:** 3.11 Contracts / KYC gate — **Priority:** P1
- **Roleplay:** You are a trader whose business-KYC doc is missing; the system must block contract creation and deep-link you to KYC.
- **Preconditions:** Account with missing/unverified required doc (e.g. exporter without IEC+APEDA, or trader without verified GST).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Attempt `POST /contracts` via Swagger | `403 KYC_REQUIRED` with a **deepLink** to the KYC screen |
| 2 | Verify per business type: exporter → `iec` + `apeda` docs; processor/hotel/institutional → `fssai`; retailer/wholesaler → `gst`; default → `gst` | Required-doc matrix enforced (check with dev/admin which doc your test account lacks) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-89: Contract field validation + Free-plan cap (1 active contract)
- **Module:** 3.11 Contracts / Validation — **Priority:** P2
- **Roleplay:** You are Anil probing the form rules.
- **Preconditions:** On the Create Contract form; a Free-plan account.
- **Test data:** fixed with baseRate `0`; mandiLinked without mandiName.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | priceType `fixed`, baseRate `0` → submit | Rejected — fixed requires baseRate > 0 |
| 2 | priceType `mandiLinked`, no mandiName → submit | Rejected — mandiLinked requires mandiName |
| 3 | On a **Free** plan create a 2nd active contract | `402 ENTITLEMENT_EXCEEDED` — `contracts_active` cap: Free = 1, Pro = 5 (error shows planId + feature) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-90: Farmer accepts the contract with MPIN e-sign
- **Module:** 3.11 Contracts / Acceptance — **Priority:** P1
- **Roleplay:** 🔄 Ramesh reviews and e-signs your contract offer with his MPIN.
- **Preconditions:** Contract in `offered` (TC-VYP-87). 🔄 Ramesh logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ramesh opens the contract → Accept → sign (`POST /contracts/{id}/accept` {mpin, signatureData, consentTimestamp}) | Targeted offer → status `active`; you receive `contract_accepted` 🔄 |
| 2 | 🔄 Ramesh first tries accepting with wrong MPIN | `401 WRONG_MPIN` |
| 3 | 🔄 (Dev) farmer with no MPIN attempts accept | `409 MPIN_NOT_SET` |
| 4 | 🔄 Ramesh declines a second contract offer you send him (with reason) | Status `declined`; you receive `contract_declined` with reason 🔄 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-91: Generate a contract delivery slot (idempotent; NO_MANDI_DATA; creates purchase)
- **Module:** 3.11 Contracts / Deliveries — **Priority:** P1
- **Roleplay:** You are Anil generating this month's delivery against the active contract.
- **Preconditions:** Contract `active` (TC-VYP-90). 🔄 Farmer also sees the delivery task.
- **Test data:** slotDate today; fixed rate ₹1,500/q, slot qty per schedule.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the contract → **Generate Delivery** for slotDate today (`POST /contracts/{id}/deliveries` {slotDate}) | Delivery created; **a purchase is created (source `contract`)** carrying the specSnapshot; rate = fixed ₹1,500/q (mandiLinked would be modal + premium) |
| 2 | Repeat the same slotDate | Idempotent — same delivery returned, no duplicate purchase |
| 3 | Via Swagger generate with a mandiLinked contract whose mandi has no modal data | `422 NO_MANDI_DATA` |
| 4 | Generate on a non-active contract | Rejected — deliveries only for active contracts |
| 5 | Check `GET /contracts/{id}/deliveries` | Fulfilment shows total/completed/cancelled/pending |
| 6 | 🔄 Ramesh's task list | Delivery-due task visible to the farmer |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-92: Edit offered contract, cancel, analytics, Pro QC & contract commission line
- **Module:** 3.11 Contracts / Manage — **Priority:** P2
- **Roleplay:** You are Anil fixing an offered contract and later reviewing performance.
- **Preconditions:** One `offered` and one `active` contract.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Edit the `offered` contract (e.g. baseRate ₹1,500 → ₹1,520) → save (`PUT /contracts/{id}`) | Update saved; attractiveness re-scored |
| 2 | Try editing the `active` contract | Rejected — edit allowed only while `offered` |
| 3 | Cancel a contract with reason (`POST /contracts/{id}/cancel`) | Status `cancelled`; farmer notified `contract_cancelled` 🔄 |
| 4 | Open contract analytics (`GET /contracts/analytics`) | Shows fulfillment_pct and on_time_deliveries |
| 5 | On a Free plan attempt contract QC submission | Pro entitlement `qcSubmits` required — `402` (contract QC is Pro) |
| 6 | Check the contract-purchase invoice at completion | **1–2% `directBuyerPct` commission line** appended at the invoice |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.12 — Bulk Orders / Buyer Network (S5)

Covers: `POST /seller/bulk-orders` (idempotent, positive qty), buyer directory, and **Propose Supply Quote** to direct buyers.

---

### TC-VYP-93: Post a bulk order requirement (idempotency + qty validation)
- **Module:** 3.12 Bulk Orders — **Priority:** P1
- **Roleplay:** You are Anil posting your onion requirement for this week.
- **Preconditions:** Logged in.
- **Test data:** Crop Onion, qty `300` q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the bulk-orders screen (Enterprise Hub) → **Post Requirement** | Form: crop*, qty |
| 2 | Enter qty `0`/`-5` → submit | `422` — quantity must be positive |
| 3 | Enter crop Onion, qty `300` → Submit **with** Idempotency-Key `bo-001` (`POST /seller/bulk-orders`) | Bulk order created, status `open` |
| 4 | Repeat the exact same request (same key) | Idempotent replay — same bulk order returned, no duplicate |
| 5 | Open `GET /seller/bulk-orders` | openCount reflects your open requirement |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-94: Buyer directory — filters, verified badge, past dealings
- **Module:** 3.12 Buyer Network / Directory — **Priority:** P1
- **Roleplay:** You are Anil looking for reliable Delhi buyers.
- **Preconditions:** Some direct buyers exist (seeded or Tester B's buyer-org).
- **Test data:** Search `Delhi`; category `Hotels & Caterers`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/direct-buyers` | Buyer cards with verified badge, demands-live count, categories, **pastDealingsCount** |
| 2 | Apply category chip **Hotels & Caterers** | List filters |
| 3 | Search `Delhi` | Only matching buyers remain |
| 4 | Check sort order | **Verified buyers first**, then others |
| 5 | Via Swagger `GET /seller/buyers?q=&state=&category=` | Same results via API; verified badge comes from directBuyer KYC |
| 6 | Open the aggregated buyer directory (`GET /seller/buyer-directory`) | Your khata buyers + bulk-order posters aggregated with ledgerEntries/bulkOrders counts |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-95: Propose a supply quote to a direct buyer
- **Module:** 3.12 Buyer Network / Quotes — **Priority:** P1
- **Roleplay:** You are Anil quoting onion supply to a hotel chain.
- **Preconditions:** A buyer card visible on `/seller/direct-buyers`.
- **Test data:** Crop Onion, qty `200` q, rate `₹1,620/q`, terms "2 deliveries/week, 55mm+".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On a buyer card click **Propose Supply Quote** | Modal: crop select, qty*, rate*, terms notes |
| 2 | Submit qty empty | Validation — qty required |
| 3 | Fill the test data → Send | Quote sent → creates a bulk order linked to that buyer (`createBulkOrder`) |
| 4 | 🔄 Buyer's screen | The buyer sees your supply proposal |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.13 — Sourcing & AI Insights

Covers: `GET /seller/sourcing-recommendations` (fit-ranked open lots) and the `/seller/ai` screen.

---

### TC-VYP-96: Sourcing recommendations + AI insights page
- **Module:** 3.13 Sourcing & AI — **Priority:** P2
- **Roleplay:** You are Anil asking the AI where to buy cheap onion this week.
- **Preconditions:** Logged in; open lots exist.
- **Test data:** Arbitrage: crop Onion, mandi Lasalgaon.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/ai` (`SellerAiInsightsView`) | KPIs: Fit Lots count, AI score, best mandi |
| 2 | Open the recommendations list (`GET /seller/sourcing-recommendations?limit=10`) | Open lots listed fit-ranked against your profile + trade history; limit respected (1..50) |
| 3 | Use the arbitrage form: crop select (**Soybean / Onion / Wheat / Cotton**), mandi select (**Pune / Nasik / Lasalgaon / Nagpur APMC**) → check | Arbitrage hint/comparison appears for the chosen pair |
| 4 | Via Swagger request `limit=51` | Rejected/ clamped — limit range 1..50 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.14 — Ratings & Reputation

Covers: `GET /ratings/mine`, `GET /ratings/given`, `POST /ratings/{id}/reply`, trust banner, and the `rated` notification.

---

### TC-VYP-97: Ratings page — trust banner, received reviews, reply
- **Module:** 3.14 Ratings & Reputation — **Priority:** P1
- **Roleplay:** You are Anil checking what farmers say about you.
- **Preconditions:** At least one farmer rating exists (🔄 Ramesh rated you).
- **Test data:** Reply text "Dhanyavaad! Regular quality maand rahegi."

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/ratings` (`SellerRatingsView`) | Trust banner: avg stars, **"Tier-1 Verified Mandi Vyapari"**, **"Zero Escrow Dispute Flags"** (when true) |
| 2 | Open tab **Reviews Received** | Your ratings listed with stars, tags (Hindi labels), farmer comment |
| 3 | On a review click **Reply to Farmer** → enter the test text → submit (`POST /ratings/{id}/reply`) | Reply saved and shown under the review |
| 4 | Open tab **Ratings I Gave** | Ratings you gave farmers (from TC-VYP-42) listed |
| 5 | Via Swagger `GET /ratings/mine` and `GET /ratings/given` | Data matches the UI |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-98: "You got a rating" notification
- **Module:** 3.14 Ratings / Notifications — **Priority:** P2
- **Roleplay:** 🔄 Ramesh rates you; you get a bell ping.
- **Preconditions:** An unrated completed purchase between you and Ramesh.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ramesh rates you (farmerToBuyer) | — |
| 2 | Open your bell (`GET /notifications`) | Notification **`rated`** — "You got a rating ⭐…" with stars shown |
| 3 | Mark it read (`POST /{id}/read` / **read all**) | Badge count clears |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.15 — Settlements, TDS, GST & Compliance

Covers: `GET /seller/settlements` (weekly period lines, commission, TDS 194-O, holds), payout account, `GET /seller/tds-statements` (+ PDF, Pro), `GET /seller/gst-reports` (GSTR register), per-purchase commission invoices, and Refer & Earn on `/seller/compliance`.

---

### TC-VYP-99: Settlements period cards — Gross − Commission − TDS 194-O = Net
- **Module:** 3.15 Settlements — **Priority:** P0 (money)
- **Roleplay:** You are Anil checking what the platform will pay out this week.
- **Preconditions:** At least one completed purchase/settlement line exists (from Module 3.2).
- **Test data:** Expected math: Net = Gross − Commission (2% min ₹50) − TDS (1% of gross).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/settlements` (`SellerSettlementsView`) | Period cards list: period, **Gross / −Commission / −TDS 194-O / Net Payout**, status `pending` or `paid` |
| 2 | Pick a period and verify the math by hand | Net = Gross − Commission − TDS; TDS = 1% of gross; commission = 2% min ₹50 |
| 3 | Check the payoutRef | Paid lines show a payout reference |
| 4 | If a hold exists | Card shows **"Held: …"** badge with holdReason (admin can release/reject — maker-checker applies above ₹10k) |
| 5 | Via Swagger `GET /seller/settlements?role=seller` | Data matches the UI (role=seller lines only) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-100: Payout account card — verified primary; unverified flagged onHold
- **Module:** 3.15 Settlements / Payout account — **Priority:** P1 (money)
- **Roleplay:** You are Anil confirming where the payout lands.
- **Preconditions:** Verified primary bank (TC-VYP-07).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller/settlements` open the **Payout Account** card | Shows verified primary bank, **masked A/C + IFSC**; **Manage Bank Accounts →** goes to `/bank-accounts` |
| 2 | Note the onHold warning text | Card notes that payouts without a verified account are flagged **onHold** |
| 3 | (Dev/test) Temporarily remove the verified account and check settlement status | Settlement line status shows `onHold` until a verified primary account exists |
| 4 | Restore the verified primary account | onHold clears |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-101: TDS statements + statement PDF (Pro)
- **Module:** 3.15 TDS — **Priority:** P1
- **Roleplay:** You are Anil downloading your 194-O TDS statement for the accountant.
- **Preconditions:** Some GMV exists.
- **Test data:** Period: first to last day of last month (YYYY-MM-DD).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/compliance` → TDS statements section | `GET /seller/tds-statements` shows **totalTdsPaisa** (1% of gross marketplace GMV) |
| 2 | Click **Statement PDF** with valid `periodStart`/`periodEnd` | On Pro: PDF downloads; computed 1% of GMV in paisa; **idempotent txnId**; a `tds_ledger` row is written |
| 3 | Repeat the same PDF request | Same txnId — idempotent, no double ledger row |
| 4 | Request with invalid date format (`periodStart=01/09/2026`) | Rejected — dates must be `YYYY-MM-DD` |
| 5 | On a Free plan attempt the PDF | `402` — TDS statements PDF is a **Pro** feature |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-102: GST reports — GSTR-style register math
- **Module:** 3.15 GST — **Priority:** P1
- **Roleplay:** You are Anil checking your GST liability report.
- **Preconditions:** Completed purchases with invoices exist.
- **Test data:** Date range this quarter.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/compliance` → GSTR register (`GET /seller/gst-reports?from=&to=`) | Records listed with per-record taxable value, CGST, SGST |
| 2 | Verify the math on one record | taxable = net/1.18; **CGST 9% + SGST 9%** of taxable; IGST 0 (intra-state register) |
| 3 | Check summary totals | Summary totals = sum of records |
| 4 | Try `from` after `to` | Rejected by date validation |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-103: Per-purchase commission invoice PDF
- **Module:** 3.15 Compliance / Commission invoices — **Priority:** P1
- **Roleplay:** You are Anil downloading the platform's 2% commission invoice.
- **Preconditions:** A completed purchase.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller/compliance` find the per-purchase commission invoices list | Your purchases listed with **View Invoice** |
| 2 | Click **View Invoice** (`GET /seller/purchases/{id}/commission-invoice`) | 2% commission PDF downloads (min ₹50 applied) |
| 3 | Via Swagger, as another user (not a participant), call the same URL | `403` — participant-only |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-104: Refer & Earn card
- **Module:** 3.15 Compliance / Referrals — **Priority:** P2
- **Roleplay:** You are Anil inviting a fellow trader to the platform.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller/compliance` open **Refer & Earn** card | Shows Invited / Joined / Kisan Coins counters |
| 2 | Click **Invite a Fellow Vyapari** | Referral link/invite opens (WhatsApp share) with your referral code |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.16 — P&L, Diary, Analytics, Ads, Chatbot & Community screens

Covers: diary entries (income/expense categories) driving P&L, P&L dashboard/crops/expenses/break-even/report PDF/Tally export, `/seller/analytics` (chart, low-stock, price alerts), `/seller/ads`, `/seller/chatbot`, and the shared community screens (news, coins, referrals, 7/12, trees).

---

### TC-VYP-105: Record business diary entries (expense + income)
- **Module:** 3.16 Diary — **Priority:** P1
- **Roleplay:** You are Anil jotting today's mandi tax and a produce sale into the business diary.
- **Preconditions:** Logged in.
- **Test data:** Expense: category `mandi_tax`, ₹`450`; Income: category `produce_sale`, ₹`35,000`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/diary` | Income/expense KPIs shown |
| 2 | Click **Record Business Diary Entry** | Modal: type (**expense / income**), category (**produce_purchase / produce_sale / transport_expense / mandi_tax / labor / storage / other**), amount, note |
| 3 | Save an expense `mandi_tax` ₹450 | Entry appears; expense KPI updates |
| 4 | Save an income `produce_sale` ₹35,000 | Entry appears; income KPI updates |
| 5 | Submit with amount `0`/empty | Validation — amount required and positive |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-106: P&L dashboard + add crop expense (recompute netProfit & ROI)
- **Module:** 3.16 P&L — **Priority:** P1
- **Roleplay:** You are Anil checking if the onion line actually made money.
- **Preconditions:** Diary entries exist (TC-VYP-105).
- **Test data:** Crop Onion; expense category `transport_expense`, ₹`2,000`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/pnl` (`SellerPnlView`) | `GET /pnl/dashboard?months=3..24` renders charts (5-min cache — re-check after edits) |
| 2 | Open crops section (`GET /pnl/crops`) | Crop lines with income, expenses, netProfit, roiPercent (DEMO_CROPS seeded when empty) |
| 3 | On Onion add expense `transport_expense` ₹2,000 (`POST /pnl/crops/{id}/expenses`) | totalExpenses +2,000; **netProfit and roiPercent recomputed** immediately |
| 4 | Try `months=2` or `months=25` via Swagger | Rejected — allowed range 3..24 |
| 5 | Open `GET /pnl/summary` | Summary matches dashboard figures |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-107: Break-even calculator
- **Module:** 3.16 P&L / Break-even — **Priority:** P2
- **Roleplay:** You are Anil computing the minimum safe selling price for grapes.
- **Preconditions:** Logged in.
- **Test data:** totalCost `₹1,00,000`; expectedYield `50` q → minSafePrice = ceil(1,00,000/50) = ₹2,000/q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller/pnl` open **Break-even** | Form: totalCost, expectedYieldQuintals |
| 2 | Enter the test data → Calculate (`POST /pnl/break-even`) | Returns **minSafePricePerQuintal ₹2,000** (ceil) |
| 3 | Enter yield `0` | Rejected — division by zero guarded |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-108: P&L report PDF + Tally CSV export
- **Module:** 3.16 P&L / Exports — **Priority:** P2
- **Roleplay:** You are Anil handing your books to the accountant.
- **Preconditions:** Diary entries exist.
- **Test data:** from/to = this month.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/seller/pnl` click **Report PDF** (`GET /pnl/report.pdf?from=&to=`) | PDF downloads with P&L for the period |
| 2 | Click **Tally Export** (`GET /pnl/export/tally`) | Tally-format CSV downloads; opens in a spreadsheet with columns intact |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-109: Analytics page — revenue chart, top products, low stock, price alert
- **Module:** 3.16 Analytics — **Priority:** P1
- **Roleplay:** You are Anil checking store performance and setting a price-watch.
- **Preconditions:** Some orders/products exist.
- **Test data:** Alert: "when price falls below ₹250" for Kisan Urea.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/analytics` | Monthly revenue chart renders; **top products** and **category breakdown** lists shown |
| 2 | Check **low-stock alerts** | Products with low/zero stock flagged |
| 3 | Use the **price-alert form** ("Alert when price falls below / rises above target") → set falls-below ₹250 → **Create Alert** | Alert created and listed |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-110: Ads — KPIs and create campaign
- **Module:** 3.16 Ads — **Priority:** P2
- **Roleplay:** You are Anil promoting your grape listing.
- **Preconditions:** A resale listing or product exists.
- **Test data:** Campaign name "Grapes Fest"; listing = your grapes resale listing; URL `https://agrovercity.example/campaign/grapes`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/ads` | KPIs: live ads count, spend, impressions |
| 2 | Click **Create Campaign** | Modal: target type select, listing picker, campaign URL field |
| 3 | Pick target type + listing, enter URL → Save | Campaign created; live ads count increases |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-111: Chatbot support question
- **Module:** 3.16 Chatbot — **Priority:** P2
- **Roleplay:** You are Anil asking how escrow release works.
- **Preconditions:** Logged in.
- **Test data:** Question: "How does escrow release work after QC?"

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/chatbot` | Support chat opens with prompt "Type your question about lots, APMC rates, pickup agents, or escrow…" |
| 2 | Send the test question | A relevant answer/response arrives (about escrow/QC/pickup) |
| 3 | Send a second question about pickup agents | Response arrives; conversation scrolls correctly |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-112: Community/shared screens — news, coins, referrals, 7/12, trees
- **Module:** 3.16 Community screens — **Priority:** P2
- **Roleplay:** You are Anil poking around the shared screens routed for sellers.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/seller/news` | Agri news list loads |
| 2 | Open `/seller/coins` | KisanCoins balance/activity shown |
| 3 | Open `/seller/referrals` | Referral stats + invite options shown |
| 4 | Open `/seller/712` (7/12 Land Records) | Land-records screen loads (linked records if any) |
| 5 | Open `/seller/trees` (Tree Plantation) | Tree plantation screen loads |
| 6 | Toggle हिन्दी and re-open each | Labels render without overflow |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.17 — Billing / Plans (SaaS entitlement)

Covers: `GET /billing/plans`, `GET /billing/subscription`, `POST /billing/subscribe`, Free vs Pro features (commission 2% min ₹50 + basic khata on Free; gstInvoices, tdsStatements, analytics v2 on Pro), 402 entitlement envelopes, grace period.

---

### TC-VYP-113: View plans and subscribe to Pro
- **Module:** 3.17 Billing — **Priority:** P1 (money)
- **Roleplay:** You are Anil upgrading to Pro to unlock GST invoices and TDS PDFs.
- **Preconditions:** On the **Free** plan.
- **Test data:** Plan `Pro` (razorpay test mode / test subscription).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the billing/plans screen (`GET /billing/plans?persona=seller`) | Free / Pro / Enterprise plans with limits listed (Free: commission 2% min ₹50 + basic khata; Pro: gstInvoices, tdsStatements, analytics v2, more contracts) |
| 2 | Choose **Pro** → Subscribe (`POST /billing/subscribe` {planId}) | Subscription created (razorpay_sub, 30-day period); success confirmation |
| 3 | Open `GET /billing/subscription` | Plan = Pro with limits + usage + **gracePeriodDays** |
| 4 | Re-check previously blocked features | POS invoice PDF (TC-VYP-77) and TDS PDF (TC-VYP-101) now work |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-114: Billing negatives — Free re-subscribe 409; kill-switch
- **Module:** 3.17 Billing / Negatives — **Priority:** P1
- **Roleplay:** You are Anil (on a Free test account) verifying billing guardrails.
- **Preconditions:** A second Free account (or downgrade via dev).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the Free account call `POST /billing/subscribe` with the Free planId | `409 ALREADY_FREE` — free plan cannot be subscribed |
| 2 | Call `GET /billing/subscriptions` | History + current plan listed |
| 3 | (Dev) Enable the `app_config.subscriptionsEnabled` kill-switch off → attempt subscribe | `409` — subscriptions disabled by kill-switch |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### MODULE 3.18 — Broker / Dalal Desk (separate `broker` role — included per scope)

Covers: `/broker` dashboard, deals (create/TTL/negotiation/moderation), milestones, vehicle, evidence vault, payment capture (Razorpay split), release payout (48 h window), contract/receipt PDFs, disputes/escalation, leads CRM, wholesale buyer requirements, trust tier, commissions & settlements. **The broker role is separate from seller** — use the second account prepared in setup. Marked steps need 🔄 Tester B (farmer) or [ADMIN].

---

### TC-VYP-115: Switch to broker role — dashboard
- **Module:** 3.18 Broker / Dashboard — **Priority:** P1
- **Roleplay:** You are Anil wearing your **dalal** hat today, matching farmers with buyers for a commission.
- **Preconditions:** Logged in with an account holding the `broker` role.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Switch the active profile to **Broker** (profile switcher) and open `/broker` (`BrokerHome`) | 4 StatCards: activeDeals, newLeads, offersAwaiting (with ttlHoursLeft), dealsNeedingEvidence |
| 2 | Check the dashboard sections | Quick links, **Offers Awaiting TTL** list, Deal Pipeline table |
| 3 | Check the tabs | **Pipeline** and **Commissions & Settlements** tabs present |
| 4 | Via Swagger `GET /broker/dashboard` | Pipeline by stage, commission earned/pending/paid (paisa), network farmers/buyers counts all present |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-116: [ADMIN] Approve broker KYC (arhtiya_licence + gst)
- **Module:** 3.18 Broker / KYC — **Priority:** P1
- **Roleplay:** Tester C verifies your dalal licence so you can capture payments later.
- **Preconditions:** Broker KYC case submitted with `arhtiya_licence` + `gst` docs.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | [ADMIN] Open super-admin KYC queue → broker case | Case lists exactly `arhtiya_licence` + `gst` |
| 2 | [ADMIN] Approve | Case → verified; broker trust page KYC clock shows verified |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-117: Create a broker deal — TTL set, farmer notified
- **Module:** 3.18 Broker / Deal create — **Priority:** P1
- **Roleplay:** You are Anil the dalal. You matched Ramesh's grapes with a Delhi buyer — record the deal.
- **Preconditions:** Broker role; farmer phone handy.
- **Test data:** buyerName `VegMart Delhi`, buyerPhone `98110 10001`, buyerCompany `VegMart Retail Pvt Ltd`, sellerName `Ramesh Patil`, sellerPhone `98220 00001`, commodity `Grapes`, variety `Thompson Seedless`, grade `Grade A`, quantity `20` q, agreedRate `₹3,000/q`, deliveryLocation `Azadpur Mandi, Delhi`, brokerCommissionPct `2%`, paymentTerms `7 days`, notes "Morning slot delivery".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/broker/deals` → **Create Deal** | Form: buyerName*, buyerPhone, buyerCompany, sellerName*, sellerPhone, commodity*, variety, grade (**Grade A / B / C / Ungraded**), quantityQuintals*, agreedRate*, deliveryLocation, brokerCommissionPct (0–10), paymentTerms, notes |
| 2 | Submit with seller/qty/rate empty | Validation errors on required fields |
| 3 | Enter commission `11%` | Rejected — allowed 0–10 |
| 4 | Fill the test data → Submit (`POST /broker/deals`) | Deal created; gross (20×3,000 = ₹60,000) + commission (2% = ₹1,200) computed; **expiresAt = now + TTL 24–48 h** (config `broker_offer_ttl`) |
| 5 | 🔄 Ramesh's device | Farmer task + notification **"New offer"** (`deal_offer_received`) with your terms |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-118: Deal negotiation thread — counter cap 3, AI deadlock hint
- **Module:** 3.18 Broker / Negotiation — **Priority:** P1
- **Roleplay:** You are Anil haggling between both parties in the deal thread.
- **Preconditions:** Deal created (TC-VYP-117); deal status allows messaging (negotiating stage).
- **Test data:** Counter amounts ₹2,900 → ₹2,950 → ₹2,975.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/broker/deals/{id}` → negotiation thread | Offer input with ₹/q field; message thread visible |
| 2 | Send message with amountOffer ₹2,900 (`POST /broker/deals/{id}/messages`) | Message posted; 🔄 farmer sees it |
| 3 | Exchange counters: farmer ₹2,950 → you ₹2,975 → farmer tries a 3rd counter | 4th round → `409 COUNTER_LIMIT_REACHED` — thread locks to accept/decline only |
| 4 | At round 2, check the AI hint | If deadlock risk ≥ 0.5, a **suggestMediator** hint appears |
| 5 | 🔄 Farmer accepts | Deal status advances toward `accepted`; you are notified |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-119: Message moderation — phone/UPI/URL blocked; 3 strikes restrict
- **Module:** 3.18 Broker / Moderation — **Priority:** P1
- **Roleplay:** You are Anil testing whether the chat blocks off-platform dealing.
- **Preconditions:** An open deal message thread.
- **Test data:** Texts: "call me 9822040001", "pay to anil@upi", "see https://example.com".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Send "call me 9822040001" | `422 MESSAGE_BLOCKED` — 10-digit phone regex blocked |
| 2 | Send "pay to anil@upi" | `422 MESSAGE_BLOCKED` — UPI handle blocked |
| 3 | Send "see https://example.com" | `422 MESSAGE_BLOCKED` — external link blocked |
| 4 | Trigger 3 blocked attempts (strikes) | Strike ladder reaches 3 → `429 MESSAGING_RESTRICTED` — messaging restricted for you |
| 5 | Send a clean message after restriction | Still blocked until restriction lifts |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-120: Milestones — delivered sets releaseAt; weigh divergence >2% pro-rates
- **Module:** 3.18 Broker / Milestones — **Priority:** P1 (money)
- **Roleplay:** You are Anil tracking the truck from Nashik to Delhi.
- **Preconditions:** Deal `accepted` (or in transit).
- **Test data:** Milestones: departed → arrived → loading → in_transit → arrived_at_mandi → weighed (19.6 q vs 20 q booked = 2% divergence) → delivered.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the deal click **Add Milestone** → type `departed` + location Nashik | Milestone recorded and listed |
| 2 | Add `weighed` with weightKg `19600` (19.6 q) | Divergence = 2% of 20 q → **pro-rata adjustmentProposal** created; farmer notified `deal_adjustment_proposed` 🔄; **24 h dispute window** starts |
| 3 | 🔄 Ramesh disputes/adjusts or lets it pass | Window outcome recorded |
| 4 | Add milestone `delivered` | `deliveredAt` set; **releaseAt = deliveredAt + 48 h** |
| 5 | Via Swagger add a milestone on a `negotiating` deal | Rejected — milestones allowed only in `accepted`/`in_transit`/`completed` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-121: Vehicle update + plate masking
- **Module:** 3.18 Broker / Vehicle — **Priority:** P2
- **Roleplay:** You are Anil assigning the tempo for delivery.
- **Preconditions:** Deal `accepted` or beyond.
- **Test data:** vehicleType `Tempo` (options: Tempo / Mini Truck 1T / Truck 10T / Tractor Trolley / Pickup), vehicleNumber `MH-12-AB-3456`, driverName `Suresh Yadav`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the deal click **Vehicle** → fill the test data → save (`PUT /broker/deals/{id}/vehicle`) | Vehicle saved |
| 2 | Check every API response showing the deal (`GET /broker/deals/{id}`) | Plate **masked as "MH 12 •• 3456"** in ALL responses |
| 3 | Check driver details | **No driver phone** stored/displayed |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-122: Evidence upload caps + vault locked before acceptance
- **Module:** 3.18 Broker / Evidence — **Priority:** P2
- **Roleplay:** You are Anil collecting proof: weigh slip, payment proof.
- **Preconditions:** One deal in `negotiating`; another `accepted`.
- **Test data:** Files: weigh_slip.jpg, payment_proof.jpg.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the `negotiating` deal open the evidence vault | `409 VAULT_LOCKED` — vault accessible only in `accepted`/`in_transit`/`completed` |
| 2 | On the `accepted` deal upload 5 weigh_slip photos + a 6th (`POST /broker/deals/{id}/evidence`) | First 5 accepted (max 5 per kind); 6th rejected |
| 3 | Upload 21 files of mixed kinds | 20th is the cap per deal — 21st rejected |
| 4 | Open the vault (`GET /broker/deals/{id}/vault`) | All evidence listed by kind |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-123: Capture payment — broker KYC gate, once-only, split legs, audit
- **Module:** 3.18 Broker / Payment capture — **Priority:** P0 (money)
- **Roleplay:** You are Anil capturing the buyer's payment so the farmer can be paid.
- **Preconditions:** Deal `accepted` or `in_transit`; broker KYC verified (TC-VYP-116) for the positive path.
- **Test data:** Amount `₹60,000` (gross), method `bank_transfer`, ref `BROKERPMT01`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | (Negative, unverified broker) Attempt `POST /broker/deals/{id}/payment-capture` with unverified broker KYC | `403 BROKER_KYC_REQUIRED` |
| 2 | As verified broker click **Capture Payment** → amount ₹60,000, method `bank_transfer`, ref `BROKERPMT01` → confirm | Razorpay split executed: **farmer leg** (gross − commission) + **commission leg** (brokerPct default 2% = ₹1,200); escrow `held`; `audit_logs` row `DEAL_PAYMENT_CAPTURE` written |
| 3 | Try capturing again on the same deal | `409 ALREADY_CAPTURED` — once only |
| 4 | Check farmer notification | Farmer sees payment held in escrow (not yet paid out) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-124: Release payout — blocked inside 48 h window & on open dispute
- **Module:** 3.18 Broker / Release — **Priority:** P1 (money)
- **Roleplay:** You are Anil releasing the farmer's money after the silent window.
- **Preconditions:** Deal captured (TC-VYP-123), delivered (TC-VYP-120), releaseAt = deliveredAt + 48 h.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Immediately after delivery click **Release Payout** | `409 RELEASE_WINDOW_OPEN` — payout blocked until the 48 h silent window closes (escrow `releaseAt` in future) |
| 2 | Open a dispute on the deal (TC-VYP-126) and retry after window | `409 DISPUTE_OPEN` — release blocked while dispute is open |
| 3 | (Dev fast-forward 48 h, dispute resolved) Click **Release Payout** (`POST /broker/deals/{id}/release-payout`) | Farmer settlement row written; farmer notified `deal_payout_released` 🔄; audit entry present; commission leg settled to you |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-125: Contract PDF (SHA-256) + receipt PDF
- **Module:** 3.18 Broker / Documents — **Priority:** P1
- **Roleplay:** You are Anil downloading the e-contract and the farmer's receipt.
- **Preconditions:** Deal `accepted`+ (contract issued).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the deal click **Contract** (`GET /broker/deals/{id}/contract`) | PDF contains deal terms + acceptance log + **SHA-256 integrity hash**; JSON download also available |
| 2 | 🔄 Ramesh opens the contract matched by his phone | Farmer can access the same contract PDF (phone match) |
| 3 | Click **Receipt** (`GET /broker/deals/{id}/receipt`) | Receipt shows payout **net of commission** and is **adjustment-aware** (uses the pro-rata amount from TC-VYP-120 if any) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-126: Dispute + escalate (one open; once-only escalation)
- **Module:** 3.18 Broker / Disputes — **Priority:** P1
- **Roleplay:** You are Anil handling a quality complaint on a delivered deal.
- **Preconditions:** Deal `accepted`/`in_transit`/`completed`.
- **Test data:** Category `quality`, reason "5 crates bruised on arrival".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Click **Dispute** → category + reason → submit (`POST /broker/deals/{id}/disputes`) | Dispute opened; **evidence vault frozen** (frozen banner); escrow `disputeOpenedAt` pauses payout; **72 h SLA**; admin task emitted |
| 2 | Try opening a second dispute | Rejected — one open dispute per deal |
| 3 | Open `GET /broker/deals/{id}/disputes` | Dispute listed |
| 4 | Click **Escalate** → reason → submit (`POST /broker/deals/{id}/escalate?reason=…`) | Admin mediator queue task created |
| 5 | Escalate again | `409 ALREADY_ESCALATED` — once only |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-127: Leads CRM — create, statuses, filter chips, drop
- **Module:** 3.18 Broker / Leads — **Priority:** P2
- **Roleplay:** You are Anil tracking prospective parties in your ledger.
- **Preconditions:** Logged in as broker.
- **Test data:** Lead: name `Kaka Trader`, phone `98220 70007`, type buyer, note "Wants 50 q onion weekly".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/broker/leads` | Leads list with filter chips by status |
| 2 | Click **Add Lead** → fill test data → save (`POST /broker/leads`) | Lead created with **AI score + deadlockRisk** attached |
| 3 | Move the lead through statuses `active → contacted → negotiating → converted` (`PUT /broker/leads/{id}`) | Each status saved; filter chips filter correctly |
| 4 | Create a second lead → **Delete** it | Status → `dropped`; disappears from active list |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-128: Wholesale buyer requirements board — respond
- **Module:** 3.18 Broker / Buyer requirements — **Priority:** P2
- **Roleplay:** You are Anil responding to a posted wholesale requirement.
- **Preconditions:** A wholesale buyer requirement exists (seeded or posted by buyer persona).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/broker/leads` → **Wholesale Buyer Requirements** board (`GET /broker/buyer-requirements`) | Requirements listed with crop/qty/location |
| 2 | Click **Respond** on one (`POST /broker/buyer-requirements/{id}/respond`) | A **buyer lead is pre-filled** linked to the requirement; the requirement's **responsesCount** increments |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-129: Trust tier page
- **Module:** 3.18 Broker / Trust — **Priority:** P2
- **Roleplay:** You are Anil checking your Proven Broker progress.
- **Preconditions:** Broker KYC verified.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/broker/trust` (`TrustTierPage`) | `GET /broker/trust-tier`: caseStatus, slaHours (48–72 config), slaDeadline, **slaBreached flag** → admin escalation task when breached |
| 2 | Check Proven Broker progress | Shows completed deals vs required volume, rating, KYC clock |
| 3 | Verify components | Commission earned/pending/paid totals visible |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-130: Commissions & settlements tab — weekly payouts
- **Module:** 3.18 Broker / Commissions — **Priority:** P2
- **Roleplay:** You are Anil checking your dalali (commission) payouts.
- **Preconditions:** At least one completed deal with captured payment.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/broker` open tab **Commissions & Settlements** | Per-deal commission lines (earned/pending/paid paisa) |
| 2 | Check the weekly settlements table | Weekly rows note "Sunday cron … RazorpayX payout" |
| 3 | Via Swagger `GET /broker/commissions` | totalEarned, pendingPayout, completedDealsCount, activeDealsCount all consistent |
| 4 | Via Swagger `GET /broker/settlements` | Settlement rows match the table |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### TC-VYP-131: Deal detail page — status flow bar & full action set
- **Module:** 3.18 Broker / Deal detail — **Priority:** P1
- **Roleplay:** You are Anil walking a deal through its whole life on `/broker/deals/{id}`.
- **Preconditions:** A fresh deal (TC-VYP-117).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/broker/deals/{id}` (`DealDetailPage`) | Status flow bar shows **negotiating → contract_issued → accepted → in_transit → completed** (+ cancelled/expired); TTL notice visible while pending |
| 2 | Click **Issue Contract** | Status → `contract_issued`; 🔄 farmer notified `deal_contract_issued` |
| 3 | 🔄 Farmer accepts → click **Mark In Transit** | Status → `in_transit`; farmer notified `deal_in_transit` |
| 4 | Use **Deal Actions**: Vehicle, Add Milestone, Capture Payment, Release Payout, Complete Deal, Chat Room, Contract, Receipt, Dispute, Escalate | Each action opens its modal (already verified individually in TC-VYP-118…TC-VYP-126) |
| 5 | Click **Complete Deal** | Status → `completed`; `deliveredAt` + `releaseAt = deliveredAt + 48 h` set; farmer notified `deal_completed` 🔄 |
| 6 | Try **Chat Room** on a `negotiating` deal | `409 CHAT_LOCKED` — chat only in `accepted`/`in_transit`/`completed`; on an accepted deal the `broker_deal` chat room opens |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

## 4. Module coverage matrix

| # | Module (inventory section) | Cases (IDs) | Count |
|---|----------------------------|-------------|------:|
| 1 | Role Registration & Onboarding (auth, profile, KYC, bank, gates) | TC-VYP-01 – TC-VYP-10 | 10 |
| 2 | Home / Dashboard (KPIs, pickups/escrow cards, hub, 4 tabs, cashflow) | TC-VYP-11 – TC-VYP-17 | 7 |
| 3.1 | Produce Discovery & Booking | TC-VYP-18 – TC-VYP-23 | 6 |
| 3.2 | Purchase Lifecycle / My Purchases (incl. 5 ⚠️ spec-delta cases) | TC-VYP-24 – TC-VYP-48 | 25 |
| 3.3 | Structured Offers / Negotiation | TC-VYP-49 – TC-VYP-53 | 5 |
| 3.4 | Demand Posting (incl. standing orders) | TC-VYP-54 – TC-VYP-57 | 4 |
| 3.5 | Mandi Rate Posting | TC-VYP-58 – TC-VYP-61 | 4 |
| 3.6 | J-Form Procurement | TC-VYP-62 – TC-VYP-66 | 5 |
| 3.7 | Seller Stock & Resale Exchange | TC-VYP-67 – TC-VYP-72 | 6 |
| 3.8 | POS Sales, Buyer Khata & Cashflow | TC-VYP-73 – TC-VYP-78 | 6 |
| 3.9 | Krishi Mall Storefront (web + mobile) | TC-VYP-79 – TC-VYP-83 | 5 |
| 3.10 | Team Accounts | TC-VYP-84 – TC-VYP-86 | 3 |
| 3.11 | Contracts (buyer side) | TC-VYP-87 – TC-VYP-92 | 6 |
| 3.12 | Bulk Orders / Buyer Network | TC-VYP-93 – TC-VYP-95 | 3 |
| 3.13 | Sourcing & AI Insights | TC-VYP-96 | 1 |
| 3.14 | Ratings & Reputation | TC-VYP-97 – TC-VYP-98 | 2 |
| 3.15 | Settlements, TDS, GST & Compliance | TC-VYP-99 – TC-VYP-104 | 6 |
| 3.16 | P&L, Diary, Analytics, Ads, Chatbot, Community | TC-VYP-105 – TC-VYP-112 | 8 |
| 3.17 | Billing / Plans | TC-VYP-113 – TC-VYP-114 | 2 |
| 3.18 | Broker / Dalal Desk (broker role) | TC-VYP-115 – TC-VYP-131 | 17 |
| | **Total** | **TC-VYP-01 – TC-VYP-131** | **131** |

> ⚠️ Spec-delta cases: TC-VYP-44, TC-VYP-45, TC-VYP-46, TC-VYP-47, TC-VYP-48 — expected to FAIL on the current build; raise defects, do not block sign-off on them.

---

## 5. Sign-off

| Summary | Count |
|---------|------:|
| Total cases | 131 |
| P0 cases | 20 (TC-VYP-01, 02, 03, 05, 06, 07, 10, 18, 21, 25, 27, 29, 32, 35, 62, 63, 73, 75, 99, 123) |
| P1 cases | 83 (incl. 3 ⚠️ spec-delta: TC-VYP-44, 45, 46) |
| P2 cases | 28 (incl. 2 ⚠️ spec-delta: TC-VYP-47, 48) |
| ⚠️ Expected-fail (spec deltas) | 5 |
| Passed | ______ |
| Failed | ______ |
| Defects raised | ______ |

**⚠️ delta re-check:** all 5 ⚠️ cases re-run after fixes → Pass ______ / Fail ______

| Tester | Name / Sign | Date |
|--------|-------------|------|
| Tester A (Vyapari) | | |
| Tester B (Farmer/DirectBuyer) | | |
| Tester C (Admin) | | |

**Release gate (from suite README):** all P0 pass, ≥ 95% P1 pass, zero open Blocker defects.
