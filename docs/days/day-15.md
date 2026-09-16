# Day 15 — Hardening + Deploy

**Dev A (Backend) goal:** Rate limiting + structured logging middleware, error-envelope audit, final Firestore rules + indexes, Cloud Run deploy via Secret Manager, and a 15-endpoint production smoke test all green.
**Dev B (Flutter) goal:** Release-signed Android appbundle on the Play internal track, both Flutter Web apps deployed to Firebase Hosting, and the full end-to-end checklist from `docs/testing/test-strategy.md` executed and signed off.

## Dev A — Backend tasks

### Task A1 — Rate limiting + structured logging middleware

- **Goal:** Per-identity 100 req/min via Redis (fail-open); one JSON log line per request.
- **Depends on:** All routers complete (Days 2–14); Redis client from Day 1.
- **Files to create/modify:**
  - `backend/app/middleware/rate_limit.py` (new)
  - `backend/app/middleware/logging.py` (new)
  - `backend/app/main.py` (modify — register middleware)
  - `backend/requirements.txt` (modify — add `python-json-logger==2.0.7`)
  - `backend/tests/test_middleware.py` (new)
- **Subtasks:**
  1. Write `backend/app/middleware/rate_limit.py`: `class RateLimitMiddleware(BaseHTTPMiddleware)`.
     - Skip paths: `/v1/health`, `/docs`, `/openapi.json`, `/redoc`.
     - Identity: if the `Authorization: Bearer` token decodes (cheap unverified decode of the JWT `sub` is fine — routers still verify), use `u:{sub}`; else `ip:{request.client.host}`.
     - Key `rl:{identity}:{int(time.time() // 60)}`; `INCR`; on first hit `EXPIRE 70`; count > 100 → 429 with envelope detail `{ "code": "RATE_LIMITED", "message": "Too many requests", "fieldErrors": {} }` and header `Retry-After: <seconds to next minute>`.
     - Redis raises → log a warning and allow the request (fail open).
  2. Write `backend/app/middleware/logging.py`: `class LoggingMiddleware(BaseHTTPMiddleware)` — per request emit one JSON line via `logging.getLogger("api")` (configured with `pythonjsonlogger.json.JsonFormatter`): fields `{ ts, method, path, status, durationMs, uid (or null), requestId }`; generate `requestId = uuid4().hex` and set response header `X-Request-Id`. NEVER log request/response bodies (Aadhaar/photos pass through this API).
  3. In `app/main.py`: `app.add_middleware(LoggingMiddleware)` then `app.add_middleware(RateLimitMiddleware)` (Starlette runs last-added first — verify logging sees the 429s too; order so logging is outermost).
  4. Write `backend/tests/test_middleware.py` (fakeredis):
     - `test_101st_request_429`: 100 requests OK, 101st → 429 `RATE_LIMITED` + `Retry-After` header.
     - `test_health_never_limited`: 105× `/v1/health` → all 200.
     - `test_request_id_header`: any response carries `X-Request-Id`.
     - `test_fail_open_on_redis_outage`: patch redis `incr` to raise → request still 200.
- **Test:** `cd backend && .venv/bin/pytest tests/test_middleware.py -v`
- **Expected output:** `4 passed`; logs are single-line JSON — verify locally: `cd backend && .venv/bin/uvicorn app.main:app &` → make 3 requests → stdout shows 3 JSON lines each containing `requestId` and `durationMs`; kill the server.
- **Log redaction check:** `grep -rn "logger" backend/app/routers/vault.py backend/app/routers/land_records.py` — confirm no logger call includes file bytes, Aadhaar numbers, or `damagePhotos` contents (urls are fine).

### Task A2 — Error-envelope audit

- **Goal:** Every 4xx/5xx response matches `{ "error": { "code", "message", "fieldErrors" } }` (the handler was added Day 2 Task A1 — today we audit and close gaps).
- **Depends on:** Day 2 Task A1 exception handler in `app/main.py`.
- **Files to create/modify:**
  - `backend/app/main.py` (modify — add validation + catch-all handlers)
  - `backend/app/routers/*.py` (modify — fix any non-envelope raises found by the audit)
  - `backend/tests/test_error_envelope.py` (new)
- **Subtasks:**
  1. Confirm the Day 2 handler rewrites `HTTPException.detail` dicts into `{ "error": detail }`. Add two more handlers in `app/main.py`:
     - `@app.exception_handler(RequestValidationError)` → 422 `{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request", "fieldErrors": { "<loc.joined with .>": "<msg>" for each err } } }`.
     - `@app.exception_handler(Exception)` → log stack trace with request id; 500 `{ "error": { "code": "INTERNAL_ERROR", "message": "Something went wrong", "fieldErrors": {} } }`.
  2. Audit: `grep -rn "HTTPException(" backend/app/routers | grep -v '"code"'` — every raise must use `detail={"code": ..., "message": ..., "fieldErrors": {}}`; fix any bare-string details.
  3. Audit custom exceptions: `InsufficientCoins` (Day 12) must map to 409 `INSUFFICIENT_COINS` — add an `@app.exception_handler(InsufficientCoins)`; `ValueError` from `advance_status` is already mapped to 409 at the call sites (Day 11/14) — verify.
  4. Write `backend/tests/test_error_envelope.py`:
     - `test_422_envelope`: POST `/v1/pnl/break-even` with `{}` → 422, body has exactly `error.code == "VALIDATION_ERROR"`, `error.message`, `error.fieldErrors` non-empty.
     - `test_404_envelope`: GET `/v1/insurance/claims/nope` → 404 with `error.code == "CLAIM_NOT_FOUND"`.
     - `test_409_envelope`: redeem with insufficient coins → 409 `INSUFFICIENT_COINS` + Hindi message intact.
     - `test_429_envelope`: trip the rate limiter → 429 body also matches the envelope.
     - `test_500_envelope`: register a temporary route that raises `RuntimeError` → 500 `INTERNAL_ERROR`, no stack trace in body.
- **Test:** `cd backend && .venv/bin/pytest tests/test_error_envelope.py -v && .venv/bin/pytest -v`
- **Expected output:** `5 passed` + full suite green (the audit must not break existing tests).

### Task A3 — Firestore security rules + indexes (final)

- **Goal:** Deny-all client access (backend uses Admin SDK, which bypasses rules); composite indexes deployed for every query actually used.
- **Depends on:** Days 5–14 query patterns.
- **Files to create/modify:**
  - `infra/firestore.rules` (new)
  - `infra/firestore.indexes.json` (new)
  - `infra/README.md` (new — deploy commands)
- **Subtasks:**
  1. Verify no client touches Firestore directly: `grep -rn "cloud_firestore" apps/mobile/lib apps/admin/lib apps/mobile/pubspec.yaml apps/admin/pubspec.yaml` → expect no matches (all data flows through the REST API). If any match appears, scope explicit allow rules for exactly those paths instead of deny-all and document why.
  2. Write `infra/firestore.rules`:
     ```
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /{document=**} {
           allow read, write: if false;
         }
       }
     }
     ```
  3. Write `infra/firestore.indexes.json` — one entry per composite query written Days 5–14; minimum set:
     - collectionGroup `insurance_claims`: `status` ASC + `submittedAt` DESC (scope COLLECTION_GROUP — used by admin claims list)
     - `diary_entries` (subcollection queries stay COLLECTION scope): `type` ASC + `date` DESC
     - `orders`: `userId` ASC + `createdAt` DESC
     - `vyapari_rates_pending`: `status` ASC + `createdAt` DESC
     - `transport_bookings`: `userId` ASC + `date` DESC
     Each as `{ "collectionGroup": ..., "queryScope": "COLLECTION"|"COLLECTION_GROUP", "fields": [{ "fieldPath": ..., "order": "ASCENDING"|"DESCENDING" }] }`. Add any further index the Firestore error messages demand during testing (the emulator prints the exact index definition to add).
  4. Write `infra/README.md` with the deploy command: `firebase deploy --only firestore:rules,firestore:indexes --project $PROJECT_ID`.
  5. Audit other hot list queries for index needs: run the full pytest suite against the Firestore emulator with `--persist-emulator` off and grep the emulator log for `FAILED_PRECONDITION` / "requires an index" — every hit gets an entry in `firestore.indexes.json` before deploy.
  6. Deploy for real (Day 15 Task A4 project must exist first — sequence after it if needed).
- **Test:** `firebase deploy --only firestore:rules --dry-run` parses clean (or `firebase firestore:rules:simulate` if available); the grep in step 1 returns nothing; backend test suite still green against the emulator with the deny-all rules loaded (Admin SDK bypasses rules — this proves the architecture assumption).
- **Expected output:** Rules + indexes deployed to the Firebase project; `firebase firestore:indexes --project $PROJECT_ID` lists the 5+ composite indexes from `firestore.indexes.json`.

### Task A4 — Deploy to Cloud Run + production smoke test

- **Goal:** Production backend live at `https://api.agrovercity.in` per `docs/deployment/backend-deploy.md`, proven by an automated smoke script.
- **Depends on:** Day 15 Tasks A1–A3; `docs/deployment/backend-deploy.md`.
- **Files to create/modify:**
  - `backend/Dockerfile` (new — content exactly as in backend-deploy.md §2)
  - `backend/.dockerignore` (new)
  - `backend/scripts/smoke_test.py` (new)
- **Subtasks:**
  1. Follow `docs/deployment/backend-deploy.md` §§1–7 in order: enable services → Memorystore + VPC connector → create the 7 secrets (`FIREBASE_SERVICE_ACCOUNT`, `REDIS_URL`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `OPENROUTER_API_KEY`, `SARVAM_API_KEY`) → `gcloud builds submit` → `gcloud run deploy` with `--set-secrets` → Firestore rules/indexes → domain mapping. Record the run URL.
  2. Create a smoke user: register a dedicated account (phone `+919999000001`) and store a long-lived refresh token in env `SMOKE_REFRESH_TOKEN`; obtain an access token via `POST /v1/auth/refresh`. For the admin check use env `SMOKE_ADMIN_TOKEN` (a Firebase ID token for an admin-claimed account); skip with a printed warning if unset.
  3. Write `backend/scripts/smoke_test.py` — argv[1] = base URL; checks (each prints `PASS|FAIL <n>. <METHOD> <path> -> <status>`; exit code 1 on any FAIL). Script skeleton:
     ```python
     import os, sys, httpx
     BASE = sys.argv[1].rstrip("/")
     results = []
     def check(n, method, path, expect, **kw):
         r = httpx.request(method, BASE + path, timeout=15, **kw)
         ok = r.status_code == expect
         results.append(ok)
         print(f"{'PASS' if ok else 'FAIL'} {n}. {method} {path} -> {r.status_code}")
         return r
     ```
     Then the 15 checks:
     1. `GET /v1/health` → 200 `{"status":"ok"}` (no auth)
     2. `POST /v1/auth/refresh` → 200, `accessToken` present (uses `SMOKE_REFRESH_TOKEN`; all later checks send `Authorization: Bearer <that token>`)
     3. `GET /v1/users/me` → 200, `id` present
     4. `GET /v1/mandi/prices` → 200, envelope has `data`
     5. `GET /v1/mandi/vyapari-rates` → 200
     6. `GET /v1/weather?lat=20.0&lng=73.8` → 200
     7. `POST /v1/diary/entries` (smoke entry `{title: "smoke", category: "other", type: "farmActivity", date: <today>}`) → 201, `agriCoinsEarned == 15`
     8. `GET /v1/pnl/summary` → 200
     9. `GET /v1/schemes?eligibleOnly=true` → 200
     10. `GET /v1/finance/credit-score` → 200
     11. `GET /v1/insurance/policies` → 200
     12. `POST /v1/chatbot/messages` (`{"text": "नमस्ते", "sessionId": "smoke", "language": "hi"}`) → 200 (dev fallback text acceptable)
     13. `GET /v1/gamification/status` → 200
     14. `GET /v1/news` → 200
     15. `GET /v1/admin/analytics/summary` with the admin token → 200 (print `SKIP` + warning if `SMOKE_ADMIN_TOKEN` unset; SKIP counts as pass)
     Final line: `SMOKE: X/15 passed`.
  4. Run: `cd backend && .venv/bin/python scripts/smoke_test.py https://api.agrovercity.in` → `SMOKE: 15/15 passed`.
  5. Post-deploy verification pass:
     - `gcloud run services list --region asia-south1` shows `kisan-setu-api` with 100% traffic on the new revision.
     - Structured logs: `gcloud logging read "resource.labels.service_name=kisan-setu-api" --limit 5 --format json` → JSON request lines present.
     - Rate limit live: the 105-request curl loop from the Done-when checklist returns 429s at the tail.
- **Test:** `gcloud run services describe kisan-setu-api --region asia-south1 --format='value(status.url)'` returns the URL; `curl -s <url>/v1/health` → `{"status":"ok"}`; smoke script 15/15.
- **Expected output:** Live Cloud Run service behind the custom domain with valid TLS; rollback command from backend-deploy.md §8 verified once (shift traffic back and forth between the two most recent revisions).

## Dev B — Flutter tasks

### Task B1 — App icon, splash, release signing

- **Goal:** Final launcher icon/splash and a signed release AAB.
- **Depends on:** Assets in `flutter-prototype/assets/` (`app_icon.png`, `app_icon_foreground.png`, `dds logo.jpg.jpg`, `crop agro logo.PNG`, `splash.mp4`).
- **Files to create/modify:**
  - `apps/mobile/assets/` (modify — copy the 5 files from `flutter-prototype/assets/` if not already present; ensure `pubspec.yaml` asset entries)
  - `apps/mobile/pubspec.yaml` (modify — dev deps `flutter_launcher_icons: ^0.14.1`, `flutter_native_splash: ^2.4.1` + their config)
  - `apps/mobile/android/key.properties` (new — gitignored)
  - `apps/mobile/android/upload-keystore.jks` (new — gitignored)
  - `apps/mobile/android/app/build.gradle.kts` (modify — release signingConfig)
- **Subtasks:**
  1. `flutter_launcher_icons` config: `image_path: assets/app_icon.png`, `adaptive_icon_foreground: assets/app_icon_foreground.png`, `adaptive_icon_background: "#F5F7FA"` → run `dart run flutter_launcher_icons`; verify `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` exists.
  2. `flutter_native_splash` config: `color: "#F5F7FA"`, `image: assets/app_icon.png` → `dart run flutter_native_splash:create`.
  3. Keystore: `keytool -genkey -v -keystore apps/mobile/android/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias kisan_setu`; write `key.properties` (`storePassword`, `keyPassword`, `keyAlias=kisan_setu`, `storeFile=../upload-keystore.jks`). Verify `git check-ignore android/key.properties android/upload-keystore.jks` lists BOTH — if not, add them to `.gitignore` before doing anything else. Back up the keystore to the company vault.
  4. `build.gradle.kts`: load `key.properties`; `signingConfigs { release { ... } }`; `buildTypes { release { ... } }`. Snippet (goes at the top of the file / inside the `android {}` block):
     ```kotlin
     import java.util.Properties
     import java.io.FileInputStream

     val keyPropsFile = rootProject.file("key.properties")          // apps/mobile/android/key.properties
     val keyProps = Properties().apply { load(FileInputStream(keyPropsFile)) }

     android {
         // ... existing config ...
         signingConfigs {
             create("release") {
                 keyAlias = keyProps.getProperty("keyAlias")
                 keyPassword = keyProps.getProperty("keyPassword")
                 storeFile = file(keyProps.getProperty("storeFile"))  // resolved relative to app/ → ../upload-keystore.jks
                 storePassword = keyProps.getProperty("storePassword")
             }
         }
         buildTypes {
             release {
                 signingConfig = signingConfigs.getByName("release")
                 isMinifyEnabled = true
                 isShrinkResources = true
             }
         }
     }
     ```
  5. Bump version per the runbook scheme: `version: 1.0.0+10000` in `pubspec.yaml`.
  6. ProGuard: R8 default rules suffice for Flutter; add `-keep class io.flutter.app.** { *; }` only if a release-build crash appears (check with `flutter run --release` before uploading).
  7. Sanity install: `flutter run --release` on an emulator → icon, splash, and login flow all work on the release build (not just debug).
- **Test:** `cd apps/mobile && flutter build appbundle --release --dart-define=API_BASE_URL=https://api.agrovercity.in` → exit 0; `ls -lh build/app/outputs/bundle/release/app-release.aab`; Gradle log contains `> Task :app:signReleaseBundle`.
- **Expected output:** Signed AAB exists; release install on emulator shows the new icon + splash.

### Task B2 — Play Console setup + internal track upload

- **Goal:** Internal-track release submitted, following `docs/deployment/playstore-deploy.md` exactly.
- **Depends on:** Task B1 signed AAB.
- **Files to create/modify:** none in the repo (all Play Console work) except `docs/deployment/release-notes/v1.0.0.md` (new — release notes hi+en for this upload; copy template below).
- **Subtasks:**
  1. Create the Play app (name, hi-IN default language, free, Play App Signing enrolled).
  2. Store listing: paste short + full descriptions (hi + en) from playstore-deploy.md §5 verbatim.
  3. Upload the 8 named screenshots (§6), feature graphic, 512×512 icon.
  4. Content rating questionnaire per §7; Data Safety form per §8 table; privacy policy URL + account-deletion URL per §9.
  5. Internal track: create release → upload AAB → release notes (hi + en) → add tester list → submit.
  6. Verify account deletion on the internal build (Play requirement): fresh account → सेटिंग्स → `खाता हटाएं` → MPIN → back at splash; re-login with the same phone starts onboarding (proves server purge).
  7. `docs/deployment/release-notes/v1.0.0.md` template:
     ```
     # v1.0.0 (10000)
     - hi: पहला रिलीज़ — मंडी भाव, किसान मित्र AI, बाज़ार, बीमा, योजनाएं, यंत्र बुकिंग।
     - en: First release — mandi rates, Kisan Mitra AI, marketplace, insurance, schemes, equipment booking.
     ```
- **Test:** Play Console shows the release under Internal testing with no pre-launch crash blockers; opt-in link installs on a test device; versionCode 10000 visible under App bundle explorer.
- **Expected output:** Internal track link shared with testers.

### Task B3 — Web deploys (user app + admin)

- **Goal:** Both Flutter Web apps live on Firebase Hosting per `docs/deployment/web-deploy.md`.
- **Depends on:** Day 14 Task B2/B3 web builds.
- **Subtasks:**
  1. One-time: create the second hosting site and apply targets (web-deploy.md §1–2); commit `firebase.json` + `.firebaserc`.
  2. `cd apps/mobile && flutter build web --release --dart-define=API_BASE_URL=https://api.agrovercity.in && cd ../..`
  3. `cd apps/admin && flutter build web --release --dart-define=API_BASE_URL=https://api.agrovercity.in && cd ../..`
  4. `firebase deploy --only hosting:app,hosting:admin --project $PROJECT_ID`
  5. Custom domains per §5 (`app.agrovercity.in`, `admin.agrovercity.in`); wait for TLS provisioning.
  6. Cache-header sanity after deploy: `curl -sI https://app.agrovercity.in/main.dart.js | grep -i cache-control` → `max-age=31536000, immutable`; `curl -sI https://app.agrovercity.in/index.html | grep -i cache-control` → `no-cache`. If wrong, fix `firebase.json` headers and redeploy (a cached `index.html` strands users on old builds).
  7. Confirm the production API base URL took effect: open the user site, DevTools → Network → any `/v1/...` XHR must hit `https://api.agrovercity.in` (not localhost).
- **Test:** `curl -I https://app.agrovercity.in` → 200; `curl -I https://app.agrovercity.in/mandi` → 200 (SPA rewrite); `curl -I https://admin.agrovercity.in` → 200; manual: admin login on the production site loads analytics from the production API (DevTools shows `api.agrovercity.in`, not localhost).
- **Expected output:** Two live hosting sites with custom domains and valid TLS.

### Task B4 — End-to-end release checklist

- **Goal:** Execute `docs/testing/test-strategy.md` §3 (10 scenarios) + §4 (release smoke) on the internal Android build against production.
- **Depends on:** Tasks B1–B3; Dev A Task A4.
- **Files to create/modify:**
  - `docs/testing/e2e-results-v1.0.0.md` (new — the filled checklist; one row per scenario with PASS/FAIL + screenshot filename)
- **Subtasks:**
  1. Run every §3 scenario row (full onboarding → … → account deletion); record PASS/FAIL + a screenshot per row in `e2e-results-v1.0.0.md`.
  2. Run every §4 smoke item (backend 15/15, hosting 200s + SPA rewrite, rate-limit 429, error envelope, FCM claim push, Razorpay live ₹1 order + refund, rules/indexes, Android 10 + 14 install check).
  3. Any FAIL → file a bug, fix, re-run that row. **No release sign-off with open FAILs.**
  4. Devices for the matrix: one Android 10 (2 GB RAM) low-end device + one Android 14 device; both must complete scenarios 1, 4, 7, 10 at minimum.
- **Test:** All 10 scenarios + all smoke items PASS on the internal-track build.
- **Expected output:** `e2e-results-v1.0.0.md` committed with 10/10 PASS; release candidate approved for closed-track promotion.

## Done-when checklist (end of day)

- [ ] Rate limit 429 proven in prod: `for i in $(seq 105); do curl -s -o /dev/null -w "%{http_code}\n" https://api.agrovercity.in/v1/news -H "Authorization: Bearer $TOKEN"; done` — tail shows 429s.
- [ ] Error envelope: deliberate 422 + 404 + 429 all return `{error:{code,message,fieldErrors}}`.
- [ ] Firestore deny-all rules + indexes deployed; no client Firestore dependency (grep clean).
- [ ] Cloud Run live on `api.agrovercity.in`; `smoke_test.py` → `SMOKE: 15/15 passed`; rollback rehearsed once.
- [ ] Signed `app-release.aab` built; icon/splash final; keystore + key.properties gitignored and backed up.
- [ ] Play internal track submitted; listing (hi+en), 8 screenshots, content rating, data safety, privacy policy, account-deletion info complete.
- [ ] Both web apps deployed; custom domains live; SPA rewrite verified.
- [ ] E2E checklist 10/10 PASS + release smoke items all PASS on the internal build.
- [ ] `docs/testing/e2e-results-v1.0.0.md` committed with screenshots.
- [ ] Cache headers verified on both hosting sites (immutable assets, no-cache index.html).

---

## Additional tasks (from missing.md)

Covers: smoke-test extension for the gap-audit P0 flows, X13 analytics taxonomy, E2E checklist extension, legal-URL verification. Specs: docs/overview/03 Part C/D item X13 and the Parts B–D endpoint tables.

### Task A5 — Extend smoke_test.py with the new P0 flows + endpoint coverage

- **Goal:** `smoke_test.py` covers the Days 9–14 gap-audit flows; the endpoint-coverage check includes `docs/overview/03` Parts B–D paths.
- **Depends on:** Day 15 Task A4 (smoke script skeleton), Day 9 Tasks A5–A8, Day 10 Task A6, Day 11 Task A5, Day 14 Tasks A7–A9; F1/F7/X5 endpoints (referral register, lots CRUD, order cancel/refund, booking accept/reject) from their owning days.
- **Files to create/modify:**
  - `backend/scripts/smoke_test.py` (modify — new checks 16–26 + coverage gate)
- **Subtasks:**
  1. Add these checks after the existing 15 (same `check(...)` helper; a fresh smoke user should tolerate 409-already-exists as PASS where noted):
     16. `GET /v1/app-config?version=1.0.0` → 200 with `minSupported`/`forceUpdate` fields (X12)
     17. `POST /v1/referrals/invite` `{farmerName: "smoke", phone: "+919999000099"}` → 201 (409 `ALREADY_INVITED` = PASS on re-run)
     18. Bank account: `POST /v1/bank-accounts` (smoke account) → 201, then `POST /v1/bank-accounts/{id}/verify` → 200 `verifyStatus == "verified"` (stub adapter in smoke env)
     19. Lots CRUD: `POST /v1/market/lots` → 201; `GET /v1/market/lots/mine` contains it; `DELETE` → 204 (F7)
     20. Order cancel + refund: create a smoke order via `POST /v1/orders` (Razorpay dev-mode), then `POST /v1/orders/{id}/cancel` → 200 with `refundStatus` present (X5)
     21. Transport booking accept/reject: as the smoke transporter account (`SMOKE_TRANSPORTER_TOKEN`; SKIP with warning if unset) — `POST /v1/transport/bookings/{id}/accept` → 200; a second seeded booking → `reject` → 200 (T2)
     22. Equipment booking approve/reject: `POST /v1/equipment/bookings/{id}/approve` → 200 (E2; SKIP if no seeded owner token)
     23. Settlements job: `POST /v1/jobs/settlements/run` with header `X-Cron-Secret: $SMOKE_CRON_SECRET` → 200 (SKIP + warning if the env var is unset) (X10)
     24. Consent: `PUT /v1/users/me/consents` `{"dataSharing":true,"location":true,"marketing":false}` → 200 (X17)
     25. Claim appeal: drive a smoke claim to `rejected` via the admin claim endpoint (`SMOKE_ADMIN_TOKEN`), then `POST /v1/insurance/claims/{id}/appeal` → 200 `status == "intimated"` (SKIP if admin token unset) (F15)
     26. Admin: `POST /v1/admin/kyc/{entityId}/verify` on a seeded pending entity → 200, and `POST /v1/admin/broadcast` `{"segment": {"role": "farmer"}, "title": "smoke", "body": "smoke", "dryRun": true}` → 200 with `targetedCount` (both SKIP if admin token unset) (A1/A4)
     Final line becomes `SMOKE: X/26 passed` (SKIP counts as pass, printed distinctly).
  2. Endpoint-coverage check: extend the coverage gate to parse `docs/overview/03` Parts B–D in addition to `endpoints.md` — extract every `METHOD /v1/...` path from the tables and assert each appears in the live `/openapi.json` paths; print missing ones as `COVERAGE MISS: <path>` and fail the run (exit 1) if any P0-tagged path is missing; P1/P2 misses print warnings only.
  3. Re-run against production: `cd backend && .venv/bin/python scripts/smoke_test.py https://api.agrovercity.in` → `SMOKE: 26/26 passed`, no COVERAGE MISS lines.
- **Test:** Smoke run locally first: `.venv/bin/python scripts/smoke_test.py http://localhost:8000` → 26/26 (with the SKIP allowances); then the production run in Task A4's place.
- **Expected output:** `SMOKE: 26/26 passed`; coverage gate includes Parts B–D paths and fails on a deliberately removed P0 endpoint (verify once by commenting out a route locally).

### Task B5 — Analytics taxonomy (X13) + extended E2E + legal URL verification

- **Goal:** Firebase Analytics event logging per the spec table; E2E checklist run covers the 6–8 new scenarios; legal pages verified live at the listing URLs. Spec: docs/overview/03 Part D item X13.
- **Depends on:** Day 15 Tasks B1–B4; `firebase_analytics` package (add `firebase_analytics: ^11.3.5` to `apps/mobile/pubspec.yaml`); Day 14 Task B6 (legal pages).
- **Files to create/modify:**
  - `apps/mobile/lib/services/analytics_service.dart` (new)
  - Screen/action call sites across `apps/mobile/lib/views/**` (modify — one-line `AnalyticsService.log(...)` per the table below)
  - `docs/testing/e2e-results-v1.0.0.md` (modify — new scenario rows)
- **Subtasks:**
  1. Write `analytics_service.dart`: `class AnalyticsService { static Future<void> log(String name, [Map<String, Object>? params]) }` wrapping `FirebaseAnalytics.instance.logEvent(name: name, parameters: params)`; no-op guard when `kIsWeb` without Firebase config or in tests (`debugAnalytics = false` flag for widget tests).
  2. Event list (append to the spec table — exact names, snake_case):
     - `screen_view` per module — use `logScreenView` via a `RouteObserver`/route-change hook so it fires for every view without per-file edits; params `{screen_name: <view key>}`.
     - `register_complete` `{persona}`, `profile_switch` `{from, to}`, `lot_created` `{crop}`, `order_placed` `{amountRupees, paymentMethod}`, `order_cancelled` `{orderId}`, `booking_completed` `{kind}`, `claim_submitted` `{calamityType}`, `claim_appealed` `{claimId}`, `rate_posted` `{crop, mandi}`, `bank_account_verified`, `consent_updated` `{flag, value}`, `referral_invite_sent`, `lease_request_sent`, `settlement_viewed` `{role}`.
     - Wire each at its success call site (the same place the SnackBar fires).
  3. Verify in Firebase console **DebugView** with `adb shell setprop debug.firebase.analytics.app com.agrovercity.kisansetu`: walk onboarding → order → claim and watch the events arrive with params; screenshot into `e2e-results-v1.0.0.md`.
  4. Extend the E2E run: execute the 8 new scenarios (11–18) from `docs/testing/test-strategy.md` §3 on the internal build; record PASS/FAIL + screenshot per row; total sign-off is now 18/18.
  5. Verify the legal pages are reachable at the exact hosting URLs used in the Play listing: `curl -sI https://app.agrovercity.in/legal/privacy` (and terms/refunds/community) → 200; open each in a browser and eyeball the rendered markdown. Record in the E2E results doc.
- **Test:** `cd apps/mobile && flutter analyze` → 0 issues; DebugView shows each event with params during the walkthrough; all 4 legal URLs 200 on the production hosting domain.
- **Expected output:** Analytics live in DebugView; `e2e-results-v1.0.0.md` has 18/18 PASS; legal URLs verified for the Play listing.

### Done-when additions (additional tasks)

- [ ] `smoke_test.py` → `SMOKE: 26/26 passed` against production; coverage gate includes docs/overview/03 Parts B–D and fails on a missing P0 path (proven once locally).
- [ ] Every new P0 flow (app-config, referral, bank verify, lots, cancel+refund, booking accept/reject ×2, settlements job, consent, appeal, KYC verify, broadcast dry-run) exercised by the smoke script.
- [ ] Analytics events visible in DebugView with correct params during the onboarding → order → claim walkthrough.
- [ ] E2E checklist 18/18 PASS (10 original + 8 new) in `docs/testing/e2e-results-v1.0.0.md`.
- [ ] All 4 legal URLs return 200 on the production hosting domain and match the URLs entered in the Play listing.
