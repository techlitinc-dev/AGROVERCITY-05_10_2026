# understand.md — What I Understand About AGROVERCITY (Kisan Setu)

> Written 2026-10-02, before implementing `robust.md`. This is my verified mental
> model of the repo — what exists, what works, what's fake, and what the product is
> supposed to become. Sources: `features.md`, `missing.md`, `features/*.md`,
> `plan/*.md`, `docs/overview/*`, `superadmin-instructions.md`, and a full read of
> `backend/app/` and `website/src/`.

---

## 1. What the product is

AGROVERCITY ("Kisan Setu" — किसान सेतु, "Farmer's Bridge") is an Indian agri
**super-app**: one account, many agri-business personas, Hindi/Marathi-first,
built for semi-literate users (large tap targets, audio readouts, icon-heavy UX).

The critical design insight: **every persona orbits the farmer**. The farmer is
the super-user with access to all modules; every other persona exists to sell a
service TO the farmer or buy produce FROM the farmer:

| Counterparty persona | Transaction with the farmer |
|---|---|
| Farm Landlord | Leases land to the farmer |
| Transporter | Hauls the farmer's produce farm → mandi/buyer |
| Seller / Vyapari | Buys the farmer's produce at the farm gate |
| Equipment Owner | Rents machines to the farmer |
| Broker / Dalal | Mediates the farmer's deals for commission |
| Dairy Manager | Collects the farmer's milk daily |
| Instructor / Teacher | Teaches the farmer skills (paid courses) |
| Direct Buyer | Contracts the farmer to grow-for-them (industrial procurement) |
| e-Market Customer | Buys small lots directly from the farmer |
| Bank Manager | Underwrites the farmer's loans |
| Insurance Provider | Processes the farmer's PMFBY claims |
| Cold Storage Provider | Stores the farmer's harvest |
| Gaushala / Vet | Cares for the farmer's livestock |

So the app is not "an app with roles" — it is **a family of ~13 two-sided
marketplaces, each a full-fledged application in itself**, all sharing one
identity, one wallet, one notification stream, one dashboard shell.

## 2. What actually exists today (ground truth)

### Backend (`backend/`) — FastAPI + Firestore, much bigger than the docs suggest

- **68 routers, ~430 endpoints** under `/v1`; ~90 Firestore collections; 54
  Pydantic model files; `backend/tests/` has **~744 tests (698 pass, 45 currently
  failing** — purchases/transport/demands-offers suites are red, partly async
  fixture issues).
- Auth: Firebase phone OTP on client → `POST /auth/firebase-verify` → backend
  HS256 JWT pair + 4-digit MPIN (bcrypt). 14 valid profiles; per-persona
  `role_profiles` subcollection; route ACL in `services/profile_routes.py`.
- Already-implemented real business logic (not mock): trade engine (lots →
  offers/counters → purchases lifecycle with escrow-doc, handover OTP, QC,
  invoice), broker deal desk with commission math, transport TMS (loads, bids,
  trips, bilty, weighbridge, POD, 10% settlements), equipment slot engine,
  full dairy suite (FAT/SNF rate charts, payment batches, milk sales, stock,
  P&L), gaushala console (80G receipts), vet network, land leasing (listings,
  requests, counter-offers, agreement PDF via ReportLab, escrow milestones),
  loans (bank-manager underwriting state machine), insurance claims (provider
  console), cold storage (provider console), courses/LMS with instructor
  earnings, contracts (contract farming with e-sign), chat (booking-gated,
  event-sourced), notifications inbox, referrals + AgriCoins gamification,
  diary/cashbook + P&L engine, `/intelligence` (cross-persona ops summary) and
  `/price-alerts`.
- **Commission engine exists**: `services/settlements.py` with
  `platform_config/settlements` (transport 10%, equipment 12%, broker 2%).

### Backend — what's fake / dangerous today

- **Demo backdoors everywhere**: MPIN "1234" master password, `dev-`/`demo-`
  tokens accepted, `/auth/quick-login` with 11 hardcoded accounts, Razorpay
  signature `"dev"` accepted, fake order IDs without keys.
- **Stub adapters as production paths**: bank penny-drop always returns
  verified, geo is a mock, 7/12 land-records is a mock (no Mahabhulekh adapter),
  AI grading is a stub, weather falls back to a hardcoded fixture, FCM push
  per-token not implemented (topic pings only), SMS is a TODO.
- **No SaaS layer at all**: no subscriptions, no plans, no billing, no metering
  — nothing charges anyone for using the platform. Monetization = commission
  settlements only.
- **No real money movement**: Razorpay only for marketplace orders/course
  purchases; no webhooks, no payouts (RazorpayX), no real escrow provider.
- Ops gaps: CORS `*`, no rate limiting, JWT without revocation, fake pagination
  (limit-100-then-slice in Python), two **conflicting admin-auth mechanisms**
  (`core/deps.py` Firebase-claim vs `routers/admin.py` flag + hardcoded UIDs),
  hardcoded admin KYC queue, JWT secret default `"dev-secret-change-me"`.

### Website (`website/`) — React 18 + TS + Vite, the primary web client

- 77 routes, ~130 view files, 31 typed API modules ("verified against backend"),
  Zustand persisted stores, custom `t()` i18n (30 locales registered, **only
  en/hi complete**), hand-rolled CSS. Build is green. No tests, no CI, no PWA,
  no ErrorBoundary, no code-splitting (~1.4 MB single bundle).
- **Fully real (API-wired)**: auth/onboarding, entire trade suite (22 views),
  transport (14), broker, farmer offers/contracts, direct buyer + contracts,
  dairy/gaushala/vetnet/animals suites, cashbook, P&L, notifications, bank
  accounts.
- **Five "SaaS persona" monolithic home boards** (~700–900 lines each, API-wired
  but riddled with `?? <hardcoded number>` demo fallbacks, `alert()`/`prompt()`
  for errors, English-only): Landlord, Equipment Owner, Instructor, Customer,
  Dairy Manager.
- **~40 toolIds render a "coming soon" skeleton** — the website surfaces only
  about a third of the backend. The entire money/protection stack (loans,
  insurance, schemes, vault), e-market (marketplace, orders, wishlist, coupons),
  content (gyanHub, news, live channels, advisory, chatbot), growth (referEarn,
  krishiRatna, womenFarmer, fpo), land (landLegal, water, tree, postHarvest,
  climate), and settings/help have **backend endpoints but zero web UI**.
- **DashboardHome is static** — persona metric pills and "live" cards are
  hardcoded placeholders. There is no unified task summary; the backend
  `/intelligence` ops-summary endpoint exists but is barely surfaced.
- **No admin UI at all**, despite a 483-line `admin.py` backend (KYC queue, user
  management, course moderation, loan oversight) and a 27-module superadmin
  blueprint in `superadmin-instructions.md` + `docs/superadmin-instructions/`.

### The docs corpus

- `features.md` — master spec: 24 feature modules + 6 personas, from the Flutter
  prototype (read-only port source).
- `missing.md` — gap audit: per-persona missing features (F/L/T/S/E/B IDs),
  cross-cutting (X1–X22), admin (A1–A10), 16 P0 launch blockers.
- `features/*.md` — 9 marketplace specs (broker, dairy, direct buyer, e-market
  customer, equipment, landlord, instructor, transporter, Vyapari) all sharing
  one template: **100% in-app comms, chat unlocks post-booking, no phone/VoIP
  sharing, escrow wallet, commission engine, KYC matrices, admin dispute
  workflows, strike ladders**.
- `plan/*.md` — delivery logs: seller, transporter, broker, dairy phases **all
  landed** (Oct 1–2, 2026); direct-buyer partially landed.
- `superadmin-instructions.md` — 27 admin modules, RBAC tiers (superadmin,
  compliance_officer, finance_admin, agronomist, operations_lead,
  content_moderator), audit-log standards, maker-checker for financial
  overrides, 5-phase build plan.
- `website/missing_all_features.md` + `missing_featiures_plan.md` — the web-side
  atlas: 12 complete modules, 39 backend-ready router families with no UI, 11
  greenfield gaps (G1 payments/escrow … G11 B2B API), and a phased execution
  plan (A–H, ~105 dev-days) with a "module playbook".

## 3. What the user asked for (my reading)

1. **`robust.md`** — detailed, module-by-module instructions to convert the
   **backend + website only** (not the Flutter apps) into a million-dollar SaaS.
   No module may be skipped.
2. Each persona-profile must be treated as a **full-fledged application in
   itself** (farmer↔transporter, farmer↔landlord, etc.), and all of them stay
   **linked to the farmer** as the center of gravity.
3. **The dashboard must contain a summary of all tasks** so the farmer can
   review every option at a glance — and the **same unified task-summary
   dashboard is required for every profile**. Today DashboardHome is static
   placeholder cards, so this is a first-class build item, not a tweak.
4. `understand.md` (this file) records the understanding first; implementation
   comes later.

## 4. My key conclusions going into robust.md

- **We are not starting from zero** — we are productionizing. The correct plan
  is 30% hardening (kill demo backdoors, real payments/payouts, KYC, security),
  50% surfacing (39 backend router families need web UI), 20% greenfield (SaaS
  billing, task engine, admin console, search, PWA).
- The "million-dollar SaaS" revenue model must be **layered**: transaction
  commissions (engine exists) + SaaS subscription tiers for business personas
  + fintech float/referral + ads + paid courses/workshops + data insights.
  Subscriptions/billing is the single biggest missing piece.
- The **unified task dashboard** should be built once as a shared "Daily
  Briefing / Action Center" (backend `/v1/tasks` engine fed by every module +
  the existing `/intelligence` summary) and rendered per-persona — farmer's
  version aggregates across ALL his linked profiles too.
- Every persona build-out must follow the shared marketplace template from
  `features/*.md` (in-app comms, escrow, commission, KYC, dispute lane) so the
  platform stays coherent as 13 mini-apps instead of 13 codebases.
- Order of execution matters: security/money foundation first, then the task
  dashboard (it's the retention hook), then persona-by-persona completion,
  then admin console, then polish (PWA, 30-locale parity, scale hygiene).
