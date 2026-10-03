# phase-02 — Task Queue
> Executor: read `execution-plan/AGENT_PLAYBOOK.md` first. Execute tasks top to
> bottom, one at a time. Mark [x] only when EXPECT matches real output.
> Full context for any task: see `instructions.md` WS-NN referenced in the task.

## WS-01 — Landlord "LandBank" close-out  (see instructions.md §WS-01)

### Task 1.1 — Verify WS-01 read-first files exist
- DO: No edits. Confirm every file instructions.md §WS-01 "Read first" names exists.
- RUN: `test -f website/src/views/landlord/LandlordHomeBoard.tsx && test -f website/src/views/landlord/index.tsx && test -f website/src/lib/api/landlord.ts && test -f backend/app/routers/land.py && test -f backend/app/routers/land_records.py && test -f backend/app/routers/vault.py && test -f backend/app/services/land_records/base.py && test -f backend/app/services/land_records/mock_adapter.py && test -f backend/app/services/rent_reminders.py && test -f backend/tests/test_land.py && test -f backend/tests/test_land_market.py && test -f backend/tests/test_land_records.py && test -f website/src/lib/dashboard.ts && test -f features/farm_farmlandlord.md`
- EXPECT: exit 0.
- IF FAIL: a "Read first" file is missing — STOP the phase (playbook §5) with the failing path.
- [x]

### Task 1.2 — Verify phase-01 task engine dependency
- PRECONDITION: `grep -rn "def emit_task" backend/app/ | head -1` — if this returns nothing, STOP the phase (playbook §5): phase-01 task engine is missing.
- DO: No edits. Confirm the `/v1/tasks` router from phase-01 is mounted.
- RUN: `grep -n "tasks" backend/app/main.py`
- EXPECT: output contains a line mounting a tasks router (e.g. `include_router(tasks.router`).
- IF FAIL: re-check with `grep -rn "v1/tasks" backend/app/routers/ | head -3` — if still nothing, STOP the phase (playbook §5).
- [x]

### Task 1.3 — Create landlord PlotsPage view
- DO: Create `website/src/views/landlord/PlotsPage.tsx` (new). Move the plots list + add-plot form out of `LandlordHomeBoard.tsx` into this page, calling the existing wrappers in `website/src/lib/api/landlord.ts`. Every user-facing string via `t()` — no hardcoded strings, no `?? <number>` fallbacks, no `alert()`/`confirm()`. Do not delete `LandlordHomeBoard.tsx` yet.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the type errors in `PlotsPage.tsx` only — else STOP (playbook §5) with full output.
- [x]

### Task 1.4 — Create landlord ListingsPage and wizard
- DO: Create `website/src/views/landlord/ListingsPage.tsx` (new, land listings list) and `website/src/views/landlord/ListingWizard.tsx` (new, create-listing wizard) using `website/src/lib/api/landlord.ts`. Strings via `t()` only.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix type errors in the two new files only — else STOP (playbook §5).
- [x]

### Task 1.5 — Create landlord RequestsInboxPage view
- DO: Create `website/src/views/landlord/RequestsInboxPage.tsx` (new): lease-request inbox with accept / reject / counter actions; each application row shows the farmer profile summary and a verified-KYC badge (spec L2/L3, see instructions.md §WS-01 step 1). Strings via `t()` only.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix type errors in the new file only — else STOP (playbook §5).
- [x]

### Task 1.6 — Create landlord LeasesPage view
- DO: Create `website/src/views/landlord/LeasesPage.tsx` (new): lease list + detail showing agreement PDF view, escrow milestones, and dual e-sign status for each lease. Strings via `t()` only.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix type errors in the new file only — else STOP (playbook §5).
- [x]

### Task 1.7 — Create landlord RentTrackerPage view
- DO: Create `website/src/views/landlord/RentTrackerPage.tsx` (new): due/overdue rent list with a record-payment action per row. Strings via `t()` only.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix type errors in the new file only — else STOP (playbook §5).
- [x]

### Task 1.8 — Create landlord LandAnalyticsPage view
- DO: Create `website/src/views/landlord/LandAnalyticsPage.tsx` (new): per-plot occupancy and rent analytics view fed by the landlord summary API. Strings via `t()` only.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix type errors in the new file only — else STOP (playbook §5).
- [x]

### Task 1.9 — Create landlord Vault712Page view
- DO: Create `website/src/views/landlord/Vault712Page.tsx` (new): 7/12 record vault view listing records from `backend/app/routers/land_records.py` via `website/src/lib/api/landlord.ts`. Strings via `t()` only.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix type errors in the new file only — else STOP (playbook §5).
- [x]

### Task 1.10 — Register LANDLORD_PAGES and deep routes
- DO: In `website/src/views/landlord/index.tsx` export a `LANDLORD_PAGES` map (toolId → component) for the pages from tasks 1.3–1.9 plus the existing `LandlordHomeBoard` (pattern: `website/src/views/transport/index.ts` `TRANSPORT_PAGES`). In `website/src/views/dashboard/ToolPage.tsx` import `LANDLORD_PAGES` and merge it into the page registry like `TRANSPORT_PAGES` is merged. In `website/src/App.tsx` add deep routes for the new landlord pages following the transport deep-route pattern (`/dashboard/p/landlord/...`). Trim the moved sections out of `LandlordHomeBoard.tsx` so each section renders in exactly one place.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the registry/route wiring only — else STOP (playbook §5).
- [x]

### Task 1.11 — Add landlord locale split files
- DO: Create `website/src/lib/i18n/locales/en.landlord.ts` (new) and `website/src/lib/i18n/locales/hi.landlord.ts` (new) in the exact shape of `en.broker.ts`/`hi.broker.ts` (`registerLocale`, flat `Record<string,string>`), containing every `t()` key introduced by tasks 1.3–1.10 in BOTH languages. Import both files in `website/src/main.tsx` directly below the existing `./lib/i18n/locales/en.trade` / `hi.trade` imports. Zero English-only keys (rule 6).
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: add the missing key(s) to whichever locale file lacks them — else STOP (playbook §5).
- [x]

### Task 1.12 — Label unverified 7/12 records
- DO: In `website/src/views/landlord/Vault712Page.tsx` render an "unverified" badge on every record returned by the mock adapter (`backend/app/services/land_records/mock_adapter.py`), using a `t()` key present in both `en.landlord.ts` and `hi.landlord.ts`. Keep the mock adapter behind `backend/app/services/land_records/base.py` — do not modify the adapter interface.
- RUN: `grep -n "unverified" website/src/lib/i18n/locales/en.landlord.ts website/src/lib/i18n/locales/hi.landlord.ts`
- EXPECT: both files each return at least one matching line.
- IF FAIL: add the badge key to the missing locale file — else STOP (playbook §5).
- [x]

### Task 1.13 — Write Mahabhulekh deferral note
- DO: Edit `missing-features/robust.md` §6.2 (landlord section) appending a dated deferral note: the real Mahabhulekh/e-District integration is deferred; the adapter interface + "unverified" labeling shipped in phase-02 WS-01. Use today's date from `date +%F` (rule 10: no silent deferrals).
- RUN: `grep -n "$(date +%F)" missing-features/robust.md`
- EXPECT: at least one matching line inside the §6.2 area.
- IF FAIL: re-add the note with the correct date — else STOP (playbook §5).
- [x]

### Task 1.14 — Add rent overdue escalation stages
- DO: Edit `backend/app/services/rent_reminders.py`: extend the scheduled job with the escalation ladder reminder → late-fee notice → dispute-lane offer (instructions.md §WS-01 step 3). Create `backend/tests/test_rent_escalation.py` (new) covering: first overdue → reminder, continued overdue → late-fee notice, further overdue → dispute-lane offer record. Money fields integer paisa only.
- RUN: `.venv/bin/python -m pytest tests/test_rent_escalation.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix `rent_reminders.py` until the new tests pass — never weaken the test — else STOP (playbook §5).
- [x]

### Task 1.15 — Add partial rent payment tracking
- DO: Edit the rent payment code path in `backend/app/routers/land.py`: the rent doc tracks `amountPaidPaisa` vs `amountDuePaisa` (integer paisa, no floats — rule 3/6); recording a payment increments `amountPaidPaisa` and the doc stays payable until `amountPaidPaisa >= amountDuePaisa`. Create `backend/tests/test_rent_payments.py` (new) covering a partial payment followed by a final payment.
- RUN: `.venv/bin/python -m pytest tests/test_rent_payments.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the payment code path — else STOP (playbook §5).
- [x]

### Task 1.16 — Add rent receipt PDF endpoint
- DO: Edit `backend/app/routers/land.py`: add `GET /land/rent-payments/{paymentId}/receipt` returning a PDF receipt (`application/pdf`) for one recorded payment, with the standard `{"error":{code,...}}` envelope on failure (rule 7). Add a test to `backend/tests/test_rent_payments.py` asserting 200 + PDF content type.
- RUN: `.venv/bin/python -m pytest tests/test_rent_payments.py -q` (cwd `backend/`)
- EXPECT: all tests pass incl. the receipt test.
- IF FAIL: fix the endpoint — else STOP (playbook §5).
- [x]

### Task 1.17 — Add rent-ledger CSV/PDF export
- DO: Edit `backend/app/routers/land.py`: add `GET /land/leases/{leaseId}/ledger?format=csv` and `?format=pdf` exporting the full rent ledger for the lease. Add tests to `backend/tests/test_rent_payments.py` asserting the CSV contains a header row and one row per payment.
- RUN: `.venv/bin/python -m pytest tests/test_rent_payments.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the export endpoint — else STOP (playbook §5).
- [x]

### Task 1.18 — Assert audit_logs on rent mutations
- DO: Edit `backend/app/routers/land.py` so every rent financial mutation (record payment, late-fee notice) writes an `audit_logs` entry (rule 3). Add a test to `backend/tests/test_rent_payments.py` asserting an `audit_logs` doc exists after recording a payment.
- RUN: `.venv/bin/python -m pytest tests/test_rent_payments.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: add the missing audit write — else STOP (playbook §5).
- [x]

### Task 1.19 — Create farmer land-browse view
- DO: Create `website/src/views/farmer/LandBrowsePage.tsx` (new): "land for rent near me" browser over open land listings (L2/L3 mirror, instructions.md §WS-01 step 4), calling `website/src/lib/api/landlord.ts`. Strings via `t()` with en+hi keys.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix type errors in the new file only — else STOP (playbook §5).
- [x]

### Task 1.20 — Create farmer lease-request tracking view
- DO: Create `website/src/views/farmer/LeaseRequestsPage.tsx` (new): farmer applies to a listing and tracks his application's accept / reject / counter state. In `website/src/lib/dashboard.ts` confirm the farmer `PROFILE_ROUTES` includes the `landListings` and `leaseRequests` toolIds routed to these views — add them if absent. Strings via `t()` en+hi.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the new view / registry entry — else STOP (playbook §5).
- [x]

### Task 1.21 — Add lease dispute endpoint
- DO: Edit `backend/app/routers/land.py`: add `POST /land/leases/{leaseId}/disputes` creating a dispute doc with fields `{leaseId, createdBy, category, status: "open", createdAt}` consumable by the phase-07 admin console; accepts `Idempotency-Key` and returns the `{"error":{code,...}}` envelope on failure (rule 7). Create `backend/tests/test_land_disputes.py` (new) covering create + status field.
- RUN: `.venv/bin/python -m pytest tests/test_land_disputes.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the endpoint — else STOP (playbook §5).
- [x]

### Task 1.22 — Add 7-year retention on lease docs
- DO: Edit `backend/app/routers/land.py`: every lease doc and rent doc gets a `retainUntil` ISO-string field set to creation date + 7 years (landlord spec: 7-year audit retention). Add a test to `backend/tests/test_land_disputes.py` asserting the field exists on a created lease.
- RUN: `.venv/bin/python -m pytest tests/test_land_disputes.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: add the missing field — else STOP (playbook §5).
- [x]

### Task 1.23 — Emit landlord dashboard tasks
- DO: Edit `backend/app/routers/land.py` (and `backend/app/services/rent_reminders.py` for the overdue case): call `emit_task()` for request received, lease expiring, rent overdue, and e-sign pending (instructions.md §WS-01 step 6). Create `backend/tests/test_landlord_tasks.py` (new) asserting a task doc is emitted when a lease request is created.
- RUN: `.venv/bin/python -m pytest tests/test_landlord_tasks.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the emit call — else STOP (playbook §5).
- [x]

### Task 1.24 — Add landlord dashboard summary
- DO: Edit `backend/app/routers/land.py`: landlord dashboard summary returns acres owned/leased, active leases + rent due this month (integer paisa), pending requests, expiring leases, and plot-level occupancy, feeding the phase-01 grid + `PERSONA_HOME_CONFIG.farmLandlord` (instructions.md §WS-01 step 6). Add a test asserting the summary fields exist.
- RUN: `.venv/bin/python -m pytest tests/test_land.py tests/test_landlord_tasks.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the summary — else STOP (playbook §5).
- [x]

### Task 1.25 — Enforce landlord entitlements server-side
- PRECONDITION: `grep -rln "entitlement" backend/app/ | head -1` — if empty, STOP the phase (playbook §5): phase-00 billing entitlements missing.
- DO: Edit `backend/app/routers/land.py`: gate on the phase-00 entitlement — Free = 1 plot + 1 active lease (exceeding → 403 with the standard error envelope and an upgrade-prompt code); Pro ₹299/mo = unlimited plots, agreement PDFs, rent automation, analytics; Enterprise = multi-village portfolios + team seats. Gate the PDF/automation/analytics endpoints server-side, not just in UI (instructions.md §WS-01 step 7). Create `backend/tests/test_landlord_entitlements.py` (new) covering the Free-tier plot limit.
- RUN: `.venv/bin/python -m pytest tests/test_landlord_entitlements.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the gate — else STOP (playbook §5).
- [x]

### Task 1.26 — Sweep landlord dialogs and locale parity
- DO: No new features. Verify zero `alert()`/`confirm()`/`prompt()` in the landlord module and full en/hi key parity in the new locale split.
- RUN: `grep -rn "alert(\|confirm(\|prompt(" website/src/views/landlord/ ; diff <(grep -oE "^  [a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.landlord.ts | sort) <(grep -oE "^  [a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.landlord.ts | sort)`
- EXPECT: the grep returns nothing; the diff produces no output.
- IF FAIL: replace dialogs with the toast/modal system or add the missing locale keys — else STOP (playbook §5).
- [x]

### Task 1.27 — Start backend dev server
- DO: Start the API in the background exactly as `run.sh` does: `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (leave it running for the next task).
- RUN: `curl -s http://localhost:8000/v1/health`
- EXPECT: output contains `"status":"ok"`.
- IF FAIL: read the uvicorn log output, fix the boot error — else STOP (playbook §5).
- [x]

### Task 1.28 — HUMAN CHECK: landlord zero-offline flow
- DO: HUMAN CHECK: with the dev server (task 1.27) and `cd website && pnpm dev` running: (1) as landlord, add a plot with a 7/12 record and confirm the "unverified" badge renders; (2) create a listing via the wizard; (3) as farmer, open "land for rent near me", apply to the listing; (4) as landlord, counter the request in RequestsInboxPage; (5) complete dual e-sign on LeasesPage and confirm escrow milestones show; (6) open the dashboard "rent overdue" task → deep-link → record a partial then full payment on RentTrackerPage; (7) download the receipt PDF; (8) confirm a Free-tier account is blocked from adding a 2nd plot with an upgrade prompt.
- RUN: human performs the clicks above
- EXPECT: every step completes with zero offline steps; receipt PDF downloads; unverified 7/12 records are labeled; Free-tier limit enforced with upgrade prompt (instructions.md §WS-01 Acceptance).
- IF FAIL: note the exact failing step and fix the named file — else STOP (playbook §5).
- [ ]

### Task 1.29 — Checkpoint WS-01
- DO: Run the workstream verification block (instructions.md §WS-01 Verification), then commit.
- RUN: `.venv/bin/python -m pytest -q` (cwd `backend/`) then `pnpm exec tsc --noEmit && pnpm build` (cwd `website/`) then `git add -A && git commit -m "phase-02 WS-01: Landlord LandBank close-out"` (repo root)
- EXPECT: pytest fully green; tsc + build clean; commit created.
- IF FAIL: fix the failing check — never weaken a test; if only the git commit fails (identity etc.), note it and continue (playbook §6) — else STOP (playbook §5).
- [x]

## WS-02 — Transporter "AgriFleet" close-out  (see instructions.md §WS-02)

### Task 2.1 — Verify WS-02 read-first files exist
- DO: No edits. Confirm every file instructions.md §WS-02 "Read first" names exists.
- RUN: `test -f backend/app/routers/transport.py && test -f backend/app/services/settlements.py && test -f backend/app/routers/jobs.py && test -f backend/app/routers/purchase_settlement.py && test -f website/src/views/transport/TripPage.tsx && test -f website/src/views/transport/LiveTrackingPage.tsx && test -f website/src/views/transport/SettlementsPage.tsx && test -f website/src/views/transport/JobInboxPage.tsx && test -f website/src/views/transport/LoadDetailPage.tsx && test -f website/src/lib/api/transport.ts && test -f features/farm_transporter.md && test -f plan/transporters_plan.md && grep -q "transportPct" backend/app/services/settlements.py`
- EXPECT: exit 0.
- IF FAIL: a "Read first" file is missing — STOP the phase (playbook §5) with the failing path.
- [ ]

### Task 2.2 — Add farmer POD-OTP endpoint
- DO: Edit `backend/app/routers/transport.py`: add `GET /transport/bookings/{id}/pod-otp` (farmer-facing) which creates a 6-digit OTP on the booking with a validity window and attempt counter, reusing the handover-OTP shape and constants `HANDOVER_OTP_VALID_MINUTES` / `HANDOVER_OTP_MAX_ATTEMPTS` from `backend/app/routers/purchase_settlement.py` (import them). Standard error envelope on failure (rule 7).
- RUN: `.venv/bin/python -c "from app.routers import transport; print('ok')"` (cwd `backend/`)
- EXPECT: prints `ok`, exit 0.
- IF FAIL: fix the import/syntax error in `transport.py` — else STOP (playbook §5).
- [ ]

### Task 2.3 — Add transporter verify-POD-OTP endpoint
- DO: Edit `backend/app/routers/transport.py`: add `POST /transport/bookings/{id}/verify-pod-otp` (transporter-facing) which, on a valid OTP, marks the booking `delivered` alongside the existing `podPhotos` + `receiverName` fields; expired OTP → 422; attempts ≥ `HANDOVER_OTP_MAX_ATTEMPTS` → 422 (rule 7 envelope).
- RUN: `.venv/bin/python -c "from app.routers import transport; print('ok')"` (cwd `backend/`)
- EXPECT: prints `ok`, exit 0.
- IF FAIL: fix the error in `transport.py` — else STOP (playbook §5).
- [ ]

### Task 2.4 — Test OTP POD flows
- DO: Create `backend/tests/test_transport_pod_otp.py` (new) covering: happy path (farmer gets OTP, transporter verifies, booking becomes `delivered`), expired OTP → 422, and max-attempts lockout → 422.
- RUN: `.venv/bin/python -m pytest tests/test_transport_pod_otp.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix `transport.py` — never weaken the test — else STOP (playbook §5).
- [ ]

### Task 2.5 — Add one-round bid counter endpoint
- DO: Edit `backend/app/routers/transport.py`: add `POST /transport/loads/{id}/bids/{bidId}/counter` allowing exactly one counter round on a load bid; a second counter on the same bid → 422 (rule 7 envelope, `Idempotency-Key` on the write). Create `backend/tests/test_transport_bids.py` (new) covering counter accepted then second counter rejected.
- RUN: `.venv/bin/python -m pytest tests/test_transport_bids.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the endpoint — else STOP (playbook §5).
- [ ]

### Task 2.6 — Add transport damage dispute lane
- DO: Edit `backend/app/routers/transport.py`: promote `pod.damageNotes` into a real dispute record — `POST /transport/bookings/{id}/damage-disputes` with fields `{bookingId, photos: [], claimPaisa: <integer paisa>, notes, status: "open", createdBy, createdAt}`; `GET` for both farmer and transporter; status flow `open → resolved` via an admin-consumable endpoint (console UI is phase-07). Create `backend/tests/test_transport_disputes.py` (new) covering create + status transition.
- RUN: `.venv/bin/python -m pytest tests/test_transport_disputes.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the endpoints — else STOP (playbook §5).
- [ ]

### Task 2.7 — Add cancellation/no-show penalty config
- DO: Create a versioned config doc `platform_config/transport_penalties` with fields `{cancelWindowHours, strikesToSuspend, version, effectiveFrom}` loaded by `backend/app/routers/transport.py` (config changes effective-dated, admin-editable with maker-checker — instructions.md §WS-02 step 4). Add a test to `backend/tests/test_transport_disputes.py` asserting the config loads with defaults present.
- RUN: `.venv/bin/python -m pytest tests/test_transport_disputes.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the config loader — else STOP (playbook §5).
- [ ]

### Task 2.8 — Record no-show strikes and suspension
- DO: Edit `backend/app/routers/transport.py`: cancelling within `cancelWindowHours` of the pickup window records a strike on the transporter; at `strikesToSuspend` strikes the transporter is suspended from the load board (accept → 403 with the error envelope). Create `backend/tests/test_transport_strikes.py` (new) covering strike recording and suspension at the threshold.
- RUN: `.venv/bin/python -m pytest tests/test_transport_strikes.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the strike logic — else STOP (playbook §5).
- [ ]

### Task 2.9 — Add return-load matching query
- DO: Edit `backend/app/routers/transport.py`: add `GET /transport/trips/{id}/return-loads` which, on/after trip completion, runs the deterministic query: open loads whose pickup is near the trip's drop district within the return window (T8; AI ranking is WS-06 M16, not here). Create `backend/tests/test_transport_return_loads.py` (new) with a matching and a non-matching load.
- RUN: `.venv/bin/python -m pytest tests/test_transport_return_loads.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the query — else STOP (playbook §5).
- [ ]

### Task 2.10 — Add return-load card UI
- DO: Edit `website/src/views/transport/TripPage.tsx` and the transport dashboard tile: render the return-load card from `GET /transport/trips/{id}/return-loads` via `website/src/lib/api/transport.ts`. Strings via `t()` with keys added to BOTH `website/src/lib/i18n/locales/en.transport.ts` and `hi.transport.ts`.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the card wiring — else STOP (playbook §5).
- [ ]

### Task 2.11 — Add driver sub-users
- DO: Edit `backend/app/routers/transport.py`: driver sub-accounts scoped to a fleet (T9, Pro tier) — a driver can ping milestones/location on assigned trips but any settlements read → 403. Create `backend/tests/test_transport_drivers.py` (new) covering driver ping allowed + settlements read forbidden.
- RUN: `.venv/bin/python -m pytest tests/test_transport_drivers.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the scoping — else STOP (playbook §5).
- [ ]

### Task 2.12 — Add surge multiplier cap
- DO: Edit `backend/app/routers/transport.py`: fare estimate carries a `surgeMultiplier` field, server-clamped to a hard cap of 1.5, never applied farmer-side (transporter-side earning lever only). Edit the fare breakdown card in the transport views to show the multiplier transparently (`t()` en+hi keys). Create `backend/tests/test_transport_surge.py` (new) asserting a 2.0 request is stored as 1.5.
- RUN: `.venv/bin/python -m pytest tests/test_transport_surge.py -q && grep -rn "surgeMultiplier" website/src/views/farmer/ | wc -l` (cwd `backend/` for pytest, repo root for grep)
- EXPECT: tests pass; grep count is `0` (surge never rendered farmer-side).
- IF FAIL: fix the clamp / remove the farmer-side render — else STOP (playbook §5).
- [ ]

### Task 2.13 — Replace KYC shim with real pipeline
- PRECONDITION: `grep -rln "kyc" backend/app/routers/ backend/app/services/ | head -1` — if empty, STOP the phase (playbook §5): phase-00 KYC pipeline missing.
- DO: Edit `backend/app/routers/transport.py`: replace the auto-`verified` shim with the phase-00 KYC pipeline for vehicle documents RC / DL / fitness-certificate incl. expiry dates (T7); a vehicle with expired or unverified docs cannot accept jobs → 422 with the same gate shape as today. Create `backend/tests/test_transport_kyc.py` (new) covering expired-doc accept → 422.
- RUN: `.venv/bin/python -m pytest tests/test_transport_kyc.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the gate — else STOP (playbook §5).
- [ ]

### Task 2.14 — Emit KYC expiry reminder tasks
- DO: Edit `backend/app/routers/transport.py`: emit `emit_task()` reminders 30 / 7 / 1 days before each vehicle document expiry. Add a test to `backend/tests/test_transport_kyc.py` asserting a reminder task is emitted for a doc expiring in 7 days.
- RUN: `.venv/bin/python -m pytest tests/test_transport_kyc.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the reminder emission — else STOP (playbook §5).
- [ ]

### Task 2.15 — Wire RazorpayX weekly payouts
- PRECONDITION: `grep -rln "payout" backend/app/services/ | head -1` — if empty, STOP the phase (playbook §5): phase-00 RazorpayX payout client missing.
- DO: Edit `backend/app/routers/jobs.py` / `backend/app/services/settlements.py`: when `POST /jobs/settlements/run` generates transport settlement docs (10% commission per `platform_config/settlements.transportPct`), execute the real payout through the phase-00 RazorpayX payout client to the transporter's verified bank account and record the payout row on the settlement doc. Integer paisa everywhere (rule 3/6). Create `backend/tests/test_transport_payouts.py` (new) with the payout client mocked/shimmed.
- RUN: `.venv/bin/python -m pytest tests/test_transport_payouts.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the payout wiring — else STOP (playbook §5).
- [ ]

### Task 2.16 — Verify trip P&L matches commission config
- DO: Add a test (new `backend/tests/test_transport_pnl.py`) asserting `GET /bookings/{id}/expenses` trip P&L commission equals `platform_config/settlements.transportPct` (10%) of the trip fare in integer paisa (instructions.md §WS-02 step 9: verify it still matches).
- RUN: `.venv/bin/python -m pytest tests/test_transport_pnl.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the P&L computation to match the config — else STOP (playbook §5).
- [ ]

### Task 2.17 — Add per-trip commission invoice PDF
- DO: Edit `backend/app/routers/transport.py`: add `GET /transport/bookings/{id}/commission-invoice` returning a PDF invoice for the trip's commission. Add a test to `backend/tests/test_transport_pnl.py` asserting 200 + PDF content type.
- RUN: `.venv/bin/python -m pytest tests/test_transport_pnl.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the endpoint — else STOP (playbook §5).
- [ ]

### Task 2.18 — Assert audit_logs on payouts
- DO: Edit the payout path from task 2.15 so every payout writes an `audit_logs` entry (rule 3). Add a test to `backend/tests/test_transport_payouts.py` asserting the audit doc exists after a payout.
- RUN: `.venv/bin/python -m pytest tests/test_transport_payouts.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: add the missing audit write — else STOP (playbook §5).
- [ ]

### Task 2.19 — Add PWA location pings
- DO: Edit `website/src/views/transport/TripPage.tsx` and `website/src/views/transport/LiveTrackingPage.tsx`: post a location ping every 30 s while a trip is active (30 s refresh already exists — hook into it) via `website/src/lib/api/transport.ts`; edit the farmer My Trips view to show the vehicle en route from the latest ping. No telematics (spec S16). Strings via `t()` en+hi.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the ping wiring — else STOP (playbook §5).
- [ ]

### Task 2.20 — Add lotId transport linkage
- DO: Edit `backend/app/routers/transport.py`: booking create accepts an optional `lotId` tying produce lot → pickup → delivery (F12). Edit `website/src/views/trade/LotDetailPage.tsx` to render the booking's transport leg when `lotId` is set. Create `backend/tests/test_transport_lot.py` (new) asserting the linkage persists.
- RUN: `.venv/bin/python -m pytest tests/test_transport_lot.py -q` (cwd `backend/`) then `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: tests pass; tsc exit 0.
- IF FAIL: fix the failing side — else STOP (playbook §5).
- [ ]

### Task 2.21 — Add transporter dashboard summary
- DO: Edit `backend/app/routers/transport.py`: dashboard summary returns today's trips with status, new job requests, vehicle availability/location, earnings today/this week (integer paisa), next settlement, document expiries, and return-load matches on today's routes (instructions.md §WS-02 step 12). Add a test asserting the fields exist.
- RUN: `.venv/bin/python -m pytest tests/test_transport.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the summary — else STOP (playbook §5).
- [ ]

### Task 2.22 — Enforce transporter entitlements
- PRECONDITION: `grep -rln "entitlement" backend/app/ | head -1` — if empty, STOP the phase (playbook §5): phase-00 billing entitlements missing.
- DO: Edit `backend/app/routers/transport.py`: gate on entitlement — Free = 1 vehicle commission-only; Pro ₹499/mo = fleet of 5, driver sub-accounts, route analytics, priority load board; Enterprise = unlimited fleet, API dispatch, dedicated support. Commission 10% on all tiers (no entitlement bypasses `transportPct`). Create `backend/tests/test_transport_entitlements.py` (new) covering the Free-tier vehicle limit.
- RUN: `.venv/bin/python -m pytest tests/test_transport_entitlements.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the gate — else STOP (playbook §5).
- [ ]

### Task 2.23 — Grep transport phone fields
- DO: No new features. Verify no phone field renders anywhere in the transport module incl. the bilty (rule 4).
- RUN: `grep -rn "farmerPhone\|transporterPhone\|driverPhone" website/src/views/transport/ website/src/views/farmer/`
- EXPECT: no output.
- IF FAIL: remove/mask every match (use the masked-text pattern) — else STOP (playbook §5).
- [ ]

### Task 2.24 — HUMAN CHECK: transporter end-to-end flow
- PRECONDITION: `curl -s http://localhost:8000/v1/health` — if it does not return `"status":"ok"`, redo task 1.27 first.
- DO: HUMAN CHECK: with backend + `cd website && pnpm dev` running: (1) farmer creates a booking; (2) transporter with a KYC-verified vehicle accepts; (3) trip page sends PWA location pings; (4) farmer's My Trips shows the vehicle en route near-real time; (5) farmer reveals the POD OTP, transporter enters it with podPhotos + receiverName → delivered; (6) log trip expenses and confirm trip P&L == settlement math at 10%; (7) run `POST /jobs/settlements/run` and confirm the RazorpayX payout row on the settlement doc; (8) cancel a booking inside the penalty window and confirm a strike is recorded.
- RUN: human performs the flow above
- EXPECT: every step completes (instructions.md §WS-02 Acceptance).
- IF FAIL: note the exact failing step and fix the named file — else STOP (playbook §5).
- [ ]

### Task 2.25 — Checkpoint WS-02
- DO: Run the workstream verification block (instructions.md §WS-02 Verification), then commit.
- RUN: `.venv/bin/python -m pytest -q` (cwd `backend/`) then `pnpm exec tsc --noEmit && pnpm build` (cwd `website/`) then `git add -A && git commit -m "phase-02 WS-02: Transporter AgriFleet close-out"` (repo root)
- EXPECT: pytest fully green; tsc + build clean; commit created.
- IF FAIL: fix the failing check — never weaken a test; if only the git commit fails, note it and continue (playbook §6) — else STOP (playbook §5).
- [ ]

## WS-03 — Vyapari "FarmLink" close-out  (see instructions.md §WS-03)

### Task 3.1 — Verify WS-03 read-first files exist
- DO: No edits. Confirm every file instructions.md §WS-03 "Read first" names exists.
- RUN: `test -f backend/app/routers/seller.py && test -f backend/app/routers/mandi.py && test -f backend/app/routers/purchases.py && test -f backend/app/routers/purchase_settlement.py && test -f website/src/views/trade/RatesPage.tsx && test -f website/src/views/trade/ProcurementPage.tsx && test -f website/src/views/trade/KhataPage.tsx && test -f website/src/views/trade/PosPage.tsx && test -f website/src/views/trade/PurchasesPage.tsx && test -f website/src/lib/api/seller.ts && test -f website/src/components/trade/PhotoUploader.tsx && test -f features/Vyapari.md && grep -q "RATE_OUT_OF_BAND" backend/app/routers/seller.py`
- EXPECT: exit 0.
- IF FAIL: a "Read first" file is missing — STOP the phase (playbook §5) with the failing path.
- [ ]

### Task 3.2 — Enforce 2-hour rate edit window
- DO: Edit `backend/app/routers/seller.py`: the rate doc stores `createdAt`; any edit to a posted rate more than 2 hours after `createdAt` → 422 with the error envelope (keep the existing ±25% `RATE_OUT_OF_BAND` band check untouched — S2). Create `backend/tests/test_seller_rate_window.py` (new) covering: edit inside 2 h succeeds, edit after 2 h → 422.
- RUN: `.venv/bin/python -m pytest tests/test_seller_rate_window.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the window check — else STOP (playbook §5).
- [ ]

### Task 3.3 — Show rate band inline in RatesPage
- DO: Edit `website/src/views/trade/RatesPage.tsx`: on a 422 from the rates endpoint, render the band from the error payload inline in the form — never `alert()` (rule 6). Strings via `t()` with keys added to BOTH `en.trade.ts` and `hi.trade.ts`.
- RUN: `pnpm exec tsc --noEmit && grep -c "alert(" src/views/trade/RatesPage.tsx; true` (cwd `website/`)
- EXPECT: tsc exit 0; grep count is `0`.
- IF FAIL: fix the inline display / remove the dialog — else STOP (playbook §5).
- [ ]

### Task 3.4 — Add weighbridge slip upload
- DO: Edit `website/src/views/trade/ProcurementPage.tsx`: add a weighbridge slip photo upload on procurement entry reusing the existing `website/src/components/trade/PhotoUploader.tsx` (Firebase Storage); save the resulting URL on the procurement doc as `weighbridgeSlipUrl` via `website/src/lib/api/seller.ts` (backend `backend/app/routers/purchases.py` persists the field — add it there too). Strings via `t()` en+hi.
- RUN: `pnpm exec tsc --noEmit && cd ../backend && .venv/bin/python -c "from app.routers import purchases; print('ok')"` (cwd `website/` then `backend/`)
- EXPECT: tsc exit 0; prints `ok`.
- IF FAIL: fix the failing side — else STOP (playbook §5).
- [ ]

### Task 3.5 — Add procurement payment status
- DO: Edit `backend/app/routers/purchases.py`: each procurement gets `paymentStatus: "paid" | "udhaar"` with a transition endpoint accepting `Idempotency-Key` and the standard error envelope (rule 7); integer paisa amounts only. Create `backend/tests/test_procurement_payment.py` (new) covering paid and udhaar transitions.
- RUN: `.venv/bin/python -m pytest tests/test_procurement_payment.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the transitions — else STOP (playbook §5).
- [ ]

### Task 3.6 — Add farmer payment-pending trust card
- DO: Edit the farmer's view of a procurement (farmer-facing view in `website/src/views/farmer/` or the shared purchase detail — read `website/src/views/trade/PurchaseDetailPage.tsx` first to find where the farmer sees it): while `paymentStatus == "udhaar"` render a "payment pending" trust card; when `paid`, show the receipt (instructions.md §WS-03 step 2). Strings via `t()` en+hi.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the card — else STOP (playbook §5).
- [ ]

### Task 3.7 — Add mark-paid flow with receipt
- DO: Edit `backend/app/routers/purchases.py`: marking a procurement paid generates a receipt retrievable by the farmer (PDF or receipt doc — follow the existing receipt shape in `purchase_settlement.py` if present). Add a test to `backend/tests/test_procurement_payment.py` covering udhaar → paid with receipt.
- RUN: `.venv/bin/python -m pytest tests/test_procurement_payment.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the flow — else STOP (playbook §5).
- [ ]

### Task 3.8 — Extend udhaar ledger balances
- DO: Edit `backend/app/routers/seller.py`: extend the existing khata `/seller/ledgers` into a per-buyer udhaar ledger with running balances in integer paisa (S7). Create `backend/tests/test_udhaar_ledger.py` (new) covering: udhaar entries accumulate, payments reduce, ledger reconciles to zero.
- RUN: `.venv/bin/python -m pytest tests/test_udhaar_ledger.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the ledger math — else STOP (playbook §5).
- [ ]

### Task 3.9 — Add GST invoice PDF
- DO: Edit `backend/app/routers/seller.py`: add `GET /seller/sales/{id}/invoice.pdf` generating a GST invoice PDF per completed sale (S6). Create `backend/tests/test_seller_documents.py` (new) asserting 200 + PDF content type.
- RUN: `.venv/bin/python -m pytest tests/test_seller_documents.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the endpoint — else STOP (playbook §5).
- [ ]

### Task 3.10 — Add TDS 194-O statements
- DO: Edit `backend/app/routers/seller.py` / `backend/app/services/settlements.py`: add a TDS 194-O statement per settlement period (downloadable). Create `backend/tests/test_tds.py` (new) covering the TDS math on a known settlement (integer paisa).
- RUN: `.venv/bin/python -m pytest tests/test_tds.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the TDS computation — else STOP (playbook §5).
- [ ]

### Task 3.11 — Enforce new-vyapari probation caps
- DO: Edit `backend/app/routers/seller.py` / `backend/app/routers/purchase_settlement.py`: until the trust tier is earned, a vyapari is limited to 3 completed bookings and a ₹50,000 cumulative escrow cap (features/Vyapari.md); a 4th booking or escrow above the cap → 403 with the error envelope. Create `backend/tests/test_vyapari_probation.py` (new) covering both caps.
- RUN: `.venv/bin/python -m pytest tests/test_vyapari_probation.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the caps — else STOP (playbook §5).
- [ ]

### Task 3.12 — Award Verified Vyapari trust tier
- DO: Edit `backend/app/routers/seller.py`: on completing the probation requirements (task 3.11), set the vyapari's trust tier field so the "Verified Vyapari" badge is earned. Add a test to `backend/tests/test_vyapari_probation.py` asserting the tier flips after the 3rd completed booking within the escrow cap.
- RUN: `.venv/bin/python -m pytest tests/test_vyapari_probation.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the tier award — else STOP (playbook §5).
- [ ]

### Task 3.13 — Show Verified Vyapari badge to farmers
- DO: Edit the farmer-facing offer/procurement surfaces (`website/src/views/farmer/`, `website/src/views/trade/` offer cards): render the "Verified Vyapari" badge when the vyapari's trust tier field is set. Strings via `t()` en+hi.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the badge wiring — else STOP (playbook §5).
- [ ]

### Task 3.14 — Add buyer network endpoints
- DO: Edit `backend/app/routers/seller.py`: buyer network / B2B (S5) — a buyer directory listing plus incoming bulk orders where wholesale buyers post requirements to the vyapari (new collection + GET/POST endpoints, error envelope + `Idempotency-Key` on writes). Create `backend/tests/test_buyer_network.py` (new) covering post-a-requirement and list-directory.
- RUN: `.venv/bin/python -m pytest tests/test_buyer_network.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the endpoints — else STOP (playbook §5).
- [ ]

### Task 3.15 — Build buyer network views
- DO: Create `website/src/views/trade/BuyerDirectoryPage.tsx` (new) and `website/src/views/trade/BulkOrdersPage.tsx` (new) over the task-3.14 endpoints via `website/src/lib/api/seller.ts`; register both in the trade pages registry (`website/src/views/trade/index.ts` `TRADE_PAGES`) and routes if the pattern requires it. Strings via `t()` en+hi.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the views/registry — else STOP (playbook §5).
- [ ]

### Task 3.16 — Gate rates and procurement on shop KYC
- PRECONDITION: `grep -rln "kyc" backend/app/routers/ backend/app/services/ | head -1` — if empty, STOP the phase (playbook §5): phase-00 KYC pipeline missing.
- DO: Edit `backend/app/routers/seller.py` and `backend/app/routers/purchases.py`: shop KYC (S1) via the phase-00 pipeline gates rate posting and procurement — unverified shop → 403 with the entitlement/KYC error envelope (rule 7). Create `backend/tests/test_shop_kyc_gate.py` (new) covering both 403s.
- RUN: `.venv/bin/python -m pytest tests/test_shop_kyc_gate.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the gate — else STOP (playbook §5).
- [ ]

### Task 3.17 — Add vyapari dashboard summary
- DO: Edit `backend/app/routers/seller.py`: dashboard summary returns today's procurement (quantity + integer paisa), pending farmer payments (trust-critical, pinned), stock position, rate-posting status vs mandi band, open offers/negotiations, udhaar outstanding, and settlement ETA (instructions.md §WS-03 step 7). Add a test asserting the fields exist.
- RUN: `.venv/bin/python -m pytest tests/test_seller_sales_ledgers.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the summary — else STOP (playbook §5).
- [ ]

### Task 3.18 — Extend vyapari commission config and entitlements
- PRECONDITION: `grep -rln "entitlement" backend/app/ | head -1` — if empty, STOP the phase (playbook §5): phase-00 billing entitlements missing.
- DO: Edit `backend/app/services/settlements.py`: extend `platform_config/settlements` with the vyapari commission 2% min ₹50 (effective-dated, versioned, maker-checker — instructions.md §WS-03 step 8). Edit `backend/app/routers/seller.py`: entitlements — Free = commission 2% min ₹50 + basic khata; Pro ₹999/mo = analytics v2, udhaar ledger, GST invoices, unlimited procurement staff seats; Enterprise = multi-shop, API, white-label rate boards — gated server-side. Create `backend/tests/test_vyapari_entitlements.py` (new) covering the min-₹50 floor and one Pro gate.
- RUN: `.venv/bin/python -m pytest tests/test_vyapari_entitlements.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the config/gate — else STOP (playbook §5).
- [ ]

### Task 3.19 — Assert audit_logs and no external payments
- DO: Edit `backend/app/routers/purchases.py` / `seller.py` so every payment-status mutation writes `audit_logs` (rule 3) — add a test to `backend/tests/test_procurement_payment.py` asserting it. Then verify no external payment links anywhere in the trade module (rule 4).
- RUN: `.venv/bin/python -m pytest tests/test_procurement_payment.py -q && grep -rni "paytm\|phonepe\|upi://\|gpay" website/src/views/trade/ | wc -l` (cwd `backend/` then repo root)
- EXPECT: tests pass; grep count is `0`.
- IF FAIL: add the audit write / remove the external link — else STOP (playbook §5).
- [ ]

### Task 3.20 — HUMAN CHECK: bahi-khata day flow
- PRECONDITION: `curl -s http://localhost:8000/v1/health` — if it does not return `"status":"ok"`, redo task 1.27 first.
- DO: HUMAN CHECK: with backend + `cd website && pnpm dev` running, run a full bahi-khata day from the dashboard: (1) post a rate inside the band → accepted; (2) post a rate outside the band → inline 422 band message, no alert; (3) try editing a rate older than 2 h → 422; (4) create a procurement with a weighbridge slip photo; (5) as farmer, see the "payment pending" trust card, then the paid receipt after mark-paid; (6) udhaar ledger reconciles to zero; (7) download the GST invoice PDF and the TDS 194-O statement; (8) on a fresh vyapari account, confirm the 4th booking and >₹50k escrow are blocked, and the "Verified Vyapari" badge appears after the tier is earned.
- RUN: human performs the flow above
- EXPECT: every step completes (instructions.md §WS-03 Acceptance).
- IF FAIL: note the exact failing step and fix the named file — else STOP (playbook §5).
- [ ]

### Task 3.21 — Checkpoint WS-03
- DO: Run the workstream verification block (instructions.md §WS-03 Verification), then commit.
- RUN: `.venv/bin/python -m pytest -q` (cwd `backend/`) then `pnpm exec tsc --noEmit && pnpm build` (cwd `website/`) then `git add -A && git commit -m "phase-02 WS-03: Vyapari FarmLink close-out"` (repo root)
- EXPECT: pytest fully green; tsc + build clean; commit created.
- IF FAIL: fix the failing check — never weaken a test; if only the git commit fails, note it and continue (playbook §6) — else STOP (playbook §5).
- [ ]

## WS-04 — Equipment Owner "MachineBazaar" close-out  (see instructions.md §WS-04)

### Task 4.1 — Verify WS-04 read-first files exist
- DO: No edits. Confirm every file instructions.md §WS-04 "Read first" names exists.
- RUN: `test -f website/src/views/equipment/EquipmentOwnerHomeBoard.tsx && test -f website/src/views/equipment/index.tsx && test -f website/src/lib/api/equipmentOwner.ts && test -f backend/app/routers/equipment_owner.py && test -f backend/app/routers/equipment.py && test -f backend/tests/test_equipment_owner.py && test -f backend/tests/test_equipment.py && test -f backend/tests/test_equipment_approve.py && test -f "features/farm_equipment owner.md" && grep -q "equipmentRentalPct" backend/app/services/settlements.py`
- EXPECT: exit 0.
- IF FAIL: a "Read first" file is missing — STOP the phase (playbook §5) with the failing path.
- [ ]

### Task 4.2 — Create equipment FleetPage view
- DO: Create `website/src/views/equipment/FleetPage.tsx` (new): machine fleet list + add/edit machine, moved out of `EquipmentOwnerHomeBoard.tsx`, calling `website/src/lib/api/equipmentOwner.ts`. Strings via `t()`; no `alert()`/`confirm()` — toast/modal only (rule 6).
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix type errors in the new file only — else STOP (playbook §5).
- [ ]

### Task 4.3 — Create equipment BookingQueuePage view
- DO: Create `website/src/views/equipment/BookingQueuePage.tsx` (new): booking queue with approve / reject / counter actions, moved out of the monolith. Strings via `t()`; no `alert()`.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix type errors in the new file only — else STOP (playbook §5).
- [ ]

### Task 4.4 — Create equipment DispatchPage view
- DO: Create `website/src/views/equipment/DispatchPage.tsx` (new): dispatch view with the dispatch timeline (machines out + return). Strings via `t()`; no `alert()`.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix type errors in the new file only — else STOP (playbook §5).
- [ ]

### Task 4.5 — Create equipment DamageClaimsPage view
- DO: Create `website/src/views/equipment/DamageClaimsPage.tsx` (new): damage-claim list + file-claim form with before/after photos. Strings via `t()`; no `alert()`.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix type errors in the new file only — else STOP (playbook §5).
- [ ]

### Task 4.6 — Create equipment MaintenancePage view
- DO: Create `website/src/views/equipment/MaintenancePage.tsx` (new): maintenance log per machine + next-service-due display. Strings via `t()`; no `alert()`.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix type errors in the new file only — else STOP (playbook §5).
- [ ]

### Task 4.7 — Create equipment RoiAnalyticsPage view
- DO: Create `website/src/views/equipment/RoiAnalyticsPage.tsx` (new): per-machine ROI analytics. Strings via `t()`; no `alert()`.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix type errors in the new file only — else STOP (playbook §5).
- [ ]

### Task 4.8 — Register EQUIPMENT_PAGES and routes
- DO: In `website/src/views/equipment/index.tsx` export an `EQUIPMENT_PAGES` map for the pages from tasks 4.2–4.7 plus the existing `EquipmentOwnerHomeBoard` (pattern: `TRANSPORT_PAGES`). Merge it into `website/src/views/dashboard/ToolPage.tsx` and add deep routes in `website/src/App.tsx` (transport deep-route pattern). Remove every `alert()` left in the equipment module; trim the moved sections out of `EquipmentOwnerHomeBoard.tsx` so each renders in exactly one place. Remove demo fallbacks the monolith carried (rule 1: no `?? <hardcoded>` fallbacks in new code).
- RUN: `pnpm exec tsc --noEmit && grep -rn "alert(\|confirm(" src/views/equipment/ | wc -l` (cwd `website/`)
- EXPECT: tsc exit 0; grep count is `0`.
- IF FAIL: fix wiring / remove remaining dialogs — else STOP (playbook §5).
- [ ]

### Task 4.9 — Create farmer machine-browse view
- DO: Create `website/src/views/farmer/EquipmentBrowsePage.tsx` (new, toolId `equipment`): browse machines near me using the existing farmer-face endpoints in `backend/app/routers/equipment.py` via an API wrapper. Strings via `t()` with keys added to new locale splits `website/src/lib/i18n/locales/en.equipment.ts` and `hi.equipment.ts` (new, same shape as `en.broker.ts`) imported in `website/src/main.tsx` below the landlord imports.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the new view — else STOP (playbook §5).
- [ ]

### Task 4.10 — Create farmer slot booking views
- DO: Create `website/src/views/farmer/EquipmentSlotsPage.tsx` (new): slot calendar + book / waitlist / cancel actions calling the existing slots/book/waitlist/cancel endpoints in `backend/app/routers/equipment.py` (backend already exists — this is pure web build plus i18n). Wire both farmer equipment views into the farmer `PROFILE_ROUTES` toolId `equipment` in `website/src/lib/dashboard.ts` and `ToolPage.tsx`/`App.tsx` as the registry pattern requires. Strings via `t()` en+hi.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the views/wiring — else STOP (playbook §5).
- [ ]

### Task 4.11 — Add maintenance log and reminders
- DO: Edit `backend/app/routers/equipment_owner.py`: maintenance log per machine (E3) plus a service-due schedule field on the machine doc (hours-based or date-based); service-due reminders emitted as dashboard tasks via `emit_task()`. Create `backend/tests/test_equipment_maintenance.py` (new) covering log append + due-reminder emission.
- RUN: `.venv/bin/python -m pytest tests/test_equipment_maintenance.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the maintenance logic — else STOP (playbook §5).
- [ ]

### Task 4.12 — Add damage deposit claims
- DO: Edit `backend/app/routers/equipment_owner.py`: damage-deposit claims (E5) with before/after photos, claim amount in integer paisa, owner-filed → admin-arbitrable status flow (`open → resolved`). Create `backend/tests/test_equipment_damage.py` (new) covering the transitions.
- RUN: `.venv/bin/python -m pytest tests/test_equipment_damage.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the claim flow — else STOP (playbook §5).
- [ ]

### Task 4.13 — Add equipment KYC gate
- PRECONDITION: `grep -rln "kyc" backend/app/routers/ backend/app/services/ | head -1` — if empty, STOP the phase (playbook §5): phase-00 KYC pipeline missing.
- DO: Edit `backend/app/routers/equipment_owner.py`: RC / insurance / operator licence via the phase-00 KYC pipeline (E1) with mid-season expiry handling — expired insurance blocks NEW bookings but not in-flight ones; expiry tasks emitted 30 / 7 / 1 days out via `emit_task()`. Create `backend/tests/test_equipment_kyc.py` (new) covering new-booking block + in-flight allowed.
- RUN: `.venv/bin/python -m pytest tests/test_equipment_kyc.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the gate — else STOP (playbook §5).
- [ ]

### Task 4.14 — Add pricing engine quote
- DO: Edit `backend/app/routers/equipment.py` / `equipment_owner.py`: machine doc carries `pricing: {hourly?, perAcre?, package?}` and booking quote computation uses it (integer paisa). Create `backend/tests/test_equipment_pricing.py` (new) covering an hourly quote, a per-acre quote, and a package quote.
- RUN: `.venv/bin/python -m pytest tests/test_equipment_pricing.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the quote math — else STOP (playbook §5).
- [ ]

### Task 4.15 — Add FPO auto-confirm bookings
- DO: Edit `backend/app/routers/equipment.py`: FPO bookings auto-confirm while private bookings stay manual-approve (instructions.md §WS-04 step 6); edit `website/src/views/equipment/BookingQueuePage.tsx` to surface the FPO-auto-confirm vs private-manual distinction (`t()` en+hi). Add a test to `backend/tests/test_equipment_approve.py` covering both paths.
- RUN: `.venv/bin/python -m pytest tests/test_equipment_approve.py -q` (cwd `backend/`) then `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: tests pass; tsc exit 0.
- IF FAIL: fix the failing side — else STOP (playbook §5).
- [ ]

### Task 4.16 — Add dispatch check-in pins
- DO: Edit `backend/app/routers/equipment_owner.py`: manual/event location pins at dispatch and at return (E4-lite — no GPS tracker for v1); edit `website/src/views/equipment/DispatchPage.tsx` to render the pins on the dispatch timeline. Create `backend/tests/test_equipment_checkin.py` (new) asserting both pins persist.
- RUN: `.venv/bin/python -m pytest tests/test_equipment_checkin.py -q` (cwd `backend/`) then `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: tests pass; tsc exit 0.
- IF FAIL: fix the failing side — else STOP (playbook §5).
- [ ]

### Task 4.17 — Wire real 12% equipment payouts
- PRECONDITION: `grep -rln "payout" backend/app/services/ | head -1` — if empty, STOP the phase (playbook §5): phase-00 RazorpayX payout client missing.
- DO: Edit `backend/app/services/settlements.py` / `backend/app/routers/jobs.py`: weekly equipment settlement payout moves real money via the phase-00 RazorpayX client at 12% commission (`platform_config/settlements.equipmentRentalPct`); `audit_logs` on every mutation (rule 3); integer paisa. Create `backend/tests/test_equipment_payouts.py` (new) with the payout client mocked/shimmed, asserting the payout row + 12% math.
- RUN: `.venv/bin/python -m pytest tests/test_equipment_payouts.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the payout wiring — else STOP (playbook §5).
- [ ]

### Task 4.18 — Add owner dashboard summary
- DO: Edit `backend/app/routers/equipment_owner.py`: dashboard summary returns machines + today's utilization, pending approvals, machines out now + return ETA, damage claims open, next service due, weekly income + next payout (integer paisa) (instructions.md §WS-04 step 9). Add a test asserting the fields exist.
- RUN: `.venv/bin/python -m pytest tests/test_equipment_owner.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the summary — else STOP (playbook §5).
- [ ]

### Task 4.19 — Enforce equipment entitlements
- PRECONDITION: `grep -rln "entitlement" backend/app/ | head -1` — if empty, STOP the phase (playbook §5): phase-00 billing entitlements missing.
- DO: Edit `backend/app/routers/equipment_owner.py`: gate on entitlement — Free = 1 machine; Pro ₹399/mo = 5 machines, analytics, maintenance suite, priority listing; Enterprise = fleet unlimited, operator management, API. Create `backend/tests/test_equipment_entitlements.py` (new) covering the Free-tier machine limit.
- RUN: `.venv/bin/python -m pytest tests/test_equipment_entitlements.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the gate — else STOP (playbook §5).
- [ ]

### Task 4.20 — HUMAN CHECK: equipment book-to-payout flow
- PRECONDITION: `curl -s http://localhost:8000/v1/health` — if it does not return `"status":"ok"`, redo task 1.27 first.
- DO: HUMAN CHECK: with backend + `cd website && pnpm dev` running: (1) as farmer, book a tractor slot from the browse screen in under 60 seconds; (2) as owner, approve in BookingQueuePage (confirm FPO auto-confirm vs private manual distinction shows); (3) add the dispatch check-in pin, then the return pin on the timeline; (4) file a damage claim with before/after photos; (5) add a service log entry and confirm the next-service-due reminder task; (6) run the settlement job and confirm the 12% payout row reconciles with the settlement doc; (7) confirm no `alert()` appears anywhere in the module.
- RUN: human performs the flow above
- EXPECT: every step completes (instructions.md §WS-04 Acceptance).
- IF FAIL: note the exact failing step and fix the named file — else STOP (playbook §5).
- [ ]

### Task 4.21 — Checkpoint WS-04
- DO: Run the workstream verification block (instructions.md §WS-04 Verification), then commit.
- RUN: `.venv/bin/python -m pytest -q` (cwd `backend/`) then `pnpm exec tsc --noEmit && pnpm build` (cwd `website/`) then `git add -A && git commit -m "phase-02 WS-04: Equipment MachineBazaar close-out"` (repo root)
- EXPECT: pytest fully green; tsc + build clean; commit created.
- IF FAIL: fix the failing check — never weaken a test; if only the git commit fails, note it and continue (playbook §6) — else STOP (playbook §5).
- [ ]

## WS-05 — Broker "DealDesk" close-out  (see instructions.md §WS-05)

### Task 5.1 — Verify WS-05 read-first files exist
- DO: No edits. Confirm every file instructions.md §WS-05 "Read first" names exists.
- RUN: `test -f backend/app/routers/broker.py && test -f backend/app/routers/farmer_deals.py && test -f backend/app/models/broker.py && test -f backend/app/routers/ratings.py && test -f backend/tests/test_broker_deals.py && test -f website/src/views/broker/DealsPage.tsx && test -f website/src/views/farmer/FarmerOffersPage.tsx && test -f website/src/views/farmer/FarmerDealDetailPage.tsx && test -f website/src/lib/api/broker.ts && test -f website/src/components/broker/DealMathCard.tsx && test -f website/src/components/broker/OfferCard.tsx && test -f website/src/components/broker/MaskedPhoneText.tsx && test -f website/src/components/broker/D4TextGuard.ts && test -f plan/broker_plan.md && grep -q "brokerPct" backend/app/services/settlements.py`
- EXPECT: exit 0.
- IF FAIL: a "Read first" file is missing — STOP the phase (playbook §5) with the failing path.
- [ ]

### Task 5.2 — Add offer expiresAt field
- DO: Edit `backend/app/routers/broker.py` and `backend/app/models/broker.py`: every deal offer gets `expiresAt` (ISO string) = creation + TTL, where TTL hours come from a config value (configurable 24–48 h, default 24 h — instructions.md §WS-05 step 1). Add a test to `backend/tests/test_broker_deals.py` asserting a new offer carries `expiresAt` ≈ 24 h out by default.
- RUN: `.venv/bin/python -m pytest tests/test_broker_deals.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the field — else STOP (playbook §5).
- [ ]

### Task 5.3 — Add offer auto-expire job
- DO: Edit the broker offer code path (or the jobs module): an auto-expire job flips stale `negotiating` offers past `expiresAt` to `expired`. Create `backend/tests/test_broker_offer_ttl.py` (new) covering: fresh offer stays `negotiating`, stale offer flips to `expired`.
- RUN: `.venv/bin/python -m pytest tests/test_broker_offer_ttl.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the job — else STOP (playbook §5).
- [ ]

### Task 5.4 — Add TTL countdown chip
- DO: Edit `website/src/components/broker/OfferCard.tsx`: alongside the existing "sent Xh ago" display, add a TTL countdown chip driven by `expiresAt`. Strings via `t()` with keys in BOTH `en.broker.ts` and `hi.broker.ts`.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the chip — else STOP (playbook §5).
- [ ]

### Task 5.5 — Add 3-round counter cap
- DO: Edit `backend/app/routers/broker.py` and `backend/app/routers/farmer_deals.py`: track counter rounds per deal; at round 3 the deal locks — further counters → 422, only accept/decline remain (instructions.md §WS-05 step 2). Create `backend/tests/test_broker_counter_cap.py` (new) covering rounds 1–2 allowed, round-3 lock, counter-after-lock → 422.
- RUN: `.venv/bin/python -m pytest tests/test_broker_counter_cap.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the cap — else STOP (playbook §5).
- [ ]

### Task 5.6 — Add deadlock resolution path
- DO: Edit `backend/app/routers/broker.py`: a locked deal (task 5.5) offers a mediator/admin resolution action that creates an admin-queue record (console UI is phase-07). Add a test to `backend/tests/test_broker_counter_cap.py` covering the deadlock → mediator record.
- RUN: `.venv/bin/python -m pytest tests/test_broker_counter_cap.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the path — else STOP (playbook §5).
- [ ]

### Task 5.7 — Extend evidence into typed vault
- DO: Edit `backend/app/routers/broker.py`: extend the existing evidence upload `POST /broker/deals/{id}/evidence` (kind-capped) into a typed vault (B4) with kinds `weigh_slip`, `quality_report`, `payment_proof`; both parties can view the vault post-acceptance, not before. Create `backend/tests/test_broker_vault.py` (new) covering kind validation + post-acceptance visibility.
- RUN: `.venv/bin/python -m pytest tests/test_broker_vault.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the vault — else STOP (playbook §5).
- [ ]

### Task 5.8 — Add buyer requirement postings
- DO: Edit `backend/app/routers/broker.py`: new collection + endpoints (B3) for buyer requirement postings ("need 50q onion @ ₹X") that brokers/farmers can respond to; wire responses into the lead pipeline reusing the existing "Make deal" prefill. Create `backend/tests/test_broker_requirements.py` (new) covering post + respond.
- RUN: `.venv/bin/python -m pytest tests/test_broker_requirements.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the endpoints — else STOP (playbook §5).
- [ ]

### Task 5.9 — Wire broker commission payout
- PRECONDITION: `grep -rln "payout" backend/app/services/ | head -1` — if empty, STOP the phase (playbook §5): phase-00 RazorpayX payout client missing.
- DO: Edit `backend/app/services/settlements.py` / `backend/app/routers/jobs.py`: weekly broker settlement → real RazorpayX payout to the broker's verified bank account (B6) at `platform_config/settlements.brokerPct` (2); integer paisa; `audit_logs` (rule 3). Create `backend/tests/test_broker_payouts.py` (new) with the payout client mocked/shimmed.
- RUN: `.venv/bin/python -m pytest tests/test_broker_payouts.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the payout wiring — else STOP (playbook §5).
- [ ]

### Task 5.10 — Add Razorpay split at capture
- PRECONDITION: `grep -rln "razorpay" backend/app/services/payments.py` — if empty, STOP the phase (playbook §5): phase-00 money rails missing.
- DO: Edit `backend/app/routers/farmer_deals.py` / `backend/app/services/payments.py`: buyer payment splits at capture into farmer leg + commission leg via the phase-00 Razorpay route/split integration (B7); never hold money outside the escrow/settlement rails (rule 3); integer paisa. Create `backend/tests/test_broker_split.py` (new) covering the split math: farmer leg + commission leg == gross.
- RUN: `.venv/bin/python -m pytest tests/test_broker_split.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the split — else STOP (playbook §5).
- [ ]

### Task 5.11 — Add broker KYC documents
- PRECONDITION: `grep -rln "kyc" backend/app/routers/ backend/app/services/ | head -1` — if empty, STOP the phase (playbook §5): phase-00 KYC pipeline missing.
- DO: Edit `backend/app/routers/broker.py`: broker licence/GST documents go through the phase-00 KYC pipeline (B1). Add a test to `backend/tests/test_broker_deals.py` covering an unverified broker blocked from the gated action with the error envelope.
- RUN: `.venv/bin/python -m pytest tests/test_broker_deals.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the KYC wiring — else STOP (playbook §5).
- [ ]

### Task 5.12 — Add Proven Broker tier and SLA
- DO: Edit `backend/app/routers/broker.py`: "Proven Broker" trust tier with a 48–72 h approval SLA (B1); the SLA clock is visible to the broker (field on the KYC/tier record); SLA breach escalates to the admin queue. Create `backend/tests/test_broker_kyc_sla.py` (new) covering SLA-breach escalation.
- RUN: `.venv/bin/python -m pytest tests/test_broker_kyc_sla.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the SLA logic — else STOP (playbook §5).
- [ ]

### Task 5.13 — Persist two-sided deal ratings
- DO: Edit `backend/app/routers/ratings.py`: two-sided ratings on completed deals persisted server-side (broker ↔ farmer), one rating per party per completed deal. Edit `website/src/views/farmer/FarmerDealDetailPage.tsx` to call this API, replacing the current localStorage fallback (remove the fallback — rule 1). Create `backend/tests/test_deal_ratings.py` (new) covering both sides + duplicate rejection.
- RUN: `.venv/bin/python -m pytest tests/test_deal_ratings.py -q` (cwd `backend/`) then `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: tests pass; tsc exit 0; no localStorage rating fallback remains.
- IF FAIL: fix the failing side — else STOP (playbook §5).
- [ ]

### Task 5.14 — Add deal dispute workflow
- DO: Edit `backend/app/routers/broker.py`: dispute record on a deal with fields `{dealId, category, evidenceFreeze: true, slaTimer, status: "open", createdBy, createdAt}` wired to the admin-queue endpoints (instructions.md §WS-05 step 9). Create `backend/tests/test_broker_disputes.py` (new) covering create + evidence freeze + SLA field.
- RUN: `.venv/bin/python -m pytest tests/test_broker_disputes.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the workflow — else STOP (playbook §5).
- [ ]

### Task 5.15 — Add broker dashboard summary
- DO: Edit `backend/app/routers/broker.py`: dashboard summary returns active deals by stage (pipeline), new leads, offers awaiting response + TTL countdown, deals needing evidence, commission earned/pending/paid (integer paisa), and network size (farmers/buyers saved) (instructions.md §WS-05 step 10). Add a test asserting the fields exist.
- RUN: `.venv/bin/python -m pytest tests/test_broker_deals.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the summary — else STOP (playbook §5).
- [ ]

### Task 5.16 — Enforce broker entitlements and commission stack
- PRECONDITION: `grep -rln "entitlement" backend/app/ | head -1` — if empty, STOP the phase (playbook §5): phase-00 billing entitlements missing.
- DO: Edit `backend/app/routers/broker.py` and `backend/app/services/settlements.py`: Free = 5 active deals at 2% commission; Pro ₹799/mo = unlimited deals, CRM bulk tools, mandi-trend analytics, priority leads. Commission is NEVER replaced by the subscription — they stack. `brokerPct` stays configurable 0–10 in `platform_config/settlements` (effective-dated, maker-checker). Create `backend/tests/test_broker_entitlements.py` (new) covering the 5-deal Free cap and commission-still-applies-on-Pro.
- RUN: `.venv/bin/python -m pytest tests/test_broker_entitlements.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the gate/stack — else STOP (playbook §5).
- [ ]

### Task 5.17 — Add server-side deal message moderation
- DO: Edit the deal message code path (`backend/app/routers/broker.py` / chat service): server-side moderation regex rejecting phone numbers, UPI IDs, and external links in deal messages + a strike ladder per sender (rule 4). Create `backend/tests/test_broker_moderation.py` (new) covering: message with phone → rejected + strike; N strikes → restricted.
- RUN: `.venv/bin/python -m pytest tests/test_broker_moderation.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the moderation — else STOP (playbook §5).
- [ ]

### Task 5.18 — Sweep broker masked surfaces and locale parity
- DO: No new features. Verify `MaskedPhoneText` + `D4TextGuard` wrap every phone/text surface in the broker module, and full en/hi parity for broker keys (rule 6).
- RUN: `grep -rn "alert(\|confirm(" website/src/views/broker/ website/src/views/farmer/ ; diff <(grep -oE "^  [a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.broker.ts | sort) <(grep -oE "^  [a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.broker.ts | sort)`
- EXPECT: the grep returns nothing; the diff produces no output.
- IF FAIL: wrap the surface / add the missing locale keys — else STOP (playbook §5).
- [ ]

### Task 5.19 — Seed and soak 50 concurrent deals
- DO: Create `backend/tests/test_broker_soak.py` (new): seed 50 concurrent deals and drive each through its stages (offer → counter → contract → accept → evidence → completed) asserting no errors and that the commission ledger reconciles: Σ deal commissions == settlement gross (instructions.md §WS-05 Acceptance).
- RUN: `.venv/bin/python -m pytest tests/test_broker_soak.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the stage transitions/ledger — never weaken the test — else STOP (playbook §5).
- [ ]

### Task 5.20 — HUMAN CHECK: broker deal lifecycle
- PRECONDITION: `curl -s http://localhost:8000/v1/health` — if it does not return `"status":"ok"`, redo task 1.27 first.
- DO: HUMAN CHECK: with backend + `cd website && pnpm dev` running: (1) create a deal, counter three times — confirm the round-3 lock forces accept/decline and the mediator option appears; (2) confirm an offer expires at its TTL with the countdown chip visible; (3) complete contract → accept → upload weigh slip / quality report / payment proof to the evidence vault → completed; (4) rate the deal from both sides (confirm no localStorage fallback); (5) run the settlement job and confirm the RazorpayX payout row and the split payment crediting farmer leg and commission leg separately; (6) in the browser devtools DOM, search rendered broker/farmer deal pages for an unmasked phone number pattern.
- RUN: human performs the flow above
- EXPECT: every step completes; DOM grep finds no unmasked phone (instructions.md §WS-05 Acceptance).
- IF FAIL: note the exact failing step and fix the named file — else STOP (playbook §5).
- [ ]

### Task 5.21 — Checkpoint WS-05
- DO: Run the workstream verification block (instructions.md §WS-05 Verification), then commit.
- RUN: `.venv/bin/python -m pytest -q` (cwd `backend/`) then `pnpm exec tsc --noEmit && pnpm build` (cwd `website/`) then `git add -A && git commit -m "phase-02 WS-05: Broker DealDesk close-out"` (repo root)
- EXPECT: pytest fully green; tsc + build clean; commit created.
- IF FAIL: fix the failing check — never weaken a test; if only the git commit fails, note it and continue (playbook §6) — else STOP (playbook §5).
- [ ]

## WS-06 — AI spoke decisions (M4, M16, M19, M24, M25)  (see instructions.md §WS-06)

### Task 6.1 — Verify AI foundation dependency
- PRECONDITION: `test -d backend/app/services/ai && test -f backend/app/services/ai/gateway.py && test -f backend/app/services/ai/question_sets.py && test -f backend/app/services/ai/privacy.py` — if this fails, STOP the phase (playbook §5): phase-00 brief M1 is missing.
- DO: No edits. Confirm the gateway API surface and golden fixtures exist.
- RUN: `grep -n "def decide\|def generate\|def analyze_image" backend/app/services/ai/gateway.py && test -d backend/tests/fixtures/ai/golden && grep -rn "ai_decisions" backend/app/services/ai/ | head -3`
- EXPECT: all three functions listed; golden dir exists; `ai_decisions` referenced.
- IF FAIL: STOP the phase (playbook §5) — the phase-00 AI foundation is incomplete.
- [ ]

### Task 6.2 — Register seller.rate_check.v1 question set
- DO: Edit `backend/app/services/ai/question_sets.py`: register `seller.rate_check.v1` with schema `{within_fair_band: bool, manipulation_signal: float}`, its threshold, and its deterministic fallback (the static ±25% band rule). Add flag keys: `seller_rate_check` under `platform_config/ai.modules`, its threshold under `platform_config/ai.thresholds`, and `suggest` under `platform_config/ai.automation` (instructions.md §WS-06 intro). Automation is suggest-level only — annotate only (rule 12).
- RUN: `.venv/bin/python -c "from app.services.ai import question_sets; print('ok')"` (cwd `backend/`)
- EXPECT: prints `ok`, exit 0.
- IF FAIL: fix the registration syntax — else STOP (playbook §5).
- [ ]

### Task 6.3 — Build rate-check privacy state
- DO: Edit `backend/app/services/ai/privacy.py`: add the M4 state builder producing `{posted rate, crop, mandi modal, 7-day volatility, seller history}` — pseudonymized, ≤1,500 tokens, and NO Aadhaar/phone/email in the payload (rule 11).
- RUN: `.venv/bin/python -c "from app.services.ai import privacy; print('ok')"` (cwd `backend/`)
- EXPECT: prints `ok`, exit 0.
- IF FAIL: fix the builder — else STOP (playbook §5).
- [ ]

### Task 6.4 — Wire rate check into rates endpoint
- DO: Edit `backend/app/routers/seller.py` `POST /seller/rates`: build state via the task-6.3 builder, then `result = await gateway.decide(state, "seller.rate_check.v1", ctx)` — never call OpenRouter/Gemini from the router (rule 10). `within_fair_band == false` → 422 with the band in the error payload (the static ±25% rule remains the fallback); `manipulation_signal > 0.8` → write the rate AND flag `admin_review`. On exception/timeout/low budget → fallback to the static rule and log with `fallbackUsed`.
- RUN: `.venv/bin/python -c "from app.routers import seller; print('ok')"` (cwd `backend/`)
- EXPECT: prints `ok`, exit 0.
- IF FAIL: fix the wiring — else STOP (playbook §5).
- [ ]

### Task 6.5 — Add flagged-rates admin stub route
- DO: Edit `backend/app/routers/admin.py`: add a stub route listing rates flagged `admin_review` by M4 (stub admin route acceptable per instructions.md §WS-06 step 1; full console is phase-07).
- RUN: `.venv/bin/python -c "from app.routers import admin; print('ok')"` (cwd `backend/`)
- EXPECT: prints `ok`, exit 0.
- IF FAIL: fix the route — else STOP (playbook §5).
- [ ]

### Task 6.6 — Show AI band warning in RatesPage
- DO: Edit `website/src/views/trade/RatesPage.tsx`: render the AI-enriched band + warning from the 422 payload inline (extends task 3.3's display; no `alert()`). Strings via `t()` en+hi.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the display — else STOP (playbook §5).
- [ ]

### Task 6.7 — Add nightly procurement forecast job
- DO: Create `backend/app/services/seller_forecast.py` (new, following the scheduled-job shape of `backend/app/services/rent_reminders.py`): nightly job per seller over 90-day procurement/sales → call `gateway.generate()` (SGR — Gemini generation only via the gateway) → validate `{suggested_procurement: [{crop, qty_quintal, reason}]}` with Pydantic incl. one repair retry → cache 24 h (per seller/decision_id, never per page-view) → log cost → fallback = static en/hi template text (catalog C4).
- RUN: `.venv/bin/python -c "import app.main; print('ok')"` (cwd `backend/`)
- EXPECT: prints `ok`, exit 0.
- IF FAIL: fix the job module — else STOP (playbook §5).
- [ ]

### Task 6.8 — Add forecast card to seller dashboard
- DO: Edit the seller dashboard view (`website/src/views/trade/` home/analytics — read `website/src/views/trade/index.ts` to find it): render the procurement-forecast card from the cached job output; hide the card when the payload fails validation (instructions.md §WS-06 Acceptance: "forecast validates or hides"). Strings via `t()` en+hi.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the card — else STOP (playbook §5).
- [ ]

### Task 6.9 — Test M4 rate check
- DO: Create `backend/tests/test_ai_seller_rate_check.py` (new): (1) golden fixture from `backend/tests/fixtures/ai/golden/` passes on `AI_PROVIDER=shim`; (2) fallback test with the gateway raising → static ±25% rule still decides and `fallbackUsed` is logged; (3) flag-off test (`seller_rate_check` off in `platform_config/ai.modules`) proving rate posting works without AI.
- RUN: `AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_ai_seller_rate_check.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the call site/question set — never weaken the test — else STOP (playbook §5).
- [ ]

### Task 6.10 — Register transport.match.v1 question set
- DO: Edit `backend/app/services/ai/question_sets.py`: register `transport.match.v1` with schema `{fit: float (per vehicle/load, batch), noshow_risk: float}`, threshold, and fallback = distance sort. Flag keys: `transport_match` in `platform_config/ai.modules` / thresholds / automation=`suggest`.
- RUN: `.venv/bin/python -c "from app.services.ai import question_sets; print('ok')"` (cwd `backend/`)
- EXPECT: prints `ok`, exit 0.
- IF FAIL: fix the registration — else STOP (playbook §5).
- [ ]

### Task 6.11 — Add transport match batch scoring
- DO: Create `backend/app/services/transport_match.py` (new): batch-scoring job per new load/booking request building state (route fit, vehicle type, capacity, history) via `privacy.py` (no PII — rule 11) and calling `gateway.decide(state, "transport.match.v1", ctx)`; fallback = distance sort with `fallbackUsed` logged. Call it from `backend/app/routers/transport.py` on new load/booking creation.
- RUN: `.venv/bin/python -c "from app.routers import transport; print('ok')"` (cwd `backend/`)
- EXPECT: prints `ok`, exit 0.
- IF FAIL: fix the wiring — else STOP (playbook §5).
- [ ]

### Task 6.12 — Rank return-load card with M16
- DO: Edit the return-load code path from task 2.9: on trip completion, rank the deterministic return-load query results with `transport.match.v1` (flow 5.5) — annotate/reorder only at `suggest`; distance-sort order remains the fallback.
- RUN: `.venv/bin/python -m pytest tests/test_transport_return_loads.py -q` (cwd `backend/`)
- EXPECT: all tests pass (deterministic behavior unchanged when the flag is off).
- IF FAIL: fix the ranking hook — else STOP (playbook §5).
- [ ]

### Task 6.13 — Add no-show risk badge
- DO: Edit `website/src/views/transport/JobInboxPage.tsx` and the bid-accept screen: render the no-show risk badge from `noshow_risk` (suggest-level annotation only). Strings via `t()` en+hi.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the badge — else STOP (playbook §5).
- [ ]

### Task 6.14 — Register transport outcome hooks
- DO: Edit the M16 call-site module: register outcome hooks recording `completed` / `cancelled` outcomes back to the AI module (instructions.md §WS-06 SDR step 6).
- RUN: `.venv/bin/python -c "import app.main; print('ok')"` (cwd `backend/`)
- EXPECT: prints `ok`, exit 0.
- IF FAIL: fix the hook — else STOP (playbook §5).
- [ ]

### Task 6.15 — Test M16 transport matching
- DO: Create `backend/tests/test_ai_transport_match.py` (new): (1) golden fixture on shim — matched suggestions beat the distance-only baseline on the golden set (instructions.md §WS-06 Acceptance); (2) fallback test with gateway raising → distance sort; (3) flag-off test.
- RUN: `AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_ai_transport_match.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the call site/question set — else STOP (playbook §5).
- [ ]

### Task 6.16 — Register broker.lead_score.v1 question set
- DO: Edit `backend/app/services/ai/question_sets.py`: register `broker.lead_score.v1` with schema `{quality: float, deadlock_risk: float}`, threshold, fallback. Flag keys: `broker_lead_score` in `platform_config/ai.modules` / thresholds / automation=`suggest`.
- RUN: `.venv/bin/python -c "from app.services.ai import question_sets; print('ok')"` (cwd `backend/`)
- EXPECT: prints `ok`, exit 0.
- IF FAIL: fix the registration — else STOP (playbook §5).
- [ ]

### Task 6.17 — Score broker leads and annotate pipeline
- DO: Edit `backend/app/routers/broker.py`: score new leads via `gateway.decide(state, "broker.lead_score.v1", ctx)` with state (source, history, demand fit) built via `privacy.py`. Edit the broker pipeline dashboard view (`website/src/views/broker/LeadsPage.tsx`) to annotate scores. Suggest-level only.
- RUN: `.venv/bin/python -c "from app.routers import broker; print('ok')"` (cwd `backend/`) then `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: prints `ok`; tsc exit 0.
- IF FAIL: fix the failing side — else STOP (playbook §5).
- [ ]

### Task 6.18 — Add deadlock prediction at round 2
- DO: Edit `backend/app/routers/broker.py`: at round 2 of 3 on a deal, compute `deadlock_risk` from state (message count, price gap, TTL remaining) and surface the suggested mediator action feeding the WS-05 deadlock path (task 5.6). Suggest-level only (rule 12).
- RUN: `.venv/bin/python -m pytest tests/test_broker_counter_cap.py -q` (cwd `backend/`)
- EXPECT: all tests pass (WS-05 behavior unchanged with the flag off).
- IF FAIL: fix the hook — else STOP (playbook §5).
- [ ]

### Task 6.19 — Test M19 lead scoring
- DO: Create `backend/tests/test_ai_broker_lead_score.py` (new): (1) golden-deal fixture on shim; (2) document the measured correlation between high-deadlock predictions and actual deadlocks on the golden deals in a notes file next to the fixture (`backend/tests/fixtures/ai/golden/broker_lead_score_notes.md`, new — instructions.md §WS-06 Acceptance requires documenting it); (3) fallback test; (4) flag-off test.
- RUN: `AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_ai_broker_lead_score.py -q && test -f tests/fixtures/ai/golden/broker_lead_score_notes.md` (cwd `backend/`)
- EXPECT: tests pass; notes file exists.
- IF FAIL: fix the call site / write the notes — else STOP (playbook §5).
- [ ]

### Task 6.20 — Register equipment booking-rec question set
- DO: Edit `backend/app/services/ai/question_sets.py`: register `equipment.booking_rec.v1` with an approve-recommendation score schema, threshold, fallback. Flag keys: `equipment_booking_rec` in `platform_config/ai.modules` / thresholds / automation=`suggest`.
- RUN: `.venv/bin/python -c "from app.services.ai import question_sets; print('ok')"` (cwd `backend/`)
- EXPECT: prints `ok`, exit 0.
- IF FAIL: fix the registration — else STOP (playbook §5).
- [ ]

### Task 6.21 — Annotate owner booking queue with M24
- DO: Edit `backend/app/routers/equipment_owner.py`: approve-recommendation score on each booking request from state (renter history, slot conflicts, distance) via `gateway.decide(state, "equipment.booking_rec.v1", ctx)` — annotate only, never auto-approve (rule 12). Edit `website/src/views/equipment/BookingQueuePage.tsx` to show the score. Strings via `t()` en+hi.
- RUN: `.venv/bin/python -m pytest tests/test_equipment_approve.py -q` (cwd `backend/`) then `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: tests pass (behavior unchanged with flag off); tsc exit 0.
- IF FAIL: fix the failing side — else STOP (playbook §5).
- [ ]

### Task 6.22 — Add damage photo severity estimate
- DO: Edit the damage-claim code path from task 4.12: claim photos → `gateway.analyze_image()` (G-vision, only via the gateway — rule 10) returning severity estimate + suggested deduction band; SUGGEST-ONLY — owner/admin always confirms the final deduction (rule 12). Edit `website/src/views/equipment/DamageClaimsPage.tsx` to show the suggestion with an explicit confirm control.
- RUN: `.venv/bin/python -m pytest tests/test_equipment_damage.py -q` (cwd `backend/`) then `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: tests pass; tsc exit 0.
- IF FAIL: fix the failing side — else STOP (playbook §5).
- [ ]

### Task 6.23 — Test M24 equipment AI
- DO: Create `backend/tests/test_ai_equipment.py` (new): (1) golden damage set on shim — severity within ±1 band ≥ 75% (instructions.md §WS-06 Acceptance); (2) fallback test with gateway raising; (3) flag-off test proving the queue and damage flow work without AI.
- RUN: `AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_ai_equipment.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the call site/question set — else STOP (playbook §5).
- [ ]

### Task 6.24 — Register land.listing_quality.v1 question set
- DO: Edit `backend/app/services/ai/question_sets.py`: register `land.listing_quality.v1` with schema `{completeness: float, rent_band_ok: bool}`, threshold, fallback. Flag keys: `land_listing_quality` in `platform_config/ai.modules` / thresholds / automation=`suggest`.
- RUN: `.venv/bin/python -c "from app.services.ai import question_sets; print('ok')"` (cwd `backend/`)
- EXPECT: prints `ok`, exit 0.
- IF FAIL: fix the registration — else STOP (playbook §5).
- [ ]

### Task 6.25 — Add listing-quality scoring on save
- DO: Edit `backend/app/routers/land.py`: on listing save, call `gateway.decide(state, "land.listing_quality.v1", ctx)` → completeness score + actionable tips ("photo add karein" style) with en+hi strings, and rent vs village band check — band from real lease data where available, else district defaults LABELED as such (flow 5.9). Suggest-level only.
- RUN: `.venv/bin/python -m pytest tests/test_land.py tests/test_land_market.py -q` (cwd `backend/`)
- EXPECT: all tests pass (behavior unchanged with flag off).
- IF FAIL: fix the hook — else STOP (playbook §5).
- [ ]

### Task 6.26 — Add tenant compatibility score
- DO: Edit `backend/app/routers/land.py` and `website/src/views/landlord/RequestsInboxPage.tsx`: tenant-request compatibility score annotated on each request in the landlord's inbox (suggest-level). Strings via `t()` en+hi.
- RUN: `pnpm exec tsc --noEmit` (cwd `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the annotation — else STOP (playbook §5).
- [ ]

### Task 6.27 — Test M25 listing quality
- DO: Create `backend/tests/test_ai_land_listing.py` (new): (1) golden fixture on shim; (2) fallback test with gateway raising; (3) flag-off test; (4) assert tips render in both en and hi.
- RUN: `AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_ai_land_listing.py -q` (cwd `backend/`)
- EXPECT: all tests pass.
- IF FAIL: fix the call site/locale keys — else STOP (playbook §5).
- [ ]

### Task 6.28 — Verify ai_decisions logging fields
- DO: No new features. Verify every AI call site writes `ai_decisions` rows with cost + confidence + `fallbackUsed` (instructions.md §WS-06 Verification) and that no AI payload builder emits PII.
- RUN: `AI_PROVIDER=shim .venv/bin/python -m pytest tests/ -q -k "ai_" && grep -rn "fallbackUsed" backend/app/services/ai/ | wc -l && grep -rni "aadhaar\|phone\|email" backend/app/services/ai/privacy.py | grep -vi "mask\|pseudonym\|strip\|remove\|hash\|redact\|no_\|exclude" | wc -l` (cwd `backend/`)
- EXPECT: all `ai_` tests pass; `fallbackUsed` count ≥ 1; the PII grep count is `0` (only masking/stripping references allowed).
- IF FAIL: add the missing logging field / remove the PII from the payload builder — else STOP (playbook §5).
- [ ]

### Task 6.29 — Checkpoint WS-06
- DO: Run the workstream verification block (instructions.md §WS-06 Verification), then commit.
- RUN: `.venv/bin/python -m pytest -q` (cwd `backend/`) then `pnpm build` (cwd `website/`) then `git add -A && git commit -m "phase-02 WS-06: AI spoke decisions M4 M16 M19 M24 M25"` (repo root)
- EXPECT: pytest fully green (incl. golden-fixture shim tests, fallback tests, flag-off tests per brief); build clean; commit created.
- IF FAIL: fix the failing check — never weaken a test; if only the git commit fails, note it and continue (playbook §6) — else STOP (playbook §5).
- [ ]

## Phase-final gate

### Task F.1 — Run full backend suite
- DO: Run the global gate backend command (execution-plan/README.md §4).
- RUN: `.venv/bin/python -m pytest -q` (cwd `backend/`)
- EXPECT: fully green — 0 failed (rule 9).
- IF FAIL: fix the failing test's code — never delete the assertion — else STOP (playbook §5).
- [ ]

### Task F.2 — Run website typecheck and build
- DO: Run the global gate website command.
- RUN: `pnpm exec tsc --noEmit && pnpm build` (cwd `website/`)
- EXPECT: both clean, exit 0.
- IF FAIL: fix the type/build errors — else STOP (playbook §5).
- [ ]

### Task F.3 — Run full suite with AI shim
- DO: Re-run the entire backend suite with the shim provider (phase-final verification item 3).
- RUN: `AI_PROVIDER=shim .venv/bin/python -m pytest -q` (cwd `backend/`)
- EXPECT: fully green.
- IF FAIL: fix the shim-mode failure — else STOP (playbook §5).
- [ ]

### Task F.4 — Verify en/hi locale parity
- DO: Verify every new key exists in both `en.*` and `hi.*` for each locale file touched this phase (phase-final verification item 4).
- RUN: `for f in landlord transport trade broker equipment; do echo "== $f"; diff <(grep -oE "^  [a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.$f.ts | sort) <(grep -oE "^  [a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.$f.ts | sort); done` (repo root)
- EXPECT: no diff output under any `==` header.
- IF FAIL: add the missing key(s) to the locale file that lacks them — else STOP (playbook §5).
- [ ]

### Task F.5 — Verify monolith refactor wiring
- DO: Verify both monolith refactors are routed via registries + `App.tsx` with zero `alert()`/`confirm()` (readme exit gate item 6).
- RUN: `grep -n "LANDLORD_PAGES\|EQUIPMENT_PAGES" website/src/views/dashboard/ToolPage.tsx website/src/App.tsx website/src/views/landlord/index.tsx website/src/views/equipment/index.tsx && grep -rn "alert(\|confirm(\|prompt(" website/src/views/landlord/ website/src/views/equipment/ | wc -l`
- EXPECT: registry references found in all four files; dialog grep count is `0`.
- IF FAIL: complete the wiring / remove the dialogs — else STOP (playbook §5).
- [ ]

### Task F.6 — HUMAN CHECK: Landlord exit-gate flow
- PRECONDITION: `curl -s http://localhost:8000/v1/health` — if it does not return `"status":"ok"`, redo task 1.27 first.
- DO: HUMAN CHECK (readme exit gate item 1): as landlord, list a plot → farmer request → counter → e-sign lease → escrow milestone → rent received into a verified bank account → receipt PDF — zero offline steps, driven from the dashboard task deep-link to completion with no "coming soon" reachable.
- RUN: human performs the flow
- EXPECT: full loop completes; receipt PDF downloads.
- IF FAIL: note the failing step, fix the named file — else STOP (playbook §5).
- [ ]

### Task F.7 — HUMAN CHECK: Transporter exit-gate flow
- PRECONDITION: `curl -s http://localhost:8000/v1/health` — if it does not return `"status":"ok"`, redo task 1.27 first.
- DO: HUMAN CHECK (readme exit gate item 2): booking → KYC-verified vehicle accept → PWA pings → OTP POD → expenses → settlement run → RazorpayX payout row lands in the verified bank; farmer watches the vehicle en route live on My Trips.
- RUN: human performs the flow
- EXPECT: full loop completes end-to-end weekly-payout-ready.
- IF FAIL: note the failing step, fix the named file — else STOP (playbook §5).
- [ ]

### Task F.8 — HUMAN CHECK: Vyapari exit-gate flow
- PRECONDITION: `curl -s http://localhost:8000/v1/health` — if it does not return `"status":"ok"`, redo task 1.27 first.
- DO: HUMAN CHECK (readme exit gate item 3): rate post (band OK path + 422 out-of-band path) → procurement + weighbridge photo → farmer trust card "payment pending" → mark paid → udhaar ledger reconciles to zero → GST invoice + TDS statement download. The physical bahi-khata is fully replaced; payment tracking is farmer-visible and provable.
- RUN: human performs the flow
- EXPECT: full loop completes.
- IF FAIL: note the failing step, fix the named file — else STOP (playbook §5).
- [ ]

### Task F.9 — HUMAN CHECK: Equipment exit-gate flow
- PRECONDITION: `curl -s http://localhost:8000/v1/health` — if it does not return `"status":"ok"`, redo task 1.27 first.
- DO: HUMAN CHECK (readme exit gate item 4): farmer books a tractor slot in <60 s from browse → owner approve → dispatch check-in pin → return → damage claim with photos → service log → 12% payout row — all from the owner dashboard.
- RUN: human performs the flow
- EXPECT: full loop completes.
- IF FAIL: note the failing step, fix the named file — else STOP (playbook §5).
- [ ]

### Task F.10 — HUMAN CHECK: Broker exit-gate flow
- PRECONDITION: `curl -s http://localhost:8000/v1/health` — if it does not return `"status":"ok"`, redo task 1.27 first.
- DO: HUMAN CHECK (readme exit gate item 5): 50-deal soak (task 5.19 test already green — spot-check 3 deals in the UI) → TTL expiry visible → 3-round lock → contract → evidence vault → completed → two-sided rating → split payout crediting farmer leg and commission leg separately. Confirm no phone number is reachable in any surface.
- RUN: human performs the flow
- EXPECT: full loop completes; commission accounting provable.
- IF FAIL: note the failing step, fix the named file — else STOP (playbook §5).
- [ ]

### Task F.11 — HUMAN CHECK: AI flags and fallback behavior
- PRECONDITION: `curl -s http://localhost:8000/v1/health` — if it does not return `"status":"ok"`, redo task 1.27 first.
- DO: HUMAN CHECK (readme exit gate item 7): for each of the five flags in `platform_config/ai.modules` (`seller_rate_check`, `transport_match`, `broker_lead_score`, `equipment_booking_rec`, `land_listing_quality`): (1) toggle OFF → the feature still works fully via its deterministic fallback; (2) toggle ON with `AI_PROVIDER=shim` → the annotations appear (rate band warning, match ranking, lead scores, booking-rec score, listing tips); (3) inspect the `ai_decisions` rows → cost + confidence + `fallbackUsed` present; (4) confirm no Aadhaar/phone/email appears in any AI payload.
- RUN: human performs the toggles and inspections
- EXPECT: all five briefs behave per above (instructions.md §WS-06 Acceptance).
- IF FAIL: note the failing brief, fix the named file — else STOP (playbook §5).
- [ ]

### Task F.12 — Grep rendered surfaces for phone numbers
- DO: Phone-number grep over broker, transport bilty, and chat surfaces (phase-final verification item 6) — source-level grep plus a human rendered-page check.
- RUN: `grep -rnE "(\+91[0-9]{10}|[6-9][0-9]{9})" website/src/views/broker/ website/src/views/farmer/ website/src/views/transport/ website/src/components/broker/ | grep -v "Masked\|mask\|\*\*\*" | wc -l`
- EXPECT: count is `0`. Then HUMAN CHECK: in the running app (`pnpm dev`), open the broker deal chat, a transport bilty, and the farmer deal detail page and confirm no unmasked phone number renders.
- IF FAIL: mask the leaking surface with `MaskedPhoneText`/`D4TextGuard` — else STOP (playbook §5).
- [ ]

### Task F.13 — Final phase commit
- DO: Commit any remaining gate fixes.
- RUN: `git add -A && git commit -m "phase-02: final gate green"` (repo root)
- EXPECT: commit created (or "nothing to commit" if the tree is clean — that is also success).
- IF FAIL: note the git failure and continue (playbook §6).
- [ ]
