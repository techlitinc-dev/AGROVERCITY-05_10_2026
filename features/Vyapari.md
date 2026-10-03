# FarmLink — Farmer ↔ Vyapari Direct Marketplace
## Product, Onboarding, Admin, Chat Architecture & Edge-Case Specification

**Version:** 1.0 | **Date:** 2026-09-29 | **Author:** Senior Product Architect (Agri-Tech Marketplace)
**Scope:** Mobile (Android-first) + Web platform connecting Farmers directly with Seller/Vyaparis.

---

## 0. Scope Guardrails — Non-Negotiable Compliance Baseline

| # | Guardrail Rule | Architectural Enforcement |
|---|---|---|
| G1 | 100% in-app communication only. Chat unlocks ONLY after booking confirmation. | Chat entities are created exclusively by the `BOOKING_CONFIRMED` domain event. No user directory, no user search, no free-text channel exists pre-booking. Structured Offer/Counter-Offer engine is the ONLY pre-booking interaction (it is a transaction artifact, not a communication channel — no free text anywhere pre-confirmation). |
| G2 | No VoIP calls, no contact-number sharing, no SOS/help-section, no IoT/telemetrics. | No call/video SDK in build. PII/phone-number detection pipeline in chat + OCR on images. SOS/help modules excluded from IA. Zero tracking SDKs; location is only a user-sent message pin. |
| G3 | All payments, contracts, negotiations in-platform; commission-based revenue. | RBI-compliant Payment Aggregator escrow (nodal account). Offer/Counter engine for negotiation. Commission engine with role/category/season rules. |

**Compliance legend used in every table below:**
- ✅ Compliant — safe to build
- ⚠️ Conditional — compliant only with stated guardrails (flagged so it cannot "slip through")
- ❌ VIOLATION — must NOT be built; listed with the rule breached and a compliant alternative

> **Note on SMS/OTP:** Transactional SMS for login OTP and system alerts is **system authentication/notification**, not user-to-user communication, and is permitted. It is marked ⚠️ everywhere it appears. No user-to-user SMS/email exists anywhere in the system.

---

## 1. TASK A — MUST-HAVE FEATURE SETS

### 1.1 Farmer Role (Supply Side)

| # | Feature | Description | Compliance |
|---|---|---|---|
| F1 | Mobile OTP registration | Phone-number-first signup; OTP via SMS (⚠️ system-auth only). Device binding + fingerprint to prevent multi-account fraud. | ⚠️ |
| F2 | Profile & language | Name, photo, village/taluka/district/state, preferred language (Hindi + 8 regional languages), voice-input assist for low-literacy users. | ✅ |
| F3 | Farm profile | Crop(s), acreage, organic/conventional, typical harvest months, expected annual yield — powers matching & harvest-window alerts. | ✅ |
| F4 | Produce listing creation | Crop, variety, grade/quality self-declaration, quantity (kg/quintal/tonne), expected price ₹/quintal, ready/harvest date, photos (min 2, max 6), packaging type, moisture %, pickup village pin. Drafts saved offline. | ✅ |
| F5 | Listing management | Edit, pause, duplicate/relist, auto-expire (harvest date passed). | ✅ |
| F6 | Offer inbox | View incoming Vyapari bids (price, quantity, pickup date); **Accept / Counter / Decline** — structured fields only, no free text. | ✅ |
| F7 | Market price reference card | Mandi/MSP benchmark prices shown next to listings/offers (data feed, one-way content — not communication). | ✅ |
| F8 | Booking dashboard | Timeline view of each booking: CONFIRMED → PAYMENT_HELD → PICKUP_SCHEDULED → AT_PICKUP → INSPECTED → HANDED_OVER → SETTLED. | ✅ |
| F9 | Pickup slot confirmation | Accept proposed pickup slot or counter-propose (structured). | ✅ |
| F10 | Inspection acknowledgment | At pickup, Vyapari files a digital inspection (quality/quantity, photos). Farmer accepts, or **rejects → dispute flow**; accepts revised price, or counters once (structured). | ✅ |
| F11 | Handover OTP | 6-digit, single-use, 15-min validity, generated at booking confirmation; farmer shares it verbally at handover (offline-safe). Verifies physical transfer; triggers escrow release clock. | ✅ |
| F12 | Earnings & wallet | Settlement ledger, per-booking breakdown (price − TDS − fees), downloadable statements, annual payout certificate, payout bank account management. | ✅ |
| F13 | Rate & review Vyapari | Post-closure 5-star + tags (fair weighing, on-time payment, professional conduct). <3★ triggers admin review of Vyapari. | ✅ |
| F14 | In-app notifications | Booking events, offer received, payment held, OTP events, settlement done. Push + in-app inbox. | ✅ |
| F15 | Dispute raise | "Raise dispute" action inside a booking (evidence: photos, inspection record, chat). NOT a help-center/SOS module — booking-scoped only. | ✅ |
| F16 | Relist with priority | One-tap relist of expired/declined bookings; no-show victims get boosted visibility. | ✅ |

**Explicitly NOT in Farmer app** (❌ G2): call button, contact-share card, WhatsApp redirect, SOS button, help-section with helpline, crop-sensor/telemetrics integration, live vehicle GPS tracking.

### 1.2 Seller / Vyapari Role (Demand Side)

| # | Feature | Description | Compliance |
|---|---|---|---|
| V1 | Mobile OTP registration | Same as F1, plus role selection. | ⚠️ |
| V2 | Business profile | Business name, type (trader / commission agent / processor / exporter), operating mandis, years in trade, buying capacity. | ✅ |
| V3 | Discovery & search | Filters: crop, variety, distance (pin-radius), quantity band, price band, harvest date, organic flag, quality grade. Sort: nearest / cheapest / ready-date. Map browse (listing pins only — no live tracking). | ✅ |
| V4 | Demand (reverse) listing | Vyapari posts a standing "wanted" order (crop, qty, price band, delivery window); farmers with matching farm profiles receive offers-inbox alerts → farmer initiates offer. | ✅ |
| V5 | Structured offer / Book-now | Bid below/above list price with quantity & pickup date; or instant Book-Now at listed price. Offer expiry timer (24–48h configurable). | ✅ |
| V6 | Counter-offer engine | Round-robin structured negotiation (max 3 rounds each, then expire) — **this replaces pre-booking chat negotiation**. All negotiation history is a contractual annex, timestamped, immutable. | ✅ |
| V7 | Booking & payment | Booking ledger; fund escrow via UPI / netbanking / cards / corporate wallet at confirmation; escrow status visible ("Held by FarmLink"). No UPI-to-personal-ID transfers anywhere. | ✅ |
| V8 | Pickup scheduling | Propose slot; add pickup agent name (text field, no contact fields — agent identified in-app by agent's own login if team account). | ✅ |
| V9 | Digital inspection at pickup | Checklist (moisture, damage %, grade confirmation), weighbridge-slip photo, quantity; generates Inspection Card → farmer acceptance/counter. | ✅ |
| V10 | Team accounts | Multi-user business login (owner + agents) with role permissions; all actions attributed to individual logins for audit. | ✅ |
| V11 | Purchase ledger & GST invoicing | Auto-generated tax invoice per booking (platform as marketplace facilitator), commission invoice, GST report export. | ✅ |
| V12 | Watchlist & alerts | Save searches, favorite farmers' farms (not users — farm-level), harvest-window push alerts for saved crops. | ✅ |
| V13 | Credit limit (v2) | Internal platform credit line for escrow funding (risk-scored, admin-approved). Phase-2; noted to prevent scope creep. | ✅ |
| V14 | Rate & review Farmer | Post-closure rating; farmer ratings feed matching rank. | ✅ |
| V15 | Dispute raise | Same booking-scoped dispute module as F15. | ✅ |

**Explicitly NOT in Vyapari app** (❌ G1/G2/G3): farmer phone-number reveal (even post-booking), click-to-call, WhatsApp/chat-app deep links, external payment links, live GPS tracking of pickup vehicles, telematics.

### 1.3 Shared / Core Marketplace Features

| # | Feature | Description | Compliance |
|---|---|---|---|
| C1 | AuthN/Z + RBAC | OTP auth; roles: Farmer, Vyapari, Agent (team), Admin (tiered), Ops. JWT + refresh; session per device. | ✅ |
| C2 | **Booking state machine** | Single source of truth driving chat unlock, escrow, notifications. See 1.4. | ✅ |
| C3 | Structured negotiation engine | Offer/Counter with expiry timers, round caps, and immutable audit — the ONLY negotiation channel (G3 + pre-booking lock). | ✅ |
| C4 | Escrow payment engine | PA/nodal escrow: fund on confirmation → hold → release on HANDED_OVER (auto T+24h if undisputed) minus commission; auto-refund on cancellation per policy. | ✅ |
| C5 | Commission engine | Role/category/season matrix, min-fee floors, effective-date scheduling. Default: 2% on Vyapari side (min ₹50), 0% farmer side (seasonal promos configurable). | ✅ |
| C6 | Two-sided rating & ranking | Ratings feed match-ranking; reputation decay; manipulation detection (rating rings). | ✅ |
| C7 | Notification service | In-app inbox + push as primary (⚠️ transactional SMS only for critical events: booking confirmed, payment held, settlement; never message content). | ⚠️ |
| C8 | Dispute & evidence module | Booking-scoped tickets, evidence locker, SLA timers, escrow freeze. (Section 4.5 / Task C.) | ✅ |
| C9 | Static content CMS | Crop master data, units, quality-grade definitions, seasonality calendar, serviceable pin codes, price benchmark feeds. No user-generated content channels. | ✅ |
| C10 | i18n & accessibility | 9 languages, transliteration keyboards, voice prompts, low-bandwidth mode (text-first payloads). | ✅ |
| C11 | Referrals | Referral codes with capped rewards; device-fingerprint anti-abuse. | ✅ |
| C12 | Fraud & trust layer | Device fingerprinting, duplicate-photo detection across listings, velocity rules (max active offers/bookings), strike system feeding suspensions. | ✅ |

### 1.4 Core Booking State Machine (drives everything)

| State | Entered when | Side effects | Exit transitions |
|---|---|---|---|
| DRAFT | Vyapari composes offer | — | → OFFER_SENT |
| OFFER_SENT | Offer submitted | Farmer notified; 24–48h expiry timer | → NEGOTIATING / EXPIRED / DECLINED |
| NEGOTIATING | Counter submitted | Round counter incremented; immutable annex updated | → CONFIRMED / EXPIRED / DECLINED |
| **CONFIRMED** | Both parties agree (or Book-Now) | **Chat room created + unlocked (G1).** Vyapari directed to fund escrow. Cancellation window opens. | → PAYMENT_HELD / CANCELLED_* |
| PAYMENT_HELD | Escrow funded | Pickup slot scheduling enabled; handover OTP revealed to farmer | → PICKUP_SCHEDULED / REFUNDED (timeout T+24h unfunded → auto-cancel) |
| PICKUP_SCHEDULED | Slot accepted by both | Reminders (24h, 2h); grace window set (2h post-slot) | → AT_PICKUP / NO_SHOW_* / CANCELLED_* |
| AT_PICKUP | Either party taps "Arrived" + optional location-pin message | Inspection enabled; inspection window 60 min | → INSPECTED / NO_SHOW_* / DISPUTED |
| INSPECTED | Inspection card filed & farmer accepted (possibly revised price) | Revised amount delta handled by escrow (refund excess to Vyapari / request top-up) | → HANDED_OVER / DISPUTED |
| HANDED_OVER | Handover OTP verified | Auto-release clock T+24h starts; dispute window opens | → SETTLED / DISPUTED |
| SETTLED | Escrow released minus commission & TDS | Payout queued to farmer (T+0/T+1); invoices issued; ratings unlocked | → CLOSED |
| CLOSED | Ratings done or 7-day lapse | — | terminal |
| DISPUTED | Either party raises dispute (pre/post handover) | Escrow frozen; admin ticket created (SLA 5 business days) | → SETTLED / REFUNDED / CANCELLED_* |

Terminal negative states: `CANCELLED_BY_FARMER`, `CANCELLED_BY_VYAPARI`, `EXPIRED`, `NO_SHOW_FARMER`, `NO_SHOW_VYAPARI`, `REFUNDED` — each with its own fee/refund policy (Task E).

---

## 2. TASK B — ROLE-BASED ONBOARDING FLOWS WITH KYC

### 2.1 Farmer Onboarding Flow

| Step | Screen / Action | Details | Gate |
|---|---|---|---|
| 1 | Mobile number + OTP | SMS OTP (⚠️ system-auth). Device fingerprint captured. | — |
| 2 | Role selection | "I grow & sell produce" → Farmer path. | — |
| 3 | Language & literacy assist | Select language; enable voice mode. | — |
| 4 | Basic profile | Name, DOB, gender (optional), photo/selfie with liveness, village → auto-resolve district/state from pin master. | Required |
| 5 | KYC — identity | Aadhaar via **DigiLocker / Aadhaar Paperless Offline eKYC only** (voluntary; store masked ref + last 4 digits — full Aadhaar is NOT stored, per Aadhaar Act + SC ruling). PAN upload with OCR + verification API; **no PAN → Form 60 declaration** (payout limits apply). | Required |
| 6 | Land / farm proof | Upload land record (state-specific, §2.3) OR PM-KISAN registration OR cooperative membership certificate as fallback. Farm profile captured (crop, acreage, harvest months). | Required **before first listing** (can browse earlier) |
| 7 | Payout bank details | Account number + IFSC + cancelled-cheque/passbook photo; penny-drop verification. | Required before first listing |
| 8 | Consents & contract | T&C, commission schedule, platform rules (no off-platform dealing clause), privacy policy. Explicit checkbox + vernacular audio summary. | Required |
| 9 | Submit → verification queue | Status: `PENDING` → `VERIFIED` / `REJECTED(reason)` / `RFI` (request further info). TAT 24–48h; farmers can browse, save, and **draft** listings while pending. | — |
| 10 | First-listing walkthrough | Guided listing creation with photo tips; sample price benchmark shown. | Post-verification |

### 2.2 Vyapari Onboarding Flow

| Step | Screen / Action | Details | Gate |
|---|---|---|---|
| 1 | Mobile number + OTP | As farmer step 1 (⚠️ system-auth). | — |
| 2 | Role selection | "I trade / buy produce" → Vyapari path; sub-type (trader/commission agent/processor/exporter). | — |
| 3 | Business profile | Business name, constitution (proprietorship/partnership/company), operating mandis (multi-select), years in trade, monthly buying capacity band. | Required |
| 4 | Individual KYC (proprietor/all partners) | Aadhaar (DigiLocker/offline eKYC only, masked), PAN + API verification, selfie liveness. One director/partner completes; others invited via in-app team invite (no external invite links to personal chats — in-app only). | Required |
| 5 | Business KYC | Upload business documents per §2.3; GSTIN validated via API; FSSAI licence validated via FSSAI API where applicable. | Required |
| 6 | Bank & settlement | Business account details + cancelled cheque; penny-drop. | Required |
| 7 | Pickup footprint | Default pickup mandis/villages, agent team accounts (emails/phones of agents — internal data, never exposed to counterparties). | Required |
| 8 | Consents & contract | T&C, commission schedule, escrow terms, no-off-platform-dealing clause, GST e-invoice consent. | Required |
| 9 | Two-level verification | L1: document completeness & API checks (auto); L2: manual ops review (trade-licence authenticity, reference checks via existing verified Vyapari vouches — in-platform vouch system). TAT 48–72h. Status machine: `PENDING` → `L2_REVIEW` → `VERIFIED` / `REJECTED` / `RFI`. | — |
| 10 | Booking rights | **Browse + offers allowed while pending; escrow funding/booking confirmation only after VERIFIED** (payments compliance). New Vyaparis get probation tier: max 3 concurrent bookings, ₹50k escrow cap for first 30 days. | Post-verification |

### 2.3 KYC Document Matrix — Indian Agri-Market Context

| Role | Document | Mandatory? | Purpose | Verification Method |
|---|---|---|---|---|
| Farmer | Aadhaar (DigiLocker / Offline eKYC) | Yes (voluntary use; fallback docs if declined) | Identity | DigiLocker pull / UIDAI offline eKYC XML; **mask & store last-4 only** |
| Farmer | PAN (or Form 60) | Yes | Payout taxation (TDS u/s 194-O), PAN-Aadhaar seeding check | PAN verification API; Form 60 → restricted payout tier |
| Farmer | Bank passbook / cancelled cheque | Yes | Settlement account | Penny-drop |
| Farmer | Land record: **7/12 extract (MH), Khatauni (UP/UK), RTC/MR (KA), Patta (TN/AP), Record of Rights (GJ/RJ/PB/HR/MP/WB/OR as applicable)** | Yes (one of: land record / PM-KISAN / FPO-cooperative certificate) | Proof of farming / supply legitimacy | Manual + OCR; state land-record portals where APIs exist |
| Farmer | PM-KISAN registration (fallback/supplementary) | Optional | Fast-track farmer proof | Registration number check |
| Farmer | Selfie + liveness | Yes | Liveness / duplicate-person detection | Vendor liveness SDK |
| Vyapari | Aadhaar (proprietor/partners/directors) | Yes | Individual identity | DigiLocker / offline eKYC, masked |
| Vyapari | PAN — individual + firm | Yes | Taxation, business linkage | PAN API; firm PAN verified against GSTIN |
| Vyapari | **GST registration certificate (GSTIN)** | Yes (mandatory if GST-registered or turnover above state threshold; casual-registration guidance shown for inter-state purchase from farmers — farmer-sold produce is exempt, but Vyapari needs GSTIN for input credit & platform invoicing) | Tax invoicing & compliance | GSTIN API validation |
| Vyapari | **APMC/Mandi trade licence or state trade & commerce licence** | Yes | Legitimacy of trading entity; state-specific (e.g., APMC 'arthiya'/commission-agent licence where applicable) | Manual L2 + state portal check where available |
| Vyapari | FSSAI licence (Basic/State) | Conditional — required if dealing in notified/processed food categories (grains, pulses, oilseeds, spices, fruits & veg trading generally need FSSAI Basic registration) | Food-business compliance | FSSAIN API / licence number validation |
| Vyapari | Shop & Establishment certificate | Recommended (mandatory in some states for eligibility checks) | Establishment proof | Manual |
| Vyapari | Udyam (MSME) registration | Optional | Priority onboarding, credit-limit phase-2 input | Udyam portal check |
| Vyapari | Business address proof (utility bill / rent agreement) | Yes | Establishment address | Manual + geo-tag photo of premises |


| Vyapari | Partnership deed / COI / MOA-AOA (non-proprietorship) | Yes (as applicable) | Business constitution | Manual |
| Vyapari | Bank details + cancelled cheque (business account) | Yes | Settlement & escrow funding | Penny-drop; account name vs GSTIN name match |
| Both | Consent artefacts | Yes | Contract + audit | Timestamped consent log |

### 2.4 Verification States & Rules (both roles)

- `DRAFT → PENDING → (RFI ⇄ PENDING) → VERIFIED | REJECTED`
- Rejection must carry a **selectable reason code + vernacular message**; unlimited resubmission with 3-strike document-fraud rule (forged docs → ban + device block).
- KYC status badge shown to counterparties (builds trust without exposing documents).
- Annual re-verification: PAN/Aadhaar re-validation light-check; bank change forces penny-drop re-verification.
- All KYC artifacts encrypted at rest, access-logged (who viewed, when, why) — feeds Task D audit culture.

---

## 3. TASK C — ADMIN PANEL CAPABILITIES

| Module | Capabilities | Key Controls / SLA |
|---|---|---|
| **Dashboard** | GMV, active bookings, escrow liability, dispute load, KYC queue depth, season-mode indicators | Role-scoped; refresh ≤ 5 min |
| **KYC Verification Queue** | Filter by role/status/risk score; side-by-side document viewer; OCR cross-check results; API check results (PAN/GST/FSSAI); approve / reject (reason code) / RFI; batch actions; risk-flag override requires senior admin + reason | TAT: Farmer 24–48h, Vyapari 48–72h; every decision audit-logged; four-eyes for overrides |
| **User Management** | Search (phone/name/pin); profile 360° (KYC, bookings, ratings, strikes, devices); actions: warn, restrict offers, suspend, ban (device-level); impersonation = read-only "support view" with mandatory case ID | All irreversible actions need reason + audit; ban propagates to team accounts |
| **Booking Oversight** | Search/filter by state/crop/status/amount; full timeline + event log per booking; force-cancel (with fee waiver control); extend expiry timers; re-trigger escrow ops (release/refund); intervene in an active chat by injecting a **system message** (read-only otherwise) | Escrow release/refund above ₹50k needs second approval (four-eyes); every override event-logged |
| **Dispute Resolution Workflow** | `OPEN → EVIDENCE_COLLECTION → UNDER_REVIEW → ARBITRATION → RESOLVED/CLOSED`; evidence locker (chat export, photos, inspection card, OTP logs, payment ledger); SLA timers + escalation ladder L1 → L2 → arbitration committee; resolution actions: full release / partial split (%) / full refund / ex-gratia; dispute reasons taxonomy with analytics | SLA: first response 24h, resolution 5 business days; partial splits need L2+; outcome reasons mandatory |
| **Commission / Surge / Pricing Settings** | Commission matrix: role × crop category × state; min-fee floors; **surge/season multiplier** with effective-date windows (e.g., 2% → 2.5% during tomato/peak season); cancellation fee slabs; no-show fee slabs; offer-expiry defaults; promo/referral budgets | Scheduled changes with preview impact; change history immutable; >1% absolute change requires admin-lead approval |
| **Payments & Settlements** | Escrow ledger (liability view); payout batches with retry queue; failed-payout manual resolution; reconciliation vs PG/nodal bank; TDS 194-O report export; GST sales register; commission invoices | Daily auto-recon; unreconciled >24h alerts; payouts T+0/T+1 |
| **Content & Moderation** | Chat-flag review queue (PII hits, image OCR hits, abuse ML scores); listing moderation (banned-keyword list, duplicate-image detection queue); reviewer actions: dismiss, warn user, redact, suspend chat | ML pre-screen + human review; PII redaction is auto |
| **Broadcast & Notifications** | Targeted in-app announcements (state/crop/role cohorts); notification templates (vernacular) | No marketing SMS without DLT compliance (⚠️ transactional-only default) |
| **Master Data & Config** | Crop master, varieties, grades, units, seasonality calendar, serviceable pincodes, price benchmark feeds, platform-text CMS | Versioned config; rollback supported |
| **Admin Governance** | Tiered admin roles (Ops L1/L2, Finance, Compliance, Super); all admin actions in immutable audit log; session + IP logging; quarterly access recertification | No shared admin IDs |

---

## 4. TASK D — IN-APP CHAT ARCHITECTURE

### 4.1 Access Control — Pre-Booking Lock / Post-Confirmation Unlock

```
User taps "Message" anywhere  ──►  Server checks booking_state
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
  No booking exists           Booking in DRAFT/             state = CONFIRMED
  (listing page, user         OFFER_SENT / NEGOTIATING /    or later
  profiles, search)           PAYMENT_PENDING ...
        │                            │                            │
        ▼                            ▼                            ▼
  UI: No chat affordance      UI: LOCKED state screen:      Chat room ACTIVE
  at all (no button, no       "Chat unlocks after booking   (created by event)
  deep link; 404 on direct    confirmation. Complete your
  URL hit)                    offer or Book Now."
                              Chat API returns 403
                              CHAT_LOCKED_FOR_BOOKING
```

- **Room creation is event-sourced:** only the `BOOKING_CONFIRMED` event creates the `chat_room` row (booking_id, farmer_user_id, vyapari_user_id, opened_at). No user-search, no user-ID messaging, no group chats — 1:1 per booking.
- **Room lifecycle mirrors booking:** room closes on CLOSED/CANCELLED/EXPIRED/NO_SHOW (read-only archive remains for disputes); DISPUTED rooms stay open under moderation watch with a system banner.
- **Participants are anonymized to each other:** both sides see only first name + role badge + KYC badge + rating — never phone/email (❌ any "reveal contact" toggle is banned, even post-booking).

### 4.2 Message Types

| Type | Payload | Constraints |
|---|---|---|
| Text | UTF-8, vernacular + transliteration keyboard; max 500 chars | PII/abuse moderation pipeline (§4.4); rate-limited 20/min |
| Image | Produce shots, weighbridge slip, vehicle, receipts; HEIC/JPEG ≤ 5 MP, ≤ 5 MB | EXIF location stripped on upload; OCR scans for handwritten phone numbers/UPI IDs; blur/abuse CV model |
| Location pin | Single-shot lat/lng + place label (pickup point) | Only user-initiated pin; ❌ no continuous sharing, no live tracking (G2) |
| Structured cards (system-issued) | Booking summary, revised-price proposal, inspection card, payment/escrow status, slot confirmation | Rendered from booking state, not free text — tamper-proof |
| System messages | "Booking confirmed", "Escrow funded", "Chat suspended for policy violation", admin-injected notices | Not deletable; visually distinct |

**Deliberately excluded:** voice notes, video, files, stickers marketplace, reactions beyond emoji, read-receipt opt-outs (read receipts ON — accountability), ❌ voice/video calls (G2), ❌ contact cards (G1/G2), ❌ payment requests to personal UPI (G3).

### 4.3 Transport & Infra

- WebSocket (WSS) primary with MQTT fallback for low-bandwidth Android; message ACK → `SENT → DELIVERED → READ`.
- Offline queue with retry; SMS (⚠️ transactional, content-free) only as fallback ping "You have a new in-app message — open app."
- Storage: hot store (90 days) + cold archive; DB per-shard by booking_id; attachments in object storage with signed URLs.
- **No E2E encryption (deliberate):** server-side moderation is a legal/safety requirement here. Encryption at rest + TLS in transit; decryption access restricted to moderation service accounts and logged.

### 4.4 Moderation Pipeline (inline, synchronous)

```
Client send ──► [0] Schema + rate-limit + size checks
              ──► [1] PII/abuse classifier (text):
                    • 10-digit mobile patterns (+91 variants), UPI handles (@upi etc.),
                      email, URLs, "whatsapp/telegram/call me" lexicon (9 languages)
                    • Abuse/toxicity ML
              ──► [2] Image: EXIF strip → OCR (numbers, UPI QR) → NSFW/abuse CV
              ──► HIT? ──► message BLOCKED, user warned (strike system),
                    incident logged to moderation queue, repeat ≥2 → chat suspension
                    (room frozen, system message explains, appeal via booking dispute)
              ──► PASS? ──► persist → fan-out → ACK
```

- False-positive appeal = part of booking-scoped dispute module.
- Vyapari/farmer **Report message** action flags without blocking the reporter's view.

### 4.5 Audit Logging

| Requirement | Specification |
|---|---|
| Append-only event log | Every chat event (send/deliver/read/flag/block/suspend) as an immutable event row; hash-chained (prev_hash) so tampering is detectable; nightly anchoring digest to WORM storage |
| Message immutability | No edit; delete = "retract" tombstone (content hidden from both UIs, original retained in encrypted vault) |
| Access logs | Every human/system read of chat content logged (admin support view, dispute export, legal request) with case ID |
| Retention | Hot 90 days; archive 3 years (aligned to limitation under IT Act/commercial disputes); legal hold flag per dispute |
| Dispute export | One-click signed PDF export (chat + booking timeline + payment ledger) for arbitration — this replaces any external evidence channel |
| Privacy | Retention schedule disclosed in privacy policy; purge jobs verified quarterly |

---

## 5. TASK E — EDGE CASES & RESOLUTION MATRIX

| # | Edge Case | Trigger Detection | System Behavior | Money Movement | Penalty / Safeguard |
|---|---|---|---|---|---|
| E1 | Farmer cancels after confirmation | Cancellation action | Free within 2h of CONFIRMED; thereafter cancellation fee = 1% of booking value (cap ₹500) if escrow funded; offer re-listed automatically | Escrow auto-refund T+1 minus fee | Strike accrual; 3 cancels/30d → listing rank demotion |
| E2 | Vyapari cancels after confirmation | Cancellation action | Free within 2h; post-payment refund minus PG charges (borne by Vyapari) + 1% fee if <24h to pickup | Auto-refund minus deductions | 3 cancels/30d → probation tier |
| E3 | Vyapari no-show at pickup slot | Slot + 2h grace passes, no "Arrived" | Slot forfeits; farmer one-tap "Relist with priority"; booking → NO_SHOW_VYAPARI | Escrow auto-refund T+1 | Flat ₹300 inconvenience credit to farmer from Vyapari wallet (debt on next booking); 3 no-shows → suspension review |
| E4 | Farmer no-show | Same logic on farmer side | Booking → NO_SHOW_FARMER; Vyapari may rebook same listing slot via re-offer | Escrow auto-refund T+1 | Flat trip-compensation ₹200 to Vyapari from farmer wallet debt; 3 no-shows → restriction |
| E5 | Quality mismatch at inspection | Inspection card filed with damage %/moisture, photos mandatory | Vyapari proposes revised price (structured); farmer Accepts / Counters once / Rejects. Reject → booking cancels penalty-free OR converts to partial-quantity booking (split) | Delta auto-computed: excess refunded to Vyapari or top-up requested before OTP | Inspection photos mandatory or revision invalid; repeated false-inspection Vyaparis flagged via farmer rating correlation |
| E6 | Quantity shortfall vs booking | Weighbridge slip vs booked qty | Pro-rata price adjustment auto-computed on inspection card | Partial refund of delta to Vyapari on settlement | Slip photo mandatory; variance >20% → admin review |
| E7 | Payment dispute (charged but not delivered / not settled) | "Raise dispute" within 72h of HANDED_OVER or 24h of expected settlement | Escrow frozen; evidence bundle auto-assembled (OTP logs, inspection card, chat export, ledger); L1→L2→arbitration | Release / partial split / full refund per arbitration; splits executable in escrow | 5-business-day SLA; >SLA auto-escalates to compliance lead; ex-gratia caps defined |
| E8 | Rate negotiation deadlock / stale offers | Offer expiry timer (24–48h), max 3 rounds/party | Auto-expire; listing remains active; both parties get market-benchmark card (MSP/mandi avg) to recalibrate | — | Expired-offer analytics feed demand signals to admin season settings |
| E9 | Seasonal demand spike / supply glut (e.g., tomato, onion, wheat arrivals) | Platform telemetry: listings volume, match latency, category ratios | **Season Mode (admin-set):** surge commission multiplier window, Vyapari concurrent-booking caps (anti-hoarding), match queue prioritized by earliest harvest date, infra autoscale, listing-expiry extensions so gluts don't churn | Commission multiplier auto-applied per window | Monitoring dashboard "spike watch"; price-crash states trigger MSP info cards + FPO/contract-farming offers |
| E10 | Weather event destroys crop pre-pickup | Farmer force-cancel with evidence (photo of field damage) | Evidence-based penalty-free cancellation wave; affected listings bulk-paused by region | Auto-refund | Ops verify sample evidence; crop-insurance info cards shown (informational content, not a feature violation) |
| E11 | Off-platform dealing attempts (number sharing, "call me", QR codes in chat) | §4.4 moderation pipeline hits | Message blocked + warning (strike 1); strike 2 → chat suspension for that booking; strike 3 → account restriction | Existing bookings stay in escrow (platform still settles); policy clause allows commission recovery on proven circumvention | Strike ledger shared in user-360; appeal via dispute |
| E12 | Fake / duplicate listings, photo reuse | Duplicate-image perceptual hash, device fingerprint, velocity rules | Listing held for review; verified-user vouch system raises trust; field-ops verification visit for repeat offenders | Bookings on held listings blocked | 3-strike fraud rule → ban + device block |
| E13 | Network failure at pickup (no connectivity) | Client offline detection | Pre-generated time-boxed handover OTP works offline (HMAC-derived, valid in 15-min window, one-time); sync on reconnect; inspection can be completed offline and queued | Settlement proceeds after sync verification | OTP replay/duplicate-use detection |
| E14 | Handover OTP shared with wrong person | OTP verified but farmer disputes handover | OTP + optional location-pin message + inspection acceptance form the delivery proof bundle; dispute decides | Escrow frozen pending E7 | OTP one-time-use + tight window limits exposure |
| E15 | Language barrier between parties | Chat language detection | Message translate-suggestion (tap-to-translate) + templated phrase cards in 9 languages; transliteration keyboards | — | Templates are pre-approved content — safe under moderation |
| E16 | Multi-account / device-sharing fraud | Device fingerprint collisions, behavioral anomaly | Accounts linked; velocity caps shared across linked accounts | Escrow caps on linked accounts | Bans propagate across device cluster |
| E17 | Payout to closed/frozen bank account | Bank API rejection | Payout retry queue (T+1, T+3, T+7); farmer prompted to update bank (penny-drop again); unresolved → manual payout desk after KYC re-check | Funds never leave platform liability ledger | Admin payout desk with four-eyes |
| E18 | Unfunded booking timeout | CONFIRMED but escrow unfunded T+24h | Auto-cancel → EXPIRED; farmer listing re-activated with priority; Vyapari gets reliability demerit | No money moved | 2 unfunded/30d → offer rights restricted |
| E19 | Booking confirmed but produce sold elsewhere before pickup | Farmer cancellation E1 path; suspicious pattern detection | Same as E1; pattern adds fraud review | As E1 | Field-ops verification for repeat offenders |
| E20 | Refund to expired card / failed UPI handle | PG refund failure | Refund routed to platform wallet → bank withdrawal flow | Wallet balance liability tracked | Wallet KYC = account KYC (already verified) |
| E21 | Collusion / cartel bidding (multiple Vyapari accounts, same owner) | Device + bank + GSTIN graph analysis | Cluster detection; cluster flagged; match-ranking deprioritized; admin notified | Escrow caps per cluster | Ban on proven collusion |
| E22 | Admin override abuse (insider risk) | All admin actions logged | Four-eyes on money movement >₹50k; immutable admin audit; quarterly recertification | — | Hash-chained admin log anchored like §4.5 |

---

## 6. VIOLATION FLAG MATRIX — Features That Must NOT Slip Through

| ❌ Excluded Feature | Why it's tempting | Rule Breached | Compliant Alternative Built Instead |
|---|---|---|---|
| In-app voice or video calls ("Call farmer" button) | Familiar UX; speeds deals | G2 — No VoIP calling | Structured cards + templates; inspection card; escalation to admin |
| Reveal/sharing of phone numbers post-booking | "Logistics needs coordination" | G1/G2 — in-app only, no contact sharing | Post-confirmation chat + location pin + handover OTP |
| "Chat on WhatsApp" deep links / share-sheet redirects | User demand, habit | G1/G2 — no external comms | Push notifications pulling users back to in-app chat |
| SOS / emergency helpline / help center with call option | Platform polish | G2 — explicitly excluded | Booking-scoped "Raise dispute" + admin arbitration; system status notifications |
| Live GPS vehicle tracking / driver telematics / IoT sensors | Logistics visibility | G2 — no IoT/telematics | User-tapped "Arrived" events + single location-pin messages |
| UPI-to-personal-ID payment links or QR requests in chat | Convenience | G3 — payments in-platform only | Escrow with UPI/netbanking via licensed PG |
| User-to-user email/SMS messaging | Notification habit | G1 — in-app only | In-app inbox + content-free transactional push/SMS |
| Pre-booking free-text Q&A on listings | "Buyers need to ask questions first" | G1 — no pre-booking channel | Structured offer fields + mandatory listing attributes + photo set; "Book first, chat after" |
| Editable messages / E2E-encrypted chat | Standard chat UX | Audit & moderation obligations (G3 contract enforcement) | Retract-only + server-side moderation + hash-chained audit log |
| Ratings that expose personal contact paths | Trust building | G1 | KYC badge + rating only |

---

## 7. Compliance Sign-Off Checklist

| Rule | Enforced At |
|---|---|
| G1 — In-app only; chat only post-confirmation | §1.4 state machine (CONFIRMED gates room creation), §4.1, no user directory/search anywhere |
| G2 — No VoIP / no contact sharing / no SOS / no IoT | §6 exclusions; PII pipeline §4.4; no tracking/telemetrics SDKs in build manifest |
| G3 — Payments/negotiation/contracts in-platform | Structured negotiation §1.3-C3; escrow §1.3-C4; commission §1.3-C5; contract annex from negotiation history |

*End of specification.*
