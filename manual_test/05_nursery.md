# Nursery (Plant Nursery Owner) — Manual Test Script (Final UAT)

> This script is for the tester roleplaying **Prakash Bhosale**, a plant-nursery owner who sells saplings on Agrovercity. It contains **76 test cases** in **13 modules** and takes roughly **6–7 hours** (plus waiting time for the second tester in cross-persona steps). The Nursery is a **website (desktop) persona** — run it in Chrome on a laptop, not on the mobile app.

## 0. Roleplay card

| Field | Value |
|---|---|
| Name | Prakash Bhosale |
| Age | 50 |
| Background | Owns **Bhosale Fruit Nursery** near Nashik, Maharashtra. Sells grafted mango (Kesar), chikoo and custard-apple (sitaphal) saplings, plus seeds, pots and fertilizer. Delivers within 50 km. His son Rohit operates the computer for him. |
| Language | Marathi speaker; runs the app in English but must verify हिन्दी labels too |
| Device | Laptop + Chrome (React web app, nursery persona has **no mobile-app screens**) |
| Goal for this test | Register as nursery → pass KYC → publish saplings → receive a Krishi Mall order → pack & dispatch it → get paid (minus 5% commission) → withdraw to UPI |
| Linked personas | **E-Market Customer / Farmer buyers** (place orders, rate, apply coupons — second tester, see 07_cross_persona_e2e.md); **Super-Admin** (KYC approval/rejection, plant moderation — Tester C); **Transporter** (courier partner name is typed at dispatch) |

## 1. Account & test data setup

1. Open the Agrovercity website in Chrome in an incognito window. Confirm you are logged out.
2. On the login screen, enter phone `+91 98220 00005` and tap **Send OTP**. In dev, the OTP `123456` always works (or copy `devOtp` from the API response if you have API access).
3. Complete registration choosing the **Plant Nursery (पौधघर / नर्सरी)** role. Enter the profile fields from the table below when asked.
4. After onboarding, confirm the app lands on `/nursery` (the nursery home "Horticulture & Plant Nursery Hub").
5. Set the demo MPIN `1234` (Profile → Security) so later logins are fast.
6. Keep a second browser/device ready: a **buyer account** (phone `+91 98220 00009`, role "E-Market Customer" or "Farmer") operated by the second tester for order, coupon and rating flows.
7. Agree the sandbox UPI IDs with the team before starting payout cases.

**Test data (use these exact values everywhere):**

| Item | Value |
|---|---|
| Nursery login phone | +91 98220 00005 |
| Nursery OTP / MPIN | OTP `123456` (dev) / MPIN `1234` |
| Nursery Firm Name | Bhosale Fruit Nursery |
| Owner/Proprietor Name | Prakash Bhosale |
| Business Email | prakash.bhosale.fruit@example.com |
| Contact Phone (profile) | +91 98220 00005 |
| Full Physical Address | Gat No. 112, Ozar–Saykheda Road, Ozar, Niphad |
| District / State / PIN | Nashik / Maharashtra / 422206 |
| Delivery radius | 50 km (slider default) |
| NHB/Horticulture Registration No. | NHB-REG-MH-NSK-2019-04551 |
| Nursery Trade License No. | TRD-NSK-2024-11877 |
| KYC document | Any JPG photo of a sample certificate + one PDF file (for the PDF upload check) |
| Bank Account Number | 50100441278965 |
| IFSC Code | HDFC0001207 |
| Settlement UPI ID | prakash.bhosale@okaxis |
| Specializations | fruit (also toggle timber for the chips test) |
| Plant 1 (main) | Display Title **Kesar Mango Grafted Sapling**, Species **Mango / आंबा**, Variety **Gir Kesar**, Category **fruit**, Unit **sapling**, Age **1-2 years**, Height **2-3 ft**, Price **₹160**, MRP **₹200**, Stock **100**, Min Order Qty **5**, Photo URL `https://example.com/kesar-mango.jpg`, Description "Grafted Kesar mango sapling, 1-2 years, ready for field planting." |
| Plant 2 (low stock) | Display Title **Chikoo (Sapodilla) Sapling**, Species **Sapodilla / चिकू**, Variety **Kalipatti**, Category **fruit**, Price **₹120**, MRP **₹150**, Stock **12** (forces Low-Stock badge, ≤15), Min Order Qty **5** |
| Plant 3 (edit/delete victim) | Display Title **Sitaphal Grafted Sapling**, Species **Custard Apple / सीताफळ**, Variety **Balanagar**, Category **fruit**, Price **₹140**, MRP **₹170**, Stock **40**, Min Order Qty **5** |
| Batch | Code auto `BATCH-2026-XXXX`, Plant = Kesar Mango Grafted Sapling, Graft Date = today, Initial Count **200**, Bed **Polyhouse Bed A-1**, Notes "June grafting lot." |
| Offer | Coupon Code **GREEN15** (auto if empty), Title **Monsoon Plantation Sale**, Discount **15%**, Min Order **₹500**, Cap Max **₹200**, Valid Until = today + 60 days |
| Order courier | Courier **AgroExpress Logistics**, Tracking auto `TRK-######` |
| Buyer account (second tester) | +91 98220 00009, name "Test Kisan", delivery address: Plot 7, Gangapur Road, Nashik 422013 |
| Withdrawal | Amount **₹100** minimum case; UPI override `rohit.bhosale@okhdfc` |

## 2. Preconditions checklist

Check these once before starting (they apply to most cases below):

- [ ] Backend is running: `GET http://<host>:8000/health` returns OK.
- [ ] Website builds and opens; `/docs` shows the API list.
- [ ] Super-admin web panel opens (Tester C) for [ADMIN] steps.
- [ ] Fresh nursery account can be created (OTP flow works — see Section 1).
- [ ] Buyer account (second tester) is registered and can log in.
- [ ] Test UPI IDs and bank details above are agreed with the dev team (sandbox).
- [ ] Language toggle: confirm English/हिन्दी switch is visible (Settings or navbar).
- [ ] Keep the API docs open for reference — some negative cases mention exact error codes (`422 INVALID_STATUS_TRANSITION`, `409 OUT_OF_STOCK`, etc.) to compare with the browser console or `/docs`.

## 3. Test cases

### Module 1 — Role Registration, Onboarding & Profile/KYC  *(inventory §1)*

Covers: phone/OTP auth, nursery role registration, persona picker, profile auto-creation, the 5-section "Nursery Profile & Shop KYC" form, document upload, KYC verified/pending badges, admin reject, and ⚠️ Gap 1 (no admin approve endpoint) + ⚠️ Gap 2 (no KYC-rejection notification).

### TC-NRS-01: Register a new nursery account with OTP
- **Module:** Registration & Onboarding      **Priority:** P0
- **Roleplay:** You are Prakash. You are opening the app for the first time to register your nursery.
- **Preconditions:** Logged out; phone +91 98220 00005 is not already registered (use a fresh number if it is).
- **Test data:** Phone +91 98220 00005; OTP 123456 (dev).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the website login screen and enter `+91 98220 00005` | Phone number is accepted; "Send OTP" button becomes active |
| 2 | Tap **Send OTP** | "OTP sent" message appears (in dev the `devOtp` is returned / 123456 works) |
| 3 | Enter `123456` and tap **Verify OTP** | OTP is accepted; you are taken to the registration/onboarding screen |
| 4 | When asked to pick a role, choose **Plant Nursery (पौधघर / नर्सरी)** under "Horticulture & Saplings" | Role is selected; profile fields for nursery appear (nurseryName, ownerName, licenseNo, registrationNo, deliveryRadiusKm, specializations, settlementUpi, bankAccount, ifscCode, serviceArea) |
| 5 | Enter Nursery Firm Name `Bhosale Fruit Nursery`, Owner Name `Prakash Bhosale`, license `TRD-NSK-2024-11877`, registration `NHB-REG-MH-NSK-2019-04551`, settlement UPI `prakash.bhosale@okaxis`, bank `50100441278965`, IFSC `HDFC0001207`, delivery radius `50`, specialization `fruit`; submit | Registration succeeds; account is created with the nursery role profile; you are logged in |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-02: Reject an invalid OTP and observe the rate limit
- **Module:** Registration & Onboarding      **Priority:** P1
- **Roleplay:** You are Prakash. Your son typed the OTP wrong; you want a clear error, then a resend.
- **Preconditions:** On the OTP-verify screen for +91 98220 00005 (repeat the Send OTP step if needed).
- **Test data:** Wrong OTP `000000`; correct OTP `123456`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Enter a wrong OTP such as `000000` and tap **Verify OTP** | Error message "Invalid OTP" (or similar) is shown; you are NOT logged in |
| 2 | Tap **Resend OTP** | A new OTP is requested; a "wait before resending" hint appears if tapped repeatedly |
| 3 | (Optional, note only) Send OTP 6 times within 10 minutes from API/docs | After 5 sends per 10 minutes the API returns HTTP 429 (rate limit) — record whether the UI shows a friendly message |
| 4 | Enter the correct OTP `123456` | Verification succeeds despite the earlier failures |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-03: Log in with phone + MPIN and set MPIN
- **Module:** Registration & Onboarding      **Priority:** P0
- **Roleplay:** You are Prakash. You log out in the evening and come back the next day.
- **Preconditions:** Account from TC-NRS-01 exists.
- **Test data:** Phone +91 98220 00005; MPIN 1234.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Log out, then open the login screen and choose **Login with MPIN** (phone + MPIN) | MPIN entry pad/fields appear |
| 2 | Enter phone `+91 98220 00005` and MPIN `9999` (wrong) | Login fails with a wrong-MPIN error; no session is created |
| 3 | Enter MPIN `1234` | Login succeeds; you land on the nursery home `/nursery` with your nursery name in the header |
| 4 | (If MPIN not yet set) go to Settings → Security → **Set MPIN**, enter `1234` twice | MPIN saved; next login with MPIN works |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-04: Select the Plant Nursery persona in the role picker and land on /nursery
- **Module:** Registration & Onboarding      **Priority:** P1
- **Roleplay:** You are Prakash. Your account can hold several roles; you switch to your nursery shop.
- **Preconditions:** Logged in (any role).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the persona switcher (navbar/profile menu) | A list of personas appears; "Plant Nursery" with 🌱 icon is listed, labeled "Plant Nursery (पौधघर / नर्सरी)" |
| 2 | Tap **Plant Nursery** under category "Horticulture & Saplings" | You are taken to `/nursery` — the "Horticulture & Plant Nursery Hub" home screen |
| 3 | Tap the persona switcher again and switch to any other persona, then back to **Plant Nursery** | Persona switch works both ways; your nursery data is intact after switching back |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-05: Open the profile for the first time — auto-created doc with "KYC Pending" badge
- **Module:** Registration & Onboarding      **Priority:** P0
- **Roleplay:** You are Prakash. You just registered and open your shop profile for the first time.
- **Preconditions:** Fresh nursery account; profile never opened before.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the sidebar → **Nursery Operations** → **Profile & Shop KYC** | "Nursery Profile & Shop KYC" screen opens even though you never saved a profile (backend auto-creates it on first fetch) |
| 2 | Look at the badge near the top | Badge shows **"KYC Pending Admin Review"** (amber) — not green |
| 3 | Check the pre-filled fields | Nursery Firm Name and Owner Name pre-filled from your account; District shows default "Pune" and State "Maharashtra"; Delivery Radius slider at 50 km; Specialization chips **fruit** and **timber** pre-toggled; registration/license/bank/UPI fields empty |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-06: Complete the full Nursery Profile & KYC form (all 5 sections)
- **Module:** Registration & Onboarding      **Priority:** P0
- **Roleplay:** You are Prakash. You fill your shop's full KYC so you can sell and receive payouts.
- **Preconditions:** TC-NRS-05 done; badge is amber "KYC Pending Admin Review".
- **Test data:** All values from the Section-1 table (firm name, address, PIN 422206, registration/license numbers, bank, IFSC, UPI, email).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Section **Nursery Identity & Contact**: enter Nursery Firm Name `Bhosale Fruit Nursery`, Owner/Proprietor Name `Prakash Bhosale`, Contact Phone `+91 98220 00005`, Business Email `prakash.bhosale.fruit@example.com` | Values are accepted; no validation errors |
| 2 | Section **Nursery Location & Delivery Radius**: enter Full Physical Address `Gat No. 112, Ozar–Saykheda Road, Ozar, Niphad`, District `Nashik`, State `Maharashtra`, PIN Code `422206`; move the Delivery & Pickup Coverage Radius slider to **50 km** | Address fields accepted; slider moves in steps of 5 between 10 and 250 and shows 50 |
| 3 | Section **Regulatory & KYC Compliance**: enter NHB/Horticulture Registration No. `NHB-REG-MH-NSK-2019-04551` and Nursery Trade License No. `TRD-NSK-2024-11877` | Both numbers accepted |
| 4 | Section **Settlement & Bank Payout Details**: enter Bank Account Number `50100441278965`, IFSC `HDFC0001207`, Settlement UPI ID `prakash.bhosale@okaxis` | Values accepted |
| 5 | Section **Nursery Specializations**: tap chips **fruit** and **timber**; tap **medicinal** once then again to deselect | Chips toggle on/off; fruit + timber stay selected |
| 6 | Tap **Save Nursery Profile & KYC** | Success banner "updated successfully!" appears; after reload all values are still saved |
| 7 | Reload the page and check the badge | Badge is still amber "KYC Pending Admin Review" — a nursery cannot self-verify |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-07: Profile form negative validations
- **Module:** Registration & Onboarding      **Priority:** P1
- **Roleplay:** You are Prakash. Your son wants to see what happens with bad inputs.
- **Preconditions:** On the "Nursery Profile & Shop KYC" screen with saved data from TC-NRS-06.
- **Test data:** Invalid email, 5-digit PIN, bad IFSC.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Clear Nursery Firm Name and Owner/Proprietor Name, then tap **Save Nursery Profile & KYC** | Save is blocked with a "required field" message for the two fields (both are mandatory on the server) |
| 2 | Enter Business Email `not-an-email` and save | Email rejected with a validation message (or server 422) |
| 3 | Enter PIN Code `4222` (5 digits) and save | PIN rejected — 6 digits required |
| 4 | Enter IFSC `hdfc0001207` (lowercase) and save | IFSC is accepted as valid format or normalised to uppercase (record which) |
| 5 | Enter PIN Code `422206` again, restore the names, and save | Save succeeds again — form recovers cleanly after errors |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-08: Delivery-radius slider bounds and step
- **Module:** Registration & Onboarding      **Priority:** P2
- **Roleplay:** You are Prakash. You only deliver within 50 km and want to confirm the slider cannot go below 10 km or above 250 km.
- **Preconditions:** On the "Nursery Profile & Shop KYC" screen.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Drag the Delivery & Pickup Coverage Radius slider fully left | Slider stops at **10 km** (minimum); it cannot go below 10 |
| 2 | Drag the slider fully right | Slider stops at **250 km** (maximum) |
| 3 | Click at several points along the track | Value always lands on a multiple of 5 (step 5) |
| 4 | Set it back to **50 km** and save | 50 km is saved and shown after reload |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-09: Upload, view and replace a KYC document
- **Module:** Registration & Onboarding      **Priority:** P1
- **Roleplay:** You are Prakash. You upload your trade-license photo for verification.
- **Preconditions:** TC-NRS-06 done; a sample JPG and a sample PDF are saved on the laptop.
- **Test data:** KYC doc JPG; then a PDF version.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | In Regulatory & KYC section, tap **Upload Document** and pick a JPG image | File is accepted (file picker filters to `image/*` and `application/pdf`); upload shows progress and then a view link |
| 2 | Tap the view link of the uploaded document | The document opens/preview (image or PDF viewer) |
| 3 | Tap **Replace Document** and choose a PDF file | The PDF is accepted and becomes the current document; the old link is replaced |
| 4 | Save the profile and reload | The document link survives reload and still opens |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-10: ⚠️ Become a "KYC Verified Seller" — the admin approve path is missing
- **Module:** Registration & Onboarding / Admin      **Priority:** P0
- **Roleplay:** You are Prakash. Your KYC is complete and you expect the admin to approve it so buyers trust your shop.
- **Preconditions:** TC-NRS-06 and TC-NRS-09 done; profile status is "pending".
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Ask Tester C (Admin) to open the super-admin panel and find the nursery `Bhosale Fruit Nursery` in the nursery list (`GET /admin/nurseries`) | Admin can see your nursery in the list with status "pending" |
| 2 | Tester C: look for an **Approve / Verify** button or endpoint for a nursery | **EXPECTED (correct behavior):** an admin action exists that sets the nursery `verified=true`, `status="verified"`, and your badge turns green **"KYC Verified Seller"** |
| 3 | Refresh your Profile & Shop KYC screen after the admin action | Badge shows **"KYC Verified Seller"** (green) |
| 4 | Check the home header | Header shows **"✓ Verified Seller"** instead of "Pending Verification" |

> ⚠️ **Known issue in current build — performing this case will likely FAIL; raise a defect.** There is **no admin approve/verify-nursery endpoint** in `nursery.py` (only reject exists). Verification can only happen via the generic KYC route on `kyc_cases` docs or by hand-editing the database, so the approve path is effectively undefined. Expected correct behavior: an admin approve action that flips `verified=true` and updates the badge.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-11: Admin rejects KYC — rejected status, reason and self-update rules
- **Module:** Registration & Onboarding / Admin      **Priority:** P1
- **Roleplay:** You are Prakash. The admin rejects your KYC because the license photo is blurry; you fix it and re-save.
- **Preconditions:** TC-NRS-06 done; Tester C available.
- **Test data:** Reject reason `License photo unreadable`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tester C (Admin): call `POST /admin/nurseries/{id}/reject?reason=License photo unreadable` (or the matching admin-panel action) for Bhosale Fruit Nursery | Admin gets a success response; nursery status becomes "rejected", `rejectionReason` saved |
| 2 | Refresh your Profile & Shop KYC screen | Badge shows rejected/KYC-failed state with the reason visible |
| 3 | Edit the license number, re-upload the document, and tap **Save Nursery Profile & KYC** | Save succeeds; `verified` and `status` stay as the admin set them — your edits do NOT reset the rejection or self-approve you |
| 4 | (Tester C re-verifies via the generic KYC route, if available, or DB) then refresh | After admin re-approval the badge returns to the approved/pending state as per TC-NRS-10 outcome |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-12: ⚠️ No notification when KYC is rejected or a plant is moderated
- **Module:** Notifications (gap)      **Priority:** P2
- **Roleplay:** You are Prakash. You expect a bell notification when your KYC is rejected or a plant is taken down.
- **Preconditions:** Tester C can reject KYC / moderate a plant; your bell is currently empty.
- **Test data:** Plant = Sitaphal Grafted Sapling (created later in TC-NRS-19/20); reject reason from TC-NRS-11.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | After Tester C rejects your KYC (TC-NRS-11), open the **bell / notifications** | **EXPECTED (correct behavior):** a notification such as "Your nursery KYC was rejected: License photo unreadable" with a link to the profile |
| 2 | Tester C moderates your plant: `POST /admin/plants/{id}/moderate?action=taken_down&reason=...`; then open the bell | **EXPECTED (correct behavior):** a notification such as "Your plant listing Sitaphal Grafted Sapling was taken down: …" |
| 3 | Check where the rejection/take-down IS visible today | Only the profile badge / the plant disappearing from the mall — no notification exists |

> ⚠️ **Known issue in current build — performing this case will likely FAIL; raise a defect.** No notification code exists for KYC rejection or plant moderation; the nursery only finds out via the badge or by noticing the missing listing.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 2 — Home / Dashboard  *(inventory §2)*

Covers the "Horticulture & Plant Nursery Hub" home: KPI cards, header quick buttons, low-stock alert banner, recent-orders list, AI teaser, and the 21-module feature directory + sidebar navigation.

### TC-NRS-13: Dashboard loads with 4 correct KPI cards
- **Module:** Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Prakash. Every morning you open your nursery home to see how the shop is doing.
- **Preconditions:** Logged in; at least one plant and one order exist (after TC-NRS-19 and TC-NRS-32+).
- **Test data:** Plant stock 100 (Kesar) + 12 (Chikoo) = 112 units, 2 species; 1 delivered order of ₹800.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open sidebar → **Nursery Operations** → **Cockpit** (or navigate to `/nursery`) | "Horticulture & Plant Nursery Hub" opens without errors |
| 2 | Read the **Gross Sales ₹** card | Shows the sum of *delivered-only* order totals (₹800 example); not of placed/packed orders |
| 3 | Read the **Orders** card | Shows total orders; if any order awaits dispatch the subtitle "N awaiting dispatch" appears |
| 4 | Read the **Plant Stock** card | Shows 112 units and subtitle "2 species cataloged" |
| 5 | Read the **Low-Stock Items** card | Shows count 1 (Chikoo, stock 12 ≤ 15) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-14: Header banner, verification badge and quick buttons
- **Module:** Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Prakash. You use the header buttons for your daily work.
- **Preconditions:** Logged in; stock state from TC-NRS-13.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Read the header banner | Nursery name "Bhosale Fruit Nursery" is shown; badge shows **"✓ Verified Seller"** (if KYC approved) or **"Pending Verification"** (matches TC-NRS-10 outcome) |
| 2 | Tap the amber **Low Stock** quick button (has a count badge) | Goes to `/nursery/inventory` |
| 3 | Go back home (`/nursery`) and tap **Add Plant** | Goes to `/nursery/inventory` (opens the Add-Plant flow) |
| 4 | Go back home and tap **Log Batch** | Goes to `/nursery/batches` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-15: Low-stock alert banner (stock ≤ 15) and its button
- **Module:** Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Prakash. Your chikoo saplings are running low (12 left) and the app warns you.
- **Preconditions:** Chikoo plant exists with stock 12 (≤ 15 threshold).
- **Test data:** Chikoo (Sapodilla) Sapling, stock 12.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/nursery` | **Low-Stock Alert Banner** is visible listing the Chikoo variety (stock ≤ 15) |
| 2 | Check that varieties with stock above 15 are NOT listed | Only Chikoo appears; Kesar Mango (100) is not listed |
| 3 | Tap **Manage Batches** on the banner | Goes to `/nursery/batches` |
| 4 | (After) raise Chikoo stock above 15 (via a new batch in TC-NRS-25) and reload home | Banner disappears once stock > 15 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-16: Recent Plant Orders list and Manage Status
- **Module:** Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Prakash. You check the newest orders right from the home screen.
- **Preconditions:** At least 2 orders exist from the cross-persona flow (TC-NRS-32 range).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/nursery` and read **Recent Plant Orders** | Up to 5 latest orders show: order # (last 8 chars), status pill (delivered/dispatched/packed or amber default), items count, delivery address, ₹total |
| 2 | Compare order order | Newest order is on top (sorted by createdAt, newest first) |
| 3 | Tap **Manage Status →** | Goes to `/nursery/orders` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-17: AI insight teaser and the 21-module feature directory
- **Module:** Home / Dashboard      **Priority:** P2
- **Roleplay:** You are Prakash. You explore what else the hub offers.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Find the **AI Insight Teaser** card (static monsoon forecast) and tap **Open AI Analysis Cockpit** | Goes to `/nursery/ai` |
| 2 | Go back; count the tiles in the **Feature Directory** grid | 21 tiles are present, including: Profile & KYC, My Plants, Batches & Stock, Orders Received, Reviews & Ratings, Offers & Discounts, Earnings & Payouts (labeled "5% commission ledger"), AI Analysis, Nursery Diary, Ad Manager, E-Market Shopping, Finance CEO, AI Chatbot, Gyansetu Learning, Agri News Feed, Coin Rewards ("Krushi Ratna wallet"), Refer & Earn, Tree Hub, 7/12 Records |
| 3 | Tap each of these 5 tiles and come back: My Plants, Orders Received, Offers & Discounts, Earnings & Payouts, Nursery Diary | Each opens its screen without error (details tested in their own modules) |
| 4 | Check the **sidebar** against the directory | Sidebar shows the same modules in 3 groups — "Nursery Operations", "Growth & Business" (incl. Finance CEO (P&L), AI Analysis & Forecast), "Ecosystem & Utilities" (incl. 7/12 Land Records) — and every sidebar link opens its screen |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 3 — Plant Inventory  *(inventory §3.1)*

Covers `/nursery/inventory`: listing, search, category chips, the Add/Edit/Delete modals with their validations, the mirror into the shared products collection (Krishi Mall), and ⚠️ Gap 5 (status filter exists in API only).

### TC-NRS-18: Inventory list — search and category chips
- **Module:** Plant Inventory      **Priority:** P1
- **Roleplay:** You are Prakash. You browse your sapling catalogue.
- **Preconditions:** Plants from Section 1 exist (Kesar, Chikoo, Sitaphal).
- **Test data:** Search "Kesar"; chip "Fruit".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open sidebar → **My Plants/Inventory** | `/nursery/inventory` opens; card grid shows each plant's photo, category tag, badge, title, species • variety, Age, Height, Stock, ₹price with MRP struck through, Min qty |
| 2 | Type `Kesar` in the search box | Only the Kesar Mango card remains (search matches species/variety too — try "Gir") |
| 3 | Clear search; tap chip **Fruit** then **Timber** | Fruit shows all 3 plants; Timber shows none (empty-state message or empty grid) |
| 4 | Tap chip **All** | All 3 plants are back |
| 5 | Check badges | Chikoo card shows **Low Stock** (stock 12 ≤ 15); Kesar shows **In Stock** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-19: Add a new plant (happy path) — Kesar Mango Grafted Sapling
- **Module:** Plant Inventory      **Priority:** P0
- **Roleplay:** You are Prakash. You list your flagship Kesar mango grafted sapling for sale.
- **Preconditions:** On `/nursery/inventory`.
- **Test data:** Values from Section-1 "Plant 1 (main)" row.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Add New Plant** | Modal **"Add New Plant Sapling"** opens with all fields empty |
| 2 | Enter Display Title `Kesar Mango Grafted Sapling` (placeholder shows "Kesar Mango Grafted Sapling"), Species Name `Mango / आंबा`, Variety `Gir Kesar` | Fields accepted |
| 3 | Set Category = **fruit**, Unit Type = **sapling**, Age of Plant `1-2 years`, Height `2-3 ft` | Dropdowns accept the values |
| 4 | Enter Selling Price ₹ `160` (default was 160), MRP ₹ `200`, Available Stock `100`, Min Order Qty `5` | Values accepted; Selling Price and Stock are required |
| 5 | Enter Photo URL `https://example.com/kesar-mango.jpg` and Description "Grafted Kesar mango sapling, 1-2 years, ready for field planting." | Values accepted |
| 6 | Tap **Publish Plant** | Modal closes; the new card appears in the grid with In Stock badge; plant is auto-approved (`moderationStatus="approved"`) and appears in the Krishi Mall without waiting for moderation |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-20: Add-plant form negative validations
- **Module:** Plant Inventory      **Priority:** P1
- **Roleplay:** You are Prakash. Your son checks the form rejects bad values before customers see them.
- **Preconditions:** On `/nursery/inventory`, Add-Plant modal open.
- **Test data:** Price 0, price -5, stock -1, empty title/species.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Leave all fields empty and tap **Publish Plant** | Submit blocked; Display Title and Species Name flagged as required |
| 2 | Fill everything but set Selling Price ₹ `0` | Rejected — price must be > 0 (min 1) |
| 3 | Set Selling Price ₹ `-5` | Rejected (min 1); the value is not accepted |
| 4 | Set Available Stock `-1` | Rejected — stock must be ≥ 0 |
| 5 | Set Category to an impossible value via API/console (e.g. `category="cactus"`) and submit | Server rejects with 422 — category must be one of fruit/timber/ornamental/medicinal/vegetables/flowering |
| 6 | Set Min Order Qty `0` | Rejected — minimum is 1 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-21: Edit a plant — changes sync to the Krishi Mall mirror
- **Module:** Plant Inventory      **Priority:** P1
- **Roleplay:** You are Prakash. You raise the Kesar price after the monsoon demand spike.
- **Preconditions:** TC-NRS-19 done.
- **Test data:** New price ₹175, stock 90.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the Kesar Mango card tap **Edit** | Modal **"Edit Plant Listing"** opens pre-filled with current values |
| 2 | Change Selling Price to `175`, Stock to `90`, Description to "Monsoon batch — price revised." | Fields update |
| 3 | Tap **Update Plant** | Modal closes; card shows ₹175 and stock 90 |
| 4 | Open the Krishi Mall (`/nursery/shop` or buyer view) and find Kesar Mango Grafted Sapling | Mirror product shows the same title, price ₹175, MRP ₹200 struck through, stock 90 — update is synced to the shared `products` collection |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-22: Delete a plant — soft delete archive behaviour
- **Module:** Plant Inventory      **Priority:** P1
- **Roleplay:** You are Prakash. You discontinue the Sitaphal sapling for this season.
- **Preconditions:** Sitaphal Grafted Sapling exists.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the Sitaphal card tap **Delete** | A browser confirm dialog appears ("are you sure" style) |
| 2 | Cancel the dialog | Card stays; nothing deleted |
| 3 | Tap **Delete** again and confirm | Card disappears from the inventory grid |
| 4 | Check the Krishi Mall for Sitaphal | Mirror product is gone/hidden — stock 0, `inStock=false`, status "out_of_stock" (soft delete/archive, not a hard removal) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-23: Mirrored plant is buyable by any buyer in the Krishi Mall
- **Module:** Plant Inventory (mirror) / Cross-persona      **Priority:** P1
- **Roleplay:** You are Prakash. You want proof that a farmer 40 km away can actually buy your sapling.
- **Preconditions:** Kesar Mango published (TC-NRS-19).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/nursery/shop` (or ask the second tester 🔄, see 07_cross_persona_e2e.md, to open the mall) | Krishi Mall product list loads |
| 2 | Find **Kesar Mango Grafted Sapling** | Card is present with category **plants**, your nursery name as brand/seller, rating 5.0, reviews 0, MRP ₹200 struck through, price ₹175 |
| 3 | 🔄 Second tester: open the plant detail and try ordering below the Min Order Qty | Checkout refuses with **422 MIN_ORDER_QTY** below 5 saplings; accepts 5+ |
| 4 | 🔄 Second tester: open the farmer mobile app's livestock/fodder-nursery directory | Your nursery appears in `GET /livestock/nurseries` with rating, availableSaplings and a **Call** button |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-24: ⚠️ Plant status filter exists in the API but not in the UI
- **Module:** Plant Inventory      **Priority:** P2
- **Roleplay:** You are Prakash. You heard the API supports filtering plants by status and expect the same in the screen.
- **Preconditions:** At least one active and one out-of-stock/archived plant (archive Sitaphal first in TC-NRS-22).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On `/nursery/inventory`, look for any control to filter by status (active / draft / out_of_stock) | **EXPECTED (correct behavior):** a status filter (dropdown or chips) exists and filters the grid, e.g. "out_of_stock" shows the archived Sitaphal |
| 2 | (Verify via API/docs) call `GET /nursery/plants?status=out_of_stock` | API does support the `status` filter and returns the archived plant |
| 3 | Record that the UI lacks the control | Only search + category chips exist on screen |

> ⚠️ **Known issue in current build — performing this case will likely FAIL; raise a defect.** The `status` query parameter exists in `GET /nursery/plants` but the inventory screen exposes no status filter UI.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 4 — Batches & Stock In/Out  *(inventory §3.2)*

Covers `/nursery/batches`: the alerts grid, the batches table, "Log Propagation Batch", and "Stock Out / Mortality" with its reasons and limits.

### TC-NRS-25: Log a propagation batch (adds stock to plant and mirror)
- **Module:** Batches & Stock      **Priority:** P1
- **Roleplay:** You are Prakash. Your June grafting lot of 200 Kesar saplings is ready; you log it.
- **Preconditions:** Kesar Mango plant exists (TC-NRS-19).
- **Test data:** Batch from Section-1 table (200 saplings, Polyhouse Bed A-1).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open sidebar → **Batches & Stock In/Out** | `/nursery/batches` opens with the alerts grid on top and the batches table below |
| 2 | Tap **Log Propagation Batch** | Modal opens; **Batch Code** is pre-filled automatically like `BATCH-2026-0001`; Graft/Plant Date defaults to today; Initial Sapling Count defaults to 200; Nursery Bed defaults to "Polyhouse Bed A-1" |
| 3 | In **Select Plant Species** pick `Kesar Mango Grafted Sapling (Mango / आंबा)` | Plant selected (dropdown lists only your own plants) |
| 4 | Enter Initial Sapling Count `200`, Bed `Polyhouse Bed A-1`, Notes `June grafting lot.` | Values accepted |
| 5 | Tap the submit button | Modal closes; the batch appears in the table: Batch Number, Plant/Species + notes, Propagation Date, Nursery Bed, Initial Count 200, Current Stock 200, Mortality 0 (survival 100%) |
| 6 | Check the Kesar plant card in inventory | Plant stock rose by 200 (90 → 290) and the mirror product stock matches — batch create increments both |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-26: Log-batch form negative validations
- **Module:** Batches & Stock      **Priority:** P2
- **Roleplay:** You are Prakash. Your son checks the batch form.
- **Preconditions:** On `/nursery/batches`, Log-Propagation modal open.
- **Test data:** Initial count 0, empty species.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Leave Select Plant Species empty and tap submit | Submit blocked — species is required |
| 2 | Set Initial Sapling Count `0` and submit | Rejected — initial count must be ≥ 1 |
| 3 | Set Initial Sapling Count `-10` | Rejected — must be > 0 |
| 4 | Set a Graft/Plant Date in the future (e.g. next month) and submit | Rejected or normalised to today (record which; note the accepted behavior) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-27: Stock Out / Mortality — record deaths and dispatch
- **Module:** Batches & Stock      **Priority:** P1
- **Roleplay:** You are Prakash. 8 saplings died of root rot and 10 went out in a direct bulk sale.
- **Preconditions:** Batch from TC-NRS-25 exists with current stock 200 (or current value N).
- **Test data:** Mortality 8; dispatch 10.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | In the batches table tap **Stock Out / Mortality** on the Kesar batch | Modal opens showing the batch and **"Current Remaining: N saplings"** |
| 2 | Enter Quantity to Deduct `8`, Reason = **mortality** ("Plant Mortality / Died"), Notes `Root rot after heavy rain` | Fields accepted |
| 3 | Tap submit | Modal closes; table shows Current Stock N−8, Mortality 8, survival % recalculated |
| 4 | Repeat with Quantity `10`, Reason = **dispatch** ("Direct Customer / Bulk Order Dispatch"), Notes `Walk-in bulk sale` | Stock N−18; mortality stays 8 |
| 5 | Check the Kesar plant card | Plant stock and mirror product stock both dropped by 18 in total |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-28: Stock-out negative — deduct more than remaining, missing reason
- **Module:** Batches & Stock      **Priority:** P1
- **Roleplay:** You are Prakash. You must not be able to deduct saplings you don't have.
- **Preconditions:** On `/nursery/batches`; Kesar batch has current stock R (e.g. 182).
- **Test data:** Quantity R+1; quantity 0; no reason.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Stock Out / Mortality**, enter Quantity `R+1` (e.g. 183) with Reason mortality, submit | Rejected with **422 INSUFFICIENT_STOCK** — message like "Batch has only R saplings remaining"; UI shows the field error |
| 2 | Enter Quantity `0` and submit | Rejected — quantity must be ≥ 1 |
| 3 | Enter Quantity `5` and leave Reason unselected, submit | Rejected — reason is required (mortality / dispatch / damaged / sample / internal_use) |
| 4 | Deduct exactly R (all remaining) with Reason `damaged` | Allowed; Current Stock becomes 0; plant stock floors at 0 (never negative) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-29: Stock alerts grid — low-stock species and high-mortality batches
- **Module:** Batches & Stock      **Priority:** P2
- **Roleplay:** You are Prakash. You check which species need attention.
- **Preconditions:** Chikoo stock 12 (low); Kesar batch has mortality 8 (< 10).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/nursery/batches` and read the alerts grid | **"Low-Stock Species (1)"** (amber) lists Chikoo; **"High Mortality Batches (0)"** (rose) shows none |
| 2 | Add mortality of 10+ to the Kesar batch (TC-NRS-27 flow, Reason mortality, qty enough to reach total mortality ≥ 10) | **"High Mortality Batches (1)"** now lists the Kesar batch |
| 3 | Read the batches table columns | Columns present: Batch Number, Plant/Species (+notes), Propagation Date, Nursery Bed, Initial Count, Current Stock, Mortality (+ survival %), action button |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 5 — Orders Received  *(inventory §3.3)*

Covers `/nursery/orders`: tabs and polling, order-card contents, the full lifecycle `placed → accepted → packed → dispatched → delivered` with buyer notifications at each step, illegal transitions, cancellation + stock restore, tax invoice with GST math, order details/timeline, and ⚠️ Gaps 4 & 6.

> The buyer side of every order case is run by the **second tester** (E-Market Customer / Farmer, see 07_cross_persona_e2e.md) and marked 🔄. Their purchase of your Kesar Mango saplings feeds this whole module.

### TC-NRS-30: Orders screen — tabs, 30-second polling and new-arrival banner
- **Module:** Orders Received      **Priority:** P1
- **Roleplay:** You are Prakash. You watch the Orders screen while the second tester buys from your shop.
- **Preconditions:** Logged in; second tester ready to place an order (🔄 TC-XP flows).
- **Test data:** Buyer orders 5 × Kesar Mango Grafted Sapling (₹175 each = ₹875).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open sidebar → **Orders Received** | `/nursery/orders` opens on **All Orders**; tabs visible: All Orders / New Orders (placed) / Accepted / Packed / Dispatched / Delivered |
| 2 | 🔄 Second tester: place a mall order containing 5 × Kesar Mango | Within ~30 seconds a **"1 new orders just received!"** banner appears at the top of your orders screen (polling picks it up) |
| 3 | Tap the ✕ on the banner | Banner dismisses; the order card itself remains in the list |
| 4 | Tap tab **New Orders (placed)** | The new order appears there with a **"New"** sparkles badge |
| 5 | Wait on the screen 30+ seconds with no new orders | Screen silently re-polls; no errors, no flicker |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-31: Order card shows all details
- **Module:** Orders Received      **Priority:** P1
- **Roleplay:** You are Prakash. You read the card to know what to pack.
- **Preconditions:** Order from TC-NRS-30 exists.
- **Test data:** Order of ₹875, UPI payment.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Read the order card fields | Order # (last 8 characters of the id), "New" sparkles badge, status pill **placed** (amber default), placed date |
| 2 | Check the payment and money rows | Payment method shown uppercase (e.g. **UPI**); ₹finalTotal ₹875; if the buyer used a coupon, the line **"Includes ₹X coupon discount"** appears |
| 3 | Check address and items | Delivery Address shows the buyer's address (Plot 7, Gangapur Road, Nashik); item lines show product # + Qty (5) |
| 4 | Confirm the order belongs to you | Order is visible because its `nurseryId` is your account — no other nursery's orders appear |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-32: Accept the order (placed → accepted) — buyer is notified
- **Module:** Orders Received      **Priority:** P0
- **Roleplay:** You are Prakash. You confirm you can fulfil the order.
- **Preconditions:** Order in status `placed`.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the placed order tap **Accept Order** | Button works; status pill changes to **accepted** |
| 2 | Read the order's event log (View Details, TC-NRS-42) | An event "accepted" with timestamp is appended to the order events |
| 3 | 🔄 Second tester: open **bell / notifications** | Buyer receives notification type `confirmed`: **"Order confirmed / ऑर्डर कन्फर्म हुआ — Your sapling order was accepted by the nursery"** with deep link `/dashboard/p/purchases` |
| 4 | Check the Orders card subtitle on home | "N awaiting dispatch" count updates (order no longer "placed") |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-33: Mark the order packed — buyer is notified
- **Module:** Orders Received      **Priority:** P1
- **Roleplay:** You are Prakash. You pack the saplings in ventilated cartons.
- **Preconditions:** Order in status `accepted`.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Mark as Packed** | Status pill changes to **packed** |
| 2 | 🔄 Second tester: open the bell | Buyer receives notification type `shipped`: **"Order packed / ऑर्डर पैक हुआ"** |
| 3 | Try to find "Mark as Packed" again | Button no longer shown — next allowed action is only **Dispatch Saplings** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-34: Dispatch with courier and tracking number — buyer is notified
- **Module:** Orders Received      **Priority:** P1
- **Roleplay:** You are Prakash. AgroExpress picks up the cartons; you add the consignment number.
- **Preconditions:** Order in status `packed`.
- **Test data:** Courier `AgroExpress Logistics`; tracking auto `TRK-######`; default handling notes.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Dispatch Saplings** | Modal opens: Courier/Transport Partner pre-filled **"AgroExpress Logistics"**, Tracking/Consignment Number auto-generated **TRK-######**, Dispatch Handling Notes pre-filled "Saplings packaged in ventilated cartons with root-ball moisture wrap" |
| 2 | Keep the defaults (or set Courier `AgroExpress Logistics`) and confirm | Status changes to **dispatched**; the order card now shows a courier/tracking row (courier + TRK number) |
| 3 | Clear the Tracking/Consignment Number and try to submit | Submit blocked — tracking number is required |
| 4 | 🔄 Second tester: open the bell | Buyer receives notification type `out_for_delivery`: **"Order out for delivery / ऑर्डर रवाना हुआ"** with the courier info |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-35: Mark delivered — P&L income entry and 5% platform commission
- **Module:** Orders Received      **Priority:** P0
- **Roleplay:** You are Prakash. The buyer confirms delivery; you check your earnings and the platform's cut.
- **Preconditions:** Order in status `dispatched`; order total ₹875.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Mark Delivered** | Status changes to **delivered**; the action buttons disappear |
| 2 | 🔄 Second tester: open the bell | Buyer receives notification type `delivered`: **"Order delivered / ऑर्डर पहुँच गया"** |
| 3 | Open **Finance CEO (P&L)** (`/nursery/finance`) | An automatic **income entry** of ₹875 exists, source `nursery_order_revenue` / `marketplace_order`, linked to this order id |
| 4 | Open **Earnings & Payouts** (`/nursery/payouts`) | **Gross Sales** rose by ₹875; **Platform Fee (5%)** shows ₹43.75 for this order; **Net Earnings** rose by ₹831.25 (95%) |
| 5 | 🔄 Cross-check with the buyer: what they paid | Buyer paid ₹875 (+ any delivery fee) — the full gross reached your ledger before the 5% commission; commission is deducted on your side only |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-36: Illegal status transitions are rejected
- **Module:** Orders Received (negative)      **Priority:** P1
- **Roleplay:** You are Prakash. You try to skip steps — the system must stop you.
- **Preconditions:** Fresh order in status `placed` (second tester places another 🔄, or reuse before accepting).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Try to push the `placed` order straight to delivered (via API `POST /nursery/orders/{id}/status` with `delivered`, or any UI shortcut) | Rejected: **422 INVALID_STATUS_TRANSITION** — message "cannot move order from placed to delivered"; UI never shows a Delivered button at this stage |
| 2 | Try moving `placed → packed` directly | Rejected with the same 422 |
| 3 | Try moving backwards, e.g. `accepted → placed` | Rejected — only forward transitions per the flow |
| 4 | Try the alias: send status `shipped` on a `packed` order | **Accepted** as an alias of `dispatched` (seller-hub vocabulary); order becomes dispatched |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-37: Cancel an order from "placed" — stock is restored and buyer is notified
- **Module:** Orders Received      **Priority:** P1
- **Roleplay:** You are Prakash. A storm damages your stock; you must cancel the new order you haven't accepted yet.
- **Preconditions:** Order in status `placed` (buyer orders 5 more Kesar 🔄); note current Kesar stock S (e.g. 285 after the FEFO batch decrement).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Note Kesar plant stock S on the inventory card | — |
| 2 | On the placed order tap **Cancel** (or the cancel action) and confirm | Status changes to **cancelled** |
| 3 | Check Kesar plant stock in inventory | Stock restored to S+5; mirror product stock restored; cancelled stock is added back |
| 4 | 🔄 Second tester: open the bell | Buyer receives notification type `cancelled`: **"Order cancelled / …any payment will be refunded"** |
| 5 | 🔄 Second tester: if the order was Razorpay-paid, check refund status | `refundStatus` = "requested" on a paid cancellation |
| 6 | Try further actions on the cancelled order | No Accept/Pack/Dispatch buttons remain |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-38: Cancel is refused from "dispatched" or "delivered"
- **Module:** Orders Received (negative)      **Priority:** P1
- **Roleplay:** You are Prakash. The cartons are already on the truck — cancellation must no longer be possible.
- **Preconditions:** Order in status `dispatched` (TC-NRS-34) and another already `delivered` (TC-NRS-35).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the dispatched order, look for a Cancel action | No Cancel button is offered |
| 2 | Send a cancel via API `POST /nursery/orders/{id}/status` with `cancelled` | Rejected: **422 INVALID_STATUS_TRANSITION** — cancel is allowed only from `placed`/`accepted` |
| 3 | Repeat on the delivered order | Same 422 rejection |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-39: ⚠️ Nursery-side cancel does NOT restore batch stock (buyer-side cancel does)
- **Module:** Orders Received (gap)      **Priority:** P1
- **Roleplay:** You are Prakash. You cancelled an accepted order and expect the batch ledger to stay consistent.
- **Preconditions:** Kesar batch has current stock B; order (qty 5) in status `accepted` — a batch was decremented FEFO-style when the buyer placed it.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Note the Kesar batch **Current Stock** B on `/nursery/batches` | — |
| 2 | Cancel the accepted order (allowed from accepted) | Order status becomes cancelled; plant/product stock +5 |
| 3 | Re-open `/nursery/batches` and read the batch Current Stock | **EXPECTED (correct behavior):** batch stock is also restored (B+5) so plant, product and batch numbers stay consistent |
| 4 | 🔄 Second tester: place an order, then cancel it from the buyer side (from `placed`/`paid`) | Buyer-side cancel DOES restore the oldest open batch (FEFO) — compare the two behaviours and record the asymmetry |

> ⚠️ **Known issue in current build — performing this case will likely FAIL; raise a defect.** Nursery-side cancellation restores `nursery_plants` and the mirror `products` stock but **not** the batch stock; only the buyer-side cancel in `orders.py` restores batches. Expected correct behavior: both cancel paths restore plant + product + batch stock symmetrically.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-40: Tax invoice modal — number, blocks and 5% GST math
- **Module:** Orders Received / Invoice      **Priority:** P0
- **Roleplay:** You are Prakash. You need a GST invoice for your accountant.
- **Preconditions:** A delivered order exists with finalTotal ₹875 (TC-NRS-35).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the delivered order tap **Tax Invoice** | Invoice modal opens: invoiceNumber **INV-NUR-XXXXXXXX** (last 8 chars of order id), a nursery block (Bhosale Fruit Nursery + address), a customer block (buyer + delivery address) |
| 2 | Read the amounts | **Taxable Subtotal** = 875 / 1.05 = **₹833.33**; **"CGST + SGST (5%)"** = 875 − 833.33 = **₹41.67**; **Total** = **₹875** (total is treated as tax-inclusive at 5%) |
| 3 | Tap **Print** | Browser print dialog opens with a clean invoice layout |
| 4 | Check the invoice for both parties | Invoice shows the same numbers you and the buyer see — the money trail matches |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-41: ⚠️ Invoice download is JSON-only — no PDF from the nursery endpoint
- **Module:** Orders Received / Invoice (gap)      **Priority:** P2
- **Roleplay:** You are Prakash. Your accountant wants a PDF, not a strange text file.
- **Preconditions:** A delivered order exists.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the order tap **Download Invoice** | A file downloads from `GET /nursery/orders/{id}/invoice` |
| 2 | Open the downloaded file | **EXPECTED (correct behavior):** a readable invoice document (PDF or at minimum a formatted HTML) that you can hand to the accountant |
| 3 | Observe the actual file today | It is a raw **JSON blob** — readable only by developers |

> ⚠️ **Known issue in current build — performing this case will likely FAIL; raise a defect.** The nursery-side invoice endpoint returns JSON only. (A separate PDF exists for buyers at `/orders/{id}/invoice.pdf` — the nursery needs an equivalent.) Expected correct behavior: PDF (or formatted) invoice download for the seller.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-42: View Details modal — items, buyer, courier and order timeline
- **Module:** Orders Received      **Priority:** P1
- **Roleplay:** You are Prakash. You check the full history of a dispatched order.
- **Preconditions:** Order went through accept → pack → dispatch (TC-NRS-32..34).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the order tap **View Details** | Details modal opens with item thumbnails (per-plant photos fetched), buyer address, payment method, courier + tracking number |
| 2 | Read the **Order Timeline** | Events are listed in reverse order (newest first): placed, accepted, packed, dispatched — each with status, timestamp and note; the dispatch event shows the tracking number and courier name |
| 3 | Close the modal | Back to the orders list; nothing changed |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-43: Another nursery's order is forbidden (403) — no permission leak
- **Module:** Orders Received (security)      **Priority:** P1
- **Roleplay:** You are Prakash. You must never see another nursery's orders.
- **Preconditions:** A second nursery account exists (or use API docs with a different token).
- **Test data:** Order id from TC-NRS-30.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | From the other account (or via API with another nursery's token) call `GET /nursery/orders/{your_order_id}` | **403 FORBIDDEN** — "this order does not belong to your nursery" |
| 2 | List orders as the other nursery (`GET /nursery/orders`) | Your order does not appear in their list |
| 3 | Try `POST /nursery/orders/{id}/status` as the other nursery | Rejected — they cannot move your order's status |
| 4 | While logged in as you, verify your list shows only your own orders | No foreign orders visible in the UI |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 6 — Reviews & Ratings  *(inventory §3.4)*

Covers `/nursery/ratings`: summary card, review cards with tags, and replying to a review (with the 500-char and already-replied limits).

### TC-NRS-44: Ratings summary and review cards
- **Module:** Reviews & Ratings      **Priority:** P1
- **Roleplay:** You are Prakash. A buyer rated your saplings; you read the review.
- **Preconditions:** 🔄 Second tester has rated the delivered order (5 stars, tags Healthy Plants + On-Time Delivery).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open sidebar → **Reviews & Ratings** | Summary card shows average (1 decimal), a 5-star breakdown row and the review count |
| 2 | Read the review card | Rater name, date, order #, product titles (Kesar Mango Grafted Sapling), 5 stars, the comment |
| 3 | Check the tag chips | Tags render as readable labels: HEALTHY_PLANTS → **"Healthy Plants"**, SECURE_PACKING/ON_TIME_DELIVERY → **"On-Time Delivery"** |
| 4 | Check order status shown on the card | Card shows the order's status (delivered) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-45: Reply to a review
- **Module:** Reviews & Ratings      **Priority:** P1
- **Roleplay:** You are Prakash. You thank the buyer politely.
- **Preconditions:** Review from TC-NRS-44 has no reply yet.
- **Test data:** Reply "Thank you! Happy planting — call us any time for grafting advice."

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Reply to this review →** | A textarea appears ("Write a polite thank-you reply…") with Cancel / **Post Reply** |
| 2 | Tap **Cancel** | Textarea closes; no reply saved |
| 3 | Open it again, type the reply text and tap **Post Reply** | Reply is saved; the card now shows your reply text with repliedAt timestamp instead of the reply button |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-46: Reply negatives — over 500 chars and double reply
- **Module:** Reviews & Ratings (negative)      **Priority:** P2
- **Roleplay:** You are Prakash. Your son tests the reply limits.
- **Preconditions:** Review already replied in TC-NRS-45; another unreplied review exists (second tester adds one 🔄, or use another card).
- **Test data:** 501-character text.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open reply on a fresh review and paste a 501-character text, tap Post Reply | Rejected — reply must be 1–500 characters |
| 2 | Try to reply again to the review already replied in TC-NRS-45 | Rejected — **409 ALREADY_REPLIED**; UI no longer offers the reply button |
| 3 | (API) have the *buyer* (not the rated party) try `POST /ratings/{rating_id}/reply` | **403** — only the rated party (you) can reply |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 7 — Offers & Discounts  *(inventory §3.5)*

Covers `/nursery/offers`: offer cards, the "Create Seasonal Offer" modal with its limits, removal/deactivation, coupon use at buyer checkout (🔄), and ⚠️ Gap 3 (usedCount not synced back).

### TC-NRS-47: Create a seasonal offer
- **Module:** Offers & Discounts      **Priority:** P1
- **Roleplay:** You are Prakash. Monsoon is planting season — you create a 15%-off coupon.
- **Preconditions:** On `/nursery/offers`.
- **Test data:** Coupon GREEN15, title "Monsoon Plantation Sale", 15%, min ₹500, cap ₹200, valid until +60 days.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Create Seasonal Offer** | Modal opens; Coupon Code field is auto-filled like **GREEN15** (auto `GREEN{2-digit}`), uppercased, placeholder MONSOON20 |
| 2 | Enter Offer Title `Monsoon Plantation Sale` | Title accepted |
| 3 | Set Discount % `15` (default 15), Min Order ₹ `500` (default 500), Cap Max ₹ `200` (default 200, min 10) | Values accepted; Valid Until defaults to today + 60 days |
| 4 | Set Valid Until to today + 60 days and confirm | Modal closes; new card appears: code chip **GREEN15** (mono font), pill **Active Coupon**, title, "15% OFF", "Min Order ₹500", "Max Discount ₹200", "Valid until" date, "Used: 0 times" |
| 5 | Verify registration in the shared coupons collection | 🔄 At buyer checkout, code GREEN15 is accepted (TC-NRS-50) — proving the offer registered in the shared `coupons` collection for all buyers |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-48: Offer form negative validations
- **Module:** Offers & Discounts (negative)      **Priority:** P1
- **Roleplay:** You are Prakash. Your son checks the offer limits.
- **Preconditions:** Create-offer modal open.
- **Test data:** Discount 0 / 95 / -5; cap 5; empty title.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Leave Offer Title empty and submit | Rejected — title required |
| 2 | Set Discount % `0` | Rejected — must be ≥ 1 |
| 3 | Set Discount % `95` | Rejected — must be ≤ 90 (server: `discountPct` > 0 and ≤ 90) |
| 4 | Set Discount % `-5` | Rejected |
| 5 | Set Cap Max ₹ `5` | Rejected — minimum ₹10 |
| 6 | Set Valid Until to yesterday | Rejected — a past date cannot be chosen / saved |
| 7 | Create a second offer with the SAME code GREEN15 (via API) | Record the behavior: the shared `coupons/{code}` doc is overwritten — no uniqueness guard exists (note it; a uniqueness check would be the correct behavior) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-49: Remove (deactivate) an offer
- **Module:** Offers & Discounts      **Priority:** P1
- **Roleplay:** You are Prakash. The sale ends; you deactivate the coupon.
- **Preconditions:** GREEN15 active (TC-NRS-47).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the GREEN15 card tap **Remove** | A confirm dialog appears |
| 2 | Cancel it | Card stays Active |
| 3 | Tap **Remove** again and confirm | Card pill changes to **Deactivated** (or the card is removed per UI design — record which); `DELETE /nursery/offers/{id}` succeeded |
| 4 | 🔄 Second tester: try code GREEN15 at checkout | **400 COUPON_INVALID** — the shared coupon is deactivated together with your offer (both docs set `active=false`) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-50: Buyer applies the coupon at checkout (min-order and cap enforced)
- **Module:** Offers & Discounts (cross-persona)      **Priority:** P1
- **Roleplay:** You are Prakash. Your coupon should work for any buyer, with rules.
- **Preconditions:** Offer active (re-create GREEN15 if removed in TC-NRS-49): 15%, min ₹500, cap ₹200.
- **Test data:** 🔄 Buyer cart: 5 × Kesar @ ₹175 = ₹875; and a small cart 2 × Chikoo @ ₹120 = ₹240.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Second tester: cart of ₹240, apply GREEN15 | **400 COUPON_INVALID** — below the ₹500 minimum |
| 2 | 🔄 Second tester: cart of ₹875, apply GREEN15 | Applied: 15% = ₹131.25 discount (under cap); final total ₹743.75; the order card later shows "Includes ₹131.25 coupon discount" |
| 3 | 🔄 Second tester: cart of ₹2,000, apply GREEN15 | Discount capped at **₹200** (not ₹300) |
| 4 | 🔄 Second tester: complete the order with the coupon | Order is placed and appears in your Orders screen with the discount line |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-51: ⚠️ "Used: N times" never updates after buyers use the coupon
- **Module:** Offers & Discounts (gap)      **Priority:** P2
- **Roleplay:** You are Prakash. You want to see how many buyers used your coupon.
- **Preconditions:** GREEN15 was used at least once in TC-NRS-50.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/nursery/offers` and read the GREEN15 card | **EXPECTED (correct behavior):** "Used: 1 times" (or more) after the checkout(s) in TC-NRS-50 |
| 2 | Observe the actual value today | It stays **"Used: 0 times"** — the shared coupon doc's `usedCount` increments at checkout, but the copy in `nursery_offers` is never updated |

> ⚠️ **Known issue in current build — performing this case will likely FAIL; raise a defect.** Offer `usedCount` is not synced back to the nursery offer card. Expected correct behavior: the card shows the real usage count.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 8 — Earnings & Payouts  *(inventory §3.6)*

Covers `/nursery/payouts`: the 4 KPI cards with 5% commission math, withdrawal modal with limits, the payout ledger with sandbox auto-processing, CSV export, and ⚠️ Gap 2 (no payout-status notification).

### TC-NRS-52: Payout KPI cards — gross, 5% fee, net 95%, available
- **Module:** Earnings & Payouts      **Priority:** P0
- **Roleplay:** You are Prakash. You verify your books: what you sold, what the platform took, what is yours.
- **Preconditions:** Delivered orders exist (TC-NRS-35, e.g. ₹875 gross; TC-NRS-50 order ₹743.75 gross).
- **Test data:** Gross G = sum of delivered order finalTotals (example: ₹1,618.75).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open sidebar → **Earnings & Payouts** | `/nursery/payouts` opens |
| 2 | Read the **Gross Sales** card | Equals G (delivered orders only) — ₹1,618.75 in the example |
| 3 | Read the **Platform Fee (5%)** card | Shows 5% of G = ₹80.94; subtitle mentions "Escrow & payment processing" |
| 4 | Read the **Net Earnings** card | Shows 95% of G = ₹1,537.81; subtitle "95% proceeds credited" |
| 5 | Read the **Available to Withdraw** card | Shows net − already-requested, floored at 0; "Instant UPI settlement" subtitle |
| 6 | Cross-check against Finance CEO (P&L) totals | P&L income entries match the delivered orders that produced G |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-53: Withdraw earnings to UPI (happy path)
- **Module:** Earnings & Payouts      **Priority:** P0
- **Roleplay:** You are Prakash. You withdraw ₹500 to your son's UPI.
- **Preconditions:** Available balance ≥ ₹500 (TC-NRS-52).
- **Test data:** Amount ₹500; UPI override `rohit.bhosale@okhdfc`; note "Monsoon withdrawal".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Withdraw Earnings** | Modal opens: **Available Balance** banner shows the available amount; Withdrawal Amount ₹ empty; Settlement UPI ID optional; Settlement Notes empty |
| 2 | Enter Withdrawal Amount ₹ `500`, Settlement UPI ID `rohit.bhosale@okhdfc`, Notes `Monsoon withdrawal` | Fields accepted |
| 3 | Confirm the request | Modal closes; a new row appears in the payout ledger: Payout ID, Amount ₹500, Destination UPI `rohit.bhosale@okhdfc`, Status pill, Initiated At timestamp |
| 4 | Check the Available to Withdraw card | Dropped by ₹500 |
| 5 | Leave the UPI override empty and request ₹100 in a second withdrawal | Second ledger row uses your profile UPI `prakash.bhosale@okaxis` (request override → profile `settlementUpi` → fallback `nursery@upi`) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-54: Withdrawal negative cases — below ₹100, above available
- **Module:** Earnings & Payouts (negative)      **Priority:** P1
- **Roleplay:** You are Prakash. You cannot withdraw money you don't have.
- **Preconditions:** Available balance A known (e.g. ₹1,037.81 after TC-NRS-53).
- **Test data:** ₹99; A+1; ₹0.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Withdraw Earnings, enter ₹ `99` | Rejected — UI minimum is ₹100 |
| 2 | Enter ₹ `0` or leave empty | Submit blocked (UI disables submit when amount ≤ 0 or > available) |
| 3 | Enter ₹ `A+1` (more than available) | Rejected — **422 INSUFFICIENT_BALANCE** with fieldError `{"amount": "available balance is ₹A"}`; UI shows the error on the amount field |
| 4 | Set Available to 0 scenario (withdraw everything via API if needed) and check the button | **Withdraw Earnings** button is disabled when available ≤ 0 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-55: Payout ledger statuses and sandbox auto-processing
- **Module:** Earnings & Payouts      **Priority:** P1
- **Roleplay:** You are Prakash. You confirm the withdrawal actually got processed.
- **Preconditions:** Withdrawals from TC-NRS-53 exist; no Razorpay key configured (sandbox).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the payout ledger | Each row shows Payout ID, Amount, Destination UPI, Status pill, Initiated At |
| 2 | Check the status pill of the TC-NRS-53 requests | In sandbox (no Razorpay key) the status auto-becomes **"processed"**; with a real key it would stay "pending" until processed |
| 3 | Check the ledger math | requested = sum of pending+processed+completed rows; withdrawn = sum of processed+completed; available = max(0, net − requested) — matches the KPI cards |
| 4 | Check the unified payments ledger | The payout rows also appear in your general payment history (`payments` ledger integration) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-56: Export the payout ledger as CSV
- **Module:** Earnings & Payouts      **Priority:** P2
- **Roleplay:** You are Prakash. You download the ledger for your accountant.
- **Preconditions:** Ledger has ≥ 2 rows.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Export CSV** | Browser opens/downloads `/v1/nursery/payouts/export` |
| 2 | Open the downloaded CSV | Header row: PayoutID, Amount, Status, UPI, Date; one data row per ledger entry; amounts and UPIs match the screen |
| 3 | Compare row count | CSV row count = ledger row count |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-57: ⚠️ No notification when payout status changes
- **Module:** Earnings & Payouts (gap)      **Priority:** P2
- **Roleplay:** You are Prakash. You expect a bell ping when your payout is processed.
- **Preconditions:** A payout in "pending" exists (or sandbox processes one during TC-NRS-55).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Wait for (or trigger) a payout status change to processed | — |
| 2 | Open the **bell / notifications** | **EXPECTED (correct behavior):** a notification like "Your payout of ₹500 was processed to rohit.bhosale@okhdfc" |
| 3 | Observe the actual behavior today | Nothing arrives — the only way to know is to keep opening the Payouts screen |

> ⚠️ **Known issue in current build — performing this case will likely FAIL; raise a defect.** No notification code exists for payout status changes. Expected correct behavior: a payout-status notification in the bell.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 9 — AI Analysis  *(inventory §3.7)*

Covers `/nursery/ai`: rendering-only assertions, because every value on this screen is a hardcoded fixture.

### TC-NRS-58: ⚠️ AI Analysis cockpit renders all sections (static fixtures — assert rendering only)
- **Module:** AI Analysis      **Priority:** P2
- **Roleplay:** You are Prakash. You look at the AI suggestions before planning your grafting calendar.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open sidebar → **AI Analysis & Forecast** (`/nursery/ai`) | Screen loads without errors |
| 2 | Read the seasonal banner | Shows **"Pre-Monsoon / Planting Season"** with trend summary mentioning the **4.5×** surge for Teak/Bamboo/Malabar Neem |
| 3 | Read the sales forecast cards | Three cards — Next **30 Days** (1250 units, ₹95,000, confidence 88%), **60 Days** (2800 units, ₹2,10,000, 84%), **90 Days** (4200 units, ₹3,20,000, 79%) |
| 4 | Read the Top Sourcing Categories bars | Fruit Saplings **42%**, Timber/Agroforestry **35%**, Medicinal & Herbal **14%**, Ornamental & Flowering **9%** — bars render proportionally |
| 5 | Read the AI Dynamic Pricing rows | Rows show species, action text and Your Price / Market Average / Suggested — e.g. Kesar Mango Grafted **180 → 195** (market 210), Malabar Neem **45 → 42**, Sandalwood **320 → 350** |
| 6 | Read the Propagation & Stock Planning cards | Cards render with urgency badges **High / Medium / Normal** |

> ⚠️ **Known issue / design constraint in current build — assert rendering only, not values' freshness; note it in your report.** All AI insights are hardcoded static fixtures (no ML backend): the same numbers appear regardless of your actual catalogue or sales. Expected correct behavior: values computed from real nursery data. Do NOT fail this case for "wrong numbers" — fail only if a section fails to render.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 10 — Nursery Care Diary  *(inventory §3.8)*

Covers `/nursery/diary`: summary cards, the log list, the "Add Diary Entry" modal (3 entry types), validation, and CSV export.

### TC-NRS-59: Diary list and summary cards
- **Module:** Nursery Diary      **Priority:** P2
- **Roleplay:** You are Prakash. You keep your daily nursery log.
- **Preconditions:** At least one entry exists (TC-NRS-60).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open sidebar → **Nursery Care Diary** | `/nursery/diary` opens |
| 2 | Read the summary cards | **Total Care Activities**, **Nursery Expenses ₹**, **Direct Shop Income ₹** — totals match the entries below |
| 3 | Read the log list | Each entry shows title, category chip (plant_care/watering/grafting/potting/sapling_sale), notes, date, and ±₹ amount in green (income) or red (expense) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-60: Add diary entries of all three types
- **Module:** Nursery Diary      **Priority:** P1
- **Roleplay:** You are Prakash. You log today's watering (no money), fertilizer expense and a direct shop sale.
- **Preconditions:** On `/nursery/diary`.
- **Test data:** Titles "Morning watering", "Neem cake purchase ₹450", "Walk-in sapling sale ₹1,200".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Add Diary Entry** | Modal opens: Activity Title*, Category select (plant_care / watering / grafting / potting / sapling_sale), Type select (Care Activity (No ₹) / Expense (Input/Labor) / Income (Sale)), Amount ₹, Date* (default today), Observation Notes |
| 2 | Enter Title `Morning watering`, Category **watering**, Type **Care Activity (No ₹)**, Notes "All beds" | Amount field is hidden for care activities |
| 3 | Save | Entry appears in the list with a category chip and **no ₹ amount** |
| 4 | Add Title `Neem cake purchase`, Category **plant_care**, Type **Expense (Input/Labor)**, Amount ₹ `450` | Amount required and accepted; saved as an expense (red −₹450) |
| 5 | Add Title `Walk-in sapling sale`, Category **sapling_sale**, Type **Income (Sale)**, Amount ₹ `1200` | Saved as income (green +₹1,200) |
| 6 | Check the summary cards | Expenses card includes ₹450; Direct Shop Income includes ₹1,200; activities count = 3 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-61: Diary negative validation and CSV export
- **Module:** Nursery Diary (negative)      **Priority:** P2
- **Roleplay:** You are Prakash. Your son checks the diary form and downloads the report.
- **Preconditions:** On `/nursery/diary`.
- **Test data:** Amount 0 for expense.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Add Diary Entry, leave Title empty, submit | Rejected — Activity Title is required |
| 2 | Set Type **Expense**, Amount ₹ `0`, submit | Rejected — amount must be ≥ 1 for expense/income entries |
| 3 | Set a future Date and submit | Rejected or normalised to today (record the behavior) |
| 4 | Tap **Export CSV** | `GET /diary/report.csv` downloads; CSV contains your 3 entries with dates, categories and amounts |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 11 — AI Chatbot  *(inventory §3.9)*

Covers `/nursery/chatbot`: greeting, quick-suggestion chips, Q&A with nursery context, and the error fallback.

### TC-NRS-62: Chatbot greeting and quick-suggestion chips
- **Module:** AI Chatbot      **Priority:** P2
- **Roleplay:** You are Prakash. You ask the horticulture assistant about root rot.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open sidebar → **Chatbot Support** (`/nursery/chatbot`) | Chat UI opens with greeting **"नमस्ते! I am your AI Horticulture & Nursery Assistant…"** |
| 2 | Count the quick-suggestion chips | 5 chips: root rot prevention, NHB accreditation, potting mix, courier packaging for grafts, Kesar Mango grafting season |
| 3 | Tap the chip **root rot prevention** | The question is sent and an answer about root rot appears in the chat |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-63: Ask a typed question and observe the error fallback
- **Module:** AI Chatbot      **Priority:** P2
- **Roleplay:** You are Prakash. You type your own question; even if the bot is down you expect a polite fallback.
- **Preconditions:** On `/nursery/chatbot`.
- **Test data:** Question "When should I graft Kesar mango in Nashik?"

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Type `When should I graft Kesar mango in Nashik?` and send | An `answer`/`reply` renders in the chat (sent with context `nursery`) |
| 2 | (If you can force an error) disconnect the network or make the request fail, then send any message | A static fallback horticulture message is shown instead of a crash/blank screen; the chat UI stays usable |
| 3 | Send a second question | Conversation continues; earlier messages remain |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 12 — Shared Ecosystem Modules reachable as Nursery  *(inventory §3.10)*

Covers the screens a nursery can also open: buying in the mall, the P&L dashboard, Ad Manager, learning/news, coins, referrals, tree hub, 7/12 records and Settings. These are shared modules — test them from the nursery persona for access and persona-appropriate rendering.

### TC-NRS-64: Nursery buys from the E-Market (shop as a buyer)
- **Module:** Ecosystem — E-Market Shopping      **Priority:** P1
- **Roleplay:** You are Prakash. You buy pots and fertilizer for your own nursery from another seller.
- **Preconditions:** Logged in; shop has listings from other sellers.
- **Test data:** 🔄 Order 1 item (e.g. a grow bag) worth ₹300, pay UPI.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open sidebar → **Ecosystem & Utilities** → **E-Market Shopping** (`/nursery/shop`) | Krishi Mall (customer view) opens; you can browse as a buyer |
| 2 | 🔄 Add an item to cart and check out with your own delivery address (Plot 7, Gangapur Road, Nashik) | Order placed successfully — nursery role is in `MARKET_ROLES`, so buying is allowed |
| 3 | Check your purchases (`/dashboard/p/purchases`) | The order appears there with order-status notifications as it moves |
| 4 | Confirm the seller side got it | 🔄 The seller sees your order (link back to 07_cross_persona_e2e.md) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-65: Finance CEO (P&L) dashboard
- **Module:** Ecosystem — Finance CEO (P&L)      **Priority:** P1
- **Roleplay:** You are Prakash. You review the month's profit & loss.
- **Preconditions:** Delivered order (TC-NRS-35), diary expense ₹450 and income ₹1,200 (TC-NRS-60) exist.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open sidebar → **Growth & Business** → **Finance CEO (P&L)** (`/nursery/finance`) | P&L dashboard opens |
| 2 | Check income entries | Includes the auto-posted nursery order revenue ₹875 (TC-NRS-35) and the diary income ₹1,200 |
| 3 | Check expense entries | Includes the diary expense ₹450 |
| 4 | Check the summary math | Net profit = income − expense renders consistently with the ledger entries |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-66: Ad Manager — create, view and delete a campaign
- **Module:** Ecosystem — Ad Manager      **Priority:** P2
- **Roleplay:** You are Prakash. You run a small ad for your Kesar saplings before monsoon.
- **Preconditions:** Kesar plant listed.
- **Test data:** Campaign promoting "Kesar Mango Grafted Sapling", budget ₹500, 7 days.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open sidebar → **Growth & Business** → **Ad Manager** (`/nursery/ads`) | Ad Manager opens with your campaigns list (`GET /ads/mine`) |
| 2 | Create a new campaign for Kesar Mango with budget ₹500 and 7-day duration | Campaign is created (`POST /ads`) and appears in the list |
| 3 | Open the campaign's analytics | Impression/click counters render (counters may be 0 on a fresh campaign — that is fine) |
| 4 | Edit the campaign (change duration) then delete it | `PUT /ads/{id}` then `DELETE /ads/{id}` succeed; campaign disappears from the list |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-67: Gyansetu learning and Agri news feed
- **Module:** Ecosystem — Learning & News      **Priority:** P2
- **Roleplay:** You are Prakash. Your son watches a grafting course and reads agri news.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Gyansetu Learning** (`/nursery/gyan`) | Course catalog loads; at least one course card shows with title and thumbnail |
| 2 | Open a course | Course detail/content renders without errors |
| 3 | Open **Agri News Feed** (`/nursery/news`) | News channel list loads; opening a channel shows news items |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-68: Krushi Ratna coin wallet and Refer & Earn
- **Module:** Ecosystem — Coins & Referrals      **Priority:** P2
- **Roleplay:** You are Prakash. You check your coin balance and your referral code.
- **Preconditions:** Logged in; the platform has granted some coins (welcome/rewards) or coins were earned.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Coin Rewards Wallet** (`/nursery/coins`) | Krushi Ratna wallet opens with balance and earn/redeem history; 1 coin = ₹1 note is visible where redemption is described |
| 2 | (Context only) note that buyers can redeem coins at checkout | Coins redeemed by a buyer offset even nursery-product orders (🔄 see 07_cross_persona_e2e.md; **422 COINS_INSUFFICIENT** when balance is too low) |
| 3 | Open **Refer & Earn** (`/nursery/referrals`) | Your referral code/link is shown; the screen explains the reward terms without errors |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-69: ⚠️ Tree Plantation Hub — sapling requests go to NGOs, not to nurseries
- **Module:** Ecosystem — Tree Hub (gap)      **Priority:** P2
- **Roleplay:** You are Prakash. You expect plantation requests for saplings to reach nursery owners like you.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Tree Plantation Hub** (`/nursery/trees`) | The hub opens (nursery has access to this farmer-facing module) |
| 2 | Look for any flow where a farmer's tree-plantation/sapling request reaches a nursery | **EXPECTED (correct behavior):** plantation sapling requests are routed to nursery sellers (the people who actually stock saplings) OR the hub explicitly documents who fulfils them |
| 3 | Observe the actual behavior | Sapling requests go **only to NGOs** — no plantation-order → nursery linkage exists in `tree.py` (viewer roles exclude nursery) |

> ⚠️ **Known issue/design gap in current build — record as a product gap.** No plantation-order → nursery linkage exists; nurseries cannot receive sapling demand from the Tree Hub. Expected correct behavior (product decision needed): route sapling requests to nearby nurseries or document NGO-only fulfilment.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-70: 7/12 land records
- **Module:** Ecosystem — 7/12 Records      **Priority:** P2
- **Roleplay:** You are Prakash. You look up your own farm land record.
- **Preconditions:** Logged in.
- **Test data:** District Nashik, village Ozar, survey/gat number 112.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open sidebar → **7/12 Land Records** (`/nursery/land-records` — also reachable via redirect `/nursery/712`) | Land Records view opens |
| 2 | Search your record: District `Nashik`, Village `Ozar`, Gat/Survey No `112` | The record view renders (data depends on the demo backend — record whether a sample record or an empty state appears) |
| 3 | Open the record | Details render or a clear "no record" state shows without errors |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-71: Settings page (profile, security, notifications, language)
- **Module:** Ecosystem — Settings      **Priority:** P1
- **Roleplay:** You are Prakash. You review account settings.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Settings** (`/nursery/settings`) | Settings page opens |
| 2 | Open profile section | Your account details (name, phone, email) are shown and editable where allowed |
| 3 | Open security/MPIN | MPIN set/reset options present (MPIN reset is OTP-gated) |
| 4 | Open notification preferences | Preferences per category/channel and quiet-hours render (digest infra exists in the backend) |
| 5 | Find the **language toggle** (English / हिन्दी) | Toggle is present — used in TC-NRS-72/73 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 13 — Language, Notifications & Cross-Persona E2E  *(inventory §4, §5, §6)*

Covers the हिन्दी runs, the nursery-side notification check for new orders, buyer-side checkout guards that hit nursery products, and directory visibility.

### TC-NRS-72: हिन्दी run — complete the core order flow in Hindi
- **Module:** Language / Orders E2E      **Priority:** P1
- **Roleplay:** You are Prakash. You run your whole day in हिन्दी to make sure your son can use it.
- **Preconditions:** A fresh order is placed by the second tester 🔄 (or place one in Hindi as buyer first).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Switch language to **हिन्दी** (Settings or navbar toggle) | Whole UI re-renders in Hindi; no English placeholders left on the nursery home |
| 2 | Open **Orders Received** | Tabs, buttons and status pills are in Hindi and labels do not overflow/cut off |
| 3 | Run the lifecycle on the fresh order: Accept → Pack → Dispatch → Deliver | Every button is understandable in Hindi; each step succeeds exactly as in English (TC-NRS-32..35) |
| 4 | 🔄 Second tester: check the buyer notifications | Buyer receives the bilingual pushes (e.g. "Order confirmed / ऑर्डर कन्फर्म हुआ … accepted by the nursery") |
| 5 | Check money screens in Hindi | Earnings & Payouts and the invoice render in Hindi with correct ₹ values |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-73: हिन्दी run — onboarding and profile labels in Hindi
- **Module:** Language / Profile-KYC      **Priority:** P2
- **Roleplay:** You are Prakash. You verify the KYC form in Hindi too.
- **Preconditions:** Language = हिन्दी.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Profile & Shop KYC** | All 5 section titles and field labels render in Hindi without overflow |
| 2 | Re-check the badge and specialization chips | Badge and chips render in Hindi (or acceptable transliteration); fruit/timber chips still toggle correctly |
| 3 | Save without changes | Success banner appears in Hindi; values unchanged |
| 4 | Switch back to **English** | UI returns to English fully — no mixed-language leftovers |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-74: New-order notification arrives in the nursery's bell
- **Module:** Notifications      **Priority:** P1
- **Roleplay:** You are Prakash. The moment a buyer orders, your bell must ring.
- **Preconditions:** Bell empty; second tester ready 🔄.
- **Test data:** 🔄 Buyer order: 6 × Kesar Mango, payment UPI.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Keep `/nursery/orders` open (or anywhere in the nursery area) | — |
| 2 | 🔄 Second tester places the order | Order appears in your list (TC-NRS-30 behavior) |
| 3 | Open the **bell / notifications** | Notification titled **"New order {order_id}"** with body **"You received a new Krishi Mall order (UPI) for 1 item(s). Pack and confirm it from your seller dashboard."** (deep link `/dashboard/p/seller/orders`) |
| 4 | Tap the notification | You are taken to your orders/purchases dashboard area |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-75: Buyer-side checkout guards on nursery products
- **Module:** Cross-persona (guards)      **Priority:** P1
- **Roleplay:** You are Prakash. You verify the mall protects your stock and rules.
- **Preconditions:** Kesar stock S is low (arrange S = 3 via TC-NRS-27/28 flows, or a fresh plant with stock 3); GREEN15 active with min ₹500.
- **Test data:** 🔄 Buyer carts: 5 items with stock 3; below-min-order cart; expired/invalid code.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Second tester: try to buy 5 × Kesar when stock is 3 | Checkout fails with **409 OUT_OF_STOCK** ("only 3 left"); no order created; your stock unchanged |
| 2 | Restore stock; 🔄 second tester buys 3 × Kesar (at or above Min Order Qty 5 → use another route) and 2 × Kesar | 2 < Min Order Qty 5 → **422 MIN_ORDER_QTY** |
| 3 | 🔄 Second tester: apply an expired/wrong code at checkout | **400 COUPON_INVALID** with the reject reason (expired/inactive/min-order from `coupon_reject_reason`) |
| 4 | 🔄 Second tester: try to deliver to an address not in their address book | **404 ADDRESS_NOT_FOUND** — address ownership enforced |
| 5 | After the successful 3-item order, check your side | Stock decremented in plant + product + oldest open batch (FEFO); order appears in your Orders screen |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-NRS-76: Nursery visible in the mobile nursery directory (buyer discovery)
- **Module:** Cross-persona (directory)      **Priority:** P2
- **Roleplay:** You are Prakash. A farmer 30 km away finds your nursery in the app directory.
- **Preconditions:** KYC data complete; plants listed.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Second tester: open the **mobile app's nursery directory** (`GET /livestock/nurseries`) | List loads, distance-sorted |
| 2 | Find **Bhosale Fruit Nursery** | Card shows rating (from `provider_rating_fields`), `availableSaplings`, price range min/max, `isGovtCertified` |
| 3 | Tap **Call** on your card | Phone dialer opens with your nursery phone |
| 4 | Confirm the data source | Your Kesar rating appears in the directory aggregate after the buyer rating in TC-NRS-44 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

## 4. Module coverage matrix

| Module (inventory) | Cases (IDs) | Count |
|---|---|---:|
| §1 Role Registration & Onboarding + Profile/KYC | TC-NRS-01 … TC-NRS-12 | 12 |
| §2 Home / Dashboard | TC-NRS-13 … TC-NRS-17 | 5 |
| §3.1 Plant Inventory | TC-NRS-18 … TC-NRS-24 | 7 |
| §3.2 Batches & Stock In/Out | TC-NRS-25 … TC-NRS-29 | 5 |
| §3.3 Orders Received (lifecycle, invoice, cancel) | TC-NRS-30 … TC-NRS-43 | 14 |
| §3.4 Reviews & Ratings | TC-NRS-44 … TC-NRS-46 | 3 |
| §3.5 Offers & Discounts | TC-NRS-47 … TC-NRS-51 | 5 |
| §3.6 Earnings & Payouts | TC-NRS-52 … TC-NRS-57 | 6 |
| §3.7 AI Analysis | TC-NRS-58 | 1 |
| §3.8 Nursery Diary | TC-NRS-59 … TC-NRS-61 | 3 |
| §3.9 AI Chatbot | TC-NRS-62 … TC-NRS-63 | 2 |
| §3.10 Shared ecosystem modules (shop, P&L, ads, gyan, news, coins, referrals, trees, 7/12, settings) | TC-NRS-64 … TC-NRS-71 | 8 |
| §4/§5/§6 Cross-persona, money & notifications (हिन्दी runs, bell, checkout guards, directory) | TC-NRS-72 … TC-NRS-76 | 5 |
| **Total** | **TC-NRS-01 … TC-NRS-76** | **76** |

**Gap coverage check (all 7 inventory gaps have an explicit ⚠️ case):**

| # | Gap | ⚠️ Case |
|---|---|---|
| 1 | No admin approve-nursery endpoint | TC-NRS-10 |
| 2 | No notification on payout status / KYC rejection / plant moderation | TC-NRS-12, TC-NRS-57 |
| 3 | Offer `usedCount` not synced to nursery card | TC-NRS-51 |
| 4 | Cancel stock-restore asymmetry (batch not restored nursery-side) | TC-NRS-39 |
| 5 | `GET /nursery/plants?status=` filter without UI | TC-NRS-24 |
| 6 | Invoice JSON-only (no PDF) from nursery endpoint | TC-NRS-41 |
| 7 | AI insights are static fixtures | TC-NRS-58 |
| (extra) | Tree-plantation sapling requests go to NGOs, not nurseries | TC-NRS-69 |

## 5. Sign-off

| Item | Value |
|---|---|
| Total cases | 76 |
| P0 | 11 (TC-NRS-01, 03, 05, 06, 10, 19, 32, 35, 40, 52, 53) |
| P1 | 42 |
| P2 | 23 |
| Pass | ____ |
| Fail | ____ (each Fail = one defect per README §5) |

| Signature | Name | Date |
|---|---|---|
| Tester (Nursery persona) | ______________ | 2026-10-__ |
| Second tester (buyer side) | ______________ | 2026-10-__ |
| Tester C (Admin actions) | ______________ | 2026-10-__ |

> **Release gate (README §7):** all P0 pass, ≥ 95% P1 pass, zero open Blocker defects. The 9 ⚠️ gap cases (TC-NRS-10, 12, 24, 39, 41, 51, 57, 58, 69 — covering the 7 known gaps) are expected to fail — they are documented defects, not release blockers by themselves, but must be listed in the known-issues register.
