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
| POST | `/auth/firebase-verify` | Exchange Firebase Phone Auth ID token for API session tokens. Body: `{ idToken }`. Returns `{ accessToken, refreshToken, isNewUser, user }`. (Preferred client OTP verification method) | public |
| POST | `/auth/mpin/set` | Set initial 4-digit MPIN for authenticated user. Body: `{ mpin }`. | all |
| POST | `/auth/mpin/verify` | Verify 4-digit MPIN for 2FA / step-up authorization. Body: `{ mpin }`. Returns `{ verified: true }`. | all |

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
| GET | `/users/me/dashboard/{profileType}` | Persona home payload: metric pills, quick actions, live activity list (leases/trips/ledger/fleet/deals per role). (P2-1) | all |
| POST | `/users/me/data-export` | Request full personal data export archive (DPDP Act compliance). Returns `{ exportId, status: "pending" }`. | all |
| GET | `/users/me/data-export/latest` | Get status and signed download URL for user's latest data export archive. Returns `{ exportId, status, downloadUrl?, expiresAt? }`. | all |

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
| POST | `/advisory/sowing-intent` | Submit seasonal crop sowing intention for regional saturation mapping. Body: `{ crop, areaAcres, sowingDate, district }`. | farmer |
| GET | `/advisory/disease-scans` | Historical leaf disease scans with diagnoses, severity, and treatments. | farmer |
| POST | `/advisory/crop-plan` | Generate personalized AI agronomic crop calendar and advisory plan. Body: `{ crop, sowingDate, landAreaAcres, soilType, irrigationType }`. | farmer |
| POST | `/advisory/crop-plan/confirm` | Confirm and save crop calendar to user urgent tasks. Body: `{ planId }`. | farmer |
| POST | `/chatbot/expert-handoff` | Dedicated endpoint for human expert handoff request. Body: `{ sessionId, reason }` → `{ expertName, contactChannel, etaMinutes }`. (Synonym of `/chatbot/handoff`) | all |
| GET | `/chatbot/experts` | Directory of available agronomy & veterinary experts with live availability status. | all |
| POST | `/uploads` | Multipart file upload (`files[]` → Storage URL) for course media, podcasts, KYC, diary receipts, and evidence. (P0-8) | all |

## 6. Marketplace (Agri Inputs)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/products?category=&query=&lat=&lng=&page=` | `InputProduct[]`: `{ id, title, vernacularTitle, category, brand, rating, reviewsCount, dealerName, distanceKm, mrp, discountedPrice, bnplAvailable, batchNo }`. Categories: seeds, vehicles, fertilizer, pesticide, tools. | farmer, landlord, transporter, seller |
| GET | `/products/{id}` | Product detail. | farmer, landlord, transporter, seller |
| GET | `/products/{id}/certificate` | QR authenticity certificate (Agmark/Ministry): `{ batchNo, certifier, certificateNo, valid, verifiedAt }`. | farmer, landlord, transporter, seller |
| GET | `/cart` · POST `/cart/items` · PUT `/cart/items/{productId}` · DELETE `/cart/items/{productId}` | Cart CRUD. Body: `{ productId, quantity }`. (AppState: addToCart/removeFromCart/clearCart, cartTotal) | farmer, landlord, transporter, seller |
| POST | `/orders` | Place order. Body: `{ items[], paymentMethod (upi/cod/bnpl), deliveryAddress, idempotencyKey }`. Returns `{ orderId, total, bnplSchedule? }`. | farmer, landlord, transporter, seller |
| GET | `/orders` · GET `/orders/{id}` | Order history/detail with delivery status. | farmer, landlord, transporter, seller |
| GET | `/orders/{id}/bnpl-schedule` | View persisted BNPL installment payment schedule and due dates for an order. (P2-17) | farmer, landlord, transporter, seller, customer |
| POST | `/seller/team/invites` | Invite team sub-account member. Body: `{ phone, name, role: manager|cashier|dispatcher }`. (P1-2) | seller |
| GET | `/seller/team/members` | List active team sub-account members with permissions. (P1-2) | seller |
| PUT | `/seller/team/members/{id}/role` | Update team member role / permissions. Body: `{ role }`. (P1-2) | seller |
| DELETE | `/seller/team/members/{id}` | Revoke and remove team member sub-account. (P1-2) | seller |
| PATCH | `/seller/orders/{id}/status` | Update fulfillment status of own mall order (`confirmed → shipped → out_for_delivery → delivered`). (P1-3) | seller |
| GET | `/seller/gst-reports` | Monthly GST sales register and tax liability report (`?from=&to=&format=csv|json`). (P1-4) | seller |
| GET | `/seller/purchases/{id}/commission-invoice` | Platform commission invoice PDF/JSON for 2% escrow deduction. (P1-4) | seller |
| POST | `/seller/stock` | Add manual produce stock inventory entry. Body: `{ crop, quantityQuintals, ratePerQuintal, warehouseLocation? }`. | seller |
| POST | `/seller/stock/from-purchase/{id}` | Convert delivered in-app B2B purchase into live warehouse stock. | seller |
| GET | `/seller/stock` | List current inventory stock entries with available and reserved quantities. | seller |
| POST | `/seller/stock/{id}/adjust` | Signed stock adjustment with reason. Body: `{ deltaQuintals, reason: spoilage|shrinkage|recount }`. | seller |
| GET | `/seller/cashflow` | Unified cashflow analytics combining in-app sales and offline credit book. | seller |
| GET | `/saved-searches` · POST `/saved-searches` | List / save discovery filter criteria. Body: `{ query, category?, maxPrice?, district? }`. (P2-3) | all |
| DELETE | `/saved-searches/{id}` | Delete saved search filter. (P2-3) | all |
| POST | `/saved-searches/{id}/alerts` | Toggle harvest-window and new-listing push alerts for a saved search. (P2-3) | all |
| POST | `/market/lots/{id}/relist` | Relist lot with priority badge following counterparty no-show. (P2-4) | farmer |

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
| POST | `/transport/bookings/{id}/payments` | Capture trip fare payment / advance into escrow hold. Body: `{ amount, method, reference? }`. (P0-1) | farmer, seller, transporter |
| POST | `/transport/bookings/{id}/escrow/release` | Release trip fare escrow to transporter on verified delivery. (P0-1) | farmer, seller, admin |
| GET | `/transport/wallet` | Transporter balance, pending escrow holds, lifetime earnings and TDS summary. (P0-1) | transporter |
| POST | `/transport/payouts` | Withdraw available wallet balance to verified primary bank account / UPI. Body: `{ amountPaise }`. (P0-1) | transporter |
| GET | `/transport/ratings` | Transporter received ratings, feedback reviews, and aggregate star rating. (P1-27) | transporter |
| POST | `/transport/bookings/{id}/stops` | Add intermediate waypoint / drop stop for multi-drop milk runs. Body: `{ stopNumber, location, contactPhone, notes? }`. (P2-36) | transporter |
| POST | `/transport/bookings/{id}/stops/{stop_no}/pod` | Submit proof of delivery for intermediate stop. Multipart `file` + `{ recipientName, signatureData? }`. (P2-36) | transporter |
| POST | `/transport/bookings/{id}/breakdown` | Report mid-trip vehicle breakdown: triggers load re-matching and pro-rata fare adjustment. Body: `{ reason, location, requiresTow? }`. (P2-37) | transporter |
| GET | `/transport/loads/matched` | Personalized load recommendations based on current location and vehicle capacity. (P2-38) | transporter |
| GET | `/transport/fare-trends` | Historical and seasonal per-km fare trends by route. `?pickup=&drop=&vehicleType=`. (P2-38) | transporter, farmer, seller |
| GET | `/transport/compliance` | Transporter compliance card: active strikes, suspension cooldown timer, penalty rules. (P2-39) | transporter |
| POST | `/transport/instant-bookings` | Instant vehicle booking from live nearby map. Body: `{ vehicleId, pickup, drop, scheduledTime }`. | farmer, seller |
| GET | `/transport/nearby-vehicles` | Real-time map pins of available transport vehicles within radius. `?lat=&lng=&radiusKm=`. | farmer, seller |
| POST | `/transport/vehicles/{id}/location` | Fleet GPS telematics ping. Body: `{ lat, lng, speed?, availableNow? }`. | transporter |
| POST | `/transport/bookings/{id}/assign-driver` | Reassign trip to another verified fleet driver. Body: `{ driverId, driverName, driverPhone }`. | transporter |
| POST | `/transport/bookings/{id}/inspection` | Pre-trip vehicle safety inspection report. Body: `{ odometerKm, tyreCondition, cleanCargoArea: bool }`. | transporter |
| PUT | `/transport/vehicles/{id}` | Partial update of own vehicle (perKmRate, baseFare, homeLocation, availableNow; resets docStatus to pending). | transport |
| GET | `/transport/drivers/{id}/analytics` | Fleet-owner per-driver performance analytics: total/completed/cancelled trips, gross earnings, average rating. | transport |
| POST | `/transport/loads` | Farmer posts load to load board `{ crop, quantityQuintals, packaging?, vehicleType?, pickup, drop, targetFare?, urgent? }` (urgent notifies nearby verified drivers). | farmer |
| GET | `/transport/loads` | Open load board for transporters to browse and bid; sorted by urgent first, then date. | transport, farmer, seller |

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
| GET | `/loans/{id}/documents/{documentId}/download` | Generate time-boxed signed URL for banker to download applicant KYC/land records. (P1-23) | bankManager, admin |
| POST | `/loans/{id}/repayments` | Record EMI repayment transaction. Body: `{ amount, paymentMode, transactionRef, repaymentDate }`. (P1-24) | bankManager, farmer |
| GET | `/loans/{id}/repayments` | EMI repayment ledger: scheduled installments, paid installments, overdue penalties. (P1-24) | bankManager, farmer |
| GET | `/loans/audit-logs` | Banker's own underwriting decision trail and sanction log (`?applicationId=&page=`). (P2-20) | bankManager |

## 11c. Loan Management — Superadmin Console (SOP-14)

> Superadmin oversight of the same `loan_applications` collection (Module 14 — Banking, Credit Score & Microfinance, per `docs/superadmin-instructions/14-banking-credit-and-loan-underwriting.md`). The admin moves loans along the same `LOAN_TRANSITIONS` state machine as the bankManager — illegal jumps → 409 `LOAN_INVALID_TRANSITION`. Every change appends a `timeline` entry and writes an `audit_logs` doc. 403 `FORBIDDEN_ADMIN` for non-admins.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/finance/loans?status=&page=&pageSize=` | Loan application underwriting queue: optional `status` filter over `loan_applications`, `createdAt` desc, envelope `{ data, page, pageSize, total }` of `LoanApplicationOut`. | admin |
| PUT | `/admin/finance/loans/{applicationId}/status` | Advance status along the loan state machine. Body `{ status, note? }` — `status` must be a `LoanStatus` (422 `VALIDATION_ERROR` otherwise); 409 `LOAN_INVALID_TRANSITION` on illegal jumps; 404 `LOAN_NOT_FOUND`; timeline + `audit_logs` entry; returns updated `LoanApplicationOut`. | admin |
| GET | `/admin/finance/credit-scores` | Aggregated credit score tier distribution histogram and default risk factors across applicants. (P2-19) | bankManager, superadmin |

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
| POST | `/insurance/provider/claims/{id}/payout-approval-request` | Submit claim payout for dual-admin sign-off when exceeding ₹50,000 threshold. Body: `{ proposedAmount, justification }`. (P0-14) | insuranceProvider, admin |
| GET | `/insurance/provider/claims/{id}/payout-approval-request` | Dual-signoff approval status and maker-checker audit trail for a claim. (P0-14) | insuranceProvider, admin |
| GET | `/insurance/provider/stats/export` | Export insurer portfolio metrics, loss ratio, and claims roster (CSV/JSON). (P2-21) | insuranceProvider, superadmin |


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
| POST | `/equipment/bookings/{id}/deposit` | Authorize / capture security deposit hold for equipment booking. Body: `{ amountPaise, paymentMethod }`. (P0-4) | farmer |
| POST | `/equipment/bookings/{id}/deposit/forfeit` | Forfeit security deposit towards documented machinery damage. Body: `{ forfeitAmountPaise, reason, evidenceUrls[] }`. (P0-4) | equipmentOwner, admin |
| POST | `/equipment/bookings/{id}/counter/accept` | Farmer or owner accepts negotiated counter-offer rate. (P1-5) | farmer, equipmentOwner |
| POST | `/equipment/bookings/{id}/counter/decline` | Decline counter-offer rate with reason. Body: `{ reason? }`. (P1-5) | farmer, equipmentOwner |
| GET | `/equipment/bookings/{id}/chat-room` | Booking-scoped chat room between farmer and equipment owner (unlocked upon confirmation). (P1-6) | farmer, equipmentOwner |
| POST | `/equipment/bookings/{id}/payments/order` | Create gateway payment order for booking advance/deposit hold. (P1-7) | farmer |
| POST | `/equipment/demand-posts/{id}/quotes` | Equipment owner submits custom rate quote on farmer's public demand post. Body: `{ rateRupeesPerHour, terms?, availableFrom }`. (P2-5) | equipmentOwner |
| PUT | `/equipment/{id}/pricing-rules` | Configure dynamic pricing, peak hours, minimum billing hours, and travel charges. Body: `{ minHours, travelChargePerKm, peakMultiplier }`. (P2-6) | equipmentOwner |
| GET | `/equipment/owner/tds-statements` | Equipment rental owner annual/quarterly TDS deduction certificates and statements. (P2-7) | equipmentOwner |
| GET | `/admin/equipment/damage-claims` | Superadmin triage queue for equipment damage reports and deposit forfeiture appeals. (P1-8) | admin |
| POST | `/equipment/demand-posts` | Farmer posts equipment requirement `{ machineType, acres?, dateFrom, dateTo, budgetPerHourRupees?, notes? }`. | farmer, farmLandlord, seller |
| GET | `/equipment/demand-posts` | Browse open farmer machinery demand posts with machineType/location filters. | all |
| DELETE | `/equipment/demand-posts/{id}` | Delete own equipment demand post. | all |
| POST | `/equipment/bookings/{bookingId}/contract` | Owner generates legal rental agreement contract with rate and terms. | equipmentRental |
| GET | `/equipment/bookings/{bookingId}/contract` | Rental contract document details with version history. | all |
| POST | `/equipment/bookings/{bookingId}/contract/esign` | MPIN digital signature on equipment rental contract `{ mpin, consentTimestamp }`. | all |
| GET | `/equipment/bookings/{bookingId}/contract/pdf` | Download signed equipment rental contract PDF. | all |
| POST | `/equipment/bookings/{bookingId}/payments` | In-app advance or balance payment towards booking. | all |
| POST | `/equipment/bookings/{bookingId}/refund` | Owner issues refund to farmer `{ amountRupees, reason }`. | equipmentRental |
| GET | `/equipment/bookings/{bookingId}/invoice` | Formal booking invoice PDF/JSON with platform commission and tax breakdown. | all |
| POST | `/equipment/bookings/{bookingId}/disputes` | Raise equipment damage or non-performance dispute with 72h resolution SLA. | all |
| GET | `/equipment/disputes/{disputeId}` · GET `/equipment/disputes` | Track dispute cases, evidence timeline, and remaining SLA hours. | all |
| POST | `/equipment/disputes/{disputeId}/evidence` | Submit photos and mechanical repair estimates for open dispute. | all |
| POST | `/equipment/bookings/{bookingId}/approve` | Owner approves booking and dispatches automated SMS confirmation. | equipmentRental |

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
| POST | `/livestock/gaushala/donations/{id}/pay` | Complete gateway payment for gaushala donation prior to 80G certificate issuance. Body: `{ paymentMethod, reference }`. (P0-12) | all |
| POST | `/livestock/gaushala/adoptions/{id}/pay` | Complete cow adoption sponsorship payment prior to 80G tax receipt generation. Body: `{ paymentMethod, reference }`. (P0-12) | all |

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
| POST | `/dairy-manager/collections/otp/send` | Issue OTP to member-farmer mobile for collection verification. Body: `{ collectionId, phone }`. (P0-7) | dairyManager |
| POST | `/dairy-manager/collections/otp/verify` | Verify member-farmer OTP to legally anchor milk intake and ledger payment. Body: `{ collectionId, otp }`. (P0-7) | dairyManager |
| POST | `/dairy-manager/collections/qr` | Generate dynamic QR code for farm-gate milk collection handover. Body: `{ collectionId }`. (P1-13) | dairyManager |
| POST | `/dairy-manager/collections/qr/scan` | Scan collection QR code to sync collection data between manager and farmer ledgers. Body: `{ qrData }`. (P1-13) | farmer, dairyManager |
| POST | `/dairy/purchases/{id}/contract/esign` | OTP-anchored e-signature of bulk milk procurement term sheet and quality specs. (P1-14) | dairyManager, milkSeller |
| POST | `/dairy-manager/routes/{id}/status` | Update milk procurement route lifecycle: `planned → dispatched → completed|cancelled`. (P2-9) | dairyManager |
| PUT | `/livestock/dairy/agents/{agent_uid}` | Update field collection agent assignment, assigned route IDs, and active status. (P2-10) | dairyManager |
| GET | `/dairy-manager/pickup-slots` · POST `/dairy-manager/pickup-slots/{slot_id}/book` | Dairy center pickup slot calendar and time-slot booking. (P2-11) | dairyManager, farmer |
| GET | `/dairy/commission-statements` | Monthly milk procurement commission and collection settlement statement (PDF/CSV). (P2-12) | dairyManager |
| GET | `/dairy/farmers/{farmer_id}/reliability` | Member-farmer reliability scorecard: show-up rate, FAT/SNF consistency, dispute count. (P2-13) | dairyManager |
| POST | `/livestock/appointments/{id}/pay` | Authorize / pay veterinary consultation booking fee into escrow hold. Body: `{ paymentMethod }`. (P0-13) | farmer, seller |
| GET | `/livestock/vets/me/settlements` | Vet doctor payout settlement rows, consultation fees earned, and platform deductions. (P1-28) | vet |
| POST | `/livestock/vets/me/payouts` | Request payout of accumulated veterinary consultation earnings to bank account. (P1-28) | vet |
| GET | `/dairy/dairies/{managerId}` | Public dairy center profile card (capacity, operating chilling units, pickup routes). | all |
| GET | `/dairy/farmers/{farmerId}` | Member-farmer public dairy profile and supply track record. | all |
| GET | `/dairy/farmer/home` | Farmer-facing dairy home dashboard: daily collections, FAT/SNF rates, milk payment dues. | farmer |
| GET | `/dairy/dashboard` | Dairy manager operational dashboard: today's live demands, recent collections, inventory in chilling tanks. | dairyManager |
| GET | `/dairy/farmer/ratings` | Farmer review scores and quality ratings from dairy centers. | farmer |
| GET | `/dairy/batches` · GET `/dairy/batches/{id}` | Bulk milk procurement batch records with aggregated quality grades. | dairyManager |
| GET | `/dairy/demands` · POST `/dairy/demands` | Browse or create bulk milk procurement requirements. | dairyManager, all |
| GET | `/dairy/demands/{id}` | Procurement demand detail view with received bids. | all |
| POST | `/dairy/demands/{id}/close` | Close procurement demand post. | dairyManager |
| POST | `/dairy/demands/{id}/bids` · GET `/dairy/demands/{id}/bids` | Submit bid or view supplier bids on milk procurement requirement. | milkSeller, dairyManager |
| POST | `/dairy/bids/{id}/accept` | Accept supplier bid and create formal procurement purchase agreement. | dairyManager |
| POST | `/dairy/purchases/{id}/advance` | Record advance payment towards bulk milk procurement purchase. | dairyManager |
| POST | `/dairy/purchases/{id}/deliver` | Confirm delivery of milk tanker at dairy processing center. | dairyManager |
| POST | `/dairy/purchases/{id}/qc` | Record dock lab quality assessment (FAT%, SNF%, adulteration screen) and finalize purchase value. | dairyManager |
| GET | `/dairy/ratings` | Public ratings and feedback reviews of registered dairy centers. | all |
| GET | `/dairy/demands/browse` | Public board of open milk procurement demands from dairy centers. | all |
| GET | `/dairy/bids/browse` | Open bids placed on dairy procurement requirements. | dairyManager, milkSeller |
| POST | `/dairy/standing-orders` · GET `/dairy/standing-orders` · PUT `/dairy/standing-orders/{id}` · POST `/dairy/standing-orders/{id}/close` | Create, browse, update, or close recurring milk supply standing orders. | dairyManager |
| GET | `/dairy/standing/browse` | Public feed of standing milk procurement requirements. | all |
| GET | `/dairy/purchases/{purchaseId}/receipt` | Formal milk procurement receipt with quantity, FAT/SNF readings, and gross payout. | all |
| GET | `/dairy/commission-structure` | Platform commission rates and escrow settlement timelines for dairy trade. | dairyManager |
| GET | `/dairy/purchases/{purchaseId}/chat-room` | Dedicated procurement negotiation chat thread unlocked upon order confirmation. | all |
| POST | `/dairy-manager/bids/{bidId}/accept` | Dairy manager one-click acceptance of supplier procurement bid. | dairyManager |

> `MilkCollectionIn` (§`livestock.py` procurement) gained optional `memberId` + `quality`. `AnimalIn` gained optional `gaushalaId` — when the caller manages that gaushala, the animal is registered as its cattle (`ownerType: "gaushala"`, `cattleStatus: "in-shelter"`, intake event recorded; 404 `GAUSHALA_NOT_FOUND` otherwise); `Animal` responses now carry `gaushalaId`/`cattleStatus`/`events`. The `dairyManager` persona (8th profile) is the livestock-domain super-manager. The superadmin console for this domain is live — see §28.19 (SOP-19: `/admin/livestock/vets`, `/admin/livestock/vets/{id}/verify`, `/admin/livestock/gaushalas`, `/admin/livestock/orders`).

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
| GET | `/dashboard/home` | Aggregated daily home payload: weather strip, urgent action task, aaj ke bhav vyapari rates, active banners, and persona metrics in a single low-latency call. (P1-1) | all |
| GET | `/post-harvest/receipts/{receipt_number}/certificate` | Verifiable electronic Negotiable Warehouse Receipt (e-NWR) PDF with QR verification code for bank loan collateral. (P1-29) | farmer, bankManager, public |
| GET | `/post-harvest/provider/rent-ledger` | Monthly cold storage chamber rent accruals, dues, and payment statuses (`?month=&status=`). (P2-22) | coldStorageProvider |
| GET | `/post-harvest/provider/fees` | Platform SaaS usage fee ledger (per-booking fee audit). (P2-23) | coldStorageProvider, admin |
| POST | `/post-harvest/provider/fees/{id}/pay` | Pay cold storage platform fees. Body: `{ paymentMethod, reference }`. (P2-23) | coldStorageProvider |
| POST | `/admin/cold-storage/facilities/{id}/verify` | Superadmin WDRA compliance audit and cold chain partner facility verification. (P1-30) | admin |
| GET | `/admin/cold-storage/bookings` | Superadmin reservation audit across all cold storage chambers to prevent overbooking. (P2-24) | admin |
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
| POST | `/land/leases/{id}/esign` | Landlord and tenant MPIN-anchored digital signature of formal lease agreement. Body: `{ signatureData, consentTimestamp, mpin }`. (P0-2) | farmer, farmLandlord |
| POST | `/land/leases/{id}/escrow/fund` | Tenant farmer funds lease security/rent escrow wallet. Body: `{ amountPaise, paymentMethod }`. (P0-3) | farmer |
| POST | `/land/leases/{id}/milestones/{index}/release` | Release lease milestone payment from escrow to landlord minus commission. (P0-3) | farmer, admin |
| GET | `/land/settlements` | Landlord payout dashboard: escrow releases, platform fee breakdown, and bank disbursements. (P1-25) | farmLandlord |
| POST | `/land/leases/{id}/chat-room` | Secure lease-scoped chat channel between landlord and tenant. (P1-26) | farmer, farmLandlord |
| GET | `/land/profit-dashboard` | Landlord profit analytics: rental income by plot, occupancy rate, expense deductions. | farmLandlord |
| GET | `/land/analytics` | Portfolio analytics across all owned land plots and active lease contracts. | farmLandlord |
| GET | `/land/leases/{id}/milestones` · POST `/land/leases/{id}/milestones` | Milestone payment schedule for lease. | farmLandlord, farmer |
| PUT | `/land/leases/{id}/milestones/{index}` | Update milestone state / due date. | farmLandlord, farmer |
| GET | `/land/lease-requests/mine` | Farmer's sent lease applications and negotiation status. | farmer |
| POST | `/land/lease-requests/{request_id}/counter` | Submit structured counter-offer on lease rent/terms (max 5 rounds). | farmer, farmLandlord |
| GET | `/land/leases/{lease_id}/ledger` | Rent ledger export (CSV/PDF) with payment dates, bank refs, and tax TDS. | farmer, farmLandlord |
| GET | `/rent-payments/{payment_id}/receipt` | Downloadable rent payment receipt with landlord digital seal. | farmer, farmLandlord |
| POST | `/land/leases/{lease_id}/disputes` | Open formal land leasing dispute (boundary, non-payment, water rights). | farmer, farmLandlord |
| GET | `/land/summary` | Landlord portfolio summary: total acres, leased acres, annual rental yield. | farmLandlord |
| POST | `/land/listings/{listing_id}/photos` · DELETE `/land/listings/{listing_id}/photos/{photo_id}` | Upload or remove plot demarcation and drone survey photos. | farmLandlord |
| PUT | `/land/listings/{listing_id}/availability` | Toggle listing open/paused availability state. | farmLandlord |
| POST | `/land/listings/{listing_id}/view` | Record prospective tenant listing view event. | farmer |
| GET | `/land/leases/{lease_id}/handover` | Plot handover inspection checklist and initial soil condition report. | farmer, farmLandlord |
| POST | `/land/plots/{plot_id}/expenses` · GET `/land/plots/{plot_id}/expenses` | Log and track plot maintenance expenses (fencing, bunding, soil preparation). | farmLandlord |
| POST | `/land/leases/{lease_id}/harvest-declarations` · GET `/land/leases/{lease_id}/harvest-declarations` | Tenant farmer declares seasonal crop harvest for crop-share leases. | farmer, farmLandlord |
| POST | `/land/leases/{lease_id}/harvest-declarations/{decl_id}/settle` | Settle crop-share revenue distribution between landlord and tenant. | farmLandlord |
| GET | `/land/profit-dashboard/export` | Export 12-month landlord profit and tax breakdown (CSV format). | farmLandlord |
| POST | `/land/listings/{listing_id}/reviews` · GET `/land/listings/{listing_id}/reviews` | Post and view tenant reviews of leased agricultural land. | farmer, farmLandlord |
| GET | `/land/price-suggestion` | Fair market rent suggestion based on soil type, water source, and village historical leases. | farmer, farmLandlord |
| POST | `/land/listings/{listing_id}/boost` | Featured listing boost (priority ranking in search results). | farmLandlord |
| POST | `/land/listings/{listing_id}/save` · DELETE `/land/listings/{listing_id}/save` · GET `/land/saved-listings` | Bookmark/save land listings and view saved bookmarks. | farmer |
| POST | `/land/listings/{listing_id}/waitlist` · DELETE `/land/listings/{listing_id}/waitlist` · GET `/land/waitlist/mine` | Join or leave tenant waitlist for leased land plots. | farmer |
| GET | `/land/leads` · POST `/land/leads/{lead_id}/status` · POST `/land/leads/{lead_id}/notes` · DELETE `/land/leads/{lead_id}` | Landlord tenant CRM: lead pipeline, contact notes, and status transitions. | farmLandlord |
| GET | `/land/tenancies` | Current active tenancies overview with tenant details and plot allocations. | farmLandlord |
| GET | `/land/rent/dues` | Aggregate unpaid rent and upcoming due dates across all active leases. | farmLandlord |
| POST | `/land/leases/{lease_id}/renew` · GET `/land/leases/{lease_id}/renewals` · POST `/land/lease-renewals/{renewal_id}/respond` | Lease renewal proposals, negotiation, and extension decisions. | farmer, farmLandlord |
| POST | `/land/leases/{lease_id}/terminate` | Early mutual lease termination request with settlement terms. | farmer, farmLandlord |

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
| PUT | `/customer/subscriptions/{id}` | Manage standing order subscription: pause for vacation, resume, modify quantity or delivery day. Body: `{ status: paused|active, qtyKg?, deliveryWindow? }`. (P2-18) | customer, all |

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
| POST | `/purchases/{id}/disputes` | Trade party raises formal dispute on purchase (damages, weight discrepancy, no-show). Freezes escrow. Body: `{ category, reason, requestedAmountPaise? }`. (P0-10) | directBuyer, farmer, seller |
| GET | `/purchases/{id}/disputes` | List disputes filed on a purchase with status and evidence. (P0-10) | directBuyer, farmer, seller |
| POST | `/purchases/{id}/disputes/{dispute_id}/evidence` | Upload photo or weighbridge slip evidence for active dispute. (P0-10) | directBuyer, farmer, seller |
| GET | `/purchases/{id}/invoice.pdf` | Download official GST tax invoice PDF with GSTIN, CGST/SGST/IGST breakdown and digital seal. (P1-21) | directBuyer, farmer, seller |
| POST | `/jobs/demands/standing/run` | Scheduled job: planner generating periodic purchase orders from recurring standing demands. (P1-22) | cron, admin |
| GET | `/direct-buyer/statements` | Monthly procurement and spend statement export (PDF/JSON). `?month=&format=pdf|json`. (P2-15) | directBuyer |
| GET | `/direct-buyer/farmers/{farmer_id}/reliability` | Farmer supplier reliability profile: fulfillment rate, QC grade pass rate, dispute history. (P2-16) | directBuyer |
| GET | `/direct-buyer/farmers/{farmerId}` | Public farmer profile card with address, active crops, and verified supplier badge. | directBuyer |
| GET | `/direct-buyer/buyers/{buyerId}` | Public direct buyer profile card with corporate credentials, monthly demand, and payment reputation. | all |
| GET | `/direct-buyer/farmer/home` | Farmer direct buyer procurement home: matched open demands, active B2B orders. | farmer |
| GET | `/direct-buyer/dashboard` | Buyer home: today's live demands, pending quotes, active deliveries, upcoming fulfillment dates. | directBuyer |
| GET | `/direct-buyer/farmer/ratings` · GET `/direct-buyer/buyer/ratings` | Two-sided trade ratings and counterparty reviews. | directBuyer, farmer |
| POST | `/direct-buyer/standing-orders` · GET `/direct-buyer/standing-orders` | Create or list recurring procurement standing orders (e.g. 5 MT weekly onions). | directBuyer |
| PUT | `/direct-buyer/standing-orders/{id}` · POST `/direct-buyer/standing-orders/{id}/close` | Edit or terminate standing order schedule. | directBuyer |
| GET | `/demands/browse` | Live public feed of all open buyer purchase requirements enriched with buyer credentials. | all |
| GET | `/demands/standing` | Live public feed of open recurring standing demands. | all |
| GET | `/market/lots/{id}/offers` | Farmer lot bid board: all incoming buyer offers ranked by net rate and counterparty rating. | farmer |
| GET | `/purchases/{id}/receipt` | Customer transaction receipt with trade quantity, rate, and platform fee breakdown. | all |
| GET | `/purchases/{id}/chat-room` | Secure in-app negotiation chat thread unlocked upon order confirmation. | all |
| GET | `/direct-buyer/ratings` | Public buyer ratings and corporate trade reviews. | all |
| GET | `/direct-buyer/farmer-posts` | Farmer harvest lot posts matching buyer's procurement criteria. | directBuyer |
| GET | `/direct-buyer/commission-structure` | Platform fee structure and volume discount tiers for bulk B2B trade. | directBuyer |
| POST | `/chat/direct` | Open a 1:1 chat room with trade counterparty resolved from booking, lot, or demand. | all |

**Purchase status map** (mirrors the order lifecycle): `confirmed → advancePaid → pickupScheduled → inTransit → delivered → completed`, with `delivered → qcDisputed → completed` as the dispute branch; `cancelled` is terminal from `confirmed`/`advancePaid`/`pickupScheduled`. Money movement is recorded in the `payments` ledger (advance/balance/full), not as statuses.

---

## 24. Notifications & Women Module Surfaces

> Added 2026-09-27 (`source: extension-2026-09-27`). Mobile "no fake data" rewiring: the notifications endpoints the mobile NotificationsApi already calls now exist for real (backed by the `notifications` collection that `services/notifications.py` writes), the two hardcoded women-mode widgets get real data sources, and `GET /users/me` guarantees the mobile hydration fields even on partial/legacy user docs.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/notifications?page=&pageSize=` | Own notifications (`userId ==` caller) from collection `notifications`, `createdAt` desc, paged envelope `{ data: [{ id, userId, title, body, type, read, createdAt }], page, pageSize, total }`; empty → 200 `{ data: [] }`; `pageSize` default 20. | all |
| PUT | `/notifications/read-all` | Mark all own **unread** notifications read (`read: true` + `readAt`) → `{ updated: n }`. | all |
| POST | `/notifications/{id}/read` | Mark one own notification read → `{ ok: true }`; **404 `NOT_FOUND`** when the doc is missing or belongs to another user. | all |
| POST | `/notifications/read` | Mark batch of notifications read via ID list. Body: `{ ids: string[] }`. | all |
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
| POST | `/broker/deals/{id}/release-payout` | Release deal escrow payout to farmer following 48h delivery inspection window. (P0-5) | broker, admin |
| GET | `/broker/deals/{id}/contract` | Legal e-contract document and digital signature audit log. (P0-6) | broker, farmer |
| POST | `/farmer/deals/{id}/accept` | Farmer e-signs and accepts broker deal terms with MPIN authorization. Body: `{ mpin, signatureData?, consentTimestamp? }`. (P0-6) | farmer |
| POST | `/broker/deals/{id}/milestones` · GET `/broker/deals/{id}/milestones` | Add / track deal delivery milestone events (`departed | arrived | loading | in_transit | weighed | delivered`). (P1-9) | broker, farmer |
| POST | `/broker/deals/{id}/chat-room` | Open dedicated in-app deal chat thread between broker and farmer seller. (P1-10) | broker, farmer |
| POST | `/farmer/deals/{id}/disputes` · GET `/farmer/deals/{id}/disputes` | Farmer raises dispute on deal (payment delay, weighbridge mismatch). Freezes escrow payout. (P1-11) | farmer |
| PUT | `/broker/deals/{id}/vehicle` | Assign transport vehicle details with masked license plate storage (`MH 12 •• 3456`). Body: `{ vehicleType, vehicleNumber, driverName }`. (P1-12) | broker |
| GET | `/broker/deals/{id}/receipt` | Downloadable GST transaction receipt PDF for farmer and broker records. (P2-8) | broker, farmer |

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

## 27. Mahila Gruh Udyog (Women's Home Enterprise → Krishi Shopping Mall)

> Added 2026-10-14. The mahila registers her home enterprise ("unit"), adds homemade products (papad, pickles, masala, sweets, handicrafts, textiles…), and **publishes them straight into the Krishi Shopping Mall catalog** — a live listing is a `products` doc carrying `source: "gruh_udyog"`, `unitId`, `gruhProductId`, so it appears in `GET /products` / cart / orders like any mall item. Module collections: `gruh_udyog_units` (one per owner), `gruh_udyog_products` (`draft|live|paused`), `gruh_udyog_batches` (production batches, optional stock add), `gruh_udyog_certifications` (`fssai|udyam|shg|handicraft_mark|pan`), `gruh_udyog_offers` (time-boxed discounts applied to the live mall price). Prices are integer rupees (mall convention); dashboard revenue is paisa. **Gates:** food categories require a *verified, unexpired FSSAI* cert to publish (403 `FSSAI_REQUIRED`); publishing needs stock > 0 (422 `STOCK_REQUIRED`) and an `active` unit (403 `UNIT_PAUSED`); unpublishing is blocked by open orders (409 `OPEN_ORDERS_EXIST`). All writes accept `Idempotency-Key`. All routes require auth; every mutation is owner-only (403 `FORBIDDEN` otherwise).

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/gruh-udyog/categories` | Category catalog with food flags: `{ data: [{ category, isFood, requiresFssai }] }` — Papad & Fryums, Pickles & Chutneys, Spices & Masala, Dairy & Sweets, Grains & Flours (food, FSSAI-gated) + Handicrafts, Textiles & Apparel, Bamboo & Cane, Candles & Diyas, Herbal & Cosmetics, Other. | all |
| POST | `/gruh-udyog/units` | Register a unit (one per user; 409 `UNIT_ALREADY_EXISTS`). Body `{ name, category, vernacularName?, description?, village?, district?, state?, shgName?, establishedYear?, capacityPerWeek?, imageUrl? }` → 201 `gu_` doc `status: active`. | all |
| GET | `/gruh-udyog/units/me` | My unit; 404 `UNIT_NOT_FOUND` when not registered. | all |
| GET | `/gruh-udyog/units/{id}` | Public brand card: `{ unit, productsCount, liveProductsCount, certifications }` — others see only verified certs, owner sees all. | all |
| PUT | `/gruh-udyog/units/{id}` | Partial update of unit profile fields (owner only). | all |
| POST | `/gruh-udyog/units/{id}/pause` · `/resume` | Pause blocks new products/publishes (403 `UNIT_PAUSED`); resume re-enables. Existing listings stay up. | all |
| POST | `/gruh-udyog/units/{id}/products` | Add a homemade product (draft). Body `{ title, vernacularTitle?, category (whitelist, 422), description?, ingredients?, mrp>0, price>0 (≤ mrp), stock≥0, unit?, imageUrls[], tags[], shelfLifeDays?, isVeg? }` → 201 `gup_` doc `status: draft`. | all |
| GET | `/gruh-udyog/units/{id}/products` | Owner → all statuses; anyone else → live only. `{ data, total }`, newest first. | all |
| GET | `/gruh-udyog/products/{id}` | Product detail `{ product, batches (owner only), activeOffer }`. | all |
| PUT | `/gruh-udyog/products/{id}` | Partial update; `price > mrp` → 422; live listings re-sync to the mall doc. | all |
| PUT | `/gruh-udyog/products/{id}/stock` | Absolute stock set `{ stock ≥ 0 }`; syncs to the mall listing when live. | all |
| POST | `/gruh-udyog/products/{id}/publish` | Draft → Krishi Shopping Mall: creates the `products` catalog doc (`source: "gruh_udyog"`, seller = owner) and flips status `live`. Idempotent. 409 `ALREADY_LIVE`. | all |
| POST | `/gruh-udyog/products/{id}/unpublish` | Remove from the mall (→ draft); 409 `OPEN_ORDERS_EXIST` while placed/paid orders or in-flight fulfilment reference it. | all |
| DELETE | `/gruh-udyog/products/{id}` | Delete a non-live product (409 `PRODUCT_LIVE` otherwise); its offers are removed too. | all |
| POST | `/gruh-udyog/products/{id}/batches` | Record a production batch `{ batchNo?, quantity>0, productionDate, expiryDate? (≥ productionDate, else 422), addToStock? }` → 201 `gub_`; `addToStock: true` increments product stock (+ mall sync). | all |
| POST | `/gruh-udyog/batches/{id}/status` | Close an active batch `{ status: sold_out\|expired }`; 409 `BATCH_CLOSED` when already closed. | all |
| POST | `/gruh-udyog/units/{id}/certifications` | Register a certification `{ type: fssai\|udyam\|shg\|handicraft_mark\|pan, number, issuingAuthority?, validUntil?, documentUrl? }` → 201 `guc_`, `status: pending`; duplicate type+number → 409. | all |
| GET | `/gruh-udyog/units/{id}/certifications` | Owner → all certs; others → verified only. | all |
| POST | `/gruh-udyog/products/{id}/offers` | Time-boxed discount `{ title, discountPercent 1–90, validFrom, validUntil }` → 201 `guo_` with computed `offerPrice`; a live mall listing is repriced immediately. | all |
| GET | `/gruh-udyog/units/{id}/offers` | All offers across the unit's products, newest first. | all |
| DELETE | `/gruh-udyog/offers/{id}` | Remove an offer; the live mall price falls back to the product price. | all |
| GET | `/gruh-udyog/units/{id}/orders?status=` | Mall orders containing her products (join on `orders.items.productId` ↔ live mall ids) with per-unit `fulfillment` state. | all |
| POST | `/gruh-udyog/orders/{id}/accept` | Accept an open order for her unit; snapshots `itemsTotal` (price-lock revenue) → `fulfillment.status: accepted`. 404 when the order has none of her products. | all |
| POST | `/gruh-udyog/orders/{id}/reject` | Reject with `{ reason }` while still open; after acceptance only possible before fulfilment starts. | all |
| POST | `/gruh-udyog/orders/{id}/status` | Fulfilment transition `{ status: packed\|shipped\|delivered }` — strict chain `accepted → packed → shipped → delivered` (409 `BAD_TRANSITION` on skips). | all |
| GET | `/gruh-udyog/units/{id}/dashboard` | `{ products, liveProducts, draftProducts, lowStock[] (≤5 units), orders, orderStates, revenuePaisa (delivered itemsTotal × 100), expiringBatches (≤30d) }`. | all |

---

## 28. Superadmin Console API (SOP 01–27)

> Added 2026-10-17. The complete superadmin console specified in `docs/superadmin-instructions/` SOP-01…SOP-27 — the 111 endpoint paths below (plus `POST /threads` in §28.28), all mounted under `/v1`. SOP modules live in the `admin_sop_*` routers; paths that predate the SOP build are served verbatim from the phase-07 console routers (`admin.py`, `admin_console.py`) and are marked "(console path)" — both families share the same Firestore collections, so doc paths and console paths behave identically. SOP-router paths that duplicate a legacy path under a different route are marked "(alias of …)".
> - **Auth:** `Authorization: Bearer <token>` — either a Firebase ID token bearing the `admin: true` claim or a backend access JWT whose user carries an `adminRole` tier: `superadmin`, `compliance_officer`, `finance_admin`, `agronomist`/`scientist` (aliases), `operations_lead`, `content_moderator`. `superadmin` always passes; endpoints that restrict to specific tiers list them in the Roles column, everything else accepts any admin (Roles: `admin`). Optional `X-Admin-Role` header must match the server-resolved role (else 403 `FORBIDDEN_ADMIN_ROLE`).
> - **Audit:** every mutating endpoint (POST/PUT/DELETE) REQUIRES the `X-Audit-Reason` header (min 3 chars; missing/short → 422) and writes an immutable `audit_logs` doc: `adminId`, `timestamp`, `ipAddress`, `previousState`, `newState`, `reason`.
> - **Maker-checker:** high-value money movements return `{requiresApproval: true}` and create a pending `admin_approvals` doc that a *different* admin must approve (`GET /admin/approvals`, `POST /admin/approvals/{id}/approve`, `POST /admin/approvals/{id}/reject`) — insurance claim payouts > ₹50,000 (`PAYOUT_DUAL_SIGNOFF_PAISE`), other money movements > ₹10,000 (order refunds, penny-drop overrides, coin adjustments, `MAKER_CHECKER_THRESHOLD_PAISE`); `PUT /admin/insurance/rates` and `PUT /admin/chatbot/prompt-config` always require a second admin.
> - **Reads & errors:** list endpoints return the standard paged envelope `{ data, page, pageSize, total }`; errors use the standard `{error:{code,message,fieldErrors}}` shape with 401 (`INVALID_TOKEN`/`ADMIN_REQUIRED`), 403 (`FORBIDDEN_ADMIN_ROLE`), 404, 409, 422.

### 28.1 Auth & Sessions (SOP-01)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/auth/users` | List user auth credentials and login history — `auth_tokens` + `sessions` rows with last-login IP and revoked flag, paged. (console path) | superadmin, compliance_officer |
| POST | `/admin/auth/users/{uid}/reset-mpin` | Admin force MPIN reset — issues a 6-digit `mpinResetOtp` on the user doc. (console path) | superadmin, compliance_officer |
| POST | `/admin/auth/users/{uid}/revoke-sessions` | Revoke all refresh tokens and sessions for a user. (console path) | superadmin, compliance_officer |
| PUT | `/admin/auth/users/{uid}/status` | Update account status (`active`/`suspended`/`locked`/`banned`; 409 `STATUS_ALREADY_SET`). (alias of `POST /admin/users/{uid}/status`) | admin |
| PUT | `/admin/auth/security-policy` | Configure global auth security flags: 2FA/MPIN mandatory thresholds, session timeout. (P1-37) | superadmin |

### 28.2 User Management & Personas (SOP-02)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/users` | Search & paginate all users with persona/status/search filters. (console path) | admin |
| GET | `/admin/users/{uid}` | Full profile details + linked personas + role-profile subcollection docs. | admin |
| PUT | `/admin/users/{uid}/status` | Set user account status (same writer as §28.1; alias of `POST /admin/users/{uid}/status`). | admin |
| PUT | `/admin/users/{uid}/personas` | Manage linked personas — add/remove + role-profile upserts; ≥1 persona must remain (409 `LAST_PROFILE`, 409 `PROFILE_ALREADY_LINKED`). | admin |
| GET | `/admin/users/{uid}/farm-map` | Farm boundary polygon coordinates + land plots + imported land records. | admin |
| GET | `/admin/users/export` | Export full user roster with persona breakdowns for government compliance audits (CSV/Excel). (P2-25) | superadmin |

### 28.3 KYC Verification & Vault (SOP-03)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/kyc/pending` | List pending KYC verification items with AI extraction + risk reasons attached. (console path) | superadmin, compliance_officer |
| POST | `/admin/kyc/{id}/verify` | Approve KYC document and issue badge. (console path) | superadmin, compliance_officer |
| POST | `/admin/kyc/{id}/reject` | Reject KYC with a specific reason (min 3 chars). (console path) | superadmin, compliance_officer |
| GET | `/admin/kyc/history` | Audit trail of all KYC decisions (verified/rejected docs). (console path) | superadmin, compliance_officer |

### 28.4 Mandi Rates & Approvals (SOP-04)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/rates/pending` | List pending vyapari rate submissions with the ±15% Agmarknet sanity-band flag. | admin |
| POST | `/admin/rates/{id}/approve` | Approve rate update — goes live on the mobile vyapari feed (`vyapari_rates`, cache invalidated). | admin |
| POST | `/admin/rates/{id}/reject` | Reject rate update with explanation back to the trader. | admin |
| POST | `/admin/mandi/sync` | Trigger manual Agmarknet/eNAM sync job; records a `cron_job_logs` row either way. | admin |
| POST | `/admin/mandi/rates` | Manual mandi modal rate entry or override for mandis with broken government feeds. Body: `{ mandiId, commodity, modalPrice, arrivals }`. (P1-31) | admin |

### 28.5 Produce Lots & B2B Procurement (SOP-05)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/lots` | Search and inspect all produce lots (`market_lots`). (console path) | admin |
| PUT | `/admin/lots/{id}/status` | Force-update lot status (`active`→`open`/`suspended`/`sold`); a sold lot is terminal (409 `LOT_NOT_EDITABLE`). | admin |
| GET | `/admin/procurements` | Audit trader procurement records and slips — backed by `purchases` booked by trader-role buyers (seller/directBuyer/exporter) with payment + escrow summary. | admin |

### 28.6 Marketplace Catalog & Orders (SOP-06)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/marketplace/products` | List products with category/status/search filters and computed stock status. | admin |
| POST | `/admin/marketplace/products` | Add new product SKU to the catalog (admin-owned seller doc, `ADM-` batch no). | admin |
| PUT | `/admin/marketplace/products/{id}` | Update product pricing and inventory (422 when discounted price > MRP). | admin |
| GET | `/admin/marketplace/orders` | List orders with delivery (`status`) and payment (`paymentStatus` from refund/Razorpay flags) columns. | admin |
| POST | `/admin/marketplace/orders/{id}/refund` | Trigger refund for a cancelled order (Razorpay when paid online, manual otherwise; > ₹10,000 routes via maker-checker). (alias of `POST /admin/orders/{id}/refund`) | admin |
| POST | `/admin/marketplace/products/{id}/certificates` · GET `/admin/marketplace/products/{id}/certificates` | Upload and verify Agmark/Ministry QR authenticity certificates for input products. (P1-36) | admin |

### 28.7 Buyer Contracts & Escrow (SOP-07)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/contracts` | List buyer contracts across all stages with current mandi-linked price, farmer/buyer names and delivery-slot count. | admin |
| POST | `/admin/contracts` | Publish approved institutional contract — an open (untargeted) offer any verified farmer can accept. | admin |
| PUT | `/admin/contracts/{id}/status` | Update contract state — admin cancellation with breach/cancellation reason (409 when already terminal). | admin |
| GET | `/admin/contracts/{id}/acceptances` | List signed farmer agreements — `contracts/{id}/acceptances` e-sign records. | admin |

### 28.8 Transport Fleet & Dispatch (SOP-08)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/transport/vehicles` | List registered fleet with KYC doc status. (console path) | superadmin, operations_lead |
| POST | `/admin/transport/vehicles/{id}/verify` | Approve vehicle commercial papers. (console path) | superadmin, operations_lead |
| GET | `/admin/transport/bookings` | List active and historical bookings with lot snapshot enrichment, newest first. | admin |
| PUT | `/admin/transport/bookings/{id}/status` | Manual intervention in trip status — same `ALLOWED_TRANSITIONS` machine and side effects as the transporter flow (waypoint log, chat unlock on accept, POD + two-way rating prompts on delivery, party notifications; 409 `ILLEGAL_TRANSITION`). | admin |
| GET | `/admin/transport/pricing-rules` · PUT `/admin/transport/pricing-rules` | Global transport pricing engine rules: base fares, per-km slab rates by vehicle class and district, surge bands. (P1-32) | superadmin |

### 28.9 Equipment & Slot Management (SOP-09)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/equipment` | List machinery inventory with owner details. (console path) | superadmin, operations_lead |
| PUT | `/admin/equipment/{id}/verify` | Approve machine for public booking — flips `docStatus: verified` so it appears in the farmer browse surface (409 `ALREADY_VERIFIED`). | admin |
| GET | `/admin/equipment/bookings` | List slot bookings and waitlist entries (`status=waitlist` for waitlist only, `all` for both). | admin |
| DELETE | `/admin/equipment/bookings/{id}` | Admin force cancellation with auto-refund of paid amounts — releases the slot, promotes the waitlist head, notifies farmer + owner (409 when already cancelled). | admin |
| GET | `/admin/equipment/damage-claims` | Machinery damage reports queue and security deposit forfeiture review console. (P1-8) | admin |

### 28.10 Land Leasing & Disputes (SOP-10)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/land/listings` | List land listings for lease with AI-quality audit flags (rent band, completeness). | admin |
| GET | `/admin/land/leases` | List active leases and payment compliance across landlords. (console path) | superadmin, operations_lead, compliance_officer |
| GET | `/admin/land/leases/{id}/agreement` | Inspect the generated lease agreement PDF — lease record + freshly built `agreementUrl`, no Pro-plan gate. | admin |
| PUT | `/admin/land/leases/{id}/terminate` | Arbitrated lease contract termination — plot reverts to `vacant`, marketplace listing reopens, `lease_terminations` record written (409 `LEASE_NOT_ACTIVE`). | admin |

### 28.11 AI Advisory & Soil Tests (SOP-11)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/advisory/scans` | Audit disease scans and confidence metrics (`disease_scans`; < 0.7 flagged low-confidence) + summary metrics block. | admin |
| POST | `/admin/advisory/pest-alerts` | Broadcast geofenced pest outbreak alert (`pest_alerts`). (console path) | superadmin, agronomist, scientist |
| GET | `/admin/soil-tests` | List pending soil sample tests across users (`status=pending\|all\|booked\|sampleCollected\|reportReady`). | admin |
| POST | `/admin/soil-tests/{id}/results` | Upload lab result PDF + NPK/pH values and notify the farmer — sets `reportReady`. | admin |

### 28.12 Chatbot Transcripts & Expert Handoff (SOP-12)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/chatbot/transcripts` | Search & inspect Kisan Mitra chat transcripts — `q`/`language`/`hasHandoff` filters, message counts, last-message-at. | admin |
| GET | `/admin/chatbot/handoffs` | Queue of escalated expert handoff tickets with 24-h SLA due/breached flags. | admin |
| POST | `/admin/chatbot/handoffs/{id}/assign` | Assign agronomist to a support thread (queued/assigned only, 409 `TICKET_NOT_ASSIGNABLE`); FCM to the farmer. | admin |
| PUT | `/admin/chatbot/prompt-config` | Update LLM system prompt and parameters (`platform_config/chatbot`) — always requires a second admin. (console path) | superadmin, content_moderator |
| GET | `/admin/chatbot/satisfaction` | Chatbot conversation satisfaction ratings, CSAT analytics, and expert handoff metrics. (P2-31) | admin |

### 28.13 Farm Diary & P&L Oversight (SOP-13)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/diary/summary` | Regional farm expenditure statistics aggregated from `users/{uid}/diary_entries`, grouped by district and diary category. | admin |
| GET | `/admin/pnl/benchmarks` | State-level crop production-cost benchmarks (`platform_config/pnl_benchmarks`; empty until first PUT). | admin |
| PUT | `/admin/pnl/benchmarks/{crop}` | Update (merge) standard input cost baselines for one crop. | admin |

### 28.14 Banking, Credit & Loan Underwriting (SOP-14)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/finance/accounts` | List registered bank accounts and verification status — masked `XXXX`+last4 only, never full numbers. | superadmin, finance_admin, compliance_officer |
| POST | `/admin/finance/accounts/{id}/override-verify` | Manual penny-drop approval (maker-checker when amount > ₹10,000). (alias of `POST /admin/finance/bank-accounts/{id}/override-verify`) | superadmin, finance_admin |
| GET | `/admin/finance/loans` | Loan application underwriting queue over `loan_applications`. (console path — see §11c) | admin |
| PUT | `/admin/finance/loans/{id}/status` | Update loan application approval status along the `LOAN_TRANSITIONS` machine. (console path — see §11c) | admin |

### 28.15 Insurance Claims & DBT Disbursal (SOP-15)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/claims` | List claims by status across all farmers (top-level `insurance_claims` desk). (alias of `GET /admin/insurance/claims`) | superadmin, finance_admin, compliance_officer |
| PUT | `/admin/claims/{userId}/{claimId}` | Advance claim state along `CLAIM_TRANSITIONS`, optionally set payout amount + DBT txn ID — payouts > ₹50,000 route via maker-checker (409 `CLAIM_INVALID_TRANSITION`). | superadmin, finance_admin |
| POST | `/admin/claims/{id}/assign-surveyor` | Assign field surveyor to claim (`intimated` → `surveyorAssigned`); stamps surveyor details and notifies the farmer. | superadmin, finance_admin |
| PUT | `/admin/insurance/rates` | Update actuarial and farmer premium rates — closes the open row for the product and always requires a second admin. (alias of `POST /admin/insurance/rates`) | superadmin, finance_admin |

### 28.16 Land Records Registry (SOP-16)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/land-records/status` | Revenue-portal gateway health and latency (`gateway_health` probe rows). (alias of `GET /admin/land-records/health`) | superadmin, operations_lead, agronomist |
| POST | `/admin/land-records/seed` | Seed verified village 7/12 records into the `land_records_712` cache. | superadmin, operations_lead |
| GET | `/admin/land-records/audit-log` | Audit trail of user 7/12 imports (from `users/{uid}.landRecords`). | superadmin, operations_lead, agronomist |
| GET | `/admin/land-records/audit-log/export` | Export land ownership 7/12 verification logs for state revenue department reporting. (P2-26) | superadmin |

### 28.17 Water Resources & Irrigation (SOP-17)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| PUT | `/admin/water/canal-schedule` | Update canal rotation timetable for a canal division (upsert into `canal_schedules`). | superadmin, operations_lead |
| POST | `/admin/water/groundwater-readings` | Batch ingest CGWB station water-table readings (`cgwb_stations`, one latest doc per station). | superadmin, operations_lead |
| PUT | `/admin/water/subsidy-rules` | Update PMKSY subsidy parameters (`platform_config/pmksy` admin-owned override store). | superadmin, operations_lead |
| GET | `/admin/water/usage-stats` | Cluster-wide agricultural water usage and irrigation efficiency reporting. (P2-28) | superadmin |

### 28.18 FPO Verification & Pool Management (SOP-18)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/fpo` | List registered FPOs with computed membership and pool counts. | admin |
| POST | `/admin/fpo/verify/{id}` | Approve FPO credential verification — sets `status` + farmer-facing `verification_status`. (alias of `POST /admin/fpos/{id}/verify`) | admin |
| POST | `/admin/fpo/pools` | Create platform-sponsored group-buy pool (`fpo_pools`). | admin |
| PUT | `/admin/fpo/pools/{id}/status` | Close pool / change status (`open`/`closed`/`cancelled`) — closing generates a supplier purchase-order ref. | admin |
| GET | `/admin/fpo/{id}/financials` | FPO financial oversight: annual turnover, patronage dividends, collective maintenance funds. (P2-29) | superadmin |

### 28.19 Livestock, Vet & Dairy Network (SOP-19)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/livestock/vets` | List vet doctors with credential verification status and claimed flag. | admin |
| POST | `/admin/livestock/vets/{id}/verify` | Verify vet credentials/license — sets the WS-06 `credentialStatus` the vet workspace gates on. (alias of `POST /admin/vets/{id}/verify`) | admin |
| GET | `/admin/livestock/gaushalas` | List Gaushalas with computed offerings and panchagavya products joined. | admin |
| GET | `/admin/livestock/orders` | Audit dairy + manure orders across the network, each row tagged `source: milk_sale\|manure\|dairy_product`. | admin |
| POST | `/admin/nurseries/{id}/verify` | Approve registered plant nursery for certified government sapling distribution. (P1-35) | superadmin |
| GET | `/admin/livestock/dairy/rate-charts` | Oversight of FAT/SNF rate charts and 80G tax receipt issuance across milk hubs. (P2-34) | superadmin |

### 28.20 Content CMS, Live Channels & Workshops (SOP-20)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/content/{collection}` | List and paginate CMS content items — whitelist maps doc names to live collections (`agri_news`→`news`, `agri_channels`→`channels`, `video_guides`→`videos`, `blog_articles`→`blogs`, …); unknown names → 404. | admin |
| POST | `/admin/content/{collection}` | Create news, blog, workshop, talk, or video item. | admin |
| PUT | `/admin/content/{collection}/{id}` | Update content item details. | admin |
| DELETE | `/admin/content/{collection}/{id}` | Remove content item. | admin |
| GET | `/admin/workshops/{id}/roster` | View workshop enrolled farmers (scanned from per-user `workshop_enrollments`, resolved against user docs). | admin |

### 28.21 Agroforestry & Sapling Requests (SOP-21)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/tree/requests` | List pending sapling requests — collection-group scan over top-level + per-user `sapling_requests`. | admin |
| PUT | `/admin/tree/requests/{id}/status` | Approve, dispatch, or reject a request — `pending→approved\|rejected`, `approved→dispatched\|rejected` (409 `INVALID_STATUS_TRANSITION`; rejection reason required). | admin |
| GET | `/admin/tree/ngos` | Manage partner NGO directory (`ngos`). | admin |
| GET | `/admin/tree/requests/{id}/survival` | Field sapling survival tracking and geotagged verification records. (P2-32) | admin |
| PUT | `/admin/biofuel-trees/{id}` | Update commercial biofuel tree economics, yield factors, and buyback prices. (P2-33) | superadmin |

### 28.22 Gamification Economy & Referrals (SOP-22)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/gamification/ledger` | System-wide AgriCoins transaction log — canonical `gamification_ledger` mint/burn rows merged with admin `agri_coins_ledger` adjustments. | admin |
| POST | `/admin/gamification/rewards` | Add new voucher to the rewards store (`reward_coupons`). | admin |
| GET | `/admin/referrals/audit` | Referral fraud detection report — duplicate invited phones (device farms), top referrers, open fraud holds, coupons. | admin |
| DELETE | `/admin/ratings/{id}` | Remove abusive or defamatory rating (soft delete) and re-curate the provider's public aggregate. | admin |
| GET | `/admin/platform-config/coins` · PUT `/admin/platform-config/coins` | AgriCoins economy configuration: earn rates, daily limits, redemption ceilings, tiers. (P1-34) | superadmin |

### 28.23 Climate Resilience & Cold Storage (SOP-23)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/cold-storage/facilities` | Directory of registered cold chains (`cold_storages`). | admin |
| POST | `/admin/cold-storage/facilities` | Onboard new cold storage partner. (alias of `POST /admin/cold-storages`) | admin |
| GET | `/admin/climate/carbon-audit` | Carbon credit certification and payout desk — `carbon_enrollments` with CO₂e/payout estimates computed from `carbon_factors`, plus summary block. | admin |
| PUT | `/admin/climate/varieties/{id}` | Update certified seed variety specs (`climate_varieties`). | admin |

### 28.24 Women & SHG Programs (SOP-24)

Both 24-* SOP files are served from the real `shg_groups` / `gruh_udyog_*` / `home_enterprises` collections — one subsection for both path families.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/women/shgs/queue` | Pending SHG verification applications (`status` not yet verified/rejected). | admin |
| POST | `/admin/women/shgs/{id}/verify` | Approve SHG registration & grant eligibility (409 `ALREADY_VERIFIED`). | admin |
| POST | `/admin/women/subsidies/disburse` | Credit interest-subvention subsidy to the SHG bank — dual-writes `shg_deposits` + `shg_groups/{id}/deposits` and bumps the group corpus. | admin |
| GET | `/admin/women/enterprise-products` | Curate the home-enterprise storefront — every `gruh_udyog_products` row joined with its unit brand and owner name. | admin |
| GET | `/admin/women/shg` | List registered SHGs and corpus totals, with `totals` block (counts + corpus/loan-fund paisa). | admin |
| POST | `/admin/women/shg/verify` | Approve SHG official registration — body `{shgId}`; same verify writer as the 24a path. | admin |
| GET | `/admin/women/enterprises` | Review home enterprise product lines (`home_enterprises`) with owner names and profit totals. | admin |
| GET | `/admin/women/impact-report` | Socio-economic impact report on women-led micro-enterprises and SHG bank corpus. (P2-30) | superadmin |

### 28.25 Financial Settlements & Automated Jobs (SOP-25)

The two 25-* SOP files are identical; all paths are the phase-07 settlement console (`admin_console.py`), so doc paths and console paths are the same routes.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/settlements` | List settlements with status filters (`pending`/`approved`/`paid`/`all`), newest period first. (console path) | superadmin, finance_admin |
| POST | `/admin/settlements/{id}/mark-paid` | Mark settlement disbursed with payment ref. (console path) | superadmin, finance_admin |
| POST | `/admin/jobs/settlements/run` | Trigger manual settlement batch run (default last ISO week). (console path) | superadmin, finance_admin |
| GET | `/admin/platform-config/commissions` | Read current commission rates (`platform_config/settlements` — transport/equipmentRental/broker %). (console path; read-side companion to the SOP-listed PUT) | superadmin, finance_admin |
| PUT | `/admin/platform-config/commissions` | Update commission rates. (console path) | superadmin, finance_admin |
| POST | `/admin/disputes/{id}/settlement` | Admin dispute resolution ruling with automated money movement: split payout, refunds, penalties. (P0-15) | superadmin |
| POST | `/admin/settlements/holds` | Place suspicious transaction or pending settlement on legal administrative hold. Body: `{ lineId, reason }`. (P1-38) | superadmin |
| GET | `/admin/platform-config/penalties` · PUT `/admin/platform-config/penalties` | Penalty matrix configuration and SLA forfeiture rules. (P1-33) | superadmin |
| GET | `/admin/reports/financial` | Comprehensive financial reporting: GST invoices, TDS deductions, platform commission ledger. (P2-27) | superadmin |

### 28.26 System Config, Broadcasts & Moderation (SOP-26)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/app-config` | Fetch current app version gates and feature flags (`app_config/current`). (console path) | superadmin, operations_lead |
| PUT | `/admin/app-config` | Update minSupportedVersion and feature flags. (console path) | superadmin, operations_lead |
| POST | `/admin/broadcast` | Send targeted FCM push to user segments (persona/state/district filters); persists a `broadcasts` doc with recipient/sent counts. (alias of `POST /admin/broadcasts`) | superadmin, operations_lead |
| GET | `/admin/reports` | List reported users and content for moderation (`user_reports` queue, status/module filters). | admin |
| POST | `/admin/reports/{id}/resolve` | Resolve report with `warning`/`ban`/`dismiss` — `ban` suspends the reported user account (409 `REPORT_ALREADY_RESOLVED`). | admin |
| GET | `/admin/analytics/summary` | Global platform KPI dashboard summary — users/personas, marketplace + e-market GMV, active leases, pending KYC/claims/settlements, transport bookings, open reports; no hardcoded constants. | admin |
| GET | `/admin/notification-templates` · PUT `/admin/notification-templates` | Notification template CMS: edit push/SMS message copy and language localization. (P2-35) | superadmin |

### 28.27 Instructor Courses (SOP-27)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/courses/queue` | Course review queue, newest first (`status=pendingReview\|published\|rejected\|all`). (console path) | admin |
| POST | `/admin/courses/{id}/review` | Publish or reject a course — `reason` required on reject (422); writes `audit_logs` and notifies. (console path) | superadmin, compliance_officer |
| POST | `/admin/courses/{id}/feature` | Feature/unfeature a published course (409 `NOT_PUBLISHED` otherwise). (console path) | superadmin, compliance_officer |
| GET | `/admin/courses/report` | Aggregates: counts by status, total sales, free claims, GMV, platform commission, instructor earnings. (console path) | admin |

### 28.28 Chat Threads (system)

From `features/farm_e-market_customer.md` §D.1 — chat threads are created server-side only; clients cannot create them. Not under `/admin` — mounted at `/v1/threads`, admin/system-only, same `X-Audit-Reason` + audit contract.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/threads` | Create the order-bound chat thread — resolves farmer + buyer from `customer_orders` (e-market) or `orders` (retail), writes `chat_rooms/{orderId}`, notifies both parties. 404 `ORDER_NOT_FOUND` when the order/participants are missing; 409 `THREAD_EXISTS` when a thread already exists for the order; 409 `THREAD_NOT_CONFIRMED` while an e-market order is still `created`/`cancelled`. | admin |

**Known gaps & notes**

- **None.** Every path listed in the SOP §5 tables (SOP-01…SOP-27) is implemented — all 111 are documented above (112 rows: §28.25 also lists the read-side `GET /admin/platform-config/commissions` companion to the SOP-listed PUT); nothing had to be omitted.
- Doc-vs-code collection naming (same behaviour, real backing collections): SOP-05 `procurements` → `purchases`; SOP-11 `advisory_scans` → `disease_scans`; SOP-16 import audit reads `users/{uid}.landRecords` (the doc's `imported_records` subcollection has no writer); both SOP-24 families read `shg_groups` (the 24a `women_shgs` collection has no writer); SOP-13 aggregates `users/{uid}/diary_entries`.
- Maker-checker thresholds differ by module: claim payouts > ₹50,000 (`PAYOUT_DUAL_SIGNOFF_PAISE`, SOP-15) vs the platform-wide > ₹10,000 (`MAKER_CHECKER_THRESHOLD_PAISE`) used by order refunds, penny-drop overrides and coin adjustments.

---

## 29. Courses & Instructor Hub (Krishi Gurukul)

> Training, agronomy masterclasses, and vocational farming workshops. Instructors create courses (`courses`), manage student enquiry funnels (`course_enquiries`), schedule batch sessions (`teacher_batches`), assign homework (`course_assignments`), issue verified certificates, and receive weekly automated settlements. Farmers enroll, access syllabus and video lessons, submit field photos for homework grading, join doubt-solving chat rooms, and cancel or dispute bookings with policy-governed escrow refunds.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/courses` | Search / browse course catalog. Filter by `?category=`, `?language=`, `?mode=online|on-farm|centre-based|hybrid`, `?page=`. | all |
| POST | `/courses` | Instructor creates course draft. Body: `{ title, vernacularTitle?, category, description?, priceRupees, mode, location?, syllabus[], requirements[] }`. | instructor, teacher |
| GET | `/courses/{id}` | Course detail view: syllabus, schedule, instructor bio, ratings. | all |
| GET | `/courses/{id}/curriculum` | Full public lesson-by-lesson curriculum with video durations. | all |
| GET | `/courses/{id}/progress` | Enrolled farmer's per-course completion status `{ completedLessons[], progressPercent, certificateEligible }`. | farmer, student |
| POST | `/courses/{id}/chat` | 1:1 doubt-solving chat with the course instructor. | farmer, instructor |
| GET | `/courses/{id}/reviews` · POST `/courses/{id}/reviews` | Student ratings and testimonials for course. | all |
| POST | `/courses/{id}/enroll` | Book course seat with gateway payment / AgriCoins voucher. | farmer, student |
| GET | `/courses/purchases/{id}/contract` | E-contract of confirmed course booking (schedule, location, refund policy). | farmer, instructor |
| POST | `/courses/purchases/{id}/cancel` | Policy-bound booking cancellation & tiered refund (≥48h: 100%, 24-48h: 50%, <24h: 0%). (P0-9) | farmer, instructor |
| POST | `/courses/purchases/{id}/disputes` | Student raises formal dispute on course booking (freeze instructor payout). Body: `{ category, reason, evidenceUrls[] }`. (P0-11) | farmer, student |
| POST | `/courses/{id}/enquiries` | Farmer submits structured enquiry intake for custom workshop/training. Body: `{ questionTemplate, details }`. (P1-15) | farmer |
| POST | `/teachers/enquiries/{id}/counter` | Instructor offers customized quote / fee counter with TTL expiry. Body: `{ quotedFeeRupees, note, ttlHours }`. (P1-16) | instructor |
| POST | `/teachers/enquiries/{id}/accept` | Farmer accepts negotiated training enquiry counter-offer before TTL expires. (P1-16) | farmer |
| POST | `/teachers/batches/{id}/sessions` | Schedule training session date/time for course batch. Body: `{ title, sessionDate, startTime, endTime, venueOrLink }`. (P1-17) | instructor |
| POST | `/sessions/{id}/check-in` | Farmer QR self check-in / attendance confirmation for training session. Body: `{ qrCodeToken }`. (P1-17) | farmer, student |
| POST | `/courses/{id}/assignments` | Instructor posts field assignment / task. Body: `{ title, instructions, maxScore?, deadline }`. (P1-18) | instructor |
| POST | `/assignments/{id}/submissions` | Farmer submits assignment with field photos (1–3 images). Body: `{ photos[], notes? }`. (P1-18) | farmer, student |
| PUT | `/teachers/availability` | Instructor sets working availability, blackout calendar, and 1-on-1 advisory slots. Body: `{ blackoutDates[], oneOnOneSlots[] }`. (P1-19) | instructor |
| POST | `/teachers/certificates/{id}/revoke` | Revoke issued course completion certificate with reason code. (P1-20) | instructor, admin |
| GET | `/instructor/settlements` | Instructor periodic payout ledger with gross course fees, platform deductions, and UTR transfer refs. (P2-14) | instructor |
| GET | `/teachers/{id}/card` | Public instructor credential card (verified credentials, students taught, rating). | all |
| POST | `/teachers/me/credentials` | Upload teaching qualification certificates and domain experience letters. | instructor |
| GET | `/teachers/home` | Instructor dashboard: active batches, enrolled students, pending assignments to grade. | instructor |
| GET | `/teachers/payments/history` | Per-booking payment transactions ledger from course purchases. | instructor |
| GET | `/teachers/commission-structure` | Transparent view of platform commission tiers and payout schedules. | instructor |
| GET | `/teachers/feedback` | All student reviews and feedback received across all instructor courses. | instructor |
| GET | `/teachers/students/{studentId}` | Enrolled student profile, course progress, submitted assignments, and certification history. | instructor |
| POST | `/teachers/chat/open` | Open dedicated 1:1 mentorship and doubt-solving window with enrolled student. | instructor |
| GET | `/teachers/chat/rooms` | List all active student mentorship chat rooms with unread message counts. | instructor |
| GET | `/teachers/certificates/{certificateId}/download` | Download GyanSetu / Agrovercity co-branded course certificate with SHA-256 tamper-evident hash. | public |
| GET | `/teachers/earnings` | Instructor gross/net earnings ledger itemized by course and scheduled payout dates. | instructor |
| GET | `/teachers/certificates/verify/{certificateId}` | Public certificate verification endpoint for employers and third parties. | public |

---

## 30. Dudh Dairy & Milk Seller (Household Milk Subscription & Daily Notebook)

> Digital diary ("खाता") and subscription management for local milk producers and micro-dairies delivering daily to retail households and tea stalls. Eliminates paper notebooks with deterministic daily marking (`mdlv_{clientId}_{date}`), automated month-end billing, missed-delivery tracking, and customer balance ledgers.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/milk-seller/clients` | Add household milk subscriber. Body: `{ name, phone, address, defaultQuantityLiters, ratePerLiter, deliverySlot: morning|evening, milkType: cow|buffalo|mix }`. | milkSeller |
| GET | `/milk-seller/clients` | List milk clients with outstanding balance and status filter (`?status=active|archived|all`). | milkSeller |
| GET | `/milk-seller/clients/{id}` | Client detail: contract terms, recent 10 deliveries, monthly billing summary. | milkSeller |
| PUT | `/milk-seller/clients/{id}` | Update client terms (rates, quantity, slot, address, active/archived status). | milkSeller |
| DELETE | `/milk-seller/clients/{id}` | Archive client (preserves historical deliveries and billing statements). | milkSeller |
| GET | `/milk-seller/clients/{id}/calendar` | Monthly punch-card calendar view (`?month=YYYY-MM`): delivered/missed/holiday days, daily liters, and running total. | milkSeller |
| POST | `/milk-seller/deliveries` | Record single delivery entry. Body: `{ clientId, date, status: delivered|missed|holiday, quantityLiters?, ratePerLiter?, note? }`. Deterministic update if re-posted. | milkSeller |
| POST | `/milk-seller/deliveries/bulk` | Mark daily deliveries for entire route in one single batch. Body: `{ date, entries: [{ clientId, status, quantityLiters? }], markUnlistedMissed?: bool }`. (Supports `Idempotency-Key`) | milkSeller |
| GET | `/milk-seller/deliveries` | Search delivery ledger entries by client, date range, and status. | milkSeller |
| GET | `/milk-seller/deliveries/{id}` | Single delivery entry detail. | milkSeller |
| PUT | `/milk-seller/deliveries/{id}` | Correct delivery entry (quantity, rate, status) while preserving audit history. | milkSeller |
| DELETE | `/milk-seller/deliveries/{id}` | Remove errant delivery entry. | milkSeller |
| POST | `/milk-seller/bills/generate` | Auto-generate monthly invoice from verified delivery ledger. Body: `{ clientId, month: "YYYY-MM", adjustmentsRupees?: 0 }`. | milkSeller |
| GET | `/milk-seller/bills` | List generated bills across clients (`?month=&clientId=&status=draft|sent|partial|paid`). | milkSeller |
| GET | `/milk-seller/bills/{id}` | Full monthly statement itemized by date, missed days, payments received, and prior dues. | milkSeller |
| POST | `/milk-seller/bills/{id}/send` | Send digital bill to client via SMS / WhatsApp notification. | milkSeller |
| POST | `/milk-seller/bills/{id}/payments` | Record customer cash/UPI payment. Body: `{ amount, method: cash|upi|bank, paidAt? }`. Auto-updates bill status to `partial` or `paid`. | milkSeller |
| GET | `/milk-seller/analytics` | Business intelligence: monthly liters produced, revenue collected, collection rate %, client churn. | milkSeller |

---

## 31. Exporter Persona — Global Agri Trade Desk

> End-to-end B2B export workflow for international agri-commodity exporters, trading houses, and overseas buyers. Manages global RFQs (`exporter_rfqs`), export seller quotes (`exporter_quotes`), export contracts (`exporter_orders`), APEDA / FSSAI / phytosanitary compliance documents, customs clearance, and container shipping milestones.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/exporter/profile` · PUT `/exporter/profile` | Exporter enterprise profile: IEC code, APEDA registration, GSTIN, export port, target countries. | exporter |
| GET | `/exporter/dashboard` | Trade desk dashboard: active RFQs, quotes awaiting acceptance, open shipments, customs holds. | exporter |
| POST | `/exporter/rfqs` | Create export Request For Quotation. Body: `{ crop, variety, quantityMT, targetPriceUSD?, packaging, destinationPort, incoterms: FOB|CIF|CFR, deliveryDeadline }`. | exporter |
| GET | `/exporter/rfqs` | Exporter's own RFQs with quote counts and fulfillment progress. | exporter |
| GET | `/exporter/rfqs/browse` | Public board for verified sellers/FPOs to browse open export purchase requirements. | seller, exporter, fpo |
| GET | `/exporter/rfqs/{id}` | Detailed RFQ specification sheet and received supplier quotes. | exporter, seller |
| PUT | `/exporter/rfqs/{id}` · DELETE `/exporter/rfqs/{id}` | Update or close open RFQ. | exporter |
| POST | `/exporter/quotes` | Supplier / FPO submits quotation against export RFQ. Body: `{ rfqId, ratePerMT, availableQuantityMT, validityDays, incotermsOffered }`. | seller, fpo |
| GET | `/exporter/quotes` | Quotes received on own RFQs or submitted quotes. | exporter, seller |
| GET | `/exporter/quotes/{id}` | Quote details and negotiation history. | exporter, seller |
| POST | `/exporter/quotes/{id}/accept` | Accept quote: auto-creates binding Export Contract Order (`exporter_orders`) and opens escrow. | exporter |
| POST | `/exporter/quotes/{id}/reject` | Reject quote with reason. | exporter |
| POST | `/exporter/quotes/{id}/counter` | Single-round counter-offer on export quote rate. | exporter |
| GET | `/exporter/orders` | Export contracts and container shipment tracker across lifecycle stages. | exporter, seller |
| GET | `/exporter/orders/{id}` | Complete export order file: packing list, Bill of Lading, phytosanitary certs, container status. | exporter, seller |
| POST | `/exporter/orders/{id}/advance` | Record Letter of Credit (LC) / bank advance payment. | exporter |
| POST | `/exporter/orders/{id}/inspection` | Third-party quality inspection report upload (SGS/Bureau Veritas). | exporter, seller |
| POST | `/exporter/orders/{id}/shipping` | Record ocean shipping dispatch: vessel name, container number, BL number, port of departure. | exporter, seller |
| POST | `/exporter/orders/{id}/customs` | Record export customs clearance status and shipping bill number. | exporter |
| POST | `/exporter/orders/{id}/deliver` | Confirm port of destination arrival and container discharge. | exporter |
| POST | `/exporter/orders/{id}/complete` | Release export escrow payout following final destination acceptance. | exporter |
| GET | `/exporter/orders/{id}/invoice` | Export commercial invoice and packing list (PDF/JSON). | exporter, seller |
| GET | `/exporter/contracts/templates` | Standard international trade contract templates (GAFTA, FOSFA, Agrovercity Standard). | exporter |
| GET | `/exporter/compliance/documents` · POST `/exporter/compliance/documents` | Upload and verify statutory export certificates (APEDA, FSSAI, Phytosanitary, Certificate of Origin). | exporter |
| GET | `/exporter/analytics` | Export volume by commodity, top destination ports, FX realizations, container transit times. | exporter |
| POST | `/exporter/rfqs/{id}/close` · POST `/exporter/rfqs/{id}/reopen` | Close or reopen an international export RFQ. | exporter |
| POST | `/exporter/rfqs/{id}/quotes` · GET `/exporter/rfqs/{id}/quotes` | Submit or review seller quotes with rate, grade, and delivery window. | seller, exporter |
| GET | `/exporter/quotes/mine` | Seller's submitted quotes across all export RFQs. | seller |
| POST | `/exporter/orders/{id}/status` | Transition export shipment lifecycle: `confirmed → sourcing → packed → pickedUp → inTransit → customsCleared → delivered`. | exporter |
| PUT | `/exporter/orders/{id}/shipment` | Assign shipping line, container type (dry/reefer), container numbers, and vessel name. | exporter |
| POST | `/exporter/orders/{id}/shipment/events` | Record logistics milestone event (`gateIn`, `loaded`, `departed`, `arrived`, `customsHold`, `cleared`). | exporter |
| POST | `/exporter/orders/{id}/documents` · GET `/exporter/orders/{id}/documents` · DELETE `/exporter/orders/{id}/documents/{docId}` | Upload, review, or remove export compliance documents (commercial invoice, phytosanitary, bill of lading). | exporter, seller |
| POST | `/exporter/orders/{id}/lc` | Record Letter of Credit (LC) bank guarantee details (LC number, issuing bank, expiry). | exporter |
| POST | `/exporter/orders/{id}/remittances` | Record international FX remittance (TT/LC/advance wire) against export contract. | exporter |
| GET | `/exporter/orders/{id}/finance` | Order financial statement: total contract value, supplier payments, pending balances. | exporter |
| GET | `/exporter/suppliers` · POST `/exporter/suppliers/{sellerId}/save` · DELETE `/exporter/suppliers/{sellerId}/saved` · GET `/exporter/suppliers/saved` | Manage trusted supplier network and browse saved verified exporters. | exporter |

---

## 32. Equipment Rental Hub & Fleet Verification

> Extended machinery rental platform features: owner business verification badges, unverified operator blacklists, preventive maintenance logging, dynamic pricing rules, and custom machinery demand quote responses.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/equipment-rental/verification/documents` | Upload business verification credentials (PAN, RC book, tractor chassis photo). | equipmentOwner |
| GET | `/equipment-rental/verification/status` | Current verification review state and assigned verification badge. | equipmentOwner |
| GET | `/equipment-rental/badge` | Public verified owner badge payload shown to farmers during machine browsing. | all |
| POST | `/equipment-rental/blacklist` | Blacklist disruptive or defaulting user from booking owner's fleet. Body: `{ userId, reason? }`. | equipmentOwner |
| GET | `/equipment-rental/blacklist` | List currently blacklisted farmers / contractors. | equipmentOwner |
| DELETE | `/equipment-rental/blacklist/{userId}` | Remove user from blacklist. | equipmentOwner |
| POST | `/equipment-rental/operators` · GET `/equipment-rental/operators` | Manage licensed equipment operators and tractor drivers. | equipmentOwner |
| PUT | `/equipment-rental/operators/{id}` · DELETE `/equipment-rental/operators/{id}` | Update operator details or remove from fleet. | equipmentOwner |
| POST | `/equipment-rental/maintenance` · GET `/equipment-rental/maintenance` | Log routine service, oil change, tyre replacement, and machinery repair logs. | equipmentOwner |
| PUT | `/equipment-rental/maintenance/{id}` · DELETE `/equipment-rental/maintenance/{id}` | Update maintenance entry status or cost. | equipmentOwner |
| GET | `/equipment-rental/pricing-rules` · PUT `/equipment-rental/pricing-rules` | Configure peak season surge multipliers, weekend rates, and minimum operating hours. | equipmentOwner |
| POST | `/equipment/{equipment_id}/quote` | Submit custom quotation for machinery rental job. | equipmentOwner |
| POST | `/equipment-rental/reports` · GET `/equipment-rental/reports` | Report user misconduct, machinery mishandling, or payment default. | equipmentRental |
| GET | `/equipment-rental/risk/farmers` | Farmer reliability and default-risk signals based on past equipment bookings. | equipmentRental |
| GET | `/equipment-rental/demand-heatmap` | Regional machinery demand concentration and underserved farm clusters. | equipmentRental |
| GET | `/equipment-rental/ranking/explain` | Marketplace ranking breakdown and visibility factor audit for own fleet. | equipmentRental |
| GET | `/equipment-rental/recommendations` | Machine fleet expansion suggestions based on unmet seasonal demand. | equipmentRental |
| GET | `/equipment-rental/monitoring/bookings` | Real-time monitoring of active machine hours, operator status, and field location. | equipmentRental |
| GET | `/equipment-rental/settlements` | Weekly rental settlement disbursements, platform deductions, and hold releases. | equipmentRental |
| GET | `/equipment-rental/commission` | Equipment rental commission policy tiers and seasonal rate cards. | equipmentRental |
| GET | `/equipment-rental/policies` | Rental platform cancellation, damage liability, and deposit forfeiture rules. | equipmentRental |
| GET | `/equipment-rental/reminders` | Automated machinery maintenance alerts, RTO road tax renewals, and insurance expiry countdowns. | equipmentRental |

---

## 33. Resale Marketplace (Farm Machinery & Vehicles)

> Secondary market for verified pre-owned agricultural equipment (tractors, combine harvesters, rotavators, power tillers, borewell rigs). Sellers list pre-owned equipment with RC verification, hour-meter photos, and inspection logs. Buyers browse verified listings and submit escrow-backed purchase inquiries.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/resale-listings` | Create pre-owned equipment listing. Body: `{ title, machineryType, brand, modelYear, hoursUsed, priceRupees, location, rcAvailable: bool, photos[] }`. | seller, farmer, equipmentOwner |
| GET | `/resale-listings` | Browse public resale marketplace with machine type, brand, price, and distance filters. | all |
| GET | `/resale-listings/mine` | Seller's own pre-owned equipment listings and received buyer inquiries. | seller, farmer, equipmentOwner |
| GET | `/resale-listings/{id}` | Detailed machine listing: mechanical health inspection, tyre life %, service records, RC status. | all |
| PUT | `/resale-listings/{id}` | Update price, availability status, or description of own resale listing. | seller, farmer, equipmentOwner |
| DELETE | `/resale-listings/{id}` | Close or delete listing once sold or delisted. | seller, farmer, equipmentOwner |
| POST | `/resale-listings/{id}/inquire` | Buyer submits formal purchase offer / inspection visit request. Body: `{ offerAmountRupees?, message, preferredInspectionDate? }`. | all |
| POST | `/resale-listings/{id}/book` | Buyer confirms instant purchase / booking of machinery listing with escrow deposit. | directBuyer, seller, exporter |

---

## 34. WebRTC Audio & Video Calling

> Real-time peer-to-peer audio/video calling infrastructure for Kisan Mitra expert consultations, veterinarian telemedicine, and high-value B2B trade negotiations.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/calls/initiate` | Initiate WebRTC call session. Body: `{ calleeId, callType: audio|video, context: consultation|trade|support, refId? }`. Returns `{ callId, iceServers[], signalingRoom }`. | all |
| POST | `/calls/{call_id}/signal` | Exchange SDP offer/answer and ICE candidate signaling payloads. Body: `{ signalType: offer|answer|candidate, payload }`. | all |
| POST | `/calls/{call_id}/end` | Terminate call session and log duration. Body: `{ reason: normal|declined|busy|failed }`. | all |
| GET | `/calls/active` | Check current active incoming or ongoing calls for the authenticated user. | all |
| GET | `/calls/history` | Historical call log: participants, timestamp, duration seconds, consultation context. | all |
| GET | `/calls/{call_id}` | Detailed call summary doc with quality metrics and consultation recording reference (if enabled). | all |
| POST | `/calls` | Context-scoped one-click call trigger (trade, vehicle, or advisory). Handles number proxy masking. | all |
| POST | `/calls/{id}/answer` · POST `/calls/{id}/decline` | Callee updates ringing call status to ongoing or declined. | all |
| GET | `/calls` | Call history log with duration and context references. | all |

---

## 35. SaaS Billing & Subscriptions

> Persona plan catalog and recurring SaaS subscription management for enterprise Direct Buyers, large FPOs, Exporters, and high-volume Transporters.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/billing/plans` | Catalog of available subscription tiers (`starter`, `pro`, `enterprise`) with feature entitlements. | all |
| GET | `/billing/subscription` | Current authenticated user/organization subscription status, billing cycle, and usage limits. | all |
| POST | `/billing/subscription/upgrade` | Upgrade or switch subscription tier with Razorpay recurring mandate or pre-paid order. | all |
| POST | `/billing/subscription/cancel` | Cancel auto-renewal of subscription at the end of the current billing cycle. | all |
| GET | `/billing/subscriptions` | Full historical subscription ledger with plan snapshots and renewal states. | all |
| POST | `/billing/subscribe` | Subscribe to paid plan tier with billing period activation. | all |

---

## 36. AI Power Engines

> Microservice inference endpoints providing specialized agricultural machine learning models: B2B offer scoring, agro-meteorological spray window classification, and regional commodity demand forecasting.

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/ai-power/trade/offer-score` | ML scoring of trade offers against real-time mandi spreads, distance, and counterparty credit rating. Body: `{ lotId, offerPrice, quantity, counterpartyId }`. Returns `{ attractivenessScore: 0-100, recommendation: accept|counter|reject, fairPricePaise }`. | all |
| POST | `/ai-power/advisory/spray-window` | Classify optimal pesticide/fungicide spray window based on hourly wind speed, rain probability, and humidity. Body: `{ lat, lng, crop, pesticideCategory }`. Returns `{ windowStatus: optimal|marginal|unsafe, hourlyForecast[] }`. | all |
| POST | `/ai-power/demand/forecast` | Predict regional mandi arrival surges and buyer demand across 15-day and 30-day horizons. Body: `{ district, crop, horizonDays }`. Returns `{ predictedDemandMT, arrivalTrend: increasing|stable|decreasing, priceConfidenceInterval }`. | all |

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
