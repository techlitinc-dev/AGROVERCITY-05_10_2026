# AGROVERCITY / Kisan Setu — Superadmin Panel Instructions

> **Document ID:** `AGRO-SA-MASTER-01`  
> **Repository:** [`AGROVERCITY`](file:////home/tushka/Projects/AGROVERCITY)  
> **Target Application:** [`apps/admin/`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/) (Flutter Web Admin Console)  
> **Backend Integration:** [`backend/app/routers/`](file:////home/tushka/Projects/AGROVERCITY/backend/app/routers/)  
> **Generated:** 2026-09-19  
> **Scope:** Complete Operational Blueprint for All **27 Application Modules**  
> **Module-wise Instructions:** [`docs/superadmin-instructions/`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/)  

---

## 1. Executive Overview & Mission

The **AGROVERCITY Superadmin Console** is the central governance, operations, compliance, and financial clearance platform for the Kisan Setu ecosystem. While the mobile application serves seven distinct rural personas (**Farmers, Landlords, Transporters, Vyaparis/Sellers, Equipment Owners, Brokers, and Instructors/Teachers**), the Superadmin Panel equips platform operators, agronomists, compliance officers, and financial administrators with the tools necessary to oversee, audit, and regulate all transactions, users, and content.

### Current Implementation State (`apps/admin`)
The prototype admin console currently contains 13 core views and dialogs in [`apps/admin/lib/views/`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/):
1. [`admin_shell.dart`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/admin_shell.dart): Master responsive dashboard shell with navigation drawer and top bar.
2. [`dashboard_view.dart`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/dashboard_view.dart): Platform KPI overview (Active Users, GMV, Pending KYC, Open Claims).
3. [`users_view.dart`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/users_view.dart): User lookup, profile inspection, and block/unblock controls.
4. [`kyc_queue_view.dart`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/kyc_queue_view.dart): Document verification queue for farmer 7/12 records and vyapari trade licenses.
5. [`claims_view.dart`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/claims_view.dart) & [`claim_detail_dialog.dart`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/claim_detail_dialog.dart): Crop insurance claim adjudication.
6. [`rate_approvals_view.dart`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/rate_approvals_view.dart): Vyapari buying rate moderation against MSP benchmarks.
7. [`settlements_view.dart`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/settlements_view.dart): Weekly commission settlements and payout batch clearance.
8. [`content_cms_view.dart`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/content_cms_view.dart) & [`content_form_dialog.dart`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/content_form_dialog.dart): Advisory articles, alerts, and news curation.
9. [`broadcast_view.dart`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/broadcast_view.dart): Emergency push broadcasts (weather alerts, pest outbreaks).
10. [`reports_view.dart`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/reports_view.dart): User moderation and grievance resolution.
11. [`login_view.dart`](file:////home/tushka/Projects/AGROVERCITY/apps/admin/lib/views/login_view.dart): Admin login with MFA / MPIN.

This document establishes the **exhaustive, production-ready specification** to expand the console to manage **all 27 modules present in the application**, ensuring no feature, workflow, or entity is left unmanaged.

---

## 2. Global Architecture, Security & UX Design Standards

### 2.1 Administrative Role-Based Access Control (RBAC)
To prevent unauthorized access and operational errors, the superadmin panel implements granular role tiers:
- **`superadmin`:** Unrestricted access across all 27 modules, platform configuration, system secrets, and administrative overrides.
- **`compliance_officer`:** User KYC approval, legal document verification, fraud investigation, account lockouts, and dispute resolution.
- **`finance_admin`:** Bank account verification, weekly commission settlement clearance, payout dispatch, refunds, and loan underwriting oversight.
- **`agronomist` / `scientist`:** AI crop disease model review, soil health test validation, pest radar alert dispatch, and advisory publishing.
- **`operations_lead`:** Transporter fleet management, equipment slot dispute arbitration, cold storage allocation, and mandi rate moderation.
- **`content_moderator`:** Gyan hub articles, live channel streams, workshop curation, community chat moderation, and user reports.

### 2.2 Standard UI Component System
All views must follow the design patterns established in `apps/admin/lib/`:
1. **Metric KPI Banners:** Top-of-page summary cards showing real-time counters (e.g., Pending Approvals, Total Volume, Dispute Rate).
2. **Universal Filterable Data Grid:**
   - Search query input (by ID, phone number, name, district, or date range).
   - Status chips (`all`, `pending`, `approved`, `flagged`, `rejected`).
   - Server-side pagination (`page`, `pageSize`).
   - Sorting by date, value, or priority.
   - Bulk selection checkboxes for batch approvals.
3. **Detail Drawer / Modal:** Slide-out inspection drawer preserving table state, displaying entity JSON, audit history, and associated documents.
4. **Two-Step Safeguards:** Destructive actions (user bans, payment releases, policy cancellations) require explicit confirmation modals with a mandatory reason field and admin MPIN.

### 2.3 Comprehensive Audit Logging & Security
- **Immutable Audit Trail:** Every administrative state mutation is logged to the `audit_logs` collection:
  ```json
  {
    "id": "aud-99214",
    "adminId": "admin-01",
    "adminEmail": "ops@agrovercity.in",
    "module": "04-mandi-and-rates",
    "action": "APPROVE_RATE",
    "targetId": "rate-cotton-01",
    "previousState": { "status": "pending" },
    "newState": { "status": "approved" },
    "reason": "Verified with APMC Akola official bulletin",
    "timestamp": "2026-09-19T10:30:00Z",
    "ipAddress": "103.21.244.2"
  }
  ```
- **Session Timeout:** Admin sessions auto-expire after 15 minutes of inactivity. JWT tokens are bound to admin IP and revoked upon logout.

---

## 3. Master Module Superadmin Directory

Below is the directory of all **27 modules**, detailing admin roles, primary collections, core capabilities, and links to the dedicated module superadmin instructions in [`docs/superadmin-instructions/`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/).

| Module # | Module ID & Name | Primary Admin Roles | Managed Collections | Core Admin Capabilities | Detailed Instructions |
|---|---|---|---|---|---|
| **01** | **Authentication, RBAC, Sessions & Security** | `superadmin, compliance_officer` | `users`<br>`auth_tokens`<br>`devices`<br>*(+1 more)* | Search users by mobile, ID, or Firebase UID | [`SA-01: Authentication, RBAC, Sessions & Security`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/01-auth-rbac-and-sessions.md) |
| **02** | **User Profiles & Multi-Persona Management** | `superadmin, operations_lead` | `users`<br>`users/{uid}/role_profiles`<br>`users/{uid}/bookings` | Browse full user directory with persona filtering (Farmer, Landlord, Transporter, Seller, Equipment, Broker, Instructor) | [`SA-02: User Profiles & Multi-Persona Management`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/02-user-management-and-personas.md) |
| **03** | **KYC Verification & Document Vault** | `superadmin, operations_lead` | `users/{uid}/vault_documents`<br>`kyc_verifications` | Real-time KYC verification queue for all pending documents | [`SA-03: KYC Verification & Document Vault`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/03-kyc-verification-and-vault.md) |
| **04** | **Mandi Prices, Vyapari Live Rates & Approvals** | `superadmin, finance_admin, operations_lead` | `mandi_prices`<br>`vyapari_rates`<br>`mandi_history` | Monitor daily trader rate submissions in rate approvals queue | [`SA-04: Mandi Prices, Vyapari Live Rates & Approvals`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/04-mandi-rates-and-approvals.md) |
| **05** | **Produce Lots & B2B Trading** | `superadmin, finance_admin, operations_lead` | `market_lots`<br>`deals`<br>`procurements`<br>*(+1 more)* | Audit all active produce lots across districts and commodities | [`SA-05: Produce Lots & B2B Trading`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/05-produce-lots-and-b2b-deals.md) |
| **06** | **Input Marketplace, Cart, Orders & Payments** | `superadmin, finance_admin, operations_lead` | `products`<br>`orders`<br>`users/{uid}/cart`<br>*(+3 more)* | Manage product catalog (create, edit, discontinue agricultural inputs) | [`SA-06: Input Marketplace, Cart, Orders & Payments`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/06-marketplace-catalog-orders.md) |
| **07** | **Buyer Contracts & Price Locks** | `superadmin, finance_admin, operations_lead` | `buyer_contracts`<br>`contract_acceptances` | Onboard and verify institutional corporate buyers (ITC, Reliance Retail, Adani Agri) | [`SA-07: Buyer Contracts & Price Locks`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/07-buyer-contracts-and-escrow.md) |
| **08** | **Transport Logistics & Fleet Operations** | `operations_lead, superadmin` | `vehicles`<br>`transport_bookings`<br>`transporter_settlements` | Verify transporter fleet registration (RC book, commercial insurance, fitness certificate) | [`SA-08: Transport Logistics & Fleet Operations`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/08-transport-fleet-and-dispatch.md) |
| **09** | **Equipment Rental & Yantra Time-Slots** | `operations_lead, superadmin` | `equipment`<br>`equipment_slots`<br>`equipment_bookings` | Inspect machinery inventory (tractors, harvesters, rotavators, laser levelers) | [`SA-09: Equipment Rental & Yantra Time-Slots`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/09-equipment-and-slot-management.md) |
| **10** | **Landlord Land Management & Leasing** | `superadmin, operations_lead` | `land_plots`<br>`land_leases`<br>`land_lease_payments`<br>*(+2 more)* | Audit land listings against 7/12 land records to prevent fraudulent leasing | [`SA-10: Landlord Land Management & Leasing`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/10-land-leasing-and-disputes.md) |
| **11** | **AI Advisory, Disease Scan & Pest Radar** | `agronomist, scientist, superadmin` | `advisory_scans`<br>`pest_alerts`<br>`soil_tests`<br>*(+1 more)* | Monitor AI disease diagnosis accuracy and false positive feedback | [`SA-11: AI Advisory, Disease Scan & Pest Radar`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/11-ai-advisory-models-and-radar.md) |
| **12** | **Kisan Mitra AI Chatbot & Human Expert Handoff** | `agronomist, scientist, superadmin` | `chatbot_sessions`<br>`chatbot_messages`<br>`expert_tickets`<br>*(+1 more)* | Monitor real-time AI conversation transcripts for safety and accuracy | [`SA-12: Kisan Mitra AI Chatbot & Human Expert Handoff`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/12-chatbot-transcripts-and-expert-handoff.md) |
| **13** | **Farm Diary, P&L Analytics & Break-Even** | `superadmin, operations_lead` | `farm_diary_entries`<br>`crop_pnl` | View aggregated farm expenditure trends by region and commodity | [`SA-13: Farm Diary, P&L Analytics & Break-Even`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/13-farm-diary-and-pnl-oversight.md) |
| **14** | **Banking, Credit Score & Microfinance** | `finance_admin, compliance_officer` | `bank_accounts`<br>`loan_applications`<br>`kcc_records` | Audit bank account penny-drop verification failures and override valid accounts | [`SA-14: Banking, Credit Score & Microfinance`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/14-banking-credit-and-loan-underwriting.md) |
| **15** | **Crop Insurance (PMFBY) & Calamity Claims** | `finance_admin, compliance_officer` | `insurance_policies`<br>`insurance_claims`<br>`insurance_rates` | Central claim processing desk: review intimated crop damage claims | [`SA-15: Crop Insurance (PMFBY) & Calamity Claims`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/15-insurance-claims-and-dbt-disbursal.md) |
| **16** | **Land Records Registry (7/12 & 8A Utara)** | `agronomist, scientist, superadmin` | `land_records_712`<br>`users/{uid}/imported_records` | Monitor State revenue portal integration gateway availability and latency | [`SA-16: Land Records Registry (7/12 & 8A Utara)`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/16-land-records-registry-mahabhulekh.md) |
| **17** | **Water Intelligence & Irrigation Management** | `agronomist, scientist, superadmin` | `water_schedules`<br>`cgwb_stations`<br>`canal_schedules` | Update irrigation canal rotation dates and time slots by canal division | [`SA-17: Water Intelligence & Irrigation Management`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/17-water-resources-and-irrigation.md) |
| **18** | **FPO Engine & Bulk Procurement Pools** | `operations_lead, superadmin` | `fpos`<br>`fpo_pools`<br>`fpo_pool_members` | Verify FPO registration certificates (ROC, Nabard, SFAC recognition) | [`SA-18: FPO Engine & Bulk Procurement Pools`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/18-fpo-verification-and-pool-management.md) |
| **19** | **Livestock, Dairy & Veterinary Services** | `superadmin, operations_lead` | `gaushalas`<br>`nurseries`<br>`vets`<br>*(+3 more)* | Verify Veterinary Doctor qualifications (B.V.Sc degree, State Veterinary Council registration) | [`SA-19: Livestock, Dairy & Veterinary Services`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/19-livestock-vet-and-dairy-network.md) |
| **20** | **Knowledge Hub, Content CMS & Live Media** | `content_moderator, superadmin` | `agri_news`<br>`agri_channels`<br>`workshops`<br>*(+3 more)* | Publish, edit, and schedule agricultural news articles with breaking news tags | [`SA-20: Knowledge Hub, Content CMS & Live Media`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/20-content-cms-live-channels-workshops.md) |
| **21** | **Agroforestry, Tree Plantation & Biofuel** | `agronomist, scientist, superadmin` | `tree_articles`<br>`ngos`<br>`biofuel_trees`<br>*(+2 more)* | Verify afforestation NGOs and partner nurseries | [`SA-21: Agroforestry, Tree Plantation & Biofuel`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/21-agroforestry-and-sapling-requests.md) |
| **22** | **Gamification, Krishi Ratna & Referrals** | `content_moderator, superadmin` | `gamification_status`<br>`agri_coins_ledger`<br>`reward_coupons`<br>*(+2 more)* | Monitor platform-wide AgriCoins circulation and daily mint/burn totals | [`SA-22: Gamification, Krishi Ratna & Referrals`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/22-gamification-economy-and-referrals.md) |
| **23** | **Climate Resilience, Carbon Credits & Cold Storage** | `operations_lead, superadmin` | `cold_storages`<br>`cold_storage_bookings`<br>`climate_varieties` | Manage cold storage facility directory (capacity in MT, temperature ranges, monthly rates) | [`SA-23: Climate Resilience, Carbon Credits & Cold Storage`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/23-climate-resilience-and-cold-storage.md) |
| **24** | **Women in Agriculture & Self Help Groups** | `content_moderator, superadmin` | `women_shgs`<br>`shg_deposits`<br>`home_enterprises` | Verify SHG registration documents, bank accounts, and cluster federation linkage | [`SA-24: Women in Agriculture & Self Help Groups`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/24-women-empowerment-and-shg-programs.md) |
| **25** | **Financial Settlements & Automated Cron Jobs** | `superadmin, finance_admin, operations_lead` | `settlements`<br>`transporter_payouts`<br>`seller_payouts`<br>*(+1 more)* | Review pending transporter freight and seller produce payouts in the daily settlement batch | [`SA-25: Financial Settlements & Automated Cron Jobs`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/25-financial-settlements-and-automated-jobs.md) |
| **26** | **System Health, Remote Config, Broadcast & Moderation** | `superadmin, compliance_officer` | `app_config`<br>`broadcasts`<br>`user_reports`<br>*(+4 more)* | Configure minimum supported mobile app version and trigger force-update splash screen | [`SA-26: System Health, Remote Config, Broadcast & Moderation`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/26-system-config-broadcasts-and-moderation.md) |
| **27** | **Instructor Courses & Podcasts** | `superadmin, compliance_officer` | `courses`<br>`course_purchases`<br>`users/{uid}/role_profiles` | Moderate instructor course/podcast submissions: publish, reject with reason, feature, monitor GMV & commission | [`SA-27: Instructor Courses & Podcasts`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/27-instructor-courses-and-podcasts.md) |

---

## 4. Module-by-Module Superadmin Specifications (All 27 Modules)

Every module's operational blueprint is detailed below with UI layout requirements, managed entities, admin API contracts, and business rules.


### 4.1 Module 01: Authentication, RBAC, Sessions & Security
- **Document Reference:** [`docs/superadmin-instructions/01-auth-rbac-and-sessions.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/01-auth-rbac-and-sessions.md)
- **Module ID:** `01-auth-and-security` · **Tag:** `auth`
- **Managed Collections:** `users`, `auth_tokens`, `devices`, `sessions`

#### Administrative Capabilities & Workflows
- Search users by mobile, ID, or Firebase UID
- View user authentication logs, login timestamps, and IP addresses
- Manually trigger MPIN reset with temporary OTP
- Revoke active JWT refresh tokens across all devices
- Suspend or ban compromised accounts
- Toggle 2FA / MPIN enforcement flags

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Authentication, RBAC, Sessions & Security` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/auth/users` | List user auth credentials and login history | `superadmin`, `admin` |
| `POST` | `/v1/admin/auth/users/{uid}/reset-mpin` | Admin force MPIN reset | `superadmin`, `admin` |
| `POST` | `/v1/admin/auth/users/{uid}/revoke-sessions` | Revoke all refresh tokens and sessions | `superadmin`, `admin` |
| `PUT` | `/v1/admin/auth/users/{uid}/status` | Update account status (active/suspended/locked) | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.2 Module 02: User Profiles & Multi-Persona Management
- **Document Reference:** [`docs/superadmin-instructions/02-user-management-and-personas.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/02-user-management-and-personas.md)
- **Module ID:** `02-users-and-personas` · **Tag:** `users`
- **Managed Collections:** `users`, `users/{uid}/role_profiles`, `users/{uid}/bookings`

#### Administrative Capabilities & Workflows
- Browse full user directory with persona filtering (Farmer, Landlord, Transporter, Seller, Equipment, Broker)
- Inspect user details, linked personas, active profile, and primary profile
- View and edit farm polygon boundaries on satellite map viewer
- Link or unlink personas manually for verified users
- Update user language preferences, womenMode, and display settings
- Export user roster to CSV/Excel for state department audits

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `User Profiles & Multi-Persona Management` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/users` | Search & paginate all users with persona filters | `superadmin`, `admin` |
| `GET` | `/v1/admin/users/{uid}` | Get full profile details and linked personas | `superadmin`, `admin` |
| `PUT` | `/v1/admin/users/{uid}/status` | Set user account status | `superadmin`, `admin` |
| `PUT` | `/v1/admin/users/{uid}/personas` | Manage user linked personas | `superadmin`, `admin` |
| `GET` | `/v1/admin/users/{uid}/farm-map` | Get farm boundary polygon coordinates | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.3 Module 03: KYC Verification & Document Vault
- **Document Reference:** [`docs/superadmin-instructions/03-kyc-verification-and-vault.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/03-kyc-verification-and-vault.md)
- **Module ID:** `03-kyc-and-vault` · **Tag:** `vault`
- **Managed Collections:** `users/{uid}/vault_documents`, `kyc_verifications`

#### Administrative Capabilities & Workflows
- Real-time KYC verification queue for all pending documents
- Side-by-side document image preview with zoom and rotation
- Automated OCR data comparison against registered profile info
- Approve document with verified badge or reject with mandatory reason
- Audit log of admin verification decisions with timestamp and admin ID
- Redaction masking checks for Aadhaar number confidentiality

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `KYC Verification & Document Vault` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/kyc/pending` | List pending KYC verification items | `superadmin`, `admin` |
| `POST` | `/v1/admin/kyc/{entityId}/verify` | Approve KYC document and issue badge | `superadmin`, `admin` |
| `POST` | `/v1/admin/kyc/{entityId}/reject` | Reject KYC with specific reason | `superadmin`, `admin` |
| `GET` | `/v1/admin/kyc/history` | Audit trail of all KYC decisions | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.4 Module 04: Mandi Prices, Vyapari Live Rates & Approvals
- **Document Reference:** [`docs/superadmin-instructions/04-mandi-rates-and-approvals.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/04-mandi-rates-and-approvals.md)
- **Module ID:** `04-mandi-and-rates` · **Tag:** `mandi`
- **Managed Collections:** `mandi_prices`, `vyapari_rates`, `mandi_history`

#### Administrative Capabilities & Workflows
- Monitor daily trader rate submissions in rate approvals queue
- Validate posted rates against ±15% sanity band of Agmarknet modal price
- Approve rate updates for instant publication to mobile app
- Reject suspicious or predatory rates with feedback to trader
- Manual rate entry or override for mandis with broken government feeds
- Track Agmarknet API sync health and failure alerts

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Mandi Prices, Vyapari Live Rates & Approvals` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/rates/pending` | List pending vyapari rate submissions | `superadmin`, `admin` |
| `POST` | `/v1/admin/rates/{id}/approve` | Approve rate update for immediate live feed | `superadmin`, `admin` |
| `POST` | `/v1/admin/rates/{id}/reject` | Reject rate update with explanation | `superadmin`, `admin` |
| `POST` | `/v1/admin/mandi/sync` | Trigger manual Agmarknet sync job | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.5 Module 05: Produce Lots & B2B Trading
- **Document Reference:** [`docs/superadmin-instructions/05-produce-lots-and-b2b-deals.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/05-produce-lots-and-b2b-deals.md)
- **Module ID:** `05-produce-lots-and-b2b` · **Tag:** `lots`
- **Managed Collections:** `market_lots`, `deals`, `procurements`, `buyer_ledgers`

#### Administrative Capabilities & Workflows
- Audit all active produce lots across districts and commodities
- Review disputed lots and mediate broker-farmer negotiations
- Verify weighbridge slips and quality certification attachments
- Flag or take down fraudulent produce listings
- Inspect trader procurement ledgers and outstanding farmer payments

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Produce Lots & B2B Trading` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/lots` | Search and inspect all produce lots | `superadmin`, `admin` |
| `PUT` | `/v1/admin/lots/{id}/status` | Force update lot status (active/suspended/sold) | `superadmin`, `admin` |
| `GET` | `/v1/admin/procurements` | Audit trader procurement records and slips | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.6 Module 06: Input Marketplace, Cart, Orders & Payments
- **Document Reference:** [`docs/superadmin-instructions/06-marketplace-catalog-orders.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/06-marketplace-catalog-orders.md)
- **Module ID:** `06-marketplace-and-orders` · **Tag:** `marketplace`
- **Managed Collections:** `products`, `orders`, `users/{uid}/cart`, `users/{uid}/addresses`, `products/{id}/reviews`, `payments`

#### Administrative Capabilities & Workflows
- Manage product catalog (create, edit, discontinue agricultural inputs)
- Upload and verify Agmark/Ministry QR authenticity certificates
- Monitor order lifecycle (placed -> confirmed -> dispatched -> delivered -> cancelled)
- Process manual Razorpay refunds for eligible cancellations
- Moderate product customer reviews and star ratings
- Manage dealer commissions and distributor inventory levels

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Input Marketplace, Cart, Orders & Payments` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/marketplace/products` | List products with filter and stock status | `superadmin`, `admin` |
| `POST` | `/v1/admin/marketplace/products` | Add new product SKU to catalog | `superadmin`, `admin` |
| `PUT` | `/v1/admin/marketplace/products/{id}` | Update product pricing and inventory | `superadmin`, `admin` |
| `GET` | `/v1/admin/marketplace/orders` | List orders with delivery and payment status | `superadmin`, `admin` |
| `POST` | `/v1/admin/marketplace/orders/{id}/refund` | Trigger Razorpay refund for cancelled order | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.7 Module 07: Buyer Contracts & Price Locks
- **Document Reference:** [`docs/superadmin-instructions/07-buyer-contracts-and-escrow.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/07-buyer-contracts-and-escrow.md)
- **Module ID:** `07-buyer-contracts` · **Tag:** `contracts`
- **Managed Collections:** `buyer_contracts`, `contract_acceptances`

#### Administrative Capabilities & Workflows
- Onboard and verify institutional corporate buyers (ITC, Reliance Retail, Adani Agri)
- Review and approve buyer contract drafts before publishing to farmers
- Track farmer acceptance rates and delivery commitments
- Arbitrate contract fulfillment disputes (quality rejection, delivery delays)
- Monitor corporate buyer escrow accounts and payment releases

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Buyer Contracts & Price Locks` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/contracts` | List buyer contracts across all stages | `superadmin`, `admin` |
| `POST` | `/v1/admin/contracts` | Publish approved institutional contract | `superadmin`, `admin` |
| `PUT` | `/v1/admin/contracts/{id}/status` | Update contract state or cancel breach | `superadmin`, `admin` |
| `GET` | `/v1/admin/contracts/{id}/acceptances` | List signed farmer agreements | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.8 Module 08: Transport Logistics & Fleet Operations
- **Document Reference:** [`docs/superadmin-instructions/08-transport-fleet-and-dispatch.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/08-transport-fleet-and-dispatch.md)
- **Module ID:** `08-transport-and-logistics` · **Tag:** `transport`
- **Managed Collections:** `vehicles`, `transport_bookings`, `transporter_settlements`

#### Administrative Capabilities & Workflows
- Verify transporter fleet registration (RC book, commercial insurance, fitness certificate)
- Live dispatch map showing all active booked vehicles and routes
- Arbitrate booking disputes, no-shows, and breakdown incidents
- Manage base fares and per-km pricing bands by district and vehicle class
- Audit proof-of-delivery (POD) documentation before releasing payout

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Transport Logistics & Fleet Operations` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/transport/vehicles` | List registered fleet with KYC doc status | `superadmin`, `admin` |
| `POST` | `/v1/admin/transport/vehicles/{id}/verify` | Approve vehicle commercial papers | `superadmin`, `admin` |
| `GET` | `/v1/admin/transport/bookings` | List active and historical bookings | `superadmin`, `admin` |
| `PUT` | `/v1/admin/transport/bookings/{id}/status` | Manual intervention in trip status | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.9 Module 09: Equipment Rental & Yantra Time-Slots
- **Document Reference:** [`docs/superadmin-instructions/09-equipment-and-slot-management.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/09-equipment-and-slot-management.md)
- **Module ID:** `09-equipment-rental` · **Tag:** `equipment`
- **Managed Collections:** `equipment`, `equipment_slots`, `equipment_bookings`

#### Administrative Capabilities & Workflows
- Inspect machinery inventory (tractors, harvesters, rotavators, laser levelers)
- Verify commercial machinery papers and operator licensing
- Resolve booking cancellations and slot double-booking anomalies
- Monitor FPO vs private equipment utilization rates and pricing fairness
- Handle machinery damage reports and security deposit forfeitures

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Equipment Rental & Yantra Time-Slots` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/equipment` | List machinery inventory with owner details | `superadmin`, `admin` |
| `PUT` | `/v1/admin/equipment/{id}/verify` | Approve machine for public booking | `superadmin`, `admin` |
| `GET` | `/v1/admin/equipment/bookings` | List slot bookings and waitlists | `superadmin`, `admin` |
| `DELETE` | `/v1/admin/equipment/bookings/{id}` | Admin force cancellation with refund | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.10 Module 10: Landlord Land Management & Leasing
- **Document Reference:** [`docs/superadmin-instructions/10-land-leasing-and-disputes.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/10-land-leasing-and-disputes.md)
- **Module ID:** `10-land-and-leasing` · **Tag:** `land`
- **Managed Collections:** `land_plots`, `land_leases`, `land_lease_payments`, `land_listings`, `lease_requests`

#### Administrative Capabilities & Workflows
- Audit land listings against 7/12 land records to prevent fraudulent leasing
- Inspect standardized legal lease contracts generated by the platform
- Mediate landlord-tenant rent disputes and lease termination conflicts
- Monitor automated rent reminder cron job logs and delivery receipts
- Generate land tenancy statistics by district and crop suitability

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Landlord Land Management & Leasing` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/land/listings` | List land listings for lease with audit flag | `superadmin`, `admin` |
| `GET` | `/v1/admin/land/leases` | List active leases and payment compliance | `superadmin`, `admin` |
| `GET` | `/v1/admin/land/leases/{id}/agreement` | Inspect generated lease agreement PDF | `superadmin`, `admin` |
| `PUT` | `/v1/admin/land/leases/{id}/terminate` | Arbitrated lease contract termination | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.11 Module 11: AI Advisory, Disease Scan & Pest Radar
- **Document Reference:** [`docs/superadmin-instructions/11-ai-advisory-models-and-radar.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/11-ai-advisory-models-and-radar.md)
- **Module ID:** `11-ai-advisory-and-radar` · **Tag:** `advisory`
- **Managed Collections:** `advisory_scans`, `pest_alerts`, `soil_tests`, `crop_cycles`

#### Administrative Capabilities & Workflows
- Monitor AI disease diagnosis accuracy and false positive feedback
- Publish district-wide pest and disease outbreak radar alerts with geofencing
- Upload laboratory soil test result PDFs and trigger farmer notifications
- Configure NPK recommendation algorithms based on ICAR guidelines
- Audit market saturation calculation parameters and crop substitution models

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `AI Advisory, Disease Scan & Pest Radar` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/advisory/scans` | Audit disease scans and confidence metrics | `superadmin`, `admin` |
| `POST` | `/v1/admin/advisory/pest-alerts` | Broadcast geofenced pest outbreak alert | `superadmin`, `admin` |
| `GET` | `/v1/admin/soil-tests` | List pending soil sample tests | `superadmin`, `admin` |
| `POST` | `/v1/admin/soil-tests/{id}/results` | Upload lab result PDF and notify farmer | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.12 Module 12: Kisan Mitra AI Chatbot & Human Expert Handoff
- **Document Reference:** [`docs/superadmin-instructions/12-chatbot-transcripts-and-expert-handoff.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/12-chatbot-transcripts-and-expert-handoff.md)
- **Module ID:** `12-chatbot-and-expert` · **Tag:** `chatbot`
- **Managed Collections:** `chatbot_sessions`, `chatbot_messages`, `expert_tickets`, `experts`

#### Administrative Capabilities & Workflows
- Monitor real-time AI conversation transcripts for safety and accuracy
- Manage expert agronomist roster (availability, specialization, contact channels)
- Triage incoming expert handoff requests with SLA tracking
- Configure AI system prompts, knowledge base embeddings, and tone of voice
- Track conversation satisfaction scores and common farmer queries

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Kisan Mitra AI Chatbot & Human Expert Handoff` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/chatbot/transcripts` | Search & inspect chat transcripts | `superadmin`, `admin` |
| `GET` | `/v1/admin/chatbot/handoffs` | Queue of escalated expert handoff tickets | `superadmin`, `admin` |
| `POST` | `/v1/admin/chatbot/handoffs/{id}/assign` | Assign agronomist to support thread | `superadmin`, `admin` |
| `PUT` | `/v1/admin/chatbot/prompt-config` | Update LLM system prompt and parameters | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.13 Module 13: Farm Diary, P&L Analytics & Break-Even
- **Document Reference:** [`docs/superadmin-instructions/13-farm-diary-and-pnl-oversight.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/13-farm-diary-and-pnl-oversight.md)
- **Module ID:** `13-farm-diary-and-pnl` · **Tag:** `diary`
- **Managed Collections:** `farm_diary_entries`, `crop_pnl`

#### Administrative Capabilities & Workflows
- View aggregated farm expenditure trends by region and commodity
- Audit diary entry volume and AgriCoins reward disbursement integrity
- Review generated PDF statements for tax and loan eligibility audits
- Calibrate pre-sowing break-even benchmarks based on current input costs
- Detect fraudulent duplicate expense submissions

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Farm Diary, P&L Analytics & Break-Even` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/diary/summary` | Regional farm expenditure statistics | `superadmin`, `admin` |
| `GET` | `/v1/admin/pnl/benchmarks` | State-level crop production cost benchmarks | `superadmin`, `admin` |
| `PUT` | `/v1/admin/pnl/benchmarks/{crop}` | Update standard input cost baselines | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.14 Module 14: Banking, Credit Score & Microfinance
- **Document Reference:** [`docs/superadmin-instructions/14-banking-credit-and-loan-underwriting.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/14-banking-credit-and-loan-underwriting.md)
- **Module ID:** `14-banking-and-finance` · **Tag:** `finance`
- **Managed Collections:** `bank_accounts`, `loan_applications`, `kcc_records`

#### Administrative Capabilities & Workflows
- Audit bank account penny-drop verification failures and override valid accounts
- Underwrite farmer input-loan applications and partner bank routing
- Monitor Kisan Credit Score algorithm factors and tier distributions
- Audit bank account masking (XXXX + last-4 digits) compliance
- Track loan repayment milestones and default risk indicators

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Banking, Credit Score & Microfinance` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/finance/accounts` | List registered bank accounts and status | `superadmin`, `admin` |
| `POST` | `/v1/admin/finance/accounts/{id}/override-verify` | Manual penny-drop approval | `superadmin`, `admin` |
| `GET` | `/v1/admin/finance/loans` | Loan application underwriting queue | `superadmin`, `admin` |
| `PUT` | `/v1/admin/finance/loans/{id}/status` | Update loan application approval status | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.15 Module 15: Crop Insurance (PMFBY) & Calamity Claims
- **Document Reference:** [`docs/superadmin-instructions/15-insurance-claims-and-dbt-disbursal.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/15-insurance-claims-and-dbt-disbursal.md)
- **Module ID:** `15-crop-insurance-and-claims` · **Tag:** `insurance`
- **Managed Collections:** `insurance_policies`, `insurance_claims`, `insurance_rates`

#### Administrative Capabilities & Workflows
- Central claim processing desk: review intimated crop damage claims
- Assign field surveyors from insurance partner panel (AIC, HDFC ERGO, SBI General)
- Review surveyor assessment reports and damage percentage findings
- Approve claim payout amounts and record DBT transaction reference numbers
- Manage seasonal crop premium rate tables and government subsidy subsidies

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Crop Insurance (PMFBY) & Calamity Claims` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/claims` | List claims by status (intimated, surveyed, approved) | `superadmin`, `admin` |
| `PUT` | `/v1/admin/claims/{userId}/{claimId}` | Advance claim state, set payout & DBT txn ID | `superadmin`, `admin` |
| `POST` | `/v1/admin/claims/{id}/assign-surveyor` | Assign field surveyor to claim | `superadmin`, `admin` |
| `PUT` | `/v1/admin/insurance/rates` | Update actuarial and farmer premium rates | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.16 Module 16: Land Records Registry (7/12 & 8A Utara)
- **Document Reference:** [`docs/superadmin-instructions/16-land-records-registry-mahabhulekh.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/16-land-records-registry-mahabhulekh.md)
- **Module ID:** `16-land-records-712` · **Tag:** `land-records`
- **Managed Collections:** `land_records_712`, `users/{uid}/imported_records`

#### Administrative Capabilities & Workflows
- Monitor State revenue portal integration gateway availability and latency
- Audit land record search queries and cache hit/miss performance
- Resolve land record parsing errors for unusual script or survey notations
- Manually provision verified land records during state portal downtime
- Export land ownership verification logs for government reporting

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Land Records Registry (7/12 & 8A Utara)` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/land-records/status` | Revenue portal gateway health and latency | `superadmin`, `admin` |
| `POST` | `/v1/admin/land-records/seed` | Seed verified village 7/12 records to cache | `superadmin`, `admin` |
| `GET` | `/v1/admin/land-records/audit-log` | Audit trail of user 7/12 imports | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.17 Module 17: Water Intelligence & Irrigation Management
- **Document Reference:** [`docs/superadmin-instructions/17-water-resources-and-irrigation.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/17-water-resources-and-irrigation.md)
- **Module ID:** `17-water-and-irrigation` · **Tag:** `water`
- **Managed Collections:** `water_schedules`, `cgwb_stations`, `canal_schedules`

#### Administrative Capabilities & Workflows
- Update irrigation canal rotation dates and time slots by canal division
- Sync CGWB groundwater monitoring station water table readings
- Configure PMKSY subsidy percentages and maximum per-acre caps
- Issue emergency drought and low-water advisory alerts to affected tehsils
- Monitor water usage efficiency statistics across farming clusters

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Water Intelligence & Irrigation Management` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `PUT` | `/v1/admin/water/canal-schedule` | Update canal rotation timetable | `superadmin`, `admin` |
| `POST` | `/v1/admin/water/groundwater-readings` | Batch ingest CGWB station readings | `superadmin`, `admin` |
| `PUT` | `/v1/admin/water/subsidy-rules` | Update PMKSY subsidy parameters | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.18 Module 18: FPO Engine & Bulk Procurement Pools
- **Document Reference:** [`docs/superadmin-instructions/18-fpo-verification-and-pool-management.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/18-fpo-verification-and-pool-management.md)
- **Module ID:** `18-fpo-and-pools` · **Tag:** `fpo`
- **Managed Collections:** `fpos`, `fpo_pools`, `fpo_pool_members`

#### Administrative Capabilities & Workflows
- Verify FPO registration certificates (ROC, Nabard, SFAC recognition)
- Create and approve bulk procurement pools and supplier discount tiers
- Monitor pool deadline completion and supplier delivery agreements
- Audit shared FPO machinery allocation and maintenance funds
- Track FPO financial turnover and member patronage dividends

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `FPO Engine & Bulk Procurement Pools` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/fpo` | List registered FPOs and membership counts | `superadmin`, `admin` |
| `POST` | `/v1/admin/fpo/verify/{id}` | Approve FPO credential verification | `superadmin`, `admin` |
| `POST` | `/v1/admin/fpo/pools` | Create platform-sponsored group buy pool | `superadmin`, `admin` |
| `PUT` | `/v1/admin/fpo/pools/{id}/status` | Close pool and trigger supplier purchase order | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.19 Module 19: Livestock, Dairy & Veterinary Services
- **Document Reference:** [`docs/superadmin-instructions/19-livestock-vet-and-dairy-network.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/19-livestock-vet-and-dairy-network.md)
- **Module ID:** `19-livestock-dairy-vet` · **Tag:** `livestock`
- **Managed Collections:** `gaushalas`, `nurseries`, `vets`, `dairy_products`, `vet_bookings`, `manure_orders`

#### Administrative Capabilities & Workflows
- Verify Veterinary Doctor qualifications (B.V.Sc degree, State Veterinary Council registration)
- Audit Gaushalas and certify cow welfare trust registration
- Approve plant nurseries for government certified sapling distribution
- Manage dairy product purity certificates and hygiene compliance
- Mediate vet doctor booking cancellations and emergency dispatch issues

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Livestock, Dairy & Veterinary Services` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/livestock/vets` | List vet doctors and verification status | `superadmin`, `admin` |
| `POST` | `/v1/admin/livestock/vets/{id}/verify` | Verify vet credentials and license | `superadmin`, `admin` |
| `GET` | `/v1/admin/livestock/gaushalas` | List Gaushalas and product offerings | `superadmin`, `admin` |
| `GET` | `/v1/admin/livestock/orders` | Audit dairy and manure orders | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.20 Module 20: Knowledge Hub, Content CMS & Live Media
- **Document Reference:** [`docs/superadmin-instructions/20-content-cms-live-channels-workshops.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/20-content-cms-live-channels-workshops.md)
- **Module ID:** `20-content-cms-and-gyan` · **Tag:** `content`
- **Managed Collections:** `agri_news`, `agri_channels`, `workshops`, `expert_talks`, `video_guides`, `blog_articles`

#### Administrative Capabilities & Workflows
- Publish, edit, and schedule agricultural news articles with breaking news tags
- Manage live TV channels, RTMP ingest stream keys, and HLS playback URLs
- Moderate live channel chat messages and ban abusive users
- Create paid workshops, manage seat inventory, and view enrolled farmers
- Schedule expert scientist talks and triage farmer questions
- Publish agronomy video guides and articles with bilingual translations

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Knowledge Hub, Content CMS & Live Media` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/content/{collection}` | List and paginate CMS content items | `superadmin`, `admin` |
| `POST` | `/v1/admin/content/{collection}` | Create news, blog, workshop, or video | `superadmin`, `admin` |
| `PUT` | `/v1/admin/content/{collection}/{id}` | Update content item details | `superadmin`, `admin` |
| `DELETE` | `/v1/admin/content/{collection}/{id}` | Remove content item | `superadmin`, `admin` |
| `GET` | `/v1/admin/workshops/{id}/roster` | View workshop enrolled farmers | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.21 Module 21: Agroforestry, Tree Plantation & Biofuel
- **Document Reference:** [`docs/superadmin-instructions/21-agroforestry-and-sapling-requests.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/21-agroforestry-and-sapling-requests.md)
- **Module ID:** `21-agroforestry-and-trees` · **Tag:** `tree`
- **Managed Collections:** `tree_articles`, `ngos`, `biofuel_trees`, `tree_care_guides`, `sapling_requests`

#### Administrative Capabilities & Workflows
- Verify afforestation NGOs and partner nurseries
- Review and approve farmer sapling requests by tree type (timber, biofuel, fruit, bamboo)
- Track sapling delivery logistics and planting survival rates
- Update commercial biofuel crop economics (gestation, oil content %, expected returns)
- Manage agroforestry tree care guides and disease prevention guidelines

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Agroforestry, Tree Plantation & Biofuel` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/tree/requests` | List pending sapling requests | `superadmin`, `admin` |
| `PUT` | `/v1/admin/tree/requests/{id}/status` | Approve, dispatch, or reject request | `superadmin`, `admin` |
| `GET` | `/v1/admin/tree/ngos` | Manage partner NGO directory | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.22 Module 22: Gamification, Krishi Ratna & Referrals
- **Document Reference:** [`docs/superadmin-instructions/22-gamification-economy-and-referrals.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/22-gamification-economy-and-referrals.md)
- **Module ID:** `22-gamification-and-referrals` · **Tag:** `ratings`
- **Managed Collections:** `gamification_status`, `agri_coins_ledger`, `reward_coupons`, `referrals`, `ratings`

#### Administrative Capabilities & Workflows
- Monitor platform-wide AgriCoins circulation and daily mint/burn totals
- Manage rewards store inventory (vouchers, discounts, partner services)
- Detect and prevent referral fraud (device farms, duplicate phone numbers)
- Configure AgriCoins earn rates for app activities (diary, bookings, invites)
- Moderate user reviews and 1-5 star service ratings for transporters and equipment

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Gamification, Krishi Ratna & Referrals` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/gamification/ledger` | System-wide AgriCoins transaction log | `superadmin`, `admin` |
| `POST` | `/v1/admin/gamification/rewards` | Add new voucher to rewards store | `superadmin`, `admin` |
| `GET` | `/v1/admin/referrals/audit` | Referral fraud detection report | `superadmin`, `admin` |
| `DELETE` | `/v1/admin/ratings/{id}` | Remove abusive or defamatory rating | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.23 Module 23: Climate Resilience, Carbon Credits & Cold Storage
- **Document Reference:** [`docs/superadmin-instructions/23-climate-resilience-and-cold-storage.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/23-climate-resilience-and-cold-storage.md)
- **Module ID:** `23-climate-and-storage` · **Tag:** `climate`
- **Managed Collections:** `cold_storages`, `cold_storage_bookings`, `climate_varieties`

#### Administrative Capabilities & Workflows
- Manage cold storage facility directory (capacity in MT, temperature ranges, monthly rates)
- Audit cold storage reservations and prevent overbooking
- Configure carbon sequestration parameters based on regenerative farming practices
- Maintain database of ICAR/State certified climate-resilient crop varieties
- Review AI produce quality grading accuracy and calibration curves

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Climate Resilience, Carbon Credits & Cold Storage` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/cold-storage/facilities` | Directory of registered cold chains | `superadmin`, `admin` |
| `POST` | `/v1/admin/cold-storage/facilities` | Onboard new cold storage partner | `superadmin`, `admin` |
| `GET` | `/v1/admin/climate/carbon-audit` | Carbon credit certification and payout desk | `superadmin`, `admin` |
| `PUT` | `/v1/admin/climate/varieties/{id}` | Update certified seed variety specs | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.24 Module 24: Women in Agriculture & Self Help Groups
- **Document Reference:** [`docs/superadmin-instructions/24-women-empowerment-and-shg-programs.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/24-women-empowerment-and-shg-programs.md)
- **Module ID:** `24-women-in-agriculture` · **Tag:** `women`
- **Managed Collections:** `women_shgs`, `shg_deposits`, `home_enterprises`

#### Administrative Capabilities & Workflows
- Verify SHG registration documents, bank accounts, and cluster federation linkage
- Monitor weekly SHG meeting attendance, deposit discipline, and internal loan repayment
- Review and approve cottage agro-processing products (pickles, papad, handloom, spices)
- Disburse interest subvention subsidies and NRLM capacity building grants
- Generate socio-economic impact metrics across women-led agri-enterprises

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Women in Agriculture & Self Help Groups` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/women/shgs/queue` | Pending SHG verification applications | `superadmin`, `admin` |
| `POST` | `/v1/admin/women/shgs/{id}/verify` | Approve SHG registration & grant eligibility | `superadmin`, `admin` |
| `POST` | `/v1/admin/women/subsidies/disburse` | Credit interest subvention subsidy to SHG bank | `superadmin`, `admin` |
| `GET` | `/v1/admin/women/enterprise-products` | Curate home enterprise storefront | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.25 Module 25: Financial Settlements & Automated Cron Jobs
- **Document Reference:** [`docs/superadmin-instructions/25-financial-settlements-and-automated-jobs.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/25-financial-settlements-and-automated-jobs.md)
- **Module ID:** `25-settlements-and-jobs` · **Tag:** `settlements`
- **Managed Collections:** `settlements`, `transporter_payouts`, `seller_payouts`, `cron_job_logs`

#### Administrative Capabilities & Workflows
- Review pending transporter freight and seller produce payouts in the daily settlement batch
- Manually trigger on-demand settlement calculation run
- Mark settlements as disbursed with bank UTR / NEFT reference numbers
- Place suspicious transactions or dispute-locked bookings on legal settlement hold
- Audit platform service fee deductions and GST invoice generation
- Monitor Cloud Scheduler cron execution status, error logs, and execution times

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `Financial Settlements & Automated Cron Jobs` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/settlements` | List settlements with status filters (pending/approved/paid) | `superadmin`, `admin` |
| `POST` | `/v1/admin/settlements/{id}/mark-paid` | Mark settlement disbursed with payment ref | `superadmin`, `admin` |
| `POST` | `/v1/admin/jobs/settlements/run` | Trigger manual settlement batch run | `superadmin`, `admin` |
| `PUT` | `/v1/admin/platform-config/commissions` | Update commission rates | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.


### 4.26 Module 26: System Health, Remote Config, Broadcast & Moderation
- **Document Reference:** [`docs/superadmin-instructions/26-system-config-broadcasts-and-moderation.md`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/26-system-config-broadcasts-and-moderation.md)
- **Module ID:** `26-system-config-and-moderation` · **Tag:** `app-config`
- **Managed Collections:** `app_config`, `broadcasts`, `user_reports`, `user_blocks`, `user_consents`, `audit_logs`, `expert_tickets`

#### Administrative Capabilities & Workflows
- Configure minimum supported mobile app version and trigger force-update splash screen
- Toggle dynamic feature flags per persona and district without app redeployment
- Targeted FCM push notification broadcast engine filtered by persona, state, and district
- User-generated content (UGC) moderation queue for reported abusive users and spam
- View real-time system health, database latency, Redis cache hit rates, and Sentry error logs
- Audit user consent records for DPDP (Digital Personal Data Protection) compliance

#### Administrative UI Screens & Controls
- **Data Table View:** High-density filterable grid displaying `System Health, Remote Config, Broadcast & Moderation` records with search, status filters, and pagination.
- **Entity Detail & Audit Drawer:** Slide-over panel displaying raw Firestore document JSON, historical state transitions, and audit records.
- **Action Safeguards & Modals:** Destructive operations (overrides, deletions, status rejections) enforce mandatory audit reasoning and 2FA confirmation.

#### Superadmin API Specifications
| HTTP Method | Admin Path | Description | Roles Required |
|---|---|---|---|
| `GET` | `/v1/admin/app-config` | Fetch current app version gates and feature flags | `superadmin`, `admin` |
| `PUT` | `/v1/admin/app-config` | Update minSupportedVersion and feature flags | `superadmin`, `admin` |
| `POST` | `/v1/admin/broadcast` | Send targeted FCM push notification to user segments | `superadmin`, `admin` |
| `GET` | `/v1/admin/reports` | List reported users and content for moderation | `superadmin`, `admin` |
| `POST` | `/v1/admin/reports/{id}/resolve` | Resolve report with warning or ban | `superadmin`, `admin` |
| `GET` | `/v1/admin/analytics/summary` | Global platform KPI dashboard summary | `superadmin`, `admin` |

#### Operational Business Rules & Guardrails
1. **Two-Man Rule (Maker-Checker):** Any state override affecting financial balances or KYC approval requires second-level confirmation if value exceeds ₹10,000.
2. **Audit Requirement:** Every update must include a non-empty `auditReason` string.
3. **Live Sync:** Real-time push update via FCM when an entity status transitions to `approved` or `rejected`.

---

## 5. Phased Implementation Roadmap for `apps/admin`

To systematically implement the full superadmin suite without disrupting ongoing operations, execution is divided into 5 structured phases:

### Phase 1: Security, Identity & User Governance (Sprint 1)
- **Modules Covered:** Module 01 (Auth & RBAC), Module 02 (User Profiles & Personas), Module 03 (KYC & Vault), Module 26 (System Config & Moderation).
- **Deliverables:**
  - Complete user management table with persona badge indicators.
  - KYC document viewer with zoom, rotate, and split-screen comparison against govt identity format.
  - Emergency user suspension and device token revocation controls.
  - System feature flag toggles and broadcast notification composer.

### Phase 2: Commercial & Transaction Engine (Sprint 2)
- **Modules Covered:** Module 04 (Mandi Rates), Module 05 (B2B Lots), Module 06 (Marketplace & Orders), Module 07 (Contracts & Escrow), Module 08 (Transport), Module 09 (Equipment Rental), Module 25 (Settlements).
- **Deliverables:**
  - Mandi rate approval queue comparing vyapari rates against APMC/MSP boundaries.
  - B2B lot inspection and dispute resolution console.
  - Marketplace product catalog CMS with supplier verification.
  - Weekly settlement clearance batch runner with Razorpay Route / Payouts integration.
  - Equipment rental conflict mediator (handling slot no-shows and equipment damage claims).

### Phase 3: Farmland, Agronomy & AI Advisory (Sprint 3)
- **Modules Covered:** Module 10 (Farmland Leasing), Module 11 (AI Advisory & Radar), Module 12 (Chatbot & Expert Desk), Module 16 (Land Records 7/12), Module 17 (Water Intelligence), Module 23 (Climate & Cold Storage).
- **Deliverables:**
  - Farmland lease dispute arbitration drawer with e-stamp agreement PDF preview.
  - Pest outbreak geo-map with targeted broadcast alert dispatcher.
  - Kisan Mitra chatbot transcripts auditor with agronomist escalation queue.
  - Mahabhulekh land record registry sync monitor.
  - Cold storage chamber capacity manager with temperature alert logging.

### Phase 4: Financial Inclusion, Credit & PMFBY Insurance (Sprint 4)
- **Modules Covered:** Module 14 (Banking, Credit Score & KCC Loans), Module 15 (Crop Insurance & Claims).
- **Deliverables:**
  - Bank account penny-drop verification auditor.
  - KCC loan application queue with land holding vs. credit limit calculator.
  - PMFBY insurance claim surveyor assignment and DBT payout release dashboard.
  - Claim appeal tribunal console for rejected crop damage claims.

### Phase 5: Community, Ecosystem, Women SHGs & Content (Sprint 5)
- **Modules Covered:** Module 18 (FPOs & Pools), Module 19 (Livestock & Vet), Module 20 (Content CMS & Gyan Hub), Module 21 (Agroforestry), Module 22 (Gamification & Referrals), Module 24 (Women in Agriculture).
- **Deliverables:**
  - FPO verification and group buying procurement pool monitor.
  - Verified veterinarian registry and 24x7 emergency call dispatch monitor.
  - Gyan Hub multi-lingual content editor with markdown and video upload support.
  - Free sapling request approval console for NGO reforestation programs.
  - AgriCoins economy ledger with fraud detection on referral points.
  - Women SHG micro-enterprise grant and savings pool manager.

---

## 6. Superadmin API Contract Conventions

All administrative endpoints conform to the following API standard:

### Headers
```http
Authorization: Bearer <superadmin_jwt>
X-Admin-Role: superadmin|compliance_officer|finance_admin|agronomist
X-Audit-Reason: Verified via official government registry
Content-Type: application/json
```

### Response Envelope
```json
{
  "data": [ ... ],
  "page": 1,
  "pageSize": 20,
  "total": 1420,
  "timestamp": "2026-09-19T10:30:00Z"
}
```

### Error Envelope
```json
{
  "error": {
    "code": "INSUFFICIENT_ADMIN_PERMISSIONS",
    "message": "Only superadmin and finance_admin may approve commission settlement payouts exceeding Rs. 50,000",
    "fieldErrors": {}
  }
}
```

---

## 7. Conclusion & Operational Readiness

This operational blueprint and the accompanying **26 module-wise instruction documents** in [`docs/superadmin-instructions/`](file:////home/tushka/Projects/AGROVERCITY/docs/superadmin-instructions/) provide complete, rigorous, and actionable specifications for engineering teams building the AGROVERCITY Superadmin Console.
