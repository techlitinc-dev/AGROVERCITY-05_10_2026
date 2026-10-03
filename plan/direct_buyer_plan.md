# Farm Direct Buyer (Industrial Procurement) — Website Implementation Plan

> **Spec:** `features/farm_direct buyer.md` (FarmGate blueprint) · **Backend ground truth:** `backend/app/routers/{offers,demands,purchases,purchase_settlement,direct_buyer,contracts,lots,mandi}.py`, `backend/app/models/{direct,role_profiles,contracts}.py` · **Target:** `website/` (React 18 + TS + Vite)
> **Date:** 2026-10-01 · **Status:** planning v2 — persona repositioned after review: **direct buyer = industrial/institutional procurer, NOT vyapari**. Nothing implemented yet.
> **Personas served:** Farmer (किसान) and Direct Buyer (उद्योग/संस्था खरीदार — ketchup processor, sugar mill, retail chain, exporter, hotel/food chain, institutional) — both must find the flow obvious.

---

## 0. Persona definition — what "direct buyer" means here

A **direct buyer purchases from farmers for consumption or production input, never for resale**. A vyapari buys 5 quintals to resell at a margin this week; a ketchup company contracts 500 tonnes of tomatoes for the season, specs them at 4.5+ BRIX, schedules weekly deliveries to its plant, pays net-30 with GST e-invoice, and sends a QA inspector. **This plan deliberately reuses the spot-trade engine (offers/purchases/escrow/QC/OTP) only as the per-delivery transaction layer; everything that makes industrial procurement "industrial" is new.**

| Dimension | Vyapari / Seller (existing) | **Direct Buyer (this plan)** |
|---|---|---|
| Why they buy | Resale margin | Production input / consumption (process, serve, export) |
| Deal type | Spot, one-off | **Supply contracts** (season/annual) + scheduled deliveries; spot RFQs only for opportunistic top-ups |
| Volume | 1–10 q per deal | Tonnes per month, recurring, minimum-contracted-quantity clauses |
| Price | Fixed negotiated rate | **Formula pricing**: mandi-modal-linked, MSP+premium, or quality-sliding (premium/deduction per measured parameter) |
| Quality | Grade A/B/C by eye | **Lab-grade spec** (BRIX %, sucrose/polarisation, moisture %, size mm, foreign matter, residue) with per-parameter adjustment |
| Logistics | Ad-hoc pickup | **Delivery schedule** per contract; multi-farm pickup tour lists; plant/godown addresses (multi-address registry) |
| Payment | Khata/UPI informal | **Corporate terms**: credit days (`creditTermsDays` already on the role profile), GST invoice, TDS, statement of account, escrow per delivery |
| People | Single owner | **Team sub-accounts**: admin / procurement manager / QA inspector / finance viewer (RBAC) |
| Compliance | Minimal | FSSAI/GST fields, **farm→lot→delivery→invoice traceability** |
| Farmer relationship | Transactional | **Contractual**: "grow for us" offers, agronomy-aligned schedules, FPO/block aggregation |

---

## 1. Ground truth — what the backend implements today

### 1.1 The existing trade chain (reused as the per-delivery transaction engine)

The spot chain is fully shipped (per `plan/seller_plan.md` + verified): lots → offers (create/counter/accept → auto-creates purchase) → purchases with the complete settlement machine (advance, **escrow fund**, pickup schedule, dispatch/deliver, cancel, **handover OTP** farmer-reveal/buyer-verify, **QC** full-or-partial, dispute-resolve, balance pay, two-sided ratings, invoice) and a `/direct-buyer` router (profile stats, procurement analytics, matching feed, saved farmers). Role profile `DirectBuyerRoleProfile` (`role_profiles.py:61`): `companyName`, `buyerType: retailer|wholesaler|processor|exporter|hotel|institutional`, `gstin`, `licenseNo`, `capacityPerMonth`, `categories[]`, `operatingStates[]`, `creditTermsDays`.

**And crucially, a contracts seed exists** (`backend/app/routers/contracts.py` + `models/contracts.py`): a `contracts` collection of contract-farming records `{id, buyerCompany, buyerRating, crop, lockedRateQuintal, mspCurrentRate, premiumAboveMSP, minQuantityQuintals, deliveryLocation, paymentTerms, status, contractDuration, termsText, acceptedBy}` with `GET /contracts` (view: farmer/seller/broker), `GET /contracts/{id}`, and `POST /contracts/{id}/accept` — **farmer/seller MPIN e-sign** writing an acceptance record (`signatureData`, `consentTimestamp`). This is the exact spec S10 "OTP e-sign" mechanism, ready to reuse.

### 1.2 Status enums that drive the whole UI

| Enum | Values | Drives |
|---|---|---|
| `OfferStatus` | `pending → countered → accepted` (terminal `rejected`/`withdrawn`/`expired`, lazy 24h) | spot bid cards, BidTable, countdown |
| `PurchaseStatus` | `confirmed → advancePaid → pickupScheduled → inTransit → delivered → completed` (side `qcDisputed → completed`; terminal `cancelled`) | the per-delivery Timeline + action bar (shared screen) |
| `EscrowStatus` | `unfunded → held → released \| refunded` | escrow card per delivery |
| `ContractStatus` (seed) | `open → accepted` (single global accept) | **must be extended** (§3 P8) into `draft → offered → active → fulfilled \| cancelled`, targeted per farmer/FPO |
| `Frequency` | `oneTime \| weekly \| monthly` | standing demands; reused by delivery schedules |
| `Grade` | `A \| B \| C` | fallback QC when no spec attached |

### 1.3 What the website already has

Trade module fully built and API-driven (`PurchaseDetailPage` has every settlement sheet; `DiscoverPage` already switches to `buyerFeed()` for directBuyer; `AnalyticsPage` consumes `/direct-buyer/analytics`; `SavedFarmersPage` wired; onboarding collects the full directBuyer role profile). Persona registered: `personas.ts:32`, `PROFILE_ROUTES.directBuyer` (`dashboard.ts:173`), `DEFAULT_HOME_ROUTE.directBuyer = 'directBuyerHome'`, `PERSONA_HOME_CONFIG.directBuyer` (Total Spend / Total Volume / Active Demands). **Missing:** `directBuyerHome` and `demandDetail` have no TOOL_LIST entry/page → placeholder skeletons.

### 1.4 Gaps that shape this plan

| # | Gap | Impact |
|---|---|---|
| G1 | `directBuyerHome` / `demandDetail` registered but unbuilt | buyer lands on a skeleton; spec's bid-comparison screen absent |
| G2 | Buyers excluded from `MANDI_ROLES` and `MARKET_ROLES`/`order_tracking` gates while PROFILE_ROUTES advertises marketplace tiles | 403s on day one (P1/P6) |
| G3 | Contracts are **read-only seeds**: no buyer-side creation, no farmer targeting, no schedule, no formula pricing, no spec, accept is a free-for-all (any farmer/seller can sign any open contract) | the core industrial differentiator doesn't exist |
| G4 | QC is grade+qty only: **no measured parameters, no photo evidence, no sliding price** | spec F10/B7/E9/E18 quality settlement impossible |
| G5 | Pickup has no **delivery mode/slot**; no per-contract delivery schedule generating purchases | F8/F9 term sheet + scheduled supply impossible |
| G6 | Negotiation capped at **1 counter round** (spec F7/B3/E7: 3) | deadlocks early |
| G7 | **No team sub-accounts/RBAC** (spec B16); single-user assumption everywhere in the trade chain | a company account can't separate procurement/QA/finance |
| G8 | `purchase_settlement.py` has **zero tests**; no directBuyer quick-login persona; escrow releases at QC-complete (not OTP — see §9) | hygiene + testing gaps |

---

## 2. Design principles (ease-of-use contract)

**Shared**
1. **Two layers, one mental model.** *Contract* (the relationship: what, how much, at what formula, on what schedule) → *Deliveries* (each scheduled drop runs the familiar purchase flow: escrow → pickup → OTP → QC → invoice). Users learn one flow; contracts just repeat it on a calendar.
2. **Price is a formula, shown as a number.** Every contract/offer card renders the formula's *current value* ("mandi modal ₹2,140 + ₹160 premium = **₹2,300/q today**") plus a 12-week history band. Nobody negotiates a formula they can't see evaluated (E7 anti-gaming floor: block bids below mandi −X%).
3. **Quality is a table, not an argument.** Specs are parameter rows (name, unit, acceptable range, adjustment per unit). At QC the measured values fill the same rows and the price adjustment computes live — the deduction the buyer takes is visible to the farmer *before* confirm (E18 split-ledger transparency).
4. **Mask all phones; D4 guard on all free text; chat only post-booking** (spec G1/G2/G3) — reuse broker-module components (`MaskedPhoneText`, `D4TextGuard`, chat door).
5. **Offline drafts** for contracts/specs/demands; money actions never queued offline.
6. **Hindi + English parity**; industrial Hindi where needed (कांटा, बीक्स/BRIX, पॉलराइजेशन, अनुबंध, आपूर्ति Calendar).

**Buyer (industry)**
7. **Cockpit home:** today = this week's scheduled deliveries + fulfilment % + open contract offers awaiting farmer sign + unmet demand nudges. Finance sees escrow exposure; QA sees today's gates.
8. **Contract builder ≤ 3 minutes:** pick farmer/FPO (from saved farmers / analytics top suppliers) → pick crop → spec template auto-loads → choose formula → set schedule → preview both parties' math → send. Templates remembered per crop.
9. **One-tap slot → purchase:** each scheduled delivery has a "Create purchase order" action that reuses the entire existing settlement UI unchanged.
10. **Team-shaped UI:** every action is labelled with the role that can perform it ("QA Inspector", "Finance"); role-gated buttons render disabled with reason, not hidden.

**Farmer**
11. **"Grow for us" offers are decision cards:** crop, total contracted qty, formula price evaluated today, premium table, pickup schedule at my village, payment terms (net N days), company badge — Accept (MPIN e-sign, already backend-supported) / Counter terms (price premium, schedule) / Decline.
12. **Supply calendar first:** home shows upcoming contracted pickups merged with harvest plan; one tap to call up that delivery's detail.
13. **OTP is the farmer's power button** (E17): reveal only when produce and weighbridge slip are ready; big countdown; regenerate on expiry.
14. **See the quality math:** after QA, the farmer sees each measured parameter next to the spec range and the exact ₹ premium/deduction — and guidance hints ("moisture 14% → dry 2 more days to earn +₹40/q").

---

## 3. Backend prerequisites (minimal, exact)

**Phase 0A — small fixes (independent):**

| # | Change | File | Exact requirement |
|---|---|---|---|
| P1 | mandi + marketplace role gates | `routers/mandi.py`, `marketplace.py`, `order_tracking.py` | Add `"directBuyer"` to `MANDI_ROLES` and the marketplace/order role tuples (or prune PROFILE_ROUTES — adding is recommended). |
| P2 | 3-round negotiation | `routers/offers.py`, `models/direct.py` | Alternating counters capped at 3 rounds: counter allowed from `pending` (by `toId`) **and** `countered` (by `fromId`), `rounds` counter, reset `expiresAt` each round, 400 `NEGOTIATION_CLOSED` past cap. Old behavior = rounds 1 subset. |
| P6 | quick-login persona | `routers/auth.py` `PERSONA_DEFAULTS` | `"directBuyer"`: `dev-user-8`, firm "Shree Foods Pvt Ltd", buyerType processor, phone +919222222222. |

**Phase 0B — the industrial layer (the actual differentiator):**

| # | Change | File | Exact requirement |
|---|---|---|---|
| **P8** | Buyer contract CRUD + targeting | extend `routers/contracts.py` + `models/contracts.py` | `ContractCreate`: `{farmerId \| fpoId, crop, specId?, quantityTotal, priceType: "fixed"\|"mandiLinked"\|"mspLinked", baseRate?, premiumPerQuintal?, mandiName?, qualitySliding: bool, deliverySchedule: {startDate, endDate, frequency: "weekly"\|"biweekly"\|"monthly", qtyPerDelivery}, deliveryAddress, paymentTermsDays, termsText}` → doc `con_<hex>` with `buyerId`, `buyerCompany`, `status: "offered"`, `farmerId` (targeted — replaces free-for-all accept), `acceptedAt`, `deliveriesGenerated: 0`. Endpoints: `POST /contracts` (buyer, role directBuyer\|seller), `GET /contracts/mine?role=buyer\|farmer` (targeted to me), `PUT /contracts/{id}` (buyer, offered only), `POST /contracts/{id}/cancel`. Extend accept: only targeted `farmerId` (or FPO member) may MPIN-accept; status `offered → active`. Add farmer `POST /contracts/{id}/decline {reason}`. Keep the old list/get shape backward compatible. |
| **P9** | Crop spec templates | new `routers/specs.py` + `models/specs.py` | `crop_specs` collection: `{id, crop, name, params: [{name, unit, min?, max?, testMethod, adjustmentPerUnit (₹/unit premium+, deduction−)}], createdBy}`. Seed templates for Tomato (BRIX %, firmness, size mm, defect %), Sugarcane (sucrose %/pol, trash %, weight), Wheat (moisture %, foreign matter %, hectolitre weight), Onion (size mm, rot %, moisture). Endpoints: `GET /specs?crop=`, `POST /specs` (buyer custom). |
| **P10** | Delivery schedule → purchase generation | extend `routers/contracts.py` (calls `purchases._new_purchase`) | `POST /contracts/{id}/deliveries` `{slotDate}` → creates a purchase (status `confirmed`, `source.type="contract"`, `source.refId=contractId`, `contractId`, `deliverySlot: slotDate`, `quantity=qtyPerDelivery`, price computed from priceType: fixed=baseRate; mandiLinked=current modal of `mandiName` + premium; mspLinked=MSP + premium), increments `deliveriesGenerated`, appends slot to `contract.deliveries[]`. Idempotent per (contract, slotDate) → returns existing. `GET /contracts/{id}/deliveries` → slots enriched with purchase status (fulfilment %). |
| **P11** | QC sliding settlement | `purchase_settlement.py`, `models/direct.py` | `QcIn` += `measurements: list[{name, value}] = []`, `photos: list[str] = []` (new `POST /purchases/{id}/qc/photos` multipart, prefix `"purchases"`, max 5, allowed in `delivered\|qcDisputed`). If the purchase has a `specSnapshot` (carried from contract), server computes `qualityAdjustment = Σ adjustmentPerUnit × deviation` and `finalRate = agreedPricePerUnit + adjustment/qty`; else old grade path. `finalAmount` uses finalRate; invoice + both parties' views show the parameter table and adjustment lines. |
| **P12** | Team sub-accounts (RBAC) | new `routers/buyer_org.py` + service | `buyer_orgs` doc per buyer uid: `{adminUid, companyName, members: [{uid, role: "admin"\|"procurement"\|"qa"\|"finance", addedAt}]}`. `POST /buyer-org/invite {phone, role}` (invitee must be a registered user; auto-join), `GET /buyer-org`, `DELETE /buyer-org/members/{uid}`. Helper `_org_role(uid)`; extend `/direct-buyer/*`, contract CRUD, escrow fund (finance/admin), QC submit (qa/admin), contract create/update (procurement/admin) to accept org members with role gates (403 `ORG_ROLE_REQUIRED`). |
| **P13** | Farmer contract surface | new `routers/farmer_contracts.py` (or extend contracts.py) | `GET /farmer/contracts?status=` (offered/active/fulfilled where farmerId == uid, enriched with computed current formula price), `POST /farmer/contracts/{id}/respond` `{action: accept\|decline, mpin?, reason?}` — accept delegates to the existing MPIN e-sign accept; `GET /farmer/contracts/{id}/deliveries` (upcoming pickups calendar). |
| **P4** | Pickup mode + slot | `models/direct.py` `PickupIn` | += `mode: "farmerDelivers"\|"buyerPicksup" = "buyerPicksup"`, `slot: str = ""`; stored on `pickup`; shown on term sheet. |
| **P5** | Settlement-router tests | `tests/test_purchase_settlement.py` (new) | Escrow fund, OTP (wrong/expired/attempts), QC full/partial + sliding adjustment, resolve, pay caps, invoice, org role gates. Currently zero coverage. |

If P8–P13 slip, Phase 2–5 gate individually; the spot layer (Phase 1) ships independently.

---

## 4. Personas & information architecture

### 4.1 Persona → tools

Existing registration per §1.3. Delta:

| Tool id | Label (en / hi) | Persona | Plan |
|---|---|---|---|
| `directBuyerHome` | Procurement Home / खरीद केंद्र | directBuyer | **new** `BuyerHomeBoard` cockpit (contracts + this-week deliveries + fulfilment % + spend/volume/demands) |
| `contracts` | Supply Contracts / आपूर्ति अनुबंध | directBuyer | **new** `ContractsPage` (list by status; create CTA) |
| `contractDetail` | Contract / अनुबंध विवरण | directBuyer | **new deep route** `ContractDetailPage` (terms, formula price live, spec table, schedule, fulfilment, per-slot "create PO") |
| `qualitySpecs` | Quality Specs / गुणवत्ता मानक | directBuyer | **new** `SpecsPage` (templates per crop, custom builder) |
| `deliverySchedule` | Delivery Schedule / डिलीवरी कार्यक्रम | directBuyer | **new** `SchedulePage` (calendar of slots across contracts, tour list grouping) |
| `teamAccounts` | Team / टीम | directBuyer | **new** `TeamPage` (invite by phone, roles, remove) |
| `demandDetail` | Bids & Offers / बोली विवरण | directBuyer | **new deep route** `DemandDetailPage` + `BidTable` (spot RFQ core, F6) |
| `myContracts` | Grow-for-Us Offers / कंपनी ऑफर | farmer | **new** `FarmerContractsPage` (incoming contract offers + active contracts + supply calendar) |
| `mandi` | Mandi Prices / मंडी भाव | directBuyer | enable after P1 (gate check in MandiPage) |
| `demands`, `purchases`, `myOffers`, `browseLots`, `savedFarmers`, `analytics`, `sellProduce` | — | both | reuse existing real pages |

### 4.2 Routes

All guarded `loggedIn`, house pattern, after the broker block in `App.tsx`:

| Route | Screen | Persona | Endpoints |
|---|---|---|---|
| `/dashboard` (directBuyer) | DashboardHome + embedded `BuyerHomeBoard` | directBuyer | `/direct-buyer/profile`, `/direct-buyer/analytics`, `/contracts/mine?role=buyer`, `/contracts/{id}/deliveries` |
| `/dashboard/p/contracts/new` · `…/contracts/:contractId` | `ContractFormPage` wizard · `ContractDetailPage` | directBuyer | §3 P8/P10 |
| `/dashboard/p/qualitySpecs` | `SpecsPage` | directBuyer | `/specs?crop=` |
| `/dashboard/p/deliverySchedule` | `SchedulePage` | directBuyer | `/contracts/mine` + deliveries |
| `/dashboard/p/teamAccounts` | `TeamPage` | directBuyer | `/buyer-org*` |
| `/dashboard/p/demandDetail/:demandId` | `DemandDetailPage` + `BidTable` | directBuyer | `/demands/{id}`, `/offers/mine?filter=received&targetType=demand` |
| `/dashboard/p/myContracts` · `…/myContracts/:contractId` | `FarmerContractsPage` · detail w/ schedule + respond | farmer | §3 P13 |
| `/dashboard/p/sellProduce/:lotId` (extend) | + "Offers on this lot" | farmer | `/offers/mine?filter=received&targetType=lot` |
| `/dashboard/p/purchases/:purchaseId` (existing) | purchase detail (+ term sheet, spec table, sliding QC) | both | full settlement chain |

**Reuse:** all `components/trade/*`, broker-module `MaskedPhoneText`/`D4TextGuard`/chat-door, `ToolShell`, `Timeline`, `ConfirmSheet`, `CounterOfferForm`, `QuantityStepper`, `PriceWithBenchmark`, `EmptyState`, `PhotoUploader`.

---

## 5. Userflow

### 5.0 Shared preconditions

Session + `ensureProfile`; org members act under the buyer org with role badges (P12); every price shows its formula evaluated today + mandi benchmark.

### 5.1 MASTER FLOW B — Industrial Direct Buyer

```
[B1]  Login persona=directBuyer (P6 one-tap) → onboarding business profile (existing:
       │   companyName, buyerType=processor, GSTIN, capacity, categories, creditTermsDays)
       ▼
[B2]  Procurement home (cockpit)
       │   ┌─ This week's deliveries (slots across contracts) → fulfilment % per contract
       │   ├─ Contract offers: awaiting farmer sign │ active contracts
       │   ├─ Escrow exposure (held) + pendingBalance │ spend/volume MTD
       │   └─ Unmet demand nudge → post standing demand (spot top-up, existing DemandForm)
       ▼
[B3]  Build quality spec once per crop (SpecsPage): template auto-loads
       │   (Tomato: BRIX ≥4.5, size 55–70mm, defect ≤5%; adjustment ₹/unit per parameter)
       ▼
[B4]  Create supply contract (ContractFormPage ≤3 min)
       │   farmer/FPO picker (saved farmers, analytics top-suppliers) → crop → spec
       │   → price formula: [fixed ₹2,300/q] [mandi Nashik modal + ₹160] [MSP + ₹200 + sliding]
       │   → schedule: 500 q / weekly / 8 weeks / qty per delivery 25 q
       │   → delivery address (multi-address registry pick) → payment net-30 → preview BOTH
       │   parties' math → SEND → status offered → farmer notified
       ▼
[B5]  Farmer responds (MPIN e-sign accept ─ existing mechanism ─ or counter/decline)
       │   accept ⇒ contract ACTIVE ⇒ schedule slots visible to both
       ▼
[B6]  Per delivery slot: "Create purchase order" (P10) ⇒ PURCHASE (confirmed, contractId,
       │   price = formula evaluated at slot date) — from here the familiar settlement flow runs:
       ▼
[B7]  finance funds ESCROW (role: finance/admin) → farmer sees "escrow held — safe to deliver"
       │   procurement schedules pickup (mode/slot, P4) → dispatch → deliver
       ▼
[B8]  gate handover: farmer reveals OTP → buyer's QA (role: qa/admin) verifies OTP
       │   → measures spec parameters + photos (P11) → SLIDING PRICE computes live
       │   (e.g. BRIX 5.1 → +₹75/q; moisture 13% → −₹20/q) → confirm
       │   rejected=0 → escrow RELEASED → GST invoice (commission line, TDS note) → deal_completed
       │   partial → qcDisputed → resolve → release
       ▼
[B9]  traceability entry (contract → slot → purchase → lot lineage) + statement of account
       │   (net-30 ageing) → analytics: fulfilment %, rejection rate, price-vs-mandi trend,
       │   supplier scorecard → rate farmer ★
       ▼
[B10] contract fulfilment: slots complete → contract FULFILLED → renew/clone for next season
```

### 5.2 MASTER FLOW A — Farmer supplying industry

```
[A1]  "Grow for us" contract offer arrives (notification) → myContracts
       │   DECISION CARD: company (badge, GSTIN ✓, rating) │ crop │ total qty 500 q
       │   formula price evaluated TODAY (₹2,300/q) + premium table │ pickup schedule
       │   at my village (weekly, 6–9 AM) │ payment net-30 │ terms
       │   [ Accept & e-sign (MPIN) ] [ Counter terms ] [ Decline ]
       ▼
[A2]  Accept ⇒ ACTIVE → SUPPLY CALENDAR (home): upcoming pickups merged with harvest plan,
       │   qty per delivery, reminders
       ▼
[A3]  Delivery day: prepare to spec (moisture hints shown) → buyer agent arrives
       │   → farmer uploads weighbridge slip (PhotoUploader, P11) → checks grade together
       │   → REVEAL OTP (big card, 15-min) → agent enters
       ▼
[A4]  QA measures parameters → farmer sees LIVE sliding price: each parameter vs spec range,
       │   ₹ premium/deduction lines, final rate & amount → confirm → escrow RELEASED
       │   partial reject → see flag + photos → resolve → pro-rata lines (E18 transparency)
       ▼
[A5]  Payout view: gross − commission = netRelease │ expected date = delivery + 30 days
       │   (creditTermsDays) │ statement download │ rate the company ★
       ▼
[A6]  Season memory: contract fulfilled %, realized price trend vs mandi, next-season
       │   "renew" offers from the company
```

### 5.3 Negotiation zoom-ins

**Spot RFQ** (opportunistic top-up): demand posted → farmer bids → BidTable → counter rounds ≤3 (P2) → accept ⇒ purchase. Identical to §5.3 of `direct_buyer_plan v1` (offers engine).

**Contract counter** (P8): farmer counters `premiumPerQuintal` and/or schedule → buyer sees counter card on contract detail → accept/decline → e-sign on accept. Rounds not capped v1 (contract terms, not auction); log all counters in `events`.

### 5.4 State → UI action maps

**Contract:** `offered` — farmer: e-sign accept/counter/decline · buyer: edit/cancel; `active` — both: schedule view, per-slot create-PO (buyer), deliveries calendar; buyer: pause/cancel (with reason); `fulfilled` — renew/clone CTA + ratings prompt; `cancelled` — reason + read-only.

**Delivery slot (= purchase):** identical to the §5.4 purchase map in `plan/direct_buyer_plan.md` v1 (confirmed → advancePaid → pickupScheduled → inTransit → delivered → completed/qcDisputed → completed; cancelled), with additions: farmer sees contract context chip ("Shree Foods · Contract #con_9f2 · slot 3/8"), QA role gate on QC submit, finance role gate on escrow fund, spec-table + sliding-price panel in `delivered`/`qcDisputed`/`completed`.

---

## 6. Frontend architecture

### 6.1 API layer

- New `src/lib/api/contracts.ts`: types `DirectContract`, `ContractCreate`, `CropSpec`, `SpecParam`, `ContractDelivery`, `FormulaPrice`; wrappers `listContracts`, `createContract`, `getContract`, `updateContract`, `cancelContract`, `respondContract`, `listContractDeliveries`, `createDelivery`, `listSpecs`, `createSpec`; farmer side `listFarmerContracts`, `respondFarmerContract`, `listFarmerDeliveries`; org side `getOrg`, `inviteMember`, `removeMember`; evaluation helper `evaluateFormula(contract, mandiDocs)` client-side mirror for previews (server remains source of truth).
- Extend existing offers/purchases wrappers with P2 rounds, P4 pickup mode/slot, P11 `measurements`/`photos`/`qualityAdjustment`/`finalRate` fields.
- Extend `discovery.ts` (kept from v1).

### 6.2 Store — `src/stores/directBuyer.ts`

Slices: `contracts`, `specs`, `schedule`, `org`, `analytics`, `profileStats` + refreshes; per-page local state otherwise.

### 6.3 New components — `src/components/directbuyer/`

| Component | Purpose |
|---|---|
| `FormulaPriceCard` | formula chips + evaluated ₹ today + 12-week band (mandi history) |
| `SpecTable` | parameter rows (name/unit/range/adjustment); edit + live evaluation |
| `SpecMeasurementForm` | QC parameter entry w/ per-row in-range badge + running adjustment total |
| `SlidingPricePanel` | agreedRate → adjustments → finalRate → finalAmount lines (both parties) |
| `DeliveryScheduleCalendar` | month grid of slots across contracts; status chips; tour-list grouping (region-sorted, no map/GPS) |
| `ContractCard` / `ContractDecisionCard` | buyer summary card / farmer "grow for us" decision card |
| `TermSheetCard` | contract-derived booking term sheet on purchase detail (F8/S10) |
| `OrgRoleBadge` + role-gate helper | shows who can act; disabled buttons carry reason |
| `BuyerMetricCards` | spend / volume / active contracts / fulfilment % / escrow held |
| reuse | `MaskedPhoneText`, `D4TextGuard`, `BidTable` (from v1), broker chat-door |

### 6.4 New views — `src/views/directbuyer/` (+ farmer contract view)

```
src/views/directbuyer/
├── index.ts(x)            # DIRECT_BUYER_PAGES registry
├── BuyerHomeBoard.tsx     # cockpit, embedded in DashboardHome (SellerHomeBoard pattern)
├── ContractsPage.tsx
├── ContractFormPage.tsx   # ≤3-min builder wizard
├── ContractDetailPage.tsx # terms + formula live + spec + schedule + fulfilment + slot POs
├── SpecsPage.tsx
├── SchedulePage.tsx
├── TeamPage.tsx
└── DemandDetailPage.tsx   # + BidTable (from v1)
src/views/farmer-contracts/ (or extend views/farmer/)
├── FarmerContractsPage.tsx # offers inbox + active + calendar
└── FarmerContractDetailPage.tsx # respond + deliveries
```
Edits: `LotDetailPage` (+ offers-on-lot BidTable), `PurchaseDetailPage` (+ TermSheetCard, SpecMeasurementForm, SlidingPricePanel, role-gated buttons), `DashboardHome.tsx` (+ embedded BuyerHomeBoard), `DemandForm` (clone, unchanged fields).

### 6.5 Registration edits

`dashboard.ts` (TOOL_LIST + PROFILE_ROUTES for both personas), `ToolPage.tsx` (merge DIRECT_BUYER_PAGES + FARMER_CONTRACT pages), `App.tsx` (deep routes §4.2), `main.tsx` (`en.directbuyer`/`hi.directbuyer` + farmer contract keys), `BottomMenuBar` (buyer: contracts/schedule; farmer: myContracts badge).

### 6.6 i18n & styling

Full en/hi parity incl. industrial terms (अनुबंध, आपूर्ति शेड्यूल, गुणवत्ता मानक, नेट-30); `theme/directbuyer.css` lean, `--av-*` tokens, buyer accent indigo `#4F46E5`.

---

## 7. Implementation phases

**Phase 0 — Backend:** 0A fixes (P1, P2, P6) → 0B industrial layer (P8→P9→P10→P11→P12→P13→P4→P5), each with tests (extend `test_direct_buyer.py`; new `test_contracts_direct.py`, `test_purchase_settlement.py`, `test_buyer_org.py`).

**Phase 1 — Spot-layer delta (ships on 0A only):** `directBuyerHome` cockpit v1 + `DemandDetailPage`/`BidTable` + farmer offers-on-lot + mandi enablement. *(This is the whole of v1 of the previous plan.)*

**Phase 2 — Contracts core (P8, P10, P13):** SpecsPage read + ContractFormPage + ContractsPage + ContractDetailPage + farmer decision cards + e-sign accept + slot→purchase. Verify: create → farmer e-signs → slot PO → purchase runs to invoice.

**Phase 3 — Quality settlement (P9, P11):** Spec builder, spec snapshot on delivery, measurement form, sliding price panel, QC photos. Verify: parameter adjustments compute to the rupee both sides.

**Phase 4 — Schedule & fulfilment (P4 + schedule UI):** calendar, fulfilment %, tour list, pickup mode/slot on term sheet.

**Phase 5 — Team & finance (P12):** TeamPage invites/roles; role-gated actions across contract/escrow/QC; statement-of-account view (ageing from creditTermsDays + payments).

**Phase 6 — i18n & polish:** full en/hi, offline drafts, §10 checklist, §13 log update.

---

## 8. Error & edge-case handling (UI contract)

| Case | UI behavior |
|---|---|
| 403 `ORG_ROLE_REQUIRED` | Button disabled with role label tooltip; "Ask your admin" hint + TeamPage deep link |
| 400 `NEGOTIATION_CLOSED` (P2 cap) | "Last offer" banner; accept/reject/withdraw only |
| 409 `CONTRACT_NOT_OPEN` / slot already generated | Idempotent refresh: show current state, navigate to existing purchase |
| Formula inputs missing (mandi name, base rate) | Contract form inline validation; formula card shows "incomplete" |
| Mandi doc missing for mandiLinked slot date | Fall back to last known modal + "stale benchmark" chip; block PO creation if >7 days stale |
| QC measurements outside spec range | Row highlighted; adjustment preview updates live; confirm requires note when any parameter fails |
| OTP wrong/expired/attempts cap | Inline error + regenerate (farmer); buyer sees attempt counter |
| Payment exceeds due (409) | Due chip + capped input |
| Farmer declines contract | Buyer notified with reason; farmer removed from targeting; offer can be re-issued once |
| Offline | Draft autosave (contracts/specs/demands); escrow/QC/OTP actions disabled with notice |
| E16 force majeure | Buyer cancels contract with reason "force majeure" → penalty-free cancel copy; active slots offer penalty-free cancel |

---

## 9. Compliance mapping (spec guardrails → web reality)

| Spec rule | Implementation | Note |
|---|---|---|
| G1/G3 no contact sharing | `MaskedPhoneText` + `D4TextGuard` everywhere | — |
| G2 chat post-booking only | Contract negotiation via structured counter cards; chat room opens at purchase creation (`ensure_chat_room`) | Offer-room nuance audited in Phase 1 |
| G6 all money in-platform | Escrow per delivery; COD not offered; commission line visible | Corporate credit terms = post-release bank transfer, still ledgered |
| F8/S10 digital contract + OTP e-sign | **Existing MPIN e-sign on contracts** (`/contracts/{id}/accept`, `signatureData` + `consentTimestamp`) — reused as-is | Term sheet rendered client-side |
| F10/B6 QR handover | OTP-only v1 (no QR dependency) | E12 offline partially met via regenerate |
| B9 release on farmer OTP | Deviation stands: release at QC-complete (after OTP-gated handover) — later than spec wording, protects both sides from ungraded handover | One-line backend flip if product insists |
| E7 platform floor + round caps | P2 rounds cap; floor = client block vs mandi −X% | Server-side floor enforcement later |
| G5 no telematics | Tour list is region-sorted text, **no map/live GPS** | B4's "optimized stop order" = server-side sort by district/pin, v1 |

---

## 10. Verification checklist (end-to-end, real backend)

1. `pnpm build` green per phase; backend targeted suites green (`test_contracts_direct`, `test_purchase_settlement`, `test_buyer_org`, `test_direct_buyer`, `test_demands_offers`) + full suite no new failures.
2. Buyer creates contract (mandiLinked, weekly ×8) → farmer (quick-login farmer) sees decision card with **today's evaluated price** → MPIN e-sign (`1234`) → active.
3. Slot → PO: purchase created with contractId, price = modal + premium; idempotent replay returns same purchase.
4. Finance (second org member, invited by phone) funds escrow; procurement member cannot (403 → UI disabled); QA member submits measurements: BRIX 5.1 (+₹75/q), moisture 13% (−₹20/q) → finalAmount matches hand computation; both parties see the same parameter table.
5. Full delivery: OTP reveal → verify (1 wrong attempt) → QC photos upload → release → invoice shows commission + TDS note → traceability chain contract→slot→purchase→invoice complete.
6. Fulfilment: 8/8 slots → contract fulfilled → renew clones terms.
7. Farmer counter path: counter premium +₹50 → buyer accept → e-sign → active.
8. en⇄hi full toggle; no unmasked phone in DOM; no pre-booking chat entry; no external links; no SOS UI.
9. Quick-login directBuyer (P6) one-tap demo works.

---

## 11. Out of scope — spec features with no backend (do NOT build UI yet)

- **Route planner with optimization, delivery-agent sub-accounts, fleet telematics** (B4/B5/G5) — tour list only, no agent app, no GPS.
- **True wallet payouts to bank/UPI, TDS filing, GST e-invoice IRN** (F12/B9) — ledger + statement views only.
- **QR handover + offline-signed QR** (F10/B6, E12), **penalty/strike engine** (E1–E4), **surge module** (E8), **collusion detection** (E7 backend half), **demand auto-expiry**, **SMS notifications** (S7), **referral program** (S16), **buyer-side KYC document pipeline** (S2), **FPO entity model** (contracts target farmers individually v1; `fpoId` is a doc field for later), **chat images/read receipts/WebSocket**.
- **Rejected stays rejected** (❌): no VoIP/masked calls, contact cards, WhatsApp links, SOS, telematics, COD, commission-free side door.

---

## 12. Risks & open questions

| # | Risk | Mitigation |
|---|---|---|
| R1 | P8 changes the contracts router consumed by farmer/seller flows (seed contracts have no `farmerId`) | Accept remains open to all when `farmerId` absent (backward compat); new targeted contracts are additive |
| R2 | Sliding-price disputes (buyer's QA measurement contested) | Spec snapshot stored at PO creation; measurements + photos immutable on qcDisputed; resolve flow already exists |
| R3 | Formula price depends on mandi data freshness | Stale-benchmark chip + 7-day staleness block; mspLinked path is stable |
| R4 | Org invites require the teammate to already be registered | v1 constraint; unregistered phone → "ask them to install & register first" copy (no SMS yet) |
| R5 | Contracts query scans all docs (house pattern, ≤1000) | Accept v1; add `buyerId`/`farmerId` filters when profiling demands |
| R6 | Role aliasing (`directBuyer`↔`seller`) may blur personas in shared pages | Persona-aware copy/icons; org features render only for directBuyer activeProfile |
| R7 | creditTermsDays exists but nothing enforces payment scheduling | Statement view shows expected date; actual credit enforcement waits for the payments engine |

---

## 13. Implementation log

| Date | Delivered | Notes |
|---|---|---|
| 2026-10-01 | `plan/direct_buyer_plan.md` v1 — ground-truth audit of offers/demands/purchases/purchase_settlement/direct_buyer + website trade-module coverage | Superseded: scope collapsed into the seller/vyapari spot flow. |
| 2026-10-01 | **Phase 0A + contracts core + cross-persona intelligence layer (first "SaaS" increment).** Backend: new `/intelligence` router (persona-scoped KPIs/trends/breakdowns/opportunity-insights from real collections for broker/seller/directBuyer/farmer/transport), new `/price-alerts` router (crop × target price rules, lazy fire + phone-free notification), targeted contracts engine (POST/PUT/cancel/decline `/contracts`, `/contracts/mine?role=` with live `currentPrice`, MPIN e-sign accept extended `offered→active`, idempotent slot→purchase generation `/contracts/{id}/deliveries` with fulfilment), `directBuyer` added to mandi/marketplace/orders roles + quick-login persona `dev-user-8`. 37 new tests green; `test_contracts.py` unmodified-passing. Website: `lib/api/intelligence.ts`, reusable `InsightsPanel` (KPI cards, CSS bar charts, insight cards, price-alert manager) embedded into broker/seller/farmer/transport/directBuyer homes, `BuyerHomeBoard` + contracts UI (list/form/detail + slot POs) for directBuyer, `FarmerContractsPage` + MPIN e-sign decision cards for farmer, `en.intel`/`hi.intel` locales (30/30 server labelKeys covered), tool registration (`directBuyerHome`, `contracts`, `myContracts`, `mandi` for buyers). `pnpm build` green. | Not built yet from this plan: P2 3-round counters, P3 QC photos/sliding specs, P4 pickup mode/slot, P5 settlement tests, P12 team RBAC, `demandDetail`/BidTable page — these remain the next increments. |
| 2026-10-01 | **v2 plan authored** — persona repositioned: direct buyer = industrial/institutional procurer (processor/sugar/hotel/chain). Added: persona differentiation matrix (§0), contracts engine on top of the existing MPIN e-sign seed (`contracts.py`), crop quality-spec templates with sliding settlement (P9/P11), delivery schedules generating purchases (P10), team sub-accounts/RBAC (P12), farmer "grow-for-us" surface (P13), multi-address/corporate terms/traceability features; revised userflows (contract-first), IA, phases, verification. Spot-trade reuse retained deliberately as the per-delivery engine only. | — |
