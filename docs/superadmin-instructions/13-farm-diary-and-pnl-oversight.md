# Superadmin Implementation Guide — Module 13: Farm Diary, P&L Analytics & Break-Even

> **Document ID:** `SOP-13`  
> **Module Scope:** `Farm Diary, P&L Analytics & Break-Even`  
> **Target Collections:** `farm_diary_entries`, `crop_pnl`  
> **Superadmin UI Path:** `/admin/diary`  
> **Access Level:** Super Admin (`customClaims: {admin: true}`)

---

## 1. Administrative Overview & Scope

Digital bookkeeping for farmers: expense/income tracking, AgriCoins rewards for daily accounting, PDF financial report generation, crop-wise profit/loss statement, and pre-sowing break-even price calculator.

The Superadmin console must provide centralized oversight, auditability, dispute resolution, and emergency intervention capabilities for all user interactions, transactions, and state transitions within this module.

---

## 2. Managed Data Entities & Schema Reference

| Collection Name | Entity Description | Key Fields & Indexes | Retention & Privacy |
|---|---|---|---|
| `farm_diary_entries` | Primary document collection for Farm Diary, P&L Analytics & Break-Even | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |
| `crop_pnl` | Primary document collection for Farm Diary, P&L Analytics & Break-Even | `id`, `createdAt`, `updatedAt`, `status`, `userId` | Audit logged, soft-delete enabled |

---

## 3. Superadmin Operational Capabilities

The superadmin interface for this module provides the following core operational functions:

- **View**: View aggregated farm expenditure trends by region and commodity
- **Audit**: Audit diary entry volume and AgriCoins reward disbursement integrity
- **Review**: Review generated PDF statements for tax and loan eligibility audits
- **Calibrate**: Calibrate pre-sowing break-even benchmarks based on current input costs
- **Detect**: Detect fraudulent duplicate expense submissions

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
| AGROVERCITY SUPERADMIN  ::  FARM DIARY, P&L ANALYTICS & BREAK-EVEN                          [ Admin User: root@agrovercity ] |
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
| `GET` | `Regional /v1/admin/diary/summary` | Regional farm expenditure statistics | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `GET` | `State-level /v1/admin/pnl/benchmarks` | State-level crop production cost benchmarks | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |
| `PUT` | `Update /v1/admin/pnl/benchmarks/{crop}` | Update standard input cost baselines | JSON payload | Enveloped object | `401`, `403`, `404`, `422` |

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
## Status update (2026-09-26)

The farmer-facing diary endpoints that were pending at the time of this guide are **now live** in `backend/app/routers/diary.py` (all farmer/farmLandlord only, under `/v1`):

- `GET /v1/diary/analytics/summary?from=&to=` — analytics dashboard (totals, byCategory, byCrop, byMonth, byDay), Redis-cached 5 min under `diary:analytics:{uid}:{from}:{to}`.
- `POST /v1/diary/entries/{id}/photos` — photo attachments (1–3 jpeg/png/webp ≤ 5 MB, multipart `files`).
- `PUT /v1/diary/entries/{id}` — entry edit (200 `{entry}`; 404 `ENTRY_NOT_FOUND`).
- `GET /v1/diary/entries` now returns a real paged envelope (`data, page, pageSize, total`; `pageSize` ≤ 200, default 50).

Coverage: 16/16 diary tests in `backend/tests/test_diary.py` (see `docs/test-reports/13-farm-diary-and-pnl.md`). The superadmin endpoints in §5 remain planned.

---
*Instructions prepared for AGROVERCITY Superadmin Panel construction.*
