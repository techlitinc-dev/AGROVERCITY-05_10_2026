# Phase-08 DPDP Audit (incl. AI) — AGROVERCITY

_Date: 2026-10-08. Source: robust.md §3.6/§8.4; ai.md §7.4; global rule 11._

## 1. Payload minimization & pseudonymization

- Every AI state builder lives in `backend/app/services/ai/privacy.py` and is
  passed through `sanitize_state()` before leaving the process (the gateway calls
  it defensively too).
- User/entity identifiers are HMAC-hashed: `hash_user_id()` =
  `HMAC(user_id, AI_HASH_SALT)[:32]`. Builders added in phase-08
  (`build_shg_readiness_state`, `build_churn_state`, `build_agent_rule_match_state`)
  use hashed ids only.
- Evidence: `grep -rniE "aadhaar" backend/app/services/ai/` → matches are the
  masking regex/helpers, KYC schemas (which REJECT unmasked Aadhaar via
  `KYCAadhaarExtract`), and docstrings — no unmasked Aadhaar field.
  `grep -rnE "phone|email" privacy.py` → only docstrings and PII-strip key lists.

## 2. No unmasked Aadhaar / phone / email in any AI payload

- `mask_aadhaar()` masks to `XXXX-XXXX-1234`; `sanitize_text()` redacts phone/email.
- Test evidence: `tests/test_admin_kyc.py::test_no_unmasked_aadhaar_anywhere`
  asserts no 12-digit run appears in vault docs or `ai_decisions.answers`.

## 3. Photos only to vision endpoints; provider retention

- Photos are only ever sent via `gateway.analyze_image()` (Gemini vision). Call
  sites: vault KYC extraction, equipment damage, advisory disease scan, chat OCR,
  and the phase-08 receipt scan (`services/receipt_scan.py`).
- Provider data-retention is disabled where the provider supports it (config flag
  in the gateway's request builder). **Known gap (deferred):** several routers
  still call the gateway directly rather than via a service wrapper
  (see §6) — this is a rule-10 architecture debt, not a PII leak.

## 4. AI disclosure in the consent center

- The consent center (phase-06) carries an AI disclosure entry; consent coverage
  includes the saturation opt-in. WS-03 B2B aggregates are consent-gated and
  anonymized (k-anonymity floor k=5, no user-level rows).

## 5. DPDP export + account deletion

- Export: `GET /v1/users/me/export` returns the user's data archive.
- Deletion: `DELETE /v1/users/me` then a follow-up fetch returns 404/410.
- (Staging curl evidence to be attached by the operator — see launch checklist.)

## 6. Open items (reported, not hidden)

- **Rule-10 router→gateway debt (deferred):** `grep -rn "gateway\.\(decide\|generate\|analyze_image\|embed\)" backend/app/routers/`
  returns call sites in content/seller/mandi/support/land/contracts/broker/
  post_harvest/vault/chat/equipment_owner/livestock_dairy/insurance_claims/
  advisory/search (pre-existing, phases 01–07). The phase-08 WS-04 task 4.12 audit
  is therefore NOT clean; moving these into owning services is deferred.
- Provider retention flag verification on the live Gemini endpoint is pending the
  operator's staging run.

DPDP audit signed: pending operator sign-off 2026-10-08
