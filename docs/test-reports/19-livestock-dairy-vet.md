# Test Report — Module 19: Livestock, Dairy & Veterinary Services

> **Document ID:** `TR-19`  
> **Module Tag:** `livestock`  
> **Backend Router(s):** [`backend/app/routers/livestock.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock.py), [`backend/app/routers/livestock_dairy.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py), [`backend/app/routers/livestock_gaushala.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py), [`backend/app/routers/livestock_vets.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py)  
> **Associated Test Suite(s):** [`backend/tests/test_livestock.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_livestock.py), [`backend/tests/test_dairy_mgmt.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py), [`backend/tests/test_gaushala_mgmt.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py), [`backend/tests/test_vet_mgmt.py`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py)  
> **Verification Status:** ✅ **PASSED** (455 passed, 1 skipped across the full backend suite; all module tests verified in pytest; mobile `flutter analyze` clean — 0 errors/warnings)

---

## 1. Module Overview & Business Purpose

The Livestock & Dairy module was converted from a 4-tab directory (Gaushala / Nursery / Vet / Dairy marketplace) into a full **Dairy + Gaushala + Doctor management system**, spanning dairy procurement→payments→sales, gaushala back-office operations, and a doctor network with a self-claim vet workspace. The 8th persona `dairyManager` is the livestock-domain super-manager; farmers get "My Milk & Payments" self-views and the vet booking flow was rewired onto `/livestock/appointments`.

This module is essential to the AGROVERCITY architecture, serving active personas across web and mobile interfaces. All operations enforce role-based access control (RBAC), input validation schemas, and database idempotency.

---

## 2. Implemented Endpoints Catalog

Total Implemented Endpoints in FastAPI: **66** (7 directory/marketplace + 59 dairy/gaushala/vet management)

### 2.1 Directory & marketplace — `livestock.py` (7)

| Method | Endpoint Path | Summary | Handler Function | File & Line | Auth / Roles | Status |
|---|---|---|---|---|---|---|
| `GET` | `/v1/gaushalas` | List Gaushalas | `list_gaushalas()` | [`livestock.py#L87`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock.py#L87) | Public | ✅ PASSED |
| `POST` | `/v1/gaushalas/{gaushala_id}/manure-order` | Order Manure | `order_manure()` | [`livestock.py#L103`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock.py#L103) | farmer | ✅ PASSED |
| `GET` | `/v1/nurseries` | List Nurseries | `list_nurseries()` | [`livestock.py#L123`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock.py#L123) | Public | ✅ PASSED |
| `GET` | `/v1/vets` | List Vets | `list_vets()` | [`livestock.py#L136`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock.py#L136) | Public | ✅ PASSED |
| `POST` | `/v1/vets/{vet_id}/book` | Book Vet | `book_vet()` | [`livestock.py#L154`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock.py#L154) | farmer | ✅ PASSED |
| `GET` | `/v1/dairy-products` | List Dairy Products | `list_dairy_products()` | [`livestock.py#L177`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock.py#L177) | Public | ✅ PASSED |
| `POST` | `/v1/dairy-products/{product_id}/order` | Order Dairy | `order_dairy()` | [`livestock.py#L191`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock.py#L191) | farmer, seller | ✅ PASSED |

### 2.2 Dairy management — `livestock_dairy.py` (26)

| Method | Endpoint Path | Summary | Handler Function | File & Line | Auth / Roles | Status |
|---|---|---|---|---|---|---|
| `GET` | `/v1/livestock/dairy/members` | List member farmers | `list_members()` | [`livestock_dairy.py#L77`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L77) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/dairy/members` | Add member farmer | `create_member()` | [`livestock_dairy.py#L90`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L90) | dairyManager | ✅ PASSED |
| `PUT` | `/v1/livestock/dairy/members/{member_id}` | Update member farmer | `update_member()` | [`livestock_dairy.py#L111`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L111) | dairyManager | ✅ PASSED |
| `DELETE` | `/v1/livestock/dairy/members/{member_id}` | Soft delete member | `delete_member()` | [`livestock_dairy.py#L133`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L133) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/dairy/members/{member_id}/statement` | Member statement ledger | `member_statement()` | [`livestock_dairy.py#L144`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L144) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/dairy/rate-chart` | Active FAT/SNF rate chart | `get_active_rate_chart()` | [`livestock_dairy.py#L194`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L194) | farmer, seller, dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/dairy/rate-chart/versions` | Rate chart versions | `list_rate_chart_versions()` | [`livestock_dairy.py#L205`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L205) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/dairy/rate-chart` | Create rate chart | `create_rate_chart()` | [`livestock_dairy.py#L219`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L219) | dairyManager | ✅ PASSED |
| `PUT` | `/v1/livestock/dairy/rate-chart/{chart_id}` | Update rate chart | `update_rate_chart()` | [`livestock_dairy.py#L244`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L244) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/dairy/payments/batches` | List payment batches | `list_payment_batches()` | [`livestock_dairy.py#L273`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L273) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/dairy/payments/batches` | Generate batch from period | `generate_payment_batch()` | [`livestock_dairy.py#L284`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L284) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/dairy/payments/batches/{batch_id}/mark-paid` | Mark batch paid + FCM | `mark_batch_paid()` | [`livestock_dairy.py#L339`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L339) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/dairy/farmer/payments` | Farmer payment self-view | `farmer_payments()` | [`livestock_dairy.py#L375`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L375) | farmer, seller, dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/dairy/farmer/slips` | Farmer slip self-view | `farmer_slips()` | [`livestock_dairy.py#L389`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L389) | farmer, seller, dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/dairy/sales/customers` | List sale customers | `list_sale_customers()` | [`livestock_dairy.py#L419`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L419) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/dairy/sales/customers` | Add sale customer | `create_sale_customer()` | [`livestock_dairy.py#L430`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L430) | dairyManager | ✅ PASSED |
| `PUT` | `/v1/livestock/dairy/sales/customers/{customer_id}` | Update sale customer | `update_sale_customer()` | [`livestock_dairy.py#L451`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L451) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/dairy/sales/orders` | List sale orders | `list_sale_orders()` | [`livestock_dairy.py#L472`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L472) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/dairy/sales/orders` | Create sale order | `create_sale_order()` | [`livestock_dairy.py#L486`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L486) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/dairy/sales/orders/{order_id}/status` | Advance order status | `update_sale_order_status()` | [`livestock_dairy.py#L515`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L515) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/dairy/sales/summary` | Sales summary | `sales_summary()` | [`livestock_dairy.py#L530`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L530) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/dairy/stock/items` | List stock items | `list_stock_items()` | [`livestock_dairy.py#L554`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L554) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/dairy/stock/items` | Add stock item | `create_stock_item()` | [`livestock_dairy.py#L565`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L565) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/dairy/stock/items/{item_id}/adjust` | Adjust stock qty | `adjust_stock_item()` | [`livestock_dairy.py#L583`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L583) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/dairy/reports/daily` | Daily report | `daily_report()` | [`livestock_dairy.py#L598`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L598) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/dairy/reports/pl` | Monthly P&L report | `pl_report()` | [`livestock_dairy.py#L625`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_dairy.py#L625) | dairyManager | ✅ PASSED |

### 2.3 Gaushala management — `livestock_gaushala.py` (13)

| Method | Endpoint Path | Summary | Handler Function | File & Line | Auth / Roles | Status |
|---|---|---|---|---|---|---|
| `GET` | `/v1/livestock/gaushala/mine` | Own gaushala profile | `get_my_gaushala()` | [`livestock_gaushala.py#L98`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py#L98) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/gaushala/profile` | Create gaushala profile | `create_gaushala_profile()` | [`livestock_gaushala.py#L103`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py#L103) | dairyManager | ✅ PASSED |
| `PUT` | `/v1/livestock/gaushala/profile` | Update gaushala profile | `update_gaushala_profile()` | [`livestock_gaushala.py#L127`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py#L127) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/gaushala/cattle` | Cattle inventory | `list_cattle()` | [`livestock_gaushala.py#L149`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py#L149) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/gaushala/cattle/{animal_id}/events` | Append cattle event | `add_cattle_event()` | [`livestock_gaushala.py#L164`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py#L164) | dairyManager | ✅ PASSED |
| `PUT` | `/v1/livestock/gaushala/adoptions/{adoption_id}/status` | Adoption status + receipt | `update_adoption_status()` | [`livestock_gaushala.py#L190`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py#L190) | dairyManager | ✅ PASSED |
| `PUT` | `/v1/livestock/gaushala/donations/{donation_id}/status` | Donation status + receipt | `update_donation_status()` | [`livestock_gaushala.py#L223`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py#L223) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/gaushala/expenses` | List expenses | `list_expenses()` | [`livestock_gaushala.py#L251`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py#L251) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/gaushala/expenses` | Add expense | `create_expense()` | [`livestock_gaushala.py#L266`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py#L266) | dairyManager | ✅ PASSED |
| `PUT` | `/v1/livestock/gaushala/expenses/{expense_id}` | Update expense | `update_expense()` | [`livestock_gaushala.py#L284`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py#L284) | dairyManager | ✅ PASSED |
| `DELETE` | `/v1/livestock/gaushala/expenses/{expense_id}` | Delete expense | `delete_expense()` | [`livestock_gaushala.py#L301`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py#L301) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/gaushala/expenses/summary` | Expense summary | `expenses_summary()` | [`livestock_gaushala.py#L311`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py#L311) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/gaushala/dashboard` | Gaushala dashboard | `dashboard()` | [`livestock_gaushala.py#L333`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_gaushala.py#L333) | dairyManager | ✅ PASSED |

### 2.4 Doctor / vet network — `livestock_vets.py` (20)

| Method | Endpoint Path | Summary | Handler Function | File & Line | Auth / Roles | Status |
|---|---|---|---|---|---|---|
| `GET` | `/v1/livestock/vets/managed` | Managed vet directory | `list_managed_vets()` | [`livestock_vets.py#L112`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L112) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/vets/managed` | Onboard vet | `create_managed_vet()` | [`livestock_vets.py#L126`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L126) | dairyManager | ✅ PASSED |
| `PUT` | `/v1/livestock/vets/managed/{vet_id}` | Update vet entry | `update_managed_vet()` | [`livestock_vets.py#L159`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L159) | dairyManager | ✅ PASSED |
| `DELETE` | `/v1/livestock/vets/managed/{vet_id}` | Deactivate vet | `deactivate_managed_vet()` | [`livestock_vets.py#L187`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L187) | dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/vets/claim` | Vet self-claim by phone | `claim_vet_profile()` | [`livestock_vets.py#L202`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L202) | all | ✅ PASSED |
| `GET` | `/v1/livestock/vets/me` | Vet workspace | `my_vet_workspace()` | [`livestock_vets.py#L221`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L221) | vet (claimed) | ✅ PASSED |
| `GET` | `/v1/livestock/vets/me/schedule` | Vet schedule | `get_my_schedule()` | [`livestock_vets.py#L240`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L240) | vet (claimed) | ✅ PASSED |
| `PUT` | `/v1/livestock/vets/me/schedule` | Update vet schedule | `update_my_schedule()` | [`livestock_vets.py#L245`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L245) | vet (claimed) | ✅ PASSED |
| `GET` | `/v1/livestock/vets/me/appointments` | Vet appointment inbox | `my_appointments()` | [`livestock_vets.py#L261`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L261) | vet (claimed) | ✅ PASSED |
| `GET` | `/v1/livestock/vets/me/earnings` | Vet earnings | `my_earnings()` | [`livestock_vets.py#L278`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L278) | vet (claimed) | ✅ PASSED |
| `POST` | `/v1/livestock/appointments` | Book appointment | `create_appointment()` | [`livestock_vets.py#L327`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L327) | farmer, seller, dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/appointments` | List appointments (role-scoped) | `list_my_appointments()` | [`livestock_vets.py#L377`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L377) | farmer, seller, dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/appointments/{appt_id}/status` | Appointment status + Rx | `update_appointment_status()` | [`livestock_vets.py#L399`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L399) | vet, farmer | ✅ PASSED |
| `POST` | `/v1/livestock/prescriptions` | Create prescription | `create_prescription()` | [`livestock_vets.py#L449`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L449) | vet, dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/prescriptions` | List prescriptions (ACL) | `list_prescriptions()` | [`livestock_vets.py#L468`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L468) | vet, dairyManager, owner | ✅ PASSED |
| `GET` | `/v1/livestock/vet/campaigns` | List campaigns | `list_campaigns()` | [`livestock_vets.py#L497`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L497) | farmer, seller, dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/vet/campaigns` | Create campaign | `create_campaign()` | [`livestock_vets.py#L511`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L511) | dairyManager | ✅ PASSED |
| `GET` | `/v1/livestock/vet/campaigns/{campaign_id}` | Campaign detail | `get_campaign()` | [`livestock_vets.py#L530`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L530) | farmer, seller, dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/vet/campaigns/{campaign_id}/enroll` | Enroll own animal | `enroll_campaign()` | [`livestock_vets.py#L539`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L539) | farmer, seller, dairyManager | ✅ PASSED |
| `POST` | `/v1/livestock/vet/campaigns/{campaign_id}/mark-vaccinated` | Mark vaccinated | `mark_vaccinated()` | [`livestock_vets.py#L578`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/app/routers/livestock_vets.py#L578) | dairyManager, vet | ✅ PASSED |

counts: 7 26 13 20 total 66

---

## 3. Test Suite Execution & Coverage Analysis

### 3.1 Test Suite Summary
- **Target Test Files:** `test_livestock.py`, `test_dairy_mgmt.py`, `test_gaushala_mgmt.py`, `test_vet_mgmt.py`
- **Total Test Cases Executed (module):** **74** (7 existing + 67 new)
- **New Coverage Added:** `test_dairy_mgmt.py` 23 · `test_gaushala_mgmt.py` 15 · `test_vet_mgmt.py` 29
- **Test Pass Rate:** **100% (All 74 passed)**
- **Full Backend Suite:** **455 passed, 1 skipped** (pre-existing skip), Pytest 9.1.1 on Python 3.10 with `pytest-asyncio` — 50.67 s
- **Mobile Verification:** `flutter analyze` — 0 errors, 0 warnings

### 3.2 Executed Test Cases Detail

**test_livestock.py (7 tests)**

| Test Function | File & Line | Verified Scenarios & Assertions | Status |
|---|---|---|---|
| `test_gaushalas_by_district()` | [`test_livestock.py#L19`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_livestock.py#L19) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_manure_order_201()` | [`test_livestock.py#L27`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_livestock.py#L27) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_vets_emergency_filter()` | [`test_livestock.py#L42`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_livestock.py#L42) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_farm_visit_unavailable_400()` | [`test_livestock.py#L54`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_livestock.py#L54) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_vet_booking_visible_in_my_bookings()` | [`test_livestock.py#L66`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_livestock.py#L66) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_dairy_order_out_of_stock_409()` | [`test_livestock.py#L79`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_livestock.py#L79) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |
| `test_dairy_order_total()` | [`test_livestock.py#L91`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_livestock.py#L91) | Validates request payloads, status codes, database state mutations, and ACL rules | ✅ PASSED |

**test_dairy_mgmt.py (23 tests)**

| Test Function | File & Line | Verified Scenarios & Assertions | Status |
|---|---|---|---|
| `test_member_create_and_list()` | [`test_dairy_mgmt.py#L85`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L85) | Member created with auto memberCode; appears in center list envelope | ✅ PASSED |
| `test_member_update()` | [`test_dairy_mgmt.py#L99`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L99) | Member fields update in place; 404 for other center | ✅ PASSED |
| `test_member_soft_delete()` | [`test_dairy_mgmt.py#L112`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L112) | DELETE sets status=inactive (soft delete), doc retained | ✅ PASSED |
| `test_member_endpoints_forbidden_for_farmer()` | [`test_dairy_mgmt.py#L121`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L121) | Non-dairyManager callers get 403 on member CRUD | ✅ PASSED |
| `test_member_other_center_not_found()` | [`test_dairy_mgmt.py#L136`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L136) | Cross-center member access returns 404 MEMBER_NOT_FOUND | ✅ PASSED |
| `test_member_statement_ledger()` | [`test_dairy_mgmt.py#L150`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L150) | Statement aggregates collections + payments with totals {liters, amount, paid} | ✅ PASSED |
| `test_rate_chart_public_read()` | [`test_dairy_mgmt.py#L174`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L174) | Any livestock user reads active chart; 404 when none | ✅ PASSED |
| `test_rate_chart_versions()` | [`test_dairy_mgmt.py#L191`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L191) | Version list returns center charts sorted by effectiveFrom desc | ✅ PASSED |
| `test_rate_chart_activation_exclusivity()` | [`test_dairy_mgmt.py#L206`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L206) | Activating a chart deactivates same-species peers (single active) | ✅ PASSED |
| `test_rate_chart_write_forbidden_for_farmer()` | [`test_dairy_mgmt.py#L238`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L238) | Farmer/seller cannot create or update rate charts (403) | ✅ PASSED |
| `test_batch_generation_math()` | [`test_dairy_mgmt.py#L271`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L271) | Batch sums member collections, applies flat deduction, netAmount math exact | ✅ PASSED |
| `test_batch_mark_paid_notifies_members()` | [`test_dairy_mgmt.py#L301`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L301) | Mark-paid sets entries paid with payoutRef and FCMs each member | ✅ PASSED |
| `test_batch_mark_paid_twice_409()` | [`test_dairy_mgmt.py#L328`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L328) | Second mark-paid rejected 409 ALREADY_PAID | ✅ PASSED |
| `test_farmer_payments_view()` | [`test_dairy_mgmt.py#L350`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L350) | Farmer sees only own payment entries | ✅ PASSED |
| `test_farmer_slips_view()` | [`test_dairy_mgmt.py#L370`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L370) | Farmer slip view scopes to own collections and returns memberCode | ✅ PASSED |
| `test_sale_customer_crud()` | [`test_dairy_mgmt.py#L386`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L386) | Customer create/list/update round-trip | ✅ PASSED |
| `test_sale_order_amount_from_items()` | [`test_dairy_mgmt.py#L403`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L403) | Order amount computed from items total | ✅ PASSED |
| `test_sale_order_amount_from_customer_rate()` | [`test_dairy_mgmt.py#L426`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L426) | Fallback amount = liters x customer ratePerLiter | ✅ PASSED |
| `test_sale_order_lifecycle()` | [`test_dairy_mgmt.py#L438`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L438) | scheduled->delivered->billed->paid transitions enforced | ✅ PASSED |
| `test_sales_summary()` | [`test_dairy_mgmt.py#L467`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L467) | Summary totals liters/amount/collected + byStatus counts | ✅ PASSED |
| `test_stock_create_and_adjust()` | [`test_dairy_mgmt.py#L491`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L491) | Stock item created; adjust updates qty and lastAdjustment | ✅ PASSED |
| `test_daily_report_shape()` | [`test_dairy_mgmt.py#L519`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L519) | Daily report shape: collections, sales, closingStock | ✅ PASSED |
| `test_pl_report_math()` | [`test_dairy_mgmt.py#L551`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_dairy_mgmt.py#L551) | P&L: grossProfit = salesIncome - procurementCost | ✅ PASSED |

**test_gaushala_mgmt.py (15 tests)**

| Test Function | File & Line | Verified Scenarios & Assertions | Status |
|---|---|---|---|
| `test_profile_create_and_get()` | [`test_gaushala_mgmt.py#L40`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L40) | Gaushala profile created (201) and returned by /mine | ✅ PASSED |
| `test_profile_duplicate_409()` | [`test_gaushala_mgmt.py#L54`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L54) | Second profile for same manager rejected 409 GAUSHALA_EXISTS | ✅ PASSED |
| `test_profile_update()` | [`test_gaushala_mgmt.py#L62`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L62) | Profile fields update via PUT | ✅ PASSED |
| `test_profile_requires_manager_role()` | [`test_gaushala_mgmt.py#L77`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L77) | Non-dairyManager cannot create profile (403) | ✅ PASSED |
| `test_gaushala_endpoints_require_profile()` | [`test_gaushala_mgmt.py#L89`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L89) | Cattle/expense/dashboard routes 404 before profile exists | ✅ PASSED |
| `test_cattle_listing_filter()` | [`test_gaushala_mgmt.py#L100`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L100) | Cattle list filters by own gaushalaId and category | ✅ PASSED |
| `test_cattle_event_append_and_status()` | [`test_gaushala_mgmt.py#L116`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L116) | Event appended; cattleStatus set from event type map | ✅ PASSED |
| `test_cattle_event_other_gaushala_404()` | [`test_gaushala_mgmt.py#L145`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L145) | Events on another gaushala's animal rejected 404 | ✅ PASSED |
| `test_adoption_approve_creates_receipt()` | [`test_gaushala_mgmt.py#L160`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L160) | Approve creates 80G-eligible receipts doc + FCM to donor | ✅ PASSED |
| `test_adoption_invalid_transition()` | [`test_gaushala_mgmt.py#L198`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L198) | Illegal adoption transitions rejected 409 INVALID_TRANSITION | ✅ PASSED |
| `test_donation_acknowledge_creates_receipt()` | [`test_gaushala_mgmt.py#L227`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L227) | Acknowledge creates receipt with certificate number | ✅ PASSED |
| `test_expenses_crud()` | [`test_gaushala_mgmt.py#L251`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L251) | Expense create/list/update/delete round-trip | ✅ PASSED |
| `test_expenses_summary_by_category()` | [`test_gaushala_mgmt.py#L280`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L280) | Summary buckets totals by category | ✅ PASSED |
| `test_expenses_forbidden_for_farmer()` | [`test_gaushala_mgmt.py#L310`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L310) | Non-manager cannot manage expenses (403) | ✅ PASSED |
| `test_dashboard_aggregates()` | [`test_gaushala_mgmt.py#L324`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_gaushala_mgmt.py#L324) | Dashboard: headcount, occupancyPercent, month donations/expenses | ✅ PASSED |

**test_vet_mgmt.py (29 tests)**

| Test Function | File & Line | Verified Scenarios & Assertions | Status |
|---|---|---|---|
| `test_manager_vet_crud()` | [`test_vet_mgmt.py#L101`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L101) | Vet directory create/list/update extends vets doc fields | ✅ PASSED |
| `test_manager_vet_deactivate()` | [`test_vet_mgmt.py#L128`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L128) | DELETE sets vet status=inactive | ✅ PASSED |
| `test_vet_crud_forbidden_for_farmer()` | [`test_vet_mgmt.py#L139`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L139) | Farmer cannot manage vet directory (403) | ✅ PASSED |
| `test_claim_by_phone_match()` | [`test_vet_mgmt.py#L151`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L151) | Claim sets claimedByUid when phone matches vets doc | ✅ PASSED |
| `test_claim_already_claimed_guard()` | [`test_vet_mgmt.py#L161`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L161) | Second claim by different uid rejected 409 ALREADY_CLAIMED | ✅ PASSED |
| `test_claim_404_for_non_matching_phone()` | [`test_vet_mgmt.py#L172`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L172) | No phone match -> 404 VET_NOT_FOUND | ✅ PASSED |
| `test_vet_me_requires_claim()` | [`test_vet_mgmt.py#L181`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L181) | Workspace endpoints 404 before claim | ✅ PASSED |
| `test_vet_me_after_claim()` | [`test_vet_mgmt.py#L188`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L188) | Workspace returns vet + default schedule + stats | ✅ PASSED |
| `test_schedule_merge_put()` | [`test_vet_mgmt.py#L205`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L205) | Schedule PUT merges weeklySlots/leaves additively | ✅ PASSED |
| `test_appointment_create_and_farmer_list()` | [`test_vet_mgmt.py#L240`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L240) | Appointment created (201) with FCM to vet; farmer list scoped | ✅ PASSED |
| `test_manager_sees_all_appointments_newest_first()` | [`test_vet_mgmt.py#L265`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L265) | dairyManager GET returns all appointments newest-first | ✅ PASSED |
| `test_farmer_appointments_still_scoped_to_own()` | [`test_vet_mgmt.py#L303`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L303) | Farmer list remains own-only after manager access | ✅ PASSED |
| `test_appointment_respects_weekly_schedule()` | [`test_vet_mgmt.py#L320`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L320) | Booking outside weekly slots / tele flag rejected 400 | ✅ PASSED |
| `test_appointment_vet_lifecycle_with_inline_prescription()` | [`test_vet_mgmt.py#L347`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L347) | Vet lifecycle to completed with vetNotes + inline prescription doc | ✅ PASSED |
| `test_farmer_cannot_confirm_appointment()` | [`test_vet_mgmt.py#L394`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L394) | Farmer confirming rejected 403 FORBIDDEN_ROLE | ✅ PASSED |
| `test_farmer_can_cancel_appointment()` | [`test_vet_mgmt.py#L411`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L411) | Farmer can cancel a requested/confirmed appointment | ✅ PASSED |
| `test_other_vet_cannot_confirm()` | [`test_vet_mgmt.py#L438`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L438) | A different vet cannot transition this appointment (403) | ✅ PASSED |
| `test_appointment_invalid_transition_409()` | [`test_vet_mgmt.py#L459`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L459) | Skipped lifecycle steps rejected 409 INVALID_TRANSITION | ✅ PASSED |
| `test_vet_inbox_filter()` | [`test_vet_mgmt.py#L483`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L483) | Vet inbox filters by status and date | ✅ PASSED |
| `test_prescription_create_by_vet()` | [`test_vet_mgmt.py#L523`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L523) | Claimed vet creates standalone prescription | ✅ PASSED |
| `test_prescription_create_forbidden_for_plain_farmer()` | [`test_vet_mgmt.py#L537`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L537) | Plain farmer cannot create prescriptions (403) | ✅ PASSED |
| `test_prescription_access_rules()` | [`test_vet_mgmt.py#L547`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L547) | Access: writing vet, any dairyManager, or animal owner only | ✅ PASSED |
| `test_prescription_list_scoping()` | [`test_vet_mgmt.py#L577`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L577) | List scoping per role (manager all / vet own / farmer own) | ✅ PASSED |
| `test_campaigns_create_list_detail()` | [`test_vet_mgmt.py#L600`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L600) | Campaign create/list/detail with enrollments | ✅ PASSED |
| `test_campaign_create_forbidden_for_farmer()` | [`test_vet_mgmt.py#L626`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L626) | Farmer cannot create campaigns (403) | ✅ PASSED |
| `test_campaign_enroll_own_animal()` | [`test_vet_mgmt.py#L632`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L632) | Enroll own animal (201) with FCM reminder | ✅ PASSED |
| `test_campaign_enroll_other_animal_403()` | [`test_vet_mgmt.py#L669`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L669) | Enrolling another's animal rejected 403 | ✅ PASSED |
| `test_campaign_mark_vaccinated()` | [`test_vet_mgmt.py#L687`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L687) | Mark-vaccinated flips enrollment status with FCM | ✅ PASSED |
| `test_vet_earnings_sum()` | [`test_vet_mgmt.py#L747`](file:////home/tushka/Projects/AGROVERCITY/backend/backend/tests/test_vet_mgmt.py#L747) | Earnings sums completed-appointment fees for month | ✅ PASSED |

### 3.3 Error Scenarios & Edge Cases Verified
- **HTTP 401 Unauthorized:** Missing or malformed `Authorization: Bearer <token>` header properly rejected.
- **HTTP 403 Forbidden Role:** Persona gates enforced — farmer/seller rejected from dairyManager member/rate-chart/expense/vet-directory writes; non-party users rejected from appointment transitions; other owners' animals rejected from campaign enrollment; plain farmers rejected from prescription writes.
- **HTTP 404 Not Found:** Invalid entity IDs or missing database records return structured `{"error": {"code": "NOT_FOUND"}}` — including cross-center `MEMBER_NOT_FOUND`, pre-profile gaushala routes, unmatched vet-claim phone, and missing campaign enrollments.
- **HTTP 409 Conflict / Duplicate:** Prevents race conditions and invalid transitions — `ALREADY_PAID` batch double-mark, `INVALID_TRANSITION` order/adoption/appointment state machines, `ALREADY_CLAIMED` vet profile, `ALREADY_ENROLLED` campaign dedupe, `GAUSHALA_EXISTS` duplicate profile, rate-chart single-active exclusivity.
- **HTTP 422 Validation Error:** Malformed request bodies or out-of-range numeric arguments fail FastApi Pydantic validation.

---

## 4. Manual Verification & CURL Examples

### Sample Request:
```bash
# Example verification curl for Livestock, Dairy & Veterinary Services
curl -X GET \
  "http://localhost:8000/v1/gaushalas" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

### Dairy management sample:
```bash
# Generate a payment settlement batch for a period (dairyManager)
curl -X POST \
  "http://localhost:8000/v1/livestock/dairy/payments/batches" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"periodFrom": "2026-09-01", "periodTo": "2026-09-30"}'
```

### Doctor network sample:
```bash
# Vet advances an appointment to completed with an inline prescription
curl -X POST \
  "http://localhost:8000/v1/livestock/appointments/ap_xxx/status" \
  -H "Authorization: Bearer $VET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed", "vetNotes": "Recovered well", "prescription": {"diagnosis": "Fever", "medicines": [{"name": "Paracetamol", "dosage": "10ml", "frequency": "BD", "durationDays": 3}], "milkWithdrawalDays": 4}}'
```

---
*Report generated automatically for AGROVERCITY platform verification.*
