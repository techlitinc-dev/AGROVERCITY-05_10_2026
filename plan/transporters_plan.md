# Transporter Marketplace — Website Implementation Plan

**Goal:** Implement the Farmer ↔ Transporter direct-booking platform from `features/farm_transporter.md` in the existing web app (`website/`), on top of the **already-implemented** backend transport endpoints. Must be simple for two personas: **Farmer** (books a vehicle, tracks the trip, confirms delivery) and **Transporter** (manages fleet, finds loads, runs trips, tracks earnings).

**Date:** 2026-10-01 · **Scope authority:** `features/farm_transporter.md` (spec) + `backend/app/routers/transport.py` (ground truth) + `plan/seller_plan.md` / `plan/seller_summary.md` (established web patterns)

---

## 1. Ground truth — what the backend implements today

The spec is larger than the backend. The web plan implements **only what real endpoints back**; gaps are listed in §11.

### 1.1 The transport chain (fully implementable now)

```
Farmer                                        Transporter
──────                                        ───────────
POST /transport/loads  ──open load──►  GET /transport/bookings?…  (load board)
POST /transport/bookings (instant quote)      POST /loads/{id}/bid  (bid)
       │                                      GET /loads/{id}/bids
       │                                      POST /loads/{id}/accept-bid?bidId=
       ▼                                              │ creates transport_bookings (born accepted)
GET /users/me/bookings  ◄──accept / accept-bid──  POST /bookings/{id}/accept (assigns vehicle)
       │                                      PATCH /bookings/{id} (status machine)
       │                                      POST /bookings/{id}/location (milestone pings)
       │                                      POST /bookings/{id}/weighbridge
       │                                      POST /bookings/{id}/expenses
       ▼                                              │
POD inspect + rating                        POD: PATCH → delivered (photos + receiver)
POST /ratings (bookingKind transport)         GET /bookings/{id}/expenses (trip P&L)
                                              GET /transport/settlements (weekly, 10%)
```

| Spec ref | Feature | Backend | Status |
|---|---|---|---|
| F1 | Post a Load (pickup/drop, crop, qty, vehicle type, date, fare) | `POST /transport/loads`, `POST /transport/bookings` | ✅ (no photos field) |
| F13 | Fare estimate (base + ₹/km × distance + labour + toll) | `POST /transport/fare-estimate` | ✅ |
| T1 | Vehicle fleet CRUD (6-type catalog, RC/insurance/permit fields, availability dates, calendar) | `/transport/vehicles*` | ✅ |
| T3 (partial) | Availability dates + operating routes | `PUT /vehicles/{id}/availability`, `PUT /transport/profile` | ✅ |
| T4 | Load board + my jobs | `GET /transport/bookings` (transporter), `GET /transport/loads` (all) | ✅ |
| T5 | Bid on open loads (fare, vehicle, ETA) | `POST /loads/{id}/bid`, `GET /loads/{id}/bids` | ✅ (no counter-offer) |
| F3 (partial) | Instant quote vs auction | instant quote = `POST /bookings`; auction = loads + bids | ✅ (no explicit mode toggle — farmer picks a path) |
| S3/F6 | Booking state machine | `requested → accepted → enRoute → delivered / cancelled` (+ born-accepted via accept-bid) | ✅ (partial — see §3) |
| T6/F7 | Trip milestones | `POST /bookings/{id}/location` (waypoint pings) + `waypointsLog` timeline | ✅ (no notifications — §3) |
| T7 | Location view (last ping + waypoint log) | `GET /bookings/{id}/location` | ✅ |
| T8/F8 (partial) | POD: photos + receiver name | `PATCH →delivered` requires `podPhotos` + `receiverName` | ✅ (no OTP — §11) |
| E12 | Weighbridge slip | `POST /bookings/{id}/weighbridge` | ✅ |
| T9 (partial) | Trip P&L (fare − expenses − commission) | `GET /bookings/{id}/expenses`, `POST …/expenses` | ✅ (5% commission quirk — §3) |
| T9 | Weekly settlements | `GET /transport/settlements` (10% commission) | ✅ |
| T10 (partial) | Fleet analytics | `GET /transport/analytics` (partly hardcoded) | ✅ |
| Bilty | Lorry receipt | `GET /bookings/{id}/bilty` | ✅ (synthetic, not persisted) |
| F11/S10 | Rate transporter | `POST /ratings {bookingKind:"transport"}` on `delivered` | ✅ (booker→transporter only) |
| S7 | Notification centre | 4 transport events already emitted (`booking_accepted/rejected`, `bid_received`, `booking_confirmed`) | ✅ |
| S5 | Post-confirmation chat | **NOT for transport rooms** — chat router only knows purchase/offer/direct kinds | ⚠️ needs small backend change (§3.1) |
| F5 | Transporter discovery directory | none | ❌ §11 |
| F9/S8 | Damage dispute module | none (only `pod.damageNotes`) | ❌ §11 |
| F10/S4/S12 | Escrow/payments/wallet for transport | none (fare is a number) | ❌ §11 |

### 1.2 Status enums (drive the whole UI)

- **Booking:** `requested → accepted → enRoute → delivered`, plus `cancelled`; load-auction bookings are born `accepted`.
- **Load:** `open → booked`
- **Bid:** `pending → accepted`
- **Vehicle:** `docStatus: pending | verified`, `active: bool`, `availableDates: [date]`
- **Cancellation:** `cancelledBy: farmer | transporter` + free-text reason

---

## 2. Design principles (ease-of-use contract)

Same contract as the trade module (see `seller_plan.md` §2), restated for these personas:

1. **One coherent workspace per persona** — entering a gated tool silently activates the right backend profile (`ensureProfile('transport')` / `'farmer'` — the transport/transporter alias is already handled server-side).
2. **Structured choices, big touch targets, vernacular-first** (Mukta, `t()`, en + hi complete, icons beside labels).
3. **Timeline over tables** — the trip page renders `waypointsLog` as a vertical timeline; the next milestone is the single primary button.
4. **Never render phone numbers.** Backend docs expose `farmerPhone`, `transporterPhone`, `driverPhone` and bilty returns hardcoded numbers — the spec forbids displaying them (T15/F17). The UI binds **name, rating, vehicle type, fare** only. This is a hard compliance rule.
5. **Fare transparency** — always show the fare breakdown card (base + per-km + labour + toll) from `/fare-estimate`; never a single black-box number.
6. **Offline-tolerant drafts** for the Post-a-Load wizard (zustand-persisted).
7. **Chat at every intersection** — negotiation chat on loads (bids), booking chat after acceptance, mirroring the trade module (§3.1 enables it).

---

## 3. Backend prerequisites (minimal, exact)

The trade module followed "Option B": tiny backend changes so one persona works cleanly. Same here. All edits are small and localized:

### 3.1 Transport chat rooms (required)
Chat is the spec's coordination channel (S5/D) and the web app's standard. Changes, mirroring `services/chat.py`:
1. Room `kind: "transport"` — created in `POST /bookings/{id}/accept` and `POST /loads/{id}/accept-bid` (`ensure_transport_room(booking)` keyed by booking id; parties = `userId` + `transporterId`; crop/commodity as the room subject).
2. `chat.py::_load_room` — add the `transport` branch: parties from the room doc; terminal when booking status in (`delivered`, `cancelled`) → read-only archive.
3. `post_message` notify path — `/dashboard/p/transport/trips/{id}/chat`.
4. Emit `chat_unlocked` notification to both parties on room creation.

### 3.2 Vehicle verification gate (required — currently dead-locks acceptance)
`PATCH /bookings` accept requires the assigned vehicle to have `docStatus == "verified"` (transport.py:194), but **nothing in the backend ever sets verified** (admin KYC queue is a hardcoded stub). Fresh DB → nobody can accept anything. Fix (pick one, recommend A):
- **A (recommended):** set `docStatus: "verified"` at vehicle creation; the UI shows a "Docs under review" badge separately. Ops/admin verification pipeline lands later.
- B: accept `pending` vehicles too (weakens the spec's trust model).

### 3.3 Milestone notifications (required for F7)
Add `notify_user` calls in `transport.py` (the emitter service already exists): `enRoute` → farmer ("Vehicle en route / गाड़ी निकली"), `delivered` (POD filed) → farmer ("Delivered — inspect & rate"), `weighbridge` → farmer, `location` waypoint pings → farmer (throttle: only notify for `at_pickup`, `loaded`, `unloading` waypoints, not every ping).

### 3.4 Farmer-side booking cancel + commission alignment
- `POST /bookings/{id}/cancel` (booker only, from `requested`/`accepted`, reason) — mirrors the transporter reject; emits notification. (Currently only transporters can cancel.)
- **Commission discrepancy:** trip-expenses endpoint computes **5%**, settlements service uses **10%** (`DEFAULT_CONFIG.transportPct`). Align both to the settlements config (10% default) so the trip P&L and weekly settlement never contradict each other.

### 3.5 Status filter on the farmer bookings list (verify, likely free)
`GET /users/me/bookings?status=` exists — confirm the transport branch honours it; the farmer "My Trips" page needs open vs completed filtering.

---

## 4. Personas & IA

The dashboard registry already defines the transport tool ids (`website/src/lib/dashboard.ts`) — this plan **implements real pages behind them**, exactly like the trade module did.

### 4.1 Persona workspaces

| Persona | Tools (tool ids already registered) |
|---|---|
| **Farmer** | 📋 Load Board (`loadBoard`) — post a load + my open loads · ✅ My Trips (`myBookings` transport tab) · 💰 Settlements n/a (farmer pays, not earns) · plus trade module tools |
| **Transporter** | 🏠 Transport Home (`transportHome`) — metrics + quick actions · 🚚 My Vehicles (`vehicleManage`) · 🗓️ Availability (`vehicleCalendar`) · 📥 Job Inbox (`bookingInbox`) · 🧭 Load Board (`loadBoard`) · 🛣️ Trip Detail (`tripDetail`) — milestones, POD, expenses · 📄 Bilty (`biltyView`) · 📍 Live Tracking (`liveTracking`) · 🪪 Business Profile (`transporterProfile`) · 💸 Settlements (`settlements`) |

### 4.2 Routes

All under the existing `/dashboard/p/:toolId` shell + deep routes (same pattern as trade):

| Route | Screen | Persona | Endpoints |
|---|---|---|---|
| `/dashboard/p/loadBoard` | Load board: open loads (all users) + "Post a load" CTA (farmer) | both | `/transport/loads`, `/transport/bookings` |
| `/dashboard/p/loadBoard/new` | Post-a-Load wizard (3 steps) | farmer | `/fare-estimate`, `/transport/loads`, `/transport/bookings` |
| `/dashboard/p/loadBoard/:loadId` | Load detail: bids list, accept-bid (farmer owner); bid sheet (transporter) | both | `/loads/{id}/bids`, `/loads/{id}/bid`, `/loads/{id}/accept-bid` |
| `/dashboard/p/myBookings` | My Trips (transport tab of existing bookings page — extend) | farmer | `/users/me/bookings`, `/transport/bookings/{id}` |
| `/dashboard/p/transport/trips/:tripId` | Trip command center: timeline, milestones, POD, weighbridge, bilty link, expenses, chat | both | `/bookings/{id}`, `/location`, `/weighbridge`, `/expenses`, `/bilty` |
| `/dashboard/p/transport/trips/:tripId/chat` | Booking chat room | both | chat router (§3.1) |
| `/dashboard/p/vehicleManage` | My fleet: vehicle cards, add/edit, availability dates | transporter | `/vehicles*` |
| `/dashboard/p/vehicleManage/new` · `/:vehicleId/edit` | Vehicle form | transporter | POST/PUT `/vehicles` |
| `/dashboard/p/vehicleCalendar` | Fleet calendar (assigned trips + available dates) | transporter | `/vehicles/{id}/calendar`, `/vehicles/{id}/availability` |
| `/dashboard/p/bookingInbox` | Job inbox: requested bookings on my vehicles + open requests | transporter | `/transport/bookings` |
| `/dashboard/p/transporterProfile` | Business profile + stats | transporter | `/transport/profile` |
| `/dashboard/p/biltyView` | Bilty lookup by trip (input trip id → LR view) | transporter | `/bookings/{id}/bilty` |
| `/dashboard/p/liveTracking` | Track a trip: last ping + waypoint log (trip selector) | both | `/bookings/{id}/location` |
| `/dashboard/p/settlements` | Weekly settlements list (transport tab) | transporter | `/transport/settlements` |

Reuse: `ToolShell`, `StatusPill` (new transport statuses), `Timeline` (render `waypointsLog`), `ConfirmSheet`, `EmptyState`, `QuantityStepper`, `PriceWithBenchmark`→fare-breakdown card, chat pages (generalized), notification inbox + bell (already live).

---

## 5. Userflow

### 5.0 Shared preconditions
- Registered/onboarded; `linkedProfiles` include `farmer` and/or `transport`; profile activation is automatic via `ensureProfile`.
- Notification bell + inbox already live (4 transport events today, more after §3.3).

### 5.1 MASTER FLOW A — Farmer (book a vehicle)

```
Dashboard (farmer)
   │
   ├─► [A1] Post a Load (wizard, 3 steps)
   │     Step 1: what — produce type chips (crop/livestock/equipment), crop name,
   │             quantity + unit, packaging, perishable flag
   │     Step 2: where & when — pickup (village/pin), drop, date + time window,
   │             preferred vehicle type (catalog chips with capacity)
   │     Step 3: price path — pick ONE:
   │             • Instant quote  → fare-estimate card (breakdown) → POST /bookings
   │             • Open auction   → target fare → POST /loads
   │     → live on the load board / instant booking created
   │
   ├─► [A2] Auction: bids arrive → notification per bid
   │     Load detail: bids sorted by fare (₹) — each card: transporter first name,
   │     rating, vehicle type, ETA · 💬 chat chip · Accept (ConfirmSheet) → booking
   │
   ├─► [A3] Track the trip (trip page): timeline from waypointsLog
   │     requested → accepted → enRoute → delivered
   │     (milestones: at_pickup, loaded, weighbridge, in_transit, unloading)
   │     · 💬 booking chat (post-acceptance)
   │     · cancel (requested/accepted only) with reason
   │
   └─► [A4] Delivery: POD card (photos, receiver) → inspect →
         Rate transporter (1–5 + review) [unlocked on delivered]
```

### 5.2 MASTER FLOW B — Transporter (earn from trips)

```
Dashboard (transport persona) → Transport Home (metrics: vehicles, active trips,
lifetime earnings, rating) 
   │
   ├─► [B1] Fleet setup (first run): add vehicle — type (catalog chip), reg no,
   │     capacity, permit, insurance/expiry dates, driver name → docStatus verified
   │     (§3.2) · availability dates · calendar
   │
   ├─► [B2] Find work: Load board (open loads: crop, qty, route, date, fare) +
   │     Job inbox (instant bookings matching my vehicle type)
   │     ├─ Bid on load: fare (bid sheet shows fare-estimate helper), vehicle, ETA
   │     │   → farmer may accept → notification booking_confirmed
   │     └─ Accept instant booking: pick verified vehicle → status accepted
   │         → 💬 booking chat unlocks
   │
   ├─► [B3] Run the trip (trip page, one-tap primary button per state):
   │     accepted ──► enRoute (vehicle assigned)
   │        · milestone pings: at pickup → loaded → weighbridge (slip photo)
   │        · location pin taps (manual, no telematics)
   │     enRoute ──► delivered = POD: photos + receiver name (required)
   │        · expenses logged along the way (diesel/toll/bata…)
   │
   ├─► [B4] Money: trip P&L (fare − expenses − commission) · weekly settlements
   │     (10%) · analytics · bilty per trip
   │
   └─► [B5] Reputation: ratings received (provider_ratings), on-time stats
```

### 5.3 Booking state → UI action map

| Status | Farmer sees | Transporter sees |
|---|---|---|
| `requested` | Cancel · watch for acceptance | **Accept** (pick vehicle) / Decline with reason |
| `accepted` | Trip card: vehicle + driver first name · 💬 chat · Cancel (reason) | **Mark en route** · 💬 chat · milestones enabled |
| `enRoute` | Live timeline · last location ping | **Milestone pings** · weighbridge · expenses · **Mark delivered (POD)** |
| `delivered` | POD card · **Rate transporter** · trip summary | Trip P&L · expenses total · settlement queued |
| `cancelled` | Terminal card + reason | Terminal card + reason |

---

## 6. Frontend architecture

### 6.1 New API module
```
src/lib/api/transport.ts   — typed wrappers:
  vehicleCatalog(), myVehicles(), createVehicle(), updateVehicle(), deleteVehicle(),
  vehicleCalendar(id), setAvailability(id, dates),
  transporterProfile(), updateTransporterProfile(),
  fareEstimate(), createBooking(), transportBookings(status?), getBooking(id),
  updateBookingStatus(id, status, extras), acceptBooking(id, payload), rejectBooking(id, reason),
  openLoads(), createLoad(), loadBids(id), placeBid(id, payload), acceptBid(loadId, bidId),
  pingLocation(id, payload), tripLocation(id), weighbridge(id, payload),
  addExpense(id, payload), tripExpenses(id), bilty(id), transportAnalytics(), transportSettlements()
```
Types mirror the doc shapes in §1.2 (`TransportBooking`, `OpenLoad`, `LoadBid`, `OwnerVehicle`, `FareEstimate`, `TripExpense`, `SettlementDoc`…).

### 6.2 New components (extend `components/trade/` patterns)
| Component | Purpose |
|---|---|
| `TransportShell` | reuse `ToolShell` unchanged |
| `FareBreakdownCard` | base + per-km + labour + toll rows (from `/fare-estimate`) |
| `MilestoneButtons` | context-aware next-milestone ping row |
| `PodForm` | photos (Firebase Storage) + receiver name (+ optional damage notes) |
| `VehicleCard` | type, reg no, capacity, availability chips, docStatus badge |
| `BidCard` | transporter first name, rating, vehicle, ETA, fare, 💬 chat chip |

`StatusPill` gains: `requested, accepted, enRoute, delivered, open, booked, verified, pending`.
`Timeline` renders `waypointsLog` entries directly (shape: `{waypoint, label, time}`).

### 6.3 New views (`views/transport/`)
```
TransportHome.tsx        (transporter dashboard board — real metrics, mirrors SellerHomeBoard)
LoadBoardPage.tsx        (open loads list + filters + post CTA)
LoadForm.tsx             (3-step wizard, draft-backed)
LoadDetailPage.tsx       (bids + accept-bid / bid sheet)
TripPage.tsx             (command center — the heart of the module)
FleetPage.tsx            (vehicles)
VehicleForm.tsx
VehicleCalendarPage.tsx
JobInboxPage.tsx         (requested bookings → accept/decline)
TransporterProfilePage.tsx
BiltyPage.tsx
LiveTrackingPage.tsx
```
Plus: extend `views/dashboard/…` or the existing `MyBookings` placeholder with a **My Trips** section (farmer's `GET /users/me/bookings` transport rows), wire every view into `TRADE_PAGES`-style registry (new `TRANSPORT_PAGES` map in `views/transport/index.ts`, merged into `ToolPage` lookup), add deep routes in `App.tsx`, register `ensureProfile` gating (`transport` / `farmer`).

### 6.4 i18n & styling
- All strings `t()`; keys grouped `tr_*`; **en + hi complete at merge time**; register in `en.trade.ts`-style merge files (`en.transport.ts` / `hi.transport.ts`) — the locale registry already merges.
- Reuse `trade.css` classes + add `transport.css` only for fare-breakdown + milestone button rows.

---

## 7. Implementation phases

**Phase 0 — Backend prerequisites (§3):** transport chat rooms + unlock notifications; vehicle `docStatus` fix; milestone notifications; farmer cancel; commission alignment. *(Web proceeds against stubs if delayed, but chat/trip experience depends on 3.1–3.3.)*

**Phase 1 — Core booking loop (both personas):**
1. `transport.ts` API module + types.
2. Farmer: Post-a-Load wizard (instant-quote path first) + My Trips list.
3. Transporter: fleet CRUD + availability + vehicle catalog chips.
4. Job inbox (accept/decline with vehicle picker) + load board.
5. `TripPage` v1: timeline + status actions + fare breakdown.
- *Exit check: farmer posts an instant booking → transporter accepts with a vehicle → enRoute → delivered with POD → farmer rates.*

**Phase 2 — Auction + chat:**
6. Open-auction path: create load → bid sheet → bids list → accept-bid.
7. Transport chat rooms (after Phase 0.1): room pages + chat chips at every intersection (load cards, bids, trip page) + `chat_unlocked` notifications.
8. Milestone notifications wired (Phase 0.3) — bell shows trip events.
- *Exit check: auction end-to-end; chat on both booking kinds; notifications for accept/enRoute/delivered.*

**Phase 3 — Money & paperwork:**
9. Expenses (add/list) + trip P&L card; settlements page; analytics page.
10. Weighbridge slip form (photo); bilty view; live-tracking page (ping + waypoint log); vehicle calendar.
- *Exit check: full trip P&L matches settlement math (10%); bilty renders; calendar shows assigned trips.*

**Phase 4 — Polish:** i18n sweep (en/hi), skeletons, empty states, error matrix pass, CSV export for settlements/expenses (client-side helper already exists), verification checklist below.

---

## 8. Error & edge-case handling (UI contract)

| Case | Backend signal | UI behavior |
|---|---|---|
| Invalid transition | 409 `ILLEGAL_TRANSITION` | hide the action (state-driven UI prevents most); toast `actionFailed` |
| Unverified vehicle on accept | 422 (vehicle gate) | vehicle picker disables non-verified vehicles with hint |
| POD incomplete | 422 `POD_REQUIRED` | inline errors under photos/receiver fields |
| Already rated | 409 `ALREADY_RATED` | show read-only rating |
| Own listing bid/chat | 400/403 `OWN_*` | hide actions on own listings |
| Role drift | 403 `FORBIDDEN_ROLE` | `ensureProfile` self-heal + one retry (pattern already in trade) |
| Demo-load seeding | first `/loads` call seeds 4 demo loads | treat as normal data; label seeded demo loads distinctly if `isDemo` flag present |
| Cancel reason too short | 422 (reason ≥3 chars) | inline validation |
| Load already booked | 409 on accept-bid | toast + refresh bids |

---

## 9. Compliance mapping (spec not-to-do list → web reality)

| Rule | How the web app honors it |
|---|---|
| No phone/contact sharing (F17/T15) | **Never render `farmerPhone` / `transporterPhone` / `driverPhone`**; bilty hardcoded numbers are shown as masked `•• •••` in the UI; no contact cards anywhere |
| Chat locked pre-booking (S5/D.1) | Load-level negotiation chat only between bidder and load owner within the bid context; booking chat unlocks on acceptance — mirrors the trade module's model |
| No VoIP / voice / video (T16) | text + image only |
| No SOS / help section (F18/S17) | booking-scoped cancel/dispute-entry only |
| No telematics / continuous GPS (S16) | manual one-tap location pins only |
| Payments in-platform (S4) | transport payments are out of scope (§11) — UI never invents payment links |

---

## 10. Verification checklist (end-to-end, real backend)

- [ ] Farmer: post instant-quote booking → fare breakdown matches `/fare-estimate`
- [ ] Transporter: fleet CRUD; availability dates stick; calendar shows assigned trips
- [ ] Transporter: accept instant booking with verified vehicle → farmer gets `booking_accepted` notification
- [ ] Transporter: enRoute ping → farmer notified; waypointsLog grows; timeline renders
- [ ] Weighbridge slip with photo → recorded; farmer notified
- [ ] Delivered without POD → 422; with photos + receiver → delivered; farmer notified
- [ ] Farmer rates transporter on delivered (1–5 + review) → provider_ratings updated; 409 on second attempt
- [ ] Auction: post load → 2 transporters bid → bids sorted by fare → accept-bid → booking born accepted → both notified
- [ ] Chat: booking chat unlocks on accept; load negotiation chat between owner and bidder; both read-only after terminal
- [ ] Cancel paths: transporter reject (reason), farmer cancel (reason) → counterpart notified
- [ ] Trip P&L math: grossFare − expenses − 10% commission == settlement figure
- [ ] Settlements list renders weekly docs; CSV export downloads
- [ ] Bilty renders LR fields; phones masked
- [ ] Phone fields never rendered (grep-level check: no component binds `farmerPhone/transporterPhone/driverPhone`)
- [ ] `pnpm build` clean; en + hi strings complete

---

## 11. Out of scope — spec features with no backend (do NOT build UI for these)

| Spec feature | Backend status | Note |
|---|---|---|
| Escrow / payments / wallet for transport (F10/S4/S12) | none — fare is a number | Present fare transparently; never imply money is held |
| OTP-verified POD + farmer countersign (F8 full) | no OTP service for transport | POD = photos + receiver name |
| Bid counter-offers (F4) | none (produce-offer counters only) | bids are one-shot |
| Transporter discovery directory (F5) | no list-transporters endpoint | transporters surface via bids only |
| Damage dispute module (F9/S8) | none | `pod.damageNotes` is free text |
| Cancellation penalties / strikes / no-show engine (T11/S9, E1–E4) | none | cancel is free-text reason only |
| Booking photos at creation (F2) | `CreateBookingRequest` has no photos | wizard omits photo step |
| Load templates / recurring bookings (F12), fare-trend calendar (F14), return-load matching (T12), fuel estimator (T13), driver sub-users (T14), dynamic surge pricing (S11), SMS fallback (S6), multi-drop (F15) | none | future backend work |

---

## 12. Risks & open questions

1. **Vehicle verification policy (§3.2)** — needs a product decision; recommend auto-verify at creation.
2. **Commission 5% vs 10%** — must be aligned before Phase 3 or the trip P&L and settlements will visibly disagree.
3. **Demo loads auto-seed** on first `/loads` call — fine for dev; ensure staging/prod seeding is intentional.
4. **Analytics hardcoding** (`rating 4.8`, `onTimeRate 97.4%`) — the web renders what the API returns; flag to backend for real computation.
5. **`GET /transport/bookings` is transporter-only** — farmer trip list must go through `/users/me/bookings` + `/transport/bookings/{id}` (detail is viewer-gated, verified).
6. **Chat room shape for transport** — decision needed on whether load-level negotiation chat is a 4th room kind or reuses `direct`; recommend `kind: 'transport'` on booking rooms + reuse `direct` for owner↔bidder chatter, to keep the room-kind enum small.

---

## 13. Implementation log (2026-10-01) — backend + frontend delivered

### Backend changes (plan §3, all verified end-to-end)
| Change | Where |
|---|---|
| Vehicles auto-`verified` at creation (dead-lock fix; `docReview: "pending"` preserved for the UI badge) | `transport.py` create_vehicle |
| Commission aligned to **10%** (`TRANSPORT_COMMISSION_RATE`, used by trip P&L + analytics — matches settlements service) | `transport.py` |
| Chat rooms for trips: `kind: "transport"` created on accept **and** accept-bid; `chat_unlocked` notification to both parties; chat router serves the kind (read-only on `delivered`/`cancelled`); message deep links | `services/chat.py`, `routers/chat.py`, `routers/transport.py` |
| Milestone notifications: `trip_enroute`, `trip_delivered`, `trip_milestone` (at_pickup/loaded/unloading pings only — position pings stay silent), `weighbridge_recorded` | `transport.py` |
| Farmer-side cancel: `POST /transport/bookings/{id}/cancel` (booker, from requested/accepted, reason; notifies transporter) | `transport.py` |

### Verification (real backend, all passing)
Instant-quote booking → job board → accept with auto-verified vehicle → chat room + `chat_unlocked` → enRoute/pings/weighbridge/delivered all notify the farmer → POD gate 422 without photos → room read-only after terminal → rating on delivered + 409 on double-rate → trip P&L at 10% → auction: load → bid → accept-bid → booking born accepted + room → farmer cancel + transition guard. Farmer `/users/me/bookings` transport tab live; rooms list shows `transport` kind.

### Frontend delivered
- `lib/api/transport.ts` — fully typed module (~50 wrappers). **Phone fields deliberately omitted everywhere** (compliance rule §2.4; BiltyPage masks any phone-shaped string).
- 14 views under `views/transport/`: LoadBoard, 3-step LoadForm wizard (draft-backed via `stores/transport.ts`), LoadDetail (bids + accept-bid / bid sheet), MyTrips (farmer), Fleet + VehicleForm + availability picker, JobInbox (accept w/ verified-vehicle picker, decline w/ reason), **TripPage** (timeline from `waypointsLog`, milestones, weighbridge, POD, expenses + P&L, cancel, rate), Settlements, TransporterProfile, Bilty, LiveTracking (30s refresh + one-tap ping), VehicleCalendar, TransportHomeBoard (dashboard metrics).
- Wiring: `TRANSPORT_PAGES` registry in ToolPage, deep routes in App.tsx, ChatRoomPage 4th kind (`transport`, teal), TransportHomeBoard on the transport dashboard, `StatusPill`/`Timeline` extended, complete en + hi dictionaries (`en.transport.ts` / `hi.transport.ts`).
- Every mutating action self-heals `FORBIDDEN_ROLE` via `ensureProfile` + one retry; transporter pages gate on `ensureProfile('transport')`, farmer pages on `'farmer'`.
- `pnpm build` clean; analytics field names aligned to the real endpoint (`totalVehicles/totalTripsCompleted/activeTripsCount/totalGrossRevenue`).

### Known remaining gaps (unchanged from §11)
Transport escrow/payments, OTP-POD + farmer countersign, bid counter-offers, transporter directory, damage-dispute module, penalty/strike engine, booking-creation photos, load templates, return-load matching, driver sub-users, surge pricing, SMS fallback. Settlements populate when the weekly cron (`POST /jobs/settlements/run`) runs. Analytics `onTimeDeliveryPct`/`averageRating`/`fleetUtilizationRate` remain backend-hardcoded — flag for a future real-computation pass.
