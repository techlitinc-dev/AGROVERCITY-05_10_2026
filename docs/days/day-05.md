# Day 5 — Mandi

**Dev A (Backend) goal:** Mandi prices, vyapari rates (2h cache), smart-mandi compare, mandi directory, and new vyapari seller-rate posting endpoints work against seeded Firestore data — plus produce-lots CRUD, a rate sanity band on rate posting, and mandi price history.
**Dev B (Flutter) goal:** Mandi screen, "Aaj ke Bhav" home widget, and the smart-mandi compare calculator run on live API data — plus the sell-produce flow and a price-history chart.

## Dev A — Backend tasks

### Task A1 — /v1/mandi/prices + /v1/mandi/list + seed script

- **Goal:** Firestore-backed mandi price listing with crop filter, seeded from prototype demo data.
- **Depends on:** Day 1 Task A2 (db helper), Day 2 (auth/roles)
- **Files to create/modify:**
  - `backend/app/models/mandi.py` (new)
  - `backend/app/routers/mandi.py` (new)
  - `backend/scripts/seed_mandi.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_mandi.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/mandi.py`:
     - `class MandiPriceOut(BaseModel)`: `id: str`, `mandiName: str`, `distanceKm: float`, `commodity: str`, `variety: str`, `minPrice: float`, `maxPrice: float`, `modalPrice: float`, `msp: float`, `trend: str` (`up|down|flat`), `changePercent: str`, `arrivalsQuintals: int`, `updatedAt: str`
  2. Write `backend/scripts/seed_mandi.py` — inserts the 4 `dummyMandiPrices` records from `flutter-prototype/lib/data/demo_data.dart` (lines ~96–160) into Firestore collection `mandi_prices`:
     - `mandi-1` Pimpalgaon Baswant APMC, 4.2 km, Tomato (टमाटर), Hybrid Red, 1600/2250/1950, msp 1400, up, +8.4%, 2400 q, "10 mins ago"
     - `mandi-2` Nashik (Dindori Road) APMC, 18.5 km, Tomato (टमाटर), Abhinav Grade A, 1750/2400/2150, msp 1400, up, +12.1%, 4800 q, "25 mins ago"
     - `mandi-3` Lasalgaon APMC, 28.0 km, Onion (प्याज), Garwa Red, 1800/2380/2120, msp 1750, down, -3.2%, 18500 q, "15 mins ago"
     - `mandi-4` Vashi (Navi Mumbai) Terminal, 165.0 km, Tomato (टमाटर), Premium Crate, 2200/2900/2650, msp 1400, up, +15.0%, 12000 q, "1 hour ago"
     - Also seed a `mandis` collection for the directory: `{ id, name, district, state, lat, lng }` — the 4 mandis above (Nashik district, Maharashtra; Vashi: Navi Mumbai) with approximate coords.
     - Run with: `cd backend && .venv/bin/python scripts/seed_mandi.py` (use the same `app.core.db` helper; print `seeded 4 mandi_prices, 4 mandis`).
  3. Write `backend/app/routers/mandi.py` (`router = APIRouter(prefix="/mandi", tags=["mandi"])`, auth required, roles farmer/seller/broker — enforce via `require_role` from Day 3):
     - `GET /prices?crop=&district=&lat=&lng=&page=&pageSize=`: query `mandi_prices`; if `crop` given, filter `commodity` contains crop (case-insensitive; match on the English part, e.g. `crop=tomato` matches "Tomato (टमाटर)"). Return the pagination envelope `{ "data": [...], "page": 1, "pageSize": 20, "total": N }`.
     - `GET /list`: return `{ "data": [...] }` from the `mandis` collection (name, district, state).
  4. Include in `app/main.py` under `/v1`.
  5. Write `backend/tests/test_mandi.py` (patch `app.core.db.query` with in-memory lists seeded with the 4 records):
     - `test_prices_returns_all`: 4 items in envelope, `total == 4`.
     - `test_prices_crop_filter_tomato`: `?crop=tomato` → 3 items, none contain "Onion".
     - `test_prices_forbidden_role`: user with `activeProfile == "transport"` → 403 `FORBIDDEN_ROLE`.
     - `test_mandi_list`: 4 mandis with names.
- **Test:** `cd backend && .venv/bin/pytest tests/test_mandi.py -v && .venv/bin/python scripts/seed_mandi.py && curl -s -H "Authorization: Bearer <token>" "http://localhost:8000/v1/mandi/prices?crop=tomato"`
- **Expected output:** `4 passed`; seed prints `seeded 4 mandi_prices, 4 mandis`; curl returns 3 tomato records in the pagination envelope.

### Task A2 — /v1/mandi/vyapari-rates + /v1/mandi/compare + seller rate posting

- **Goal:** "Aaj ke Bhav" feed with Redis cache, net-profit compare calculator, and vyapari self-posting of rates.
- **Depends on:** Day 5 Task A1
- **Files to create/modify:**
  - `backend/app/models/mandi.py` (modify)
  - `backend/app/routers/mandi.py` (modify)
  - `backend/app/routers/seller.py` (new)
  - `backend/tests/test_vyapari.py` (new)
- **Subtasks:**
  1. Add models in `backend/app/models/mandi.py`:
     - `class VyapariRateOut(BaseModel)`: `id`, `crop: str`, `rateDisplay: str`, `priceChange: str`, `changeDir: str` (`up|down|flat`), `mandiName: str`, `vyapariCount: int`, `lastUpdated: str`
     - `class CompareResultItem(BaseModel)`: `mandiName: str`, `modalPrice: float`, `transportCost: float`, `netProfit: float`
     - `class SellerRateRequest(BaseModel)`: `crop: str`, `ratePerKg: float`, `mandiName: str`
  2. Seed the 3 `dummyVyapariRates` from demo_data (lines ~533–560) into collection `vyapari_rates` — extend `scripts/seed_mandi.py` (vyapari-1 Tomato ₹24/kg up ₹2 Nashik Mandi 3 vyapari; vyapari-2 Onion ₹18/kg down ₹1 Pimpalgaon Mandi 5; vyapari-3 Wheat ₹2,100/qtl flat 0 Lasalgaon Mandi 4).
  3. `GET /mandi/vyapari-rates?crops=` (roles farmer/seller/broker):
     - Redis cache key `vyapari_rates:{crops or 'all'}`, TTL 7200 s (2 h).
     - If `crops` given (comma-separated), filter.
     - Response `{ "data": [VyapariRateOut...], "cachedAt": <iso> }`.
  4. `GET /mandi/compare?crop=&quantityQuintals=&lat=&lng=`:
     - Take all `mandi_prices` matching crop; `transportCost = distanceKm * 12` (₹12/km flat dev rate); `netProfit = modalPrice * quantityQuintals - transportCost`.
     - Return `{ "data": [CompareResultItem...] }` sorted by `netProfit` descending. `quantityQuintals` must be > 0 → else 422 `INVALID_QUANTITY`.
  5. Write `backend/app/routers/seller.py` (`router = APIRouter(prefix="/seller", tags=["seller"])`, role seller):
     - `POST /rates`: body `SellerRateRequest`; store in `vyapari_rates_pending` with `{ ..., "sellerId": uid, "status": "pending", "createdAt": iso }`; return the created doc with `status: "pending"`. Invalidate the `vyapari_rates:*` Redis keys only when status flips to approved (approval flow is out of scope — document with a comment).
     - `GET /rates/my`: return `{ "data": [...] }` of this seller's posted rates (pending + approved).
  6. Write `backend/tests/test_vyapari.py`:
     - `test_vyapari_rates_shape`: 3 seeded rates, `changeDir` in `{up, down, flat}`.
     - `test_vyapari_rates_cached`: monkeypatched counter on the Firestore query → two calls, counter == 1 (use in-memory cache patch like Day 4 weather).
     - `test_compare_ranks_by_net_profit`: crop=tomato, quantityQuintals=10 → first item has the highest `netProfit`; assert `transportCost == distanceKm * 12` for each.
     - `test_compare_invalid_quantity`: `quantityQuintals=0` → 422.
     - `test_seller_post_rate_pending`: seller posts `{crop: "Tomato", ratePerKg: 25, mandiName: "Nashik Mandi"}` → 200, `status == "pending"`; `GET /seller/rates/my` contains it.
     - `test_seller_rate_forbidden_for_farmer`: farmer posts → 403.
- **Test:** `cd backend && .venv/bin/pytest tests/test_vyapari.py -v`
- **Expected output:** `6 passed`.

## Dev B — Flutter tasks

### Task B1 — Mandi view wired to API

- **Goal:** Port `mandi_view.dart` and feed it from `/v1/mandi/prices`.
- **Depends on:** Day 3 Task B1 (api client). API dependency: Day 5 Task A1 (same day — Dev A finishes A1 before Dev B's manual test; Dev B can build against seeded dev server or mock first).
- **Files to create/modify:**
  - `apps/mobile/lib/api/mandi_api.dart` (new)
  - `apps/mobile/lib/views/mandi_view.dart` (modify — port from `flutter-prototype/lib/views/mandi_view.dart`, replace demo data)
  - `apps/mobile/test/mandi_view_test.dart` (new)
- **Subtasks:**
  1. `apps/mobile/lib/api/mandi_api.dart`: `getPrices({String? crop, int page = 1})` → GET `/mandi/prices`; `getVyapariRates({List<String>? crops})` → GET `/mandi/vyapari-rates`; `compare(String crop, double quantityQuintals, double lat, double lng)` → GET `/mandi/compare`; `getMandiList()` → GET `/mandi/list`.
  2. In `mandi_view.dart`: keep the prototype layout — crop filter chips (All / Tomato / Onion / Wheat), price cards (mandi name, distance, updated time, commodity/variety, modal/min/max, MSP, arrivals, trend arrow + %), audio readout button per card.
  3. Replace the `dummyMandiPrices` source: on init and on chip tap, call `mandiApi.getPrices(crop: selected == 'All' ? null : selected)`; store results in local state; loading shimmer while fetching; on `ApiException` show a retry banner with the cached demo data greyed out (offline intent).
  4. Audio button: keep as stub (icon present, tap shows snackbar `ऑडियो जल्द आ रहा है`) — real TTS is a later day.
  5. `apps/mobile/test/mandi_view_test.dart`:
     - `testWidgets('renders price cards from API', ...)` — fake `MandiApi` returning 2 records; pump; expect both mandi names visible and modal price text e.g. `₹1,950`.
     - `testWidgets('crop chip filters request', ...)` — tap Onion chip; assert fake api recorded `crop == 'Onion'`.
     - `testWidgets('error shows retry banner', ...)` — fake throws `ApiException(code: 'NETWORK_ERROR')`; expect retry banner visible.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/mandi_view_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass. Manual (dev backend running + seeded): mandi screen shows 4 cards; Tomato chip narrows to 3.

### Task B2 — "Aaj ke Bhav" widget + smart-mandi compare calculator

- **Goal:** Home widget shows live vyapari rates; compare calculator ranks mandis by net profit.
- **Depends on:** Day 5 Task B1. API dependency: Day 5 Task A2.
- **Files to create/modify:**
  - `apps/mobile/lib/views/profile_home/farmer_home_view.dart` (modify — wire Aaj ke Bhav widget)
  - `apps/mobile/lib/views/mandi_view.dart` (modify — add compare section) or `apps/mobile/lib/components/mandi/smart_compare_sheet.dart` (new — preferred, keeps the view small)
  - `apps/mobile/test/aaj_ke_bhav_test.dart` (new)
- **Subtasks:**
  1. In `farmer_home_view.dart`, locate the "Aaj ke Bhav" widget (animated equalizer waveform card from the prototype). Replace its demo list with `mandiApi.getVyapariRates(crops: currentUser.activeCrops)`:
     - Per crop: `rateDisplay`, `priceChange` with up/down/flat arrow color (green/red/grey), `mandiName`, `N vyapari updated` from `vyapariCount`, `lastUpdated`.
     - On network error: show the last cached list (cache the raw response in `shared_preferences` key `kVyapariCache` with timestamp) and append `(cached <time>)` — per features.md §4 item 7.
     - Tap → `AppState.navigateTo('mandi')`.
  2. New `apps/mobile/lib/components/mandi/smart_compare_sheet.dart`:
     - Bottom sheet: crop dropdown (Tomato/Onion/Wheat), produce-quantity slider 1–100 quintals, "Compare" button.
     - On compare: `mandiApi.compare(...)` → ranked list rows: mandi name, modal price ₹/qtl, transport cost ₹, **net profit ₹** bold; rank #1 row highlighted with `AppColors.accent` background and a "Best net profit" badge.
     - Opened from a "Smart Mandi Selection" button in `mandi_view.dart` header.
  3. `apps/mobile/test/aaj_ke_bhav_test.dart`:
     - `testWidgets('widget renders vyapari rates', ...)` — fake api returns 2 rates; pump `farmer_home_view.dart`'s Aaj-ke-Bhav section (extract to a widget if needed); expect `₹24/kg` and `Nashik Mandi` visible.
     - `testWidgets('falls back to cache on error', ...)` — `SharedPreferences.setMockInitialValues` with a cached payload; fake api throws; expect cached rate text + `cached` tag.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/aaj_ke_bhav_test.dart` + manual: open compare sheet, quantity 10 q, Tomato → Pimpalgaon ranks above Vashi.
- **Expected output:** `No issues found!`; 2 tests pass; manual check confirms ranking matches backend (nearest mandi wins on net profit).

## Additional tasks (from missing.md)

### Task A3 — Produce lots CRUD (`/v1/market/lots`)

- **Goal:** A farmer can post his own harvested lot for sale; lots later feed broker deals and seller procurement. Spec: `docs/overview/03 … Part C/D item F7`.
- **Depends on:** Day 5 Task A1
- **Files to create/modify:**
  - `backend/app/models/lots.py` (new)
  - `backend/app/routers/lots.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_lots.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/lots.py`:
     - `class LotRequest(BaseModel)`: `crop: str`, `quantityQuintals: float` (must be > 0), `expectedRate: int` (whole rupees per quintal, ≥ 0 — money is integer rupees, conventions §8), `harvestDate: str` (YYYY-MM-DD), `photos: list[str] = []` (Firebase Storage URLs), `location: dict` (`{lat, lng}`)
     - `class LotOut(LotRequest)`: adds `id: str`, `farmerId: str`, `status: str` (`open|sold|withdrawn`), `createdAt: str`
  2. Write `backend/app/routers/lots.py` (`router = APIRouter(prefix="/market", tags=["lots"])`, role farmer):
     - `POST /lots` → 201 with `LotOut`, `status: "open"`, `farmerId: uid`.
     - `GET /lots?status=&page=&pageSize=` → the caller's own lots only (`farmerId == uid`), optional status filter, pagination envelope.
     - `PUT /lots/{id}` → owner-only; absent or not owned → 404 `LOT_NOT_FOUND`; a `sold` lot → 409 `LOT_NOT_EDITABLE`; apply LotRequest fields, return updated.
     - `DELETE /lots/{id}` → soft-withdraw: set `status: "withdrawn"` (keep the record — broker deals may reference it); `sold` → 409 `LOT_NOT_EDITABLE`; return `{ "ok": true, "status": "withdrawn" }`.
  3. Include in `app/main.py` under `/v1`.
  4. Write `backend/tests/test_lots.py`:
     - `test_create_lot`: → 201, `status == "open"`.
     - `test_list_own_lots_only`: seed another farmer's lot → list returns only the caller's.
     - `test_update_lot`: PUT new `quantityQuintals` → reflected.
     - `test_withdraw_lot`: DELETE → `status == "withdrawn"`; excluded from `?status=open`.
     - `test_update_other_farmers_lot_404`.
     - `test_edit_sold_lot_409`: force `status: "sold"` in the seed → PUT and DELETE both → 409 `LOT_NOT_EDITABLE`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_lots.py -v`
- **Expected output:** `6 passed`.

### Task A4 — Rate sanity band on POST /v1/seller/rates

- **Goal:** Garbage/manipulated vyapari rates are rejected server-side against the Agmarknet modal reference. Spec: `docs/overview/03 … Part C/D item S2`.
- **Depends on:** Day 5 Task A2
- **Files to create/modify:**
  - `backend/app/routers/seller.py` (modify)
  - `backend/tests/test_vyapari.py` (modify — add tests)
- **Subtasks:**
  1. In `POST /seller/rates`, before storing: convert `ratePerKg` to per-quintal (`ratePerKg * 100`); find the reference modal price — query `mandi_prices` for the crop (same case-insensitive match as `GET /mandi/prices`), preferring a doc whose `mandiName` loosely matches the posted `mandiName`, else any doc for that crop; use its `modalPrice`.
  2. If a reference exists and the posted per-quintal rate is outside ±25% of `modalPrice` → 422 `RATE_OUT_OF_BAND` with `fieldErrors: {"ratePerKg": "मंडी भाव ₹<modal> के ±25% सीमा से बाहर"}`. If NO reference exists for the crop → accept (one-line comment: coverage gap is handled by the admin moderation queue, Day 14 item A6).
  3. Add tests in `backend/tests/test_vyapari.py` (reference: seeded Tomato modal 1950 at mandi-1 → band ₹1462.50–₹2437.50/quintal):
     - `test_rate_within_band_accepted`: `{crop: "Tomato", ratePerKg: 24, mandiName: "Pimpalgaon Baswant APMC"}` (= ₹2400/q) → 200, `status: "pending"`.
     - `test_rate_above_band_rejected`: `ratePerKg: 40` (= ₹4000/q) → 422 `RATE_OUT_OF_BAND`.
     - `test_rate_below_band_rejected`: `ratePerKg: 10` (= ₹1000/q) → 422.
     - `test_rate_unknown_crop_accepted`: `{crop: "Dragonfruit", ...}` → 200.
- **Test:** `cd backend && .venv/bin/pytest tests/test_vyapari.py -v`
- **Expected output:** All tests pass (6 existing + 4 new = `10 passed`).

### Task A5 — GET /v1/mandi/prices/history + 90-day synthetic seed

- **Goal:** Price-history endpoint backing the mandi trend chart; real Agmarknet history is an integration TODO. Spec: `docs/overview/03 … Part C/D item F13`.
- **Depends on:** Day 5 Task A1
- **Files to create/modify:**
  - `backend/scripts/seed_mandi.py` (modify)
  - `backend/app/routers/mandi.py` (modify)
  - `backend/tests/test_mandi_history.py` (new)
- **Subtasks:**
  1. Extend `scripts/seed_mandi.py`: new collection `mandi_price_history` — for each of the 4 seeded mandis, 90 daily docs `{ "mandiId", "mandiName", "commodity", "date": "YYYY-MM-DD", "modalPrice": int }` for the 90 days ending today, generated by a deterministic random walk (`random.Random(42)`, each day ±5% of the previous, anchored so the last day equals the current `mandi_prices` modal). One-line comment: real Agmarknet historical backfill is an integration TODO. Print `seeded 360 price-history rows`.
  2. `GET /mandi/prices/history?crop=&mandi=&months=` (roles farmer/seller/broker) in `app/routers/mandi.py`:
     - `months` default 3, clamp to 1–36 (422 `INVALID_QUANTITY`-style → use 422 `VALIDATION_ERROR` with fieldErrors on out-of-range non-clampable input; simple rule: clamp silently).
     - `crop` matched like `/prices` (English part, case-insensitive); `mandi` matched as substring on `mandiName`; both required → 422 `VALIDATION_ERROR` when missing.
     - Return `{ "data": [{ "date", "modalPrice" }] }` sorted by date ascending, limited to `months * 30` days.
  3. Write `backend/tests/test_mandi_history.py`:
     - `test_history_default_3_months`: → ~90 points, ascending dates.
     - `test_history_one_month`: `months=1` → ~30 points.
     - `test_history_unknown_crop`: → 200 `{ "data": [] }`.
     - `test_history_missing_params_422`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_mandi_history.py -v && .venv/bin/python scripts/seed_mandi.py`
- **Expected output:** `4 passed`; seed additionally prints `seeded 360 price-history rows`.

### Task B3 — Sell-produce flow: lot form + my lots list

- **Goal:** Farmer posts a produce lot with photos and manages his listings. Spec: `docs/overview/03 … Part C/D item F7`.
- **Depends on:** Day 5 Task B1. API dependency: Day 5 Task A3 (same day — Dev A finishes A3 before Dev B's manual test).
- **Files to create/modify:**
  - `apps/mobile/lib/api/lots_api.dart` (new)
  - `apps/mobile/lib/views/farmer/sell_produce_view.dart` (new screen)
  - `apps/mobile/lib/views/mandi_view.dart` (modify — entry button)
  - `apps/mobile/lib/state/profile_routes.dart` (modify — route `sellProduce` for farmer)
  - `apps/mobile/test/sell_produce_test.dart` (new)
- **Subtasks:**
  1. `apps/mobile/lib/api/lots_api.dart`: `createLot(Map fields)`, `getMyLots({String? status})`, `updateLot(id, Map fields)`, `withdrawLot(id)` → the `/market/lots` endpoints.
  2. `sell_produce_view.dart`: lot form — crop dropdown (user's `activeCrops` + common crops Onion/Tomato/Wheat), quantity quintals number field, expected rate ₹/quintal integer field, harvest date picker, photo picker (up to 3 photos via `image_picker` → Firebase Storage `lots/{uid}/lot_<timestamp>.jpg` with `firebase_storage`, download URLs into `photos`), location defaults to the farm-boundary centroid. Submit → `createLot` → toast `लॉट पोस्ट हुआ` and refresh.
  3. Below the form: `मेरे लॉट` list from `getMyLots()` — card per lot: crop, quantity, expected rate, harvest date, status chip (`open` green / `sold` blue / `withdrawn` grey); edit → same form prefilled → `updateLot`; withdraw → confirm dialog → `withdrawLot`; on 409 `LOT_NOT_EDITABLE` show the server message.
  4. `mandi_view.dart`: add a header button `अपनी उपज बेचें` (next to Smart Mandi Selection) → `sellProduce` route.
  5. `apps/mobile/test/sell_produce_test.dart`:
     - `testWidgets('form validates quantity > 0', ...)` — submit with 0 → inline error, no api call.
     - `testWidgets('submit records createLot with fields', ...)`.
     - `testWidgets('my lots list shows status chips and withdraw works', ...)` — fake 2 lots; withdraw one; assert fake recorded `withdrawLot(id)`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/sell_produce_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: post a lot with 2 photos → appears in `मेरे लॉट` as `open`.

### Task B4 — Price-history line chart on mandi detail

- **Goal:** Tapping a mandi price card shows the crop's price trend. Spec: `docs/overview/03 … Part C/D item F13`.
- **Depends on:** Day 5 Task B1. API dependency: Day 5 Task A5 (same day).
- **Files to create/modify:**
  - `apps/mobile/pubspec.yaml` (modify — add `fl_chart: ^0.69.0` to allowed packages)
  - `apps/mobile/lib/api/mandi_api.dart` (modify — `getPriceHistory(crop, mandi, months)`)
  - `apps/mobile/lib/components/mandi/price_history_chart.dart` (new)
  - `apps/mobile/lib/views/mandi_view.dart` (modify — card tap opens detail section)
  - `apps/mobile/test/price_history_chart_test.dart` (new)
- **Subtasks:**
  1. Add `fl_chart: ^0.69.0` to `apps/mobile/pubspec.yaml`; `flutter pub get`.
  2. `mandi_api.dart`: `getPriceHistory(String crop, String mandi, {int months = 3})` → GET `/mandi/prices/history`.
  3. `price_history_chart.dart`: `LineChart` of date → modalPrice; range chips 3/6/12 months re-fetching with `months`; labels for min, max, and last price (₹/quintal); loading shimmer and empty state `डेटा उपलब्ध नहीं`; vernacular crop/mandi header.
  4. `mandi_view.dart`: tapping a price card expands/opens a detail section embedding `PriceHistoryChart(crop, mandiName)`.
  5. `apps/mobile/test/price_history_chart_test.dart`:
     - `testWidgets('chart renders with last price label', ...)` — fake 90 ascending points; expect the last price text and the chart widget.
     - `testWidgets('empty history shows fallback', ...)` — fake `{data: []}` → expect `डेटा उपलब्ध नहीं`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/price_history_chart_test.dart`
- **Expected output:** `No issues found!`; 2 tests pass; manual: tap the Pimpalgaon Tomato card → 3-month ascending trend chart renders.

## Done-when checklist (end of day)

- [ ] `scripts/seed_mandi.py` seeds 4 mandi_prices + 3 vyapari_rates + 4 mandis.
- [ ] `/v1/mandi/prices?crop=tomato` → 3 records in pagination envelope; role `transport` → 403.
- [ ] `/v1/mandi/vyapari-rates` served from Redis on repeat calls (counter test); 2h TTL.
- [ ] `/v1/mandi/compare?crop=tomato&quantityQuintals=10&lat=20&lng=73.8` → ranked by netProfit, `transportCost = distanceKm * 12`.
- [ ] `POST /v1/seller/rates` creates `status: pending`; `GET /v1/seller/rates/my` lists it; farmer → 403.
- [ ] `cd backend && .venv/bin/pytest -v` → full suite green.
- [ ] Mandi screen live in app with filter chips; error path shows retry + greyed cache.
- [ ] Aaj ke Bhav widget shows live rates, crop-filtered to the user's activeCrops, with offline cache fallback.
- [ ] Smart compare sheet ranks mandis; #1 highlighted with "Best net profit" badge.
- [ ] `flutter analyze` 0 issues; mandi + widget tests pass.
- [ ] `/v1/market/lots` CRUD pytest green: owner-only, 404/409 paths, withdraw keeps the record (F7).
- [ ] `POST /v1/seller/rates` rejects out-of-band rates with 422 `RATE_OUT_OF_BAND`; unknown crop accepted (S2).
- [ ] `GET /v1/mandi/prices/history?crop=tomato&mandi=Pimpalgaon&months=3` → ~90 ascending points; seed prints `seeded 360 price-history rows` (F13).
- [ ] `sell_produce_view.dart`: lot form with photo upload to Storage + `मेरे लॉट` list with status chips; entry button on mandi view (F7).
- [ ] fl_chart price-history chart on mandi detail with 3/6/12-month chips; empty state covered by widget test (F13).
