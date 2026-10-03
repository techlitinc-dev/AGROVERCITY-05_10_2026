# Superadmin Implementation Guide — Module 12: Kisan Mitra AI Chatbot & Human Expert Handoff

> **Document ID:** `SOP-12`  
> **Module Scope:** `Kisan Mitra AI Chatbot & Human Expert Handoff`  
> **Target Collections:** `chatbot_sessions`, `chatbot_messages`, `expert_tickets`, `experts`  
> **Superadmin UI Path:** `/admin/chatbot`  
> **Access Level:** Super Admin (`customClaims: {admin: true}`)

---

## 1. Administrative Overview & Scope

Multilingual AI conversational assistant (Gemini 2.5 Flash + Rule-Based Agronomy Engine) supporting text queries, market saturation alerts, weather guidance, and certified KVK human agronomist escalation handoff.

The Superadmin console must provide centralized oversight, auditability, dispute resolution, and emergency intervention capabilities for all user interactions, transactions, and state transitions within this module.

---

## 2. Managed Data Entities & Schema Reference

| Collection Name | Entity Description | Key Fields & Indexes | Retention & Privacy |
|---|---|---|---|
| `chatbot_sessions` | Primary document collection for Kisan Mitra AI Chatbot & Human Expert Handoff | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `chatbot_messages` | Primary document collection for Kisan Mitra AI Chatbot & Human Expert Handoff | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `expert_tickets` | Primary document collection for Kisan Mitra AI Chatbot & Human Expert Handoff | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `experts` | Primary document collection for Kisan Mitra AI Chatbot & Human Expert Handoff | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |

---

## 3. Superadmin Operational Capabilities

The superadmin interface for this module provides the following core operational functions:

- **Monitor**: Monitor real-time AI conversation transcripts for safety and accuracy
- **Manage**: Manage expert agronomist roster (availability, specialization, contact channels)
- **Triage**: Triage incoming expert handoff requests with SLA tracking
- **Configure**: Configure AI system prompts, knowledge base embeddings, and tone of voice
- **Track**: Track conversation satisfaction scores and common farmer queries

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
| AGROVERCITY SUPERADMIN  ::  KISAN MITRA AI CHATBOT & HUMAN EXPERT HANDOFF                          [ Admin User: root@agrovercity ] |
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
| `GET` | `Search /v1/admin/chatbot/transcripts` | Search & inspect chat transcripts | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `GET` | `Queue /v1/admin/chatbot/handoffs` | Queue of escalated expert handoff tickets | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `POST` | `Assign /v1/admin/chatbot/handoffs/{id}/assign` | Assign agronomist to support thread | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `PUT` | `Update /v1/admin/chatbot/prompt-config` | Update LLM system prompt and parameters | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |

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
