# Phase 08 — Experience AI, Scale & Launch

> Final phase: ship the four remaining experience-AI features (SHG readiness,
> receipt/churn, farmer standing agent, onboarding copilot) on top of the now-real
> data from phases 00–07; earn automation raises through the calibration gate;
> launch the B2B API; harden performance, cost, security, and DPDP compliance;
> and run the full production-ready-beta acceptance. Sources: `missing-features/robust.md`
> §11 Phase 6 row + §8.9 (B2B API) + §10 (pricing validation) + §13 rule 10 (deferral
> sweep); `missing-features/ai_implementation_plan.md` briefs M26, M28, M29, M33,
> §4 rollout phase G gate, §7 testing & calibration, §8 done-when;
> `missing-features/ai.md` §5 flows final validation, §6.1 cost envelope, §7
> trust/calibration/compliance.

## Depends on

ALL prior phases (00–07) exit gates passed. Specifically this phase consumes:
- phase-00: `services/ai/` gateway, `platform_config/ai`, billing/entitlements, money rails, CI gates
- phase-01: task engine (`/v1/tasks`, `emit_task()`), AI-ranked dashboards
- phase-05: real SHG/women-hub collections (robust §7.12), M21 schemes matching, M20 course recommendations
- phase-06: consent center + DPDP export/deletion (gates WS-03), M7 notification intelligence, PWA
- phase-07: admin console (maker-checker, AI Health page surface, audit_logs)

## Workstreams

| WS | Title | Source | Output (what exists when done) |
|---|---|---|---|
| WS-01 | Experience AI features (M26, M28, M29, M33) | ai_implementation_plan.md §5 briefs M26/M28/M29/M33; ai.md §4.3 C2/C7/C16/C17, §5.4 | SHG readiness score card, receipt-scan diary prefill, churn re-engagement, vernacular standing agent (confirm-only), guided onboarding copilot — all live behind flags, suggest-level, shim-green |
| WS-02 | Automation raises & calibration | ai_implementation_plan.md §4 phase G, §7; ai.md §7, §6.1 | Phase-G gate process, golden datasets in CI + nightly live, contract tests, gateway 100 rps load test, weekly calibration → AI Health page, spend review vs §6.1 envelope |
| WS-03 | B2B API platform | robust.md §8.9 (G11), §1 R7 | API keys + scoped read endpoints (mandi data, saturation insights), usage metering, partner billing hooks |
| WS-04 | Performance & cost hardening | robust.md §11 Phase 6, §8.6; ai_implementation_plan.md §6 | Firestore cost audit + index coverage + `ai_decisions` 90-day TTL, website bundle <400 KB first load, backend load tests on critical paths, AI caching audit |
| WS-05 | Compliance & launch readiness | robust.md §3.1/§3.6/§8.4/§10; ai.md §7.4 | DPDP audit report, security sweep clean, TDS/GST verified on staging settlement, legal pages localized, pricing shelf enforced + upgrade→pay→unlock proven per business persona |
| WS-06 | Beta launch checklist & deferral ledger | robust.md §13 rule 10, §11 demo-cut; execution-plan/README.md §5; ai_implementation_plan.md §8 | Signed deferral ledger, ops runbook, rehearsed investor demo-cut, production-ready-beta checklist signed off item by item |

## Out of scope

- Flutter apps (`apps/mobile`, `apps/admin`, `flutter-prototype`) — out of program scope.
- Voice AI (brief M27, features C1/C19) — retired; verify no voice work creeps back in.
- WhatsApp companion bot (C18) — allowed only as a dated deferral note (post-DLT/template approval).
- New personas or modules — anything missing gets a dated deferral, not new scope.
- Auto-execution of standing-agent rules — hard-capped at one-tap confirm in v1 (M29).

## Exit gate (done when)

- [ ] M26/M28/M29/M33 acceptance criteria met (per instructions.md), each behind a `platform_config/ai` module flag, each green with `AI_PROVIDER=shim`
- [ ] Golden datasets for every shipped question set run in CI (shim) + nightly (live) with >5pt regression alerts; weekly calibration job feeding the admin AI Health page
- [ ] Gateway load test: 100 rps decisions, budget trip degrades to fallback cleanly (no errors)
- [ ] Any `suggest → require_confirm` raise has ≥1,000 logged outcomes at >90% top-bucket accuracy + maker-checker approval; credit/insurance/legal still capped
- [ ] B2B API keys + scoped read endpoints live with usage metering (consent center proven first)
- [ ] Website first-load bundle <400 KB; composite indexes cover all shipped queries; `ai_decisions` 90-day TTL active
- [ ] DPDP audit signed; `APP_ENV=prod` backdoor grep clean; CORS locked; secrets in GCP Secret Manager; Sentry alerts live on backend + website
- [ ] TDS 194-O ledger + GST invoices verified on a staging settlement run with real API keys
- [ ] Every robust.md §10 tier enforced by entitlements; upgrade→pay→unlock proven per business persona
- [ ] Deferral ledger: every persona/module/AI catalog ID shipped or dated-deferred in writing (rule 10)
- [ ] execution-plan/README.md §5 "Definition of production-ready beta" checklist fully checked, item by item
- [ ] ai_implementation_plan.md §8 done-when fully checked: every active AI ID live behind flags or dated-deferred, all persona dashboards AI-ranked, flows 5.1–5.10 work end-to-end on the website, spend metered/capped, weekly calibration running, full suite green with `AI_PROVIDER=shim`
- [ ] Investor demo-cut rehearsed end-to-end: farmer lot → vyapari escrow payment → transporter POD → commission settlement → dashboard task story → dairy Pro upgrade
- [ ] Global verification gate (execution-plan/README.md §4) green

## Estimated effort

Weeks 16–20 (robust.md §11 Phase 6 "Scale & moat" — runs after all other phases).
