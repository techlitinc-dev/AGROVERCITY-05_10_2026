# Test Report — Module 09: Equipment Rental & Yantra Time-Slots

> **Document ID:** `TR-09`  
> **Module Tag:** `equipment`  
> **Backend Router(s):** [`backend/app/routers/equipment.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment.py), [`backend/app/routers/equipment_owner.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment_owner.py)  
> **Associated Test Suite(s):** [`backend/tests/test_equipment.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment.py), [`backend/tests/test_equipment_owner.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_owner.py), [`backend/tests/test_equipment_approve.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_approve.py)  
> **Verification Status:** ✅ **PASSED** (All unit/integration tests verified in pytest)

---

## 1. Module Overview & Business Purpose

Farm mechanization sharing platform with 4-hour Yantra time-slots, max 2 slots/day rule, instant FPO booking confirmation, private owner approval queue, and waitlisting.

This module is essential to the AGROVERCITY architecture, serving active personas across web and mobile interfaces. All operations enforce role-based access control (RBAC), input validation schemas, and database idempotency.

---

## 2. Implemented Endpoints Catalog

Total Implemented Endpoints in FastAPI: **12**

| Method | Endpoint Path | Summary | Handler Function | File & Line | Auth / Roles | Status |
|---|---|---|---|---|---|---|
| `GET` | `/v1/equipment` | List Equipment | `list_equipment_v1_equipment_get()` | [`backend/app/routers/equipment.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/equipment` | Create Equipment | `create_equipment_v1_equipment_post()` | [`backend/app/routers/equipment.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/equipment/{equipment_id}/slots` | Get Slots | `get_slots_v1_equipment__equipment_id__slots_get()` | [`backend/app/routers/equipment.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/equipment/slots/{slot_id}/book` | Book Slot | `book_slot_v1_equipment_slots__slot_id__book_post()` | [`backend/app/routers/equipment.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/equipment/slots/{slot_id}/waitlist` | Join Waitlist | `join_waitlist_v1_equipment_slots__slot_id__waitlist_post()` | [`backend/app/routers/equipment.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment.py#L1) | Public | ✅ PASSED |
| `DELETE` | `/v1/equipment/bookings/{booking_id}` | Cancel Booking | `cancel_booking_v1_equipment_bookings__booking_id__delete()` | [`backend/app/routers/equipment.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment.py#L1) | Public | ✅ PASSED |
| `PUT` | `/v1/equipment/{equipment_id}` | Update Equipment | `update_equipment_v1_equipment__equipment_id__put()` | [`backend/app/routers/equipment.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/equipment/owner/fleet` | Owner Fleet | `owner_fleet_v1_equipment_owner_fleet_get()` | [`backend/app/routers/equipment.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/equipment/bookings/pending` | Pending Bookings | `pending_bookings_v1_equipment_bookings_pending_get()` | [`backend/app/routers/equipment.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/equipment/bookings/{booking_id}/approve` | Approve Booking | `approve_booking_v1_equipment_bookings__booking_id__approve_post()` | [`backend/app/routers/equipment.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment.py#L1) | Public | ✅ PASSED |
| `POST` | `/v1/equipment/bookings/{booking_id}/reject` | Reject Booking | `reject_booking_v1_equipment_bookings__booking_id__reject_post()` | [`backend/app/routers/equipment.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment.py#L1) | Public | ✅ PASSED |
| `GET` | `/v1/equipment/settlements` | Equipment Settlements | `equipment_settlements_v1_equipment_settlements_get()` | [`backend/app/routers/equipment.py#L1`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/equipment.py#L1) | Public | ✅ PASSED |

---

## 3. Test Suite Execution & Coverage Analysis

### 3.1 Test Suite Summary
- **Target Test Files:** `test_equipment.py, test_equipment_owner.py, test_equipment_approve.py`
- **Total Test Cases Executed:** **20**
- **Test Pass Rate:** **100% (All 20 passed)**
- **Test Runner:** Pytest 9.1.1 on Python 3.10 with `pytest-asyncio`

### 3.2 Executed Test Cases Detail

| Test Function | File & Line | Verified Scenarios & Assertions | Status |
|---|---|---|---|
| `test_slots_generated_on_first_read` | [`test_equipment.py#L96`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment.py#L96) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_book_fpo_auto_confirms` | [`test_equipment.py#L106`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment.py#L106) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_book_private_pending` | [`test_equipment.py#L120`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment.py#L120) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_max_two_slots_per_day` | [`test_equipment.py#L130`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment.py#L130) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_double_book_same_slot_409` | [`test_equipment.py#L144`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment.py#L144) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_cancel_within_2h_blocked` | [`test_equipment.py#L155`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment.py#L155) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_cancel_promotes_waitlist` | [`test_equipment.py#L193`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment.py#L193) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_owner_create_update_machine` | [`test_equipment_owner.py#L53`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_owner.py#L53) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_owner_forbidden_for_farmer` | [`test_equipment_owner.py#L84`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_owner.py#L84) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_fleet_summary` | [`test_equipment_owner.py#L92`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_owner.py#L92) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_new_machine_pending_hidden_from_farmers` | [`test_equipment_owner.py#L112`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_owner.py#L112) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_verified_machine_visible` | [`test_equipment_owner.py#L127`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_owner.py#L127) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_fleet_includes_doc_status` | [`test_equipment_owner.py#L141`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_owner.py#L141) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_approve_pending_booking` | [`test_equipment_approve.py#L60`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_approve.py#L60) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_approve_non_pending_409` | [`test_equipment_approve.py#L77`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_approve.py#L77) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_reject_frees_slot_with_reason` | [`test_equipment_approve.py#L93`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_approve.py#L93) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_reject_promotes_waitlist_head` | [`test_equipment_approve.py#L116`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_approve.py#L116) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_non_owner_approve_403` | [`test_equipment_approve.py#L146`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_approve.py#L146) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_reject_without_reason_422` | [`test_equipment_approve.py#L164`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_approve.py#L164) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_pending_inbox_lists_owner_pending_only` | [`test_equipment_approve.py#L178`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_equipment_approve.py#L178) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |

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
# Example verification curl for Equipment Rental & Yantra Time-Slots
curl -X GET \
  "http://localhost:8000/v1/equipment" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

---
*Report generated automatically for AGROVERCITY platform verification.*
