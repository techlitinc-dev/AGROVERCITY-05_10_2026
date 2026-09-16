# Day 3 — Profile API + auth UI wiring

**Dev A (Backend) goal:** Registration, profile read/update, farm boundary save, and multi-profile link/unlink/activate/primary endpoints work with role rules enforced — plus referral-code attribution on register and per-persona role profiles.
**Dev B (Flutter) goal:** Dio API client with interceptors exists; Firebase phone OTP, MPIN login, register wizard, and farm map screens are wired to the backend — plus referral-code field, role-keyed register step 3, profile edit screen, and 401→MPIN session restore.

## Dev A — Backend tasks

### Task A1 — POST /v1/auth/register + GET/PUT /v1/users/me + farm boundary

- **Goal:** Complete the registration wizard server-side and expose the full `FarmerProfile`.
- **Depends on:** Day 2 Task A2
- **Files to create/modify:**
  - `backend/app/models/user.py` (new)
  - `backend/app/routers/users.py` (new)
  - `backend/app/routers/auth.py` (modify — add `/register`)
  - `backend/app/main.py` (modify — include users router)
  - `backend/tests/test_users.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/user.py` with Pydantic models using EXACT field names:
     - `class FarmBoundaryPoint(BaseModel)`: `lat: float`, `lng: float`
     - `class RegisterRequest(BaseModel)`: `name: str`, `phone: str`, `state: str`, `district: str`, `tehsil: str`, `village: str`, `landAreaAcres: float`, `soilType: str`, `irrigationType: str`, `crops: list[str]`, `mpin: str`, `profiles: list[str]`, `primaryProfile: str`
     - `class UserUpdateRequest(BaseModel)`: all-optional — `name`, `vernacularName`, `village`, `tehsil`, `district`, `state`, `landAreaAcres`, `soilType`, `irrigationType`, `activeCrops` (`list[str]`), `bankName`, `kccLimit`
     - `class FarmBoundaryRequest(BaseModel)`: `farmBoundaryPoints: list[FarmBoundaryPoint]`, `landAreaAcres: float`, `khasraNumber: str | None = None`
  2. Profile type validation: define `VALID_PROFILES = {"farmer", "farmLandlord", "transport", "seller", "equipmentRental", "broker"}` in `backend/app/models/user.py`; any profile value outside this set → 422 `INVALID_PROFILE_TYPE`.
  3. `POST /auth/register` in `app/routers/auth.py` (public; body `RegisterRequest`):
     - Require that the user already exists via a preceding `/auth/firebase-verify` call — simplest concrete rule: accept `idToken` as an additional required field on `RegisterRequest` (add it: `idToken: str`), verify it, use its `uid`. (Keeps register unguessable without a verified phone.)
     - Validate: `len(mpin) == 4` digits; `profiles` non-empty; `primaryProfile in profiles`; phone matches the Firebase token's phone.
     - Update `users/{uid}` with all registration fields, `activeCrops = crops`, `linkedProfiles = profiles`, `primaryProfile = primaryProfile`, `activeProfile = primaryProfile`, `mpinHash = hash_mpin(mpin)`.
     - Return `AuthResponse` (new tokens + full user).
  4. Write `backend/app/routers/users.py` (`router = APIRouter(prefix="/users", tags=["users"])`):
     - `GET /me` (auth): return the full user doc; shape includes every `FarmerProfile` field from endpoints.md §2 plus `linkedProfiles`, `activeProfile`, `primaryProfile`.
     - `PUT /me` (auth): apply only non-None fields from `UserUpdateRequest`; return updated user.
     - `PUT /me/farm-boundary` (auth, role farmer): store `farmBoundaryPoints`, `landAreaAcres`, `khasraNumber`; return updated user. Role check helper: `def require_role(user, *roles)` → 403 `FORBIDDEN_ROLE` if `user["activeProfile"]` not in roles (farmer home routes use `activeProfile`; for this endpoint require `"farmer" in user["linkedProfiles"]`).
  5. In `app/main.py`: `app.include_router(users.router, prefix="/v1")`.
  6. Write `backend/tests/test_users.py` (reuse in-memory Firestore patch fixtures):
     - `test_register_creates_full_profile`: firebase-verify → register with 2 profiles (`["farmer", "seller"]`, primary `farmer`) → 200, `user["linkedProfiles"] == ["farmer", "seller"]`, `activeProfile == "farmer"`, `activeCrops` matches input.
     - `test_register_rejects_primary_not_in_profiles`: primary `broker` not in `profiles` → 422.
     - `test_get_me`: GET `/v1/users/me` with access token → 200, contains `kisanCreditScore` and `agriCoins` keys.
     - `test_put_me_partial_update`: PUT `{ "village": "Ozark" }` → village updated, other fields unchanged.
     - `test_farm_boundary`: PUT `/v1/users/me/farm-boundary` with 4 points `{lat, lng}` and `landAreaAcres: 5.5`, `khasraNumber: "123/4"` → stored; GET /me reflects it.
     - `test_me_requires_auth`: GET /me without header → 401.
- **Test:** `cd backend && .venv/bin/pytest tests/test_users.py -v`
- **Expected output:** `6 passed`.

### Task A2 — Profile link / unlink / activate / primary

- **Goal:** Multi-profile management with the minimum-1-linked rule.
- **Depends on:** Day 3 Task A1
- **Files to create/modify:**
  - `backend/app/models/user.py` (modify)
  - `backend/app/routers/users.py` (modify)
  - `backend/app/services/profile_routes.py` (new — server copy of the ACL)
  - `backend/tests/test_profiles.py` (new)
- **Subtasks:**
  1. Write `backend/app/services/profile_routes.py`: port the access matrix from `flutter-prototype/lib/state/profile_routes.dart` exactly — a dict `ACCESS_MAP: dict[str, set[str]]` keyed by the 6 profile types with route sets (`home`, `mandi`, `marketplace`, `buyers`, `advisory`, `profitLoss`, `water`, `schemes`, `finance`, `womenFarmer`, `fpo`, `equipment`, `landLegal`, `climate`, `postHarvest`, `treePlantation`, `liveChannels`, `agriNews`, `livestockDairy`, `farmDiary`, `referEarn`, `krishiRatna`, `gyanHub`, `cropInsurance`) plus `DEFAULT_HOME: dict[str, str]` (`farmer→home`, `farmLandlord→landlordHome`, `transport→transportHome`, `seller→sellerHome`, `equipmentRental→equipmentOwnerHome`, `broker→brokerHome`).
  2. Add model `class LinkProfileRequest(BaseModel)`: `profileType: str`.
  3. Endpoints in `app/routers/users.py`:
     - `POST /me/profiles`: body `LinkProfileRequest`; validate profileType; if already linked → 409 `PROFILE_ALREADY_LINKED`; append to `linkedProfiles`; return updated user.
     - `DELETE /me/profiles/{type}`: if `{type}` not linked → 404 `PROFILE_NOT_LINKED`; if it is the only linked profile → 409 `LAST_PROFILE` with message `"कम से कम एक प्रोफाइल आवश्यक है"`; remove it; if it was `activeProfile`, set `activeProfile` to `primaryProfile` (or first remaining); if it was `primaryProfile`, promote first remaining; return updated user.
     - `POST /me/profiles/{type}/activate`: if not linked → 404 `PROFILE_NOT_LINKED`; set `activeProfile`; return `{ "activeProfile": type, "defaultHomeRoute": DEFAULT_HOME[type], "user": <updated> }`.
     - `PUT /me/profiles/{type}/primary`: if not linked → 404; set `primaryProfile`; return updated user.
  4. Write `backend/tests/test_profiles.py`:
     - `test_link_profile`: link `transport` → appears in `linkedProfiles`.
     - `test_link_duplicate`: → 409 `PROFILE_ALREADY_LINKED`.
     - `test_unlink_last_profile_blocked`: user with 1 profile → DELETE → 409, body error code `LAST_PROFILE`, message contains `कम से कम एक प्रोफाइल`.
     - `test_activate_returns_default_home`: activate `transport` → `defaultHomeRoute == "transportHome"`.
     - `test_unlink_active_promotes_primary`: link seller, activate seller, unlink seller → activeProfile becomes primary.
     - `test_primary_star`: PUT primary on `seller` → `primaryProfile == "seller"`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_profiles.py -v && .venv/bin/pytest -v`
- **Expected output:** `6 passed` for profiles; full suite green.

## Dev B — Flutter tasks

### Task B1 — Dio API client with interceptors

- **Goal:** One typed HTTP layer every screen will use.
- **Depends on:** Day 1 Task B1 (folders exist). API dependency: Day 2 Task A1 (auth endpoints) — usable in tests with mocked adapter today.
- **Files to create/modify:**
  - `apps/mobile/lib/api/api_client.dart` (new)
  - `apps/mobile/lib/api/api_exception.dart` (new)
  - `apps/mobile/lib/core/session_store.dart` (new)
  - `apps/mobile/test/api_client_test.dart` (new)
- **Subtasks:**
  1. `apps/mobile/lib/core/session_store.dart`: class `SessionStore` using `shared_preferences`; methods `Future<void> saveTokens(String access, String refresh)`, `Future<String?> get accessToken`, `Future<String?> get refreshToken`, `Future<void> clear()`; keys `kAccessToken`, `kRefreshToken`.
  2. `apps/mobile/lib/api/api_exception.dart`: `class ApiException implements Exception { final String code; final String message; final Map<String, dynamic> fieldErrors; final int statusCode; }` with `factory ApiException.fromResponse(Response r)` parsing the `{ "error": {...} }` envelope.
  3. `apps/mobile/lib/api/api_client.dart`: `class ApiClient` wrapping `Dio`:
     - `baseUrl` from `const String.fromEnvironment('API_BASE_URL', defaultValue: kApiBaseUrl)`.
     - Interceptor 1 (auth): reads `SessionStore.accessToken`, adds `Authorization: Bearer ...` when present.
     - Interceptor 2 (headers): adds `Accept-Language` from `AppState.language` (`hi|mr|gu|pa|te|ta|en`); on POST/PUT/DELETE adds `Idempotency-Key: <uuid v4>` if not already set (use the `uuid` package — add `uuid: ^4.5.1` to pubspec and `flutter pub get`).
     - Interceptor 3 (errors): convert `DioException` with a response into `ApiException` via the envelope; network errors → `ApiException(code: 'NETWORK_ERROR', ...)`.
     - Expose `Future<Map<String, dynamic>> get/post/put/patch/delete(String path, {Map<String,dynamic>? query, dynamic body})` returning `response.data`.
  4. `apps/mobile/test/api_client_test.dart` with `dio`'s `DioAdapter`/`http_client_adapter` mock (use `dio`'s `MockAdapter`-style approach: inject a fake `HttpClientAdapter`):
     - `test('adds Authorization header when token saved', ...)` — pre-populate SharedPreferences via `SharedPreferences.setMockInitialValues({'kAccessToken': 'tok'})`; capture request headers; assert `Authorization == 'Bearer tok'`.
     - `test('adds Idempotency-Key on POST but not GET', ...)`.
     - `test('error envelope maps to ApiException', ...)` — fake 409 response `{"error":{"code":"LAST_PROFILE","message":"...","fieldErrors":{}}}` → expect `ApiException` with `code == 'LAST_PROFILE'`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/api_client_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass.

### Task B2 — Phone OTP login, MPIN screens, register wizard, farm map

- **Goal:** Real auth flow from UI to backend.
- **Depends on:** Day 3 Task B1; API dependency: Day 2 Task A1/A2 (firebase-verify, mpin) and Day 3 Task A1 (register, farm-boundary).
- **Files to create/modify:**
  - `apps/mobile/lib/api/auth_api.dart` (new)
  - `apps/mobile/lib/api/user_api.dart` (new)
  - `apps/mobile/lib/views/onboarding/auth_view.dart` (modify — port then wire)
  - `apps/mobile/lib/views/onboarding/register_view.dart` (modify — wire)
  - `apps/mobile/lib/views/onboarding/farm_map_marker_view.dart` (modify — wire confirm action)
  - `apps/mobile/lib/state/app_state.dart` (modify — replace demo login methods)
  - `apps/mobile/firebase.json`, `apps/mobile/lib/firebase_options.dart` (generated)
- **Subtasks:**
  1. Configure Firebase: place `google-services.json` in `apps/mobile/android/app/`, run `flutterfire configure` (or hand-write `firebase_options.dart` for the dev project). Initialise in `main.dart`: `await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);` before `runApp`.
  2. `apps/mobile/lib/api/auth_api.dart`: methods `firebaseVerify(String idToken)` → POST `/auth/firebase-verify`; `loginMpin` is client-side: after Firebase sign-in, call `POST /auth/mpin/verify`; `mpinSet`, `mpinReset(idToken, newMpin)`; `register(RegisterRequest fields…)` → POST `/auth/register`. Each returns decoded maps; save tokens via `SessionStore` inside `firebaseVerify`/`register`.
  3. `apps/mobile/lib/api/user_api.dart`: `getMe()`, `updateMe(Map fields)`, `saveFarmBoundary(List<Map<String,double>> points, double landAreaAcres, String? khasraNumber)`, plus profile methods `linkProfile`, `unlinkProfile`, `activateProfile`, `setPrimaryProfile` (used Day 4).
  4. In `auth_view.dart` (already ported): implement phone OTP with `FirebaseAuth.instance.verifyPhoneNumber` — `codeSent` shows the OTP field with a 30 s resend countdown; `verificationCompleted` auto-fills; on OTP submit call `FirebaseAuth.instance.signInWithCredential`, take `user.getIdToken()`, call `authApi.firebaseVerify`. Remove the prototype's quick demo-login buttons. Keep the segmented Login ↔ Register switcher.
  5. MPIN login: after `firebaseVerify` succeeds and user doc has MPIN set (backend returns the user; treat `isNewUser == false` as "has account"), show the 4-digit MPIN pad; submit → `POST /auth/mpin/verify` → on 401 `WRONG_MPIN` show inline error `गलत MPIN`; on success navigate per `activeProfile`'s default home (hardcode the same map as `profile_routes.dart` client-side — it already exists in `lib/state/profile_routes.dart`).
  6. Forgot-MPIN bottom sheet: mobile → Firebase OTP (same verifyPhoneNumber flow) → new MPIN twice with live match indicator → `mpinReset(freshIdToken, newMpin)`.
  7. Register wizard (`register_view.dart`): keep the 3 steps from features.md §2.2 — (1) identity & contact: name, state dropdown (MH/MP/GJ/UP/Punjab/Rajasthan), mobile + OTP; (2) security: MPIN twice with live match; (3) farm details: village/tehsil, land-area slider 0.5–25 acres, soil chips (Black Cotton/Red/Sandy/Alluvial), irrigation chips (Drip/Sprinkler/Canal/Borewell/Rainfed), crop multi-select + custom adder. On finish: collect `profiles` + `primaryProfile` from the earlier profile-select step in `AppState`, call `authApi.register(...)`.
  8. Farm map (`farm_map_marker_view.dart`): keep the 4 draggable corner pins and polygon area calc; "Confirm farm" → `userApi.saveFarmBoundary(points, acres, khasra)` then advance state machine to dashboard.
  9. Update `app_state.dart`: delete `quickLoginDemo`, `loginWithPhone`, `loginWithMobileAndMpin` demo bodies; keep method names but delegate to the new API layer and store the returned user map in `AppState`.
- **Test:** `cd apps/mobile && flutter analyze`; manual checklist on Android emulator (Firebase phone auth requires Android or a test phone number configured in the Firebase console):
  1. Enter test phone → OTP autofill (Firebase test number) → lands on MPIN pad.
  2. Wrong MPIN → inline error `गलत MPIN`; correct MPIN → farmer dashboard.
  3. Register path: complete 3 steps → map screen → confirm → dashboard; `curl -s -H "Authorization: Bearer <token>" http://localhost:8000/v1/users/me` shows the registered village/crops.
- **Expected output:** `flutter analyze` → 0 issues; all three manual checks pass.

## Additional tasks (from missing.md)

### Task A3 — Referral code on register

- **Goal:** A new user can enter the inviter's code at registration; attribution is recorded so the +100-coin award can land on Day 13. Spec: `docs/overview/03 … Part C/D item F1`.
- **Depends on:** Day 3 Task A1
- **Files to create/modify:**
  - `backend/app/models/user.py` (modify)
  - `backend/app/services/users.py` (modify)
  - `backend/app/routers/auth.py` (modify)
  - `backend/tests/test_referral.py` (new)
- **Subtasks:**
  1. Every user doc gets a `referralCode: str` field — generate at upsert/register time as `"ref_" + uid[:8]`; in `app/services/users.py` backfill it when an existing doc without the field is read.
  2. Add optional field `referralCode: str | None = None` to `RegisterRequest` (`backend/app/models/user.py`).
  3. In `POST /auth/register` (`app/routers/auth.py`): when `referralCode` is present —
     - Query `users` where `referralCode == <code>`; no match → 400 `INVALID_REFERRAL_CODE`; match is the registering uid itself → 400 `INVALID_REFERRAL_CODE` (self-referral).
     - On success create `referral_attributions/{newUid}` = `{ "referrerUid": <uid>, "referredUid": <newUid>, "code": <code>, "status": "pending", "createdAt": <utc iso> }`. Do NOT award coins today — the award happens Day 13 (one-line comment saying so).
  4. Register response gains an additive field `referral: { "applied": bool }` (additive is safe per conventions §1).
  5. Write `backend/tests/test_referral.py`:
     - `test_register_with_valid_referral`: seed referrer user with a known `referralCode`; register → 200, `referral.applied == true`, `referral_attributions` doc written with `status: "pending"`.
     - `test_register_invalid_referral_code`: unknown code → 400, envelope code `INVALID_REFERRAL_CODE`.
     - `test_register_without_referral`: → 200, `referral.applied == false`, no attribution doc.
     - `test_register_self_referral`: code belonging to the same uid → 400.
- **Test:** `cd backend && .venv/bin/pytest tests/test_referral.py -v`
- **Expected output:** `4 passed`.

### Task A4 — Per-persona roleProfile on register (`role_profiles` sub-collection)

- **Goal:** Register captures role-specific details for non-farmer personas (transporter vehicle, seller shop, landlord land, broker markets). Spec: `docs/overview/03 … Part C/D item X1`.
- **Depends on:** Day 3 Task A3
- **Files to create/modify:**
  - `backend/app/models/role_profiles.py` (new)
  - `backend/app/models/user.py` (modify)
  - `backend/app/routers/auth.py` (modify)
  - `backend/app/routers/users.py` (modify)
  - `backend/tests/test_role_profiles.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/role_profiles.py` with the variant models (farmer has no variant — it uses the existing top-level register fields):
     - `class TransportRoleProfile(BaseModel)`: `vehicleType: str`, `rcNumber: str`
     - `class SellerRoleProfile(BaseModel)`: `shopName: str`, `gstNumber: str | None = None`, `apmcLicense: str | None = None`
     - `class FarmLandlordRoleProfile(BaseModel)`: `totalLandAcres: float`
     - `class BrokerRoleProfile(BaseModel)`: `marketsServed: list[str]`
     - `ROLE_PROFILE_MODELS: dict[str, type[BaseModel]]` mapping `transport/seller/farmLandlord/broker` → the above.
  2. `RegisterRequest` gains `roleProfiles: dict[str, dict] | None = None` — keys are profile types. Validation in register: every key must be in `profiles` and in `ROLE_PROFILE_MODELS`; parse each value into its variant model. Unknown key, key not in `profiles`, or failed variant parse → 422 `INVALID_ROLE_PROFILE` with `fieldErrors` keyed by profile type.
  3. On register, write each validated variant to `users/{uid}/role_profiles/{profileType}` = `{ **variant_fields, "createdAt": <utc iso> }`.
  4. `GET /users/me` response gains `roleProfiles: { <profileType>: {...} }` read back from the sub-collection (additive field; `{}` when none).
  5. Write `backend/tests/test_role_profiles.py` (one test per variant + error cases):
     - `test_register_transport_variant`: profiles `["farmer", "transport"]` + `roleProfiles.transport = {vehicleType: "Tata Ace", rcNumber: "MH15AB1234"}` → 200; GET /me `roleProfiles.transport.rcNumber` matches.
     - `test_register_seller_variant_optionals`: only `shopName` → 200 (gstNumber/apmcLicense absent).
     - `test_register_variant_missing_required`: transport without `rcNumber` → 422 `INVALID_ROLE_PROFILE`.
     - `test_register_roleprofile_not_in_profiles`: `roleProfiles` key `broker` while `profiles == ["farmer"]` → 422.
     - `test_register_landlord_and_broker_variants`: `totalLandAcres` float and `marketsServed` list stored and returned.
- **Test:** `cd backend && .venv/bin/pytest tests/test_role_profiles.py -v && .venv/bin/pytest -v`
- **Expected output:** `5 passed` for role profiles; full suite green.

### Task B3 — Referral-code field on register step 1

- **Goal:** The register wizard has a place to enter the inviter's code. Spec: `docs/overview/03 … Part C/D item F1`.
- **Depends on:** Day 3 Task B2. API dependency: Day 3 Task A3 (same day).
- **Files to create/modify:**
  - `apps/mobile/lib/views/onboarding/register_view.dart` (modify — step 1 field)
  - `apps/mobile/lib/api/auth_api.dart` (modify — `register` accepts `referralCode`)
  - `apps/mobile/test/register_referral_test.dart` (new)
- **Subtasks:**
  1. Step 1 (identity & contact) gains an optional text field labelled `रेफरल कोड (वैकल्पिक)`; trimmed empty value → omit from the request entirely.
  2. `auth_api.dart`: `register(...)` passes `referralCode` through when non-empty.
  3. On `ApiException(code: 'INVALID_REFERRAL_CODE')` → stay on step 1, inline field error `अमान्य रेफरल कोड`; all other steps' entered data preserved.
  4. `apps/mobile/test/register_referral_test.dart`:
     - `testWidgets('invalid referral code shows inline error and stays on step 1', ...)` — fake api throws 400 `INVALID_REFERRAL_CODE`; submit; expect `अमान्य रेफरल कोड`.
     - `testWidgets('valid referral code is passed to register', ...)` — enter `ref_ab12cd34`, complete submit; assert fake recorded `referralCode == 'ref_ab12cd34'`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/register_referral_test.dart`
- **Expected output:** `No issues found!`; 2 tests pass.

### Task B4 — Profile edit screen

- **Goal:** Users can fix name/village/crops/soil/land details after registration. Spec: `docs/overview/03 … Part C/D item F21`.
- **Depends on:** Day 3 Task B1. API dependency: Day 3 Task A1 (`PUT /v1/users/me` — already exists).
- **Files to create/modify:**
  - `apps/mobile/lib/views/common/profile_edit_view.dart` (new screen)
  - `apps/mobile/lib/api/user_api.dart` (modify — ensure `updateMe` covers all editable fields)
  - `apps/mobile/lib/views/common/settings_view.dart` (modify — entry row; if the settings screen is not ported yet, add the entry on the profile/account affordance that exists today and note it)
  - `apps/mobile/test/profile_edit_test.dart` (new)
- **Subtasks:**
  1. `profile_edit_view.dart`: form prefilled from `AppState.currentUser` — name, village, tehsil, crop multi-select chips (reuse the register step-3 crop selector incl. custom adder), soil chips, irrigation chips, land-area slider 0.5–25 acres.
  2. Save → `userApi.updateMe({...changed fields only})` → merge the returned user into `AppState.currentUser` → toast `प्रोफ़ाइल अपडेट हुई` → pop.
  3. Reachable from settings via a `प्रोफ़ाइल संपादित करें` row; register route `profileEdit` in `lib/state/profile_routes.dart` for all profiles.
  4. `apps/mobile/test/profile_edit_test.dart`:
     - `testWidgets('form prefilled from current user', ...)` — expect village name in its field.
     - `testWidgets('save sends only changed fields', ...)` — change village, save; assert fake `updateMe` recorded exactly `{village: ...}`; toast visible.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/profile_edit_test.dart`
- **Expected output:** `No issues found!`; 2 tests pass; manual: edit village → `GET /v1/users/me` reflects it.

### Task B5 — 401 → MPIN re-entry sheet → retry original request

- **Goal:** Session expiry never dumps the user to the login screen mid-task; one MPIN re-entry silently restores the session. Spec: `docs/overview/03 … Part C/D item F2`.
- **Depends on:** Day 3 Task B1 (api client + interceptors).
- **Files to create/modify:**
  - `apps/mobile/lib/api/api_client.dart` (modify — interceptor 4)
  - `apps/mobile/lib/components/auth/mpin_reentry_sheet.dart` (new)
  - `apps/mobile/test/mpin_reentry_test.dart` (new)
- **Subtasks:**
  1. Interceptor 4 (errors, after the envelope mapping): when a response is 401 on an authenticated request, do not reject immediately — open `MpinReentrySheet` (modal bottom sheet, not dismissible by drag; title `सत्र समाप्त — MPIN दर्ज करें`) reusing the 4-digit MPIN pad from MPIN login.
  2. On MPIN submit → `POST /auth/mpin/verify`; on success call `POST /auth/refresh` with the stored refresh token, save the new pair via `SessionStore`, then **retry the original request once** with the new token and resolve the caller with its result. Wrong MPIN → inline `गलत MPIN`, sheet stays open. Sheet dismissed/cancelled → reject the caller with the original `ApiException`.
  3. Concurrency guard: a single shared in-flight `Completer` so 3 simultaneous 401s open exactly one sheet and all retry after it succeeds.
  4. `apps/mobile/test/mpin_reentry_test.dart`:
     - `testWidgets('401 opens sheet, correct MPIN retries original request', ...)` — fake adapter: first call → 401, then mpin/verify + refresh ok, retried call → 200; assert caller receives the 200 body and sheet is gone.
     - `testWidgets('dismissing sheet propagates the original 401', ...)`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/mpin_reentry_test.dart`; manual on emulator: set `jwt_access_ttl_minutes: 1` in `backend/.env`, log in, wait ~70 s, tap any API-backed action → MPIN sheet appears → enter MPIN → action completes without re-login.
- **Expected output:** `No issues found!`; 2 tests pass; manual session-restore path verified end to end.

### Task B6 — Register wizard step 3: role-keyed variant form

- **Goal:** Step 3 asks transporter/seller/landlord/broker personas for THEIR details instead of farmer-only farm fields. Spec: `docs/overview/03 … Part C/D item X1`.
- **Depends on:** Day 3 Task B2. API dependency: Day 3 Task A4 (same day).
- **Files to create/modify:**
  - `apps/mobile/lib/components/onboarding/role_profile_form.dart` (new)
  - `apps/mobile/lib/views/onboarding/register_view.dart` (modify — step 3)
  - `apps/mobile/test/register_role_profile_test.dart` (new)
- **Subtasks:**
  1. `role_profile_form.dart`: `RoleProfileForm(profileType, controller)` renders the variant section per persona — transport: vehicleType dropdown (Tata Ace / Bolero Maxi / Tractor Trolley) + `rcNumber` text field; seller: `shopName` + optional `gstNumber`, `apmcLicense`; farmLandlord: `totalLandAcres` slider 0.5–100; broker: `marketsServed` multi-select chips (Nashik / Pimpalgaon / Lasalgaon / Vashi) with custom adder. Each section has a localized header (`वाहन विवरण`, `दुकान विवरण`, `भूमि विवरण`, `बाज़ार विवरण`).
  2. Step 3 of `register_view.dart`: render the existing farmer farm-details form only when `farmer ∈ profiles`; then one `RoleProfileForm` section per other selected profile (stacked, in selection order).
  3. On finish: assemble `roleProfiles: { <type>: {...} }` from the sections and pass to `authApi.register`; required variant fields (vehicleType+rcNumber, shopName, totalLandAcres, ≥1 market) block finish with inline errors.
  4. `apps/mobile/test/register_role_profile_test.dart`:
     - `testWidgets('transport section renders for transport profile', ...)` — profiles `[farmer, transport]`; expect farm form AND `वाहन विवरण` section.
     - `testWidgets('finish assembles roleProfiles map', ...)` — fill rcNumber; finish; assert fake register received `roleProfiles['transport']['rcNumber']`.
     - `testWidgets('missing required variant field blocks finish', ...)` — leave rcNumber empty → inline error, no register call.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/register_role_profile_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass.

## Done-when checklist (end of day)

- [ ] `POST /v1/auth/register` stores all wizard fields and returns tokens + full user.
- [ ] `GET/PUT /v1/users/me` and `PUT /v1/users/me/farm-boundary` work (pytest `test_users.py` 6 passed).
- [ ] Profile link/unlink/activate/primary pass pytest incl. 409 `LAST_PROFILE` and `defaultHomeRoute` on activate.
- [ ] `cd backend && .venv/bin/pytest -v` → whole suite green (≥23 tests).
- [ ] `apps/mobile/lib/api/{api_client,api_exception,auth_api,user_api}.dart` exist; `flutter analyze` 0 issues.
- [ ] ApiClient adds `Authorization`, `Accept-Language`, and `Idempotency-Key` (widget/unit test proves each).
- [ ] Emulator manual run: OTP → MPIN → dashboard; register → farm boundary → dashboard; demo-login buttons gone.
- [ ] Register with a valid `referralCode` writes a `referral_attributions` doc (`status: pending`, no coins yet); invalid/self code → 400 `INVALID_REFERRAL_CODE` (F1).
- [ ] Register with `roleProfiles` stores each variant in `users/{uid}/role_profiles/`; pytest per variant green; GET /me returns them (X1).
- [ ] Register wizard: step 1 referral field with inline `अमान्य रेफरल कोड` error; step 3 renders role-keyed variant sections (F1, X1).
- [ ] `profile_edit_view.dart` wired to PUT /v1/users/me and reachable from settings (F21).
- [ ] 401 on an authed call opens the MPIN re-entry sheet and retries the original request on success — widget test + manual (1-min token TTL) verified (F2).
