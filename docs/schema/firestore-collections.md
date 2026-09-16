# Schema — Firestore Collections

Primary database for all app data. Naming: collections are plural `snake_case`. Money fields are **integer rupees**; timestamps are Firestore `Timestamp` serialized to ISO-8601 at the API boundary (`conventions/02-api-conventions.md` §8).

## Global rules

- **Access:** backend only, via the Firebase Admin SDK. `infra/firestore.rules` is **deny-all** for clients:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{db}/documents {
      match /{document=**} { allow read, write: if false; }
    }
  }
  ```
  The "Security" line per collection below therefore describes the **backend authorization rule** (enforced in `services/`): which uid/role may read or mutate the document. Per-collection summary keywords: `owner` = only `ownerId`/`userId`/`farmerId` == caller uid; `admin` = admin custom claim; `public-read` = any authenticated user may read.
- **Composite indexes** listed per collection are declared in `infra/firestore.indexes.json` (Dev A owns that file). Single-field indexes are automatic and not listed.
- Field types: `string, int, double, bool, timestamp, array<...>, map, geopoint`. `?` = optional/nullable.

---

## users
- **Doc ID:** Firebase Auth `uid`.
- **Security:** owner read/write; admin read + status write.

| Field | Type | Notes |
|---|---|---|
| name, vernacularName | string | |
| phone | string | E.164 `+91...`, unique-enforced in service |
| village, tehsil, district, state | string | |
| landAreaAcres | double | |
| soilType, irrigationType | string | enum chips from onboarding |
| khasraNumber | string? | |
| activeCrops | array<string> | |
| farmBoundaryPoints | array<map{lat,lng}> | geofence polygon |
| linkedProfiles | array<string> | enum profileType; min length 1 |
| activeProfile, primaryProfile | string | profileType |
| mpinHash | string | bcrypt; never returned by API |
| kisanCreditScore, creditTier | int / string | |
| krishiRatnaLevel, krishiRatnaTitle | int / string | |
| streakDays, agriCoins | int | |
| bankName, kccLimit | string / int | |
| settings | map{language, womenMode, highContrast, darkMode, pushPrefs} | |
| status | string | `active`/`disabled` (admin) |
| deletedAt | timestamp? | set by DELETE /users/me |
| createdAt, updatedAt | timestamp | |

- **Indexes:** `phone` (ASC, for login lookup); `linkedProfiles` (array-contains) + `createdAt`.

## mandi_prices
- **Doc ID:** `{mandiSlug}_{commodity}_{variety}_{YYYY-MM-DD}` (upsert by ingestion job).
- **Security:** public-read (role-gated at API: farmer/seller/broker); writes only by ingestion service.

| Field | Type |
|---|---|
| mandiName, district | string |
| lat, lng | double |
| commodity, variety | string |
| minPrice, maxPrice, modalPrice, msp | int |
| trend | string `up/down/flat` |
| changePercent | double |
| arrivalsQuintals | int |
| updatedAt | timestamp |

- **Indexes:** `commodity + updatedAt`; `district + commodity`.

## vyapari_rates
- **Doc ID:** auto-id. Unique constraint (service-enforced): `(sellerId, crop, mandiName, date)`.
- **Security:** seller writes own; public-read of `status=approved` only; admin approves/rejects.

| Field | Type |
|---|---|
| sellerId | string (uid) |
| crop, mandiName | string |
| ratePerQuintal | int |
| priceChange | int | computed vs yesterday's approved rate |
| changeDir | string `up/down/flat` |
| vyapariCount | int | sellers approved for same crop+mandi+date |
| status | string `pending/approved/rejected` |
| rejectReason | string? |
| date | string `YYYY-MM-DD` |
| createdAt, updatedAt | timestamp |

- **Indexes:** `crop + status + date`; `sellerId + date`.

## products
- **Doc ID:** auto-id (seeded by admin; seller-managed in later phases).
- **Security:** public-read; admin write.

| Field | Type |
|---|---|
| title, vernacularTitle | string |
| category | string `seeds/vehicles/fertilizer/pesticide/tools` |
| brand, dealerName | string |
| dealerLat, dealerLng | double? |
| rating | double |
| reviewsCount | int |
| mrp, discountedPrice | int |
| bnplAvailable | bool |
| batchNo, quantity | string / int |
| certifier, certificateNo, certificateValid | string / string / bool |
| imageUrl | string? (Storage) |
| createdAt | timestamp |

- **Indexes:** `category + discountedPrice`; `category + rating`.

## carts
- **Doc ID:** `uid` (one active cart per user). Items subcollection `carts/{uid}/items/{productId}` with `{ quantity: int, addedAt }`.
- **Security:** owner only.

| Field | Type |
|---|---|
| userId | string |
| updatedAt | timestamp |

## orders
- **Doc ID:** auto-id; public `orderId` = `ord_{random}` stored as field.
- **Security:** buyer owner read; service writes; admin read.

| Field | Type |
|---|---|
| orderId, userId | string |
| items | array<map{productId, title, quantity, unitPrice}> |
| total | int (rupees) |
| paymentMethod | string `upi/cod/bnpl` |
| paymentStatus | string `pending/paid/failed/refunded` |
| razorpayOrderId, razorpayPaymentId | string? |
| bnplSchedule | array<map{dueDate, amount}>? |
| deliveryAddress | string |
| status | string `placed/confirmed/packed/shipped/outForDelivery/delivered/cancelled` |
| statusHistory | array<map{status, at}> |
| idempotencyKey | string |
| createdAt, updatedAt | timestamp |

- **Indexes:** `userId + createdAt`; `status + createdAt`.

## contracts
- **Doc ID:** auto-id.
- **Security:** public-read of open contracts; farmer/seller write acceptance on own uid; admin write.

| Field | Type |
|---|---|
| buyerCompany | string |
| buyerRating | double |
| crop | string |
| lockedRateQuintal, mspCurrentRate, premiumAboveMSP | int |
| minQuantityQuintals | int |
| deliveryLocation | string |
| paymentTerms, contractDuration | string |
| termsDocument | string (full text) |
| status | string `open/accepted/expired` |
| acceptances | array<map{userId, signatureData, consentTimestamp, at}> |
| createdAt | timestamp |

- **Indexes:** `status + crop`; `crop + createdAt`.

## vehicles
- **Doc ID:** auto-id; public id `veh_{random}`.
- **Security:** transporter owner CRUD; public-read of active vehicles for booking.

| Field | Type |
|---|---|
| ownerId | string (uid) |
| type | string `tataAce/boleroMaxi/tractorTrolley/pickup/miniTruck` |
| registrationNo | string (unique, service-enforced) |
| capacityTonnes | double |
| baseFare, perKmRate | int |
| rcDocumentUrl, insuranceDocumentUrl | string? (Storage) |
| verificationStatus | string `pending/verified/rejected` |
| isActive | bool |
| blockedDates | array<string `YYYY-MM-DD`> |
| createdAt, updatedAt | timestamp |

- **Indexes:** `ownerId + isActive`; `type + isActive`.

## transport_bookings
- **Doc ID:** auto-id.
- **Security:** farmer/seller (booker) create+read own; transporter (vehicle owner) read+PATCH status.

| Field | Type |
|---|---|
| bookerId, transporterId, vehicleId | string |
| vehicleType | string |
| pickup, drop | string |
| distanceKm | double |
| date | string `YYYY-MM-DD` |
| fare | int |
| status | string `requested/accepted/enRoute/delivered/cancelled` |
| cancelReason, podNote | string? |
| statusHistory | array<map{status, at}> |
| idempotencyKey | string? |
| createdAt, updatedAt | timestamp |

- **Indexes:** `transporterId + status + date`; `bookerId + createdAt`; `vehicleId + date`.

## equipment
- **Doc ID:** auto-id; public id `eq_{random}`.
- **Security:** equipmentRental owner CRUD; farmer/equipOwner read.

| Field | Type |
|---|---|
| ownerId | string (uid) |
| ownerType | string `fpo/private` |
| name, type, description | string |
| hourlyRate | int |
| perAcreRate | int? |
| photoUrl | string? |
| lat, lng | double |
| slotTemplates | array<map{name, startMin, endMin, priceRupees, recommendedTask, enabled}> — default 4 slots: 6–10, 10–2, 2–6, 6–10 |
| isActive | bool |
| createdAt, updatedAt | timestamp |

- **Indexes:** `ownerId + isActive`; `type + isActive`.

## equipment_slots
- **Doc ID:** `{equipmentId}_{YYYY-MM-DD}_{slotName}` — deterministic, enables atomic book transaction.
- **Security:** read by farmer/equipOwner; writes only by booking service (transactions).

| Field | Type |
|---|---|
| equipmentId, date, slotName | string |
| startMin, endMin, duration | int |
| priceRupees | int |
| recommendedTask | string |
| status | string `available/booked/pending` |
| bookedBy, bookedByName | string? |
| waitlist | array<map{userId, name, at}> |
| createdAt, updatedAt | timestamp |

- **Indexes:** `equipmentId + date`; `date + status`.

## equipment_bookings
- **Doc ID:** auto-id.
- **Security:** farmer owner read/cancel; equipOwner read own-fleet; service writes. Rules: max 2 slots/farmer/day, cancel ≤2 h before start.

| Field | Type |
|---|---|
| slotId, equipmentId, farmerId | string |
| farmerName | string |
| date, slotName | string |
| startAt | timestamp |
| priceRupees | int |
| status | string `pending/confirmed/cancelled/completed` |
| ownerType | string `fpo/private` (drives auto-confirm) |
| idempotencyKey | string? |
| createdAt, updatedAt | timestamp |

- **Indexes:** `farmerId + date`; `farmerId + createdAt`; `equipmentId + date`.

## fpo_pools
- **Doc ID:** auto-id.
- **Security:** farmer read/join; admin write.

| Field | Type |
|---|---|
| fpoId, fpoName | string |
| item | string |
| bookedUnits, targetUnits | int |
| discountPercent | int |
| unitPrice | int |
| deadline | timestamp |
| members | array<map{userId, units, at}> |
| status | string `open/closed/fulfilled` |

- **Indexes:** `status + deadline`.

## diary_entries
- **Doc ID:** auto-id.
- **Security:** owner (farmer/landlord) only.

| Field | Type |
|---|---|
| userId | string |
| title, category | string |
| type | string `expense/income/farmActivity` |
| amount | int |
| date | string `YYYY-MM-DD` |
| cropName, notes | string? |
| idempotencyKey | string? |
| createdAt | timestamp |

- **Indexes:** `userId + date`; `userId + type + date`.

## pnl_crops
- **Doc ID:** auto-id (linked to `crop_cycles` where applicable).
- **Security:** owner only.

| Field | Type |
|---|---|
| userId | string |
| name | string (crop) |
| season, area | string / double |
| cropCycleId | string? |
| yieldQuintals | double |
| marketAvgRate | int |
| grossRevenue, totalExpenses, netProfit | int |
| roiPercent | double |
| expensesBreakdown | array<map{category, amount}> |
| createdAt, updatedAt | timestamp |

- **Indexes:** `userId + season`.

## schemes
- **Doc ID:** slug (`pm-kisan`, `pmfby`...).
- **Security:** public-read; admin write (via `/admin/content/schemes`).

| Field | Type |
|---|---|
| name, vernacularName | string |
| category | string |
| benefitAmount | int |
| description | string |
| documentsRequired | array<string> |
| status, nextDeadline | string |
| eligibilityRules | map (server-evaluated) |
| portalUrl | string? |
| applications | subcollection `schemes/{id}/applications/{uid}`: `{ documentIds, status, appliedAt }` |

## vault_documents
- **Doc ID:** auto-id.
- **Security:** owner only; files in Storage under `vault/{uid}/{docId}`; never log Aadhaar.

| Field | Type |
|---|---|
| userId | string |
| docType | string `aadhaar/record712/bankPassbook/soilHealthCard/other` |
| title | string |
| storagePath, downloadUrl | string |
| sizeBytes, mimeType | int / string |
| createdAt | timestamp |

- **Indexes:** `userId + docType`.

## insurance_policies
- **Doc ID:** auto-id.
- **Security:** owner (farmer/landlord) read; service write.

| Field | Type |
|---|---|
| userId | string |
| policyNumber | string (unique) |
| schemeName, vernacularSchemeName | string |
| cropName, vernacularCropName | string |
| season, year | string / int |
| landAreaAcres | double |
| sumInsured, farmerPremium, govtSubsidy | int |
| status | string `active/expired/claimed` |
| insuranceCompany, bankName, kccAccountNo | string |
| coverageStartDate, coverageEndDate | string |
| certificateUrl | string? (Storage PDF) |
| createdAt | timestamp |

- **Indexes:** `userId + status`.

## insurance_claims
- **Doc ID:** auto-id; public `claimNumber` = `CLM-YYYY-ST-####` (sequence via Firestore counter doc `counters/claims`).
- **Security:** owner read/create; admin advances status.

| Field | Type |
|---|---|
| userId, policyId | string |
| claimNumber | string |
| cropName, vernacularCropName | string |
| calamityType | string |
| dateOfDamage, cropStage | string |
| estimatedLossPercent | int |
| requestedAmount, approvedAmount | int / int? |
| status | string `intimated/surveyorAssigned/fieldAssessed/dbtApproved/disbursed/rejected` |
| statusText | string |
| timeline | array<map{status, at, note}> |
| surveyorName, surveyorPhone, surveyorVisitDate | string? |
| gpsCoordinates | map{lat,lng} |
| village | string |
| damagePhotos | array<string> (Storage paths) |
| dbtTransactionId, bankAccountLast4 | string? |
| submittedAt | timestamp |

- **Indexes:** `userId + submittedAt`; `status + submittedAt`.

## insurance_rates
- **Doc ID:** `{crop}_{season}`.
- **Security:** public-read; admin write.

| Field | Type |
|---|---|
| cropName, vernacularCropName, category | string |
| season | string `kharif/rabi/annual` |
| sumInsuredPerAcre | int |
| farmerSharePercent, totalActuarialRatePercent | double |
| cutoffDate | string |

## land_records
- **Doc ID:** `{state}_{district}_{gatNumber}` (cached copies of govt records).
- **Security:** public-read (farmer/landlord via API); ingestion-service write.

| Field | Type |
|---|---|
| gatNumber, village, district, state | string |
| recordType | string `712/8A` |
| ownerName, khataNumber, ferfarNumber | string |
| totalAreaHectares, totalAreaAcres | double |
| landClass, soilType, irrigationType | string |
| cropHistory | string |
| pdfUrl | string? |
| fetchedAt | timestamp |

- **Indexes:** `village + district`; `gatNumber` (single-field).

## land_plots
- **Doc ID:** auto-id.
- **Security:** landlord owner CRUD.

| Field | Type |
|---|---|
| ownerId | string |
| name, village, district | string |
| areaAcres, areaHectares | double |
| soilType, irrigationType, khasraNumber | string? |
| status | string `vacant/leased` |
| createdAt, updatedAt | timestamp |

- **Indexes:** `ownerId + status`.

## leases
- **Doc ID:** auto-id.
- **Security:** landlord owner CRUD.

| Field | Type |
|---|---|
| plotId, ownerId | string |
| tenantName, tenantPhone | string |
| rentPerMonth | int |
| startDate, endDate | string |
| durationMonths | int |
| terms | string? |
| status | string `active/ended` |
| verified | bool |
| createdAt, updatedAt | timestamp |

- **Indexes:** `ownerId + status`; `plotId + status`.

## lease_payments
- **Doc ID:** `{leaseId}_{YYYY-MM}` — one payment per lease per month.
- **Security:** landlord owner read/write.

| Field | Type |
|---|---|
| leaseId, ownerId | string |
| month | string `YYYY-MM` |
| amount | int |
| mode | string `cash/upi/bank` |
| paidOn | string |
| status | string `paid` (due/overdue computed at read time) |
| note | string? |
| createdAt | timestamp |

- **Indexes:** `ownerId + month`.

## seller_inventory
- **Doc ID:** auto-id.
- **Security:** seller owner CRUD.

| Field | Type |
|---|---|
| sellerId | string |
| crop, mandiName | string |
| quantityQuintals | double |
| avgBuyRate | int |
| lowStockAlertQuintals | int? |
| createdAt, updatedAt | timestamp |

- **Indexes:** `sellerId + crop`.

## seller_sales
- **Doc ID:** auto-id. Writes decrement `seller_inventory` in the same transaction.
- **Security:** seller owner read/create.

| Field | Type |
|---|---|
| sellerId, inventoryId | string |
| crop | string |
| quantityQuintals | double |
| saleRate, totalAmount | int |
| buyerName | string? |
| paymentMode | string `cash/upi/credit` |
| date | string `YYYY-MM-DD` |
| idempotencyKey | string? |
| createdAt | timestamp |

- **Indexes:** `sellerId + date`.

## broker_deals
- **Doc ID:** auto-id.
- **Security:** broker owner CRUD.

| Field | Type |
|---|---|
| brokerId | string |
| crop | string |
| quantityQuintals | double |
| ratePerQuintal, dealValue | int |
| farmerParty, buyerParty | string |
| commissionPercent | double |
| commissionAmount | int |
| status | string `negotiating/locked/completed/cancelled` |
| leadId | string? |
| createdAt, updatedAt | timestamp |

- **Indexes:** `brokerId + status`; `brokerId + createdAt`.

## broker_leads
- **Doc ID:** auto-id.
- **Security:** broker owner CRUD.

| Field | Type |
|---|---|
| brokerId | string |
| name, village, phone | string |
| type | string `farmer/buyer` |
| crop | string |
| quantityQuintals | double? |
| notes | string? |
| lastContactAt | timestamp? |
| convertedDealId | string? |
| createdAt, updatedAt | timestamp |

- **Indexes:** `brokerId + type`.

## broker_commissions
- **Doc ID:** auto-id.
- **Security:** broker owner read/write (mark received).

| Field | Type |
|---|---|
| brokerId, dealId | string |
| party | string |
| amount | int |
| status | string `pending/received` |
| date, receivedOn | string / string? |
| note | string? |
| createdAt | timestamp |

- **Indexes:** `brokerId + status + date`.

## farm_plots
- **Doc ID:** auto-id.
- **Security:** farmer owner CRUD (409 on delete with active crop cycle).

| Field | Type |
|---|---|
| farmerId | string |
| name | string |
| areaAcres | double |
| soilType, irrigationType, khasraNumber | string? |
| boundaryPoints | array<map{lat,lng}> |
| currentCrop | string? |
| isPrimary | bool |
| createdAt, updatedAt | timestamp |

- **Indexes:** `farmerId + isPrimary`.

## crop_cycles
- **Doc ID:** auto-id.
- **Security:** farmer owner CRUD; aggregate (counts only) readable by advisory service.

| Field | Type |
|---|---|
| farmerId, plotId | string |
| crop | string |
| season | string `kharif/rabi/zaid` |
| sowingDate, expectedHarvestDate | string |
| expectedYieldQuintals, actualYieldQuintals | double / double? |
| stage | string `sown/germinated/vegetative/flowering/harvested` |
| status | string `active/closed` |
| shareForSaturation | bool (opt-in) |
| district | string (denormalized for aggregation) |
| createdAt, updatedAt | timestamp |

- **Indexes:** `farmerId + status`; `plotId + status`; `district + crop + season + status` (saturation aggregation).

## gaushalas
- **Doc ID:** auto-id. **Security:** public-read; admin write.

| Field | Type |
|---|---|
| name, vernacularName, trustName, address, district | string |
| lat, lng, distanceKm | double (distance computed at query) |
| cowCount | int |
| breeds | array<string> |
| phone | string |
| providesOrganicManure, offersCowAdoption | bool |
| rating | double |
| facilities | string |
| manureProducts | array<map{product, unit, price}> |

- **Indexes:** `district`.

## nurseries
- **Doc ID:** auto-id. **Security:** public-read; admin write.

| Field | Type |
|---|---|
| name, vernacularName, ownerName, location | string |
| lat, lng | double |
| phone | string |
| rating | double |
| isGovtCertified | bool |
| availableSaplings | array<string> |
| priceRange | string |

## vets
- **Doc ID:** auto-id. **Security:** public-read; admin write.

| Field | Type |
|---|---|
| name, qualification, specialization, clinicAddress | string |
| lat, lng | double |
| phone | string |
| experienceYears | int |
| consultationFeeRupees | int |
| rating | double |
| availableForFarmVisit, emergency24x7 | bool |
| nextAvailableSlot | string |

## vet_bookings
- **Doc ID:** auto-id.
- **Security:** farmer owner create/read; vet admin read.

| Field | Type |
|---|---|
| farmerId, vetId | string |
| visitType | string `farm/clinic` |
| slot | string |
| animalType | string |
| feeRupees | int |
| status | string `booked/completed/cancelled` |
| idempotencyKey | string? |
| createdAt | timestamp |

- **Indexes:** `farmerId + createdAt`; `vetId + slot`.

## dairy_products
- **Doc ID:** auto-id. **Security:** public-read; admin write. Orders stored in `orders` with `paymentMethod` and a `kind: "dairy"` field (reuse, not a new collection).

| Field | Type |
|---|---|
| title, vernacularTitle, farmName | string |
| category | string `ghee/milk/paneer/butter` |
| price | int |
| unit | string |
| rating | double |
| reviewsCount | int |
| purityCertification | string |
| inStock | bool |
| description | string |

## news
- **Doc ID:** auto-id. **Security:** public-read; admin write via `/admin/content/news`.

| Field | Type |
|---|---|
| title, vernacularTitle | string |
| category | string `marketPolicy/weatherAlert/govtSubsidy/agriTech` |
| source | string |
| timestamp | timestamp |
| summary, content, audioText | string |
| isBreaking | bool |
| impactRating | int 1–5 |

- **Indexes:** `category + timestamp`; `isBreaking + timestamp`.

## channels
- **Doc ID:** auto-id. **Security:** public-read; admin write. `liveViewersCount` is served from Redis (`schema/redis-keys.md`), mirrored here periodically.

| Field | Type |
|---|---|
| channelName, vernacularName, broadcaster | string |
| programTitle, vernacularProgram, currentSpeaker | string |
| liveViewersCount | int (mirror) |
| isLiveNow | bool |
| category | string |
| streamThumbnail | string? |
| streamUrl | string (HLS) |
| scheduleTime | string |

## channel_chats
- **Doc ID:** auto-id under top-level collection.
- **Security:** any authenticated user read/write own; messages older than 24 h purged by scheduled job.

| Field | Type |
|---|---|
| channelId, userId | string |
| userName | string |
| text | string (max 280, server-truncated) |
| createdAt | timestamp |

- **Indexes:** `channelId + createdAt`.

## workshops
- **Doc ID:** auto-id. **Security:** public-read; admin write. Enrollments subcollection `workshops/{id}/enrollments/{uid}`: `{ useCoins, coinsRedeemed, paymentRef?, enrolledAt }`.

| Field | Type |
|---|---|
| title, vernacularTitle, instructor, instructorRole, institution | string |
| feeRupees | int |
| coinsDiscountAllowed | int |
| duration, batchDate, timing | string |
| rating | double |
| enrolledCount, totalSeats | int |
| isCertified | bool |
| certificateTitle | string |
| syllabusModules, deliverables | array<string> |

## expert_talks
- **Doc ID:** auto-id. **Security:** public-read; admin write. Registrations subcollection `expert_talks/{id}/registrations/{uid}`: `{ registeredAt }`; questions subcollection `.../questions/{autoId}`: `{ userId, question, askedAt }`.

| Field | Type |
|---|---|
| expertName, institution, topic, vernacularTopic | string |
| scheduledTime | timestamp |
| isLive | bool |
| registeredCount | int |
| expertAvatar | string? |
| description | string |

## videos
- **Doc ID:** auto-id. **Security:** public-read; admin write.

| Field | Type |
|---|---|
| title, vernacularTitle, instructor | string |
| duration | string |
| views | int |
| category | string |
| videoUrl | string (hosted) |
| summary | string |
| keyPoints | array<string> |

- **Indexes:** `category + views`.

## blogs
- **Doc ID:** auto-id. **Security:** public-read; admin write. Bookmarks/likes subcollection `blogs/{id}/reactions/{uid}`: `{ bookmarked, liked }`.

| Field | Type |
|---|---|
| title, vernacularTitle, author, authorRole | string |
| readTimeMinutes | int |
| category | string |
| summary, content | string |
| publishedDate | string |
| likesCount | int |

- **Indexes:** `category + publishedDate`.

## tree_articles
- **Doc ID:** auto-id. **Security:** public-read; admin write.

| Field | Type |
|---|---|
| title, vernacularTitle, category, author | string |
| readTime | int |
| summary, fullContent, benefits | string |
| publishedDate | string |

## ngos
- **Doc ID:** auto-id. **Security:** public-read; admin write. Sapling requests subcollection `ngos/{id}/sapling_requests/{autoId}`: `{ userId, treeType, count, status, requestedAt }`.

| Field | Type |
|---|---|
| name, vernacularName, focusArea, location | string |
| contactPhone, email | string |
| treesPlantedCount | int |
| rating | double |
| servicesOffered | array<string> |
| providesFreeSaplings | bool |
| websiteUrl | string? |

## biofuel_trees
- **Doc ID:** auto-id. **Security:** public-read; admin write.

| Field | Type |
|---|---|
| name, botanicalName, vernacularName | string |
| oilContentPercent | double |
| gestationPeriod | string |
| expectedReturnPerAcre | int |
| suitability, uses, buyerMarket, subsidyScheme | string |

## tree_care_guides
- **Doc ID:** auto-id. **Security:** public-read; admin write.

| Field | Type |
|---|---|
| title, vernacularTitle | string |
| stepNumber | int |
| stage | string |
| instructions, wateringRule, fertilizerSchedule, pestProtection | string |

- **Indexes:** `stepNumber` (single-field).

## referrals
- **Doc ID:** `uid` (one referral record per user). Referred list subcollection `referrals/{uid}/referred/{referredUid}`: `{ farmerName, village, phone, joinDate, status: Joined/Verified/Active, rewardCoins }`.

| Field | Type |
|---|---|
| userId | string |
| referralCode | string (unique, e.g. `RAMSINGH2026`) |
| milestones | array<map{count, reward, achieved}> |
| totalEarnedCoins | int |

- **Indexes:** `referralCode` (single-field, lookup on invite).

## gamification_ledger
- **Doc ID:** auto-id. Coin balance lives on `users.agriCoins` (transaction-updated); this is the audit trail.
- **Security:** owner read; service write.

| Field | Type |
|---|---|
| userId | string |
| delta | int (signed) |
| reason | string `urgentTask/diaryEntry/equipmentBooking/expertTalk/referral/redeem/workshopDiscount` |
| refId | string? |
| balanceAfter | int |
| createdAt | timestamp |

- **Indexes:** `userId + createdAt`.

## chatbot_sessions
- **Doc ID:** auto-id; `sessionId` returned to client. Context summary mirrored in Redis (24 h TTL).
- **Security:** owner only.

| Field | Type |
|---|---|
| userId | string |
| language | string |
| status | string `active/handoffRequested/closed` |
| handoff | map{reason, expertName, contactChannel, etaMinutes}? |
| createdAt, lastMessageAt | timestamp |

- **Indexes:** `userId + lastMessageAt`.

## chatbot_messages
- **Doc ID:** auto-id.
- **Security:** owner read/write (via service only).

| Field | Type |
|---|---|
| sessionId, userId | string |
| sender | string `user/bot` |
| text | string |
| audioUrl | string? |
| language | string |
| quickReplies | array<string> |
| richCardType | string? `saturation/weather/mandi/pest` |
| richCardData | map? |
| timestamp | timestamp |

- **Indexes:** `sessionId + timestamp`.

## notifications
- **Doc ID:** auto-id.
- **Security:** owner read; service write (fan-out via Redis queue).

| Field | Type |
|---|---|
| userId | string |
| profileType | string? (persona-targeted) |
| category | string `booking/claim/rate/coins/system` |
| title, body | string |
| deepLink | string? (route name) |
| read | bool |
| createdAt | timestamp |

- **Indexes:** `userId + read + createdAt`.

## devices
- **Doc ID:** `{uid}_{fcmTokenHash}` — idempotent upsert.
- **Security:** owner write; service read (fan-out).

| Field | Type |
|---|---|
| userId | string |
| fcmToken | string |
| platform | string `android/web` |
| deviceName | string? |
| registeredAt, lastSeenAt | timestamp |

- **Indexes:** `userId` (single-field).

## admin_audit
- **Doc ID:** auto-id. Append-only.
- **Security:** admin read; service write; never update/delete.

| Field | Type |
|---|---|
| adminUid | string |
| action | string `login/userStatus/rateApprove/rateReject/contentWrite/claimUpdate` |
| targetRef | string |
| payload | map |
| at | timestamp |

- **Indexes:** `adminUid + at`; `action + at`.

---

## Scheduled maintenance jobs (Cloud Scheduler → Cloud Run endpoints)

| Job | Frequency | Action |
|---|---|---|
| mandi ingestion | every 2 h, 06:00–20:00 IST | pull Agmarknet/eNAM → upsert `mandi_prices` → refresh Redis cache |
| vyapari aggregation | every 2 h, 06:00–20:00 IST | recompute `vyapariCount` for approved rates → invalidate Redis |
| channel chat purge | daily 03:00 | delete `channel_chats` older than 24 h |
| lease status tick | daily 01:00 | compute due/overdue flags cached per lease; end expired leases |
| slot materialization | daily 00:30 | create next 7 days of `equipment_slots` docs from `slotTemplates` |
| viewer-count mirror | every 5 min | copy Redis live counts into `channels.liveViewersCount` |

---

## Collections added by the missing.md gap audit (round 2)

> Source: `missing.md` + `overview/03-gap-analysis-new-screens-and-endpoints.md` Parts C–D. Same conventions as above. Item IDs in parentheses for traceability (`overview/05-missing-features-traceability.md`).

### Field additions to existing collections

| Collection | New fields | Why |
|---|---|---|
| `users` | `referralCodeUsed` string? (F1), `consents` map{saturationShare, locationForAdvisory, marketingPush, voiceDataProcessing} (X17), `fpoId` string? (F19) | referral attribution, consent center, FPO membership |
| `vehicles` | `insuranceExpiry`, `fitnessExpiry`, `pucExpiry` string `YYYY-MM-DD`? (T7), `docStatus` string `ok/expiringSoon/expired` (T7/T1) | doc-expiry reminders + KYC |
| `equipment` | `docStatus` string `pending/verified/rejected` (E1), `rcDocumentUrl`, `insuranceDocumentUrl` string? (E1), `nextServiceDate` string? (E3) | machine KYC + maintenance reminder |
| `transport_bookings` | `podPhotos` array<string> (T3), `receiverName`, `receiverSignatureUrl` string? (T3), `lotId` string? (F12), `rejectReason` string? (T2) | POD + lot-linked pickup + reject flow |
| `equipment_bookings` | `rejectReason` string? (E2) | owner reject flow |
| `orders` | `refundStatus` string `notApplicable/initiated/refunded/failed`? (X5), `razorpayRefundId` string? (X5), `addressId` string? (X6), `cancelReason` string? (X5) | cancel/refund + address book |
| `leases` | `agreementPdfUrl` string? (L4), `signatures` array<map{userId, signatureData, consentTimestamp, at}> (L4), `leaseRequestId` string? (L3) | agreement PDF + dual e-sign |
| `broker_deals` | `documents` array<map{type, url, uploadedAt}> (B4), `lotId` string? (F7/B3), `requirementId` string? (B3), `chatId` string? (B2) | deal docs + matching refs + deal room |
| `insurance_claims` | `appealOf` string? (F15), `round` int (default 1) (F15) | appeal/resubmit chain |
| `crop_cycles` | `status` gains value `intent` (F6) | sowing-intent capture |
| `seller_inventory` | none — procurement increments existing rows (S3) | |
| `fpo_pools` | unchanged; new `fpos` registry deferred to A8 (P1 console) | |

## farm_tasks (F5)
- **Doc ID:** `{userId}_{YYYY-MM-DD}_{seq}` (deterministic per day, materialized by job).
- **Security:** owner read; service write (materialize job + complete/snooze endpoints).

| Field | Type | Notes |
|---|---|---|
| userId | string (uid) | |
| date | string `YYYY-MM-DD` | |
| title, whyNow | string | localized at generation |
| source | string `cropStage/weather/schemeDeadline/manual` | |
| cropCycleId | string? | |
| status | string `pending/done/snoozed` | |
| note | string? | completion note |
| snoozedUntil | string? `YYYY-MM-DD` | |
| completedAt | timestamp? | |
| createdAt | timestamp | |

- **Indexes:** `userId + date`; `userId + status + date`.

## produce_lots (F7)
- **Doc ID:** auto-id; public id `lot_{random}`.
- **Security:** farmer owner CRUD; public-read of `status=open` for farmer/seller/broker.

| Field | Type | Notes |
|---|---|---|
| farmerId | string (uid) | |
| crop | string | |
| quantityQuintals | double | |
| expectedRatePerQuintal | int | |
| harvestDate | string | |
| grade | string `faq/medium/bold` | |
| photoUrls | array<string> (Storage) | 1–4 |
| pickup | map{lat, lng, address} | |
| district | string | denormalized for browse |
| status | string `open/matched/sold/withdrawn` | |
| createdAt, updatedAt | timestamp | |

- **Indexes:** `status + crop + district`; `farmerId + status`.

## soil_tests (F9)
- **Doc ID:** auto-id; public `bookingRef` = `ST-YYYY-####` (counter doc `counters/soil_tests`).
- **Security:** owner read/create; admin/lab writes result.

| Field | Type | Notes |
|---|---|---|
| userId, plotId | string | |
| pickupDate | string | |
| sampleDepth | string `surface/subsurface` | |
| payment | map{mode, coinsRedeemed, amountRupees} | mode `coins/shcScheme/paid` |
| bookingRef | string | |
| status | string `booked/sampleCollected/atLab/resultReady` | |
| resultPdfUrl | string? (Storage) | uploaded by admin |
| createdAt, updatedAt | timestamp | |

- **Indexes:** `userId + createdAt`; `status + pickupDate` (lab ops).

## bank_accounts (F16; L6/S8 shared)
- **Doc ID:** auto-id.
- **Security:** owner CRUD; service updates verification; admin read.

| Field | Type | Notes |
|---|---|---|
| userId | string (uid) | |
| accountHolderName | string | |
| accountNumberEnc | string | encrypted at rest; API returns only `accountLast4` |
| accountLast4, ifsc, bankName | string | |
| accountType | string `savings/current` | |
| verificationStatus | string `pending/verified/failed` | penny-drop |
| verificationMethod | string `pennyDrop` | |
| failureReason | string? | name mismatch etc. |
| isPrimary | bool | exactly one per user (service-enforced) |
| createdAt, updatedAt | timestamp | |

- **Indexes:** `userId + isPrimary`.

## land_listings (L2)
- **Doc ID:** auto-id.
- **Security:** landlord owner CRUD; public-read of `status=live` (farmer browse).

| Field | Type | Notes |
|---|---|---|
| plotId, ownerId | string | plot must be `vacant` (service-enforced) |
| expectedRentPerMonth | int | |
| preferredDurationMonths | int | |
| terms | string? | |
| photoUrls | array<string> (Storage) | |
| district | string | denormalized from plot |
| status | string `live/paused/leased` | |
| requestCount | int | denormalized counter |
| createdAt, updatedAt | timestamp | |

- **Indexes:** `status + district`; `ownerId + status`.

## lease_requests (L3)
- **Doc ID:** auto-id.
- **Security:** farmer creates/reads own; landlord (listing owner) reads inbox + accept/reject.

| Field | Type | Notes |
|---|---|---|
| listingId, plotId | string | denormalized |
| farmerId, farmerName, farmerVillage | string | |
| landlordId | string | listing owner |
| intendedCrop | string | |
| durationMonths | int | |
| message | string? | |
| status | string `pending/accepted/rejected/withdrawn` | |
| rejectReason | string? | |
| leaseId | string? | set on accept |
| createdAt, updatedAt | timestamp | |

- **Indexes:** `landlordId + status + createdAt`; `farmerId + createdAt`; `listingId + status`.

## settlements (X10; T5/E6/B6 consumers)
- **Doc ID:** `stl_{role}_{uid}_{ISOweek}` (e.g. `stl_transport_uid9_2026W37`) — one doc per payee per week, idempotent run.
- **Security:** payee read own; admin read/write (approve/mark-paid); service write.

| Field | Type | Notes |
|---|---|---|
| role | string `transport/equipmentRental/broker` | |
| userId | string (uid) | payee |
| periodStart, periodEnd | string `YYYY-MM-DD` | ISO week |
| itemRefs | array<map{kind, refId, amount}> | trips/bookings/commissions |
| itemCount | int | |
| grossRupees, commissionRupees, netRupees | int | |
| commissionPct | double | from `app_config.settlement` |
| bankAccountId, bankAccountLast4 | string? | verified primary at run time |
| status | string `pending/approved/paid/onHold/failed` | onHold = no verified account |
| utr, paidOn | string? | |
| createdAt, updatedAt | timestamp | |

- **Indexes:** `userId + periodStart`; `status + role + periodStart`; `role + status`.

## seller_procurements (S3/S4)
- **Doc ID:** auto-id. Writes adjust `seller_inventory` and `produce_lots` in the same transaction.
- **Security:** seller owner CRUD; referenced farmer read (via `GET /market/lots/my` pendingPayments projection).

| Field | Type | Notes |
|---|---|---|
| sellerId | string (uid) | |
| farmerPhone, farmerName | string | |
| farmerId | string? | resolved when phone matches a user |
| crop | string | |
| lotId | string? | links a `produce_lots` doc |
| quantityQuintals | double | |
| ratePerQuintal, totalAmount | int | |
| slipPhotoUrl | string? (Storage) | weighbridge slip |
| paymentMode | string `cash/upi/udhaar` | |
| paymentStatus | string `paid/udhaar` | |
| paidOn, paidMode, utrNote | string? | set by mark-paid |
| date | string `YYYY-MM-DD` | |
| idempotencyKey | string? | |
| createdAt | timestamp | |

- **Indexes:** `sellerId + date`; `sellerId + paymentStatus`; `farmerId + paymentStatus` (farmer pending view).

## buyer_ledgers (S7)
- **Doc ID:** `{sellerId}_{buyerKey}` — one ledger per seller/buyer pair; entries subcollection `buyer_ledgers/{id}/entries/{autoId}`.
- **Security:** seller owner read/write.

| Field | Type | Notes |
|---|---|---|
| sellerId | string (uid) | |
| buyerKey | string | slug of normalized buyer name/phone |
| buyerName, buyerPhone | string / string? | |
| outstandingRupees | int | recomputed on every entry |
| lastPaymentOn | string? | |
| agingDays | int | computed at read |
| createdAt, updatedAt | timestamp | |

Entry subcollection fields: `{ type: sale/payment, refId?, amount (int, signed), balance, date, mode?, note?, createdAt }`.
- **Indexes:** `sellerId + outstandingRupees`.

## equipment_maintenance (E3)
- **Doc ID:** auto-id.
- **Security:** equipment owner CRUD.

| Field | Type | Notes |
|---|---|---|
| equipmentId, ownerId | string | |
| date | string `YYYY-MM-DD` | |
| type | string `service/repair` | |
| description | string | |
| costRupees | int | feeds owner P&L |
| engineHours | int? | |
| receiptUrl | string? (Storage) | |
| nextServiceDate | string? | drives reminder job |
| createdAt | timestamp | |

- **Indexes:** `equipmentId + date`; `ownerId + date`.

## addresses (X6)
- **Doc ID:** auto-id.
- **Security:** owner CRUD.

| Field | Type | Notes |
|---|---|---|
| userId | string (uid) | |
| label | string `home/farm/other` | |
| line, village, district, pincode | string | |
| phone | string | E.164 |
| isDefault | bool | one per user (service-enforced) |
| createdAt, updatedAt | timestamp | |

- **Indexes:** `userId + isDefault`.

## reviews (X7)
- **Doc ID:** `{productId}_{userId}` — one review per user per product (idempotent).
- **Security:** public-read; buyer creates own (delivered-order check in service); owner edit ≤48 h.

| Field | Type | Notes |
|---|---|---|
| productId, userId, userName | string | |
| orderId | string | proof of purchase |
| stars | int 1–5 | |
| text | string? | ≤280, server-truncated |
| photoUrl | string? (Storage) | |
| createdAt, updatedAt | timestamp | |

- **Indexes:** `productId + createdAt`. Write recomputes `products.rating`/`reviewsCount`.

## ratings (X8)
- **Doc ID:** `{bookingType}_{bookingId}` — one rating per booking.
- **Security:** booking owner creates; public-read of aggregates (summary endpoint); admin read.

| Field | Type | Notes |
|---|---|---|
| bookingType | string `transport/equipment/vet/workshop/talk` | |
| bookingId, raterId | string | |
| targetType, targetId | string | e.g. `vehicle`/`veh_9f2c`, `equipment`/`eq_4`, `vet`/`vet_2` |
| stars | int 1–5 | |
| tags | array<string> | |
| comment | string? | |
| createdAt | timestamp | |

- **Indexes:** `targetType + targetId + createdAt`; `raterId + createdAt`.

## reports (X9; A6 queue)
- **Doc ID:** auto-id.
- **Security:** any authenticated user creates; admin read/resolve; never visible to the reported user.

| Field | Type | Notes |
|---|---|---|
| reporterId, reportedUserId | string | |
| reason | string `spam/abuse/fraud/inappropriate/other` | |
| contextType | string `chat/deal/rate/profile` | |
| contextId | string? | |
| details | string? | |
| status | string `open/resolved` | |
| resolution | map{action, note, adminUid, at}? | action `dismiss/warn/disableUser/overrideRate` |
| createdAt | timestamp | |

- **Indexes:** `status + createdAt`; `reportedUserId + createdAt`.

## blocks (X9)
- **Doc ID:** `{blockerUid}_{blockedUid}` — idempotent.
- **Security:** owner (blocker) CRUD; service read for chat gating.

| Field | Type | Notes |
|---|---|---|
| blockerId, blockedId | string (uids) | |
| createdAt | timestamp | |

- **Indexes:** `blockerId` (single-field); `blockedId` (single-field).

## chats + messages (X2; also backs B2 deal rooms and F20-linked threads)
- **Doc ID:** auto-id. Messages subcollection `chats/{id}/messages/{autoId}`.
- **Security:** participants read/write via service; **Firestore rules exception** — participants may read `chats/{id}/messages` directly for listeners on Android (`infra/firestore.rules` gains a participants-read rule; writes stay backend-only). Blocked pairs rejected by service (`USER_BLOCKED`).

| Field | Type | Notes |
|---|---|---|
| participants | array<map{uid, name, role}> | 2 for direct; 3 for deal rooms |
| participantUids | array<string> | flat, for array-contains queries |
| contextType | string `direct/brokerDeal/transportBooking/produceLot` | |
| contextId | string? | dealId etc. |
| lastMessage | map{text, senderId, at}? | denormalized for chat list |
| unreadBy | map<uid, int> | per-participant unread counters |
| createdAt, updatedAt | timestamp | |

Message fields: `{ senderId, senderName, senderRole, type: text/image/system, text, attachmentUrl?, at }`.
- **Indexes:** `participantUids` (array-contains) + `updatedAt`; messages: `at` (single-field within subcollection).

## app_config (X12; X11 caps; A7 editor)
- **Doc ID:** singleton `global` (`app_config/global`).
- **Security:** public-read via `GET /app-config` (5-min Redis cache); admin write only.

| Field | Type | Notes |
|---|---|---|
| minSupportedVersion, latestVersion | string | semver |
| forceUpdate | bool | |
| playStoreUrl | string | |
| featureFlags | map<string, bool> | `inAppChat`, `sellProduce`, `speechEnabled`… |
| rateSanityBandPct | int | S2 band (default 15) |
| coinCaps | map{earnPerDay, redeemMaxPctOfOrder, referralRequiresFirstAction} | X11 |
| settlement | map{cycleDays, payoutWeekday, commissionPct: map<role,int>} | X10 |
| maintenance | map{active, message} | |
| changeHistory | array<map{adminUid, at, diff}> | A7 audit |
| updatedAt | timestamp | |

## consent_log (X17)
- **Doc ID:** auto-id. Append-only.
- **Security:** service write; owner read own; admin read; never update/delete.

| Field | Type | Notes |
|---|---|---|
| userId | string (uid) | |
| key | string `saturationShare/locationForAdvisory/marketingPush/voiceDataProcessing` | |
| value | bool | |
| source | string `app/admin` | |
| at | timestamp | |

- **Indexes:** `userId + at`.

## support_threads (F20)
- **Doc ID:** auto-id.
- **Security:** owner read/write (via service); expert/admin replies via console.

| Field | Type | Notes |
|---|---|---|
| userId | string (uid) | |
| chatbotSessionId | string? | originating handoff |
| topic, language | string | |
| status | string `open/answered/closed` | |
| assignedExpert | string? | |
| createdAt, lastMessageAt | timestamp | |

Messages reuse `chats`-style shape in subcollection `support_threads/{id}/messages/{autoId}`: `{ sender: user/expert, text, attachmentUrl?, at }`.
- **Indexes:** `userId + lastMessageAt`; `status + lastMessageAt` (console).

## cold_storage_bookings (F11)
- **Doc ID:** auto-id. Booking decrements warehouse capacity in a transaction.
- **Security:** farmer owner create/read/cancel; warehouse admin read.

| Field | Type | Notes |
|---|---|---|
| userId, warehouseId | string | |
| crop | string | |
| quantityQuintals | double | |
| durationWeeks | int | |
| startDate | string | |
| ratePerQuintalPerWeek, totalAmount | int | |
| status | string `requested/confirmed/active/completed/cancelled` | |
| idempotencyKey | string? | |
| createdAt, updatedAt | timestamp | |

- **Indexes:** `userId + createdAt`; `warehouseId + status`.

## buyer_requirements (B3)
- **Doc ID:** auto-id.
- **Security:** public-read of `status=open` (farmer/seller/broker); seller/broker owner CRUD.

| Field | Type | Notes |
|---|---|---|
| postedBy, postedByRole | string | |
| buyerName | string | |
| crop | string | |
| quantityQuintals | double | |
| targetRatePerQuintal | int | |
| neededBy | string `YYYY-MM-DD` | auto-expire +3 days |
| district | string | |
| notes | string? | |
| status | string `open/matched/closed/expired` | |
| matchedLotId, matchedDealId | string? | |
| createdAt, updatedAt | timestamp | |

- **Indexes:** `status + crop + district`; `postedBy + status`.

## surveyors (A2 — P1; fields live on claims until then)
- **Doc ID:** auto-id.
- **Security:** admin CRUD; service read for assignment.

| Field | Type | Notes |
|---|---|---|
| name, phone | string | |
| districts | array<string> | coverage |
| active | bool | |
| assignedClaimIds | array<string> | current load |
| createdAt | timestamp | |

- **Indexes:** `districts` (array-contains) + `active`.

## notification_log (A4/A5/L5 audit trail)
- **Doc ID:** auto-id. Append-only.
- **Security:** service write; admin read.

| Field | Type | Notes |
|---|---|---|
| kind | string `fcm/sms/broadcast` | |
| type | string | X3 type (`rent_due`, `booking_request`…) |
| userId | string? | null for broadcast rows |
| broadcastId | string? | A4 |
| segment | map? | broadcast segment filters |
| title, body | string | |
| delivery | map{sent, delivered, failed}? | broadcast counts |
| refId | string? | deep-link target |
| status | string `sent/failed/queued` | |
| at | timestamp | |

- **Indexes:** `userId + at`; `kind + at`; `broadcastId`.

## deal_messages (B2) — decision: reuse `chats`
Deal rooms are `chats` docs with `contextType: "brokerDeal"`, `contextId: dealId` (see the `chats` collection above). No separate `deal_messages` collection; `GET/POST /broker/deals/{id}/messages` are typed views over the deal's chat.

---

## Scheduled maintenance jobs — additions (missing.md audit)

| Job | Frequency | Action |
|---|---|---|
| farm task materialize | daily 05:30 IST | generate `farm_tasks` for today from active `crop_cycles` stage dates + weather rules (F5) |
| rent reminder | daily 08:00 IST | FCM/SMS for due-soon and overdue lease months; writes `notification_log` (L5) |
| doc-expiry reminder | daily 07:00 IST | FCM at T-15 days; flip `vehicles.docStatus` at expiry (T7) |
| equipment service reminder | daily 07:30 IST | FCM 7 days before `equipment.nextServiceDate` (E3) |
| settlement accrue | nightly 02:00 | aggregate completed trips/bookings/commissions into weekly accruals (Redis) (X10) |
| settlement run | Monday 04:00 | materialize `settlements` docs for the closed week; `onHold` when no verified bank account (X10) |
| coins reconcile | nightly 03:30 | `users.agriCoins` vs `gamification_ledger` drift check → `admin_audit` (X11) |
| booking-request expiry | hourly | expire stale `requested` transport bookings (24 h) and `pending` equipment bookings (2 h before slot), release slots (T2/E2) |
