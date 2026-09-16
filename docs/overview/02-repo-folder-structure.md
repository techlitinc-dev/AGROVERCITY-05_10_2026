# 02 — Repository & Folder Structure

## 1. Monorepo Layout

One git repository: `agrovercity/`. Top-level tree:

```
agrovercity/
├── backend/                  # FastAPI backend (Dev A)
├── apps/
│   ├── mobile/               # Flutter app: Android + iOS + Web user app (Dev B)
│   └── admin/                # Flutter Web admin console (Dev B)
├── docs/                     # this documentation set
├── infra/                    # shared infra config (Dev A)
│   ├── docker-compose.yml    # local dev: Redis (+ optional Firebase emulators)
│   ├── firebase.json         # Firebase project config (Hosting, Firestore rules/indexes)
│   ├── firestore.rules       # deny-all client access; backend-only via Admin SDK
│   ├── firestore.indexes.json# composite indexes from schema/firestore-collections.md
│   └── redis.conf            # local Redis config
├── flutter-prototype/        # READ-ONLY reference prototype (kisan_setu_app) — port from here
├── endpoints.md              # base API spec (prototype-derived)
├── endpoints.json            # machine-readable base API spec
├── features.md               # prototype feature spec
├── .gitignore                # must include: .env, backend/secrets/, google-services.json overrides
└── README.md                 # one-page repo bootstrap
```

Rule: `flutter-prototype/` is never edited. Dev B **ports** widgets and screens from it into `apps/mobile/lib/` (see `conventions/01-llm-coding-rules.md` §Flutter).

## 2. Backend Tree — `backend/`

```
backend/
├── Dockerfile
├── requirements.txt          # pinned; add packages only if the day file lists them
├── .env.example              # keys only, no values (see overview/01 §6)
├── app/
│   ├── main.py               # FastAPI app factory, router registration, middleware, /healthz
│   ├── core/
│   │   ├── config.py         # pydantic-settings: reads .env, exposes Settings singleton
│   │   ├── firebase.py       # Firebase Admin init (auth verify, FCM send, Storage bucket)
│   │   ├── redis.py          # async Redis client, key helpers from schema/redis-keys.md
│   │   ├── firestore.py      # Firestore async client + collection name constants
│   │   ├── security.py       # JWT issue/verify, MPIN bcrypt hash/verify, refresh tokens
│   │   ├── deps.py           # FastAPI dependencies: get_current_user, require_roles(...)
│   │   ├── errors.py         # error envelope helpers + exception handlers
│   │   ├── rate_limit.py     # Redis sliding-window rate limiter middleware/dep
│   │   └── idempotency.py    # Idempotency-Key middleware (Redis, 24h)
│   ├── models/               # Pydantic v2 request/response schemas, one file per domain
│   │   ├── auth.py  user.py  mandi.py  marketplace.py  transport.py  equipment.py
│   │   ├── finance.py  insurance.py  land.py  schemes.py  content.py  livestock.py
│   │   ├── tree.py  gamification.py  advisory.py  chatbot.py  admin.py  common.py
│   ├── services/             # business logic; routers stay thin (validate → service → serialize)
│   │   ├── auth_service.py   users_service.py   mandi_service.py    payments_service.py
│   │   ├── marketplace_service.py  contracts_service.py  transport_service.py
│   │   ├── equipment_service.py    finance_service.py    insurance_service.py
│   │   ├── land_service.py         schemes_service.py    content_service.py
│   │   ├── livestock_service.py    tree_service.py       gamification_service.py
│   │   ├── advisory_service.py     chatbot_service.py    admin_service.py
│   │   ├── notification_service.py # FCM fan-out
│   │   └── sync_service.py         # POST /sync replay engine
│   ├── routers/              # APIRouter per domain; prefix always /v1/<domain>
│   │   ├── auth.py           # OTP verify → JWT, login, MPIN set/verify/reset, refresh, logout, register
│   │   ├── users.py          # /users/me..., profiles link/unlink/activate, DELETE /users/me, /devices
│   │   ├── mandi.py          # /mandi/prices, vyapari-rates, compare, list
│   │   ├── marketplace.py    # /products, /cart, /orders, /payments/razorpay/*
│   │   ├── transport.py      # /transport/vehicles (+my/calendar/availability), bookings, fare
│   │   ├── equipment.py      # /equipment, slots, bookings, waitlist, /fpo/*
│   │   ├── finance.py        # /pnl/*, /diary/*, /finance/*, /water/*
│   │   ├── insurance.py      # /insurance/policies, claims, rates
│   │   ├── land.py           # /land-records/*, /land/plots, /land/leases, payments
│   │   ├── schemes.py        # /schemes, /vault/documents
│   │   ├── content.py        # /news, /channels(+chat), /workshops, /expert-talks, /videos, /blogs
│   │   ├── livestock.py      # /gaushalas, /nurseries, /vets, /dairy-products
│   │   ├── tree.py           # /tree/articles, ngos, biofuel, care-guides
│   │   ├── gamification.py   # /gamification/*, /referrals/*, /tasks/urgent/complete
│   │   ├── advisory.py       # /advisory/saturation, disease-scan, pest-radar, npk
│   │   ├── chatbot.py        # /chatbot/messages, history, handoff
│   │   ├── admin.py          # /admin/* (login, users, rates approval, content CRUD, claims, analytics)
│   │   └── misc.py           # /geo, /regions, /languages, /weather, /dashboard/home, /sync, /notifications, /women, /climate, /post-harvest, /seller/*, /broker/*, /farm/*
│   └── ws.py                 # WebSocket /ws/channels/{id} live chat (fallback: polling)
├── tests/
│   ├── conftest.py           # test app fixture, fake Firestore/Redis, auth token factory
│   ├── test_auth.py  test_users.py  test_mandi.py  test_marketplace.py  ... (one per router)
└── scripts/
    ├── seed_dev.py           # loads demo data (port from flutter-prototype mocks) into dev Firestore
    └── export_openapi.py     # writes openapi.json for Dev B mocks
```

**Where each thing goes (one line each):**

- `main.py` — wires everything; no business logic.
- `core/` — cross-cutting infrastructure: config, clients, auth plumbing, middleware.
- `models/` — Pydantic v2 schemas only; **no Firestore calls here**; every request/response body is defined here first (contract-first rule).
- `routers/` — HTTP layer: path, method, deps (auth/roles/idempotency), call one service function, return the model.
- `services/` — all Firestore/Redis/external-API logic; plain async functions, unit-testable.
- `tests/` — pytest; one file per router mirroring `routers/`.
- `scripts/` — dev utilities, never imported by `app/`.

## 3. Flutter App Tree — `apps/mobile/`

```
apps/mobile/
├── pubspec.yaml              # packages added only per day files
├── lib/
│   ├── main.dart             # entry: Firebase init, AppState, MaterialApp (light theme)
│   ├── firebase_options.dart # generated by flutterfire configure
│   ├── core/
│   │   ├── config.dart       # API_BASE_URL from --dart-define, env switch
│   │   ├── theme.dart        # light palette #F5F7FA/#FFFFFF/#43A047/#E8F5E9, Mukta font
│   │   ├── routes.dart       # route constants + persona access matrix (port of profile_routes.dart)
│   │   ├── i18n.dart         # hi/mr/gu/pa/te/ta/en string tables (port from prototype)
│   │   └── storage.dart      # shared_preferences wrapper (tokens, settings, cache)
│   ├── api/
│   │   ├── api_client.dart   # Dio: base URL, Bearer token attach, Accept-Language,
│   │   │                     # Idempotency-Key generation, error-envelope parsing, refresh retry
│   │   ├── auth_api.dart  mandi_api.dart  marketplace_api.dart  transport_api.dart
│   │   ├── equipment_api.dart  finance_api.dart  insurance_api.dart  land_api.dart
│   │   ├── schemes_api.dart  content_api.dart  livestock_api.dart  tree_api.dart
│   │   ├── gamification_api.dart  advisory_api.dart  chatbot_api.dart  users_api.dart
│   │   └── endpoints.dart    # path constants — copied ONLY from endpoints.json + gap doc
│   ├── models/               # Dart data classes; one file per entity; field names = API
│   │   └── ...               # port of flutter-prototype/lib/models/app_models.dart + new entities
│   ├── state/
│   │   └── app_state.dart    # ChangeNotifier state machine (port of prototype AppState,
│   │                         # mock data replaced by api/ calls; keeps currentRoute router)
│   ├── views/
│   │   ├── onboarding/       # splash, language, profile_select, login, register, farm_map
│   │   ├── dashboard/        # farmer_home, landlord_home, transport_home, seller_home,
│   │   │                     # equipment_owner_home, broker_home
│   │   ├── mandi/            # mandi_screen, aaj_ke_bhav_widget, smart_mandi_compare
│   │   ├── marketplace/      # products, cart, checkout, order_tracking (NEW), product_detail
│   │   ├── contracts/        # buyers_screen (contracts + vehicle booking tabs), esign_dialog
│   │   ├── transport/        # transport_dashboard, vehicle_manage (NEW), vehicle_calendar (NEW),
│   │   │                     # trip_detail (NEW)
│   │   ├── equipment/        # equipment_screen, slot_booking, machine_manage (NEW),
│   │   │                     # slot_calendar_manage (NEW)
│   │   ├── finance/          # pnl_screen, farm_diary, finance_screen, water_screen
│   │   ├── landlord/         # plot_manage (NEW), lease_manage (NEW), rent_tracking (NEW)
│   │   ├── seller/           # rate_post (NEW), inventory_manage (NEW), sales_entry (NEW)
│   │   ├── broker/           # deal_manage (NEW), lead_manage (NEW), commission_ledger (NEW)
│   │   ├── farm/             # farm_plot_manage (NEW), crop_cycle_manage (NEW)
│   │   ├── schemes/          # schemes_screen, document_vault, land_records
│   │   ├── insurance/        # insurance_screen (4 tabs), claim_form, claim_tracker
│   │   ├── content/          # news, live_channels (+chat), workshops, expert_talks, videos,
│   │   │                     # blogs, gyan_hub shell
│   │   ├── livestock/        # livestock_dairy (gaushala/nursery/vet/dairy tabs)
│   │   ├── tree/             # tree_plantation (articles/ngos/biofuel/care tabs)
│   │   ├── advisory/         # advisory_screen (5 tabs), disease_scan, pest_radar, npk_calc
│   │   ├── chatbot/          # kisan_mitra_fab, voice_assistant_sheet, chatbot_sheet
│   │   ├── gamification/     # krishi_ratna, rewards_store, refer_earn
│   │   ├── bookings/         # my_bookings (NEW, aggregated)
│   │   └── account/          # notifications (NEW), settings (NEW), help_support (NEW),
│   │                         # account_delete (NEW)
│   └── components/           # shared widgets ported from prototype: persona_banner,
│                             # metric_pill, quick_action_card, all_tools_sheet, glass_card,
│                             # audio_readout_button, offline_sync_pill, section_header
├── assets/                   # logos, fonts (Mukta), audio previews — copied from prototype
├── android/  ios/  web/      # platform targets; web/ is the user web app build
└── test/                     # widget + unit tests per day files
```

**Where each thing goes:**

- `core/` — app-wide constants and plumbing; no feature logic.
- `api/` — every HTTP call; screens never call Dio directly, only `*_api.dart` classes.
- `api/endpoints.dart` — string constants for every path; adding a path not present in `endpoints.json` or `docs/overview/03-gap-analysis-new-screens-and-endpoints.md` is forbidden.
- `models/` — plain Dart classes with `fromJson`/`toJson`; field names match the API exactly.
- `state/app_state.dart` — single source of truth, mirrors prototype structure; routes via `currentRoute` + `AnimatedSwitcher` (same as prototype — no Navigator routes).
- `views/` — one folder per feature domain; `(NEW)` folders/files are the gap-analysis screens.
- `components/` — reusable widgets; check `flutter-prototype/lib/` first and port before writing new.

## 4. Admin Console Tree — `apps/admin/`

```
apps/admin/
├── pubspec.yaml
├── lib/
│   ├── main.dart             # Firebase init, admin auth gate, MaterialApp.router
│   ├── core/                 # config, theme (neutral gray/green), auth guard
│   ├── api/                  # admin_api.dart (login, users, rates, content, claims, analytics)
│   ├── models/               # admin_user.dart, pending_rate.dart, content_item.dart, ...
│   └── views/
│       ├── login_view.dart
│       ├── dashboard_view.dart   # analytics summary cards
│       ├── users_view.dart       # user table, enable/disable
│       ├── rates_view.dart       # pending vyapari rates approve/reject queue
│       ├── content_view.dart     # CRUD: news, blogs, videos, workshops, schemes
│       └── claims_view.dart      # insurance claim review
└── web/                      # Flutter Web only; deployed to Firebase Hosting (admin site)
```

## 5. Naming Rules

- Backend files/functions: `snake_case`. Routers: plural path prefixes. Collection names: plural `snake_case` (see `schema/firestore-collections.md`).
- Flutter files/classes: files `snake_case.dart`, classes `PascalCase`, routes `camelCase` constants in `core/routes.dart` matching prototype route names exactly (e.g. `mandi`, `profitLoss`, new ones like `vehicleManage`, `myBookings`).
- New gap screens keep the prototype naming style: `<thing>_<action>.dart` in the matching `views/<domain>/` folder.
