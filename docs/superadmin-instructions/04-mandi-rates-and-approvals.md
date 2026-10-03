# Superadmin Implementation Guide — Module 04: Mandi Prices, Vyapari Live Rates & Approvals

> **Document ID:** `SOP-04`  
> **Module Scope:** `Mandi Prices, Vyapari Live Rates & Approvals`  
> **Target Collections:** `mandi_prices`, `vyapari_rates`, `mandi_history`  
> **Superadmin UI Path:** `/admin/mandi`  
> **Access Level:** Super Admin (`customClaims: {admin: true}`)

---

## 1. Administrative Overview & Scope

Provides live commodity rates synced from Agmarknet/eNAM APIs, 2-hourly partner trader rates ('Aaj ke Bhav'), net-profit mandi comparison, and historical price trends.

The Superadmin console must provide centralized oversight, auditability, dispute resolution, and emergency intervention capabilities for all user interactions, transactions, and state transitions within this module.

---

## 2. Managed Data Entities & Schema Reference

| Collection Name | Entity Description | Key Fields & Indexes | Retention & Privacy |
|---|---|---|---|
| `mandi_prices` | Primary document collection for Mandi Prices, Vyapari Live Rates & Approvals | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `vyapari_rates` | Primary document collection for Mandi Prices, Vyapari Live Rates & Approvals | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `mandi_history` | Primary document collection for Mandi Prices, Vyapari Live Rates & Approvals | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |

---

## 3. Superadmin Operational Capabilities

The superadmin interface for this module provides the following core operational functions:

- **Monitor**: Monitor daily trader rate submissions in rate approvals queue
- **Validate**: Validate posted rates against ±15% sanity band of Agmarknet modal price
- **Approve**: Approve rate updates for instant publication to mobile app
- **Reject**: Reject suspicious or predatory rates with feedback to trader
- **Manual**: Manual rate entry or override for mandis with broken government feeds
- **Track**: Track Agmarknet API sync health and failure alerts

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
| AGROVERCITY SUPERADMIN  ::  MANDI PRICES, VYAPARI LIVE RATES & APPROVALS                          [ Admin User: root@agrovercity ] |
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
| `GET` | `List /v1/admin/rates/pending` | List pending vyapari rate submissions | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Approve /v1/admin/rates/{id}/approve` | Approve rate update for immediate live feed | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Reject /v1/admin/rates/{id}/reject` | Reject rate update with explanation | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Trigger /v1/admin/mandi/sync` | Trigger manual Agmarknet sync job | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |

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
