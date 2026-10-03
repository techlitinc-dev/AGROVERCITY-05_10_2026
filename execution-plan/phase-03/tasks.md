# phase-03 — Task Queue
> Executor: read `execution-plan/AGENT_PLAYBOOK.md` first. Execute tasks top to
> bottom, one at a time. Mark [x] only when EXPECT matches real output.
> Full context for any task: see `instructions.md` WS-NN referenced in the task.

Conventions used below:
- `backend/` cwd checks use `.venv/bin/python` (pytest config: `backend/pytest.ini`).
- Website checks run from `website/` as `pnpm exec tsc --noEmit` unless stated.
- Dev API server (when a task says it needs one): start with
  `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`
  (same command as `run.sh`); API base is `http://localhost:8000/v1`.
- All dated notes for this phase go into `execution-plan/phase-03/notes.md`
  (create it on first use with heading `# phase-03 — Dated notes`).

## WS-01 — Dairy "DairyOS" marketplace vision + money rails  (see instructions.md §WS-01)

### Task 1.1 — Verify dairy backend/frontend anchor files
- PRECONDITION: `test -f backend/app/routers/dairy_manager.py && test -f backend/app/routers/livestock_dairy.py && test -f backend/app/routers/purchase_settlement.py && test -f website/src/lib/api/dairyMarketplace.ts && test -f website/src/views/dairyMarket/DairyManagerHomeBoard.tsx && test -f website/src/views/trade/PurchaseDetailPage.tsx && test -f website/src/views/dairy/MyDairyPage.tsx` — if this fails, STOP the phase (playbook §5).
- DO: read-only verification, edit nothing. Confirm the existing endpoint surface the WS builds on.
- RUN: `grep -n 'demands\|/bids\|counter\|collection-check\|/routes' backend/app/routers/dairy_manager.py | head -20 && grep -n 'farmer/payments\|farmer/slips\|payments/batches\|mark-paid\|procurement/collections' backend/app/routers/livestock_dairy.py | head -20`
- EXPECT: both greps print at least one line each (demands, bids, counter, collection-check, routes in dairy_manager.py; farmer/payments, farmer/slips, batches/mark-paid in livestock_dairy.py).
- IF FAIL: the repo contradicts instructions.md §WS-01 "Read first" — STOP (playbook §5) with full output.
- [x]

### Task 1.2 — Add farmer bid-accept endpoint creating purchase
- DO: in `backend/app/routers/dairy_manager.py` add endpoint `POST /bids/{bid_id}/accept`. Reuse the exact ownership/auth pattern of the existing `POST /bids/{bid_id}/counter` handler in the same file. Handler: load the bid and its demand; on accept create a purchase through the existing settlement engine used by `backend/app/routers/purchases.py` (same service call that router's create-purchase path uses), with purchase doc fields `source: {"type": "dairy", "refId": <demandId>}`. Money fields integer paisa (no floats, no `?? <number>` fallbacks). Standard error envelope `{"error":{code,...}}`; accept `Idempotency-Key` header like the existing write handlers in this file.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/dairy_manager.py`
- EXPECT: exit 0.
- IF FAIL: fix the syntax error shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.3 — Test bid-accept creates dairy-sourced purchase
- DO: in `backend/tests/test_dairy_web_flows.py` add a test `test_accept_bid_creates_purchase`: create demand → two bids → accept one via `POST /dairy-manager/bids/{bid_id}/accept` → assert response 200/201 and the created purchase doc has `source.type == "dairy"` and `source.refId == <demandId>`. Follow the existing fixture/auth patterns already used in this test file; do not weaken or delete any existing test.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py -q`
- EXPECT: exit 0, all tests in the file pass including the new one.
- IF FAIL: fix the new endpoint/test until green — never delete a failing assertion (playbook §3.2) — else STOP.
- [x]

### Task 1.4 — Extend dairyMarketplace API wrapper for farmer side
- DO: in `website/src/lib/api/dairyMarketplace.ts` add typed thin wrappers (same style as existing exports in the file; all calls via `client.ts`, which attaches `Idempotency-Key` on writes): `listOpenDemands()` → `GET /dairy-manager/demands`, `listBids(demandId: string)` → `GET /dairy-manager/bids?demandId=<id>` (use the exact query param the router exposes — verify in `dairy_manager.py` first), `acceptBid(bidId: string)` → `POST /dairy-manager/bids/{bidId}/accept`. Surface the standard `{"error":{code,...}}` envelope, no swallowing.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors shown, re-run — else STOP.
- [ ]

### Task 1.5 — Build farmer RFQ list page
- DO: create `website/src/views/dairyMarket/FarmerRfqsPage.tsx` (new): lists open demands via `listOpenDemands()`; each row links to the bid-comparison screen (Task 1.6). All user-facing strings via `t()` — no hardcoded strings, no `alert()`/`confirm()`. Export it from `website/src/views/dairyMarket/index.tsx` following the existing export pattern there.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 1.6 — Build bid-comparison screen with accept action
- DO: create `website/src/views/dairyMarket/BidComparePage.tsx` (new): for a given demand id, renders bids side-by-side with columns rate (₹ from integer paisa), quantity, pickup date; an "Accept" button per bid calls `acceptBid(bidId)` and on success navigates to the created purchase's `PurchaseDetailPage` route (reuse the existing route path used by `website/src/views/trade/PurchasesPage.tsx`). All strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 1.7 — Register farmer RFQ + bid-compare routes
- DO: in `website/src/App.tsx` add routes for `FarmerRfqsPage` and `BidComparePage` following the exact pattern of the existing dairyMarket routes in that file; if dairyMarket tools are surfaced via `DAIRY_MARKET_PAGES` in `website/src/views/dashboard/ToolPage.tsx`, register the two pages there under new toolIds `dairyFarmerRfqs` and `dairyBidCompare`, and add those toolIds to `TOOL_LIST` + the farmer persona list in `website/src/lib/dashboard.ts` following the existing entry shape.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors (missing import/registry key), re-run — else STOP.
- [ ]

### Task 1.8 — Add dairy context chip to PurchaseDetailPage
- DO: in `website/src/views/trade/PurchaseDetailPage.tsx` add a small context chip rendered only when `purchase.source?.type === 'dairy'`, showing label from `t()` key `purchase.sourceDairy` (do not change any other rendering; do not touch the OTP handover flow).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 1.9 — Wire FAT/SNF collection-check at dairy handover
- DO: in `website/src/views/trade/PurchaseDetailPage.tsx`, when `purchase.source?.type === 'dairy'`, render a collection-check form (FAT, SNF numeric inputs + grade + qty + photo evidence using the page's existing photo-upload sheet) that calls `POST /dairy-manager/collection-check` via a new typed wrapper `recordCollectionCheck()` added to `website/src/lib/api/dairyMarketplace.ts` (match the request body the router expects — read the handler first). Collections record FAT/SNF at handover, before OTP release; strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 1.10 — Add dairy i18n keys en+hi
- DO: in `website/src/lib/i18n/locales/en.dairy.ts` and `website/src/lib/i18n/locales/hi.dairy.ts` add every `t()` key introduced in tasks 1.5–1.9 (same key in BOTH files), including `purchase.sourceDairy` and dairy terms: FAT→फैट, SNF→एसएनएफ, shift→सुबह/शाम. Keys must be identical sets in both files.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^  [a-zA-Z0-9_.]+:" src/lib/i18n/locales/en.dairy.ts | sort) <(grep -oE "^  [a-zA-Z0-9_.]+:" src/lib/i18n/locales/hi.dairy.ts | sort)`
- EXPECT: tsc exit 0 and diff prints nothing (key parity).
- IF FAIL: add the missing key(s) to the file diff flags, re-run — else STOP.
- [ ]

### Task 1.11 — Build route-planner view (text tour, no map)
- DO: create `website/src/views/dairy/routes/RoutePlannerPage.tsx` (new): per route (from `GET /dairy-manager/routes` via a typed wrapper added to `website/src/lib/api/dairyMarketplace.ts`) show the member list, AM/PM (सुबह/शाम) ordering controls, and a region-sorted text tour list. Hard constraint (guardrail G5): NO map/GPS component — text tour only. Strings via `t()`; export from the dairy views index following the existing pattern; register route/toolId `dairyRoutePlanner` in `ToolPage.tsx` (DAIRY_PAGES) + `dashboard.ts` like task 1.7.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 1.12 — Add pickup-agent sub-accounts backend
- DO: in `backend/app/routers/livestock_dairy.py` add pickup-agent sub-accounts extending the existing member/team pattern in that file: `dairy_agents` sub-docs `{uid, name, phone, routeIds: [], active: bool}` under the dairy, with endpoints `POST /livestock/dairy/agents` (create), `GET /livestock/dairy/agents` (list), `DELETE /livestock/dairy/agents/{uid}` (deactivate → `active: false`). Standard error envelope; `Idempotency-Key` on the create.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/livestock_dairy.py && .venv/bin/python -m pytest tests/test_dairy_web_flows.py -q`
- EXPECT: exit 0 both; existing tests stay green.
- IF FAIL: fix until green — else STOP.
- [x]

### Task 1.13 — Enforce agent write-scope (403 AGENT_ROLE_FORBIDDEN)
- DO: in `backend/app/routers/livestock_dairy.py` (and `dairy_manager.py` collection-check handler) add a role check helper following the file's existing auth-helper pattern: a `dairy_agents` identity may call collection recording (`POST /livestock/procurement/collections`) and `POST /dairy-manager/collection-check`, but any agent call to rate-chart writes, payment-batch writes, or member writes returns 403 with envelope code `AGENT_ROLE_FORBIDDEN`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py tests/test_dairy_mgmt.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [x]

### Task 1.14 — Gate agent seats behind Pro entitlement
- PRECONDITION: `grep -q "def require_entitlement" backend/app/services/billing.py` — if this fails, phase-00 billing is missing: STOP the phase (playbook §5).
- DO: in `backend/app/routers/livestock_dairy.py` wrap `POST /livestock/dairy/agents` with the phase-00 `require_entitlement(persona, feature)` dependency for the dairy persona feature `"agent_seats"` (Pro tier, R2), following the exact usage pattern in `backend/app/services/billing.py`. Over-limit response stays the phase-00 402/429 envelope — do not invent a new shape.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [x]

### Task 1.15 — Test agent role gating
- DO: in `backend/tests/test_dairy_web_flows.py` add tests: agent records a collection (200), agent gets 403 `AGENT_ROLE_FORBIDDEN` on rate-chart write and on payment-batch write, non-agent manager unaffected. Use existing fixtures.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py -q`
- EXPECT: exit 0, new tests pass.
- IF FAIL: fix code (not the test) until green — else STOP.
- [x]

### Task 1.16 — Add FSSAI KYC gate on dairy writes
- PRECONDITION: `test -f backend/app/routers/kyc.py` — if this fails, phase-00 KYC pipeline is missing: STOP the phase (playbook §5).
- DO: in `backend/app/routers/dairy_manager.py` and `backend/app/routers/livestock_dairy.py` add a shared guard (helper in one file, imported by the other, or duplicate the 5-line check per the files' existing style — match what the file already does for cross-router helpers): before `POST /dairy-manager/demands`, rate-chart writes, and payment-batch creation, require the manager to hold an approved KYC doc with `docType == "fssai"` (query the phase-00 `kyc_cases` pipeline per `backend/app/routers/kyc.py`'s read pattern). Failure → 403 envelope code `KYC_REQUIRED` with a `deepLink` field to the KYC upload page path used by the website.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py tests/test_dairy_mgmt.py -q`
- EXPECT: exit 0 (seed fixtures in these tests already create KYC-approved managers, or update fixtures minimally to grant fssai approval — fixtures only, never weaken assertions).
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 1.17 — Test FSSAI gate blocks unapproved manager
- DO: in `backend/tests/test_dairy_web_flows.py` add test: manager without approved fssai doc gets 403 `KYC_REQUIRED` on demand create, rate-chart write, and payment-batch create; after granting approval, all three succeed.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py -q -k kyc`
- EXPECT: exit 0, the new test passes.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 1.18 — Surface KYC_REQUIRED deep link in dairy console
- DO: in the dairy console demand form, rate-chart page (`website/src/views/dairy/ratechart/`), and payments page (`website/src/views/dairy/payments/PaymentsPage.tsx`): when an API call returns envelope code `KYC_REQUIRED`, render an inline notice with a link to the KYC upload page (the deepLink from the response; fallback route = the website's existing KYC upload route — find it via `grep -rn "kyc" website/src/App.tsx`), preselecting docType `fssai` if the page supports a query param. Strings via `t()` en+hi (add keys to `en.dairy.ts`/`hi.dairy.ts`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 1.19 — Wire batch mark-paid to RazorpayX payout rail
- PRECONDITION: `grep -qi "payout" backend/app/services/settlements.py` — if this fails, the phase-00 payout rail is missing: STOP the phase (playbook §5).
- DO: in `backend/app/routers/livestock_dairy.py` change `POST /livestock/dairy/payments/batches/{id}/mark-paid`: instead of only recording `payoutRef`, execute one payout per `payment_entries` row to the member's `bankDetails` via the phase-00 RazorpayX payout path in `backend/app/services/settlements.py` (reuse — do not reimplement). Idempotent on batch id; existing 409 `ALREADY_PAID` behavior must stay. Integer paisa only; write one `audit_logs` row per payout with actor, action, batch id, member id, amount.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py tests/test_dairy_mgmt.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 1.20 — Test batch payouts, 409 retry, audit rows
- DO: in `backend/tests/test_dairy_web_flows.py` add test: batch with ≥2 member entries → mark-paid executes ≥2 payouts through the (stubbed/fixtured) payout rail; immediate retry returns 409 `ALREADY_PAID`; one `audit_logs` row exists per payout.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py -q -k payout`
- EXPECT: exit 0, new test passes.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 1.21 — Add per-member statement PDF endpoint
- DO: in `backend/app/routers/livestock_dairy.py` add `GET /livestock/dairy/members/{id}/statement` returning a PDF generated via `backend/app/services/reports.py` (follow that service's existing PDF function pattern): statement lists the member's slips, payment entries, deductions, and NET for the cycle, integer paisa rendered as ₹. Access: the dairy manager or the linked farmer (`dairy_members.farmerUid`) only — 403 otherwise.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 1.22 — Add statement download to MemberStatementPage
- DO: in `website/src/views/dairy/members/MemberStatementPage.tsx` add a "Download PDF" button calling `GET /livestock/dairy/members/{id}/statement` via a typed wrapper in `website/src/lib/api/dairy.ts` (blob download, filename `statement-<memberId>.pdf`). String via `t()` en+hi.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 1.23 — Add statement download to farmer My Dairy
- DO: in `website/src/views/dairy/MyDairyPage.tsx` add the same statement download entry point (farmer's own linked member id from the existing farmer dairy data the page already loads), using the wrapper from task 1.22. String via `t()` en+hi.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 1.24 — Add milk-money ledger summary card to MyDairyPage
- DO: in `website/src/views/dairy/MyDairyPage.tsx` add a ledger summary card showing for the current cycle: liters, gross, deduction, NET, paid/pending — sourced from `GET /livestock/dairy/farmer/payments` + `GET /livestock/dairy/farmer/analytics` via typed wrappers in `website/src/lib/api/dairy.ts`. ₹ from integer paisa; every label via `t()` en+hi. Do not remove the existing slips/payments sections.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 1.25 — Deep-link ledger from farmer dashboard home
- DO: in `website/src/lib/dashboard.ts` add/adjust the farmer persona home config (`PERSONA_HOME_CONFIG`) so the dairy entry deep-links to `MyDairyPage`'s ledger card (follow the existing deep-link field pattern in that file; the farmer-link rule: `dairy_members.farmerUid` is the linkage — no new linkage mechanism).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 1.26 — Add SMS/WhatsApp slip fallback for unlinked members
- DO: in `backend/app/routers/livestock_dairy.py` in the `POST /livestock/procurement/collections` handler: after saving, if the member has no linked `farmerUid`, send an SMS/WhatsApp slip (slipNumber, liters, FAT/SNF, rate, amount) via the existing notification service (`backend/app/services/notify.py` / `notifications.py` — use the same send function other handlers in this file already use). Gate the send behind the Pro-tier entitlement feature `"auto_sms_slips"` (task 1.14 pattern). Add any new config keys as placeholders to `backend/.env.example` ONLY — never touch `.env`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py tests/test_dairy_mgmt.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 1.27 — Test SMS slip gating
- DO: in `backend/tests/test_dairy_web_flows.py` add tests: collection for unlinked member with Pro entitlement fires exactly one slip send (assert via the file's existing notify mock/fixture pattern); Free-tier dairy sends nothing; collection for linked member sends nothing.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py -q -k slip`
- EXPECT: exit 0, new tests pass.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 1.28 — Enforce dairy tiers server-side
- PRECONDITION: `grep -q "def require_entitlement" backend/app/services/billing.py` — if fails, STOP the phase (playbook §5).
- DO: in `backend/app/routers/livestock_dairy.py` enforce via `require_entitlement` + usage counters (phase-00 pattern): Free tier = 25 members max (26th member create → 402/403 entitlement envelope with upgrade payload) and manual batches only; Pro ₹1,499/mo = unlimited members + route planner + agent seats + analytics + auto-SMS slips; Enterprise = multi-center unions + API + custom rate engines (gate the route-planner read/write and analytics endpoints behind Pro). Register the tier feature keys/limits in the phase-00 plans config location (`backend/app/services/billing.py` plans definitions) exactly as existing plan entries are shaped.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py tests/test_dairy_mgmt.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 1.29 — Add marketplace commission lines to settlement invoice
- DO: in the settlement/invoice path (`backend/app/routers/purchase_settlement.py` invoice builder — read it first, follow the existing invoice line pattern): when `purchase.source.type == "dairy"`, append a commission line computed integer paisa: 3% for milk, 5% for produce, 2% for livestock (select by the demand/purchase category field already on the doc; if no category field exists, use the demand doc's category). No floats.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 1.30 — Test tier cap and commission line
- DO: in `backend/tests/test_dairy_web_flows.py` add tests: 26th member on Free tier → 402/403 entitlement error; dairy-sourced purchase invoice contains the commission line at exactly 3% of the milk trade amount (integer paisa equality).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_web_flows.py -q`
- EXPECT: exit 0, new tests pass.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 1.31 — Sweep new dairy code for hard-rule violations
- DO: read-only sweep of files created/modified in WS-01: `website/src/views/dairyMarket/FarmerRfqsPage.tsx`, `BidComparePage.tsx`, `website/src/views/dairy/routes/RoutePlannerPage.tsx`, `MyDairyPage.tsx`, `PurchaseDetailPage.tsx` changes. Confirm: no `alert(`/`confirm(`/`prompt(`, no `?? <number>` fallbacks, no hardcoded user-facing strings (all labels via `t()`), no map/GPS import in RoutePlannerPage.
- RUN: `grep -n "alert(\|confirm(\|prompt(\|?? [0-9]" website/src/views/dairyMarket/FarmerRfqsPage.tsx website/src/views/dairyMarket/BidComparePage.tsx website/src/views/dairy/routes/RoutePlannerPage.tsx website/src/views/dairy/MyDairyPage.tsx; grep -ni "map\|gps" website/src/views/dairy/routes/RoutePlannerPage.tsx | grep -vi "map(" | head`
- EXPECT: first grep prints nothing; second grep prints nothing map/GPS-component related (array `.map(` is fine).
- IF FAIL: remove the violating code, re-run the affected task's check — else STOP.
- [ ]

### Task 1.32 — HUMAN CHECK: dairy marketplace loop end-to-end
- DO: HUMAN CHECK. Start the dev server (`cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`) and website (`cd website && pnpm dev`). With two test accounts (dairy manager + linked member farmer): (1) manager posts a demand; (2) farmer opens RFQ list, compares ≥2 bids side-by-side, accepts one; (3) purchase opens with dairy chip; (4) record collection-check with FAT/SNF + photo; (5) farmer OTP release completes; (6) invoice shows 3% milk commission line; (7) run the plan/dairy_plan.md §10-style checklist for regressions; (8) toggle en⇄hi on FarmerRfqsPage, BidComparePage, RoutePlannerPage, MyDairyPage ledger card.
- RUN: (manual — no command)
- EXPECT: human confirms all 8 steps work and every new screen renders both languages with no raw `t()` keys visible.
- IF FAIL: note the failing step, fix via a new minimal edit, re-check — else STOP (playbook §5).
- [ ]

### Task 1.33 — Checkpoint WS-01
- DO: run the WS-01 Verification block from instructions.md, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-03 WS-01: Dairy DairyOS marketplace vision + money rails"`
- EXPECT: backend suite fully green (incl. `test_dairy_web_flows.py`), tsc+build clean, commit created.
- IF FAIL: fix the failing check, re-run the full line — if git commit alone fails (identity etc.), note it and continue (playbook §6).
- [ ]

## WS-02 — Direct Buyer "ProcurePro" finish  (see instructions.md §WS-02)

### Task 2.1 — Verify ProcurePro backend/frontend anchors
- PRECONDITION: `test -f backend/app/routers/offers.py && test -f backend/app/routers/contracts.py && test -f backend/app/routers/direct_buyer.py && test -f backend/app/routers/purchase_settlement.py && test -f backend/app/models/direct.py && test -f website/src/components/trade/CounterOfferForm.tsx && test -f website/src/views/farmer/FarmerContractsPage.tsx && test -f website/src/views/farmer/FarmerContractDetailPage.tsx` — if fails, STOP the phase (playbook §5).
- DO: read-only verification of the counter loop and settlement surfaces; edit nothing.
- RUN: `grep -n "counter\|pending\|expiresAt" backend/app/routers/offers.py | head -10 && grep -n "QcIn\|PickupIn\|qcDisputed\|delivered" backend/app/routers/purchase_settlement.py backend/app/models/direct.py backend/app/models/contracts.py 2>/dev/null | head -15`
- EXPECT: both greps print lines (counter loop exists in offers.py; QcIn/PickupIn located — note which file defines them for tasks 2.9/2.14).
- IF FAIL: repo contradicts instructions.md §WS-02 — STOP (playbook §5) with output.
- [ ]

### Task 2.2 — Add 3-round counter cap backend
- DO: in `backend/app/models/direct.py` add `rounds: int = 0` to the offer document model. In `backend/app/routers/offers.py` counter handler: enforce alternating counters — from `pending` only `toId` may counter, from `countered` only `fromId` may counter (verify against the existing status flow in the file and keep it); increment `rounds` on each counter; reset `expiresAt` each round (same duration the existing create-offer path uses); when `rounds >= 3` and another counter is attempted → 400 envelope code `NEGOTIATION_CLOSED`. Accept/reject/withdraw remain allowed past the cap.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_demands_offers.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green (adjust existing fixtures only if they relied on >3 rounds; never delete assertions) — else STOP.
- [x]

### Task 2.3 — Test 4th counter round blocked
- DO: in `backend/tests/test_demands_offers.py` add test `test_counter_cap_negotiation_closed`: three alternating counters succeed, the 4th returns 400 `NEGOTIATION_CLOSED`, and accept after the cap still works.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_demands_offers.py -q -k counter`
- EXPECT: exit 0, new test passes.
- IF FAIL: fix code until green — else STOP.
- [x]

### Task 2.4 — Show round n/3 and last-offer banner in CounterOfferForm
- DO: in `website/src/components/trade/CounterOfferForm.tsx` display "round n/3" from the offer's `rounds` field; when `rounds >= 3` hide the counter input and render a "last offer" banner leaving only accept/reject/withdraw actions. Strings via `t()` — add keys to the locale pair this component already uses (check its existing `t()` keys' section file, e.g. `en.trade.ts`/`hi.trade.ts`) in BOTH en and hi.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 2.5 — Add crop spec template model
- DO: create `backend/app/models/specs.py` (new): `crop_specs` document shape `{id, crop, name, params: [{name, unit, min: float|None, max: float|None, testMethod, adjustmentPerUnit: int}], createdBy}` — `adjustmentPerUnit` is ₹/unit premium(+)/deduction(−) in integer paisa. Follow the pydantic/model style of the neighboring `backend/app/models/direct.py`.
- RUN: `cd backend && .venv/bin/python -m py_compile app/models/specs.py`
- EXPECT: exit 0.
- IF FAIL: fix syntax, re-run — else STOP.
- [ ]

### Task 2.6 — Add specs router
- DO: create `backend/app/routers/specs.py` (new): `APIRouter(prefix="/specs")` with `GET /specs?crop=` (list templates, optional crop filter) and `POST /specs` (authenticated buyer creates a custom template into `crop_specs`). Standard error envelope; `Idempotency-Key` on POST. Register the router in `backend/app/main.py` with the `/v1` prefix exactly like neighboring routers.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/specs.py app/main.py`
- EXPECT: exit 0.
- IF FAIL: fix syntax/import errors, re-run — else STOP.
- [ ]

### Task 2.7 — Seed the four crop spec templates
- DO: create `backend/scripts/seed_specs.py` (new, follow an existing script's structure in `backend/scripts/`): upserts four `crop_specs` templates with `createdBy: "system"` — Tomato (BRIX % min 4.5; firmness; size 55–70mm; defect % max 5), Sugarcane (sucrose %/pol; trash %; weight), Wheat (moisture %; foreign matter %; hectolitre weight), Onion (size mm; rot %; moisture). Every param has `testMethod` and integer-paisa `adjustmentPerUnit`.
- RUN: `cd backend && .venv/bin/python -m py_compile scripts/seed_specs.py`
- EXPECT: exit 0.
- IF FAIL: fix syntax, re-run — else STOP.
- [ ]

### Task 2.8 — Test specs endpoints
- DO: create `backend/tests/test_specs.py` (new, follow `conftest.py` fixtures): seed/insert templates → `GET /v1/specs?crop=Tomato` returns the Tomato template with 4 params; `POST /v1/specs` creates a custom template visible in a subsequent GET; unauthenticated POST is rejected per the app's standard auth behavior.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_specs.py -q`
- EXPECT: exit 0, new tests pass.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 2.9 — Extend QcIn with measurements and photos
- DO: in the file defining `QcIn` (found in task 2.1 — `backend/app/models/direct.py` or the purchases/settlement models file): add `measurements: list[{name: str, value: float}] = []` and `photos: list[str] = []` to `QcIn`. Keep every existing field and default unchanged.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_direct_buyer.py tests/test_contracts.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 2.10 — Add QC photo upload endpoint
- DO: in `backend/app/routers/purchase_settlement.py` (or `purchases.py` if that is where QC endpoints live — verify by grep) add `POST /purchases/{id}/qc/photos`: multipart upload via `backend/app/services/storage.py` with prefix `"purchases"`, max 5 photos per purchase, allowed only while purchase status is `delivered` or `qcDisputed` (otherwise 409 envelope); append returned keys to the purchase's QC `photos`. `Idempotency-Key` accepted.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_direct_buyer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 2.11 — Implement sliding per-parameter QC settlement
- DO: in the QC submit handler in `backend/app/routers/purchase_settlement.py`: if the purchase carries a `specSnapshot` (copied from the contract — if contracts don't attach it yet, add `specSnapshot` to the purchase doc at purchase creation from the contract's spec), compute `qualityAdjustment = Σ adjustmentPerUnit × deviation` over `QcIn.measurements` vs the snapshot params (deviation only outside min/max bounds), then `finalRate = agreedPricePerUnit + qualityAdjustment / qty`, all integer paisa; else keep the existing grade path untouched. Store `qualityAdjustment` and `finalRate` on the purchase. No floats for money.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_direct_buyer.py tests/test_contracts.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 2.12 — Create settlement test file with sliding-QC tests
- DO: create `backend/tests/test_purchase_settlement.py` (new, follow `conftest.py`): tests for QC full acceptance, QC partial/dispute, and the sliding adjustment to the rupee — a purchase with a specSnapshot where QA submits BRIX 5.1 (+₹75/q per fixture spec) and moisture 13% (−₹20/q) yields a `finalAmount` equal to the hand-computed integer-paisa value; no-specSnapshot purchase still uses the grade path.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_purchase_settlement.py -q`
- EXPECT: exit 0, new tests pass.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 2.13 — Render per-parameter adjustment table on purchase views
- DO: in `website/src/views/trade/PurchaseDetailPage.tsx` (this serves both parties — verify both buyer and farmer reach this page) render, when the purchase has `measurements`/`qualityAdjustment`, a parameter table: one row per measured parameter with name, value, spec bound, and per-line ₹ adjustment, plus the computed `finalRate`/`finalAmount` (₹ from integer paisa). Also render QC photos read-only. Strings via `t()` en+hi (E18 transparency). Extend the wrapper in `website/src/lib/api/purchases.ts` only if new fields need types.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 2.14 — Add pickup mode and slot to PickupIn
- DO: in the file defining `PickupIn` (from task 2.1): add `mode: Literal["farmerDelivers", "buyerPicksup"] = "buyerPicksup"` and `slot: str = ""`; persist both on the purchase's `pickup` sub-object in the pickup-schedule handler.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_direct_buyer.py tests/test_purchase_settlement.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 2.15 — Show pickup mode/slot on term sheet
- DO: in `website/src/views/trade/PurchaseDetailPage.tsx` term-sheet section render `pickup.mode` and `pickup.slot` with `t()` labels en+hi; in the pickup scheduling form add mode selector (farmerDelivers/buyerPicksup, default buyerPicksup) and slot input, sent via the existing pickup wrapper in `website/src/lib/api/purchases.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 2.16 — Add buyer org router (team sub-accounts)
- DO: create `backend/app/routers/buyer_org.py` (new): `buyer_orgs` collection doc `{adminUid, companyName, members: [{uid, role: "admin"|"procurement"|"qa"|"finance", addedAt}]}`. Endpoints: `POST /buyer-org/invite {phone, role}` (invitee must already be a registered user — look up by phone via the same user-lookup pattern other routers use; 404 envelope if unregistered), `GET /buyer-org` (caller must be admin member), `DELETE /buyer-org/members/{uid}` (admin only). Standard envelope; `Idempotency-Key` on writes. Register in `backend/app/main.py` under `/v1`.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/buyer_org.py app/main.py`
- EXPECT: exit 0.
- IF FAIL: fix syntax/import errors, re-run — else STOP.
- [ ]

### Task 2.17 — Enforce org role gates (403 ORG_ROLE_REQUIRED)
- DO: add a shared role-check helper in `backend/app/routers/buyer_org.py` (e.g. `require_org_role(uid, *roles)`) and apply it: escrow fund action in `backend/app/routers/purchase_settlement.py` → roles finance/admin; QC submit → qa/admin; contract create/update in `backend/app/routers/contracts.py` → procurement/admin. Users with no org membership keep current behavior only where they ARE the org admin (solo buyer = implicit admin of their own org — create the `buyer_orgs` doc lazily on first gated call with `adminUid` = caller). Violations → 403 envelope code `ORG_ROLE_REQUIRED`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_direct_buyer.py tests/test_contracts.py tests/test_purchase_settlement.py -q`
- EXPECT: exit 0 (existing solo-buyer tests keep passing via lazy admin org).
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 2.18 — Test buyer org endpoints and gates
- DO: create `backend/tests/test_buyer_org.py` (new): invite registered user → appears in `GET /buyer-org`; invite unregistered phone → 404; remove member works; finance member can fund escrow while procurement member gets 403 `ORG_ROLE_REQUIRED`; qa member submits QC while finance member gets 403; procurement member creates contract while qa member gets 403.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_buyer_org.py -q`
- EXPECT: exit 0, all new tests pass.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 2.19 — Add buyer-org API wrapper
- DO: create `website/src/lib/api/buyerOrg.ts` (new, style of `website/src/lib/api/offers.ts`): typed wrappers `getOrg()`, `inviteMember(phone, role)`, `removeMember(uid)` via `client.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 2.20 — Build TeamPage with disabled-reason role gating
- DO: create `website/src/views/directbuyer/TeamPage.tsx` (new): org member list with roles + invite form (phone, role select admin/procurement/qa/finance) + remove action, using the task 2.19 wrapper. Then in the escrow-fund, QC-submit, and contract create/update UI (`website/src/views/trade/PurchaseDetailPage.tsx`, `website/src/views/directbuyer/ContractFormPage.tsx`): when an API call returns 403 `ORG_ROLE_REQUIRED` (or the org data already shows the user's role lacks permission), render the button DISABLED with an inline reason ("Ask your admin") + a deep link to TeamPage — never hide the button. Strings via `t()` en+hi. Register TeamPage route in `App.tsx` and export in `website/src/views/directbuyer/index.tsx`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 2.21 — Build DemandDetailPage with BidTable
- DO: create `website/src/views/directbuyer/DemandDetailPage.tsx` (new): loads `GET /demands/{id}` and `GET /offers/mine?filter=received&targetType=demand` (typed wrappers — extend `website/src/lib/api/offers.ts` and the demands wrapper `website/src/lib/api/demands.ts` as needed); renders a BidTable (one row per offer: rate, qty, date, actions) and embeds the existing `CounterOfferForm` (P2 loop with round n/3 from task 2.4). Register the route in `website/src/App.tsx`; export in `website/src/views/directbuyer/index.tsx`. Strings via `t()` en+hi.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 2.22 — Add corporate-buyer KYC submission + contract gate
- PRECONDITION: `test -f backend/app/routers/kyc.py` — if fails, STOP the phase (playbook §5).
- DO: backend: in `backend/app/routers/contracts.py` contract-create handler, require the buyer to hold approved KYC docs per their business type — doc types FSSAI (food businesses), IEC/APEDA (exporters), GST — checked via the phase-00 `kyc_cases` pipeline; failure → 403 `KYC_REQUIRED` with deepLink. Website: on the KYC upload page ensure doc types FSSAI, IEC, APEDA, GST are selectable for the directBuyer persona (add the persona→doctype matrix entries where phase-00 defines them; submission side only — NO admin approval UI).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_contracts.py tests/test_contracts_direct.py -q && cd ../website && pnpm exec tsc --noEmit`
- EXPECT: both exit 0 (update test fixtures minimally to grant KYC approval where existing tests create contracts).
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 2.23 — Test contract creation KYC gate
- DO: in `backend/tests/test_contracts_direct.py` add test: buyer without approved KYC docs → 403 `KYC_REQUIRED` on contract create; with approved docs → success.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_contracts_direct.py -q -k kyc`
- EXPECT: exit 0, new test passes.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 2.24 — Dated note: admin corporate verification queue deferred
- DO: append to `execution-plan/phase-03/notes.md` (create with `# phase-03 — Dated notes` if absent) exactly: `2026-10-03 — WS-02: Admin corporate-buyer verification queue UI deferred to phase-07 (superadmin module 07). This phase ships the submission side + KYC_REQUIRED gates only (instructions.md WS-02 step 7).`
- RUN: `grep -c "2026-10-03 — WS-02" execution-plan/phase-03/notes.md`
- EXPECT: prints `1`.
- IF FAIL: fix the note text to match exactly, re-run — else STOP.
- [ ]

### Task 2.25 — Polish grow-for-us decision card
- DO: in `website/src/views/farmer/FarmerContractDetailPage.tsx` (and summary on `FarmerContractsPage.tsx` if it renders the card) add two sections to the decision card: expected income vs mandi benchmark (12-week band) and agronomy risk notes, rendered from the contract's `attractiveness` field when present; when absent (AI flag off), render the static fallback text via `t()` keys. Do NOT touch the MPIN e-sign flow (`/contracts/{id}/accept`, `signatureData`, `consentTimestamp`). Strings en+hi.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 2.26 — Extend direct-buyer tests for RBAC + tier cap
- DO: in `backend/tests/test_direct_buyer.py` add tests: contract create/update as org procurement member succeeds, as qa member → 403 `ORG_ROLE_REQUIRED`; second active contract on Free tier → 402/403 entitlement envelope (after task 2.28 lands the tier config — if not yet present, write the test against the planned feature key `"contracts_active"` and let task 2.28 make it pass).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_direct_buyer.py -q`
- EXPECT: exit 0 after task 2.28; if run before it, only the tier test may fail — complete task 2.28 then re-run.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 2.27 — Complete settlement test coverage
- DO: extend `backend/tests/test_purchase_settlement.py` with the remaining P5 cases: escrow fund success, OTP wrong/expired/attempts-exceeded, resolve dispute, pay caps, invoice contents (amounts integer paisa, parties, lines).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_purchase_settlement.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 2.28 — Enforce directBuyer tiers server-side
- PRECONDITION: `grep -q "def require_entitlement" backend/app/services/billing.py` — if fails, STOP the phase (playbook §5).
- DO: register in the phase-00 plans config (`backend/app/services/billing.py`): directBuyer Free = 1 active contract; Pro ₹4,999/mo = 5 contracts + QC suite + price alerts; Enterprise ₹24,999/mo = unlimited + team RBAC + API + account manager. Enforce with `require_entitlement` + usage counters: contract create in `backend/app/routers/contracts.py` (active-contract count), QC endpoints in `purchase_settlement.py` (Pro+), `buyer_org.py` invite (Enterprise). Over-limit → phase-00 402/429 envelope with upgrade payload.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_direct_buyer.py tests/test_buyer_org.py tests/test_contracts_direct.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 2.29 — Add 1–2% settlement commission line
- DO: in the invoice builder in `backend/app/routers/purchase_settlement.py` add a platform commission line of 1–2% (use the rate from the phase-00 platform config location used by other commission lines — find via `grep -rn "commission" backend/app/routers/settlements.py backend/app/services/settlements.py | head`), integer paisa, on every direct-buyer settlement invoice; add a test asserting the line amount equals the configured percentage of the trade amount.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_purchase_settlement.py -q`
- EXPECT: exit 0.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 2.30 — Sweep ProcurePro guardrails on new/changed UI
- DO: verify on all free-text inputs added/changed in WS-02 (TeamPage invite, DemandDetailPage, CounterOfferForm changes, spec/QC displays): `MaskedPhoneText` wraps any phone rendering and `D4TextGuard` (or the equivalent guard component these views already import — check existing usage with `grep -rn "MaskedPhoneText\|D4TextGuard" website/src/views/directbuyer website/src/components/trade | head`) wraps free text; no map/GPS added; no COD option added; handover remains OTP-only.
- RUN: `grep -rn "alert(\|confirm(\|prompt(" website/src/views/directbuyer/TeamPage.tsx website/src/views/directbuyer/DemandDetailPage.tsx website/src/components/trade/CounterOfferForm.tsx; grep -rn "MaskedPhoneText\|D4TextGuard" website/src/views/directbuyer | head -5`
- EXPECT: first grep prints nothing; second grep prints ≥1 usage line (guards in use in the domain).
- IF FAIL: add the guard components / remove violations, re-run affected checks — else STOP.
- [ ]

### Task 2.31 — Add ProcurePro i18n keys en+hi
- DO: add every `t()` key introduced in WS-02 to the relevant section locale pair (the pair each edited view already registers; new keys for contract/scheduling/QC terms go in the same files), en + hi identical sets, including: अनुबंध (contract), आपूर्ति शेड्यूल (supply schedule), गुणवत्ता मानक (quality standard), नेट-30 (net-30).
- RUN: `cd website && pnpm exec tsc --noEmit && for f in trade dairy; do diff <(grep -oE "^  [a-zA-Z0-9_.]+:" src/lib/i18n/locales/en.$f.ts | sort) <(grep -oE "^  [a-zA-Z0-9_.]+:" src/lib/i18n/locales/hi.$f.ts | sort); done`
- EXPECT: tsc exit 0; both diffs print nothing.
- IF FAIL: add missing keys, re-run — else STOP.
- [ ]

### Task 2.32 — HUMAN CHECK: ProcurePro full manual flow
- DO: HUMAN CHECK. Dev server + website running (commands at top of file). Execute plan/direct_buyer_plan.md §10 checklist: contract (mandiLinked, weekly ×8) → farmer MPIN e-sign → slot PO (idempotent replay returns same purchase) → escrow by finance member → OTP (1 wrong attempt) → sliding QC with photos → release → invoice with commission + TDS note → 8/8 slots → fulfilled → renew clones. Also: QA member submits BRIX 5.1 (+₹75/q) and moisture 13% (−₹20/q) and confirm `finalAmount` matches hand computation on BOTH buyer and farmer screens; 4th counter round → 400 `NEGOTIATION_CLOSED` with last-offer banner; procurement member sees disabled escrow button with "Ask your admin" reason.
- RUN: (manual — no command)
- EXPECT: human confirms every checklist line and both-screen rupee match.
- IF FAIL: note failing step, fix minimally, re-check — else STOP.
- [ ]

### Task 2.33 — Checkpoint WS-02
- DO: run the WS-02 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-03 WS-02: Direct Buyer ProcurePro finish"`
- EXPECT: backend suite fully green (incl. `test_purchase_settlement.py`, `test_buyer_org.py`), tsc+build clean, commit created.
- IF FAIL: fix the failing check, re-run — git commit failure alone: note and continue (playbook §6).
- [ ]

## WS-03 — Bank Manager "CreditDesk" console  (see instructions.md §WS-03)

### Task 3.1 — Verify loans backend surface and toolIds
- PRECONDITION: `test -f backend/app/routers/loans.py && test -f backend/app/services/loans.py && test -f backend/app/routers/finance.py && test -f website/src/lib/api/bank.ts && test -f website/src/lib/dashboard.ts` — if fails, STOP the phase (playbook §5).
- DO: read-only verification; edit nothing. Confirm the status machine `submitted → underReview → infoRequested → approved → disbursed` (side `rejected`, `cancelled`) and numbering `LN-YYYY-####` exist, plus endpoints: `GET /loans/queue`, `GET /loans/stats`, `GET /loans/{applicationId}`, `POST /loans/{id}/review|approve|reject|info-request|respond|cancel|disburse`, `GET /loans/{id}/schedule`, `POST /loans/{id}/documents`.
- RUN: `grep -n "underReview\|infoRequested\|LN-" backend/app/routers/loans.py | head -8 && grep -n "@router" backend/app/routers/loans.py && grep -n "bankManagerHome\|loanDashboard\|loanReview\|loanTracking" website/src/lib/dashboard.ts`
- EXPECT: all three greps print matching lines.
- IF FAIL: repo contradicts instructions.md §WS-03 ground truth — STOP (playbook §5) with output.
- [ ]

### Task 3.2 — Add loans API wrapper
- DO: create `website/src/lib/api/loans.ts` (new, style of `website/src/lib/api/bank.ts`, all calls via `client.ts` which attaches `Idempotency-Key` on writes): typed wrappers for every endpoint verified in task 3.1 — `getQueue(params)`, `getStats()`, `getLoan(id)`, `reviewLoan(id)`, `approveLoan(id, {reason})`, `rejectLoan(id, {reason})`, `requestInfo(id, {note})`, `respondLoan(id, body)`, `cancelLoan(id)`, `disburseLoan(id, body)`, `getSchedule(id)`, `uploadLoanDocument(id, ...)`. Standard `{"error":{code,...}}` envelope surfaced, not swallowed.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 3.3 — Build BankHomeBoard
- DO: create `website/src/views/bank/BankHomeBoard.tsx` (new directory): stat cards from `GET /loans/stats` — queue depth by SLA, approvals today, disbursals this week, at-risk accounts, portfolio totals (₹ from integer paisa). Strings via `t()`; no hardcoded strings; no `alert()`/`confirm()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 3.4 — Build LoanQueuePage with filters + cursor pagination
- DO: create `website/src/views/bank/LoanQueuePage.tsx` (new): filter controls for status / amount range / district mapped to `GET /loans/queue` query params (read the handler's accepted params first and use exactly those names); real cursor pagination using the response's cursor field (same pattern an existing paginated page uses — find via `grep -rln "cursor" website/src/views | head`). Rows link to `LoanDetailPage`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 3.5 — Build LoanDetailPage farmer-360
- DO: create `website/src/views/bank/LoanDetailPage.tsx` (new): for `GET /loans/{applicationId}` render farmer-360 sections — profile, KCC (`GET /finance/kcc` via existing `website/src/lib/api/bank.ts`), credit score (`GET /finance/credit-score`), land/crop data, repayment history (`GET /finance/loans`), and an uploaded-documents viewer (documents from the loan doc + `POST /loans/{id}/documents` uploads). Strings via `t()`; ₹ from integer paisa.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 3.6 — Build PortfolioPage
- DO: create `website/src/views/bank/PortfolioPage.tsx` (new): NPA watch list + EMI collection rate from `GET /loans/stats` (use the exact field names the handler returns — read it first). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 3.7 — Ensure audit_logs on every loan action
- DO: backend, in `backend/app/routers/loans.py`: verify each of review / approve / reject / info-request / disburse writes an `audit_logs` row containing actor uid, action, and the reason/note from the request body. If any is missing, add the write following the file's (or `backend/app/routers/admin.py`'s) existing audit pattern. Reject already stores `body.reason` — do not change that; the UI surfacing comes in task 3.8. Do not weaken any status transition.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_finance.py -q && grep -c "audit" app/routers/loans.py`
- EXPECT: pytest exit 0; grep count ≥ 5 (one audit write per action).
- IF FAIL: add the missing audit writes, re-run — else STOP.
- [ ]

### Task 3.8 — Add action bar with reason + disbursal + EMI schedule view
- DO: in `website/src/views/bank/LoanDetailPage.tsx` add an action bar: Approve / Reject / Request-info — each opens an inline form REQUIRING a typed reason/note before submit (calls task 3.2 wrappers); rejected loans render the stored `reason`. Add a Disburse button visible only in `approved` status calling `disburseLoan`, and an EMI schedule section rendering `GET /loans/{id}/schedule` as a table (installment no, due date, amount ₹ from integer paisa, status). Strings via `t()`; no `confirm()` — use an inline confirm step pattern already present in the codebase if one exists, otherwise a two-click inline confirm.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 3.9 — Add partnerBankId + origination fee ledger
- DO: backend: add optional `partnerBankId: str | None` to the loan application model (`backend/app/models/loans.py`) and accept it in the apply path (`POST /finance/loans/apply` in `backend/app/routers/finance.py`); on `POST /loans/{id}/disburse` write a referral/origination-fee entry to the settlements ledger (`backend/app/services/settlements.py` — follow its existing ledger-entry pattern), integer paisa, plus an `audit_logs` row. Underwriting stays on-platform — no external calls.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_finance.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 3.10 — Build farmer LoanTrackingPage
- DO: create `website/src/views/farmer/LoanTrackingPage.tsx` (new): the farmer's loan applications with `LN-YYYY-####` status chip and a stage timeline (submitted → underReview → infoRequested → approved → disbursed, with rejected/cancelled side states) from the farmer-visible loan endpoints (`GET /finance/loans` + `GET /loans/{id}` as the participant — verify access pattern in `loans.py`). Export from `website/src/views/farmer/index.tsx`; strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 3.11 — Emit task-engine tasks for document requests
- PRECONDITION: `test -f backend/app/services/tasks.py && grep -q "def emit_task" backend/app/services/tasks.py` — if fails, phase-01 task engine is missing: STOP the phase (playbook §5).
- DO: in `backend/app/routers/loans.py` `POST /loans/{id}/info-request` handler: after the status transition, call `emit_task(...)` (exact signature from `backend/app/services/tasks.py`) to the farmer with title_en/title_hi for the document request and a deep link to the loan-tracking upload flow; the farmer responds via the existing `POST /loans/{id}/documents` + `POST /loans/{id}/respond` (do not build a parallel channel). Mark the task done when `respond` is called (use the task engine's resolve/dedupe API per `services/tasks.py`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_finance.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 3.12 — Add EMI reminders via notify service
- DO: in `backend/app/routers/loans.py` disburse handler (or the schedule-creation point in `backend/app/services/loans.py` — put it where the EMI schedule is persisted): schedule an EMI reminder notification per installment via the existing notify service (`backend/app/services/notify.py`, same call pattern other modules use). No new reminder infra.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_finance.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 3.13 — Wire CreditDesk routes and tool registry
- DO: in `website/src/views/dashboard/ToolPage.tsx` add a bank pages registry (e.g. `BANK_PAGES`) following the existing `*_PAGES` map pattern, mapping toolIds `bankManagerHome`→BankHomeBoard, `loanDashboard`→PortfolioPage, `loanReview`→LoanQueuePage, `loanTracking`→LoanTrackingPage; add any missing routes in `website/src/App.tsx` for LoanDetailPage/LoanQueuePage following existing route patterns. ToolIds already exist in `website/src/lib/dashboard.ts` — do not duplicate them.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix registry/import errors, re-run — else STOP.
- [ ]

### Task 3.14 — Enforce partner-institution seat licensing
- PRECONDITION: `grep -q "def require_entitlement" backend/app/services/billing.py` — if fails, STOP the phase (playbook §5).
- DO: register in the phase-00 plans config: bankManager Enterprise tier ₹2,000/seat/mo. In `backend/app/routers/loans.py` banker-only endpoints (`_banker` dependency path), enforce seat-count entitlement via `require_entitlement` + usage counters (one seat per distinct banker uid of the institution; `partnerBankId` from task 3.9 scopes the institution). Over-limit → phase-00 402/429 envelope. Farmer/participant endpoints carry NO entitlement check (global rule 5).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_finance.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 3.15 — Create CreditDesk web tests: queue + audit
- DO: create `backend/tests/test_credit_desk_web.py` (new, follow `conftest.py`): queue filters (status / amount range / district return only matching rows; cursor pagination returns next page); each of review/approve/reject/info-request writes an `audit_logs` row containing actor, action, reason.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_credit_desk_web.py -q`
- EXPECT: exit 0, new tests pass.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 3.16 — Extend CreditDesk tests: disburse, schedule, farmer mirror
- DO: extend `backend/tests/test_credit_desk_web.py`: approve → disburse transitions status and `GET /loans/{id}/schedule` returns the full EMI schedule; farmer (participant) sees each status change via his endpoints; info-request emits a task-engine task to the farmer and `respond` resolves it.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_credit_desk_web.py -q`
- EXPECT: exit 0.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 3.17 — Add AI annotation badge seam to queue and detail
- DO: in `website/src/views/bank/LoanQueuePage.tsx` and `LoanDetailPage.tsx`: when a loan object carries an `ai` field (risk band, missing docs — arrives with WS-07 M14), render badges; when absent, render exactly as before (no placeholder, no empty badge). No status mutation of any kind from the badge. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 3.18 — Add bank i18n section en+hi
- DO: create `website/src/lib/i18n/locales/en.bank.ts` and `hi.bank.ts` (new, modeled exactly on `en.dairy.ts`: import `registerLocale`, export dict, call `registerLocale('en'|'hi', dict)`); move/add every `t()` key used by the bank views there, identical key sets, including bank terms: वितरण (disbursal), किस्त (EMI), अनुमोदन (approval). Import the section files from `website/src/views/bank/BankHomeBoard.tsx` (and farmer LoanTrackingPage) so registration happens.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^  [a-zA-Z0-9_.]+:" src/lib/i18n/locales/en.bank.ts | sort) <(grep -oE "^  [a-zA-Z0-9_.]+:" src/lib/i18n/locales/hi.bank.ts | sort)`
- EXPECT: tsc exit 0; diff prints nothing.
- IF FAIL: add missing keys, re-run — else STOP.
- [ ]

### Task 3.19 — HUMAN CHECK: clear the queue + farmer mirror
- DO: HUMAN CHECK. Dev server + website running. As bankManager persona: process a seeded queue of ≥10 applications entirely in-app (review → approve/reject/info-request, each with a typed reason); open PortfolioPage (NPA watch + collection rate render); disburse one approved loan and open its EMI schedule. As farmer persona: see each status change on LoanTrackingPage within one refresh; receive a dashboard task for the info-request and respond via the task deep link (upload document); confirm an EMI reminder notification fires. Toggle en⇄hi on all bank screens.
- RUN: (manual — no command)
- EXPECT: human confirms all steps; every decision visible with reason (spot-check via the admin/Firestore audit view or backend logs).
- IF FAIL: note failing step, fix minimally, re-check — else STOP.
- [ ]

### Task 3.20 — Checkpoint WS-03
- DO: run the WS-03 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-03 WS-03: Bank CreditDesk console"`
- EXPECT: backend suite green (incl. `test_credit_desk_web.py`), tsc+build clean, commit created.
- IF FAIL: fix the failing check, re-run — git commit failure alone: note and continue.
- [ ]

## WS-04 — Insurance "ClaimsDesk" console  (see instructions.md §WS-04)

### Task 4.1 — Verify insurance backend surface and toolIds
- PRECONDITION: `test -f backend/app/routers/insurance.py && test -f backend/app/routers/insurance_claims.py && test -f backend/app/services/claims.py` — if fails, STOP the phase (playbook §5).
- DO: read-only verification; edit nothing. Confirm claim stages `intimated → surveyorAssigned → fieldAssessed → dbtApproved → disbursed` (side `rejected`, appeal resubmit) and the provider + farmer endpoint surfaces listed in instructions.md §WS-04 "Backend ground truth".
- RUN: `grep -n "surveyorAssigned\|fieldAssessed\|dbtApproved" backend/app/routers/insurance.py backend/app/routers/insurance_claims.py backend/app/services/claims.py | head -8 && grep -n "@router" backend/app/routers/insurance.py | head -20 && grep -n "insuranceProviderHome\|insurancePolicyReview\|insuranceClaimReview\|cropInsurance" website/src/lib/dashboard.ts`
- EXPECT: all greps print matching lines.
- IF FAIL: repo contradicts instructions.md §WS-04 — STOP (playbook §5) with output.
- [ ]

### Task 4.2 — Add insurance API wrapper
- DO: create `website/src/lib/api/insurance.ts` (new, via `client.ts`): typed wrappers for the provider endpoints (`getProviderPolicies`, `getProviderPolicy(id)`, `reviewPolicy(id, body)`, `getProviderClaims`, `getProviderClaim(id)`, `scheduleSurvey(id, {surveyorName, surveyorPhone, surveyorVisitDate})`, `submitSurveyReport(id, {assessedLossPercent, ...})`, `reviewClaim(id, body)`, `disburseClaim(id, body)`, `getProviderStats()`, `updateRates(body)`) and farmer endpoints (`fileClaim(multipart)`, `getMyClaims()`, `getMyClaim(id)`, `appealClaim(id, body)`). Standard error envelope surfaced.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 4.3 — Build ClaimsDeskHome
- DO: create `website/src/views/insurance/ClaimsDeskHome.tsx` (new directory): from `GET /insurance/provider/stats` render — new intimations with a live 72-h SLA clock per claim (countdown from intimation timestamp), surveys pending assignment, claims by stage, DBT pending, rejection/appeal stats. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 4.4 — Build ClaimsQueuePage
- DO: create `website/src/views/insurance/ClaimsQueuePage.tsx` (new): stage filter (intimated/surveyorAssigned/fieldAssessed/dbtApproved/disbursed/rejected) + SLA sort (oldest intimation first) over `GET /insurance/provider/claims`; rows link to ClaimDetailPage. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 4.5 — Build ClaimDetailPage with geo-photo viewer
- DO: create `website/src/views/insurance/ClaimDetailPage.tsx` (new): claim timeline (stage transitions with timestamps), farm map + crop cycle context (reuse the existing farm-map/boundary display component the farmer views already use — find via `grep -rln "boundary\|FarmMap" website/src/views | head`; no new map dependency), and a geo-tagged photo evidence viewer showing each claim photo with a capture-coordinates chip (lat/long from the photo metadata fields on the claim doc). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 4.6 — Build SurveyorsPage roster + assignment
- DO: backend first if the roster doesn't exist: check `grep -n "surveyor" backend/app/routers/insurance.py | head` — if there is no provider-managed surveyor roster collection, add one in `backend/app/routers/insurance.py`: `surveyors` docs `{name, phone, districts: []}` with provider-scoped CRUD (`GET/POST/DELETE /insurance/provider/surveyors`). Then create `website/src/views/insurance/SurveyorsPage.tsx` (new): roster list + add/remove + an assign action per pending claim calling `schedule_survey` with `{surveyorName, surveyorPhone, surveyorVisitDate}`. Hard constraint: surveyor phone is rendered only inside this provider console (it stays server-side otherwise; the farmer notification is backend-sent already). Strings via `t()`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_insurance_provider.py tests/test_insurance_claims.py -q && cd ../website && pnpm exec tsc --noEmit`
- EXPECT: both exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 4.7 — Build DisbursePage
- DO: create `website/src/views/insurance/DisbursePage.tsx` (new): DBT execution list (claims in `dbtApproved`) with a disburse action calling `disburseClaim`, plus disbursement stats from `GET /insurance/provider/stats`. Every disburse requires a typed reason/note field if the endpoint accepts one (read the handler). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 4.8 — Build farmer 72-h intimation form with guidelines overlay
- DO: create the farmer intimation view in the farmer views (e.g. `website/src/views/farmer/FarmerClaimIntimatePage.tsx` (new)): multipart form posting geo-tagged photos to `POST /insurance/claims` via the task 4.2 wrapper; a guidelines overlay shown before submit listing what to photograph + a deadline countdown (72 h from loss-event date input). No paywall/entitlement UI anywhere on this page (global rule 5). Strings via `t()` en+hi. Export from `website/src/views/farmer/index.tsx`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 4.9 — Build farmer courier-style claim tracker
- DO: create `website/src/views/farmer/FarmerClaimTrackerPage.tsx` (new): per claim, a multi-stage courier-style timeline intimated → surveyorAssigned → fieldAssessed → dbtApproved → disbursed (rejected shown as side state) with timestamps from `GET /insurance/claims/{claim_id}`. Strings via `t()` en+hi; export from farmer index.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 4.10 — Build farmer appeal form
- DO: in `website/src/views/farmer/FarmerClaimTrackerPage.tsx` add, only when claim status is `rejected`, an appeal/resubmit form calling `POST /insurance/claims/{claim_id}/appeal` (read the handler's expected body first). On success the tracker shows the claim re-entering the queue. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 4.11 — Dated note: crop-insurance policy polish deferred
- DO: append to `execution-plan/phase-03/notes.md` exactly: `2026-10-03 — WS-04: Crop-insurance module polish beyond the claims mirror (robust.md §7.9, policy purchase flow) deferred to phase-05 module sweep. Farmer intimation/tracker/appeal pages landed in this phase.`
- RUN: `grep -c "2026-10-03 — WS-04" execution-plan/phase-03/notes.md`
- EXPECT: prints `1`.
- IF FAIL: fix the note text, re-run — else STOP.
- [ ]

### Task 4.12 — Build policy review queue page
- DO: create `website/src/views/insurance/PolicyReviewPage.tsx` (new): list of provider policies pending review (`GET /insurance/provider/policies`) with a review action per policy calling `POST /insurance/provider/policies/{id}/review` (read handler body shape; require a typed note if accepted). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 4.13 — Build provider rates page
- DO: create `website/src/views/insurance/RatesPage.tsx` (new): provider self-service rate-table editor on `POST /insurance/provider/rates`, honoring the endpoint's effective-dating fields (read the handler first; render existing rates if a GET exists). Money inputs integer paisa → ₹ display. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 4.14 — Dated note: admin rate approval editor deferred
- DO: append to `execution-plan/phase-03/notes.md` exactly: `2026-10-03 — WS-04: Admin rate-table approval editor deferred to phase-07 (superadmin module 15). Provider self-service rates page shipped in this phase.`
- RUN: `grep -c "2026-10-03 — WS-04: Admin rate-table" execution-plan/phase-03/notes.md`
- EXPECT: prints `1`.
- IF FAIL: fix the note text, re-run — else STOP.
- [ ]

### Task 4.15 — Ledger per-claim fee + audit on review/disburse
- DO: backend, in `backend/app/routers/insurance.py`: on `disburse` write a per-claim processing-fee entry to the settlements ledger (`backend/app/services/settlements.py` existing pattern), integer paisa; verify review and disburse each write `audit_logs` with actor, action, reason — add if missing (same pattern as task 3.7). Do not change any farmer-facing endpoint behavior.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_insurance_provider.py tests/test_insurance_claims.py tests/test_insurance_policies.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 4.16 — Wire ClaimsDesk routes and tool registry
- DO: in `website/src/views/dashboard/ToolPage.tsx` add an insurance pages registry mapping toolIds `insuranceProviderHome`→ClaimsDeskHome, `insuranceClaimReview`→ClaimsQueuePage, `insurancePolicyReview`→PolicyReviewPage, `cropInsurance`→the farmer claim tracker/intimation entry; add routes in `website/src/App.tsx` for the new insurance + farmer claim pages following existing patterns.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix registry/import errors, re-run — else STOP.
- [ ]

### Task 4.17 — Verify no paywall on farmer claim filing
- DO: read-only check that no entitlement gate touches farmer claim endpoints.
- RUN: `grep -n "require_entitlement\|ENTITLEMENT" backend/app/routers/insurance_claims.py`
- EXPECT: grep prints nothing (global rule 5: no paywall on the farmer's core loop).
- IF FAIL: remove the gate from the farmer router (it may only exist on provider endpoints), re-run — else STOP.
- [ ]

### Task 4.18 — Create ClaimsDesk web tests
- DO: create `backend/tests/test_claims_desk_web.py` (new): full lifecycle — farmer intimates with photos inside 72 h → provider schedules survey (`schedule_survey`) → survey report with `assessedLossPercent` → review/approve → disburse → each stage visible with timestamps on the farmer claim GET; cycle time derivable from `GET /insurance/provider/stats`; rejected claim → appeal → claim re-enters queue; `audit_logs` rows exist for review + disburse.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_claims_desk_web.py -q`
- EXPECT: exit 0, new tests pass.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 4.19 — Test SLA clock data for stale claims
- DO: extend `backend/tests/test_claims_desk_web.py`: a claim whose intimation timestamp is set >48 h ago appears in the provider claims list/stats with the fields the SLA clock needs (intimation timestamp present and sortable); stats reflect it in the pending bucket.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_claims_desk_web.py -q -k sla`
- EXPECT: exit 0, new test passes.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 4.20 — Add insurance i18n section en+hi
- DO: create `website/src/lib/i18n/locales/en.insurance.ts` and `hi.insurance.ts` (modeled on `en.dairy.ts` exactly as task 3.18 did for bank); include every `t()` key used by the insurance + farmer claim views, identical key sets, including: सूचना (intimation), सर्वेयर (surveyor), क्षतिपूर्ति (compensation). Import the section files from `ClaimsDeskHome.tsx` and the farmer claim pages.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^  [a-zA-Z0-9_.]+:" src/lib/i18n/locales/en.insurance.ts | sort) <(grep -oE "^  [a-zA-Z0-9_.]+:" src/lib/i18n/locales/hi.insurance.ts | sort)`
- EXPECT: tsc exit 0; diff prints nothing.
- IF FAIL: add missing keys, re-run — else STOP.
- [ ]

### Task 4.21 — HUMAN CHECK: claim lifecycle + appeal
- DO: HUMAN CHECK. Dev server + website running. Two accounts: farmer intimates a claim with geo-tagged photos inside the 72-h window (guidelines overlay shown, countdown visible) → provider assigns a surveyor from SurveyorsPage → submits survey report (`assessedLossPercent`) → approves → DBT disburses from DisbursePage → farmer tracker shows every stage with timestamps. Reject a second claim → farmer appeals → claim re-enters the provider queue. Verify the SLA clock renders for a claim created >48 h ago (seed one). Toggle en⇄hi on the tracker and guidelines overlay.
- RUN: (manual — no command)
- EXPECT: human confirms every stage and the appeal cycle.
- IF FAIL: note failing step, fix minimally, re-check — else STOP.
- [ ]

### Task 4.22 — Checkpoint WS-04
- DO: run the WS-04 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-03 WS-04: Insurance ClaimsDesk console"`
- EXPECT: backend suite green (incl. `test_claims_desk_web.py`), tsc+build clean, commit created.
- IF FAIL: fix the failing check, re-run — git commit failure alone: note and continue.
- [ ]

## WS-05 — Cold Storage "StoreHouse" console  (see instructions.md §WS-05)

### Task 5.1 — Verify post-harvest backend surface and toolIds
- PRECONDITION: `test -f backend/app/routers/post_harvest.py && test -f website/src/lib/dashboard.ts` — if fails, STOP the phase (playbook §5).
- DO: read-only verification; edit nothing. Confirm the endpoint surface from instructions.md §WS-05 "Read first": `GET /cold-storage[/{facility_id}]`, `POST /cold-storage/{id}/book`, `POST /cold-storage/{id}/apply`, `GET /bookings/{booking_id}`, `POST /bookings/{booking_id}/request-release`, `GET /receipts/{receipt_number}`, `GET /provider/stats`, `GET /provider/bookings[/{id}]`, `POST /provider/bookings/{id}/review|inward|release`, `GET/POST /provider/facilities`, `POST /provider/facilities/{id}/chambers`, `PUT /provider/facilities/{id}`, `POST /grade`.
- RUN: `grep -n "@router" backend/app/routers/post_harvest.py && grep -n "coldStorageHome\|postHarvest\|myBookings" website/src/lib/dashboard.ts`
- EXPECT: first grep lists the endpoints above; second prints the three toolIds.
- IF FAIL: repo contradicts instructions.md §WS-05 — STOP (playbook §5) with output.
- [ ]

### Task 5.2 — Add cold-storage API wrapper
- DO: create `website/src/lib/api/coldStorage.ts` (new, via `client.ts`): typed wrappers for every endpoint verified in task 5.1 (directory/booking farmer side + provider console side). Standard error envelope surfaced.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 5.3 — Build StoreHouseHome
- DO: create `website/src/views/coldstorage/StoreHouseHome.tsx` (new directory): from `GET /post-harvest/provider/stats` render — chamber utilization %, bookings pending approval, lots inward today, releases due, revenue this month (₹ from integer paisa). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 5.4 — Build FacilitiesPage
- DO: create `website/src/views/coldstorage/FacilitiesPage.tsx` (new): facility list (`GET /post-harvest/provider/facilities`) + create form (`POST /post-harvest/provider/facilities`) + edit (`PUT /post-harvest/provider/facilities/{id}`) using the task 5.2 wrapper; fields per the router's accepted body (read it first). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 5.5 — Build ChambersPage
- DO: create `website/src/views/coldstorage/ChambersPage.tsx` (new): per-facility chamber management (`POST /post-harvest/provider/facilities/{id}/chambers`): capacity, ₹/q/month pricing (integer paisa input rendered as ₹), active/inactive toggle (use the exact chamber fields the router accepts). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 5.6 — Build BookingsQueuePage
- DO: create `website/src/views/coldstorage/BookingsQueuePage.tsx` (new): pending bookings list (`GET /post-harvest/provider/bookings`) with approve/reject actions calling `POST /post-harvest/provider/bookings/{id}/review` — reject REQUIRES a typed reason (read handler body). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 5.7 — Build InwardRegisterPage
- DO: create `website/src/views/coldstorage/InwardRegisterPage.tsx` (new): digital inward register — record inward per approved booking via `POST /post-harvest/provider/bookings/{id}/inward` with lot, grade, and photo (multipart per the handler's accepted fields); render the register rows (lot/grade/photo/timestamp) for the facility. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 5.8 — Build ReleasePage
- DO: create `website/src/views/coldstorage/ReleasePage.tsx` (new): list bookings with farmer `request-release` pending and execute release via `POST /post-harvest/provider/bookings/{id}/release`; show released lots with timestamps. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 5.9 — Build UtilizationPage
- DO: create `website/src/views/coldstorage/UtilizationPage.tsx` (new): per-chamber utilization analytics from `GET /post-harvest/provider/stats` (and facility detail endpoints as needed) — capacity vs occupied per chamber, trend list. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 5.10 — Build farmer directory + booking form
- DO: create `website/src/views/farmer/ColdStorageDirectoryPage.tsx` (new): cold-storage directory from `GET /post-harvest/cold-storage` showing LIVE remaining capacity per facility (field from the response — read the handler), a booking form per facility calling `POST /post-harvest/cold-storage/{id}/book` (surface remaining capacity next to the form; decrement is server-side — never compute it client-side), and an apply option (`POST /cold-storage/{id}/apply`) if the router distinguishes it. Strings via `t()` en+hi; export from `website/src/views/farmer/index.tsx`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 5.11 — Build farmer my-bookings list
- DO: create `website/src/views/farmer/MyStorageBookingsPage.tsx` (new): the farmer's bookings with status (`GET /post-harvest/bookings/{booking_id}` per booking, or the list endpoint if one exists — verify in the router) and a request-release action (`POST /post-harvest/bookings/{booking_id}/request-release`) on active bookings. Strings via `t()`; export from farmer index.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 5.12 — Build warehouse-receipt vault
- DO: create `website/src/views/farmer/WarehouseReceiptPage.tsx` (new): verifiable receipt page rendering `GET /post-harvest/receipts/{receipt_number}` (all receipt fields the handler returns, ₹ from integer paisa); plus list the farmer's receipts inside the farmer's existing documents vault view (find it via `grep -rln "vault" website/src/views | head` and add a receipts section there using the receipt numbers from the farmer's bookings). Strings via `t()`; export from farmer index.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 5.13 — Add "attach warehouse receipt" to CreditDesk documents
- PRECONDITION: `test -f website/src/views/bank/LoanDetailPage.tsx` — if fails, WS-03 task 3.5 has not landed; complete it first (do NOT stub around).
- DO: in `website/src/views/bank/LoanDetailPage.tsx` documents section add an "attach warehouse receipt" affordance: input for a receipt number that stores it as a loan document via `POST /loans/{id}/documents` (wrapper from task 3.2; read the handler's accepted document fields and store the receipt number in the appropriate reference field). Attached receipts render in the documents list with their receipt number. Strings via `t()` en+hi (add keys to the bank section files).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 5.14 — Dated note: AI grading stub deferred
- DO: append to `execution-plan/phase-03/notes.md` exactly: `2026-10-03 — WS-05: POST /post-harvest/grade remains a stub. Real Gemini Vision grading = AI brief M10, phase-05. Only the integration point is preserved in this phase.`
- RUN: `grep -c "2026-10-03 — WS-05" execution-plan/phase-03/notes.md`
- EXPECT: prints `1`.
- IF FAIL: fix the note text, re-run — else STOP.
- [ ]

### Task 5.15 — Enforce cold-storage tiers + per-booking fee
- PRECONDITION: `grep -q "def require_entitlement" backend/app/services/billing.py` — if fails, STOP the phase (playbook §5).
- DO: register in the phase-00 plans config: coldStorageProvider Pro ₹1,999/mo per facility. In `backend/app/routers/post_harvest.py`: Free provider = one facility read-only — all provider console WRITE endpoints (`/provider/facilities` POST/PUT, `/chambers`, bookings `review|inward|release`) behind `require_entitlement` (Pro), Free → 402/403 envelope with upgrade payload. On `release`, ledger a per-booking platform fee via `backend/app/services/settlements.py` (existing pattern), integer paisa. Verify/add `audit_logs` with actor+reason on review and release. Farmer booking/receipt endpoints carry NO entitlement check.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_cold_storage.py tests/test_cold_storage_provider.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 5.16 — Test receipt endpoint is owner-only
- DO: in `backend/tests/test_cold_storage.py` add test: `GET /post-harvest/receipts/{receipt_number}` returns the receipt for the owning farmer and the facility provider, and 403/404 (per the router's existing semantics — assert the actual code) for an unrelated authenticated farmer (no auth leak).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_cold_storage.py -q -k receipt`
- EXPECT: exit 0, new test passes.
- IF FAIL: fix the router access check until green — else STOP.
- [ ]

### Task 5.17 — Create StoreHouse web tests
- DO: create `backend/tests/test_storehouse_web.py` (new): provider onboards a facility + 2 chambers → farmer books (capacity decrements server-side) → provider approves → inward recorded with lot/grade/photo → farmer requests release → provider releases → `GET /provider/stats` reflects updated utilization % and revenue; per-booking fee ledgered; Free-tier provider blocked from console writes with the entitlement envelope.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_storehouse_web.py -q`
- EXPECT: exit 0, new tests pass.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 5.18 — Add cold-storage i18n section en+hi
- DO: create `website/src/lib/i18n/locales/en.coldstorage.ts` and `hi.coldstorage.ts` (modeled on `en.dairy.ts` as in task 3.18); include every `t()` key used by the coldstorage + farmer storage views, identical key sets, including: गोदाम (warehouse), कक्ष (chamber), रसीद (receipt). Import the section files from `StoreHouseHome.tsx` and the farmer storage pages.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^  [a-zA-Z0-9_.]+:" src/lib/i18n/locales/en.coldstorage.ts | sort) <(grep -oE "^  [a-zA-Z0-9_.]+:" src/lib/i18n/locales/hi.coldstorage.ts | sort)`
- EXPECT: tsc exit 0; diff prints nothing.
- IF FAIL: add missing keys, re-run — else STOP.
- [ ]

### Task 5.19 — HUMAN CHECK: provider + farmer cold-storage flow
- DO: HUMAN CHECK. Dev server + website running. Provider: onboard facility + 2 chambers (₹/q/month pricing) → approve a booking with reason → record inward (lot/grade/photo) → execute release; confirm utilization % and revenue update on StoreHouseHome. Farmer: book from the directory (capacity visibly decrements), retrieve the warehouse receipt by number, attach it to a loan application and confirm it appears in the bank manager's document list (LoanDetailPage). Verify a Free-tier provider is blocked from console writes with an upgrade prompt, and the receipt page does not render for a different farmer's account. Toggle en⇄hi.
- RUN: (manual — no command)
- EXPECT: human confirms every step.
- IF FAIL: note failing step, fix minimally, re-check — else STOP.
- [ ]

### Task 5.20 — Checkpoint WS-05
- DO: run the WS-05 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-03 WS-05: Cold Storage StoreHouse console"`
- EXPECT: backend suite green (incl. `test_storehouse_web.py`), tsc+build clean, commit created.
- IF FAIL: fix the failing check, re-run — git commit failure alone: note and continue.
- [ ]

## WS-06 — Gaushala + Vet polish  (see instructions.md §WS-06)

### Task 6.1 — Verify vet/gaushala backend and view anchors
- PRECONDITION: `test -f backend/app/routers/livestock_vets.py && test -f backend/app/routers/livestock_gaushala.py && test -f backend/app/routers/livestock.py && test -d website/src/views/vetnet && test -d website/src/views/gaushala && test -f website/src/lib/api/vetnet.ts && test -f website/src/lib/api/gaushala.ts` — if fails, STOP the phase (playbook §5).
- DO: read-only verification; edit nothing. Confirm managed-vets CRUD/claim/appointments/prescriptions/campaigns + `mark-vaccinated`, `GET /livestock/gaushala/receipts`, `GET /livestock/gaushala/analytics`.
- RUN: `grep -n "@router\|mark-vaccinated" backend/app/routers/livestock_vets.py | head -25 && grep -n "receipts\|analytics" backend/app/routers/livestock_gaushala.py | head -10`
- EXPECT: both greps print the endpoints named above.
- IF FAIL: repo contradicts instructions.md §WS-06 — STOP (playbook §5) with output.
- [ ]

### Task 6.2 — Add credentialStatus to managed vets
- DO: in `backend/app/routers/livestock_vets.py` (and its model file if vet models live elsewhere — check `grep -rn "managed" backend/app/models | head`): add `credentialStatus: "pending"|"verified"|"rejected"` (default `"pending"`) + `credentialDocs: list[str] = []` (doc refs) on managed-vet records; accept them on `POST /livestock/vets/managed` and `PUT /livestock/vets/managed/{id}`. Existing records behave as `"pending"`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_gaushala_analytics.py tests/test_gaushala_mgmt.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 6.3 — Gate campaigns on verified credentials + add verification endpoints
- DO: in `backend/app/routers/livestock_vets.py`: (1) campaign-create (`POST /livestock/vet/campaigns*` — verify exact path in the file) returns 403 envelope `VET_NOT_VERIFIED` when the vet's `credentialStatus != "verified"` (unverified vets keep appointments + prescriptions); (2) add `GET /livestock/vets/managed?credentialStatus=` (filtered list for the future admin queue); (3) add `POST /livestock/vets/managed/{id}/credential {status, reason}` (admin-gated per the file's existing admin pattern) mutating `credentialStatus` and writing `audit_logs` with actor + reason.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_gaushala_analytics.py tests/test_gaushala_mgmt.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 6.4 — Show "verification pending" badge in vet directory
- DO: in the vet directory view under `website/src/views/vetnet/` (find the directory/list view via `ls website/src/views/vetnet/`): when a vet's `credentialStatus` is `"pending"`, render a "verification pending" badge via `t()` en+hi (add keys to `en.vetnet.ts`/`hi.vetnet.ts`). No other behavior change — appointments stay bookable.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 6.5 — Dated note: vet verification queue UI deferred
- DO: append to `execution-plan/phase-03/notes.md` exactly: `2026-10-03 — WS-06: Vet credential verification queue UI deferred to phase-07 (superadmin module 19). Backend flag, filtered list endpoint, and status-mutation endpoint with audit_logs shipped in this phase.`
- RUN: `grep -c "2026-10-03 — WS-06: Vet credential" execution-plan/phase-03/notes.md`
- EXPECT: prints `1`.
- IF FAIL: fix the note text, re-run — else STOP.
- [ ]

### Task 6.6 — Gate vet Pro features behind ₹299 entitlement
- PRECONDITION: `grep -q "def require_entitlement" backend/app/services/billing.py` — if fails, STOP the phase (playbook §5).
- DO: register in the phase-00 plans config: vet Pro ₹299/mo. In `backend/app/routers/livestock_vets.py` gate via `require_entitlement`: clinic schedule editor (`/livestock/vets/me/schedule`), prescription templates, and campaign tools (`/livestock/vet/campaigns*`); Free vets keep appointments + basic prescriptions (no gate on those handlers). Over-limit → phase-00 402/429 envelope.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_gaushala_analytics.py tests/test_gaushala_mgmt.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 6.7 — Create vet gating tests
- DO: create `backend/tests/test_vet_gating.py` (new): Free-tier vet hits the entitlement wall on campaign creation with the upgrade envelope; Pro-entitled vet creates a campaign; unverified (but Pro) vet gets 403 `VET_NOT_VERIFIED` on campaign creation; Free vet keeps appointment + basic prescription access; credential status-mutation writes an `audit_logs` row with reason.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_vet_gating.py -q`
- EXPECT: exit 0, new tests pass.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 6.8 — Automate 80G receipt PDF on donation approval
- DO: in `backend/app/routers/livestock_gaushala.py` donation-approval handler (find it via `grep -n "approve\|donation" backend/app/routers/livestock_gaushala.py | head`): on approval, auto-generate the 80G receipt PDF via `backend/app/services/reports.py` (existing PDF pattern), attach the PDF ref to the donation record, and assign a receipt number that is SEQUENTIAL per gaushala per financial year (counter doc per gaushala+FY, incremented transactionally following the codebase's existing counter/id-generation pattern — check `grep -rn "counter\|nextNumber\|sequential" backend/app/services | head`). `GET /livestock/gaushala/receipts` keeps working.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_gaushala_analytics.py tests/test_gaushala_mgmt.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 6.9 — Surface 80G receipt download on ReceiptsPage + donor confirmation
- DO: in the gaushala ReceiptsPage (find via `ls website/src/views/gaushala/`): add a download button per receipt fetching the PDF ref from the donation record (extend `website/src/lib/api/gaushala.ts` with a typed wrapper if needed); surface the same download in the donor confirmation UI (the view shown after donation approval — locate it in the same directory). Strings via `t()` en+hi (add keys to `en.gaushala.ts`/`hi.gaushala.ts`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 6.10 — Test sequential 80G numbering
- DO: in `backend/tests/test_dairy_gaushala_analytics.py` add test: two donations approved for the same gaushala in the same FY get sequential receipt numbers (n, n+1); a different gaushala's sequence starts independently; the generated PDF ref is attached to each donation record.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_gaushala_analytics.py -q -k 80g -i`
- EXPECT: exit 0 (if `-k 80g -i` matches nothing, re-run with the exact test name you used instead — but the file must contain and pass the new test; do not rename existing tests).
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 6.11 — Add public transparency backend aggregate
- DO: in `backend/app/routers/livestock_gaushala.py` add a NO-AUTH endpoint `GET /livestock/gaushala/{id}/transparency` returning: aggregated donations ledger (donor name optional/anonymized — include name only when the donation record marks the donor as public, otherwise `"anonymous"`; NEVER phone/email/address), amounts, 80G receipt count, expense-by-category summary, cattle census by status — sourced from `GET /livestock/gaushala/analytics` data + receipts aggregates. Register it explicitly outside any auth dependency (follow how the router handles public endpoints elsewhere in the codebase — `grep -rn "no.auth\|public" backend/app/routers | head`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_gaushala_analytics.py tests/test_gaushala_mgmt.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 6.12 — Build public transparency page
- DO: create `website/src/views/gaushala/GaushalaTransparencyPage.tsx` (new) rendering the task 6.11 endpoint; add a PUBLIC (no-auth) route `/gaushala/{id}/transparent` in `website/src/App.tsx` outside the auth-guarded route group (follow how existing public routes like auth pages are declared). ₹ from integer paisa; strings via `t()` en+hi.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix type errors, re-run — else STOP.
- [ ]

### Task 6.13 — Test transparency payload has zero PII
- DO: in `backend/tests/test_dairy_gaushala_analytics.py` add test: call `GET /livestock/gaushala/{id}/transparency` without auth → 200; response JSON (serialized) contains no donor phone/email field names and no raw phone number patterns from seeded fixtures; donations include amounts + 80G count; census-by-status present.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_gaushala_analytics.py -q -k transparency`
- EXPECT: exit 0, new test passes.
- IF FAIL: strip the leaking fields from the endpoint until green — else STOP.
- [ ]

### Task 6.14 — Emit herd-health tasks via phase-01 task engine
- PRECONDITION: `test -f backend/app/services/tasks.py && grep -q "def emit_task" backend/app/services/tasks.py` — if fails, STOP the phase (playbook §5).
- DO: in `backend/app/routers/livestock.py` (vaccination record create with due date) and `backend/app/routers/livestock_vets.py` (`POST /livestock/vet/campaigns/{id}/enroll`): call `emit_task(...)` (exact signature from `services/tasks.py`) to the OWNING farmer — title like "vaccination due: <animal>, <date>" in en+hi via the task's title_en/title_hi fields, deep link to the animal detail / campaign page (use the deep-link route the website already registers for those views). In the `mark-vaccinated` handler, resolve the matching task via the task engine's resolve/dedupe API. No parallel reminder system.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_gaushala_analytics.py tests/test_gaushala_mgmt.py -q`
- EXPECT: exit 0.
- IF FAIL: fix until green — else STOP.
- [ ]

### Task 6.15 — Test vaccination task lifecycle
- DO: in `backend/tests/test_vet_gating.py` add test: creating a vaccination record with a due date emits a farmer task with the deep link; campaign enrollment emits a task; `mark-vaccinated` resolves the vaccination task (status done per the task engine API).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_vet_gating.py -q -k task`
- EXPECT: exit 0, new test passes.
- IF FAIL: fix code until green — else STOP.
- [ ]

### Task 6.16 — HUMAN CHECK: vet + gaushala flows
- DO: HUMAN CHECK. Dev server + website running. (1) Farmer sees a vaccination-due task on his dashboard, deep-links to the animal, and the task auto-resolves on mark-vaccinated. (2) An unverified vet shows the "verification pending" badge and is blocked from campaign creation (403). (3) Free-tier vet hits the ₹299 upgrade wall on campaign tools; after upgrade (test entitlement grant), campaign creation unlocks. (4) Approve a donation → downloadable, sequentially numbered 80G PDF on ReceiptsPage + donor confirmation. (5) Open `/gaushala/{id}/transparent` in a logged-out/incognito window → renders with zero PII. Toggle en⇄hi on new surfaces.
- RUN: (manual — no command)
- EXPECT: human confirms all five flows.
- IF FAIL: note failing step, fix minimally, re-check — else STOP.
- [ ]

### Task 6.17 — Checkpoint WS-06
- DO: run the WS-06 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-03 WS-06: Gaushala + Vet polish"`
- EXPECT: backend suite green (incl. `test_vet_gating.py`, `test_dairy_gaushala_analytics.py`), tsc+build clean, commit created.
- IF FAIL: fix the failing check, re-run — git commit failure alone: note and continue.
- [ ]
