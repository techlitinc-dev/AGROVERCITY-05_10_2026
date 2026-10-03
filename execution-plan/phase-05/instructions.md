# Phase 05 — Platform Module Sweep (24 modules) — Build Instructions

> Self-contained execution sheet. Read `execution-plan/phase-05/readme.md` first.
> Global rules (execution-plan/README.md §3) apply to every workstream — the
> most at-risk ones are restated inline per workstream.

## Repo orientation

- Backend: FastAPI + Firestore — routers `backend/app/routers/`, services
  `backend/app/services/`, tests `backend/tests/`. Routers are mounted in
  `backend/app/main.py` under `/v1`.
- Website: React + TS + Vite — API wrappers `website/src/lib/api/` (see
  `mandi.ts`, `pnl.ts`, `diary.ts` for the established pattern), views
  `website/src/views/<domain>/`, i18n `t()` with per-module locale pairs
  `website/src/lib/i18n/locales/en.<module>.ts` + `hi.<module>.ts` (pattern:
  `en.trade.ts`/`hi.trade.ts`, `en.pnl.ts`/`hi.pnl.ts`), persona/module registry
  `website/src/lib/dashboard.ts`, routes in `website/src/App.tsx`.
- AI: all model calls go through `backend/app/services/ai/gateway.py`
  (built in phase-00/M1). Question sets register in
  `backend/app/services/ai/question_sets.py`; golden fixtures at
  `backend/tests/fixtures/ai/golden/<id>.jsonl`. Never call OpenRouter/Gemini
  from routers. No phone/email/unmasked Aadhaar in AI payloads
  (`services/ai/privacy.py`). New AI features launch at `suggest`.
- Existing module UI pattern to copy: `website/src/views/trade/`,
  `website/src/views/pnl/`, `website/src/views/diary/`,
  `website/src/views/directbuyer/`, `website/src/views/farmer/`.

### Module Playbook (robust.md Appendix A §12) — MANDATORY for every module

Every "backend ✅ / Web ❌" module executes all 7 steps:
1. Add a typed API module in `website/src/lib/api/` mirroring the router
   (document backend quirks in comments, as existing modules do).
2. Add `en` + `hi` locale pairs; zero hardcoded strings; run the parity check.
3. Add a theme CSS file if the module has distinct identity (follow
   `theme/trade.css`, `theme/dairy.css` pattern).
4. Build views + register in the module's `<DOMAIN>_PAGES` registry; add deep
   routes in `App.tsx` (the two one-line edits).
5. Wire the module's tasks into the phase-01 task engine (`emit_task()`
   backend-side) and the dashboard summary grid client-side.
6. Add the module's card to the persona's dashboard config in
   `website/src/lib/dashboard.ts` (respecting the ACL matrix — see
   `canAccess()` at `lib/dashboard.ts:200`).
7. Verification gate: `pytest` green (if backend touched) + `tsc --noEmit` +
   `pnpm build` + manual flow from dashboard task → completion.

### Verification standard (every workstream, restated from ai_implementation_plan.md §5.0)

```bash
cd backend && .venv/bin/python -m pytest -q          # green
cd website && pnpm exec tsc --noEmit && pnpm build   # green
# every AI feature works with AI_PROVIDER=shim
```

Global rules most at risk in this phase: **rule 1** (no `?? <hardcoded>`
fallbacks in new code; strip existing ones where called out), **rule 3**
(integer paisa everywhere; financial mutations write `audit_logs`), **rule 5**
(no paywall on the farmer's core grow-sell-insure loop — everything in this
phase is farmer-core), **rule 6** (no English-only screens; no
`alert()`/`prompt()`/`confirm()` — use the toast/modal system), **rule 7**
(standard error envelope, cursor pagination, `Idempotency-Key` on writes),
**rules 10–12** (gateway-only AI, `ai_decisions` logging, `suggest` level).

---

## WS-01 — Trade-intelligence modules (mandi + contracts polish)

**Source:** robust.md §7.1, §7.4; ai_implementation_plan.md brief M12; ai.md B1, C3, F13, F14
**Goal:** Mandi module gains charts, alerts management, and AI smart-mandi
selection with net-after-transport math + 7/30-day forecast; contracts gain
template library, calendar, analytics, and MSP reference display.
**Read first:** `backend/app/routers/mandi.py`, `backend/app/routers/price_alerts.py`
(landed per phase-02/6.9 work), `backend/app/routers/transport.py` (fare
estimate), `backend/app/routers/contracts.py`,
`website/src/views/trade/MandiPage.tsx`, `website/src/views/trade/AnalyticsPage.tsx`,
`website/src/views/directbuyer/ContractsPage.tsx`,
`website/src/views/farmer/FarmerContractsPage.tsx`,
`website/src/lib/api/mandi.ts`.

**Steps:**
1. **Price-history charts (F13):** add a chart view consuming the existing
   mandi history endpoint (crop + mandi selectors, 30/90-day ranges). Register
   in the trade pages registry; locale keys in `en.trade.ts`/`hi.trade.ts`.
2. **Price-alerts management UI:** page listing/creating/deleting alerts via
   `routers/price_alerts.py`; on alert trigger, emit a task via the phase-01
   task engine with a deep link back to the mandi chart.
3. **Smart Mandi Selection (M12, SDR):**
   - Register question set `mandi.smart_select.v1` (per-mandi `net_score`
     batch; `explain_key` choice) in `question_sets.py` with a deterministic
     fallback = plain net-after-transport arithmetic.
   - State builder (via `services/ai/privacy.py`): lot (crop, qty, district),
     farmer location, candidate mandis with modal prices + distance +
     transport fare estimate from `transport.py`; ≤1,500 tokens.
   - Call site: mandi compare view; store result server-side (doc or Redis
     cache 15 min) — never trigger model calls from page views.
   - UI: "best mandi" card on `MandiPage` showing the net-after-transport math
     line-by-line (mandi price − transport − commission = net, integer paisa).
     Launch at `suggest`; fallback when AI off/failed = current compare view.
4. **Forecast (M12, SGR):** nightly job per (crop, mandi) over history +
   arrivals → `gateway.generate()` returns a projected band with confidence
   class; validate with a Pydantic model, one repair retry, cache per
   (crop, mandi) — never per page-view. Render a line chart with an explicit
   "estimate" label in en/hi. Fallback = current compare view, no chart.
5. **Agmarknet/eNAM sync job hardening:** add retries + last-success timestamp
   surfaced to admin (health note only; admin console is phase-07).
6. **Audio readout:** browser speechSynthesis readout of the day's modal price
   line on the mandi card (locale-aware; no server TTS — voice AI is descoped,
   this is client-side accessibility only).
7. **Contracts polish (§7.4):** contract template library (curated templates
   table in Firestore `contract_templates`, picker in
   `directbuyer/ContractFormPage.tsx`); delivery-schedule calendar view on
   `ContractDetailPage.tsx`; contract performance analytics card (fulfillment
   %, on-time deliveries); MSP reference data endpoint `GET /v1/reference/msp`
   (extend `backend/app/routers/reference.py`, seed `msp_reference` collection
   with crop → MSP in paisa) and display the MSP line on farmer contract
   decision cards (F14) in `farmer/FarmerContractDetailPage.tsx`.

**Acceptance:** golden set of hand-computed mandi-selection cases matches the
deterministic net math exactly and the AI ranking on shim; forecast chart
renders en/hi with "estimate" label; farmer sees MSP next to contract price;
alert create → trigger → task deep link → chart works end-to-end.

**Verification:** standard commands above; golden fixture
`backend/tests/fixtures/ai/golden/mandi.smart_select.v1.jsonl`; manual flow:
farmer opens Mandi → sees best-mandi card with math → creates price alert →
receives task → deep link opens chart.

---

## WS-02 — Advisory hub & AI vision (disease scan, crop planner)

**Source:** robust.md §7.2; briefs M9, M13; ai.md F10, C5
**Goal:** Build the 5-tab advisory web hub; replace hardcoded base prices with
mandi-linked data; disease scan with gate + per-plot history; AI crop planner
that creates real `crop_cycles` + tasks on farmer confirm.
**Read first:** `backend/app/routers/advisory.py`, `backend/app/services/advisory.py`,
`backend/app/services/disease_model/` (`base.py`, `gemini.py`, `stub.py`),
`backend/app/routers/mandi.py`, robust.md §4 (crop_cycles/task engine),
`website/src/lib/firebase.ts` (image upload), `website/src/lib/api/intelligence.ts`.

**Steps:**
1. **Playbook steps 1–6:** new `website/src/lib/api/advisory.ts` (new);
   `en.advisory.ts` + `hi.advisory.ts` (new); views under
   `website/src/views/advisory/` (new) with `<ADVISORY>_PAGES` registry, routes
   in `App.tsx`, dashboard card in `lib/dashboard.ts`.
2. **5-tab hub:** (a) Market Saturation — with explicit opt-in consent copy
   before using the farmer's sowing-intent data; (b) Disease Scan; (c) NPK
   calculator; (d) Pest Radar (5 km radius); (e) Kisan Mitra launcher
   (deep-link to the phase-01 chat surface).
3. **M13 — kill hardcoded prices:** replace hardcoded base-price logic in
   `services/advisory.py` with mandi-linked data from `routers/mandi.py`
   aggregates; saturation classes derive from sowing-intent aggregates per
   district-crop. Register `advisory.saturation.v1` (`risk` choice
   low/med/high; `alt_crops` ranked). Nothing is shown without a data-basis
   citation rendered in the UI (e.g. "based on N sowing intents in <district>").
4. **M13 — AI crop planner (SGR):** planner endpoint — inputs (soil,
   irrigation, plot size, crop history, saturation) → `gateway.generate()`
   returns 2–3 options with rationale in the user's language (en/hi), Pydantic
   validated, one repair retry, cached per (district, season, profile-class).
   On farmer confirm, create real `crop_cycles` docs + a generated task
   schedule via the task engine. Confirm is mandatory (`suggest` level;
   planner never auto-creates).
5. **M9 — disease scan (SDR + vision):**
   - Website scan page: camera/upload → Firebase Storage → signed URL.
   - Backend: register `disease.gate.v1` (`is_plant_leaf` bool, `quality_ok`
     bool); gate first — on fail, return retake guidance in en/hi; then
     `gateway.analyze_image()` with the disease JSON schema (name, confidence,
     treatment, est_cost, urgency).
   - Per-plot scan history (F10): `disease_scans` collection keyed by
     farmerId + plotId; history list view per plot.
   - confidence < 0.7 → create an `expert_tickets` handoff with the photo
     attached; treatment advice → task emission into the task engine.
   - Fallback: existing `disease_model/stub.py`, labeled "demo" in the UI.
6. **Advisory tasks:** weather/pest/saturation advisories emit tasks (playbook
   step 5) with deep links into the relevant tab.

**Acceptance:** golden image set accuracy ≥ stub baseline; history list works
per plot; expert handoff shows the photo; retake guidance on blurry/non-leaf
images; planner output validates and creates real `crop_cycles` + tasks on
confirm; saturation classes stable across golden districts; zero hardcoded
base prices remain in `services/advisory.py`.

**Verification:** standard commands; manual flow: upload leaf photo → gate →
diagnosis card → history entry → low-confidence path creates expert ticket;
planner: fill inputs → 2–3 options → confirm → crop_cycle + tasks appear on
dashboard.

---

## WS-03 — Marketplace e-commerce

**Source:** robust.md §7.3; ai.md X6, X7
**Goal:** Full farmer-facing e-commerce: catalog, product detail with QR
authenticity certificate, cart + Razorpay checkout, order tracking, returns,
wishlist, coupons, address book, reviews; plus seller product-management UIs.
**Read first:** `backend/app/routers/marketplace.py`, `backend/app/routers/orders.py`,
`backend/app/routers/order_tracking.py`, `backend/app/routers/wishlist.py`,
`backend/app/routers/coupons.py`, `backend/app/routers/addresses.py`,
`backend/app/routers/ratings.py`, `backend/app/routers/seller_products.py`,
`backend/app/routers/user_products.py`, phase-00 Razorpay rails
(`backend/app/services/payments.py`).

**Steps:**
1. **Playbook steps 1–6:** `website/src/lib/api/marketplace.ts` (new);
   `en.marketplace.ts` + `hi.marketplace.ts` (new); views under
   `website/src/views/marketplace/` (new): CatalogPage, ProductDetailPage,
   CartPage, CheckoutPage, OrdersPage, OrderDetailPage (tracking timeline),
   ReturnsPage, WishlistPage, AddressBookPage, ReviewsSection; seller side:
   SellerProductsPage + ProductFormPage under the seller persona surface.
2. Catalog with categories: seeds / fertilizer / pesticide / tools / vehicles;
   filters + search within catalog; cursor pagination (rule 7).
3. Product detail: QR authenticity certificate viewer (backend certificates
   exist in `marketplace.py`); reviews list + write (X7) gated to delivered
   orders.
4. Cart + checkout: real Razorpay order/verify via phase-00 rails; integer
   paisa; `Idempotency-Key` on checkout; address book (X6) backed by
   `routers/addresses.py`; coupon apply at checkout (`routers/coupons.py`);
   BNPL shown as a labeled "coming via partner" placeholder only — no fake
   flow.
5. Orders: tracking timeline from `order_tracking.py`; returns request flow;
   order status changes emit tasks to the buyer.
6. Seller product management UIs for `seller_products.py` and
   `user_products.py` (CRUD, stock, images via Firebase Storage signed URLs).
7. Global rules inline: no paywall on farmer purchase flows (rule 5);
   financial mutations (orders, refunds) write `audit_logs` (rule 3); wishlist
   and cart writes carry `Idempotency-Key` (rule 7).

**Acceptance:** farmer buys a seed product end-to-end with a real Razorpay
test-mode payment; tracking timeline advances; return requested and visible;
coupon discount math exact in paisa; seller lists/edits a product and it
appears in catalog; every string via `t()` en+hi.

**Verification:** standard commands; manual flow: catalog → product → cart →
checkout (test keys) → order timeline → return; seller flow: create product →
visible in catalog.

---

## WS-04 — Money & records (P&L / Farm CEO + Farm Diary)

**Source:** robust.md §7.5, §7.17; ai.md F18, G10
**Goal:** Strip all demo fallbacks from FarmCeoPage and CashbookPage; auto-feed
P&L and diary from platform transactions; exports (PDF + Tally); diary photo
attachments.
**Read first:** `backend/app/routers/pnl.py`, `backend/app/services/pnl_engine.py`,
`backend/app/routers/diary.py`, `backend/app/services/diary_analytics.py`,
`website/src/views/pnl/FarmCeoPage.tsx`, `website/src/views/diary/CashbookPage.tsx`,
`website/src/lib/csv.ts`, `website/src/lib/api/pnl.ts`,
`website/src/lib/api/diary.ts`.

**Steps:**
1. **Global rule 1 sweep:** remove every `?? <number>` / hardcoded fallback in
   `FarmCeoPage.tsx` and `CashbookPage.tsx`; empty states show honest
   zero-data UI in en/hi instead.
2. **Auto-feed P&L:** completed transactions across all marketplaces write P&L
   lines without manual entry — a sold lot, a paid lease, a freight income, a
   marketplace order each produce an income/expense entry via
   `services/pnl_engine.py` hooks at the transaction-completion call sites.
   Integer paisa; every auto-entry carries its source doc id for traceability.
3. Per-crop P&L statements view; pre-sowing break-even calculator (inputs:
   expected yield, expected price, input costs → break-even price/yield).
4. **Exports (G10):** CSV exists in `lib/csv.ts` — add PDF report and a
   Tally-compatible export format; backend render via a reports endpoint
   (extend `backend/app/services/reports.py` if present pattern fits, else
   diary/pnl routers).
5. **Diary photos (F18):** ≤3 photo attachments per diary entry, uploaded to
   Firebase Storage and served via signed URLs; thumbnails in the entry list.
6. **Diary auto-entries:** same transaction hooks as step 2 create diary
   cashbook entries (marked auto, source-linked, editable category).
7. Analytics: category / crop / month charts consuming
   `services/diary_analytics.py`; dashboard card refresh in `lib/dashboard.ts`.

**Acceptance:** a sold lot appears in P&L and diary with zero manual entry;
PDF downloads; Tally export imports cleanly (documented column mapping);
zero `?? <number>` left in both pages (grep-verified); photos ≤3 enforced.

**Verification:** standard commands + `grep -n "??" website/src/views/pnl/FarmCeoPage.tsx website/src/views/diary/CashbookPage.tsx`
returns no numeric fallbacks; manual flow: complete a sale in trade → open
Farm CEO → entry present → export PDF.

---

## WS-05 — Finance & protection (schemes, loans, insurance)

**Source:** robust.md §7.7, §7.8, §7.9; brief M21; ai.md B15, F15, F17
**Goal:** Farmer faces of schemes discovery/application, credit/loans, and
PMFBY insurance — all on real backends, with AI scheme matching (M21).
**Read first:** `backend/app/routers/schemes.py`, `backend/app/services/eligibility.py`,
`backend/app/routers/finance.py`, `backend/app/routers/loans.py`,
`backend/app/routers/insurance.py`, `backend/app/routers/insurance_claims.py`,
`backend/app/routers/vault.py` (document vault),
`backend/app/services/claims.py`.

**Steps:**
1. **Playbook steps 1–6** for three modules: `website/src/lib/api/schemes.ts`,
   `finance.ts`, `insurance.ts` (new); locale pairs `en/hi.schemes.ts`,
   `en/hi.finance.ts`, `en/hi.insurance.ts` (new); views under
   `website/src/views/schemes/`, `.../finance/`, `.../insurance/` (new).
2. **Schemes (§7.7):** discovery list sorted matched-to-profile first; detail
   page with eligibility checklist from `services/eligibility.py`; dual apply
   paths — in-app tracked application vs official-portal deep-link (clearly
   labeled external); deadline reminders emitted as tasks; document-vault
   integration for required docs. Leave a backend hook + dated note for the
   admin scheme editor (A3) — the editor UI itself is phase-07.
3. **M21 — schemes matching (SDR):** register `schemes.match.v1` (`eligible`
   bool; `missing` choice-list; `fit` score). Run on profile change + nightly
   job. **Rules decide eligibility; AI only ranks and explains** — matches
   must equal the rules engine's truth set. Gemini generates the vernacular
   "why eligible / what to do" line, cached per (scheme, profile-class).
   Eligible schemes with missing docs → tasks naming the missing docs.
4. **Finance (§7.8):** credit score page (score + tier + improvement tips from
   `routers/finance.py`); loan marketplace comparing offers; EMI calculator;
   KCC visual card; application wizard (F17) posting to `routers/loans.py`
   with a status tracker page. Document requests from the bank side surface as
   farmer tasks. This is the farmer mirror of persona 6.11 (phase-03) —
   coordinate endpoint shapes; do not rebuild bank-side logic.
5. **Insurance (§7.9):** 4 tabs per spec — (a) policy passbook + e-certificate
   download; (b) 72-h claim intimation with geo-tagged photos and a
   guidelines overlay (the 72-hour SLA clock must be visible); (c) premium
   calculator; (d) claim tracker with multi-stage progress and the
   appeal/resubmit path (F15) via `insurance_claims.py`. Farmer mirror of
   persona 6.12 — coordinate with phase-03 WS-04 on claim status enums.
6. Global rules inline: credit/insurance AI never exceeds `require_confirm`
   (rule 12); all money figures integer paisa; claims/loans mutations
   audit-logged.

**Acceptance:** matches equal the rules engine's truth set on the golden set;
explanations render en/hi; deadline tasks emitted; loan wizard submits and
tracks status end-to-end; 72-h intimation captures geo-tagged photos and
starts a visible SLA clock; appeal path resubmits a rejected claim.

**Verification:** standard commands; manual flows: profile update → scheme
matches re-ranked with missing-doc tasks; farmer files claim with photos →
tracker advances; appeal from rejected state.

---

## WS-06 — Land, FPO & post-harvest

**Source:** robust.md §7.10, §7.11, §7.14; brief M10; ai.md F11, F19
**Goal:** 7/12 land-records viewer with honesty labeling; FPO discovery/join +
group-buy + shared machinery; cold-storage farmer face with warehouse
receipts vault and the AI grading → list-as-lot loop.
**Read first:** `backend/app/routers/land_records.py`,
`backend/app/services/land_records/` (`base.py`, `mock_adapter.py`),
`backend/app/routers/fpo.py`, `backend/app/routers/equipment.py`,
`backend/app/routers/post_harvest.py`, `backend/app/services/grading_model/`
(`base.py`, `stub.py`), `backend/app/routers/lots.py` (list-as-lot prefill),
`website/src/views/trade/LotForm.tsx`.

**Steps:**
1. **Playbook steps 1–6** for `landLegal`, `fpo`, `postHarvest` modules:
   `website/src/lib/api/landRecords.ts`, `fpo.ts`, `postHarvest.ts` (new);
   locale pairs (new); views under `website/src/views/land/`,
   `website/src/views/fpo/`, `website/src/views/postharvest/` (new — note the
   existing `website/src/views/legal/` is the static legal-pages domain; do
   not collide).
2. **Land & Legal 7/12 (§7.10):** record search by Gat no./village; 7/12 vs 8A
   viewer; PDF view/download; one-tap auto-import of survey area into the
   farm profile. Until a real Mahabhulekh adapter exists behind
   `services/land_records/base.py`, every record carries the phase-00 honesty
   label ("sample data — not an official record") in en/hi.
3. **FPO (§7.11):** FPO discovery directory + join-request flow (F19) with
   non-member vs member states; group-buy pool cards with live progress bars;
   shared machinery calendar joining the equipment module's slots; leave a
   dated note + backend status field for admin FPO verification (A8) — the
   verification UI is phase-07.
4. **Post-harvest farmer face (§7.14):** cold-storage directory with live
   capacity; booking with slot decrement (F11); my-bookings list; warehouse
   receipts vault (receipts exist in `post_harvest.py` — surface them as
   verifiable documents; label them as loan-collateral-usable).
5. **M10 — AI grading (SDR + vision):** replace the `grading_model` stub call
   path with `gateway.analyze_image()` returning (grade, shelf_life_days,
   price_band vs mandi); register `grading.gate.v1` (`needs_human` bool;
   `confidence_class` choice); confidence < 0.7 → "human grader" pathway as a
   task to the ops queue. Stub stays as the deterministic fallback.
6. **The farmer-link loop:** grading result card renders grade + recommended
   price band + a one-tap "list as lot" button that deep-links to
   `trade/LotForm.tsx` with crop/grade/qty/price prefilled. Honest "AI
   estimate" label on the card (en/hi).

**Acceptance:** golden graded-image set within ±1 grade ≥ 80%; lot-prefill
loop works end-to-end on web; booking decrements capacity atomically;
receipts downloadable; 7/12 records carry the honesty label; FPO join request
transitions member state and pool progress updates in real time.

**Verification:** standard commands; manual flow: photograph produce → grade
card with "AI estimate" → list as lot → lot appears in trade; book a chamber
slot → capacity decrements → receipt in vault.

---

## WS-07 — Water, climate & green (water, climate, tree plantation)

**Source:** robust.md §7.6, §7.13, §7.22
**Goal:** Plot-wise irrigation intelligence; honest carbon-potential tools;
plantation/NGO/biofuel module — with hardcoded climate data replaced by real
collections.
**Read first:** `backend/app/routers/water.py`, `backend/app/routers/weather.py`,
`backend/app/services/weather.py`, `backend/app/routers/climate.py` (hardcoded
today — global rule 1 target), `backend/app/routers/tree.py`,
`backend/app/routers/schemes.py` (PMKSY deep-link).

**Steps:**
1. **Playbook steps 1–6** for `water`, `climate`, `treePlantation`:
   `website/src/lib/api/water.ts`, `climate.ts`, `tree.ts` (new); locale pairs
   (new); views under `website/src/views/water/`, `.../climate/`,
   `.../trees/` (new).
2. **Water (§7.6):** plot-wise irrigation schedule view; CGWB groundwater
   gauge visualization; canal rotation calendar; PMKSY 55% subsidy calculator
   with a deep-link into the scheme application (WS-05 schemes detail).
   Weather-aware irrigation tasks emitted into the task engine (skip-today
   suggestion when rain forecast, from `services/weather.py`).
3. **Climate (§7.13):** move all hardcoded content into real collections
   (`climate_varieties`, `carbon_factors`); per-plot, practice-based
   carbon-potential calculator; resilient-variety catalog view;
   carbon-program enrollment pipeline with a clearly labeled partner-MRV
   placeholder. **Every number carries the honest label "estimate, not
   credits" (en/hi) until MRV exists.** Join with the tree module for carbon
   estimates.
4. **Tree plantation & biofuel (§7.22):** plantation tracker (species, count,
   survival checks as recurring tasks); NGO directory with free-sapling
   request flow (request writes a doc with status `pending` — the approval UI
   is superadmin module 21, phase-07); biofuel economics pages; care guides;
   carbon estimate join into the climate module.

**Acceptance:** zero hardcoded data in the climate router's response path;
irrigation task fires and is weather-aware (rain forecast suppresses/adjusts
it); PMKSY calculator lands on the matching scheme detail; sapling request
creates a pending record; all carbon numbers display the "estimates, not
credits" label.

**Verification:** standard commands; manual flow: open water module → plot
schedule → task on dashboard; climate calculator → labeled estimate; request
saplings → pending status visible.

---

## WS-08 — Engagement (Krishi Ratna coins, Refer & Earn, Women Farmer Hub)

**Source:** robust.md §7.15, §7.16, §7.12; ai.md F1, X11
**Goal:** Gamification wallet/store/leaderboard with hard abuse guards;
referral hub with anti-fraud crediting; women hub on real collections with
4 tabs and rose theme.
**Read first:** `backend/app/routers/gamification.py`, `backend/app/services/coins.py`,
`backend/app/routers/referrals.py`, `backend/app/services/referrals.py`,
`backend/app/routers/women.py` (hardcoded SHG/garden data — rule 1 target),
`backend/app/routers/auth.py` + `website/src/views/onboarding/` (register
wizard, referral capture F1), `backend/app/routers/marketplace.py` (women
product listings), livestock herd registry `backend/app/routers/livestock.py`.

**Steps:**
1. **Playbook steps 1–6** for `krishiRatna`, `referEarn`, `womenFarmer`:
   `website/src/lib/api/gamification.ts`, `referrals.ts`, `women.ts` (new);
   locale pairs (new); views under `website/src/views/rewards/`,
   `.../referrals/`, `.../women/` (new).
2. **Krishi Ratna (§7.15):** coin wallet (ledger view, tiers, streaks,
   badges); rewards store with redemption flow; leaderboard. **X11 abuse
   guards, non-negotiable:** 200 coins/day earn cap; redemption capped at
   ≤50% of order value; nightly reconcile job comparing issued vs redeemed
   ledger; all caps/values live in `platform_config` (admin-editable with
   maker-checker, not code constants); **coins are never redeemable for
   cash** — label this in the store (regulatory).
3. **Refer & Earn (§7.16):** referral hub — code card, WhatsApp share
   deep-link, milestone tracker, leaderboard. **Anti-fraud:** referral credit
   only after the invitee's first completed transaction (per dairy/direct-buyer
   specs), never at registration. Verify the register wizard captures the
   referral code (F1) — check `website/src/views/onboarding/` and
   `routers/auth.py`; add the field + attribution write if missing.
4. **Women Farmer Hub (§7.12):** replace hardcoded SHG/garden data in
   `routers/women.py` with real collections (`shg_groups`, `shg_meetings`,
   `garden_plans`, `home_enterprises`). Build 4 tabs: (a) SHG savings ledger
   with meeting workflow (attendance + collection entries); (b) kitchen-garden
   planner; (c) livestock health — joins the herd registry
   (`routers/livestock.py`); (d) home-enterprise income tracker with product
   listings published into the marketplace (WS-03). Women-mode rose theme
   overlay on web (theme CSS per playbook step 3). SHG federation = future
   Enterprise tier — note only, do not build. M26 SHG-readiness AI lands in
   phase-08 — leave the module flag slot in `platform_config/ai` documented.
5. Global rules inline: coin/referral mutations are financial — integer units,
   `audit_logs` on every mint/burn/credit (rule 3); no cash redemption ever;
   referral/coin surfaces never paywall farmer core flows (rule 5).

**Acceptance:** earn >200 coins in a day is capped server-side (test);
redemption >50% of an order rejected; reconcile job reports drift; referral
credit lands only after invitee's first completed transaction; registration
with a code attributes correctly; women hub reads/writes real collections in
all 4 tabs and a home-enterprise product appears in the marketplace.

**Verification:** standard commands + targeted pytest for caps
(`backend/tests/test_gamification.py` exists — extend it); manual flow: share
referral → invitee registers → completes first transaction → credit appears.

---

## WS-09 — All-Tools launcher & global search

**Source:** robust.md §7.24; ai.md F3, G4
**Goal:** Every tile in the tools launcher resolves to a real page; basic
keyword global search across six indexes with a grouped results page.
**Read first:** `website/src/lib/dashboard.ts` (registry + `canAccess()` ACL),
`website/src/App.tsx` (routes), `website/src/views/dashboard/` (grid
rendering), `backend/app/routers/schemes.py`, `marketplace.py`, `content.py`,
`courses.py`, `lots.py`, `backend/app/routers/reference.py` (crops).

**Steps:**
1. **Launcher sweep (7.24):** enumerate every tile in the persona-filtered
   grid from `lib/dashboard.ts`; for each, verify the route in `App.tsx`
   renders a real view (phases 02–04 own their tiles; this phase owns the
   modules above). Equipment farmer face (7.23): the rental UI is phase-02
   WS-04 item 2 — this phase only verifies the `equipment` tile resolves to
   that page; if missing at sweep time, file a dated blocker against phase-02
   rather than building it here. Zero "coming soon" tiles may remain.
2. **Search backend:** new `backend/app/routers/search.py` (new): `GET
   /v1/search?q=` performing case-insensitive keyword matching across six
   indexes — schemes, products, news (content), crops (reference), courses,
   lots — each with its own cursor and the standard error envelope (rule 7).
   Response grouped by module: `{schemes: [...], products: [...], news: [...],
   crops: [...], courses: [...], lots: [...]}` with per-group `nextCursor`.
   Basic substring/prefix match is sufficient — the embeddings/intent upgrade
   is phase-06 brief M23 (leave the router shape compatible).
3. **Search UI:** `website/src/lib/api/search.ts` (new) + SearchResultsPage
   (new) grouped by module with per-group "see all" pagination; search box in
   the dashboard header; locale keys in `en.ts`/`hi.ts`.
4. Register the search page route in `App.tsx`; deep-linkable query param
   (`/search?q=`).

**Acceptance:** tile audit table shows 24/24 modules resolving to real pages
(zero coming-soon); `GET /v1/search?q=pyaz` returns grouped hits from lots +
news + crops at minimum; results page paginates a group independently; shim
mode unaffected (no AI in v1 search).

**Verification:** standard commands; `curl` the search endpoint against a
seeded dev instance; manual flow: dashboard search box → grouped results →
deep-link into a scheme detail.

---

## Phase-final verification

1. Global gate (execution-plan/README.md §4), all of it:
   ```bash
   cd backend && .venv/bin/python -m pytest -q          # fully green
   cd website && pnpm exec tsc --noEmit && pnpm build   # clean
   ```
   plus the en/hi locale parity check across every new locale pair
   (`en/hi.{advisory,marketplace,schemes,finance,insurance,landRecords,fpo,
   postHarvest,water,climate,tree,gamification,referrals,women}.ts` + the
   added `trade`/`pnl`/`cashbook` keys).
2. AI: full suite green with `AI_PROVIDER=shim`; `ai_decisions` docs written
   for M9/M10/M12/M13/M21 paths; every AI feature launches at `suggest` and
   has a working deterministic fallback proven by flag-off tests.
3. Rule-1 sweep: `grep -rn "??" website/src/views/pnl website/src/views/diary`
   shows no numeric fallbacks; `routers/women.py`, `routers/climate.py`,
   `services/advisory.py` contain no hardcoded data payloads.
4. Module-by-module playbook step 7: for each of the 21 in-scope modules, one
   manual flow executed from the dashboard task deep-link to completion — no
   "coming soon" reachable from any tile.
5. Task-engine audit: every module's emit points fire (mandi alerts, advisory,
   irrigation, scheme deadlines, order status, loan doc requests, claim
   stages, plantation care, referral milestones) and render in the Action
   Center.
6. Search: `GET /v1/search` returns grouped results for all six indexes on
   seeded data.
