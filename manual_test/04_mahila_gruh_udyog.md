# Mahila Graha Udyog (Women Home-Enterprise / SHG) — Manual Test Script (Final UAT)

> This script is for **Tester B**, roleplaying **Sunita Patil** — a 36-year-old SHG leader from a Nashik village. It contains **79 test cases** across **11 modules** covering registration, the SHG savings ledger, join requests, the interest-free loan fund, kitchen garden, backyard livestock, the home-enterprise tracker, the Gruh Udyog product studio, payouts, AI insights and cross-persona hand-offs. Estimated time: **one full working day (~6–7 hours)** for the solo cases, plus **one shared 60–90 minute slot** with Tester A (E-Market Customer) and Tester C (Admin) for the 🔄 cross-persona cases.

## 0. Roleplay card

| Field | Value |
|-------|-------|
| Name | Sunita Patil |
| Age | 36 |
| Background | Leads **"Mauli SHG"** — 10 women in Pimpalgaon Baswant (Nashik district) who make papad, pickle and masala. Also runs a kitchen garden and keeps a goat and poultry. The group maintains a monthly savings corpus. |
| Language | Marathi speaker; prefers हिन्दी — run the app in हिन्दी wherever the toggle exists (see TC-MGU-07 and TC-MGU-78) |
| Device | One Android phone with the Flutter app **and** a desktop/laptop browser (most women-Shg screens are website-only; mobile is read-only + deposit only) |
| Goal for this test | Prove that Sunita can register as *Mahila Gruh Udyog & SHG*, create her SHG, collect monthly deposits, give an interest-free loan, plan her kitchen garden, see livestock vaccination alerts, register a Gruh Udyog unit, sell products on the Krishi Mall, fulfil a customer order, and receive a payout — and that every rupee and every notification is correct on **both** sides. |
| Linked personas | **E-Market Customer** (Tester A) buys Sunita's mall products; **second womenShg member "Asha Jadhav"** (Tester B's second account) requests to join Mauli SHG; **Admin / SOP desk** (Tester C) verifies the SHG and certifications and disburses a subsidy; **Vet / livestock module** (farmer surface) registers the vaccinations that drive Sunita's alerts; **Farmer** persona can reuse the same account for all women endpoints. |

## 1. Account & test data setup

Do these steps **before** starting the test cases. Keep one phone number = one account for the whole run.

1. Confirm the environment per the main README §3: backend `/health` OK, website and super-admin open, mobile app builds on your test device, and dev payout mode is on (RazorpayX auto-processes when keys are unset).
2. On the **website** (`Register` page), create Sunita's account: phone **+91 98220 11101**, full name **Sunita Patil**, persona **"Mahila Gruh Udyog & SHG" (womenShg)**, state **Maharashtra**, district **Nashik**, village **Pimpalgaon Baswant**, language **English**, MPIN **2468** (record it — there is no SMS OTP; the MPIN is the only login credential).
3. Log in to the **mobile app** with the same phone + MPIN 2468 and confirm the app opens in normal (farmer-style) mode.
4. Create a **second womenShg account** for the join-request flows: **Asha Jadhav**, phone **+91 98220 11102**, MPIN **1357**, village **Koregaon**, district **Satara** (a different village so directory search can be filtered).
5. Tester C opens the **super-admin web panel** and stays ready for **[ADMIN]** steps (SHG verify, certification review, subsidy, cron trigger).
6. Tester A confirms an **E-Market Customer** account is ready to place a mall order (see `06_emarket_customer.md`).
7. Keep the test bank/UPI details below at hand for payout cases.

| Test data item | Concrete value |
|----------------|----------------|
| Sunita — phone / MPIN | +91 98220 11101 / 2468 |
| Asha (member) — phone / MPIN | +91 98220 11102 / 1357 |
| SHG name | Mauli SHG |
| SHG village / district | Pimpalgaon Baswant / Nashik (use Koregaon / Satara only to test directory filters) |
| Monthly contribution | ₹500 (default; backend minimum ₹50) |
| Loan test values | ₹2,000, tenure 6 months, purpose "Seeds and school fees" |
| Gruh Udyog unit name | Mauli Gruh Udyog (vernacular: मौली गृह उद्योग) |
| Gruh products | Methi Papad 200g · Goda Masala 100g · Lime Pickle 500g · Handwoven Basket (non-food) |
| Product prices | Papad MRP ₹80 / selling ₹70 / stock 20 · Masala MRP ₹120 / selling ₹110 / stock 15 · Pickle MRP ₹150 / selling ₹140 / stock 10 · Basket MRP ₹250 / selling ₹250 / stock 5 |
| FSSAI certificate | Number 11523998000247, issuing authority "FSSAI Mumbai", valid until 2027-12-31 |
| Batch | Production date 2026-10-01, expiry 2026-12-30, qty 10 (batch no auto "GU-…") |
| Offer | Title "Diwali Offer", 10% off, valid 2026-10-20 → 2026-11-15 |
| Test bank account | SBI test account 12345678901, IFSC SBIN0001234 (payout flows) |
| Test UPI | sunita.mauli@okaxis (role-profile field; payouts use the bank account) |
| Kitchen garden picks | पालक/Spinach 45d, मेथी/Fenugreek 30d, टमाटर/Tomato 90d, custom "Curry chilli" |
| Livestock | 1 goat ("Babli"), 6 hens — registered by the vet/farmer surface before TC-MGU-42 |
| Wrong-MPIN probe | 9999 |

## 2. Preconditions checklist

Check all boxes before starting. Re-check after any backend redeploy.

- [ ] Backend running; `GET http://<host>:8000/health` returns OK.
- [ ] Website loads; `Register`, `/community/women` (Women hub) and `/women/directory` open.
- [ ] Super-admin panel opens (Tester C).
- [ ] Mobile app installed on Tester's device; can log in with phone + MPIN.
- [ ] Sunita's account (`womenShg` role) registered and logged in on **both** website and mobile.
- [ ] Asha's second `womenShg` account registered.
- [ ] Tester A's E-Market Customer account ready.
- [ ] Test bank account details available; RazorpayX in dev auto-process mode.
- [ ] Notifications: run tests **outside quiet hours 21:00–06:30**, or temporarily disable quiet hours in notification preferences, so push/in-app notifications arrive immediately.
- [ ] A goat + hens exist in the livestock module with a vaccination due within 30 days (ask the vet-surface owner / dev team to seed `vaccination_schedules`).
- [ ] Camera/photo file ready on the device for product and certificate upload tests.
- [ ] Postman or `curl` available for the ⚠️ API-only cases (meetings, home-enterprise, batch addToStock, withdraw) — there is deliberately no UI for them.

## 3. Test cases

---

### Module 1 — Role registration & onboarding

*Covers: website 3-step register wizard, the "Mahila Gruh Udyog & SHG" role card, MPIN login (no SMS OTP), the shared women/farmer role profile, bank accounts, and language selection.*

### TC-MGU-01: Register a new womenShg account on the website
- **Module:** 1. Role registration & onboarding      **Priority:** P0
- **Roleplay:** You are Sunita. You have heard Agrovercity helps SHG women sell papad and save together. Create your account.
- **Preconditions:** Website open; Sunita's phone not registered yet; preconditions checklist done.
- **Test data:** Phone 98220 11101, MPIN 2468, name Sunita Patil, Maharashtra / Nashik / Pimpalgaon Baswant.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the website and tap **Register** / **Sign up** | The 3-step wizard opens at step **"1. Set MPIN"** |
| 2 | Enter MPIN **2468** and confirm MPIN **2468** | Message **"PINs Match!"** appears; **Next** is enabled |
| 3 | Continue to step **"2. Choose Role"** | Role picker shows 11 role cards |
| 4 | Find the card titled **"Mahila Gruh Udyog & SHG"** | Card shows 🪔 icon, native title **"महिला गृह उद्योग"**, badge **"Women Enterprise"**, description mentioning cottage food products, pickles, SHG monthly savings and Micro-Mudras |
| 5 | Tap the womenShg card | Card is selected; no extra sub-flow or extra questions appear |
| 6 | Continue to step **"3. Profile Details"** | Form shows phone (with +91 prefix), full name, persona (pre-filled womenShg), state (default **Maharashtra**), district (default **Nashik**), village (default **Pimpalgaon Baswant**), language |
| 7 | Enter phone **9822011101**, name **Sunita Patil**; verify a **Farm Size (acres)** field is NOT shown | All fields accept input; no farm-acres field (it is farmer-only) |
| 8 | Select language **English** and tap **Finish** / complete | Account is created; app navigates to **/womenShg** (Women hub) |
| 9 | Observe the registration flow for any SMS OTP screen | **No OTP screen appears** at registration (copy: "you'll never wait for an SMS OTP again"); you land logged in |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-02: Registration form validation (bad phone, mismatched MPIN)
- **Module:** 1. Role registration & onboarding      **Priority:** P1
- **Roleplay:** You are Sunita, careful but new to apps. Try wrong values first to see if the form stops you.
- **Preconditions:** Register wizard open at step 1.
- **Test data:** Phone 12345, MPIN 2468 vs 2469.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On step 1, enter MPIN **2468** and confirm MPIN **2469** | "PINs Match!" does NOT appear; you cannot proceed with mismatched PINs |
| 2 | Fix confirm MPIN to **2468**, proceed to step 3 | Step 3 opens |
| 3 | Enter phone **12345** and try to continue | Client validation blocks you with message **"A valid 10-digit mobile number is required"** |
| 4 | Enter phone **98220 1110a** (letters) | Same validation message; letters rejected |
| 5 | Enter a 10-digit phone, leave **Full Name** empty, try Finish | Name is required — Finish blocked or "required" hint shown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-03: Login with phone + MPIN on website (happy path and wrong MPIN)
- **Module:** 1. Role registration & onboarding      **Priority:** P0
- **Roleplay:** You are Sunita returning after a week. Log in with your phone and MPIN.
- **Preconditions:** Account from TC-MGU-01 exists.
- **Test data:** Phone 98220 11101, correct MPIN 2468, wrong MPIN 9999.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Log out (or open an incognito window) and open **Login** | Login form shows phone + MPIN fields; no OTP option |
| 2 | Enter phone 9822011101, MPIN **9999**, tap Login | Login **fails** with a wrong-MPIN / credentials error (backend 401 WRONG_MPIN); you are NOT logged in |
| 3 | Re-enter MPIN **2468** and tap Login | Login succeeds; you land on the **Women hub (/womenShg)** Dashboard |
| 4 | Check the URL and menus | You see the women hub (Dashboard / My SHG / Kitchen Garden / Backyard Livestock / Gruh Udyog Studio / AI Insights) — no farmer-only menus like FPO |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-04: Mobile login and "women mode" toggle
- **Module:** 1. Role registration & onboarding      **Priority:** P0
- **Roleplay:** You are Sunita on your Android phone. Open the app and switch it to women mode.
- **Preconditions:** Mobile app installed; account exists.
- **Test data:** Phone 98220 11101, MPIN 2468.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the mobile app and log in with phone + MPIN 2468 | Home loads in the normal (farmer-style) mode |
| 2 | Find and tap the **women mode** toggle (`toggleWomenMode()`) | Toast appears: **"महिला किसान प्रगति केंद्र सक्रिय!"** and the app routes to the women screen (`womenFarmer`) |
| 3 | Look at the women screen | Gradient rose header with women header title/subtitle; **4 tabs: SHG / Kitchen Garden / Livestock / Enterprise** |
| 4 | Pull to refresh / re-open the screen while loading | A loading spinner shows; if the API fails, an **error state with a Retry** button appears and Retry reloads |
| 5 | Toggle women mode off and on again | Each toggle switches modes correctly; toast shows each time |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-05: Create and activate the womenShg role profile (API / generic profiles)
- **Module:** 1. Role registration & onboarding      **Priority:** P2
- **Roleplay:** You are Sunita. Your profile should record that you lead Mauli SHG and can receive UPI settlements.
- **Preconditions:** Logged in; no women-specific profile UI exists — use the generic profile settings or the API.
- **Test data:** shgName "Mauli SHG", groupRole "president", enterpriseType "Papad & pickle making", skills ["papad","pickle","masala"], settlementUpi "sunita.mauli@okaxis".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open your profile/settings (generic `users/me/profiles` surface) and create a `womenShg` role profile with the test data values | Profile is accepted (POST create returns the profile with your fields) |
| 2 | Activate the womenShg profile (`POST /users/me/profiles/womenShg/activate`) | womenShg becomes the active profile |
| 3 | Set it as primary, toggle its visibility, then GET the profile | Each call succeeds; GET returns the same values you saved |
| 4 | Search the app for any women-specific profile screen | None exists (acceptable) — profile only via generic endpoints |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-06: Add, verify and set a primary bank account
- **Module:** 1. Role registration & onboarding      **Priority:** P1
- **Roleplay:** You are Sunita. Add your SBI account so payouts can reach you later.
- **Preconditions:** Logged in on website.
- **Test data:** SBI account 12345678901, IFSC SBIN0001234.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open bank-account settings (shared bank-accounts surface) and tap **Add** | Bank account form opens |
| 2 | Enter the test account number and IFSC, save | Account is created and listed |
| 3 | Tap **Verify** on the new account (`POST /bank-accounts/{id}/verify`) | Verification succeeds (or enters the dev verification state); status shows verified |
| 4 | Tap **Set primary** | Account becomes the primary payout account |
| 5 | Add a second test account and delete it | Delete succeeds; list returns to one account |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-07: Onboarding and hub labels in हिन्दी
- **Module:** 1. Role registration & onboarding      **Priority:** P1
- **Roleplay:** You are Sunita; you switch the app to हिन्दी because you read Hindi more comfortably than English.
- **Preconditions:** Logged in.
- **Test data:** Language हिन्दी.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open language settings and choose **हिन्दी** | UI reloads in Hindi |
| 2 | Open the Women hub (`/community/women`) and read the tabs | Dashboard / SHG / Garden / Livestock / Gruh Udyog / Insights labels render in Hindi **without overflow** and without English placeholder text like "TODO" or raw keys |
| 3 | Open the SHG tab and the deposit card | Labels (corpus, loan fund, deposit) appear in Hindi |
| 4 | Switch back to English | UI returns to English cleanly |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### Module 2 — Home / Dashboard

*Covers: the website Dashboard tab (`GET /women/dashboard`) — empty state, stat cards, this-month deposit card, loan / vaccination / garden / enterprise cards and the group-admin strip — and the mobile women's dashboard.*

### TC-MGU-08: Dashboard empty state (no SHG yet)
- **Module:** 2. Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Sunita, brand new, with no group. The dashboard should invite you to start one.
- **Preconditions:** Logged in; Sunita is in **no** SHG (fresh account).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the Women hub → **Dashboard** tab | Dashboard loads without error |
| 2 | Look at the top area | Pink-gradient empty state: **"Join a Bachat Gat to start saving together"** |
| 3 | Tap **"Create / view My SHG →"** | You are taken to the **shg** tab (create-SHG form, see TC-MGU-13) |
| 4 | Go back and tap **"Browse Bachat Gat directory →"** | Directory `/women/directory` opens |
| 5 | Check the deposit card text | It says **"Join a group to start depositing."** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-09: Stat cards and clickable navigation (after group exists)
- **Module:** 2. Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Sunita, now president of Mauli SHG. Check the numbers on your dashboard.
- **Preconditions:** Sunita has created Mauli SHG (TC-MGU-13 done); at least one deposit made.
- **Test data:** Monthly contribution ₹500.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Dashboard** | Three stat cards show: **Group Corpus (₹)**, **Loan Fund (₹)** with subtitle "Monthly deposit ₹500", **Members** with subtitle showing the village |
| 2 | Compare corpus + loan fund with the SHG tab | Values match the SHG tab exactly (deposit split 75%/25% — corpus ₹375 / fund ₹125 per ₹500 deposit) |
| 3 | Tap **Group Corpus** card | Card navigates to the **shg** tab |
| 4 | Tap **Members** card | Also navigates to the shg tab |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-10: This-month deposit card — Due state, pay, then Paid state
- **Module:** 2. Home / Dashboard      **Priority:** P0
- **Roleplay:** You are Sunita. It is a new month; your ₹500 deposit is due. Pay it from the dashboard.
- **Preconditions:** Group exists; current month deposit **not yet paid**.
- **Test data:** Amount ₹500, current month (YYYY-MM, IST).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Dashboard** | Deposit card shows badge **"Due"** (rose), text **"N/M members have paid"** (count updates as members pay), and link **"Pay deposit →"** |
| 2 | Tap **"Pay deposit →"** | You land on the SHG tab deposit card |
| 3 | Pay ₹500 per TC-MGU-16 steps 3–5 | Deposit succeeds |
| 4 | Return to Dashboard and re-read the deposit card | Badge now **"paid"** (emerald); text **"Your deposit is paid this month."**; the **"Pay deposit →"** link is gone |
| 5 | Verify corpus and loan fund increased | Corpus +₹375, Loan Fund +₹125 (75/25 split) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-11: Context cards — active loan, vaccination alerts, garden, enterprise, admin strip
- **Module:** 2. Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Sunita with an active loan, animals, a garden plan and an enterprise line. Every card should reflect live data.
- **Preconditions:** One approved loan exists (TC-MGU-31); goat/hens with a vaccine due within 30 days; one garden plan; one enterprise line (TC-MGU-44); at least one pending join request as admin.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Dashboard** | **My Active Loan** card shows Borrowed / Repaid / **Next due (₹ + due date)** and **"Manage →"** |
| 2 | Tap **"Manage →"** | Opens the SHG tab loans section |
| 3 | Read the **Vaccination Alerts** card | Shows animal count and due list; amber for due ≤7 days, rose **"N overdue"** for past due; **"Open livestock →"** present |
| 4 | Tap **"Open livestock →"** | Opens the Backyard Livestock tab |
| 5 | Read the **Kitchen Garden** card | Shows active plans count, status chips, recent plan chips (title·crop + status); **"Open garden →"** present |
| 6 | Read the **Home Enterprise** card | Shows total monthly profit ₹/month and line count; **"Open Gruh Udyog studio →"** present |
| 7 | As group admin with pending items, read the amber **Group admin strip** | Shows buttons **"Pending join requests (N)"** and **"Loans awaiting approval (N)"** (visible only when counts > 0) |
| 8 | Tap each admin-strip button | Both land on the shg tab at the right section (requests / loans) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-12: Mobile women dashboard — tab content, read-only behaviour, error retry
- **Module:** 2. Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Sunita on your phone. Check each of the 4 tabs.
- **Preconditions:** Mobile in women mode (TC-MGU-04); group, garden plan, animals and enterprise line exist.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open tab **SHG** | Card shows group summary and a **"Deposit Monthly"** button (mobile is read-only + deposit only) |
| 2 | Tap **Kitchen Garden** tab | Card shows your plans as a flat read-only list (vernacular (name), nutrition • companion • days) |
| 3 | Tap **Livestock** tab | Card shows animals, ×count, "vaccine • dueDate", and "N L milk/day" style yield labels |
| 4 | Tap **Enterprise** tab | EnterpriseIncomeCard shows per-line "+₹X perMonth" and a **Total Monthly Profit** |
| 5 | Turn on airplane mode and open the tabs | Error state shows (no crash); turn airplane mode off and tap **Retry** — content loads |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### Module 3 — SHG savings ledger (website "My SHG" tab / mobile "SHG" tab)

*Covers: create SHG, group view, monthly deposit with the 75%/25% corpus/loan-fund split, duplicate-month guard, members list, and the meeting/attendance/collection endpoints that have no UI.*

### TC-MGU-13: Create SHG "Mauli SHG"
- **Module:** 3. SHG savings ledger      **Priority:** P0
- **Roleplay:** You are Sunita. Ten women trust you; register your group on the platform.
- **Preconditions:** Logged in on website; not in any group.
- **Test data:** Name "Mauli SHG", monthly contribution ₹500, village Pimpalgaon Baswant, district Nashik.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Women hub → **My SHG** tab | With no group, the **"Start a Self-Help Group"** panel shows; link **"Browse the directory"** is present |
| 2 | Leave the form untouched and read the placeholders | Group name placeholder "e.g. Laxmi Mahila Bachat Gat" (required); Monthly contribution default **500** with min ₹50; Village "e.g. Koregaon"; District "e.g. Satara" |
| 3 | Enter **Mauli SHG**, monthly contribution **500**, village **Pimpalgaon Baswant**, district **Nashik** | All fields accept the values |
| 4 | Tap **Create SHG** | Group created; the group view opens with gradient header: **"Mauli SHG"**, "1 members · Formed {today's date} · Pimpalgaon Baswant · **You are the group admin**" |
| 5 | Read the two big numbers | **Group Corpus ₹0** and **Loan Fund ₹0** |
| 6 | Check your own role | You are `members[0]` with role **president** (this makes you the group admin) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-14: Create SHG — validation (empty name, amount below minimum)
- **Module:** 3. SHG savings ledger      **Priority:** P1
- **Roleplay:** You are Sunita; you fat-finger the form. The app must stop you.
- **Preconditions:** My SHG tab; create form open (use a *third* scratch account if Sunita already has a group).
- **Test data:** Empty name; amount ₹10; name 130 chars.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Clear the Group name field, keep amount 500, tap **Create SHG** | Creation blocked — name is required (hint shown) |
| 2 | Enter a 130-character group name, tap Create | Blocked — group name max is 120 characters |
| 3 | Enter name "Test Gat", set monthly contribution **10** (below min 50), tap Create | Blocked — amount must be ≥ ₹50 |
| 4 | Set a valid name and amount 50 (boundary), tap Create | Creation succeeds with ₹50/month (then delete/leave this scratch group or reuse the account) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-15: One group per user — second group and join-while-member are blocked
- **Module:** 3. SHG savings ledger      **Priority:** P1
- **Roleplay:** You are Sunita, already president of Mauli SHG. Try to create or join a second group.
- **Preconditions:** Sunita is a member (and admin) of Mauli SHG.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open My SHG and look for a way to create another group | No second "Create SHG" flow is offered; if triggered via API `POST /women/shg` | API returns **409 ALREADY_HAS_GROUP** |
| 2 | Open the directory, open another group's card and tap **Request to join** | Request blocked with **409 ALREADY_HAS_GROUP** and the Hindi message **"आप पहले से किसी बचत गट में हैं"** (one group per user) |
| 3 | As the admin, try to approve a join request for someone already in another group | Backend rejects with ALREADY_HAS_GROUP |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-16: Make a savings deposit from the website (amount, split, ledger)
- **Module:** 3. SHG savings ledger      **Priority:** P0
- **Roleplay:** You are Sunita paying your ₹500 for this month. The group keeps 75% in corpus, 25% in the loan fund.
- **Preconditions:** Group exists; current month unpaid.
- **Test data:** Amount ₹500, month = current YYYY-MM.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open My SHG → **"Make a Savings Deposit"** card | Badge shows **"{YYYY-MM} due"**; text **"This month: N/M members have paid · one deposit per member per month."**; amount input prefilled **500** (min ₹10) |
| 2 | Enter amount **0** and try **Deposit** | Deposit button disabled (amount ≤ 0) |
| 3 | Enter amount **500** and tap **Deposit** | Success; `POST /women/shg/deposit {amountPaisa: 50000, month}` is made |
| 4 | Re-read the card | Badge flips to **"{YYYY-MM} paid"**; **Deposit** button becomes disabled |
| 5 | Check Group Corpus and Loan Fund | Corpus **+₹375** (75%), Loan Fund **+₹125** (25%) — exact split |
| 6 | Open the bell / notification list | **No** "deposit success" notification exists (by design — do not file) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-17: Duplicate deposit for the same month is rejected
- **Module:** 3. SHG savings ledger      **Priority:** P1
- **Roleplay:** You are Sunita and you tap Deposit twice by mistake.
- **Preconditions:** This month's deposit already paid (TC-MGU-16).
- **Test data:** Another ₹500.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Look at the deposit card | Deposit button is disabled and badge says "paid" |
| 2 | Retry the deposit via API `POST /women/shg/deposit` with the same month | Backend returns **409 DUPLICATE_DEPOSIT_MONTH** |
| 3 | If the UI still allows tapping, tap Deposit | Friendly message: **"You have already paid this month's deposit"** — no second ledger entry |
| 4 | Re-check corpus/fund totals | Unchanged — exactly one deposit recorded |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-18: ⚠️ Mobile "Deposit Monthly" button
- **Module:** 3. SHG savings ledger      **Priority:** P0
- **Roleplay:** You are Sunita on your phone. Tap the one money button mobile offers and expect it to work like the website.
- **Preconditions:** Mobile in women mode; group exists; **next month unpaid** (or use a scratch group) so this test does not collide with TC-MGU-16.
- **Test data:** Group monthly deposit ₹500.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the mobile **SHG** tab | Card shows your group and the **"Deposit Monthly"** button |
| 2 | Note corpus/fund shown, then tap **Deposit Monthly** | Per UX the group's ₹500 should be deposited for the current month, a success snackbar should show, and corpus +₹375 / fund +₹125 |
| 3 | Verify the website group view | Deposit appears in the ledger with the same 75/25 split |
| 4 | Tap Deposit Monthly again | Snackbar shows the friendly duplicate message for `DUPLICATE_DEPOSIT_MONTH` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________
- **⚠️ Known issue:** The mobile app POSTs `{amount, month}` but the backend expects `{amountPaisa, month}`, and it reads `res['newCorpus']` while the backend returns `newCorpusPaisa` — performing this case will likely FAIL in the current build (deposit rejected/validation error or wrong success value); raise a defect.

### TC-MGU-19: ⚠️ Meeting, attendance and collection endpoints (API-only)
- **Module:** 3. SHG savings ledger      **Priority:** P1
- **Roleplay:** You are Sunita, the president. Every month you hold a meeting, mark attendance and collect fines/fees. The backend supports this; verify it works end-to-end even though no screen exists.
- **Preconditions:** Group has ≥2 members (Asha approved in TC-MGU-24); `curl`/Postman ready with Sunita's auth token.
- **Test data:** Meeting date = today, agenda "Monthly meeting — fines and Diwali orders"; collection ₹50 from Asha.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the website My SHG tab, look for any "Add meeting / Record attendance / Add collection" control | **None exists** — Meetings card only *lists* the last 10 meetings (agenda, datetime, "N attended", "₹ collected") |
| 2 | Call `POST /women/shg/meetings {date, agenda}` with the test data | Meeting created and returned with an id |
| 3 | Call `POST /women/shg/meetings/{id}/attendance {memberUid: Asha, present: true}` twice | Both succeed; second call is idempotent (still one "present" record) |
| 4 | Call `POST /women/shg/meetings/{id}/collections {memberUid: Asha, amountPaisa: 5000}` | Collection accepted; **100% goes to corpus** (no 75/25 split) |
| 5 | Reload My SHG → Meetings card | The new meeting appears with agenda, "1 attended", **"₹50 collected"**; Group Corpus rose by exactly ₹50 |
| 6 | Call attendance/collections with a bogus meeting id | **404 MEETING_NOT_FOUND** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________
- **⚠️ Known issue:** Create-meeting, attendance and collection endpoints exist but the website (and mobile) expose **no UI** for them — the meeting part of this case cannot be performed in-app, only via API. Known missing UI; raise a defect for the UI gap (backend works).

### TC-MGU-20: Members card
- **Module:** 3. SHG savings ledger      **Priority:** P2
- **Roleplay:** You are Sunita checking your roster.
- **Preconditions:** Group has Sunita + Asha.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open My SHG → **Members** card | One row per member: name, truncated uid, role badge |
| 2 | Verify the badges | Sunita = **president**, Asha = **member**; member count matches "N members" in the header |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### Module 4 — SHG directory & join requests

*Covers: `/women/directory` search and cards, the join-request modal, the admin queue (approve/decline), guards, and the two known gaps: no withdraw UI and admin-only verification.*

### TC-MGU-21: Browse and search the Bachat Gat directory
- **Module:** 4. SHG directory & join requests      **Priority:** P1
- **Roleplay:** You are Sunita looking for other groups, and Asha searching for Mauli SHG.
- **Preconditions:** Mauli SHG exists; Asha's account ready; at least one other group exists (create a scratch group via API if the directory is empty).
- **Test data:** Search terms: "Mauli", "Koregaon", "Satara".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/women/directory` ("Mahila Bachat Gat Directory") | Directory opens with search inputs **Group name / Village / District** and a **Search** button; group cards listed (max 50, newest first) |
| 2 | Press **Enter** in the Group name field (empty) | Search submits — Enter key works |
| 3 | Enter Group name **"Mauli"**, tap Search | Only Mauli SHG is listed |
| 4 | Clear name, enter Village **"Koregaon"**, Search | Only groups from Koregaon show (verify against data) |
| 5 | Enter District **"Satara"**, Search | Only Satara groups show; groups with no location show "Location not set" on their card |
| 6 | Read the Mauli SHG card | Shows name, village•district, members, "Formed" date, Corpus ₹, Fund ₹, "Monthly deposit ₹500", and — if verified — a **Verified** badge |
| 7 | As Sunita (a member), check the banner | Banner says **"You are a member of Mauli SHG → Open your hub"** and navigates to `/community/women` |
| 8 | Open the directory while logged out (or in incognito) | Action button shows **"Login to request join"** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-22: Request to join a group (Asha → Mauli SHG)
- **Module:** 4. SHG directory & join requests      **Priority:** P0
- **Roleplay:** You are **Asha Jadhav**. You found Mauli SHG in the directory and want in.
- **Preconditions:** Logged in as Asha (phone 98220 11102); Asha in no group; Mauli SHG exists.
- **Test data:** Message: "I am Asha from Koregaon. I make masala and want to save with Mauli SHG."

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the directory, open Mauli SHG's card | Button shows **Request to join** (status `none`) |
| 2 | Tap **Request to join** | Modal opens: **"Request to join Mauli SHG"** with textarea "Introduce yourself (optional) — village, what you grow or make…" |
| 3 | Read the modal note | Note says **"One request per group; you can withdraw later"** (remember this for TC-MGU-27) |
| 4 | Type the test message (≤500 chars) and tap **Send request** | Request sent; button becomes disabled **"Requested"** |
| 5 | Open Mauli SHG card again (reload) | Status persists as `pending` / "Requested" |
| 6 | 🔄 Switch to Sunita's bell / notifications (second tester — see 07_cross_persona_e2e.md) | Notification **shg_join_request** arrived, deep link `/womenShg/savings/requests/{uid}` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-23: Join-request guards (duplicate pending, non-existent group, message too long)
- **Module:** 4. SHG directory & join requests      **Priority:** P1
- **Roleplay:** You are Asha. Try to spam the same group with requests.
- **Preconditions:** Asha's request to Mauli SHG is pending (TC-MGU-22).
- **Test data:** 600-char message.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Re-open Mauli SHG's card and try **Request to join** again | Button is disabled ("Requested"); via API the retry returns **409 REQUEST_PENDING** |
| 2 | Via API, send a join request to a non-existent shgId | **404 SHG_NOT_FOUND** |
| 3 | Via API, send message of 600 characters | Rejected — message must be ≤ 500 chars |
| 4 | Via API, request to join a group you already belong to | **409 ALREADY_MEMBER** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-24: 🔄 Admin approves a join request — member added, both sides correct
- **Module:** 4. SHG directory & join requests      **Priority:** P1
- **Roleplay:** You are Sunita, group admin. Approve Asha's request.
- **Preconditions:** Asha's request is pending.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open My SHG (or the admin strip **"Pending join requests (1)"**) | **JoinRequestsSection** lists Asha: name, village (or "Village not shared"), the message in italic quote, buttons **Approve / Decline**; header shows **"1 pending"** |
| 2 | Tap **Approve** | Asha is added as `member` with role **member**; memberCount increments (1 → 2) |
| 3 | Check the decided list | Asha's row appears in the last-5 decided rows with an **approved** badge |
| 4 | Approve the same request again (via API, same uid) | Idempotent — still 200/OK, **no duplicate member** |
| 5 | 🔄 Check Asha's bell | Notification **shg_join_approved** arrived, deep link `/womenShg/savings` |
| 6 | 🔄 As Asha, open My SHG | Asha now sees Mauli SHG as her group; the directory banner says "You are a member of Mauli SHG → Open your hub"; her card button reads **"Member — open hub"** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-25: Admin declines a request; re-request after decline; approve-after-decline guard
- **Module:** 4. SHG directory & join requests      **Priority:** P1
- **Roleplay:** You are Sunita. A stranger asked to join; you decline. Then she asks again (allowed), and you change your mind (not allowed via the same old request).
- **Preconditions:** A **third** scratch account ("Kavita", phone 98220 11103) sends a request to Mauli SHG.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | In the admin queue, tap **Decline** on Kavita's request | Request becomes `declined`; row shows **declined** badge in the decided list |
| 2 | 🔄 Check Kavita's bell | Notification **shg_join_declined** arrived |
| 3 | 🔄 As Kavita, re-open Mauli SHG's card | Button **Request to join** is available again (only `pending` blocks a new request) — she can re-apply |
| 4 | Let Kavita send a new request; approve it; then try the decline endpoint on the same uid | **409 REQUEST_APPROVED** — cannot decline an approved request |
| 5 | Decline a fresh request from Kavita, then try the approve endpoint on that declined uid | **409 REQUEST_DECLINED** — cannot approve a declined request |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-26: Non-admin cannot approve/decline (403)
- **Module:** 4. SHG directory & join requests      **Priority:** P1
- **Roleplay:** You are **Asha**, a normal member. Try to sneak into admin powers.
- **Preconditions:** Asha is a member (not admin) of Mauli SHG; a pending request exists (use Kavita's re-request from TC-MGU-25).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | As Asha, open My SHG | **No** join-requests admin section and no amber admin strip appear |
| 2 | Via API as Asha, call `POST /women/shg/join-requests/{uid}/approve` | **403** — "only the group admin can approve/decline" |
| 3 | Via API as Asha, call the decline endpoint | **403** |
| 4 | Via API as Asha, open `GET /women/shg/join-requests` | Forbidden or empty for non-admin (403 expected) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-27: ⚠️ Withdraw a join request (promised in UI copy, not implemented)
- **Module:** 4. SHG directory & join requests      **Priority:** P2
- **Roleplay:** You are Kavita. You changed your mind after sending a request and want to withdraw it, as the app note promises.
- **Preconditions:** Kavita has a **pending** request to Mauli SHG.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Re-read the request modal note | It says **"you can withdraw later"** |
| 2 | Look on the group card / hub for a **Withdraw** action | Per UX a withdraw option should exist while status is `pending` |
| 3 | Withdraw the request | Status should return to `none`; the admin queue should no longer list it; admin should not be able to act on it |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________
- **⚠️ Known issue:** No withdraw endpoint or UI exists (only `status=="pending"` blocks re-request, and admin can still act on the pending request). Performing this case will likely FAIL in the current build; raise a defect.

### TC-MGU-28: ⚠️ "Verified" badge on the group card (set only by admin SOP)
- **Module:** 4. SHG directory & join requests      **Priority:** P2
- **Roleplay:** You are Sunita. Your group is real and registered; you want the green Verified badge so buyers trust you.
- **Preconditions:** Mauli SHG exists; Tester C has super-admin/SOP access.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | As Sunita, search the group hub and settings for any "Verify my group / submit for verification" action | Per UX there should be an in-app way to request verification, or at least documentation that admin verifies groups |
| 2 | Check the directory card before verification | **No Verified badge** |
| 3 | 🔄 [ADMIN] Tester C: open the queue `GET /women/shgs/queue`, then `POST /women/shgs/{id}/verify` (legacy alias `/women/shg/verify` also works) | Group `status` becomes **verified** |
| 4 | Reload the directory card | **Verified** badge now shows |
| 5 | Ask Tester C to verify the same group again | **409 ALREADY_VERIFIED** (idempotent guard) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________
- **⚠️ Known issue:** Group `verified` status can be set **only** via the admin SOP endpoint — there is no in-app request/verify flow for the group itself. Step 1 will find nothing; the badge depends entirely on admin. Known gap — raise a defect/feature request.

---

### Module 5 — SHG loan fund

*Covers: loan request form and guards, admin approve (schedule build, fund deduction, notification), the ⚠️ broken admin "Decline" button, borrower withdraw, repayments with the overpayment guard, schedule/history view, and illegal transitions.*

### TC-MGU-29: Request an interest-free loan
- **Module:** 5. SHG loan fund      **Priority:** P0
- **Roleplay:** You are Sunita. Seeds and the children's school fees are due. Borrow ₹2,000 from the group fund, repay over 6 months.
- **Preconditions:** Group exists with Loan Fund ≥ ₹2,000 (make deposits first); Sunita has no active loan.
- **Test data:** Amount ₹2,000, tenure **6** months, purpose "Seeds and school fees".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open My SHG → **Loans** section (ShgLoansSection) | Header shows **"Fund: ₹X"**; footer reads "Monthly deposit is ₹500; fund available: ₹Y. Admin approves every request." |
| 2 | Open the **Request loan** toggle form | Fields: **Amount ₹** ("e.g. 5000"), **Tenure months** (select 1–24, default 6), **Purpose** ("Seeds, school fees, medicine…"), button **Send request** |
| 3 | Enter amount **2000**, tenure **6**, purpose "Seeds and school fees" | Values accepted |
| 4 | Tap **Send request** | Request created with status `requested`; a loan row appears with your name + **"(you)"**, amount, purpose · months · date · repaid ₹0, badge **requested** |
| 5 | 🔄 Check Sunita's bell (as admin you also get a nudge) | Notification **shg_loan_requested** visible (payments category), deep link `/womenShg/savings/loans/{loan_id}` |
| 6 | Verify the fund was NOT touched | "Fund: ₹X" unchanged until approval |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-30: Loan request validation and guards
- **Module:** 5. SHG loan fund      **Priority:** P1
- **Roleplay:** You are Sunita (and Asha). Probe every limit on the loan form.
- **Preconditions:** Loan fund balance known; Asha has no active loan; a scratch user with **no group** ready.
- **Test data:** Amount ₹999,999 / ₹0 / −100; tenure 0, 25; purpose 250 chars; second concurrent loan.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Try tenure **0** and **25** in the select | UI guard: **"Tenure must be between 1 and 24 months"**; only 1–24 selectable |
| 2 | Via API, request with purpose of 250 chars | Rejected — purpose max 200 chars |
| 3 | Via API, request amount **0** or negative, and months outside 1–24 | **422 VALIDATION_ERROR** (amountPaisa > 0; months 1–24) |
| 4 | Request more than the fund holds (e.g. ₹999,999) | **409 INSUFFICIENT_LOAN_FUND** |
| 5 | As the no-group scratch user, request a loan | **409 SHG_GROUP_NOT_FOUND** — "join an SHG group before requesting a loan" |
| 6 | As Sunita with a `requested` loan, request a second loan | **409 ACTIVE_LOAN_EXISTS** (only one active loan: requested or approved, per borrower) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-31: 🔄 Admin approves a loan — schedule, fund deduction, notification
- **Module:** 5. SHG loan fund      **Priority:** P0
- **Roleplay:** You are Sunita, also the group admin. Approve your own ₹2,000 request and inspect the schedule.
- **Preconditions:** Loan in status `requested` (TC-MGU-29).
- **Test data:** ₹2,000 over 6 months.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the loan row as admin | Buttons **Approve from fund** and **Decline** show |
| 2 | Note "Fund: ₹X", then tap **Approve from fund** | Loan becomes `approved`; fund drops by exactly **₹2,000** (₹X − 2000); repayment progress bar appears at 0% |
| 3 | Expand **Schedule & history** | Equal monthly schedule: 6 installments of **₹333.33** (base 2000÷6 = 333, remainder ₹2 added to the **last** installment → last = ₹335); first due date = +1 month from today; all entries `pending` |
| 4 | Read the audit trail | Shows the request and the approve action with actor (admin uid), amount and timestamp |
| 5 | Check your bell | **shg_loan_approved**: "₹2,000 approved for Seeds and school fees — 6 monthly installments", deep link to the loan |
| 6 | 🔄 As a member (Asha), view the loans section | Asha sees the loan row read-only with **no** Approve/Decline buttons |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-32: ⚠️ Admin "Decline" button on a loan request
- **Module:** 5. SHG loan fund      **Priority:** P0
- **Roleplay:** You are Sunita the admin. A loan request looks risky; press **Decline** and expect the request to be declined with a proper record and notification.
- **Preconditions:** A second borrower (Asha) has a `requested` loan of ₹1,000, 3 months.
- **Test data:** Asha's loan ₹1,000.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | As admin, open Asha's `requested` loan row | Buttons **Approve from fund** and **Decline** visible |
| 2 | Tap **Decline** | Expected per UX: loan marked **declined/rejected**, stays visible with a decline audit entry, borrower notified, fund untouched, borrower can request a new loan later |
| 3 | Check "Fund: ₹X" | Unchanged — declining must not move money |
| 4 | 🔄 Check Asha's bell | A decline notification should exist |
| 5 | Check the loan row and lifecycle | A declined loan must not behave like a borrower cancellation |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________
- **⚠️ Known issue:** The admin **Decline** button actually calls the **borrower's cancel endpoint** (`cancelLoan`) — the loan is silently cancelled as if the borrower withdrew it, with no decline record or notification. Performing this case will likely FAIL in the current build; raise a defect.

### TC-MGU-33: Borrower withdraws a loan request
- **Module:** 5. SHG loan fund      **Priority:** P1
- **Roleplay:** You are Asha. You asked for ₹1,000 but your relative helped you; withdraw the request before the admin decides.
- **Preconditions:** Asha has a `requested` loan (re-request after the TC-MGU-32 mishap, or a fresh one).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open My SHG → Loans as Asha | Her `requested` row shows **Withdraw request** |
| 2 | Tap **Withdraw request** | Loan becomes `cancelled`; fund unchanged |
| 3 | Try to withdraw an `approved` loan (via API) | Rejected — cancel allowed only from `requested` (**409 INVALID_LOAN_STATUS**) |
| 4 | As Asha, request a new loan after cancelling | Succeeds — cancelled requests do not block a new one |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-34: Repay a loan (partial, then full) with overpayment guard
- **Module:** 5. SHG loan fund      **Priority:** P0
- **Roleplay:** You are Sunita repaying the ₹2,000 loan. Pay in two parts; then finish it off.
- **Preconditions:** Sunita's loan is `approved`; schedule visible from TC-MGU-31.
- **Test data:** First repayment ₹1,000; final repayment = remaining (~₹1,000).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the approved loan row as borrower | Button **Repay** shows with inline input **prefilled with the remaining ₹** |
| 2 | Enter **1,000**, tap **Pay** | Repayment accepted; schedule entries flip to `paid` **cumulatively** (≈3 installments marked paid, paidOn = today); progress bar ~50% |
| 3 | Check the fund | Loan Fund **+₹1,000** — repayments return to the fund |
| 4 | Try to pay **₹5,000** (more than remaining) | Blocked — **409 OVERPAYMENT** "only ₹X remains"; client guard also blocks exceeding the remaining amount |
| 5 | Enter exactly the remaining amount and tap **Pay** | Loan becomes **repaid** (badge "paid"); repayment credited back to the fund; progress 100% |
| 6 | Check the bell | **shg_loan_repaid** notification with deep link to the loan |
| 7 | Try to repay the repaid loan | Rejected — repay allowed only on `approved` loans |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-35: Schedule & history expander and overdue insight
- **Module:** 5. SHG loan fund      **Priority:** P2
- **Roleplay:** You are Sunita auditing the books before the next meeting.
- **Preconditions:** One approved loan with ≥1 pending installment; one loan whose installment due date has passed (ask dev team to backdate, or wait).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Expand **Schedule & history** on an approved loan | Installment table: #, due date, amount, status, paid on — all populated correctly |
| 2 | Read the audit trail | Request → approve → repay actions in order, each with actor, amount, timestamp |
| 3 | Check **AI Insights → Loan health** for the backdated loan | **Overdue** count includes approved loans with a pending installment whose due date < today |
| 4 | Repay the overdue installment | Overdue count drops by 1 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-36: Illegal loan transitions (negative)
- **Module:** 5. SHG loan fund      **Priority:** P2
- **Roleplay:** You are Sunita. Try to break the loan state machine.
- **Preconditions:** One `repaid` loan, one `cancelled` loan, one `approved` loan from earlier cases.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Approve a loan that is already `approved` (API) | Idempotent success or clear 409 — no double schedule, fund deducted once |
| 2 | Approve a `repaid` or `cancelled` loan (API) | **409 INVALID_LOAN_STATUS** |
| 3 | Repay a `requested` or `cancelled` loan (API) | Rejected — repay allowed only from `approved` |
| 4 | As a **member** (Asha), try the approve endpoint on any loan | **403** (admin-only `_admin_loan`) |
| 5 | As admin, approve a loan while the fund has dropped below the amount | **409 INSUFFICIENT_LOAN_FUND** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### Module 6 — Kitchen garden planner

*Covers: template categories and suggestion cards, custom crops, plan creation and validation, the 5-step growth stepper, and update/permission guards.*

### TC-MGU-37: Create a kitchen garden plan from template suggestions
- **Module:** 6. Kitchen garden planner      **Priority:** P1
- **Roleplay:** You are Sunita planning the winter kitchen garden for the family.
- **Preconditions:** Logged in on website; Kitchen Garden tab open.
- **Test data:** Select पालक/Spinach 45d (Leafy Greens) and टमाटर/Tomato 90d (Vegetables).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Kitchen Garden** tab → **New Kitchen Garden Plan** | Category chips: **Leafy Greens, Vegetables, Trees/Perennials** + **Custom** |
| 2 | Tap **Leafy Greens** | Suggestion cards show Spinach/पालक 45d, Fenugreek/मेथी 30d, Coriander/धनिया 40d, Amaranth/तांदूळ 35d — each with "~N days" chip, "Nutrition: …", "Companion: …" |
| 3 | Tap **Vegetables** | Cards show Tomato/टमाटर 90d, Carrot/गाजर 75d, Brinjal/वांगी 80d, Okra/भेंडी 55d |
| 4 | Tap **Trees/Perennials** | Cards show Drumstick/शेवगा 180d, Papaya/पपई 270d, Guava/पेरू 365d, Curry leaf/कढीपत्ता 240d |
| 5 | Toggle-select Spinach and Tomato cards | Both highlight emerald; they appear as removable chips in the selection area |
| 6 | Remove the Spinach chip via its ✕ | Chip disappears; count on the button updates |
| 7 | Re-add Spinach, then tap **Create Plan (3 crops)** | Plan created; a plan card appears with category, status **active**, and the 5-step **GrowthStepper** (Sowing→Sprout→Vegetative→Flowering→Harvest) at step 0/Sowing |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-38: Add a custom crop to a plan
- **Module:** 6. Kitchen garden planner      **Priority:** P1
- **Roleplay:** You are Sunita adding a chilli plant that is not in the templates.
- **Preconditions:** Create form open.
- **Test data:** Custom crop "Curry chilli".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap the **Custom** chip | Custom mode shows input **"Crop name (e.g. Methi)"** and button **Add** |
| 2 | Type **Curry chilli** and tap **Add** | "Curry chilli" appears as a removable chip |
| 3 | Create the plan with only the custom crop | Plan card created with 1 item (custom crops get default days) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-39: Garden plan validation (empty selection, field limits)
- **Module:** 6. Kitchen garden planner      **Priority:** P2
- **Roleplay:** You are Sunita; submit an empty plan by mistake.
- **Preconditions:** Create form open.
- **Test data:** 0 selected; category name 90 chars (API).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Select nothing and tap **Create Plan (0 crops)** | Button disabled; if forced, error flash: **"Select at least one crop suggestion (or add a custom item)."** |
| 2 | Via API, POST a plan with category of 90 chars | Rejected — category 1–80 chars |
| 3 | Via API, POST an item with daysToHarvest **−5** | Rejected — daysToHarvest ≥ 0 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-40: Plan card stepper mapping and editing own plan
- **Module:** 6. Kitchen garden planner      **Priority:** P1
- **Roleplay:** You are Sunita updating your spinach plan as it grows, then marking harvest.
- **Preconditions:** Plan with Spinach exists.
- **Test data:** Statuses: vegetative → flowering → harvested.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the plan card and read the GrowthStepper | Status text maps to steps: harvested→4 (Harvest), flowering/budding/fruiting→3, vegetative/growing→2, sprout/germinated/seedling→1, else 0 |
| 2 | Edit the plan (`PUT /women/garden-plans/{id}`) setting status "vegetative" | Stepper advances to step 2; StatusBadge shows the new status |
| 3 | Set status "flowering" | Stepper at step 3 |
| 4 | Set status "harvested" | Stepper at step 4 (Harvest); the dashboard garden card counts it under harvested |
| 5 | Reopen the plan; verify item list still shows days chip / Nutrition / Companion per item | Data intact after edits |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-41: Cannot edit a template plan or another user's plan (403)
- **Module:** 6. Kitchen garden planner      **Priority:** P2
- **Roleplay:** You are Sunita poking at things you don't own.
- **Preconditions:** A seeded template plan exists (template:true); Asha owns her own plan.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Via API, `PUT` a seeded template plan id | **403 FORBIDDEN** — templates cannot be edited |
| 2 | Via API, `PUT` Asha's plan id while logged in as Sunita | **403 FORBIDDEN** — only the owner can edit |
| 3 | Via API, `GET /women/garden-plans` and `/women/garden-templates` | Own plans + template docs return; template docs are flagged `template: true` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### Module 7 — Backyard livestock

*Covers: the read-only livestock join (animals + vaccination schedules), due/overdue banners, yields, and the empty state. Animals themselves are created on the vet/farmer surface.*

### TC-MGU-42: Livestock cards, yields and vaccination banners
- **Module:** 7. Backyard livestock      **Priority:** P1
- **Roleplay:** You are Sunita checking on Babli the goat and your hens.
- **Preconditions:** `GET /women/backyard-livestock` returns the goat + 6 hens (seeded by the vet/farmer surface); one vaccination due within 30 days, one overdue.
- **Test data:** Goat "Babli", breed local; 6 hens; vaccination nextDueDate within window.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Backyard Livestock** tab | One card per animal group: species icon + name, **"× count"** |
| 2 | Read the card details | Breed shown; purpose line shows "Backyard rearing" when no purpose set |
| 3 | Check the yield line | "≈ N eggs/litres per day" appears only when dailyYieldLiters > 0 (hens show eggs, goat shows litres if milking) |
| 4 | Read the vaccination banner for the animal due within 30 days | Amber banner **"Vaccine due {date}"** |
| 5 | Read the banner for the overdue animal | Rose banner **"Overdue — vaccinate today"** |
| 6 | Verify sorting | Rows sorted by vaccine due date (soonest first) |
| 7 | Check the dashboard vaccination card and AI Insights livestock card | Same animal count and due counts appear consistently |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-43: Livestock empty state
- **Module:** 7. Backyard livestock      **Priority:** P2
- **Roleplay:** You are Sunita before any animals are registered (fresh account view).
- **Preconditions:** A scratch account with no livestock data.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Backyard Livestock as the scratch user | Empty state: **"No backyard livestock registered — poultry, goats, and cattle tracked here earn extra women-mode rewards."** |
| 2 | Look for an "add animal" action | None here (correct) — animals are registered via the separate livestock/vet module |
| 3 | Check the mobile Livestock tab for the same user | Read-only empty card, no crash |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### Module 8 — Home-enterprise income tracker

*Covers: the `/women/home-enterprise` ledger lines and mall listings — both API-only (known UI gap) — and their display on dashboard / Gruh tab / mobile / insights.*

### TC-MGU-44: ⚠️ Add a home-enterprise income line (no UI — API)
- **Module:** 8. Home-enterprise income tracker      **Priority:** P1
- **Roleplay:** You are Sunita recording this month's profit from papad sales.
- **Preconditions:** `curl`/Postman with Sunita's token.
- **Test data:** Product "Methi Papad", monthlyProfitPaisa 12000 (₹120/month), revenuePaisa 80000 (₹800).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Search the website and mobile app for a screen to add an enterprise income line | **None exists** (known gap) — display cards only |
| 2 | Call `POST /women/home-enterprise {product: "Methi Papad", monthlyProfitPaisa: 12000, revenuePaisa: 80000}` | Line created and echoed |
| 3 | Call with product of 130 chars / empty product / monthlyProfitPaisa 0 | **422 VALIDATION_ERROR** (product 1–120; profit > 0; revenue ≥ 0 optional) |
| 4 | Call `GET /women/home-enterprise` | Returns `{lines[], totalMonthlyProfitPaisa}` — your line included, total = 12000 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________
- **⚠️ Known issue:** Create-line is **API-only** — no website or mobile UI exists even though the data powers dashboard/gruh/insights cards. The API part should pass; the missing UI is the defect to raise.

### TC-MGU-45: ⚠️ Publish a home-enterprise listing to the mall (no UI — API)
- **Module:** 8. Home-enterprise income tracker      **Priority:** P1
- **Roleplay:** You are Sunita turning your masala line into a mall listing.
- **Preconditions:** Auth token; a mall catalog exists (WS-03 shared listing flow).
- **Test data:** Title "Goda Masala 100g (Home Made)", category Spices, mrp 120, discountedPrice 110, stock 15, unit "100g pack", batchNo "HE-001".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Look for any "List on mall" button tied to an enterprise line | **None exists** (known gap) |
| 2 | Call `POST /women/home-enterprise/listings` with a full `UserProductCreate` body (title, category, brand, vernacularTitle, description, mrp 120, discountedPrice 110, stock 15, unit, imageUrl, batchNo) | Listing published into the mall `products` collection with `source: "women_enterprise"` |
| 3 | 🔄 As Tester A (E-Market Customer), search the mall for "Goda Masala" | The listing is visible and buyable like any mall product |
| 4 | Re-call the same listing with the same Idempotency-Key | Idempotent — no duplicate product |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________
- **⚠️ Known issue:** `/women/home-enterprise/listings` is **API-only** with no UI to reach it. The API should work; raise a defect for the missing UI.

### TC-MGU-46: Enterprise display surfaces (dashboard card, Gruh tab card, mobile, insights)
- **Module:** 8. Home-enterprise income tracker      **Priority:** P2
- **Roleplay:** You are Sunita checking that the profit you entered shows everywhere it should.
- **Preconditions:** Lines from TC-MGU-44 exist (add a second line: "Lime Pickle", profit ₹200, revenue ₹900).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Dashboard → **Home Enterprise** card | Total **₹320/month** (120 + 200), line count **2** |
| 2 | Open Gruh Udyog Studio → **"Home Enterprise — Monthly Profit"** card | Both lines listed with revenue − cost and "+profit" figures; total ₹320 |
| 3 | Open mobile **Enterprise** tab | Per-line "+₹120 perMonth"/"+₹200 perMonth" and **Total Monthly Profit ₹320** |
| 4 | Open **AI Insights** | Enterprise card shows total ₹/month; Trophy **"Best seller: Lime Pickle (₹200 profit on ₹900 revenue)"** (highest-profit line) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### Module 9 — Gruh Udyog Studio

*Covers: unit registration and profile, pause/resume, the product CRUD + publish lifecycle with the FSSAI gate, batches, offers, certifications with admin review, order fulfilment, settlements/commission, earnings and MPIN-gated payouts. This is the persona's money core — check every rupee on both sides.*

### TC-MGU-47: Register the Gruh Udyog unit
- **Module:** 9. Gruh Udyog Studio      **Priority:** P0
- **Roleplay:** You are Sunita. Officially register "Mauli Gruh Udyog" so your products can go on the Krishi Mall.
- **Preconditions:** Logged in; no unit registered yet.
- **Test data:** Unit name **Mauli Gruh Udyog**.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Gruh Udyog Studio** tab | Panel **"Register Your Home Enterprise"** shows: Unit name input ("e.g. Laxmi Papad Udyog") + **Register** |
| 2 | Enter **Mauli Gruh Udyog** and tap **Register** | Unit created (website also sends `{category: 'Other'}`); `POST /gruh-udyog/units` succeeds |
| 3 | Verify unit card appears | Card shows name + **active** status badge, category, description and location lines |
| 4 | Call `GET /gruh-udyog/units/me` (or reload the tab) | Exactly this one unit returned for you |
| 5 | Open the public brand card `GET /units/{id}` | Shows unit + verified certs (none yet) + live product count 0; as the owner you would see all certs incl. pending |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-48: One unit per owner + unit field validation
- **Module:** 9. Gruh Udyog Studio      **Priority:** P1
- **Roleplay:** You are Sunita. Try to register a second unit and probe field limits.
- **Preconditions:** Unit exists (TC-MGU-47).
- **Test data:** Second unit "Test Udyog"; name 1 char; establishedYear 1940 / 2150.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Via API, `POST /gruh-udyog/units` a second unit | **409 UNIT_ALREADY_EXISTS** — one unit per owner |
| 2 | Via API, register with unit name of 1 character | Rejected — name 2–120 chars |
| 3 | Via API, send `establishedYear` 1940 then 2150 | Rejected — year must be 1950–2100 |
| 4 | Via API, send an over-long category (>60 chars) | Rejected — category 2–60 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-49: Edit unit profile
- **Module:** 9. Gruh Udyog Studio      **Priority:** P1
- **Roleplay:** You are Sunita adding your village and a nice description for mall buyers.
- **Preconditions:** Unit exists.
- **Test data:** Village Pimpalgaon Baswant, district Nashik, state Maharashtra; description "Hand-made papad, pickle and masala by Mauli SHG women."

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the unit card, tap **Edit Profile** | Toggle form opens: name, village, district, state, description ("What does your unit make? (shows on the mall)") |
| 2 | Fill the test data and tap **Save Profile** | `PUT /units/{id}` saves; card refreshes with all values |
| 3 | Reload the public brand card | Description and location visible to buyers |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-50: Pause and resume the unit
- **Module:** 9. Gruh Udyog Studio      **Priority:** P1
- **Roleplay:** You are Sunita going to your cousin's wedding for a week. Pause the unit.
- **Preconditions:** Unit active.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Pause Unit** | Flash message: products are **hidden from the mall**; status badge changes to paused |
| 2 | 🔄 As Tester A, open the unit's product on the mall | Product no longer visible in mall search |
| 3 | Tap **Resume Unit** | Status back to active; products visible again on the mall |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-51: Paused unit blocks add-product and publish (403 UNIT_PAUSED)
- **Module:** 9. Gruh Udyog Studio      **Priority:** P1
- **Roleplay:** You are Sunita, unit paused. Make sure nothing can slip through.
- **Preconditions:** Unit paused (TC-MGU-50 step 1 state).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **Add Product**, fill valid data, tap **Save** | **403 UNIT_PAUSED** — product not created |
| 2 | Via API, publish an existing draft while paused | **403 UNIT_PAUSED** |
| 3 | Resume the unit and retry Add Product | Now succeeds |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-52: Add a product (all fields, photo upload, draft status)
- **Module:** 9. Gruh Udyog Studio      **Priority:** P0
- **Roleplay:** You are Sunita listing your Methi Papad.
- **Preconditions:** Unit active.
- **Test data:** Name "Methi Papad 200g", vernacular "मेथी पापड २०० ग्रॅम", category **Papad & Fryums**, pack unit "200g pack", MRP 80, selling 70, stock 20, shelf life 180 days, vegetarian ✔, description, 2 photos.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | In the Products card, tap **Add Product** | Toggle form opens with all fields: Product name, Vernacular title (मराठी / हिंदी), Category select (11 categories), Pack unit, MRP ₹, Selling price ₹, Stock (default 10), Shelf life (days), **Vegetarian product** checkbox (default true), Description, **Add photo** |
| 2 | Fill every field with the test data | Values accepted |
| 3 | Tap **Add photo**, upload 2 photos | Both appear as removable **"Photo 1" / "Photo 2"** chips; remove one, re-add |
| 4 | Tap **Save** | Product created with status **draft** (`POST /units/{id}/products`) |
| 5 | Read the product row | Title · price (MRP shown), category · Stock 20, **draft** badge; buttons **+5 Stock, Batches, Offer, Publish, Delete** (Unpublish appears once live) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-53: Product form validation (price > MRP, title limits, stock)
- **Module:** 9. Gruh Udyog Studio      **Priority:** P1
- **Roleplay:** You are Sunita entering a selling price above MRP by mistake.
- **Preconditions:** Add Product form open.
- **Test data:** Selling 90 > MRP 80; title "A" (1 char); stock −1; shelf life −10.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Enter MRP **80**, Selling price **90**, tap Save | **422** with fieldError **"must not exceed mrp"** |
| 2 | Enter title of 1 character, Save | Rejected — title 2–140 chars |
| 3 | Enter stock **−1**, Save | Rejected — stock ≥ 0 |
| 4 | Enter shelf life **−10**, Save | Rejected — shelfLifeDays ≥ 0 |
| 5 | Enter MRP 0 / selling 0, Save | Rejected — both must be > 0 |
| 6 | Enter a category outside the 11-category whitelist via API | **422** category whitelist error |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-54: Publish a non-food product to the mall
- **Module:** 9. Gruh Udyog Studio      **Priority:** P0
- **Roleplay:** You are Sunita publishing the Handwoven Basket (no FSSAI needed).
- **Preconditions:** Draft product "Handwoven Basket" (MRP 250 / selling 250, stock 5, category Handicrafts) saved.
- **Test data:** Batch auto "GU-XXXXXXXX".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Publish** on the basket row | Product goes **live**; mall doc created: `source: "gruh_udyog"`, unitId, gruhProductId, batchNo **GU-XXXXXXXX**, brand = unit name, sellerName, rating 0, **bnplAvailable: false** |
| 2 | 🔄 As Tester A, open the mall, search "Handwoven Basket" | Listing visible with title, vernacular title, price 250, stock 5 |
| 3 | Publish the same product again (API) | **409 ALREADY_LIVE** |
| 4 | Try to publish a product with stock 0 (set stock 0 via API first) | **422 STOCK_REQUIRED** |
| 5 | Check the unit **Products Live** stat | Increased by 1; **Live Offers** 0 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-55: Food product without FSSAI cannot be published (403 FSSAI_REQUIRED)
- **Module:** 9. Gruh Udyog Studio      **Priority:** P1
- **Roleplay:** You are Sunita trying to list Methi Papad (food) before your FSSAI is on file.
- **Preconditions:** Draft food product "Methi Papad 200g" (category Papad & Fryums); unit has **no** certification yet.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Publish** on the papad row | Blocked — **403 FSSAI_REQUIRED** |
| 2 | Read any on-screen message | Explains FSSAI registration is needed for food products |
| 3 | Try the pickle and masala drafts too | Same block — all 5 food categories are gated: Papad & Fryums, Pickles & Chutneys, Spices & Masala, Dairy & Sweets, Grains & Flours |
| 4 | `GET /gruh-udyog/categories` via API | 11 categories each with `isFood` / `requiresFssai` flags; the 5 above are flagged |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-56: Add certifications (FSSAI) with duplicate guard
- **Module:** 9. Gruh Udyog Studio      **Priority:** P1
- **Roleplay:** You are Sunita submitting your FSSAI licence for verification.
- **Preconditions:** Unit exists.
- **Test data:** FSSAI no 11523998000247, authority "FSSAI Mumbai", valid until 2027-12-31, PDF/photo attached.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the **Certifications** card and read the explainer | "FSSAI registration is needed for food products. While verification is pending you can still publish — the listing carries a visible pending badge…" |
| 2 | Tap **Add Certification** | Form shows: Type select — **FSSAI (food licence), AGMARK, Udyam (enterprise), SHG registration, Handicraft mark, Other**; Certificate number; Issuing authority ("e.g. FSSAI Pune"); Valid until; document upload "Attach certificate document (PDF/photo)" |
| 3 | Fill the FSSAI test data and attach a photo/PDF | Upload goes to folder `gruh` (purpose certification-document) |
| 4 | Tap **Submit for Verification** | Cert created with status **pending**; list row shows TYPE · number, authority · valid until, note "you can publish with a visible pending badge", StatusBadge pending |
| 5 | Submit the same type+number again (API) | **409 DUPLICATE_CERTIFICATION** |
| 6 | Submit cert number of 2 chars (API) | Rejected — number 3–60 chars |
| 7 | Submit type "pan" via API | Accepted by backend (note: not in the UI list) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-57: 🔄 [ADMIN] Verify the FSSAI cert, then publish a food product with the verified badge
- **Module:** 9. Gruh Udyog Studio      **Priority:** P0
- **Roleplay:** You are Sunita; Tester C plays the admin who verifies your licence.
- **Preconditions:** Pending FSSAI cert (TC-MGU-56); draft papad product.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 [ADMIN] Tester C opens `GET /gruh/certifications/queue` and sees your cert | Your FSSAI cert is listed with owner and document |
| 2 | 🔄 [ADMIN] Tester C calls `POST /gruh/certifications/{id}/verify` | Cert becomes **verified** |
| 3 | Check your bell | **gruh_cert_verified** notification, deep link `/community/women` |
| 4 | Tap **Publish** on Methi Papad | Publish succeeds — FSSAI cert is verified |
| 5 | 🔄 As Tester A, open the mall listing | Food listing shows **fssaiStatus: "verified"** badge; live sync carries title/vernacular/description/category/mrp/discountedPrice/unit/first image/stock |
| 6 | 🔄 [ADMIN] Tester C verifies the same cert again | **409 CERT_NOT_PENDING** |
| 7 | (Separate scratch cert) 🔄 [ADMIN] rejects it with reason "Blurred document" | Cert rejected; owner bell shows **gruh_cert_rejected** "…rejected: Blurred document"; public brand card hides it (non-owners see only verified certs) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-58: Publish a food product with only a *pending* FSSAI — pending badge on mall
- **Module:** 9. Gruh Udyog Studio      **Priority:** P1
- **Roleplay:** You are Sunita; your new AGMARK/Shg cert is pending. You may still publish non-FSSAI-gated items or items where a pending FSSAI is allowed and not expired.
- **Preconditions:** Add a second FSSAI-style cert and leave it **pending** (or use a pending cert not expired); draft "Goda Masala 100g" (Spices & Masala).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Publish Goda Masala while FSSAI is pending (not expired) | Publish succeeds |
| 2 | 🔄 As Tester A, view the mall listing | Badge **fssaiStatus: "pending"** clearly visible to buyers |
| 3 | Let the cert expire (or backdate `validUntil` via dev tools), then publish another food item | **403 FSSAI_REQUIRED** — pending-but-expired does not count |
| 4 | Publish a non-food item while cert pending | Works (no gate) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-59: Product lifecycle — edit, +5 Stock, unpublish, delete
- **Module:** 9. Gruh Udyog Studio      **Priority:** P1
- **Roleplay:** You are Sunita fixing a typo, topping up stock, taking the basket off the mall, and finally deleting a draft.
- **Preconditions:** Live basket + live papad from earlier cases.
- **Test data:** New selling price 240; +5 stock.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap the product row edit (`PUT /products/{id}`), change selling price to **240**, Save | Saved; 🔄 mall listing price updates to 240 |
| 2 | Tap **+5 Stock** on the basket | Stock 5 → 10 (`PUT /products/{id}/stock`); 🔄 mall stock shows 10 |
| 3 | Tap **Unpublish** on the basket | Back to **draft**; mall doc deleted; 🔄 listing disappears from the mall |
| 4 | Tap **Publish** on the basket again | Goes live again |
| 5 | Try **Delete** on the live papad | Blocked — **409 PRODUCT_LIVE** (must unpublish first) |
| 6 | Unpublish a draft copy of a product with an offer, then Delete | Delete succeeds; offers cascade-deleted |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-60: Unpublish blocked while open orders exist (409 OPEN_ORDERS_EXIST)
- **Module:** 9. Gruh Udyog Studio      **Priority:** P2
- **Roleplay:** You are Sunita. A customer just ordered the papad; do not let the listing vanish mid-order.
- **Preconditions:** A **placed/paid** mall order exists containing the papad (from Tester A in TC-MGU-64 setup).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Unpublish** on the ordered papad | Blocked — **409 OPEN_ORDERS_EXIST** (order placed/paid or fulfilment accepted/packed/shipped) |
| 2 | Complete the order through delivery (TC-MGU-65/66), then unpublish | Now succeeds |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-61: Batches — add batch, mark sold out / expired, date validation
- **Module:** 9. Gruh Udyog Studio      **Priority:** P1
- **Roleplay:** You are Sunita logging this week's papad batch.
- **Preconditions:** Papad product exists.
- **Test data:** Production 2026-10-01, expiry 2026-12-30, qty 10.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Batches** on the papad row | Batches panel opens with rows: batchNo · qty pcs · made · expires, status badge, **Mark…** select |
| 2 | In the add-batch row, verify Batch no is auto-filled **"GU-…"**, set Qty **10**, Production **2026-10-01**, Expiry **2026-12-30**, tap **Add Batch** | Batch created with status active; `POST /products/{id}/batches` |
| 3 | Try Expiry **2026-09-01** (before production) | **422** — expiry must be ≥ production date |
| 4 | Try qty **0** | Rejected — qty > 0 |
| 5 | Use **Mark… → Sold out** on the batch | Status becomes **sold_out**; via API a second status change returns **409 BATCH_CLOSED** |
| 6 | Add another batch and **Mark… → Expired** | Status **expired** (pattern allows only sold_out/expired; anything else rejected) |
| 7 | Check `GET /products/{id}` | Response includes product, batches, and activeOffer |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-62: ⚠️ Batch addToStock increments product stock (API-only flag)
- **Module:** 9. Gruh Udyog Studio      **Priority:** P2
- **Roleplay:** You are Sunita. Adding a batch should optionally add its quantity to your saleable stock — the backend supports it, the website never sends it.
- **Preconditions:** Papad product stock noted (e.g. 10); `curl`/Postman ready.
- **Test data:** New batch qty 10 with addToStock true.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Add a batch **via the website UI** and watch product stock | Per UX, adding a batch that increases stock should raise product stock (and mall stock) |
| 2 | Check stock after UI add | Verify whether stock changed |
| 3 | Call `POST /products/{id}/batches` with `addToStock: true` via API | Product stock increases by the batch qty; 🔄 mall stock syncs to the same number |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________
- **⚠️ Known issue:** Backend supports `addToStock` (batch qty increments product stock + mall sync) but the website never sends it. Step 1–2 will likely show stock unchanged in the UI flow — raise a defect.

### TC-MGU-63: Offers — activate, live price update, guards, remove
- **Module:** 9. Gruh Udyog Studio      **Priority:** P1
- **Roleplay:** You are Sunita creating a Diwali 10% offer on the papad.
- **Preconditions:** Papad live at selling ₹70 / MRP ₹80.
- **Test data:** Title "Diwali Offer", 10% off, valid 2026-10-20 → 2026-11-15.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap **Offer** on the papad row | Offer panel: Title, **% off** (1–90, default 10), Valid from, Valid until, **Activate Offer** |
| 2 | Enter the test data and tap **Activate Offer** | Offer created (`POST /products/{id}/offers`); offerPrice = round(80 × 0.90) = **₹72** |
| 3 | 🔄 As Tester A, check the mall listing | Live price updated to the offer price ₹72 |
| 4 | Try % off **0** and **95** | Rejected — 1–90 only |
| 5 | Try Valid until **before** Valid from | **422** — validUntil ≥ validFrom |
| 6 | Create a 99%… (use MRP 100/price 1 and pct that) — probe the zero-rupee guard: via API, craft an offer whose computed price < ₹1 | **422 "discount leaves a zero-rupee price"** |
| 7 | Open the **Offers card**, find "Diwali Offer −10% · ₹72 · 2026-10-20 → 2026-11-15", tap **Remove** | Offer deleted; 🔄 mall price reverts to ₹70 |
| 8 | Re-add the offer with the same Idempotency-Key | Idempotent — single offer |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-64: 🔄 Orders — accept and reject with buyer-visible reason
- **Module:** 9. Gruh Udyog Studio      **Priority:** P0
- **Roleplay:** You are Sunita. Two orders arrived: one you can fulfil, one you cannot.
- **Preconditions:** 🔄 Tester A (E-Market Customer) has placed 2 orders containing your live products.
- **Test data:** Reject reason "Stock finished, will restock next week".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Gruh Udyog Studio → **Orders** card (`GET /units/{id}/orders`) | Both orders listed: truncated order id, item count, "Krishi Mall customer"/buyerName · createdAt, status **placed** |
| 2 | On order 1, tap **Accept** | Status → **accepted**; `POST /orders/{id}/accept` |
| 3 | 🔄 Check Tester A's bell | **order_confirmed** — "…is confirmed and is being packed by the seller", deep link `/dashboard/p/orders` |
| 4 | On order 2, tap **Reject** | A prompt opens: **"Why are you rejecting this order? (shared with the buyer)"** — required, min 3 chars |
| 5 | Tap OK with an empty/2-char reason | Rejection blocked until ≥3 characters |
| 6 | Enter the test reason and confirm | Order rejected |
| 7 | 🔄 Check Tester A's bell | **order_cancelled** — "cancelled by the seller. Any payment made will be refunded." |
| 8 | Try to accept the rejected order again (API) | Guard works per state — accepted only from fulfilment `placed|rejected` AND order status `placed|paid`; otherwise **409 ALREADY_ACCEPTED / ORDER_NOT_OPEN** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-65: 🔄 Order fulfilment chain packed → shipped → delivered
- **Module:** 9. Gruh Udyog Studio      **Priority:** P0
- **Roleplay:** You are Sunita packing the accepted order and handing it to the pickup agent.
- **Preconditions:** Order 1 in status **accepted**.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the accepted order, tap **Mark Packed** | Status → **packed** |
| 2 | Tap **Mark Shipped** | Status → **shipped** |
| 3 | 🔄 Check Tester A's bell after packing/shipping | **order_shipped** — "packed and handed over to the pickup agent" |
| 4 | Tap **Mark Delivered** | Status → **delivered** |
| 5 | 🔄 Check Tester A's bell | **order_out_for_delivery** and **order_delivered** notifications arrive in order |
| 6 | Verify stock | Mall stock was decremented by the order; if the order is later cancelled, stock is restored |
| 7 | Verify the buyer's order page | Status shows delivered end-to-end |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-66: Order negative paths (reject-after-accept, cancel rules, bad transitions)
- **Module:** 9. Gruh Udyog Studio      **Priority:** P1
- **Roleplay:** You are Sunita probing what is and is not allowed on orders.
- **Preconditions:** One order in each state ready (placed, accepted, shipped, delivered).
- **Test data:** Cancel prompt "Cancel this order before packing? Reason (optional):".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Try **Reject** on an accepted/packed/shipped/delivered order | Blocked — **409 ORDER_NOT_REJECTABLE**; no Reject button shown in UI |
| 2 | On a `placed` order, tap **Cancel** (prompt allows optional reason) | Order cancelled; **stock restored to the mall** |
| 3 | Try **Cancel** on a shipped order | Blocked — **409 ORDER_NOT_CANCELLABLE** (cancel only from placed/accepted) |
| 4 | Try **Mark Delivered** directly on an accepted order (API) | **409 BAD_TRANSITION** "order must be X before Y" |
| 5 | Send status "dispatched" (API) | Accepted as alias of **shipped** |
| 6 | Try a nonsense status like "returned" (API) | Rejected |
| 7 | Try any fulfilment action on another unit's order id | **404 ORDER_NOT_FOUND** (or 403) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-67: Settlement accrues on delivered — verify revenue, 5% commission, both sides
- **Module:** 9. Gruh Udyog Studio      **Priority:** P0
- **Roleplay:** You are Sunita counting what you actually earned. Platform commission is 5%.
- **Preconditions:** Order 1 delivered (TC-MGU-65); order itemsTotal known (e.g. ₹300).
- **Test data:** itemsTotal ₹300 → revenue ₹300, commission 5% = ₹15, net ₹285.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the unit dashboard **stat cards** | **Total Sales** = revenue of delivered orders (₹300), **Orders** count correct, Products Live / Live Offers correct |
| 2 | Open **Earnings & Payouts** | **Delivered revenue ₹300 · Platform commission ₹15 · Available balance ₹285** · Paid out ₹0 |
| 3 | Read the settlement lines | Line "Order {id} · {YYYY-MM} · commission 5%" with "+₹285 (gross − commission)", status **accrued** |
| 4 | Mark the same order delivered again (API, idempotent) | No duplicate settlement line |
| 5 | Check backend config `platform_config/settlements.gruhCommissionPct` | Default 5%; if set outside 0–99 the fallback 5% applies |
| 6 | 🔄 With Tester A, verify the buyer paid the full ₹300 | Buyer side shows ₹300 paid — commission is deducted from the *seller's* side only |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-68: Earnings card math and empty state
- **Module:** 9. Gruh Udyog Studio      **Priority:** P1
- **Roleplay:** You are Sunita (and a scratch unit) checking that the money math is always consistent.
- **Preconditions:** Settlement from TC-MGU-67; a second scratch unit with no orders.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On Mauli Gruh Udyog, recompute: Available = revenue − commission − payouts | Matches the card exactly |
| 2 | Open the scratch unit's Earnings card | Empty text: **"No earnings yet — settlements appear here when an order is marked delivered."**; all balances ₹0 |
| 3 | Check payout form gating | **Request Payout** disabled unless amount > 0, MPIN length = 4, and amount ≤ available |
| 4 | Check low-stock / expiring-batches signals | Products with stock ≤ 5 flagged lowStock; active batches expiring ≤ 30 days flagged expiringBatches (seed data if none) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-69: Payout request — MPIN gates and insufficient balance
- **Module:** 9. Gruh Udyog Studio      **Priority:** P0
- **Roleplay:** You are Sunita withdrawing your ₹285 to your bank account.
- **Preconditions:** Available balance ₹285; MPIN 2468 set; primary bank account added (TC-MGU-06).
- **Test data:** Payout ₹100 (keep ₹185 for later cases); wrong MPIN 9999; over-balance ₹999.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Earnings & Payouts → payout form | Fields **"Payout amount (₹)"** and **"MPIN (4 digits)"** (password input) + **Request Payout** |
| 2 | Enter amount **999**, MPIN 2468, tap Request Payout | Blocked — **422 INSUFFICIENT_BALANCE** "payout exceeds the available balance of ₹285" (fieldError `must be <= 285`) |
| 3 | Enter amount **100**, MPIN **9999**, tap Request Payout | **401 WRONG_MPIN** |
| 4 | Enter amount **100**, MPIN **2468**, tap Request Payout | Payout created; status **processed** in dev (auto-processed when RazorpayX keys unset; **pending** otherwise); badge shown |
| 5 | Check the balances | Available drops to ₹185; **Paid out ₹100** |
| 6 | Via API, request a payout on an account with no MPIN (scratch user) | **409 MPIN_NOT_SET** "set an MPIN before requesting a payout" |
| 7 | Try a 3-digit MPIN | Blocked — MPIN must be exactly 4 digits |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-70: ⚠️ Payout must carry the seller's bank reference
- **Module:** 9. Gruh Udyog Studio      **Priority:** P0
- **Roleplay:** You are Sunita. Your payout should go to *your* primary bank account — finance must see which account was paid.
- **Preconditions:** One successful payout (TC-MGU-69); Tester C (finance) can inspect payout records.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Request another payout of ₹50 with MPIN 2468 | Payout succeeds |
| 2 | 🔄 [ADMIN/finance] Tester C inspects the payout record (`GET` payouts/settlements for the unit) | Per UX the payout must reference the **primary bank account** (id + account details) used for RazorpayX |
| 3 | Verify the money destination | The payout record should name Sunita's SBI account 12345678901 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________
- **⚠️ Known issue:** The payout call passes an **empty bank-account id**, so the payout is created with no bank reference. Performing this case will likely FAIL in the current build (record shows blank bank reference); raise a defect.

---

### Module 10 — AI Insights

*Covers: the Insights tab — savings trend chart, loan health, garden/livestock/enterprise cards, the deterministic suggestion card, and the empty state.*

### TC-MGU-71: Insights tab — charts and health cards
- **Module:** 10. AI Insights      **Priority:** P1
- **Roleplay:** You are Sunita checking the pulse of your group and enterprise.
- **Preconditions:** ≥1 deposit in each of a few months (make 2–3 deposits across months if the account is fresh); loans in multiple states; garden plan; animals; enterprise lines.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open **AI Insights** tab (`GET /women/insights`) | Panel loads: savings trend line chart (recharts), loan health cards, garden/livestock/enterprise cards, suggestion card |
| 2 | Read the **Savings trend** chart | Shows the last 6 IST months: deposits ₹ line + deposit-count line; current month reflects your deposits |
| 3 | Read **Loan health** cards | Requested / Active / Repaid / **Overdue** counts match the actual loans; "fund ₹X" matches the Loan Fund |
| 4 | Read the **Garden** card | Active plans · harvested counts + byStatus chips match the garden tab |
| 5 | Read the **Livestock** card | Animals registered count matches; "N vaccinations due soon" (amber) or "All vaccinations up to date" (emerald) per due dates; **upcoming vaccinations** list shown |
| 6 | Read the **Enterprise** card | Total ₹/month matches TC-MGU-46; Trophy shows the best-seller line |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-72: Suggestion card logic (thin margin vs strong line)
- **Module:** 10. AI Insights      **Priority:** P2
- **Roleplay:** You are Sunita reading the app's business advice.
- **Preconditions:** Enterprise lines exist; compute margin = profit/revenue of the best line.
- **Test data:** Line A: profit ₹120 on ₹800 (15% — thin). Line B: profit ₹200 on ₹900 (~22% — strong).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Make the best line a **thin-margin** one (profit 15% of revenue) and reload Insights | Suggestion: **"Your best seller {name} has a thin margin (15%). A ~10% price increase (about ₹X) would protect the profit."** |
| 2 | Make the best line a **strong-margin** one (≥20%) and reload | Suggestion: **"{name} is your strongest line — scale it by raising production and listing more stock."** |
| 3 | Verify the suggested ₹X | ≈ 10% of the line's revenue |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-73: Insights empty state
- **Module:** 10. AI Insights      **Priority:** P2
- **Roleplay:** You are a brand-new user opening Insights.
- **Preconditions:** Scratch account with no deposits/loans/plans/animals/lines.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open AI Insights as the scratch user | No crash; suggestion card shows **"Not enough activity yet"** |
| 2 | Check the charts/cards | Render empty/zero gracefully (no broken charts) |
| 3 | (Note) Verify the SHG-readiness object | `GET /women/shg` returns a cached `readiness` object but **no UI renders it** (reserved feature — do not file) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### Module 11 — Cross-persona, admin & cron

*Covers: buyer-side notifications for fulfilment, admin subsidy disbursement, cron-driven reminders (deposit due / vaccination due), the notification bell & deep links roundup, a हिन्दी core-flow pass, and the farmer-role overlap (FPO is farmer-only).*

### TC-MGU-74: 🔄 Buyer notification chain for a full order (both devices)
- **Module:** 11. Cross-persona, admin & cron      **Priority:** P1
- **Roleplay:** You are Sunita fulfilling an order while Tester A watches their customer phone.
- **Preconditions:** Two devices/sessions: Sunita (studio) + Tester A (customer). One more live product with stock.
- **Test data:** Order of 2 items.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Tester A places an order for 2 papad packs and pays | Order appears in your Orders card as **placed** |
| 2 | Accept the order | 🔄 Tester A bell: **order_confirmed** |
| 3 | Mark Packed, then Mark Shipped | 🔄 Tester A bell: **order_shipped** |
| 4 | Mark Delivered | 🔄 Tester A bell: **order_out_for_delivery** then **order_delivered**; each deep link opens `/dashboard/p/orders` at the right order |
| 5 | 🔄 Tester A verifies the money | Buyer was charged the item total (+ any shown fees); no extra charge appears on delivery |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-75: 🔄 [ADMIN] Subsidy disbursement to corpus or loan fund
- **Module:** 11. Cross-persona, admin & cron      **Priority:** P1
- **Roleplay:** You are Sunita; the government disbursed a ₹1,000 women-livelihood subsidy to Mauli SHG via the SOP desk.
- **Preconditions:** Tester C has SOP/finance admin access; note corpus/fund before.
- **Test data:** Subsidy ₹1,000, fund = **corpus**, reference "GO-SUBSIDY-2026-10".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Note Group Corpus ₹C and Loan Fund ₹F | Baseline recorded |
| 2 | 🔄 [ADMIN] Tester C: `POST /women/subsidies/disburse {shgId, amountPaisa: 100000, reference: "GO-SUBSIDY-2026-10", fund: "corpus"}` | 200 OK — double-entry credit |
| 3 | Reload My SHG | **Corpus = ₹C + 1,000**; Loan Fund unchanged |
| 4 | Check deposits ledger | A `shg_deposits` line exists with the subsidy reference (this is a ledger entry, not a member payment) |
| 5 | 🔄 [ADMIN] Disburse another ₹500 to **loanFund** | Fund = ₹F + 500; corpus unchanged |
| 6 | 🔄 [ADMIN] Disburse amount 0 (API) | Rejected — amountPaisa > 0 |
| 7 | 🔄 [ADMIN] Open the read-only desks `/women/shg`, `/women/enterprises`, `/women/loans`, `/women/deposit-compliance`, `/women/impact-report`, `/women/enterprise-products` | Each loads read-only data for Mauli SHG (impact report shows group stats) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-76: 🔄 [ADMIN] Cron reminders — deposit due and vaccination due
- **Module:** 11. Cross-persona, admin & cron      **Priority:** P1
- **Roleplay:** You are Sunita. A member forgets her deposit; the system should remind her. Same for an animal vaccine.
- **Preconditions:** New month started (or use the current month with an unpaid member — e.g. Asha has **not** paid); an animal with vaccine due ≤ 7 days; Tester C can call the cron endpoint.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Ensure Asha has **not** paid this month's deposit | Deposit card for Asha shows due |
| 2 | 🔄 [ADMIN] Tester C: `POST /jobs/women/reminders` with header **X-Cron-Secret** | 200 OK; job runs |
| 3 | 🔄 Check Asha's bell | **deposit_due** notification (payments category) with deep link `/womenShg/savings` |
| 4 | Re-run the same cron call | Idempotent — **no duplicate** notification (deterministic doc id per group+member+month) |
| 5 | Verify Sunita (who **paid**) gets nothing | No deposit_due for paid members |
| 6 | With an animal vaccine due ≤ 7 days, re-run the cron | **vaccination_due** notification (tasks category), deep link `/womenShg` |
| 7 | Wrong/missing X-Cron-Secret (API) | Request rejected (401/403) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-77: Notification bell — categories, deep links, preferences
- **Module:** 11. Cross-persona, admin & cron      **Priority:** P1
- **Roleplay:** You are Sunita reviewing every notification you should have by now.
- **Preconditions:** Earlier cases executed (you should have: shg_join_request, shg_loan_approved, shg_loan_repaid, gruh_cert_verified, deposit_due if unpaid month exists).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the bell / notifications list | All triggered notifications are present with correct text and category |
| 2 | Tap **shg_join_request** | Opens `/womenShg/savings/requests/{uid}` |
| 3 | Tap **shg_loan_approved** / **shg_loan_repaid** | Opens `/womenShg/savings/loans/{loan_id}` |
| 4 | Tap **gruh_cert_verified** | Opens `/community/women` |
| 5 | Open notification preferences | Categories: tasks / trade / payments / social / marketing; channels: push / sms / inApp; **quiet hours 21:00–06:30**; digest mode — change a setting and save |
| 6 | Enable digest mode and trigger a notification (repeat a cron) | Notification lands in digest instead of immediate push (per setting) |
| 7 | Verify no notification exists for deposit success / group creation / product publish / payout request | Correctly absent (by design — do not file) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-78: हिन्दी core flow — SHG deposit end-to-end
- **Module:** 11. Cross-persona, admin & cron      **Priority:** P1
- **Roleplay:** You are Sunita doing your monthly deposit entirely in Hindi on the website.
- **Preconditions:** Group exists; current month unpaid on website (use next month if TC-MGU-16 consumed this one).
- **Test data:** ₹500.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Switch language to **हिन्दी** | UI reloads in Hindi |
| 2 | Open **मेरी एसएचजी / बचत गट (My SHG)** tab | All labels in Hindi, no truncated/overflowing buttons |
| 3 | Read the deposit card | Badge दिखाता है "देय"/"भुगतान" — month status clear; amounts render with ₹ correctly |
| 4 | Enter **500** and tap the deposit button | Deposit succeeds; success message in Hindi |
| 5 | Verify corpus/fund | +₹375 / +₹125 |
| 6 | Tap the duplicate-deposit path | Friendly Hindi duplicate message |
| 7 | Switch back to English | UI returns to English |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-MGU-79: Farmer-role overlap and FPO 403 for pure womenShg
- **Module:** 11. Cross-persona, admin & cron      **Priority:** P2
- **Roleplay:** You are Sunita. Your account is `womenShg`; the FPO (farmer organisation) module should not be yours.
- **Preconditions:** Logged in as Sunita (womenShg).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Call any women endpoint, e.g. `GET /women/shg` | Works — roles `farmer` **or** `womenShg` accepted |
| 2 | Call `GET /women/directory` | Works — any authenticated user |
| 3 | Call an FPO endpoint, e.g. `GET /fpo/...` (list or join-request) with Sunita's token | **403** — FPO is farmer-role-only; SHG/FPO do not overlap in code |
| 4 | (If dev team provides one) log in with a `farmer`-role account on the women hub | All women endpoints work for the farmer role too (same account can play both) |
| 5 | Check mall access | `womenShg` is in `MARKET_ROLES` — Sunita can browse/buy on the mall |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

## 4. Module coverage matrix

Every module of the feature inventory (`/tmp/persona_sections/mgu.md`) is covered by the cases below.

| Inventory module | Cases (IDs) | Count |
|------------------|-------------|------:|
| 1. Role registration & onboarding | TC-MGU-01 … TC-MGU-07 | 7 |
| 2. Home / Dashboard (website + mobile) | TC-MGU-08 … TC-MGU-12 | 5 |
| 3A. SHG savings ledger | TC-MGU-13 … TC-MGU-20 | 8 |
| 3B. SHG directory & join requests | TC-MGU-21 … TC-MGU-28 | 8 |
| 3C. SHG loan fund | TC-MGU-29 … TC-MGU-36 | 8 |
| 3D. Kitchen garden planner | TC-MGU-37 … TC-MGU-41 | 5 |
| 3E. Backyard livestock | TC-MGU-42 … TC-MGU-43 | 2 |
| 3F. Home-enterprise income tracker | TC-MGU-44 … TC-MGU-46 | 3 |
| 3G. Gruh Udyog Studio | TC-MGU-47 … TC-MGU-70 | 24 |
| 3H. AI Insights | TC-MGU-71 … TC-MGU-73 | 3 |
| 4/5/6/7. Cross-persona, money flows, notifications, edge cases & validation | TC-MGU-74 … TC-MGU-79 | 6 |
| **Total** | TC-MGU-01 … TC-MGU-79 | **79** |

Known-mismatch coverage (each inventory closing-note gap has at least one ⚠️ case): mobile deposit field mismatch → **TC-MGU-18**; missing UIs (meetings, home-enterprise line/listings, batch addToStock, join-request withdrawal) → **TC-MGU-19, TC-MGU-44, TC-MGU-45, TC-MGU-62, TC-MGU-27**; admin decline-loan bug → **TC-MGU-32**; empty bank ref on payout → **TC-MGU-70**; verified status admin-only → **TC-MGU-28**.

## 5. Sign-off

Tester name: ______________________    Role: Tester B (Sunita Patil + Asha Jadhav)

Second tester (cross-persona): ______________________    Admin: ______________________

Date(s) of execution: ____________  to  ____________    Environment: ______________________

| Summary | Count |
|---------|------:|
| Total cases | 79 |
| P0 | 21 |
| P1 | 43 |
| P2 | 15 |
| Pass | ____ |
| Fail | ____ |
| ⚠️ Known-issue cases failed (defects raised) | ____ |

Tester signature: ______________________     Lead sign-off: ______________________
