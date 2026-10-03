# FarmFresh — Farmer ↔ Dairy & Livestock Manager Marketplace
## Product Architecture Blueprint (Mobile + Web)
*Prepared by Senior Full-Stack Product Architect | Agri-Tech Logistics & Mobility Domain*

---

## 0. Guardrails (Non-Negotiable Compliance Register)

| # | Rule | Design Implication | Status |
|---|------|--------------------|--------|
| G1 | 100% in-app communication only | No phone, email, WhatsApp, or external-link surfaces anywhere in the product | ✅ Enforced |
| G2 | Chat unlocks ONLY post-booking-confirmation | Contact module rendered inaccessible pre-booking; UI shows "Book to connect" placeholder | ✅ Enforced |
| G3 | No VoIP, no contact-number sharing | No call button, no masked-call layer, no "call" message type | ✅ Enforced |
| G4 | No SOS / help section | Support exists ONLY as dispute-ticket flow (post-transaction, admin-mediated) — not a panic feature | ✅ Enforced |
| G5 | No IoT / telemetrics | No device integration, no sensor feeds, no vehicle tracking hardware | ✅ Enforced |
| G6 | All payments, contracts, negotiations in-platform | Commission-based revenue; escrow wallet; in-app negotiation module | ✅ Enforced |

> ⚠️ **VIOLATION FLAGS:** Any feature marked ❌ in tables below must NOT be built. Audit each sprint backlog against this register.

---

## TASK A — MUST-HAVE FEATURE SET

### A.1 Farmer Role Features

| ID | Feature | Description | Notes |
|----|---------|-------------|-------|
| F1 | **Farm Profile & Plot Registry** | Farm name, plot size, location pin, soil type, FPO membership | Location = pin only, never address broadcast |
| F2 | **Produce Listing (Harvest Catalog)** | Crop/produce type, grade (A/B/C), quantity (kg/tonnes), harvest date window, photos, expected price band | Price band = min/max acceptable range for negotiation |
| F3 | **Livestock & Dairy Listing** | Milk yield/day, breed, cattle count, fat/SNF %, fodder availability | For dairy managers sourcing daily milk |
| F4 | **Manager Discovery & Match Feed** | Geo-radius search, filter by manager type (dairy co-op / livestock trader / aggregator), rating, distance | Sorted by best-price + reliability score |
| F5 | **Request for Quote (RFQ)** | Farmer sends listing → managers bid within X hours | Core matching engine |
| F6 | **Bid Comparison View** | Side-by-side bid table: price, pickup date, transport included?, payment terms | Decision-support table |
| F7 | **In-App Negotiation Engine** | Counter-offer slider on price, quantity, delivery window; max 3 counter rounds per bid | All negotiation logged; ❌ no offline haggling |
| F8 | **Booking Confirmation & Contract** | Digital booking note (terms, price, quantity, date); e-sign via OTP | Auto-generated from winning bid |
| F9 | **Pickup Scheduling** | Calendar slot selection for collection/arrival | Synced to both parties' calendars |
| F10 | **Collection Quality Check** | At pickup: manager scans QR, grades produce, records accepted/rejected qty, uploads photo | Immutable record for disputes |
| F11 | **In-App Chat (post-booking)** | Text + location pin only | See Section D |
| F12 | **Wallet & Payouts** | Payment status (escrow → released on quality acceptance), payout to bank/UPI, transaction history | Escrow release T+0 to T+1 |
| F13 | **Ratings & Reviews** | Rate manager post-transaction (1–5 + tags: punctual / fair grading / payment delay) | Reciprocal |
| F14 | **Order History & Analytics** | Past bookings, avg. realization price vs. mandi benchmark, seasonal trends | Simple charts, offline-friendly |
| F15 | **Seasonal Demand Planner** | Alerts: "Wheat demand spiking in your district next month — pre-list" | Demand-forecast nudges |
| F16 | **Farmer Verification Badge** | Visible KYC status badge on profile | Trust layer |

### A.2 Dairy & Livestock Manager Role Features

| ID | Feature | Description | Notes |
|----|---------|-------------|-------|
| M1 | **Business Profile** | Firm type (co-op / private dairy / livestock trader / aggregator), service radius, procurement capacity (kg/day or head/month) | Verified badge post-KYC |
| M2 | **Demand Posting** | Standing demand orders ("need 500L buffalo milk, fat ≥6%, daily") with price bands | Recurring demand templates |
| M3 | **Bid Submission Engine** | Bid on farmer RFQs: price/kg, quantity, pickup date, transport yes/no, payment terms (instant/credit) | Max 3 counter-rounds (mirrors F7) |
| M4 | **Procurement Route Planner** | Daily pickup queue: multiple farmer stops, optimized order, distance, ETA | Manual/GPS-assisted; ❌ no IoT telematics |
| M5 | **Pickup Team Assignment** | Assign field agent per route; agent sees farmer name, pin, produce, quantity | Agent role = lightweight sub-account |
| M6 | **QR-based Collection Confirmation** | Generate pickup QR; agent scans at farm; grade + accepted qty + photo; farmer confirms via OTP | Same QR anchors both ledgers |
| M7 | **Quality Dispute Flag** | At collection, flag damaged/below-grade produce with photos; triggers partial-payment workflow | Farmer sees flag in real time |
| M8 | **In-App Chat (post-booking)** | Text + location pin | See Section D |
| M9 | **Payments & Escrow Dashboard** | Escrow funding, release on farmer OTP confirmation, credit-term tracking, invoices (GST-compliant PDF) | Auto invoice generation |
| M10 | **Farmer Reliability Score** | Internal score: show-up rate, grade consistency, past disputes | Drives bid priority |
| M11 | **Ratings & Reviews** | Rate farmer post-transaction | Reciprocal |
| M12 | **Market Price Ticker** | District-level mandi prices, platform's avg realized prices | Benchmark for bidding |
| M13 | **Seasonal Supply Forecast** | "Monsoon: milk supply −15% in region X — raise price band" | Sourcing intelligence |
| M14 | **Commission & Payout Statement** | Transparent per-transaction commission deduction, monthly statement export | Revenue transparency |

### A.3 Shared / Core Features

| ID | Feature | Description | Notes |
|----|---------|-------------|-------|
| S1 | **Auth & OTP Login** | Phone OTP + PIN; biometric unlock on device | Phone never displayed to counterpart |
| S2 | **KYC/Document Verification Module** | Capture, upload, status tracking (pending / under review / verified / rejected) | See Section B |
| S3 | **Geo-location & Radius Search** | Farm/business pin, distance filter, serviceability check | Pinned location shown; full address private until booking confirmed? — ❌ **FLAG:** address sharing pre-booking violates G2; address reveals ONLY inside confirmed-booking chat/contract |
| S4 | **In-App Chat** | Text + location pin; unlocked post-confirmation | See Section D |
| S5 | **Escrow Wallet & Payments** | UPI/bank, escrow hold, auto-release rules, refunds | Commission deducted at source |
| S6 | **Booking Lifecycle Engine** | States: RFQ → Bids → Negotiation → Confirmed → Scheduled → In-Pickup → Quality-Checked → Paid → Completed/Cancelled/Disputed | State machine drives everything |
| S7 | **Notifications** | Push + SMS + in-app inbox (bid received, booking confirmed, pickup reminder, payment released, dispute update) | SMS = transactional only, never exposes counterpart number |
| S8 | **Ratings & Reviews System** | 1–5 stars + structured tags; visible on profiles | Post-completion only |
| S9 | **Dispute/Ticket System** | Raise dispute on a booking; admin mediation workflow | NOT a "help/SOS section" — strictly transactional (G4) |
| S10 | **Digital Contracts (Booking Notes)** | Auto-generated term sheet per booking; OTP e-sign; stored as PDF | Legal record |
| S11 | **Search & Filters** | Produce, grade, radius, price, date window | — |
| S12 | **Multi-language Support** | Hindi, English, + regional (Marathi, Telugu, Tamil, Punjabi, Gujarati, Kannada) | Vernacular-first UX |
| S13 | **Offline Mode (Farmer app)** | Draft listings offline; sync on connectivity | Rural connectivity reality |
| S14 | **Trust & Safety** | Report user, profile flags, moderation of chat | See Section D |
| S15 | **Web Dashboard (Manager + Admin)** | React web app; farmers primarily mobile (Android-first, low-RAM build) | — |
| S16 | **Referral Program** | Refer a farmer/manager → credit after first completed transaction | Growth loop |

---

## TASK B — ROLE-BASED ONBOARDING FLOWS

### B.1 Farmer Onboarding (≈7 steps, ~6 minutes with assisted flow)

```
[1] Phone OTP → [2] Choose role: Farmer → [3] Language preference →
[4] Basic profile (name, DOB, gender optional) → [5] Farm/Plot details + location pin →
[6] KYC document upload → [7] Selfie liveness check →
[8] Waiting screen: "Verification in progress (24–48 hrs)" →
[9] Verified badge OR rejection with retry → [10] First listing nudge
```

| Step | Screen | Data Captured | Validation |
|------|--------|---------------|------------|
| 1 | Welcome + OTP | Phone number | Aadhaar-linked number check later; SMS OTP |
| 2 | Role select | Role = Farmer | Single role per account (multi-role later) |
| 3 | Language | Preferred language | Sets app locale |
| 4 | Profile | Name, DOB, profile photo | Name matches KYC doc (OCR cross-check) |
| 5 | Farm registry | Farm name, plot size, produce types, location pin | Pin within serviceable geo-fence |
| 6 | KYC docs | See doc table below | OCR + manual review queue |
| 7 | Selfie liveness | Live selfie | Face-match vs KYC photo |
| 8–10 | Verification gate | Status screen | **Unverified = browse only, CANNOT list or book** |

**Farmer KYC Documents (Indian agri context):**

| Priority | Document | Why | Verification Method |
|----------|----------|-----|---------------------|
| Mandatory | **Aadhaar Card** | Identity + DigiLocker eKYC | DigiLocker API / OTP eKYC |
| Mandatory | **PAN Card** | Payment/tax compliance, TDS | OCR + PAN verification API |
| Mandatory | **Bank Account Details + Cancelled Cheque / Passbook** | Payouts (UPI/bank) | Penny-drop validation (₹1 credit) |
| Conditional | **FPO Membership Certificate** | If selling via FPO | Manual review |
| Conditional | **Land Record / 7/12 Extract (Satbara) / Patta** | Plot ownership validation | State land-record API where available (e.g., Maharashtra Bhulekh), else manual |
| Conditional | **Dairy: Animal Registration / Livestock Census ID / AI-Card (if registered)** | Livestock listings authenticity | Manual review |
| Conditional | **GSTIN** | Only if farmer/firm is GST-registered | GSTN API |
| Optional | **PM-Kisan Registration / PM-KISAN beneficiary ID** | Trust boost | Manual |

### B.2 Dairy & Livestock Manager Onboarding (≈8 steps, 24–72 hr verification SLA)

```
[1] Phone OTP → [2] Role: Manager → [3] Business type (Co-op / Pvt Dairy / Trader / Aggregator) →
[4] Business profile (firm name, GST, capacity, service radius) →
[5] Location pin(s) — collection center / plant → [6] Document upload →
[7] Bank + escrow setup (penny-drop) → [8] Admin verification queue →
[9] Verified → escrow activation → [10] Post first demand order
```

| Step | Screen | Data Captured | Validation |
|------|--------|---------------|------------|
| 1–2 | OTP + role | Phone, role | OTP |
| 3 | Business type | Entity classification | Determines doc checklist |
| 4 | Business profile | Firm name, years in business, daily capacity (kg/heads), radius | Cross-check with GST/business docs |
| 5 | Location | Collection center / plant pin | Geo-fence check |
| 6 | KYC docs | Doc table below | OCR + registry lookups + manual review |
| 7 | Finance | Bank account, escrow funding method | Penny-drop + escrow mandate |
| 8 | Verification gate | — | **Unverified managers cannot bid or post demand** |

**Manager KYC Documents (Indian agri context):**

| Priority | Document | Why | Verification Method |
|----------|----------|-----|---------------------|
| Mandatory | **PAN (individual proprietor + firm)** | Tax identity | PAN API |
| Mandatory | **GST Certificate (GSTIN)** | Business legitimacy; invoicing | GSTN API |
| Mandatory | **Business Registration** — any one: Trade License / Udyam (MSME) Registration / Co-op Society Registration / Partnership Deed / Certificate of Incorporation | Entity proof | Registry lookup / manual |
| Mandatory | **Bank Account + Cancelled Cheque (firm account)** | Escrow + payouts | Penny-drop |
| Mandatory | **FSSAI License** (for dairy processing/handling) | Food-safety compliance — mandatory for milk procurement | FSSAI registry check |
| Mandatory | **Address Proof of Business** — Electricity bill / Rent agreement / Property papers | Operating premise | Manual |
| Conditional | **MPCB / State Pollution Consent** (dairies above threshold) | Plant compliance | Manual |
| Conditional | **Animal Transport Permit (for livestock traders)** — state livestock transport NOC | Livestock movement legality | Manual |
| Conditional | **Milk Union / Dairy Board Affiliation letter** (if co-op member) | Trust boost | Manual |
| Conditional | **APMC / Mandi License** (if aggregator) | Trade license in mandi jurisdiction | Manual |
| Conditional | **Authorized Signatory + Board Resolution** (companies/LLPs) | Signing authority | Manual |

**Onboarding edge rules:**
- Rejected docs → reason code shown (blur/illegible/mismatch/expired) → 3 retry attempts → manual video-KYC fallback.
- Face-match confidence < threshold → human review.
- Same device/phone farming multiple accounts → device fingerprint flag to admin.

---

## TASK C — ADMIN PANEL CAPABILITIES

| Module | Capabilities | Key Details |
|--------|--------------|-------------|
| **C1. Dashboard (Command Center)** | Live KPIs: GMV today, active bookings, bids in flight, dispute count, KYC pending, verification TAT, supply-demand heatmap by district/crop | Real-time + filters (date, region, crop) |
| **C2. KYC Verification Queue** | Queue by role/doc-type; OCR-extracted data side-by-side with document image; face-match score; approve / reject with reason code / escalate; bulk approve; SLA breach alerts (auto-escalate >48 hrs) | Audit trail on every decision |
| **C3. User Management** | Search user, view profile + full document set + booking history + ratings; suspend / ban / reinstate with reason; role change; trust-score override; device-fingerprint linking to detect multi-account fraud | All actions logged |
| **C4. Booking Oversight** | Live booking pipeline (state machine view); drill into any booking: bids, negotiation log, contract, chat transcript (read-only), QR scan events, payment/escrow status; force-cancel with penalty flag | Read-only monitoring; intervention only via dispute or fraud flag |
| **C5. Dispute Resolution Workflow** | Queue → triage (auto-classify: damage / no-show / payment / quality) → evidence bundle auto-assembled (chat, photos, QR log, escrow state) → mediator assigns → verdict options: [full release / partial split / full refund / re-booking credit] → both parties notified → outcome logged | SLA: ack 4 hrs, first response 24 hrs, resolve ≤72 hrs |
| **C6. Commission & Pricing Settings** | Category-wise commission % (e.g., milk 3%, produce 5%, livestock 2%); min/max caps; surge/demand multiplier rules (seasonal, festival windows) with start/end dates + geo-scope; promotional zero-commission campaigns; A/B testing of rates | Changes versioned; effective-dated; never retroactive |
| **C7. Payment & Escrow Ops** | Escrow ledger view; failed payment retry; payout batch runs; refund processing; reconciliation reports vs. payment gateway; TDS statement export | Read-only ledger + action buttons with maker-checker |
| **C8. Content & Notification Management** | Price ticker data curation; seasonal demand planner config; broadcast announcements; notification templates (multi-lingual) | — |
| **C9. Moderation Console** | Chat flagged-message review; user report queue; ban words list management; photo-content review on listings | See Section D |
| **C10. Reports & Compliance** | GST reports, commission revenue reports, farmer/manager cohort analytics, exportable CSV/PDF; data-retention policy controls | — |
| **C11. Role-Based Admin Access** | Super admin / KYC ops / dispute mediator / finance / read-only auditor; all privileged actions dual-logged | Maker-checker for money-moving actions |

---

## TASK D — IN-APP CHAT ARCHITECTURE

### D.1 Lock / Unlock State Machine

```
PRE-BOOKING (LOCKED)                 BOOKING CONFIRMED (UNLOCKED)              POST-COMPLETION
┌──────────────────────┐            ┌──────────────────────────┐            ┌──────────────────────┐
│ Chat tile visible    │   event:   │ Full chat opens:         │  booking   │ Chat auto-archives   │
│ but TAPPED → sheet:  │  booking   │ • text                   │ completes  │ (read-only) after    │
│ "🔒 Connect after    │ confirmed  │ • location pin           │  or        │ 7 days; new chat     │
│  booking" + [Book    │───────────▶│ • template quick-replies │ cancels    │ requires new booking │
│  Now] CTA            │            │ • system messages        │───────────▶│                      │
└──────────────────────┘            └──────────────────────────┘            └──────────────────────┘
        ▲                                                                      dispute → chat stays
   NO contact card, NO number, NO external links — ever, in any state.             open read-only
```

### D.2 Chat Technical Architecture

| Layer | Design |
|-------|--------|
| Transport | WebSocket (Socket.io) with message queue fallback; mobile push via FCM for offline delivery |
| Conversation model | 1 conversation per booking_id (1:1); conversation_id FK to booking; both participants derived from booking |
| Unlock enforcement | Chat service verifies booking.status = CONFIRMED (or later, non-terminal) before any send/read; **server-side check, never client-side** |
| Message types | `text` (max 1000 chars, UTF-8, multilingual), `location_pin` (lat/lng + label), `system` (booking updates, escrow events — read-only gray bubbles), `template_quick_reply` (preset: "Running 30 min late" / "Ready for pickup" / "At the gate") |
| ❌ Blocked types | phone numbers (regex filter blocks + masks), URLs, images/files pre-QR-acceptance, voice notes, calls |
| Message schema | `{id, booking_id, sender_id, type, payload, sent_at, delivered_at, read_at, flagged, edited_deleted}` |
| Storage | Encrypted at rest (AES-256); separate chat DB shard; retention: active + 90 days post-completion, then archive (7-yr if disputed) |
| Read receipts | Single ✓ sent, double ✓✓ delivered, blue ✓✓ read |
| Rate limiting | Max 1 msg / 2 sec / user; burst cap 30/hr pre-pickup |

### D.3 Moderation Rules

| Rule | Action |
|------|--------|
| Phone-number pattern (all Indian formats + worded digits: "nine-eight…") | Block send + warn user (2nd offense: restrict chat 24 hr; 3rd: admin flag) |
| URL / "wa.me" / "telegram" / "whatsapp" keywords | Block + auto-flag to moderation console |
| Abuse lexicon (multi-lingual wordlist) | Mask + flag |
| Image/file attachments | Disabled entirely in v1 (eliminates CSAM/PII leak surface); revisit post-launch with scan pipeline |
| Report button on every message | → Moderation console queue (C9) |

### D.4 Audit Logging

| Event | Logged Fields |
|-------|---------------|
| chat_access_attempt (pre-booking tap) | user_id, booking_id=null, timestamp, client_version |
| message_sent | full payload hash, sender, booking_id, moderation scan result |
| moderation_action | rule triggered, message_id, action taken, moderator_id |
| chat_unlock / lock | booking_id, state transition, actor (system) |
| chat_archive / dispute_retain | booking_id, reason, retention class |
| admin_read_transcript | admin_id, booking_id, timestamp, justification dropdown |

> Logs are append-only, hash-chained, retained per IT Act 2000 / DPDP Act 2023 obligations.

---

## TASK E — EDGE CASES & MITIGATIONS

| # | Edge Case | Scenario | Platform Rule / Mitigation |
|---|-----------|----------|----------------------------|
| E1 | **Farmer cancels after confirmation** | Within 2 hrs: free. 2–24 hrs: 5% of booking value penalty (deducted from wallet). <4 hrs to pickup or after manager en route: 10% + strike on reliability score. >3 strikes/season → listing boost removed | Penalty split: platform commission + manager compensation |
| E2 | **Manager cancels after confirmation** | Any time: full refund to farmer + auto-credit ₹X goodwill + manager reliability score hit + bid-priority demotion for 7 days. Repeated (3+): admin review, possible suspension | Manager bears cancellation cost; farmer auto-matched to next-best bid if RFQ still open |
| E3 | **Farmer no-show (not at farm at slot)** | Manager agent marks no-show with geo + photo evidence. After 15-min grace + 1 in-app ping, booking auto-cancels. Penalty: 10% + reliability strike. Manager compensated from penalty pool | Grace period + evidence mandatory to prevent abuse |
| E4 | **Manager/agent no-show** | Farmer taps "Not arrived" after 30-min grace → booking escalates. Auto-cancel, full refund, manager penalized same as E2 | GPS pin of agent as evidence |
| E5 | **Produce damage / spoilage in transit** | Determined at QR quality-check stage (photo mandatory). Rule: damage attributable to packaging/transport (manager's truck) = manager bears loss, farmer paid in full from manager's escrow. Damage pre-existing (farmer's grading misrepresented) = partial payment per re-graded value, farmer score hit | Photo + grade log at pickup is the arbiter; third-party inspection escalation for high-value (>₹50k) |
| E6 | **Payment dispute (farmer says not paid)** | Escrow ledger is source of truth: show timestamped release + UPI/bank reference. If release failed technically: auto-retry payout, escalate to finance ops (C7). Fraud claims → dispute workflow | Every rupee traceable: booking → escrow → release → payout reference |
| E7 | **Rate negotiation deadlock** | 3 counter-offer rounds max, then "last offer" finality (accept/decline). If declined, RFQ may be re-issued to next bidders. Anti-gaming: manager cannot bid below platform floor price (derived from mandi ticker −X%); collusion detection: same manager + farmer closing >80% of mutual RFQs at off-market prices → flag | Negotiation engine enforces caps; all rounds logged |
| E8 | **Seasonal demand spike (festivals, monsoon milk dip)** | Surge module (C6): dynamic price-floor multipliers, demand-planner nudges (F15/M13), RFQ expiry shortened to increase bid liquidity, manager capacity alerts ("your radius has unmet demand +22%") | Never surge-commission on the farmer side; multipliers capped at 1.5× |
| E9 | **Quality disagreement at pickup** | Farmer disputes manager's re-grade → both submit photos in-app within 2 hrs → auto dispute ticket (C5) with 72-hr SLA; escrow stays locked meanwhile | No cash settlement outside escrow — ever |
| E10 | **Ghost listings / fake produce** | Listing requires verified profile; report-fake button; verified-farmer badge weighting in feed; admin sampling audits | 3 confirmed fakes → ban |
| E11 | **Multi-account / identity fraud** | Device fingerprint + PAN/Aadhaar uniqueness checks in KYC pipeline; admin flag (C3) | — |
| E12 | **Offline at pickup (rural dead zone)** | Offline-tolerant QR scan: agent pre-downloads route pack; QR signs locally, syncs on reconnect; farmer OTP via SMS fallback | Offline is the norm, not the exception |
| E13 | **Chargeback / payment reversal by bank** | Escrow only releases on confirmed events (QR + OTP), so platform liability is low; residual cases → dispute workflow; gateway dispute docs auto-generated | — |
| E14 | **Chat circumvention attempts** (number sharing via text) | Regex + keyword moderation (D.3); warnings → restrictions → suspension ladder | Reinforces G1/G2 |
| E15 | **Manager bankruptcy / escrow default** | Escrow pre-funding mandatory before bidding (funds locked at booking confirm, not after pickup) — platform never pays out of pocket beyond escrow balance | Eliminates counterparty credit risk |
| E16 | **Force majeure (flood, curfew)** | Admin bulk-suspend region; active bookings auto-cancelled, penalty-free, escrow released; notifications broadcast | Ops playbook, not user feature |

---

## APPENDIX — Feature Compliance Audit (Not-To-Do Checklist)

| Feature Temptation | Verdict | Rule Violated |
|--------------------|---------|---------------|
| In-app voice/VoIP call button | ❌ DO NOT BUILD | G3 |
| Masked-number calling layer | ❌ DO NOT BUILD | G3 |
| "Share contact card" in chat | ❌ DO NOT BUILD | G1 |
| WhatsApp deep-link on profile | ❌ DO NOT BUILD | G1 |
| SOS button / emergency help section | ❌ DO NOT BUILD | G4 (dispute tickets ≠ help section) |
| Vehicle GPS telematics / IoT sensors in milk tanks | ❌ DO NOT BUILD | G5 (route planner is software-only, agent-app GPS) |
| Image/file sharing in chat (v1) | ❌ DEFERRED | D.3 (moderation surface) |
| Cash-on-collection option | ❌ DO NOT BUILD (v1) | G6 (all money in escrow) |
| Chat before booking | ❌ DO NOT BUILD | G2 |
| Commission-free "direct deal" side door | ❌ DO NOT BUILD | G6 (disintermediation = revenue leak) |
| Admin-triggered refund to cash/agent | ❌ DO NOT BUILD | G6 (refunds only to source wallet/bank) |

---

*End of blueprint. All ❌ items must be absent from sprint backlogs; compliance reviewed at each sprint planning.*
