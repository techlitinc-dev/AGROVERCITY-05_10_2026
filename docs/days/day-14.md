# Day 14 — Remaining Modules (Women, Climate, Post-Harvest, Sync) + Admin API + Web Builds + Admin Console

**Dev A (Backend) goal:** Women hub, climate, post-harvest (grading stub), idempotent `/v1/sync` replay, and the full `/v1/admin/*` surface (custom-claim login, users, vyapari-rate approvals, content CMS, claims administration, analytics) shipped with tests.
**Dev B (Flutter) goal:** `women_farmer_view`, `climate_carbon_view`, `post_harvest_view` ported and wired; `apps/mobile` Flutter Web release build working; new `apps/admin` Flutter Web console (login, dashboard, rate approvals, content CMS, users, claims) shipped.

## Dev A — Backend tasks

### Task A1 — Women Farmer hub endpoints

- **Goal:** `GET /v1/women/shg`, `POST /v1/women/shg/deposit`, `GET /v1/women/home-enterprise`.
- **Depends on:** Day 2 Task A2 (`current_user_id`), Day 3 (`require_role`).
- **Files to create/modify:**
  - `backend/app/routers/women.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_women.py` (new)
- **Subtasks:**
  1. Write `backend/app/routers/women.py` (`router = APIRouter(prefix="/women", tags=["women"])`, role farmer via `require_role`. Women mode is a UI flag — do NOT gate on `womenMode` server-side):
     - `GET /shg`: doc `users/{uid}/shg/profile`; auto-seed on first read `{ memberCount: 12, corpus: 48500, loanFund: 30000, monthlyDeposit: 500 }`; 200 with the doc.
     - `POST /shg/deposit`: body `{ amount: float = Field(gt=0), month: str = Field(pattern=r"^\d{4}-\d{2}$") }`; a deposit doc for `month` already in `users/{uid}/shg/deposits` → 409 `DUPLICATE_DEPOSIT_MONTH`; write deposit doc + `corpus += amount`; 201 `{ "deposited": amount, "newCorpus": <float> }`.
     - `GET /home-enterprise`: doc `users/{uid}/home_enterprise/summary`; auto-seed `lines: [{ product: "अचार", monthlyProfit: 3200 }, { product: "पापड़", monthlyProfit: 2100 }, { product: "A2 घी", monthlyProfit: 4500 }]`; 200 `{ "lines": [...], "totalMonthlyProfit": 9800 }` (compute the total, don't store it).
  2. `app.include_router(women.router, prefix="/v1")`.
  3. Write `backend/tests/test_women.py`:
     - `test_shg_seeds_defaults_on_first_read`: → `{memberCount: 12, corpus: 48500, ...}`.
     - `test_deposit_updates_corpus`: POST `{amount: 500, month: "2026-09"}` → 201, `newCorpus == 49000`.
     - `test_duplicate_deposit_month_409`: repeat → 409 `DUPLICATE_DEPOSIT_MONTH`.
     - `test_home_enterprise_total`: → `totalMonthlyProfit == 9800` == sum of lines.
     - `test_deposit_bad_month_format_422`: `month: "Sep 2026"` → 422.
     - `test_women_forbidden_for_seller`: seller profile → 403 `FORBIDDEN_ROLE`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_women.py -v`
- **Expected output:** `6 passed`.

### Task A2 — Climate + Post-harvest endpoints

- **Goal:** `GET /v1/climate/carbon-potential`, `GET /v1/climate/resilient-varieties`, `GET /v1/post-harvest/cold-storage`, `POST /v1/post-harvest/grade` (stub adapter).
- **Depends on:** Day 10 Task A2 (`storage.upload_user_file`); adapter pattern from Day 10 Task A3 / Day 13 Task A2.
- **Files to create/modify:**
  - `backend/app/routers/climate.py` (new)
  - `backend/app/routers/post_harvest.py` (new)
  - `backend/app/services/grading_model/base.py` + `stub.py` + `__init__.py` (new — `GradeModelAdapter.scan(image_bytes) -> dict`; `get_grading_adapter()` via env `GRADE_MODEL_ADAPTER`, default stub)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_climate_postharvest.py` (new)
- **Subtasks:**
  1. Write `backend/app/routers/climate.py` (`prefix="/climate"`, role farmer):
     - `GET /carbon-potential?lat=&lng=`: from user `landAreaAcres` → `co2eTonnes = round(acres * 0.92, 1)`, `annualIncomePotential = round(co2eTonnes * 2000)` (₹2,000/tonne), `practices: ["biochar", "zero-till", "green-manure"]`. Sanity: 5 acres → `{ annualIncomePotential: 9200, co2eTonnes: 4.6 }` (matches the prototype hero card).
     - `GET /resilient-varieties?crop=&district=`: static list of 6 `[{ variety, crop, trait, source }]` — e.g. `Swarna Sub-1` rice flood-tolerant (IRRI), `HHB-67` bajra heat-tolerant (ICRISAT); optional `crop` contains-filter; envelope.
  2. Write `backend/app/routers/post_harvest.py` (`prefix="/post-harvest"`):
     - `GET /cold-storage?lat=&lng=` (farmer, transport, seller): static list of 4 `[{ id, name, distanceKm, tempRange, availableMT, ratePerQuintalMonth }]` (Nashik region); envelope.
     - `POST /grade` (farmer, seller): multipart 1–3 images (jpeg/png ≤ 5 MB → 415/413); upload to `grading/{uid}/`; stub adapter returns `{ grade: "AGMARK A", uniformityPercent: 88, shelfLifeDays: 12, recommendedPrice: 1650 }`; 200 with that dict.
  3. Include both routers with `prefix="/v1"`.
  4. Write `backend/tests/test_climate_postharvest.py`:
     - `test_carbon_potential_math`: user `landAreaAcres: 5` → `co2eTonnes == 4.6`, `annualIncomePotential == 9200`.
     - `test_resilient_varieties_filter`: `?crop=rice` → ≥1 item containing `Swarna`.
     - `test_cold_storage_list`: → 4 items with all keys.
     - `test_grade_stub`: PNG → 200 `grade == "AGMARK A"`; text file → 415.
     - `test_grade_max_3_images_422`: 4 images → 422.
     - `test_carbon_forbidden_for_transport`: transport profile → 403.
- **Test:** `cd backend && .venv/bin/pytest tests/test_climate_postharvest.py -v`
- **Expected output:** `6 passed`.

### Task A3 — Offline sync replay (`POST /v1/sync`)

- **Goal:** Idempotent replay of queued client writes; one bad op never fails the batch.
- **Depends on:** Day 9 diary, Day 11 claims, Day 8 equipment booking, Day 12 vet booking, Day 8 FPO pools — replay dispatches to those routers' service logic.
- **Files to create/modify:**
  - `backend/app/services/sync.py` (new)
  - `backend/app/routers/sync.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_sync.py` (new)
- **Subtasks:**
  1. Write `backend/app/services/sync.py`:
     - `async def already_processed(key: str) -> dict | None` / `async def mark_processed(key: str, result: dict)`: Firestore `idempotency_keys/{sha256(key)}` `{ result, processedAt }`.
     - `REPLAYABLE` whitelist — path-prefix → handler mapping: `POST /v1/diary/entries` (call the Day 9 create logic), `POST /v1/insurance/claims` (metadata-only replay: body carries already-uploaded photo URLs — photos are NOT replayable via sync; document this), `POST /v1/equipment/slots/{id}/book` (prefix match), `POST /v1/vets/{id}/book` (prefix match), `POST /v1/fpo/pools/{id}/join` (prefix match).
     - `async def dispatch(uid: str, op: dict) -> dict`: if `already_processed(op["idempotencyKey"])` → `{ "idempotencyKey": ..., "status": "duplicate", "httpStatus": <stored> }`; method != POST → `{ ..., "status": "error", "httpStatus": 400, "error": {"code": "UNSUPPORTED_METHOD"} }`; path not whitelisted → `UNSUPPORTED_PATH`; else call the handler, `mark_processed` on both success and domain error; success → `{ "status": "applied", "httpStatus": 201, "result": <body> }`; domain error (e.g. 409 `MAX_SLOTS_PER_DAY`) → `{ "status": "error", "httpStatus": 409, "error": <envelope> }`. Factor shared logic by importing the service-layer functions — do NOT make HTTP self-calls.
  2. Write `backend/app/routers/sync.py`: `POST /sync` (all roles) body `{ operations: [{ idempotencyKey, method, path, body, queuedAt }] }` (max 50 → 422). Process in order via `dispatch`; 200 `{ "results": [...], "applied": n, "duplicates": n, "errors": n }`.
  3. `app.include_router(sync.router, prefix="/v1")`.
  4. Write `backend/tests/test_sync.py`:
     - `test_replay_two_diary_ops`: batch of 2 → both `applied`, diary list has 2 new entries.
     - `test_replay_is_idempotent`: resend the same batch → both `duplicate`, diary count unchanged.
     - `test_unknown_path_per_op_error`: op with `/v1/whatever` → per-op `UNSUPPORTED_PATH`, batch HTTP 200, `errors == 1`.
     - `test_over_50_ops_422`: 51 ops → 422.
     - `test_conflicting_booking_op_409_in_batch`: replay an equipment booking that now violates max-2 → per-op 409 error, other ops still applied, batch 200.
- **Test:** `cd backend && .venv/bin/pytest tests/test_sync.py -v`
- **Expected output:** `5 passed`.

### Task A4 — Admin API

- **Goal:** Custom-claim admin guard, user management, vyapari-rate approval (feeding the Day 5 widget), content CMS, claims administration, analytics summary.
- **Depends on:** Day 5 Task A2 (`vyapari_rates_pending` collection, Redis keys `vyapari_rates:*`), Day 11 Task A2 (`claims.advance_status`), Day 12/13 content collections, Day 13 Task A4 (`fcm.notify` fires inside `advance_status`).
- **Files to create/modify:**
  - `backend/app/core/deps.py` (modify — add `admin_user`)
  - `backend/app/routers/admin.py` (new)
  - `backend/scripts/make_admin.py` (new — `python scripts/make_admin.py <uid>` sets the custom claim)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_admin.py` (new)
- **Subtasks:**
  1. In `backend/app/core/deps.py` add `async def admin_user(authorization: str = Header(...)) -> dict`: parse the **Firebase ID token** (admin console signs in with Firebase Auth directly — this route family is the exception to the backend-JWT rule; document that in a comment): `firebase_admin.auth.verify_id_token(token, check_revoked=True)`; `claims.get("admin") is not True` → 403 `ADMIN_REQUIRED`; return the decoded claims dict.
  2. Write `backend/scripts/make_admin.py`: `firebase_admin.auth.set_custom_user_claims(uid, {"admin": True})`; print `admin claim set for <uid>`.
  3. Write `backend/app/routers/admin.py` (`router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_user)])`):
     - `POST /login`: claim check already done by the dependency → 200 `{ "admin": true, "email": <decoded email>, "uid": <uid> }`.
     - `GET /users?persona=&page=`: list `users` (optionally `linkedProfiles` array-contains persona); envelope with `{ id, name, phone, district, state, linkedProfiles, activeProfile, status ("active"|"blocked", default active), agriCoins, createdAt }`.
     - `PUT /users/{id}/status`: body `{ status: Literal["active", "blocked"] }`; set on user doc; on `blocked` also `firebase_admin.auth.revoke_refresh_tokens(id)`; 200 `{ "id", "status" }`.
     - `GET /rates/pending`: `query("vyapari_rates_pending", [("status", "==", "pending")])`; envelope (fields from Day 5: `id, sellerId, crop, rate, mandiName, status, createdAt`).
     - `POST /rates/{id}/approve`: load pending doc (404 `RATE_NOT_FOUND`); write it into `vyapari_rates` (the collection Day 5's `GET /mandi/vyapari-rates` reads) with `status: "approved"`; delete/mark the pending doc `status: "approved"`; delete Redis keys matching `vyapari_rates:*` so the widget refreshes; 200 `{ "id", "status": "approved" }`.
     - `POST /rates/{id}/reject`: body `{ reason: str }`; set pending doc `status: "rejected", rejectionReason`; 200.
     - Content CMS, generic over whitelist `{news, blogs, videos, workshops, schemes}`: `POST /content/{collection}` (must contain `title` or `name` else 422; unknown collection → 400 `UNKNOWN_COLLECTION`; create with uuid id → 201), `PUT /content/{collection}/{docId}` (merge update → 200), `DELETE /content/{collection}/{docId}` (204).
     - `GET /claims?status=`: iterate users' `insurance_claims` subcollections (or a Firestore collection-group query if using the real SDK — either, pick collection-group with the real client); each item includes `userId`; envelope.
     - `PUT /claims/{userId}/{claimId}`: body `{ newStatus: ClaimStatus, approvedAmount: float | None, dbtTransactionId: str | None, note: str = "" }`; load claim (404 `CLAIM_NOT_FOUND`); `advance_status` from Day 11/13 (`ValueError` → 409 `ILLEGAL_STATUS_TRANSITION`); when `newStatus == "disbursed"` require `approvedAmount` and `dbtTransactionId` (422 `DISBURSAL_FIELDS_REQUIRED`) and store them; 200 with the updated claim (FCM notify fires inside `advance_status`).
     - `GET /analytics/summary`: 200 `{ totalUsers, usersByPersona: { farmer: n, farmLandlord: n, transport: n, seller: n, equipmentRental: n, broker: n }, bookings: { equipment: n, vet: n, transport: n }, orders: { count: n, gmv: <sum of order totals> }, claimsByStatus: { intimated: n, ... }, pendingRates: n }`; cache 60 s in Redis key `admin:analytics`.
  4. `app.include_router(admin.router, prefix="/v1")`.
  5. Write `backend/tests/test_admin.py` (patch `firebase_admin.auth.verify_id_token` to return claims with/without `admin: true`):
     - `test_non_admin_forbidden`: parametrize over `/login`, `/users`, `/analytics/summary` → all 403 `ADMIN_REQUIRED`.
     - `test_admin_login_ok`: → 200 `{"admin": true, ...}`.
     - `test_block_user_revokes_tokens`: PUT status blocked → user doc updated + mocked `revoke_refresh_tokens` called with the uid.
     - `test_approve_rate_feeds_widget`: seed a pending rate → approve → 200; assert a doc now exists in `vyapari_rates` with `status == "approved"` and the pending doc flipped; assert Redis `vyapari_rates:*` keys deleted (fakeredis).
     - `test_reject_rate`: → 200 with `rejectionReason` stored.
     - `test_claim_illegal_transition_409`: claim at `intimated` → PUT `dbtApproved` → 409; legal chain intimated→surveyorAssigned→fieldAssessed→dbtApproved→disbursed works; disbursed without `approvedAmount` → 422.
     - `test_content_cms_whitelist`: POST to `news` without title → 422; to `foobar` → 400 `UNKNOWN_COLLECTION`; valid create → 201; update → 200; delete → 204.
     - `test_analytics_summary_keys`: response has all top-level keys; second call hits Redis cache (assert Firestore query count unchanged via spy).
     - `test_users_persona_filter`: seed users with different `linkedProfiles` → `?persona=farmer` returns only farmers.
     - `test_admin_rates_unknown_id_404`: approve a bogus rate id → 404 `RATE_NOT_FOUND`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_admin.py -v`
- **Expected output:** `10 passed`.

## Dev B — Flutter tasks


### Task B1 — Port Women / Climate / Post-Harvest views

- **Goal:** Port the 3 remaining module views wired to the API.
- **Depends on:** Day 3 Task B1; `image_picker` (Day 11). API dependency: Day 14 Tasks A1–A2.
- **Files to create/modify:**
  - `apps/mobile/lib/views/women_farmer_view.dart` (modify — port from `flutter-prototype/lib/views/women_farmer_view.dart`)
  - `apps/mobile/lib/views/climate_carbon_view.dart` (modify — port)
  - `apps/mobile/lib/views/post_harvest_view.dart` (modify — port)
  - `apps/mobile/lib/api/women_api.dart` (new), `apps/mobile/lib/api/climate_api.dart` (new), `apps/mobile/lib/api/post_harvest_api.dart` (new)
  - `apps/mobile/test/remaining_views_test.dart` (new)
- **Subtasks:**
  1. Women view (4 tabs — SHG, kitchen garden, livestock health, home enterprise): SHG tab ← `GET /women/shg`; `मासिक जमा करें` → POST deposit (month = current) → 201 SnackBar `जमा सफल — नई कोष राशि ₹{newCorpus}`; `DUPLICATE_DEPOSIT_MONTH` → `इस महीने की जमा हो चुकी है`. Home-enterprise tab ← `GET /women/home-enterprise` (lines + total). Kitchen-garden and livestock-health tabs have NO backend endpoints in v1 — keep prototype demo data with comment `// demo data — no backend endpoint in v1`.
  2. Climate view: hero card ← `GET /climate/carbon-potential` (income + CO2e + 3 practice chips); varieties list ← `GET /climate/resilient-varieties?crop=` with crop filter chips.
  3. Post-harvest: cold-storage cards ← `GET /post-harvest/cold-storage`; AI grading card: pick 1–3 photos → `POST /post-harvest/grade` → result card (grade, uniformity %, shelf life, recommended price).
  4. All three use the Day 9 loading/error/retry pattern.
  5. `apps/mobile/test/remaining_views_test.dart`:
     - `testWidgets('women SHG tab renders corpus', ...)` — fake corpus 48500 → expect `₹48,500`-formatted text.
     - `testWidgets('women deposit duplicate shows snackbar', ...)` — fake throws `ApiException(code: 'DUPLICATE_DEPOSIT_MONTH')` → expect `इस महीने की जमा हो चुकी है`.
     - `testWidgets('climate hero renders', ...)` — fake 9200 → expect `₹9,200`.
     - `testWidgets('cold storage cards render', ...)` — fake 4 → 4 cards.
     - `testWidgets('post-harvest grade result renders', ...)` — fake grade `AGMARK A` → expect grade + uniformity text.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/remaining_views_test.dart`
- **Expected output:** `No issues found!`; 5 tests pass; manual: SHG deposit 201 then 409 path; grade card returns AGMARK A.

### Task B2 — Flutter Web build of the user app

- **Goal:** `apps/mobile` builds and runs as a responsive Flutter Web app.
- **Depends on:** All prior views.
- **Files to create/modify:**
  - `apps/mobile/lib/config.dart` (new — `const String apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:8000');`)
  - `apps/mobile/lib/api/api_client.dart` (modify — use `apiBaseUrl`)
  - `apps/mobile/lib/main.dart` (modify — `kIsWeb` guards)
  - `apps/mobile/web/index.html` (modify — title `Kisan Setu — AGROVERCITY`, Hindi meta description)
- **Subtasks:**
  1. Create `config.dart`; refactor `api_client.dart` to use `apiBaseUrl` everywhere (grep for hard-coded `localhost`).
  2. `main.dart`: `if (!kIsWeb) await PushService.init();` (Day 13); wrap camera-capture buttons in `if (!kIsWeb)` where they would crash on web (gallery path works).
  3. Responsive: wrap the app home in `LayoutBuilder` — `constraints.maxWidth > 900` → `Center(child: SizedBox(width: 480, child: ...))` so the phone UI reads well on desktop. Verify home, mandi, marketplace, schemes, insurance at 1366×768 and 390×844 (Chrome device toolbar) — no overflow/red screens.
  4. Build: `cd apps/mobile && flutter build web --release --dart-define=API_BASE_URL=https://api.agrovercity.in`.
  5. Web-specific gaps to close today (quick audit, not redesign):
     - Text scaling: set `MediaQuery.textScaler` clamp (max 1.3) in `MaterialApp.builder` so desktop browser zoom doesn't break card layouts.
     - `splash.mp4` on web: keep the 2-phase logo animation but skip the mp4 on `kIsWeb` (use the static logo images) if video autoplay is blocked — verify in Chrome incognito.
     - Deep links: the app is a state-machine router (no URL routes) — acceptable for v1 web; document in `apps/mobile/README.md` that URLs don't reflect routes.
  6. Commit `apps/mobile/build/web/` is NOT committed; add `build/` to `.gitignore` if missing.
- **Test:** `flutter analyze` 0 issues; build exits 0 and `apps/mobile/build/web/index.html` exists; manual `flutter run -d chrome` → login → dashboard renders; DevTools Network shows calls to the dart-define URL; no red screens at 1366×768 or 390×844.
- **Expected output:** `build/web/` produced; responsive constraint verified at both widths.

### Task B3 — NEW Admin console (`apps/admin`, Flutter Web)

- **Goal:** New app with login (admin claim), analytics dashboard, rate approvals, content CMS (news + schemes), users table, claims table. Simple Material tables/forms.
- **Depends on:** Day 14 Task A4.
- **Files to create/modify (all new):**
  - `apps/admin/pubspec.yaml` (name `kisan_setu_admin`; deps: flutter, firebase_core, firebase_auth, http, provider, intl)
  - `apps/admin/lib/main.dart`
  - `apps/admin/lib/config.dart` (same `API_BASE_URL` dart-define pattern)
  - `apps/admin/lib/api/admin_api.dart`
  - `apps/admin/lib/views/login_view.dart`
  - `apps/admin/lib/views/dashboard_view.dart`
  - `apps/admin/lib/views/rate_approvals_view.dart`
  - `apps/admin/lib/views/content_cms_view.dart`
  - `apps/admin/lib/views/users_view.dart`
  - `apps/admin/lib/views/claims_view.dart`
  - `apps/admin/web/index.html`
  - `apps/admin/test/admin_smoke_test.dart`
- **Subtasks:**
  1. Scaffold: `cd apps && flutter create --platforms=web admin`, then replace `lib/` with the files above.
  2. `admin_api.dart`: every call sends `Authorization: Bearer <Firebase ID token>` (`FirebaseAuth.instance.currentUser!.getIdToken()`); methods: `login()`, `getAnalytics()`, `listUsers({persona, page})`, `setUserStatus(id, status)`, `listPendingRates()`, `approveRate(id)`, `rejectRate(id, reason)`, `createContent(collection, body)`, `updateContent(collection, id, body)`, `deleteContent(collection, id)`, `listClaims({status})`, `advanceClaim(userId, claimId, newStatus, {approvedAmount, dbtTransactionId, note})`.
  3. `login_view.dart`: email+password → `signInWithEmailAndPassword` → `POST /v1/admin/login` → on 403 `ADMIN_REQUIRED` show `यह खाता एडमिन नहीं है`; on 200 → shell.
  4. Shell: `NavigationRail` with 5 destinations — डैशबोर्ड, दर अनुमोदन, कंटेंट, उपयोगकर्ता, दावे.
  5. `dashboard_view.dart`: 6 cards from `getAnalytics()` — कुल उपयोगकर्ता, किसान count, कुल बुकिंग (sum of 3), ऑर्डर GMV, लंबित दरें, लंबित दावे; Indian number grouping via `intl`.
  6. `rate_approvals_view.dart`: `DataTable` (व्यापारी, फसल, दर, मंडी, समय, क्रिया); `स्वीकृत` green → approve → row removed; `अस्वीकार` red → reason dialog → reject. Empty state `कोई लंबित दर नहीं`.
  7. `content_cms_view.dart`: collection dropdown (news / schemes); `DataTable` (title/name + edit/delete); `+ नया` dialog form — news: title, vernacularTitle, category dropdown, summary, content multiline, isBreaking checkbox; schemes: name, category, benefitAmount, description, nextDeadline date picker, documentsRequired comma-field; save → create/update; delete → confirm dialog.
  8. `users_view.dart`: persona filter dropdown + `PaginatedDataTable` (नाम, फ़ोन, जिला, प्रोफ़ाइल, कॉइन, स्थिति, क्रिया) with ब्लॉक/सक्रिय toggle → `setUserStatus`.
  9. `claims_view.dart`: status filter chips + `DataTable` (दावा क्रमांक, फसल, गांव, स्थिति, राशि, क्रिया); detail dialog shows `timeline` + a `स्थिति आगे बढ़ाएं` section: next-status dropdown limited to legal targets (client-side copy of the transition map), approvedAmount + dbtTransactionId fields shown only for `disbursed`; submit → `advanceClaim` → 409 → `अमान्य स्थिति परिवर्तन`.
  10. Build: `cd apps/admin && flutter build web --release --dart-define=API_BASE_URL=https://api.agrovercity.in`.
  11. `apps/admin/test/admin_smoke_test.dart`:
      - `testWidgets('login view renders', ...)` — email field + `लॉगिन` button.
      - `testWidgets('dashboard renders 6 analytics cards', ...)` — pump `DashboardView` with fake api → 6 cards.
  12. Firebase web config for the admin app: `flutterfire configure` reuses the same Firebase project — the admin console signs in with Firebase Auth (email/password) directly and the backend verifies the ID token + `admin` custom claim (Day 14 Task A4). Create the admin account once: create the user in Firebase console → run `cd backend && .venv/bin/python scripts/make_admin.py <uid>`.
  13. Keep dependencies minimal: no charts library — dashboard cards are plain `Card` + big `Text`; tables are stock `DataTable`/`PaginatedDataTable`. Hindi labels everywhere (admins are the same ops team).

### Admin console route map

| Shell destination | View file | Backend endpoints used |
|---|---|---|
| डैशबोर्ड | `dashboard_view.dart` | `GET /v1/admin/analytics/summary` |
| दर अनुमोदन | `rate_approvals_view.dart` | `GET /v1/admin/rates/pending`, `POST /rates/{id}/approve|reject` |
| कंटेंट | `content_cms_view.dart` | `POST/PUT/DELETE /v1/admin/content/{news,schemes}` |
| उपयोगकर्ता | `users_view.dart` | `GET /v1/admin/users`, `PUT /admin/users/{id}/status` |
| दावे | `claims_view.dart` | `GET /v1/admin/claims`, `PUT /admin/claims/{userId}/{claimId}` |

### Task B4 — Admin console extra widget tests

- **Goal:** Smoke coverage for the 3 riskiest admin flows.
- **Files to create/modify:**
  - `apps/admin/test/rate_approvals_test.dart` (new)
  - `apps/admin/test/claims_view_test.dart` (new)
- **Subtasks:**
  1. `rate_approvals_test.dart`: `testWidgets('pending rates table renders and approve removes row', ...)` — fake 2 pending rates; pump; expect both crop names; tap `स्वीकृत` on row 1 → fake recorded `approveRate(id)` and the table now shows 1 row. `testWidgets('empty state', ...)` — zero pending → expect `कोई लंबित दर नहीं`.
  2. `claims_view_test.dart`: `testWidgets('claims table renders claim numbers', ...)` — fake 1 claim `CLM-2026-MH-0001` → expect it in the table. `testWidgets('disbursed requires amount fields', ...)` — open detail dialog, pick `disbursed` in the next-status dropdown → expect the approvedAmount + dbtTransactionId fields to appear; pick `surveyorAssigned` → they disappear.
- **Test:** `cd apps/admin && flutter analyze && flutter test` → 0 issues; 6 tests total pass.
- **Expected output:** Rate approval and claim-advance flows are covered by widget tests before any manual QA.
- **Test:** `cd apps/admin && flutter analyze && flutter test` → 0 issues, 2 smoke tests pass (+ 4 more from Task B4); manual: admin login → approve a pending rate → it appears in the mobile app's "Aaj ke Bhav" widget after refresh.
- **Expected output:** `apps/admin/build/web/` produced; all 5 sections work against the dev backend.

## Done-when checklist (end of day)

- [ ] `cd backend && .venv/bin/pytest -v` → full suite green incl. `test_women.py` (6), `test_climate_postharvest.py` (6), `test_sync.py` (5), `test_admin.py` (10).
- [ ] Women home-enterprise total equals the sum of its lines; duplicate-deposit month → 409.
- [ ] Sync idempotency proven: replayed batch → `duplicate`, no new docs; conflicting op → per-op 409, batch 200.
- [ ] Admin guard: non-admin token → 403 `ADMIN_REQUIRED` on all `/v1/admin/*`.
- [ ] Rate lifecycle e2e: seller POST → pending list → admin approve → `GET /v1/mandi/vyapari-rates` includes it (Redis invalidated).
- [ ] Claim lifecycle e2e via admin API: intimated→surveyorAssigned→fieldAssessed→dbtApproved→disbursed; illegal jump 409; disbursal field validation 422.
- [ ] `flutter analyze` 0 issues in both `apps/mobile` and `apps/admin`; all new widget tests pass (5 mobile + 6 admin).
- [ ] Admin console has a working local run: `cd apps/admin && flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8000`.
- [ ] `flutter build web --release` succeeds for both apps with the production dart-define.
- [ ] Manual: women SHG deposit, post-harvest grade, admin console login → approve rate → visible in mobile widget.
- [ ] Admin CMS: create a news item in the console → it appears in the mobile Agri News feed without backend restart.
- [ ] Blocked user cannot call the API with an existing token (revocation verified: blocked user's requests → 401 after revocation propagates).
- [ ] Web responsive constraint verified at 1366×768 and 390×844 for home, mandi, marketplace, schemes, insurance.
- [ ] `apps/mobile/README.md` notes the web URL limitation (state-machine router, no URL routes in v1).
- [ ] Admin `flutter build web --release --dart-define=API_BASE_URL=https://api.agrovercity.in` exits 0; `build/web/index.html` exists.
- [ ] Sync whitelist documented: only the 5 replayable POST paths; photos never replay via sync (URL-carrying contract).
- [ ] `make_admin.py` runbook tested once against the emulator (claim set → admin login 200).

---

## Additional tasks (from missing.md)

Covers: X9 report/block, X19 sync conflict policy, F11 cold-storage booking, F6 sowing intent, admin A1/A3/A4/A5/A6, X18 legal pages, X2 chat (stretch). Specs: docs/overview/03 Part C/D items X9, X19, F11, F6, A1, A3–A6, X18, X2 — the spec item wins on any divergence.

### Task A5 — Report / block users (X9)

- **Goal:** `POST /v1/users/{id}/report` `{reason}` + blocks (`POST/DELETE /v1/users/me/blocks`); chat and any UGC surface filter blocked users. Spec: docs/overview/03 Part C item X9.
- **Depends on:** Day 2 Task A2; channel chat (Day 12 Task A1) and the X2 chat (stretch, Task B8) consume the block list.
- **Files to create/modify:**
  - `backend/app/routers/users.py` (modify — report + block routes)
  - `backend/app/services/blocks.py` (new)
  - `backend/tests/test_blocks.py` (new)
- **Subtasks:**
  1. Write `backend/app/services/blocks.py`: `async def blocked_pair(a: str, b: str) -> bool` — true when either `users/{a}/blocks/{b}` or `users/{b}/blocks/{a}` exists (blocking is bidirectional in effect); `async def list_blocked_ids(uid: str) -> set[str]`.
  2. Add routes to `backend/app/routers/users.py` (all roles):
     - `POST /users/{id}/report`: body `{ reason: str = Field(min_length=5, max_length=500) }`; target must exist (404 `USER_NOT_FOUND`); self-report → 400 `CANNOT_REPORT_SELF`; one open report per (reporter, target) → 409 `ALREADY_REPORTED`; write `reports/{uuid}` `{ reporterId, reportedId, reason, status: "open", createdAt }`; 201 `{ "reported": true }`.
     - `POST /users/me/blocks`: body `{ userId: str }`; target exists (404 `USER_NOT_FOUND`); self → 400; upsert `users/{uid}/blocks/{targetId}` `{ at }`; 201 `{ "blocked": true }`.
     - `DELETE /users/me/blocks/{userId}`: delete; 204 (idempotent).
     - `GET /users/me/blocks`: list blocked ids + names; envelope.
  3. Chat filtering: Day 12 channel chat `GET /channels/{id}/chat` drops messages whose author the caller has blocked (blocker's list only for public channels); the X2 1:1 chat (Task B8 / its backend hook) must reject message creation when `blocked_pair(sender, recipient)` → 403 `USER_BLOCKED`. Add the check call now behind a helper even if X2 slips.
  4. Write `backend/tests/test_blocks.py`:
     - `test_report_201`: → 201; duplicate → 409 `ALREADY_REPORTED`; self → 400 `CANNOT_REPORT_SELF`.
     - `test_block_unblock`: block → 201; GET lists it; DELETE → 204; list empty.
     - `test_blocked_pair_bidirectional`: A blocks B → `blocked_pair(B, A)` also true.
     - `test_channel_chat_filters_blocked`: seed chat messages from 2 authors, block one → GET chat omits their messages.
- **Test:** `cd backend && .venv/bin/pytest tests/test_blocks.py -v`
- **Expected output:** `4 passed`.

### Task A6 — Sync conflict policy: matrix + server-wins fields (X19)

- **Goal:** Conflict-resolution matrix documented for `/v1/sync`; server-wins enforced on wallet/insurance fields. Spec: docs/overview/03 Part C item X19.
- **Depends on:** Day 14 Task A3 (`services/sync.py`).
- **Files to create/modify:**
  - `docs/overview/03` sync section (modify — or `docs/conventions/` sync note; put the matrix where the sync spec lives)
  - `backend/app/services/sync.py` (modify — strip server-owned fields on replay)
  - `backend/tests/test_sync.py` (modify — append 2 tests)
- **Subtasks:**
  1. Conflict matrix (append to the sync spec):
     | Collection / fields | Policy | Notes |
     |---|---|---|
     | diary_entries | client-wins on content fields; server-wins on `agriCoinsEarned` | coins computed server-side |
     | insurance claims (metadata) | server-wins on `status`, `approvedAmount`, `timeline`, `bankAccountLast4` | client edits limited to submit-time fields |
     | wallet / `agriCoins` balance | server-wins always | ledger is the source of truth |
     | equipment/vet bookings | server-wins on `status`, `priceRupees` | slot conflicts decided by the engine |
     | profile (`users/me`) | last-write-wins on name/village/crops; server-wins on `kisanCreditScore`, `kccLimit`, `agriCoins` | |
  2. Enforcement: in `services/sync.py` `dispatch`, before calling a handler strip server-owned fields from `op["body"]` per the matrix (`SERVER_OWNED_FIELDS = {"agriCoins", "agriCoinsEarned", "status", "approvedAmount", "timeline", "bankAccountLast4", "kisanCreditScore", "kccLimit", "priceRupees"}` — intersect per handler; simplest correct v1: remove any of these keys present in a replayed body) and log a warning listing the stripped keys.
  3. Tests appended to `backend/tests/test_sync.py`:
     - `test_replay_strips_server_owned_fields`: replay a diary op whose body includes `agriCoinsEarned: 9999` → applied, stored doc has the server value (15), not 9999.
     - `test_claim_replay_ignores_status_field`: replay a claim op with `status: "disbursed"` → created claim is `intimated`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_sync.py -v`
- **Expected output:** `7 passed` (5 existing + 2 new); the matrix table is in the sync spec doc.

### Task A7 — Cold-storage booking (F11)

- **Goal:** `POST /v1/post-harvest/cold-storage/{id}/book` `{quantityQuintals, fromDate, months}` with capacity decrement; appears in My Bookings. Spec: docs/overview/03 Part C item F11.
- **Depends on:** Day 14 Task A2 (`GET /post-harvest/cold-storage` static list — today's booking promotes entries to real docs), Day 11 Task A3 (bookings aggregate).
- **Files to create/modify:**
  - `backend/app/routers/post_harvest.py` (modify — add booking route)
  - `backend/app/routers/users.py` (modify — `/me/bookings` gains a `coldStorage` key)
  - `backend/app/data/cold_storage_seed.py` (new — the 4 Day 14 entries become seeded docs with `availableMT`)
  - `backend/tests/test_cold_storage.py` (new)
- **Subtasks:**
  1. Move the 4 static cold-storage entries into an idempotent seed (`cold_storage` collection, fields as Day 14 + `bookedQuintals: float = 0`); `GET /cold-storage` now reads the collection and returns `availableMT` reduced by booked quantity (1 MT = 10 quintals: `availableMT - bookedQuintals/10`).
  2. `POST /post-harvest/cold-storage/{id}/book` (role farmer): body `quantityQuintals: float = Field(gt=0)`, `fromDate: str` (YYYY-MM-DD, not in the past → 422), `months: int = Field(ge=1, le=12)`; facility missing → 404 `STORAGE_NOT_FOUND`; `quantityQuintals > availableMT * 10` → 409 `INSUFFICIENT_CAPACITY`; increment `bookedQuintals`; write `users/{uid}/cold_storage_bookings/{uuid}` `{ facilityId, facilityName, quantityQuintals, fromDate, months, status: "booked", bookedAt }`; 201 with the booking.
  3. `GET /v1/users/me/bookings` gains a fourth key `coldStorage` (additive; items carry `kind: "coldStorage"`); `?status=` filter applies.
  4. Write `backend/tests/test_cold_storage.py`:
     - `test_book_decrements_capacity`: book 20 q on a 50 MT facility → `availableMT` drops to 48.0; booking 201.
     - `test_insufficient_capacity_409`: book 600 q on 50 MT → 409 `INSUFFICIENT_CAPACITY`.
     - `test_unknown_facility_404`: → 404 `STORAGE_NOT_FOUND`.
     - `test_past_date_422`: yesterday → 422.
     - `test_booking_in_my_bookings`: after booking, `GET /v1/users/me/bookings` has `coldStorage` len 1 with `kind == "coldStorage"`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_cold_storage.py -v`
- **Expected output:** `5 passed`.

### Task A8 — Sowing-intent capture with consent gate (F6)

- **Goal:** `POST /v1/advisory/sowing-intent` `{crop, plotId, plannedDate}` writes `crop_cycles` with `isIntent: true`; requires `dataSharing` consent. Spec: docs/overview/03 Part C item F6.
- **Depends on:** Day 10 Task A6 (`require_data_sharing`), Day 13 Task A2 (`crop_cycles` shape from saturation).
- **Files to create/modify:**
  - `backend/app/routers/advisory.py` (modify — add route)
  - `backend/tests/test_advisory.py` (modify — append 3 tests)
- **Subtasks:**
  1. `POST /advisory/sowing-intent` (role farmer): body `crop: str`, `plotId: str | None = None` (own plot else 404 `PLOT_NOT_FOUND`), `plannedDate: str` (YYYY-MM-DD, not in the past → 422); call `require_data_sharing(uid)` → 403 `CONSENT_REQUIRED` (`डेटा साझाकरण की सहमति आवश्यक है`) when off; upsert `crop_cycles/{uid}_{crop}_{season}` `{ userId, crop, plotId, district, lat, lng (profile farm location), season: <current Kharif/Rabi>, plannedDate, isIntent: true, createdAt }`; 201 `{ "recorded": true, "isIntent": true }`.
  2. Saturation counts (Day 13) now read these intent docs too — same collection, no query change needed; assert in a test that an intent doc raises `sowingCount`.
  3. Tests appended to `backend/tests/test_advisory.py`:
     - `test_intent_recorded_with_flag`: PUT consents dataSharing true → POST → 201, crop_cycles doc has `isIntent == True`.
     - `test_intent_without_consent_403`: fresh user (default off) → 403 `CONSENT_REQUIRED`.
     - `test_intent_feeds_saturation_count`: record intent → saturation for that crop/district `sowingCount >= 1`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_advisory.py -v`
- **Expected output:** `8 passed` (5 existing + 3 new).

### Task A9 — Admin pack: KYC queue, scheme rules editor, broadcast, settlements console, moderation (A1, A3, A4, A5, A6)

- **Goal:** Extend the Day 14 admin API with the 5 missing console surfaces. Specs: docs/overview/03 Part C items A1, A3, A4, A5, A6.
- **Depends on:** Day 14 Task A4 (admin guard + router), Day 9 Task A7 (`settlements`), Day 14 Task A5 (`reports` collection).
- **Files to create/modify:**
  - `backend/app/routers/admin.py` (modify — add routes)
  - `backend/tests/test_admin.py` (modify — append tests)
- **Subtasks:**
  1. **A1 KYC queue:** `GET /v1/admin/kyc/pending` — union of entities with a `kycStatus == "pending"` doc field across vehicles (Day 7), equipment (Day 8), seller profiles, broker profiles; each item `{ entityId, entityKind: "vehicle"|"equipment"|"seller"|"broker", ownerId, ownerName, docs: [{docType, url, uploadedAt}] }`; envelope. `POST /v1/admin/kyc/{entityId}/verify` → sets `kycStatus: "verified"` (+ `verifiedAt`); `POST /v1/admin/kyc/{entityId}/reject` `{reason}` → `kycStatus: "rejected"`, `rejectionReason`; unknown id → 404 `KYC_ENTITY_NOT_FOUND`; 200 with the updated entity. (T1/S1/B1/E1 onboarding flows set `kycStatus: "pending"` when docs are uploaded.)
  2. **A3 scheme rules editor:** the Day 14 content CMS already covers `schemes`; add `eligibilityRules` (JSON object) to the accepted scheme fields — validate it's a dict (422 `INVALID_RULES_JSON` otherwise); unknown keys pass through (the Day 10 eligibility service ignores them by design). No new route — document the field in the CMS handler.
  3. **A4 broadcast:** `POST /v1/admin/broadcast` body `{ segment: { role: str | None, district: str | None }, title: str, body: str, deepLink: str | None = None, dryRun: bool = False }` (at least one segment key → 422 `SEGMENT_REQUIRED`); resolve the audience by scanning `users` where `linkedProfiles` contains role and/or `district` matches; `dryRun: true` → 200 `{ "targetedCount": n }` without sending; otherwise fan out `fcm.send_to_user` per user (reuse Day 13; skip users with no devices) with `data: {"type": "broadcast", "deepLink": deepLink}` → 200 `{ "targetedCount": n, "sent": m }`.
  4. **A5 settlements console:** `GET /v1/admin/settlements?status=` → all settlements filtered by status; envelope. `POST /v1/admin/settlements/{id}/mark-paid`: pending → approved → paid are the legal steps (`pending → approved` via the same endpoint with `{ "action": "approve" }` — body `{ action: Literal["approve", "mark_paid"] }`); illegal step → 409 `ILLEGAL_STATUS_TRANSITION`; mark-paid sets `paidAt`; 200 with the row.
  5. **A6 moderation queue:** `GET /v1/admin/reports?status=` → `reports` docs (from Day 14 Task A5); `POST /v1/admin/reports/{id}/resolve` `{ action: Literal["dismiss", "block"], note: str = "" }` — `block` also sets the reported user's status blocked via the Day 14 user-status logic; sets report `status: "resolved"`, `resolution`; 200. Unknown id → 404 `REPORT_NOT_FOUND`.
  6. Tests appended to `backend/tests/test_admin.py`:
     - `test_kyc_queue_and_verify`: seed a pending vehicle → listed; verify → `kycStatus == "verified"`; reject path stores the reason.
     - `test_scheme_rules_field`: PUT scheme with `eligibilityRules` object → 200; non-object → 422.
     - `test_broadcast_dry_run`: segment `{role: "farmer"}` dry-run → `targetedCount` matches seeded farmers; no FCM call (spy).
     - `test_broadcast_requires_segment`: `{}` segment → 422 `SEGMENT_REQUIRED`.
     - `test_settlement_mark_paid_flow`: pending → approve → mark_paid → `status == "paid"` with `paidAt`; pending → mark_paid directly → 409.
     - `test_report_resolve_block`: resolve with `block` → report resolved and user status blocked.
- **Test:** `cd backend && .venv/bin/pytest tests/test_admin.py -v`
- **Expected output:** `16 passed` (10 existing + 6 new).

### Task B5 — Cold-storage booking dialog + My Bookings entry (F11)

- **Goal:** Book a cold-storage slot from `post_harvest_view`; booking appears in My Bookings. Spec: docs/overview/03 Part D item F11. API dependency: Day 14 Task A7.
- **Depends on:** Day 14 Task B1 (`post_harvest_view.dart`), Day 11 Task B2 (`my_bookings_view.dart`); Day 14 Task A7.
- **Files to create/modify:**
  - `apps/mobile/lib/views/post_harvest_view.dart` (modify — book button + dialog)
  - `apps/mobile/lib/api/post_harvest_api.dart` (modify — `bookColdStorage(id, quantityQuintals, fromDate, months)`)
  - `apps/mobile/lib/views/my_bookings_view.dart` (modify — 4th tab `कोल्ड स्टोरेज`)
  - `apps/mobile/lib/models/booking.dart` (modify — coldStorage fields)
  - `apps/mobile/test/my_bookings_view_test.dart` (modify — append 1 test)
  - `apps/mobile/test/remaining_views_test.dart` (modify — append 1 test)
- **Subtasks:**
  1. Cold-storage cards get `बुक करें` → dialog (quantity in quintals, from-date picker, months stepper 1–12, computed `कुल ₹ = quantityQuintals × months × ratePerQuintalMonth` shown client-side) → `bookColdStorage` → 201 SnackBar `स्टोरेज बुक हुआ`; on `INSUFFICIENT_CAPACITY` → `इतनी क्षमता उपलब्ध नहीं`; card's available figure refreshes.
  2. `my_bookings_view.dart`: add tab `कोल्ड स्टोरेज` fed by the aggregate's new `coldStorage` key; card: facilityName, `{quantityQuintals} क्विंटल`, `fromDate`, `{months} महीने`, status chip `बुक्ड`; empty state `कोई स्टोरेज बुकिंग नहीं`. The Day 11 tab test expectations stay valid (tab count assertion updated to 4).
  3. Tests: `testWidgets('cold storage tab renders booking', ...)` — fake aggregate with 1 coldStorage item → expect facility name + `क्विंटल`. `testWidgets('book dialog posts', ...)` — in `remaining_views_test.dart`: submit dialog → fake recorded the call.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/my_bookings_view_test.dart test/remaining_views_test.dart`
- **Expected output:** `No issues found!`; 2 new tests pass; manual: book 20 q → My Bookings कोल्ड स्टोरेज tab shows it.

### Task B6 — Static legal pages on the web build (X18)

- **Goal:** `/legal/privacy`, `/legal/terms`, `/legal/refunds`, `/legal/community` routes on the Flutter web build rendering bundled markdown — required for the Play Store listing URLs. Spec: docs/overview/03 Part D item X18.
- **Depends on:** Day 14 Task B2 (web build).
- **Files to create/modify:**
  - `apps/mobile/assets/legal/privacy.md`, `terms.md`, `refunds.md`, `community.md` (new — draft Hindi+English content; final legal review before production)
  - `apps/mobile/pubspec.yaml` (modify — asset entry `assets/legal/`; add `flutter_markdown: ^0.7.4` if not already present — check pubspec first)
  - `apps/mobile/lib/views/legal_page_view.dart` (new)
  - `apps/mobile/lib/main.dart` (modify — web URL routes for the 4 paths only; app stays state-machine routed otherwise)
  - `apps/mobile/lib/views/account/settings_view.dart` (modify — footer links)
- **Subtasks:**
  1. Since the app is a state-machine router (Day 14 Task B2 note), add a narrow exception: on `kIsWeb`, read `Uri.base.path` at startup; when it matches `/legal/(privacy|terms|refunds|community)` render `LegalPageView(page:)` standalone (no login gate); all other paths behave as today. Document the exception in `apps/mobile/README.md` next to the Day 14 note.
  2. `legal_page_view.dart`: loads `assets/legal/<page>.md` via `rootBundle`, renders with `MarkdownBody` (or a minimal `Text` renderer if `flutter_markdown` isn't acceptable); app bar with the page title.
  3. Content drafts: privacy (data collected/purpose/third parties Firebase/Razorpay/OpenRouter/Sarvam/retention/deletion/contact — mirror playstore-deploy.md §9), terms, refunds (Razorpay refund policy — orders cancelled pre-dispatch refunded to source in 5–7 days), community guidelines (UGC rules: no abuse, rate limits, report/block exists). Mark each draft `DRAFT — legal review pending` in a comment at the top of the md file (not rendered).
  4. Settings footer + help & support get link tiles `गोपनीयता नीति`, `नियम व शर्तें`, `रिफंड नीति`, `समुदाय दिशानिर्देश` → on web open the URL, on mobile push `LegalPageView` in-app.
  5. `flutter build web --release` → verify the 4 URLs serve (Day 15 Task B5 verifies on the hosting domain).
- **Test:** `cd apps/mobile && flutter analyze` → 0 issues; `flutter build web` exits 0; local `flutter run -d chrome` → open `/legal/privacy` → the markdown renders without login.
- **Expected output:** 4 legal URLs render on web; in-app links work on Android too.

### Task B7 — Admin console: KYC queue, broadcast composer, settlements, moderation (A1/A4/A5/A6)

- **Goal:** 4 new admin views wired to the Day 14 Task A9 endpoints. Specs: docs/overview/03 Part D items A1, A4, A5, A6.
- **Depends on:** Day 14 Task B3 (`apps/admin` shell); Day 14 Task A9.
- **Files to create/modify (all in `apps/admin`):**
  - `lib/api/admin_api.dart` (modify — `listKycPending`, `verifyKyc`, `rejectKyc`, `broadcast`, `listSettlements`, `settleAction`, `listReports`, `resolveReport`)
  - `lib/views/kyc_queue_view.dart` (new)
  - `lib/views/broadcast_view.dart` (new)
  - `lib/views/settlements_view.dart` (new)
  - `lib/views/reports_view.dart` (new)
  - `lib/main.dart` (modify — 4 new NavigationRail destinations: `KYC कतार`, `प्रसारण`, `निपटान`, `रिपोर्ट`)
  - `test/admin_ops_test.dart` (new)
- **Subtasks:**
  1. `kyc_queue_view.dart`: `DataTable` (प्रकार, मालिक, दस्तावेज़, क्रिया); doc viewer — tap a doc url → dialog with `Image.network` / open-in-new-tab (`url_launcher` web); `सत्यापित करें` green → verify → row removed; `अस्वीकारें` red → reason dialog → reject. Empty state `कोई लंबित KYC नहीं`.
  2. `broadcast_view.dart`: composer — segment dropdowns (प्रोफ़ाइल role: any/farmer/…/broker; जिला free-text), title, body, optional deepLink; `गिनती देखें` → `broadcast(..., dryRun: true)` → shows `लक्षित: n`; `भेजें` → confirm dialog with the count → real call → result `sent m / n`.
  3. `settlements_view.dart`: status filter chips (लंबित/स्वीकृत/भुगतान हुआ) + `DataTable` (भूमिका, अवधि, सकल, कमीशन, शुद्ध, स्थिति, क्रिया); action per status: pending → `स्वीकृत करें`, approved → `भुगतान चिह्नित करें`; 409 → `अमान्य स्थिति परिवर्तन`.
  4. `reports_view.dart`: `DataTable` (रिपोर्टर, रिपोर्टेड, कारण, समय, क्रिया); actions `खारिज करें` / `ब्लॉक करें` (confirm) → `resolveReport`.
  5. `test/admin_ops_test.dart`:
     - `testWidgets('kyc queue renders and verify removes row', ...)` — fake 1 pending → verify → table empty state.
     - `testWidgets('broadcast dry run shows count', ...)` — fake `targetedCount: 42` → expect `लक्षित: 42`.
     - `testWidgets('settlements mark paid flow', ...)` — approved row → `भुगतान चिह्नित करें` → fake recorded `settleAction`.
     - `testWidgets('reports block action', ...)` — `ब्लॉक करें` + confirm → fake recorded `resolveReport(id, "block")`.
- **Test:** `cd apps/admin && flutter analyze && flutter test` → 0 issues; 4 new tests pass.
- **Expected output:** All 4 consoles work against the dev backend; broadcast dry-run count matches a hand count.

### Task B8 — STRETCH: persona-to-persona chat (X2)

> **Stretch — may slip to v1.x.** Ship only if the rest of Day 14 is green by mid-day; Play Store UGC policy then also requires X9 (Day 14 Task A5 — already done) and the community-guidelines page (Task B6).

- **Goal:** Minimal 1:1 chat between personas: chat list + thread screen backed by Firestore listeners (`chats`, `messages` sub-collection per Spec: docs/overview/03 Part D item X2); entry points from deal/broker cards and transporter bookings.
- **Depends on:** Day 14 Task A5 (block checks — the client must not offer chat to/from blocked users; server rejects via `USER_BLOCKED`); Task B6 (community guidelines live).
- **Files to create/modify:**
  - `apps/mobile/pubspec.yaml` (modify — add `cloud_firestore` — the ONLY approved direct-Firestore exception; Day 15 rules task must scope allow rules for `chats` instead of deny-all, and the Day 15 grep check must whitelist this)
  - `apps/mobile/lib/views/chat_list_view.dart` (new)
  - `apps/mobile/lib/views/chat_thread_view.dart` (new)
  - `apps/mobile/lib/services/chat_service.dart` (new — Firestore listeners; blocked filter via `GET /v1/users/me/blocks`)
  - `apps/mobile/lib/state/profile_routes.dart` (modify — routes `chatList`, `chatThread`)
  - broker deal cards + transporter booking detail (modify — `चैट करें` entry)
  - `apps/mobile/test/chat_views_test.dart` (new)
- **Subtasks:**
  1. `chat_service.dart`: `chats/{chatId}` where `chatId = sorted(uidA, uidB).join("_")`, fields `{ participants: [uidA, uidB], participantNames: {...}, lastMessage, lastMessageAt }`; messages in `chats/{chatId}/messages/{id}` `{ senderId, text, sentAt }`. Listens via `snapshot()` streams; before opening a thread, fetch the block list and refuse with `चैट उपलब्ध नहीं` when blocked.
  2. `chat_list_view.dart`: streams chats where `participants` contains me, ordered by `lastMessageAt`; app bar `चैट`.
  3. `chat_thread_view.dart`: bubble list from the stream + input row; report/block overflow menu → `POST /v1/users/{id}/report` / blocks endpoints (Day 14 Task A5).
  4. Entries: broker deal card + transporter booking detail get `चैट करें` → open/create the chat doc then push the thread.
  5. Widget tests with a fake chat service: list renders 2 chats; thread sends a message (fake recorded).
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/chat_views_test.dart` → 2 tests pass; manual on emulator: farmer ↔ broker exchange messages in real time.
- **Expected output:** If shipped — real-time 1:1 chat with block/report wired; if slipped — record the slip in the Day 15 E2E notes and keep Play UGC answers as "no direct messaging".

### Done-when additions (additional tasks)

- [ ] `cd backend && .venv/bin/pytest tests/test_blocks.py tests/test_sync.py tests/test_cold_storage.py tests/test_advisory.py tests/test_admin.py -v` → 8 + 7 + 5 + 8 + 16 = 44 passed; full suite green.
- [ ] Block is bidirectional in effect; channel chat filters blocked authors; self-report → 400.
- [ ] Sync strips server-owned fields on replay (tests prove `agriCoinsEarned`/`status` ignored); conflict matrix table added to the sync spec.
- [ ] Cold-storage capacity decrements (20 q on 50 MT → 48.0 available); booking visible in `/v1/users/me/bookings` under `coldStorage`.
- [ ] Sowing intent: consent off → 403 `CONSENT_REQUIRED`; on → `crop_cycles` doc with `isIntent: true` feeding saturation counts.
- [ ] Admin: KYC verify/reject, broadcast dry-run count + segment validation, settlement approve→paid chain, report resolve→block all green in pytest.
- [ ] `flutter analyze` 0 issues in both apps; new widget tests pass (mobile 4, admin 4, +2 if X2 ships).
- [ ] Legal pages: all 4 URLs render on the local web build; in-app settings links work.
- [ ] Manual: cold-storage booking → My Bookings tab; admin broadcast dry-run count matches; KYC verify makes a vehicle bookable.
