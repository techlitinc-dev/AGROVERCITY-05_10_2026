# Review queue — human verdicts (specs §18a)

Verdicts go to config/known_gaps.yaml; not-real/duplicate-of suppress,
closed_by records the fix commit.

- [ ] #1 [expectation-mismatch] submit_lot_for_review_v1_market_lots__lot_id__submit_for_review_post: agent expected success but got 409 (403=role scope? 404=missing? 422=validation?)  
      evidence: mismatch @ persona-farmer-20261021T22-05-45--chain-wheat-market.meta.json · personas:  · score 8
- [ ] #2 [expectation-mismatch] apply_loan_v1_finance_loans_apply_post: agent expected success but got 422 (403=role scope? 404=missing? 422=validation?)  
      evidence: mismatch @ persona-farmer-20261021T22-05-45--chain-loan.meta.json · personas:  · score 6
- [ ] #3 [expectation-mismatch] create_offer_v1_offers_post: agent expected success but got 422 (403=role scope? 404=missing? 422=validation?)  
      evidence: mismatch @ persona-farmer-20261021T22-05-45--chain-wheat-market.meta.json · personas:  · score 6
- [ ] #4 [expectation-mismatch] lot_offer_board_v1_market_lots__lot_id__offers_get: agent expected success but got 403 (403=role scope? 404=missing? 422=validation?)  
      evidence: mismatch @ persona-farmer-20261021T22-05-45--chain-wheat-market.meta.json · personas:  · score 6
- [ ] #5 [bug-suspicion] OTP verify API /v1/auth/otp/verify returned 422 so could not get token needed for registration  
      evidence: blocker @ persona-farmer-20261021T22-05-45--onboard-farmer-first-run.meta.json · personas: farmer · score 3
- [ ] #6 [expectation-mismatch] reject_loan_v1_loans__applicationId__reject_post: agent expected success but got 409 (403=role scope? 404=missing? 422=validation?)  
      evidence: mismatch @ persona-farmer-20261021T22-05-45--chain-loan.meta.json · personas:  · score 3
- [ ] #7 [expectation-mismatch] register_v1_auth_register_post: agent expected success but got 422 (403=role scope? 404=missing? 422=validation?)  
      evidence: mismatch @ persona-farmer-20261021T22-05-45--onboard-farmer-first-run.meta.json · personas:  · score 3
- [ ] #8 [expectation-mismatch] otp_verify_v1_auth_otp_verify_post: agent expected success but got 422 (403=role scope? 404=missing? 422=validation?)  
      evidence: mismatch @ persona-farmer-20261021T22-05-45--onboard-farmer-first-run.meta.json · personas:  · score 3
- [ ] #9 [feature-gap] Equipment booking create karne wala endpoint  
      evidence: debrief @ persona-farmer-20261021T22-05-45--chain-equipment-rental.meta.json · personas: farmer · score 1
- [ ] #10 [feature-gap] Tractor/rotavator equipment catalog ya rental listings dekhne ka feature  
      evidence: debrief @ persona-farmer-20261021T22-05-45--chain-equipment-rental.meta.json · personas: farmer · score 1
- [ ] #11 [feature-gap] 2 din ke liye date select karke booking karne ka option  
      evidence: debrief @ persona-farmer-20261021T22-05-45--chain-equipment-rental.meta.json · personas: farmer · score 1
- [ ] #12 [feature-gap] Equipment category mein tractor+rotavator search/filter karne ka feature  
      evidence: debrief @ persona-farmer-20261021T22-05-45--chain-equipment-rental.meta.json · personas: farmer · score 1
- [ ] #13 [bug-suspicion] Equipment booking create endpoint nahi mila  
      evidence: blocker @ persona-farmer-20261021T22-05-45--chain-equipment-rental.meta.json · personas: farmer · score 1
- [ ] #14 [bug-suspicion] Tractor+rotavator ki listing/catalog nahi dikh rahi  
      evidence: blocker @ persona-farmer-20261021T22-05-45--chain-equipment-rental.meta.json · personas: farmer · score 1
- [ ] #15 [feature-gap] Loan application submission endpoint to actually apply for a new ₹1 lakh tractor loan.  
      evidence: debrief @ persona-farmer-20261021T22-05-45--chain-loan.meta.json · personas: farmer · score 1
- [ ] #16 [feature-gap] Loan-by-id GET endpoint under finance to fetch decision reason and disbursement status for a specific applicat  
      evidence: debrief @ persona-farmer-20261021T22-05-45--chain-loan.meta.json · personas: farmer · score 1
- [ ] #17 [feature-gap] Disbursement status endpoint or field in loan detail.  
      evidence: debrief @ persona-farmer-20261021T22-05-45--chain-loan.meta.json · personas: farmer · score 1
- [ ] #18 [bug-suspicion] First reject attempt failed with 409 conflict.  
      evidence: blocker @ persona-farmer-20261021T22-05-45--chain-loan.meta.json · personas: farmer · score 1
- [ ] #19 [bug-suspicion] Could not find a loan-by-id detail endpoint under /v1/finance to see decision reason and disbursement status.  
      evidence: blocker @ persona-farmer-20261021T22-05-45--chain-loan.meta.json · personas: farmer · score 1
- [ ] #20 [feature-gap] Farm diary create/update endpoint under /v1/diary  
      evidence: debrief @ persona-farmer-20261021T22-05-45--farmer-evening-round.meta.json · personas: farmer · score 1
