# phase-06 — Task Queue
> Executor: read `execution-plan/AGENT_PLAYBOOK.md` first. Execute tasks top to
> bottom, one at a time. Mark [x] only when EXPECT matches real output.
> Full context for any task: see `instructions.md` WS-NN referenced in the task.

Conventions used below:
- "Backend pytest" commands run with cwd `backend/` unless stated otherwise.
- "Website" commands run with cwd `website/`.
- Dev servers for HUMAN CHECK tasks: backend = `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`; website = `cd website && pnpm dev` (Vite, port 5173, proxies to :8000).
- Design choices already made for you (do NOT revisit):
  - Chat moderation behavior = REJECT the violating message with a 422 error envelope (never store-and-hide).
  - Notification deep-link field name = `deepLink` (replaces `path` everywhere).
  - AI locale drafts live in `website/src/lib/i18n/drafts/{locale}.draft.ts` and are never imported by the i18n index (excluded from build until approved).
  - DPDP export endpoints live in a new `backend/app/routers/privacy.py`.
  - Search vectors are stored in a Firestore collection `search_index` (Redis is present in `backend/app/core/cache.py` but is NOT used for vectors).

## WS-01 — Chat hub + moderation pipeline + M6 guardrails  (see instructions.md §WS-01)

### Task 1.1 — Create pure regex moderation scanner
- DO: Create `backend/app/services/chat_moderation.py` (new). Module docstring states the moderation policy decision: "Violating chat messages are REJECTED with a 422 error envelope (code CHAT_MODERATION_VIOLATION); they are never stored." Add a pure function `scan(text: str) -> dict` returning `{"violation": bool, "kind": str | None}` with `kind` one of `"phone"`, `"upi"`, `"url"` (first match wins, checked in that order). Regexes: Indian mobile = optional `+91` / space / dash separators around `[6-9]\d{9}`; UPI handle = `[\w.\-]{2,}@[a-z]{2,}`; URL = `https?://`, `www\.`, or a bare domain with a common TLD (`\.(com|in|net|org|co)\b`). No Firestore or FastAPI imports in this function — it must be unit-testable in isolation.
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/chat_moderation.py`
- EXPECT: exit 0, no output.
- IF FAIL: fix the syntax error in `app/services/chat_moderation.py` and re-run.
- [ ]

### Task 1.2 — Add regex table tests for scan()
- DO: Create `backend/tests/test_chat_moderation.py` (new). Pure-function tests (no fixtures needed): assert `scan` flags each of `"call me 98765 43210"`, `"+91-9876543210"`, `"9876543210"` as `phone`; `"pay me at ramesh@okhdfc"` as `upi`; `"visit www.example.com"` and `"https://x.in"` and `"check example.com"` as `url`; assert `scan` returns `{"violation": False, "kind": None}` for `"pyaz ka bhav kya hai"`, `"I have 50 quintal onion"`, `"call the mandi office"`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_chat_moderation.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the regexes in `app/services/chat_moderation.py` (the test is the truth — never weaken the test) and re-run.
- [ ]

### Task 1.3 — Add strike-recording helpers
- DO: In `backend/app/services/chat_moderation.py` add two async helpers using `app.core.db` (`set_doc`, `query`, `get_doc`, `update_doc` — use whichever the existing services import): `async def record_strike(uid: str, kind: str, message_id: str | None, room_id: str | None) -> int` — writes a doc to subcollection `users/{uid}/chat_strikes` with fields `{kind, messageId, roomId, createdAt}` (ISO string), increments `chatStrikes` on the `users/{uid}` doc, applies the strike ladder: strike count 2 → set `chatMutedUntil` = ISO timestamp 24h in the future; strike count >= 3 → set `chatSuspended = True`; returns the new strike count. And `async def get_strike_state(uid: str) -> dict` returning `{"strikes": int, "mutedUntil": str | None, "suspended": bool}` read from the user doc (defaults: 0 / None / False).
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/chat_moderation.py`
- EXPECT: exit 0.
- IF FAIL: fix the import/syntax error and re-run.
- [ ]

### Task 1.4 — Enforce mute/suspension and scan in post_message
- DO: In `backend/app/routers/chat.py`, inside `post_message` (line ~165): (a) at the top, after loading the room, call `get_strike_state(uid)`; if `suspended` is True → `_error(403, "CHAT_SUSPENDED", "chat suspended pending admin review")`; if `mutedUntil` is set and is later than now (ISO compare) → `_error(403, "CHAT_MUTED", "chat muted for 24 hours")`. (b) Before the message write, call `scan(body.text)`; on violation call `record_strike(uid, kind, None, room_id)` and then `_error(422, "CHAT_MODERATION_VIOLATION", f"message blocked: {kind}")` — the message is never written. Import `scan`, `record_strike`, `get_strike_state` from `app.services.chat_moderation`.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/chat.py && .venv/bin/python -m pytest tests/test_chat_moderation.py -q`
- EXPECT: exit 0; existing scan tests still pass.
- IF FAIL: fix `app/routers/chat.py` wiring and re-run.
- [ ]

### Task 1.5 — Add endpoint tests for rejection and strike ladder
- DO: In `backend/tests/test_chat_moderation.py` add endpoint tests using the existing `client` fixture pattern from `backend/tests/conftest.py` (read it first; reuse its monkeypatch style): (1) open a direct chat then POST a message with text `"call me 98765 43210"` to `/v1/chat/rooms/{room_id}/messages` → expect HTTP 422 with `detail.code == "CHAT_MODERATION_VIOLATION"`, and a doc exists in the fake store under `users/uid-1/chat_strikes`. (2) Post a second violating message → 422 and user doc has `chatMutedUntil` set. (3) Third violating attempt → HTTP 403 with `detail.code == "CHAT_SUSPENDED"` (or `CHAT_MUTED` if still muted — assert whichever the ladder produces third, per your implementation, and state which in a test comment). (4) A clean message `"pyaz ka bhav?"` still returns 201.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_chat_moderation.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the ladder logic in `app/services/chat_moderation.py` / `app/routers/chat.py` and re-run. Never delete the failing assertion.
- [ ]

### Task 1.6 — Add Pillow dependency for EXIF stripping
- DO: Add the line `Pillow` to `backend/requirements.txt` (new line, keep file sorted as it already is). Then install it into the venv.
- RUN: `cd backend && .venv/bin/pip install Pillow -q && .venv/bin/python -c "import PIL.Image; print(PIL.Image.__version__ if hasattr(PIL.Image,'__version__') else 'ok')"`
- EXPECT: exit 0 and a version string (or `ok`) printed.
- IF FAIL: run `cd backend && .venv/bin/pip install -r requirements.txt` once, then re-run the check.
- [ ]

### Task 1.7 — Add strip_exif() with test
- DO: In `backend/app/services/chat_moderation.py` add `def strip_exif(image_bytes: bytes) -> bytes` using Pillow: open from `io.BytesIO`, create a clean image via `Image.new(img.mode, img.size)`, copy pixels (`clean.putdata(list(img.getdata()))`), save to a new BytesIO in the original format (default JPEG), return bytes. In `backend/tests/test_chat_moderation.py` add a test that builds a small JPEG in-memory, runs `strip_exif`, and asserts the output is valid JPEG bytes (`PIL.Image.open` succeeds) with no `exif` info.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_chat_moderation.py -q`
- EXPECT: exit 0.
- IF FAIL: fix `strip_exif` and re-run.
- [ ]

### Task 1.8 — Strip EXIF on chat image messages
- DO: In `backend/app/routers/chat.py` `post_message`: when `body.imageUrl` is non-empty, fetch the image bytes (use the existing storage helper in `backend/app/services/storage.py` — read it first and use its download/fetch function; if it has none, fetch via `httpx.AsyncClient.get`), run `strip_exif`, re-upload via the same storage service, and store the cleaned image's URL in the message doc instead of the original. This path must work with the AI module flag OFF (no AI calls here).
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/chat.py && .venv/bin/python -m pytest tests/test_chat_moderation.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the wiring in `app/routers/chat.py` and re-run.
- [ ]

### Task 1.9 — OCR scan of chat images behind AI flag
- PRECONDITION: `test -d backend/app/services/ai` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/app/routers/chat.py` `post_message`, after the EXIF strip: only when the chat-guardrail module flag is ON (use the same feature-flag mechanism the other AI modules use — read `backend/app/services/ai/` for the flag pattern), call `gateway.analyze_image()` from `backend/app/services/ai/gateway.py` on the stripped image bytes, extract any text, and run it through `chat_moderation.scan()`; a violation feeds the same strike ladder as task 1.4 (reject 422 + strike). With the flag off, OCR is skipped and the message posts normally. No image bytes, phone numbers, or emails in AI payloads beyond what the gateway pseudonymizes.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/chat.py && .venv/bin/python -m pytest tests/test_chat_moderation.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the wiring and re-run.
- [ ]

### Task 1.10 — Register chat.guardrail.v1 question set
- PRECONDITION: `test -f backend/app/services/ai/question_sets.py` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/app/services/ai/question_sets.py` register a new question set `chat.guardrail.v1` following the exact registration pattern already used in that file (read it first). Output schema: three booleans `shares_contact`, `shares_payment_handle`, `abuse`. Set its deterministic fallback to "not a violation" (all three booleans False) and its automation level to `suggest`. Include the threshold field the registry pattern requires.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai import question_sets; assert 'chat.guardrail.v1' in str(vars(question_sets)) or hasattr(question_sets, 'get') and question_sets.get('chat.guardrail.v1') is not None" 2>/dev/null || .venv/bin/python -c "import app.services.ai.question_sets as q; print([n for n in dir(q) if 'registry' in n.lower() or 'SETS' in n])"`
- EXPECT: exit 0 (the question set is importable/registered).
- IF FAIL: re-read `question_sets.py`, match its registration API exactly, and re-run.
- [ ]

### Task 1.11 — Add cost-saving heuristic pre-filter
- DO: In `backend/app/services/chat_moderation.py` add a pure function `needs_guardrail(text: str) -> bool` returning True when the text contains any digit spelled out (`zero`..`nine` in English, or Hindi numeral words `एक`,`दो`,`तीन`,`चार`,`पाँच`,`छह`,`सात`,`आठ`,`नौ`,`शून्य`) or any of the substrings `call`, `upi`, `whatsapp` (case-insensitive, any script — match the Devanagari forms `कॉल`, `यूपीआई`, `व्हाट्सएप` too). Add tests to `backend/tests/test_chat_moderation.py`: True for `"nine 8 two... call karna"`, `"mera whatsapp pe bhejo"`, `"पाँच आठ सात पर कॉल"`; False for `"50 quintal pyaz"`, `"mandi bhav batao"`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_chat_moderation.py -q`
- EXPECT: exit 0.
- IF FAIL: fix `needs_guardrail` and re-run.
- [ ]

### Task 1.12 — Wire guardrail decide into send path
- PRECONDITION: `test -d backend/app/services/ai` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/app/routers/chat.py` `post_message`, after the regex scan passes: if `needs_guardrail(body.text)` is True, build pseudonymized state via `backend/app/services/ai/privacy.py` (use its existing builder pattern — read it), call `gateway.decide(state, "chat.guardrail.v1", ctx)`. If the decision marks any of the three booleans True → treat as a violation of kind `"guardrail"`: `record_strike` + `_error(422, "CHAT_MODERATION_VIOLATION", ...)`. On any exception/timeout from the gateway → deterministic fallback: allow the message (log via the standard logger). Every call is logged to `ai_decisions` by the gateway — do not log raw message text containing contact info yourself. Launch level: `suggest` (no auto-punish beyond the same strike ladder a human-confirmed violation would get).
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/chat.py && .venv/bin/python -m pytest tests/test_chat_moderation.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the wiring and re-run.
- [ ]

### Task 1.13 — Create red-team golden fixture
- DO: Create directory `backend/tests/fixtures/ai/golden/` and file `backend/tests/fixtures/ai/golden/chat.guardrail.v1.jsonl` (new). Write at least 40 JSON lines, one per message, each `{"text": "...", "expect": "violation" | "benign"}`: at least 20 evasive violations of the "nine 8 two... call karna" class (spelled-out digits split with spaces/punctuation, Hindi numeral words, "whatsapp pe call", mixed-script UPI hints) and at least 20 benign lookalikes (quantity mentions like "50 quintal", "call the mandi office", "9 baje mandi jana hai", prices with digits spelled as quantities).
- RUN: `test -f backend/tests/fixtures/ai/golden/chat.guardrail.v1.jsonl && wc -l < backend/tests/fixtures/ai/golden/chat.guardrail.v1.jsonl`
- EXPECT: exit 0 and a line count >= 40.
- IF FAIL: add the missing samples and re-run.
- [ ]

### Task 1.14 — Golden evasion test + flag-off + latency
- PRECONDITION: `test -d backend/app/services/ai` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/tests/test_chat_moderation.py` add three tests: (1) `test_golden_evasion_on_shim`: load the fixture from task 1.13, run each sample through the real send path (or the guardrail decision helper) with `AI_PROVIDER=shim`, assert >=90% of `expect == "violation"` samples are caught and <5% of `expect == "benign"` samples are flagged — extend the shim's canned answers in the AI module if needed so the shim answers deterministically from the fixture (read how phase-00's shim handles other question sets and follow that pattern). (2) `test_guardrail_flag_off`: with the module flag off, the evasive sample posts successfully (allowed-but-logged) while the regex sample `"9876543210"` is still rejected. (3) `test_send_latency_regression`: time a clean message send with the guardrail on vs off (monkeypatch flag) using `time.perf_counter` around the endpoint call; assert the delta < 0.3 seconds.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_chat_moderation.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: tune the shim canned answers / fixture classification — never lower the 90%/5% assertions — and re-run.
- [ ]

### Task 1.15 — Register content.moderation.v1
- PRECONDITION: `test -f backend/app/services/ai/question_sets.py` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/app/services/ai/question_sets.py` register `content.moderation.v1` following the file's existing pattern: output schema `flag` (bool) and `reason` (choice — include at least `spam`, `abuse`, `contact_sharing`, `off_topic`, `none`); deterministic fallback = `{flag: False, reason: "none"}`; automation level `suggest`.
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/ai/question_sets.py`
- EXPECT: exit 0.
- IF FAIL: match the file's registration API exactly and re-run.
- [ ]

### Task 1.16 — Apply moderation to UGC surfaces
- PRECONDITION: `test -d backend/app/services/ai` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/app/routers/content.py`, on each UGC write path — news comments, live channel chat (`POST /channels/{channel_id}/chat`), and questions/poll-adjacent text writes as present — after a successful write, call `gateway.decide(state, "content.moderation.v1", ctx)` (pseudonymized state via `privacy.py`). When `flag` is True, insert a doc into new collection `moderation_queue` with fields `{contentType, contentId, flag, reason, decisionId, status: "open", createdAt}`. On gateway exception → fallback: no flag, content stays. Flagged content is NOT deleted in this phase (suggest level).
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/content.py && .venv/bin/python -m pytest tests/test_content.py -q`
- EXPECT: exit 0, existing content tests still green.
- IF FAIL: fix the wiring and re-run.
- [ ]

### Task 1.17 — Admin moderation-queue read endpoint
- DO: In `backend/app/routers/admin.py` add `GET /moderation-queue` (full path `/v1/admin/moderation-queue`) gated by the existing admin-role dependency used in that file (read it first), listing `moderation_queue` docs with `status == "open"`, ordered by `createdAt` desc, with cursor pagination (`cursor` param, `limit` default 20, standard `{"data": ..., "nextCursor": ...}` shape matching the file's existing list endpoints) and the standard error envelope.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/admin.py && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the endpoint and re-run.
- [ ]

### Task 1.18 — Add moderation-queue endpoint test
- DO: In `backend/tests/test_chat_moderation.py` add `test_moderation_queue_endpoint`: seed a `moderation_queue` doc in the fake store with `status: "open"`, call `GET /v1/admin/moderation-queue` as an admin user (follow the admin-auth pattern used in `backend/tests/test_admin.py`), assert the doc appears in `data`; call as a non-admin and assert 403.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_chat_moderation.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the endpoint or the test setup (match test_admin.py's admin fixture) and re-run.
- [ ]

### Task 1.19 — Add unreadCount to room views
- DO: In `backend/app/routers/chat.py` `_room_view` (line ~68): read the function and the message read-state fields it already computes per side; if the returned dict lacks an `unreadCount`, compute it (count of messages in the room not sent by `uid` and created after that side's last-read timestamp) and add `"unreadCount": <int>` to the returned dict. Do not change any other field.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/chat.py && .venv/bin/python -m pytest tests/ -q -k chat`
- EXPECT: exit 0.
- IF FAIL: fix `_room_view` and re-run.
- [ ]

### Task 1.20 — Extend website chat API wrapper
- DO: In `website/src/lib/api/chat.ts` (read it first): add `unreadCount: number` to the room type; add a typed error shape for moderation rejections (`code: 'CHAT_MODERATION_VIOLATION' | 'CHAT_MUTED' | 'CHAT_SUSPENDED'`); export a `listRooms()` returning rooms sorted by last activity desc if not already present.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors in `website/src/lib/api/chat.ts` and re-run.
- [ ]

### Task 1.21 — Create ChatsHubPage view
- DO: Create `website/src/views/chat/ChatsHubPage.tsx` (new): fetch rooms via `listRooms()` from `website/src/lib/api/chat.ts`, render a room list sorted by last activity, each row showing counterparty name, last-message snippet, and an unread badge when `unreadCount > 0`; clicking a row navigates to the existing room route rendered by `website/src/views/trade/ChatRoomPage.tsx` (read `website/src/App.tsx` for that route's path and reuse it). All user-facing strings via `t()` — no hardcoded English, no `alert()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors and re-run.
- [ ]

### Task 1.22 — Add Chats nav entry and route
- DO: In `website/src/lib/dashboard.ts` add a "Chats" entry (`id: 'chats'`) to every persona's nav/config list (read the file to find where persona nav entries are declared — add the one line per persona, mirroring neighboring entries). In `website/src/App.tsx` add one route `<Route path="/chats" element={<ChatsHubPage />} />` with the import, placed beside the other authenticated routes.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the entries/route and re-run.
- [ ]

### Task 1.23 — Add strike-notice i18n keys (en + hi)
- DO: In `website/src/lib/i18n/locales/en.trade.ts` add keys: `chat.strikeWarning` = "This message was blocked: sharing phone numbers, UPI IDs or links is not allowed. Warning {count} of 3.", `chat.muted24h` = "You are muted from chat for 24 hours due to repeated violations.", `chat.suspended` = "Your chat is suspended pending admin review." Add the same three keys with Hindi translations to `website/src/lib/i18n/locales/hi.trade.ts` (follow the file's existing style).
- RUN: `cd website && pnpm exec tsc --noEmit && grep -c "chat.strikeWarning" website/src/lib/i18n/locales/en.trade.ts website/src/lib/i18n/locales/hi.trade.ts`
- EXPECT: tsc exit 0; grep shows 1 match in each file.
- IF FAIL: add the missing key(s) and re-run.
- [ ]

### Task 1.24 — Render strike notice in ChatRoomPage
- DO: In `website/src/views/trade/ChatRoomPage.tsx`: where the send-message call handles errors, map the error codes to notices — `CHAT_MODERATION_VIOLATION` → show `t('chat.strikeWarning', {count})` (count from the error payload if present, else omit the param), `CHAT_MUTED` → `t('chat.muted24h')`, `CHAT_SUSPENDED` → `t('chat.suspended')` — rendered as an inline notice element in the page (use the existing `toast` from `website/src/components/toast.ts` if that is the file's pattern for transient messages). Never `alert()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the error mapping and re-run.
- [ ]

### Task 1.25 — Minimal admin moderation-queue page
- DO: Create `website/src/views/admin/ModerationQueuePage.tsx` (new): fetch `GET /v1/admin/moderation-queue` via a new function in `website/src/lib/api/` (add `getModerationQueue()` to a new file `website/src/lib/api/admin.ts` (new)), render a plain list of open items showing `contentType`, `contentId`, `reason`, `decisionId`, `createdAt` with a "load more" cursor button. Strings via `t()`; add the needed keys to `en.trade.ts`/`hi.trade.ts` if the admin namespace has no module pair yet (WS-07 will reorganize). Add the route in `website/src/App.tsx` next to the other admin routes (read App.tsx for the admin route pattern).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors and re-run.
- [ ]

### Task 1.26 — HUMAN CHECK: moderated chat flow end-to-end
- PRECONDITION: `curl -sf http://localhost:8000/v1/health > /dev/null` — if this fails, start the backend with `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` and the website with `cd website && pnpm dev`; if it still fails, STOP (playbook §5).
- DO: HUMAN CHECK — human performs: (1) open a farmer↔vyapari booking chat, send "call me 98765 43210" → message blocked, strike notice visible; switch locale to hi and repeat → notice renders in Hindi. (2) With the AI flag on, send "nine 8 two... call karna" → caught; with the flag off, send it again → delivered. (3) Open the Chats hub from the landlord persona nav → unread badge shows on a room with a new message; open the room → badge clears.
- RUN: (manual — no command)
- EXPECT: human confirms all three flows behave exactly as described.
- IF FAIL: record which step diverged and STOP (playbook §5) with the observation.
- [ ]

### Task 1.27 — WS-01 checkpoint: verify + commit
- DO: Run the full WS-01 Verification block from instructions.md, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-06 WS-01: chat hub + moderation + M6 guardrails"`
- EXPECT: pytest fully green; tsc+build exit 0; `git log -1 --oneline` shows the WS-01 commit message.
- IF FAIL: fix the failing test/build (never weaken a test); if only the git commit fails (e.g. no identity), note it in the report and continue (playbook §6).
- [ ]

## WS-02 — Notifications platform + M7 intelligence  (see instructions.md §WS-02)

### Task 2.1 — Switch FCM send to per-token multicast
- DO: In `backend/app/services/notifications.py` rewrite `send_fcm_to_user(uid, title, body, data)` (line ~10): replace the per-user topic publish with `messaging.send_each_for_multicast` over the user's registered device tokens read from subcollection `users/{uid}/devices` (read `backend/app/routers/users.py` `register_device` at line ~302 for the doc shape). For each token whose send result error is `registration-token-not-registered`, delete that device doc (prune). Remove the topic publish and its "token-based FCM lands Day 13" comment. Keep the `notifications` inbox doc write exactly as it is today — do not touch that part.
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/notifications.py && .venv/bin/python -m pytest tests/test_notifications.py -q`
- EXPECT: exit 0, existing notification tests green.
- IF FAIL: fix `app/services/notifications.py` and re-run.
- [ ]

### Task 2.2 — Create dispatch test file with per-token test
- DO: Create `backend/tests/test_notifications_dispatch.py` (new) using the `client` fixture pattern from `backend/tests/conftest.py`: seed two device docs under `users/uid-1/devices`, monkeypatch `firebase_admin.messaging.send_each_for_multicast` to record the tokens it was called with and to return `registration-token-not-registered` for one of them; call `send_fcm_to_user`; assert both tokens were targeted (no topic used) and the dead token's device doc was pruned from the fake store.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_notifications_dispatch.py -q`
- EXPECT: exit 0.
- IF FAIL: fix `app/services/notifications.py` (the test is the truth) and re-run.
- [ ]

### Task 2.3 — Rename notify_user path field to deepLink
- DO: In `backend/app/services/notify.py` rename the `path` parameter of `notify_user` (line ~17) to `deepLink`, and write it into the FCM data payload as `data["deepLink"]` (replacing `data["path"]`). Then migrate every caller: run `grep -rn "notify_user(" backend/app` and change each call site passing `path=` to pass `deepLink=`. Do not change any call's value, only the field name.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_notifications.py -q && ! grep -rn "notify_user(" backend/app --include="*.py" | grep "path="`
- EXPECT: tests green; the grep pipeline exits 0 (no caller still passes `path=`).
- IF FAIL: migrate the missed call site(s) and re-run.
- [ ]

### Task 2.4 — Verify every notification carries a deepLink
- PRECONDITION: `test -f backend/app/routers/tasks.py` — phase-01 task engine; if this fails, STOP the phase (playbook §5).
- DO: Read `backend/app/routers/tasks.py` to see the `deepLinks` map shape the task engine emits (e.g. `/dashboard?task=<id>` or module routes). In `backend/app/services/notify.py` add a module-level dict `DEEP_LINKS: dict[str, str]` mapping each notification `type` its callers use to the matching route (same route strings the task engine emits for the same action). Make `notify_user` look up `DEEP_LINKS[type]` when no explicit `deepLink` is passed, so every notification data payload carries `{type, deepLink}`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_notifications.py tests/test_notifications_dispatch.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the mapping/lookup and re-run.
- [ ]

### Task 2.5 — Add Firebase web push service worker
- DO: Create directory `website/public/` if missing, then create `website/public/firebase-messaging-sw.js` (new): import the firebase compat scripts for messaging (match the firebase major version in `website/package.json`, currently ^10), initialize with the same config object as `website/src/lib/firebase.ts` (read it), and handle background messages so a notification click opens `event.notification.data.deepLink` via `clients.openWindow`.
- RUN: `test -f website/public/firebase-messaging-sw.js && grep -c "deepLink" website/public/firebase-messaging-sw.js`
- EXPECT: exit 0 and count >= 1.
- IF FAIL: fix the file and re-run.
- [ ]

### Task 2.6 — Register web push token from the UI
- DO: In `website/src/lib/api/notifications.ts` (read it first) add `registerDevice(token: string, platform: string)` POSTing to the existing devices endpoint (`POST /v1/devices` — body shape from `DeviceRegisterIn` in `backend/app/routers/users.py`). In `website/src/views/trade/NotificationsPage.tsx` add a "Enable push notifications" action: requests `Notification.requestPermission()`, gets the web push token via firebase messaging (`getToken` with the service worker from task 2.5), and calls `registerDevice`. Strings via `t()`; no `alert()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors and re-run.
- [ ]

### Task 2.7 — Open deepLink on inbox notification tap
- DO: In `website/src/views/trade/NotificationsPage.tsx`, where a notification row is clicked, navigate to `notification.data.deepLink` (react-router `navigate`) instead of any previous `path` field handling.
- RUN: `cd website && pnpm exec tsc --noEmit && ! grep -n "\.path" website/src/views/trade/NotificationsPage.tsx`
- EXPECT: tsc exit 0; grep finds no `.path` reads in the file.
- IF FAIL: replace the remaining `path` reads with `deepLink` and re-run.
- [ ]

### Task 2.8 — Add notification preferences endpoints
- DO: In `backend/app/routers/notifications.py` add `GET /preferences` and `PUT /preferences` (full paths `/v1/notifications/preferences`). Storage: doc `users/{uid}/notification_prefs/current` with fields `{categories: {tasks: bool, trade: bool, payments: bool, social: bool, marketing: bool}, channels: {push: bool, sms: bool, inApp: bool}, quietHoursOverride: bool, digestMode: bool}` — defaults all True except `quietHoursOverride`/`digestMode` False. `PUT` accepts the standard `Idempotency-Key` header per the repo's existing write-endpoint pattern (read another write endpoint in this router for the pattern) and returns the saved doc; GET returns the doc or defaults. Standard error envelope.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/notifications.py && .venv/bin/python -m pytest tests/test_notifications.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the endpoints and re-run.
- [ ]

### Task 2.9 — Enforce preferences in dispatch
- DO: In `backend/app/services/notify.py` `notify_user`: before sending, load `users/{uid}/notification_prefs/current`; (a) if the notification's category toggle is off (map notification `type` to one of `tasks/trade/payments/social/marketing` via a `TYPE_CATEGORY` dict you add beside `DEEP_LINKS` — marketing off means no marketing push, period), skip the push but still write the inbox doc; (b) if `channels.push` is off, skip FCM but keep the inbox write; (c) `channels.inApp` off skips the inbox write too. Add tests to `backend/tests/test_notifications_dispatch.py`: marketing-off user receives no push; push-channel-off user gets inbox only.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_notifications_dispatch.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the pref filtering and re-run.
- [ ]

### Task 2.10 — Create NotificationPrefsPage view
- DO: Create `website/src/views/settings/NotificationPrefsPage.tsx` (new): toggles for the five categories (tasks, trade, payments, social, marketing), three channels (push, SMS, in-app), quiet-hours override, and digest-mode opt-in; load via `GET /v1/notifications/preferences`, save via `PUT` (add `getPreferences`/`putPreferences` to `website/src/lib/api/notifications.ts`). Every label via `t()`; no hardcoded strings.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors and re-run.
- [ ]

### Task 2.11 — Add prefs i18n keys and route/nav
- DO: In `website/src/lib/i18n/locales/en.trade.ts` and `hi.trade.ts` add the keys used by NotificationPrefsPage (e.g. `notif.prefs.title`, `notif.prefs.tasks`, `notif.prefs.trade`, `notif.prefs.payments`, `notif.prefs.social`, `notif.prefs.marketing`, `notif.prefs.push`, `notif.prefs.sms`, `notif.prefs.inApp`, `notif.prefs.quietHours`, `notif.prefs.digest`) with Hindi translations. In `website/src/App.tsx` add the route `/settings/notifications` rendering `NotificationPrefsPage`; in `website/src/lib/dashboard.ts` add a settings nav entry pointing to it (mirror the existing settings entry pattern if present).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix keys/route and re-run.
- [ ]

### Task 2.12 — Create SMS provider service
- DO: Create `backend/app/services/sms.py` (new): `async def send_sms(phone: str, template_id: str, vars: dict) -> dict` dispatching on env `SMS_PROVIDER` (`msg91` | `twilio` | `stub`, default `stub`). Implement `_send_msg91` and `_send_twilio` as thin httpx POST wrappers reading their API keys from env (`MSG91_AUTH_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` — add placeholder lines for all four plus `SMS_PROVIDER=stub` to `backend/.env.example`; never real values); `_send_stub` only logs `{phone, template_id, vars}` and returns `{"provider": "stub", "status": "logged"}`. DLT template IDs are read from Firestore doc(s) under `platform_config/sms_templates` (admin-editable) — add `async def get_template_id(name: str) -> str` reading that config.
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/sms.py && grep -c "SMS_PROVIDER" backend/.env.example`
- EXPECT: py_compile exit 0; grep count >= 1.
- IF FAIL: fix the file/placeholders and re-run.
- [ ]

### Task 2.13 — Test SMS provider selection
- DO: In `backend/tests/test_notifications_dispatch.py` add tests: with `SMS_PROVIDER` unset → `send_sms` uses the stub and returns `{"provider": "stub", ...}`; with `SMS_PROVIDER=stub` explicitly, same; assert no network call is made in stub mode (monkeypatch httpx to raise if called).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_notifications_dispatch.py -q`
- EXPECT: exit 0.
- IF FAIL: fix `app/services/sms.py` and re-run.
- [ ]

### Task 2.14 — Register notify.timing.v1 + quiet-hours helper
- PRECONDITION: `test -f backend/app/services/ai/question_sets.py` — if this fails, STOP the phase (playbook §5).
- DO: (a) In `backend/app/services/ai/question_sets.py` register `notify.timing.v1`: output schema `send_now` (bool) and `channel` (choice: `push`, `sms`, `digest`, `skip`); fallback = `{send_now: True, channel: "push"}` (immediate send, current behavior); level `suggest`. (b) In `backend/app/services/notify.py` add pure helper `in_quiet_hours(now_local) -> bool` returning True between 21:00 and 06:30 local, and `user_local_now(user: dict)` returning the current time in the user's timezone (user doc field `timezone`, default `"Asia/Kolkata"`, stdlib `zoneinfo`).
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/ai/question_sets.py app/services/notify.py`
- EXPECT: exit 0.
- IF FAIL: fix and re-run.
- [ ]

### Task 2.15 — Enforce quiet hours in code
- DO: In `backend/app/services/notify.py` `notify_user`: add an `urgent: bool = False` parameter. Hard constraint in code (NOT the prompt): if `in_quiet_hours(user_local_now(user))` and not `urgent` and the user's prefs don't set `quietHoursOverride` → do not send now; enqueue to digest (write a doc to collection `notifications_digest` with `{uid, type, title, body, deepLink, queuedAt, status: "queued"}`). Only `urgent=True` notifications (payment failures, handover OTPs, dispute deadlines — callers pass the flag) send during quiet hours. In `backend/tests/test_notifications_dispatch.py` add a quiet-hours table test: freeze time (monkeypatch `user_local_now`) at 22:00, 23:59, 03:00, 06:15 → non-urgent queued; at 07:00, 12:00 → sent; urgent at 02:00 → sent.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_notifications_dispatch.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the quiet-hours logic and re-run.
- [ ]

### Task 2.16 — Register notify.copy.v1 with cached generation
- PRECONDITION: `test -d backend/app/services/ai` — if this fails, STOP the phase (playbook §5).
- DO: (a) In `backend/app/services/ai/question_sets.py` register `notify.copy.v1` for `gateway.generate()` vernacular one-liners (follow the file's generate-type registration pattern; fallback = the current static template text). (b) In `backend/app/services/notify.py`, when building the push copy, call `gateway.generate` for `notify.copy.v1` and cache the result per `(task_type, lang, day)` using the existing Redis helper in `backend/app/core/cache.py` (read it; key shape `notify_copy:{task_type}:{lang}:{YYYY-MM-DD}`) — never generate per page-view. On any failure → static template + immediate send (no notification lost). Add a test: with shim, hi-locale copy comes from the shim's canned one-liner; with gateway raising, the static template is used and the send still happens.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_notifications_dispatch.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the copy path and re-run.
- [ ]

### Task 2.17 — Digest drain job (3 queued → 1 push)
- DO: In `backend/app/routers/jobs.py` add `POST /notifications_digest/run` (full path `/v1/jobs/notifications_digest/run`, same job-guard pattern as the existing jobs in that file): group all `notifications_digest` docs with `status == "queued"` by `uid`; for each user send ONE digest push via `send_fcm_to_user` (title/body summarizing the count, `deepLink` = the notifications inbox route) and mark the docs `status: "sent"`. Users with `digestMode` on also get their non-urgent notifications enqueued here instead of sent immediately (one-line branch in `notify_user`). In `backend/tests/test_notifications_dispatch.py` add: queue 3 events for one user → run the job → exactly 1 digest push sent (monkeypatched sender records calls), 3 docs marked sent.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_notifications_dispatch.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the job and re-run.
- [ ]

### Task 2.18 — AI-disabled delivery invariant test
- DO: In `backend/tests/test_notifications_dispatch.py` add `test_ai_disabled_still_delivers`: run `notify_user` with `AI_PROVIDER=shim` AND with the notify module flag off (both variants), outside quiet hours; assert the notification is delivered via template + immediate send in both cases (sender called exactly once, inbox doc written). This encodes "no notification may be lost when AI is disabled".
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_notifications_dispatch.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the dispatch fallback path and re-run.
- [ ]

### Task 2.19 — HUMAN CHECK: push → deep link → action
- PRECONDITION: `curl -sf http://localhost:8000/v1/health > /dev/null` — else start backend and website dev servers (commands in the header conventions); if still failing, STOP (playbook §5).
- DO: HUMAN CHECK — human performs: (1) enable push in notification settings, trigger a trade event → push arrives on the device → tap → the dashboard task opens → complete the action. (2) Opt into digest mode, fire 3 notification events → exactly 1 digest push arrives. (3) Disable marketing in prefs → trigger a marketing event → nothing is pushed. (4) Temporarily set the device clock/env to 22:00 → non-urgent notification is held; urgent one arrives.
- RUN: (manual — no command)
- EXPECT: human confirms all four behaviors.
- IF FAIL: record the diverging step and STOP (playbook §5).
- [ ]

### Task 2.20 — WS-02 checkpoint: verify + commit
- DO: Run the full WS-02 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-06 WS-02: notifications platform + M7 intelligence"`
- EXPECT: pytest green; build clean; commit message visible in `git log -1 --oneline`.
- IF FAIL: fix the failure; if only git commit fails, note it and continue (playbook §6).
- [ ]

## WS-03 — Trust & safety + M8 fraud & payout anomaly  (see instructions.md §WS-03)

### Task 3.1 — Verify existing block endpoints
- DO: Verify-only task (no edits): confirm the block endpoints already exist in `backend/app/routers/users.py` as `POST /v1/users/me/blocks`, `DELETE /v1/users/me/blocks/{user_id}`, `GET /v1/users/me/blocks` (lines ~389–410) backed by `backend/app/services/blocks.py` (`blocked_pair`, `require_unblocked`). Read both files and confirm the shapes; these are the endpoints the UI will call (NOT the `/v1/users/{user_id}/block` shape instructions.md guessed at).
- RUN: `grep -n "me/blocks" backend/app/routers/users.py && grep -n "def blocked_pair\|def require_unblocked" backend/app/services/blocks.py`
- EXPECT: both greps produce matches; exit 0.
- IF FAIL: the repo contradicts this task — STOP (playbook §5) and report the actual block API surface.
- [ ]

### Task 3.2 — Hide blocked users from marketplace listings
- DO: In `backend/app/routers/marketplace.py`, in the public listing query endpoint(s) (read the file to find them), filter out listings whose owner has a block relationship with the viewer in either direction, using `blocked_pair` from `app.services.blocks` (batch the check: collect owner ids, query blocks once, filter in Python). Do not change response shapes otherwise.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_marketplace.py tests/test_blocks.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the filtering and re-run.
- [ ]

### Task 3.3 — Hide blocked users from deal listings
- DO: In `backend/app/routers/farmer_deals.py`, apply the same `blocked_pair` filtering to the deal-listing endpoint(s) as in task 3.2.
- RUN: `cd backend && .venv/bin/python -m pytest tests/ -q -k "deal or blocks"`
- EXPECT: exit 0.
- IF FAIL: fix the filtering and re-run.
- [ ]

### Task 3.4 — Create ReportBlockMenu component
- DO: Create `website/src/components/ReportBlockMenu.tsx` (new): a small menu component taking `userId: string` with two actions — "Report" (POST `/v1/users/{userId}/report`, add `reportUser` to `website/src/lib/api/users.ts` — read that file first for the client pattern) and "Block"/"Unblock" (POST/DELETE `/v1/users/me/blocks[/{userId}]`, add `blockUser`/`unblockUser` to the same file). Confirm/success feedback via `toast` from `website/src/components/toast.ts`; all strings via `t()`; no `alert()`/`confirm()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors and re-run.
- [ ]

### Task 3.5 — Add report/block i18n keys
- DO: Add the keys used by ReportBlockMenu (`trust.report`, `trust.block`, `trust.unblock`, `trust.reported`, `trust.blocked`) to `website/src/lib/i18n/locales/en.trade.ts` and `hi.trade.ts` with Hindi translations.
- RUN: `cd website && pnpm exec tsc --noEmit && grep -c "trust.block" website/src/lib/i18n/locales/hi.trade.ts`
- EXPECT: tsc exit 0; grep count >= 1.
- IF FAIL: add the missing keys and re-run.
- [ ]

### Task 3.6 — Mount ReportBlockMenu in chat header
- DO: In `website/src/views/trade/ChatRoomPage.tsx` render `ReportBlockMenu` in the chat header with the counterparty's user id (read the page to find where the counterparty id is available).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the props/wiring and re-run.
- [ ]

### Task 3.7 — Mount ReportBlockMenu on deal and profile surfaces
- DO: Render `ReportBlockMenu` on (a) the deal/offer detail surface `website/src/views/trade/OfferDetailPage.tsx` (target = the other party's user id) and (b) the profile view used for other users (read `website/src/views/` for the public-profile component — if none exists, mount it on `LotDetailPage.tsx`'s farmer section instead and note the substitution in your report).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the wiring and re-run.
- [ ]

### Task 3.8 — Create rating-prompt service
- DO: Create `backend/app/services/rating_prompts.py` (new): `async def open_rating_prompt(rater_uid: str, ratee_uid: str, transaction_id: str, kind: str) -> None` writing doc `users/{rater_uid}/rating_prompts/{transaction_id}` with `{rateeUid, kind, transactionId, status: "open", createdAt}` (skip if the doc already exists — idempotent), and `async def pending_prompts(uid: str) -> list[dict]` returning open prompts. `kind` is one of: `lot_sale`, `lot_purchase`, `transport_delivery`, `equipment_booking`, `land_lease`, `dairy_collection`, `course_enrollment`, `contract_delivery`, `marketplace_order`.
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/rating_prompts.py`
- EXPECT: exit 0.
- IF FAIL: fix and re-run.
- [ ]

### Task 3.9 — Add pending-ratings endpoint
- DO: In `backend/app/routers/ratings.py` add `GET /pending` (full path `/v1/ratings/pending`) returning the caller's open rating prompts via `pending_prompts`, standard envelope. Also: in the existing `POST /` handler, after a successful rating write, mark the matching prompt doc `status: "done"` (match on `transactionId`); and run any free-text rating text through `chat_moderation.scan()` — a violation rejects with 422 `RATING_TEXT_BLOCKED`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_ratings.py -q`
- EXPECT: exit 0, existing rating tests green.
- IF FAIL: fix `app/routers/ratings.py` and re-run.
- [ ]

### Task 3.10 — Wire rating prompt: lot sale/purchase completion
- DO: In `backend/app/routers/lots.py` find the endpoint that marks a lot sale/purchase completed (read the file; look for status transitions to a completed/sold state) and call `open_rating_prompt` for both sides (buyer rates seller with kind `lot_sale`, seller rates buyer with kind `lot_purchase`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_lots.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the hook and re-run.
- [ ]

### Task 3.11 — Wire rating prompt: transport delivery
- DO: In `backend/app/routers/transport.py` find the delivery-completion endpoint and call `open_rating_prompt` (shipper rates transporter, kind `transport_delivery`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_transport.py tests/test_tms.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the hook and re-run.
- [ ]

### Task 3.12 — Wire rating prompt: equipment booking
- DO: In `backend/app/routers/equipment.py` (or `equipment_owner.py` if that is where completion lives — read both) find the booking-completion path and call `open_rating_prompt` (renter rates owner, kind `equipment_booking`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_equipment.py tests/test_equipment_owner.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the hook and re-run.
- [ ]

### Task 3.13 — Wire rating prompt: land lease
- DO: In `backend/app/routers/land.py` find the lease-completion/activation path and call `open_rating_prompt` (tenant rates landlord, kind `land_lease`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_land.py tests/test_land_market.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the hook and re-run.
- [ ]

### Task 3.14 — Wire rating prompt: dairy collection
- DO: In `backend/app/routers/dairy_manager.py` (or `livestock_dairy.py` — read both) find the collection-completion path and call `open_rating_prompt` (farmer rates collector, kind `dairy_collection`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_dairy_mgmt.py tests/test_saas_dairy_manager.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the hook and re-run.
- [ ]

### Task 3.15 — Wire rating prompt: course enrollment
- DO: In `backend/app/routers/courses.py` find the enrollment-completion (or course-completion) path and call `open_rating_prompt` (learner rates instructor, kind `course_enrollment`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_courses.py tests/test_courses_superstore.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the hook and re-run.
- [ ]

### Task 3.16 — Wire rating prompt: contract delivery
- DO: In `backend/app/routers/contracts.py` find the delivery-completion path and call `open_rating_prompt` (both parties, kind `contract_delivery`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_contracts.py tests/test_contracts_direct.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the hook and re-run.
- [ ]

### Task 3.17 — Wire rating prompt: marketplace order
- DO: In `backend/app/routers/orders.py` find the order-completion/delivered path and call `open_rating_prompt` (buyer rates seller, kind `marketplace_order`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_orders.py tests/test_order_lifecycle.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the hook and re-run.
- [ ]

### Task 3.18 — Rate prompt UI on dashboard
- DO: Create `website/src/components/RatePrompt.tsx` (new): fetches `GET /v1/ratings/pending` (add `getPendingRatings` + `submitRating` to `website/src/lib/api/` — put them in `website/src/lib/api/users.ts` or a new `ratings.ts`, matching existing wrapper style), and if any prompt is open renders a modal (use the existing `ModalSheet.tsx` pattern) with 1–5 star selector, optional text field, submit → `POST /v1/ratings`. Mount it once in `website/src/views/dashboard/DashboardHome.tsx`. Strings via `t()`; add keys (`rate.title`, `rate.submit`, `rate.skip`) to `en.trade.ts` + `hi.trade.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors and re-run.
- [ ]

### Task 3.19 — Create trust-tier computation
- DO: Create `backend/app/services/trust.py` (new) with a pure function `compute_trust_tier(stats: dict) -> str` where `stats` = `{completed: int, avgRating: float, disputeRate: float, kycVerified: bool}` and the tier is: `"top"` if completed >= 50 and avgRating >= 4.5 and disputeRate < 0.02 and kycVerified; else `"established"` if completed >= 20 and avgRating >= 4.2 and disputeRate < 0.05; else `"trusted"` if completed >= 5 and avgRating >= 4.0; else `"new"`. Document these thresholds in the module docstring. Add `async def refresh_trust_tier(uid: str) -> str` that builds the stats from completed rating prompts/ratings + user KYC field, computes the tier, and stores it on the user doc as `trustTier`.
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/trust.py`
- EXPECT: exit 0.
- IF FAIL: fix and re-run.
- [ ]

### Task 3.20 — Recompute tier on rating write + tests
- DO: In `backend/app/routers/ratings.py` `POST /` handler, after the rating write, call `refresh_trust_tier(ratee_uid)`. In `backend/tests/test_ratings.py` add tests: pure-function tier table (boundary values from task 3.19) and an endpoint test that the ratee's user doc gains `trustTier` after a rating.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_ratings.py -q`
- EXPECT: exit 0.
- IF FAIL: fix `app/services/trust.py` / the hook and re-run.
- [ ]

### Task 3.21 — Trust-tier badge UI
- DO: In `website/src/views/trade/ChatRoomPage.tsx` header and on the deal/offer surfaces wired in task 3.7, render a small tier badge next to the counterparty name when their profile includes `trustTier` (extend the relevant api type). Badge label via `t()` keys `trust.tier.new`, `trust.tier.trusted`, `trust.tier.established`, `trust.tier.top` — add all four to `en.trade.ts` + `hi.trade.ts` with Hindi translations.
- RUN: `cd website && pnpm exec tsc --noEmit && grep -c "trust.tier.top" website/src/lib/i18n/locales/hi.trade.ts`
- EXPECT: tsc exit 0; grep count >= 1.
- IF FAIL: fix the badge/keys and re-run.
- [ ]

### Task 3.22 — Register trust.fraud.v1 and trust.payout_anomaly.v1
- PRECONDITION: `test -f backend/app/services/ai/question_sets.py` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/app/services/ai/question_sets.py` register two question sets following the file's pattern: `trust.fraud.v1` — output `pattern` (choice: `circular_bidding`, `rate_collusion`, `referral_ring`, `coin_abuse`, `none`) and `risk` (score 0–1); fallback `{pattern: "none", risk: 0.0}`; level `suggest`. `trust.payout_anomaly.v1` — output `anomaly` (bool) and `severity` (score 0–1); fallback `{anomaly: False, severity: 0.0}`; level `suggest`.
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/ai/question_sets.py`
- EXPECT: exit 0.
- IF FAIL: match the file's registration API and re-run.
- [ ]

### Task 3.23 — Build fraud feature builder
- DO: Create `backend/app/services/fraud_scan.py` (new): `async def build_cluster_features() -> list[dict]` that returns one feature dict per user/cluster with: `sharedDevices` (count of device-token hashes shared across accounts — hash tokens from `users/{uid}/devices` before use; never put raw tokens in AI payloads), `circularTrades` (count of A→B→A lot/deal pairs from lots/deals collections), `referralRingSize` (from the referral graph in `backend/app/services/referrals.py` — read it), `coinVelocity` (mint/burn rate from the gamification collections used by `backend/app/routers/gamification.py` — read it). Pure-data dicts only; no AI calls in this function.
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/fraud_scan.py`
- EXPECT: exit 0.
- IF FAIL: fix and re-run.
- [ ]

### Task 3.24 — Add nightly fraud-scan job
- PRECONDITION: `test -d backend/app/services/ai` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/app/routers/jobs.py` add `POST /fraud_scan` (full path `/v1/jobs/fraud_scan`, same guard pattern as existing jobs): calls `build_cluster_features()`, then per cluster `gateway.decide(state, "trust.fraud.v1", ctx)` with pseudonymized state. Where `risk > 0.8`: set `soft_hold: True` on that account's pending settlement/payout docs AND insert a `fraud_queue` doc (new collection) with `{userId, pattern, risk, decisionId, reason, status: "open", createdAt}`. NEVER auto-punish: no bans, no forfeitures, no status changes on the user doc — only holds + queue entries. With the module flag off: run heuristics only (feature counts) and create no holds without an AI score.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/jobs.py`
- EXPECT: exit 0.
- IF FAIL: fix and re-run.
- [ ]

### Task 3.25 — Seed fraud rings + detection test
- DO: Create `backend/tests/test_trust_fraud.py` (new) using the conftest fake-store pattern: seed (a) a circular-bidding ring — three users with A→B→A completed lots and shared device-token hashes, (b) a referral ring via the referrals collections, (c) a legitimate high-volume settlement batch (multiple normal users with ordinary settlements). Extend the shim's canned `trust.fraud.v1` answers so the seeded ring scores `risk > 0.8` (follow the shim pattern used for other question sets). Test: run `POST /v1/jobs/fraud_scan` → ring users have `soft_hold: True` on pending settlements and `fraud_queue` docs carrying `pattern`, `risk`, `decisionId`, `reason`, `status: "open"`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_trust_fraud.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the job/shim mapping — never lower the assertions — and re-run.
- [ ]

### Task 3.26 — Flag-off + legit pass-through tests
- DO: In `backend/tests/test_trust_fraud.py` add: (1) `test_fraud_scan_flag_off`: with the module flag off, the job runs (heuristics only) and creates zero holds and zero queue docs. (2) `test_legit_batch_unaffected`: after the scan, the legitimate seeded users' settlements still settle (run the existing settlement run path from `backend/app/services/settlements.py` and assert their lines complete and are not held).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_trust_fraud.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the job's flag-off branch / hold conditions and re-run.
- [ ]

### Task 3.27 — Score settlement lines for payout anomaly
- PRECONDITION: `test -d backend/app/services/ai` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/app/services/settlements.py` `run_settlements` (line ~22): for each settlement line, call `gateway.decide(state, "trust.payout_anomaly.v1", ctx)`; when `anomaly` is True, mark the line `{held: True, holdReason: <AI reason>, decisionId: <decision_id>, holdRole: "finance_admin"}` and exclude it from settlement — held lines never settle until released/rejected. On gateway exception → fallback: line settles normally (never block payouts on AI failure). All amounts remain integer paisa; no floats for money.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_settlements.py -q`
- EXPECT: exit 0, existing settlement tests green.
- IF FAIL: fix the scoring hook and re-run.
- [ ]

### Task 3.28 — Add hold release/reject endpoints
- DO: In `backend/app/routers/settlements.py` add (admin/finance_admin-gated, same role pattern as other admin endpoints): `POST /holds/{line_id}/release` and `POST /holds/{line_id}/reject` — both require a `reason` in the body, write an `audit_logs` entry `{actor, action: "settlement_hold_release"|"settlement_hold_reject", lineId, reason, createdAt}` (rule: no admin action without audit_logs + reason), and apply maker-checker: lines over ₹10,000 (integer paisa `> 1000000`) may only be released by a different finance_admin than the one who last acted on the line. Also add `GET /holds` listing held lines with their `holdReason` + `decisionId`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_settlements.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the endpoints and re-run.
- [ ]

### Task 3.29 — Add hold provenance tests
- DO: In `backend/tests/test_trust_fraud.py` add: (1) a settlement run where the shim flags one line anomalous → that line is held with `holdReason` + `decisionId` attached, other lines settle; (2) release with a reason → line settles and an `audit_logs` entry exists with the reason; (3) release without a reason → 422.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_trust_fraud.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the hold/release logic and re-run.
- [ ]

### Task 3.30 — Add admin fraud-queue list endpoint
- DO: In `backend/app/routers/admin.py` add `GET /fraud-queue` (full path `/v1/admin/fraud-queue`, admin-gated, cursor pagination, standard envelope) listing `fraud_queue` docs with `status == "open"`. Add a test to `backend/tests/test_trust_fraud.py`: seeded queue doc appears for admin, 403 for non-admin.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_trust_fraud.py tests/test_admin.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the endpoint and re-run.
- [ ]

### Task 3.31 — Create FraudQueuePage admin view
- DO: Create `website/src/views/admin/FraudQueuePage.tsx` (new): fetch `/v1/admin/fraud-queue` and `/v1/settlements/holds` (add both wrappers to `website/src/lib/api/admin.ts`), list each hold with `userId`, `pattern`, `risk`, `reason`, `decisionId`, and release/reject buttons that prompt for a reason (inline text field, not `prompt()`) and POST to the endpoints from task 3.28. Strings via `t()` — add needed keys to `en.trade.ts` + `hi.trade.ts`. Add the route in `website/src/App.tsx` beside the other admin routes.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors and re-run.
- [ ]

### Task 3.32 — HUMAN CHECK: rating, report/block, fraud queue
- PRECONDITION: `curl -sf http://localhost:8000/v1/health > /dev/null` — else start both dev servers (header conventions); if still failing, STOP (playbook §5).
- DO: HUMAN CHECK — human performs: (1) complete a transport delivery → rate prompt appears on the dashboard → submit 5 stars → rating visible on the transporter's profile surface. (2) From a chat, report a user, then block them → further contact attempts are refused. (3) Run `POST /v1/jobs/fraud_scan` against seeded data → the FraudQueuePage shows the ring with its reason and decision_id → release a hold with a reason → confirm the audit trail entry.
- RUN: (manual — no command)
- EXPECT: human confirms all three flows.
- IF FAIL: record the diverging step and STOP (playbook §5).
- [ ]

### Task 3.33 — WS-03 checkpoint: verify + commit
- DO: Run the full WS-03 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-06 WS-03: trust & safety + M8 fraud/payout anomaly"`
- EXPECT: pytest green; build clean; commit visible in `git log -1 --oneline`.
- IF FAIL: fix the failure; if only git commit fails, note it and continue (playbook §6).
- [ ]

## WS-04 — Consent & privacy  (see instructions.md §WS-04)

### Task 4.1 — Create consents API wrapper
- DO: Create `website/src/lib/api/consents.ts` (new): read `backend/app/models/consents.py` and mirror its fields in a TS type `Consents`; export `getConsents()` (GET `/v1/users/me/consents`) and `putConsents(c: Consents)` (PUT same path), using the same axios client pattern as the other wrappers in `website/src/lib/api/` (read `client.ts` first).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the wrapper and re-run.
- [ ]

### Task 4.2 — Create ConsentCenterPage view
- DO: Create `website/src/views/settings/ConsentCenterPage.tsx` (new): load consents via `getConsents()`, render one toggle per consent field in the `Consents` type, each with purpose text via `t()`, persisting changes via `putConsents` on toggle. No hardcoded strings.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors and re-run.
- [ ]

### Task 4.3 — Add consent-center i18n keys
- DO: Add the keys used by ConsentCenterPage (`consent.title`, plus one `consent.<field>` purpose key per field in `models/consents.py`) to `website/src/lib/i18n/locales/en.trade.ts` and `hi.trade.ts` with Hindi translations.
- RUN: `cd website && pnpm exec tsc --noEmit && grep -c "consent.title" website/src/lib/i18n/locales/hi.trade.ts`
- EXPECT: tsc exit 0; grep count >= 1.
- IF FAIL: add the missing keys and re-run.
- [ ]

### Task 4.4 — Route + nav for consent center
- DO: In `website/src/App.tsx` add route `/settings/consents` rendering `ConsentCenterPage`; in `website/src/lib/dashboard.ts` add the settings nav entry pointing to it (same pattern as task 2.11).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the route/nav and re-run.
- [ ]

### Task 4.5 — Create privacy router with data-export endpoint
- DO: Create `backend/app/routers/privacy.py` (new), `APIRouter(prefix="/users/me", tags=["privacy"])`: `POST /data-export` — (a) rate-limit: if a `data_exports` doc for this uid exists with `createdAt` within the last 24h → 429 `EXPORT_RATE_LIMITED`; (b) assemble the user's data (profile, personas, transactions, diaries, consents, notifications, chats metadata — read `backend/app/services/purge.py` for the authoritative list of per-user collections and iterate the same set) into one JSON dict; (c) store it via `backend/app/services/storage.py` (read it first; use its upload function) and create a `data_exports` doc `{uid, status: "ready", url, createdAt}`; (d) notify the user via `notify_user` with `deepLink` to the download; (e) write an `audit_logs` entry `{actor: uid, action: "data_export", createdAt}`. Standard error envelope.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/privacy.py`
- EXPECT: exit 0.
- IF FAIL: fix and re-run.
- [ ]

### Task 4.6 — Add data-export latest endpoint
- DO: In `backend/app/routers/privacy.py` add `GET /data-export/latest` returning the caller's most recent `data_exports` doc (`{status, url, createdAt}`) or 404 `EXPORT_NOT_FOUND` in the standard envelope.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/privacy.py`
- EXPECT: exit 0.
- IF FAIL: fix and re-run.
- [ ]

### Task 4.7 — Mount privacy router
- DO: In `backend/app/main.py` add `app.include_router(privacy.router, prefix="/v1")` beside the other includes (line ~112 area) with the matching import.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_consents.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the mount and re-run.
- [ ]

### Task 4.8 — Add data-export tests
- DO: Create `backend/tests/test_data_export.py` (new) using the conftest pattern: (1) `POST /v1/users/me/data-export` → 200/201, a `data_exports` doc with `status: "ready"` and a `url` exists, an `audit_logs` entry was written, and the archive dict contains the user's seeded profile + consents; (2) immediate second POST → 429 `EXPORT_RATE_LIMITED`; (3) `GET /v1/users/me/data-export/latest` returns the doc.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_data_export.py -q`
- EXPECT: exit 0.
- IF FAIL: fix `app/routers/privacy.py` (never weaken assertions) and re-run.
- [ ]

### Task 4.9 — Extend account-purge coverage
- DO: Read `backend/tests/test_account.py` and `backend/app/services/purge.py` (`purge_user`). Extend the test file so `DELETE /v1/users/me` is asserted to purge or anonymize EVERY per-user subcollection purge.py knows about (including `users/{uid}/chat_strikes`, `users/{uid}/rating_prompts`, `users/{uid}/notification_prefs`, `users/{uid}/expert_tickets` — seed each in the fake store before delete and assert absence after). If a gap is found (a subcollection purge.py misses), FIX `purge.py` to cover it — do not document around it.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_account.py -q`
- EXPECT: exit 0.
- IF FAIL: extend `app/services/purge.py` to purge the missed subcollection and re-run.
- [ ]

### Task 4.10 — Build account-deletion web flow
- DO: Create `website/src/views/settings/DeleteAccountPage.tsx` (new): danger-zone layout — (1) consequence list screen (what will be deleted, via `t()`), (2) re-auth step requiring the user's MPIN/password (reuse the existing `MpinPad.tsx`/`OtpField.tsx` components and the re-auth pattern used elsewhere in `website/src/views/` — read them), (3) final confirm button that calls `DELETE /v1/users/me` (add `deleteAccount` to `website/src/lib/api/users.ts`), then clears local auth state and lands on the logged-out splash. No `confirm()`/`alert()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors and re-run.
- [ ]

### Task 4.11 — Deletion-flow i18n keys + route/nav
- DO: Add the keys used by DeleteAccountPage (`delete.title`, `delete.consequences`, `delete.reauth`, `delete.confirm`, `delete.done`) to `en.trade.ts` + `hi.trade.ts` with Hindi translations. Add route `/settings/delete-account` in `website/src/App.tsx` and a nav entry under settings in `website/src/lib/dashboard.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix keys/route and re-run.
- [ ]

### Task 4.12 — Extract LegalPage copy to t() keys (en)
- DO: Read `website/src/views/legal/LegalPage.tsx` — it is English-only hardcoded. Move ALL copy (terms, privacy policy, refund policy as present) into `t()` keys. Add the English strings to `website/src/lib/i18n/locales/en.ts` under a `legal.*` namespace (`legal.terms.title`, `legal.terms.body`, `legal.privacy.title`, `legal.privacy.body`, `legal.refund.title`, `legal.refund.body` — split long bodies into numbered paragraph keys like `legal.terms.p1`…). The component must contain no JSX text literals after this task.
- RUN: `cd website && pnpm exec tsc --noEmit && ! grep -nE '>[^<{}]*[A-Za-z]{4,} [A-Za-z]{4,}[^<{}]*<' website/src/views/legal/LegalPage.tsx`
- EXPECT: tsc exit 0; the grep pipeline exits 0 (no remaining literal text nodes with two or more words).
- IF FAIL: move the remaining literals into keys and re-run.
- [ ]

### Task 4.13 — Add Hindi legal translations
- DO: Add Hindi translations for every `legal.*` key created in task 4.12 to `website/src/lib/i18n/locales/hi.ts`. Key set must exactly match the en additions.
- RUN: `cd website && pnpm exec tsc --noEmit && python3 -c "import re; en=set(re.findall(r'(legal\.[\w.]+)\\s*:', open('src/lib/i18n/locales/en.ts').read())); hi=set(re.findall(r'(legal\.[\w.]+)\\s*:', open('src/lib/i18n/locales/hi.ts').read())); missing=en-hi; print('missing:', missing); exit(1 if missing else 0)"`
- EXPECT: exit 0, `missing: set()`.
- IF FAIL: add the missing Hindi keys and re-run.
- [ ]

### Task 4.14 — HUMAN CHECK: consent, export, deletion flows
- PRECONDITION: `curl -sf http://localhost:8000/v1/health > /dev/null` — else start both dev servers (header conventions); if still failing, STOP (playbook §5).
- DO: HUMAN CHECK — human performs: (1) in the consent center, toggle data-sharing consent off → a `require_data_sharing`-gated feature refuses; toggle persists across reload. (2) Request a data export → notification arrives → download the archive → spot-check it contains profile, consents, transactions. (3) Create a throwaway account, delete it from the website danger zone → re-login is impossible and data is purged. (4) Open `/legal/terms` in hi locale → fully Hindi, no English literals.
- RUN: (manual — no command)
- EXPECT: human confirms all four flows.
- IF FAIL: record the diverging step and STOP (playbook §5).
- [ ]

### Task 4.15 — WS-04 checkpoint: verify + commit
- DO: Run the full WS-04 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-06 WS-04: consent & privacy"`
- EXPECT: pytest green; build clean; commit visible in `git log -1 --oneline`.
- IF FAIL: fix the failure; if only git commit fails, note it and continue (playbook §6).
- [ ]

## WS-05 — Support + M30 AI support agent  (see instructions.md §WS-05)

### Task 5.1 — Create shared embedding index helper
- PRECONDITION: `test -d backend/app/services/ai` — if this fails, STOP the phase (playbook §5).
- DO: Create `backend/app/services/search_index.py` (new) — this is the shared helper WS-08 will build on (WS-05 lands it first per instructions.md). Contents: `COLLECTION = "search_index"`; `async def embed_texts(texts: list[str]) -> list[list[float]]` calling `gateway.embed()` from `backend/app/services/ai/gateway.py` with the model from env `AI_GEMINI_EMBED_MODEL` (default `gemini-embedding-001` — add the placeholder line `AI_GEMINI_EMBED_MODEL=gemini-embedding-001` to `backend/.env.example`); `def cosine(a: list[float], b: list[float]) -> float` (pure); `async def upsert_document(index: str, doc_id: str, text: str) -> None` storing `{index, docId, text, vector, updatedAt}` in `COLLECTION` with doc id `{index}__{doc_id}`; `async def search_similar(index: str, query_text: str, limit: int = 5) -> list[dict]` embedding the query and returning the top `limit` docs by cosine score with a `score` field.
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/search_index.py && grep -c "AI_GEMINI_EMBED_MODEL" backend/.env.example`
- EXPECT: py_compile exit 0; grep count >= 1.
- IF FAIL: fix and re-run.
- [ ]

### Task 5.2 — Create support test file with retrieval test
- DO: Create `backend/tests/test_support_agent.py` (new) using the conftest pattern: monkeypatch `gateway.embed` (or the shim path) to return deterministic fixed vectors; upsert three docs into `search_index` via `upsert_document`; assert `search_similar` returns them in the mathematically correct cosine order (construct vectors so the expected order is unambiguous) and respects `limit`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_support_agent.py -q`
- EXPECT: exit 0.
- IF FAIL: fix `app/services/search_index.py` and re-run.
- [ ]

### Task 5.3 — Create FAQ CMS router
- DO: Create `backend/app/routers/faq.py` (new), `APIRouter(prefix="/faq", tags=["faq"])`: collection `faq_articles` with docs `{id, category, lang, title, body, status}` (`status`: `"published" | "draft"`). Endpoints: `GET ""` public, filters `category` + `lang`, only `published`, cursor pagination, standard envelope; `POST ""`, `PUT "/{article_id}"`, `DELETE "/{article_id}"` gated by the admin-role dependency pattern used in `backend/app/routers/admin.py` (read it); writes accept `Idempotency-Key`.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/faq.py`
- EXPECT: exit 0.
- IF FAIL: fix and re-run.
- [ ]

### Task 5.4 — Mount FAQ router + CRUD tests
- DO: In `backend/app/main.py` mount `faq.router` under `/v1` (same include pattern as task 4.7). In `backend/tests/test_support_agent.py` add CRUD tests: admin creates a `published` article → it appears in `GET /v1/faq?lang=en`; non-admin POST → 403; a `draft` article never appears in the public list.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_support_agent.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the router/mount and re-run.
- [ ]

### Task 5.5 — Create FAQ seed script
- DO: Create `backend/scripts/seed_faq.py` (new): a `FAQ_SEED` list of dicts `{category, lang, title, body}` derived from the existing legal/help copy (read `website/src/views/legal/LegalPage.tsx` and the `legal.*` keys from WS-04 — one FAQ article per legal topic in en and hi, plus basic app-help entries for: adding a plot, creating a lot, booking transport, checking mandi bhav, notification settings). Idempotent upsert into `faq_articles` with `status: "published"` (key = slugified title + lang). Follow the pattern of the existing scripts in `backend/scripts/`.
- RUN: `cd backend && .venv/bin/python -m py_compile scripts/seed_faq.py`
- EXPECT: exit 0.
- IF FAIL: fix and re-run.
- [ ]

### Task 5.6 — Add expert-tickets list endpoint
- DO: In `backend/app/routers/chatbot.py` add `GET /expert-tickets` (full path `/v1/chatbot/expert-tickets`) returning the current user's tickets from `users/{uid}/expert_tickets` (read the existing `request_expert_handoff` at line ~42 for the doc shape), newest first, cursor pagination, standard envelope. Add a test to `backend/tests/test_support_agent.py`: seed two tickets for uid-1 → both listed; another user's tickets never appear.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_support_agent.py tests/test_chatbot.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the endpoint and re-run.
- [ ]

### Task 5.7 — Add ticket message thread endpoints
- DO: In `backend/app/routers/chatbot.py` add `GET /expert-tickets/{ticket_id}/messages` and `POST /expert-tickets/{ticket_id}/messages` (body `{text}`), storing messages in subcollection `expert_tickets/{ticket_id}/messages` with `{authorUid, authorRole: "user"|"agent", text, createdAt}`; only the ticket owner (or admin) may read/post — 403 otherwise. POST rejects empty text (422). Add tests to `backend/tests/test_support_agent.py`: owner posts and reads a message; non-owner gets 403.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_support_agent.py tests/test_chatbot.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the endpoints and re-run.
- [ ]

### Task 5.8 — Create support API wrapper
- DO: Create `website/src/lib/api/support.ts` (new): `listFaq(lang, category?)`, `searchFaq(lang, query)` (client-side keyword filter over `listFaq` results — title+body substring, case-insensitive), `listTickets()`, `getTicketMessages(ticketId)`, `postTicketMessage(ticketId, text)`, `askSupport(question: string)` (POST `/v1/support/ask` — response type `{kind: "answer", answer: string, sources: string[]} | {kind: "ticket", ticketId: string}`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the wrapper and re-run.
- [ ]

### Task 5.9 — Create HelpCenterPage view
- DO: Create `website/src/views/support/HelpCenterPage.tsx` (new): three sections — (1) FAQ browse: category filter + keyword search box over `faq_articles` (via `searchFaq`), article list expanding to show body; (2) support threads: list from `listTickets()` showing status; (3) thread detail: message list + reply box via `postTicketMessage`. All strings via `t()`; no hardcoded text.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors and re-run.
- [ ]

### Task 5.10 — Support i18n keys + route/nav
- DO: Add the keys used by HelpCenterPage (`support.title`, `support.faq`, `support.search`, `support.threads`, `support.askPlaceholder`, `support.send`, `support.ticketCreated`, `support.sources`) to `en.trade.ts` + `hi.trade.ts` with Hindi translations. Add route `/support` in `website/src/App.tsx` and a nav entry in `website/src/lib/dashboard.ts` for every persona (same pattern as task 1.22).
- RUN: `cd website && pnpm exec tsc --noEmit && grep -c "support.askPlaceholder" website/src/lib/i18n/locales/hi.trade.ts`
- EXPECT: tsc exit 0; grep count >= 1.
- IF FAIL: fix keys/route and re-run.
- [ ]

### Task 5.11 — Register support.intent.v1
- PRECONDITION: `test -f backend/app/services/ai/question_sets.py` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/app/services/ai/question_sets.py` register `support.intent.v1`: output `resolvable` (bool), `category` (choice: `app_help`, `money`, `account`, `other`), `escalate` (bool); fallback `{resolvable: False, category: "other", escalate: True}` (safe default = escalate); level `suggest`.
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/ai/question_sets.py`
- EXPECT: exit 0.
- IF FAIL: match the file's registration API and re-run.
- [ ]

### Task 5.12 — Create support ask endpoint
- PRECONDITION: `test -f backend/app/services/search_index.py` — if this fails, STOP the phase (playbook §5).
- DO: Create `backend/app/routers/support.py` (new), `APIRouter(prefix="/support", tags=["support"])`, and mount it in `backend/app/main.py` under `/v1`. `POST /ask` (body `{question: str, lang: str}`, accepts `Idempotency-Key`): (1) `gateway.decide(state, "support.intent.v1", ctx)` (pseudonymized via `privacy.py`); (2) if `escalate` is True OR `category` is `"money"` or `"account"` → create a human ticket immediately by reusing the expert-handoff write path from `backend/app/routers/chatbot.py` (same `expert_tickets` + `users/{uid}/expert_tickets` writes) and return `{kind: "ticket", ticketId}`; (3) else embed the question via `search_index.search_similar("faq", question)`, take the top FAQ articles, `gateway.generate()` an answer grounded ONLY in the retrieved articles, and return `{kind: "answer", answer, sources: [<faq_articles doc ids>]}` — if retrieval returns zero articles or top score is below 0.5 → escalate instead (same ticket path); (4) on gateway exception → deterministic fallback: keyword-match the question against `faq_articles` titles; if no match → escalate; (5) write a `support_conversations` doc `{uid, question, outcome: "resolved"|"escalated", category, sources, createdAt}` (instrumentation; the AI call itself is cost-logged to `ai_decisions` by the gateway). With `AI_PROVIDER=shim` the shim returns canned intent + fixed retrieval so the whole flow works.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/support.py && .venv/bin/python -m pytest tests/test_support_agent.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the endpoint and re-run.
- [ ]

### Task 5.13 — Support-agent invariant tests
- DO: In `backend/tests/test_support_agent.py` add: (1) `test_intent_routing_table`: shimmed intents for app_help/money/account/other route as expected; (2) `test_money_escalation_invariant`: questions classified `money` or `account` (seed a table of phrasings the shim maps to those categories — "where is my payment?", "mera paisa kahan hai", "change my bank account") ALWAYS create a human ticket, 100% — assert a ticket doc exists for every one; (3) `test_citation_required`: every `{kind: "answer"}` response has `sources` with >= 1 doc id, and each id exists in `faq_articles`; (4) `test_shim_golden`: with `AI_PROVIDER=shim`, a fixed app-help question returns the shim's canned answer with its fixed sources.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_support_agent.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the ask endpoint — never lower the escalation/citation assertions — and re-run.
- [ ]

### Task 5.14 — Support chat UI with citations
- DO: In `website/src/views/support/HelpCenterPage.tsx` add an ask box at the top: submit → `askSupport(question)`; render `{kind: "answer"}` responses as the answer text followed by a "Sources" line listing the cited `faq_articles` doc ids (each expandable to the article via the existing FAQ list state); render `{kind: "ticket"}` responses as a confirmation via `t('support.ticketCreated')` linking to the thread. Never render an answer with zero sources (defensive: if `sources` is empty, show the escalation fallback text instead).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the rendering and re-run.
- [ ]

### Task 5.15 — HUMAN CHECK: cited answer + money escalation
- PRECONDITION: `curl -sf http://localhost:8000/v1/health > /dev/null` — else start both dev servers (header conventions); if still failing, STOP (playbook §5).
- DO: HUMAN CHECK — human performs: (1) run the FAQ seed script if the FAQ list is empty (`cd backend && .venv/bin/python scripts/seed_faq.py`); (2) in the help center ask "how do I add a plot?" → an answer renders with at least one cited source doc id; (3) ask "where is my payment?" → a human ticket is created → post a reply as agent (or seed one) → the reply is visible in the support thread in-app.
- RUN: (manual — no command)
- EXPECT: human confirms all three behaviors.
- IF FAIL: record the diverging step and STOP (playbook §5).
- [ ]

### Task 5.16 — WS-05 checkpoint: verify + commit
- DO: Run the full WS-05 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-06 WS-05: support + M30 AI support agent"`
- EXPECT: pytest green; build clean; commit visible in `git log -1 --oneline`.
- IF FAIL: fix the failure; if only git commit fails, note it and continue (playbook §6).
- [ ]
