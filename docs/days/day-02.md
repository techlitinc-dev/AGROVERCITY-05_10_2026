# Day 2 — Auth backend + onboarding UI

**Dev A (Backend) goal:** Firebase-ID-token verification produces a backend JWT pair, and MPIN set/verify/reset work with bcrypt hashing and mocked-Firebase pytest coverage.
**Dev B (Flutter) goal:** Onboarding screens (splash, language select, profile select) ported and rendering statically with widget tests — no API calls yet — plus the app-config splash gate (force-update dialog) with widget coverage.

## Dev A — Backend tasks

### Task A1 — POST /v1/auth/firebase-verify + JWT issue/refresh

- **Goal:** Client sends a Firebase ID token (from phone OTP auth); backend verifies it with firebase-admin, upserts the `users/{uid}` Firestore doc, and returns a backend access JWT + refresh token.
- **Depends on:** Day 1 Task A2
- **Files to create/modify:**
  - `backend/app/models/auth.py` (new — Pydantic models)
  - `backend/app/services/tokens.py` (new — JWT helpers)
  - `backend/app/services/users.py` (new — user upsert)
  - `backend/app/routers/auth.py` (new)
  - `backend/app/main.py` (modify — include auth router)
  - `backend/tests/test_auth.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/auth.py`:
     - `class FirebaseVerifyRequest(BaseModel)`: `idToken: str`
     - `class TokenPair(BaseModel)`: `accessToken: str`, `refreshToken: str`, `tokenType: str = "bearer"`
     - `class AuthResponse(BaseModel)`: `accessToken: str`, `refreshToken: str`, `isNewUser: bool`, `user: dict`
     - `class RefreshRequest(BaseModel)`: `refreshToken: str`
  2. Write `backend/app/services/tokens.py`:
     - `def create_access_token(user_id: str) -> str`: `jose.jwt.encode({"sub": user_id, "type": "access", "exp": now + settings.jwt_access_ttl_minutes}, settings.jwt_secret, algorithm=settings.jwt_algorithm)`.
     - `def create_refresh_token(user_id: str) -> str`: same with `"type": "refresh"` and `settings.jwt_refresh_ttl_days`.
     - `def decode_token(token: str, expected_type: str) -> str`: decode, raise `HTTPException(401, "INVALID_TOKEN")` on `JWTError` or wrong `type`; return `sub`.
     - Error envelope rule (applies to ALL endpoints from here on): raise `HTTPException(status_code=..., detail={"code": "STRING_CODE", "message": "...", "fieldErrors": {}})`. Add an exception handler in `app/main.py` that rewrites `detail` dicts into the envelope shape `{ "error": detail }`.
  3. Write `backend/app/services/users.py`:
     - `async def upsert_user_from_firebase(uid: str, phone: str) -> tuple[dict, bool]`: `get_doc("users", uid)`; if missing, create `{ "id": uid, "phone": phone, "name": "", "vernacularName": "", "village": "", "tehsil": "", "district": "", "state": "", "landAreaAcres": 0, "soilType": "", "irrigationType": "", "kisanCreditScore": 0, "creditTier": "", "krishiRatnaLevel": 1, "krishiRatnaTitle": "Krishi Shishya", "streakDays": 0, "agriCoins": 0, "bankName": "", "kccLimit": 0, "activeCrops": [], "farmBoundaryPoints": [], "linkedProfiles": ["farmer"], "primaryProfile": "farmer", "activeProfile": "farmer", "mpinHash": None, "createdAt": <utc iso> }` via `set_doc`; return `(user_dict, is_new)`.
  4. Write `backend/app/routers/auth.py` with `router = APIRouter(prefix="/auth", tags=["auth"])`:
     - `POST /firebase-verify`: call `firebase_admin.auth.verify_id_token(body.idToken)`; extract `uid` and `phone_number` from decoded token (normalize phone to `+91...` — if it doesn't start with `+`, prefix `+91`); call `upsert_user_from_firebase`; return `AuthResponse`. On `auth.InvalidIdTokenError` → 401 `INVALID_FIREBASE_TOKEN`.
     - `POST /refresh`: body `RefreshRequest`; `decode_token(body.refreshToken, "refresh")` → new `TokenPair`.
  5. In `app/main.py`: `from app.routers import auth` and `app.include_router(auth.router, prefix="/v1")`. Add the error-envelope exception handler from step 2.
  6. Write `backend/tests/test_auth.py`:
     - Fixture: `monkeypatch` `firebase_admin.auth.verify_id_token` to return `{"uid": "uid-1", "phone_number": "+919812345678"}`.
     - Monkeypatch `app.services.users.upsert_user_from_firebase` to use an in-memory dict instead of Firestore (or patch `app.core.db.get_doc/set_doc` — pick one and use consistently).
     - `test_firebase_verify_new_user`: POST `/v1/auth/firebase-verify` `{"idToken": "x"}` → 200, `isNewUser == True`, both tokens non-empty.
     - `test_firebase_verify_invalid_token`: patch `verify_id_token` to raise `firebase_admin.auth.InvalidIdTokenError("bad")` → 401, body `{"error": {"code": "INVALID_FIREBASE_TOKEN", ...}}`.
     - `test_refresh_roundtrip`: verify → refresh with returned refreshToken → 200 with new tokens.
     - `test_refresh_with_access_token_fails`: pass the access token to `/refresh` → 401.
- **Test:** `cd backend && .venv/bin/pytest tests/test_auth.py -v`
- **Expected output:** `4 passed`.

### Task A2 — MPIN set / verify / reset

- **Goal:** 4-digit MPIN as second factor, bcrypt-hashed in the user doc; reset requires a fresh Firebase ID token.
- **Depends on:** Day 2 Task A1
- **Files to create/modify:**
  - `backend/app/models/auth.py` (modify)
  - `backend/app/core/security.py` (new)
  - `backend/app/routers/auth.py` (modify)
  - `backend/app/core/deps.py` (new — auth dependency)
  - `backend/tests/test_mpin.py` (new)
- **Subtasks:**
  1. Write `backend/app/core/security.py`:
     - `from passlib.context import CryptContext; pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")`
     - `def hash_mpin(mpin: str) -> str`, `def verify_mpin(mpin: str, hashed: str) -> bool`.
     - `def validate_mpin_format(mpin: str)`: must be exactly 4 ASCII digits, else raise 422 `INVALID_MPIN_FORMAT`.
  2. Write `backend/app/core/deps.py`:
     - `async def current_user_id(authorization: str = Header(...)) -> str`: parse `Bearer <token>`, `decode_token(token, "access")`, return user id. Missing/malformed header → 401 `MISSING_TOKEN`.
  3. Add models in `backend/app/models/auth.py`:
     - `class MpinSetRequest(BaseModel)`: `mpin: str`
     - `class MpinVerifyRequest(BaseModel)`: `mpin: str`
     - `class MpinResetRequest(BaseModel)`: `idToken: str`, `newMpin: str`
  4. Add endpoints in `backend/app/routers/auth.py`:
     - `POST /mpin/set` (auth required via `Depends(current_user_id)`): validate format, store `mpinHash = hash_mpin(mpin)` in `users/{uid}`; return `{"ok": True}`.
     - `POST /mpin/verify` (auth required): load user; if `mpinHash` is None → 409 `MPIN_NOT_SET`; if `verify_mpin` fails → 401 `WRONG_MPIN`; else `{"ok": True}`.
     - `POST /mpin/reset` (public but requires fresh Firebase token): `verify_id_token(body.idToken)`, find user by `uid`, set new hash, return `{"ok": True}`.
  5. Write `backend/tests/test_mpin.py` (reuse the mocked verify/upsert fixtures pattern from `test_auth.py`):
     - `test_set_and_verify_mpin`: verify → set `1234` → verify `1234` → `{"ok": True}`.
     - `test_verify_wrong_mpin`: verify `9999` → 401 `WRONG_MPIN`.
     - `test_verify_before_set`: → 409 `MPIN_NOT_SET`.
     - `test_set_bad_format`: `"12ab"` → 422 `INVALID_MPIN_FORMAT`.
     - `test_reset_with_firebase_token`: reset to `4321` → old mpin fails, new mpin verifies.
- **Test:** `cd backend && .venv/bin/pytest tests/test_mpin.py -v && .venv/bin/pytest -v`
- **Expected output:** `5 passed` for test_mpin; whole suite (auth + infra + mpin) green.

## Dev B — Flutter tasks

### Task B1 — Port onboarding screens (static)

- **Goal:** Splash (2-phase), language select, and profile select render in `apps/mobile` exactly as in the prototype.
- **Depends on:** Day 1 Task B2
- **Files to create/modify:**
  - `apps/mobile/lib/views/onboarding/splash_screen.dart` (already ported Day 1 — verify)
  - `apps/mobile/lib/views/onboarding/language_select_view.dart` (already ported — verify)
  - `apps/mobile/lib/views/onboarding/profile_select_view.dart` (already ported — verify)
  - `apps/mobile/lib/state/app_state.dart` (modify only if compile errors from Day 1 remain)
- **Subtasks:**
  1. Confirm the three files above compile under the new package name (Day 1 sed already fixed imports). If any still import `package:kisan_setu_app`, fix.
  2. Ensure the splash 2-phase behaviour is intact: phase 1 DDS logo ~750 ms elastic pop with tap-to-skip, phase 2 AGROVERCITY gradient title + "Get Started" CTA, auto-advance ~1.8 s. Assets `assets/dds logo.jpg.jpg` and `assets/crop agro logo.PNG` must resolve (they were copied Day 1).
  3. Language select: verify the language grid renders grouped by Indian region, each row has an audio-preview button (stub is fine — keep prototype's local behaviour), and "Detected Location: Nashik, Maharashtra" suggestion banner still shows as static text (real reverse-geocoding lands Day 4).
  4. Profile select: 2-column grid of the 6 persona cards (farmer किसान, farmLandlord खेत मालिक, transport परिवहन, seller व्यापारी, equipmentRental यंत्र किराया, broker दलाल); multi-select with one starred primary; Continue button disabled until ≥1 selected; staggered fade-in retained.
  5. Remove the quick demo-login buttons from `auth_view.dart` ONLY if they appear on these three screens (they're in auth — leave for Day 3).
- **Test:** `cd apps/mobile && flutter analyze && flutter run -d chrome --web-port 5000` and click through splash → language → profile select.
- **Expected output:** `No issues found!`; manually: language screen shows the regional grid; profile screen shows 6 cards, Continue disabled until a selection is made.

### Task B2 — Widget tests for onboarding

- **Goal:** Automated proof the onboarding screens render and enforce selection rules.
- **Depends on:** Day 2 Task B1
- **Files to create/modify:**
  - `apps/mobile/test/onboarding_language_test.dart` (new)
  - `apps/mobile/test/onboarding_profile_select_test.dart` (new)
  - `apps/mobile/test/helpers.dart` (new — shared pump helper)
- **Subtasks:**
  1. Write `apps/mobile/test/helpers.dart`: `Future<void> pumpScreen(WidgetTester tester, Widget screen)` that wraps the widget in `MaterialApp(home: ...)` inside a `SizedBox` of 800×1200 (`tester.view.physicalSize = ...`) and pumps. If the prototype screens depend on `AppState` (e.g. via Provider or an inherited widget), wrap with the same provider the prototype's `main.dart` uses — copy that wrapper here.
  2. `onboarding_language_test.dart`:
     - `testWidgets('language grid renders with regional groups', ...)` — expect `find.text('Hindi')` (or the Hindi label used in the prototype grid) and at least one region header such as `find.textContaining('West')`.
     - `testWidgets('audio preview button exists per language', ...)` — expect `find.byIcon(Icons.volume_up)` finds at least 3 widgets (or the icon the prototype uses).
  3. `onboarding_profile_select_test.dart`:
     - `testWidgets('six persona cards render', ...)` — expect 6 cards; assert `find.text('किसान')` and `find.text('व्यापारी')`.
     - `testWidgets('continue disabled until selection', ...)` — find the Continue button widget, assert `onPressed == null` initially; tap the farmer card, `pump()`, assert `onPressed != null`.
     - `testWidgets('star marks primary profile', ...)` — after selecting two cards, tap the star on the second; assert the star icon changes to the filled variant used by the prototype.
  4. If screens read from `AppState` demo data for persona metadata, that is fine for today (API wiring is Day 3–4).
- **Test:** `cd apps/mobile && flutter test test/onboarding_language_test.dart test/onboarding_profile_select_test.dart`
- **Expected output:** All tests pass (`+5` or however many cases, 0 failures).

## Additional tasks (from missing.md)

### Task B3 — Splash gate: app-config check + force-update dialog

- **Goal:** On every cold start the app asks the backend whether this build may run; a forced update blocks onboarding. Spec: `docs/overview/03 … Part C/D item X12`.
- **Depends on:** Day 2 Task B1. API dependency: Day 1 Task A3 (`GET /v1/app-config`).
- **Files to create/modify:**
  - `apps/mobile/lib/api/app_config_api.dart` (new)
  - `apps/mobile/lib/core/constants.dart` (modify — add `kAppVersion`)
  - `apps/mobile/lib/components/common/force_update_dialog.dart` (new)
  - `apps/mobile/lib/views/onboarding/splash_screen.dart` (modify — gate before advancing)
  - `apps/mobile/test/splash_gate_test.dart` (new)
- **Subtasks:**
  1. Add `const String kAppVersion = "1.0.0";` to `apps/mobile/lib/core/constants.dart` (hardcoded until `package_info_plus` is adopted — one-line comment).
  2. `apps/mobile/lib/api/app_config_api.dart`: `Future<Map<String, dynamic>> getAppConfig()` → GET `/app-config?version=$kAppVersion&platform=<android|web>` via the plain Dio instance (public endpoint — must work before auth, so do NOT require the auth interceptor).
  3. `apps/mobile/lib/components/common/force_update_dialog.dart`: non-dismissible dialog (`barrierDismissible: false`, no close affordance) — title `अपडेट आवश्यक`, body `ऐप का नया संस्करण उपलब्ध है — कृपया अपडेट करें`, single button `अपडेट करें` → `url_launcher` opens `https://play.google.com/store/apps/details?id=com.agrovercity.kisansetu` (`launchUrl(..., mode: LaunchMode.externalApplication)`). A second factory `ForceUpdateDialog.maintenance()` shows `ऐप रखरखाव में है — थोड़ी देर बाद प्रयास करें` with a Retry button instead.
  4. In `splash_screen.dart`: after the phase-2 timer completes but BEFORE advancing to language select, call `getAppConfig()`:
     - `forceUpdate == true` → `showDialog(ForceUpdateDialog())`; do not advance.
     - `maintenanceMode == true` → `showDialog(ForceUpdateDialog.maintenance())`; Retry re-calls the gate.
     - Otherwise (or on any exception/timeout) → fail open: log and advance to language select. The app must never be bricked by a down backend.
  5. `apps/mobile/test/splash_gate_test.dart` (inject a fake `AppConfigApi`, pump splash, advance timers with `tester.pump(Duration(seconds: 3))`):
     - `testWidgets('forceUpdate true shows blocking dialog and blocks navigation', ...)` — fake returns `{minSupportedVersion: '1.0.0', forceUpdate: true, featureFlags: {}, maintenanceMode: false}` → expect `अपडेट आवश्यक` and the `अपडेट करें` button; language select NOT rendered.
     - `testWidgets('forceUpdate false advances to language select', ...)`.
     - `testWidgets('api error fails open', ...)` — fake throws `ApiException(code: 'NETWORK_ERROR')` → language select still reached.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/splash_gate_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass. Manual with dev backend: set `forceUpdate: true` in `app_config/current` (or pass a lower `kAppVersion`) → splash stops at the blocking dialog with the Play Store link.

## Done-when checklist (end of day)

- [ ] `POST /v1/auth/firebase-verify` returns `accessToken`, `refreshToken`, `isNewUser`, `user` (mocked Firebase in tests; real Firebase if service-account JSON present).
- [ ] MPIN set/verify/reset endpoints behave per spec: 401 `WRONG_MPIN`, 409 `MPIN_NOT_SET`, 422 `INVALID_MPIN_FORMAT`.
- [ ] `cd backend && .venv/bin/pytest -v` → ≥11 passed total.
- [ ] Error envelope `{ "error": { "code", "message", "fieldErrors" } }` returned for auth failures.
- [ ] Onboarding screens render in `apps/mobile` with `flutter analyze` at 0 issues.
- [ ] `flutter test test/onboarding_language_test.dart test/onboarding_profile_select_test.dart` → all pass.
- [ ] Profile-select Continue button is disabled until ≥1 persona is selected (manual + widget test).
- [ ] Splash gate: mocked 200 with `forceUpdate: true` shows the blocking dialog with Play Store link; `false` and network-error paths advance normally (`test/splash_gate_test.dart` 3 passed) (X12).
