# Day 7 — Contracts + Transport

**Dev A (Backend) goal:** Contract listing/detail/e-sign acceptance, vehicle types + fare estimate + booking state machine, and new transporter owner vehicle-management endpoints work — plus booking accept/reject with reasons, vehicle doc verification, POD capture, and lot-linked pickups.
**Dev B (Flutter) goal:** Buyers/contracts screen with e-sign dialog, vehicle booking with fare estimate, transporter dashboard, and new vehicle-manage / vehicle-calendar / trip-detail screens — plus the transporter booking inbox and POD capture in trip detail.

## Dev A — Backend tasks

### Task A1 — Contracts: GET list/detail + POST accept (e-sign)

- **Goal:** Pre-sowing price-lock contracts with MPIN-verified e-sign.
- **Depends on:** Day 2 Task A2 (mpin verify), Day 3 (roles). Roles: farmer, seller, broker (accept: farmer, seller).
- **Files to create/modify:**
  - `backend/app/models/contracts.py` (new)
  - `backend/app/routers/contracts.py` (new)
  - `backend/scripts/seed_contracts.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_contracts.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/contracts.py`:
     - `class ContractOut(BaseModel)`: `id`, `buyerCompany: str`, `buyerRating: float`, `crop: str`, `lockedRateQuintal: float`, `mspCurrentRate: float`, `premiumAboveMSP: float`, `minQuantityQuintals: float`, `deliveryLocation: str`, `paymentTerms: str`, `status: str` (`open|accepted|expired`), `contractDuration: str`
     - `class AcceptContractRequest(BaseModel)`: `signatureData: str` (base64 PNG of the drawn signature), `consentTimestamp: str` (ISO 8601), `mpin: str`
  2. Write `backend/scripts/seed_contracts.py`: seed collection `contracts` with the 3 `dummyBuyerContracts` from `flutter-prototype/lib/data/demo_data.dart` (lines ~261–300) — preserve all field values exactly; add a `termsText` field (2–3 Hindi/English sentences) for the terms dialog. Print `seeded 3 contracts`.
  3. Write `backend/app/routers/contracts.py` (`router = APIRouter(prefix="/contracts", tags=["contracts"])`):
     - `GET /contracts?status=`: list, optional status filter, pagination envelope.
     - `GET /contracts/{id}`: detail + `termsText`. 404 `CONTRACT_NOT_FOUND`.
     - `POST /contracts/{id}/accept` (roles farmer, seller):
       - Load user, `verify_mpin(body.mpin, user["mpinHash"])` → wrong → 401 `WRONG_MPIN`; not set → 409 `MPIN_NOT_SET`.
       - Contract must be `status == "open"` else 409 `CONTRACT_NOT_OPEN`.
       - Store acceptance subdoc `contracts/{id}/acceptances/{uid}`: `{ userId, signatureData, consentTimestamp, acceptedAt }`; set contract `status: "accepted"`, `acceptedBy: uid`.
       - Return `{ ok: true, status: "accepted", contractId: id }`.
  4. Include router in `app/main.py`.
  5. Write `backend/tests/test_contracts.py`:
     - `test_list_contracts`: 3 seeded, filter `status=open`.
     - `test_detail_includes_terms`.
     - `test_accept_success`: set mpin first → accept → contract status `accepted`, acceptance doc has `signatureData`.
     - `test_accept_wrong_mpin`: → 401 `WRONG_MPIN`.
     - `test_accept_already_accepted`: second accept → 409 `CONTRACT_NOT_OPEN`.
     - `test_accept_broker_forbidden`: broker role → 403.
- **Test:** `cd backend && .venv/bin/pytest tests/test_contracts.py -v && .venv/bin/python scripts/seed_contracts.py`
- **Expected output:** `6 passed`; `seeded 3 contracts`.

### Task A2 — Transport: vehicles, fare estimate, bookings state machine, owner endpoints

- **Goal:** Bookable vehicle types, fare calc, trip lifecycle, and transporter vehicle management.
- **Depends on:** Day 3 (roles)
- **Files to create/modify:**
  - `backend/app/models/transport.py` (new)
  - `backend/app/routers/transport.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_transport.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/transport.py`:
     - `class VehicleTypeOut(BaseModel)`: `type: str`, `baseFare: float`, `perKmRate: float`, `capacityTonnes: float`
     - `class FareEstimateRequest(BaseModel)`: `vehicleType: str`, `distanceKm: float`
     - `class FareEstimateOut(BaseModel)`: `baseFare: float`, `distanceFare: float`, `totalFare: float`
     - `class CreateBookingRequest(BaseModel)`: `vehicleType: str`, `distanceKm: float`, `pickup: str`, `drop: str`, `date: str` (YYYY-MM-DD)
     - `class UpdateBookingRequest(BaseModel)`: `status: str` (`accepted|enRoute|delivered|cancelled`)
     - `class OwnerVehicleRequest(BaseModel)`: `vehicleType: str`, `registrationNo: str`, `capacityTonnes: float`, `rcDocUrl: str | None = None`, `insuranceDocUrl: str | None = None`
  2. Vehicle types constant in `backend/app/routers/transport.py`: `[{type: "Tata Ace", baseFare: 500, perKmRate: 35, capacityTonnes: 0.75}, {type: "Bolero Maxi", baseFare: 800, perKmRate: 45, capacityTonnes: 1.5}, {type: "Tractor Trolley", baseFare: 1000, perKmRate: 30, capacityTonnes: 3.0}]`.
  3. Endpoints (`router = APIRouter(prefix="/transport", tags=["transport"])`):
     - `GET /vehicles` (farmer, seller, transporter): `{ "data": [VehicleTypeOut...] }` — the constants above.
     - `POST /fare-estimate`: `distanceFare = perKmRate * distanceKm`; `totalFare = baseFare + distanceFare`. Unknown type → 422 `UNKNOWN_VEHICLE_TYPE`.
     - `POST /bookings` (farmer, seller): compute fare via same formula; create `transport_bookings/{id}` `{ id, userId, vehicleType, distanceKm, pickup, drop, date, fare, status: "requested", vehicleId: None, vehicleNo: None, createdAt }`. Return the booking.
     - `GET /bookings?status=` (transporter): trips assigned to this transporter's vehicles OR all `requested` ones (dispatch view); pagination envelope. (Simplify: return bookings where `status == "requested"` OR `vehicleId in` owner's vehicles.)
     - `PATCH /bookings/{id}` (transporter): body `UpdateBookingRequest`; enforce state machine — allowed transitions: `requested→accepted`, `requested→cancelled`, `accepted→enRoute`, `accepted→cancelled`, `enRoute→delivered`. Illegal → 409 `ILLEGAL_TRANSITION`. On `accepted`, require the booking to be linked to one of the transporter's vehicles: accept optional `vehicleId` + `vehicleNo` fields on `UpdateBookingRequest` (add them, optional) and store.
     - Owner endpoints (transporter role), collection `vehicles`:
       - `POST /vehicles`: body `OwnerVehicleRequest` → create with `ownerId: uid`, `active: true`.
       - `GET /vehicles/my`: owner's vehicles.
       - `PUT /vehicles/{id}` / `DELETE /vehicles/{id}`: owner-only (403 `NOT_VEHICLE_OWNER`); DELETE soft-deletes (`active: false`).
       - `GET /vehicles/{id}/calendar`: return `{ "vehicleId", "bookings": [{ "bookingId", "date", "status", "pickup", "drop" }] }` from bookings where `vehicleId == id` and status in `accepted|enRoute`.
       - `PUT /vehicles/{id}/availability`: body `{ "availableDates": ["2026-09-20", ...] }` → store on the vehicle doc; return updated vehicle.
  4. Write `backend/tests/test_transport.py`:
     - `test_vehicle_types`: 3 types returned.
     - `test_fare_estimate`: Tata Ace, 20 km → `distanceFare == 700`, `totalFare == 1200`.
     - `test_booking_lifecycle`: farmer books → status `requested`; transporter PATCH `accepted` (with vehicleId/vehicleNo) → ok; PATCH `enRoute` → ok; PATCH `delivered` → ok.
     - `test_illegal_transition`: `requested → delivered` → 409 `ILLEGAL_TRANSITION`; `delivered → cancelled` → 409.
     - `test_owner_vehicle_crud`: POST vehicle → GET /vehicles/my contains it; PUT updates registrationNo; DELETE soft-deletes; another transporter PUT → 403.
     - `test_vehicle_calendar_and_availability`: accepted booking appears in `/{id}/calendar`; PUT availability stores dates.
- **Test:** `cd backend && .venv/bin/pytest tests/test_transport.py -v`
- **Expected output:** `6 passed`.

## Dev B — Flutter tasks

### Task B1 — Buyers/contracts screen + e-sign dialog + vehicle booking flow

- **Goal:** Port `buyers_view.dart` (2 tabs) onto the contracts and transport APIs.
- **Depends on:** Day 3 Task B1 (api client). API dependency: Day 7 Task A1 + A2 (same day — sequence: Dev A A1 first).
- **Files to create/modify:**
  - `apps/mobile/lib/api/contracts_api.dart` (new)
  - `apps/mobile/lib/api/transport_api.dart` (new)
  - `apps/mobile/lib/views/buyers_view.dart` (modify — port from `flutter-prototype/lib/views/buyers_view.dart`)
  - `apps/mobile/test/buyers_view_test.dart` (new)
- **Subtasks:**
  1. `apps/mobile/lib/api/contracts_api.dart`: `getContracts({status})`, `getContract(id)`, `acceptContract(id, signatureData, consentTimestamp, mpin)`.
  2. `apps/mobile/lib/api/transport_api.dart`: `getVehicleTypes()`, `fareEstimate(vehicleType, distanceKm)`, `createBooking(...)`, `getBookings({status})`, `updateBooking(id, status, {vehicleId, vehicleNo})` plus owner methods for Task B2 (`getMyVehicles`, `createVehicle`, `updateVehicle`, `deleteVehicle`, `getVehicleCalendar`, `setAvailability`).
  3. Tab 1 (contracts): cards from `getContracts(status: 'open')` — buyer company + rating, crop, locked rate/quintal, premium above MSP, min quantity, delivery location, payment terms, duration. Terms dialog → `getContract(id)` → show `termsText`.
  4. **E-sign dialog** (keep prototype design): signature pad (prototype uses a CustomPaint canvas — keep it; export via `toImage` → PNG → base64), consent checkbox with timestamp, MPIN 4-digit field. Submit → `acceptContract`; on 401 `WRONG_MPIN` shake + inline error `गलत MPIN`; on success close dialog, toast `अनुबंध स्वीकृत`, refresh list (accepted contract disappears from `open`).
  5. Tab 2 (vehicle booking): vehicle dropdown from `getVehicleTypes()` showing `Tata Ace — ₹500 base + ₹35/km` etc.; distance slider 1–100 km; on change call `fareEstimate` (debounced 300 ms) and show live fare breakdown `Base ₹500 + Distance ₹700 = ₹1,200`; Book button → `createBooking` with pickup (profile village) / drop (nearest mandi name from `/mandi/list`) / date (tomorrow default) → success toast `बुकिंग भेजी गई`.
  6. `apps/mobile/test/buyers_view_test.dart`:
     - `testWidgets('contract cards render from API', ...)` — fake api, 2 contracts; expect company names + `₹/quintal` text.
     - `testWidgets('e-sign wrong mpin shows error', ...)` — fake throws 401 `WRONG_MPIN`; submit; expect `गलत MPIN`.
     - `testWidgets('fare estimate updates on slider', ...)` — fake returns totalFare 1200 for 20 km; move slider; expect `₹1,200` visible.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/buyers_view_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: accept a contract end-to-end with MPIN; book a Tata Ace.

### Task B2 — Transporter dashboard + vehicle-manage + vehicle-calendar + trip-detail

- **Goal:** Transporter persona screens wired; two new management screens.
- **Depends on:** Day 7 Task B1. API dependency: Day 7 Task A2.
- **Files to create/modify:**
  - `apps/mobile/lib/views/profile_home/transport_home_view.dart` (modify — port from `flutter-prototype/lib/views/profile_home/transport_home_view.dart`, wire live trips)
  - `apps/mobile/lib/views/transporter/trip_detail_view.dart` (new screen)
  - `apps/mobile/lib/views/transporter/vehicle_manage_view.dart` (new screen)
  - `apps/mobile/lib/views/transporter/vehicle_calendar_view.dart` (new screen)
  - `apps/mobile/lib/state/profile_routes.dart` (modify — register new routes for transporter)
  - `apps/mobile/test/vehicle_manage_test.dart` (new)
- **Subtasks:**
  1. `transport_home_view.dart`: keep the persona template (blue `#0284C7` banner, 3 metric pills, quick actions, live trips list). Replace the demo trips list with `transportApi.getBookings()` — each row: vehicle no. (or `—` while unassigned), route `pickup → drop`, fare ₹, status chip. Pull-to-refresh.
  2. New `trip_detail_view.dart`: opened from a trips-list row. Shows full booking fields + status action buttons driven by the state machine: `requested` → [Accept (choose vehicle from `getMyVehicles` dropdown), Decline→`cancelled`]; `accepted` → [Start trip → `enRoute`, Cancel]; `enRoute` → [Mark delivered]. Each action calls `updateBooking` and pops with refresh. Illegal-transition 409 shows the server message.
  3. New `vehicle_manage_view.dart`: list of `getMyVehicles()` (registration no., type, capacity, active state); FAB "Add vehicle" → form sheet: vehicleType dropdown (3 types), registrationNo text field, capacityTonnes number field, and two upload buttons (RC doc, insurance doc) that pick a file (use `image_picker` — add `image_picker: ^1.1.2` to pubspec) and upload to Firebase Storage path `vehicles/{uid}/rc_<timestamp>.jpg` via `firebase_storage` (add `firebase_storage: ^12.3.4`) then put the download URL in `rcDocUrl`/`insuranceDocUrl`. Save → `createVehicle`. Row edit → `updateVehicle`; delete → confirm dialog → `deleteVehicle` (soft).
  4. New `vehicle_calendar_view.dart`: week strip for one vehicle; calls `getVehicleCalendar(id)` → booked dates marked with a blue dot + route label; "Set availability" toggle per day → `setAvailability(id, dates)`.
  5. Register routes in `profile_routes.dart`: add `tripDetail`, `vehicleManage`, `vehicleCalendar` to the transporter route set; add entry points (buttons) on `transport_home_view.dart` quick actions ("My Vehicles" → vehicleManage).
  6. `apps/mobile/test/vehicle_manage_test.dart`:
     - `testWidgets('vehicle list renders and add form validates', ...)` — fake api with 1 vehicle; expect registration no. visible; open add form, Save with empty registration → validation error text; fill → fake records `createVehicle`.
     - `testWidgets('trip detail accept assigns vehicle', ...)` — pump trip detail with a `requested` booking; choose vehicle; tap Accept; assert `updateBooking(id, 'accepted', vehicleId: ...)` recorded.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/vehicle_manage_test.dart` + manual: full lifecycle book (as farmer) → accept/start/deliver (as transporter); add a vehicle with RC photo.
- **Expected output:** `No issues found!`; 2 tests pass; manual lifecycle and vehicle CRUD work against the dev backend.

## Additional tasks (from missing.md)

### Task A3 — Booking accept / reject with reason + farmer notification

- **Goal:** Transporters get a real request-inbox API: accept assigns a vehicle, reject carries a reason, and the farmer is told either way. Spec: `docs/overview/03 … Part C/D item T2`.
- **Depends on:** Day 7 Task A2
- **Files to create/modify:**
  - `backend/app/services/notifications.py` (new)
  - `backend/app/models/transport.py` (modify)
  - `backend/app/routers/transport.py` (modify)
  - `backend/tests/test_booking_accept.py` (new)
- **Subtasks:**
  1. Write `backend/app/services/notifications.py`:
     - `async def send_fcm_to_user(uid: str, title: str, body: str, data: dict)`: if firebase-admin is initialised, `messaging.send` to topic `user_{uid}` (token-based FCM lands Day 13 — comment); ALWAYS also append to collection `notifications` `{ "userId", "title", "body", "data", "read": false, "createdAt": <utc iso> }` so an in-app inbox works without FCM.
  2. Add models in `backend/app/models/transport.py`:
     - `class AcceptBookingRequest(BaseModel)`: `vehicleId: str | None = None`, `vehicleNo: str | None = None`
     - `class RejectBookingRequest(BaseModel)`: `reason: str` (min length 3)
  3. Endpoints in `app/routers/transport.py` (role transport):
     - `POST /bookings/{id}/accept`: booking must be `status == "requested"` else 409 `ILLEGAL_TRANSITION`; optional vehicle assignment stored as in PATCH (with the Day 7 A4 verification check once Task A4 lands); set `status: "accepted"`; `send_fcm_to_user(booking["userId"], "बुकिंग स्वीकृत", f"{vehicleNo or 'वाहन'} आपकी बुकिंग स्वीकार कर रहा है", {"type": "booking_accepted", "bookingId": id})`; return the booking.
     - `POST /bookings/{id}/reject`: must be `requested` else 409 `ILLEGAL_TRANSITION`; set `status: "cancelled"`, `cancellationReason: body.reason`, `cancelledBy: "transporter"`; FCM to the farmer with the reason in the body; return the booking.
  4. Keep `PATCH /bookings/{id}` working for existing clients — one-line comment that accept/reject are the canonical paths now.
  5. Write `backend/tests/test_booking_accept.py`:
     - `test_accept_requested_booking`: → 200 `accepted`, vehicle stored, a `notifications` doc exists for the farmer with `type: booking_accepted`.
     - `test_accept_non_requested_409`: accept an already-accepted booking → 409 `ILLEGAL_TRANSITION`.
     - `test_reject_with_reason`: → `cancelled`, `cancellationReason` stored, farmer notification body contains the reason.
     - `test_reject_without_reason_422`.
     - `test_farmer_cannot_accept_403`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_booking_accept.py -v`
- **Expected output:** `5 passed`.

### Task A4 — Vehicle document verification (transporter KYC)

- **Goal:** Only document-verified vehicles can be assigned to bookings. Spec: `docs/overview/03 … Part C/D item T1`.
- **Depends on:** Day 7 Task A2 (vehicles collection), Task A3 (accept path)
- **Files to create/modify:**
  - `backend/app/models/transport.py` (modify)
  - `backend/app/routers/transport.py` (modify)
  - `backend/tests/test_transport.py` (modify — add tests)
- **Subtasks:**
  1. Vehicle docs gain `docStatus: str` (`pending|verified|rejected`) and `rejectionReason: str | None = None`; `POST /transport/vehicles` creates with `docStatus: "pending"`. The admin verify/reject action itself lives in the admin KYC queue (Day 14, item A1) — one-line comment.
  2. `GET /transport/vehicles/my` output includes `docStatus` + `rejectionReason`, and gains query param `?verifiedOnly=true` → filters to `docStatus == "verified"`.
  3. Assignment enforcement: on `POST /bookings/{id}/accept` (and the PATCH accept path) with a `vehicleId`, the vehicle must have `docStatus == "verified"` else 422 `VEHICLE_NOT_VERIFIED` (ownership 403 `NOT_VEHICLE_OWNER` already exists).
  4. Add tests in `backend/tests/test_transport.py`:
     - `test_new_vehicle_pending_doc_status`: POST → `docStatus == "pending"`.
     - `test_accept_with_unverified_vehicle_422`: accept with a pending vehicle → 422 `VEHICLE_NOT_VERIFIED`.
     - `test_accept_with_verified_vehicle_ok`: flip `docStatus` to `verified` in the seed (standing in for the admin action) → accept succeeds.
     - `test_verified_only_filter`: `?verifiedOnly=true` excludes pending/rejected vehicles.
- **Test:** `cd backend && .venv/bin/pytest tests/test_transport.py -v`
- **Expected output:** All tests pass (6 existing + 4 new = `10 passed`).

### Task A5 — Proof of delivery (POD) required to mark delivered

- **Goal:** A trip can't be marked delivered without photo proof and a receiver name. Spec: `docs/overview/03 … Part C/D item T3`.
- **Depends on:** Day 7 Task A2
- **Files to create/modify:**
  - `backend/app/models/transport.py` (modify)
  - `backend/app/routers/transport.py` (modify)
  - `backend/tests/test_transport.py` (modify — add tests)
- **Subtasks:**
  1. `UpdateBookingRequest` gains optional `podPhotos: list[str] | None = None`, `receiverName: str | None = None`.
  2. On the `enRoute → delivered` transition in `PATCH /bookings/{id}`: require `podPhotos` with ≥ 1 entry (Storage URLs) and non-blank `receiverName`, else 422 `POD_REQUIRED` with `fieldErrors` naming the missing field(s). On success store `pod: { "photos": [...], "receiverName": ..., "deliveredAt": <utc iso> }` on the booking.
  3. `GET /bookings` detail includes the `pod` object when present.
  4. Add tests in `backend/tests/test_transport.py`:
     - `test_delivered_requires_pod`: enRoute booking, PATCH `delivered` without POD fields → 422 `POD_REQUIRED`.
     - `test_delivered_with_pod`: 1 photo URL + receiverName → 200 `delivered`, `pod.receiverName` matches.
     - `test_pod_visible_in_detail`: GET the delivered booking → `pod` present.
- **Test:** `cd backend && .venv/bin/pytest tests/test_transport.py -v`
- **Expected output:** All tests pass (incl. 3 new POD tests).

### Task A6 — Lot-linked pickups: `lotId` on transport bookings

- **Goal:** A produce lot (Day 5 F7) can be tied to a pickup booking so the transporter sees what he's carrying. Spec: `docs/overview/03 … Part C/D item F12`.
- **Depends on:** Day 7 Task A2; Day 5 Task A3 (`produce lots` exist)
- **Files to create/modify:**
  - `backend/app/models/transport.py` (modify)
  - `backend/app/routers/transport.py` (modify)
  - `backend/tests/test_transport.py` (modify — add tests)
- **Subtasks:**
  1. `CreateBookingRequest` gains optional `lotId: str | None = None`.
  2. `POST /bookings` with `lotId`: lot must exist and `farmerId == uid` else 404 `LOT_NOT_FOUND`; lot `status` must be `open` else 409 `LOT_NOT_OPEN`; store `lotId` on the booking.
  3. `GET /bookings` (transporter dispatch view): when a booking has `lotId`, include a nested `lot` summary `{ "crop", "quantityQuintals", "expectedRate" }` via a join lookup (missing lot doc → `lot: null`, don't fail).
  4. Add tests in `backend/tests/test_transport.py`:
     - `test_booking_with_own_open_lot`: → 201/200, `lotId` stored; dispatch GET shows the `lot` summary.
     - `test_booking_with_other_farmers_lot_404`.
     - `test_booking_with_sold_lot_409`: lot `status: "sold"` → 409 `LOT_NOT_OPEN`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_transport.py -v && .venv/bin/pytest -v`
- **Expected output:** Full suite green (incl. 3 new lot-linkage tests).

### Task B3 — Transporter booking inbox

- **Goal:** Incoming booking requests land in an inbox with accept/reject + reason; the dashboard shows a pending count. Spec: `docs/overview/03 … Part C/D item T2`.
- **Depends on:** Day 7 Task B2. API dependency: Day 7 Task A3 + A4 (same day).
- **Files to create/modify:**
  - `apps/mobile/lib/api/transport_api.dart` (modify — `acceptBooking`, `rejectBooking`, `getMyVehicles(verifiedOnly: true)`)
  - `apps/mobile/lib/views/transporter/booking_inbox_view.dart` (new screen)
  - `apps/mobile/lib/views/profile_home/transport_home_view.dart` (modify — badge + entry)
  - `apps/mobile/lib/state/profile_routes.dart` (modify — route `bookingInbox` for transport)
  - `apps/mobile/test/booking_inbox_test.dart` (new)
- **Subtasks:**
  1. `transport_api.dart`: `acceptBooking(String id, {String? vehicleId, String? vehicleNo})`, `rejectBooking(String id, String reason)` → the new endpoints; `getMyVehicles({bool verifiedOnly = false})` passes the query param.
  2. `booking_inbox_view.dart`: lists `getBookings(status: 'requested')` — card per request: `pickup → drop`, date, distance km, fare ₹, and a lot summary block (`crop`, `quantityQuintals`) when the booking has a lot (F12). Actions per card:
     - **Accept** → sheet with vehicle dropdown from `getMyVehicles(verifiedOnly: true)` (empty state: `पहले सत्यापित वाहन जोड़ें` linking to `vehicleManage`) → `acceptBooking`.
     - **Reject** → reason dialog: text field (min 3 chars) + quick-reason chips (`वाहन उपलब्ध नहीं`, `दूरी ज़्यादा`, `तारीख सूट नहीं`) → `rejectBooking`.
     - On 409 `ILLEGAL_TRANSITION` → show server message, refresh the list (someone else took it).
  3. `transport_home_view.dart`: quick action `बुकिंग अनुरोध` with a count badge = number of `requested` bookings (refresh on resume and pull-to-refresh) → opens `bookingInbox`.
  4. `apps/mobile/test/booking_inbox_test.dart`:
     - `testWidgets('incoming requests render with route and fare', ...)`.
     - `testWidgets('accept records vehicleId', ...)` — choose a vehicle, accept; assert fake recorded `acceptBooking(id, vehicleId: ...)`.
     - `testWidgets('reject requires reason', ...)` — confirm with empty reason → validation error, no api call; pick a chip → `rejectBooking(id, reason)` recorded.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/booking_inbox_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: farmer books → appears in transporter inbox with badge → reject with a chip reason → farmer-side booking shows cancelled.

### Task B4 — POD capture step in trip detail

- **Goal:** Marking a trip delivered requires a delivery photo and the receiver's name. Spec: `docs/overview/03 … Part C/D item T3`.
- **Depends on:** Day 7 Task B2. API dependency: Day 7 Task A5 (same day).
- **Files to create/modify:**
  - `apps/mobile/lib/api/transport_api.dart` (modify — `updateBooking` accepts `podPhotos`, `receiverName`)
  - `apps/mobile/lib/views/transporter/trip_detail_view.dart` (modify)
  - `apps/mobile/test/vehicle_manage_test.dart` (modify — add POD test)
- **Subtasks:**
  1. `trip_detail_view.dart`: on an `enRoute` booking, "Mark delivered" no longer fires immediately — it opens a POD step (sheet or inline section): receiver-name text field + photo capture (up to 3 photos, `image_picker` → Firebase Storage `pod/{bookingId}/<timestamp>.jpg` via `firebase_storage`). Submit disabled until receiverName non-empty AND ≥ 1 photo uploaded.
  2. Submit → `updateBooking(id, 'delivered', podPhotos: urls, receiverName: name)` → toast `डिलीवरी पूर्ण`; on 422 `POD_REQUIRED` surface the `fieldErrors` inline (defensive — the local gating should make it unreachable).
  3. Add to `apps/mobile/test/vehicle_manage_test.dart`:
     - `testWidgets('mark delivered blocked without POD, then submits with photo + name', ...)` — pump an `enRoute` booking; submit button disabled; enter receiver name + inject one fake uploaded photo URL; assert `updateBooking` recorded with `podPhotos` and `receiverName`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/vehicle_manage_test.dart`
- **Expected output:** `No issues found!`; tests pass; manual: full trip lifecycle ends with a delivered booking carrying `pod` in the API response.

## Done-when checklist (end of day)

- [ ] `/v1/contracts` list/detail return seeded data; accept requires correct MPIN (401 wrong, 409 re-accept, 403 broker).
- [ ] `/v1/transport/vehicles` returns the 3 types; fare estimate math verified by pytest (Tata Ace 20 km → ₹1,200).
- [ ] Booking state machine enforced: `requested→accepted→enRoute→delivered`, illegal transitions → 409.
- [ ] Owner vehicle CRUD + calendar + availability endpoints pass pytest (owner-only 403).
- [ ] `cd backend && .venv/bin/pytest -v` → full suite green.
- [ ] Buyers screen: contracts from API, e-sign with signature + MPIN works, fare estimate live-updates.
- [ ] Transporter dashboard lists real trips; trip-detail buttons follow the state machine.
- [ ] New screens `vehicle_manage_view.dart` (with Firebase Storage RC/insurance upload) and `vehicle_calendar_view.dart` work.
- [ ] `flutter analyze` 0 issues; buyers + vehicle tests pass.
- [ ] `POST /v1/transport/bookings/{id}/accept|reject`: 409 `ILLEGAL_TRANSITION` unless `requested`; reject stores `cancellationReason`; farmer gets a `notifications` doc on both (T2).
- [ ] Unverified vehicles: `docStatus: pending` on create; accept with one → 422 `VEHICLE_NOT_VERIFIED`; `?verifiedOnly=true` filter works (T1).
- [ ] PATCH `delivered` without `podPhotos`/`receiverName` → 422 `POD_REQUIRED`; POD stored and returned on detail (T3).
- [ ] Bookings accept `lotId` (owner + open-lot validated: 404/409); dispatch list shows the lot summary (F12).
- [ ] `booking_inbox_view.dart` live with reason dialog + dashboard pending-count badge (T2).
- [ ] POD capture step in `trip_detail_view.dart` gates "Mark delivered" on photo + receiver name (T3).
