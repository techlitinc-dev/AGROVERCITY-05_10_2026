# AGROVERCITY / Kisan Setu — Development Documentation

**Project:** Rebuild the AGROVERCITY "Kisan Setu" (किसान सेतु) farming super-app as a production system.
**Timeline:** 15 working days · **Team:** exactly 2 developers · **Stack:** FastAPI + Firebase + Firestore + Redis + Flutter.

AGROVERCITY is a smart-agriculture super app for India: a farmer-facing app plus five adjacent agri-business personas (landlord, transporter, seller/vyapari, equipment owner, broker), with 24 feature modules — mandi prices, marketplace, contracts, equipment slots, crop insurance, schemes, Kisan Mitra AI assistant, and more. The prototype exists as a Flutter app (`flutter-prototype/`, package `kisan_setu_app`) with all data mocked; this documentation set is the complete specification for rebuilding it with a real backend and shipping it.

These docs are written to be executed by an LLM coding assistant. Every task file is explicit: exact paths, exact commands, numbered subtasks, copy-paste-ready snippets. Read the conventions docs before generating any code.

---

## 1. Deliverables

| # | Deliverable | Source / Target | Deploy target |
|---|---|---|---|
| 1 | **Android app** — Flutter, port of `flutter-prototype/` | `apps/mobile/` | Google Play Store (internal track, Day 15) |
| 2 | **User-facing web app** — Flutter Web build of the same codebase | `apps/mobile/` (web target) | Firebase Hosting |
| 3 | **Admin console** — separate small Flutter Web app | `apps/admin/` | Firebase Hosting |
| 4 | **Backend API** — FastAPI (Python 3.12) | `backend/` | Google Cloud Run |

## 2. Team Split

| Dev | Owns | Folders |
|---|---|---|
| **Dev A — Backend** | FastAPI, Firebase Admin (Auth verify, FCM, Storage), Firestore, Redis, Razorpay, OpenRouter, Sarvam AI, deploys | `backend/`, `infra/` |
| **Dev B — Flutter** | Mobile app, web build, admin console, all UI | `apps/mobile/`, `apps/admin/` |

Coordination rules (contract-first, mock via OpenAPI) are in `conventions/03-git-and-collaboration.md`.

## 3. Document Index

### Overview
| File | Contents |
|---|---|
| `overview/01-product-and-architecture.md` | Product summary, system architecture, request lifecycle, environments, secrets |
| `overview/02-repo-folder-structure.md` | Monorepo layout, backend and Flutter folder trees, where every file goes |
| `overview/03-gap-analysis-new-screens-and-endpoints.md` | **Authoritative extension of `endpoints.md`** — 18 new screens and ~35 new endpoints with full request/response bodies; Parts C–D add the missing.md audit items (screens 23–69, endpoints for lots/bank accounts/settlements/chat/consent/speech/admin) |
| `overview/04-persona-screen-matrix.md` | 6 personas × dashboards/modules/new-manage-screens matrix (incl. §3b missing.md screens) |
| `overview/05-missing-features-traceability.md` | Traceability for the second gap audit: every missing.md item ID → status → spec section → scheduled day (or deferred v1.x) |

**Gap audits.** Two audits feed the spec: the first is folded into `overview/03` Parts A–B; the second lives at the repo root as `missing.md` (item IDs F/L/T/S/E/B/X/A) and is specced in `overview/03` Parts C–D, with scheduling tracked in `overview/05-missing-features-traceability.md`. Day files absorb these as an "Additional tasks (from missing.md)" section; P2 items are out of the 15-day scope.

### Conventions
| File | Contents |
|---|---|
| `conventions/01-llm-coding-rules.md` | Rules for the LLM writing the code — read first, apply always |
| `conventions/02-api-conventions.md` | Base URL, auth flow, headers, envelopes, error format, date/money formats, versioning |
| `conventions/03-git-and-collaboration.md` | 2-dev git workflow, contract-first rule, PR/daily-sync process |

### Data schema
| File | Contents |
|---|---|
| `schema/firestore-collections.md` | Firestore schema for every collection: document IDs, fields, indexes, security rules |
| `schema/redis-keys.md` | Every Redis key pattern: TTLs, purposes, value shapes |

### Day plan (one task file per day)
| File | Day | Focus |
|---|---|---|
| `days/day-01.md` | 1 | Foundation: repo, FastAPI skeleton, Firebase/Redis init; Flutter skeleton, theme, packages |
| `days/day-02.md` | 2 | Auth backend (Firebase ID token → JWT, MPIN set/verify/reset); onboarding UI |
| `days/day-03.md` | 3 | Profile/registration API; auth screens, register wizard, farm map, API client |
| `days/day-04.md` | 4 | Reference/geo/weather API; dashboard shell + navigation |
| `days/day-05.md` | 5 | Mandi prices + vyapari rates (Redis 2h cache) + seller rate-posting; mandi screens |
| `days/day-06.md` | 6 | Marketplace + Razorpay; marketplace/cart/checkout/order-tracking screens |
| `days/day-07.md` | 7 | Contracts/e-sign + transport; buyers, transporter dashboard, vehicle-manage/calendar |
| `days/day-08.md` | 8 | Equipment slot engine + FPO pools; equipment, machine-manage, slot-calendar screens |
| `days/day-09.md` | 9 | Diary, P&L, finance + landlord plots/leases/rent; those screens + landlord manage |
| `days/day-10.md` | 10 | Schemes, document vault, land records, water; notifications/settings/help/account-delete |
| `days/day-11.md` | 11 | Insurance (policies, claims, tracker); insurance screens + my-bookings |
| `days/day-12.md` | 12 | Content (news, channels+chat, workshops, talks, videos, blogs), livestock/dairy, tree |
| `days/day-13.md` | 13 | Chatbot (OpenRouter+Sarvam), advisory, gamification, referrals, FCM |
| `days/day-14.md` | 14 | Women hub, climate, post-harvest, sync, admin APIs; Flutter Web build + admin console |
| `days/day-15.md` | 15 | Hardening + deploy + end-to-end test checklist |

### Testing & deployment
| File | Contents |
|---|---|
| `testing/test-strategy.md` | Unit/integration/e2e strategy, per-day Test commands, coverage expectations |
| `deployment/backend-deploy.md` | Cloud Run deploy: Dockerfile, env vars, secrets, CI |
| `deployment/web-deploy.md` | Firebase Hosting deploys for Flutter Web app + admin console |
| `deployment/playstore-deploy.md` | Play Store internal track: signing, listing, data-safety form |

## 4. 15-Day Calendar

| Day | Dev A (Backend) | Dev B (Flutter) |
|---|---|---|
| 1 | Repo init, FastAPI skeleton, Firebase Admin + Redis init, docker-compose | Flutter skeleton, theme, package selection, prototype asset port |
| 2 | Auth: Firebase ID-token verify → JWT issue, MPIN set/verify/reset, OTP counters | Splash, language select, profile select, login/MPIN screens |
| 3 | Registration + profile CRUD + multi-profile link/switch API | Auth wiring, register wizard, farm map screen, API client (Dio) |
| 4 | Reference data: geo reverse, district crops, languages, weather proxy | Dashboard shell, navigation guard, persona switcher, route access matrix |
| 5 | Mandi prices + vyapari rates with 2h Redis cache; `POST /seller/rates` | Mandi screen, Aaj ke Bhav widget, seller rate-post screen |
| 6 | Marketplace + cart + orders + Razorpay order/verify | Marketplace, cart, checkout, order-tracking screens |
| 7 | Contracts + e-sign; transport: vehicle CRUD, bookings, calendar, availability | Buyers screen, transporter dashboard, vehicle-manage, vehicle-calendar, trip-detail |
| 8 | Equipment slot engine (2/day rule, waitlist), slot templates, FPO pools | Equipment booking, machine-manage, slot-calendar-manage screens |
| 9 | Diary, P&L, finance; landlord plots/leases/rent-payments API | Diary/P&L/finance screens; landlord plot-manage, lease-manage, rent-tracking |
| 10 | Schemes, vault (Storage), land records proxy, water | Schemes/vault/land/water screens; notifications, settings, help, account-delete |
| 11 | Insurance policies, claims (photos), premium rates, tracker | Insurance 4-tab screen, my-bookings (aggregated) screen |
| 12 | Content: news, channels + chat, workshops, talks, videos, blogs; livestock/dairy; tree | All content screens, livestock/dairy, tree screens |
| 13 | Chatbot (OpenRouter + Sarvam STT, Redis session), advisory, gamification, referrals, FCM | Kisan Mitra FAB/sheets/chat, advisory 5 tabs, rewards, refer-and-earn |
| 14 | Women hub, climate, post-harvest, `/sync`, admin APIs + admin auth | Remaining screens, Flutter Web build, admin console app |
| 15 | Hardening (rate limits, logging), Cloud Run deploy, e2e checklist | Web deploys, Play Store internal track, e2e checklist |

## 5. How to Use These Docs with an LLM

The implementation LLM is less capable than the planner. Follow these rules to keep it on rails:

1. **One task per prompt.** A "task" is one numbered subtask in a day file (e.g. "Day 5, Task 5.2: implement GET /mandi/prices"). Never paste a whole day and ask for everything at once.
2. **Always paste the task file into the prompt.** The LLM has no memory between sessions. Every prompt must include: (a) the relevant `days/day-NN.md` section, (b) `conventions/01-llm-coding-rules.md`, (c) `conventions/02-api-conventions.md` when touching the API, (d) the relevant schema section from `schema/` when touching data.
3. **Never invent endpoints or fields.** The only sources of truth for the API surface are `endpoints.json` + `endpoints.md` (repo root) and `overview/03-gap-analysis-new-screens-and-endpoints.md` (the authoritative extension). If a needed endpoint exists in neither, stop and add it to the gap-analysis doc first, then implement.
4. **Run the Test command after every task.** Every task in the day files ends with an explicit `Test:` command. Run it, paste the output into the chat, and do not proceed to the next task until it passes.
5. **If a test fails, fix before moving on.** Never skip a red test, never comment out assertions, never weaken a test to make it pass.
6. **Contract-first across the dev split.** Dev A merges API stubs (routes + Pydantic schemas, returning mock data) before Dev B wires the matching screen. Dev B mocks against the OpenAPI spec (`GET /openapi.json`) until the real implementation lands. See `conventions/03-git-and-collaboration.md`.
