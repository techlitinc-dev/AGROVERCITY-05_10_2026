# Testing Strategy — AGROVERCITY / Kisan Setu

> Three layers: backend pytest, Flutter widget tests + analyze, manual end-to-end checklist.
> Layer 1 and 2 run on every day’s work; layer 3 runs in full on Day 15 before release.

---

## 1. Backend tests (pytest)

### Setup
- Location: `backend/tests/`, one file per router domain (`test_diary.py`, `test_insurance_claims.py`, …).
- Client: FastAPI `TestClient` (httpx-based) from `backend/tests/conftest.py`.
- Firebase is **always mocked** in unit/API tests: `conftest.py` patches `firebase_admin.auth.verify_id_token` to decode a fixed test token (`uid: "test-user-1"`), and uses the **Firestore emulator** (`FIRESTORE_EMULATOR_HOST=localhost:8080`) for API tests; pure unit tests use `unittest.mock` instead. Redis uses `fakeredis`.
- External services (Razorpay, OpenRouter, Sarvam, FCM, Storage) are patched at the service-module boundary (`app.services.*`), never via HTTP interception.

### Commands
```bash
cd backend
pytest -v                          # full suite
pytest tests/test_diary.py -v      # one domain
pytest --cov=app/routers --cov-report=term-missing
```

### Coverage target
- **≥ 70% statement coverage on `app/routers/`** (measured with `--cov=app/routers`). Services and middleware are tested where they contain logic (coin_service, claim state machine, eligibility, sync dispatch, rate limit).
- **Endpoint coverage** spans `endpoints.md` **and `docs/overview/03` Parts B–D** — `backend/scripts/smoke_test.py` parses those tables and asserts every `METHOD /v1/...` path exists in `/openapi.json`; a missing P0-tagged path fails the smoke run (Day 15 Task A5).
- Every endpoint has at least: 1 happy-path test + 1 auth test (401 without token) + its documented error-case tests (409/404/422 per the day plans).

### Test conventions
- Assertions must check exact field names from `endpoints.md` (e.g. `agriCoinsEarned`, `minSafePricePerQuintal`), exact HTTP statuses, and exact error codes (`INSUFFICIENT_COINS`, `DUPLICATE_PAYMENT_MONTH`, …).
- Golden values are asserted where the day plan fixes them (e.g. PMKSY 2 acres → subsidyAmount 93500.0; break-even 50000/20 → 2500).
- Firebase emulator suite (optional, pre-release): `firebase emulators:exec --only firestore,auth,storage "pytest tests/emulator/ -v"` covering vault upload, account purge, and claim photo storage.

---

## 2. Flutter tests

### Rules
- `flutter analyze` must report **0 issues** in `apps/mobile` and `apps/admin` at the end of every day.
- **Minimum 1 smoke widget test per screen** — every file in `apps/mobile/lib/views/**` has a matching `apps/mobile/test/views/<name>_test.dart` that pumps the widget with a mocked API layer and asserts its primary content renders (exact visible text, per the day plans).
- API mocking: all `*_api.dart` classes are constructor-injected into views; tests pass fakes (`mocktail` or hand-written fakes — one approach project-wide, set in Day 3).

### Commands
```bash
cd apps/mobile && flutter analyze && flutter test
cd apps/admin  && flutter analyze && flutter test
```

### What widget tests assert (pattern)
- Screen renders its app-bar title / tab labels (Hindi strings asserted verbatim).
- Key data from mocked API appears (e.g. policy number, `₹` amounts, status chips).
- Documented error strings appear for 409/404 paths where the day plan specifies them.

---

## 3. Manual end-to-end checklist

Run on the **internal-track Android build against the production backend** (Day 15). Record PASS/FAIL + screenshot per row. Release sign-off requires 18/18 PASS.

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| 1 | Full onboarding | Fresh install → splash → language select → pick Farmer profile → register with test mobile + OTP → set MPIN → farm details → map confirm → dashboard | Dashboard shows user name/village; profile doc exists (`GET /v1/users/me` 200 with entered data) |
| 2 | Profile switch | Link "Seller" profile from switcher sheet → activate it | Home swaps to seller dashboard <200 ms; Hindi toast; tools grid re-filters (mandi visible, water hidden) |
| 3 | Mandi view offline cache | Open mandi screen online → enable airplane mode → reopen screen | Cached rates render with "cached" timestamp; no crash; sync pill shows offline |
| 4 | Product order with Razorpay test card | Marketplace → add product → checkout UPI → Razorpay test card `4111 1111 1111 1111`, any future expiry, any CVV | Payment success → order confirmed screen; `GET /v1/orders` shows order with `paymentMethod: "upi"` |
| 5 | Contract e-sign | Buyers tab → open contract → terms dialog → e-sign with MPIN | Contract status becomes `accepted`; signature timestamp stored; 403 on wrong MPIN |
| 6 | Equipment 2-slot rule | Book 2 slots on one machine for tomorrow → attempt a 3rd slot same day | First two: 201 (`agriCoinsEarned: 50` each); third: 409 SnackBar; server response `{"error":{"code":"SLOT_LIMIT_REACHED"}}`-class 409 |
| 7 | Insurance claim → tracker | Crop Insurance → 72-hour tab → pick policy, hailstorm, 40% loss, 2 photos → submit → tracker tab | Claim number dialog `CLM-2026-…`; tracker shows `दावा दर्ज` stage; admin advances status → push notification arrives, tracker updates |
| 8 | Chatbot question | Kisan Mitra FAB → chat → send "आज प्याज का भाव क्या है?" | Bot replies in Hindi; `richCardType: "mandi"` card renders; quick-reply chips tappable |
| 9 | Vyapari rate → admin approval | Vyapari portal POSTs a pending rate (or seed via API) → admin console → दर अनुमोदन → स्वीकृत → refresh mobile home | "Aaj ke Bhav" widget shows the new rate after approval (and NOT before) |
| 10 | Account deletion | Settings → `खाता हटाएं` → enter MPIN → confirm | Account purged; app returns to splash; re-login with same phone starts fresh onboarding; Firestore/Storage/Auth records gone (check Firebase console) |
| 11 | Referral code entry → attribution | Fresh install → register wizard step 1 → enter inviter's referral code → complete onboarding → inviter opens Refer & Earn | New user doc carries `referredBy`; inviter's `GET /v1/referrals` shows the new user in `referred` with `rewardCoins: 100`; inviter balance +100 |
| 12 | Transporter rejects booking → farmer notified | Farmer books transport → transporter opens request inbox → `अस्वीकारें` with reason | Booking status `rejected` with reason stored; farmer gets push + in-app notification (`type: "booking"`); farmer's My Bookings परिवहन card shows `रद्द`/rejected chip |
| 13 | Equipment approve + waitlist promotion | Farmer books a pending private-machine slot → owner approves in request inbox; second farmer waitlists a full slot → first booking cancels | Owner approve → farmer sees `पुष्ट` chip + notification; cancel → waitlisted farmer promoted (status `booked`, notification sent); server confirms no double-booking |
| 14 | Order cancel → Razorpay test refund | Place marketplace order with Razorpay test card → cancel pre-dispatch from order detail | Order status `cancelled` with `refundStatus` visible; Razorpay dashboard (test mode) shows the refund; refund webhook updates `refundStatus: "processed"` |
| 15 | Bank account → penny-drop → claim uses it | Settings/Finance → add bank account → `सत्यापित करें` → submit an insurance claim | Verify chip flips to `सत्यापित ✓` (stub adapter); claim record's `bankAccountLast4` == the account's last 4 (not phone last-4); claim DBT row shows it |
| 16 | KYC: transporter RC → admin verify → bookable | Transporter uploads RC/driving licence → admin console `KYC कतार` → view doc → `सत्यापित करें` → farmer searches transport | Entity listed pending → verified; vehicle shows verified badge and accepts bookings; rejected path shows the reason to the transporter |
| 17 | Consent off → saturation 403 | Settings → गोपनीयता → turn `डेटा साझाकरण` OFF → Advisory → run market-saturation check | Server returns 403 `CONSENT_REQUIRED`; app shows `डेटा साझाकरण की सहमति आवश्यक है` with a link to settings; turning it back ON → saturation works |
| 18 | Land listing → lease → agreement PDF | Landlord posts a land listing → farmer finds it under `किराए की ज़मीन` → `पट्टा अनुरोध करें` → landlord accepts in inbox → open lease → `अनुबंध PDF` | Accept creates the lease (listing flips `पट्टे पर`); competing requests auto-rejected; agreement PDF downloads and shows both parties' names, plot, rent, term |

---

## 4. Day-15 release smoke checklist

Run after production deploy, before track promotion:

- [ ] `python backend/scripts/smoke_test.py https://api.agrovercity.in` → 26/26 PASS (includes the gap-audit P0 flows: app-config, referral, bank verify, lots CRUD, order cancel+refund, booking accept/reject, settlements job, consent PUT, claim appeal, KYC verify, broadcast dry-run; endpoint-coverage gate spans docs/overview/03 Parts B–D).
- [ ] `curl -I https://app.agrovercity.in` and `curl -I https://admin.agrovercity.in` → 200; deep link `/mandi` → 200 (SPA rewrite).
- [ ] Rate limit: 105 rapid requests → last responses 429 with `Retry-After`.
- [ ] Error envelope: one deliberate 422 (bad body) and one 404 return `{error:{code,message,fieldErrors}}`.
- [ ] FCM: advance a claim as admin → notification lands on a registered device (foreground + background).
- [ ] Razorpay live-mode key swapped in Secret Manager and one ₹1 test order verified, then order refunded.
- [ ] Firestore rules deployed (deny-all); indexes deployed; no `cloud_firestore` in client pubspecs.
- [ ] Play internal build installs on Android 10 (2 GB) and Android 14 devices; splash, icons, Hindi fonts render.
- [ ] E2E checklist (§3) 18/18 PASS.
- [ ] Rollback command tested: `gcloud run services update-traffic` points back to previous revision (see `docs/deployment/backend-deploy.md` §Rollback).
