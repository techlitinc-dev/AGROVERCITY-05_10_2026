# Farm–Transporter Marketplace — Feature Specification
## Farmer ↔ Transporter Direct-Booking Platform (Mobile + Web)

> **Hard Constraints (Non-Negotiable)**
> - Communication is 100% in-app only. Chat unlocks ONLY after booking confirmation.
> - NO VoIP, NO phone/contact number sharing, NO SOS/help-section, NO IoT/telemetrics.
> - All payments, contracts, and negotiations happen inside the platform (commission-based revenue model).
> - ⚠️ = Feature flagged as a VIOLATION of the not-to-do list (must NOT be built).

---

## A. MUST-HAVE Feature Set

### A.1 Farmer Role

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| F1 | Booking creation — "Post a Load" | Multi-step wizard: produce type (crops / livestock / equipment), quantity + units, vehicle type required, pickup & drop locations (pin on map + address), preferred date/time window, loading/unloading labour need, special handling flags (perishable, live animals, fragile equipment) | P0 |
| F2 | Photo documentation of load | Upload images of produce/animals/equipment at booking creation (evidence baseline) | P0 |
| F3 | Instant quote vs. Auction bid | Farmer chooses: fixed platform price, or open auction (transporters bid; farmer picks within X hours) | P0 |
| F4 | Rate negotiation counter | In-app counter-offer on bids before acceptance (negotiation happens inside platform only) | P0 |
| F5 | Transporter discovery & comparison | List of transporters filtered by vehicle type, rating, distance, verified badge, past completed trips; NO contact details shown | P0 |
| F6 | Live booking status tracking | Status lifecycle: Requested → Bid/Quote → Confirmed → Transporter en route → Loading → In transit → Delivered → Completed | P0 |
| F7 | In-transit milestone pings | Transporter taps "Reached pickup", "Loaded", "Reached drop", "Unloaded" — farmer gets notifications | P0 |
| F8 | Proof of delivery (POD) | OTP-verified delivery confirmation + delivery photos uploaded by transporter; farmer countersigns | P0 |
| F9 | Damage reporting at delivery | Farmer inspects on arrival; if damage, opens dispute with photos within 24h window; payment held in escrow | P0 |
| F10 | Payments & wallet | In-app payment (UPI, cards, netbanking, wallet balance), escrow hold until POD, invoices/receipts, GST-compliant invoice download | P0 |
| F11 | Ratings & reviews | Rate transporter + vehicle + driver behavior; text review; visible to marketplace | P0 |
| F12 | Repeat/scheduled bookings | Save load templates (e.g., weekly mandi run), seasonal recurring booking | P1 |
| F13 | Price estimate tool | Pre-booking estimate per km per vehicle class (data-driven, transparent) | P1 |
| F14 | Seasonal demand calendar & fare trends | Historical fare heatmap by route/season to help farmer plan | P1 |
| F15 | Multi-drop / milk-run booking | One vehicle, multiple delivery stops (route optimizer inside platform) | P2 |
| F16 | Mandi/APMC rate integration | Show mandi rates alongside transport cost for trip ROI planning | P2 |
| F17 | ⚠️ "Call transporter" button | ❌ VIOLATION — phone/contact sharing forbidden. Replaced entirely by post-booking in-app chat. | DO NOT BUILD |
| F18 | ⚠️ SOS / emergency help button | ❌ VIOLATION — no SOS/help-section feature allowed. Safety handled via dispute flow + emergency contact field (not a button/feature). | DO NOT BUILD |

### A.2 Transporter Role

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| T1 | Vehicle & fleet management | Add multiple vehicles: type (mini-truck/tempo/trailer/reefer/livestock carrier), capacity, registration number, RC copy upload, vehicle photos | P0 |
| T2 | Document & KYC vault | Driving licence, RC, insurance, permit — upload, expiry tracking with renewal reminders | P0 |
| T3 | Availability calendar & route preferences | Set available days, preferred routes/destinations, home base radius for job alerts | P0 |
| T4 | Job feed / load board | Matching loads by vehicle type, location radius, date; filters by produce type, distance, payout | P0 |
| T5 | Bid / quote submission | Submit bid with price, ETA, vehicle assigned; counter-offer handling during negotiation window | P0 |
| F6-equivalent | Booking acceptance & trip management | Accept confirmed booking; see pickup/drop details; status updates with one-tap milestones | P0 |
| T7 | Navigation integration | Deep-link to Google Maps / in-app map view for route (navigation app itself is external — only the trip coordinates are shared, no contact exchange) | P0 |
| T8 | POD capture | OTP collection from farmer/receiver, delivery photos, unloading confirmation | P0 |
| T9 | Earnings & payouts | Wallet balance, payout to bank (UPI/NEFT), trip-wise earning breakdown, platform commission shown transparently, weekly/monthly statements, TDS summary | P0 |
| T10 | Ratings & reputation | Rating received, badges (On-time, Verified, Top Transporter), performance dashboard | P0 |
| T11 | Rejection & cancellation controls | Cancel with reason codes; penalty matrix visible; cooldown for excessive cancellations | P0 |
| T12 | Return-load matching | Show backhaul loads on/near return route to reduce empty running | P1 |
| T13 | Fuel/toll cost estimator | Route-based cost helper to inform bidding | P1 |
| T14 | Team/driver management (fleet owners) | Owner adds drivers as sub-users; trips assigned to drivers; driver sees only assigned trip details | P1 |
| T15 | ⚠️ Display farmer phone number | ❌ VIOLATION — contact sharing forbidden. Farmer identity shown as name + rating only, until chat unlock. | DO NOT BUILD |
| T16 | ⚠️ In-app VoIP calls to farmer | ❌ VIOLATION — no VoIP. All coordination via structured status updates + in-app chat (post-booking). | DO NOT BUILD |

### A.3 Shared / Core Marketplace Features

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| S1 | Role-based registration & KYC onboarding | Farmer and transporter flows with document verification (see Section B) | P0 |
| S2 | Identity verification & trust badges | Verified KYC badge, vehicle-verified badge | P0 |
| S3 | In-app booking lifecycle engine | State machine: draft → requested → bidded → negotiated → confirmed → in-progress → delivered → completed/cancelled/disputed | P0 |
| S4 | Escrow payments | Payment captured at confirmation, released on POD (or auto-release T+48h if no dispute) | P0 |
| S5 | In-app chat (post-booking only) | Full architecture in Section D | P0 |
| S6 | Push notifications + SMS fallback | Booking events, bid received, status changes, payment events (SMS contains NO contact numbers of other party) | P0 |
| S7 | In-app notification centre | Transactional feed of all events | P0 |
| S8 | Dispute resolution system | Structured dispute types, evidence upload, admin arbitration (Section C) | P0 |
| S9 | Cancellation & no-show engine | Reason codes, penalty rules, refund logic (Section E) | P0 |
| S10 | Reviews & rating aggregation | Mutual rating post-completion; abuse detection | P0 |
| S11 | Dynamic pricing engine | Base per-km rate × vehicle class × season × demand multiplier (admin-controlled surge) | P0 |
| S12 | Platform wallet | Unified wallet for refunds, incentives, payout holds | P0 |
| S13 | Referral program | Referral credits for both sides (in-platform credits, not cash contact exchange) | P1 |
| S14 | Multilingual UX | Hindi + regional languages + English (Indian agri context) | P1 |
| S15 | Offline-tolerant mobile app | Cache trip details; status updates queue when network returns (no telematics — manual taps only) | P1 |
| S16 | ⚠️ Real-time GPS telematics / IoT tracking | ❌ VIOLATION — no IoT/telematics. Live location = transporter's manual "share location pin" taps in chat + milestone pings. No continuous GPS stream. | DO NOT BUILD |
| S17 | ⚠️ Public help desk / SOS center | ❌ VIOLATION — no SOS/help-section. Support entry points exist only as in-app dispute/report forms tied to a specific booking. | DO NOT BUILD (as a standalone section) |
| S18 | ⚠️ Click-to-call support hotline | ❌ VIOLATION if it shares user numbers. Support callbacks must use masked/admin-initiated channels. Flagged — safest: in-app ticket system only. | DO NOT BUILD (phone-based) |

---

## B. Role-Based Onboarding Flows & KYC (Indian Agri-Market Context)

### B.1 Farmer Onboarding Flow

```
Step 1  Mobile OTP verification (10-digit Indian number — number stored, never displayed)
Step 2  Choose role → "Farmer"
Step 3  Profile basics: name, preferred language, home village/town (pin on map)
Step 4  KYC documents upload (see table below)
Step 5  Farm profile (optional but boosts matching): crops grown, typical harvest months,
        typical load sizes, default pickup location(s)
Step 6  Bank/UPI details for refunds & payouts (verified via penny-drop/UPI validation)
Step 7  Consent: platform T&C, payment terms, no-direct-contact policy acceptance
Step 8  Account created in "KYC PENDING" state → can browse quotes but cannot post a paid
        booking until verified
Step 9  Admin verification queue approves/rejects (Section C) → "VERIFIED" badge
```

| # | Document (Farmer) | Purpose | Required |
|---|-------------------|---------|----------|
| K1 | Aadhaar card (front + back) | Identity proof (eKYC via Aadhaar XML/QR or manual upload) | Mandatory |
| K2 | PAN card | Financial identity; GST linkage if applicable | Mandatory |
| K3 | Kisan Credit Card (KCC) OR land record (7/12 utara / land title document) | Farmer legitimacy verification — strong trust signal in Indian agri context | One of the two mandatory |
| K4 | Passport-size photo | Profile verification | Mandatory |
| K5 | Bank account details + cancelled cheque / bank statement | Payouts & refunds | Mandatory |
| K6 | FPO registration certificate (only if registering as Farmer Producer Organisation) | Role variant | Conditional |

### B.2 Transporter Onboarding Flow

```
Step 1  Mobile OTP verification
Step 2  Choose role → "Transporter" → sub-type: Individual owner-driver / Fleet owner / Logistics company
Step 3  Profile basics: name, business name (if any), base city, preferred operating radius
Step 4  Personal KYC documents upload
Step 5  Vehicle onboarding loop (per vehicle): type, capacity, reg number, photos, RC upload
Step 6  Bank details for payouts (verified)
Step 7  Consent: platform T&C, commission schedule, cancellation policy, code-of-conduct
        (incl. no-direct-contact rule) acceptance
Step 8  Account in "KYC PENDING" → can view load board but cannot bid until verified
Step 9  Admin approves → "VERIFIED" badge; each vehicle gets "VEHICLE VERIFIED" badge
        after RC validation
```

| # | Document (Transporter) | Purpose | Required |
|---|------------------------|---------|----------|
| K7 | Aadhaar card | Identity proof | Mandatory |
| K8 | PAN card (individual) / GST certificate (company) | Tax identity; GST mandatory for fleet/logistics company | Mandatory |
| K9 | Commercial Driving Licence (DL) — valid, correct vehicle class | Legal driving eligibility | Mandatory (per driver) |
| K10 | Vehicle Registration Certificate (RC) per vehicle | Ownership/authorization; commercial registration check | Mandatory per vehicle |
| K11 | Commercial vehicle insurance (valid, active) | Liability coverage | Mandatory per vehicle |
| K12 | Goods carrier permit / national permit | Legal goods transport authorization | Mandatory |
| K13 | Fitness certificate (commercial vehicle) | Roadworthiness | Mandatory |
| K14 | Bank account details + cancelled cheque | Payouts | Mandatory |
| K15 | Fleet owner: company registration (Udyam/MSME) + driver list with DLs | Fleet sub-type | Conditional |

---

## C. Admin Panel Capabilities

| # | Module | Capabilities |
|---|--------|--------------|
| C1 | Dashboard | GMV, active bookings, bookings by state, cancellation rate, dispute rate, revenue (commission earned), demand heatmap by route/season |
| C2 | KYC verification queue | Filter by role/status; side-by-side document viewer; approve / reject with reason; request re-upload; bulk approve; audit trail of verifier actions; auto-expiry checks (DL/insurance/permit dates) with flagging |
| C3 | User management | Search/suspend/deactivate users; role change (farmer↔transporter requires fresh KYC); trust badge grant/revoke; blacklist (fraud/rate-manipulation) |
| C4 | Booking oversight | Live booking list with full state machine view; force-cancel (admin-initiated, with reason); reassign transporter on no-show; view full event timeline (bids, counters, status taps, chat metadata — chat content viewable only when dispute escalated) |
| C5 | Commission & surge settings | Per-vehicle-class commission %; per-route floor/ceiling prices; seasonal surge multipliers (e.g., harvest seasons: wheat Apr–May, rice Oct–Nov, sugarcane Feb–Apr); festive/event spikes; change approval workflow with effective-date scheduling |
| C6 | Dispute resolution workflow | Queue of disputes (damage, payment, no-show, behavioral); evidence viewer (photos, POD, chat export); arbitrator assignment; resolution actions: release escrow to farmer / split / release to transporter / partial refund / penalty; resolution SLA timer; appeal (one level) |
| C7 | Payments & reconciliation | Escrow ledger; payout batches to transporters; refund processing; commission invoices; failed-transaction retry; TDS deduction reports |
| C8 | Cancellations & penalties | Configure penalty matrix (who cancelled, how late, how often); waive/apply penalties manually with reason |
| C9 | Ratings & content moderation | Review moderation (remove abusive reviews); rating-fraud detection (collusion rings) |
| C10 | Reports & exports | Financial, operational, KYC, dispute reports; CSV/PDF export; GST reports |
| C11 | Config & CMS | Crop/vehicle master lists, fare estimator config, notification templates, language strings, referral rules |

---

## D. In-App Chat Architecture

### D.1 Locking Model

| State | Chat availability |
|-------|-------------------|
| Pre-booking (browsing, bidding, negotiating) | 🔒 LOCKED. No chat, no contact card, no phone numbers anywhere in UI. Bid cards show only: transporter first name, rating, vehicle type, completed trips. Farmer card shows only: first name, rating. |
| Booking confirmed (payment in escrow) | 🔓 UNLOCKED. Chat room auto-created bound to booking ID. |
| Booking completed | Chat stays readable for 7 days (for dispute evidence), then archived read-only. |
| Booking cancelled before pickup | Chat locked/archived immediately; reopen only if admin reinstates. |

### D.2 Message Types

| Type | Payload | Notes |
|------|---------|-------|
| Text | UTF-8, multilingual | Max 2000 chars; profanity filter; no phone-number/URL regex auto-block (see moderation) |
| Image | Produce photos, vehicle photos, damage photos | Max 5 MB, compressed; EXIF-stripped; virus-scanned |
| Location pin | Static lat/lng pin | ONE-TAP pin ("share my location") — not continuous tracking (no telematics). Expires after trip. |
| System messages | Status changes, escrow events, admin notes | Non-deletable; rendered distinctly |

### D.3 Rules & Moderation

| Rule | Detail |
|------|--------|
| Contact-info block | Client + server-side regex blocks phone numbers, WhatsApp/Telegram handles, email addresses, UPI IDs in messages. Blocked message → user warned; repeat → message flagged, possible account restriction. |
| External links | Blocked; only whitelisted domains (none in v1) |
| No voice/video messages | ❌ (VoIP-adjacent — would violate no-VoIP rule) |
| Profanity/abuse filter | Bilingual (Hindi + English) filter; escalation to moderation queue |
| Report message | One-tap report → enters admin moderation queue (C9) |
| Rate limiting | Max 60 msgs/min/user to prevent spam |
| Chat visibility | Admin can read chat ONLY when (a) a dispute is open on the booking, or (b) a message is reported |

### D.4 Technical Architecture

| Layer | Design |
|-------|--------|
| Transport | WebSocket (persistent) with REST fallback polling; mobile app reconnects with exponential backoff |
| Service | Chat microservice; message store (append-only) + room index per booking |
| Message flow | Client → API gateway → moderation pre-filter (async risk scoring) → persist → fan-out via WebSocket to room members → delivery receipts (sent/delivered/read) |
| Audit logging | Immutable log: message ID, room/booking ID, sender user ID, type, hash of content, timestamps, moderation actions, admin views (who viewed, when, why) — retained 24 months |
| Scalability | Sharded by booking ID; hot rooms (disputed) pinned to fast storage |
| Offline | Messages queued locally, sent on reconnect; push notification on new message when app backgrounded |

### D.5 Sequence (Post-Confirmation Unlock)

```
1. Farmer payment confirms → escrow created
2. Booking state = CONFIRMED → Chat service creates room {booking_id}
3. Both parties receive "Chat unlocked" notification
4. Either party opens booking card → "Chat" tab → joins room
5. All messages moderated & logged per D.3/D.4
6. POD completed → room switches to read-only after 7 days → archived
```

---

## E. Edge Cases & Handling Rules

| # | Edge Case | Handling |
|---|-----------|----------|
| E1 | Farmer cancels after confirmation | >24h before pickup: full refund minus small fee. <24h: 10% penalty to transporter. <2h or after transporter en route: 25% penalty + transporter compensated for fuel/time |
| E2 | Transporter cancels after confirmation | Auto-notify farmer; instant full refund; transporter gets strike; 2 strikes/30 days → bidding suspension; offer rebooking with priority matched transporter + platform credit |
| E3 | Transporter no-show at pickup | 30-min grace → farmer taps "No-show" → booking auto-cancelled, full refund + penalty credit to farmer from transporter deposit; transporter strike |
| E4 | Farmer no-show (load not ready) | Transporter waits via in-app timer; after grace, transporter taps "Load not ready" → cancellation with farmer penalty (10–25% based on notice) |
| E5 | Produce damage in transit | Farmer opens dispute within 24h of delivery with photos vs. booking-time photos (F2 baseline). Escrow frozen. Admin arbitration: payout split/full refund per evidence severity matrix; repeated damage → transporter vehicle flagged |
| E6 | Livestock mortality/injury in transit | Priority dispute lane; vet-document upload option; strict liability presumption on transporter unless evidence of pre-existing condition (baseline photos critical) |
| E7 | Payment dispute (double charge, failed escrow release) | Auto-release T+48h after POD unless dispute open; payment disputes triaged by payments module with bank/UPI reference audit |
| E8 | Rate negotiation deadlock | Bid windows auto-expire (default 4h); farmer can re-open auction once; platform quote always available as fallback so load never stalls |
| E9 | Bid manipulation / collusion | Ring detection on bidding patterns; admin blacklisting (C3); minimum-bid floor per route |
| E10 | Seasonal demand spike (harvest) | Pre-configured surge multipliers (C5); capacity forecasting dashboard; incentive credits to pull transporters into high-demand corridors; queue-based booking fallback ("scheduled trip" waitlist) |
| E11 | Vehicle breakdown mid-trip | Transporter taps "Breakdown" status → platform re-matches nearest available transporter for load transfer; original transporter paid pro-rata; replacement transporter paid remainder |
| E12 | Disagreement over delivered quantity | Weighbridge slip upload (photo) as optional POD field; baseline vs delivery photo comparison by admin |
| E13 | Chat abuse / contact-info leak attempts | Blocked + strike system; 3 strikes → chat restricted to system messages only; account review |
| E14 | Fake KYC documents | Manual verification queue (C2) + forgery flags; PAN/Aadhaar checksum validation where APIs allow; rejection with reason; repeat fraud → blacklist + legal escalation |
| E15 | One party requests off-platform deal ("pay me directly, no commission") | Report category in chat; admin action: warning → suspension; escrow-only payment makes off-platform deals impossible to complete officially |
| E16 | Multi-drop partial delivery | Per-stop POD (OTP per stop); partial disputes scoped to affected leg only |
| E17 | Return-load confirmed but transporter abandons | Backhaul commitment tracked; abandonment = strike; farmer side of return leg auto-rematched |
| E18 | Network outage in rural pickup areas | Offline status queue (S15); SMS fallback for critical events (status change, OTP); POD OTP supports offline-cache + sync-on-reconnect |

---

## Compliance Checklist (Not-To-Do Verification)

| Rule | Status |
|------|--------|
| No phone/contact number sharing anywhere | ✅ Enforced (K1–K15 numbers stored hashed, never rendered; chat regex blocker; no contact cards) |
| Chat locked pre-booking | ✅ Enforced (D.1) |
| No VoIP / voice calls / video calls | ✅ Enforced (T16, S17-audio removed; text/image/location-pin only) |
| No SOS / help-section feature | ✅ Enforced (F18, S17 — support exists only as booking-scoped dispute/report forms, not a help center) |
| No IoT / telematics / continuous GPS | ✅ Enforced (S16 — one-tap static location pins only, manual milestone taps) |
| All payments in-platform | ✅ Enforced (escrow S4; E15 anti-off-platform rule) |
