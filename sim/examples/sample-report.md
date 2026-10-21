# SAMPLE REPORT — illustrative fictional output

> ⚠️ **This file shows the report FORMAT with invented findings.** Nothing below
> is a real measurement of Agrovercity. Generate the real thing with:
> `python -m sim.cli run --suite smoke && python -m sim.cli analyze`

---

# Agrovercity Sim Report

```
run_id   : smoke-2026-10-28T06-12-33-ab12cd3
suite    : smoke (10 scenarios, 9 executed, 1 blocked-identity)
model    : deepseek-flash (off-peak)
backend  : http://localhost:8000  ENV=dev  firestore: agrovercity-sim-test
duration : 11m 04s   steps: 247   llm_calls: 259 (agent 241 + debrief 9 + retries 9)
tokens   : in 389k (52% cache-hit)  out 52k
cost     : $0.083
verdicts : no human verdicts applied yet → review queue has 20 items
```

## 1. Executive summary

| | count | high severity |
|---|---|---|
| Missing-feature candidates | 7 | 3 |
| Userflow obstacles (friction/stuck) | 11 | 4 |
| Dataflow suspicions | 3 | 1 |
| Unnecessary-feature candidates | 6 | — |
| Security probe results | 4 passed / 0 failed | — |

**Top 5 this run:**
1. **[gap · high]** Farmer lot created via `POST /market/lots` invisible to seller
   browsing `GET /seller/lots` for the same crop+district (see §6 — likely tag
   scope, not missing feature).
2. **[userflow · high]** Offer counter flow: 2 personas abandoned after
   `POST /offers` 422 — error message doesn't say which field failed.
3. **[dataflow · high]** Dairy payment batch marked paid but member wallet not
   credited after 5 polls (`async_wait` exhausted) — settlement job suspected.
4. **[gap · high]** Milk subscription can be created but **not paused** — searched
   `pause subscription`, `skip week`, `vacation` → 0 results ×3 personas.
5. **[ease · medium]** SHG user (Hindi, low literacy) reached checkout but never
   found the language toggle; completed in English with errors.

---

## 2. Coverage map

Per persona: did the run touch what this persona *must* touch?

| persona | must_touch | hit | miss ⚠️ |
|---|---|---|---|
| farmer | mandi, market, demands | mandi ✓, market ✓ | **demands ✗** |
| transporter | transport, wallet | 2/2 ✓ | — |
| seller | market, rates, pos | 3/3 ✓ | — |
| customer | marketplace, orders, wallet | 2/3 | **wallet ✗** (payment boundary stop) |
| bankManager | loans, kyc | 2/2 ✓ | — |

Suite-wide zero-hit endpoints (inside some persona's whitelist, ≥3 runs): **6**
→ unnecessary candidates, verify manually before any deletion:

| endpoint | tag | whitelisted for | note |
|---|---|---|---|
| `GET /v1/trees/carbon-summary` | tree | farmer, customer | gamified feature, maybe seasonal |
| `POST /v1/offers/bulk-counter` | offers | seller | bulk flow — did seeds lack bulk lots? |
| `GET /v1/equipment/market-intel` | equipment | equipmentRental | check seed coverage |
| `GET /v1/gyan/shorts` | gyan | instructor | low priority |
| `POST /v1/wishlist/import` | wishlist | customer | niche |
| `GET /v1/dairy/adulteration-kit` | dairy | dairyManager | flagged: data gap vs feature gap |

*Classified `data-gap` where seeds likely explain it — see review queue.*

---

## 3. Failure taxonomy

**Top endpoints by error rate** (status ≥ 400, runs with hits in parentheses):

| endpoint | 4xx | 5xx | top error |
|---|---|---|---|
| `POST /v1/offers` (3) | 5 | 0 | 422 VALIDATION (message lacks field) |
| `POST /v1/auth/otp/send` (1) | 4 | 0 | 429 RATE_LIMITED (harness retried login — token cache bug, fixed) |
| `POST /v1/market/lots` (2) | 2 | 0 | 400 grade enum rejected "good wheat" |
| `POST /v1/payments/order` (1) | 2 | 0 | boundary stop (documented §18d) |
| `GET /v1/mandi/prices` (3) | 3 | 0 | 404 district=Bharuch missing in seeds |

**Expectation-vs-actual mismatches** (agent assumed reasonably, API disagreed):

| step | expected | got | run |
|---|---|---|---|
| counter an offer lower | 200 + new offer id | 404 `POST /offers/{id}/counter` | seller-open |
| see lot in seller discovery after farmer listed | 200, lot present | lot absent | farmer-sell-wheat |
| wallet auto-tops at checkout | redirect to top-up | plain 402 | customer-buy-basket |

---

## 4. Stuck report (watchdog events)

| run | tripped at | pattern |
|---|---|---|
| farmer-low-literacy-sale | step 14/25 | repeated `POST /market/lots` 3× — grade/quantity fields unknown; agent kept retrying instead of asking chatbot (ease finding: form should guide) |
| broker-stuck-deal | step 12/22 | 5 steps no state change — milestone actions invisible until deal status flips; no in-app explanation |
| customer-late-delivery | step 9/20 | support chatbot looped 3 identical intents; handoff to human never offered |

---

## 5. Missing-feature board (ranked)

Score = frequency × persona breadth × domain weight (payments/auth=3, commerce=2, engagement=1).

| # | feature wanted | reported by | class | score | evidence |
|---|---|---|---|---|---|
| 1 | Pause/skip milk & veg subscriptions | milkSeller, customer, dairyManager (4 runs) | feature-gap | 24 | zero-result searches: `pause subscription`, `skip week`, `vacation` |
| 2 | Plain-language lot form ("good wheat" → suggested grade) | farmer (3 runs) | userflow + validation gap | 18 | stuck trail §4 row 1; 400s §3 |
| 3 | Seller-side lot visibility across scopes | farmer, seller (2 runs) | **bug-suspicion** | 18 | write→read probe §6 row 1 |
| 4 | Wallet auto top-up at checkout | customer (2 runs) | feature-gap | 12 | mismatch §3 |
| 5 | Human handoff in support chatbot | customer (2 runs) | feature-gap | 12 | stuck §4 row 3 |
| 6 | Hindi language toggle during onboarding | womenShg (1 run) | ease-gap | 9 | debrief + step 6 hesitation |
| 7 | Mandi price SMS/notification when rate crosses target | farmer (1 run) | feature-gap (exists? `price_alerts` tag — investigate) | 9 | search found tag but agent couldn't complete flow |

---

## 6. Dataflow suspicions (write→read-back probes)

| # | written via | read via | observation | status |
|---|---|---|---|---|
| 1 | `POST /market/lots` (lot_7f3a) | `GET /seller/lots?crop=wheat` | lot not in seller scope | **confirmed across 2 reruns** → file as bug |
| 2 | dairy batch pay (`POST /dairy/payment-batches/{id}/pay`) | `GET /dairy/members/{id}/wallet` | paid but member wallet unchanged after 5 polls | **suspicion → job runner check** (`jobs` cron) |
| 3 | `POST /transport/bookings` POD OTP verified | `GET /transport/wallet` | fare not credited after trip close | likely async settlement — monitor, tag `async_wait` |

---

## 7. Friction index (per scenario, SLOs: GET p95 ≤ 400ms, mutation p95 ≤ 800ms, zero 5xx)

| scenario | outcome | steps | retries | backtracks | p95 ms | SLO | satisfaction |
|---|---|---|---|---|---|---|---|
| farmer-sell-wheat | done | 22 | 6 ⚠️ | 2 | 610 | ❌ mutation 940ms | 3/5 |
| farmer-evening-round | done | 17 | 1 | 0 | 340 | ✅ | 4/5 |
| farmer-low-literacy-sale | gave_up@14 | 14 | 7 ⚠️ | 1 | 720 | ✅ | 2/5 |
| transporter-run-trip | done | 19 | 2 | 0 | 480 | ✅ | 5/5 |
| transporter-race-and-recover | done | 16 | 3 | 1 | 505 | ✅ | 4/5 |
| seller-procure-and-sell | done | 24 | 4 | 2 | 655 | ✅ | 3/5 |
| customer-buy-basket | done | 21 | 5 ⚠️ | 1 | 880 | ❌ mutation 1210ms | 3/5 |
| customer-late-delivery | gave_up@9 | 9 | 4 | 0 | 430 | ✅ | 1/5 |
| bank-loan-pipeline | done | 18 | 1 | 0 | 460 | ✅ | 5/5 |
| bank-incomplete-kyc | done | 14 | 0 | 0 | 390 | ✅ | 4/5 |

Retries clustered on **checkout, offer validation, lot creation** → the three
screens worth an ease redesign pass first.

---

## 8. Verbatim frustrations (debriefs, unedited)

> "It asks 'grade' — I don't know English grades, my wheat is just good wheat."
> — farmer, farmer-low-literacy-sale

> "Load was gone when I pressed accept. Show me the next one fast, don't make me search again."
> — transporter, transporter-race-and-recover

> "Bot kept saying 'I understand your concern' but nobody came. My order is still missing."
> — customer, customer-late-delivery

---

## 9. Review queue (top 20 → human verdict)

Apply verdicts in `config/known_gaps.yaml` (`real` / `not-real` / `data-gap` /
`duplicate-of`) to suppress noise in future runs.

- [ ] #1 subscriptions pause — real? design exists?
- [ ] #2 plain-language lot form — real / fix validation messages first?
- [ ] #3 seller lot visibility — **confirmed bug**, file ticket (evidence §6.1)
- [ ] #4 wallet auto top-up — real? payments boundary dependency
- [ ] #5 chatbot human handoff — real
- [ ] #6 Hindi onboarding toggle — check `preferredLanguage` flow end-to-end
- [ ] #7 price alerts — feature exists? usability gap in discovery?
- [ ] #8 mandi district coverage — data-gap (seeds) or real coverage gap?
- [ ] #9 `offers/bulk-counter` zero-hit — unnecessary or unseeded?
- [ ] #10 dairy settlement job — verify `jobs/settlements` cron in dev env
- [ ] … (10 more)

---

## 10. Appendix

- Raw artifacts: `runs/smoke-2026-10-28T06-12-33-*.jsonl` + `.meta.json` + `.debrief.json`
- Machine-readable: `reports/report.json` (same sections, ids for M3 diffing)
- Re-analyze free: `python -m sim.cli analyze --replay smoke-2026-10-28T06-12-33`
- Zero-LLM UI cross-check: `python -m sim.cli ui-diff` (specs §18j) — endpoints the
  website calls but this run never touched: `24` (mostly superadmin console surface)

*Report generated by sim analyzer v0.1 — suspicions are heuristics, not verdicts.*
