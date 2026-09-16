# AGROVERCITY / Kisan Setu — Missing Features (User-Flow Gap Audit)

> Method: every persona's end-to-end journey was walked stage-by-stage
> (install → onboard → daily use → core business loop → money → edge cases) and
> checked against `features.md`, `endpoints.md`, and `docs/overview/03-gap-analysis…md`.
>
> **Status legend**
> - ❌ **Not specced anywhere** — missing from prototype AND from the docs set
> - 📋 **Specced in docs** — absent from prototype, already covered in `docs/overview/03` or day plans (listed here for completeness)
> - 🟡 **Mock only** — exists in prototype UI but has no real flow/backend behind it
>
> **Priority:** P0 = launch blocker (Play Store or core loop broken without it), P1 = needed within v1.x, P2 = roadmap.

---

## 1. Farmer journey (किसान)

Flow: install → splash → language → profile select → OTP register → MPIN → farm details → map → home → daily loop (weather, bhav, tasks) → season loop (plan → sow → grow → protect → harvest → sell → insure → accounts).

| # | Stage | Missing feature | Status | Priority | What's needed |
|---|---|---|---|---|---|
| F1 | Onboarding | **Referral-code entry during registration** — referEarn lets you invite, but a new user has nowhere to enter the inviter's code, so +100-coin attribution can't work | ❌ | P0 | Field in register wizard step 1; `POST /auth/register` accepts `referralCode`; attribution in referrals endpoint |
| F2 | Onboarding | **OTP-less re-login / session restore** — prototype hardcodes MPIN 1234; no "session expired → re-verify" UX | 🟡 | P0 | Token-expiry interceptor → MPIN re-entry screen (specced implicitly Day 2–3; screen not listed) |
| F3 | Home | **Global search results screen** — home has search bar + mic, but no results page or search endpoint | ❌ | P1 | `search_view.dart`; `GET /v1/search?q=` across schemes/products/news/crops |
| F4 | Home | **Weather detail screen** — only a strip exists; no 7-day forecast, no spray-window advice page, no severe-weather push alerts | ❌ | P1 | `weather_detail_view.dart`; `GET /v1/weather/forecast?days=7`; FCM alert topic per district |
| F5 | Home | **Task engine behind "Today's Action"** — one hardcoded card; no task list, no per-crop-stage schedule, no history | 🟡 | P1 | `farm_tasks` collection + `GET /v1/tasks/today`, task list screen; tasks generated from crop_cycles (Day 9) + weather |
| F6 | Plan/Sow | **Sowing-intent capture flow** — saturation advisory needs farmers to record intent; Advisory tab simulates it but no persistent intent API | 🟡 | P0 | `POST /v1/advisory/sowing-intent` writing to crop_cycles (opt-in consent flag) |
| F7 | Plan/Sow | **"Sell my produce" listing** — farmer can accept buyer contracts but cannot post his own harvested lot for sale; broker deal pipeline and seller procurement both assume such lots exist | ❌ | P0 | `produce_lots` collection; `POST /v1/market/lots` CRUD + photo; list screen; feeds broker deals & seller procurement |
| F8 | Grow | **Crop-stage calendar / advisory timeline** — NPK calc and disease scan are one-shot; no per-crop schedule (sowing→spray→harvest dates with reminders) | ❌ | P1 | Generated from crop_cycles; feeds F5 task engine + notifications |
| F9 | Grow | **Soil-test booking flow** — rewards store redeems "free soil test", schemes list Soil Health Card, but no booking/collection/lab-result flow | ❌ | P1 | `soil_tests` collection, `POST /v1/soil-tests/book`, result PDF upload by admin/lab |
| F10 | Grow | **Upload-then-track for disease scan** — scan is simulated; no history of past scans per plot | 🟡 | P2 | `disease_scans` history endpoint + list screen |
| F11 | Harvest | **Cold-storage booking** — post-harvest lists warehouses with capacity, but no reserve/book action | ❌ | P1 | `POST /v1/post-harvest/cold-storage/{id}/book` + slot/capacity decrement; appears in My Bookings |
| F12 | Harvest | **Produce pickup request tied to transport** — booking a vehicle is generic; no linkage from a produce lot → pickup → mandi/buyer delivery | ❌ | P1 | `lotId` on transport booking; transporter sees lot details |
| F13 | Sell | **Mandi price history / charts** — only today's rates; saturation claims 3-yr trends but no endpoint | ❌ | P1 | `GET /v1/mandi/prices/history?crop=&mandi=&from=` (Agmarknet historical); simple line chart screen |
| F14 | Sell | **MSP reference data** — contracts show "premium above MSP" but MSP itself is static demo text | 🟡 | P2 | `GET /v1/reference/msp?crop=` (seasonal govt data) |
| F15 | Insure | **Claim photo guidelines & resubmission** — claim form exists; no guidance overlay, no "rejected → appeal/resubmit" path | ❌ | P1 | Resubmit action on rejected claim; `POST /v1/insurance/claims/{id}/appeal` |
| F16 | Money | **Bank account / payout management** — insurance DBT, loan disbursal, and any earnings need a verified bank account; only a display-only `bankName`/`kccLimit` exist | ❌ | P0 | `bank_accounts` collection; add/verify (penny-drop) + set-primary; used by claims, loans, settlements |
| F17 | Money | **Loan application tracking** — `POST /finance/loans/apply` exists but no status list ("under review → approved → disbursed") | ❌ | P1 | `GET /v1/finance/loans` + status field + screen section |
| F18 | Money | **Expense/income attachments** — diary entries have no receipt photo | ❌ | P2 | `photoUrl` on diary entries (Storage upload) |
| F19 | Community | **FPO join/discover flow** — fpo view assumes membership ("Sahyadri FPO, 420 members"); no browse-FPOs-near-me / request-to-join | ❌ | P1 | `GET /v1/fpo/nearby`, `POST /v1/fpo/{id}/join-request`; non-member state for the FPO screen |
| F20 | Community | **Ask-follow-up after expert handoff** — handoff sends data to expert; no in-app thread to see expert's reply | ❌ | P1 | Handoff creates a `support_threads` doc; chat screen bound to it |
| F21 | Account | **Profile edit screen** — PUT /users/me exists; gap-analysis added settings but no edit-profile form (name, village, crops, soil, land area) | ❌ | P0 | `profile_edit_view.dart` wired to PUT /users/me |
| F22 | Account | **Multi-device session management** — "logout other devices", session list | ❌ | P2 | `GET/DELETE /v1/auth/sessions` (refresh-token inventory) |
| F23 | Account | **Data export (DSR)** — Play Store data-safety + trust: user can download his data | ❌ | P2 | `GET /v1/users/me/export` (async → Storage zip) |

## 2. Landlord journey (खेत मालिक)

Flow: onboard (as landlord) → add plots → list land for lease / respond to requests → sign lease → track rent → renew/terminate.

| # | Stage | Missing feature | Status | Priority | What's needed |
|---|---|---|---|---|---|
| L1 | Onboarding | **Role-specific registration** — register wizard asks farm details (crops, irrigation) which are farmer concepts; landlord needs ownership docs (7/12) capture instead | ❌ | P0 | Per-persona register step-3 variants (see X1) |
| L2 | Setup | **Land listing marketplace** — landlord can manage leases (📋 docs) but cannot *advertise* a plot for lease; farmers have no "land for rent near me" browse | ❌ | P1 | `land_listings` collection; `POST /v1/land/listings` + `GET /v1/land/listings?near=`; farmer-side browse screen |
| L3 | Matching | **Tenant request inbox** — landlord home mentions tenants but there's no request/accept/reject flow from farmer side | ❌ | P1 | `lease_requests` collection; farmer "request lease" on listing; landlord accept → creates lease |
| L4 | Lease | **Lease agreement PDF + e-sign** — leases are data rows; no generated agreement document, no dual e-sign | ❌ | P1 | `GET /v1/land/leases/{id}/agreement-pdf` (server-generated) + sign endpoint (reuse contract e-sign) |
| L5 | Money | **Rent reminder & overdue push** — payments recordable (📋) but no automated reminder on due date | ❌ | P1 | Scheduled job + FCM; overdue badge in rent_tracking_view |
| L6 | Money | **Landlord payout account** — same bank-account gap as F16 | ❌ | P0 | shared (F16) |

## 3. Transporter journey (परिवहन)

Flow: onboard → add vehicle + docs → set availability calendar → receive booking requests → accept → trip (pickup → POD) → daily earnings → vehicle maintenance.

| # | Stage | Missing feature | Status | Priority | What's needed |
|---|---|---|---|---|---|
| T1 | Onboarding | **Transporter KYC** — driving licence, RC, GST (optional) verification; vehicle docs upload is 📋 but verification status flow is not | ❌ | P0 | Doc status field (pending/verified/rejected) + admin verify action (admin console) |
| T2 | Booking | **Accept / reject incoming booking** — PATCH status exists (📋) but the request-inbox screen with accept/reject + reason is missing | ❌ | P0 | `booking_requests_view.dart` for transporter; reject with reason → farmer notified |
| T3 | Trip | **Proof of delivery (POD)** — delivered status with no photo/receiver-signature capture | ❌ | P1 | `podPhotos[]` + receiver name on booking; upload at trip end |
| T4 | Trip | **Live trip tracking** — farmer can't see vehicle location en route | ❌ | P2 | FCM/supabase-lite: driver app shares location pings → `GET /v1/transport/bookings/{id}/location` |
| T5 | Money | **Earnings & settlement page** — dashboard shows ₹28.5k/day but no payout cycle, commission deduction, or settlement history | ❌ | P0 | `transporter_settlements` collection; `GET /v1/transport/settlements`; weekly payout job |
| T6 | Money | **Trip expense log (fuel/toll)** — freight income without costs = no real profit view | ❌ | P2 | `trip_expenses` CRUD; shown in transporter P&L |
| T7 | Fleet | **Document expiry reminders** — RC/insurance/fitness expiry alerts | ❌ | P1 | Expiry fields on vehicle; scheduled FCM |
| T8 | Fleet | **Load board (return loads)** — PBR explicitly flags empty-return-trip marketplace as monetization; nothing specced | ❌ | P2 | `loads` collection: sellers/farmers post loads, transporters bid |
| T9 | Fleet | **Driver management** — owner with 4 vehicles needs to assign drivers to trips | ❌ | P2 | `drivers` sub-collection; `driverId` on booking |

## 4. Seller / Vyapari journey (व्यापारी)

Flow: onboard → shop KYC → post today's rates → procure from farmers → manage stock → sell to buyers → ledger & settlements.

| # | Stage | Missing feature | Status | Priority | What's needed |
|---|---|---|---|---|---|
| S1 | Onboarding | **Shop KYC** — APMC licence / GST number capture + verification; without it rate-posting is untrusted | ❌ | P0 | KYC fields in seller registration; admin verify (console) |
| S2 | Rates | **Rate-posting guardrails** — 📋 rate-post endpoint exists, but no min/max sanity band vs Agmarknet, no edit-window rule | ❌ | P1 | Server validation: reject rates outside ±X% of mandi modal; editable ≤2h |
| S3 | Procure | **Procurement entry with weighbridge slip** — seller home shows procurement ledger but 📋 inventory API has no lot-level purchase-from-farmer flow (farmer, weight, rate, photo of slip) | ❌ | P1 | `POST /v1/seller/procurements` (farmer phone, lot, weight, rate, slip photo) → credits farmer ledger |
| S4 | Procure | **Pay-farmer tracking** — procurement implies payment; no payment-status per procurement (paid/udhaar) | ❌ | P1 | `paymentStatus` + mark-paid; farmer sees "payment pending" card (trust feature) |
| S5 | Sell | **Buyer network / B2B orders** — seller sees "14 buyers" metric but no buyer directory management or incoming B2B order flow | ❌ | P2 | `buyers` directory CRUD; incoming orders from bulk buyers |
| S6 | Sell | **GST invoice generation** — any real vyapari needs invoices | ❌ | P2 | `GET /v1/seller/sales/{id}/invoice-pdf` |
| S7 | Money | **Udhaar (credit) ledger per buyer** — sales-entry 📋 records sales, not running credit balances | ❌ | P1 | `buyer_ledgers` collection with balance |
| S8 | Money | **Seller settlement/payout account** — F16 shared | ❌ | P0 | shared |

## 5. Equipment Owner journey (यंत्र किराया)

Flow: onboard → add machine + photos + docs → configure slot templates/pricing → receive booking requests → approve (private) → track usage → maintenance → payouts.

| # | Stage | Missing feature | Status | Priority | What's needed |
|---|---|---|---|---|---|
| E1 | Onboarding | **Machine KYC** — RC/insurance/fitness for commercial equipment; operator licence for combine/drone | ❌ | P0 | Doc fields + admin verify (same as T1) |
| E2 | Booking | **Approve/reject for private machines** — engine creates `pending` bookings (📋 engine done) but owner has no approve/reject screen or endpoint | ❌ | P0 | `POST /v1/equipment/bookings/{id}/approve|reject`; owner request-inbox screen; farmer notified |
| E3 | Ops | **Maintenance log + service-due reminders** — equipment home lists "profit & maintenance" action but nothing exists | ❌ | P1 | `equipment_maintenance` CRUD; next-service date → FCM |
| E4 | Ops | **Machine live location during rental** — trust + misuse prevention | ❌ | P2 | GPS tracker integration placeholder / manual check-in |
| E5 | Ops | **Damage report flow** — owner reports damage after return, with photos, charge to farmer | ❌ | P2 | `damage_reports` on booking |
| E6 | Money | **Owner settlement page** — weekly payout after platform commission (same as T5) | ❌ | P0 | shared settlement pattern |
| E7 | Money | **Machinery loan/EMI tracker** — dashboard quick-action "machinery loan/EMI" exists with no flow | 🟡 | P2 | Loan application (reuse /finance/loans/apply with purpose=machinery) + EMI schedule view |

## 6. Broker / Dalal journey (दलाल)

Flow: onboard → build farmer & buyer network → create deal (match lot ↔ requirement) → mediate → track → commission payout.

| # | Stage | Missing feature | Status | Priority | What's needed |
|---|---|---|---|---|---|
| B1 | Onboarding | **Broker KYC/verification badge** — trust-critical intermediary, no verification | ❌ | P0 | KYC fields + admin verify |
| B2 | Matching | **Deal room / deal chat** — deals 📋 are records; the actual coordination between farmer-broker-buyer needs a per-deal message thread | ❌ | P1 | `deal_messages` sub-collection; per-deal chat screen |
| B3 | Matching | **Buyer requirement postings** — broker matches supply with demand, but only contracts (farmer-side) exist; buyers can't post "need 50q onion @ ₹X" | ❌ | P1 | `buyer_requirements` collection + post/browse |
| B4 | Deal | **Deal documents** — weight slip, quality report, payment proof attached to a deal | ❌ | P1 | `documents[]` on deal (Storage) |
| B5 | Deal | **Counter-offer / negotiation** — deals are binary; no price negotiation loop | ❌ | P2 | `offers[]` on deal with accept/reject |
| B6 | Money | **Commission payout** — commission ledger 📋 records amounts; payout via verified bank (F16) and platform settlement job missing | ❌ | P0 | shared settlement pattern (T5/E6) |
| B7 | Money | **Broker commission on payments** — PBR Phase 3 monetization (commission payments) | ❌ | P2 | Razorpay route/split payments |

## 7. Cross-cutting / platform gaps

| # | Area | Missing feature | Status | Priority | What's needed |
|---|---|---|---|---|---|
| X1 | Onboarding | **Per-persona registration step-3** — wizard farm-details step fits only farmer; transporter (vehicle), seller (shop), landlord (land), broker (network) each need their own variant; also "add role later" needs the same per-role details form | ❌ | P0 | Role-keyed step-3 configs; `role_profiles` sub-collection per linked profile |
| X2 | Comms | **In-app 1:1 chat between personas** — farmer↔broker↔transporter↔seller coordination currently implied but no chat exists (only chatbot + live-channel chat) | ❌ | P1 | `chats` + `messages` collections; chat list + thread screens; Firestore listeners |
| X3 | Comms | **Notification deep-link map** — FCM wired Day 13, but no canonical `type→route` table (booking_reminder→my_bookings, claim_update→tracker, rate_approved→mandi…) | 🟡 | P0 | Deep-link router table in app; payload spec per notification type |
| X4 | Comms | **SMS fallbacks** — CRD mandates SMS to owner on cancel, 30-min reminders; SMS provider specced only as "integration" | 🟡 | P1 | MSG91/Twilio sender service + templates (DLT registration note for India) |
| X5 | Commerce | **Order cancellation / returns / refunds** — marketplace orders are one-way; Razorpay refunds not specced | ❌ | P0 | `POST /v1/orders/{id}/cancel` (pre-dispatch) + `POST /v1/payments/razorpay/refund`; refund status on order |
| X6 | Commerce | **Delivery address book** — orders take a raw `deliveryAddress` string; no saved addresses | ❌ | P1 | `addresses` CRUD + picker in checkout |
| X7 | Commerce | **Product reviews submission** — ratings displayed but users can't rate | ❌ | P2 | `POST /v1/products/{id}/reviews`; aggregate recompute |
| X8 | Trust | **Service ratings** — rate transporter/vet/equipment after completion | ❌ | P1 | `POST /v1/ratings` (bookingId, stars, comment); shown on provider cards |
| X9 | Trust | **Report/block users** — required once chat (X2) exists; Play Store UGC policy requires it | ❌ | P0 (with X2) | `POST /v1/users/{id}/report`, block list, admin moderation queue |
| X10 | Money | **Platform settlement engine** — T5/E6/B6 all assume it: commission % config, weekly payout runs, settlement status | ❌ | P0 | `settlements` collection + nightly job + admin payout console |
| X11 | Money | **AgriCoins→money rules audit** — coins give discounts; needs abuse guards (earn caps/day, redemption limits, ledger reconciliation job) | ❌ | P1 | Caps in coins service + nightly reconcile |
| X12 | App ops | **Force-update / remote config** — no version gate for breaking API changes | ❌ | P0 | `GET /v1/app-config?version=` → {minSupported, forceUpdate, featureFlags}; splash gate |
| X13 | App ops | **Analytics events taxonomy** — PBR success metrics (profile switches/week, time-to-first-action, funnel) need an event schema | ❌ | P1 | Firebase Analytics event list per screen/action; BigQuery export note |
| X14 | App ops | **Crash/error reporting** | ❌ | P0 | Crashlytics + backend Sentry (setup steps in Day 1/15) |
| X15 | Content | **Localization pipeline for content** — news/blogs/schemes authored in one language; 15+ language plan needs per-content translations or TTS fallback | ❌ | P1 | `translations` map on content docs; admin translation field |
| X16 | Content | **Live channel streaming infra** — video_player + streamUrl placeholder; no ingest (RTMP→HLS) or channel scheduling backend | 🟡 | P2 | Mux/IVS or YouTube Live embed decision; schedule CRUD in admin |
| X17 | Legal | **Consent & privacy center** — saturation opt-in is mentioned; needs a user-visible toggles screen (data sharing, location, marketing) | ❌ | P0 | Consent flags on user doc + settings toggles; logged `consent_log` |
| X18 | Legal | **Static legal pages** — privacy policy, terms, refund policy, community guidelines (Play Store requires hosted URLs) | ❌ | P0 | 4 pages on web app (`/legal/*`) + links in settings & Play listing |
| X19 | Offline | **Sync conflict policy** — POST /sync specced; resolution rule (last-write-wins vs server-wins per collection) not defined | 🟡 | P0 | Conflict matrix table added to sync spec (Day 14) |
| X20 | Offline | **Offline form drafts** — diary/claim drafts survive offline before submit | ❌ | P2 | Local draft store + "draft" badge |
| X21 | Voice | **Real STT/TTS** — voice sheet and audio buttons are simulated everywhere; Sarvam STT and Bhashini TTS need concrete request/response spec (audio format, max length, streaming?) | 🟡 | P1 | `POST /v1/speech/stt` (multipart audio→text), `POST /v1/speech/tts` (text→audio URL) |
| X22 | Voice | **Audio preview files for language select** — 15+ greeting audio assets don't exist | ❌ | P2 | Generate via Bhashini TTS once; bundle in assets |

## 8. Admin console gaps (Day 14 covers login/users/rates/CMS/claims — these are still missing)

| # | Missing admin feature | Priority | What's needed |
|---|---|---|---|
| A1 | **KYC verification queue** (transporter/seller/broker/equipment docs — T1/S1/B1/E1) | P0 | `/v1/admin/kyc/pending` + approve/reject with reason |
| A2 | **Surveyor assignment console** — claims auto-assign is mocked; real surveyors need a roster + manual reassign | P1 | `surveyors` collection; assign/reassign action |
| A3 | **Scheme & deadline management** — schemes need seasonal deadline edits, eligibility-rule editor | P1 | Scheme editor + rules JSON field in CMS |
| A4 | **Broadcast notifications** — send FCM to persona/district segments (scheme deadline alerts, weather warnings) | P1 | `/v1/admin/broadcast` with segment filters |
| A5 | **Settlement & payout console** — X10's weekly runs need approve/mark-paid UI | P0 | Settlements table + mark-paid |
| A6 | **Moderation queue** — UGC reports (X9), rate sanity overrides | P0 (with X2) | Reports list + actions |
| A7 | **Feature flags & app-config editor** — pairs with X12 | P1 | Admin edits `app_config` doc |
| A8 | **FPO verification & management** — FPOs are trusted entities; verify FPO registration docs | P1 | FPO KYC queue |
| A9 | **Dealer/product onboarding** — marketplace products need a create/edit UI (admin or dealer portal) | P1 | Product CRUD in admin CMS |
| A10 | **Analytics dashboards** — PBR metrics funnels (onboarding completion, switches/week, module depth) | P2 | Charts from analytics export |

## 9. Priority summary

**P0 launch blockers (16):** F1 referral entry, F2 session restore, F6 sowing intent, F7 sell-produce listing, F16 bank accounts, F21 profile edit, L1/X1 per-persona registration, T1/S1/B1/E1 KYC + A1 queue, T2 booking accept/reject, T5/E6/B6/X10 settlements, X5 order cancel/refund, X9 report/block (if X2 ships), X12 force-update, X14 crash reporting, X17 consent center, X18 legal pages.

**P1 (v1.x, ~25):** search, weather detail, task engine, cold-storage booking, price history, claim appeal, loan tracking, FPO discover, expert thread, land marketplace + requests + agreement PDF, rent reminders, POD, doc-expiry reminders, procurement + pay-farmer, udhaar ledger, approve/reject equipment, maintenance log, deal room + requirements + docs, in-app chat, SMS, address book, service ratings, coin abuse guards, analytics taxonomy, content i18n, STT/TTS concrete spec, admin A2/A3/A4/A7/A8/A9.

**P2 (roadmap):** scan history, MSP endpoint, diary attachments, sessions, data export, live tracking, trip expenses, load board, drivers, B2B orders, GST invoices, EMI tracker, machine GPS, damage reports, deal negotiation, broker commission payments, streaming infra, audio asset generation, offline drafts, admin analytics dashboards.

---

### Notes
- Items marked 📋 in earlier audit passes (manage screens + their CRUD endpoints per persona) are intentionally **not repeated** here — see `docs/overview/03-gap-analysis-new-screens-and-endpoints.md`.
- Where a missing item needs an endpoint, the naming follows `docs/conventions/02-api-conventions.md`; new collections follow `docs/schema/firestore-collections.md` conventions.
- Recommended: convert each P0 row into a task in a **Day 16–18 hardening sprint** (or fold into Days 9–14 where the parent module is built) before Play Store submission.
