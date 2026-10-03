# Phase 05 — Platform Module Sweep (24 modules)

> Ship every robust.md §7 platform module not already owned by phases 02–04 so that
> each of the 24 tiles in the All-Tools launcher resolves to a real, working page
> with real collections, task-engine integration, and en/hi locales. Every module
> follows the mandatory 7-step Module Playbook (robust.md Appendix A §12). AI
> briefs M9 (disease scan), M10 (AGMARK grading), M12 (mandi smart select +
> forecast), M13 (advisory saturation + crop planner), M21 (schemes match) land
> inside their owning modules at `suggest` automation level.
> Sources: robust.md §7 intro, §7.1–7.17, §7.22–7.24, §12 (playbook);
> ai_implementation_plan.md §2 (question sets), §3 (SDR/SGR), briefs M9/M10/M12/M13/M21;
> ai.md feature IDs F1/F10/F11/F13/F14/F15/F17/F18/F19, B1/B15, C3/C5.

## Depends on

- **phase-00** — security hardening, real Razorpay money rails (checkout for
  marketplace/gyan-style paid flows), KYC plumbing, `platform_config` infra,
  green test suite, AI gateway `backend/app/services/ai/gateway.py` (M1) with
  shim provider and `platform_config/ai` flag reader.
- **phase-01** — the task engine (`emit_task()` + `GET /v1/tasks/*` + Action
  Center): every module in this phase must emit its tasks and surface them in
  the dashboard summary grid.

## Workstreams

| WS | Title | Source | Output (what exists when done) |
|---|---|---|---|
| WS-01 | Trade-intelligence modules | robust §7.1, §7.4; brief M12 | Mandi charts (F13) + price-alerts management UI + AI smart-mandi card + 7/30-day forecast; contracts polish + MSP reference (F14) |
| WS-02 | Advisory hub & AI vision | robust §7.2; briefs M9, M13 | 5-tab advisory hub on mandi-linked data; disease scan with per-plot history (F10); AI crop planner creating real `crop_cycles` |
| WS-03 | Marketplace e-commerce | robust §7.3 | Full catalog/cart/checkout/orders/returns/wishlist/coupons/address book (X6)/reviews (X7) + seller product management UIs |
| WS-04 | Money & records | robust §7.5, §7.17 | FarmCeoPage + CashbookPage fallbacks stripped; P&L auto-fed from all marketplaces; PDF + Tally export (G10); diary photos (F18) + auto-entries |
| WS-05 | Finance & protection | robust §7.7, §7.8, §7.9; brief M21 | Schemes discovery/apply + AI match; credit score/loan marketplace/EMI/KCC/wizard (F17); PMFBY 4 tabs with 72-h intimation + appeal (F15) |
| WS-06 | Land, FPO & post-harvest | robust §7.10, §7.11, §7.14; brief M10 | 7/12 search/viewer/import with honesty labeling; FPO discovery/join (F19) + pools + machinery calendar; cold-storage farmer face + receipts vault + photo→grade→price→list-as-lot loop |
| WS-07 | Water, climate & green | robust §7.6, §7.13, §7.22 | Irrigation schedules + CGWB gauge + canal calendar + PMKSY 55% calc; honest carbon calculator ("estimates not credits"); plantation tracker + NGO sapling requests + biofuel pages |
| WS-08 | Engagement modules | robust §7.15, §7.16, §7.12 | Coin wallet/rewards/leaderboard with X11 abuse guards; referral hub with credit-after-first-transaction; women hub on real collections, 4 tabs, rose theme |
| WS-09 | Launcher & global search | robust §7.24 | Zero coming-soon tiles; `GET /v1/search?q=` keyword search across schemes/products/news/crops/courses/lots + grouped results page |

## Out of scope

- Modules owned by other phases: 7.18 news, 7.19 live channels, 7.21 gyan hub
  (phase-04); persona faces per robust §6 (phases 02–03); 7.20 livestock hub
  link-out polish beyond a tile-resolution check (phase-03 owns the consoles).
- Equipment farmer-face rental UI (7.23) — owned by phase-02 WS-04 item 2; this
  phase only verifies the launcher tile resolves to that page.
- Semantic/embeddings search upgrade — phase-06 brief M23.
- Admin-side editors (scheme editor A3, FPO verification A8, NGO sapling
  approval, rate tables, coin mint/burn console) — phase-07; this phase adds
  backend hooks/notes only.
- M26 women SHG readiness AI — phase-08.
- PMKSY/scheme real government-portal integration; real Mahabhulekh adapter —
  labeled placeholders per the phase-00 honesty rule.

## Exit gate (done when)

- [ ] Every §7 module in scope (7.1–7.17 except 7.18/7.19/7.21, plus 7.22–7.24)
  shipped with playbook step 7 verification; zero "coming soon" reachable from
  any module's entry tile.
- [ ] Hardcoded-data modules (women 7.12, climate 7.13, advisory base prices
  7.2) read from real Firestore collections / mandi-linked data.
- [ ] Every new module has en + hi locale pairs and the parity check passes.
- [ ] Every module emits its tasks via the phase-01 task engine and appears in
  the dashboard grid per `website/src/lib/dashboard.ts` ACL matrix.
- [ ] AI briefs M9, M10, M12, M13, M21 registered per SDR/SGR, launch at
  `suggest`, work with `AI_PROVIDER=shim`, and log to `ai_decisions`.
- [ ] `GET /v1/search` returns grouped results across all six indexes.
- [ ] Global verification gate (execution-plan/README.md §4) green.

## Estimated effort

Weeks 6–14, run in parallel with phases 02–04 (robust.md §11 "3. Module sweep").
Suggested order inside the phase: WS-03 → WS-05 → WS-02 → WS-06 → WS-01 →
WS-07 → WS-04 → WS-08 → WS-09 (last — it sweeps up every other module's tile).
