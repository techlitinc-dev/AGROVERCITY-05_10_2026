# Day 11 — Crop Insurance + My Bookings

**Dev A (Backend) goal:** Insurance policies/apply/certificate/rates, 72-hour claim intimation with photo upload + claim state machine + tracker, and the `GET /v1/users/me/bookings` aggregate all work with pytest coverage.
**Dev B (Flutter) goal:** `crop_insurance_view` (4 tabs) ported and wired end-to-end; new `my_bookings_view` (equipment / vet / transport tabs) built and routed.

## Dev A — Backend tasks

### Task A1 — Insurance policies + rates

- **Goal:** `GET /v1/insurance/policies`, `POST /v1/insurance/policies/apply`, `GET /v1/insurance/policies/{id}/certificate`, `GET /v1/insurance/rates`.
- **Depends on:** Day 2 Task A2 (`current_user_id`), Day 3 (`require_role`), Day 9 Task A1 (`app/services/reports.py` upload helper).
- **Files to create/modify:**
  - `backend/app/models/insurance.py` (new)
  - `backend/app/data/insurance_seed.py` (new)
  - `backend/app/routers/insurance.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_insurance_policies.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/insurance.py` (fields per endpoints.md §12 + `CropInsurancePolicy`/`CropPremiumRate` entities §8):
     - `class CropInsurancePolicy(BaseModel)`: `id: str`, `policyNumber: str`, `schemeName: str`, `cropName: str`, `season: str`, `year: int`, `landAreaAcres: float`, `sumInsured: float`, `farmerPremium: float`, `govtSubsidy: float`, `status: str`, `insuranceCompany: str`, `coverageStartDate: str`, `coverageEndDate: str`, `bankName: str`, `kccAccountNo: str`, `certificateUrl: str | None = None`
     - `class PolicyApplyIn(BaseModel)`: `cropName: str`, `season: Literal["Kharif", "Rabi", "Annual"]`, `landAreaAcres: float = Field(gt=0)`
     - `class CropPremiumRate(BaseModel)`: `id: str`, `cropName: str`, `category: str`, `season: str`, `sumInsuredPerAcre: float`, `farmerSharePercent: float`, `totalActuarialRatePercent: float`, `cutoffDate: str`
  2. Write `backend/app/data/insurance_seed.py` with `async def seed_insurance_rates()`: skip if collection `insurance_rates` non-empty; seed 6 rows — Wheat Kharif (sumInsuredPerAcre 40000, farmerSharePercent 2.0, actuarial 12.5, cutoff 2026-07-31), Onion Kharif (35000/2.0/11.0), Soybean Kharif (30000/2.0/10.0), Wheat Rabi (38000/1.5/9.5, cutoff 2026-12-15), Gram Rabi (32000/1.5/9.0), Sugarcane Annual (90000/5.0/14.0). `category`: `kharif-crops`/`rabi-crops`/`annual`. Call from `app/main.py` startup.
  3. Write `backend/app/routers/insurance.py` (`router = APIRouter(prefix="/insurance", tags=["insurance"])`, roles farmer/farmLandlord). Policies in `users/{uid}/insurance_policies`.
     - `GET /policies`: list subcollection; **if empty, seed one demo policy** — `policyNumber: "PMFBY-2026-0001"`, schemeName `PMFBY`, cropName Wheat, season Kharif, year 2026, landAreaAcres 2.0, sumInsured 80000, farmerPremium 1600, govtSubsidy 8400, status `active`, insuranceCompany `AIC of India`, coverage `2026-07-01`→`2026-12-31`, bankName `SBI`, kccAccountNo `XXXX4521` — then return the envelope.
     - `POST /policies/apply`: find matching rate row by `(cropName, season)` via `query("insurance_rates", [("cropName","==",body.cropName),("season","==",body.season)])` → none → 404 `RATE_NOT_FOUND`. Compute `sumInsured = sumInsuredPerAcre * landAreaAcres`, `farmerPremium = round(sumInsured * farmerSharePercent/100, 2)`, `govtSubsidy = round(sumInsured * (totalActuarialRatePercent - farmerSharePercent)/100, 2)`; `policyNumber = f"PMFBY-{year}-{count+1:04d}"` (count = existing user policies); `status: "active"`, coverage = season window; 201 with the policy.
     - `GET /policies/{id}/certificate`: 404 `POLICY_NOT_FOUND`; generate a 1-page PDF (policy number, crop, sum insured, validity, insurer) reusing `app/services/reports.py` (add `build_policy_certificate_pdf(policy) -> str`); upload to `certificates/{uid}/{policyId}.pdf`; store `certificateUrl` on the doc; return 200 `{ "certificateUrl": url }`.
     - `GET /rates?season=&crop=`: filter `insurance_rates`; envelope.
  4. `app.include_router(insurance.router, prefix="/v1")`.
  5. Write `backend/tests/test_insurance_policies.py`:
     - `test_policies_seeds_demo_on_first_read`: GET → 1 item, `policyNumber == "PMFBY-2026-0001"`.
     - `test_apply_computes_premium_exactly`: `{cropName:"Wheat", season:"Kharif", landAreaAcres:2}` → 201, `sumInsured == 80000`, `farmerPremium == 1600.0`, `govtSubsidy == 8400.0`, `policyNumber` matches `PMFBY-\d{4}-\d{4}`.
     - `test_apply_unknown_crop_404`: → 404 `RATE_NOT_FOUND`.
     - `test_certificate_returns_url`: patch upload → GET certificate → 200 with `certificateUrl`.
     - `test_rates_filter_by_season`: `?season=Kharif` → 3 items.
     - `test_forbidden_for_seller`: → 403 `FORBIDDEN_ROLE`.
     - `test_policy_number_increments`: apply twice → second policy number ends `-0002`.
     - `test_unauthenticated_401`: no Authorization header → 401 `MISSING_TOKEN` on `GET /policies`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_insurance_policies.py -v`
- **Expected output:** `8 passed`. Manual: `curl http://localhost:8000/v1/insurance/rates?season=Kharif -H "Authorization: Bearer $TOKEN"` → 3 rates; `curl -X POST http://localhost:8000/v1/insurance/policies/apply -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"cropName":"Wheat","season":"Kharif","landAreaAcres":2}'` → 201 with `farmerPremium: 1600.0`.

### Task A2 — Claims: multipart photos + state machine + tracker

- **Goal:** `POST /v1/insurance/claims`, `GET /v1/insurance/claims`, `GET /v1/insurance/claims/{id}`.
- **Depends on:** Day 11 Task A1; Day 10 Task A2 (`app/services/storage.py`).
- **Files to create/modify:**
  - `backend/app/models/claims.py` (new)
  - `backend/app/services/claims.py` (new)
  - `backend/app/routers/insurance.py` (modify — add claim routes)
  - `backend/tests/test_insurance_claims.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/claims.py` (per `InsuranceClaimRecord` entity §8):
     - `ClaimStatus = Literal["intimated", "surveyorAssigned", "fieldAssessed", "dbtApproved", "disbursed", "rejected"]`
     - `class ClaimTimelineEntry(BaseModel)`: `status: str`, `at: str`, `note: str`
     - `class InsuranceClaimRecord(BaseModel)`: `id`, `claimNumber`, `policyId`, `cropName`, `calamityType`, `dateOfDamage`, `cropStage`, `estimatedLossPercent: float`, `requestedAmount: float`, `approvedAmount: float | None`, `status: ClaimStatus`, `statusText: str`, `surveyorName: str | None`, `surveyorPhone: str | None`, `surveyorVisitDate: str | None`, `gpsCoordinates: str`, `village: str`, `damagePhotos: list[str]`, `submittedAt: str`, `dbtTransactionId: str | None`, `bankAccountLast4: str | None`, `timeline: list[ClaimTimelineEntry]`
  2. Write `backend/app/services/claims.py`:
     - `CLAIM_TRANSITIONS = {"intimated": ["surveyorAssigned"], "surveyorAssigned": ["fieldAssessed"], "fieldAssessed": ["dbtApproved", "rejected"], "dbtApproved": ["disbursed"], "disbursed": [], "rejected": []}`
     - `STATUS_TEXT = {"intimated": "दावा दर्ज — सर्वेयर नियुक्ति लंबित", "surveyorAssigned": "सर्वेयर नियुक्त", "fieldAssessed": "क्षेत्र मूल्यांकन पूर्ण", "dbtApproved": "DBT स्वीकृत", "disbursed": "राशि वितरित", "rejected": "दावा अस्वीकृत"}`
     - `def advance_status(claim: dict, new_status: str, note: str = "") -> dict`: illegal transition → raise `ValueError`; set `status`, `statusText = STATUS_TEXT[new_status]`, append `timeline` entry `{status: new_status, at: iso, note}`; return updated claim. (Pure function on the dict — the caller persists; this keeps it trivially unit-testable.)
     - `async def next_claim_number(state_code: str) -> str`: format `CLM-YYYY-ST-####` — YYYY = current year, ST = the user's `state` mapped to a 2-letter code (`{"Maharashtra": "MH", "Madhya Pradesh": "MP", "Gujarat": "GJ", "Uttar Pradesh": "UP", "Punjab": "PB", "Rajasthan": "RJ"}`, default `XX`), #### = counter doc `counters/claims_{year}` incremented in a Firestore transaction, zero-padded to 4.
     - `def auto_assign_surveyor(district: str) -> dict`: deterministic pick from 3 mock surveyors by `zlib.crc32(district.encode()) % 3` → `{ surveyorName, surveyorPhone: "+91...", surveyorVisitDate: <today + 3 days iso> }`. Mock pool: `("संदीप कुलकर्णी", "+919811000001")`, `("मीना जाधव", "+919811000002")`, `("अजय भोसले", "+919811000003")`.
  3. Add routes to `backend/app/routers/insurance.py`:
     - `POST /claims` — `multipart/form-data`: fields `policyId, cropName, calamityType, dateOfDamage, cropStage, estimatedLossPercent (0–100, Pydantic `Field(ge=0, le=100)`), gpsCoordinates, village` + files `damagePhotos` (1–5 files; jpeg/png ≤ 5 MB each → 413 `FILE_TOO_LARGE` / 415 `UNSUPPORTED_FILE_TYPE`; zero files → 422). Policy must belong to user (404 `POLICY_NOT_FOUND`). Upload each photo via `storage.upload_user_file(uid, ..., prefix="claims")` and collect the returned URLs into `damagePhotos`. `requestedAmount = round(policy.sumInsured * estimatedLossPercent/100, 2)`. `claimNumber = await next_claim_number(user["state"])`. Create `users/{uid}/insurance_claims/{id}` with `status: "intimated"`, `statusText`, surveyor from `auto_assign_surveyor(user["district"])`, `bankAccountLast4` from user phone last 4 digits, `timeline: [{status: "intimated", at, note: "Claim intimated within 72h window"}]`. Return 201 full `InsuranceClaimRecord`.
     - `GET /claims`: envelope sorted `submittedAt` desc. `GET /claims/{id}`: single record, 404 `CLAIM_NOT_FOUND`. Claim doc ids: `uuid4().hex`; both endpoints read `users/{uid}/insurance_claims` only (a user never sees another user's claim).
  3b. Reuse the vault file-validation rule from Day 10 Task A2 (jpeg/png, ≤ 5 MB) — factor a `validate_upload(file)` helper into `app/services/storage.py` if it isn't already shared, and call it per photo.
  4. Write `backend/tests/test_insurance_claims.py`:
     - `test_submit_claim_with_photos`: seed policy; POST with 2 small PNGs (storage patched) → 201, `claimNumber` matches `CLM-\d{4}-[A-Z]{2}-\d{4}`, `status == "intimated"`, `len(damagePhotos) == 2`, `surveyorName` non-empty, `requestedAmount == sumInsured * 40/100`.
     - `test_claim_foreign_policy_404`: other user's policyId → 404 `POLICY_NOT_FOUND`.
     - `test_claim_no_photos_422`: → 422.
     - `test_state_machine_legal`: `advance_status` intimated→surveyorAssigned → ok, timeline len 2.
     - `test_state_machine_illegal`: intimated→dbtApproved → raises ValueError.
     - `test_claim_list_and_detail`: GET list → envelope 1 item; GET detail → same claimNumber; unknown id → 404 `CLAIM_NOT_FOUND`.
     - `test_claim_numbers_increment`: two claims → numbers end `0001` then `0002` (same year, same state).
     - `test_claim_oversize_photo_413`: 6 MB jpeg → 413 `FILE_TOO_LARGE`.
     - `test_claim_loss_percent_bounds_422`: `estimatedLossPercent: 120` → 422 (Pydantic `Field(ge=0, le=100)`).
     - `test_claim_list_excludes_other_users`: user B sees 0 of user A's claims.
- **Test:** `cd backend && .venv/bin/pytest tests/test_insurance_claims.py -v`
- **Expected output:** `8 passed`. Manual: `curl -X POST http://localhost:8000/v1/insurance/claims -H "Authorization: Bearer $TOKEN" -F "policyId=<ID>" -F "cropName=Wheat" -F "calamityType=hailstorm" -F "dateOfDamage=2026-09-10" -F "cropStage=flowering" -F "estimatedLossPercent=40" -F "gpsCoordinates=20.0,73.8" -F "village=Ozarkhed" -F "damagePhotos=@/tmp/p1.jpg"` → 201 with `claimNumber`; then `curl http://localhost:8000/v1/insurance/claims -H "Authorization: Bearer $TOKEN"` → envelope containing it.

### Data layout reference (Day 11)

| Collection | Written by | Read by |
|---|---|---|
| `insurance_rates` | seed (`insurance_seed.py`) | `GET /rates`, `POST /policies/apply` |
| `users/{uid}/insurance_policies` | demo seed on first read, `POST /policies/apply` | `GET /policies`, claim submission |
| `users/{uid}/insurance_claims` | `POST /claims` | tracker endpoints, Day 14 admin |
| `counters/claims_{year}` | `next_claim_number` (transaction) | — |
| Storage `claims/{uid}/...` | claim photo upload | claim detail `damagePhotos` URLs |

### Task A3 — My Bookings aggregate

- **Goal:** `GET /v1/users/me/bookings?status=` — one call returning equipment + vet + transport bookings.
- **Depends on:** Day 8 (`equipment_bookings` collection), Day 7 (`transport_bookings` with `userId`/`fare`/status). Vet bookings (`users/{uid}/vet_bookings`) are written Day 12 — design so a missing subcollection returns an empty list, do NOT depend on Day 12 code.
- **Files to create/modify:**
  - `backend/app/routers/users.py` (modify — add route)
  - `backend/tests/test_my_bookings.py` (new)
- **Subtasks:**
  1. In `backend/app/routers/users.py` add `GET /me/bookings?status=` (all roles) returning 200:
     ```json
     { "equipment": [...], "vet": [...], "transport": [...] }
     ```
     - `equipment`: docs from `users/{uid}/equipment_bookings` (Day 8 shape: `id`, `equipmentId`, `slotId`, `date`, `slotName`, `priceRupees`, `status`).
     - `vet`: docs from `users/{uid}/vet_bookings` (Day 12 shape: `id`, `vetName`, `visitType`, `slot`, `animalType`, `status`) — empty list if none.
     - `transport`: `query("transport_bookings", [("userId", "==", uid)])` → fields `id`, `vehicleType`, `pickup`, `drop`, `date`, `fare`, `status`.
     - Add `kind: "equipment"|"vet"|"transport"` to every item.
     - `?status=` filters each list (exact match); sort each by `date` desc.
  2. Write `backend/tests/test_my_bookings.py`:
     - `test_aggregate_three_sources`: seed 1 equipment booking + 1 transport booking → `equipment` len 1 (with `kind == "equipment"`), `vet` len 0, `transport` len 1 (fields include `fare`).
     - `test_missing_vet_subcollection_returns_empty_list`: fresh user → `vet == []` and HTTP 200 (never an error for absent sources).
     - `test_status_filter`: `?status=requested` → only the transport booking remains.
     - `test_sorted_by_date_desc`: 2 transport bookings different dates → newest first.
     - `test_unauthenticated_401`: no header → 401 `MISSING_TOKEN`.
     - `test_kind_field_on_every_item`: every item in all 3 lists carries the right `kind` value.
     - `test_transport_source_uses_fare_field`: seeded transport booking's `fare` (not `totalFare`) is what the response carries — Day 7 field name.
- **Test:** `cd backend && .venv/bin/pytest tests/test_my_bookings.py -v`
- **Expected output:** `6 passed`. Manual: `curl "http://localhost:8000/v1/users/me/bookings" -H "Authorization: Bearer $TOKEN"` → 200 with 3 keys; `curl "http://localhost:8000/v1/users/me/bookings?status=requested" ...` filters.

### Task A4 — Dev seed script for claim-tracker QA data

- **Goal:** One command gives a demo user a policy plus claims at different tracker stages, so Dev B can build the tracker UI without admin tooling (which lands Day 14).
- **Depends on:** Day 11 Tasks A1–A2.
- **Files to create/modify:**
  - `backend/scripts/seed_insurance_demo.py` (new)
- **Subtasks:**
  1. Write `backend/scripts/seed_insurance_demo.py`: takes `uid` from argv; creates 1 policy (demo policy shape from A1) and 2 claims in `users/{uid}/insurance_claims`:
     - claim 1: full `InsuranceClaimRecord` shape, `status: "surveyorAssigned"`, claimNumber `CLM-2026-MH-9001`, timeline with 2 entries, surveyor fields filled.
     - claim 2: `status: "disbursed"`, `approvedAmount: 22400`, `dbtTransactionId: "DBT20260901234"`, timeline with all 5 entries.
  2. Idempotent: skip docs that already exist; print `seeded demo insurance for <uid>`.
  3. Run it for the dev/test user: `cd backend && .venv/bin/python scripts/seed_insurance_demo.py <uid>`.
- **Test:** run the script twice → second run prints the skip message and `GET /v1/insurance/claims` still shows exactly 2 claims.
- **Expected output:** Tracker tab shows one mid-flight claim (stage 2 highlighted, surveyor box filled) and one completed claim (DBT row visible) without touching admin endpoints.

### Error codes introduced today (reference for Dev B)

| Code | HTTP | When | Hindi UI copy to show |
|---|---|---|---|
| `RATE_NOT_FOUND` | 404 | apply with unrated crop/season | `इस फसल/सीज़न की दर उपलब्ध नहीं` |
| `POLICY_NOT_FOUND` | 404 | bad policyId | `पॉलिसी नहीं मिली` |
| `FILE_TOO_LARGE` | 413 | photo > 5 MB | `फोटो बहुत बड़ी है (अधिकतम 5 MB)` |
| `UNSUPPORTED_FILE_TYPE` | 415 | non-jpeg/png | `केवल JPG/PNG फोटो स्वीकार्य हैं` |
| `CLAIM_NOT_FOUND` | 404 | bad claim id | `दावा नहीं मिला` |
| `CANCEL_WINDOW_CLOSED` | 409 | equipment cancel inside 2 h | server message verbatim (Day 8) |

## Dev B — Flutter tasks


### Task B1 — Port Crop Insurance view (4 tabs)

- **Goal:** Port `crop_insurance_view.dart` wired to `/v1/insurance/*`.
- **Depends on:** Day 3 Task B1. Add `image_picker: ^1.1.2` to `apps/mobile/pubspec.yaml`. API dependency: Day 11 Tasks A1–A2.
- **Files to create/modify:**
  - `apps/mobile/lib/views/crop_insurance_view.dart` (modify — port from `flutter-prototype/lib/views/crop_insurance_view.dart`)
  - `apps/mobile/lib/api/insurance_api.dart` (new)
  - `apps/mobile/lib/models/insurance_models.dart` (new — `CropInsurancePolicy`, `InsuranceClaimRecord`, `CropPremiumRate`)
  - `apps/mobile/test/crop_insurance_view_test.dart` (new)
- **Subtasks:**
  1. Copy the view verbatim — 4 tabs (पॉलिसी, 72-घंटे दावा, प्रीमियम कैलकुलेटर, दावा ट्रैकर), emergency claim banner + helpline bar, all styling.
  2. `insurance_api.dart`: `listPolicies()`, `applyPolicy(cropName, season, landAreaAcres)`, `getCertificate(policyId)`, `getRates({season, crop})`, `submitClaim(Map<String,String> fields, List<XFile> photos)` (multipart via `http.MultipartRequest` — same approach as Day 10 vault), `listClaims()`, `getClaim(id)`.
  3. **Tab 1 पॉलिसी:** passbook cards ← `listPolicies()`; `e-प्रमाणपत्र` button → `getCertificate` → `launchUrl(certificateUrl)`; quick-apply sheet (crop dropdown, season chips, acreage field) → `applyPolicy` → on 201 SnackBar `पॉलिसी जारी: {policyNumber}` + refetch; PMFBY portal button → `https://pmfby.gov.in`.
  4. **Tab 2 72-घंटे दावा:** policy dropdown ← `listPolicies()`; calamity grid (prototype options verbatim); date picker; crop-stage dropdown (sowing→post-harvest); loss-% slider; photo capture via `image_picker` camera (max 5, thumbnail row with remove buttons); submit → `submitClaim` → on 201 dialog `दावा क्रमांक: {claimNumber}` then auto-switch to Tab 4; on 413/415 → `फोटो बहुत बड़ी/अमान्य है`; on `POLICY_NOT_FOUND` → `पॉलिसी नहीं मिली`.
  4b. Client-side validation before submit: policy selected, calamity chosen, date not in the future, ≥ 1 photo attached — else inline error `सभी फ़ील्ड भरें और कम से कम 1 फोटो जोड़ें`; submit button disabled until valid. The emergency banner's helpline button dials the PMFBY helpline `tel:14447` via `url_launcher`.
  5. **Tab 3 प्रीमियम कैलकुलेटर:** season switcher → `getRates(season:)` populates the crop dropdown; acreage slider recomputes client-side from the selected rate row: `sumInsured = sumInsuredPerAcre * acres`, `farmerPremium = sumInsured * farmerSharePercent/100`, `govtShare = sumInsured * (actuarial - farmerShare)/100`; show `cutoffDate`; `PMFBY पोर्टल पर पॉलिसी जारी करें` external link.
  6. **Tab 4 दावा ट्रैकर:** `listClaims()`; per claim, the 5-stage stepper maps `status`/`timeline[]` (intimation → surveyor assigned → field assessed → DBT approved → disbursed / rejected); surveyor contact box (`surveyorName`, tel: link on `surveyorPhone`, `surveyorVisitDate`); DBT row shows `dbtTransactionId` + `bankAccountLast4` when present. Pull-to-refresh refetches; while any claim is in a non-terminal status (not disbursed/rejected), poll `getClaim(id)` every 30 s (`Timer.periodic`, cancelled in dispose).
  6b. Photo handling: before upload, downscale each `XFile` to max 1600px on the long edge (`image_picker` `maxWidth: 1600` / `imageQuality: 80`) so a 5-photo claim stays well under the 5 MB-per-file limit on 2 GB devices.
  7. `apps/mobile/test/crop_insurance_view_test.dart`:
     - `testWidgets('insurance view renders 4 tabs', ...)` — expect the 4 tab labels.
     - `testWidgets('policy card renders', ...)` — fake policy PMFBY-2026-0001; expect the policy number text.
     - `testWidgets('claim tracker renders surveyor box', ...)` — fake claim `status: surveyorAssigned`; expect surveyor name + the tracker stepper.
     - `testWidgets('premium calculator computes from rates', ...)` — fake rate Wheat Kharif (40000/acre, 2.0%, 12.5%); set 2 acres → expect `₹80,000` sum insured and `₹1,600` premium.
     - `testWidgets('claim success shows claim number dialog', ...)` — fake submit returns `CLM-2026-MH-0001`; submit the form → expect dialog text `दावा क्रमांक: CLM-2026-MH-0001` and the tracker tab becomes active.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/crop_insurance_view_test.dart`
- **Expected output:** `No issues found!`; 5 tests pass; manual: apply Wheat Kharif 2 acres → premium ₹1,600 shown; submit claim with 2 camera photos → claim-number dialog → tracker shows `दावा दर्ज` stage; e-certificate button opens the PDF URL.

### Task B2 — NEW My Bookings view

- **Goal:** `my_bookings_view.dart` with 3 tabs fed by `GET /v1/users/me/bookings`.
- **Depends on:** Day 8 equipment booking UI. API dependency: Day 11 Task A3.
- **Files to create/modify:**
  - `apps/mobile/lib/views/my_bookings_view.dart` (new screen)
  - `apps/mobile/lib/api/bookings_api.dart` (new)
  - `apps/mobile/lib/models/booking.dart` (new)
  - `apps/mobile/lib/state/profile_routes.dart` (modify — route `myBookings`; access farmer, farmLandlord, seller, transport)
  - `apps/mobile/lib/views/profile_home/farmer_home_view.dart` (modify — `मेरी बुकिंग` entry in the tools/quick actions)
  - `apps/mobile/test/my_bookings_view_test.dart` (new)
- **Subtasks:**
  1. `booking.dart`: `Booking.fromJson` tolerant parser — `kind` plus union of per-kind fields (`slotName`, `priceRupees`, `vetName`, `visitType`, `animalType`, `vehicleType`, `pickup`, `drop`, `fare`, `date`, `status`, `id`).
  1b. Date formatting: render `date` (YYYY-MM-DD) as `d MMM yyyy` via `intl` `DateFormat('d MMM yyyy', 'hi')` (add `intl: ^0.19.0` to `apps/mobile/pubspec.yaml` if absent); rupee amounts via `NumberFormat.currency(locale: 'hi_IN', symbol: '₹', decimalDigits: 0)`.
  1c. Sorting guard: the API returns each list sorted `date` desc — do not re-sort client-side; render in received order.
  1d. Pull-to-refresh uses `RefreshIndicator` on each tab's list; the refetch re-calls `getMyBookings()` once and redistributes to all three tabs (not one call per tab).
  2. `bookings_api.dart`: `getMyBookings({status})` → parses `{equipment, vet, transport}` into `List<Booking>` per tab; `cancelEquipmentBooking(id)` → `DELETE /v1/equipment/bookings/{id}`.
  3. `my_bookings_view.dart`: app bar `मेरी बुकिंग`; `TabBar` with `उपकरण`, `पशु चिकित्सक`, `परिवहन`; single fetch on init distributed to tabs; pull-to-refresh refetches.
  4. उपकरण tab card: equipmentId/slotName + date, `₹{priceRupees}`, status chip — booked = green `पुष्ट`, pending = amber `स्वीकृति लंबित`, cancelled = red `रद्द`; cancel button on booked/pending → `cancelEquipmentBooking` → on 200 remove card + SnackBar `बुकिंग रद्द की गई`; on `CANCEL_WINDOW_CLOSED` show the server Hindi message (Day 8: cancel ≤2h blocked).
  5. पशु चिकित्सक tab card: vetName, visitType chip (`फ़ार्म विज़िट` / `क्लीनिक`), slot, animalType, status chip; empty state `कोई पशु चिकित्सक बुकिंग नहीं`.
  6. परिवहन tab card: vehicleType, `{pickup} → {drop}`, date, `₹{fare}`, status chip (requested/accepted/enRoute/delivered/cancelled with Hindi labels: `अनुरोधित`, `स्वीकृत`, `रास्ते में`, `पहुंचा`, `रद्द`); empty state `कोई परिवहन बुकिंग नहीं`.
  7. Global empty state (all 3 lists empty): icon + `अभी तक कोई बुकिंग नहीं` + button `उपकरण बुक करें` → equipment route.
  7b. Status filter: a `FilterChip` row above each tab list (सभी / पुष्ट / लंबित / रद्द) refetching with `?status=` mapped to the backend's English status values (`booked|pending|cancelled` for equipment, `confirmed` for vet, `requested|accepted|enRoute|delivered|cancelled` for transport) — chips show Hindi labels, the query sends English codes.
  8. `apps/mobile/test/my_bookings_view_test.dart`:
     - `testWidgets('bookings renders 3 tabs', ...)` — expect tab texts `उपकरण`, `पशु चिकित्सक`, `परिवहन`.
     - `testWidgets('equipment booking card renders', ...)` — fake aggregate with 1 equipment booking status booked; expect slot name + chip `पुष्ट`.
     - `testWidgets('empty vet tab shows placeholder', ...)` — expect `कोई पशु चिकित्सक बुकिंग नहीं`.
     - `testWidgets('transport card renders fare and route', ...)` — fake transport booking `fare: 850`, pickup `Ozarkhed`, drop `Nashik APMC`; expect `₹850` and `Ozarkhed → Nashik APMC`.
     - `testWidgets('global empty state', ...)` — all 3 lists empty → expect `अभी तक कोई बुकिंग नहीं` and the `उपकरण बुक करें` button.
     - `testWidgets('status filter chip refetches', ...)` — tap `पुष्ट` chip → fake api recorded `status: "booked"`.
  9. Routing note: `myBookings` must also appear in the All Tools sheet grid (Day 4 component) for the allowed personas — add the tile with icon `Icons.assignment_turned_in`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/my_bookings_view_test.dart`
- **Expected output:** `No issues found!`; 6 tests pass; manual: book an equipment slot (Day 8 flow) → it appears under उपकरण without restart; cancel → SnackBar; transport booking (Day 7 flow) appears under परिवहन; status chips filter each list.

### Task B3 — Insurance deep-link from notifications

- **Goal:** A claim push/notification (sent Day 13–14 when admin advances the claim) opens the tracker tab directly.
- **Depends on:** Task B1; Day 13 Task B4 (push routing).
- **Files to create/modify:**
  - `apps/mobile/lib/views/crop_insurance_view.dart` (modify — accept `initialTab` constructor param, default 0)
  - `apps/mobile/lib/services/push_service.dart` (modify — Day 13 scaffold: on `data["type"] == "claim"` route to `cropInsurance` with `initialTab: 3`)
- **Subtasks:**
  1. Add `final int initialTab;` to `CropInsuranceView` and initialize the `TabController` with `initialIndex: widget.initialTab`.
  2. In `push_service.dart` tap routing: `type == "claim"` → `AppState.currentRoute = cropInsurance` passing the tab index; same for in-app notification rows (Day 10 notifications view): tapping a `type == "claim"` notification opens the tracker tab.
- **Test:** `cd apps/mobile && flutter analyze` → 0 issues; manual once Day 14 admin flow exists: advance a claim as admin → push arrives → tap → tracker tab opens with the updated stage.
- **Expected output:** Deep-link lands on दावा ट्रैकर (tab index 3), not the policies tab.

### Task B4 — Offline queue for claims + bookings (client side)

- **Goal:** When the device is offline, claim submissions and equipment bookings queue locally instead of erroring; they replay via `POST /v1/sync` (backend lands Day 14 Task A3).
- **Depends on:** Day 4 offline/sync pill (`AppState` sync counter). Server replay contract: Day 14 Task A3.
- **Files to create/modify:**
  - `apps/mobile/lib/services/offline_queue.dart` (new)
  - `apps/mobile/lib/api/insurance_api.dart` (modify — queue on network failure)
  - `apps/mobile/lib/api/equipment_api.dart` (modify — queue on network failure)
- **Subtasks:**
  1. `offline_queue.dart`: `class OfflineQueue` backed by a SharedPreferences JSON list. `enqueue({idempotencyKey, method, path, body, queuedAt})` where `idempotencyKey = const Uuid().v4()`; `pendingCount` getter feeding the AppState sync pill; `Future<void> flush(ApiClient client)` → POSTs `{ operations: [...] }` to `/v1/sync`, then removes ops whose result `status` is `applied` or `duplicate` (keep `error` ops for one retry, then drop with a log).
  2. In `insurance_api.submitClaim` and `equipment_api.bookSlot`: on a network failure (Dio/socket exception — NOT on 4xx), first upload photos if any (photos cannot queue — if the photo upload itself fails offline, show `नेटवर्क नहीं है — बाद में भेजा जाएगा` and queue nothing for claims), then `enqueue` the write and show SnackBar `ऑफ़लाइन — सिंक हो जाएगा`. For claims specifically: queue only after photos are already uploaded (body carries the returned URLs — matches the Day 14 replay contract).
  3. Flush triggers: app foreground resume + connectivity restore listener (`connectivity_plus: ^6.1.0` — add to pubspec).
- **Test:** `cd apps/mobile && flutter analyze` → 0 issues; `flutter test test/offline_queue_test.dart` (new) — `test('enqueue persists and flush clears applied ops', ...)` with a fake api client returning `{results: [{idempotencyKey: k, status: "applied"}]}`.
- **Expected output:** Airplane-mode equipment booking shows the offline SnackBar and the sync pill increments; back online → queued op replays (verified against the Day-14 backend, or a mocked `/v1/sync` today).

## Done-when checklist (end of day)

- [ ] `cd backend && .venv/bin/pytest tests/test_insurance_policies.py tests/test_insurance_claims.py tests/test_my_bookings.py -v` → 25 passed; full suite green.
- [ ] Premium math exact: Wheat Kharif 2 acres → sumInsured 80000 / farmerPremium 1600 / govtSubsidy 8400.
- [ ] Claim e2e in emulator: photos under `claims/{uid}/`, claim doc `status: intimated`, number `CLM-2026-MH-0001` style, surveyor auto-assigned.
- [ ] State machine: intimated→dbtApproved rejected; legal transitions append timeline entries.
- [ ] `/v1/users/me/bookings` returns 3 keys; empty sources → `[]` not errors; `?status=` filters.
- [ ] `flutter analyze` 0 issues; 11 new widget tests pass.
- [ ] Push/notification deep-link opens दावा ट्रैकर tab (initialTab wiring compiled + manual check).
- [ ] `seed_insurance_demo.py` gives the tracker 2 claims at different stages; idempotent on re-run.
- [ ] Offline queue: airplane-mode booking queued (pill +1) and replays via `/v1/sync` when online.
- [ ] Manual on emulator: 4 insurance tabs work end-to-end (apply → certificate opens; claim → tracker); My Bookings shows Day-8 equipment and Day-7 transport bookings; status chips filter; offline queue replays on reconnect.
- [ ] Screenshot the claim tracker stages (from the demo seed) for the Play Store screenshot list — `05_insurance.png` comes from this screen.
- [ ] Claim photos visible in Storage console under `claims/{uid}/` after a manual submission.
- [ ] `GET /v1/insurance/policies` on a fresh user seeds exactly one demo policy (idempotent on second call).

---

## Additional tasks (from missing.md)

Covers: F15 claim appeal / resubmission + photo guidelines. Spec: docs/overview/03 Part C/D item F15 — the spec item wins on any divergence.

### Task A5 — Claim appeal + photo guidelines (F15)

- **Goal:** `POST /v1/insurance/claims/{id}/appeal` `{reason, photos[]}` — a rejected claim goes back to `intimated` with `appealCount + 1`; claim-submit response gains a photo-guidelines note. Spec: docs/overview/03 Part C item F15.
- **Depends on:** Day 11 Task A2 (claims router + state machine), Day 13 Task A4 (`notify` on status change — appeal re-enters `intimated`, so notification fires through the same path).
- **Files to create/modify:**
  - `backend/app/models/claims.py` (modify — `AppealIn`)
  - `backend/app/services/claims.py` (modify — allow `rejected → intimated` only via appeal)
  - `backend/app/routers/insurance.py` (modify — appeal route + photo-guidelines note in submit response)
  - `backend/tests/test_insurance_claims.py` (modify — append 4 tests)
- **Subtasks:**
  1. `class AppealIn(BaseModel)`: `reason: str = Field(min_length=10, max_length=1000)`, `photos: list[str] = []` (URLs of already-uploaded Storage photos, ≤ 5 — same rule as claim photos).
  2. Extend `InsuranceClaimRecord` with `appealCount: int = 0` and `rejectionReason: str | None = None` (Day 14 admin reject sets the latter — tolerate absence).
  3. In `app/services/claims.py`: keep `CLAIM_TRANSITIONS["rejected"] == []` for the admin path; add `def appeal(claim: dict, reason: str) -> dict` — status must be `rejected` else raise `ValueError`; sets `status: "intimated"`, `statusText = STATUS_TEXT["intimated"]`, `appealCount += 1`, appends timeline `{status: "intimated", at, note: f"Appeal submitted: {reason[:100]}"}` and a leading entry is NOT removed (history stays).
  4. Add route `POST /claims/{id}/appeal` (role farmer, claim owner only — 404 `CLAIM_NOT_FOUND` otherwise): claim not rejected → 409 `CLAIM_NOT_REJECTED`; call `appeal(...)`, merge `photos` into `damagePhotos` (append, cap 5 → 422 `TOO_MANY_PHOTOS` when the merged list exceeds 5), persist, 200 with the updated claim. FCM `notify` fires via the Day 13 status-change hook.
  5. Photo-guidelines note: `POST /claims` 201 response gains a top-level sibling field `photoGuidelines: ["पूरे खेत की एक चौड़ी फोटो लें", "नुकसान वाले पौधों की नज़दीक से फोटो लें", "GPS चालू रखें — लोकेशन अपने आप जुड़ती है"]` (additive field — no breaking change; Dev B renders it in the success dialog).
  6. Tests appended to `backend/tests/test_insurance_claims.py`:
     - `test_appeal_rejected_claim_returns_to_intimated`: drive a claim to `rejected` via the state machine → appeal → 200, `status == "intimated"`, `appealCount == 1`, timeline grew.
     - `test_appeal_non_rejected_409`: appeal on an `intimated` claim → 409 `CLAIM_NOT_REJECTED`.
     - `test_appeal_reason_too_short_422`: reason `"short"` → 422.
     - `test_submit_response_has_photo_guidelines`: submit → 201 body has `photoGuidelines` list non-empty.
- **Test:** `cd backend && .venv/bin/pytest tests/test_insurance_claims.py -v`
- **Expected output:** `12 passed` (8 existing + 4 new). Manual: reject a seeded claim (Day 14 admin or direct Firestore), `curl -X POST http://localhost:8000/v1/insurance/claims/<ID>/appeal -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"reason":"सर्वेयर ने गलत फसल स्टेज दर्ज की थी, नई फोटो संलग्न हैं"}'` → 200 `status: "intimated"`.

### Task B5 — Rejected-claim appeal / resubmit flow (F15)

- **Goal:** Rejected claim card shows the rejection reason + an `अपील करें / पुनः जमा करें` flow reusing the claim form prefilled. Spec: docs/overview/03 Part D item F15. API dependency: Day 11 Task A5.
- **Depends on:** Day 11 Task B1 (`crop_insurance_view.dart` 4 tabs + claim form); Day 11 Task A5.
- **Files to create/modify:**
  - `apps/mobile/lib/views/crop_insurance_view.dart` (modify — rejected card UI + appeal sheet)
  - `apps/mobile/lib/api/insurance_api.dart` (modify — `appealClaim(id, reason, photos)`)
  - `apps/mobile/lib/models/insurance_models.dart` (modify — `appealCount`, `rejectionReason`)
  - `apps/mobile/test/crop_insurance_view_test.dart` (modify — append 2 tests)
- **Subtasks:**
  1. Tracker tab: a claim with `status == "rejected"` renders a red reason card (`अस्वीकृति का कारण: {rejectionReason ?? timeline last note}`) and a primary button `अपील करें / पुनः जमा करें`; `appealCount > 0` claims show a small badge `अपील #{appealCount}`.
  2. Appeal sheet: reuses the claim-form fields **prefilled** from the rejected claim (policy, calamity, dates, loss %, existing photos shown as thumbnails) + a required `अपील का कारण` multiline field (min 10 chars → inline `कम से कम 10 अक्षर लिखें`) + optional extra photos via `image_picker` (upload first, collect URLs — same flow as Day 11 submit).
  3. Submit → `appealClaim` → on 200 SnackBar `अपील दर्ज हुई — दावा फिर से सुना जाएगा` + refetch (claim shows `दावा दर्ज` stage again); on `CLAIM_NOT_REJECTED` → `दावा अस्वीकृत स्थिति में नहीं है`.
  4. Claim-success dialog (new submissions) now also lists `photoGuidelines` from the 201 response below the claim number.
  5. Tests appended to `apps/mobile/test/crop_insurance_view_test.dart`:
     - `testWidgets('rejected claim shows reason and appeal button', ...)` — fake claim `status: "rejected"`, `rejectionReason: "अपर्याप्त फोटो साक्ष्य"` → expect the reason text and `अपील करें / पुनः जमा करें`.
     - `testWidgets('appeal submit returns claim to intimated', ...)` — fake appeal → 200; submit the sheet → expect SnackBar `अपील दर्ज हुई` and the tracker stepper back at stage 1.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/crop_insurance_view_test.dart`
- **Expected output:** `No issues found!`; existing 5 + 2 new tests pass; manual: rejected demo claim (seed via Firestore) → appeal sheet prefilled → submit → tracker shows `दावा दर्ज`.

### Done-when additions (additional tasks)

- [ ] `cd backend && .venv/bin/pytest tests/test_insurance_claims.py -v` → 12 passed; full suite green.
- [ ] Appeal only from `rejected` (409 otherwise); `appealCount` increments; history timeline preserved.
- [ ] Claim-submit 201 carries `photoGuidelines`; appeal photos merge with the 5-photo cap (422 `TOO_MANY_PHOTOS`).
- [ ] `flutter analyze` 0 issues; 2 new widget tests pass.
- [ ] Manual: rejected claim → prefilled appeal → back to `दावा दर्ज` stage; push notification arrives on the device (Day 13 hook).
