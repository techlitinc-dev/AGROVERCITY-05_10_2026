# AGROVERCITY — Session Context Cache

Reusable context so a fresh agent/session doesn't re-explore. Keep this file updated after each work day. Last updated: day-08 complete (2026-09-16).

## What this is

Multi-platform agri super-app ("Kisan Setu"). Spec/plans live in `docs/` — day plans `docs/days/day-NN.md` (day-01…day-15), conventions in `docs/conventions/` (READ BEFORE CODING: error envelope, pagination envelope, ~300-line file limit, SCREAMING_SNAKE error codes), schema in `docs/schema/`, gap analysis in `docs/overview/03-*.md`.

## Repo layout

- `backend/` — FastAPI + Firestore (async). Entry `app/main.py`. Routers in `app/routers/`, Pydantic models in `app/models/`, services in `app/services/`, seed scripts in `scripts/`, tests in `tests/`.
- `apps/mobile/` — Flutter app `kisan_setu` (Android id `com.agrovercity.kisan_setu`). API layer `lib/api/`, state `lib/state/app_state.dart` + `profile_routes.dart` (ACL route map; route params passed via AppState fields, no direct Navigator), views `lib/views/`.
- `flutter-prototype/` — old demo UI; new screens are PORTS of these (keep styling/Hindi strings verbatim).
- `website/` — React+Vite+TS marketing site (`npm run dev/build`).
- `infra/docker-compose.yml` — api+redis (docker needs root here; compose v1 broken — don't rely on it).

## Environment (this machine)

- **Firebase project: `agrovercity-bafec`** — REAL Firestore enabled and in use (Firestore API was enabled in console 2026-09-16; emulator no longer needed). Service account: `backend/secrets/firebase-service-account.json`. Backend loads it via `settings.firebase_service_account_path` in `app/core/db.py` (fixed day-6 review). Only set `FIRESTORE_EMULATOR_HOST` if deliberately using the emulator (`firebase.json` + permissive `firestore.rules` at repo root are emulator-only, never deploy).
- **Firebase Auth**: Phone provider ENABLED; SMS region policy = allowlist `["IN"]` (was empty — fixed via Identity Toolkit API). Test number `+919999999999` → OTP `123456`. App configured: `apps/mobile/lib/firebase_options.dart` + `android/app/google-services.json` exist; `main.dart` calls `Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform)`.
- **Java**: default is now 21.0.2-open via SDKMAN (firebase-tools needs ≥21; system java 17 broke emulator).
- **Redis**: no root/docker. User-space redis extracted to /tmp/redis-local (dies with tmp). Start: `LD_LIBRARY_PATH=/tmp/redis-local/usr/lib/x86_64-linux-gnu /tmp/redis-local/usr/bin/redis-server --daemonize yes --port 6379 --dir /tmp/redis-local`. Backend tolerates it being down except weather/mandi caching tests skip.

## Run commands

```bash
# backend (real Firestore — do NOT set FIRESTORE_EMULATOR_HOST)
cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
cd backend && .venv/bin/pytest -q                      # full suite
cd backend && .venv/bin/python scripts/seed_<x>.py     # seeds: app_config, products, mandi, contracts, equipment, fpo
# mobile
cd apps/mobile && flutter analyze && flutter test
cd apps/mobile && flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8000/v1
# (Android emulator default http://10.0.2.2:8000/v1; physical device → PC LAN IP)
# website
cd website && npm run dev   # :5173
```

## Backend patterns (must match)

- DB via `app/core/db.py` helpers only: `get_doc/set_doc/delete_doc/query` (query = top-level collections, filters as `(field, op, value)` tuples). Subcollections are plain path strings e.g. `users/{uid}/diary_entries`.
- Auth: `Depends(current_user_id)` (deps.py) → load user doc → `require_role(user, ...)`. Error envelope: `{"error":{"code","message","fieldErrors"}}` via `raise HTTPException(status, detail={...})`; global handlers in main.py (incl. RequestValidationError → 422 `VALIDATION_ERROR` envelope — added day-7 review).
- Pagination envelope: `{"data": [...], "page": 1, "pageSize": 20, "total": N}`; single objects bare.
- **Tests**: `tests/conftest.py` monkeypatches db helpers with an in-memory store — EVERY new router/service module must be added to its patch loops or tests hit real Firestore. Dev-mode external services (Razorpay, FCM) stub via empty settings keys.
- New error codes used: CONTRACT_NOT_FOUND/NOT_OPEN, WRONG_MPIN, MPIN_NOT_SET, ILLEGAL_TRANSITION, VEHICLE_NOT_VERIFIED, NOT_VEHICLE_OWNER, POD_REQUIRED, LOT_NOT_FOUND/NOT_OPEN, SLOT_UNAVAILABLE, MAX_SLOTS_PER_DAY, CANCEL_WINDOW_CLOSED, ALREADY_WAITLISTED, EQUIPMENT_NOT_FOUND, NOT_EQUIPMENT_OWNER, POOL_FULL, FORBIDDEN_ROLE.
- Notifications: `app/services/notifications.py` `send_fcm_to_user` — always writes `notifications` doc, FCM best-effort (token FCM lands day 13).

## Flutter patterns (must match)

- API classes in `lib/api/` with path constants in `lib/api/endpoints.dart`; `ApiException(code, message)` from api_client.
- Widget tests use fake-API injection (see `test/helpers.dart`, `test/equipment_fakes.dart`).
- Split widgets to respect the ~300-line file rule (views split into `_widgets.dart` / section files).
- Photo upload via `lib/core/photo_upload.dart` injectable PhotoUploader (image_picker → Firebase Storage).

## Dev identities in real Firestore (delete before production)

`dev-user-1` farmer (MPIN `1234`, +919999999999), `dev-user-2` seller, `dev-user-3` transport, `dev-user-4` equipmentRental, `dev-user-5` farmer. Mint tokens: `cd backend && .venv/bin/python -c "from app.services.tokens import create_access_token; print(create_access_token('<uid>'))"` (no Firebase token needed for API testing).

## Progress

- Days 01–08 DONE. Tests: backend 144 passed, flutter 63 passed, analyze clean, website builds.
- Day contents: 01-05 base auth/profiles/mandi/weather/lots/seller; 06 marketplace+cart+orders+Razorpay dev mode+addresses+cancel/refund; 07 contracts e-sign + transport bookings state machine + vehicle KYC + POD + lot-linked pickups + booking inbox; 08 equipment slots (max-2/day, FPO auto-confirm, waitlist, ≤2h cancel) + owner fleet + FPO pools/machinery + approve/reject + machine KYC.
- Seed scripts all run against real Firestore already (products, certificates, mandi, contracts, equipment, fpo).

## Known gaps / TODOs

- No `GET /equipment/bookings/mine` — farmer can't see own equipment bookings cross-session (flagged for gap-analysis).
- `GET /mandi/list` has no distance field (vehicle-booking drop uses first mandi).
- Backend `main.py` uses deprecated `@app.on_event("startup")`; Python 3.10 EOL warnings from google libs.
- Flutter: signature pad sends placeholder base64 in headless tests (real PNG on device).
- Firestore security rules: real rules not yet written/deployed (backend uses Admin SDK so unaffected; needed only if clients read Firestore directly).
