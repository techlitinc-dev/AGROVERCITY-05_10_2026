# 04 — Persona × Screen Matrix

Six personas. One account can link several; exactly one is active at a time. The farmer is the super-user (access to all modules). The route access-control matrix below mirrors `flutter-prototype/lib/state/profile_routes.dart` and **must** be enforced both in the Flutter navigation guard (`apps/mobile/lib/core/routes.dart`) and server-side (`backend/app/core/deps.py: require_roles`).

## 1. Persona Homes

| Persona | Enum | Home route | Metric pills (dashboard payload) | Quick actions |
|---|---|---|---|---|
| Farmer | `farmer` | `home` | weather, coins, urgent task | transport, mandi, chat, loan |
| Farm Landlord | `farmLandlord` | `landlordHome` | acres owned, tenants, rent/month | 7/12 records, schemes, rent P&L, marketplace |
| Transporter | `transport` | `transportHome` | vehicles, trips today, daily freight | post-harvest logistics, orders, vehicle loan, Gyan Hub |
| Seller / Vyapari | `seller` | `sellerHome` | turnover, stock (q), buyers | live mandi rates, buyer directory, P&L, marketplace |
| Equipment Owner | `equipmentRental` | `equipmentOwnerHome` | machines, booked hrs, weekly income | slot hub, machinery loan, P&L/maintenance, Krishi Ratna |
| Broker / Dalal | `broker` | `brokerHome` | active deals, leads, commission | buyer directory, mandi trends, commission P&L, finance |

Dashboard data: `GET /users/me/dashboard/{profileType}` (base spec §2).

## 2. Prototype Module Access Matrix

✅ = accessible; — = hidden (module fully hidden, enforced at guard + API ACL).

| Module route | Farmer | Landlord | Transporter | Seller | Equip. Owner | Broker |
|---|---|---|---|---|---|---|
| `home` (farmer dashboard) | ✅ | — | — | — | — | — |
| `mandi` | ✅ | — | — | ✅ | — | ✅ |
| `marketplace` | ✅ | ✅ | ✅ | ✅ | — | — |
| `buyers` (contracts + vehicle booking) | ✅ | — | — | ✅ | — | ✅ |
| `advisory` | ✅ | — | — | — | — | — |
| `profitLoss` | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| `water` | ✅ | — | — | — | — | — |
| `schemes` | ✅ | ✅ | — | — | — | — |
| `finance` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `womenFarmer` | ✅ | — | — | — | — | — |
| `fpo` | ✅ | — | — | — | — | — |
| `equipment` | ✅ | — | — | — | ✅ | — |
| `landLegal` | ✅ | ✅ | — | — | — | — |
| `climate` | ✅ | — | — | — | — | — |
| `postHarvest` | ✅ | — | ✅ | ✅ | — | — |
| `treePlantation` | ✅ | ✅ | — | ✅ | — | — |
| `liveChannels` | ✅ | — | ✅ | — | ✅ | ✅ |
| `agriNews` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `livestockDairy` | ✅ | — | — | ✅ | — | — |
| `farmDiary` | ✅ | ✅ | — | — | — | — |
| `referEarn` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `krishiRatna` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gyanHub` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `cropInsurance` | ✅ | ✅ | — | — | — | — |

## 3. New Manage Screens per Persona (gap analysis)

From `overview/03-gap-analysis-new-screens-and-endpoints.md` Part A.

| Persona | New screen | Route | Primary endpoints |
|---|---|---|---|
| Farmer | Farm plot manage | `farmPlotManage` | `/farm/plots` CRUD |
| Farmer | Crop cycle manage | `cropCycleManage` | `/farm/crop-cycles` CRUD |
| Transporter | Vehicle manage | `vehicleManage` | `/transport/vehicles` CRUD, `/transport/vehicles/my` |
| Transporter | Vehicle calendar | `vehicleCalendar` | `/transport/vehicles/{id}/calendar`, `.../availability` |
| Transporter | Trip detail | `tripDetail` | `GET/PATCH /transport/bookings*` |
| Equipment Owner | Machine manage | `machineManage` | `POST/PUT/DELETE /equipment*`, `/equipment/owner/fleet` |
| Equipment Owner | Slot calendar manage | `slotCalendarManage` | `GET /equipment/{id}/slots`, `PUT .../slot-templates` |
| Seller | Rate post | `ratePost` | `/seller/rates` POST/GET-my/PUT/DELETE |
| Seller | Inventory manage | `inventoryManage` | `/seller/inventory` CRUD |
| Seller | Sales entry | `salesEntry` | `/seller/sales` GET/POST |
| Landlord | Plot manage | `plotManage` | `/land/plots` CRUD |
| Landlord | Lease manage | `leaseManage` | `/land/leases` CRUD |
| Landlord | Rent tracking | `rentTracking` | `/land/leases/{id}/payments` GET/POST, `.../remind` |
| Broker | Deal manage | `dealManage` | `/broker/deals` CRUD |
| Broker | Lead manage | `leadManage` | `/broker/leads` CRUD |
| Broker | Commission ledger | `commissionLedger` | `/broker/commissions` GET/POST/PUT |
| Marketplace buyers¹ | Order tracking | `orderTracking` | `GET /orders/{id}` |
| All | My bookings (aggregated) | `myBookings` | `GET /users/me/bookings` |

¹ `farmer`, `farmLandlord`, `transport`, `seller` (the marketplace ACL).

## 3b. Additional Screens from the missing.md Audit (Part C of overview/03)

Second-round gap audit (`missing.md` at repo root). Same guard + ACL rules as §3; P2 screens marked ² are post-v1 and out of the 15-day scope.

| Persona | New screen | Route | Primary endpoints |
|---|---|---|---|
| Farmer | Global search results | `searchResults` | `GET /search` |
| Farmer | Weather detail (7-day) | `weatherDetail` | `GET /weather/forecast` |
| Farmer | Farm tasks (Today's Action engine) | `farmTasks` | `/tasks/today`, `/tasks`, `POST /tasks/{id}/complete|snooze` |
| Farmer | Sell-produce (my lots) | `sellProduce` | `/market/lots` CRUD, `/market/lots/my` |
| Farmer | Soil-test booking | `soilTests` | `POST /soil-tests/book`, `GET /soil-tests/my` |
| Farmer | Cold-storage booking (sheet on `postHarvest`) | — | `POST /post-harvest/cold-storage/{id}/book` |
| Farmer | Mandi price history chart | `mandiPriceHistory` | `GET /mandi/prices/history` |
| Farmer | Claim appeal/resubmit (on insurance tracker) | — | `POST /insurance/claims/{id}/appeal` |
| Farmer | Loan tracking (section in `finance`) | `loanTracking` | `GET /finance/loans` |
| Farmer | FPO discover & join | `fpoDiscover` | `GET /fpo/nearby`, `POST /fpo/{id}/join-request` |
| Farmer | Land browse (rent land near me) | `landBrowse` | `GET /land/listings`, `POST /land/listings/{id}/lease-requests` |
| Farmer | My lease requests | `myLeaseRequests` | `GET /land/lease-requests/my` |
| Farmer | Sowing-intent sheet (on `advisory`) | — | `POST /advisory/sowing-intent` |
| Farmer | Profile edit | `profileEdit` | `PUT /users/me` |
| Farmer² | Active sessions | `sessions` | `GET/DELETE /auth/sessions` |
| Farmer² | Data export | — (settings section) | `GET /users/me/export` |
| Landlord | Land listings manage | `landListings` | `/land/listings` CRUD, `/land/listings/my` |
| Landlord | Lease-request inbox | `leaseRequests` | `/land/lease-requests`, `.../{id}/accept|reject` |
| Landlord | Lease agreement PDF + e-sign (on `leaseManage`) | — | `GET /land/leases/{id}/agreement-pdf`, `POST .../sign` |
| Transporter | Booking-request inbox | `bookingRequests` | `POST /transport/bookings/{id}/accept|reject` |
| Transporter | POD capture (sheet on `tripDetail`) | — | `PATCH /transport/bookings/{id}` (podPhotos) |
| Transporter | Settlements & payouts | `transportSettlements` | `GET /transport/settlements*` |
| Equipment Owner | Booking-request inbox | `equipmentBookingRequests` | `POST /equipment/bookings/{id}/approve|reject` |
| Equipment Owner | Maintenance log | `maintenanceLog` | `/equipment/{id}/maintenance` CRUD |
| Seller | Procurement entry (weighbridge slip) | `procurementEntry` | `POST/GET /seller/procurements`, `.../{id}/mark-paid` |
| Seller | Buyer udhaar ledgers | `buyerLedgers` | `/seller/ledgers*` |
| Broker | Deal room (per-deal chat) | `dealRoom` | `/broker/deals/{id}/messages` |
| Broker | Buyer requirements board | `buyerRequirements` | `/market/requirements` CRUD |
| All (money personas) | Bank accounts manage | `bankAccounts` | `/bank-accounts` CRUD, `.../verify`, `.../primary` |
| All | MPIN re-entry (session expired) | `mpinReentry` | `POST /auth/mpin/reverify` |
| All | Expert handoff thread | `supportThread` | `/support/threads*` |
| All | In-app chat list / thread | `chatList`, `chatThread` | `/chats`, `/chats/{id}/messages` |
| All | Address book | `addressBook` | `/addresses` CRUD |
| All | Consent center (settings section) | `settingsConsent` | `GET/PUT /users/me/consents` |
| All | Splash version gate | — (splash) | `GET /app-config` |

² P2 (deferred to v1.x): sessions list, data export, plus scan history, MSP reference, trip live-tracking, trip expenses, load board, driver management, B2B buyer network, GST invoices, machine GPS, damage reports, EMI tracker, deal negotiation, streaming infra — see Part C §C.9 of overview/03.

## 4. Account-Level Screens — Every Persona

These five screens are available to **all 6 personas** from the account/profile menu:

| Screen | Route | Endpoints | Notes |
|---|---|---|---|
| Notifications | `notifications` | `GET /notifications`, `POST /notifications/read` | persona-filtered inbox |
| Settings | `settings` | `PUT /users/me/settings`, `POST/DELETE /devices` | language, women mode, high contrast, push prefs |
| Help & Support | `helpSupport` | `POST /chatbot/handoff` | FAQ + Kisan Mitra + helpline |
| Account Delete | `accountDelete` | `DELETE /users/me` | MPIN confirm; Play Store requirement |
| My Bookings | `myBookings` | `GET /users/me/bookings` | aggregated; content varies by persona |

## 5. Chatbot & Cross-Cutting Surfaces

Available on every screen regardless of persona:

| Surface | Where | Endpoints |
|---|---|---|
| Kisan Mitra FAB → chat sheet | global | `POST /chatbot/messages`, `GET /chatbot/history` |
| Voice assistant sheet | global | `POST /chatbot/messages` with `audioUrl` (Sarvam STT) |
| Offline sync pill | global | `POST /sync` |
| All Tools bottom sheet | global | local; filters by access matrix §2 |

## 6. Navigation Guard Rule (implementation note)

`apps/mobile/lib/core/routes.dart` holds `Map<String, Set<ProfileType>> routeAccess` — copy the matrix in §2 verbatim plus the new screens in §3–§4. The guard reads `AppState.activeProfile`; inaccessible routes are hidden from All Tools and the tools grid, and direct navigation attempts no-op with a Hindi toast. The backend enforces the identical ACL in `require_roles(...)` per endpoint — the `Roles` column in `endpoints.md` and the gap-analysis doc is the source of truth.
