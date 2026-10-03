# Phase 02 — Trade & Logistics Spokes Close-out

> Turn the five trade/logistics personas into full SaaS applications: refactor the
> Landlord (`LandlordHomeBoard.tsx`) and Equipment Owner (`EquipmentOwnerHomeBoard.tsx`)
> monoliths into routed LandBank / MachineBazaar apps, close the remaining plan gaps in
> the already-strong Transporter (AgriFleet), Vyapari (FarmLink) and Broker (DealDesk)
> spokes, and land the five spoke AI decision briefs (seller rate band, transport
> matching, broker lead scoring, equipment recommendations, land listing quality) at
> `suggest`-level automation behind flags. Sources: `missing-features/robust.md`
> §6.2–6.6, §10, §11 phase 2A; `missing-features/ai.md` flows 5.5, 5.6, 5.9 + catalog
> A4, A6, A13, B9, B10, B12, B13, C2, C4; `missing-features/ai_implementation_plan.md`
> §2–§3, briefs M4, M16, M19, M24, M25; `plan/transporters_plan.md` §11,
> `plan/seller_plan.md` §11, `plan/broker_plan.md` §11.

## Depends on
- **phase-00** — money rails (Razorpay order/verify/webhook, escrow, RazorpayX weekly
  payout client, `platform_config/settlements` commission config, integer-paisa
  `audit_logs`), KYC pipeline (document upload, review queue, expiry tracking),
  billing entitlements (plan enforcement per persona tier matrix), and the AI
  foundation (brief M1: `backend/app/services/ai/gateway.py` with `decide()`,
  `generate()`, `analyze_image()`, `question_sets.py`, `privacy.py`, `ai_decisions`
  logging, `platform_config/ai` flags, `AI_PROVIDER=shim` mode).
- **phase-01** — task engine (`/v1/tasks`, `emit_task()`) and the Action Center
  dashboard grid every persona board must feed.

## Workstreams
| WS | Title | Source | Output (what exists when done) |
|---|---|---|---|
| WS-01 | Landlord "LandBank" close-out | robust.md §6.2; ai.md flow 5.9 | Monolith split into routed views (Plots, Listings+wizard, Requests inbox, Leases/e-sign, Rent tracker, Analytics, 7/12 vault); Mahabhulekh adapter behind interface with "unverified" labeling; rent escalation + receipts + ledger export; farmer-side browse/request; dispute lane; tiers Free/Pro ₹299/Enterprise |
| WS-02 | Transporter "AgriFleet" close-out | robust.md §6.3; transporters_plan.md §11 | OTP POD, bid counters, damage dispute lane, penalties/no-show, return-load matching (T8), driver sub-users (T9), surge cap 1.5×; KYC gate RC/DL/fitness + expiry; RazorpayX weekly payouts + trip P&L + commission invoices; live tracking via PWA pings; `lotId` linkage; tiers Free/Pro ₹499/Enterprise, 10% commission |
| WS-03 | Vyapari "FarmLink" close-out | robust.md §6.4; seller_plan.md §11; features/Vyapari.md | Rate guardrails S2 (±25% + 2h edit window, server-enforced); weighbridge slip photo; paid/udhaar status + farmer trust card; udhaar ledger S7 + GST invoice S6 + TDS 194-O; probation (3-booking, ₹50k escrow cap) + Verified Vyapari badge; B2B buyer network S5; shop KYC S1; tiers Free/Pro ₹999/Enterprise, 2% min ₹50 |
| WS-04 | Equipment Owner "MachineBazaar" close-out | robust.md §6.5; features/farm_equipment owner.md | Monolith split (Fleet, Booking queue, Dispatch, Damage claims, Maintenance, ROI analytics); farmer rental UI (browse/slot calendar/book/waitlist/cancel); maintenance log + reminders E3; damage-deposit photo claims E5; KYC E1; pricing engine hourly/acre/package + FPO auto-confirm; E4-lite check-in; real 12% payouts; tiers Free/Pro ₹399/Enterprise |
| WS-05 | Broker "DealDesk" close-out | robust.md §6.6; broker_plan.md §11 | Offer TTL 24–48h auto-expire; 3-round counter cap + deadlock resolution; documents vault B4; buyer requirement postings B3; real commission payout B6 via RazorpayX; Razorpay split B7; broker KYC + trust tiers B1 (48–72h SLA); ratings backend; dispute workflow; tiers Free 5 deals/Pro ₹799, 2% configurable 0–10 |
| WS-06 | AI spoke decisions (M4, M16, M19, M24, M25) | ai_implementation_plan.md §2–§3 + briefs; ai.md flows 5.5/5.6/5.9 | `seller.rate_check.v1` (422 band payload + manipulation flag + nightly forecast card); `transport.match.v1` (batch ranking + return-load card + no-show risk); `broker.lead_score.v1` (quality + deadlock risk at round 2); equipment approve-recommendation + G-vision damage severity; `land.listing_quality.v1` (tips + rent band + tenant compatibility) — all `suggest`-level, flagged, shim-safe |

## Out of scope
- Flutter apps (`apps/mobile`, `apps/admin`, `flutter-prototype`) — web only.
- The Mahabhulekh/e-District **real** integration itself (adapter interface +
  "unverified" honesty labeling ship here; the live government API integration is
  deferred with a dated note).
- GPS telematics / dedicated driver app (PWA manual pings are v1); SMS fallback.
- Transport escrow/payments for the fare itself (F10/S4/S12 — money rails carry
  commission + payouts only); vyapari purchase escrow upgrade beyond phase-00 rails.
- Admin console build-out (phase-07): this phase only creates the dispute/KYC queue
  **records and endpoints** the console will consume.
- AI briefs M3 (offer scoring), M8 (fraud/payout anomaly), M12 (mandi forecast) —
  assigned to other phases; M4/M16/M19/M24/M25 only here.
- Voice AI (M27/C1/C19 retired program-wide).

## Exit gate (done when)
- [ ] Landlord: lists a plot, signs a lease, receives rent into a verified bank
      account with zero offline steps (robust §6.2 Done-when).
- [ ] Transporter: earns, tracks costs, and is paid out weekly end-to-end via
      RazorpayX; a farmer watches his produce move in real time (§6.3 Done-when).
- [ ] Vyapari: replaces the physical bahi-khata entirely; farmer-visible provable
      payment tracking live (§6.4 Done-when).
- [ ] Equipment owner: runs bookings → dispatch → damage → service → payout from
      the dashboard; a farmer books a tractor slot in <60 s (§6.5 Done-when).
- [ ] Broker: runs 50+ concurrent deals with provable commission accounting; no
      phone number reachable in any surface (§6.6 Done-when).
- [ ] Both monolith refactors routed via registries + `App.tsx`, zero
      `alert()`/`confirm()`, en+hi parity for every new key.
- [ ] All five AI briefs live behind `platform_config/ai` flags at `suggest`; flags
      off → deterministic fallbacks work; `ai_decisions` rows written with cost +
      confidence; no PII (Aadhaar/phone/email) in any AI payload.
- [ ] Global verification gate (execution-plan/README.md §4) green:
      `cd backend && .venv/bin/python -m pytest -q` green;
      `cd website && pnpm exec tsc --noEmit && pnpm build` clean; full suite green
      with `AI_PROVIDER=shim`; one end-to-end dashboard task → completion flow per
      workstream exercised manually.

## Estimated effort
Weeks 4–8 of the program (robust.md §11 phase 2A, runs after phases 00–01 land).
