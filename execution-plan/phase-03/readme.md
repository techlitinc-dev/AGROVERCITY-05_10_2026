# Phase 03 — Finance & Ops Console Personas

> Build the five money-and-operations consoles that today have working FastAPI backends but
> zero (or placeholder) web UI — Bank Manager "CreditDesk", Insurance "ClaimsDesk", Cold
> Storage "StoreHouse" — and finish the two partially-landed consoles — Dairy "DairyOS"
> (marketplace vision) and Direct Buyer "ProcurePro" (industrial procurement layer) — plus
> Gaushala/Vet polish and the four console-side AI decision briefs. Sources: robust.md §6.7,
> §6.9, §6.11–§6.14; plan/dairy_plan.md; plan/direct_buyer_plan.md; AI briefs M14, M15, M17,
> M18; ai.md flows 5.7, 5.8.

## Depends on

- **phase-00** — money rails (Razorpay escrow + RazorpayX payouts for WS-01/02/03/04/05),
  KYC pipeline (FSSAI/IEC/APEDA/GST doc types for WS-01/02), billing + entitlements
  (tier enforcement in every WS), AI foundation `backend/app/services/ai/`
  (gateway/question_sets/privacy/budgets — consumed by WS-07), audit_logs plumbing.
- **phase-01** — task engine + Action Center deep links (farmer doc-request tasks WS-03,
  claim feedback tasks WS-04, vaccination tasks WS-06, missing-doc tasks WS-07).

## Workstreams

| WS | Title | Source | Output (what exists when done) |
|---|---|---|---|
| WS-01 | Dairy "DairyOS" marketplace vision | robust.md §6.7, plan/dairy_plan.md §11 | RFQ→bid→QR-collection→escrow-OTP loop live both faces; route planner + pickup-agent seats; FSSAI KYC gate; real payouts + PDF statements; farmer milk-money ledger; SMS/WhatsApp slips; tiers Free 25 / Pro ₹1,499 / Enterprise + 3%/5%/2% commissions |
| WS-02 | Direct Buyer "ProcurePro" finish | robust.md §6.9, plan/direct_buyer_plan.md P2/P4/P5/P9/P11/P12 | 3-round counters; spec templates + sliding QC settlement with photos; pickup mode/slot; team RBAC admin/procurement/qa/finance; DemandDetailPage+BidTable; KYC doc submission; grow-for-us card polish; tiers Free 1 / Pro ₹4,999 / Enterprise ₹24,999 + 1–2% commission |
| WS-03 | Bank "CreditDesk" console | robust.md §6.11, ai.md 5.7 | Full web console on `loans.py`: filtered queue, farmer-360 detail, approve/reject/info-request action bar with audit+reason, disbursal + EMI schedule, portfolio/NPA overview; farmer mirror tracker + doc tasks + EMI reminders; ₹2,000/seat + origination fee tracking |
| WS-04 | Insurance "ClaimsDesk" console | robust.md §6.12, ai.md 5.8 | Provider claims pipeline intimation→surveyor→assessment→approval→DBT with geo-photo viewer and stats; farmer 72-h intimation + tracker + appeal; rate-editor seam noted for phase-07; per-claim fee + console licensing |
| WS-05 | Cold Storage "StoreHouse" console | robust.md §6.13 | Facility/chamber management, booking review, inward register, release workflow, utilization analytics; farmer directory + booking + warehouse-receipt vault linked to CreditDesk as loan collateral; Pro ₹1,999/facility + per-booking fee |
| WS-06 | Gaushala + Vet polish | robust.md §6.14 | Vet credential verification flag + admin seam; vet Pro ₹299/mo enforcement; 80G receipt automation; public gaushala donations transparency page; herd-health vaccination tasks in task engine |
| WS-07 | AI console decisions | AI briefs M14, M15, M17, M18; ai.md 5.7/5.8 | `loans.prescreen.v1`, `insurance.triage.v1`, `dairy.adulteration.v1`, `contracts.attractiveness.v1` live at suggest level via gateway, with deterministic fallbacks and ai_decisions logging |

## Out of scope

- Admin console screens themselves (KYC approval queue, corporate-buyer verification, rate-table
  admin editor UI, vet verification queue UI) — those land in phase-07; this phase builds the
  submission sides and backend flags only.
- AI grading vision for cold storage (M10) and disease scan — phase-05; WS-05 only leaves the
  integration point (`/post-harvest/grade` stub stays a stub).
- Crop-insurance module polish beyond the claims mirror (§7.9) — phase-05 module sweep.
- Voice/SMS telephony infra beyond the existing notify/FCM seam; WhatsApp Business API keys are
  config, not code.
- Flutter apps; B2B API (R7); anything listed in plan/direct_buyer_plan.md §11 "no backend".

## Exit gate (done when)

- [ ] Bank manager clears a daily queue fully in-app; every approve/reject/info-request decision has an `audit_logs` entry with reason
- [ ] An insurance claim is trackable farmer-side like a courier package (intimated→surveyorAssigned→fieldAssessed→dbtApproved→disbursed) and cycle time is measurable from `insurance.py` stats
- [ ] Cold storage runs a digital chamber register (inward/release) and a farmer holds a verifiable warehouse receipt retrievable via `/post-harvest/receipts/{receipt_number}` and attachable as loan collateral in CreditDesk
- [ ] A dairy member farmer sees his own milk-money ledger (slips + payments + net) in his dashboard; batch mark-paid executes through the real payout rail
- [ ] Direct buyer runs QC with measured parameters + photos and sliding per-parameter settlement computes to the rupee on both parties' screens — no spreadsheet step
- [ ] 3-round counter cap enforced (`NEGOTIATION_CLOSED` past cap); org role gates return 403 `ORG_ROLE_REQUIRED`
- [ ] AI never auto-approves credit/insurance: `loans.prescreen.v1` and `insurance.triage.v1` annotate only (status mutations unchanged), `fraud_signal > 0.8` flags but never rejects; `require_confirm` cap respected
- [ ] No tier gate bypassed: dairy 25-member Free cap, directBuyer 1-contract Free cap, vet ₹299 Pro, cold-storage ₹1,999 Pro per facility all enforced server-side
- [ ] Global verification gate (execution-plan/README.md §4) green

## Estimated effort

Weeks 6–10 of the roadmap (robust.md §11 Phase 2B — "Console personas"), assuming phase-00/01
landed. WS-03/04/05 are pure web builds on existing backends; WS-01/02 are deltas; WS-07 is
four SDR briefs.
