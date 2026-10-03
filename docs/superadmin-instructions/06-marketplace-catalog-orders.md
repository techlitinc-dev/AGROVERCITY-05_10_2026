# Superadmin Implementation Guide — Module 06: Input Marketplace, Cart, Orders & Payments

> **Document ID:** `SOP-06`  
> **Module Scope:** `Input Marketplace, Cart, Orders & Payments`  
> **Target Collections:** `products`, `orders`, `users/{uid}/cart`, `users/{uid}/addresses`, `products/{id}/reviews`, `payments`  
> **Superadmin UI Path:** `/admin/marketplace`  
> **Access Level:** Super Admin (`customClaims: {admin: true}`)

---

## 1. Administrative Overview & Scope

Full agri-input marketplace for seeds, fertilizers, pesticides, and machinery; QR certification verification, cart CRUD, order placement, Razorpay payment capture and automated refunds, and delivery address management.

The Superadmin console must provide centralized oversight, auditability, dispute resolution, and emergency intervention capabilities for all user interactions, transactions, and state transitions within this module.

---

## 2. Managed Data Entities & Schema Reference

| Collection Name | Entity Description | Key Fields & Indexes | Retention & Privacy |
|---|---|---|---|
| `products` | Primary document collection for Input Marketplace, Cart, Orders & Payments | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `orders` | Primary document collection for Input Marketplace, Cart, Orders & Payments | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `users/{uid}/cart` | Primary document collection for Input Marketplace, Cart, Orders & Payments | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `users/{uid}/addresses` | Primary document collection for Input Marketplace, Cart, Orders & Payments | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `products/{id}/reviews` | Primary document collection for Input Marketplace, Cart, Orders & Payments | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `payments` | Primary document collection for Input Marketplace, Cart, Orders & Payments | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |

---

## 3. Superadmin Operational Capabilities

The superadmin interface for this module provides the following core operational functions:

- **Manage**: Manage product catalog (create, edit, discontinue agricultural inputs)
- **Upload**: Upload and verify Agmark/Ministry QR authenticity certificates
- **Monitor**: Monitor order lifecycle (placed -> confirmed -> dispatched -> delivered -> cancelled)
- **Process**: Process manual Razorpay refunds for eligible cancellations
- **Moderate**: Moderate product customer reviews and star ratings
- **Manage**: Manage dealer commissions and distributor inventory levels

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
| AGROVERCITY SUPERADMIN  ::  INPUT MARKETPLACE, CART, ORDERS & PAYMENTS                          [ Admin User: root@agrovercity ] |
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
| `GET` | `List /v1/admin/marketplace/products` | List products with filter and stock status | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Add /v1/admin/marketplace/products` | Add new product SKU to catalog | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `PUT` | `Update /v1/admin/marketplace/products/{id}` | Update product pricing and inventory | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `GET` | `List /v1/admin/marketplace/orders` | List orders with delivery and payment status | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Trigger /v1/admin/marketplace/orders/{id}/refund` | Trigger Razorpay refund for cancelled order | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |

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
