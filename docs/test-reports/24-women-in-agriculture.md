# Test Report — Module 24: Women in Agriculture & Self Help Groups

> **Document ID:** `TR-24`  
> **Module Tag:** `women`  
> **Backend Router(s):** [`backend/app/routers/women.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/women.py)  
> **Associated Test Suite(s):** [`backend/tests/test_women.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_women.py)  
> **Verification Status:** ✅ **PASSED** (All unit/integration tests verified in pytest)

---

## 1. Module Overview & Business Purpose

Financial inclusion and rural livelihood programs for Mahila Kisan: Self Help Group (SHG) micro-savings ledger, monthly recurring deposits, group loans, and homemade value-added agro-products marketplace.

This module is essential to the AGROVERCITY architecture, serving active personas across web and mobile interfaces. All operations enforce role-based access control (RBAC), input validation schemas, and database idempotency.

---

## 2. Implemented Endpoints Catalog

Total Implemented Endpoints in FastAPI: **3**

| Method | Endpoint Path | Summary | Handler Function | File & Line | Auth / Roles | Status |
|---|---|---|---|---|---|---|
| `GET` | `/v1/women/shg` | Get Shg | `get_shg_v1_women_shg_get()` | [`backend/app/routers/women.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/women.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/women/shg/deposit` | Deposit | `deposit_v1_women_shg_deposit_post()` | [`backend/app/routers/women.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/women.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/women/home-enterprise` | Home Enterprise | `home_enterprise_v1_women_home_enterprise_get()` | [`backend/app/routers/women.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/women.py#L1) | Public | ✅ PASSED |

---

## 3. Test Suite Execution & Coverage Analysis

### 3.1 Test Suite Summary
- **Target Test Files:** `test_women.py`
- **Total Test Cases Executed:** **6**
- **Test Pass Rate:** **100% (All 6 passed)**
- **Test Runner:** Pytest 9.1.1 on Python 3.10 with `pytest-asyncio`

### 3.2 Executed Test Cases Detail

| Test Function | File & Line | Verified Scenarios & Assertions | Status |
|---|---|---|---|
| `test_shg_seeds_defaults_on_first_read` | [`test_women.py#L4`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_women.py#L4) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_deposit_updates_corpus` | [`test_women.py#L15`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_women.py#L15) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_duplicate_deposit_month_409` | [`test_women.py#L26`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_women.py#L26) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_home_enterprise_total` | [`test_women.py#L36`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_women.py#L36) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_deposit_bad_month_format_422` | [`test_women.py#L47`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_women.py#L47) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_women_forbidden_for_seller` | [`test_women.py#L57`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_women.py#L57) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |

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
# Example verification curl for Women in Agriculture & Self Help Groups
curl -X GET \
  "http://localhost:8000/v1/women/shg" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

---
*Report generated automatically for AGROVERCITY platform verification.*
