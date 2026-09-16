# 05 — Missing Features Traceability (missing.md audit)

> Tracks every item from the second gap audit (`missing.md`, repo root) to its spec and its day in the 15-day plan.
>
> - **Status** is as reported by missing.md: ❌ not specced anywhere (before this doc set was extended), 🟡 mock-only in the prototype.
> - **Specced in** points into `overview/03-gap-analysis-new-screens-and-endpoints.md` (Parts C/D), `schema/firestore-collections.md`, or this file's notes.
> - **Scheduled in** is a `days/day-NN.md` file or "deferred (v1.x)".
> - Day files absorb these items in an **"Additional tasks (from missing.md)"** section appended to that day's file; the original day scope is unchanged.

## Summary

- **16 P0 launch blockers** — all scheduled within days 1–15 (see table; shared items like L6/S8 ride on F16, L1/S1/B1 ride on X1/A1).
- **P1** — scheduled where the parent module is built (days 5–14) or explicitly deferred to v1.x; every P1 is at least fully specced in overview/03 Parts C–D so it can be pulled into a hardening sprint without redesign.
- **P2** — all deferred (out of the 15-day scope); compact specs in overview/03 §C.9.
- Day scope grew: days 5–14 each carry an "Additional tasks (from missing.md)" section; P2 items are **not** part of the 15-day plan.

## Traceability table

| ID | Feature | Pri | Status | Specced in | Scheduled in |
|---|---|---|---|---|---|
| F1 | Referral-code entry at registration | P0 | ❌ | 03 §C.1 (screen 23), §D.1 | day-03 |
| F2 | Session-expired MPIN re-entry | P0 | 🟡 | 03 §C.1 (24), §D.1 | day-03 |
| F3 | Global search results | P1 | ❌ | 03 §C.1 (25), §D.1 | deferred (v1.x) |
| F4 | Weather detail / 7-day forecast | P1 | ❌ | 03 §C.1 (26), §D.1 | deferred (v1.x) |
| F5 | Task engine ("Today's Action") | P1 | 🟡 | 03 §C.1 (27), §D.1; schema `farm_tasks` | deferred (v1.x) |
| F6 | Sowing-intent capture | P0 | 🟡 | 03 §C.1 (28), §D.1 | day-14 |
| F7 | Sell-produce listing (`produce_lots`) | P0 | ❌ | 03 §C.1 (29), §D.1; schema `produce_lots` | day-05 |
| F8 | Crop-stage calendar | P1 | ❌ | 03 §C.10 note — merges into F5 task engine | deferred (v1.x, folds into F5) |
| F9 | Soil-test booking | P1 | ❌ | 03 §C.1 (30), §D.1; schema `soil_tests` | day-10 |
| F10 | Disease-scan history | P2 | 🟡 | 03 §C.9 | deferred (v1.x) |
| F11 | Cold-storage booking | P1 | ❌ | 03 §C.1 (31), §D.1; schema `cold_storage_bookings` | day-14 |
| F12 | Produce pickup linked to transport (`lotId`) | P1 | ❌ | 03 §D.3; schema `transport_bookings.lotId` | day-07 |
| F13 | Mandi price history / charts | P1 | ❌ | 03 §C.1 (32), §D.1 | day-05 |
| F14 | MSP reference data | P2 | 🟡 | 03 §C.9 | deferred (v1.x) |
| F15 | Claim appeal / resubmission | P1 | ❌ | 03 §C.1 (33), §D.1 | day-11 |
| F16 | Bank accounts + penny-drop verify | P0 | ❌ | 03 §C.1 (34), §D.1; schema `bank_accounts` | day-09 |
| F17 | Loan application tracking | P1 | ❌ | 03 §C.1 (35), §D.1 | day-09 |
| F18 | Diary receipt attachments | P2 | ❌ | 03 §C.9 | deferred (v1.x) |
| F19 | FPO discover / join-request | P1 | ❌ | 03 §C.1 (36), §D.1 | deferred (v1.x) |
| F20 | Expert handoff thread | P1 | ❌ | 03 §C.1 (37), §D.1; schema `support_threads` | day-13 |
| F21 | Profile edit screen | P0 | ❌ | 03 §C.1 (38) | day-03 |
| F22 | Multi-device session management | P2 | ❌ | 03 §C.9, §D.1 (compact) | deferred (v1.x) |
| F23 | Data export (DSR) | P2 | ❌ | 03 §C.9, §D.1 (compact) | deferred (v1.x) |
| L1 | Landlord registration variant (7/12 capture) | P0 | ❌ | 03 §C.10 (with X1) | day-03 (with X1) |
| L2 | Land listing marketplace | P1 | ❌ | 03 §C.2 (39–40), §D.2; schema `land_listings` | day-09 |
| L3 | Lease-request inbox → accept creates lease | P1 | ❌ | 03 §C.2 (41), §D.2; schema `lease_requests` | day-09 |
| L4 | Lease agreement PDF + e-sign | P1 | ❌ | 03 §C.2 (42), §D.2 | day-09 |
| L5 | Rent reminder & overdue push | P1 | ❌ | 03 §C.2 (43), §D.2; schema jobs | day-10 |
| L6 | Landlord payout account | P0 | ❌ | shared with F16 | day-09 (shared with F16) |
| T1 | Transporter KYC (licence/RC/GST) | P0 | ❌ | 03 §C.10 + §C.8 (A1 queue) | day-07 |
| T2 | Booking accept/reject inbox | P0 | ❌ | 03 §C.3 (44), §D.3 | day-07 |
| T3 | Proof of delivery (POD) | P1 | ❌ | 03 §C.3 (45), §D.3 | day-07 |
| T4 | Live trip tracking | P2 | ❌ | 03 §C.9 | deferred (v1.x) |
| T5 | Transporter settlements page | P0 | ❌ | 03 §C.3 (46), §D.3; schema `settlements` | day-09 |
| T6 | Trip expense log | P2 | ❌ | 03 §C.9 | deferred (v1.x) |
| T7 | Vehicle doc-expiry reminders | P1 | ❌ | 03 §C.3 (47), §D.3; schema `vehicles.docStatus` | day-07 |
| T8 | Return-load board | P2 | ❌ | 03 §C.9 | deferred (v1.x) |
| T9 | Driver management | P2 | ❌ | 03 §C.9 | deferred (v1.x) |
| S1 | Seller shop KYC (APMC/GST) | P0 | ❌ | 03 §C.10 (with X1) + §C.8 (A1 queue) | day-03 (with X1); verify day-14 (A1) |
| S2 | Rate sanity-band validation | P1 | ❌ | 03 §C.4 (48), §D.4 | day-05 |
| S3 | Procurement entry + weighbridge slip | P1 | ❌ | 03 §C.4 (49), §D.4; schema `seller_procurements` | deferred (v1.x) |
| S4 | Pay-farmer tracking (paymentStatus) | P1 | ❌ | 03 §C.4 (50), §D.4 | deferred (v1.x) |
| S5 | Buyer network / B2B orders | P2 | ❌ | 03 §C.9 | deferred (v1.x) |
| S6 | GST invoice generation | P2 | ❌ | 03 §C.9 | deferred (v1.x) |
| S7 | Buyer udhaar ledger | P1 | ❌ | 03 §C.4 (51), §D.4; schema `buyer_ledgers` | deferred (v1.x) |
| S8 | Seller payout account | P0 | ❌ | shared with F16 | deferred (v1.x, shared with F16 day-09) |
| E1 | Machine KYC | P0 | ❌ | 03 §C.10 + §C.8 (A1 queue) | day-08 |
| E2 | Equipment booking approve/reject | P0 | ❌ | 03 §C.5 (52), §D.5 | day-08 |
| E3 | Maintenance log + service reminders | P1 | ❌ | 03 §C.5 (53), §D.5; schema `equipment_maintenance` | day-09 |
| E4 | Machine live location | P2 | ❌ | 03 §C.9 | deferred (v1.x) |
| E5 | Damage report flow | P2 | ❌ | 03 §C.9 | deferred (v1.x) |
| E6 | Equipment-owner settlement page | P0 | ❌ | shared settlement pattern (T5/X10) | day-09 |
| E7 | Machinery loan / EMI tracker | P2 | 🟡 | 03 §C.9 | deferred (v1.x) |
| B1 | Broker KYC / verification badge | P0 | ❌ | 03 §C.10 (with X1) + §C.8 (A1 queue) | day-03 (with X1); verify day-14 (A1) |
| B2 | Deal room / deal chat | P1 | ❌ | 03 §C.6 (54), §D.6; schema `chats` | deferred (v1.x) |
| B3 | Buyer requirement postings | P1 | ❌ | 03 §C.6 (55), §D.6; schema `buyer_requirements` | deferred (v1.x) |
| B4 | Deal documents | P1 | ❌ | 03 §C.6 (56), §D.6 | deferred (v1.x) |
| B5 | Counter-offer / negotiation | P2 | ❌ | 03 §C.9 | deferred (v1.x) |
| B6 | Broker commission payout | P0 | ❌ | shared settlement pattern (X10) | day-09 |
| B7 | Broker commission on payments (Razorpay split) | P2 | ❌ | 03 §C.9 | deferred (v1.x) |
| X1 | Per-persona registration step-3 | P0 | ❌ | 03 §C.10 (`role_profiles`) | day-03 |
| X2 | In-app 1:1 chat | P1 | ❌ | 03 §C.7 (57), §D.7; schema `chats` + `messages` | day-14 (stretch) |
| X3 | Notification deep-link map | P0 | 🟡 | 03 §D.7 (full type→route→payload table) | day-13 |
| X4 | SMS fallbacks | P1 | 🟡 | 03 §C.10 | day-13 (provider stub) |
| X5 | Order cancel / Razorpay refund | P0 | ❌ | 03 §C.7 (58), §D.7 | day-06 |
| X6 | Delivery address book | P1 | ❌ | 03 §C.7 (59), §D.7; schema `addresses` | day-06 |
| X7 | Product reviews submission | P2 | ❌ | 03 §C.7 (60), §D.7; schema `reviews` | day-12 |
| X8 | Service ratings | P1 | ❌ | 03 §C.7 (61), §D.7; schema `ratings` | day-12 |
| X9 | Report / block users | P0 (with X2) | ❌ | 03 §C.7 (62), §D.7; schema `reports`, `blocks`; A6 | day-14 |
| X10 | Platform settlement engine | P0 | ❌ | 03 §D.7 (collections + jobs + status flow); schema `settlements` | day-09 |
| X11 | AgriCoins abuse guards | P1 | ❌ | 03 §C.10 rules note + §D.7 (`coinCaps`) | day-13 (rules note only); reconcile job deferred (v1.x) |
| X12 | Force-update / app-config | P0 | ❌ | 03 §C.7 (64), §D.7; schema `app_config` | day-01 (endpoint), day-02 (splash gate client) |
| X13 | Analytics events taxonomy | P1 | ❌ | 03 §C.10 | day-15 |
| X14 | Crash/error reporting (Crashlytics + Sentry) | P0 | ❌ | 03 §C.10 | day-01 |
| X15 | Content localization pipeline | P1 | ❌ | 03 §C.10 | deferred (v1.x) |
| X16 | Live-channel streaming infra | P2 | 🟡 | 03 §C.9 | deferred (v1.x) |
| X17 | Consent & privacy center | P0 | ❌ | 03 §C.7 (63), §D.7; schema `consent_log` | day-10 |
| X18 | Static legal pages (`/legal/*`) | P0 | ❌ | 03 §C.10 | day-14 |
| X19 | Sync conflict policy matrix | P0 | 🟡 | 03 §D.7 (per-collection matrix) | day-14 |
| X20 | Offline form drafts | P2 | ❌ | 03 §C.9 | deferred (v1.x) |
| X21 | Real STT/TTS (Sarvam/Bhashini) | P1 | 🟡 | 03 §D.7 (audio format, limits, shapes) | day-13 |
| X22 | Language-select audio assets | P2 | ❌ | 03 §C.9 | deferred (v1.x) |
| A1 | KYC verification queue | P0 | ❌ | 03 §C.8 (65), §D.8 | day-14 |
| A2 | Surveyor roster & assignment console | P1 | ❌ | 03 §C.9; schema `surveyors` | deferred (v1.x, real roster) |
| A3 | Scheme & deadline editor | P1 | ❌ | 03 §C.8 (66) | day-14 |
| A4 | Broadcast notifications | P1 | ❌ | 03 §C.8 (67), §D.8 | day-14 |
| A5 | Settlement & payout console | P0 | ❌ | 03 §C.8 (68), §D.8 | day-14 |
| A6 | Moderation queue | P0 (with X2) | ❌ | 03 §C.8 (69), §D.8 | day-14 |
| A7 | Feature flags / app-config editor | P1 | ❌ | 03 §C.9; schema `app_config.changeHistory` | deferred (v1.x) |
| A8 | FPO verification & management | P1 | ❌ | 03 §C.9 | deferred (v1.x) |
| A9 | Dealer/product onboarding console | P1 | ❌ | 03 §C.9 | deferred (v1.x) |
| A10 | Analytics dashboards | P2 | ❌ | 03 §C.9 | deferred (v1.x) |

## Notes

- **Shared P0 items:** L6 and S8 are the F16 bank-account work (one implementation, all money personas); L1/S1/B1 KYC capture fields land with X1 on day-03 and their verification with A1 on day-14.
- **F8** is intentionally not a separate build item: the crop-stage schedule is generated from `crop_cycles` and materializes through the F5 task engine; a calendar visualization merges into `farmTasks` in v1.x.
- **X4** ships as a provider stub on day-13 (service logs only) until MSG91 DLT template registration completes; real sending is a config flip.
- **X11** day-13 delivers the rules note + `coinCaps` config in `app_config`; the nightly `coins_reconcile` job is deferred to v1.x.
- **X12** spans two days deliberately: backend endpoint + `app_config` doc on day-01, client splash gate on day-02.
- P2 rows have compact specs only (03 §C.9) and are outside the 15-day scope; pulling one in requires promoting it to a day file's "Additional tasks" section first.
