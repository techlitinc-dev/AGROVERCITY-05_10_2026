# Extra / Unnecessary API Endpoints

Audit of the FastAPI backend (`backend/app`) against the two live frontends (`website/` and `superadmin/`, per `run.sh`). **1,714** route definitions were extracted from 132 routers and cross-referenced against every HTTP call site in both frontends (literal paths and dynamic `` `/path/${id}/...` `` templates), with every borderline case verified by hand. **1,572 endpoints have a real frontend caller; 142 do not.**

After excluding endpoints that are operational by design (cron, webhooks, provider callbacks, intentional 410 stubs), **105 endpoints remain as removal candidates**: 75 have no caller anywhere (not even tests), and 30 are exercised only by backend/e2e/playwright tests — i.e. no real user flow reaches them.

---

## 1. Extra endpoints — no caller anywhere (75)

| Method | Endpoint | Router file | Note |
|---|---|---|---|
| POST | `/admin/broadcasts` | `admin.py` | frontend calls POST /admin/broadcast (singular); plural alias has no caller |
| GET | `/admin/flagged-rates` | `admin.py` |  |
| GET | `/admin/fpos` | `admin_console.py` | only GET /admin/fpos/{id}/pools is called; list endpoint has no caller |
| POST | `/admin/fpos/{fpo_id}/reject` | `admin_console.py` |  |
| POST | `/admin/fpos/{fpo_id}/verify` | `admin_console.py` |  |
| GET | `/admin/climate/carbon-audit` | `admin_sop_economy.py` |  |
| PUT | `/admin/farmer-modules/ads/{ad_id}/status` | `admin_sop_farmers.py` |  |
| PUT | `/admin/farmer-modules/courses/{course_id}` | `admin_sop_farmers.py` |  |
| POST | `/admin/farmer-modules/media/publish` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/ads/activity` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/ai-analytics/decisions` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/ai-analytics/telemetry` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/ai-scanner/scans` | `admin_sop_farmers.py` |  |
| PUT | `/admin/farmers/{user_id}/ai-scanner/scans/{scan_id}/review` | `admin_sop_farmers.py` |  |
| POST | `/admin/farmers/{user_id}/coins/adjust` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/coins/history` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/common-features-360` | `admin_sop_farmers.py` |  |
| DELETE | `/admin/farmers/{user_id}/diary/{entry_id}` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/learning/activities` | `admin_sop_farmers.py` |  |
| POST | `/admin/farmers/{user_id}/learning/enrollments` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/learning/overview` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/mall/activity` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/mall/orders` | `admin_sop_farmers.py` |  |
| POST | `/admin/farmers/{user_id}/mall/orders/{order_id}/override` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/mandi/activity` | `admin_sop_farmers.py` |  |
| DELETE | `/admin/farmers/{user_id}/media/comments/{comment_id}` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/media/engagement` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/payments/ledger` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/pnl/entries` | `admin_sop_farmers.py` |  |
| PATCH | `/admin/farmers/{user_id}/pnl/entries/{entry_id}` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/pnl/summary` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/ratings` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/referrals` | `admin_sop_farmers.py` |  |
| POST | `/admin/farmers/{user_id}/referrals/{referral_id}/moderate` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/schemes` | `admin_sop_farmers.py` |  |
| POST | `/admin/farmers/{user_id}/schemes/{scheme_id}/assist` | `admin_sop_farmers.py` |  |
| GET | `/admin/farmers/{user_id}/trees` | `admin_sop_farmers.py` |  |
| PUT | `/admin/farmers/{user_id}/trees/{tree_id}/verify` | `admin_sop_farmers.py` |  |
| PUT | `/admin/farmers/{user_id}/vault/documents/{doc_id}/status` | `admin_sop_farmers.py` |  |
| PUT | `/admin/water/canal-schedule` | `admin_sop_finance.py` |  |
| GET | `/admin/transport/bookings/{booking_id}/route` | `admin_sop_logistics.py` |  |
| POST | `/threads` | `admin_sop_platform.py` | no caller in website or superadmin |
| PUT | `/admin/auth/users/{uid}/status` | `admin_sop_users.py` |  |
| GET | `/admin/users/{user_id}/audit-trail` | `admin_sop_users.py` |  |
| DELETE | `/admin/users/{user_id}/content/{entity_type}/{entity_id}` | `admin_sop_users.py` |  |
| GET | `/admin/users/{user_id}/export` | `admin_sop_users.py` | frontend uses the bulk GET /admin/users/export instead |
| POST | `/admin/users/{user_id}/impersonate` | `admin_sop_users.py` |  |
| GET | `/admin/users/{user_id}/logins` | `admin_sop_users.py` |  |
| POST | `/admin/users/{user_id}/personas/assign` | `admin_sop_users.py` |  |
| PATCH | `/admin/users/{user_id}/profile` | `admin_sop_users.py` |  |
| GET | `/admin/users/{user_id}/sessions` | `admin_sop_users.py` |  |
| POST | `/admin/users/{user_id}/sessions/revoke` | `admin_sop_users.py` |  |
| POST | `/admin/users/{user_id}/wallet/adjust` | `admin_sop_users.py` |  |
| GET | `/advisory/articles` | `advisory.py` | only the admin variant GET /admin/advisory/articles is called |
| GET | `/advisory/pest-radar` | `advisory.py` |  |
| POST | `/agent/rules/{rule_id}/pause` | `agent_rules.py` |  |
| POST | `/auth/biometric` | `auth.py` |  |
| POST | `/auth/biometric/register` | `auth.py` |  |
| POST | `/dairy-manager/collections/qr` | `dairy_manager.py` | frontend only has qr/scan; nothing issues a QR token |
| GET | `/equipment/bookings/{booking_id}/contract/pdf` | `equipment_rental.py` |  |
| POST | `/equipment/bookings/{booking_id}/deposit/forfeit` | `equipment_rental.py` |  |
| POST | `/equipment/bookings/{booking_id}/refund` | `equipment_rental.py` |  |
| GET | `/kyc/sessions/{session_id}/documents` | `kyc.py` |  |
| POST | `/land/listings/{listing_id}/verify-documents` | `land.py` |  |
| POST | `/land/listings/{listing_id}/view` | `land_ops.py` |  |
| GET | `/nurseries` | `livestock.py` | stray route on the livestock router; no caller |
| POST | `/orders/{order_id}/pay` | `orders.py` |  |
| GET | `/orders/{order_id}/payment-status` | `orders.py` |  |
| POST | `/payments/{payment_id}/refund` | `payments.py` |  |
| POST | `/customer/product-alerts` | `product_alerts.py` | subscribeProductAlert() exists in lib but is never imported by any view |
| GET | `/referrals/summary` | `referrals.py` |  |
| POST | `/resale-listings/{listing_id}/book` | `resale.py` |  |
| GET | `/soil-tests` | `soil_tests.py` | no frontend list caller (admin soil-test console uses /admin/advisory/soil-tests) |
| GET | `/specs` | `specs.py` | crop-spec CRUD has no UI |
| POST | `/specs` | `specs.py` | crop-spec CRUD has no UI |

## 2. Extra endpoints — used only by tests/sim (30)

No frontend flow reaches these. They are kept alive only by test suites (backend pytest, e2e, playwright, sim). If the feature is not planned, remove endpoint + tests together.

| Method | Endpoint | Router file | Test suites |
|---|---|---|---|
| POST | `/admin/farmer-modules/mandi/rates/override` | `admin_sop_farmers.py` | backend/e2e/playwright/sim |
| GET | `/admin/farmer-modules/overview` | `admin_sop_farmers.py` | backend/e2e/playwright/sim |
| POST | `/agent/rules` | `agent_rules.py` | backend/e2e/playwright/sim |
| GET | `/agent/rules` | `agent_rules.py` | backend/e2e/playwright/sim |
| POST | `/agent/rules/parse` | `agent_rules.py` | backend/e2e/playwright/sim |
| DELETE | `/agent/rules/{rule_id}` | `agent_rules.py` | backend/e2e/playwright/sim |
| POST | `/ai-power/advisory/spray-window` | `ai_power.py` | backend/e2e/playwright/sim |
| POST | `/ai-power/trade/offer-score` | `ai_power.py` | backend/e2e/playwright/sim |
| GET | `/admin/app-config/veggie-box` | `app_config.py` | backend/e2e/playwright/sim |
| PUT | `/admin/app-config/veggie-box` | `app_config.py` | backend/e2e/playwright/sim |
| POST | `/auth/quick-login` | `auth.py` | backend/e2e/playwright/sim |
| GET | `/instructor/settlements` | `courses.py` | backend/e2e/playwright/sim |
| GET | `/equipment-rental/monitoring/bookings` | `equipment_rental.py` | backend/e2e/playwright/sim |
| GET | `/equipment-rental/policies` | `equipment_rental.py` | backend/e2e/playwright/sim |
| GET | `/equipment-rental/reminders` | `equipment_rental.py` | backend/e2e/playwright/sim |
| POST | `/equipment-rental/reports` | `equipment_rental.py` | backend/e2e/playwright/sim |
| GET | `/equipment-rental/reports` | `equipment_rental.py` | backend/e2e/playwright/sim |
| GET | `/equipment-rental/risk/farmers` | `equipment_rental.py` | backend/e2e/playwright/sim |
| POST | `/geo/geocode` | `geo.py` | backend/e2e/playwright/sim |
| GET | `/geo/places/autocomplete` | `geo.py` | backend/e2e/playwright/sim |
| GET | `/geo/places/{place_id}` | `geo.py` | backend/e2e/playwright/sim |
| POST | `/geo/route` | `geo.py` | backend/e2e/playwright/sim |
| GET | `/mandi/analytics/movers` | `mandi.py` | backend/e2e/playwright/sim |
| POST | `/soil-tests/book` | `soil_tests.py` | backend/e2e/playwright/sim |
| GET | `/teachers/payments/history` | `teachers.py` | backend/e2e/playwright/sim |
| GET | `/transport/ledger/mine` | `transport.py` | backend/e2e/playwright/sim |
| POST | `/my-products` | `user_products.py` | backend/e2e/playwright/sim |
| GET | `/my-products` | `user_products.py` | backend/e2e/playwright/sim |
| PUT | `/my-products/{product_id}` | `user_products.py` | backend/e2e/playwright/sim |
| DELETE | `/my-products/{product_id}` | `user_products.py` | backend/e2e/playwright/sim |

## 3. Kept by design — NOT extra (do not delete blindly)

| Method | Endpoint | Router file | Why it stays |
|---|---|---|---|
| GET | `/debug/sentry-test` | `backend/app/main.py` | dev-only, already env-gated |
| POST | `/courses/purchases/verify` | `courses.py` | intentional 410 stub (online checkout removed) |
| POST | `/courses/{course_id}/purchase` | `courses.py` | intentional 410 stub |
| GET | `/health` | `health.py` | ops |
| POST | `/jobs/admin-briefing/run` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/ai-calibration/backfill` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/ai-calibration/run` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/ai-decisions/export` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/ai-golden/run` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/broker/offers/expire` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/churn/score` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/customer-escrow/release-due` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/dairy/adulteration/route-summary` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/demands/standing/run` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/district-crops/propose` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/escrow/release-due` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/fraud_scan` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/gateway-health/run` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/kyc/expiry-reminders` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/kyc/reverify-expired-instructor-licences` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/notifications_digest/run` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/payments/reconcile` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/pickup/reminders` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/rent-reminders/run` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/saved-search-alerts` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/search_reindex` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/settlements/payouts` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/settlements/run` | `jobs.py` | cron |
| POST | `/jobs/subscriptions/planner/run` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| POST | `/jobs/women/reminders` | `jobs.py` | cron endpoint — hit by external scheduler, not the UI |
| GET | `/kyc/sessions/oauth/callback` | `kyc.py` | KYC-provider OAuth callback |
| GET | `/partner/advisory/saturation` | `partner_api.py` | external partner API (by design) |
| GET | `/partner/mandi/prices` | `partner_api.py` | external partner API (by design) |
| POST | `/payments/webhook` | `payments.py` | payment-gateway callback, not a UI caller |
| GET | `/customer/product-alerts` | `product_alerts.py` | used by SavedPage via const BASE |
| DELETE | `/customer/product-alerts/{product_id}` | `product_alerts.py` | used by SavedPage via const BASE |
| POST | `/sync` | `sync.py` | offline sync-replay API, reserved for a mobile client (none in this repo) — confirm before removing |

## 4. Structural duplication (whole-router, not per-endpoint)

- **Double-mounted superadmin routers** — `admin_sop_users` (27 routes) and `admin_sop_farmers` (77 routes incl. farmer-modules) are each mounted **twice**: at `/v1/admin/...` and at `/api/v1/admin/...`. Every one of these 104 handlers is served at two URLs. Drop the `/api/v1` mount (nothing in either frontend uses the `/api` prefix; both apps base on `/v1`).
- **Duplicate route handlers** (same method+path registered in two files, first one wins):
  - `GET /admin/users` — defined in both `admin.py` and `admin_sop_users.py`
  - `GET /admin/nurseries` — defined in both `admin_console.py` and `nursery.py`
- **Legacy SOP router** — `admin_sop_users.legacy_sop_router` (prefix `/admin`) is still mounted alongside the new SOP console; its routes overlap the SOP surface.
- **Near-duplicate alias** — `POST /admin/broadcast` (used) vs `POST /admin/broadcasts` (unused, listed above).

## 5. Methodology & caveats

- Live system per `run.sh`: backend + `website/` + `superadmin/`. The Flutter prototype under `backup/` and the `sim/` harness were NOT counted as live callers (sim/e2e usage is what the *test-only* flag above means).
- Frontend calls were matched segment-by-segment, treating `${...}` template slots and backend `{param}` segments as wildcards. Hand-verified: variable-based paths (`const BASE` in `productAlerts.ts`), `window.open('/v1/...')` downloads, and `${action}`-style dynamic leaf segments.
- Usage is a static-code snapshot: an endpoint with zero callers here may still be invoked manually, from scripts, or by a future mobile client (e.g. `POST /sync`). Confirm against server logs / Firestore usage telemetry before deleting in production.
