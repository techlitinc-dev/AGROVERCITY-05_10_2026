# Day 10 — Schemes, Document Vault, Land Records, Water + Account Screens

**Dev A (Backend) goal:** Schemes with rule-based eligibility + apply + portals, encrypted document vault via Firebase Storage signed URLs, land-records search behind a swappable adapter, water-intelligence endpoints, plus account deletion (data purge) and FCM device registration.
**Dev B (Flutter) goal:** `schemes_view` (with vault sheet), `land_legal_view`, `water_view` ported and wired; 4 new account screens (notifications, settings, help & support, account deletion) built and routed.

## Dev A — Backend tasks

### Task A1 — Government schemes + eligibility engine

- **Goal:** `GET /v1/schemes`, `POST /v1/schemes/{id}/apply`, `GET /v1/schemes/portals`.
- **Depends on:** Day 2 Task A2 (`current_user_id`), Day 3 (`require_role`, user profile shape).
- **Files to create/modify:**
  - `backend/app/models/schemes.py` (new)
  - `backend/app/data/schemes_seed.py` (new)
  - `backend/app/services/eligibility.py` (new)
  - `backend/app/routers/schemes.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_schemes.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/schemes.py` (field names per endpoints.md §10):
     - `class GovtScheme(BaseModel)`: `id: str`, `name: str`, `category: str`, `eligible: bool`, `benefitAmount: str`, `documentsRequired: list[str]`, `status: str`, `nextDeadline: str`, `description: str`
     - `class SchemeApplyIn(BaseModel)`: `documentIds: list[str] = []`
     - `class SchemeApplyOut(BaseModel)`: `applicationId: str`, `status: str`
     - `class PortalEntry(BaseModel)`: `schemeId: str`, `portalUrl: str`
  2. Write `backend/app/data/schemes_seed.py` with `async def seed_schemes()`: skip if collection `schemes` non-empty (idempotent); seed 6 docs: PM-KISAN (`category: "income-support"`, `benefitAmount: "₹6,000/वर्ष"`), PMFBY (`insurance`), Soil Health Card (`soil`), PM-KUSUM (`solar`), eNAM (`market`), PMKSY drip subsidy (`irrigation`). Each doc: `documentsRequired` (e.g. `["Aadhaar", "7/12", "Bank passbook"]`), `status: "open"`, `nextDeadline` ISO date, Hindi `description`, and an `eligibilityRules` map, e.g. `{"maxLandAcres": 10, "states": ["Maharashtra"], "requiresKcc": false}` — rules are data, not code branches. Call `seed_schemes()` from `app/main.py` startup alongside Day-5/6 seeds.
  3. Write `backend/app/services/eligibility.py`:
     - `def is_eligible(user: dict, rules: dict) -> bool`: `maxLandAcres` → `user["landAreaAcres"] <= rules["maxLandAcres"]`; `states` (empty list = all) → `user["state"] in rules["states"]`; `requiresKcc` → `user.get("kccLimit", 0) > 0`. Unknown rule keys ignored (forward-compatible). All rules absent → eligible.
  4. Write `backend/app/routers/schemes.py` (`router = APIRouter(prefix="/schemes", tags=["schemes"])`, roles farmer/farmLandlord via `require_role`):
     - `GET /schemes?category=&eligibleOnly=`: list `schemes` via `query`; compute `eligible` per-user with `is_eligible`; strip `eligibilityRules` from the response; `eligibleOnly=true` filters; pagination envelope.
     - `POST /schemes/{id}/apply`: scheme must exist (404 `SCHEME_NOT_FOUND`); doc `users/{uid}/scheme_applications/{schemeId}` already present → 409 `ALREADY_APPLIED`; not eligible → 403 `NOT_ELIGIBLE`; each `documentIds` must exist in `users/{uid}/vault_documents` else 400 `INVALID_DOCUMENT_ID`; write application `{ applicationId: schemeId, status: "submitted", documentIds, submittedAt: iso }`; return 201 `SchemeApplyOut`.
     - `GET /schemes/portals`: static list — PM-KISAN→`https://pmkisan.gov.in`, PMFBY→`https://pmfby.gov.in`, Soil Health Card→`https://soilhealth.dac.gov.in`, PM-KUSUM→`https://pmkusum.mnre.gov.in`, eNAM→`https://enam.gov.in`. Return `{ "data": [PortalEntry...] }`.
  5. `app.include_router(schemes.router, prefix="/v1")`.
  6. Write `backend/tests/test_schemes.py`:
     - `test_eligible_only_filters`: user `landAreaAcres: 5, state: "Maharashtra"` → `?eligibleOnly=true` returns only schemes whose rules pass; every item `eligible == True`.
     - `test_eligibility_service_units`: direct calls — over-acreage → False; wrong state → False; empty rules → True.
     - `test_apply_creates_application`: → 201, `status == "submitted"`.
     - `test_apply_twice_409`: second POST → 409 `ALREADY_APPLIED`.
     - `test_apply_bad_document_400`: `documentIds: ["nope"]` → 400 `INVALID_DOCUMENT_ID`.
     - `test_portals_five_https`: → 5 entries, all `portalUrl` starting `https://`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_schemes.py -v`
- **Expected output:** `6 passed`. Manual: `curl "http://localhost:8000/v1/schemes?eligibleOnly=true" -H "Authorization: Bearer $TOKEN"` → 200, all items `"eligible": true`.

### Task A2 — Document vault (Storage signed URLs)

- **Goal:** `GET/POST /v1/vault/documents`, `DELETE /v1/vault/documents/{id}` — multipart upload to Firebase Storage, 60-min signed download URLs.
- **Depends on:** Day 1 Task A2 (Firebase Admin init, `settings.firebase_service_account`).
- **Files to create/modify:**
  - `backend/app/models/vault.py` (new)
  - `backend/app/services/storage.py` (new)
  - `backend/app/routers/vault.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_vault.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/vault.py`:
     - `class VaultDocumentOut(BaseModel)`: `id: str`, `docType: Literal["aadhaar", "712", "bankPassbook", "soilHealthCard", "other"]`, `fileName: str`, `downloadUrl: str`, `uploadedAt: str`, `sizeBytes: int`
  2. Write `backend/app/services/storage.py`:
     - `def upload_user_file(uid: str, data: bytes, filename: str, content_type: str, prefix: str = "vault") -> tuple[str, int]`: blob path `{prefix}/{uid}/{uuid4().hex}_{filename}`; `blob.upload_from_string(data, content_type=content_type)`; return `(blob_path, len(data))`. Dev mode (no service account): write bytes under `backend/.local_uploads/` and return `(path, size)` with a warning log.
     - `def signed_download_url(blob_path: str, minutes: int = 60) -> str`: `blob.generate_signed_url(expiration=timedelta(minutes=minutes), method="GET")`. Dev mode: return `file://<path>`.
     - Comment in the module docstring: "Encryption at rest is provided by Cloud Storage (AES-256/GMEK by default) — that is what the UI's 'AES-256' badge refers to. Never log Aadhaar numbers or file bytes."
  3. Write `backend/app/routers/vault.py` (`prefix="/vault"`, all roles):
     - `POST /documents`: `file: UploadFile` + form field `docType`. Reject content-type not in `{image/jpeg, image/png, application/pdf}` → 415 `UNSUPPORTED_FILE_TYPE`; size > 5 MB → 413 `FILE_TOO_LARGE`. Upload via service; `set_doc(f"users/{uid}/vault_documents", doc_id, { id, docType, fileName, blobPath, uploadedAt, sizeBytes })` — **no Aadhaar number field anywhere**; return 201 `VaultDocumentOut` (with a fresh signed URL).
     - `GET /documents`: list subcollection; generate a fresh signed URL per doc; envelope.
     - `DELETE /documents/{id}`: 404 `DOCUMENT_NOT_FOUND`; delete blob + Firestore doc; 204.
     - Add `# never log Aadhaar numbers or file bytes` above every logger call in this router.
  4. `app.include_router(vault.router, prefix="/v1")`.
  5. Write `backend/tests/test_vault.py` (patch `app.services.storage` functions with fakes):
     - `test_upload_png_201`: 1 KB PNG, `docType=aadhaar` → 201, `downloadUrl` present, `sizeBytes == 1024`.
     - `test_reject_text_file_415`: `text/plain` → 415 `UNSUPPORTED_FILE_TYPE`.
     - `test_reject_oversize_413`: 6 MB body → 413 `FILE_TOO_LARGE`.
     - `test_delete_204_then_absent`: delete → 204; GET list → doc gone; second delete → 404.
     - `test_logger_never_logs_bytes`: patch the router's logger; upload; assert no call arg contains `bytes` type or the string "aadhaar" combined with content.
- **Test:** `cd backend && .venv/bin/pytest tests/test_vault.py -v`
- **Expected output:** `5 passed`. Manual: `curl -X POST http://localhost:8000/v1/vault/documents -H "Authorization: Bearer $TOKEN" -F "docType=aadhaar" -F "file=@/tmp/test.png"` → 201 with `downloadUrl`.

### Task A3 — Land records search (adapter + mock)

- **Goal:** `GET /v1/land-records/search`, `GET /v1/land-records/{id}/pdf`, `POST /v1/land-records/{id}/import` behind a swappable adapter (mock now; mahabhulekh later).
- **Depends on:** Day 3 (user profile update for import).
- **Files to create/modify:**
  - `backend/app/models/land_records.py` (new)
  - `backend/app/services/land_records/base.py` (new — abstract adapter)
  - `backend/app/services/land_records/mock_adapter.py` (new)
  - `backend/app/services/land_records/__init__.py` (new — `get_adapter()` registry)
  - `backend/app/routers/land_records.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_land_records.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/land_records.py`:
     - `class LandRecord712(BaseModel)`: `id: str`, `gatNumber: str`, `village: str`, `district: str`, `ownerName: str`, `khataNumber: str`, `totalAreaHectares: float`, `totalAreaAcres: float`, `landClass: str`, `ferfarNumber: str`, `cropHistory: str`
  2. Write `backend/app/services/land_records/base.py`:
     - `class LandRecordsAdapter(ABC)` with `def search(self, gat_number, village, district, record_type) -> list[LandRecord712]` and `def get_pdf_url(self, record_id) -> str`. Docstring: "Implementations: MockAdapter (dev), MahabhulekhAdapter (prod — mahabhulekh.maharashtra.gov.in / Aaple Sarkar; later: Gujarat 7/12, Karnataka RTC, UP Khatauni). Swap via env `LAND_RECORDS_ADAPTER`; routers never change."
  3. Write `mock_adapter.py`: 3 hard-coded records — `rec-1`: gat `123`, village `Ozarkhed`, district `Nashik`, owner `राम सिंह`, khata `45`, 1.2 Ha / 2.97 acres, landClass `जिरायत`, ferfar `F-102`, cropHistory `गेहूं, कांदा (2025)`; `rec-2` village `Pimpalgaon`; `rec-3` village `Dindori`. Gat match = exact; village match = case-insensitive substring (fuzzy-lite). `get_pdf_url` returns a fixed sample URL `https://example.com/sample-712.pdf`.
  4. `__init__.py`: `def get_adapter() -> LandRecordsAdapter`: `os.getenv("LAND_RECORDS_ADAPTER", "mock")` → `MockAdapter()` (only implementation today; raise on unknown value).
  5. Write `backend/app/routers/land_records.py` (`prefix="/land-records"`, roles farmer/farmLandlord):
     - `GET /search?gatNumber=&village=&district=&type=712|8A`: `gatNumber` must match `^[A-Za-z0-9]{1,20}$` else 422; `village` min 3 chars else 422; neither present → 400 `MISSING_SEARCH_PARAM`; `type` not in `712|8A` → 422. Call `get_adapter().search(...)`; envelope.
     - `GET /{id}/pdf`: `get_pdf_url` → 200 `{ "pdfUrl": "..." }`; unknown id → 404 `RECORD_NOT_FOUND`.
     - `POST /{id}/import`: fetch the record from the adapter (search by id — add `def get_by_id(self, record_id)` to the adapter interface); 404 `RECORD_NOT_FOUND`; update user doc: `landAreaAcres = record.totalAreaAcres`, append `{ gatNumber, village, ownerName, cropHistory }` to a `landRecords` array field; return 200 `{ "imported": true, "landAreaAcres": <float> }`.
  6. `app.include_router(land_records.router, prefix="/v1")`.
  7. Write `backend/tests/test_land_records.py`:
     - `test_search_by_village_fuzzy`: `?village=Ozar` → ≥1 match incl. Ozarkhed.
     - `test_village_too_short_422`: `?village=Oz` → 422.
     - `test_search_by_gat_exact`: `?gatNumber=123` → exactly `rec-1`.
     - `test_missing_params_400`: no params → 400 `MISSING_SEARCH_PARAM`.
     - `test_import_updates_profile`: POST import `rec-1` → 200, `landAreaAcres == 2.97`, user doc has `landRecords` entry with gatNumber `123`.
     - `test_adapter_swap_env`: monkeypatch env `LAND_RECORDS_ADAPTER=mock` → `isinstance(get_adapter(), MockAdapter)`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_land_records.py -v`
- **Expected output:** `6 passed`.

### Task A4 — Water intelligence endpoints

- **Goal:** `GET /v1/water/schedule`, `GET /v1/water/groundwater`, `GET /v1/water/canal-rotation`, `POST /v1/water/pmksy-calculator`.
- **Depends on:** Day 3 (profile: `activeCrops`, `district`, `irrigationType`).
- **Files to create/modify:**
  - `backend/app/routers/water.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_water.py` (new)
- **Subtasks:**
  1. Write `backend/app/routers/water.py` (`prefix="/water"`, role farmer):
     - `GET /schedule`: one entry per crop in user `activeCrops` → `[{ plotName: <crop>, moisturePercent, recommendedMinutes, method }]`; moisture deterministic: `35 + (zlib.crc32((uid + crop).encode()) % 40)`; `recommendedMinutes = 90 if moisture < 60 else 30`; `method = user["irrigationType"] or "drip"`. Envelope.
     - `GET /groundwater?district=`: district required (400 `MISSING_DISTRICT`); static CGWB-style map — Nashik `{depthMeters: 18.5, zone: "semiCritical"}`, Pune `{12.0, "safe"}`, Nagpur `{25.2, "critical"}`, Aurangabad `{21.0, "semiCritical"}`, default `{15.0, "safe"}`; add `measuredAt: <today iso>`.
     - `GET /canal-rotation?canal=`: return `[{ canalName, nextDate, slotTime }]` — Gangapur Canal (next Monday, `06:00-12:00`), Palkhed Canal (next Thursday, `12:00-18:00`); optional case-insensitive `canal` contains-filter. Envelope.
     - `POST /pmksy-calculator`: body `{"acres": float = Field(gt=0)}`; `totalCost = acres * 85000`; `subsidyPercent = 55`; `subsidyAmount = round(totalCost * 0.55, 2)`; `farmerShare = round(totalCost - subsidyAmount, 2)`; return all four.
  2. `app.include_router(water.router, prefix="/v1")`.
  3. Write `backend/tests/test_water.py`:
     - `test_schedule_one_entry_per_crop`: user with 2 activeCrops → 2 entries; `recommendedMinutes` in {30, 90}; same call twice → identical moisture (deterministic).
     - `test_groundwater_requires_district`: no param → 400 `MISSING_DISTRICT`.
     - `test_groundwater_nagpur_critical`: `?district=Nagpur` → `zone == "critical"`.
     - `test_canal_rotation_filter`: `?canal=gangapur` → 1 entry.
     - `test_pmksy_exact`: `{acres: 2}` → `{totalCost: 170000, subsidyPercent: 55, subsidyAmount: 93500.0, farmerShare: 76500.0}`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_water.py -v`
- **Expected output:** `5 passed`.

### Task A5 — Account deletion + FCM device registration

- **Goal:** `DELETE /v1/users/me` (full data purge — Play Store requirement) and `POST /v1/devices` (FCM token) + `DELETE /v1/devices/{tokenHash}`.
- **Depends on:** Day 2 Task A2 (`verify_mpin` in `app/core/security.py`); Day 9 (subcollections to purge).
- **Files to create/modify:**
  - `backend/app/services/purge.py` (new)
  - `backend/app/routers/users.py` (modify — add 3 routes)
  - `backend/tests/test_account.py` (new)
- **Subtasks:**
  1. Write `backend/app/services/purge.py`:
     - `async def purge_user(uid: str) -> dict`: delete known subcollections of `users/{uid}` — `diary_entries`, `crop_pnl`, `vault_documents`, `land_plots`, `land_leases` (incl. their `payments` subdocs), `scheme_applications`, `devices`, `coin_ledger` (iterate + delete each doc); delete Storage prefixes `vault/{uid}/` and `reports/{uid}/` (skip silently in dev mode); delete the `users/{uid}` doc; `firebase_admin.auth.delete_user(uid)` (mock in tests); anonymize — do NOT delete — financial docs: `query("transport_bookings", [("userId", "==", uid)])` and orders, replacing `userId` with `f"deleted:{uid[:8]}"`. Return `{ "subcollectionsDeleted": n, "authDeleted": true, "financialAnonymized": n }`.
  2. In `backend/app/routers/users.py` add:
     - `DELETE /me`: body `{"mpin": str}`; load user → `mpinHash` None → 409 `MPIN_NOT_SET`; `verify_mpin` fails → 401 `WRONG_MPIN`. Rate limit: Redis key `del_attempts:{uid}` INCR + EXPIRE 3600; > 3 → 429 `TOO_MANY_ATTEMPTS`. Call `purge_user`; return 200 `{ "deleted": true, "purged": <counts> }`.
     - `POST /devices`: body `{"fcmToken": str, "platform": Literal["android", "web"], "locale": str = "hi"}`; upsert `users/{uid}/devices/{sha256(fcmToken).hexdigest()[:16]}` with `lastSeenAt`; return 201 `{ "registered": true }`.
     - `DELETE /devices/{tokenHash}`: delete the doc; 204 (idempotent — no 404).
  3. Write `backend/tests/test_account.py`:
     - `test_delete_wrong_mpin_401`: → 401 `WRONG_MPIN`.
     - `test_delete_purges_everything`: seed user + diary entry + device; correct MPIN → 200 `{"deleted": true, ...}`; `users/{uid}` gone; mocked `auth.delete_user` called with uid; subcollections empty.
     - `test_delete_rate_limited_429`: 4th attempt within the hour → 429.
     - `test_register_device_idempotent`: POST twice same token → 201 both times; exactly 1 device doc.
- **Test:** `cd backend && .venv/bin/pytest tests/test_account.py -v`
- **Expected output:** `4 passed`. Emulator run (pre-release): purge removes Auth user + Firestore subcollections + Storage prefix.

## Dev B — Flutter tasks

### Task B1 — Port Schemes view + vault sheet

- **Goal:** Port `schemes_view.dart` wired to `/v1/schemes/*` and `/v1/vault/documents`.
- **Depends on:** Day 3 Task B1 (api client). Add `file_picker: ^8.1.2` to `apps/mobile/pubspec.yaml`.
- **Files to create/modify:**
  - `apps/mobile/lib/views/schemes_view.dart` (modify — port from `flutter-prototype/lib/views/schemes_view.dart`)
  - `apps/mobile/lib/api/schemes_api.dart` (new)
  - `apps/mobile/lib/api/vault_api.dart` (new)
  - `apps/mobile/lib/models/govt_scheme.dart` (new), `apps/mobile/lib/models/vault_document.dart` (new)
  - `apps/mobile/test/schemes_view_test.dart` (new)
- **Subtasks:**
  1. Copy the view verbatim — scheme cards, category pills, dual apply paths, vault bottom sheet, security banner dialog.
  2. `schemes_api.dart`: `listSchemes({category, eligibleOnly})`, `applyScheme(id, documentIds)`, `getPortals()`. `vault_api.dart`: `listDocuments()`, `uploadDocument(docType, PlatformFile)` (multipart via `http.MultipartRequest` — same approach reused Day 11), `deleteDocument(id)`.
  3. Eligibility toggle → `eligibleOnly=true`; badge `पात्र ✓` when `scheme.eligible`.
  4. `ऐप से आवेदन करें` → vault doc picker sheet (checkbox list from `listDocuments()`) → `applyScheme` → SnackBar `आवेदन जमा हुआ`; on `ALREADY_APPLIED` → `पहले से आवेदन किया हुआ`; on `NOT_ELIGIBLE` → `आप इस योजना के लिए पात्र नहीं हैं`.
  5. `Official Portal →` → find `portalUrl` by schemeId from `getPortals()` → show the prototype security banner dialog → `url_launcher` external browser.
  6. Vault sheet: doc list + upload button (`file_picker` → docType dropdown आधार/7-12/बैंक पासबुक/स्वास्थ्य कार्ड → `uploadDocument`) + delete icon per doc (confirm dialog).
  7. `apps/mobile/test/schemes_view_test.dart`:
     - `testWidgets('schemes list renders with eligibility badge', ...)` — fake 2 schemes (1 eligible); expect exactly one `पात्र ✓`.
     - `testWidgets('duplicate apply shows snackbar', ...)` — fake throws `ApiException(code: 'ALREADY_APPLIED')`; tap apply → expect `पहले से आवेदन किया हुआ`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/schemes_view_test.dart`
- **Expected output:** `No issues found!`; 2 tests pass; manual: apply PM-KISAN with a vault doc → 201 SnackBar; portal button opens pmkisan.gov.in.

### Task B2 — Port Land & Legal (7/12) view

- **Goal:** Port `land_legal_view.dart` wired to `/v1/land-records/*`.
- **Depends on:** Day 3 Task B1. API dependency: Day 10 Task A3.
- **Files to create/modify:**
  - `apps/mobile/lib/views/land_legal_view.dart` (modify — port from `flutter-prototype/lib/views/land_legal_view.dart`)
  - `apps/mobile/lib/api/land_records_api.dart` (new)
  - `apps/mobile/lib/models/land_record.dart` (new)
  - `apps/mobile/test/land_legal_view_test.dart` (new)
- **Subtasks:**
  1. Copy the view verbatim — Gat/village search tabs, 712/8A toggle, disambiguation list, record cards, PDF actions, Auto-Store button.
  2. `land_records_api.dart`: `search({gatNumber, village, district, type})`, `getPdfUrl(id)`, `importRecord(id)`.
  3. Client-side validation before the API call: village < 3 chars → inline error `कम से कम 3 अक्षर लिखें`; empty both fields → `गट क्रमांक या गांव लिखें`. On 400/422 show `खोज मान्य नहीं है`.
  4. Multi-match → prototype disambiguation list; single match → straight to record card.
  5. Record card buttons: `PDF देखें` → `getPdfUrl` → `launchUrl`; `स्वतः सहेजें` → `importRecord` → SnackBar `क्षेत्र प्रोफ़ाइल में सहेजा गया` + refresh `AppState.currentUser`.
  6. `apps/mobile/test/land_legal_view_test.dart`:
     - `testWidgets('land record card renders owner and area', ...)` — fake rec-1; expect `राम सिंह` and area text.
     - `testWidgets('short village shows inline error', ...)` — type `Oz`, tap search; expect `कम से कम 3 अक्षर लिखें`; fake api NOT called.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/land_legal_view_test.dart`
- **Expected output:** `No issues found!`; 2 tests pass; manual: search Gat `123` → record card → Auto-Store updates profile acres.

### Task B3 — Port Water view

- **Goal:** Port `water_view.dart` wired to `/v1/water/*`.
- **Depends on:** Day 3 Task B1. API dependency: Day 10 Task A4.
- **Files to create/modify:**
  - `apps/mobile/lib/views/water_view.dart` (modify — port from `flutter-prototype/lib/views/water_view.dart`)
  - `apps/mobile/lib/api/water_api.dart` (new)
  - `apps/mobile/test/water_view_test.dart` (new)
- **Subtasks:**
  1. Copy the view verbatim — plot irrigation cards, groundwater gauge, canal rotation, PMKSY calculator.
  2. `water_api.dart`: `getSchedule()`, `getGroundwater(district)`, `getCanalRotation({canal})`, `pmksyCalc(acres)`.
  3. Plot cards ← `getSchedule()` (moisture %, recommended minutes; the drip-timer button stays UI-only).
  4. Groundwater gauge ← `getGroundwater(user.district)`; zone colors: safe `Color(0xFF43A047)`, semiCritical `Color(0xFFF59E0B)`, critical `Color(0xFFE53935)`.
  5. Canal cards ← `getCanalRotation()`.
  6. PMKSY slider (0.5–10 acres) → `pmksyCalc` on `onChangeEnd`; show `totalCost`, `subsidyAmount (55%)`, `farmerShare`; keep local-math fallback on failure (no error UI).
  7. `apps/mobile/test/water_view_test.dart`:
     - `testWidgets('water renders schedule and groundwater gauge', ...)` — fake schedule (1 plot) + gauge (Nashik semiCritical); expect plot name and depth text.
     - `testWidgets('pmksy shows subsidy split', ...)` — fake `{totalCost: 170000, subsidyAmount: 93500, farmerShare: 76500}`; expect `93,500` visible.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/water_view_test.dart`
- **Expected output:** `No issues found!`; 2 tests pass.

### Task B4 — NEW account screens (notifications, settings, help, delete)

- **Goal:** 4 new screens reachable from the top bar / profile menu.
- **Depends on:** Day 3 Task B1; Day 4 top bar (`luxury_top_bar.dart`). API dependency: Day 10 Task A5 (delete/devices); `GET /v1/notifications` lands Day 13 — build the UI today against a graceful empty state.
- **Files to create/modify:**
  - `apps/mobile/lib/views/account/notifications_view.dart` (new screen)
  - `apps/mobile/lib/views/account/settings_view.dart` (new screen)
  - `apps/mobile/lib/views/account/help_support_view.dart` (new screen)
  - `apps/mobile/lib/views/account/account_delete_view.dart` (new screen)
  - `apps/mobile/lib/api/notifications_api.dart` (new — `listNotifications()`, `markAllRead()`)
  - `apps/mobile/lib/state/profile_routes.dart` (modify — routes `notifications`, `settings`, `helpSupport`, `accountDelete`; all 6 personas)
  - `apps/mobile/lib/components/navigation/luxury_top_bar.dart` (modify — bell icon → `notifications`; avatar menu → `settings`, `helpSupport`)
  - `apps/mobile/test/account_views_test.dart` (new)
- **Subtasks:**
  1. `notifications_view.dart`: app bar `सूचनाएं`; `FutureBuilder` on `listNotifications()` — on `ApiException` 404/network (endpoint not deployed until Day 13) render empty state: icon + `कोई सूचना नहीं`; rows: type icon, title, body, relative time; button `सभी पढ़ें` → `markAllRead()` (failure = no-op).
  2. `settings_view.dart`: app bar `सेटिंग्स`; language dropdown (hi/mr/gu/pa/te/ta/en) → `PUT /v1/users/me/settings {language, womenMode, highContrast, darkMode}` (send the full current body, not just the changed key); switches for `womenMode`, `highContrast`, `darkMode` (same PUT, update local AppState immediately); red tile `खाता हटाएं` → `accountDelete`; footer `ऐप संस्करण 1.0.0`.
  3. `help_support_view.dart`: app bar `सहायता`; FAQ (5 static Hindi Q/A `ExpansionTile`s); `कॉल करें 1800-XXX-XXX` (tel: link); `WhatsApp सहायता` (wa.me link); `किसान मित्र से पूछें` → opens the chatbot sheet (Day 5 port).
  4. `account_delete_view.dart`: warning card `यह कार्रवाई पूर्ववत नहीं की जा सकती`; bullet list of deleted data (प्रोफ़ाइल, दस्तावेज़, डायरी, पट्टे); 4-digit MPIN field → `DELETE /v1/users/me` body `{mpin}` via api client `del` with body support (add if missing); on 200 → clear SharedPreferences, route to splash, SnackBar `खाता हटा दिया गया`; on 401 `WRONG_MPIN` → `गलत MPIN`; on 429 → `बहुत अधिक प्रयास — बाद में कोशिश करें`.
  5. `apps/mobile/test/account_views_test.dart`:
     - `testWidgets('settings renders toggles', ...)` — expect language dropdown + 3 switch tiles.
     - `testWidgets('account delete shows warning', ...)` — expect `पूर्ववत नहीं की जा सकती` and the MPIN field.
     - `testWidgets('notifications empty state', ...)` — fake 404 → expect `कोई सूचना नहीं`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/account_views_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: settings language change round-trips (PUT 200); delete blocked without MPIN; wrong MPIN → `गलत MPIN`.

## Done-when checklist (end of day)

- [ ] `cd backend && .venv/bin/pytest tests/test_schemes.py tests/test_vault.py tests/test_land_records.py tests/test_water.py tests/test_account.py -v` → 26 passed; full suite green.
- [ ] Eligibility is data-driven (`eligibilityRules`); `eligibleOnly=true` verified.
- [ ] Vault: upload → signed URL returns identical bytes (checked once); 415/413 paths tested; no Aadhaar logging.
- [ ] Land-records adapter swap needs zero router edits (`LAND_RECORDS_ADAPTER` env); import updates profile acres.
- [ ] PMKSY math exact (2 acres → 93500/76500); groundwater zones per district map.
- [ ] Account purge: emulator run removes Auth user + subcollections + Storage prefix; MPIN gate + 3-attempt rate limit verified.
- [ ] `POST /v1/devices` idempotent upsert verified.
- [ ] `flutter analyze` 0 issues; 9 new widget tests pass.
- [ ] Manual: scheme apply + portal deep-link + vault upload; 7/12 search → auto-store; 4 account screens navigable from top bar.

---

## Additional tasks (from missing.md)

Covers: X17 consent & privacy center, L5 rent reminder job, F9 soil-test booking. Specs: docs/overview/03 Part C/D items X17, L5, F9 — the spec item wins on any divergence.

### Task A6 — Consent & privacy center backend (X17)

- **Goal:** `PUT /v1/users/me/consents` `{dataSharing, location, marketing}` + `GET /v1/users/me/consents`, with an append-only `consent_log`. Spec: docs/overview/03 Part C item X17.
- **Depends on:** Day 2 Task A2 (`current_user_id`); advisory/saturation endpoint (Day 13 Task A2) must check `dataSharing` — the check is added there; today ships the storage + middleware helper.
- **Files to create/modify:**
  - `backend/app/models/consents.py` (new)
  - `backend/app/services/consents.py` (new)
  - `backend/app/routers/users.py` (modify — add 2 routes)
  - `backend/tests/test_consents.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/consents.py`:
     - `class ConsentsIn(BaseModel)`: `dataSharing: bool`, `location: bool`, `marketing: bool`
     - `class ConsentsOut(ConsentsIn)`: + `updatedAt: str`
  2. Write `backend/app/services/consents.py`:
     - `async def get_consents(uid: str) -> dict`: read `users/{uid}/consents` doc; defaults `{dataSharing: False, location: False, marketing: False}` when absent.
     - `async def put_consents(uid: str, consents: dict) -> dict`: `set_doc(f"users/{uid}/consents", "current", {**consents, "updatedAt": <utc iso>})`; append one doc per changed flag to `consent_log/{uuid}` `{ userId: uid, flag, newValue, at, source: "app" }` — the log is append-only: no update/delete path anywhere.
     - `async def require_data_sharing(uid: str) -> None`: raises a domain error the routers map to 403 `CONSENT_REQUIRED` (message `डेटा साझाकरण की सहमति आवश्यक है`) when `dataSharing` is false. Day 13 saturation + Day 14 sowing-intent call this.
  3. Add routes to `backend/app/routers/users.py` (all roles): `GET /me/consents` → 200 `ConsentsOut`; `PUT /me/consents` → full-replace semantics (all 3 keys required, 422 otherwise) → 200 `ConsentsOut`.
  4. Write `backend/tests/test_consents.py`:
     - `test_defaults_all_false`: fresh user → GET → all three false.
     - `test_put_round_trip`: PUT `{dataSharing: true, location: true, marketing: false}` → 200; GET → same.
     - `test_consent_log_appended_per_change`: PUT twice with 1 then 2 changed flags → `consent_log` has exactly 3 docs for the user, each with `flag`/`newValue`/`at`.
     - `test_put_missing_flag_422`: body without `marketing` → 422.
     - `test_require_data_sharing_raises_when_off`: helper raises for a fresh user, passes after PUT true.
- **Test:** `cd backend && .venv/bin/pytest tests/test_consents.py -v`
- **Expected output:** `5 passed`. Manual: `curl -X PUT http://localhost:8000/v1/users/me/consents -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"dataSharing":true,"location":true,"marketing":false}'` → 200.

### Task A7 — Rent reminder scheduled job (L5)

- **Goal:** Nightly job finds leases with rent due → FCM to landlord + tenant. Same cron-secret pattern as Day 9 Task A7 (X10). Spec: docs/overview/03 Part C item L5.
- **Depends on:** Day 9 Task A4 (`land_leases`, payments), Day 9 Task A7 (`routers/jobs.py`, cron-secret check), Day 13 Task A4 (`app/services/fcm.py` `notify` — build today against the signature, wire when it lands; until then patch in tests).
- **Files to create/modify:**
  - `backend/app/routers/jobs.py` (modify — add `POST /jobs/rent-reminders/run`)
  - `backend/app/services/rent_reminders.py` (new)
  - `backend/tests/test_rent_reminders.py` (new)
- **Subtasks:**
  1. Write `backend/app/services/rent_reminders.py`: `async def find_due_leases(today: date) -> list[dict]` — iterate `land_leases` docs (collection-group or per-landlord iteration, same approach as Day 14 admin claims); a lease is due when `status == "active"` and the current `YYYY-MM` has no payment in its `payments` subcollection and today ≥ the 5th of the month (grace window); returns `{lease, landlordUid, dueMonth}` rows.
  2. `async def run_rent_reminders() -> dict`: for each due lease — `notify(landlordUid, "किराया लंबित", f"{lease['tenantName']} का {dueMonth} का किराया ₹{lease['monthlyRentRupees']} लंबित है", {"type": "rent_reminder", "leaseId": lease["id"]})`; tenant phone is not a uid (tenants may not be app users) — landlord notification only in v1, note the tenant-SMS path as Day 13 X4 follow-up. Dedup: skip when `users/{landlordUid}/notifications` already has a `rent_reminder` doc for this lease + month. Return `{ "reminded": n }`.
  3. `POST /jobs/rent-reminders/run` in `routers/jobs.py`: same `X-Cron-Secret` guard as settlements; 200 with `{ "reminded": n }`.
  4. Write `backend/tests/test_rent_reminders.py` (patch `app.services.fcm.notify`):
     - `test_due_lease_notifies_landlord`: lease active, no payment for current month, today ≥ 5th → notify called once with `type == "rent_reminder"`, `{ "reminded": 1 }`.
     - `test_paid_month_skips`: payment for current month exists → `{ "reminded": 0 }`.
     - `test_grace_window`: today = 3rd → no reminder.
     - `test_dedup_same_month`: seed an existing rent_reminder notification → no second notify.
     - `test_cron_secret_required`: wrong header → 401 `CRON_UNAUTHORIZED`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_rent_reminders.py -v`
- **Expected output:** `5 passed`.

### Task A8 — Soil-test booking (F9)

- **Goal:** `POST /v1/soil-tests/book` `{plotId, address, slot}` + `GET /v1/soil-tests`. Spec: docs/overview/03 Part C item F9.
- **Depends on:** Day 10 Task A1 (Soil Health Card scheme seed), Day 3 (profile).
- **Files to create/modify:**
  - `backend/app/models/soil_tests.py` (new)
  - `backend/app/routers/soil_tests.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_soil_tests.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/soil_tests.py`:
     - `class SoilTestBookIn(BaseModel)`: `plotId: str | None = None`, `address: str = Field(min_length=10)`, `slot: str` (YYYY-MM-DD + "am"|"pm", e.g. `2026-09-20 am`)
     - `class SoilTestOut(SoilTestBookIn)`: + `id: str`, `status: Literal["booked", "sampleCollected", "reportReady"]`, `resultPdfUrl: str | None = None`, `bookedAt: str`
  2. Write `backend/app/routers/soil_tests.py` (`prefix="/soil-tests"`, roles farmer/farmLandlord):
     - `POST /book`: if `plotId` given it must be an own plot (404 `PLOT_NOT_FOUND`); one active booking per plot (`status != "reportReady"` for the same plotId) → 409 `SOIL_TEST_ALREADY_BOOKED`; write `users/{uid}/soil_tests/{id}` with `status: "booked"`; 201 `SoilTestOut`. Result-PDF upload by admin/lab is admin-side (Day 14 CMS handles docs; v1 leaves `resultPdfUrl` admin-writable via the user doc).
     - `GET /`: own bookings sorted `bookedAt` desc; envelope.
  3. `app.include_router(soil_tests.router, prefix="/v1")`.
  4. Write `backend/tests/test_soil_tests.py`:
     - `test_book_201`: valid body → 201 `status == "booked"`.
     - `test_double_book_same_plot_409`: repeat with same plotId → 409 `SOIL_TEST_ALREADY_BOOKED`.
     - `test_book_without_plot_ok`: no plotId → 201.
     - `test_foreign_plot_404`: another user's plotId → 404 `PLOT_NOT_FOUND`.
     - `test_list_sorted_desc`: 2 bookings → newest first.
- **Test:** `cd backend && .venv/bin/pytest tests/test_soil_tests.py -v`
- **Expected output:** `5 passed`.

### Task B5 — Consent toggles in settings (X17)

- **Goal:** Privacy/consent section in `settings_view.dart` wired to `PUT /v1/users/me/consents`. Spec: docs/overview/03 Part D item X17. API dependency: Day 10 Task A6.
- **Depends on:** Day 10 Task B4 (`settings_view.dart`); Day 10 Task A6.
- **Files to create/modify:**
  - `apps/mobile/lib/views/account/settings_view.dart` (modify — add section)
  - `apps/mobile/lib/api/users_api.dart` (modify — `getConsents()`, `putConsents(...)`)
  - `apps/mobile/test/account_views_test.dart` (modify — append test)
- **Subtasks:**
  1. Add a `गोपनीयता और सहमति` section header to settings with 3 switch tiles: `डेटा साझाकरण (सलाह के लिए)` — subtitle `बुवाई-संतृप्ति सलाह के लिए आपका डेटा गिनती में जुड़ता है`; `स्थान (लोकेशन)`; `मार्केटिंग संदेश`.
  2. On load: `getConsents()` → switch states; on toggle: optimistic flip + `putConsents` with the full current body (all 3 keys); on error revert + SnackBar `सहमति सहेजी नहीं जा सकी`.
  3. Explanatory note under the section: `डेटा साझाकरण बंद करने पर बाज़ार संतृप्ति सलाह उपलब्ध नहीं होगी`.
  4. `apps/mobile/test/account_views_test.dart`: `testWidgets('consent toggles render and save', ...)` — fake consents all false → 3 switches off; flip `डेटा साझाकरण` → fake api recorded `putConsents` with `dataSharing: true`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/account_views_test.dart`
- **Expected output:** `No issues found!`; existing 3 + new 1 test pass; manual: toggle persists across app restart (GET on open).

### Task B6 — Soil-test booking dialog (F9)

- **Goal:** "Book soil test" entry points from Schemes (Soil Health Card card) and from rewards redemption (`Free soil test` reward). Spec: docs/overview/03 Part D item F9. API dependency: Day 10 Task A8.
- **Depends on:** Day 10 Task B1 (`schemes_view.dart`); Day 13 Task B3 (`krishi_ratna_view.dart` — wire the redeem hook when it lands; the dialog itself ships today); Day 10 Task A8.
- **Files to create/modify:**
  - `apps/mobile/lib/components/soil_test_booking_sheet.dart` (new — shared bottom sheet)
  - `apps/mobile/lib/api/soil_tests_api.dart` (new — `bookSoilTest`, `listSoilTests`)
  - `apps/mobile/lib/views/schemes_view.dart` (modify — Soil Health Card card gets `मिट्टी परीक्षण बुक करें` button)
  - `apps/mobile/test/soil_test_booking_test.dart` (new)
- **Subtasks:**
  1. `soil_test_booking_sheet.dart`: form — plot dropdown (from Day 9 `land_api.listPlots`, optional, plus `बिना प्लॉट` choice), address field (min 10 chars → inline `पूरा पता लिखें`), slot picker (date picker + `सुबह`/`दोपहर` chips → `"<date> am|pm"`); submit → `bookSoilTest` → on 201 SnackBar `मिट्टी परीक्षण बुक हुआ`; on `SOIL_TEST_ALREADY_BOOKED` → `इस प्लॉट का परीक्षण पहले से बुक है`.
  2. In `schemes_view.dart`: the Soil Health Card scheme card shows the booking button below the apply buttons (match prototype card styling); tap → the sheet.
  3. After booking, show the existing booking status chip when `listSoilTests()` has an active one for the chosen plot (`बुक्ड`, `नमूना लिया गया`, `रिपोर्ट तैयार`).
  4. `apps/mobile/test/soil_test_booking_test.dart`:
     - `testWidgets('sheet renders fields', ...)` — plot dropdown + address + slot chips visible.
     - `testWidgets('book success shows snackbar', ...)` — fake 201 → expect `मिट्टी परीक्षण बुक हुआ`.
     - `testWidgets('already booked shows error', ...)` — fake throws `ApiException(code: 'SOIL_TEST_ALREADY_BOOKED')` → expect `पहले से बुक है`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/soil_test_booking_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: Soil Health Card → book → SnackBar; repeat same plot → 409 message.

### Done-when additions (additional tasks)

- [ ] `cd backend && .venv/bin/pytest tests/test_consents.py tests/test_rent_reminders.py tests/test_soil_tests.py -v` → 15 passed; full suite green.
- [ ] `consent_log` is append-only (no update/delete code path — grep confirms) and records one doc per changed flag.
- [ ] Rent reminder: due lease → landlord notified with `type == "rent_reminder"`; paid month + grace window + dedup verified.
- [ ] Soil-test booking: 201 + duplicate-plot 409 + foreign-plot 404 paths green.
- [ ] `flutter analyze` 0 issues; 4 new widget tests pass (consents 1, soil booking 3).
- [ ] Manual: settings toggles round-trip; Soil Health Card → booking dialog → 201 SnackBar.
