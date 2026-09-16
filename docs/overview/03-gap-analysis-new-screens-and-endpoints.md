# 03 — Gap Analysis: New Screens & Endpoints

> **This document is the authoritative extension of `endpoints.md` / `endpoints.json`.**
> The base API spec covers everything the prototype's `AppState` already calls. The prototype
> is **missing** the manage/CRUD surfaces below (the prototype shows dashboards and lists, but
> there is no UI or endpoint for a seller to post a rate, a transporter to add a vehicle, etc.).
> Every endpoint defined here is exactly as binding as `endpoints.md`: field names, methods,
> paths, and envelopes must not be changed. All conventions from
> `conventions/02-api-conventions.md` apply (Bearer JWT, `Idempotency-Key` on writes, pagination
> envelope on lists, error envelope, rupees as integers, ISO-8601 dates).

Two parts:

- **Part A — 22 new Flutter screens**: 18 persona/business manage screens + 4 account-level screens every persona gets.
- **Part B — new backend endpoints**, grouped: transport, seller, landlord, broker, farmer, common (devices/payments/account), admin.

Route names are `camelCase` constants in `apps/mobile/lib/core/routes.dart` and follow the prototype naming style. Persona values in ACLs use the enum from `endpoints.json`: `farmer | farmLandlord | transport | seller | equipmentRental | broker`.

---

## Part A — New Screens

### A.1 Farmer screens

#### 1. Farm Plot Manage — route `farmPlotManage`
- **Persona:** farmer
- **Purpose:** CRUD for the farmer's named plots (a farm may have several plots with different crops/soil); feeds water schedule, diary, P&L, crop cycles.
- **UI elements:** plot list cards (name, area acres, soil type, current crop); add/edit bottom sheet (name, area slider 0.1–25 acres, soil chips, irrigation chips, khasra number field, mini-map with draggable boundary pins); delete with confirm dialog; "set as primary" toggle.
- **Endpoints:** `GET /farm/plots`, `POST /farm/plots`, `PUT /farm/plots/{id}`, `DELETE /farm/plots/{id}`.

#### 2. Crop Cycle Manage — route `cropCycleManage`
- **Persona:** farmer
- **Purpose:** track sowing→harvest cycles per plot; feeds diary/P&L, market-saturation advisory (sowing intent), and insurance.
- **UI elements:** per-plot cycle timeline; add-cycle form (plot dropdown, crop dropdown + custom add, season Kharif/Rabi/Zaid chips, sowing date picker, expected harvest date, expected yield quintals); stage stepper (sown/germinated/vegetative/flowering/harvested); close-cycle action with actual yield entry.
- **Endpoints:** `GET /farm/crop-cycles?plotId=`, `POST /farm/crop-cycles`, `PUT /farm/crop-cycles/{id}`, `DELETE /farm/crop-cycles/{id}`.

#### 3. My Bookings (aggregated) — route `myBookings`
- **Persona:** all (built Day 11; every persona sees their own bookings)
- **Purpose:** single chronological list of everything the user has booked: equipment slots, transport trips, vet visits, workshops, expert talks.
- **UI elements:** filter chips (all / equipment / transport / vet / workshop / talk); booking cards (type icon, title, date/time, status chip, fare/fee); cancel button where rules allow (equipment ≤2 h before); tap → detail of the source module.
- **Endpoints:** `GET /users/me/bookings?type=&status=&page=`; cancel actions call the source endpoint (`DELETE /equipment/bookings/{id}`, `PATCH /transport/bookings/{id}`).

#### 4. Order Tracking — route `orderTracking`
- **Persona:** farmer, farmLandlord, transport, seller (marketplace buyers)
- **Purpose:** live status of a marketplace order after checkout.
- **UI elements:** order header (order id, total, payment method, BNPL schedule if any); status timeline (placed → confirmed → packed → shipped → out-for-delivery → delivered); delivery address card; item list; help CTA → `helpSupport`.
- **Endpoints:** `GET /orders/{id}` (base spec). No new endpoint.

#### 5. Notifications — route `notifications`
- **Persona:** all
- **Purpose:** persona-specific notification inbox (booking reminders, claim updates, rate approvals, coin awards).
- **UI elements:** list (icon, title, body, relative time, unread dot); mark-all-read button; tap deep-links to the relevant module.
- **Endpoints:** `GET /notifications`, `POST /notifications/read` (base spec §20).

#### 6. Settings — route `settings`
- **Persona:** all
- **Purpose:** app preferences.
- **UI elements:** language dropdown (7 languages); women-mode toggle; high-contrast toggle; notification preferences (push on/off per category); linked-profile management entry; logout; app version footer.
- **Endpoints:** `PUT /users/me/settings` (base spec §2); `POST /devices` (register/unregister FCM token when push toggled).

#### 7. Help & Support — route `helpSupport`
- **Persona:** all
- **Purpose:** support entry point.
- **UI elements:** FAQ accordion (static content, localized); "Chat with Kisan Mitra" CTA (opens chatbot sheet); helpline card (phone `tel:` link, WhatsApp deep link); ticket entry = chatbot handoff.
- **Endpoints:** `POST /chatbot/handoff` (base spec §5). No new endpoint.

#### 8. Account Delete — route `accountDelete`
- **Persona:** all
- **Purpose:** Play Store mandatory account deletion.
- **UI elements:** warning card (what gets deleted: profile, bookings, vault documents, coins); MPIN confirm field; reason dropdown (optional); final confirm dialog; on success → cleared state → splash.
- **Endpoints:** `DELETE /users/me` with `{ mpin, reason? }` body.

### A.2 Transporter screens

#### 9. Vehicle Manage — route `vehicleManage`
- **Persona:** transport
- **Purpose:** add/edit/remove own fleet vehicles and their documents.
- **UI elements:** vehicle cards (type, registration no., capacity tonnes, base fare + per-km rate, verified badge); add/edit form (type dropdown Tata Ace/Bolero Maxi/tractor trolley, registration no., capacity, base fare, per-km rate); document upload tiles (RC, insurance — camera/gallery → Storage); delete with confirm.
- **Endpoints:** `GET /transport/vehicles/my`, `POST /transport/vehicles`, `PUT /transport/vehicles/{id}`, `DELETE /transport/vehicles/{id}`.

#### 10. Vehicle Calendar — route `vehicleCalendar`
- **Persona:** transport
- **Purpose:** per-vehicle availability calendar; block dates for maintenance/personal use.
- **UI elements:** vehicle selector chips; month calendar grid (available green / booked blue / blocked gray); tap a date → toggle blocked; booked dates show trip count badge; legend row.
- **Endpoints:** `GET /transport/vehicles/{id}/calendar?month=`, `PUT /transport/vehicles/{id}/availability`.

#### 11. Trip Detail — route `tripDetail`
- **Persona:** transport
- **Purpose:** execute a booked trip: status updates from accepted → delivered.
- **UI elements:** route card (pickup → drop, distance, fare); customer name + masked phone with call button; cargo note; status stepper with big next-action button (Accept → Start trip → Mark delivered / Cancel with reason); fare summary; POD note field at delivery.
- **Endpoints:** `GET /transport/bookings?status=` (list, base spec §7), `PATCH /transport/bookings/{id}` (base spec §7). No new endpoint.

### A.3 Equipment Owner screens

#### 12. Machine Manage — route `machineManage`
- **Persona:** equipmentRental
- **Purpose:** owner CRUD for machines and their pricing.
- **UI elements:** machine cards (photo, name, type, hourly rate / per-acre rate, utilization %, active toggle); add/edit form (name, type dropdown, hourly rate, optional per-acre rate, photo upload, description); delete with confirm (blocked if future bookings exist → shows error toast).
- **Endpoints:** `POST /equipment`, `PUT /equipment/{id}` (base spec §14), plus `DELETE /equipment/{id}` and `GET /equipment/owner/fleet` (base spec) for the list.

#### 13. Slot Calendar Manage — route `slotCalendarManage`
- **Persona:** equipmentRental
- **Purpose:** configure the 4-hour slot templates and per-slot pricing per machine (defaults: 6–10, 10–2, 2–6, 6–10).
- **UI elements:** machine selector; weekly template grid (day × slot); per-slot editor (start/end time pickers, price field, recommended task dropdown, enabled toggle); "apply template to all weekdays" button; live booking overlay (booked slots read-only).
- **Endpoints:** `GET /equipment/{id}/slots?week=` (base spec §14), `PUT /equipment/{id}/slot-templates` (new, below).

### A.4 Seller (Vyapari) screens

#### 14. Rate Post — route `ratePost`
- **Persona:** seller
- **Purpose:** post today's vyapari bhav per crop — **this feeds the "Aaj ke Bhav" dashboard widget** (`GET /mandi/vyapari-rates`).
- **UI elements:** "post today's rate" form (crop dropdown from user's traded crops, mandi dropdown, rate ₹/quintal field, vs-yesterday auto-computed preview); my posted rates list with edit/delete; status chip (pending/approved/rejected — admin moderation).
- **Endpoints:** `POST /seller/rates`, `GET /seller/rates/my`, `PUT /seller/rates/{id}`, `DELETE /seller/rates/{id}`.

#### 15. Inventory Manage — route `inventoryManage`
- **Persona:** seller
- **Purpose:** stock ledger for procured produce (quintals in/out).
- **UI elements:** stock cards (crop, qty quintals, avg buy rate, mandi, last updated); add/edit form; stock-adjust dialog (in/out, qty, note); low-stock threshold field with alert tint.
- **Endpoints:** `GET /seller/inventory`, `POST /seller/inventory`, `PUT /seller/inventory/{id}`, `DELETE /seller/inventory/{id}`.

#### 16. Sales Entry — route `salesEntry`
- **Persona:** seller
- **Purpose:** record a sale against inventory; feeds seller P&L (`/pnl/summary`).
- **UI elements:** quick-entry form (crop from inventory, qty, sale rate, buyer name optional, payment mode cash/UPI/credit chips, date); today's sales list; day-total footer; history list with date filter.
- **Endpoints:** `POST /seller/sales`, `GET /seller/sales?from=&to=`.

### A.5 Landlord screens

#### 17. Plot Manage — route `plotManage`
- **Persona:** farmLandlord
- **Purpose:** CRUD for owned land parcels offered for lease.
- **UI elements:** plot cards (name, village, area acres/Ha, soil, irrigation, status: vacant/leased); add/edit form (+ khasra number, "import from 7/12" button → land records search); delete with confirm.
- **Endpoints:** `GET /land/plots`, `POST /land/plots`, `PUT /land/plots/{id}`, `DELETE /land/plots/{id}`; optional `POST /land-records/{id}/import` (base spec §13).

#### 18. Lease Manage — route `leaseManage`
- **Persona:** farmLandlord
- **Purpose:** create and manage tenant leases on owned plots.
- **UI elements:** lease cards (plot, tenant name/phone, rent ₹/month, start–end dates, verified status); add-lease form (plot dropdown, tenant name + phone, rent, duration months, start date, terms text); end-lease action with confirm; edit for rent/date changes.
- **Endpoints:** `GET /land/leases`, `POST /land/leases`, `PUT /land/leases/{id}`, `DELETE /land/leases/{id}`.

#### 19. Rent Tracking — route `rentTracking`
- **Persona:** farmLandlord
- **Purpose:** monthly rent ledger per lease (the landlord dashboard "₹42k/month" metric).
- **UI elements:** per-lease month grid (paid green / due amber / overdue red); record-payment dialog (month, amount, mode cash/UPI/bank, date, receipt note); totals header (this month received / expected); tenant reminder button (SMS via backend).
- **Endpoints:** `GET /land/leases/{id}/payments`, `POST /land/leases/{id}/payments`, `POST /land/leases/{id}/payments/remind`.

### A.6 Broker screens

#### 20. Deal Manage — route `dealManage`
- **Persona:** broker
- **Purpose:** the broker deal pipeline (dashboard "12 active deals").
- **UI elements:** pipeline columns/chips by status (lead → negotiating → locked → completed → cancelled); deal cards (crop, qty, farmer side, buyer side, rate, commission %); add/edit deal sheet; status advance button.
- **Endpoints:** `GET /broker/deals?status=`, `POST /broker/deals`, `PUT /broker/deals/{id}`, `DELETE /broker/deals/{id}`.

#### 21. Lead Manage — route `leadManage`
- **Persona:** broker
- **Purpose:** farmer/buyer lead list (dashboard "38 farmer leads").
- **UI elements:** lead cards (name, village, crop, qty, type farmer/buyer chip, last-contact date); add/edit form; "convert to deal" action (prefills deal sheet); call/WhatsApp buttons.
- **Endpoints:** `GET /broker/leads`, `POST /broker/leads`, `PUT /broker/leads/{id}`, `DELETE /broker/leads/{id}`.

#### 22. Commission Ledger — route `commissionLedger`
- **Persona:** broker
- **Purpose:** commission earnings ledger (dashboard "₹34,800 commission").
- **UI elements:** month total header; entry list (deal ref, party, amount, status pending/received, date); mark-received action; record manual entry dialog; filter chips (pending/received/all).
- **Endpoints:** `GET /broker/commissions?status=&from=&to=`, `POST /broker/commissions`, `PUT /broker/commissions/{id}` (mark received).

---

## Part B — New Endpoints

### B.1 Transport — vehicle management (transporter)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/transport/vehicles` | Add own vehicle | transport |
| GET | `/transport/vehicles/my` | List own vehicles with verification status | transport |
| PUT | `/transport/vehicles/{id}` | Edit vehicle (rates, capacity, docs) | transport |
| DELETE | `/transport/vehicles/{id}` | Remove vehicle (409 if active/future bookings) | transport |
| GET | `/transport/vehicles/{id}/calendar` | Availability + bookings per day. Query: `month=YYYY-MM` | transport |
| PUT | `/transport/vehicles/{id}/availability` | Block/unblock dates | transport |

**POST `/transport/vehicles`** — request:
```json
{
  "type": "tataAce | boleroMaxi | tractorTrolley | pickup | miniTruck",
  "registrationNo": "MH15AB1234",
  "capacityTonnes": 1.5,
  "baseFare": 500,
  "perKmRate": 28,
  "rcDocumentUrl": "https://storage.../rc.pdf",
  "insuranceDocumentUrl": "https://storage.../ins.pdf"
}
```
Response `201`: the `Vehicle` object:
```json
{
  "id": "veh_9f2c",
  "ownerId": "uid_...",
  "type": "tataAce",
  "registrationNo": "MH15AB1234",
  "capacityTonnes": 1.5,
  "baseFare": 500,
  "perKmRate": 28,
  "verificationStatus": "pending | verified | rejected",
  "isActive": true,
  "createdAt": "2026-09-13T06:30:00Z"
}
```
**PUT `/transport/vehicles/{id}`** — same body, all fields optional. **DELETE** returns `204`; `409` with `{"error":{"code":"VEHICLE_HAS_BOOKINGS",...}}` when future bookings exist.

**GET `/transport/vehicles/{id}/calendar?month=2026-09`** — response:
```json
{
  "vehicleId": "veh_9f2c",
  "month": "2026-09",
  "days": [
    { "date": "2026-09-13", "status": "available | booked | blocked", "bookingCount": 2 }
  ]
}
```

**PUT `/transport/vehicles/{id}/availability`** — request:
```json
{ "dates": ["2026-09-20", "2026-09-21"], "status": "blocked | available" }
```
Response: `{ "updated": 2 }`. `409` (`DATES_HAVE_BOOKINGS`) if blocking a booked date.

### B.2 Seller — vyapari rates, inventory, sales

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/seller/rates` | Post today's rate for a crop (feeds Aaj ke Bhav; enters admin moderation queue) | seller |
| GET | `/seller/rates/my` | My posted rates. Query: `date=YYYY-MM-DD` | seller |
| PUT | `/seller/rates/{id}` | Edit a rate (today's only; re-enters moderation) | seller |
| DELETE | `/seller/rates/{id}` | Withdraw a rate | seller |
| GET | `/seller/inventory` | Stock list. Query: `crop=` | seller |
| POST | `/seller/inventory` | Add stock item | seller |
| PUT | `/seller/inventory/{id}` | Adjust stock (qty in/out, rate) | seller |
| DELETE | `/seller/inventory/{id}` | Remove stock item | seller |
| POST | `/seller/sales` | Record a sale; decrements inventory | seller |
| GET | `/seller/sales` | Sales history. Query: `from=, to=, page=` | seller |

**POST `/seller/rates`** — request / response `201`:
```json
// request
{ "crop": "tomato", "mandiName": "Nashik APMC", "ratePerQuintal": 1850 }
// response
{
  "id": "rate_7ab1", "crop": "tomato", "mandiName": "Nashik APMC",
  "ratePerQuintal": 1850, "priceChange": 50, "changeDir": "up | down | flat",
  "status": "pending | approved | rejected",
  "date": "2026-09-13", "createdAt": "2026-09-13T06:30:00Z"
}
```
Rules: one rate per (seller, crop, mandi, date) — second POST returns `409` (`RATE_ALREADY_POSTED`, use PUT). Only `approved` rates appear in `GET /mandi/vyapari-rates`; approval clears the Redis cache key for that crop (see `schema/redis-keys.md`).

**POST `/seller/inventory`** — request / response `201`:
```json
// request
{ "crop": "onion", "quantityQuintals": 120, "avgBuyRate": 1450, "mandiName": "Pimpalgaon", "lowStockAlertQuintals": 20 }
// response: inventory object with id, createdAt, updatedAt
```
**PUT `/seller/inventory/{id}`** — body:
```json
{ "adjustQuintals": -15, "note": "sold to R. Traders", "avgBuyRate": 1450 }
```
(`adjustQuintals` signed; resulting qty < 0 → `422` `INSUFFICIENT_STOCK`.)

**POST `/seller/sales`** — request / response `201`:
```json
// request
{ "inventoryId": "inv_3cd", "quantityQuintals": 15, "saleRate": 1620, "buyerName": "R. Traders", "paymentMode": "cash | upi | credit", "date": "2026-09-13" }
// response
{ "id": "sale_11x", "inventoryId": "inv_3cd", "quantityQuintals": 15, "saleRate": 1620,
  "totalAmount": 24300, "paymentMode": "upi", "date": "2026-09-13", "createdAt": "..." }
```
Sales feed `/pnl/summary` and `/pnl/crops` for the seller persona.

### B.3 Landlord — plots, leases, rent payments

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/land/plots` | My owned plots | farmLandlord |
| POST | `/land/plots` | Add plot | farmLandlord |
| PUT | `/land/plots/{id}` | Edit plot | farmLandlord |
| DELETE | `/land/plots/{id}` | Remove plot (409 if active lease) | farmLandlord |
| GET | `/land/leases` | My leases. Query: `status=active|ended` | farmLandlord |
| POST | `/land/leases` | Create lease | farmLandlord |
| PUT | `/land/leases/{id}` | Edit/end lease | farmLandlord |
| DELETE | `/land/leases/{id}` | Delete lease (only if no payments recorded) | farmLandlord |
| GET | `/land/leases/{id}/payments` | Rent ledger for a lease. Query: `year=` | farmLandlord |
| POST | `/land/leases/{id}/payments` | Record a rent payment | farmLandlord |
| POST | `/land/leases/{id}/payments/remind` | SMS reminder to tenant for a due month | farmLandlord |

**POST `/land/plots`** — request / response `201`:
```json
// request
{ "name": "Wagholi North", "village": "Wagholi", "district": "Nashik",
  "areaAcres": 3.5, "areaHectares": 1.42, "soilType": "blackCotton",
  "irrigationType": "drip", "khasraNumber": "123/2" }
// response: plot object with id, ownerId, status: "vacant", createdAt
```

**POST `/land/leases`** — request / response `201`:
```json
// request
{ "plotId": "plot_55", "tenantName": "S. Patil", "tenantPhone": "+9198...",
  "rentPerMonth": 14000, "startDate": "2026-10-01", "durationMonths": 11, "terms": "..." }
// response
{ "id": "lease_20", "plotId": "plot_55", "ownerId": "uid_...", "tenantName": "S. Patil",
  "tenantPhone": "+9198...", "rentPerMonth": 14000, "startDate": "2026-10-01",
  "endDate": "2027-08-31", "status": "active", "verified": false, "createdAt": "..." }
```
**PUT `/land/leases/{id}`** — `{ "rentPerMonth"?, "endDate"?, "status"?: "active|ended", "terms"? }`. Setting `status: "ended"` frees the plot (`plot.status` → `vacant`).

**POST `/land/leases/{id}/payments`** — request / response `201`:
```json
// request
{ "month": "2026-10", "amount": 14000, "mode": "cash | upi | bank", "paidOn": "2026-10-03", "note": "" }
// response
{ "id": "pay_81", "leaseId": "lease_20", "month": "2026-10", "amount": 14000,
  "mode": "upi", "paidOn": "2026-10-03", "status": "paid", "createdAt": "..." }
```
One payment per (lease, month): second POST → `409` `PAYMENT_ALREADY_RECORDED`. `GET` returns months of the lease with `status: paid | due | overdue` computed server-side. **Remind** body: `{ "month": "2026-10" }` → `{ "smsSent": true }`.

### B.4 Broker — deals, leads, commissions

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/broker/deals` | Deal pipeline. Query: `status=, page=` | broker |
| POST | `/broker/deals` | Create deal | broker |
| PUT | `/broker/deals/{id}` | Edit / advance status | broker |
| DELETE | `/broker/deals/{id}` | Remove deal | broker |
| GET | `/broker/leads` | Lead list. Query: `type=farmer|buyer` | broker |
| POST | `/broker/leads` | Add lead | broker |
| PUT | `/broker/leads/{id}` | Edit lead | broker |
| DELETE | `/broker/leads/{id}` | Remove lead | broker |
| GET | `/broker/commissions` | Commission ledger. Query: `status=pending|received, from=, to=` | broker |
| POST | `/broker/commissions` | Record manual commission entry | broker |
| PUT | `/broker/commissions/{id}` | Mark received | broker |

**POST `/broker/deals`** — request / response `201`:
```json
// request
{ "crop": "wheat", "quantityQuintals": 200, "ratePerQuintal": 2400,
  "farmerParty": "R. Singh, Sinner", "buyerParty": "Shakti Flour Mill",
  "commissionPercent": 1.5, "leadId": "lead_9" }
// response
{ "id": "deal_31", "brokerId": "uid_...", "crop": "wheat", "quantityQuintals": 200,
  "ratePerQuintal": 2400, "dealValue": 480000, "commissionPercent": 1.5,
  "commissionAmount": 7200, "status": "negotiating | locked | completed | cancelled",
  "farmerParty": "R. Singh, Sinner", "buyerParty": "Shakti Flour Mill", "createdAt": "..." }
```
**PUT `/broker/deals/{id}`** — any of the request fields plus `status`. Status transitions to `completed` auto-create a `pending` commission entry of `commissionAmount`.

**POST `/broker/leads`** — request:
```json
{ "name": "M. Jadhav", "village": "OzAR", "phone": "+9197...", "type": "farmer | buyer",
  "crop": "grape", "quantityQuintals": 40, "notes": "harvest in March" }
```
**PUT `/broker/leads/{id}`** accepts the same fields plus `convertedDealId` (set by "convert to deal").

**POST `/broker/commissions`** — request:
```json
{ "dealId": "deal_31", "party": "Shakti Flour Mill", "amount": 7200, "note": "" }
```
Response: entry `{ id, dealId, party, amount, status: "pending", date, createdAt }`. **PUT `/broker/commissions/{id}`** — `{ "status": "received", "receivedOn": "2026-09-13" }`.

### B.5 Farmer — farm plots & crop cycles

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/farm/plots` | My farm plots | farmer |
| POST | `/farm/plots` | Add plot | farmer |
| PUT | `/farm/plots/{id}` | Edit plot | farmer |
| DELETE | `/farm/plots/{id}` | Remove plot (409 if active crop cycle) | farmer |
| GET | `/farm/crop-cycles` | Cycles. Query: `plotId=, status=active|closed` | farmer |
| POST | `/farm/crop-cycles` | Start a cycle (also counts toward market-saturation aggregates when opted in) | farmer |
| PUT | `/farm/crop-cycles/{id}` | Update stage / close with actual yield | farmer |
| DELETE | `/farm/crop-cycles/{id}` | Remove cycle | farmer |

**POST `/farm/plots`** — request / response `201`:
```json
// request
{ "name": "Plot A", "areaAcres": 2.0, "soilType": "blackCotton", "irrigationType": "drip",
  "khasraNumber": "45/1", "boundaryPoints": [{"lat": 20.0, "lng": 74.7}], "isPrimary": true }
// response: plot object with id, farmerId, currentCrop: null, createdAt
```

**POST `/farm/crop-cycles`** — request / response `201`:
```json
// request
{ "plotId": "fplot_1", "crop": "tomato", "season": "kharif | rabi | zaid",
  "sowingDate": "2026-06-15", "expectedHarvestDate": "2026-10-15", "expectedYieldQuintals": 180 }
// response
{ "id": "cycle_8", "plotId": "fplot_1", "farmerId": "uid_...", "crop": "tomato",
  "season": "kharif", "sowingDate": "2026-06-15", "expectedHarvestDate": "2026-10-15",
  "expectedYieldQuintals": 180, "actualYieldQuintals": null,
  "stage": "sown | germinated | vegetative | flowering | harvested",
  "status": "active", "createdAt": "..." }
```
**PUT `/farm/crop-cycles/{id}`** — `{ "stage"?, "expectedYieldQuintals"?, "status"?: "active|closed", "actualYieldQuintals"? }`. Closing sets `plot.currentCrop = null` and links the cycle to P&L (`/pnl/crops`).

### B.6 Common — devices, account, bookings, payments

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/devices` | Register FCM token for push | all |
| DELETE | `/devices/{token}` | Unregister on logout / push off | all |
| DELETE | `/users/me` | **Delete account (Play Store requirement)** | all |
| GET | `/users/me/bookings` | Aggregated bookings across modules. Query: `type=, status=, page=` | all |
| POST | `/payments/razorpay/order` | Create Razorpay order for a payment intent | all |
| POST | `/payments/razorpay/verify` | Verify Razorpay signature after checkout | all |

**POST `/devices`** — request:
```json
{ "fcmToken": "d9x...", "platform": "android | web", "deviceName": "Redmi 12" }
```
Response `201`: `{ "id": "dev_1", "registeredAt": "..." }`. Same token re-POSTed → `200` (idempotent upsert).

**DELETE `/users/me`** — request:
```json
{ "mpin": "1234", "reason": "no_longer_needed | privacy | other" }
```
Response: `204`. Backend flow: verify MPIN → anonymize PII in `users` (name → "Deleted User", phone → hash) → mark `deletedAt` → delete vault documents from Storage → revoke refresh tokens (Redis) → unregister devices → keep financial records (orders, payments, claims) anonymized per compliance. Errors: `403` `MPIN_INCORRECT`, `409` `ACTIVE_OBLIGATIONS` (open lease as landlord, undelivered order, pending claim) with `fieldErrors.obligations[]` listing what blocks deletion.

**GET `/users/me/bookings?type=&status=&page=`** — response envelope:
```json
{
  "data": [
    { "type": "equipment | transport | vet | workshop | talk",
      "refId": "eqb_12", "title": "Tractor — Morning slot",
      "scheduledAt": "2026-09-14T06:00:00Z", "status": "confirmed",
      "amountRupees": 800, "cancellable": true }
  ],
  "page": 1, "pageSize": 20, "total": 7
}
```

**POST `/payments/razorpay/order`** — request / response:
```json
// request
{ "purpose": "marketplaceOrder | workshop | manureOrder | dairyOrder",
  "refId": "ord_55", "amountRupees": 1250 }
// response
{ "razorpayOrderId": "order_Mx8...", "amountPaise": 125000, "currency": "INR",
  "keyId": "rzp_test_..." }
```
Server converts rupees → paise for Razorpay; the app only ever sees `amountRupees`.

**POST `/payments/razorpay/verify`** — request / response:
```json
// request
{ "razorpayOrderId": "order_Mx8...", "razorpayPaymentId": "pay_N2...",
  "razorpaySignature": "9f2..." }
// response 200: { "verified": true, "purpose": "marketplaceOrder", "refId": "ord_55" }
// response 400: { "error": { "code": "PAYMENT_SIGNATURE_INVALID", "message": "...", "fieldErrors": {} } }
```
Backend recomputes `HMAC_SHA256(razorpayOrderId + "|" + razorpayPaymentId, RAZORPAY_KEY_SECRET)` and constant-time compares; on success marks the referenced entity paid and sends FCM confirmation.

### B.7 Admin (admin console backend)

Admin auth uses Firebase custom claims: backend sets `admin: true` on the admin user's Firebase account (one-time, via script `scripts/make_admin.py`). `POST /admin/login` verifies the Firebase ID token and checks the claim before issuing an admin-scoped JWT.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/admin/login` | Admin login. Body: `{ idToken }` → `{ accessToken, admin: { name, email } }` | public (claim-checked) |
| GET | `/admin/users` | User list. Query: `q=, profile=, status=active|disabled, page=` | admin |
| PUT | `/admin/users/{id}/status` | Enable/disable user. Body: `{ status: "active|disabled", reason }` | admin |
| GET | `/admin/rates/pending` | Vyapari rate moderation queue | admin |
| POST | `/admin/rates/{id}/approve` | Approve rate → live in Aaj ke Bhav + cache invalidate | admin |
| POST | `/admin/rates/{id}/reject` | Reject rate. Body: `{ reason }` | admin |
| GET/POST | `/admin/content/{kind}` | Content CRUD; `kind` = `news|blogs|videos|workshops|schemes` | admin |
| PUT/DELETE | `/admin/content/{kind}/{id}` | Edit/remove content item | admin |
| GET | `/admin/claims` | Insurance claims review. Query: `status=` | admin |
| PUT | `/admin/claims/{id}` | Advance claim stage. Body: `{ status, surveyorName?, surveyorPhone?, approvedAmount?, note }` | admin |
| GET | `/admin/analytics/summary` | Dashboard counters | admin |

**Admin content bodies** — `POST /admin/content/news`:
```json
{ "title": "...", "vernacularTitle": "...", "category": "marketPolicy | weatherAlert | govtSubsidy | agriTech",
  "source": "...", "summary": "...", "content": "...", "isBreaking": false, "audioText": "...", "impactRating": 3 }
```
Other kinds use the entity fields from `endpoints.md` §17/§10 (`blogs` → `BlogArticle`, `videos` → `VideoGuide`, `workshops` → `PaidWorkshop`, `schemes` → `GovtScheme`). All content writes are recorded in `admin_audit` (see `schema/firestore-collections.md`).

**GET `/admin/analytics/summary`** — response:
```json
{
  "totalUsers": 1204, "activeUsers7d": 388, "usersByProfile": { "farmer": 900, "seller": 120 },
  "ordersToday": 17, "gmvTodayRupees": 84500, "pendingRates": 6, "openClaims": 9,
  "equipmentBookingsToday": 22, "chatbotSessionsToday": 51
}
```

Every admin action (login, user status change, rate decision, content write, claim update) appends a doc to `admin_audit` with `{ adminUid, action, targetRef, payload, at }`.

---

## Part C — New Screens (missing.md gap audit, round 2)

> Source: `missing.md` (repo root) — the second user-flow gap audit. Every screen below carries its missing.md item ID (F/L/T/S/E/B/X/A) for traceability to `overview/05-missing-features-traceability.md`. Numbering continues from Part A (screens 1–22). P2 items get compact specs in §C.9. Items marked 📋 in missing.md are already specced in Parts A/B and are not repeated.

### C.1 Farmer screens

#### 23. Referral-code entry in register wizard (F1)
- **Persona:** all (register wizard step 1)
- **Purpose:** capture the inviter's referral code at registration so the +100-coin attribution in `referEarn` works.
- **UI elements:** optional "Have a referral code?" field (uppercase auto-format, e.g. `RAMSINGH2026`) on register wizard step 1 (phone/OTP step); inline validation tick when the code resolves to a name ("Referred by Ram Singh, Sinnar"); skip link.
- **Endpoints:** `POST /auth/register` (base spec) extended with optional `referralCode` field; validation via `GET /referrals/validate?code=` (D.1).

#### 24. MPIN Re-entry (session expired) — route `mpinReentry` (F2)
- **Persona:** all
- **Purpose:** when a `401` (expired access token + dead refresh token) hits any API call, the app must not hard-logout; it offers MPIN re-entry to mint a fresh token pair without redoing OTP.
- **UI elements:** user avatar + masked phone header; 4-digit MPIN field; "use OTP instead" link (full Firebase phone auth fallback); 5 failed attempts → 15-min lockout message (matches `MPIN_LOCKED`); success → returns to the interrupted screen and replays the failed request.
- **Endpoints:** `POST /auth/mpin/reverify` (D.1). Triggered by the Dio token-expiry interceptor, not by navigation.

#### 25. Global Search Results — route `searchResults` (F3)
- **Persona:** all
- **Purpose:** results page behind the home search bar + mic; searches schemes, products, news, crops, and videos in one query.
- **UI elements:** search field with recent-searches chips; result sections (Schemes / Products / News / Crops / Videos) with "see all" per section; empty state with voice-search CTA; result tap deep-links to the module.
- **Endpoints:** `GET /search?q=&lang=` (D.1).

#### 26. Weather Detail — route `weatherDetail` (F4)
- **Persona:** farmer (also linked from landlord home weather pill)
- **Purpose:** 7-day forecast behind the home weather strip; spray-window and severe-weather advice.
- **UI elements:** today card (temp, humidity, wind, rain chance); 7-day horizontal strip; hourly strip for today; spray-window advisory card ("good to spray 6–10 AM, wind < 10 km/h"); severe-alert banner when the district has an active alert; FCM district-alert topic auto-subscribed on first visit.
- **Endpoints:** `GET /weather/forecast?days=7` (D.1).

#### 27. Farm Tasks (Today's Action engine) — route `farmTasks` (F5)
- **Persona:** farmer
- **Purpose:** the real engine behind the home "Today's Action" card: a task list generated from active crop-cycle stages + weather, with completion history.
- **UI elements:** today's task cards (icon, title, why-now line, source chip: crop stage / weather / scheme deadline); mark-done with optional note; snooze to tomorrow; tabs Today / Upcoming / History; home widget shows the top task.
- **Endpoints:** `GET /tasks/today`, `GET /tasks?from=&to=`, `POST /tasks/{id}/complete`, `POST /tasks/{id}/snooze` (D.1). Tasks are materialized from `crop_cycles` stage dates by the daily job (schema doc, jobs table); F8's crop-stage calendar later merges into this engine.

#### 28. Sowing-intent capture sheet (F6)
- **Persona:** farmer (Advisory tab + crop-cycle creation)
- **Purpose:** persist a farmer's sowing intent so the market-saturation advisory has real aggregate data.
- **UI elements:** bottom sheet (crop dropdown, intended area acres slider, intended sowing window month chips, plot dropdown optional); consent checkbox "share anonymously for district saturation advisory" (default off; writes `users.consents.saturationShare` via X17); confirmation toast with coin award.
- **Endpoints:** `POST /advisory/sowing-intent` (D.1).

#### 29. Sell-produce listing (my lots) — route `sellProduce` (F7)
- **Persona:** farmer
- **Purpose:** farmer posts his harvested produce lot for sale; these lots feed broker deal matching (B2) and seller procurement (S3).
- **UI elements:** my-lots list (crop, qty, asking rate, photo, status chip open/matched/sold/withdrawn); add-lot form (crop, qty quintals, expected rate ₹/q — with today's mandi modal shown as reference, harvest date, quality/grade chips, 1–4 photos, pickup location = plot or manual pin); edit/withdraw actions; "offers received" badge linking to broker deal room (B2).
- **Endpoints:** `GET /market/lots/my`, `POST /market/lots`, `PUT /market/lots/{id}`, `DELETE /market/lots/{id}` (D.1).

#### 30. Soil-test booking — route `soilTests` (F9)
- **Persona:** farmer
- **Purpose:** book a soil-health test (also the redemption target of the rewards-store "free soil test"), track collection and lab result.
- **UI elements:** booking form (plot dropdown, sample pickup date, soil depth chips, payment: coins-redemption / free-via-SHC-scheme / paid ₹); my-tests list with status stepper (booked → sample collected → at lab → result ready); result card with PDF download; "book again" CTA.
- **Endpoints:** `POST /soil-tests/book`, `GET /soil-tests/my` (D.1); result PDF uploaded by admin/lab via A-side console.

#### 31. Cold-storage booking (F11)
- **Persona:** farmer (from `postHarvest` warehouse card → book action)
- **Purpose:** reserve capacity at a listed warehouse/cold storage; appears in `myBookings`.
- **UI elements:** booking sheet on the warehouse card (crop, qty quintals, duration weeks stepper, start date, computed price = rate/q/week × qty × weeks); capacity bar with post-booking projection; confirm → booking card; cancellation while status = `requested`.
- **Endpoints:** `POST /post-harvest/cold-storage/{id}/book`, `GET /post-harvest/cold-storage/bookings/my`, `DELETE /post-harvest/cold-storage/bookings/{id}` (D.1).

#### 32. Mandi price history chart — route `mandiPriceHistory` (F13)
- **Persona:** farmer, seller, broker (from `mandi` rate row tap)
- **Purpose:** historical trend for a crop+mandi pair (the "3-year trends" the saturation advisory claims).
- **UI elements:** crop + mandi selectors (prefilled from the tapped row); range chips (30d / 90d / 1y / 3y); line chart of modal price with MSP reference line; min/max/avg summary row; arrivals overlay toggle.
- **Endpoints:** `GET /mandi/prices/history?crop=&mandi=&from=&to=` (D.1).

#### 33. Claim appeal / resubmission (F15)
- **Persona:** farmer (from insurance claim tracker, `rejected` state)
- **Purpose:** a rejected claim is not a dead end: show the rejection reason, photo guidelines, and a resubmit path.
- **UI elements:** rejected-claim card with reason + guidelines overlay (photo dos/don'ts: geotag on, full-field shot, close-up of damage, date visible); "Appeal / resubmit" button → form (new photos picker, free-text appeal note); resubmitted claim returns to `intimated` with `appealOf` link; timeline shows both rounds.
- **Endpoints:** `POST /insurance/claims/{id}/appeal` (D.1).

#### 34. Bank accounts manage — route `bankAccounts` (F16; also L6/S8 landlord & seller payout accounts)
- **Persona:** all (money-consuming personas: farmer, farmLandlord, seller, transport, equipmentRental, broker)
- **Purpose:** verified payout accounts for insurance DBT, loan disbursal, and platform settlements (X10).
- **UI elements:** account cards (bank name, masked account no., IFSC, verified tick, primary star); add form (account no. ×2, IFSC with bank-name autofill, account type); penny-drop verification state machine (verifying → verified / failed with reason); set-primary action; delete with confirm (blocked while referenced by an open claim/loan/settlement → `409`).
- **Endpoints:** `GET /bank-accounts`, `POST /bank-accounts`, `POST /bank-accounts/{id}/verify`, `PUT /bank-accounts/{id}/primary`, `DELETE /bank-accounts/{id}` (D.1).

#### 35. Loan tracking section (F17)
- **Persona:** all (section inside `finance` screen + its own full list route `loanTracking`)
- **Purpose:** status visibility for applications made via `POST /finance/loans/apply` ("under review → approved → disbursed").
- **UI elements:** application cards (loan type, amount, applied date, status stepper, expected disbursal date, bank ref no.); document checklist per status; empty state CTA → apply.
- **Endpoints:** `GET /finance/loans` (D.1).

#### 36. FPO discover & join — route `fpoDiscover` (F19)
- **Persona:** farmer (non-member state of the `fpo` screen)
- **Purpose:** a farmer who is not in an FPO can browse nearby FPOs and request to join instead of seeing a hardcoded "Sahyadri FPO, 420 members".
- **UI elements:** non-member state on `fpo` screen ("You haven't joined an FPO" + discover CTA); nearby list (name, district, member count, crops, distance km, verified badge); FPO detail sheet (about, office-bearer contact, join button); join-request pending state; on approval the `fpo` screen switches to member view.
- **Endpoints:** `GET /fpo/nearby?lat=&lng=`, `POST /fpo/{id}/join-request`, `GET /fpo/my-membership` (D.1).

#### 37. Expert handoff thread — route `supportThread` (F20)
- **Persona:** all (from chatbot handoff card and help & support)
- **Purpose:** after `POST /chatbot/handoff`, the farmer sees the expert's reply inside the app instead of waiting for a phone call.
- **UI elements:** thread list on `helpSupport` (topic, status open/answered/closed, last message); thread screen = simple chat (user + expert bubbles, timestamps, attachment chips); "mark resolved" action; push on expert reply (X3 type `expert_reply`).
- **Endpoints:** `GET /support/threads`, `GET /support/threads/{id}/messages`, `POST /support/threads/{id}/messages` (D.1).

#### 38. Profile edit — route `profileEdit` (F21)
- **Persona:** all
- **Purpose:** edit-form for the fields captured at registration (name, village/tehsil/district, crops, soil, land area, khasra) — wired to the existing `PUT /users/me`.
- **UI elements:** sectioned form (identity / location / farm); crop chips multi-select; soil & irrigation chips; land-area slider; save with dirty-check guard; phone number read-only with "change via OTP" note (out of scope v1).
- **Endpoints:** `PUT /users/me` (base spec §2). No new endpoint.

### C.2 Landlord screens

#### 39. Land listings manage — route `landListings` (L2)
- **Persona:** farmLandlord
- **Purpose:** advertise a vacant plot for lease (the marketplace side of `plotManage`).
- **UI elements:** listing cards (plot name, area, expected rent ₹/month or ₹/acre/season, soil/irrigation chips, status: live/paused/leased, requests count badge); create-from-plot flow (pick a `vacant` plot → rent expectation, lease duration chips 6/11/24 months, terms text, photos); pause/resume/remove actions.
- **Endpoints:** `GET /land/listings/my`, `POST /land/listings`, `PUT /land/listings/{id}`, `DELETE /land/listings/{id}` (D.2).

#### 40. Land browse (farmer side) — route `landBrowse` (L2)
- **Persona:** farmer (from `landLegal` screen and home tools)
- **Purpose:** "land for rent near me" — farmer discovery of `land_listings`.
- **UI elements:** map + list toggle; filter (max rent, min acres, irrigation, district); listing card (area, rent, soil, distance); "Request lease" button → request sheet (intended crop, duration, message) → creates a lease request (L3).
- **Endpoints:** `GET /land/listings?lat=&lng=&maxRent=&minAcres=` (D.2).

#### 41. Lease-request inbox — route `leaseRequests` (L3)
- **Persona:** farmLandlord (inbox) / farmer (my requests list, route `myLeaseRequests`)
- **Purpose:** tenant request → accept/reject flow; accept creates the lease.
- **UI elements (landlord):** request cards (farmer name, village, listing/plot, intended crop, duration, message); accept (→ prefilled `leaseManage` add-form with tenant + terms, submit creates the lease and marks listing `leased`) / reject with reason chips; both notify the farmer.
- **UI elements (farmer):** my-requests list with status chips (pending/accepted/rejected) + deep link to the lease when accepted.
- **Endpoints:** `GET /land/lease-requests` (landlord inbox), `POST /land/listings/{id}/lease-requests` (farmer), `GET /land/lease-requests/my` (farmer), `POST /land/lease-requests/{id}/accept`, `POST /land/lease-requests/{id}/reject` (D.2).

#### 42. Lease agreement PDF & e-sign (L4)
- **Persona:** farmLandlord + farmer (from lease detail card in `leaseManage`)
- **Purpose:** a lease is a real document: server-generated agreement PDF + dual e-sign reusing the contract e-sign pattern.
- **UI elements:** "Agreement" button on lease card → PDF viewer (generated agreement with plot, parties, rent, duration, terms); sign pad for both parties (landlord signs first, tenant countersigns); signed state chip; download/share.
- **Endpoints:** `GET /land/leases/{id}/agreement-pdf`, `POST /land/leases/{id}/sign` (D.2).

#### 43. Rent reminder & overdue badge (L5)
- **Persona:** farmLandlord (no new screen — extends `rentTracking`)
- **Purpose:** automated FCM/SMS reminder on due date + overdue surfacing.
- **UI elements:** overdue red badge on the month grid (already styled); auto-reminder indicator per month ("reminder sent 1 Oct"); manual remind button already specced (A.19) — now backed by the scheduled job so it fires without landlord action.
- **Endpoints:** none new — scheduled job `rent_reminder` (D.2 jobs table) writes `notification_log` and sends FCM/SMS.

### C.3 Transporter screens

#### 44. Booking-request inbox — route `bookingRequests` (T2)
- **Persona:** transport
- **Purpose:** accept/reject incoming `requested` transport bookings — the missing half of the booking flow.
- **UI elements:** request cards (pickup → drop, distance, fare, date, cargo note, booker name, produce-lot chip when `lotId` set — F12); countdown of auto-expiry (requests expire in 24 h); accept button (→ status `accepted`, farmer notified); reject with reason chips (vehicle unavailable / route not served / rate too low / other) → farmer notified; filter pending/past.
- **Endpoints:** `GET /transport/bookings?status=requested` (base spec §7), `POST /transport/bookings/{id}/accept`, `POST /transport/bookings/{id}/reject` (D.3).

#### 45. Proof of delivery capture (T3)
- **Persona:** transport (completion sheet on `tripDetail`)
- **Purpose:** POD evidence at delivery — photos + receiver confirmation.
- **UI elements:** on "Mark delivered": mandatory 1–3 photo capture (goods at drop point), receiver name field, optional receiver-signature pad, POD note field (existing); submit → status `delivered`, photos attached to the booking, visible to the booker.
- **Endpoints:** `PATCH /transport/bookings/{id}` extended with `podPhotos[]`, `receiverName`, `receiverSignatureUrl` (D.3).

#### 46. Settlements & payouts — route `transportSettlements` (T5; pattern shared by E6 owner settlements and B6 commission payouts)
- **Persona:** transport
- **Purpose:** weekly payout cycle visibility: what was earned, platform commission deducted, what was paid out and when.
- **UI elements:** current-cycle card (period, gross freight, commission %, net payable, status `accruing`); history list (period, trips count, gross, commission, net, status pending/approved/paid, paid-on date, UTR/bank ref); bank-account chip (links to `bankAccounts` if none verified); download statement PDF.
- **Endpoints:** `GET /transport/settlements?from=&to=`, `GET /transport/settlements/current` (D.3). Backed by the generic `settlements` collection (X10).

#### 47. Vehicle document-expiry alerts (T7)
- **Persona:** transport (extends `vehicleManage`; no new screen)
- **Purpose:** RC/insurance/fitness expiry reminders before the vehicle gets flagged.
- **UI elements:** expiry date fields in the vehicle add/edit form (insurance, fitness, PUC); amber "expires in N days" / red "expired" banners on vehicle cards; expired docs flip `vehicles.docStatus` to `expired` and hide the vehicle from farmer booking search until renewed.
- **Endpoints:** vehicle CRUD (B.1) extended with `insuranceExpiry`, `fitnessExpiry`, `pucExpiry` fields; scheduled job `doc_expiry_reminder` (D.3 jobs table).

### C.4 Seller screens

#### 48. Rate sanity-band feedback (S2)
- **Persona:** seller (extends `ratePost`; rule is server-side, D.4)
- **Purpose:** guardrails on posted vyapari rates vs Agmarknet modal price.
- **UI elements:** live preview under the rate field showing the allowed band ("Nashik modal ₹1,800 — allowed ₹1,530–₹2,070"); out-of-band submit → inline error from `422 RATE_OUT_OF_BAND`; edit-window countdown chip ("editable for 1h 23m") — after 2 h the edit button disables (`409 RATE_EDIT_WINDOW_PASSED`).
- **Endpoints:** `POST /seller/rates`, `PUT /seller/rates/{id}` (B.2) — validation rule added, no new endpoint.

#### 49. Procurement entry — route `procurementEntry` (S3)
- **Persona:** seller
- **Purpose:** lot-level purchase-from-farmer record with weighbridge slip photo; credits the farmer-side ledger (S4).
- **UI elements:** entry form (farmer phone with lookup-by-name, crop, linked produce lot picker when the farmer listed one (F7), gross/tare/net weight fields or direct quintals, rate ₹/q with today's modal reference, slip photo capture, payment mode cash/UPI/udhaar chips); today's procurement list with running total; edit within same day.
- **Endpoints:** `POST /seller/procurements`, `GET /seller/procurements?from=&to=` (D.4).

#### 50. Pay-farmer tracking (S4)
- **Persona:** seller (mark-paid) + farmer (pending-payment card)
- **Purpose:** every procurement has a payment status; farmer sees "payment pending" — a trust feature.
- **UI elements (seller):** payment-status chip on each procurement (paid/udhaar); "Mark paid" action (mode + date + optional UTR note); udhaar total header.
- **UI elements (farmer):** "Pending payments" card on home/finance when any procurement targeting his phone is `udhaar` (seller name, crop, amount, days pending) — read-only.
- **Endpoints:** `POST /seller/procurements/{id}/mark-paid`; farmer view via `GET /market/lots/my` response extension `pendingPayments[]` (D.4).

#### 51. Buyer udhaar ledger — route `buyerLedgers` (S7)
- **Persona:** seller
- **Purpose:** running credit balance per buyer (credit sales from `salesEntry` with `paymentMode: credit` accrue here).
- **UI elements:** buyer list (name, outstanding ₹, last payment date, aging chip green/amber/red); buyer detail = ledger entries (sale ref, amount, payments, running balance); record-payment dialog; settle-and-close action.
- **Endpoints:** `GET /seller/ledgers`, `GET /seller/ledgers/{buyerKey}`, `POST /seller/ledgers/{buyerKey}/payments` (D.4).

### C.5 Equipment owner screens

#### 52. Equipment booking-request inbox — route `equipmentBookingRequests` (E2)
- **Persona:** equipmentRental
- **Purpose:** private machines create `pending` bookings; the owner approves or rejects (FPO machines auto-confirm, unchanged).
- **UI elements:** pending-request cards (machine, slot date/time, farmer name/village, price, farmer's rating chip); approve (→ `confirmed`, slot locked, farmer notified) / reject with reason chips (→ slot released, farmer notified); auto-expire pending requests 2 h before slot start (banner explains); past tab.
- **Endpoints:** `GET /equipment/bookings?status=pending` (base spec §14), `POST /equipment/bookings/{id}/approve`, `POST /equipment/bookings/{id}/reject` (D.5).

#### 53. Maintenance log — route `maintenanceLog` (E3)
- **Persona:** equipmentRental
- **Purpose:** service history + next-service reminders per machine ("profit & maintenance" quick action target).
- **UI elements:** machine selector chips; log entries (date, type service/repair, description, cost ₹, odometer/engine-hours, receipt photo); add-entry form; next-service-date field per machine → banner "service due in N days" on the machine card; total-maintenance-cost row feeding owner P&L.
- **Endpoints:** `GET /equipment/{id}/maintenance`, `POST /equipment/{id}/maintenance`, `PUT /equipment/{id}/maintenance/{mid}`, `DELETE /equipment/{id}/maintenance/{mid}` (D.5).

### C.6 Broker screens

#### 54. Deal room — route `dealRoom` (B2)
- **Persona:** broker (host), farmer + buyer participants
- **Purpose:** per-deal coordination thread between farmer ↔ broker ↔ buyer; the deal pipeline card (A.20) opens it.
- **UI elements:** header card (crop, qty, rate, status); message thread (text + photo attachments, e.g. weighbridge slip); participant chips; system events inline ("Deal locked", "Document added"); deep-link from deal notifications (X3 type `deal_message`).
- **Endpoints:** `GET /broker/deals/{id}/messages`, `POST /broker/deals/{id}/messages` (D.6). Implemented over the generic chat infra (X2) with `contextType: "brokerDeal"`.

#### 55. Buyer requirements — route `buyerRequirements` (B3)
- **Persona:** broker (browse/match) + seller/large-buyer (post)
- **Purpose:** demand side of the marketplace: buyers post "need 50q onion @ ₹X by 20 Sep"; brokers match against produce lots (F7).
- **UI elements:** requirements board (crop, qty, target rate, needed-by date, buyer, district, status open/matched/expired); post form (seller/broker-on-behalf); "match with lot" action for brokers → prefills deal creation with lot + requirement; my-requirements tab.
- **Endpoints:** `GET /market/requirements?crop=&district=`, `POST /market/requirements`, `PUT /market/requirements/{id}`, `DELETE /market/requirements/{id}` (D.6).

#### 56. Deal documents (B4)
- **Persona:** broker (extends deal add/edit sheet, A.20)
- **Purpose:** attach weight slip, quality report, and payment proof to a deal.
- **UI elements:** documents section on the deal sheet (upload tiles with type chips: weightSlip/qualityReport/paymentProof/other); document thumbnails on the deal-room header card; viewer.
- **Endpoints:** deal CRUD (B.4) extended with `documents[]` field; files via the standard Storage upload flow.

### C.7 Cross-cutting screens

#### 57. In-app chat — routes `chatList`, `chatThread` (X2)
- **Persona:** all (entry from deal room, booking cards, lot offers, and a chat tab)
- **Purpose:** 1:1 messaging between personas (farmer↔broker↔transporter↔seller) for coordination; required alongside report/block (X9) per Play Store UGC policy.
- **UI elements:** chat list (name, persona chip, last message, unread count); thread (text + image messages, read ticks, day separators); blocked state banner; report/block in the overflow menu (X9); messages render via Firestore listener on `chats/{id}/messages` (client reads through the API on web, listener on Android per infra note in D.7).
- **Endpoints:** `GET /chats`, `POST /chats`, `GET /chats/{id}/messages?before=`, `POST /chats/{id}/messages` (D.7).

#### 58. Order cancel & refund status (X5)
- **Persona:** marketplace buyers (extends `orderTracking`, A.4)
- **Purpose:** pre-dispatch cancellation with Razorpay refund.
- **UI elements:** cancel button on order detail while status ∈ {placed, confirmed} (reason sheet: changed mind / wrong address / found cheaper / other); refund status chip once cancelled (`refundInitiated → refunded`, expected 5–7 days note); cancelled orders show refund timeline in status history.
- **Endpoints:** `POST /orders/{id}/cancel`; refund executed server-side via `POST /payments/razorpay/refund` (D.7).

#### 59. Address book — route `addressBook` (X6)
- **Persona:** marketplace buyers
- **Purpose:** saved delivery addresses replacing the raw `deliveryAddress` string at checkout.
- **UI elements:** address cards (label home/farm/other, line, village, district, pincode, phone, default star); add/edit form with pincode → district autofill; picker sheet in checkout (default preselected); selected address serializes into `orders.deliveryAddress` for backward compatibility.
- **Endpoints:** `GET /addresses`, `POST /addresses`, `PUT /addresses/{id}`, `DELETE /addresses/{id}` (D.7).

#### 60. Product review submission (X7)
- **Persona:** marketplace buyers (from `orderTracking` delivered items and product detail)
- **Purpose:** users can actually submit the ratings products display.
- **UI elements:** rate-this-item sheet per delivered order item (stars, optional text ≤280, optional photo); my-reviews list on product detail; edit own review within 48 h.
- **Endpoints:** `POST /products/{id}/reviews`, `GET /products/{id}/reviews?page=`, `PUT /products/{id}/reviews/{rid}` (D.7). Aggregate `products.rating`/`reviewsCount` recomputed server-side.

#### 61. Service rating sheet (X8)
- **Persona:** all (after any completed booking: transport, equipment, vet, workshop, talk)
- **Purpose:** rate the service provider; feeds provider cards and the transporter/equipment inbox chips.
- **UI elements:** post-completion sheet (stars, quick tags: on-time/careful/rude…, optional comment); shown once per booking; provider detail shows aggregate.
- **Endpoints:** `POST /ratings`, `GET /ratings/summary?targetType=&targetId=` (D.7).

#### 62. Report & block (X9)
- **Persona:** all (overflow menu on chat threads, deal rooms, provider cards; blocked list in `settings`)
- **Purpose:** Play Store UGC policy requirement once chat ships.
- **UI elements:** "Report" sheet (reason chips: spam/abuse/fraud/inappropriate/other + free text); "Block" confirm dialog; settings → "Blocked users" list with unblock; blocked users cannot open chats with the blocker and their messages are hidden.
- **Endpoints:** `POST /users/{id}/report`, `GET /users/me/blocks`, `POST /users/me/blocks`, `DELETE /users/me/blocks/{uid}` (D.7); admin side A6.

#### 63. Consent center — settings section (X17)
- **Persona:** all (screen section inside `settings`, route anchor `settingsConsent`)
- **Purpose:** user-visible privacy toggles: saturation-data sharing (F6), location usage, marketing push, voice-data processing.
- **UI elements:** toggle rows with plain-language explanations (localized); each change logged to `consent_log`; saturation toggle off → advisory shows "enable data sharing" empty state.
- **Endpoints:** `PUT /users/me/consents`, `GET /users/me/consents` (D.7).

#### 64. Splash version gate (X12)
- **Persona:** all (extends splash screen)
- **Purpose:** force-update wall for breaking API changes; feature flags for staged rollouts.
- **UI elements:** splash → `GET /app-config?version=&platform=` → if `forceUpdate` and current < `minSupportedVersion`: blocking dialog with Play Store link (no dismiss); soft-update banner when merely outdated; feature flags cached to local storage for the session.
- **Endpoints:** `GET /app-config` (D.7).

### C.8 Admin console screens

#### 65. KYC verification queue (A1; covers T1 transporter, S1 seller, B1 broker, E1 equipment docs)
- **Persona:** admin
- **Purpose:** single queue for every persona's document verification: driving licence/RC/GST (transporter), APMC licence/GST (seller), operator licence/RC (equipment), broker ID.
- **UI elements:** queue table (user, persona, doc type, submitted date, doc thumbnail); doc viewer side panel; verify / reject-with-reason actions; filters by persona/status; verified users get a badge (shown in provider cards).
- **Endpoints:** `GET /admin/kyc/pending?persona=`, `POST /admin/kyc/{id}/verify`, `POST /admin/kyc/{id}/reject` (D.8).

#### 66. Scheme editor note (A3)
- **Persona:** admin (extends the existing CMS `schemes` editor from B.7)
- **Purpose:** seasonal deadline edits + eligibility-rule editing without a deploy.
- **UI elements:** in the schemes editor add: `nextDeadline` date picker, `status` dropdown (open/closing-soon/closed), and an `eligibilityRules` JSON editor field with schema validation + preview ("matches: small farmers, Nashik, onion") — rules JSON evaluated server-side, malformed JSON rejected with `422`.
- **Endpoints:** existing `PUT /admin/content/schemes/{id}` (B.7) — `eligibilityRules` map already in schema; this item adds the editor UI + validation only. No new endpoint.

#### 67. Broadcast composer (A4)
- **Persona:** admin
- **Purpose:** send FCM to segments (scheme deadline alerts, weather warnings).
- **UI elements:** compose form (title, body, deep-link type picker from the X3 map); segment filters (personas multi-select, districts multi-select, language); audience-size estimate; schedule now/later; sent-history table with delivery counts.
- **Endpoints:** `POST /admin/broadcast`, `GET /admin/broadcasts?page=` (D.8).

#### 68. Settlement console (A5)
- **Persona:** admin
- **Purpose:** approve and mark-paid the weekly settlement runs (X10) across transporters, equipment owners, brokers.
- **UI elements:** runs table (period, role, payee count, total net ₹, status); run detail (per-payee rows: name, bank last4, gross, commission, net, status); approve-run action; mark-paid per payee (UTR field) or bulk; failed-payout retry.
- **Endpoints:** `GET /admin/settlements?status=&role=`, `POST /admin/settlements/{id}/approve`, `POST /admin/settlements/{id}/mark-paid`, `POST /admin/settlements/{id}/retry` (D.8).

#### 69. Moderation queue (A6)
- **Persona:** admin
- **Purpose:** action UGC reports (X9) and rate sanity-band overrides (S2).
- **UI elements:** reports table (reporter, reported user, context chat/deal/rate ref, reason, date); context viewer (message snippet / rate row); actions: dismiss, warn user, disable user (links to existing `PUT /admin/users/{id}/status`), override-approve an out-of-band rate with note.
- **Endpoints:** `GET /admin/moderation/reports?status=`, `POST /admin/moderation/reports/{id}/resolve` (D.8).

### C.9 P2 items — compact specs (post-v1 roadmap, not in the 15-day scope)

- **F22 Multi-device sessions:** settings → "Active sessions" list (device name, platform, last seen, current badge) backed by the refresh-token inventory in Redis; per-row revoke + "logout other devices" bulk action calling `GET/DELETE /auth/sessions`. Compact list screen only; no push on new-device login in v1.x.
- **F23 Data export (DSR):** settings → "Download my data" → `GET /users/me/export` enqueues an async job that zips the user's docs (profile, diary, orders, claims, bookings, ledger) into Storage and FCM-notifies a 24 h signed URL; export status chip in settings.
- **F10 Disease-scan history:** `disease_scans` list per plot + `GET /disease/scans?plotId=` history endpoint; the scan result screen gains a "past scans on this plot" strip.
- **F14 MSP reference:** `GET /reference/msp?crop=&season=` serving seasonal govt MSP data (seeded by admin CMS, not scraped live); contracts screen swaps static demo text for this endpoint.
- **F18 Diary attachments:** `photoUrl` on `diary_entries` via the standard Storage upload flow; receipt thumbnail on diary rows.
- **T4 Live trip tracking:** driver app pings location every 60 s during `enRoute` → `GET /transport/bookings/{id}/location` returns the latest ping; farmer sees a map on the booking card. Web falls back to polling.
- **T6 Trip expense log:** `trip_expenses` CRUD (fuel/toll/loading, amount, booking ref optional); transporter P&L shows freight − expenses.
- **T8 Return-load board:** `loads` collection — posters (seller/farmer) list return-route loads, transporters bid; notify-on-match. Monetization feature; full bidding UI deferred.
- **T9 Driver management:** `drivers` sub-collection under the transporter's user doc (name, phone, licence no.); `driverId` assignment on bookings; driver sees only his trips (limited login scope).
- **S5 Buyer network / B2B orders:** `buyers` directory CRUD for the seller + incoming bulk-order requests from institutional buyers; extends `buyerLedgers` (S7).
- **S6 GST invoice generation:** `GET /seller/sales/{id}/invoice-pdf` server-generated GST invoice from seller KYC fields (S1); download/share on sale rows.
- **E4 Machine live location:** GPS-tracker integration placeholder — `lastKnownLocation` on `equipment` updated by tracker webhook or manual owner check-in; shown to the renting farmer during active bookings.
- **E5 Damage reports:** `damage_reports` on `equipment_bookings` (photos, description, charge claim ₹); farmer gets a dispute window before the charge hits his ledger.
- **E7 Machinery loan/EMI tracker:** reuse `POST /finance/loans/apply` with `purpose: "machinery"` + an EMI schedule view in the equipment dashboard; no new lending flow.
- **B5 Counter-offer negotiation:** `offers[]` on `broker_deals` (party, rate, qty, at, status) with accept/reject; the deal room (B2) renders offers as structured messages.
- **B7 Broker commission on payments:** Razorpay route/split so commission settles at payment time instead of via weekly runs; depends on X10 being live.
- **X16 Live-channel streaming infra:** decision record first (Mux/IVS vs YouTube Live embed), then ingest (RTMP→HLS) + channel schedule CRUD in admin; `channels.streamUrl` already in schema.
- **X20 Offline form drafts:** local draft store (Hive) for diary/claim forms with a "draft" badge; drafts sync through the existing `/sync` queue on submit.
- **X22 Language-select audio assets:** one-time generation of greeting audio per language via Bhashini TTS, bundled in `assets/audio/lang/`; playback already wired in the prototype.
- **A2 Surveyor roster console:** `surveyors` collection + assign/reassign action on claim rows; v1 keeps name/phone fields on the claim (Day 11) — this adds a real roster.
- **A7 App-config editor:** admin edits the `app_config` singleton doc (min version, flags) with change history; pairs with X12.
- **A8 FPO verification queue:** FPO registration-doc KYC queue, same pattern as A1.
- **A9 Product onboarding console:** product CRUD in the admin CMS (or dealer portal later) replacing seed scripts for the marketplace catalog.
- **A10 Analytics dashboards:** funnel charts (onboarding completion, profile switches/week, module depth) from the X13 BigQuery export; read-only.

### C.10 Remaining audit items — compact specs

P0/P1 items from missing.md that are config- or ops-level rather than full screens:

- **X1 / L1 Per-persona registration step-3 (P0):** the register wizard's step 3 becomes role-keyed: farmer → farm details (existing); farmLandlord → owned-land details + 7/12 upload; transport → first vehicle + docs; seller → shop name, APMC licence/GST; equipmentRental → first machine + docs; broker → network area + crops. Server side: `role_profiles` sub-collection under `users` (`users/{uid}/role_profiles/{profileType}`) holding the per-role payload; "add role later" (linked profiles) reuses the same form per role. KYC doc fields from these forms feed the A1 queue.
- **T1 / S1 / B1 / E1 Persona KYC (P0):** doc-capture fields in registration step-3 (X1) + a `docStatus: pending/verified/rejected` field on the relevant entity (`vehicles`, `equipment`, and `users.role_profiles` for seller/broker). Verification happens exclusively in the A1 admin queue; rejected docs show the reason in-app with a re-upload action. Booking/rate-posting for unverified accounts is allowed but badged "unverified" until verified.
- **X4 SMS fallbacks (P1):** MSG91 sender service behind `services/sms.py` with DLT-registered templates (booking cancel-to-owner, 30-min reminders, rent reminders); FCM remains primary — SMS fires when the user has no registered device or FCM fails. Day-13 ships a provider stub (logs only) until DLT registration completes.
- **X13 Analytics taxonomy (P1):** a versioned event list in `apps/mobile/lib/core/analytics_events.dart` (screen_view per route; actions: `register_complete`, `profile_switch`, `rate_posted`, `booking_created`, `first_action_after_install`, funnel steps per module); Firebase Analytics collection + BigQuery export enabled; Day-15 adds the events to built screens.
- **X14 Crash/error reporting (P0):** Flutter Crashlytics (`firebase_crashlytics`) wired Day 1 with `FlutterError.onError` + platform handlers; backend Sentry SDK on FastAPI with release tagging; both keyed by environment. No app screens.
- **X15 Content localization pipeline (P1):** `translations: map<lang, map>` on content docs (news/blogs/schemes); admin CMS gets a per-language tab; client falls back hi → en → TTS reading of the default language.
- **X18 Static legal pages (P0):** four pages on the Flutter web app at `/legal/privacy`, `/legal/terms`, `/legal/refunds`, `/legal/community` (static markdown rendered); linked from settings → About and the Play listing data-safety form. Content reviewed before submission.
- **X11 Coin abuse guards (P1, rules note):** caps enforced in `services/coins.py`: earn cap 200 coins/day/user, referral reward only after the referee's first verified action, redemption cap 50% of an order value, single active redemption per order; nightly `coins_reconcile` job compares `users.agriCoins` against `gamification_ledger` sums and logs drift to `admin_audit`. Configurable via `app_config` keys.
- **F8 Crop-stage calendar:** intentionally **not built separately** — its per-crop sowing→spray→harvest schedule is generated from `crop_cycles` and materializes as tasks in the F5 task engine; a calendar visualization merges into `farmTasks` in v1.x.

---

## Part D — New Endpoints (missing.md gap audit, round 2)

> Same binding force as Parts A/B and `endpoints.md`. All conventions from `conventions/02-api-conventions.md` apply (Bearer JWT, `Idempotency-Key` on writes, pagination envelope, error envelope, integer rupees, ISO-8601). Paths below omit the `/v1` prefix, same as Part B.

### D.1 Farmer

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/referrals/validate?code=` | Resolve a referral code to a name (register-wizard inline check) — F1 | public |
| POST | `/auth/mpin/reverify` | MPIN re-entry → fresh token pair when refresh token is dead — F2 | all |
| GET | `/search` | Global search. Query: `q=, lang=` — F3 | all |
| GET | `/weather/forecast` | 7-day forecast + advisories. Query: `lat=, lng=, days=` — F4 | all |
| GET | `/tasks/today` | Today's generated farm tasks — F5 | farmer |
| GET | `/tasks` | Task list. Query: `from=, to=, status=` — F5 | farmer |
| POST | `/tasks/{id}/complete` | Mark task done. Body: `{ note? }` — F5 | farmer |
| POST | `/tasks/{id}/snooze` | Snooze to a date. Body: `{ until: "YYYY-MM-DD" }` — F5 | farmer |
| POST | `/advisory/sowing-intent` | Record sowing intent (opt-in saturation sharing) — F6 | farmer |
| GET | `/market/lots` | Browse open produce lots. Query: `crop=, district=, page=` — F7 | farmer, seller, broker |
| GET | `/market/lots/my` | My lots + `pendingPayments[]` (S4) — F7/S4 | farmer |
| POST | `/market/lots` | Post a produce lot — F7 | farmer |
| PUT | `/market/lots/{id}` | Edit / withdraw (`status`) — F7 | farmer |
| DELETE | `/market/lots/{id}` | Remove lot (409 if matched in an active deal) — F7 | farmer |
| POST | `/soil-tests/book` | Book a soil test — F9 | farmer |
| GET | `/soil-tests/my` | My soil tests with status — F9 | farmer |
| POST | `/post-harvest/cold-storage/{id}/book` | Reserve cold-storage capacity — F11 | farmer |
| GET | `/post-harvest/cold-storage/bookings/my` | My cold-storage bookings — F11 | farmer |
| DELETE | `/post-harvest/cold-storage/bookings/{id}` | Cancel while `requested` — F11 | farmer |
| GET | `/mandi/prices/history` | Historical modal prices. Query: `crop=, mandi=, from=, to=` — F13 | farmer, seller, broker |
| POST | `/insurance/claims/{id}/appeal` | Appeal a rejected claim with new photos — F15 | farmer |
| GET | `/bank-accounts` | My payout accounts — F16 (L6/S8 shared) | all |
| POST | `/bank-accounts` | Add account (penny-drop verify queued) — F16 | all |
| POST | `/bank-accounts/{id}/verify` | Trigger/retry penny-drop verification — F16 | all |
| PUT | `/bank-accounts/{id}/primary` | Set as primary payout account — F16 | all |
| DELETE | `/bank-accounts/{id}` | Remove (409 while referenced) — F16 | all |
| GET | `/finance/loans` | My loan applications with status — F17 | all |
| GET | `/fpo/nearby` | FPOs near me. Query: `lat=, lng=, km=` — F19 | farmer |
| POST | `/fpo/{id}/join-request` | Request to join an FPO — F19 | farmer |
| GET | `/fpo/my-membership` | Membership or pending request state — F19 | farmer |
| GET | `/support/threads` | My expert-handoff threads — F20 | all |
| GET | `/support/threads/{id}/messages` | Thread messages (paginated) — F20 | all |
| POST | `/support/threads/{id}/messages` | Post follow-up — F20 | all |
| GET/DELETE | `/auth/sessions`, `/auth/sessions/{id}` | Session inventory / revoke — F22 (P2, compact) | all |
| GET | `/users/me/export` | Async data export → FCM with signed zip URL — F23 (P2, compact) | all |

**F1 — `POST /auth/register` (base spec) extension:** add optional `referralCode: "RAMSINGH2026"`. Unknown code → `422` `REFERRAL_CODE_INVALID` (field-level `fieldErrors.referralCode`); valid code is stored on `users.referralCodeUsed` and attribution happens on the first verified action (X11 caps). `GET /referrals/validate?code=` → `{ "valid": true, "name": "Ram Singh", "village": "Sinnar" }`.

**F2 — `POST /auth/mpin/reverify`** — request / response:
```json
// request
{ "mpin": "1234", "fcmToken": "d9x..." }
// response 200
{ "accessToken": "<jwt>", "refreshToken": "<opaque>", "user": { } }
```
Rules: same bcrypt compare + 5-strike 15-min lock as login (`MPIN_INCORRECT`, `MPIN_LOCKED`). Requires a live-but-expired session marker (Redis `session:{uid}`); without any prior session → `401` (full OTP flow required).

**F3 — `GET /search?q=गेहूं&lang=hi`** — response (sections, not paginated; max 5 per section):
```json
{
  "query": "गेहूं",
  "schemes":   [{ "id": "pm-kisan", "name": "...", "match": "eligibility" }],
  "products":  [{ "id": "prd_1", "title": "...", "discountedPrice": 450 }],
  "news":      [{ "id": "news_9", "title": "...", "timestamp": "..." }],
  "crops":     [{ "crop": "wheat", "vernacularName": "गेहूं", "mandiCount": 12 }],
  "videos":    [{ "id": "vid_3", "title": "...", "duration": "4:12" }]
}
```

**F4 — `GET /weather/forecast?lat=20.0&lng=74.7&days=7`** — response:
```json
{
  "location": { "district": "Nashik", "lat": 20.0, "lng": 74.7 },
  "today": { "tempC": 31, "humidityPct": 62, "windKmh": 9, "rainChancePct": 20, "condition": "partlyCloudy" },
  "days": [
    { "date": "2026-09-14", "minC": 22, "maxC": 33, "rainChancePct": 40, "condition": "rain", "sprayWindow": "none | morning | evening" }
  ],
  "alerts": [{ "severity": "orange", "headline": "Heavy rain likely", "validUntil": "2026-09-15T18:00:00Z" }],
  "sprayAdvice": "Good window 6–10 AM; wind under 10 km/h"
}
```

**F5 — `GET /tasks/today`** — response:
```json
{
  "date": "2026-09-13",
  "tasks": [
    { "id": "task_a1", "title": "Spray neem oil on tomato", "whyNow": "Flowering stage, day 42",
      "source": "cropStage | weather | schemeDeadline | manual",
      "cropCycleId": "cycle_8", "status": "pending | done | snoozed", "snoozedUntil": null }
  ]
}
```
`POST /tasks/{id}/complete` → the task object with `status: "done"`, `completedAt`; awards coins per X11 caps. Tasks are materialized daily from `crop_cycles` (see `farm_tasks` in the schema doc).

**F6 — `POST /advisory/sowing-intent`** — request / response `201`:
```json
// request
{ "crop": "onion", "intendedAreaAcres": 2.5, "sowingWindow": "2026-10", "plotId": "fplot_1", "shareForSaturation": true }
// response
{ "id": "cycle_9", "intent": true, "crop": "onion", "season": "rabi",
  "saturationPreview": { "districtIntentAcres": 1240, "vsLastYearPct": 18, "signal": "high | normal | low" } }
```
Writes a `crop_cycles` doc with `status: "intent"` (converted to `active` when the farmer confirms sowing) — saturation aggregation only counts rows where `shareForSaturation: true`.

**F7 — `POST /market/lots`** — request / response `201`:
```json
// request
{ "crop": "onion", "quantityQuintals": 45, "expectedRatePerQuintal": 1550,
  "harvestDate": "2026-09-10", "grade": "faq | medium | bold",
  "photoUrls": ["https://storage.../lot1.jpg"],
  "pickup": { "lat": 20.0, "lng": 74.7, "address": "Plot A, Sinnar" } }
// response
{ "id": "lot_31", "farmerId": "uid_...", "crop": "onion", "quantityQuintals": 45,
  "expectedRatePerQuintal": 1550, "mandiModalRef": 1500,
  "status": "open | matched | sold | withdrawn", "createdAt": "..." }
```
`GET /market/lots/my` additionally returns `"pendingPayments": [{ "procurementId": "proc_7", "sellerName": "...", "crop": "onion", "amount": 23250, "daysPending": 4 }]` (S4). DELETE → `204`; `409` `LOT_IN_ACTIVE_DEAL` when matched.

**F9 — `POST /soil-tests/book`** — request / response `201`:
```json
// request
{ "plotId": "fplot_1", "pickupDate": "2026-09-20", "sampleDepth": "surface | subsurface",
  "payment": { "mode": "coins | shcScheme | paid", "coinsRedeemed": 0, "amountRupees": 250 } }
// response
{ "id": "soil_5", "status": "booked | sampleCollected | atLab | resultReady",
  "bookingRef": "ST-2026-0042", "resultPdfUrl": null, "createdAt": "..." }
```
Result PDF uploaded by admin/lab; upload sets `status: "resultReady"` and FCMs the farmer (X3 type `soil_test_result`).

**F11 — `POST /post-harvest/cold-storage/{id}/book`** — request / response `201`:
```json
// request
{ "crop": "onion", "quantityQuintals": 60, "durationWeeks": 6, "startDate": "2026-09-15" }
// response
{ "id": "csb_3", "warehouseId": "wh_12", "quantityQuintals": 60, "durationWeeks": 6,
  "ratePerQuintalPerWeek": 12, "totalAmount": 4320,
  "status": "requested | confirmed | active | completed | cancelled" }
```
Atomic capacity decrement (Firestore transaction on the warehouse doc); `409` `INSUFFICIENT_CAPACITY` when remaining capacity < requested qty.

**F13 — `GET /mandi/prices/history?crop=onion&mandi=lasalgaon&from=2026-06-01&to=2026-09-13`** — response:
```json
{
  "crop": "onion", "mandi": "lasalgaon",
  "points": [{ "date": "2026-06-01", "modalPrice": 1420, "arrivalsQuintals": 850 }],
  "msp": null, "summary": { "min": 1180, "max": 1900, "avg": 1465 }
}
```
Served from `mandi_prices` history (ingestion job keeps 3 years); max range 3 years, max 400 points (server downsamples).

**F15 — `POST /insurance/claims/{id}/appeal`** — request / response `201`:
```json
// request
{ "appealNote": "Photos retaken with geotag", "damagePhotos": ["https://storage.../p1.jpg"] }
// response
{ "id": "claim_12b", "appealOf": "claim_12", "status": "intimated", "round": 2, "submittedAt": "..." }
```
Only on `rejected` claims (`409` `CLAIM_NOT_REJECTED`); max 2 appeal rounds (`409` `APPEAL_LIMIT_REACHED`). The appeal is a new claim doc linked by `appealOf` so the timeline shows both rounds.

**F16 — `POST /bank-accounts`** — request / response `201`:
```json
// request
{ "accountNumber": "50100234567890", "ifsc": "HDFC0001234", "accountHolderName": "Ram Singh", "accountType": "savings | current" }
// response
{ "id": "ba_4", "bankName": "HDFC Bank", "accountLast4": "7890", "ifsc": "HDFC0001234",
  "verificationStatus": "pending | verified | failed", "verificationMethod": "pennyDrop",
  "isPrimary": false, "createdAt": "..." }
```
`POST /bank-accounts/{id}/verify` enqueues a penny-drop (Razorpay contact/fund-account validation) and returns the account object; completion arrives async (status flips + FCM `bank_verified`). Name mismatch → `verificationStatus: "failed"`, `failureReason`. Only one `isPrimary` per user (service flips the old one). DELETE → `204`; `409` `ACCOUNT_IN_USE` when referenced by an open claim, loan, or `pending/approved` settlement.

**F17 — `GET /finance/loans`** — response:
```json
{
  "data": [
    { "id": "loan_9", "type": "kcc | cropLoan | machinery | vehicle",
      "amountRupees": 150000, "appliedOn": "2026-09-01",
      "status": "underReview | approved | disbursed | rejected",
      "statusText": "...", "bankRefNo": "KCC/2026/881", "expectedDisbursal": "2026-09-25",
      "history": [{ "status": "underReview", "at": "..." }] }
  ],
  "page": 1, "pageSize": 20, "total": 1
}
```

**F19 — `GET /fpo/nearby?lat=20.0&lng=74.7&km=25`** → list `{ id, name, district, memberCount, crops[], distanceKm, verified }`. **`POST /fpo/{id}/join-request`** — request `{ "message": "..." }` → `201 { "id": "fjor_2", "status": "pending | approved | rejected" }`; one pending request at a time (`409` `JOIN_REQUEST_PENDING`). Approval (FPO admin / platform admin) sets `users.fpoId` and FCMs the farmer. `GET /fpo/my-membership` → `{ "state": "none | pending | member", "fpoId": "...", "requestId": null }`.

**F20 — support threads.** `POST /chatbot/handoff` (base spec) now also creates a `support_threads` doc and returns `threadId`. **`POST /support/threads/{id}/messages`** — request `{ "text": "...", "attachmentUrl": null }` → `201` message object `{ id, sender: "user | expert", text, attachmentUrl, at }`. Expert replies come from the admin console (Day 14); reply FCMs the user (X3 `expert_reply`). `POST /support/threads/{id}/resolve` marks `status: "closed"`.

**F22 (P2, compact):** `GET /auth/sessions` lists refresh-token sessions `{ id, deviceName, platform, lastSeenAt, current }` from the Redis inventory; `DELETE /auth/sessions/{id}` revokes one; `DELETE /auth/sessions?others=true` revokes all but current.

**F23 (P2, compact):** `GET /users/me/export` → `202 { "exportId": "exp_1", "status": "queued" }`; job zips user-owned collections to Storage and FCMs a 24 h signed URL; repeat within 24 h returns the existing URL.

### D.2 Landlord

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/land/listings` | Browse land for lease. Query: `lat=, lng=, maxRent=, minAcres=, page=` — L2 | farmer, farmLandlord |
| GET | `/land/listings/my` | My listings — L2 | farmLandlord |
| POST | `/land/listings` | List a vacant plot for lease — L2 | farmLandlord |
| PUT | `/land/listings/{id}` | Edit / pause / resume — L2 | farmLandlord |
| DELETE | `/land/listings/{id}` | Remove (409 while pending requests) — L2 | farmLandlord |
| POST | `/land/listings/{id}/lease-requests` | Farmer requests a lease on a listing — L3 | farmer |
| GET | `/land/lease-requests` | Landlord inbox. Query: `status=pending` — L3 | farmLandlord |
| GET | `/land/lease-requests/my` | Farmer's own requests — L3 | farmer |
| POST | `/land/lease-requests/{id}/accept` | Accept → creates lease + marks listing leased — L3 | farmLandlord |
| POST | `/land/lease-requests/{id}/reject` | Reject with reason — L3 | farmLandlord |
| GET | `/land/leases/{id}/agreement-pdf` | Server-generated agreement PDF (URL) — L4 | lease parties |
| POST | `/land/leases/{id}/sign` | E-sign the agreement (dual sign) — L4 | lease parties |

**L2 — `POST /land/listings`** — request / response `201`:
```json
// request
{ "plotId": "plot_55", "expectedRentPerMonth": 14000, "preferredDurationMonths": 11,
  "terms": "Borewell access included", "photoUrls": ["https://storage.../land1.jpg"] }
// response
{ "id": "ll_8", "plotId": "plot_55", "ownerId": "uid_...",
  "status": "live | paused | leased", "requestCount": 0, "createdAt": "..." }
```
`409` `PLOT_NOT_VACANT` when the plot already has an active lease/listing.

**L3 — `POST /land/listings/{id}/lease-requests`** — request / response `201`:
```json
// request
{ "intendedCrop": "onion", "durationMonths": 11, "message": "..." }
// response
{ "id": "lr_4", "listingId": "ll_8", "farmerId": "uid_...",
  "status": "pending | accepted | rejected | withdrawn", "createdAt": "..." }
```
**`POST /land/lease-requests/{id}/accept`** — body `{ "rentPerMonth": 14000, "startDate": "2026-10-01", "terms": "..." }` → creates a `leases` doc (B.3 shape), sets listing `status: "leased"`, plot `status: "leased"`, auto-rejects other pending requests on that listing, FCMs the farmer. **`.../reject`** — body `{ "reason": "..." }` → `200`, farmer notified.

**L4 — `GET /land/leases/{id}/agreement-pdf`** → `{ "pdfUrl": "https://storage.../lease_20.pdf", "generatedAt": "...", "signatures": [] }` (generated on first call, regenerated after any lease edit). **`POST /land/leases/{id}/sign`** — request `{ "signatureData": "<base64 png>", "consentTimestamp": "..." }` (same pattern as contract e-sign, base spec) → appends to `signatures[]`; when both parties have signed, `leases.verified = true`.

**L5 — scheduled job `rent_reminder`** (added to the jobs table in the schema doc): daily 08:00 IST — for every active lease, compute the current month's payment state; 3 days before due → FCM to tenant + landlord (`rent_due`); on overdue → FCM both (`rent_overdue`) + overdue badge flag cached on the lease. Writes `notification_log` rows; SMS fallback per X4.

### D.3 Transporter

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/transport/bookings/{id}/accept` | Accept a `requested` booking — T2 | transport |
| POST | `/transport/bookings/{id}/reject` | Reject with reason — T2 | transport |
| PATCH | `/transport/bookings/{id}` | Extended with POD fields — T3 | transport |
| GET | `/transport/settlements` | Settlement history. Query: `from=, to=, status=` — T5 | transport |
| GET | `/transport/settlements/current` | Accruing cycle summary — T5 | transport |

**T2 — `POST /transport/bookings/{id}/accept`** → booking object with `status: "accepted"` (only from `requested`; `409` `BOOKING_ALREADY_HANDLED`; auto-expire after 24 h → status `expired`, farmer notified). **`.../reject`** — request `{ "reason": "vehicleUnavailable | routeNotServed | rateTooLow | other", "note": "" }` → booking `status: "rejected"`, farmer FCM (`booking_rejected`, X3).

**T3 — `PATCH /transport/bookings/{id}` (base spec §7) extension** for the `delivered` transition:
```json
{ "status": "delivered", "podNote": "...", "receiverName": "S. Patil",
  "podPhotos": ["https://storage.../pod1.jpg"], "receiverSignatureUrl": "https://storage.../sig.png" }
```
Validation: `delivered` requires ≥1 `podPhotos` entry and `receiverName` → else `422` `POD_REQUIRED`. POD fields visible to the booker in `GET /transport/bookings/{id}`.

**T5 — `GET /transport/settlements`** — response envelope of settlement objects (generic shape, shared with equipment/broker via `role` field — X10):
```json
{
  "data": [
    { "id": "stl_2026w37_8", "role": "transport", "periodStart": "2026-09-07", "periodEnd": "2026-09-13",
      "itemCount": 9, "grossRupees": 28400, "commissionPct": 8, "commissionRupees": 2272,
      "netRupees": 26128, "status": "pending | approved | paid | failed",
      "paidOn": null, "bankAccountLast4": "7890", "utr": null }
  ],
  "page": 1, "pageSize": 20, "total": 4
}
```
`GET /transport/settlements/current` → `{ "periodStart", "grossRupees", "estimatedNetRupees", "tripCount", "payoutDay": "monday" }`.

**T7 — vehicle doc-expiry:** B.1 vehicle create/edit bodies accept `insuranceExpiry`, `fitnessExpiry`, `pucExpiry` (`YYYY-MM-DD`); computed `docStatus: "ok | expiringSoon | expired"` on vehicle responses. Scheduled job `doc_expiry_reminder` (daily 07:00): 15 days before expiry → FCM `doc_expiry`; on expiry → `vehicles.docStatus = "expired"`, vehicle hidden from booking search; renewed dates reset it.

### D.4 Seller

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/seller/rates` | Sanity-band validation added — S2 | seller |
| PUT | `/seller/rates/{id}` | 2 h edit window enforced — S2 | seller |
| POST | `/seller/procurements` | Lot-level purchase from farmer with slip photo — S3 | seller |
| GET | `/seller/procurements` | Procurement list. Query: `from=, to=, paymentStatus=` — S3/S4 | seller |
| POST | `/seller/procurements/{id}/mark-paid` | Mark an udhaar procurement paid — S4 | seller |
| GET | `/seller/ledgers` | Buyer credit ledgers (outstanding balances) — S7 | seller |
| GET | `/seller/ledgers/{buyerKey}` | One buyer's ledger entries — S7 | seller |
| POST | `/seller/ledgers/{buyerKey}/payments` | Record a buyer payment against the ledger — S7 | seller |

**S2 — rate sanity-band rule (server-side, on B.2 `POST /seller/rates` and `PUT /seller/rates/{id}`):** on write, look up today's Agmarknet modal price for (crop, mandi district); allowed band = modal ± **15%** (configurable via `app_config.rateSanityBandPct`). Out of band → `422`:
```json
{ "error": { "code": "RATE_OUT_OF_BAND",
  "message": "भाव ₹1,530–₹2,070 के बीच होना चाहिए (मंडी मॉडल ₹1,800)",
  "fieldErrors": { "ratePerQuintal": "outside allowed band 1530–2070" } } }
```
Edit window: `PUT` allowed only within **2 h** of `createdAt` and only while `status != "approved"`; later → `409` `RATE_EDIT_WINDOW_PASSED`. Admin override-approve of an out-of-band rate happens via A6 with a mandatory note. When no Agmarknet row exists for the pair, the band check is skipped and the rate enters moderation as `pending` (current behavior).

**S3 — `POST /seller/procurements`** — request / response `201`:
```json
// request
{ "farmerPhone": "+919812345678", "farmerName": "S. Patil",
  "crop": "onion", "lotId": "lot_31",
  "quantityQuintals": 15, "ratePerQuintal": 1550,
  "slipPhotoUrl": "https://storage.../slip.jpg",
  "paymentMode": "cash | upi | udhaar", "date": "2026-09-13" }
// response
{ "id": "proc_7", "sellerId": "uid_...", "farmerPhone": "+919812345678", "farmerName": "S. Patil",
  "crop": "onion", "lotId": "lot_31", "quantityQuintals": 15, "ratePerQuintal": 1550,
  "totalAmount": 23250, "paymentMode": "udhaar", "paymentStatus": "paid | udhaar",
  "date": "2026-09-13", "createdAt": "..." }
```
Side effects (one transaction): increments `seller_inventory` for the crop (creating the row when absent); when `lotId` given and it matches the farmer's open lot, decrements/marks the lot `sold`; when `paymentMode: "udhaar"` the procurement appears in the farmer's `pendingPayments[]` (F7) until marked paid.

**S4 — `POST /seller/procurements/{id}/mark-paid`** — request `{ "mode": "cash | upi | bank", "paidOn": "2026-09-15", "utrNote": "" }` → procurement with `paymentStatus: "paid"`; FCM to the farmer (`payment_received`). Only from `udhaar` (`409` `ALREADY_PAID`).

**S7 — `GET /seller/ledgers`** — response:
```json
{ "data": [ { "buyerKey": "rk_traders", "buyerName": "R. Traders",
    "outstandingRupees": 41200, "lastPaymentOn": "2026-09-01", "agingDays": 12 } ],
  "page": 1, "pageSize": 20, "total": 6 }
```
**`GET /seller/ledgers/{buyerKey}`** → `{ "buyerName", "outstandingRupees", "entries": [{ "id", "type": "sale | payment", "refId": "sale_11x", "amount": 24300, "balance": 41200, "date", "note" }] }`. Credit sales (`seller_sales.paymentMode: "credit"`) auto-append `sale` entries; **`POST /seller/ledgers/{buyerKey}/payments`** — `{ "amount": 20000, "mode": "upi", "paidOn": "2026-09-13", "note": "" }` appends a `payment` entry and recomputes the balance. `422` `PAYMENT_EXCEEDS_BALANCE` when amount > outstanding.

### D.5 Equipment owner

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/equipment/bookings/{id}/approve` | Approve a `pending` booking (private machines) — E2 | equipmentRental |
| POST | `/equipment/bookings/{id}/reject` | Reject with reason; slot released — E2 | equipmentRental |
| GET | `/equipment/{id}/maintenance` | Maintenance log — E3 | equipmentRental |
| POST | `/equipment/{id}/maintenance` | Add log entry — E3 | equipmentRental |
| PUT | `/equipment/{id}/maintenance/{mid}` | Edit entry — E3 | equipmentRental |
| DELETE | `/equipment/{id}/maintenance/{mid}` | Remove entry — E3 | equipmentRental |

**E2 — `POST /equipment/bookings/{id}/approve`** → booking object with `status: "confirmed"` (slot doc flipped `pending → booked` in the same transaction); only the fleet owner, only from `pending` (`409` `BOOKING_ALREADY_HANDLED`); pending requests auto-expire 2 h before slot start (`status: "expired"`, slot released, farmer FCM). **`.../reject`** — request `{ "reason": "machineDown | doubleBooked | distanceTooFar | other", "note": "" }` → `status: "rejected"`, slot released to `available`, farmer FCM (`equipment_rejected`).

**E3 — `POST /equipment/{id}/maintenance`** — request / response `201`:
```json
// request
{ "date": "2026-09-13", "type": "service | repair",
  "description": "Oil change + filter", "costRupees": 2400,
  "engineHours": 410, "receiptUrl": "https://storage.../r.jpg",
  "nextServiceDate": "2026-12-13" }
// response: entry object with id, equipmentId, ownerId, createdAt
```
`nextServiceDate` on the latest entry drives the "service due" banner + FCM (`equipment_service_due`, 7 days before). Log cost feeds the equipment owner's `/pnl/summary` as `maintenance` expense.

### D.6 Broker

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/broker/deals/{id}/messages` | Deal-room thread (paginated) — B2 | deal parties |
| POST | `/broker/deals/{id}/messages` | Post to the deal room — B2 | deal parties |
| GET | `/market/requirements` | Browse buyer requirements. Query: `crop=, district=, status=` — B3 | farmer, seller, broker |
| POST | `/market/requirements` | Post a requirement — B3 | seller, broker |
| PUT | `/market/requirements/{id}` | Edit / mark matched / close — B3 | seller, broker |
| DELETE | `/market/requirements/{id}` | Remove — B3 | seller, broker |

**B2 — deal messages.** Deal rooms are a typed view over the generic chat infra (X2): creating a deal auto-creates a `chats` doc with `contextType: "brokerDeal"`, `contextId: dealId`, participants = broker + farmer + buyer uids (when known). **`GET /broker/deals/{id}/messages?before=&pageSize=`** → pagination envelope of messages `{ id, senderId, senderName, senderRole, type: "text | image | system", text, attachmentUrl, at }`. **`POST /broker/deals/{id}/messages`** — request `{ "text": "...", "attachmentUrl": null }` → `201` message object; also FCMs other participants (`deal_message`). System events (status changes, document added) are inserted by the service with `type: "system"`.

**B3 — `POST /market/requirements`** — request / response `201`:
```json
// request
{ "crop": "onion", "quantityQuintals": 50, "targetRatePerQuintal": 1500,
  "neededBy": "2026-09-20", "district": "Nashik", "buyerName": "Shakti Traders", "notes": "FAQ grade only" }
// response
{ "id": "req_6", "postedBy": "uid_...", "postedByRole": "seller",
  "status": "open | matched | closed | expired", "createdAt": "..." }
```
Requirements auto-expire at `neededBy` + 3 days. "Match with lot" (C.6 screen 55) is client-side: it prefills `POST /broker/deals` with the lot + requirement refs — `broker_deals` gains optional `lotId`, `requirementId` fields.

**B4 — deal documents:** B.4 deal create/edit bodies accept `documents: [{ "type": "weightSlip | qualityReport | paymentProof | other", "url": "https://storage.../x.pdf", "uploadedAt": "..." }]`; stored on `broker_deals.documents[]`, rendered in the deal room.

### D.7 Cross-cutting

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/chats` | My chat list (last message, unread count) — X2 | all |
| POST | `/chats` | Open (or get) a 1:1 chat with a user — X2 | all |
| GET | `/chats/{id}/messages` | Message history. Query: `before=, pageSize=` — X2 | participants |
| POST | `/chats/{id}/messages` | Send a message — X2 | participants |
| POST | `/orders/{id}/cancel` | Cancel a pre-dispatch order — X5 | buyer |
| POST | `/payments/razorpay/refund` | Issue/refund a Razorpay payment (internal + admin) — X5 | service, admin |
| GET | `/addresses` | Saved addresses — X6 | all |
| POST | `/addresses` | Add address — X6 | all |
| PUT | `/addresses/{id}` | Edit / set default — X6 | all |
| DELETE | `/addresses/{id}` | Remove — X6 | all |
| GET | `/products/{id}/reviews` | Product reviews. Query: `page=` — X7 | all |
| POST | `/products/{id}/reviews` | Submit a review (requires delivered order) — X7 | buyer |
| PUT | `/products/{id}/reviews/{rid}` | Edit own review ≤48 h — X7 | buyer |
| POST | `/ratings` | Rate a completed booking — X8 | all |
| GET | `/ratings/summary` | Provider aggregate. Query: `targetType=, targetId=` — X8 | all |
| POST | `/users/{id}/report` | Report a user — X9 | all |
| GET | `/users/me/blocks` | My blocked users — X9 | all |
| POST | `/users/me/blocks` | Block a user. Body: `{ uid }` — X9 | all |
| DELETE | `/users/me/blocks/{uid}` | Unblock — X9 | all |
| GET | `/app-config` | Version gate + feature flags. Query: `version=, platform=` — X12 | public |
| PUT | `/users/me/consents` | Set consent flags (logged) — X17 | all |
| GET | `/users/me/consents` | Current consent flags — X17 | all |
| POST | `/speech/stt` | Audio → text (Sarvam) — X21 | all |
| POST | `/speech/tts` | Text → audio URL (Bhashini) — X21 | all |

**X2 — chats.** **`POST /chats`** — request `{ "participantUid": "uid_...", "contextType": "direct | brokerDeal | transportBooking | produceLot", "contextId": null }` → `200/201` chat object `{ id, participants: [{uid, name, role}], contextType, contextId, lastMessage, unreadCount, createdAt }` (one direct chat per uid pair — repeat POST returns the existing chat). `409` `USER_BLOCKED` when either party blocks the other. **`POST /chats/{id}/messages`** — request `{ "type": "text | image", "text": "...", "attachmentUrl": null }` → `201` message; server writes to `chats/{id}/messages`, updates `lastMessage`, FCMs the other participant (`chat_message`, throttled 1/min/chat in Redis). Delivery: Android clients subscribe via Firestore listener on `chats/{id}/messages` (backend-only write, client read allowed by rules for participants — exception to deny-all, declared in `infra/firestore.rules`); web/admin clients poll `GET`.

**X3 — notification deep-link map.** Every FCM payload carries `data: { type, refId, route, ... }`; the app router maps `route` + keys. Canonical table (client `apps/mobile/lib/core/notification_router.dart` must match exactly):

| `type` | App route | Payload keys |
|---|---|---|
| `booking_reminder` | `myBookings` | `refId` (booking), `kind` |
| `booking_accepted` / `booking_rejected` | `tripDetail` source module / `myBookings` | `refId`, `reason?` |
| `booking_request` | `bookingRequests` | `refId` |
| `equipment_pending` | `equipmentBookingRequests` | `refId` |
| `equipment_approved` / `equipment_rejected` | `myBookings` | `refId`, `reason?` |
| `equipment_service_due` | `maintenanceLog` | `equipmentId` |
| `claim_update` / `claim_appeal_update` | `cropInsurance` (tracker tab) | `claimId`, `status` |
| `rate_approved` / `rate_rejected` | `mandi` / `ratePost` | `rateId` |
| `weather_alert` | `weatherDetail` | `district`, `severity` |
| `task_reminder` | `farmTasks` | `taskId` |
| `rent_due` / `rent_overdue` | `rentTracking` | `leaseId`, `month` |
| `lease_request` | `leaseRequests` | `requestId` |
| `lease_accepted` / `lease_rejected` | `myLeaseRequests` / `leaseManage` | `requestId`, `leaseId?` |
| `settlement_paid` | `transportSettlements` (role equivalent) | `settlementId` |
| `doc_expiry` | `vehicleManage` | `vehicleId`, `doc` |
| `soil_test_result` | `soilTests` | `testId` |
| `loan_status` | `loanTracking` | `loanId`, `status` |
| `kyc_verified` / `kyc_rejected` | persona home | `docType`, `reason?` |
| `broadcast` | per `route` key in payload | `route?`, `refId?` |
| `chat_message` | `chatThread` | `chatId` |
| `deal_message` | `dealRoom` | `dealId` |
| `order_update` / `refund_update` | `orderTracking` | `orderId`, `status` |
| `payment_received` | `sellProduce` | `procurementId` |
| `coins_awarded` / `referral_reward` | `krishiRatna` / `referEarn` | `coins` |
| `fpo_join_approved` / `fpo_join_rejected` | `fpo` | `fpoId` |
| `expert_reply` | `supportThread` | `threadId` |
| `cold_storage_confirmed` | `myBookings` | `bookingId` |
| `lot_offer` / `requirement_match` | `sellProduce` / `buyerRequirements` | `lotId` / `requirementId` |

**X5 — `POST /orders/{id}/cancel`** — request / response:
```json
// request
{ "reason": "changedMind | wrongAddress | foundCheaper | other" }
// response 200
{ "orderId": "ord_55", "status": "cancelled", "refundStatus": "notApplicable | initiated | refunded | failed",
  "refundEtaDays": 7 }
```
Rules: only while `status ∈ {placed, confirmed}` → else `409` `CANCEL_WINDOW_PASSED`. COD orders → `refundStatus: "notApplicable"`. Paid orders trigger **`POST /payments/razorpay/refund`** internally — body `{ "razorpayPaymentId": "pay_N2...", "amountPaise": 125000, "refId": "ord_55", "reason": "..." }` → `{ "refundId": "rfnd_...", "status": "processed" }`; the Razorpay refund webhook flips `orders.refundStatus` to `refunded` and FCMs (`refund_update`). Partial refunds (BNPL repaid portion only) pass a lower `amountPaise`.

**X6 — `POST /addresses`** — request / response `201`:
```json
// request
{ "label": "home | farm | other", "line": "Plot 12, near temple", "village": "Sinnar",
  "district": "Nashik", "pincode": "422103", "phone": "+9198...", "isDefault": true }
// response: address object with id, userId, createdAt
```
One default per user (service flips). Checkout (`POST /orders`, base spec) additionally accepts `addressId`; server serializes it into `deliveryAddress`.

**X7 — `POST /products/{id}/reviews`** — request `{ "stars": 4, "text": "...", "photoUrl": null }` → `201` review `{ id, userId, userName, stars, text, photoUrl, createdAt }`. `403` `NOT_PURCHASED` unless the caller has a `delivered` order containing the product; one review per (user, product) (`409` `REVIEW_EXISTS`, use PUT). Write recomputes `products.rating` / `reviewsCount`.

**X8 — `POST /ratings`** — request `{ "bookingType": "transport | equipment | vet | workshop | talk", "bookingId": "eqb_12", "stars": 5, "tags": ["onTime"], "comment": "" }` → `201`. One rating per booking (`409` `RATING_EXISTS`); booking must be `completed`/`delivered` (`422` `BOOKING_NOT_COMPLETED`). Aggregates land on the provider's entity (`vehicles`, `equipment`, `vets` rating fields).

**X9 — `POST /users/{id}/report`** — request `{ "reason": "spam | abuse | fraud | inappropriate | other", "contextType": "chat | deal | rate | profile", "contextId": "chat_9", "details": "" }` → `201 { "reportId": "rep_3", "status": "open" }`. **`POST /users/me/blocks`** `{ "uid": "..." }` → `201`; blocking hides existing chats both ways and rejects new chat creation (`USER_BLOCKED`).

**X10 — platform settlement engine.** Config in `app_config.settlement`: `{ "cycleDays": 7, "payoutWeekday": "monday", "commissionPct": { "transport": 8, "equipmentRental": 10, "broker": 0 } }` (broker commission is recorded per-deal already; the run pays out `received` commission entries). Flow:
1. **Nightly job `settlement_accrue`** (02:00): aggregates completed/delivered bookings (transport), completed equipment bookings, and received broker commissions into per-(role, uid, ISO-week) accrual docs in Redis.
2. **Weekly job `settlement_run`** (Monday 04:00): materializes `settlements` docs (`status: "pending"`) for the closed week; skips users without a verified primary bank account (`status: "onHold"`, FCM nudges to add one — F16).
3. **Admin console (A5)** approves (`approved`) then marks paid with UTR (`paid`) — payout itself is a bank/Razorpay-X transfer initiated by ops; failures → `failed` with retry.
Status flow: `accruing (implicit) → pending → approved → paid` (`onHold`/`failed` branches). Every transition writes `admin_audit` and FCMs the payee (`settlement_paid`).

**X11 — coin caps (rules note):** see C.10. Enforcement lives in `services/coins.py` + `app_config.coinCaps`; the nightly `coins_reconcile` job is added to the jobs table in the schema doc.

**X12 — `GET /app-config?version=1.2.0&platform=android`** — response:
```json
{ "minSupportedVersion": "1.1.0", "latestVersion": "1.3.0",
  "forceUpdate": false, "playStoreUrl": "https://play.google.com/store/apps/details?id=in.agrovercity.app",
  "featureFlags": { "inAppChat": true, "sellProduce": true, "speechEnabled": false },
  "rateSanityBandPct": 15, "coinCaps": { "earnPerDay": 200, "redeemMaxPctOfOrder": 50 },
  "maintenance": { "active": false, "message": "" } }
```
Public (no auth), served from the `app_config` singleton doc with a 5-min Redis cache. Splash gate: `forceUpdate` or version < `minSupportedVersion` → blocking dialog; `maintenance.active` → maintenance screen.

**X17 — `PUT /users/me/consents`** — request / response:
```json
// request (any subset)
{ "saturationShare": true, "locationForAdvisory": true, "marketingPush": false, "voiceDataProcessing": true }
// response 200
{ "consents": { "saturationShare": true, "locationForAdvisory": true, "marketingPush": false, "voiceDataProcessing": true },
  "updatedAt": "..." }
```
Every change appends a `consent_log` doc `{ userId, key, value, source: "app", at }`. `saturationShare: false` blocks F6 intent aggregation (intent still saved, excluded from district counts).

**X19 — sync conflict matrix.** Resolution policy per collection when `/sync` replays a queued write against a newer server doc (`updatedAt` comparison; client ops carry `baseUpdatedAt`):

| Collection | Policy | Notes |
|---|---|---|
| `diary_entries` | last-write-wins | per-doc; offline edits replay over server |
| `farm_plots`, `crop_cycles` | last-write-wins | single-owner data |
| `equipment_bookings`, `transport_bookings` | server-wins | slot/booking state is transactional; replay of a stale transition → `409` surfaced in sync result |
| `equipment_slots` | server-wins | never client-writable (booking service only) |
| `carts` | last-write-wins (merge) | quantities merged per product, server total wins ties |
| `orders` | server-wins | create-only from client; status never client-set |
| `addresses`, `bank_accounts` | last-write-wins | per-doc |
| `seller_inventory`, `seller_sales` | server-wins | stock math is transactional; queued sales failing stock check → `422` in sync result |
| `produce_lots`, `land_listings`, `market requirements` | last-write-wins | except `status: matched/sold` → server-wins |
| `settings`/`users.settings`, `users.consents` | field-merge, per-key last-write-wins | |
| `chats`/`messages`, `notifications` | append-only, no conflict | dedupe by idempotency key |

Sync responses already carry per-op results (conventions §4); conflicts surface as `{ "idempotencyKey", "status": 409, "error": { "code": "SYNC_CONFLICT" }, "replayed": true }` with the server copy in `error.fieldErrors.serverDoc` for the client to display/merge.

**X21 — speech. `POST /speech/stt`** — `multipart/form-data` (exception to JSON content-type): field `audio` (file), fields `language` (`hi|mr|gu|pa|te|ta|en`), `context` (`chatbot | search | form`). Constraints: formats `wav|m4a|ogg|webm`, 16 kHz mono preferred, **max 15 MB / 60 s** → `413` `AUDIO_TOO_LARGE`. Response:
```json
{ "text": "गेहूं का भाव क्या है", "language": "hi", "confidence": 0.93, "durationMs": 3200 }
```
Provider: Sarvam STT (Day 13 wiring); `confidence < 0.5` → client re-prompts, does not auto-submit.
**`POST /speech/tts`** — request `{ "text": "...", "language": "hi", "voice": "female | male" }` (max 500 chars → `422` `TEXT_TOO_LONG`) → response `{ "audioUrl": "https://storage.../tts/abc.mp3", "durationMs": 4100, "cached": false }`. Provider: Bhashini TTS; results cached in Storage keyed by `sha256(text+language+voice)`; the client downloads and plays, no streaming in v1.

### D.8 Admin

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/kyc/pending` | KYC queue. Query: `persona=, page=` — A1 | admin |
| POST | `/admin/kyc/{id}/verify` | Verify a document set — A1 | admin |
| POST | `/admin/kyc/{id}/reject` | Reject with reason. Body: `{ reason }` — A1 | admin |
| POST | `/admin/broadcast` | Send/schedule a segmented FCM broadcast — A4 | admin |
| GET | `/admin/broadcasts` | Broadcast history. Query: `page=` — A4 | admin |
| GET | `/admin/settlements` | Settlement runs. Query: `status=, role=, period=` — A5 | admin |
| POST | `/admin/settlements/{id}/approve` | Approve a pending settlement — A5 | admin |
| POST | `/admin/settlements/{id}/mark-paid` | Mark paid. Body: `{ utr, paidOn }` — A5 | admin |
| POST | `/admin/settlements/{id}/retry` | Retry a failed payout — A5 | admin |
| GET | `/admin/moderation/reports` | UGC report queue. Query: `status=open` — A6 | admin |
| POST | `/admin/moderation/reports/{id}/resolve` | Resolve. Body below — A6 | admin |

**A1 — `GET /admin/kyc/pending?persona=transport`** — response:
```json
{ "data": [ { "id": "kyc_21", "userId": "uid_...", "name": "...", "persona": "transport",
    "docType": "drivingLicence | rc | gst | apmcLicence | operatorLicence | fpoRegistration",
    "documentUrl": "https://storage.../doc.pdf", "entityRef": "veh_9f2c",
    "submittedAt": "..." } ], "page": 1, "pageSize": 20, "total": 5 }
```
**Verify** → the entity's `verificationStatus`/`docStatus` flips to `verified` (vehicles, equipment, or `role_profiles` for seller/broker), user FCM `kyc_verified`. **Reject** `{ "reason": "..." }` → status `rejected`, user sees reason + re-upload (T1/S1/B1/E1 flows). Both write `admin_audit`.

**A4 — `POST /admin/broadcast`** — request / response `201`:
```json
// request
{ "title": "PM-Kisan deadline", "body": "...", "deepLinkType": "broadcast", "route": "schemes", "refId": "pm-kisan",
  "segment": { "personas": ["farmer"], "districts": ["Nashik", "Ahmednagar"], "language": "hi" },
  "sendAt": null }
// response
{ "id": "bc_9", "estimatedAudience": 1240, "status": "scheduled | sent | failed", "createdAt": "..." }
```
Fan-out via the notification pipeline (topic-per-district + persona filter); delivery counts recorded in `notification_log`.

**A5 — `POST /admin/settlements/{id}/mark-paid`** — request `{ "utr": "UTIB123456", "paidOn": "2026-09-15" }` → settlement `status: "paid"`; payee FCM `settlement_paid`. **Approve** moves `pending → approved` (`409` `SETTLEMENT_STATE_INVALID` otherwise). All transitions write `admin_audit`.

**A6 — `POST /admin/moderation/reports/{id}/resolve`** — request:
```json
{ "action": "dismiss | warn | disableUser | overrideRate",
  "note": "...", "disableReason": null }
```
`disableUser` calls the same path as `PUT /admin/users/{id}/status`; `overrideRate` force-approves an out-of-band rate (S2) with the note attached to the rate doc. Reporter is not notified of the outcome (policy), reported user is warned via FCM on `warn`.

### D.9 New scheduled jobs (added to the schema doc jobs table)

| Job | Frequency | Action |
|---|---|---|
| `farm_task_materialize` | daily 05:30 IST | generate `farm_tasks` for today from active `crop_cycles` stage dates + weather rules |
| `rent_reminder` | daily 08:00 IST | L5 — FCM/SMS for due-soon and overdue lease months |
| `doc_expiry_reminder` | daily 07:00 IST | T7 — FCM at T-15 days; flip `docStatus` at expiry |
| `equipment_service_reminder` | daily 07:30 IST | E3 — FCM 7 days before `nextServiceDate` |
| `settlement_accrue` | nightly 02:00 | X10 — aggregate earnings into weekly accruals |
| `settlement_run` | Monday 04:00 | X10 — materialize `settlements` docs for the closed week |
| `coins_reconcile` | nightly 03:30 | X11 — ledger vs balance drift check → `admin_audit` |
| `booking_request_expiry` | hourly | T2/E2 — expire stale `requested`/`pending` bookings, release slots |
