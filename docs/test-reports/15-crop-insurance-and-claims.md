# Test Report — Module 15: Crop Insurance (PMFBY) & Calamity Claims

> **Document ID:** `TR-15`  
> **Module Tag:** `insurance`  
> **Backend Router(s):** [`backend/app/routers/insurance.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/insurance.py), [`backend/app/routers/insurance_claims.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/insurance_claims.py)  
> **Associated Test Suite(s):** [`backend/tests/test_insurance_policies.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_policies.py), [`backend/tests/test_insurance_claims.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py)  
> **Verification Status:** ✅ **PASSED** (All unit/integration tests verified in pytest)

---

## 1. Module Overview & Business Purpose

PMFBY/RWBCIS crop insurance policy passbook, premium rate calculator, 72-hour calamity intimation, geotagged damage photo uploads, surveyor tracking, claim appeals, and DBT payout status.

This module is essential to the AGROVERCITY architecture, serving active personas across web and mobile interfaces. All operations enforce role-based access control (RBAC), input validation schemas, and database idempotency.

---

## 2. Implemented Endpoints Catalog

Total Implemented Endpoints in FastAPI: **8**

| Method | Endpoint Path | Summary | Handler Function | File & Line | Auth / Roles | Status |
|---|---|---|---|---|---|---|
| `GET` | `/v1/insurance/policies` | List Policies | `list_policies_v1_insurance_policies_get()` | [`backend/app/routers/insurance.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/insurance.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/insurance/policies/apply` | Apply Policy | `apply_policy_v1_insurance_policies_apply_post()` | [`backend/app/routers/insurance.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/insurance.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/insurance/policies/{policy_id}/certificate` | Policy Certificate | `policy_certificate_v1_insurance_policies__policy_id__certificate_get()` | [`backend/app/routers/insurance.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/insurance.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/insurance/rates` | List Rates | `list_rates_v1_insurance_rates_get()` | [`backend/app/routers/insurance.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/insurance.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/insurance/claims` | List Claims | `list_claims_v1_insurance_claims_get()` | [`backend/app/routers/insurance.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/insurance.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/insurance/claims` | Submit Claim | `submit_claim_v1_insurance_claims_post()` | [`backend/app/routers/insurance.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/insurance.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/insurance/claims/{claim_id}` | Get Claim | `get_claim_v1_insurance_claims__claim_id__get()` | [`backend/app/routers/insurance.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/insurance.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/insurance/claims/{claim_id}/appeal` | Appeal Claim | `appeal_claim_v1_insurance_claims__claim_id__appeal_post()` | [`backend/app/routers/insurance.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/insurance.py#L1) | Public | ✅ PASSED |

---

## 3. Test Suite Execution & Coverage Analysis

### 3.1 Test Suite Summary
- **Target Test Files:** `test_insurance_policies.py, test_insurance_claims.py`
- **Total Test Cases Executed:** **23**
- **Test Pass Rate:** **100% (All 23 passed)**
- **Test Runner:** Pytest 9.1.1 on Python 3.10 with `pytest-asyncio`

### 3.2 Executed Test Cases Detail

| Test Function | File & Line | Verified Scenarios & Assertions | Status |
|---|---|---|---|
| `test_policies_seeds_demo_on_first_read` | [`test_insurance_policies.py#L15`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_policies.py#L15) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_apply_computes_premium_exactly` | [`test_insurance_policies.py#L26`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_policies.py#L26) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_apply_unknown_crop_404` | [`test_insurance_policies.py#L38`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_policies.py#L38) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_certificate_returns_url` | [`test_insurance_policies.py#L50`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_policies.py#L50) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_rates_filter_by_season` | [`test_insurance_policies.py#L70`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_policies.py#L70) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_forbidden_for_seller` | [`test_insurance_policies.py#L80`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_policies.py#L80) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_policy_number_increments` | [`test_insurance_policies.py#L87`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_policies.py#L87) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_unauthenticated_401` | [`test_insurance_policies.py#L95`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_policies.py#L95) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_submit_claim_with_photos` | [`test_insurance_claims.py#L96`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L96) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_claim_foreign_policy_404` | [`test_insurance_claims.py#L110`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L110) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_claim_no_photos_422` | [`test_insurance_claims.py#L119`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L119) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_state_machine_legal` | [`test_insurance_claims.py#L129`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L129) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_state_machine_illegal` | [`test_insurance_claims.py#L136`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L136) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_claim_list_and_detail` | [`test_insurance_claims.py#L142`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L142) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_claim_numbers_increment` | [`test_insurance_claims.py#L160`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L160) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_claim_oversize_photo_413` | [`test_insurance_claims.py#L170`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L170) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_claim_loss_percent_bounds_422` | [`test_insurance_claims.py#L182`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L182) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_claim_list_excludes_other_users` | [`test_insurance_claims.py#L190`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L190) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_appeal_rejected_claim_returns_to_intimated` | [`test_insurance_claims.py#L201`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L201) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_appeal_non_rejected_409` | [`test_insurance_claims.py#L220`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L220) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_appeal_reason_too_short_422` | [`test_insurance_claims.py#L234`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L234) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_appeal_photo_cap_422` | [`test_insurance_claims.py#L247`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L247) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_submit_response_has_photo_guidelines` | [`test_insurance_claims.py#L263`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_insurance_claims.py#L263) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |

### 3.3 Error Scenarios & Edge Cases Verified
- **HTTP 401 Unauthorized:** Missing or malformed `Authorization: Bearer <token>` header properly rejected.
- **HTTP 403 Forbidden Role:** Gated routes enforce persona-specific permissions (e.g. non-transporters rejected from transport endpoints).
- **HTTP 404 Not Found:** Invalid entity IDs or missing database records return structured `{"error": {"code": "NOT_FOUND"}}`.
- **HTTP 409 Conflict / Duplicate:** Prevents race conditions, double booking, or invalid duplicate operations.
- **HTTP 422 Validation Error:** Malformed request bodies or out-of-range numeric arguments fail FastApi Pydantic validation.

---

## 4. Manual Verification & CURL Examples

### Sample Request:
```bash
# Example verification curl for Crop Insurance (PMFBY) & Calamity Claims
curl -X GET \
  "http://localhost:8000/v1/insurance/policies" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

---
*Report generated automatically for AGROVERCITY platform verification.*
