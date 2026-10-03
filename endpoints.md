# AGROVERCITY / Kisan Setu — Backend API Specification

> Required REST endpoints to rebuild the prototype with a real backend.
> Derived from `lib/state/app_state.dart` (every state-mutating method) and the 30
> entities in `lib/models/app_models.dart`. Field names below match the prototype models.

## Conventions

- **Base URL:** `https://api.agrovercity.in/v1` (placeholder)
- **Auth:** OTP-verified session → JWT access token (`Authorization: Bearer <token>`) + refresh token. MPIN is a second factor for sensitive actions (payments, contracts, claims).
- **Language:** `Accept-Language: hi|mr|gu|pa|te|ta|en` header; responses include vernacular fields regardless.
- **Offline support:** all POST/PUT/DELETE accept `Idempotency-Key` header; clients queue writes while offline and replay via `POST /sync`.
- **Pagination:** `?page=&pageSize=` on all list endpoints; response envelope `{ "data": [...], "page": 1, "pageSize": 20, "total": 134 }`.
- **Errors:** `{ "error": { "code": "STRING_CODE", "message": "...", "fieldErrors": {} } }`, HTTP 4xx/5xx.
- **Roles:** `roles` column = personas allowed (server must enforce the same ACL as `profile_routes.dart`). `all` = all 6 personas.

---

## 1. Auth & Onboarding

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/auth/otp/send` | Send OTP to mobile. Body: `{ phone }`. Returns `{ otpSessionId, expiresInSec: 300, resendAfterSec: 30 }`. (AppState: `loginWithPhone`) | public |
| POST | `/auth/otp/verify` | Verify OTP. Body: `{ phone, otp, otpSessionId }`. Returns `{ accessToken, refreshToken, isNewUser, user }`. | public |
| POST | `/auth/login` | Login with MPIN. Body: `{ phone, mpin }`. Returns tokens + user. (AppState: `loginWithMobileAndMpin`) | public |
| POST | `/auth/mpin/reset` | Reset MPIN via OTP. Body: `{ phone, otp, otpSessionId, newMpin }`. (AppState: `resetMpinWithOtp`) | public |
| POST | `/auth/biometric` | Biometric login (device-bound key exchange). Body: `{ phone, deviceKey, signature }`. | public |
| POST | `/auth/refresh` | Refresh access token. Body: `{ refreshToken }`. | public |
| POST | `/auth/logout` | Invalidate session. (AppState: `logout`) | all |
| POST | `/auth/register` | Complete registration wizard. Body: `{ name, phone, state, district, tehsil, village, landAreaAcres, soilType, irrigationType, crops[], mpin, profiles[], primaryProfile }`. Returns user + tokens. (AppState: `completeRegistration`) | public |
| PUT | `/users/me/farm-boundary` | Save farm geofence. Body: `{ farmBoundaryPoints: [{lat, lng}], landAreaAcres, khasraNumber? }`. (AppState: `confirmFarmMap`) | farmer |

## 2. User Profile & Multi-Profile

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/users/me` | Full `FarmerProfile`: `{ id, name, vernacularName, phone, village, tehsil, district, state, landAreaAcres, soilType, irrigationType, kisanCreditScore, creditTier, krishiRatnaLevel, krishiRatnaTitle, streakDays, agriCoins, bankName, kccLimit, activeCrops[], farmBoundaryPoints[] }` + `linkedProfiles[], activeProfile`. | all |
| PUT | `/users/me` | Update profile fields (village, crops, soil, irrigation, land area…). | all |
| POST | `/users/me/profiles` | Link a new profile. Body: `{ profileType }` (farmer/farmLandlord/transport/seller/equipmentRental/broker). (AppState: `linkNewProfile`) | all |
| DELETE | `/users/me/profiles/{type}` | Unlink profile; **409 if last remaining** ("कम से कम एक प्रोफाइल आवश्यक है"). | all |
| POST | `/users/me/profiles/{type}/activate` | Switch active profile. Returns profile meta + `defaultHomeRoute`. (AppState: `switchProfile`) | all |
| PUT | `/users/me/profiles/{type}/primary` | Star a profile as primary. | all |
| PUT | `/users/me/settings` | `{ language, womenMode, highContrast, darkMode }`. | all |
| GET | `/users/me/dashboard/{profileType}` | Persona home payload: metric pills, quick actions, live activity list (leases/trips/ledger/fleet/deals per role). | all |

## 3. Reference & Geo

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/geo/reverse?lat=&lng=` | Reverse-geocode → `{ state, district, region, suggestedLanguages[] }` for onboarding language suggestion. | public |
| GET | `/regions/crops?district=` | District crop mapping (agro-climatic). Returns `{ district, kharif[], rabi[], suggested[] }`. Source: ICRISAT / State Agri Dept. | public |
| GET | `/languages` | Supported languages + regional mapping + per-language greeting `audioText`. | public |

## 4. Mandi Prices & Live Rates

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/mandi/prices?crop=&district=&lat=&lng=&page=` | List `MandiPrice[]`: `{ id, mandiName, distanceKm, commodity, variety, minPrice, maxPrice, modalPrice, msp, trend, changePercent, arrivalsQuintals, updatedAt }`. Source: **Agmarknet/eNAM**. | farmer, seller, broker |
| GET | `/mandi/vyapari-rates?crops=` | "Aaj ke Bhav" widget: `VyapariRate[]` `{ id, crop, rateDisplay, priceChange, changeDir, mandiName, vyapariCount, lastUpdated }`. Source: vyapari partner portal, Agmarknet fallback; refreshed 2-hourly 06:00–20:00; server caches for offline reads. | farmer, seller, broker |
| GET | `/mandi/compare?crop=&quantityQuintals=&lat=&lng=` | Smart Mandi Selection: per-mandi `{ mandiName, modalPrice, transportCost, netProfit }` ranked. | farmer, seller, broker |
| GET | `/mandi/list` | Mandi directory (names, locations) for filters. | farmer, seller, broker |

## 5. AI Advisory & Chatbot

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/advisory/saturation` | Market saturation check. Body: `{ crop, district, lat, lng, radiusKm }`. Returns `{ sowingCount, radiusKm, expectedArrivalIncrease, riskLevel (green/yellow/red), predictedPrice, predictedDate, alternativeCrops: [{crop, expectedPrice}] }`. Privacy: aggregate counts only, opt-in. | farmer |
| POST | `/advisory/disease-scan` | Leaf disease detection. Multipart image upload. Returns `PestDisease[]`: `{ diseaseName, crop, pathogen, confidence, symptoms, chemicalTreatment, organicTreatment, dosage, estimatedCost }`. | farmer |
| GET | `/advisory/pest-radar?lat=&lng=&radiusKm=5` | Nearby pest/disease outbreak alerts `[{ disease, crop, distanceKm, riskLevel, reportedAt }]`. | farmer |
| POST | `/advisory/npk` | NPK recommendation. Body: `{ n, p, k, crop, soilType }` → fertilizer plan. (Can be client-side; keep for consistency.) | farmer |
| POST | `/chatbot/messages` | Send message to Kisan Mitra. Body: `{ text?, audioUrl?, language, sessionId }`. Returns `KisanMitraMessage`: `{ id, sender, text, timestamp, quickReplies[], richCardType, richCardData }`. Backend: OpenRouter LLM + Sarvam AI STT; 24 h session memory. | all |
| GET | `/chatbot/history?sessionId=` | Conversation history. | all |
| POST | `/chatbot/handoff` | Request human expert. Body: `{ sessionId, reason }` → `{ expertName, contactChannel, etaMinutes }`; sends chat history + farm data to expert. | all |
| GET | `/weather?lat=&lng=` | Weather strip: `{ tempC, rainProbability, condition, radarAvailable, forecast[] }` (proxy to IMD/OpenWeather). | all |
| POST | `/tasks/urgent/complete` | Mark Today's Action done → `{ agriCoinsEarned: 50, newBalance }`. (AppState: `markUrgentTaskDone`) | farmer |

## 6. Marketplace (Agri Inputs)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/products?category=&query=&lat=&lng=&page=` | `InputProduct[]`: `{ id, title, vernacularTitle, category, brand, rating, reviewsCount, dealerName, distanceKm, mrp, discountedPrice, bnplAvailable, batchNo }`. Categories: seeds, vehicles, fertilizer, pesticide, tools. | farmer, landlord, transporter, seller |
| GET | `/products/{id}` | Product detail. | farmer, landlord, transporter, seller |
| GET | `/products/{id}/certificate` | QR authenticity certificate (Agmark/Ministry): `{ batchNo, certifier, certificateNo, valid, verifiedAt }`. | farmer, landlord, transporter, seller |
| GET | `/cart` · POST `/cart/items` · PUT `/cart/items/{productId}` · DELETE `/cart/items/{productId}` | Cart CRUD. Body: `{ productId, quantity }`. (AppState: addToCart/removeFromCart/clearCart, cartTotal) | farmer, landlord, transporter, seller |
| POST | `/orders` | Place order. Body: `{ items[], paymentMethod (upi/cod/bnpl), deliveryAddress, idempotencyKey }`. Returns `{ orderId, total, bnplSchedule? }`. | farmer, landlord, transporter, seller |
| GET | `/orders` · GET `/orders/{id}` | Order history/detail with delivery status. | farmer, landlord, transporter, seller |

## 7. Buyer Contracts & Transport

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/contracts?status=` | `BuyerContract[]`: `{ id, buyerCompany, buyerRating, crop, lockedRateQuintal, mspCurrentRate, premiumAboveMSP, minQuantityQuintals, deliveryLocation, paymentTerms, status, contractDuration }`. | farmer, seller, broker |
| GET | `/contracts/{id}` | Contract detail + full terms document. | farmer, seller, broker |
| POST | `/contracts/{id}/accept` | E-sign acceptance. Body: `{ signatureData, consentTimestamp, mpin }`. (AppState: `acceptContract`) | farmer, seller |
| GET | `/transport/vehicles` | Bookable vehicle types `[{ type, baseFare, perKmRate, capacityTonnes }]`. | farmer, seller, transporter |
| POST | `/transport/fare-estimate` | Body: `{ vehicleType, distanceKm }` → `{ baseFare, distanceFare, totalFare }`. | farmer, seller, transporter |
| POST | `/transport/bookings` | Book vehicle. Body: `{ vehicleType, distanceKm, pickup, drop, date }`. | farmer, seller |
| GET | `/transport/bookings?status=` | Trip list for transporter dashboard (vehicle no., route, fare, status). | transporter |
| PATCH | `/transport/bookings/{id}` | Update trip status (accepted/en-route/delivered/cancelled). | transporter |

## 8. P&L, Farm Diary & Break-even

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/pnl/summary` | KPI cards `{ grossIncome, productionCost, netProfit }`. | farmer, landlord, seller, equipOwner, broker |
| GET | `/pnl/crops` | `CropPandL[]`: `{ id, name, season, area, yieldQuintals, marketAvgRate, grossRevenue, totalExpenses, netProfit, roiPercent, expensesBreakdown[] }`. | farmer, landlord, seller, equipOwner, broker |
| POST | `/pnl/crops/{id}/expenses` | Add expense `{ category, amount }`. | farmer, landlord, seller, equipOwner, broker |
| POST | `/pnl/break-even` | Body: `{ totalCost, expectedYieldQuintals }` → `{ minSafePricePerQuintal }`. | farmer, landlord, seller, equipOwner, broker |
| GET | `/diary/entries?type=&category=&from=&to=&page=&pageSize=` | Paged envelope `{data, page, pageSize, total}` of `FarmDiaryEntry`: `{ id, title, category, type, amount, date, cropName?, notes?, photos[], quantity?, unit?, createdAt, updatedAt }`, newest date first. `pageSize` ≤ 200, default 50. | farmer, landlord |
| POST | `/diary/entries` | Add entry → 201 `{ entry, agriCoinsEarned: 15 }` (+15 coins, reason `diary_entry`). Body: `{ title, category, type (expense/income/farmActivity), amount, date, cropName?, notes?, photos[]?, quantity?, unit? }`. (AppState: `addDiaryEntry`) | farmer, landlord |
| PUT | `/diary/entries/{id}` | Edit entry (full replace; keeps original `createdAt`, refreshes `updatedAt`) → 200 `{ entry }`; 404 `ENTRY_NOT_FOUND`. | farmer, landlord |
| DELETE | `/diary/entries/{id}` | Delete entry → 204; 404 `ENTRY_NOT_FOUND`. (AppState: `deleteDiaryEntry`) | farmer, landlord |
| GET | `/diary/analytics/summary?from=&to=` | Analytics dashboard → `{from, to, totals{income, expense, net, entryCount, incomeCount, expenseCount, activityCount}, byCategory[{category, type, amount, count}], byCrop[{cropName, income, expense, net, count}], byMonth[{month, income, expense, net, count}], byDay[{date, income, expense, count}]}`; income/expense only count money (`type` income/expense, amount ≠ 0); missing crop grouped under `अन्य`. Redis-cached 5 min. | farmer, landlord |
| POST | `/diary/entries/{id}/photos` | Attach 1–3 photos (multipart field `files`; jpeg/png/webp ≤ 5 MB each) → 201 `{photoUrls}` (signed Storage URLs under `diary/{uid}/…`); 404 `ENTRY_NOT_FOUND`, 400 `VALIDATION_ERROR`. | farmer, landlord |
| GET | `/diary/report?from=&to=` | PDF report (returns URL). | farmer, landlord |

## 9. Water Intelligence

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/water/schedule` | Plot-wise irrigation `[{ plotName, moisturePercent, recommendedMinutes, method }]`. | farmer |
| GET | `/water/groundwater?district=` | CGWB gauge `{ depthMeters, zone (safe/semiCritical/critical), measuredAt }`. | farmer |
| GET | `/water/canal-rotation?canal=` | Rotation schedule `[{ canalName, nextDate, slotTime }]`. | farmer |
| POST | `/water/pmksy-calculator` | Body: `{ acres }` → `{ totalCost, subsidyPercent: 55, subsidyAmount, farmerShare }`. | farmer |

## 10. Government Schemes & Document Vault

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/schemes?category=&eligibleOnly=` | `GovtScheme[]`: `{ id, name, category, eligible, benefitAmount, documentsRequired[], status, nextDeadline, description }`. Eligibility computed server-side from profile. | farmer, landlord |
| POST | `/schemes/{id}/apply` | In-app application; attach vault docs `{ documentIds[] }`. (AppState: `applyForScheme`) | farmer, landlord |
| GET | `/schemes/portals` | Official portal map `[{ schemeId, portalUrl }]` (pmkisan.gov.in, pmfby.gov.in, soilhealth.dac.gov.in, pmkusum.mnre.gov.in, enam.gov.in). | farmer, landlord |
| GET | `/vault/documents` · POST `/vault/documents` · DELETE `/vault/documents/{id}` | Encrypted document vault (Aadhaar, 7/12, bank passbook, soil health card). Multipart upload; AES-256 at rest; never log Aadhaar numbers. | all |

## 11. Finance

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/finance/credit-score` | `{ kisanCreditScore, creditTier, creditLimit, factors[] }` (RBI-compliant display). | all |
| POST | `/finance/loan-calculator` | Body: `{ amount (5000–50000), tenureMonths (3–12), interestRate: 7 }` → `{ emi, totalInterest, totalPayable }`. | all |
| GET | `/finance/kcc` | Kisan Credit Card `{ bankName, cardNumberMasked, kccLimit, availableLimit }`. | farmer |
| POST | `/finance/loans/apply` | Input-loan application. Body: `{ amount, tenureMonths, purpose, bankAccountId? }`; `bankAccountId` must exist under `users/{uid}/bank_accounts` (else 404 `BANK_ACCOUNT_NOT_FOUND`, last-4 + IFSC snapshotted onto the doc). On create the doc snapshots `farmerName`/`farmerPhone`/`farmerCreditScore`/`farmerCreditTier`, gets a human-readable `applicationNumber` (`LN-YYYY-####` via `counters/loans_YYYY`), and a seeded `timeline`. → 201 `{ applicationId, status: "submitted" }`. | farmer |
| GET | `/finance/loans` | Own loan applications, newest first — full `LoanApplicationOut` (application + timeline + documents + banker fields), pagination envelope. | farmer |

## 11b. Loan Management (bankManager persona)

> Bank-side workflow over the same `loan_applications` collection. Status machine: `submitted → underReview → approved → disbursed`, with `rejected`, `infoRequested` (→ `underReview` on farmer respond) and `cancelled` terminal-ish exits (`submitted|infoRequested → cancelled`, `approved → rejected`). Every status change appends a `timeline` entry; illegal transitions → 409 `LOAN_INVALID_TRANSITION`. Every banker mutation writes an `audit_logs` doc and notifies the farmer via FCM.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/loans/queue?status=&q=&page=&pageSize=` | Review queue over `loan_applications`: Firestore `status` filter + substring search on farmerName/farmerPhone/applicationNumber; envelope, `createdAt` desc. | bankManager |
| GET | `/loans/stats` | `{ byStatus, totalApplications, totalRequestedAmount, totalSanctionedAmount, pendingReview }`. | bankManager |
| GET | `/loans/{applicationId}` | `LoanApplicationOut`. Owner farmer **or** bankManager; anyone else → 404 `LOAN_NOT_FOUND` (never 403 — no cross-farmer probing). | farmer, bankManager |
| POST | `/loans/{applicationId}/review` | `submitted → underReview`; sets `assignedOfficerId`/`assignedOfficerName`; notifies farmer; audit. | bankManager |
| POST | `/loans/{applicationId}/approve` | `underReview → approved`. Body `{ sanctionedAmount (int ₹, ≥1), interestRate (>0), tenureMonths (≥1), note? }`; notifies farmer; audit. | bankManager |
| POST | `/loans/{applicationId}/reject` | `underReview\|approved → rejected`. Body `{ reason }` → stored as `rejectionReason`; notifies farmer; audit. | bankManager |
| POST | `/loans/{applicationId}/info-request` | `underReview → infoRequested`. Body `{ message }` → stored as `note`; notifies farmer; audit. | bankManager |
| POST | `/loans/{applicationId}/respond` | `infoRequested → underReview`, owner farmer only (banker → 403). Body `{ message }`; notifies assigned officer. | farmer |
| POST | `/loans/{applicationId}/cancel` | `submitted\|infoRequested → cancelled`, owner farmer only (banker → 403); notifies assigned officer. | farmer |
| POST | `/loans/{applicationId}/disburse` | `approved → disbursed`. Body `{ disbursementRef, disbursedAmount? }` (defaults to `sanctionedAmount`); stores `disbursedAt`; notifies farmer; audit. | bankManager |
| GET | `/loans/{applicationId}/schedule` | Reducing-balance EMI schedule — integer ₹ entries `{ installmentNo, dueDate, emi, principal, interest, outstanding }` (monthly rest, due 1st of each month, final outstanding exactly 0). Approved/disbursed loans use sanctioned terms; otherwise requested amount + 12% default. | farmer, bankManager |
| POST | `/loans/{applicationId}/documents` | Multipart upload of 1..n files (`files[]`, JPG/PNG/PDF, ≤5 MB each) to Storage (`loandocs/{uid}/…`); appends `documents[]` → 201. Owner farmer only. | farmer |

## 11c. Loan Management — Superadmin Console (SOP-14)

> Superadmin oversight of the same `loan_applications` collection (Module 14 — Banking, Credit Score & Microfinance, per `docs/superadmin-instructions/14-banking-credit-and-loan-underwriting.md`). The admin moves loans along the same `LOAN_TRANSITIONS` state machine as the bankManager — illegal jumps → 409 `LOAN_INVALID_TRANSITION`. Every change appends a `timeline` entry and writes an `audit_logs` doc. 403 `FORBIDDEN_ADMIN` for non-admins.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/finance/loans?status=&page=&pageSize=` | Loan application underwriting queue: optional `status` filter over `loan_applications`, `createdAt` desc, envelope `{ data, page, pageSize, total }` of `LoanApplicationOut`. | admin |
| PUT | `/admin/finance/loans/{applicationId}/status` | Advance status along the loan state machine. Body `{ status, note? }` — `status` must be a `LoanStatus` (422 `VALIDATION_ERROR` otherwise); 409 `LOAN_INVALID_TRANSITION` on illegal jumps; 404 `LOAN_NOT_FOUND`; timeline + `audit_logs` entry; returns updated `LoanApplicationOut`. | admin |

## 12. Crop Insurance (PMFBY / RWBCIS)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/insurance/policies` | `CropInsurancePolicy[]`: `{ id, policyNumber, schemeName, cropName, season, year, landAreaAcres, sumInsured, farmerPremium, govtSubsidy, status, insuranceCompany, coverageStartDate, coverageEndDate, bankName, kccAccountNo, certificateUrl, riskScore, riskCategory }`. | farmer, landlord, insuranceProvider |
| POST | `/insurance/policies/apply` | Quick-apply new crop coverage `{ cropName, season, landAreaAcres, schemeName?, category?, sumInsuredPerAcre?, farmerSharePercent? }` with automated underwriting risk scoring. | farmer, landlord |
| GET | `/insurance/policies/{id}/certificate` | e-Certificate PDF (download URL). (AppState: `downloadPolicyCertificate`) | farmer, landlord, insuranceProvider |
| GET | `/insurance/rates?season=&crop=` | `CropPremiumRate[]`: `{ cropName, category, season, sumInsuredPerAcre, farmerSharePercent, totalActuarialRatePercent, cutoffDate }` — feeds premium calculator. | farmer, landlord, insuranceProvider |
| GET | `/insurance/schemes` | Catalog of multi-category agricultural schemes (PMFBY, RWBCIS, Pashu Dhan Bima, Solar Pump Shield). | all |
| POST | `/insurance/claims` | 72-h claim intimation. Body: `{ policyId, cropName, calamityType, dateOfDamage, cropStage, estimatedLossPercent, gpsCoordinates, village }` + multipart `damagePhotos[]`. Returns `InsuranceClaimRecord` with generated `claimNumber` (`CLM-YYYY-ST-####`), status `intimated`, assigned surveyor. (AppState: `submitCropClaim`) | farmer, landlord |
| GET | `/insurance/claims` · GET `/insurance/claims/{id}` | Claim tracker: `{ claimNumber, status, statusText, surveyorName, surveyorPhone, surveyorVisitDate, approvedAmount, dbtTransactionId, bankAccountLast4, timeline[] }`. | farmer, landlord, insuranceProvider |
| POST | `/insurance/claims/{id}/appeal` | Appeal rejected claim with farmer justification and additional evidence. | farmer, landlord |
| GET | `/insurance/provider/policies?status=&page=&pageSize=` | Provider policy underwriting queue with status, category, and risk score filters. | insuranceProvider, admin |
| GET | `/insurance/provider/policies/{id}` | Provider policy detail file with risk factors and applicant profile. | insuranceProvider, admin |
| POST | `/insurance/provider/policies/{id}/review` | Underwrite policy (`approve` / `reject`). Body: `{ action, underwriterNotes }`. Issues e-certificate and notifies applicant. | insuranceProvider, admin |
| GET | `/insurance/provider/claims?status=&page=&pageSize=` | Claims adjudication queue across all insured farmers. | insuranceProvider, admin |
| GET | `/insurance/provider/claims/{id}` | Complete claim case file with loss evidence, survey reports, and timeline. | insuranceProvider, admin |
| POST | `/insurance/provider/claims/{id}/schedule_survey` | Assign official loss assessment surveyor `{ surveyorName, surveyorPhone, visitDate }`. | insuranceProvider, admin |
| POST | `/insurance/provider/claims/{id}/survey_report` | Upload field surveyor loss assessment `{ assessedLossPercent, surveyRemarks, cropStageAtVisit }`. | insuranceProvider, admin |
| POST | `/insurance/provider/claims/{id}/review` | Adjudicate claim (`approve` / `reject`). Body: `{ action, approvedAmount?, rejectionReason? }`. | insuranceProvider, admin |
| POST | `/insurance/provider/claims/{id}/disburse` | Direct Benefit Transfer (DBT) payout `{ dbtTransactionId?, bankAccountLast4? }` to beneficiary account. | insuranceProvider, admin |
| GET | `/insurance/provider/stats` | Executive KPI dashboard: policies, active coverage, pending claims, disbursed payouts, loss ratios. | insuranceProvider, admin |
| POST | `/insurance/provider/rates` | Publish new actuarial rate card entry for schemes. | insuranceProvider, admin |


## 13. Land Records (7/12 Utara)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/land-records/search?gatNumber=&village=&district=&type=712|8A` | Search by Gat (alphanumeric 1–20) or village (min 3 chars, fuzzy). Returns `LandRecord712[]`: `{ gatNumber, village, district, ownerName, khataNumber, totalAreaHectares, totalAreaAcres, landClass, ferfarNumber, cropHistory }`. Source: **mahabhulekh.maharashtra.gov.in / Aaple Sarkar**; multi-match disambiguation. | farmer, landlord |
| GET | `/land-records/{id}/pdf` | Official PDF (view/download/share). | farmer, landlord |
| POST | `/land-records/{id}/import` | Auto-store area/owner/soil/crop-history into farm profile & P&L. (AppState: `search712Records` + auto-store) | farmer, landlord |

## 14. Equipment Rental (Yantra Time-Slots)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/equipment?type=&lat=&lng=` | Bookable machines `[{ id, name, type, ownerType (fpo/private), hourlyRate, perAcreRate?, distanceKm }]`. | farmer, equipOwner |
| GET | `/equipment/{id}/slots?date=&week=` | `YantraSlot[]`: `{ id, equipmentId, slotName, duration, status, bookedByName?, priceRupees, recommendedTask }` — 4 default 4-h slots (6–10, 10–2, 2–6, 6–10), owner-configurable. | farmer, equipOwner |
| POST | `/equipment/slots/{id}/book` | Book slot. Rules enforced server-side: **max 2 slots/farmer/day (409 on third)**, auto-confirm for FPO-owned, pending for private, waitlist when full. Returns `{ booking, status, agriCoinsEarned: 50 }`. (AppState: `bookYantraSlot`) | farmer |
| DELETE | `/equipment/bookings/{id}` | Cancel ≤2 h before start; triggers SMS to owner. | farmer |
| POST | `/equipment/slots/{id}/waitlist` | Join waitlist. | farmer |
| GET | `/equipment/owner/fleet` | Owner fleet status (bookings, fares, utilization) for equipment dashboard. | equipOwner |
| POST | `/equipment` · PUT `/equipment/{id}` | Owner: add/manage machines & slot templates. | equipOwner |

## 15. FPO Engine

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/fpo/me` | FPO profile `{ name, memberCount, district }`. | farmer |
| GET | `/fpo/pools` | Bulk procurement pools `[{ id, item, bookedUnits, targetUnits, discountPercent, deadline }]`. | farmer |
| POST | `/fpo/pools/{id}/join` | Join group buy. Body: `{ units }`. | farmer |
| GET | `/fpo/machinery?week=` | Shared machinery calendar (links to §14 slots with ownerType=fpo). | farmer |

## 16. Livestock, Dairy & Veterinary

Directory & marketplace (original module):

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/gaushalas?district=&lat=&lng=` | `GaushalaItem[]`: `{ id, name, trustName, address, district, distanceKm, cowCount, breeds[], phone, providesOrganicManure, offersCowAdoption, rating, facilities }`. | farmer, seller |
| POST | `/gaushalas/{id}/manure-order` | Order cow-dung manure/slurry `{ product, quantity }` with priced options. (AppState: `orderGaushalaManure`) | farmer |
| GET | `/nurseries?lat=&lng=` | `PlantNursery[]`: `{ id, name, ownerName, location, distanceKm, phone, rating, isGovtCertified, availableSaplings[], priceRange }`. | farmer, seller |
| GET | `/vets?lat=&lng=&emergency=` | `VetDoctor[]`: `{ id, name, qualification, specialization, clinicAddress, distanceKm, phone, experienceYears, consultationFeeRupees, rating, availableForFarmVisit, nextAvailableSlot }`. 24×7 emergency flag. | farmer |
| POST | `/vets/{id}/book` | Vet booking `{ visitType (farm/clinic), slot, animalType }`. (AppState: `bookVetDoctor`) | farmer |
| GET | `/dairy-products?category=` | `DairyProductItem[]`: `{ id, title, farmName, category, price, rating, unit, reviewsCount, purityCertification, inStock, description }`. | farmer, seller |
| POST | `/dairy-products/{id}/order` | Direct buy `{ quantity }`. (AppState: `orderDairyProduct`) | farmer, seller |

Dairy management (`livestock_dairy.py`; center-scoped — `centerId` = caller uid):

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/livestock/dairy/members` | Member farmers of the manager's center (paged envelope). | dairyManager |
| POST | `/livestock/dairy/members` | Add member farmer. Body: `{ name, phone?, village?, farmerUid?, memberCode?, bankDetails?, defaultSpecies?, deduction?, status? }` → 201 `mem_…`. | dairyManager |
| PUT | `/livestock/dairy/members/{id}` | Update member (404 `MEMBER_NOT_FOUND` when not own center). | dairyManager |
| DELETE | `/livestock/dairy/members/{id}` | Soft delete — sets `status: "inactive"`. | dairyManager |
| GET | `/livestock/dairy/members/{id}/statement?dateFrom=&dateTo=` | Member ledger: milk collections + payment entries + totals `{ liters, amount, paid }`. | dairyManager |
| GET | `/livestock/dairy/rate-chart?species=cow` | Active FAT/SNF rate chart; own center's chart wins, else any center's (public read for livestock users; 404 `RATE_CHART_NOT_FOUND`). | farmer, seller, dairyManager |
| GET | `/livestock/dairy/rate-chart/versions?species=` | Rate chart version history for the center. | dairyManager |
| POST | `/livestock/dairy/rate-chart` | Create chart `{ species, effectiveFrom, baseRate, fatBase, snfBase, fatStep?, snfStep?, minRate?, minFat?, minSnf?, active? }`; activating deactivates other charts of that species (single active per species). | dairyManager |
| PUT | `/livestock/dairy/rate-chart/{id}` | Update chart; same single-active-per-species rule. | dairyManager |
| GET | `/livestock/dairy/payments/batches` | Payment settlement batches, newest first. | dairyManager |
| POST | `/livestock/dairy/payments/batches` | Generate from period `{ periodFrom, periodTo }` — sums member collections, applies per-member flat deduction, writes `payment_entries`; returns batch + entries. | dairyManager |
| POST | `/livestock/dairy/payments/batches/{id}/mark-paid` | Mark batch paid `{ payoutRef? }` — sets entries paid, FCM to each member (409 `ALREADY_PAID`). | dairyManager |
| GET | `/livestock/dairy/farmer/payments` | Farmer self-view: own payment entries (via `dairy_members.farmerUid`). | farmer, seller, dairyManager |
| GET | `/livestock/dairy/farmer/slips?dateFrom=&dateTo=` | Farmer self-view: own milk collection slips + `memberCode`. | farmer, seller, dairyManager |
| GET | `/livestock/dairy/sales/customers` | Milk sale customers (paged). | dairyManager |
| POST | `/livestock/dairy/sales/customers` | Add customer `{ name, phone?, type?, address?, route?, dailyLitersAM?, dailyLitersPM?, ratePerLiter }` → 201. | dairyManager |
| PUT | `/livestock/dairy/sales/customers/{id}` | Update customer (404 `CUSTOMER_NOT_FOUND`). | dairyManager |
| GET | `/livestock/dairy/sales/orders?status=` | Sale orders, newest `orderDate` first. | dairyManager |
| POST | `/livestock/dairy/sales/orders` | Create order `{ customerId, orderDate, shift?, liters?, items[]?, amount? }` — amount = items total > explicit amount > liters × customer rate; status `scheduled`. | dairyManager |
| POST | `/livestock/dairy/sales/orders/{id}/status` | Advance order `{ status: delivered/billed/paid }` — lifecycle scheduled→delivered→billed→paid (409 `INVALID_TRANSITION`). | dairyManager |
| GET | `/livestock/dairy/sales/summary?dateFrom=&dateTo=` | Sales totals: orders, liters, amount, collected, byStatus. | dairyManager |
| GET | `/livestock/dairy/stock/items` | Dairy stock items (milk/curd/ghee/paneer/other). | dairyManager |
| POST | `/livestock/dairy/stock/items` | Add stock item `{ name, category?, unit?, stockQty?, unitPrice?, expiryDate? }` → 201. | dairyManager |
| POST | `/livestock/dairy/stock/items/{id}/adjust` | Adjust stock `{ delta, reason }` — updates qty, records `lastAdjustment`. | dairyManager |
| GET | `/livestock/dairy/reports/daily?date=` | Daily report: procurement vs sales totals + closing stock. | dairyManager |
| GET | `/livestock/dairy/reports/pl?month=` | Monthly P&L `{ procurementCost, salesIncome, grossProfit, collectionsCount, ordersCount }`. | dairyManager |
| GET | `/livestock/dairy/analytics?month=` | Deep analytics for the month: collections `{ liters, amount, count, avgFat, avgSnf, bySpecies, byShift, daily[], topMembers[≤10] }`, sales `{ liters, amount, orders, byStatus, daily[] }`, dues `{ pendingNet, pendingEntries }` (all un-paid entries), previousMonth comparison. | dairyManager |
| GET | `/livestock/dairy/farmer/analytics` | Farmer self-analytics: `member`, last-6-months `monthly[]` (`{ month, liters, amount, paid }`), lifetime `totals` (`{ liters, amount, paid, pending }`). No membership → `member: null`, zeros. | farmer, seller, dairyManager |

Milk procurement (`livestock.py`; `_any_livestock_user` = farmer, seller, dairyManager):

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/livestock/procurement/collections` | Record a collection `{ farmerId?, farmerName, farmerCode, farmerPhone?, date, shift: morning/evening, milkType: cow/buffalo, liters (0–2000], fatPercent (2–14), snfPercent (6–14), clr?, memberId?, quality? }` → 201 with `slipNumber = SLIP-<yyyymmdd>-<M\|E>-<farmerCode>`. Rate: dairyManager caller with an active `rate_charts` doc for the species gets chart-based rate (`baseRate + (fat-fatBase)*fatStep + (snf-snfBase)*snfStep`, floored at `minRate`; below `minFat`/`minSnf` → `minRate`; `rateChartId` stored on slip); otherwise the platform formula. | farmer, seller, dairyManager |
| GET | `/livestock/procurement/collections?date=&shift=&farmerCode=` | Paged slips. Scoped: dairyManager sees own center only (`dairyId == uid`); farmer/seller sees own (`farmerId == uid` or self-recorded). | farmer, seller, dairyManager |
| GET | `/livestock/procurement/summary?date=` | Day totals `{ totalMorningLiters, totalEveningLiters, totalLiters, avgFat, avgSnf, totalPayoutAmount, collectionsCount }` — same center/self scoping as list. | farmer, seller, dairyManager |
| POST | `/livestock/procurement/rate-calc` | Platform-formula rate preview `{ milkType, fatPercent, snfPercent, liters }` → `{ ratePerLiter, totalAmount, baseRate, fatPremium, snfPremium, formula }`. Preview only — actual rate on save follows the chart rule above. | all |

> `GET /livestock/dairy/rate-chart` (farmer/seller callers) now resolves the caller's center via
> `dairy_members.farmerUid` and prefers that center's active chart before any fallback (2026-10-02, dairy web module).

Gaushala management (`livestock_gaushala.py`; requires a gaushala profile — most routes 404 until `POST /profile`):

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/livestock/gaushala/mine` | Own gaushala profile (404 until created). | dairyManager |
| POST | `/livestock/gaushala/profile` | Create profile `{ name, trustName?, address?, district?, phone?, capacity?, certifications?, bankDetails? }` (409 `GAUSHALA_EXISTS`). | dairyManager |
| PUT | `/livestock/gaushala/profile` | Update profile. | dairyManager |
| GET | `/livestock/gaushala/cattle?category=` | Cattle inventory — `livestock_animals` filtered by own `gaushalaId`. | dairyManager |
| POST | `/livestock/gaushala/cattle/{animalId}/events` | Append event `{ type: intake/adopted-out/deceased/transferred, note?, date? }` — sets `cattleStatus`; intake defaults `source: "rescued"` (404 `CATTLE_NOT_FOUND` when not own). | dairyManager |
| PUT | `/livestock/gaushala/adoptions/{id}/status` | `{ status: approved/rejected/completed }` — active→approved/rejected, approved→completed/rejected; approve auto-creates 80G `receipts` doc + FCM to donor (409 `INVALID_TRANSITION`). | dairyManager |
| PUT | `/livestock/gaushala/donations/{id}/status` | `{ status: acknowledged/rejected }` — acknowledge auto-creates 80G receipt + FCM to donor. | dairyManager |
| GET | `/livestock/gaushala/expenses?month=` | Expenses (fodder/medical/staff/utilities/transport/other). | dairyManager |
| POST | `/livestock/gaushala/expenses` | Add expense `{ category, amount, note?, expenseDate }` → 201. | dairyManager |
| PUT | `/livestock/gaushala/expenses/{id}` | Update expense (404 `EXPENSE_NOT_FOUND`). | dairyManager |
| DELETE | `/livestock/gaushala/expenses/{id}` | Delete expense. | dairyManager |
| GET | `/livestock/gaushala/expenses/summary?month=` | Expense totals by category. | dairyManager |
| GET | `/livestock/gaushala/dashboard` | Aggregates: headcount, byCategory, occupancy %, active adoptions, month donations/expenses. | dairyManager |
| GET | `/livestock/gaushala/analytics?month=` | Last-6-months `monthly[]` (`{ month, expenses, donations, adoptions, adoptionAmount, intakes }`), `expenseByCategory` for the month, `cattleByStatus` inventory split. | dairyManager |
| GET | `/livestock/gaushala/receipts` | Issued 80G receipts (adoption/donation), newest first — `eightyGEligible`, `certificateNumber`. | dairyManager |

Doctor / vet network (`livestock_vets.py`; vet workspace requires a claimed vet profile via `POST /livestock/vets/claim`):

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/livestock/vets/managed` | Manager vet directory — all `vets` docs with `claimed` flag + rating aggregates. | dairyManager |
| POST | `/livestock/vets/managed` | Onboard vet `{ name, phone, qualification?, specializations[]?, clinicAddress?, experienceYears?, feeClinic?, feeFarm?, feeTele?, visitTypes[]?, serviceDistricts[]?, languages[]?, vetCouncilRegNo?, emergencyAvailable?, availableForFarmVisit? }` → 201. | dairyManager |
| PUT | `/livestock/vets/managed/{id}` | Update vet directory entry (404 `VET_NOT_FOUND`). | dairyManager |
| DELETE | `/livestock/vets/managed/{id}` | Deactivate vet — `status: "inactive"` (stops new appointments). | dairyManager |
| POST | `/livestock/vets/claim` | Vet self-claim: matches caller's phone to a `vets` doc, sets `claimedByUid` (404 `VET_NOT_FOUND`, 409 `ALREADY_CLAIMED`). | all |
| GET | `/livestock/vets/me` | Vet workspace: profile + schedule + stats (total appointments, month earnings, rating). | vet (claimed) |
| GET | `/livestock/vets/me/schedule` | Weekly slots / leaves / emergency / teleconsultation flags. | vet (claimed) |
| PUT | `/livestock/vets/me/schedule` | Update schedule `{ weeklySlots?: [{day, slots:[{start,end}]}], leaves?: [], emergencyAvailable?, teleAvailable? }` — leaves merge additively. | vet (claimed) |
| GET | `/livestock/vets/me/appointments?status=&date=` | Vet appointment inbox. | vet (claimed) |
| GET | `/livestock/vets/me/earnings?month=` | Completed appointments + month earnings. | vet (claimed) |
| POST | `/livestock/appointments` | Book appointment `{ vetId, animalId?, visitType?, slotDate, slotTime, symptoms?, address?, fee? }` — validated against vet schedule (weekday slots, tele flag); fee defaults per visitType; FCM to vet. | farmer, seller, dairyManager |
| GET | `/livestock/appointments?status=&date=` | dairyManager → all appointments; farmer/seller → own only. | farmer, seller, dairyManager |
| POST | `/livestock/appointments/{id}/status` | Vet lifecycle requested→confirmed→in-progress→completed/cancelled; farmer may only cancel requested/confirmed; complete accepts `vetNotes` + inline `prescription` (auto-creates `prescriptions` doc); FCM to counterparty (403 `FORBIDDEN_ROLE`, 409 `INVALID_TRANSITION`). | vet, farmer |
| POST | `/livestock/prescriptions` | Standalone prescription `{ animalId, appointmentId?, diagnosis, medicines[{name, dosage?, frequency?, durationDays?, notes?}], advice?, milkWithdrawalDays?, followUpDate? }` — writing vet or dairyManager (404 `ANIMAL_NOT_FOUND`). | vet, dairyManager |
| GET | `/livestock/prescriptions?animalId=` | Writing vet, any dairyManager, or the animal's owner (403 `FORBIDDEN_ROLE` otherwise). | vet, dairyManager, farmer |
| GET | `/livestock/vet/campaigns?status=` | Vaccination campaigns. | farmer, seller, dairyManager |
| POST | `/livestock/vet/campaigns` | Create campaign `{ title, vaccine, disease?, fromDate, toDate, targetDistricts[]?, status? }` → 201. | dairyManager |
| GET | `/livestock/vet/campaigns/{id}` | Campaign detail + enrollments + count. | farmer, seller, dairyManager |
| POST | `/livestock/vet/campaigns/{id}/enroll` | Enroll own animal `{ animalId }` (403 other owner's animal, 409 `ALREADY_ENROLLED`/`CAMPAIGN_CLOSED`); FCM reminder. | farmer, seller, dairyManager |
| POST | `/livestock/vet/campaigns/{id}/mark-vaccinated` | Mark animal vaccinated `{ animalId }` — enrollment → `vaccinated`; FCM to farmer (404 `ENROLLMENT_NOT_FOUND`). | dairyManager, vet |

> `MilkCollectionIn` (§`livestock.py` procurement) gained optional `memberId` + `quality`. `AnimalIn` gained optional `gaushalaId` — when the caller manages that gaushala, the animal is registered as its cattle (`ownerType: "gaushala"`, `cattleStatus: "in-shelter"`, intake event recorded; 404 `GAUSHALA_NOT_FOUND` otherwise); `Animal` responses now carry `gaushalaId`/`cattleStatus`/`events`. The `dairyManager` persona (8th profile) is the livestock-domain super-manager; no admin endpoints exist yet — the `/admin/livestock` console is deferred (see SOP-19).

## 17. Content: News, Live Channels, Gyan Hub

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/news?category=&page=` | `AgriNewsItem[]`: `{ id, title, vernacularTitle, category, source, timestamp, summary, content, isBreaking, audioText, impactRating }`. | all |
| GET | `/channels` | `AgriLiveChannel[]`: `{ id, channelName, broadcaster, programTitle, currentSpeaker, liveViewersCount, isLiveNow, category, streamThumbnail, streamUrl, scheduleTime }` — `streamUrl` should be HLS. | all |
| GET | `/channels/{id}/chat` · POST `/channels/{id}/chat` | Live channel chat (poll or WebSocket `/ws/channels/{id}`). | all |
| GET | `/workshops` | `PaidWorkshop[]`: `{ id, title, instructor, instructorRole, institution, feeRupees, coinsDiscountAllowed, duration, batchDate, timing, rating, enrolledCount, totalSeats, isCertified, certificateTitle, syllabusModules[], deliverables[], isEnrolled }`. | all |
| POST | `/workshops/{id}/enroll` | Enroll `{ useCoins, coinsToRedeem }` → payment or coin discount. (AppState: `enrollWorkshop`) | all |
| GET | `/expert-talks` | `ExpertTalk[]`: `{ id, expertName, institution, topic, scheduledTime, isLive, registeredCount, description }`. | all |
| POST | `/expert-talks/{id}/register` | Register → `{ agriCoinsEarned: 25 }`. (AppState: `registerForExpertTalk`) | all |
| POST | `/expert-talks/{id}/questions` | "Ask the scientist" `{ question }`. | all |
| GET | `/videos?category=` | `VideoGuide[]`: `{ id, title, instructor, duration, views, category, videoUrl, summary, keyPoints[] }`. | all |
| GET | `/blogs?category=` | `BlogArticle[]`: `{ id, title, author, authorRole, readTimeMinutes, category, summary, content, publishedDate, likesCount, isBookmarked }`. | all |
| POST | `/blogs/{id}/bookmark` · POST `/blogs/{id}/like` | Toggle bookmark / like. (AppState: `toggleBookmarkBlog`) | all |

## 18. Tree Plantation & Biofuel

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/tree/articles?category=` | `TreeArticle[]`: `{ id, title, category, author, readTime, summary, fullContent, benefits, publishedDate }`. | farmer, landlord, seller |
| GET | `/tree/ngos` | `NgoOrganization[]`: `{ id, name, focusArea, location, contactPhone, email, treesPlantedCount, rating, servicesOffered[], providesFreeSaplings, websiteUrl }`. | farmer, landlord, seller |
| POST | `/tree/ngos/{id}/sapling-request` | Request saplings `{ treeType (timber/biofuel/fruit/bamboo), count }`. (AppState: `requestSaplings`) | farmer, landlord, seller |
| GET | `/tree/biofuel` | `BiofuelTree[]`: `{ id, name, botanicalName, oilContentPercent, gestationPeriod, expectedReturnPerAcre, suitability, uses, buyerMarket, subsidyScheme }`. | farmer, landlord, seller |
| GET | `/tree/care-guides` | `TreeCareGuide[]`: `{ id, title, stepNumber, stage, instructions, wateringRule, fertilizerSchedule, pestProtection }`. | farmer, landlord, seller |

## 19. Gamification & Referrals

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/gamification/status` | `{ userId, agriCoins, level: {tier, title, minCoins, nextTier, coinsToNextTier, progressPct}, dailyStreak: {current, longest}, stats: {coinsEarnedTotal, diaryEntries, referrals, redeems}, badges[8]: {id, title, description, icon, earned, earnedAt, progress, target}, availableRewards[] }`. Tiers: bronze<200, silver<500, gold<1000, diamond≥1000. | all |
| GET | `/gamification/rewards` | `{ data: [{type, title, coinsCost, icon, available, description}] }` — catalog: voucher 300 / soil_test 500 / expert_call 800 / workshop 1000. | all |
| POST | `/gamification/redeem` | Redeem `{rewardType, coins}` (coins must equal the catalog cost) → `{voucherCode, coins, balance, reward, redeemedAt}`; writes coin_ledger + redeemed_rewards + notification. **400 INSUFFICIENT_COINS / VALIDATION_ERROR.** | all |
| GET | `/gamification/ledger` | Coin earn/spend history, paged envelope `{data:[{id, amount, reason, refId, balanceAfter, at}], page, pageSize, total}` (newest first). | all |
| GET | `/gamification/leaderboard?period=all\|month` | Top coin earners from `gamification_ledger` → `{data:[{rank, userId, name, village, coinsEarned, isMe}], myRank:{rank, coinsEarned}\|null, period}`. | all |
| GET | `/referrals` | `{referralCode, shareLink, shareMessage, stats:{invited, joined, totalEarnedCoins}, milestones:[{count, rewardCoins, achieved}], referred:[{name, phone, status: invited\|joined, invitedAt, joinedAt, rewardCoins}], leaderboard:[{rank, userId, name, village, referralCount, isMe}], myRank}`. | all |
| POST | `/referrals/invite` | Invite `{name, phone (E.164)}` → 201 `{invite, referralCode, shareLink, shareMessage, agriCoinsEarned: 100, stats, milestones}`; **409 ALREADY_INVITED** on duplicate phone, **400 VALIDATION_ERROR** on bad phone. (AppState: `inviteFarmer`) | all |

Referral flow: invite = +100 coins immediately (reason `referral`). Registering with a valid `referralCode` records `referral_attributions/{referredUid}` (status `joined`) + `referralCodeUsed` on the new user, awards the referrer +100 (reason `referral`), flips any matching `referrals/{uid}/invited/{phone}` doc to `joined`, and pays milestone bonuses (1→50, 5→150, 10→500; reason `referral_milestone`) with a notification per milestone. Referred user earns nothing at registration.

## 20. Climate, Post-Harvest, Misc

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/climate/carbon-potential?lat=&lng=` | `{ annualIncomePotential, co2eTonnes, practices[] (biochar/zero-till/green-manure) }`. | farmer |
| GET | `/climate/resilient-varieties?crop=&district=` | Climate-resilient seed varieties list. | farmer |
| GET | `/post-harvest/cold-storage?lat=&lng=` | `[{ id, name, distanceKm, tempRange, availableMT, ratePerQuintalMonth, facilityType, wdraRegistered, supportedCrops }]`. | farmer, transport, seller, coldStorageProvider |
| GET | `/post-harvest/cold-storage/{facility_id}` | Detailed facility file with chamber breakdowns, temperature controls, and WDRA registration. | all |
| POST | `/post-harvest/cold-storage/{facility_id}/book` | Quick-book cold storage space `{ quantityQuintals, fromDate, months }`. | farmer |
| POST | `/post-harvest/cold-storage/{facility_id}/apply` | Enhanced storage application with produce details `{ cropName, variety?, quantityQuintals, fromDate, months, packagingType, bagsCount?, notes?, estimatedValueRupees? }`. | farmer, seller, farmLandlord |
| GET | `/post-harvest/bookings/{id}` | Booking record with lifecycle timeline and lot allocations. | farmer, seller, coldStorageProvider |
| POST | `/post-harvest/bookings/{id}/request-release` | Farmer request to release stored produce `{ requestedQuintals, pickupDate, vehicleNumber?, notes? }`. | farmer, seller |
| GET | `/post-harvest/receipts/{receipt_number}` | Electronic Negotiable Warehouse Receipt (e-NWR) details and valuation for pledge financing. | all |
| GET | `/post-harvest/provider/stats` | Executive KPI dashboard: total capacity MT, occupied MT, occupancy %, pending bookings, inwarded lots, accrued rent, valuation. | coldStorageProvider, admin |
| GET | `/post-harvest/provider/bookings?status=&page=&pageSize=` | Provider bookings queue with status and keyword filters. | coldStorageProvider, admin |
| GET | `/post-harvest/provider/bookings/{id}` | Detailed booking file with inward and outward logs. | coldStorageProvider, admin |
| POST | `/post-harvest/provider/bookings/{id}/review` | Approve or reject reservation `{ action, allocatedChamberId?, notes?, rejectionReason? }`. Restores capacity on rejection. | coldStorageProvider, admin |
| POST | `/post-harvest/provider/bookings/{id}/inward` | Gate inward entry: records gross/tare/net weight, bags, QC grade, moisture %, allocates lot, and generates e-NWR receipt. | coldStorageProvider, admin |
| POST | `/post-harvest/provider/bookings/{id}/release` | Outward dispatch & gate pass issuance `{ releaseQuintals, vehicleNumber?, driverName?, amountPaid? }`. Releases capacity back to godown. | coldStorageProvider, admin |
| GET | `/post-harvest/provider/facilities?mine_only=` | Provider facility directory with chambers and current occupancy (prioritizes managed facilities). | coldStorageProvider, admin |
| POST | `/post-harvest/provider/facilities` | Register new godown or cold storage facility `{ name, facilityType, capacityMT, ratePerQuintalMonth, address?, district?, chambers? }` → 201. | coldStorageProvider, admin |
| POST | `/post-harvest/provider/facilities/{id}/chambers` | Add a chamber to an existing facility `{ name, chamberType, capacityMT, tempRange?, status? }` → 201. Increases facility capacity. | coldStorageProvider, admin |
| PUT | `/post-harvest/provider/facilities/{id}` | Update facility details, chamber configurations, and monthly rates. | coldStorageProvider, admin |
| POST | `/post-harvest/grade` | AI quality grading. Multipart produce images → `{ grade, uniformityPercent, shelfLifeDays, recommendedPrice }`. | farmer, seller |
| GET | `/women/shg` · POST `/women/shg/deposit` | SHG group `{ memberCount, corpus, loanFund, monthlyDeposit }`; record deposit. | farmer (women mode) |
| GET | `/women/home-enterprise` | Home enterprise income lines `[{ product, monthlyProfit }]`. | farmer (women mode) |
| GET | `/dashboard/home` | Aggregated farmer home: weather, urgent task, vyapari rates, banners — single call to hydrate dashboard. | all |
| POST | `/sync` | Offline queue replay. Body: `{ operations: [{ idempotencyKey, method, path, body, queuedAt }] }` → per-op results. | all |
| GET | `/notifications` · PUT `/notifications/read-all` · POST `/notifications/{id}/read` | Own notifications with paged envelope, mark-read operations. **Shipped — see §24.** | all |

## 21. Landlord Land Management

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/land/plots` | List own plots: `LandPlot[]` `{ id, name, village, district, areaAcres, gatNumber?, soilType?, status: vacant/leased }`. | farmer, farmLandlord |
| POST | `/land/plots` | Create plot. Body: `{ name, village, district, areaAcres, gatNumber?, soilType? }` → 201 with `status: "vacant"`. | farmer, farmLandlord |
| PUT | `/land/plots/{id}` | Partial update of plot fields. 404 `PLOT_NOT_FOUND`. | farmer, farmLandlord |
| DELETE | `/land/plots/{id}` | Delete plot; **409 `PLOT_HAS_ACTIVE_LEASE`** if an active lease references it. | farmer, farmLandlord |
| GET | `/land/leases?status=` | List own leases, optional `active/ended` filter: `LandLease[]` `{ id, plotId, tenantName, tenantPhone, monthlyRentRupees, startDate, endDate, status, verified }`. | farmer, farmLandlord |
| POST | `/land/leases` | Create lease. Body: `{ plotId, tenantName, tenantPhone, monthlyRentRupees, startDate, endDate }`; plot must exist (404 `PLOT_NOT_FOUND`), `endDate > startDate` (422). Creates `status: "active"`, `verified: false`; plot becomes `leased`. | farmer, farmLandlord |
| PUT | `/land/leases/{id}` · DELETE `/land/leases/{id}` | Update `monthlyRentRupees/endDate/status/verified` (ending sets plot back to `vacant`); delete reverts plot status if active. 404 `LEASE_NOT_FOUND`. | farmer, farmLandlord |
| GET/POST | `/land/leases/{id}/payments` | Record payment `{ amountRupees, month: YYYY-MM, method: cash/upi/bank, paidAt }` → 201; duplicate month → **409 `DUPLICATE_PAYMENT_MONTH`**. GET returns payments (month desc) + `totalCollectedRupees` + `pendingMonths[]`. | farmer, farmLandlord |
| POST | `/land/listings` | Create land listing. Body: `{ village, district, lat, lng, areaAcres, expectedRentRupees, soilType?, waterSource?, plotId? }` (plotId must be an own plot, 404 `PLOT_NOT_FOUND`) → 201 with `status: "open"`, `landlordId`, `landlordName`. | farmLandlord |
| GET | `/land/listings?near=<lat>,<lng>&acres=` | Browse open listings; `near` → haversine ≤ 25 km; `acres` → `areaAcres >= acres`. | farmer, farmLandlord |
| GET | `/land/listings/mine` | Own listings in any status. | farmLandlord |
| PUT | `/land/listings/{id}` · DELETE `/land/listings/{id}` | Owner only (403 `NOT_LISTING_OWNER`); DELETE while `leased` → **409 `LISTING_HAS_ACTIVE_LEASE`**. | farmLandlord |
| POST | `/land/lease-requests` | Request a lease. Body: `{ listingId, message?, durationMonths: 1-120 }`; listing must be open (409 `LISTING_NOT_OPEN`); one pending request per farmer per listing (**409 `DUPLICATE_LEASE_REQUEST`**). | farmer |
| GET | `/land/lease-requests?status=` | Requests on own listings: `{ id, listingId, farmerId, farmerName, farmerPhone, durationMonths, message, status, createdAt }`. | farmLandlord |
| POST | `/land/lease-requests/{id}/accept` | Owner only; pending only (409 `REQUEST_ALREADY_RESOLVED`). Creates the lease (`monthlyRentRupees = listing.expectedRentRupees`, term = `durationMonths` from today), flips listing to `leased`, auto-rejects competing pending requests → 200 `{ leaseId }`. | farmLandlord |
| POST | `/land/lease-requests/{id}/reject` | Owner only. Body: `{ reason? }` → 200 `{ status: "rejected" }`. | farmLandlord |
| GET | `/land/leases/{id}/agreement-pdf` | Lease agreement PDF (कृषि भूमि पट्टा अनुबंध) → `{ agreementUrl }`. Owning landlord or tenant farmer whose phone matches `tenantPhone`; else 404 `LEASE_NOT_FOUND`. | farmer, farmLandlord |
| GET | `/bank-accounts` · POST `/bank-accounts` | List own bank accounts (primary first) / add account `{ accountHolder, accountNumber: 9-18 digits, ifsc, bankName }` → 201 with `accountNumberMasked` (`XXXX` + last-4; full number never returned), first account auto-`isPrimary`. | all |
| POST | `/bank-accounts/{id}/verify` | Penny-drop verify via `BANK_VERIFY_ADAPTER` (default stub) → `verifyStatus: verified/failed`. 404 `BANK_ACCOUNT_NOT_FOUND`. | all |
| POST | `/bank-accounts/{id}/set-primary` · DELETE `/bank-accounts/{id}` | Set primary (unsets others) → `{ primaryId }`; delete promotes the oldest remaining account if it was primary. | all |
| GET | `/finance/loans` | Own loan applications, newest first — now the full `LoanApplicationOut` (applicationNumber, timeline, documents, sanctioned/disbursal fields). | farmer |
| POST | `/jobs/settlements/run` | Nightly settlement aggregation (Cloud Scheduler, header `X-Cron-Secret`; empty `CRON_SECRET` in dev = allow). Body: `{ periodStart?, periodEnd? }` (default last ISO week) → `{ created, updated }`. Commission config `platform_config/settlements` `{ transportPct: 10, equipmentRentalPct: 12, brokerPct: 2 }`. | cron |
| GET | `/transport/settlements` · `/equipment/settlements` · `/broker/settlements` | Own settlement rows `{ id, periodStart, periodEnd, grossRupees, commissionRupees, netRupees, status, sourceIds[] }`, newest period first. Other personas → 403 `FORBIDDEN_ROLE`. | transport / equipmentRental / broker |

---

## 22. E-Market: Customer Profile, Wishlist, Coupons, Order Lifecycle, Seller Storefront & Analytics

> Added 2026-09-26 (`source: extension-2026-09-26`). The `customer` profile is now a valid registration profile — the E-Market shopper — with optional `roleProfiles.customer = { interests[], preferredCategories[] }`; marketplace/order roles extended to `customer`.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/wishlist` | Wishlisted products for the current user (any logged-in profile): `{ data: Product[], total }`. Buyer-facing product docs expose `inStock: bool` and never leak raw `stock`. | all |
| POST | `/wishlist/items` | Add to wishlist. Body: `{ productId }` → 201 (idempotent on duplicates); 404 `PRODUCT_NOT_FOUND`. | all |
| DELETE | `/wishlist/items/{productId}` | Remove from wishlist → 204. | all |
| GET | `/coupons` | Active, unexpired coupons `{ data: [{ code, type: percentage/flat, value, minOrder, maxDiscount, validUntil, description, applicable? }], total }`; `?cartTotal=` adds `applicable` vs `minOrder`. | all |
| POST | `/coupons/validate` | Body: `{ code, cartTotal }` → 200 `{ valid, discount, finalTotal, message }`; unknown/inactive/expired/exhausted/below-`minOrder` → `valid: false` (still 200). | all |
| POST | `/orders` | Extended: optional `couponCode` validates against the recomputed cart total (400 `COUPON_INVALID`). Order doc keeps `total` as the pre-discount subtotal and stores `discount` + `finalTotal`; BNPL schedule is computed on `finalTotal`. `usedCount` increments after the idempotency check (replay never double-uses). Items with a `stock` field are checked (409 `OUT_OF_STOCK` with `fieldErrors`) and decremented after the order is written. | farmer, farmLandlord, transport, seller, customer |
| POST | `/orders/{id}/cancel` | Extended: appends a `cancelled` event and restores product stock. | order owner |
| GET | `/orders/{id}/timeline` | Order event log: `{ orderId, data: [{ status, at, note }], total }` — seeded with `placed`, plus `paid` on payment confirmation, `cancelled`/`return_requested`/status transitions as they happen. | order owner |
| POST | `/orders/{id}/return` | Request a return on a `delivered`/`paid` order. Body: `{ reason }` → sets `returnStatus: "requested"`, appends `return_requested` event, mirrors cancel refund semantics (`refundStatus: "requested"` when a Razorpay payment id exists). 409 `RETURN_NOT_ALLOWED` / `RETURN_ALREADY_REQUESTED`. | order owner |
| PATCH | `/orders/{id}/status` | Ops/admin progression: `placed→confirmed→shipped→out_for_delivery→delivered→(closed)`; `cancelled`/`returned` terminal. Body: `{ status, note? }`; appends an event; `cancelled`/`returned` restore stock and request refunds. 400 `INVALID_STATUS_TRANSITION`; 403 `FORBIDDEN_ADMIN` for non-admins. | admin |
| POST | `/seller/products` | Seller creates a storefront product. Body: `{ title, category, brand?, mrp, discountedPrice, stock, unit, description?, imageUrl? }` → 201 with `sellerId`, `sellerName`/`dealerName` from the seller profile. 403 `FORBIDDEN_ROLE` for non-sellers. | seller |
| GET | `/seller/products` | Seller's own products with real stock numbers: `{ data, total }`. | seller |
| PUT | `/seller/products/{id}` | Update price/stock/title/etc. Owning seller only (403 `FORBIDDEN`, 404 `PRODUCT_NOT_FOUND`). | seller |
| POST | `/my-products` | Any logged-in user creates a product with the full parameter set. Body: `{ title, category, brand?, vernacularTitle?, description?, mrp, discountedPrice (≤ mrp, else 422 `VALIDATION_ERROR`), stock?, unit?, imageUrl?, batchNo? }` → 201; server sets `id`, `sellerId` (= caller), `sellerName`/`dealerName` from the user profile, `rating: 0`, `reviewsCount: 0`, `distanceKm: 0`, `bnplAvailable: false`, `createdAt`; empty `batchNo` auto-generates `USR-XXXXXXXX`. Product appears in `GET /products`. | all |
| GET | `/my-products` | Caller's own products, full fields incl. real `stock`, newest first: `{ data, total }`. | all |
| PUT | `/my-products/{id}` | Partial update of own product (non-`None` fields applied, `updatedAt` set). 403 `FORBIDDEN` for other users, 404 `PRODUCT_NOT_FOUND`; 422 `VALIDATION_ERROR` when the resulting `discountedPrice` exceeds `mrp`. | all |
| DELETE | `/my-products/{id}` | Owner only → 204 (product removed from marketplace). 409 `PRODUCT_HAS_ORDERS` when a non-cancelled order references the product; cancelled orders do not block. | all |
| GET | `/analytics/customer` | Customer dashboard: `{ totalSpent, totalOrders, ordersByStatus, monthlySpend: [{month, amount}] (12m), categorySpend: [{category, amount}], topProducts: [{productId, title, quantity, amount}] (top 5), wishlistCount, activeCoupons, pendingReturns }`. Spend = `finalTotal` (fallback `total`) of non-cancelled orders; coupon discounts are prorated across line items. | all |
| GET | `/analytics/seller` | Seller storefront dashboard: `{ revenue, ordersCount, itemsSold, aov, monthlyRevenue (12m), topProducts (top 5), categoryBreakdown: [{category, revenue}], lowStock: [{productId, title, stock}] (stock < 10), returnRate, recentOrders: [{id, total, status, createdAt}] (last 10) }`. 403 `FORBIDDEN_ROLE` for non-sellers. | seller |
| GET | `/admin/analytics/emarket` | Admin E-Market KPIs: `{ gmv, totalOrders, totalCustomers, totalSellers, aov, monthlyGmv (12m), ordersByStatus, categoryShare: [{category, revenue}], topProducts: [{id, title, revenue, orders}] (top 5), topSellers: [{sellerId, name, revenue, orders}] (top 5), returnRate, couponUsage: {issued, used} }`. 403 `FORBIDDEN_ADMIN` for non-admins. | admin |

---

## 23. Direct-Buyer B2B Procurement: Demands, Offers & Negotiation, Purchases, QC, Escrow-style Payments & Invoicing

> Added 2026-09-26 (`source: extension-2026-09-26`). The `directBuyer` profile is now a valid registration profile — the bulk B2B procurer (retailer/wholesaler/processor/exporter/hotel/institutional) — with `roleProfiles.directBuyer = { companyName, buyerType, gstin?, licenseNo?, capacityPerMonth?, categories?, operatingStates?, creditTermsDays? }` and default home route `directBuyerHome`. Direct trade runs on three new collections: `demands` (buy leads), `offers` (dual-target negotiation: demand or lot, single counter round), and `purchases` (procurement orders with an explicit status map, payment ledger, QC gate, invoice generation and two-sided ratings). Counterparty ratings are stored on the purchase doc and averaged for the saved-farmer network.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/direct-buyer/profile` | Buyer profile: user fields + `roleProfile` (registration detail) + `stats { totalPurchases, totalSpend, completedPurchases, activeDemands }`. 403 `FORBIDDEN_ROLE` for non-directBuyers. | directBuyer |
| GET | `/direct-buyer/analytics` | Procurement dashboard: `{ totalSpend, totalVolume, activeDemands, openOffers, purchasesByStatus, monthlyProcurement: [{month, spend, volume}] (12m), cropBreakdown: [{crop, spend, volume, avgPrice}], topSuppliers: [{farmerId, farmerName, spend, purchases}] (top 5), avgPriceVsMandi: [{crop, avgPurchasePrice, mandiModalPrice|null}] (mandi modal matched by crop name, null when unknown), qcRejectionRate, completionRate, pendingBalance }`. Computed from the buyer's purchases (≤1000). 403 `FORBIDDEN_ROLE` for farmers. | directBuyer |
| POST | `/direct-buyer/saved-farmers` | Save a farmer to the trusted network. Body `{ farmerId }` → 201 (idempotent on duplicates); 404 `FARMER_NOT_FOUND`. | directBuyer |
| GET | `/direct-buyer/saved-farmers` | `{ data: [{ farmerId, farmerName, village, district, rating }], total }` — farmer docs resolved live; `rating` is the average `buyerToFarmer` rating across purchases (null when unrated). | directBuyer |
| DELETE | `/direct-buyer/saved-farmers/{farmerId}` | Remove from saved network → 204. | directBuyer |
| GET | `/direct-buyer/feed?limit=` | "For You" feed: newest `open` lots matching the buyer's **active demand crops** or posted by **saved farmers**, enriched with `farmerName`/`farmerVillage`: `{ data, total }`. Limit default 20, max 50. | directBuyer |
| POST | `/demands` | Create a buy-requirement. Body `{ crop, variety?, quantity, unit?, qualityGrade: A/B/C?, maxPrice (₹/unit), packaging?, deliveryLocation?, neededBy?, frequency: oneTime/weekly/monthly?, notes? }` → 201 with `id dem_*`, `status: open`, `offersCount: 0`, `buyerCompany` from the role profile, `state` from the buyer profile. 403 `FORBIDDEN_ROLE` for non-directBuyers. | directBuyer |
| GET | `/demands?crop=&state=&status=&page=&pageSize=` | **Public** buy-lead board (farmers/sellers discover demand). Defaults to `status=open`; `?status=all` lists the caller's own demands in any status. `{ data, page, pageSize, total }`. | all |
| GET | `/demands/{id}` | Public demand detail. 404 `DEMAND_NOT_FOUND`. | all |
| PUT | `/demands/{id}` | Owner only (403 `FORBIDDEN`); open only (400 `DEMAND_CLOSED`); partial update + `updatedAt`. | directBuyer |
| POST | `/demands/{id}/close` · `/demands/{id}/reopen` | Owner only. Close sets `status: closed` (idempotent); reopen requires closed (400 `DEMAND_NOT_CLOSED` otherwise). | directBuyer |
| DELETE | `/demands/{id}` | Owner only → 204. **409 `DEMAND_HAS_OFFERS`** while pending/countered offers reference the demand. | directBuyer |
| POST | `/offers` | Make an offer. Body `{ targetType: demand\|lot, targetId, pricePerUnit (₹ int), quantity, message? }`. Any logged-in user except the target owner (403 `OWN_DEMAND` / `OWN_LOT`); demand must be open (409 `DEMAND_CLOSED`), lot must be open (409 `LOT_NOT_OPEN`, 404 `LOT_NOT_FOUND`). **Idempotent**: replaying while a pending offer exists returns the existing offer with 200. Sets `toId`/`toName` = demand buyer / lot farmer; increments the demand `offersCount`. | all |
| GET | `/offers/mine?filter=sent\|received&targetType=&page=&pageSize=` | `sent` = offers I made; `received` = offers on my demands/lots. Optional `targetType` filter. Envelope `{ data, page, pageSize, total }`. | all |
| GET | `/offers/{id}` | Offer detail; `fromId`/`toId` participant only → 403. | all |
| POST | `/offers/{id}/accept` | Pending: **target owner only**; countered: **offer maker only** (accepting the counter). Status must be `pending`/`countered` (400 `OFFER_NOT_ACCEPTABLE`). Creates the `purchase` (`agreedPricePerUnit` = `counter.pricePerUnit` when countered else offer price, `source.type: offer`, `status: confirmed`), flips demand → `fulfilled` or lot → `sold`, sets offer → `accepted`. → 200 `{ offer, purchase }`. | all |
| POST | `/offers/{id}/reject` | Target owner only; `pending`/`countered` → `rejected` (terminal); 400 `OFFER_NOT_NEGOTIABLE` otherwise. | all |
| POST | `/offers/{id}/withdraw` | Offer maker only; `pending`/`countered` → `withdrawn` (terminal). | all |
| POST | `/offers/{id}/counter` | **Target owner only, `status: pending` only.** Body `{ pricePerUnit, note? }` → sets `counter { pricePerUnit, by, note, at }`, status `countered`. **Single counter round**: a second counter → 400 `NEGOTIATION_CLOSED`. The maker then accepts the counter via `/accept` (creates the purchase at the countered price) or rejects/withdraws. | all |
| POST | `/purchases` | Buy-now from a lot. Body `{ lotId, quantity? }` — quantity defaults to and caps at the lot's remaining availability → 201 purchase at the lot's `expectedRate` with `source.type: lot`; the lot is decremented and marked `sold` when fully consumed. 403 `OWN_LOT`, 404 `LOT_NOT_FOUND`, 409 `LOT_NOT_OPEN`. Offer-acceptance purchases are created automatically by `/offers/{id}/accept`. | all |
| GET | `/purchases?role=&page=&pageSize=` | Buyers see their own purchases; users whose active profile is `farmer` automatically see their sales (`?role=farmer\|buyer` forces a view). Envelope `{ data, page, pageSize, total }`. | all |
| GET | `/purchases/{id}` | Purchase detail; buyer or farmer participant only (403 / 404 `PURCHASE_NOT_FOUND`). | all |
| POST | `/purchases/{id}/advance` | `confirmed → advancePaid`. Body `{ amount, method?, reference? }`; `amount > 0` and ≤ `totalAmount` (422); appends payment `kind: advance`, sets `advancePaid`, records event. | buyer or farmer |
| POST | `/purchases/{id}/pickup` | `advancePaid → pickupScheduled`. Body `{ date, vehicleType?, address?, notes? }` stored on `pickup`. | buyer or farmer |
| POST | `/purchases/{id}/dispatch` | `pickupScheduled → inTransit`. | buyer or farmer |
| POST | `/purchases/{id}/deliver` | `inTransit → delivered`. | buyer or farmer |
| POST | `/purchases/{id}/qc` | `delivered` only (400 `INVALID_STATUS_TRANSITION`). Body `{ grade: A/B/C, acceptedQty, rejectedQty, note? }`; `acceptedQty + rejectedQty` must equal `quantity` (422). Full acceptance → `completed`, `finalAmount = totalAmount`, invoice auto-issued; partial → `qcDisputed`, `finalAmount = acceptedQty × agreedPricePerUnit`. | buyer or farmer |
| POST | `/purchases/{id}/resolve` | `qcDisputed → completed`. Body `{ resolution }`; issues the invoice at the adjusted `finalAmount` and records a `resolved` event. | buyer or farmer |
| POST | `/purchases/{id}/pay` | Any non-terminal status (409 `PAYMENT_NOT_ALLOWED` once `completed`/`cancelled`). Body `{ amount, method?, reference?, kind: balance\|full }`; `amount` ≤ `(finalAmount\|totalAmount) − Σ payments` else **409 `PAYMENT_EXCEEDS_DUE`**; appends payment + `payment` event. | buyer or farmer |
| POST | `/purchases/{id}/cancel` | Allowed from `confirmed`/`advancePaid`/`pickupScheduled` → `cancelled` + event (400 `INVALID_STATUS_TRANSITION` from `inTransit` onwards). Body `{ reason? }`. | buyer or farmer |
| POST | `/purchases/{id}/rate` | `completed` only (409 `NOT_COMPLETED`); one rating per side (**409 `ALREADY_RATED`**). Body `{ target: farmer\|buyer, rating: 1-5, review? }` — the directBuyer rates the farmer, the farmer rates the buyer, anyone else → 403. Stored on `rating.buyerToFarmer` / `rating.farmerToBuyer`. | buyer / farmer |
| GET | `/purchases/{id}/invoice` | `{ purchaseId, number: "INV-XXXXXXXX-YYMM", issuedAt }`; 404 `INVOICE_NOT_FOUND` until the purchase is completed (via full QC or dispute resolution). | buyer or farmer |

**Purchase status map** (mirrors the order lifecycle): `confirmed → advancePaid → pickupScheduled → inTransit → delivered → completed`, with `delivered → qcDisputed → completed` as the dispute branch; `cancelled` is terminal from `confirmed`/`advancePaid`/`pickupScheduled`. Money movement is recorded in the `payments` ledger (advance/balance/full), not as statuses.

---

## 24. Notifications & Women Module Surfaces

> Added 2026-09-27 (`source: extension-2026-09-27`). Mobile "no fake data" rewiring: the notifications endpoints the mobile NotificationsApi already calls now exist for real (backed by the `notifications` collection that `services/notifications.py` writes), the two hardcoded women-mode widgets get real data sources, and `GET /users/me` guarantees the mobile hydration fields even on partial/legacy user docs.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/notifications?page=&pageSize=` | Own notifications (`userId ==` caller) from collection `notifications`, `createdAt` desc, paged envelope `{ data: [{ id, userId, title, body, type, read, createdAt }], page, pageSize, total }`; empty → 200 `{ data: [] }`; `pageSize` default 20. | all |
| PUT | `/notifications/read-all` | Mark all own **unread** notifications read (`read: true` + `readAt`) → `{ updated: n }`. | all |
| POST | `/notifications/{id}/read` | Mark one own notification read → `{ ok: true }`; **404 `NOT_FOUND`** when the doc is missing or belongs to another user. | all |
| POST | `/notifications` | Create a notification (used by backend modules and tests). Body `{ userId, title, body, type? = "general" }` (title/body required) → 201, id `ntf_` + hex, `read: false`, `createdAt` now. | all |
| GET | `/women/garden-plans` | Nutrition-garden plan recommendations: `{ data: [{ id, category, items: [{ name, vernacularName, nutrition, companion, daysToHarvest }] }] }` — categories Leafy Greens (पालक/मेथी/धनिया/तांदूळ), Vegetables (टमाटर/गाजर/वांगी/भेंडी), Trees/Perennials (शेवगा/पपई/पेरू/कढीपत्ता). | all |
| GET | `/women/backyard-livestock` | Backyard livestock health tracker sample: `{ data: [{ id, animal, vernacularName, count, yieldLabel, vaccine, vaccineDue }] }` (cow/गाय, buffalo/म्हैस, hen/कोंबडी, goat/शेळी/बकरी); `vaccineDue` is an ISO date computed relative to today. | all |
| GET | `/users/me` | Extended: response guarantees the mobile hydration fields with defaults when absent on the user doc — `village/tehsil/district/state: ""`, `landAreaAcres: 0`, `soilType/irrigationType: ""`, `activeCrops: []`, `farmBoundaryPoints: []`, `agriCoins: 0`, `krishiRatnaLevel: 1` (`referralCode`/`language` already backfilled by `get_user`). | all |

---

## 25. Broker/Dalal Deal Desk & Farmer Offers

> Added 2026-10-01 (`source: extension-2026-10-01`). Broker deal desk (`broker_deals`, `broker_leads`, `deal_messages`) plus the farmer-side offer surface. Buyer/seller on a deal are name+phone strings; the farmer acts as the deal's `seller` and is matched by **last-10-digits of the registered phone** (`sellerPhone`). Deal docs may carry `sellerUid`, `buyerUid` (best-effort phone lookup at create), `evidence[]` and `cancelReason`. Server math: `grossAmount = quantityQuintals × agreedRate`, `commissionAmount = gross × brokerCommissionPct / 100` (0–10, default 2). **Ownership:** every broker deal/lead mutation returns 404 (`DEAL_NOT_FOUND` / `LEAD_NOT_FOUND`) for a missing *or foreign* doc — existence never leaks. The old demo fallback (returning `omni-user-777` / `dev-user-1` docs when the caller had none) is **removed**; an empty `data: []` is a valid response. Notifications (`deal_offer_received`, `deal_contract_issued`, `deal_in_transit`, `deal_completed`, `deal_accepted`, `deal_counter_offer`) are in-app + FCM, best-effort, and never contain phone numbers.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/broker/deals?status=&page=&pageSize=` | Own deals (`brokerId ==` caller), `createdAt` desc, envelope `{ data, page, pageSize, total }`. Empty list when none — no demo fallback. | broker |
| POST | `/broker/deals` | Record a deal. Body `{ buyerName, buyerPhone?, buyerCompany?, sellerName, sellerPhone?, commodity, variety?, grade?, quantityQuintals (>0), agreedRate (>0), deliveryLocation?, brokerCommissionPct? (0–10, default 2), paymentTerms?, notes? }` → 201 `status: negotiating`, auto `grossAmount`/`commissionAmount`, `brokerName` from profile; best-effort `sellerUid`/`buyerUid` resolved by phone (exact, else last-10). Notifies the seller when resolvable. | broker |
| GET | `/broker/deals/{id}` | Deal detail (includes `evidence[]`). 404 `DEAL_NOT_FOUND` unless `brokerId ==` caller. | broker |
| PUT | `/broker/deals/{id}` | Partial update (`status`, `agreedRate`, `quantityQuintals`, `deliveryLocation`, `paymentTerms`, `notes`); owner only (404 otherwise). Rate/qty change recomputes gross/commission. Status transitions `contract_issued` / `in_transit` / `completed` notify the seller (completed includes gross + commission payout math). | broker |
| DELETE | `/broker/deals/{id}` | Cancel → `{ ok: true, status: "cancelled" }`; owner only (404 otherwise). | broker |
| GET | `/broker/deals/{id}/messages` | Negotiation thread `{ data: [{ id, dealId, senderId, senderRole: broker\|buyer\|seller, senderName, text, amountOffer?, createdAt }] }`, oldest first; owner only (404). | broker |
| POST | `/broker/deals/{id}/messages` | Post a structured negotiation card. Body `{ senderRole: broker\|buyer\|seller, senderName?, text, amountOffer? (₹/quintal) }` → 201; owner only (404 otherwise). | broker |
| POST | `/broker/deals/{id}/evidence` | Multipart `file` (JPG/PNG ≤ 5 MB) + optional form field `kind: photo\|weighbridge\|loading\|delivery\|damage` (default `photo`) → 201 `{ id: "evi_…", blobPath, kind, uploadedBy, createdAt }`, appended to `deal.evidence` (max 20, 409 `EVIDENCE_LIMIT_REACHED`). Owner only (404 `DEAL_NOT_FOUND`); evidence travels with deal GETs. | broker |
| GET | `/broker/leads?type=&status=` | Own CRM leads, newest first: `{ data, total }`. No demo fallback — empty when none. | broker |
| POST | `/broker/leads` | Add a lead. Body `{ name, phone, type: farmer\|buyer\|trader, commodity, quantityExpected?, targetRate?, location?, notes? }` → 201 `status: active`. | broker |
| PUT | `/broker/leads/{id}` | Partial update (`status: active\|contacted\|negotiating\|converted\|dropped`, `targetRate`, `quantityExpected`, `notes`); owner only (404 `LEAD_NOT_FOUND`). | broker |
| DELETE | `/broker/leads/{id}` | Drop → `{ ok: true, status: "dropped" }`; owner only (404). | broker |
| GET | `/broker/commissions` | `{ totalEarned (Σ commission, status completed), pendingPayout (Σ negotiating/contract_issued/accepted/in_transit), completedDealsCount, activeDealsCount, deals[] }`. | broker |
| GET | `/farmer/deals?status=&page=&pageSize=` | Deals where the caller is the seller, matched on last-10-digits of `sellerPhone` vs the farmer's registered phone; `createdAt` desc, same envelope as the broker list. | farmer |
| GET | `/farmer/deals/{id}` | Deal detail for the phone-matched seller; 404 `DEAL_NOT_FOUND` otherwise (existence never leaks). | farmer |
| GET | `/farmer/deals/{id}/messages` | Same thread shape as the broker side; 404 unless the deal matches the farmer's phone. | farmer |
| POST | `/farmer/deals/{id}/messages` | Counter-offer / reply. Body `DealMessageCreate` but `senderRole` is forced to `seller`, `senderId` = caller, `senderName` from the user doc → 201; notifies the broker (counter-offer includes `amountOffer` when present). 404 unless matched. | farmer |
| POST | `/farmer/deals/{id}/respond` | One-tap decision. Body `{ action: accept\|decline, reason? }`. `accept` only from `contract_issued` → `status: accepted` (sets `sellerUid` when absent); `decline` from `negotiating`/`contract_issued` → `status: cancelled` + `cancelReason`. Any other current status → **409 `INVALID_STATE`**. Accept notifies the broker. → 200 full deal doc; 404 `DEAL_NOT_FOUND` unless matched. | farmer |
| POST | `/farmer/deals/{id}/evidence` | Same as the broker evidence endpoint (multipart `file` + `kind`), ownership = phone match (404 `DEAL_NOT_FOUND` otherwise). | farmer |

Deal status map: `negotiating → contract_issued → accepted → in_transit → completed` with `cancelled` terminal (`decline` from `negotiating`/`contract_issued`, broker DELETE anytime). Settlements for the broker role aggregate completed deals by `grossAmount` (see §21 `/jobs/settlements/run`, `/broker/settlements`).

---

## 26. Persona Intelligence, Price Alerts & Targeted Supply Contracts

> Added 2026-10-01 (`source: extension-2026-10-01b`). Three backend additions: (1) `GET /intelligence` — a persona-keyed analytics digest computed from the caller's real collections, with a locked response shape the website renders directly (i18n `labelKey`s, never fabricated data — missing source rows mean the kpi/series/breakdown is omitted); (2) `price_alerts` — per-user mandi-modal price watchers that fire once when crossed; (3) targeted supply contracts — buyers create crop contracts aimed at a specific farmer uid, the farmer MPIN-e-signs (`offered → active`), and scheduled delivery slots generate real `purchases` (status `confirmed`, `source.type: "contract"`). Also: `directBuyer` added to `MANDI_ROLES` and the marketplace/orders role tuples, and a `directBuyer` quick-login persona (`dev-user-8`, Shree Foods Pvt Ltd).

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/intelligence` | Persona digest for the caller's `activeProfile` (`seller`/`directBuyer` → procurement, `transport`/`transporter` → trips, `farmer` → lots/sales, `broker` → deal funnel; anything else → 404 `INTELLIGENCE_NOT_AVAILABLE`). Locked shape `{ persona, generatedAt, kpis[≤6], series[≤3 × ≤12 pts], breakdowns[≤3 × ≤5 items], insights[≤4] }` — kpi `{key, labelKey, value, unit?, deltaPct?, direction?}`, series `{key, labelKey, points:[{label, value}]}`, breakdown `{key, labelKey, items:[{label, value, unit?}]}`, insight `{severity: info\|opportunity\|warning, labelKey, params?}`. Only real collection data; counts may be 0, derived stats are omitted when there is no source data. Insight keys: `mandi_up_for_your_crop`, `buying_below_mandi`, `balance_due`, `stale_lot`, `sold_below_mandi`, `settlement_pending`. | all |
| GET | `/price-alerts` | Own alert rules from `price_alerts`, newest first: `{ data: [{ id, crop, targetPrice, above, currentModal (avg modalPrice over `mandi_prices` docs whose commodity contains the crop, case-insensitive; null when none), fired, createdAt }] }`. When an un-fired rule's condition is crossed (`modal ≥ target` when `above`, `modal ≤ target` otherwise) → persists `firedAt` once and notifies `price_alert` (`/dashboard/p/mandi`). | all |
| POST | `/price-alerts` | Create rule. Body `{ crop, targetPrice (>0), above? = true }` → 201 with `currentModal`/`fired: false`; **422** `fieldErrors {crop: "no mandi data for this crop"}` when no `mandi_prices` doc matches the crop (case-insensitive contains). | all |
| DELETE | `/price-alerts/{id}` | Delete own rule → 204; missing or another user's → 404 `ALERT_NOT_FOUND`. | all |
| POST | `/contracts` | Buyer creates a targeted supply contract (id `con_<hex12>`). Body `ContractCreate { farmerId, crop, quantityTotal (>0), priceType: fixed\|mandiLinked = fixed, baseRate?, premiumPerQuintal? = 0, mandiName? = "", schedule {startDate, endDate, frequency: weekly\|biweekly\|monthly, qtyPerDelivery (>0)}, deliveryLocation? = "", paymentTermsDays? = 0, termsText? = "" }`. Validation: `fixed` requires `baseRate > 0`, `mandiLinked` requires non-empty `mandiName` (422 fieldErrors). `buyerCompany` from the `directBuyer` role profile `companyName` → `seller` `shopName` → user name. Status `offered`, `deliveriesGenerated: 0`; notifies the farmer (`contract_offer_received`, path `/dashboard/p/myContracts/{id}`). 404 `FARMER_NOT_FOUND` for unknown farmer. Legacy seed fields (`lockedRateQuintal`, `minQuantityQuintals`, `contractDuration`, `paymentTerms`, …) are auto-populated so old readers keep working. | directBuyer, seller |
| GET | `/contracts/mine?role=buyer\|farmer&status=` | Targeted contracts: `role=buyer` → `buyerId ==` caller (directBuyer/seller); `role=farmer` → `farmerId ==` caller (farmer role); other roles/params → 403/422. Each doc enriched with `currentPrice`: `fixed` → `baseRate`; `mandiLinked` → avg `mandi_prices` modal for the crop (filtered by `mandiName` substring when set) + `premiumPerQuintal`, rounded 2dp; `null` when no mandi data. `{ data, total }`. | directBuyer, seller, farmer |
| PUT | `/contracts/{id}` | Buyer owner edits an `offered` contract (partial merge of the `ContractCreate` fields); re-validates the price rule and re-syncs legacy mirrors. Non-owner → 403 `FORBIDDEN`; not `offered` → 409 `CONTRACT_NOT_OPEN`. | directBuyer, seller |
| POST | `/contracts/{id}/cancel` | Buyer owner cancels a non-terminal contract → `status: cancelled` + `cancelReason`; notifies the farmer. Already `cancelled`/`declined` → 409. | directBuyer, seller |
| POST | `/contracts/{id}/decline` | Targeted farmer only (`contract.farmerId ==` caller, farmer role) declines an `offered` contract → `status: declined` + `declineReason`; notifies the buyer. Wrong farmer / untargeted → 403 `FORBIDDEN`; not `offered` → 409. | farmer |
| POST | `/contracts/{id}/accept` | MPIN e-sign (unchanged for legacy untargeted `open` contracts → `accepted`). **Targeted contracts** (`farmerId` set): only that farmer may sign (else 403 `FORBIDDEN`), `offered → active`, notifies the buyer (`contract_accepted`). Keeps the `contracts/{id}/acceptances` signature record. | farmer, seller |
| POST | `/contracts/{id}/deliveries` | Buyer owner, `active` contracts only. Body `{ slotDate }` → creates a real purchase (201): id `pur_<hex12>`, `status: confirmed`, `source {type: "contract", refId}`, `contractId`, `deliverySlot`, `quantity = schedule.qtyPerDelivery`, rate = `baseRate` (fixed) or current mandi modal + `premiumPerQuintal` (mandiLinked; 422 `NO_MANDI_DATA` when no modal), full escrow/handover/event scaffolding as in `POST /purchases`. Appends `{slotDate, purchaseId}` to `contract.deliveries`, `deliveriesGenerated += 1`, notifies the farmer (`booking_confirmed`). Idempotent per slot — repeat call → 200 with the existing purchase. Not active / non-owner → 409/403. | directBuyer, seller |
| GET | `/contracts/{id}/deliveries` | Participant only (buyer owner or targeted farmer; else 403). `{ data: [{ slotDate, purchaseId, status (from the purchase), finalAmount? }], fulfilment: { total, completed, cancelled, pending } }`. | directBuyer, seller, farmer |

Contract status map (targeted): `offered → active` (farmer MPIN accept) with `declined`/`cancelled` terminal; legacy untargeted seeds keep the old `open → accepted` flow. `GET /contracts` and `GET /contracts/{id}` stay backward compatible and now include `currentPrice` when `priceType` is set.

---

## External Integrations Summary

| Service | Used by |
|---|---|
| **Agmarknet / eNAM APIs** | mandi prices, vyapari-rate fallback, arrival data (§4, §5 saturation) |
| **OpenRouter (LLM)** | Kisan Mitra chatbot with agri-tuned prompts (§5) |
| **Sarvam AI** | speech-to-text, 15+ Indian dialects (§5) |
| **Bhashini** | TTS/audio readouts, translation (cross-cutting) |
| **mahabhulekh / Aaple Sarkar** | 7/12 & 8A land records (§13) |
| **PMFBY portal** | policy issuance, certificate URLs (§12) |
| **Govt portals** (PM-KISAN, PMFBY, SHC, PM-KUSUM, eNAM) | scheme deep-links (§10) |
| **CGWB** | groundwater data (§9) |
| **ICRISAT / State Agri Dept** | district crop mapping (§3) |
| **IMD / OpenWeather** | weather strip & radar (§5) |
| **Payment gateway + BNPL partner** | marketplace orders, workshops, loans (§6, §11, §17) |
| **SMS/WhatsApp provider** | OTP, referrals, booking reminders, owner notifications |
