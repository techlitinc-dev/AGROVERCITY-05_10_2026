# Day 12 — Content (News, Channels, Gyan Hub) + Livestock & Dairy + Tree Plantation

**Dev A (Backend) goal:** News, live channels + Redis-backed chat/viewer counts, Gyan Hub (workshops incl. coin discount + Razorpay, expert talks, videos, blogs), livestock (gaushalas/nurseries/vets/dairy), and tree endpoints shipped with idempotent seed scripts.
**Dev B (Flutter) goal:** `agri_news_view`, `live_channels_view` (video_player + chat), `gyan_hub_view` (4 tabs), `livestock_dairy_view` (4 tabs), `tree_plantation_view` (4 tabs) ported and wired.

## Dev A — Backend tasks

### Task A1 — News + live channels + channel chat

- **Goal:** `GET /v1/news`, `GET /v1/channels`, `GET/POST /v1/channels/{id}/chat`; Redis viewer counts + chat rate limit.
- **Depends on:** Day 1 Task A2 (`app/core/db.py`, Redis client `app/core/redis.py` — or wherever Day 1 put it; check and import from there).
- **Files to create/modify:**
  - `backend/app/models/content.py` (new)
  - `backend/app/data/content_seed.py` (new)
  - `backend/app/routers/content.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_content.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/content.py` (fields per endpoints.md §17):
     - `class AgriNewsItem(BaseModel)`: `id`, `title`, `vernacularTitle`, `category`, `source`, `timestamp`, `summary`, `content`, `isBreaking: bool`, `audioText`, `impactRating`
     - `class AgriLiveChannel(BaseModel)`: `id`, `channelName`, `broadcaster`, `programTitle`, `currentSpeaker`, `liveViewersCount: int`, `isLiveNow: bool`, `category`, `streamThumbnail`, `streamUrl`, `scheduleTime`
     - `class ChatMessageIn(BaseModel)`: `text: str = Field(min_length=1, max_length=300)`
     - `class ChatMessageOut(BaseModel)`: `id`, `userName`, `text`, `sentAt`
  2. Write `backend/app/data/content_seed.py` with `async def seed_content()`: skip if `news` non-empty. Seed **from the prototype demo data** (`flutter-prototype/lib/data/demo_data.dart`): 6 `news` docs (1 `isBreaking: true`; categories market-policy/weather-alert/govt-subsidy/agri-tech; each with Hindi `audioText`), 4 `channels` docs (DD Kisan, KVK Live, Nashik APMC Auction, Maharashtra Agri TV; `streamUrl` = HLS placeholder `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8` for all; `isLiveNow: true` on 2; `liveViewersCount` seed values). Call from `app/main.py` startup.
  3. Write `backend/app/routers/content.py` (`router = APIRouter(tags=["content"])`, all roles):
     - `GET /news?category=&page=`: `query("news", ...)`; sort `isBreaking` first then `timestamp` desc; optional category filter; envelope.
     - `GET /channels`: for each channel override `liveViewersCount` from Redis key `channel:{id}:viewers` (fallback to the Firestore value on miss); envelope.
     - `GET /channels/{id}/chat`: channel must exist (404 `CHANNEL_NOT_FOUND`); last 50 docs of `channels/{id}/chat` ascending; envelope.
     - `POST /channels/{id}/chat`: body `ChatMessageIn`; rate limit — Redis `SET ratelimit:chat:{uid}:{channelId} 1 EX 2 NX`, if not set → 429 `CHAT_RATE_LIMITED`; write `{ id, userName: user["name"], text, sentAt }`; return 201 `ChatMessageOut`. Viewer count: query param `?joined=true` → `INCR channel:{id}:viewers`; `?left=true` → `DECR` floored at 0; plain message POST touches neither.
  4. `app.include_router(content.router, prefix="/v1")`.
  5. Write `backend/tests/test_content.py` (Redis via fakeredis, patched in `conftest.py` if not already):
     - `test_news_breaking_first`: GET → first item `isBreaking == True`.
     - `test_news_category_filter`: `?category=weather-alert` → all items that category.
     - `test_channels_viewer_count_from_redis`: set `channel:ch-1:viewers` to 42 in fakeredis → response item `liveViewersCount == 42`.
     - `test_chat_post_and_rate_limit`: POST → 201; immediate second POST → 429 `CHAT_RATE_LIMITED`.
     - `test_chat_unknown_channel_404`: → 404 `CHANNEL_NOT_FOUND`.
     - `test_viewer_join_left`: POST `?joined=true` twice then `?left=true` → Redis value 1.
- **Test:** `cd backend && .venv/bin/pytest tests/test_content.py -v`
- **Expected output:** `6 passed`; restarting the app does not duplicate seeds (`news` count stays 6). Manual: `curl http://localhost:8000/v1/channels -H "Authorization: Bearer $TOKEN"` → 4 channels, `streamUrl` ends `.m3u8`.

### Task A2 — Gyan Hub: workshops, expert talks, videos, blogs

- **Goal:** `GET /v1/workshops` + enroll (coins and/or Razorpay), `GET /v1/expert-talks` + register (+25 coins) + questions, `GET /v1/videos`, `GET /v1/blogs` + bookmark/like.
- **Depends on:** Day 9 Task A1 (`app/services/coins.py` `award_coins` — add `spend_coins` today), Day 6 Task A2 (`create_razorpay_order` — dev mode returns fake order when keys empty).
- **Files to create/modify:**
  - `backend/app/models/gyan.py` (new)
  - `backend/app/data/gyan_seed.py` (new)
  - `backend/app/routers/gyan.py` (new)
  - `backend/app/services/coins.py` (modify — add `spend_coins`)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_gyan.py` (new)
- **Subtasks:**
  1. In `backend/app/services/coins.py` add `class InsufficientCoins(Exception)` and `async def spend_coins(uid, amount, reason, ref_id=None) -> int`: balance < amount → raise; else decrement + negative ledger entry in `users/{uid}/coin_ledger`; return new balance.
  2. Write `backend/app/models/gyan.py` (per endpoints.md §17):
     - `class PaidWorkshop(BaseModel)`: `id`, `title`, `instructor`, `instructorRole`, `institution`, `feeRupees: float`, `coinsDiscountAllowed: int`, `duration`, `batchDate`, `timing`, `rating`, `enrolledCount: int`, `totalSeats: int`, `isCertified: bool`, `certificateTitle`, `syllabusModules: list[str]`, `deliverables: list[str]`, `isEnrolled: bool`
     - `class EnrollIn(BaseModel)`: `useCoins: bool = False`, `coinsToRedeem: int = 0`
     - `class ExpertTalk(BaseModel)`: `id`, `expertName`, `institution`, `topic`, `scheduledTime`, `isLive: bool`, `registeredCount: int`, `description`
     - `class QuestionIn(BaseModel)`: `question: str = Field(min_length=5, max_length=500)`
     - `class VideoGuide(BaseModel)`: `id`, `title`, `instructor`, `duration`, `views`, `category`, `videoUrl`, `summary`, `keyPoints: list[str]`
     - `class BlogArticle(BaseModel)`: `id`, `title`, `author`, `authorRole`, `readTimeMinutes`, `category`, `summary`, `content`, `publishedDate`, `likesCount: int`, `isBookmarked: bool`
  3. Write `backend/app/data/gyan_seed.py` (idempotent, from prototype demo data): 3 `workshops` (1 ICAR-certified; `coinsDiscountAllowed` 100–200; e.g. fee 499, seats 380/500), 3 `expert_talks` (1 `isLive`), 6 `videos` (categories drip/pruning/spray; placeholder mp4 URLs), 6 `blogs`.
  4. Write `backend/app/routers/gyan.py` (`APIRouter(tags=["gyan"])`, all roles):
     - `GET /workshops`: per-user `isEnrolled` join from `users/{uid}/workshop_enrollments`; envelope.
     - `POST /workshops/{id}/enroll`: 404 `WORKSHOP_NOT_FOUND`; `enrolledCount >= totalSeats` → 409 `WORKSHOP_FULL`; enrollment doc exists → 409 `ALREADY_ENROLLED`. If `useCoins`: validate `coinsToRedeem <= coinsDiscountAllowed` and `<= feeRupees` (422 `INVALID_COIN_AMOUNT`), then `spend_coins` (InsufficientCoins → 409 `INSUFFICIENT_COINS`, message `पर्याप्त कॉइन नहीं`). Remaining = `feeRupees - coinsToRedeem`; if > 0 → `order = create_razorpay_order(int(remaining*100), f"ws-{id}-{uid[:8]}")`, store pending enrollment `{ status: "awaiting_payment", razorpayOrderId }`, return 200 `{ "enrolled": false, "paymentOrderId": order["id"], "amountDue": remaining }`; if 0 → write enrollment `{ status: "enrolled", enrolledAt }`, increment `enrolledCount`, return 201 `{ "enrolled": true }`.
     - `GET /expert-talks`: envelope. `POST /expert-talks/{id}/register`: registration exists → 409 `ALREADY_REGISTERED`; write `users/{uid}/talk_registrations/{talkId}`, increment `registeredCount`, `award_coins(uid, 25, "expert_talk", talkId)` → 200 `{ "registered": true, "agriCoinsEarned": 25 }`.
     - `POST /expert-talks/{id}/questions`: write `expert_talks/{id}/questions/{qid}` `{ userId, question, askedAt }` → 201 `{ "asked": true }`.
     - `GET /videos?category=`: envelope. `GET /blogs?category=`: per-user `isBookmarked` join from `users/{uid}/bookmarks`; envelope.
     - `POST /blogs/{id}/bookmark`: toggle — doc exists → delete, `isBookmarked: false`; else create, `true`; 200 `{ "isBookmarked": bool }`.
     - `POST /blogs/{id}/like`: like-set doc `blogs/{id}/likes/{uid}`; create only if absent and increment `likesCount`; 200 `{ "likesCount": int }` (idempotent — second like changes nothing).
  5. `app.include_router(gyan.router, prefix="/v1")`.
  6. Write `backend/tests/test_gyan.py`:
     - `test_workshops_list_not_enrolled`: `isEnrolled == False` on all.
     - `test_enroll_fully_with_coins_201`: give user 500 coins; workshop fee 200, `coinsToRedeem: 200` → 201 `enrolled == true`, balance 300, `enrolledCount` +1.
     - `test_enroll_twice_409`: → `ALREADY_ENROLLED`.
     - `test_enroll_coins_over_cap_422`: `coinsToRedeem > coinsDiscountAllowed` → 422.
     - `test_enroll_partial_coins_returns_razorpay_order`: fee 499, redeem 200 → 200 with `paymentOrderId` (dev-mode fake `order_dev_...`) and `amountDue == 299`.
     - `test_enroll_insufficient_coins_409`: → `INSUFFICIENT_COINS`.
     - `test_talk_register_awards_25`: → `agriCoinsEarned == 25`; second → 409 `ALREADY_REGISTERED`.
     - `test_blog_bookmark_toggles`: POST → true; POST again → false.
     - `test_blog_like_idempotent`: like twice → `likesCount` +1 only.
- **Test:** `cd backend && .venv/bin/pytest tests/test_gyan.py -v`
- **Expected output:** `9 passed`.

### Task A3 — Livestock: gaushalas, nurseries, vets, dairy

- **Goal:** `/v1/gaushalas` + manure-order, `/v1/nurseries`, `/v1/vets` + book, `/v1/dairy-products` + order.
- **Depends on:** Seed pattern from Task A1.
- **Files to create/modify:**
  - `backend/app/models/livestock.py` (new)
  - `backend/app/data/livestock_seed.py` (new)
  - `backend/app/routers/livestock.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_livestock.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/livestock.py` (entity fields exactly per endpoints.md §16): `GaushalaItem` (`id, name, trustName, address, district, distanceKm, cowCount, breeds, phone, providesOrganicManure, offersCowAdoption, rating, facilities`), `class ManureOrderIn(BaseModel)`: `product: str`, `quantity: str`; `PlantNursery`; `VetDoctor` (+ extra seed field `emergencyAvailable: bool`); `class VetBookIn(BaseModel)`: `visitType: Literal["farm", "clinic"]`, `slot: str`, `animalType: str`; `DairyProductItem`; `class DairyOrderIn(BaseModel)`: `quantity: int = Field(ge=1)`.
  2. Write `backend/app/data/livestock_seed.py` (idempotent): 3 `gaushalas` (Nashik; one `providesOrganicManure`, one `offersCowAdoption`), 3 `nurseries` (1 `isGovtCertified`), 4 `vets` (fees 300–800; 2 `emergencyAvailable: true`; 1 `availableForFarmVisit: false`; `nextAvailableSlot` ISO strings), 6 `dairy_products` (A2 ghee/milk/paneer/butter; `purityCertification`; mix of `inStock`).
  3. Write `backend/app/routers/livestock.py` (`APIRouter(tags=["livestock"])`):
     - `GET /gaushalas?district=&lat=&lng=` (farmer, seller): district filter; envelope.
     - `POST /gaushalas/{id}/manure-order` (farmer): 404 `GAUSHALA_NOT_FOUND`; write `users/{uid}/manure_orders/{id}` `{ product, quantity, gaushalaId, status: "placed", createdAt }` → 201 `{ "orderId": id, "status": "placed" }`.
     - `GET /nurseries?lat=&lng=` (farmer, seller): envelope.
     - `GET /vets?lat=&lng=&emergency=` (farmer): `emergency=true` → only `emergencyAvailable` vets, sorted by `distanceKm`; envelope.
     - `POST /vets/{id}/book` (farmer): 404 `VET_NOT_FOUND`; `visitType == "farm"` and not `availableForFarmVisit` → 400 `FARM_VISIT_UNAVAILABLE`; write `users/{uid}/vet_bookings/{id}` `{ id, vetId, vetName, visitType, slot, animalType, consultationFeeRupees, status: "confirmed", createdAt }` → 201 with the booking (this is what Day 11's My Bookings vet tab reads).
     - `GET /dairy-products?category=` (farmer, seller): envelope. `POST /dairy-products/{id}/order` (farmer, seller): 404 `PRODUCT_NOT_FOUND`; `inStock == false` → 409 `OUT_OF_STOCK`; write `users/{uid}/dairy_orders/{id}` with `total = price * quantity` → 201 `{ "orderId": id, "total": total }`.
  4. `app.include_router(livestock.router, prefix="/v1")`.
  5. Write `backend/tests/test_livestock.py`:
     - `test_gaushalas_by_district`: `?district=Nashik` → 3.
     - `test_manure_order_201`: → `{status: "placed"}`.
     - `test_vets_emergency_filter`: `?emergency=true` → 2, sorted by distance.
     - `test_farm_visit_unavailable_400`: book farm visit on the non-farm vet → 400 `FARM_VISIT_UNAVAILABLE`.
     - `test_vet_booking_visible_in_my_bookings`: book → 201; then `GET /v1/users/me/bookings` → `vet` list len 1 (integration with Day 11).
     - `test_dairy_order_out_of_stock_409`: → `OUT_OF_STOCK`.
     - `test_dairy_order_total`: qty 2 on price 450 → `total == 900`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_livestock.py -v`
- **Expected output:** `7 passed`.

### Task A4 — Tree plantation endpoints

- **Goal:** `/v1/tree/articles`, `/v1/tree/ngos` + sapling-request, `/v1/tree/biofuel`, `/v1/tree/care-guides`.
- **Depends on:** Seed pattern.
- **Files to create/modify:**
  - `backend/app/models/tree.py` (new)
  - `backend/app/data/tree_seed.py` (new)
  - `backend/app/routers/tree.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_tree.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/tree.py` (entity fields exactly per endpoints.md §18): `TreeArticle` (`id, title, category, author, readTime, summary, fullContent, benefits, publishedDate`), `NgoOrganization` (`id, name, focusArea, location, contactPhone, email, treesPlantedCount, rating, servicesOffered, providesFreeSaplings, websiteUrl`), `class SaplingRequestIn(BaseModel)`: `treeType: Literal["timber", "biofuel", "fruit", "bamboo"]`, `count: int = Field(ge=1, le=500)`; `BiofuelTree` (`id, name, botanicalName, oilContentPercent, gestationPeriod, expectedReturnPerAcre, suitability, uses, buyerMarket, subsidyScheme`), `TreeCareGuide` (`id, title, stepNumber, stage, instructions, wateringRule, fertilizerSchedule, pestProtection`).
  2. Write `backend/app/data/tree_seed.py` (idempotent): 4 `tree_articles` (timber/fruit/biofuel/care), 3 `ngos` (1 `providesFreeSaplings: true`), 4 `biofuel_trees` (Jatropha, Pongamia, Neem, Mahua — real `oilContentPercent`, `expectedReturnPerAcre`, `subsidyScheme` values), 5 `tree_care_guides` (`stepNumber` 1–5).
  3. Write `backend/app/routers/tree.py` (`prefix="/tree"`, roles farmer/farmLandlord/seller):
     - `GET /articles?category=`: envelope. `GET /ngos`: envelope. `GET /biofuel`: envelope. `GET /care-guides`: sorted by `stepNumber`; envelope.
     - `POST /ngos/{id}/sapling-request`: 404 `NGO_NOT_FOUND`; write `users/{uid}/sapling_requests/{id}` `{ ngoId, ngoName, treeType, count, status: "requested", createdAt }` → 201 `{ "requestId": id, "status": "requested" }`.
  4. `app.include_router(tree.router, prefix="/v1")`.
  5. Write `backend/tests/test_tree.py`:
     - `test_care_guides_sorted`: → stepNumbers ascending 1..5.
     - `test_sapling_request_201`: → `{status: "requested"}`.
     - `test_sapling_count_over_500_422`: count 501 → 422.
     - `test_unknown_ngo_404`: → `NGO_NOT_FOUND`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_tree.py -v`
- **Expected output:** `4 passed`.

## Dev B — Flutter tasks

### Task B1 — Port Agri News view

- **Goal:** Port `agri_news_view.dart` wired to `GET /v1/news`.
- **Depends on:** Day 3 Task B1. API dependency: Day 12 Task A1.
- **Files to create/modify:**
  - `apps/mobile/lib/views/agri_news_view.dart` (modify — port from `flutter-prototype/lib/views/agri_news_view.dart`)
  - `apps/mobile/lib/api/content_api.dart` (new — `listNews({category, page})`, `listChannels()`, `getChat(channelId)`, `postChat(channelId, text, {joined, left})`)
  - `apps/mobile/lib/models/agri_news_item.dart` (new)
  - `apps/mobile/test/agri_news_view_test.dart` (new)
- **Subtasks:**
  1. Copy the view verbatim — breaking banner, category pills, news cards, detail bottom sheet with WhatsApp share.
  2. Breaking banner ← first item with `isBreaking == true`; hide when none.
  3. Category pills → `?category=`; infinite scroll: `ScrollController` near-bottom → next `page` → append.
  4. Audio button stays UI-only (prototype TTS-simulation behaviour, no backend call).
  5. `apps/mobile/test/agri_news_view_test.dart`:
     - `testWidgets('news renders breaking banner', ...)` — fake 1 breaking + 1 normal; expect breaking title in the banner.
     - `testWidgets('category filter refetches', ...)` — tap a pill; assert fake api recorded the category param.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/agri_news_view_test.dart`
- **Expected output:** `No issues found!`; 2 tests pass.

### Task B2 — Port Live Channels view (video_player + chat)

- **Goal:** Port `live_channels_view.dart` with real HLS playback and API chat.
- **Depends on:** Task B1 (`content_api.dart`). Prototype already depends on `video_player` — keep the same version.
- **Files to create/modify:**
  - `apps/mobile/lib/views/live_channels_view.dart` (modify — port from `flutter-prototype/lib/views/live_channels_view.dart`)
  - `apps/mobile/lib/models/agri_live_channel.dart` (new)
  - `apps/mobile/test/live_channels_view_test.dart` (new)
- **Subtasks:**
  1. Copy the view verbatim — LIVE badge, viewer pill, play/pause, HD/fullscreen, channel list, chat box.
  2. Channel list ← `listChannels()`; on tap: dispose any existing controller, then `VideoPlayerController.networkUrl(Uri.parse(channel.streamUrl))` → `initialize()` → play; show `CircularProgressIndicator` until `value.isInitialized`; on error show `स्ट्रीम उपलब्ध नहीं` + retry.
  3. Viewer pill ← `liveViewersCount`; `Timer.periodic(60s)` refetches channels (cancel in `dispose`); call `postChat(channelId, '', joined: true)` on channel open and `left: true` on leave.
  4. Chat: load `getChat(channelId)` on open; poll every 5 s while open (Timer, cancelled in dispose); send → `postChat`; on `CHAT_RATE_LIMITED` show inline hint `थोड़ा धीरे भेजें`; render `userName: text` rows.
  5. For widget tests, inject a `bool enableVideo = false` constructor flag so tests never touch video_player.
  6. `apps/mobile/test/live_channels_view_test.dart`:
     - `testWidgets('channels list renders with LIVE badge', ...)` — fake 2 channels (1 live); expect `LIVE` text and channel names.
     - `testWidgets('chat messages render', ...)` — fake chat with 2 messages; expect both `userName: text` strings.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/live_channels_view_test.dart`
- **Expected output:** `No issues found!`; 2 tests pass; manual: HLS test stream plays on emulator; sent chat appears after next poll.

### Task B3 — Port Gyan Hub view (4 tabs)

- **Goal:** Port `gyan_hub_view.dart` wired to workshops/talks/videos/blogs.
- **Depends on:** Day 6 Razorpay checkout helper (`RazorpayHelper.open(...)` — whatever Day 6 Task B named it; reuse). API dependency: Day 12 Task A2.
- **Files to create/modify:**
  - `apps/mobile/lib/views/gyan_hub_view.dart` (modify — port from `flutter-prototype/lib/views/gyan_hub_view.dart`)
  - `apps/mobile/lib/api/gyan_api.dart` (new — `listWorkshops`, `enrollWorkshop`, `listTalks`, `registerTalk`, `askQuestion`, `listVideos`, `listBlogs`, `toggleBookmark`, `likeBlog`)
  - `apps/mobile/lib/models/gyan_models.dart` (new)
  - `apps/mobile/test/gyan_hub_view_test.dart` (new)
- **Subtasks:**
  1. Copy the view verbatim — tabs वर्कशॉप / विशेषज्ञ वार्ता / वीडियो / ब्लॉग.
  2. Workshops: seats progress `{enrolledCount}/{totalSeats}` bar; enroll sheet with coin-redeem switch + slider (max = min(`coinsDiscountAllowed`, current coin balance)); on 201 → SnackBar `नामांकन सफल` + badge `नामांकित ✓` on the card; on 200-with-`paymentOrderId` → `RazorpayHelper.open(orderId, amountDue)`; on `ALREADY_ENROLLED` → `पहले से नामांकित`; on `INSUFFICIENT_COINS` → `पर्याप्त कॉइन नहीं`; on `WORKSHOP_FULL` → `सीटें भर गईं`.
  3. Talks: register button → on 200 SnackBar `+25 AgriCoins मिले!`, button becomes disabled `पंजीकृत ✓`; `वैज्ञानिक से पूछें` dialog → `askQuestion` → 201 SnackBar `प्रश्न भेजा गया`.
  4. Videos: cards ← `listVideos`; tap → player modal (video_player, same `enableVideo` test flag pattern) with `keyPoints` below.
  5. Blogs: bookmark icon → `toggleBookmark` (update locally from response); like → `likeBlog` shows returned `likesCount`; audio readout stays UI-only.
  6. `apps/mobile/test/gyan_hub_view_test.dart`:
     - `testWidgets('gyan hub renders 4 tabs', ...)` — expect the 4 tab labels.
     - `testWidgets('workshop card shows seats progress', ...)` — fake 380/500 → expect text `380/500`.
     - `testWidgets('talk register awards coins', ...)` — fake register → 200; tap → expect `+25 AgriCoins मिले!`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/gyan_hub_view_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: full-coin enroll → no payment sheet; partial → Razorpay opens.

### Task B4 — Port Livestock & Dairy view (4 tabs)

- **Goal:** Port `livestock_dairy_view.dart` wired to gaushalas/nurseries/vets/dairy.
- **Depends on:** Day 3 Task B1. API dependency: Day 12 Task A3.
- **Files to create/modify:**
  - `apps/mobile/lib/views/livestock_dairy_view.dart` (modify — port from `flutter-prototype/lib/views/livestock_dairy_view.dart`)
  - `apps/mobile/lib/api/livestock_api.dart` (new)
  - `apps/mobile/lib/models/livestock_models.dart` (new)
  - `apps/mobile/test/livestock_dairy_view_test.dart` (new)
- **Subtasks:**
  1. Copy the view verbatim — tabs गौशाला / नर्सरी / पशु डॉक्टर / डेयरी, 24×7 emergency bar.
  2. Gaushala: cards ← `listGaushalas(district: user.district)`; manure order dialog (product dropdown गोबर/स्लरी + quantity) → POST → 201 SnackBar `ऑर्डर दर्ज हुआ`; call button tel: on `phone`; `providesOrganicManure`/`offersCowAdoption` badges.
  3. Nursery: `isGovtCertified` → `सरकारी प्रमाणित` badge; saplings chips; call button.
  4. Vet: emergency bar toggles `?emergency=true`; booking dialog (visitType फ़ार्म/क्लीनिक, slot from `nextAvailableSlot`, animalType dropdown गाय/भैंस/बकरी/अन्य) → POST; on 201 SnackBar `बुकिंग पुष्ट — शुल्क ₹{consultationFeeRupees}` + text-button `मेरी बुकिंग देखें` → route `myBookings`; on `FARM_VISIT_UNAVAILABLE` → `यह डॉक्टर फ़ार्म विज़िट नहीं करते`.
  5. Dairy: `purityCertification` badge; out-of-stock card greyed + `स्टॉक में नहीं`; buy dialog quantity stepper → POST → show `कुल: ₹{total}`.
  6. `apps/mobile/test/livestock_dairy_view_test.dart`:
     - `testWidgets('livestock renders 4 tabs', ...)` — expect the 4 tab labels.
     - `testWidgets('vet card renders with fee', ...)` — fake vet fee 500 → expect `₹500`.
     - `testWidgets('out of stock dairy card greyed', ...)` — fake `inStock: false` → expect `स्टॉक में नहीं`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/livestock_dairy_view_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: vet booking appears in My Bookings vet tab.

### Task B5 — Port Tree Plantation view (4 tabs)

- **Goal:** Port `tree_plantation_view.dart` wired to `/v1/tree/*`.
- **Depends on:** Day 3 Task B1. API dependency: Day 12 Task A4.
- **Files to create/modify:**
  - `apps/mobile/lib/views/tree_plantation_view.dart` (modify — port from `flutter-prototype/lib/views/tree_plantation_view.dart`)
  - `apps/mobile/lib/api/tree_api.dart` (new)
  - `apps/mobile/lib/models/tree_models.dart` (new)
  - `apps/mobile/test/tree_plantation_view_test.dart` (new)
- **Subtasks:**
  1. Copy the view verbatim — tabs लेख / NGO / जैव-ईंधन / देखभाल.
  2. Articles: list + detail sheet (benefits, full content) with `पौधे मांगें` CTA jumping to the NGO tab.
  3. NGO: `providesFreeSaplings` → `मुफ्त पौधे` badge; request dialog (treeType chips timber/biofuel/fruit/bamboo + count field) → POST → 201 SnackBar `पौधा अनुरोध भेजा गया`; client-side count > 500 → `अधिकतम 500 पौधे` before any API call.
  4. Biofuel: cards with oil %, expected return/acre, gestation, subsidy-scheme chip, buyer market.
  5. Care guides: step cards sorted by `stepNumber` (watering rule, fertilizer schedule, pest protection rows).
  6. `apps/mobile/test/tree_plantation_view_test.dart`:
     - `testWidgets('tree view renders 4 tabs', ...)` — expect the 4 tab labels.
     - `testWidgets('care guides ordered by step', ...)` — fake steps out of order → rendered ascending.
     - `testWidgets('free saplings badge renders', ...)` — fake NGO `providesFreeSaplings: true` → expect `मुफ्त पौधे`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/tree_plantation_view_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass.

## Done-when checklist (end of day)

- [ ] `cd backend && .venv/bin/pytest tests/test_content.py tests/test_gyan.py tests/test_livestock.py tests/test_tree.py -v` → 26 passed; full suite green.
- [ ] All 4 seed scripts idempotent — two app restarts leave `news` at 6 docs.
- [ ] Redis: viewer INCR/DECR works; chat 2-second rate limit returns 429 `CHAT_RATE_LIMITED`.
- [ ] Workshop enroll: coins-only → 201; partial → Razorpay `paymentOrderId`; over-cap coins → 422; insufficient → 409.
- [ ] Expert-talk register awards exactly 25 coins (ledger entry present); blog bookmark/like idempotent.
- [ ] Vet booking created via API appears in `GET /v1/users/me/bookings` vet list.
- [ ] `flutter analyze` 0 issues; 13 new widget tests pass.
- [ ] Manual: HLS channel plays; chat round-trips; manure order, dairy order, sapling request all return their SnackBars.

---

## Additional tasks (from missing.md)

Covers: X7 product reviews, X8 service ratings. Specs: docs/overview/03 Part C/D items X7, X8 — the spec item wins on any divergence.

### Task A5 — Product reviews with aggregate recompute (X7)

- **Goal:** `POST /v1/products/{id}/reviews` (rating 1–5, comment; one per user per product — upsert) + `GET /v1/products/{id}/reviews`; product aggregate recomputed on write. Spec: docs/overview/03 Part C item X7.
- **Depends on:** Day 6 (marketplace products collection + router file from that day).
- **Files to create/modify:**
  - `backend/app/models/reviews.py` (new)
  - `backend/app/routers/marketplace.py` (modify — add 2 routes; use the Day 6 router file name if different)
  - `backend/tests/test_reviews.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/reviews.py`:
     - `class ReviewIn(BaseModel)`: `rating: int = Field(ge=1, le=5)`, `comment: str = Field(default="", max_length=500)`
     - `class ReviewOut(ReviewIn)`: + `id: str`, `userId: str`, `userName: str`, `createdAt: str`, `updatedAt: str`
  2. Add routes to the marketplace router (all roles):
     - `POST /products/{id}/reviews`: product must exist (404 `PRODUCT_NOT_FOUND`); upsert doc `products/{id}/reviews/{uid}` (doc id = reviewer uid — that is the one-per-user rule); new → `createdAt` set, existing → keep `createdAt`, always `updatedAt`; recompute the product aggregate: `ratingCount = len(reviews)`, `ratingAvg = round(mean, 1)` written onto the product doc (additive fields); 200 `ReviewOut` (upsert, so 200 not 201).
     - `GET /products/{id}/reviews`: 404 `PRODUCT_NOT_FOUND`; reviews sorted `updatedAt` desc; envelope.
  3. Write `backend/tests/test_reviews.py`:
     - `test_post_review_updates_aggregate`: 2 users rate 4 and 5 → product `ratingCount == 2`, `ratingAvg == 4.5`.
     - `test_upsert_same_user`: same user posts 3 then 5 → still `ratingCount == 1` (until a second user), `ratingAvg` reflects the latest value; only one review doc.
     - `test_unknown_product_404`: → 404 `PRODUCT_NOT_FOUND`.
     - `test_rating_bounds_422`: rating 0 and 6 → 422.
     - `test_list_reviews_sorted`: newest first, `userName` present.
- **Test:** `cd backend && .venv/bin/pytest tests/test_reviews.py -v`
- **Expected output:** `5 passed`. Manual: `curl -X POST http://localhost:8000/v1/products/<ID>/reviews -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"rating":5,"comment":"बढ़िया बीज"}'` → 200; product doc shows the new aggregate.

### Task A6 — Service ratings for transport / vet / equipment (X8)

- **Goal:** `POST /v1/ratings` `{bookingKind, bookingId, stars, comment}` after completion; provider ratings surface in list responses. Spec: docs/overview/03 Part C item X8.
- **Depends on:** Day 7 (`transport_bookings`, status `delivered`), Day 8 (`equipment_bookings`, status `completed`/`done` — use the Day 8 terminal status), Day 12 Task A3 (`vet_bookings`, status `completed` after visit — add the transition there if missing: `POST /v1/vets/bookings/{id}/complete` or treat `confirmed` + past slot as rateable; pick one rule and assert it in tests).
- **Files to create/modify:**
  - `backend/app/models/ratings.py` (new)
  - `backend/app/routers/ratings.py` (new)
  - `backend/app/main.py` (modify)
  - Provider list responses (Day 7 transporters, Day 8 equipment, Day 12 vets — modify those routers to join `ratingAvg`/`ratingCount`)
  - `backend/tests/test_ratings.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/ratings.py`:
     - `class RatingIn(BaseModel)`: `bookingKind: Literal["transport", "vet", "equipment"]`, `bookingId: str`, `stars: int = Field(ge=1, le=5)`, `comment: str = Field(default="", max_length=500)`
     - `class RatingOut(RatingIn)`: + `id: str`, `providerId: str`, `createdAt: str`
  2. Write `backend/app/routers/ratings.py` (`prefix="/ratings"`, all roles):
     - `POST /`: resolve the booking by kind — transport: `transport_bookings/{id}` must have `userId == uid`; vet: `users/{uid}/vet_bookings/{id}`; equipment: `users/{uid}/equipment_bookings/{id}` — missing/foreign → 404 `BOOKING_NOT_FOUND`. Status not terminal (transport `delivered`, vet `completed`, equipment Day-8 terminal status) → 409 `NOT_COMPLETED` (message `पूरी न हुई बुकिंग रेट नहीं की जा सकती`). One rating per booking: a doc in `ratings` with `bookingId` + `bookingKind` → 409 `ALREADY_RATED`.
     - Determine `providerId` from the booking (transporter uid / vet id / equipment owner uid); write `ratings/{uuid}` `{ bookingKind, bookingId, stars, comment, raterId: uid, providerId, createdAt }`; recompute the provider aggregate doc `provider_ratings/{providerId}` `{ ratingCount, ratingAvg }`; 201 `RatingOut`.
  3. Provider list joins: transporter search (Day 7), equipment list (Day 8), vets list (Day 12 Task A3) each read `provider_ratings/{id}` and include `ratingAvg: float | None`, `ratingCount: int` (additive fields; `None`/0 when unrated — client hides the stars row then).
  4. `app.include_router(ratings.router, prefix="/v1")`.
  5. Write `backend/tests/test_ratings.py`:
     - `test_rate_delivered_transport_booking_201`: delivered booking → 201, `provider_ratings` aggregate `ratingCount == 1`.
     - `test_not_completed_409`: booking at `requested` → 409 `NOT_COMPLETED`.
     - `test_double_rating_409`: second rating on the same booking → 409 `ALREADY_RATED`.
     - `test_foreign_booking_404`: another user's bookingId → 404 `BOOKING_NOT_FOUND`.
     - `test_provider_list_shows_rating`: after rating, the provider list response item carries `ratingAvg == 4.0`, `ratingCount == 1`.
     - `test_aggregate_averages`: two raters 4 and 2 → `ratingAvg == 3.0`, `ratingCount == 2`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_ratings.py -v`
- **Expected output:** `6 passed`.

### Task B6 — Product review form + reviews list (X7)

- **Goal:** Product detail gets a review form and a reviews list. Spec: docs/overview/03 Part D item X7. API dependency: Day 12 Task A5.
- **Depends on:** Day 6 marketplace product-detail view (Day 6 file); Day 12 Task A5.
- **Files to create/modify:**
  - `apps/mobile/lib/views/marketplace_view.dart` (modify — or the Day 6 product-detail file; add the section to product detail)
  - `apps/mobile/lib/api/marketplace_api.dart` (modify — `postReview(productId, rating, comment)`, `listReviews(productId)`)
  - `apps/mobile/lib/models/product_review.dart` (new)
  - `apps/mobile/test/marketplace_view_test.dart` (modify — append 2 tests; use the Day 6 test file)
- **Subtasks:**
  1. Product detail: star row on the product card now reflects `ratingAvg`/`ratingCount` from the API (fallback to prototype static values when absent).
  2. `समीक्षा लिखें` section: 5-star tap input + comment field (max 500) + `भेजें` → `postReview` → on 200 SnackBar `समीक्षा दर्ज हुई` + refetch product + reviews; the button label becomes `समीक्षा बदलें` when the user already has a review (upsert semantics — same call).
  3. Reviews list below: `userName`, star row, comment, relative date; empty state `अभी कोई समीक्षा नहीं`.
  4. Tests: `testWidgets('review form posts and refreshes aggregate', ...)` — submit 5 stars → fake recorded `postReview`; aggregate text shows updated count. `testWidgets('reviews list renders', ...)` — fake 2 reviews → both comments visible.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/marketplace_view_test.dart`
- **Expected output:** `No issues found!`; 2 new tests pass; manual: post a review → product stars update without restart.

### Task B7 — Rate-after-completion bottom sheet (X8)

- **Goal:** After a trip / vet visit / rental completes, `my_bookings_view` offers a rate prompt. Spec: docs/overview/03 Part D item X8. API dependency: Day 12 Task A6.
- **Depends on:** Day 11 Task B2 (`my_bookings_view.dart`); Day 12 Task A6.
- **Files to create/modify:**
  - `apps/mobile/lib/components/rate_booking_sheet.dart` (new)
  - `apps/mobile/lib/api/ratings_api.dart` (new — `postRating(bookingKind, bookingId, stars, comment)`)
  - `apps/mobile/lib/views/my_bookings_view.dart` (modify — rate action on terminal-status cards)
  - `apps/mobile/test/my_bookings_view_test.dart` (modify — append 2 tests)
- **Subtasks:**
  1. Cards for terminal statuses (transport `delivered` → `पहुंचा`, vet `completed`, equipment Day-8 terminal) get a `रेटिंग दें` text-button.
  2. `rate_booking_sheet.dart`: 5 large stars + optional comment + `भेजें`; submit → `postRating` → on 201 SnackBar `धन्यवाद! रेटिंग दर्ज हुई` + the card button becomes disabled `रेटेड ✓` (local state; on refetch the backend's 409 keeps it honest); on `NOT_COMPLETED` → `पूरी न हुई बुकिंग रेट नहीं की जा सकती`; on `ALREADY_RATED` → `आप पहले ही रेटिंग दे चुके हैं`.
  3. Tests: `testWidgets('completed booking shows rate button', ...)` — fake delivered transport booking → expect `रेटिंग दें`. `testWidgets('rate submit shows thank-you snackbar', ...)` — fake 201 → expect `धन्यवाद! रेटिंग दर्ज हुई`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/my_bookings_view_test.dart`
- **Expected output:** `No issues found!`; existing 6 + 2 new tests pass; manual: deliver a transport booking (Day 7 flow) → rate prompt → provider card shows the stars.

### Done-when additions (additional tasks)

- [ ] `cd backend && .venv/bin/pytest tests/test_reviews.py tests/test_ratings.py -v` → 11 passed; full suite green.
- [ ] Review upsert keeps one doc per user; product `ratingAvg`/`ratingCount` recomputed exactly.
- [ ] Rating guards: non-terminal booking → 409 `NOT_COMPLETED`; repeat → 409 `ALREADY_RATED`; foreign booking → 404.
- [ ] Provider list responses (transporter/equipment/vet) include `ratingAvg`/`ratingCount` (additive).
- [ ] `flutter analyze` 0 issues; 4 new widget tests pass (reviews 2, ratings 2).
- [ ] Manual: product review → stars update; delivered trip → rate sheet → provider list shows rating.
