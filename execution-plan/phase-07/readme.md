# Phase 07 — Admin Console (27-module superadmin)

> Build the full superadmin console as a role-gated `/admin/*` section of the
> **website** codebase (dark utilitarian theme — no separate Flutter admin app in
> this program), extending the 483-line `backend/app/routers/admin.py` seed into
> the complete 27-module operational blueprint with six RBAC tiers, immutable
> audit logs, maker-checker safeguards, a real AI-triaged KYC queue, a
> settlements & payout console, an admin copilot, and an AI health page.
> Sources: `missing-features/robust.md` §9 (foundation + P1→P5 module lists),
> §10 (commission config), §11 phase 5 (wks 8–18); `superadmin-instructions.md`
> (root, 27-module master directory + per-module guardrails) and
> `docs/superadmin-instructions/01–27`; AI briefs M11 (KYC extraction & triage),
> M22 (dispute triage), M31 (admin copilot) in
> `missing-features/ai_implementation_plan.md` §5; `missing-features/ai.md`
> §4.1/§4.3 catalog (A8, A9, A12, C14) and flow §5.10.

## Depends on

- **phase-00** (hard dependency): unified admin auth (robust §3.2 — replaces the
  hardcoded dev-ID fallback in `admin.py:_require_admin`), `audit_logs`
  collection conventions, KYC pipeline (`users/{uid}/vault_documents`,
  `kyc_verifications`), settlements engine, and the AI gateway
  `backend/app/services/ai/` (M1) with `question_sets.py`, `privacy.py`,
  `AI_PROVIDER=shim` support.
- **phases 02–06** (soft, may run in parallel): queue surfaces they own —
  fraud/anomaly holds (M8, phase-06), moderation flags (phase-06), dispute
  records from purchases/transport (phase-02), disease-scan clusters (phase-05).
  Where a surface is not yet live, this phase ships the admin view against the
  underlying collection directly with a clearly marked stub-queue fallback
  (empty-state, no fabricated rows).

## Workstreams

| WS | Title | Source | Output (what exists when done) |
|---|---|---|---|
| WS-01 | Foundation: shell, RBAC, grid, safeguards, audit | robust §9 foundation; superadmin-instructions.md §2 | `/admin/*` gated section; 6-tier RBAC enforced server-side; universal data-grid + detail drawer; reason+MPIN two-step; `X-Admin-Role`/`X-Audit-Reason` headers; immutable `audit_logs`; maker-checker >₹10,000 |
| WS-02 | P1 security modules | robust §9 P1; SOP-01/02/03/26; AI brief M11 | Users & personas, sessions, real KYC queue with Gemini vision extraction + `kyc.authenticity_risk.v1` triage, feature flags + app-config/force-update, segment broadcast, moderation queue, DPDP consent audit |
| WS-03 | P2 commercial modules | robust §9 P2; SOP-04–09/25 | Mandi rate approvals (±15% band), lots & B2B deals, marketplace orders/refunds, buyer verification, transport fleet, equipment slots, settlements & payout console (weekly batch run, hold approval) |
| WS-04 | P3 agronomy/AI modules + dispute triage | robust §9 P3; SOP-10/11/12/16/17/23; AI brief M22 | Land-leasing disputes, advisory/disease model ops, chatbot transcripts + prompt config + expert SLA, 7/12 gateway health, water/canal, climate/cold storage; `dispute.triage.v1` routing with SLA clock |
| WS-05 | P4 financial modules | robust §9 P4; SOP-14/15 | Banking/loans oversight with penny-drop override; insurance claims + surveyor assignment + effective-dated rate tables |
| WS-06 | P5 ecosystem modules | robust §9 P5; SOP-18/19/20/21/22/24/27 | FPO verification, vet credentials, content CMS/live/workshops, tree/NGO saplings, gamification mint/burn + referral fraud, women SHGs, instructor course moderation + GMV/commission report |
| WS-07 | Admin copilot | AI brief M31; ai.md C14, flow §5.10 | Whitelisted read-only function-calling tools → `gemini-2.5-pro`; copilot panel; nightly briefing → dashboard card with deep links; every query audit-logged; answers cite data source |
| WS-08 | AI health page | ai_implementation_plan.md §7 | Weekly calibration job (accuracy, confidence-bucket reliability, fallback rate, cost per module); `platform_config/ai` threshold/automation edits behind maker-checker + audit |

## Out of scope

- The Flutter `apps/admin/` app (retired by robust §9 — console lives in `website/` only).
- Building the queue *producers* owned by other phases (fraud detection M8, UGC
  moderation pipelines, dispute creation flows) — this phase consumes their
  collections and ships stub-queue fallbacks when they are not yet live.
- KYC capture UX for end users and the settlements engine itself (phase-00).
- B2B API, load testing, DPDP audit sign-off (phase-08).
- Automation-level raises above `suggest` for any AI feature (needs the
  phase-G gate: ≥1,000 outcomes, >90% top-bucket accuracy).

## Exit gate (done when)

- [ ] All 27 superadmin modules (superadmin-instructions.md §3 directory) reachable at `/admin/*` and functional, with RBAC enforced per tier server-side (403 on cross-tier access proven by tests).
- [ ] Every admin mutation writes an immutable `audit_logs` entry with reason, adminId, module, action, previousState/newState; any action > ₹10,000 requires maker-checker (second admin approval).
- [ ] KYC queue is real (zero hardcoded sample rows): end-to-end from vault document submission → M11 extraction + risk triage → verified/rejected, with masked Aadhaar only (no unmasked Aadhaar in any log, AI payload, or UI).
- [ ] A weekly settlement batch run + hold approval works end-to-end against the phase-00 settlement rails; commission config edits are effective-dated and maker-checkered.
- [ ] Disputes of every type route to the correct RBAC queue via `dispute.triage.v1` with a visible SLA clock.
- [ ] Admin copilot restricted to whitelisted read-only tools (verified by test that a write-capable tool call is rejected); nightly briefing renders on the admin dashboard; all queries audit-logged.
- [ ] Full suite green with `AI_PROVIDER=shim`; no "coming soon" reachable inside `/admin/*`.
- [ ] Global verification gate (execution-plan/README.md §4) green.

## Estimated effort

Weeks 8–18, run in parallel with phases 02–06 (robust.md §11 phase 5).
WS-01 blocks WS-02…WS-08; WS-02→06 may be split across developers after WS-01 lands.

> **Source-note (catalog ID mismatch):** robust.md §9 labels segment broadcast
> "A4" and the moderation queue "A6". In ai.md §4.1, A4 = price sanity band and
> A6 = fraud & collusion; UGC moderation is A12. This phase implements the
> robust §9 features (broadcast by segment = SOP-26; moderation queue = SOP-26
> `user_reports` + A12 flags + A6 fraud soft-hold queue) and treats the ai.md IDs
> as canonical for question-set naming.
