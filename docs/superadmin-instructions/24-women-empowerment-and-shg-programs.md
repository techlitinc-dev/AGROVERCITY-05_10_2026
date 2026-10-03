# Superadmin Implementation Guide — Module 24: Women in Agriculture & Self Help Groups

> **Document ID:** `SOP-24`  
> **Module Scope:** `Women in Agriculture & Self Help Groups`  
> **Target Collections:** `women_shgs`, `shg_deposits`, `home_enterprises`  
> **Superadmin UI Path:** `/admin/women`  
> **Access Level:** Super Admin (`customClaims: {admin: true}`)

---

## 1. Administrative Overview & Scope

Financial inclusion and rural livelihood programs for Mahila Kisan: Self Help Group (SHG) micro-savings ledger, monthly recurring deposits, group loans, and homemade value-added agro-products marketplace.

The Superadmin console must provide centralized oversight, auditability, dispute resolution, and emergency intervention capabilities for all user interactions, transactions, and state transitions within this module.

---

## 2. Managed Data Entities & Schema Reference

| Collection Name | Entity Description | Key Fields & Indexes | Retention & Privacy |
|---|---|---|---|
| `women_shgs` | Primary document collection for Women in Agriculture & Self Help Groups | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `shg_deposits` | Primary document collection for Women in Agriculture & Self Help Groups | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `home_enterprises` | Primary document collection for Women in Agriculture & Self Help Groups | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |

---

## 3. Superadmin Operational Capabilities

The superadmin interface for this module provides the following core operational functions:

- **Verify**: Verify SHG registration documents, bank accounts, and cluster federation linkage
- **Monitor**: Monitor weekly SHG meeting attendance, deposit discipline, and internal loan repayment
- **Review**: Review and approve cottage agro-processing products (pickles, papad, handloom, spices)
- **Disburse**: Disburse interest subvention subsidies and NRLM capacity building grants
- **Generate**: Generate socio-economic impact metrics across women-led agri-enterprises

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
| AGROVERCITY SUPERADMIN  ::  WOMEN IN AGRICULTURE & SELF HELP GROUPS                          [ Admin User: root@agrovercity ] |
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

All admin endpoints require an Authorization header with a Firebase ID token bearing the `admin: true` custom claim:
`Authorization: Bearer <firebase_id_token>`

| Method | Endpoint Path | Description | Request Body | Response Schema | Error Codes |
|---|---|---|---|---|---|
| `GET` | `Pending /v1/admin/women/shgs/queue` | Pending SHG verification applications | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Approve /v1/admin/women/shgs/{id}/verify` | Approve SHG registration & grant eligibility | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Credit /v1/admin/women/subsidies/disburse` | Credit interest subvention subsidy to SHG bank | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `GET` | `Curate /v1/admin/women/enterprise-products` | Curate home enterprise storefront | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |

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
