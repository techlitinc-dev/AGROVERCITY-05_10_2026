# Review queue — human verdicts (specs §18a)

Verdicts go to config/known_gaps.yaml; not-real/duplicate-of suppress,
closed_by records the fix commit.

- [ ] #1 [expectation-mismatch] list_open_loads_v1_transport_loads_get: agent expected success but got 403 (403=role scope? 404=missing? 422=validation?)  
      evidence: mismatch @ smoke-20261021T17-57-07--transporter-run-trip.meta.json · personas:  · score 8
- [ ] #2 [expectation-mismatch] get_transporter_profile_v1_transport_profile_get: agent expected success but got 403 (403=role scope? 404=missing? 422=validation?)  
      evidence: mismatch @ smoke-20261021T17-57-07--transporter-run-trip.meta.json · personas:  · score 6
- [ ] #3 [bug-suspicion] GET /v1/finance/loans returned 403 Forbidden  
      evidence: blocker @ smoke-20261021T17-57-07--bank-loan-pipeline.meta.json · personas: bankManager · score 3
- [ ] #4 [feature-gap] Wallet balance aur wallet payment ka endpoint visibility, kyunki wallet se pay karna tha par koi wallet/paymen  
      evidence: debrief @ smoke-20261021T17-57-07--customer-buy-basket.meta.json · personas: customer · score 3
- [ ] #5 [bug-suspicion] Product nahi milne ki wajah se cart, wallet payment, tracking ya rating tak pahunch hi nahi payi.  
      evidence: blocker @ smoke-20261021T17-57-07--customer-buy-basket.meta.json · personas: customer · score 3
- [ ] #6 [feature-gap] Wallet balance check nahi ho paya - /v1/transport/wallet 403 tha  
      evidence: debrief @ smoke-20261021T17-57-07--transporter-run-trip.meta.json · personas: transporter · score 3
- [ ] #7 [bug-suspicion] Wallet check karne bhi 403 mila  
      evidence: blocker @ smoke-20261021T17-57-07--transporter-run-trip.meta.json · personas: transporter · score 3
- [ ] #8 [expectation-mismatch] list_loans_v1_finance_loans_get: agent expected success but got 403 (403=role scope? 404=missing? 422=validation?)  
      evidence: mismatch @ smoke-20261021T17-57-07--bank-loan-pipeline.meta.json · personas:  · score 3
- [ ] #9 [expectation-mismatch] transport_wallet_v1_transport_wallet_get: agent expected success but got 403 (403=role scope? 404=missing? 422=validation?)  
      evidence: mismatch @ smoke-20261021T17-57-07--transporter-run-trip.meta.json · personas:  · score 3
- [ ] #10 [bug-suspicion] Market lots browse bhi weekly vegetable basket wala option nahi dikhaya.  
      evidence: blocker @ smoke-20261021T17-57-07--customer-buy-basket.meta.json · personas: customer · score 2
- [ ] #11 [feature-gap] Load search ya filter Rajkot-Ahmedabad ke liye kabhi khula nahi - /v1/transport/loads hamesha 403 raha  
      evidence: debrief @ smoke-20261021T17-57-07--transporter-run-trip.meta.json · personas: transporter · score 2
- [ ] #12 [bug-suspicion] Transport loads endpoint 403 FORBIDDEN_ROLE aa raha tha  
      evidence: blocker @ smoke-20261021T17-57-07--transporter-run-trip.meta.json · personas: transporter · score 2
- [ ] #13 [bug-suspicion] Transport profile endpoint bhi 403 de raha tha  
      evidence: blocker @ smoke-20261021T17-57-07--transporter-run-trip.meta.json · personas: transporter · score 2
- [ ] #14 [bug-suspicion] PUT /v1/transport/profile 403 fail ho gaya  
      evidence: blocker @ smoke-20261021T17-57-07--transporter-run-trip.meta.json · personas: transporter · score 2
- [ ] #15 [expectation-mismatch] update_transporter_profile_v1_transport_profile_put: agent expected success but got 403 (403=role scope? 404=missing? 422=validation?)  
      evidence: mismatch @ smoke-20261021T17-57-07--transporter-run-trip.meta.json · personas:  · score 2
- [ ] #16 [feature-gap] capability not found via search: 'Pahle sahi tareeke se Anand ka gehun ka bhav dekhna hai, parameters kya hain pata karo.'  
      evidence: zero-search @ smoke-20261021T17-57-07--farmer-sell-wheat.meta.json · personas: ? · score 1
- [ ] #17 [feature-gap] An endpoint or UI action to approve a pending KCC loan application  
      evidence: debrief @ smoke-20261021T17-57-07--bank-loan-pipeline.meta.json · personas: bankManager · score 1
- [ ] #18 [feature-gap] An endpoint or UI action to disburse the approved KCC loan  
      evidence: debrief @ smoke-20261021T17-57-07--bank-loan-pipeline.meta.json · personas: bankManager · score 1
- [ ] #19 [bug-suspicion] No approve action was recorded for the KCC loan  
      evidence: blocker @ smoke-20261021T17-57-07--bank-loan-pipeline.meta.json · personas: bankManager · score 1
- [ ] #20 [bug-suspicion] No disburse action was recorded after approval  
      evidence: blocker @ smoke-20261021T17-57-07--bank-loan-pipeline.meta.json · personas: bankManager · score 1
