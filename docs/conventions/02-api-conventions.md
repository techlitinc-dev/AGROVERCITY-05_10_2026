# Conventions 02 — API Conventions

Applies to every endpoint in `endpoints.md`, `endpoints.json`, and `docs/overview/03-gap-analysis-new-screens-and-endpoints.md`. Dev A implements these; Dev B's `api_client.dart` assumes them.

## 1. Base URL & Versioning

- Pattern: `<host>/v1` — e.g. dev `http://localhost:8000/v1`, prod `https://api.agrovercity.in/v1`.
- All router prefixes include the version: `APIRouter(prefix="/v1/mandi")`.
- Breaking changes require `/v2` alongside `/v1`; never change a shipped `/v1` payload shape. Additive fields are allowed.

## 2. Authentication Flow (Firebase ID token → backend JWT)

1. Client completes Firebase Phone Auth (or later biometric) and holds a **Firebase ID token**.
2. Client exchanges it: `POST /v1/auth/otp/verify` `{ phone, otp: "<firebase-id-token>", otpSessionId }` → backend verifies with Firebase Admin and returns:
   ```json
   { "accessToken": "<jwt>", "refreshToken": "<opaque>", "isNewUser": false, "user": { } }
   ```
3. **Access token:** JWT HS256, 24 h TTL, claims: `sub` (uid), `roles` (linked profile types), `activeProfile`, `iat`, `exp`.
4. **Refresh token:** opaque 48-char string, 30 d TTL, stored hashed in Redis (`refresh:{tokenId}` → `uid`, see `schema/redis-keys.md`). Rotation on every `POST /auth/refresh`: old token deleted, new pair issued; reuse of a dead token → `401` `TOKEN_REUSE_DETECTED` and all sessions revoked.
5. **MPIN** is a second factor, not a login replacement for new devices: sensitive bodies include `mpin`; backend bcrypt-compares against `users/{uid}.mpinHash`. Wrong MPIN → `403` `MPIN_INCORRECT`; 5 consecutive failures lock MPIN auth for 15 min (Redis counter).

## 3. Standard Headers

| Header | Direction | Meaning |
|---|---|---|
| `Authorization: Bearer <accessToken>` | request | all non-`public` endpoints; missing/invalid → `401` |
| `Accept-Language: hi\|mr\|gu\|pa\|te\|ta\|en` | request | response `message`/error text language; vernacular data fields are always included regardless; default `hi` |
| `Idempotency-Key: <uuid>` | request | **required on every POST/PUT/PATCH/DELETE**; missing → `400` `IDEMPOTENCY_KEY_REQUIRED` |
| `Content-Type: application/json` | request | except multipart uploads (disease scan, claim photos, vault docs) |

## 4. Idempotency

- The client generates one UUID per user intent (button tap / queued offline op) and reuses it on retries and on `/sync` replay.
- Backend middleware (`core/idempotency.py`): on write, check Redis `idem:{uid}:{key}`. Hit → return the stored status+body with header `Idempotent-Replay: true`. Miss → execute, store `{status, body}` with 24 h TTL.
- `/sync` replays queued ops `{ idempotencyKey, method, path, body, queuedAt }` in order; per-op result `{ idempotencyKey, status, body | error, replayed: bool }`; one op's failure does not abort the batch.

## 5. Pagination Envelope

All list endpoints accept `?page=1&pageSize=20` (max `pageSize` 50) and return exactly:

```json
{ "data": [ ], "page": 1, "pageSize": 20, "total": 134 }
```

No cursor variants, no extra meta keys. Single-object endpoints return the object bare (no envelope).

## 6. Error Envelope

Every 4xx/5xx response body is exactly:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable, localized by Accept-Language",
    "fieldErrors": { "fieldName": "what is wrong" }
  }
}
```

- `code`: SCREAMING_SNAKE, stable, machine-checked by clients. Never reuse a code for a different meaning. Codes used in the spec include: `OTP_INVALID`, `OTP_EXPIRED`, `MPIN_INCORRECT`, `MPIN_LOCKED`, `PROFILE_LAST_REMAINING`, `SLOT_LIMIT_REACHED` (3rd slot same day), `SLOT_FULL` (use waitlist), `CANCEL_WINDOW_PASSED` (>2 h rule), `INSUFFICIENT_COINS`, `INSUFFICIENT_STOCK`, `RATE_ALREADY_POSTED`, `PAYMENT_ALREADY_RECORDED`, `VEHICLE_HAS_BOOKINGS`, `DATES_HAVE_BOOKINGS`, `ACTIVE_OBLIGATIONS`, `PAYMENT_SIGNATURE_INVALID`, `FORBIDDEN_ROLE`, `VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMITED`, `IDEMPOTENCY_KEY_REQUIRED`, `TOKEN_REUSE_DETECTED`.
- `fieldErrors`: `{}` when not field-specific.
- `message` must be localized (hi default) — clients show it verbatim.

## 7. HTTP Status Usage

| Status | When |
|---|---|
| 200 | success with body |
| 201 | resource created (POST CRUD) |
| 204 | success, no body (DELETE, logout) |
| 400 | malformed body, missing Idempotency-Key, bad signature |
| 401 | missing/expired/invalid token |
| 403 | valid token, insufficient role or failed second factor (MPIN) |
| 404 | resource absent or not owned by caller |
| 409 | business-rule conflict (duplicate rate, last profile, active lease, limit reached) |
| 422 | valid JSON failing semantic validation (negative stock, bad date range) |
| 429 | rate limited (Redis limiter; include `Retry-After` header) |
| 500 | unexpected — logged with trace id, generic message |

## 8. Data Formats

- **Money: integer rupees.** Decision: all API and Firestore money fields are whole rupees (`int`), e.g. `ratePerQuintal: 1850`, `amount: 14000`. Sub-rupee values never occur in the domain. Razorpay's paise conversion happens only at the payment boundary (`amountPaise` in `/payments/razorpay/order` response; server multiplies by 100).
- **Dates/times: ISO-8601.** Timestamps UTC with `Z` (`2026-09-13T06:30:00Z`); date-only fields `YYYY-MM-DD`; month fields `YYYY-MM`. Firestore stores timestamps as `Timestamp`; the API serializes to the strings above.
- **Phones:** E.164 with `+91` prefix, normalized server-side.
- **Enums:** camelCase strings matching the spec (`changeDir: "up"`, `stage: "vegetative"`).
- **IDs:** server-generated `{prefix}_{random}` strings (`ord_`, `veh_`, `deal_`…) exposed to clients; Firestore document IDs are internal (see schema doc for per-collection strategy).
- **Quantities:** quintals as numbers (`double` allowed for fractional q, e.g. `12.5`); areas in acres (`double`), hectares where the 7/12 record requires it.
- **Geo:** `{ "lat": 20.0, "lng": 74.7 }` objects; query params `?lat=&lng=` as floats.

## 9. Role Enforcement

Every endpoint's `Roles` column (spec docs) maps to `Depends(require_roles("farmer", "seller"))` in its router. `all` = any authenticated user; `public` = no auth. The server check duplicates the client navigation guard — the client matrix (`overview/04-persona-screen-matrix.md` §2) and the server ACL must never diverge.
