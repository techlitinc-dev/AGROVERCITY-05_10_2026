# Transporter Acceptance Test Report (UAT)

**Reference Document:** [`manual_test/02_transporter.md`](02_transporter.md)  
**Execution Timestamp:** 2026-10-22T03:36:20Z  
**Target Environment:** Local Backend (`http://localhost:8000/v1`) & Firestore Local Emulator  
**Persona Under Test:** Suresh Jadhav (+91 98220 44710, Suresh Jadhav Logistics)  
**Coordinating Personas:** Farmer Ramesh Patil (+91 98220 00001), SuperAdmin (+91 9000000001)  

---

## 1. Executive Summary

| Metric | Result |
|---|---|
| **Total Test Checks Executed** | **49** |
| **Passed** | **49** |
| **Failed** | **0** |
| **Pass Rate** | **100.0%** |
| **Overall Status** | **PASSED** (Ready for User Acceptance) |

The automated UAT runner validated the end-to-end operational lifecycle of the Transporter persona, including authentication, business profile completion, multi-document KYC submission and administrative verification, fleet onboarding (Tata Ace + Eicher 6-Wheeler), trip acceptance, 7-step execution state machine, GPS location pings, electronic Bilty and weighbridge slip generation, physical POD-OTP handover with photo proof, detention timer billing, trip expense accounting, load board bidding, and plan-gated features.

---

## 2. Test Execution Details by Module

### Module 1 — Registration, Onboarding & KYC
- **TC-TRN-01 (OTP Verification):** OTP requested for `+91 98220 44710` and verified with dev OTP. Session token issued. (**PASS**)
- **TC-TRN-02 (Resend Cooldown):** Rapid OTP resend blocked with rate limit safeguard. (**PASS**)
- **TC-TRN-04 (Role Selection):** Onboarding completed as persona `transport`, state Maharashtra, district Nashik. Profile `transport` activated. (**PASS**)
- **TC-TRN-06 & 07 (MPIN Auth):** Login with MPIN `1234` succeeded; invalid MPIN `9999` returned HTTP 401. (**PASS**)
- **TC-TRN-08 (Business Profile):** Saved profile `Suresh Jadhav Logistics`, `Owner-Driver`, routes Nashik–Pune / Nashik–Mumbai. (**PASS**)
- **TC-TRN-09 & 11 (KYC & Admin Approval):** Submitted Aadhaar, PAN, Bank, RC, DL documents. SuperAdmin verified docs in KYC queue (`kyc_user_982_transport` verified). (**PASS**)
- **TC-TRN-14 (Bank & Penny-Drop):** Added HDFC Bank account (`50100234567890`, `HDFC0001207`) and executed penny-drop verification (`verifyStatus=verified`). (**PASS**)

### Module 2 — Home & Logistics Cockpit Dashboard
- **TC-TRN-16 (Dashboard KPIs):** `GET /v1/transport/dashboard` retrieved active trips, verified vehicles count, and fleet status. (**PASS**)

### Module 3 — Vehicle & Fleet Management
- **TC-TRN-21 (Vehicle 1 - Tata Ace):** Added Tata Ace `MH-15-AB-4471` (0.75T, State Permit, future PUC/fitness/insurance dates). Admin verified vehicle documents. (**PASS**)
- **TC-TRN-23 (Vehicle 2 - Eicher 6-Wheeler):** Added Eicher 6-Wheeler `MH-12-GH-8820` (6.0T, National Permit). Admin verified vehicle documents. (**PASS**)
- **TC-TRN-26 (Availability Calendar):** Updated 3-day availability schedule via `PUT /v1/transport/vehicles/{id}/availability`. (**PASS**)
- **TC-TRN-28 (GPS Location Ping):** Sent location update (`lat: 20.1705, lng: 73.9850`, Pimpalgaon Baswant) with `availableNow: True`. (**PASS**)

### Module 4 & 5 — Trip Execution State Machine
- **TC-TRN-31 (Job Acceptance):** Farmer Ramesh Patil booked transport for 20q Onion. Suresh accepted booking with verified Tata Ace `MH-15-AB-4471`. Status moved to `accepted`. (**PASS**)
- **TC-TRN-38 (Trip Detail Tracker):** `GET /v1/transport/bookings/{id}` retrieved status tracker and waypoints log. (**PASS**)
- **TC-TRN-39 (Step Transitions):** Executed milestones sequentially:
  1. `arrivedPickup` (पिकअप स्थान पर पहुंचे)
  2. `loading` (लोडिंग चालू)
  3. `enRoute` (मार्ग में / रवाना)  
  Status updated to `enRoute`. (**PASS**)
- **TC-TRN-42 (Illegal Transition):** Attempted backwards transition `enRoute` → `arrivedPickup`; rejected with HTTP 409 `ILLEGAL_TRANSITION`. (**PASS**)

### Module 6 — Live Tracking & Route
- **TC-TRN-48 (Active Trip GPS Ping):** Sent transit coordinates (`lat: 20.08, lng: 73.88`). (**PASS**)
- **TC-TRN-51 (Route Map):** Verified route calculation and polyline coordinates between pickup (`20.1705, 73.9850`) and drop (`20.0080, 73.7890`), returning distance `34.13 km`. Verified `GEO_REQUIRED` error if coords are missing. (**PASS**)

### Module 7 — Proof of Delivery (POD)
- **TC-TRN-53 (POD-OTP Flow):**
  1. Farmer revealed 6-digit POD OTP via `GET /v1/transport/bookings/{id}/pod-otp`.
  2. Suresh submitted `POST /v1/transport/bookings/{id}/verify-pod-otp` with OTP, receiver name `Dattaram Sawant` (`+91 98220 55501`), and delivery photo proof.
  3. Booking transitioned to `delivered`. (**PASS**)

### Module 8 — Bilty, Weighbridge & Receipts
- **TC-TRN-60 (Electronic Bilty):** Generated LR slip (`LR-2026-34C1C52B`) with consignor, consignee, commodity, and freight details. (**PASS**)
- **TC-TRN-62 (Weighbridge Slip):** Logged gross weight 3250 kg, tare weight 1250 kg, net weight 2000 kg (slip `WB-2026-4471`). (**PASS**)
- **TC-TRN-63 (Trip Receipt):** Verified freight, platform commission, and escrow receipt summary. (**PASS**)

### Module 9 & 10 — P&L Expenses & Detention
- **TC-TRN-65 (Trip Expenses):** Logged Diesel (₹1,200) and Toll (₹425) expenses (`POST /v1/transport/bookings/{id}/expenses`). Total expenses reflected accurately at ₹1,625.00. (**PASS**)
- **TC-TRN-67 (Detention Timer):** Tested pickup-phase waiting timer `start` and `stop` during loading phase. (**PASS**)

### Module 13 & 14 — Load Board & Fare Tools
- **TC-TRN-76 & 78 (Load Board & Bidding):** Listed 7 open loads and placed a bid of ₹1,150.00 with Tata Ace. (**PASS**)
- **TC-TRN-83 (AI Matched Loads):** Retrieved matched loads tailored to vehicle capacity and route. (**PASS**)
- **TC-TRN-86 & 88 (Fare Tools):** Computed baseline fare estimates for 210 km corridor (Tata Ace ₹7,850 vs Eicher ₹13,350) and fetched corridor market fare trends. (**PASS**)

### Module 15 & 16 — Wallet, Settlements & Ratings
- **TC-TRN-89 & 90 (Wallet & Escrow):** Verified wallet balance, TDS 194-O tracking, and escrow release endpoint. (**PASS**)
- **TC-TRN-97 (Personal Ledger):** Fetched platform penalty & compensation ledger. (**PASS**)
- **TC-TRN-99 & 102 (Ratings):** Submitted 5-star rating with tags `fast_loading`, `accurate_weight` for Farmer Ramesh Patil. Fetched ratings summary. (**PASS**)

### Module 17, 18 & 22 — Compliance & SaaS Plan Gating
- **TC-TRN-104 (Compliance):** Verified compliance score and strike ledger (0 strikes). (**PASS**)
- **TC-TRN-107 (Analytics Gating):** Free tier correctly returned HTTP 402 `ENTITLEMENT_EXCEEDED` with upgrade prompt to Pro tier as specified in requirements. (**PASS**)
- **TC-TRN-119 & 120 (Driver Sub-Accounts):** Adding fleet driver (`Mahesh Gaikwad`) confirmed Pro plan gating (HTTP 402). (**PASS**)

### Module 20, 23 & 25 — Diary, Sharing & Templates
- **TC-TRN-113 (Diary):** Logged diesel refill expense (₹1,500) and received +15 Kisan Coins. (**PASS**)
- **TC-TRN-122–124 (Trip Sharing):** Generated public sanitized share link, fetched tracking view, and revoked share token. (**PASS**)
- **TC-TRN-129 (Load Templates):** Created recurring template "Nashik-Pune Regular Run", verified in listing, and deleted template. (**PASS**)
- **TC-TRN-130 (Notifications):** Verified notification delivery for booking events. (**PASS**)
- **TC-TRN-134 & 135 (Spec-Intended Absences):** Verified privacy safeguards (no direct contact leak before booking, in-app chat routing). (**PASS**)

---

## 3. Findings & Observations

1. **Strict Plan Enforcement**: The platform enforces SaaS tiers cleanly — Free tier allows up to 3 active vehicles and commission-only trips, while Route Analytics and Fleet Driver sub-accounts correctly throw HTTP 402 with actionable upgrade envelopes.
2. **Double-Sided Verification Gate**: Transporters cannot accept a trip unless both their personal KYC (`rc` + `dl`) and their individual vehicle's documents are approved by an administrator, preventing unverified or non-compliant transport operations.
3. **Robust Handover Security**: Delivery requires a dual-key handshake — the Farmer must explicitly reveal the OTP from their session, and the Transporter must provide the matching OTP along with physical delivery proof (receiver name and photo).

---

## 4. Automation Artifacts

- **Automated Test Script:** [`manual_test/test_transporter_uat.py`](test_transporter_uat.py)
- **Execution JSON Report:** [`manual_test/transporter_uat_run_report.json`](transporter_uat_run_report.json)
