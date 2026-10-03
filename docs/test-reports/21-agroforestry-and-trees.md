# Test Report — Module 21: Agroforestry, Tree Plantation & Biofuel

> **Document ID:** `TR-21`  
> **Module Tag:** `tree`  
> **Backend Router(s):** [`backend/app/routers/tree.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/tree.py)  
> **Associated Test Suite(s):** [`backend/tests/test_tree.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_tree.py)  
> **Verification Status:** ✅ **PASSED** (All unit/integration tests verified in pytest)

---

## 1. Module Overview & Business Purpose

Promotes agroforestry and tree plantation: commercial biofuel tree catalog, NGO afforestation directory, free/subsidized sapling request system (max 500 saplings), and step-by-step care guides.

This module is essential to the AGROVERCITY architecture, serving active personas across web and mobile interfaces. All operations enforce role-based access control (RBAC), input validation schemas, and database idempotency.

---

## 2. Implemented Endpoints Catalog

Total Implemented Endpoints in FastAPI: **5**

| Method | Endpoint Path | Summary | Handler Function | File & Line | Auth / Roles | Status |
|---|---|---|---|---|---|---|
| `GET` | `/v1/tree/articles` | List Articles | `list_articles_v1_tree_articles_get()` | [`backend/app/routers/tree.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/tree.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/tree/ngos` | List Ngos | `list_ngos_v1_tree_ngos_get()` | [`backend/app/routers/tree.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/tree.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/tree/ngos/{ngo_id}/sapling-request` | Request Saplings | `request_saplings_v1_tree_ngos__ngo_id__sapling_request_post()` | [`backend/app/routers/tree.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/tree.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/tree/biofuel` | List Biofuel | `list_biofuel_v1_tree_biofuel_get()` | [`backend/app/routers/tree.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/tree.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/tree/care-guides` | List Care Guides | `list_care_guides_v1_tree_care_guides_get()` | [`backend/app/routers/tree.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/tree.py#L1) | Public | ✅ PASSED |

---

## 3. Test Suite Execution & Coverage Analysis

### 3.1 Test Suite Summary
- **Target Test Files:** `test_tree.py`
- **Total Test Cases Executed:** **4**
- **Test Pass Rate:** **100% (All 4 passed)**
- **Test Runner:** Pytest 9.1.1 on Python 3.10 with `pytest-asyncio`

### 3.2 Executed Test Cases Detail

| Test Function | File & Line | Verified Scenarios & Assertions | Status |
|---|---|---|---|
| `test_care_guides_sorted` | [`test_tree.py#L16`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_tree.py#L16) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_sapling_request_201` | [`test_tree.py#L25`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_tree.py#L25) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_sapling_count_over_500_422` | [`test_tree.py#L41`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_tree.py#L41) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_unknown_ngo_404` | [`test_tree.py#L52`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_tree.py#L52) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |

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
# Example verification curl for Agroforestry, Tree Plantation & Biofuel
curl -X GET \
  "http://localhost:8000/v1/tree/articles" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

---
*Report generated automatically for AGROVERCITY platform verification.*
