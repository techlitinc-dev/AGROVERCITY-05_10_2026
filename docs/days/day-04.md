# Day 4 — Reference data + dashboard shell

**Dev A (Backend) goal:** Geo reverse-geocode (mock adapter), district crop mapping (8 districts), languages, and Redis-cached weather proxy endpoints are live.
**Dev B (Flutter) goal:** Farmer home dashboard shell renders with LuxuryTopBar, dock→AllToolsSheet (role-filtered), ProfileSwitcherSheet wired to the profiles API, and a live weather strip.

## Dev A — Backend tasks

### Task A1 — /v1/geo/reverse, /v1/regions/crops, /v1/languages

- **Goal:** Onboarding reference data endpoints with a swappable geo adapter.
- **Depends on:** Day 1 Task A2
- **Files to create/modify:**
  - `backend/app/services/geo.py` (new)
  - `backend/app/data/district_crops.py` (new)
  - `backend/app/data/languages.py` (new)
  - `backend/app/routers/reference.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_reference.py` (new)
- **Subtasks:**
  1. Write `backend/app/services/geo.py`:
     - `class GeoAdapter(Protocol)` with `def reverse(self, lat: float, lng: float) -> dict` returning `{ "state", "district", "region", "suggestedLanguages": [] }`.
     - `class MockGeoAdapter`: bounding-box table for 3 known districts — Nashik (lat 19.9–20.2, lng 73.6–74.1) → `{state: "Maharashtra", district: "Nashik", region: "West", suggestedLanguages: ["mr", "hi"]}`; Ludhiana (lat 30.8–31.1, lng 75.7–76.1) → `{state: "Punjab", district: "Ludhiana", region: "North", suggestedLanguages: ["pa", "hi"]}`; fallback → `{state: "Maharashtra", district: "Unknown", region: "West", suggestedLanguages: ["hi", "en"]}`.
     - Module-level `adapter: GeoAdapter = MockGeoAdapter()` so a real adapter (Google Maps / Aaple Sarkar) can be swapped in later without touching routers.
  2. Write `backend/app/data/district_crops.py` — seed the 8-district mapping (from features.md §2.3 + prototype demo data), each entry `{ "district", "kharif": [...], "rabi": [...], "suggested": [...] }`:
     - Nashik: kharif `[Onion, Tomato, Soybean]`, rabi `[Wheat, Grape, Onion]`, suggested `[Tomato, Onion, Grape]`
     - Nagpur: kharif `[Cotton, Soybean, Orange]`, rabi `[Wheat, Gram]`, suggested `[Orange, Cotton, Soybean]`
     - Ludhiana: kharif `[Rice, Maize]`, rabi `[Wheat, Potato, Mustard]`, suggested `[Wheat, Rice, Potato]`
     - Indore: kharif `[Soybean, Wheat]`, rabi `[Wheat, Gram]`, suggested `[Soybean, Wheat]`
     - Surat: kharif `[Sugarcane, Banana, Cotton]`, rabi `[Wheat]`, suggested `[Sugarcane, Banana]`
     - Pune: kharif `[Sugarcane, Onion, Bajra]`, rabi `[Wheat, Jowar]`, suggested `[Onion, Sugarcane]`
     - Jaipur: kharif `[Bajra, Mustard]`, rabi `[Mustard, Wheat]`, suggested `[Bajra, Mustard]`
     - Guntur: kharif `[Chilli, Cotton, Rice]`, rabi `[Chilli, Tobacco]`, suggested `[Chilli, Rice]`
  3. Write `backend/app/data/languages.py`: list of 7 languages, each `{ "code": "hi", "name": "हिन्दी", "englishName": "Hindi", "regions": ["North", "Central", "West"], "audioText": "नमस्ते, किसान सेतु में आपका स्वागत है" }` — fill mr/gu/pa/te/ta/en with the same greeting translated (the exact vernacular greeting string per language; English: "Namaste, welcome to Kisan Setu"). Include a `regionalMapping` object: `{ "North": ["pa", "hi"], "Central": ["hi"], "West": ["mr", "gu"], "East": [], "NorthEast": [], "South": ["te", "ta"] }`.
  4. Write `backend/app/routers/reference.py` (`router = APIRouter(tags=["reference"])`):
     - `GET /geo/reverse?lat=&lng=` → `adapter.reverse(lat, lng)`. Public.
     - `GET /regions/crops?district=` → case-insensitive lookup in `district_crops`; unknown district → 200 with `{ "district": <q>, "kharif": [], "rabi": [], "suggested": [] }` (empty lists, NOT 404 — the UI must still work).
     - `GET /languages` → `{ "languages": [...], "regionalMapping": {...} }`. Public.
  5. Include router in `app/main.py` with prefix `/v1`.
  6. Write `backend/tests/test_reference.py`:
     - `test_reverse_geocode_nashik`: `lat=20.0&lng=73.8` → `district == "Nashik"`, `suggestedLanguages == ["mr", "hi"]`.
     - `test_reverse_geocode_fallback`: `lat=10.0&lng=10.0` → `suggestedLanguages == ["hi", "en"]`.
     - `test_regions_crops_nashik`: `suggested` contains `Tomato` and `Onion`.
     - `test_regions_crops_unknown_district`: → 200 with empty lists.
     - `test_languages_seven_entries`: `len(languages) == 7`, each has `audioText`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_reference.py -v`
- **Expected output:** `5 passed`.

### Task A2 — GET /v1/weather (Redis-cached proxy)

- **Goal:** Weather strip endpoint with 30-minute cache so the dashboard doesn't hammer the upstream API.
- **Depends on:** Day 1 Task A2 (cache helper)
- **Files to create/modify:**
  - `backend/app/services/weather.py` (new)
  - `backend/app/routers/weather.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_weather.py` (new)
- **Subtasks:**
  1. Write `backend/app/services/weather.py`:
     - `async def fetch_weather(lat: float, lng: float) -> dict`: if `settings.weather_api_key` is empty, return the dev fixture `{ "tempC": 31, "rainProbability": 40, "condition": "Partly Cloudy", "radarAvailable": True, "forecast": [{"day": "Today", "tempC": 31, "rainProbability": 40}, {"day": "Tomorrow", "tempC": 30, "rainProbability": 55}] }`. Otherwise call OpenWeather `https://api.openweathermap.org/data/2.5/weather?lat=&lng=&appid=&units=metric` via `httpx.AsyncClient` and map the response into the same shape (5-day forecast optional today — return the 2-entry shape).
  2. Write `backend/app/routers/weather.py` (`router = APIRouter(tags=["weather"])`):
     - `GET /weather?lat=&lng=` (auth required). Cache key: `weather:{round(lat,1)}:{round(lng,1)}`. On hit → return cached JSON. On miss → `fetch_weather`, `cache_set(key, json.dumps(data), ttl_seconds=1800)`, return.
  3. Include in `app/main.py` under `/v1`.
  4. Write `backend/tests/test_weather.py`:
     - `test_weather_shape`: GET with auth → keys `tempC, rainProbability, condition, radarAvailable, forecast` present.
     - `test_weather_caches`: monkeypatch `fetch_weather` with a counter; call twice with same coords → counter == 1; call with different lat → counter == 2. (Use the in-process Redis if available, else monkeypatch `cache_get/cache_set` with an in-memory dict — pick the in-memory patch so the test never needs Redis.)
     - `test_weather_requires_auth`: no header → 401.
- **Test:** `cd backend && .venv/bin/pytest tests/test_weather.py -v`
- **Expected output:** `3 passed`.

## Dev B — Flutter tasks

### Task B1 — Home dashboard shell: top bar + dock + All Tools sheet

- **Goal:** The farmer home shell renders with navigation chrome, and All Tools is filtered by the active profile's ACL.
- **Depends on:** Day 3 Task B2 (login lands on dashboard). API dependency: Day 3 Task A2 (profiles) for switcher wiring in B2.
- **Files to create/modify:**
  - `apps/mobile/lib/views/home_view.dart` (modify — ported Day 1; wire)
  - `apps/mobile/lib/views/profile_home/farmer_home_view.dart` (modify — port then wire)
  - `apps/mobile/lib/components/layout/luxury_top_bar.dart` (verify ported)
  - `apps/mobile/lib/components/navigation/apple_plank_dock.dart` (verify ported)
  - `apps/mobile/lib/components/navigation/all_tools_sheet.dart` (modify — role filter)
  - `apps/mobile/lib/state/profile_routes.dart` (verify — the client ACL)
- **Subtasks:**
  1. Confirm `farmer_home_view.dart` renders inside `home_view.dart` when `AppState.currentRoute == 'home'` (prototype behaviour — keep it).
  2. `LuxuryTopBar`: back button, brand, village name (from `AppState.currentUser['village']` — fall back to demo value if null), spray-alert capsule, AgriCoins pill (from `currentUser['agriCoins']`), logout icon → `SessionStore.clear()` + back to `auth` onboarding step.
  3. `ApplePlankDock` center button opens `AllToolsSheet` (blurred bottom sheet, 3-column grid).
  4. In `all_tools_sheet.dart`: filter the tools grid through `ProfileRoutes.routesFor(AppState.activeProfile)` — inaccessible modules must not render at all (not greyed). Highlight the current route tile.
  5. Wire tile taps to `AppState.navigateTo(route)`; add a guard in `navigateTo`: if route not in `ProfileRoutes.routesFor(activeProfile)`, ignore and show toast `यह मॉड्यूल इस प्रोफाइल में उपलब्ध नहीं है`.
  6. Manual matrix check: switch active profile (via the debug approach of calling `AppState` directly or the switcher from B2) and confirm e.g. seller sees mandi/marketplace/buyers but NOT water/advisory/fpo.
- **Test:** `cd apps/mobile && flutter analyze` + manual checklist:
  1. Farmer active → All Tools shows ≥ 20 tiles including Water, FPO, Crop Insurance.
  2. Seller active → All Tools shows exactly: mandi, marketplace, buyers, profitLoss, finance, postHarvest, treePlantation, agriNews, referEarn, krishiRatna, gyanHub (11 tiles + home variants per the ACL map).
  3. Tapping a tile navigates and highlights on reopen.
- **Expected output:** `No issues found!`; the 3 manual checks pass.

### Task B2 — ProfileSwitcherSheet wired + weather strip live

- **Goal:** Profile switcher calls the real profiles API; weather strip calls `/v1/weather`.
- **Depends on:** Day 4 Task B1; Day 3 Task B1 (api client). API dependency: Day 3 Task A2 (profiles endpoints), Day 4 Task A2 (weather).
- **Files to create/modify:**
  - `apps/mobile/lib/components/navigation/profile_switcher_sheet.dart` (modify — wire)
  - `apps/mobile/lib/components/navigation/dashboard_profile_switcher_bar.dart` (modify — wire)
  - `apps/mobile/lib/api/user_api.dart` (modify — ensure profile methods exist from Day 3)
  - `apps/mobile/lib/api/weather_api.dart` (new)
  - `apps/mobile/lib/views/profile_home/farmer_home_view.dart` (modify — weather strip)
  - `apps/mobile/test/profile_switcher_test.dart` (new)
- **Subtasks:**
  1. `apps/mobile/lib/api/weather_api.dart`: `Future<Map<String, dynamic>> getWeather(double lat, double lng)` → GET `/weather?lat=&lng=`.
  2. Weather strip in `farmer_home_view.dart`: on init, call `getWeather` with farm-boundary centroid if available else Nashik default `(20.0, 73.8)`; render `tempC`, `rainProbability` %, and the "Rain Radar" pulsing badge when `radarAvailable == true`; on error show cached/static fallback `31° • 40% rain` with a small "offline" tag. Keep the prototype's animated styling.
  3. `profile_switcher_sheet.dart`: replace demo data with `AppState.currentUser['linkedProfiles']`; tapping a linked profile → `userApi.activateProfile(type)` → update `AppState.activeProfile` + `currentUser` → `AppState.navigateTo(result['defaultHomeRoute'])` → Hindi toast `प्रोफाइल बदली गई`. Already-linked entries shown greyed with check (prototype styling kept).
  4. "Add role" entry → list of unlinked profile types → `userApi.linkProfile(type)` → refresh sheet.
  5. Long-press (or the sheet's unlink affordance from the prototype) → confirm dialog → `userApi.unlinkProfile(type)` → on `ApiException(code: 'LAST_PROFILE')` show the server message `कम से कम एक प्रोफाइल आवश्यक है` as a toast, do not close the sheet.
  6. `dashboard_profile_switcher_bar.dart`: horizontal chip row of linked profiles + "add role" chip, same API calls as the sheet; active profile chip highlighted with its persona color.
  7. `apps/mobile/test/profile_switcher_test.dart`:
     - `testWidgets('sheet lists linked profiles from state', ...)` — seed a fake `AppState.currentUser` with `linkedProfiles: ['farmer', 'seller']`; pump the sheet; expect farmer + seller cards and an "add role" entry.
     - `testWidgets('tapping a profile calls activate', ...)` — inject a fake `UserApi` (constructor-inject or use a simple service-locator override); tap seller; assert fake recorded `activateProfile('seller')`.
     - `testWidgets('LAST_PROFILE error shows toast and keeps sheet open', ...)` — fake throws `ApiException(code: 'LAST_PROFILE', message: 'कम से कम एक प्रोफाइल आवश्यक है')`; attempt unlink; expect `find.textContaining('कम से कम')` and sheet still present.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/profile_switcher_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass. Manual: dashboard header capsule opens the switcher; switching to seller routes to `sellerHome`; weather strip shows `31°` from the dev backend.

## Done-when checklist (end of day)

- [ ] `curl "http://localhost:8000/v1/geo/reverse?lat=20.0&lng=73.8"` → Nashik + `["mr","hi"]`.
- [ ] `curl "http://localhost:8000/v1/regions/crops?district=Nashik"` → suggested `[Tomato, Onion, Grape]`; unknown district returns empty lists with 200.
- [ ] `curl http://localhost:8000/v1/languages` → 7 languages with `audioText`.
- [ ] `GET /v1/weather` returns the strip payload and a second identical call is served from Redis (counter test green).
- [ ] `cd backend && .venv/bin/pytest -v` → full suite green.
- [ ] All Tools sheet hides modules the active profile cannot access (manual matrix check).
- [ ] Profile switcher activates/unlinks via API, handles 409 `LAST_PROFILE` with the Hindi message.
- [ ] Weather strip on farmer home shows live data from the backend.
- [ ] `cd apps/mobile && flutter analyze` → 0 issues; `flutter test` all green.
