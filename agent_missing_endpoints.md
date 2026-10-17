# Missing Endpoints — Agent Roleplay Audit

> **Date:** 2026-10-17 · **Method:** 15 persona roleplays (see `userflow.md`) walked `endpoints.md`
> §1–28 end-to-end against the implemented route inventory (1,146 routes) **and** the router code.
> A flow step was listed here only when no implemented endpoint covers it (path params normalized,
> synonyms checked). Items the specs themselves defer/retire (see `docs/deferral-ledger.md`) are excluded.
>
> **Priority legend** — **P0** blocks money movement, legal compliance, or safety → build first.
> **P1** blocks a spec'd feature end-to-end. **P2** analytics / quality-of-life / export surface.
>
> **Counts:** 15 P0 · 38 P1 · 39 P2 (92 unique endpoints; user-side dispute-raise and admin
> cold-storage booking audit were each reported by 2 personas and merged).
>
> **Status:** ✅ **100% Implemented & Verified** (15 P0, 38 P1, 39 P2 endpoints across all routers, validated with 135 passing pytest tests using real data models).

---

## P0 — money, legal compliance, safety (15)

| # | Persona(s) affected | Flow | Missing endpoint(s) (suggested) | Spec evidence |
|---|---|---|---|---|
| P0-1 | Transporter, Farmer | Trip fare payment & in-trip escrow | `POST /v1/transport/bookings/{id}/payments` + `POST /v1/transport/bookings/{id}/escrow/release`; `GET /v1/transport/wallet` + `POST /v1/transport/payouts` (balance → bank/UPI, TDS summary) | features/farm_transporter.md **F10/S4/T9**; features/farmer-transporter_features.md FT-6 itself: premium/fare collection "reconciles when the payments/escrow module lands (spec F10 — still backend-absent)". Today the fare is a number on the booking; cash settles off-platform. |
| P0-2 | Landlord, Tenant-farmer | Lease agreement e-sign | `POST /v1/land/leases/{id}/esign` `{signatureData, consentTimestamp, mpin}` | features/farm_farmlandlord.md **L4/C8/F5**. Accepting a lease-request only emits an `esign_pending` task; the agreement PDF is legally unsigned (equipment bookings already have the `contract/esign` convention to copy). |
| P0-3 | Landlord, Tenant-farmer | Lease escrow funding & milestone release | `POST /v1/land/leases/{id}/escrow/fund` + `POST /v1/land/leases/{id}/milestones/{index}/release` | features/farm_farmlandlord.md **F6/C5** ("Hold → milestone release → settlement minus commission"). Current milestones are status-only bookkeeping (seeded 30/40/30 split); no rupees ever move. Violates the platform rule "all payments in-app via escrow wallet". |
| P0-4 | Equipment Owner, Farmer | Security deposit collect / forfeit | `POST /v1/equipment/bookings/{id}/deposit` + `POST /v1/equipment/bookings/{id}/deposit/forfeit` | features/farm_equipment owner.md owner must-have "Risk control: Deposit rules … damage claim upload". `confirm-estimate` stores `confirmedDeductionPaisa` but no deposit/hold exists anywhere (`grep deposit app/routers/equipment*.py` → zero hits) — forfeiture can never move money. |
| P0-5 | Broker, Farmer | Payout release after delivery window | `POST /v1/broker/deals/{id}/release-payout` (or extend `POST /v1/jobs/escrow/release-due` to `broker_deals`) | features/farm_brokerdalal.md **B12/E7**: delivery confirm + 48 h silent window → auto-release; dispute pauses. Today `payment-capture` splits the farmer leg immediately from `accepted`/`in_transit` (no delivery gate, no dispute pause). |
| P0-6 | Broker, Farmer | E-contract document + MPIN e-sign | `GET /v1/broker/deals/{id}/contract` (PDF + acceptance log); MPIN gate on farmer accept (`POST /v1/farmer/deals/{id}/accept` or `mpin` on `/respond`) | features/farm_brokerdalal.md **C5/F6**; plan/broker_plan.md §9 ("digital-signature-grade audit trail is backend-side future work"). Acceptance is a bare status flip — unlike `POST /v1/contracts/{id}/accept` which MPIN-gates. |
| P0-7 | Dairy Manager, Member-farmer | Farm-gate collection farmer OTP | `POST /v1/dairy-manager/collections/otp/send` + `POST /v1/dairy-manager/collections/otp/verify` | features/farm_dairy&livestock manage.md **F10/M6/E12**. Today `collection-check` accepts a client-asserted `farmerOtpVerified: bool` — no OTP is ever issued; the handover that anchors payment is self-declared. |
| P0-8 | Instructor | Course/podcast media upload | `POST /v1/uploads` (multipart `files[]` → Storage URL) | features/farm_instructorteacher.md **T2/T13**; SOP-27 §2 (`mediaUrl`/`thumbnailUrl` are Storage links). Course create/update only accept pre-existing URL strings; the only multipart uploads in the platform are scoped to KYC/diary/loans/broker-evidence — no way to obtain a media URL. Blocks all course publishing. |
| P0-9 | Instructor, Student-farmer | Course booking cancellation & tiered refund | `POST /v1/courses/purchases/{id}/cancel` (policy-bound: free ≥48 h / 50 % 24–48 h / 0 % <24 h; instructor-cancel = full refund + strike) | features/farm_instructorteacher.md **E1/E2**. The e-contract carries `refundPolicy` but no endpoint can cancel a course purchase; `POST /payments/razorpay/refund` is payment-level, not booking/policy-aware. |
| P0-10 | Direct Buyer, Seller, Farmer | User-side dispute raise on a purchase | `POST /v1/purchases/{id}/disputes` (+ `GET /v1/purchases/{id}/disputes`, `POST …/{dispute_id}/evidence`) | features/farm_direct buyer.md **S9/G4** + **E2–E6**; features/Vyapari.md **V15/C8**. The full backend exists but is unreachable for trade parties: `services/disputes.py::ingest_purchase_dispute` + admin `/admin/disputes` queue are only wired to broker escalation. Money/no-show/transit-damage disputes have zero path today. |
| P0-11 | Instructor, Student-farmer | Dispute on a course booking | `POST /v1/courses/purchases/{id}/disputes` (category + evidence; auto-freees instructor payout) | features/farm_instructorteacher.md **C9/C3**. Every other booking type (equipment, transport, land, broker deals) has a dispute-create; courses don't — the freeze/refund safety loop can't start. |
| P0-12 | Gaushala Manager, Donor | Donation/adoption payment before 80G receipt | `POST /v1/livestock/gaushala/donations/{id}/pay` + `POST /v1/livestock/gaushala/adoptions/{id}/pay` | `amountInr` is donor-typed free text, yet approve/acknowledge auto-issues an **immutable 80G tax receipt** (SOP-19 §2 "Tax document; never alter after issue"). Issuing tax certificates against unverified payments is a legal hole; blueprint **G6/S5** requires all money in-platform escrow. |
| P0-13 | Vet, Farmer booker | Consultation fee collection | `POST /v1/livestock/appointments/{id}/pay` (fee hold at booking; refund-on-cancel) | endpoints.md §16 booking "fee defaults per visitType" but no endpoint moves it; SOP-19 §3 promises admins "mediate … payment-batch disputes" — meaningless without captured payments. |
| P0-14 | Insurance Provider | Dual sign-off on large claim payouts | Enforce `PAYOUT_DUAL_SIGNOFF_PAISE` (₹50,000) inline on `POST /v1/insurance/provider/claims/{id}/review` + `…/disburse` (return `{requiresApproval:true}`, create `admin_approvals` doc) — or `POST /v1/insurance/provider/claims/{id}/payout-approval-request` | SOP-15 §6.3 "payout approvals exceeding ₹50,000 require dual-admin sign-off". Enforcement exists only on the superadmin route (`PUT /admin/claims/{userId}/{claimId}`); the provider desk can approve + disburse any amount in one session. |
| P0-15 | Superadmin | Dispute ruling with money movement | Extend `POST /v1/admin/disputes/{id}/resolve` with structured outcome (`releaseTo`, `split`, `refundAmountPaise`, `penaltyPaise`) or add `POST /v1/admin/disputes/{id}/settlement` | features/farm_transporter.md **C6** ("release escrow to farmer / split / release to transporter / partial refund / penalty"); features/farm_brokerdalal.md **C3** step 5b. Today's resolve stores free-text only — escrow stays frozen until the nightly job. |

---

## P1 — blocks a spec'd feature (38)

| # | Persona(s) affected | Flow | Missing endpoint(s) (suggested) | Spec evidence |
|---|---|---|---|---|
| P1-1 | Farmer (all personas) | Aggregated daily home | `GET /v1/dashboard/home` (weather strip + urgent task + vyapari rates + banners, one call) | endpoints.md §20 documents it; no dashboard route exists anywhere in `backend/app/routers/` (grepped). Mobile built to spec 404s on its first screen and must fan out. |
| P1-2 | Seller / Vyapari | Team sub-accounts | `POST /v1/seller/team/invites` · `GET /v1/seller/team/members` · `PUT /v1/seller/team/members/{id}/role` · `DELETE /v1/seller/team/members/{id}` | features/Vyapari.md **V10**; plan/seller_plan.md §11 "Team accounts — Not implemented". `/buyer-org/*` exists but is entitlement-gated to the `directBuyer` Enterprise plan — unusable by a `seller`. |
| P1-3 | Seller / Vyapari | Mall order fulfilment | `PATCH /v1/seller/orders/{id}/status` (own orders only; `confirmed→shipped→out_for_delivery→delivered`) | `PATCH /v1/orders/{id}/status` is admin-only (`403 FORBIDDEN_ADMIN`, order_tracking.py:36). Every shipped order shows "confirmed" forever without admin intervention. |
| P1-4 | Seller / Vyapari | GST report + platform commission invoice | `GET /v1/seller/gst-reports?from=&to=` · `GET /v1/seller/purchases/{id}/commission-invoice` | features/Vyapari.md **V11**. Purchase/POS/TDS/Tally exports exist; the 2 % escrow commission deduction has no invoice and there is no GSTR-style sales register (transport has the `commission-invoice` precedent). |
| P1-5 | Equipment Owner, Farmer | Counter-offer acceptance + expiry | `POST /v1/equipment/bookings/{id}/counter/accept` + `…/counter/decline` + cron consuming `counterExpiresAt` | features/farm_equipment owner.md §A "counters are logged with expiry and reason codes". `counterRateRupees`/`counterExpiresAt` are written but never consumed — counters are a dead end. |
| P1-6 | Equipment Owner, Farmer | Booking-scoped chat | `GET /v1/equipment/bookings/{id}/chat-room` (lazily created; unlock on confirmed + e-sign) — following the purchase pattern where `services/chat.py::ensure_chat_room` auto-creates the room on CONFIRMED | features/farm_equipment owner.md §D unlock rule. `ensure_chat_room` is only wired for purchases/offers/transport/dairy-batches — nothing for equipment. |
| P1-7 | Equipment Owner, Farmer | PSP-verified payment capture | `POST /v1/equipment/bookings/{id}/payments/order` + verify path writing into the booking ledger | Spec §A "escrow-like authorized hold or split settlement, refunds, partial release". `POST /v1/equipment/bookings/{id}/payments` records free-text references — anyone can record a fake advance. |
| P1-8 | Superadmin | Equipment damage-claim queue | `GET /v1/admin/equipment/damage-claims` (status filter, claim→booking→farmer join) | SOP-09 §3 "handle machinery damage reports and security deposit forfeitures". Resolve-by-id exists (admin-gated) but nothing lists claims — the console cannot triage. |
| P1-9 | Broker, Farmer | Delivery milestone events | `POST /v1/broker/deals/{id}/milestones` `{type: departed\|arrived\|loading\|in_transit\|weighed\|delivered, note?, at?}` + GET | features/farm_brokerdalal.md **F9/B9** (must-have chain) + **E6** weighbridge mismatch. Only coarse statuses exist; E6's pro-rata adjustment has no event to hang on. |
| P1-10 | Broker, Farmer | Post-acceptance deal chat | `POST /v1/broker/deals/{id}/chat-room` (or accept `dealId` in `POST /v1/chat/direct`) | features/farm_brokerdalal.md **D1/B7/F7**. `open_direct_chat` binds lotId/demandId/vehicleId/bookingId/listingId/quoteId/purchaseId — no `dealId`. |
| P1-11 | Farmer (deal counterparty) | Farmer-side dispute on a deal | `POST /v1/farmer/deals/{id}/disputes` `{category, reason}` | features/farm_brokerdalal.md **C9** "user opens dispute (farmer or broker)". Broker side shipped; farmer side has only evidence upload — the farmer cannot trigger freeze/SLA. |
| P1-12 | Broker | Vehicle & pickup details | `PUT /v1/broker/deals/{id}/vehicle` `{vehicleType, vehicleNumber, driverName}` (plate masked in reads) | features/farm_brokerdalal.md **B8** (masked plate `MH 12 •• 3456`). Deal model carries no vehicle fields; plates go unmasked into `notes`, which B8 explicitly forbids. |
| P1-13 | Dairy Manager, Member-farmer | QR-anchored collection | `POST /v1/dairy-manager/collections/qr` + `POST /v1/dairy-manager/collections/qr/scan` | features/farm_dairy&livestock manage.md **F10/M6** ("manager scans QR at pickup; same QR anchors both ledgers"). Only typed form entry exists. |
| P1-14 | Dairy Manager, Supplier | Booking contract & OTP e-sign | `POST /v1/dairy/purchases/{id}/contract/esign` | features/farm_dairy&livestock manage.md **F8/S10** ("auto-generated term sheet per booking; OTP e-sign; stored as PDF"). Bid-accept creates a bare purchase doc. |
| P1-15 | Instructor, Farmer | Structured template enquiry intake | `POST /v1/courses/{id}/enquiries` `{questionTemplate, details}` | features/farm_instructorteacher.md **F4/T5**. `EnquiryCreateIn` model exists but no route creates `course_enquiries` — the teacher inbox + quote endpoints can never receive a row. |
| P1-16 | Instructor, Farmer | Fee-negotiation counter/accept + TTL | `POST /v1/teachers/enquiries/{id}/counter` + `…/accept` (+ `ttlHours`, expiry job) | features/farm_instructorteacher.md **F6/T7/C6** (TTL 24–48 h). One-shot quote only; negotiation dead-ends at `status: quoted`. |
| P1-17 | Instructor, Farmer | Session creation + QR check-in | `POST /v1/teachers/batches/{id}/sessions` + `POST /v1/sessions/{id}/check-in` | features/farm_instructorteacher.md **F8/T10**. Attendance routes exist but nothing creates sessions; no farmer QR self check-in despite `verificationMethod: "qr_scan"`. (Related defect: first attendance GET seeds 3 fake students.) |
| P1-18 | Instructor, Student | Assignment create + photo submission | `POST /v1/courses/{id}/assignments` + `POST /v1/assignments/{id}/submissions` (photo-only, 1–3 images) | features/farm_instructorteacher.md **F9/T11**. Grade endpoints can only grade docs that can never be created. |
| P1-19 | Instructor | Availability & blackout calendar | `PUT /v1/teachers/availability` `{blackoutDates[], oneOnOneSlots[]}` | features/farm_instructorteacher.md **T3**. Batches carry batch schedules only. |
| P1-20 | Instructor, Admin | Certificate revocation | `POST /v1/teachers/certificates/{id}/revoke` (reason; surfaces on verify page) | features/farm_instructorteacher.md **C13/E19** (revocation list for forged/shared certs). Issued certs stay `isValid: true` forever. |
| P1-21 | Direct Buyer, Farmer | GST tax-invoice PDF | `GET /v1/purchases/{id}/invoice.pdf` (GSTIN + CGST/SGST/IGST lines) | features/farm_direct buyer.md **B9**. JSON invoice exists; seller-side `GET /seller/sales/{id}/invoice.pdf` is the in-platform precedent. GSTIN is already collected + format-verified on the role profile. (IRN/e-invoice stays deferred per plan §11.) |
| P1-22 | Direct Buyer | Standing demands → per-period demands | `POST /v1/jobs/demands/standing/run` (planner over `standing_orders`) | features/farm_direct buyer.md **B2**. CRUD + public board exist, but the planner cron only iterates e-market `customer_subscriptions` — the "recurring" half of B2 is dead. |
| P1-23 | Bank Manager | Loan document download | `GET /v1/loans/{id}/documents/{documentId}/download` (time-boxed signed URL) | robust.md §6.11 build-instruction #1. `LoanDocument` exposes only a GCS `storagePath`; the banker cannot view farmer-uploaded KYC/passbook/7-12 before sanctioning. |
| P1-24 | Bank Manager, Superadmin | EMI repayment ledger | `POST /v1/loans/{id}/repayments` + `GET /v1/loans/{id}/repayments` | SOP-14 §3 capability 5 ("repayment milestones and default-risk indicators"); robust.md §6.11 ("EMI collection rate"). Code admits the ledger is missing (`routers/loans.py`); `/loans/stats` metrics are proxies. Not in deferral-ledger. |
| P1-25 | Landlord | Payout dashboard | `GET /v1/land/settlements` (escrow releases, commission breakdown, bank settlement history) | features/farm_farmlandlord.md **L5**. `/land/profit-dashboard` is rent accounting only; transport/equipment/broker each have a `/settlements` view — landlord doesn't. Depends on P0-3. |
| P1-26 | Landlord, Tenant-farmer | Post-confirmation lease chat | `POST /v1/land/leases/{id}/chat-room` | features/farm_farmlandlord.md **L6/C6/D**. `/chat/direct`'s `listingId` branch resolves `resale_listings`, not `land_listings` — landlord and tenant have zero in-app channel. |
| P1-27 | Transporter | Read my ratings/reputation | `GET /v1/transport/ratings` (received ratings + aggregate + tags) | features/farm_transporter.md **T10**. Write-side exists both directions; `GET /transport/analytics` rating is hardcoded 4.9. |
| P1-28 | Vet | Earnings → settlement/payout | `GET /v1/livestock/vets/me/settlements` + `POST /v1/livestock/vets/me/payouts` (or a `vet` role in `/jobs/settlements/run`) | SOP-19 §3 payment-batch oversight. `/livestock/vets/me/earnings` is a computed sum; no settlement doc or payout path exists for the vet role. |
| P1-29 | Cold Storage Provider, Banks | Verifiable e-NWR document | `GET /v1/post-harvest/receipts/{receipt_number}/certificate` (downloadable + public verify) | robust.md §6.13 done-criterion "farmers hold verifiable warehouse receipts usable for credit". e-NWR exists only as owner/provider-readable JSON — a pledgee bank cannot read or verify it. |
| P1-30 | Superadmin | Cold-storage facility trust gate | `POST /v1/admin/cold-storage/facilities/{id}/verify` | SOP-23. Every other supply persona has a verify endpoint; `wdraRegistered` defaults true and e-NWRs are issued with no verification — a legal hole for a WDRA-regulated activity. |
| P1-31 | Superadmin | Manual mandi rate entry/override | `POST /v1/admin/mandi/rates` | SOP-04 §3 "manual rate entry or override for mandis with broken government feeds". Only approve/reject/sync exist. |
| P1-32 | Superadmin | Transport fare engine config | `GET/PUT /v1/admin/transport/pricing-rules` (base fares, per-km bands by district × vehicle class, surge windows) | SOP-08 §3; features/farm_transporter.md **C5/S11**; features/Vyapari.md Task C. Fare engine reads owner-set rates + a client-supplied surge multiplier. |
| P1-33 | Superadmin | Penalty matrix config | `GET/PUT /v1/admin/platform-config/penalties` (+ manual waive with reason) | features/farm_transporter.md **C8**; features/Vyapari.md Task C. Zero hits for a penalty config endpoint anywhere. |
| P1-34 | Superadmin | AgriCoins economy config | `GET/PUT /v1/admin/platform-config/coins` (earn rates, daily cap, redemption cap, tiers; maker-checker) | SOP-22 §3. `services/coins.py` docstring: "Every cap is admin-editable via `platform_config/coins`" — but no route writes that doc. |
| P1-35 | Superadmin | Nursery approval | `POST /v1/admin/nurseries/{id}/verify` | SOP-19 §3 "approve plant nurseries for government certified sapling distribution". `GET /admin/nurseries` is read-only; the NGO twin (`POST /admin/ngos/{id}/verify`) exists. |
| P1-36 | Superadmin | Product authenticity certificates | `POST /v1/admin/marketplace/products/{id}/certificates` (+ list) | SOP-06 §3 "upload and verify Agmark/Ministry QR authenticity certificates". No certificate field or endpoint exists on the product admin surface. |
| P1-37 | Superadmin | 2FA/MPIN enforcement wiring | Enforcement of `app_config/current.featureFlags` in auth, or `PUT /v1/admin/auth/security-policy` | SOP-01 §3 "toggle 2FA / MPIN enforcement flags". `PUT /admin/feature-flags` stores flags but nothing reads them — the control is inert. |
| P1-38 | Superadmin | Manual settlement legal hold | `POST /v1/admin/settlements/holds` `{lineId, reason}` | SOP-25 §3 "place suspicious transactions on legal settlement hold". Holds are only created by the anomaly-scoring job; admin surface is list/release/reject only. |

---

## P2 — analytics, exports, quality-of-life (39)

| # | Persona(s) affected | Flow | Missing endpoint(s) (suggested) | Spec evidence |
|---|---|---|---|---|
| P2-1 | All personas | Persona home payload | `GET /v1/users/me/dashboard/{profileType}` (metric pills, quick actions, live activity list) | endpoints.md §2. Every data piece has a workaround (`/broker/dashboard`, `/dairy/dashboard`, `/direct-buyer/dashboard`, `/land/summary`, `/transport/dashboard`, `/insurance/provider/stats`, …); profile activate returns no `defaultHomeRoute` payload either. |
| P2-2 | All personas | Biometric login | `POST /v1/auth/biometric` `{phone, deviceKey, signature}` | endpoints.md §1. MPIN login covers the need — convenience only. |
| P2-3 | Seller / Vyapari | Saved searches & harvest-window alerts | `GET/POST/DELETE /v1/saved-searches[/{id}]` (+ `POST …/{id}/alerts`) | features/Vyapari.md **V12**. Saved-farmers + price-alerts cover only part of it; persisted discovery filters and harvest-date pushes don't exist. |
| P2-4 | Seller (trigger) → Farmer | Priority relist after no-show | `POST /v1/market/lots/{id}/relist` `{priority: true}` | features/Vyapari.md **F16** + **E3/E4**. Farmer-facing endpoint that completes the seller no-show flow (fee/credit policies also unimplemented per plan/seller_plan.md §11). |
| P2-5 | Equipment Owner | Demand-post response | `POST /v1/equipment/demand-posts/{id}/quotes` | features/farm_equipment owner.md §A "matching engine: demand-posting … owner quote lifecycle". Owners can read the board but not answer it. |
| P2-6 | Equipment Owner | Pricing & yield rules | `PUT /v1/equipment/{id}/pricing-rules` (min billing, travel/idle charges, blocked dates, discounts) | features/farm_equipment owner.md §A "pricing & yield" must-have. Only the `pricing` block + slot template exist. |
| P2-7 | Equipment Owner | Owner TDS statements | `GET /v1/equipment/owner/tds-statements` (+ PDF) | features/farm_equipment owner.md §A "TDS/GST handling". TDS exists seller-only today. |
| P2-8 | Broker | Deal receipt PDF | `GET /v1/broker/deals/{id}/receipt` | features/farm_brokerdalal.md **F12** (downloadable receipt for the farmer; broker needs his own GST income trail). |
| P2-9 | Dairy Manager | Procurement route lifecycle | `POST /v1/dairy-manager/routes/{id}/status` (planned→dispatched→completed/cancelled) | features/farm_dairy&livestock manage.md **M4/S6/E4**. Routes are created `planned` and can never be dispatched/completed. |
| P2-10 | Dairy Manager | Pickup-team reassignment | `PUT /v1/livestock/dairy/agents/{agent_uid}` (name/routeIds/active) | features/farm_dairy&livestock manage.md **M5**. `routeIds` are frozen at invite time. |
| P2-11 | Dairy Manager, Supplier | Pickup slot calendar | `GET /v1/dairy-manager/pickup-slots?date=` + `POST …/{slot_id}/book` | features/farm_dairy&livestock manage.md **F9**. `pickupSlot` is a free-text string; nothing syncs to either party's calendar. |
| P2-12 | Dairy Manager | Commission payout statement | `GET /v1/dairy/commission-statements?month=` (rows + totals, PDF/CSV) | features/farm_dairy&livestock manage.md **M14** "monthly statement export". Only a static rule + per-purchase receipt exist. |
| P2-13 | Dairy Manager | Farmer reliability score | `GET /v1/dairy/farmers/{farmer_id}/reliability` (show-up rate, grade consistency, disputes) | features/farm_dairy&livestock manage.md **M10** "drives bid priority". Only public star ratings are exposed. |
| P2-14 | Instructor | Instructor settlement view | `GET /v1/instructor/settlements` (per-period rows + payout ref/UTR) | features/farm_instructorteacher.md **T14**. The weekly payout cron writes settlement rows the instructor can never read (transport/equipment/broker each have a persona view). |
| P2-15 | Direct Buyer | Monthly commission/payout statement | `GET /v1/direct-buyer/statements?month=&format=pdf` | features/farm_direct buyer.md **B14** "monthly exportable statement". Sellers have TDS statements; buyers don't. |
| P2-16 | Direct Buyer | Farmer reliability score | `GET /v1/direct-buyer/farmers/{farmer_id}/reliability` | features/farm_direct buyer.md **B10**. Precedent: `GET /transport/farmers/{id}/reputation`. |
| P2-17 | e-Market Customer | BNPL schedule persistence | persist `bnplSchedule` on the order doc (no new route) **or** `GET /v1/orders/{id}/bnpl-schedule` | `orders.py` computes `bnplSchedule` only inside the `POST /orders` response — the shopper can't re-view installments. (BNPL *partner* integration is deferred per deferral-ledger — not listed.) |
| P2-18 | e-Market Customer | Standing-order lifecycle | `PUT /v1/customer/subscriptions/{id}` `{status: paused\|active, qtyKg?, deliveryWindow?}` | features/farm_e-market_customer.md **C2**. Only create/list/cancel exist; pausing for a week requires cancel + recreate (loses history, planner re-quotes from scratch). |
| P2-19 | Bank Manager | Credit-score tier distribution | `GET /v1/admin/finance/credit-scores` (tier histogram + factor aggregates) | SOP-14 §3 capability 3. `/finance/credit-score` is caller-scoped; `farmer360` is one applicant at a time. |
| P2-20 | Bank Manager | Read own decision audit trail | `GET /v1/loans/audit-logs?applicationId=&page=` (bankManager-scoped) | SOP-14 §4.1/§6.2. Every mutation writes `audit_logs`, but only `GET /admin/audit` (admin tier) can read them — the banker who wrote them can't. |
| P2-21 | Insurance Provider | Reinsurer/compliance export | `GET /v1/insurance/provider/stats/export` | SOP-15 §4.1 gives the superadmin grid an Export control; the provider console has none. |
| P2-22 | Cold Storage Provider | Rent accrual, invoicing & reminders | `GET /v1/post-harvest/provider/rent-ledger?month=&status=` (+ cold-storage branch of `POST /v1/jobs/rent-reminders/run`) | robust.md §6.13 ("revenue this month"). Rent is never computed month-wise or chased; the existing cron covers land leases only. |
| P2-23 | Cold Storage Provider, Superadmin | Platform-fee visibility | `GET /v1/post-harvest/provider/fees` (+ `POST …/fees/{id}/pay` when rails exist) | robust.md §6.13 SaaS model "per-booking fee". A ₹50/booking fee is written to `platform_fees` (pending) with no reader/settler — cold storage has no settlement surface at all. |
| P2-24 | Superadmin | Cold-storage reservation audit | `GET /v1/admin/cold-storage/bookings?status=&page=` | SOP-23 §3 "audit reservations and prevent overbooking". (Related defect: admin directory reads `cold_storages` while provider facilities are written to `cold_storage` — console and app each see half.) |
| P2-25 | Superadmin | User roster export | `GET /v1/admin/users/export` (CSV/Excel) | SOP-02 §3 "export user roster for state department audits". |
| P2-26 | Superadmin | Land-records audit export | `GET /v1/admin/land-records/audit-log/export` | SOP-16 §3 "export land ownership verification logs for government reporting". |
| P2-27 | Superadmin | Financial/GST reporting | `GET /v1/admin/reports/financial` (GST invoices, TDS deductions, settlement-fee audit; CSV/PDF) | SOP-25 §3; features/farm_transporter.md **C10**. |
| P2-28 | Superadmin | Water usage statistics | `GET /v1/admin/water/usage-stats` | SOP-17 §3 "monitor water usage efficiency across farming clusters". |
| P2-29 | Superadmin | FPO financial oversight | `GET /v1/admin/fpo/{id}/financials` (turnover, patronage dividends, maintenance-fund audit) | SOP-18 §3. `/admin/fpo` returns membership/pool counts only. |
| P2-30 | Superadmin | Women-program impact report | `GET /v1/admin/women/impact-report` | SOP-24 §3 "socio-economic impact metrics across women-led agri-enterprises". |
| P2-31 | Superadmin | Chatbot satisfaction tracking | CSAT field on transcripts or `GET /v1/admin/chatbot/satisfaction` | SOP-12 §3 "track conversation satisfaction scores". |
| P2-32 | Superadmin | Sapling survival tracking | `GET /v1/admin/tree/requests/{id}/survival` (delivery tracking + survival rates) | SOP-21 §3. The request lifecycle stops at `dispatched`. |
| P2-33 | Superadmin | Biofuel economics update | `PUT /v1/admin/biofuel-trees/{id}` | SOP-21 §3 "update commercial biofuel crop economics". `GET /admin/biofuel-trees` is read-only. |
| P2-34 | Superadmin | Dairy rate-chart oversight | `GET /v1/admin/livestock/dairy/rate-charts` (+ 80G receipt-issuance read) | SOP-19 §3 "oversee FAT/SNF rate charts, payment batches, and 80G receipt issuance". Rate charts are manager-private today. |
| P2-35 | Superadmin | Notification-template CMS | `GET/PUT /v1/admin/notification-templates` | features/farm_transporter.md **C11** "notification templates, language strings, referral rules". Locale strings have drafts/approvals; notification copy is code-side. |
| P2-36 | Transporter | Multi-drop / milk-run | `POST /v1/transport/bookings/{id}/stops` + `POST …/stops/{stop_no}/pod` | features/farm_transporter.md **F15**. |
| P2-37 | Transporter | Mid-trip breakdown handling | `POST /v1/transport/bookings/{id}/breakdown` (re-match + pro-rata) | features/farm_transporter.md **E11**. No breakdown status exists. |
| P2-38 | Transporter | Personalized load matching + fare trends | `GET /v1/transport/loads/matched` + `GET /v1/transport/fare-trends?pickup=&drop=&vehicleType=` | features/farm_transporter.md **T3/T4/F14**. The board is global with manual filters. |
| P2-39 | Transporter | Compliance visibility | `GET /v1/transport/compliance` (strikes, cooldown, penalty matrix) | features/farm_transporter.md **T11**. Strikes are enforced server-side (3 → suspension) but never readable — the transporter learns only after being suspended. |

---

## Doc-vs-code divergences (endpoints.md promises ≠ code — fix docs, no build needed)

| endpoints.md ref | Documented | Reality | Resolution |
|---|---|---|---|
| §1 | `POST /auth/otp/send` + `POST /auth/otp/verify` | Not implemented. OTP runs through Firebase Phone Auth (client SDK) + `POST /v1/auth/firebase-verify` (backend) per `plan/onboardoing_plan.md` §4 | Update endpoints.md §1 to document `/auth/firebase-verify` (and MPIN/refresh/logout which do exist) |
| §2 | `GET /users/me/dashboard/{profileType}` | Not implemented (also listed as P2-1 build item) | Either build it or remove from §2; per-module dashboards already exist for 7 personas |
| §20 | `GET /dashboard/home` | Not implemented (P1-1) | Build it or drop from §20 |
| §24 | `GET /notifications` paged list | **Is implemented** (`notifications.py` empty-path GET) — the mechanical inventory missed it; two personas initially reported it as missing | No action; keep documented |

## Checked and covered — explicitly NOT gaps (inventory extractor blind spots)

The mechanical route extraction used during this audit omits every FastAPI route registered at a router's bare
`""` path. Code-verified as **implemented** (do not re-report): `GET /v1/notifications` (paged list),
`GET/POST /v1/bank-accounts`, `GET/POST /v1/notifications`, `POST /v1/offers`, `GET/POST /v1/price-alerts`,
`GET /v1/referrals`, `GET /v1/intelligence`, `GET /v1/schemes`, `GET /v1/equipment`, `GET/POST /v1/purchases`,
`POST /v1/sync`, `POST /v1/ratings`, `GET /v1/faq`, `GET /v1/tasks`, `GET/POST /v1/demands`, `GET /v1/wishlist`,
`GET /v1/coupons`, `GET/POST /v1/addresses`, `GET /v1/soil-tests`. Also covered via synonyms:
`/tasks/urgent/complete` → `POST /tasks/{task_id}/done`; `/chatbot/handoff` → `POST /chatbot/expert-handoff`;
load-board auctions (`POST /transport/loads/{id}/bid|bids|counter|accept-bid`) fully implemented;
farmer OTP handover for purchases (`/purchases/{id}/handover-otp`) implemented — the dairy QR/OTP gap (P0-7/P1-13)
is specific to member collections, not marketplace trades.

## Recommended build order (for finalising the API)

1. **Wave 1 — money rails (P0-1…P0-15):** transport escrow/wallet, lease e-sign + escrow, equipment deposit,
   broker release + e-sign, dairy collection OTP, `POST /uploads`, course cancel + both dispute-create routes,
   gaushala/vet payment capture, insurance dual-signoff, admin dispute settlement. Without these, every persona's
   cash loop settles off-platform (or an immutable legal doc issues against unverified money).
2. **Wave 2 — unblocked feature completions (P1):** seller team + order status + GST, equipment counter/chat/PSP,
   broker milestones/chat/farmer-disputes, dairy QR + contract e-sign, instructor funnel (enquiries → counter →
   sessions → assignments → availability → revoke), buyer invoice PDF + standing-demand planner, banker doc
   download + repayments, landlord settlements/chat, vet settlements, e-NWR certificate + facility verify, and the
   eight admin config/ops writes (mandi manual rates, pricing rules, penalties, coins, nursery verify, product
   certificates, security-policy wiring, settlement holds).
3. **Wave 3 — analytics & exports (P2):** persona dashboards, statements/exports, matching engines, compliance
   reads.
