# Day 8 — Equipment + FPO

**Dev A (Backend) goal:** Equipment listing, weekly slot generation, slot booking rules (max-2/day, FPO auto-confirm, waitlist, ≤2h cancel), owner fleet CRUD, and FPO profile/pools/machinery endpoints work — plus owner approve/reject with waitlist promotion and machine doc verification.
**Dev B (Flutter) goal:** Equipment weekly-calendar booking UI, new machine-manage and slot-calendar-manage owner screens, and the FPO view (pool progress, join dialog, machinery calendar) are wired — plus the owner booking inbox and rejection-reason display.

## Dev A — Backend tasks

### Task A1 — Equipment slots: GET, generate, book with rules, waitlist, cancel

- **Goal:** Yantra time-slot booking with all rules enforced server-side.
- **Depends on:** Day 3 (roles), Day 2 A2 (coins pattern from endpoints — coins award is a simple field increment today)
- **Files to create/modify:**
  - `backend/app/models/equipment.py` (new)
  - `backend/app/routers/equipment.py` (new)
  - `backend/scripts/seed_equipment.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_equipment.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/equipment.py`:
     - `class EquipmentOut(BaseModel)`: `id: str`, `name: str`, `type: str`, `ownerType: str` (`fpo|private`), `hourlyRate: float`, `perAcreRate: float | None`, `distanceKm: float`
     - `class SlotOut(BaseModel)`: `id: str`, `equipmentId: str`, `date: str` (YYYY-MM-DD), `slotName: str`, `duration: str`, `status: str` (`available|booked|pending`), `bookedByName: str | None`, `priceRupees: float`, `recommendedTask: str`
     - `class EquipmentUpsertRequest(BaseModel)`: `name: str`, `type: str`, `ownerType: str` (default `private`), `hourlyRate: float`, `perAcreRate: float | None = None`, `slotTemplate: list[dict] | None = None` (each `{slotName, duration, priceRupees, recommendedTask}`)
  2. Default slot template constant in `backend/app/routers/equipment.py` (from `dummyYantraSlots`, demo_data lines ~567–600):
     ```
     DEFAULT_SLOTS = [
       {"slotName": "6:00 AM – 10:00 AM", "duration": "4 hours", "priceRupees": 800, "recommendedTask": "Ploughing, tilling (जुताई)"},
       {"slotName": "10:00 AM – 2:00 PM", "duration": "4 hours", "priceRupees": 800, "recommendedTask": "Sowing, spraying (बुवाई)"},
       {"slotName": "2:00 PM – 6:00 PM", "duration": "4 hours", "priceRupees": 800, "recommendedTask": "Harvesting, transport (कटाई)"},
       {"slotName": "6:00 PM – 10:00 PM", "duration": "4 hours", "priceRupees": 800, "recommendedTask": "Irrigation, light work (सिंचाई)"},
     ]
     ```
  3. Write `backend/scripts/seed_equipment.py`: seed collection `equipment` with 2 machines — `eq-1` "Mahindra 575 DI Tractor", type `tractor`, ownerType `fpo`, hourlyRate 650, distanceKm 2.5; `eq-2` "Shaktiman Rotavator", type `rotavator`, ownerType `private`, hourlyRate 500, distanceKm 4.0, ownerId `owner-demo`. Print `seeded 2 equipment`.
  4. Write `backend/app/routers/equipment.py` (`router = APIRouter(prefix="/equipment", tags=["equipment"])`):
     - `GET /equipment?type=&lat=&lng=` (farmer, equipmentRental): list collection `equipment` (active only), optional `type` filter; `{ "data": [...] }`.
     - `GET /equipment/{id}/slots?date=` (farmer, equipmentRental): date defaults to today (IST). Slot docs live in `equipment_slots/{equipmentId}_{date}_{slotIndex}`. If none exist for that date, **generate** 4 slots from the equipment's `slotTemplate` (or `DEFAULT_SLOTS`) with `status: "available"`, then return `{ "data": [SlotOut...] }` ordered by slotName start time.
     - `POST /equipment/slots/{slotId}/book` (farmer), body `{ "farmerName": str }`:
       - Slot must exist and be `available` → else 409 `SLOT_UNAVAILABLE`.
       - **Max-2 rule:** count this user's bookings (collection `equipment_bookings`) for the same `date` with status in `booked|pending` → if ≥ 2 → 409 `MAX_SLOTS_PER_DAY` with message `"एक दिन में अधिकतम 2 स्लॉट बुक कर सकते हैं"`.
       - Load the equipment: `ownerType == "fpo"` → booking `status: "booked"`, slot `status: "booked"`; else booking `status: "pending"`, slot `status: "pending"`. Set `bookedByName` on the slot.
       - Award coins: increment `users/{uid}.agriCoins` by 50; return `{ "booking": {...}, "status": <booked|pending>, "agriCoinsEarned": 50 }`.
     - `POST /equipment/slots/{slotId}/waitlist` (farmer): add `{ userId, createdAt }` to `equipment_waitlists/{slotId}_{uid}`; return `{ ok: true }`. Duplicate → 409 `ALREADY_WAITLISTED`.
     - `DELETE /equipment/bookings/{bookingId}` (farmer): booking must belong to user (403 otherwise) and not be cancelled already. **≤2h rule:** parse slot start time (from `slotName` start, e.g. "6:00 AM" on booking `date`) — if now (IST) > start − 2h → 409 `CANCEL_WINDOW_CLOSED`. Set booking + slot status back to `cancelled`/`available`; then promote the earliest waitlist entry: create their booking with status `pending` (private) or `booked` (fpo) and remove the waitlist doc; return `{ ok: true, promotedUserId: <uid|null> }`.
  5. Write `backend/tests/test_equipment.py`:
     - `test_slots_generated_on_first_read`: GET slots for `eq-1` today → 4 slots with the exact default `slotName`s, all `available`.
     - `test_book_fpo_auto_confirms`: book slot on `eq-1` → `status == "booked"`, `agriCoinsEarned == 50`, user coins +50.
     - `test_book_private_pending`: book on `eq-2` → `status == "pending"`.
     - `test_max_two_slots_per_day`: book 2 slots same date → third → 409 `MAX_SLOTS_PER_DAY` (Hindi message present).
     - `test_double_book_same_slot_409`: → `SLOT_UNAVAILABLE`.
     - `test_cancel_within_2h_blocked` and `test_cancel_promotes_waitlist`: cancel a slot starting tomorrow → ok; waitlisted user promoted to booking (`promotedUserId` set). For the ≤2h case, create a slot whose date/start is within the window (construct booking with today's date and a near slot) → 409 `CANCEL_WINDOW_CLOSED`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_equipment.py -v && .venv/bin/python scripts/seed_equipment.py`
- **Expected output:** `6 passed`; `seeded 2 equipment`.

### Task A2 — Equipment owner CRUD + fleet + FPO endpoints

- **Goal:** Owners manage machines and slot templates; farmers see FPO profile, pools, and shared machinery.
- **Depends on:** Day 8 Task A1
- **Files to create/modify:**
  - `backend/app/routers/equipment.py` (modify — owner endpoints)
  - `backend/app/routers/fpo.py` (new)
  - `backend/scripts/seed_fpo.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_equipment_owner.py` (new)
  - `backend/tests/test_fpo.py` (new)
- **Subtasks:**
  1. Owner endpoints in `backend/app/routers/equipment.py` (role equipmentRental):
     - `POST /equipment`: body `EquipmentUpsertRequest` → create with `ownerId: uid`, force `ownerType: "private"`, `active: true`, `distanceKm: 0`. Return created.
     - `PUT /equipment/{id}`: owner-only (403 `NOT_EQUIPMENT_OWNER`); update fields incl. `slotTemplate` (validate: 1–8 entries, each with the 4 keys).
     - `GET /equipment/owner/fleet`: `{ "data": [{ "equipmentId", "name", "bookedHoursThisWeek": <slots with status booked|pending this ISO week × 4>, "weeklyIncome": <sum priceRupees of booked slots this week>, "status": "active" }] }` for the owner's machines.
  2. Write `backend/scripts/seed_fpo.py`: seed doc `fpos/sahyadri-fpo` `{ name: "Sahyadri Shetkari FPO", memberCount: 214, district: "Nashik" }`; collection `fpo_pools`: `pool-1` `{ id, item: "Nano Urea (500 ml)", bookedUnits: 380, targetUnits: 500, discountPercent: 18, deadline: <today+10d iso> }`. Print `seeded 1 fpo, 1 pool`.
  3. Write `backend/app/routers/fpo.py` (`router = APIRouter(prefix="/fpo", tags=["fpo"])`, role farmer):
     - `GET /me`: return the farmer's FPO — dev rule: first doc in `fpos` (single-FPO dev mode; add `fpoId` to the user doc when present).
     - `GET /pools`: `{ "data": [...] }` from `fpo_pools`.
     - `POST /pools/{id}/join`: body `{ units: int }` (≥1 else 422); increment `bookedUnits` by units (cap at `targetUnits` — if full → 409 `POOL_FULL`); record `fpo_pools/{id}/members/{uid}` `{ units, joinedAt }`; return updated pool.
     - `GET /machinery?week=`: return slots for all `equipment` where `ownerType == "fpo"` for the 7 days of the requested ISO week (default current week), grouped: `{ "data": [{ "equipmentId", "name", "days": { "2026-09-14": [SlotOut...], ... } }] }` (reuse the slot-generation logic from A1).
  4. Write `backend/tests/test_equipment_owner.py`:
     - `test_owner_create_update_machine`: POST → appears; PUT new `slotTemplate` with 2 custom slots → GET slots next day returns the custom slots.
     - `test_owner_forbidden_for_farmer`: farmer POST → 403.
     - `test_fleet_summary`: book a slot on owner's machine → `bookedHoursThisWeek == 4`, `weeklyIncome == 800`.
  5. Write `backend/tests/test_fpo.py`:
     - `test_fpo_me`: name + memberCount.
     - `test_pool_join_increments`: join 5 units → `bookedUnits == 385`.
     - `test_pool_full_409`: join past target → `POOL_FULL`.
     - `test_machinery_calendar`: returns `eq-1` with 7 days of slots.
- **Test:** `cd backend && .venv/bin/pytest tests/test_equipment_owner.py tests/test_fpo.py -v`
- **Expected output:** `3 passed` + `4 passed`.

## Dev B — Flutter tasks

### Task B1 — Equipment booking weekly calendar UI

- **Goal:** Port `equipment_view.dart` to the live slot API with the weekly calendar.
- **Depends on:** Day 3 Task B1 (api client). API dependency: Day 8 Task A1.
- **Files to create/modify:**
  - `apps/mobile/lib/api/equipment_api.dart` (new)
  - `apps/mobile/lib/views/equipment_view.dart` (modify — port from `flutter-prototype/lib/views/equipment_view.dart`)
  - `apps/mobile/test/equipment_view_test.dart` (new)
- **Subtasks:**
  1. `apps/mobile/lib/api/equipment_api.dart`: `getEquipment({type})`, `getSlots(equipmentId, date)`, `bookSlot(slotId, farmerName)`, `joinWaitlist(slotId)`, `cancelBooking(bookingId)`; owner methods for B2: `createEquipment`, `updateEquipment`, `getOwnerFleet`.
  2. `equipment_view.dart`: machine selector row from `getEquipment()` (name, type, hourly rate, distance, FPO badge when `ownerType == 'fpo'`).
  3. Weekly calendar: 7 day-columns starting today; per selected day call `getSlots(equipmentId, date)`; render the 4 slot cards colored by status — **green** `available`, **red** `booked` (show `bookedByName`), **yellow** `pending` (show "स्वीकृति लंबित"); each card: slotName, duration, `₹800`, recommended task.
  4. Tap an available slot → confirm sheet (date, slot, price, "Auto-confirm (FPO)" vs "Owner approval needed" note based on ownerType) → `bookSlot` → toast `+50 AgriCoins` and refresh the day. On `ApiException(code: 'MAX_SLOTS_PER_DAY')` show the Hindi server message. On `SLOT_UNAVAILABLE` refresh and show `स्लॉट अब उपलब्ध नहीं`.
  5. Booked/pending slots the current user owns → long-press → cancel → `cancelBooking`; on `CANCEL_WINDOW_CLOSED` show server message. Full slot + not booked by user → "Join waitlist" button → `joinWaitlist`.
  6. `apps/mobile/test/equipment_view_test.dart`:
     - `testWidgets('slot colors by status', ...)` — fake api returns 1 slot each of available/booked/pending; pump; assert the three card colors (match by widget key or by status label text).
     - `testWidgets('max-2 error shows Hindi message', ...)` — fake throws `ApiException(code: 'MAX_SLOTS_PER_DAY', message: 'एक दिन में अधिकतम 2 स्लॉट बुक कर सकते हैं')`; tap book; expect that text.
     - `testWidgets('waitlist button on full slot', ...)` — expect join-waitlist affordance visible for a booked slot not owned by user.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/equipment_view_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: book FPO slot → instantly green→red with your name; private slot → yellow pending.

### Task B2 — Owner screens (machine-manage, slot-calendar-manage) + FPO view

- **Goal:** Equipment-owner management screens and the FPO farmer view.
- **Depends on:** Day 8 Task B1. API dependency: Day 8 Task A2.
- **Files to create/modify:**
  - `apps/mobile/lib/views/equipment_owner/machine_manage_view.dart` (new screen)
  - `apps/mobile/lib/views/equipment_owner/slot_calendar_manage_view.dart` (new screen)
  - `apps/mobile/lib/views/profile_home/equipment_owner_home_view.dart` (modify — wire fleet)
  - `apps/mobile/lib/api/fpo_api.dart` (new)
  - `apps/mobile/lib/views/fpo_engine_view.dart` (modify — port from `flutter-prototype/lib/views/fpo_engine_view.dart`)
  - `apps/mobile/lib/state/profile_routes.dart` (modify — add owner routes)
  - `apps/mobile/test/fpo_view_test.dart` (new)
- **Subtasks:**
  1. New `machine_manage_view.dart`: list of owner's machines (from `getOwnerFleet` or a `getMyEquipment` helper — if only `/equipment?type=` exists, filter client-side by ownerId; prefer adding a small `getOwnerFleet()` and rendering `name, bookedHoursThisWeek, weeklyIncome`); FAB "Add machine" → form: name, type dropdown (tractor/rotavator/harvester/drone sprayer), hourlyRate, optional perAcreRate → `createEquipment`. Edit opens same form prefilled → `updateEquipment`.
  2. New `slot_calendar_manage_view.dart`: pick a machine → edit its `slotTemplate`: list of slots with editable slotName (time range text), priceRupees, recommendedTask; add/remove slot rows (1–8); Save → `updateEquipment` with the new template. Note text: "नए स्लॉट अगले दिन से लागू होंगे" (generated slots apply to new days).
  3. `equipment_owner_home_view.dart`: wire the fleet status list to `getOwnerFleet()` (booking hrs, fare/income, status per machine); add quick actions to the two new screens.
  4. `apps/mobile/lib/api/fpo_api.dart`: `getFpoMe()`, `getPools()`, `joinPool(id, units)`, `getMachinery({week})`.
  5. `fpo_engine_view.dart` (port): FPO banner from `getFpoMe()` (name, member count); bulk procurement pool card from `getPools()` — item, `380/500 booked`, `18% discount`, progress bar (`bookedUnits/targetUnits`), "Join" button → dialog with units stepper → `joinPool` → progress bar updates; full pool → show server `POOL_FULL` message; shared machinery calendar → `getMachinery()` week strip showing FPO machines' slot availability (green/yellow/red dots per day).
  6. Register routes `machineManage`, `slotCalendarManage` in `profile_routes.dart` for `equipmentRental`.
  7. `apps/mobile/test/fpo_view_test.dart`:
     - `testWidgets('pool progress bar and join dialog', ...)` — fake api: booked 380/500; expect progress value 0.76 and text `380/500`; open join dialog, set 5 units, confirm → fake records `joinPool('pool-1', 5)`.
     - `testWidgets('fpo banner shows name and members', ...)` — expect `Sahyadri Shetkari FPO` and `214`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/fpo_view_test.dart` + manual: join the pool (progress moves); add a machine as equipment owner; edit a slot template and confirm next-day slots use it.
- **Expected output:** `No issues found!`; 2 tests pass; manual checks green.

## Additional tasks (from missing.md)

### Task A3 — Equipment booking approve / reject (private machines) + waitlist promotion

- **Goal:** Owners of private machines decide on `pending` bookings; rejection frees the slot and promotes the waitlist head; both parties are notified. Spec: `docs/overview/03 … Part C/D item E2`.
- **Depends on:** Day 8 Task A1; Day 7 Task A3 (`app/services/notifications.py` — reuse `send_fcm_to_user`)
- **Files to create/modify:**
  - `backend/app/models/equipment.py` (modify)
  - `backend/app/routers/equipment.py` (modify)
  - `backend/tests/test_equipment_approve.py` (new)
- **Subtasks:**
  1. Add model in `backend/app/models/equipment.py`: `class RejectEquipmentBookingRequest(BaseModel)`: `reason: str` (min length 3).
  2. Endpoints in `backend/app/routers/equipment.py` (role equipmentRental):
     - `GET /equipment/bookings/pending`: all `pending` bookings across the caller's machines, each joined with slot (`date`, `slotName`, `priceRupees`) and equipment name: `{ "data": [{ "bookingId", "equipmentId", "equipmentName", "farmerName", "date", "slotName", "priceRupees", "createdAt" }] }`.
     - `POST /equipment/bookings/{id}/approve`: load booking → slot → equipment; `equipment.ownerId == uid` else 403 `NOT_EQUIPMENT_OWNER`; booking must be `status == "pending"` else 409 `ILLEGAL_TRANSITION`. Set booking + slot `status: "booked"`; `send_fcm_to_user(booking.userId, "बुकिंग स्वीकृत", ...)`; return the booking.
     - `POST /equipment/bookings/{id}/reject`: same ownership + pending checks; set booking `status: "rejected"`, `rejectionReason: body.reason`, slot back to `available`; **promote the waitlist head** — earliest `equipment_waitlists` entry for that slot → create their booking with `status: "pending"` (private machine) / `"booked"` (fpo), reusing the A1 booking-creation logic, and delete the waitlist doc; FCM to the rejected farmer (reason in the body) AND to the promoted farmer; return `{ "ok": true, "promotedUserId": <uid|null> }`.
  3. Write `backend/tests/test_equipment_approve.py`:
     - `test_approve_pending_booking`: → booking + slot `booked`; notification doc for the farmer.
     - `test_approve_non_pending_409`: approve an already-booked booking → 409 `ILLEGAL_TRANSITION`.
     - `test_reject_frees_slot_with_reason`: → booking `rejected` with `rejectionReason`, slot `available` again.
     - `test_reject_promotes_waitlist_head`: waitlisted user exists → `promotedUserId` set, new `pending` booking created for that user, waitlist doc gone.
     - `test_non_owner_approve_403`: farmer or another owner → 403 `NOT_EQUIPMENT_OWNER`.
     - `test_reject_without_reason_422`; `test_pending_inbox_lists_owner_pending_only`: two owners with machines → each sees only his machines' pending bookings.
- **Test:** `cd backend && .venv/bin/pytest tests/test_equipment_approve.py -v`
- **Expected output:** `7 passed`.

### Task A4 — Equipment document verification (machine KYC)

- **Goal:** Unverified machines are hidden from farmers until an admin verifies their documents. Spec: `docs/overview/03 … Part C/D item E1`.
- **Depends on:** Day 8 Task A2 (owner fleet)
- **Files to create/modify:**
  - `backend/app/models/equipment.py` (modify)
  - `backend/app/routers/equipment.py` (modify)
  - `backend/scripts/seed_equipment.py` (modify)
  - `backend/tests/test_equipment_owner.py` (modify — add tests)
- **Subtasks:**
  1. Equipment docs gain `docStatus: str` (`pending|verified|rejected`, default `pending` on owner-created machines) and `rejectionReason: str | None = None`; `EquipmentUpsertRequest` gains optional `rcDocUrl: str | None`, `insuranceDocUrl: str | None` — mirroring the vehicle fields from Day 7 Task A4 exactly. Admin verify/reject lives in the admin KYC queue (Day 14, item A1) — one-line comment.
  2. Update `scripts/seed_equipment.py`: `eq-1` and `eq-2` seeded with `docStatus: "verified"` so existing Day 8 flows keep working.
  3. Farmer-facing visibility: `GET /equipment` returns only `docStatus == "verified"` machines; `GET /equipment/{id}/slots` for a non-verified machine → 404 `EQUIPMENT_NOT_FOUND` (don't leak its existence). Owner-facing endpoints (`GET /equipment/owner/fleet`, PUT) always include `docStatus`/`rejectionReason` regardless.
  4. Add tests in `backend/tests/test_equipment_owner.py`:
     - `test_new_machine_pending_hidden_from_farmers`: owner POST → `docStatus == "pending"`; farmer `GET /equipment` does NOT list it; `GET /equipment/{id}/slots` → 404.
     - `test_verified_machine_visible`: flip `docStatus` to `verified` in the seed (standing in for the admin action) → listed, slots generate.
     - `test_fleet_includes_doc_status`: owner fleet rows carry `docStatus`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_equipment_owner.py -v && .venv/bin/python scripts/seed_equipment.py`
- **Expected output:** All tests pass (3 existing + 3 new = `6 passed`); seed unchanged count with verified statuses.

### Task B3 — Owner booking inbox + rejection-reason display

- **Goal:** Equipment owners act on pending bookings from the slot-calendar-manage screen; farmers see WHY a booking was rejected. Spec: `docs/overview/03 … Part C/D item E2`.
- **Depends on:** Day 8 Task B2. API dependency: Day 8 Task A3 (same day).
- **Files to create/modify:**
  - `apps/mobile/lib/api/equipment_api.dart` (modify — `getPendingBookings`, `approveBooking`, `rejectBooking`)
  - `apps/mobile/lib/views/equipment_owner/slot_calendar_manage_view.dart` (modify — pending section)
  - `apps/mobile/lib/views/equipment_view.dart` (modify — rejected reason on farmer booking card)
  - `apps/mobile/test/equipment_owner_inbox_test.dart` (new)
- **Subtasks:**
  1. `equipment_api.dart`: `getPendingBookings()` → GET `/equipment/bookings/pending`; `approveBooking(String id)`; `rejectBooking(String id, String reason)`.
  2. `slot_calendar_manage_view.dart`: new top section `लंबित बुकिंग` (above the template editor) listing `getPendingBookings()` — row per booking: farmer name, machine, date, slot name, ₹ price; actions:
     - **स्वीकारें** → `approveBooking` → row removed, toast `बुकिंग स्वीकृत`.
     - **अस्वीकारें** → reason dialog (text field min 3 chars + quick chips `मशीन खराब`, `ऑपरेटर उपलब्ध नहीं`, `तारीख सूट नहीं`) → `rejectBooking`.
     - On 409 `ILLEGAL_TRANSITION` → show server message and refresh.
  3. `equipment_view.dart` (farmer side): the farmer's own booking card handles the new `rejected` status — red chip `अस्वीकृत` plus the `rejectionReason` text below it, and a `फिर से बुक करें` affordance that scrolls to the slot grid.
  4. `apps/mobile/test/equipment_owner_inbox_test.dart`:
     - `testWidgets('pending bookings listed with farmer and slot', ...)`.
     - `testWidgets('approve records call and removes row', ...)`.
     - `testWidgets('reject blocked without reason, chip fills it', ...)`.
     - `testWidgets('farmer booking card shows rejection reason', ...)` — pump equipment view with a rejected booking carrying `rejectionReason: 'मशीन खराब'` → expect the reason text.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/equipment_owner_inbox_test.dart`
- **Expected output:** `No issues found!`; 4 tests pass; manual: farmer books a private slot → owner approves/rejects from the inbox → farmer sees the outcome (with reason on reject).

## Done-when checklist (end of day)

- [ ] Slot generation: first GET creates the 4 default slots with exact names/tasks from the prototype.
- [ ] Booking rules verified by pytest: FPO auto-confirm, private pending, 409 `MAX_SLOTS_PER_DAY` on 3rd, 409 `SLOT_UNAVAILABLE` on double-book.
- [ ] Cancel ≤2h → 409 `CANCEL_WINDOW_CLOSED`; valid cancel promotes waitlist (`promotedUserId`).
- [ ] Owner CRUD + fleet summary + custom slot templates pass pytest; farmer → 403 on owner endpoints.
- [ ] FPO: `/me`, `/pools`, join (409 `POOL_FULL`), `/machinery` week calendar all pass pytest.
- [ ] `cd backend && .venv/bin/pytest -v` → full suite green.
- [ ] Equipment weekly calendar UI: green/red/yellow slots, booking flow, waitlist, cancel, Hindi error messages.
- [ ] New screens `machine_manage_view.dart`, `slot_calendar_manage_view.dart` work and are routed for equipmentRental.
- [ ] FPO view: banner, pool progress + join, machinery calendar live.
- [ ] `flutter analyze` 0 issues; equipment + FPO tests pass.
- [ ] `POST /v1/equipment/bookings/{id}/approve|reject` pytest green (7 tests): pending-only 409, owner-only 403, reject frees the slot, waitlist head promoted (`promotedUserId`), notification docs for both parties (E2).
- [ ] Machine KYC: owner-created machines `docStatus: pending` and hidden from `GET /v1/equipment` + slots (404); seeded machines verified; fleet shows docStatus (E1).
- [ ] `slot_calendar_manage_view.dart` has the `लंबित बुकिंग` inbox with approve/reject + reason dialog (E2).
- [ ] Farmer booking card shows `rejected` chip with `rejectionReason` and a re-book affordance (E2).
