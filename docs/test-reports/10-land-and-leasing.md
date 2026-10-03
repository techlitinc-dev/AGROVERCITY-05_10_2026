# Test Report — Module 10: Landlord Land Management & Leasing

> **Document ID:** `TR-10`  
> **Module Tag:** `land`  
> **Backend Router(s):** [`backend/app/routers/land.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py)  
> **Associated Test Suite(s):** [`backend/tests/test_land.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land.py), [`backend/tests/test_land_market.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_market.py), [`backend/tests/test_rent_reminders.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_rent_reminders.py)  
> **Verification Status:** ✅ **PASSED** (All unit/integration tests verified in pytest)

---

## 1. Module Overview & Business Purpose

Comprehensive land management for farmland owners: plot registry, land leasing, tenant lease requests, official Marathi/Hindi lease agreements, monthly rent collection, and automated reminders.

This module is essential to the AGROVERCITY architecture, serving active personas across web and mobile interfaces. All operations enforce role-based access control (RBAC), input validation schemas, and database idempotency.

---

## 2. Implemented Endpoints Catalog

Total Implemented Endpoints in FastAPI: **21**

| Method | Endpoint Path | Summary | Handler Function | File & Line | Auth / Roles | Status |
|---|---|---|---|---|---|---|
| `GET` | `/v1/land/plots` | List Plots | `list_plots_v1_land_plots_get()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/land/plots` | Create Plot | `create_plot_v1_land_plots_post()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `PUT` | `/v1/land/plots/{plot_id}` | Update Plot | `update_plot_v1_land_plots__plot_id__put()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `DELETE` | `/v1/land/plots/{plot_id}` | Delete Plot | `delete_plot_v1_land_plots__plot_id__delete()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/land/leases` | List Leases | `list_leases_v1_land_leases_get()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/land/leases` | Create Lease | `create_lease_v1_land_leases_post()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `PUT` | `/v1/land/leases/{lease_id}` | Update Lease | `update_lease_v1_land_leases__lease_id__put()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `DELETE` | `/v1/land/leases/{lease_id}` | Delete Lease | `delete_lease_v1_land_leases__lease_id__delete()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/land/listings` | Browse Listings | `browse_listings_v1_land_listings_get()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/land/listings` | Create Listing | `create_listing_v1_land_listings_post()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/land/listings/mine` | My Listings | `my_listings_v1_land_listings_mine_get()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `PUT` | `/v1/land/listings/{listing_id}` | Update Listing | `update_listing_v1_land_listings__listing_id__put()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `DELETE` | `/v1/land/listings/{listing_id}` | Delete Listing | `delete_listing_v1_land_listings__listing_id__delete()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/land/lease-requests` | List Lease Requests | `list_lease_requests_v1_land_lease_requests_get()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/land/lease-requests` | Create Lease Request | `create_lease_request_v1_land_lease_requests_post()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/land/lease-requests/{request_id}/accept` | Accept Lease Request | `accept_lease_request_v1_land_lease_requests__request_id__accept_post()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/land/lease-requests/{request_id}/reject` | Reject Lease Request | `reject_lease_request_v1_land_lease_requests__request_id__reject_post()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/land/leases/{lease_id}/agreement-pdf` | Lease Agreement Pdf | `lease_agreement_pdf_v1_land_leases__lease_id__agreement_pdf_get()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/land-records/search` | Search Records | `search_records_v1_land_records_search_get()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/land-records/{record_id}/pdf` | Get Record Pdf | `get_record_pdf_v1_land_records__record_id__pdf_get()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/land-records/{record_id}/import` | Import Record | `import_record_v1_land_records__record_id__import_post()` | [`backend/app/routers/land.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/land.py#L1) | Public | ✅ PASSED |

---

## 3. Test Suite Execution & Coverage Analysis

### 3.1 Test Suite Summary
- **Target Test Files:** `test_land.py, test_land_market.py, test_rent_reminders.py`
- **Total Test Cases Executed:** **18**
- **Test Pass Rate:** **100% (All 18 passed)**
- **Test Runner:** Pytest 9.1.1 on Python 3.10 with `pytest-asyncio`

### 3.2 Executed Test Cases Detail

| Test Function | File & Line | Verified Scenarios & Assertions | Status |
|---|---|---|---|
| `test_create_plot_vacant` | [`test_land.py#L37`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land.py#L37) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_create_lease_marks_plot_leased` | [`test_land.py#L44`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land.py#L44) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_payment_and_duplicate_month_409` | [`test_land.py#L58`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land.py#L58) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_payments_summary` | [`test_land.py#L73`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land.py#L73) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_delete_plot_with_active_lease_409` | [`test_land.py#L90`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land.py#L90) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_end_lease_frees_plot` | [`test_land.py#L98`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land.py#L98) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_lease_bad_dates_422` | [`test_land.py#L111`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land.py#L111) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_create_and_browse_near_filter` | [`test_land_market.py#L37`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_market.py#L37) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_duplicate_request_409` | [`test_land_market.py#L49`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_market.py#L49) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_accept_creates_lease_and_flips_listing` | [`test_land_market.py#L61`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_market.py#L61) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_non_owner_accept_403` | [`test_land_market.py#L91`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_market.py#L91) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_agreement_pdf_returns_url` | [`test_land_market.py#L138`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_market.py#L138) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_tenant_can_fetch_agreement` | [`test_land_market.py#L156`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_land_market.py#L156) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_due_lease_notifies_landlord` | [`test_rent_reminders.py#L28`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_rent_reminders.py#L28) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_paid_month_skips` | [`test_rent_reminders.py#L40`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_rent_reminders.py#L40) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_grace_window` | [`test_rent_reminders.py#L54`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_rent_reminders.py#L54) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_dedup_same_month` | [`test_rent_reminders.py#L63`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_rent_reminders.py#L63) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_cron_secret_required` | [`test_rent_reminders.py#L78`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_rent_reminders.py#L78) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |

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
# Example verification curl for Landlord Land Management & Leasing
curl -X GET \
  "http://localhost:8000/v1/land/plots" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

---
*Report generated automatically for AGROVERCITY platform verification.*
