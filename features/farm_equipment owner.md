# Agri-Equipment Marketplace: Product Architecture Specification
Platform type: Mobile + Web marketplace directly connecting Farmers with Equipment Owners in India.
Revenue model: Commission on confirmed bookings; all payments, contracts, and negotiations inside platform.
Hard constraints: 100% in-app communication only; chat unlocks only after booking confirmation; no VoIP; no contact number sharing; no SOS/help-section; no IoT/telemetry.

## A. MUST-HAVE feature set

### Farmer role must-haves
| Domain | Must-have features | Notes / constraints |
|---|---|---|
| Profile & trust | Farmer profile, serviceable crop/land details, saved farms/fields, preferred operators list | No contact details displayed before booking; masked identity fields only |
| Discovery | Search/filter by equipment type, location/radius, availability calendar, horsepower/capacity, implement compatibility, price range, rating, owner verification badge, distance, soil/terrain suitability | Filters must prioritize availability and serviceability over owner identity exposure |
| Booking | Request-to-book, instant booking where enabled by owner, quote compare, scheduling, advance payment, in-app negotiation, contract preview, booking confirmation, reschedule, cancel | Negotiation only through platform quote counter-offer model; no free-text price coercion before confirmation is allowed to bypass contract terms |
| Field operations | Job scope checklist, acreage, expected hours, attachments required, entry instructions as structured fields, pre-job photo checklist | Location pins and instructions are shared only after confirmed booking |
| Payment & finance | Wallet, UPI/card/net-banking in-app, advance + completion split, receipts/invoices, credit ledger for repeat farmers if enabled, commission disclosure | No cash tracking advice; payment disputes routed to admin |
| Post-booking | In-app chat, image upload, location sharing, status updates: owner assigned / en route / on-site / work started / work completed / verified complete | Status timestamps feed settlement and dispute evidence |
| Quality assurance | Farmer confirms completion, damage report, photo/video evidence, rating & review, re-open dispute window | Reviews published only after completed booking to reduce manipulation |
| Compliance | KYC status, land/lease optional proof, GST if buyer entity, consent records for data/payment | Consent logs mandatory for payments and location sharing |

### Equipment owner role must-haves
| Domain | Must-have features | Notes / constraints |
|---|---|---|
| Asset management | Equipment catalog: tractor, harvester, tiller, sprayer, thresher, rotavator, seed drill, baler, trolley, custom implements; specs, photos, capacity, compatible attachments, service history provided by owner, insurance status, availability calendar, idle-time pricing rules | No telematics; all availability is owner-entered/manual sync only |
| Pricing & yield | Hourly/acre/day/package pricing, minimum billing, travel/idle charges, surge settings if admin permits, seasonal blocked dates, discount rules, quote templates | Surge caps and transparency mandated by admin policy |
| Work acceptance | Job queue, bid/quote on farmer requests, accept/counter/reject, conflict calendar, owner confirmation with digital contract | Counters are logged with expiry and reason codes |
| Pre-booking privacy | Owner sees only structured demand details and approximate distance; no farmer phone/address; exact field location unlocked after confirmation | Farmer identity masked until confirmation |
| Job execution | Checklist: mobilization photos, pre-work field condition, start/stop geofenced pin optional without tracking, completion evidence, fuel/operator inclusions | No continuous GPS tracking; only event-based pins if consented |
| Payment settlement | Earnings dashboard, payout bank account, TDS/GST handling, commission statement, settlement cycle, invoice generation, refund holds | Payout only after completion proof or dispute timeout |
| Risk control | Deposit rules, cancellation policy by owner, equipment damage claim upload, operator verification, insurance certificate upload | Claims must include photo evidence and timestamps |
| Performance | Response time SLA, acceptance rate, completion rate, rating, repeat hire rate, owner tier/badges | Badges cannot expose direct contact data |

### Shared/core marketplace features
| Domain | Must-have features | Notes / constraints |
|---|---|---|
| Identity & KYC | Role selection, mobile OTP, Aadhaar/DigiLocker-assisted verification where available, PAN, bank verification via penny-drop, document upload, manual review fallback | No document may contain phone numbers exposed to counterparty |
| Trust & safety | Verified badge logic, blacklist, fraud signals, duplicate device/account detection, review integrity, report user inside booking/chat only | No public “help/SOS” module; emergency handled via standard system/legal escalation, not product feature |
| Matching engine | Demand-posting, equipment inventory indexing, ranking by distance/availability/price/rating, owner quote lifecycle, recommendation feed | Ranking must not rank by willingness to share phone numbers because disallowed |
| Contracts | Standard service terms per state/crop/equipment category, e-sign or OTP acceptance, scope annexure, cancellation and damage clauses, version history | Contract is prerequisite to chat unlock |
| Payments | Escrow-like authorized hold or split settlement, refunds, partial release, invoice/tax fields, reconciliation report | No offline payment instructions; messages auto-block for payment/contact attempts |
| Notifications | SMS/WhatsApp/Email may be used only for transactional alerts; in-app is primary legal communication record | No links redirecting to external communication or payments |
| Disputes & audit | Case IDs, evidence vault, timeline, SLA timers, arbitration notes, moderation actions, immutable audit log | Audit log retained for regulator/lawful requests |
| Admin & ops | See section C | Internal tools must be permissioned and logged |
| Platform policies | Commission schedules, cancellation policy matrix, seasonal surge policy, content moderation rules, data retention schedule | Policies versioned and accepted at booking time |

## B. Role-based onboarding flows and Indian KYC/document verification

### Farmer onboarding flow
| Step | Screen/action | Data captured | Verification |
|---|---|---|---|
| 1 | Role chooser: Farmer / Equipment Owner | Role, language, consent | Role lock with reason for change request |
| 2 | Mobile OTP | Mobile number | OTP + SIM/device risk checks; number never shown to owners pre-booking |
| 3 | Profile basics | Name, DOB optional unless legal entity, gender optional, district/state, preferred crops, land size range, land ownership type | Consent for location approximate only |
| 4 | KYC tier selection | Individual farmer / FPO / leasing company / institutional buyer | Route documents accordingly |
| 5 | Document upload | Individual: Aadhaar masked XML/PDF via DigiLocker preferred, PAN, selfie liveness, bank account for refunds/payments. FPO/institution: PAN, GSTIN if applicable, incorporation/registration certificate, authorized signatory ID, board/partner resolution, bank details | DigiLocker verification, PAN verification, penny-drop bank verification, manual review if failed |
| 6 | Land/farm context | Village, tehsil, approximate service radius, crop calendar, irrigation source, field access constraints | Optional for basic use; required only for high-value bookings or credit features |
| 7 | Payment setup | UPI intent/bank selection, mandate/authorization consent | Tokenization through PSP; no CVV storage |
| 8 | Contract acceptance | Marketplace terms, cancellation policy, damage liability, in-app communication policy | Timestamped acceptance |
| 9 | Activation | Profile completeness score, verification badge states: Pending/Verified/Rejected/More info | Start posting demands; instant booking only if KYC tier supports risk limit |

Farmer exact documents — Indian agri context:
- Individual: Aadhaar via DigiLocker or masked upload, PAN, live selfie, bank passbook/cancelled cheque or penny-drop verified account.
- Optional farm proof for credibility or disputes: land record/khatauni/7/12 extract or equivalent state record, lease agreement if not owner-cultivator; keep optional to avoid exclusion.
- FPO/cooperative: FPO registration certificate, PAN of entity, GST if applicable, authorized signatory ID, board resolution/authorization letter, bank account details.
- Institution/agri business: CIN/LLPIN or registration, GSTIN, PAN, authorized signatory KYC, purchase/lease intent letter if placing high-volume orders.

### Equipment owner onboarding flow
| Step | Screen/action | Data captured | Verification |
|---|---|---|---|
| 1 | Role chooser | Owner/operator/fleet owner/service provider sub-role | Owner sub-role determines docs |
| 2 | Mobile OTP + email | Contact OTP, email | OTP; contacts masked from farmers |
| 3 | Business profile | Proprietor/partnership/company/individual owner, operating districts, years in service, operator count | Manual cross-check signals |
| 4 | Owner KYC | Individual/proprietor: Aadhaar DigiLocker, PAN, selfie. Partnership/company: entity registration, PAN, GST, authorized signatory ID, resolution/partnership deed, bank proof | DigiLocker/PAN/penny-drop/manual queue |
| 5 | Equipment asset onboarding | Category, make/model/year, serial/chassis number optional but recommended, HP/capacity, photos, attachments, insurance, permit/RC if motor vehicle, service manual self-declaration | Image fraud checks; RC verified for regulated vehicles where API/manual available |
| 6 | Asset documents | RC/registration for tractors/harvesters/trailers if applicable, insurance certificate, fitness/permit if commercial transport rules apply, invoice/purchase proof for non-RC implements, operator license for drivers/operators where relevant | OCR + human verification; validity dates tracked |
| 7 | Payout setup | Bank account, IFSC, beneficiary name match, tax status | Penny-drop; payout hold until verified |
| 8 | Policy and liability acceptance | Equipment condition declaration, damage liability terms, cancellation rules, commission schedule, in-app-only communication | Timestamped; renewal reminder for expiring docs |
| 9 | Activation | Verification badge, asset visibility score, quote eligibility | Manual review for high-risk categories or document mismatch |

Equipment owner exact documents — Indian agri context:
- Individual/proprietor: Aadhaar via DigiLocker/masked copy, PAN, selfie/liveness, bank account proof via penny-drop; equipment RC where applicable, insurance, operator driving license for haulage/regulated operation, purchase invoice for non-RC implements.
- Partnership/LLP: partnership deed/LLP agreement, firm PAN, GST if applicable, authorized partner KYC, bank details; equipment RC/insurance/permits; declaration for cross-state movement where applicable.
- Pvt Ltd/public co: certificate of incorporation, MOA/AOA or charter, board resolution, company PAN, GSTIN, authorized signatory Aadhaar/PAN, bank details; fleet list, asset finance/NOC if encumbered, insurance, permits/fitness for commercial vehicles.
- Special categories: harvester empanelment if used for custom hiring in government schemes, pesticide spraying equipment operator certification if required by state, PUC/fitness for transport vehicles, challan/lease NOC for financed assets.

## C. Admin panel capabilities
| Module | Capabilities | SLA / controls |
|---|---|---|
| KYC verification queue | Role-filtered queues, document OCR status, DigiLocker/PAN/bank results, risk flags, approve/reject/request-more-info, bulk actions, vendor/agent assignment | Pending >24h escalation; rejection must include reason code; all decisions logged with admin ID and IP |
| User management | Search user, role change requests, suspension, warning strikes, account merge request review, blacklists by device/bank/Aadhaar hash, GDPR/data retention actions | Four-eyes approval for permanent ban; sensitive export requires reason and expiry |
| Booking oversight | Live booking states, stuck-booking detection, forced status corrections, evidence viewer, partial refunds, settlement hold/release, owner no-show mark, farmer false-confirmation mark | Status changes require note; financial actions dual-approved above threshold |
| Dispute resolution workflow | Intake from completion/damage/payment/no-show categories, auto-collect chat + status timeline + photos, evidence request, negotiation window, resolution outcomes: refund, partial refund, rework, claim denial, owner compensation, farmer compensation, chargeback defense | Triage <2h, response <24h, resolution target 3–7 days by severity; reopen window configurable |
| Commission/surge settings | Category-wise commission, min/max fee, seasonal surge caps, owner-side service fee, payment gateway fee pass-through, promo funding source, A/B pricing experiments with guardrails | Changes versioned, effective-dated, approval workflow; cannot enable contact-sharing incentives |
| Cancellation/no-show policy engine | Time-band penalties by lead time, weather exception, owner cancellation penalty, farmer cancellation penalty, no-show evidence rules, deposit retention matrix | Policy must be shown pre-booking; changes cannot apply retroactively to confirmed bookings |
| Content moderation | Pre-send message risk detection, reported chats, media review, masked contact detection, external link detection, payment hint detection, actions: warn, redact, block, suspend, escalate legal | Automated redaction for phone/email/UPI handles; appeal queue |
| Finance & reconciliation | Commission invoices, payout batches, refunds, chargebacks, TDS reports, GST reports, settlement holds, audit export | Daily reconciliation; immutable ledger; maker-checker for refunds above limit |
| Policy & CMS | Marketplace terms, state-specific clauses, FAQ/content for app only, category taxonomy, equipment spec schema, document requirements by state | No SOS/help-desk content module; publish operational policies only |
| Audit & reporting | Audit log search, admin action replay, KPI dashboards, fraud rings, seasonality reports, CSAT, dispute aging, NPS after completed jobs | Retention configurable; admin access logged; least-privilege RBAC |

## D. In-app chat architecture
| Layer | Design |
|---|---|
| Unlock rule | Chat room created only when booking status = CONFIRMED and contract accepted by both parties. Before confirmation, buttons/messages are disabled with copy: “Chat unlocks after booking confirmation.” No contact cards, call buttons, external links, or WhatsApp redirects exist anywhere. |
| Room model | One room per booking. Members: farmer, owner, optional assigned operator, system bot, dispute moderator if case opened. Metadata: bookingId, contractVersion, unlockAt, lockAt, retentionUntil. |
| Message types | text, image (produce/field/vehicle/equipment), document (invoice/receipt only from system or allowed templates), location pin (current or field/depot pin), system events (booking confirmed, en route, completed), dispute evidence marker. No audio calls, video calls, or raw contact attachments. |
| Pre-confirmation safe messaging | Structured demand card and quote card only: equipment, scope, schedule, price, terms. Free-text open chat is not available. Quote expiry and counter-offer are system objects, not chat messages. |
| Post-confirmation chat | Event-triggered opening: status EN_ROUTE or CONFIRMED + advance paid; exact field pin auto-attached by system. Farmer can send photos of field/produce condition; owner can send vehicle/implements photos. |
| Moderation | Pre-send scanner for phone/email/UPI/URLs/social handles; auto-redact and warn. Image OCR for contact text. Risk escalation on repeated attempts: restrict media, cooling-off, admin review. Report button inside chat only after unlock; reports before unlock are on quote/demand cards. |
| Audit logging | Append-only log: roomId, participants pseudonymous IDs, msgId, type, hash, sentAt, redactionVersion, moderationAction, readReceiptAt, statusEventId, disputeCaseId linkage. Preserve even after account deletion as required by law/policy. |
| Privacy | Contact numbers/emails never stored in profile-visible form for counterparties; show masked user IDs. Exact addresses unlock only after confirmation and remain visible only while booking active; revert to masked after completion except dispute retention. |
| Reliability | Message queue with idempotency keys, offline sync, retry, media via object storage with signed short-lived URLs, E2E not assumed due to moderation/audit; encryption in transit/at rest; retention schedule per Indian law and contract needs. |
| Prohibited flags | Any “Call”, “WhatsApp”, “SOS”, “Share number”, “Contact owner before booking”, external payment link, VoIP SDK, emergency help center, IoT sensor readings. All must be absent. |

## E. Edge cases and product handling
| Edge case | Detection | Handling | Violation flag check |
|---|---|---|---|
| Farmer cancellation after owner mobilized | GPS event pin “en route”, time to slot < threshold | Refund minus mobilization/travel charge if policy supports; owner evidence required; if owner already dispatched, partial release; weather override option | No contact to negotiate; all in-app dispute/claim only |
| Owner no-show | Farmer marks not arrived after grace period; owner has no start event | Auto-escalate; refund advance; no-show strike; rebook match priority; compensate per policy if premium service | Do not expose owner number; use replacement workflow |
| Farmer no-show/unavailable | Owner at pin, no access confirmation after attempts via chat/system nudges | Waiting-time charges if pre-defined; cancellation fee; field re-entry rules | No calls to farmer; structured evidence only |
| Produce/crop damage | Farmer raises damage within post-completion window; pre/post photos mismatch | Damage claim checklist: before photos, after photos, witness operator statement, weather/context notes; outcome: rework, partial refund, denial, insurance guidance if owner provided certificate | No IoT; evidence manual/photo only |
| Equipment damage by farmer/field conditions | Owner claim with completion photos, field condition notes, prior damage disclosure | Liability matrix by negligence/unknown pre-existing condition; deposit/hold if enabled; appeal path | Claims cannot request personal contact or offline payment |
| Payment dispute/chargeback | Failed capture, double debit, partial release disagreement, bank reversal | PSP evidence pack: contract, timestamps, photos, chat exports where lawful, admin notes; freeze settlement; resolve via policy | No external payment recovery messaging |
| Rate negotiation | Pre-booking counters only; post-confirmation price change attempts | Post-confirmation price changes disallowed except approved scope-change addendum signed by both; scope change creates new contract version | Block messages asking to settle offline |
| Seasonal demand spikes | Calendar heatmap, surge cap, inventory shortage | Queue/fair allocation, quote validity shortened, owner SLA tiers, dynamic but capped surge, advance-payment requirement for high-demand windows | Surge cannot incentivize bypass or contact sharing |
| Duplicate/multiple owner quotes | Same asset quoted twice, ghost inventory | Asset-level locking on acceptance; quote expiration; owner strike for acceptance breach | Do not resolve via phone; system auto-rebooks |
| Location ambiguity | Village pin vs exact field pin mismatch | Require structured field entry after confirmation; arrival radius confirmation; geofence arrival event optional | No continuous tracking |
| Review abuse/extortion | Review only after completion; pattern of threats before completion | Review withheld if dispute open; moderation on extortion language; rating-weight adjustment | No off-platform threat vector |
| KYC expiry mid-season | Document validity scheduler | Grace period with booking restrictions; payout pause; renewal nudges in-app | No document sharing with counterparties |
| Account takeover/fraud rings | Device/account/bank reuse, anomaly login | Step-up OTP, session kill, bookings frozen, evidence preserved, admin case | Incident response internal only, no SOS module |
| Force majeure/weather | Official weather alert integration optional non-IoT, user-declared rain | Weather cancellation class; reschedule credit; no-fault refund rules; surge pause | Alerts are informational, not telemetry |
| Data/law enforcement request | Valid legal process | Disclosure through compliance workflow, audit log, minimal necessary data | No public transparency feature exposing private user data |

## Explicit “not-to-do” compliance checklist
| Not allowed | Product decision | Status |
|---|---|---|
| Communication before booking confirmation | Only structured demand/quote cards; no free chat, no contact details, no call buttons | Compliant design |
| Phone number sharing | Masked IDs; OCR/redaction blocks phone/email/UPI/URLs; profile hidden fields | Compliant design |
| WhatsApp/external redirects | No external links; transactional notifications may deep-link only to in-app booking/chat | Compliant design |
| VoIP calling | No call SDK, no audio/video call UI | Excluded |
| SOS/help-section feature | No emergency/help module; standard support is admin/case based and not branded as SOS | Excluded |
| IoT/telemetrics integration | No sensor/GPS tracking; event pins optional and consent-based | Excluded |
| Offline payments/contracts | Payments and contracts only in-app with audit trail | Compliant design |
