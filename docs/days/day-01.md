# Day 1 — Foundation

**Dev A (Backend) goal:** FastAPI skeleton boots under uvicorn with `/v1/health`, and Firebase/Firestore/Redis helper modules exist and are importable — plus the `/v1/app-config` version-gate endpoint and Sentry error reporting wired.
**Dev B (Flutter) goal:** `apps/mobile` project created with the prototype UI code copied in, production folder structure, theme, and the state-machine shell running — plus Firebase Crashlytics wired with a debug-only test-crash button.

## Dev A — Backend tasks

### Task A1 — Backend skeleton + docker-compose + health endpoint

- **Goal:** A runnable FastAPI app with config loading and a health check.
- **Depends on:** none
- **Files to create/modify:**
  - `backend/requirements.txt`
  - `backend/.env.example`
  - `backend/app/__init__.py` (empty)
  - `backend/app/main.py`
  - `backend/app/core/__init__.py` (empty)
  - `backend/app/core/config.py`
  - `backend/app/routers/__init__.py` (empty)
  - `backend/app/routers/health.py`
  - `infra/docker-compose.yml`
- **Subtasks:**
  1. Write `backend/requirements.txt` with exactly these lines:
     ```
     fastapi>=0.115
     uvicorn[standard]>=0.30
     firebase-admin>=6.5
     redis>=5.0
     pydantic-settings>=2.4
     pytest>=8.0
     pytest-asyncio>=0.23
     httpx>=0.27
     passlib[bcrypt]>=1.7.4
     python-jose[cryptography]>=3.3
     python-multipart>=0.0.9
     ```
  2. Create a venv and install: `cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`.
  3. Write `backend/app/core/config.py`:
     ```python
     from pydantic_settings import BaseSettings, SettingsConfigDict

     class Settings(BaseSettings):
         model_config = SettingsConfigDict(env_file=".env", extra="ignore")
         app_name: str = "AGROVERCITY API"
         env: str = "dev"
         firebase_service_account_path: str = "secrets/firebase-service-account.json"
         firebase_project_id: str = "agrovercity-dev"
         redis_url: str = "redis://localhost:6379/0"
         jwt_secret: str = "dev-secret-change-me"
         jwt_algorithm: str = "HS256"
         jwt_access_ttl_minutes: int = 60 * 24
         jwt_refresh_ttl_days: int = 30
         razorpay_key_id: str = ""
         razorpay_key_secret: str = ""
         openrouter_api_key: str = ""
         sarvam_api_key: str = ""
         weather_api_key: str = ""

     settings = Settings()
     ```
  4. Write `backend/.env.example` listing every field above with dev defaults (no real secrets).
  5. Write `backend/app/routers/health.py`:
     ```python
     from fastapi import APIRouter
     router = APIRouter()

     @router.get("/health")
     def health():
         return {"status": "ok"}
     ```
  6. Write `backend/app/main.py`:
     ```python
     from fastapi import FastAPI
     from app.routers import health

     app = FastAPI(title="AGROVERCITY API", version="0.1.0")
     app.include_router(health.router, prefix="/v1")
     ```
  7. Write `infra/docker-compose.yml` with two services:
     - `api`: `build: ../backend` (Dockerfile optional today; alternatively run uvicorn locally), ports `8000:8000`, env_file `../backend/.env`, depends_on `redis`.
     - `redis`: `image: redis:7-alpine`, ports `6379:6379`.
  8. Run: `docker compose -f infra/docker-compose.yml up -d redis` then `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000`.
- **Test:** `curl -s http://localhost:8000/v1/health`
- **Expected output:** HTTP 200, body `{"status":"ok"}`; also `curl -s http://localhost:8000/docs` returns HTML (Swagger UI).

### Task A2 — Firebase init, Firestore helper, Redis cache helper

- **Goal:** Shared infra modules every later router will use.
- **Depends on:** Day 1 Task A1
- **Files to create/modify:**
  - `backend/app/core/firebase.py`
  - `backend/app/core/db.py`
  - `backend/app/core/cache.py`
  - `backend/tests/__init__.py` (empty)
  - `backend/tests/test_infra.py`
- **Subtasks:**
  1. Write `backend/app/core/firebase.py`:
     - Function `init_firebase()` that, if `firebase_admin._apps` is empty, loads credentials from `settings.firebase_service_account_path` via `credentials.Certificate` and calls `firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})`.
     - Guard: if the JSON file does not exist, log a warning and skip init (dev mode without credentials must not crash the app).
  2. Call `init_firebase()` from a `@app.on_event("startup")` handler in `app/main.py`.
  3. Write `backend/app/core/db.py`:
     - `_client = None` module global.
     - `def get_db()`: lazily returns `firestore.client()` (google-cloud-firestore async client via `from google.cloud import firestore; firestore.AsyncClient(project=settings.firebase_project_id)` when firebase-admin is not initialised, else `firestore_async.client()` from `firebase_admin`). Pick ONE approach and document it in a one-line comment: use `google.cloud.firestore.AsyncClient(project=settings.firebase_project_id)` — simpler, no admin init needed for Firestore.
     - Helpers: `async def get_doc(collection: str, doc_id: str) -> dict | None`, `async def set_doc(collection: str, doc_id: str, data: dict)`, `async def query(collection: str, filters: list[tuple[str, str, Any]], limit: int = 100) -> list[dict]` where each filter tuple is `(field, op, value)`.
  4. Write `backend/app/core/cache.py`:
     - `import redis.asyncio as aioredis`; module global `_redis = None`.
     - `async def get_redis()`: lazily `aioredis.from_url(settings.redis_url, decode_responses=True)`.
     - `async def cache_get(key: str) -> str | None`, `async def cache_set(key: str, value: str, ttl_seconds: int)`, `async def cache_delete(key: str)`.
  5. Write `backend/tests/test_infra.py`:
     - `test_settings_load()`: `from app.core.config import settings; assert settings.jwt_algorithm == "HS256"`.
     - `test_health(client)`: use `httpx.ASGITransport(app=app)` + `httpx.AsyncClient`; GET `/v1/health` → 200 and `{"status":"ok"}`. Mark with `@pytest.mark.asyncio`.
     - `test_cache_roundtrip()`: skipped if Redis not reachable (`pytest.importorskip` not applicable — wrap in try/except `redis.exceptions.ConnectionError` and `pytest.skip`). Set key `test:k` value `"v"` ttl 60, assert get returns `"v"`, delete.
  6. Run pytest with asyncio mode: add `pytest.ini` in `backend/` with `[pytest]\nasyncio_mode = auto\npythonpath = .`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_infra.py -v`
- **Expected output:** `3 passed` (or `2 passed, 1 skipped` if Redis is not up — then start Redis with `docker compose -f infra/docker-compose.yml up -d redis` and re-run until `3 passed`).

## Dev B — Flutter tasks

### Task B1 — Create apps/mobile and port prototype code

- **Goal:** A new Flutter project that contains the prototype UI as its starting point.
- **Depends on:** none
- **Files to create/modify:**
  - `apps/mobile/` (new Flutter project, package name `com.agrovercity.kisansetu`)
  - `apps/mobile/lib/**` (prototype code copied, then reorganised)
  - `apps/mobile/pubspec.yaml`
- **Subtasks:**
  1. `flutter create --org com.agrovercity --project-name kisan_setu apps/mobile` (platforms android + web: `flutter create --platforms android,web ...`). NOTE: project folder is `apps/mobile`, not `flutter-prototype`.
  2. Copy prototype code in as the baseline:
     - `cp -r flutter-prototype/lib/views apps/mobile/lib/views`
     - `cp -r flutter-prototype/lib/components apps/mobile/lib/components`
     - `cp -r flutter-prototype/lib/models apps/mobile/lib/models`
     - `cp -r flutter-prototype/lib/data apps/mobile/lib/data`
     - `cp -r flutter-prototype/lib/state apps/mobile/lib/state`
     - `cp flutter-prototype/lib/main.dart apps/mobile/lib/main.dart`
     - `cp -r flutter-prototype/assets apps/mobile/assets`
  3. Create the production target structure (new empty dirs with a `.gitkeep`): `apps/mobile/lib/core/`, `apps/mobile/lib/api/`. Final layout: `lib/{core,api,models,state,views,components,data}`.
  4. Edit `apps/mobile/pubspec.yaml`: under `dependencies:` add (keep existing `cupertino_icons`, `google_fonts`, `video_player`, `shared_preferences`):
     ```yaml
       firebase_core: ^3.6.0
       firebase_auth: ^5.3.1
       dio: ^5.7.0
       cached_network_image: ^3.4.1
       url_launcher: ^6.3.0
       intl: ^0.19.0
       razorpay_flutter: ^1.3.7
       flutter_local_notifications: ^17.2.3
     ```
     Run `cd apps/mobile && flutter pub get`.
  5. Fix imports: prototype files import via `package:kisan_setu_app/...`. In `apps/mobile/pubspec.yaml` set `name: kisan_setu` — then do a global replace in `apps/mobile/lib` of `package:kisan_setu_app/` → `package:kisan_setu/` (e.g. `grep -rl 'package:kisan_setu_app' apps/mobile/lib | xargs sed -i 's#package:kisan_setu_app#package:kisan_setu#g'`).
  6. Copy the asset list block (`assets:` entries incl. `assets/splash.mp4`, `assets/crop agro logo.PNG`, `assets/dds logo.jpg.jpg`, `assets/app_icon.png`) from `flutter-prototype/pubspec.yaml` into `apps/mobile/pubspec.yaml`.
  7. Android: set `minSdkVersion 23` in `apps/mobile/android/app/build.gradle.kts` (required by firebase_auth).
- **Test:** `cd apps/mobile && flutter analyze`
- **Expected output:** `No issues found!` (0 issues; deprecations acceptable only if pre-existing in prototype — fix them anyway).

### Task B2 — Theme, AppState shell, and boot check

- **Goal:** App compiles and boots to the splash screen using the production light theme.
- **Depends on:** Day 1 Task B1
- **Files to create/modify:**
  - `apps/mobile/lib/core/theme.dart` (new)
  - `apps/mobile/lib/core/constants.dart` (new)
  - `apps/mobile/lib/main.dart` (modify — point ThemeData at the new theme)
- **Subtasks:**
  1. Create `apps/mobile/lib/core/theme.dart` with:
     - `class AppColors` static consts: `background = Color(0xFFF5F7FA)`, `card = Color(0xFFFFFFFF)`, `primary = Color(0xFF43A047)`, `accent = Color(0xFFE8F5E9)`, persona colours `landlordPurple 0xFF8B5CF6`, `transportBlue 0xFF0284C7`, `sellerOrange 0xFFEA580C`, `equipmentAmber 0xFFF59E0B`, `brokerTeal 0xFF14B8A6`, `womenRose 0xFFBE123C`.
     - `ThemeData buildAppTheme()`: `useMaterial3: true`, `scaffoldBackgroundColor: AppColors.background`, `colorScheme: ColorScheme.fromSeed(seedColor: AppColors.primary, brightness: Brightness.light)`, `textTheme: GoogleFonts.muktaTextTheme()` (Mukta from `google_fonts`).
  2. Create `apps/mobile/lib/core/constants.dart` with `const String kApiBaseUrl = "http://10.0.2.2:8000/v1";` (Android emulator → host loopback; document that web uses `http://localhost:8000/v1` via `--dart-define=API_BASE_URL=...`).
  3. In `apps/mobile/lib/main.dart`, replace the existing `ThemeData` with `theme: buildAppTheme()`. Keep the existing `AppState`-driven `AnimatedSwitcher` router from the prototype unchanged (state machine: `splash → language → profileSelect → auth → map → dashboard`).
  4. Verify boot: `cd apps/mobile && flutter run -d chrome --web-port 5000` (or an Android emulator). Confirm splash phase 1 shows the DDS logo, then AGROVERCITY brand reveal, then language selection renders.
  5. Do NOT delete `lib/data/demo_data.dart` yet — it stays until each screen is wired to the API.
- **Test:** `cd apps/mobile && flutter analyze && flutter test`
- **Expected output:** `No issues found!`; default counter test may fail because `main.dart` changed — delete `apps/mobile/test/widget_test.dart` if it references the counter app, then `flutter test` reports `No tests found` or passes remaining tests. Manual check: splash → language screen visible in browser/emulator.

## Additional tasks (from missing.md)

### Task A3 — GET /v1/app-config (force-update / remote config)

- **Goal:** Version-gate endpoint so the client can block outdated builds and read server-side feature flags. Spec: `docs/overview/03 … Part C/D item X12`.
- **Depends on:** Day 1 Task A2
- **Files to create/modify:**
  - `backend/app/models/app_config.py` (new)
  - `backend/app/routers/app_config.py` (new)
  - `backend/scripts/seed_app_config.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_app_config.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/app_config.py`:
     - `class AppConfigOut(BaseModel)`: `minSupportedVersion: str`, `forceUpdate: bool`, `featureFlags: dict[str, bool]`, `maintenanceMode: bool`
  2. Write `backend/scripts/seed_app_config.py`: create the Firestore singleton doc `app_config/current` = `{ "minSupportedVersion": "1.0.0", "forceUpdate": false, "featureFlags": { "liveChannels": true, "bnpl": false }, "maintenanceMode": false }` via `app.core.db.set_doc`. Run: `cd backend && .venv/bin/python scripts/seed_app_config.py` → prints `seeded app_config/current`.
  3. Write `backend/app/routers/app_config.py` (`router = APIRouter(tags=["app-config"])`, **public** — no auth):
     - `GET /app-config?version=&platform=`: load `app_config/current` (404 `APP_CONFIG_MISSING` if absent). `platform` accepts `android|ios|web` and is ignored today except for future per-platform flags.
     - If `version` is present, compute `forceUpdate` server-side: parse both versions as int tuples (`"1.2.0" → (1,2,0)`, non-numeric parts → treat as 0) and set `forceUpdate = version_tuple < min_supported_tuple`; otherwise echo the doc's stored `forceUpdate`. All other fields returned as stored.
     - Return `AppConfigOut` bare (single-object endpoint, no envelope — conventions §5).
  4. Include in `app/main.py` under `/v1`.
  5. Write `backend/tests/test_app_config.py` (in-memory patch of `get_doc` returning the seeded doc):
     - `test_app_config_shape`: response has exactly the 4 keys; `featureFlags` is a dict of bools.
     - `test_force_update_computed`: `?version=0.9.0` → `forceUpdate == true`; `?version=1.2.0` → `forceUpdate == false`.
     - `test_app_config_public`: no `Authorization` header → still 200.
- **Test:** `cd backend && .venv/bin/pytest tests/test_app_config.py -v && .venv/bin/python scripts/seed_app_config.py && curl -s "http://localhost:8000/v1/app-config?version=0.9.0&platform=android"`
- **Expected output:** `3 passed`; seed prints `seeded app_config/current`; curl returns `{"minSupportedVersion":"1.0.0","forceUpdate":true,"featureFlags":{...},"maintenanceMode":false}`.

### Task A4 — Sentry SDK wiring (backend crash/error reporting)

- **Goal:** Unhandled backend exceptions reach Sentry with environment + release tags. Spec: `docs/overview/03 … Part C/D item X14`.
- **Depends on:** Day 1 Task A1
- **Files to create/modify:**
  - `backend/requirements.txt` (modify — add `sentry-sdk[fastapi]>=2.14`)
  - `backend/app/core/config.py` (modify)
  - `backend/app/main.py` (modify)
  - `backend/.env.example` (modify)
- **Subtasks:**
  1. Add `sentry-sdk[fastapi]>=2.14` to `backend/requirements.txt`; `.venv/bin/pip install -r requirements.txt`.
  2. Add to `Settings` in `config.py`: `sentry_dsn: str = ""`; add `SENTRY_DSN=` to `backend/.env.example` with a comment that the real DSN comes from the Sentry project settings.
  3. In `app/main.py`, before app creation: if `settings.sentry_dsn` non-empty → `sentry_sdk.init(dsn=settings.sentry_dsn, integrations=[FastapiIntegration()], traces_sample_rate=0.2, environment=settings.env)`. Empty DSN → skip init silently (dev default must not crash or warn-spam).
  4. Add a dev-only probe endpoint in `app/main.py` (not a separate router): `GET /v1/debug/sentry-test` that raises `RuntimeError("sentry smoke test")` when `settings.env == "dev"`, else 404. It exists to verify wiring; it is removed or env-gated permanently before release.
- **Test:** `cd backend && .venv/bin/pytest tests/test_infra.py -v` (suite still green with empty DSN), then with `SENTRY_DSN=<real dev DSN>` in `.env`: `curl -s http://localhost:8000/v1/debug/sentry-test` → HTTP 500, and the `RuntimeError: sentry smoke test` event appears in the Sentry project within ~1 minute (manual console check).
- **Expected output:** pytest unchanged (all pass, no DSN needed); with DSN set the 500 response is captured as a Sentry event tagged `environment: dev`.

### Task B3 — Firebase Crashlytics setup

- **Goal:** Fatal Flutter errors and crashes are reported to Crashlytics; a debug-only crash button proves the wiring. Spec: `docs/overview/03 … Part C/D item X14`.
- **Depends on:** Day 1 Task B1
- **Files to create/modify:**
  - `apps/mobile/pubspec.yaml` (modify)
  - `apps/mobile/lib/main.dart` (modify)
  - `apps/mobile/lib/core/debug_drawer.dart` (new)
- **Subtasks:**
  1. Add to `apps/mobile/pubspec.yaml` dependencies: `firebase_crashlytics: ^4.1.3`. Run `flutter pub get`.
  2. In `apps/mobile/lib/main.dart`, immediately after `Firebase.initializeApp(...)` (wrap in try/catch today — full Firebase config lands Day 3 Task B2; if Firebase is not yet configured, log and continue so the app still boots):
     - `FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;`
     - `PlatformDispatcher.instance.onError = (error, stack) { FirebaseCrashlytics.instance.recordError(error, stack, fatal: true); return true; };`
  3. Write `apps/mobile/lib/core/debug_drawer.dart`: an `EndDrawer`-style widget shown **only in `kDebugMode`** (`if (!kDebugMode) return const SizedBox.shrink();`) containing a "Test crash (Crashlytics)" ListTile whose onTap calls `FirebaseCrashlytics.instance.crash()`. Attach it as `endDrawer` on the dashboard scaffold (or any always-reachable screen) — never ship it in release builds.
- **Test:** `cd apps/mobile && flutter analyze`; manual: run debug build → open the debug drawer → tap Test crash → app crashes; relaunch once (Crashlytics uploads on next start) and confirm the crash appears in the Firebase console. If `google-services.json` isn't in place until Day 3, defer only the console check, not the code.
- **Expected output:** `No issues found!`; crash button visible in debug builds only; crash recorded in Crashlytics console after relaunch.

## Done-when checklist (end of day)

- [ ] `curl -s http://localhost:8000/v1/health` returns `{"status":"ok"}` with uvicorn running from `backend/.venv`.
- [ ] `docker compose -f infra/docker-compose.yml up -d redis` starts Redis; `redis-cli ping` → `PONG`.
- [ ] `cd backend && .venv/bin/pytest -v` → all tests pass (≥3).
- [ ] `backend/app/core/{config,firebase,db,cache}.py` exist with the specified functions.
- [ ] `cd apps/mobile && flutter analyze` → 0 issues.
- [ ] `apps/mobile` boots to the onboarding splash in Chrome or Android emulator with the Mukta light theme applied.
- [ ] `apps/mobile/lib` contains folders `core, api, models, state, views, components, data` and no import references `package:kisan_setu_app`.
- [ ] `curl -s "http://localhost:8000/v1/app-config?version=0.9.0&platform=android"` → 200 with `{minSupportedVersion, forceUpdate: true, featureFlags{}, maintenanceMode}`; `tests/test_app_config.py` 3 passed (X12).
- [ ] Sentry: app boots clean with empty `SENTRY_DSN`; with a DSN set, `GET /v1/debug/sentry-test` → 500 captured as a Sentry event (X14).
- [ ] Crashlytics handlers wired in `main.dart`; debug-only "Test crash" button crashes the debug build and the crash shows in the Firebase console after relaunch (X14).
