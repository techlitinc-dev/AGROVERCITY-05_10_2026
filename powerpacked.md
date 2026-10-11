# AGROVERCITY — Powerpacked Roadmap

*How we take AGROVERCITY ("Kisan Setu") from **feature-complete** to **jaw-dropping**. Last updated: 2026-10-09.*

---

## 1. The North Star

AGROVERCITY already ships an unusually deep product: 14 personas, 24 modules, 1,416 passing backend tests, a 211-endpoint API, a PWA, a Flutter app, an admin console, and an AI gateway. The gap between *feature-complete* and *powerpacked* is not more screens — it is:

1. **Proof** — real money rails proven on staging, human-verified flows, secrets cleaned up.
2. **Polish** — a design system, motion, dark mode, offline superpowers, vernacular depth.
3. **Power** — the 7 deferred AI features, live integrations (WhatsApp, DLT SMS, land records), and the spec leftovers that make each persona feel *finished*.

A powerpacked app is one where a farmer in Marathwada on a ₹7,000 phone with 2G signal gets the same feeling a banker gets from a Bloomberg terminal: *fast, trustworthy, and made for me.*

---

## 2. Where We Are (verified 2026-10-08)

- **Code**: 9-phase execution plan complete — all 14 personas, all 24 modules shipped (`docs/deferral-ledger.md`). Backend **1416/1416 tests green**, website `tsc` + build clean, en/hi locale parity (5,301 keys), load tests at ~200 rps with 0 failures, first-load JS down to **262 KB** (from 1.4 MB).
- **AI**: Gateway shipped (Jev via OpenRouter + Gemini direct, calibration, budgets, golden sets). 40+ AI capabilities live; **7 deferred post-beta** (see §3.2).
- **Money**: Razorpay orders/webhooks/refunds/reconciliation built; escrow, payouts, TDS 194-O ledger, GST invoicing, per-persona SaaS tiers built — **all proven only with dev stubs, not real keys**.

The remaining work is listed below with source-of-truth references. Nothing here is invented; everything traces to `docs/deferral-ledger.md`, `execution_plan_summary.md`, `docs/launch-checklist.md`, or the persona plans.

---

## 3. Missing Features — the Open Frontier

### 3.1 Prove-the-money & launch blockers (highest priority)

These block any honest public launch. Source: `execution_plan_summary.md`, `docs/launch-checklist.md`.

- [ ] **Real-key Razorpay staging run** — settlement run, TDS 194-O ledger, GST invoices, tier upgrade→pay→unlock for every business persona, B2B partner-key proof
- [ ] **~45 human browser/e2e checks** + hi/mr language walkthroughs (automation can't sign off trust flows)
- [ ] **`firebase deploy --only firestore:indexes`** (operator credentials)
- [ ] **Secrets rotation + scrub** — verified 2026-10-09: the service-account JSON at repo root has **never been committed** (git history clean, file is gitignored) and `dist/`/`node_modules/` are **not tracked**; gitleaks history-scan gate added to CI (`.gitleaks.toml`). **Remaining (operator): rotate the key anyway** (it has existed on disk outside the repo lineage) + OpenRouter spend caps.
- [ ] **DPDP audit signature** + production-ready-beta checklist sign-off
- [ ] **Demo cut** — a 3-minute product video for investors/users

### 3.2 Deferred AI features (post-beta wave)

Source: `docs/deferral-ledger.md` (deferred 2026-10-08).

- [x] **A5 — Offer-quality scoring** (procurement: grade offers before farmers see them) — SHIPPED 2026-10-09: `trade.offer_score.v1`, `services/offer_score.py`, `POST /v1/ai-power/trade/offer-score`
- [ ] **B5 — Marketplace product recommendations** (the "Amazon moment" for agri inputs)
- [x] **B17 — Weather spray-window classifier** (disease/pest advisory that says *"spray in the next 36h"*) — SHIPPED 2026-10-09: `weather.spray_window.v1`, `services/spray_window.py`, `POST /v1/ai-power/advisory/spray-window`
- [ ] **C9 — Yield estimation** (photo/satellite-based, powers P&L forecasts)
- [ ] **C10 — Smart matchmaking** (demand ↔ supply ↔ transport, the true marketplace flywheel)
- [x] **C4 — Demand forecast** (vyapari/dairy buying signals) — SHIPPED 2026-10-09: `demand.forecast.v1`, `services/demand_forecast.py`, `POST /v1/ai-power/demand/forecast`
- [ ] **C18 — WhatsApp companion bot** (blocked on DLT/template approval — see §3.3)
- [ ] **Voice AI conflict to resolve**: `missing.md` X21/X22 list real STT/TTS + audio assets as P1/P2, but C1/C19/M27 voice AI was *retired* in the ledger. For a low-literacy-first user base this deserves a formal re-evaluation (Sarvam STT / Bhashini TTS were spec'd once). Decide: retire permanently and close X21/X22, or build voice as a marquee low-literacy feature.

### 3.3 Live integrations (stub → real)

- [ ] **DLT SMS registration** — `services/sms.py` stub is the shipping default; register MSG91/Twilio DLT templates so OTPs and alerts actually reach non-smartphone users
- [ ] **Mahabhulekh / e-District land-records adapter** — currently a stub gateway with "unverified" labels; a real 7/12 fetch is a farmer-trust superpower
- [ ] **WhatsApp Business API** companion bot (post-DLT)
- [ ] **GST e-invoice IRN generation** + **Tally-compatible export & GST reports** (`website/missing_all_features.md` G10 — not in the deferral ledger; CSV/PDF export exists, Tally does not)
- [ ] **BNPL partner** for input purchases (farmer financing; deferred)
- [ ] **Carbon MRV partner** (deferred; needed to make the climate/carbon module real)
- [ ] **Weigh-slip scan reuse** — service exists, hook not wired into vyapari procurement + transporter trips

### 3.4 Persona spec leftovers (finish the stories)

Features described in `features/*.md` / `plan/*.md` that never made a phase:

- **Transporter**: driver sub-accounts (T14), fuel estimator (T13), surge pricing, multi-drop trips (F15), load templates/recurring bookings (F12), fare-trend calendar (F14), **OTP-verified POD with farmer countersign**, bid counter-offers, transporter discovery directory (F5), cancellation penalty/strike engine
- **Seller/Vyapari**: team accounts (V10), buyer credit limits (V13), no-show/cancellation fees, live GPS distance sort (currently client-side haversine only), probation tier (3 concurrent bookings, ₹50k escrow cap — `features/Vyapari.md:141`)
- **Direct buyer**: route planner, delivery-agent sub-accounts, offline QR handover, demand auto-expiry, buyer-side KYC doc pipeline, **FPO as a real entity model** (`fpoId` is just a doc field)
- **Broker**: **Socket.IO realtime chat** (v1 is REST polling), multi-hop/deal-circle detection
- **Dairy**: QR collection with escrow release on farmer OTP (the spec'd trust moment)
- **Instructor**: public **verifiable certificate registry** (C13) — certificates anyone can validate
- **Landlord**: state-specific lease templates + 7-year audit retention
- **Chat**: images, read receipts, WebSocket upgrade (all personas feel this daily)

### 3.5 Platform tech debt (professionalism)

- [x] **Task 4.12** — 14 routers call `services/ai/gateway.py` directly instead of service wrappers (content, seller, mandi, support, land, contracts, broker, post_harvest, vault, chat, equipment_owner, livestock_dairy, insurance_claims, advisory, search) — DONE 2026-10-09: 25 call sites moved into service modules (`support_ai`, `land_ai`, `broker_ai`, `kyc_ai`, `equipment_ai`, `dairy_ai`, `seller_ai`, `contracts_ai` + extensions to `chat_moderation`, `mandi_smart`, `claims`, `advisory`, `search_index`, `agent_rules`, `grading_model`); zero gateway imports remain in any router
- [ ] **`APP_ENV=prod` test profile** — the prod-config suite fails broadly (App Check + prod MPIN rules vs dev fixtures); CI can't gate prod
- [x] **AI cost accounting bug** — `costUsd` values are placeholders with a documented **10× discrepancy** vs live rates (`docs/test-reports/phase-08-ai-spend-review.md`); set OpenRouter account-level spend caps — FIXED 2026-10-09: realistic per-1M rates (`jev 0.042 / gemini 0.30 / gemini_lite 0.10` USD) wired through `core/config.py`, env-overridable (`AI_COST_*_PER_1M`); OpenRouter caps remain an operator action
- [x] **2 flaky tests** + Gemini provider-retention flag unverified on live — fixed 2026-10-09: `test_geo_haversine_and_freshness` (hardcoded date → today-relative) and `test_no_unmasked_aadhaar_anywhere` (whole-store scan → scoped to docs the test creates); provider-retention flag still unverified on live (human check)
- [ ] **Offline sync conflict policy + offline drafts** (`missing.md` X19/X20 — P0/P2, never landed in the ledger)
- [x] **Website has zero unit tests and no web CI** — gates are only `tsc`/`build`/`locales:check` — DONE 2026-10-09: vitest + 13 unit tests (`uuid`, `csv`, `offline/outbox`), CI runs `pnpm test` + a bundle-size gate (entry JS 261 KiB gzip, budget 300 KiB) + gitleaks secrets scan
- [ ] **i18n depth**: 30 locales registered, only en/hi complete; **Marathi (mr) is the next must-have** for the stated Marathwada-first audience
- [ ] Browser-level proof for notification deep-links (X3), analytics taxonomy (X13), crash reporting (X14) — shipped per ledger but in the human-check bucket

---

## 4. How to Make It **Impressive** (product power)

Impressive = moments where the user thinks *"it just knew."*

1. **Offline-first superpowers.** The #1 differentiator for rural India. Queue actions offline (create lot, accept booking, log milk, record expense), show a sync-pending ribbon, auto-resolve conflicts with a visible policy (X19/X20). Ship "offline drafts" for every long form. Measure: % actions completed with zero connectivity.
2. **Today's Action, perfected.** The task engine exists — now make it *predictive*: combine weather windows (B17), mandi price trends, pending escalations, and calendar into one ranked morning briefing (push + home tile + optional 30-sec audio summary in hi/mr).
3. **Mandi intelligence that shows off.** Price history charts (F13), MSP reference (F14), fair-price band on every quote, and a "sell now vs wait 7 days" nudge powered by C4 demand forecast.
4. **Trust you can see.** Escrow status timelines, WORM evidence trail, KYC badges, OTP-verified POD with farmer countersign. Every transaction should have a *receipt story* — this is what makes an illiterate user's thumb hesitate to press pay.
5. **Speed as a feature.** Keep p95 < 500 ms budgets in CI; skeleton screens everywhere (no spinners on lists); prefetch the next likely screen (e.g., after booking → prefetch trip tracking). 262 KB first-load is great — now protect it with a bundle-size CI gate.

## 5. How to Make It **Sexy** (design & feel)

The conventions exist (`docs/conventions/01`: Mukta, glass cards, persona colors, 48dp targets, WCAG AA). Sexy is what happens when craft compounds:

1. **Design tokens, one source of truth.** Export color/space/radius/elevation/motion tokens to both React (CSS vars/Tailwind) and Flutter from a single `tokens.json`. Persona colors become gradients; the app stops feeling like assembled pages and starts feeling like *one product*.
2. **Motion with intent.** 150–250 ms ease-out transitions, shared-element transitions from card → detail, number tickers on prices/payouts, a subtle confetti + coin sound moment on milestone events (first sale, payout released, badge earned — ties into AgriCoins). Respect `prefers-reduced-motion` and system haptics.
3. **Dark mode.** Real tokens make this cheap; it's the fastest "wow" on OLED phones and demo recordings.
4. **Illustration & mascot system.** Commission a Kisan Mitra avatar set (empty states, errors, onboarding, celebration), Lottie for loading and success, and empty states that *teach* ("Abhi koi trip nahi — yahan se load board kholein"). Kill every raw `alert()`/`prompt()` in favor of the toast/modal system (hard-rule 6 already bans new ones — sweep the boards).
5. **Onboarding as theater.** 3-screen persona picker with live animated previews of each dashboard; phone-first OTP; language chooser as the *first* gesture with audio labels. The first 90 seconds decide retention.
6. **Brand polish.** App icon + splash refresh, consistent typography scale (Mukta + one display face), a landing page that matches the app's quality, and that demo video. Sell the *feeling*, not the feature list.
7. **Vernacular microcopy.** Parity-checked en/hi is table stakes; make the *tone* local ("Aaj ke bhav", "Paisa surakshit hai"). Extend the M32 localization pipeline to mr next.

## 6. How to Make It **Professional** (engineering rigor)

1. **Secrets & repo hygiene (this week).** Rotate the committed Firebase service-account key, scrub git history, untrack `dist/` + `node_modules/`, enforce `.gitignore` + a secret-scanning pre-commit/CI step (gitleaks or trufflehog).
2. **CI that gates everything.** One pipeline: backend tests (1,416) + coverage ≥70% on routers · web `tsc` + `build` + `locales:check` + **new Vitest unit tests** + bundle-size gate · Flutter `analyze` + tests · **golden AI contract tests** (already built — wire them in) · load-test smoke. Add the **`APP_ENV=prod` test profile** so prod config is testable in CI.
3. **Fix the AI gateway debt (task 4.12).** Route the 14 direct callers through service wrappers; fix `costUsd` accounting; set OpenRouter spend caps; kill the 2 flaky tests.
4. **Observability.** Sentry release tagging (backend + web + Flutter), uptime + latency dashboards, alert on error-rate spikes and escrow anomalies, structured request logs with trace IDs. Launch-day readiness = knowing it's broken before a user tweets it.
5. **Release discipline.** Feature flags (X12 exists — use them for every launch), force-update/remote config, versioned API sunset policy, conventional commits + PR templates, release notes per train.
6. **Security before beta.** Dependency scanning, a pre-launch pen test, rate-limit audit on auth/money endpoints, DPDP sign-off, and a written incident-response runbook.
7. **Docs as product.** Keep `AGENTS.md`/`docs/conventions` current (the repo already holds this bar); add an API changelog and a public status page.

## 7. AI Power Moves (the next wave)

Beyond clearing the 7 deferrals (§3.2), the powerpacked AI story is *visible intelligence*:

- **Kisan Mitra, proactive.** The chatbot answers; the powerpacked version *initiates*: "Baarish ke baad apke kshetra mein blight ka khatra — scan karein." Feed it from the task engine + weather + pest radar.
- **Explain-everything layer.** `AiExplainSheet`/`AiDraftBanner` shipped in phase-08 — apply them consistently so every AI decision ("fair price band", "KYC rejected", "demand forecast") shows *why* in 2 lines of Hindi. Trust scales with explainability.
- **Photo-to-paper elimination.** Yield estimation (C9) + weigh-slip scan + 7/12 fetch → the farmer's records build themselves. This is the demo that makes jaws drop.
- **Matchmaking flywheel (C10).** Ranked demand↔supply↔truck matches with a one-tap "connect" that opens escrow automatically. The marketplace becomes a network, not a directory.
- **Calibration as a ritual.** Weekly golden-set review is already specced — make it a standing 30-min team ritual with a dashboard, so AI quality compounds instead of drifting.

## 8. Trust, Safety & Monetization Upgrades

- **DLT SMS + WhatsApp** as first-class channels (most rural users live in WhatsApp, not in-app chat).
- **BNPL at checkout** for input purchases (partnership) — the single biggest GMV lever for the input marketplace.
- **Finances that accountants love**: GST e-invoice IRN, Tally export, credit ledger statements — turns sellers/vyaparis into vocal advocates.
- **Certificate registry** for instructors and **verifiable receipts** everywhere — public proof beats marketing.
- **Vyapari probation tier** (concurrency cap + escrow cap) — protects marketplace quality from day one.

## 9. 90-Day Powerpacked Plan

| Phase | Days | Focus | Exit criteria |
|---|---|---|---|
| **1. Prove It** | 0–30 | §3.1 + §6.1–6.2 | Real-key Razorpay staging passed (settlements, TDS, GST, tier unlock); secrets rotated & scrubbed; 45 human checks done; `firestore:indexes` deployed; DPDP signed; CI matrix green incl. prod test profile; demo cut recorded |
| **2. Polish It** | 31–60 | §5 + §3.5 polish | `tokens.json` live in web+Flutter; dark mode; motion pass on 10 key flows; empty-state/illustration sweep (zero raw alerts); web unit tests + bundle gate in CI; mr locale complete; offline drafts + conflict policy shipped |
| **3. Power It** | 61–90 | §3.2–3.4 + §7 | A5, B5, B17, C9, C10, C4 live with calibration; WhatsApp bot post-DLT; Socket.IO chat; driver sub-accounts + OTP POD; GST IRN + Tally export; voice-AI decision recorded; gateway-direct debt (14 routers) cleared |

## 10. The Powerpacked Scorecard

We call it done when, measured over 30 days on staging→prod:

- **Reliability**: crash-free sessions ≥ 99.5% (Sentry) · p95 API < 500 ms · zero failed-load-test runs in CI
- **Quality**: backend tests green incl. `APP_ENV=prod` · web unit coverage ≥ 60% · 0 `alert()` calls · 0 committed secrets
- **Reach**: en/hi/mr locale parity (CI-gated) · offline action completion rate ≥ 95% · PWA install conversion ≥ 25% of eligible mobile web
- **Money**: every escrow flow proven with real keys · TDS + GST filings generated end-to-end
- **AI**: golden-set coverage ≥ 90% on shipped decisions · costUsd accurate within 5% · spend caps enforced
- **Delight**: a first-time user reaches "today's action" in < 60 s · demo video shipped · NPS ≥ 40 from the first 200 beta users

---

*Sources of truth: `docs/deferral-ledger.md` · `execution_plan_summary.md` · `docs/launch-checklist.md` · `missing.md` (historical gap audit) · `plan/*.md` (persona specs). When a feature here ships, move it to the ledger — the deferral ledger stays the single source of shipped-vs-deferred truth (hard rule 10).*
