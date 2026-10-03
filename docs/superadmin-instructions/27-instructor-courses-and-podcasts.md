# Superadmin Implementation Guide — Module 27: Instructor Courses & Podcasts

> **Document ID:** `SOP-27`  
> **Module Scope:** `Instructor Courses & Podcasts (Instructor Persona)`  
> **Target Collections:** `courses`, `course_purchases`, `users/{uid}/role_profiles`  
> **Superadmin UI Path:** `/admin/courses`  
> **Access Level:** Super Admin (`customClaims: {admin: true}`) — moderation actions restricted to `superadmin`; read-only reports available to `compliance_officer`.

---

## 1. Administrative Overview & Scope

The platform's seventh persona — **Instructor / Teacher (प्रशिक्षक)** — lets agricultural experts create and sell digital content directly to farmers: structured **course materials** (PDF/DOC/PPT/ZIP), **audio podcasts**, and **video podcasts**. Every upload enters a `pendingReview` state and **must be approved by a superadmin before it becomes purchasable**. This module is the superadmin console for that moderation pipeline and the commercial oversight of course sales.

The Superadmin console must provide centralized oversight, auditability, content-compliance enforcement, and payout-grade sales accounting for all entities in this module.

---

## 2. Managed Data Entities & Schema Reference

| Collection Name | Entity Description | Key Fields & Indexes | Retention & Privacy |
|---|---|---|---|
| `courses` | A sellable content item created by an instructor | `id`, `instructorId`, `title`, `description`, `kind` (`courseMaterial` \| `audioPodcast` \| `videoPodcast`), `language`, `category`, `priceRupees`, `thumbnailUrl`, `mediaUrl`, `previewUrl`, `status` (`pendingReview` \| `published` \| `rejected`), `rejectedReason`, `isFeatured`, `salesCount`, `ratingSum`, `ratingCount`, `instructorEarningsRupees`, `commissionRupees`, `createdAt`, `updatedAt`, `publishedAt`, `reviewedBy` | Audit logged on every review action; media URLs are Firebase Storage download links — never expose unentitled `mediaUrl` (enforced server-side) |
| `course_purchases` | One document per user×course purchase (`id = {userId}_{courseId}`) | `id`, `userId`, `courseId`, `instructorId`, `amountRupees`, `commissionPercent`, `status` (`awaiting_payment` \| `paid`), `razorpayOrderId`, `razorpayPaymentId`, `createdAt`, `paidAt` | Idempotent by document id; signature-verified before `paid`; PII minimised (no card data stored) |
| `users/{uid}/role_profiles` | Instructor persona profile created at registration | `expertise` (list), `qualification` | Follows user-account retention policy |

**Instructor onboarding gate:** `instructor` is a valid `linkedProfiles` value (backend `VALID_PROFILES`). Registration requires at least one expertise area (`InstructorRoleProfile.expertise`).

---

## 3. Superadmin Operational Capabilities

The superadmin interface for this module provides the following core operational functions:

- **Review** new course/podcast submissions and **publish** them to the farmer storefront
- **Reject** submissions with a mandatory, farmer-visible reason (the instructor sees the reason in the app and can edit + resubmit)
- **Feature/Unfeature** published courses (featured items sort first in the storefront)
- **Inspect** attached media and thumbnails before approval (open the Firebase Storage links)
- **Monitor** module KPIs: total courses, per-status counts, total sales, free claims, GMV, platform commission, instructor earnings
- **Audit** every review decision (admin id, action, reason, timestamp) via `audit_logs`

---

## 4. UI/UX Layout & Screen Architecture

### 4.1 Screen Component Hierarchy
1. **Top Metric Bar:** `totalCourses`, `pendingReview` count, `totalSales`, `grossMerchandiseValueRupees`, `platformCommissionRupees`.
2. **Status Filter Chips:** `pendingReview` (default) | `published` | `rejected` | `all`.
3. **Review Queue List:** title, kind, category, language, instructor name, price, sales, earnings, status badge, rejection reason (if any).
4. **Row Actions:** media/thumbnail preview links; for `pendingReview`: **प्रकाशित करें (Publish)** and **अस्वीकृत (Reject — with reason dialog)**; for `published`: **फीचर्ड (Feature)** toggle.
5. **Confirmation Dialogs:** rejection mandates a non-empty reason; publish and feature actions confirm via snackbar feedback.

### 4.2 Implemented View
[`apps/admin/lib/views/courses_admin_view.dart`](file:///home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/courses_admin_view.dart), registered in the admin shell navigation as **कोर्स** (icon `school`), backed by [`AdminApi`](file:///home/tushka/Projects/AGROVERCITY/apps/admin/lib/api/admin_api.dart) course methods.

---

## 5. Superadmin API Specifications

All endpoints are mounted under `/v1/admin` and require the `_admin_user` dependency (superadmin claim or developer allowlist).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/courses/queue?status=pendingReview\|published\|rejected\|all` | Review queue, newest first |
| `POST` | `/admin/courses/{courseId}/review` | Body: `{action: "publish" \| "reject", reason?}` — `reason` **required** on reject; writes `audit_logs` entry |
| `POST` | `/admin/courses/{courseId}/feature` | Body: `{isFeatured: bool}` — published courses only |
| `GET` | `/admin/courses/report` | Aggregates: counts by status, total sales, free claims, GMV, commission, instructor earnings |

### Instructor & farmer endpoints (for reference; `/v1`, user-authenticated)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/courses` | Instructor-only create → `pendingReview` |
| `GET` | `/v1/courses/mine` | Instructor's own courses (all statuses) |
| `PUT` | `/v1/courses/{id}` | Owner edit (unpublished only) → re-enters review |
| `DELETE` | `/v1/courses/{id}` | Owner delete (unpublished only) |
| `GET` | `/v1/courses` | Farmer browse — published only, featured first, `isPurchased` annotated |
| `GET` | `/v1/courses/{id}` | Detail; `mediaUrl` hidden unless purchased/claimed/owner |
| `POST` | `/v1/courses/{id}/purchase` | Free → instant entitlement; paid → Razorpay order |
| `POST` | `/v1/courses/purchases/verify` | Signature-verified entitlement; updates sales & earnings |
| `GET` | `/v1/courses/purchased/list` | Buyer's library |

---

## 6. Operational Business Rules & Guardrails

1. **Nothing goes live unmoderated.** Every create/edit sets `status = pendingReview`; only the superadmin review endpoint can set `published`. Instructors cannot self-publish.
2. **Rejection requires a reason.** The reason is displayed verbatim to the instructor; abusive or empty rejections are an audit violation.
3. **Media is entitlement-gated.** The backend strips `mediaUrl` from any response unless the caller owns the course or holds a `paid` purchase. Never rely on client-side hiding alone.
4. **Purchases are idempotent and verified.** Purchase documents are keyed `{userId}_{courseId}`; paid status is reached only via Razorpay signature verification (`dev` signature accepted only when no Razorpay secret is configured). Instructors cannot buy their own courses; re-purchase of a paid course short-circuits to `purchased: true`.
5. **Commercial accounting.** Each paid purchase snapshots `commissionPercent` (currently `10.0`, recorded in `app/core` constant `DEFAULT_COMMISSION_PERCENT`) and accrues `commissionRupees` / `instructorEarningsRupees` on the course. The settlements module (SA-25) consumes these aggregates for instructor payouts.
6. **Featured placement is a superadmin decision** and applies to published courses only; featured items always sort ahead of regular items in the storefront.
7. **Destructive actions are auditable.** Publish/reject writes an `audit_logs` document (`action: REVIEW_COURSE`) with admin id, action, reason and timestamp.
8. **Instructor persona registration** is validated like other role profiles (`InstructorRoleProfile.expertise` non-empty); superadmins verify instructor identity through the standard KYC pipeline (SA-03) before approving high-value content.

---

## 7. Cross-Module References

- **SA-03 (KYC):** instructor identity verification
- **SA-20 (Content CMS):** platform-curated learning content complements instructor marketplace items
- **SA-25 (Settlements):** instructor payout clearance from `instructorEarningsRupees`
- **SA-26 (System Config):** commission-percent configuration surface
- **Module 02 (Personas):** `instructor` profile type across the ecosystem
