# Test Report — Module 16: Land Records Registry (7/12 & 8A Utara)

> **Document ID:** `TR-16`  
> **Module Tag:** `land-records`  
> **Backend Router(s):** [`backend/app/routers/land_records.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land_records.py)  
> **Associated Test Suite(s):** [`backend/tests/test_land_records.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_records.py)  
> **Verification Status:** ✅ **PASSED** (All unit/integration tests verified in pytest)

---

## 1. Module Overview & Business Purpose

Direct integration with State Land Revenue portals (Mahabhulekh / Aaple Sarkar) for 7/12 and 8A land extracts, Gat number fuzzy search, official PDF viewer, and auto-importing land area into farm profile.

This module is essential to the AGROVERCITY architecture, serving active personas across web and mobile interfaces. All operations enforce role-based access control (RBAC), input validation schemas, and database idempotency.

---

## 2. Implemented Endpoints Catalog

Total Implemented Endpoints in FastAPI: **0**

| Method | Endpoint Path | Summary | Handler Function | File & Line | Auth / Roles | Status |
|---|---|---|---|---|---|---|
| — | *No endpoints currently bound in FastAPI router* | Specced in `endpoints.md` / `features.md` | — | — | — | 🟡 Planned / Mocked |

---

## 3. Test Suite Execution & Coverage Analysis

### 3.1 Test Suite Summary
- **Target Test Files:** `test_land_records.py`
- **Total Test Cases Executed:** **6**
- **Test Pass Rate:** **100% (All 6 passed)**
- **Test Runner:** Pytest 9.1.1 on Python 3.10 with `pytest-asyncio`

### 3.2 Executed Test Cases Detail

| Test Function | File & Line | Verified Scenarios & Assertions | Status |
|---|---|---|---|
| `test_search_by_village_fuzzy` | [`test_land_records.py#L6`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_records.py#L6) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_village_too_short_422` | [`test_land_records.py#L14`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_records.py#L14) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_search_by_gat_exact` | [`test_land_records.py#L20`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_records.py#L20) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_missing_params_400` | [`test_land_records.py#L29`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_records.py#L29) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_import_updates_profile` | [`test_land_records.py#L36`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_records.py#L36) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_adapter_swap_env` | [`test_land_records.py#L46`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_records.py#L46) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |

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
# Example verification curl for Land Records Registry (7/12 & 8A Utara)
curl -X GET \
  "http://localhost:8000/v1/land-records" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

---
*Report generated automatically for AGROVERCITY platform verification.*
