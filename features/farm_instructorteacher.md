# Farm ↔ Instructor/Teacher Marketplace — Product Architecture Spec (v1.0)

**Platform:** Mobile (Android-first) + Web
**Model:** Commission-based marketplace connecting Farmers ↔ Instructor/Teacher (agri-skills training: drone operation, organic farming, soil health, livestock care, FPO management, govt-scheme guidance, certification prep)
**Hard Constraints (non-negotiable):**
- ✅ 100% in-app communication. Chat unlocks ONLY after booking confirmation.
- ✅ No VoIP, no phone number sharing, no WhatsApp/external links, no SOS/help section, no IoT/telematics.
- ✅ All payments, contracts, and negotiations happen inside the platform (commission-based).

> **Legend:** ⚠️ = feature touching a forbidden zone — built with guardrails. ❌ = must NOT be built — rejected.

---

## A. MUST-HAVE FEATURE SET

### A1. Farmer Role (Trainee/Learner)
| # | Feature | Description | Constraint Check |
|---|---------|-------------|------------------|
| F1 | Profile & Farm Context | Name, village/taluka/district, landholding size, crops/livestock, current practices, learning goals | ✅ |
| F2 | Browse Courses & Instructors | Search/filter by topic (drone spraying, organic certification, dairy management…), language, price, rating, distance, online/offline mode | ✅ |
| F3 | Course Detail Page | Syllabus, duration, session count, mode (on-farm / centre-based / hybrid), language, fee, instructor credentials, reviews | ✅ |
| F4 | Enquiry via Structured Card | Pre-booking questions ONLY via fixed templates ("Is this course suitable for X?", "Batch timings?") — no free chat, no contact info | ✅ |
| F5 | Book Session / Batch | Select slot → booking confirmed → e-contract (fee, schedule, curriculum scope, refund policy) generated | ✅ |
| F6 | Counter-Offer & Negotiation | Structured fee negotiation card (bid/counter with TTL 24–48h) — never free chat | ✅ |
| F7 | In-App Chat (post-booking only) | Locked until booking confirmed (see D) | ✅ |
| F8 | Attendance & Check-In | QR-code scan at session start (offline-capable); instructor confirms attendance | ✅ |
| F9 | Assignment / Practical Evidence Upload | Photos of field work, soil samples, drone practice logs (photo-only, attached to session) | ✅ |
| F10 | Session Status Lifecycle | Booked → Scheduled → In-Progress → Completed → Certified / Cancelled / No-Show | ✅ |
| F11 | Wallet & Payments | Pay fee via UPI/cards; refunds to wallet/bank; receipts | ✅ |
| F12 | Certificate Wallet | Downloadable completion certificates (tamper-evident, verifiable QR) issued in-app | ✅ |
| F13 | Ratings & Reviews | Rate instructor per completed course; tag reasons (clarity, practical value, punctuality) | ✅ |
| F14 | Notifications | Booking confirmed, session reminders (T-24h, T-2h), assignment feedback, certificate issued, refund/dispute updates | ✅ |

### A2. Instructor/Teacher Role
| # | Feature | Description | Constraint Check |
|---|---------|-------------|------------------|
| T1 | Profile & Credentials | Name, specialisation, years of experience, languages, service area (districts), qualifications | ✅ |
| T2 | Course/Program Builder | Create courses: syllabus, session plan, duration, mode, fee, batch size, prerequisites, required materials list | ✅ |
| T3 | Availability & Slots | Calendar management: batch schedules, 1-on-1 slots, blackout dates (harvest season etc.) | ✅ |
| T4 | KYC-Credentials Setup | Upload qualification & licence documents (Section B) | ✅ |
| T5 | Receive Structured Enquiries | Answer template enquiries via template answers only | ✅ |
| T6 | Offer / Fee Quote | Structured offer card: fee, schedule, inclusions, payment plan (full/instalments) | ✅ |
| T7 | Counter-Offer & Negotiation | Same structured negotiation as F6 | ✅ |
| T8 | Confirm Booking | Booking → e-contract → unlocks chat with enrolled farmer(s) | ✅ |
| T9 | In-App Chat (post-booking) | Doubts, logistics coordination with enrolled farmers only | ✅ |
| T10 | Batch & Attendance Management | Mark attendance, session completion, send session reminders (system-generated) | ✅ |
| T11 | Assessment & Feedback | Review uploaded practical evidence (photos), grade, give structured feedback forms | ✅ |
| T12 | Certificate Issuance | Issue completion certificate per farmer after assessment; platform co-branded | ✅ |
| T13 | In-Platform Content Library | Upload lessons as text + images (PDFs allowed ONLY inside the gated content module ⚠️ — never via chat; no external links) | ⚠️ content-module guardrails in D2 |
| T14 | Earnings & Payouts | Ledger: fees collected − commission = payout; batch-wise breakdown; settlement T+n | ✅ |
| T15 | Ratings & Performance Score | Farmer ratings → affects search ranking; completion rate, attendance rate, response rate | ✅ |
| T16 | Notifications | New enquiry, booking, session reminders, payout released, dispute updates | ✅ |

### A3. Shared / Core Features
| # | Feature | Description | Constraint Check |
|---|---------|-------------|------------------|
| C1 | Auth (OTP on mobile + PIN/biometric unlock) | Phone OTP login; number masked everywhere in UI post-auth | ✅ |
| C2 | Role Selection & Onboarding | Separate flows (Section B) | ✅ |
| C3 | In-App Wallet | Balance, refunds, ledger, payout methods (UPI VPA / bank account) | ✅ |
| C4 | Payments Engine | Razorpay/Cashfree (UPI, cards, netbanking): farmer fees, instructor payouts, platform commission split | ✅ |
| C5 | E-Contract Engine | Per confirmed booking: parties (masked IDs), course, fee, schedule, scope, refund terms, digital acceptance log | ✅ |
| C6 | Structured Negotiation System | Fee bid → counter → accept/expire (TTL 24–48h) — terms never require free chat | ✅ |
| C7 | In-App Chat Module | Post-booking only (Section D) | ✅ |
| C8 | Ratings & Trust System | Two-sided ratings, badge tiers (Verified, Proven Instructor) | ✅ |
| C9 | Dispute Module | Evidence-based dispute per booking; in-app tickets only | ✅ |
| C10 | Notifications Center | Push + in-app inbox, per-event templates | ✅ |
| C11 | Multilingual UI | Hindi + regional (Marathi/Telugu/Punjabi…) with English fallback | ✅ |
| C12 | Offline Tolerance | Draft courses, cached content, attendance queuing on poor rural connectivity | ✅ |
| C13 | Verifiable Certificate Registry | Public-verify QR page (no personal phone numbers — certificate ID + name only ⚠️) | ⚠️ privacy guardrail |
| C14 | Learning Records (farmer skill passport) | Completed courses, skills endorsed — portable profile within platform | ✅ |

### Features Explicitly REJECTED (❌ — violates "not-to-do" list)
| Rejected Feature | Why Rejected | Violation |
|---|---|---|
| Voice/VoIP calling or video classes | Forbidden — no VoIP; live video = telecom channel | ❌ Rule 2 |
| "Share contact" / phone reveal button | Forbidden — no number sharing | ❌ Rule 1/2 |
| WhatsApp/YouTube/Telegram redirects for "course videos" | Forbidden — external comms/links | ❌ Rule 1 |
| In-app SOS / emergency help section | Forbidden — no SOS/help section | ❌ Rule 2 |
| Live GPS instructor tracking / telematics | Forbidden — no IoT/telematics | ❌ Rule 2 |
| Voice notes in chat | Audio channel adjacent to forbidden VoIP; evades text moderation | ❌ Rule 2 (borderline) — v1 rejects |
| "Call support" button | Requires phone channel | ❌ Rule 2 → replaced by in-app dispute tickets (C9) |
| File attachments in chat (PDFs/vCards) | Could carry contact files | ❌ Rule 1/2 → content lives in gated T13 module only |
| Payment outside platform ("pay cash at session") | Breaks commission model | ❌ Rule 3 → cash-flag detection + moderation (E15) |

---

## B. ROLE-BASED ONBOARDING & KYC

### B1. Onboarding Flow — Farmer
| Step | Screen | Details |
|---|---|---|
| 1 | Welcome + Role select | Choose "Farmer / Learner" |
| 2 | Mobile OTP verification | 6-digit OTP; device fingerprint |
| 3 | Language preference | Hindi/regional/English |
| 4 | Personal details | Full name (as per ID), DOB, gender (optional) |
| 5 | Identity verification | Upload **any one**: Aadhaar (eKYC via UIDAI XML/QR), Voter ID, PAN, Driving Licence → OCR + liveness selfie match |
| 6 | Farm & learning profile | Village/taluka/district, landholding, crops/livestock, topics of interest, preferred language of instruction |
| 7 | Land record (optional, Trust Badge) | 7/12 extract (Satbara) / Record of Rights — boosts credibility, unlocks subsidy-linked courses |
| 8 | Bank/UPI details | Account + IFSC (penny-drop verify) OR UPI VPA — for refunds & payouts |
| 9 | Photo & consent | Profile photo; T&C, data-processing consent |
| 10 | Verification pending → Approved | SLA 24–48h; can browse courses while pending, **cannot book until KYC approved** |

**Farmer document checklist (India):**
| Doc | Mandatory? | Purpose |
|---|---|---|
| Aadhaar (eKYC XML/QR) or Voter ID / PAN / DL | ✅ Mandatory (any one) | Identity |
| Liveness selfie | ✅ Mandatory | Liveness/anti-fraud |
| 7/12 Satbara / land record | ⭐ Optional (Trust Badge; subsidy-linked course eligibility) | Farm credibility |
| Bank passbook / cancelled cheque + IFSC or UPI VPA | ✅ Mandatory | Refunds/payouts |

### B2. Onboarding Flow — Instructor/Teacher
| Step | Screen | Details |
|---|---|---|
| 1 | Welcome + Role select | Choose "Instructor / Teacher" |
| 2 | Mobile OTP verification | Same as farmer |
| 3 | Specialisation select | Agri-drone ops / organic farming / dairy & livestock / soil & agronomy / horticulture / FPO & scheme literacy / machinery operation / agri-entrepreneurship |
| 4 | Personal KYC | Same ID set (any one) + liveness selfie |
| 5 | Credential upload | Qualification/licence docs per specialisation (below) |
| 6 | Credential verification | Admin/manual review + source verification where possible (university/licence registry) |
| 7 | Teaching profile | Bio (pre-written template + structured fields — free-text bio moderated), languages, districts served, modes offered, fee range |
| 8 | Bank details | Account + IFSC (penny-drop) |
| 9 | Demo assessment (optional tier) | Upload a 3-image micro-lesson (photo-based) → reviewer scoring for "Certified Instructor" badge |
| 10 | Verification pending → Approved | SLA 48–72h; stricter than farmer; **cannot publish courses until approved** |

**Instructor/Teacher document checklist (India):**
| Doc | Applicable To | Mandatory? |
|---|---|---|
| Aadhaar/PAN/DL (any one) + liveness | All | ✅ |
| **PAN** | All (income trail) | ✅ |
| **Relevant degree/diploma certificate** (B.Sc./M.Sc. Agriculture, Polytechnic agri diploma, KVK/SAU training cert) | Agronomy, horticulture, soil | ✅ |
| **DGCA-compliant Remote Pilot Certificate / drone licence** (RPTO-issued) | Drone training | ✅ |
| **State agriculture dept / KVK / SAU trainer authorisation** | Govt-recognised trainers | ✅ (where applicable) |
| **FSSAI / organic NPOP/NOP certifier training credentials** | Organic certification training | ✅ (conditional) |
| **NABARD/NRLM/SRLM trainer empanelment proof** | Scheme-literacy / FPO training | ✅ (conditional) |
| **Veterinary/animal husbandry diploma (e.g., PVF/NLM dairy training)** | Livestock/dairy | ✅ (conditional) |
| **Machinery operator cert (tractor/drip/sprayer OEM training)** | Machinery training | ✅ (conditional) |
| **Experience letters / references (2)** | Degree-less but experienced practitioners (recognized route) | ⭐ Optional alternative to degree |
| Business/personal cancelled cheque + 3-mo statement | All | ✅ |
| Police/FIR self-declaration | All | ✅ |

### B3. Onboarding Differences Summary
| Aspect | Farmer | Instructor |
|---|---|---|
| Approval SLA | 24–48h | 48–72h + credential source-verification |
| Blocking gate | Cannot book courses | Cannot publish courses |
| Extra verification | Land record (optional) | Degree/licence/trainer authorisation; demo assessment (optional tier) |
| Trust tiers | Verified → Super Farmer | Verified → Certified Instructor (assessment-based) |
| Credential expiry | N/A | Recurring: licences re-verified at expiry (admin cron) |

---

## C. ADMIN PANEL CAPABILITIES

### C1. User & KYC Verification Queue
| Capability | Details |
|---|---|
| KYC queue | Filter by role, doc type, specialisation, status (Pending/Approved/Rejected/Re-check); SLA breach highlight |
| Doc viewer | Side-by-side: ID scan, OCR extraction, selfie match score, liveness score |
| Credential verification | Licence/degree registry cross-check where available; "source-verified" flag vs "self-declared" flag displayed on profiles |
| Actions | Approve / Reject (reason codes) / Request re-upload / Escalate to domain reviewer |
| Risk flags | Duplicate device, shared bank account across accounts, PAN-name mismatch, edited-image detection, fake certificate patterns |
| Audit | Every action logged: admin id, timestamp, before/after |

### C2. Booking Oversight
| Capability | Details |
|---|---|
| Booking ledger | All bookings with status funnel (Enquiry → Negotiation → Confirmed → In-Progress → Completed → Certified/Paid) |
| Live operations board | Today's sessions, instructor no-shows, overdue attendance marking, stalled negotiations |
| Intervention actions | Pause booking, force-cancel (reason required), reschedule on behalf (both parties notified), manual milestone correction |
| Communication monitoring | Read-only access to unlocked chats (audit only; admins never impersonate a party) |
| Course content review | Queue for newly published courses (T2) and content-library items (T13) before/after go-live sampling |

### C3. Dispute Resolution Workflow
```
1. User opens dispute on a booking (farmer or instructor) → selects category + uploads evidence
2. Auto-freeze: instructor payout held; certificate issuance blocked for that booking
3. SLA auto-assign: L1 agent (24h ack) → L2 specialist (48h)
4. Evidence review: chat log (auto-attached), attendance records, uploaded practical photos, payment ledger
5. Resolution paths:
   a. Mutual accept → platform records settlement (partial refund / makeup session) → execute
   b. Admin decision → full/partial refund, payout deduction, or penalty to either party
6. Outcome notification to both parties (in-app only) + appeal window (72h)
7. Repeat-offender flagging → account restrictions; instructor quality-score impact
```
| Dispute Category | Primary Evidence | Typical Ruling Logic |
|---|---|---|
| Fee not refunded after cancellation | Payment ledger, cancellation timeline | Refund per published refund policy |
| Instructor no-show | Attendance record absent, chat log, farmer check-in attempt | Full refund + instructor strike |
| Farmer no-show without cancellation | Attendance record, instructor marking | No refund (per policy) / credit note |
| Session quality not as advertised | Course page snapshot, session photos, chat | Partial refund / makeup session |
| Certificate withheld unfairly | Assessment records, feedback forms | Issue certificate or documented reason required |
| Harassment/misconduct in chat | Chat audit log | Warning → ban tiers |
| Fee renegotiation post-completion | E-contract fee vs payout claim | Contract fee enforced |

### C4. Commission & Surge Settings
| Capability | Details | Guardrail |
|---|---|---|
| Base commission % | Per category/mode/language; A/B testable | Dual approval (maker-checker) |
| Seasonal surge rules | Training-demand calendar (pre-sowing: soil/drone; pre-monsoon: pest mgmt; post-harvest: storage/FPO) → temporary commission caps, instructor acquisition bonuses | Within contracted limits |
| Instalment-fee service charge | Configurable % for payment plans (T6) | Disclosed pre-booking |
| Subsidy-linked pricing | Govt/KVK-sponsored seat pricing (fixed fee rules) | Program-budget caps |
| Promo/waiver codes | Farmer-side fee waivers for acquisition; instructor-side zero-commission launch offers | Budget caps + expiry |

### C5. User Management
| Capability | Details |
|---|---|
| User directory | Search by masked ID, village/district, role, specialisation, status |
| Account actions | Suspend / ban (reason codes), reactivate, restrict (read-only) |
| Tier management | Grant/revoke badges (Verified, Certified Instructor, Super Farmer) |
| Credential lifecycle | Expiry alerts; auto-downgrade of instructors with expired licences |
| Content moderation queue | Reported chat messages, course descriptions, content-library items |
| Fraud console | Multi-account, device-farm, collusion (fake bookings to farm referral incentives), certificate-forgery detection |

### C6. Analytics & Reporting
| Area | Metrics |
|---|---|
| Marketplace health | GMV, take-rate, match rate (enquiries → bookings), negotiation→booking conversion |
| Learning outcomes | Completion rate, certificate issuance rate, repeat-booking rate, skill-passport growth |
| Trust & safety | Dispute rate per 1k bookings, resolution time, repeat-dispute users |
| Seasonality dashboards | Category-wise demand heatmap by month → feeds surge settings |

> ❌ **Flagged & rejected:** admin "call user" feature and admin-triggered SMS with phone numbers — leak contact info (Rules 1–2). All admin↔user comms via in-app notifications and dispute tickets.

---

## D. IN-APP CHAT ARCHITECTURE

### D1. Lock / Unlock State Machine
```
States: LOCKED (default) → UNLOCKED (booking confirmed) → READ-ONLY (booking closed) → SEALED (dispute)
```
| State | Rules |
|---|---|
| **LOCKED** (pre-booking) | No chat UI exists at all — not even a greyed-out composer. Enquiries go through structured template cards (F4/T5). No free text, images, or pins. User sees: "Chat opens after your booking is confirmed." |
| **UNLOCKED** | Trigger: booking = CONFIRMED (e-contract accepted by both). Full message types enabled (D2). Composer active. Group variant: batch booking → single group chat with instructor + enrolled farmers. |
| **READ-ONLY** | Trigger: booking = COMPLETED/CERTIFIED or CANCELLED. Chat visible for record; sending disabled ("Booking closed"). |
| **SEALED** | Trigger: dispute raised → chat frozen as evidence snapshot; new messages blocked except via dispute-evidence channel. |

**Implementation guardrails (pre-booking):**
- No chat API endpoint accepts messages without a CONFIRMED booking between the two users — server-side enforced, not just UI.
- Profile screens show no phone/email/contact rows — ⚠️ deliberately omitted.
- Push notification payloads never contain a sender's phone number.

### D2. Message Types
| Type | Use Case | Validation |
|---|---|---|
| Text | Doubts, session logistics, feedback | Regex + blocklist scan (D4); max 1,000 chars |
| Image | Farm-condition photos for advice, practical-assignment evidence, whiteboard/blackboard snapshots | Max 5MB, JPG/PNG/WebP; EXIF/GPS stripped on upload ⚠️; virus scan; OCR scan for printed phone numbers |
| Location pin | Session venue, on-farm training site | Must be within 50 km of declared service area (instructor) / within district (farmer) |
| Structured system cards | Auto-injected: "Booking confirmed", "Session scheduled", "Fee updated to ₹X", "Attendance confirmed" | Immutable, server-generated |
| In-platform lesson card (from T13 library) | Instructor shares a lesson from the gated content module as a card inside chat | Renders inside app only; no download-link, no external URL ⚠️ |

> ❌ **Rejected:** voice notes (forbidden-adjacent audio; evades moderation — E11); video messages & live classes (VoIP); file attachments in chat (vCard/contact smuggling — lessons live only in the T13 content module); external links of any kind.

### D3. Delivery, Ordering & Storage
- WebSocket (Socket.IO) primary + push fallback; client-generated UUID message IDs for idempotency; server sequence for ordering.
- Batch group chats: instructor is admin; farmers cannot DM each other (one-to-many only) ⚠️ — prevents off-platform deal-making between farmers, keeps everything auditable.
- Offline queue: encrypted local store → send on reconnect.
- Media → object storage with signed URLs; **media purged 90 days after booking closure**; text retained 12 months for dispute/audit.
- Presence indicators (online/typing) only; read receipts disabled during open disputes.

### D4. Moderation (Real-Time)
| Layer | Mechanism |
|---|---|
| Ingress filter | Phone-number regex (all Indian formats: +91, 10-digit, spaced variants), email regex, URL/WhatsApp/Telegram/YouTube blocklist (`wa.me`, `t.me`, `youtu.be` etc.), UPI-VPA pattern (`user@bank`) — **blocked before send; sender warned** |
| Image moderation | NSFW/violence ML classifier; OCR on images for printed phone numbers/links |
| Cash-payment solicitation | Phrase classifier for "cash", "pay at venue directly", "bina app ke" patterns → block + warning (E15) |
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
| attendance.marked | session_id, actor, method (QR/manual/admin), timestamp |
| certificate.issued / revoked | booking_id, certificate_hash, issuer, reason |
| dispute.snapshot | chat export ref, evidence bundle hash, sealed_at |

Retention: audit logs 24 months, encrypted; admin access itself is logged (who-read-what).

---

## E. EDGE CASES & DESIGN RESPONSES

| # | Edge Case | Scenario | Product Response |
|---|---|---|---|
| E1 | **Farmer cancels after confirmation** | Crop emergency / changed mind | Tiered refund per published policy: free ≥48h before first session; 50% 24–48h; 0% <24h. Instructor notified instantly; slot reopens. |
| E2 | **Instructor cancels after confirmation** | Illness / emergency | Full refund + platform credit to farmer; instructor strike: 1st warning → 2nd 7-day publishing freeze → 3rd review. Affected farmers get priority re-booking. |
| E3 | **Farmer no-show at session** | Doesn't check in | Instructor marks no-show with evidence; fee per policy (usually retained/50%); farmer reliability score drops; repeat → booking restrictions. |
| E4 | **Instructor no-show** | Session starts, instructor absent | Auto-escalate at session start + 30 min; farmer refunded in full automatically; instructor strike per E2; session rescheduled via new booking. |
| E5 | **"Produce damage" analogue — practical-assessment dispute** | Farmer claims assignment was wrongly failed / evidence photos lost | Assessment rubric is structured (in-app form); photo evidence retained; dispute reviews rubric vs evidence; re-assessment option once. |
| E6 | **Training equipment / drone damage during session** | Farmer damages rented practice drone | Pre-booking damage-deposit (platform-held) configured per course; damage claim via dispute with photo evidence; deposit partial-release rules. |
| E7 | **Payment dispute / payout stuck** | Instructor claims fee not released; farmer claims charged twice | Escrow rule: session completed + 48h silent window → auto-release instructor payout minus commission. Duplicate-charge → auto-refund via payment-gateway reconciliation. |
| E8 | **Fee renegotiation mid-course** | Instructor demands more after starting | E-contract fee is binding; moderation flags fee-pressure phrases; no post-booking fee-change card exists — changes only via dispute-mediated settlement. |
| E9 | **Seasonal demand spike** | Pre-sowing season: 10× demand for soil-health & drone courses | Surge engine (C4): commission caps, instructor capacity onboarding sprint, waitlist + priority matching by farmer reliability score, batch-splitting tool (one batch → two sessions). |
| E10 | **Seasonal instructor shortage** | Harvest season: instructors busy on their own farms | Blackout-calendar incentive: instructors pre-declare availability; off-season course discounts promoted; hybrid-mode courses absorb demand. |
| E11 | **Chat abuse to share contact** | "call me at 98xxx" or number in words | D4 block + warning; word-number classifier; repeat → mute. Voice notes would evade this — core reason ❌ voice notes rejected. |
| E12 | **One-sided chat (unresponsive instructor)** | Farmer's doubts unanswered before session | Auto-nudges T+4h, T+16h; unresponsive > 24h → ops board; farmer may cancel penalty-free within 24h of first session. |
| E13 | **Collusive bookings** | Instructor+friends fake bookings to farm referral bonuses | Fraud console: device graph, bank graph, session-attendance absence, statistical outliers → clawbacks + bans. |
| E14 | **Credential fraud** | Fake degree/drone licence | Source-verification flags (C1); "self-declared" label until verified; periodic re-verification at licence expiry; farmer-facing "Verified credential" badge. |
| E15 | **Off-platform payment solicitation** | Instructor offers discount for cash outside app | T&C prohibition; D4 phrase classifier; payment evidence via dispute; penalty: forfeited commission + strike; repeat → suspension. |
| E16 | **Force majeure (weather, curfew)** | On-farm session impossible | Force-majeure cancel/reschedule reason → no penalties either side; evidence attached; batch auto-shifted to next slot. |
| E17 | **Farmer digital literacy gap** | Cannot type questions | Voice-to-text input (transcribed on-device, sent as **text** ⚠️, not audio); image-first doubt flow ("photo your problem"); regional language UI (C11). |
| E18 | **Batch seat overflow / split batches** | 30 enrolled, venue fits 15 | Structured batch-split: new child bookings created, each with own chat unlock; consent via system card accept — never negotiated in free chat. |
| E19 | **Certificate forgery / sharing outside** | Fake certificate PDF circulated | Tamper-evident QR → verification page shows cert ID + name only (no phone) ⚠️; revocation list; watermark. |
| E20 | **Retaliatory reporting** | Bad reviews after failed negotiation | Report weighting: reporter's violation history lowers weight; human review for account-level actions. |

---

## APPENDIX — Violation Flag Register
| Flag | Feature Touched | Risk | Resolution |
|---|---|---|---|
| ⚠️ | Batch group chat (D3) | Farmer-to-farmer off-platform dealing | Farmers cannot DM each other; instructor-only broadcast |
| ⚠️ | Lesson card from content library (D2) | External content smuggling | Renders in-app only; no URLs, no downloads |
| ⚠️ | Certificate verification page (C13/E19) | Personal data exposure | Shows cert ID + name only; no phone/email |
| ⚠️ | EXIF stripping on images (D2) | Location privacy | Stripped at upload |
| ⚠️ | Voice-to-text input (E17) | Adjacent to forbidden voice | Output is text only; no audio stored/transmitted |
| ⚠️ | Admin chat read access (C2) | Trust/privacy | Audit-logged, read-only, role-gated |
| ❌ | VoIP / video calls / live classes | Rule 2 | Not built |
| ❌ | Contact sharing / phone reveal | Rule 1/2 | Not built |
| ❌ | WhatsApp/YouTube/Telegram redirects | Rule 1 | Not built; hard blocklist |
| ❌ | SOS / help section | Rule 2 | Not built; replaced by in-app dispute module |
| ❌ | IoT / telematics / GPS tracking | Rule 2 | Not built |
| ❌ | "Call support" | Rule 2 | Not built; ticket-based support |
| ❌ | Voice notes in chat | Rule 2 (borderline) | Not built in v1 |
| ❌ | Cash/off-platform payment | Rule 3 | Not built; solicitation detection + penalties |
