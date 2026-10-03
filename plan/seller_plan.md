# Seller / Vyapari Marketplace — Website Implementation Plan

**Goal:** Implement the Farmer ↔ Vyapari direct marketplace from `features/Vyapari.md` in the existing web app (`website/`), on top of the **already-implemented** backend endpoints. The experience must be simple for two personas: **Farmer** (supply side, low-literacy-first) and **Seller/Vyapari** (demand side, business tooling).

**Date:** 2026-10-01 · **Scope authority:** `features/Vyapari.md` (spec) + `backend/app` (ground truth) + `plan/onboardoing_plan.md` (existing web conventions)

---

## 1. Ground truth — what the backend implements today

The spec is larger than the backend. The web plan implements **only what real endpoints back**; gaps are listed in §11.

### 1.1 The trade chain (fully implementable now)

```
Farmer                                    Seller / Vyapari
──────                                    ────────────────
market_lots  ──offer/book-now──►  offers  ──accept──►  purchases  ──QC/pay──►  invoice + rating
   (CRUD)        ◄──counter──      (inbox)                (timeline)
     ▲                                                   │
demands ◄──post wanted order (directBuyer role)          ▼
   └── farmer browses open demands, offers against them ─┘
```

| Spec ref | Feature | Backend | Status |
|---|---|---|---|
| F4/F5 | Produce lots (create/edit/withdraw, photos[], location) | `POST/GET/PUT/DELETE /v1/market/lots` (role: `farmer`) | ✅ |
| F6/V5/V6 | Structured offers, accept/counter/decline/withdraw, inbox | `/v1/offers/*` (any authenticated user) | ✅ (single counter, no expiry timer — see §11) |
| V5 | Book-Now at list price, partial quantity | `POST /v1/purchases {lotId, quantity?}` | ✅ |
| F8/V7 | Booking ledger + timeline | `GET /v1/purchases[/{id}]`, `events[]` inside doc | ✅ |
| V7 payments | Advance / balance payment recording | `POST /v1/purchases/{id}/advance` · `/{id}/pay` | ✅ ledger-only (no escrow — see §11) |
| F9/V8 | Pickup scheduling | `POST /v1/purchases/{id}/pickup {date, vehicleType, address, notes}` | ✅ |
| F8 | Dispatch / delivery steps | `/{id}/dispatch` · `/{id}/deliver` | ✅ |
| F10/V9 | Inspection + quality dispute | `/{id}/qc {grade, acceptedQty, rejectedQty, note}` → `qcDisputed` → `/{id}/resolve` | ✅ |
| V11 | Auto invoice per purchase | `GET /v1/purchases/{id}/invoice` (`INV-…`) | ✅ |
| F13/V14 | Mutual rating post-completion | `POST /v1/purchases/{id}/rate` (role-gated, see §3) | ✅ |
| V4 | Demand (reverse) listing | `/v1/demands/*` — **role: `directBuyer`** for write; anyone can read open list | ⚠️ role gate (§3) |
| V3 | Discovery feed | `GET /v1/direct-buyer/feed` (lots matching my demand crops / saved farmers) | ⚠️ role gate (§3) |
| V12 | Saved farmers / watchlist | `/v1/direct-buyer/saved-farmers` | ⚠️ role gate (§3) |
| F7/V3 | Mandi price reference card | `/v1/mandi/prices` · `/compare?crop=&quantityQuintals=` · `/prices/history` (roles `farmer/seller/broker`) | ✅ |
| F14 | Notification inbox | `/v1/notifications` (+ `/read`, `/read-all`) | ✅ |
| V2 | Business profile | `roleProfiles` collected at registration; `SellerRoleProfile`, `DirectBuyerRoleProfile` | ✅ |
| F12 | Bank accounts for payout | `/v1/bank-accounts` (add/list/verify/set-primary) | ✅ |
| V11 | Seller POS, khata (buyer ledger), procurement J-form, mandi-rate posting | `/v1/seller/sales` · `/seller/ledgers` · `/seller/procurement` · `/seller/rates` | ✅ (role: `seller`) |
| V11 | Procurement analytics | `GET /v1/direct-buyer/analytics` | ⚠️ role gate (§3) |

### 1.2 Status enums (drives the whole UI)

- **Offer:** `pending → accepted | rejected | withdrawn | countered` (negotiable: `pending`, `countered`)
- **Lot:** `open → sold | withdrawn`
- **Demand:** `open → closed → open` · `open → fulfilled`
- **Purchase:** `confirmed → advancePaid → pickupScheduled → inTransit → delivered → completed`, with `delivered → qcDisputed → completed`, and `cancelled` from `confirmed/advancePaid/pickupScheduled`. Every transition appends to `events[]` — the timeline UI renders from this array.
- **Invoice:** issued at `completed` (`INV-{id8}-{yymm}`)

---

## 2. Design principles (ease-of-use contract)

These are non-negotiable product rules for both personas:

1. **One coherent workspace per persona.** Users never think about backend roles. Entering a role-gated tool silently activates the required backend profile (`POST /v1/users/me/profiles/{type}/activate`, already implemented at `backend/app/routers/users.py:331`) and links a missing profile on demand (`POST /v1/users/me/profiles`). The web app's current persona switch is local-only — this plan wires it to the real endpoint (§6.3).
2. **Structured choices, never free text,** except `notes`/`message` fields that already exist. Chips, steppers, and cards for crop/grade/quantity/price (spec G1: no pre-booking chat — the backend has no chat at all, so we are compliant by construction).
3. **Vernacular-first, low-literacy-first.** Every screen: Mukta, `t()` i18n keys (en + hi fully translated; other 21 locales fall back), icons beside every label, large touch targets (≥48px), numerals in Indian format (₹, quintal). Optional voice input is a later phase (mobile has the pattern).
4. **Photo-first.** Listing creation and QC revolve around photos. Lot photos are URL strings (`LotRequest.photos: list[str]`) — upload client-side to **Firebase Storage** (Firebase SDK already initialized in the web app for auth; Storage is a zero-backend-change addition) and store the download URL.
5. **Mandi benchmark next to every price.** `GET /v1/mandi/compare?crop=&quantityQuintals=` powers a "market context" card on listing, offer, and counter screens (spec F7) — never let a user type a price blind.
6. **Timeline over tables.** The purchase dashboard is a vertical timeline rendered from `purchase.events[]` with the next actionable step as the single primary button (WhatsApp-simple mental model).
7. **Offline-tolerant drafts.** Lot/demand forms autosave to a zustand-persisted draft store and sync on submit (spec F4 "drafts saved offline"; client-side only).
8. **Idempotent + safe retries.** All writes go through the existing axios client which already injects `Idempotency-Key` and handles 401-refresh.

---

## 3. The Vyapari role question (decision required)

The spec's "Vyapari" spans two backend roles:

| Backend role | Covers |
|---|---|
| `seller` | POS sales, khata, procurement J-form, mandi-rate posting, e-market products |
| `directBuyer` | Demands, discovery feed, saved farmers, analytics, **and the buyer→farmer purchase rating** |

Offers and purchases themselves are role-free (any authenticated user), so the **core trade loop works for a `seller` today**. Only demands/feed/saved-farmers/analytics/rating are gated to `directBuyer` (`backend/app/routers/demands.py:28`, `direct_buyer.py:28`, and the rate endpoint in `purchase_settlement.py`).

**Recommended — Option B (small backend change, cleanest UX):** allow `seller` alongside `directBuyer` in those role checks. Exact edits:

1. `backend/app/routers/demands.py:28` — `require_role(user, "directBuyer")` → `require_role(user, "directBuyer", "seller")` (also decide company-name source for `seller`: fall back to `SellerRoleProfile.shopName` in `_company_of`).
2. `backend/app/routers/direct_buyer.py:28` — same expansion (feed, saved farmers, analytics all make sense for a Vyapari).
3. `backend/app/routers/purchase_settlement.py` (rate) — buyer-side rating: accept `seller` too.
4. Add `GET /v1/market/lots/browse` (any authenticated role; filters `crop`, `state`, `minRate`, `maxRate`, `minQty`, `harvestBefore`; sort `ready-date|price|newest`) — open discovery per spec V3. Model it on the existing `list_lots` but without the `farmerId == uid` constraint and with the filter params applied in-memory like the rest of the codebase.

**Fallback — Option A (zero backend change):** keep the gates as-is. The web app auto-activates `directBuyer` when the Vyapari opens demand/discovery/analytics tools, prompting to link that profile if missing (activation + linking endpoints already exist). Slightly more persona juggling; works end-to-end today.

The plan below is written for **Option B**, with Option A noted where it differs. If the backend team declines the change, only §5 (Discovery) and §5.4 (Demands) change behavior.

---

## 4. Personas & IA

### 4.1 Persona workspaces

The existing dashboard (`DashboardHome`, tool registry in `src/lib/dashboard.ts`) already registers the tool ids and persona palette. This plan **implements real pages behind those ids** — no new nav paradigm, no new shells. Existing tool ids wired to real pages: `sellProduce`, `browseLots`, `myOffers`, `purchases`, `demands`, `buyDemands`, `marketplace`, `mandi`, `sellerProducts`, `buyers`.

| Persona | New/updated sections (dashboard tools) |
|---|---|
| **Farmer** | 🌾 Sell Produce (lots) · 📥 Offer Inbox (`myOffers`) · 🧾 My Bookings (`purchases`) · 📢 Buyer Demands (`buyDemands`) · 📈 Mandi Prices (`mandi`) · 🏦 Bank Accounts |
| **Seller / Vyapari** | 🔍 Discover Lots (`browseLots`) · 📢 My Demands (`demands`) · 📥 Offer Inbox (`myOffers`) · 🧾 Purchases (`purchases`) · 🤝 Saved Farmers (`buyers`) · 📊 Analytics · 🧮 Khata (ledger) · 🛒 POS Sales · 🚜 Procurement (J-form) · 🏷️ Post Rates · 📈 Mandi Prices · 🏷️ My Products (`sellerProducts`) |

### 4.2 Routes

All under the existing `/dashboard/p/:toolId` shell, plus deep routes (new). `loggedIn` guard already exists in `App.tsx`; a second-layer `canAccess(activeProfile, toolId)` guard already exists in `ToolPage.tsx`.

| Route | Screen | Persona | Endpoints |
|---|---|---|---|
| `/dashboard/p/sellProduce` | My lots list (+ status chips: open/sold/withdrawn) | farmer | `GET /market/lots` |
| `/dashboard/p/sellProduce/new` | Create lot (photo-first form) | farmer | `POST /market/lots` |
| `/dashboard/p/sellProduce/:lotId/edit` | Edit / withdraw lot | farmer | `PUT/DELETE /market/lots/{id}` |
| `/dashboard/p/browseLots` | Discovery: browse lots, filters, sort | seller | `GET /market/lots/browse` *(new)* or `/direct-buyer/feed` |
| `/dashboard/p/browseLots/:lotId` | Lot detail + Book-Now / Make-Offer sheet | seller | lot detail, `POST /purchases`, `POST /offers` |
| `/dashboard/p/myOffers` | Unified offer inbox: Received / Sent tabs, filter by status, target type | both | `GET /offers/mine?filter=` |
| `/dashboard/p/myOffers/:offerId` | Offer card → Accept / Counter / Decline / Withdraw | both | `GET/POST /offers/{id}/*` |
| `/dashboard/p/demands` | My demands (seller) | seller | `GET /demands?status=all`, `POST/PUT/DELETE /demands*` |
| `/dashboard/p/demands/new` | Post wanted order | seller | `POST /demands` |
| `/dashboard/p/buyDemands` | Browse open demands (farmer) + "Offer against this" | farmer | `GET /demands?status=open`, `POST /offers` (targetType=demand) |
| `/dashboard/p/purchases` | Booking ledger list (role toggle: as farmer / as buyer) | both | `GET /purchases?role=` |
| `/dashboard/p/purchases/:purchaseId` | Booking detail: timeline + contextual actions | both | `GET /purchases/{id}` + action endpoints |
| `/dashboard/p/buyers` | Saved farmers (save/unsave from lot detail) | seller | `/direct-buyer/saved-farmers` |
| `/dashboard/p/analytics` | Procurement analytics (spend, crop mix, QC rejection, completion) | seller | `GET /direct-buyer/analytics` |
| `/dashboard/p/khata` | Buyer khata: entries per buyer, outstanding totals | seller | `GET/POST /seller/ledgers` |
| `/dashboard/p/pos` | Quick sale entry + sales list + stats | seller | `POST/GET /seller/sales` |
| `/dashboard/p/procurement` | J-form procurement lots + pay action | seller | `GET/POST /seller/procurement`, `/{id}/pay` |
| `/dashboard/p/rates` | Post mandi rate + my pending rates | seller | `POST /seller/rates`, `GET /seller/rates/my` |
| `/dashboard/p/mandi` | Mandi prices, compare (net-profit across mandis), history | both | `/mandi/*` |
| `/dashboard/p/marketplace` | E-market product browse (existing backend, web UI new) | both | `/products`, cart endpoints |
| `/dashboard/p/bankAccounts` | Bank accounts (payout readiness for farmers) | farmer | `/bank-accounts` |
| `/dashboard/notifications` | Notification inbox (bell in header) | both | `/notifications` |

---

## 5. Userflow

### 5.0 Shared preconditions

- User is registered/onboarded (existing onboarding flow), holds `farmer` and/or `seller` (+ `directBuyer` if Option A) in `linkedProfiles`.
- Session hydrated via `GET /users/me`; `activeProfile` persisted server-side via the activate endpoint whenever the user crosses persona boundaries.

### 5.1 MASTER FLOW A — Farmer (supply side)

```
Login ──► Dashboard (farmer persona)
   │
   ├─► [A1] Create lot ──► lot live (status=open)
   │        crop chips ──► quantity (quintal) ──► expected ₹/quintal
   │        (mandi-compare benchmark card shown while typing price)
   │        ──► harvest date ──► photos (≥2) ──► pickup location ──► Submit
   │
   ├─► [A2] Offer inbox (received on my lot OR on a demand I targeted)
   │        Offer card: buyer name + KYC persona badge, price/qty/pickup, message
   │        ├─ Accept ──► PURCHASE created (booking dashboard)
   │        ├─ Counter (price only, one round) ──► buyer accepts/declines
   │        └─ Decline
   │
   ├─► [A3] Booking dashboard ──► timeline:
   │        confirmed ──► (buyer pays advance) ──► (buyer schedules pickup)
   │        ──► inTransit ──► delivered ──► QC filed ──► completed
   │        ├─ farmer watches each step; cancel allowed until pickupScheduled
   │        ├─ QC rejected qty? ──► qcDisputed ──► resolution shows final amount
   │        └─ completed ──► invoice view + Rate buyer
   │
   └─► [A4] Alternate entry: browse open demands (buyDemands)
            ──► "Offer supply" (price, qty, message) ──► same offer inbox semantics
```

Step detail:

1. **A1 Create lot** — `/dashboard/p/sellProduce/new`. Fields exactly per `LotRequest`: `crop` (chips + custom, reuse `ChipSelect`/`MultiChipWithCustom`), `quantityQuintals` (stepper, decimal), `expectedRate` ₹/quintal (with live `/mandi/compare` card), `harvestDate` (date picker, default today), `photos` (Firebase Storage upload, 2–6, compressed client-side), `location` (pin dict `{village, district, state, lat?, lng?}` prefilled from user profile). Draft autosaves to `trade` store; submit → `POST /v1/market/lots` → toast → lot list.
2. **A2 Offer inbox** — `/dashboard/p/myOffers`, tab *Received*. Card shows counterparty (first name + role badge only — spec G1/G2 anonymity), structured fields, time ago. Actions per state: `pending` → Accept / Counter / Decline (owner); `countered` (by me) → Accept / Decline (maker). Counter = price + optional note, prefilled with mandi modal price. Accept → `POST /offers/{id}/accept` → navigate to new purchase.
3. **A3 Booking dashboard** — `/dashboard/p/purchases` list (`GET /purchases?role=farmer`, cards: crop, qty, amount, status pill) → detail renders `events[]` as a vertical timeline; the *next* transition for my role is the single primary CTA (e.g. after `delivered`: "Review inspection"). Cancel from `confirmed/advancePaid/pickupScheduled` with reason sheet. On `completed`: invoice card (`GET /purchases/{id}/invoice`) + rating sheet (1–5 + tags per spec F13; backend stores `rating` + `review`).
4. **A4 Demand response** — `/dashboard/p/buyDemands` lists open demands (`GET /demands?status=open&crop=&state=`) with "Offer supply" sheet → `POST /offers {targetType: "demand", targetId, pricePerUnit, quantity, message}`.

### 5.2 MASTER FLOW B — Seller / Vyapari (demand side)

```
Login ──► Dashboard (seller persona)
   │
   ├─► [B1] Discover ──► browse lots (crop / price band / qty / harvest date / state filters;
   │        sort: ready-date | price | newest; distance when coords available)
   │        Lot card ──► detail ──► ├─ Book Now (qty stepper ≤ lot qty) ──► PURCHASE
   │                                └─ Make Offer (price, qty, pickup date, message)
   │                                   ──► farmer counter? ──► accept/decline (one round)
   │        ★ Save farmer (watchlist) from lot detail
   │
   ├─► [B2] Post demand ──► wanted order (crop, qty, grade, max price, delivery
   │        location, needed-by, frequency, packaging, notes) ──► status=open
   │        ──► farmer offers appear in my Received inbox ──► Accept ──► PURCHASE
   │        (demand auto-flips to fulfilled)
   │
   ├─► [B3] Booking dashboard (as buyer) ──► I drive the physical flow:
   │        confirmed ──► Pay advance (amount, method, ref) ──► Schedule pickup
   │        (date, vehicleType, address, notes) ──► Dispatch ──► Mark delivered
   │        ──► File QC (grade, accepted/rejected qty, note) ──► completed
   │        ──► Pay balance ──► invoice ──► Rate farmer
   │        (cancel with reason until pickupScheduled)
   │
   └─► [B4] Business suite
            Khata (buyer ledgers: credit/payment/adjustment, outstanding totals)
            POS sale entry (auto bill INV-…, mandi fee, credit handling)
            Procurement J-form (gross/tare → net, quality deduction, pay)
            Post mandi rate (validated ±25% vs modal; 422 RATE_OUT_OF_BAND surfaced)
            Analytics (spend, crop mix vs mandi modal, top suppliers, QC rejection %)
```

Step detail:

1. **B1 Discovery** — `/dashboard/p/browseLots`. Data from new `GET /market/lots/browse` (Option B) or `/direct-buyer/feed` (Option A — only lots matching my demand crops/saved farmers; UI says "matching your demands"). Filters as chips + bottom-sheet. Each card: crop photo, qty, expected ₹/quintal, **mandi modal benchmark delta**, harvest date, village/district. Detail: photo gallery, location, farmer first-name + rating badge (from purchases), Book-Now sheet (quantity stepper, total auto-compute → `POST /purchases {lotId, quantity}`) or Make-Offer sheet (`POST /offers {targetType: "lot", …}`).
2. **B2 Demand posting** — `/dashboard/p/demands/new` per `DemandCreate`. My demands list with open/closed/fulfilled chips, edit while open, close/reopen, delete (409 if live offers — surface as toast).
3. **B3 Booking dashboard** — same timeline screen as farmer but with buyer-side CTAs enabled per state (`advance` → `pickup` → `dispatch` → `deliver` → `qc` → `pay` → `rate`). Amount due auto-computed (`totalAmount − Σpayments − rejected-qty delta`); QC sets `finalAmount`. Cancel with reason sheet.
4. **B4 Business suite** — straightforward CRUD screens over `/seller/*` and `/direct-buyer/analytics`, reusing the same card/timeline/chip language. Khata groups entries per buyer with running balance (backend already aggregates).

### 5.3 Offer lifecycle state diagram (both personas)

```
            maker                         owner (lot/demand owner)
              │ POST /offers                    │
              ▼                                 ▼
        ┌──────────┐  owner counters    ┌────────────┐
        │ PENDING  │◄──────────────────►│  COUNTERED │
        └────┬─────┘  (price+note, 1x)  └─────┬──────┘
   accept / reject / withdraw        maker: accept / reject / withdraw
        │                                   │
        ▼ accept                          ▼ accept
   PURCHASE created (counter price    PURCHASE created
   if countered)                      + lot sold / demand fulfilled
```

### 5.4 Purchase timeline state → UI action map

| Status | Farmer sees | Buyer sees |
|---|---|---|
| `confirmed` | Cancel · watch for advance | **Pay advance** · Schedule pickup · Cancel |
| `advancePaid` | Cancel · watch for pickup | **Schedule pickup** · Cancel |
| `pickupScheduled` | Pickup details card | **Mark dispatch** · Cancel |
| `inTransit` | Transit card | **Mark delivered** |
| `delivered` | **Review inspection** (after QC) | **File QC** |
| `qcDisputed` | Resolution card (final amount) | Resolve (or wait for resolution) |
| `completed` | Invoice · **Rate buyer** · settlement card | Invoice · **Rate farmer** · Pay balance |
| `cancelled` | Terminal card + reason | Terminal card + reason |

---

## 6. Frontend architecture

### 6.1 New API modules (thin wrappers over the existing axios client — same conventions as `src/lib/api/auth.ts`)

```
src/lib/api/
├── trade.ts          # lots: create/list/update/withdraw (+ browse when backend lands)
├── offers.ts         # create, mine(filter), get, accept, reject, withdraw, counter
├── purchases.ts      # create, list(role), get, advance, pickup, dispatch, deliver,
│                     #   cancel, qc, resolve, pay, rate, invoice
├── demands.ts        # create/list/get/update/close/reopen/delete
├── discovery.ts      # feed, saved-farmers, analytics, profile
├── seller.ts         # sales, ledgers, procurement(+pay), rates(+my), products
├── mandi.ts          # prices, list, vyapari-rates, compare, history
└── notifications.ts  # inbox, read, read-all
```

Each function mirrors one endpoint, typed with local TS interfaces matching the Firestore doc shapes in §1.2. All errors propagate as the existing `ApiError` (`code`, `message`, `fieldErrors`) — forms render `fieldErrors` under fields, toasts render `message`.

### 6.2 New store

```
src/stores/trade.ts   # persisted: lot draft, demand draft, offer inbox filters,
                      # purchases list cache keyed by (role, page), unread-notifications count
```

Session/onboarding/dashboard stores are unchanged except `syncFromUser` also re-pulls `activeProfile` from the activate call response.

### 6.3 Persona activation wiring (the one change to existing code)

- `src/stores/dashboard.ts`: `setActiveProfile` becomes async — calls `POST /users/me/profiles/{type}/activate`, updates session `user`, falls back to local-only on failure (offline).
- New helper `ensureProfile(type: string)`: if `type` not in `linkedProfiles` → `POST /users/me/profiles {profileType}` → activate → toast "Seller profile added".
- `ToolPage.tsx` guard: before rendering a gated tool, `await ensureProfile(REQUIRED_PROFILE[toolId])`. Mapping: `sellProduce→farmer`, `demands/browseLots/buyers/analytics→seller (Option B) or directBuyer (Option A)`, `khata/pos/procurement/rates/sellerProducts→seller`, `mandi→either farmer|seller`.

### 6.4 New shared components

| Component | Purpose |
|---|---|
| `PhotoUploader` | multi-image pick, client compression, Firebase Storage upload, progress, retry |
| `PriceWithBenchmark` | price input + `/mandi/compare` delta card |
| `StatusPill` | all status enums → colored pill + vernacular label |
| `Timeline` | renders `events[]` vertical timeline with icons |
| `ActionSheet` | bottom-sheet for Accept/Counter/Decline, Book-Now, QC filing (wraps `ModalSheet`) |
| `QuantityStepper` | quintal/kg stepper with unit toggle |
| `CounterOfferForm` | price + note, prefilled benchmark |
| `EmptyState` | icon + vernacular line + CTA (reuse everywhere) |

Firebase: extend `src/lib/firebase.ts` with `getStorage()` and a `uploadImage(file, path)` helper. Storage rules must allow auth'd writes (add to `firestore.rules`-adjacent Storage rules / firebase console — flagged for whoever owns infra).

### 6.5 New views

```
src/views/trade/
├── LotsPage.tsx            # farmer's lots
├── LotForm.tsx             # create/edit (draft-backed)
├── DiscoverPage.tsx        # browse lots
├── LotDetailPage.tsx       # + BookNow/MakeOffer sheets
├── OffersPage.tsx          # inbox (Received/Sent)
├── OfferDetailPage.tsx     # accept/counter/decline/withdraw
├── DemandsPage.tsx         # my demands (seller)
├── DemandForm.tsx
├── BrowseDemandsPage.tsx   # open demands (farmer)
├── PurchasesPage.tsx       # ledger list
├── PurchaseDetailPage.tsx  # timeline + actions
├── SavedFarmersPage.tsx
├── AnalyticsPage.tsx
├── KhataPage.tsx
├── PosPage.tsx
├── ProcurementPage.tsx
├── RatesPage.tsx
└── MandiPage.tsx           # prices/compare/history
```

Each is a real page replacing the current `ToolPage` placeholder for its tool id (registry switch in `lib/dashboard.ts` — map tool id → component instead of the generic placeholder).

### 6.6 i18n & styling

- All new strings via `t()` with keys grouped per screen (`trade_*`, `offers_*`, `purchases_*`, `demands_*`, `seller_*`); **en + hi fully translated at merge time**, other locales fall back per existing chain.
- Reuse `tokens.css` classes (`.av-card`, `.av-btn`, `.av-chip`, `.av-input`); status pill colors added as tokens (`--av-status-*`). Layout follows the existing 480px phone column on desktop.

---

## 7. Implementation phases

**Phase 0 — Backend prerequisites (Option B):** the 3 role-check expansions + `GET /market/lots/browse` (§3). Independent of web work; the web proceeds against Option A mocks if delayed. *(If Option A chosen instead: skip Phase 0 entirely.)*

**Phase 1 — Core trade loop (both personas):**
1. Persona activation wiring (§6.3) + `ensureProfile`.
2. `PhotoUploader` + Firebase Storage wiring.
3. Farmer: lots list + `LotForm` (create/edit/withdraw) with drafts.
4. Offers: inbox + detail with all four actions + counter form.
5. Purchases: ledger + timeline detail with the full action map (§5.4) for both roles.
6. `StatusPill`, `Timeline`, `ActionSheet`, `EmptyState`.
7. Notifications inbox + header bell.
*Exit check: farmer creates lot → seller books → advance → pickup → dispatch → deliver → QC → complete → invoice → both rate. Same via offer-accept and counter paths.*

**Phase 2 — Demand side & discovery:**
8. Seller: demands CRUD + browse-demands for farmer + offer-against-demand.
9. Discovery page with filters/sort + lot detail + Book-Now/Make-Offer + save-farmer.
10. Mandi pages (prices, compare, history) + `PriceWithBenchmark` integrated into lot/offer/counter screens.
*Exit check: demand → farmer offer → accept → purchase; discovery → book → purchase; rate validation ±25% error path.*

**Phase 3 — Seller business suite:**
11. Khata, POS, procurement (+pay), rates (+my pending), analytics, saved farmers.
*Exit check: full khata credit→payment cycle; J-form creates + pays; analytics renders.*

**Phase 4 — Polish & hardening:**
12. Bank accounts page (farmer payout readiness), marketplace product browse (optional; backend already supports).
13. i18n sweep (en/hi complete), loading skeletons, error states, offline draft replay.
14. Performance: paginate lists, image compression targets ≤500 KB, skeletons over spinners.

---

## 8. Error & edge-case handling (UI contract)

| Case | Backend signal | UI behavior |
|---|---|---|
| Validation | 422 `VALIDATION_ERROR` + `fieldErrors` | inline under fields |
| Role blocked | 403 | `ensureProfile` prompt sheet (link + activate), never a dead screen |
| Sold lot edited | 409 `LOT_NOT_EDITABLE` | disable edit/withdraw, show "Sold" state |
| Rate out of band | 422 `RATE_OUT_OF_BAND` | inline hint with allowed band from `mandi/prices` |
| Live offers on demand | 409 | toast "Close offers first", offer inbox shortcut |
| Counter when not allowed | 400/409 status codes | hide the action (state-driven UI prevents most) |
| Already live offer (idempotent create) | 200 existing offer | toast "Offer already sent", open existing |
| Auth expiry | 401 | existing refresh single-flight → `/auth` fallback |
| Network offline | axios error | draft preserved; queued retry with idempotency key (client already sends it) |
| QC math | accepted+rejected ≠ quantity | 422 — stepper enforces sum = qty client-side first |
| Pay > due | 422/400 | due amount computed client-side; button disabled beyond |

---

## 9. Compliance mapping (spec guardrails → web reality)

| Guardrail | How the web app honors it |
|---|---|
| G1 — chat only post-booking; structured offers only | No chat UI anywhere. Offers/counters use structured fields; the only free text is the existing `message`/`notes`. |
| G1 — no user search/directory | No user directory; counterparties appear only as booking/offer participants (first name + persona + rating). |
| G2 — no calls/contact sharing | No call/WhatsApp/deep-link UI anywhere. |
| G3 — payments in-platform | Purchase payments recorded in-platform (ledger); no external payment-link UI. Real escrow is a backend gap (§11), not a UI bypass. |
| F7 — benchmark transparency | Mandi compare card on every price decision surface. |
| Anonymity | Counterparty shown as first name + role badge + rating only; phone never rendered (backend never returns it to the other party). |

---

## 10. Verification checklist (end-to-end, real backend)

Run backend (`bash run.sh`, uvicorn :8000) + web (`pnpm dev`). Two test users: one with `farmer`, one with `seller` (+`directBuyer` under Option A).

- [ ] Farmer: register→create lot (2+ photos)→edit→list shows status
- [ ] Seller: discovery shows the lot (filters/sort work)
- [ ] Seller: Book-Now partial qty → purchase `confirmed`; lot qty decremented
- [ ] Seller: Make offer → farmer sees in Received → Counter → seller accepts → purchase at counter price; lot `sold`
- [ ] Demand: seller posts → farmer browses open demands → offers → seller accepts → purchase; demand `fulfilled`
- [ ] Purchase full lifecycle: advance → pickup → dispatch → deliver → QC (no rejection → auto-complete) → invoice → both ratings
- [ ] QC dispute path: rejected qty → `qcDisputed` → resolve → `completed`, finalAmount reflects accepted qty
- [ ] Payment due math: advance + balance = finalAmount; overpay blocked
- [ ] Cancel paths from `confirmed/advancePaid/pickupScheduled` with reason
- [ ] Rate endpoint: buyer→farmer works for seller (Option B) or after directBuyer activation (Option A)
- [ ] Mandi compare card renders on lot form, offer form, counter form
- [ ] Rate-posting ±25% band error surfaced
- [ ] Khata credit → payment → balance zero; POS bill generated; J-form pay flips status
- [ ] Notifications arrive for offer/accept/purchase events (manual check of inbox after each action)
- [ ] `pnpm build` clean; no new deps beyond firebase storage (already in `firebase` package)
- [ ] en + hi strings complete for all new keys

---

## 11. Out of scope — spec features with no backend (do NOT build UI for these)

| Spec feature | Backend status | Note |
|---|---|---|
| In-app chat (§4), chat unlock | **Not implemented** (no chat router/rooms; only AI chatbot) | Compliant-by-absence; revisit when backend lands |
| Escrow / commission / TDS (C4/C5) | Not implemented — purchases use payment *ledger* entries; Razorpay exists only for e-market orders; settlements exist only for transport/equipment/broker | UI records payments; never implies money is "held in escrow" |
| Handover OTP (F11) | Not implemented | — |
| Offer expiry timers, 3-round caps (V6) | Single counter, no expiry | UI labels counter as one-round |
| Team accounts (V10), credit limit (V13) | Not implemented | — |
| KYC verification state machine, admin queue | Stubbed (hardcoded demo) | Vault upload UI can exist later; not needed for trade loop |
| No-show/cancellation fee policies (E1–E4) | Not implemented | Cancel is plain `cancelled` + reason |
| Live GPS / distance sort precision | No geospatial queries | Client-side haversine when coords present; otherwise omit distance |
| Booking-scoped dispute tickets with SLA (C8) | Only QC dispute exists | Use what `/purchases/{id}/qc` + `/resolve` provide |

If any of these land in the backend later, they slot into the timeline screen (`PurchaseDetailPage`) and offer card without IA changes.

---

## 12. Risks & open questions

1. **Option A vs B decision** (§3) — blocks Phase 2 scope only; Phase 1 is identical either way. *Recommend B.*
2. **Firebase Storage rules** — web uploads need auth-gated Storage rules in the `agrovercity-bafec` project; coordinate with whoever owns Firebase console.
3. **`browseLots` listing freshness** — Firestore `query()` patterns used elsewhere are in-memory filters; fine at current volume, note for scale.
4. **Notification fan-out** — backend does not auto-notify on offer/accept today; the web inbox will look empty until backend emits them (`POST /notifications` exists but is unauthenticated/internal). Flag to backend; UI is ready.
5. **Photo cost/latency** — enforce client compression ≤1024px / ≤500 KB before upload; 6-photo max per spec F4.
6. **`VITE_BACKEND_ORIGIN`** is read from shell env at config time (see onboarding plan §10) — document in README when adding new devs.
