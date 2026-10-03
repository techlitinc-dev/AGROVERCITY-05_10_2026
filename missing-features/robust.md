# robust.md — AGROVERCITY → Million-Dollar SaaS: Master Conversion Blueprint

> **Scope:** `backend/` (FastAPI + Firestore) and `website/` (React + TS + Vite) ONLY.
> The Flutter apps (`apps/mobile`, `apps/admin`, `flutter-prototype`) are out of scope
> for this program.
>
> **Companion doc:** read `missing-features/understand.md` first — it records the
> verified current state this plan is built on.
>
> **How to use:** Phases 0–5 are dependency-ordered. Every persona (§6) and every
> module (§7) has its own self-contained build spec with a "Done when" checklist —
> each one is a full-fledged application in itself and can be executed as an
> independent workstream once Phase 0 and Phase 1 land. Nothing in this document is
> optional-by-omission: if a module or persona exists in the codebase, it has a
> section here.

---

## 1. North Star

**Positioning:** AGROVERCITY is the **income operating system for Bharat's farm
economy** — one account that runs a farmer's entire business (grow, sell, insure,
finance, learn) and lets every agri-business around him (landlord, transporter,
vyapari, equipment owner, broker, dairy, buyer, bank, insurer, cold storage,
instructor, vet) run *their* business on the same rails.

**The one architectural truth:** the farmer is the sun; every other persona is a
planet. Every transaction in every persona app is ultimately a transaction *with a
farmer* (selling to him, buying from him, serving him). Every design decision must
preserve this linkage — shared identity, shared chat, shared escrow, shared
notifications, and a shared dashboard shell.

**What "million-dollar SaaS" means here (revenue stack, in priority order):**

| # | Engine | Basis | Status today |
|---|---|---|---|
| R1 | Transaction commissions | 2–12% take-rate per marketplace (engine exists: transport 10%, equipment 12%, broker 2%, vyapari 2% min ₹50) | Built, not enforced end-to-end (no real payouts) |
| R2 | SaaS subscriptions | Tiered plans for business personas (free / pro / enterprise) | **Absent — the biggest single gap** |
| R3 | Payments & escrow float | Escrow pre-funding, settlement timing, TDS 194-O compliance | Docs only |
| R4 | Fintech referral | Loan/insurance/KCC origination fees from partner banks & insurers | Flows exist, no partner integration |
| R5 | Paid knowledge | Courses, workshops, certificates (GMV commission exists in admin report) | Backend exists, no web UI |
| R6 | Ads & promoted listings | `ads` router exists (campaigns, impressions, clicks) | Backend exists, no web UI |
| R7 | Data insights (B2B API) | Aggregated, consented, anonymized mandi/saturation/pricing intelligence | Roadmap only |

**North-star metrics:** weekly transacting farmers; GMV per marketplace; take-rate
revenue; paid-plan conversion per business persona; tasks-completed-per-user-per-week
(the dashboard is the retention engine); % notifications deep-linked into a completed
action.

---

## 2. Architectural principles (binding on all work)

1. **P1 — Farmer-linked ecosystem.** Every persona module must name the farmer it
   serves in its data model (e.g. `farmerId` on leases, bookings, deals,
   collections, contracts, enrollments). No persona feature may exist that is not
   traceable to farmer value.
2. **P2 — One marketplace template.** All two-sided flows follow the shared
   template from `features/*.md`: 100% in-app communication, chat unlocks only
   after booking/offer acceptance, no phone/UPI/URL sharing (moderation regex +
   strike ladder), escrow-or-settlement money movement, commission at source,
   KYC before transacting, dispute lane with SLA. Never invent a per-module
   variant without documenting why.
3. **P3 — Backend is the product; website surfaces it.** ~39 backend router
   families already work and have zero web UI. Prefer wiring existing endpoints
   over writing new ones. New backend is justified only for: billing, task
   engine, real payouts, KYC pipeline, admin auth unification.
4. **P4 — Vernacular parity.** en + hi complete at ship time for every screen;
   `t()` keys only, no hardcoded strings; locale parity checked in CI. The five
   existing monolithic persona boards (English-only, `alert()`-driven) must be
   refactored, not extended.
5. **P5 — No demo data in production paths.** Every `?? <hardcoded number>`
   fallback, `'sess_demo'`, hardcoded KYC queue, fixture weather, always-verified
   penny-drop stub is a launch blocker. Feature-flag dev fixtures behind
   `APP_ENV=dev`.
6. **P6 — Money is paisa-accurate and audited.** Integer paisa everywhere,
   commission deducted at source, every financial mutation writes `audit_logs`,
   maker-checker for manual overrides > ₹10,000 (superadmin standard).
7. **P7 — Low-literacy UX.** Timeline-over-tables, audio readout hooks, icon-first
   actions, masked phones, mandi benchmark next to every price.
8. **P8 — Offline-tolerant writes.** Keep the existing `Idempotency-Key` client
   behavior and `/sync` replay; every new write endpoint must accept idempotency
   keys.

---

## 3. PHASE 0 — SaaS Foundation & Hardening (blocks everything)

### 3.1 Kill every demo backdoor
- Remove/gate behind `APP_ENV=dev`: MPIN `1234` bypass (`auth.py`), `dev-`/`demo-`
  token acceptance, `/auth/quick-login` (11 hardcoded accounts), Razorpay
  signature `"dev"`, `rzp_test_dev` fallback, hardcoded JWT default secret —
  fail startup if `jwt_secret` is unset in prod.
- CORS: replace `["*"]` with the real web origins per environment.
- Rotate the Firebase web API key out of `website/src/lib/firebase.ts` into env
  config; add App Check.

### 3.2 Auth & admin-auth unification
- One admin mechanism: keep `core/deps.py:admin_user` (Firebase custom claims via
  `scripts/make_admin.py`), delete `routers/admin.py:_require_admin` (flag +
  hardcoded UIDs). Add `X-Admin-Role` + `X-Audit-Reason` headers per the
  superadmin spec.
- JWT hardening: refresh-token rotation + revocation list in Redis;
  `GET/DELETE /v1/auth/sessions` for multi-device management; session restore UX
  (MPIN re-entry on expiry — missing.md F2).
- Rate limiting (Redis token bucket) on auth, OTP, payments, chat.

### 3.3 Real money rails (R1 + R3)
- **Payments router (user-facing):** expose `services/payments.py` properly —
  `POST /v1/payments/order`, `POST /v1/payments/verify`, **Razorpay webhook
  endpoint with signature verification**, refund path, reconciliation job.
- **Escrow:** replace document-only escrow in purchases with Razorpay Route
  (linked accounts per seller/transporter/owner/broker) or a nodal-escrow
  provider; auto-release T+0/T+1 with a 24 h silent dispute window; handover OTP
  already exists — wire release to it.
- **Payouts:** RazorpayX (or equivalent) for weekly settlement runs; the
  settlement engine (`services/settlements.py` + `jobs.py`) must move real money,
  `onHold` when no verified bank account.
- **Bank verification:** replace the always-verified penny-drop stub with a real
  provider (RazorpayX / Cashfree / Setu); keep adapter interface.
- **TDS 194-O & GST:** per-transaction TDS ledger for e-commerce compliance;
  GST invoice generation for vyapari sales (S6) and platform commission
  invoices to business personas.

### 3.4 KYC pipeline (P0 for every business persona)
- One `kyc_cases` collection + one review queue replacing the hardcoded admin
  KYC sample docs. Per-persona document matrices already specced in
  `features/*.md`: Aadhaar (DigiLocker/offline-eKYC masked), PAN, penny-drop
  bank, plus role docs — transporter RC/DL, vyapari APMC licence + GST, broker
  arhtiya licence, equipment RC/insurance/operator licence, dairy FSSAI,
  exporter IEC/APEDA, instructor credential per specialization, landlord 7/12
  title + tax receipt.
- Doc status state machine (`pending → verified → rejected`, with reason);
  expiry tracking + scheduled reminders (RC/insurance/fitness, licences);
  recurring re-verification for instructor licences.
- Website: KYC submission wizard per persona + status page; admin review UI
  (§8).

### 3.5 Subscriptions & billing (R2) — the SaaS core
New backend module `billing`:
- `plans` collection: per-persona tier matrix (see §6 for each persona's tiers).
  Example shape: `{ planId, persona, tier: free|pro|enterprise, priceMonthlyPaisa,
  limits: { listings, vehicles, machines, teamSeats, analyticsHistoryDays,
  prioritySupport }, features: [...] }`.
- `subscriptions` collection: Razorpay Subscriptions (or UPI Autopay mandates —
  critical for rural India) + webhook-driven status (`active/past_due/cancelled`).
- **Metering & entitlements middleware:** `require_entitlement(persona, feature)`
  dependency used by routers; usage counters per billing period.
- Paywall UX on website: upgrade prompts at limit hits, plan comparison page,
  invoices + GST invoice download, grace period + downgrade rules.
- Free tier must stay genuinely useful for farmers (farmer persona is NEVER
  paywalled for core selling — commissions monetize him; subscriptions monetize
  the businesses around him).

### 3.6 Platform plumbing
- Error envelope consistency: every endpoint returns `{"error":{code,...}}`;
  retire `{"detail":...}` leaks.
- Real cursor pagination on `db.query()` (Firestore cursors), replacing
  limit-100-then-slice; cap unbounded scans in admin/analytics.
- Firestore composite indexes committed to `infra/firestore.indexes.json` for
  every shipped query.
- Fix the 45 failing backend tests; make `conftest.py` registry auto-discover
  modules instead of the manual monkeypatch lists.
- Sentry on backend + website; structured request logging; uptime alerting.
- Environments: dev/staging/prod configs, secrets via env → GCP Secret Manager;
  CI pipeline: `pytest` + `tsc --noEmit` + `pnpm build` + locale-parity check
  gates every merge.

---

## 4. PHASE 1 — The Universal Action Dashboard ("summary of all tasks")

> This is the explicit product requirement: **the dashboard must contain a summary
> of all tasks so the farmer can review every option — and the same is true for
> every profile.** Today `DashboardHome.tsx` is static placeholder cards. This
> phase replaces it with the real retention engine.

### 4.1 Backend: the task engine (`/v1/tasks`)
New collection `tasks` + router:
- Task shape: `{ taskId, userId, persona, module, kind, title:{en,hi}, subtitle,
  priority: urgent|today|upcoming, deepLink, actionEndpoint?, dueAt, status:
  open|done|dismissed, sourceId, createdAt }`.
- **Generators** — each module emits tasks via a shared `emit_task()` service
  (call it from existing state transitions, no separate cron where avoidable):

| Source module | Example tasks emitted |
|---|---|
| crop_cycles / advisory | "Sow tomato this week", "Spray window tomorrow 6–9am", sowing-intent nudges, saturation warnings |
| weather | "Heavy rain in 48h — delay urea" (severe-weather alerts) |
| trade (lots/offers/purchases) | "3 new offers on your onion lot", "Counter expires in 6h", "Pickup scheduled — keep produce ready", "Payment ₹18,400 pending release" |
| transport | "New booking request", "Trip starts in 2h", "POD pending upload", "Weekly settlement ₹28,500 ready" |
| equipment | "Booking approval needed", "Machine due back today", "Service due: Mahindra 575" |
| land | "Rent due from tenant in 3 days" (exists as job — emit tasks), "Lease expiring in 30 days", "New lease request" |
| dairy | "Morning collection not logged", "Payment batch ready to approve", "Rate chart expires Sunday" |
| loans / finance | "Loan approved — accept terms", "EMI due in 5 days", "KCC limit top-up available" |
| insurance | "Claim surveyor assigned", "Claim rejected — appeal within 15 days", "PMFBY enrollment deadline" |
| contracts / direct buyer | "Contract delivery due this week", "New grow-for-us offer matches your crops" |
| schemes | "PM-Kisan installment credited", "New scheme matches your profile — apply by 12 Nov" |
| courses / instructor | "Live class at 5pm", "12 pending assignment reviews", "Certificate ready" |
| broker | "Deal awaiting your confirmation", "Commission payout processed" |
| cold storage | "Chamber booking confirmed", "Lot releases tomorrow" |
| gamification / referrals | "50 coins to next reward", "Referral milestone reached" |
| KYC / account | "KYC verification needed to receive payouts", "Document expiring" |

- Endpoints: `GET /v1/tasks/today`, `GET /v1/tasks?persona=&status=`,
  `POST /v1/tasks/{id}/done|dismiss`, and **`GET /v1/tasks/summary`** returning
  per-module counts + top-3 urgent items per persona. Reuse and extend the
  existing `/intelligence` ops-summary router rather than duplicating it —
  `/intelligence` becomes the numbers layer, `/tasks` becomes the action layer.
- Notification deep-link map (X3) must point at the same `deepLink` values so
  push → dashboard → action is one tap.

### 4.2 Website: the Action Center
Rebuild `DashboardHome.tsx` (currently static) around five real sections, all
fed by `/v1/tasks/summary` + `/intelligence`:
1. **Urgent strip** — red/amber cards for time-boxed items (expiring offers,
   pickups today, payment releases).
2. **Today's tasks** — checklist with one-tap actions; completing a task
   celebrates (+coins where applicable).
3. **Module summary grid** — one card per module the active persona can access
   (the ACL matrix already exists in `lib/dashboard.ts`), each showing live
   count + one-line status ("2 offers expiring", "Rent overdue ₹12,000").
4. **Money snapshot** — real pending receivables/payables/settlements from
   `/intelligence` (replaces every hardcoded metric pill).
5. **Persona switcher + aggregate mode** — for users with multiple linked
   profiles, an "All profiles" toggle that unions tasks across personas (a
   farmer who is also an equipment owner sees both queues; farmer persona
   defaults to aggregate ON since he is the super-user).

Per-persona dashboard content is specced in each §6 section under
**"Dashboard summary must show"**.

### 4.3 Definition of done for Phase 1
- Zero hardcoded metrics on any dashboard (grep for `?? <number>` returns
  nothing in `website/src/views`).
- Every module in this document emits ≥1 task type and appears in the summary
  grid.
- Tapping any task lands on a working screen (no "coming soon" from a task).

---

## 5. (Reserved — see phases in §11 roadmap for ordering)

---

## 6. PHASE 2 — Personas as Full-Fledged Applications

> Each subsection is a standalone app spec. Shared shell (identity, dashboard,
> chat, notifications, wallet, KYC) comes from Phases 0–1; each persona app adds
> its own loop, screens, tiers, and dashboard content. Farmer is §6.1 and is the
> hub; all others are spokes linked to him.

### 6.1 FARMER (किसान) — the super-app hub
- **Status:** widest module access (all 24); trade/diary/P&L/notifications real
  on web; most other modules are placeholder toolIds.
- **Core loop:** plan → sow → grow → protect → harvest → sell → insure →
  accounts → learn → repeat.
- **Build instructions:**
  1. Surface the 24 modules per §7 — the farmer sees everything, so every §7
     module's farmer face is in his app.
  2. Season loop backbone: `crop_cycles` per plot (sowing date, crop, stage) —
     drives the task engine (F5/F8), saturation opt-in (F6), and insurance/
     advisory relevance.
  3. Sell-my-produce: lots CRUD exists — add photo flow, price suggestion from
     mandi + AI grading stub→real, and one-tap "share to broker/vyapari/direct
     buyer" distribution.
  4. Money hub: bank accounts (penny-drop real), loan tracking list (F17),
     insurance passbook, settlements receivable from every marketplace, diary
     auto-entries from completed transactions.
  5. Profile edit screen (F21), referral entry at registration (F1 — backend
     exists, verify web wizard has it), farm-map edit, multi-plot support.
- **Dashboard summary must show:** today's crop tasks, weather alert, live mandi
  for his crops, offers on his lots, pickups/deliveries today, money in/pending,
  loan/insurance status, scheme deadlines, new courses/news, coins & streak.
- **Monetization:** none directly (never paywall the farmer's core loop) — he is
  monetized via commissions on the other side and drives all R1/R3/R4 volume.
- **Done when:** a farmer can run an entire season — plan to payment receipt —
  without leaving the website, and his dashboard summarizes all of it.

### 6.2 FARM LANDLORD (खेत मालिक) — "LandBank": the land-leasing app
- **Mahabhulekh/e-District integration deferred (2026-10-03, phase-02 WS-01):** the real government land-registry integration is deferred; the adapter interface (`services/land_records/base.py`) + "unverified" labeling for mock records shipped in phase-02 WS-01.
- **Status:** backend complete-ish (plots, listings, lease requests with
  counter-offers, leases, rent payments, agreement PDF, escrow milestones,
  analytics, 7/12 mock adapter). Web: one monolithic `LandlordHomeBoard.tsx`
  (English-only, demo defaults) under 6 toolIds.
- **Core loop:** add plot + 7/12 → list land → field requests → negotiate →
  e-sign lease → milestone escrow → collect rent → renew/terminate.
- **Build instructions:**
  1. Break the monolith into routed views: Plots, Listings (+create wizard),
     Requests inbox (accept/reject/counter), Leases (agreement PDF view,
     milestones, e-sign status), Rent tracker (due/overdue, record payment),
     Analytics, 7/12 vault.
  2. Replace mock `land_records` adapter with Mahabhulekh/e-District integration
     behind the existing adapter interface; until then label records
     "unverified" (trust honesty).
  3. Rent automation: scheduled reminder job exists — add overdue escalation,
     partial payments, receipts (PDF), and rent ledger export.
  4. Farmer-side mirror: "land for rent near me" browse + request-to-lease flow
     in the farmer app (L2/L3).
  5. Dispute lane per the landlord spec (features/farm_farmlandlord.md):
     state-specific lease templates, dual e-sign, 7-yr audit retention.
- **Dashboard summary must show:** acres owned/leased, active leases + rent due
  this month, pending requests, expiring leases, plot-level occupancy.
- **SaaS tiers:** Free (1 plot, 1 active lease) / Pro ₹299/mo (unlimited plots,
  agreement PDFs, rent automation, analytics) / Enterprise (multi-village
  portfolios, team seats).
- **Done when:** a landlord lists a plot, signs a lease, and receives rent into
  a verified bank account with zero offline steps.

### 6.3 TRANSPORTER (परिवहन) — "AgriFleet": the agri-logistics app
- **Status:** strongest spoke — backend TMS (vehicles, calendar, fare estimate,
  bookings lifecycle, loads + bids, trip location, bilty, weighbridge, expenses,
  analytics) + 14 API-wired web views. Delivered per `plan/transporters_plan.md`.
- **Core loop:** add vehicle + docs → set availability → receive/accept jobs →
  trip (pickup → POD) → daily earnings → maintenance.
- **Build instructions:**
  1. Close the remaining plan gaps: OTP-based POD (reuse handover-OTP service),
     bid counters, damage dispute lane, penalties/no-show policy, return-load
     matching (T8 — flagged as a monetization feature in the PBR), driver
     sub-users (T9), surge pricing config (capped 1.5×, never farmer-side).
  2. KYC gate: RC/DL/fitness verification + expiry reminders (T7) before a
     vehicle can accept jobs.
  3. Money: weekly settlement payouts via RazorpayX (T5 exists as docs — make
     money move), trip expense log surfaced in P&L (T6), per-trip commission
     invoice.
  4. Live tracking: periodic driver location pings → farmer sees vehicle en
     route (T4); FCM/web-push based, no dedicated driver app needed for v1 —
     the web app is the driver app (PWA, §9.4).
  5. Tie produce lots → pickup → delivery explicitly (`lotId` on bookings, F12).
- **Dashboard summary must show:** today's trips with status, new job requests,
  vehicle availability/location, earnings today/this week, next settlement,
  document expiries, return-load matches on today's routes.
- **SaaS tiers:** Free (1 vehicle, commission-only) / Pro ₹499/mo (fleet of 5,
  driver sub-accounts, route analytics, priority load board) / Enterprise
  (unlimited fleet, API dispatch, dedicated support). Commission 10% stays on
  all tiers.
- **Done when:** a transporter earns, tracks costs, and gets paid out weekly
  end-to-end; a farmer watches his produce move in real time.

### 6.4 SELLER / VYAPARI (व्यापारी) — "FarmLink": the farm-gate trade app
- **Status:** delivered per `plan/seller_plan.md` — 22 API-wired trade views,
  lots → offers → purchases lifecycle, escrow doc, handover OTP, khata, POS,
  procurement, rate posting, analytics, chat with in-thread deal bar.
- **Core loop:** post today's rates → procure from farmers → manage stock →
  sell onward → ledger & settlements.
- **Build instructions:**
  1. Rate guardrails (S2): server-side ±25% band vs Agmarknet modal, 2 h edit
     window — currently unenforced.
  2. Procurement upgrade (S3/S4): weighbridge slip photo, per-procurement
     payment status (paid/udhaar) with farmer-visible "payment pending" trust
     card, mark-paid flow.
  3. Udhaar ledger per buyer (S7) with running balances + GST invoice PDF
     (S6) + TDS 194-O statements.
  4. New-vyapari probation per Vyapari.md: 3-booking, ₹50k escrow cap until
     trust tier earned; trust badges ("Verified Vyapari") surfaced to farmers.
  5. Buyer network / B2B orders (S5): directory + incoming bulk orders.
  6. Shop KYC (S1) gating rate posting and procurement.
- **Dashboard summary must show:** today's procurement (q + ₹), pending farmer
  payments (trust-critical), stock position, rate-posting status vs mandi band,
  open offers/negotiations, udhaar outstanding, settlement ETA.
- **SaaS tiers:** Free (commission 2% min ₹50, basic khata) / Pro ₹999/mo
  (analytics v2, udhaar ledger, GST invoices, unlimited procurement staff
  seats) / Enterprise (multi-shop, API, white-label rate boards).
- **Done when:** a vyapari replaces his physical bahi-khata entirely; farmers
  prefer him because payments are tracked and provable on-platform.

### 6.5 EQUIPMENT OWNER (यंत्र किराया) — "MachineBazaar": the agri-machinery rental app
- **Status:** backend strong (fleet, slots, book/waitlist/cancel, owner
  approve/reject/counter, execution, damage claims, analytics). Web: monolithic
  `EquipmentOwnerHomeBoard.tsx` (3 toolIds, demo fallbacks, `alert()`s).
  Farmer-facing slot booking UI is a placeholder toolId.
- **Core loop:** add machine + docs → slot templates/pricing → approve requests
  → dispatch & track usage → maintenance → payouts.
- **Build instructions:**
  1. Split the monolith into routed views (Fleet, Booking queue, Dispatch,
     Damage claims, Maintenance, ROI analytics) — same refactor pattern as
     landlord.
  2. Build the farmer-side rental UI (browse machines near me, slot calendar,
     book/waitlist/cancel) — backend exists, web UI missing.
  3. Maintenance log + service-due reminders (E3), damage-deposit claims with
     photos (E5), KYC for RC/insurance/operator licence with mid-season expiry
     handling (E1, per equipment spec).
  4. Pricing engine: hourly/acre/package rates per machine; FPO auto-confirm
     vs private manual-approve distinction surfaced in UI.
  5. Machine location check-in at dispatch/return (E4 lite — manual/event
     pins, no GPS tracker for v1).
  6. Settlement payouts real (12% commission config exists).
- **Dashboard summary must show:** machines + today's utilization, pending
  approvals, machines out now + return ETA, damage claims open, next service
  due, weekly income + next payout.
- **SaaS tiers:** Free (1 machine) / Pro ₹399/mo (5 machines, analytics,
  maintenance suite, priority listing) / Enterprise (fleet unlimited, operator
  management, API).
- **Done when:** an owner runs his entire rental business (bookings → dispatch
  → damage → service → payout) from the dashboard; a farmer books a tractor
  slot in <60 s.

### 6.6 BROKER / DALAL (दलाल) — "DealDesk": the agri deal-mediation CRM
- **Status:** delivered per `plan/broker_plan.md` — deals with auto
  gross/commission math, structured offers, leads CRM, evidence upload,
  commissions, weekly settlements, farmer-visible deal endpoints, 12 web
  components (DealChatDoor, MaskedPhoneText, CommissionStepper…).
- **Core loop:** build farmer/buyer network → match lot ↔ requirement →
  mediate (bid/counter) → e-contract → milestones → commission payout.
- **Build instructions:**
  1. Close the plan's out-of-scope list: offer TTL (24–48h auto-expire),
     3-round counter cap with deadlock resolution, deal documents vault
     (weigh slip, quality report, payment proof — B4), buyer requirement
     postings ("need 50q onion @ ₹X" — B3), real commission payout via
     verified bank (B6 → RazorpayX), Razorpay split at payment time (B7).
  2. Broker KYC + trust tiers ("Proven Broker") with 48–72h approval SLA (B1).
  3. Ratings backend for completed deals (both sides).
  4. Dispute workflow with SLA wired to admin console.
- **Dashboard summary must show:** active deals by stage (pipeline), new leads,
  offers awaiting response + TTL countdown, deals needing evidence, commission
  earned/pending/paid, network size (farmers/buyers saved).
- **SaaS tiers:** Free (5 active deals, 2% commission) / Pro ₹799/mo (unlimited
  deals, CRM bulk tools, mandi-trend analytics, priority leads) — commission
  never replaced by subscription; they stack.
- **Done when:** a broker runs 50+ concurrent deals with provable commission
  accounting and never shares a phone number off-platform.

### 6.7 DAIRY MANAGER (डेयरी प्रबंधक) — "DairyOS": the milk-collection business app
- **Status:** backend deep (members, FAT/SNF rate charts with versions, payment
  batches, milk sales lifecycle, stock, daily/P&L reports, analytics, demands +
  bids, routes, collection-check, milk-slips). Web: 30 dairy files — console
  suite API-wired + `DairyManagerHomeBoard`. Delivered per `plan/dairy_plan.md`.
- **Core loop:** enroll farmer members → daily collection (qty/FAT/SNF) → rate
  chart → weekly payment batches → sell milk/products → stock → P&L.
- **Build instructions:**
  1. Land the plan's deferred "marketplace vision": RFQ → bid comparison → QR
     collection with grade/qty/photo → escrow release on farmer OTP (per
     dairy spec) — backend `dairy_manager` demands/bids exist; wire the
     farmer-facing acceptance UI.
  2. Route planner + pickup-agent sub-accounts (team seats — ties to R2).
  3. FSSAI licence KYC gate for dairies.
  4. Payment-batch execution via real payouts; per-member statements as PDF;
     farmer sees his milk ledger in his own dashboard (the farmer-link).
  5. Milk-slip SMS/WhatsApp fallback for feature-phone farmers.
- **Dashboard summary must show:** today vs yesterday collection (litres, avg
  FAT/SNF, ₹), members not yet collected, active rate chart + expiry, payment
  batch status, milk sale orders pipeline, stock alerts, P&L this month.
- **SaaS tiers:** Free (25 members, manual batches) / Pro ₹1,499/mo (unlimited
  members, route planner, agent seats, analytics, auto-SMS slips) / Enterprise
  (multi-center unions, API, custom rate engines). Plus 3% milk / 5% produce /
  2% livestock commission on marketplace trades (per spec).
- **Done when:** a village dairy replaces its register books; every member
  farmer sees his own milk money ledger.

### 6.8 INSTRUCTOR / TEACHER (प्रशिक्षक) — "Krishi Academy": the agri-skills LMS app
- **Status:** backend complete LMS (courses CRUD/review, modules,
  purchase/enroll/verify, learn/progress/certificate, reviews, Q&A) + teacher
  suite (students, batches, enquiries, QR attendance, assignments,
  certificates, earnings). Web: monolithic `InstructorHomeBoard.tsx` (demo
  `sess_demo`, English-only) + **no learner-facing course UI** (biggest hole).
- **Core loop:** build course → get verified/published → enroll farmers →
  teach (live + content + QR attendance) → assess → certify → earn.
- **Build instructions:**
  1. Build the learner side on web: course catalog with filters/search, course
     detail (modules, reviews, instructor credential badges), purchase
     (Razorpay + AgriCoins discount), my-learning player with progress,
     certificates with verifiable QR (skill passport), Q&A threads.
  2. Refactor the instructor monolith into routed views; kill `'sess_demo'`;
     real earnings page with payout.
  3. Credential KYC per specialization (DGCA drone licence, degrees, NABARD
     empanelment) + recurring re-verification (per instructor spec).
  4. Batch/group chat rules enforced: instructor broadcast-only; farmers
     cannot DM each other (moderation).
  5. Admin course moderation queue → build into admin console (module 27).
- **Dashboard summary must show (instructor):** enrollments this week, live
  classes today, pending assignment reviews, enquiries awaiting reply, earnings
  + next payout, course rating. **(Farmer-learner):** my courses progress,
  class at 5pm, new courses matching my crops, certificates earned.
- **SaaS tiers / revenue:** course GMV commission (report exists in admin —
  set 15–20%) + instructor Pro ₹499/mo (unlimited courses, analytics,
  featured placement eligibility) + paid workshops in Gyan Hub.
- **Done when:** an instructor earns a living on-platform; a farmer earns a
  verifiable certificate that shows in his profile.

### 6.9 DIRECT BUYER (खरीदार) — "ProcurePro": the industrial procurement app
- **Status:** partially landed per `plan/direct_buyer_plan.md` — contracts
  (formula pricing: fixed/mandi-linked/MSP-linked), `/intelligence` +
  `/price-alerts` routers, web ContractsPage + BuyerHomeBoard. Remaining per
  plan: 3-round counters, QC photos/sliding quality specs, pickup modes, team
  RBAC, settlement tests.
- **Core loop:** define demand + quality spec → post contract → farmers
  grow-for-us → delivery schedules → QC at receipt → settlement → repeat.
- **Core loop distinction (per plan):** this is the *industrial/institutional*
  procurer (processor, exporter, retail chain, HoReCa), NOT a vyapari —
  long-cycle contracts, not spot trade.
- **Build instructions:**
  1. Finish the plan: counter-offer loop (3-round cap), QC with photos and
     sliding per-parameter settlement (BRIX, sucrose, moisture — quality-spec
     templates), pickup mode selection, delivery-schedule → auto-generated
     purchases.
  2. Team sub-accounts with RBAC (admin/procurement/qa/finance — per direct
     buyer spec); this is a flagship Enterprise-tier feature (R2).
  3. KYC: FSSAI for food businesses, IEC/APEDA for exporters, GST; admin
     verification of corporate buyers (superadmin module 07).
  4. Farmer side: "grow-for-us" decision cards (exists per plan — polish:
     expected income vs mandi benchmark, agronomy risk notes, MPIN e-sign).
- **Dashboard summary must show:** active contracts + fulfillment %, deliveries
  due this week, QC exceptions, price alerts on watched crops, spend this
  season, farmer response rate on new contracts.
- **SaaS tiers:** Free (1 active contract) / Pro ₹4,999/mo (5 contracts, QC
  suite, price alerts) / Enterprise ₹24,999/mo (unlimited, team RBAC, API,
  dedicated account manager). Plus 1–2% settlement commission.
- **Done when:** a processor contracts 500 farmers for a season and runs QC +
  settlement without spreadsheets.

### 6.10 e-MARKET CUSTOMER (ग्राहक) — "FarmGate": the direct-from-farm buying app
- **Status:** backend exists (`emarket_customer.py`: demands, quotes, orders,
  inspection, QR handover, planner, favorites). Web: monolithic
  `CustomerHomeBoard.tsx` (2 toolIds, demo fallbacks).
- **Core loop:** post demand → receive binding quotes → escrow deposit →
  delivery/split shipments → inspect & accept → reorder.
- **Build instructions:**
  1. Refactor the monolith; build the consumer-grade browse experience
     (produce near me, farmer storefronts, freshness indicators).
  2. Enforce the spec's guardrails: binding quotes with deposit escrow,
     platform fair-price band display, anti-hoarding purchase caps,
     inspection/acceptance flow with photo evidence, WORM audit retention.
  3. Multi-farmer cart with split-shipment tracking.
  4. Favorites/subscriptions ("weekly 5kg tomatoes from these 3 farmers") —
     recurring revenue adjacency (R2/R3).
- **Dashboard summary must show:** open demands + quote counts, orders in
  transit, inspections pending, spend this month, favorite farmers' new lots.
- **SaaS tiers:** Free for consumers (commission 5% produce-side on sellers per
  spec); Business tier for bulk/institutional buyers (consolidated invoicing,
  creditTermsDays ledgering).
- **Done when:** a household/institution buys weekly produce from named farmers
  with escrow protection both ways.

### 6.11 BANK MANAGER (बैंक प्रबंधक) — "CreditDesk": the agri-lending console
- **Status:** backend exists (`loans.py`: underwriting queue, status machine
  submitted→underReview→approved→disbursed, info-request/respond, EMI schedule,
  LN-YYYY-#### numbering). Web: **zero UI** (placeholder toolIds).
- **Build instructions:**
  1. Build the full web console: queue with filters (status/amount/district),
     application detail (farmer profile, KCC, credit score from `finance.py`,
     land/crop data, repayment history), action bar (approve/reject/request
     info with reason), disbursal execution + schedule view, portfolio
     overview (NPA watch, EMI collection rate).
  2. Partner-bank integration seam: keep underwriting on-platform for NBFC/
     partner banks; referral fee tracking per disbursal (R4).
  3. Farmer mirror: application status tracker (F17), document requests as
     tasks, EMI reminders.
- **Dashboard summary must show:** queue depth by SLA, approvals today,
  disbursals this week, at-risk accounts, portfolio totals.
- **SaaS tiers:** per-seat licensing for partner institutions (Enterprise only,
  ₹2,000/seat/mo) + origination fee per disbursal (R4).
- **Done when:** a bank manager clears his daily queue in-app and every
  decision is audit-logged.

### 6.12 INSURANCE PROVIDER (बीमा) — "ClaimsDesk": the PMFBY operations console
- **Status:** backend exists (`insurance.py` + `insurance_claims.py`: policies,
  rates, schemes, provider console review/survey/disburse/stats; farmer claims
  + appeal). Web: **zero UI**.
- **Build instructions:**
  1. Build provider console: claims queue (intimation → surveyor assignment →
     assessment → approval → DBT), surveyor roster/assignment (A2), geo-tagged
     photo evidence viewer, claim detail with farm map + crop cycle context,
     disbursement execution + stats dashboard.
  2. Farmer mirror (§7.9 cropInsurance module): 72-h intimation with
     guidelines overlay, multi-stage tracker, appeal/resubmit (F15).
  3. Rate-table editor with effective dating (admin, superadmin module 15).
- **Dashboard summary must show:** new intimations (72-h SLA clock), surveys
  pending assignment, claims by stage, DBT pending, rejection/appeal stats.
- **SaaS tiers:** per-claim processing fee + Enterprise console licensing (R4).
- **Done when:** claim cycle time is measurable and every farmer can track his
  claim like a courier package.

### 6.13 COLD STORAGE PROVIDER (कोल्ड स्टोरेज) — "StoreHouse": the warehousing app
- **Status:** backend exists (`post_harvest.py`: provider console —
  facilities/chambers/inward/release; farmer browse/book/apply; AI grading
  stub). Web: **zero UI** (placeholder toolIds).
- **Build instructions:**
  1. Build provider console: facility + chamber management (capacity,
     ₹/q/month pricing), booking requests approve/reject, inward register
     (lot, grade, photo), release workflow, utilization analytics.
  2. Farmer side (§7.14): directory with live capacity, booking with slot
     decrement (F11), warehouse receipts (exist — surface them; they are
     loan-collateral documents → links to 6.11).
  3. Replace grading stub with real Gemini Vision grading (model dir exists)
     behind confidence thresholds + human review.
- **Dashboard summary must show:** chamber utilization %, bookings pending
  approval, lots inward today, releases due, revenue this month.
- **SaaS tiers:** Pro ₹1,999/mo per facility + per-booking fee (R2/R3).
- **Done when:** a facility runs its chamber register digitally and farmers
  hold verifiable warehouse receipts usable for credit.

### 6.14 GAUSHALA + VET (livestock ecosystem companions to 6.7)
- **Status:** gaushala console delivered (cattle CRUD, adoptions/donations with
  80G receipts, expenses, byproducts, analytics — 11/12 web files wired); vet
  network delivered (vets, appointments, campaigns, prescriptions — 7 routes);
  herd registry delivered (animals CRUD).
- **Build instructions:** vet credential verification queue (superadmin module
  19); vet Pro tier ₹299/mo (clinic management, prescription templates,
  campaign tools); donation 80G receipt automation polish; gaushala
  transparency page (public donations ledger → trust → more donations, R6
  adjacency). Herd health tasks (vaccination due) flow into the farmer's
  dashboard via the task engine.
- **Done when:** a farmer's animal health calendar appears in his task
  dashboard automatically; gaushalas fundraise on-platform with receipts.

---

## 7. PHASE 3 — The 24 Platform Modules (complete every one)

> Format: current state → build instructions. "Backend ✅ / Web ❌" means the
> router family works but has no web UI — follow the module playbook (§12).

### 7.1 Mandi Prices (`mandi`)
Backend ✅ (prices, mandis, vyapari rates, compare, history) / Web ✅
(MandiPage in trade suite).
- Add price-history charts screen (F13 — endpoint exists), price alerts UI
  (backend `/price-alerts` landed — build management page + task emission),
  Smart Mandi Selection calculator (net-after-transport — needs transport fare
  estimate join), Agmarknet/eNAM sync job hardening, audio readout.

### 7.2 AI Advisory (`advisory`)
- **Task-engine emission deferred (2026-10-03, phase-01 WS-05):** no working web screen exists for this module yet, so emitting a dashboard task would dead-end at a placeholder (robust §4.3 bans 'coming soon' from a task). Emission wires in when this module's web UI lands (phases 02–05).
Backend ✅ (saturation, sowing-intent, disease-scan, pest radar, NPK — some
hardcoded base prices) / Web ❌.
- Build the 5-tab advisory hub: Market Saturation (with opt-in consent),
  Disease Scan (camera upload → Gemini Vision — real impl exists; add scan
  history per plot, F10), NPK calculator, Pest Radar (5 km), Kisan Mitra
  launcher. Replace hardcoded base prices with mandi-linked data. Emit
  advisory tasks into the task engine.

### 7.3 Marketplace (`marketplace`)
Backend ✅ (products, certificates, cart, reviews) + orders/Razorpay /
Web ❌.
- Build full e-commerce: catalog (categories: seeds/fertilizer/pesticide/
  tools/vehicles), product detail with QR authenticity certificate, cart +
  checkout (real Razorpay from Phase 0), order tracking timeline (backend
  exists), returns, wishlist, coupons, address book (X6), reviews (X7),
  BNPL placeholder → partner integration. Seller-facing product management
  (`seller_products.py`, `user_products.py` routers exist — build UIs).

### 7.4 Buyers & Contracts (`buyers`)
Backend ✅ (contracts with e-sign + deliveries; direct buyer suite) /
Web ✅ (ContractsPage + farmer contracts).
- Polish: contract template library, delivery-schedule calendar view,
  contract performance analytics, MSP reference data endpoint + display (F14).

### 7.5 Profit & Loss / Farm CEO (`profitLoss`)
Backend ✅ (`pnl.py` dashboard, break-even; `diary_analytics.py`) /
Web ✅ (FarmCeoPage — but has `?? <number>` fallbacks).
- Strip demo fallbacks; auto-feed P&L from completed transactions across all
  marketplaces (a sold lot, a paid lease, a freight income should appear
  without manual entry); per-crop statements; pre-sowing break-even
  calculator; export (CSV exists in `lib/csv.ts` — add PDF + Tally-compatible
  export, G10).

### 7.6 Water Intelligence (`water`)
Backend ✅ (schedules, groundwater, canal rotation, PMKSY calc) / Web ❌.
- Build plot-wise irrigation schedule view, CGWB groundwater gauge
  visualization, canal rotation calendar, PMKSY 55% subsidy calculator +
  deep-link to scheme application. Emit irrigation tasks (weather-aware).

### 7.7 Government Schemes (`schemes`)
- **Task-engine emission deferred (2026-10-03, phase-01 WS-05):** no working web screen exists for this module yet, so emitting a dashboard task would dead-end at a placeholder (robust §4.3 bans 'coming soon' from a task). Emission wires in when this module's web UI lands (phases 02–05).
Backend ✅ (+ eligibility service) / Web ❌.
- Build scheme discovery (matched-to-profile first), detail with eligibility
  checklist, dual apply paths (in-app tracked application vs official portal
  deep-link), deadline reminders → task engine, document vault integration.
  Admin scheme editor (A3) into admin console.

### 7.8 Finance (`finance`)
- **Task-engine emission deferred (2026-10-03, phase-01 WS-05):** no working web screen exists for this module yet, so emitting a dashboard task would dead-end at a placeholder (robust §4.3 bans 'coming soon' from a task). Emission wires in when this module's web UI lands (phases 02–05).
Backend ✅ (credit score, loan calc, KCC, apply/list) / Web ❌.
- Build credit score page (score + tier + improvement tips), loan marketplace
  (compare offers), EMI calculator, KCC visual card, application wizard +
  status tracker (F17). This is the farmer face of persona 6.11.

### 7.9 Crop Insurance PMFBY (`cropInsurance`)
- **Task-engine emission deferred (2026-10-03, phase-01 WS-05):** no working web screen exists for this module yet, so emitting a dashboard task would dead-end at a placeholder (robust §4.3 bans 'coming soon' from a task). Emission wires in when this module's web UI lands (phases 02–05).
Backend ✅ / Web ❌.
- Build 4 tabs per spec: policy passbook + e-certificate, 72-h claim
  intimation (geo-tagged photos + guidelines overlay), premium calculator,
  claim tracker with appeal path (F15). Farmer face of persona 6.12.

### 7.10 Land & Legal 7/12 (`landLegal`)
Backend ✅ (search/pdf/import — mock adapter) / Web ❌.
- Build record search (Gat no./village), 7/12 vs 8A viewer, PDF
  view/download, auto-import area into farm profile. Real Mahabhulekh adapter
  behind the interface (Phase 0 honesty rule until then).

### 7.11 FPO Engine (`fpo`)
Backend ✅ (pools, machinery) / Web ❌.
- Build FPO discovery + join-request flow (F19), group-buy pool cards with
  progress bars, shared machinery calendar (joins with equipment module),
  non-member vs member states. Admin FPO verification (A8).

### 7.12 Women Farmer Hub (`womenFarmer`)
Backend 🟡 (hardcoded SHG/garden data) / Web ❌.
- Replace hardcoded data with real collections; build 4 tabs (SHG savings
  ledger with meeting workflow, kitchen-garden planner, livestock health —
  joins herd registry, home-enterprise income tracker with product listings
  into marketplace). Women-mode rose theme overlay on web. SHG federation =
  future Enterprise tier.

### 7.13 Climate & Carbon (`climate`)
- **Task-engine emission deferred (2026-10-03, phase-01 WS-05):** no working web screen exists for this module yet, so emitting a dashboard task would dead-end at a placeholder (robust §4.3 bans 'coming soon' from a task). Emission wires in when this module's web UI lands (phases 02–05).
Backend 🟡 (hardcoded) / Web ❌.
- Real carbon-potential calculator (per-plot, practice-based), resilient
  variety catalog, carbon-program enrollment pipeline (partner MRV
  integration placeholder), tree-module join. Honest "estimates, not credits"
  labeling until MRV exists.

### 7.14 Post-Harvest (`postHarvest`)
- **Task-engine emission deferred (2026-10-03, phase-01 WS-05):** no working web screen exists for this module yet, so emitting a dashboard task would dead-end at a placeholder (robust §4.3 bans 'coming soon' from a task). Emission wires in when this module's web UI lands (phases 02–05).
Backend ✅ (cold storage, warehouse receipts, grading stub) / Web ❌.
- Farmer face of persona 6.13: directory, booking (F11), my bookings,
  warehouse receipts vault, AI grading flow (photo → grade → recommended
  price → one-tap "list as lot" — beautiful farmer-link loop).

### 7.15 Krishi Ratna Gamification (`krishiRatna`)
- **Task-engine emission deferred (2026-10-03, phase-01 WS-05):** no working web screen exists for this module yet, so emitting a dashboard task would dead-end at a placeholder (robust §4.3 bans 'coming soon' from a task). Emission wires in when this module's web UI lands (phases 02–05).
Backend ✅ (coins, rewards, leaderboard) / Web ❌.
- Build coin wallet (ledger, tiers, streaks, badges), rewards store with
  redemption flow, leaderboard. Abuse guards (X11): 200 coins/day earn cap,
  ≤50%-of-order redemption cap, reconcile job, config in `platform_config`.
  Coins must never be redeemable for cash (regulatory).

### 7.16 Refer & Earn (`referEarn`)
- **Task-engine emission deferred (2026-10-03, phase-01 WS-05):** no working web screen exists for this module yet, so emitting a dashboard task would dead-end at a placeholder (robust §4.3 bans 'coming soon' from a task). Emission wires in when this module's web UI lands (phases 02–05).
Backend ✅ (attribution, milestones) / Web ❌.
- Build referral hub (code card, WhatsApp share deep-link, milestone tracker,
  leaderboard). Verify register wizard captures referral code (F1). Referral
  credit only after invitee's first completed transaction (anti-fraud, per
  dairy/direct-buyer specs).

### 7.17 Farm Diary (`farmDiary`)
Backend ✅ (cashbook, analytics, PDF) / Web ✅ (CashbookPage — has
  fallbacks).
- Strip fallbacks; photo attachments on entries (F18, ≤3, signed URLs);
  auto-entries from platform transactions; category/crop/month analytics
  charts; PDF report.

### 7.18 Agri News (`agriNews`)
Backend ✅ (`content.py`) / Web ❌.
- Build news feed (category filters, impact rating, audio readout, WhatsApp
  share), breaking banner. Admin CMS in admin console (module 20).

### 7.19 Live Channels (`liveChannels`)
Backend 🟡 (seeded HLS placeholders) / Web ❌.
- Build channel grid + player page + schedule + live chat (moderated).
  Streaming infra decision (X16): start with embedded licensed streams
  (DD Kisan etc.), platform-originated streams deferred.

### 7.20 Livestock & Dairy (`livestockDairy`)
Backend ✅ / Web ✅ (hub + consoles delivered).
- Personas 6.7 and 6.14 cover the business consoles; this module is the
  farmer-facing directory/marketplace entry — ensure it links out to all
  four sub-apps and emits herd-health tasks.

### 7.21 Gyan Hub (`gyanHub`)
Backend ✅ (workshops, expert talks, videos, blogs) / Web ❌.
- Build knowledge home: paid workshops (Razorpay + AgriCoins discount),
  expert talks (+25 coins), video library, blogs. Content feeds into
  courses (6.8) — one CMS, two storefronts.

### 7.22 Tree Plantation & Biofuel (`treePlantation`)
Backend ✅ (plantations, carbon estimate, NGOs, schemes) / Web ❌.
- Build plantation tracker, NGO directory with free-sapling requests
  (superadmin module 21 approval flow), biofuel economics pages, care guides,
  join with climate module for carbon estimates.

### 7.23 Equipment Rental — farmer face (`equipment`)
Backend ✅ / Web ❌ (farmer side).
- Covered in 6.5 build item 2 — listed here so the module is not missed.

### 7.24 All-Tools launcher + search
- **KYC / account task emission deferred (2026-10-03, phase-01 WS-05):** the KYC status screen (`/dashboard/profile`) is still a placeholder; tasks emit once the phase-04 KYC status page ships.
- The persona-filtered tools grid exists on web (`lib/dashboard.ts` registry)
  — after Phases 2–3 every tile must resolve to a real page (zero "coming
  soon").
- **Global search (F3/G4):** `GET /v1/search?q=` across schemes, products,
  news, crops, courses, lots + a results page grouped by module.

---

## 8. PHASE 4 — Cross-Cutting Platform Services

1. **Chat (X2):** booking-gated rooms exist — add the Chats hub to all
   personas' nav, unread badges, moderation pipeline (phone/UPI/URL regex,
   strike ladder), image OCR/EXIF strip per spec.
2. **Notifications:** per-token FCM push (currently topic pings only — X4
   notes), deep-link map (X3) wired to task deepLinks, notification
   preferences center (G6), SMS fallback via MSG91/Twilio + DLT templates
   (provider stub until DLT registration).
3. **Trust & safety (G9):** report/block exists (X9) — build UI surfaces;
   ratings for every completed transaction type (X8); trust tiers per persona;
   fraud heuristics (collusion rings, price manipulation vs mandi band).
4. **Consent & privacy (X17):** consent center UI (backend `consents` exists),
   DPDP-compliant data export (F23), account deletion (exists — verify web
   flow), legal pages localized (X18 — currently English-only hardcoded).
5. **Support:** help center + `expert_tickets`/handoff threads as in-app
   support threads (F20); FAQ CMS.
6. **Offline/PWA (G7):** service worker, app manifest, installable; offline
   drafts for forms (X20) synced via existing `/sync`; bundle diet — route-level
   `React.lazy`, target <400 KB first load.
7. **i18n completion (G8):** finish the 28 partial locales (ta has 85/436
   keys…), module locale pairs for every new view, CI parity gate.
8. **Analytics taxonomy (X13):** one event schema, fired from website,
   dashboard for north-star metrics.
9. **B2B API platform (G11):** API keys + scoped read endpoints for partners
   (mandi data, saturation insights) — last, after consent center is proven.

---

## 9. PHASE 5 — Admin Console (web, on the website codebase)

> No separate Flutter admin app in this program. Build `/admin/*` into
> `website/` as a role-gated section (dark utilitarian theme), implementing the
> 27-module superadmin blueprint. The 483-line `admin.py` backend is the seed;
> extend it per module.

- **Foundation:** unified admin auth (Phase 0.2), RBAC tiers (superadmin /
  compliance_officer / finance_admin / agronomist / operations_lead /
  content_moderator), universal data-grid component (search/filter/paginate/
  bulk), detail drawer with raw JSON + audit history, two-step safeguards
  (reason + admin MPIN), immutable `audit_logs`, maker-checker > ₹10,000.
- **P1 (security):** users & personas, KYC queue (real, replaces hardcoded),
  sessions, feature flags + app-config/force-update, broadcast by segment (A4),
  moderation queue (A6), DPDP consent audit.
- **P2 (commercial):** mandi rate approvals (±15% band), lots & B2B deals,
  marketplace orders/refunds, corporate buyer verification, transport fleet,
  equipment slots, **settlements & payout console (A5 — run weekly batches,
  approve holds)**.
- **P3 (agronomy/AI):** land leasing disputes, advisory/disease model ops,
  chatbot transcripts + prompt config + expert roster SLA, 7/12 gateway
  health, water/canal, climate/cold storage.
- **P4 (financial):** banking/loans oversight (penny-drop override), insurance
  claims + surveyor assignment + rate tables.
- **P5 (ecosystem):** FPO verification, livestock/vet credentials, content
  CMS/live channels/workshops, tree/NGO sapling requests, gamification
  mint/burn + referral fraud, women SHGs, instructor course moderation (module
  27: publish/reject/feature + GMV/commission report).

---

## 10. Pricing & Packaging Summary (the SaaS shelf)

| Persona | Free | Pro (₹/mo) | Enterprise | Commission (always) |
|---|---|---|---|---|
| Farmer | everything core | — | — | 0% (never) |
| Landlord | 1 plot/1 lease | 299 | custom | — |
| Transporter | 1 vehicle | 499 | fleet/API | 10% |
| Vyapari | basic khata | 999 | multi-shop | 2% min ₹50 |
| Equipment Owner | 1 machine | 399 | fleet | 12% |
| Broker | 5 deals | 799 | — | 2% (0–10 configurable) |
| Dairy Manager | 25 members | 1,499 | union | 3/5/2% marketplace |
| Instructor | 1 course | 499 | institution | 15–20% course GMV |
| Direct Buyer | 1 contract | 4,999 | 24,999 | 1–2% settlement |
| e-Market Customer | full | business invoicing | — | 5% seller-side |
| Bank/Insurance/ColdStorage | — | console seats 2,000 | custom | origination/processing fees |

Commission config lives in `platform_config/settlements` (extend the existing
doc); effective-dated, versioned, admin-editable with maker-checker.

---

## 11. Execution Roadmap

| Phase | Contents | Depends on |
|---|---|---|
| **0. Foundation** (wks 1–3) | §3.1–3.6: security, money rails, KYC, billing, plumbing, fix 45 red tests, CI | — |
| **1. Dashboard** (wks 3–5) | §4: task engine + Action Center; every existing module emits tasks | 0 |
| **2A. Spokes already strong** (wks 4–8) | Transporter 6.3, Vyapari 6.4, Broker 6.6 close-out lists; refactor Landlord 6.2 + Equipment 6.5 monoliths | 0, 1 |
| **2B. Console personas** (wks 6–10) | Bank 6.11, Insurance 6.12, Cold Storage 6.13 consoles (backend exists, pure web build); Dairy marketplace vision 6.7; Direct Buyer finish 6.9 | 0, 1 |
| **2C. Knowledge & consumer** (wks 8–12) | Instructor LMS learner side 6.8, e-Market 6.10, Gyan Hub 7.21, News 7.18, Live Channels 7.19 | 0, 1 |
| **3. Module sweep** (wks 6–14, parallel) | §7 modules in order: 7.3 marketplace, 7.7 schemes, 7.8 finance, 7.9 insurance, 7.2 advisory, 7.10 land, 7.11 FPO, 7.14 post-harvest, 7.6 water, 7.15 coins, 7.16 referrals, 7.12 women, 7.13 climate, 7.22 tree | 0, 1 |
| **4. Cross-cutting** (wks 10–16, parallel) | §8: chat hub, push+deep links, trust & safety, consent center, PWA, i18n parity, search | 1 |
| **5. Admin console** (wks 8–18, parallel) | §9 in its P1→P5 order | 0 |
| **6. Scale & moat** (wks 16–20) | B2B API, performance hardening, Firestore cost audit, load testing, DPDP audit, launch checklist | all |

**Demo-cut for investors (fastest path):** Phase 0 money rails → farmer posts a
lot → vyapari pays via escrow → transporter delivers with POD → commission
settles to platform → dashboard shows the whole story as completed tasks →
dairy manager upgrades to Pro plan (R1 + R2 + R3 in one narrative).

---

## 12. Appendix A — Reusable Module Playbook (website)

For every "backend ✅ / Web ❌" item above:
1. Add typed API module in `website/src/lib/api/` mirroring the router
   (document backend quirks in comments, as existing modules do).
2. Add `en` + `hi` locale pairs; zero hardcoded strings; run parity check.
3. Add theme CSS file if the module has distinct identity (follow
   `theme/trade.css`, `theme/dairy.css` pattern).
4. Build views + register in the `<DOMAIN>_PAGES` registry; add deep routes
   in `App.tsx` (the two one-line edits).
5. Wire the module's tasks into `emit_task()` backend-side and the dashboard
   summary grid client-side.
6. Add the module's card to the persona's dashboard config in
   `lib/dashboard.ts` (respecting the ACL matrix).
7. Verification gate: `pytest` green (backend touched) + `tsc --noEmit` +
   `pnpm build` + manual flow from dashboard task → completion.

## 13. Appendix B — Hard Rules (do not violate)

1. No new demo backdoors; no `?? <hardcoded>` fallbacks in new code.
2. No persona feature without a `farmerId` linkage story.
3. No money movement outside the escrow/settlement rails.
4. No phone numbers, UPI IDs, or external links in any chat surface.
5. No paywall on the farmer's core grow-sell-insure loop.
6. No English-only screens; no `alert()`/`prompt()`/`confirm()` in new UI —
   use the toast/modal system (build one first if missing).
7. No endpoint without the standard error envelope, pagination, and (for
   writes) idempotency-key support.
8. No admin action without `audit_logs` entry + reason.
9. Backend test suite must be green before any phase is called done.
10. Every module in this document ships or gets an explicit, dated deferral
    note in this file — silence is not allowed.
