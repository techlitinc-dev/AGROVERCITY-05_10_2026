# Superadmin Implementation Guide — Module 20: Knowledge Hub, Content CMS & Live Media

> **Document ID:** `SOP-20`  
> **Module Scope:** `Knowledge Hub, Content CMS & Live Media`  
> **Target Collections:** `agri_news`, `agri_channels`, `workshops`, `expert_talks`, `video_guides`, `blog_articles`  
> **Superadmin UI Path:** `/admin/content`  
> **Access Level:** Super Admin (`customClaims: {admin: true}`)

---

## 1. Administrative Overview & Scope

Agronomy knowledge hub: Agri news feed with vernacular audio text, live streaming TV channels with real-time chat, ICAR-certified paid workshops, Ask-the-Scientist expert talks, video tutorials, and blogs.

The Superadmin console must provide centralized oversight, auditability, dispute resolution, and emergency intervention capabilities for all user interactions, transactions, and state transitions within this module.

---

## 2. Managed Data Entities & Schema Reference

| Collection Name | Entity Description | Key Fields & Indexes | Retention & Privacy |
|---|---|---|---|
| `agri_news` | Primary document collection for Knowledge Hub, Content CMS & Live Media | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `agri_channels` | Primary document collection for Knowledge Hub, Content CMS & Live Media | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `workshops` | Primary document collection for Knowledge Hub, Content CMS & Live Media | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `expert_talks` | Primary document collection for Knowledge Hub, Content CMS & Live Media | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `video_guides` | Primary document collection for Knowledge Hub, Content CMS & Live Media | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `blog_articles` | Primary document collection for Knowledge Hub, Content CMS & Live Media | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |

---

## 3. Superadmin Operational Capabilities

The superadmin interface for this module provides the following core operational functions:

- **Publish,**: Publish, edit, and schedule agricultural news articles with breaking news tags
- **Manage**: Manage live TV channels, RTMP ingest stream keys, and HLS playback URLs
- **Moderate**: Moderate live channel chat messages and ban abusive users
- **Create**: Create paid workshops, manage seat inventory, and view enrolled farmers
- **Schedule**: Schedule expert scientist talks and triage farmer questions
- **Publish**: Publish agronomy video guides and articles with bilingual translations

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
| AGROVERCITY SUPERADMIN  ::  KNOWLEDGE HUB, CONTENT CMS & LIVE MEDIA                          [ Admin User: root@agrovercity ] |
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
| `GET` | `List /v1/admin/content/{collection}` | List and paginate CMS content items | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Create /v1/admin/content/{collection}` | Create news, blog, workshop, or video | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `PUT` | `Update /v1/admin/content/{collection}/{id}` | Update content item details | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `DELETE` | `Remove /v1/admin/content/{collection}/{id}` | Remove content item | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `GET` | `View /v1/admin/workshops/{id}/roster` | View workshop enrolled farmers | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |

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
