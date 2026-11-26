# Agrovercity Superadmin — Implementation Modules & Navigation Structure

> **Purpose**: Module list and navigation blueprint for the Superadmin web application.
> **Role model**: The superadmin works as a **Data Analyst** — every page is built for viewing, filtering, sorting, comparing, and exporting data. No page changes user-side business flows.
> **Source of truth**: Finalized persona & feature structure as implemented in the production web app (`website/src/lib/navItems.ts` — 14 personas, persona-specific menus + 16 common Ecosystem features).
> **Note**: `superadmin finalized features.xlsx` could not be used — the file on disk contains browser network data (not a spreadsheet). This document therefore mirrors the finalized structure live in the application. If a corrected Excel is shared, this document will be reconciled against it.

---

## 1. Design Principles (Data-Analyst Superadmin)

1. **Read-first**: every module page = KPI cards → filterable/sortable data table → record detail drawer → CSV/JSON export.
2. **Sorted & structured**: personas and features are listed alphabetically everywhere (navbar, dropdowns, module list) so any screen is findable in seconds.
3. **Two-partition rule**: inside every persona, features are always grouped into exactly two partitions — **Persona-Specific Features** and **Common Features** — mirroring what the user sees in the app.
4. **User-friendly access**: max 2 clicks from login to any data table (Navbar → Persona → Feature).
5. **Traceability**: every admin action (approve/reject/suspend/export) writes to the Audit Log with a mandatory reason.

---

## 2. Navigation Bar Design

### 2.1 Top Navigation Bar (left → right)

| Slot | Item | Behaviour |
|------|------|-----------|
| 1 | **Agrovercity Superadmin** (logo) | Click → Dashboard |
| 2 | **Dashboard** | Global KPI wall (Module 2) |
| 3 | **Personas ▾** | Dropdown listing all 14 personas A–Z (see 2.2) |
| 4 | **Common Features ▾** | Dropdown of the 16 shared features (Module 5) |
| 5 | **Users & KYC** | User directory + KYC queue (Module 3) |
| 6 | **Reports & Exports** | Analyst report builder (Module 6) |
| 7 | **Audit Log** | Immutable action trail (Module 7) |
| 8 | **Admin Profile ▾** | Profile, MPIN change, logout |

### 2.2 Personas Dropdown (sorted A–Z)

```
Personas ▾
 ├── Agri Exporter
 ├── Agri Market Seller
 ├── Agri Vyapari
 ├── Cold Storage Owner
 ├── Direct Buyer (Industrial)
 ├── Equipment Owner
 ├── Farm Landlord
 ├── Farmer
 ├── Gaushala & Sanctuary
 ├── Gurukul Instructor
 ├── Milk Vendor (Doodhwala)
 ├── Nursery
 ├── Transporter
 └── Women Hub
```

### 2.3 Persona Landing Behaviour

Clicking a persona opens its **Persona Overview page** (KPIs + recent activity). The persona name in the navbar becomes a dropdown with **two partitions**:

```
<Persona Name> ▾
 ├── ── PERSONA-SPECIFIC FEATURES ──
 │     (that persona's own menu items, A–Z)
 └── ── COMMON FEATURES ──
       AI Analysis · AI Crop Scanner · Agri Market · Courses ·
       Agriculture News & Audio · Government Schemes · Climate ·
       My Land Records (7/12) · My Diary · Tree Plantation ·
       Ads & Promotions · Profit & Loss · Coins & Rewards ·
       Ratings & Reviews · Saved & Following · Invite & Earn
```

Each dropdown entry opens the data-analyst view of that feature, pre-filtered to the selected persona.

---

## 3. Module Index (sorted)

| # | Module | Pages | Section |
|---|--------|-------|---------|
| 1 | Admin Auth & Profile | 2 | §4.1 |
| 2 | Dashboard (Global KPIs) | 1 | §4.2 |
| 3 | Users & KYC | 3 | §4.3 |
| 4 | Persona Modules (14 personas) | 14 overviews + feature views | §4.4 |
| 5 | Common Features (16 hubs) | 16 | §4.5 |
| 6 | Reports & Exports | 1 | §4.6 |
| 7 | Audit Log | 1 | §4.7 |

---

## 4. Module Details

### 4.1 Module 1 — Admin Auth & Profile
| Page | Content (analyst view) |
|------|------------------------|
| Admin Login | Operator login (mobile + MPIN/password) |
| Admin Profile | Own profile, MPIN change, session list, logout |

### 4.2 Module 2 — Dashboard (Global KPIs)
Single page: users per persona (bar), registrations trend (line), pending KYC count, pending approvals per persona feature (courses, shops, equipment, listings, ads), today's orders/bookings/trips, coins in circulation, export-any-widget button.

### 4.3 Module 3 — Users & KYC
| Page | Content |
|------|---------|
| Users Directory | All registered users — name, mobile, persona(s), KYC status, joined date; search + persona/status/date filters; export |
| User 360° Detail | One user's complete cross-persona footprint: profile, KYC docs, activity in every feature they use, coins, referrals, ratings; suspend/reactivate; MPIN reset |
| KYC Queue | All submitted KYC documents: view → approve / reject with remark |

### 4.4 Module 4 — Persona Modules (14)

Each persona module = **1 Persona Overview page** (KPIs, trends, recent records) **+ one data view per persona-specific feature** (listed A–Z below) **+ inherited Common Features views (§4.5) filtered to that persona**.

#### 4.4.1 Agri Exporter
- Persona-specific: Applications Received · My Connections · My Export Requirements · Post Export Requirement
#### 4.4.2 Agri Market Seller
- Persona-specific: Enquiry Management · My Products · Offers & Discounts · Orders Received · Quotation Management · Shop Profile · Stock Management
#### 4.4.3 Agri Vyapari
- Persona-specific: Find Produce · Mandi Prices · My Connections · Post Requirement
#### 4.4.4 Cold Storage Owner
- Persona-specific: Chambers & Temperature · Inward & Release Bookings · Rent Ledger & e-NWR Fees
#### 4.4.5 Direct Buyer (Industrial)
- Persona-specific: Applications Received · My Requirements · My Suppliers · Post Requirement
#### 4.4.6 Equipment Owner
- Persona-specific: Booking Request · Equipment Schedule · My Equipment · Progress Status
#### 4.4.7 Farm Landlord
- Persona-specific: My Connections · Post Land Request · Requirement Requests
#### 4.4.8 Farmer
- Persona-specific: AI Crop Plan · AI Doctor · Book Vehicle · Mandi Prices · My Connections · My Crops · My Produce · Rent Land · Rent Machinery · Vyapari Requirements
#### 4.4.9 Gaushala & Sanctuary
- Persona-specific: 80G Donations & Adoptions · Cattle Herd Registry · Fodder & Expenses · Receipts Register · Vet Network Camps
#### 4.4.10 Gurukul Instructor
- Persona-specific: Academic Studio · Batches & Questions · Course Builder
#### 4.4.11 Milk Vendor (Doodhwala)
- Persona-specific: Bills & Payments · Clients · Customer Passbook · Delivery Analytics · Milk and Rates · Monthly Billing and Pay · Punch Sheet · Todays Schedule
#### 4.4.12 Nursery
- Persona-specific: Ad Manager · Batches & Stock In/Out · Chatbot Support · Earnings & Payouts · Finance CEO (P&L) · My Plants / Inventory · Nursery Care Diary · Offers & Discounts · Orders Received · Reviews & Ratings
#### 4.4.13 Transporter
- Persona-specific: Bilty · Booking Requests · Load Board · Live Trips · My Connections · Trip P&L · Vehicles and Drivers
- *Common-feature exceptions (hidden in the app for this persona): My Diary, Ads & Promotions, Ratings & Reviews*
#### 4.4.14 Women Hub
- Persona-specific: Home Enterprise Income · Kitchen Garden Planner · My Business & Management (incl. customer profit/loss, remaining-payment and cash-payment ledgers)

### 4.5 Module 5 — Common Features (16 shared hubs, sorted)

Each page shows the feature's data **across all personas**, with a persona filter (this is the same view the per-persona dropdown opens, pre-filtered).

| # | Page | Data shown (what users generate in the app) |
|---|------|----------------------------------------------|
| 1 | Ads & Promotions | Ad campaigns created by users, status, performance |
| 2 | Agri Market | Marketplace products & orders across all buyers/sellers |
| 3 | Agriculture News & Audio | Published news/audio items, engagement |
| 4 | AI Analysis | AI analysis runs, inputs, results |
| 5 | AI Crop Scanner | Crop scans, detected issues, accuracy flags |
| 6 | Climate | Climate/weather data viewed per region |
| 7 | Coins & Rewards | Coin balances, credit/debit ledger, adjustments |
| 8 | Courses | All courses, enrollments, completion |
| 9 | Government Schemes | Schemes listed, user applications/assists |
| 10 | Invite & Earn | Referral chains, rewards paid, fraud flags |
| 11 | My Diary | Diary entries per user (read-only oversight) |
| 12 | My Land Records (7/12) | Uploaded 7/12 documents, verification status |
| 13 | Profit & Loss | Per-user P&L entries and summaries |
| 14 | Ratings & Reviews | All reviews across personas, moderation flags |
| 15 | Saved & Following | Saved items/follows per user (read-only) |
| 16 | Tree Plantation | Planted-tree records, photos, survival verification |

### 4.6 Module 6 — Reports & Exports
Report builder: pick module/persona/feature → date range → filters → preview table → export CSV/JSON. Pre-built reports: registrations by persona, KYC turnaround, orders summary, booking summary, coins liability, referral payouts.

### 4.7 Module 7 — Audit Log
Every admin action: timestamp, operator, module, target record, action, mandatory reason; filter + export.

---

## 5. Page Count Summary

| Group | Pages |
|-------|-------|
| Auth & Profile | 2 |
| Dashboard | 1 |
| Users & KYC | 3 |
| Persona overviews | 14 |
| Persona-specific feature views | 75 |
| Common feature views | 16 |
| Reports & Exports | 1 |
| Audit Log | 1 |
| **Total** | **113** |

*(Feature views are one reusable table+detail template instantiated per feature — the build effort is far smaller than the page count suggests.)*

---

## 6. Suggested Build Order

1. **Phase 1**: Admin Auth, Dashboard, Users & KYC, Audit Log, reusable data-table template.
2. **Phase 2**: Common Features module (16 pages on the shared template) — instantly gives cross-persona analytics.
3. **Phase 3**: Persona modules in order of live data volume: Farmer, Agri Market Seller, Transporter, Equipment Owner, Agri Vyapari, then the rest A–Z.
4. **Phase 4**: Reports & Exports builder.
