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

## WS-06 — PWA & offline  (see instructions.md §WS-06)

### Task 6.1 — Add vite-plugin-pwa dependency
- DO: Add `vite-plugin-pwa` as a devDependency of the website (the project has no PWA plugin today).
- RUN: `cd website && pnpm add -D vite-plugin-pwa && grep -c "vite-plugin-pwa" package.json`
- EXPECT: exit 0; grep count >= 1.
- IF FAIL: re-run `pnpm add -D vite-plugin-pwa` once; if the registry is unreachable, STOP (playbook §5) with the full output.
- [ ]

### Task 6.2 — Configure PWA plugin in vite.config.ts
- DO: In `website/vite.config.ts` (read it first) add `VitePWA` from `vite-plugin-pwa` to the plugins array with: `registerType: 'autoUpdate'`; `manifest`: `{name: 'AGROVERCITY', short_name: 'AGROVERCITY', display: 'standalone', start_url: '/', theme_color: '#16A34A', background_color: '#ffffff', icons: [{src: '/icon-192.png', sizes: '192x192', type: 'image/png'}, {src: '/icon-512.png', sizes: '512x512', type: 'image/png'}]}`; `workbox`: precache the app shell (default), `runtimeCaching`: (a) `GET` requests matching `/v1/reference/` → `CacheFirst`, (b) requests for locale files (`/src/lib/i18n/` or emitted locale chunks) → `CacheFirst`, (c) other API `GET`s → `NetworkFirst`; NEVER cache non-GET requests (add no handler for POST/PUT/DELETE).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the config typing (import `VitePWA` from `vite-plugin-pwa`) and re-run.
- [ ]

### Task 6.3 — Add PWA icons
- DO: Create directory `website/public/` if missing; copy the existing icons: `cp flutter-prototype/web/icons/Icon-192.png website/public/icon-192.png` and `cp flutter-prototype/web/icons/Icon-512.png website/public/icon-512.png` (run from repo root as part of DO).
- RUN: `test -f website/public/icon-192.png && test -f website/public/icon-512.png`
- EXPECT: exit 0.
- IF FAIL: if the source icons are missing, STOP (playbook §5) and report; do not invent substitute artwork.
- [ ]

### Task 6.4 — Register the service worker
- DO: In `website/src/main.tsx` (read it first) register the service worker via the virtual module: `import { registerSW } from 'virtual:pwa-register';` and call `registerSW({ immediate: true })` at startup. If tsc cannot resolve the virtual module, add `/// <reference types="vite-plugin-pwa/client" />` to `website/src/vite-env.d.ts` (create the file with just that line if missing).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: add the type reference line to `website/src/vite-env.d.ts` and re-run.
- [ ]

### Task 6.5 — Verify build emits manifest and service worker
- DO: Build the site and confirm the PWA artifacts are emitted.
- RUN: `cd website && pnpm build && ls dist/manifest.webmanifest dist/sw.js`
- EXPECT: exit 0; both files listed.
- IF FAIL: re-check task 6.2 config (plugin must be in `plugins`, `registerType` set) and re-run.
- [ ]

### Task 6.6 — Create offline outbox store
- DO: Create `website/src/lib/offline/outbox.ts` (new). Top-of-file doc comment must document the 3-line opt-in pattern for other forms: `import { enqueueOp } from '../lib/offline/outbox'` / wrap the submit call / on network failure call `enqueueOp({idempotencyKey, method, path, body})`. Implementation: localStorage-backed queue (key `av_outbox`) of operations shaped EXACTLY like the backend's `SyncOperation` (`{idempotencyKey: string, method: string, path: string, body: object, queuedAt: string}` — read `backend/app/routers/sync.py`); export `enqueueOp(op)` (caller supplies a client-generated `idempotencyKey` — generate with `crypto.randomUUID()`), `pendingCount()`, `subscribe(cb)` for count changes, and `flush()` which posts `{operations: [...]}` to `POST /v1/sync` via the existing client in `website/src/lib/api/client.ts` and removes successfully applied/duplicate ops from the queue. Register a `window.addEventListener('online', flush)` listener at module load. Never silently drop an op that returns `status: "error"` — keep it queued.
- RUN: `cd website && pnpm exec tsc --noEmit && grep -c "idempotencyKey" website/src/lib/offline/outbox.ts`
- EXPECT: tsc exit 0; grep count >= 1.
- IF FAIL: fix the store and re-run.
- [ ]

### Task 6.7 — Pending-sync indicator and toasts
- DO: In `website/src/lib/offline/outbox.ts` `flush()`: on successful sync of all queued ops fire `toast(t('offline.synced'))`; on network failure or any op staying queued fire `toast(t('offline.syncFailed'), { error: true })` — use `website/src/components/toast.ts` (read it first). In `website/src/views/dashboard/DashboardHome.tsx` add a small pending-sync badge subscribing to `pendingCount()` via `subscribe`, showing `t('offline.pendingSync', {count})` when count > 0.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the wiring and re-run.
- [ ]

### Task 6.8 — Offline i18n keys
- DO: Add `offline.pendingSync` ("{count} change(s) waiting to sync"), `offline.synced` ("All changes synced"), `offline.syncFailed` ("Sync failed — will retry when online") to `website/src/lib/i18n/locales/en.trade.ts` and `hi.trade.ts` with Hindi translations.
- RUN: `cd website && pnpm exec tsc --noEmit && grep -c "offline.syncFailed" website/src/lib/i18n/locales/hi.trade.ts`
- EXPECT: tsc exit 0; grep count >= 1.
- IF FAIL: add the missing keys and re-run.
- [ ]

### Task 6.9 — Wire farm-diary form to the outbox
- DO: In the farm-diary entry form under `website/src/views/diary/` (read the folder; find the form that POSTs a diary entry): wrap the submit so that on network failure (axios error without a response, or `navigator.onLine === false`) it calls `enqueueOp({idempotencyKey: crypto.randomUUID(), method: 'POST', path: <the same diary endpoint path>, body: <the form payload>})` and shows `toast(t('offline.pendingSync', {count: 1}))` instead of an error. Online behavior unchanged.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the form wiring and re-run.
- [ ]

### Task 6.10 — Wire one profile form to the outbox
- DO: Apply the same 3-line opt-in pattern to the main profile-edit form (look in `website/src/views/onboarding/` and `website/src/views/farmer/` for the form that PUTs the user profile — use the one hitting `PUT /v1/users/me`): on network failure enqueue `{method: 'PUT', path: '/v1/users/me', body}` with a fresh idempotency key; online behavior unchanged.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the form wiring and re-run.
- [ ]

### Task 6.11 — Verify /v1/sync dispatch covers both mutation types
- DO: Read `backend/app/services/sync.py` `dispatch` and confirm it can replay `POST <diary endpoint>` and `PUT /v1/users/me` (the two ops wired in tasks 6.9–6.10). If either mutation type is missing from the dispatch table, add it following the existing entries' pattern. Do not change the `SyncOperation` shape.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_sync.py -q`
- EXPECT: exit 0.
- IF FAIL: extend `app/services/sync.py` dispatch for the missing mutation type and re-run.
- [ ]

### Task 6.12 — Add outbox replay integration test
- DO: In `backend/tests/test_sync.py` add a test replaying a batch containing the diary-create op and the profile-update op (exact shapes from tasks 6.9–6.10), then replaying the SAME batch again: assert the first pass applies both and the second pass returns them as `duplicate` (server-side idempotency via `idempotencyKey`) — no double-apply.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_sync.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the idempotency handling in `app/services/sync.py` and re-run.
- [ ]

### Task 6.13 — Convert top-level routes to React.lazy
- DO: In `website/src/App.tsx` convert the top-level persona/module route components (the heavy views: trade pages, dairy, landlord, transport, instructor, and the new admin/support/search views) to `React.lazy(() => import(...))` with a single `<Suspense fallback={...}>` wrapper around the route tree (fallback = a minimal loading element using `t()`; add key `app.loading` to `en.ts` + `hi.ts`). Keep `/`, `/auth`, and `/legal/:page` eager. Move heavy deps (maps, charts) behind lazy boundaries — any view importing `@googlemaps/js-api-loader` must be lazy.
- RUN: `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: exit 0; build succeeds.
- IF FAIL: fix the lazy imports/Suspense placement and re-run.
- [ ]

### Task 6.14 — Measure first-load bundle <400 KB
- DO: Inspect the `pnpm build` output and compute the first-load JS gzip size: the entry chunk plus all chunks imported eagerly (i.e. NOT behind `React.lazy`). Record the sizes for the PR description.
- RUN: `cd website && pnpm build && node -e "const fs=require('fs'),zlib=require('zlib'),path=require('path');const dir='dist/assets';let total=0;for(const f of fs.readdirSync(dir)){if(!f.endsWith('.js'))continue;if(/^(?!index).+/.test(f)&&fs.existsSync(path.join(dir,f))){/* count only entry-ish chunks below */}}const entry=fs.readdirSync(dir).filter(f=>/^index.*\.js$/.test(f));let gz=0;for(const f of entry){gz+=zlib.gzipSync(fs.readFileSync(path.join(dir,f))).length}console.log('entry gzip bytes:',gz);process.exit(gz<400*1024?0:1)"`
- EXPECT: exit 0 — entry chunk gzip < 400 KB.
- IF FAIL: identify the largest eager import in the entry chunk (`pnpm build` output lists sizes), move it behind a `React.lazy` boundary in `App.tsx`, and re-run.
- [ ]

### Task 6.15 — HUMAN CHECK: install + offline draft + Lighthouse
- PRECONDITION: `curl -sf http://localhost:8000/v1/health > /dev/null` — else start both dev servers (header conventions); if still failing, STOP (playbook §5).
- DO: HUMAN CHECK — human performs: (1) serve the production build (`cd website && pnpm preview`) and open it in Chrome → install prompt fires → app launches standalone. (2) DevTools → Network → Offline → create a farm-diary draft → it appears as pending-sync → go Online → the draft syncs exactly once; trigger a second replay (re-run flush) → no duplicate diary entry server-side. (3) Run Lighthouse PWA check → installability passes (manifest + SW + HTTPS/localhost).
- RUN: (manual — no command)
- EXPECT: human confirms all three behaviors.
- IF FAIL: record the diverging step and STOP (playbook §5).
- [ ]

### Task 6.16 — WS-06 checkpoint: verify + commit
- DO: Run the full WS-06 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-06 WS-06: PWA & offline"`
- EXPECT: pytest green; build clean; commit visible in `git log -1 --oneline`.
- IF FAIL: fix the failure; if only git commit fails, note it and continue (playbook §6).
- [ ]

## WS-07 — i18n completion + M32 localization pipeline  (see instructions.md §WS-07)

### Task 7.1 — Create locale parity checker
- DO: Create `website/scripts/check_locales.mjs` (new). It must: (a) parse every locale file + module pair in `website/src/lib/i18n/locales/` (`en.ts` is the 436-key base; module pairs like `en.trade.ts`/`hi.trade.ts` count toward their locale), extracting keys with a regex over `'key':` entries; (b) diff every locale against the en base + en module keys, printing per-locale `missing`/`extra`/`approved` counts — approved keys = keys present in the REAL locale files only; it must ignore the `website/src/lib/i18n/drafts/` directory entirely (ai-draft keys never satisfy parity); (c) compare counts against `website/scripts/locale_baseline.json` (shape `{ "<locale>": <approvedCount>, ... }`): if the file is missing or run with `--write-baseline`, write current counts and exit 0; otherwise exit 1 when any locale's approved count dropped below baseline, or when en/hi parity breaks (hi missing any en key); otherwise exit 0.
- RUN: `cd website && node scripts/check_locales.mjs && test -f scripts/locale_baseline.json`
- EXPECT: exit 0 on first run; baseline file created.
- IF FAIL: fix the script (check the key-regex against `en.ts`'s actual formatting — read it) and re-run.
- [ ]

### Task 7.2 — Wire locales:check into package scripts and build
- DO: In `website/package.json` add script `"locales:check": "node scripts/check_locales.mjs"` and make the gate part of the build by changing `"build"` to `"pnpm locales:check && tsc --noEmit && vite build"` (this is the CI parity gate — any CI running the build now enforces it; no separate CI config exists in the repo).
- RUN: `cd website && pnpm locales:check && pnpm build`
- EXPECT: both exit 0.
- IF FAIL: if the gate fails on real missing keys, note the counts and continue to task 7.3 — do NOT weaken the gate.
- [ ]

### Task 7.3 — Organize phase-06 views into module locale pairs
- DO: Following the existing `en.trade.ts`/`hi.trade.ts` pattern (read one pair plus how they are registered in the i18n index), move the phase-06 keys added to `en.trade.ts`/`hi.trade.ts` into dedicated module pairs: chat-hub/strike keys (`chat.*`) → `en.chat.ts` + `hi.chat.ts` (new); notification-prefs, consent, deletion, offline keys (`notif.*`, `consent.*`, `delete.*`, `offline.*`) → `en.settings.ts` + `hi.settings.ts` (new); support keys (`support.*`) → `en.support.ts` + `hi.support.ts` (new); trust/rate/admin keys (`trust.*`, `rate.*`) → `en.admin.ts` + `hi.admin.ts` (new). Register each new pair exactly the way the existing module pairs are registered (read `website/src/lib/i18n/index.ts` and one module pair file to find the registration/import site).
- RUN: `cd website && pnpm exec tsc --noEmit && pnpm locales:check`
- EXPECT: both exit 0; no key counts regress vs baseline.
- IF FAIL: fix the registration of the new pairs and re-run.
- [ ]

### Task 7.4 — Create Gemini translation script with locked glossary
- PRECONDITION: `test -d backend/app/services/ai` — if this fails, STOP the phase (playbook §5).
- DO: Create `backend/scripts/translate_locales.py` (new). Docstring documents the draft convention: drafts are written to `website/src/lib/i18n/drafts/{locale}.draft.ts` with `export const status = 'ai-draft'` and are excluded from the build until approved. Behavior: (a) parse `en.ts` + en module pairs for the full key set; parse the target locale's real files for existing keys; diff → missing keys; (b) batch missing keys to Gemini (model from env `AI_GEMINI_MODEL`, via the same client config other backend AI code uses — read `backend/app/core/config.py`) with the locked `GLOSSARY` constant passed as do-not-translate terms — `GLOSSARY = ["mandi", "khasra", "7/12", "FPO", "PMFBY", "AGROVERCITY", "vyapari", "mandi bhav", "kisan", "Razorpay", "UPI"]` (keep these plus any agri terms you find already untranslated in `hi.ts`); (c) write the draft file; (d) upsert one `locale_approvals` doc per drafted key `{locale, key, enSource, draft, status: "pending"}` (doc id `{locale}__{key}`). CLI: `--locale <code>` required, `--shim` flag producing deterministic offline drafts (key + untranslated glossary preserved, body wrapped as `[<locale>] <en text>`) so CI/dev never calls paid APIs.
- RUN: `cd backend && .venv/bin/python -m py_compile scripts/translate_locales.py`
- EXPECT: exit 0.
- IF FAIL: fix and re-run.
- [ ]

### Task 7.5 — Glossary protection test
- DO: Create `backend/tests/test_translate_locales.py` (new): run the script's draft-generation function in `--shim` mode for locale `ta` against the real `en.ts` keys; assert (a) every glossary term in `GLOSSARY` appears verbatim (untranslated) in any draft value whose en source contained it, and (b) the draft file is written under `website/src/lib/i18n/drafts/` (use a tmp output dir override so the test does not dirty the repo — add an optional `out_dir` parameter to the script for this).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_translate_locales.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the script's glossary handling and re-run.
- [ ]

### Task 7.6 — Locale approval endpoints
- DO: In `backend/app/routers/admin.py` add: `GET /locale-drafts?locale=<code>` (admin-gated, cursor pagination) listing `locale_approvals` docs with `status: "pending"`; `POST /locale-approvals` (admin-gated, body `{locale, key, action: "approve"|"reject"}`, accepts `Idempotency-Key`) updating the doc to `status: "approved"|"rejected"` with `reviewedBy` + `reviewedAt` — this is the audit record (who, when, key). Standard error envelope.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/admin.py && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the endpoints and re-run.
- [ ]

### Task 7.7 — Approval endpoint tests
- DO: Create `backend/tests/test_locale_approvals.py` (new): seed pending `locale_approvals` docs → admin lists them → approve one → doc has `status: "approved"`, `reviewedBy`, `reviewedAt`; reject one → `status: "rejected"`; non-admin → 403 on both endpoints.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_locale_approvals.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the endpoints and re-run.
- [ ]

### Task 7.8 — Create apply-approvals script
- DO: Create `backend/scripts/apply_locale_approvals.py` (new): reads all `locale_approvals` docs with `status: "approved"` and `applied != true`; for each, inserts `{key}: {draft}` into the target real locale file `website/src/lib/i18n/locales/{locale}.ts` before its closing brace (match the file's existing entry style — read it first; skip keys already present); then marks the docs `applied: true`. CLI: `--locale <code>` optional filter.
- RUN: `cd backend && .venv/bin/python -m py_compile scripts/apply_locale_approvals.py`
- EXPECT: exit 0.
- IF FAIL: fix and re-run.
- [ ]

### Task 7.9 — Create LocaleReviewPage admin view
- DO: Create `website/src/views/admin/LocaleReviewPage.tsx` (new): locale selector; fetch `GET /v1/admin/locale-drafts?locale=...` (add wrappers to `website/src/lib/api/admin.ts`); render each draft key side-by-side (en source vs draft) with approve/reject buttons POSTing to `/v1/admin/locale-approvals`; approved/rejected rows update in place. Strings via `t()` — add needed keys to `en.admin.ts` + `hi.admin.ts`. Add the route in `website/src/App.tsx` beside the other admin routes.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors and re-run.
- [ ]

### Task 7.10 — Generate ta drafts (shim mode)
- DO: Run the translation script for `ta` in shim mode (real Gemini runs are the human operator's call with real keys; the pipeline is identical).
- RUN: `cd backend && .venv/bin/python scripts/translate_locales.py --locale ta --shim && ls website/src/lib/i18n/drafts/ta.draft.ts`
- EXPECT: exit 0; draft file exists and (from the script's stdout) covers the keys missing from `ta` (en base 436 − ta's current approved keys).
- IF FAIL: fix the script error shown and re-run.
- [ ]

### Task 7.11 — Approve ta keys and apply
- DO: Approve all pending `ta` approval docs (scripted, not one-by-one: `cd backend && .venv/bin/python -c` snippet or a small `--locale ta --approve-all` helper you add to `apply_locale_approvals.py` — follow the endpoint's audit fields by setting `reviewedBy: "script:bulk"`, `reviewedAt` on each), then run the apply script to promote them into `ta.ts`.
- RUN: `cd backend && .venv/bin/python scripts/apply_locale_approvals.py --locale ta && cd website && pnpm locales:check`
- EXPECT: apply exits 0; `pnpm locales:check` exits 0 and its per-locale output shows `ta` with 0 missing keys (436/436 approved).
- IF FAIL: inspect which keys are still missing (`node scripts/check_locales.mjs` prints them), re-run the pipeline for those, and re-check.
- [ ]

### Task 7.12 — Update the approved-key baseline
- DO: Regenerate the baseline so the new approved counts (including ta at 436) become the enforced floor, and commit it with the workstream checkpoint.
- RUN: `cd website && node scripts/check_locales.mjs --write-baseline && pnpm locales:check`
- EXPECT: exit 0 both.
- IF FAIL: fix the baseline write and re-run.
- [ ]

### Task 7.13 — Prove the CI gate fails on regression
- DO: Scripted proof: remove one approved key from `website/src/lib/i18n/locales/ta.ts` (comment it out via `git stash`-able edit — simplest: copy the file to /tmp, delete one entry line, run the gate, restore). Steps: `cp` the file to a temp path; delete one key line; run `pnpm locales:check` → MUST exit non-zero; restore the file from the temp copy; run the gate again → MUST exit 0.
- RUN: `cd website && cp src/lib/i18n/locales/ta.ts /tmp/ta.ts.bak && sed -i "/^  '[^']*':/d" src/lib/i18n/locales/ta.ts && sed -i "s/^}/  '__placeholder__': 'x'\n}/" src/lib/i18n/locales/ta.ts 2>/dev/null; node scripts/check_locales.mjs; code=$?; cp /tmp/ta.ts.bak src/lib/i18n/locales/ta.ts; node scripts/check_locales.mjs; code2=$?; echo "gate-on-regression=$code gate-after-restore=$code2"; test $code -ne 0 -a $code2 -eq 0`
- EXPECT: final exit 0 with output `gate-on-regression=<non-zero> gate-after-restore=0`.
- IF FAIL: if the gate passed on the regressed file, fix `check_locales.mjs` baseline comparison and re-run the whole proof.
- [ ]

### Task 7.14 — HUMAN CHECK: review UI + glossary
- PRECONDITION: `curl -sf http://localhost:8000/v1/health > /dev/null` — else start both dev servers (header conventions); if still failing, STOP (playbook §5).
- DO: HUMAN CHECK — human performs: (1) open LocaleReviewPage → ta draft keys render side-by-side (en source vs draft); (2) spot-check that glossary terms (mandi, khasra, 7/12, FPO, PMFBY, AGROVERCITY) appear untranslated in every draft containing them; (3) reject one key → it leaves the pending list and is not promoted; (4) confirm `pnpm build` passes with unapproved drafts excluded (drafts directory is not imported anywhere).
- RUN: (manual — no command)
- EXPECT: human confirms all four.
- IF FAIL: record the diverging step and STOP (playbook §5).
- [ ]

### Task 7.15 — WS-07 checkpoint: verify + commit
- DO: Run the full WS-07 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm locales:check && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-06 WS-07: i18n completion + M32 localization pipeline"`
- EXPECT: pytest green; locales:check and build clean; commit visible in `git log -1 --oneline`.
- IF FAIL: fix the failure; if only git commit fails, note it and continue (playbook §6).
- [ ]

## WS-08 — Search embeddings upgrade (M23)  (see instructions.md §WS-08)

### Task 8.1 — Locate the phase-05 keyword search
- DO: Inventory-only task (no edits): locate the phase-05 keyword search implementation.
- RUN: `grep -rln "def .*search\|/search" backend/app/routers/ backend/app/services/ | head -20`
- EXPECT: exit 0. Record the output in your task report. If no router-level search exists (phase-05 still in flight), this workstream's new `routers/search.py` delivers the keyword fallback itself — that is already what tasks 8.2+ specify, so proceed either way.
- IF FAIL: re-run with `grep -rln "search" backend/app/routers/ | head -20`; if still nothing, proceed — the fallback gets built in task 8.2.
- [ ]

### Task 8.2 — Create search router with keyword fallback
- DO: Create `backend/app/routers/search.py` (new), `APIRouter(prefix="/search", tags=["search"])`: `GET ""` (full path `/v1/search?q=...&cursor=...&limit=...`) with the standard error envelope and cursor pagination (shape `{"data": [...], "nextCursor": ...}`). Implement `_keyword_search(index: str, q: str, limit: int) -> list[dict]`: case-insensitive substring match over the title/name/body fields of the collection each index maps to — `schemes` → the collection used by `backend/app/routers/schemes.py`, `products` → `backend/app/routers/marketplace.py`, `news` → `backend/app/routers/content.py`, `crops` → the crops collection used by the lots/mandi routers (read `backend/app/routers/lots.py` and `backend/app/routers/mandi.py`), `courses` → `backend/app/routers/courses.py`, `lots` → `backend/app/routers/lots.py` (read each router for its exact collection + title fields). Default behavior (no AI): query ALL indexes by keyword and return grouped hits `[{index, docId, title, snippet, score}]` (keyword score = 1.0 for title match, 0.5 for body match).
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/search.py`
- EXPECT: exit 0.
- IF FAIL: fix and re-run.
- [ ]

### Task 8.3 — Mount search router + keyword test
- DO: Mount `search.router` in `backend/app/main.py` under `/v1` (same include pattern as task 4.7). Create `backend/tests/test_search.py` (new): seed two scheme docs and one news doc in the fake store; `GET /v1/search?q=pm-kisan` → the scheme hit appears with `index: "schemes"`; `q` matching nothing → empty `data`, valid envelope.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_search.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the router/mount and re-run.
- [ ]

### Task 8.4 — Register search.intent.v1
- PRECONDITION: `test -f backend/app/services/ai/question_sets.py` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/app/services/ai/question_sets.py` register `search.intent.v1`: output `index` (choice: `schemes`, `products`, `news`, `crops`, `courses`, `lots`); fallback = query all indexes by keyword (represent as `index: null` or a `all` value per the file's choice-field pattern — match the file's conventions); level `suggest`.
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/ai/question_sets.py`
- EXPECT: exit 0.
- IF FAIL: match the file's registration API and re-run.
- [ ]

### Task 8.5 — Wire intent routing into /v1/search
- PRECONDITION: `test -d backend/app/services/ai` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/app/routers/search.py` `GET /v1/search`: call `gateway.decide(state, "search.intent.v1", ctx)` (pseudonymized state — the query text only; no PII) and restrict/target the keyword queries to the chosen index(es), placing that index's group first in the response. On exception → fallback: query all indexes by keyword (task 8.2 behavior). Extend `backend/tests/test_search.py`: shimmed intent for "pyaz ka bhav" → `lots` (or `crops` per shim mapping) returns that group first; shimmed intent for "PM-Kisan" → `schemes` first.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_search.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the routing — never weaken the ordering assertions — and re-run.
- [ ]

### Task 8.6 — Add reindex() to the search index helper
- PRECONDITION: `test -f backend/app/services/search_index.py` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/app/services/search_index.py` add `async def reindex(indexes: list[str] | None = None) -> dict`: iterate the source collections for the given indexes (default all six), `upsert_document` each doc whose `updatedAt`/modified marker is newer than its stored `search_index` entry (store a checkpoint doc `search_index_meta/last_run` `{cursor, updatedAt}` so the job is resumable), and return counts per index. Idempotent: running twice in a row re-embeds nothing.
- RUN: `cd backend && .venv/bin/python -m py_compile app/services/search_index.py`
- EXPECT: exit 0.
- IF FAIL: fix and re-run.
- [ ]

### Task 8.7 — Cosine merge with keyword-wins-ties ordering
- PRECONDITION: `test -f backend/app/services/search_index.py` — if this fails, STOP the phase (playbook §5).
- DO: In `backend/app/routers/search.py` merge semantic hits into results: for each index, get `search_similar(index, q)` hits and merge with keyword hits by `docId` — final score = keyword score + cosine score, keyword wins ties (sort by score desc, then by `hasKeywordMatch` desc). With the AI flag off or shim, skip the embedding path entirely (keyword-only). Extend `backend/tests/test_search.py` with a merge-ordering fixture: a doc that matches keyword AND cosine ranks above a doc matching cosine only, which ranks above no match.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_search.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the merge comparator and re-run.
- [ ]

### Task 8.8 — Add search reindex job
- DO: In `backend/app/routers/jobs.py` add `POST /search_reindex` (full path `/v1/jobs/search_reindex`, same guard pattern as existing jobs) calling `reindex()`. Extend `backend/tests/test_search.py`: run the job twice → first run embeds the seeded docs (vectors stored), second run reports 0 re-embedded (idempotent + resumable).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_search.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the job/reindex checkpoint logic and re-run.
- [ ]

### Task 8.9 — Shim-mode keyword-only invariant test
- DO: In `backend/tests/test_search.py` add `test_shim_keyword_only`: with `AI_PROVIDER=shim` (and again with the search module flag off), `GET /v1/search?q=...` returns keyword-only results — assert the embedding path was never called (monkeypatch `search_index.search_similar` to raise if called).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_search.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the flag/shim branch in `app/routers/search.py` and re-run.
- [ ]

### Task 8.10 — Create search API wrapper
- DO: Create `website/src/lib/api/search.ts` (new): `search(q: string, cursor?: string)` calling `GET /v1/search`, typed result `{index, docId, title, snippet, score}` and the paginated envelope, following the existing wrapper pattern (read `website/src/lib/api/client.ts`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the wrapper and re-run.
- [ ]

### Task 8.11 — Create SearchResultsPage view
- DO: Create `website/src/views/search/SearchResultsPage.tsx` (new): reads `?q=` from the URL, calls `search(q)`, renders results GROUPED by module — group headings for mandi/lots, schemes, courses, news, products (order the groups as the API returns them) — each result row deep-links into its module route (map `index` → route: `lots`/`crops` → mandi/lots route, `schemes` → schemes route, `courses` → courses route, `news` → news route, `products` → marketplace route; read `website/src/App.tsx` for the actual paths). Group headings + empty state via `t()`; add keys (`search.title`, `search.empty`, `search.group.lots`, `search.group.schemes`, `search.group.courses`, `search.group.news`, `search.group.products`) to `en.trade.ts` + `hi.trade.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors and re-run.
- [ ]

### Task 8.12 — Route + global search-box wiring
- DO: In `website/src/App.tsx` add route `/search` rendering `SearchResultsPage`. Wire the global search box from the all-tools launcher (robust §7.24 — read `website/src/components/dashboard/` for the launcher/tools-sheet component; if it has no search input yet, add one at its top) so submitting a query navigates to `/search?q=<query>`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the wiring and re-run.
- [ ]

### Task 8.13 — HUMAN CHECK: search flows
- PRECONDITION: `curl -sf http://localhost:8000/v1/health > /dev/null` — else start both dev servers (header conventions); if still failing, STOP (playbook §5).
- DO: HUMAN CHECK — human performs: (1) from the launcher search "pyaz ka bhav" → mandi/lots group renders first; search "PM-Kisan" → schemes first. (2) Run `POST /v1/jobs/search_reindex` → completes. (3) Edit a scheme doc's text → re-run reindex → the new text is findable semantically (a related phrasing, not the exact words, returns the scheme). (4) Repeat a query with the AI flag off → keyword-only results, nothing breaks.
- RUN: (manual — no command)
- EXPECT: human confirms all four.
- IF FAIL: record the diverging step and STOP (playbook §5).
- [ ]

### Task 8.14 — WS-08 checkpoint: verify + commit
- DO: Run the full WS-08 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-06 WS-08: search embeddings upgrade (M23)"`
- EXPECT: pytest green; build clean; commit visible in `git log -1 --oneline`.
- IF FAIL: fix the failure; if only git commit fails, note it and continue (playbook §6).
- [ ]

## WS-09 — Analytics taxonomy  (see instructions.md §WS-09)

### Task 9.1 — Add batch event ingest endpoint
- DO: In `backend/app/routers/analytics.py` (extend, do NOT fork) add `POST /events` (full path `/v1/analytics/events`): accepts `{events: [...]}` (max 50) where each event is `{eventId, persona, name, props (flat map, string/number/bool values only), sessionId, clientTs}`; the server adds `userId` (from auth) and `serverTs`; rejects any `name` not in the canonical list `["screen_view", "task_shown", "task_clicked", "task_completed", "notification_sent", "notification_opened", "deep_link_completed", "transaction_completed", "plan_upgraded", "support_resolved", "support_escalated"]` (422 `ANALYTICS_UNKNOWN_EVENT`); dedupes on `eventId` (doc id = `eventId` in collection `analytics_events` — a second write with the same id is a no-op reported as duplicate); requires the `Idempotency-Key` header per the repo write pattern. Response `{applied, duplicates}`.
- RUN: `cd backend && .venv/bin/python -m py_compile app/routers/analytics.py && .venv/bin/python -m pytest tests/test_analytics.py -q`
- EXPECT: exit 0, existing analytics tests green.
- IF FAIL: fix the endpoint and re-run.
- [ ]

### Task 9.2 — Event ingest dedupe tests
- DO: Create `backend/tests/test_analytics_events.py` (new): (1) POST a batch of 3 valid events → `applied == 3`, docs exist in `analytics_events` with `serverTs` set; (2) re-POST the same batch → `duplicates == 3`, `applied == 0`, still exactly 3 docs; (3) an event with `name: "hacked_event"` → 422; (4) no PII guard: `props` values that look like phone numbers (regex `[6-9]\d{9}`) → that event rejected 422.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_analytics_events.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the endpoint (never weaken the assertions) and re-run.
- [ ]

### Task 9.3 — North-star aggregation endpoint
- DO: In `backend/app/routers/analytics.py` add `GET /north-star` (admin-gated) computing over `analytics_events` (+ settlement ledger for money truth — read `backend/app/services/settlements.py` for the ledger source): (1) `weeklyTransactingFarmers` — distinct farmer `userId`s with a `transaction_completed` event in the last 7 days; (2) `gmvPerMarketplace` — sum of `props.gmv_paisa` from `transaction_completed` grouped by `props.marketplace` (integer paisa out); (3) `takeRateRevenuePaisa` — sum of `props.take_rate_paisa` (integer paisa); (4) `paidPlanConversion` — `plan_upgraded` count / distinct users with any event; (5) `tasksPerUserPerWeek` — `task_completed` count last 7 days / distinct users with `task_shown`; (6) `deepLinkCompletionRate` — `deep_link_completed` / `notification_sent` count. Extend `backend/tests/test_analytics_events.py`: seed events computing to known values for all six metrics and assert each number exactly.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_analytics_events.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the aggregation until the seeded numbers match exactly.
- [ ]

### Task 9.4 — Create website analytics beacon
- DO: Create `website/src/lib/analytics.ts` (new): `track(name, props?)` building an event `{eventId: crypto.randomUUID(), persona: <active persona from the onboarding store>, name, props, sessionId: <one per tab, generated at module load>, clientTs: new Date().toISOString()}` and queueing it in memory; flush every 15s and on `pagehide`/`visibilitychange` (hidden) via `POST /v1/analytics/events` using the client from `website/src/lib/api/client.ts` with an `Idempotency-Key` header (one per flush batch, `crypto.randomUUID()`). Call `track` from `website/src/main.tsx` once to initialize the flush timers.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the beacon and re-run.
- [ ]

### Task 9.5 — Track screen_view on route change
- DO: In `website/src/App.tsx` add a small component inside the router that calls `track('screen_view', {path: location.pathname})` on every location change (`useLocation` + `useEffect`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the hook placement and re-run.
- [ ]

### Task 9.6 — Track dashboard task funnel
- PRECONDITION: `test -f backend/app/routers/tasks.py` — phase-01 Action Center backend; if this fails, STOP the phase (playbook §5).
- DO: In the phase-01 Action Center surface on the dashboard (read `website/src/views/dashboard/DashboardHome.tsx` and the task-card component it renders): fire `track('task_shown', {taskId})` when a task card renders, `track('task_clicked', {taskId})` on tap, `track('task_completed', {taskId})` when the task completes (hook the same completion signal the Action Center already uses — do not invent a new one).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the wiring and re-run.
- [ ]

### Task 9.7 — Track notification open + deep-link completion
- DO: In `website/src/views/trade/NotificationsPage.tsx`: fire `track('notification_opened', {notificationId})` when a notification is tapped, and `track('deep_link_completed', {notificationId, deepLink})` when the deep-linked target action completes (hook the completion at the deep-link landing: if the landing is the dashboard task, fire it from the same completion signal as task 9.6, including the originating `notificationId` when present in the route state).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the wiring and re-run.
- [ ]

### Task 9.8 — Server-side money + plan events
- DO: Server-side only for money (never trust the client for GMV): (a) in the order/settlement completion path (`backend/app/services/settlements.py` and/or the order completion endpoint — read both, emit at the point money actually settles), write an `analytics_events` doc `transaction_completed` with `props.gmv_paisa` and `props.take_rate_paisa` as INTEGER paisa (no floats for money), `eventId` derived deterministically from the transaction id (`txn_<id>`) so retries dedupe; (b) in the plan-upgrade path (find it — grep for subscription/plan upgrade in `backend/app/routers/`), emit `plan_upgraded` with `props.plan`. Extend `backend/tests/test_analytics_events.py`: completing a seeded settlement/order writes exactly one `transaction_completed` event with the expected paisa integers.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_analytics_events.py tests/test_settlements.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the emit point and re-run.
- [ ]

### Task 9.9 — Support outcome events
- DO: In `backend/app/routers/support.py` `POST /ask`: after writing the `support_conversations` doc, also write an `analytics_events` doc — `support_resolved` (with `props.sources_count`) when an answer was returned, `support_escalated` (with `props.category`) when a ticket was created. `eventId` = `support_<conversation doc id>` for dedupe. Extend `backend/tests/test_support_agent.py`: one resolved and one escalated ask each produce exactly one matching analytics event.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_support_agent.py tests/test_analytics_events.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the emit and re-run.
- [ ]

### Task 9.10 — Create MetricsPage admin view
- DO: Create `website/src/views/admin/MetricsPage.tsx` (new): fetch `GET /v1/analytics/north-star` (add wrapper to `website/src/lib/api/admin.ts`) and render all six metrics as labeled cards: weekly transacting farmers, GMV per marketplace (render paisa ÷ 100 as ₹ at DISPLAY time only — values stay integer paisa in the API), take-rate revenue, paid-plan conversion, tasks/user/week, deep-link completion rate. Labels via `t()` — add keys (`metrics.title`, `metrics.wtf`, `metrics.gmv`, `metrics.takeRate`, `metrics.paidConversion`, `metrics.tasksPerUser`, `metrics.deepLinkRate`) to `en.admin.ts` + `hi.admin.ts`. Add the route in `website/src/App.tsx` beside the other admin routes.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type errors and re-run.
- [ ]

### Task 9.11 — HUMAN CHECK: metrics move on real flows
- PRECONDITION: `curl -sf http://localhost:8000/v1/health > /dev/null` — else start both dev servers (header conventions); if still failing, STOP (playbook §5).
- DO: HUMAN CHECK — human performs: (1) complete a dashboard task reached from a push deep link → MetricsPage deep-link completion rate and tasks/user/week move; (2) upgrade a plan in staging → paid-plan conversion moves; (3) confirm all six metrics render numbers from real `analytics_events` (not zeros-with-errors — open the network tab and confirm the endpoint returned data).
- RUN: (manual — no command)
- EXPECT: human confirms all three.
- IF FAIL: record the diverging step and STOP (playbook §5).
- [ ]

### Task 9.12 — WS-09 checkpoint: verify + commit
- DO: Run the full WS-09 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-06 WS-09: analytics taxonomy"`
- EXPECT: pytest green; build clean; commit visible in `git log -1 --oneline`.
- IF FAIL: fix the failure; if only git commit fails, note it and continue (playbook §6).
- [ ]

## Phase-final gate

Each exit-gate item from `phase-06/readme.md` as its own verifiable task, then the global verification gate (`execution-plan/README.md` §4 + instructions.md "Phase-final verification").

### Task G.1 — Exit gate: chat guardrail quality
- DO: Prove the WS-01 exit-gate items: red-team evasion set ≥90% caught in the golden test, benign false positives <5%, regex-only mode works with the AI flag off, send-latency regression <300ms.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_chat_moderation.py -q -k "golden or flag_off or latency"`
- EXPECT: exit 0 — the golden, flag-off, and latency tests (tasks 1.14) all pass.
- IF FAIL: re-open the failing WS-01 task and fix it; never lower the thresholds.
- [ ]

### Task G.2 — Exit gate: notifications integrity
- DO: Prove the WS-02 exit-gate items: digest batches 3→1, hi copy renders, zero notifications lost with `AI_PROVIDER=shim` / AI disabled, quiet hours enforced.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_notifications_dispatch.py -q`
- EXPECT: exit 0 — quiet-hours table, digest batching, pref filtering, and AI-disabled delivery tests all pass.
- IF FAIL: re-open the failing WS-02 task and fix it.
- [ ]

### Task G.3 — Exit gate: fraud detection with provenance
- DO: Prove the WS-03 exit-gate items: seeded fraud ring caught (`risk > 0.8`, soft_hold + queue), legitimate settlements unaffected, every hold carries AI reason + `decision_id`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_trust_fraud.py -q`
- EXPECT: exit 0.
- IF FAIL: re-open the failing WS-03 task and fix it.
- [ ]

### Task G.4 — Exit gate: consent, export, deletion
- DO: Prove the WS-04 exit-gate items: consent toggles persist, DPDP export downloads a complete archive, account deletion purges end-to-end.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_consents.py tests/test_account.py tests/test_data_export.py -q`
- EXPECT: exit 0.
- IF FAIL: re-open the failing WS-04 task and fix it.
- [ ]

### Task G.5 — Exit gate: support agent invariants
- DO: Prove the WS-05 exit-gate items: app-help answers cite FAQ source doc ids; money/account questions escalate 100%; full flow works on shim.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_support_agent.py -q`
- EXPECT: exit 0 — intent table, money-escalation invariant, citation-required, shim golden all pass.
- IF FAIL: re-open the failing WS-05 task and fix it.
- [ ]

### Task G.6 — Exit gate: PWA artifacts + bundle size
- DO: Prove the WS-06 exit-gate scriptable items: build emits manifest + service worker; first-load entry chunk <400 KB gzip. (Install prompt, offline sync, and Lighthouse were human-verified in task 6.15 — re-confirm in G.13.)
- RUN: `cd website && pnpm build && ls dist/manifest.webmanifest dist/sw.js && node -e "const fs=require('fs'),zlib=require('zlib'),path=require('path');const dir='dist/assets';const entry=fs.readdirSync(dir).filter(f=>/^index.*\.js$/.test(f));let gz=0;for(const f of entry){gz+=zlib.gzipSync(fs.readFileSync(path.join(dir,f))).length}console.log('entry gzip bytes:',gz);process.exit(gz<400*1024?0:1)"`
- EXPECT: exit 0 — artifacts listed and entry gzip under 400 KB.
- IF FAIL: return to tasks 6.13–6.14 and shrink the eager bundle; never delete the size check.
- [ ]

### Task G.7 — Exit gate: ta parity + glossary + CI gate
- DO: Prove the WS-07 exit-gate items: `ta` at 436/436 approved keys, glossary terms untranslated, parity gate green (and proven to fail on regression in task 7.13).
- RUN: `cd website && pnpm locales:check && ! grep -rn "मंडी भाव translation\|khasra.*translated" src/lib/i18n/drafts/ 2>/dev/null; grep -c "mandi\|khasra\|7/12\|FPO\|PMFBY\|AGROVERCITY" src/lib/i18n/drafts/ta.draft.ts 2>/dev/null || true`
- EXPECT: `pnpm locales:check` exits 0 with `ta` showing 0 missing keys; glossary terms appear verbatim (untranslated) in the draft file where present (final grep count > 0 if drafts exist, or drafts already applied and removed — either is acceptable; state which in your report).
- IF FAIL: return to WS-07 tasks 7.10–7.13 and complete the ta pipeline properly.
- [ ]

### Task G.8 — Exit gate: search behavior
- DO: Prove the WS-08 exit-gate scriptable items: intent routing ("pyaz ka bhav" → mandi/lots first on shim mapping), reindex idempotency, shim keyword-only mode.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_search.py -q`
- EXPECT: exit 0.
- IF FAIL: re-open the failing WS-08 task and fix it.
- [ ]

### Task G.9 — Exit gate: analytics north-star
- DO: Prove the WS-09 exit-gate items: all six north-star metrics compute from real `analytics_events`; duplicate event ids dedupe; deep-link completion chain (sent → opened → deep_link_completed) is computable.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_analytics_events.py -q`
- EXPECT: exit 0.
- IF FAIL: re-open the failing WS-09 task and fix it.
- [ ]

### Task G.10 — Global gate: backend suite green
- DO: Run the full backend suite (global verification gate, execution-plan/README.md §4).
- RUN: `cd backend && .venv/bin/python -m pytest -q`
- EXPECT: exit 0 — fully green including every new test file from this phase.
- IF FAIL: if the failure is in code this phase touched, fix it; if it fails for reasons unrelated to your workstreams, STOP (playbook §5) with the full output.
- [ ]

### Task G.11 — Global gate: website typecheck + build
- DO: Run the website half of the global gate.
- RUN: `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: exit 0 — clean (build also runs the locales parity gate per task 7.2).
- IF FAIL: fix the type/build error and re-run.
- [ ]

### Task G.12 — Global gate: full suite on AI shim
- DO: Prove the whole app works with AI disabled/shimmed.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q`
- EXPECT: exit 0 — full suite green with `AI_PROVIDER=shim`.
- IF FAIL: find the code path that hard-depends on a real provider, give it a deterministic fallback, and re-run.
- [ ]

### Task G.13 — HUMAN CHECK: manual sweep, one flow per workstream
- PRECONDITION: `curl -sf http://localhost:8000/v1/health > /dev/null` — else start both dev servers (header conventions); if still failing, STOP (playbook §5).
- DO: HUMAN CHECK — human re-confirms the nine phase flows (from the dashboard task deep-link where applicable): (1) WS-01: booking chat → regex violation blocked + strike notice in hi → evasive message caught with AI on → Chats hub unread badge in a second persona; (2) WS-02: push → tap → dashboard task → action completed; digest batches 3→1; quiet-hours hold at 22:00; AI off → still delivered; (3) WS-03: fraud scan on seeded ring → hold with reason + decision_id → finance_admin releases with an audit_logs reason; legit settlement batch settles; (4) WS-04: consent toggle persists → export downloads → delete account from the website → purged; (5) WS-05: cited FAQ answer; money question → human ticket → thread reply visible; (6) WS-06: install PWA; offline draft → reconnect → synced once; Lighthouse PWA pass; (7) WS-07: ta approved-complete; inject a missing key → CI gate fails → revert → green; (8) WS-08: "pyaz ka bhav" → mandi/lots first; shim → keyword-only; (9) WS-09: all six north-star metrics render; deep-link completion rate reflects the WS-02 run.
- RUN: (manual — no command)
- EXPECT: human confirms all nine flows.
- IF FAIL: record the diverging flow(s) and STOP (playbook §5).
- [ ]

### Task G.14 — Global gate: no "coming soon" reachable
- DO: Verify no surface touched by this phase can render a "coming soon" placeholder.
- RUN: `grep -rni "coming soon" website/src/views/chat website/src/views/settings website/src/views/support website/src/views/search website/src/views/admin website/src/components/ReportBlockMenu.tsx website/src/components/RatePrompt.tsx website/src/lib/offline 2>/dev/null; test $? -eq 1`
- EXPECT: exit 0 — grep finds nothing in the phase-06 surfaces.
- IF FAIL: replace the placeholder with the real view from the relevant workstream (or remove the dead nav entry pointing to it) and re-run.
- [ ]

### Task G.15 — Phase-final commit
- DO: Commit the final phase state.
- RUN: `git add -A && git commit -m "phase-06: cross-cutting platform services complete" && git log -1 --oneline`
- EXPECT: exit 0; log line shows the phase-06 completion commit.
- IF FAIL: if there is nothing new to commit, run `git log -1 --oneline` and confirm the WS-09 checkpoint commit is present, then mark done; if commit fails for identity reasons, note it and finish (playbook §6).
- [ ]
