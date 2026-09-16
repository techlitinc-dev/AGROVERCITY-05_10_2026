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
| GET | `/diary/entries?type=&category=&from=&to=` | `FarmDiaryEntry[]`: `{ id, title, category, type, amount, date, cropName, notes }`. | farmer, landlord |
| POST | `/diary/entries` | Add entry → `{ entry, agriCoinsEarned: 15 }`. (AppState: `addDiaryEntry`) | farmer, landlord |
| DELETE | `/diary/entries/{id}` | Delete entry. | farmer, landlord |
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
| POST | `/finance/loans/apply` | Input-loan application. Body: `{ amount, tenureMonths, purpose }`. | farmer |

## 12. Crop Insurance (PMFBY / RWBCIS)

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/insurance/policies` | `CropInsurancePolicy[]`: `{ id, policyNumber, schemeName, cropName, season, year, landAreaAcres, sumInsured, farmerPremium, govtSubsidy, status, insuranceCompany, coverageStartDate, coverageEndDate, bankName, kccAccountNo, certificateUrl }`. | farmer, landlord |
| POST | `/insurance/policies/apply` | Quick-apply new crop coverage `{ cropName, season, landAreaAcres }`. | farmer, landlord |
| GET | `/insurance/policies/{id}/certificate` | e-Certificate PDF (download URL). (AppState: `downloadPolicyCertificate`) | farmer, landlord |
| GET | `/insurance/rates?season=&crop=` | `CropPremiumRate[]`: `{ cropName, category, season, sumInsuredPerAcre, farmerSharePercent, totalActuarialRatePercent, cutoffDate }` — feeds premium calculator. | farmer, landlord |
| POST | `/insurance/claims` | 72-h claim intimation. Body: `{ policyId, cropName, calamityType, dateOfDamage, cropStage, estimatedLossPercent, gpsCoordinates, village }` + multipart `damagePhotos[]`. Returns `InsuranceClaimRecord` with generated `claimNumber` (`CLM-YYYY-ST-####`), status `intimated`, assigned surveyor. (AppState: `submitCropClaim`) | farmer, landlord |
| GET | `/insurance/claims` · GET `/insurance/claims/{id}` | Claim tracker: `{ claimNumber, status, statusText, surveyorName, surveyorPhone, surveyorVisitDate, approvedAmount, dbtTransactionId, bankAccountLast4, timeline[] }`. | farmer, landlord |

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

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/gaushalas?district=&lat=&lng=` | `GaushalaItem[]`: `{ id, name, trustName, address, district, distanceKm, cowCount, breeds[], phone, providesOrganicManure, offersCowAdoption, rating, facilities }`. | farmer, seller |
| POST | `/gaushalas/{id}/manure-order` | Order cow-dung manure/slurry `{ product, quantity }` with priced options. (AppState: `orderGaushalaManure`) | farmer |
| GET | `/nurseries?lat=&lng=` | `PlantNursery[]`: `{ id, name, ownerName, location, distanceKm, phone, rating, isGovtCertified, availableSaplings[], priceRange }`. | farmer, seller |
| GET | `/vets?lat=&lng=&emergency=` | `VetDoctor[]`: `{ id, name, qualification, specialization, clinicAddress, distanceKm, phone, experienceYears, consultationFeeRupees, rating, availableForFarmVisit, nextAvailableSlot }`. 24×7 emergency flag. | farmer |
| POST | `/vets/{id}/book` | Vet booking `{ visitType (farm/clinic), slot, animalType }`. (AppState: `bookVetDoctor`) | farmer |
| GET | `/dairy-products?category=` | `DairyProductItem[]`: `{ id, title, farmName, category, price, rating, unit, reviewsCount, purityCertification, inStock, description }`. | farmer, seller |
| POST | `/dairy-products/{id}/order` | Direct buy `{ quantity }`. (AppState: `orderDairyProduct`) | farmer, seller |

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
| GET | `/gamification/status` | `{ krishiRatnaLevel, krishiRatnaTitle, agriCoins, streakDays, xpToNextLevel }`. | all |
| GET | `/gamification/rewards` | Rewards store `[{ id, title, coinCost, type (voucher/service/discount) }]`. | all |
| POST | `/gamification/redeem` | Redeem `{ rewardId }` → `{ newBalance, couponCode? }`. **409 if insufficient coins.** (AppState: `redeemCoupon`) | all |
| GET | `/gamification/ledger` | Coin earn/spend history. | all |
| GET | `/referrals` | `{ referralCode, milestones: [{count, reward, achieved}], referred: ReferralUser[] }`. | all |
| POST | `/referrals/invite` | Invite `{ farmerName, phone }` → `{ agriCoinsEarned: 100 }`; triggers SMS/WhatsApp invite. (AppState: `inviteFarmer`) | all |

## 20. Climate, Post-Harvest, Misc

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/climate/carbon-potential?lat=&lng=` | `{ annualIncomePotential, co2eTonnes, practices[] (biochar/zero-till/green-manure) }`. | farmer |
| GET | `/climate/resilient-varieties?crop=&district=` | Climate-resilient seed varieties list. | farmer |
| GET | `/post-harvest/cold-storage?lat=&lng=` | `[{ id, name, distanceKm, tempRange, availableMT, ratePerQuintalMonth }]`. | farmer, transporter, seller |
| POST | `/post-harvest/grade` | AI quality grading. Multipart produce images → `{ grade, uniformityPercent, shelfLifeDays, recommendedPrice }`. | farmer, seller |
| GET | `/women/shg` · POST `/women/shg/deposit` | SHG group `{ memberCount, corpus, loanFund, monthlyDeposit }`; record deposit. | farmer (women mode) |
| GET | `/women/home-enterprise` | Home enterprise income lines `[{ product, monthlyProfit }]`. | farmer (women mode) |
| GET | `/dashboard/home` | Aggregated farmer home: weather, urgent task, vyapari rates, banners — single call to hydrate dashboard. | all |
| POST | `/sync` | Offline queue replay. Body: `{ operations: [{ idempotencyKey, method, path, body, queuedAt }] }` → per-op results. | all |
| GET | `/notifications` · POST `/notifications/read` | Persona-specific notifications (Phase 2). | all |

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
