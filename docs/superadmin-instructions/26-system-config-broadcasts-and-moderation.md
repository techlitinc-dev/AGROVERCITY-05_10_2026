# Superadmin Implementation Guide — Module 26: System Health, Remote Config, Broadcast & Moderation

> **Document ID:** `SOP-26`  
> **Module Scope:** `System Health, Remote Config, Broadcast & Moderation`  
> **Target Collections:** `app_config`, `broadcasts`, `user_reports`, `user_blocks`, `user_consents`, `audit_logs`, `expert_tickets`  
> **Superadmin UI Path:** `/admin/app-config`  
> **Access Level:** Super Admin (`customClaims: {admin: true}`)

---

## 1. Administrative Overview & Scope

Platform governance & superadmin operations: unified KPI dashboard across all 26 modules, user moderation & status suspension, document vault KYC review queue, agronomist consultation resolution desk, dynamic app configuration, version gates, and targeted FCM broadcast.

The Superadmin console must provide centralized oversight, auditability, dispute resolution, and emergency intervention capabilities for all user interactions, transactions, and state transitions within this module.

---

## 2. Managed Data Entities & Schema Reference

| Collection Name | Entity Description | Key Fields & Indexes | Retention & Privacy |
|---|---|---|---|
| `app_config` | Primary document collection for System Health, Remote Config, Broadcast & Moderation | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `broadcasts` | Primary document collection for System Health, Remote Config, Broadcast & Moderation | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `user_reports` | Primary document collection for System Health, Remote Config, Broadcast & Moderation | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `user_blocks` | Primary document collection for System Health, Remote Config, Broadcast & Moderation | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `user_consents` | Primary document collection for System Health, Remote Config, Broadcast & Moderation | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `audit_logs` | Primary document collection for System Health, Remote Config, Broadcast & Moderation | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `expert_tickets` | Primary document collection for System Health, Remote Config, Broadcast & Moderation | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |

---

## 3. Superadmin Operational Capabilities

The superadmin interface for this module provides the following core operational functions:

- **Configure**: Configure minimum supported mobile app version and trigger force-update splash screen
- **Toggle**: Toggle dynamic feature flags per persona and district without app redeployment
- **Targeted**: Targeted FCM push notification broadcast engine filtered by persona, state, and district
- **User-generated**: User-generated content (UGC) moderation queue for reported abusive users and spam
- **View**: View real-time system health, database latency, Redis cache hit rates, and Sentry error logs
- **Audit**: Audit user consent records for DPDP (Digital Personal Data Protection) compliance

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
| AGROVERCITY SUPERADMIN  ::  SYSTEM HEALTH, REMOTE CONFIG, BROADCAST & MODERATION                          [ Admin User: root@agrovercity ] |
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
| `GET` | `Fetch /v1/admin/app-config` | Fetch current app version gates and feature flags | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `PUT` | `Update /v1/admin/app-config` | Update minSupportedVersion and feature flags | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Send /v1/admin/broadcast` | Send targeted FCM push notification to user segments | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `GET` | `List /v1/admin/reports` | List reported users and content for moderation | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Resolve /v1/admin/reports/{id}/resolve` | Resolve report with warning or ban | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `GET` | `Global /v1/admin/analytics/summary` | Global platform KPI dashboard summary | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |

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
