# AGROVERCITY Deferral Ledger (robust.md §13 rule 10)

> Every persona (robust §6.1–6.14), module (§7.1–7.24), AI catalog ID (ai.md §4),
> and phase workstream (00–07) is either SHIPPED (with an evidence pointer) or
> DEFERRED/RETIRED with an explicit dated note. Every row carries a status.

| ID | Item | Status (SHIPPED / DEFERRED / RETIRED) | Evidence link or dated deferral note |
| persona.6.1 | Farmer (Kisan) | SHIPPED | phase-01–07 exit gates; execution-plan/phase-0X/summary.md |
| persona.6.2 | Farm Landlord (LandBank) | SHIPPED | phase-01–07 exit gates; execution-plan/phase-0X/summary.md |
| persona.6.3 | Transporter (AgriFleet) | SHIPPED | phase-01–07 exit gates; execution-plan/phase-0X/summary.md |
| persona.6.4 | Seller/Vyapari (FarmLink) | SHIPPED | phase-01–07 exit gates; execution-plan/phase-0X/summary.md |
| persona.6.5 | Equipment Owner (MachineBazaar) | SHIPPED | phase-01–07 exit gates; execution-plan/phase-0X/summary.md |
| persona.6.6 | Broker/Dalal (DealDesk) | SHIPPED | phase-01–07 exit gates; execution-plan/phase-0X/summary.md |
| persona.6.7 | Dairy Manager (DairyOS) | SHIPPED | phase-03–07 exit gates; execution-plan/phase-0X/summary.md |
| persona.6.8 | Instructor (Krishi Academy) | SHIPPED | phase-03–07 exit gates; execution-plan/phase-0X/summary.md |
| persona.6.9 | Direct Buyer (ProcurePro) | SHIPPED | phase-03–07 exit gates; execution-plan/phase-0X/summary.md |
| persona.6.10 | e-Market Customer (FarmGate) | SHIPPED | phase-01–07 exit gates; execution-plan/phase-0X/summary.md |
| persona.6.11 | Bank Manager (CreditDesk) | SHIPPED | phase-01–07 exit gates; execution-plan/phase-0X/summary.md |
| persona.6.12 | Insurance Provider (ClaimsDesk) | SHIPPED | phase-01–07 exit gates; execution-plan/phase-0X/summary.md |
| persona.6.13 | Cold Storage Provider (StoreHouse) | SHIPPED | phase-01–07 exit gates; execution-plan/phase-0X/summary.md |
| persona.6.14 | Gaushala + Vet | SHIPPED | phase-01–07 exit gates; execution-plan/phase-0X/summary.md |
| module.7.1 | Mandi Prices (mandi) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.2 | AI Advisory (advisory) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.3 | Marketplace (marketplace) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.4 | Buyers & Contracts (buyers) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.5 | Profit & Loss / Farm CEO (profitLoss) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.6 | Water Intelligence (water) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.7 | Government Schemes (schemes) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.8 | Finance (finance) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.9 | Crop Insurance PMFBY (cropInsurance) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.10 | Land & Legal 7/12 (landLegal) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.11 | FPO Engine (fpo) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.12 | Women Farmer Hub (womenFarmer) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.13 | Climate & Carbon (climate) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.14 | Post-Harvest (postHarvest) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.15 | Krishi Ratna Gamification (krishiRatna) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.16 | Refer & Earn (referEarn) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.17 | Farm Diary (farmDiary) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.18 | Agri News (agriNews) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.19 | Live Channels (liveChannels) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.20 | Livestock & Dairy (livestockDairy) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.21 | Gyan Hub (gyanHub) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.22 | Tree Plantation & Biofuel (treePlantation) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.23 | Equipment Rental — farmer face (equipment) | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| module.7.24 | All-Tools launcher + search | SHIPPED | phase-02–07 exit gates; views/ + routers/ present |
| ai.A1 | AI A1 (tasks.rank.v1) | SHIPPED | question_sets.py registered; golden fixture present |
| ai.A2 | AI A2 (notify.timing.v1) | SHIPPED | question_sets.py registered; golden fixture present |
| ai.A3 | AI A3 (notify.copy.v1) | SHIPPED | question_sets.py registered; golden fixture present |
| ai.A4 | AI A4 (seller.rate_check.v1) | SHIPPED | question_sets.py registered; golden fixture present |
| ai.A5 | AI A5 (trade.offer_score.v1) | DEFERRED | DEFERRED 2026-10-08 — offer-quality scoring not in v1 catalog; revisit post-beta |
| ai.A6 | AI A6 (trust.fraud.v1) | SHIPPED | question_sets.py registered; golden fixture present |
| ai.A7 | AI A7 (chat.guardrail.v1) | SHIPPED | question_sets.py registered; golden fixture present |
| ai.A8 | AI A8 (kyc.extract.v1 + kyc.authenticity_risk.v1) | SHIPPED | question_sets.py registered; golden fixture present |
| ai.A9 | AI A9 (dispute.triage.v1) | SHIPPED | question_sets.py registered; golden fixture present |
| ai.A10 | AI A10 (chatbot.intent.v1) | SHIPPED | question_sets.py registered; golden fixture present |
| ai.A11 | AI A11 (search.intent.v1) | SHIPPED | question_sets.py registered; golden fixture present |
| ai.A12 | AI A12 (content.moderation.v1) | SHIPPED | question_sets.py registered; golden fixture present |
| ai.A13 | AI A13 (trust.payout_anomaly.v1) | SHIPPED | question_sets.py registered; golden fixture present |
| ai.B1 | AI B1 (mandi.smart_select.v1) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B2 | AI B2 (advisory.saturation.v1) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B3 | AI B3 (disease photo gate + vision) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B4 | AI B4 (grading.gate.v1) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B5 | AI B5 (marketplace product recommendations) | DEFERRED | DEFERRED 2026-10-08 — marketplace product recommendations not in v1 AI catalog; revisit post-beta |
| ai.B6 | AI B6 (contracts.attractiveness.v1) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B7 | AI B7 (loans.prescreen.v1) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B8 | AI B8 (insurance.triage.v1) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B9 | AI B9 (transport.match.v1) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B10 | AI B10 (equipment.booking_rec.v1 + damage vision) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B11 | AI B11 (dairy.adulteration.v1) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B12 | AI B12 (broker.lead_score.v1) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B13 | AI B13 (land.listing_quality.v1) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B14 | AI B14 (courses.recommend.v1 + grade suggest) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B15 | AI B15 (schemes.match.v1) | SHIPPED | question_sets.py + golden fixture; shim-green |
| ai.B16 | AI B16 (women.shg_readiness.v1) | SHIPPED | phase-08 WS-01; services/shg_readiness.py + tests/test_shg_readiness.py |
| ai.B17 | AI B17 (weather spray-window class) | DEFERRED | DEFERRED 2026-10-08 — weather spray-window class not in v1 AI catalog; revisit post-beta |
| ai.C1 | AI C1 (Voice AI assistant) | RETIRED | RETIRED 2026-10-08 — voice AI descoped (brief M27) |
| ai.C2 | AI C2 (Receipt & weigh-slip scan) | SHIPPED | phase-08 WS-01; routers/diary.py receipt-scan + fixtures/receipt_scan |
| ai.C3 | AI C3 (Mandi price forecast) | SHIPPED | phase-0X catalog brief shipped; service/router present |
| ai.C4 | AI C4 (Demand forecast (vyapari/dairy)) | DEFERRED | DEFERRED 2026-10-08 — Demand forecast (vyapari/dairy) out of v1 beta scope |
| ai.C5 | AI C5 (AI crop planner) | SHIPPED | phase-0X catalog brief shipped; service/router present |
| ai.C6 | AI C6 (Negotiation coach) | SHIPPED | phase-0X catalog brief shipped; service/router present |
| ai.C7 | AI C7 (Onboarding copilot) | SHIPPED | phase-08 WS-01; reference.district_crops + onboarding |
| ai.C8 | AI C8 (Pest outbreak early warning) | SHIPPED | phase-0X catalog brief shipped; service/router present |
| ai.C9 | AI C9 (Yield estimation) | DEFERRED | DEFERRED 2026-10-08 — Yield estimation out of v1 beta scope |
| ai.C10 | AI C10 (Smart matchmaking) | DEFERRED | DEFERRED 2026-10-08 — Smart matchmaking out of v1 beta scope |
| ai.C11 | AI C11 (Doc vault intelligence) | SHIPPED | phase-0X catalog brief shipped; service/router present |
| ai.C12 | AI C12 (Personalized advisory feed) | SHIPPED | phase-0X catalog brief shipped; service/router present |
| ai.C13 | AI C13 (AI support agent) | SHIPPED | phase-0X catalog brief shipped; service/router present |
| ai.C14 | AI C14 (Admin copilot) | SHIPPED | phase-0X catalog brief shipped; service/router present |
| ai.C15 | AI C15 (Localization pipeline) | SHIPPED | phase-0X catalog brief shipped; service/router present |
| ai.C16 | AI C16 (Churn prediction) | SHIPPED | phase-08 WS-01; services/churn.py + tests/test_churn.py |
| ai.C17 | AI C17 (Farmer standing agent) | SHIPPED | phase-08 WS-01; services/agent_rules.py + routers/agent_rules.py |
| ai.C18 | AI C18 (WhatsApp companion bot) | DEFERRED | DEFERRED 2026-10-08 — allowed only post-DLT/template approval |
| ai.C19 | AI C19 (Voice AI (features)) | RETIRED | RETIRED 2026-10-08 — voice AI features descoped |
| ai.C20 | AI C20 (Learning paths) | SHIPPED | phase-0X catalog brief shipped; service/router present |
| ai.M27 | AI M27 (Voice AI brief) | RETIRED | RETIRED 2026-10-08 — voice AI brief descoped |
| phase-00.workstreams | Phase-00 all workstreams (WS-01…WS-NN) | SHIPPED | phase-00 exit gate passed; execution-plan/phase-00/summary.md |
| phase-01.workstreams | Phase-01 all workstreams (WS-01…WS-NN) | SHIPPED | phase-01 exit gate passed; execution-plan/phase-01/summary.md |
| phase-02.workstreams | Phase-02 all workstreams (WS-01…WS-NN) | SHIPPED | phase-02 exit gate passed; execution-plan/phase-02/summary.md |
| phase-03.workstreams | Phase-03 all workstreams (WS-01…WS-NN) | SHIPPED | phase-03 exit gate passed; execution-plan/phase-03/summary.md |
| phase-04.workstreams | Phase-04 all workstreams (WS-01…WS-NN) | SHIPPED | phase-04 exit gate passed; execution-plan/phase-04/summary.md |
| phase-05.workstreams | Phase-05 all workstreams (WS-01…WS-NN) | SHIPPED | phase-05 exit gate passed; execution-plan/phase-05/summary.md |
| phase-06.workstreams | Phase-06 all workstreams (WS-01…WS-NN) | SHIPPED | phase-06 exit gate passed; execution-plan/phase-06/summary.md |
| phase-07.workstreams | Phase-07 all workstreams (WS-01…WS-NN) | SHIPPED | phase-07 exit gate passed; execution-plan/phase-07/summary.md |
| deferral.C18 | WhatsApp companion bot | DEFERRED | DEFERRED 2026-10-08 — post-DLT/template approval only |
| deferral.X16 | Streaming infra beyond embedded licensed streams | DEFERRED | DEFERRED 2026-10-08 — embedded licensed streams only for beta |
| deferral.Mahabhulekh | Mahabhulekh / e-District real adapter | DEFERRED | DEFERRED 2026-10-08 — stub gateway; real adapter post-beta (gateway_health probes stub) |
| deferral.carbonMRV | Carbon MRV integration | DEFERRED | DEFERRED 2026-10-08 — no MRV partner in beta |
| deferral.BNPL | BNPL partner integration | DEFERRED | DEFERRED 2026-10-08 — no BNPL partner in beta |
| deferral.weighslip | Weigh-slip / weighbridge scan reuse (vyapari procurement + transporter trip records) | DEFERRED | DEFERRED 2026-10-08 — phases 02/03 procurement/trip surfaces expose no scan hook; reuse services/receipt_scan.py when wired |
