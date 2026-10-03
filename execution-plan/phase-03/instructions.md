# Phase 03 — Finance & Ops Console Personas — Build Instructions

> Self-contained execution sheet. Read the phase readme.md first.
> Global rules (execution-plan/README.md §3) apply to every workstream —
> repeat the ones most at risk of violation inline per workstream.

## Repo orientation

- Backend: FastAPI + Firestore — routers `backend/app/routers/`, services
  `backend/app/services/`, tests `backend/tests/`. All API paths below are under the `/v1` prefix.
- Website: React + TS + Vite — API wrappers `website/src/lib/api/`, views
  `website/src/views/`, i18n `t()` in `website/src/lib/i18n/` (+ `locales/`), persona/module
  registry `website/src/lib/dashboard.ts` (TOOL_LIST, PROFILE_ROUTES, PERSONA_HOME_CONFIG),
  routes in `website/src/App.tsx`, page registry in `website/src/views/dashboard/ToolPage.tsx`.
- Already landed and reusable: full dairy console (`website/src/views/dairy/`, 20 views),
  gaushala/vetnet/animals views, contracts UI (`website/src/views/directbuyer/`,
  `website/src/views/farmer/FarmerContractsPage.tsx`), API wrappers `lib/api/dairy.ts`,
  `dairyMarketplace.ts`, `gaushala.ts`, `vetnet.ts`, `intelligence.ts`, `offers.ts`,
  `purchases.ts`. Tests `backend/tests/test_dairy_web_flows.py`,
  `test_dairy_gaushala_analytics.py` exist and must stay green.
- phase-00 provides: `backend/app/services/ai/` (gateway, question_sets, privacy, budgets),
  escrow/payout rails, KYC doc pipeline, plans/subscriptions/entitlements, `audit_logs`.
  phase-01 provides: task engine + Action Center. If either is missing, stop and land the
  dependency first — do not stub around them.
- Verified backend routers for this phase: `loans.py` (prefix `/loans`), `finance.py`,
  `insurance.py` + `insurance_claims.py` (prefix `/insurance`), `post_harvest.py`
  (prefix `/post-harvest`), `dairy_manager.py` (prefix `/dairy-manager`),
  `livestock_dairy.py`, `livestock.py`, `livestock_vets.py`, `livestock_gaushala.py`,
  `contracts.py`, `direct_buyer.py`, `offers.py`, `purchases.py`, `purchase_settlement.py`.

## WS-01 — Dairy "DairyOS" marketplace vision + money rails

**Source:** robust.md §6.7; plan/dairy_plan.md (esp. §11 out-of-scope = this WS's scope) ·
**Goal:** a village dairy replaces its register books AND trades milk/produce/livestock
through the platform marketplace with escrow; every member farmer sees his own milk-money ledger.

**Read first:**
- `backend/app/routers/dairy_manager.py` (demands/bids/counter, routes, collection-check,
  milk-slips, analytics — prefix `/dairy-manager`)
- `backend/app/routers/livestock_dairy.py` (members, rate charts, payment batches,
  farmer self-views `/livestock/dairy/farmer/payments`, `/livestock/dairy/farmer/slips`)
- `backend/app/routers/purchase_settlement.py` + `purchases.py` (OTP handover + escrow machine to reuse)
- `website/src/lib/api/dairyMarketplace.ts`, `website/src/views/dairyMarket/DairyManagerHomeBoard.tsx`,
  `website/src/views/dairy/` (all of it — extend, don't fork)
- `plan/dairy_plan.md` §5 (flows), §9 (guardrails G1–G6), §13 log (what already landed)

**Steps:**
1. **Marketplace loop (the deferred vision).** Backend demands/bids exist
   (`GET/POST /dairy-manager/demands`, `GET/POST /dairy-manager/bids`,
   `POST /dairy-manager/bids/{bid_id}/counter`). Build the missing farmer-facing acceptance UI:
   RFQ list → bid-comparison screen (side-by-side rate, qty, pickup date) → farmer accepts a bid.
   On acceptance create a purchase via the existing settlement engine (`source.type="dairy"`,
   `source.refId=<demandId>`) so collection runs the familiar machine: **QR/OTP collection with
   grade + qty + photo evidence → escrow release on farmer OTP reveal**. Reuse `PurchaseDetailPage`
   sheets; add a dairy context chip. Collections record FAT/SNF at handover via
   `POST /dairy-manager/collection-check`.
2. **Route planner + pickup agents.** Routes CRUD exists (`GET/POST /dairy-manager/routes`).
   Build the route-planner view (member list per route, AM/PM order, region-sorted text tour —
   NO map/GPS per guardrail G5). Add pickup-agent sub-accounts: extend the member/team pattern
   with `dairy_agents` sub-docs `{uid, name, phone, routeIds[], active}`; agents can record
   collections and collection-checks but NOT rate charts, payments, or members
   (403 `AGENT_ROLE_FORBIDDEN` otherwise). Agent seats are a Pro-tier entitlement (R2).
3. **FSSAI KYC gate.** Dairy managers must hold an approved FSSAI licence doc in the phase-00
   KYC pipeline (`docType: "fssai"`) before creating demands, rate charts, or payment batches —
   403 `KYC_REQUIRED` with a deep link to the KYC upload page. Admin approval UI is phase-07;
   here only the submission + gate.
4. **Real payouts + statements.** `POST /livestock/dairy/payments/batches/{id}/mark-paid`
   currently records `payoutRef` only. Wire it to the phase-00 RazorpayX payout rail: one payout
   per `payment_entries` row with member `bankDetails`, idempotent on batch id (409 `ALREADY_PAID`
   stays). Per-member statement PDF from `GET /livestock/dairy/members/{id}/statement` via
   `backend/app/services/reports.py`; download button on `MemberStatementPage` and farmer My Dairy.
   Integer paisa everywhere; every payout writes `audit_logs`.
5. **Farmer milk-money ledger.** `MyDairyPage.tsx` already shows slips/payments — add a ledger
   summary card (this cycle: liters, gross, deduction, NET, paid/pending) sourced from
   `/livestock/dairy/farmer/payments` + `/livestock/dairy/farmer/analytics`, deep-linked from the
   farmer dashboard home (the farmer-link rule: no persona feature without `farmerId` linkage —
   `dairy_members.farmerUid` is that link).
6. **Milk-slip SMS/WhatsApp fallback.** After `POST /livestock/procurement/collections`, if the
   member has no linked `farmerUid` (feature-phone farmer), fire an SMS/WhatsApp slip
   (slipNumber, liters, FAT/SNF, rate, amount) via the phase-00 notification service; config keys
   only, gated to Pro tier ("auto-SMS slips").
7. **Tiers + commissions.** Enforce entitlements server-side: Free = 25 members, manual batches;
   Pro ₹1,499/mo = unlimited members, route planner, agent seats, analytics, auto-SMS slips;
   Enterprise = multi-center unions, API, custom rate engines. Marketplace trades carry
   commission: **3% milk / 5% produce / 2% livestock** — ledgered as commission lines on the
   settlement invoice (existing invoice line pattern).
8. i18n: every new string `t()` en+hi (dairy terms: FAT→फैट, SNF→एसएनएफ, shift→सुबह/शाम).
   No `alert()`/`confirm()`.

**Acceptance:**
- End-to-end: manager posts demand → farmer compares ≥2 bids and accepts → purchase created →
  collection with photo + grade → farmer OTP release → commission line (3% milk) on invoice.
- Batch mark-paid executes ≥2 member payouts through the payout rail; retry returns 409; PDF
  statement matches the ledger to the paisa.
- 26th member on Free tier → 402/403 entitlement error with upgrade prompt.
- Agent can record a collection but gets 403 on rate-chart write; audit_logs row per payout.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q          # incl. test_dairy_web_flows.py
cd website && pnpm exec tsc --noEmit && pnpm build
```
Manual: run the §10-style checklist in plan/dairy_plan.md plus the marketplace loop above with
two test accounts (manager + linked member farmer); toggle en⇄hi on every new screen.

## WS-02 — Direct Buyer "ProcurePro" finish

**Source:** robust.md §6.9; plan/direct_buyer_plan.md (P2, P4, P5, P9, P11, P12 + §10 checklist) ·
**Goal:** a processor contracts 500 farmers for a season and runs QC + settlement without
spreadsheets.

**Read first:**
- `backend/app/routers/offers.py` (counter loop), `contracts.py`, `direct_buyer.py`,
  `purchase_settlement.py`, `purchases.py`
- `backend/app/models/direct.py`, `models/contracts.py`
- `website/src/views/directbuyer/` (BuyerHomeBoard, ContractsPage, ContractFormPage,
  ContractDetailPage), `website/src/views/farmer/FarmerContractsPage.tsx`,
  `website/src/views/trade/PurchaseDetailPage.tsx`, `website/src/lib/api/offers.ts`, `purchases.ts`
- `plan/direct_buyer_plan.md` §1.4 gap table, §3 backend prereqs, §9 compliance map

**Steps:**
1. **P2 — 3-round negotiation.** In `offers.py` + `models/direct.py`: alternating counters from
   `pending` (by `toId`) and `countered` (by `fromId`), `rounds` counter, reset `expiresAt` each
   round, **400 `NEGOTIATION_CLOSED` past 3 rounds**. UI: `CounterOfferForm` shows round n/3; at
   cap show "last offer" banner (accept/reject/withdraw only).
2. **P9 — crop spec templates.** New `backend/app/routers/specs.py` + `models/specs.py`:
   `crop_specs` collection `{id, crop, name, params: [{name, unit, min?, max?, testMethod,
   adjustmentPerUnit}], createdBy}`. Endpoints `GET /specs?crop=`, `POST /specs` (buyer custom).
   Seed templates: **Tomato** (BRIX % ≥4.5, firmness, size 55–70mm, defect ≤5%), **Sugarcane**
   (sucrose %/pol, trash %, weight), **Wheat** (moisture %, foreign matter %, hectolitre weight),
   **Onion** (size mm, rot %, moisture). `adjustmentPerUnit` = ₹/unit premium(+) / deduction(−),
   integer paisa.
3. **P11 — QC sliding settlement.** `QcIn` += `measurements: list[{name, value}]`,
   `photos: list[str]`; new `POST /purchases/{id}/qc/photos` (multipart, prefix `"purchases"`,
   max 5, allowed in `delivered|qcDisputed`). If the purchase carries a `specSnapshot` (from the
   contract), server computes `qualityAdjustment = Σ adjustmentPerUnit × deviation` and
   `finalRate = agreedPricePerUnit + adjustment/qty`; else the old grade path. Invoice + both
   parties' views render the parameter table with per-line ₹ adjustments (E18 transparency).
4. **P4 — pickup mode/slot.** `PickupIn` += `mode: "farmerDelivers"|"buyerPicksup" = "buyerPicksup"`,
   `slot: str`; stored on `pickup`, shown on the term sheet.
5. **P12 — team sub-accounts RBAC.** New `backend/app/routers/buyer_org.py`: `buyer_orgs` doc
   `{adminUid, companyName, members: [{uid, role: "admin"|"procurement"|"qa"|"finance",
   addedAt}]}`. `POST /buyer-org/invite {phone, role}` (invitee must already be registered),
   `GET /buyer-org`, `DELETE /buyer-org/members/{uid}`. Role gates: escrow fund = finance/admin,
   QC submit = qa/admin, contract create/update = procurement/admin → **403 `ORG_ROLE_REQUIRED`**.
   UI renders role-gated buttons disabled with reason ("Ask your admin" + TeamPage deep link),
   never hidden. This is the flagship Enterprise-tier feature.
6. **DemandDetailPage + BidTable** (new view + route) for spot RFQs: `GET /demands/{id}` +
   `GET /offers/mine?filter=received&targetType=demand`; reuses the P2 counter loop.
7. **KYC.** Submission side for corporate buyers: doc types **FSSAI** (food businesses),
   **IEC/APEDA** (exporters), **GST** via the phase-00 KYC pipeline; gate contract creation on
   approved docs. Admin corporate verification queue = superadmin module 07 (phase-07) — leave a
   dated note, do not build the admin UI here.
8. **Grow-for-us card polish.** `FarmerContractsPage`/`FarmerContractDetailPage` already render
   decision cards with MPIN e-sign (existing `/contracts/{id}/accept` with `signatureData` +
   `consentTimestamp` — do NOT touch the e-sign flow). Add: expected income vs mandi benchmark
   (12-week band), agronomy risk notes — both fed by WS-07 M18 (`contracts.attractiveness.v1`)
   with a static fallback when the flag is off.
9. **P5 — tests.** New `backend/tests/test_purchase_settlement.py` (escrow fund, OTP
   wrong/expired/attempts, QC full/partial + sliding adjustment to the rupee, resolve, pay caps,
   invoice, org role gates) + `test_buyer_org.py`; extend `test_direct_buyer.py`. Zero-coverage
   settlement router is a release blocker today.
10. **Tiers.** Free = 1 active contract; Pro ₹4,999/mo = 5 contracts + QC suite + price alerts;
    Enterprise ₹24,999/mo = unlimited + team RBAC + API + account manager. Settlement commission
    **1–2%** ledgered on the invoice. Enforce server-side via phase-00 entitlements.
11. Guardrails (carry from plan §9): `MaskedPhoneText` + `D4TextGuard` on all free text, chat
    only post-booking, OTP-only handover (no QR dependency), tour list region-sorted text — no
    map/GPS, no COD. No hardcoded strings — `t()` en+hi incl. अनुबंध, आपूर्ति शेड्यूल, गुणवत्ता
    मानक, नेट-30.

**Acceptance:**
- QA member submits BRIX 5.1 (+₹75/q) and moisture 13% (−₹20/q); `finalAmount` matches hand
  computation on BOTH buyer and farmer screens; QC photos attached and immutable on `qcDisputed`.
- 4th counter round → 400 `NEGOTIATION_CLOSED`; finance-only escrow: procurement member gets
  403 `ORG_ROLE_REQUIRED` and a disabled-button reason in UI.
- `test_purchase_settlement.py` + `test_buyer_org.py` green; 2nd contract on Free tier blocked
  with upgrade prompt; 1–2% commission line on invoice.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q
cd website && pnpm exec tsc --noEmit && pnpm build
```
Manual: plan §10 checklist — contract (mandiLinked, weekly ×8) → farmer MPIN e-sign → slot PO
(idempotent replay returns same purchase) → escrow by finance member → OTP (1 wrong attempt) →
sliding QC → release → invoice with commission + TDS note → 8/8 slots → fulfilled → renew clones.

## WS-03 — Bank Manager "CreditDesk" console

**Source:** robust.md §6.11; ai.md flow 5.7 ·
**Goal:** a bank manager clears his daily queue in-app and every decision is audit-logged.

**Read first:**
- `backend/app/routers/loans.py` (full endpoint surface below), `backend/app/services/loans.py`
- `backend/app/routers/finance.py` (`GET /finance/credit-score`, `GET /finance/kcc`,
  `GET /finance/loans`, `POST /finance/loans/apply`)
- `website/src/lib/dashboard.ts` (toolIds `bankManagerHome`, `loanDashboard`, `loanReview`,
  `loanTracking` registered — placeholder skeletons today), `website/src/lib/api/bank.ts`

**Backend ground truth (exists, do not rebuild):** status machine
`submitted → underReview → infoRequested → approved → disbursed` (side `rejected`, `cancelled`),
numbering `LN-YYYY-####`. Endpoints: `GET /loans/queue`, `GET /loans/stats`,
`GET /loans/{applicationId}`, `POST /loans/{id}/review|approve|reject|info-request|respond|cancel|disburse`,
`GET /loans/{id}/schedule` (EMI schedule), `POST /loans/{id}/documents`.

**Steps:**
1. New API wrapper `website/src/lib/api/loans.ts` (typed, thin, standard error envelope
   `{"error":{code,...}}`, `Idempotency-Key` on writes via `client.ts`).
2. New views `website/src/views/bank/` (new): `BankHomeBoard.tsx` (queue depth by SLA,
   approvals today, disbursals this week, at-risk accounts, portfolio totals — from
   `/loans/stats`), `LoanQueuePage.tsx` (filters: status / amount range / district; real cursor
   pagination), `LoanDetailPage.tsx` (farmer-360: profile, KCC from `/finance/kcc`, credit score
   from `/finance/credit-score`, land/crop data, repayment history from `/finance/loans`,
   uploaded documents viewer), `PortfolioPage.tsx` (NPA watch list, EMI collection rate).
3. **Action bar** on detail: Approve / Reject / Request-info — each requires a typed
   reason/note; every call writes `audit_logs` with actor, action, reason (global rule 8;
   reject already stores `body.reason` — surface it). Disbursal execution button (`approved` →
   `disbursed`) + EMI schedule view (`/loans/{id}/schedule`).
4. **Partner-bank seam + referral fee (R4).** Add optional `partnerBankId` on applications;
   track referral/origination fee per disbursal in the settlements ledger (integer paisa,
   audit_logs). Keep underwriting on-platform for NBFC/partner banks — no external calls.
5. **Farmer mirror (F17).** `loanTracking` tool → `LoanTrackingPage.tsx` in farmer views:
   application status tracker (`LN-YYYY-####` chip, stage timeline), document requests rendered
   as **task-engine tasks** (phase-01) with upload deep link (`POST /loans/{id}/documents` +
   `POST /loans/{id}/respond`), EMI reminders via notify service.
6. **Tiers.** Per-seat licensing for partner institutions: Enterprise only, **₹2,000/seat/mo**;
   origination fee per disbursal (R4). Enforce seat count via entitlements.
7. No hardcoded strings — `t()` en+hi (बैंक terms: वितरण disbursal, किस्त EMI, अनुमोदन approval).
   Money in ₹ from integer paisa. No `alert()`/`confirm()`.

**Acceptance:**
- Manager processes a seeded queue of ≥10 applications entirely in-app (review → approve/reject/
  info-request), each decision visible in `audit_logs` with reason; farmer sees each status change
  on his tracker within one refresh and gets a task for every info-request.
- Disbursal renders the full EMI schedule; portfolio page shows NPA watch + collection rate.
- M14 prescreen annotations (WS-07) appear as badges but queue works unchanged with flag off.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q   # add test_credit_desk_web.py (queue filters,
                                              # action audit rows, disburse+schedule, farmer mirror)
cd website && pnpm exec tsc --noEmit && pnpm build
```
Manual: bankManager persona → clear the day's queue end-to-end; farmer persona → respond to a
doc request from the task deep link; verify EMI reminder notification fires.

## WS-04 — Insurance "ClaimsDesk" console

**Source:** robust.md §6.12; ai.md flow 5.8 ·
**Goal:** claim cycle time is measurable and every farmer tracks his claim like a courier package.

**Read first:**
- `backend/app/routers/insurance.py` (provider console, prefix `/insurance`),
  `backend/app/routers/insurance_claims.py` (farmer claims, same prefix)
- `backend/app/services/claims.py`
- `website/src/lib/dashboard.ts` (toolIds `insuranceProviderHome`, `insurancePolicyReview`,
  `insuranceClaimReview`, `cropInsurance`)

**Backend ground truth:** claim stages `intimated → surveyorAssigned → fieldAssessed →
dbtApproved → disbursed` (side `rejected`, appeal resubmit). Provider endpoints:
`GET /insurance/provider/policies[/{id}]`, `POST /insurance/provider/policies/{id}/review`,
`GET /insurance/provider/claims[/{claim_id}]`, `POST .../schedule_survey` `{surveyorName,
surveyorPhone, surveyorVisitDate}`, `POST .../survey_report` `{assessedLossPercent,...}`,
`POST .../review`, `POST .../disburse`, `GET /insurance/provider/stats`,
`POST /insurance/provider/rates`. Farmer endpoints: `POST /insurance/claims` (multipart,
geo-tagged photos), `GET /insurance/claims[/{claim_id}]`, `POST /insurance/claims/{claim_id}/appeal`
(only from `rejected`).

**Steps:**
1. New API wrapper `website/src/lib/api/insurance.ts`; new views `website/src/views/insurance/`
   (new): `ClaimsDeskHome.tsx` (new intimations with **72-h SLA clock**, surveys pending
   assignment, claims by stage, DBT pending, rejection/appeal stats — `/provider/stats`),
   `ClaimsQueuePage.tsx` (stage filter + SLA sort), `ClaimDetailPage.tsx` (claim timeline, farm
   map + crop cycle context, **geo-tagged photo evidence viewer** with capture-coordinates chip),
   `SurveyorsPage.tsx` (roster + assignment A2 — roster is a provider-managed list of
   `{name, phone, districts[]}`; assignment calls `schedule_survey`; surveyor phone stays
   server-side except in the farmer's own claim notification, which the backend already sends),
   `DisbursePage.tsx` (DBT execution + stats).
2. **Farmer mirror (F15).** In farmer views: 72-h intimation form with **guidelines overlay**
   (what to photograph, deadline countdown) → `POST /insurance/claims`; multi-stage tracker page
   (courier-style stage timeline intimated→surveyorAssigned→fieldAssessed→dbtApproved→disbursed);
   appeal/resubmit form on rejected claims. These farmer pages land HERE (not phase-05); the
   §7.9 module sweep in phase-05 only polishes policy purchase — leave a note.
3. **Policy review queue** (`insurancePolicyReview`): list + review action on
   `/provider/policies/{id}/review`.
4. **Rate-table editor seam.** `POST /insurance/provider/rates` exists with effective dating —
   build a provider self-service rates page; the *admin* rate approval editor is superadmin
   module 15 → phase-07 (dated note, not built here).
5. **Fees.** Per-claim processing fee + Enterprise console licensing (R4) — ledger per
   disbursement via settlements; integer paisa; audit_logs on every review/disburse with reason.
6. Every decision human-made (AI in WS-07 only annotates). `t()` en+hi (बीमा terms: सूचना
   intimation, सर्वेयर, क्षतिपूर्ति). No paywall on farmer claim filing (global rule 5).

**Acceptance:**
- Claim lifecycle exercised end-to-end: farmer intimates with photos inside 72 h → provider
  assigns surveyor → survey report (`assessedLossPercent`) → approve → DBT disburse → farmer
  tracker shows every stage with timestamps; cycle time derivable from `/provider/stats`.
- Rejected claim → farmer appeal → claim re-enters queue; audit_logs rows for review + disburse.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q   # add test_claims_desk_web.py
cd website && pnpm exec tsc --noEmit && pnpm build
```
Manual: two-account flow above; verify SLA clock renders for a claim created >48 h ago; en⇄hi
toggle on tracker and guidelines overlay.

## WS-05 — Cold Storage "StoreHouse" console

**Source:** robust.md §6.13 ·
**Goal:** a facility runs its chamber register digitally and farmers hold verifiable warehouse
receipts usable for credit.

**Read first:**
- `backend/app/routers/post_harvest.py` (prefix `/post-harvest`) — full surface:
  `GET /cold-storage[/{facility_id}]`, `POST /cold-storage/{id}/book`, `POST /cold-storage/{id}/apply`,
  `GET /bookings/{booking_id}`, `POST /bookings/{booking_id}/request-release`,
  `GET /receipts/{receipt_number}`, `GET /provider/stats`, `GET /provider/bookings[/{id}]`,
  `POST /provider/bookings/{id}/review|inward|release`, `GET/POST /provider/facilities`,
  `POST /provider/facilities/{id}/chambers`, `PUT /provider/facilities/{id}`, `POST /grade` (stub)
- `website/src/lib/dashboard.ts` (toolIds `coldStorageHome`, `postHarvest`, `myBookings`)

**Steps:**
1. New API wrapper `website/src/lib/api/coldStorage.ts`; new views
   `website/src/views/coldstorage/` (new): `StoreHouseHome.tsx` (chamber utilization %, bookings
   pending approval, lots inward today, releases due, revenue this month — `/provider/stats`),
   `FacilitiesPage.tsx` + `ChambersPage.tsx` (facility + chamber management: capacity,
   **₹/q/month pricing**, active/inactive), `BookingsQueuePage.tsx` (approve/reject with reason),
   `InwardRegisterPage.tsx` (digital inward register: lot, grade, photo per inward),
   `ReleasePage.tsx` (release workflow against farmer `request-release`), `UtilizationPage.tsx`.
2. **Farmer side (§7.14 / F11).** Farmer views: cold-storage directory with **live capacity**,
   booking form (`POST /cold-storage/{id}/book` — capacity/slot decrement is server-side;
   surface remaining capacity), my-bookings list with status, **warehouse receipts vault** —
   receipts exist server-side; render a verifiable receipt page from
   `GET /post-harvest/receipts/{receipt_number}` and list them in the farmer's documents vault.
3. **CreditDesk link.** In WS-03's `LoanDetailPage` documents section, offer "attach warehouse
   receipt" — stores the receipt number as a loan document (`POST /loans/{id}/documents`),
   closing the receipt → loan-collateral loop (robust §6.13 step 2).
4. **AI grading integration point ONLY.** `POST /post-harvest/grade` remains the stub; leave a
   dated note: real Gemini Vision grading = AI brief M10, phase-05. Do not build it here.
5. **Tiers.** Pro **₹1,999/mo per facility** (provider console beyond one facility read-only
   otherwise) + per-booking platform fee ledgered on release (R2/R3). Integer paisa; audit_logs
   on review/release with reason. `t()` en+hi (गोदाम, कक्ष chamber, रसीद receipt).

**Acceptance:**
- Provider onboards facility + 2 chambers, approves a booking, records inward (lot/grade/photo),
  executes release; utilization % and revenue update on home.
- Farmer books from the directory (capacity decrements), retrieves his warehouse receipt by
  number, attaches it to a loan application and sees it in the bank manager's document list.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q   # add test_storehouse_web.py
cd website && pnpm exec tsc --noEmit && pnpm build
```
Manual: full provider + farmer flow above; verify Free-tier provider blocked from console writes
with upgrade prompt; receipt page renders without auth leak (owner-only).

## WS-06 — Gaushala + Vet polish

**Source:** robust.md §6.14 ·
**Goal:** a farmer's animal-health calendar appears in his task dashboard automatically;
gaushalas fundraise on-platform with receipts.

**Read first:**
- `backend/app/routers/livestock_vets.py` (managed vets CRUD, claim, appointments,
  prescriptions, campaigns + `mark-vaccinated`), `livestock_gaushala.py`,
  `livestock.py` (herd registry, vaccinations)
- `website/src/views/vetnet/`, `website/src/views/gaushala/`, `website/src/views/animals/`
  (all landed — extend, don't fork), `website/src/lib/api/vetnet.ts`, `gaushala.ts`
- phase-01 task engine (task emission API), phase-00 entitlements

**Steps:**
1. **Vet credential verification.** Add `credentialStatus: "pending"|"verified"|"rejected"` +
   credential doc refs on managed-vet records (`POST /livestock/vets/managed`, `PUT .../{id}`).
   Unverified vets can take appointments but are badge-marked "verification pending" in the
   directory and cannot run campaigns. The verification *queue UI* is superadmin module 19
   (phase-07) — expose the filtered list endpoint + status-mutation endpoint with audit_logs +
   reason now, leave the admin screen as a dated note.
2. **Vet Pro tier ₹299/mo.** Entitlement-gate: clinic management (schedule editor
   `/livestock/vets/me/schedule`), prescription templates, campaign tools
   (`/livestock/vet/campaigns*`). Free vets keep appointments + basic prescriptions.
3. **80G receipt automation polish.** `GET /livestock/gaushala/receipts` (B8) exists — on
   donation approval auto-generate the 80G receipt PDF via `services/reports.py`, attach to the
   donation record, surface download on `ReceiptsPage` and in the donor confirmation. Receipt
   numbering must be sequential per gaushala per FY.
4. **Gaushala public transparency page.** New public (no-auth) route `/gaushala/{id}/transparent`
   (new view): aggregated donations ledger (donor name optional/anonymized, amounts, 80G count),
   expense-by-category summary, cattle census by status — all from
   `GET /livestock/gaushala/analytics` + receipts aggregates. Trust → more donations (R6
   adjacency). No donor phone/PII, ever.
5. **Herd-health tasks.** On vaccination record due dates and on campaign enrollment
   (`POST /livestock/vet/campaigns/{id}/enroll`), emit task-engine tasks to the owning farmer
   ("vaccination due: <animal>, <date>") with a deep link to the animal detail / campaign page;
   `mark-vaccinated` resolves the task. This is the phase-01 task-engine integration — no
   parallel reminder system.

**Acceptance:**
- A vaccination due date produces a farmer dashboard task that deep-links and auto-resolves on
  mark-vaccinated; an unverified vet is badged and blocked from campaign creation (403).
- Donation approval yields a downloadable sequentially-numbered 80G PDF; the public transparency
  page renders for a logged-out visitor with zero PII.
- Free-tier vet hits the entitlement wall on campaign creation with an upgrade prompt.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q   # extend test_dairy_gaushala_analytics.py /
                                              # add test_vet_gating.py
cd website && pnpm exec tsc --noEmit && pnpm build
```
Manual: farmer task flow above; logged-out transparency page; ₹299 upgrade → campaign unlock.

## WS-07 — AI console decisions (M14, M15, M17, M18)

**Source:** ai_implementation_plan.md briefs M14/M15/M17/M18 + §3 recipes; ai.md flows 5.7/5.8 ·
**Goal:** the four console question sets live at `suggest` level through the gateway — AI
annotates, humans decide, everything degrades gracefully.

**Recipe (SDR, restated — applies to all four):**
1. Register the question set in `backend/app/services/ai/question_sets.py` (schema + threshold +
   deterministic fallback).
2. Build state via a `privacy.py` builder — pseudonymized, ≤1,500 tokens; **no Aadhaar, phone,
   or email in any payload** (rule 11).
3. `result = await gateway.decide(state, "<id>.v1", ctx)` — never call OpenRouter/Gemini from
   routers (rule 10).
4. Act at `suggest` = annotate only. Credit/insurance may NEVER exceed `require_confirm`
   (rule 12); these four launch and stay at `suggest` for credit/insurance paths.
5. On exception/timeout/low budget → fallback; log with `fallbackUsed`. Every call logged to
   `ai_decisions` with cost + confidence.
6. Register an outcome hook per set.
7. Tests: golden fixture passes on shim; fallback test with gateway raising; flag-off test
   proving the module works without AI. **Verification for every brief:**
   `cd backend && .venv/bin/python -m pytest -q` green, `cd website && pnpm build` green, and
   the feature works with `AI_PROVIDER=shim`. CI never calls paid APIs.

**Read first:** `backend/app/services/ai/` (from phase-00 — gateway, question_sets, privacy,
budgets), plus per-brief files below.

**Steps:**

1. **M14 — `loans.prescreen.v1` (CreditDesk).** Read: `backend/app/routers/loans.py`,
   `routers/finance.py`. Score on application submit + queue read; `GET /loans/queue` returns the
   sorted list with `ai` annotations (risk band, missing docs). Missing docs → task emitted to
   the farmer via the task engine. Manager UI badges on `LoanQueuePage`/`LoanDetailPage`.
   **AI never mutates application status** — sorting only. Outcome hook:
   approved/rejected/defaulted.
   Acceptance: golden-set ranking correlation ≥ 0.7 vs manager labels; flags off =
   submitted-order queue.
2. **M15 — `insurance.triage.v1` (ClaimsDesk).** Read: `backend/app/routers/insurance_claims.py`,
   `routers/insurance.py`. At intimation: photo-quality/completeness **instant feedback** with
   retake guidance en/hi ("retake now, not rejection in 15 days" — ai.md 5.8). Provider console:
   triage badges with reasons + suggested surveyor assignment. **`fraud_signal > 0.8` → flag,
   never auto-reject**; the human decision path is byte-identical with AI on or off.
   Acceptance: incomplete claims get same-day farmer feedback; provider queue shows triage
   reasons; zero auto-rejections in tests.
3. **M17 — `dairy.adulteration.v1` (DairyOS).** Read: `backend/app/routers/dairy_manager.py`,
   `routers/livestock_dairy.py`. Per collection entry: member's **30-day FAT/SNF baseline vs
   today** → anomaly bool + confidence. Anomalous entries **flagged, not blocked** on the console
   collections ledger + a note line on the member statement (en/hi). Weekly batch job for
   route-level anomalies. Outcome hook: manager confirms/dismisses flag.
   Acceptance: seeded adulteration pattern flagged ≥85%; zero false-blocks (collections always
   save); statement flag notes render en/hi.
4. **M18 — `contracts.attractiveness.v1` (ProcurePro).** Read: `backend/app/routers/contracts.py`,
   `routers/direct_buyer.py`, `website/src/views/directbuyer/`, `website/src/views/farmer/`.
   State: contract terms (formula pricing), crop mandi trend, farmer crop history →
   `income_vs_mandi` score + risk flags. Shown on the farmer grow-for-us decision card (WS-02
   step 8) with an explanation sheet (Gemini one-liner per SGR, **cached per decision_id, never
   per page-view**). E-sign flow untouched.
   Acceptance: card shows score + honest explanation (including when the contract is WORSE than
   mandi); golden contracts rank sensibly; flag off = card without score, everything else works.

**Acceptance (whole WS):** all four sets registered with fallbacks; `ai_decisions` rows carry
cost + confidence + `fallbackUsed`; credit/insurance automation level verified at `suggest` in
config; full suite green with `AI_PROVIDER=shim`.

**Verification:** per-brief standard above, plus manual: bank queue sorted with badges
(shim) → switch flag off → submitted-order queue; dairy ledger shows anomaly flag on a seeded
collection; grow-for-us card shows score + cached explanation (second load makes no new
`ai_decisions` row).

## Phase-final verification

```bash
cd backend && .venv/bin/python -m pytest -q          # fully green (incl. all pre-existing
                                                     # dairy/gaushala/contracts suites)
cd website && pnpm exec tsc --noEmit && pnpm build   # clean
# AI: full suite green with AI_PROVIDER=shim
# Locale parity: spot-check en/hi key parity for every new locale section
```

Manual end-to-end flows (one per workstream, from dashboard task deep-link to completion, zero
"coming soon" reachable):
1. Dairy: RFQ → bid compare → accept → OTP collection → payout batch via real rail → farmer
   ledger + PDF statement.
2. Direct buyer: contract → e-sign → slot PO → escrow (finance role) → sliding QC with photos →
   release → invoice with 1–2% commission.
3. Bank: queue → farmer-360 → approve with reason → disburse → EMI schedule; farmer tracker +
   doc task + EMI reminder.
4. Insurance: 72-h intimation with photos → surveyor assign → assess → approve → DBT; farmer
   courier-style tracker + one appeal cycle.
5. Cold storage: facility+chambers → booking approve → inward register → release; farmer
   warehouse receipt attached to a CreditDesk application.
6. Vet: vaccination-due task appears on farmer dashboard and resolves on mark-vaccinated;
   public gaushala transparency page logged-out.
7. AI: each of the four annotations visible with shim; flags off → every screen unchanged minus
   badges; no status mutation attributable to AI in any test.
