# Agrovercity Sim Report

generated: 2026-10-21 18:01:45 · runs: 5 · cumulative cost: $0.0913

## 1. Executive summary

- missing-feature candidates: **36**
- userflow obstacles: **8**
- dataflow suspicions: **0**
- security probes: **0/0 passed**
- blocked identities (harness gaps, specs §18i): **0**
- avg satisfaction: 1.2

## 2. Missing-feature board

| # | finding | class | score | personas | evidence |
|---|---|---|---|---|---|
| 1 | list_open_loads_v1_transport_loads_get: agent expected success but got 403 (403=role scope? 404=missing? 422=validation?) | expectation-mismatch | 8 |  | mismatch@smoke-20261021T17-57-07--transporter-run-trip |
| 2 | get_transporter_profile_v1_transport_profile_get: agent expected success but got 403 (403=role scope? 404=missing? 422=validation?) | expectation-mismatch | 6 |  | mismatch@smoke-20261021T17-57-07--transporter-run-trip |
| 3 | GET /v1/finance/loans returned 403 Forbidden | bug-suspicion | 3 | bankManager | blocker@smoke-20261021T17-57-07--bank-loan-pipeline |
| 4 | Wallet balance aur wallet payment ka endpoint visibility, kyunki wallet se pay karna tha par koi wallet/paymen | feature-gap | 3 | customer | debrief@smoke-20261021T17-57-07--customer-buy-basket |
| 5 | Product nahi milne ki wajah se cart, wallet payment, tracking ya rating tak pahunch hi nahi payi. | bug-suspicion | 3 | customer | blocker@smoke-20261021T17-57-07--customer-buy-basket |
| 6 | Wallet balance check nahi ho paya - /v1/transport/wallet 403 tha | feature-gap | 3 | transporter | debrief@smoke-20261021T17-57-07--transporter-run-trip |
| 7 | Wallet check karne bhi 403 mila | bug-suspicion | 3 | transporter | blocker@smoke-20261021T17-57-07--transporter-run-trip |
| 8 | list_loans_v1_finance_loans_get: agent expected success but got 403 (403=role scope? 404=missing? 422=validation?) | expectation-mismatch | 3 |  | mismatch@smoke-20261021T17-57-07--bank-loan-pipeline |
| 9 | transport_wallet_v1_transport_wallet_get: agent expected success but got 403 (403=role scope? 404=missing? 422=validation?) | expectation-mismatch | 3 |  | mismatch@smoke-20261021T17-57-07--transporter-run-trip |
| 10 | Market lots browse bhi weekly vegetable basket wala option nahi dikhaya. | bug-suspicion | 2 | customer | blocker@smoke-20261021T17-57-07--customer-buy-basket |
| 11 | Load search ya filter Rajkot-Ahmedabad ke liye kabhi khula nahi - /v1/transport/loads hamesha 403 raha | feature-gap | 2 | transporter | debrief@smoke-20261021T17-57-07--transporter-run-trip |
| 12 | Transport loads endpoint 403 FORBIDDEN_ROLE aa raha tha | bug-suspicion | 2 | transporter | blocker@smoke-20261021T17-57-07--transporter-run-trip |
| 13 | Transport profile endpoint bhi 403 de raha tha | bug-suspicion | 2 | transporter | blocker@smoke-20261021T17-57-07--transporter-run-trip |
| 14 | PUT /v1/transport/profile 403 fail ho gaya | bug-suspicion | 2 | transporter | blocker@smoke-20261021T17-57-07--transporter-run-trip |
| 15 | update_transporter_profile_v1_transport_profile_put: agent expected success but got 403 (403=role scope? 404=missing? 422=validation?) | expectation-mismatch | 2 |  | mismatch@smoke-20261021T17-57-07--transporter-run-trip |
| 16 | capability not found via search: 'Pahle sahi tareeke se Anand ka gehun ka bhav dekhna hai, parameters kya hain pata karo.' | feature-gap | 1 | ? | zero-search@smoke-20261021T17-57-07--farmer-sell-wheat |
| 17 | An endpoint or UI action to approve a pending KCC loan application | feature-gap | 1 | bankManager | debrief@smoke-20261021T17-57-07--bank-loan-pipeline |
| 18 | An endpoint or UI action to disburse the approved KCC loan | feature-gap | 1 | bankManager | debrief@smoke-20261021T17-57-07--bank-loan-pipeline |
| 19 | No approve action was recorded for the KCC loan | bug-suspicion | 1 | bankManager | blocker@smoke-20261021T17-57-07--bank-loan-pipeline |
| 20 | No disburse action was recorded after approval | bug-suspicion | 1 | bankManager | blocker@smoke-20261021T17-57-07--bank-loan-pipeline |

## 3. Failure taxonomy (top)

| endpoint | errors |
|---|---|
| `list_open_loads_v1_transport_loads_get` | 4 |
| `get_transporter_profile_v1_transport_profile_get` | 3 |
| `list_loans_v1_finance_loans_get` | 1 |
| `transport_wallet_v1_transport_wallet_get` | 1 |
| `update_transporter_profile_v1_transport_profile_put` | 1 |

## 4. Stuck report

- **customer-buy-basket** (customer): repeated list_products_v1_products_get (status 200) near end of run — outcome step_cap
- **farmer-sell-wheat** (farmer): repeated mandi_list_v1_mandi_list_get (status 200) near end of run — outcome step_cap
- **seller-procure-and-sell** (seller): repeated vyapari_rates_v1_mandi_vyapari_rates_get (status 200) near end of run — outcome step_cap
- **transporter-run-trip** (transporter): repeated activate_profile_v1_users_me_profiles__profile_type__activate_post (status 200) near end of run — outcome step_cap

## 6. Friction index

| scenario | outcome | steps | p95 ms | SLO | sat |
|---|---|---|---|---|---|
| bank-loan-pipeline | done | 7 | 45 | ✅ | 2 |
| customer-buy-basket | step_cap | 30 | 417 | ❌ | 1 |
| farmer-sell-wheat | step_cap | 30 | 70 | ✅ | 1 |
| seller-procure-and-sell | step_cap | 30 | 28 | ✅ | 1 |
| transporter-run-trip | step_cap | 30 | 39 | ✅ | 1 |

## 8. Coverage (must_touch keywords seen in requests)

- **transporter** (6 ops): ⚠️ bookings
- **farmer** (2 ops): ⚠️ market, lots, demands
- **bankManager** (4 ops): ⚠️ applications, kyc
- **seller** (3 ops): ⚠️ seller, pos
- **customer** (4 ops): ⚠️ marketplace, orders, cart, wallet

## 9. Verbatim frustrations

> "I can read the file, but where are the approve and disburse buttons? I cannot clear this loan from the queue with GET calls alone."
> — bankManager, bank-loan-pipeline

> "Bhai, itni der se product list aur prod-3 ghumake thak gayi, par mall wala weekly vegetable basket mila hi nahi — app ne dukaan ki jagah beej aur khad dikha di!"
> — customer, customer-buy-basket

> "Bhai, baar baar tamatar ka daam dikhata raha, mujhe toh Anand ka gehu bechna tha, param samajh nahi aaya toh lot banane tak kabhi pahuncha hi nahi!"
> — farmer, farmer-sell-wheat

> "Baar-baar same endpoint daba ke bhi pyaaj ka bhav nahi aaya, sirf tamatar dikha raha hai — time barbaad ho gaya aur kharidari bhi nahi ho paayi."
> — seller, seller-procure-and-sell

> "Bhai, itna ghumaya transporter banne ke liye, load list tak nahi khula, OTP toh door ki baat hai, ye app direct bata nahi sakta tha ke pehle profile activate karni hai?"
> — transporter, transporter-run-trip

---
*Suspicions are heuristics, not verdicts — work the review queue.*
