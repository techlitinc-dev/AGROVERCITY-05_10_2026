# Superadmin Implementation Guide — Module 22: Gamification, Krishi Ratna & Referrals

> **Document ID:** `SOP-22`  
> **Module Scope:** `Gamification, Krishi Ratna & Referrals`  
> **Target Collections:** `gamification_status`, `agri_coins_ledger`, `reward_coupons`, `referrals`, `ratings`  
> **Superadmin UI Path:** `/admin/ratings`  
> **Access Level:** Super Admin (`customClaims: {admin: true}`)

---

## 1. Administrative Overview & Scope

User engagement and virality engine: Krishi Ratna progression tiers (1-5), AgriCoins virtual currency ledger, rewards store coupon redemption, referral attribution (+100 coins), and service ratings.

The Superadmin console must provide centralized oversight, auditability, dispute resolution, and emergency intervention capabilities for all user interactions, transactions, and state transitions within this module.

---

## 2. Managed Data Entities & Schema Reference

| Collection Name | Entity Description | Key Fields & Indexes | Retention & Privacy |
|---|---|---|---|
| `gamification_status` | Primary document collection for Gamification, Krishi Ratna & Referrals | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `agri_coins_ledger` | Primary document collection for Gamification, Krishi Ratna & Referrals | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `reward_coupons` | Primary document collection for Gamification, Krishi Ratna & Referrals | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `referrals` | Primary document collection for Gamification, Krishi Ratna & Referrals | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `ratings` | Primary document collection for Gamification, Krishi Ratna & Referrals | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |

---

## 3. Superadmin Operational Capabilities

The superadmin interface for this module provides the following core operational functions:

- **Monitor**: Monitor platform-wide AgriCoins circulation and daily mint/burn totals
- **Manage**: Manage rewards store inventory (vouchers, discounts, partner services)
- **Detect**: Detect and prevent referral fraud (device farms, duplicate phone numbers)
- **Configure**: Configure AgriCoins earn rates for app activities (diary, bookings, invites)
- **Moderate**: Moderate user reviews and 1-5 star service ratings for transporters and equipment

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
| AGROVERCITY SUPERADMIN  ::  GAMIFICATION, KRISHI RATNA & REFERRALS                          [ Admin User: root@agrovercity ] |
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
| `GET` | `System-wide /v1/admin/gamification/ledger` | System-wide AgriCoins transaction log | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Add /v1/admin/gamification/rewards` | Add new voucher to rewards store | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `GET` | `Referral /v1/admin/referrals/audit` | Referral fraud detection report | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `DELETE` | `Remove /v1/admin/ratings/{id}` | Remove abusive or defamatory rating | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |

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
