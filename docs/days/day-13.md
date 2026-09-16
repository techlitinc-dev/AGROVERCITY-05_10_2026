# Day 13 — AI Chatbot + Advisory + Gamification + Push Notifications

**Dev A (Backend) goal:** Kisan Mitra chatbot (OpenRouter + Redis 24h session memory + rich cards), advisory (saturation, disease-scan stub, pest radar, NPK), gamification (status/rewards/redeem/ledger), referrals, FCM send helper + notifications read, and the coin-award hooks audit.
**Dev B (Flutter) goal:** `kisan_mitra_chatbot_sheet` + `voice_assistant_sheet` wired to the API; `advisory_view` (5 tabs), `krishi_ratna_view`, `refer_earn_view` ported and wired; FCM client fully set up on Android.

## Dev A — Backend tasks

### Task A1 — Kisan Mitra chatbot (OpenRouter + session memory)

- **Goal:** `POST /v1/chatbot/messages`, `GET /v1/chatbot/history`, `POST /v1/chatbot/handoff`.
- **Depends on:** Day 1 (Redis client), Day 2 (`current_user_id`); env `OPENROUTER_API_KEY` (dev mode: empty → canned replies); `httpx` (already in requirements).
- **Files to create/modify:**
  - `backend/app/models/chatbot.py` (new)
  - `backend/app/services/llm.py` (new)
  - `backend/app/services/chat_session.py` (new)
  - `backend/app/routers/chatbot.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_chatbot.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/chatbot.py` (per endpoints.md §5):
     - `class ChatMessageIn(BaseModel)`: `text: str | None = None`, `audioUrl: str | None = None`, `language: str = "hi"`, `sessionId: str`
     - `class KisanMitraMessage(BaseModel)`: `id: str`, `sender: Literal["bot", "user"]`, `text: str`, `timestamp: str`, `quickReplies: list[str] = []`, `richCardType: str | None = None`, `richCardData: dict | None = None` (`richCardType` ∈ saturation/weather/mandi/pest/null)
     - `class HandoffIn(BaseModel)`: `sessionId: str`, `reason: str`
     - `class HandoffOut(BaseModel)`: `expertName: str`, `contactChannel: str`, `etaMinutes: int`
  2. Write `backend/app/services/llm.py`:
     - `class LLMUnavailable(Exception)`.
     - `def build_system_prompt(user: dict) -> str`: Hindi-first — `"तुम किसान मित्र हो, भारतीय किसानों के लिए कृषि सहायक। संक्षिप्त, व्यावहारिक उत्तर दो।"` + context line built from `name, village, district, landAreaAcres, activeCrops, soilType, irrigationType` + rule: never invent mandi prices — direct the user to the mandi module for live rates.
     - `async def complete(messages: list[dict]) -> str`: if `settings.openrouter_api_key` empty → return a canned Hindi dev reply `"यह डेव मोड उत्तर है: ..."` echoing intent keywords. Else POST `https://openrouter.ai/api/v1/chat/completions` (header `Authorization: Bearer <key>`, body `{model: "meta-llama/llama-3.1-8b-instruct", messages, max_tokens: 400, temperature: 0.4}`, timeout 15 s via httpx); non-200/timeout → raise `LLMUnavailable`.
     - `async def sarvam_stt(audio_url: str, language: str) -> str`: if `settings.sarvam_api_key` empty → return `"<mock transcript>"`; else real Sarvam AI call (docs: `https://docs.sarvam.ai`) — implement behind this single function so the router never changes.
     - `def detect_rich_card(user_message: str) -> tuple[str | None, dict | None]` — deterministic keyword rules (MVP): contains `बुवाई`/`saturation` → `("saturation", {"sowingCount": 24, "radiusKm": 10, "expectedArrivalIncrease": "18%", "riskLevel": "yellow", "predictedPrice": 1320, "predictedDate": <today+90d>, "alternativeCrops": [{"crop": "Soybean", "expectedPrice": 4800}]})`; contains `मौसम`/`weather` → `("weather", {"tempC": 32, "rainProbability": 20, "condition": "sunny"})`; contains `भाव`/`mandi` → `("mandi", {"crop": "Onion", "modalPrice": 1450, "mandiName": "Nashik APMC"})`; contains `कीट`/`pest` → `("pest", {"disease": "Pink bollworm", "distanceKm": 3.2, "riskLevel": "yellow"})`; else `(None, None)`.
     - `def quick_replies_for(card_type: str | None) -> list[str]`: weather → `["कल बारिश होगी?", "छिड़काव कब करें?"]`; mandi → `["गेहूं का भाव?", "नज़दीकी मंडी?"]`; default → `["मौसम बताओ", "आज का भाव?"]`.
  3. Write `backend/app/services/chat_session.py`: `async def append_message(session_id, msg_dict)` — Redis `RPUSH chat:{sessionId} <json>`, `LTRIM chat:{sessionId} -40 -1`, `EXPIRE 86400` (24 h TTL); also mirror to Firestore `chat_sessions/{sessionId}/messages/{id}` with `userId` for durable history. `async def get_history(session_id) -> list[dict]` — Redis first, Firestore fallback.
  4. Write `backend/app/routers/chatbot.py` (`prefix="/chatbot"`, all roles):
     - `POST /messages`: neither `text` nor `audioUrl` → 400 `EMPTY_MESSAGE`. If only `audioUrl` → `text = await sarvam_stt(audioUrl, language)`. Append user message; call `complete([system] + history)`; on `LLMUnavailable` → bot text `अभी सेवा उपलब्ध नहीं है — थोड़ी देर बाद पूछें`, `richCardType: None` (NEVER 5xx for LLM failure). Build bot message with `detect_rich_card(text)` + `quick_replies_for(...)`; append; return 200 the bot `KisanMitraMessage`.
     - `GET /history?sessionId=`: Firestore-mirrored messages oldest-first; envelope.
     - `POST /handoff`: write `handoff_requests/{id}` `{ userId, sessionId, reason, lastMessages: history[-10:], createdAt }`; return 200 `{ "expertName": "डॉ. अनिता देशमुख (कृषि वैज्ञानिक)", "contactChannel": "whatsapp", "etaMinutes": 30 }`.
  5. `app.include_router(chatbot.router, prefix="/v1")`.
  6. Write `backend/tests/test_chatbot.py` (fakeredis + patched `llm.complete`):
     - `test_send_message_bot_reply`: mock `complete` → `"नमस्ते! ..."`; POST → 200, `sender == "bot"`, session has 2 entries (user + bot).
     - `test_context_retained_across_turns`: send 2 messages; assert second call to mocked `complete` received ≥ 3 messages (system + 2+).
     - `test_mandi_keyword_rich_card`: text contains `भाव` → `richCardType == "mandi"` and `quickReplies` non-empty.
     - `test_empty_message_400`: neither field → 400 `EMPTY_MESSAGE`.
     - `test_llm_outage_graceful`: `complete` raises `LLMUnavailable` → 200 with the Hindi fallback text, `richCardType is None`.
     - `test_handoff_returns_expert`: → 200, `etaMinutes == 30`, handoff doc written with last messages.
- **Test:** `cd backend && .venv/bin/pytest tests/test_chatbot.py -v`
- **Expected output:** `6 passed`. Manual: `curl -X POST http://localhost:8000/v1/chatbot/messages -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"text":"आज प्याज का भाव क्या है?","language":"hi","sessionId":"s1"}'` → 200, `richCardType == "mandi"`.

### Task A2 — Advisory: saturation, disease-scan, pest-radar, NPK

- **Goal:** `POST /v1/advisory/saturation`, `POST /v1/advisory/disease-scan`, `GET /v1/advisory/pest-radar`, `POST /v1/advisory/npk`.
- **Depends on:** Day 10 Task A2 (`storage.upload_user_file`); adapter pattern from Day 10 Task A3.
- **Files to create/modify:**
  - `backend/app/models/advisory.py` (new)
  - `backend/app/services/advisory.py` (new)
  - `backend/app/services/disease_model/base.py` + `stub.py` + `__init__.py` (new — `get_disease_adapter()` via env `DISEASE_MODEL_ADAPTER`, default stub)
  - `backend/app/routers/advisory.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_advisory.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/advisory.py`:
     - `class SaturationIn(BaseModel)`: `crop: str`, `district: str`, `lat: float`, `lng: float`, `radiusKm: int = 10`, `shareSowingIntent: bool = True`
     - `class SaturationOut(BaseModel)`: `sowingCount: int`, `radiusKm: int`, `expectedArrivalIncrease: str`, `riskLevel: Literal["green", "yellow", "red"]`, `predictedPrice: float`, `predictedDate: str`, `alternativeCrops: list[dict]` (each `{crop, expectedPrice}`)
     - `class PestDisease(BaseModel)`: `diseaseName`, `crop`, `pathogen`, `confidence: float`, `symptoms`, `chemicalTreatment`, `organicTreatment`, `dosage`, `estimatedCost: float`
     - `class NpkIn(BaseModel)`: `n: float`, `p: float`, `k: float`, `crop: str`, `soilType: str`
     - `class NpkOut(BaseModel)`: `recommendations: list[str]`, `ureaKgPerAcre: float`, `dapKgPerAcre: float`, `mopKgPerAcre: float`
  2. Write `backend/app/services/advisory.py`:
     - `async def saturation(inp: SaturationIn) -> SaturationOut`: count `query("crop_cycles", [("crop","==",inp.crop),("district","==",inp.district)])` — aggregate counts only, never user ids (privacy: opt-in). Risk: `count < 20 → green`, `< 60 → yellow`, else `red`. `expectedArrivalIncrease = f"{count * 8}%"`. Base price map `{onion: 1450, wheat: 2275, tomato: 1100}` default 1500; `predictedPrice = base * (1.0 | 0.92 | 0.80)` by risk, rounded. `predictedDate = today + 90 days`. `alternativeCrops`: 2 entries from an alternatives map (e.g. onion → soybean 4800×1.05, gram 5400×1.05), default `[{crop: "Soybean", expectedPrice: 5040}, {crop: "Maize", expectedPrice: 2250}]`.
  3. `disease_model/base.py`: `class DiseaseModelAdapter(ABC): async def scan(self, image_bytes: bytes) -> list[PestDisease]`. `stub.py` returns one fixed result — Early Blight / Tomato / Alternaria solani / confidence 0.87 / symptoms / chemical (Mancozeb 75% WP) / organic (neem oil 5%) / dosage `2.5 g/L` / estimatedCost 450. `__init__.py`: `get_disease_adapter()` reading `DISEASE_MODEL_ADAPTER` (default `stub`).
  4. Write `backend/app/routers/advisory.py` (`prefix="/advisory"`, role farmer):
     - `POST /saturation`: if `shareSowingIntent` → upsert `crop_cycles` doc `{ userId: uid, crop, district, lat, lng, season: <current Kharif/Rabi by month>, createdAt }` (one doc per user+crop+season — key `crop_cycles/{uid}_{crop}_{season}`); return 200 the service result.
     - `POST /disease-scan`: multipart image (jpeg/png ≤ 5 MB → 415/413); upload to `scans/{uid}/...`; `results = await get_disease_adapter().scan(bytes)`; 200 `{ "results": [...] }`.
     - `GET /pest-radar?lat=&lng=&radiusKm=5`: 2 mock alerts `[{ disease: "Pink bollworm", crop: "Cotton", distanceKm: 3.2, riskLevel: "yellow", reportedAt: <today> }, { disease: "Leaf curl", crop: "Chilli", distanceKm: 4.8, riskLevel: "green", reportedAt: <today> }]`; envelope.
     - `POST /npk`: crop target table (kg/ha) `{wheat: (120,60,40), onion: (100,50,50), tomato: (150,80,80)}` default `(100,50,50)`; deficits floored at 0; `ureaKgPerAcre = round(deficitN / 0.46 / 2.5, 1)` (urea 46% N, ha→acre ÷2.5), `dapKgPerAcre = round(deficitP / 0.46 / 2.5, 1)` (DAP 46% P2O5), `mopKgPerAcre = round(deficitK / 0.60 / 2.5, 1)` (MOP 60% K2O); `recommendations` = Hindi strings naming each fertilizer + amount.
  5. `app.include_router(advisory.router, prefix="/v1")`.
  6. Write `backend/tests/test_advisory.py`:
     - `test_saturation_green_when_empty`: no crop_cycles → `sowingCount == 0`, `riskLevel == "green"`.
     - `test_saturation_red_when_crowded`: seed 65 intent docs → `red`, `predictedPrice < base`.
     - `test_sowing_intent_recorded_opt_in`: POST default → crop_cycles doc exists; `shareSowingIntent: false` → not written.
     - `test_disease_scan_stub`: small PNG → 200, `results[0].diseaseName == "Early Blight"`; text file → 415.
     - `test_npk_deficit_math`: `{n:40, p:20, k:10, crop:"wheat", soilType:"black"}` → all amounts > 0, `recommendations` non-empty.
- **Test:** `cd backend && .venv/bin/pytest tests/test_advisory.py -v`
- **Expected output:** `5 passed`.

### Task A3 — Gamification + referrals + coin ledger finalization

- **Goal:** `/v1/gamification/status|rewards|redeem|ledger`, `/v1/referrals` GET + `/invite`; upgrade `coins.py` with levels/streaks.
- **Depends on:** Day 9 Task A1 (`app/services/coins.py`); Day 12 Task A2 (`spend_coins`, `InsufficientCoins`).
- **Files to create/modify:**
  - `backend/app/services/coins.py` (modify — levels + streaks)
  - `backend/app/models/gamification.py` (new)
  - `backend/app/data/rewards_seed.py` (new)
  - `backend/app/routers/gamification.py` (new)
  - `backend/app/routers/referrals.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_gamification.py` (new)
- **Subtasks:**
  1. Extend `backend/app/services/coins.py` — after every `award_coins`:
     - Level thresholds `[0, 500, 1500, 3000, 6000]` → `krishiRatnaLevel` 1–5 with titles `["Krishi Yuva", "Krishi Daksh", "Krishi Praveen", "Krishi Ratna", "Krishi Samrat"]`; set both fields on the user doc.
     - Streak: compare last ledger entry date — yesterday → `streakDays += 1`; today → unchanged; older → `1`.
  2. Write `backend/app/models/gamification.py`:
     - `class GamificationStatus(BaseModel)`: `krishiRatnaLevel: int`, `krishiRatnaTitle: str`, `agriCoins: int`, `streakDays: int`, `xpToNextLevel: int`
     - `class Reward(BaseModel)`: `id: str`, `title: str`, `coinCost: int`, `type: Literal["voucher", "service", "discount"]`
     - `class RedeemIn(BaseModel)`: `rewardId: str`
     - `class LedgerEntry(BaseModel)`: `id`, `amount: int`, `reason`, `refId: str | None`, `at`
  3. Write `backend/app/data/rewards_seed.py` (idempotent; collection `rewards`): the 3 prototype rewards — `₹200 IFFCO voucher` 300 coins `voucher`; `Free soil test` 500 `service`; `1-on-1 scientist video call` 800 `service`.
  4. Write `backend/app/routers/gamification.py` (`prefix="/gamification"`, all roles):
     - `GET /status`: from user doc; `xpToNextLevel = next threshold - agriCoins` (0 at max level).
     - `GET /rewards`: envelope.
     - `POST /redeem`: 404 `REWARD_NOT_FOUND`; `InsufficientCoins` → 409 `INSUFFICIENT_COINS` message `पर्याप्त कॉइन नहीं`; `spend_coins(uid, reward.coinCost, "redeem", rewardId)`; `couponCode = "KC-" + uuid4().hex[:8].upper()` when `type == "voucher"` else None; 200 `{ "newBalance": int, "couponCode": str | None }`.
     - `GET /ledger`: `users/{uid}/coin_ledger` desc by `at`; envelope (pageSize 20).
  5. Write `backend/app/routers/referrals.py` (`prefix="/referrals"`, all roles):
     - `GET /referrals`: if user doc lacks `referralCode` → set `uppercase(name without spaces) + join year` (e.g. `RAMSINGH2026`); milestones fixed `[{count: 1, reward: "+100 coins"}, {count: 5, reward: "Free soil test"}, {count: 10, reward: "₹500 equipment discount"}]` each with `achieved: len(referred) >= count`; `referred` = docs in `users/{uid}/referrals` shaped `{ id, farmerName, village, phone, joinDate, status, rewardCoins }`. Response `{ referralCode, milestones, referred }`.
     - `POST /referrals/invite`: body `{ farmerName: str, phone: str }` (phone must start `+91`, 13 chars → 422); phone already in user's referrals → 409 `ALREADY_INVITED`; write referral doc `{ farmerName, phone, status: "Joined", rewardCoins: 100, joinDate: today }`; `award_coins(uid, 100, "referral", ref_id)`; call `sms_service.send_invite(phone, referralCode)` — create `backend/app/services/sms.py` with a log-only stub; return 201 `{ "agriCoinsEarned": 100 }`.
  6. **Coin-hook audit:** `grep -rn "award_coins" backend/app/routers` must show: diary POST (+15, Day 9), urgent-task complete (+50, Day 4/5), equipment slot book (+50, Day 8), expert-talk register (+25, Day 12), referral invite (+100, today). Add any missing call; each endpoint response includes its `agriCoinsEarned`.
  7. `app.include_router(gamification.router, prefix="/v1")`; same for referrals.
  8. Write `backend/tests/test_gamification.py`:
     - `test_level_up_at_500`: award 600 → `krishiRatnaLevel == 2`, `krishiRatnaTitle == "Krishi Daksh"`, `GET /status` → `xpToNextLevel == 900`.
     - `test_redeem_voucher`: balance 600, redeem 300-coin voucher → 200, `newBalance == 300`, `couponCode` starts `KC-`.
     - `test_redeem_insufficient_409`: balance 300, 800-coin reward → 409 `INSUFFICIENT_COINS` with Hindi message.
     - `test_ledger_signed_entries`: after award + redeem → entries `+600` and `-300` present.
     - `test_invite_awards_100`: → 201 `agriCoinsEarned == 100`; duplicate phone → 409 `ALREADY_INVITED`.
     - `test_referrals_milestones`: after 1 invite → milestones[0].achieved == True, others False; `referralCode` non-empty.
- **Test:** `cd backend && .venv/bin/pytest tests/test_gamification.py -v`
- **Expected output:** `6 passed`.

### Task A4 — FCM send helper + notifications read

- **Goal:** `app/services/fcm.py` (send + prune dead tokens), `GET /v1/notifications`, `POST /v1/notifications/read`; wire claim status changes to notify (proves the path end-to-end).
- **Depends on:** Day 10 Task A5 (`users/{uid}/devices`); Day 11 Task A2 (`claims.advance_status`).
- **Files to create/modify:**
  - `backend/app/services/fcm.py` (new)
  - `backend/app/routers/notifications.py` (new)
  - `backend/app/services/claims.py` (modify — notify on transition)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_notifications.py` (new)
- **Subtasks:**
  1. Write `backend/app/services/fcm.py`:
     - `async def send_to_user(uid: str, title: str, body: str, data: dict = {}) -> int`: read all `users/{uid}/devices` tokens; if none → 0. `firebase_admin.messaging.send_each_for_multicast(MulticastMessage(tokens=..., notification=Notification(title=title, body=body), data={k: str(v) for k, v in data.items()}))`; prune tokens whose response error is `UnregisteredError` (delete device doc); return success count. Wrap everything in try/except — log and return 0, never raise into routers. Dev mode (no service account): log-only, return 0.
     - `async def notify(uid, title, body, data={})`: write `users/{uid}/notifications/{id}` `{ title, body, type: data.get("type"), read: false, createdAt: iso }`, then `send_to_user`.
  2. Write `backend/app/routers/notifications.py` (`prefix="/notifications"`, all roles):
     - `GET /`: list `users/{uid}/notifications` desc; envelope.
     - `POST /read`: body `{ "notificationIds": list[str] }` (empty list = mark all unread); set `read: true`; 200 `{ "markedRead": n }`.
  3. In `backend/app/services/claims.py` `advance_status`: after a successful transition, `await notify(uid, f"दावा अपडेट: {claim['claimNumber']}", STATUS_TEXT[new_status], {"type": "claim", "claimId": claim["id"]})` (pass `uid` in — extend the signature; update Day 11 callers).
  4. `app.include_router(notifications.router, prefix="/v1")`.
  5. Write `backend/tests/test_notifications.py`:
     - `test_mark_read`: seed 2 unread → POST `read` with both ids → `{ "markedRead": 2 }`; GET → both `read == true`.
     - `test_mark_all_with_empty_list`: POST `{"notificationIds": []}` → all marked.
     - `test_advance_status_notifies`: patch `app.services.fcm.notify`; legal transition → assert called with claimNumber in title and `data["type"] == "claim"`.
     - `test_unregistered_token_pruned`: mock `send_each_for_multicast` returning one `UnregisteredError` response → that device doc deleted, return count 0.
     - `test_notify_writes_firestore_doc`: `notify(...)` → doc in `users/{uid}/notifications` with `read == false`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_notifications.py -v`
- **Expected output:** `5 passed`.

## Dev B — Flutter tasks

### Task B1 — Wire Kisan Mitra chatbot + voice assistant sheets

- **Goal:** Connect the ported sheets to `/v1/chatbot/*`.
- **Depends on:** Day 5 port of `apps/mobile/lib/components/voice/kisan_mitra_chatbot_sheet.dart` and `voice_assistant_sheet.dart` (copied from `flutter-prototype/lib/components/voice/`). API dependency: Day 13 Task A1.
- **Files to create/modify:**
  - `apps/mobile/lib/components/voice/kisan_mitra_chatbot_sheet.dart` (modify — wire)
  - `apps/mobile/lib/components/voice/voice_assistant_sheet.dart` (modify — wire)
  - `apps/mobile/lib/api/chatbot_api.dart` (new — `sendMessage`, `getHistory`, `requestHandoff`)
  - `apps/mobile/lib/models/kisan_mitra_message.dart` (new)
  - `apps/mobile/lib/state/app_state.dart` (modify — add `chatSessionId = const Uuid().v4()` per app run; add `uuid: ^4.5.1` to pubspec)
  - `apps/mobile/test/chatbot_sheet_test.dart` (new)
- **Subtasks:**
  1. `kisan_mitra_message.dart`: `fromJson` for `{id, sender, text, timestamp, quickReplies, richCardType, richCardData}`.
  2. Chatbot sheet: replace the prototype's canned bot replies with `ChatbotApi.sendMessage(text, language: currentLocale, sessionId: AppState.chatSessionId)`; animated 3-dot typing indicator while awaiting; render the returned message: bubble + `quickReplies` chips (tap = send as next message) + the prototype's 4 rich-card widgets (saturation/weather/mandi/pest) fed from `richCardData` — render a card only when `richCardType != null`.
  3. Handoff banner (keep prototype UI) → `requestHandoff(sessionId, reason)` → on 200 replace with a card: `expertName`, `contactChannel`, `ETA {etaMinutes} मिनट`.
  4. On sheet open: `getHistory(sessionId)` — restore prior messages when non-empty.
  5. Voice sheet: mic toggle keeps the prototype animation; since audio recording is out of scope today, on mic-stop show hint `आवाज़ जल्द आ रही है` and fall back to the 5 quick-prompt chips — each routes through the same `sendMessage` and renders the reply text + speaker icon (TTS stays the prototype placeholder).
  6. `apps/mobile/test/chatbot_sheet_test.dart`:
     - `testWidgets('chat sends message and renders bot reply', ...)` — fake api returns bot text; expect it in the tree.
     - `testWidgets('quick replies render as chips', ...)` — fake `quickReplies: ["a", "b"]` → 2 chips; tapping one calls `sendMessage` with `"a"`.
     - `testWidgets('mandi rich card renders', ...)` — fake `richCardType: "mandi"` + data → expect crop/price strings.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/chatbot_sheet_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: ask `आज प्याज का भाव क्या है?` → Hindi reply + mandi card + quick-reply chips.

### Task B2 — Port Advisory view (5 tabs)

- **Goal:** Port `advisory_view.dart` wired to `/v1/advisory/*`.
- **Depends on:** Day 3 Task B1; `image_picker` (Day 11). API dependency: Day 13 Task A2.
- **Files to create/modify:**
  - `apps/mobile/lib/views/advisory_view.dart` (modify — port from `flutter-prototype/lib/views/advisory_view.dart`)
  - `apps/mobile/lib/api/advisory_api.dart` (new)
  - `apps/mobile/lib/models/advisory_models.dart` (new)
  - `apps/mobile/test/advisory_view_test.dart` (new)
- **Subtasks:**
  1. Copy the view verbatim — tabs बाज़ार संतृप्ति / रोग स्कैन / NPK / कीट रडार / किसान मित्र.
  2. Saturation tab: crop dropdown + district (prefill profile) + radius slider 5–20 km → `POST /saturation` (send `shareSowingIntent: true` by default with the prototype's opt-in copy); render sowingCount, expectedArrivalIncrease, risk meter (green `0xFF43A047` / yellow `0xFFF59E0B` / red `0xFFE53935`), predictedPrice + date, alternative-crop cards; chatbot-handoff button opens the sheet from Task B1.
  3. Disease scan: camera/gallery via `image_picker` → preview → `POST /disease-scan` multipart → result card (diseaseName, pathogen, confidence %, symptoms, chemical + organic boxes, dosage, estimatedCost); on 413/415 → `फोटो अमान्य/बहुत बड़ी है`.
  4. NPK: 3 sliders → button `सिफारिश देखें` → `POST /npk` → recommendation strings + urea/DAP/MOP amounts.
  5. Pest radar: `GET /pest-radar?lat=&lng=` (profile farm location) → alert cards with risk-colored chips.
  6. `apps/mobile/test/advisory_view_test.dart`:
     - `testWidgets('advisory renders 5 tabs', ...)` — expect the 5 tab labels.
     - `testWidgets('saturation risk meter renders', ...)` — fake red result → expect the prototype's red-risk label (e.g. `उच्च जोखिम` — use the exact prototype string).
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/advisory_view_test.dart`
- **Expected output:** `No issues found!`; 2 tests pass; manual: saturation meter changes color with backend-seeded counts.

### Task B3 — Port Krishi Ratna + Refer & Earn views

- **Goal:** Port `krishi_ratna_view.dart` and `refer_earn_view.dart` wired to `/v1/gamification/*` and `/v1/referrals`.
- **Depends on:** Day 3 Task B1. API dependency: Day 13 Task A3.
- **Files to create/modify:**
  - `apps/mobile/lib/views/krishi_ratna_view.dart` (modify — port from prototype)
  - `apps/mobile/lib/views/refer_earn_view.dart` (modify — port from prototype)
  - `apps/mobile/lib/api/gamification_api.dart` (new — `getStatus`, `getRewards`, `redeem`, `getLedger`)
  - `apps/mobile/lib/api/referrals_api.dart` (new — `getReferrals`, `invite`)
  - `apps/mobile/test/gamification_views_test.dart` (new)
- **Subtasks:**
  1. Krishi Ratna: level banner ← `getStatus()` (level, title, coin balance, streak, progress to `xpToNextLevel`); rewards grid ← `getRewards()`; redeem → confirm dialog `{coinCost} कॉइन खर्च करें?` → `redeem` → on 200 show coupon dialog with `couponCode` (voucher) or `सेवा जल्द उपलब्ध होगी` (service) + refresh balance; on `INSUFFICIENT_COINS` → SnackBar `पर्याप्त कॉइन नहीं`; ledger bottom sheet ← `getLedger()` (±amount, reason, date).
  2. Refer & Earn: referral code card + copy-to-clipboard (`Clipboard.setData` → SnackBar `कोड कॉपी हुआ`) + WhatsApp share (`url_launcher` wa.me with prefilled Hindi text + code); milestones row (achieved = filled green); invite dialog (name + 10-digit phone → normalize `+91`) → `invite` → 201 SnackBar `+100 AgriCoins मिले!`; on `ALREADY_INVITED` → `पहले से आमंत्रित`; referred list with status chips (Joined/Verified/Active).
  3. `apps/mobile/test/gamification_views_test.dart`:
     - `testWidgets('krishi ratna renders level banner', ...)` — fake level 2 → expect `Krishi Daksh` and balance.
     - `testWidgets('rewards grid renders 3 rewards', ...)` — fake 3 rewards → 3 cards with coin costs.
     - `testWidgets('referral code renders', ...)` — fake `RAMSINGH2026` visible.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/gamification_views_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: add a diary entry (+15) → reopen Krishi Ratna → balance increased.

### Task B4 — FCM client setup (Android)

- **Goal:** Push notifications end-to-end: token registration, foreground/background display, deep-link routing.
- **Depends on:** Day 1 Firebase wiring in `apps/mobile`. API dependency: Day 10 Task A5 (`POST /v1/devices`), Day 13 Task A4 (server sends).
- **Files to create/modify:**
  - `apps/mobile/pubspec.yaml` (modify — add `firebase_messaging: ^15.1.5`, `flutter_local_notifications: ^18.0.1`)
  - `apps/mobile/lib/services/push_service.dart` (new)
  - `apps/mobile/lib/main.dart` (modify — init + background handler)
  - `apps/mobile/android/app/src/main/AndroidManifest.xml` (modify)
- **Subtasks:**
  1. `push_service.dart`: `class PushService { static Future<void> init() }` — `FirebaseMessaging.instance.requestPermission()`; `getToken()` → `POST /v1/devices {fcmToken, platform: "android", locale}` via the api client (skip when unauthenticated; retry on next login); `onTokenRefresh` → same POST; on logout → `DELETE /v1/devices/{tokenHash}` (sha256-16, matching the backend key scheme).
  2. Foreground: `FirebaseMessaging.onMessage.listen` → display via `flutter_local_notifications` (channel id `kisan_setu_default`, name `Kisan Setu`, importance high).
  3. Background/terminated: top-level `@pragma('vm:entry-point') Future<void> firebaseMessagingBackgroundHandler(RemoteMessage m)` in `main.dart`, registered with `FirebaseMessaging.onBackgroundMessage(...)` before `runApp`.
  4. Tap routing: `onMessageOpenedApp` + `getInitialMessage()` → route by `data["type"]`: `claim` → cropInsurance; `booking` → myBookings; default → `notifications` view.
  5. `AndroidManifest.xml`: inside `<application>` add `<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="kisan_setu_default"/>`; ensure the `FLUTTER_NOTIFICATION_CLICK` intent-filter exists on MainActivity.
  6. Token hash: mirror the backend's device key — `sha256(token).hex.substring(0, 16)` (add `crypto: ^3.0.3` to pubspec if absent) so `DELETE /v1/devices/{tokenHash}` targets the right doc.
  7. Unit-test the pure pieces: `apps/mobile/test/push_service_test.dart` — `test('token hash matches backend scheme', ...)` asserting the sha256-16 of a fixed token equals the expected hex.
- **Test:** `cd apps/mobile && flutter analyze` → 0 issues. Manual checklist (no widget test for FCM): Firebase console test message to the device token → foreground banner; app backgrounded → system-tray notification; tap a `type=claim` message → crop insurance opens; after fresh login the backend `users/{uid}/devices` has ≥ 1 doc.
- **Expected output:** Token registered server-side; Day 13's claim-transition notification arrives on the device.

## Done-when checklist (end of day)

- [ ] `cd backend && .venv/bin/pytest tests/test_chatbot.py tests/test_advisory.py tests/test_gamification.py tests/test_notifications.py -v` → 22 passed; full suite green.
- [ ] Chatbot: 2-turn context retention asserted; LLM outage → Hindi fallback with HTTP 200; `भाव` → mandi rich card.
- [ ] Saturation risk flips with seeded `crop_cycles` counts; opt-out (`shareSowingIntent: false`) writes nothing.
- [ ] Coin economy loop: earn → level-up → redeem → 409 on insufficient → ledger signs correct; `grep -rn "award_coins" backend/app/routers` shows all 5 hook sites.
- [ ] Claim status transition triggers `notify` (mocked assertion) and a Firestore notification doc.
- [ ] `flutter analyze` 0 issues; 8 new widget tests pass.
- [ ] Manual: Hindi chatbot with quick replies + rich card; advisory 5 tabs; Krishi Ratna balance reflects diary earnings; FCM push received foreground + background; `type=claim` tap deep-links.
- [ ] Token-hash helper unit test passes; device doc key matches `sha256-16` on both sides.

---

## Additional tasks (from missing.md)

Covers: F20 expert-handoff support threads, X21 real STT/TTS, X4 SMS sender, X11 coin caps, X3 deep-link router. Specs: docs/overview/03 Part C/D items F20, X21, X4, X11, X3 — the spec item wins on any divergence.

### Task A5 — Expert-handoff support threads (F20)

- **Goal:** Chatbot handoff creates a `support_threads` doc; `GET/POST /v1/support/threads/{id}/messages` let the farmer see and answer expert replies. Spec: docs/overview/03 Part C item F20.
- **Depends on:** Day 13 Task A1 (`POST /chatbot/handoff`).
- **Files to create/modify:**
  - `backend/app/routers/support.py` (new)
  - `backend/app/routers/chatbot.py` (modify — handoff creates the thread)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_support.py` (new)
- **Subtasks:**
  1. Modify Day 13 Task A1's handoff: besides `handoff_requests/{id}`, also create `support_threads/{threadId}` `{ userId, sessionId, expertName, status: "open", createdAt, lastMessageAt }`; the handoff response gains `threadId` (additive field).
  2. Write `backend/app/routers/support.py` (`prefix="/support"`, all roles):
     - `GET /threads`: own threads, `lastMessageAt` desc; envelope.
     - `GET /threads/{id}/messages`: thread must belong to the user (404 `THREAD_NOT_FOUND`); messages from `support_threads/{id}/messages` ascending; envelope.
     - `POST /threads/{id}/messages`: body `{ text: str = Field(min_length=1, max_length=1000) }`; write `{ sender: "user", text, at }`, bump `lastMessageAt`; 201 the message doc. Expert replies come from the admin side (Day 14) writing `sender: "expert"` docs into the same subcollection.
  3. `app.include_router(support.router, prefix="/v1")`.
  4. Write `backend/tests/test_support.py`:
     - `test_handoff_creates_thread`: POST handoff → response has `threadId`; `GET /support/threads` lists it with `status == "open"`.
     - `test_post_message_and_list`: POST message → 201 `sender == "user"`; GET messages → 1 item; thread `lastMessageAt` bumped.
     - `test_foreign_thread_404`: user B → 404 `THREAD_NOT_FOUND` on both message routes.
     - `test_expert_message_visible`: seed an expert message doc → GET shows `sender == "expert"` interleaved correctly.
- **Test:** `cd backend && .venv/bin/pytest tests/test_support.py -v`
- **Expected output:** `4 passed`.

### Task A6 — Speech service: real STT + TTS stubs (X21)

- **Goal:** `POST /v1/speech/stt` (multipart audio ≤ 60 s, m4a/wav → `{text, language}`) via Sarvam with a dev-mode canned response; `POST /v1/speech/tts` `{text, language}` → `{audioUrl}` via a Bhashini stub returning a cached sample. Spec: docs/overview/03 Part C item X21.
- **Depends on:** Day 13 Task A1 (`sarvam_stt` in `app/services/llm.py` — move it into the new speech service and keep a re-export so the chatbot router doesn't change); Day 10 Task A2 (storage upload for TTS output, later).
- **Files to create/modify:**
  - `backend/app/services/speech.py` (new)
  - `backend/app/services/llm.py` (modify — `sarvam_stt` delegates to `speech.stt`)
  - `backend/app/routers/speech.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_speech.py` (new)
- **Subtasks:**
  1. Write `backend/app/services/speech.py`:
     - `async def stt(audio_bytes: bytes, content_type: str, language_hint: str | None = None) -> dict`: dev mode (`settings.sarvam_api_key` empty) → canned `{ "text": "आज प्याज का भाव क्या है?", "language": "hi" }`; else POST to Sarvam's STT API (`https://api.sarvam.ai/speech-to-text`, model `saarika`, multipart `file`) and map the response. Wrap errors → raise `SpeechUnavailable` (routers map to 503 `SPEECH_UNAVAILABLE`, never a bare 500).
     - `async def tts(text: str, language: str) -> str`: Bhashini stub — return a cached sample URL `https://example.com/tts-sample.mp3` in dev mode; the real path calls the Bhashini TTS endpoint (ULCA pipeline) and uploads the resulting wav via `storage.upload_user_file(uid, ..., prefix="tts")` → signed URL. Keep behind this one function.
  2. Write `backend/app/routers/speech.py` (`prefix="/speech"`, all roles):
     - `POST /stt`: multipart `file` — content type in `{audio/mp4, audio/x-m4a, audio/wav, audio/x-wav}` else 415 `UNSUPPORTED_FILE_TYPE`; > 5 MB → 413 `FILE_TOO_LARGE`; duration ≤ 60 s is the client contract — server cannot measure cheaply, so enforce by size (5 MB ≈ 60 s of m4a at typical bitrates) and note it in a comment; optional form field `languageHint`. 200 `{ "text": ..., "language": ... }`.
     - `POST /tts`: JSON `{ text: str = Field(min_length=1, max_length=500), language: str = "hi" }`; 200 `{ "audioUrl": ... }`.
  3. `app.include_router(speech.router, prefix="/v1")`.
  4. Write `backend/tests/test_speech.py` (dev mode — both endpoints exercised against the canned/stub paths):
     - `test_stt_canned_dev_mode`: small fake wav → 200, `text` non-empty, `language == "hi"`.
     - `test_stt_bad_type_415`: `text/plain` upload → 415.
     - `test_stt_oversize_413`: 6 MB body → 413.
     - `test_tts_stub_returns_url`: → 200, `audioUrl` starts with `http`.
     - `test_tts_empty_text_422`: → 422.
- **Test:** `cd backend && .venv/bin/pytest tests/test_speech.py -v`
- **Expected output:** `5 passed`. Manual: `curl -X POST http://localhost:8000/v1/speech/stt -H "Authorization: Bearer $TOKEN" -F "file=@/tmp/a.m4a"` → 200 with canned text; `curl -X POST http://localhost:8000/v1/speech/tts -H ... -d '{"text":"नमस्ते","language":"hi"}'` → `audioUrl`.

### Task A7 — SMS sender service + cancel/reminder hooks (X4)

- **Goal:** MSG91-backed SMS sender with dev-mode log-only, replacing the print stubs on equipment cancel + 30-min reminder hooks. Spec: docs/overview/03 Part C item X4.
- **Depends on:** Day 13 Task A3 (`backend/app/services/sms.py` log-only stub with `send_invite`); Day 8 equipment cancel + reminder hooks (the print stubs there).
- **Files to create/modify:**
  - `backend/app/services/sms.py` (modify — real interface + MSG91 impl)
  - `backend/app/routers/equipment.py` (modify — Day 8 file; replace print stubs)
  - `backend/app/services/reminders.py` (modify — Day 8 30-min reminder; replace print stub)
  - `backend/tests/test_sms.py` (new)
- **Subtasks:**
  1. Rework `backend/app/services/sms.py`:
     - `class SmsSender(Protocol): async def send(self, phone: str, template_id: str, params: dict) -> bool`.
     - `class Msg91Sender`: POST `https://control.msg91.com/api/v5/flow/` with `authkey` header from env `MSG91_AUTH_KEY`, body `{template_id, recipients: [{mobiles: phone without "+", **params}]}`. Comment: templates must be DLT-registered (India TRAI rule) — template IDs live in `app/core/config.py` settings.
     - `class LogOnlySender`: logs `SMS(dev) to <phone> template=<id> params=<params>` and returns True. Default when `MSG91_AUTH_KEY` empty.
     - `def get_sms_sender() -> SmsSender` env-selected; keep `send_invite(phone, code)` as a thin wrapper using the `invite` template.
  2. Replace the Day 8 print stubs: equipment cancel → `send(owner_phone, "equipment_cancel_owner", {equipment, date, slot})`; 30-min booking reminder → `send(farmer_phone, "equipment_reminder", {equipment, slot})`.
  3. Write `backend/tests/test_sms.py`:
     - `test_dev_mode_logs_only`: with no key, `get_sms_sender()` is `LogOnlySender`; `send` returns True and logs (caplog assertion).
     - `test_cancel_hook_sends_sms`: cancel an equipment booking (Day 8 flow) → patched sender's `send` called with the owner phone and template `equipment_cancel_owner`.
     - `test_reminder_hook_sends_sms`: trigger the 30-min reminder path → farmer phone receives `equipment_reminder`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_sms.py -v`
- **Expected output:** `3 passed`; `grep -rn "print(" backend/app/routers/equipment.py backend/app/services/reminders.py` returns nothing.

### Task A8 — Coin abuse guards: daily caps (X11)

- **Goal:** Max 200 coins earned/day and max 1 redemption/day, enforced in the coins service. Spec: docs/overview/03 Part C item X11.
- **Depends on:** Day 13 Task A3 (`coins.py` with ledger + `spend_coins`).
- **Files to create/modify:**
  - `backend/app/services/coins.py` (modify — cap logic)
  - `backend/app/routers/gamification.py` (modify — redemption cap)
  - `backend/tests/test_gamification.py` (modify — append 2 tests)
- **Subtasks:**
  1. In `award_coins`: before awarding, sum today's positive ledger entries (`users/{uid}/coin_ledger` where `at` starts with today's date and `amount > 0`); clamp the award to `max(0, 200 - earned_today)` — a fully-capped call awards 0, still writes a ledger entry of `+0` marked `reason: "<original>_capped"` (auditability), and returns the unchanged balance. Endpoints keep returning `agriCoinsEarned` — the clamped value (0) so the UI SnackBar can show `+0` — acceptable for v1.
  2. Redemption cap: in `POST /gamification/redeem`, count today's ledger entries with `reason == "redeem"`; ≥ 1 → 409 `REDEMPTION_LIMIT_REACHED` (message `आज की रिडीम सीमा पूरी — कल फिर कोशिश करें`). Check runs before `spend_coins`.
  3. Tests appended to `backend/tests/test_gamification.py`:
     - `test_daily_earn_cap_clamps`: award 150, then award 100 → second call credits 50; a third award credits 0 and the balance stays 200 over seed.
     - `test_daily_redemption_cap`: redeem once → 200 OK; second redeem same day → 409 `REDEMPTION_LIMIT_REACHED` with the Hindi message.
- **Test:** `cd backend && .venv/bin/pytest tests/test_gamification.py -v`
- **Expected output:** `8 passed` (6 existing + 2 new). Note: existing tests that seed balances by writing the user doc directly (not via `award_coins`) are unaffected.

### Task B5 — Handoff support-thread chat screen (F20)

- **Goal:** The chatbot handoff banner opens a thread screen where expert replies arrive. Spec: docs/overview/03 Part D item F20. API dependency: Day 13 Task A5.
- **Depends on:** Day 13 Task B1 (chatbot sheet + handoff banner); Day 13 Task A5.
- **Files to create/modify:**
  - `apps/mobile/lib/views/support_thread_view.dart` (new screen)
  - `apps/mobile/lib/api/support_api.dart` (new — `listThreads`, `listMessages`, `postMessage`)
  - `apps/mobile/lib/components/voice/kisan_mitra_chatbot_sheet.dart` (modify — handoff card becomes a button)
  - `apps/mobile/lib/state/profile_routes.dart` (modify — route `supportThread`, all personas)
  - `apps/mobile/test/support_thread_view_test.dart` (new)
- **Subtasks:**
  1. After a successful handoff, the card's `expertName` area becomes tappable (`थ्रेड खोलें →`) → push `supportThread` with the `threadId` from the response.
  2. `support_thread_view.dart`: app bar `विशेषज्ञ वार्तालाप`; message bubbles — expert left (green tint), user right; poll `listMessages(threadId)` every 5 s while open (Timer, cancelled in dispose — same pattern as Day 12 channel chat); input row → `postMessage` → append locally + refetch; empty state `विशेषज्ञ जल्द जवाब देंगे`.
  3. `apps/mobile/test/support_thread_view_test.dart`:
     - `testWidgets('thread renders expert and user bubbles', ...)` — fake 1 expert + 1 user message → both texts visible.
     - `testWidgets('send posts message', ...)` — type + send → fake recorded `postMessage(threadId, text)`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/support_thread_view_test.dart`
- **Expected output:** `No issues found!`; 2 tests pass; manual: handoff → open thread → expert reply (seeded in Firestore) appears within 5 s.

### Task B6 — Real mic recording → STT → chatbot, audio buttons → TTS (X21)

- **Goal:** `voice_assistant_sheet` mic records real audio and routes through STT into the chatbot; news/blog/chat audio buttons call TTS and play the result. Spec: docs/overview/03 Part D item X21. API dependency: Day 13 Task A6.
- **Depends on:** Day 13 Task B1 (voice sheet + chatbot api); Day 13 Task A6.
- **Files to create/modify:**
  - `apps/mobile/pubspec.yaml` (modify — add `record: ^5.1.1`, `audioplayers: ^5.2.1`; both go on the allowed-packages list)
  - `apps/mobile/lib/components/voice/voice_assistant_sheet.dart` (modify — real recording)
  - `apps/mobile/lib/api/speech_api.dart` (new — `stt(filePath, languageHint)`, `tts(text, language)`)
  - `apps/mobile/lib/components/audio_button.dart` (new or modify the existing placeholder — TTS playback)
  - `apps/mobile/test/voice_assistant_sheet_test.dart` (modify — replace the "आवाज़ जल्द आ रही है" expectation)
- **Subtasks:**
  1. Mic toggle → request mic permission (`record` handles it) → `AudioRecorder.start(RecordConfig(encoder: AudioEncoder.aacLc), path: <tmp>/voice_<ts>.m4a)`; stop enforces the 60 s cap (auto-stop timer); on stop → `speech_api.stt(path)` multipart → the returned `text` goes into `ChatbotApi.sendMessage` and is shown as the user's bubble; on `SPEECH_UNAVAILABLE` → `आवाज़ सेवा उपलब्ध नहीं — टाइप करके पूछें`.
  2. Audio buttons (news `audioText`, blog readout, chatbot reply speaker icon): → `tts(text, language)` → `AudioPlayer().play(UrlSource(audioUrl))`; playing state swaps the icon to a stop/pause glyph; keep the Day 12 "UI-only" comments removed where now wired.
  3. Web guard: recording path is `if (!kIsWeb)` — on web keep the quick-prompt chips (record plugin support is limited); note in the file.
  4. Tests: inject the recorder + speech api; `testWidgets('mic stop routes stt text into chatbot', ...)` — fake stt returns `आज का भाव?` → fake chatbot recorded that text. Remove/replace the old `आवाज़ जल्द आ रही है` assertion.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/voice_assistant_sheet_test.dart`
- **Expected output:** `No issues found!`; updated tests pass; manual on emulator: mic → spoken question → chatbot answers; speaker icon on a bot reply plays the sample audio.

### Task B7 — Notification deep-link router (X3)

- **Goal:** Canonical `type → route` map for FCM/notification taps, per the spec table. Spec: docs/overview/03 Part D item X3.
- **Depends on:** Day 13 Task B4 (`push_service.dart`); Day 11 Task B3 (claim deep-link with `initialTab`).
- **Files to create/modify:**
  - `apps/mobile/lib/services/deep_link_router.dart` (new)
  - `apps/mobile/lib/services/push_service.dart` (modify — delegate to the router)
  - `apps/mobile/lib/views/account/notifications_view.dart` (modify — row taps route through it)
  - `apps/mobile/test/deep_link_router_test.dart` (new)
- **Subtasks:**
  1. Write `deep_link_router.dart`: `class DeepLinkRouter { static RouteTarget resolve(Map<String, String> data) }` implementing the spec table — `claim` → `cropInsurance` with `initialTab: 3` + `claimId`; `booking` → `myBookings`; `rate_approved` → `mandi`; `settlement` → `settlements`; `rent_reminder` → `landlordRent`; `scheme_deadline` → `schemes`; `weather_alert` → home; unknown/absent type → `notifications` view (the Day 13 default). `RouteTarget` carries the route name + arguments map; persona-gated targets fall back to `notifications` when the active profile lacks access (check `profile_routes.dart`).
  2. `push_service.dart` tap handlers and the notifications-view row tap both call `DeepLinkRouter.resolve(data)` — no per-call-site switch statements left.
  3. `apps/mobile/test/deep_link_router_test.dart` (widget-level, pump a harness with the route table):
     - `testWidgets('claim payload routes to tracker tab', ...)` — `{type: "claim", claimId: "x"}` → cropInsurance with `initialTab == 3`.
     - `testWidgets('unknown type falls back to notifications', ...)` — `{type: "mystery"}` → notifications route.
     - `testWidgets('missing type falls back', ...)` — empty data → notifications.
     - `testWidgets('persona-gated target falls back', ...)` — `rent_reminder` while active profile is `seller` → notifications.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/deep_link_router_test.dart`
- **Expected output:** `No issues found!`; 4 tests pass; manual: send test FCM with each `type` → correct screen opens.

### Done-when additions (additional tasks)

- [ ] `cd backend && .venv/bin/pytest tests/test_support.py tests/test_speech.py tests/test_sms.py tests/test_gamification.py -v` → 20 passed; full suite green.
- [ ] Handoff response carries `threadId`; thread messages round-trip; foreign thread → 404.
- [ ] STT/TTS pytest green in dev mode (canned/stub paths); 413/415/422 edges covered.
- [ ] SMS: dev-mode log-only default; equipment cancel + 30-min reminder hooks call the sender (no `print(` left in those files).
- [ ] Coin caps: 200/day earn clamp with `+0` audit ledger entry; 1 redemption/day → 409 `REDEMPTION_LIMIT_REACHED`.
- [ ] `flutter analyze` 0 issues; 8 new widget tests pass (support 2, voice updated, deep-link 4).
- [ ] Manual: handoff thread shows expert reply; mic → STT → chatbot answer; audio button plays TTS; each FCM `type` deep-links per the spec table.
