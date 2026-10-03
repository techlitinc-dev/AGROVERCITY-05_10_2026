# Phase 02 — Trade & Logistics Spokes Close-out — Build Instructions

> Self-contained execution sheet. Read `execution-plan/phase-02/readme.md` first.
> Global rules (execution-plan/README.md §3) apply to every workstream — the ones
> most at risk of violation are repeated inline per workstream.
> Verification standard for every workstream (restated from ai_implementation_plan.md
> §5.0): `cd backend && .venv/bin/python -m pytest -q` green,
> `cd website && pnpm exec tsc --noEmit && pnpm build` clean, and the feature works
> end-to-end with `AI_PROVIDER=shim`.

## Repo orientation
- Backend: FastAPI + Firestore — routers `backend/app/routers/`, services
  `backend/app/services/`, tests `backend/tests/`, config `backend/app/core/`.
  Verified to exist: `land.py`, `land_records.py`, `transport.py`, `seller.py`,
  `equipment_owner.py`, `equipment.py`, `broker.py`, `farmer_deals.py`, `mandi.py`,
  `settlements.py`, `jobs.py`, `ratings.py`, `vault.py`, `purchases.py`,
  `purchase_settlement.py`, `admin.py`; services `settlements.py`
  (`DEFAULT_CONFIG = {"transportPct": 10, "equipmentRentalPct": 12, "brokerPct": 2}`),
  `rent_reminders.py`, `land_records/{base,mock_adapter}.py`, `chat.py`, `notify.py`,
  `payments.py` (Razorpay order/verify/refund only — RazorpayX payout client comes
  from phase-00 money rails). Handover-OTP pattern lives in
  `routers/purchase_settlement.py` (`HANDOVER_OTP_VALID_MINUTES`,
  `HANDOVER_OTP_MAX_ATTEMPTS`).
- Website: React + TS + Vite — API wrappers `website/src/lib/api/` (`landlord.ts`,
  `transport.ts`, `seller.ts`, `trade.ts`, `equipmentOwner.ts`, `broker.ts` all
  exist), views `website/src/views/`, i18n `t()` in `website/src/lib/i18n/`
  (locale splits `en.<feature>.ts`/`hi.<feature>.ts` merged in `main.tsx`),
  persona/module registry `website/src/lib/dashboard.ts`, tool-page registry
  `website/src/views/dashboard/ToolPage.tsx`, routes in `website/src/App.tsx`.
  Monoliths to refactor: `views/landlord/LandlordHomeBoard.tsx`,
  `views/equipment/EquipmentOwnerHomeBoard.tsx`. Already built:
  `views/transport/` (14 views), `views/trade/` (22 views), `views/broker/` +
  `views/farmer/` (deal pages).
- The AI gateway `backend/app/services/ai/` does **not** exist yet — it is phase-00
  (brief M1). WS-06 assumes `gateway.decide()`, `gateway.generate()`,
  `gateway.analyze_image()`, `question_sets.py`, `privacy.py`, `ai_decisions`
  collection, and `platform_config/ai` (Firestore: `modules`, `thresholds`,
  `automation`) are available. Env: `AI_PROVIDER`, `AI_JEV_MODEL`,
  `AI_GEMINI_MODEL{,_LITE,_PRO}`, `AI_DAILY_BUDGET_USD`, `AI_HASH_SALT`.

## WS-01 — Landlord "LandBank" close-out
**Source:** robust.md §6.2; ai.md flow 5.9; features/farm_farmlandlord.md (L2/L3, C8).
**Goal:** core loop "add plot + 7/12 → list land → field requests → negotiate →
e-sign lease → milestone escrow → collect rent → renew/terminate" runs on the web
with zero offline steps.
**Read first:** `website/src/views/landlord/LandlordHomeBoard.tsx` + `index.tsx`,
`website/src/lib/api/landlord.ts`, `backend/app/routers/land.py`,
`backend/app/routers/land_records.py`, `backend/app/routers/vault.py`,
`backend/app/services/land_records/base.py` + `mock_adapter.py`,
`backend/app/services/rent_reminders.py`, `backend/tests/test_land.py` +
`test_land_market.py` + `test_land_records.py`, `features/farm_farmlandlord.md`,
`website/src/lib/dashboard.ts` (toolIds `landlordHome`, `landlordPlots`,
`landlordLeases`, `landlordRent`, `landListings`, `leaseRequests`).
**Steps:**
1. Split the monolith into routed views under `website/src/views/landlord/` (new
   files): `PlotsPage.tsx`, `ListingsPage.tsx` + `ListingWizard.tsx` (create),
   `RequestsInboxPage.tsx` (accept/reject/counter — spec L2/L3: farmer profile +
   verified-KYC badge on each application), `LeasesPage.tsx` (agreement PDF view,
   escrow milestones, dual e-sign status), `RentTrackerPage.tsx` (due/overdue list,
   record payment), `LandAnalyticsPage.tsx`, `Vault712Page.tsx` (7/12 vault).
   Register as a `LANDLORD_PAGES` map in `views/landlord/index.tsx`, merge into
   `ToolPage.tsx`, add deep routes in `App.tsx` (pattern: `views/transport/`).
2. Land-records honesty: keep the mock adapter behind
   `services/land_records/base.py`; every record it returns renders with an
   "unverified" badge (`t()` key, en+hi) until a real Mahabhulekh/e-District
   adapter lands. Write the dated deferral note for the real integration into
   robust.md §6.2 per rule 10.
3. Rent automation on top of the existing `rent_reminders.py` scheduled job: add
   overdue escalation (reminder → late-fee notice → dispute-lane offer), partial
   payments (rent doc tracks `amountPaidPaisa` vs `amountDuePaisa` — integer paisa,
   rule 3), PDF receipts per payment, and rent-ledger export (CSV + PDF). Every
   financial mutation writes `audit_logs` (rule 3).
4. Farmer-side mirror (new views, e.g. `views/farmer/`): "land for rent near me"
   browse + request-to-lease flow (L2/L3) so a farmer applies to a listing and
   tracks his application's accept/reject/counter state. Add the toolId to the
   farmer `PROFILE_ROUTES` in `dashboard.ts`.
5. Dispute lane per the landlord spec: state-specific lease templates, dual e-sign
   audit trail, 7-year audit retention on lease + rent docs; dispute opens a record
   consumable by the phase-07 admin console (endpoint + status field here, console
   UI there).
6. Dashboard summary (feed phase-01 grid + `PERSONA_HOME_CONFIG.farmLandlord`):
   acres owned/leased, active leases + rent due this month, pending requests,
   expiring leases, plot-level occupancy. Emit tasks via `emit_task()` for: request
   received, lease expiring, rent overdue, e-sign pending.
7. Entitlements (phase-00 billing): Free = 1 plot + 1 active lease; Pro ₹299/mo =
   unlimited plots, agreement PDFs, rent automation, analytics; Enterprise =
   multi-village portfolios + team seats. Gate PDF/automation/analytics server-side
   on the entitlement, not just in UI.
8. i18n: zero hardcoded strings — `t()` keys with en+hi at ship time (rule 6); no
   `alert()`/`confirm()` — toast/modal system only.
**Acceptance:** a landlord lists a plot, a farmer applies, counter → e-sign lease →
milestone escrow → rent collected into a verified bank account, receipt PDF
generated, zero offline steps; unverified 7/12 records are labeled; entitlements
enforce Free-tier limits with an upgrade prompt.
**Verification:** `pytest` green incl. new tests (rent partial payment, escalation,
entitlement gate); `tsc --noEmit` + `pnpm build`; manual: dashboard task "rent
overdue" → deep-link → record payment → receipt downloads.

## WS-02 — Transporter "AgriFleet" close-out
**Source:** robust.md §6.3; plan/transporters_plan.md §11 (gap list) + §13 (shipped
state); ai.md flow 5.5.
**Goal:** close every remaining plan gap so a transporter earns, tracks costs, and
gets paid out weekly end-to-end while a farmer watches produce move in real time.
**Read first:** `backend/app/routers/transport.py`,
`backend/app/services/settlements.py` (`transportPct` 10),
`backend/app/routers/jobs.py` (`POST /jobs/settlements/run`),
`backend/app/routers/purchase_settlement.py` (handover-OTP pattern to reuse),
`website/src/views/transport/` (TripPage, LiveTrackingPage, SettlementsPage,
JobInboxPage, LoadDetailPage), `website/src/lib/api/transport.ts`,
`features/farm_transporter.md`, `plan/transporters_plan.md` §11.
**Steps:**
1. **OTP-based POD:** reuse the handover-OTP service shape from
   `purchase_settlement.py` (6-digit OTP, validity window, max attempts) for
   transport: farmer reveals OTP once vehicle arrives; transporter enters it to
   complete `delivered` alongside existing `podPhotos` + `receiverName`. New
   endpoints on `transport.py`: `GET /transport/bookings/{id}/pod-otp` (farmer),
   `POST /transport/bookings/{id}/verify-pod-otp` (transporter).
2. **Bid counters:** add one-round counter on load bids (`POST
   /transport/loads/{id}/bids/{bidId}/counter`) — today bids are one-shot.
3. **Damage dispute lane:** promote `pod.damageNotes` into a real dispute record
   (photos, claim amount in integer paisa, status `open → resolved`), consumable
   by the phase-07 admin console; farmer + transporter both see status.
4. **Penalties/no-show policy:** cancellation penalty config + no-show strike
   recording (cancel within X hours of pickup window = strike; N strikes =
   load-board suspension). Config in `platform_config`, versioned (rule: config
   changes effective-dated, admin-editable with maker-checker).
5. **Return-load matching (T8):** on trip completion, query open loads whose
   pickup is near the drop district within the return window → return-load card on
   the trip page + dashboard tile (deterministic query here; AI ranking is WS-06
   M16).
6. **Driver sub-users (T9, Pro tier):** driver accounts scoped to a fleet;
   drivers can ping milestones/location but not see settlements.
7. **Surge pricing config:** multiplier field on fare estimate, hard-capped at
   1.5×, and **never applied farmer-side** (surge is a transporter-side earning
   lever only — show the multiplier transparently in the fare breakdown card).
8. **KYC gate (T7):** replace the auto-`verified` shim from phase 2A's predecessor
   (plan §3.2 fix) with the phase-00 KYC pipeline: RC/DL/fitness-certificate
   documents + expiry dates; a vehicle with expired/unverified docs cannot accept
   jobs (422 like today's gate); expiry reminders emitted as tasks 30/7/1 days out.
9. **Money:** weekly settlement payouts move real money via the phase-00 RazorpayX
   payout client (settlement docs already generated by
   `POST /jobs/settlements/run` at 10% commission); trip expense log surfaces in
   P&L (`GET /bookings/{id}/expenses` already computes trip P&L at 10% — verify it
   still matches `platform_config/settlements`); per-trip commission invoice PDF.
   Integer paisa; every payout writes `audit_logs` (rule 3).
10. **Live tracking:** the web app is the driver app (PWA) — periodic location
    pings from `TripPage`/`LiveTrackingPage` (30 s refresh exists) → farmer's My
    Trips view shows vehicle en route in near-real time. No telematics (spec S16).
11. **`lotId` linkage (F12):** optional `lotId` on bookings tying produce lot →
    pickup → delivery; lot detail (trade module) shows its transport leg.
12. Dashboard summary: today's trips with status, new job requests, vehicle
    availability/location, earnings today/this week, next settlement, document
    expiries, return-load matches on today's routes.
13. Entitlements: Free = 1 vehicle commission-only; Pro ₹499/mo = fleet of 5,
    driver sub-accounts, route analytics, priority load board; Enterprise =
    unlimited fleet, API dispatch, dedicated support. Commission 10% on all tiers
    (`platform_config/settlements.transportPct`).
14. Compliance: never render `farmerPhone`/`transporterPhone`/`driverPhone`
    anywhere including bilty (rule 4; grep-level check in acceptance).
**Acceptance:** transporter completes a trip with OTP POD, expenses logged, trip
P&L == settlement math (10%), weekly RazorpayX payout lands in verified bank;
farmer watched the vehicle en route live; out-of-window cancel records a strike;
phone grep finds nothing.
**Verification:** `pytest` green incl. new tests (OTP POD happy/expiry/max-attempts,
counter round, KYC expiry gate, strike recording); `pnpm build`; manual flow:
booking → accept → PWA pings → OTP POD → settlement run → payout row → farmer
tracking screen.

## WS-03 — Vyapari "FarmLink" close-out
**Source:** robust.md §6.4; plan/seller_plan.md §11; features/Vyapari.md; ai.md
flow 5.6.
**Goal:** a vyapari replaces his physical bahi-khata entirely; farmers prefer him
because payments are tracked and provable on-platform.
**Read first:** `backend/app/routers/seller.py` (rates endpoint already 422s
`RATE_OUT_OF_BAND` at ±25% vs modal — see line ~47 — but the 2-hour edit window and
procurement/payment upgrades are missing), `backend/app/routers/mandi.py`
(`modalPrice`), `backend/app/routers/purchases.py` + `purchase_settlement.py`,
`website/src/views/trade/` (`RatesPage`, `ProcurementPage`, `KhataPage`,
`PosPage`, `PurchasesPage`), `website/src/lib/api/seller.ts`,
`features/Vyapari.md` (probation, trust tiers).
**Steps:**
1. **Rate guardrails (S2):** keep/strengthen the server-side ±25% band vs Agmarknet
   modal price; add the **2-hour edit window server-enforced** (rate doc stores
   `createdAt`; edits after 2 h → 422); surface the band inline in the rates form
   from the 422 payload — never `alert()` (rule 6). AI layer (`seller.rate_check.v1`
   + manipulation flag) is WS-06 M4 and plugs into this same endpoint.
2. **Procurement upgrade (S3/S4):** weighbridge slip photo upload on procurement
   entry (Firebase Storage via existing `PhotoUploader`); per-procurement payment
   status `paid | udhaar`; farmer-visible **"payment pending" trust card** on the
   farmer's view of that procurement; mark-paid flow with receipt.
3. **Udhaar ledger (S7):** per-buyer udhaar ledger with running balances (extends
   existing khata `/seller/ledgers`); **GST invoice PDF (S6)** per completed sale;
   **TDS 194-O statements** per settlement period.
4. **New-vyapari probation (features/Vyapari.md):** until trust tier earned —
   3 completed bookings and ₹50,000 cumulative escrow cap; **"Verified Vyapari"**
   badge surfaced to farmers on offers/procurement once earned.
5. **Buyer network / B2B (S5):** buyer directory + incoming bulk orders views
   (wholesale buyers post requirements to the vyapari).
6. **Shop KYC (S1):** phase-00 KYC pipeline gates rate posting and procurement —
   unverified shop → 403 with the entitlement/KYC error envelope (rule 7).
7. Dashboard summary: today's procurement (q + ₹), pending farmer payments
   (trust-critical, pinned), stock position, rate-posting status vs mandi band,
   open offers/negotiations, udhaar outstanding, settlement ETA.
8. Entitlements: Free = commission 2% min ₹50 + basic khata; Pro ₹999/mo =
   analytics v2, udhaar ledger, GST invoices, unlimited procurement staff seats;
   Enterprise = multi-shop, API, white-label rate boards. Commission config lives
   in `platform_config/settlements` (extend; effective-dated, versioned,
   maker-checker).
9. Money rules: integer paisa; all payment-status mutations write `audit_logs`
   (rule 3); no external payment links anywhere (rule 4).
**Acceptance:** full loop — post rate (in/out-of-band paths), procure with
weighbridge photo, farmer sees "payment pending" then paid receipt, udhaar ledger
reconciles to zero, GST invoice + TDS statement download; probation blocks a
4th booking / >₹50k escrow for a new vyapari; badge shows after tier earned.
**Verification:** `pytest` green incl. new tests (edit-window 422, payment-status
transitions, probation caps, TDS math); `pnpm build`; manual: bahi-khata day —
rates → procurement → udhaar → mark paid → statements, all from the dashboard.

## WS-04 — Equipment Owner "MachineBazaar" close-out
**Source:** robust.md §6.5; features/farm_equipment owner.md (E1–E5, pricing).
**Goal:** owner runs bookings → dispatch → damage → service → payout from the
dashboard; a farmer books a tractor slot in <60 s.
**Read first:** `website/src/views/equipment/EquipmentOwnerHomeBoard.tsx` +
`index.tsx` (monolith: 3 toolIds `equipmentOwnerHome`, `machineManage`,
`slotCalendarManage`; demo fallbacks; `alert()`s to remove),
`website/src/lib/api/equipmentOwner.ts`, `backend/app/routers/equipment_owner.py`,
`backend/app/routers/equipment.py` (farmer face — web UI is a placeholder toolId
`equipment`), `backend/tests/test_equipment_owner.py` + `test_equipment.py` +
`test_equipment_approve.py`, `backend/app/services/settlements.py`
(`equipmentRentalPct` 12), `features/farm_equipment owner.md`.
**Steps:**
1. Split the monolith into routed views under `website/src/views/equipment/` (new):
   `FleetPage.tsx`, `BookingQueuePage.tsx` (approve/reject/counter),
   `DispatchPage.tsx`, `DamageClaimsPage.tsx`, `MaintenancePage.tsx`,
   `RoiAnalyticsPage.tsx`; `EQUIPMENT_PAGES` registry → `ToolPage.tsx` → `App.tsx`
   (same refactor pattern as WS-01). Remove every `alert()` — toast/modal only
   (rule 6).
2. **Farmer-side rental UI** (toolId `equipment`, new views): browse machines near
   me, slot calendar, book / waitlist / cancel. Backend (`equipment.py` slots,
   book/waitlist/cancel) already exists — this is pure web build plus i18n.
3. **Maintenance (E3):** maintenance log per machine + service-due reminders as
   dashboard tasks (hours-based or date-based schedule on the machine doc).
4. **Damage claims (E5):** damage-deposit claims with photos (before/after),
   claim amount integer paisa, owner-filed → admin-arbitrable status flow.
5. **KYC (E1):** RC / insurance / operator licence via phase-00 KYC pipeline with
   mid-season expiry handling (expired insurance blocks new bookings, not in-flight
   ones; expiry tasks 30/7/1 days out).
6. **Pricing engine:** hourly / per-acre / package rates per machine (machine doc
   `pricing: {hourly?, perAcre?, package?}`); **FPO auto-confirm** bookings vs
   private manual-approve distinction surfaced in the booking queue UI.
7. **Location check-in (E4-lite):** manual/event pins at dispatch and return (no
   GPS tracker for v1); rendered on the dispatch timeline.
8. **Settlement payouts real:** weekly payout via phase-00 RazorpayX client at 12%
   commission (`platform_config/settlements.equipmentRentalPct` — config exists;
   make money move); `audit_logs` on every mutation (rule 3).
9. Dashboard summary: machines + today's utilization, pending approvals, machines
   out now + return ETA, damage claims open, next service due, weekly income +
   next payout.
10. Entitlements: Free = 1 machine; Pro ₹399/mo = 5 machines, analytics,
    maintenance suite, priority listing; Enterprise = fleet unlimited, operator
    management, API.
**Acceptance:** owner completes booking → dispatch (check-in pin) → return →
damage claim with photos → service log → weekly payout; farmer books a slot in
<60 s from the browse screen; 12% commission math reconciles with the settlement
doc; no `alert()` in the module.
**Verification:** `pytest` green incl. new tests (pricing-engine quote, FPO
auto-confirm, damage-claim transitions, KYC mid-season expiry); `pnpm build`;
manual: farmer book → owner approve → dispatch → return → payout row.

## WS-05 — Broker "DealDesk" close-out
**Source:** robust.md §6.6; plan/broker_plan.md §11 (out-of-scope list) + §13
(shipped state); features/farm_brokerdalal.md.
**Goal:** a broker runs 50+ concurrent deals with provable commission accounting
and never shares a phone number off-platform.
**Read first:** `backend/app/routers/broker.py`, `backend/app/routers/farmer_deals.py`,
`backend/app/models/broker.py`, `backend/app/services/settlements.py` (`brokerPct`
2), `backend/app/routers/ratings.py`, `backend/tests/test_broker_deals.py`,
`website/src/views/broker/` (8 views) + `website/src/views/farmer/`
(`FarmerOffersPage`, `FarmerDealDetailPage`), `website/src/lib/api/broker.ts`,
`website/src/components/broker/` (DealMathCard, OfferCard, EContractCard,
MaskedPhoneText, D4TextGuard, DealChatDoor…), `plan/broker_plan.md` §11.
**Steps:**
1. **Offer TTL:** `expiresAt` on deal offers (configurable 24–48h, default 24h);
   auto-expire job flips stale `negotiating` offers to expired; UI already shows
   "sent Xh ago" — add TTL countdown chip.
2. **3-round counter cap + deadlock resolution:** count counter rounds per deal;
   at round 3 the deal locks to accept/decline only; deadlock path offers
   mediator/admin resolution. (AI deadlock-risk prediction at round 2 is WS-06
   M19.)
3. **Deal documents vault (B4):** extend the existing evidence upload
   (`POST /broker/deals/{id}/evidence`, kind-capped) into a typed vault: weigh
   slip, quality report, payment proof; both parties can view post-acceptance.
4. **Buyer requirement postings (B3):** new collection + endpoints — "need 50q
   onion @ ₹X" postings brokers/farmers can respond to; wire into lead pipeline
   ("Make deal" prefill exists — reuse).
5. **Real commission payout (B6):** weekly settlement → RazorpayX payout to the
   broker's verified bank account (phase-00 rails); integer paisa; `audit_logs`
   (rule 3).
6. **Razorpay split at payment time (B7):** buyer payment splits at capture —
   farmer leg + commission leg — via the phase-00 Razorpay route/split
   integration; never hold money outside the escrow/settlement rails (rule 3).
7. **Broker KYC + trust tiers (B1):** licence/GST docs via phase-00 KYC pipeline;
   "Proven Broker" trust tier with **48–72h approval SLA** (SLA clock visible to
   the broker; breach escalates to admin queue).
8. **Ratings backend:** two-sided ratings on completed deals persisted
   server-side (extend `routers/ratings.py`) — replaces the current localStorage
   fallback in `FarmerDealDetailPage`.
9. **Dispute workflow with SLA:** dispute record on a deal (category, evidence
   freeze, SLA timer) wired to the admin queue endpoints; console UI lands in
   phase-07.
10. Dashboard summary: active deals by stage (pipeline), new leads, offers
    awaiting response + TTL countdown, deals needing evidence, commission
    earned/pending/paid, network size (farmers/buyers saved).
11. Entitlements: Free = 5 active deals, 2% commission; Pro ₹799/mo = unlimited
    deals, CRM bulk tools, mandi-trend analytics, priority leads. Commission
    **never replaced by subscription — they stack**; pct configurable 0–10
    (`platform_config/settlements.brokerPct`, effective-dated, maker-checker).
12. Compliance (rules 4 + 6): no phone/UPI/links in any surface — `MaskedPhoneText`
    + `D4TextGuard` everywhere, server-side moderation regex + strike ladder on
    deal messages; en+hi parity.
**Acceptance:** 50 concurrent deals seeded and driven through stages without
errors; offer expires at TTL; round-3 lock forces accept/decline; commission
ledger reconciles: Σ deal commissions == settlement gross → RazorpayX payout row;
split payment credits farmer leg and commission leg separately; DOM grep finds no
unmasked phone.
**Verification:** `pytest` green incl. new tests (TTL expiry job, counter cap,
split math, KYC SLA breach, ratings); `pnpm build`; manual: deal → counter ×3 →
lock → contract → accept → evidence vault → completed → rating both sides →
payout.

## WS-06 — AI spoke decisions (M4, M16, M19, M24, M25)
**Source:** ai_implementation_plan.md §0, §2 (question-set registry), §3 (SDR/SGR
recipes), briefs M4/M16/M19/M24/M25; ai.md catalog A4/A6/B9/B10/B12/B13 + flows
5.5, 5.6, 5.9.
**Goal:** five spoke decision points live behind flags at `suggest` automation,
each with a deterministic fallback and `ai_decisions` logging.
**Read first:** `backend/app/services/ai/` (from phase-00 — `gateway.py`,
`question_sets.py`, `privacy.py`), `backend/app/routers/seller.py`,
`routers/mandi.py`, `routers/transport.py`, `routers/broker.py`,
`routers/farmer_deals.py`, `routers/equipment_owner.py`, `routers/equipment.py`,
`routers/land.py`, `website/src/views/trade/` (rates, procurement),
`website/src/views/transport/`, `website/src/views/broker/`,
`website/src/views/equipment/`, `website/src/views/landlord/`,
`backend/tests/fixtures/ai/golden/` (from phase-00).

Follow the **SDR** for every Jev decision (ai_implementation_plan.md §3): (1)
register the question set in `question_sets.py` with schema + threshold +
fallback; (2) build state via a `privacy.py` builder — pseudonymized, ≤1,500
tokens, **no Aadhaar/phone/email in any payload** (rule 11); (3)
`result = await gateway.decide(state, "<id>.v1", ctx)` — never call
OpenRouter/Gemini from routers (rule 10); (4) act per automation level — all five
launch at `suggest` = annotate only (rule 12); (5) on exception/timeout/low budget
→ fallback, log with `fallbackUsed`; (6) register an outcome hook; (7) tests:
golden fixture passes on shim, fallback test with gateway raising, flag-off test
proving the module works without AI. Follow the **SGR** for Gemini generation:
`gateway.generate()` → Pydantic validation with one repair retry → aggressive
caching (per district-crop / decision_id, never per page-view) → cost logged →
fallback = static en/hi template text. Flag keys go in `platform_config/ai.modules`
(e.g. `seller_rate_check`, `transport_match`, `broker_lead_score`,
`equipment_booking_rec`, `land_listing_quality`); thresholds in
`platform_config/ai.thresholds`; automation in `platform_config/ai.automation`.

**Steps:**
1. **M4 — Seller rate-band guard + demand forecast** (flow 5.6). Question set
   `seller.rate_check.v1` (`within_fair_band` bool; `manipulation_signal` score).
   In `POST /seller/rates`: build state (posted rate, crop, mandi modal, 7-day
   volatility, seller history); `within_fair_band=false` → 422 with the band in
   the error payload (extends the WS-03 guardrail — the AI check enriches, the
   static ±25% rule remains the **fallback**); `manipulation_signal > 0.8` →
   write the rate + flag `admin_review` (stub admin route acceptable). Website
   `RatesPage`: inline band display + warning from the 422 payload, no `alert()`.
   Forecast (SGR, Gemini): nightly job per seller over 90-day procurement/sales →
   `{suggested_procurement: [{crop, qty_quintal, reason}]}` (catalog C4); card on
   the seller dashboard; cache 24 h. Collusion watch (A6 `trust.fraud.v1`) is
   M8/phase-06 — out of scope here.
2. **M16 — Transport matching & return loads** (flow 5.5). Question set
   `transport.match.v1` (per-vehicle/load `fit` score batch; `noshow_risk`
   score). Batch-scoring job per new load/booking request: route fit, vehicle
   type, capacity, history. Return-load card on trip completion (ranks the WS-02
   deterministic return-load query results); no-show risk badge on accept screens
   (JobInbox / bid accept). Outcome hooks: completed/cancelled. **Fallback =
   distance sort.**
3. **M19 — Broker lead scoring & deadlock prediction**. Question set
   `broker.lead_score.v1` (`quality` score; `deadlock_risk` score). Score new
   leads (source, history, demand fit); per-deal deadlock risk at **round 2 of 3**
   (message count, price gap, TTL remaining) → suggest mediator action (feeds the
   WS-05 deadlock path); broker pipeline dashboard annotated with scores.
4. **M24 — Equipment booking recommendations**. Approve-recommendation score on
   each booking request (renter history, slot conflicts, distance) shown in the
   owner's booking queue — annotate only. Damage claim photos →
   `gateway.analyze_image()` (G-vision) severity estimate + suggested deduction
   band — **suggest-only; owner/admin always confirms** (rule 12).
5. **M25 — Land listing quality** (flow 5.9). Question set
   `land.listing_quality.v1` (`completeness` score; `rent_band_ok` bool). On
   listing save: completeness score + actionable tips ("photo add karein" style,
   en+hi); rent vs village band check — band from real lease data where
   available, else district defaults **labeled as such**; tenant-request
   compatibility score on the landlord's requests inbox.
**Acceptance:** M4 — out-of-band post rejected with helpful inline message;
flagged rates appear in the admin queue; forecast validates or hides. M16 —
matched suggestions beat the distance-only baseline on the golden set. M19 —
scores visible in pipeline UI; high-deadlock predictions correlate with actual
deadlocks on golden deals (document the measured correlation in the module's
test/notes). M24 — queue annotated; damage flow requires human confirm; golden
damage set severity within ±1 band ≥ 75%. M25 — tips render en/hi and are
actionable. All five: flag off → module fully functional via fallback; shim mode
green.
**Verification:** `cd backend && .venv/bin/python -m pytest -q` green (incl.
golden-fixture shim tests, fallback tests, flag-off tests per brief); `cd website
&& pnpm build` clean; feature works with `AI_PROVIDER=shim`; `ai_decisions` rows
show cost + confidence + `fallbackUsed` for each call site.

## Phase-final verification
1. `cd backend && .venv/bin/python -m pytest -q` — fully green (rule 9).
2. `cd website && pnpm exec tsc --noEmit && pnpm build` — clean.
3. Full backend suite green again with `AI_PROVIDER=shim`.
4. Locale parity: every new key present in both `en.*` and `hi.*` locale files.
5. Manual end-to-end flows (dashboard task deep-link → completion, no "coming
   soon" reachable):
   - Landlord: plot → listing → farmer request → counter → e-sign → escrow
     milestone → rent paid → receipt PDF.
   - Transporter: booking → KYC-verified vehicle accept → PWA pings → OTP POD →
     expenses → settlement run → RazorpayX payout row; farmer tracking live.
   - Vyapari: rate post (band OK + 422 path) → procurement + weighbridge photo →
     farmer trust card → mark paid → udhaar ledger zero → GST/TDS download.
   - Equipment: farmer books slot <60 s → owner approve → dispatch pin → return →
     damage claim → service log → 12% payout.
   - Broker: 50-deal soak → TTL expiry → 3-round lock → contract → evidence vault
     → completed → two-sided rating → split payout.
   - AI: toggle each `platform_config/ai.modules` flag off → feature still works
     via fallback; toggle on (shim) → annotations appear; no PII in payloads.
6. Phone-number grep over rendered pages (broker, transport bilty, chat surfaces)
   — zero unmasked matches.
