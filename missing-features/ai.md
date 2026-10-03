# ai.md — AI-First AGROVERCITY: Jev (System One) + Gemini Research & Product Vision

> Research & vision document, v3 — 2026-10-03. Companions:
> `missing-features/ai_implementation_plan.md` (execution, with module-wise agent
> briefs), `missing-features/robust.md` (SaaS conversion), `understand.md`.
> Scope: `backend/` + `website/` only.
>
> **Provider decision (fixed):**
> - **Jev → OpenRouter** (`typesafe/jev-1.13`) — typed decisions
> - **Gemini → Google AI Studio direct API** (`google-genai` SDK, AI Studio API key) —
>   generation, vision, embeddings
>
> **Descoped:** Voice AI (STT/TTS, voice form-fill, voice onboarding, voice chatbot)
> is explicitly out of this program. Feature IDs C1 and C19 and brief M27 are
> retired; remaining IDs are kept stable for traceability.

---

## 1. What Jev is (verified research)

**Jev** is a "System One Model" launched by **TypeSafe AI** (San Francisco, founded
2024, $40M seed led by DCVC; founders include Diogo Almeida, ex-OpenAI RLHF lead) on
**15 September 2026**. A genuinely different model category, not another LLM:

| Property | LLM (Gemini) | Jev (System One) |
|---|---|---|
| Output | Free-form text, token by token | **No text at all** — typed answers to typed questions |
| Interface | prompt → completion | **state + typed questions → typed decisions** (boolean / choice / 0–1 score) + probabilities + confidence |
| Failure mode | Hallucination, malformed JSON | Structurally cannot return a value outside the declared schema |
| Latency | Seconds | **~70–500 ms** end-to-end |
| Cost | Input + output tokens | **~$0.042 / 1M input tokens, output free** |
| Context | 100k–1M | **32k tokens** |
| Training | RLHF/instruction | **RLCD — Reinforcement Learning for Calibrated Decisions** (synthetic data; confidence aligned to real-world accuracy) |
| Self-host | Some | No — closed weights, one shared model, no fine-tuning |

Example call shape (same contract on OpenRouter):

```bash
curl -X POST https://openrouter.ai/api/v1/...  # model: typesafe/jev-1.13
# payload:
{
  "state": "Farmer posted 40q onion lot @ ₹1,850/q. Nashik APMC modal today ₹1,620. 3 offers pending.",
  "questions": {
    "offer_quality": {"type": "score", "instructions": "0-1: how good is the best pending offer vs market?"},
    "recommended_action": {"type": "choice", "criteria": {
        "accept_best": "Best offer is at/above fair value",
        "counter": "Offers below fair value, negotiate",
        "wait": "Market is rising, hold 24-48h",
        "move_mandi": "Different mandi nets more after transport"
    }}
  }
}
```

Sources: [hackerspot deep dive](https://www.hackerspot.net/p/what-is-jev-typesafe-ais-system-one) ·
[OpenRouter Jev docs](https://openrouter.ai/docs/guides/community/jev) ·
[Jev channels compared](https://jevaiguide.com/channels/) ·
[Jev API reference](https://www.aimodelwaddle.com/jev-api) ·
[promptql access guide](https://promptql.io/blog/jev-ai).

### 1.1 Access & caveats

- **OpenRouter route (`typesafe/jev-1.13`)** needs only prepaid OpenRouter credits —
  no TypeSafe account (direct sign-ups were paused 22 Sep 2026). Pin the version;
  schema vocabulary differs per channel (`boolean` vs `noul`), so we standardize on
  **one channel: OpenRouter**.
- **All speed/cost claims are self-reported** by TypeSafe; a third-party 791-decision
  benchmark found Jev faster/cheaper but **not consistently more accurate** than
  frontier LLMs. A 10× pricing discrepancy ($0.042 vs $0.42/M) has appeared between
  listings — verify live rates before budgeting.
- Closed weights, no fine-tuning → our moat is the **question schemas, calibration
  data, and feedback loops**, not the model.
- Community shims (OpenJev/SemIf) replicate the contract locally — our dev/CI
  fallback pattern follows the same idea.

---

## 2. The AI-First thesis for AGROVERCITY

Standard "AI-first" = a chatbot bolted onto every screen. For our users —
semi-literate rural India, Hindi/Marathi-first, icon-first UX — that is the wrong
interface. **AI-First AGROVERCITY means the app acts before being asked:**

1. **Invisible intelligence.** Every screen is pre-computed: tasks ranked, offers
   scored, prices flagged, fraud caught. The chatbot is the *second* interface.
2. **Tap, don't type.** AI pre-fills forms, pre-selects crops, and pre-suggests
   prices so users confirm choices with taps instead of typing — critical for
   low-literacy users.
3. **Decisions at farmer scale.** Dozens of micro-decisions per user per day are
   only economically possible at Jev pricing; Gemini is reserved for the ~2% of
   moments needing language, vision, or reasoning.
4. **Calibrated autonomy.** Every AI action has a confidence score and an
   automation level (`suggest → require_confirm → auto`) earned through logged
   outcomes. Credit, insurance, and legal decisions never pass `require_confirm`.
5. **Type-safe AI.** Jev's schema-constrained outputs drop straight into our
   Pydantic DTOs — no parsing, no prompt-injection surface in the output channel.
6. **Graceful degradation.** The whole app works with AI off (`AI_PROVIDER=shim`);
   every decision point has a deterministic fallback.

### 2.1 Three-layer architecture

```
┌────────────────────────────────────────────────────────────────┐
│ L1 — Jev via OpenRouter (System One) · 70–500ms · ~₹0.003/dec  │
│ classify · score · route · rank · verify · flag · match        │
│ runs on EVERY meaningful event, write path, and screen load    │
└──────────────┬─────────────────────────────────────────────────┘
               │ confidence < threshold, or language/vision needed
               ▼
┌────────────────────────────────────────────────────────────────┐
│ L2 — Gemini via AI Studio direct (System Two)                  │
│ Kisan Mitra chat · vernacular explanations · vision (disease,  │
│ grading, KYC docs, receipts) · forecasts · translations ·      │
│ embeddings (search/matching)                                   │
└──────────────┬─────────────────────────────────────────────────┘
               │ low confidence / high stakes / user requests
               ▼
┌────────────────────────────────────────────────────────────────┐
│ L3 — Human experts (existing `expert_tickets` + admin console) │
│ agronomists · KYC reviewers · dispute officers · credit/claims │
└────────────────────────────────────────────────────────────────┘
```

**Jev decides, Gemini explains, humans adjudicate.**

---

## 3. Current AI inventory (ground truth)

| Where | What exists | State |
|---|---|---|
| `backend/app/services/chatbot.py` | Kisan Mitra — Gemini 2.5 Flash direct, Hindi/Hinglish prompt | Real |
| `backend/app/routers/chatbot.py` | Chat + expert handoff (`expert_tickets`) | Real; **no web UI** |
| `backend/app/services/disease_model/` | Gemini Vision disease scan + stub | Real impl, unexposed on web |
| `backend/app/services/grading_model/` | AGMARK grading | **Stub only** |
| `backend/app/routers/advisory.py` | Saturation / NPK / pest radar | Rule-based, hardcoded prices |
| `backend/app/routers/intelligence.py` | Cross-persona ops summary | Rule-based |
| Docs | Planned: OpenRouter, role-based AI | Not implemented |
| `website/` | Chatbot/advisory/scan/grading all "coming soon" | **Zero AI UI** |

---

## 4. The full AI feature catalog

Legend: **J** = Jev typed decision · **G** = Gemini generation/vision ·
**H** = human. Question-set IDs (`xxx.yyy.v1`) are defined in the implementation
plan's registry; agent briefs reference these IDs.

### 4.1 Platform decision layer (cross-persona)

| ID | Feature | Layer | What it does |
|---|---|---|---|
| A1 | Task ranking + next-best-action (`tasks.rank.v1`) | J | Orders every persona's dashboard; picks the one hero card |
| A2 | Notification timing/channel (`notify.timing.v1`) | J | send-now vs digest vs skip; push vs SMS |
| A3 | Notification copy (`notify.copy.v1`) | G | Vernacular one-liner per task |
| A4 | Price sanity band (`seller.rate_check.v1`) | J | Vyapari rate vs Agmarknet band → approve/flag/reject |
| A5 | Offer quality scoring (`trade.offer_score.v1`) | J | Score offers vs mandi + trend; recommend accept/counter/wait |
| A6 | Fraud & collusion (`trust.fraud.v1`) | J | Circular bidding, rate collusion, referral/coin abuse → soft-hold + admin queue |
| A7 | Chat guardrails (`chat.guardrail.v1`) | J | Catches evasive contact/payment sharing that regex misses |
| A8 | KYC triage (`kyc.extract.v1` + `kyc.authenticity_risk.v1`) | G+J | Extract doc fields (vision), score risk → auto-advance / human queue |
| A9 | Dispute triage (`dispute.triage.v1`) | J | Category + liability hint + urgency → right admin queue with SLA |
| A10 | Expert-handoff routing (`chatbot.intent.v1`) | J | Chatbot-answerable vs human agronomist; which specialization |
| A11 | Search intent (`search.intent.v1`) | J | Routes global search across schemes/products/news/crops/courses |
| A12 | UGC moderation (`content.moderation.v1`) | J | News comments, live chat, reviews → human review queue |
| A13 | Settlement anomaly (`trust.payout_anomaly.v1`) | J | Payout batch outliers before money moves |

### 4.2 Persona & module decisions

| ID | Module | Feature | Layer |
|---|---|---|---|
| B1 | Mandi | Smart mandi selection incl. transport cost (`mandi.smart_select.v1`) | J + G explain |
| B2 | Advisory | Saturation risk class + alt-crop ranking (`advisory.saturation.v1`) | J |
| B3 | Disease | Photo → disease + treatment; image-quality gate | G-vision + J |
| B4 | Grading | Photo → AGMARK grade, shelf life, price band | G-vision + J gate |
| B5 | Marketplace | Product recommendations; counterfeit-certificate risk | J |
| B6 | Contracts | Grow-for-us attractiveness vs mandi (`contracts.attractiveness.v1`) | J |
| B7 | Loans | Pre-screen + doc completeness (`loans.prescreen.v1`) — never auto-approves | J + H |
| B8 | Insurance | Claim triage: completeness, photo quality, fraud signal (`insurance.triage.v1`) | J + H |
| B9 | Transport | Load↔vehicle match ranking; return loads; no-show risk (`transport.match.v1`) | J |
| B10 | Equipment | Approve recommendation; damage severity from photos | J + G-vision |
| B11 | Dairy | FAT/SNF adulteration anomaly (`dairy.adulteration.v1`); collection anomalies | J |
| B12 | Broker | Lead quality; 3-round deadlock prediction (`broker.lead_score.v1`) | J |
| B13 | Land | Listing quality; tenant compatibility (`land.listing_quality.v1`) | J |
| B14 | Courses | Recommendations vs crops/season (`courses.recommend.v1`); objective auto-grading | J + G |
| B15 | Schemes | Eligibility ranking + doc-gap detection (`schemes.match.v1`) | J + G explain |
| B16 | Women hub | SHG loan-readiness (`women.shg_readiness.v1`) | J |
| B17 | Weather | Spray-window class; severe-weather → task generation | J |

### 4.3 Generative & experience AI

| ID | Feature | Layer | Description |
|---|---|---|---|
| ~~C1~~ | *retired — voice form-fill descoped* | — | — |
| C2 | **Receipt & weigh-slip scan** | G-vision | Photo of receipt/weigh-slip → structured expense/income entry in farm diary |
| C3 | **Mandi price forecast** | G + J | 7/30-day trend projection from history + arrivals + seasonality; Jev emits confidence band class; honest "estimate" labeling |
| C4 | **Demand forecast (vyapari/dairy)** | G | Stock procurement suggestions from sales history + season |
| C5 | **AI crop planner** | G + J | From soil, water, plot size, market saturation, history → season plan → creates `crop_cycles` + task schedule on confirm |
| C6 | **Negotiation coach** | G | Suggested counter-price + a respectful vernacular script line for the offer chat |
| C7 | **Onboarding copilot** | G | Guided setup: location → language suggestion → district crops auto-suggested (region-crop data exists in spec) |
| C8 | **Pest outbreak early warning** | J + G | Aggregates district disease scans → cluster signal → advisory task to affected farmers |
| C9 | **Yield estimation** | G | Rough per-plot estimate from crop stage + weather; drives insurance/credit context; labeled as estimate |
| C10 | **Smart matchmaking** | J + embeddings | Farmer↔land listings, farmer↔FPO, lot↔buyer demand, farmer↔courses |
| C11 | **Doc vault intelligence** | G-vision | Auto-tag uploaded docs, extract expiry dates → expiry tasks |
| C12 | **Personalized advisory feed** | G | Daily 3-card vernacular brief: weather + mandi + one agronomy tip for *his* crops (cached per district-crop, not per user) |
| C13 | **AI support agent** | J + G | Resolves app-help questions; escalates account/money issues to humans |
| C14 | **Admin copilot** | G | Natural-language ops queries ("show KYC backlog by state"), daily ops briefing, anomaly summaries in admin console |
| C15 | **Localization pipeline** | G | Gemini-assisted translation of the 28 partial locales + module pairs, with human review queue and CI parity gate |
| C16 | **Churn prediction** | J | Dormancy signals → re-engagement task/notification |
| C17 | **Farmer standing agent** | J + confirm | User-set rules in vernacular: "₹1,800 se upar offer aaye toh accept kar do" — Jev matches, app asks one-tap confirm, executes |
| C18 | **WhatsApp companion bot** | G | Mandi rates, task digests, lot status over WhatsApp for feature-phone adjacency (post-DLT/template approval) |
| ~~C19~~ | *retired — Kisan Mitra voice mode descoped* | — | — |
| C20 | **Learning paths** | J + G | Course sequence per farmer's crops/season/gaps; certificate → skill passport suggestions |

---

## 5. AI-first user flows

AI touchpoints marked **[J]** Jev, **[G]** Gemini, **[H]** human. Each flow is the
acceptance narrative for the corresponding implementation briefs.

### 5.1 Farmer morning (dashboard as the AI front door)
1. Farmer opens app → dashboard loads cached `/v1/tasks/summary`.
2. **[J] tasks.rank.v1** orders his day; hero card: "Aapke pyaz ka best offer mandi
   se 14% upar — aaj 6 baje tak" (from A5 decision + **[G]** vernacular line).
3. Weather strip shows spray-window **[J]** advisory; a rain alert task was
   auto-generated overnight.
4. **[G] personalized brief** (C12): 3 cards — weather, his crops' mandi moves,
   one tip.
5. He taps the hero card → lot detail → one-tap Accept (AI recommended, he
   decides) → escrow + pickup tasks auto-created.

### 5.2 Sell produce, AI-assisted
1. Farmer taps "Bechna hai" → smart lot form **pre-filled by AI from his profile**
   (last crop, usual quantity, usual mandi) with a live price-band suggestion; he
   adjusts with +/− steppers and confirms — no typing needed.
2. Optional photo → **[G B4]** AGMARK grade + suggested price band auto-attached.
3. Lot live → distribution to vyapari/broker/direct-buyer demand matches
   **[J C10]**.
4. Offers arrive → **[J A5]** badges ("mandi +14%", "mandi −8%") + recommended
   action; low confidence → neutral display, no nudge.
5. If he counters → **[G C6]** suggests counter-price + polite Hindi line.
6. Accept → handover OTP flow (existing) → transport booking suggested with
   matched vehicles **[J B9]** → payment release → diary auto-entry
   **[existing + G C2 if receipt photo]**.

### 5.3 Disease emergency
1. Photo of leaf → **[J]** gate: is it a leaf? quality ok? (else "din ki roshni
   mein dobara kheenchein").
2. **[G-vision B3]** disease + treatment + cost + nearest dealer; confidence 87%.
3. < 70% confidence → **[H]** expert ticket with photo attached; farmer sees
   "expert se jawab aayega" thread.
4. Treatment task scheduled in task engine; district scan count crosses
   threshold → **[J C8]** outbreak advisory to nearby farmers.

### 5.4 Onboarding (new farmer, guided)
1. Grants location (or searches village) → **[G C7]** resolves → language
   suggestion → district crops pre-selected (existing region-crop mapping).
2. Persona cards explained in plain language; farm map: GPS pin + boundary
   confirm.
3. **[J]** KYC-lite: which docs needed for chosen personas → checklist tasks.
4. Lands on dashboard already populated with scheme matches **[J B15]**, mandi
   cards for his crops, and one starter course **[J B14]**.

### 5.5 Transporter day
1. Morning: **[J A1]** hero card — "2 jobs Nashik route, ₹6,400 total".
2. New booking request → **[J B9]** no-show risk + return-load match shown on the
   accept screen.
3. Trip: milestones → POD photo → **[G-vision]** weighbridge slip read (C2-style
   extraction into trip record).
4. Day end: settlement preview; **[J A13]** anomaly check passes; weekly payout
   task scheduled.

### 5.6 Vyapari morning
1. Posts today's rates → **[J A4]** instant inline warning if outside band (with
   band shown), not a later rejection.
2. **[G C4]** procurement suggestion: "onion arrivals rising, stock 2 din ka hai".
3. Procurement entry: weigh-slip photo → **[G C2]** auto-fill; farmer gets
   "payment pending" trust card.
4. **[J A6]** collusion watch runs silently on his rates vs other vyaparis.

### 5.7 Bank manager queue
1. Queue pre-sorted by **[J B7]** risk/completeness; missing-doc applications
   flagged with auto-generated farmer tasks.
2. Detail view: farmer 360 (crops, diary P&L, KCC, history) + **[G]** one-paragraph
   vernacular-neutral summary.
3. Manager decides — AI never approves. Every decision audit-logged.

### 5.8 Insurance claim
1. Farmer: 72-h intimation, geo-tagged photos → **[J B8]** completeness +
   photo-quality instant feedback (retake now, not rejection in 15 days).
2. Provider console: claims pre-triaged, fraud signals flagged, surveyor
   assignment suggested **[J]** → assigned **[H]**.
3. Status tracker narrated in vernacular **[G]**; DBT arrival → diary income
   entry + celebration task.

### 5.9 Landlord lease
1. Lists plot → **[J B13]** listing-quality tips ("photo add karein, rent band
   ₹X–Y").
2. Farmer request → compatibility score; counter-offer → agreement PDF (existing)
   → dual e-sign → milestone escrow → rent reminder tasks **[existing job + J A2
   timing]**.

### 5.10 Admin ops morning
1. Admin copilot **[G C14]** briefing: "KYC backlog 34 (MH 22), 2 payout anomalies
   held, disease cluster in Nashik onion."
2. Each item deep-links to its queue with AI pre-triage attached.

---

## 6. Provider strategy (fixed)

1. **Jev → OpenRouter only.** Model pinned `typesafe/jev-1.13`. One
   `OPENROUTER_API_KEY`, `HTTP-Referer` + `X-Title` headers, spend caps on the
   OpenRouter side as backstop.
2. **Gemini → Google AI Studio direct** (`google-genai` SDK, `GEMINI_API_KEY`
   from AI Studio). Used for: Kisan Mitra, explanations, vision (disease,
   grading, KYC, receipts, weigh-slips), forecasts, translations, embeddings.
   Models: `gemini-2.5-flash` (default), `gemini-2.5-flash-lite` (high-volume
   cheap paths), `gemini-2.5-pro` (admin copilot/complex),
   `gemini-embedding-001` (search/matching).
3. **No OpenRouter for Gemini** (avoids double billing/markup; direct AI Studio
   is the cheapest path and already half-integrated via `chatbot.py`).
4. **Shim for dev/CI** implementing both contracts deterministically
   (`AI_PROVIDER=shim`).

### 6.1 Cost envelope (order-of-magnitude — verify live rates)

100k DAU × ~40 decisions/user/day:
- **Jev:** ~4M decisions × ~800 input tokens ≈ 3.2B tokens/day ≈ **$134/day
  (₹3.4L/month)** at $0.042/M; state-trimming + batched questions can halve it.
- **Gemini:** ~2% of interactions (chat, vision, explanations) — close to current
  Kisan Mitra spend; forecast/translation jobs are batch-cheap (cached per
  district-crop, not per user).
- Equivalent decisions on Gemini directly: 10–40× cost, 10× latency. The Jev
  layer is what makes "AI on every screen" affordable.

---

## 7. Trust, calibration & compliance

1. **`ai_decisions` log** — every call: module, question set + version, state
   hash, answers, confidence, latency, cost, model, fallback flag, and backfilled
   real-world outcome. This is the calibration dataset and the moat.
2. **Calibration loop** — weekly accuracy/reliability reports per question set;
   thresholds tuned from data; automation raises require ≥1,000 outcomes at >90%
   top-bucket accuracy + maker-checker approval.
3. **Golden datasets** per decision type, run in CI (shim) and nightly (live) to
   catch model-version regressions.
4. **DPDP/privacy** — payloads minimized & pseudonymized (hashed IDs, no phones,
   masked Aadhaar only); photos only to vision endpoints; disclosure in consent
   center; retention disabled where provider supports it.
5. **Kill switches** — per-module flags in `platform_config/ai`; every decision
   point has a deterministic fallback; budget caps degrade, never error.
6. **Honesty** — recommendations badged "AI sujhav"; forecasts/estimates labeled;
   advisory always cites data basis (mandi + date); no fabricated precision.

---

## 8. Key sources

- [What Is Jev? — hackerspot.net](https://www.hackerspot.net/p/what-is-jev-typesafe-ais-system-one) (deepest neutral write-up + caveats)
- [Jev on OpenRouter — official guide](https://openrouter.ai/docs/guides/community/jev) (our integration channel)
- [Jev channels compared — jevaiguide.com](https://jevaiguide.com/channels/) (model names, schema differences per channel)
- [Jev API reference — aimodelwaddle.com](https://www.aimodelwaddle.com/jev-api) (endpoints, model IDs)
- [Jev access/pricing — promptql.io](https://promptql.io/blog/jev-ai) (access status, pricing discrepancy)
- [TypeSafe Jev benchmark notes — dymesty.com](https://dymesty.com/blogs/articles/typesafe-jev-system-one-ai-model)
- [Critic analysis — pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/16460/typesafe-jev-chatless-ai-beats-claude)
- [Google AI Studio / Gemini API docs](https://ai.google.dev/gemini-api/docs) (`google-genai` SDK, models, vision)
