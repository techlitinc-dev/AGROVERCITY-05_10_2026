# Farm–Landlord Agri-Marketplace Platform
## Senior Full-Stack Product Architecture Document

> **Platform premise:** Direct farmer ↔ farm-landlord aggregation marketplace (web + mobile).
> **Revenue model:** Commission on bookings, contracts, and negotiations executed in-app.

---

## ⚠️ COMPLIANCE BASELINE (Not-To-Do List — Verified Against Every Feature Below)

| # | Restriction | Enforcement Mechanism |
|---|-------------|----------------------|
| 1 | 100% in-app communication only | No chat before booking confirmation; zero contact channels pre-booking |
| 2 | No phone numbers / external links / WhatsApp redirects | Regex + ML content filter blocks numbers, URLs, UPI IDs, social handles |
| 3 | No VoIP calling | No audio/video call module exists in architecture |
| 4 | No contact-number sharing | Number masking not even implemented — numbers are never displayed |
| 5 | No SOS / help-section feature | Removed from IA; only in-app support ticket exists via Admin Panel |
| 6 | No IoT / telemetrics integration | No sensor, GPS-device, or telemetry ingestion pipeline |
| 7 | All payments/contracts/negotiations in-app | Escrow wallet + in-app offer/counter-offer engine only |

> ✅ = Compliant. Every feature row below is marked against this table. **Zero violations found at design review.**

---

# A. MUST-HAVE FEATURE SET

## A.1 Farmer Role (Farmer = seeks farm land to lease/rent for cultivation)

| # | Feature | Description | Compliance |
|---|---------|-------------|------------|
| F1 | Land search & filters | Search by district/taluka, acreage, soil type, water source (canal/borewell/rain-fed), lease duration, price range, crop suitability tags | ✅ |
| F2 | Land listing detail view | Photos, soil report upload, water availability calendar, historical yield (landlord-provided), boundary map pin | ✅ |
| F3 | Booking request / lease application | Select dates, acreage, proposed rate; submit application to landlord | ✅ |
| F4 | In-app rate negotiation | Offer/counter-offer engine on booking price (no free-text price brokering — structured only) | ✅ |
| F5 | Digital lease agreement | Auto-generated lease contract from platform templates (state-specific), e-sign in-app | ✅ |
| F6 | Payment wallet & escrow | Add money via UPI/net banking; escrow hold released on milestones (handover → mid-season → harvest) | ✅ |
| F7 | Post-confirmation chat | Text, land photo, location pin, document image | ✅ |
| F8 | Booking & season calendar | Track lease periods, payment milestones, renewal reminders | ✅ |
| F9 | Land review & rating | Rate land quality, landlord responsiveness (post-booking only) | ✅ |
| F10 | KYC & document vault | Upload farmer documents; verification status tracker | ✅ |

## A.2 Farm Landlord Role

| # | Feature | Description | Compliance |
|---|---------|-------------|------------|
| L1 | Land listing creation | Multi-photo upload, acreage, soil type, water source, boundary pin, expected lease rate, availability calendar | ✅ |
| L2 | Application inbox | Incoming farmer booking applications with farmer profile + verified KYC badge | ✅ |
| L3 | Application accept/reject/counter | One-tap accept, reject with reason, or counter-offer rate | ✅ |
| L4 | Lease agreement generation | Approve auto-generated contract; e-sign in-app | ✅ |
| L5 | Payout dashboard | Escrow releases, commission breakdown, bank settlement history | ✅ |
| L6 | Post-confirmation chat | Same channel as farmer (F7) | ✅ |
| L7 | Land analytics | Views, application count, demand trend per season (no telemetry — analytics from platform events only) | ✅ |
| L8 | Land review & rating | Rate farmer (punctuality of payment, land care) post-booking | ✅ |
| L9 | KYC & document vault | Upload land/property documents; ownership verification status | ✅ |

## A.3 Shared / Core Marketplace Features

| # | Feature | Description | Compliance |
|---|---------|-------------|------------|
| C1 | Auth & OTP login | Mobile OTP + email; role selection at signup | ✅ |
| C2 | Role-based onboarding & KYC | See Section B | ✅ |
| C3 | Search & discovery engine | Geo + filter-based land search | ✅ |
| C4 | Structured negotiation engine | Offer → counter-offer (max 5 rounds) → accept/expire; entire rate talk happens inside it, never free-text | ✅ |
| C5 | Escrow payment engine | Hold → milestone release → settlement minus commission | ✅ |
| C6 | In-app chat (locked/unlocked) | See Section D | ✅ |
| C7 | Notification center | Push + in-app: application received, counter-offer, payment released, document verified | ✅ |
| C8 | Digital contract & e-sign | State-specific templates, audit trail, downloadable PDF | ✅ |
| C9 | Ratings & reviews | Two-sided, post-booking only | ✅ |
| C10 | Dispute filing | Post-booking dispute from booking detail screen | ✅ |
| C11 | Wallet & transaction ledger | Full ledger, GST invoices for commission | ✅ |
| C12 | Content moderation service | Regex + ML filter on all text/image chat (see D) | ✅ |

---

# B. ROLE-BASED ONBOARDING & KYC FLOWS

## B.1 Common Steps (both roles)

| Step | Screen | Action |
|------|--------|--------|
| 1 | Welcome | Choose role: Farmer / Landlord (immutable after KYC submission) |
| 2 | Mobile OTP | Verify phone (this number is never shown to other users) |
| 3 | Profile basics | Name, photo, district/taluka, preferred language (12 Indian languages) |
| 4 | KYC upload | Role-specific documents (below) |
| 5 | Verification wait | Status: Pending → Verified / Rejected with reason |
| 6 | First-use setup | Farmer: search preferences. Landlord: create first listing (listing goes live only after KYC verified) |

## B.2 Farmer KYC — Exact Documents (Indian Context)

| # | Document | Purpose | Mandatory |
|---|----------|---------|-----------|
| 1 | Aadhaar card | Identity (UIDAI DigiLocker eKYC preferred) | ✅ |
| 2 | PAN card | Financial identity, TDS/payout compliance | ✅ |
| 3 | Bank account details + cancelled cheque | Payout settlement | ✅ |
| 4 | Farmer ID / PM-KISAN registration (if available) | Farmer status verification | Conditional |
| 5 | Passport photo | Profile verification | ✅ |
| 6 | CIBIL/consent for credit checks | Only if EMI/lease-financing offered later | Optional |

## B.3 Farm Landlord KYC — Exact Documents (Indian Context)

| # | Document | Purpose | Mandatory |
|---|----------|---------|-----------|
| 1 | Aadhaar card | Identity (DigiLocker eKYC) | ✅ |
| 2 | PAN card | Financial identity, TDS on payouts | ✅ |
| 3 | Land title documents | 7/12 extract (Maharashtra) / Pahani (Telangana/AP) / Khata (Karnataka) / equivalent state land record | ✅ |
| 4 | Sale deed / succession certificate | Ownership proof if title extract insufficient | Conditional |
| 5 | Property tax receipt (latest FY) | Possession corroboration | ✅ |
| 6 | Bank account details + cancelled cheque | Payout settlement | ✅ |
| 7 | Land photos + boundary geo-pin | Listing corroboration (manual admin review vs. geo-pin) | ✅ |

## B.4 Onboarding User-Flow (Text)

```
Farmer:  OTP → Profile → Upload docs (B.2) → Pending → [Admin verifies] →
         Verified → Search lands → Apply
         └─ Rejected → reason shown → re-upload

Landlord: OTP → Profile → Upload docs (B.3) → Pending → [Admin verifies title vs. 7/12 record] →
          Verified → Create listing → Listing review → Live
          └─ Rejected → reason shown → re-upload
```
> Title verification (7/12 cross-check via state land-record APIs where available, else manual admin) is the longest pole: SLA 48–72 hrs.

---

# C. ADMIN PANEL CAPABILITIES

| Module | Capability | Detail |
|--------|-----------|--------|
| KYC queue | Document verification queue | Farmer & landlord queues; side-by-side doc viewer; approve/reject with reason codes; 7/12 manual cross-check for landlords |
| KYC queue | Rejection reason templates | Blurry doc, name mismatch, title mismatch, expired doc — pushed as in-app notification |
| Disputes | Dispute resolution workflow | States: Open → Evidence collection (both parties, 72-hr window) → Admin review → Verdict → Appeal (one level) → Closed. Admin can release/ refund escrow from dispute screen |
| Disputes | Payout hold / release action | Escrow funds frozen during active disputes |
| Commission | Commission settings | Global % per booking category; per-category overrides; per-state tax config |
| Commission | Surge/demand pricing rules | Seasonal multipliers (sowing season windows) with cap limits and mandatory transparency notice to both parties |
| Users | User management | Search, suspend, ban (with reason log); role change requests blocked post-KYC |
| Bookings | Booking oversight | Live booking feed, filter by status/state/season; force-cancel with refund logic; audit every admin action |
| Listings | Listing moderation | Flagged listings review, delist, request-more-info |
| Chat | Moderation console | Flagged message review, user mute/ban from chat, full audit log export |
| Finance | Settlement & ledger | Payout batch processing, commission reconciliation, GST reports |
| Config | Feature flags & CMS | Negotiation round limits, dispute windows, season calendars |

---

# D. IN-APP CHAT ARCHITECTURE

## D.1 Lock / Unlock State Machine

```
States: LOCKED (default) → UNLOCKED (booking confirmed) → CLOSED (booking completed/cancelled)

LOCKED:
  • Chat UI entirely hidden; no "message" button anywhere on listing/profile
  • Booking application + structured negotiation engine are the ONLY interaction
  • Any attempt to convey contact info via negotiation notes → blocked by C12 filters

UNLOCKED (trigger: booking status = CONFIRMED + escrow funded):
  • Both parties can chat
  • Message types: text, image, location pin
  • Message types NOT supported: audio, video, voice notes, files, calls (not-to-do: no VoIP)

CLOSED:
  • Read-only after completion/cancellation
  • Dispute filing still allowed from booking screen (not via chat)
```

## D.2 Message Types & Schema

| Type | Payload | Validation |
|------|---------|------------|
| `text` | string ≤ 1000 chars, Unicode/Indian languages supported | Regex + ML filter (see D.3) before persist |
| `image` | JPG/PNG/WebP ≤ 10 MB | Vision-model scan for contact-info-in-image (phone screenshots, visiting cards, QR codes); EXIF stripped |
| `location` | lat/lng + reverse-geocoded label | Coordinates only; no free-form address text (blocks address-sharing workaround) |

**Chat DB schema (core tables):**

```sql
conversations(id, booking_id UNIQUE, farmer_id, landlord_id, state, created_at, closed_at)
messages(id, conversation_id, sender_id, type, payload_json, filter_result, flagged_bool, created_at)
message_audit(id, message_id, action, actor, detail, created_at)  -- immutable append-only
```

## D.3 Moderation Pipeline

| Stage | Action |
|-------|--------|
| 1. Pre-send | Regex blocklist: phone patterns (all Indian formats), UPI IDs, URLs, email, social handles, "WhatsApp/Telegram/Insta" keywords |
| 2. Pre-send | ML classifier (contact-info intent, off-platform intent, abuse) |
| 3. Post-send | Async image scan: OCR for numbers/cards/QR codes; nudity/violence check |
| 4. Violation handling | First: message blocked + warning toast. Repeated: auto-flag to Admin moderation console, user mute 24 hr → escalate |

## D.4 Audit Logging

- Every message (including blocked ones) written to `message_audit` append-only store.
- Retention: 7 years (contractual dispute limitation period).
- Audit captures: sender, type, filter decision, admin interventions, unlock/close events.
- Admin export: case-bundle PDF for legal.

---

# E. EDGE CASES & HANDLING

| # | Edge Case | Handling Logic |
|---|-----------|----------------|
| E1 | Farmer cancels before handover | Tiered: >7 days = full refund minus processing fee; 3–7 days = 10% forfeiture; <3 days = 25% forfeiture. Landlord auto-notified |
| E2 | Landlord cancels after confirmation | Full refund to farmer + landlord penalty = 15% of booking value (platform credit, non-withdrawable) + listing visibility demotion |
| E3 | No-show (farmer skips handover) | T+24 hr auto-cancel; escrow released to landlord minus platform commission |
| E4 | No-show (landlord doesn't hand over land) | Full refund + goodwill credit to farmer; landlord strike (2 strikes = listing suspension) |
| E5 | Produce / land damage dispute | Farmer files dispute with photos (D.2 image type); admin arbitration; escrow split per verdict (0/25/50/75/100%) |
| E6 | Payment dispute (failed/duplicate escrow debit) | Auto-reconcile via payment gateway; manual ledger review in Admin finance module; SLA 5 working days |
| E7 | Rate negotiation deadlock | Max 5 counter rounds; on expiry, application auto-closes; farmer may re-apply after 48 hr (anti-spam) |
| E8 | Seasonal demand spike (sowing windows) | Surge multiplier engine (C) with hard caps; waitlist for over-applied listings; anti-hoarding rule: max 3 active applications per farmer per district |
| E9 | KYC verification during peak season | SLA breaches → priority queue by booking value; provisional "verified-lite" tier (browse + apply allowed, contract blocked) |
| E10 | Chat abuse post-unlock | 3-strike ladder: mute 24 hr → mute 7 days → account suspension + admin review |
| E11 | Season mid-way payment default | Escrow milestones prevent this; if wallet top-up fails at milestone, grace 7 days → auto dispute + booking freeze |
| E12 | Contract breach (sub-leasing / illegal use) | Report flow → admin investigation → forfeiture + ban; evidence bundle from chat audit log |

---

## FINAL COMPLIANCE AUDIT

| Not-To-Do Rule | Status |
|----------------|--------|
| Pre-booking communication channel | ❌ None exists — chat UI hidden, negotiation notes filtered |
| VoIP calling | ❌ Not implemented anywhere |
| Contact number sharing | ❌ Blocked by regex/ML/OCR; numbers never displayed |
| SOS / help section | ❌ Removed; support only via admin ticket flow |
| IoT / telemetrics | ❌ No ingestion pipeline |
| Payments/contracts/negotiations outside platform | ❌ Impossible — escrow + structured negotiation are the only rails |

**Result: 0 violations. All features compliant.**
