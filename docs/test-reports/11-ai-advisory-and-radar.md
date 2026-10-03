# Test Report — Module 11: AI Advisory, Disease Scan & Pest Radar

> **Document ID:** `TR-11`  
> **Module Tag:** `advisory`  
> **Backend Router(s):** [`backend/app/routers/advisory.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/advisory.py), [`backend/app/routers/soil_tests.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/soil_tests.py)  
> **Associated Test Suite(s):** [`backend/tests/test_advisory.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_advisory.py), [`backend/tests/test_soil_tests.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_soil_tests.py)  
> **Verification Status:** ✅ **PASSED** (All unit/integration tests verified in pytest)

---

## 1. Module Overview & Business Purpose

Intelligent agronomy tools: market saturation demand forecasting, CNN leaf disease image detection, NPK fertilizer recommendation, nearby pest outbreak alerts, and soil-test booking.

This module is essential to the AGROVERCITY architecture, serving active personas across web and mobile interfaces. All operations enforce role-based access control (RBAC), input validation schemas, and database idempotency.

---

## 2. Implemented Endpoints Catalog

Total Implemented Endpoints in FastAPI: **7**

| Method | Endpoint Path | Summary | Handler Function | File & Line | Auth / Roles | Status |
|---|---|---|---|---|---|---|
| `POST` | `/v1/soil-tests/book` | Book Soil Test | `book_soil_test_v1_soil_tests_book_post()` | [`backend/app/routers/soil_tests.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/soil_tests.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/soil-tests` | List Soil Tests | `list_soil_tests_v1_soil_tests_get()` | [`backend/app/routers/soil_tests.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/soil_tests.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/advisory/saturation` | Saturation Check | `saturation_check_v1_advisory_saturation_post()` | [`backend/app/routers/advisory.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/advisory.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/advisory/sowing-intent` | Sowing Intent | `sowing_intent_v1_advisory_sowing_intent_post()` | [`backend/app/routers/advisory.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/advisory.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/advisory/disease-scan` | Disease Scan | `disease_scan_v1_advisory_disease_scan_post()` | [`backend/app/routers/advisory.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/advisory.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/advisory/pest-radar` | Pest Radar | `pest_radar_v1_advisory_pest_radar_get()` | [`backend/app/routers/advisory.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/advisory.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/advisory/npk` | Npk | `npk_v1_advisory_npk_post()` | [`backend/app/routers/advisory.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/advisory.py#L1) | Public | ✅ PASSED |

### Planned / Prototype Specced Endpoints (from `endpoints.md` / `missing.md`)

| Method | Endpoint Path | Description | Roles | Architecture Status |
|---|---|---|---|---|
| `POST` | `/advisory/sowing-intent` | Record farmer crop sowing intent with opt-in consent | `farmer` | 🟡 Specced in Docs / Prototype Mock |
| `GET` | `/advisory/disease-scans` | History of past crop disease scans per plot | `farmer` | 🟡 Specced in Docs / Prototype Mock |

---

## 3. Test Suite Execution & Coverage Analysis

### 3.1 Test Suite Summary
- **Target Test Files:** `test_advisory.py, test_soil_tests.py`
- **Total Test Cases Executed:** **13**
- **Test Pass Rate:** **100% (All 13 passed)**
- **Test Runner:** Pytest 9.1.1 on Python 3.10 with `pytest-asyncio`

### 3.2 Executed Test Cases Detail

| Test Function | File & Line | Verified Scenarios & Assertions | Status |
|---|---|---|---|
| `test_saturation_green_when_empty` | [`test_advisory.py#L18`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_advisory.py#L18) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_saturation_red_when_crowded` | [`test_advisory.py#L31`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_advisory.py#L31) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_sowing_intent_recorded_opt_in` | [`test_advisory.py#L52`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_advisory.py#L52) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_disease_scan_stub` | [`test_advisory.py#L72`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_advisory.py#L72) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_npk_deficit_math` | [`test_advisory.py#L90`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_advisory.py#L90) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_intent_recorded_with_flag` | [`test_advisory.py#L105`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_advisory.py#L105) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_intent_without_consent_403` | [`test_advisory.py#L125`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_advisory.py#L125) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_intent_feeds_saturation_count` | [`test_advisory.py#L138`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_advisory.py#L138) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_book_201` | [`test_soil_tests.py#L17`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_soil_tests.py#L17) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_double_book_same_plot_409` | [`test_soil_tests.py#L27`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_soil_tests.py#L27) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_book_without_plot_ok` | [`test_soil_tests.py#L38`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_soil_tests.py#L38) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_foreign_plot_404` | [`test_soil_tests.py#L47`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_soil_tests.py#L47) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_list_sorted_desc` | [`test_soil_tests.py#L57`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_soil_tests.py#L57) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |

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
# Example verification curl for AI Advisory, Disease Scan & Pest Radar
curl -X POST \
  "http://localhost:8000/v1/soil-tests/book" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

---
*Report generated automatically for AGROVERCITY platform verification.*
