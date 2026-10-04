# phase-07 — Task Queue
> Executor: read `execution-plan/AGENT_PLAYBOOK.md` first. Execute tasks top to
> bottom, one at a time. Mark [x] only when EXPECT matches real output.
> Full context for any task: see `instructions.md` WS-NN referenced in the task.

Conventions used below:
- Backend checks run from `backend/` with `.venv/bin/python -m pytest tests/...` (pytest.ini sets `pythonpath = .`).
- Website checks run from `website/` with `pnpm exec tsc --noEmit`.
- Dev API base URL is `http://localhost:8000/v1` (all routers are mounted under `/v1` in `backend/app/main.py`).
- Dev backend start command (when a task needs a live server):
  `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Hard rules repeated where at risk: integer paisa for all money (no floats);
  every mutation needs `X-Audit-Reason` + an `audit_logs` entry; no
  `alert()/confirm()/prompt()`; all UI strings via `t()` with en + hi keys;
  AI calls only via `backend/app/services/ai/gateway.py`; AI automation level
  for new features is `suggest` only; no unmasked Aadhaar anywhere.

## WS-01 — Foundation: shell, RBAC, grid, safeguards, audit  (see instructions.md §WS-01)

### Task 1.1 — Verify phase-00 prerequisite files
- DO: no file changes. Confirm the phase-00 deliverables this phase builds on exist.
- RUN: `grep -q "async def admin_user" backend/app/core/deps.py && test -f backend/app/routers/admin.py && test -f backend/tests/test_admin.py && test -f backend/tests/test_admin_finance.py && grep -q "def verify_mpin" backend/app/core/security.py`
- EXPECT: exit 0 (no output).
- IF FAIL: a phase-00 deliverable is missing — STOP the phase (playbook §5) and report which check failed.
- [ ]

### Task 1.2 — Create admin RBAC service module
- DO: create `backend/app/services/admin_auth.py` (new) with exactly:
  - `ADMIN_ROLES = frozenset({"superadmin", "compliance_officer", "finance_admin", "agronomist", "scientist", "operations_lead", "content_moderator"})` (`scientist` is the alias of `agronomist` — both are valid tier values).
  - `def resolve_admin_role(user: dict) -> str | None` — returns `user.get("adminRole")` (set by the phase-00 unified admin auth from the admin profile / custom claim), else `None`.
  - `async def current_admin_user(uid: str = Depends(current_user_id)) -> dict` — loads the user via `app.services.users.get_user`; 404 `NOT_FOUND` if missing; if `resolve_admin_role(user)` is `None` and not `user.get("isAdmin")` and `user.get("activeProfile") != "admin"` → 403 `{"error":{"code":"FORBIDDEN_ADMIN"}}`; otherwise sets `user["adminRole"] = resolve_admin_role(user)` and returns the user.
  - `def require_admin_role(*roles: str)` — dependency factory returning an async dependency `dep(user: dict = Depends(current_admin_user)) -> dict` that raises 403 `{"error":{"code":"FORBIDDEN_ADMIN_ROLE"}}` when `user["adminRole"]` is not in `roles` (`superadmin` is always allowed), else returns the user.
- RUN: `cd backend && .venv/bin/python -c "from app.services.admin_auth import ADMIN_ROLES, resolve_admin_role, current_admin_user, require_admin_role; assert len(ADMIN_ROLES) == 7"`
- EXPECT: exit 0, no output.
- IF FAIL: fix the import error in `admin_auth.py` (check `from app.core.deps import current_user_id` and `from app.services.users import get_user` imports) — else STOP (playbook §5).
- [ ]

### Task 1.3 — Remove dev-ID bypass from admin router
- DO: in `backend/app/routers/admin.py`, delete the hardcoded dev-ID fallback `("admin-root", "uid-admin", "admin-demo")` inside `_require_admin` and rewrite `_require_admin` / `_admin_user` to delegate to `app.services.admin_auth.current_admin_user` (keep the names `_require_admin` and `_admin_user` as thin aliases so every existing `Depends(_admin_user)` and the existing tests keep working). No other endpoint changes in this task.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0). The seeded test admins use `isAdmin: True` / `activeProfile: "admin"`, so they still pass without the bypass.
- IF FAIL: inspect the failing seed — if a test relied ONLY on the dev-ID list (no `isAdmin`/`activeProfile: "admin"`), add `"isAdmin": True` to that test's seeded user doc; never restore the bypass — else STOP (playbook §5).
- [ ]

### Task 1.4 — Add admin request-context dependencies
- DO: in `backend/app/services/admin_auth.py` add:
  - `async def admin_context(request: Request, user: dict = Depends(current_admin_user), x_admin_role: str | None = Header(None, alias="X-Admin-Role")) -> dict` — if `x_admin_role` is present and `!= user["adminRole"]` → 403 `{"error":{"code":"FORBIDDEN_ADMIN_ROLE"}}`; returns `{"admin": user, "role": user["adminRole"], "reason": None, "ip": request.client.host if request.client else None}`.
  - `async def admin_mutation_context(request: Request, user: dict = Depends(current_admin_user), x_admin_role: str | None = Header(None, alias="X-Admin-Role"), x_audit_reason: str = Header(..., min_length=3, alias="X-Audit-Reason")) -> dict` — same role check; returns the same dict with `"reason": x_audit_reason`. (Missing or short `X-Audit-Reason` produces FastAPI's automatic 422 — that is the required behavior.)
- RUN: `cd backend && .venv/bin/python -c "from app.services.admin_auth import admin_context, admin_mutation_context"`
- EXPECT: exit 0, no output.
- IF FAIL: add the missing `from fastapi import Depends, Header, Request` import — else STOP (playbook §5).
- [ ]

### Task 1.5 — Create shared audit-log helper
- DO: create `backend/app/services/audit.py` (new) with one public async function `log_admin_action(admin: dict, module: str, action: str, target_id: str, previous: dict | None, new: dict | None, reason: str, ip: str | None) -> str` that writes via `app.core.db.set_doc` to collection `audit_logs` a doc with exactly the canonical schema `{id, adminId, adminEmail, module, action, targetId, previousState, newState, reason, timestamp, ipAddress}` (`adminId = admin.get("id")`, `adminEmail = admin.get("email")`, `timestamp = datetime.now(timezone.utc).isoformat()`, `id` = `f"aud_{uuid4().hex}"`) and returns the id. The module must expose NO update or delete function — `audit_logs` is immutable.
- RUN: `cd backend && .venv/bin/python -c "import app.services.audit as a; assert hasattr(a, 'log_admin_action'); assert not hasattr(a, 'update_audit_log') and not hasattr(a, 'delete_audit_log')"`
- EXPECT: exit 0, no output.
- IF FAIL: fix `audit.py` until the import and attribute checks pass — else STOP (playbook §5).
- [ ]

### Task 1.6 — Add GET /admin/audit endpoint
- DO: in `backend/app/routers/admin.py` add `GET /audit` (full path `/v1/admin/audit`) with query params `targetId: str | None`, `module: str | None`, `page: int = 1`, `pageSize: int = 20`, guarded by `Depends(_admin_user)`. It queries the `audit_logs` collection, applies the optional equality filters, and returns `{"data": [...], "total": n, "page": page, "pageSize": pageSize}` sorted newest-first by `timestamp`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the new endpoint until the suite is green — else STOP (playbook §5).
- [ ]

### Task 1.7 — Route existing audit writes through helper
- DO: in `backend/app/routers/admin.py` replace every ad-hoc `set_doc("audit_logs", ...)` block (user status change, KYC review, course review, and the remaining block near the claims/expert handlers) with calls to `app.services.audit.log_admin_action`, each passing an explicit `module` string (`"users"`, `"kyc"`, `"courses"`, `"insurance"` / `"experts"` as appropriate), `previousState` (the entity doc before mutation), `newState` (after mutation), and `ipAddress` from the request context. Do not change any endpoint's request/response behavior.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py tests/test_admin_finance.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: a refactor broke behavior — `git diff backend/app/routers/admin.py`, restore behavior while keeping the helper calls — else STOP (playbook §5).
- [ ]

### Task 1.8 — Create maker-checker approvals service
- DO: create `backend/app/services/approvals.py` (new) with:
  - `MAKER_CHECKER_THRESHOLD_PAISE = 1_000_000` (₹10,000 — integer paisa only, never floats).
  - `async def maybe_require_approval(admin: dict, module: str, action: str, payload: dict, reason: str) -> dict | None` — if `payload.get("amountPaise", 0) > MAKER_CHECKER_THRESHOLD_PAISE`, create an `admin_approvals` doc `{id, action, module, payload, requestedBy: admin["id"], status: "pending", reason}` via `set_doc`, write an `audit_logs` entry via `log_admin_action` (action `"approval.requested"`), and return the doc (caller must NOT execute the action); otherwise return `None` (caller executes directly).
  - `async def approve(approval_id: str, approver: dict, reason: str, ip: str | None) -> dict` — load the doc (404 `NOT_FOUND` if missing); 409 `APPROVAL_ALREADY_DECIDED` if `status != "pending"`; 403 `SELF_APPROVAL_FORBIDDEN` if `approver["id"] == doc["requestedBy"]`; set `status: "approved"`, `decidedBy`, `decidedAt`; audit-log `"approval.approved"`; return the doc.
  - `async def reject(approval_id: str, approver: dict, reason: str, ip: str | None) -> dict` — same guards; set `status: "rejected"`; audit-log `"approval.rejected"`.
- RUN: `cd backend && .venv/bin/python -c "from app.services.approvals import MAKER_CHECKER_THRESHOLD_PAISE, maybe_require_approval, approve, reject; assert MAKER_CHECKER_THRESHOLD_PAISE == 1_000_000"`
- EXPECT: exit 0, no output.
- IF FAIL: fix `approvals.py` until the import passes — else STOP (playbook §5).
- [ ]

### Task 1.9 — Add maker-checker approvals endpoints
- DO: in `backend/app/routers/admin.py` add:
  - `GET /approvals` with query param `status: str = "pending"`, `Depends(_admin_user)` — returns `{"data": [...]}` of matching `admin_approvals` docs.
  - `POST /approvals/{approval_id}/approve` and `POST /approvals/{approval_id}/reject`, both `Depends(admin_mutation_context)` (so `X-Audit-Reason` is mandatory), calling `approvals.approve` / `approvals.reject` with the context's admin, reason and ip. Errors use the standard `{"error":{code,...}}` envelope via the existing `_error` helper.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the new endpoints until green — else STOP (playbook §5).
- [ ]

### Task 1.10 — Add POST /admin/verify-mpin endpoint
- DO: in `backend/app/routers/admin.py` add request model `MpinVerifyIn(BaseModel)` with `mpin: str = Field(..., min_length=4, max_length=6)` and endpoint `POST /verify-mpin` (`Depends(_admin_user)`) that loads the caller's user doc via `get_user`, and returns `{"ok": True}` when `app.core.security.verify_mpin(body.mpin, user["mpinHash"])` is truthy, else 403 `{"error":{"code":"INVALID_MPIN"}}` via `_error`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 1.11 — Enforce mutation context on existing endpoints
- DO: in `backend/app/routers/admin.py` switch every existing mutating endpoint (`POST /users/{uid}/status`, the KYC review endpoint, expert-handoffs resolve, claims adjudicate, courses review/feature) from `Depends(_admin_user)` to `Depends(admin_mutation_context)` (import from `app.services.admin_auth`), and pass the context's `reason` and `ip` into the `log_admin_action` calls added in Task 1.7. Also update the existing tests in `backend/tests/test_admin.py` and `backend/tests/test_admin_finance.py` that call these endpoints to send header `X-Audit-Reason: test reason` (adding a header is the intentional new contract — do not delete or weaken any assertion).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py tests/test_admin_finance.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: find the call still missing the header and add it — else STOP (playbook §5).
- [ ]

### Task 1.12 — Create RBAC tier-matrix test file
- DO: create `backend/tests/test_admin_rbac.py` (new) reusing the `client`/`user_store` fixtures and the `_seed_admin` pattern from `backend/tests/test_admin.py`, with a local helper `_seed_role_admin(user_store, uid, role)` seeding a user doc `{"id": uid, "isAdmin": True, "adminRole": role, "activeProfile": "admin"}` and returning an access token. Tests: (a) for each of the 6 canonical tiers (`superadmin`, `compliance_officer`, `finance_admin`, `agronomist`, `operations_lead`, `content_moderator`) a seeded admin of that tier gets 200 on `GET /v1/admin/overview`; (b) a user with no `adminRole`/`isAdmin` gets 403 `FORBIDDEN_ADMIN`; (c) a user seeded with `adminRole: "not-a-real-role"` gets 403 on an endpoint guarded by `require_admin_role("superadmin")` with code `FORBIDDEN_ADMIN_ROLE`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin_rbac.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the test seeds or the guard wiring in `admin_auth.py` — else STOP (playbook §5).
- [ ]

### Task 1.13 — Test X-Audit-Reason and role-header enforcement
- DO: append to `backend/tests/test_admin_rbac.py`: (a) `POST /v1/admin/users/{uid}/status` without `X-Audit-Reason` → 422; (b) with `X-Audit-Reason: x` (length 1) → 422; (c) with `X-Audit-Reason: valid reason` → 200; (d) with header `X-Admin-Role` different from the seeded role → 403 `FORBIDDEN_ADMIN_ROLE`; (e) after the successful status change, `GET /v1/admin/audit?targetId={uid}` returns at least one entry whose `module` is `"users"` and which has non-null `reason` and `adminId`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin_rbac.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint or audit-helper wiring, never the assertions — else STOP (playbook §5).
- [ ]

### Task 1.14 — Test maker-checker approval flow
- DO: append to `backend/tests/test_admin_rbac.py`: (a) calling `app.services.approvals.maybe_require_approval` with `payload={"amountPaise": 2_000_000}` returns a pending `admin_approvals` doc; (b) `POST /v1/admin/approvals/{id}/approve` from the SAME admin → 403 `SELF_APPROVAL_FORBIDDEN`; (c) from a SECOND distinct admin with `X-Audit-Reason` → 200 and the doc's `status` becomes `"approved"`; (d) both the request and the approval produced `audit_logs` entries; (e) `maybe_require_approval` with `amountPaise: 500_000` returns `None`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin_rbac.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix `approvals.py` or the endpoints — else STOP (playbook §5).
- [ ]

### Task 1.15 — Create admin dark theme stylesheet
- DO: create `website/src/theme/admin.css` (new) defining CSS custom properties on `.admin-shell` — `--admin-bg: #111827; --admin-surface: #1f2937; --admin-border: #374151; --admin-text: #f9fafb; --admin-muted: #9ca3af; --admin-accent: #34d399; --admin-danger: #f87171;` — plus base layout classes `.admin-shell`, `.admin-nav`, `.admin-content`, `.admin-grid`, `.admin-drawer`, `.admin-modal` (dark utilitarian: flat surfaces, 1px `--admin-border` outlines, no gradients).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0 (no type errors).
- IF FAIL: run `cd website && pnpm exec tsc --noEmit` and fix the reported error (should be none from a CSS-only change — if an error appears it predates this task; STOP and report per playbook §5).
- [ ]

### Task 1.16 — Create typed admin API wrapper
- DO: create `website/src/lib/api/admin.ts` (new) importing the shared axios instance `api` from `./client` and exporting: `mutationHeaders(role: string, reason: string)` returning `{ 'X-Admin-Role': role, 'X-Audit-Reason': reason }`; typed async functions `getOverview()`, `listUsers(params: {persona?, status?, search?, page?, pageSize?})`, `setUserStatus(uid, status, reason, role)`, `getAudit(params: {targetId?, module?, page?, pageSize?})`, `verifyMpin(mpin: string)`. Every mutation passes `mutationHeaders(role, reason)` via the axios `headers` config. Use the same error-handling idiom as the existing wrappers in `website/src/lib/api/`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors in `admin.ts` — else STOP (playbook §5).
- [ ]

### Task 1.17 — Create AdminShell with nav and guard
- DO: create `website/src/views/admin/AdminShell.tsx` (new): imports `../../theme/admin.css`; exports `ADMIN_MODULES` — a config array of all 27 modules from the `superadmin-instructions.md` §3 directory, each entry `{path, labelKey, roles, group}` with `group` in `P1..P5` and `labelKey` an `admin.nav.*` `t()` key; a `RequireAdminRole({roles, children})` guard component that reads the admin role from the session store and renders the `admin.forbidden` screen when the role is not allowed; the default `AdminShell` component rendering the nav (grouped P1–P5, only entries whose `roles` include the session role AND whose route is registered — hidden otherwise, never a "coming soon" link) plus `<Outlet/>`. All user-facing strings via `t()` — zero hardcoded strings.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 1.18 — Create admin home page and routes
- DO: create `website/src/views/admin/AdminHomePage.tsx` (new) rendering the KPI cards from `adminApi.getOverview()` (`activeUsersTotal`, `personaBreakdown`, `marketplaceGMV`, `pendingClaimsCount`, `pendingSettlementsAmount`) with all labels via `t()`. In `website/src/App.tsx` register route `path="/admin"` with element `<AdminShell/>` and an index child route rendering `<AdminHomePage/>`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 1.19 — Create universal DataGrid component
- DO: create `website/src/views/admin/components/DataGrid.tsx` (new): props `{columns: {key, labelKey, sortable?}[], fetchPage: (q: {page, pageSize, search, status, sort}) => Promise<{data, total}>, statusChips?: string[], onBulkAction?: (ids: string[]) => void}`. Features: search input, status chips defaulting to `['all','pending','approved','flagged','rejected']`, server-side `page`/`pageSize` pagination controls, click-to-sort column headers, bulk-select checkboxes per row + header select-all. All labels via `t()` (`admin.grid.*` keys).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 1.20 — Create DetailDrawer component
- DO: create `website/src/views/admin/components/DetailDrawer.tsx` (new): props `{targetId: string, title: string, fetchEntity: () => Promise<object>, actions?: {labelKey, destructive?, onConfirm: (reason: string) => Promise<void>}[], onClose}`. Renders a right-side drawer showing the raw entity JSON in a `<pre>` block, an audit-history section loaded via `adminApi.getAudit({targetId})`, and one button per action — destructive actions open `ConfirmActionModal` (Task 1.21). All labels via `t()` (`admin.drawer.*` keys).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors (the `ConfirmActionModal` import will fail until Task 1.21 — if so, do Task 1.21 first, then re-run this check).
- [ ]

### Task 1.21 — Create two-step ConfirmActionModal component
- DO: create `website/src/views/admin/components/ConfirmActionModal.tsx` (new): two-step modal — step 1: mandatory reason textarea (confirm button disabled until length ≥ 3); step 2: admin MPIN re-entry field, verified by calling `adminApi.verifyMpin(mpin)` before invoking the `onConfirm(reason)` callback; an error line shows `admin.modal.invalidMpin` on 403. Used for destructive actions (ban, refund, payout release, override). Must NOT use `alert()`, `confirm()`, or `prompt()` anywhere (hard rule). All strings via `t()` (`admin.modal.*` keys).
- RUN: `cd website && pnpm exec tsc --noEmit && grep -rnE "\b(alert|confirm|prompt)\(" src/views/admin/ src/theme/admin.css; test $? -eq 1`
- EXPECT: `tsc` exits 0; the grep prints nothing and exits 1 (no matches) so the final `test` exits 0.
- IF FAIL: remove the offending browser-dialog call and use the modal state instead — else STOP (playbook §5).
- [ ]

### Task 1.22 — Add WS-01 admin locale keys (en + hi)
- DO: create `website/src/lib/i18n/locales/en.admin.ts` and `website/src/lib/i18n/locales/hi.admin.ts` (both new) following the existing `en.broker.ts` pattern (`import { registerLocale } from '../index';` then `registerLocale('en' | 'hi', {...})`). Keys (identical set in both files): `admin.shell.title`, `admin.forbidden`, one `admin.nav.*` key per entry in `ADMIN_MODULES`, `admin.grid.search`, `admin.grid.status.*` (all/pending/approved/flagged/rejected), `admin.grid.page`, `admin.grid.next`, `admin.grid.prev`, `admin.drawer.auditHistory`, `admin.drawer.rawJson`, `admin.modal.reasonLabel`, `admin.modal.mpinLabel`, `admin.modal.confirm`, `admin.modal.cancel`, `admin.modal.invalidMpin`, `admin.home.*` KPI labels. English values in en.admin.ts, Hindi values in hi.admin.ts. Add `import './lib/i18n/locales/en.admin';` and `import './lib/i18n/locales/hi.admin';` to `website/src/main.tsx` next to the existing locale imports.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/en.admin.ts | sort) <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/hi.admin.ts | sort)`
- EXPECT: `tsc` exits 0; `diff` exits 0 with no output (en/hi key parity).
- IF FAIL: add the missing key(s) shown by the diff to the file that lacks them — else STOP (playbook §5).
- [ ]

### Task 1.23 — HUMAN CHECK: RBAC and safeguards manual flow
- DO: HUMAN CHECK — ask the operator to run, in order:
  1. Start the API: `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`.
  2. Log in to the website admin console as a `finance_admin` admin and open a KYC page — confirm the nav shows only finance-tier modules and the KYC screen shows the 403/forbidden screen.
  3. `curl -s -X POST http://localhost:8000/v1/admin/users/<uid>/status -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"status":"suspended","reason":"manual check"}'` with NO `X-Audit-Reason` header → confirm HTTP 422.
  4. Repeat with `-H "X-Audit-Reason: manual verification"` and `-H "X-Admin-Role: finance_admin"` → confirm HTTP 200.
  5. `curl -s "http://localhost:8000/v1/admin/audit?targetId=<uid>" -H "Authorization: Bearer <token>"` → confirm the new entry has `module`, `reason`, `adminId`, `previousState`, `newState`, `ipAddress`.
- RUN: none (human-executed; executor records the outcome).
- EXPECT: the human confirms all five steps behaved as listed.
- IF FAIL: record which step failed with the full curl output and STOP (playbook §5).
- [ ]

### Task 1.24 — WS-01 checkpoint: full verification and commit
- DO: run the WS-01 Verification block from instructions.md, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-07 WS-01: Foundation: shell, RBAC, grid, safeguards, audit"`
- EXPECT: backend suite fully green; `tsc` and `pnpm build` exit 0; commit succeeds.
- IF FAIL: fix the failing test/build error first (never weaken a test). If `git commit` fails only for identity reasons, note it in the report and continue (playbook §6) — else STOP (playbook §5).
- [ ]

## WS-02 — P1 security modules (users, KYC + M11, sessions, flags, broadcast, moderation, DPDP)  (see instructions.md §WS-02)

### Task 2.1 — Verify WS-01 and phase-00 AI prerequisites
- PRECONDITION: `test -f backend/app/services/admin_auth.py && test -f backend/app/services/audit.py && test -f backend/app/services/approvals.py && test -d backend/app/services/ai && test -f backend/app/services/ai/question_sets.py && test -f backend/app/services/ai/privacy.py` — if this fails, STOP the phase (playbook §5): the AI gateway is a phase-00/M1 deliverable.
- DO: no file changes. Also read `backend/app/services/ai/question_sets.py`, `backend/app/services/ai/privacy.py`, `backend/app/routers/vault.py` before starting Task 2.2.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai import gateway, question_sets, privacy"`
- EXPECT: exit 0, no output.
- IF FAIL: the gateway module layout differs from phase-00's contract — STOP (playbook §5) and report the contradiction.
- [ ]

### Task 2.2 — Extend users list with persona drill-down
- DO: in `backend/app/routers/admin.py`: (a) extend `GET /users` rows to include `linkedProfiles` (already on user docs — surface it in the response); (b) add `GET /users/{uid}/role-profiles` guarded by `require_admin_role("superadmin", "operations_lead")` returning `{"data": [...]}` of the docs under `users/{uid}/role_profiles`. First read `backend/app/core/db.py`: if it has no subcollection read helper, STOP (playbook §5, contradiction with instructions.md). Guard `GET /users` and `POST /users/{uid}/status` with `require_admin_role("superadmin", "operations_lead")` as well.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py tests/test_admin_rbac.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: the seeded test admins in `test_admin.py` have no `adminRole` — update `_seed_role_admin`-style seeds to include a role allowed for the endpoint (keep all assertions) — else STOP (playbook §5).
- [ ]

### Task 2.3 — Add sessions list endpoint
- DO: in `backend/app/routers/admin.py` add `GET /auth/users` guarded by `require_admin_role("superadmin", "compliance_officer")`, with `page`/`pageSize` params, returning login history (uid, last login timestamps, IP addresses) read from the `auth_tokens` and `sessions` collections.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 2.4 — Add admin reset-mpin endpoint
- DO: in `backend/app/routers/admin.py` add `POST /auth/users/{uid}/reset-mpin` guarded by `require_admin_role("superadmin", "compliance_officer")` plus `Depends(admin_mutation_context)`; it issues a temporary OTP for the target user following the existing MPIN-reset mechanism in `backend/app/routers/auth.py` (reuse, don't duplicate), and writes an audit entry via `log_admin_action` with `module="sessions"`, `action="reset-mpin"`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 2.5 — Add revoke-sessions endpoint
- DO: in `backend/app/routers/admin.py` add `POST /auth/users/{uid}/revoke-sessions` guarded by `require_admin_role("superadmin", "compliance_officer")` plus `Depends(admin_mutation_context)`; it revokes the target user's refresh tokens in the `auth_tokens`/`sessions` collections and audit-logs with `module="sessions"`, `action="revoke-sessions"`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 2.6 — Register KYC question sets
- DO: in `backend/app/services/ai/question_sets.py` register two question sets following the file's existing registration pattern exactly (read it first): `kyc.extract.v1` — a generation ("G") set using the Gemini vision model for document field extraction; `kyc.authenticity_risk.v1` — a judgement ("J") set with threshold `risk < 0.3` and documented fallback = always route to the human queue. Do not modify any existing question set.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai import question_sets as qs; names = [n for n in dir(qs) if not n.startswith('_')]; print('registered')"`
- EXPECT: exit 0 and the module imports cleanly after the edit.
- IF FAIL: re-read `question_sets.py`, match its exact registration idiom, and retry once — if the file's API contradicts this task, STOP (playbook §5).
- [ ]

### Task 2.7 — Create KYC extraction Pydantic schemas
- DO: create `backend/app/services/ai/kyc_schemas.py` (new) with Pydantic models: `KYCAadhaarExtract` (fields `name: str`, `dob: str`, `maskedAadhaar: str` with a validator requiring the pattern `XXXX-XXXX-` followed by exactly 4 digits and rejecting any 12-digit value), `KYCLand712Extract` (fields `ownerName`, `surveyNumber`, `district`, `area`), `KYCMandiLicenseExtract` (fields `licenseNumber`, `holderName`, `validUntil`), plus `DOC_TYPE_SCHEMAS: dict[str, type[BaseModel]]` mapping doc-type keys to these models.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai.kyc_schemas import KYCAadhaarExtract, KYCLand712Extract, KYCMandiLicenseExtract, DOC_TYPE_SCHEMAS; KYCAadhaarExtract(name='A', dob='1990-01-01', maskedAadhaar='XXXX-XXXX-1234')"`
- EXPECT: exit 0, no error.
- IF FAIL: fix the schema definitions — else STOP (playbook §5).
- [ ]

### Task 2.8 — Hook AI extraction into vault upload
- DO: in `backend/app/routers/vault.py`, in the upload flow for `users/{uid}/vault_documents`, after the document is stored call `app.services.ai.gateway.generate` with question set `kyc.extract.v1` (vision) to extract fields into the per-doc-type schema from `kyc_schemas.py` (`DOC_TYPE_SCHEMAS[doc_type]`); build all model input through `app.services.ai.privacy` (pseudonymized — no unmasked Aadhaar, phone, or email in any AI payload); store the result on the vault doc under an `extracted` field with Aadhaar masked only (`XXXX-XXXX-1234`). No unmasked Aadhaar in any DB write or log line.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_vault.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the hook wiring until the vault suite is green — else STOP (playbook §5).
- [ ]

### Task 2.9 — Add authenticity risk triage on upload
- DO: in `backend/app/routers/vault.py` (same upload flow, after Task 2.8's extraction): call `gateway.decide(state, "kyc.authenticity_risk.v1", ctx)` where `state` is built via `privacy.py` and `ctx` carries the extraction-consistency signals (name/DoB vs profile, doc age, image-quality signals); store `riskScore` and `riskReasons` on the vault doc; when `riskScore < 0.3` set the doc status to `verified-pending-bank` (the M11-specified auto-advance — automation level `suggest`, never auto-reject); otherwise leave it pending for the human queue.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_vault.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the triage wiring — else STOP (playbook §5).
- [ ]

### Task 2.10 — Replace hardcoded KYC queue with real query
- DO: in `backend/app/routers/admin.py`: (a) delete the hardcoded sample array behind `GET /kyc/queue` and implement it as a real query over `users/{uid}/vault_documents` with status pending joined with `kyc_verifications`, each row including the AI `extracted` fields and `riskReasons`; (b) add `GET /kyc/pending`, `POST /kyc/{id}/verify`, `POST /kyc/{id}/reject` (`rejectionReason` mandatory), and `GET /kyc/history` per SOP-03 §5; all mutations via `Depends(admin_mutation_context)` + `log_admin_action` (`module="kyc"`); all guarded by `require_admin_role("superadmin", "compliance_officer")`. Zero hardcoded rows may remain.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q && grep -nE "\"docType\"|'docType'" app/routers/admin.py; test $? -eq 1`
- EXPECT: pytest green; the grep finds no inline sample KYC rows in `admin.py` (grep exit 1 → overall exit 0).
- IF FAIL: remove the remaining hardcoded sample data and query the real collections — else STOP (playbook §5).
- [ ]

### Task 2.11 — Create golden KYC extraction fixtures
- DO: create directory `backend/tests/fixtures/ai/golden/` (new) with golden extraction fixtures for the three doc types (Aadhaar, 7/12, mandi license): for each, an input payload file and an expected-extraction JSON matching the `kyc_schemas.py` models. If phase-00 already created this directory with its own fixture convention, follow that convention exactly (read an existing fixture first). No fixture may contain a real-looking unmasked 12-digit Aadhaar — use masked or obviously synthetic values only.
- RUN: `test -d backend/tests/fixtures/ai/golden && ls backend/tests/fixtures/ai/golden | grep -q . && ! grep -rEn "\b[0-9]{12}\b" backend/tests/fixtures/ai/golden`
- EXPECT: exit 0 — directory exists, is non-empty, and contains no 12-digit Aadhaar-like numbers.
- IF FAIL: fix the fixtures (mask or synthesize the offending values) — else STOP (playbook §5).
- [ ]

### Task 2.12 — Create KYC admin test suite
- DO: create `backend/tests/test_admin_kyc.py` (new): (a) golden extraction precision ≥ 90% on the golden doc set with `AI_PROVIDER=shim`; (b) a doc with risk < 0.3 auto-advances to status `verified-pending-bank`; (c) a doc with risk ≥ 0.3 lands in the human queue with `riskReasons` attached; (d) masked-Aadhaar assertion — after the upload+extraction flow, no stored doc, AI payload, or log record contains an unmasked Aadhaar; (e) `POST /v1/admin/kyc/{id}/verify` and `/reject` work with a reason and write audit entries; (f) a `finance_admin` token gets 403 on the KYC endpoints.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_admin_kyc.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the implementation, never the assertions — else STOP (playbook §5).
- [ ]

### Task 2.13 — Add feature-flag and app-config admin CRUD
- DO: in `backend/app/routers/admin.py` add `GET /feature-flags`, `PUT /feature-flags`, `GET /app-config`, `PUT /app-config` (the app-config payload includes the minimum supported app version that drives the force-update splash, per `backend/app/routers/app_config.py`). Every `PUT` routes through `app.services.approvals.maybe_require_approval` as a maker-checkered config change and writes audit entries with `previousState`/`newState` (`module="config"`). Guard with `require_admin_role("superadmin", "operations_lead")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py tests/test_app_config.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 2.14 — Add segment broadcast endpoint
- DO: in `backend/app/routers/admin.py` add `POST /broadcasts` (`Depends(admin_mutation_context)` — reason mandatory) with body `{segment: {persona?: str, district?: str, crop?: str}, titleEn: str, titleHi: str, bodyEn: str, bodyHi: str}`; it creates exactly ONE `broadcasts` doc and fans out via the existing notifications service, then audit-logs (`module="broadcasts"`). Guard with `require_admin_role("superadmin", "operations_lead")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 2.15 — Add unified moderation queue endpoints
- DO: in `backend/app/routers/admin.py` add `GET /moderation/queue` returning sections `{userReports: [...], ugcFlags: [...], fraudHolds: [...]}`: `userReports` is a real query over the `user_reports` collection; `ugcFlags` (A12) and `fraudHolds` (A6) query those phase-06 surfaces ONLY if their collections/services exist (check first) — otherwise return empty lists (stub-queue fallback; never fabricate rows). Add `POST /moderation/{id}/action` with body `{action: "dismiss" | "warn" | "suspend"}` via `Depends(admin_mutation_context)`; `suspend` reuses the same user-status path as `POST /users/{uid}/status` (WS-01 safeguards). Audit every action (`module="moderation"`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 2.16 — Add DPDP consent audit endpoint
- DO: in `backend/app/routers/admin.py` add `GET /consents/{uid}` (read-only) guarded by `require_admin_role("superadmin", "compliance_officer")`, returning the per-user consent timeline, withdrawal events, and export/deletion request status read from the consent records managed by `backend/app/services/consents.py` (read that file first and reuse its accessors — do not duplicate consent logic).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py tests/test_consents.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 2.17 — Create admin users page
- DO: create `website/src/views/admin/UsersPage.tsx` (new): a `DataGrid` over `adminApi.listUsers` with persona/status/search filters; row click opens `DetailDrawer` showing the raw user JSON, a role-profiles section (new `adminApi.getRoleProfiles(uid)` calling `GET /admin/users/{uid}/role-profiles` — add that function to `website/src/lib/api/admin.ts`), and a suspend/ban action wired through `ConfirmActionModal`. All strings via `t()` (`admin.users.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 2.18 — Create admin sessions page
- DO: create `website/src/views/admin/SessionsPage.tsx` (new): a `DataGrid` over a new `adminApi.listAuthUsers()` (`GET /admin/auth/users`) showing login history + IP; row actions "Reset MPIN" and "Revoke sessions" via `ConfirmActionModal` calling new `adminApi.resetUserMpin(uid, reason, role)` / `adminApi.revokeUserSessions(uid, reason, role)` (add all three functions to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.sessions.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 2.19 — Create real KYC queue page
- DO: create `website/src/views/admin/KycQueuePage.tsx` (new): a `DataGrid` over new `adminApi.getKycQueue()` / `adminApi.getKycPending()` showing the AI-extracted fields and `riskReasons` columns; `DetailDrawer` shows a side-by-side document preview with zoom controls next to the extracted fields; verify/reject actions (reject requires a rejection reason) via `ConfirmActionModal` calling new `adminApi.verifyKyc(id, reason, role)` / `adminApi.rejectKyc(id, rejectionReason, reason, role)` (add all four functions to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.kyc.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 2.20 — Create feature flags and app-config page
- DO: create `website/src/views/admin/ConfigPage.tsx` (new): editors for feature flags and app-config (including the minimum supported app version field) backed by new `adminApi.getFeatureFlags()` / `adminApi.putFeatureFlags(payload, reason, role)` / `adminApi.getAppConfig()` / `adminApi.putAppConfig(payload, reason, role)` (add to `website/src/lib/api/admin.ts`); saves go through `ConfirmActionModal` (maker-checker applies server-side). All strings via `t()` (`admin.config.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 2.21 — Create segment broadcast page
- DO: create `website/src/views/admin/BroadcastPage.tsx` (new): a form with segment pickers (persona / district / crop) and en + hi title/body fields, submitting via `ConfirmActionModal` to new `adminApi.createBroadcast(payload, reason, role)` (add to `website/src/lib/api/admin.ts`). All labels and validation messages via `t()` (`admin.broadcast.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 2.22 — Create moderation queue page
- DO: create `website/src/views/admin/ModerationPage.tsx` (new): three sections matching `GET /admin/moderation/queue` (user reports, UGC flags, fraud holds), each rendering an explicit empty-state message (`t()` key) when its list is empty — never fabricated rows; per-row actions dismiss / warn / suspend via `ConfirmActionModal` calling new `adminApi.moderationAction(id, action, reason, role)` (add to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.moderation.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 2.23 — Create DPDP consent audit page
- DO: create `website/src/views/admin/ConsentAuditPage.tsx` (new): a uid search box, then a read-only timeline of consent events, withdrawal events, and export/deletion request status from new `adminApi.getConsentAudit(uid)` (add to `website/src/lib/api/admin.ts`). No action buttons — this view is read-only. All strings via `t()` (`admin.consents.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 2.24 — Register WS-02 routes under AdminShell
- DO: in `website/src/App.tsx`, under the `/admin` `AdminShell` route, add child routes (absolute paths): `/admin/users` → `UsersPage`, `/admin/auth` → `SessionsPage`, `/admin/kyc` → `KycQueuePage`, `/admin/config` → `ConfigPage`, `/admin/broadcasts` → `BroadcastPage`, `/admin/moderation` → `ModerationPage`, `/admin/consents` → `ConsentAuditPage` — each wrapped in `RequireAdminRole` with the roles from its `ADMIN_MODULES` entry, and each entry's route now registered so the nav item renders.
- RUN: `cd website && pnpm exec tsc --noEmit && grep -c 'path="/admin/' src/App.tsx`
- EXPECT: `tsc` exits 0; grep prints a count of at least 8.
- IF FAIL: fix the route registrations — else STOP (playbook §5).
- [ ]

### Task 2.25 — Add WS-02 locale keys (en + hi)
- DO: append to `website/src/lib/i18n/locales/en.admin.ts` and `website/src/lib/i18n/locales/hi.admin.ts` the identical set of `admin.users.*`, `admin.sessions.*`, `admin.kyc.*`, `admin.config.*`, `admin.broadcast.*`, `admin.moderation.*` (including the three empty-state messages), and `admin.consents.*` keys used by the Task 2.17–2.23 pages — English values in en, Hindi values in hi.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/en.admin.ts | sort) <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/hi.admin.ts | sort)`
- EXPECT: `tsc` exits 0; `diff` exits 0 with no output.
- IF FAIL: add the missing key(s) shown by the diff — else STOP (playbook §5).
- [ ]

### Task 2.26 — HUMAN CHECK: KYC end-to-end flow
- DO: HUMAN CHECK — ask the operator to run, in order:
  1. Start the API: `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (with `AI_PROVIDER=shim`).
  2. In the dev app, upload a 7/12 PDF as a test user's vault document.
  3. Open the website admin console as `compliance_officer`, go to `/admin/kyc` — confirm the uploaded document appears with AI-extracted fields and risk reasons (no sample rows).
  4. Approve it with a reason (and MPIN when prompted) — confirm the user now shows a verified badge and `GET /v1/admin/audit?targetId=<doc-id>` shows the entry.
  5. Confirm no unmasked Aadhaar is visible anywhere in the UI.
- RUN: none (human-executed; executor records the outcome).
- EXPECT: the human confirms all five steps behaved as listed.
- IF FAIL: record which step failed with full output and STOP (playbook §5).
- [ ]

### Task 2.27 — WS-02 checkpoint: full verification and commit
- DO: run the WS-02 Verification block from instructions.md, then commit.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-07 WS-02: P1 security modules (users, KYC+M11, sessions, flags, broadcast, moderation, DPDP)"`
- EXPECT: backend suite fully green on shim (including `test_admin_kyc.py`); `tsc` and `pnpm build` exit 0; commit succeeds.
- IF FAIL: fix the failing test/build error first — if `git commit` fails only for identity reasons, note it and continue (playbook §6) — else STOP (playbook §5).
- [ ]

## WS-03 — P2 commercial modules (mandi, lots, orders, buyers, fleet, equipment, settlements)  (see instructions.md §WS-03)

### Task 3.1 — Verify WS-03 prerequisite files
- PRECONDITION: `test -f backend/app/services/admin_auth.py && test -f backend/app/services/approvals.py && test -f backend/app/services/settlements.py && test -f backend/app/routers/mandi.py && test -f backend/app/routers/lots.py && test -f backend/app/routers/marketplace.py && test -f backend/app/routers/orders.py && test -f backend/app/routers/direct_buyer.py && test -f backend/app/routers/transport.py && test -f backend/app/routers/equipment_owner.py && test -f backend/app/routers/settlements.py` — if this fails, STOP the phase (playbook §5).
- DO: no file changes. Read `backend/app/services/settlements.py` and `backend/app/routers/settlements.py` before starting Task 3.2.
- RUN: `cd backend && .venv/bin/python -c "from app.services import settlements"`
- EXPECT: exit 0, no output.
- IF FAIL: STOP (playbook §5) and report the missing module.
- [ ]

### Task 3.2 — Add mandi rate approval queue endpoint
- DO: in `backend/app/routers/admin.py` add `GET /mandi/rates?status=pending` guarded by `require_admin_role("superadmin", "operations_lead", "finance_admin")`: a real query over `vyapari_rates` submissions, each row annotated with the Agmarknet modal price for that commodity/market (from the existing mandi service) and an `outOfBand: true` flag when the submitted rate is outside the ±15% sanity band of the modal price.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 3.3 — Add mandi rate approve/reject endpoints
- DO: in `backend/app/routers/admin.py` add `POST /mandi/rates/{id}/approve` and `POST /mandi/rates/{id}/reject` (reject requires a reason in the body AND `X-Audit-Reason`), same role guard as Task 3.2, each writing an audit entry with `previousState`/`newState` (`module="mandi"`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 3.4 — Add lots and B2B deals oversight endpoints
- DO: in `backend/app/routers/admin.py` add read-only `GET /lots` and `GET /deals` (with `page`/`pageSize`/`status` filters) over the `market_lots`, `deals`, and `procurements` collections, plus `POST /deals/{id}/escalate` (`Depends(admin_mutation_context)`) which creates a dispute-feeding doc in the `disputes` collection with `source: "deal"` and `sourceId` set (WS-04's triage consumes this collection; if WS-04 has already landed, reuse its adapter function instead of writing the doc inline).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 3.5 — Add marketplace orders grid endpoint
- DO: in `backend/app/routers/admin.py` add `GET /orders` (with `page`/`pageSize`/`status`/`search`) over the `orders` collection, extending the data already aggregated by the existing `/admin/analytics/emarket` handler. Guard: `require_admin_role("superadmin", "operations_lead", "finance_admin")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 3.6 — Add order refund endpoint with idempotency
- DO: in `backend/app/routers/admin.py` add `POST /orders/{id}/refund` (`Depends(admin_mutation_context)`, roles `superadmin`, `finance_admin`) with body `{amountPaise: int}` (integer paisa only — reject floats) and a REQUIRED `Idempotency-Key` header (missing → 422; a repeated key returns the original result with no second money movement). The refund moves money ONLY through the escrow/settlement rails in `backend/app/services/settlements.py` — never a direct wallet write. If `amountPaise > 1_000_000` (₹10,000), route through `approvals.maybe_require_approval` instead of executing. Audit every execution (`module="orders"`, `action="refund"`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 3.7 — Add corporate buyer verification endpoints
- DO: in `backend/app/routers/admin.py` add `GET /buyers?status=pending` over `buyer_contracts` (institutional buyers) and `POST /buyers/{id}/verify` / `POST /buyers/{id}/suspend` via `Depends(admin_mutation_context)` with audit entries (`module="buyers"`). Guard: `require_admin_role("superadmin", "operations_lead")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 3.8 — Add transport fleet verification endpoints
- DO: in `backend/app/routers/admin.py` add `GET /transport/vehicles?status=pending` over the `vehicles` collection (surfacing RC, insurance, and fitness document fields), `POST /transport/vehicles/{id}/verify`, and `POST /transport/transporters/{id}/suspend` — mutations via `Depends(admin_mutation_context)` with audit (`module="transport"`). Guard: `require_admin_role("superadmin", "operations_lead")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 3.9 — Add equipment oversight endpoints
- DO: in `backend/app/routers/admin.py` add `GET /equipment` over `equipment`, `equipment_slots`, and `equipment_bookings` (with `page`/`pageSize`/`status`), and `POST /equipment/bookings/{id}/escalate` (`Depends(admin_mutation_context)`) which writes a slot-dispute doc into the `disputes` collection with `source: "equipment"` for the WS-04 queue. Guard: `require_admin_role("superadmin", "operations_lead")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 3.10 — Add settlements console list endpoint
- DO: in `backend/app/routers/admin.py` add `GET /settlements?status=pending|approved|paid` over the `settlements` collection, including a `holds` section: settlement rows in hold status, incorporating M8 anomaly holds when the phase-06 fraud surface exists (check first) — otherwise the holds section returns the settlements hold-status rows only (stub fallback, no fabricated rows). Guard: `require_admin_role("superadmin", "finance_admin")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 3.11 — Add settlement mark-paid endpoint
- DO: in `backend/app/routers/admin.py` add `POST /settlements/{id}/mark-paid` (`Depends(admin_mutation_context)`, roles `superadmin`, `finance_admin`) with body `{paymentRef: str = Field(..., min_length=3)}` (payment ref mandatory). All amounts integer paisa. If the settlement's net amount exceeds ₹50,000 (`5_000_000` paisa), route through `approvals.maybe_require_approval` so a second, distinct admin must approve before the paid status is written (SOP-25 §6.3 dual sign-off). Audit with `previousState`/`newState` (`module="settlements"`, `action="mark-paid"`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 3.12 — Add manual settlement batch-run endpoint
- DO: in `backend/app/routers/admin.py` add `POST /jobs/settlements/run` (`Depends(admin_mutation_context)`, roles `superadmin`, `finance_admin`) with body `{periodStart: str | None, periodEnd: str | None}` (ISO dates) that calls `app.services.settlements.run_settlements` with the given or default previous-week window (same defaulting logic as `backend/app/routers/jobs.py`) and returns its summary. Audit the run (`module="settlements"`, `action="batch-run"`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 3.13 — Add commission config edit endpoint
- DO: in `backend/app/routers/admin.py` add `GET /platform-config/commissions` and `PUT /platform-config/commissions` over the `platform_config/settlements` doc (defaults: Transporter 10%, Equipment 12%, Broker 2%). PUT body: `{rates: {transporterPct, equipmentPct, brokerPct}, effectiveFrom: str (ISO date)}`. Every edit creates a NEW versioned entry (keep prior versions with their `effectiveFrom`/`effectiveTo` — never overwrite history) and routes through `approvals.maybe_require_approval` plus audit with `previousState`/`newState` (`module="settlements"`, `action="commission-config"`). Guard: `require_admin_role("superadmin", "finance_admin")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 3.14 — Add cron job logs endpoint
- DO: in `backend/app/routers/admin.py` add `GET /jobs/cron-logs` returning recent `cron_job_logs` docs (job name, ran-at, status, summary) newest-first with `page`/`pageSize`. Guard: `require_admin_role("superadmin", "finance_admin", "operations_lead")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 3.15 — Create settlement console test suite
- DO: create `backend/tests/test_admin_settlements.py` (new): (a) `POST /v1/admin/jobs/settlements/run` produces settlement rows in the `settlements` collection; (b) `POST /v1/admin/settlements/{id}/mark-paid` with a payment ref marks the row paid and writes the audit entry; (c) a money action with `amountPaise: 2_000_000` (over ₹10,000) creates a pending `admin_approvals` doc instead of executing; (d) `mark-paid` on a settlement over ₹50,000 requires the second distinct admin's approval before the paid status is written; (e) a commission `PUT` produces a versioned entry with `effectiveFrom` and two audit entries (request + approval).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin_settlements.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the implementation, never the assertions — else STOP (playbook §5).
- [ ]

### Task 3.16 — Test mandi band flag and refund idempotency
- DO: append to `backend/tests/test_admin_settlements.py`: (a) a `vyapari_rates` submission 20% above the Agmarknet modal price appears in `GET /v1/admin/mandi/rates` with `outOfBand: true`, and one within ±15% has `outOfBand: false`; (b) two `POST /v1/admin/orders/{id}/refund` calls with the SAME `Idempotency-Key` produce the same response and only one money movement (assert the settlement/escrow record count stays 1); (c) a refund without `Idempotency-Key` → 422.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin_settlements.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the implementation, never the assertions — else STOP (playbook §5).
- [ ]

### Task 3.17 — Create mandi rates page
- DO: create `website/src/views/admin/MandiRatesPage.tsx` (new): a `DataGrid` over new `adminApi.getMandiRates(params)` (add to `website/src/lib/api/admin.ts`) with the modal price and `outOfBand` badge columns (out-of-band rows visually flagged); approve/reject actions via `ConfirmActionModal` calling new `adminApi.approveMandiRate(id, reason, role)` / `adminApi.rejectMandiRate(id, reason, role)`. All strings via `t()` (`admin.mandi.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 3.18 — Create lots and deals page
- DO: create `website/src/views/admin/LotsDealsPage.tsx` (new): tabbed `DataGrid`s over new `adminApi.getLots(params)` / `adminApi.getDeals(params)`; deal rows offer an "Escalate to dispute" action via `ConfirmActionModal` calling new `adminApi.escalateDeal(id, reason, role)` (add all three to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.lots.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 3.19 — Create marketplace orders page
- DO: create `website/src/views/admin/OrdersPage.tsx` (new): a `DataGrid` over new `adminApi.getOrders(params)`; row drawer shows order detail and a refund action via `ConfirmActionModal` calling new `adminApi.refundOrder(id, amountPaise, reason, role)` (amount entered in rupees, converted to integer paisa before sending — never a float). All strings via `t()` (`admin.orders.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 3.20 — Create buyer verification page
- DO: create `website/src/views/admin/BuyersPage.tsx` (new): a `DataGrid` over new `adminApi.getBuyers(params)` with verify/suspend actions via `ConfirmActionModal` calling new `adminApi.verifyBuyer(id, reason, role)` / `adminApi.suspendBuyer(id, reason, role)` (add to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.buyers.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 3.21 — Create transport fleet page
- DO: create `website/src/views/admin/FleetPage.tsx` (new): a `DataGrid` over new `adminApi.getVehicles(params)` showing RC/insurance/fitness document status columns; verify-vehicle and suspend-transporter actions via `ConfirmActionModal` calling new `adminApi.verifyVehicle(id, reason, role)` / `adminApi.suspendTransporter(id, reason, role)` (add to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.fleet.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 3.22 — Create equipment oversight page
- DO: create `website/src/views/admin/EquipmentPage.tsx` (new): a `DataGrid` over new `adminApi.getEquipment(params)` with an "Escalate slot dispute" row action via `ConfirmActionModal` calling new `adminApi.escalateEquipmentBooking(id, reason, role)` (add to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.equipment.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 3.23 — Create settlements and payout console page
- DO: create `website/src/views/admin/SettlementsPage.tsx` (new) with four sections: (1) a `DataGrid` over new `adminApi.getSettlements({status})` with status tabs pending/approved/paid; (2) a holds section from the same response (empty-state message when empty — no fabricated rows) with an approve-hold action via `ConfirmActionModal`; (3) a "Run weekly batch" form (start/end ISO dates) via `ConfirmActionModal` calling new `adminApi.runSettlementBatch(periodStart, periodEnd, reason, role)`; (4) a commission editor (Transporter/Equipment/Broker percentages + `effectiveFrom` date) saving via `ConfirmActionModal` to new `adminApi.putCommissions(payload, reason, role)`, and a cron-logs table from new `adminApi.getCronLogs()`. Mark-paid uses new `adminApi.markSettlementPaid(id, paymentRef, reason, role)` (payment ref mandatory in the modal). Add all six functions to `website/src/lib/api/admin.ts`. All strings via `t()` (`admin.settlements.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 3.24 — Register WS-03 routes under AdminShell
- DO: in `website/src/App.tsx`, under the `/admin` route, add child routes: `/admin/mandi` → `MandiRatesPage`, `/admin/lots` → `LotsDealsPage`, `/admin/orders` → `OrdersPage`, `/admin/buyers` → `BuyersPage`, `/admin/fleet` → `FleetPage`, `/admin/equipment` → `EquipmentPage`, `/admin/settlements` → `SettlementsPage` — each wrapped in `RequireAdminRole` with the roles from its `ADMIN_MODULES` entry.
- RUN: `cd website && pnpm exec tsc --noEmit && grep -c 'path="/admin/' src/App.tsx`
- EXPECT: `tsc` exits 0; grep prints a count of at least 15.
- IF FAIL: fix the route registrations — else STOP (playbook §5).
- [ ]

### Task 3.25 — Add WS-03 locale keys (en + hi)
- DO: append to `website/src/lib/i18n/locales/en.admin.ts` and `website/src/lib/i18n/locales/hi.admin.ts` the identical set of `admin.mandi.*`, `admin.lots.*`, `admin.orders.*`, `admin.buyers.*`, `admin.fleet.*`, `admin.equipment.*`, and `admin.settlements.*` keys used by the Task 3.17–3.23 pages — English values in en, Hindi values in hi.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/en.admin.ts | sort) <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/hi.admin.ts | sort)`
- EXPECT: `tsc` exits 0; `diff` exits 0 with no output.
- IF FAIL: add the missing key(s) shown by the diff — else STOP (playbook §5).
- [ ]

### Task 3.26 — HUMAN CHECK: settlement batch and payout flow
- DO: HUMAN CHECK — ask the operator to run, in order:
  1. Start the API: `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`.
  2. In the admin console as `finance_admin`, open `/admin/settlements` and run a weekly batch — confirm settlement rows appear.
  3. Approve one hold with reason + MPIN — if it exceeds ₹10,000, confirm a second distinct admin must approve it under maker-checker.
  4. Mark one settlement paid with a payment ref — confirm the row shows paid.
  5. Open `GET /v1/admin/audit?module=settlements` — confirm the complete audit trail (batch run, hold approval, mark-paid).
- RUN: none (human-executed; executor records the outcome).
- EXPECT: the human confirms all five steps behaved as listed.
- IF FAIL: record which step failed with full output and STOP (playbook §5).
- [ ]

### Task 3.27 — WS-03 checkpoint: full verification and commit
- DO: run the WS-03 Verification block from instructions.md, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-07 WS-03: P2 commercial modules (mandi, lots, orders, buyers, fleet, equipment, settlements)"`
- EXPECT: backend suite fully green (including `test_admin_settlements.py`); `tsc` and `pnpm build` exit 0; commit succeeds.
- IF FAIL: fix the failing test/build error first — if `git commit` fails only for identity reasons, note it and continue (playbook §6) — else STOP (playbook §5).
- [ ]

## WS-04 — P3 agronomy/AI modules + M22 dispute triage  (see instructions.md §WS-04)

### Task 4.1 — Verify WS-04 prerequisite files
- PRECONDITION: `test -d backend/app/services/ai && test -f backend/app/routers/land.py && test -f backend/app/routers/advisory.py && test -f backend/app/routers/chatbot.py && test -f backend/app/routers/land_records.py && test -f backend/app/routers/water.py && test -f backend/app/routers/climate.py && test -f backend/app/routers/purchases.py && test -f backend/app/routers/transport.py && test -d backend/app/services/disease_model && test -f backend/app/services/approvals.py` — if this fails, STOP the phase (playbook §5).
- DO: no file changes. Read `backend/app/services/disease_model/` and the M22 brief section in `missing-features/ai_implementation_plan.md` §5 before starting Task 4.2.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai import gateway, question_sets, privacy"`
- EXPECT: exit 0, no output.
- IF FAIL: STOP (playbook §5) and report the missing module.
- [ ]

### Task 4.2 — Add land-leasing disputes grid endpoint
- DO: in `backend/app/routers/admin.py` add `GET /land/leases?status=` over `land_plots`, `land_leases`, and `land_lease_payments`, each lease row cross-checked against `land_records_712` with a `recordMismatch: true` flag when the listing does not match the registry record. Guard: `require_admin_role("superadmin", "operations_lead", "compliance_officer")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 4.3 — Add advisory and disease model ops endpoints
- DO: in `backend/app/routers/admin.py` add, guarded by `require_admin_role("superadmin", "agronomist", "scientist")`: `GET /advisory/scans/accuracy` (accuracy monitor over `advisory_scans` — feedback false-positive rate), `POST /advisory/pest-alerts` (`Depends(admin_mutation_context)`, dispatch over `pest_alerts`, audit `module="advisory"`), and `GET /advisory/soil-tests?status=pending` plus `POST /advisory/soil-tests/{id}/validate` (`Depends(admin_mutation_context)`, audit).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 4.4 — Add chatbot transcript viewer endpoints
- DO: in `backend/app/routers/admin.py` add read-only `GET /chatbot/sessions` (page/pageSize over `chatbot_sessions`) and `GET /chatbot/sessions/{id}` (full transcript from `chatbot_messages`) for safety review. Guard: `require_admin_role("superadmin", "content_moderator", "compliance_officer")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 4.5 — Add chatbot prompt-config editor endpoints
- DO: in `backend/app/routers/admin.py` add `GET /chatbot/prompt-config` and `PUT /chatbot/prompt-config` (`Depends(admin_mutation_context)`). The PUT is a maker-checkered config change: route it through `app.services.approvals.maybe_require_approval` and audit with `previousState`/`newState` (`module="chatbot"`, `action="prompt-config"`). Guard: `require_admin_role("superadmin", "content_moderator")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 4.6 — Add expert SLA tracking and roster editor
- DO: in `backend/app/routers/admin.py`: (a) extend the existing `/expert-handoffs` list and resolve handlers so each ticket row carries `slaDueAt` and a computed `slaBreached: boolean`; (b) add `GET /experts` and `PUT /experts/{id}` (roster editor over `expert_tickets`/`experts`) via `Depends(admin_mutation_context)` with audit (`module="experts"`). Guard: `require_admin_role("superadmin", "agronomist", "content_moderator")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 4.7 — Add 7/12 gateway health probe and endpoint
- DO: first run `grep -rn "health\|probe\|latency" backend/app/services/land_records/`. If usable health signals exist, add `GET /land-records/health` in `backend/app/routers/admin.py` reading them. If none exist, create `backend/app/services/gateway_health.py` (new) with `async def probe_land_records() -> dict` recording `{checkedAt (ISO), available: bool, latencyMs: int}` into a `gateway_health` collection, add a cron endpoint `POST /jobs/gateway-health/run` in `backend/app/routers/jobs.py` following that file's exact `X-Cron-Secret` pattern, and make `GET /land-records/health` return the latest probe rows. Guard: `require_admin_role("superadmin", "operations_lead", "agronomist")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the probe/endpoint until green — else STOP (playbook §5).
- [ ]

### Task 4.8 — Add water/canal schedule editor endpoints
- DO: in `backend/app/routers/admin.py` add `GET /water/schedules` over `canal_schedules` and `water_schedules`, and `PUT /water/schedules/{id}` (rotation editor) via `Depends(admin_mutation_context)` with audit (`module="water"`). Guard: `require_admin_role("superadmin", "operations_lead")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 4.9 — Add climate/cold storage manager endpoints
- DO: in `backend/app/routers/admin.py` add `GET /cold-storages`, `POST /cold-storages`, and `PUT /cold-storages/{id}` (directory manager over `cold_storages` — fields capacity MT, temperature ranges, monthly rates as integer paisa), plus read-only `GET /climate/varieties` over `climate_varieties`. Mutations via `Depends(admin_mutation_context)` with audit (`module="climate"`). Guard: `require_admin_role("superadmin", "operations_lead")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 4.10 — Register dispute triage question set
- DO: in `backend/app/services/ai/question_sets.py` register `dispute.triage.v1` following the file's existing registration pattern: a judgement set whose output schema is `{category: str, urgency: "low" | "medium" | "high", liabilityHint: str}` and whose documented fallback is "route to `operations_lead` queue, urgency medium". Do not modify any existing question set.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai import question_sets; print('ok')"`
- EXPECT: exit 0 and the module imports cleanly after the edit.
- IF FAIL: re-read `question_sets.py`, match its exact idiom, retry once — if the file's API contradicts this task, STOP (playbook §5).
- [ ]

### Task 4.11 — Create unified disputes collection adapters
- DO: create `backend/app/services/disputes.py` (new) with: the canonical dispute doc shape `{id, source, sourceId, category, urgency, liabilityHint, status: "open", routedRole, slaDueAt, summary, createdAt}`; `async def ingest_dispute(source: str, source_id: str, payload: dict) -> dict` writing to the `disputes` collection; and one adapter per surface — `ingest_purchase_dispute`, `ingest_transport_dispute`, `ingest_land_dispute`, `ingest_equipment_dispute` — each mapping its surface's record (from `routers/purchases.py`, `routers/transport.py`, land-leasing, equipment) into the canonical shape. Where a phase-02/03 surface is not yet live (check its router for a dispute-creation path first), that adapter exists but is only exercised behind the admin console's empty-state stub — never fabricate dispute rows.
- RUN: `cd backend && .venv/bin/python -c "from app.services.disputes import ingest_dispute, ingest_purchase_dispute, ingest_transport_dispute, ingest_land_dispute, ingest_equipment_dispute"`
- EXPECT: exit 0, no output.
- IF FAIL: fix `disputes.py` until the import passes — else STOP (playbook §5).
- [ ]

### Task 4.12 — Wire AI triage on dispute open
- DO: in `backend/app/services/disputes.py` add `async def triage_dispute(dispute: dict) -> dict`: call `gateway.decide(state, "dispute.triage.v1", ctx)` (state via `privacy.py`) and set `category`, `urgency`, `liabilityHint`, and `routedRole` (mapping the category to `compliance_officer` / `finance_admin` / `operations_lead`) plus `slaDueAt` (ISO timestamp, urgency-based SLA clock); on ANY gateway exception, apply the question set's fallback (route to `operations_lead`, urgency medium) instead of failing. Call `triage_dispute` from `ingest_dispute` after the doc is written. The AI output is routing annotation only (`suggest`-level) — it never resolves a dispute.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -c "import asyncio; from app.services.disputes import triage_dispute; print(asyncio.run(triage_dispute({'id': 'd1', 'summary': 'test', 'source': 'purchase'})))" `
- EXPECT: exit 0; the printed dict contains `routedRole` and `slaDueAt` keys.
- IF FAIL: fix `triage_dispute` until the smoke check passes on shim — else STOP (playbook §5).
- [ ]

### Task 4.13 — Add dispute console endpoints
- DO: in `backend/app/routers/admin.py` add `GET /disputes?role=&status=` (each row carries `slaDueAt` and computed `slaBreached`; when `role` is given, filter to that RBAC queue), `GET /disputes/{id}` (detail incl. the AI `summary`, `category`, `urgency`, `liabilityHint`, and evidence links to the source record), and `POST /disputes/{id}/resolve` (`Depends(admin_mutation_context)`, human decision only, audit `module="disputes"` with `previousState`/`newState`). Guard: `require_admin_role("superadmin", "compliance_officer", "finance_admin", "operations_lead")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 4.14 — Create dispute triage test suite
- DO: create `backend/tests/test_admin_disputes.py` (new) with `AI_PROVIDER=shim`: (a) routing matrix — a dispute ingested from each surface (purchase, transport, land-leasing, equipment) lands in the correct RBAC queue on shim; (b) every triaged dispute has an `slaDueAt` field; (c) fallback test — monkeypatch the gateway to raise, ingest a dispute, and assert it is routed to the `operations_lead` queue with urgency `medium`; (d) resolve flow writes an audit entry; (e) an `agronomist` token gets 403 on `/v1/admin/disputes`.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_admin_disputes.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the implementation, never the assertions — else STOP (playbook §5).
- [ ]

### Task 4.15 — Create land-leasing disputes page
- DO: create `website/src/views/admin/LandLeasesPage.tsx` (new): a `DataGrid` over new `adminApi.getLandLeases(params)` with a `recordMismatch` badge column; row drawer links mismatched rows to the dispute inbox. All strings via `t()` (`admin.land.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 4.16 — Create advisory model ops page
- DO: create `website/src/views/admin/AdvisoryOpsPage.tsx` (new): accuracy monitor table from new `adminApi.getScanAccuracy()` (false-positive rate per model), pest-alert dispatch form via `ConfirmActionModal` calling new `adminApi.dispatchPestAlert(payload, reason, role)`, and a soil-tests validation list from new `adminApi.getSoilTests(params)` with a validate action calling new `adminApi.validateSoilTest(id, reason, role)` (add all four to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.advisory.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 4.17 — Create chatbot ops page
- DO: create `website/src/views/admin/ChatbotOpsPage.tsx` (new) with three tabs: (1) transcripts — a `DataGrid` over new `adminApi.getChatbotSessions(params)` with a read-only transcript drawer via `adminApi.getChatbotSession(id)`; (2) prompt config — an editor saving via `ConfirmActionModal` to new `adminApi.putPromptConfig(payload, reason, role)` (maker-checkered server-side); (3) experts — the handoff list from `adminApi.getExpertHandoffs()` with SLA-breach rows visually highlighted, plus a roster editor saving to new `adminApi.putExpert(id, payload, reason, role)` (add all five to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.chatbot.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 4.18 — Create gateway health and water pages
- DO: create `website/src/views/admin/LandRecordsHealthPage.tsx` (new) — availability/latency table from new `adminApi.getLandRecordsHealth()` — and `website/src/views/admin/WaterSchedulesPage.tsx` (new) — a rotation editor over new `adminApi.getWaterSchedules()` saving via `ConfirmActionModal` to new `adminApi.putWaterSchedule(id, payload, reason, role)` (add all three to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.landrecords.*`, `admin.water.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 4.19 — Create cold storage and climate page
- DO: create `website/src/views/admin/ColdStoragePage.tsx` (new): a directory manager over new `adminApi.getColdStorages()` with add/edit forms (capacity MT, temperature ranges, monthly rate in rupees converted to integer paisa before sending) saving via `ConfirmActionModal` to new `adminApi.createColdStorage(payload, reason, role)` / `adminApi.putColdStorage(id, payload, reason, role)`, plus a read-only `climate_varieties` table from new `adminApi.getClimateVarieties()` (add all four to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.climate.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 4.20 — Create unified dispute inbox page
- DO: create `website/src/views/admin/DisputesInboxPage.tsx` (new): a `DataGrid` over new `adminApi.getDisputes({role, status})` with a queue selector (compliance/finance/operations), an SLA-clock column showing time to `slaDueAt` and breached rows highlighted; the `DetailDrawer` shows the AI summary, category/urgency/liability hint, and evidence links via new `adminApi.getDispute(id)`; a resolve action via `ConfirmActionModal` calling new `adminApi.resolveDispute(id, resolution, reason, role)` (add all three to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.disputes.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 4.21 — Register WS-04 routes under AdminShell
- DO: in `website/src/App.tsx`, under the `/admin` route, add child routes: `/admin/land` → `LandLeasesPage`, `/admin/advisory` → `AdvisoryOpsPage`, `/admin/chatbot` → `ChatbotOpsPage`, `/admin/land-records` → `LandRecordsHealthPage`, `/admin/water` → `WaterSchedulesPage`, `/admin/cold-storage` → `ColdStoragePage`, `/admin/disputes` → `DisputesInboxPage` — each wrapped in `RequireAdminRole` with the roles from its `ADMIN_MODULES` entry.
- RUN: `cd website && pnpm exec tsc --noEmit && grep -c 'path="/admin/' src/App.tsx`
- EXPECT: `tsc` exits 0; grep prints a count of at least 22.
- IF FAIL: fix the route registrations — else STOP (playbook §5).
- [ ]

### Task 4.22 — Add WS-04 locale keys (en + hi)
- DO: append to `website/src/lib/i18n/locales/en.admin.ts` and `website/src/lib/i18n/locales/hi.admin.ts` the identical set of `admin.land.*`, `admin.advisory.*`, `admin.chatbot.*`, `admin.landrecords.*`, `admin.water.*`, `admin.climate.*`, and `admin.disputes.*` keys used by the Task 4.15–4.20 pages — English values in en, Hindi values in hi.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/en.admin.ts | sort) <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/hi.admin.ts | sort)`
- EXPECT: `tsc` exits 0; `diff` exits 0 with no output.
- IF FAIL: add the missing key(s) shown by the diff — else STOP (playbook §5).
- [ ]

### Task 4.23 — HUMAN CHECK: dispute triage flow
- DO: HUMAN CHECK — ask the operator to run, in order:
  1. Start the API: `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (with `AI_PROVIDER=shim`).
  2. In the dev app, open a transport dispute (or ingest one via the transport adapter).
  3. In the admin console as `operations_lead`, open `/admin/disputes` — confirm the dispute appears in the operations queue with a visible SLA clock and the AI summary in the drawer.
  4. Resolve it with a reason — confirm `GET /v1/admin/audit?module=disputes` shows the resolve entry.
- RUN: none (human-executed; executor records the outcome).
- EXPECT: the human confirms all four steps behaved as listed.
- IF FAIL: record which step failed with full output and STOP (playbook §5).
- [ ]

### Task 4.24 — WS-04 checkpoint: full verification and commit
- DO: run the WS-04 Verification block from instructions.md, then commit.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-07 WS-04: P3 agronomy/AI modules + M22 dispute triage"`
- EXPECT: full backend suite green on shim (including `test_admin_disputes.py`); `tsc` and `pnpm build` exit 0; commit succeeds.
- IF FAIL: fix the failing test/build error first — if `git commit` fails only for identity reasons, note it and continue (playbook §6) — else STOP (playbook §5).
- [ ]

## WS-05 — P4 financial modules (banking/loans, insurance)  (see instructions.md §WS-05)

### Task 5.1 — Verify WS-05 prerequisite files
- PRECONDITION: `test -f backend/app/services/loans.py && test -d backend/app/services/bank_verify && test -f backend/app/routers/insurance_claims.py && test -f backend/app/services/claims.py && test -f backend/app/services/approvals.py && test -f backend/tests/test_admin_finance.py` — if this fails, STOP the phase (playbook §5).
- DO: no file changes. Read the existing `/admin/finance/loans` section of `backend/app/routers/admin.py` and `backend/app/services/claims.py` before starting Task 5.2.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin_finance.py -q`
- EXPECT: all tests pass (exit 0) — this is the pre-change baseline.
- IF FAIL: the baseline is red before any WS-05 change — STOP (playbook §5) and report.
- [ ]

### Task 5.2 — Add penny-drop failures grid endpoint
- DO: in `backend/app/routers/admin.py` add `GET /finance/bank-accounts?verification=failed` over the `bank_accounts` collection, surfacing penny-drop verification failure details from `backend/app/services/bank_verify/`. Guard: `require_admin_role("superadmin", "finance_admin", "compliance_officer")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 5.3 — Add penny-drop override endpoint
- DO: in `backend/app/routers/admin.py` add `POST /finance/bank-accounts/{id}/override-verify` (`Depends(admin_mutation_context)`, roles `superadmin`, `finance_admin`): marks a failed-but-valid account verified. Destructive safeguards: audit entry with full `previousState`/`newState` (`module="banking"`, `action="penny-drop-override"`); if the payload carries a money-affecting `amountPaise` over ₹10,000 (`1_000_000` paisa), route through `approvals.maybe_require_approval`. The website side calls `POST /admin/verify-mpin` before this endpoint (wired in Task 5.10 via `ConfirmActionModal`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 5.4 — Add KCC records viewer endpoint
- DO: in `backend/app/routers/admin.py` add read-only `GET /finance/kcc` over the `kcc_records` collection with `page`/`pageSize`. Guard: `require_admin_role("superadmin", "finance_admin", "compliance_officer")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 5.5 — Harden loans queue transitions
- DO: in `backend/app/routers/admin.py`, in the existing `/finance/loans` queue handlers: (a) keep all status transitions going through `loans_service.advance_status` (invalid transitions must still return 409); (b) enforce that every transition call carries a non-empty note (missing → 422); (c) route every transition through `log_admin_action` with `previousState`/`newState` (`module="loans"`). There must be NO auto-approve path anywhere in this console — credit decisions never exceed `require_confirm` automation (global rule 12).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin_finance.py -q && grep -nE "auto_?approve" app/routers/admin.py; test $? -eq 1`
- EXPECT: pytest green (existing invalid-transition 409 tests unchanged); the grep finds no auto-approve code in `admin.py`.
- IF FAIL: fix the handler wiring, never the existing assertions — else STOP (playbook §5).
- [ ]

### Task 5.6 — Add insurance claims desk endpoint
- DO: in `backend/app/routers/admin.py` add `GET /insurance/claims?status=` over `insurance_policies` and `insurance_claims` (review intimated claims) with `page`/`pageSize`. Guard: `require_admin_role("superadmin", "finance_admin", "compliance_officer")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py tests/test_admin_finance.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 5.7 — Extend claim adjudication with integer paisa
- DO: in `backend/app/routers/admin.py` extend the existing `ClaimAdjudicateIn` flow: (a) `assign_surveyor` requires `surveyorName` (missing → 422) and stores it visibly on the claim doc; (b) `approve` requires `approvedAmount` as an INTEGER in paisa — change the model field from `Optional[float]` to `Optional[int]` and update any caller/test payload that sent floats (contract change mandated by global rule 3 — update test VALUES, never delete assertions); (c) `reject` requires a reason; (d) all three actions go through `log_admin_action` (`module="insurance"`) and, for `approvedAmount` over ₹10,000, through `approvals.maybe_require_approval`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin_finance.py tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the model/handlers and any stale test payloads — else STOP (playbook §5).
- [ ]

### Task 5.8 — Add effective-dated insurance rate tables
- DO: in `backend/app/routers/admin.py` add `GET /insurance/rates?product=` and `POST /insurance/rates` (`Depends(admin_mutation_context)`) over the `insurance_rates` collection. Rows are versioned: `{product, rate, effectiveFrom, effectiveTo, createdBy}`. The POST validates that no overlapping row exists for the same product and date range (overlap → 409 `RATE_PERIOD_OVERLAP`) and closes the previous row's `effectiveTo`. Every edit routes through `approvals.maybe_require_approval` and audit (`module="insurance"`, `action="rate-table"`). Guard: `require_admin_role("superadmin", "finance_admin")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 5.9 — Add rate-table and override tests
- DO: append to `backend/tests/test_admin_finance.py`: (a) posting two overlapping `insurance_rates` rows for the same product/date → second returns 409 `RATE_PERIOD_OVERLAP`; (b) a posted rate row carries `effectiveFrom` and `createdBy`, and the prior row's `effectiveTo` was closed; (c) a rate-table edit creates a pending `admin_approvals` doc (maker-checker); (d) the penny-drop override writes an audit entry with `reason`, non-null `previousState`, and `newState`; (e) all pre-existing tests in the file still pass unmodified in their assertions.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin_finance.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the implementation, never the assertions — else STOP (playbook §5).
- [ ]

### Task 5.10 — Create banking oversight page
- DO: create `website/src/views/admin/BankingPage.tsx` (new): a `DataGrid` over new `adminApi.getBankAccounts({verification: 'failed'})` showing penny-drop failure details; an override action via `ConfirmActionModal` (reason + MPIN — the modal already calls `verifyMpin`) calling new `adminApi.overrideBankAccount(id, reason, role)`; plus a read-only KCC records tab from new `adminApi.getKccRecords(params)` (add all three to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.banking.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 5.11 — Create loans queue page
- DO: create `website/src/views/admin/LoansPage.tsx` (new): a `DataGrid` over the existing `GET /admin/finance/loans` data via new `adminApi.getLoans(params)`; status-transition actions via `ConfirmActionModal` with a mandatory note field calling new `adminApi.transitionLoan(id, status, note, reason, role)` (add both to `website/src/lib/api/admin.ts`); surface the 409 error message from the standard envelope on invalid transitions. All strings via `t()` (`admin.loans.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 5.12 — Create insurance claims page
- DO: create `website/src/views/admin/InsuranceClaimsPage.tsx` (new): a `DataGrid` over new `adminApi.getInsuranceClaims(params)`; the `DetailDrawer` shows claim detail incl. the assigned surveyor name; actions via `ConfirmActionModal` calling new `adminApi.adjudicateClaim(id, {action, surveyorName?, approvedAmountPaise?, rejectionReason?}, reason, role)` — approve amount entered in rupees and converted to integer paisa before sending (add both to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.insurance.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 5.13 — Create insurance rate tables page
- DO: create `website/src/views/admin/InsuranceRatesPage.tsx` (new): a versioned rate-table view from new `adminApi.getInsuranceRates(product)` showing `rate`, `effectiveFrom`, `effectiveTo`, `createdBy` per row; a new-rate form (product, rate, effectiveFrom) saving via `ConfirmActionModal` to new `adminApi.createInsuranceRate(payload, reason, role)` and surfacing the 409 `RATE_PERIOD_OVERLAP` error (add both to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.rates.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 5.14 — Register WS-05 routes under AdminShell
- DO: in `website/src/App.tsx`, under the `/admin` route, add child routes: `/admin/banking` → `BankingPage`, `/admin/loans` → `LoansPage`, `/admin/insurance` → `InsuranceClaimsPage`, `/admin/insurance-rates` → `InsuranceRatesPage` — each wrapped in `RequireAdminRole` with the roles from its `ADMIN_MODULES` entry.
- RUN: `cd website && pnpm exec tsc --noEmit && grep -c 'path="/admin/' src/App.tsx`
- EXPECT: `tsc` exits 0; grep prints a count of at least 26.
- IF FAIL: fix the route registrations — else STOP (playbook §5).
- [ ]

### Task 5.15 — Add WS-05 locale keys (en + hi)
- DO: append to `website/src/lib/i18n/locales/en.admin.ts` and `website/src/lib/i18n/locales/hi.admin.ts` the identical set of `admin.banking.*`, `admin.loans.*`, `admin.insurance.*`, and `admin.rates.*` keys used by the Task 5.10–5.13 pages — English values in en, Hindi values in hi.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/en.admin.ts | sort) <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/hi.admin.ts | sort)`
- EXPECT: `tsc` exits 0; `diff` exits 0 with no output.
- IF FAIL: add the missing key(s) shown by the diff — else STOP (playbook §5).
- [ ]

### Task 5.16 — HUMAN CHECK: penny-drop override flow
- DO: HUMAN CHECK — ask the operator to run, in order:
  1. Start the API: `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`.
  2. In the dev app, fail a penny-drop verification on a test bank account.
  3. In the admin console as `finance_admin`, open `/admin/banking`, find the failed account, and override it with reason + MPIN.
  4. Confirm the account now shows verified and `GET /v1/admin/audit?module=banking` shows the override with reason and previous/new state.
- RUN: none (human-executed; executor records the outcome).
- EXPECT: the human confirms all four steps behaved as listed.
- IF FAIL: record which step failed with full output and STOP (playbook §5).
- [ ]

### Task 5.17 — WS-05 checkpoint: full verification and commit
- DO: run the WS-05 Verification block from instructions.md, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-07 WS-05: P4 financial modules (banking/loans, insurance)"`
- EXPECT: backend suite fully green (existing `test_admin_finance.py` not regressed; new rate-table tests pass); `tsc` and `pnpm build` exit 0; commit succeeds.
- IF FAIL: fix the failing test/build error first — if `git commit` fails only for identity reasons, note it and continue (playbook §6) — else STOP (playbook §5).
- [ ]

## WS-06 — P5 ecosystem modules (FPO, vets, CMS, trees, gamification, SHGs, courses)  (see instructions.md §WS-06)

### Task 6.1 — Verify WS-06 prerequisite files
- PRECONDITION: `test -f backend/app/routers/fpo.py && test -f backend/app/routers/livestock_vets.py && test -f backend/app/routers/content.py && test -f backend/app/routers/courses.py && test -f backend/app/routers/tree.py && test -f backend/app/routers/gamification.py && test -f backend/app/routers/referrals.py && test -f backend/app/routers/women.py && test -f backend/app/services/coins.py && test -f backend/app/services/referrals.py` — if this fails, STOP the phase (playbook §5).
- DO: no file changes. Read the existing `/admin/courses/*` section of `backend/app/routers/admin.py` before starting Task 6.2.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0) — pre-change baseline.
- IF FAIL: the baseline is red before any WS-06 change — STOP (playbook §5) and report.
- [ ]

### Task 6.2 — Add FPO verification endpoints
- DO: in `backend/app/routers/admin.py` add `GET /fpos?status=pending` over `fpos` (surfacing ROC/Nabard/SFAC certificate fields), `POST /fpos/{id}/verify` and `POST /fpos/{id}/reject` (reject requires a reason) via `Depends(admin_mutation_context)` with audit (`module="fpo"`), and read-only `GET /fpos/{id}/pools` over `fpo_pools` and `fpo_pool_members`. Guard: `require_admin_role("superadmin", "operations_lead")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 6.3 — Add vet credential verification endpoints
- DO: in `backend/app/routers/admin.py` add `GET /vets?status=pending` over `vets` (surfacing B.V.Sc degree and State Veterinary Council registration fields), `POST /vets/{id}/verify` and `POST /vets/{id}/reject` via `Depends(admin_mutation_context)` with audit (`module="vets"`), and read-only `GET /gaushalas` and `GET /nurseries` directory oversight. Guard: `require_admin_role("superadmin", "operations_lead")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 6.4 — Add content CMS endpoints
- DO: in `backend/app/routers/admin.py` add, guarded by `require_admin_role("superadmin", "content_moderator")` and `Depends(admin_mutation_context)` for mutations (audit `module="content"`): `GET /content/news`, `POST /content/news` and `PUT /content/news/{id}` (publish, edit, schedule `agri_news` incl. breaking-news tags), `POST /content/channels/{id}/moderate` (stream moderation over `agri_channels`), and `GET /content/workshops` + `PUT /content/workshops/{id}` (workshop curation over `workshops`).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 6.5 — Add tree/NGO sapling endpoints
- DO: in `backend/app/routers/admin.py` add `GET /ngos?status=pending` + `POST /ngos/{id}/verify` (verify NGOs/nurseries over `ngos`), `GET /sapling-requests?status=` + `POST /sapling-requests/{id}/review` (review sapling requests), and read-only `GET /biofuel-trees` over `biofuel_trees`. Mutations via `Depends(admin_mutation_context)` with audit (`module="trees"`). Guard: `require_admin_role("superadmin", "operations_lead", "content_moderator")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 6.6 — Add gamification circulation and adjust endpoints
- DO: in `backend/app/routers/admin.py` add `GET /gamification/circulation` (platform-wide AgriCoins daily mint/burn totals aggregated from `agri_coins_ledger`) and `POST /gamification/adjust` (`Depends(admin_mutation_context)`, body `{uid, deltaCoins: int, reason}` — integer coins only, no floats) which routes through `approvals.maybe_require_approval` with `amountPaise` set to the rupee-equivalent of the adjustment so adjustments above the ₹10,000-equivalent threshold need a second admin, applies the adjustment via `app.services.coins`, and audit-logs (`module="gamification"`). Guard: `require_admin_role("superadmin", "content_moderator", "finance_admin")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 6.7 — Add referral-fraud review endpoint
- DO: in `backend/app/routers/admin.py` add `GET /gamification/referral-fraud` over `reward_coupons` plus referral records (via `app.services.referrals`), including A6 fraud soft-holds ONLY when the phase-06 fraud surface exists (check first) — otherwise that section returns an empty list (stub fallback, no fabricated rows). Guard: `require_admin_role("superadmin", "content_moderator", "compliance_officer")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 6.8 — Add women SHG verification endpoints
- DO: in `backend/app/routers/admin.py` add `GET /shgs?status=pending` over `women_shgs` (surfacing registration docs, bank accounts, cluster federation linkage), `POST /shgs/{id}/verify` and `POST /shgs/{id}/reject` via `Depends(admin_mutation_context)` with audit (`module="shg"`), and read-only `GET /shgs/{id}/deposits` over `shg_deposits` and `GET /shgs/{id}/enterprises` over `home_enterprises`. Guard: `require_admin_role("superadmin", "operations_lead", "finance_admin")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoints until green — else STOP (playbook §5).
- [ ]

### Task 6.9 — Migrate course moderation onto WS-01 helpers
- DO: in `backend/app/routers/admin.py`, migrate the existing `/courses/queue`, `/courses/{id}/review` (publish/reject with reason), `/courses/{id}/feature`, and `/courses/report` (GMV, commission, instructor earnings) handlers onto the WS-01 helpers WITHOUT changing behavior: guard with `require_admin_role("superadmin", "compliance_officer")` per SOP-27, enforce `X-Audit-Reason` via `Depends(admin_mutation_context)` on the mutations, and use `log_admin_action` (`module="courses"`). The report's numbers must be byte-identical before and after the migration.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0) — existing admin course tests unregressed.
- IF FAIL: a behavior change crept in — `git diff backend/app/routers/admin.py` and restore the original response shapes while keeping the helper wiring — else STOP (playbook §5).
- [ ]

### Task 6.10 — Add course report regression test
- DO: append to `backend/tests/test_admin.py` (or the existing course admin test location — match where the current course tests live): a regression test seeding a fixed set of courses/orders and asserting `GET /v1/admin/courses/report` returns the exact expected GMV, commission, and instructor-earnings numbers (capturing the post-migration values as the baseline going forward).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: the migration changed report numbers — fix the handler until the numbers match the pre-migration behavior — else STOP (playbook §5).
- [ ]

### Task 6.11 — Create FPO and vets pages
- DO: create `website/src/views/admin/FpoPage.tsx` (new) — a `DataGrid` over new `adminApi.getFpos(params)` with certificate columns, verify/reject via `ConfirmActionModal` calling new `adminApi.verifyFpo(id, reason, role)` / `adminApi.rejectFpo(id, reason, role)`, and a pools tab from new `adminApi.getFpoPools(id)` — and `website/src/views/admin/VetsPage.tsx` (new) — a `DataGrid` over new `adminApi.getVets(params)` with qualification columns and verify/reject via new `adminApi.verifyVet(id, reason, role)` / `adminApi.rejectVet(id, reason, role)`, plus read-only gaushala/nursery tabs from new `adminApi.getGaushalas()` / `adminApi.getNurseries()` (add all eight to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.fpo.*`, `admin.vets.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 6.12 — Create content CMS page
- DO: create `website/src/views/admin/ContentCmsPage.tsx` (new) with three tabs: (1) news — list from new `adminApi.getContentNews()` with publish/edit/schedule forms (incl. breaking-news tag toggle) saving via `ConfirmActionModal` to new `adminApi.createContentNews(payload, reason, role)` / `adminApi.putContentNews(id, payload, reason, role)`; (2) live channels — list with a moderate action via new `adminApi.moderateChannel(id, action, reason, role)`; (3) workshops — curation list saving via new `adminApi.putWorkshop(id, payload, reason, role)` (add all six to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.content.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 6.13 — Create trees and NGO page
- DO: create `website/src/views/admin/TreesPage.tsx` (new): NGO verification list from new `adminApi.getNgos(params)` with verify via `ConfirmActionModal` calling new `adminApi.verifyNgo(id, reason, role)`; a sapling-requests list from new `adminApi.getSaplingRequests(params)` with review action calling new `adminApi.reviewSaplingRequest(id, decision, reason, role)`; and a read-only biofuel-trees table from new `adminApi.getBiofuelTrees()` (add all five to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.trees.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 6.14 — Create gamification page
- DO: create `website/src/views/admin/GamificationPage.tsx` (new): (1) a circulation dashboard from new `adminApi.getCoinCirculation()` showing daily mint/burn totals; (2) a manual-adjust form (uid + integer coin delta) via `ConfirmActionModal` calling new `adminApi.adjustCoins(uid, deltaCoins, reason, role)`; (3) a referral-fraud review queue from new `adminApi.getReferralFraud()` with an explicit empty-state message when the AI feed is absent (add all three to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.gamification.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 6.15 — Create women SHG and courses pages
- DO: create `website/src/views/admin/ShgPage.tsx` (new) — a `DataGrid` over new `adminApi.getShgs(params)` with verify/reject via `ConfirmActionModal` calling new `adminApi.verifyShg(id, reason, role)` / `adminApi.rejectShg(id, reason, role)`, and drawer tabs for deposits (`adminApi.getShgDeposits(id)`) and home enterprises (`adminApi.getShgEnterprises(id)`) — and `website/src/views/admin/CoursesPage.tsx` (new) — the existing course moderation queue UI over new `adminApi.getCourseQueue()`, review/feature actions via `ConfirmActionModal` calling new `adminApi.reviewCourse(id, decision, reason, role)` / `adminApi.featureCourse(id, reason, role)`, and the GMV/commission/earnings report table from new `adminApi.getCourseReport()` (add all ten to `website/src/lib/api/admin.ts`). All strings via `t()` (`admin.shg.*`, `admin.courses.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 6.16 — Register WS-06 routes under AdminShell
- DO: in `website/src/App.tsx`, under the `/admin` route, add child routes: `/admin/fpos` → `FpoPage`, `/admin/vets` → `VetsPage`, `/admin/content` → `ContentCmsPage`, `/admin/trees` → `TreesPage`, `/admin/gamification` → `GamificationPage`, `/admin/shgs` → `ShgPage`, `/admin/courses` → `CoursesPage` — each wrapped in `RequireAdminRole` with the roles from its `ADMIN_MODULES` entry.
- RUN: `cd website && pnpm exec tsc --noEmit && grep -c 'path="/admin/' src/App.tsx`
- EXPECT: `tsc` exits 0; grep prints a count of at least 33.
- IF FAIL: fix the route registrations — else STOP (playbook §5).
- [ ]

### Task 6.17 — Add WS-06 locale keys (en + hi)
- DO: append to `website/src/lib/i18n/locales/en.admin.ts` and `website/src/lib/i18n/locales/hi.admin.ts` the identical set of `admin.fpo.*`, `admin.vets.*`, `admin.content.*`, `admin.trees.*`, `admin.gamification.*`, `admin.shg.*`, and `admin.courses.*` keys used by the Task 6.11–6.15 pages — English values in en, Hindi values in hi.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/en.admin.ts | sort) <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/hi.admin.ts | sort)`
- EXPECT: `tsc` exits 0; `diff` exits 0 with no output.
- IF FAIL: add the missing key(s) shown by the diff — else STOP (playbook §5).
- [ ]

### Task 6.18 — HUMAN CHECK: content role gating
- DO: HUMAN CHECK — ask the operator to run, in order:
  1. Start the API: `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`.
  2. In the admin console as `content_moderator`, open `/admin/content` and publish a news article — confirm it appears in the news list.
  3. Log in as `finance_admin` and open `/admin/content` directly — confirm the 403/forbidden screen and that `curl -s http://localhost:8000/v1/admin/content/news -H "Authorization: Bearer <finance-token>"` returns HTTP 403.
- RUN: none (human-executed; executor records the outcome).
- EXPECT: the human confirms all three steps behaved as listed.
- IF FAIL: record which step failed with full output and STOP (playbook §5).
- [ ]

### Task 6.19 — WS-06 checkpoint: full verification and commit
- DO: run the WS-06 Verification block from instructions.md, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-07 WS-06: P5 ecosystem modules (FPO, vets, CMS, trees, gamification, SHGs, courses)"`
- EXPECT: backend suite fully green (existing admin course tests unregressed); `tsc` and `pnpm build` exit 0; commit succeeds.
- IF FAIL: fix the failing test/build error first — if `git commit` fails only for identity reasons, note it and continue (playbook §6) — else STOP (playbook §5).
- [ ]

## WS-07 — Admin copilot (M31)  (see instructions.md §WS-07)

### Task 7.1 — Verify WS-07 prerequisite files
- PRECONDITION: `test -d backend/app/services/ai && test -f backend/app/services/ai/gateway.py && test -f backend/app/routers/admin.py && test -f backend/app/routers/analytics.py` — if this fails, STOP the phase (playbook §5): the AI gateway is a phase-00/M1 deliverable.
- DO: no file changes. Read `backend/app/services/ai/gateway.py` and the M31 brief + ai.md §5.10 in `missing-features/ai_implementation_plan.md` before starting Task 7.2.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai import gateway; assert hasattr(gateway, 'generate')"`
- EXPECT: exit 0, no output.
- IF FAIL: the gateway does not expose `generate` as phase-00 specified — STOP (playbook §5) and report the contradiction.
- [ ]

### Task 7.2 — Create copilot whitelisted read-only tools
- DO: create `backend/app/services/copilot.py` (new) with: (a) four plain read-only async functions over Firestore — `get_kyc_backlog(by_state: bool = False)`, `get_settlement_holds()`, `get_fraud_queue()`, `get_scan_clusters(district: str | None = None, crop: str | None = None)` — each containing ONLY read calls (no `set_doc`/delete — read-only by construction); (b) a `TOOLS: dict[str, Callable]` whitelist mapping the four tool names to the functions; (c) `async def dispatch_tool(name: str, args: dict, role: str) -> dict` that raises `ValueError("TOOL_NOT_WHITELISTED")` for any `name` not in `TOOLS`, and filters each tool's result to data the caller's `role` may see before returning it.
- RUN: `cd backend && .venv/bin/python -c "from app.services.copilot import TOOLS, dispatch_tool; assert sorted(TOOLS) == ['get_fraud_queue', 'get_kyc_backlog', 'get_scan_clusters', 'get_settlement_holds']"`
- EXPECT: exit 0, no output.
- IF FAIL: fix `copilot.py` until the import and whitelist assertion pass — else STOP (playbook §5).
- [ ]

### Task 7.3 — Add SGR tool-call generation with fallback
- DO: in `backend/app/services/copilot.py` add `async def answer_query(prompt: str, role: str) -> dict`: call `gateway.generate(prompt, model="gemini-2.5-pro", json_schema=<tool-call schema>)` (the SGR recipe — all model calls through the gateway only); validate the tool-call output with a Pydantic model `CopilotToolCall {tool: str, args: dict}`; on validation failure retry ONCE with a repair prompt; on second failure return the static fallback: template text (en + hi) listing the four canned queries, with `"fallback": True` in the result. On success execute via `dispatch_tool` and return `{answer, tool, args, dataSource: tool name, asOf: ISO timestamp}`.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -c "import asyncio; from app.services.copilot import answer_query; r = asyncio.run(answer_query('show KYC backlog by state', 'superadmin')); assert 'asOf' in r"`
- EXPECT: exit 0, no assertion error (works on shim).
- IF FAIL: fix `answer_query` until the shim smoke check passes — else STOP (playbook §5).
- [ ]

### Task 7.4 — Add POST /admin/copilot/query endpoint
- DO: create `backend/app/routers/admin_copilot.py` (new) with `POST /copilot/query` (router prefix `/admin`, full path `/v1/admin/copilot/query`) guarded by `app.services.admin_auth.current_admin_user` (all admin tiers): body `{prompt: str = Field(..., min_length=3)}`; calls `copilot.answer_query(prompt, role=user["adminRole"])`; writes EVERY query plus the tools-called to `audit_logs` (via `log_admin_action`, `module="copilot"`, `action="query"`) and to `ai_decisions` with cost + confidence (via the gateway's decision logging from phase-00); returns the answer dict including `dataSource` and `asOf`. Register the router in `backend/app/main.py` with `app.include_router(admin_copilot.router, prefix="/v1")` next to the other admin includes.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint/registration until green — else STOP (playbook §5).
- [ ]

### Task 7.5 — Add nightly briefing generation
- DO: in `backend/app/services/copilot.py` add `async def generate_briefing() -> dict`: aggregate all four whitelisted tools into a briefing doc written to `admin_briefings/latest` in the shape of ai.md §5.10 (e.g. "KYC backlog 34 (MH 22), 2 payout anomalies held, disease cluster in Nashik onion") — a list of items, each `{text, deepLink, preTriage}` where `deepLink` is the `/admin/*` path of the owning queue and `preTriage` carries the tool's raw summary; the function must complete in under 60 seconds. Add a cron endpoint `POST /jobs/admin-briefing/run` in `backend/app/routers/jobs.py` following that file's exact `X-Cron-Secret` pattern, calling `generate_briefing`.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -c "import asyncio, time; from app.services.copilot import generate_briefing; t=time.time(); b=asyncio.run(generate_briefing()); assert time.time()-t < 60; assert isinstance(b, dict)"`
- EXPECT: exit 0 — briefing generates in under 60s on shim.
- IF FAIL: fix `generate_briefing` until the smoke check passes — else STOP (playbook §5).
- [ ]

### Task 7.6 — Add briefing read endpoint
- DO: in `backend/app/routers/admin_copilot.py` add `GET /copilot/briefing` (full path `/v1/admin/copilot/briefing`) guarded by `current_admin_user`, returning the `admin_briefings/latest` doc (404 `NOT_FOUND` with the standard envelope when no briefing has been generated yet).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 7.7 — Create copilot guardrail and flow tests
- DO: create `backend/tests/test_admin_copilot.py` (new) with `AI_PROVIDER=shim`: (a) guardrail — register a fake WRITE-capable tool (one that calls `set_doc`) into `copilot.TOOLS` inside the test and assert `POST /v1/admin/copilot/query` / `dispatch_tool` rejects executing it (only whitelisted read-only tools can execute); (b) a query with a canned shim tool-call returns an answer containing `dataSource` (tool name) and `asOf` timestamp; (c) every query writes an `audit_logs` entry (`module="copilot"`) and an `ai_decisions` record with cost + confidence; (d) results are role-scoped (a tool's output contains only data the caller's role may see); (e) `generate_briefing` produces the `admin_briefings/latest` doc with items carrying `deepLink` values starting with `/admin/`.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_admin_copilot.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the implementation, never the assertions — else STOP (playbook §5).
- [ ]

### Task 7.8 — Create copilot panel component
- DO: create `website/src/views/admin/CopilotPanel.tsx` (new): a chat-style query box posting to new `adminApi.copilotQuery(prompt, role)` (add to `website/src/lib/api/admin.ts`), rendering answer cards that CITE THEIR DATA SOURCE — each card shows the tool name and the as-of timestamp from the response; the static fallback (en/hi canned-query list) renders as a normal answer card when `"fallback": true`. All strings via `t()` (`admin.copilot.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 7.9 — Create briefing dashboard card
- DO: create `website/src/views/admin/BriefingCard.tsx` (new) rendering the briefing items from new `adminApi.getCopilotBriefing()` (add to `website/src/lib/api/admin.ts`), each item a link navigating to its `deepLink` admin queue; an empty-state message (via `t()`) when no briefing exists. Mount `BriefingCard` and `CopilotPanel` on `website/src/views/admin/AdminHomePage.tsx`. All strings via `t()` (`admin.briefing.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 7.10 — Add WS-07 locale keys (en + hi)
- DO: append to `website/src/lib/i18n/locales/en.admin.ts` and `website/src/lib/i18n/locales/hi.admin.ts` the identical set of `admin.copilot.*` and `admin.briefing.*` keys used by Tasks 7.8–7.9 (including the fallback canned-query list in both languages) — English values in en, Hindi values in hi.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/en.admin.ts | sort) <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/hi.admin.ts | sort)`
- EXPECT: `tsc` exits 0; `diff` exits 0 with no output.
- IF FAIL: add the missing key(s) shown by the diff — else STOP (playbook §5).
- [ ]

### Task 7.11 — HUMAN CHECK: copilot query and briefing deep link
- DO: HUMAN CHECK — ask the operator to run, in order:
  1. Start the API: `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (with `AI_PROVIDER=shim`).
  2. In the admin console home, ask the copilot "show KYC backlog by state" — confirm the answer card shows a data-source citation (tool name + timestamp).
  3. Trigger `curl -s -X POST http://localhost:8000/v1/jobs/admin-briefing/run` (add `-H "X-Cron-Secret: <secret>"` if `CRON_SECRET` is set) — confirm the briefing card on the admin home now lists items.
  4. Click a briefing item — confirm it lands in the correct admin queue.
- RUN: none (human-executed; executor records the outcome).
- EXPECT: the human confirms all four steps behaved as listed.
- IF FAIL: record which step failed with full output and STOP (playbook §5).
- [ ]

### Task 7.12 — WS-07 checkpoint: full verification and commit
- DO: run the WS-07 Verification block from instructions.md, then commit.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-07 WS-07: Admin copilot (M31)"`
- EXPECT: full backend suite green on shim (including `test_admin_copilot.py`); `tsc` and `pnpm build` exit 0; commit succeeds.
- IF FAIL: fix the failing test/build error first — if `git commit` fails only for identity reasons, note it and continue (playbook §6) — else STOP (playbook §5).
- [ ]

## WS-08 — AI health page + calibration  (see instructions.md §WS-08)

### Task 8.1 — Verify WS-08 prerequisite files
- PRECONDITION: `test -d backend/app/services/ai && test -f backend/app/services/ai/gateway.py && test -f backend/app/services/approvals.py && test -d backend/tests/fixtures/ai/golden` — if this fails, STOP the phase (playbook §5): the AI gateway and `ai_decisions` logging are phase-00 deliverables; the golden fixtures come from WS-02 Task 2.11.
- DO: no file changes. Read `backend/app/services/ai/gateway.py` (specifically how `ai_decisions` records are written) and `missing-features/ai_implementation_plan.md` §7 before starting Task 8.2.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai import gateway"`
- EXPECT: exit 0, no output.
- IF FAIL: STOP (playbook §5) and report the missing module.
- [ ]

### Task 8.2 — Create weekly calibration job
- DO: create `backend/app/services/ai/calibration.py` (new) with `async def run_weekly_calibration() -> dict`: aggregate the `ai_decisions` collection into per-question-set metrics — `accuracy` (against outcome hooks), `confidenceBucketReliability`, `fallbackRate`, `costPerModule` — and write a doc to `ai_calibration/weekly-YYYY-WW` (ISO week id) containing all four metric families per question set. When a question set's accuracy dropped more than 5 points vs the previous week's doc, set `regressionAlert: true` on that entry and emit a log line (dashboard badge wiring happens in Task 8.4). Add a cron endpoint `POST /jobs/ai-calibration/run` in `backend/app/routers/jobs.py` following that file's exact `X-Cron-Secret` pattern, calling `run_weekly_calibration`.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai.calibration import run_weekly_calibration"`
- EXPECT: exit 0, no output.
- IF FAIL: fix `calibration.py` until the import passes — else STOP (playbook §5).
- [ ]

### Task 8.3 — Create calibration job unit tests
- DO: create `backend/tests/test_ai_calibration.py` (new): seed fixture `ai_decisions` records (multiple question sets, confidence buckets, fallback flags, costs, and outcome hooks) into the fake store, run `run_weekly_calibration`, and assert the produced `ai_calibration/weekly-YYYY-WW` doc contains the expected aggregates for all four metric families; also seed a previous-week doc with accuracy 5+ points higher and assert `regressionAlert: true` on the affected question set.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_ai_calibration.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the implementation, never the assertions — else STOP (playbook §5).
- [ ]

### Task 8.4 — Add AI health endpoint
- DO: in `backend/app/routers/admin.py` add `GET /ai/health` guarded by `require_admin_role("superadmin", "compliance_officer", "finance_admin", "agronomist", "operations_lead", "content_moderator")`: a per-module (per-question-set) table of the four calibration metrics plus `trendVsPreviousWeek` (delta vs the prior `ai_calibration` doc), `regressionAlert` flags, and the golden-set versions listed from `backend/tests/fixtures/ai/golden/`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the endpoint until green — else STOP (playbook §5).
- [ ]

### Task 8.5 — Add AI config validator and endpoints
- DO: in `backend/app/services/ai/` add `config.py` (new) with `def validate_ai_config(config: dict) -> None` enforcing the automation-level caps (global rule 12): credit, insurance, and legal question sets may NEVER exceed `require_confirm` (an attempt to set one to `auto` raises `ValueError("AI_AUTOMATION_LEVEL_FORBIDDEN")`); question sets not in the phase-G allowlist may not exceed `suggest`. In `backend/app/routers/admin.py` add `GET /platform-config/ai` and `PUT /platform-config/ai` (`Depends(admin_mutation_context)`): the PUT runs `validate_ai_config` (violations → 422 `AI_AUTOMATION_LEVEL_FORBIDDEN` via the standard envelope), then routes through `approvals.maybe_require_approval` (maker-checker mandatory per ai_implementation_plan.md §7) and audit with `previousState`/`newState` (`module="ai-config"`). Guard: `require_admin_role("superadmin")`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the validator/endpoints until green — else STOP (playbook §5).
- [ ]

### Task 8.6 — Test AI config governance flow
- DO: append to `backend/tests/test_ai_calibration.py`: (a) a `PUT /v1/admin/platform-config/ai` attempting to set a credit decision question set to automation level `auto` → 422 `AI_AUTOMATION_LEVEL_FORBIDDEN`; (b) a valid threshold edit on `kyc.authenticity_risk.v1` creates a pending `admin_approvals` doc, and only after a SECOND distinct admin approves does the new value appear in `GET /v1/admin/platform-config/ai`; (c) the `audit_logs` contain the edit with non-null `previousState` and `newState`.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_ai_calibration.py -q`
- EXPECT: all tests pass (exit 0).
- IF FAIL: fix the implementation, never the assertions — else STOP (playbook §5).
- [ ]

### Task 8.7 — Create AI health page
- DO: create `website/src/views/admin/AiHealthPage.tsx` (new): a per-module metrics table from new `adminApi.getAiHealth()` showing accuracy, confidence-bucket reliability, fallback rate, and cost per module with `trendVsPreviousWeek` deltas and a visible badge on `regressionAlert` rows; a golden-set versions list; and a threshold/automation-level editor for question sets saving via `ConfirmActionModal` to new `adminApi.putAiConfig(payload, reason, role)` (maker-checkered server-side; surface the 422 `AI_AUTOMATION_LEVEL_FORBIDDEN` error from the envelope when a cap is violated). Add both functions to `website/src/lib/api/admin.ts`. All strings via `t()` (`admin.aihealth.*`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type errors — else STOP (playbook §5).
- [ ]

### Task 8.8 — Register AI health route
- DO: in `website/src/App.tsx`, under the `/admin` route, add child route `/admin/ai-health` → `AiHealthPage` wrapped in `RequireAdminRole` with the roles from its `ADMIN_MODULES` entry (add the entry to `ADMIN_MODULES` in `website/src/views/admin/AdminShell.tsx` if not already present, with its `admin.nav.*` label key).
- RUN: `cd website && pnpm exec tsc --noEmit && grep -c 'path="/admin/' src/App.tsx`
- EXPECT: `tsc` exits 0; grep prints a count of at least 34.
- IF FAIL: fix the route registration — else STOP (playbook §5).
- [ ]

### Task 8.9 — Add WS-08 locale keys (en + hi)
- DO: append to `website/src/lib/i18n/locales/en.admin.ts` and `website/src/lib/i18n/locales/hi.admin.ts` the identical set of `admin.aihealth.*` keys used by Task 8.7 (metric names, trend labels, regression badge, editor labels, error message for the automation cap) — English values in en, Hindi values in hi.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/en.admin.ts | sort) <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/hi.admin.ts | sort)`
- EXPECT: `tsc` exits 0; `diff` exits 0 with no output.
- IF FAIL: add the missing key(s) shown by the diff — else STOP (playbook §5).
- [ ]

### Task 8.10 — HUMAN CHECK: maker-checkered threshold edit
- DO: HUMAN CHECK — ask the operator to run, in order:
  1. Start the API: `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`.
  2. In the admin console as `superadmin`, open `/admin/ai-health` and edit the `kyc.authenticity_risk.v1` threshold — confirm the edit becomes a pending approval instead of applying immediately.
  3. Approve it as a SECOND distinct admin — confirm the new value is live on the AI Health page.
  4. Confirm `GET /v1/admin/audit?module=ai-config` shows the edit with previous/new state.
- RUN: none (human-executed; executor records the outcome).
- EXPECT: the human confirms all four steps behaved as listed.
- IF FAIL: record which step failed with full output and STOP (playbook §5).
- [ ]

### Task 8.11 — WS-08 checkpoint: full verification and commit
- DO: run the WS-08 Verification block from instructions.md, then commit.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-07 WS-08: AI health page + calibration"`
- EXPECT: full backend suite green on shim (including `test_ai_calibration.py`); `tsc` and `pnpm build` exit 0; commit succeeds.
- IF FAIL: fix the failing test/build error first — if `git commit` fails only for identity reasons, note it and continue (playbook §6) — else STOP (playbook §5).
- [ ]

## Phase-final gate  (see readme.md "Exit gate" and instructions.md "Phase-final verification")

### Task F.1 — Exit gate: RBAC tier matrix proven by tests
- DO: no file changes. Run the RBAC test suites that prove server-side 403 on cross-tier access.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin_rbac.py tests/test_admin.py -q`
- EXPECT: all tests pass (exit 0) — the tier-vs-endpoint matrix and the FORBIDDEN_ADMIN_ROLE cases are green.
- IF FAIL: fix the guard wiring, never the assertions — else STOP (playbook §5).
- [ ]

### Task F.2 — Exit gate: 27 admin routes registered
- DO: no file changes. Verify all 27 superadmin modules plus the copilot/AI-health pages are reachable at `/admin/*`.
- RUN: `cd website && grep -oE 'path="/admin/[^"]*"' src/App.tsx | sort -u | wc -l`
- EXPECT: prints a number ≥ 29 (27 module routes + `/admin` shell children incl. copilot panel home and AI health).
- IF FAIL: find the module from `ADMIN_MODULES` in `website/src/views/admin/AdminShell.tsx` whose route is missing in `App.tsx` and register it — else STOP (playbook §5).
- [ ]

### Task F.3 — Exit gate: audit immutability and maker-checker green
- DO: no file changes. Verify the audit service exposes no mutation path and the maker-checker/approvals tests pass.
- RUN: `cd backend && grep -nE "def (update|delete)" app/services/audit.py; test $? -eq 1 && .venv/bin/python -m pytest tests/test_admin_rbac.py tests/test_admin_settlements.py -q`
- EXPECT: the grep finds no update/delete function in `audit.py` (exit 1), and both test files pass — proving > ₹10,000 maker-checker and audit on every mutation.
- IF FAIL: remove any mutation path from `audit.py` or fix the failing approval test — else STOP (playbook §5).
- [ ]

### Task F.4 — Exit gate: KYC queue real and Aadhaar masked
- DO: no file changes. Verify no hardcoded KYC rows remain and no unmasked Aadhaar appears in fixtures, AI code, or schemas.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_admin_kyc.py -q && ! grep -rEn "\b[0-9]{12}\b" tests/fixtures/ai/golden app/services/ai/kyc_schemas.py`
- EXPECT: KYC tests green on shim; the grep finds no 12-digit Aadhaar-like numbers (the `!` makes no-match a success).
- IF FAIL: remove the offending unmasked value / hardcoded row — else STOP (playbook §5).
- [ ]

### Task F.5 — Exit gate: settlements and commission config green
- DO: no file changes.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin_settlements.py tests/test_admin_finance.py -q`
- EXPECT: all tests pass (exit 0) — batch run, mark-paid with ref, ₹10,000 maker-checker, ₹50,000 dual sign-off, effective-dated versioned commission edits, and rate-table overlap rejection are green.
- IF FAIL: fix the failing implementation — else STOP (playbook §5).
- [ ]

### Task F.6 — Exit gate: dispute triage routing green
- DO: no file changes.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_admin_disputes.py -q`
- EXPECT: all tests pass (exit 0) — every dispute type routes to the correct RBAC queue, `slaDueAt` present, fallback routing on gateway exception.
- IF FAIL: fix the failing implementation — else STOP (playbook §5).
- [ ]

### Task F.7 — Exit gate: copilot whitelist and audit green
- DO: no file changes.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_admin_copilot.py -q`
- EXPECT: all tests pass (exit 0) — the write-capable tool rejection, per-query audit logging, role scoping, and briefing generation are green.
- IF FAIL: fix the failing implementation — else STOP (playbook §5).
- [ ]

### Task F.8 — Exit gate: AI health calibration green
- DO: no file changes.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_ai_calibration.py -q`
- EXPECT: all tests pass (exit 0) — calibration aggregates, regression alert, and the maker-checkered config edit with the automation-cap rejection are green.
- IF FAIL: fix the failing implementation — else STOP (playbook §5).
- [ ]

### Task F.9 — Exit gate: no "coming soon" reachable in /admin/*
- DO: no file changes. Sweep the admin UI and router stubs for placeholder text.
- RUN: `cd website && grep -rni "coming soon" src/views/admin/ src/App.tsx src/lib/i18n/locales/en.admin.ts src/lib/i18n/locales/hi.admin.ts; test $? -eq 1`
- EXPECT: the grep prints nothing (exit 1) so the final `test` exits 0.
- IF FAIL: replace the placeholder with the real view or hide the nav entry (never a fabricated page) — else STOP (playbook §5).
- [ ]

### Task F.10 — Global gate: backend suite fully green
- DO: no file changes.
- RUN: `cd backend && .venv/bin/python -m pytest -q`
- EXPECT: the FULL backend suite passes (exit 0), including all new `test_admin_*` suites.
- IF FAIL: fix the failure; if it is unrelated to phase-07 work, STOP (playbook §5 global-gate clause) and report — else fix and re-run.
- [ ]

### Task F.11 — Global gate: website typecheck and build clean
- DO: no file changes.
- RUN: `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: both commands exit 0.
- IF FAIL: fix the reported error and re-run — else STOP (playbook §5).
- [ ]

### Task F.12 — Global gate: full suite green on AI shim
- DO: no file changes.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q`
- EXPECT: the FULL backend suite passes with `AI_PROVIDER=shim` (exit 0).
- IF FAIL: fix the failing AI path (deterministic fallback required — no test may depend on a live model) — else STOP (playbook §5).
- [ ]

### Task F.13 — Global gate: en/hi locale parity
- DO: no file changes.
- RUN: `cd website && diff <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/en.admin.ts | sort) <(grep -oE "^[[:space:]]+[A-Za-z0-9_.]+:" src/lib/i18n/locales/hi.admin.ts | sort)`
- EXPECT: `diff` exits 0 with no output — every admin key exists in both locales.
- IF FAIL: add the missing key(s) shown by the diff — else STOP (playbook §5).
- [ ]

### Task F.14 — HUMAN CHECK: tier login and forbidden navigation
- DO: HUMAN CHECK — ask the operator to run, in order:
  1. Start the API: `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`.
  2. Log in to the admin console once per tier (superadmin, compliance_officer, finance_admin, agronomist, operations_lead, content_moderator) — confirm the nav shows ONLY that tier's modules each time.
  3. As a lower tier, paste a direct URL to a forbidden module (e.g. `finance_admin` → `/admin/kyc`) — confirm the 403/forbidden screen renders.
- RUN: none (human-executed; executor records the outcome).
- EXPECT: the human confirms all three steps behaved as listed.
- IF FAIL: record which step failed and STOP (playbook §5).
- [ ]

### Task F.15 — HUMAN CHECK: KYC and settlements end-to-end
- DO: HUMAN CHECK — ask the operator to run, in order:
  1. Upload a KYC document in the dev app → confirm AI extraction is visible in `/admin/kyc`, risk < 0.3 auto-advances (higher risk lands in the queue with reasons), then approve with reason + MPIN → user verified. Confirm no unmasked Aadhaar in UI, logs, or fixtures.
  2. Trigger a weekly settlement batch → approve a hold (maker-checker if > ₹10,000) → mark paid with a payment ref → confirm the audit trail is complete in `GET /v1/admin/audit?module=settlements`.
- RUN: none (human-executed; executor records the outcome).
- EXPECT: the human confirms both flows behaved as listed.
- IF FAIL: record which step failed and STOP (playbook §5).
- [ ]

### Task F.16 — HUMAN CHECK: dispute, copilot, and AI health flows
- DO: HUMAN CHECK — ask the operator to run, in order:
  1. Open a dispute in the dev app → confirm it routes to the correct RBAC queue with a visible SLA clock → resolve it.
  2. Ask the copilot a whitelisted query → confirm the answer cites its data source; confirm the nightly briefing card deep-links into the right queues.
  3. Open `/admin/ai-health` → confirm a calibration row is present for the current week and a config edit goes through maker-checker.
- RUN: none (human-executed; executor records the outcome).
- EXPECT: the human confirms all three flows behaved as listed.
- IF FAIL: record which step failed and STOP (playbook §5).
- [ ]

### Task F.17 — Phase-final commit
- DO: commit any remaining gate fixes.
- RUN: `git add -A && git commit -m "phase-07 final: admin console exit gate green" || true`
- EXPECT: commit succeeds, or prints "nothing to commit" (both acceptable).
- IF FAIL: if `git commit` fails only for identity reasons, note it in the report and continue (playbook §6) — else STOP (playbook §5).
- [ ]
