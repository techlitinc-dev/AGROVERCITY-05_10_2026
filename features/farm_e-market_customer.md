# Farm ↔ e-Market Customer Aggregation Platform — Feature Specification

**Version:** 1.0 | **Date:** 2026-09-29 | **Author:** Senior Product Architect (Agri-Tech + Mobility)
**Business Model:** Commission-based marketplace. All discovery, negotiation, booking, contract, and payment occur in-app.
**Compliance Gates (non-negotiable):**
- G1: In-app chat **locked until booking is confirmed**. Zero communication channel pre-confirmation.
- G2: **No VoIP calling, no phone number sharing, no external links, no WhatsApp redirects** at any point.
- G3: **No SOS/help-section feature, no IoT/telemetrics** integration anywhere.
- G4: No payment, contract, or negotiation outside platform rails.

> ⚠️ **Flag convention used throughout:** 🔴 = violates G1–G4 if implemented → **BLOCKED**. ✅ = compliant.

---

## A. MUST-HAVE FEATURE SET

### A.1 Farmer Role Features

| # | Feature | Description | Compliance |
|---|---------|-------------|------------|
| F1 | Farmer profile & farm catalog | Name, photo, farm location (approximate pin), crops grown, harvest calendar, certifications (organic/GAP/IndiaGAP, FSSAI for processed), historical ratings | ✅ |
| F2 | Produce listing creation | Crop name, variety, grade, quantity (kg/quintal/tonne), price expectation (floor + ceiling), harvest date, photos (up to 6), pack type, storage availability | ✅ |
| F3 | Listing lifecycle management | Draft → Live → Booked → Completed/Expired/Cancelled; auto-expiry after harvest window; bulk re-listing for repeat seasons | ✅ |
| F4 | Availability calendar | Blocked dates (harvested out, monsoon, sowing), seasonal capacity forecast | ✅ |
| F5 | Bid/quote inbox (one-way inbound only) | e-market customers submit **binding price quotes** against a live listing; farmer accepts/rejects/counters **inside the quote workflow** — no free-form contact | ✅ |
| F6 | Booking confirmation & job board | Confirmed orders with pickup slot, quantity, price, customer identity (masked until confirmation), delivery mode | ✅ |
| F7 | In-app chat (post-confirmation) | Text, produce photos, location pin; audit-logged (see D) | ✅ |
| F8 | Digital contract & e-sign | Auto-generated order contract (quantity, grade, price, delivery terms, damage liability split); Aadhaar-eSign / OTP consent | ✅ |
| F9 | Logistics mode selection | Farmer delivers / customer picks up / platform-partnered transport slot (commission applies) | ✅ |
| F10 | Digital payment wallet | Escrow receipt on booking; payout to bank/UPI after delivery acceptance; ledger & payout history | ✅ |
| F11 | Delivery QR handover | Generate one-time QR at pickup; scan at drop-off to prove custody transfer; geotag + timestamp | ✅ |
| F12 | Produce quality report upload | Grading certificate, lab report, moisture reading (manual entry, not IoT) at packing | ✅ |
| F13 | Ratings & reviews (bidirectional) | Rate customer post-order; flag patterns (repeat no-shows) visible internally | ✅ |
| F14 | Notifications | Quote received, booking confirmed, pickup reminder (T-24h, T-2h), payout released | ✅ |
| F15 | Seasonal demand heatmap (in-app) | Demand index by crop/city so farmer plans sowing — derived from anonymized order data | ✅ |

**Explicitly NOT built for Farmer:** phone-number reveal, voice/VoIP call button, "call customer" CTA, WhatsApp share, emergency/SOS button, sensor/telematics dashboard, device tracking of customers. 🔴 BLOCKED.

### A.2 e-Market Customer Role Features

| # | Feature | Description | Compliance |
|---|---------|-------------|------------|
| C1 | Customer profile | Business name, buyer type (retail chain / mandi trader / processor / exporter / restaurant aggregator), GSTIN, procurement zones, credit preference | ✅ |
| C2 | Multi-crop demand posting | Standing demand: crop, grade, qty, target price band, delivery window, recurring frequency (daily/weekly/seasonal) | ✅ |
| C3 | Discovery & search | Filter by crop, variety, grade, distance band, harvest date, price, certification; saved searches & alerts | ✅ |
| C4 | Quote submission (binding) | Structured quote against listing or demand-match; deposit required for high-value orders (escrow) | ✅ |
| C5 | Negotiation console | Counter-quote rounds (max 3 per order), price-lock timers, platform-suggested fair-price band from historical transaction data | ✅ |
| C6 | Booking & order management | Cart across multiple farmers (split shipments), order status timeline, reschedule request workflow | ✅ |
| C7 | In-app chat (post-confirmation) | Text, vehicle/loading photos, location pin share for pickup coordination | ✅ |
| C8 | Inspection & acceptance flow | Checklist at delivery (quantity, grade match, damage %); accept / partial accept with deduction / reject with evidence photos | ✅ |
| C9 | Payments | Escrow funding via UPI/cards/netbanking, invoices (auto-GST), credit ledger for verified business buyers, TDS reports | ✅ |
| C10 | Dispute filing | Evidence-based dispute within acceptance window (see E) | ✅ |
| C11 | Supplier favorites & repeat-order shortcuts | One-tap re-book from past order; price alert when favorite farmer lists | ✅ |
| C12 | Ratings & reviews | Rate farmer on quality/accuracy; drives ranking | ✅ |
| C13 | Seasonal procurement planner | Calendar view of historical prices by crop/city to plan pre-booking before spikes | ✅ |

**Explicitly NOT built for Customer:** farmer phone reveal, voice call, off-platform payment instructions, external link sharing in chat, SOS, live vehicle telematics. 🔴 BLOCKED.

### A.3 Shared / Core Marketplace Features

| # | Feature | Description | Compliance |
|---|---------|-------------|------------|
| S1 | Role-based auth & RBAC | Farmer / Customer / Admin / Ops / Finance roles; device binding, session controls | ✅ |
| S2 | KYC engine (see B) | Document upload, OCR pre-fill, vendor verification APIs, manual review queue | ✅ |
| S3 | Listing & demand matching engine | Rule-based + ranking model (price, distance, grade match, rating, freshness) | ✅ |
| S4 | Structured negotiation engine | Quote → counter → accept/expire; full state machine with audit trail; NO free-text pre-booking contact | ✅ |
| S5 | Booking state machine | REQUESTED → QUOTING → CONFIRMED → IN_FULFILLMENT → DELIVERED → SETTLED / CANCELLED / DISPUTED | ✅ |
| S6 | Escrow & commission engine | Auto commission split at settlement; surge/seasonal multiplier rules (admin-set); refunds to source | ✅ |
| S7 | In-app chat service (see D) | Locked/unlocked gate, message types, moderation, retention policy | ✅ |
| S8 | Notification service | Push, SMS (transactional only — OTP, booking alerts; **no phone-number content sharing**), email | ✅ |
| S9 | Pricing intelligence | Anonymized benchmark prices by crop/mandi/grade, surfaced to both sides during negotiation | ✅ |
| S10 | Reviews & reputation system | Weighted scoring, anti-brigading, dispute-affected reviews frozen until resolution | ✅ |
| S11 | Audit & compliance logging | Immutable event log of every quote, message, payment, handover, admin action | ✅ |
| S12 | Content & doc management | Listing media, KYC docs, contract PDFs, evidence bundles with retention schedule | ✅ |
| S13 | Multilingual UI | English + Hindi (+ regional: Marathi, Telugu, Tamil, Punjabi) with voice-to-text input in chat | ✅ |

**Blocked from Shared layer (🔴):** any "Contact support via call", click-to-call, number masking that reveals actual numbers, help-center with phone numbers, IoT sensor ingestion, driver/telematics SDKs, external payment links.

---

## B. ROLE-BASED ONBOARDING FLOWS (with Indian KYC)

### B.1 Farmer Onboarding

| Step | Screen / Action | KYC & Verification Detail | Gate |
|---|---|---|---|
| 1 | Mobile OTP login | +91 mobile number; SMS only for OTP (no number exposure to other users) | Pass → Step 2 |
| 2 | Role selection & language | Choose "Farmer"; pick language | — |
| 3 | Identity (Individual) | **Documents:** (a) Aadhaar (UIDAI VID accepted; number masked, only last 4 stored), OR (b) PAN card; selfie liveness check matched to ID photo | Auto-verify via CKYCR/DigiLocker-style API + liveness; fail → manual queue |
| 4 | Identity (Entity option) | If farming as FPO/company/partnership: **Documents:** (a) FPO registration / Certificate of Incorporation, (b) PAN of entity, (c) authorized signatory Aadhaar + board resolution | Manual review |
| 5 | Land & farm verification | **Documents:** (a) Land record extract (7/12 utara / khatauni / pahani / RTC per state), (b) optional lease agreement if tenant farmer | OCR + state record cross-check; field-agent visit for high-value sellers |
| 6 | Bank account | **Documents/fields:** (a) Cancelled cheque or bank passbook photo, (b) IFSC; penny-drop verification for account ownership | Auto penny-drop |
| 7 | Farm & produce profile | Farm pin (approximate, privacy-buffered), crops, expected harvest | — |
| 8 | Compliance attestations | Accept platform rules: no off-platform dealing, no number sharing, arbitration clause | Mandatory checkbox + OTP consent |
| 9 | Activation | KYC badge: Verified / Verified-FPO / Pending | **Listing disabled until at least Individual KYC + bank = Verified** |

### B.2 e-Market Customer Onboarding

| Step | Screen / Action | KYC & Verification Detail | Gate |
|---|---|---|---|
| 1 | Mobile OTP login | +91 mobile; email capture | Pass → Step 2 |
| 2 | Role selection & buyer type | Retail chain / Mandi trader / Processor / Exporter / HoReCa aggregator / Institutional | — |
| 3 | Business identity | **Documents:** (a) GSTIN certificate (GST verification API auto-check), (b) PAN of proprietor/firm/company, (c) Udyam registration (MSME) if applicable | Auto GST validation; mismatch → manual |
| 4 | Business constitution | Proprietorship: proprietor Aadhaar + self-declaration. Partnership/LLP/Company: (a) Partnership deed / MOA-AOA, (b) board resolution / authorized signatory proof, (c) signatory Aadhaar | Manual review |
| 5 | Trade license / mandi license | **Documents:** (a) Shop & Establishment or trade license, (b) **APMC/mandi commission agent license (state-specific, e.g., Delhi Agricultural Produce Marketing Board license, Karnataka APMC license) if buying through mandi channel**, (c) FSSAI license if food processing/retail | Auto FSSAI API check; license mandatory for mandi-linked buyers |
| 6 | Financials & credit | Bank statement 6 months (optional, for platform credit line); cancelled cheque | Penny-drop |
| 7 | Delivery & warehouse addresses | GST-registered address + delivery addresses, geotagged | — |
| 8 | Compliance attestations | Anti-hoarding declaration, no off-platform dealing clause | Mandatory |
| 9 | Activation | KYC badge: Verified-Business / Pending | **Quoting disabled until GST + PAN = Verified; mandi license required for mandi-linked category** |

---

## C. ADMIN PANEL CAPABILITIES

| # | Module | Capabilities | Compliance Notes |
|---|--------|------------|------------------|
| A1 | KYC verification queue | Filter by role/status/risk score; side-by-side doc viewer + OCR extraction; approve/reject with reason codes; request re-upload; bulk approve; audit trail per decision | No customer PII visible to other users ever |
| A2 | User management | Search/suspend/ban users; role change approval; device/session revocation; rating recalculation after ban; strike system (3 strikes = suspend) | — |
| A3 | Booking oversight | Live order board with state machine status; drill into any order (quotes, chat transcript read-only, payment ledger, handover QR events); force-cancel with refund rule override (dual approval) | Admin chat access is read-only audit, not a channel |
| A4 | Dispute resolution workflow | Queue → auto-assignment → evidence bundle view → resolution console (refund %, partial payment, re-delivery order) → binding resolution letter to both parties; SLA timers; escalation tiers (L1 ops → L2 arbitrator) | No "call the parties" option — resolution is in-app document-based (G1/G2) |
| A5 | Commission & surge settings | Commission % per crop category, per order value slab, per delivery mode; seasonal surge multiplier calendar (e.g., tomato spike window); promo/commission-waiver campaigns; effective-date preview | — |
| A6 | Payout & settlement ops | Escrow release/reversals, T+ settlement batches, failed payout retry, TDS challan export, finance reconciliation report | — |
| A7 | Pricing intelligence admin | Benchmark price ingestion (agmarknet/mandi board feeds as reference data), anomaly detection alerts, negotiation band guardrails | Reference data only; no IoT |
| A8 | Content moderation | Chat moderation console (flagged messages, banned-phrase hits, image review), listing takedown, user-generated content policy enforcement | — |
| A9 | Config & policy | Cancellation policy windows, no-show penalties, damage liability matrix, notification templates (transactional), regional language content | — |
| A10 | Reports & analytics | GMV, take-rate, fill rate, dispute rate, cohort retention, seasonality dashboards; data export (anonymized) | — |
| A11 | Audit log browser | Immutable event search (actor, entity, action, before/after); tamper-evident hashing; retention: financial 8 years, chat 3 years, KYC per DPDP Act consent | — |

**Blocked in Admin (🔴):** click-to-call or call-center dialer to user numbers, WhatsApp outreach tools, telematics map, SOS incident panel.

---

## D. IN-APP CHAT ARCHITECTURE

### D.1 Gate & State Model

| State | Who can message | Trigger |
|---|---|---|
| `LOCKED_NO_THREAD` | Nobody | Listing/demand view — no chat UI rendered at all (not even a disabled box with placeholder text implying contact) |
| `LOCKED_PENDING` | Nobody | Quote submitted / negotiation ongoing — chat entry point does not exist |
| `UNLOCKED` | Both parties | Automatic on booking state = CONFIRMED; thread bound to order_id + both user_ids |

**Critical rule:** The chat thread is created **server-side** at confirmation. Clients cannot create threads via API — server endpoint `POST /threads` is admin/system-only. Frontend never renders a composer pre-confirmation.

### D.2 Message Types

| Type | Payload | Restrictions |
|---|---|---|
| `text` | UTF-8, multilingual, ≤2000 chars | Banned-phrase filter (phone patterns, WhatsApp/Telegram/social handles, URLs, "call me", UPI IDs, payment keywords like "paytm/gpay" + number combos); blocked messages rejected with neutral reason |
| `image` | Produce photos, vehicle/loading photos, damage evidence; ≤10 MB, JPEG/PNG/HEIC | On-device + server NSFW/spam ML scan; metadata strip (EXIF geotag removed) |
| `location_pin` | Lat/long + label ("farm gate", "collection center") | Only via system location picker — no free text that could encode contact info; pin auto-expires after delivery |
| `system` | Order events injected into thread (booking confirmed, pickup in 2h, QR scanned, payout released) | Non-editable, non-deletable by users |

**Anti-circumvention layer (applies to ALL message types):**
- Regex + ML detector for phone numbers (Indian formats, worded numbers "nine eight seven…"), UPI handles, email addresses, URLs, social handles.
- Quarantine queue: flagged messages hidden from recipient, sent to moderation within 60s; 3 confirmed violations → chat suspended for that order + user strike.
- Image OCR: text found in images scanned same as `text`.

### D.3 Moderation Pipeline

```
Client send → WAF → AuthZ (thread participant? thread unlocked?) →
  ├─ Text: banned-phrase regex → ML spam/contact classifier → publish / quarantine
  ├─ Image: malware scan → NSFW/spam ML → OCR contact detection → publish / quarantine
  └─ Location: schema validation → publish
Quarantined → Moderator console (60s SLA) → release / block / escalate strike
All events → Immutable audit log (hash-chained)
```

### D.4 Audit Logging

| Field | Detail |
|---|---|
| Event records | thread_created, message_sent (type, hash, length — **message body encrypted at rest**, decryptable only via legal/compliance process), message_flagged, moderation_action, thread_frozen |
| Metadata | actor_id, order_id, timestamp (UTC+IST), device_id, IP, client version |
| Storage | WORM object storage; retention: 3 years active + 5 years archive; access requires dual-control admin approval; every access itself logged |
| Export | Case-bundle export for disputes (evidence bundle referenced in C4) |

### D.5 Technical shape

- **Transport:** WebSocket (persistent) + REST fallback; message fan-out via queue (e.g., Redis Streams/Kafka topic `chat.events`).
- **Storage:** messages in per-shard relational/NoSQL store; hot threads cached; media in object storage with signed URLs (15-min TTL).
- **Scale:** partition by order_id; target p95 delivery < 300 ms; offline fan-out via push + SMS notification (SMS contains no message content and no numbers).
- **Read receipts & typing:** supported post-unlock only.

🔴 **Blocked by design:** any voice note / audio message transport, call signaling (WebRTC), message content delivered via SMS, number-masking bridge APIs (Twilio-style), contact-card attachments.

---

## E. EDGE CASES & RESOLUTION RULES

| # | Edge Case | Detection | Platform Rule | Money Movement |
|---|---|---|---|---|
| E1 | **Farmer cancels after confirmation, pre-pickup** | Manual cancel action | Free cancellation ≤2h after confirm; >2h: 2% of order value penalty (deducted from future payout) + auto-relist suggestion to customer | Full escrow refund to customer |
| E2 | **Customer cancels after confirmation** | Manual cancel action | ≤4h free; 4–24h: 5% penalty; <2h to pickup: 10% (covers farmer prep/harvest lock) | Penalty → farmer compensation; rest refunded |
| E3 | **Farmer no-show at pickup slot** | QR not generated within slot +2h; no reschedule accepted | Order auto-cancelled; farmer strike +1; no-show fee 10% of order value | Fee → customer credit; full refund |
| E4 | **Customer no-show / pickup not completed** | Drop-off QR unscanned within delivery window +24h | Auto-delivery-attempted flag; storage fee ₹X/day (admin config); after 72h: deemed delivered OR cancelled per policy | Escrow released to farmer minus storage fees after deemed delivery |
| E5 | **Produce damage / grade mismatch in transit (farmer delivers)** | Customer inspection checklist + evidence photos; optional platform QC partner report | Damage ≤5%: normal settlement. 5–20%: pro-rata deduction from farmer payout. >20% or grade mismatch: dispute (E8); farmer liable unless packaging compliance proven | Pro-rata / partial release via dispute ruling |
| E6 | **Damage during customer pickup (self-collect)** | QR handover + farmer photos at packing | Custody transfers at QR scan → risk passes to customer; damage claims post-handover rejected unless fraud evidence | Full release to farmer at handover |
| E7 | **Payment dispute (customer claims non-delivery / farmer claims non-payment)** | Chargeback or in-app dispute filing within 72h of delivery | Evidence bundle: chat + QR events + geotags + photos → arbitration (C4). Fraud: account freeze | Freeze escrow until ruling; ruling splits per liability matrix |
| E8 | **Rate negotiation deadlock** | 3 counter rounds exhausted | Platform fair-price band nudge; if still deadlocked, quote expires (24h); no manual haggling allowed off rails | No funds move until CONFIRMED |
| E9 | **Seasonal demand spike (e.g., onion/tomato crisis)** | Price-band anomaly detection vs benchmark | Surge multiplier (admin-set) caps commission, NOT price; max order quantity per buyer (anti-hoarding); listing freshness boost for small farmers | Standard escrow; spike surcharge disclosed in invoice |
| E10 | **Duplicate bookings / double-sold inventory** | Quantity ledger per listing (atomic decrement at CONFIRMED) | Impossible to overbook at DB level (unique constraint + transactional decrement); race losers see listing auto-close | N/A — prevented structurally |
| E11 | **Chat abuse / contact-info leak attempts** | Moderation flags | Strikes; chat suspension; repeat → account suspension | No direct money impact |
| E12 | **Farmer delivers partial quantity** | Delivery checklist actual qty | Settlement = accepted qty × locked price; shortfall % recorded in farmer rating | Pro-rata release |
| E13 | **Weather event / force majeure** | Farmer attestation + admin verification (IMD alert cross-check) | Cancellation without penalty; one-time grace per season; listing suspended in affected pin codes | Full refund, no strike |
| E14 | **Refund to expired/s blocked payment source** | Payout failure | Retry T+1, T+3; fallback to verified bank account (same KYC owner only) | Ledger holds until resolved |
| E15 | **Minor-quality dispute vs. subjective taste claims** | Checklist shows grade match | Objective criteria only (grade, moisture, damage %); taste/texture claims out of scope unless safety issue | Ruling per objective spec sheet |

---

## Violation Scan — Final Sign-off Checklist

| Gate | Checked across sections | Status |
|---|---|---|
| G1: Chat only post-confirmation | A (F7/C7 render condition), D (state machine, server-side thread creation) | ✅ ENFORCED |
| G2: No calls / numbers / external links / WhatsApp | A blocked lists, C admin blocked list, D transport layer, E11 | ✅ ENFORCED |
| G3: No SOS / help section / IoT / telematics | A blocked lists, C admin blocked list, E (manual entry for moisture, no sensors) | ✅ ENFORCED |
| G4: All money in-platform | A6/S6 escrow, B attestations, E money-movement column (every path routes through escrow ledger) | ✅ ENFORCED |

**Deliberate trade-off flagged for business:** removing all phone/contact support may reduce conversion among low-digital-literacy farmers → mitigated by multilingual UI, voice-to-text, doorstep KYC agents, and IVR-free **in-app guided flows** (never a call channel).
