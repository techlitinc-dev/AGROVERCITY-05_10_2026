# Seller / Vyapari Marketplace — Implementation Summary

**Companion to:** `plan/seller_plan.md` · **Date:** 2026-10-01 · **Status:** implemented & verified

The Farmer ↔ Vyapari direct marketplace from `features/Vyapari.md` is now live in the web app (`website/`), built strictly on backend endpoints that exist. Both personas get one coherent workspace each: the app silently activates the right backend profile behind the scenes — users never think about roles.

---

## 1. What was delivered

### Farmer workspace
| Tool | What it does |
|---|---|
| 🌾 Sell Produce | Create/edit/withdraw produce lots — photo-first (2–6 photos, Firebase Storage upload with client-side compression), live mandi benchmark beside the price field, offline-tolerant draft autosave |
| 💬 My Offers | Unified negotiation inbox (Received/Sent): accept, decline, counter (one round, matching backend) |
| 🧾 Purchases | Booking ledger (Selling/Buying tabs) → timeline detail driven by `purchase.events[]` with the next action as a single primary button |
| 📢 Buy Demands | Browse open buyer demands and send a structured supply offer |
| 📈 Mandi Rates | Prices, "where should I sell" net-profit comparator, vyapari rates, price history |
| 🏧 Bank Accounts | Payout accounts with masked numbers + penny-drop verify + primary account |

### Seller / Vyapari workspace
Everything above (as buyer) plus: 🔍 Discover (browse all open lots with filters/sort, Book-Now with quantity stepper, Make-Offer), 📣 My Demands (post/edit/close/reopen/delete wanted orders), ⭐ Saved Farmers, 📊 Analytics (spend, crop mix vs mandi modal, top suppliers, QC rejection, completion rate), 🧮 Khata (buyer ledgers), 🧾 POS Sales (auto-bill with mandi fee + credit), 🚜 Procurement (J-form with auto payout math + mark-paid), 🏷️ Post Rates (±25% mandi-band validation surfaced).

### Cross-cutting
- **Persona switching is now server-backed** — `setActiveProfile` calls `POST /users/me/profiles/{type}/activate`; a new `ensureProfile()` helper links + activates on demand when a gated tool is opened (`website/src/stores/dashboard.ts`).
- **Notification bell** in the dashboard menubar with live unread badge (`/dashboard/p/notifications` inbox with mark-read/mark-all).
- **Full i18n**: every new string via `t()`; complete English + Hindi dictionaries (`en.trade.ts` / `hi.trade.ts`, merged into the existing locale registry — other 21 locales fall back per the existing chain).
- **Design tokens**: all trade UI reuses `tokens.css` + a new `trade.css` (~330 lines) — same cards, chips, sheets, toasts as the rest of the app.

## 2. Backend changes (Phase 0 — the plan's Option B)

All verified compiling and exercised end-to-end:

| File | Change |
|---|---|
| `backend/app/routers/demands.py` | `require_role(user, "directBuyer")` → accepts `seller` too; `_company_of()` falls back to `SellerRoleProfile.shopName` |
| `backend/app/routers/direct_buyer.py` | feed / saved-farmers / analytics / profile accept `seller` |
| `backend/app/routers/purchase_settlement.py` | buyer→farmer rating accepts `seller` |
| `backend/app/routers/lots.py` | **new** `GET /v1/market/lots/browse` — open discovery with crop/state/rate-band/qty/harvest filters + sort (newest/price/ready-date), excludes own lots, enriches first-name+village only (spec G1/G2 anonymity); **new** `GET /v1/market/lots/{id}` |

## 3. Frontend structure (~7,000 lines across 33 files)

- **9 API modules** — `lib/api/{trade,offers,purchases,demands,discovery,seller,mandi,notifications,bank}.ts`, typed to the verified Firestore doc shapes.
- **9 shared components** — `components/trade/`: ToolShell (page chrome), StatusPill (every status enum), Timeline (events), PhotoUploader, PriceWithBenchmark, CounterOfferForm, QuantityStepper, ConfirmSheet, EmptyState (+ `useEnsureProfile` hook).
- **19 views** — `views/trade/`: lots list/form, discovery, lot detail, offers inbox/detail, purchases ledger/detail, demands list/form, browse-demands, mandi, saved farmers, analytics, khata, POS, procurement, rates, notifications, bank accounts.
- **Wiring** — `views/trade/index.ts` registry; `ToolPage` renders real pages (placeholder fallback retained); 7 deep routes in `App.tsx`; new tool ids + route access + home sections in `lib/dashboard.ts`; `stores/trade.ts` (drafts, filters, unread count); Firebase Storage helpers in `lib/firebase.ts`.

## 4. Verification (all against the real running backend)

`pnpm build` clean (tsc strict + vite). End-to-end flow exercised with two `dev-` test users via curl:

- ✅ Seller blocked from farmer endpoints with wrong profile — **403**; works after activation (this found a real backend quirk: new users default to `activeProfile: "farmer"`, so explicit activation is mandatory — the web app's `ensureProfile` handles it)
- ✅ Farmer created a lot → seller browsed it (enrichment shows first name + village) → offer → farmer counter → seller accepted → **purchase at the counter price**, lot flipped to `sold`
- ✅ Full lifecycle: advance → pickup → dispatch → deliver → QC (full accept auto-completes + issues `INV-…`) → mutual ratings (seller can rate farmer — the Option B change)
- ✅ Guards all fire correctly: overpay **409**, QC sum mismatch **422**, rate outside mandi band **422 RATE_OUT_OF_BAND**, payment on completed purchase **409** (terminal = settled)
- ✅ Demand loop: seller posts (as seller role) → farmer sees it in open list → offers → accept → demand `fulfilled`
- ✅ Book-Now partial quantity (30 of 100 q) — lot decremented to 70
- ✅ QC-dispute path: rejected qty → `qcDisputed` with recomputed `finalAmount` → farmer-side resolve → `completed` + invoice
- ✅ Smoke: mandi compare, bank add + penny-drop verify, khata entry, POS bill, J-form + pay, analytics totals, saved farmers
- ✅ Vite dev server serves and proxies `/v1` → backend

## 5. Deviations from the plan (all deliberate)

1. **Dispatch is buyer-side** — plan §5.4 says buyer marks dispatch + delivered; the delegated build initially gave dispatch to the farmer; corrected to match the plan (backend allows either participant).
2. **`ensureProfile('seller')` on discovery/demand pages** instead of `directBuyer` — the plan's Option B made seller sufficient, keeping one coherent Vyapari persona.
3. **`registerLocale` now merges** dictionaries so feature locales (`*.trade.ts`) layer onto base `en`/`hi` without owning them.
4. Lot photos upload **client-side to Firebase Storage** (zero backend change), compressed to ≤1024px JPEG.

## 6. v2 additions — chat, escrow, handover OTP, offer expiry

The four features originally deferred (plan §11) are now implemented and verified:

| Feature | Backend | Frontend |
|---|---|---|
| **Offer expiry** (spec V5/V6) | `expiresAt` set at create (24h) and extended on counter; lazy expiry flips `pending/countered → expired` on any read; accept/counter/reject/withdraw return `OFFER_EXPIRED`; expired offers no longer block new offers | ⏳ countdown on offer cards + detail (`offerExpiresIn`), actions hidden when expired, `StatusPill` 'expired' |
| **Escrow** (spec C4/C5) | `escrow` object on every purchase (`unfunded→held→released/refunded`); `POST /purchases/{id}/escrow/fund` (buyer, at confirmation, defaults to booking total → PAYMENT_HELD); auto-release at completion minus commission (2%, min ₹50 — `commission_for()`); auto-refund on cancel; events `escrowFunded/escrowReleased/escrowRefunded` | Escrow card with status/amount/commission/net-release; "Fund escrow" sheet replaces the ad-hoc advance once held |
| **Handover OTP** (spec F11) | 6-digit OTP, farmer-only via `GET /purchases/{id}/handover-otp` (403 for buyer, redacted from all buyer responses), 15-min validity, single-use, 5-attempt cap, regenerate on expiry; `POST /purchases/{id}/handover/verify` (buyer, window = pickupScheduled→delivered); QC is gated: escrow held without verified OTP → `HANDOVER_REQUIRED` | Farmer reveal card with live countdown; buyer 6-digit verify sheet; error-code-mapped toasts |
| **Chat** (spec §4, G1) | `app/services/chat.py` + `app/routers/chat.py`: rooms event-sourced from BOOKING_CONFIRMED (created at purchase creation + lazy-ensure), keyed by purchaseId; `GET /chat/rooms`, `GET/POST /chat/rooms/{id}/messages`, `POST .../read`; participant-only (non-participant gets 403 `CHAT_LOCKED_FOR_BOOKING`); terminal bookings read-only (`CHAT_CLOSED`); first-name anonymity; text ≤500 chars; 2s rate limit | `ChatRoomPage` at `/dashboard/p/purchases/:id/chat` (5s polling, bubbles, photo upload via Firebase Storage, read marking, locked/closed notices), "Open chat" button on the booking detail |

### v2 verification (real backend, all passing)
Escrow guards (farmer fund 403, over-fund 422, double-fund 409, unfunded→held→advancePaid) · OTP lifecycle (buyer reveal 403, early verify 400, buyer-view redaction, wrong-OTP attempt counting, verify, re-verify 409, expiry regenerate) · release math (₹1,20,000 → commission ₹2,400 → net ₹1,17,600; min-fee floor on small deals) · `HANDOVER_REQUIRED` gate then success · cancel → refund · chat (non-participant 403, empty 422, rate-limit 429, unread/read flags, `CHAT_CLOSED` after completion with readable archive) · forced expiry → lazy flip on read, `OFFER_EXPIRED` on actions, fresh offer allowed after.

## 7. v3 — persona-switching fix + professional seller dashboard

**Persona switching fix** — the switcher sheet's Add button was local-only, so tapping an unlinked persona (e.g. Farmer on a seller-registered account) sent `activate` to a profile the backend didn't know → 404 `PROFILE_NOT_LINKED` → **silent rollback** (the reported bug). Fixed: `setActiveProfile` now **links then activates** (`POST /users/me/profiles` → `.../activate`), `toggleLinked` is server-backed (`DELETE /users/me/profiles/{type}` with the backend's last-profile 409 guard surfaced as a toast), and failures toast `profileSwitchFailed` instead of failing silently. Verified against the backend: seller-only account → old path 404s → new path links+activates → farmer role checks pass → switch-back works.

**Seller home board** (`SellerHomeBoard` on the seller dashboard) — a real-data command center: today's POS turnover, khata credit outstanding (+debtor count), pending procurement payouts, open offers (+active demands), recent purchases and recent sales with status pills, all drill-down linked.

**Analytics v2** — professional control tower: P&L summary (POS revenue vs procurement spend vs platform commission vs gross margin), booking-status funnel bars, 12-month spend column chart, crop mix benchmarked to mandi modal with ▲/▼ deltas, mandi price-trend line chart (crop chips + mandi select, hand-rolled SVG), supplier network, and one-tap **CSV export** for purchases / POS sales / procurement (client-side, no backend needed).

## 7. v4 — notification system + deal-making chat

**Notification system** (`app/services/notify.py`) — every trade event now emits an inbox doc + FCM topic ping: offer received/countered/accepted/rejected/withdrawn/expired, booking confirmed, advance/payment received, pickup/dispatch/deliver, escrow funded, handover verified, QC/dispute/resolution, deal completed (with invoice no.), ratings, and chat messages. Each carries a `type` and `data.path` deep link; the inbox shows a type badge + "Open" jump, and the menubar bell badge reflects unread count. Bilingual EN/HI titles.

**Deal-making chat** — negotiation threads open automatically when an offer is created (`kind: 'offer'` rooms, counterparties computed for both lot and demand directions). Farmer and vyapari chat, and a sticky **deal bar** inside the thread offers the structured actions — accept / counter / decline / withdraw with the same gating as the offer page — so the deal is finalized right in the conversation (accept → booking chat thread). Terminal offers become read-only archives with a "View booking" hand-off. Verified end-to-end: offer → room + notification → two-way chat with snippets → counter/accept → purchase created → room locked (`CHAT_CLOSED`) → booking room live.

A **Chats hub** (💬 in the menubar + `chats` tool) lists every thread — negotiations and bookings — with unread dots, kind tags, last-message previews, and deep links.

> Note: spec G1 originally forbade pre-booking chat; the product owner directed negotiation chat (closure still goes through the structured offer engine — no free-form deal-making outside it).

## 8. Known gaps & follow-ups (remaining)

- Escrow release happens at completion (the machine's terminal state); the spec's T+24h delayed-release clock would need a scheduler.
- Chat transport is 5s polling, not WebSocket — fine for v1 web; spec's WSS remains a scaling item.
- Notification titles are bilingual EN/HI; full vernacular templating per user language is a future pass.
- The menubar 💬 pill has no unread badge (unread shows inside the chats list).
- Still out of scope (no backend): team accounts, credit limit, KYC state machine, no-show fees, live GPS.
- **Firebase Storage rules** must allow authenticated writes in the `agrovercity-bafec` project (console action) for photo upload to work outside dev emulation.
- One-round counter and in-memory Firestore filters are fine at current volume; revisit at scale.
- Backend dev quirk (unchanged): new users default to `activeProfile: "farmer"` — the web app handles activation explicitly via the store's link-then-activate flow.
