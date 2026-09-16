# Schema — Redis Keys

Redis is used for caching, rate limiting, sessions, idempotency, and lightweight real-time counters. Firestore remains the source of truth; **everything in Redis is disposable** and must be rebuildable. All keys are accessed only from `backend/app/core/redis.py` helpers + services — never ad-hoc key strings scattered in routers.

Connection: `REDIS_URL` env var (see `overview/01-product-and-architecture.md` §6). Dev: `redis:7` service in `infra/docker-compose.yml`. All TTLs below are set with `SET ... EX <ttl>` / `EXPIRE` at write time; never leave a key without a TTL except `notify:queue` (a list, trimmed).

## Key inventory

| # | Key pattern | Type | TTL | Purpose |
|---|---|---|---|---|
| 1 | `cache:mandi:prices:{crop}:{district}` | JSON string | 2 h | Mandi price list cache (Agmarknet/eNAM) |
| 2 | `cache:mandi:vyapari:{cropsHash}` | JSON string | 2 h | "Aaj ke Bhav" vyapari-rate cache |
| 3 | `cache:weather:{latGrid}:{lngGrid}` | JSON string | 30 min | Weather strip proxy cache |
| 4 | `otp:attempts:{phone}` | int (INCR) | 10 min | OTP verify attempt counter |
| 5 | `otp:resend:{phone}` | int (INCR) | 1 h | OTP resend throttle |
| 6 | `rl:{uid}:{routeBucket}` | sorted set | 1 min window | Per-user rate limiting |
| 7 | `chat:session:{sessionId}` | JSON string | 24 h (rolling) | Chatbot conversation context |
| 8 | `idem:{uid}:{idempotencyKey}` | JSON string | 24 h | Idempotent write replay |
| 9 | `live:viewers:{channelId}` | int (INCR/DECR) | 5 min | Live channel viewer count |
| 10 | `notify:queue` | list (LPUSH/BRPOP) | no TTL, `LTRIM` to 10 000 | Notification fan-out queue |
| 11 | `refresh:{tokenId}` | string | 30 d | Refresh-token → uid mapping |
| 12 | `mpin:fail:{uid}` | int (INCR) | 15 min | MPIN failure counter → lockout |
| 13 | `lock:{name}` | string (SET NX PX) | 30 s | Distributed locks (slot booking, stock decrement) |

## Details per key

### 1. `cache:mandi:prices:{crop}:{district}`
- **Written by:** mandi ingestion job (every 2 h, 06:00–20:00 IST) and lazily on first miss by `mandi_service`.
- **Value:** JSON array of `MandiPrice` objects exactly as the API returns (rupees as int, ISO timestamps).
- **Key shape:** `crop` = lowercase slug or `all`; `district` = lowercase slug. Example: `cache:mandi:prices:tomato:nashik`.
- **Invalidation:** overwritten each ingestion run; TTL is a safety net only.
- **Read path:** `GET /mandi/prices` → cache hit returns immediately with `cachedAt` in each item; miss → Firestore query → cache set (2 h).

### 2. `cache:mandi:vyapari:{cropsHash}`
- **Written by:** vyapari aggregation job (2 h) and on admin rate approval/rejection (gap doc B.7).
- **Value:** JSON array of `VyapariRate` objects (`{ id, crop, rateDisplay, priceChange, changeDir, mandiName, vyapariCount, lastUpdated }`).
- **Key shape:** `cropsHash` = first 12 chars of SHA-256 of the sorted, comma-joined crop list — keeps keys short for arbitrary crop filters. Example: `cache:mandi:vyapari:3f9a1c02b8d4`.
- **Invalidation:** explicit `DEL` of all keys matching `cache:mandi:vyapari:*` when an admin approves/rejects a rate (approvals change what `GET /mandi/vyapari-rates` returns before the next job run). Use a Redis `SCAN` + `DEL`; document the O(n) — acceptable at this scale.
- **Offline reads:** the 2 h refresh window 06:00–20:00 means evening reads may be stale; the API includes `lastUpdated` so the app can show the timestamp (prototype behavior).

### 3. `cache:weather:{latGrid}:{lngGrid}`
- **Value:** JSON `{ tempC, rainProbability, condition, radarAvailable, forecast[], fetchedAt }` (API shape).
- **Key shape:** coordinates rounded to a 0.25° grid, e.g. `cache:weather:20.00:74.75` — nearby users share one upstream IMD/OpenWeather call.
- **TTL:** 30 min. Miss → call provider with `httpx.AsyncClient` (5 s timeout) → set. On provider failure return the stale value if present (`GET` before refresh) with `stale: true` added.

### 4. `otp:attempts:{phone}`
- Firebase Phone Auth handles OTP generation, but `/auth/otp/verify` and `/auth/mpin/reset` still guard against replay/brute-force on the session exchange.
- **Mechanism:** `INCR` on each failed verify; first `INCR` also `EXPIRE 600`. ≥5 → `429` `RATE_LIMITED` with `Retry-After` = remaining TTL. Deleted on success.

### 5. `otp:resend:{phone}`
- Throttles resend requests: `INCR` per send, `EXPIRE 3600` on first. ≥5/h → `429`. Enforces the 30 s resend countdown server-side via a companion key `otp:cooldown:{phone}` (TTL 30 s; exists → `429` `OTP_RESEND_TOO_SOON`).

### 6. `rl:{uid}:{routeBucket}` — rate limiting
- **Algorithm:** sliding window with a sorted set. `ZADD` current ms; `ZREMRANGEBYSCORE 0 (now-60000)`; `ZCARD` = count in window; `EXPIRE 60`.
- **Buckets & limits (per minute):**
  | Bucket | Routes | Limit |
  |---|---|---|
  | `auth` | `/auth/*` | 10 |
  | `read` | all GETs | 120 |
  | `write` | POST/PUT/PATCH/DELETE | 30 |
  | `chatbot` | `/chatbot/messages` | 20 |
  | `upload` | multipart endpoints | 10 |
  | `expensive` | `/advisory/saturation`, `/advisory/disease-scan`, `/post-harvest/grade` | 5 |
- Exceeded → `429` `RATE_LIMITED` + `Retry-After` header. Implemented in `core/rate_limit.py` as a FastAPI dependency.

### 7. `chat:session:{sessionId}`
- **Value:** JSON `{ userId, language, messages: [{sender, text, at}] (last 20), farmContext: {district, crops[], landAreaAcres} }`.
- **TTL:** 24 h, **refreshed on every message** (rolling session).
- **Flow:** `POST /chatbot/messages` → read context → append user message → call OpenRouter with system prompt + context (Sarvam STT first when `audioUrl` present) → append bot reply → re-`SET` with TTL. Full history persists in Firestore `chatbot_messages`; Redis holds only the LLM context window. Miss after expiry → rebuild last 20 messages from Firestore.

### 8. `idem:{uid}:{idempotencyKey}`
- **Value:** JSON `{ status: 201, body: {...} }` — the exact response of the first execution.
- **Mechanism (in `core/idempotency.py` middleware):** `SET idem:{uid}:{key} PROCESSING NX EX 60` as a guard; if exists and value = `PROCESSING` → `409` `REQUEST_IN_FLIGHT`; if exists with a response → return it with `Idempotent-Replay: true`. After handler success, overwrite with `{status, body}` and `EXPIRE 86400`.
- **Also used by** `POST /sync` replay: each queued op carries its original key, so replays are no-ops.

### 9. `live:viewers:{channelId}`
- **Mechanism:** `INCR` on viewer join (`POST /channels/{id}/chat` poll start or WS connect), `DECR` on leave/heartbeat timeout. TTL 5 min refreshed by heartbeats so an abandoned key self-expires.
- Read on `GET /channels` (overrides the Firestore mirror `liveViewersCount`); a 5-min scheduled job mirrors values back to Firestore for cold starts.

### 10. `notify:queue`
- **Type:** Redis list, producer/consumer. `LPUSH` JSON jobs; a worker coroutine in the FastAPI app (started in `main.py` lifespan) `BRPOP`s.
- **Job shape:**
  ```json
  { "userId": "uid", "category": "booking", "title": "...", "body": "...",
    "deepLink": "tripDetail", "data": {"bookingId": "..."}, "profileType": "transport" }
  ```
- **Worker behavior:** write `notifications` Firestore doc → look up `devices` for user → FCM send → on FCM `registration-token-not-registered` delete the device doc. `LTRIM notify:queue 0 9999` after each push to bound memory. No TTL; the queue must survive restarts (use Redis AOF persistence in `infra/redis.conf`).

### 11. `refresh:{tokenId}`
- **Value:** `uid` (string). Written at login/exchange, deleted at logout/rotation. Reuse of a deleted token → `401` `TOKEN_REUSE_DETECTED` + delete all `refresh:*` for that uid (scan by a secondary index key `refresh:by-uid:{uid}` = Redis set of tokenIds, TTL 30 d).

### 12. `mpin:fail:{uid}`
- `INCR` on MPIN failure for sensitive actions; `EXPIRE 900` on first. ≥5 → `403` `MPIN_LOCKED` for the remaining window. Deleted on any successful MPIN verify.

### 13. `lock:{name}`
- Short distributed locks around multi-step writes that Firestore transactions alone can't cover cleanly:
  | Lock name | Guarded operation |
  |---|---|
  | `lock:slot:{slotId}` | equipment slot booking + waitlist promotion |
  | `lock:stock:{inventoryId}` | seller sale decrement (`INSUFFICIENT_STOCK` check + write) |
  | `lock:claim-seq:{year}` | claim-number counter increment |
- **Mechanism:** `SET lock:{name} {uuid} NX PX 30000`; release with a Lua compare-and-delete script; on contention retry 3× with 100 ms jitter, then `409` `CONCURRENT_WRITE`.

## Operational rules

1. **All keys are prefixed** (`cache:`, `otp:`, `rl:`, `chat:`, `idem:`, `live:`, `notify:`, `refresh:`, `mpin:`, `lock:`) so `SCAN` per prefix is safe in staging/prod.
2. **Never store PII beyond uid/phone-hash** in Redis. No names, Aadhaar, or message text beyond the rolling chat context (which is uid-scoped and TTL'd).
3. **Graceful degradation:** if Redis is down, reads fall through to Firestore (slower), rate limiting and idempotency fail **closed** for writes (return `503` `DEPENDENCY_UNAVAILABLE`) — never silently skip either.
4. **Dev reset:** `docker compose exec redis redis-cli FLUSHALL` is always safe; caches rebuild from Firestore/providers.
