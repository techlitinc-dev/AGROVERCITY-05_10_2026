# Farmer–Transporter TMS — Porter-Style Feature Catalogue

Complete transport-management feature set for the farmer ↔ transporter marketplace
(spec: `features/farm_transporter.md`, plan: `plan/transporters_plan.md`).
Built as incremental tasks (FT-1…FT-8) on top of the existing transport backend
(`backend/app/routers/transport.py`). Each task section is appended here **after
it is implemented and tested** — the doc is the living record of what exists.

> **Compliance constraints carried over from the spec (non-negotiable)**
> - No phone/contact sharing anywhere; numbers stored, never rendered.
> - Chat unlocks only after booking confirmation; no VoIP; no SOS section.
> - No continuous GPS telematics — manual one-tap location pings only.
> - All money movement stays in-platform (escrow/ledger), commission-based model.

## Status legend

| Tag | Meaning |
|-----|---------|
| ✅ Implemented | Backend endpoints live + covered by tests in `backend/tests/` |
| 🧩 API-ready | Typed wrappers added in `website/src/lib/api/transport.ts`; view wiring is a follow-up |

## Baseline already in place (pre-FT "Porter core")

- Vehicle catalog & fleet management with doc-expiry reminders (T1/T2)
- Instant quote (`POST /transport/fare-estimate`) + surge cap (S11, clamped ≤1.5)
- Post-a-Load wizard: instant booking **or** open-auction load board (F1/F3)
- Bidding with one-round counter-offers (T5/F4, idempotency-keyed)
- Trip state machine `requested → accepted → enRoute → delivered` (+cancel) (S3/F6)
- Manual waypoint pings + live trip view (F7, no telematics) (S16-safe)
- POD with 6-digit OTP verification + photos + receiver (F8)
- Damage disputes with admin resolution lane (F9/S8)
- No-show strikes & load-board suspension (T11, E2/E3)
- Digital bilty / lorry receipt + weighbridge slips (E12)
- Trip expenses + P&L + weekly settlements (10% commission) (T9)
- Return-load matching near drop district (T12)
- Fleet driver sub-accounts (Pro) + trip operation by assigned drivers (T14)
- Commission invoice PDF per trip (T9 paperwork)

---

## FT-1 … FT-8 — implemented below, one section per task

---

## FT-1 — Book Now / Book Later: pickup time windows + reminders ✅ Implemented

**Porter parallel:** schedule a trip for a later slot ("Book for tomorrow 6 AM")
instead of only ASAP dispatch; both sides get a "be ready" nudge at the slot.

**What it does**
- `POST /transport/bookings` accepts `pickupTime` (ISO datetime) and an optional
  `timeWindowMinutes` loading window (15–720 min, Pydantic-validated).
- `POST /transport/loads` accepts `pickupTime`; the winning bid's booking
  inherits it (`accept-bid` copies `pickupTime` into the new booking).
- A deduped `trip_pickup_reminder` task (kind) is emitted at the pickup slot:
  - farmer — at booking creation (priority medium),
  - transporter — at acceptance / bid-win (priority high, refreshes the same
    dedupe key so a dual-profile demo user never gets two tasks).
- `_pickup_window_start` already prefers `pickupTime` over `date`, so the
  existing no-show/cancel strike window automatically becomes slot-precise.

**Endpoints touched**
| Method & path | Change |
|---|---|
| `POST /transport/bookings` | + `pickupTime`, `timeWindowMinutes` in body & doc; farmer reminder |
| `POST /transport/loads` | + `pickupTime` in body & doc |
| `POST /transport/loads/{id}/accept-bid` | booking born with `pickupTime`; transporter reminder |
| `POST /transport/bookings/{id}/accept` | transporter reminder |

**Data model:** `transport_bookings.{pickupTime, timeWindowMinutes}`; `tasks`
kind `trip_pickup_reminder`, dedupe key `{uid}:transport:trip_pickup_reminder:{bookingId}`.

**Verification:** `backend/tests/test_transport_scheduling.py` — 5 tests
(persist + remind, no-slot ⇒ no reminder, window bounds 422, accept refresh,
auction carry-through). All pass; existing `test_transport.py` unaffected.


---

## FT-2 — Detention / Waiting Charges ✅ Implemented

**Porter parallel:** when the vehicle waits beyond a free grace (load not ready
at pickup, queue at the mandi gate), Porter bills waiting time — here it is an
add-on freight line paid by the farmer to the transporter, inside the platform.

**What it does**
- `POST /transport/bookings/{id}/waiting` — one-tap `start`/`stop` per phase
  (`pickup` | `drop`), with an optional `at` ISO override so rural
  offline-tolerant apps can sync later (mirrors S15).
- Billing: `charge = min(ceil(max(0, minutes − freeMinutes)/30) × rate, cap)`
  in integer paisa. Defaults: 60 min free, ₹150/30-min slab, ₹2,000 cap.
- Config lives in `platform_config/transport_detention` — versioned +
  effective-dated, same maker-checker pattern as `transport_penalties`.
- Phase/status guards: pickup waiting allowed once `accepted` (covers E4 "load
  not ready"), drop waiting only while `enRoute`; one open event per phase.
- Accruals surface everywhere money is shown:
  - trip P&L (`/expenses`) — `detentionChargePaisa` added to gross, net profit
    recomputed (fare 1200 + ₹450 detention − ₹120 commission = ₹1,530 in tests);
  - digital bilty — `freightCharges.detentionChargePaisa` + `balancePayable`;
  - `waypointsLog` gets `waiting_{phase}_start/_end` entries;
  - farmer gets a `detention_recorded` notification with minutes + amount.

**Endpoints**
| Method & path | Purpose |
|---|---|
| `POST /transport/bookings/{id}/waiting` | start/stop a waiting event, returns event + running detention summary |

**Data model:** `transport_bookings/{id}/waiting_events` sub-collection;
`transport_bookings.{id}.detention` = `{pickupChargePaisa, dropChargePaisa,
totalChargePaisa, totalMinutes}`.

**Verification:** `backend/tests/test_transport_waiting.py` — 6 tests (130-min
happy path incl. P&L/bilty assertions, free-grace ₹0, ₹2,000 cap, open/close
state guards, phase + input validation, non-assigned transporter 403). Existing
`test_transport_pnl.py` unaffected (9 passed together).


---

## FT-3 — Two-Way Ratings (transporter rates the farmer) ✅ Implemented

**Porter parallel:** partners rate shippers — reliability signals
("load ready on time", "accurate weight") that the next partner sees before
bidding. Until now only the farmer→transporter direction existed.

**What it does**
- `POST /transport/bookings/{id}/rate-farmer` — the **assigned transporter**
  rates the shipper after POD: 1–5 stars, optional review (≤500 chars),
  behaviour tags. Guards: delivered-only (409 otherwise), assigned
  transporter only (403), one rating per trip (409 `ALREADY_RATED`),
  Pydantic 1–5 validation.
- Tags whitelisted to `FARMER_RATING_TAGS`: `load_ready_on_time`,
  `accurate_weight`, `good_communication`, `delayed_loading`,
  `load_not_as_described` (unknown tags dropped).
- Aggregate `farmerRatingStats {count, sum, average, tags}` denormalized onto
  the farmer's user doc — averages across all rated trips.
- `GET /transport/farmers/{uid}/reputation` — transporter-gated read of a
  shipper's aggregate reputation while weighing a bid (aggregate only, no
  contact data — spec-compliant).
- Rating prompts are now symmetric on both delivery paths:
  - OTP delivery: farmer gets `transport_delivery`, transporter gets
    `transport_shipper`;
  - PATCH delivery: **both** prompts fired (previously none — small gap fixed).

**Endpoints**
| Method & path | Purpose |
|---|---|
| `POST /transport/bookings/{id}/rate-farmer` | transporter rates shipper (201), aggregates stats |
| `GET /transport/farmers/{id}/reputation` | shipper reputation for transporters (404 unknown uid) |

**Data model:** `transport_bookings/{id}/farmer_rating/rating` doc +
`transport_bookings.{id}.farmerRating` denormalized; `users.{uid}.farmerRatingStats`.

**Verification:** `backend/tests/test_transport_farmer_rating.py` — 6 tests
(happy path + cross-trip average 4.5, once-only, delivered-only 409,
validation/scoping incl. unknown-tag drop and non-assigned 403, both prompts
via a realistic two-user trip, reputation read + 404).


---

## FT-4 — Favorite Transporters & One-Tap Rebook ✅ Implemented

**Porter parallel:** "book again with the same partner" — farmers build a
trusted-partner list and repeat a trip in one tap.

**What it does**
- `POST /transport/favorites/{transporterId}` — farmer pins/unpins
  (`{favorited: bool}`, deterministic set/delete, idempotent retries). 404 when
  the target is not a registered transporter.
- `GET /transport/favorites` — the farmer's pinned list (newest first), a
  name snapshot only (no contact data).
- `POST /transport/bookings/{id}/rebook` — clone a **delivered/cancelled** trip
  into a fresh `requested` booking:
  - route, vehicle type, load specs, packaging inherited; `date` required
    (the old slot is history), `pickupTime`/`timeWindowMinutes` inherit unless
    overridden, notes overridable;
  - **fare re-evaluated from the current catalog rates** — no stale prices
    (test proves a ₹35→₹40/km rate change yields ₹1,300 not ₹1,200);
  - `rebookOf` links back to the original trip for analytics;
  - FT-1 pickup reminder fires when a slot is present.

**Endpoints**
| Method & path | Purpose |
|---|---|
| `POST /transport/favorites/{id}` | pin/unpin a trusted transporter |
| `GET /transport/favorites` | farmer's pinned list |
| `POST /transport/bookings/{id}/rebook` | clone a terminal trip → new requested booking (201) |

**Data model:** `users/{uid}/transport_favorites/{transporterId}` docs;
`transport_bookings.{rebookOf}` backlink.

**Verification:** `backend/tests/test_transport_favorites.py` — 5 tests
(toggle/list round-trip, 404 unknown, clone + reminder + inheritance, fare
recompute under a changed catalog rate, guards: live trip 409, non-booker 403).


---

## FT-5 — Load Templates & Repeat Bookings ✅ Implemented

**Porter parallel:** saved trips / enterprise scheduled runs — a farmer with a
standing "weekly Nashik→Vashi onion run" saves it once and re-fires it each
week with the season's fare (spec F12, delivered here after being listed as
out-of-scope in `plan/transporters_plan.md` §11).

**What it does**
- `POST /transport/load-templates` — save a named template: route, crop,
  quantity, packaging, vehicle type, base target fare, optional
  `repeatWeekday` (0=Mon…6=Sun). Vehicle type validated against the catalog.
- `GET /transport/load-templates` — the farmer's templates (newest first).
- `DELETE /transport/load-templates/{id}` — owner-only remove (404 otherwise).
- `POST /transport/load-templates/{id}/repeat` — instantiate a **fresh open
  load** for a new date: `pickupDate` required, optional `pickupTime` and a
  seasonal `targetFare` override (template value kept when omitted). The load
  is born `open` with match scoring, appears on the load board for bidding,
  carries `templateId` for analytics, and bumps the template's `useCount`.
- Refactor: `post_open_load` and template-repeat now share `_build_open_load`
  (single load-construction path, seeded demo loads untouched).

**Endpoints**
| Method & path | Purpose |
|---|---|
| `POST /transport/load-templates` | save a template (201) |
| `GET /transport/load-templates` | list my templates |
| `DELETE /transport/load-templates/{id}` | owner-only delete |
| `POST /transport/load-templates/{id}/repeat` | new open load from template (201) |

**Data model:** `transport_load_templates` (id `tmpl_…`, `useCount`);
`transport_loads.{templateId}` backlink.

**Verification:** `backend/tests/test_transport_templates.py` — 4 tests
(CRUD round-trip + 404, catalog validation 422, repeat with fare override +
useCount + board presence, cross-user 404).


---

## FT-6 — Transit Insurance Add-On ✅ Implemented

**Porter parallel:** goods-in-transit cover at checkout — the farmer declares
the load's value, pays a small premium, and any damage dispute on that trip is
automatically an insurance claim.

**What it does**
- `POST /transport/bookings` and `POST /transport/loads` accept
  `declaredValuePaisa` (integer paisa, >0) + `insuranceOptIn`. Opting in
  without a declared value → 422 `DECLARED_VALUE_REQUIRED`.
- `_insurance_block` computes the policy with integer-paisa math:
  `coverage = min(declared, cap)`, `premium = ceil(coverage × ratePct/100)`.
  Defaults: 0.8% premium, ₹5,00,000 coverage cap — versioned/effective-dated
  config in `platform_config/transport_insurance` (same maker-checker pattern).
- The block rides the whole lifecycle: booking doc → auction accept-bid
  (carried from load to booking) → template repeat → **digital bilty**
  (`insurance` line next to freight charges).
- `POST …/damage-disputes` on an insured trip auto-tags the dispute
  `insuranceClaim: true` with `coveragePaisaAtClaim`, so arbitration already
  has the policy snapshot (and a future insurer API has a hook).
- Honest scope note: premium is *recorded* on the trip; collection reconciles
  when the payments/escrow module lands (spec F10 — still backend-absent).

**Endpoints touched:** `POST /transport/bookings`, `POST /transport/loads`,
`POST /transport/load-templates` (+ `/repeat`), `POST /transport/loads/{id}/accept-bid`,
`POST …/damage-disputes`, `GET …/bilty` — all gain the insurance block.

**Data model:** `transport_bookings.{insurance}` and `transport_loads.{insurance}`
= `{optIn, declaredValuePaisa, coveragePaisa, premiumPaisa, ratePct}`;
disputes gain `{insuranceClaim, coveragePaisaAtClaim}`.

**Verification:** `backend/tests/test_transport_insurance.py` — 8 tests
(block math ₹10,000→₹80 premium, ₹5L cap, 422 without declared value,
no-opt-in ⇒ null, auction carry-through, template carry-through, insured
dispute auto-claim, bilty line).


---

## FT-7 — Trip Sharing: View-Only Tracking Link ✅ Implemented

**Porter parallel:** "share trip" — the farmer forwards a link to family or the
mandi agent so they can watch the vehicle approach without an account.

**What it does**
- `POST /transport/bookings/{id}/share` — either booking party mints a link.
  Only the **SHA-256 hash** of the token is stored (`trip_shares` collection);
  re-sharing rotates the token and revokes the previous one. 48 h TTL.
  Cancelled trips cannot be shared (409).
- `GET /transport/shared/{token}` — **public, login-free** sanitized view:
  status, route, commodity, vehicle type + plate, driver **name**, last
  location ping, last 20 milestone waypoints, ETA minutes while enRoute.
  Compliance by construction: **no fares, no phone numbers, no user ids** —
  the response shape simply omits them.
- `DELETE /transport/bookings/{id}/share` — party revokes their link(s);
  unknown/revoked links 404, expired links 410 `SHARE_EXPIRED`.
- Manual pings only — no telematics (spec S16 untouched).

**Endpoints**
| Method & path | Purpose |
|---|---|
| `POST /transport/bookings/{id}/share` | mint (rotate) a view-only link |
| `DELETE /transport/bookings/{id}/share` | revoke my link(s) |
| `GET /transport/shared/{token}` | public sanitized trip view |

**Data model:** `trip_shares` keyed by token hash =
`{bookingId, createdBy, createdAt, expiresAt, revoked}` — the raw token exists
only in the creator's response.

**Verification:** `backend/tests/test_transport_sharing.py` — 4 tests
(happy path incl. ping/waypoint/ETA + sanitization assertions, rotate +
revoke, forced expiry 410, non-party 403 / cancelled 409 / bogus 404).


---

## FT-8 — Farmer Cancellation Penalties + Platform Credit Ledger ✅ Implemented

**Porter parallel:** cancelling after a partner has committed costs money —
tiered cancellation fees, with the stranded partner compensated and every
rupee visible in a ledger.

**What it does**
- `POST /transport/bookings/{id}/cancel` (farmer side) now accrues penalties
  when cancelling an **accepted** trip inside the pickup window (spec E1):
  - outside the 24 h window → free (full-refund analogue);
  - inside 24 h → 10% of the agreed fare;
  - inside the final 2 h → 25%.
  Slot-precise via FT-1's `pickupTime` (falls back to `date`). Cancelling from
  `requested` never penalises; the transporter no-show strike engine (T11) is
  untouched and still passes its original tests.
- Penalty split (config `transporterCompensationPct`, default 50%): half
  compensates the stranded transporter, half is platform revenue.
- `platform_ledger` entries (`farmer_cancel_penalty`, `transporter_compensation`)
  in integer paisa; the farmer's `platformDuesPaisa` accrues on their user doc;
  the transporter's cancel notification now names the compensation credit.
- `GET /transport/ledger/mine` — a user's ledger lines with summaries
  (`platformDuesPaisa`, `penaltiesChargedPaisa`, `compensationEarnedPaisa`) —
  S12-lite transparency until the payments module owns real balances.

**Config:** `platform_config/transport_penalties` gains
`farmerCancelPenaltyPct` (10), `farmerLateCancelPenaltyPct` (25),
`transporterCompensationPct` (50) — versioned, effective-dated, maker-checker
admin edits; stored docs missing the new keys fall back to defaults.

**Endpoints**
| Method & path | Purpose |
|---|---|
| `POST /transport/bookings/{id}/cancel` | farmer cancel + tiered penalty + ledger posts |
| `GET /transport/ledger/mine` | my ledger lines + dues/compensation summaries |

**Data model:** `platform_ledger` (`pen_{bookingId}`, `comp_{bookingId}`);
`transport_bookings.{farmerCancelPenaltyPaisa}`; `users.{platformDuesPaisa}`.

**Verification:** `backend/tests/test_transport_penalties.py` — 5 tests
(10% tier at T−12h, 25% tier at T−1h, free outside window, requested-cancel
never penalised, ledger summary maths). Existing `test_transport_strikes.py`
passes unmodified (8 passed together).

---

## Post-FT-8 system summary

With FT-1…FT-8 the marketplace now covers the full Porter-style loop:
**discover → book (now/later, quote or auction) → run (milestones, waiting
charges, live view) → prove (OTP POD, weighbridge, bilty) → settle (P&L,
settlements, penalties ledger) → retain (ratings both ways, favorites,
rebook, templates, insurance, trip sharing)** — while keeping the spec's
no-contact / no-VoIP / no-SOS / no-telematics / in-platform-money constraints.
