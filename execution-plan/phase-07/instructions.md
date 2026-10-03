# Phase 07 — Admin Console (27-module superadmin) — Build Instructions

> Self-contained execution sheet. Read the phase readme.md first.
> Global rules (execution-plan/README.md §3) apply to every workstream —
> repeat the ones most at risk of violation inline per workstream.

## Repo orientation

- Backend: FastAPI + Firestore — routers `backend/app/routers/`, services
  `backend/app/services/`, tests `backend/tests/`. Admin seed router:
  `backend/app/routers/admin.py` (483 lines: `/admin` prefix, `_require_admin`,
  overview, users list/status, hardcoded KYC queue, expert handoffs, course
  moderation + report, e-market analytics, loan queue). Existing tests:
  `backend/tests/test_admin.py`, `backend/tests/test_admin_finance.py`.
- Website: React + TS + Vite — API wrappers `website/src/lib/api/`, views
  `website/src/views/`, i18n `t()` in `website/src/lib/i18n/` (locales in
  `website/src/lib/i18n/locales/`, en + hi mandatory), routes in
  `website/src/App.tsx`. **No admin section exists yet** — `/admin/*` shell,
  `website/src/lib/api/admin.ts`, and `website/src/views/admin/` are all new.
- AI gateway (`backend/app/services/ai/` with `gateway.py`, `question_sets.py`,
  `privacy.py`) is built by phase-00/M1. All model calls go through it
  (`gateway.decide` / `gateway.generate`) — never call Gemini/Jev from routers.
- Blueprint docs: `superadmin-instructions.md` (root, §3 master directory of 27
  modules with roles + collections) and per-module SOPs in
  `docs/superadmin-instructions/NN-*.md` (each defines UI path, collections,
  capabilities, endpoint table, guardrails).
- Verify every path you cite exists (Glob/Read) before writing it down.

**RBAC tiers (from superadmin-instructions.md §2.1, canonical):** `superadmin`
(unrestricted), `compliance_officer` (KYC, fraud, lockouts, disputes),
`finance_admin` (bank verification, settlements, payouts, refunds, loans),
`agronomist` (alias `scientist`: disease model, pest radar, advisory),
`operations_lead` (fleet, equipment, cold storage, mandi rates),
`content_moderator` (CMS, live channels, workshops, reports, gamification).

**Audit log schema (superadmin-instructions.md §2.3, canonical):**
`{id, adminId, adminEmail, module, action, targetId, previousState, newState,
reason, timestamp, ipAddress}` in collection `audit_logs` — immutable
(no update/delete path anywhere).

## WS-01 — Foundation: shell, RBAC, grid, safeguards, audit

**Source:** robust.md §9 (Foundation bullet); superadmin-instructions.md §2.1–2.3 · **Goal:** the `/admin/*` chassis every other workstream plugs into.

**Read first:** `backend/app/routers/admin.py`, `backend/app/core/deps.py`,
`backend/app/core/db.py`, `website/src/App.tsx`, `website/src/lib/api/client.ts`,
`website/src/lib/i18n/index.ts`, `superadmin-instructions.md` §2.

**Steps:**
1. Backend — RBAC dependency. Replace `_require_admin`'s hardcoded dev-ID
   fallback (`"admin-root", "uid-admin", "admin-demo"`) with the phase-00
   unified admin auth: read the admin role from the user's admin profile /
   custom claim into `user["adminRole"]`. Add
   `require_admin_role(*roles)` in `backend/app/services/users.py` (or a new
   `backend/app/services/admin_auth.py` (new)) returning 403
   `{"error":{"code":"FORBIDDEN_ADMIN_ROLE"}}` when the caller's tier is not in
   the allowed set. Remove the dev-ID bypass entirely (global rule 1).
2. Backend — admin request context middleware/dependency: read headers
   `X-Admin-Role` (must match the server-resolved role, else 403) and
   `X-Audit-Reason` (mandatory, min_length=3, on every mutating endpoint);
   capture client IP into the audit record.
3. Backend — shared audit helper `log_admin_action(admin, module, action,
   target_id, previous, new, reason, ip)` (new, e.g.
   `backend/app/services/audit.py`) writing the canonical `audit_logs` schema.
   Refactor the existing ad-hoc audit writes in `admin.py` to use it and to
   include `module`, `previousState`, `newState`, `ipAddress`.
4. Backend — maker-checker service (new): any action whose payload amount
   exceeds ₹10,000 (1,000,000 paisa — integer paisa everywhere, global rule 3)
   creates a `admin_approvals` doc `{id, action, module, payload, requestedBy,
   status: "pending", reason}` instead of executing; a second admin (different
   `adminId`) calls `POST /admin/approvals/{id}/approve|reject`; execution
   happens only after approval, both events audit-logged. Endpoint:
   `GET /admin/approvals?status=pending`.
5. Website — `/admin/*` section (all new): `website/src/views/admin/AdminShell.tsx`
   with dark utilitarian theme (`website/src/theme/admin.css` (new)), nav grouped
   P1–P5 per the 27-module directory; route guard that reads the admin role
   from the session and hides/forbids disallowed modules; routes registered in
   `website/src/App.tsx`.
6. Website — universal data-grid component
   `website/src/views/admin/components/DataGrid.tsx` (new): search, status
   chips (`all/pending/approved/flagged/rejected`), server-side
   `page`/`pageSize` pagination, sort, bulk-select checkboxes for batch actions;
   detail drawer `DetailDrawer.tsx` (new) showing raw entity JSON + audit
   history (from `GET /admin/audit?targetId=…`) + action buttons.
7. Website — two-step safeguard modal `ConfirmActionModal.tsx` (new): mandatory
   reason field + admin MPIN re-entry for destructive actions (ban, refund,
   payout release, override); MPIN verified via a backend
   `POST /admin/verify-mpin` endpoint. No `alert()/confirm()` (global rule 6).
8. Website — `website/src/lib/api/admin.ts` (new) typed wrapper attaching
   `X-Admin-Role` + `X-Audit-Reason` headers on every mutation.
9. i18n: all admin UI strings via `t()` with en + hi pairs at ship time
   (global rule 6).
10. Tests: `backend/tests/test_admin_rbac.py` (new) — each tier vs each module
    endpoint matrix (403/200); mutation without `X-Audit-Reason` → 422;
    maker-checker flow > ₹10,000 requires second approver and same-admin
    self-approval is rejected.

**Acceptance:** every existing `/admin/*` endpoint passes through the new RBAC +
audit helpers; 6-tier matrix enforced server-side; maker-checker blocks and
then executes a >₹10,000 override with two distinct admins; grid/drawer/modal
render with en+hi parity.

**Verification:** `cd backend && .venv/bin/python -m pytest -q` green;
`cd website && pnpm exec tsc --noEmit && pnpm build` green. Manual: log in as
`finance_admin` → KYC endpoints return 403; submit a user-status change without
reason → blocked; with reason + MPIN → succeeds and appears in
`GET /admin/audit`.

## WS-02 — P1 security modules (users, KYC + M11, sessions, flags, broadcast, moderation, DPDP)

**Source:** robust.md §9 P1; SOP-01/02/03/26; AI brief M11; ai.md A8 · **Goal:** real security/compliance queues, hardcoded samples eliminated.

**Read first:** `backend/app/routers/admin.py` (KYC queue to replace),
`backend/app/routers/vault.py` (`users/{uid}/vault_documents`),
`backend/app/routers/users.py` (role_profiles),
`backend/app/routers/app_config.py`, `backend/app/services/consents.py`,
`docs/superadmin-instructions/01-…`, `02-…`, `03-…`, `26-…`,
`missing-features/ai_implementation_plan.md` §3 (SDR/SGR) + M11.

**Steps:**
1. Users & personas (SOP-02): keep/extend `GET /admin/users` (persona, status,
   search, page/pageSize) and `POST /admin/users/{uid}/status`; add role-profile
   drill-down (linkedProfiles, `users/{uid}/role_profiles`) in the detail
   drawer. Roles: `superadmin, operations_lead`.
2. Sessions (SOP-01): `GET /admin/auth/users` (login history, IP),
   `POST /admin/auth/users/{uid}/reset-mpin` (temp OTP),
   `POST /admin/auth/users/{uid}/revoke-sessions` (revoke refresh tokens,
   `auth_tokens`/`sessions` collections). Roles: `superadmin,
   compliance_officer`. All mutations reason + audit.
3. Real KYC queue (SOP-03 + M11) — SDR/SGR recipe:
   a. Register question sets in `backend/app/services/ai/question_sets.py`:
      `kyc.extract.v1` (G, Gemini vision) and `kyc.authenticity_risk.v1` (J,
      threshold risk < 0.3, fallback = always route to human queue).
   b. On vault document upload (hook into `routers/vault.py` upload flow):
      `gateway.generate` vision call extracts fields into per-doc-type Pydantic
      schemas (`KYCAadhaarExtract`, `KYCLand712Extract`, `KYCMandiLicenseExtract`
      … (new, `backend/app/services/ai/kyc_schemas.py`)); Aadhaar stored masked
      only (`XXXX-XXXX-1234`) — no unmasked Aadhaar in any AI payload, log, or
      DB write (global rule 11, SOP-01 §6.4).
   c. `gateway.decide(state, "kyc.authenticity_risk.v1", ctx)` scores risk from
      extraction consistency (name/DoB vs profile, doc age, image-quality
      signals); state built via `privacy.py` (pseudonymized).
   d. risk < 0.3 → auto-advance doc to `verified-pending-bank`; else → human
      queue with extracted fields + risk reasons attached. Automation level
      `suggest`→ this auto-advance is the M11-specified behavior; never
      auto-reject.
   e. Replace the hardcoded `GET /admin/kyc/queue` array with a real query over
      `users/{uid}/vault_documents` where status pending + `kyc_verifications`;
      add `GET /admin/kyc/pending`, `POST /admin/kyc/{id}/verify`,
      `POST /admin/kyc/{id}/reject` (reason mandatory),
      `GET /admin/kyc/history` per SOP-03 §5. Queue rows show AI extraction +
      risk reasons; side-by-side doc preview with zoom in the drawer.
   f. Golden fixtures at `backend/tests/fixtures/ai/golden/` for extraction;
      extraction precision ≥ 90% on the golden doc set; tests pass on shim.
4. Feature flags + app-config (SOP-26): admin CRUD over feature flags and
   `app_config` (minimum supported app version → force-update splash).
   `PUT` edits are maker-checkered config changes; all audit-logged.
5. Segment broadcast (SOP-26, robust §9 "A4"): `POST /admin/broadcasts`
   targeting a segment (persona/district/crop) → creates `broadcasts` doc +
   fan-out via notifications service. Reason mandatory.
6. Moderation queue (SOP-26): unified queue over `user_reports` plus A12 UGC
   flags and A6 fraud soft-holds when phase-06 surfaces exist — otherwise
   render the queue over `user_reports` with empty-state sections for the AI
   feeds (stub-queue fallback, no fabricated rows). Actions: dismiss / warn /
   suspend (suspend routes through WS-01 safeguards).
7. DPDP consent audit: read-only view over the consent records
   (`backend/app/services/consents.py`): per-user consent timeline, withdrawal
   events, export/deletion request status. `compliance_officer` + `superadmin`.

**Acceptance:** zero hardcoded rows in any P1 queue; a doc upload flows
upload → extraction → risk → auto-advance (risk < 0.3) or human queue with
reasons; no unmasked Aadhaar anywhere (grep test over logs/fixtures); manual
review path unchanged from SOP-03; flags/app-config edits maker-checkered;
broadcast creates exactly one `broadcasts` doc + audit entry.

**Verification:** `pytest -q` green incl. new `test_admin_kyc.py` (golden
extraction on shim, risk-threshold routing, masked-Aadhaar assertion);
`pnpm build` green. Manual: upload a 7/12 PDF in dev → appears in
`/admin/kyc` with AI fields → approve with reason → verified badge on user.

## WS-03 — P2 commercial modules (mandi, lots, orders, buyers, fleet, equipment, settlements)

**Source:** robust.md §9 P2 + §10; SOP-04–09, SOP-25 · **Goal:** commercial oversight incl. the payout console.

**Read first:** `backend/app/routers/mandi.py`, `lots.py`, `marketplace.py`,
`orders.py`, `direct_buyer.py`, `transport.py`, `equipment_owner.py`,
`settlements.py`, `backend/app/services/settlements.py`,
`docs/superadmin-instructions/04-…` through `09-…`, `25-…`.

**Steps:**
1. Mandi rate approvals (SOP-04): queue of `vyapari_rates` submissions;
   validate against the **±15% sanity band of the Agmarknet modal price**
   (auto-flag outside band); approve/reject with reason. Roles:
   `operations_lead, finance_admin, superadmin`.
2. Lots & B2B deals (SOP-05): read/audit grid over `market_lots`, `deals`,
   `procurements`; dispute escalation hook (feeds WS-04 triage).
3. Marketplace orders/refunds (SOP-06): orders grid (extend existing
   `/admin/analytics/emarket` data), refund action — refunds move money only
   through the escrow/settlement rails, integer paisa, `Idempotency-Key`
   required (global rules 3, 7); > ₹10,000 → maker-checker.
4. Corporate buyer verification (SOP-07): verify institutional buyers
   (`buyer_contracts`), approve/suspend.
5. Transport fleet (SOP-08): vehicle document verification (RC, insurance,
   fitness) over `vehicles`; suspend transporter.
6. Equipment slots (SOP-09): `equipment`, `equipment_slots`,
   `equipment_bookings` oversight; slot-dispute arbitration → WS-04 queue.
7. Settlements & payout console (SOP-25, robust §9 A5-note):
   `GET /admin/settlements?status=pending|approved|paid`,
   `POST /admin/settlements/{id}/mark-paid` (payment ref mandatory),
   `POST /admin/jobs/settlements/run` (manual weekly batch with custom
   start/end), `PUT /admin/platform-config/commissions` (effective-dated,
   versioned edits to `platform_config/settlements` — defaults Transporter 10%,
   Equipment 12%, Broker 2%; maker-checker + audit). Hold approvals include
   M8 anomaly holds from phase-06 — if not live, show the holds section as an
   empty-state stub over the `settlements` hold status. Payout approvals
   > ₹50,000 require dual-admin sign-off (SOP-25 §6.3); all money mutations
   integer paisa + audit (global rule 3). Monitor `cron_job_logs` execution
   status in the console.

**Acceptance:** out-of-band mandi rate flagged automatically; refund honors
idempotency (duplicate key → same result, no double movement); a weekly batch
run produces settlement rows and a hold can be approved through maker-checker;
commission edit is versioned with effective date and two audit entries.

**Verification:** `pytest -q` green incl. new settlement-console tests (batch
run, mark-paid with ref, maker-checker threshold at ₹10,000, dual sign-off at
₹50,000). Manual: run a batch in dev → approve one hold with reason + MPIN →
`mark-paid` with ref → row shows paid, audit trail complete.

## WS-04 — P3 agronomy/AI modules + M22 dispute triage

**Source:** robust.md §9 P3; SOP-10/11/12/16/17/23; AI brief M22; ai.md A9 · **Goal:** agronomy ops queues + one triaged dispute inbox.

**Read first:** `backend/app/routers/land.py`, `advisory.py`, `chatbot.py`,
`land_records.py`, `water.py`, `climate.py`, `purchases.py`, `transport.py`,
`backend/app/services/disease_model/`, `docs/superadmin-instructions/10-…`,
`11-…`, `12-…`, `16-…`, `17-…`, `23-…`, M22 brief.

**Steps:**
1. Land-leasing disputes (SOP-10): grid over `land_plots`, `land_leases`,
   `land_lease_payments`; cross-check listings against `land_records_712`;
   dispute actions resolve through the dispute console below.
2. Advisory/disease model ops (SOP-11): `advisory_scans` accuracy monitor
   (feedback false-positive rate), `pest_alerts` dispatch, `soil_tests`
   validation. Roles: `agronomist`/`scientist`.
3. Chatbot ops (SOP-12): `chatbot_sessions`/`chatbot_messages` transcript
   viewer (safety review), prompt-config editor (maker-checkered config write),
   `expert_tickets` roster with **SLA tracking** — extend existing
   `/admin/expert-handoffs` list/resolve with SLA breach highlighting and an
   `experts` roster editor.
4. 7/12 gateway health (SOP-16): availability/latency dashboard for the
   `land_records` integration (read `backend/app/services/land_records/`
   health signals; if none exist, record probe results into a
   `gateway_health` collection via a scheduled job (new)).
5. Water/canal (SOP-17): `canal_schedules`, `water_schedules` rotation editor.
6. Climate/cold storage (SOP-23): `cold_storages` directory manager (capacity
   MT, temperature ranges, monthly rates), `climate_varieties` oversight.
7. **M22 dispute triage** — SDR recipe:
   a. Register `dispute.triage.v1` in `question_sets.py` (schema: category,
      urgency, liability hint; fallback = route to `operations_lead` queue,
      urgency medium).
   b. Unified `disputes` collection (new) — adapters ingest dispute records
      from purchases, transport, land-leasing, equipment surfaces
      (`routers/purchases.py`, `routers/transport.py`); where a phase-02/03
      surface is not yet live, its adapter ships behind an empty-state stub.
   c. On dispute open: `gateway.decide(state, "dispute.triage.v1", ctx)` →
      routed to the correct RBAC queue (`compliance_officer` /
      `finance_admin` / `operations_lead`) with an SLA clock
      (`slaDueAt` on the doc; breach highlighting in the grid).
   d. Admin detail drawer shows the AI summary + evidence links; human
      decision flow unchanged (AI is `suggest`-level: routing annotation only).
   e. Tests: every dispute type lands in the correct queue on shim; SLA field
      present; fallback routing on gateway exception.

**Acceptance:** all six module views live with correct tier gating; a dispute
opened from any surface routes to the correct queue with SLA visible and AI
summary in the drawer; chatbot prompt edits are maker-checkered.

**Verification:** `pytest -q` green incl. `test_admin_disputes.py` (routing
matrix on shim, fallback test with gateway raising); full suite green with
`AI_PROVIDER=shim`. Manual: open a transport dispute in dev → appears in
`operations_lead` queue with SLA clock → resolve → audit entry written.

## WS-05 — P4 financial modules (banking/loans, insurance)

**Source:** robust.md §9 P4; SOP-14/15 · **Goal:** finance_admin + compliance_officer financial oversight.

**Read first:** `backend/app/routers/admin.py` (existing `/admin/finance/loans`),
`backend/app/services/loans.py`, `backend/app/services/bank_verify/`,
`backend/app/routers/insurance_claims.py`, `backend/app/services/claims.py`,
`docs/superadmin-instructions/14-…`, `15-…`.

**Steps:**
1. Banking oversight (SOP-14): grid over `bank_accounts` penny-drop
   verification failures; **override action** marks a failed-but-valid account
   verified — destructive → reason + MPIN + audit; money-affecting overrides
   > ₹10,000 maker-checkered. `kcc_records` viewer.
2. Loans: keep existing `/admin/finance/loans` queue + status transitions via
   `loans_service.advance_status`; add note-required enforcement and the
   shared audit helper; credit decisions never exceed `require_confirm`
   automation (global rule 12) — no auto-approve anywhere in this console.
3. Insurance claims (SOP-15): claims desk over `insurance_policies`,
   `insurance_claims` — review intimated claims, **assign surveyor**
   (`assign_surveyor` with `surveyorName`), approve with `approvedAmount`
   (integer paisa), reject with reason; extend the existing
   `ClaimAdjudicateIn` flow onto the shared audit + maker-checker helpers.
4. Rate tables (SOP-15): `insurance_rates` editor with **effective dating**
   (rows versioned: `{rate, effectiveFrom, effectiveTo, createdBy}`); edits
   maker-checkered.

**Acceptance:** penny-drop override requires reason + MPIN and writes a full
previousState/newState audit; surveyor assignment visible on claim; two
overlapping rate-table rows cannot exist for the same product/date; invalid
loan transitions still 409 (existing tests stay green).

**Verification:** `pytest -q` green (existing `test_admin_finance.py` must not
regress; add rate-table effective-dating tests). Manual: fail a penny-drop in
dev → override as `finance_admin` → audit shows reason + MPIN-gated.

## WS-06 — P5 ecosystem modules (FPO, vets, CMS, trees, gamification, SHGs, courses)

**Source:** robust.md §9 P5; SOP-18/19/20/21/22/24/27 · **Goal:** remaining seven ecosystem modules.

**Read first:** `backend/app/routers/fpo.py`, `livestock_vets.py`, `content.py`,
`courses.py`, `tree.py`, `gamification.py`, `referrals.py`, `women.py`,
`backend/app/services/coins.py`, `backend/app/services/referrals.py`,
`docs/superadmin-instructions/18-…` through `27-…`.

**Steps:**
1. FPO verification (SOP-18, robust §9 "A8-note"): verify FPO registration
   (ROC/Nabard/SFAC certificates) over `fpos`; approve/reject; pool oversight
   (`fpo_pools`, `fpo_pool_members`).
2. Livestock/vet credentials (SOP-19, module 19): verify vet qualifications
   (B.V.Sc degree, State Veterinary Council registration) over `vets`;
   `gaushalas`/`nurseries` directory oversight.
3. Content CMS / live channels / workshops (SOP-20, module 20): publish, edit,
   schedule `agri_news` (breaking-news tags), `agri_channels` stream
   moderation, `workshops` curation. Role: `content_moderator`.
4. Tree/NGO saplings (SOP-21, module 21): verify NGOs/nurseries (`ngos`);
   review sapling requests; `biofuel_trees` oversight.
5. Gamification mint/burn + referral fraud (SOP-22, module 22): platform-wide
   AgriCoins circulation dashboard (daily mint/burn totals from
   `agri_coins_ledger`), manual adjust (maker-checkered, integer coins, audit),
   referral-fraud review queue (A6 soft-holds when phase-06 live, else
   empty-state stub) over `reward_coupons` + referral records.
6. Women SHGs (SOP-24): verify SHG registration docs, bank accounts, cluster
   federation linkage over `women_shgs`, `shg_deposits`, `home_enterprises`.
7. Instructor course moderation (SOP-27, module 27): existing
   `/admin/courses/queue`, `/review` (publish/reject with reason),
   `/feature`, `/report` (GMV, commission, instructor earnings) — migrate to
   the WS-01 helpers (RBAC `superadmin, compliance_officer` per SOP-27,
   shared audit, reason enforcement) without changing behavior.

**Acceptance:** all seven modules reachable under correct tiers; coin
adjustment requires second admin above the ₹10,000-equivalent threshold;
course report numbers unchanged after the helper migration (regression test).

**Verification:** `pytest -q` green (existing admin course tests must not
regress). Manual: as `content_moderator` publish a news article; as
`finance_admin` confirm CMS routes 403.

## WS-07 — Admin copilot (M31)

**Source:** AI brief M31; ai.md C14 + flow §5.10 · **Goal:** natural-language ops queries + daily briefing, read-only.

**Read first:** `backend/app/routers/admin.py`, `backend/app/routers/analytics.py`,
`backend/app/services/ai/` (gateway from phase-00), ai_implementation_plan.md
§3 SGR + §5.0.

**Steps:**
1. Backend (new `backend/app/services/copilot.py` + `routers/admin_copilot.py`
   (new)): define a **whitelist of read-only query tools** as a
   function-calling schema: `get_kyc_backlog(by_state)`, `get_settlement_holds`,
   `get_fraud_queue`, `get_scan_clusters(district, crop)`. Each tool is a plain
   read-only function over Firestore (no writes possible by construction).
2. SGR recipe: `gateway.generate(prompt, model=pro, json_schema=…)` targeting
   `gemini-2.5-pro`; validate tool-call output with Pydantic; one repair retry;
   fallback = static template text (en/hi) listing the four canned queries.
3. Endpoint `POST /admin/copilot/query` (superadmin + all tiers, scoped: tools
   return only data the caller's role may see) — executes whitelisted tool,
   composes the answer, **writes every query + tools-called to `audit_logs`**
   and `ai_decisions` with cost + confidence (global rules 8, 11).
4. Nightly briefing job (new, scheduled): aggregates the four tools into a
   briefing doc `admin_briefings/latest` in the shape of ai.md §5.10
   ("KYC backlog 34 (MH 22), 2 payout anomalies held, disease cluster in Nashik
   onion"); each item carries a deep link to its queue with AI pre-triage
   attached. Generation must complete in < 60s.
5. Website: copilot panel `website/src/views/admin/CopilotPanel.tsx` (new) —
   chat-style query box + answer cards that **cite their data source** (tool
   name + as-of timestamp); dashboard card `BriefingCard.tsx` (new) on the
   admin home rendering `admin_briefings/latest` with deep links.
6. Guardrail test: register a fake write-capable tool in a test and assert the
   dispatcher rejects it (only whitelisted read-only tools can execute).

**Acceptance:** copilot answers only via the four whitelisted tools; every
query audit-logged; answers show data source; briefing generates < 60s and
renders on the admin dashboard with working deep links; works fully with
`AI_PROVIDER=shim` (canned shim tool-calls).

**Verification:** `pytest -q` green incl. `test_admin_copilot.py` (whitelist
enforcement, audit logging, shim path); `pnpm build` green. Manual: ask "show
KYC backlog by state" → answer with source citation → click briefing item →
lands in the right queue.

## WS-08 — AI health page + calibration

**Source:** ai_implementation_plan.md §7 (standing requirements) · **Goal:** weekly calibration surfaced to admins; AI config governed.

**Read first:** `backend/app/services/ai/` (gateway, `ai_decisions` logging
from phase-00), `missing-features/ai_implementation_plan.md` §7.

**Steps:**
1. Weekly calibration job (new `backend/app/services/ai/calibration.py` +
   scheduler entry): aggregates `ai_decisions` into per-question-set metrics —
   **accuracy** (against outcome hooks), **confidence-bucket reliability**,
   **fallback rate**, **cost per module** → writes
   `ai_calibration/weekly-YYYY-WW` docs. Nightly live-model regression alert
   threshold: accuracy drop > 5 pts (job flags it; alerting wiring may be a
   log line + dashboard badge in this phase).
2. Admin "AI Health" page (new `website/src/views/admin/AiHealthPage.tsx` +
   `GET /admin/ai/health`): per-module table of the four metrics + trend vs
   previous week; golden-set versions listed (`backend/tests/fixtures/ai/golden/`).
3. `platform_config/ai` editor: question-set thresholds and automation levels
   editable from the AI Health page — every edit goes through WS-01
   maker-checker + audit (ai_implementation_plan.md §7 mandate); automation
   levels capped: credit/insurance/legal never above `require_confirm`; new
   features at `suggest` (global rule 12) — enforce in the config validator.

**Acceptance:** calibration doc produced for the current week with all four
metric families; a threshold edit requires second-admin approval and appears
in `audit_logs` with previous/new state; validator rejects an attempt to set
a credit decision to `auto`.

**Verification:** `pytest -q` green incl. calibration-job unit tests (fixture
`ai_decisions` → expected aggregates). Manual: edit `kyc.authenticity_risk.v1`
threshold → second admin approves → new value live, audit complete.

## Phase-final verification

```bash
cd backend && .venv/bin/python -m pytest -q          # fully green (incl. all new test_admin_* suites)
cd website && pnpm exec tsc --noEmit && pnpm build   # clean
AI_PROVIDER=shim cd backend && .venv/bin/python -m pytest -q   # AI paths green on shim
```

Manual end-to-end flows (all from the admin console, no "coming soon" reachable):
1. Login per tier → nav shows only that tier's modules; direct URL to a
   forbidden module → 403 screen.
2. KYC: upload doc → AI extraction visible → risk < 0.3 auto-advances /
   higher risk lands in queue with reasons → approve with reason + MPIN →
   user verified; confirm no unmasked Aadhaar in UI, logs, or fixtures.
3. Settlements: trigger weekly batch → approve a hold (maker-checker if >
   ₹10,000) → mark paid with ref → audit trail complete.
4. Dispute: open one → routed to correct RBAC queue with SLA → resolve.
5. Copilot: whitelisted query answered with source citation; nightly briefing
   card deep-links into queues.
6. AI Health: calibration row present; config edit maker-checkered.
