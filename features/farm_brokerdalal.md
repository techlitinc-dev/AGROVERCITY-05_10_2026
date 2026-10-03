# Farm ↔ Broker/Dalal Marketplace — Product Architecture Spec (v1.0)

**Platform:** Mobile (Android-first) + Web
**Model:** Commission-based marketplace connecting Farmers ↔ Broker/Dalal (aggregation & logistics mediation)
**Hard Constraints (non-negotiable):**
- ✅ 100% in-app communication. Chat unlocks ONLY after booking confirmation.
- ✅ No VoIP, no phone number sharing, no WhatsApp/external links, no SOS/help section, no IoT/telematics.
- ✅ All payments, contracts, and negotiations happen inside the platform.

> **Legend:** ⚠️ = feature touching a forbidden zone — built with guardrails. ❌ = must NOT be built — rejected.

---

## A. MUST-HAVE FEATURE SET

### A1. Farmer Role
| # | Feature | Description | Constraint Check |
|---|---------|-------------|------------------|
| F1 | Profile & Farm Details | Name, village/taluka/district, landholding size (acres), primary crops, harvest calendar | ✅ |
| F2 | List Produce / Lot | Create lot: crop type, variety, grade, quantity (quintal/tonne), expected harvest date, photos, expected base price (₹/quintal), pickup location pin | ✅ |
| F3 | Lot Status Lifecycle | Draft → Live → Booked → In-Transit → Delivered → Paid / Cancelled / Expired | ✅ |
| F4 | Browse/Receive Broker Offers | View matched brokers by crop, distance, rating, bid history | ✅ |
| F5 | Counter-Offer & Negotiation | In-platform price negotiation (structured bid/counter-bid cards, not free chat) | ✅ |
| F6 | Booking Confirmation & Contract Summary | E-contract summary: lot, agreed price, quantity, commission %, pickup window, payment T+n terms | ✅ |
| F7 | In-App Chat (post-booking only) | Locked until booking confirmed (see D) | ✅ |
| F8 | Photo Evidence Upload | Harvest photos, loading photos, weighbridge slip photos, damage photos (upload-only, attached to booking) | ✅ |
| F9 | Delivery Tracking (Milestone-based) | Status events only: broker departed → arrived → loading → in-transit → arrived at mandi/buyer → weighed → delivered. **No GPS telemetry** | ✅ |
| F10 | Wallet & Earnings | Ledger: lot amount − commission = payout; UPI/bank settlement status | ✅ |
| F11 | Ratings & Reviews | Rate broker per completed booking; tag reasons (fair weighing, on-time pickup, fair price) | ✅ |
| F12 | Booking History & Receipts | Downloadable PDF invoice/receipt | ✅ |
| F13 | Notifications | Offer received, counter-offer, booking confirmed, pickup reminder, payment credited, dispute update (push + in-app inbox) | ✅ |

### A2. Broker/Dalal Role
| # | Feature | Description | Constraint Check |
|---|---------|-------------|------------------|
| B1 | Profile & Service Area | Operating mandis/haats, crops dealt in, radius of operation, years of experience, commission rate card | ✅ |
| B2 | KYC-Business Setup | Firm/trader type: commission agent (arhtiya) licence / trader / transporter-broker hybrid | ✅ |
| B3 | Discover Lots | Search/filter by crop, quantity, district, harvest window; save searches | ✅ |
| B4 | Place Offer / Bid | Structured offer card: price, quantity accepted, pickup date, transport arranged (Y/N), payment terms | ✅ |
| B5 | Counter-Offer & Negotiation | Same structured negotiation as F5 | ✅ |
| B6 | Book Lot | Confirm booking → generates e-contract & unlocks chat | ✅ |
| B7 | In-App Chat (post-booking) | Coordinate pickup, quality discussion | ✅ |
| B8 | Vehicle & Pickup Details | Vehicle type, number (masked display e.g. `MH 12 •• 3456`), driver name only — **no driver phone shown to farmer** | ⚠️ plate masking enforced; no numbers in free text (moderation, D4) |
| B9 | Milestone Updates | Push pickup/transit/delivery events (same event model as F9) | ✅ |
| B10 | Proof of Delivery & Weighment | Upload weighbridge slip, mandi receipt, delivered photos | ✅ |
| B11 | Escrow/Collection Ledger | Track receivable from end buyer vs payout owed to farmer; commission auto-split shown | ✅ |
| B12 | Payout Release | Trigger release after delivery confirmation window; deductions only via dispute | ✅ |
| B13 | Ratings & Performance Score | Farmer ratings → affects search ranking; response-rate, completion-rate metrics | ✅ |
| B14 | Notifications | New matching lots, counter-offers, pickup reminders, payout released, disputes | ✅ |

### A3. Shared / Core Features
| # | Feature | Description | Constraint Check |
|---|---------|-------------|------------------|
| C1 | Auth (OTP on mobile + PIN/biometric unlock) | Phone OTP login; number never exposed post-auth — masked everywhere in UI | ✅ |
| C2 | Role Selection & Onboarding | Separate flows (Section B) | ✅ |
| C3 | In-App Wallet | Balance, ledger, payout methods (UPI VPA / bank account), transaction history | ✅ |
| C4 | Payments Engine | Razorpay/Cashfree (UPI, cards, netbanking): farmer payout, broker commission settlement, platform commission split | ✅ |
| C5 | E-Contract Engine | Generated per confirmed booking: parties (masked IDs), lot, price, commission, terms, digital acceptance log | ✅ |
| C6 | Structured Negotiation System | Bid → Counter → Accept/Expire (TTL 24–48h) — deal terms never need free chat | ✅ |
| C7 | In-App Chat Module | Post-booking only (Section D) | ✅ |
| C8 | Ratings & Trust System | Two-sided ratings, badge tiers (Verified, Proven) | ✅ |
| C9 | Dispute Module | Evidence-based dispute per booking (Section C workflow); in-app tickets only | ✅ |
| C10 | Notifications Center | Push + in-app inbox, per-event templates | ✅ |
| C11 | Multilingual UI | Hindi + regional (Marathi/Telugu/Punjabi…) with English fallback | ✅ |
| C12 | Offline Tolerance | Draft lots & milestone queuing on poor connectivity (rural reality) | ✅ |

### Features Explicitly REJECTED (❌ — violates "not-to-do" list)
| Rejected Feature | Why Rejected | Violation |
|---|---|---|
| Voice/VoIP calling in chat | Forbidden — no VoIP | ❌ Rule 2 |
| "Share contact" / phone reveal button | Forbidden — no number sharing | ❌ Rule 1/2 |
| WhatsApp redirect / deep links | Forbidden — external comms | ❌ Rule 1 |
| In-app SOS / emergency help section | Forbidden — no SOS/help section | ❌ Rule 2 |
| Live GPS vehicle tracking / telematics | Forbidden — no IoT/telematics | ❌ Rule 2 |
| Driver contact sharing | Facilitates off-platform comms | ❌ Rule 1 |
| "Call support" button in help | Requires phone channel | ❌ Rule 2 → replaced by in-app dispute tickets (C9) |
| Voice notes in chat | Audio channel adjacent to forbidden VoIP; evades text moderation | ❌ Rule 2 (borderline) — v1 rejects |

---

## B. ROLE-BASED ONBOARDING & KYC

### B1. Onboarding Flow — Farmer
| Step | Screen | Details |
|---|---|---|
| 1 | Welcome + Role select | Choose "Farmer" |
| 2 | Mobile OTP verification | 6-digit OTP; device fingerprint |
| 3 | Language preference | Hindi/regional/English |
| 4 | Personal details | Full name (as per ID), DOB, gender (optional) |
| 5 | Identity verification | Upload **any one**: Aadhaar (eKYC via UIDAI XML/QR), Voter ID, PAN, Driving Licence → OCR + liveness selfie match |
| 6 | Farm profile | Village/taluka/district (selection from master list), total land (acres), irrigation source, crops grown, harvest months |
| 7 | Land record (optional, Trust Badge) | Upload: **7/12 extract (Satbara) / Record of Rights** (state-specific) |
| 8 | Bank/UPI details | Account number + IFSC (penny-drop verify) OR UPI VPA |
| 9 | Photo & consent | Profile photo; T&C, data-processing consent |
| 10 | Verification pending → Approved | SLA 24–48h; farmer can draft lots while pending, but **cannot go live until KYC approved** |

**Farmer document checklist (India):**
| Doc | Mandatory? | Purpose |
|---|---|---|
| Aadhaar (eKYC XML/QR) or Voter ID / PAN / DL | ✅ Mandatory (any one) | Identity |
| Liveness selfie | ✅ Mandatory | Liveness/anti-fraud |
| 7/12 Satbara / land record | ⭐ Optional (Trust Badge) | Farm ownership credibility |
| Bank passbook / cancelled cheque + IFSC | ✅ Mandatory | Payouts |
| UPI VPA | Alternative to bank | Payouts |

### B2. Onboarding Flow — Broker/Dalal
| Step | Screen | Details |
|---|---|---|
| 1 | Welcome + Role select | Choose "Broker / Dalal" |
| 2 | Mobile OTP verification | Same as farmer |
| 3 | Business type select | (a) Commission Agent / Arhtiya (b) Independent Trader-Broker (c) Transport-Arranger |
| 4 | Personal KYC | Same ID set as farmer (any one) + liveness selfie |
| 5 | Business KYC | Upload documents per type (below) |
| 6 | Mandi/licence details | Licence number, issuing APMC market, validity; OCR verify |
| 7 | Service profile | Mandis covered, crops, radius, commission %, payment terms offered |
| 8 | Bank details | Business account + IFSC (penny-drop); GST-linked preferred |
| 9 | References (optional) | 2 existing platform users / trade references (manual check) |
| 10 | Video verification (optional tier) | For "Verified Broker" badge |
| 11 | Verification pending → Approved | SLA 48–72h; stricter than farmer; **cannot bid until approved** |

**Broker/Dalal document checklist (India):**
| Doc | Applicable To | Mandatory? |
|---|---|---|
| Aadhaar/PAN/DL (any one) + liveness | All | ✅ |
| **PAN (mandatory for brokers — income trail)** | All | ✅ |
| **APMC Commission Agent / Arhtiya licence** | Commission Agent | ✅ (if operating in APMC) |
| **GST Registration Certificate** | All above threshold | ✅ if applicable |
| **Udyam (MSME) registration** | All | ⭐ Recommended |
| **Shop & Establishment / Trade licence** | Trader-Broker | ✅ (or self-declaration) |
| **FSSAI licence** | Brokers in perishables/processing | ✅ (conditional) |
| **Vehicle RC + valid insurance** | Transport-Arranger (own fleet) | ✅ (conditional) |
| **Police/FIR background self-declaration** | All | ✅ (self-declaration + optional check) |
| Business cancelled cheque + 3-mo bank statement | All | ✅ |
| Trade references | All | ⭐ Optional |

### B3. Onboarding Differences Summary
| Aspect | Farmer | Broker |
|---|---|---|
| Approval SLA | 24–48h | 48–72h + manual review |
| Blocking gate | Cannot publish lots | Cannot bid/book |
| Extra verification | Land record (optional) | Business licence, GST, references |
| Trust tiers | Verified → Super Farmer | Verified → Proven Broker (volume + rating) |

---

## C. ADMIN PANEL CAPABILITIES

### C1. User & KYC Verification Queue
| Capability | Details |
|---|---|
| KYC queue | Filter by role, doc type, status (Pending/Approved/Rejected/Re-check); SLA breach highlight |
| Doc viewer | Side-by-side: ID scan, OCR extraction, selfie match score, liveness score |
| Actions | Approve / Reject (reason codes) / Request re-upload / Escalate to manual review |
| Risk flags | Duplicate device, shared bank account across accounts, PAN-name mismatch, edited-image detection |
| Audit | Every action logged: admin id, timestamp, before/after |

### C2. Booking Oversight
| Capability | Details |
|---|---|
| Booking ledger | All bookings with status funnel (Live lot → Offer → Negotiation → Confirmed → Delivered → Paid) |
| Live operations board | Today's pickups, overdue milestones (e.g., "in-transit" > 48h), stalled negotiations |
| Intervention actions | Pause booking, force-cancel (reason required), manual milestone correction |
| Communication monitoring | Read-only access to unlocked chats (audit only; admins never impersonate a party) |

### C3. Dispute Resolution Workflow
```
1. User opens dispute on a booking (farmer or broker) → selects category + uploads evidence
2. Auto-freeze: payout held in escrow; booking flagged
3. SLA auto-assign: L1 agent (24h ack) → L2 specialist (48h)
4. Evidence review: chat log (auto-attached), photos, weighbridge slips, milestones
5. Resolution paths:
   a. Mutual accept → platform records settlement terms → release per terms
   b. Admin decision → full/partial payout, deduction, or penalty to either party
6. Outcome notification to both parties (in-app only) + appeal window (72h)
7. Repeat-offender flagging → account restrictions
```
| Dispute Category | Primary Evidence | Typical Ruling Logic |
|---|---|---|
| Payment not received | Bank/UPI ledger, escrow state | Release if delivery confirmed |
| Weight/quality mismatch | Weighbridge slip vs claimed qty | Pro-rata price adjustment |
| Produce damage in transit | Loading vs delivery photos | Liability by milestone gap |
| No-show / pickup not done | Milestone absence + chat log | Cancellation penalty to broker |
| Rate reneging post-delivery | E-contract price vs payout claim | Contract price enforced |
| Harassment/misconduct in chat | Chat audit log | Warning → ban tiers |

### C4. Commission & Surge Settings
| Capability | Details | Guardrail |
|---|---|---|
| Base commission % | Per role/category/crop; A/B testable | Dual approval (maker-checker) |
| Seasonal surge rules | Crop-season calendar (e.g., wheat harvest Apr–May, onion Jan–Apr) → temporary commission caps/floors | Within state APMC legal caps |
| Negotiation fee | Optional platform fee on confirmed deal | Disclosed pre-booking |
| Minimum payout thresholds | Configurable | — |
| Promo/waiver codes | Farmer-side fee waivers for acquisition | Budget caps + expiry |

### C5. User Management
| Capability | Details |
|---|---|
| User directory | Search by masked ID, village, role, status |
| Account actions | Suspend / ban (reason codes), reactivate, restrict (read-only) |
| Tier management | Grant/revoke badges (Verified, Super Farmer, Proven Broker) |
| Content moderation queue | Reported chat messages, lot photos (see D4) |
| Fraud console | Multi-account, device-farm, collusion (fake bookings to farm incentives) detection |

### C6. Analytics & Reporting
| Area | Metrics |
|---|---|
| Marketplace health | GMV, take-rate, match rate (lots with ≥1 offer), negotiation→booking conversion |
| Trust & safety | Dispute rate per 1k bookings, resolution time, repeat-dispute users |
| Seasonality dashboards | Crop-wise supply/demand heatmap → feeds surge settings |

> ❌ **Flagged & rejected:** admin "call user" feature and admin-triggered SMS with phone numbers — both leak contact info, violating Rules 1–2. All admin↔user comms via in-app notifications and dispute tickets.

---

## D. IN-APP CHAT ARCHITECTURE

### D1. Lock / Unlock State Machine
```
States: LOCKED (default) → UNLOCKED (booking confirmed) → READ-ONLY (booking closed) → SEALED (dispute)
```
| State | Rules |
|---|---|
| **LOCKED** (pre-booking) | No chat UI exists at all — not even a greyed-out composer. User sees: "Chat opens after booking is confirmed." Negotiation happens ONLY via structured bid/counter cards (C6). No free text, images, or pins possible. |
| **UNLOCKED** | Trigger: booking = CONFIRMED (both parties accepted e-contract). Full message types enabled (D2). Composer active. |
| **READ-ONLY** | Trigger: booking = DELIVERED/PAID or CANCELLED. Chat visible for record; sending disabled ("Booking closed"). |
| **SEALED** | Trigger: dispute raised → chat frozen as evidence snapshot; new messages blocked except via dispute-evidence channel. |

**Implementation guardrails (pre-booking):**
- No chat API endpoint accepts messages where no CONFIRMED booking exists between the two users — server-side enforced, not just UI.
- User profile screens show no phone/email/contact rows — ⚠️ deliberately omitted.
- Push notification payloads never contain a sender's phone number.

### D2. Message Types
| Type | Use Case | Validation |
|---|---|---|
| Text | Coordination, quality discussion | Regex + blocklist scan (D4); max 1,000 chars |
| Image | Produce photos, vehicle photos, weighbridge slips, damage evidence | Max 5MB, JPG/PNG/WebP; EXIF/GPS stripped on upload ⚠️; virus scan |
| Location pin | Pickup point refinement, meeting point | Must be within 10 km of the lot pickup pin (anti-fraud) |
| Structured system cards | Auto-injected: "Booking confirmed", "Pickup scheduled", "Offer updated to ₹X" | Immutable, server-generated |

> ❌ **Rejected:** voice notes (adjacent to forbidden voice channel — v1 excludes to stay clearly inside Rule 2); file attachments (📎 could carry vCard/contact files — blocked; slips must be photos via camera); reactions only ✅.

### D3. Delivery, Ordering & Storage
- WebSocket (Socket.IO) primary + push fallback; client-generated UUID message IDs for idempotency; server sequence for ordering.
- Offline queue: messages stored locally (encrypted at rest) → sent on reconnect.
- Media → object storage (S3/GCS) with signed URLs; lifecycle: **media purged 90 days after booking closure**; text retained 12 months for dispute/audit.
- Presence indicators (online/typing) only; read receipts disabled during open disputes to reduce escalation (configurable).

### D4. Moderation (Real-Time)
| Layer | Mechanism |
|---|---|
| Ingress filter | Phone-number regex (all Indian formats: +91, 10-digit, spaced variants), email regex, URL/WhatsApp blocklist (`wa.me`, `t.me`, etc.), UPI-VPA pattern (`user@bank`) — **blocked before send; sender warned** |
| Image moderation | NSFW/violence ML classifier; OCR on images to catch printed phone numbers |
| Behavioral | Rapid-fire messaging, repeated blocked-content attempts → rate-limit → trust & safety flag |
| Reporting | Long-press message → report (reason menu) → C5 moderation queue |
| Penalty ladder | Warning → 24h chat mute → booking restriction → suspension |

### D5. Audit Logging
Every event written to an append-only audit store:
| Event | Fields |
|---|---|
| msg.sent | booking_id, sender_role, msg_type, content_hash, moderation verdict |
| msg.blocked | rule_id matched, attempted content hash, user id |
| chat.unlocked / sealed | booking_id, trigger, timestamp, actor (system/admin) |
| dispute.snapshot | chat export ref, evidence bundle hash, sealed_at |

Retention: audit logs 24 months, encrypted; admin access itself is logged (who-read-what).

---

## E. EDGE CASES & DESIGN RESPONSES

| # | Edge Case | Scenario | Product Response |
|---|---|---|---|
| E1 | **Farmer cancels after confirmation** | Harvest delayed / sold elsewhere | Free within 30 min; escalating cancellation fee after (deducted from future payout). If broker already departed, broker compensated from platform pool. Reason mandatory. |
| E2 | **Broker cancels after confirmation** | Found better lot / price moved | Strike system: 1st warning → 2nd 48h bidding freeze → 3rd account review. Farmer gets priority re-match + credit. |
| E3 | **Farmer no-show at pickup** | Broker arrives, lot not ready | Broker marks "No-show" with milestone + photo; 2h grace; auto-cancel; farmer reliability score drops; repeat → listing visibility penalty. |
| E4 | **Broker no-show (pickup never happens)** | Lot rots waiting | Auto-escalate at pickup-window end + 4h; farmer can cancel penalty-free and relist with priority boost; broker strike per E2. |
| E5 | **Produce damage in transit** | Loading photo OK, delivery photo shows damage | Photo-pair diff + milestone timeline locates liability. Deductions only via dispute ruling (C3). Optional transit-protection fee at booking; claims paid from protection pool. |
| E6 | **Quantity/quality mismatch at weighbridge** | Claimed 20q, weighed 17q | Pro-rata auto-adjustment proposed via system card; either party may dispute within 24h. |
| E7 | **Payment dispute / payout stuck** | Broker claims end-buyer hasn't paid; farmer demands release | Escrow rule: delivery confirmation + 48h silent window → auto-release farmer payout (platform fronts from settlement reserve, then collects from broker). Dispute pauses release. |
| E8 | **Rate renegotiation post-delivery** | Mandi price crashed; broker pressures farmer | E-contract price is binding; moderation flags price-pressure phrases; no post-booking price-change card exists — adjustment only via dispute. |
| E9 | **Seasonal demand spike** | Harvest glut: 10× lots, broker capacity shortage | Surge engine (C4): dynamic commission caps, broker completion bonuses, waitlist + priority matching by farmer reliability score, queue-based pickup scheduling. |
| E10 | **Seasonal supply drought** | Off-season, few lots | Platform campaigns; broker crop alerts; commission floor relaxed within limits. |
| E11 | **Chat abuse to share phone number** | "call me at 98xxx" or number in words | D4 block + warning; word-number classifier for "nine eight…"; repeat → mute. Voice notes would evade this — additional reason ❌ voice notes rejected. |
| E12 | **One-sided chat (unresponsive party)** | Broker stops replying after booking | Auto-nudges at T+2h, T+8h; unresponsive milestone > 24h → ops board; penalty-free cancel or dispute available. |
| E13 | **Duplicate/collusive bookings** | Farmer+broker fake bookings to farm referral bonuses | Fraud console: device graph, bank-account graph, milestone-event coincidence, statistical outliers → clawbacks + bans. |
| E14 | **KYC fraud** | Fake Aadhaar, rented accounts | Liveness + document forensics, penny-drop bank verification, same-selfie-across-accounts detection; queue holds (C1). |
| E15 | **Multi-hop brokering (sub-contracting off-platform)** | Broker A books, hands to Broker B outside | Prohibited in T&C; detection: milestone pins far from declared service area, chat mentions; penalty: strike + forfeited commission. |
| E16 | **Force majeure (rain, road block, curfew)** | Transit impossible | Force-majeure cancel reason → no penalties; reschedule via new structured card; evidence (photo/news) attached. |
| E17 | **Farmer digital literacy gap** | Cannot type/negotiate | Voice-to-text input (transcribed on-device, sent as **text** ⚠️, not audio); guided photo-first listing wizard; regional language UI (C11). |
| E18 | **Partial delivery / split lots** | Truck capacity < lot size | Structured "split booking": lot divided into child bookings, each with own contract and chat unlock — never handled over free chat. |
| E19 | **Refund/reversal after payout** | UPI chargeback scam | Payouts only to penny-drop-verified accounts of the KYC'd user; 7-day hold on first payout per account; reversals routed to dispute only. |
| E20 | **Retaliatory reporting** | Reports after a failed deal | Report weighting: reporter's violation history lowers weight; human review for account-level actions. |

---

## APPENDIX — Violation Flag Register
| Flag | Feature Touched | Risk | Resolution |
|---|---|---|---|
| ⚠️ | Vehicle plate display (B8) | Indirect contact enablement | Middle digits masked; visible only post-booking |
| ⚠️ | Milestone events (F9/B9) | Could drift into telematics | Event-based only; no GPS stream, no live map |
| ⚠️ | EXIF stripping on images (D2) | Location privacy | Stripped at upload |
| ⚠️ | Voice-to-text input (E17) | Adjacent to forbidden voice | Output is text only; no audio stored/transmitted |
| ⚠️ | Admin chat read access (C2) | Trust/privacy | Audit-logged, read-only, role-gated |
| ❌ | VoIP / voice calls | Rule 2 | Not built |
| ❌ | Contact sharing / phone reveal | Rule 1/2 | Not built |
| ❌ | WhatsApp / external links | Rule 1 | Not built; hard blocklist |
| ❌ | SOS / help section | Rule 2 | Not built; replaced by in-app dispute module |
| ❌ | IoT / telematics / GPS tracking | Rule 2 | Not built; milestones only |
| ❌ | "Call support" | Rule 2 | Not built; ticket-based support |
| ❌ | Voice notes in chat | Rule 2 (borderline) | Not built in v1 |
