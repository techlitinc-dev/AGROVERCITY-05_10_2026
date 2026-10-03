# Phase 04 — Knowledge & Consumer Personas — Build Instructions

> Self-contained execution sheet. Read the phase readme.md first.
> Global rules (execution-plan/README.md §3) apply to every workstream —
> the ones most at risk are repeated inline per workstream.
> Execute workstreams in numbered order (WS-01…WS-05 are web-heavy and may
> pair-run; WS-06 lands last because it decorates WS-01 surfaces).

## Repo orientation

- Backend: FastAPI + Firestore — routers `backend/app/routers/`, services
  `backend/app/services/`, tests `backend/tests/`. Routers are mounted in
  `backend/app/main.py` under `/v1` (e.g. `courses.py`, `teachers.py`,
  `content.py`, `gyan.py` have no own prefix; `teachers.py` has
  `prefix="/teachers"`, `emarket_customer.py` has `prefix="/customer"`,
  `gamification.py` has `prefix="/gamification"`).
- Website: React + TS + Vite — API wrappers `website/src/lib/api/`, views
  `website/src/views/`, i18n `t()` with per-domain locale pairs
  (`website/src/lib/i18n/locales/en.trade.ts` + `hi.trade.ts` pattern),
  persona/module registry `website/src/lib/dashboard.ts`, routes
  `website/src/App.tsx` (generic tool route `/dashboard/p/:toolId`, line ~139).
  `ToolShell` lives at `website/src/components/trade/ToolShell.tsx`.
- Existing monoliths to refactor: `website/src/views/instructor/InstructorHomeBoard.tsx`
  (855 lines, hardcoded `fetchSessionAttendance('sess_demo')` at line ~100) and
  `website/src/views/customer/CustomerHomeBoard.tsx` (827 lines, 9 `??`
  fallbacks). Page registries: `views/instructor/index.tsx`
  (`INSTRUCTOR_PAGES`), `views/customer/index.tsx` (`CUSTOMER_PAGES`).
- Existing API wrappers to extend: `website/src/lib/api/instructorAcademy.ts`,
  `website/src/lib/api/emarketCustomer.ts`. Wrappers to create: `courses.ts`,
  `gyan.ts`, `content.ts` (all new).
- Website deps (verify at execution; add if absent): `hls.js` (channel player),
  `qrcode` (certificate QR). Razorpay checkout helper comes from phase-00
  money rails — if no web checkout helper exists yet, load Razorpay
  `checkout.js` and wrap it once in `website/src/lib/api/` (do not scatter
  `window.Razorpay` across views).
- Verify every path you cite exists (Glob/Read) before writing it down.

## WS-01 — Learner side 'Krishi Academy'

**Source:** robust.md §6.8 item 1, §7.15 (X11 coin rules); ai.md §5.4 step 4 ·
**Goal:** give farmer-learners the full LMS loop on web: discover → purchase →
learn → certify → skill passport.

**Read first:**
- `backend/app/routers/courses.py` (all learner endpoints; mounted at `/v1`)
- `backend/app/routers/teachers.py:493` (`GET /v1/teachers/certificates/verify/{certificate_id}`)
- `backend/app/services/coins.py`, `backend/app/services/payments.py`
- `backend/app/routers/gamification.py` (`GET /v1/gamification/status` — coin balance)
- `website/src/lib/api/instructorAcademy.ts` (wrapper conventions)
- `website/src/lib/dashboard.ts` (instructor/farmer tool + tile config)
- `website/src/App.tsx` (PlaceholderPage at `/dashboard/profile`, lines ~413–417)

**Backend facts (verified — do not rebuild):**
`courses.py` already provides: `POST /v1/courses`, `GET /v1/courses` (list),
`GET /v1/courses/mine`, `GET /v1/courses/purchased/list`,
`GET /v1/courses/my-learning`, `GET /v1/courses/{course_id}`,
`POST /v1/courses/{course_id}/purchase` (Razorpay order via
`create_razorpay_order(int(remaining * 100), …)` — integer paisa; AgriCoins
discount validated as `coinsToRedeem ≤ min(course.coinsDiscountAllowed, fee)`),
`POST /v1/courses/purchases/verify` (signature verify),
`POST /v1/courses/{course_id}/enroll`, `GET /v1/courses/{course_id}/learn`,
`POST /v1/courses/{course_id}/lessons/{lesson_id}/progress`,
`GET /v1/courses/{course_id}/certificate` (returns
`verificationUrl: https://agrovercity.com/verify/cert/{cert_id}`),
reviews (`POST`/`GET /v1/courses/{id}/reviews`), Q&A
(`POST`/`GET /v1/courses/{id}/questions`, `POST …/questions/{qid}/answers`),
module CRUD. Collection: `courses` (fields incl. `coinsDiscountAllowed`,
fee in rupees, modules sub-docs).

**Steps:**
1. Create `website/src/lib/api/courses.ts` (new) mirroring every endpoint above;
   document backend quirks in comments as existing wrappers do. Include
   `getCoinBalance()` from `GET /v1/gamification/status`.
2. Create `website/src/views/academy/` (new) with routed pages:
   - `CourseCatalogPage` — filters (category/crop, level, language, price,
     free/paid) + free-text search against `GET /v1/courses`; course cards show
     fee, rating, instructor credential badges, coins-discount eligibility.
   - `CourseDetailPage` — modules/lessons, reviews list + add-review,
     instructor profile + credential badges (DGCA/NABARD/degree from WS-02),
     Q&A threads (post question, instructor/learner answers).
   - `PurchaseSheet` — coins slider capped at
     `min(coinsDiscountAllowed, feeRupees, floor(feeRupees * 0.5), balance)`
     (X11 ≤50%-of-order cap — see step 6), Razorpay checkout for the remainder
     via the phase-00 checkout helper, then `POST /v1/courses/purchases/verify`,
     then auto-`enroll`.
   - `MyLearningPage` — from `GET /v1/courses/my-learning`, progress bars.
   - `CoursePlayerPage` — lesson list from `GET …/learn`, per-lesson progress
     POST, completion → certificate CTA.
   - `CertificatePage` — certificate detail + QR (add `qrcode` dep) encoding
     the `verificationUrl`; public route `/verify/cert/:certificateId` calling
     `GET /v1/teachers/certificates/verify/{id}`.
3. Backend: make the certificate-verify endpoint publicly reachable (it is for
   employers/third parties): if it currently requires auth, allow unauthenticated
   read of the certificate's public fields (course title, learner name, issue
   date, credential) — no PII beyond name. Add/adjust a test.
4. Skill passport: replace the `/dashboard/profile` PlaceholderPage slice (or
   the real profile view if it has landed) with a "Certificates / Skill
   Passport" section listing earned certificates (from
   `GET /v1/courses/purchased/list` + certificate endpoint) with QR links.
   Global rule: farmer linkage — every certificate carries `farmerId`.
5. Dashboard wiring (phase-01 task engine): emit learner tasks — course
   progress nudge, "class at 5pm" (live session), "new courses matching my
   crops" (from WS-06 when live; deterministic fallback: newest in farmer's
   crop categories), "certificate earned". Add the learner summary grid items:
   my courses progress, certificates earned. Register `courses`/`courseDetail`
   toolIds to the real pages in `dashboard.ts` + `App.tsx` deep routes.
6. X11 enforcement (coordinate with phase-05 which owns the §7.15 wallet UI):
   - `coins.py::award_coins` currently has **no daily cap** — add a
     config-driven 200 coins/day earn cap (config in `platform_config`, e.g.
     `platform_config/gamification.dailyEarnCap`, default 200), applied to all
     positive awards.
   - Redemption: enforce `coinsToRedeem ≤ 50% of order value` server-side in
     `courses.py` purchase (and `gyan.py` workshop enroll, WS-04) in addition to
     the existing `coinsDiscountAllowed`/fee cap; read the 50% from config.
   - Coins are never redeemable for cash — do not add any cash-out path.
7. i18n: new locale pair `en.academy.ts` + `hi.academy.ts` following the
   `en.trade.ts` pattern. **No hardcoded strings — `t()` en+hi; no
   `alert()`/`prompt()`/`confirm()`** (use the toast/modal system).

**Acceptance:**
- A farmer can find a course via filter+search, buy it with Razorpay + a coin
  discount (slider correctly capped), watch lessons, see progress persist, and
  download/share a certificate whose QR opens the public verify page.
- Certificate appears in the farmer profile skill passport.
- Coin caps provably enforced: test where `coinsToRedeem > 50%` of fee → 422
  with the standard error envelope `{"error":{code,...}}`; 201st coin earned in
  a day is rejected/capped.
- Purchase/enroll/progress writes accept `Idempotency-Key`; list endpoints
  paginate.

**Verification:**
- `cd backend && .venv/bin/python -m pytest -q` green (add
  `backend/tests/test_academy_learner.py` covering purchase+verify, coin caps,
  progress, certificate verify-public).
- `cd website && pnpm exec tsc --noEmit && pnpm build` clean.
- Manual: dashboard task deep-link → catalog → purchase (Razorpay test mode) →
  player → 100% → certificate → QR scan → verify page; repeat in Hindi.

## WS-02 — Instructor console refactor

**Source:** robust.md §6.8 items 2–5, §10 (Instructor row);
features/farm_instructorteacher.md (KYC §B, chat §D, disputes, commission §C5) ·
**Goal:** split the monolith into routed views, kill demo data, real
credential KYC + earnings/payout, enforced chat rules, commission + Pro tier.

**Read first:**
- `website/src/views/instructor/InstructorHomeBoard.tsx` (855-line monolith,
  `sess_demo` at ~line 100), `views/instructor/index.tsx`
- `website/src/lib/api/instructorAcademy.ts`
- `backend/app/routers/teachers.py` (full teacher suite, prefix `/teachers`):
  `GET/PUT /me`, `GET /students`, `GET /courses/{cid}/students`,
  `POST /courses/{cid}/students/{sid}/certificate`, announcements,
  `GET /analytics`, `GET /courses/mine`, `POST /courses/create`,
  `GET/POST /batches`, `GET /enquiries`, `POST /enquiries/{eid}/quote`,
  `GET/POST /sessions/{sid}/attendance` (QR), `GET /assignments`,
  `POST /assignments/{aid}/grade`, `GET /certificates/verify/{cid}`,
  `GET /earnings`
- `backend/app/services/settlements.py` (`platform_config/settlements`,
  `DEFAULT_CONFIG = {"transportPct": 10, "equipmentRentalPct": 12, "brokerPct": 2}`)
- `backend/app/routers/chat.py`, `backend/app/services/chat.py`
- phase-00 KYC pipeline (`kyc_cases`) and billing (`require_entitlement`)

**Steps:**
1. Split `InstructorHomeBoard.tsx` into routed views under
   `views/instructor/`: `InstructorHome` (dashboard summary), `MyCoursesPage`
   (`GET /v1/teachers/courses/mine` + create/edit via `POST /v1/teachers/courses/create`
   and `courses.py` CRUD), `BatchesPage` (`/batches` + QR attendance via
   `sessions/{id}/attendance`), `EnquiriesPage` (`/enquiries` + structured
   quote reply — template cards only, no free chat pre-booking),
   `AssignmentsPage` (`/assignments` + grade), `EarningsPage` (below),
   `CredentialsPage` (below). Register all in `INSTRUCTOR_PAGES` +
   `dashboard.ts`; add deep routes in `App.tsx`.
2. **Kill `'sess_demo'`** — attendance loads only real session ids from
   batches/courses; delete every `?? <hardcoded>` fallback. Global rule 1.
3. `EarningsPage`: bind `GET /v1/teachers/earnings`; show ledger (fees
   collected − commission = payout), batch-wise breakdown, next payout date
   (T+n per phase-00 RazorpayX weekly settlement; `onHold` without verified
   bank account). No money movement outside the escrow/settlement rails
   (global rule 3); integer paisa internally.
4. Commission config: extend `platform_config/settlements` with
   `courseGMVPct` (default 15, allowed range 15–20, per-category override
   map, effective-dated + versioned, admin-editable with maker-checker +
   `audit_logs` + reason — global rules 3/8). Extend
   `services/settlements.py::run_settlements` to accrue instructor payables
   from completed course purchases (`grossRupees`, `commissionRupees`,
   `netRupees`; role `instructor`, key `courseGMVPct`), and hand off to the
   phase-00 TDS 194-O ledger + payout rails.
5. Instructor Pro tier: billing plan `instructor_pro` ₹499/mo (phase-00
   subscriptions). Entitlements: Free = 1 published course; Pro = unlimited
   courses, analytics (`GET /v1/teachers/analytics` full view), featured
   placement eligibility. Enforce with `require_entitlement` on
   `POST /v1/teachers/courses/create` (and `POST /v1/courses`); show upgrade
   prompt UX. Admin course-moderation queue is **phase-07 module 27** — leave a
   `status: pending_review` field on new courses, no admin UI here.
6. Credential KYC per specialization (extends phase-00 `kyc_cases` document
   matrix): identity = any one of Aadhaar (eKYC XML/QR) / Voter ID / PAN / DL +
   liveness selfie; specialization docs — **DGCA Remote Pilot Certificate
   (RPTO-issued) for drone training**, academic **degrees** where claimed,
   **NABARD/NRLM/SRLM trainer empanelment** (conditional) for
   scheme-literacy/FPO training. Rules: SLA 24–48h review; instructor can
   browse but **cannot publish or take bookings until KYC approved**;
   licences **re-verified at expiry** (recurring job). Surface status +
   upload in `CredentialsPage`; badges from verified credentials render on
   course detail (WS-01).
7. Batch/group chat rules (server-side enforced in `routers/chat.py` /
   `services/chat.py`, not just UI): batch group chat has instructor as
   admin; **instructor broadcast-only (one-to-many); farmers cannot DM each
   other**; **no chat endpoint accepts messages without a CONFIRMED
   booking/enrollment between the parties**; dispute → chat SEALED (frozen
   evidence snapshot). Message types: text + in-platform lesson cards from the
   gated content module only; **no voice notes, no file attachments, no
   external links, no phone numbers/UPI IDs — moderation regex + strike
   ladder** (warning → 24h mute → booking restriction → suspension; global
   rule 4). Dispute outcomes per spec: instructor no-show → full refund +
   instructor strike. Chat *hub* UX is phase-06 — wire rules + a minimal batch
   chat view here.
8. Dashboard summary (instructor), via phase-01 tasks + summary grid:
   enrollments this week, live classes today, pending assignment reviews,
   enquiries awaiting reply, earnings + next payout, course rating.
9. i18n: `en.instructor.ts` + `hi.instructor.ts`; zero hardcoded strings
   (the monolith is English-only — do not carry that forward).

**Acceptance:**
- Zero occurrences of `sess_demo` and zero `?? <hardcoded>` fallbacks in
  `views/instructor/`.
- A non-Pro instructor creating a 2nd published course gets 402/403 with the
  standard error envelope; after subscribing to `instructor_pro` the same call
  succeeds.
- Settlement run produces an instructor settlement doc with 15–20% commission;
  earnings page shows the same numbers; payout follows phase-00 rails.
- Chat rules proven by tests: farmer→farmer DM rejected, message without
  confirmed booking rejected, phone-number message blocked + strike written.
- KYC: drone-specialization instructor without a verified DGCA certificate
  cannot publish; expired licence flips status back to re-verification.

**Verification:**
- `cd backend && .venv/bin/python -m pytest -q` green (extend
  `backend/tests/` — chat guardrails, commission config, entitlement gate,
  KYC specialization matrix).
- `cd website && pnpm exec tsc --noEmit && pnpm build` clean.
- Manual: instructor dashboard task → reply to enquiry (template card) → mark
  QR attendance → grade assignment → earnings page shows accrual → payout
  status; repeat in Hindi.

## WS-03 — e-Market Customer 'FarmGate'

**Source:** robust.md §6.10; features/farm_e-market_customer.md (C1–C9, S1–S6,
E1–E9, KYC §B, WORM §Storage) · **Goal:** refactor the monolith into a
consumer-grade buying app with the spec's escrow guardrails and subscriptions.

**Read first:**
- `website/src/views/customer/CustomerHomeBoard.tsx` (827 lines, 9 `??`
  fallbacks), `views/customer/index.tsx` (`CUSTOMER_PAGES`: `emarketHome`,
  `orderTracking`)
- `website/src/lib/api/emarketCustomer.ts`
- `backend/app/routers/emarket_customer.py` (prefix `/customer`):
  `GET /analytics`, `GET/POST/DELETE /demands`, `GET/POST /quotes`,
  `POST /quotes/{qid}/counter`, `GET /orders`, `POST /orders/{oid}/inspection`,
  `POST /orders/{oid}/qr-handover`, `GET /planner`,
  `GET/POST /suppliers/favorites`. Collections: `customer_demands`,
  `customer_quotes`, `customer_orders`, `customer_favorite_suppliers`.
- `backend/app/services/settlements.py`, `backend/app/services/geo.py`
- phase-00 escrow + KYC + billing docs

**Steps:**
1. Split `CustomerHomeBoard.tsx` into routed views under `views/customer/`:
   `EMarketHome` (dashboard summary), `BrowsePage`, `StorefrontPage`,
   `DemandsPage`, `QuotesPage`, `OrdersPage`, `InspectionPage`,
   `FavoritesPage`. Register in `CUSTOMER_PAGES` + `dashboard.ts` (customer
   tools already list `emarketHome`, `marketplace`, `orderTracking`,
   `addressBook`, `myBookings`, `liveChannels`) + `App.tsx` routes. Delete all
   9 `?? <hardcoded>` fallbacks.
2. Consumer browse (new backend + UI): produce-near-me listing (geo via
   `services/geo.py`; rank by price, distance, grade match, rating,
   **freshness** — harvest date → freshness indicator chip per S3), farmer
   storefront pages (all lots from one `farmerId`, farmer rating, credentials).
   **farmerId linkage on every lot/storefront/quote — global rule 2.**
3. Guardrails (mostly backend gaps in `emarket_customer.py` — implement and
   test; all money integer paisa, all financial mutations write `audit_logs`):
   - **Binding quotes + deposit escrow:** quote acceptance on high-value
     orders requires a deposit funded into phase-00 escrow (deposit % config
     in `platform_config/settlements`, e.g. `emarketDepositPct`); escrow
     release on inspection acceptance / QR handover; refunds to source.
   - **Fair-price band:** compute band from historical settled transactions
     per crop/district; display on quote + counter screens (C5); counter
     rounds capped at 3 with price-lock timers; on deadlock → band nudge,
     quote expires in 24h (E8).
   - **Anti-hoarding caps:** max order qty per buyer per crop (config per
     crop, admin-set; E9 — surge caps commission, never price; spike surcharge
     disclosed on invoice).
   - **Inspection/acceptance with photo evidence** (`POST …/inspection`):
     damage matrix E5 — ≤5% normal settlement; 5–20% pro-rata deduction;
     >20% or grade mismatch → dispute (escrow frozen until ruling, E7 within
     72h of delivery).
   - **Cancellation penalties:** E1 farmer cancel ≤2h free, >2h → 2% of order
     value from future payout + auto-relist; E2 customer cancel ≤4h free,
     4–24h → 5%, <2h to pickup → 10% (penalty → farmer compensation, rest
     refunded); E3 farmer no-show → order auto-cancel + strike + 10% fee →
     customer credit.
   - **WORM audit retention:** order/inspection/dispute evidence to WORM
     object storage; retention 3 years active + 5 years archive; access needs
     dual-control admin approval and every access is itself logged.
4. Multi-farmer cart + split-shipment tracking (C6): cart across farmers →
   one checkout → child orders per farmer (`customer_orders` with
   `parentOrderId`), per-shipment status timeline + QR handover each;
   `orderTracking` toolId resolves here. Logistics mode per line: farmer
   delivers / customer picks up / platform transport slot (F9).
5. Favorites + subscriptions: `suppliers/favorites` exists — add the
   subscription/standing-demand layer (C2): crop, grade, qty, target price
   band, delivery window, **recurring frequency daily/weekly/seasonal** —
   the "weekly 5kg tomatoes from these 3 farmers" flow; auto-generate orders
   from standing demands via `GET /planner` cadence; each recurrence still
   goes through quote → escrow → inspection.
6. Commission + Business tier: add `emarketProducePct: 5` (5% **seller-side**)
   to `platform_config/settlements` and extend `run_settlements` for delivered
   `customer_orders` (role `emarket_seller`, keyed by `farmerId`). Billing
   plan `emarket_business` for bulk/institutional buyers: consolidated
   auto-GST invoicing + `creditTermsDays` credit ledger (C9) — entitlement via
   phase-00 billing; credit ledger entries settle through the same rails.
7. Business-buyer KYC (extends phase-00 matrix): GSTIN (auto verification
   API check), PAN, Udyam if applicable, trade/Shop & Establishment licence,
   **APMC/mandi licence for mandi-linked categories**, FSSAI if food
   processing/retail; constitution docs for partnership/LLP/company → manual
   review; penny-drop on bank. **Quoting disabled until GST + PAN verified**;
   mandatory attestations: anti-hoarding declaration + no-off-platform dealing.
   Household consumers stay Free (commission is seller-side only).
8. Dashboard summary: open demands + quote counts, orders in transit,
   inspections pending, spend this month, favorite farmers' new lots — phase-01
   tasks + summary grid.
9. i18n: `en.emarket.ts` + `hi.emarket.ts`; no hardcoded strings.

**Acceptance:**
- All spec guardrails above have backend tests (deposit escrow, 3-round cap,
  band display field present, qty cap rejection, E1/E2/E3/E5 penalty math in
  integer paisa, WORM write + access log).
- A subscription ("weekly 5kg tomatoes from these 3 farmers") auto-creates an
  order on schedule with escrow both ways.
- Cart with 2 farmers → 2 child orders tracked independently to QR handover.
- Unverified-GST business buyer cannot quote (403, standard envelope).
- 5% seller-side commission appears in the settlement doc; Business-tier buyer
  gets one consolidated GST invoice and a `creditTermsDays` ledger entry.

**Verification:**
- `cd backend && .venv/bin/python -m pytest -q` green.
- `cd website && pnpm exec tsc --noEmit && pnpm build` clean.
- Manual: post demand → receive binding quote → fund deposit → split delivery
  → inspect with photos → accept → escrow release; then the weekly
  subscription fires; repeat in Hindi.

## WS-04 — Gyan Hub

**Source:** robust.md §7.21, §6.8 (paid workshops) · **Goal:** knowledge home
on web; one CMS, two storefronts with courses.

**Read first:**
- `backend/app/routers/gyan.py` (mounted at `/v1`): `GET /workshops`,
  `POST /workshops/{wid}/enroll` (coins discount validated
  `1 ≤ coinsToRedeem ≤ min(workshop.coinsDiscountAllowed, feeRupees)`;
  remainder via `create_razorpay_order(int(remaining*100), f"ws-{wid}-{uid[:8]}")`;
  enrollment doc `users/{uid}/workshop_enrollments`, status
  `awaiting_payment` → `enrolled`), `GET /expert-talks`,
  `POST /expert-talks/{tid}/register` (awards **+25 coins** via
  `award_coins(uid, 25, "expert_talk", tid)`, returns `agriCoinsEarned: 25`),
  `POST /expert-talks/{tid}/questions`, `GET /videos`, `GET /blogs`,
  `POST /blogs/{bid}/bookmark`, `POST /blogs/{bid}/like`
- `backend/app/services/coins.py`; WS-01 coin-cap changes
- `website/src/lib/dashboard.ts` (`gyanHub` module id, 🎓)

**Steps:**
1. **Backend gap:** `gyan.py` has no payment-verify endpoint — enrollments can
   strand in `awaiting_payment`. Add
   `POST /v1/workshops/{workshop_id}/enroll/verify` mirroring
   `courses.py::verify_purchase` (Razorpay signature verify → flip enrollment
   to `enrolled`, increment `enrolledCount`, idempotent). Also apply the X11
   ≤50%-of-order redemption cap from WS-01 step 6 to workshop enroll.
   Expert-talk +25 award must respect the 200/day earn cap (it flows through
   `award_coins` once WS-01 adds the cap — verify with a test).
2. Create `website/src/lib/api/gyan.ts` (new) covering all endpoints above.
3. Create `website/src/views/gyan/` (new): `GyanHubHome` (4 sections),
   `WorkshopsPage` + detail with seat availability, coins slider (same cap
   math as WS-01), Razorpay checkout + verify flow; `ExpertTalksPage` with
   register (+25 coins toast) and pre-talk question submission;
   `VideoLibraryPage`; `BlogsPage` with bookmark/like.
4. Register `gyanHub` tile → real page in `dashboard.ts` + `App.tsx`.
5. One CMS two storefronts: Gyan Hub surfaces related `courses` on
   workshop/talk/blog detail (same instructor, same topic tag) deep-linking to
   WS-01 `CourseDetailPage`; instructor course pages link back to their
   workshops/talks. No duplicated content model — reference by id.
6. Dashboard: emit tasks — "workshop you booked starts at …", "+25 coins from
   expert talk", "new video in your crop category".
7. i18n: `en.gyan.ts` + `hi.gyan.ts`.

**Acceptance:**
- Paid workshop purchase works end-to-end incl. verify (no stranded
  `awaiting_payment` after successful checkout; duplicate verify is a no-op).
- Coin discount capped at min(`coinsDiscountAllowed`, 50% of fee, balance);
  expert-talk registration credits exactly 25 coins and respects the daily cap.
- gyanHub tile resolves; cross-links to courses work both directions.

**Verification:**
- `cd backend && .venv/bin/python -m pytest -q` green (add
  `test_gyan_payments.py`: enroll→verify, idempotency, coin caps, talk award).
- `cd website && pnpm exec tsc --noEmit && pnpm build` clean.
- Manual: dashboard tile → workshop → pay with coins+Razorpay → enrolled;
  register for expert talk → +25 coins; repeat in Hindi.

## WS-05 — Agri News + Live Channels

**Source:** robust.md §7.18, §7.19, §7.24 · **Goal:** news feed + live TV on
web with embedded licensed streams (X16).

**Read first:**
- `backend/app/routers/content.py` (mounted at `/v1`): `GET /news?category=`
  (collection `news`; doc fields incl. `title`, `category`
  [`market-policy`, `weather-alert`, `govt-subsidy`, …], `isBreaking`,
  `timestamp`, `audioText`, `impactRating` — see
  `backend/app/data/content_seed.py`), `GET /channels` (Redis
  `channel:{id}:viewers` live count), `POST /channels`,
  `GET /channels/schedule`, `POST /channels/schedule/{bcast_id}/remind`,
  `GET/POST /channels/{cid}/chat`, `PUT /channels/{cid}/pin`, polls
  (`GET/POST …/polls`, `POST …/polls/{pid}/vote`), Q&A (`GET/POST …/questions`,
  upvote, answer), `POST /channels/{cid}/gift`
- `website/src/lib/dashboard.ts` (`agriNews` 📰, `liveChannels` 📺 module ids)

**Steps:**
1. Create `website/src/lib/api/content.ts` (new) covering `/news` and all
   `/channels*` endpoints.
2. News (`website/src/views/news/`, new): `NewsFeedPage` — category filter
   chips (from observed categories), impact-rating badge (`impactRating`),
   **audio readout** of `audioText` via browser `speechSynthesis` in the
   user's locale (client-side readout only; this is not the retired voice-AI
   program), **WhatsApp share** button (share deep-link per the §7.16
   pattern), `NewsDetailPage`. **Breaking banner** component on the dashboard
   when any `isBreaking` item is fresh (<24h). Admin news CMS is **phase-07
   module 20** — read-only here.
3. Live channels (`website/src/views/channels/`, new): `ChannelGridPage`
   (live badge + viewer count), `ChannelPlayerPage` — HLS playback (add
   `hls.js`; native HLS fallback), pinned announcement, schedule from
   `GET /channels/schedule` with **remind me** toggle, moderated live chat
   (below), polls + viewer Q&A with upvote.
4. X16 streaming decision: v1 = **embedded licensed streams only (e.g. DD
   Kisan)** — seed `channels` docs with licensed HLS `streamUrl`s; **gate
   `POST /v1/channels` behind admin role** (no user-originated streams);
   write a dated deferral note for platform-originated streaming per robust
   §13 rule 10.
5. Live-chat moderation (baseline; AI `content.moderation.v1` is phase-06):
   reject messages matching phone/UPI/URL regexes server-side in
   `POST /channels/{cid}/chat` (global rule 4), rate-limit per user, strike
   ladder reuse from WS-02.
6. Register `agriNews` + `liveChannels` tiles → real pages in `dashboard.ts` +
   `App.tsx`. Dashboard tasks: breaking news card, "live now: <program>".
7. i18n: `en.news.ts`/`hi.news.ts`, `en.channels.ts`/`hi.channels.ts`.

**Acceptance:**
- News feed filters by category, shows impact badges, plays audio readout,
  shares to WhatsApp; breaking banner appears with a breaking seed item.
- Channel grid → player plays an embedded licensed HLS stream; schedule
  reminder persists; a chat message containing a phone number is rejected
  server-side.
- Non-admin `POST /v1/channels` → 403.

**Verification:**
- `cd backend && .venv/bin/python -m pytest -q` green (extend
  `backend/tests/test_content.py`: admin-gate, chat moderation).
- `cd website && pnpm exec tsc --noEmit && pnpm build` clean.
- Manual: dashboard breaking banner → news detail → audio readout; tile →
  channel grid → player → set reminder → chat; repeat in Hindi.

## WS-06 — AI courses intelligence (brief M20)

**Source:** ai_implementation_plan.md §5 M20, §2 (`courses.recommend.v1`),
§3 (SDR/SGR), §0 rules; ai.md B14, C20 · **Goal:** per-farmer course
relevance, objective auto-grading with instructor confirm, learning paths.

**Read first:**
- `backend/app/services/ai/` (phase-00 WS-07 output: `gateway.py`,
  `question_sets.py`, `privacy.py`, `decision_log.py`, `budget.py`, `shim.py`)
- `backend/app/routers/courses.py`, `backend/app/routers/teachers.py`
  (`POST /v1/teachers/assignments/{aid}/grade`)
- WS-01 catalog + player surfaces
- Golden fixtures: `backend/tests/fixtures/ai/golden/`

**Steps (SDR + SGR exactly):**
1. Register `courses.recommend.v1` in `question_sets.py`: per-course
   `relevance` score (batch type), with `confidence_threshold`, automation
   level **`suggest`**, and `fallback_fn` = deterministic ordering (newest in
   farmer's crop categories, then popularity). Module flag +
   threshold in `platform_config/ai` (e.g. `modules.courses_recommend: true`).
2. State builder via `privacy.py` (pseudonymized, ≤1,500 tokens; **no phone/
   email/Aadhaar in payload — global rule 11**): farmer's crops, district,
   current season, completed courses, in-progress courses. Call site: learner
   catalog load — `await gateway.decide(state, "courses.recommend.v1", ctx)`,
   **Redis-cache the ranked result 24h per farmer** (never per page-view).
3. Catalog UI (WS-01 `CourseCatalogPage`): sort/annotate with relevance
   (suggest level = annotate only, e.g. "matches your crops" badge); on shim/
   flag-off/timeout the fallback ordering renders identically-shaped data.
4. Objective auto-grading (SGR): on assignment submission, call
   `gateway.generate(prompt, model=lite, json_schema=<rubric schema>,
   lang=user_lang)`; validate output with a **strict Pydantic rubric model**
   (per-question score + max + feedback key); one repair retry on validation
   failure; fallback = no suggestion (instructor grades manually). Surface in
   `AssignmentsPage` as a **prefill only — instructor confirm required to
   publish** (`require_confirm`; never `auto` — global rule 12). Reuse
   `POST /v1/teachers/assignments/{aid}/grade`; store the AI suggestion on the
   submission doc with `decision_id`.
5. Learning-path suggestion (C20): on certificate issue (WS-01 hook in
   certificate issuance + `POST /v1/teachers/courses/{cid}/students/{sid}/certificate`),
   generate the next-course sequence per the farmer's crops/season/skill gaps
   → emit a phase-01 task "next course for you" deep-linking to the catalog,
   and show the suggestion card on `CertificatePage`. Cache per
   (farmer, certificate); fallback = category-popular next course.
6. Log every call to `ai_decisions` with cost + confidence (via gateway);
   register outcome hooks (purchase after recommendation; published grade vs
   AI suggestion delta).
7. Tests + fixtures: golden fixture
   `backend/tests/fixtures/ai/golden/courses.recommend.v1.jsonl`; shim
   round-trip test; fallback test with gateway raising; flag-off test proving
   catalog + grading work without AI; rubric-schema rejection test (malformed
   Gemini output → repair → fallback).

**Acceptance:**
- Recommendations render on the learner catalog (24h cache hit on second
  load); deterministic fallback proves identical UX shape with
  `AI_PROVIDER=shim` and with the module flag off.
- Auto-grades appear as prefill and **cannot publish without instructor
  confirm**; strict rubric validation rejects malformed output.
- After a certificate, a learning-path card/task appears.
- `ai_decisions` docs written with cost + confidence for all three features.

**Verification (restate the standard):**
`cd backend && .venv/bin/python -m pytest -q` green,
`cd website && pnpm build` green, and every feature works with
`AI_PROVIDER=shim`. Manual: catalog badges → assignment prefill → confirm →
certificate → learning-path card.

## Phase-final verification

1. Full global gate (execution-plan/README.md §4):
   - `cd backend && .venv/bin/python -m pytest -q` — fully green.
   - `cd website && pnpm exec tsc --noEmit && pnpm build` — clean.
   - Full suite green with `AI_PROVIDER=shim`; en/hi locale key parity for all
     new locale files (`academy`, `instructor`, `emarket`, `gyan`, `news`,
     `channels`).
2. Manual end-to-end flows (each from a dashboard task deep-link, each repeated
   in Hindi):
   - **Instructor earns:** KYC credentials → publish course → farmer purchase
     → settlement accrual at configured 15–20% → earnings page → payout status.
   - **Farmer certifies:** catalog → coins+Razorpay purchase → player 100% →
     certificate → QR verify page (logged out) → skill passport in profile.
   - **Household buys weekly:** subscription from 3 favorite farmers →
     deposit escrow → split shipments → photo inspection → acceptance →
     escrow release both ways.
   - **Gyan/news/channels:** paid workshop with coins; expert talk +25 coins
     under daily cap; breaking banner; licensed HLS channel with moderated
     chat.
3. Tile sweep: `instructorHome`, `courses`, `courseDetail`, `emarketHome`,
   `orderTracking`, `gyanHub`, `agriNews`, `liveChannels` all resolve — no
   "coming soon" reachable from any persona dashboard touched by this phase.
4. Confirm X11: 200/day earn cap test, ≤50% redemption test, no cash-redemption
   path exists.
5. Confirm deferral notes written: platform-originated live streaming (X16),
   admin course-moderation queue (→ phase-07 module 27), news CMS (→ phase-07
   module 20).
