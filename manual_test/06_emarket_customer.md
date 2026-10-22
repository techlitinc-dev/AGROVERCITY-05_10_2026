# E-Market Customer (Agri-mall Buyer) — Manual Test Script (Final UAT)

> This script is for **Tester A** roleplaying **Meena Deshmukh**, an agri-mall customer who buys
> organic vegetables, A2 ghee, gruh-udyog papad and balcony plants for a family of 4. It contains
> **115 test cases** in 24 modules. Estimated execution time: **2 working days** (Day 1: setup +
> modules 1–9; Day 2: modules 10–24), plus simultaneous runs with Tester B for the 🔄 steps
> (see [07_cross_persona_e2e.md](07_cross_persona_e2e.md)).

---

## 0. Roleplay card

| Field | Value |
|-------|-------|
| **Name** | Meena Deshmukh |
| **Age** | 29 |
| **Background** | Pune-based working professional (IT job); shops for a family of 4; prefers organic vegetables, A2 ghee, hand-made papad, and plants for her balcony garden |
| **Language** | English + हिन्दी (run parts of this script in हिन्दी — see TC-EMC-06 and TC-EMC-31) |
| **Device** | Phone browser (website) **and** Flutter app; also has a second "business" account for FarmGate bulk buying tests |
| **Goal for this test** | Prove that a retail buyer can discover products, order & pay (UPI/COD/BNPL), track & return orders, negotiate FarmGate quotes within the 3-round / 30-min-price-lock / fair-band rules, pass inspection, and stay chat-compliant — while farmers/sellers on the other side get paid correctly |
| **Linked personas** | Farmer (sells lots/products to Meena), Vyapari (seller), Mahila Graha Udyog (papad seller), Nursery (plants), Transporter (platform transport orders), Admin (KYC approval, order status, dispute resolution) — played by Tester B / Tester C |
| **Compliance areas owned** | C1 profile · C2 demands · C3 discovery · C4 quotes · C5 negotiation (3 rounds, price lock, fair band) · C6 booking/cart · C7 chat · C8 inspection · C9 payments/invoices/credit · C10 disputes · C11 favorites/repeat · C12 ratings · C13 planner |

---

## 1. Account & test data setup

1. **Backend check.** Confirm `http://<host>:8000/health` returns OK and `/docs` loads.
2. **Fresh customer account.** On the website (`website/`) tap **Login / Register**, enter the test
   phone number from the table below, request OTP, and read the OTP from the dev API response
   (`otp` / `devOtp` field — SMS provider is not wired). Verify the phone.
3. **Role picker.** In the app (`profile_select_view`), tick **"E-Market Customer / ई-मार्केट ग्राहक"**
   and star it as **primary**. Also tick **Farmer** as a linked profile (needed to test that a
   farmer+customer combined account still passes every `/customer/*` screen).
4. **MPIN.** Set demo MPIN `1234` (`POST /auth/mpin/set`) and enable biometric login.
5. **Profile.** Set display name **Meena Deshmukh**, language **English**, family size **4**,
   dietary preference **Vegetarian + Organic**.
6. **Business account (for KYC / FarmGate bulk tests).** Create a second account with the business
   phone below; set account type **business**; keep KYC **pending** until TC-EMC-07.
7. **Addresses.** Save the two Pune addresses below (home first — it becomes default).
8. **Counterpart accounts (Tester B).** One Farmer account with open `market_lots` (Tomato,
   Onion, A2 Ghee), one Mahila Graha Udyog account with papad products, one Nursery account with
   plants — as listed in their own persona docs.
9. **Payments.** Razorpay must be in test mode; use the sandbox UPI ID below. UPI collect in dev
   uses the fallback signature `dev`.
10. **Admin (Tester C).** Super-admin panel open for KYC approval, order status `PATCH`, kill-switch
    and settlement config.

| # | Data item | Concrete value |
|---|-----------|----------------|
| 1 | Customer phone (household) | `+91 98220 70001` — Tester A's own SIM (fresh number, never registered) |
| 2 | Business phone | `+91 98YYYYYYYY` — second SIM/physical device |
| 3 | Test OTP | From `/auth/otp/send` dev response |
| 4 | MPIN | `1234` |
| 5 | Customer name | Meena Deshmukh |
| 6 | Home address | Flat 502, Sunshine Residency, Baner Road, Pune, Maharashtra, **Pin 411045** |
| 7 | Office address | 3rd Floor, Tower B, Baner Business Bay, Baner, Pune, **Pin 411045** |
| 8 | Sandbox UPI ID | `meena.deshmukh@upibank` (test VPA, ask team) |
| 9 | Family / diet | Family of 4 · Vegetarian · Organic preference |
| 10 | Retail products to buy | Organic Tomato 1 kg · A2 Ghee 500 ml · Gruh-udyog Papad 200 g · Tulsi plant · Onion 2 kg |
| 11 | Bulk crops (FarmGate) | Tomato Grade A · Onion Grade B · A2 Ghee (category `a2ghee|ghee`) |
| 12 | Test GSTIN / PAN (business) | GSTIN `27ABCDE1234F1Z5` · PAN `ABCDE1234F` (sandbox values from team) |
| 13 | Coupon codes | Ask [ADMIN] for active codes, e.g. `WELCOME10` (min ₹0), `FESTIVAL20` (min ₹999) |
| 14 | Referral invite target | `+91 98ZZZZZZZZ` (Tester B's fresh phone) |
| 15 | Farmer counterpart | Tester B's Farmer (see 01_farmer.md) — lots: Tomato ₹1,800/q, Onion ₹1,400/q |
| 16 | Today's date | 2026-10-22 (use for "needed-by", pickup dates ≥ tomorrow) |

---

## 2. Preconditions checklist

Check these once before starting; re-check on Day 2.

- [ ] Backend `/health` OK; website opens; Flutter app installed on Tester's phone.
- [ ] Test OTP flow works (OTP visible in API response).
- [ ] Razorpay test keys configured (`PAYMENTS_NOT_CONFIGURED` must NOT appear).
- [ ] Demo MPIN `1234` accepted.
- [ ] [ADMIN] Super-admin login works; KYC queue reachable.
- [ ] Tester B ready with Farmer (+ MGU + Nursery) accounts and open lots/products.
- [ ] Settlement config at defaults: deposit 20%, high-value threshold ₹10,000, price lock 30 min
      (`emarketPriceLockMinutes`), produce commission 5% (`emarketProducePct`), surge mode off.
- [ ] No pre-existing open orders/quotes/demands on Meena's accounts (clean slate).
- [ ] Both testers' phones charged; two devices available for simultaneous 🔄 steps.

---

## 3. Test cases

**Compliance map (feature doc C1–C13 → modules).** Every compliance area is covered by the modules
below; use this table to prove C1–C13 coverage at sign-off.

| Compliance area | Covered in |
|-----------------|------------|
| C1 Profile (users/settings) | Module 1 (TC-EMC-01…05) |
| C2 Demands | Module 10 (TC-EMC-71…73) |
| C3 Discovery | Modules 3, 6, 7 (TC-EMC-15…21, 43…48) |
| C4 Quotes | Module 8 (TC-EMC-49…56) |
| C5 Negotiation — 3-round cap, 30-min price lock, fair band | Modules 8, 11 (TC-EMC-49…56, 74…78) |
| C6 Booking / cart | Module 4 (TC-EMC-22…34) |
| C7 Chat — banned-phrase scan, no VoIP/number reveal | Module 12 (TC-EMC-79…83) |
| C8 Inspection | Module 9 (TC-EMC-61…64) |
| C9 Payments / invoices / credit | Modules 4, 5, 9, 15, 16 (TC-EMC-30…33, 37, 41, 42, 60, 70, 90…93) |
| C10 Disputes | Module 9 (TC-EMC-63, 65) |
| C11 Favorites / repeat orders | Modules 5, 7, 14 (TC-EMC-40, 47, 89) |
| C12 Ratings | Module 19 (TC-EMC-98…101) |
| C13 Planner | Module 14 (TC-EMC-89) |

### 3.1 Module 1 — Onboarding, Login & Profile (C1)

Covers: phone auth, OTP, role picker, MPIN/biometric, profile settings, language toggle,
business KYC + business-buyer gate + first-quote attestation.

### TC-EMC-01: Register a new customer account with phone OTP
- **Module:** 1 Onboarding & Profile      **Priority:** P0
- **Roleplay:** You are Meena, a first-time buyer. You heard about the agri-mall and want an account with your phone number.
- **Preconditions:** Backend up; fresh phone number (data #1); app or website open.
- **Test data:** Phone `+91 98XXXXXXXX`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the app/website → tap **Login / Register** | Phone entry screen opens |
| 2 | Enter `+91 98XXXXXXXX` → tap **Send OTP** | "OTP sent" toast; OTP visible in dev API response |
| 3 | Enter the OTP from the response → tap **Verify** | Phone verified; registration/onboarding continues |
| 4 | Complete name field with `Meena Deshmukh` → continue | Account created; role picker (Step 2 of 4) appears |
| 5 | Open `/auth/check` in `/docs` with the same phone (API check) | Response says the phone **exists** now |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-02: OTP negative paths — wrong OTP, resend, wrong phone format
- **Module:** 1 Onboarding & Profile      **Priority:** P0
- **Roleplay:** You are Meena. You type the OTP wrong once, then request a fresh code.
- **Preconditions:** Same phone; OTP already requested in TC-EMC-01 (wait 1 min).
- **Test data:** Wrong OTP `000000`; valid OTP from latest dev response.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On OTP screen enter `000000` → tap **Verify** | "Invalid OTP" error; you stay on the OTP screen |
| 2 | Tap **Resend OTP** | New OTP issued; new `otp` value in dev response |
| 3 | Enter the NEW OTP → **Verify** | Verification succeeds |
| 4 | (API) `POST /auth/otp/send` with phone `98765` (no country code) | Request rejected: phone must be E.164 `+91…` format |
| 5 | (API) `POST /auth/otp/verify` with an OTP that was already used | Rejected; OTP is single-use |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-03: Role picker — Customer primary, Farmer linked
- **Module:** 1 Onboarding & Profile      **Priority:** P0
- **Roleplay:** You are Meena. You shop, but your family also farms a small plot, so you keep both profiles on one account.
- **Preconditions:** Logged in; on profile-select screen (onboarding step 2 of 4).
- **Test data:** Personas "E-Market Customer" + "Farmer".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap the **E-Market Customer / ई-मार्केट ग्राहक** tile ("Shop agri products, track orders & save with coupons") | Tile selected |
| 2 | Star it as **primary / active profile** | Star icon appears; tagline remains visible |
| 3 | Also tick **Farmer (Kisan)** (do not star) | Both tiles ticked; warning if you try 0 personas: "Select at least one persona" |
| 4 | Finish onboarding → open any `/customer/*` screen (e.g., Home) | Screen loads — combined farmer+customer account is accepted (linkedProfiles includes customer) |
| 5 | (API) `GET /customer/home` | 200 OK, not 403 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-04: Login with MPIN, biometric, sessions & logout
- **Module:** 1 Onboarding & Profile      **Priority:** P0
- **Roleplay:** You are Meena. You log out and come back the next day using your MPIN, not OTP.
- **Preconditions:** Account registered; MPIN not yet set.
- **Test data:** MPIN `1234`; wrong MPIN `9999`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Go to Settings → **Set MPIN** → enter `1234` twice | MPIN set; success message |
| 2 | Log out (**Logout** in menu) → on login screen choose **MPIN login** → enter `9999` | "Wrong MPIN" error; not logged in |
| 3 | Enter `1234` | Logged in to Home |
| 4 | Log out → choose **Biometric** (register fingerprint first via `POST /auth/biometric/register`) | Biometric prompt; login succeeds after scan |
| 5 | Settings → **Active sessions** (`GET /auth/sessions`) | Lists current session(s) with device/time; tap **Revoke** on one → that session dies |
| 6 | `POST /auth/logout` | Session cleared; login screen shown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-05: Profile & settings — name, family size, diet, women mode
- **Module:** 1 Onboarding & Profile      **Priority:** P1
- **Roleplay:** You are Meena. You set family size 4 and vegetarian+organic so the "AI Basket" fits your household, and you try women-mode to surface SHG products.
- **Preconditions:** Logged in as household customer.
- **Test data:** Family size `4`; dietary `vegetarian`; preference `organic`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Profile / Settings** → edit display name → save | Name updated on Home greeting |
| 2 | Set **Family size = 4** | Saved (`users.updateSettings`) |
| 3 | Set **Dietary preference = Vegetarian + Organic** | Saved |
| 4 | Toggle **Women mode ON** → open Home | Gruh-udyog / women-enterprise listings lifted to top sections |
| 5 | Log out → log in → reopen Home | Women mode still ON (setting persists) |
| 6 | Toggle **Women mode OFF** | Home returns to normal ordering |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-06: Onboarding & home in हिन्दी — labels render correctly
- **Module:** 1 Onboarding & Profile      **Priority:** P1
- **Roleplay:** You are Meena. Your mother-in-law uses the app in हिन्दी; you check the labels are real Hindi, not English placeholders, and nothing overflows.
- **Preconditions:** Logged in.
- **Test data:** Language = हिन्दी.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Settings → **Language → हिन्दी** | UI switches to Hindi |
| 2 | Open Home | Greeting and cards show Hindi labels (e.g., ई-मार्केट ग्राहक on role picker); no English placeholder text like `home.title` |
| 3 | Open Krishi Mall catalog | Category chips and search placeholder in Hindi; no text cut off / overflowing buttons |
| 4 | Open an order detail | Status labels in Hindi |
| 5 | Switch back to **English** | UI returns to English fully |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-07: Business buyer KYC — submit gstin + pan, admin approves
- **Module:** 1 Onboarding & Profile      **Priority:** P1
- **Roleplay:** You are Meena, but on your business account (a small organic-food reseller). You must complete KYC before you can request bulk quotes.
- **Preconditions:** Logged in as business phone (data #2); accountType = business; [ADMIN] ready.
- **Test data:** GSTIN `27ABCDE1234F1Z5`; PAN `ABCDE1234F`; Aadhaar (masked) + bank doc.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **KYC / Get verified** on the business account | KYC form for persona `emarket_business`: required **GSTIN + PAN**; conditional udyam / trade_licence / apmc_mandi_licence / fssai shown |
| 2 | Upload masked Aadhaar JPEG (≤5 MB), PAN, bank proof → submit (`POST /kyc/cases`) | Case created; `GET /kyc/status` shows **pending** |
| 3 | [ADMIN] open KYC queue → review case → **approve gstin + pan** | Case approved/verified |
| 4 | `GET /kyc/status` as Meena | gstin and pan show **verified** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-08: Business gate — quote blocked before KYC (403 KYC_REQUIRED)
- **Module:** 1 Onboarding & Profile      **Priority:** P1
- **Roleplay:** You are Meena's business account. Before KYC approval you try to request a quote — the platform must stop you.
- **Preconditions:** Second business account (or reset KYC to pending via [ADMIN]) with gstin/pan NOT verified.
- **Test data:** Any open lot.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On a business account with KYC pending, open a seller storefront → **Request Quote** → fill quantity/price → submit | Request rejected: `403 KYC_REQUIRED` — "Complete business KYC (GSTIN + PAN) to request quotes" |
| 2 | (API) `POST /customer/quotes` directly with a token of that user | Same 403 `KYC_REQUIRED`; no quote created |
| 3 | Household account (Meena, no business KYC at all): repeat the same storefront quote | **Allowed** — household accounts skip the gate |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-09: First business quote needs anti-hoarding + no-off-platform attestation (422)
- **Module:** 1 Onboarding & Profile      **Priority:** P1
- **Roleplay:** You are Meena's business account, KYC now approved. On your very first quote you must tick two declarations.
- **Preconditions:** Business account with gstin+pan **verified**; never submitted a quote before.
- **Test data:** Lot = Tomato, 5 q, ₹1,750/q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open storefront → **Request Quote** → fill Tomato 5 q @ ₹1,750 → DO NOT tick declarations → submit | `422 ATTESTATION_REQUIRED` — quote not created |
| 2 | Tick **anti-hoarding declaration** only → submit | Still `422 ATTESTATION_REQUIRED` |
| 3 | Tick both **anti-hoarding** and **no off-platform dealing** → submit | Quote created (HTTP 200/201); attestation timestamps persisted on user |
| 4 | Submit a SECOND quote | No attestation prompt — timestamps already persisted |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-10: KYC document validation — size, type, masked Aadhaar
- **Module:** 1 Onboarding & Profile      **Priority:** P2
- **Roleplay:** You are Meena's business account. You accidentally upload a huge file and a Word doc.
- **Preconditions:** KYC form open.
- **Test data:** 6 MB JPEG; .docx file; full (unmasked) Aadhaar scan.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Upload a **6 MB** image to a doc slot | Rejected: "File must be ≤ 5 MB" |
| 2 | Upload a **.docx** | Rejected: only JPEG/PNG/PDF accepted |
| 3 | Upload an **unmasked** Aadhaar image where masked is required | Rejected with "masked Aadhaar only" message |
| 4 | Upload valid masked Aadhaar PNG | Accepted; thumbnail shown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.2 Module 2 — Home & Dashboard

Covers: greeting, weather, banners, quick links, orders/subscription strips, bell, coins,
recommendations (AI basket / best prices / seasonal alternatives), women-mode effect, empty states.

### TC-EMC-11: Home sections all render
- **Module:** 2 Home & Dashboard      **Priority:** P1
- **Roleplay:** You are Meena. You open Home to see your store at a glance.
- **Preconditions:** Logged in; at least one active order exists (run TC-EMC-30/31 first) — else expect empty strips and verify TC-EMC-14.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Home (`/customer/home`) | Greeting "Namaste Meena, welcome to your farm store" + CTAs **Shop Krishi Mall**, **Track Orders** |
| 2 | Scroll down | Weather card ("Weather at your farm": temp, condition, rain %, 3-day forecast) |
| 3 | Scroll further | Promo banners (title/headline/CTA); quick links grid: My Orders, Subscriptions, Wallet & Coins, Wishlist, Cart, Krishi Mall |
| 4 | Check bell icon and AgriCoins card | Bell shows **unread count**; coins card shows balance |
| 5 | Check "Your Orders" strip | Active order(s) with status badge, total, date |
| 6 | Check "Today's mandi rates near you" strip | Crop, ₹/kg rate, mandi name, up/down price change arrow |
| 7 | Check "Subscription Box" strip (if subscription exists) | Label, frequency, next delivery date |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-12: Recommendations — AI basket, best prices, seasonal alternatives; women mode
- **Module:** 2 Home & Dashboard      **Priority:** P1
- **Roleplay:** You are Meena (family of 4, veg + organic). You check the mall suggests sensible baskets sized for your family.
- **Preconditions:** Logged in; family size 4, veg+organic set (TC-EMC-05).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Home → "For You — AI Basket" | Recommendations sized by familySize with reasons like "You buy X often — sized for your family of 4" and "Top rated on the mall"; filtered to veg/organic |
| 2 | Check wishlist heart + Add to Cart on a recommended card | Heart toggles wishlist; Add to Cart adds to cart |
| 3 | Open "Best prices on the mall" | Cheapest product per category listed; "Seasonal alternatives" shown |
| 4 | Check "Seasonal Picks" | Produce matches current month (October) |
| 5 | Toggle **Women mode ON** → reopen Home recommendations | Gruh-udyog listings lifted to top; toggle OFF → normal order |
| 6 | (API) `GET /customer/recommendations` | `{basket, bestPrice, seasonalAlternatives}` all present |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-13: Notification bell, unread count & deep links
- **Module:** 2 Home & Dashboard      **Priority:** P1
- **Roleplay:** You are Meena. After ordering, you check what the app tells you.
- **Preconditions:** At least one notification exists (e.g., order placed in TC-EMC-30).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap the **bell** on Home | `/notifications` opens; list shows notifications with title, text, time |
| 2 | Tap an order-status notification | Deep-links to `/dashboard/p/orders` (order list) |
| 3 | Mark all read / open one | Unread count on Home bell decreases |
| 4 | Check `GET /customer/home` field | `unreadNotifications` matches bell badge |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-14: Home empty states — no farm boundary, no orders, no subscriptions
- **Module:** 2 Home & Dashboard      **Priority:** P2
- **Roleplay:** You are Meena on a brand-new account. Nothing is set up yet; the Home must not show broken cards.
- **Preconditions:** Fresh account (or account with no farm location, no orders, no subscriptions).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Home on the fresh account | Page loads; no errors |
| 2 | Inspect the weather card | Empty state: "Weather appears once your farm boundary location is saved" |
| 3 | Inspect "Your Orders" strip | Empty state / hidden; no crash |
| 4 | Inspect "Subscription Box" strip | Empty state / hidden; no crash |
| 5 | (API) `GET /customer/home` | Each section degrades independently; no 500 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.3 Module 3 — Krishi Mall Catalog & Product Detail (C3)

Covers: catalog screen, category chips, women-led chip, search, product detail (price/MRP/save %,
BNPL, stock stepper, seller card, specs, reviews), "Ask seller" disabled pre-order (G1), QR
certificate, wishlist, product reviews.

### TC-EMC-15: Browse the Krishi Mall catalog
- **Module:** 3 Mall Catalog      **Priority:** P0
- **Roleplay:** You are Meena. You open the mall to buy vegetables and ghee.
- **Preconditions:** Logged in; products seeded (farmer/MGU/nursery products from Tester B).
- **Test data:** Search "ghee"; category "Organic Produce".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Home → **Shop Krishi Mall** (`/mall`) | Title "Krishi Shopping Mall (Direct Agri Inputs)"; product grid loads |
| 2 | Check category chips | All, Seeds, Fertilizers, Crop Protection, Tools & Machinery, Organic Produce, Cattle Feed + dynamic + gruh-udyog categories |
| 3 | Tap **Organic Produce** chip | Grid filters to organic produce only |
| 4 | Tap **Women-led** chip | Only `source=gruh_udyog / women_enterprise` products shown |
| 5 | Type `ghee` in search ("Search by brand, seed variety, or fertilizer…") | Results filtered to ghee products (debounced) |
| 6 | Check product cards | Each card shows image, name, price, wishlist heart, **Add to Cart**; flash banners visible if active |
| 7 | Check header buttons | "View Cart (n)" with count; Wishlist button |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-16: Product detail — all elements & stock rules
- **Module:** 3 Mall Catalog      **Priority:** P0
- **Roleplay:** You are Meena. You open the A2 Ghee product to check the seller, batch and whether you can afford the quantity you want.
- **Preconditions:** At least one product with stock, one **out-of-stock** product.
- **Test data:** A2 Ghee 500 ml; an out-of-stock item.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap the A2 Ghee product | Product detail opens: image, brand, category, title, "Sold by {seller}" |
| 2 | Inspect price block | Price + MRP strikethrough + "Save N %"; Batch no. shown; "New listing" or rating stars + review count |
| 3 | Check BNPL line | "**BNPL available**" banner visible when `bnplAvailable=true` |
| 4 | Check info chips | Nutrition / Harvested / Expected delivery slots chips |
| 5 | Tap **+** on the qty stepper beyond stockQty | Stops at max stockQty (min 1) |
| 6 | Tap **Add to Cart · ₹X** | Item added; cart count +1 |
| 7 | Open the out-of-stock product | "**Add to Cart**" disabled with "Out of Stock" |
| 8 | Scroll down | Description, Specifications table, gruh-udyog unit brand card (if women-led: name, category, village/district, SHG, "Women-led enterprise"), Reviews list |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-17: View shop & "Ask seller" locked before order (G1)
- **Module:** 3 Mall Catalog      **Priority:** P1
- **Roleplay:** You are Meena. You want to ask the seller about the ghee — but chat must stay locked until you have a confirmed order with them.
- **Preconditions:** Product detail open; you have NO confirmed order with this seller yet.
- **Test data:** A2 Ghee seller.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **View shop** next to "Sold by {seller}" | Seller storefront `/mall/seller/{sellerId}` opens |
| 2 | Go back to product detail | — |
| 3 | Check the **Ask seller** button | Button is **disabled** with caption "Chat unlocks after order confirmation" (G1 gate) |
| 4 | (After TC-EMC-36: order with this seller reaches **confirmed**) come back to this product | **Ask seller is now enabled** and opens chat |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-18: View QR Quality Certificate — available & unavailable
- **Module:** 3 Mall Catalog      **Priority:** P1
- **Roleplay:** You are Meena. You only buy certified organic, so you check the QR certificate before paying.
- **Preconditions:** Two products: one with a certificate (batchNo), one without.
- **Test data:** A2 Ghee (cert), a generic product (no cert).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On cert product tap **View QR Certificate** | Modal "Quality Certificate": all certificate fields shown; boolean fields show "Yes ✓" |
| 2 | Scan the shown QR (phone camera) | QR resolves to the certificate data for this batchNo |
| 3 | (API) `GET /products/{id}/certificate` for the no-cert product | `404 CERTIFICATE_NOT_FOUND` |
| 4 | On no-cert product tap **View QR Certificate** | Modal "Certificate unavailable" — graceful, no crash |
| 5 | (Mobile) Tap product card → CertificateDialog | Cert + add-to-cart + wishlist actions work in the dialog |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-19: Wishlist — add, de-dupe, remove
- **Module:** 3 Mall Catalog      **Priority:** P1
- **Roleplay:** You are Meena. You heart the papad and tulsi plant to buy later.
- **Preconditions:** Logged in; products available.
- **Test data:** Papad 200 g; Tulsi plant.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap the **heart** on Papad card | Heart fills; wishlist count +1 |
| 2 | Tap the heart again (un-heart) then heart again | Toggles off/on without error |
| 3 | (API) `POST /wishlist` same product twice | Second add is de-duplicated — one entry only |
| 4 | Open **Wishlist** from catalog header | Both wishlisted items listed with move-to-cart option |
| 5 | Remove Tulsi from wishlist | Item removed; list updates |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-20: Product reviews — list & submit (one per user, upsert)
- **Module:** 3 Mall Catalog      **Priority:** P1
- **Roleplay:** You are Meena. The ghee was good; you rate it 5 stars with a comment.
- **Preconditions:** Product delivered earlier (or form available on detail page).
- **Test data:** Rating 5★; comment "Great organic ghee, family loved it".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open product detail → **Reviews** | List shows stars, comment, userName, date |
| 2 | Scroll to **Rate this product** → select 5 stars → enter comment → **Submit Review** | Review saved; `POST /products/{id}/reviews` upserts |
| 3 | Change rating to 4★ → submit again | Same review updated (upsert — still ONE review from you); `ratingAvg`/`ratingCount` recomputed |
| 4 | Reload detail page | Your review visible in the list with correct average |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-21: Search with no results & catalog empty state
- **Module:** 3 Mall Catalog      **Priority:** P2
- **Roleplay:** You are Meena. You search for something exotic that does not exist.
- **Preconditions:** Logged in.
- **Test data:** Search `dragonfruit`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On catalog, search `dragonfruit` | Empty state shown: no-results message / illustration — no blank screen, no error |
| 2 | Clear the search | Full catalog returns |
| 3 | Search with 40+ characters | No crash; reasonable empty result |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.4 Module 4 — Cart & Checkout (C6)

Covers: cart (server truth), qty steppers, remove, produce cart section, addresses, delivery
slots, coupons, coins, delivery fee ₹99/free >₹1500, plant-a-tree, UPI/COD/BNPL, idempotency,
place-order validations.

### TC-EMC-22: Manage the cart — add, stepper, remove, server truth
- **Module:** 4 Cart & Checkout      **Priority:** P0
- **Roleplay:** You are Meena. You put tomato, papad and a tulsi plant in the cart, then drop the papad.
- **Preconditions:** Logged in; products in stock.
- **Test data:** Organic Tomato 1 kg ×2; Papad ×1; Tulsi ×1.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Add Tomato ×2, Papad ×1, Tulsi ×1 from catalog cards | Cart badge shows 3 lines |
| 2 | Open **View Cart (3)** (`/mall/cart`) | All 3 items listed with qty steppers and trash icon; totals match |
| 3 | Tap **+** on Tomato | Qty 3; line total and grand total update (server `PUT /cart/items/…`) |
| 4 | Tap **–** on Papad to 0 / trash on Papad | Item removed with confirm |
| 5 | Reload the page | Cart identical — **server `GET /cart` is the source of truth** |
| 6 | (API) `POST /cart/items` with qty `0` | Rejected (qty < 1) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-23: Cart negatives — unknown product, out-of-stock at add time
- **Module:** 4 Cart & Checkout      **Priority:** P2
- **Roleplay:** You are Meena. A product you added went out of stock while you were browsing.
- **Preconditions:** A product that can be set to stock 0 by [ADMIN]/seller 🔄.
- **Test data:** Any product.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | (API) `POST /cart/items` with a fake product id | `404 PRODUCT_NOT_FOUND` |
| 2 | 🔄 second tester (see 07_cross_persona_e2e.md): seller sets the product stock to 0 | — |
| 3 | Try to increase that item's qty in cart / re-add it | Blocked: `409 OUT_OF_STOCK`; item shows out-of-stock state in cart |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-24: Delivery addresses — add, default, edit, delete
- **Module:** 4 Cart & Checkout      **Priority:** P1
- **Roleplay:** You are Meena. You add your office address; the first address (home) must stay default.
- **Preconditions:** Logged in; home address may already exist.
- **Test data:** Office: "3rd Floor, Tower B, Baner Business Bay", Village/Area `Baner`, District `Pune`, State `Maharashtra`, Pin `411045`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Checkout → address card → **+ Add New** | Form: Label, Flat/House/Gat No., Village, District, State (default Maharashtra), Pincode |
| 2 | Fill office address (all fields) → **Save** | Saved via `POST /addresses`; appears in radio list |
| 3 | Check default | First-ever address was auto-default; office is not default unless chosen |
| 4 | Edit office → change Label to "Office" → Save | Updated via `PUT /addresses/{id}` |
| 5 | Delete the DEFAULT address (if two exist, make one default first) | Oldest remaining address **promoted to default** |
| 6 | Delete an address → confirm | Removed (`DELETE /addresses/{id}`); list refreshes |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-25: Address validation — pincode & required fields
- **Module:** 4 Cart & Checkout      **Priority:** P1
- **Roleplay:** You are Meena. You mistype the pincode and skip the flat number.
- **Preconditions:** Add-new-address form open.
- **Test data:** Pin `41104` (5 digits); pin `4110451` (7 digits).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Leave Flat/House and Village empty → check **Save** | Save disabled until line1 + village + valid pin entered |
| 2 | Enter pincode `41104` → Save | Rejected: "Pincode must be exactly 6 digits" |
| 3 | Enter pincode `4110451` → Save | Rejected: 6-digit rule enforced |
| 4 | Enter pincode `abc123` → Save | Rejected: digits only |
| 5 | Complete all fields with pin `411045` → Save | Address saved |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-26: Apply a valid coupon
- **Module:** 4 Cart & Checkout      **Priority:** P1
- **Roleplay:** You are Meena. You apply the WELCOME10 code and watch the total drop.
- **Preconditions:** Cart subtotal ≥ coupon minOrder; coupon active (ask [ADMIN]).
- **Test data:** Coupon `WELCOME10`; cart subtotal ₹800.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open cart → payment summary → coupon input | Coupon field + **Apply** + chip shortcuts with "min ₹X" labels |
| 2 | Tap a chip shortcut for your cart total | Code fills in; shortcut disabled if minOrder not met |
| 3 | Enter `WELCOME10` → **Apply** | `POST /coupons/validate` returns `{valid:true, discount, finalTotal}`; summary shows discount line |
| 4 | Check payment summary math | Discount reduces subtotal; delivery fee NOT discounted |
| 5 | Re-apply the same coupon | No double discount — idempotent state |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-27: Coupon negatives — expired, below minOrder, usage exhausted
- **Module:** 4 Cart & Checkout      **Priority:** P1
- **Roleplay:** You are Meena. You try an expired festival code and a high-minimum code on a small cart.
- **Preconditions:** [ADMIN] provides/forces: one expired code, one code with minOrder ₹999, one code with usageLimit 1 already used.
- **Test data:** `EXPIRED50`; `FESTIVAL20` (min ₹999); `ONCEONLY` (limit exhausted).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Apply `EXPIRED50` | Rejected: "Coupon expired" |
| 2 | Apply `FESTIVAL20` with cart ₹800 | Rejected: "Minimum order ₹999 not met"; `applicable:false` in `GET /coupons?cartTotal=800` |
| 3 | Apply `ONCEONLY` (already fully used) | Rejected: "Usage limit exhausted" |
| 4 | Apply a nonsense code `FAKE123` | Rejected: "Invalid coupon" (`400 COUPON_INVALID` path on order) |
| 5 | Enter `welcome10` in lowercase | Handled per spec (accepted if codes are case-insensitive, else clear invalid message) — record behavior |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-28: Krushi Ratna coins — redeem, cap, insufficient
- **Module:** 4 Cart & Checkout      **Priority:** P1
- **Roleplay:** You are Meena. You have 120 coins from referrals; you burn 100 against an ₹800 order.
- **Preconditions:** Coin balance known (`gamification.status().agriCoins`).
- **Test data:** Balance 120 coins; cart after coupon ₹720.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | In payment summary enter coins `100` → **Apply** | Redeemed ₹100 (1 coin = ₹1); grand total drops |
| 2 | Enter coins more than subtotal-after-coupon | Capped at payable; no negative total |
| 3 | Enter coins `99999` (way over balance) | Rejected: `422 COINS_INSUFFICIENT` |
| 4 | Check balance display | Balance shown next to input = `gamification.status()` value |
| 5 | Complete the order (TC-EMC-30/31 flow) | Balance reduced by redeemed amount; ledger row written |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-29: Delivery fee rule & slot picker
- **Module:** 4 Cart & Checkout      **Priority:** P1
- **Roleplay:** You are Meena. You check whether delivery is free — ₹99 below ₹1500, free above.
- **Preconditions:** Cart ready; two runs: small cart, cart > ₹1500.
- **Test data:** Cart A ₹800; Cart B ₹1,600.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | With ₹800 cart open payment summary | Doorstep delivery fee **₹99** shown |
| 2 | Raise cart above ₹1,500 | Fee becomes **FREE** ("free above ₹1500" client rule; `deliveryFeePaisa=0`) |
| 3 | Check coupon does not eat the fee | On ₹1,600 cart with coupon: fee stays ₹0; on ₹800 cart fee stays ₹99 |
| 4 | Open **delivery slot picker** | Slots shown: product `deliverySlots` union else 7–10 AM / 10–1 PM / 4–7 PM |
| 5 | Pick "10–1 PM" | Slot stored on the order |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-30: Place order — Instant UPI (Razorpay), success screen, idempotency
- **Module:** 4 Cart & Checkout      **Priority:** P0
- **Roleplay:** You are Meena. You pay by UPI for tomato + tulsi and expect a Razorpay popup and an order confirmation.
- **Preconditions:** Cart with items; address saved; Razorpay test mode.
- **Test data:** UPI VPA `meena.deshmukh@upibank`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Cart → choose address → slot → payment method **Instant UPI (Razorpay)** | "Secured checkout · coupon & stock validated server-side" note visible; Pay button shows final total |
| 2 | Tick **Plant a tree (₹0)** | Checkbox ticks; no charge added |
| 3 | Tap **Place Order / Pay ₹X** | Razorpay checkout.js opens (test environment) |
| 4 | Pay with test UPI | `POST /payments/razorpay/verify` succeeds; order status `paid` |
| 5 | Success screen | "Order Placed Successfully!" with **Track Order Timeline** and **Continue Shopping** |
| 6 | 🔄 second tester (see 07_cross_persona_e2e.md): seller's bell | Notification "You received a new Krishi Mall order (upi)…" reaches the seller |
| 7 | Repeat step 3 with the SAME `idempotencyKey` (double-tap Place Order) | Exactly ONE order created — replay returns the same order, no duplicate |
| 8 | Open cart | Cart cleared after order |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-31: Place order — Cash on Delivery, in हिन्दी
- **Module:** 4 Cart & Checkout      **Priority:** P0
- **Roleplay:** You are Meena. You switch the app to हिन्दी and order papad with Cash on Delivery — your second language run of a core flow.
- **Preconditions:** Language हिन्दी (Settings); cart with Papad; address saved.
- **Test data:** Payment = Cash on Delivery.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Settings → **भाषा → हिन्दी** → open cart | Checkout labels in Hindi; no overflow/clipped text |
| 2 | Choose address + slot → payment method **कैश ऑन डिलीवरी (COD)** | COD selected; Pay button shows total |
| 3 | Tap **Place Order** | Order created with `paymentMethod=cod`, status `placed` ("Awaiting payment" on detail) |
| 4 | Success screen in Hindi | "Order Placed Successfully!" equivalent + Track / Continue buttons |
| 5 | Open bell | Order-placed notification present |
| 6 | Switch language back to English | Order detail renders correctly in English |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-32: Place order — Buy Now Pay Later (2 × 30 days)
- **Module:** 4 Cart & Checkout      **Priority:** P1
- **Roleplay:** You are Meena. Your cart is ₹1,600; you choose BNPL to pay half now, half in 30 days.
- **Preconditions:** BNPL-enabled product/cart (banner in TC-EMC-16).
- **Test data:** Cart ₹1,600.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Cart → payment methods | **Buy Now Pay Later** tile visible with "50% now, 50% after 30 days" copy |
| 2 | Select BNPL → Place Order | Order created; half of total charged now (Razorpay) |
| 3 | Open the order detail → **BNPL Installment Schedule** | Schedule shows installment 1/2 paid, installment 2/2 due in 30 days (2nd due day 60 not applicable — 2 installments at day 30/60) |
| 4 | (API) `GET /orders/{id}/bnpl-schedule` | `bnplSchedule` persisted with 2 equal installments, due dates +30/+60 days |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-33: Place-order validation — minOrderQty, stock, server coupon & address checks
- **Module:** 4 Cart & Checkout      **Priority:** P1
- **Roleplay:** You are Meena. You attack the order API with bad payloads to see if the server really validates.
- **Preconditions:** Postman/`/docs` access with Meena's token; one product with `minOrderQty` (ask Tester B to set, e.g. 5).
- **Test data:** qty below minOrderQty; fake coupon `FAKE123`; coins 99999; address id of another user.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | `POST /orders` with item qty `2` where minOrderQty = 5 | `422 MIN_ORDER_QTY` |
| 2 | `POST /orders` with qty `0` | `422` (qty ≥ 1 per item) |
| 3 | `POST /orders` with coupon `FAKE123` | `400 COUPON_INVALID` — server re-validates coupon |
| 4 | `POST /orders` with coinsToRedeem above balance | `422 COINS_INSUFFICIENT` |
| 5 | `POST /orders` with an `addressId` belonging to Tester B | `404 ADDRESS_NOT_FOUND` |
| 6 | `POST /orders` without `idempotencyKey` | Rejected — key is mandatory |
| 7 | 🔄 second tester (see 07_cross_persona_e2e.md): seller zeroes stock → `POST /orders` | `409 OUT_OF_STOCK` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-34: Produce cart — lots, ±0.5 q steppers, per-line logistics
- **Module:** 4 Cart & Checkout      **Priority:** P1
- **Roleplay:** You are Meena. Beside your retail cart there is a green produce-cart card for FarmGate lots.
- **Preconditions:** At least one lot added from produce browse (TC-EMC-43).
- **Test data:** Tomato lot 1 q; Onion lot 2 q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/mall/cart` → find green **produce cart** section | Each lot line shows crop, farmer, ₹/q, qty |
| 2 | Tap **+ / –** on Tomato | Qty changes in **0.5 q steps** |
| 3 | Open the per-line **logistics select** | Options: "I pick up / Farmer delivers / Platform transport" |
| 4 | Set Tomato = "Farmer delivers", Onion = "I pick up" | Selection saved per line (sent as `logisticsMode` at checkout) |
| 5 | Remove the Onion lot from produce cart | Line removed; produce cart count updates |
| 6 | Leave cart without checking out | Produce lots remain in cart (server state) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.5 Module 5 — Retail Orders, Tracking & Post-order Actions

Covers: order list/detail, timeline, seller contact, BNPL schedule, cancel (+refund+stock),
returns, invoice PDF, reorder, payment retry, full refund verification (both sides).

### TC-EMC-35: Orders list & detail — timeline, totals, seller contact, BNPL schedule
- **Module:** 5 Retail Orders      **Priority:** P0
- **Roleplay:** You are Meena. You open "My Orders" to check what you bought and what happens next.
- **Preconditions:** ≥1 order exists (TC-EMC-30 UPI order preferred).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Home → **My Orders** (`/customer/orders`) | Each order: number, date, payment method, status badge, item names × qty, total; **Track & manage** button |
| 2 | Open the UPI order | **Order Timeline** (`GET /orders/{id}/timeline`) shows events; items with prices |
| 3 | Inspect totals | Subtotal, coupon, coins, grand total, **Refund status** line (none yet), tree-adoption line (planted — from TC-EMC-30 checkbox) |
| 4 | Inspect delivery block | Address + slot shown; Payment block: "Paid online via Razorpay" |
| 5 | Check **Seller Contact** card | Seller name, phone `tel:` link, **Visit storefront** link |
| 6 | (BNPL order only) Open **BNPL Installment Schedule** | 2 installments with due dates |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-36: Order lifecycle — statuses & a notification per transition
- **Module:** 5 Retail Orders      **Priority:** P1
- **Roleplay:** You are Meena. Your UPI order moves placed → paid → confirmed → shipped → out_for_delivery → delivered → closed, and you must be told at every step.
- **Preconditions:** UPI order in `placed`/`paid`; [ADMIN] can `PATCH /orders/{id}/status` (or seller drives it 🔄).
- **Test data:** Order from TC-EMC-30.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Note the order status after payment | `paid` |
| 2 | 🔄 second tester (see 07_cross_persona_e2e.md): [ADMIN]/seller sets **confirmed** | — |
| 3 | Open your bell | Notification "Order confirmed"; order status badge = confirmed |
| 4 | 🔄: status → **shipped** | Bell: "Order packed & picked up…"; timeline appends shipped event |
| 5 | 🔄: status → **out_for_delivery** | Bell: "Delivering today — keep your phone reachable" |
| 6 | 🔄: status → **delivered** | Bell: "Order delivered"; rating prompt `marketplace_order` appears in ratings-pending |
| 7 | 🔄: status → **closed** | Badge `closed`; no further actions offered |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-37: Cancel a paid order — refund requested, stock restored; negative on shipped
- **Module:** 5 Retail Orders      **Priority:** P0
- **Roleplay:** You are Meena. You ordered tulsi twice by mistake and cancel one order immediately.
- **Preconditions:** Two orders in `placed`/`paid`; one order already `shipped` (or ask [ADMIN] to advance one 🔄).
- **Test data:** Cancel reason "Ordered by mistake".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open a `paid` order → **Cancel Order** | Dialog: optional reason + copy "Stock is released immediately. Paid amounts are refunded to the original method." |
| 2 | Enter reason → confirm | `POST /orders/{id}/cancel`: status `cancelled`, **refundStatus = requested**; stock restored (seller sees quantity back 🔄) |
| 3 | Open bell | Cancellation notification present |
| 4 | Try **Cancel Order** on the `shipped` order | No cancel button / `409 ORDER_NOT_CANCELLABLE` |
| 5 | (API) cancel the `cancelled` order again | `409` — illegal transition blocked |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-38: Request a return — validation & refund flag
- **Module:** 5 Retail Orders      **Priority:** P1
- **Roleplay:** You are Meena. The papad arrived broken; you request a return on the delivered COD… no — on the delivered UPI order.
- **Preconditions:** One order `delivered` (TC-EMC-36); one order `placed`.
- **Test data:** Reason "Damaged papad packet".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the `placed` order → look for **Request Return** | Absent — returns need delivered/paid |
| 2 | Open the `delivered` order → **Request Return** | Dialog asks reason |
| 3 | Submit with reason `ab` (2 chars) | Rejected: reason min 3 characters |
| 4 | Submit "Damaged papad packet" | `POST /orders/{id}/return`: `returnStatus=requested`, `refundStatus=requested` (order was paid) |
| 5 | Request return again on same order | `409 RETURN_ALREADY_REQUESTED` |
| 6 | Open bell | return_requested notification present |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-39: Download invoice PDF
- **Module:** 5 Retail Orders      **Priority:** P1
- **Roleplay:** You are Meena. You need the invoice for your office reimbursement.
- **Preconditions:** One order (any status).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Order detail → **Invoice PDF** (`GET /orders/{id}/invoice.pdf`) | PDF downloads; header "Agrovercity Krishi Mall - Order Invoice" |
| 2 | Check contents | Order number, items, totals, GST breakup, delivery address |
| 3 | (API) fetch the PDF with Tester B's (non-owner, non-seller) token | `403`/404 — only order owner or seller can download |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-40: Reorder — one-tap re-add of a delivered order
- **Module:** 5 Retail Orders      **Priority:** P1
- **Roleplay:** You are Meena. Your monthly ghee+tomato order is done; you reorder with one tap.
- **Preconditions:** One order `delivered` or `closed`; one order in another status.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the `delivered` order → **Reorder** | `POST /orders/{id}/reorder`; items re-added to cart; confirmation shown |
| 2 | Open cart | Same items/quantities present |
| 3 | Open the `placed` order → look for Reorder | Absent — reorder allowed only for delivered/closed |
| 4 | Reorder an order containing an out-of-stock item | Out-of-stock item skipped or flagged, not silently added |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-41: Payment retry on a failed/stuck UPI order
- **Module:** 5 Retail Orders      **Priority:** P1
- **Roleplay:** You are Meena. Your UPI intent failed at the bank; the order is still `placed` and unpaid. You retry from the order screen.
- **Preconditions:** One `placed` + `upi` + unpaid order (create a fresh COD→no; create UPI order and abandon the Razorpay popup 🔄).
- **Test data:** Same UPI VPA.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the unpaid UPI order → check payment block | "Awaiting payment" + retry affordance |
| 2 | (API) `GET /orders/{id}/payment-status` | `canRetry=true` |
| 3 | Tap **Pay now** / `POST /orders/{id}/pay` | Reuses the same `razorpayOrderId` (idempotent) — no duplicate Razorpay order |
| 4 | Complete payment in test UPI | Status → `paid`; signature verified |
| 5 | Try `POST /orders/{id}/pay` on a COD order | `409 PAYMENT_NOT_APPLICABLE` (only upi + placed) |
| 6 | Hammer `POST /payments/razorpay/order` >20 times/min | Rate limited ("payments" 20/60s) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-42: Full refund verification — money back on both sides
- **Module:** 5 Retail Orders      **Priority:** P0
- **Roleplay:** You are Meena. The seller cancelled your paid order; you verify the money actually returns.
- **Preconditions:** A `paid` order to cancel (use TC-EMC-37 or ask [ADMIN] 🔄 to trigger Razorpay refund via `POST /payments/razorpay/refund`).
- **Test data:** Order total ₹X paid by UPI.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Cancel the paid order (or have [ADMIN] refund) | `refundStatus=requested` |
| 2 | Trigger/await `POST /payments/razorpay/refund` | `refundStatus=processed`, `razorpayRefundId` present; audit row written for each mutation |
| 3 | Check the order detail | Refund status line shows processed |
| 4 | Open Wallet → **Transactions** | Refund row with +amount, status, receipt PDF available |
| 5 | Verify amount | Refund = paid amount to the original method — exactly equal, no shortfall |
| 6 | 🔄 second tester (see 07_cross_persona_e2e.md): seller's settlement | Seller side shows reversal; no commission earned on cancelled order |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.6 Module 6 — Produce Browse / FarmGate Discovery (C3)

Covers: lot catalog, filters (category incl. A2 Ghee alias, organic, search, 4 sorts), pagination,
nearby snapshot, add-to-produce-cart.

### TC-EMC-43: Browse FarmGate lots — filters & sorts
- **Module:** 6 Produce Browse      **Priority:** P1
- **Roleplay:** You are Meena. Your building's society wants 25 kg tomato; you browse FarmGate lots for the best farmer nearby.
- **Preconditions:** Farmer lots seeded (Tester B): Tomato A, Onion B, A2 Ghee lot.
- **Test data:** Crop search `tomato`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Produce** (`/customer/produce`) | Category chips: All / Vegetables / Fruits / Grains / Dairy / **A2 Ghee** |
| 2 | Tap **A2 Ghee** chip | Only ghee lots shown (category alias `a2ghee\|ghee` works) |
| 3 | Toggle **Organic only** | List filters to organic lots |
| 4 | Type `tomato` in crop search | Debounced results: tomato lots only |
| 5 | Change sort to **Price ↑** then **Distance** then **Freshness** then **Grade** | List re-orders per sort key |
| 6 | Inspect a lot card | Crop, grade, Organic badge, harvested date ("Harvested today"/"N d fresh"), distance km, ₹/quintal, farmer name + rating |
| 7 | Tap **Shop** on a farmer | Goes to `/mall/seller/{farmerId}` storefront |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-44: Pagination & nearby snapshot
- **Module:** 6 Produce Browse      **Priority:** P2
- **Roleplay:** You are Meena. You scroll past the first page and check the closest lots shortcut.
- **Preconditions:** Enough lots for 2+ pages (ask Tester B / [ADMIN] to seed, or accept single page).
- **Test data:** Location permission ON (Pune).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Scroll to bottom of produce list | **Load more** appends next page (no duplicates) |
| 2 | Check **"Nearby snapshot"** list | 5 closest lots with distance; **View** → farmer shop |
| 3 | (API) `GET /customer/browse/near-me` without lat/lng | Error: lat/lng required |
| 4 | (API) same with `lat=18.52&lng=73.86&radiusKm=50&sort=distance` | 200 with lots sorted by distance |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-45: Save this search from produce header
- **Module:** 6 Produce Browse      **Priority:** P1
- **Roleplay:** You are Meena. You save an organic-tomato search so alerts can find new lots for you.
- **Preconditions:** Produce browse open; search applied (organic + tomato).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Apply search `tomato` + **Organic only** | Filtered list |
| 2 | Tap **Save this search** in header | `POST /saved-searches` with crop=tomato, organic filter, `alertsEnabled` prompt |
| 3 | Confirm saving with alerts ON | Success toast; search appears in saved-searches list (verified fully in TC-EMC-97) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.7 Module 7 — Seller Storefront & Favorites (C3, C11)

Covers: storefront header, verified chips, follow, favorite, fresh listings, quote-this-lot,
reviews with seller reply, chat gate, consolidated GST invoice.

### TC-EMC-46: Seller storefront — header, chips, listings, reviews
- **Module:** 7 Storefront      **Priority:** P1
- **Roleplay:** You are Meena. You check a farmer's shop before trusting them with 25 kg of tomato.
- **Preconditions:** Farmer with KYC docs + lots + reviews (Tester B).
- **Test data:** Tester B's Farmer storefront.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open storefront `/mall/seller/{farmerId}` | Header: avatar, name, rating, "N products listed", location |
| 2 | Check **verified credential chips** | Chips derived from the farmer's KYC docs |
| 3 | Check buttons | **Follow/Following**, **Favorite/Favorited**, **Request Quote**, **Chat with seller** |
| 4 | Scroll to **Fresh listings** | Lot cards: grade, freshness, price/q, qty available, harvested date, **Add to produce cart**, **Quote this lot** |
| 5 | Scroll to **Ratings & Reviews** | Up to 8 latest reviews: stars, comment, reviewer, seller reply (if any) |
| 6 | Tap **Chat with seller** (no confirmed order yet) | Grey hint: "Chat unlocks post-confirmation" (G1) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-47: Follow + Favorite; favorites list & idempotent re-add
- **Module:** 7 Storefront      **Priority:** P1
- **Roleplay:** You are Meena. You follow your regular organic farmer and favorite them for repeat bulk buys.
- **Preconditions:** Storefront open.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Follow** | Button flips to **Following**; `follows` API updated |
| 2 | Tap **Favorite** | Flips to **Favorited**; `POST /customer/suppliers/favorites` row created |
| 3 | (API) `POST /customer/suppliers/favorites` same farmer again | Idempotent — still one row, no error |
| 4 | Open favorites list (`GET /customer/suppliers/favorites`) | Row: farmerId, farmerName, primaryCrops[], location, `trustBadge:"Verified Producer"` |
| 5 | `DELETE /customer/suppliers/favorites/{id}` | Removed from list |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-48: Request Quote dialog — binding quote rules; disabled state
- **Module:** 7 Storefront      **Priority:** P1
- **Roleplay:** You are Meena (household). You ask the farmer for a binding quote on 2 q tomato.
- **Preconditions:** Storefront with lots; also a storefront with NO lots (seller without listings).
- **Test data:** Tomato lot, qty 2 q, price prefilled ₹1,800/q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Quote this lot** on a fresh listing | **Request Quote** dialog: lot dropdown, Quantity (q, step 0.5), Price (₹/q, prefilled from lot), notes |
| 2 | Read the copy | States: "farmer gets 24h to respond; price locks 30 minutes per counter round (max 3 rounds). Accepting creates an escrow-protected order." |
| 3 | Change qty to 2.5 q → add note "Deliver after 6 pm" → **Submit** | `POST /customer/quotes` succeeds (household — no KYC gate); quote appears in `/customer/quotes` |
| 4 | Open a storefront with no lots → check **Request Quote** | Disabled with hint "Quote requests unlock once the seller lists a lot" |
| 5 | (API) `POST /customer/quotes` with `offeredPricePerQuintal=0` and `quantityQuintals=0` | Rejected — both must be > 0 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.8 Module 8 — Quotes & Price Negotiation (C4, C5)

Covers: quote console, statuses, fair band (90-day min/max + sampleSize), 24 h validity,
3-round counter cap with band nudge, 30-min price lock, accept → FarmGate order, logistics modes,
withdraw/reject/expired.

### TC-EMC-49: Create a quote from the console (fields & validation)
- **Module:** 8 Quotes      **Priority:** P0
- **Roleplay:** You are Meena (household). You create a quote directly from the quotes console for 3 q onion.
- **Preconditions:** Logged in; farmer lots exist.
- **Test data:** Onion Grade B, 3 q, ₹1,350/q, deliveryMode default "pickup".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Quotes** (`/customer/quotes`) → **New Quote** | Form: demandId?, lotId?, farmerId?, crop*, offeredPricePerQuintal*, quantityQuintals*, deliveryMode, notes |
| 2 | Submit empty form | Required-field errors (crop, price > 0, qty > 0) |
| 3 | Fill crop=Onion, price ₹1,350/q, qty 3 q, deliveryMode "farmer_delivery", note "Baner delivery" → **Submit** | Quote created; status **pending** ("Sent · awaiting farmer"); `POST /customer/quotes` 200/201 |
| 4 | (API) repeat the same request with the same `Idempotency-Key` | Same quote returned — no duplicate |
| 5 | Open bell / farmer side 🔄 | Farmer sees the quote in their inbox (spec F5) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-50: Quote console — statuses, fair band chip, rounds left, validity
- **Module:** 8 Quotes      **Priority:** P1
- **Roleplay:** You are Meena. You read your quote cards like a trader: fair band, rounds left, expiry.
- **Preconditions:** At least one quote per status (create more if needed; expired via [ADMIN] backdate or wait — use API to inspect).
- **Test data:** Quote from TC-EMC-48/49.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/customer/quotes` | Cards for each quote with status chip |
| 2 | Inspect a pending quote | Chips: **Fair band (90d)** low–high ₹/q with sample size, **"N/3 counter rounds left"**, **valid until** (24 h), delivery mode icon |
| 3 | (API) `GET /customer/quotes` | Each quote annotated with `fairPriceBand` = 90-day min/max unit paisa + `sampleSize` |
| 4 | (API) open someone else's quote id | `403` — only own quotes |
| 5 | Wait/ask [ADMIN] to backdate a quote past 24 h → open it | Status **expired**; `410 QUOTE_EXPIRED` on counter |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-51: Counter round — farmer counters, you counter back
- **Module:** 8 Quotes      **Priority:** P1
- **Roleplay:** You are Meena. The farmer counters at ₹1,900/q; you counter at ₹1,750/q with a reason.
- **Preconditions:** Pending quote (TC-EMC-48) live; Tester B at their farmer console 🔄.
- **Test data:** Your counter ₹1,750/q; reason "Bulk 2.5 q, repeat buyer".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 second tester (see 07_cross_persona_e2e.md): farmer counters at ₹1,900/q | — |
| 2 | Open your quote | Status **countered**; rounds chip changed |
| 3 | Tap **Counter** → enter ₹1,750/q + reason → submit | `POST /customer/quotes/{id}/counter`; status countered → back to farmer; rounds "1/3 used" |
| 4 | Open bell | "Quote countered — round N/3" notification |
| 5 | 🔄: farmer accepts your counter | Status **accepted**; notification arrives |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-52: Counter cap — 4th counter rejected (422 COUNTER_ROUND_CAP + band nudge)
- **Module:** 8 Quotes      **Priority:** P1
- **Roleplay:** You are Meena. You push for a 4th counter; the platform must stop you and nudge the fair band.
- **Preconditions:** A quote with 3 counter rounds already used (drive via 🔄 farmer alternation).
- **Test data:** 4th counter attempt ₹1,700/q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the quote | Chip shows "0/3 counter rounds left" (3 used) |
| 2 | Tap **Counter** → submit any price | Rejected: `422 COUNTER_ROUND_CAP` with fair-band nudge message |
| 3 | (API) `POST /customer/quotes/{id}/counter` directly | Same 422 — server enforces the cap |
| 4 | On an **expired** quote, tap Counter | `410 QUOTE_EXPIRED` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-53: Accept a quote — creates escrow-protected FarmGate order
- **Module:** 8 Quotes      **Priority:** P0
- **Roleplay:** You are Meena. The price is right; you accept and pick "Farmer delivers".
- **Preconditions:** Quote in `accepted` status (TC-EMC-51) or counter in your favour.
- **Test data:** logisticsMode `farmer_delivery`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the accepted quote → **Accept → create order** | Optional `logisticsMode` picker: farmer_delivery / customer_pickup / platform_transport |
| 2 | Choose **Farmer delivers** → confirm | `POST /customer/quotes/{id}/accept` → FarmGate order created |
| 3 | Check value vs ₹10,000 threshold | Order < ₹10,000 → status `confirmed` directly; ≥ ₹10,000 → status `deposit_pending` with 20% escrow (TC-EMC-60) |
| 4 | Check navigation | Redirected to `/customer/procurements` with the new order visible |
| 5 | (API) re-accept with same Idempotency-Key | Same order returned — idempotent |
| 6 | 🔄 second tester (see 07_cross_persona_e2e.md): farmer side | Farmer sees FarmGate order + notification |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-54: Price lock — 30-minute lock per counter round
- **Module:** 8 Quotes      **Priority:** P1
- **Roleplay:** You are Meena. You verify the agreed price is actually locked for 30 minutes per round (config `emarketPriceLockMinutes`).
- **Preconditions:** A countered quote; [ADMIN] can read the lock timestamp.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 second tester: farmer sends a counter | — |
| 2 | Note the time; inspect quote via API for lock fields | Price lock timestamp = now + 30 min (`emarketPriceLockMinutes` default 30) |
| 3 | Accept within the lock window | Accepted at the locked price — farmer cannot silently change it |
| 4 | Ask [ADMIN] to confirm the lock config is effective-dated | `emarketPriceLockMinutes=30` in settlements `_config` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-55: Fair price band — 90-day range & sample size shown and nudging
- **Module:** 8 Quotes      **Priority:** P1
- **Roleplay:** You are Meena. You check whether ₹1,750/q is within the fair band before accepting.
- **Preconditions:** Quotes with mandi history for the crop.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open a tomato quote | Fair band chip shows 90-day min–max ₹/q |
| 2 | (API) `GET /customer/quotes` | `fairPriceBand.minPaisa/maxPaisa` + `sampleSize` present |
| 3 | Submit a counter far outside the band | UI warning + band nudge in the error path (from TC-EMC-52 the nudge text is verified) |
| 4 | Accept a price inside the band | Accept allowed without warnings |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-56: Quote terminal states — withdraw, farmer reject, expiry notification
- **Module:** 8 Quotes      **Priority:** P1
- **Roleplay:** You are Meena. You clean up stale quotes and watch each ending.
- **Preconditions:** Three quotes: one you withdraw, one farmer rejects 🔄, one left to expire ([ADMIN] backdate).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open your own pending quote → **Withdraw** | Status **withdrawn**; farmer notified 🔄 |
| 2 | 🔄 second tester: farmer rejects another quote | — |
| 3 | Check that quote | Status **rejected**; your bell shows rejection notification |
| 4 | Open the backdated quote (past 24 h) | Status **expired**; expired notification on access |
| 5 | Try Accept on withdrawn/rejected/expired | Action unavailable / error |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.9 Module 9 — FarmGate Procurements, Inspection & Disputes (C6, C8, C9, C10)

Covers: procurement list/detail + escrow labels, multi-farmer checkout, deposit rule, inspection
(≤5% / 6–20% / >20% + grade mismatch), 72 h window, QR custody handover, cancel penalties,
no-show, auto-release T+72h, consolidated GST invoice.

### TC-EMC-57: Procurements list & detail — statuses, escrow labels, timeline
- **Module:** 9 Procurements      **Priority:** P0
- **Roleplay:** You are Meena. You check your bulk orders and exactly where the deposit money sits.
- **Preconditions:** ≥1 FarmGate order (TC-EMC-53).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Procurements** (`/customer/procurements`) | Each row: crop · grade, farmer, q × ₹/q, status badge, total + escrow label |
| 2 | Read the escrow label on a fresh order | "Deposit held in escrow" (or "No deposit held" for small orders) |
| 3 | Open the order detail | Status lifecycle shown: created → confirmed/deposit_pending → in_fulfillment/dispatched → delivered/inspection_passed → settled; branches disputed/cancelled/custody_transferred |
| 4 | Check timeline | `statusTimeline` array lists every transition with timestamps |
| 5 | 🔄 second tester (see 07_cross_persona_e2e.md): farmer dispatches | Status → dispatched; your bell notifies |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-58: Multi-farmer produce-cart checkout — parent + children
- **Module:** 9 Procurements      **Priority:** P0
- **Roleplay:** You are Meena. You buy tomato from Farmer-1 and ghee from Farmer-2 in one checkout; the platform consolidates them.
- **Preconditions:** Produce cart has ≥2 lines from **different** farmers (TC-EMC-34).
- **Test data:** Farmer-1 Tomato 2 q; Farmer-2 A2 Ghee 0.5 q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Produce cart → **Checkout Produce** | Summary of lines with per-line logistics |
| 2 | Confirm checkout | `POST /customer/cart/checkout` → **one parent order** (`isParent:true`, status confirmed) + **one child order per farmer** |
| 3 | Read success screen | "Procurement Placed! N farmer orders under consolidation #…" |
| 4 | Open Procurements | Parent note shown ("consolidated"); children listed under it, each with own deposit logic |
| 5 | 🔄 second tester: both farmers | Each farmer sees exactly their own child order only — no leak of the other farmer's order |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-59: Produce checkout validation — bad lots & hoarding cap
- **Module:** 9 Procurements      **Priority:** P1
- **Roleplay:** You are Meena (API-level). You send malformed checkout lines; server must reject each.
- **Preconditions:** API token; [ADMIN] can set `emarketMaxQtyPerCrop` cap.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | `POST /customer/cart/checkout` with `lines:[]` | Rejected — min 1 line |
| 2 | Line with a closed/sold lot | `422 LOT_NOT_AVAILABLE` |
| 3 | Line where lotId belongs to farmer X but body says farmer Y | `422 LOT_FARMER_MISMATCH` |
| 4 | Line qty > available | `422 INSUFFICIENT_QUANTITY` |
| 5 | [ADMIN] sets cap tomato=2 q; checkout 3 q tomato | `422 HOARDING_CAP` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-60: High-value deposit rule — ≥₹10,000 order holds 20% escrow
- **Module:** 9 Procurements      **Priority:** P1
- **Roleplay:** You are Meena. You place a ₹12,000 ghee order and confirm 20% is held in escrow with an audit trail.
- **Preconditions:** [ADMIN] confirms `emarketHighValueThresholdPaisa=1000000` (₹10,000), `emarketDepositPct=20`.
- **Test data:** Order value ₹12,000.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Create/accept a quote or checkout a lot worth ₹12,000 | Order status `deposit_pending`; UI shows "Escrow deposit (20%)" |
| 2 | Verify deposit amount | 20% × ₹12,000 = **₹2,400** held |
| 3 | [ADMIN] check audit logs | `EMARKET_DEPOSIT_HELD` audit row with paisa amount |
| 4 | Confirm money both sides | Your payable reduced by deposit; farmer sees "escrow held" label 🔄 |
| 5 | Place a second order < ₹10,000 | No deposit — "No deposit held" label |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-61: Delivery inspection — ≤5% damage → full escrow release (C8)
- **Module:** 9 Inspection      **Priority:** P0
- **Roleplay:** You are Meena. The tomato crate arrived with 3 bruised kg out of 100 kg (3%). You inspect and expect full release.
- **Preconditions:** Order `delivered`, not yet inspected, within 72 h of deliveredAt.
- **Test data:** damagePct 3; gradeMatch ✓; photo URL(s); note "3 kg bruised on top layer".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open delivered order → **Delivery Inspection** | Form: damage % slider 0–100, "Grade matches the agreed specification" checkbox, photo URLs (comma-separated), notes |
| 2 | Set damage 3% → tick grade match → add 1 photo URL + note → **Submit** | `POST /customer/orders/{id}/inspection` accepted; evidence written to WORM storage (`wormEvidencePath`) |
| 3 | Read the result copy | "≤5% → full release" applied: status → inspection_passed |
| 4 | Check escrow label | "Escrow released to farmer"; `ESCROW_RELEASED` audit row |
| 5 | 🔄 second tester: farmer side | Farmer payout released in full minus commission (`emarketProducePct` 5%) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-62: Inspection — 6–20% damage → pro-rata deduction
- **Module:** 9 Inspection      **Priority:** P1
- **Roleplay:** You are Meena. 12% of the onion is rotten; you accept pro-rata deduction.
- **Preconditions:** Another delivered order (or same flow again with Tester B 🔄 delivering).
- **Test data:** damagePct 12; gradeMatch ✓.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Submit inspection with damage 12% | Accepted; status inspection_passed |
| 2 | Verify deduction | Deduction = 12% of order value (pro-rata); remainder released |
| 3 | Check farmer side 🔄 | Farmer payout reduced by 12% + commission; audit rows: `ESCROW_RELEASED` (partial) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-63: Inspection — >20% damage / grade mismatch → dispute + escrow frozen (C10)
- **Module:** 9 Disputes      **Priority:** P1
- **Roleplay:** You are Meena. Half the crate is spoiled (40%) — this must open a dispute and freeze the money.
- **Preconditions:** Delivered order; [ADMIN] dispute console available.
- **Test data:** damagePct 40; gradeMatch ✗; photos + note.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Submit inspection with damage 40% (or gradeMatch unticked at any damage) | Status → **disputed**; **escrow frozen** — label "Escrow frozen (dispute)" |
| 2 | Check audit | `ESCROW_*`/dispute events written; WORM evidence path stored |
| 3 | Try to release/cancel the order yourself | Blocked while dispute is open |
| 4 | [ADMIN] resolve dispute (e.g., refund) | Escrow unfrozen per resolution — refunded or partially released; `ESCROW_REFUNDED` audit row |
| 5 | Verify your credit | Refund lands as configured; wallet shows row |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-64: Inspection negatives — 72 h window & double inspection
- **Module:** 9 Inspection      **Priority:** P2
- **Roleplay:** You are Meena. You come back 4 days late and try to inspect again.
- **Preconditions:** One order inspected already; one order with deliveredAt > 72 h ([ADMIN] backdates 🔄).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open an already-inspected order | **Delivery Inspection** no longer offered |
| 2 | (API) `POST /customer/orders/{id}/inspection` again | Rejected — already inspected |
| 3 | Open the backdated order (>72 h) → try inspection | `422 INSPECTION_WINDOW_EXPIRED` |
| 4 | Submit damagePct 150 via API | Rejected — slider/API bounds 0–100 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-65: QR custody handover — scan QR, mark complete, escrow released
- **Module:** 9 Procurements      **Priority:** P1
- **Roleplay:** You are Meena. You pick up the lot yourself; the farmer scans your handover QR and custody transfers.
- **Preconditions:** Order in in_fulfillment/dispatched (not yet delivered).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Order detail → **Show handover QR** | QR displayed; JSON payload `{type:'farmgate_handover', orderId, at}` |
| 2 | 🔄 second tester (see 07_cross_persona_e2e.md): farmer scans the QR | — |
| 3 | Tap **Mark handover complete** | `POST /customer/orders/{id}/qr-handover`: sets `qrVerifiedAt`, status → **custody_transferred** |
| 4 | Check escrow | Escrow released on handover; `ESCROW_RELEASED` audit |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-66: Cancel FarmGate order — free within 4 h
- **Module:** 9 Procurements      **Priority:** P0
- **Roleplay:** You are Meena. Plans change; you cancel 2 h after confirming and expect no penalty.
- **Preconditions:** Order in created/confirmed (not yet dispatched), placed < 4 h ago.
- **Test data:** Order ₹6,000.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Order detail → **Cancel order** | Dialog discloses E2 fee table: free ≤4 h; 5% later; 10% within 2 h of pickup |
| 2 | Confirm within 4 h | Cancelled; **no penalty**; remainder refunded to source |
| 3 | Check refund | Refund row in wallet; `ESCROW_REFUNDED` audit if deposit existed |
| 4 | 🔄 second tester: farmer | Lot re-opened for sale |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-67: Cancel FarmGate order — 5% penalty after 4 h; 10% near pickup
- **Module:** 9 Procurements      **Priority:** P1
- **Roleplay:** You are Meena. You cancel 6 h after confirming, and (separately) 1 h before the agreed pickup.
- **Preconditions:** Two orders: one 6 h old; one with pickupAt within 2 h ([ADMIN]/farmer sets pickupAt 🔄).
- **Test data:** Order value ₹8,000 (5% = ₹400); ₹8,000 (10% = ₹800).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Cancel the 6-h-old order | 5% = ₹400 `farmerCompensationPaisa` deducted; ₹7,600 refunded |
| 2 | Verify farmer side 🔄 | ₹400 compensation credited to farmer |
| 3 | Cancel the pickup-soon order | 10% = ₹800 deducted; ₹7,200 refunded |
| 4 | Check audit | `PENALTY` audit row(s) with paisa values |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-68: Report farmer no-show — strike + 10% credit + escrow refund
- **Module:** 9 Procurements      **Priority:** P1
- **Roleplay:** You are Meena. The farmer never showed up at the mandi; you report it and get compensated.
- **Preconditions:** Order in a non-delivered/non-settled/non-cancelled status (e.g., confirmed) whose farmer will not fulfil 🔄.
- **Test data:** Order value ₹5,000 (10% = ₹500).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Order detail → **Report farmer no-show** | Confirm dialog |
| 2 | Confirm | `POST /customer/orders/{id}/no-show`: order **cancelled**, escrow **refunded**, `customerCreditPaisa` = 10% = ₹500 credited |
| 3 | Check wallet | ₹500 credit row visible |
| 4 | 🔄 second tester (see 07_cross_persona_e2e.md): farmer | Farmer strike +1 via `record_strike` (3 strikes risk suspension); notification received |
| 5 | (API) call no-show on an order you don't own | Rejected — only ordering customer (or admin) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-69: Nightly auto-release — T+72 h escrow release without inspection
- **Module:** 9 Procurements      **Priority:** P2
- **Roleplay:** You are Meena. You forgot to inspect; the nightly job must still release the farmer after 72 h.
- **Preconditions:** A delivered/inspection-less order; [ADMIN] can backdate `deliveredAt` (staging only) — else observe next day.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | [ADMIN] backdate deliveredAt to >72 h ago (or wait) | — |
| 2 | Run/wait for `release_due_customer_escrows` nightly job | Escrow auto-releases; order shows escrow released |
| 3 | Verify audit | `ESCROW_RELEASED` row at T+72 h |
| 4 | Repeat with an order having an open dispute | Escrow stays frozen — auto-release skips disputed orders |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-70: Consolidated GST invoice — business plan gated, monthly JSON
- **Module:** 9 Procurements      **Priority:** P1
- **Roleplay:** You are Meena's business account. You download one consolidated GST invoice for the month.
- **Preconditions:** Business account on a plan with `consolidated_gst_invoice` entitlement; some orders this month.
- **Test data:** Period `2026-10`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open a storefront → **Consolidated GST invoice** bar | Month input + **Download (JSON)** |
| 2 | Enter `2026-10` → Download | `GET /customer/invoices/consolidated?period=2026-10` returns JSON: id `cinv_{uid8}_{period}`, totalPaisa + GST at `GST_RATE` |
| 3 | Try the same on the household account (no entitlement) | Entitlement error — plan-gated |
| 4 | [ADMIN] check audit | `CONSOLIDATED_INVOICE` audit row |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.10 Module 10 — Demands / Purchase Requests (C2)

Covers: create demand (all fields, unit conversions), budget validation, list with offers count,
withdraw.

### TC-EMC-71: Create a demand — full form
- **Module:** 10 Demands      **Priority:** P1
- **Roleplay:** You are Meena. Your society needs 10 q organic tomato weekly; you post a demand and wait for farmers' offers.
- **Preconditions:** Logged in.
- **Test data:** Crop Tomato; Variety "Organic Desi"; 10 Quintal; Grade A; budget ₹1,200–₹1,800/q; Recurring Weekly; needed-by 2026-10-29; delivery "Baner, Pune"; note "Society bulk order, every week".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Demands** (`/customer/demands`) → **New Demand** | Form opens with all fields |
| 2 | Fill Crop=Tomato, Variety (default "Standard" → change to "Organic Desi") | Variety accepts text |
| 3 | Set Quantity `10` with unit **Quintal** | Stored as 10 q; switch unit to Kg (shows ×0.01) and Tonne (×10) to verify conversions |
| 4 | Set Grade A; Budget min ₹1,200, max ₹1,800 | Accepted (max ≥ min) |
| 5 | Set Recurring **Weekly**, Needed-by `2026-10-29`, Delivery location "Baner, Pune", Notes ≤500 chars | All saved |
| 6 | **Submit** | `POST /customer/demands`; demand status **open**, bidsCount 0; appears in list |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-72: Demand validation negatives
- **Module:** 10 Demands      **Priority:** P1
- **Roleplay:** You are Meena. You make the classic mistakes: budget upside-down and an over-long note.
- **Preconditions:** Demand form open.
- **Test data:** min ₹2,000 / max ₹1,500; 600-char note.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Set Budget min ₹2,000, max ₹1,500 → try submit | Client rejects: max must be ≥ min |
| 2 | Paste a 600-character note → submit | Rejected: notes ≤ 500 characters |
| 3 | Clear Crop and Quantity → submit | Required-field errors; `POST` never fires |
| 4 | (API) `POST /customer/demands` with quantity 0 | Rejected |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-73: Demands list — offers count & withdraw
- **Module:** 10 Demands      **Priority:** P1
- **Roleplay:** You are Meena. Farmers start bidding; you watch the count and later withdraw the demand.
- **Preconditions:** Demand open; Tester B's farmer (or another user) sends an offer against it 🔄 (see TC-EMC-74).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Demands list | Card shows crop · variety, q, grade, district, frequency, budget min–max, delivery window, posted date, notes |
| 2 | 🔄 second tester: farmer posts an offer against your demand | — |
| 3 | Reload the list | "**1 offers received**" on the card |
| 4 | Tap **Withdraw** on the demand | `DELETE /customer/demands/{id}`; demand removed; open offers on it stop 🔄 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.11 Module 11 — Offers & Two-way Negotiation (C5)

Covers: create offer on lot/demand, offer fields + validation, negotiation room chat, 3-round
counter cap + 24 h restart, partial accept, auto-reject siblings, reject/withdraw/expiry,
offers-mine filters & verified badge.

### TC-EMC-74: Create an offer on a farmer's lot
- **Module:** 11 Offers      **Priority:** P1
- **Roleplay:** You are Meena. Instead of a formal quote, you drop a quick binding offer on a farmer's onion lot.
- **Preconditions:** Open lot exists (Tester B 🔄).
- **Test data:** price ₹1,300/q; qty 4 q; message "Pickup Saturday"; pickupDate 2026-10-25; paymentTermsDays 0; transportMode "self".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open lot → **Make Offer** (`POST /offers`, targetType=lot) | Form: pricePerUnit, quantity, message, pickupDate, paymentTermsDays, transportMode |
| 2 | Fill all fields → **Send** | Offer created; a negotiation chat room opens (`ensure_offer_room`); status **pending** |
| 3 | Open bell | — |
| 4 | 🔄 second tester (see 07_cross_persona_e2e.md): farmer's bell | Notification "New offer / नया ऑफर" with your offer summary |
| 5 | (API) `POST /offers` again on the same target | Dedupe: live-offer replay (200 with the existing offer) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-75: Offer validation negatives
- **Module:** 11 Offers      **Priority:** P1
- **Roleplay:** You are Meena (API-level). You probe the offer rules.
- **Preconditions:** API token; Tester B cooperation 🔄.
- **Test data:** past pickupDate `2026-01-01`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Offer with pickupDate `2026-01-01` (past) | Rejected — pickupDate must be YYYY-MM-DD and not past |
| 2 | Offer on your OWN demand/lot | `403 OWN_DEMAND` / `403 OWN_LOT` |
| 3 | 🔄 second tester: farmer closes the lot → offer again | `409` — target closed |
| 4 | Offer on a non-existent target | 404 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-76: Counter rounds — alternating, 3-round cap, 24 h restart
- **Module:** 11 Offers      **Priority:** P1
- **Roleplay:** You are Meena. You and the farmer haggle: counter, counter, counter — then the platform must stop round 4.
- **Preconditions:** Pending offer (TC-EMC-74); Tester B live 🔄.
- **Test data:** Counters: farmer ₹1,380 → you ₹1,350 → farmer ₹1,360.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 second tester: farmer counters ₹1,380 | — |
| 2 | Open offer → **Counter** ₹1,350 + note | Status **countered**; bell: "offer_countered — round 1/3"; 24 h expiry restarts |
| 3 | 🔄: farmer counters ₹1,360 | Round 2/3 notification |
| 4 | You counter once more | Round 3/3 — notification |
| 5 | 🔄: farmer tries a 4th counter | Rejected: `400 NEGOTIATION_CLOSED` — max 3 rounds |
| 6 | Check expiry semantics | Each counter restarted the 24 h expiry (field on offer) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-77: Accept an offer — partial quantity; full accept closes lot
- **Module:** 11 Offers      **Priority:** P0
- **Roleplay:** You are Meena. You accept 2 q of the 4 q offered; a purchase is created and both sides are notified.
- **Preconditions:** Offer pending/countered in your favour (as target owner or counter party per rules).
- **Test data:** Partial accept qty 2 q (of 4 q offered).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the offer → **Accept** with partial quantity `2` | `POST /offers/{id}/accept` — partial ≤ offered and ≤ remaining: OK |
| 2 | Check the outcome | **Purchase created** (`create_purchase_from_offer`) |
| 3 | Open bell | `booking_confirmed` + "Request accepted — chat is now open" |
| 4 | 🔄 second tester: farmer | Same notifications on farmer side; chat room unlocked for both |
| 5 | (Full-accept scenario, second offer) 🔄: farmer full-accepts a lot offer | Lot **closed**; sibling offers **auto-rejected** with "lot fulfilled" note |
| 6 | (API) accept with partial > offered | Rejected — partial ≤ offered |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-78: Reject, withdraw & expiry of offers
- **Module:** 11 Offers      **Priority:** P1
- **Roleplay:** You are Meena. You clean up the negotiation table.
- **Preconditions:** Three offers: one you withdraw; one farmer rejects 🔄; one left to expire ([ADMIN] backdate or wait).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open your pending offer → **Withdraw** | Status **withdrawn**; farmer notified (`offer_withdrawn`) |
| 2 | 🔄 second tester: farmer rejects your offer | — |
| 3 | Check it | Status **rejected**; bell: `offer_rejected` |
| 4 | Open the backdated offer (past 24 h, no counter) | Status **expired** on access; `offer_expired` notification |
| 5 | Open **Offers → Mine** with filter **sent** and **received** | Correct lists; `fromVerified` badge shows on verified Vyapari offers |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.12 Module 12 — Chat Compliance (C7)

⚠️ **Execute these cases carefully and deliberately.** You are *attempting* policy violations to
prove the guardrails work. Never use real personal numbers/IDs — use obviously fake test values.

Covers: pre-confirmation lock (G1), banned-phrase scanning (phone, UPI, payment-bait), URL
blocking, no VoIP / number reveal anywhere (G2), compliant messaging works.

### TC-EMC-79: Chat locked before any confirmed order (G1)
- **Module:** 12 Chat Compliance      **Priority:** P1
- **Roleplay:** You are Meena. You try to open a chat with a seller you've never transacted with.
- **Preconditions:** No confirmed order/purchase/accepted offer with the target seller.
- **Test data:** Any storefront.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Storefront → **Chat with seller** | Button grey with hint "Chat unlocks post-confirmation"; nothing opens |
| 2 | Product detail → **Ask seller** | Disabled + "Chat unlocks after order confirmation" |
| 3 | (API) `POST chat.openDirect` with that seller's lotId (no confirmed order) | Rejected server-side — threads only exist for confirmed anchors |
| 4 | Verify: after an offer is created (TC-EMC-74) the negotiation room opens | Offer room IS available (offer creation is a valid anchor) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-80: Banned content — phone number attempt is blocked
- **Module:** 12 Chat Compliance      **Priority:** P0
- **Roleplay:** You are Meena. In an unlocked chat you try to share a phone number ("call me on 98…").
- **Preconditions:** Unlocked chat room (from confirmed order TC-EMC-36 or accepted offer TC-EMC-77).
- **Test data:** Message: "Call me on 9812345678 to discuss".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the unlocked chat → type "Call me on 9812345678 to discuss" → Send | **Blocked**: message rejected with a compliance warning (number-scanning) |
| 2 | Try variants: "+91 98123 45678", "98-1234-5678", "nine eight one two…" | All blocked or warned — the scanner catches number patterns |
| 3 | Send a clean message "Please confirm delivery for Saturday morning" | Delivers normally |
| 4 | Check the other side 🔄 | No blocked message ever visible to the farmer |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-81: Banned content — UPI ID / "pay me directly" bait is blocked
- **Module:** 12 Chat Compliance      **Priority:** P0
- **Roleplay:** You are Meena. You try to take the deal off-platform with a UPI handle.
- **Preconditions:** Unlocked chat room.
- **Test data:** Messages: "pay me directly at meena@upibank", "let's deal off platform, no commission".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Send "pay me directly at meena@upibank" | **Blocked** — UPI/VPA pattern caught |
| 2 | Send "let's do this off platform to avoid commission" | **Blocked** — banned-phrase match (off-platform bait) |
| 3 | Send "my upi is meena dot deshmukh at okhdfc" (obfuscated) | Blocked or flagged — record scanner verdict |
| 4 | Send "What is the total including delivery?" | Delivers fine |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-82: Banned content — external URL / link is blocked
- **Module:** 12 Chat Compliance      **Priority:** P0
- **Roleplay:** You are Meena. You paste a link to an external catalogue.
- **Preconditions:** Unlocked chat room.
- **Test data:** "See photos here https://example.com/photos and http://bit.ly/x".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Send the message with https://example.com/photos | **Blocked** — URL scanning |
| 2 | Send "visit example dot com" (spelled out) | Blocked or flagged — record verdict |
| 3 | Send "I will check the photos on the product page" (no URL) | Delivers fine |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-83: No VoIP / number reveal anywhere in this persona (G2)
- **Module:** 12 Chat Compliance      **Priority:** P1
- **Roleplay:** You are Meena. You audit every screen of your flows for exposed phone numbers or call buttons that would bypass moderation.
- **Preconditions:** Unlocked chat open; order detail open; seller contact card seen.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Inspect the chat screen (header, composer, menus) | **No call/VoIP button**; counterparty phone number not displayed in chat |
| 2 | Check the Seller Contact card on a retail order | Seller phone is a `tel:` link on the ORDER (allowed post-order) — but chat itself reveals no number |
| 3 | Grep-app-check: any "Call" icon in chat or offer room | None — if a call icon exists in chat, file a defect (G2 violation) |
| 4 | Confirm SMS policy note | Only OTP/booking alerts go via SMS — never message content or numbers |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.13 Module 13 — Subscriptions (Veggie Boxes)

Covers: create box, farmer/grade/weight/frequency/price band/day/slot/items, quick-picks,
pause/resume, skip-next, modify, cancel terminal, illegal transitions, kill-switch.

### TC-EMC-84: Create a subscription box
- **Module:** 13 Subscriptions      **Priority:** P1
- **Roleplay:** You are Meena. You subscribe to a weekly veggie box from your regular farmer.
- **Preconditions:** Farmer ID known; `veggie_box` feature enabled.
- **Test data:** Farmer (Tester B); Box name "Desi Veggie Box"; Grade A; 5 kg; frequency **weekly**; target ₹40–60/kg; delivery day **Saturday**; slot **7–10 AM**; items: Tomato 1 kg, Spinach 500 g, Onion 1 kg.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Subscriptions** (`/customer/subscriptions`) → **New Subscription** | Create form: Farmer ID*, Box name*, Grade A/B/C, weight kg, delivery window note, frequency, target price min/max, delivery day, slot, box items |
| 2 | Fill farmer, name, Grade A, 5 kg | All accepted |
| 3 | Set frequency **weekly**, price band ₹40–60/kg, day Saturday, slot 7–10 AM | Stored (₹/kg → paisa band) |
| 4 | Add box items (name, qty, unit kg/g/L/dozen/bunch) | Items listed; quick-pick chips from `/customer/seasonal` work |
| 5 | **Submit** | `POST /customer/subscriptions`; status **active**, `nextRunAt` computed; appears in list and Home "Subscription Box" strip |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-85: Subscription creation negatives
- **Module:** 13 Subscriptions      **Priority:** P1
- **Roleplay:** You are Meena. You submit an impossible box.
- **Preconditions:** Create form open.
- **Test data:** qtyKg 0; frequency "monthly" (invalid).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Submit with no Farmer ID | Required error (farmerIds ≥ 1) |
| 2 | Set Total weight `0` or negative | Rejected (qtyKg > 0) |
| 3 | (API) frequency `monthly` | Rejected — allowed: daily/weekly/fortnightly/seasonal only |
| 4 | (API) `POST /customer/subscriptions` empty body | 422 validation errors |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-86: Pause, resume, skip-next & modify (active only)
- **Module:** 13 Subscriptions      **Priority:** P1
- **Roleplay:** You are Meena. You pause the box while travelling, then resume, skip a week, and add an item.
- **Preconditions:** Active subscription (TC-EMC-84).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Row → **Pause** | Status **paused** (active↔paused allowed) |
| 2 | Row → **Resume** | Back to **active** |
| 3 | Row → **Skip next delivery** | Date appended to `skipDates`; `nextRunAt` recomputed to the following occurrence |
| 4 | Row → **Modify** → change weight to 6 kg, add box item "Coriander 100 g", change slot to 10–1 PM | `PUT` accepted while active; changes visible |
| 5 | Verify Home strip | "Subscription Box" shows updated frequency/nextRunAt |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-87: Cancel subscription — terminal state & illegal transitions
- **Module:** 13 Subscriptions      **Priority:** P1
- **Roleplay:** You are Meena. You cancel the box at season's end and confirm nothing can revive it.
- **Preconditions:** Active or paused subscription.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Row → **Cancel** → confirm | `DELETE`; status **cancelled** (terminal) |
| 2 | Try **Pause/Resume** on the cancelled row | `409 SUBSCRIPTION_INVALID_TRANSITION` / `409 SUBSCRIPTION_TERMINAL` |
| 3 | Try **Modify** | Rejected — edits only while active (`409 SUBSCRIPTION_NOT_ACTIVE`) |
| 4 | Try **Skip next** | Rejected — not active |
| 5 | List shows the cancelled box | Kept for history with cancelled badge |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-88: Veggie-box kill switch (FEATURE_DISABLED banner)
- **Module:** 13 Subscriptions      **Priority:** P2
- **Roleplay:** You are Meena. The platform temporarily disables boxes; you must see a clear banner, not a crash.
- **Preconditions:** [ADMIN] sets `app_config/veggie_box.enabled=false`.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Subscriptions | UI banner: "Subscription boxes are temporarily unavailable" |
| 2 | Try creating a subscription | (API) `409 FEATURE_DISABLED`; create blocked gracefully |
| 3 | Existing subscriptions still listed | Read-only display OK |
| 4 | [ADMIN] re-enable (`veggie_box.enabled=true`) | Create works again |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.14 Module 14 — Planner & Repeat Purchases (C11, C13)

Covers: planner recommendations (repurchase + new lots, mandi price, trend, fair band, lot links),
empty state.

### TC-EMC-89: Planner — repurchase intelligence & price trends (C13)
- **Module:** 14 Planner      **Priority:** P1
- **Roleplay:** You are Meena. The planner tells you what to restock and whether prices are rising.
- **Preconditions:** Some purchase history (earlier orders); lots available.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Planner** (`GET /customer/planner`) | Up to 6 recommendations: top-5 repurchased crops + newest open lots |
| 2 | Read a recommendation | Per crop: `currentMandiPrice`, `projectedNextMonth`, `priceTrend` (rising/softening/stable vs 90-day band), human-readable text, lotId, `fairPriceBand` |
| 3 | Tap a recommendation's lot | Opens that lot (browse/storefront) |
| 4 | Verify with real data | Compare currentMandiPrice with the mandi strip on Home |
| 5 | Fresh account (no history) | Empty-state message instead of blank page |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.15 Module 15 — Wallet, Coins & Transactions (C9)

Covers: overview stats, monthly/category spends, coins panel & tiers, transactions + filters +
receipt PDFs, refunds pending, coins ledger consistency.

### TC-EMC-90: Wallet overview — stats, spends, coins panel
- **Module:** 15 Wallet      **Priority:** P1
- **Roleplay:** You are Meena. Month-end: you review your total spend and coin tier.
- **Preconditions:** Order + refund history exists (earlier modules).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Wallet & Coins** (`/customer/wallet`) → **Overview** | Stat cards: Total Spend, Active Orders (+ "N standing demands · M open quotes"), Volume Purchased (q + MT), Fulfillment SLA % |
| 2 | Check spend charts | Monthly Spend bars (last 6 months); Spend by Category bars |
| 3 | Open **Kisan Coins panel** | Balance, tier/title, day streak, badges count, coins earned, progress to next tier (`gamification.status()`) |
| 4 | Tap **View Order History** / **Continue Shopping** | Navigates correctly |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-91: Transactions tab — filters, totals, receipt PDF
- **Module:** 15 Wallet      **Priority:** P1
- **Roleplay:** You are Meena. You find the refund and download a receipt for an order.
- **Preconditions:** Mixed transaction history (orders, refund, coins).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Wallet → **Transactions** | Totals: Received / Sent / **Refunds Pending** |
| 2 | Filter **Sent** then **Received** then **All** | Lists re-filter correctly |
| 3 | Inspect a row | purpose/type, counterparty, source, date, ±amount, status |
| 4 | Tap **receipt PDF** on a row (`GET /payments/{id}/receipt.pdf`) | PDF downloads with payment details |
| 5 | Cross-check one order payment | Row amount = order grand total (both sides of the money movement) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-92: Coins ledger consistency — earn & burn (C9)
- **Module:** 15 Wallet      **Priority:** P1
- **Roleplay:** You are Meena. You verify every coin earned and spent is accounted for.
- **Preconditions:** Known starting balance B0; did referral invite (TC-EMC-103) and diary entries; redeemed coins at checkout (TC-EMC-28).
- **Test data:** B0 recorded.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Record balance now | `gamification.status().agriCoins` = B0 |
| 2 | Add a diary entry | Entry shows `agriCoinsEarned`; balance increases by that amount |
| 3 | Redeem N coins at a checkout | Balance decreases by exactly N; ledger + shadow ledger + audit rows written (`spend_coins`) |
| 4 | Sum the ledger | Earned − burned = current balance — matches to the coin |
| 5 | Check 1 coin = ₹1 | Redeemed N coins reduced payable by exactly ₹N |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.16 Module 16 — Coupons (C9)

Covers: coupon list with `applicable` flags, validate endpoint math (percentage cap, flat cap,
minOrder), usedCount increment at placement.

### TC-EMC-93: Coupon directory & validation math
- **Module:** 16 Coupons      **Priority:** P1
- **Roleplay:** You are Meena. You browse available coupons and check the math before applying.
- **Preconditions:** Coupons seeded by [ADMIN]: one percentage with maxDiscount cap, one flat.
- **Test data:** `SAVE10` (10%, max ₹75); `FLAT50` (flat ₹50, min ₹499); cart ₹800.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | `GET /coupons?cartTotal=800` (or the coupons screen) | Active, unexpired coupons only; each with `applicable` flag for ₹800 |
| 2 | `POST /coupons/validate {code:"SAVE10", cartTotal:800}` | `{valid:true, discount:75}` — 10% = ₹80 but capped at maxDiscount ₹75; `finalTotal` correct |
| 3 | Validate `FLAT50` at cartTotal ₹300 | `{valid:false, message:"Minimum order ₹499 not met"}` |
| 4 | Validate flat coupon at cartTotal ₹40 (< flat value) | Discount capped at cart total — no negative total |
| 5 | Place an order with `FLAT50` | Order total reduced by ₹50; coupon `usedCount` incremented |
| 6 | Exhaust a 1-use coupon → validate again | Rejected: usage limit exhausted |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.17 Module 17 — Ads (Consumer Surface)

Covers: banner display, click-through to targetUrl, impression/click simulated spend, budget
exhaustion retires the ad.

### TC-EMC-94: Ad banners — display, click, spend & budget exhaustion
- **Module:** 17 Ads      **Priority:** P2
- **Roleplay:** You are Meena. You see a promo banner on Home and tap it.
- **Preconditions:** [ADMIN]/advertiser runs an active campaign for placement home_banner.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Home / catalog | Promo banner(s) render (active campaigns sorted by CTR) |
| 2 | Tap a banner | `POST /ads/{id}/click` → opens `targetUrl` (targetType deep link) |
| 3 | [ADMIN] check campaign analytics | Impression +₹0.50 and click +₹2.00 simulated spend recorded (`POST /ads/{ad_id}/impression` fired on view) |
| 4 | [ADMIN] exhaust the campaign budget | Campaign status → **completed** |
| 5 | Refresh your Home | Banner disappears |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.18 Module 18 — Alerts & Saved Searches

Covers: product alerts (price_drop/restock/back_in_season), price alerts (above/below, mandi-data
gate, lazy firing, notification + task + deep link), saved searches CRUD + alert toggles.

### TC-EMC-95: Product alerts — set, view, fire, delete
- **Module:** 18 Alerts      **Priority:** P1
- **Roleplay:** You are Meena. You want to know when tulsi plants restock and when ghee price drops.
- **Preconditions:** Products exist; [ADMIN]/seller can change price/stock 🔄.
- **Test data:** Tulsi plant (restock); A2 Ghee (price_drop).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Product Alerts** (`/customer/product-alerts`) on a product | Create alert with kinds: `price_drop`, `restock`, `back_in_season` |
| 2 | Set alerts on both products | `POST` upserts kinds (replaces previous set for that product) |
| 3 | View the list (`GET`) | Each row joined with live price/stock |
| 4 | 🔄 second tester (see 07_cross_persona_e2e.md): seller raises stock / cuts price | — |
| 5 | Check your bell | Product alert notification (restock / price_drop) arrives |
| 6 | Delete the ghee alert (`DELETE /customer/product-alerts/{productId}`) | Removed from list |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-96: Price alerts — above/below target, mandi gate, firing
- **Module:** 18 Alerts      **Priority:** P1
- **Roleplay:** You are Meena. You set a tomato alert: notify me when the mandi modal crosses ₹1,600/q.
- **Preconditions:** Tomato has mandi data; [ADMIN] can nudge the modal (or wait for market move).
- **Test data:** target ₹1,600, above=true.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Create price alert: crop Tomato, target ₹1,600, **above** | `POST /price-alerts` accepted |
| 2 | Create a price alert for a crop with **no mandi data** | `422` — rejected (crop must have mandi data) |
| 3 | View `GET /price-alerts` | Alert listed with target/above |
| 4 | 🔄/market move: modal crosses ₹1,600 | Lazy-fired on access: notification "**Price alert / भाव अलर्ट** — Tomato: mandi modal ₹1,6xx ≥ your ₹1,600" + mandi task |
| 5 | Tap the notification | Deep-links to `/dashboard/p/mandiCharts` |
| 6 | Delete the alert | `DELETE /price-alerts/{id}` removes it |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-97: Saved searches — CRUD + alert channels
- **Module:** 18 Alerts      **Priority:** P1
- **Roleplay:** You are Meena. You manage the searches you saved from produce browse.
- **Preconditions:** One saved search exists (TC-EMC-45).
- **Test data:** Query "organic tomato Baner".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Saved Searches** | List shows the saved search with queryText, crop, district, price band, `harvestWindowDays` |
| 2 | `POST` a second search with full filters (`minPrice, maxPrice, minQuantityQuintals`) | Created; appears in list |
| 3 | Open one search (`GET /saved-searches/{id}`) | Detail matches what you saved |
| 4 | Update alerts: `POST /saved-searches/{id}/alerts {enabled:true, pushNotification:true, sms:false, harvestWindowDays:7}` | Toggles saved; new lots matching the search will notify via push only |
| 5 | 🔄 second tester: farmer posts a matching new lot | You receive the new-lot notification |
| 6 | Delete a search | Removed |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.19 Module 19 — Ratings & Reviews (C12)

Covers: pending rating prompts (marketplace_order), submit with tags, one-per-booking, blocked
text, mine/given aggregates, reply once, freeze during disputes.

### TC-EMC-98: Rate a delivered order — pending prompt → submit (C12)
- **Module:** 19 Ratings      **Priority:** P0
- **Roleplay:** You are Meena. The mall delivered on time; you rate the seller 5 stars.
- **Preconditions:** Order `delivered` (TC-EMC-36); no rating yet for that booking.
- **Test data:** 5★; comment "On time and fresh"; tag "quality".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Ratings → Pending** (`GET /ratings/pending`) | `marketplace_order` prompt listed for the delivered order |
| 2 | Open the prompt → choose 5 stars → comment → tags → **Submit** | `POST /ratings {bookingKind:"marketplace_order", bookingId, stars, comment, tags}`; prompt closes |
| 3 | Submit a second rating for the same booking | `409 ALREADY_RATED` — one rating per rater per booking |
| 4 | 🔄 second tester (see 07_cross_persona_e2e.md): farmer | Farmer's `provider_ratings` aggregate + trust tier updated; farmer can see rater name and reply |
| 5 | (API) rate a booking you don't own | Rejected |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-99: Rating text moderation — blocked phrase (422)
- **Module:** 19 Ratings      **Priority:** P1
- **Roleplay:** You are Meena. An angry draft contains abuse; the platform must reject it.
- **Preconditions:** A pending rating prompt.
- **Test data:** Comment with profanity / banned phrase (use a test pattern from the moderation list — ask dev team).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open pending prompt → enter a comment containing a banned phrase → Submit | `422 RATING_TEXT_BLOCKED`; rating not saved |
| 2 | Enter a clean comment → Submit | Succeeds |
| 3 | Comment of 501 chars | Rejected (≤500 chars) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-100: Ratings mine/given + reply (once, ≤500 chars, idempotent)
- **Module:** 19 Ratings      **Priority:** P1
- **Roleplay:** You are Meena. As a business buyer you also RECEIVE ratings; you check your aggregate and reply to one review.
- **Preconditions:** Business account received ≥1 rating (from a farmer 🔄).
- **Test data:** Reply "Thank you, same time next week!".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Ratings → Mine** (`GET /ratings/mine`) | Aggregate avg/count + trustTier + recent received with rater names, kind, reply status |
| 2 | Open **Given** (`GET /ratings/given`) | Lists ratings you gave, with booking kind |
| 3 | Reply to a received rating | `POST /ratings/{id}/reply` — once only |
| 4 | Reply again (same id) | Idempotent — no duplicate reply (`409 ALREADY_REPLIED` if not idempotent) |
| 5 | Reply of 501 chars | Rejected (1–500 chars) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-101: Ratings frozen during an open dispute (S10)
- **Module:** 19 Ratings      **Priority:** P2
- **Roleplay:** You are Meena. A disputed FarmGate order should not be rateable until resolution.
- **Preconditions:** Order in `disputed` status (TC-EMC-63).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Ratings → Pending for the disputed order | No rating prompt for it (frozen while dispute open) |
| 2 | (API) `POST /ratings` against that booking | Rejected / blocked per S10 |
| 3 | [ADMIN] resolves the dispute | Prompt appears only after resolution (if rules allow) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.20 Module 20 — Referrals

Covers: referral screen (code, link, Hindi message, stats, milestones, leaderboard), invite
validation, invite/join coin rewards.

### TC-EMC-102: Referral screen — code, link, stats, leaderboard
- **Module:** 20 Referrals      **Priority:** P1
- **Roleplay:** You are Meena. You open Refer & Earn to share your code with colleagues.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Refer & Earn** (`/referrals`) | Referral code shown (`ref_{uid8}` fallback), shareLink `https://agrovercity.in/r/{code}` |
| 2 | Tap **Share** | Hindi share message: "Kisan Setu par judiye! … 100 AgriCoins ka bonus" (plus your link) |
| 3 | Check stats | invited / joined / totalEarnedCoins counters |
| 4 | Check milestones & referred list | Milestones shown; referred people listed with status invited\|joined + rewardCoins on joined |
| 5 | Check leaderboard | Leaderboard renders with **myRank** highlighted |
| 6 | `GET /referrals/summary` | Same data via API |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-103: Invite — validation & reward
- **Module:** 20 Referrals      **Priority:** P1
- **Roleplay:** You are Meena. You invite your neighbour by phone number.
- **Preconditions:** Fresh phone `+91 98ZZZZZZZZ` (Tester B).
- **Test data:** Name "Sneha Kulkarni"; phone `+91 98ZZZZZZZZ`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Invite Sneha with phone `+91 98ZZZZZZZZ` | Invite created; you get `INVITE_REWARD_COINS` (AgriCoins credited) |
| 2 | Invite the same phone again | `409 ALREADY_INVITED` |
| 3 | Invite phone `98ZZZZZZZZ` (no `+`/country code) | `400` — E.164 format required (`^\+[1-9]\d{7,14}$`) |
| 4 | Invite `+91 123` (too short) | `400` — E.164 rejected |
| 5 | Check wallet | Invite reward coins visible in balance + ledger |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-104: Referral join — both sides earn (🔄 cross-persona)
- **Module:** 20 Referrals      **Priority:** P1
- **Roleplay:** You are Meena. Your neighbour joins through your link.
- **Preconditions:** TC-EMC-103 invite sent; Tester B has the fresh phone ready.
- **Test data:** Join code = your referral code.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 second tester (see 07_cross_persona_e2e.md): Sneha registers with `+91 98ZZZZZZZZ` via your shareLink / enters your code | — |
| 2 | Wait for the join to register | Your referred list shows Sneha as **joined** |
| 3 | Check your coins | Join reward credited (join bonus per config) |
| 4 | 🔄: Sneha's side | Sneha also received the new-user referral bonus (100 AgriCoins per share copy) |
| 5 | Verify milestone progress | `totalEarnedCoins` updated; milestones re-evaluated |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.21 Module 21 — Diary & Household Finance

Covers: diary entries (3 types + categories), month summary, cross-month search, delete; finance
CEO budget, cards, 12-month chart, add-expense modal.

### TC-EMC-105: Diary — add entries, summary, search, delete
- **Module:** 21 Diary & Finance      **Priority:** P1
- **Roleplay:** You are Meena. You note the week's kitchen purchases and expenses.
- **Preconditions:** Logged in.
- **Test data:** Buy: "Vegetables from mall" ₹420, category Vegetables, qty 3 kg; Expense: "Electricity bill" ₹1,100, Utilities; Income: "Salary" — skip salary (use "Other" ₹500).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Diary** (`/customer/diary`) | Month navigator + summary chips (Total Spent / Total Bought / Entries), entries grouped by date |
| 2 | **Add Entry** → Type **Buy** | Buy posts type=household + tradeType=buy; categories: Groceries/Vegetables/Fruits/Dairy/Grains/Other |
| 3 | Fill title "Vegetables from mall", amount ₹420, date today, qty 3 kg, party "Krishi Mall", note | Saved with **Bought** badge; `agriCoinsEarned` shown if coins granted |
| 4 | Add **Expense** ₹1,100 Utilities | Expense categories: Utilities/Rent/Medical/Education/Travel/Other; **Sold/Expense** badge |
| 5 | Add **Income** ₹500 (Other) | Saved |
| 6 | Check summary chips | Totals update: Total Spent = ₹420+₹1,100(+₹500 income separate), Total Bought = ₹420, Entries = 3 |
| 7 | Search "Vegetables" | Cross-month search works (q ≥ 2 chars via `GET /diary/entries?q=`) |
| 8 | Delete an entry → confirm | Entry removed; summary re-computed |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-106: Diary validation negatives
- **Module:** 21 Diary & Finance      **Priority:** P2
- **Roleplay:** You are Meena. You try an empty title and a zero amount.
- **Preconditions:** Add Entry modal open.
- **Test data:** amount `0`; title empty; search `a`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Submit with empty title | Rejected — title* required |
| 2 | Enter amount `0` or `-50` | Rejected — amount > 0 |
| 3 | Leave date empty | Rejected — date* required |
| 4 | Search single character `a` | Search not fired / "type at least 2 characters" hint |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-107: Finance CEO — monthly budget & insights
- **Module:** 21 Diary & Finance      **Priority:** P1
- **Roleplay:** You are Meena. You set a ₹20,000 household budget and watch the burn-down.
- **Preconditions:** Diary entries exist.
- **Test data:** Budget ₹20,000.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Finance** (`/customer/finance`) → set monthly budget `20000` (`users.updateSettings {householdBudgetMonthly}`) | Saved |
| 2 | Check cards | Spent This Month / Remaining Budget (% used) / Avg Daily Spend |
| 3 | Verify math | Spent = diary summary spend; Remaining = 20,000 − Spent; % correct |
| 4 | Check the chart | 12-month income-vs-expense bars with budget reference line |
| 5 | **Add Expense** modal | Expense categories ONLY (no Buy/Income types here) |
| 6 | Server search under Recent entries | Finds entries from diary |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.22 Module 22 — Seasonal Calendar

Covers: 12 month chips, in-season produce, nutrition guides, seasonal recipes.

### TC-EMC-108: Seasonal calendar — months, produce, nutrition, recipes
- **Module:** 22 Seasonal      **Priority:** P2
- **Roleplay:** You are Meena. You check what vegetables are in season this month before planning the subscription box.
- **Preconditions:** Logged in.
- **Test data:** Month = October.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Seasonal** (`/customer/seasonal`) | 12 month chips; current month (October) highlighted |
| 2 | Read "In season in {month}" | Produce chips list October crops (matches `SEASONAL_PRODUCE` map) |
| 3 | Tap another month | Chips update for that month |
| 4 | Check **Nutrition guides** | Cards: title, items, note |
| 5 | Check **Seasonal recipes** | Cards: title, produce, steps, nutritionNote |
| 6 | (API) `GET /customer/seasonal` | 200 for any logged-in user; falls back to `SEASONAL_DEFAULT_DOC` seed |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.23 Module 23 — Misc Screens & Notifications

Covers: coins/news/trees/land-records screens, notification list deep links.

### TC-EMC-109: Misc persona screens render
- **Module:** 23 Misc & Notifications      **Priority:** P2
- **Roleplay:** You are Meena. You poke the remaining menu entries for your persona.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Kisan Coins** (`/customer/coins`) | Coins view renders (balance, tiers, badges) |
| 2 | Open **Agri News** (`/customer/news`) | News channels list renders |
| 3 | Open **Tree Plantation** (`/customer/trees`) | Adopted trees listed — your TC-EMC-30 tree appears (status planted, source marketplace_order) |
| 4 | Open **Land Records 7/12** (`/customer/712`) | LandRecordsView renders (via your linked farmer profile) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-110: Notifications list — every entry deep-links correctly
- **Module:** 23 Misc & Notifications      **Priority:** P1
- **Roleplay:** You are Meena. You audit the notification centre after a full day of activity.
- **Preconditions:** Notifications accumulated from earlier modules (order statuses, offers, price alerts, escrow events).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/notifications` | Chronological list; unread highlighted |
| 2 | Tap an order-status notification | Opens `/dashboard/p/orders` |
| 3 | Tap a price-alert notification | Opens mandi charts |
| 4 | Tap an offer notification | Opens the offer detail |
| 5 | Check bilingual titles | Notifications readable in English and हिन्दी where provided |
| 6 | Verify G2 | No message content or phone numbers inside SMS-style notification text beyond OTP/booking alerts |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### 3.24 Module 24 — ⚠️ Known Gaps & Spec Deltas

The feature spec for this persona describes behaviors that the code inventory flags as **defined
in spec but NOT enforced/implemented**. For each: perform the flow; **Expected result** = the
CORRECT spec behavior. These will likely FAIL on the current build — that is the point of this
module. **Known issue in current build — performing these cases will likely FAIL; raise a defect**
for each failure.

### TC-EMC-111: ⚠️ Buyer-type selection on business onboarding
- **Module:** 24 Gaps      **Priority:** P2
- **Roleplay:** You are Meena's business account. During business onboarding the spec says you must pick your buyer type.
- **Preconditions:** Business account, KYC area open.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open business onboarding / KYC | **Expected (spec):** buyer-type selector with options retail chain / mandi trader / processor / exporter / HoReCa / institutional |
| 2 | Select "processor" and continue | Selection saved on the business profile |

> ⚠️ Known issue in current build — performing this case will likely FAIL; raise a defect. (Inventory: buyer-type selection is spec-only, not enforced in code.)

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-112: ⚠️ GST auto-verify on GSTIN entry
- **Module:** 24 Gaps      **Priority:** P2
- **Roleplay:** You are Meena's business account. You enter your GSTIN and expect instant verification status.
- **Preconditions:** KYC form open.
- **Test data:** GSTIN `27ABCDE1234F1Z5`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Enter GSTIN in the KYC form | **Expected (spec):** GST auto-verify runs and shows verified/rejected status immediately |
| 2 | Enter a malformed GSTIN | Inline error before submit |

> ⚠️ Known issue in current build — performing this case will likely FAIL; raise a defect. (Inventory: GST auto-verify is spec-only; today gstin/pan need manual [ADMIN] review — TC-EMC-07.)

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-113: ⚠️ Mandi-license mandatory gate for the mandi channel
- **Module:** 24 Gaps      **Priority:** P2
- **Roleplay:** You are Meena's business account. You try to buy through the mandi channel without an APMC mandi licence.
- **Preconditions:** Business account without apmc_mandi_licence.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Attempt a mandi-channel purchase | **Expected (spec):** blocked until APMC mandi licence is verified |
| 2 | Upload + get licence approved → retry | Purchase allowed |

> ⚠️ Known issue in current build — performing this case will likely FAIL; raise a defect. (Inventory: mandi-license mandatory gate is spec-only, not enforced in code.)

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-114: ⚠️ KYC badge "Verified-Business" / "Pending" on profile
- **Module:** 24 Gaps      **Priority:** P2
- **Roleplay:** You are Meena's business account. Your profile should show a KYC badge.
- **Preconditions:** Before and after TC-EMC-07 approval.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open your business profile before approval | **Expected (spec):** badge "Pending" on the profile |
| 2 | Open profile after gstin+pan approval | Badge flips to "Verified-Business" |

> ⚠️ Known issue in current build — performing this case will likely FAIL; raise a defect. (Inventory: KYC badge is spec-only.)

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-EMC-115: ⚠️ Anti-hoarding declaration UI on first business quote
- **Module:** 24 Gaps      **Priority:** P2
- **Roleplay:** You are Meena's business account making the first quote.
- **Preconditions:** Business account, KYC verified, never quoted (fresh sub-account or reset flags).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Request Quote** for the first time | **Expected (spec):** an explicit anti-hoarding declaration UI block (and no-off-platform declaration) with legal copy, both required to proceed |
| 2 | Unticked → submit | `422 ATTESTATION_REQUIRED` with clear message (this part IS enforced — verify) |
| 3 | Tick both → submit | Quote created; attestations persisted |

> ⚠️ Known issue in current build — the attestation ENFORCEMENT exists (TC-EMC-09); the dedicated declaration UI with legal copy is spec-only. Partial fail = raise a defect.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

## 4. Module coverage matrix

| Module | Cases (IDs) | Count |
|--------|-------------|------:|
| 1 — Onboarding, Login & Profile (C1) | TC-EMC-01 … TC-EMC-10 | 10 |
| 2 — Home & Dashboard | TC-EMC-11 … TC-EMC-14 | 4 |
| 3 — Krishi Mall Catalog & Product Detail (C3) | TC-EMC-15 … TC-EMC-21 | 7 |
| 4 — Cart & Checkout (C6) | TC-EMC-22 … TC-EMC-34 | 13 |
| 5 — Retail Orders, Tracking & Post-order | TC-EMC-35 … TC-EMC-42 | 8 |
| 6 — Produce Browse / FarmGate Discovery (C3) | TC-EMC-43 … TC-EMC-45 | 3 |
| 7 — Seller Storefront & Favorites (C3, C11) | TC-EMC-46 … TC-EMC-48 | 3 |
| 8 — Quotes & Price Negotiation (C4, C5) | TC-EMC-49 … TC-EMC-56 | 8 |
| 9 — FarmGate Procurements, Inspection & Disputes (C6, C8, C9, C10) | TC-EMC-57 … TC-EMC-70 | 14 |
| 10 — Demands (C2) | TC-EMC-71 … TC-EMC-73 | 3 |
| 11 — Offers & Two-way Negotiation (C5) | TC-EMC-74 … TC-EMC-78 | 5 |
| 12 — Chat Compliance (C7) | TC-EMC-79 … TC-EMC-83 | 5 |
| 13 — Subscriptions (Veggie Boxes) | TC-EMC-84 … TC-EMC-88 | 5 |
| 14 — Planner & Repeat Purchases (C11, C13) | TC-EMC-89 | 1 |
| 15 — Wallet, Coins & Transactions (C9) | TC-EMC-90 … TC-EMC-92 | 3 |
| 16 — Coupons (C9) | TC-EMC-93 | 1 |
| 17 — Ads (Consumer Surface) | TC-EMC-94 | 1 |
| 18 — Alerts & Saved Searches | TC-EMC-95 … TC-EMC-97 | 3 |
| 19 — Ratings & Reviews (C12) | TC-EMC-98 … TC-EMC-101 | 4 |
| 20 — Referrals | TC-EMC-102 … TC-EMC-104 | 3 |
| 21 — Diary & Household Finance | TC-EMC-105 … TC-EMC-107 | 3 |
| 22 — Seasonal Calendar | TC-EMC-108 | 1 |
| 23 — Misc Screens & Notifications | TC-EMC-109 … TC-EMC-110 | 2 |
| 24 — ⚠️ Known Gaps & Spec Deltas | TC-EMC-111 … TC-EMC-115 | 5 |
| **Total** | **TC-EMC-01 … TC-EMC-115** | **115** |

Every inventory module (1, 2, 3.1–3.20, cross-persona interactions, money flows, notifications,
edge cases) is covered above; the C1–C13 compliance map is in Section 3.

---

## 5. Sign-off

| Field | Value |
|-------|-------|
| Tester name (roleplay: Meena Deshmukh) | ______________________ |
| Tester role | Tester A |
| Execution dates | ________ to ________ |
| Environment (backend commit / build) | ______________________ |

### Summary count

| Metric | Count |
|--------|------:|
| Total cases | 115 |
| P0 cases | 23 — TC-EMC-01, -02, -03, -04, -15, -16, -22, -30, -31, -35, -37, -42, -49, -53, -57, -58, -61, -66, -77, -80, -81, -82, -98 |
| P1 cases | 74 |
| P2 cases | 18 — TC-EMC-10, -14, -21, -23, -44, -64, -69, -88, -94, -101, -106, -108, -109, -111, -112, -113, -114, -115 |
| Pass | ______ |
| Fail | ______ |
| Open defects (with IDs) | ______ |

**Release gate check (per README):** all P0 pass ☐ · ≥ 95% P1 pass ☐ · zero open Blocker defects ☐

| Sign-off | Signature & date |
|----------|------------------|
| Tester | ______________________ |
| QA Lead | ______________________ |
| Product Owner | ______________________ |
