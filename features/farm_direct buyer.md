# FarmGate — Farmer ↔ Direct Buyer Marketplace
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
| G5 | No IoT / telemetrics | No device integration, no sensor feeds, no truck telematics hardware | ✅ Enforced |
| G6 | All payments, contracts, negotiations in-platform | Commission-based revenue; escrow wallet; in-app negotiation module | ✅ Enforced |

> ⚠️ **VIOLATION FLAGS:** Any feature marked ❌ in tables below must NOT be built. Audit each sprint backlog against this register.

---

## TASK A — MUST-HAVE FEATURE SET

### A.1 Farmer Role Features

| ID | Feature | Description | Notes |
|----|---------|-------------|-------|
| F1 | **Farm Profile & Plot Registry** | Farm name, plot size, location pin, soil type, irrigation source, FPO membership | Location = pin only; full address never broadcast |
| F2 | **Produce Listing (Harvest Catalog)** | Crop type, variety, grade (A/B/C), quantity (kg/tonnes), harvest date window, photos, expected price band | Price band = min/max acceptable range for negotiation |
| F3 | **Harvest Calendar** | Season-wise expected yields by plot; powers demand-matching nudges | Auto-suggested from crop registry |
| F4 | **Buyer Discovery & Match Feed** | Geo-radius + category search (retail chain / exporter / processor / HoReCa / bulk), rating, distance, procurement volume | Sorted by best-price + reliability score |
| F5 | **Request for Quote (RFQ)** | Farmer sends listing → buyers bid within X hours | Core matching engine |
| F6 | **Bid Comparison View** | Side-by-side bid table: price/kg, quantity, delivery date, transport included?, payment terms, buyer rating | Decision-support table |
| F7 | **In-App Negotiation Engine** | Counter-offer slider on price, quantity, delivery window; max 3 counter rounds per bid | All negotiation logged; ❌ no offline haggling |
| F8 | **Booking Confirmation & Digital Contract** | Auto-generated term sheet (price, grade, qty, delivery/pickup date, transport responsibility); OTP e-sign | Digital booking note = legal record |
| F9 | **Delivery / Pickup Scheduling** | Slot selection; farmer-delivers vs. buyer-pickup mode per booking | Mode declared upfront in RFQ |
| F10 | **Handover Quality Check** | QR scan + grade confirmation + accepted/rejected qty + photo at handover; farmer OTP to lock the record | Immutable ledger entry for disputes |
| F11 | **In-App Chat (post-booking)** | Text + location pin only | See Section D |
| F12 | **Wallet & Payouts** | Escrow status (held → released on handover confirmation), payout to bank/UPI, transaction history | Release T+0 to T+1 |
| F13 | **Ratings & Reviews** | Rate buyer post-transaction (1–5 + tags: punctual / fair grading / on-time payment) | Reciprocal |
| F14 | **Order History & Price Analytics** | Past bookings, avg. realized price vs. mandi benchmark chart, seasonality trends | Offline-friendly charts |
| F15 | **Seasonal Demand Planner** | Alerts: "Onion demand spiking in your district next month — pre-list" | Demand-forecast nudges |
| F16 | **Farmer Verification Badge** | Visible KYC status on profile | Trust layer |

### A.2 Direct Buyer Role Features

| ID | Feature | Description | Notes |
|----|---------|-------------|-------|
| B1 | **Business Profile** | Buyer type (retail chain / supermarket / exporter / food processor / hotel-restaurant-catering / institutional / bulk household co-op), procurement categories, monthly volume, delivery addresses | Verified badge post-KYC |
| B2 | **Demand Posting (Standing Orders)** | Recurring demand templates: "500 kg tomatoes, Grade A, daily, 6 AM delivery, within 40 km" | Repeat-order cloning |
| B3 | **Bid Submission Engine** | Bid on farmer RFQs: price/kg, quantity, delivery/pickup date, transport yes/no, payment terms | Max 3 counter-rounds (mirrors F7) |
| B4 | **Procurement Route Planner** | Multi-farm pickup queue for buyer's fleet; optimized stop order, distance, ETA | Software-only; ❌ no IoT telematics |
| B5 | **Delivery Agent Assignment** | Assign driver/picker per route; agent sees farmer pin, produce, quantity | Lightweight sub-account role |
| B6 | **QR-based Handover Confirmation** | Pickup/delivery QR; agent scans at farm or farmer scans at buyer gate; grade + accepted qty + photo; farmer OTP confirm | Same QR anchors both ledgers |
| B7 | **Quality Dispute Flag** | Flag below-grade/damaged produce with photos at handover; triggers partial-payment workflow | Farmer sees flag in real time |
| B8 | **In-App Chat (post-booking)** | Text + location pin | See Section D |
| B9 | **Payments & Escrow Dashboard** | Escrow pre-funding, release on farmer OTP confirmation, credit terms, GST-compliant invoice PDFs | Auto invoice per booking |
| B10 | **Farmer Reliability Score** | Internal score: show-up rate, grade consistency, dispute history | Drives bid priority |
| B11 | **Ratings & Reviews** | Rate farmer post-transaction | Reciprocal |
| B12 | **Market Price Ticker** | District mandi prices + platform avg realized prices per crop | Benchmark for bidding |
| B13 | **Seasonal Supply Forecast** | "Monsoon: tomato supply −20% in region X — widen price band / extend radius" | Sourcing intelligence |
| B14 | **Commission & Payout Statement** | Per-transaction commission deduction breakdown, monthly exportable statement | Revenue transparency |
| B15 | **Multi-Address / Warehouse Registry** | Delivery centers, godowns, store locations with geo-pins | Radius matching input |
| B16 | **Team Sub-Accounts** | Buyer org: admin, procurement manager, finance viewer roles | RBAC inside buyer account |

### A.3 Shared / Core Features

| ID | Feature | Description | Notes |
|----|---------|-------------|-------|
| S1 | **Auth & OTP Login** | Phone OTP + PIN; biometric unlock | Phone never displayed to counterpart |
| S2 | **KYC / Document Verification Module** | Capture, upload, status tracking (pending / under review / verified / rejected) | See Section B |
| S3 | **Geo-location & Radius Search** | Farm/business pin, distance filter, serviceability check | ❌ Full address reveals ONLY inside confirmed-booking contract/chat |
| S4 | **In-App Chat** | Text + location pin; unlocked post-confirmation | See Section D |
| S5 | **Escrow Wallet & Payments** | UPI/bank, escrow hold, auto-release rules, refunds | Commission deducted at source |
| S6 | **Booking Lifecycle Engine** | States: RFQ → Bids → Negotiation → Confirmed → Scheduled → In-Transit/Handover → Quality-Checked → Paid → Completed / Cancelled / Disputed | State machine drives everything |
| S7 | **Notifications** | Push + transactional SMS + in-app inbox (bid received, booking confirmed, handover reminder, payment released, dispute update) | SMS never exposes counterpart number |
| S8 | **Ratings & Reviews System** | 1–5 stars + structured tags; visible on profiles | Post-completion only |
| S9 | **Dispute/Ticket System** | Raise dispute on a booking; admin mediation | NOT a "help/SOS section" — strictly transactional (G4) |
| S10 | **Digital Contracts (Booking Notes)** | Auto-generated term sheet per booking; OTP e-sign; stored PDF | Legal record |
| S11 | **Search & Filters** | Crop, grade, radius, price, date window | — |
| S12 | **Multi-language Support** | Hindi, English + regional (Marathi, Telugu, Tamil, Punjabi, Gujarati, Kannada, Bengali) | Vernacular-first UX |
| S13 | **Offline Mode (Farmer app)** | Draft listings offline; sync on connectivity | Rural connectivity reality |
| S14 | **Trust & Safety** | Report user, profile flags, chat moderation | See Section D |
| S15 | **Web Dashboard (Buyer + Admin)** | React web app; farmers primarily mobile (Android-first, low-RAM build) | — |
| S16 | **Referral Program** | Refer a farmer/buyer → credit after first completed transaction | Growth loop |

---

## TASK B — ROLE-BASED ONBOARDING FLOWS

### B.1 Farmer Onboarding (≈7 steps, ~6 minutes assisted)

```
[1] Phone OTP → [2] Choose role: Farmer → [3] Language preference →
[4] Basic profile (name, DOB) → [5] Farm/Plot details + location pin →
[6] KYC document upload → [7] Selfie liveness check →
[8] Waiting screen: "Verification in progress (24–48 hrs)" →
[9] Verified badge OR rejection with retry → [10] First listing nudge
```

| Step | Screen | Data Captured | Validation |
|------|--------|---------------|------------|
| 1 | Welcome + OTP | Phone number | SMS OTP; Aadhaar-linked check later |
| 2 | Role select | Role = Farmer | Single role per account |
| 3 | Language | Preferred language | Sets app locale |
| 4 | Profile | Name, DOB, profile photo | Name matches KYC doc (OCR cross-check) |
| 5 | Farm registry | Farm name, plot size, crops, location pin | Pin within serviceable geo-fence |
| 6 | KYC docs | Doc table below | OCR + manual review queue |
| 7 | Selfie liveness | Live selfie | Face-match vs KYC photo |
| 8–10 | Verification gate | Status screen | **Unverified = browse only; CANNOT list or book** |

**Farmer KYC Documents (Indian agri context):**

| Priority | Document | Why | Verification Method |
|----------|----------|-----|---------------------|
| Mandatory | **Aadhaar Card** | Identity + eKYC | DigiLocker API / OTP eKYC |
| Mandatory | **PAN Card** | Payment/tax compliance, TDS | OCR + PAN verification API |
| Mandatory | **Bank Account + Cancelled Cheque / Passbook** | Payouts | Penny-drop (₹1 credit) |
| Conditional | **Land Record / 7-12 Extract (Satbara) / Patta / Khatian** | Plot ownership | State land-record API where available (Maharashtra Bhulekh, Andhra Meebhoomi, etc.), else manual |
| Conditional | **FPO Membership Certificate** | If selling via FPO | Manual review |
| Conditional | **e-NAM / APMC Registration** | If registered trader-farmer | Manual |
| Conditional | **GSTIN** | Only if GST-registered | GSTN API |
| Optional | **PM-Kisan Beneficiary ID** | Trust boost | Manual |

### B.2 Direct Buyer Onboarding (≈8 steps, 24–72 hr verification SLA)

```
[1] Phone OTP → [2] Role: Buyer → [3] Buyer type (Retail / Exporter / Processor / HoReCa / Institutional / Bulk) →
[4] Business profile (firm name, GST, categories, monthly volume, delivery addresses + pins) →
[5] Document upload → [6] Bank + escrow setup (penny-drop) →
[7] Admin verification queue → [8] Verified → escrow activation → [9] Post first demand order
```

| Step | Screen | Data Captured | Validation |
|------|--------|---------------|------------|
| 1–2 | OTP + role | Phone, role | OTP |
| 3 | Buyer type | Entity classification | Determines doc checklist + commission tier |
| 4 | Business profile | Firm name, years, categories, volume, address pins | Cross-check with business docs |
| 5 | KYC docs | Doc table below | OCR + registry lookups + manual review |
| 6 | Finance | Bank account, escrow funding method | Penny-drop + escrow mandate |
| 7 | Verification gate | — | **Unverified buyers cannot bid or post demand** |

**Buyer KYC Documents (Indian agri context):**

| Priority | Document | Why | Verification Method |
|----------|----------|-----|---------------------|
| Mandatory | **PAN (proprietor + firm)** | Tax identity | PAN API |
| Mandatory | **GST Certificate (GSTIN)** | Business legitimacy; invoicing | GSTN API |
| Mandatory | **Business Registration** — any one: Udyam (MSME) / Trade License / Shops & Establishments Certificate / Partnership Deed / COI (company/LLP) | Entity proof | Registry lookup / manual |
| Mandatory | **Bank Account + Cancelled Cheque (firm account)** | Escrow + payouts | Penny-drop |
| Mandatory | **Address Proof of Business** — Electricity bill / Rent agreement / Property papers | Operating premise | Manual |
| Conditional | **FSSAI License** (food businesses: retail chains, processors, HoReCa) | Food-safety compliance | FSSAI registry check |
| Conditional | **Import-Export Code (IEC)** (exporters) | Export legality | DGFT IEC lookup |
| Conditional | **APMC / Mandi License** (if operating in mandi yards) | Trade license | Manual |
| Conditional | **APEDA / Spices Board / Tea-Coffee Board registration** (commodity-specific exporters) | Commodity export compliance | Registry check |
| Conditional | **Drug/Agri-input licenses** — not needed for produce buying (excluded scope) | — | — |
| Conditional | **Authorized Signatory + Board Resolution** (companies/LLPs) | Signing authority | Manual |

**Onboarding edge rules:**
- Rejected docs → reason code (blur/illegible/mismatch/expired) → 3 retries → manual video-KYC fallback.
- Face-match below threshold → human review.
- Device fingerprint flags multi-account farming.
- Exporters trigger enhanced due-diligence tier (IEC + commodity board + longer SLA).

---

## TASK C — ADMIN PANEL CAPABILITIES

| Module | Capabilities | Key Details |
|--------|--------------|-------------|
| **C1. Dashboard (Command Center)** | Live KPIs: GMV today, active bookings, open bids, dispute count, KYC pending, verification TAT, supply-demand heatmap by district/crop | Real-time + filters (date, region, crop) |
| **C2. KYC Verification Queue** | Queue by role/doc-type; OCR data side-by-side with document; face-match score; approve / reject with reason code / escalate; bulk approve; SLA breach alerts (auto-escalate >48 hrs) | Audit trail on every decision |
| **C3. User Management** | Search user; profile + documents + booking history + ratings; suspend / ban / reinstate with reason; role change; trust-score override; device-fingerprint multi-account detection | All actions logged |
| **C4. Booking Oversight** | Live pipeline (state machine view); drill into any booking: bids, negotiation log, contract, chat transcript (read-only), QR events, escrow status; force-cancel with penalty flag | Read-only monitoring; intervention only via dispute/fraud flag |
| **C5. Dispute Resolution Workflow** | Queue → auto-classify (damage / no-show / payment / quality / delivery) → evidence bundle auto-assembled (chat, photos, QR log, escrow state) → mediator assigns → verdict: [full release / partial split / full refund / re-booking credit] → notify both parties → log outcome | SLA: ack 4 hrs, first response 24 hrs, resolve ≤72 hrs |
| **C6. Commission & Pricing Settings** | Category-wise commission % (perishable vs. non-perishable tiers); min/max caps; surge/demand multipliers (seasonal, festival windows) with start/end + geo-scope; promotional zero-commission campaigns; A/B rate testing | Versioned, effective-dated, never retroactive |
| **C7. Payment & Escrow Ops** | Escrow ledger; failed-payment retry; payout batches; refunds; gateway reconciliation; TDS statement export | Read-only ledger + maker-checker actions |
| **C8. Content & Notification Management** | Price ticker curation; demand-planner config; broadcasts; multi-lingual notification templates | — |
| **C9. Moderation Console** | Flagged-chat review; user report queue; ban-words list (multi-lingual); listing photo review | See Section D |
| **C10. Reports & Compliance** | GST reports, commission revenue, buyer/farmer cohort analytics, CSV/PDF exports; retention-policy controls | — |
| **C11. Role-Based Admin Access** | Super admin / KYC ops / dispute mediator / finance / read-only auditor; dual-logged privileged actions | Maker-checker for money movement |

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
| Transport | WebSocket (Socket.io) + queue fallback; FCM push for offline delivery |
| Conversation model | 1 conversation per booking_id (1:1); participants derived from booking |
| Unlock enforcement | Chat service verifies booking.status = CONFIRMED (or later, non-terminal) before send/read; **server-side check, never client-side** |
| Message types | `text` (max 1000 chars, UTF-8, multilingual), `location_pin` (lat/lng + label), `system` (booking/escrow events — read-only gray bubbles), `template_quick_reply` (preset: "Running 30 min late" / "Ready for handover" / "At the gate") |
| ❌ Blocked types | phone numbers (regex + mask), URLs, images/files in v1, voice notes, calls |
| Message schema | `{id, booking_id, sender_id, type, payload, sent_at, delivered_at, read_at, flagged, edited_deleted}` |
| Storage | AES-256 at rest; sharded chat DB; retention: active + 90 days post-completion (7-yr if disputed) |
| Read receipts | ✓ sent, ✓✓ delivered, blue ✓✓ read |
| Rate limiting | Max 1 msg / 2 sec / user; burst cap 30/hr pre-handover |

### D.3 Moderation Rules

| Rule | Action |
|------|--------|
| Phone-number pattern (all Indian formats + worded digits) | Block send + warn (2nd offense: 24-hr chat restriction; 3rd: admin flag) |
| URL / "wa.me" / "telegram" / "whatsapp" keywords | Block + auto-flag to moderation console |
| Abuse lexicon (multi-lingual wordlist) | Mask + flag |
| Image/file attachments | Disabled in v1 (eliminates PII-leak surface); revisit post-launch with scan pipeline |
| Report button on every message | → Moderation console queue (C9) |

### D.4 Audit Logging

| Event | Logged Fields |
|-------|---------------|
| chat_access_attempt (pre-booking tap) | user_id, booking_id=null, timestamp, client_version |
| message_sent | payload hash, sender, booking_id, moderation scan result |
| moderation_action | rule triggered, message_id, action, moderator_id |
| chat_unlock / lock | booking_id, state transition, actor (system) |
| chat_archive / dispute_retain | booking_id, reason, retention class |
| admin_read_transcript | admin_id, booking_id, timestamp, justification |

> Logs append-only, hash-chained, retained per IT Act 2000 / DPDP Act 2023.

---

## TASK E — EDGE CASES & MITIGATIONS

| # | Edge Case | Scenario | Platform Rule / Mitigation |
|---|-----------|----------|----------------------------|
| E1 | **Farmer cancels after confirmation** | ≤2 hrs: free. 2–24 hrs: 5% penalty. <4 hrs to handover / after buyer agent en route: 10% + reliability strike. >3 strikes/season → feed de-boost | Penalty split: commission + buyer compensation |
| E2 | **Buyer cancels after confirmation** | Full farmer refund + goodwill credit + buyer score hit + bid demotion 7 days. Repeat (3+) → admin review / suspension | Farmer auto-matched to next-best open bid |
| E3 | **Farmer no-show at handover slot** | Agent marks no-show with geo + photo; 15-min grace + in-app ping; auto-cancel. 10% penalty + strike | Evidence mandatory to prevent abuse |
| E4 | **Buyer agent no-show** | Farmer taps "Not arrived" after 30-min grace → escalate; auto-cancel, full refund, buyer penalized as E2 | Agent GPS pin as evidence |
| E5 | **Produce damage in transit** | Handover-stage photo + grade log is arbiter. Transport-fault (buyer fleet/packaging) = buyer bears loss, farmer paid in full from escrow. Pre-existing defect (mis-graded listing) = partial payment at re-graded value + farmer score hit | Third-party inspection for >₹50k bookings |
| E6 | **Payment dispute (farmer says not paid)** | Escrow ledger = source of truth: release timestamp + UPI/bank reference. Technical failure → auto-retry payout → finance ops. Fraud claims → dispute workflow | Every rupee traceable: booking → escrow → release → payout ref |
| E7 | **Rate negotiation deadlock** | 3 counter-rounds max → "last offer" finality (accept/decline). Declined → RFQ re-opens to next bidders. Anti-gaming: bids below platform floor (mandi ticker −X%) rejected; collusion detection: same buyer+farmer closing >80% mutual RFQs at off-market prices → flag | Negotiation engine enforces caps; all rounds logged |
| E8 | **Seasonal demand spike (festivals, wedding season, monsoon supply dip)** | Surge module (C6): dynamic price-floor multipliers, demand-planner nudges (F15/B13), shortened RFQ expiry for bid liquidity, capacity alerts ("unmet demand +22% in your radius") | Multipliers capped at 1.5×; never surge-commission farmers |
| E9 | **Quality disagreement at handover** | Farmer disputes re-grade → both submit photos within 2 hrs → auto dispute ticket (C5), escrow locked, 72-hr SLA | No settlement outside escrow — ever |
| E10 | **Ghost listings / fake produce** | Verified profile required to list; report-fake button; badge-weighted feed; admin sampling audits | 3 confirmed fakes → ban |
| E11 | **Multi-account / identity fraud** | Device fingerprint + PAN/Aadhaar uniqueness in KYC pipeline; admin flag (C3) | — |
| E12 | **Offline at handover (rural dead zone)** | Offline-tolerant QR: agent pre-downloads route pack; local-signed QR, sync on reconnect; farmer OTP via SMS fallback | Offline is the norm, not the exception |
| E13 | **Chargeback / bank reversal** | Escrow releases only on confirmed events (QR + OTP); residual cases → dispute workflow; gateway dispute docs auto-generated | — |
| E14 | **Chat circumvention (number sharing)** | Regex + keyword moderation (D.3); warning → restriction → suspension ladder | Reinforces G1/G2 |
| E15 | **Buyer escrow default** | Escrow pre-funding mandatory before bidding; funds locked at confirmation, not after delivery — platform never pays out of pocket beyond escrow balance | Eliminates counterparty credit risk |
| E16 | **Force majeure (flood, curfew, bandh)** | Admin bulk-suspend region; active bookings auto-cancel penalty-free; escrow released; broadcast notifications | Ops playbook, not user feature |
| E17 | **Buyer rejects entire consignment post-acceptance** | OTP-accepted handover is final; post-acceptance rejection only via dispute with evidence; repeated bad-faith rejections → buyer demotion/ban | OTP = farmer protection mechanism |
| E18 | **Partial acceptance (grade mix within one lot)** | Split ledger entry: accepted qty paid at bid price; rejected qty at re-graded rate or rejected; both lines visible in contract PDF | Transparency prevents he-said-she-said |

---

## APPENDIX — Feature Compliance Audit (Not-To-Do Checklist)

| Feature Temptation | Verdict | Rule Violated |
|--------------------|---------|---------------|
| In-app voice/VoIP call button | ❌ DO NOT BUILD | G3 |
| Masked-number calling layer | ❌ DO NOT BUILD | G3 |
| "Share contact card" in chat | ❌ DO NOT BUILD | G1 |
| WhatsApp deep-link on profile | ❌ DO NOT BUILD | G1 |
| SOS button / emergency help section | ❌ DO NOT BUILD | G4 (dispute tickets ≠ help section) |
| Truck GPS telematics / IoT sensors | ❌ DO NOT BUILD | G5 (route planner is software-only agent-app GPS) |
| Image/file sharing in chat (v1) | ❌ DEFERRED | D.3 (moderation surface) |
| Cash-on-delivery option | ❌ DO NOT BUILD (v1) | G6 (all money in escrow) |
| Chat before booking | ❌ DO NOT BUILD | G2 |
| Commission-free "direct deal" side door | ❌ DO NOT BUILD | G6 (disintermediation = revenue leak) |
| Admin cash/agent refunds | ❌ DO NOT BUILD | G6 (refunds only to source wallet/bank) |

---

*End of blueprint. All ❌ items must be absent from sprint backlogs; compliance reviewed at each sprint planning.*
