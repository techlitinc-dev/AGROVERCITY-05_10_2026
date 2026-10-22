# Agrovercity Sim Report

generated: 2026-10-21 22:17:57 · runs: 9 · cumulative cost: $0.1783 · persona: farmer

## 1. Executive summary

- missing-feature candidates: **34**
- userflow obstacles: **13**
- dataflow suspicions: **0**
- security probes: **1/2 passed**
- blocked identities (harness gaps, specs §18i): **0**
- avg satisfaction: 1.17

## 2. Missing-feature board

| # | finding | class | score | personas | evidence |
|---|---|---|---|---|---|
| 1 | submit_lot_for_review_v1_market_lots__lot_id__submit_for_review_post: agent expected success but got 409 (403=role scope? 404=missing? 422=validation?) | expectation-mismatch | 8 |  | mismatch@persona-farmer-20261021T22-05-45--chain-wheat-market; mismatch@persona-farmer-20261021T22-05-45--farmer-low-literacy-sale |
| 2 | apply_loan_v1_finance_loans_apply_post: agent expected success but got 422 (403=role scope? 404=missing? 422=validation?) | expectation-mismatch | 6 |  | mismatch@persona-farmer-20261021T22-05-45--chain-loan |
| 3 | create_offer_v1_offers_post: agent expected success but got 422 (403=role scope? 404=missing? 422=validation?) | expectation-mismatch | 6 |  | mismatch@persona-farmer-20261021T22-05-45--chain-wheat-market |
| 4 | lot_offer_board_v1_market_lots__lot_id__offers_get: agent expected success but got 403 (403=role scope? 404=missing? 422=validation?) | expectation-mismatch | 6 |  | mismatch@persona-farmer-20261021T22-05-45--chain-wheat-market |
| 5 | OTP verify API /v1/auth/otp/verify returned 422 so could not get token needed for registration | bug-suspicion | 3 | farmer | blocker@persona-farmer-20261021T22-05-45--onboard-farmer-first-run |
| 6 | reject_loan_v1_loans__applicationId__reject_post: agent expected success but got 409 (403=role scope? 404=missing? 422=validation?) | expectation-mismatch | 3 |  | mismatch@persona-farmer-20261021T22-05-45--chain-loan |
| 7 | register_v1_auth_register_post: agent expected success but got 422 (403=role scope? 404=missing? 422=validation?) | expectation-mismatch | 3 |  | mismatch@persona-farmer-20261021T22-05-45--onboard-farmer-first-run |
| 8 | otp_verify_v1_auth_otp_verify_post: agent expected success but got 422 (403=role scope? 404=missing? 422=validation?) | expectation-mismatch | 3 |  | mismatch@persona-farmer-20261021T22-05-45--onboard-farmer-first-run |
| 9 | Equipment booking create karne wala endpoint | feature-gap | 1 | farmer | debrief@persona-farmer-20261021T22-05-45--chain-equipment-rental |
| 10 | Tractor/rotavator equipment catalog ya rental listings dekhne ka feature | feature-gap | 1 | farmer | debrief@persona-farmer-20261021T22-05-45--chain-equipment-rental |
| 11 | 2 din ke liye date select karke booking karne ka option | feature-gap | 1 | farmer | debrief@persona-farmer-20261021T22-05-45--chain-equipment-rental |
| 12 | Equipment category mein tractor+rotavator search/filter karne ka feature | feature-gap | 1 | farmer | debrief@persona-farmer-20261021T22-05-45--chain-equipment-rental |
| 13 | Equipment booking create endpoint nahi mila | bug-suspicion | 1 | farmer | blocker@persona-farmer-20261021T22-05-45--chain-equipment-rental |
| 14 | Tractor+rotavator ki listing/catalog nahi dikh rahi | bug-suspicion | 1 | farmer | blocker@persona-farmer-20261021T22-05-45--chain-equipment-rental |
| 15 | Loan application submission endpoint to actually apply for a new ₹1 lakh tractor loan. | feature-gap | 1 | farmer | debrief@persona-farmer-20261021T22-05-45--chain-loan |
| 16 | Loan-by-id GET endpoint under finance to fetch decision reason and disbursement status for a specific applicat | feature-gap | 1 | farmer | debrief@persona-farmer-20261021T22-05-45--chain-loan |
| 17 | Disbursement status endpoint or field in loan detail. | feature-gap | 1 | farmer | debrief@persona-farmer-20261021T22-05-45--chain-loan |
| 18 | First reject attempt failed with 409 conflict. | bug-suspicion | 1 | farmer | blocker@persona-farmer-20261021T22-05-45--chain-loan |
| 19 | Could not find a loan-by-id detail endpoint under /v1/finance to see decision reason and disbursement status. | bug-suspicion | 1 | farmer | blocker@persona-farmer-20261021T22-05-45--chain-loan |
| 20 | Farm diary create/update endpoint under /v1/diary | feature-gap | 1 | farmer | debrief@persona-farmer-20261021T22-05-45--farmer-evening-round |

## 3. Failure taxonomy (top)

| endpoint | errors |
|---|---|
| `submit_lot_for_review_v1_market_lots__lot_id__submit_for_review_post` | 4 |
| `create_offer_v1_offers_post` | 3 |
| `lot_offer_board_v1_market_lots__lot_id__offers_get` | 3 |
| `apply_loan_v1_finance_loans_apply_post` | 2 |
| `reject_loan_v1_loans__applicationId__reject_post` | 1 |
| `register_v1_auth_register_post` | 1 |
| `otp_verify_v1_auth_otp_verify_post` | 1 |

## 4. Stuck report

- **chain-equipment-rental** (farmer): no actions logged — outcome step_cap
- **chain-loan** (farmer): no actions logged — outcome step_cap
- **chain-wheat-market** (farmer): repeated create_offer_v1_offers_post (status 422) near end of run — outcome step_cap
- **farmer-evening-round** (farmer): repeated list_prices_v1_mandi_prices_get (status 200) near end of run — outcome step_cap
- **farmer-low-literacy-sale** (farmer): repeated lot_offer_board_v1_market_lots__lot_id__offers_get (status 200) near end of run — outcome step_cap
- **farmer-sell-wheat** (farmer): repeated list_prices_v1_mandi_prices_get (status 200) near end of run — outcome stuck_no_progress
- **onboard-farmer-first-run** (farmer): repeated otp_verify_v1_auth_otp_verify_post (status 422) near end of run — outcome step_cap

## 6. Friction index

| scenario | outcome | steps | p95 ms | SLO | sat |
|---|---|---|---|---|---|
| chain-equipment-rental | step_cap | 12 | 0 | ✅ | 1 |
| chain-loan | step_cap | 30 | 144 | ✅ | 1 |
| chain-wheat-market | step_cap | 30 | 86 | ✅ | - |
| farmer-evening-round | step_cap | 25 | 33 | ✅ | 2 |
| farmer-low-literacy-sale | step_cap | 25 | 67 | ✅ | 1 |
| farmer-sell-wheat | stuck_no_progress | 16 | 43 | ✅ | 1 |
| onboard-farmer-first-run | step_cap | 24 | 6 | ✅ | 1 |

## 7. Security probes

- ❌ Revoked tokens rejected (sec-revoked-token)
- ✅ User tokens rejected on admin endpoints (RBAC) (sec-role-cross-call)

## 8. Coverage (must_touch keywords seen in requests)

- **farmer** (22 ops): ✓

## 9. Verbatim frustrations

> "Arre baar baar wahi check-in aur payment wale endpoints aa rahe hain, tractor+rotavator book karne ka rasta hi nahi mil raha!"
> — farmer, chain-equipment-rental

> "Arre bhai, main toh ₹1 lakh ka tractor loan lene aaya tha, par yahan toh kisi aur ka loan reject karne wala system khul gaya aur detail status dhoondhte-dhoondhte thak gaya!"
> — farmer, chain-loan

> "Mandi ka daam to aa gaya, lekin baar-baar search karne ke baad bhi diary, crop doctor aur sarkari yojna ka koi raasta nahi mila."
> — farmer, farmer-evening-round

> "Bhai, teen baar submit dabaya par baar-baar 409 aa raha hai, koi batayega bhi nahi iska matlab kya hai!"
> — farmer, farmer-low-literacy-sale

> "Baar-baar mandi price check kiya par asal rate hi nahi dikhaya, aur abhi tak lot banane ka option bhi nahi mila — time barbaad ho raha hai!"
> — farmer, farmer-sell-wheat

> "Arre pehle hi register karne mein 422 aa gaya, OTP bhej toh diya lekin verify ka schema samajh nahi aaya, kheti ka kaam chhod ke yeh search-search karna pad raha hai!"
> — farmer, onboard-farmer-first-run

---
*Suspicions are heuristics, not verdicts — work the review queue.*
