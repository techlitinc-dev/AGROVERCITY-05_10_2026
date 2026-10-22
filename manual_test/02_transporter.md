# Transporter — Manual Test Script (Final UAT)

> This script is for the tester **roleplaying Suresh Jadhav, a Nashik-based transporter** (1 Tata Ace + 1 hired 16-ft truck). It contains **137 test cases in 28 modules**. Estimated time: **~2 working days** for one tester (Modules 1–3 and most solo flows first; the 🔄 steps need Tester A as the Farmer, and **[ADMIN]** steps need Tester C on the super-admin panel). Read `manual_test/README.md` first — every case here follows its Section-4 format.

## 0. Roleplay card

| Field | Value |
|-------|-------|
| **Name** | Suresh Jadhav |
| **Age** | 38 |
| **Background** | Owns 1 Tata Ace mini-truck + 1 hired 16-ft truck (runs it as an Eicher 6-wheeler on the platform); operates Nashik↔Pune↔Mumbai routes; small 2-vehicle fleet, no office staff |
| **Language** | Hindi / Marathi speaker; runs the app in English **and** हिन्दी |
| **Device** | One Android phone (Flutter app — primary) + desktop browser (Transporter Logistics Cockpit website) |
| **Goal for this test** | Maximum loaded-kms per day: keep both vehicles verified & "Live", win bids and negotiations, run trips milestone-by-milestone, deliver with POD, and get paid fast (escrow → wallet → bank) |
| **Linked personas** | **Farmer (Ramesh, Tester A)** — posts loads, books trips, counters bids/offers, pays escrow, reveals POD OTP, rates Suresh. **Admin (Tester C)** — approves KYC/vehicle docs, penny-drop bank verify, resolves disputes, releases settlement holds. Driver sub-account (Mahesh) — Pro feature. |

## 1. Account & test data setup

1. Confirm the backend is up: `GET http://<host>:8000/health` → OK, and dev mode is on (OTP returned in API response; `123456` always works in dev).
2. On the Flutter app, start sign-up with **Suresh's phone**. Read the `devOtp` from the `/auth/otp/send` response (ask Tester C) or enter `123456`.
3. Verify the OTP, then set **MPIN `1234`**.
4. In the role picker, choose **Transporter (परिवहन / transport)** and make it the primary profile.
5. Complete the business profile (Module 1) and submit KYC (Aadhaar, PAN, Bank, RC, DL).
6. Ask **Tester C [ADMIN]** to approve the KYC case and verify vehicle documents (rc + dl verified).
7. Add both vehicles (Tata Ace + Eicher) and wait until their `docStatus` = verified, with PUC/fitness/insurance expiry dates in the future.
8. Add Suresh's bank account and ask **[ADMIN]** to penny-drop-verify it in the sandbox; set it as primary.
9. Agree the test UPI ID and sandbox bank details with the team before Day 1.
10. Confirm **Tester A** has Farmer **Ramesh Patil** (+91 98220 00001) ready (KYC verified) — see `01_farmer.md`.

| Test data item | Concrete value |
|----------------|----------------|
| Suresh phone / MPIN | +91 98220 44710 / MPIN `1234` (dev OTP `123456`) |
| Business name | Suresh Jadhav Logistics (सुरेश जाधव लॉजिस्टिक्स) |
| Transporter type | Owner-Driver (मालिक-चालक, 1–2 वाहन) |
| Vehicle 1 | **MH-15-AB-4471** — Tata Ace, 0.75T, State Permit |
| Vehicle 2 | **MH-12-GH-8820** — Eicher 6-Wheeler (hired 16-ft truck), 6T, National Permit |
| Temp vehicle (for delete test) | MH-16-AB-4471 |
| Operating routes | Nashik–Pune, Nashik–Mumbai |
| Specializations | Onion/Garlic (प्याज़-लहसुन), Perishables (जल्दी खराब होने वाली) |
| Emergency switch | ON ("24x7 emergency pickup") |
| Settlement UPI | suresh.jadhav@okhdfcbank |
| PAN / GSTIN | BQKPJ4821F / 27BQKPJ4821F1Z5 (GSTIN used only in edit-profile case) |
| Bank account | A/c 50100234567890, IFSC HDFC0001207 (sandbox; must be penny-drop `verified`) |
| KYC documents | Aadhaar, PAN, Bank, RC, DL — test scans as jpg/png, each ≤ 5 MB |
| Pickup point | Pimpalgaon Baswant, Nashik (onion/grapes belt) |
| Drop 1 / Drop 2 | Pune Market Yard, Pune (~210 km) / APMC Vashi, Mumbai (~170 km) |
| Commodities | Onion (प्याज़), Grapes (द्राक्ष), Tomato (टमाटर) |
| POD receiver | Dattaram Sawant, +91 98220 55501 |
| Farmer (Tester A) | Ramesh Patil, +91 98220 00001 |
| Fare references | Tata Ace: base ₹500 + ₹35/km, 0.75T; loading labour ₹300 (>10 km) else ₹150; toll ₹85 per 50 km (≥50 km); commission 10%; detention ₹150/30 min after 60 free min, cap ₹2,000 |
| Sample trip | Nashik → Pune, 210 km, Tata Ace: estimate ≈ ₹500 + ₹7,350 + ₹300 + ₹425 (toll) ≈ **₹8,575** — verify against the fare breakdown card |
| Driver (Pro feature) | Mahesh Gaikwad, +91 98220 66002 |

## 2. Preconditions checklist

(Verify once before starting; re-check after any data reset.)

- [ ] Backend running: `/health` → OK; `/docs` reachable
- [ ] Website opens and `/transporter` shows the Logistics Cockpit
- [ ] Mobile app installed; Suresh logged in; MPIN `1234` login works
- [ ] Suresh KYC status = **verified** (rc + dl verified)
- [ ] ≥ 1 vehicle with `docStatus` = verified and PUC / fitness / insurance / permit expiry dates all in the future
- [ ] Penny-drop-verified bank account set as primary; MPIN set
- [ ] Farmer Ramesh account ready on a second device (Tester A), KYC verified, with a load/booking available
- [ ] Load board has open loads (an empty database auto-seeds 4 Hindi demo loads)
- [ ] Upload folders exist: `/uploads` → `pod`, `vehicles`, `ads`, `chatbot`, `diary`
- [ ] Two devices free for 🔄 steps (or plan them sequentially with Tester A)
- [ ] Tester C has super-admin access for **[ADMIN]** steps

## 3. Test cases

### Module 1 — Registration, Onboarding & KYC

> Register Suresh from a fresh phone number: OTP → role picker → business profile → KYC (Aadhaar/PAN/Bank + RC/DL) → bank account. Covers auth errors, validation, the vehicle-verification gate, and plan-gating basics.

### TC-TRN-01: Send and verify login OTP on a fresh phone number
- **Module:** 1 — Registration & Onboarding      **Priority:** P0
- **Roleplay:** You are Suresh Jadhav. You have a new phone and want to start using the app for your transport business.
- **Preconditions:** Backend up; Suresh's number (+91 98220 44710) not already registered.
- **Test data:** Phone +91 98220 44710; dev OTP `123456` (or `devOtp` from API response).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the mobile app → welcome/login screen | Phone number entry field with country code +91 is shown |
| 2 | Enter 9822044710 → tap "Send OTP" | "OTP sent" toast/message; API returns `devOtp` (dev mode) |
| 3 | Enter the 6-digit OTP → tap "Verify" | OTP accepted; you move to registration / home; no error |
| 4 | Check: fully close the app, reopen, and log in again with the same session flow | Login works again; OTP session is one-shot (old OTP cannot be replayed) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-02: Resend OTP is blocked for 30 seconds
- **Module:** 1 — Registration & Onboarding      **Priority:** P2
- **Roleplay:** You are Suresh. The first SMS did not arrive, so you tap Resend repeatedly.
- **Preconditions:** On the OTP screen for +91 98220 44710.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the OTP screen, immediately tap "Resend OTP" | Resend is rejected with a "please wait / too soon" message (`RESEND_TOO_SOON`, 30 s block); no new SMS sent |
| 2 | Wait 30 seconds → tap "Resend OTP" again | New OTP is sent and accepted for login |
| 3 | (With Tester C) send `/auth/otp/send` 6 times within 10 minutes from this number | 6th request is rate-limited (5/10 min limit); clear message shown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-03: OTP failure paths — wrong OTP, expired session, too many attempts
- **Module:** 1 — Registration & Onboarding      **Priority:** P1
- **Roleplay:** You are Suresh. You mistype the OTP and then keep trying old codes.
- **Preconditions:** On the OTP screen with a fresh OTP sent.
- **Test data:** Wrong OTP e.g. 000000 (unless real OTP is 000000).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Enter a wrong OTP → tap Verify | `OTP_INVALID` error shown; you stay on the OTP screen |
| 2 | Enter 5 wrong OTPs in a row | 5th failure shows `OTP_TOO_MANY_ATTEMPTS` (HTTP 429); further tries blocked |
| 3 | Start a new session (Send OTP), wait 5 minutes without verifying, then enter the old OTP | `OTP_EXPIRED` / `OTP_SESSION_NOT_FOUND` message; you must request a fresh OTP |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-04: Register with the role picker as a Transporter
- **Module:** 1 — Registration & Onboarding      **Priority:** P0
- **Roleplay:** You are Suresh. During sign-up you pick "Transporter" because you own trucks, and fill your basic business details.
- **Preconditions:** OTP verified for +91 98220 44710.
- **Test data:** businessName "Suresh Jadhav Logistics"; transporterType owner_driver; vehicleType "Tata Ace"; rcNumber MH-15-AB-4471; language English; no referral code.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Complete OTP verification → reach the role picker | Role picker lists Transporter (परिवहन) among the roles |
| 2 | Select "Transporter" → set it as primary profile → Continue | Registration form opens with transporter fields |
| 3 | Fill: Business name = Suresh Jadhav Logistics; Transporter type = Owner-Driver (मालिक-चालक); Vehicle type = Tata Ace; Primary RC = MH-15-AB-4471; Contact mobile; leave GSTIN empty; State/District/Tehsil/Village = Maharashtra / Nashik / Niphad / Pimpalgaon | All fields accept input; GSTIN marked optional |
| 4 | Set MPIN `1234` (twice) → tap Register/Submit | Account created; you land on the transporter home; `linkedProfiles` contains "transport" |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-05: Registration validation — bad MPIN and bad referral code
- **Module:** 1 — Registration & Onboarding      **Priority:** P1
- **Roleplay:** You are Suresh. You try a short MPIN and a referral code a friend gave you that turns out fake.
- **Preconditions:** On the registration form (fresh account).
- **Test data:** MPINs "12", "12ab"; referral code "FAKECODE123".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Enter MPIN "12" → try to submit | MPIN format error: exactly 4 digits required |
| 2 | Enter MPIN "12ab" → try to submit | MPIN format error (digits only) |
| 3 | Enter valid MPIN `1234`, then enter referral code "FAKECODE123" → submit | Submission fails with `INVALID_REFERRAL_CODE`; no half-created account |
| 4 | Remove the referral code → submit | Registration succeeds |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-06: Log in with MPIN after logout
- **Module:** 1 — Registration & Onboarding      **Priority:** P0
- **Roleplay:** You are Suresh. Every morning you open the app and enter your 4-digit MPIN instead of an OTP.
- **Preconditions:** Suresh registered with MPIN `1234`.
- **Test data:** MPIN `1234`.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Log out from Profile/Logout | Logged out; login screen shown |
| 2 | Open the app again → enter phone number | App routes directly to the MPIN screen (phone-status check: MPIN exists) |
| 3 | Enter MPIN `1234` → tap Login | Logged in to the transporter home without any OTP |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-07: Wrong MPIN is rejected
- **Module:** 1 — Registration & Onboarding      **Priority:** P1
- **Roleplay:** You are Suresh. Your thumb slips and you enter the wrong MPIN.
- **Preconditions:** Logged out; MPIN screen shown.
- **Test data:** Wrong MPIN "9999".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Enter MPIN "9999" → tap Login | `WRONG_MPIN` / "incorrect MPIN" error; you stay logged out |
| 2 | Enter correct MPIN `1234` → tap Login | Login succeeds |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-08: Complete the transporter business profile (mobile form, Hindi labels)
- **Module:** 1 — Registration & Onboarding      **Priority:** P0
- **Roleplay:** You are Suresh. You fill your business profile so farmers can find you for Nashik–Pune–Mumbai loads.
- **Preconditions:** Registered as transporter; on TransporterProfileView.
- **Test data:** Routes Nashik–Pune, Nashik–Mumbai; specializations Onion/Garlic + Perishables; UPI suresh.jadhav@okhdfcbank.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Profile → "Transporter business profile" | KPI header shows rating pill, total trips, on-time %, fleet count (defaults acceptable for new user) |
| 2 | Verify field labels and fill: Business name; Transporter type dropdown showing मालिक-चालक 1-2 वाहन / फ्लीट ऑपरेटर 3+ वाहन / लॉजिस्टिक्स एजेंसी → pick मालिक-चालक; Contact mobile; Primary RC; GSTIN (leave empty); PAN; RTO transport permit; Settlement UPI ID | All fields present and editable as listed; dropdown shows the 3 options |
| 3 | In Routes, tap FilterChips for "नाशिक-पुणे" and "नाशिक-मुंबई" | Chips become selected (7 fixed Hindi route options available) |
| 4 | In Specializations, tap "प्याज़-लहसुन" and "जल्दी खराब होने वाली" | Chips selected (6 specialization options available) |
| 5 | Switch ON "24x7 emergency pickup" → tap Save | Profile saved via `PUT /transport/profile`; success message; values persist after reopening |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-09: Submit KYC — Aadhaar + PAN + Bank + RC + DL
- **Module:** 1 — Registration & Onboarding      **Priority:** P0
- **Roleplay:** You are Suresh. You upload your documents so the platform verifies you and lets you accept trips.
- **Preconditions:** Profile saved.
- **Test data:** 5 test scans (jpg/png ≤ 5 MB): Aadhaar, PAN, bank proof, RC (MH-15-AB-4471), DL.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open KYC screen → start a new KYC case for persona "Transport" | Document matrix asks for BASE (Aadhaar, PAN, Bank) + RC + DL |
| 2 | Upload Aadhaar scan → tap Next/Upload | Upload succeeds; document marked uploaded |
| 3 | Upload PAN, then Bank proof | Both upload successfully |
| 4 | Upload RC, then DL | Both upload successfully |
| 5 | Submit the case → check KYC status | Case status = pending; status screen lists all 5 documents; banner may show "KYC not verified — complete it to unlock payouts" until approved |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-10: KYC upload validation — wrong file type and oversized file
- **Module:** 1 — Registration & Onboarding      **Priority:** P1
- **Roleplay:** You are Suresh. You accidentally pick a text file and then a huge photo.
- **Preconditions:** KYC screen open.
- **Test data:** A `.txt` file; a jpg > 5 MB (ask Tester C to generate one).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Try to upload a `.txt` file as Aadhaar | Rejected: only jpeg/png/pdf allowed; file not accepted |
| 2 | Try to upload a > 5 MB photo as PAN | Rejected with `MAX_UPLOAD_BYTES` / "file too large (max 5 MB)" message |
| 3 | (API check with Tester C) submit a case with a wrong doc type, e.g. `{type:"voterId"}` | HTTP 422 `INVALID_DOCUMENT_MATRIX` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-11: [ADMIN] KYC approved → verified badge unlocks payouts
- **Module:** 1 — Registration & Onboarding      **Priority:** P0
- **Roleplay:** You are Suresh. You wait for the platform office to approve your file, then check your status.
- **Preconditions:** KYC case submitted and pending; Tester C on super-admin.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ask Tester C [ADMIN] to open the KYC queue and approve Suresh's transport case (rc + dl must be verified) | Admin sees the case with all 5 docs; approval possible |
| 2 | Pull to refresh your KYC status | Status = verified; verified badge (BadgeCheck) shows on profile |
| 3 | Check the "complete KYC to unlock payouts" banner | Banner is gone |
| 4 | Open Home → check you can see the Load Board and Job Inbox | Both visible; you are now allowed to accept trips |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-12: KYC rejection shows a reason and allows re-submission
- **Module:** 1 — Registration & Onboarding      **Priority:** P1
- **Roleplay:** You are Suresh. The office rejects your DL photo because it is blurry; you re-upload.
- **Preconditions:** A second KYC submission possible (or re-open Suresh's case on staging).
- **Test data:** Blurry DL test file.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ask Tester C [ADMIN] to reject the (re-submitted) case with reason "RC photo blurry" | Rejection recorded with reason |
| 2 | Open KYC status | Status = rejected; the reason "RC photo blurry" is visible to you |
| 3 | Upload a fresh clear RC and re-submit | Case returns to pending; can be approved again |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-13: Vehicle-doc gate — cannot accept a trip with unverified vehicle documents
- **Module:** 1 — Registration & Onboarding      **Priority:** P0
- **Roleplay:** You are Suresh. You added a second truck but its papers are still under review; you try to accept a job with it.
- **Preconditions:** One vehicle with docStatus = pending (or KYC rc/dl not yet approved if run before TC-TRN-11); a booking request exists in the inbox.
- **Test data:** Temp vehicle MH-16-AB-4471 with documents pending.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Fleet → add temp vehicle MH-16-AB-4471 with RC/insurance uploads → save | Vehicle saved; docStatus = pending; note "Documents re-enter review on every change" shown |
| 2 | Open Job Inbox | Warning banner: "a verified vehicle is required before bookings can be accepted" |
| 3 | Open the booking request → tap Accept Job → choose the pending vehicle → confirm | Accept is blocked with `VEHICLE_NOT_VERIFIED` (422); booking stays `requested` |
| 4 | 🔄 Ask Tester A (Farmer) to search nearby vehicles | Suresh's unverified vehicle does NOT appear in nearby-vehicle search |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-14: Add bank account and get it penny-drop verified
- **Module:** 1 — Registration & Onboarding      **Priority:** P0
- **Roleplay:** You are Suresh. You add your HDFC account so trip earnings can be paid out.
- **Preconditions:** KYC verified; on wallet/payout settings.
- **Test data:** A/c 50100234567890, IFSC HDFC0001207 (sandbox).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Wallet → Bank accounts → Add account | Form asks account number, re-enter account number, IFSC, account holder name |
| 2 | Enter 50100234567890 / HDFC0001207 / Suresh Jadhav → Save | Account saved; penny-drop verification starts |
| 3 | 🔄 Ask Tester C [ADMIN] to complete sandbox penny-drop (or wait for auto-verify) | Account verifyStatus becomes "verified" |
| 4 | Set this account as Primary | Primary badge set; without a verified primary account, payout requests are blocked (checked again in Module 15) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-15: Edit profile — address fields editable, phone NOT editable
- **Module:** 1 — Registration & Onboarding      **Priority:** P2
- **Roleplay:** You are Suresh. You correct your village name and try to change your mobile number.
- **Preconditions:** Logged in on website profile view.
- **Test data:** Village "Pimpalgaon Baswant", pincode 422209; GSTIN 27BQKPJ4821F1Z5.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Profile → Edit Profile modal | Modal shows: name, addressLine, village, tehsil, district, state, pincode |
| 2 | Update village, district, pincode, add GSTIN → Save | Saved; profile reflects new values |
| 3 | Try to edit the phone number field | Phone field is read-only / absent — it cannot be edited |
| 4 | Check "Saved items" list | Lists saved mandi-rate/tree/article/ad entries; each has a Remove option that works |
| 5 | Tap Logout | Logged out to login screen |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 2 — Home / Dashboard (Transporter Logistics Cockpit)

> Verify the web cockpit at `/transporter`: header, KPIs, document-expiry banner, 7-day trip calendar, quick links, and the 4 tabs.

### TC-TRN-16: Dashboard KPIs and header render with live data
- **Module:** 2 — Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Suresh. You open the website cockpit first thing in the morning to plan your day.
- **Preconditions:** Logged in on website; at least 1 accepted trip and some earnings exist (or run after Module 5/15).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/transporter` | "Transporter Logistics Cockpit (FT Desk)" loads; header shows "Job Inbox" link with a pending-request count badge and a Refresh button |
| 2 | Read the 4 KPI StatCards | Today's Trips (+ new job requests count), Trips Completed (+ km + vehicle count), Gross Revenue (+ est. net after fuel + 10% commission), Wallet Balance (+ week earnings) — all values plausible and non-negative |
| 3 | Compare Wallet Balance with the Wallet page | Values match |
| 4 | Tap Refresh | Data reloads without error; error banner appears only if the API fails |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-17: Document-expiry amber banner and "Renew in Fleet" link
- **Module:** 2 — Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Suresh. Your truck insurance expires soon; the cockpit reminds you.
- **Preconditions:** One vehicle document expiry within the reminder window (set via Fleet → Edit, or [ADMIN] seed).
- **Test data:** Insurance expiry = today + 20 days on MH-15-AB-4471.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/transporter` | Amber banner at top lists up to 3 nearest expiries (doc name + days left) |
| 2 | Tap "Renew in Fleet" | Navigates to `/transporter/fleet` with the vehicle list |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-18: Trip calendar shows next 7 days of accepted trips
- **Module:** 2 — Home / Dashboard      **Priority:** P2
- **Roleplay:** You are Suresh. You check which days both your trucks are committed.
- **Preconditions:** ≥ 1 accepted trip scheduled within 7 days.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the cockpit, find "Trip Calendar — Next 7 Days" | Day cards for the next 7 days render; accepted trips are grouped under their dates |
| 2 | Tap a day card that has a trip | Opens `/transporter/trips/:id` for that trip |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-19: Quick Links row navigates to all 8 destinations
- **Module:** 2 — Home / Dashboard      **Priority:** P2
- **Roleplay:** You are Suresh. You jump from the cockpit to your ratings, diary and other tools.
- **Preconditions:** On cockpit.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap each Quick Link: Profile, My Bookings, Ratings & Reviews, My Advertisements, AI Analysis, Chatbot, Diary, Booking Requests | Each opens the correct screen without error; Back returns to the cockpit |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-20: Four dashboard tabs — Load Board, Active Trips, Bilty, Settlements
- **Module:** 2 — Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Suresh. You check each tab of the cockpit.
- **Preconditions:** At least 1 trip in progress and 1 delivered trip exist (or plan to re-check after Modules 5/15).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open "Load Board (Auction)" tab | Fare Estimate card, Fare Trends, "Matched for Your Fleet" cards, and the live load board list all render |
| 2 | Open "Active Trips" tab | All bookings not pending/requested are listed with an "Open Trip" button |
| 3 | Open "Bilty Generator" tab | Delivered/completed trips listed with "View / Print Bilty" |
| 4 | Open "P&L / Settlements" tab | Cards (Wallet Balance, TDS Deducted 194-O, Settlements count, Est. Net Profit) + settlements list with "Commission Invoice" per row |
| 5 | Open `/transporter/loads`, `/transporter/trips`, `/transporter/bilty`, `/transporter/settlements` directly | Same component opens with the right tab preselected |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 3 — Vehicle & Fleet Management

> Add Suresh's two trucks (Tata Ace + hired 16-ft Eicher), verify catalog pricing, doc re-review on edit, delete, availability calendar, Go-Live toggle, and GPS pings.

### TC-TRN-21: Add Vehicle 1 — Tata Ace with full form (website)
- **Module:** 3 — Vehicle & Fleet Management      **Priority:** P0
- **Roleplay:** You are Suresh. You onboard your own Tata Ace so you can take small loads.
- **Preconditions:** On `/transporter/fleet`; KYC verified.
- **Test data:** MH-15-AB-4471; Tata Ace; capacity 0.75T; State Permit; future expiry dates.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/transporter/fleet` → "Add vehicle" | Add Vehicle modal opens; tabs "Vehicles (n)" and "Drivers (n)" visible |
| 2 | Select Vehicle Type = Tata Ace | Catalog defaults appear: Base fare ₹500, ₹35/km, 0.75T (label "catalog" shown where overrides are empty) |
| 3 | Enter Registration No. = MH-15-AB-4471 (placeholder shows MH-16-AB-4471 format) | Accepted |
| 4 | Enter Capacity = 0.75; Permit = State Permit | Accepted |
| 5 | Upload vehicle photo (jpg ≤ 5 MB) | Photo saved to `/uploads/vehicles` and shown |
| 6 | Fill RC doc URL, Insurance doc URL, and PUC / Fitness / Insurance / Permit expiry dates (all in the future) | All accepted |
| 7 | Read the note under the form and tap Save | Note "Documents re-enter review on every change (docStatus resets to pending)" is shown; vehicle created (201); card shows docStatus = pending |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-22: Add vehicle validation errors
- **Module:** 3 — Vehicle & Fleet Management      **Priority:** P1
- **Roleplay:** You are Suresh. You try to save a half-filled form.
- **Preconditions:** Add Vehicle modal open.
- **Test data:** Invalid reg "ABC"; capacity 0; past expiry date.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Leave all fields empty → tap Save | Required-field errors shown; vehicle not created |
| 2 | Enter Registration No. = "ABC" → Save | Invalid registration format error |
| 3 | Enter valid reg, set Capacity = 0 (and try a negative value) → Save | Capacity must be > 0 error |
| 4 | Set an expiry date in the past → Save | Expiry-in-past error; vehicle not created |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-23: Add Vehicle 2 — hired 16-ft truck as Eicher 6-Wheeler (extended catalog)
- **Module:** 3 — Vehicle & Fleet Management      **Priority:** P1
- **Roleplay:** You are Suresh. You also run a hired 16-ft truck driven by a hired driver; you list it too.
- **Preconditions:** On Fleet.
- **Test data:** MH-12-GH-8820; Eicher 6-Wheeler; 6T; National Permit.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Add vehicle → select Vehicle Type = Eicher 6-Wheeler | Catalog defaults: Base ₹1,800, ₹55/km, 6T shown |
| 2 | Enter MH-12-GH-8820; Capacity 6; Permit = National Permit; upload photo + RC + insurance; set expiry dates in future | Vehicle created; card shows "Eicher 6-Wheeler • 6T • National Permit" |
| 3 | Check the vehicle card | Card shows photo, registrationNo, type • capacityT • permitType, docStatus pending, available badge, stat tiles (Base Fare "catalog", Per Km "catalog", Insurance/Fitness/PUC/Permit expiry dates) |
| 4 | Repeat "Add vehicle" on the mobile app (VehicleFormSheet) | Mobile form opens with the subset: type dropdown limited to 3 core types (Tata Ace available), reg no (required), capacity, RC upload, insurance upload — extra web fields absent |
| 5 | 🔄 Ask Tester C [ADMIN] to verify documents of both vehicles (rc + dl verified; PUC/fitness/insurance not past date) | Both vehicles show docStatus = verified |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-24: Editing a vehicle resets docStatus to pending
- **Module:** 3 — Vehicle & Fleet Management      **Priority:** P1
- **Roleplay:** You are Suresh. You correct the capacity on your Tata Ace and notice the papers go back for review.
- **Preconditions:** MH-15-AB-4471 verified.
- **Test data:** New base fare override ₹550; capacity 0.8.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the Tata Ace card → Edit | Edit modal prefilled with current values |
| 2 | Change Capacity to 0.8 and Base fare override to ₹550 → Save | Saved; docStatus on the card changes to pending; doc review note shown |
| 3 | 🔄 Ask Tester C [ADMIN] to re-verify the vehicle docs | docStatus back to verified; Base Fare tile shows ₹550 override |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-25: Delete a vehicle with confirmation
- **Module:** 3 — Vehicle & Fleet Management      **Priority:** P1
- **Roleplay:** You are Suresh. You added a wrong duplicate truck and remove it.
- **Preconditions:** Temp vehicle MH-16-AB-4471 exists (from TC-TRN-13).
- **Test data:** MH-16-AB-4471.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the temp vehicle card → tap Delete | Confirmation dialog appears (delete is not instant) |
| 2 | Cancel the dialog | Vehicle still listed |
| 3 | Tap Delete again → confirm | Vehicle removed from the list (soft delete active=false); it no longer appears in `GET /transport/vehicles/my` or in accept-trip vehicle dropdowns |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-26: Vehicle availability calendar — toggle days for next 7 days
- **Module:** 3 — Vehicle & Fleet Management      **Priority:** P1
- **Roleplay:** You are Suresh. Your Tata Ace goes for servicing Thursday; you mark it unavailable that day.
- **Preconditions:** Vehicle verified; on vehicle calendar (mobile: openVehicleCalendar; web: calendar endpoint).
- **Test data:** Block day after tomorrow.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the Tata Ace → calendar view (next 7 days) | Each day shows availability switch and any bookings with their status |
| 2 | Toggle OFF the servicing day → save | Saved via `PUT /transport/vehicles/{id}/availability` with availableDates list |
| 3 | Reopen the calendar | The day stays OFF; other days unchanged |
| 4 | Toggle the day back ON | Saved; day available again |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-27: Go Live / availableNow toggle
- **Module:** 3 — Vehicle & Fleet Management      **Priority:** P1
- **Roleplay:** You are Suresh. You start your day by putting the Tata Ace "Live" so farmers nearby can find it.
- **Preconditions:** Vehicle verified; on Fleet.
- **Test data:** MH-15-AB-4471.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the Tata Ace card, tap "Go Live" | Toggle switches to Live; card shows available badge and availableNow = true |
| 2 | Check the busy/available badges | Busy badge only when on a live trip; otherwise available |
| 3 | Tap the toggle again | Vehicle becomes unavailable (availableNow = false) — instant-book/nearby visibility affected (checked in Module 24) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-28: Vehicle GPS ping updates last location
- **Module:** 3 — Vehicle & Fleet Management      **Priority:** P1
- **Roleplay:** You are Suresh. Before parking for the night you send one location ping from the mobile app.
- **Preconditions:** Mobile app; vehicle verified.
- **Test data:** Lat 19.9975, lng 73.7898 (Nashik), speed 0, note "parked at home".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open vehicle → send location ping with lat/lng/speed/heading/notes | `POST /transport/vehicles/{id}/location` succeeds; lastLocation updates on the fleet card |
| 2 | Send a ping with availableNow = true in the same call | Ping saved and vehicle flips to available |
| 3 | 🔄 Ask Tester C to confirm location freshness rule | Location anchor valid 24 h; a stale (>24 h) ping does not surface the vehicle in nearby search |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 4 — Job Inbox & Negotiation

> Direct booking requests from farmers: inbox list, locked chat, accept with verified vehicle, reject with reason, and fare negotiation (send / accept / counter / decline offers, round limit).

### TC-TRN-29: Job inbox lists requests with no-verified-vehicle warning
- **Module:** 4 — Job Inbox & Negotiation      **Priority:** P1
- **Roleplay:** You are Suresh. A farmer sent you a direct booking request; you open your inbox.
- **Preconditions:** 🔄 Tester A (Farmer) creates a booking request targeting Suresh's vehicle type; Suresh has ≥ 1 requested booking.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Home → "Job Inbox" (badge count matches pending requests) | `/transporter/inbox` opens; bookings with status requested/pending listed |
| 2 | Read a request card | Shows route, crop/qty, pickup date/time, fare offered, status badge |
| 3 | (Check with no verified vehicles) | Warning banner: "a verified vehicle is required before bookings can be accepted (422 VEHICLE_NOT_VERIFIED)" |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-30: Chat is locked before accepting
- **Module:** 4 — Job Inbox & Negotiation      **Priority:** P1
- **Roleplay:** You are Suresh. You want to message the farmer before deciding, but the chat is locked.
- **Preconditions:** A requested booking in inbox (status = requested).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the request card, tap "Chat" | Chat is disabled with tooltip "Chat unlocks after you accept" |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-31: Accept a job with a verified vehicle
- **Module:** 4 — Job Inbox & Negotiation      **Priority:** P0
- **Roleplay:** You are Suresh. The Nashik→Pune onion load at ₹8,500 looks good; you accept it for your Tata Ace.
- **Preconditions:** Verified vehicle available; booking in inbox.
- **Test data:** Vehicle MH-15-AB-4471; fare ₹8,500.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the request → tap "Accept Job" | Accept modal opens with a vehicle dropdown listing ONLY verified vehicles |
| 2 | Select MH-15-AB-4471 → confirm | `POST /transport/bookings/{id}/accept {vehicleId, vehicleNo}` succeeds; booking status = accepted; transporterId set |
| 3 | Open the bell/notifications | `chat_unlocked` notification with deep link `/dashboard/p/transport/trips/{id}/chat` is present |
| 4 | 🔄 Check Farmer Ramesh's phone (second tester — see 07_cross_persona_e2e.md) | Farmer receives "बुकिंग स्वीकृत" / `booking_confirmed` notification |
| 5 | Open the trip from Active Trips | Trip detail opens; 7-step tracker shows "Accepted" as current step |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-32: Reject a job with a reason
- **Module:** 4 — Job Inbox & Negotiation      **Priority:** P1
- **Roleplay:** You are Suresh. A load for tomorrow conflicts with your Pune trip, so you reject it politely.
- **Preconditions:** Another booking in inbox.
- **Test data:** Reason "वाहन उपलब्ध नहीं" (or typed "Busy on another trip").

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the request → tap Reject | Reject modal opens with reason textarea |
| 2 | Type "ab" (2 chars) → submit | Error: reason must be at least 3 characters |
| 3 | Enter a valid reason → confirm (mobile: pick quick reason "वाहन उपलब्ध नहीं") | `POST /transport/bookings/{id}/reject {reason}` succeeds; booking → cancelled; card leaves inbox |
| 4 | 🔄 Check Farmer Ramesh's phone | Farmer receives "बुकिंग अस्वीकृत" notification containing Suresh's reason |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-33: Send a negotiation offer on a requested booking
- **Module:** 4 — Job Inbox & Negotiation      **Priority:** P1
- **Roleplay:** You are Suresh. ₹8,000 is too low for 210 km; you counter with ₹8,600 and a note about tarpaulin.
- **Preconditions:** A requested booking in inbox.
- **Test data:** Offer fare ₹8,600; message "Tarpaulin available, loading at 6 AM".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the request → tap "Negotiate Fare" | Offer thread modal opens (empty except system note); round counter shown |
| 2 | Enter fare ₹8,600 and a message → Send Offer | `POST /transport/bookings/{id}/offer {farePaise>0, message}` succeeds; offer appears with fromRole = transporter and status badge pending |
| 3 | 🔄 Check Farmer Ramesh's phone | Farmer notified `booking_offer_received` with ₹ amount |
| 4 | Enter fare ₹0 or empty → try Send | Rejected: fare must be greater than 0 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-34: Accept the farmer's pending offer — fare locks
- **Module:** 4 — Job Inbox & Negotiation      **Priority:** P1
- **Roleplay:** You are Suresh. The farmer agrees to pay your asking; you accept his offer.
- **Preconditions:** 🔄 Farmer has sent a pending offer on Suresh's booking; another offer may exist.
- **Test data:** Farmer offer ₹8,600.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Negotiate Fare → see the farmer's pending offer (rounds, fare, status badge) | Offer listed as pending with fromRole = farmer |
| 2 | Tap "Accept Fare" | `POST .../offers/{offer_id}/accept` succeeds; fare locks (`farePaise`/`fare` = accepted value); all other pending offers auto-decline |
| 3 | Check booking status | Booking becomes accepted with Suresh as transporterId |
| 4 | Open the bell/notifications | `booking_offer_accepted` — "Offer accepted / प्रस्ताव स्वीकृत" with the locked ₹ amount |
| 5 | 🔄 Check Farmer Ramesh's phone | Farmer sees the offer accepted and booking confirmed |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-35: Counter the farmer's offer
- **Module:** 4 — Job Inbox & Negotiation      **Priority:** P1
- **Roleplay:** You are Suresh. The farmer offers ₹8,200; you counter at ₹8,400.
- **Preconditions:** 🔄 Farmer has a pending offer on a requested booking.
- **Test data:** Counter fare ₹8,400.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Negotiate Fare on the farmer's pending offer → tap Counter | Counter form opens (fare + message) |
| 2 | Enter ₹8,400 + message → Send | `POST .../offers/{offer_id}/counter` succeeds; new round appears with fromRole = transporter; round count increases |
| 3 | 🔄 Check Farmer Ramesh's phone | Farmer notified `booking_offer_countered` with ₹ amount and round number |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-36: Decline the farmer's offer
- **Module:** 4 — Job Inbox & Negotiation      **Priority:** P1
- **Roleplay:** You are Suresh. The farmer's offer is too low and you do not want to continue on this booking.
- **Preconditions:** 🔄 Farmer has a pending offer on a requested booking.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Negotiate Fare on the pending offer → tap Decline | `POST .../offers/{offer_id}/decline` succeeds; offer badge = declined |
| 2 | Open the bell/notifications | `booking_offer_declined` notification present |
| 3 | 🔄 Check Farmer Ramesh's phone | Farmer sees the decline; fare not locked; booking still requested (or cancelled if farmer cancels) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-37: Negotiation stops after 6 rounds
- **Module:** 4 — Job Inbox & Negotiation      **Priority:** P2
- **Roleplay:** You are Suresh. You and the farmer haggle back and forth until the system stops you.
- **Preconditions:** 🔄 Farmer available to exchange offers on one booking.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Alternate sending offers/counters with the farmer until 6 rounds complete | Each round (max 6) is recorded with fare, fromRole, status |
| 2 | 🔄 Farmer (or you) tries to send the 7th offer | Blocked with `OFFER_ROUND_LIMIT` (409); no new round created |
| 3 | Try to accept a non-pending (already declined) offer | Blocked with `OFFER_NOT_PENDING` (409) |
| 4 | (API check with Tester C) a third user calls `GET /transport/bookings/{id}/offers` | HTTP 403 — offers visible only to the negotiating parties |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 5 — Trip Execution (status state machine)

> Walk the whole state machine: requested → accepted → arrivedPickup → loading → enRoute → reachedDestination → unloading → delivered, plus skips, illegal transitions, cancels, and no-show strikes.

### TC-TRN-38: Trip detail shows the 7-step tracker
- **Module:** 5 — Trip Execution      **Priority:** P1
- **Roleplay:** You are Suresh. You open your accepted trip to see what happens next.
- **Preconditions:** An accepted trip exists.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/transporter/trips/:id` | 7-step tracker shows: Accepted → Reached pickup → Loading → In transit → Reached destination → Unloading → Delivered; current step highlighted |
| 2 | Look at the action buttons | "Mark X" button exists ONLY for the allowed next step(s) |
| 3 | Scroll to the activity/waypoints area | waypointsLog lists each passed waypoint with Hindi label and timestamp |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-39: Pickup-side milestones — arrived pickup, loading, in transit
- **Module:** 5 — Trip Execution      **Priority:** P0
- **Roleplay:** You are Suresh. You reach the farm at 6 AM, watch the onion sacks load, and start rolling.
- **Preconditions:** Accepted trip (Nashik→Pune); Suresh at pickup.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap "Mark Reached pickup" | Status = arrivedPickup; waypoint appended (Hindi label + timestamp) |
| 2 | 🔄 Ask Tester A to open the farmer's bell | Farmer notified `trip_arrived_pickup` |
| 3 | Tap "Mark Loading" | Status = loading; farmer notified `trip_loading` 🔄 |
| 4 | Tap "Mark In transit" (enRoute) | Status = enRoute; farmer notified `trip_enroute` 🔄; trip now counts as live |
| 5 | Repeat steps 1–4 on the mobile app | Mobile chain works: accepted → "ट्रिप शुरू करें" (enRoute) with Hindi status labels |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-40: Destination-side milestones — reached destination, unloading
- **Module:** 5 — Trip Execution      **Priority:** P0
- **Roleplay:** You are Suresh. You reach Pune Market Yard and unload.
- **Preconditions:** Trip in enRoute.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap "Mark Reached destination" | Status = reachedDestination; farmer notified `trip_reached_destination` 🔄 |
| 2 | Tap "Mark Unloading" | Status = unloading; farmer notified `trip_unloading` 🔄 |
| 3 | Confirm "Mark Delivered" is NOT used yet | Delivered happens only via POD flow (Module 7) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-41: Skip a transition — accepted straight to in transit
- **Module:** 5 — Trip Execution      **Priority:** P1
- **Roleplay:** You are Suresh. You are in a hurry and mark the trip in transit directly from accepted.
- **Preconditions:** A second accepted trip.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On an accepted trip, tap "Mark In transit" | Allowed (skip accepted→enRoute); status = enRoute; waypoint logged; farmer notified `trip_enroute` 🔄 |
| 2 | From reachedDestination, tap "Mark Delivered" via the PATCH path later in Module 7 | Skip reachedDestination→delivered is allowed per state machine |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-42: Illegal transition is rejected
- **Module:** 5 — Trip Execution      **Priority:** P1
- **Roleplay:** You are Suresh. You fat-finger a button on a finished trip.
- **Preconditions:** A delivered trip and a live trip available.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open a delivered trip → try any "Mark …" action (e.g., Mark Loading) | Rejected with `ILLEGAL_TRANSITION` (409); status stays delivered; nothing logged |
| 2 | Open an unloading trip → try "Mark Reached pickup" | Rejected with `ILLEGAL_TRANSITION` (409); status unchanged |
| 3 | (API check with Tester C) PATCH an accepted booking to `delivered` directly | 409 `ILLEGAL_TRANSITION` — only allowed edges work |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-43: Cancel an accepted trip outside the pickup window
- **Module:** 5 — Trip Execution      **Priority:** P1
- **Roleplay:** You are Suresh. Two days before pickup your driver falls sick; you cancel in good time.
- **Preconditions:** Accepted trip whose pickup is > 24 h away.
- **Test data:** Reason "driver sick, vehicle not available".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the trip → Cancel → enter reason (min 3 chars) → confirm | Status = cancelled via PATCH; reason recorded |
| 2 | Open Compliance → Strike Ledger | NO new strike (cancelled outside the 24 h window) |
| 3 | 🔄 Check Farmer Ramesh's phone | Farmer notified `booking_cancelled` with the reason |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-44: Cancel inside the 24-hour pickup window records a no-show strike
- **Module:** 5 — Trip Execution      **Priority:** P0
- **Roleplay:** You are Suresh. You cancel at the last minute — the platform must penalise you.
- **Preconditions:** Accepted trip with pickup within 24 h.
- **Test data:** Reason "tyre puncture en route".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the trip → Cancel → confirm with reason | Booking = cancelled; because pickup is within cancelWindowHours (24 h) a no-show strike is recorded (`noShowStrikes` + 1) |
| 2 | Open `/transporter/compliance` | Strike count increased by 1; strike ledger shows reason, date, bookingId with "strike" badge |
| 3 | 🔄 Check Farmer Ramesh's phone | Farmer notified of cancellation (farmer-side flow unaffected) |
| 4 | Read the explainer | "3 strikes suspend load-board access" is shown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-45: Assign a driver to an accepted trip
- **Module:** 5 — Trip Execution      **Priority:** P2
- **Roleplay:** You are Suresh. Your hired driver Mahesh will drive the Eicher, so you put his name on the trip.
- **Preconditions:** Accepted trip on the Eicher; driver exists (Module 22).
- **Test data:** Driver Mahesh Gaikwad, +91 98220 66002.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the accepted trip → Assign driver → pick/enter Mahesh's name and phone → Save | `POST /transport/bookings/{id}/assign-driver` succeeds; driverName/driverPhone show on the trip card |
| 2 | After the trip moves to enRoute, try Assign driver again | Blocked — assign-driver works only while status = accepted |
| 3 | Check the bilty | Driver name/phone appear in vehicleDetails/driver section |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-46: Farmer receives every milestone notification (bell check on both sides)
- **Module:** 5 — Trip Execution      **Priority:** P1
- **Roleplay:** You are Suresh. After every tap, the farmer must know exactly where his produce is.
- **Preconditions:** 🔄 Tester A live on Farmer Ramesh's device; a trip runs through all statuses.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Run a trip through arrivedPickup → loading → enRoute → reachedDestination → unloading, and after each tap ask Tester A to open the bell 🔄 | Farmer's bell shows `trip_arrived_pickup`, `trip_loading`, `trip_enroute`, `trip_reached_destination`, `trip_unloading` in order, each with Hindi+English title and a deep link to the trip |
| 2 | Tap one notification on the farmer's phone 🔄 | Opens the trip detail at the right booking |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-47: Transporter cannot use the booker-only cancel endpoint
- **Module:** 5 — Trip Execution      **Priority:** P2
- **Roleplay:** You are Suresh. A bad integration tries the farmer's cancel API with your login.
- **Preconditions:** Tester C can call the API with Suresh's token.
- **Test data:** Accepted booking id.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Ask Tester C to call `POST /transport/bookings/{id}/cancel` with Suresh's auth token | HTTP 403 — cancel endpoint is booker-only; transporter must use PATCH cancelled |
| 2 | Ask Tester C to PATCH `{status:"cancelled"}` from a delivered booking | 409 `ILLEGAL_TRANSITION` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 6 — Live Tracking / Location / Route

> Location is **manual pings only** (no telematics). Verify website "Ping Current Location", the mobile waypoint stepper with quick check-in chips, farmer milestone notifications, route map, ETA and the default-location fallback.

### TC-TRN-48: Ping current location from the website
- **Module:** 6 — Live Tracking      **Priority:** P1
- **Roleplay:** You are Suresh. At the highway toll you open the cockpit and ping your position from your laptop.
- **Preconditions:** Accepted/enRoute trip; website open.
- **Test data:** Lat 20.0110, lng 73.7900, speed 45 km/h, heading 180°, note "At Pathardi toll".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the trip → tap "Ping Current Location" | Ping form opens (lat, lng, speedKmH, heading, waypoint, waypointLabel, notes) |
| 2 | Enter the values → submit | `POST /transport/bookings/{id}/location` succeeds; waypoint appended to the trip log |
| 3 | 🔄 Ask Tester A to open the farmer's trip view | Farmer sees updated lastLocation (no notification — only milestones notify) |
| 4 | Ping without lat/lng | Validation error: coordinates required |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-49: Mobile live-tracking stepper and quick check-in chips
- **Module:** 6 — Live Tracking      **Priority:** P1
- **Roleplay:** You are Suresh driving the truck; you tap the big check-in buttons one by one.
- **Preconditions:** Live trip on the mobile app.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open "लाइव GPS ट्रैकिंग व रूट" (openLiveTracking) | Waypoint stepper shows: accepted → at_pickup → weighbridge → in_transit → mandi_gate → delivered |
| 2 | Tap the next waypoint button | Ping sent; stepper advances; location updates |
| 3 | Use the quick check-in chips: "खेत पर पहुंचे", "धर्मकांटा वजन", "हाईवे ट्रांजिट", "मंडी गेट" | Each chip sends the matching waypoint ping |
| 4 | Note the coordinates while parked | In the dev build pings use synthetic lat/lng increments — record actual behavior as expected for this build |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-50: Milestone pings notify the farmer (trip_milestone)
- **Module:** 6 — Live Tracking      **Priority:** P1
- **Roleplay:** You are Suresh. You ping at pickup, at loading and at unloading; the farmer gets milestone alerts.
- **Preconditions:** 🔄 Tester A on farmer device; live trip.
- **Test data:** Waypoints at_pickup, loaded, unloading.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Send a location ping with waypoint = at_pickup | Ping saved |
| 2 | 🔄 Ask Tester A to open the farmer's bell | Farmer received `trip_milestone` notification for "at pickup" |
| 3 | Repeat with waypoint = loaded, then unloading | Each milestone ping produces exactly one `trip_milestone` notification 🔄; non-milestone pings produce none |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-51: Route map and GEO_REQUIRED error
- **Module:** 6 — Live Tracking      **Priority:** P2
- **Roleplay:** You are Suresh. You check the road route your trip will follow.
- **Preconditions:** Trip with pickup/drop coords.
- **Test data:** Nashik→Pune coords.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the trip → view RouteMap | Polyline from pickup to drop renders (provider or haversine); route cached |
| 2 | (API check with Tester C) call `GET /transport/bookings/{id}/route` on a booking without coordinates | 422 `GEO_REQUIRED` |
| 3 | If the geo provider is down (Tester C simulates) | 502 `GEO_PROVIDER_ERROR`; website degrades to a hint card, does not crash |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-52: ETA and default location fallback
- **Module:** 6 — Live Tracking      **Priority:** P2
- **Roleplay:** You are Suresh. Before your first ping you check what the farmer sees.
- **Preconditions:** Accepted trip with distance 210 km and no pings yet.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ask Tester A to open the farmer's trip view before any ping | lastLocation shows the default fallback (19.9975, 73.7898 — Nashik); note this hardcoded fallback in your notes |
| 2 | Check estimatedMinutesLeft | = max(distanceKm × 1.5, 15) → 210 × 1.5 = **315 minutes**; same value shows on the public share view |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 7 — Proof of Delivery (POD)

> Deliver by OTP-verified POD or photo PATCH; negative paths; multi-stop POD; rating prompts opened for both sides.

### TC-TRN-53: Full POD-OTP delivery flow
- **Module:** 7 — Proof of Delivery      **Priority:** P0
- **Roleplay:** You are Suresh. At Pune Market Yard the receiver gives you the 6-digit OTP the farmer shared; you photograph the unloaded sacks and finish the trip.
- **Preconditions:** Trip in enRoute / reachedDestination / unloading; 🔄 Farmer Ramesh can reveal the POD OTP.
- **Test data:** Receiver "Dattaram Sawant"; 1–2 delivery photos (jpg).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Ask Tester A to reveal the POD OTP on the farmer side 🔄 ( farmer taps "Reveal POD OTP" — booker-only action) | Farmer sees a fresh 6-digit OTP with expiry timer |
| 2 | On the trip, tap "Verify POD OTP" | OTP modal opens: 6-digit OTP input, receiver name (required), delivery photo upload |
| 3 | Enter the OTP, receiver name "Dattaram Sawant", upload 2 photos → submit | `POST /transport/bookings/{id}/verify-pod-otp` succeeds; booking = delivered |
| 4 | Check the POD block on the trip | pod saved: photos, receiverName, deliveredAt, otpVerified = true; photos stored under `/uploads/pod` |
| 5 | Open the bell/notifications + 🔄 farmer's bell | Farmer notified `trip_delivered` ("inspect and rate your transporter"); rating prompts opened for BOTH sides (`transport_delivery` farmer→transporter, `transport_shipper` transporter→farmer) |
| 6 | Open P&L / diary of income | Auto P&L income entry `freight_income` = fare × 100 paisa created |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-54: POD OTP error paths
- **Module:** 7 — Proof of Delivery      **Priority:** P1
- **Roleplay:** You are Suresh. A receiver dictates the OTP wrong; then you keep guessing.
- **Preconditions:** Live trip in enRoute with farmer OTP revealed; a second trip for already-verified check.
- **Test data:** Wrong OTP 111111 (5 attempts); stale OTP.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Submit a wrong OTP | 400 `INVALID_OTP`; attempt count increments by 1 |
| 2 | Keep submitting wrong OTPs until the cap | After max attempts (`HANDOVER_OTP_MAX_ATTEMPTS`): 422 `OTP_MAX_ATTEMPTS` |
| 3 | 🔄 Ask the farmer to reveal a fresh OTP, wait past its validity window, then submit it | 422 `OTP_EXPIRED` — farmer must reveal/regenerate |
| 4 | Try to verify POD OTP again on the already-delivered trip | 409 `ALREADY_VERIFIED`; "Verify POD OTP" button disabled after verification |
| 5 | Submit before OTP generation (never revealed) | `OTP_NOT_GENERATED` error |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-55: Deliver via "Mark Delivered" with photos + receiver
- **Module:** 7 — Proof of Delivery      **Priority:** P0
- **Roleplay:** You are Suresh. The receiver has no network for OTP; you deliver with photos and his name instead.
- **Preconditions:** Trip in unloading; 🔄 farmer informed.
- **Test data:** Receiver Dattaram Sawant, +91 98220 55501; 2 photos; damageNotes "2 sacks torn, noted".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap "Mark Delivered (photos + receiver)…" | Form: podPhotos upload, receiverName, receiverPhone (optional), damageNotes |
| 2 | Upload 2 photos, fill receiver details → submit | PATCH status = delivered succeeds; pod block saved with photos/receiver/damageNotes/deliveredAt |
| 3 | Check both bells 🔄 | Same rating prompts opened for both sides; farmer notified `trip_delivered` |
| 4 | Repeat on the mobile PodSection | Mobile flow works: receiver name + up to 3 photos via PhotoUploader (`pod/{bookingId}/…`) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-56: POD without photo or receiver name is rejected
- **Module:** 7 — Proof of Delivery      **Priority:** P1
- **Roleplay:** You are Suresh. You try to finish the trip without proof.
- **Preconditions:** Trip in unloading.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap "Mark Delivered" with NO photos and empty receiver name → submit | 422 `POD_REQUIRED` with fieldErrors listing photo + receiverName |
| 2 | On mobile, submit the PodSection empty | Same `POD_REQUIRED` field errors shown inline under the fields |
| 3 | Upload photos but leave receiver name empty → submit | Still rejected: receiverName required |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-57: POD OTP is disabled before enRoute
- **Module:** 7 — Proof of Delivery      **Priority:** P1
- **Roleplay:** You are Suresh. You try to finish a trip that has not started.
- **Preconditions:** Accepted (not yet enRoute) trip.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open an accepted trip → look for "Verify POD OTP" | Button disabled (enabled only in enRoute / reachedDestination / unloading) |
| 2 | (API check with Tester C) call verify-pod-otp on the accepted booking | 409 `ILLEGAL_TRANSITION` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-58: Multi-drop per-stop POD
- **Module:** 7 — Proof of Delivery      **Priority:** P1
- **Roleplay:** You are Suresh. One trip has three drops — Pune, then two shops in Chakan; you deliver stop by stop.
- **Preconditions:** Live trip.
- **Test data:** 3 stops (labels ≤ 120 chars): "Pune Market Yard Gate 4", "Chakan Shop 1", "Chakan Shop 2"; 1 photo per stop.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Add 3 stops to the booking (either party can add) | `POST /transport/bookings/{id}/stops` accepts 1–25 stops; each with label/address/eta |
| 2 | Deliver stop 1 with 1 photo + note | `POST .../stops/1/pod` succeeds (fleet operator); photo required |
| 3 | Try to deliver stop 1 again | `STOP_ALREADY_DELIVERED` |
| 4 | Deliver stop 2 with the booking POD OTP filled in | If otp supplied it is validated against booking `podOtp`; wrong OTP → `INVALID_OTP` |
| 5 | (API check) deliver stop 99 | `STOP_NOT_FOUND` |
| 6 | Try to add a stop after the trip is delivered | Blocked — stops not allowed on delivered/cancelled/breakdown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-59: Rating prompts open for both directions after delivery
- **Module:** 7 — Proof of Delivery      **Priority:** P1
- **Roleplay:** You are Suresh. After delivery both you and the farmer are asked to rate each other.
- **Preconditions:** A freshly delivered trip.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Ratings page | "Pending — rate the farmer after delivery" lists the new trip |
| 2 | 🔄 Ask Tester A to check the farmer's ratings | Farmer has a pending `transport_delivery` prompt for Suresh |
| 3 | Check both bells 🔄 | Both sides received their rating-prompt notifications |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 8 — Digital Bilty / Lorry Receipt, Receipts, Weighbridge

> Verify the Hindi e-bilty (LR) with its fixed math, the default weighbridge slip, recording a real weighbridge slip, trip receipt PDF, and the commission-invoice access rule.

### TC-TRN-60: View and print the digital bilty
- **Module:** 8 — Bilty / Receipts / Weighbridge      **Priority:** P1
- **Roleplay:** You are Suresh. The farmer asks for a proper LR for his records; you generate it.
- **Preconditions:** A delivered/completed trip.
- **Test data:** Fare ₹8,500 trip.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Home → Bilty Generator tab → "View / Print Bilty" on the delivered trip | Modal opens from `GET /transport/bookings/{id}/bilty` |
| 2 | Read the LR header | LR number = `LR-2026-{bookingId}`; mobile layout shows "किसान सेतु डिजिटल लॉजिस्टिक्स" and "मोटर वाहन अधिनियम अनुसार वैध ई-बिल्टी" |
| 3 | Tap Print / Save PDF | Print dialog / PDF download works (mobile Download PDF shows its toast — note behavior) |
| 4 | Check the share icon and verification stamp (mobile BiltyView) | Share icon present; verification stamp shown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-61: Bilty contents follow the fixed LR math
- **Module:** 8 — Bilty / Receipts / Weighbridge      **Priority:** P1
- **Roleplay:** You are Suresh. You verify every figure on the LR is correct.
- **Preconditions:** Bilty open; trip with fare ₹8,500, no weighbridge recorded yet, no detention.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Check consignor / consignee / vehicleDetails blocks | Names, locations, contacts and vehicle details present and correct |
| 2 | Check goods block | Commodity, weightQuintals, packaging correct; **declaredValue = fare × 8 = ₹68,000** |
| 3 | Check freightCharges | grossFare ₹8,500; loadingLabor ₹300; detentionCharge ₹0; **advancePaid = 40% = ₹3,400**; **balancePayable = 60% + 300 = ₹5,400** |
| 4 | Check weighbridgeSlip (none recorded) | Default slip shown: `DK-…` "श्री गणेश धर्मकांटा, पिंपलगाव", tare 1420 / gross 3950 / net 2530 — record that these are hardcoded demo defaults |
| 5 | Check qrVerificationCode and Hindi terms line | `AGRO-TMS-VERIFY-{bookingId}` QR code; Hindi terms line present |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-62: Record a real weighbridge slip
- **Module:** 8 — Bilty / Receipts / Weighbridge      **Priority:** P1
- **Roleplay:** You are Suresh. At the dharmkanta you weigh the loaded truck: tare 1,420 kg, gross 4,680 kg.
- **Preconditions:** Live or delivered trip.
- **Test data:** slipNo DK-9842, name default "धर्मकांटा", tare 1420, gross 4680, slip photo.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the trip → record weighbridge (mobile sheet or API): slipNo DK-9842, tare 1420, gross 4680, leave net empty, add slip photo + note | `POST /transport/bookings/{id}/weighbridge` succeeds; **net auto = 4680 − 1420 = 3260 kg** |
| 2 | Check the trip log | Waypoint "weighbridge" appended with Hindi label and timestamp |
| 3 | 🔄 Check Farmer Ramesh's bell | Farmer notified `weighbridge_recorded` with the net weight |
| 4 | Reopen the bilty | weighbridgeSlip now shows DK-9842 with the real weights (default slip replaced) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-63: Trip receipt (JSON + PDF) shows fare, commission, escrow
- **Module:** 8 — Bilty / Receipts / Weighbridge      **Priority:** P2
- **Roleplay:** You are Suresh. You download the trip receipt for your files.
- **Preconditions:** Delivered, paid trip.
- **Test data:** Fare ₹8,500.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `GET /transport/bookings/{id}/receipt` (via link/button) and then the `.pdf` download | receiptNo, farePaisa (₹8,500), commissionPaisa (10% = ₹850), netPaise (₹7,650), escrowStatus, verification code all shown; PDF downloads |
| 2 | (API check) open the receipt as the farmer | Allowed (party-only); as a third user → 403 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-64: Commission invoice PDF is only for the assigned transporter
- **Module:** 8 — Bilty / Receipts / Weighbridge      **Priority:** P2
- **Roleplay:** You are Suresh. You download your commission invoice for GST records.
- **Preconditions:** Delivered trip assigned to Suresh.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Settlements tab → "Commission Invoice" on the trip row | `GET /transport/bookings/{id}/commission-invoice` PDF opens (platform commission invoice) |
| 2 | (API check) ask Tester C to fetch the same invoice with the farmer's token | 403 — assigned transporter only |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 9 — Trip Expenses & P&L

> Add expenses per category; verify the net-profit formula; mobile Hindi expense sheet with the green/red gradient card.

### TC-TRN-65: Add trip expenses and verify net profit math
- **Module:** 9 — Trip Expenses & P&L      **Priority:** P1
- **Roleplay:** You are Suresh. You log diesel, toll and driver bata for the Pune trip and check your real profit.
- **Preconditions:** Delivered trip, fare ₹8,500 (+ ₹150 detention if TC-TRN-67 ran on it — use a separate trip here).
- **Test data:** Diesel ₹2,600; toll ₹425; driver_bata ₹500; loading_labor ₹300.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the trip → "Trip Expenses" → Add expense | Modal: category dropdown (diesel, toll, driver_bata, loading_labor, mandi_cess, maintenance, other), amount ₹, note, receipt photo URL |
| 2 | Add all four expenses one by one | Each saved via `POST /transport/bookings/{id}/expenses`; list shows all four with totals |
| 3 | Open `GET /transport/bookings/{id}/expenses` totals | grossFare ₹8,500; totalExpenses ₹3,825; platformCommission 10% = ₹850; **netProfit = 8500 − 3825 − 850 = ₹3,825** |
| 4 | Repeat on the mobile "ट्रिप खर्च व शुद्ध मुनाफा" sheet | Hindi categories (डीजल, टोल टैक्स, चालक दैनिक भत्ता, हमाली/पल्लेदारी, मंडी प्रवेश फीस, टायर/पंचर/मरम्मत, अन्य); net-profit card green (≥0) or red (<0) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-66: Expense validation errors
- **Module:** 9 — Trip Expenses & P&L      **Priority:** P2
- **Roleplay:** You are Suresh. You try to log a zero-rupee entry.
- **Preconditions:** Trip expenses modal open.
- **Test data:** Amount 0; amount −100; no category.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Select category diesel, enter amount 0 → Save | Rejected: amount must be > 0 |
| 2 | Enter amount −100 → Save | Rejected (no negative expenses) |
| 3 | Leave category unselected (if UI allows) → Save | Rejected: category required |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 10 — Detention / Waiting charges (FT-2)

> Start/stop the waiting timer per phase, verify slab billing after 60 free minutes, error paths, and that detention reaches the bilty, the P&L and the farmer.

### TC-TRN-67: Detention timer and slab billing
- **Module:** 10 — Detention      **Priority:** P0
- **Roleplay:** You are Suresh. The farmer keeps your truck waiting 91 minutes at pickup; the system bills ₹150.
- **Preconditions:** Trip in accepted / arrivedPickup / loading / enRoute (pickup phase); 🔄 Tester C can advance the clock or use a long real wait.
- **Test data:** Phase Pickup; 91 billable minutes after the 60 free minutes.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the trip → "Detention / Waiting (FT-2)" card | Card shows the copy "60 free minutes, then auto-billed slabs (cap ₹2,000)" and phase selector (Pickup / Drop) |
| 2 | Select phase Pickup → tap "Start Timer" | `POST .../waiting {phase:pickup, action:start}` succeeds; timer shows running |
| 3 | After 91 total minutes (🔄 Tester C adjusts the clock), tap "Stop Timer" | Stop succeeds; summary stored on booking `detention`: billable = 91 − 60 = 31 min → ceil(31/30) = 1 slab × ₹150 = **₹150** |
| 4 | Repeat at drop phase (enRoute → reachedDestination → unloading allowed) | Drop-phase timer runs and bills the same way |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-68: Waiting timer error paths
- **Module:** 10 — Detention      **Priority:** P1
- **Roleplay:** You are Suresh. You double-tap Start and later Stop a timer that was never started.
- **Preconditions:** Trip with an open pickup timer; a delivered trip for status checks.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | With the pickup timer already running, tap "Start Timer" again | `WAITING_ALREADY_OPEN` error; no second timer created |
| 2 | On a fresh trip, tap "Stop Timer" without starting | `WAITING_NOT_OPEN` error |
| 3 | On a delivered trip, try to start a timer | 409 `WAITING_NOT_ALLOWED` |
| 4 | (API check with Tester C) start a pickup-phase timer while status = unloading | 409 `WAITING_NOT_ALLOWED` — pickup phase allowed only in accepted/arrivedPickup/loading/enRoute |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-69: Detention reaches the bilty, the P&L and the farmer
- **Module:** 10 — Detention      **Priority:** P1
- **Roleplay:** You are Suresh. The ₹150 waiting charge must show everywhere it belongs.
- **Preconditions:** Trip with ₹150 detention recorded (TC-TRN-67).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Reopen the bilty for the trip | freightCharges shows detentionCharge ₹150; balancePayable includes it |
| 2 | Check the trip expenses/P&L totals | detentionChargePaisa included; netProfit = gross + detention − expenses − commission |
| 3 | 🔄 Check Farmer Ramesh's bell | Farmer notified `detention_recorded` with the ₹150 amount |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 11 — Damage Disputes

> Raise a damage claim with evidence; validation; receiving a dispute; admin resolution.

### TC-TRN-70: Raise a damage dispute on a trip
- **Module:** 11 — Damage Disputes      **Priority:** P1
- **Roleplay:** You are Suresh. Two onion sacks were already wet at pickup; you file a claim.
- **Preconditions:** Live or delivered trip (not breakdown/cancelled).
- **Test data:** Claim ₹1,500; evidence photo URLs (comma-separated); note "2 sacks wet at loading".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the trip → "Damage Disputes" card → "Raise Dispute" | Modal: claim amount ₹, evidence photo URLs (required), notes |
| 2 | Enter ₹1,500, two photo URLs, note → submit | `POST /transport/bookings/{id}/damage-disputes` succeeds; dispute status = open |
| 3 | (If the trip was insured) check the dispute | Auto-tagged `insuranceClaim = true` with `coveragePaisaAtClaim` snapshot |
| 4 | 🔄 Check the other party's bell | Farmer notified `damage_dispute_opened` with the claim amount |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-71: Damage dispute validation
- **Module:** 11 — Damage Disputes      **Priority:** P2
- **Roleplay:** You are Suresh. You try to claim a negative amount and to file without photos.
- **Preconditions:** Raise Dispute modal open.
- **Test data:** Claim −₹100; no evidence.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Enter claim −100 → submit | 422 `INVALID_CLAIM` (claimPaisa must be ≥ 0) |
| 2 | Enter valid amount but no evidence photo URLs → submit | UI blocks submission (evidence required by the form) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-72: Receive a dispute and [ADMIN] resolution
- **Module:** 11 — Damage Disputes      **Priority:** P2
- **Roleplay:** You are Suresh. The farmer claims you overloaded his sacks; the office settles it.
- **Preconditions:** 🔄 Farmer Ramesh opens a dispute on Suresh's trip.
- **Test data:** Farmer claim ₹2,000.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the bell/notifications | `damage_dispute_opened` with claim ₹2,000 |
| 2 | Open the trip → Damage Disputes list | The farmer's dispute is listed with claim amount and status open |
| 3 | 🔄 Ask Tester C [ADMIN] to resolve the dispute (permission `RESOLVE_TRANSPORT_DISPUTE`) | Status changes to resolved |
| 4 | 🔄 Ask Tester C to resolve the same dispute again | 409 `DISPUTE_NOT_OPEN` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 12 — Breakdown (mid-trip)

> Report a breakdown; verify pro-rata settlement math, refund to the booker, wallet credit, TDS line, and error paths.

### TC-TRN-73: Breakdown pro-rata settlement
- **Module:** 12 — Breakdown      **Priority:** P0
- **Roleplay:** You are Suresh. Near Sangamner the Eicher overheats 120 km into a 210 km trip; you report the breakdown.
- **Preconditions:** Live trip (accepted…unloading), fare ₹8,500, distance 210 km; 🔄 farmer has paid into escrow.
- **Test data:** Note "Engine overheated near Sangamner, towed back"; completedDistanceKm 120.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the trip → "Vehicle Breakdown" card → report breakdown | Modal: note (required), current location, distance covered km |
| 2 | Fill note + location + 120 km → submit | `POST /transport/bookings/{id}/breakdown` succeeds; booking status = breakdown |
| 3 | Verify pro-rata math | proRata = 8500 × (120/210) ≈ **₹4,857**; commission 10% on pro-rata ≈ ₹486; net ≈ ₹4,371 credited to Suresh's wallet (credit "breakdown pro-rata"); TDS ledger line recorded |
| 4 | 🔄 Check Farmer Ramesh's side | Farmer notified "Vehicle breakdown / गाड़ी खराब … settled pro-rata"; remainder (8500 − proRata ≈ ₹3,643) refunded via Razorpay refund |
| 5 | Try any status change on the breakdown booking | Blocked — breakdown is a payment-closed status |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-74: Breakdown validation
- **Module:** 12 — Breakdown      **Priority:** P2
- **Roleplay:** You are Suresh. You write a 2-character note and claim 500 km on a 210 km trip.
- **Preconditions:** Live trip.
- **Test data:** Note "ab"; completedDistanceKm 500.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Submit breakdown with note "ab" | Rejected: note must be 3–500 chars |
| 2 | Submit with completedDistanceKm 500 (trip is 210 km) | Rejected or clamped: completed distance must be ≤ trip distance and ≥ 0 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-75: Breakdown from a non-live status is rejected
- **Module:** 12 — Breakdown      **Priority:** P2
- **Roleplay:** You are Suresh. You try to "break down" a trip that is already delivered.
- **Preconditions:** Delivered or cancelled trip.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | (API check with Tester C) POST breakdown on a delivered booking | 409 — breakdown allowed only from live statuses (accepted…unloading) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 13 — Load Board / Auction Marketplace

> Browse/search/filter loads, use the fare estimate on the board, place bids with prefilled fare, negative paths, counter-offers, bid acceptance creating a booking, matched loads, return loads, urgent-load pushes.

### TC-TRN-76: Browse, search and filter the load board
- **Module:** 13 — Load Board      **Priority:** P1
- **Roleplay:** You are Suresh. Every evening you scan the board for tomorrow's Nashik→Pune loads.
- **Preconditions:** Load board has open loads (4 Hindi demo loads appear if the DB is empty).
- **Test data:** Search "प्याज़"; crop chips सभी / टमाटर / प्याज़ / फल / सब्ज़ियां.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Load Board tab (web) or "लोड बाज़ार (Agri Load Board)" (mobile) | "लाइव स्पॉट रेट्स" label and live load list render; urgent loads pinned first |
| 2 | Type "प्याज़" in the search field ("खेत, मंडी या फसल से खोजें…") | List filters to onion loads |
| 3 | Tap crop filter chips one by one | Each chip filters the list correctly; "सभी" resets |
| 4 | Read a load card | Shows: crop chip, perishable badge (if perishable), target fare, route + km, qty / packaging / preferred vehicle, notes, bids count + pickup date |
| 5 | Clear search/filters on a board with no matches | Empty state shown (no crash) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-77: Fare estimate card on the load board
- **Module:** 13 — Load Board      **Priority:** P1
- **Roleplay:** You are Suresh. Before bidding you check what 210 km should cost in a Tata Ace.
- **Preconditions:** Load board open.
- **Test data:** Vehicle type Tata Ace; distance 210 km.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | In the Fare Estimate card, select vehicleType (dropdown lists all 6 catalog types) and enter distanceKm 210 → Estimate | `POST /transport/fare-estimate` returns base ₹500, distance ₹7,350 (35×210), loading ₹300, toll ₹85×⌈210/50⌉ = ₹425, perishable ₹0, return discount ₹0, **total ≈ ₹8,575** |
| 2 | Read the Fare Trends bar list | Avg/min/max ₹/km bands shown from delivered bookings (or empty state) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-78: Place a bid on an open load
- **Module:** 13 — Load Board      **Priority:** P0
- **Roleplay:** You are Suresh. An onion load shows target ₹8,500; you bid ₹8,300 with your Tata Ace and a note about your 6 AM loading.
- **Preconditions:** Open load on the board; Suresh has ≥ 1 vehicle.
- **Test data:** Quoted fare ₹8,300; vehicle MH-15-AB-4471; note "ETA 6 PM, tarpaulin available, loading at 6 AM"; pickup time default "सुबह 06:00 बजे".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap "Place Bid" / "बोली लगाएं" on a load card | Bid modal/bottom sheet opens: quoted fare **prefilled from targetFare**, vehicle dropdown with "No vehicle attached" option, helper text showing the farmer's budget, pickup time prefilled "सुबह 06:00 बजे", notes field (placeholder "ETA, tarpaulin available, loading at 6 AM…") |
| 2 | Keep ₹8,300 (or adjust), select the Tata Ace, add note → Submit Bid | `POST /transport/loads/{id}/bid` succeeds; success message; bid count on the card increases by 1 |
| 3 | (If on Pro plan — 🔄 Tester C upgrades) place an equal-fare bid from a second transporter account | Pro/Enterprise bids get `priority = true` and rank first at equal fare |
| 4 | 🔄 Check the load owner's phone (Farmer Ramesh) | Farmer receives FCM "नया भाड़ा प्रस्ताव (Bid Received)" with Suresh's amount |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-79: Bid validation errors
- **Module:** 13 — Load Board      **Priority:** P1
- **Roleplay:** You are Suresh. You try to bid zero rupees.
- **Preconditions:** Bid sheet open.
- **Test data:** Fare 0 / empty / negative.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Clear the quoted fare → submit | Rejected: quoted fare required |
| 2 | Enter ₹0 (and try a negative value) → submit | Rejected: fare must be > 0 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-80: Bidding on a non-open load is rejected
- **Module:** 13 — Load Board      **Priority:** P2
- **Roleplay:** You are Suresh. A load is already booked but still on your screen.
- **Preconditions:** 🔄 Farmer Ramesh accepts some transporter's bid on a load (bid id ≠ Suresh's).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Try to bid on that load (stale screen) | 409 `LOAD_NOT_OPEN`; the load no longer accepts bids |
| 2 | Pull to refresh the board | Load shows status booked and no bid button |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-81: Receive and answer a counter-offer on a bid
- **Module:** 13 — Load Board      **Priority:** P1
- **Roleplay:** You are Suresh. The farmer counters your ₹8,300 with ₹8,100; you accept.
- **Preconditions:** Suresh's bid is pending; 🔄 Farmer Ramesh will counter it.
- **Test data:** Counter ₹8,100.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ask Tester A to counter Suresh's bid (Idempotency-Key required — done by the app) | Suresh receives FCM "काउंटर ऑफर (Counter Offer)" |
| 2 | Open the notification / bid view | Counter amount ₹8,100 shown against his ₹8,300 |
| 3 | Accept the counter (or reply per UI) | Accepted; 🔄 farmer sees bid accepted path in TC-TRN-82 |
| 4 | 🔄 Ask Tester A to counter the same bid a second time | 422 `COUNTER_LIMIT_REACHED` (one counter per bid) |
| 5 | (API check with Tester C) farmer counter without Idempotency-Key header | 400 `IDEMPOTENCY_KEY_REQUIRED` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-82: Bid accepted — booking is born accepted
- **Module:** 13 — Load Board      **Priority:** P0
- **Roleplay:** You are Suresh. The farmer picks your bid; you get the job confirmed with everything attached.
- **Preconditions:** Suresh's bid pending on an open load; 🔄 Farmer Ramesh accepts it.
- **Test data:** Bid ₹8,300 with vehicle MH-15-AB-4471.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ask Tester A to tap "Accept bid" on Suresh's bid | Load → booked |
| 2 | Open the bell/notifications | Suresh receives "बोली स्वीकृत! (Bid Accepted)" + pickup reminder + `chat_unlocked` |
| 3 | Open Active Trips | A new booking exists, born **accepted** with the bid fare (₹8,300) and Suresh's vehicle attached |
| 4 | Open the chat room from the notification deep link | Chat room (id = booking id, kind transport) opens; both parties' first names + crop label shown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-83: Matched loads with reasons
- **Module:** 13 — Load Board      **Priority:** P2
- **Roleplay:** You are Suresh. The cockpit pre-filters loads that fit your fleet.
- **Preconditions:** Profile routes/specializations set (Module 1); open loads exist.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open "Matched for Your Fleet" (`GET /transport/loads/matched`) | Cards ranked with `matchReasons` shown (e.g., +2 vehicle type match, +1 route preference, +1 history corridor) |
| 2 | (If loadBoardSuspended — see TC-TRN-106) call matched loads | 403 `SUSPENDED_FROM_LOAD_BOARD` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-84: Return loads after a trip
- **Module:** 13 — Load Board      **Priority:** P2
- **Roleplay:** You are Suresh. You delivered in Pune and want a backhaul load so you never drive empty.
- **Preconditions:** Suresh has an enRoute or delivered trip (e.g., Nashik→Pune).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `GET /transport/trips/{trip_id}/return-loads` for the Pune trip | Open loads whose pickup overlaps the trip's drop place-tokens, pickup date within trip date + 3 days, ranked by match |
| 2 | (API check with Tester C) call return-loads on a requested (not live) trip | 409 `TRIP_NOT_ACTIVE` — trip must be enRoute/delivered |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-85: Urgent load nearby push
- **Module:** 13 — Load Board      **Priority:** P2
- **Roleplay:** You are Suresh. A farmer 20 km away posts an urgent load; you get a ping because your truck is verified and Live.
- **Preconditions:** Suresh's vehicle verified + availableNow = true; 🔄 Farmer Ramesh posts an urgent load with pickup coords within 50 km.
- **Test data:** Urgent load at Pimpalgaon (within 50 km of Nashik).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ask Tester A to post an urgent load with pickup lat/lng near Nashik | — |
| 2 | Open your phone | Push `urgent_load_nearby` arrives (verified, available owners within 50 km only; deduped — one per owner) |
| 3 | Toggle the vehicle to unavailable → 🔄 farmer posts another urgent load | No new ping for Suresh |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 14 — Fare Tools

> Standalone fare estimate with breakdown, surge clamp, unknown-vehicle error, and fare trends bands.

### TC-TRN-86: Fare estimate for the two catalog types Suresh runs
- **Module:** 14 — Fare Tools      **Priority:** P1
- **Roleplay:** You are Suresh. You quote a Mumbai run for the Eicher before bidding.
- **Preconditions:** Any screen with the fare estimator (or API).
- **Test data:** Eicher 6-Wheeler, Nashik→Mumbai 170 km: base ₹1,800 + 55×170 = ₹9,350 + loading ₹300 → ₹11,450 (toll ₹85×⌈170/50⌉ = ₹255 if ≥50 km rule applies — verify against breakdown).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Estimate Tata Ace 210 km (TC-TRN-77 values) then Eicher 170 km | Breakdown shows baseFare, distanceFare, loadingLabor, perishableSurcharge 0, tollEstimate, returnDiscount 0, totalFare, perKmRate, capacityTonnes, distanceKm, distanceSource |
| 2 | 🔄 Ask Tester C to test surgeMultiplier 1.8 via API | Surge clamped to [1.0, 1.5] (`SURGE_MULTIPLIER_CAP`) |
| 3 | Send pickup/drop coords instead of distanceKm | Server road distance wins (distanceSource shows geo) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-87: Unknown vehicle type rejected
- **Module:** 14 — Fare Tools      **Priority:** P2
- **Roleplay:** You are Suresh. A bad vehicle name reaches the estimator.
- **Preconditions:** API access with Tester C.
- **Test data:** vehicleType "Alien Truck".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Ask Tester C to POST fare-estimate with vehicleType "Alien Truck" | 422 `UNKNOWN_VEHICLE_TYPE` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-88: Fare trends bands
- **Module:** 14 — Fare Tools      **Priority:** P2
- **Roleplay:** You are Suresh. You check the going ₹/km rate before pricing a long run.
- **Preconditions:** 🔄 Several delivered trips exist (run Modules 5/7 first).
- **Test data:** pickup Nashik, drop Pune, vehicleType Tata Ace.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `GET /transport/fare-trends?pickup=Nashik&drop=Pune&vehicleType=Tata Ace` | Overall + per-band (under50km / 50to200km / 200to500km / over500km) avg/min/max ₹/km in paisa, each with sampleSize |
| 2 | Query a route nobody has driven | Empty/zero state with sampleSize 0 — no crash |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 15 — Wallet, Payouts, Settlements, Ledger

> Wallet ledger, escrow release with 10% commission and TDS, payout with MPIN to the penny-drop bank, payout errors, payouts list with UTR, settlements with commission invoice, TDS card, personal ledger, and the driver restriction.

### TC-TRN-89: Wallet view and ledger entries
- **Module:** 15 — Wallet / Settlements      **Priority:** P0
- **Roleplay:** You are Suresh. You open the wallet to see what you actually earned.
- **Preconditions:** At least one escrow release or breakdown pro-rata has happened (Modules 12/this module), or a payout debit exists.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/transporter/wallet` | StatCards: Wallet Balance ("Withdrawable now"), TDS Deducted (194-O rate %), Ledger Entries count |
| 2 | Read the ledger entries | Credits: "escrow released" / "breakdown pro-rata"; debits: "payout to bank"; running balance = Σ credits − Σ debits |
| 3 | Compare the balance with the dashboard Wallet card | Numbers match |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-90: Escrow release credits the wallet (10% commission + TDS)
- **Module:** 15 — Wallet / Settlements      **Priority:** P0
- **Roleplay:** You are Suresh. The trip is delivered and dispute-free; you release the escrow.
- **Preconditions:** Delivered trip; 🔄 Farmer Ramesh has paid the fare (escrow held).
- **Test data:** Fare ₹8,500.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ask Tester A to pay the fare for the trip (Razorpay sandbox; amount = fare + insurance premium if opted) | Escrow = held; farmer notified `fare_payment_captured` 🔄; chat unlocked on the accepted trip |
| 2 | Open the trip → "Release Escrow" | Release succeeds (manual `POST .../escrow/release`) |
| 3 | Verify the math | Commission = 10% = ₹850 to platform; **net ₹7,650 credited to Suresh's wallet**; TDS 194-O ledger line; platform ledger line `escrow_rel_` |
| 4 | Open the wallet | Balance increased by the net amount; ledger shows "escrow released" credit |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-91: Escrow release is blocked in the wrong states
- **Module:** 15 — Wallet / Settlements      **Priority:** P1
- **Roleplay:** You are Suresh. You try to release money too early, twice, or during a dispute.
- **Preconditions:** 🔄 Farmer available for payments/disputes.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On an unpaid booking, try Release Escrow | 409 `ESCROW_NOT_HELD` |
| 2 | On an accepted-but-not-delivered booking inside the dispute window, try to release | 409 `ESCROW_NOT_DUE` (only delivered, or after the dispute window) |
| 3 | 🔄 Ask Tester A to open a damage dispute, then try Release Escrow | 409 `ESCROW_DISPUTE_OPEN` — blocked while any dispute is open |
| 4 | Release the same escrow again after a successful release | 409 `ESCROW_ALREADY_RELEASED` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-92: Request a payout of the full wallet balance
- **Module:** 15 — Wallet / Settlements      **Priority:** P0
- **Roleplay:** You are Suresh. Saturday night you move the week's earnings to your HDFC account.
- **Preconditions:** Wallet balance > 0; primary verified bank account; MPIN set.
- **Test data:** Amount field left empty (= full balance); MPIN 1234.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Wallet → "Request Payout" | Form: amount ₹ (optional, helper "empty = full balance"; max = balance), MPIN (4-digit password input, required) |
| 2 | Leave amount empty → enter MPIN `1234` → confirm | `POST /transport/payouts` succeeds; success message; payout id `tpay_…` created |
| 3 | Check the wallet | Balance debited by the full amount; ledger entry "payout to bank" |
| 4 | Open the Payouts tab | New row: amount, date, **RazorpayX payout id shown as UTR**, status badge |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-93: Payout validation errors
- **Module:** 15 — Wallet / Settlements      **Priority:** P0
- **Roleplay:** You are Suresh. You enter a wrong MPIN and then try to overdraw.
- **Preconditions:** Wallet open; balance known (e.g., ₹7,650).
- **Test data:** MPIN 9999; amount ₹99,999; amount ₹0.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Request payout with MPIN "9999" | 401 `WRONG_MPIN`; no payout created |
| 2 | Request amount ₹99,999 (> balance) | 422 `INSUFFICIENT_BALANCE` |
| 3 | Request amount ₹0 | 422 `AMOUNT_INVALID` |
| 4 | (With Tester C) remove the primary bank account / set it unverified, then request a valid payout | 422 `NO_VERIFIED_BANK_ACCOUNT` |
| 5 | (API check) payout with MPIN never set on a fresh account | 409 `MPIN_NOT_SET` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-94: Payouts list shows UTR and status
- **Module:** 15 — Wallet / Settlements      **Priority:** P1
- **Roleplay:** You are Suresh. You check whether Saturday's payout reached the bank.
- **Preconditions:** ≥ 1 payout requested.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Wallet → Payouts tab | Each row shows amount, date, RazorpayX payout id as UTR, and a status badge (processing/completed/failed) |
| 2 | 🔄 Ask Tester C to check the sandbox RazorpayX dashboard | Payout exists with the same UTR and amount |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-95: Settlements list with commission invoice per row
- **Module:** 15 — Wallet / Settlements      **Priority:** P1
- **Roleplay:** You are Suresh. You review the weekly settlement lines the finance team will pay.
- **Preconditions:** ≥ 1 delivered trip in the settlement period.
- **Test data:** Week with one ₹8,500 trip.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Home → Settlements tab (`GET /transport/settlements`) | Lines show: period (start–end), trip count, gross ₹8,500, platform fee 10% = ₹850, net ₹7,650, status badge (pending/paid) |
| 2 | Tap "Commission Invoice" on a row | Invoice modal from `GET /transport/bookings/{id}/commission-invoice` opens |
| 3 | 🔄 (If a line is held) Ask Tester C [ADMIN/finance] to release it | Held lines are released/rejected by finance admin; over ₹10,000 requires a different admin (maker-checker) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-96: TDS 194-O card matches the ledger
- **Module:** 15 — Wallet / Settlements      **Priority:** P1
- **Roleplay:** You are Suresh. You verify the tax deducted on your earnings.
- **Preconditions:** A wallet credit with a TDS line exists.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Compare the "TDS Deducted (194-O)" card with the TDS ledger lines | Amount and rate (from `TDS_194O_RATE` config) match; 🔄 Tester C can confirm the configured rate in admin |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-97: Personal platform ledger (penalties & compensation)
- **Module:** 15 — Wallet / Settlements      **Priority:** P2
- **Roleplay:** You are Suresh. A farmer cancelled late last week; you check whether your 50% compensation landed.
- **Preconditions:** 🔄 Farmer Ramesh cancels an accepted trip < 24 h (or < 2 h) before pickup.
- **Test data:** Fare ₹8,500; farmer cancel < 24 h → 10% penalty = ₹850 → Suresh compensated ₹425.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ask Tester A to cancel a paid/accepted trip within 24 h of pickup | Farmer penalty = 10% of fare (< 2 h → 25%) |
| 2 | Open `GET /transport/ledger/mine` | `comp_` line shows ₹425 transporter compensation (50% of penalty); `platformDuesPaisa` reflects the farmer's side |
| 3 | Open the bell/notifications | Suresh notified `booking_cancelled` with the compensation amount |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-98: Driver sub-account cannot view settlements
- **Module:** 15 — Wallet / Settlements      **Priority:** P1
- **Roleplay:** You are Suresh. Your driver Mahesh tries to peek at your money pages.
- **Preconditions:** Driver account exists and is logged in on a second device (Module 22).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ask the driver (Tester C) to open `GET /transport/settlements` with the driver token | 403 `DRIVERS_CANNOT_VIEW_SETTLEMENTS` |
| 2 | 🔄 Driver tries the payout endpoint | Blocked the same way; owner account still sees everything normally |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 16 — Ratings & Reputation

> Rate the farmer after delivery (stars/tags/review), one-rating-per-trip, delivered-only rule, received/given tabs, computed reputation.

### TC-TRN-99: Rate the farmer after delivery
- **Module:** 16 — Ratings & Reputation      **Priority:** P1
- **Roleplay:** You are Suresh. The load was ready on time and weighed correctly; you give Ramesh 5 stars.
- **Preconditions:** Delivered trip with a pending `transport_shipper` rating.
- **Test data:** 5 stars; tags good_communication + accurate_weight; review "Load ready at 6 AM sharp" (≤ 500 chars).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Ratings → "Pending — rate the farmer after delivery" → "Rate farmer" | Modal: 1–5 stars, 5 tag chips (load_ready_on_time, accurate_weight, good_communication, delayed_loading, load_not_as_described), review textarea (max 500) |
| 2 | Select 5 stars, two tags, write the review → submit | `POST /transport/bookings/{id}/rate-farmer` succeeds; the trip leaves the Pending list |
| 3 | 🔄 Ask Tester A to open the farmer's profile | Farmer's `farmerRatingStats` count/average include Suresh's rating and tags |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-100: Cannot rate the same trip twice
- **Module:** 16 — Ratings & Reputation      **Priority:** P1
- **Roleplay:** You are Suresh. You try to rate the same farmer again by reopening the modal.
- **Preconditions:** Trip already rated in TC-TRN-99.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | (API check with Tester C) POST rate-farmer on the same booking | 409 `ALREADY_RATED` — one rating per trip |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-101: Cannot rate before delivery
- **Module:** 16 — Ratings & Reputation      **Priority:** P1
- **Roleplay:** You are Suresh. You try to rate a farmer while the trip is still running.
- **Preconditions:** Accepted/enRoute trip.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Check the Ratings page for that trip | Trip not in "Pending — rate" list (only delivered trips appear) |
| 2 | (API check with Tester C) POST rate-farmer on the live booking | Rejected — booking must be delivered |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-102: Ratings received / given tabs
- **Module:** 16 — Ratings & Reputation      **Priority:** P2
- **Roleplay:** You are Suresh. You read what farmers say about you and check what you gave.
- **Preconditions:** 🔄 Farmer Ramesh has rated Suresh on a delivered trip.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Ratings → "Received" tab (`GET /transport/ratings`) | Aggregate average + count + tag tallies shown; average stars also shown in the tab bar |
| 2 | Open "Given by me" (`GET /transport/ratings/given`) | Lists the ratings Suresh gave (farmer name, stars, review) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-103: Computed reputation stats
- **Module:** 16 — Ratings & Reputation      **Priority:** P2
- **Roleplay:** You are Suresh. You check how the platform computes your reputation.
- **Preconditions:** ≥ 1 delivered trip.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the transport profile stats | Shows: rating average, onTimePct (delivered ≤ scheduled date), fleetUtilization (busy vehicle-days ÷ activeVehicles × 30), totalTrips, activeTrips, lifetimeEarnings |
| 2 | (If data is thin) note the values | Analytics fallback constants (rating 4.9, on-time 98.2%, utilization 85.5%) may appear — record this in your notes as a demo fallback, not real data |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 17 — Compliance

> Compliance stats (strikes, load-board status, rating, chat restriction), strike ledger + enforced penalty matrix, and 3-strike suspension blocking the load board.

### TC-TRN-104: Compliance page stats
- **Module:** 17 — Compliance      **Priority:** P1
- **Roleplay:** You are Suresh. After your last-minute cancel you check how much trouble you are in.
- **Preconditions:** At least the strike from TC-TRN-44 recorded.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/transporter/compliance` | StatCards: Strikes (no-show count, "3 = suspension"), Load Board (Active / SUSPENDED), Average Rating, Chat Restriction (Muted until date / Open) — all match Suresh's actual state |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-105: Strike ledger and enforced penalty matrix
- **Module:** 17 — Compliance      **Priority:** P2
- **Roleplay:** You are Suresh. You read the rules so you know exactly what a last-minute cancel costs.
- **Preconditions:** On compliance page.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Read the Strike Ledger | Each strike shows reason, date, bookingId, "strike" badge |
| 2 | Read the Enforced Penalty Matrix | Shows: cancel window 24 h before pickup; strikes to suspend = 3; farmer cancel < 24 h = 10% of fare, < 2 h = 25%; transporter compensation 50% of penalty; transporter cancel inside window = no-show strike; matrix version/effectiveFrom displayed |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-106: Three strikes suspend load-board access
- **Module:** 17 — Compliance      **Priority:** P1
- **Roleplay:** You are Suresh. You got your third strike; the platform must stop you from bidding.
- **Preconditions:** 🔄 Tester C [ADMIN] seeds Suresh with 3 no-show strikes (or run TC-TRN-44 three times).
- **Test data:** 3 strikes.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/transporter/compliance` | Strikes = 3; Load Board card shows SUSPENDED; restrictions listed ("Load board suspended") |
| 2 | Open the Load Board → try "Place Bid" | Blocked with 403 `SUSPENDED_FROM_LOAD_BOARD` (checked at accept and matched loads) |
| 3 | Try `GET /transport/loads/matched` | 403 — suspended transporter gets no matched loads |
| 4 | 🔄 Ask Tester C [ADMIN] to clear the strikes (support action) | Load Board back to Active; bidding works again |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 18 — Analytics & AI Insights (Pro-gated)

> Route analytics and AI insights are Pro features; on the Free plan an upgrade banner must appear. After upgrade, stats, 6-month chart, top routes and suggestions render.

### TC-TRN-107: Analytics is gated on the Free plan
- **Module:** 18 — Analytics & AI      **Priority:** P1
- **Roleplay:** You are Suresh. On the free plan you open AI Analysis and hit the paywall.
- **Preconditions:** Suresh on Free plan.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Quick Links → "AI Analysis" (`/transporter/ai`) | API returns 402 `ENTITLEMENT_EXCEEDED`; page shows banner "Route analytics is a Pro feature" with a link to `/billing` |
| 2 | Tap the upgrade link | Billing page opens |
| 3 | 🔄 Ask Tester C [ADMIN] to upgrade Suresh to Pro (sandbox) | Page now loads: stat cards (totalVehicles, totalTripsCompleted, activeTripsCount, totalGrossRevenue, totalDistanceKm, estimatedDieselExpense @ ₹14.5/km, estimatedNetProfit = gross − diesel − 10%, fleetUtilizationRate, onTimeDeliveryPct, averageRating), 6-month earnings bar chart (recharts), Top Routes table |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-108: AI insights suggestions
- **Module:** 18 — Analytics & AI      **Priority:** P2
- **Roleplay:** You are Suresh. The AI tells you your Nashik→Pune route concentration and idle days.
- **Preconditions:** Pro plan active; ≥ 1 completed trip.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `GET /transport/ai-insights` | routeDemand top-5 routes (6 months), earningsTrend (6 months), utilizationPct, idleDays, and 3–6 suggestions covering: route concentration, empty backhaul, below-platform-average ₹/km, doc renewal ≤ 30 days, low utilization, idle days + evergreen tips |
| 2 | (If data is thin) note the fallback values | rating 4.9 / on-time 98.2% / utilization 85.5% fallbacks may be shown — record as demo fallback |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 19 — Advertisements

> Create/pause/resume/edit/delete a transporter ad; validation; analytics modal with impressions/clicks/CTR/spend.

### TC-TRN-109: Create an advertisement
- **Module:** 19 — Advertisements      **Priority:** P2
- **Roleplay:** You are Suresh. Grape season is coming; you run a small banner ad so farmers book your cold-capable truck.
- **Preconditions:** On `/transporter/ads`.
- **Test data:** Title "Nashik–Pune Daily Parcel"; headline "Tarpaulin-covered on-time trips"; body ≤ 500 chars; banner jpg; placement home_hero; CTA default "Book Now"; target type vehicle → Tata Ace; budget ₹2,000; daily ₹200; start today, end +14 days.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open "My Advertisements" → Create Ad | Modal with: title (min 3), headline (min 5), body (max 500), banner upload (to `/uploads/ads`), placement select (home_hero / course_banner / sidebar_card / store_spotlight), CTA text (max 40, default "Book Now"), target type (course/workshop/external/vehicle), budget ₹, daily budget ₹, start/end dates |
| 2 | Choose target type = vehicle → pick Tata Ace from the fleet dropdown | Vehicle dropdown required for vehicle target; district/area text appears for other target types |
| 3 | Fill everything → submit | Ad created and **auto-activated**; card shows banner, title, headline, description, status badge active, impressions/clicks/CTR/spent tiles, budget progress bar, dates |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-110: Ad validation errors
- **Module:** 19 — Advertisements      **Priority:** P2
- **Roleplay:** You are Suresh. You submit a sloppy ad form.
- **Preconditions:** Create Ad modal open.
- **Test data:** Title "Ad" (2 chars); headline "Sale" (4 chars); body 501 chars.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Enter title "Ad" → submit | Rejected: title min 3 chars |
| 2 | Enter headline "Sale" → submit | Rejected: headline min 5 chars |
| 3 | Paste 501-char body → submit | Rejected: body max 500 chars |
| 4 | Choose vehicle target but no vehicle → submit | Rejected: fleet vehicle required |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-111: Pause, resume and view ad analytics
- **Module:** 19 — Advertisements      **Priority:** P2
- **Roleplay:** You are Suresh. Your budget is draining fast; you pause the ad mid-week.
- **Preconditions:** An active ad exists.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap Pause on the ad card | Status badge changes active → paused; ad no longer serves |
| 2 | Tap Resume | Status back to active |
| 3 | Tap Analytics | Modal shows: status, impressions, clicks, CTR, spend, budget, remaining budget |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-112: Edit and delete an advertisement
- **Module:** 19 — Advertisements      **Priority:** P2
- **Roleplay:** You are Suresh. You fix a typo in the headline and later delete a finished campaign.
- **Preconditions:** An ad exists.
- **Test data:** New headline "Tarpaulin-covered, on-time trips".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap Edit → change headline → save | Card shows the new headline |
| 2 | Tap Delete | Confirmation dialog appears |
| 3 | Cancel, then Delete again and confirm | Ad removed from the list |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 20 — Diary & Chatbot

> Transporter diary (Buy/Sell notes with agriCoins, month summary, search, edit/delete) and the Kisan Mitra chatbot (Hindi, image attach, voice input, session continuity).

### TC-TRN-113: Add a diary note (Buy — diesel) and earn agriCoins
- **Module:** 20 — Diary & Chatbot      **Priority:** P2
- **Roleplay:** You are Suresh. You note down today's diesel purchase with the bill photo.
- **Preconditions:** On `/transporter/diary`.
- **Test data:** Buy (खरीद); title "Diesel refill"; category Fuel/Diesel; qty 40; price ₹4,800; today; photo of bill.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Diary → Add Note | Modal: Buy (खरीद)/Sell (बिक्री) toggle, title, category dropdown (Freight Earning, Fuel/Diesel, Toll & Taxes, Vehicle Maintenance, Tyres & Spares, Loading Labour, Miscellaneous), quantity, price, date, note, photo attach |
| 2 | Fill as Buy → save | Entry saved; response shows `{entry, agriCoinsEarned}` — a toast/line shows the agriCoins earned |
| 3 | Check the trade ledger table | New row: date, entry with category + photo thumb, Buy badge, qty, notes, −₹4,800 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-114: Diary edit, delete, search and month summary
- **Module:** 20 — Diary & Chatbot      **Priority:** P2
- **Roleplay:** You are Suresh. You correct the diesel price, add a freight earning, and check the month's net.
- **Preconditions:** Diary has the Buy entry.
- **Test data:** Sell (बिक्री) entry "Pune trip freight" category Freight Earning ₹8,500.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Edit the diesel entry → price ₹4,600 → save | Updated; agriCoins behavior same as add |
| 2 | Add the Sell freight entry | Row shows Sell badge, +₹8,500 |
| 3 | Use the search box | Filters by title/category correctly |
| 4 | Read the month summary cards | Total Buy ₹4,600, Total Sell ₹8,500, Net +₹3,900 |
| 5 | Delete the diesel entry (confirm) | Entry removed; summary updates |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-115: Kisan Mitra chatbot (Hindi, image, voice, continuity)
- **Module:** 20 — Diary & Chatbot      **Priority:** P2
- **Roleplay:** You are Suresh. You ask the assistant in Hindi what the Pune freight should be, attach a photo of a rate slip, and use the mic.
- **Preconditions:** On `/transporter/chatbot`.
- **Test data:** Text "नाशिक से पुणे 210 किमी टाटा एस का भाड़ा कितना लूँ?".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the chatbot | Kisan Mitra assistant opens with persona `transporter` and Hindi (hi) defaults |
| 2 | Type the Hindi question → send | Reply in Hindi relevant to transporter/fare topics |
| 3 | Attach an image (rate slip photo) and send | Image accepted and acknowledged in the reply |
| 4 | Tap the mic and speak in Hindi (Web Speech API) | Speech is recognised and sent as text (Chrome/Edge); note if unsupported on your browser |
| 5 | Refresh the page and reopen | Session continuity: previous conversation loads (history limit 50) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 21 — In-app Chat (cross-cutting)

> Chat room is auto-created on accept / offer-accept / bid-accept / escrow funding; pre-accept it stays locked; messages flow both ways with read flags.

### TC-TRN-116: Chat unlock notification and room open
- **Module:** 21 — In-app Chat      **Priority:** P1
- **Roleplay:** You are Suresh. After accepting a job you get a notification that chat is open.
- **Preconditions:** Just accepted a booking (TC-TRN-31) or had a bid accepted (TC-TRN-82).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the bell/notifications | `chat_unlocked` notification with deep link `/dashboard/p/transport/trips/{id}/chat` |
| 2 | Tap it (or Inbox "Chat" button → `chat.openDirect({bookingId})`) | Opens `/chat?room={bookingId}`; room shows farmerId/farmerName and buyerId(=Suresh)/buyerName — **first names only** — plus crop label |
| 3 | Check the farmer's side 🔄 | Room visible to Ramesh too, with Suresh's first name only |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-117: Send and receive messages
- **Module:** 21 — In-app Chat      **Priority:** P1
- **Roleplay:** You are Suresh. You message the farmer your ETA; he replies.
- **Preconditions:** Chat room open on both devices.
- **Test data:** Message "Kal subah 6 baje loading, sham tak Pune delivery".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Send the message | Message appears in the room, timestamped, from Suresh |
| 2 | 🔄 Ask Tester A to open the farmer's room | Ramesh sees the message; readByFarmer updates |
| 3 | 🔄 Ask Tester A to reply "Thek hai, mazdoor ready rakhunga" | Reply appears for Suresh; readByBuyer (transporter side) updates |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-118: Chat stays locked before accept (mobile check)
- **Module:** 21 — In-app Chat      **Priority:** P1
- **Roleplay:** You are Suresh. On a fresh request you confirm chat is locked on the mobile app too.
- **Preconditions:** A requested booking on the mobile app.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the booking request on mobile → tap Chat | Chat is disabled with the locked tooltip ("Chat unlocks after you accept"); no room opens |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 22 — Fleet Drivers (Pro feature)

> Pro-gated driver sub-accounts: add driver, assign to trip, driver operates the trip, driver analytics, and the settlements restriction.

### TC-TRN-119: Add a driver (Pro-gated)
- **Module:** 22 — Fleet Drivers      **Priority:** P1
- **Roleplay:** You are Suresh. You want your hired driver Mahesh to run trips from his own login.
- **Preconditions:** Free plan first; then Pro via admin.
- **Test data:** Driver Mahesh Gaikwad, +91 98220 66002.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Fleet → Drivers tab → Add Driver | Add Driver modal (name, phone) |
| 2 | Try to add the driver on the Free plan | 402 `ENTITLEMENT_EXCEEDED` — `driverSubAccounts` is a Pro feature; upgrade banner shown |
| 3 | 🔄 Ask Tester C [ADMIN] to upgrade Suresh to Pro, then add Mahesh | Driver created: user doc with `linkedProfiles:["driver"]` and `fleetOwnerId` = Suresh; driver appears in the Drivers list |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-120: Assign driver to a trip; driver operates it; driver analytics
- **Module:** 22 — Fleet Drivers      **Priority:** P2
- **Roleplay:** You are Suresh. Mahesh drives the Chakan trip himself, pinging milestones from his phone.
- **Preconditions:** Driver account exists; accepted trip.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Assign Mahesh to the accepted trip (Fleet → driver → "Assign to Trip", or trip → assign-driver) | `POST /transport/bookings/{id}/assign-driver {driverName, driverPhone}` succeeds |
| 2 | 🔄 Ask Tester C to log in as Mahesh (driver) on a second device | Driver can open the assigned booking |
| 3 | 🔄 Mahesh pings location, taps milestones, starts/stops waiting, delivers a stop POD | `_fleet_member` / `_assert_trip_operator` allows all of these (transporter or their fleet driver) |
| 4 | Check the driver's Analytics (web) | `GET /transport/drivers/{id}/analytics`: trips total/completed/cancelled, totalKm, grossEarnings, thisMonthEarnings, avgRating — matched by driverPhone/driverName on bookings |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-121: Driver restrictions
- **Module:** 22 — Fleet Drivers      **Priority:** P1
- **Roleplay:** You are Suresh. Mahesh must NOT see your settlements or payouts, and cannot grab new jobs.
- **Preconditions:** Driver logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ask Mahesh to open the settlements and payout pages | 403 `DRIVERS_CANNOT_VIEW_SETTLEMENTS` (covered fully in TC-TRN-98); payouts blocked the same way |
| 2 | 🔄 Mahesh tries to accept an inbox job or bid on the load board | Blocked — drivers can only operate trips assigned to the fleet owner, not take new business |
| 3 | Suresh revokes/removes the driver (if UI supports) or 🔄 admin deletes the driver sub-account | Driver login no longer sees fleet trips |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 23 — Trip Sharing

> Create/copy/re-generate a public share link; sanitized public view; revoke and 48-hour expiry.

### TC-TRN-122: Create and copy a share link
- **Module:** 23 — Trip Sharing      **Priority:** P2
- **Roleplay:** You are Suresh. Your partner wants to follow the truck live; you send her the tracking link.
- **Preconditions:** Live trip.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the trip → "Create Share Link" | `POST /transport/bookings/{id}/share` returns a token link; Copy works |
| 2 | Tap "Re-generate Share Link" | New token issued; the old link stops working (rotated, old revoked) |
| 3 | (API check) try to share a cancelled trip | Blocked — cancelled trips can't be shared |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-123: Public shared view is sanitized
- **Module:** 23 — Trip Sharing      **Priority:** P2
- **Roleplay:** You are Suresh. Your partner opens the link in an incognito window without logging in.
- **Preconditions:** A working share link.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `GET /transport/shared/{token}` in an incognito/private window (no login) | Public page loads: status, route, commodity, vehicleType, vehicleNo, driverName, currentLocation, last 20 waypoints, estimatedMinutesLeft |
| 2 | Inspect the page for private data | NO fares, NO phone numbers, NO user ids anywhere on the page |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-124: Revoke and expiry of a share link
- **Module:** 23 — Trip Sharing      **Priority:** P2
- **Roleplay:** You are Suresh. After delivery you revoke the link; an old link must die.
- **Preconditions:** A share link exists.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Revoke via `DELETE .../share` (button or API) | Link returns 404 `SHARE_NOT_FOUND` (revoked) |
| 2 | 🔄 Ask Tester C to create a short-TTL test token (or mock 48 h) and open it after expiry | 410 `SHARE_EXPIRED` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 24 — Instant Booking / Nearby Vehicles (transporter is passive)

> Suresh does nothing here except keep a vehicle verified + Live: the farmer finds and instantly books the truck.

### TC-TRN-125: Receive an instant booking on a Live verified vehicle
- **Module:** 24 — Instant Booking / Nearby      **Priority:** P1
- **Roleplay:** You are Suresh. You put the Tata Ace Live and within minutes a nearby farmer books it outright.
- **Preconditions:** Vehicle verified + availableNow = true; 🔄 Farmer Ramesh ready.
- **Test data:** Radius default 15 km around Pimpalgaon.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Set Tata Ace Live | availableNow = true |
| 2 | 🔄 Ask Tester A to search `GET /transport/nearby-vehicles?lat&lng` near the pickup and instantly book Suresh's Tata Ace (`POST /transport/instant-bookings` with Idempotency-Key) | Booking is born **accepted** with Suresh (owner) as transporter; chat room created |
| 3 | Open the bell/notifications | Suresh receives `instant_booking`; 🔄 farmer receives `booking_confirmed` |
| 4 | Open Active Trips | The instant booking appears as an accepted trip on the Tata Ace |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-126: Nearby visibility follows the Live toggle
- **Module:** 24 — Instant Booking / Nearby      **Priority:** P2
- **Roleplay:** You are Suresh. When you finish for the day you go "not available" and disappear from the farmer's search.
- **Preconditions:** Vehicle Live.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ask Tester A to search nearby vehicles with the Tata Ace Live | Suresh's vehicle listed with owner rating and custom fare if set |
| 2 | Toggle the vehicle unavailable | — |
| 3 | 🔄 Tester A repeats the search | The Tata Ace is gone from results; instant booking of it is rejected (vehicle must be active, docs verified, available) |
| 4 | 🔄 Tester C calls nearby-vehicles with radiusKm 99 and sort "price" | 422 errors: radius must be 1–50; sort must be fare/distance/rating |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 25 — Transporter-side Booking Creation & Load Templates

> A transporter can also book transport (booker role). Covers creating a booking, its validation, and the job-inbox load templates (New/Repeat/Delete).

### TC-TRN-127: Create a transport booking as a transporter (booker role)
- **Module:** 25 — Booker flows & Templates      **Priority:** P2
- **Roleplay:** You are Suresh. Your hired truck needs to move a friend's onion lot, so you book transport yourself.
- **Preconditions:** Suresh logged in (booker role includes transport).
- **Test data:** vehicleType Bolero Maxi; distance 170 km Nashik→Mumbai; tomorrow; pickupTime 07:00; timeWindowMinutes 60; commodity Onion; weightQuintals 120; packaging "50 kg sacks"; declaredValue ₹60,000 + insuranceOptIn true.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Create a new booking (booking form/API) with the test data | Fare = catalog base + perKm × distance (Bolero: ₹800 + 45×170 = ₹8,450; geo re-resolves if coords given) |
| 2 | Submit | Booking born `requested` with noshowRisk/fit scores; pickup reminder task created |
| 3 | Check where the booking appears for the owner side | Booking visible; a transporter (or Suresh's other profile) can accept it via the inbox flow (Modules 4–5) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-128: Booking creation validation
- **Module:** 25 — Booker flows & Templates      **Priority:** P2
- **Roleplay:** You are Suresh. You submit the booking form with bad values.
- **Preconditions:** Booking form open.
- **Test data:** timeWindowMinutes 10; insuranceOptIn without declaredValue.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Enter timeWindowMinutes 10 → submit | Rejected: window must be 15–720 minutes |
| 2 | Set insuranceOptIn true but leave declaredValue empty → submit | 422 `DECLARED_VALUE_REQUIRED` |
| 3 | (API check) reference someone else's lotId | 404 / 409 — lot must be your own and status open |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-129: Load templates — create, repeat, delete
- **Module:** 25 — Booker flows & Templates      **Priority:** P2
- **Roleplay:** You are Suresh. Your Nashik→Pune onion booking is weekly; you save it as a template and repeat it.
- **Preconditions:** On Job Inbox → templates card.
- **Test data:** Name "Nashik-Pune Onion Weekly" (2–80 chars); route Nashik→Pune; crop Onion; qty 120 quintals; sacks; vehicle Bolero Maxi; targetFare ₹8,500; repeatWeekday 1 (Monday).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap "New Template" → fill all fields → save | `POST /transport/load-templates` succeeds; template listed with name, route, crop, qty, vehicle, target fare, weekday |
| 2 | Tap "Repeat" on the template | A new booking is created from the template with those values |
| 3 | Save a template with a 1-character name | Rejected: name must be 2–80 chars |
| 4 | Tap "Delete" on the template (confirm) | `DELETE /transport/load-templates/{id}` removes it from the list |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 26 — Notifications (transporter-side sweep)

> Every notification the transporter must receive, verified in the bell with correct text and deep link.

### TC-TRN-130: Bell sweep — all transporter notifications arrive with correct text
- **Module:** 26 — Notifications      **Priority:** P1
- **Roleplay:** You are Suresh. During the whole test you collect every notification type in your bell.
- **Preconditions:** Most earlier modules executed (each 🔄 step triggers one).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open bell after each triggered action across the run and tick them off: `booking_offer_accepted` (₹ locked), `booking_offer_declined`, `booking_offer_countered` (with round), counter-offer on a load bid ("काउंटर ऑफर"), bid accepted ("बोली स्वीकृत!" + pickup reminder), `booking_cancelled` (with compensation note if any), `chat_unlocked`, `instant_booking`, `urgent_load_nearby`, `damage_dispute_opened` (claim amount), `trip_starting` (urgent, at trip date), `trip_pickup_reminder` ("Pickup slot for accepted trip"), rating prompt `transport_shipper` | Every type arrived with correct Hindi/English text and a deep link that opens the right screen |
| 2 | Tap 3–4 notifications | Each deep link lands on the correct trip/load/ratings screen |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-131: Vehicle-document expiry reminders (30/7/1 days)
- **Module:** 26 — Notifications      **Priority:** P2
- **Roleplay:** You are Suresh. The app warns you before your insurance expires.
- **Preconditions:** 🔄 Tester C [ADMIN] sets the Tata Ace insurance expiry to +30 days, then +7, then +1 (or seeds the reminder tasks).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | 🔄 Ask Tester C to trigger the reminder job for +30 days | Reminder `vehicle_doc_expiry_insurance` arrives naming the Tata Ace and the date |
| 2 | Repeat for +7 and +1 days | Reminders arrive; the ≤ 7-day one is marked **high priority** |
| 3 | (Note) DL is in the re-verification list | A DL expiry goes through the re-verification job — record behavior; 30-day expiry reminders also apply to PUC/fitness |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 27 — Language (हिन्दी)

> Run onboarding and a core trip flow in हिन्दी; labels must be Hindi with no overflow and no English placeholders.

### TC-TRN-132: Onboarding and dashboard in हिन्दी
- **Module:** 27 — Language      **Priority:** P1
- **Roleplay:** You are Suresh. You switch the app to हिन्दी because you are more comfortable reading it.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Switch app language to हिन्दी | Whole UI switches; no English placeholders left on main screens |
| 2 | Open the transporter profile form | Labels in Hindi: मालिक-चालक 1-2 वाहन / फ्लीट ऑपरेटर 3+ वाहन / लॉजिस्टिक्स एजेंसी, route chips, specialization chips, "24x7 emergency pickup" switch — none overflow their buttons |
| 3 | Open Home and the Load Board | "लोड बाज़ार (Agri Load Board)", search placeholder "खेत, मंडी या फसल से खोजें…", chips सभी/टमाटर/प्याज़/फल/सब्ज़ियां, "लाइव स्पॉट रेट्स", "बोली लगाएं" — all Hindi, no truncated text |
| 4 | Open Job Inbox | Reject quick-reason chips in Hindi: वाहन उपलब्ध नहीं / दूरी ज़्यादा / तारीख सूट नहीं |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-133: Core trip flow in हिन्दी
- **Module:** 27 — Language      **Priority:** P1
- **Roleplay:** You are Suresh. You run a whole trip with the app in Hindi.
- **Preconditions:** An accepted trip; language = हिन्दी.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the trip tracker | Status labels use `TRIP_STATUS_LABELS` Hindi text for each status (accepted → delivered); buttons legible |
| 2 | Tap "ट्रिप शुरू करें" (enRoute) | Status advances with the Hindi label |
| 3 | Open Live Tracking | "लाइव GPS ट्रैकिंग व रूट" with stepper labels and chips खेत पर पहुंचे / धर्मकांटा वजन / हाईवे ट्रांजिट / मंडी गेट |
| 4 | Open the bilty | Full Hindi LR: "किसान सेतु डिजिटल लॉजिस्टिक्स", "मोटर वाहन अधिनियम अनुसार वैध ई-बिल्टी", weighbridge default "श्री गणेश धर्मकांटा, पिंपलगाव" |
| 5 | Open the expenses sheet | "ट्रिप खर्च व शुद्ध मुनाफा" with Hindi category labels and the green/red net-profit card |
| 6 | Check notifications | Milestone notifications show Hindi+English titles, e.g. "गाड़ी खराब" breakdown text |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 28 — Not built (spec-intended absences to confirm)

> ⚠️ The inventory's closing list says these features are **NOT built**: phone/contact display before booking, VoIP/calls, SOS/help center, and telematics (location = manual pings only). For each, verify the absence — and if you FIND the feature present (or its absence breaks a promised flow), raise a defect.

### TC-TRN-134: ⚠️ No phone/contact details shown before a booking exists
- **Module:** 28 — Not built (confirm absence)      **Priority:** P1
- **Roleplay:** You are Suresh. You browse loads and open a farmer's profile — you must NOT see his phone number before any booking.
- **Preconditions:** On the load board / a farmer profile with no booking yet.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open any load card and the load owner's profile before bidding/accepting | No phone number or personal contact detail is displayed anywhere (per spec, contact is hidden pre-booking) |
| 2 | Check the booking request card in the inbox (status requested) | Still no farmer phone number shown |

- ⚠️ Known issue in current build — performing this case will likely FAIL if contact data leaks; raise a defect (privacy/spec violation).
- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-135: ⚠️ No Call / VoIP button anywhere
- **Module:** 28 — Not built (confirm absence)      **Priority:** P1
- **Roleplay:** You are Suresh. You look for a "Call" button on loads, trips and chat — there must be none (in-app chat is the only channel).
- **Preconditions:** Any load card, live trip and chat room.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Inspect load cards, trip detail, bilty and chat room for any Call/VoIP button or phone link | No call button, no tel: link, no VoIP option exists anywhere |

- ⚠️ Known issue in current build — if a call feature IS present, confirm whether it is a spec violation and raise a defect.
- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-136: ⚠️ No SOS / emergency help center
- **Module:** 28 — Not built (confirm absence)      **Priority:** P2
- **Roleplay:** You are Suresh. A driver might expect an SOS button during a night trip — confirm whether the app has any help/emergency entry.
- **Preconditions:** Live trip screens, home menu, profile menu.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Look for SOS / emergency / help-center / support entries on home, trip screens and menus | None exists in the current build |

- ⚠️ Known issue in current build — absence of SOS/help is a known spec gap for this build; performing this case will likely FAIL if the release spec requires it. Raise a defect and let Product decide.
- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-TRN-137: ⚠️ No telematics — location updates are manual pings only
- **Module:** 28 — Not built (confirm absence)      **Priority:** P2
- **Roleplay:** You are Suresh. You confirm the app never tracks GPS in the background; only your manual pings move the marker.
- **Preconditions:** A live trip; location permissions granted.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Start a trip, lock the phone and drive (or sit still) without opening the app for 15 minutes | lastLocation does NOT change by itself — no background GPS tracking exists |
| 2 | Open the app and ping manually | Location jumps only after your manual ping/check-in |

- ⚠️ Known issue in current build — if auto-tracking IS running (battery/background service), record it as a defect against "manual pings only" spec.
- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

## 4. Module coverage matrix

Every module of the transporter inventory is covered by the cases below.

| # | Module (inventory section) | Cases (IDs) | Count |
|---|----------------------------|-------------|------:|
| 1 | Registration, Onboarding & KYC (§1) | TC-TRN-01 – 15 | 15 |
| 2 | Home / Dashboard cockpit (§2) | TC-TRN-16 – 20 | 5 |
| 3 | Vehicle & Fleet Management (§3.1) | TC-TRN-21 – 28 | 8 |
| 4 | Job Inbox & Negotiation (§3.3) | TC-TRN-29 – 37 | 9 |
| 5 | Trip Execution / state machine (§3.4) | TC-TRN-38 – 47 | 10 |
| 6 | Live Tracking / Location / Route (§3.5) | TC-TRN-48 – 52 | 5 |
| 7 | Proof of Delivery (§3.6) | TC-TRN-53 – 59 | 7 |
| 8 | Bilty / Receipts / Weighbridge (§3.7) | TC-TRN-60 – 64 | 5 |
| 9 | Trip Expenses & P&L (§3.8) | TC-TRN-65 – 66 | 2 |
| 10 | Detention / Waiting (§3.9) | TC-TRN-67 – 69 | 3 |
| 11 | Damage Disputes (§3.10) | TC-TRN-70 – 72 | 3 |
| 12 | Breakdown (§3.11) | TC-TRN-73 – 75 | 3 |
| 13 | Load Board / Auction (§3.12) | TC-TRN-76 – 85 | 10 |
| 14 | Fare Tools (§3.13) | TC-TRN-86 – 88 | 3 |
| 15 | Wallet, Payouts, Settlements, Ledger (§3.14) | TC-TRN-89 – 98 | 10 |
| 16 | Ratings & Reputation (§3.15) | TC-TRN-99 – 103 | 5 |
| 17 | Compliance (§3.16) | TC-TRN-104 – 106 | 3 |
| 18 | Analytics & AI Insights (§3.17) | TC-TRN-107 – 108 | 2 |
| 19 | Advertisements (§3.18) | TC-TRN-109 – 112 | 4 |
| 20 | Diary & Chatbot (§3.19) | TC-TRN-113 – 115 | 3 |
| 21 | In-app Chat (§3.20) | TC-TRN-116 – 118 | 3 |
| 22 | Fleet Drivers — Pro (§3.21) | TC-TRN-119 – 121 | 3 |
| 23 | Trip Sharing (§3.22) | TC-TRN-122 – 124 | 3 |
| 24 | Instant Booking / Nearby vehicles (§3.23) | TC-TRN-125 – 126 | 2 |
| 25 | Booker-side booking creation & load templates (§3.24) | TC-TRN-127 – 129 | 3 |
| 26 | Notifications sweep (§6) | TC-TRN-130 – 131 | 2 |
| 27 | Language हिन्दी (README rule 6) | TC-TRN-132 – 133 | 2 |
| 28 | Not built — confirm absence (§7 closing list) | TC-TRN-134 – 137 | 4 |
| | **Total** | **TC-TRN-01 – 137** | **137** |

Cross-persona interactions (inventory §4) and money flows (§5) are exercised inside the cases above (🔄 and [ADMIN] steps), plus the dedicated XP scripts in `07_cross_persona_e2e.md`.

## 5. Sign-off

| Field | Value |
|-------|-------|
| Tester name (Transporter role) | ______________________ |
| Second tester (Farmer role, 🔄 steps) | ______________________ |
| Admin tester ([ADMIN] steps) | ______________________ |
| Date(s) of execution | ______________________ |
| Build / backend commit tested | ______________________ |

**Summary counts**

| Metric | Count |
|--------|------:|
| Total cases | 137 |
| P0 (blockers: login / KYC / money / core flow) | 23 |
| P1 (major features) | 69 |
| P2 (edge / polish) | 45 |
| Passed | ______ |
| Failed | ______ |
| Open defects raised | ______ |

**Release gate (from README):** all P0 pass, ≥ 95% P1 pass, zero open Blocker defects.

Defects raised during this run: ______________________________________________

Tester signature & date: ______________________
