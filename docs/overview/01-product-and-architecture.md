# 01 — Product & Architecture

## 1. Product Summary

AGROVERCITY — "Kisan Setu" (किसान सेतु, "Farmer's Bridge") — is a smart-agriculture **super app** for India. It serves farmers plus five adjacent agri-business personas, and is designed language-first (Hindi/Marathi-first UX, vernacular labels, large tap targets, audio readouts) for semi-literate users on low-end Android devices.

Core pillars (from the prototype, `features.md`):

- **Multi-profile system.** One account links up to 6 personas — Farmer, Farm Landlord, Transporter, Seller/Vyapari, Equipment Owner, Broker — with exactly one active at a time, instant switching, a per-module route access-control matrix, and a dedicated home dashboard per persona. The farmer is the super-user with access to all modules.
- **24 feature modules.** Mandi prices + "Aaj ke Bhav" live vyapari rates, AI advisory (market saturation, leaf-disease scan, NPK, pest radar), agri-input marketplace with QR authenticity certificates, pre-sowing price-lock contracts with e-sign, vehicle booking, P&L / Farm CEO with break-even calculator, water intelligence, government schemes + encrypted document vault, finance (Kisan credit score, loan calculator, KCC), PMFBY crop insurance with 72-h claim intimation and tracker, 7/12 land records, FPO group-buy + shared machinery, women farmer hub, climate & carbon, post-harvest (cold storage, AI grading), Krishi Ratna gamification (AgriCoins), refer & earn, farm diary, agri news, live channels with chat, livestock & dairy (gaushala, nursery, vet, dairy marketplace), Gyan Hub (workshops, expert talks, videos, blogs), tree plantation & biofuel, and time-slot equipment rental (max 2 slots/farmer/day, waitlist).
- **Kisan Mitra AI assistant.** Voice + chat (OpenRouter LLM, Sarvam AI STT for 15+ Indian dialects, 24 h session memory, rich cards, human-expert handoff), available via FAB on every screen.
- **AgriCoins economy.** Earn via tasks/diary/bookings/referrals (+15 to +100), spend in rewards store and workshop discounts.
- **Offline-first intent.** Sync-queue counter, cached rates with timestamps, idempotent queued writes replayed via `POST /sync`.

The prototype (`flutter-prototype/`) implements all of the above as UI over demo data with 5 `shared_preferences` keys of persistence. This project replaces the demo data with a real backend and ships it.

## 2. System Architecture

```
                        ┌────────────────────────────── CLIENTS ──────────────────────────────┐
                        │                                                                     │
   ┌───────────────────────────┐   ┌───────────────────────────┐   ┌────────────────────────┐ │
   │  apps/mobile (Flutter)    │   │  apps/mobile web build    │   │  apps/admin            │ │
   │  Android app (Play Store) │   │  (Firebase Hosting)       │   │  Flutter Web console   │ │
   └─────────────┬─────────────┘   └─────────────┬─────────────┘   └───────────┬────────────┘ │
                 │  HTTPS, Authorization: Bearer │                             │              │
                 └───────────────────────────────┼─────────────────────────────┘              │
                                                 │                                            │
   Firebase Phone Auth (client SDK) ── OTP ──► app gets Firebase ID token                     │
                                                 │                                            │
                        └────────────────────────┼────────────────────────────────────────────┘
                                                 ▼
                                  ┌──────────────────────────┐
                                  │   FastAPI on Cloud Run   │
                                  │   backend/app/main.py    │
                                  │   /v1/... REST + /ws     │
                                  └───┬───────┬───────┬──────┘
                                      │       │       │
        ┌─────────────────────────────┼───────┼───────┼──────────────────────────┐
        │                             │       │       │                          │
        ▼                             ▼       ▼       ▼                          ▼
┌────────────────┐         ┌────────────────┐  ┌────────────┐         ┌────────────────────┐
│   Firestore    │         │     Redis      │  │  Firebase  │         │ External services  │
│  (primary DB)  │         │ cache, rate-   │  │  Admin SDK │         │                    │
│ ~55 collections│         │ limits, chat   │  │            │         │ Razorpay (payments)│
│ see schema/    │         │ sessions,      │  │ • Auth     │         │ OpenRouter (LLM)   │
│ firestore-     │         │ idempotency    │  │   verify   │         │ Sarvam AI (STT)    │
│ collections.md │         │                │  │ • FCM push │         │ Agmarknet/eNAM     │
└────────────────┘         └────────────────┘  │ • Storage  │         │ IMD/OpenWeather    │
                                               │   (docs,   │         │ mahabhulekh (7/12) │
                                               │   photos)  │         │ SMS/WhatsApp       │
                                               └────────────┘         └────────────────────┘
```

Data-flow rules:

- **Clients never touch Firestore directly.** All reads/writes go through the FastAPI backend. Firestore security rules deny all client access (see `schema/firestore-collections.md` §Security).
- **The backend is the only holder of service credentials.** Razorpay, OpenRouter, Sarvam keys live only in backend env vars / Secret Manager.
- **Firebase services used by clients directly:** Phone Auth (OTP), and FCM token registration. Everything else goes through the API.

## 3. Why Each Technology

| Technology | Role | Why |
|---|---|---|
| **FastAPI (Python 3.12)** | REST API | Async, automatic OpenAPI spec (which Dev B uses for mocks — see contract-first rule), Pydantic v2 validation, small team velocity |
| **Cloud Run** | Backend hosting | Managed, scales to zero, simple Dockerfile deploy, fits a 2-person team |
| **Firebase Phone Auth** | OTP login | Proven Indian phone-auth infra; client gets ID token without backend SMS plumbing for login |
| **Firestore** | Primary database | Document model fits the 30+ prototype entities; strong per-user query patterns; generous offline semantics on the admin SDK side |
| **Redis** | Cache / rate-limit / sessions / idempotency | Mandi prices change at most 2-hourly — caching avoids hammering Agmarknet; chatbot session context and offline-write idempotency need fast TTL'd key-value storage |
| **FCM** | Push notifications | Booking reminders, claim status updates, persona notifications |
| **Cloud Storage (Firebase)** | Files | Vault documents, claim damage photos, product images, policy certificates. Signed URLs via backend |
| **Flutter (single codebase)** | Mobile + web | The prototype is already Flutter; one codebase yields Android + Flutter Web user app + admin console |
| **Firebase Hosting** | Web hosting | Free-tier friendly, CDN, integrates with the same Firebase project |
| **Razorpay** | Payments | Indian UPI-first gateway; orders + signature verification flow |
| **OpenRouter** | LLM for Kisan Mitra | Single API over many models; cost control; agri-tuned system prompts |
| **Sarvam AI** | Speech-to-text | Best-in-class for 15+ Indian languages/dialects |

## 4. Request Lifecycle — Login with OTP → Authorized API Call

1. **App → Firebase (client SDK):** `signInWithPhoneNumber("+91...")` → Firebase sends SMS OTP → user enters OTP → app receives **Firebase ID token** (short-lived, ~1 h).
2. **App → Backend:** `POST /v1/auth/otp/verify` with `{ phone, otp: "<firebase-id-token>", otpSessionId }`. (Field names kept from `endpoints.json`; the backend expects the Firebase ID token in the `otp` field. The MPIN-based login at `POST /auth/login` is the returning-user path.)
3. **Backend:** verifies the ID token with Firebase Admin (`auth.verify_id_token`), looks up/creates the Firestore `users` doc, checks `mpinHash` state, then issues the app's own tokens: **JWT access token (HS256, 24 h)** containing `uid` + `activeProfile` + `roles`, plus an opaque **refresh token (30 d)** stored hashed in Redis (`refresh:{tokenId}` → `uid`).
4. **App → Backend (every call):** `Authorization: Bearer <accessToken>`, plus `Accept-Language: hi` and, for writes, `Idempotency-Key: <uuid>`.
5. **Backend middleware:** validates JWT → loads user → checks the route ACL against the `roles` claim (same matrix as `profile_routes.dart`) → checks Redis rate limit → for writes, checks the idempotency key in Redis (replay returns the stored response) → handler executes against Firestore → response serialized with Pydantic v2.
6. **Token expiry:** app calls `POST /auth/refresh` with the refresh token; backend rotates it (old token deleted from Redis, new pair issued).
7. **MPIN as second factor:** sensitive actions (payments, contract e-sign, claims) require `mpin` in the request body; backend compares bcrypt hash against `users/{uid}.mpinHash`.

## 5. Environments

| Environment | Backend URL | Firebase project | Firestore DB | Redis | Purpose |
|---|---|---|---|---|---|
| dev | `http://localhost:8000/v1` | `agrovercity-dev` | `(default)` | local docker (`docker-compose.yml`) | Daily development, emulators allowed |
| staging | `https://api-staging.agrovercity.in/v1` | `agrovercity-staging` | `(default)` | Memorystore (Basic, 1 GB) | Pre-deploy e2e checklist (Day 15) |
| prod | `https://api.agrovercity.in/v1` | `agrovercity-prod` | `(default)` | Memorystore (Standard, 1 GB) | Play Store + Firebase Hosting release |

Each Flutter app picks its backend via `--dart-define=API_BASE_URL=...` (see `apps/mobile/lib/core/config.dart`, created Day 1).

## 6. Secrets Management

- All secrets live in a `.env` file **per environment, per component** (`backend/.env`, `backend/.env.staging`, `backend/.env.prod`). `.env` is listed in the root `.gitignore` (Day 1 task). **Never commit secrets.**
- Template committed as `backend/.env.example` with keys only, no values:

```bash
# backend/.env.example
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_JSON=   # path to service-account JSON, or JSON blob in prod
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=
JWT_ACCESS_TTL_SEC=86400
REFRESH_TOKEN_TTL_SEC=2592000
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
OPENROUTER_API_KEY=
SARVAM_API_KEY=
SMS_PROVIDER_API_KEY=
```

- **Dev:** plain `.env` loaded with `python-dotenv`; Firebase service-account JSON at `backend/secrets/service-account.json` (gitignored).
- **Staging/prod:** secrets in **Google Cloud Secret Manager**, injected into Cloud Run as env vars (see `deployment/backend-deploy.md`). The service-account key is replaced by the Cloud Run runtime service account — no JSON file in prod.
- **Flutter side:** no secrets. Firebase client config (`google-services.json` / `firebase_options.dart`) is not secret and may be committed. Razorpay **key id** (public) may be embedded; the **key secret** never leaves the backend.
- If a secret is ever committed, rotate it immediately and purge from git history.
