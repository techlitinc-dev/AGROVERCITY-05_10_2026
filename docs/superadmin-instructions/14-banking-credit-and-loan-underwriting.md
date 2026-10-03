# Superadmin Implementation Guide — Module 14: Banking, Credit Score & Microfinance

> **Document ID:** `SOP-14`  
> **Module Scope:** `Banking, Credit Score & Microfinance`  
> **Target Collections:** `bank_accounts`, `loan_applications`, `kcc_records`  
> **Superadmin UI Path:** `/admin/finance`  
> **Access Level:** Super Admin (`customClaims: {admin: true}`)

---

## 1. Administrative Overview & Scope

Rural banking gateway: penny-drop bank account verification, primary payout account management, Kisan Credit Score assessment, loan EMI calculator, KCC limit tracking, and input-loan applications.

The Superadmin console must provide centralized oversight, auditability, dispute resolution, and emergency intervention capabilities for all user interactions, transactions, and state transitions within this module.

---

## 2. Managed Data Entities & Schema Reference

| Collection Name | Entity Description | Key Fields & Indexes | Retention & Privacy |
|---|---|---|---|
| `bank_accounts` | Primary document collection for Banking, Credit Score & Microfinance | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `loan_applications` | Primary document collection for Banking, Credit Score & Microfinance | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `kcc_records` | Primary document collection for Banking, Credit Score & Microfinance | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |

---

## 3. Superadmin Operational Capabilities

The superadmin interface for this module provides the following core operational functions:

- **Audit**: Audit bank account penny-drop verification failures and override valid accounts
- **Underwrite**: Underwrite farmer input-loan applications and partner bank routing
- **Monitor**: Monitor Kisan Credit Score algorithm factors and tier distributions
- **Audit**: Audit bank account masking (XXXX + last-4 digits) compliance
- **Track**: Track loan repayment milestones and default risk indicators

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
| AGROVERCITY SUPERADMIN  ::  BANKING, CREDIT SCORE & MICROFINANCE                          [ Admin User: root@agrovercity ] |
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
| `GET` | `List /v1/admin/finance/accounts` | List registered bank accounts and status | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Manual /v1/admin/finance/accounts/{id}/override-verify` | Manual penny-drop approval | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `GET` | `Loan /v1/admin/finance/loans` | Loan application underwriting queue | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `PUT` | `Update /v1/admin/finance/loans/{id}/status` | Update loan application approval status | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |

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
