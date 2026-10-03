# Phase 04 — Knowledge & Consumer Personas

> Ship the knowledge marketplace and the consumer buying app end-to-end: the
> learner side of "Krishi Academy" (the biggest hole in the product — the LMS
> backend is complete but no learner-facing course UI exists), a refactored
> instructor console with real credential KYC and real payouts, the e-Market
> Customer "FarmGate" app with escrow guardrails and subscriptions, Gyan Hub,
> Agri News, Live Channels (embedded licensed streams per X16), and the M20 AI
> layer (course recommendations, objective auto-grading, learning paths).
> Sources: `missing-features/robust.md` §6.8 (Instructor), §6.10 (e-Market
> Customer), §7.18 (Agri News), §7.19 (Live Channels), §7.21 (Gyan Hub), §7.24
> (launcher relevance), §7.15 (X11 coin rules), §10 (pricing); AI brief M20 +
> question set `courses.recommend.v1` (`missing-features/ai_implementation_plan.md`
> §2, §3, §5); `missing-features/ai.md` B14, C20, §5.4 (learner flow);
> `features/farm_instructorteacher.md`, `features/farm_e-market_customer.md`.

## Depends on

- **phase-00** — real money rails (`create_razorpay_order`/`verify_razorpay_signature`
  in `backend/app/services/payments.py` exist; phase-00 adds webhook, escrow,
  RazorpayX payouts, TDS 194-O), subscriptions/billing + `require_entitlement`
  (instructor Pro ₹499/mo, e-Market Business tier), KYC pipeline `kyc_cases`
  (credential matrices extend it), maker-checker + `audit_logs` for
  `platform_config` edits, and the AI gateway package
  `backend/app/services/ai/` (WS-07, brief M1).
- **phase-01** — task engine (`emit_task()` + `/v1/tasks`) and the Action Center
  deep-link pattern; every dashboard summary item below lands as tasks.

## Workstreams

| WS | Title | Source | Output (what exists when done) |
|---|---|---|---|
| WS-01 | Learner side 'Krishi Academy' | robust §6.8 item 1, §7.15 (X11); ai.md §5.4 | `website/src/lib/api/courses.ts` + `views/academy/` (new): catalog w/ filters+search, course detail (modules/reviews/credential badges), Razorpay + AgriCoins purchase, my-learning player w/ progress, certificates w/ verifiable QR surfaced in farmer profile, Q&A threads; learner dashboard tasks |
| WS-02 | Instructor console refactor | robust §6.8 items 2–5, §10; features/farm_instructorteacher.md | `InstructorHomeBoard.tsx` (855 lines, `sess_demo`) split into routed views; real earnings + payout; credential KYC per specialization (DGCA/degrees/NABARD) + re-verification; batch chat rules enforced server-side; course GMV commission 15–20% config + instructor Pro ₹499/mo entitlement |
| WS-03 | e-Market Customer 'FarmGate' | robust §6.10; features/farm_e-market_customer.md | `CustomerHomeBoard.tsx` (827 lines, 9 `??` fallbacks) split into routed views; consumer browse (near me/storefronts/freshness); guardrails: binding quotes + deposit escrow, fair-price band, anti-hoarding caps, photo inspection, WORM retention; multi-farmer cart + split shipments; favorites/subscriptions; 5% seller-side commission + Business tier |
| WS-04 | Gyan Hub | robust §7.21, §6.8 | `lib/api/gyan.ts` + `views/gyan/` (new): paid workshops (Razorpay + coins; missing enroll-verify endpoint added), expert talks (+25 coins), video library, blogs; gyanHub tile resolves; one CMS two storefronts with courses |
| WS-05 | Agri News + Live Channels | robust §7.18, §7.19, §7.24 | `lib/api/content.ts` + `views/news/`, `views/channels/` (new): news feed w/ category filters/impact rating/audio readout/WhatsApp share + breaking banner; channel grid + HLS player + schedule + reminders + moderated chat; X16 embedded licensed streams (DD Kisan etc.), platform-originated deferred |
| WS-06 | AI courses intelligence | AI brief M20; ai plan §2 `courses.recommend.v1`, §3 SDR/SGR; ai.md B14, C20 | `courses.recommend.v1` registered; per-farmer relevance on catalog load cached 24h; Gemini objective auto-grading w/ strict rubric JSON + instructor confirm to publish; learning-path suggestion after each certificate; works on `AI_PROVIDER=shim` |

## Out of scope

- Admin course moderation queue (phase-07, superadmin module 27) and news CMS
  (phase-07, module 20) — this phase builds the consumer surfaces only.
- Platform-originated live streaming infra (X16 — explicitly deferred; dated
  deferral note required per robust §13 rule 10).
- Krishi Ratna wallet/rewards-store/leaderboard UI (phase-05, §7.15) — this
  phase only consumes `coins.py` and enforces X11 caps where it awards/spends.
- Global search `GET /v1/search` (phase-05, §7.24) — this phase only guarantees
  its own tiles resolve to real pages.
- Chat hub UX, push notifications, `content.moderation.v1` AI moderation
  (phase-06, §8.1/M6/A12) — this phase enforces baseline regex moderation only.
- Voice AI (retired M27/C1/C19). Flutter apps (out of program scope).

## Exit gate (done when)

- [ ] An instructor earns on-platform: course published → farmer purchase →
  commission 15–20% accrued → real payout visible in earnings page (staging).
- [ ] A farmer earns a certificate whose QR/verification URL resolves publicly
  and the certificate is visible in the farmer's profile (skill passport).
- [ ] A household/institution buys weekly produce from named farmers via
  subscription/standing demand with escrow protection both ways (deposit +
  penalty matrix exercised in a test).
- [ ] Every tile delivered by this phase (`instructorHome`, `courses`,
  `courseDetail`, `emarketHome`, `orderTracking`, `gyanHub`, `agriNews`,
  `liveChannels`) resolves to a real page — zero "coming soon" reachable.
- [ ] en/hi complete for every new screen (locale parity; no hardcoded strings,
  no `alert()`/`prompt()`/`confirm()`).
- [ ] X11 respected: 200 coins/day earn cap enforced (expert talk +25 included),
  coin redemption ≤50%-of-order and ≤ `coinsDiscountAllowed`, coins never
  redeemable for cash.
- [ ] M20 live: recommendations render on the learner catalog (24h cache,
  fallback ordering on shim/outage), auto-grades require instructor confirm to
  publish, learning-path card appears after a certificate; `ai_decisions`
  written with cost + confidence.
- [ ] Global verification gate (execution-plan/README.md §4) green.

## Estimated effort

Weeks 8–12 of the roadmap (robust.md §11, "Phase 2C. Knowledge & consumer,
wks 8–12").
