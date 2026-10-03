# Superadmin Implementation Guide — Module 19: Livestock, Dairy & Veterinary Services

> **Document ID:** `SOP-19`  
> **Module Scope:** `Livestock, Dairy & Veterinary Services`  
> **Target Collections:** `gaushalas`, `nurseries`, `vets`, `dairy_products`, `vet_bookings`, `manure_orders`, `dairy_members`, `rate_charts`, `payment_batches`, `payment_entries`, `milk_sale_customers`, `milk_sale_orders`, `dairy_stock_items`, `gaushala_expenses`, `appointments`, `vet_schedules`, `prescriptions`, `vaccination_campaigns`, `campaign_enrollments`, `receipts`  
> **Superadmin UI Path:** `/admin/livestock`  
> **Access Level:** Super Admin (`customClaims: {admin: true}`)
> **Implementation Status (26 Sep 2026):** User-facing backend (FastAPI, tag `livestock`) and mobile consoles are **implemented and verified** (65 new tests; full suite 453 passed + 1 pre-existing skip). The superadmin console UI at `/admin/livestock` and its `/v1/admin/livestock/*` endpoints remain **pending — deferred by user decision** (see §5).

---

## 1. Administrative Overview & Scope

Rural livestock ecosystem: Gaushala directory and organic cow-dung manure orders, certified plant nurseries, 24x7 emergency vet doctor appointment booking, and direct A2 dairy marketplace.

The module has been converted into a full **Dairy + Gaushala + Doctor management system**. The 8th persona `dairyManager` is the livestock-domain super-manager: dairy procurement (member farmers, FAT/SNF rate charts) → payment settlement batches → milk sales and stock, a gaushala back-office (profile, cattle events, adoptions/donations with 80G receipts, expenses, dashboard), and a doctor network (manager-run vet directory, appointment lifecycle, prescriptions, vaccination campaigns) with a self-claim vet workspace. Farmer self-views expose milk slips and payments.

The Superadmin console must provide centralized oversight, auditability, dispute resolution, and emergency intervention capabilities for all user interactions, transactions, and state transitions within this module.

---

## 2. Managed Data Entities & Schema Reference

| Collection Name | Entity Description | Key Fields & Indexes | Retention & Privacy |
|---|---|---|---|
| `gaushalas` | Primary document collection for Livestock, Dairy & Veterinary Services | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `nurseries` | Primary document collection for Livestock, Dairy & Veterinary Services | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `vets` | Primary document collection for Livestock, Dairy & Veterinary Services | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `dairy_products` | Primary document collection for Livestock, Dairy & Veterinary Services | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `vet_bookings` | Primary document collection for Livestock, Dairy & Veterinary Services | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `manure_orders` | Primary document collection for Livestock, Dairy & Veterinary Services | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `dairy_members` | Member farmers registered under a dairyManager's collection center | `id`, `centerId`, `farmerUid`, `memberCode`, `deduction`, `status` | Bank details stored; payout audit required |
| `rate_charts` | FAT/SNF rate charts per center/species (single active per species) | `id`, `centerId`, `species`, `effectiveFrom`, `active` | Version history retained |
| `payment_batches` | Payment settlement batches generated per period | `id`, `centerId`, `periodFrom`, `periodTo`, `status` | Financial record; never hard-delete |
| `payment_entries` | Per-member payment rows within a batch | `id`, `batchId`, `memberId`, `netAmount`, `payoutRef`, `status` | Financial record; FCM notified |
| `milk_sale_customers` | Milk sale customers (household/shop/hotel) | `id`, `centerId`, `ratePerLiter`, `status` | Commercial record |
| `milk_sale_orders` | Milk sale orders (scheduled→delivered→billed→paid) | `id`, `centerId`, `customerId`, `orderDate`, `status` | Commercial record |
| `dairy_stock_items` | Dairy stock (milk/curd/ghee/paneer/other) | `id`, `centerId`, `stockQty`, `expiryDate` | Stock audit on adjust |
| `gaushala_expenses` | Gaushala expense ledger by category | `id`, `gaushalaId`, `category`, `amount`, `expenseDate` | Financial record |
| `appointments` | Vet appointments (requested→confirmed→in-progress→completed/cancelled) | `id`, `vetId`, `farmerUid`, `slotDate`, `status` | Health data; parties + dairyManager only |
| `vet_schedules` | Vet weekly slots, leaves, emergency/teleconsultation flags | `id` (vet doc id), `weeklySlots`, `leaves` | Owner-vet write |
| `prescriptions` | Animal prescriptions (diagnosis, medicines, milk-withdrawal days) | `id`, `vetId`, `animalId`, `farmerUid` | Health data; access restricted |
| `vaccination_campaigns` | Vaccination campaigns by dairyManager | `id`, `vaccine`, `fromDate`, `toDate`, `status` | Program record |
| `campaign_enrollments` | Campaign enrollments per animal | `id`, `campaignId`, `animalId`, `farmerUid`, `status` | Unique per (campaign, animal) |
| `receipts` | 80G-eligible donation/adoption receipts auto-issued by gaushala | `id`, `kind`, `refId`, `certificateNumber`, `eightyGEligible` | Tax document; never alter after issue |

Full field tables: `docs/schema/firestore-collections.md` (Livestock, dairy & doctor management section).

---

## 3. Superadmin Operational Capabilities

The superadmin interface for this module provides the following core operational functions:

- **Verify**: Verify Veterinary Doctor qualifications (B.V.Sc degree, State Veterinary Council registration, `vetCouncilRegNo`)
- **Audit**: Audit Gaushalas and certify cow welfare trust registration (80G/FCRA/AWBI certifications)
- **Approve**: Approve plant nurseries for government certified sapling distribution
- **Manage**: Manage dairy product purity certificates and hygiene compliance; oversee FAT/SNF rate charts, payment batches, and 80G receipt issuance
- **Mediate**: Mediate vet doctor appointment cancellations, payment-batch disputes, and emergency dispatch issues

---

## 4. UI/UX Layout & Screen Architecture

### 4.1 Screen Component Hierarchy
1. **Top Metric Bar:** Summary KPI cards displaying total records, pending review queues, today's activity, and flagged anomalies.
2. **Search & Filter Controls:** Full-text search by ID, phone, name; date range filter; status dropdown; persona filter.
3. **Primary Data Grid:** High-density paginated data table with sorting, column customization, and multi-row selection.
4. **Action Drawer / Slide-Over Modal:** Clicking any row opens a comprehensive detail drawer with full document JSON, audit logs, and action buttons.
5. **Confirmation Dialogs:** Destructive actions (rejection, ban, refund, override) mandate entering an administrative reason for the audit log.

### 4.2 Wireframe Layout

```
+----------------------------------------------------------------------------------------------------+
| AGROVERCITY SUPERADMIN  ::  LIVESTOCK, DAIRY & VETERINARY SERVICES                          [ Admin User: root@agrovercity ] |
+----------------------------------------------------------------------------------------------------+
|  [ Metric: Total Active ]   [ Metric: Pending Action ]   [ Metric: Today's Volume ]   [ Metric: Flagged ]  |
+----------------------------------------------------------------------------------------------------+
| Search: [ Search by name/id/phone... ]  Status: [ All Statuses v ]  Date: [ Last 30 Days v ]  [ Export ]   |
+----------------------------------------------------------------------------------------------------+
|  ID        | Entity / User       | Key Attributes     | Status     | Created At      | Actions       |
|------------|---------------------|--------------------|------------|-----------------|---------------|
| #1001      | Ram Patil           | Primary Details    | Verified   | 2026-09-18      | [View] [Edit] |
| #1002      | Suresh Jadhav       | Secondary Details  | Pending    | 2026-09-18      | [Approve] [X] |
| #1003      | Mahadev Shinde      | Flagged Record     | Disputed   | 2026-09-17      | [Investigate] |
+----------------------------------------------------------------------------------------------------+
| Showing 1 - 20 of 1,420 records                                               [ < Prev ] [ 1 2 3 ] [ Next > ] |
+----------------------------------------------------------------------------------------------------+
```

---

## 5. Backend Admin API Endpoints

> **Status: PENDING (deferred).** No `/v1/admin/livestock/*` endpoints are implemented yet. The table below is the target contract for the deferred console build — do not treat these as live.

All admin endpoints require an Authorization header with a Firebase ID token bearing the `admin: true` custom claim:
`Authorization: Bearer <firebase_id_token>`

| Method | Endpoint Path | Description | Request Body | Response Schema | Error Codes |
|---|---|---|---|---|---|
| `GET` | `List /v1/admin/livestock/vets` | List vet doctors and verification status | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Verify /v1/admin/livestock/vets/{id}/verify` | Verify vet credentials and license | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `GET` | `List /v1/admin/livestock/gaushalas` | List Gaushalas and product offerings | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `GET` | `Audit /v1/admin/livestock/orders` | Audit dairy and manure orders | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |

---

## 6. Business Guardrails & Compliance Controls

1. **Role-Based Admin Permissions:**
   - **Super Admin:** Unrestricted access to all read, write, delete, and financial override operations.
   - **Support Operator:** Read access and basic ticket triage; cannot issue direct financial payouts or delete records.
   - **Financial Auditor:** Read-only access to transaction ledgers, bank records, and payout reports.
2. **Audit Logging:** Every state modification (status change, approval, rejection, balance adjustment) automatically generates an immutable audit record in `audit_logs` with `adminUid`, `timestamp`, `ipAddress`, `previousState`, and `newState`.
3. **Financial Limits & Escalation:** Payout approvals exceeding ₹50,000 require dual-admin sign-off.
4. **Data Privacy (DPDP Act Compliance):** Aadhaar numbers are never displayed in full; only masked representations (XXXX-XXXX-1234) are accessible.

---
*Instructions prepared for AGROVERCITY Superadmin Panel construction.*
