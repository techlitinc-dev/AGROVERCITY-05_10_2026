# AGROVERCITY — Unified Execution Plan → Production-Ready Beta

> Generated 2026-10-03 by merging three source documents:
> - `missing-features/robust.md` — SaaS conversion blueprint (Phases 0–6, personas §6, modules §7, hard rules §13)
> - `missing-features/ai.md` — AI-first vision (feature catalog A1–A13, B1–B17, C2–C20; flows §5)
> - `missing-features/ai_implementation_plan.md` — AI execution (foundation §1, question sets §2, recipes SDR/SGR §3, agent briefs M1–M33 §5)
>
> **Scope:** `backend/` (FastAPI + Firestore) and `website/` (React + TS + Vite) ONLY.
> Flutter apps (`apps/mobile`, `apps/admin`, `flutter-prototype`) are out of scope.
> Voice AI is descoped (brief M27, features C1/C19 retired).
>
> **End state:** after all 9 phases pass their exit gates, AGROVERCITY is a robust,
> production-ready beta — every persona app functional, all 24 modules shipped,
> real money rails, SaaS billing live, AI-ranked dashboards, admin console
> operational, and the full test suite green.

---

## 1. How this plan works

- 9 phase folders: `phase-00/` … `phase-08/`.
- Each folder contains three files:
  - **`readme.md`** — the contract: goal, dependencies, workstream overview, out-of-scope, and the **exit gate checklist** that must pass before the phase is called done.
  - **`instructions.md`** — the build sheet: self-contained, step-by-step workstream instructions (goal → files to read → numbered steps → acceptance criteria → verification), the full reference behind every task.
  - **`tasks.md`** — the execution queue: the instructions decomposed into atomic checkboxed tasks (`DO / RUN / EXPECT / IF FAIL`) for a basic executor agent. Execute top to bottom under the protocol in **`AGENT_PLAYBOOK.md`** (read that first — it defines the task loop, hard rules, stop conditions, and resume procedure).
- Workstreams inside a phase are numbered `WS-01`, `WS-02`, … and are ordered by internal dependency.
- Source-traceability: every workstream cites its source sections (e.g. `robust.md §3.3`, `AI brief M16`) so nothing is dropped silently. Per robust.md §13 rule 10: every module/persona/brief either ships or gets an explicit dated deferral note — silence is not allowed.

## 2. Phase map

| Phase | Title | Contents | Depends on |
|---|---|---|---|
| `phase-00` | SaaS Foundation & Hardening + AI Foundation | robust.md §3.1–3.6 (security, auth, money rails, KYC, billing, plumbing, test repair, CI) + AI brief M1 (gateway) | — (blocks everything) |
| `phase-01` | Universal Action Dashboard + Conversational AI | robust.md §4 (task engine + Action Center) + AI briefs M5 (task ranking), M2 (Kisan Mitra 2.0) | 00 |
| `phase-02` | Trade & Logistics Spokes Close-out | robust.md §6.2 Landlord, §6.3 Transporter, §6.4 Vyapari, §6.5 Equipment Owner, §6.6 Broker + AI briefs M4, M16, M19, M24, M25 | 00, 01 |
| `phase-03` | Finance & Ops Console Personas | robust.md §6.7 Dairy, §6.9 Direct Buyer, §6.11 Bank, §6.12 Insurance, §6.13 Cold Storage, §6.14 Gaushala+Vet + AI briefs M14, M15, M17, M18 | 00, 01 |
| `phase-04` | Knowledge & Consumer Personas | robust.md §6.8 Instructor, §6.10 e-Market Customer, §7.18 News, §7.19 Live Channels, §7.21 Gyan Hub + AI brief M20 | 00, 01 |
| `phase-05` | Platform Module Sweep (24 modules) | robust.md §7.1–7.17, §7.22–7.24 (all modules not covered by phases 02–04) + AI briefs M9, M10, M12, M13, M21 | 00, 01 |
| `phase-06` | Cross-Cutting Platform Services | robust.md §8.1–8.8 (chat hub, notifications, trust & safety, consent/privacy, support, PWA/offline, i18n, analytics) + AI briefs M6, M7, M8, M23, M30, M32 | 01 |
| `phase-07` | Admin Console (27-module superadmin) | robust.md §9 (P1→P5 build order) + AI briefs M11 (KYC triage), M22 (dispute triage), M31 (admin copilot) | 00 |
| `phase-08` | Experience AI, Scale & Launch | AI briefs M26, M28, M29, M33 + AI plan §7 calibration standing requirements + robust.md §11 Phase 6 (B2B API §8.9, performance, Firestore cost audit, load testing, DPDP audit, launch checklist) | all |

**Execution order:** 00 → 01 are strictly sequential (they block everything).
Phases 02, 03, 04, 05, 06, 07 may run in parallel teams after 01 lands.
Phase 08 runs last. Within each phase, execute workstreams in numbered order.

## 3. Global rules (binding on every phase — repeat in each instructions.md)

From robust.md §13 + ai_implementation_plan.md §0, merged:

1. No new demo backdoors; no `?? <hardcoded>` fallbacks in new code; dev fixtures gated behind `APP_ENV=dev` / `AI_PROVIDER=shim`.
2. No persona feature without a `farmerId` linkage story (farmer is the sun; all personas are planets).
3. No money movement outside the escrow/settlement rails; integer paisa everywhere; every financial mutation writes `audit_logs`; maker-checker for manual overrides > ₹10,000.
4. No phone numbers, UPI IDs, or external links in any chat surface (moderation regex + strike ladder).
5. No paywall on the farmer's core grow-sell-insure loop.
6. No English-only screens — `t()` keys with en + hi at ship time; no `alert()`/`prompt()`/`confirm()` in new UI.
7. No endpoint without the standard error envelope `{"error":{code,...}}`, real cursor pagination, and (for writes) `Idempotency-Key` support.
8. No admin action without an `audit_logs` entry + reason.
9. Backend test suite must be green before any phase is called done.
10. All model calls go through `backend/app/services/ai/gateway.py` — never call OpenRouter/Gemini from routers; every decision point has a deterministic fallback; the app fully works with `AI_PROVIDER=shim`; CI never calls paid APIs.
11. No Aadhaar (unmasked), phone numbers, or emails in any AI payload; every AI call logged to `ai_decisions` with cost + confidence.
12. AI automation levels: `suggest → require_confirm → auto`; credit/insurance/legal never exceed `require_confirm`; new AI features always launch at `suggest`.

## 4. Global verification gate (run at every phase exit)

```bash
cd backend && .venv/bin/python -m pytest -q          # fully green
cd website && pnpm exec tsc --noEmit && pnpm build   # clean
# locale parity check (en/hi key parity) — see phase-06 for the CI gate
# AI: full suite green with AI_PROVIDER=shim
# Manual: at least one end-to-end user flow per workstream, exercised from the
# dashboard task deep-link to completion — no "coming soon" reachable.
```

## 5. Definition of "production-ready beta" (final acceptance, phase-08 exit)

1. All 8 phase exit gates passed; every persona (robust.md §6.1–6.14) runs its core loop end-to-end on the website with zero offline steps.
2. All 24 platform modules (robust.md §7) resolve to real pages — zero "coming soon" tiles in the tools launcher; global search live.
3. Real money: Razorpay order/verify/webhook, escrow release on handover OTP, weekly RazorpayX settlement payouts, TDS 194-O ledger, GST invoices — all exercised in staging with real API keys.
4. SaaS billing live: plans/subscriptions/entitlements enforced; at least one upgrade prompt → paid subscription → entitlement unlock flow proven per business persona tier matrix (robust.md §10).
5. AI: every active catalog ID (A1–A13, B1–B17, C2–C20) live behind flags or dated-deferred; all persona dashboards AI-ranked; `ai_decisions` logging + budgets + weekly calibration running; full suite passes with `AI_PROVIDER=shim`.
6. Admin console: 27 superadmin modules operational with RBAC, audit logs, maker-checker; KYC queue real (no hardcoded samples).
7. Cross-cutting: chat hub with guardrails, push notifications with deep links, consent center + DPDP export/deletion, installable PWA, en/hi parity gate in CI, analytics taxonomy live.
8. Hardening: no demo backdoor reachable with `APP_ENV=prod`; CORS locked to real origins; Sentry on backend + website; load test passed; DPDP audit done; launch checklist signed off.

## 6. File templates

### `phase-XX/readme.md` template

```markdown
# Phase XX — <Title>

> One-paragraph goal. Sources: <robust.md/ai.md sections, AI brief IDs>.

## Depends on
<phase(s) and what specifically they provide>

## Workstreams
| WS | Title | Source | Output (what exists when done) |
|---|---|---|---|

## Out of scope
<explicit non-goals for this phase>

## Exit gate (done when)
- [ ] <checkable item>
- [ ] Global verification gate (execution-plan/README.md §4) green

## Estimated effort
<weeks, from robust.md §11 roadmap where applicable>
```

### `phase-XX/instructions.md` template

```markdown
# Phase XX — <Title> — Build Instructions

> Self-contained execution sheet. Read the phase readme.md first.
> Global rules (execution-plan/README.md §3) apply to every workstream —
> repeat the ones most at risk of violation inline per workstream.

## Repo orientation
- Backend: FastAPI + Firestore — routers `backend/app/routers/`, services
  `backend/app/services/`, tests `backend/tests/`.
- Website: React + TS + Vite — API wrappers `website/src/lib/api/`, views
  `website/src/views/`, i18n `t()` in `website/src/lib/i18n/`, persona/module
  registry `website/src/lib/dashboard.ts`, routes in `website/src/App.tsx`.
- Verify every path you cite exists (Glob/Read) before writing it down.

## WS-01 — <title>
**Source:** <sections> · **Goal:** <one line>
**Read first:** <exact file paths>
**Steps:**
1. …
**Acceptance:** <measurable criteria>
**Verification:** <commands + manual flow>

## WS-02 …

## Phase-final verification
<full gate + phase-specific manual flows>
```
