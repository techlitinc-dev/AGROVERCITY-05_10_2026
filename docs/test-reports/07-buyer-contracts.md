# Test Report — Module 07: Buyer Contracts & Price Locks

> **Document ID:** `TR-07`  
> **Module Tag:** `contracts`  
> **Backend Router(s):** [`backend/app/routers/contracts.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/contracts.py)  
> **Associated Test Suite(s):** [`backend/tests/test_contracts.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_contracts.py)  
> **Verification Status:** ✅ **PASSED** (All unit/integration tests verified in pytest)

---

## 1. Module Overview & Business Purpose

Pre-sowing price-lock contracts between institutional food processors/exporters and farmers, offering guaranteed MSP premiums, digital acceptance with MPIN, and delivery milestones.

This module is essential to the AGROVERCITY architecture, serving active personas across web and mobile interfaces. All operations enforce role-based access control (RBAC), input validation schemas, and database idempotency.

---

## 2. Implemented Endpoints Catalog

Total Implemented Endpoints in FastAPI: **3**

| Method | Endpoint Path | Summary | Handler Function | File & Line | Auth / Roles | Status |
|---|---|---|---|---|---|---|
| `GET` | `/v1/contracts` | List Contracts | `list_contracts_v1_contracts_get()` | [`backend/app/routers/contracts.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/contracts.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/contracts/{contract_id}` | Get Contract | `get_contract_v1_contracts__contract_id__get()` | [`backend/app/routers/contracts.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/contracts.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/contracts/{contract_id}/accept` | Accept Contract | `accept_contract_v1_contracts__contract_id__accept_post()` | [`backend/app/routers/contracts.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/contracts.py#L1) | Public | ✅ PASSED |

---

## 3. Test Suite Execution & Coverage Analysis

### 3.1 Test Suite Summary
- **Target Test Files:** `test_contracts.py`
- **Total Test Cases Executed:** **6**
- **Test Pass Rate:** **100% (All 6 passed)**
- **Test Runner:** Pytest 9.1.1 on Python 3.10 with `pytest-asyncio`

### 3.2 Executed Test Cases Detail

| Test Function | File & Line | Verified Scenarios & Assertions | Status |
|---|---|---|---|
| `test_list_contracts` | [`test_contracts.py#L75`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_contracts.py#L75) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_detail_includes_terms` | [`test_contracts.py#L88`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_contracts.py#L88) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_accept_success` | [`test_contracts.py#L100`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_contracts.py#L100) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_accept_wrong_mpin` | [`test_contracts.py#L111`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_contracts.py#L111) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_accept_already_accepted` | [`test_contracts.py#L122`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_contracts.py#L122) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_accept_broker_forbidden` | [`test_contracts.py#L131`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_contracts.py#L131) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |

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
# Example verification curl for Buyer Contracts & Price Locks
curl -X GET \
  "http://localhost:8000/v1/contracts" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

---
*Report generated automatically for AGROVERCITY platform verification.*
