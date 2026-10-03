# Onboarding Web App — Implementation Plan

**Goal:** Build a React.js website that replicates the AGROVERCITY mobile app's onboarding flow end-to-end, consuming **only** the real backend APIs (no mock/test data). Design, color scheme, and user flow are taken from the mobile app (`apps/mobile`); endpoints from `backend`.

**Deliverable location:** `website/` (currently empty — fresh project).
**User flow authority:** mobile app state machine (`lib/state/app_state.dart`): `splash → language → profileSelect → auth → farm map → done`.

---

## 1. Tech Stack

| Choice | Reason |
|---|---|
| Vite + React 18 + TypeScript | Standard, fast; `website/` starts clean |
| React Router v6 | Mobile uses a state machine; web needs URL-addressable steps + `/legal/*` |
| Firebase JS SDK (Auth only) | Backend has **no OTP endpoint** — OTP is real Firebase Phone Auth, client-side; backend consumes the Firebase ID token |
| Zustand (persisted) | Mirrors `app_state.dart` + session store (tokens, language, selected personas, `isOnboarded`) |
| Mukta font via Google Fonts | Exact mobile typography |
| `@googlemaps/js-api-loader` | Farm map step (real Google Map, same gating rule as mobile) |
| No UI kit — hand-rolled components | Mobile design is custom; we replicate tokens exactly |

Node `v22.22.2`, pnpm available.

## 2. Design System (extracted from mobile)

From `apps/mobile/lib/core/theme.dart`, onboarding views, and components:

- **Colors:** primary `#43A047`, dark green `#2E7D32`, deep green `#1B5E20`, accent tint `#E8F5E9`, border green `#A5D6A7`/`#81C784`, background `#F5F7FA`, card border `#E2E8F0`, error `#DC2626`, success `#16A34A`, slate text `#64748B`/`#94A3B8`/`#334155`, title text `#263238`, splash bg `#0A1E14`, gold badge `#FEF3C7`/`#B45309`.
- **Persona palette** (profile-select cards): Farmer `#43A047`, Landlord `#8B5CF6`, Transport `#0284C7`, Seller/Vyapari `#EA580C`, Equipment `#F59E0B`, Broker `#14B8A6`, Instructor `#7C3AED`, Dairy `#0D9488`, Customer `#DB2777`, DirectBuyer `#4F46E5`, Bank `#334155`, Insurance `#0F766E`, ColdStorage `#0284C7`.
- **Gradients:** CTA button `#43A047→#2E7D32`; splash title text `#0F5132/#198754/#20C997`.
- **Typography:** Mukta everywhere; page titles 26px/900, section headings 18px/800–900, body 13px (`#64748B`), letterSpacing 4.5 on brand title, 1.2 on app name.
- **Shape:** inputs filled white radius 14; cards radius 12/16/20/24; chips radius 10–12; pill buttons radius 28; primary CTA height 50 radius 16.
- **Elevation:** selected-state colored glow (α .22–.35), subtle black shadow.
- **Layout:** replicate mobile's web shell — desktop shows a **centered 480px phone column** on `#0A1E14`; full width on mobile.
- **Motion:** page transitions fade+slide (~300–550ms); button press scale .96; staggered card entrances. Keep subtle on web.

## 3. User Flow & Routes

Mobile flow mapped to web routes. Guard logic mirrors `app_state.dart`.

| Route | Screen (mobile equivalent) | Notes |
|---|---|---|
| `/` | Splash | 2-phase animation on `#0A1E14`; app-config gate `GET /v1/app-config?version=1.0.0&platform=web` (fail-open; blocking dialog only on `forceUpdate`/`maintenanceMode`) |
| `/onboarding/language` | Language select (Step 1/4) | Progress bar + "Step 1/4 • Language"; 3 featured languages + regional chips from `GET /v1/languages`; selection persisted |
| `/onboarding/profiles` | Persona select (Step 2/4) | Multi-select grid (min 1), star-set primary; 13 personas with palette above; continue shows `Continue ({n} profiles) ➔` |
| `/auth` | Auth (Step 3/4) | Segmented **Login / Register** |
| `/auth` (login pane) | `login_form.dart` | phone → MPIN; error codes route: `USER_NOT_FOUND`/`MPIN_NOT_SET` → OTP step; `WRONG_MPIN` → red pad error. "Forgot MPIN" → phone → OTP → new MPIN sheet |
| `/register` | Register wizard (Step 3/4) | 3-step wizard: 1) Identity & Contact (name, state dropdown, phone, Firebase OTP, referral optional) 2) Security — set + confirm MPIN 3) Farm & role details (farmer page: village*, tehsil, district, land slider 0.5–25 acres, soil chips, irrigation chips, crop chips + custom) + one sub-form per selected persona (`RoleProfileForm` fields) |
| `/onboarding/farm-map` | Farm map marker (Step 4/4) | Farmer persona only. Real Google Map (same gating: map only when API key present, else honest disabled fallback — never submit synthetic data). ≥3 pins → polygon + area/perimeter → `PUT /v1/users/me/farm-boundary` |
| `/legal/:page` | Legal pages | `privacy`, `terms`, `refunds`, `community` (link targets from consents/T&C footers) |
| `/done` | Onboarding complete | Landing stub that redirects to `/`; full dashboard is **out of scope** |

**Completion criteria (mirrors mobile):** registered via `POST /v1/auth/register` (or logged in), farm boundary saved when farmer → `isOnboarded=true` → `/done`.

**Explicitly out of scope** (mobile does not include these in onboarding; backend endpoints exist but are post-onboarding in the app): KYC vault upload, bank accounts, consents, dashboard features. Do not invent screens for them.

## 4. Backend API Contract (verified against `backend/app`)

Base URL: `http://localhost:8000/v1` (dev; uvicorn port 8000 per `run.sh`). All error responses: `{"error": {"code", "message", "fieldErrors"}}`; render `fieldErrors` under fields.

**Required headers on every request:** `Accept-Language: <lang>`; `Authorization: Bearer <accessToken>` (except public paths); `Idempotency-Key: <uuid4>` on all writes.

| Step | Endpoint | Auth | Request / notes |
|---|---|---|---|
| App gate | `GET /v1/app-config?version=1.0.0&platform=web` | public | fail-open |
| Languages | `GET /v1/languages` | public | `{languages:[{code,name,englishName,...}]}` |
| OTP | **Firebase Web SDK** — `signInWithPhoneNumber` (reCAPTCHA) then `getIdToken()`; **no backend OTP endpoint exists** | client-side | web config (project `agrovercity-bafec`): apiKey `AIzaSyDj2XFY_cFr623pLTpqroxvc2noeQJNo_k`, authDomain `agrovercity-bafec.firebaseapp.com` (from `apps/mobile/lib/firebase_options.dart`) |
| Token exchange | `POST /v1/auth/firebase-verify` | public | `{idToken}` → `{accessToken, refreshToken, isNewUser, user}`; 401 `INVALID_FIREBASE_TOKEN` |
| Login | `POST /v1/auth/login` | public | `{phone, mpin}` → `AuthResponse`; 404 `USER_NOT_FOUND`, 409 `MPIN_NOT_SET`, 401 `WRONG_MPIN` |
| MPIN set | `POST /v1/auth/mpin/set` | Bearer | `{mpin}` (4 digits) |
| MPIN reset | `POST /v1/auth/mpin/reset` | public | `{idToken, newMpin}` (fresh Firebase ID token) |
| Refresh | `POST /v1/auth/refresh` | public | `{refreshToken}` → rotated pair |
| Register | `POST /v1/auth/register` | public | `{idToken, name, phone, state, district, tehsil, village, landAreaAcres, soilType, irrigationType, crops[], mpin, profiles[], primaryProfile, referralCode?, roleProfiles?, language, preferredLanguage}`; 422 fieldErrors; 400 `INVALID_REFERRAL_CODE` |
| Role sub-profiles | included above as `roleProfiles` | — | per-persona models (e.g. seller: `shopName*`, `gstNumber?`, `apmcLicense?`) — replicate mobile `RoleProfileForm` fields exactly |
| Farm boundary | `PUT /v1/users/me/farm-boundary` | Bearer | `{farmBoundaryPoints:[{lat,lng}], landAreaAcres, khasraNumber?}`; farmer only (403 otherwise) |
| Hydrate session | `GET /v1/users/me` | Bearer | re-hydrate persisted session on reload |

**Crop suggestions:** `GET /v1/regions/crops?district=<name>` (public; ~5 seeded districts) — use to prefill crop chips when the district matches; otherwise free-text custom crops exactly like mobile.

**Validation rules to mirror:** phone E.164 (mobile normalizes to `+91…`); MPIN exactly 4 digits; register requires phone in body to match Firebase-verified number; referral code has no pre-check endpoint — surface `INVALID_REFERRAL_CODE` only on register failure.

## 5. Auth & Session Architecture

1. Token pair (`accessToken` 24h / `refreshToken` 30d) stored in `localStorage` (keys `kAccessToken`/`kRefreshToken`, same as mobile).
2. Axios (or fetch wrapper) implementing mobile `api_client.dart` semantics: public-path list, header injection, idempotency key on writes, `Accept-Language` always.
3. **401 handling (mirror mobile):** single-flight refresh → `POST /auth/refresh` → retry original once (`retried` flag). If refresh fails → clear tokens → route to `/auth`.
4. Firebase phone auth on web needs `RecaptchaVerifier` rendered invisibly; SMS auto-read is Android-only, so web uses manual OTP entry with the same 30s resend countdown. Do **not** use 6-box pin UI — mobile uses a plain numeric field.
5. Login flow branching on backend error codes exactly as mobile (`USER_NOT_FOUND` → switch to register OTP; `MPIN_NOT_SET` → set-MPIN screen).

## 6. i18n

- 7 locales like mobile: `en, hi, mr, gu, pa, te, ta`; key-based JSON dictionaries, fallback chain `lang → en → hi → key` (same as mobile `tr()`).
- Language persisted pre-auth (localStorage) and sent with register payload (`language`, `preferredLanguage`); sync to backend only when authenticated.
- Mobile's audio-preview speaker buttons are mocked SnackBars — replicate as a simple "audio preview coming soon" toast, or omit; do not add fake TTS.

## 7. State Management

Zustand stores (persisted where noted):
- `useSessionStore`: tokens, user, `isNewUser` (persisted)
- `useOnboardingStore`: language, selected personas + primary, wizard draft (name/state/phone/referral/farm fields/roleProfiles), `isOnboarded` (persisted)
- Route guards read these stores (e.g., farm-map requires register completed; wizard step 3 requires step 1).

## 8. File Structure (to be created)

```
website/
├── index.html
├── vite.config.ts            # dev proxy /v1 → localhost:8000
├── .env.example              # VITE_API_BASE_URL, VITE_GOOGLE_MAPS_API_KEY
├── public/
└── src/
    ├── main.tsx, App.tsx (router + guards)
    ├── theme/tokens.css      # colors, radii, typography from §2
    ├── lib/
    │   ├── api/client.ts     # headers, error envelope, idempotency, 401-refresh single-flight
    │   ├── api/auth.ts, users.ts, reference.ts
    │   ├── firebase.ts       # web SDK init + phone auth helpers
    │   └── i18n/             # dictionaries + tr()
    ├── stores/               # zustand: session, onboarding
    ├── components/           # LabeledTextField, ChipSelector, CropSelectorField,
    │                         # MpinPad, ProgressBar, LanguageCard, PersonaCard, CTA button
    └── views/
        ├── Splash.tsx
        ├── onboarding/LanguageSelect.tsx
        ├── onboarding/ProfileSelect.tsx
        ├── auth/AuthView.tsx, LoginForm.tsx, RegisterWizard.tsx, steps/*, ForgotMpin.tsx
        ├── onboarding/FarmMap.tsx
        ├── legal/LegalPage.tsx
        └── Done.tsx
```

## 9. Implementation Steps

1. **Scaffold** — `pnpm create vite website --template react-ts`; add deps (`react-router-dom`, `zustand`, `firebase`, `axios`, `@googlemaps/js-api-loader`); wire proxy + `.env`.
2. **Tokens & shell** — `tokens.css`, 480px phone-column layout, Mukta, route skeleton with guards.
3. **API client** — error envelope, headers, idempotency, refresh single-flight; verify against `GET /v1/health` and `GET /v1/languages`.
4. **Splash + app-config gate**, **Language select** (real `/v1/languages` data), **Profile select** (13 personas, palette, primary-star).
5. **Firebase phone auth helper** (reCAPTCHA) + `/auth` login pane (phone→MPIN, error-code routing, forgot-MPIN sheet).
6. **Register wizard** — step 1 (identity+OTP+referral), step 2 (MPIN set/confirm with match feedback), step 3 (farmer farm page + per-persona sub-forms matching `role_profiles` models), submit → `POST /v1/auth/register`.
7. **Farm map** — Google Map tap-to-pin (≥3 pins), polygon area/perimeter, `PUT /users/me/farm-boundary`, honest fallback when no API key.
8. **Session restore** — on load, tokens present → `GET /users/me` hydrate; 401 → logout; `isOnboarded` → `/done`.
9. **Legal pages** (static, markdown) + i18n pass over all strings.
10. **Verification** — `pnpm build` clean; run backend (`bash run.sh` or uvicorn :8000) and exercise the full flow with a real Firebase phone number; check every error path (`WRONG_MPIN`, `INVALID_REFERRAL_CODE`, 422 field errors).

## 10. Backend Gotchas (verified)

- **OTP is Firebase-only.** Backend accepts any `idToken` starting `dev-`/`demo-` as a dev bypass — use real Firebase phone auth for the web app; do not build the bypass into the UI.
- `POST /v1/auth/quick-login` seeds demo personas — **do not use** (no mock/test data requirement).
- Register prefill demo values in mobile (village/acres/crops, "Default MPIN: 1234") must **not** be replicated.
- No endpoint exists to update `roleProfiles` after register — collect all persona fields inside the wizard.
- No state/district/tehsil master lists — state is a dropdown of the 6 states mobile uses; district/tehsil/village are free text (validated only as required strings).
- Register form's state dropdown in mobile is fixed (Maharashtra default, 6 options) — mirror that.
- CORS is open (`*`), so the Vite proxy is optional but keeps cookies/headers tidy.

## 11. Out of Scope

Dashboard, marketplace, KYC vault upload, bank accounts, consents management, notifications — all post-onboarding. This project ends at `isOnboarded=true`.
