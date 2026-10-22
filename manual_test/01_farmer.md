# Farmer (Kisan) — Manual Test Script (Final UAT)

> This script is for a tester **roleplaying Ramesh Patil, a 42-year-old grape & onion farmer from Nashik**.
> It contains **169 test cases (21 × P0, 104 × P1, 44 × P2)** covering every Farmer module. Estimated
> execution: **3 working days for 2 testers** (several cases need a second tester acting as Vyapari /
> Transporter / Banker / Admin — marked 🔄 and detailed in [07_cross_persona_e2e.md](07_cross_persona_e2e.md)).

## 0. Roleplay card

| Field | Value |
|-------|-------|
| **Name** | Ramesh Patil (रमेश पाटील) |
| **Age** | 42 |
| **Background** | Owns 3 acres in Pimpalgaon Baswant, Nashik (Maharashtra). Grows **grapes (Thompson Seedless)** and **onions (Nashik Red)**. Has one helper, Suresh. Wife **Sunita** runs a papad SHG (Mahila Graha Udyog persona); son studies in Pune. |
| **Language** | Prefers **हिन्दी**; comfortable with basic English |
| **Device** | Android smartphone (primary) + laptop for the web views |
| **Goal for this test** | Register → get KYC & bank verified → sell an onion lot at a good rate → book a gadi → track all money (escrow payout, coins, loan, insurance) |
| **Linked personas** | Vyapari / directBuyer (buys the lot, bids on demands), Transporter (bids on loads), Broker, Bank Manager (loan), Insurance Provider + Admin (claims), Vet, Nursery, Gaushala manager, Mahila Graha Udyog (Sunita), E-Market seller, Super-Admin **[ADMIN]** |

## 1. Account & test data setup

1. Read `manual_test/README.md` first — environment, roles, defect template and execution order apply.
2. Confirm backend `/health` is OK, website and super-admin open, and the mobile app builds.
3. Get a fresh test phone number for Ramesh: **+91 98220 00001** (one phone = one account — do not share).
4. Arrange the second tester (Tester B): Vyapari **+91 98220 00002** (KYC-verified), Transporter **+91 98220 00003**. Their accounts are created per docs `02_transporter.md` / `03_vyapari.md` and coordinated via `07_cross_persona_e2e.md`.
5. On the app, register with the phone number. In dev, the OTP is returned in the `/auth/otp/send` API response — note it (SMS provider is not wired).
6. Set MPIN **4321** (deliberately not the demo `1234`, so real MPIN validation is exercised).
7. Complete onboarding: persona = **Farmer**, state = **Maharashtra**, district = **Nashik**, village = **Pimpalgaon Baswant**, language = **English** (हिन्दी is switched on later in TC-FRM-05), farm size = **3 acres**.
8. Submit KYC and ask **[ADMIN]** to approve it (TC-FRM-06).
9. Add & penny-drop-verify a bank account; make it primary (TC-FRM-08/09).
10. Add crops Grapes + Onion; search and **import 7/12 for Gat No. 312**; upload vault documents.
11. Confirm seeded demo data is visible: mandi rates for Nashik, demo PMFBY insurance policy, vets, gaushalas, schemes, vet list, Kisan Coins balance.
12. Keep the test UPI ID ready for mall payments: **ramesh.patil@upi** (sandbox).

**Test data table (use these values everywhere):**

| Item | Value |
|------|-------|
| Phone / MPIN | +91 98220 00001 / 4321 |
| Name / Vernacular | Ramesh Patil / रमेश पाटील |
| Village / District / State | Pimpalgaon Baswant / Nashik / Maharashtra |
| Farm size / Plot | 3 acres / Gat No. 312, Hissa 2 |
| Crops | Grapes (Thompson Seedless), Onion (Nashik Red) |
| Bank | State Bank of India, A/C 30012345678, IFSC SBIN0001234 |
| UPI (sandbox) | ramesh.patil@upi |
| Test lot | Onion, grade A, 20 q, expected ₹1,450/q, harvest 2026-10-25, pickup at Gate 312 |
| Test lot 2 | Grapes (Thompson Seedless), grade A, 10 q, expected ₹2,800/q |
| Transport route | Pimpalgaon Baswant → Nashik APMC (Gangapur), ≈35 km, 20 q Onion |
| Delivery address | House No 42, Ganesh Chowk, Pimpalgaon Baswant, Nashik 422209 |
| Family | Sunita Patil (wife, papad SHG), son in Pune (donor for gaushala adoption) |

## 2. Preconditions checklist

- [ ] Backend running, `/health` OK; website + super-admin open; app installed on both testers' devices
- [ ] Ramesh's account created; OTP + MPIN login working
- [ ] KYC **verified** [ADMIN]
- [ ] Bank account **penny-drop verified** and set primary
- [ ] 7/12 (Gat 312) imported into profile; vault has 7/12 + PAN + Aadhaar + Soil Health Card
- [ ] Crops Grapes + Onion added; consent **ON** (after TC-FRM-22 turns it off and back on)
- [ ] Tester B ready: Vyapari (KYC-verified) and Transporter accounts working
- [ ] Sandbox UPI / test bank active for money flows
- [ ] App language = English at start; Kisan Coins balance ≥ 500 (needed for TC-FRM-96/138)

## 3. Test cases

### Module 1 — Account, Onboarding, KYC, Bank, Profile, Land & Vault (TC-FRM-01 … 14)

*Everything about getting Ramesh a working, verified account: registration, login, KYC, bank accounts,
profile, 7/12 land records, vault documents, role switcher and consent.*

### TC-FRM-01: Register a new farmer account with OTP
- **Module:** Account / Onboarding      **Priority:** P0
- **Roleplay:** You are Ramesh. You heard about Agrovercity from a neighbour and are installing the app for the first time.
- **Preconditions:** Fresh phone number +91 98220 00001, not registered before; backend up.
- **Test data:** Phone 9822000001, OTP from dev API response.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the app → choose English on the language screen | App opens; language screen accepts English |
| 2 | Enter phone number 9822000001 → tap Continue | OTP entry screen opens; OTP sent (check dev API response for the code) |
| 3 | Enter the 6-digit OTP → Verify | OTP accepted; account found-or-created; you reach the registration/onboarding form |
| 4 | Fill onboarding: name "Ramesh Patil", persona Farmer, state Maharashtra, district Nashik, village Pimpalgaon Baswant, farm size 3 acres | All fields accept input; dropdowns show these values |
| 5 | Set MPIN 4321 (enter twice) → Submit | Account created; you land on the Farmer home; demo data seeded (Kisan Coins balance visible, sample tasks appear) |
| 6 | Kill and reopen the app | Session persists (or MPIN login screen appears); no crash |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-02: Login with phone + MPIN
- **Module:** Account / Onboarding      **Priority:** P0
- **Roleplay:** You are Ramesh coming back the next morning to check mandi prices.
- **Preconditions:** TC-FRM-01 done; logged out.
- **Test data:** Phone 9822000001, MPIN 4321.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the app | Login screen asks for phone number |
| 2 | Enter 9822000001 → Continue | MPIN entry screen appears (existing user path — no OTP asked) |
| 3 | Enter MPIN 4321 | Login succeeds; home opens with your name and village |
| 4 | Tap the eye/icon if present to show MPIN | MPIN is masked by default |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-03: Wrong MPIN and login rate limit
- **Module:** Account / Onboarding      **Priority:** P1
- **Roleplay:** You are Ramesh. Your fingers slip on the MPIN pad and you wonder if someone could brute-force your account.
- **Preconditions:** Logged out; account exists.
- **Test data:** Wrong MPIN 9999; correct MPIN 4321.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Enter phone 9822000001 → enter wrong MPIN 9999 → Submit | Clear "WRONG MPIN" error; no login |
| 2 | Repeat wrong MPIN 3 more times | Each attempt shows the same error; attempt counter/message appears after repeated failures |
| 3 | (Dev-assisted) attempt 11 wrong MPINs within 10 minutes | Rate-limit message appears (10/10 min per phone); further attempts blocked for the window |
| 4 | Wait for the lock window (or ask dev to clear), then enter correct MPIN 4321 | Login succeeds |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-04: OTP rules — resend lock, one-shot consume, generic errors
- **Module:** Account / Onboarding      **Priority:** P1
- **Roleplay:** You are Ramesh. The first OTP SMS did not arrive, so you ask for a new one.
- **Preconditions:** Logged out; on the OTP path (use "Login with OTP" or re-register flow).
- **Test data:** Phone 9822000001.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Request OTP → immediately tap Resend | Resend is locked; "wait ~30 seconds" message shown |
| 2 | Wait 30 s → tap Resend again | New OTP issued (old one invalidated) |
| 3 | Enter the OLD OTP → Verify | Fails with generic "invalid/expired OTP" (no account-existence leak) |
| 4 | Enter the NEW OTP → Verify twice quickly (tap again after success) | First verify succeeds; replayed OTP fails (one-shot consume), session still valid |
| 5 | (Dev-assisted) verify after 5 minutes from issue | Expired OTP is rejected with generic error |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-05: Onboarding and home labels in हिन्दी
- **Module:** Account / Onboarding      **Priority:** P1
- **Roleplay:** You are Ramesh. You prefer Hindi, so you switch the app language and check the labels.
- **Preconditions:** Logged in (TC-FRM-01 done).
- **Test data:** Language = हिन्दी.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Profile → Settings → Language → choose **हिन्दी** | App reloads in Hindi |
| 2 | Open Home | Greeting shows Hindi text (e.g., "राम राम"), services grid shows Hindi labels (परिवहन, मंडी भाव, etc.) |
| 3 | Check for truncated/overflowing labels and English placeholders on Home, Mandi, Sell Produce | All labels fit their buttons/cards; no raw keys or "TODO" text |
| 4 | Open Mandi Prices | Commodity names/mandi names render correctly in Hindi UI |
| 5 | Switch language back to English | App returns to English |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-06: Submit KYC and get verified
- **Module:** KYC      **Priority:** P0
- **Roleplay:** You are Ramesh. You cannot sell produce until your KYC is verified, so you upload your documents.
- **Preconditions:** Logged in; Aadhaar + PAN images ready (jpeg/png ≤ 5 MB, test copies).
- **Test data:** Doc set = Aadhaar (front) + PAN, persona farmer.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Profile → KYC / Verification → Start KYC | KYC form opens with the farmer document checklist |
| 2 | Upload Aadhaar front (jpeg) → enter Aadhaar number | Upload succeeds; Aadhaar is stored/displayed **masked (XXXX…)** only |
| 3 | Upload PAN → Submit | Case created; status shows **pending** |
| 4 | Ask **[ADMIN]** to approve the case on the super-admin panel | Status changes to **verified**; you get a notification |
| 5 | Re-open KYC screen | Verified badge shown; documents listed |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-07: KYC with wrong document set (negative)
- **Module:** KYC      **Priority:** P1
- **Roleplay:** You are Ramesh. You try to upload just any photo to skip KYC.
- **Preconditions:** Logged in; KYC not yet verified (run before TC-FRM-06, or on a second test account).
- **Test data:** One random photo (not a listed doc type).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | KYC → submit a document set that does not match the farmer matrix (e.g., only a random image, or skip a required doc type) | Submission rejected with a clear error listing the required document types (INVALID_DOCUMENT_MATRIX); no case created |
| 2 | Upload a 6 MB file | Rejected: "file must be ≤ 5 MB" (jpeg/png/pdf only) |
| 3 | Upload a .txt file | Rejected: invalid file type |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-08: Add a bank account (first = auto-primary)
- **Module:** Bank Accounts      **Priority:** P0
- **Roleplay:** You are Ramesh. You add your SBI account so payouts from produce sales can reach you.
- **Preconditions:** Logged in; KYC verified.
- **Test data:** Holder "Ramesh Patil", Bank "State Bank of India", A/C 30012345678, IFSC SBIN0001234.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Profile → Bank Accounts → Add Bank Account | Form opens: Account Holder Name, Bank Name, Account Number, IFSC |
| 2 | Fill the fields with the test data → Save | Account saved; verifyStatus "unverified"; account number shows masked (XXXX…5678) |
| 3 | Check the account card | **Primary** badge is auto-applied (first account) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-09: Verify bank account (penny-drop), set primary, delete & re-promote
- **Module:** Bank Accounts      **Priority:** P0
- **Roleplay:** You are Ramesh. The app asks you to verify the account before money can be paid out.
- **Preconditions:** TC-FRM-08 done (one account).
- **Test data:** Second account (any valid test A/C + IFSC, e.g., HDFC0001234).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the SBI account → tap Verify Account | Penny-drop verification runs; status becomes **verified** (sandbox adapter) |
| 2 | Add a second bank account (HDFC test account) → Save | Second account saved, not primary |
| 3 | On the HDFC account → Set Primary | Primary badge moves to HDFC |
| 4 | Delete the HDFC account → confirm | Account removed; **SBI auto-promoted to primary** again |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-10: Bank form validation (negative)
- **Module:** Bank Accounts      **Priority:** P1
- **Roleplay:** You are Ramesh typing quickly; you make mistakes in the bank form.
- **Preconditions:** Logged in; Bank Accounts screen open.
- **Test data:** IFSC "SBIN123", A/C "ABC123".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap Add Bank Account → Save with all fields empty | Required-field errors on every empty field; nothing saved |
| 2 | Enter IFSC "SBIN123" → Save | IFSC format error (11 characters, 4 letters + 0 + 6 alphanumerics) |
| 3 | Enter Account Number "ABC123" → Save | Only digits accepted; error shown |
| 4 | Verify the account list is unchanged | No partial/broken account created |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-11: Edit profile farm details
- **Module:** Profile      **Priority:** P1
- **Roleplay:** You are Ramesh. You correct your profile so advice (weather, mandi, advisory) matches your farm.
- **Preconditions:** Logged in; KYC verified.
- **Test data:** Vernacular name रमेश पाटील, irrigation = Drip, primaryCrops = Grapes + Onion, farm size 3 acres.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Profile → Edit Profile | Edit form opens with current values |
| 2 | Enter vernacular name रमेश पाटील; set state Maharashtra, district Nashik, village Pimpalgaon Baswant | Values save; profile shows both names |
| 3 | Set location (map pick or lat/lng), farm boundary points if offered, irrigationType "Drip", landHoldingAcres 3, primaryCrops Grapes + Onion, activeCrops both | All saved without error |
| 4 | Save → reopen profile | Changes persisted; home greeting/location reflect them |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-12: Search, import and download 7/12 land record
- **Module:** Land Records      **Priority:** P1
- **Roleplay:** You are Ramesh. You link your government 7/12 record (Gat 312) — it is needed for loans and schemes.
- **Preconditions:** Logged in on the **website** (web view); record exists in demo data.
- **Test data:** District Nashik, Gat/Survey No. 312.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Land Records view → enter District "Nashik", Gat/Survey No. "312" → Search Digital Record | Record card found: Gat No. 312, Hissa 2, area matches |
| 2 | View the record card | Shows owner name, area, district |
| 3 | Tap Import into Agrovercity profile → confirm | Import success message; record now linked in profile |
| 4 | Tap Download 7/12 PDF | PDF downloads/opens |
| 5 | Tap map view | Plot polygon/marker renders on the map |
| 6 | (Later check) Open loan apply form | "Linked 7/12 Land Record ID" dropdown offers Gat 312 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-13: Upload vault documents
- **Module:** Vault      **Priority:** P1
- **Roleplay:** You are Ramesh. You keep your important farm documents in the app vault for scheme applications.
- **Preconditions:** Logged in; PDFs/images ready ≤ 5 MB.
- **Test data:** 7/12 (PDF), PAN (image), Soil Health Card (image).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Vault → Upload Document | Doc-type picker opens: Land Record (7/12), Identity (Aadhaar/PAN), Bank Passbook, Soil Health Card, etc. |
| 2 | Upload 7/12 PDF → tag "Land Record (7/12)" | Saved and listed with type + date |
| 3 | Upload PAN → tag "Identity (Aadhaar/PAN)"; upload Soil Health Card | Both saved; list shows all three |
| 4 | Upload a 6 MB file | Rejected with size error |
| 5 | (Later check) Open a scheme detail page | "missing_documents" shows these docs as available (✓) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-14: Role switcher and data-sharing consent
- **Module:** Profile / Role Switcher      **Priority:** P1
- **Roleplay:** You are Ramesh. You notice the "Active Role: Farmer ▾ Change" capsule and wonder what it does; you also control your data consent.
- **Preconditions:** Logged in; on Home.
- **Test data:** Consent toggle OFF then ON.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap the role switcher capsule on the home header | ProfileSwitcherSheet opens; lists linked profiles (only Farmer for this account) |
| 2 | Select Farmer again | Sheet closes; home unchanged; no crash |
| 3 | Profile → Settings → Consent / Data sharing → turn consent **OFF** | Consent saved OFF |
| 4 | (Keep it OFF — TC-FRM-22 uses it) then turn consent back **ON** | Consent saved ON; sowing intent works again |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 2 — Home & Dashboard (TC-FRM-15 … 19)

*The farmer home on web and mobile: KPI cards, quick launchpad, today's farm actions, weather capsule,
offline state and the Kisan Mitra chatbot.*

### TC-FRM-15: Web farmer home dashboard
- **Module:** Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Ramesh checking the website on your laptop after breakfast.
- **Preconditions:** Logged in on website; profile complete; 7/12 imported.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open `/farmer` | Greeting "Ram Ram, Ramesh Patil Ji! 🌾", village/district line, "Gat 312 (3 Acres)" shown |
| 2 | Check the weather tile | Temp, humidity, condition, Spray Window (Optimal / Check advisory) displayed |
| 3 | Check top mandi rate trend line | Trend chart renders for your crops |
| 4 | Tap KPI cards: Active Lots, Live Mandi Rates, Booked Transport, Kisan Coins | Each opens the correct route (/farmer/lots, /farmer/mandi, /farmer/transport, /farmer/coins) |
| 5 | Tap quick launchpad: AI Crop Doctor, Post Crop Lot, Book Gadi, Rent Yantra, Farm Diary | Each opens the right screen |
| 6 | Scroll to "Nearby Mandi Live Rates" | Top 3 mandis with modal price + trend % |
| 7 | Check the notification banner | Latest notification + unread count shown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-16: Mobile home — services, modules, bookings
- **Module:** Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Ramesh on your phone; you explore every icon on the home screen.
- **Preconditions:** Logged in on mobile app.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Home | Green header: crop emblem, "Good Morning", LIVE APMC pulse badge, your name, location line; bell icon; search bar with mic |
| 2 | Check weather & alert quick capsule | Temp, rain probability %, condition shown; rain-radar beacon badge if radar available |
| 3 | Tap each "Our Services" item: Transportation, Market Price, Chat us, My Bookings, Agricultural Loan | Each opens the right screen (equipment/transport, mandi, Kisan Mitra, my bookings list, finance) |
| 4 | Tap "My Bookings" | List shows your bookings (transport/vet/dairy) or a friendly empty state |
| 5 | Tap Hot Offer 50% OFF banner → Get Discount | Marketplace opens with the offer applied/visible |
| 6 | Tap each "Special Modules" item: Crop Insurance, Tree Plantation, Live Channels, Livestock & Dairy, Farm Diary, Agri News, Dnyan Setu | All 7 open their screens without errors |
| 7 | Tap Refer & Earn row and Krishi Ratna view | Refer & Earn and Krishi Ratna screens open |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-17: Today's farm actions — mark done, dismiss, urgent task
- **Module:** Home / Dashboard      **Priority:** P1
- **Roleplay:** You are Ramesh planning your day with the app's task list.
- **Preconditions:** Logged in; at least 2 tasks exist (seeded or created by earlier tests).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On home, find "Today's Farm Action" | Task list visible with "{n}/{m} Done" chip; Agronomist Advisory tip shown below |
| 2 | Tap the checkbox "Mark done" on one task | Task marked done; chip count increases (e.g., "1/4 Done") |
| 3 | Tap the X "Dismiss" on another task | Task removed from the list; no error |
| 4 | Look for an urgent task card | Priority badge visible on it (if none today, note it) |
| 5 | Force-close and reopen the app | Done/dismissed states persisted |
| 6 | Tap a task card | Deep-links to the related screen (e.g., irrigation task → water view) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-18: Weather capsule offline state (no fabricated data)
- **Module:** Home / Weather      **Priority:** P2
- **Roleplay:** You are Ramesh in a low-network field. The app must say "offline", never invent weather.
- **Preconditions:** Logged in on mobile.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Turn ON airplane mode → open Home | Weather capsule shows "…offline, N cached days" with a Retry button |
| 2 | Tap Retry (still offline) | Same offline message; **no** temperature/humidity values appear (no fabricated data) |
| 3 | Turn airplane mode OFF → tap Retry | Real weather loads: temp, humidity, condition, rain probability |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-19: Kisan Mitra chatbot — typed and voice Hindi queries
- **Module:** Home / Kisan Mitra      **Priority:** P2
- **Roleplay:** You are Ramesh. You ask Kisan Mitra about a grape disease, by typing and by voice, in Hindi.
- **Preconditions:** Logged in; mic permission allowed.
- **Test data:** Query: "angoor ke paudhe mein leaf spot ka ilaaj" (grapes leaf spot treatment).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap the chatbot icon on home header | Kisan Mitra chat opens |
| 2 | Type the Hindi query (in Devanagari or Roman Hindi) → send | Answer arrives in Hindi with treatment advice; may suggest advisory articles |
| 3 | Tap the mic icon → speak the same query in Hindi | Voice recognized; reply shown (and spoken if TTS enabled) |
| 4 | Tap a suggested article/advisory link inside the chat | Opens the advisory article / crop doctor |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 3 — My Crops & Advisory (TC-FRM-20 … 29)

*Crop cycles, sowing intents, AI crop plans, market saturation, the AI Crop Doctor disease scan with its
image gate, NPK, pest radar and advisory articles.*

### TC-FRM-20: View my crop cycles
- **Module:** My Crops      **Priority:** P1
- **Roleplay:** You are Ramesh checking which of your crops are tracked this season.
- **Preconditions:** Logged in; crops added during onboarding/profile edit.
- **Test data:** Grapes (Thompson Seedless), Onion (Nashik Red).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open My Crops | List loads; newest first; each card shows crop, plot, district, season, stage, status |
| 2 | Check the fields against your setup | Grapes + Onion visible with correct plot/season |
| 3 | Open one cycle | Detail shows plannedDate, isIntent/fromPlanner flags, rationale, notes history |
| 4 | (Fresh-account check) On a new account with no crops, open My Crops | Friendly empty state with a "record sowing intent" prompt — no crash |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-21: Record a sowing intent (with consent)
- **Module:** My Crops / Advisory      **Priority:** P0
- **Roleplay:** You are Ramesh. Before sowing onions in November you record your intent, so the mandi can plan supply.
- **Preconditions:** Consent ON (TC-FRM-14); plot Gat 312 exists.
- **Test data:** Crop Onion (Nashik Red), date 2026-11-01, plot "Gat No. 312, Pimpalgaon Baswant, Nashik".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | My Crops → Quick Sowing Intent | Form: crop select, planned date, plot select |
| 2 | Select Onion → date 2026-11-01 → plot Gat No. 312 → Record Sowing Intent | Success message; intent appears in My Crops with intent badge |
| 3 | Open the new cycle detail | isIntent = true, plannedDate 2026-11-01, plot linked |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-22: Sowing intent negatives — past date and consent gate
- **Module:** My Crops / Advisory      **Priority:** P1
- **Roleplay:** You are Ramesh. You fat-finger a past date, and you want to see what happens when data sharing is off.
- **Preconditions:** Logged in; control of consent toggle.
- **Test data:** Past date 2026-01-01; consent OFF.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Quick Sowing Intent → Onion → date 2026-01-01 (past) → submit | Error "PAST_DATE" / "past date not allowed"; nothing saved |
| 2 | Profile → Settings → turn consent **OFF** → back to sowing intent → submit valid data | Blocked with CONSENT_REQUIRED message explaining data sharing |
| 3 | Turn consent back **ON** → submit the same valid intent | Succeeds (intent saved) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-23: AI crop plan → confirm → 4 tasks (idempotent)
- **Module:** My Crops / Advisory      **Priority:** P1
- **Roleplay:** You are Ramesh. You ask the AI what to sow after wheat/chickpea and confirm a plan.
- **Preconditions:** Logged in; consent ON.
- **Test data:** cropHistory "Wheat, Chickpea"; season Rabi.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | My Crops → AI Crop Plan → enter cropHistory "Wheat, Chickpea", soil/water details → Get AI Plan | 2–3 crop suggestions appear (suggestions only — nothing auto-added to My Crops) |
| 2 | Tap Confirm on the first suggestion | Real crop_cycle created; **4 tasks** appear in Today's Farm Action: land_prep, sowing, first_irrigation, top_dressing |
| 3 | Tap Confirm again on the same suggestion (or repeat the request) | No duplicate cycle; idempotent response ("already exists" / created:false) |
| 4 | Open My Crops | Exactly one new cycle for the confirmed crop |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-24: Update crop stage, status and notes
- **Module:** My Crops      **Priority:** P1
- **Roleplay:** You are Ramesh updating the grapes cycle after irrigation and urea application.
- **Preconditions:** At least one crop cycle exists.
- **Test data:** Stage "Flowering"; notes "Irrigation given on 20 Oct, urea 2 kg".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the grapes cycle → stage update form | Fields: stage (≤100 chars), status, notes (≤2000 chars) |
| 2 | Enter stage "Flowering", update status, add the notes → Save | Card updated with new stage/status; notes saved |
| 3 | Paste 2100 characters into notes → Save | Rejected: "notes must be ≤ 2000 characters" |
| 4 | (Dev/API check) try to PATCH another farmer's cycle id | 404 CROP_CYCLE_NOT_FOUND (never 403/foreign data) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-25: Market saturation check
- **Module:** Advisory      **Priority:** P1
- **Roleplay:** You are Ramesh. Before sowing more onions, you check if the market is already flooded.
- **Preconditions:** Logged in.
- **Test data:** Crop Onion, district Nashik.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Advisory → Market Saturation → crop Onion, district Nashik → Check | Result shows riskLevel (green/yellow/red) with explanation; district falls back to profile when blank |
| 2 | Re-check a crop known to be saturated (ask dev which demo crop returns red) | riskLevel red; **saturation_high** task appears in Today's Farm Action + notification |
| 3 | Repeat the check with "shareSowingIntent" option ON | A crop_cycle (intent) is written from the saturation check |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-26: AI Crop Doctor — valid leaf scan
- **Module:** Advisory / Crop Doctor      **Priority:** P1
- **Roleplay:** You are Ramesh. You spot spots on grape leaves and scan one.
- **Preconditions:** A clear grape leaf photo on the device.
- **Test data:** Photo: single grape leaf, good light.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | AI Crop Doctor → upload/take the leaf photo → select Crop Type "Grapes / अंगूर" → Scan | Animated scanning steps run (image gate → disease analysis) |
| 2 | Wait for results | Gate passes; disease name + confidence shown; **chemical + organic treatment with dosage** listed |
| 3 | Check confidence | ≥ 0.7 → no expert ticket; result saved |
| 4 | Open Recent Field Scans | The scan is listed with date + diagnosis |
| 5 | Open Today's Farm Action | **disease_treatment** task created |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-27: AI Crop Doctor — image gate retake (negative, EN + हिन्दी)
- **Module:** Advisory / Crop Doctor      **Priority:** P1
- **Roleplay:** You are Ramesh in a hurry; you accidentally photograph the tractor instead of the leaf.
- **Preconditions:** A non-leaf photo and a blurry leaf photo on the device.
- **Test data:** Tractor photo; blurred leaf photo.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Scan the tractor photo (not a leaf) | Gate fails: "retake" message shown in **English and हिन्दी** (फिर से खींचें); **no diagnosis** |
| 2 | Scan the blurry leaf | Gate fails on quality: same bilingual retake message |
| 3 | Open Recent Field Scans | Failed scans are **not** saved (no write) |
| 4 | (Dev-assisted) scan a valid leaf with a stubbed low-confidence (<0.7) result | Result shown **and** an expert_ticket opened (status open) so an agronomist can reply |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-28: NPK recommendation and pest radar
- **Module:** Advisory (NPK / Pest tabs)      **Priority:** P2
- **Roleplay:** You are Ramesh checking what fertiliser the onion crop needs and whether pests are reported nearby.
- **Preconditions:** Logged in; location allowed.
- **Test data:** Crop Onion; radius 5 km.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | My Crops → NPK tab → enter crop/soil details → Get NPK | NPK recommendation (kg/ha or per acre) displayed |
| 2 | Open Pest tab (allow location) | Pest reports within 5 km radius listed on map/list |
| 3 | (If any alert exists) check Today's Farm Action | **pest_alert** task created |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-29: Advisory articles with crop/season/region filters
- **Module:** Advisory / Articles      **Priority:** P2
- **Roleplay:** You are Ramesh reading advisory articles during lunch.
- **Preconditions:** Logged in; CMS articles published (seeded).
- **Test data:** Filter crop = Grapes.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Advisory → Articles | Published article list loads |
| 2 | Apply filter crop = Grapes | Only grape articles listed |
| 3 | Check the default region filter | Defaults to your state+district+village (Maharashtra/Nashik/Pimpalgaon Baswant) |
| 4 | Open an article | Full article renders (text + images); readable in Hindi if available |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 4 — Mandi Prices & Alerts (TC-FRM-30 … 37)

*Live mandi prices, trader rates, compare with transport cost and net profit, price history + forecast,
AI smart-select, saved markets and price alerts.*

### TC-FRM-30: Browse mandi prices and trader rates
- **Module:** Mandi      **Priority:** P1
- **Roleplay:** You are Ramesh checking today's onion rate before deciding to sell.
- **Preconditions:** Logged in.
- **Test data:** Crop Onion, district Nashik.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Mandi Prices | Price list loads: commodity, mandi, modal/min/max price, date, trend arrow |
| 2 | Type "Onion" in search | List filters to onion rows |
| 3 | Search "Nashik" | Rows for Nashik mandis |
| 4 | Open the trader (vyapari) rates section | Trader rates for your crops shown (cached, ≤2 h old label) |
| 5 | Open the mandi list | Registered mandis with name, district, state |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-31: Mandi compare — net profit after transport
- **Module:** Mandi / Compare      **Priority:** P1
- **Roleplay:** You are Ramesh with 20 quintals of onion; you want to know which mandi pays best after transport.
- **Preconditions:** Logged in.
- **Test data:** Crop Onion, quantity 20 q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Mandi → Compare → crop Onion, quantity 20 q → Compare | Per-mandi modal price, distance, transport cost (₹12/km × distance) shown |
| 2 | Check the net profit column | Rows sorted by **netProfit descending**; net = modal − transport (− commission only if a mandi doc states it) |
| 3 | Verify the math on the top row by hand | Your hand calculation matches the shown net profit |
| 4 | Check the arbitrage table | Best mandi vs your district mandi difference highlighted |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-32: Mandi compare validation (negative)
- **Module:** Mandi / Compare      **Priority:** P2
- **Roleplay:** You are Ramesh; you leave the quantity blank by mistake.
- **Preconditions:** Logged in.
- **Test data:** Quantity 0, −5; crop blank.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Compare → crop Onion, quantity 0 → Compare | Error: quantity must be > 0 (422); no results |
| 2 | Quantity −5 → Compare | Same validation error |
| 3 | Crop blank, quantity 20 → Compare | Error: crop is required |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-33: Price history chart and 7-day forecast
- **Module:** Mandi / History & Forecast      **Priority:** P1
- **Roleplay:** You are Ramesh checking if onion prices are rising before you fix a rate.
- **Preconditions:** Logged in.
- **Test data:** Crop Onion; mandi default; months = 6.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Mandi → open a crop's price history | Chart loads; mandi defaults to the first mandi in your district |
| 2 | Change months to 36 / enter 0 or 40 | 1–36 accepted; out-of-range clamped or clear error |
| 3 | Open the 7-day forecast | Forecast line + advice text shown |
| 4 | (Dev-assisted) request forecast for a crop+mandi with no nightly run | Graceful "forecast not available" (404 handled), no crash |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-34: AI smart-select mandi
- **Module:** Mandi / Smart Select      **Priority:** P1
- **Roleplay:** You are Ramesh. You let the AI pick the best mandi, then verify its math.
- **Preconditions:** Logged in.
- **Test data:** Crop Onion, 20 q, district Nashik.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Mandi → Smart Select → crop Onion, 20 q, district Nashik → Run | AI ranking returns: best mandi + candidates list (rank, mandi, modal price, distance, transport fare, commission if stated, net) |
| 2 | Check the source label | source = "ai" or "fallback" shown; automationLevel "suggest" |
| 3 | Verify paisa math on the top candidate | net = modal − transport − commission; matches your hand calculation |
| 4 | Run with quantity 0 | Validation error (422 NO_MANDI_DATA / quantity ≥ 1 after rounding) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-35: Saved markets — pin, filter, remove
- **Module:** Mandi / Saved Markets      **Priority:** P2
- **Roleplay:** You are Ramesh. You trade mostly at Nashik APMC, so you save it.
- **Preconditions:** Logged in; mandi list loaded.
- **Test data:** Nashik APMC.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the Nashik APMC row → tap pin/save | It appears under "saved markets" |
| 2 | Toggle "Show only rates from your saved markets" | Price list filters to saved mandis only |
| 3 | Remove the pin → toggle off | Saved list empty; full list restored |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-36: Create a mandi price alert
- **Module:** Mandi / Price Alerts      **Priority:** P1
- **Roleplay:** You are Ramesh. You want to be alerted when Nashik onion crosses ₹1,500/q.
- **Preconditions:** Logged in.
- **Test data:** Crop Onion, mandi Nashik APMC, condition "price above ₹1,500/q".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Mandi → Price Alerts → Create Mandi Price Alert | Modal: crop, mandi, condition, price |
| 2 | Fill the test data → Save | Alert saved and listed |
| 3 | Ask **[DEV]** to inject a price above ₹1,500 for Nashik onion | — |
| 4 | Open the bell / notifications | Alert notification received with crop, mandi and crossed price |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-37: Delete alert + "List lot at this price" shortcut
- **Module:** Mandi / Price Alerts      **Priority:** P2
- **Roleplay:** You are Ramesh. The season ends, so you remove your alert; you also try the shortcut that posts a lot at a mandi price.
- **Preconditions:** TC-FRM-36 done.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Delete the alert from TC-FRM-36 → confirm | Alert removed; after the next price change you get **no** alert notification |
| 2 | On a mandi price row → tap "List lot at this price" | Post Lot form opens, prefilled with crop and expected rate = that mandi's modal price |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 5 — Sell Produce: Lots & Offers (TC-FRM-38 … 49)

*Posting produce lots (draft / review / open / sold / withdrawn / rejected), the offer bid board with
buyer trust cards, and accepting / countering / rejecting offers — the core selling flow.*

### TC-FRM-38: Post a produce lot — save as draft (open)
- **Module:** Sell Produce / Lots      **Priority:** P0
- **Roleplay:** You are Ramesh. Your onion (20 q, ready 25 Oct) goes on the market as a draft you control.
- **Preconditions:** Logged in; KYC verified.
- **Test data:** Crop Onion, variety "Nashik Red", grade A, 20 q, ₹1,450/q, harvest 2026-10-25, village Pimpalgaon Baswant, pickup Gate 312, 1 photo.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Sell Produce → Post New Produce Lot | Modal opens: Crop select (**Soybean / Wheat / Cotton / Onion / Tur-Arhar** — raise a defect if Onion is missing or the list differs), Variety, Quantity (q), Quality Grade (A/B/C/Ungraded), Expected Price (₹/q), Village/Taluka, Harvest Date, Pickup Location/Gate, photo URL |
| 2 | Fill all fields with the test data; leave "Submit directly for APMC / Admin Moderation Review" **unchecked** | Button reads **"Save as Draft"** |
| 3 | Tap Save as Draft | Lot created with status **open**; appears in My Lots |
| 4 | Ask Tester B (Vyapari) to open lot browsing | Your lot is visible; buyer sees only **first name "Ramesh" + village** — no phone number anywhere |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-39: Post a lot — submit for review and get approved
- **Module:** Sell Produce / Lots      **Priority:** P0
- **Roleplay:** You are Ramesh posting your Thompson Seedless grapes, this time straight for review.
- **Preconditions:** Logged in.
- **Test data:** Grapes (Thompson Seedless), grade A, 10 q, ₹2,800/q, harvest 2026-10-30, photo.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Post New Produce Lot → fill grapes test data → tick "Submit directly for APMC / Admin Moderation Review" | Button changes to **"Submit for Review"** |
| 2 | Tap Submit for Review | Lot created with status **pending_review** ("In Review" on card) |
| 3 | Ask **[ADMIN]** to approve it | Status → **open**; card no longer shows "In Review"; lot visible to buyers |
| 4 | Open the bell | Approval/visible notification (or absence) noted |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-40: Lot form validation (negative)
- **Module:** Sell Produce / Lots      **Priority:** P1
- **Roleplay:** You are Ramesh making typos in the lot form.
- **Preconditions:** Logged in; Post Lot form open.
- **Test data:** Quantity −5; price −10; empty form.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap Save with the form empty | Required-field errors; nothing created |
| 2 | Quantity −5, price ₹1,450 → Save | Error: quantity must be > 0 |
| 3 | Quantity 20, price −10 → Save | Error: expected rate must be ≥ 0 |
| 4 | On mobile: attach a 4th photo | Blocked: maximum 3 photos |
| 5 | Verify My Lots | No broken/partial lot created by the failed attempts |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-41: Edit a lot
- **Module:** Sell Produce / Lots      **Priority:** P1
- **Roleplay:** You are Ramesh. Rates rose, so you raise your onion lot price and quantity.
- **Preconditions:** An **open** lot exists (TC-FRM-38).
- **Test data:** New rate ₹1,500/q, quantity 25 q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | My Lots → open the onion lot → Edit | Edit form prefilled |
| 2 | Change expected rate to ₹1,500, quantity to 25 q → Save | Card updated; buyer browse shows the new values |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-42: Withdraw a lot
- **Module:** Sell Produce / Lots      **Priority:** P1
- **Roleplay:** You are Ramesh. You decide to sell the onions locally instead.
- **Preconditions:** An open lot exists (not the one used in later accept tests).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | My Lots → open the lot → Withdraw | Confirm dialog asks to confirm withdrawal |
| 2 | Confirm | Status → **withdrawn**; card shows Withdrawn |
| 3 | Ask Tester B (Vyapari) to check browsing | Lot no longer visible to buyers |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-43: Rejected lot — see reason, fix and resubmit [ADMIN]
- **Module:** Sell Produce / Lots      **Priority:** P1
- **Roleplay:** You are Ramesh. Admin rejects your grapes lot for an unclear photo; you fix and resubmit.
- **Preconditions:** A lot in pending_review.
- **Test data:** Reject reason "Photo unclear".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Ask **[ADMIN]** to reject the pending lot with reason "Photo unclear" | — |
| 2 | Open My Lots | Lot status **rejected**; the moderation reason is shown on the card |
| 3 | Edit the lot (replace photo) → Submit for Review | Status → **pending_review** |
| 4 | Ask **[ADMIN]** to approve | Status → **open** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-44: Relist a lot with priority boost
- **Module:** Sell Produce / Lots      **Priority:** P2
- **Roleplay:** You are Ramesh. Your lot went stale; you relist it with a boost so it shows on top.
- **Preconditions:** An open lot; later a sold lot (after TC-FRM-47).
- **Test data:** New rate ₹2,900/q, note "Fresh stock arriving", priority ON.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open an open lot → Relist | Relist form: priority?, expectedRate?, quantityQuintals?, note? |
| 2 | Enter new rate, note, switch priority boost ON → Submit | Lot relisted; card shows a **Priority** badge; relist counter/note saved |
| 3 | (After TC-FRM-47) try Relist on the **sold** lot | Error LOT_ALREADY_SOLD (409); relist blocked |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-45: Illegal transitions on a sold lot (negative)
- **Module:** Sell Produce / Lots      **Priority:** P1
- **Roleplay:** You are Ramesh. The lot is sold; you must not be able to edit or withdraw it.
- **Preconditions:** A lot in **sold** status (after TC-FRM-47).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the sold lot → tap Edit | Blocked: LOT_NOT_EDITABLE (409) |
| 2 | Tap Withdraw | Blocked; lot stays sold |
| 3 | Tap Submit for Review | Blocked: LOT_NOT_SUBMITTABLE |
| 4 | Verify the lot in My Lots | Status still **sold**; purchase link intact |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-46: Offer board — analytics and buyer trust cards
- **Module:** Sell Produce / Offer Board      **Priority:** P1
- **Roleplay:** You are Ramesh. Three vyaparis offered on your onion lot; you compare them.
- **Preconditions:** A lot with ≥2 offers (ask Tester B to send offers — see 07_cross_persona_e2e.md).
- **Test data:** Offers at ₹1,420/q and ₹1,480/q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the lot → Offer Board | Offers listed **best-rate first** |
| 2 | Open one offer's buyer card | Trust card: verified badge (if verified), completedPurchases, avgRating, offers count |
| 3 | Check the analytics panel | totalOffers, bestRate, avgRate, avgQuantity, totalOfferedQty, verifiedOffers count, bestOfferId, rateVsExpected bestDelta % |
| 4 | Compare with your expected ₹1,500/q | Delta % shown correctly (e.g., best ₹1,480 = −1.33%) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-47: Accept an offer — full lot (purchase created) 🔄
- **Module:** Sell Produce / Offers      **Priority:** P0
- **Roleplay:** You are Ramesh. The vyapari's rate is good; you accept and the deal becomes a purchase.
- **Preconditions:** Your lot has a pending offer from Tester B (Vyapari); 🔄 second tester (see 07_cross_persona_e2e.md).
- **Test data:** Full 25 q at ₹1,500/q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Before accepting, check the chat screen with this buyer | **No chat available yet** (chat unlocks only after confirmation — compliance) |
| 2 | Open the offer → Accept → confirm full quantity | Offer **accepted**; lot status → **sold** |
| 3 | Ask Tester B to check their offers | Their other live offers on this lot were auto-rejected with reason **lot_fulfilled** |
| 4 | Open Purchases | A purchase exists in **confirmed** status for this lot |
| 5 | Open the bell | **booking_confirmed** notification (both parties); **request_accepted** "chat is now open" notification |
| 6 | Open chat with the buyer now | Chat room works — messages can be exchanged |
| 7 | Check P&L / diary | Auto income entry (lot_sale) appears (also verified in TC-FRM-82) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-48: Partial accept of an offer 🔄
- **Module:** Sell Produce / Offers      **Priority:** P1
- **Roleplay:** You are Ramesh. A vyapari wants 20 q but you only sell 10 q now, keeping the rest listed.
- **Preconditions:** A lot with remaining quantity and a pending offer (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** Accept 10 q of a 20 q offer on a 25 q lot.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the offer → Accept partial → enter 10 q → confirm | Purchase created for 10 q |
| 2 | Check the lot | Status stays **open**; remaining quantity 15 q shown |
| 3 | Try to accept 20 q against the remaining 15 q | Blocked: partial accept cannot exceed remaining quantity |
| 4 | Ask Tester B to verify their side | Buyer sees purchase for 10 q; offer state consistent |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-49: Counter an offer, reject an offer, negotiation cap 🔄
- **Module:** Sell Produce / Offers      **Priority:** P1
- **Roleplay:** You are Ramesh. ₹1,420 is too low, so you counter at ₹1,470; another offer you reject outright.
- **Preconditions:** ≥2 pending offers on open lots (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** Counter ₹1,470/q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open offer 1 → Counter ("Submit One-Time Counter Offer") → enter ₹1,470 → submit | Offer status → **countered**; buyer notified **offer_countered**; 24 h clock restarts |
| 2 | Ask Tester B to counter back (round 2), then you counter again (round 3), then Tester B tries a 4th counter | 4th counter blocked: **NEGOTIATION_CLOSED** (max 3 alternating rounds) |
| 3 | Open offer 2 → Reject | Offer **rejected**; buyer notified **offer_rejected** |
| 4 | Open the bell | offer_countered + offer_rejected notifications present with correct text |

> ⚠️ **Known mismatch in current build:** the web UI button says "Submit **One-Time** Counter Offer" while the
> backend allows **3 rounds**. Expected (correct): UI text should match the 3-round rule (or block rounds 2–3
> consistently). Verify actual behaviour, screenshot it, and raise a defect either way.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 6 — Buyer Demands & Standing Orders (TC-FRM-50 … 52)

*Vyaparis post demands; Ramesh browses them and bids by making an offer.*

### TC-FRM-50: Browse buyer demands with buyer summaries
- **Module:** Demands      **Priority:** P1
- **Roleplay:** You are Ramesh. Instead of waiting, you look for vyaparis already buying onions.
- **Preconditions:** Tester B (Vyapari) has posted an open demand for Onion (🔄 see 07_cross_persona_e2e.md).
- **Test data:** Crop filter Onion.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Buyer Demands (browse) | Open demands list loads |
| 2 | Apply filter crop = Onion | Only onion demands listed |
| 3 | Open the demand | Shows quantity, price band, location; **buyerSummary**: verified badge, capacityPerMonth/Day, serviceRadiusKm, ratingAvg |
| 4 | Check the buyer's identity | Only public summary shown — no phone number (compliance) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-51: Make an offer (bid) on a demand 🔄
- **Module:** Demands / Offers      **Priority:** P0
- **Roleplay:** You are Ramesh. A Nashik vyapari wants 50 q onions at ₹1,350–1,450; you offer 20 q at ₹1,400.
- **Preconditions:** An open demand exists (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** ₹1,400/q, 20 q, message "Nashik Red, grade A", pickup 2026-10-28, payment terms 3 days, transport mode "Buyer's vehicle".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the demand → Make Offer | Offer form: pricePerUnit, quantity, message, pickupDate, paymentTermsDays, transportMode |
| 2 | Fill the test data → submit | Offer created; you see it under Offers → Sent |
| 3 | Ask Tester B to open their notifications | Buyer received **offer_received** notification + **new_offers** task |
| 4 | Submit the exact same offer again (retry) | Idempotent: same live offer returned, **no duplicate** |
| 5 | Try pickup date 2026-01-01 (past) | Rejected: pickup date cannot be in the past |
| 6 | Ask Tester B to wait 24 h (or dev fast-forward) | Offer lazily flips to **expired**; you get **offer_expired** notification |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-52: Standing orders (recurring demands)
- **Module:** Demands / Standing Orders      **Priority:** P2
- **Roleplay:** You are Ramesh. A trader buys 10 q of onions every week; you check standing orders.
- **Preconditions:** A standing demand exists in demo data (ask dev to seed if absent).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Standing Orders | Open standing orders listed with price band, calendar window, per-slot qty |
| 2 | Check endDate | Only orders with endDate ≥ today are listed |
| 3 | Make an offer against one standing order | Offer accepted by form; status pending |
| 4 | Ask Tester B (buyer) to check | Standing order's offer counter increased |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 7 — Purchases & Escrow, Seller Side (TC-FRM-53 … 58)

*The purchase created when an offer is accepted: lifecycle, handover OTP, escrow release minus 2% commission,
QC, disputes, cancellation and the invoice.*

### TC-FRM-53: Purchase list and detail — handover OTP hidden from buyer
- **Module:** Purchases      **Priority:** P1
- **Roleplay:** You are Ramesh. You want to see the deal from your side and confirm the OTP is only visible to you.
- **Preconditions:** A purchase exists (TC-FRM-47). 🔄 second tester, see 07_cross_persona_e2e.md.
- **Test data:** Purchase from TC-FRM-47.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Purchases | Purchase listed with crop, quantity, amount, status chip |
| 2 | Open the purchase detail | Lifecycle timeline visible: confirmed → advancePaid → pickupScheduled → inTransit → delivered → completed |
| 3 | Check the handover OTP area | OTP is hidden behind "Reveal" (not shown plain) |
| 4 | Ask Tester B (buyer) to open the same purchase on their device | Buyer sees **no handover OTP anywhere** (redacted for non-farmer — compliance) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-54: Reveal handover OTP and verify → escrow released minus 2% 🔄
- **Module:** Purchases / Escrow      **Priority:** P0
- **Roleplay:** You are Ramesh. The vyapari's pickup agent arrives; you say the OTP aloud and watch the money land.
- **Preconditions:** Purchase in pickupScheduled/inTransit (buyer scheduled pickup — 🔄 second tester, see 07_cross_persona_e2e.md). Bank account verified & primary.
- **Test data:** 10 q × ₹1,500 = ₹15,000 total; commission 2% = ₹300; expected payout ₹14,700.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the purchase → Reveal handover OTP | 6-digit OTP shown; validity note "15 minutes, 5 attempts" |
| 2 | Tell the OTP to Tester B verbally (never type it in chat) | Buyer enters OTP on their side |
| 3 | Wrong OTP first (ask Tester B to enter 000000) | Attempt counted; after 5 wrong attempts OTP is locked |
| 4 | Correct OTP verified by buyer | Escrow **released minus 2% commission (min ₹50)**: ₹15,000 − ₹300 = ₹14,700 |
| 5 | Check your bank/wallet entry | Payout ₹14,700 arrives at your primary bank (sandbox credit) |
| 6 | Open the bell | **payment_received** notification with the amount |
| 7 | Check P&L | Auto income entry lot_sale ₹15,000 recorded (commission as expense line if shown) |
| 8 | Ask Tester B to confirm their side | Buyer was charged exactly ₹15,000; commission visible on the settlement breakdown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-55: Buyer QC fails → qcDisputed → resolved 🔄
- **Module:** Purchases / QC & Disputes      **Priority:** P1
- **Roleplay:** You are Ramesh. The buyer claims 2 q of onions were rotten at delivery and opens a QC dispute.
- **Preconditions:** A delivered purchase (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** QC fail with 2 photos.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Ask Tester B to submit QC fail with photos on the delivered purchase | Purchase status → **qcDisputed**; escrow frozen |
| 2 | Open the purchase on your side | Status qcDisputed visible; QC photos viewable |
| 3 | Ask **[ADMIN]**/buyer to resolve the dispute (resolve endpoint) | Status → **completed**; escrow released per resolution |
| 4 | Open the bell | Dispute-related notification received |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-56: Cancel a purchase → escrow refunded to buyer 🔄
- **Module:** Purchases      **Priority:** P1
- **Roleplay:** You are Ramesh. The deal feels wrong; you cancel before pickup and the buyer's advance goes back.
- **Preconditions:** A purchase in **confirmed** status with buyer advance/escrow funded (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the purchase → Cancel → give reason | Allowed from confirmed; status → **cancelled** |
| 2 | Ask Tester B to check their side | Escrow **refunded** to buyer; **booking_cancelled** notification received by buyer |
| 3 | Try to open a dispute on the cancelled purchase | Blocked: cancelled purchases are not disputable |
| 4 | Check the lot (if it was a full-lot sale) | Lot quantity restored / status reverted per rule |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-57: Open a dispute with evidence (escrow frozen)
- **Module:** Purchases / Disputes      **Priority:** P1
- **Roleplay:** You are Ramesh. The buyer took the produce but never marked delivery; you open a dispute.
- **Preconditions:** A purchase in confirmed/advancePaid/pickupScheduled (not cancelled, not disputed).
- **Test data:** Reason "Buyer took produce but did not confirm delivery"; 2 evidence photos.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the purchase → Raise Dispute → reason + description → submit | Dispute created; **one open dispute max** |
| 2 | Upload evidence photos | Photos attached (evidence allowed while dispute open) |
| 3 | Try to open a second dispute on the same purchase | Blocked: only one open dispute |
| 4 | Ask Tester B + **[ADMIN]** to check | Buyer notified **purchase_dispute**; admin triage task created (high priority); escrow clock frozen |
| 5 | Ask **[ADMIN]** to resolve | Dispute resolved; escrow released per ruling |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-58: Purchase invoice PDF and payment notifications
- **Module:** Purchases      **Priority:** P2
- **Roleplay:** You are Ramesh. You download the invoice for your records (and for the accountant in Pune).
- **Preconditions:** A completed/delivered purchase.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the completed purchase → Download Invoice | invoice.pdf opens: parties, lot details, amounts, commission line |
| 2 | Open the bell | **payment_received** / **payment_successful** notifications with correct amounts |
| 3 | Check notification deep-link | Tapping the payment notification opens the purchase detail |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 8 — Transport: Book Gadi (TC-FRM-59 … 68)

*Vehicle catalog, fare estimate, Book Now / Book Later with transit insurance, booking tabs and milestones,
transporter offers, POD OTP, trip sharing, cancellation penalties.*

### TC-FRM-59: Vehicle catalog and fare estimate
- **Module:** Transport      **Priority:** P1
- **Roleplay:** You are Ramesh. You want a fare idea for moving 20 q onions to Nashik APMC.
- **Preconditions:** Logged in.
- **Test data:** Route Pimpalgaon Baswant → Nashik APMC (≈35 km); load 2.5 t.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Transportation → Book Gadi | Vehicle catalog lists vehicles (with extended info: capacity, size) |
| 2 | Fare estimate: enter route, vehicle type (pickup/small truck), load 2.5 t | Instant quote shown; surge factor visible and **≤ 1.5** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-60: Book Now with transit insurance
- **Module:** Transport      **Priority:** P0
- **Roleplay:** You are Ramesh. You book a pickup right now, insuring the onion load worth ₹29,000.
- **Preconditions:** Logged in; fare estimate known.
- **Test data:** Vehicle pickup; crop Onion; 20 q; bags; pickup window now+45 min; declared value ₹29,000; insurance ON.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Book Gadi Now modal: enter route, vehicle type, crop/load Onion, qty 20 q, packaging "bags", pickup time window, declared value ₹29,000, insurance opt-in ON | Premium shown: 0.8% × ₹29,000 = **₹232** (coverage = min(declared, ₹5,00,000)) |
| 2 | Confirm booking | Booking created, status **requested**; fare + premium total shown |
| 3 | Check Today's Farm Action | **trip_pickup_reminder** task created |
| 4 | Ask Tester B (Transporter) to check their board | Your booking is visible to transporters |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-61: Book Later and time-window validation
- **Module:** Transport      **Priority:** P1
- **Roleplay:** You are Ramesh. You pre-book a vehicle for tomorrow morning's harvest.
- **Preconditions:** Logged in.
- **Test data:** Pickup 2026-10-26 08:00; window 45 min; negative windows 10 min and 800 min.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Book Later → pickup time tomorrow 08:00, window 45 min → confirm | Booking created as **upcoming** |
| 2 | New booking with window 10 min | Rejected: timeWindowMinutes must be 15–720 |
| 3 | New booking with window 800 min | Same validation error |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-62: Insurance opt-in without declared value (negative)
- **Module:** Transport      **Priority:** P1
- **Roleplay:** You are Ramesh. You tick insurance but forget the load value.
- **Preconditions:** Logged in; booking form open.
- **Test data:** Insurance ON, declared value empty.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Book Gadi → insurance ON, declared value empty → confirm | Error **DECLARED_VALUE_REQUIRED**; booking not created |
| 2 | Enter declared value ₹29,000, insurance OFF | Booking created with **no premium** line |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-63: Booking tabs, detail milestones, bilty and OTP button
- **Module:** Transport      **Priority:** P1
- **Roleplay:** You are Ramesh checking where your gadi is.
- **Preconditions:** ≥1 booking in each state (requested/ongoing/upcoming/delivered/cancelled) or as available.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open My Bookings → tap tabs All / Ongoing / Upcoming / Previous / Cancelled | Bookings classified correctly in each tab |
| 2 | Open an ongoing booking detail | Milestones shown: requested → accepted → enRoute → delivered (website refines: accepted/arrivedPickup/loading/enRoute/reachedDestination/unloading) |
| 3 | Open the digital bilty | Freight charges + detention + insurance lines + balancePayable listed |
| 4 | Check the OTP reveal button | Hidden/disabled until the trip is underway |
| 5 | Check the live map | Last waypoint ping + manual ping option (no continuous GPS — one-tap pings only) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-64: Accept a transporter's instant offer on your booking 🔄
- **Module:** Transport / Offers      **Priority:** P1
- **Roleplay:** You are Ramesh. A transporter offers to do the trip for ₹50 less; you accept.
- **Preconditions:** A **requested** booking; Tester B (Transporter) sends an instant offer (🔄 see 07_cross_persona_e2e.md).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the booking → View Offers | Transporter's offer listed with new fare |
| 2 | Tap Accept → confirm | Booking **accepted** at the offered fare |
| 3 | Ask Tester B to check | Transporter notified; trip starts on their side |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-65: Decline and counter a transporter offer
- **Module:** Transport / Offers      **Priority:** P1
- **Roleplay:** You are Ramesh. One offer is too expensive; another you haggle.
- **Preconditions:** A requested booking with ≥2 transporter offers (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** Counter fare.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open offer 1 → Decline | Offer **declined**; transporter notified |
| 2 | Open offer 2 → Counter → enter your fare → send | Counter sent; transporter notified and can accept/decline |
| 3 | (From Tester B side) try a second live offer from the same transporter on the same booking | Idempotent: only one live offer per transporter per booking |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-66: Reveal POD OTP at delivery 🔄
- **Module:** Transport / POD      **Priority:** P1
- **Roleplay:** You are Ramesh. The pickup reaches Nashik APMC; you give the driver the delivery OTP for the POD.
- **Preconditions:** Trip underway → delivered (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the booking → Reveal POD OTP | 6-digit delivery OTP shown (available once the trip is underway) |
| 2 | Dictate the OTP to Tester B (driver) | Driver enters OTP + POD photos + receiver name on their side |
| 3 | Check booking status | Trip **delivered**; escrow released on POD |
| 4 | Open the bell | Delivery notification received |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-67: Share a live trip (public sanitized link)
- **Module:** Transport / Trip Sharing      **Priority:** P2
- **Roleplay:** You are Ramesh. Your son in Pune wants to follow the gadi; you share the link on WhatsApp.
- **Preconditions:** An active booking.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Booking detail → Share Trip → copy link | Shareable link copied (token rotated on re-share) |
| 2 | Open the link in an **incognito window** (no login) | Public view loads: status, route, commodity, vehicle + plate, driver name, last ping, ETA, last 20 waypoints |
| 3 | Inspect the public page for leaks | **No fares, no phone numbers, no user IDs** (compliance) |
| 4 | Revoke the share → reopen the link | Link dead/expired (410-style message) |
| 5 | (Dev-assisted) open the link after 48 h | Share expired message |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-68: Cancel booking — penalty tiers and platform ledger
- **Module:** Transport / Cancellation      **Priority:** P1
- **Roleplay:** You are Ramesh. Plans change; you cancel a booking and check what it costs you.
- **Preconditions:** Ability to create bookings; 🔄 second tester for one sub-case (see 07_cross_persona_e2e.md).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Cancel an **upcoming** booking >24 h before its slot | **Free cancellation**; no penalty lines |
| 2 | Create a booking with pickup inside 24 h → cancel | **10% of fare** penalty; reason noted |
| 3 | Create a booking with pickup inside 2 h → cancel | **25% of fare** penalty |
| 4 | Ask Tester B (transporter) to request a cancel on an active booking, then you approve the requested cancel | **Never penalised** when the cancel was transporter-requested |
| 5 | Open Transport Ledger (Mine) | Penalty lines (pen_…) and compensation (comp_…) listed; platformDuesPaisa accrued; 50% of penalty = transporter compensation credit |
| 6 | Check My Bookings → Cancelled tab | Cancelled trips listed; Rebook available |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 9 — Transport: Load Board, Templates & Rebook (TC-FRM-69 … 73)

*Posting a load to the open auction, reviewing/countering/accepting bids, detention billing, load
templates and favourites/rebook.*

### TC-FRM-69: Post a load to the auction board 🔄
- **Module:** Transport / Load Board      **Priority:** P1
- **Roleplay:** You are Ramesh. Instead of booking directly, you post your onion load and let transporters bid.
- **Preconditions:** Logged in (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** Pickup Pimpalgaon Baswant → Nashik APMC; pickupTime tomorrow 09:00; Onion 20 q; declared ₹29,000 + insurance; target fare optional.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Transportation → Post Load | Load form: route, pickupTime, vehicle type, load, qty, declared value + insurance |
| 2 | Fill the test data → Post | Load created, status **open** |
| 3 | Ask Tester B to open the transporter board | Your load visible with match scoring |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-70: Review bids, counter, accept a bid → booking born 🔄
- **Module:** Transport / Load Bids      **Priority:** P0
- **Roleplay:** You are Ramesh. Three bids came in; you counter the best one, then accept it.
- **Preconditions:** TC-FRM-69 done; ≥1 bid from Tester B (Transporter) (🔄 see 07_cross_persona_e2e.md).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the load → View Bids | Bids listed with fare, transporter, rating, match score |
| 2 | Counter the best bid → enter fare → send | Counter sent (**one-round**); transporter notified |
| 3 | Ask Tester B to accept your counter (or bid again) | — |
| 4 | Tap Accept Bid → confirm | **Booking born** with the agreed pickupTime; transporter gets reminder |
| 5 | Open My Bookings | New booking visible (upcoming/ongoing) |
| 6 | Try to accept another bid on the same load | Blocked: load already booked |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-71: Detention — waiting time logged and billed 🔄
- **Module:** Transport / Detention (FT-2)      **Priority:** P1
- **Roleplay:** You are Ramesh. Loading took 90 minutes; you see the detention charge on the bilty.
- **Preconditions:** An accepted trip (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** 90 min loading = 60 free + one 30-min slab = ₹150.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Ask Tester B (transporter) to start/stop pickup waiting for 90 min total | — |
| 2 | Open the booking bilty on your side | Detention line: **₹150** (₹150 per 30-min slab after 60 free; cap ₹2,000) |
| 3 | Open the bell | **detention_recorded** notification with duration + amount |
| 4 | Ask Tester B to start a second waiting event in the same phase | Blocked: only one open waiting event per phase |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-72: Load templates — save, repeat, delete
- **Module:** Transport / Templates (FT-5)      **Priority:** P2
- **Roleplay:** You are Ramesh. You send onions to Nashik APMC every Monday; you save this as a template.
- **Preconditions:** A posted or completed load/booking.
- **Test data:** Template "Weekly Nashik onion"; repeat date 2026-11-02; target fare optional.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Save the load as template | Template listed under Load Templates |
| 2 | Repeat template → leave pickupDate empty | Error: pickupDate required |
| 3 | Repeat with pickupDate 2026-11-02 + optional time/target fare → Run | New load born with status **open**; useCount = 1 |
| 4 | Delete the template | Removed from list; existing loads unaffected |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-73: Rebook a finished trip and favourite a transporter
- **Module:** Transport / Rebook & Favorites (FT-4)      **Priority:** P2
- **Roleplay:** You are Ramesh. The same transporter did a good job; you favourite him and clone the trip for next week.
- **Preconditions:** A delivered or cancelled booking; transporter id known.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open a delivered/cancelled booking → Rebook | Clone created with **current** fare; "rebookOf" backlink shown; Rebook button hidden on requested bookings |
| 2 | On the transporter card → Bookmark (BookmarkPlus) | Transporter pinned to Favourites |
| 3 | Open Favourites | Pinned transporter listed |
| 4 | Unpin | Removed from Favourites |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 10 — Farm Diary & P&L (TC-FRM-74 … 82)

*Diary entries (expense/income/activity) with photos and OCR receipt scan, analytics, PDF/CSV reports,
P&L dashboard with break-even, and automatic P&L entries from sales/orders.*

### TC-FRM-74: Add an expense entry (+15 Kisan Coins)
- **Module:** Farm Diary      **Priority:** P0
- **Roleplay:** You are Ramesh. You write down today's urea purchase in the diary.
- **Preconditions:** Logged in.
- **Test data:** Title "Urea fertiliser", category Fertilizers, crop Onion, party "Krushi Kendra Pimpalgaon", amount ₹2,400, date today, notes "for 1 acre".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Farm Diary → Add Expense | Form: title, category (Seeds/Fertilizers/Pesticides/Labor/Diesel-Machinery/Other), crop (Soybean/Wheat/Onion/Cotton/Vegetables), party, amount ₹, date, notes |
| 2 | Fill the test data → Save | Entry listed under expenses with correct values |
| 3 | Open Kisan Coins | **+15 coins** credited for the diary entry; ledger line "diary_entry +15" |
| 4 | Open the bell / tasks | **coins_earned** task/notification |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-75: Add income and farm-activity entries with photos
- **Module:** Farm Diary      **Priority:** P1
- **Roleplay:** You are Ramesh. You record an onion advance and note the drip installation with photos.
- **Preconditions:** Logged in.
- **Test data:** Income "Onion advance from trader" ₹5,000; activity "Drip irrigation installed" with 2 photos.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Add Entry → type income → fill title/amount ₹5,000/date → Save | Income entry listed |
| 2 | Add Entry → type farmActivity → title "Drip irrigation installed" → attach 2 photos (jpeg ≤ 5 MB) | Photos attached; entry saved |
| 3 | Attach a 3rd photo | Accepted (1–3 allowed) |
| 4 | Attach a 4th photo | Blocked: maximum 3 photos |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-76: Edit and delete a diary entry
- **Module:** Farm Diary      **Priority:** P1
- **Roleplay:** You are Ramesh correcting the urea amount from ₹2,400 to ₹2,600.
- **Preconditions:** An entry exists.
- **Test data:** New amount ₹2,600.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the expense entry → Edit → amount ₹2,600 → Save | Entry shows ₹2,600 |
| 2 | Open another entry → Delete → confirm | Entry removed from list |
| 3 | (Dev/API check) open a deleted or another farmer's entry id directly | 404 ENTRY_NOT_FOUND — no foreign data leak |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-77: Diary form validation (negative)
- **Module:** Farm Diary      **Priority:** P1
- **Roleplay:** You are Ramesh saving an entry with mistakes.
- **Preconditions:** Add Entry form open.
- **Test data:** Empty form; amount −100; amount "abc"; 6 MB photo.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Save with empty title and amount | Required-field errors; nothing saved |
| 2 | Amount −100 → Save | Negative amount rejected |
| 3 | Amount "abc" → Save | Only numbers accepted |
| 4 | Attach a 6 MB photo | Size/type error (jpeg/png/webp ≤ 5 MB) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-78: Receipt scan (OCR prefill, confirm-only)
- **Module:** Farm Diary / Receipt Scan      **Priority:** P2
- **Roleplay:** You are Ramesh. You photograph the Krushi Kendra receipt and the app prefills the entry.
- **Preconditions:** A readable paper receipt.
- **Test data:** Receipt photo.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Diary → Receipt Scan → photograph the receipt | OCR runs; title/amount/party prefilled |
| 2 | Correct any wrong field → Save | Entry saved with your confirmed values (never auto-written) |
| 3 | Cancel without saving | Nothing written to the diary |
| 4 | (Dev-assisted) simulate OCR failure | Friendly error (RECEIPT_EXTRACTION_FAILED), no partial entry |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-79: Diary filters, search and analytics summary
- **Module:** Farm Diary      **Priority:** P2
- **Roleplay:** You are Ramesh looking for all October fertiliser spending.
- **Preconditions:** Several entries exist.
- **Test data:** Filter type=expense, category=Fertilizers, from 2026-10-01 to 2026-10-31; search "urea".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Diary → filter type "expense", category "Fertilizers", date range Oct 2026 → Apply | Only matching entries listed |
| 2 | Search box: type "urea" | Text search finds the entry (matches notes/title/category) |
| 3 | Open Diary Analytics | Summary: totals by category, top expense, entry count |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-80: Diary report — PDF and CSV for a date range
- **Module:** Farm Diary / Reports      **Priority:** P1
- **Roleplay:** You are Ramesh sending your month's diary to the accountant.
- **Preconditions:** Entries exist.
- **Test data:** Current month range.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Diary → Report (PDF) → default current month → Download | PDF opens: entries table + totals |
| 2 | Change the date range → regenerate | Report reflects the range |
| 3 | Download report.csv | CSV opens in a spreadsheet with the same data |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-81: P&L dashboard and break-even calculator
- **Module:** P&L      **Priority:** P1
- **Roleplay:** You are Ramesh. You check if this season is profitable and what yield you need to break even.
- **Preconditions:** Diary entries + a lot sale exist.
- **Test data:** Break-even: Total Cost ₹40,000, Expected Price ₹1,450/q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open P&L | Cards: Total Income, Total Expenses, Net Profit — totals match diary entries |
| 2 | Check the income/expense breakdown | Lines itemised by category; auto entries flagged |
| 3 | Break-even calculator: Total Cost ₹40,000, Expected Price ₹1,450/q → Calculate | Break-even yield + margin shown |
| 4 | Tap "Season Report (PDF)" | PDF generates/downloads |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-82: Automatic P&L entries from sales and orders
- **Module:** P&L (auto entries)      **Priority:** P1
- **Roleplay:** You are Ramesh. You confirm the app recorded your lot sale and mall purchase automatically.
- **Preconditions:** TC-FRM-47 (lot sale) and TC-FRM-138 (mall order) done.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open P&L income | Auto entry **lot_sale** with the sold amount from TC-FRM-47 |
| 2 | Open P&L expenses | Auto entry **marketplace_order** with the order total from TC-FRM-138 |
| 3 | Tap an auto entry | Shows source (lot/order id); cannot be edited as a manual entry |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 11 — Government Schemes (TC-FRM-83 … 88)

*Scheme browsing (eligible-first), eligibility checklist with vault-document status, applying via the vault,
deadline-reminder tasks, portal links and AI matching.*

### TC-FRM-83: Browse schemes (eligible-first ordering)
- **Module:** Schemes      **Priority:** P1
- **Roleplay:** You are Ramesh looking for schemes you qualify for.
- **Preconditions:** Logged in.
- **Test data:** Category filter (e.g., Irrigation).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Government Schemes | List loads sorted **eligible first**, then fewest missing vault docs |
| 2 | Filter by a category | Only that category listed |
| 3 | Toggle "eligible only" | Non-eligible schemes hidden |
| 4 | Scroll to page 2 (cursor pagination) | Next page loads; malformed cursor (dev) → INVALID_CURSOR error |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-84: Scheme detail — eligibility checklist and document status
- **Module:** Schemes      **Priority:** P1
- **Roleplay:** You are Ramesh. You open PMKSY details to see what you are missing.
- **Preconditions:** Vault has some docs (7/12, PAN, soil card from TC-FRM-13).
- **Test data:** Any eligible scheme.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open a scheme card | Detail page: description, benefit amount, deadline |
| 2 | Check the eligibility checklist | Server-computed pass/fail per criterion shown |
| 3 | Check required documents | Each required doc shows vault status: ✓ uploaded or "missing" |
| 4 | Tap the portal URL (if any) | External portal link opens |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-85: Apply to a scheme via the vault
- **Module:** Schemes / Apply      **Priority:** P0
- **Roleplay:** You are Ramesh applying for a subsidy using the documents already in your vault.
- **Preconditions:** TC-FRM-84 done; eligible scheme with required docs uploaded.
- **Test data:** Docs: 7/12 + Aadhaar (from vault).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Scheme detail → "Apply via Agrovercity Vault" | Vault doc picker opens (only your vault docs) |
| 2 | Attach the required documents → Submit | Application created, status **submitted**; confirmation message |
| 3 | Re-open the scheme | "Applied" state shown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-86: Scheme application negatives
- **Module:** Schemes / Apply      **Priority:** P1
- **Roleplay:** You are Ramesh testing what the app stops you from doing.
- **Preconditions:** TC-FRM-85 done.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Apply to the **same scheme again** | Blocked: ALREADY_APPLIED (409) |
| 2 | Attach a document id that is not in your vault (dev-assisted) | Rejected: INVALID_DOCUMENT_ID (400) |
| 3 | Open a scheme you are **not eligible** for → Apply | Blocked: NOT_ELIGIBLE (403) with reason |
| 4 | (Cross-check) Tester acting as customer persona tries to apply | Customers can browse but never apply |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-87: Scheme deadline reminders
- **Module:** Schemes / Reminders      **Priority:** P2
- **Roleplay:** You are Ramesh. You want reminders before application deadlines pass.
- **Preconditions:** Eligible schemes with deadlines seeded (ask dev).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Schemes → trigger "Deadline reminders" (button or ask dev to run the job) | — |
| 2 | Check Today's Farm Action | **scheme_deadline** tasks created for eligible schemes with deadline ≤ 30 days |
| 3 | Find a scheme with deadline ≤ 7 days | Its task priority is **today** |
| 4 | Trigger reminders again | Deduped: no duplicate tasks |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-88: Scheme portals and AI matches
- **Module:** Schemes / Portals & Matches      **Priority:** P2
- **Roleplay:** You are Ramesh. You check external portals and let the AI match you to schemes.
- **Preconditions:** Logged in.
- **Test data:** lang = hi for matches.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Scheme Portals | External links listed (PM-KISAN, etc.); each opens |
| 2 | Open Schemes → "My Matches" (AI) | Matched schemes with an explanation per match |
| 3 | Run matches with lang=hi | Explanations in Hindi |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 12 — Water & Climate (TC-FRM-89 … 93)

*Weather with spray window, rain-aware irrigation schedule with tasks, groundwater and canal rotation,
and the PMKSY subsidy calculator.*

### TC-FRM-89: Weather detail and spray window
- **Module:** Water & Climate / Weather      **Priority:** P1
- **Roleplay:** You are Ramesh deciding whether to spray fungicide today.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Water & Climate | Temp, humidity, condition, rain probability, radarAvailable shown |
| 2 | Check the spray window | "Spray Window: Optimal / Check advisory" displayed and consistent with the home tile |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-90: Irrigation schedule — rain-aware tasks and drip timer
- **Module:** Water / Irrigation      **Priority:** P1
- **Roleplay:** You are Ramesh. The app tells you which plot needs water — and skips it when rain is due.
- **Preconditions:** activeCrops set (Grapes/Onion); plot exists.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open irrigation schedule | Per-plot cards from your activeCrops (fallback Soybean/Onion if none), recommended minutes each |
| 2 | Tap "Start drip timer" on a card | Timer runs; stop saves the duration |
| 3 | (Dev-assisted) forecast rain today for your location → regenerate schedule | **irrigation_skip** task "Rain is forecast today" created per plot |
| 4 | (Dev-assisted) no rain → regenerate | **irrigation** task created; tasks deduped per plot per day (no duplicates) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-91: Groundwater and canal rotation
- **Module:** Water / Groundwater & Canal      **Priority:** P2
- **Roleplay:** You are Ramesh checking water table and the Gangapur canal roster.
- **Preconditions:** Logged in.
- **Test data:** District Nashik; canal Gangapur; unknown district.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open groundwater card → district Nashik | Depth + zone shown (safe/semiCritical/critical — Nashik seeded) |
| 2 | Enter an unknown district | Default: semiCritical, 18.5 m |
| 3 | Open canal rotation → canal Gangapur | Roster: Monday 06:00–12:00, next date shown; Palkhed: Wednesday 12:00–18:00 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-92: PMKSY subsidy calculator
- **Module:** Water / PMKSY Calculator      **Priority:** P1
- **Roleplay:** You are Ramesh. You calculate the subsidy for a drip system on your 3 acres.
- **Preconditions:** Logged in.
- **Test data:** 3 acres; benchmark ₹85,000/acre; 55% subsidy.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open PMKSY calculator → move acreage slider to 3 → Calculate My Subsidy | Total ₹2,55,000; subsidy (55%) ₹1,40,250; farmer share ₹1,14,750 — shown in ₹ + paisa |
| 2 | Verify the math by hand | Matches: 85,000 × 3 = 2,55,000; × 0.55 = 1,40,250 |
| 3 | Enter area in hectares instead | areaHa input accepted, same result |
| 4 | Optional cropType | Accepted; result unchanged |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-93: PMKSY calculator negative
- **Module:** Water / PMKSY Calculator      **Priority:** P2
- **Roleplay:** You are Ramesh submitting an empty calculator.
- **Preconditions:** Calculator open.
- **Test data:** All inputs empty.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Clear all inputs → Calculate | Error: provide at least one of acres / areaHa / costPaisa (422); no result |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 13 — Soil Tests (TC-FRM-94 … 96)

*Booking a soil test per plot, the one-active-booking rule, and redeeming a soil test with Kisan Coins.*

### TC-FRM-94: Book a soil test
- **Module:** Soil Tests      **Priority:** P1
- **Roleplay:** You are Ramesh. You book a soil test for Gat 312 before the Rabi sowing.
- **Preconditions:** Plot Gat 312 exists.
- **Test data:** Address (Gate 312, Pimpalgaon Baswant), slot 2026-10-27 10:00.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Soil Tests → Book Soil Test | Form: plot select, address, slot picker |
| 2 | Select Gat 312, enter address and slot → Book | Booking created, status **booked** |
| 3 | Open My Soil Tests | Booking listed with slot |
| 4 | (Dev-assisted) mark result ready → check booking | Status **reportReady**; resultPdfUrl opens the report PDF |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-95: Duplicate soil test on same plot (negative)
- **Module:** Soil Tests      **Priority:** P1
- **Roleplay:** You are Ramesh. You try to book a second test for the same plot while one is active.
- **Preconditions:** TC-FRM-94 booking still active (not reportReady).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Book another test for Gat 312 | Blocked: **SOIL_TEST_ALREADY_BOOKED** (409), message in Hindi |
| 2 | Book a test for a **different** plot | Allowed |
| 3 | (Dev-assisted) book for a non-existent plot id | 404 plot not found |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-96: Redeem a soil test with 500 Kisan Coins
- **Module:** Soil Tests / Gamification      **Priority:** P1
- **Roleplay:** You are Ramesh. Instead of paying, you redeem your coins for a soil test.
- **Preconditions:** Coin balance ≥ 500.
- **Test data:** Reward "मिट्टी जांच (soil test)" = 500 coins.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Kisan Coins → Rewards → choose soil test (500) → Redeem | Redeem succeeds; **−500 coins** in ledger |
| 2 | Open My Soil Tests | A booking was created from the redemption |
| 3 | Open the bell / FCM tray | "इनाम भुनाया गया" (reward redeemed) notification |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 14 — Livestock & Dairy (TC-FRM-97 … 107)

*Pashu Aadhaar animal registration, yield logs, vet booking (clinic/farm/tele) with its known gap, vet
records, vaccinations with auto next-due, breeding, milk rate calculator, gaushala manure orders,
adoptions/donations and dairy orders.*

### TC-FRM-97: Register an animal (Pashu Aadhaar)
- **Module:** Livestock / Herd      **Priority:** P1
- **Roleplay:** You are Ramesh. You register your buffalo "Ganga" for tracking and vet care.
- **Preconditions:** Logged in; animal photo available.
- **Test data:** tagId "MH-12-0345", name Ganga, species buffalo, breed Murrah, gender female, ageMonths 48, lactationStatus lactating, dailyYieldLiters 6.5, sire "Krishna", dam "Lakshmi", healthStatus healthy, photo.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Livestock & Dairy → My Animals → Register Animal | Form: tagId, name, species (cow/buffalo), breed, gender, ageMonths, lactationStatus, lactationCycle, dailyYieldLiters, sire, dam, healthStatus, photoUrl, ownerType |
| 2 | Fill the test data → Save | Animal saved; card appears in My Animals with photo and tag |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-98: Log milk yield and view history
- **Module:** Livestock / Dairy Logs      **Priority:** P2
- **Roleplay:** You are Ramesh. Suresh milked 6.2 L this morning; you log it.
- **Preconditions:** TC-FRM-97 done.
- **Test data:** Date today, shift morning, yield 6.2 L, fat 6.5%, snf 9.2%, notes "Morning milking".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Animal card → Log Yield | Form: date, shift (morning/evening), yieldLiters, fatPercent, snfPercent, notes |
| 2 | Fill the test data → Save | Log saved |
| 3 | Open Yield History | Today's entry listed with fat/SNF |
| 4 | Log the evening shift too | Two entries for the day visible |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-99: Vet list and clinic-visit booking
- **Module:** Livestock / Vet Care      **Priority:** P1
- **Roleplay:** You are Ramesh. Ganga has a fever; you book a vet at the clinic.
- **Preconditions:** Vets seeded.
- **Test data:** Vet with clinic visit; animalType buffalo; slot tomorrow 11:00.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Vet Care → vet list | Vets with ratings listed; emergency filter works |
| 2 | Open a vet → Book | Visit types: clinic / farm / tele with consultationFeeRupees shown per type |
| 3 | Choose clinic, slot tomorrow 11:00, animalType buffalo → Confirm | Booking born **confirmed** with the fee shown |
| 4 | Check My Bookings | Vet booking listed |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-100: Farm-visit guard and tele booking
- **Module:** Livestock / Vet Care      **Priority:** P1
- **Roleplay:** You are Ramesh. You want the vet to visit the farm, but this vet only does clinic visits.
- **Preconditions:** A vet with availableForFarmVisit = false (seeded).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open that vet → choose visit type "farm visit" | Blocked: **FARM_VISIT_UNAVAILABLE** (400), message in Hindi |
| 2 | Choose "tele" consult on any vet → confirm | Tele booking confirmed with fee |

> ⚠️ **Known gap in current build:** vet bookings have **no completion transition** — the booking stays
> "confirmed" forever, so vet ratings (which require status "completed") cannot be given. Expected
> (correct): after the visit the booking completes and a rating prompt appears. Performing this check will
> likely FAIL — raise a defect.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-101: Vet visit record
- **Module:** Livestock / Vet Records      **Priority:** P2
- **Roleplay:** You are Ramesh. After the visit you note the diagnosis, medicines and milk-withdrawal days.
- **Preconditions:** TC-FRM-99 done.
- **Test data:** temperatureF 101.2, symptoms "fever, dull", diagnosis "mastitis", prescriptions, withdrawalPeriodDays 4, fee ₹300.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Animal → Vet Records → Add Record | Form: visitType, temperatureF, symptoms, diagnosis, prescriptions, withdrawalPeriodDays, feeCharged |
| 2 | Fill the test data → Save | Record saved; listed under the animal with withdrawal warning (4 days) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-102: Vaccination with automatic next-due
- **Module:** Livestock / Vaccinations      **Priority:** P1
- **Roleplay:** You are Ramesh. You record Ganga's FMD vaccination; the app schedules the next dose.
- **Preconditions:** Animal registered.
- **Test data:** disease FMD, vaccineName, batchNumber, administeredDate today, administeredBy "Dr. Kadam".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Vaccinations → Add | Form: animalTagId, animalName, disease, vaccineName, batchNumber, administeredDate, administeredBy |
| 2 | Fill the test data → Save | Status **completed** |
| 3 | Check next due date | FMD → **+180 days** (non-FMD vaccines → +365 days) |
| 4 | (Dev-assisted) move date near due → check tasks | **vaccination_due** task appears; "mark-vaccinated" resolves it |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-103: Breeding record and status updates
- **Module:** Livestock / Breeding      **Priority:** P2
- **Roleplay:** You are Ramesh. You record Ganga's AI and track the pregnancy.
- **Preconditions:** Animal registered.
- **Test data:** heatDate 2026-09-20, aiDate 2026-09-22, semenStrawId "MS-7788", bullBreed Murrah, technicianName "Mr. Jadhav", species buffalo.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Breeding → Add Record | Form: animalId/tag/name, heatDate, aiDate, semenStrawId, bullBreed, technicianName, species, notes |
| 2 | Fill the test data → Save | Status **inseminated**, pregnancyStatus pending |
| 3 | Check computed dates | Buffalo gestation 310 d → expectedCalvingDate = AI + 310 d; PD due = AI + 60 d (cow: 280 d) |
| 4 | Update status → "pregnant" | Status updated; later "calved" with calfGender + actualCalvingDate accepted |
| 5 | Enter an invalid status literal (dev-assisted) | Rejected: must be inseminated/pregnant/calved/failed |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-104: Milk rate calculator (Hindi formula)
- **Module:** Livestock / Milk Rate      **Priority:** P2
- **Roleplay:** You are Ramesh. You check what your 6.5-fat buffalo milk is worth today.
- **Preconditions:** Logged in.
- **Test data:** Buffalo, FAT 6.5, SNF 9.5; Cow, FAT 3.5, SNF 8.5.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Dairy → Milk Rate Calculator | Form: species, FAT, SNF |
| 2 | Buffalo, FAT 6.5, SNF 9.5 → Calculate | Base ₹55 (FAT 6.0/SNF 9.0) + FAT/SNF premiums; never below floor **₹42**; formula explained in Hindi |
| 3 | Cow, FAT 3.5, SNF 8.5 → Calculate | Base ₹35 (FAT 3.5/SNF 8.5); floor **₹28** |
| 4 | Verify the formula by hand | Your calculation matches the shown rate |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-105: Gaushala list and manure order 🔄
- **Module:** Livestock / Gaushala      **Priority:** P1
- **Roleplay:** You are Ramesh. You order 200 kg of cow-dung manure from the nearest gaushala.
- **Preconditions:** Gaushalas seeded (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** Product "Cow dung manure", quantity 200 kg.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Gaushala & Manure → gaushala list | Sorted by distanceKm |
| 2 | Open nearest gaushala → Manure Order | Form: product, quantity |
| 3 | Fill the test data → Place Order | Order status **placed** |
| 4 | Ask Tester B (gaushala manager) to check | Order visible on their side |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-106: Gaushala adoption, donation and byproducts
- **Module:** Livestock / Gaushala      **Priority:** P2
- **Roleplay:** You are Ramesh. Your son in Pune wants to sponsor a cow; you also donate ₹500 and browse panchagavya products.
- **Preconditions:** Gaushalas seeded.
- **Test data:** cowTag "GS-101", cowName "Nandini", donor = your son (name/phone/city Pune), tier, amount ₹2,100, billingCycle monthly; donation ₹500.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Gaushala → Adopt a Cow → fill the test data → Confirm | Adoption status **active**; certificate number **GOSH-2026-ADOPT-…**; endDate 2027-12-31 |
| 2 | Donate → amount ₹500 → pay (sandbox) | Receipt **GOSH-RCP-…** issued |
| 3 | Open byproducts | Panchagavya products listed |
| 4 | My Adoptions / My Donations | Both listed with certificates/receipts |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-107: Dairy product order + out-of-stock (negative)
- **Module:** Livestock / Dairy Products      **Priority:** P1
- **Roleplay:** You are Ramesh. You order ghee for the house; a sold-out product must not be orderable.
- **Preconditions:** Dairy products seeded (one out of stock).
- **Test data:** Ghee 1 L; out-of-stock product.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Dairy → products by category | Category filter works; products listed |
| 2 | Order ghee 1 L → confirm | Order **placed**; visible in My Bookings/orders |
| 3 | Order the out-of-stock product | Blocked: **OUT_OF_STOCK** (409), message in Hindi |
| 4 | Open the bell | Order confirmation notification |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 15 — Tree Plantation & Carbon (TC-FRM-108 … 113)

*Carbon earnings estimate, plantation registration with survival-check tasks, growth logs, NGO sapling
requests, articles/care guides and the web-parity gap.*

### TC-FRM-108: Carbon credit estimate
- **Module:** Tree Plantation / Carbon      **Priority:** P1
- **Roleplay:** You are Ramesh. You wonder what 50 teak trees could earn from carbon credits.
- **Preconditions:** Logged in.
- **Test data:** treeSpecies teak, treeCount 50, ageYears 5.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tree Plantation → Carbon Calculator | Form: treeSpecies, treeCount, ageYears |
| 2 | Enter the test data → Estimate | CO₂ absorption shown (teak = 22 kg/tree/yr × 50); credits = 10-year CO₂ ÷ 1000; **earnings = credits × ₹1,200**; Hindi formula explanation shown |
| 3 | Verify the math by hand | Matches: 22 × 50 × 10 = 11,000 kg → 11 credits → ₹13,200 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-109: Register a plantation (survival-check tasks)
- **Module:** Tree Plantation      **Priority:** P1
- **Roleplay:** You are Ramesh. You register 200 neem trees planted on the east acre this monsoon.
- **Preconditions:** Logged in.
- **Test data:** parcelName "East acre", treeSpecies neem, vernacular "Neem / नीम", treeCount 200, plantingDate 2026-10-22, landType, lat/lng, initialHeightCm 45, photo, irrigationType drip.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tree Plantation → Register Plantation | Form: parcelName, treeSpecies, vernacularSpecies, treeCount, plantingDate, landType, latitude, longitude, initialHeightCm, photoUrl, irrigationType |
| 2 | Fill the test data → Save | Plantation status **active**, survivalRate 100 |
| 3 | Check tasks (ask dev to confirm schedule) | **survival_check** tasks queued at **+30 / +90 / +180 days** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-110: Plantation growth log recomputes survival rate
- **Module:** Tree Plantation      **Priority:** P1
- **Roleplay:** You are Ramesh. After 30 days, 190 of 200 trees survived; you log the measurement.
- **Preconditions:** TC-FRM-109 done.
- **Test data:** heightCm 60, girthCm 12, survivalCount 190, healthStatus good, notes "Wind damage on 10", auditDate today.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the plantation → Add Log | Form: heightCm, girthCm, survivalCount, healthStatus, notes, photoUrl, auditDate |
| 2 | Fill the test data → Save | **survivalRate recomputed = 95%**; currentAvgHeightCm = 60; log listed |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-111: NGO sapling request
- **Module:** Tree Plantation / NGOs      **Priority:** P2
- **Roleplay:** You are Ramesh. You request 100 free neem saplings from an NGO.
- **Preconditions:** NGOs listed.
- **Test data:** treeType neem, count 100.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tree Plantation → NGOs → search "neem" | NGO list with q search |
| 2 | Open an NGO → Request Saplings → treeType neem, count 100 → Submit | Request status **pending** |
| 3 | My Sapling Requests | Request listed as pending |

> Note: NGO approval is explicitly **deferred to phase-07** — status staying "pending" is the correct current
> behaviour, not a defect. Re-check in a later phase.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-112: Tree articles, care guides, schemes and species suitability
- **Module:** Tree Plantation / Library      **Priority:** P2
- **Roleplay:** You are Ramesh reading about agroforestry before planting more.
- **Preconditions:** Logged in.
- **Test data:** soilType "black", waterAvailability "medium".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tree Plantation → Articles → filter by category / search | Articles listed |
| 2 | Open Biofuel list | Biofuel species/products listed |
| 3 | Open Care Guides | Care guides listed and readable |
| 4 | Open Agroforestry Schemes | Tree-related schemes listed |
| 5 | Species Suitability → soilType black, waterAvailability medium | Suitable species list returned |
| 6 | My Adoptions | Lists adoptions (empty or from marketplace plant-a-tree) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-113: ⚠️ Tree Plantation missing on the website
- **Module:** Tree Plantation / Web parity      **Priority:** P2
- **Roleplay:** You are Ramesh on your laptop. You look for the Tree Plantation screen you used on the phone.
- **Preconditions:** Logged in on the website.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | On the website, open the farmer navigation and look for "Tree Plantation" | **Expected (per UX parity):** the module is reachable on web like mobile. **Current build:** it is mobile-only and absent on web |
| 2 | Try direct URL guesses under /farmer | No route found |

> ⚠️ **Known issue in current build — performing this case will likely FAIL; raise a defect** (or record the
> exclusion as an accepted scope limit with the product owner).

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 16 — Crop Insurance (TC-FRM-114 … 120)

*Policies (incl. the demo PMFBY policy), premium calculator and rates, policy application with risk score,
certificate PDF, 72-hour claim intimation, claim negatives, the claim lifecycle with provider/admin, and appeals.*

### TC-FRM-114: My policies list (demo PMFBY policy)
- **Module:** Insurance / Policies      **Priority:** P1
- **Roleplay:** You are Ramesh checking your existing policies before the season.
- **Preconditions:** Logged in; dev seed present.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Crop Insurance → My Policies | Demo **PMFBY** policy listed with crop, sum insured, premium, status |
| 2 | Open the policy | Detail: policy number, season, land area, validity |
| 3 | Filter by status | Filter tabs work |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-115: Premium calculator, rates and policy application
- **Module:** Insurance / Apply      **Priority:** P0
- **Roleplay:** You are Ramesh. You insure your Kharif onions under PMFBY and check what you pay vs the government.
- **Preconditions:** Logged in.
- **Test data:** cropName Onion, season Kharif, landAreaAcres 3, category, khasraNumber 312, sowingDate 2026-11-01.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Schemes & Rates → rates for season Kharif, crop Onion | Rate table shown (rate/acre) |
| 2 | Premium Calculator → crop Onion, Kharif, 3 acres, sumInsured → Calculate | Farmer premium vs **govt subsidy split** shown, paisa-accurate |
| 3 | Apply for Policy → fill the test data → Submit | Sum insured = rate × 3 acres; **policyNumber PMFBY-2026-…**; status **pending_approval** |
| 4 | Check the risk score | Score shown with breakdown (base 25; +15 Kharif; +10 >10 acres; +25 rainfed → Low/Medium/High) |
| 5 | Ask **[ADMIN/provider]** to approve | Status → approved; notification received |

> ⚠️ **Known gap in current build:** the farmer premium is **recorded but never collected** (collection is
> deferred to the payments module). Expected (correct per full UX): an approved policy shows a "Pay Premium"
> step. Performing this check will likely show no payment option — note it and raise a defect if product
> expects collection in this phase.

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-116: Policy certificate PDF
- **Module:** Insurance / Certificate      **Priority:** P2
- **Roleplay:** You are Ramesh downloading the policy certificate for the bank.
- **Preconditions:** An approved policy.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the approved policy → Download Certificate | certificate.pdf opens: policy number, crop, season, sum insured, farmer premium, validity |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-117: Intimate crop loss within 72 hours
- **Module:** Insurance / Claims      **Priority:** P0
- **Roleplay:** You are Ramesh. Hail damaged your grapes; you intimate the loss the same day.
- **Preconditions:** An approved policy for Grapes (or apply first via TC-FRM-115).
- **Test data:** calamityType hail, cropName Grapes, estimatedLossPercent 40, requestedAmount ₹40,000, village Pimpalgaon Baswant, GPS 20.0000, 74.0000, 2 photos.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | My Claims → "Intimate Crop Loss (72h)" | Form: calamity type select, crop, loss %, requested amount, village, GPS, photos; a "within 72 h" deadline label is visible |
| 2 | Fill the test data → Submit | Claim created, status **intimated**; intimation timestamp recorded |
| 3 | Open Claim Tracker | Claim listed with status intimated |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-118: Claim form negatives
- **Module:** Insurance / Claims      **Priority:** P1
- **Roleplay:** You are Ramesh fumbling the claim form.
- **Preconditions:** Claim form open.
- **Test data:** Loss 150%; amount "abc"; missing calamity type; 6 MB photo.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Loss % 150 → Submit | Rejected: loss % must be 0–100 |
| 2 | Requested amount "abc" → Submit | Only numbers accepted |
| 3 | Calamity type empty → Submit | Required-field error |
| 4 | Attach a 6 MB photo | Size error; claim not created |
| 5 | (UI check) claim raised >72 h after event | Deadline warning label shown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-119: Claim tracker lifecycle 🔄 [provider/admin]
- **Module:** Insurance / Claims      **Priority:** P1
- **Roleplay:** You are Ramesh. You follow your claim from survey to DBT money in your account.
- **Preconditions:** TC-FRM-117 done (🔄 provider/admin actions, see 07_cross_persona_e2e.md).
- **Test data:** Assessed loss 35%; approved ₹35,000 (≤ ₹50,000 — no dual sign-off).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Wait for provider to schedule survey | FCM/push: **surveyor assigned** with name, phone, date; status → surveyorAssigned |
| 2 | Provider submits field assessment | Status → fieldAssessed; assessed loss % visible |
| 3 | Provider approves | Status → dbtApproved; approved amount = requested × loss% (or override) shown |
| 4 | (For a > ₹50,000 claim, ask for 2nd admin) | Claim holds at **pending_second_signoff** until a second **[ADMIN]** approves |
| 5 | Provider disburses via DBT | Status → **disbursed**; dbtTransactionId shown; FCM "**…आपके खाते में अंतरित**" |
| 6 | Check your bank | Sandbox credit of ₹35,000 in the primary account |
| 7 | (Rejected branch) ask provider to reject another claim with reason | Status → rejected with reason visible |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-120: Appeal a rejected claim
- **Module:** Insurance / Claims      **Priority:** P2
- **Roleplay:** You are Ramesh. Your claim was rejected; you appeal with more evidence.
- **Preconditions:** A rejected claim.
- **Test data:** Reason "Assessment missed the hail-damaged block" + 1 new photo.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the rejected claim → Appeal | Appeal sheet: reason + additional evidence |
| 2 | Fill the test data → Submit | Appeal submitted; claim re-enters review; status updated |
| 3 | Ask provider to check | Appeal visible on their side |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 17 — Loans, KCC & Finance (TC-FRM-121 … 128)

*Kisan credit score and tiers, KCC card, EMI calculator, loan application with linked 7/12 and bank account,
info requests and cancellation, the full lifecycle with Hindi notifications, and EMI schedule/repayments.*

### TC-FRM-121: Kisan credit score and tier
- **Module:** Finance / Credit Score      **Priority:** P1
- **Roleplay:** You are Ramesh checking your creditworthiness before asking for a loan.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Finance → Credit Score | kisanCreditScore shown (default 650 seeded); creditTier shown: Bronze ₹25k / Silver ₹50k / Gold ₹1L / Platinum ₹2L limit |
| 2 | Read the score factors | Factors listed: timely KCC repayment, crop insurance coverage, 3-season income history |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-122: KCC card
- **Module:** Finance / KCC      **Priority:** P1
- **Roleplay:** You are Ramesh viewing your Kisan Credit Card.
- **Preconditions:** KCC seeded (ask dev if absent).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Finance → KCC Card | Card shows: bankName, masked number **XXXX-XXXX-{phoneLast4}**, kccLimit, availableLimit |
| 2 | (If no KCC) open the same screen | Friendly empty state / 404 KCC_NOT_FOUND handled without crash |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-123: Loan EMI calculator
- **Module:** Finance / Calculator      **Priority:** P2
- **Roleplay:** You are Ramesh checking the EMI on a ₹50,000 loan.
- **Preconditions:** Logged in.
- **Test data:** ₹50,000, 12 months, 4% p.a.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Loan Calculator → amount ₹50,000, tenure 12, rate 4% → Calculate | EMI, totalInterest, totalPayable shown |
| 2 | Verify with your own calculation | Numbers match |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-124: Apply for a loan (KCC @ 4%)
- **Module:** Loans / Apply      **Priority:** P0
- **Roleplay:** You are Ramesh. You apply for ₹50,000 KCC against your verified bank account and linked 7/12.
- **Preconditions:** Bank account verified + primary (TC-FRM-09); 7/12 imported (TC-FRM-12).
- **Test data:** loanType "Kisan Credit Card (KCC) @ 4%", amount ₹50,000, tenureMonths 12, interestRate 4, partnerBankId, district Nashik, bankAccountId, landRecordId (Gat 312).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Finance → Apply for Loan | Form with the fields above; "Linked 7/12 Land Record ID" dropdown offers Gat 312 |
| 2 | Fill the test data → Submit | Application status **submitted**; **applicationNumber** issued; timeline entry created |
| 3 | Check the AI prescreen | Prescreen annotation shown (suggestion only) |
| 4 | Open My Loans | Application listed with status submitted |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-125: Loan application negatives
- **Module:** Loans / Apply      **Priority:** P1
- **Roleplay:** You are Ramesh testing what the bank form rejects.
- **Preconditions:** Loan apply form open.
- **Test data:** Amount 0/−5; no bank account; bad landRecordId.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Amount 0 or −5 → Submit | Rejected: amount must be positive |
| 2 | No bank account on profile → Submit | Error: verified bank account required |
| 3 | Unverified bank account selected (dev-assisted) | Rejected |
| 4 | landRecordId invalid/not yours (dev-assisted) | Rejected; no cross-user probing |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-126: Respond to an information request, then cancel 🔄
- **Module:** Loans / Info Requests      **Priority:** P1
- **Roleplay:** You are Ramesh. The bank asks for extra documents; you upload them. Later you cancel another application.
- **Preconditions:** An application in submitted/underReview (🔄 banker action, see 07_cross_persona_e2e.md).
- **Test data:** Response document (PDF ≤ 5 MB).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Ask the banker to request information on your application | You receive **loan_doc_request** task + notification "जानकारी आवश्यक"; status → infoRequested |
| 2 | Open the loan → Respond → attach the document → Send | Status back to **underReview**; task resolved; banker notified |
| 3 | Open a **different** application (submitted) → Cancel → confirm | Status → **cancelled**; banker notified |
| 4 | Try to Cancel an already-approved application | Blocked: LOAN_INVALID_TRANSITION |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-127: Loan lifecycle with Hindi notifications 🔄 [banker]
- **Module:** Loans / Lifecycle      **Priority:** P0
- **Roleplay:** You are Ramesh. Your loan moves through review, approval and disbursement — you verify every Hindi notification and the money.
- **Preconditions:** TC-FRM-124 application (🔄 banker actions, see 07_cross_persona_e2e.md).
- **Test data:** Sanction ₹50,000 @ 4%, 12 months.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Ask the banker to start review | Notification **"समीक्षा में"** (under review); status underReview, officer assigned |
| 2 | Ask the banker to approve with sanctioned terms | Notification **"ऋण स्वीकृत ₹50,000 @ 4%"**; status approved; sanctionedAmount/rate/tenure visible |
| 3 | Ask the banker to disburse (disbursementRef) | Notification **"राशि वितरित"**; status disbursed; ₹50,000 credited to your primary bank (sandbox) |
| 4 | Check EMI reminders | EMI reminder entries scheduled after disbursement |
| 5 | (Rejected branch) ask the banker to reject another application **with a reason** | Rejection without reason is blocked for the banker; you see **"अस्वीकृत"** notification + reason |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-128: EMI schedule and repayments
- **Module:** Loans / Repayments      **Priority:** P1
- **Roleplay:** You are Ramesh checking what you owe each month.
- **Preconditions:** A disbursed loan.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the disbursed loan → EMI Schedule | 12 EMIs listed (date, principal, interest); sanctioned terms used |
| 2 | Open Repayments | Repayments list; daysOverdue/defaultRisk shown when applicable |
| 3 | Ask the banker to record an EMI, then a duplicate EMI (same emiIndex) | First recorded; duplicate blocked: **DUPLICATE_EMI** (409) |
| 4 | Download a loan document (if any) | Signed URL works; expires after 60 min |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 18 — Broker Deals, Seller Side (TC-FRM-129 … 134)

*Deals a broker opens with Ramesh: viewing, negotiating with messages and amount offers, MPIN e-sign
acceptance, milestones, the post-acceptance vault, evidence, disputes and rating the broker.*

### TC-FRM-129: View incoming broker deals
- **Module:** Broker Deals      **Priority:** P1
- **Roleplay:** You are Ramesh. A broker created a deal for your grapes; you check the terms.
- **Preconditions:** Broker has created a deal against your phone number (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Broker Deals | Deals matched to your phone/farmerId listed with status chips (negotiating/contract_issued/accepted/in_transit/completed/cancelled) |
| 2 | Check the list for blocked brokers | Deals from blocked brokers are hidden |
| 3 | Open a deal | Detail: crop, quantity, agreed price, status, broker card |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-130: Deal messages and amount-offer counter 🔄
- **Module:** Broker Deals / Chat      **Priority:** P1
- **Roleplay:** You are Ramesh. The broker offers ₹2,700; you reply with a message and a counter amount.
- **Preconditions:** A deal in negotiating (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** Message "Rate thoda badhaiye"; amountOffer ₹2,850.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open deal → Messages → type a message → send | Message delivered (moderated) |
| 2 | Send a message with amountOffer ₹2,850 | Offer recorded; counter-round availability checked; broker notified **deal_counter_offer** |
| 3 | (With Tester B) push both sides to a round-two deadlock | Deadlock evaluation notifies both parties |
| 4 | Ask Tester B to issue the contract | Deal status → **contract_issued** with final terms |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-131: Accept the contract with MPIN e-sign 🔄
- **Module:** Broker Deals / E-sign      **Priority:** P0
- **Roleplay:** You are Ramesh. You accept the broker's contract; the app asks for your MPIN as a signature.
- **Preconditions:** Deal in contract_issued; you have an MPIN set (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** MPIN 4321.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the deal → Accept | MPIN prompt appears ("sign with your MPIN") |
| 2 | Enter 4321 → Confirm | Deal status → **accepted**; acceptance recorded with signatureData + consentTimestamp |
| 3 | Ask Tester B to check | Broker notified **"Farmer accepted"** |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-132: Wrong MPIN and illegal accept/decline (negative)
- **Module:** Broker Deals / E-sign      **Priority:** P1
- **Roleplay:** You are Ramesh. You mistype the MPIN, and you try to decline a deal that is only negotiating.
- **Preconditions:** A deal in contract_issued; another in negotiating.
- **Test data:** Wrong MPIN 9999; decline reason "Rate not right".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Accept the contract_issued deal with MPIN 9999 | Rejected: **WRONG_MPIN** (401); deal stays contract_issued |
| 2 | Accept a **negotiating** deal (before contract issued) | Blocked: INVALID_STATE (409) |
| 3 | Decline the negotiating deal → give reason | Deal → **cancelled** with cancelReason saved |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-133: Milestones, post-acceptance vault and evidence
- **Module:** Broker Deals / Vault & Milestones      **Priority:** P2
- **Roleplay:** You are Ramesh. After accepting, you watch the broker's delivery milestones and attach photos.
- **Preconditions:** An **accepted** deal (TC-FRM-131).
- **Test data:** 2 evidence photos.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the accepted deal → Milestones | Broker-pushed milestones (e.g., "Loading done", "In transit") listed read-only |
| 2 | Open the deal Vault | Typed vault visible (post-acceptance only) |
| 3 | (Negative, pre-acceptance check) ask dev to hit the vault endpoint on a negotiating deal | **VAULT_LOCKED** (409) |
| 4 | Upload evidence photos (photo/video) | Photos attached; at the evidence cap further upload blocked: **EVIDENCE_LIMIT_REACHED** (409) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-134: Deal dispute and rating the broker 🔄
- **Module:** Broker Deals / Disputes & Ratings      **Priority:** P1
- **Roleplay:** You are Ramesh. Payment is late; you open a dispute and later rate the broker.
- **Preconditions:** A deal in accepted/in_transit/completed (🔄 second tester, see 07_cross_persona_e2e.md).
- **Test data:** Dispute reason "Payment pending after delivery"; rating 5 stars.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the deal → Raise Dispute → reason → submit | Dispute opened (only **one open** per deal — a second is blocked); escrow payout paused; broker + admin notified (deal_dispute_opened, high-priority admin task) |
| 2 | Ask **[ADMIN]** to resolve | Dispute resolved; escrow resumes per ruling |
| 3 | After the deal completes → Rate Broker | Rating saved (kind deal, targetRole broker); duplicate rating blocked |
| 4 | Check the broker's trust on a new deal | Rating aggregated on the broker card |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 19 — Krishi Mall & Orders (TC-FRM-135 … 142)

*Product browsing and reviews, address book and cart, checkout with coupon + coins + plant-a-tree,
BNPL installments, order tracking with seller notifications, cancel/refund/retry, invoice and reorder.*

### TC-FRM-135: Browse Krishi Mall products
- **Module:** Krishi Mall      **Priority:** P1
- **Roleplay:** You are Ramesh buying certified onion seeds for the Rabi crop.
- **Preconditions:** Logged in; marketplace seeded.
- **Test data:** Search "seeds".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Krishi Mall (via Hot Offer banner or menu) | Product grid loads by category |
| 2 | Search "seeds" | Matching products listed |
| 3 | Check product cards | Price, seller name, **inStock flag only** (no stock numbers exposed); blocked sellers absent |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-136: Product detail, batch certificate and review
- **Module:** Krishi Mall / Product Detail      **Priority:** P2
- **Roleplay:** You are Ramesh checking the seed certificate before buying, and leaving a review after.
- **Preconditions:** TC-FRM-135 done.
- **Test data:** Review 4 stars "Good germination".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open a seed product | Detail: price, seller, description, reviews |
| 2 | Tap View Certificate (batch) | Certificate PDF opens |
| 3 | After a delivered purchase, post a review 4 stars "Good germination" | Review listed; ratingAvg/ratingCount updated |
| 4 | Post another review for the same product | Upsert: your old review is replaced (one per user) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-137: Address book and cart management
- **Module:** Krishi Mall / Address Book & Cart      **Priority:** P1
- **Roleplay:** You are Ramesh saving your home address and building a cart of 2 items.
- **Preconditions:** Logged in.
- **Test data:** House No 42, Ganesh Chowk, Pimpalgaon Baswant, Nashik 422209; items: seeds ×2, pesticide ×1.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Profile → Address Book → Add Address → fill test data → Save; set as default | Address saved with default badge |
| 2 | Edit the address (landmark) → Save; then add a second address and delete it | Edit persisted; delete works; default address feeds checkout |
| 3 | Product → Add to Cart (qty 2); second product (qty 1) | Cart badge = 2 line items |
| 4 | Cart → change qty to 5; remove the second item; set qty 0 on the first | Totals update; qty 0 removes the item; empty-cart state shown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-138: Checkout — UPI payment with coupon, coins and plant-a-tree
- **Module:** Orders / Checkout      **Priority:** P0
- **Roleplay:** You are Ramesh. You check out with a coupon, some coins, and tick "plant a tree" for your village.
- **Preconditions:** Cart has items; coins balance ≥ 100; valid coupon code from the team; Razorpay sandbox.
- **Test data:** Coupon (team-provided); redeem 100 coins; UPI ramesh.patil@upi; delivery slot tomorrow 10:00–13:00; plant-a-tree ON.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Cart → Checkout | Checkout sheet: address (default selected), delivery slot, coupon field, coins redemption, plant-a-tree toggle, BNPL option |
| 2 | Apply the coupon | Discount shown in the total |
| 3 | Redeem 100 coins | Total reduced by ₹100 (coins deducted, 1 coin = ₹1) |
| 4 | Tick plant-a-tree → Pay via Razorpay UPI (ramesh.patil@upi) | Payment success; order status **placed → paid**; cart cleared |
| 5 | Ask Tester B (seller) to check | Seller got new-order task + notification |
| 6 | Check Tree Plantation → My Adoptions | A tree_adoptions doc exists (source marketplace_order, "Native mix", your name as sponsor) |
| 7 | Check P&L | Auto expense entry marketplace_order recorded |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-139: Checkout negatives
- **Module:** Orders / Checkout      **Priority:** P1
- **Roleplay:** You are Ramesh testing what checkout refuses.
- **Preconditions:** Cart with items; known coupon.
- **Test data:** Coins 999999; invalid coupon; qty below minOrderQty (dev-assisted).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Redeem more coins than your balance | Blocked: **COINS_INSUFFICIENT** |
| 2 | Redeem coins above the X11% cap of order value (dev-assisted) | Blocked: **REDEMPTION_CAP_EXCEEDED** (422) |
| 3 | Apply a nonsense coupon | Invalid coupon error |
| 4 | (Dev-assisted) order qty below minOrderQty / out-of-stock | MIN_ORDER_QTY / **OUT_OF_STOCK** errors; order not created |
| 5 | Retry the same checkout with the same idempotency key (dev-assisted) | Stored response returned — no double order |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-140: BNPL order — two installments
- **Module:** Orders / BNPL      **Priority:** P1
- **Roleplay:** You are Ramesh. Cash is tight after sowing, so you choose "0% BNPL — pay in 2 parts".
- **Preconditions:** Cart with items; BNPL enabled.
- **Test data:** Order total ₹2,000.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Checkout → payment method **BNPL** | Schedule shown before confirm: 2 equal installments (₹1,000 each) at **30 / 60 days** |
| 2 | Confirm | Order placed with BNPL schedule |
| 3 | Order detail → BNPL schedule | Persisted installments with dates; first marked pending |
| 4 | (Dev-assisted) simulate a failed installment → Retry payment | Retry endpoint works; UPI-only |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-141: Track order through seller statuses 🔄
- **Module:** Orders / Tracking      **Priority:** P1
- **Roleplay:** You are Ramesh watching your seed order move from the seller to your village.
- **Preconditions:** A paid order (🔄 second tester — seller actions, see 07_cross_persona_e2e.md).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Orders → the order | Status timeline: placed → paid |
| 2 | Ask Tester B (seller) to confirm the order | Status **confirmed**; you get the order_confirmed notification |
| 3 | Ask the seller to ship → out for delivery | Notifications **shipped** and **out_for_delivery** arrive in the bell |
| 4 | Ask the seller/agent to deliver | Status **delivered**; delivered notification; buyer task per status visible in tasks |
| 5 | Open the order tracking view | Map/status detail renders |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-142: Cancel, refund, payment retry, reorder and invoice
- **Module:** Orders / Post-purchase      **Priority:** P1
- **Roleplay:** You are Ramesh. You cancel one order, retry a failed payment on another, and reorder seeds.
- **Preconditions:** One order in placed/paid; one delivered order; one failed-payment order (dev-assisted).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Cancel a placed/paid order → confirm | Status **cancelled**; stock restored; refundStatus → requested → processed (Razorpay test) |
| 2 | Try to cancel a **shipped** order | Blocked: ORDER_NOT_CANCELLABLE |
| 3 | On the failed-payment order → Retry payment (UPI) | Payment succeeds; status **paid** |
| 4 | Open the delivered order → Reorder | Cart refilled; checkout opens |
| 5 | Reorder a non-delivered order | Blocked (delivered/closed only) |
| 6 | Download invoice.pdf | Tax invoice PDF opens with order details |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 20 — Gyan Hub: Workshops, Talks, Videos, Blogs, Courses (TC-FRM-143 … 147)

*Paid workshop enrollment with coin redemption, expert talks (+25 coins, ask-the-expert), videos and
blog bookmarks, and the course academy.*

### TC-FRM-143: Enroll in a workshop using coins
- **Module:** Gyan Hub / Workshops      **Priority:** P1
- **Roleplay:** You are Ramesh. A ₹200 grape-pruning workshop accepts coins; you pay with coins + UPI.
- **Preconditions:** Workshop seeded with fee and coin discount allowed; coins balance sufficient.
- **Test data:** Workshop "Advanced Grape Pruning"; redeem coins ≤ min(allowance, fee, 50% of fee).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Dnyan Setu / Gyan Hub → Workshops | Workshop list with isEnrolled flags |
| 2 | Open the workshop → Enroll → choose useCoins, enter redeemable coins → confirm | Coin portion capped at min(coinsDiscountAllowed, fee, 50% of fee); remainder via Razorpay |
| 3 | Pay the Razorpay balance | Enrollment **enrolled**; **workshop_starting** task scheduled |
| 4 | Check My Enrollments | Workshop listed as enrolled |
| 5 | Open the bell / coins | Coin burn reflected in ledger |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-144: Workshop negatives — full house, duplicate, idempotent verify
- **Module:** Gyan Hub / Workshops      **Priority:** P1
- **Roleplay:** You are Ramesh testing enrollment limits.
- **Preconditions:** A full workshop (enrolledCount ≥ totalSeats — ask dev to seed) and your enrolled workshop from TC-FRM-143.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Enroll in the **full** workshop | Blocked: **WORKSHOP_FULL** |
| 2 | Enroll again in your already-enrolled workshop | Blocked: **ALREADY_ENROLLED** |
| 3 | (Dev-assisted) call the Razorpay verify webhook twice | Idempotent: single seat, no double enrollment |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-145: Expert talk registration (+25 coins) and ask-the-expert
- **Module:** Gyan Hub / Expert Talks      **Priority:** P1
- **Roleplay:** You are Ramesh. You register for a free expert talk on pest control and submit a question.
- **Preconditions:** Expert talk seeded.
- **Test data:** Question: "पत्तियों पर सफेद धब्बे का क्या उपचार है?".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Gyan Hub → Expert Talks → open a talk → Register | Registration succeeds |
| 2 | Register for the **same** talk again | Blocked: **ALREADY_REGISTERED** (409) |
| 3 | Check Kisan Coins | **+25 coins**; coins_earned task/notification |
| 4 | Submit your question via Ask the Expert | Question submitted; visible as pending |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-146: Videos and blogs — tasks, bookmark, like
- **Module:** Gyan Hub / Videos & Blogs      **Priority:** P2
- **Roleplay:** You are Ramesh watching grape videos during lunch and saving a blog.
- **Preconditions:** Videos/blogs seeded in your crop categories.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Gyan Hub → Videos (filter by category) | Videos play; new videos in your crop categories (last 7 days) created **new_video** tasks (deduped) |
| 2 | Open a blog | Blog renders |
| 3 | Tap bookmark on the blog | Bookmark toggled ON; listed under bookmarks |
| 4 | Tap like | Like counted once; second tap by you does not double-count |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-147: Courses — purchase, classroom, certificate, Q&A
- **Module:** Gyan Hub / Courses (Academy)      **Priority:** P2
- **Roleplay:** You are Ramesh buying a short course on drip irrigation for Suresh.
- **Preconditions:** Course seeded with lessons.
- **Test data:** Course "Drip Irrigation Mastery".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Academy → open the course | Syllabus, price, reviews visible |
| 2 | Purchase via Razorpay sandbox | Course unlocked; purchase recorded |
| 3 | Open a lesson in the classroom | Lesson content/video plays; progress marked |
| 4 | Post a question in course Q&A | Question listed |
| 5 | (Dev-assisted) complete all lessons → get certificate | Certificate generated with your name |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 21 — Kisan Coins & Gamification (TC-FRM-148 … 152)

*Coins status, levels, streaks and badges; the ledger; reward catalog redemption with its rules; and the leaderboard.*

### TC-FRM-148: Coins status — balance, level, streak, badges
- **Module:** Kisan Coins      **Priority:** P1
- **Roleplay:** You are Ramesh checking your earnings after all the diary entries and talks.
- **Preconditions:** Several coin events done (diary +15, talk +25, referral later).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Kisan Coins (home KPI or Krishi Ratna) | agriCoins balance shown; stats: earned total, diaryEntries, referrals, redeems |
| 2 | Check level tier | Tier ladder with progressPct + coinsToNextTier |
| 3 | Check daily streak | current/longest streak from coin_ledger dates |
| 4 | Check badges | Badges grid: first_entry (1 diary), diary_regular (30), sharer, referral_star (10), coin_collector (500), big_earner (2000), redeemer, consistent (7-day streak) — earned ones highlighted |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-149: Coin ledger
- **Module:** Kisan Coins / Ledger      **Priority:** P2
- **Roleplay:** You are Ramesh auditing every coin in and out.
- **Preconditions:** Coin activity exists.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Kisan Coins → Ledger | Paged list of earn/burn lines with reasons (+15 diary_entry, +25 expert_talk, −500 redeem, −100 order) |
| 2 | Page through the ledger | Pagination works |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-150: Redeem a reward from the catalog
- **Module:** Kisan Coins / Rewards      **Priority:** P1
- **Roleplay:** You are Ramesh redeeming a खाद वाउचर (fertiliser voucher) for 300 coins.
- **Preconditions:** Balance ≥ 300.
- **Test data:** Reward voucher, 300 coins.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Rewards → catalog | Catalog items with coinsCost: खाद वाउचर 300, मिट्टी जांच (soil test) 500, विशेषज्ञ कॉल 800, कार्यशाला छूट 1000; unavailable items flagged |
| 2 | Redeem खाद वाउचर (300) → confirm | Redeem succeeds; **voucher code AGRI-{TYPE}-{ddHHMM}** shown; balance −300 |
| 3 | Open the bell / FCM | "इनाम भुनाया गया" notification |
| 4 | Redeem again for more coins than balance (dev-assisted) | Blocked: **INSUFFICIENT_COINS** (400, Hindi message) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-151: Redemption rule negatives
- **Module:** Kisan Coins / Rewards      **Priority:** P1
- **Roleplay:** You are Ramesh probing the redemption limits.
- **Preconditions:** Logged in.
- **Test data:** rewardType "gold"; coins cost mismatch; X11 cap scenario.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | (Dev-assisted) redeem an unknown rewardType | Rejected: rewardType must be voucher/soil_test/expert_call/workshop |
| 2 | (Dev-assisted) redeem with a coins value not equal to the catalog cost | Rejected: exact cost required |
| 3 | (Dev-assisted) redeem against an order value exceeding the X11 redemption cap | Rejected: **REDEMPTION_CAP_EXCEEDED** (422) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-152: Leaderboard
- **Module:** Kisan Coins / Leaderboard      **Priority:** P2
- **Roleplay:** You are Ramesh checking your village ranking.
- **Preconditions:** Other testers earned coins.
- **Test data:** period = all, then month.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Kisan Coins → Leaderboard (period all) | Top 10 + **myRank** shown |
| 2 | Switch period to month | Monthly ranking loads |
| 3 | (Dev-assisted) period = "week" | Rejected: only all/month allowed |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 22 — Ratings & Trust (TC-FRM-153 … 155)

*Pending rating prompts, submitting ratings (transport/vet/equipment/deal/buyer), moderation and
duplicates, and the ratings/trust view with replies.*

### TC-FRM-153: Pending prompts and submitting a rating
- **Module:** Ratings      **Priority:** P1
- **Roleplay:** You are Ramesh. After the delivered gadi trip, the app asks you to rate the transporter.
- **Preconditions:** A completed transport delivery / equipment booking / completed deal (from earlier modules).
- **Test data:** 5 stars, tag "load_ready_on_time" (transport), comment "Samay par aaya".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Ratings → Pending | Open prompts listed (kinds: lot_sale, transport_delivery, equipment_booking, deal, marketplace_order, etc.) |
| 2 | Open the transport prompt → rate 5 stars + tag + comment → Submit | Rating saved; prompt closed; transporter's ratingStats updated |
| 3 | Rate a completed **deal** (targetRole broker) and a delivered **marketplace order** (seller/product) | Both ratings saved |
| 4 | Check ratee trust | Ratee's trust tier refreshed (visible on their card) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-154: Rating negatives — duplicate and moderated text
- **Module:** Ratings      **Priority:** P1
- **Roleplay:** You are Ramesh testing the rating limits.
- **Preconditions:** TC-FRM-153 done.
- **Test data:** Abusive comment "bekaar idiot fraud" (test moderation).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Rate the same booking again | Blocked: **ALREADY_RATED** (409, Hindi message) |
| 2 | Submit a moderated/blocked comment word (dev list) | Rejected: **RATING_TEXT_BLOCKED** (422) |
| 3 | (Dev-assisted) rate before delivery (transport) | Blocked: transport ratings require delivered status |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-155: My ratings, received ratings and reply
- **Module:** Ratings / Trust      **Priority:** P2
- **Roleplay:** You are Ramesh checking what others said about you, and replying once.
- **Preconditions:** You received ≥1 rating (transporter rated you — 🔄 see 07_cross_persona_e2e.md).
- **Test data:** Reply "Dhanyavaad!" (≤500 chars).

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Ratings → Mine | Aggregate rating, recent received ratings, your **trustTier** |
| 2 | Ratings → Given | List of ratings you gave |
| 3 | Reply to a received rating with the test text | Reply saved; second reply blocked (once only); only the rated party can reply |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 23 — Equipment Rental (TC-FRM-156 … 158)

*Browsing machines with slot calendars, booking a slot, cancelling per policy, and rating equipment.*

### TC-FRM-156: Browse equipment and slot calendar
- **Module:** Equipment Rental      **Priority:** P1
- **Roleplay:** You are Ramesh. You need a rotavator for a day and check machine availability.
- **Preconditions:** Equipment seeded.
- **Test data:** Rotavator; date 2026-10-27.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Rent Yantra (home launchpad) → equipment list | Machines listed with owner, price, location |
| 2 | Open a machine → slot calendar for 2026-10-27 | Booked/free slots shown per date |
| 3 | Pick another date | Calendar updates |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-157: Book a slot, view my bookings, cancel
- **Module:** Equipment Rental / Bookings      **Priority:** P1
- **Roleplay:** You are Ramesh booking the rotavator for tomorrow; rain cancels the plan.
- **Preconditions:** TC-FRM-156 done.
- **Test data:** Free slot 2026-10-27 09:00–13:00.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap a free slot → Confirm booking | Booking born **booked** (FPO machines auto-confirm); listed in My Bookings |
| 2 | Try booking an already-booked slot | Blocked: slot unavailable |
| 3 | Cancel the booking per policy | Cancelled; slot freed; policy terms (refund/free cancel window) shown |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-158: Rate the equipment
- **Module:** Equipment Rental / Ratings      **Priority:** P2
- **Roleplay:** You are Ramesh rating the rotavator after use.
- **Preconditions:** A booked/completed equipment booking.
- **Test data:** 4 stars, comment "Machine achhi thi".

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open the booking → Rate Equipment | Rating form (kind equipment) |
| 2 | Submit 4 stars + comment | Rating saved; aggregate updated |
| 3 | Rate the same booking again | Blocked: ALREADY_RATED |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 24 — Refer & Earn (TC-FRM-159 … 160)

*Invite code sharing, direct invites over WhatsApp/SMS, and the 50-coins reward when the invitee verifies 7/12.*

### TC-FRM-159: Invite code and direct invite
- **Module:** Referrals      **Priority:** P1
- **Roleplay:** You are Ramesh inviting your cousin from Dhule to join Agrovercity.
- **Preconditions:** Logged in.
- **Test data:** Cousin's phone +91 98220 00009; channel WhatsApp.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Home → Refer & Earn | Your invite code shown ("My Invite Code") |
| 2 | Tap Copy → paste somewhere | Code copied correctly |
| 3 | Tap Share link → choose WhatsApp | Share sheet opens with your referral link |
| 4 | Send Direct Invite → enter phone +91 98220 00009, channel WhatsApp/SMS → Send | Invite sent; listed in invite stats |
| 5 | Check stats | joinedCount = 0 so far |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-160: Referral coins on 7/12 verification 🔄
- **Module:** Referrals      **Priority:** P1
- **Roleplay:** You are Ramesh. Your cousin registers and verifies his 7/12 — both of you earn 50 coins.
- **Preconditions:** TC-FRM-159 invite sent; cousin (Tester B, second device) completes registration + KYC + 7/12 import (🔄 see 07_cross_persona_e2e.md).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Wait for the invitee to verify their 7/12 record | — |
| 2 | Open Kisan Coins → ledger | **+50 coins** referral credit (both sides — ask Tester B to confirm theirs) |
| 3 | Check badges | **sharer** badge earned (1 referral) |
| 4 | Refer & Earn stats | joinedCount = 1 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 25 — Notifications & Preferences (TC-FRM-161 … 163)

*The notification list with filters, batch read/read-all, per-category/channel preferences with quiet
hours, and deep-linked task cards.*

### TC-FRM-161: Notification list, filters and read states
- **Module:** Notifications      **Priority:** P1
- **Roleplay:** You are Ramesh reading the day's notifications.
- **Preconditions:** Several notifications from earlier cases.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap the bell → open notifications | List loads newest first; unread highlighted; unread count on the bell |
| 2 | Filter by a type (e.g., offers / orders / tasks) | Only that type listed; unread filter works |
| 3 | Tap one notification | It opens and is marked read; deep-links to the related screen (purchase/order/lot) |
| 4 | Select several → Mark read | All selected marked read |
| 5 | Tap Read all | Unread count becomes 0 |
| 6 | (Dev-assisted) batch-read with a foreign/invalid id | Foreign ids ignored silently (no existence leak); single-read of a foreign id → 404 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-162: Notification preferences — categories, channels, quiet hours
- **Module:** Notifications / Preferences      **Priority:** P2
- **Roleplay:** You are Ramesh. You silence marketing notifications at night but keep rain alerts.
- **Preconditions:** Logged in.
- **Test data:** Quiet hours 22:00–06:00.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Notifications → Preferences | Per-category toggles + per-channel toggles (push/in-app/SMS) + digest mode |
| 2 | Turn OFF one category → save | Toggle persisted |
| 3 | Set quiet hours 22:00–06:00 with quietHoursOverride off | Saved |
| 4 | Repeat the same PUT (dev-assisted) | Idempotent: no duplicates, same state |
| 5 | Trigger a notification in the disabled category | Not delivered; other categories still arrive |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-163: Task-engine cards deep-link correctly
- **Module:** Notifications / Tasks      **Priority:** P1
- **Roleplay:** You are Ramesh. Every task card must open the right screen.
- **Preconditions:** Tasks pending: irrigation, new_offers, scheme_deadline, vaccination_due, survival_check, trip_pickup_reminder, workshop_starting (from earlier cases).
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Tap the irrigation task | Opens Water / irrigation schedule |
| 2 | Tap the new_offers task | Opens the lot's offer board |
| 3 | Tap scheme_deadline | Opens the scheme detail |
| 4 | Tap vaccination_due | Opens livestock vaccinations; "mark-vaccinated" resolves it |
| 5 | Tap survival_check | Opens the plantation detail / add log |
| 6 | Tap trip_pickup_reminder / workshop_starting | Opens the booking / workshop |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### Module 26 — Misc Modules, Settings & हिन्दी Core Flow (TC-FRM-164 … 169)

*Women farmer hub, agri news & live channels, FPO engine / post-harvest / climate-carbon, help &
support, account settings, and a final full core-flow run in हिन्दी.*

### TC-FRM-164: Women farmer hub
- **Module:** Women Farmer Hub      **Priority:** P2
- **Roleplay:** You are Ramesh checking the SHG corner for your wife Sunita's papad group.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open Women Farmer Hub | Hub opens with SHG, kitchen garden, livestock cards |
| 2 | Browse the SHG card | SHG info/products visible (Sunita's MGU data belongs to her account — you must NOT see private data of other personas) |
| 3 | Stay in character | Any other persona's private action buttons visible = defect |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-165: Agri news and live channels
- **Module:** Agri News / Live Channels      **Priority:** P2
- **Roleplay:** You are Ramesh watching the evening agri news.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Home → Agri News | News list loads; article opens and reads well |
| 2 | Home → Live Channels | Channel list opens; a channel stream/page opens |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-166: FPO engine, post-harvest and climate-carbon views
- **Module:** Misc farmer modules      **Priority:** P2
- **Roleplay:** You are Ramesh exploring the remaining modules.
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Open FPO engine view | FPO info/listing renders |
| 2 | Open post-harvest view | Post-harvest guidance/services listed |
| 3 | Open climate/carbon view | Climate/carbon info renders |
| 4 | Browse gruh udyog products in the mall | SHG products listed (respect blocked sellers) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-167: Help & support and account settings
- **Module:** Settings / Support      **Priority:** P2
- **Roleplay:** You are Ramesh. You test help and look at the account settings (but do NOT delete your account — needed for other cases).
- **Preconditions:** Logged in.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Profile → Help & Support | FAQ/help opens; a support contact or ticket option exists |
| 2 | Open Settings | Language, consent section, notification shortcut, account delete option present |
| 3 | Open account deletion (read only — cancel) | Flow asks confirmation/warning; cancel keeps the account |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-168: Wishlist and coupons
- **Module:** Krishi Mall / Wishlist & Coupons      **Priority:** P2
- **Roleplay:** You are Ramesh saving a sprayer for later and browsing coupons.
- **Preconditions:** Logged in; products seeded.
- **Test data:** —

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | Product → Add to Wishlist (heart) | Wishlist badge updates; product listed in My Wishlist |
| 2 | Remove from wishlist | Removed |
| 3 | Open Coupons | Available coupons listed with validity; a valid coupon applies at checkout (already used in TC-FRM-138) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### TC-FRM-169: हिन्दी core flow — sell produce end-to-end
- **Module:** Language / Core flow      **Priority:** P1
- **Roleplay:** You are Ramesh, who prefers Hindi. You run the single most important flow — post a lot and view offers — entirely in हिन्दी.
- **Preconditions:** App language switched to हिन्दी (like TC-FRM-05).
- **Test data:** Lot: Onion 5 q, ₹1,500/q.

| # | Step (what YOU do) | Expected result |
|---|--------------------|-----------------|
| 1 | With the app in हिन्दी, open Sell Produce | All labels in Hindi: crop, quantity (मात्रा), rate (भाव), buttons; no overflow |
| 2 | Post the lot (5 q Onion, ₹1,500/q) | Success message in Hindi; lot card in Hindi UI |
| 3 | Open the offer board / My Lots | Status labels in Hindi; withdraw/edit buttons in Hindi |
| 4 | Check notifications | Offer/lot notifications render correctly in Hindi |
| 5 | Switch back to English | App returns to English |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

## 4. Module coverage matrix

Every module of the Farmer inventory is covered. Gaps from the inventory's closing notes each have an explicit ⚠️ case (TC-FRM-49, 100, 113, 115).

| # | Module | Cases (IDs) | Count |
|---|--------|-------------|------:|
| 1 | Account, Onboarding, KYC, Bank, Profile, Land & Vault | TC-FRM-01 – 14 | 14 |
| 2 | Home & Dashboard | TC-FRM-15 – 19 | 5 |
| 3 | My Crops & Advisory | TC-FRM-20 – 29 | 10 |
| 4 | Mandi Prices & Alerts | TC-FRM-30 – 37 | 8 |
| 5 | Sell Produce — Lots & Offers | TC-FRM-38 – 49 | 12 |
| 6 | Buyer Demands & Standing Orders | TC-FRM-50 – 52 | 3 |
| 7 | Purchases & Escrow (Seller Side) | TC-FRM-53 – 58 | 6 |
| 8 | Transport — Book Gadi | TC-FRM-59 – 68 | 10 |
| 9 | Transport — Load Board, Templates & Rebook | TC-FRM-69 – 73 | 5 |
| 10 | Farm Diary & P&L | TC-FRM-74 – 82 | 9 |
| 11 | Government Schemes | TC-FRM-83 – 88 | 6 |
| 12 | Water & Climate | TC-FRM-89 – 93 | 5 |
| 13 | Soil Tests | TC-FRM-94 – 96 | 3 |
| 14 | Livestock & Dairy | TC-FRM-97 – 107 | 11 |
| 15 | Tree Plantation & Carbon | TC-FRM-108 – 113 | 6 |
| 16 | Crop Insurance | TC-FRM-114 – 120 | 7 |
| 17 | Loans, KCC & Finance | TC-FRM-121 – 128 | 8 |
| 18 | Broker Deals | TC-FRM-129 – 134 | 6 |
| 19 | Krishi Mall & Orders | TC-FRM-135 – 142 | 8 |
| 20 | Gyan Hub (Workshops, Talks, Videos, Blogs, Courses) | TC-FRM-143 – 147 | 5 |
| 21 | Kisan Coins & Gamification | TC-FRM-148 – 152 | 5 |
| 22 | Ratings & Trust | TC-FRM-153 – 155 | 3 |
| 23 | Equipment Rental | TC-FRM-156 – 158 | 3 |
| 24 | Refer & Earn | TC-FRM-159 – 160 | 2 |
| 25 | Notifications & Preferences | TC-FRM-161 – 163 | 3 |
| 26 | Misc Modules, Settings & हिन्दी Core Flow | TC-FRM-164 – 169 | 6 |
| | **Total** | **TC-FRM-01 – 169** | **169** |

## 5. Sign-off

- Tester name: ______________________  Role played: Ramesh Patil (Farmer)
- Date(s) executed: __________________  Build/backend commit: __________________
- Second tester(s) for 🔄 cases (Vyapari / Transporter / Banker / Admin): ______________________

| Metric | Planned | Actual |
|--------|--------:|-------:|
| Total cases | 169 | |
| P0 | 21 | |
| P1 | 104 | |
| P2 | 44 | |
| Pass | — | |
| Fail | — | |
| Open defects (Blocker/Major/Minor) | — | |

**P0 cases (must all pass):** TC-FRM-01, 02, 06, 08, 09, 21, 38, 39, 47, 51, 54, 60, 70, 74, 85, 115, 117, 124, 127, 131, 138

> Release gate (per README §7): all P0 pass, ≥95% P1 pass, zero open Blocker defects.
> Fill the suite-level sign-off matrix in `manual_test/README.md` §7 when done.
