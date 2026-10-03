# AGROVERCITY — Session Context Cache

Reusable context so a fresh agent/session doesn't re-explore. Keep this file updated after each work day. Last updated: day-12 complete (2026-09-17).

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
- **Redis**: OPTIONAL at runtime since day-12 run.sh work — `app/core/cache.py` helpers and `app/routers/content.py` (viewer counts, chat rate-limit) catch `REDIS_ERRORS` and degrade gracefully (Firestore seed counts, best-effort rate limit). No root/docker; if a server is available run.sh starts it (system `redis-server` or user-space /tmp/redis-local, which dies with tmp). Manual start: `LD_LIBRARY_PATH=/tmp/redis-local/usr/lib/x86_64-linux-gnu /tmp/redis-local/usr/bin/redis-server --daemonize yes --port 6379 --dir /tmp/redis-local`.

## Run commands

```bash
# whole stack at once (redis if available + API :8000 + website :5173 + flutter
# app in Chrome :5174, logs in .run-logs/, Ctrl+C kills full process trees;
# flags: --no-mobile / --no-website / --backend-only)
./run.sh
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
- Day-12 error codes: CHANNEL_NOT_FOUND, CHAT_RATE_LIMITED (2s Redis NX rate limit), WORKSHOP_NOT_FOUND/WORKSHOP_FULL/ALREADY_ENROLLED/INVALID_COIN_AMOUNT/INSUFFICIENT_COINS, ALREADY_REGISTERED, GAUSHALA_NOT_FOUND, VET_NOT_FOUND, FARM_VISIT_UNAVAILABLE, PRODUCT_NOT_FOUND, OUT_OF_STOCK, NGO_NOT_FOUND, BOOKING_NOT_FOUND, NOT_COMPLETED, ALREADY_RATED.
- Notifications: `app/services/notifications.py` `send_fcm_to_user` — always writes `notifications` doc, FCM best-effort (token FCM lands day 13).

## Flutter patterns (must match)

- API classes in `lib/api/` with path constants in `lib/api/endpoints.dart`; `ApiException(code, message)` from api_client.
- Widget tests use fake-API injection (see `test/helpers.dart`, `test/equipment_fakes.dart`).
- Split widgets to respect the ~300-line file rule (views split into `_widgets.dart` / section files).
- Photo upload via `lib/core/photo_upload.dart` injectable PhotoUploader (image_picker → Firebase Storage).

## Dev identities in real Firestore (delete before production)

`dev-user-1` farmer (MPIN `1234`, +919999999999), `dev-user-2` seller, `dev-user-3` transport, `dev-user-4` equipmentRental, `dev-user-5` farmer. Mint tokens: `cd backend && .venv/bin/python -c "from app.services.tokens import create_access_token; print(create_access_token('<uid>'))"` (no Firebase token needed for API testing).

## Progress

- Days 01–12 DONE. Tests: backend 293 passed (1 skipped, pre-existing Redis dep), flutter 126 passed, analyze clean, website builds.
- Day-10 backend (Dev A) DONE: schemes + data-driven eligibility (`app/data/schemes_seed.py`, seeded to real Firestore, `app/services/eligibility.py`), document vault (`app/services/storage.py` — dev mode = local `backend/.local_uploads/`, prod = Firebase Storage signed URLs), land-records adapter (`app/services/land_records/`, env `LAND_RECORDS_ADAPTER`, mock only), water intelligence, account deletion purge (`app/services/purge.py`, Redis `del_attempts:{uid}` rate limit), FCM device registration (`POST/DELETE /v1/devices` via `users.devices_router`), consents + append-only `consent_log` (`app/services/consents.py`, `require_data_sharing` for Day 13/14), rent-reminder job (`POST /v1/jobs/rent-reminders/run`, `app/services/fcm.py` shim → Day 13), soil-test booking. Tests: backend 226 passed + 1 skipped.
- Day-11 DONE: crop insurance (policies/apply/certificate/rates, 72h claim intimation with multipart photos, claim state machine + tracker, appeal/resubmit F15, demo seed `seed_insurance_demo.py`), My Bookings aggregate `GET /v1/users/me/bookings` (equipment/vet/transport), insurance deep-link from notifications, client-side offline queue for claims/bookings replayed via `/v1/sync`. Flutter: `crop_insurance_view` (4 tabs) + new `my_bookings_view` (3 tabs) routed.
- Day-12 DONE (backend + flutter): content (`routers/content.py` — news breaking-first, channels with Redis `channel:{id}:viewers` override, chat 50-msg history + 2s rate limit + `?joined/left` viewer INCR/DECR), gyan hub (`routers/gyan.py` — workshops enroll with `spend_coins` in `services/coins.py` + Razorpay partial-payment order `ws-{id}-{uid[:8]}`, expert talks register +25 coins + questions, videos, blogs bookmark toggle + idempotent like), livestock (`routers/livestock.py` — gaushalas + manure orders, nurseries, vets emergency filter + farm-visit guard, dairy orders with stock check), tree (`routers/tree.py` prefix `/tree` — articles, NGOs + sapling requests ≤500, biofuel, care guides sorted by stepNumber), product reviews X7 (`models/reviews.py`, routes on `routers/marketplace.py` — upsert `products/{id}/reviews/{uid}`, aggregate `ratingCount`/`ratingAvg` recomputed on write), service ratings X8 (`routers/ratings.py` — transport/vet/equipment terminal-status guard, one-per-booking, `provider_ratings/{providerId}` aggregate joined into provider lists). Seeds: `app/data/content_seed.py`, `gyan_seed.py`, `livestock_seed.py`, `tree_seed.py` — all idempotent (skip if collection non-empty), called from `main.py` startup. Flutter: `agri_news_view`, `live_channels_view` (video_player HLS, `enableVideo: false` test flag, chat poll 5s / viewer refetch 60s), `gyan_hub_view` (4 tabs, coin-redeem enroll sheet → Razorpay on `paymentOrderId`), `livestock_dairy_view` (4 tabs, vet booking → My Bookings link), `tree_plantation_view` (4 tabs, client-side 500-sapling cap), marketplace review form/list, `components/rate_booking_sheet.dart` on terminal bookings in `my_bookings_view`. APIs: `content_api`, `gyan_api`, `livestock_api`, `tree_api`, `ratings_api`; models: `agri_news_item`, `agri_live_channel`, `gyan_models`, `livestock_models`, `tree_models`, `product_review`. 17 new widget tests (13 + reviews 2 + ratings 2).
- Day contents: 01-05 base auth/profiles/mandi/weather/lots/seller; 06 marketplace+cart+orders+Razorpay dev mode+addresses+cancel/refund; 07 contracts e-sign + transport bookings state machine + vehicle KYC + POD + lot-linked pickups + booking inbox; 08 equipment slots (max-2/day, FPO auto-confirm, waitlist, ≤2h cancel) + owner fleet + FPO pools/machinery + approve/reject + machine KYC; 09 farm diary CRUD + PDF report (reportlab; Lohit Devanagari font registered for Hindi agreement PDFs) + AgriCoins award (15/entry, `app/services/coins.py`) + P&L (demo-seeded crops, break-even) + finance (credit score, EMI calc, KCC, loan apply + `GET /finance/loans`) + landlord plots/leases/rent payments + bank accounts (masked-only, penny-drop adapter `app/services/bank_verify/`, env `BANK_VERIFY_ADAPTER`) + settlement engine (`POST /v1/jobs/settlements/run`, `X-Cron-Secret` vs env `CRON_SECRET`, config `platform_config/settlements`) + land listings marketplace + lease requests + agreement PDF. Flutter: diary/P&L/finance ported API-wired; landlord screens (plots/leases/rent); bank accounts view; settlements section on 3 earner homes; land marketplace browse/listings/inbox.
- New backend modules day-09: routers diary, pnl, finance, land, bank_accounts, jobs, settlements; services coins, reports (PDF + storage upload, dev mode = `settings.env == "dev"` → `file://` URL), bank_verify, settlements. `endpoints.md` section 21 covers landlord/bank/settlement routes.
- Seed scripts all run against real Firestore already (products, certificates, mandi, contracts, equipment, fpo, insurance demo; day-12 content/gyan/livestock/tree seeds run from `main.py` startup, idempotent).

## Known gaps / TODOs

- No `GET /equipment/bookings/mine` — farmer can't see own equipment bookings cross-session (flagged for gap-analysis).
- **Broker deals collection doesn't exist** (Day 6/7 never built a broker router) — settlement aggregation queries `broker_deals` defensively but yields nothing until that collection exists. Equipment has no `completed` transition yet: day-12 `ratings.py` treats `booked` as the equipment terminal status (`TERMINAL_STATUS` map) and vet `completed` has no transition endpoint yet — revisit when those land.
- Day-12 X7/X8 divergence (day-file subtasks won over `overview/03` §D.7, as day-12 instructs): reviews are upsert 200 with `rating`/`comment` fields (not 201 `stars`/`text` + 409 `REVIEW_EXISTS`); ratings use codes `NOT_COMPLETED`/`ALREADY_RATED`/`BOOKING_NOT_FOUND` and aggregate into `provider_ratings/{providerId}` (not §D.7's `RATING_EXISTS`/`BOOKING_NOT_COMPLETED` on provider entities). If the §D.7 shape is ever enforced, both backend and the Flutter review/rating clients must change together.
- Day-11 follow-up still open: wire crop-insurance DBT `भुगतान खाता` row to the bankAccounts route (the `bankAccountLast4`-from-primary-account half was done in day-11).
- `backend/app/routers/land.py` is ~408 lines (>300 soft limit) — split `land_market.py` candidate.
- EMI note: day-09 spec's expected `4256.44` is arithmetically wrong for its own formula; correct value `4252.15` is what tests assert.
- `GET /mandi/list` has no distance field (vehicle-booking drop uses first mandi).
- Web run: backend needs CORSMiddleware (added day-09 run session, `allow_origins=["*"]` in main.py) or Chrome blocks all API calls. Cosmetic: RenderFlex overflow (~74px) in `components/onboarding/role_profile_form.dart:120` DropdownButtonFormField on wide web layout; `firebase_crashlytics` asserts on web when reporting errors (plugin unsupported there) — both noise, not fatal.
- Backend `main.py` uses deprecated `@app.on_event("startup")`; Python 3.10 EOL warnings from google libs.
- Flutter: signature pad sends placeholder base64 in headless tests (real PNG on device).
- Firestore security rules: real rules not yet written/deployed (backend uses Admin SDK so unaffected; needed only if clients read Firestore directly).
