# Dairy & Livestock Management — Website Implementation Plan

*Scope: implement the dairy-center management module (farmer + `dairyManager` personas) on the
existing React website, grounded 1:1 in the shipped FastAPI backend. Follows the conventions of
`plan/broker_plan.md`.*

Reference documents:
- Feature blueprint: `features/farm_dairy&livestock manage.md` (marketplace vision + guardrails G1–G6)
- Backend routers: `backend/app/routers/livestock_dairy.py`, `backend/app/routers/livestock.py`
- Backend models: `backend/app/models/livestock_mgmt.py`, `backend/app/models/livestock.py:143-178`

---

## 1. Ground truth — what the backend implements today

### 1.1 Dairy management router (`livestock_dairy.py`, tag `livestock`, no router prefix → all paths under `/v1`)

All resources are **center-scoped**: `centerId` = caller uid. Role guard `_manager` = `dairyManager`
only; `_livestock_user` = `farmer | seller | dairyManager`.

| Endpoint | What it does | Roles |
|---|---|---|
| `GET /livestock/dairy/members?status=&page=&pageSize=` | List center's member farmers (paged envelope). | dairyManager |
| `POST /livestock/dairy/members` | Add member `{ name, phone?, village?, farmerUid?, memberCode?, bankDetails?, defaultSpecies?, deduction?, status? }` → 201 `mem_…` (auto memberCode `M-XXXXXX`). | dairyManager |
| `PUT /livestock/dairy/members/{id}` | Update member (404 `MEMBER_NOT_FOUND` if not own center). | dairyManager |
| `DELETE /livestock/dairy/members/{id}` | Soft delete → `status: "inactive"`. | dairyManager |
| `GET /livestock/dairy/members/{id}/statement?date_from=&date_to=` | Member ledger: collections + payment entries + totals `{ liters, amount, paid }`. | dairyManager |
| `GET /livestock/dairy/rate-chart?species=cow` | Single active FAT/SNF chart; own center wins, else any center's (see gap B3). | farmer, seller, dairyManager |
| `GET /livestock/dairy/rate-chart/versions?species=` | Chart version history. | dairyManager |
| `POST /livestock/dairy/rate-chart` | Create chart `{ species, effectiveFrom, baseRate, fatBase, snfBase, fatStep?, snfStep?, minRate?, minFat?, minSnf?, active? }`; activating deactivates same-species charts. | dairyManager |
| `PUT /livestock/dairy/rate-chart/{id}` | Update chart, same single-active rule. | dairyManager |
| `GET /livestock/dairy/payments/batches` | Payment batches, newest first. | dairyManager |
| `POST /livestock/dairy/payments/batches` | Generate from `{ periodFrom, periodTo }` — sums member collections, applies flat per-member `deduction`, writes `payment_entries`; returns batch + entries. | dairyManager |
| `POST /livestock/dairy/payments/batches/{id}/mark-paid` | `{ payoutRef? }` → entries `paid`, FCM to each member's `farmerUid` (409 `ALREADY_PAID`). | dairyManager |
| `GET /livestock/dairy/farmer/payments` | Farmer self-view: own payment entries via `dairy_members.farmerUid`. | farmer, seller, dairyManager |
| `GET /livestock/dairy/farmer/slips?date_from=&date_to=` | Farmer self-view: own collection slips + `memberCode`. | farmer, seller, dairyManager |
| `GET/POST/PUT /livestock/dairy/sales/customers[/{id}]` | Milk-sale customer book `{ name, phone?, type: household/shop/hotel, address?, route?, dailyLitersAM?, dailyLitersPM?, ratePerLiter }`. | dairyManager |
| `GET /livestock/dairy/sales/orders?status=` | Sale orders, newest `orderDate` first. | dairyManager |
| `POST /livestock/dairy/sales/orders` | Create `{ customerId, orderDate, shift: am/pm, liters?, items[]?, amount? }` — amount = items total > explicit amount > liters × customer rate; status `scheduled`. | dairyManager |
| `POST /livestock/dairy/sales/orders/{id}/status` | Advance `{ delivered/billed/paid }`, machine `scheduled→delivered→billed→paid` (409 `INVALID_TRANSITION`). | dairyManager |
| `GET /livestock/dairy/sales/summary?date_from=&date_to=` | Totals: orders, liters, amount, collected, byStatus. | dairyManager |
| `GET/POST /livestock/dairy/stock/items` + `POST /{id}/adjust` | Stock (milk/curd/ghee/paneer/other) + `{ delta, reason }` adjustment. | dairyManager |
| `GET /livestock/dairy/reports/daily?date=` | Procurement vs sales totals + closing stock. | dairyManager |
| `GET /livestock/dairy/reports/pl?month=` | `{ procurementCost, salesIncome, grossProfit, collectionsCount, ordersCount }`. | dairyManager |

### 1.2 Procurement endpoints (`livestock.py`, role guard `_any_livestock_user` = farmer|seller|dairyManager)

| Endpoint | What it does |
|---|---|
| `POST /livestock/procurement/collections` (201) | Record a collection. Body `MilkCollectionIn`: `{ farmerId?, farmerName, farmerCode, farmerPhone?, date, shift: morning/evening, milkType: cow/buffalo, liters (0–2000], fatPercent (2–14), snfPercent (6–14), clr?, memberId?, quality? }`. Server computes `ratePerLiter` + `totalAmount` via `_calculate_milk_rate` (hardcoded formula, **ignores rate_charts** — gap B2), generates `slipNumber = SLIP-<yyyymmdd>-<M\|E>-<farmerCode>`, `dairyId = uid`, `status: "recorded"`. |
| `GET /livestock/procurement/collections?date=&shift=&farmerCode=` | List — **global scan, NOT scoped to `dairyId`** (gap B1). |
| `GET /livestock/procurement/summary?date=` | Day totals `{ totalMorningLiters, totalEveningLiters, totalLiters, avgFat, avgSnf, totalPayoutAmount, collectionsCount }` — also **not scoped to `dairyId`** (gap B1). |
| `POST /livestock/procurement/rate-calc` | Public rate preview `{ milkType, fatPercent, snfPercent, liters }` → `{ ratePerLiter, totalAmount, baseRate, fatPremium, snfPremium, formula }`. Use for live preview in the entry form. |

### 1.3 Enums that differ between routers (do not conflate)

- Collection `shift`: `"morning" | "evening"` (`livestock.py`) — slip suffix `M|E`.
- Sale order `shift`: `"am" | "pm"` (`livestock_dairy.py`).
- `milkType` / rate-chart `species`: `"cow" | "buffalo"`.
- Collection status is always `"recorded"`; sale order status: `scheduled→delivered→billed→paid`;
  batch status: `draft→paid`; member/customer status: `active|inactive`.

### 1.4 Collections touched

`dairy_members`, `rate_charts`, `milk_collections`, `payment_batches`, `payment_entries`,
`milk_sale_customers`, `milk_sale_orders`, `dairy_stock_items` — all top-level, Firestore via `get_doc/query/set_doc`.

### 1.5 Known backend gaps (confirmed by reading code)

| # | Gap | Evidence |
|---|---|---|
| B1 | Collection list + day summary leak across centers (no `dairyId` filter). | `livestock.py:386-403`, `livestock.py:406-429` — `query("milk_collections", [])` with only date/shift/farmerCode filters. A manager would see other centers' farmer names, liters, amounts. **Blocks ledger UI; must fix before Phase 3.** |
| B2 | Collection rate ignores the center's `rate_charts` doc; hardcoded formula in `_calculate_milk_rate`. Manager-maintained charts are write-only today. | `livestock.py:302-322` vs `livestock_dairy.py:219-241`. |
| B3 | `GET /livestock/dairy/rate-chart` falls back to *any* center's active chart when the caller has none — a farmer's "today's rate" can show a stranger's chart. | `livestock_dairy.py:194-202`. |
| B4 | Batch generation and farmer slips scan up to 2000 global docs; batch endpoint re-queries all collections. Fine at current scale; needs scoping/pagination later. | `livestock_dairy.py:288`, `livestock_dairy.py:398`. |

---

## 2. Design principles

1. **One module, two faces.** The same `livestockDairy` tool id renders a *manager console* for
   `dairyManager` and a *"My Dairy" self-service page* for `farmer`/`seller`. Role decides the face;
   never show manager chrome to a farmer.
2. **Farmer-first simplicity.** The farmer face is two tabs (My Slips / My Payments) + today's rate
   card. Large numerals, Hindi-first labels, no forms. Everything read-only.
3. **Manager flow mirrors the physical day:** Set rates → Add members → Record AM/PM collections →
   Generate payment batch → Mark paid. Navigation order follows that loop.
4. **Single-screen entry.** Collection entry = pick member → liters/FAT/SNF → live rate preview →
   save → next member. Designed for queue speed at a collection center.
5. **Vernacular + i18n from day one** — every string via `lib/i18n` keys (en + hi at minimum),
   matching the blueprint's S12 (multi-language) requirement.
6. **Guardrail compliance** (see §9): phones collected in member/customer books stay server-side
   records; no chat, no contact-sharing surfaces.

---

## 3. Backend prerequisites (minimal, exact)

| # | Change | File / location | Exact edit |
|---|---|---|---|
| B1 | Scope collection list + summary to the caller's center when active profile is `dairyManager`. | `backend/app/routers/livestock.py` — `list_milk_collections` (~:386) and `get_procurement_summary` (~:406) | After fetching docs, add: `user = await get_user(uid)`; if `user.get("activeProfile") == "dairyManager"`: `docs = [d for d in docs if d.get("dairyId") == uid]`. Farmers (activeProfile farmer/seller) keep the current `farmerCode`-based filtering behavior. |
| B2 | Use the center's active rate chart in `record_milk_collection` when one exists. | `backend/app/routers/livestock.py` — `record_milk_collection` (~:347) | Before computing: if caller is dairyManager, query `rate_charts` `[("centerId","==",uid),("species","==",body.milkType),("active","==",True)]`; if found, compute `rate = clamp(baseRate + (fat-fatBase)*fatStep + (snf-snfBase)*snfStep, minRate or 0)` honoring `minFat/minSnf` gates; else fall back to `_calculate_milk_rate`. Store `rateChartId` on the doc. |
| B3 | Farmer rate view resolves via membership. | `backend/app/routers/livestock_dairy.py` — `get_active_rate_chart` (~:194) | For farmer/seller callers: look up `dairy_members` by `farmerUid == uid`; if found, prefer that center's chart; only then fall back. (v1 may ship without this if schedule is tight — acceptable degradation, note in release notes.) |
| B4 | Docs hygiene: append the 4 `procurement` endpoints to `endpoints.md` §16 (they are currently undocumented). | `endpoints.md` | — |

No new routers, collections, or models. Everything else the UI needs already exists.

---

## 4. Personas & information architecture

### 4.1 Tool ids already registered (nothing to add to `lib/dashboard.ts`)

`website/src/lib/dashboard.ts` already ships: `livestockDairy` 🐄, `dairyConsole` 🥛 (TOOL_LIST ~:68-70),
`PROFILE_ROUTES` allowlists for `dairyManager` (dairyConsole, livestockDairy, …) and `farmer`/`seller`
(livestockDairy), `PERSONA_HOME_CONFIG` for `dairyManager` (~:321-330), and i18n keys
(`tool_livestockDairy`, `tool_dairyConsole`, `persona_dairyManager`). Today `ToolPage` renders them as
placeholder skeletons. The plan only adds views + registry entries.

### 4.2 Route map (all under the logged-in shell; manager routes gated by `ensureProfile('dairyManager')`)

| Route | Page | Persona |
|---|---|---|
| `/dashboard/p/livestockDairy` | `DairyHubPage` — role-aware redirect: farmer → `/dairy/me`; dairyManager → `/dairy/console` | both |
| `/dashboard/p/dairyConsole` | redirects to `/dairy/console` | dairyManager |
| `/dairy/me` | `MyDairyPage` (slips + payments + rate) | farmer, seller |
| `/dairy/console` | `DairyConsoleHome` (today's numbers + quick actions) | dairyManager |
| `/dairy/console/collections` | `CollectionsPage` (day ledger, AM/PM filter) | dairyManager |
| `/dairy/console/collections/new` | `CollectionEntryPage` (member picker → entry form) | dairyManager |
| `/dairy/console/members` · `/new` · `/:memberId` · `/:memberId/statement` | Members CRUD + statement | dairyManager |
| `/dairy/console/rate-chart` | Rate chart list/versions + editor | dairyManager |
| `/dairy/console/payments` · `/payments/:batchId` | Batches list + batch detail (entries, mark-paid) | dairyManager |
| `/dairy/console/sales/customers` · `/sales/orders` · `/sales/orders/:orderId` | Customer book + orders + status advance | dairyManager |
| `/dairy/console/stock` | Stock items + adjust | dairyManager |
| `/dairy/console/reports` | Daily report + monthly P&L | dairyManager |

---

## 5. Userflow

### 5.0 Preconditions

1. User is logged in (`session` store) and onboarded; `activeProfile` = `dairyManager` (console) or
   `farmer`/`seller` (My Dairy). Profile auto-linked/activated via `ensureProfile` →
   `POST /users/me/profiles` + `POST .../activate` (existing dashboard store pattern).
2. Backend prerequisites B1–B3 deployed.

### 5.1 Manager master flow — "run my collection center"

```
Register/choose Dairy & Gaushala persona
        │
        ▼
DairyConsoleHome (today: liters, payout due, AM/PM collection count, sales, stock)
        │
        ├──► Rate Chart: create cow + buffalo chart, set ACTIVE ─────────┐
        │                                                                │
        ├──► Members: add member farmer (name, village, phone, bank,     │
        │      deduction) ── memberCode auto (M-XXXXXX)                  │
        │                                                                │
        ├──► Collections (AM queue):                                     │
        │      pick member ──► enter liters, FAT%, SNF% ──► live rate    │
        │      preview (rate-calc) ──► SAVE ──► slip no. shown ──►       │
        │      [Next member]  …repeat for PM shift                       │
        │      (rate applied = active chart, fallback platform formula)  │
        │                                                                │
        ├──► (optional) Sales: register customers, schedule AM/PM        │
        │      delivery orders, advance scheduled→delivered→billed→paid  │
        │                                                                │
        ├──► Payments: pick period (e.g. 1st–15th) ──► GENERATE BATCH   │
        │      ──► review per-member rows (liters, amount, deduction,    │
        │      net) ──► MARK PAID (payoutRef) ──► FCM to each member     │
        │                                                                │
        ├──► Stock: add/adjust items (curd, ghee…)                       │
        │                                                                │
        └──► Reports: daily (procure vs sell vs stock), monthly P&L
```

### 5.2 Farmer master flow — "did I get paid fairly" (read-only, 2 tabs)

```
Farmer home ──► [My Dairy / मेरा दूध] tile (livestockDairy)
        │
        ▼
MyDairyPage
  ├─ Tab 1 "My Slips": date list of collections ──► slip card:
  │     date · shift · cow/buffalo · liters · FAT/SNF · rate/L · amount · slip no.
  │     (filter by month)
  ├─ Tab 2 "My Payments": batch entries ──► card: period, liters, gross,
  │     deduction, NET, status chip (pending/paid) + payoutRef when paid
  └─ Card "Today's Rate": active chart for my species (base rate + FAT/SNF
        slabs) — transparency against the rate on my slips
```

The farmer never sees member management, other farmers, sales, or stock. If the farmer has no
`dairy_members` record yet, My Dairy shows: "No dairy center has added you yet" + explainer
(the manager adds the member; farmer's slips appear automatically once linked via `farmerUid`/memberCode).

### 5.3 Zoom-in A — collection entry (the highest-frequency screen)

```
CollectionsPage (today) ──► [+ New Collection]
CollectionEntryPage
  1. Member picker: search list of active members (name + memberCode + village)
        ──► selection prefills farmerName, farmerCode, farmerUid, memberId, defaultSpecies
  2. Shift toggle: Morning | Evening        (default from time of day)
  3. Species toggle: Cow | Buffalo          (default from member.defaultSpecies)
  4. Inputs: Liters • FAT % • SNF %         (validated 0–2000 / 2–14 / 6–14)
  5. Live preview card: rate/L, amount, formula line   ← POST /procurement/rate-calc
  6. [Save Slip] ──► POST /procurement/collections
        success ──► full-screen slip card (slipNumber, all values) + [Next Member] / [Done]
        error   ──► fieldErrors mapped onto inputs (toast on non-field errors)
```

### 5.4 Zoom-in B — payment batch

```
PaymentsPage ──► [Generate Batch]
  period pickers (date_from / date_to) ──► POST /payments/batches
  ──► BatchDetailPage (status=draft): header totals (liters, gross, deductions, net)
      + entry rows per member ──► [Mark Paid] (pays all; optional payoutRef input)
      ──► status=paid, rows show payoutRef; farmer FCM fires (server-side)
```

### 5.5 State → UI action map

| Entity | State | UI affordance |
|---|---|---|
| Sale order | `scheduled` | [Mark Delivered] |
| Sale order | `delivered` | [Mark Billed] |
| Sale order | `billed` | [Mark Paid] |
| Sale order | `paid` | read-only, date shown |
| Payment batch | `draft` | [Mark Paid] enabled; entries editable only by regenerating |
| Payment batch | `paid` | read-only; payoutRef shown; [Mark Paid] hidden (409 guard) |
| Member / customer | `active` | shown in pickers; [Deactivate] |
| Member / customer | `inactive` | hidden from pickers; [Reactivate] via edit |
| Rate chart | `active` | exactly one per species; activating another auto-deactivates |
| My payment entry | `pending` / `paid` | amber / green chip |

---

## 6. Frontend architecture

### 6.1 New API module — `website/src/lib/api/dairy.ts`

Header comment: `// Verified against backend/app/routers/livestock_dairy.py + livestock.py (procurement)`.
Follow the `demands.ts` pattern (typed interfaces + thin `api.get/post/put/delete` wrappers; `Paged<T>`
envelope type already exists). Export groups:

- `DairyMember`, `DairyMemberInput` — `listMembers`, `createMember`, `updateMember`, `deactivateMember`, `getMemberStatement(memberId, dateFrom?, dateTo?)`
- `RateChart`, `RateChartInput` — `getActiveRateChart(species)`, `listRateChartVersions(species?)`, `createRateChart`, `updateRateChart`
- `MilkCollection` (re-export shape from `livestock.py` model), `MilkCollectionInput` — `recordCollection`, `listCollections(params)`, `getProcurementSummary(date?)`, `calcRate(payload)`
- `PaymentBatch`, `PaymentEntry` — `listBatches`, `generateBatch(periodFrom, periodTo)`, `markBatchPaid(batchId, payoutRef?)`
- Farmer self-views — `getFarmerPayments()`, `getFarmerSlips(dateFrom?, dateTo?)`
- `MilkSaleCustomer(Input)` — `listCustomers`, `createCustomer`, `updateCustomer`
- `MilkSaleOrder(Input)` — `listOrders(status?)`, `createOrder`, `advanceOrderStatus(orderId, status)`, `getSalesSummary(...)`
- `StockItem(Input)` — `listStock`, `createStockItem`, `adjustStock(itemId, delta, reason)`
- `DailyReport`, `PlReport` — `getDailyReport(date?)`, `getPlReport(month?)`

Note exact query params are **snake_case** (`date_from`, `date_to`, `period_from` is body —
`periodFrom`/`periodTo` in body are camelCase per `PaymentBatchGenerateIn`). Keep the header comment
listing this quirk so nobody "fixes" it into a 400.

### 6.2 New zustand store — `website/src/stores/dairy.ts`

Persisted (`agvc-dairy`), backend-authoritative (mirrors `stores/trade.ts` philosophy):
- `collectionDraft: { memberId, shift, milkType, liters, fatPercent, snfPercent }` — survives a
  refresh mid-queue (rural connectivity), cleared on successful save.
- `batchPeriod: { from, to }`, `slipsFilter: { month }`, `ordersFilter: { status }`.
No entity caching — pages load via API like `DemandsPage` does.

### 6.3 Components — `website/src/views/dairy/components/`

- `DairyStatCard.tsx` (label, value, unit, sub) — reused on console home + reports.
- `MemberPicker.tsx` — searchable list bottom-sheet (wraps `ModalSheet`), shows name + code + village.
- `CollectionForm.tsx` — shift/species `SegmentedControl`, `LabeledTextField` inputs, live preview card.
- `SlipCard.tsx` — shared by manager ledger + farmer slips (same shape both sides).
- `BatchEntriesTable.tsx` — rows: member, liters, amount, deduction, net.
- `StatusChip.tsx` — colored chip per §5.5 map.
- `SpeciesToggle.tsx` / `ShiftToggle.tsx` — thin `SegmentedControl` wrappers.
- `RateChartForm.tsx` — fields per `RateChartIn` with min-rate/min-fat/min-snf advanced block.
- `EmptyState.tsx` — role-specific illustrations (e.g., "No slips yet").

### 6.4 Views — `website/src/views/dairy/`

```
views/dairy/
  index.ts                 → DAIRY_PAGES: Record<string, ComponentType> (livestockDairy + dairyConsole)
  MyDairyPage.tsx          → farmer face (tabs: slips / payments + rate card)
  DairyConsoleHome.tsx     → manager home (today's report + quick actions)
  collections/CollectionsPage.tsx, CollectionEntryPage.tsx
  members/MembersPage.tsx, MemberFormPage.tsx, MemberStatementPage.tsx
  ratechart/RateChartPage.tsx
  payments/PaymentsPage.tsx, BatchDetailPage.tsx
  sales/CustomersPage.tsx, CustomerFormPage.tsx, OrdersPage.tsx, OrderDetailPage.tsx
  stock/StockPage.tsx
  reports/ReportsPage.tsx
```

All manager pages: `const ensured = useEnsureProfile('dairyManager')` (returns null/gate while
linking), wrap content in `<ToolShell toolId="dairyConsole">` (or `livestockDairy` for MyDairy).
Data pattern per `DemandsPage.tsx`: local `useState` + `useEffect` `load()`, mutations → `toast()` → reload.

### 6.5 Registration edits (exact)

| File | Edit |
|---|---|
| `website/src/views/dairy/index.ts` | create with `livestockDairy` + `dairyConsole` entries |
| `website/src/views/dashboard/ToolPage.tsx` | import `DAIRY_PAGES`; add `...DAIRY_PAGES` into the combined PAGES map (alongside TRADE_PAGES etc.) |
| `website/src/App.tsx` | lazy-import dairy views; add `<Route path="dairy/me" …/>`; manager block: `dairy/console`, `dairy/console/collections/new`, `dairy/console/members/new`, `dairy/console/members/:memberId`, `dairy/console/members/:memberId/statement`, `dairy/console/payments/:batchId`, `dairy/console/sales/orders/:orderId`; parent routes `dairy/console/{collections,members,rate-chart,payments,sales/customers,sales/orders,stock,reports}` — all inside the existing `loggedIn` gated branch |
| `website/src/lib/i18n/*.ts` | add keys: `dairy_*` section (~60 keys: tabs, form labels, toasts, statuses, slip fields, batch labels, reports). en + hi minimum. |
| `website/src/theme/dairy.css` | module styles importing `tokens.css` variables; wire via import in `views/dairy/index.ts` (same as trade.css pattern) |

No changes needed: `personas.ts`, `lib/dashboard.ts` (allowlists/home config already present),
`lib/api/client.ts` (auth + `Idempotency-Key` on writes already automatic).

### 6.6 Styling

Follow `theme/trade.css` conventions: CSS classes on `dash-*`/`trade-*` analogues (`dairy-*`),
tokens from `tokens.css` (`--av-primary #43a047`, `--av-radius-*`, `--av-shell-width: 480px` mobile
shell). Amounts in `₹`, liters to 2 decimals, big touch targets for the entry form.

---

## 7. Implementation phases

| Phase | Deliverable | Depends |
|---|---|---|
| **P1 Foundation** | `lib/api/dairy.ts` + types, `stores/dairy.ts`, `theme/dairy.css` skeleton, `views/dairy/index.ts` registry, ToolPage + App.tsx wiring, i18n keys, placeholder pages for all routes | — |
| **P2 My Dairy (farmer face)** | `MyDairyPage` (slips, payments, rate card) — smallest visible win, unblocks farmer-side testing with zero manager UI | B3 optional |
| **P3 Console core** | Console home (daily report), members CRUD + statement, rate-chart CRUD | — |
| **P4 Collections** | `CollectionsPage` + `CollectionEntryPage` (member picker, rate preview, slip success) | **B1, B2** |
| **P5 Payments** | Batches list/detail, generate + mark-paid; farmer payment tab already live from P2 | — |
| **P6 Sales + Stock + Reports** | Customers/orders with status advance, stock adjust, daily + P&L reports | — |
| **P7 Verification** | Full §10 checklist against a running backend; `pnpm build` green | all |

Each phase = one reviewable commit (per repo git conventions).

---

## 8. Error & edge-case handling (UI side)

| Case | Handling |
|---|---|
| 401 | handled globally by `client.ts` refresh → `/auth` redirect (no work) |
| `MEMBER_NOT_FOUND` / `STOCK_NOT_FOUND` etc. (404) | toast + navigate back to list |
| `INVALID_TRANSITION` (409) on order status | refetch order; show current state chip; disable stale button |
| `ALREADY_PAID` (409) on batch | refetch; show paid state |
| `RATE_CHART_NOT_FOUND` (404) on farmer rate card | render "Ask your center to publish today's rate" empty state — not an error |
| Validation 422 `fieldErrors` | map onto inputs (liters range, FAT/SNF bounds, rate > 0) |
| Farmer with no member record | My Dairy empty state (§5.2) |
| Duplicate slip (same member re-saved) | allowed by backend (separate docs); UI warns "A slip for this member/shift exists today — save anyway?" (client-side check via listCollections) |
| Member deactivated mid-queue | picker excludes inactive; draft cleared with toast |
| Offline / flaky network | collection draft persists in store; retry on save; no offline slip signing in v1 (web) |
| Empty batch period (no collections) | generate returns batch with 0 entries — UI shows "no collections in this period" and hides Mark Paid |

---

## 9. Compliance mapping (guardrails G1–G6 from the blueprint)

| Guardrail | How this module complies |
|---|---|
| G1 in-app only | No contact surfaces at all in v1: no chat, no call, no share buttons. Member/customer `phone` is a ledger field stored server-side, never rendered to any counterparty. |
| G2 chat post-booking | N/A — no chat shipped. |
| G3 no VoIP/number sharing | No call UI. Phone inputs are manager-private records. |
| G4 no SOS/help | None; disputes stay on the admin side (out of scope here). |
| G5 no IoT | Route/summary screens are software-only aggregates. |
| G6 in-platform money | No cash UI, no CoD. Payments module tracks `pending/paid` + payoutRef only; escrow integration is out of scope (see §11). |

The blueprint's marketplace temptations (RFQ/bidding/escrow/chat) are explicitly **not** built here —
that is §11, and the compliance audit table in the blueprint stays green.

---

## 10. Verification checklist (end-to-end, real backend)

Backend: `cd backend && .venv/bin/uvicorn app.main:app --reload` (or repo `run.sh`).
Website: `cd website && pnpm dev`. Run through:

- [ ] Activate `dairyManager` profile from an existing account → lands on `dairyManagerHome`; `dairyConsole` + `livestockDairy` tiles open real pages (not placeholders)
- [ ] Create cow + buffalo rate charts; activating one deactivates the prior (versions list shows history)
- [ ] Add 3 member farmers (one with `farmerUid` linked to a second test account)
- [ ] Record AM + PM collections for each member with varying FAT/SNF → rate/amount match the **active chart** (B2) and differ from the hardcoded formula case (fallback center)
- [ ] Ledger shows **only this center's** slips (B1) — cross-check with a third account's dairy
- [ ] Generate batch for the period → per-member liters/amount/deduction/net match the ledger; member with no collections is absent
- [ ] Mark paid with payoutRef → entries `paid`; linked farmer receives FCM; `ALREADY_PAID` on retry
- [ ] On the **farmer** account: My Dairy shows slips (correct memberCode), payments tab shows the batch with net amount, rate card shows center chart (B3)
- [ ] Sales: create customer → order → advance scheduled→delivered→billed→paid; illegal skip returns 409 and UI recovers
- [ ] Stock: create item, adjust ±, lastAdjustment recorded
- [ ] Reports: daily totals reconcile with ledger; P&L = sales income − procurement cost
- [ ] `pnpm build` (tsc --noEmit + vite build) passes clean
- [ ] Backend regression: `cd backend && .venv/bin/pytest -q` green

---

## 11. Out of scope (v1)

- **Marketplace vision** from the blueprint: produce/livestock listings, RFQ, bids, negotiation,
  booking lifecycle, escrow wallet, in-app chat, disputes, QR pickup, ratings — no backend exists;
  would be a separate plan. This module deliberately avoids building any of it.
- **Gaushala console** (`livestock_gaushala.py` — profile/cattle/adoptions/donations/expenses) and
  **vet network** (`livestock_vets.py` — directory, appointments, prescriptions, campaigns): backend
  is ready, UI can follow this exact plan pattern later (`gaushalaConsole`/`vetNetwork` tool ids
  already registered in `lib/dashboard.ts`).
- PWA/offline-first behavior beyond draft persistence (mobile app covers rural offline; website is manager-desk + farmer-browser).
- CSV/Excel export, GST invoices, TDS statements.
- Admin console for dairy (per `endpoints.md` note, `/admin/livestock` deferred — SOP-19).

---

## 12. Risks & open questions

1. **B2 formula fidelity** — the exact slab math (`fatStep`/`snfStep` vs the blueprint's per-unit
   premium) must be confirmed with the backend owner before P4; the plan's formula is the minimal
   consistent reading of `RateChartIn`. If charts carry richer slab tables later, recalc moves server-side only.
2. **Rate-calc preview drift** — `POST /procurement/rate-calc` (public, hardcoded formula) may disagree
   with B2 chart-based rate on save. Mitigation: after B2, make `rate-calc` accept optional `centerId`
   to compute with the active chart, or have save return the slip and let the UI show final values on
   the success card (chosen: success-card truth; preview labeled "approx").
3. **Seed data** — dev seed (`backend/app/data/livestock_seed.py`) writes collections; demo script
   should seed members + charts for two centers to verify B1 isolation.
4. **i18n volume** — ~60 new keys × languages in `lib/i18n`; hi must be human-reviewed (dairy terms:
   FAT→फैट, SNF→एसएनएफ/स्नफ, shift→सुबह/शाम).
5. **Scale** — B4 global scans are acceptable now; if a center passes ~100 slips/day, prioritize the
   scoping follow-up.

---

## 13. Implementation log

| Date | Change |
|---|---|
| 2026-10-02 | Plan authored (backend + website ground truth verified against code; userflows for farmer & dairyManager faces; backend gaps B1–B4 identified). |
| 2026-10-02 | **Executed — phases 1–7 landed.** Backend: B1 center/self scoping in `list_milk_collections` + `get_procurement_summary` (`livestock.py` `_scoped_collections`); B2 chart-based rate in `record_milk_collection` via `_active_center_chart` + `_chart_based_rate` (chart: `baseRate + (fat−fatBase)·fatStep + (snf−snfBase)·snfStep`, floored at `minRate`, below `minFat`/`minSnf` → `minRate`; `rateChartId` added to `MilkCollection` model); B3 membership-preference rate read in `get_active_rate_chart`; B4 procurement endpoints documented in `endpoints.md` §16. New e2e tests `backend/tests/test_dairy_web_flows.py` (6 tests) — 44/44 dairy+livestock tests green. Website: `lib/api/dairy.ts`, `stores/dairy.ts`, `theme/dairy.css` + `dairy-ops.css` + `dairy-sales.css`, locale files `en/hi.dairy[-ops|-sales].ts`, 20 views under `views/dairy/` (hub, My Dairy, console home, members, rate charts, collections, payments, sales, stock, reports), `DAIRY_PAGES` registered in ToolPage, 18 routes in App.tsx. `pnpm build` green; en/hi key parity verified. |
| 2026-10-02 | **Expansion §14 landed — full dairy + gaushala suite.** Backend: B5 `GET /livestock/dairy/analytics` (daily series, species/shift splits, top-10 members, dues, MoM), B6 `GET /livestock/dairy/farmer/analytics` (6-month series + lifetime totals), B7 `GET /livestock/gaushala/analytics` (6-month expenses/donations/adoptions/intakes, category + status splits), B8 `GET /livestock/gaushala/receipts` (80G list), B9 gaushala cattle intake via `AnimalIn.gaushalaId` (ownership-checked; `Animal` gained `gaushalaId`/`cattleStatus`/`events`), B10 animal list scoped to owner / own-gaushala. New tests `backend/tests/test_dairy_gaushala_analytics.py` (6 tests) — full suite 688 passed, zero regressions. Website: 3 new modules registered (`GAUSHALA_PAGES`/`VET_PAGES`/`ANIMAL_PAGES` in ToolPage + 20 new App.tsx routes) — gaushala console (setup gate, dashboard w/ occupancy, cattle intake + events timeline, adoptions & donations queues with 80G receipt sheets, expenses, byproducts, receipts, 6-month analytics), vet network (managed vets CRUD, appointments lifecycle with inline prescription editor, campaigns with enrollment + mark-vaccinated, prescriptions), herd registry (animals, yield logs + SVG chart, breeding lifecycle with due-date countdowns, vaccinations, vet records), dairy analytics cockpit (month nav, MoM delta KPIs, 5 SVG charts, leaderboard) + farmer "My 6 months" trend + CSV exports (statement, reports). `pnpm build` green; en/hi parity across 7 locale file pairs; `tool_livestock` label gap fixed. Known follow-ups: byproducts list is global by design (directory reuse), batch payoutRef visible post-generation only. |

---

## 14. Full-suite expansion (executed 2026-10-02) — gaushala, vets, herd & analytics

Turns the module into a complete dairy + gaushala management system. New backend
capabilities (all tested in `backend/tests/test_dairy_gaushala_analytics.py`):

| # | Addition | Where |
|---|---|---|
| B5 | `GET /livestock/dairy/analytics?month=` — collections (totals, avgFat/SNF, bySpecies, byShift, daily series, top-10 members), sales (totals, byStatus, daily), dues (pending net + count), previous-month comparison | `livestock_dairy.py` |
| B6 | `GET /livestock/dairy/farmer/analytics` — member card, last-6-months liters/amount/paid series, lifetime totals incl. pending | `livestock_dairy.py` |
| B7 | `GET /livestock/gaushala/analytics?month=` — 6-month expenses/donations/adoptions/intakes series, expenseByCategory, cattleByStatus | `livestock_gaushala.py` |
| B8 | `GET /livestock/gaushala/receipts` — issued 80G receipts list | `livestock_gaushala.py` |
| B9 | `AnimalIn.gaushalaId` — gaushala cattle intake via `POST /livestock/animals` (ownership-checked, `cattleStatus: in-shelter`, intake event); `Animal` response extended (`gaushalaId`, `cattleStatus`, `events`) | `livestock.py` + models |

Frontend phases (tool ids `gaushalaConsole`, `vetNetwork`, `livestock` were already
registered in `lib/dashboard.ts` — same placeholder pattern as §4.1):

| Phase | Scope | Routes |
|---|---|---|
| P8 Gaushala console | Profile setup gate, dashboard, cattle (intake/events), adoptions queue (approve→80G receipt), donations queue, expenses + categories, byproducts, receipts, 6-month analytics | `/gaushala/console/*` |
| P9 Vet network | Managed vets directory CRUD, appointments inbox (status advance, complete w/ prescription), vaccination campaigns (create/enroll/mark-vaccinated), prescriptions | `/vetnet/*` |
| P10 Herd registry | Animals list/search, register, detail with yield logs, breeding cycles, vaccinations, vet records | `/livestock/animals/*` |
| P11 Dairy analytics | `/dairy/console/analytics` (SVG charts, no new deps), farmer My-Dairy 6-month strip, CSV exports on ledger/statement/reports | `/dairy/console/analytics` |

Registrations: `GAUSHALA_PAGES` / `VET_PAGES` / `ANIMAL_PAGES` maps + ToolPage chain +
App.tsx routes, mirroring §6.5. Compliance unchanged (§9): no contact-sharing surfaces,
receipt/donation flows stay in-platform.

---

*End of plan. Phases 1–7 + full-suite expansion §14 all landed 2026-10-02.*
