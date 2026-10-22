# Agrovercity Sim Report

generated: 2026-10-21 21:56:45 · runs: 2 · cumulative cost: $0.0205

## 1. Executive summary

- missing-feature candidates: **10**
- userflow obstacles: **4**
- dataflow suspicions: **0**
- security probes: **0/0 passed**
- blocked identities (harness gaps, specs §18i): **0**
- avg satisfaction: 1.0

## 2. Missing-feature board

| # | finding | class | score | personas | evidence |
|---|---|---|---|---|---|
| 1 | Koi load select, quote, accept, OTP handover ya wallet check tak pahuncha nahi. | bug-suspicion | 3 | transporter | blocker@oneshot-20261021T21-54-59--transporter-run-trip |
| 2 | Bar bar tomato/dairy jaisi galat commodity ka rate aa raha tha, wheat ka nahi | bug-suspicion | 2 | farmer | blocker@oneshot-20261021T21-52-56--farmer-sell-wheat |
| 3 | Query params dhoondhne mein madad karne wala helper/search ya dropdown jisme mandi aur commodity select kar sa | feature-gap | 1 | farmer | debrief@oneshot-20261021T21-52-56--farmer-sell-wheat |
| 4 | Urea ka rate check karne ka alag saral option | feature-gap | 1 | farmer | debrief@oneshot-20261021T21-52-56--farmer-sell-wheat |
| 5 | Anand mandi ke ghehu ka sahi rate nahi mila kyunki /v1/mandi/prices endpoint ke query params pata nahi chale | bug-suspicion | 1 | farmer | blocker@oneshot-20261021T21-52-56--farmer-sell-wheat |
| 6 | Price check ke bina aage lot create nahi kar paya, offer bhi nahi dekh paya | bug-suspicion | 1 | farmer | blocker@oneshot-20261021T21-52-56--farmer-sell-wheat |
| 7 | Origin-destination city filter ya search option loads list mein | feature-gap | 1 | transporter | debrief@oneshot-20261021T21-54-59--transporter-run-trip |
| 8 | Endpoint query parameters ki clear documentation / schema | feature-gap | 1 | transporter | debrief@oneshot-20261021T21-54-59--transporter-run-trip |
| 9 | Rajkot se Ahmedabad ka load kabhi nahi mila, sirf Malegaon-Surat / Nasik-Surat wale loads aa rahe the. | bug-suspicion | 1 | transporter | blocker@oneshot-20261021T21-54-59--transporter-run-trip |
| 10 | list_open_loads endpoint ke query params / filter schema ka pata nahi chala. | bug-suspicion | 1 | transporter | blocker@oneshot-20261021T21-54-59--transporter-run-trip |

## 4. Stuck report

- **farmer-sell-wheat** (farmer): repeated list_prices_v1_mandi_prices_get (status 200) near end of run — outcome stuck_no_progress
- **transporter-run-trip** (transporter): repeated list_open_loads_v1_transport_loads_get (status 200) near end of run — outcome stuck_repeat

## 6. Friction index

| scenario | outcome | steps | p95 ms | SLO | sat |
|---|---|---|---|---|---|
| farmer-sell-wheat | stuck_no_progress | 27 | 109 | ✅ | 1 |
| transporter-run-trip | stuck_repeat | 23 | 91 | ✅ | 1 |

## 8. Coverage (must_touch keywords seen in requests)

- **transporter** (1 ops): ⚠️ bookings, wallet
- **farmer** (1 ops): ⚠️ market, lots, demands

## 9. Verbatim frustrations

> "Bhai, itni der se Anand ka gehu ka bhav nikaal raha hoon, har baar kuchh aur hi aa jaata hai, params ka koi sahi jawaab nahi milta, dimaag kharab ho gaya!"
> — farmer, farmer-sell-wheat

> "Bhai itni der laga di, phir bhi Rajkot se Ahmedabad ka ek bhi load nahi mila, aur wallet toh dekhe hi nahi — bas Malegaon-Surat dikhaata raha, time barbaad ho gaya."
> — transporter, transporter-run-trip

---
*Suspicions are heuristics, not verdicts — work the review queue.*
