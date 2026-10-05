# phase-02 — Execution Summary

> Trade & Logistics Spokes Close-out. Executed per `execution-plan/AGENT_PLAYBOOK.md`,
> task queue `execution-plan/phase-02/tasks.md` (WS-01…WS-06) + `instructions.md`.
> Re-verified 2026-10-05 (second pass at operator request: all non-human tasks already
> `[x]`; the scriptable gates re-run against a freshly built toolchain — evidence below).
> Checkpoints: `e8d4d4d` WS-01 · `dbcd53f` WS-02 · `2f06b4c` WS-03 · `78fbfe7` WS-04 ·
> `fd8c440` WS-05 · `6836f8b` WS-06 · `c764910` WS-01 checkpoint note · `97784ca`
> phase-02 final gate.
> Task queue: **147/159 checked**; the 12 open items are all HUMAN CHECK tasks
> (1.28, 2.24, 3.20, 4.20, 5.20, F.6, F.7, F.8, F.9, F.10, F.11, F.12).

## Status at a glance

| WS | Title | Status | Notes |
|---|---|---|---|
| WS-01 | Landlord "LandBank" close-out | ✅ done (1.28 human) | monolith split into 7 routed views + wizard; 7/12 vault with "unverified" labeling; rent escalation/partial pay/receipt PDF/ledger export; farmer browse + request tracking; disputes + 7-yr retention; entitlements; en/hi |
| WS-02 | Transporter "AgriFleet" close-out | ✅ done (2.24 human) | OTP POD, bid counter, damage lane, penalties/no-show strikes, return-load query+card, driver sub-users, surge cap 1.5×, KYC gate + expiry tasks, RazorpayX payouts, P&L + commission invoice, PWA pings, `lotId`; en/hi |
| WS-03 | Vyapari "FarmLink" close-out | ✅ done (3.20 human) | rate ±25% band + 2 h edit window, weighbridge upload, paid/udhaar + farmer trust card, udhaar ledger, GST invoice + TDS 194-O, probation caps + Verified badge, B2B buyer network, shop-KYC gate; en/hi |
| WS-04 | Equipment "MachineBazaar" close-out | ✅ done (4.20 human) | monolith split into 6 routed views; farmer browse/slots/book/waitlist/cancel; maintenance log + reminders; damage-deposit claims; KYC mid-season; pricing engine; FPO auto-confirm; dispatch check-in pins; 12% payouts; en/hi |
| WS-05 | Broker "DealDesk" close-out | ✅ done (5.20 human) | offer TTL + auto-expire, 3-round cap + deadlock path, typed evidence vault, buyer requirements, commission payout + Razorpay split, KYC + Proven-Broker SLA, two-sided ratings, disputes, entitlements + commission stack, message moderation; en/hi |
| WS-06 | AI spoke decisions (M4/M16/M19/M24/M25) | ✅ done (F.11 human) | five question sets registered at `suggest`, deterministic fallbacks, golden fixtures, `ai_decisions` logging; all model calls via the gateway; en/hi tips |

## Global verification gate (README §4) — re-run 2026-10-05

Freshly built toolchain (`backend/.venv`, `website/node_modules` via pnpm 9.12).

```
backend  pytest (default env, ai_provider default = shim, no Redis reachable) -> 1057 passed, 1 skipped, 0 failed
backend  pytest (AI_PROVIDER=shim,          no Redis reachable)              -> 1057 passed, 1 skipped, 0 failed
backend  phase-02 dedicated suites (49 files)                                ->  201 passed
website  pnpm exec tsc --noEmit                                              -> clean (exit 0)
website  pnpm build                                                          -> built OK (chunk-size warning only)
website  node scripts/check-locale-parity.mjs                                -> locale parity ok (442 keys)
```

The single skip is intentional: `tests/test_infra.py:28: Redis not reachable`.

### Environment note — the reachable-Redis artifact (important)

The repo's test harness caches a **module-global** `redis.asyncio` client in
`backend/app/core/cache.py:get_redis()` (`_redis = None` → `aioredis.from_url(...)`, unchanged
since the initial commit). pytest-asyncio gives every test a fresh event loop, so a client
whose connection pool was opened on loop *A* and is reused on loop *B* raises
`RuntimeError: Event loop is closed` / `Future ... attached to a different loop`.

Consequence on this box: if a **Redis server is reachable on :6379**, the full suite drops to
**856 passed / 202 failed** — all with that signature, spread across phase-00/01 modules
too (`test_auth`, `test_users`, `test_weather`, `test_wishlist`, `test_vyapari`) and some
phase-02 suites. `.github/workflows/ci.yml` starts **no** Redis service, and the app/limiter are
fail-open when Redis is unreachable, so the intended gate is the no-Redis green above. Pointing
`REDIS_URL` at a dead port reproduces CI exactly and yields the fully green result. This is a
pre-existing test-isolation quirk, **not a phase-02 regression**; no code was changed for it in
this pass.

## WS-01 — Landlord "LandBank" close-out ✅

- `website/src/views/landlord/` — new `PlotsPage`, `ListingsPage`, `ListingWizard`,
  `RequestsInboxPage` (accept/reject/counter + KYC badge), `LeasesPage` (agreement PDF view,
  escrow milestones, dual e-sign), `RentTrackerPage`, `LandAnalyticsPage`, `Vault712Page`;
  `LANDLORD_PAGES` registry → `ToolPage.tsx` → deep routes in `App.tsx`. Monolith trimmed so
  each section renders once.
- `backend/app/routers/land.py` — partial payments (`amountPaidPaisa` vs `amountDuePaisa`,
  integer paisa), receipt PDF `GET /land/rent-payments/{id}/receipt`, ledger export
  `GET /land/leases/{id}/ledger?format=csv|pdf`, lease disputes `POST /land/leases/{id}/disputes`,
  7-year `retainUntil`, dashboard summary, `emit_task()` hooks, entitlement gate.
- `backend/app/services/rent_reminders.py` — escalation ladder reminder → late-fee → dispute-lane.
- Farmer side: `views/farmer/LandBrowsePage.tsx`, `LeaseRequestsPage.tsx`; `landListings` /
  `leaseRequests` toolIds in the farmer routes.
- `llUnverified` / `llRecordUnverified` badge rendered on every mock-adapter 7/12 record; en+hi.

## WS-02 — Transporter "AgriFleet" close-out ✅

- `routers/transport.py`: POD OTP (`GET .../pod-otp`, `POST .../verify-pod-otp`, reused
  handover-OTP constants), one-round bid counter, damage-dispute lane, penalty config
  (`platform_config/transport_penalties`) + strike/suspension, return-load query, driver
  sub-users with settlement denial, surge clamp ≤ 1.5, KYC RC/DL/fitness gate + 30/7/1-day
  expiry tasks, `lotId` linkage, dashboard summary, entitlements.
- `routers/jobs.py` / `services/settlements.py`: RazorpayX weekly payout at `transportPct` 10%,
  integer paisa, `audit_logs`; trip P&L asserted against the config; commission-invoice PDF.
- Website: return-load card + PWA 30 s location pings (`TripPage`, `LiveTrackingPage`), farmer
  live tracking, no-show risk badge; en+hi.

## WS-03 — Vyapari "FarmLink" close-out ✅

- `routers/seller.py` / `purchases.py`: 2-hour rate edit window (422) atop the existing ±25 %
  `RATE_OUT_OF_BAND` band, weighbridge-slip field, procurement `paymentStatus paid|udhaar` +
  transition endpoint, mark-paid receipt, per-buyer udhaar ledger, GST invoice PDF,
  TDS 194-O statement, probation (3 bookings / ₹50k escrow cap) → Verified-Vyapari tier,
  B2B buyer network, shop-KYC 403 gate.
- Website: rate-band inline display (no `alert()`), weighbridge upload via `PhotoUploader`,
  farmer payment-pending trust card → paid receipt, Verified badge, `BuyerDirectoryPage`,
  `BulkOrdersPage`; en+hi.

## WS-04 — Equipment "MachineBazaar" close-out ✅

- `views/equipment/`: new `FleetPage`, `BookingQueuePage`, `DispatchPage`, `DamageClaimsPage`,
  `MaintenancePage`, `RoiAnalyticsPage`; `EQUIPMENT_PAGES` registry → `ToolPage.tsx` → routes;
  all `alert()`s removed.
- Farmer side: `EquipmentBrowsePage`, `EquipmentSlotsPage` (book/waitlist/cancel) wired to the
  existing `routers/equipment.py` slots.
- `routers/equipment_owner.py` / `equipment.py`: maintenance log + service-due tasks,
  damage-deposit claims (before/after photos, integer paisa, open→resolved), KYC with
  mid-season expiry handling, pricing engine (hourly/per-acre/package), FPO auto-confirm vs
  private manual, dispatch/return check-in pins, 12% RazorpayX payouts, dashboard summary,
  entitlements; en+hi.

## WS-05 — Broker "DealDesk" close-out ✅

- `routers/broker.py` / `farmer_deals.py`: offer `expiresAt` (TTL config clamped 24–48 h,
  default 24 h) + auto-expire job, 3-round counter cap → accept/decline lock + mediator record,
  typed evidence vault (`weigh_slip`/`quality_report`/`payment_proof`, post-acceptance only),
  buyer requirement postings, real commission payout at `brokerPct` 2%, Razorpay split
  (farmer leg + commission leg == gross), KYC + Proven-Broker 48–72 h SLA escalation,
  two-sided deal ratings (replaces localStorage fallback), dispute workflow with SLA,
  entitlements (Free 5 deals; commission stacks on Pro), server-side message moderation.
- Website: TTL countdown chip on `OfferCard`; broker/farmer surfaces wrapped in
  `MaskedPhoneText`/`D4TextGuard`; en+hi.

## WS-06 — AI spoke decisions (M4, M16, M19, M24, M25) ✅

- `services/ai/question_sets.py`: `seller.rate_check.v1`, `transport.match.v1`,
  `broker.lead_score.v1`, `equipment.booking_rec.v1`, `land.listing_quality.v1` — each with a
  deterministic fallback and `automation_level="suggest"`.
- `services/ai/config_store.py`: flags in `platform_config/ai.modules`, thresholds in
  `.thresholds`, `suggest` in `.automation`.
- Call sites (gateway only — no OpenRouter/Gemini in routers): `seller.py` (422 band +
  manipulation flag + `admin.py` flagged-rates stub), `services/transport_match.py` +
  `transport.py` (batch rank, return-load re-rank, outcome hooks), `broker.py` (lead score +
  round-2 deadlock risk), `equipment_owner.py` (approve score + `analyze_image` damage
  severity, human-confirm), `land.py` (listing quality tips + tenant compatibility),
  `services/seller_forecast.py` (nightly SGR forecast, Pydantic + one repair retry, 24 h cache).
- Golden fixtures under `tests/fixtures/ai/golden/` incl. `broker_lead_score_notes.md`
  (documented r = 0.84 deadlock correlation); `ai_decisions` rows carry cost + confidence +
  `fallbackUsed`; privacy builders strip PII. Flag-off → deterministic fallback throughout.

## Exit gate (readme.md) — final status

- [x] Landlord: list → farmer request → counter → e-sign → escrow → rent → receipt PDF — backend
      flow covered by `test_land*.py` / `test_rent_*.py` (green); visual walk = human (F.6).
- [x] Transporter: OTP POD → expenses → settlement run → RazorpayX payout; PWA pings + farmer
      tracking — backend covered by `test_transport_*.py` (green); visual walk = human (F.7).
- [x] Vyapari: rate band → procurement + weighbridge → trust card → paid → udhaar zero →
      GST/TDS — backend covered (green); visual walk = human (F.8).
- [x] Equipment: book < 60 s → approve → dispatch pin → damage → service → 12% payout — backend
      covered (green); visual walk = human (F.9).
- [x] Broker: 50-deal soak → TTL → round-3 lock → vault → rating → split payout — `test_broker_soak.py`
      + TTL/counter/split tests green; DOM phone check = human (F.10, F.12).
- [x] Monolith refactors routed via registries + `App.tsx`; zero `alert()`/`confirm()`/`prompt()`
      in `views/landlord` + `views/equipment`; en/hi parity for `landlord/transport/trade/broker/equipment`.
- [x] Five AI briefs behind `platform_config/ai` flags at `suggest`; golden + fallback + flag-off
      tests green; `ai_decisions` logging; no PII in payloads. Flag toggles in the running app = human (F.11).
- [x] Global verification gate green — pytest 1057 ✓ (default + shim), tsc ✓, build ✓, locale parity ✓.

## Human checks still required (task queue)

1. **1.28 / F.6** — landlord zero-offline flow: plot + unverified 7/12 badge → listing wizard →
   farmer applies → counter → dual e-sign + escrow milestones → dashboard "rent overdue" task
   deep-link → partial then full payment → receipt PDF → Free-tier 2nd-plot block.
2. **2.24 / F.7** — transporter flow: booking → KYC-verified accept → PWA pings → farmer live
   tracking → OTP POD → expenses → settlement run → RazorpayX payout row → in-window cancel strike.
3. **3.20 / F.8** — bahi-khata day: rate inside/outside band → 2 h edit 422 → procurement +
   weighbridge photo → trust card → mark paid → udhaar zero → GST invoice + TDS statement →
   probation caps + badge.
4. **4.20 / F.9** — equipment: farmer books < 60 s → owner approve (FPO vs private) → dispatch +
   return pins → damage claim → service log → 12% payout; no `alert()`.
5. **5.20 / F.10** — broker: 50-deal soak spot-check → TTL expiry chip → round-3 lock + mediator →
   contract → evidence vault → completed → two-sided rating → split payout; no unmasked phone in DOM.
6. **F.11** — toggle each of the five `platform_config/ai.modules` flags off (fallback works) and
   on under shim (annotations appear); inspect `ai_decisions` rows for cost/confidence/`fallbackUsed`.
7. **F.12** — rendered-page phone grep over broker deal chat, transport bilty and farmer deal detail.

## Explicit deferrals (robust §13 rule 10 — no silent drops)

| Item | Where it lands |
|---|---|
| Real Mahabhulekh/e-District integration (adapter interface + "unverified" labeling ship here) | dated note added in `missing-features/robust.md` §6.2 (2026-10-03, phase-02 WS-01) |
| Admin-console UI for disputes / KYC / SLA queues | phase-07 (this phase ships the records + endpoints only) |
| GPS telematics / dedicated driver app | v1 = PWA manual pings (spec S16) |
| Transport fare escrow/payments beyond commission + payouts | phase-00 money rails only |
| Live RazorpayX/Razorpay/staging keys, live Gemini `decide()` | operator keys / staging |
| AI briefs M3, M8, M12; voice AI (M27/C1/C19) | other phases / retired program-wide |
| Flutter apps (`apps/mobile`, `apps/admin`, `flutter-prototype`) | out of scope — web only |

## Executor notes / deviations (this verification pass)

- No code changes were made. The toolchain was rebuilt (`backend/.venv` on the box's Python
  3.14 and also a CI-faithful Python 3.11.17 via `uv`; `website/node_modules` via pnpm 9.12) and
  the gates re-run for fresh evidence.
- **Task 1.12 literal grep:** the shipped badge keys are camel-cased (`llUnverified`,
  `llRecordUnverified`), so a case-sensitive `grep "unverified"` misses them; the intent (an
  unverified badge key present in both locales and rendered in `Vault712Page.tsx`) is satisfied.
- **Task 5.3 file naming:** `tests/test_broker_offer_ttl.py` was not created as a separate file;
  the offer-TTL/auto-expire tests live in `tests/test_broker_deals.py` (section "WS-05: offer TTL
  + auto-expire + counter cap + escalation"). Coverage is present and green.
- **Task 3.19 external-payments grep:** returns 1 match on this checkout —
  `website/src/views/trade/ProcurementPage.tsx` variable `stats.pendingPayouts`, which contains
  the substring `gPay` under `grep -i`; it is not a payment link (benign false positive).
- Website build emits only the pre-existing Vite chunk-size warning (`index-*.js` ≈ 1.88 MB);
  no type or build errors.
