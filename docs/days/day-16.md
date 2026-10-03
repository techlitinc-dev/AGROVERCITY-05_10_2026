# Day 16 — Bank Manager persona + loan management

**Dev A (Backend) goal:** The `bankManager` persona and the complete banker half of the F17 loan flow: review queue, approve/reject/info-request/disburse, farmer respond/cancel, timeline, documents, EMI schedule, notifications, audit logs — with pytest coverage and the `bankManager` quick-login persona.
**Dev B (Flutter) goal:** Banker console screens (`loanQueue`, `loanReviewDetail`) and the farmer-side loan-detail extensions (document upload, respond to info request, EMI schedule view) per `overview/04` §3c — spec only; implementation follows Day 16 backend contract.

## Dev A — Backend tasks

### Task A1 — bankManager persona wiring

- **Goal:** Register the 12th profile `bankManager` end-to-end so login, role checks, and profile activation work.
- **Depends on:** Day 2 (`current_user_id`), Day 3 (`require_role`), Day 7 personas.
- **Files to create/modify:**
  - `backend/app/models/user.py` (modify — `VALID_PROFILES += "bankManager"`)
  - `backend/app/models/role_profiles.py` (modify — `BankManagerRoleProfile { bankName?, branch?, employeeId? }` + `ROLE_PROFILE_MODELS` entry)
  - `backend/app/routers/auth.py` (modify — quick-login persona `bankManager` → dev user `dev-user-7` "Anita Sharma (बैंक मैनेजर)", `activeProfile`/`linkedProfiles`/`primaryProfile` = `bankManager`)
  - `backend/app/services/profile_routes.py` (modify — `ACCESS_MAP["bankManager"]`, `DEFAULT_HOME["bankManager"] = "bankManagerHome"` so profile activate doesn't KeyError)
- **Subtasks:**
  1. Add the profile to the three registries above (exact same pattern as `dairyManager`).
  2. `POST /v1/auth/quick-login {"persona": "bankManager"}` → 200, `user.activeProfile == "bankManager"`, `"bankManager" in user.linkedProfiles`.
- **Test:** covered by `test_quick_login_bank_manager_persona` in Task A3.
- **Expected output:** quick-login returns the banker user; `require_role(user, "bankManager")` passes for it and 403s every other persona.

### Task A2 — loan models + service

- **Goal:** `LoanApplicationOut` (superset of the Day 9 shape), status machine, application numbers, EMI amortization, audit + notify helpers.
- **Depends on:** Day 11 claims service (`app/services/claims.py` patterns: `CLAIM_TRANSITIONS`, `advance_status`, `next_claim_number`).
- **Files to create/modify:**
  - `backend/app/models/loans.py` (new)
  - `backend/app/services/loans.py` (new)
  - `backend/app/models/finance.py` (modify — `LoanApplyIn` gains optional `bankAccountId`)
  - `backend/app/routers/finance.py` (modify — `POST /loans/apply` validates `bankAccountId` under `users/{uid}/bank_accounts` (404 `BANK_ACCOUNT_NOT_FOUND`, snapshots `bankAccountLast4` + `bankIfsc`), snapshots `farmerName`/`farmerPhone`/`farmerCreditScore` (default 650) / `farmerCreditTier` (`users.creditTier` or score-derived), issues `applicationNumber` (`LN-YYYY-####` via `counters/loans_YYYY`), seeds `timeline[0]`; `GET /loans` returns the extended out model)
- **Subtasks:**
  1. `backend/app/models/loans.py`: `LoanStatus` (adds `infoRequested`, `cancelled`), `LoanTimelineEntry {status, statusText, note?, at, by?}`, `LoanDocument {documentId, name, storagePath, uploadedAt}`, `LoanApplicationOut` (all new fields default empty/None so pre-Day-16 docs deserialize), `ApproveIn`/`RejectIn`/`InfoRequestIn`/`RespondIn`/`DisburseIn` (Field-constrained), `LoanScheduleEntry`. Existing `amount: float` type kept for backward compatibility; new money (`sanctionedAmount`, `disbursedAmount`, schedule `emi/principal/interest/outstanding`) is integer rupees.
  2. `backend/app/services/loans.py`: `LOAN_TRANSITIONS` (`submitted → [underReview, cancelled]`, `underReview → [approved, rejected, infoRequested, cancelled]`, `infoRequested → [underReview]`, `approved → [disbursed, rejected]`, terminals → `[]`), `advance_status()` (ValueError on illegal move; sets status/statusText/note/updatedAt, appends timeline), `next_application_number()`, `compute_schedule()` (reducing-balance, monthly rest, `emi = round(P·r·(1+r)^n/((1+r)^n−1))` with `r = annual/1200`, integer ₹, due 1st of each following month, last installment absorbs rounding drift so outstanding hits exactly 0), `to_out()` (defaults for missing keys), `notify_farmer()` (best-effort try/except around `send_fcm_to_user`), `write_audit()` (mirrors `admin.py` audit_logs write: `{action, adminId, loanId, detail, timestamp}`).
- **Test:** exercised end-to-end in Task A3.
- **Expected output:** old loan docs (no applicationNumber/timeline) still serialize via `to_out`.

### Task A3 — `/loans` router (banker workflow)

- **Goal:** The full loan-management API under `POST/GET /v1/loans/*`.
- **Depends on:** Task A1, Task A2, Day 11 `insurance_claims` multipart pattern, `services/storage`.
- **Files to create/modify:**
  - `backend/app/routers/loans.py` (new — `prefix="/loans"`, `_error` helper, `_banker` dep via `require_role`, `_participant` dep: owner OR bankManager, else 404 `LOAN_NOT_FOUND` — never 403, so farmers can't probe other farmers' loans)
  - `backend/app/main.py` (modify — import + `include_router(loans.router, prefix="/v1")`)
  - `backend/tests/conftest.py` (modify — add `app.routers.loans`, `app.services.loans`, `app.routers.finance` to the get_doc/set_doc and query monkeypatch tuples)
  - `backend/tests/test_loans.py` (new)
- **Subtasks:**
  1. `GET /queue?status=&q=&page=&pageSize=` (banker) — Firestore `status` filter, in-memory substring search on farmerName/farmerPhone/applicationNumber, envelope, `createdAt` desc, pageSize ≤ 100.
  2. `GET /stats` (banker) — `{byStatus, totalApplications, totalRequestedAmount, totalSanctionedAmount, pendingReview}`.
  3. `GET /{id}` (participant) — extended out model.
  4. `POST /{id}/review` (banker) — `submitted → underReview`, sets `assignedOfficerId/Name`, notifies farmer, audit.
  5. `POST /{id}/approve` (banker) — `underReview → approved`, stores sanctionedAmount/interestRate/tenureMonths (+optional note), notifies, audit.
  6. `POST /{id}/reject` (banker) — `underReview|approved → rejected`, stores rejectionReason, notifies, audit.
  7. `POST /{id}/info-request` (banker) — `underReview → infoRequested`, note = message, notifies, audit.
  8. `POST /{id}/respond` (owner farmer; banker → 403) — only from `infoRequested` → `underReview`, notifies assigned officer. (Guarded explicitly: the shared transition table also allows `submitted → underReview` for the review action, so respond/cancel enforce their own from-statuses and return 409 `LOAN_INVALID_TRANSITION` otherwise.)
  9. `POST /{id}/cancel` (owner farmer; banker → 403) — only from `submitted|infoRequested` → `cancelled`, notifies assigned officer.
  10. `POST /{id}/disburse` (banker) — `approved → disbursed`, stores disbursementRef/disbursedAt/disbursedAmount (defaults to sanctionedAmount), notifies, audit.
  11. `GET /{id}/schedule` (participant) — sanctioned terms when approved/disbursed, else requested terms @ 12% default.
  12. `POST /{id}/documents` (owner farmer, multipart `files[]` JPG/PNG/PDF via `services/storage`, prefix `loandocs/`) — appends `documents[]`, 201.
  13. Every status change goes through `advance_status`; every illegal move → 409 `LOAN_INVALID_TRANSITION` (message names current status); every banker mutation = `write_audit` + `notify_farmer`.
  14. Tests (`backend/tests/test_loans.py`, 18 tests): apply snapshots (with/without bankAccountId, bad account 404), queue ACL/search/filter/envelope, full lifecycle with timeline + notifications, info-request/respond round trip, cancel, reject reason, four 409 cases, role/ownership ACLs (farmer approve 403, banker respond 403, non-owner 404), schedule math (Σprincipal == amount, outstanding ends 0, count == tenure), stats, document upload (201, banker 403, bad type 415), audit log write, quick-login persona.
- **Test:** `cd backend && .venv/bin/pytest tests/test_loans.py -v && .venv/bin/pytest -q`
- **Expected output:** `18 passed` + full suite green (635 passed, 1 skipped at Day 16; one pre-existing failure in `tests/test_role_profiles.py::test_register_variant_missing_required` predates this day — caused by the uncommitted WIP default on `TransportRoleProfile.rcNumber`, unrelated to loans).

### Task A4 — docs

- **Goal:** Contract docs updated before/alongside code (rules §1.3 — endpoints.json/md are sources of truth).
- **Files to create/modify:** `endpoints.json`, `endpoints.md` (§11 extended + new §11b), `docs/overview/03-gap-analysis-new-screens-and-endpoints.md` (§B.8 + F17 refresh), `docs/schema/firestore-collections.md` (`loan_applications` formalized + `counters/loans_YYYY`), `docs/overview/04-persona-screen-matrix.md` (bankManager row + §3c).
- **Test:** `python3 -c "import json; json.load(open('endpoints.json'))"` parses; tables render.
- **Expected output:** every new endpoint documented; no invented collections (reuses `loan_applications`, `counters`, `audit_logs`, `users/{uid}/bank_accounts`, `notifications`).

## Dev B — Flutter tasks (spec-only this day)

### Task B1 — Banker console + farmer loan-detail extensions (Day 17 implementation)

- **Goal:** `loanQueue` (queue + stats cards, search field, status chips), `loanReviewDetail` (farmer + credit snapshot, timeline stepper, approve/reject/info-request/disburse action sheet), farmer `loanTracking` detail extensions (document picker upload, respond sheet, EMI schedule table).
- **Depends on:** Task A3 contract; `overview/04` §3c.
- **Files to create/modify (next day):** `apps/mobile/lib/views/loans/loan_queue_view.dart`, `loan_review_detail_view.dart`, `api/loans_api.dart`; routes in `core/routes.dart` (guard: `bankManager` only).
- **Test (next day):** widget tests with fake API client; `flutter analyze` clean.

## Done-when checklist (end of day)

- [ ] `bankManager` quick-login works; `require_role` gates pass for banker, 403 for others.
- [ ] `pytest tests/test_loans.py` → 18 passed; full suite → no new failures vs Day 15 baseline.
- [ ] `endpoints.json` parses; `endpoints.md` §11b lists all 12 `/loans*` endpoints.
- [ ] `docs/schema/firestore-collections.md` documents `loan_applications` incl. timeline/documents + `counters/loans_YYYY`.
- [ ] Illegal transitions → 409 `LOAN_INVALID_TRANSITION`; non-owner loan access → 404 `LOAN_NOT_FOUND` (no 403 probing leak).
- [ ] Banker mutations write `audit_logs` + farmer `notifications`; farmer sees every change in `GET /finance/loans` timeline.
