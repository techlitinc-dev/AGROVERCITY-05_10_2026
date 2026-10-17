# AGROVERCITY User Flows — Real-User Roleplay by Persona

> **Method.** Each persona below was roleplayed as a concrete, vernacular user (name, village,
> crops, real money amounts) walking the app end-to-end: onboarding → daily home → core money
> workflows → exceptions/disputes → support/admin touchpoints → settlement/payout. Every step
> cites the exact endpoint it calls — `endpoints.md` § numbers refer to the API spec at the repo
> root; steps that need an endpoint the backend does not have are marked **⚠️ MISSING**, and
> spec details with no API surface (locks, TTLs, OTP delivery) are flagged **⚠️** inline.
> Verified against the implemented route inventory (1,146 routes) and the router code; the
> consolidated list of everything still missing is in `agent_missing_endpoints.md`.
>
> **Audit date:** 2026-10-17 · **Personas:** 15 · **Sources:** `endpoints.md` §1–28,
> `features/*.md`, `plan/*.md`, `docs/superadmin-instructions/`, implemented-route inventory.

### Persona index

| # | Persona | Character | Journeys |
|---|---|---|---|
| 1 | Farmer / Kisan | see section | 18 |
| 2 | Farm Landlord | see section | 8 |
| 3 | Transporter | see section | 6 |
| 4 | Seller / Vyapari | see section | 10 |
| 5 | Equipment Owner | see section | 0 |
| 6 | Broker / Dalal | see section | 0 |
| 7 | Dairy Manager | see section | 12 |
| 8 | Instructor / Teacher | see section | 12 |
| 9 | Direct Buyer | see section | 10 |
| 10 | e-Market Customer | see section | 7 |
| 11 | Bank Manager | see section | 7 |
| 12 | Insurance Provider | see section | 8 |
| 13 | Cold Storage Provider | see section | 8 |
| 14 | Gaushala Manager + Vet | see section | 13 |
| 15 | Superadmin / Platform Ops | see section | 13 |

---
## 1. Farmer / Kisan
> Ram Patil, 42, 6-acre farmer from Saykhed village (Niphad taluka, Nashik, Maharashtra); kharif soybean + rabi wheat, 2 buffaloes & 1 desi cow, dairy member at Bhagirathi Dudh Sangh collection centre; wife Sunita uses women-mode and runs a papad unit. Cousin Vilas referred him.

---

### Journey 1: Pehli baar — onboarding, OTP aur MPIN (goal: account banwana + farm map)
1. App kholta hoon, splash ke baad language chunta hoon → `GET /v1/languages` (endpoints.md §3) — Marathi cards with audio greeting; `GET /v1/app-config?version=…&platform=android` (§1 conventions; plan §3) — no force-update, app opens.
2. "Kisan" card select karta hoon, star primary pe; Sunita ke liye bhi farmer profile (women mode baad me) → profiles multi-select, register wizard me bhejo → `POST /v1/auth/register` (§1; body me `profiles: ["farmer"], primaryProfile: "farmer", roleProfiles`, referralCode Vilas ka) — 400 `INVALID_REFERRAL_CODE` agar galat code; code ka koi pre-check endpoint nahi hai ⚠️ (plan §4), galati sirf register fail hone par dikhti hai.
3. OTP — yahan endpoints.md §1 jo `POST /v1/auth/otp/send` + `POST /v1/auth/otp/verify` likhta hai, woh backend me HAI HI NAHI (inventory verify) ⚠️. Asli flow: OTP **Firebase Phone Auth client-side** aata hai (SMS, ~30s resend countdown ⚠️ plan §5) → fresh idToken → `POST /v1/auth/firebase-verify` (plan/onboardoing_plan.md §4; inventory) — `{accessToken, refreshToken, isNewUser, user}`; 401 `INVALID_FIREBASE_TOKEN`. ⚠️ Dev me sirf `dev-`/`demo-` idToken bypass hai, production nahi (plan §10).
4. OTP verify hote hi MPIN set karta hoon (4 digit, 2 baar) → `POST /v1/auth/mpin/set` (plan §4; inventory) — ab phone+MPIN se login: `POST /v1/auth/login` (§1) — 404 `USER_NOT_FOUND` / 409 `MPIN_NOT_SET` / 401 `WRONG_MPIN`. Fingerprint login chahiye → ⚠️ MISSING — `POST /v1/auth/biometric` (§1 documents it; not in inventory).
5. Registration wizard: naam, state (Maharashtra), district Nashik, tehsil Niphad, village Saykhed, 6 acre slider, soil (black regur), irrigation (drip + borewell), crops soybean/wheat chips → crop suggestions ke liye `GET /v1/regions/crops?district=Nashik` (§3) — kharif/rabi mapping; village auto-detect ho to `GET /v1/geo/reverse?lat=&lng=` (§3) — language suggest karta hai.
6. Farm map step: khate ke 4 kone pin karta hoon → polygon area ~6.2 acre dikhta hai → `PUT /v1/users/me/farm-boundary` (§1) — `{farmBoundaryPoints, landAreaAcres, khasraNumber}`; Google Maps key na ho to honest disabled fallback, jhootha data nahi ⚠️ (plan §3).
7. T&C / privacy consent → `PUT /v1/users/me/consents` (§2-adjacent; inventory) — consent record; baad me `GET /v1/users/me/consents` se dekh sakta hoon.
8. Session refresh jab token expire ho → `POST /v1/auth/refresh` (§1) — rotated pair; logout → `POST /v1/auth/logout` (§1). Purane sessions dekhne `GET /v1/auth/sessions` / revoke `DELETE /v1/auth/sessions/{jti}` (inventory).

### Journey 2: Roz ka home — mausam, bhav, kaam (goal: din ka faisla)
1. Subah 6 baje home kholo → **⚠️ MISSING — `GET /v1/dashboard/home`** (§20 documents the single aggregated farmer home: weather + urgent task + vyapari rates + banners; no such route in code). App ko 3 calls fan-out karne padte hain:
2. `GET /v1/weather?lat=&lng=` (§5) — 28°C, kal barish 60% — "aaj spray mat karo" jaisa signal.
3. `GET /v1/tasks/today` (§5 family; inventory) — aaj ka urgent task (e.g. "Soybean: dhaan check — pest radar me haila alert"); task pura karke tick → `POST /v1/tasks/{task_id}/done` (§5 documents `POST /tasks/urgent/complete` — inventory me uske bajaye `/tasks/{id}/done` implemented hai; +50 AgriCoins ke saath) — `{agriCoinsEarned: 50, newBalance}`. Saare tasks `GET /v1/tasks` (inventory) ya `GET /v1/tasks/summary`, dismiss `POST /v1/tasks/{task_id}/dismiss`.
4. "Aaj ke bhav" widget → `GET /v1/mandi/vyapari-rates?crops=soybean,wheat` (§4) — soybean ₹4,650/quintal ▲, Nashik APMC, 2-ghante me refresh (06:00–20:00) ⚠️ refresh window spec se.
5. Bhav target cross ho to alert chahiye → `POST /v1/price-alerts` (§26; body `{crop: "soybean", targetPrice: 4800, above: true}`) — 422 agar crop ka mandi data nahi; rules `GET /v1/price-alerts` (§26; `currentModal`, `fired` — ek baar fire hokar `firedAt` persist ⚠️ once-only spec), delete `DELETE /v1/price-alerts/{id}`. Fire hone par `price_alert` notification (`/dashboard/p/mandi`).
6. Bell icon pe notifications → `GET /v1/notifications?page=&pageSize=` (§24) — `ntf_…` docs newest-first; padh liye → `PUT /v1/notifications/read-all` ya `POST /v1/notifications/{id}/read` (§24); preferences `GET/PUT /v1/notifications/preferences` (inventory).
7. Khabar/gyan → `GET /v1/news?category=` (§17), `GET /v1/videos?category=` (§17), `GET /v1/blogs?category=` + like/bookmark `POST /v1/blogs/{id}/like|bookmark` (§17). Expert talk register → `POST /v1/expert-talks/{id}/register` (§17; +25 coins).
8. Persona digest → `GET /v1/intelligence` (§26) — farmer activeProfile pe lots/sales digest (`mandi_up_for_your_crop`, `sold_below_mandi` insights; missing data omit, jhooth nahi ⚠️ spec).

### Journey 3: Sahi mandi, sahi daam — price discovery (goal: soybean kahan beche)
1. `GET /v1/mandi/prices?crop=soybean&district=Nashik` (§4) — Agmarknet/eNAM list: Nashik APMC modal ₹4,650, Lasalgaon ₹4,700, MSP ₹4,892 ⚠️ (MSP check `GET /v1/reference/msp`, inventory), trend + arrivals.
2. 15 quintal le jaana hai, kaunsi mandi safal? → `GET /v1/mandi/compare?crop=soybean&quantityQuintals=15&lat=&lng=` (§4) — per-mandi `{modalPrice, transportCost, netProfit}` ranked; AI smart-select bhi → `POST /v1/mandi/smart-select` (inventory; ai.B1) — same ranking server-side.
3. Itihaas/forecast dekh lo → `GET /v1/mandi/prices/history` (inventory), `GET /v1/mandi/forecast` (inventory; ai.C3) — "agle hafte 4,800 tak ja sakta hai".
4. Mandi directory filter → `GET /v1/mandi/list` (§4). District crop map → `GET /v1/regions/crops?district=Nashik` (§3).
5. Sabzi mandi me saturation risk? → `POST /v1/advisory/saturation` (§5; ai.B2) — `{sowingCount, riskLevel: yellow, predictedPrice, alternativeCrops}` — aggregate count only, privacy opt-in ⚠️ (§5).
6. Mandi chhod ke seedha buyer ko bechne ka option — Journey 4 dekho. Rates admin check karta hai (`POST /admin/mandi/sync` §28.4) — farmer ko admin call nahi karna.

### Journey 4: Soybean lot daalke direct buyer ko bechna (goal: 20 quintal @ ₹4,750 se upar)
1. Apna lot post karta hoon — "Soybean, 20 quintal, Grade A, expected ₹4,750/q" → `POST /v1/market/lots` (§23 lots family; inventory) — lot doc `open`; photo/quantity edit → `PUT /v1/market/lots/{lot_id}`, band karna → `DELETE /v1/market/lots/{lot_id}`.
2. Buyer demands dekhta hoon → `GET /v1/demands?crop=soybean&status=open` (§23; inventory me `/demands/browse` bhi) — Shree Foods Pvt Ltd ko 50 quintal chahiye, max ₹4,900/q; detail → `GET /v1/demands/{demand_id}` (§23).
3. Us demand par offer maarta hoon → `POST /v1/offers` (§23; inventory) — `{targetType: "demand", targetId, pricePerUnit: 4760, quantity: 20, message}` — 403 `OWN_DEMAND`; demand closed → 409 `DEMAND_CLOSED`; replay same offer → idempotent 200 ⚠️ (§23).
4. Buyer counter karta hai ₹4,720 → offer detail `GET /v1/offers/{offer_id}` (§23), meri list `GET /v1/offers/mine?filter=sent` (§23). Counter sirf **ek round** ⚠️ (§23: dobara counter → 400 `NEGOTIATION_CLOSED`). Counter accept → `POST /v1/offers/{id}/accept` — **purchase auto-banta hai** `confirmed` @ counter price (§23). Reject → `POST /v1/offers/{id}/reject`; khud wapas lo → `POST /v1/offers/{id}/withdraw` (§23).
5. Mere lot par aaye offers → `GET /v1/market/lots/{lot_id}/offers` (inventory); received offers → `GET /v1/offers/mine?filter=received` (§23).
6. Meri saari bikri → `GET /v1/purchases?role=farmer` (§23; inventory list confirmed) — `{data, page, total}`; detail `GET /v1/purchases/{purchase_id}` (§23).
7. Advance aaya? → `POST /v1/purchases/{id}/advance` (§23; amount ≤ total) — payment ledger me `advance` entry ⚠️ ledger-in-status-map spec (§23). Escrow → `POST /v1/purchases/{id}/escrow/fund` (inventory).
8. Pickup schedule → `POST /v1/purchases/{id}/pickup` (§23; date/vehicle/address), dispatch `POST /v1/purchases/{id}/dispatch`, deliver `POST /v1/purchases/{id}/deliver` — status machine `confirmed→advancePaid→pickupScheduled→inTransit→delivered→completed` ⚠️ (§23); inTransit ke baad cancel nahi ⚠️ (400 `INVALID_STATUS_TRANSITION`).
9. Handover OTP — gate pe OTP dikhata hoon → `GET /v1/purchases/{id}/handover-otp` (inventory), buyer verify → `POST /v1/purchases/{id}/handover/verify` (inventory) — OTP handover spec detail ⚠️.
10. Buyer QC kare toh grade dekho → `POST /v1/purchases/{id}/qc` (buyer side; §23) — partial reject → `qcDisputed`, `finalAmount = acceptedQty × agreedPrice` ⚠️ (§23); resolve → `POST /v1/purchases/{id}/resolve` (§23); QC photos `POST /v1/purchases/{id}/qc/photos` (inventory).
11. Baaki paisa → `POST /v1/purchases/{id}/pay` (§23; kind balance/full; zyada → 409 `PAYMENT_EXCEEDS_DUE`) — payment `method/reference` strings, Razorpay confirm `POST /v1/payments/verify` / `POST /v1/payments/razorpay/order|verify` (inventory).
12. Invoice after completion → `GET /v1/purchases/{id}/invoice` (§23; `INV-…` 404 until completed), receipt `GET /v1/purchases/{id}/receipt` (inventory). Buyer se baat → `GET /v1/purchases/{id}/chat-room` (inventory) + `POST /v1/chat/rooms/{room_id}/messages` (inventory) — order-bound thread server-side banta hai (`POST /v1/threads` admin/system only ⚠️ §28.28).
13. Buyer ko rate karo → `POST /v1/purchases/{id}/rate` (§23; `{target: "buyer", rating}`; completed-only 409 `NOT_COMPLETED`, ek baar 409 `ALREADY_RATED` ⚠️) — `rating.farmerToBuyer` purchase pe.
14. Quality proof chahiye → `POST /v1/post-harvest/grade` (§20; ai.B4) — photo se `{grade: A, uniformityPercent, recommendedPrice}`.

### Journey 5: Buyer contract par e-hastakshar (goal: wheat ka 10-quintal contract lock)
1. Shree Foods ne mujhe targeted contract bheja — notification aaya → `GET /v1/notifications` (§24), detail me deep-link `/dashboard/p/myContracts/{id}` ⚠️ path spec (§26).
2. Mere contracts → `GET /v1/contracts/mine?role=farmer` (§26) — `currentPrice` enriched: fixed → baseRate; mandiLinked → live mandi modal + premium ⚠️ (§26).
3. Detail + terms → `GET /v1/contracts/{contract_id}` (§7/§26) — 10 quintal wheat, weekly delivery, ₹2,780/q fixed, payment 7 din.
4. Open (untargeted) institutional contracts bhi browse kar sakta hoon → `GET /v1/contracts?status=open` (§7) — admin publish karta hai `POST /admin/contracts` (§28.7).
5. Maan liya → MPIN e-sign → pehle MPIN second-factor → `POST /v1/auth/mpin/verify` (inventory) → `POST /v1/contracts/{id}/accept` (§26; `{signatureData, consentTimestamp, mpin}`) — targeted: sirf main sign kar sakta hoon (403 otherwise), `offered→active`, buyer ko notify ⚠️ MPIN-gated e-sign (conventions). Pasand nahi → `POST /v1/contracts/{id}/decline` (§26) + reason.
6. Har delivery slot pe purchase auto-banta hai (buyer trigger karta hai `POST /contracts/{id}/deliveries` §26) — meri fulfilment list → `GET /v1/contracts/{id}/deliveries` (§26; `{slotDate, purchaseId, status, fulfilment{completed…}}`).

### Journey 6: Gadi book karna — produce Nashik se Vashi (goal: full FT-1..FT-8 chalaana)
1. Vehicle type + rate → `GET /v1/transport/vehicles` (§7) — pickup base ₹1,200 + ₹16/km; quote → `POST /v1/transport/fare-estimate` (§7; `{vehicleType, distanceKm: 170}`) — surge ≤1.5 cap ⚠️ (features/farmer-transporter_features.md baseline S11).
2. **Book Now / Book Later** (FT-1) → `POST /v1/transport/bookings` (§7; body `{vehicleType, distanceKm, pickup, drop, date, pickupTime: "2026-10-18T06:00", timeWindowMinutes: 120 (15–720 ⚠️)}`) — pickup reminder task dono taraf ⚠️ dedupe (FT-1). Instant option → `POST /v1/transport/instant-bookings` (inventory). Aas-paas gadi → `GET /v1/transport/nearby-vehicles` (inventory).
3. Transit insurance add-on (FT-6) — load value ₹1,00,000 declare karke opt-in → same `POST /v1/transport/bookings` with `{declaredValuePaisa, insuranceOptIn: true}` — premium = ceil(coverage × 0.8%), cap ₹5,00,000 ⚠️ config math (FT-6); value bina opt-in → 422 `DECLARED_VALUE_REQUIRED` ⚠️. ⚠️ Premium sirf trip pe *record* hota hai — collection tab hoga jab payments/escrow module aayega (spec F10 — spec me hi deferred, features/farmer-transporter_features.md FT-6). Fare bharne ka dedicated farmer-payment endpoint bhi wahin tak deferred ⚠️.
4. Auction chahiye toh open load → `POST /v1/transport/loads` (inventory; `pickupTime` supported FT-1) — load board pe bids → `GET /v1/transport/loads/{load_id}/bids` (inventory), counter-bid one-round `POST /v1/transport/loads/{load_id}/bids/{bid_id}/counter`, jeetne wala → `POST /v1/transport/loads/{load_id}/accept-bid` (inventory) — booking `pickupTime` inherit ⚠️ FT-1.
5. Trip live — transporter accept karta hai (`PATCH /v1/transport/bookings/{id}` transporter side §7), chat tabhi unlock ⚠️ no-contact rule (features doc compliance). Track → `GET /v1/transport/bookings/{id}/location` (inventory); khud ping bhejo → `POST /v1/transport/bookings/{id}/location` (inventory; manual ping only, no GPS telematics ⚠️ S16).
6. Loading me deri — gadi 2 ghante khadi rahi → **waiting charges** (FT-2) → `POST /v1/transport/bookings/{id}/waiting` (§FT-2; `{phase: "pickup", action: "start"}` phir `"stop"`) — 60 min free, phir ₹150/30-min slab, cap ₹2,000 ⚠️ defaults (FT-2); `detention_recorded` notification; summary me `{pickupChargePaisa, totalMinutes}`.
7. Bhaiya ko link bhejo — **trip sharing** (FT-7) → `POST /v1/transport/bookings/{id}/share` (§FT-7) — public token link, 48 h TTL ⚠️; dobara share → token rotate, purana revoke ⚠️. Sunita bina account dekhti hai → `GET /v1/transport/shared/{token}` (§FT-7; login-free, sanitized — koi phone/fare nahi ⚠️ compliance-by-construction). Band karna → `DELETE /v1/transport/bookings/{id}/share` (§FT-7; expired → 410 `SHARE_EXPIRED`).
8. Mandi gate pe queue — drop phase waiting → `POST /v1/transport/bookings/{id}/waiting` `{phase: "drop"}` (sirf `enRoute` pe allowed ⚠️ FT-2 phase guard).
9. POD — driver ko 6-digit OTP bolta hoon jo receiver kehta hai → `GET /v1/transport/bookings/{id}/pod-otp` (inventory), verify → `POST /v1/transport/bookings/{id}/verify-pod-otp` (inventory) — status `delivered`; dono taraf rating prompt ⚠️ FT-3.
10. Mujhe transporter ko rate karna hai → `POST /v1/ratings` (inventory; `{bookingKind: "transport", bookingId, stars: 5, comment}` — delivered-only 409 `NOT_COMPLETED`, ek baar 409 `ALREADY_RATED` ⚠️; comment moderation scan). Meri shipper reputation transporter ko dikhti hai → `GET /v1/transport/farmers/{uid}/reputation` (FT-3; aggregate only). Transporter bhi mujhe rate karta hai `POST /v1/transport/bookings/{id}/rate-farmer` (FT-3; tags `load_ready_on_time` etc.) — meri `farmerRatingStats` user doc pe.
11. Digital bilty + weighbridge → `GET /v1/transport/bookings/{id}/bilty` (inventory; detention line + insurance line ke saath ⚠️ FT-2/FT-6), weigh slip → `POST /v1/transport/bookings/{id}/weighbridge` (inventory; gross/tare/net photo).
12. **Damage dispute** — 3 bag phat gaye → `POST /v1/transport/bookings/{id}/damage-disputes` (inventory; insured trip pe auto `insuranceClaim: true` + coverage snapshot ⚠️ FT-6) — meri disputes `GET /v1/transport/bookings/{id}/damage-disputes`; admin resolve karta hai `POST /v1/admin/disputes/{id}/resolve` (§28) / `PUT /admin/transport/bookings/{id}/status` (§28.8) — main sirf evidence deta hoon.
13. **Cancel karna pade** (FT-8) → `POST /v1/transport/bookings/{id}/cancel` (§FT-8) — slot se pehle 24 h+ → free; 24 h ke andar → 10% penalty; aakhri 2 h → 25% ⚠️ tiered spec (FT-8) — penalty ka 50% transporter compensation, 50% platform ⚠️; `requested` status se cancel → hamesha free. Mere dues/penalties → `GET /v1/transport/ledger/mine` (§FT-8; `{platformDuesPaisa, penaltiesChargedPaisa}`).
14. Achha transporter tha → **favorite** → `POST /v1/transport/favorites/{transporter_id}` (§FT-4; toggle `{favorited}`, 404 agar registered transporter nahi), list → `GET /v1/transport/favorites` (§FT-4; name snapshot only, no phone ⚠️ compliance). Ek-tap **rebook** → `POST /v1/transport/bookings/{id}/rebook` (§FT-4; sirf delivered/cancelled clone, fresh date required, fare current rates se recompute ⚠️ no stale price).
15. Weekly Nashik→Vashi run — **load template** (FT-5) → `POST /v1/transport/load-templates` (§FT-5; route, crop onion, 15 quintal, repeatWeekday) — list `GET /v1/transport/load-templates`, delete `DELETE /v1/transport/load-templates/{id}`, aur naya load → `POST /v1/transport/load-templates/{id}/repeat` (§FT-5; `{pickupDate, targetFare?}`, open load board pe, `useCount++`).

### Journey 7: Khaata-kitaab — diary, P&L, break-even (goal: per-crop asli laabh)
1. Roz ka kharcha — "DAP ₹3,200, diesel ₹900" → `POST /v1/diary/entries` (§8; `{title, category, type: "expense", amount, date, cropName: "soybean"}`) — 201 + `{agriCoinsEarned: 15}` ⚠️ coin rule (§8). List → `GET /v1/diary/entries?type=&category=&from=&to=` (§8; paged, newest first); edit `PUT /v1/diary/entries/{id}` (404 `ENTRY_NOT_FOUND`); delete `DELETE /v1/diary/entries/{id}`.
2. Bill ki photo chipkata hoon → `POST /v1/diary/entries/{id}/photos` (§8; 1–3 files, ≤5 MB jpeg/png/webp ⚠️) ya seedha receipt-scan → `POST /v1/diary/receipt-scan` (inventory; ai.C2).
3. Mahine ka hisaab → `GET /v1/diary/analytics/summary?from=&to=` (§8; byCategory/byCrop/byMonth; Redis cache 5 min ⚠️); PDF kisan mitra ko dikhane → `GET /v1/diary/report?from=&to=` (§8).
4. P&L cards → `GET /v1/pnl/summary` (§8; grossIncome/productionCost/netProfit) — mere pnl-cashflow.csv jaisa month-wise trend (`GET /v1/pnl/dashboard`, inventory; export `GET /v1/pnl/export/tally`, `GET /v1/pnl/report.pdf`).
5. Per-crop → `GET /v1/pnl/crops` (§8; soybean: area 6, yield 44 q, ROI%) — kharcha add → `POST /v1/pnl/crops/{id}/expenses` (§8).
6. Break-even — "kam se kam kitne me bechein?" → `POST /v1/pnl/break-even` (§8; `{totalCost, expectedYieldQuintals}`) — `minSafePricePerQuintal` ₹4,410 nikla → mandi ₹4,650 — safe ⚠️ calc spec.

### Journey 8: Yantra (equipment) slot — rotavator booking (goal: wheat ki taiyari time pe)
1. Machines browse → `GET /v1/equipment?type=rotavator&lat=&lng=` (§14; `{id, name, ownerType: fpo/private, hourlyRate, distanceKm}`) — FPO wali prefer, private verified (`PUT /admin/equipment/{id}/verify` §28.9 admin ka kaam).
2. Slots → `GET /v1/equipment/{id}/slots?date=2026-10-19` (§14; 4 default 4-h slots 6–10/10–2/2–6/6–10 ⚠️ slot template) — slot free hai.
3. Book → `POST /v1/equipment/slots/{id}/book` (§14) — **din me max 2 slots, teesri → 409** ⚠️; FPO-owned auto-confirm, private pending; response me `{booking, status, agriCoinsEarned: 50}` ⚠️.
4. Full ho toh waitlist → `POST /v1/equipment/slots/{id}/waitlist` (§14). Cancel → `DELETE /v1/equipment/bookings/{id}` (§14; start se 2 h pehle tak, owner ko SMS ⚠️).
5. Mere saare bookings (transport+equipment) → `GET /v1/users/me/bookings` (inventory).
6. Booking contract → `GET /v1/equipment/bookings/{id}/contract` (inventory) + e-sign `POST /v1/equipment/bookings/{id}/contract/esign` (inventory); check-in `POST /v1/equipment/bookings/{id}/check-in`; payment record `POST /v1/equipment/bookings/{id}/payments`; invoice `GET /v1/equipment/bookings/{id}/invoice`. Machine kharab nikli → dispute `POST /v1/equipment/bookings/{id}/disputes` (inventory).

### Journey 9: Loan — sprayer + seeds ke liye ₹40,000 (goal: 9-mahine ka sasta loan)
1. Mera score → `GET /v1/finance/credit-score` (§11; kisanCreditScore, tier, factors — RBI-compliant display ⚠️).
2. EMI sochna → `POST /v1/finance/loan-calculator` (§11; `{amount: 40000, tenureMonths: 9, interestRate: 7}`) — EMI ~₹4,640, total interest.
3. Bank account jodna — pehle list → `GET /v1/bank-accounts` (§21; masked `XXXX`+last4) — khaali hai to add → `POST /v1/bank-accounts` (§21; `{accountHolder, accountNumber: 9–18 digit, ifsc, bankName}`) — first auto-primary; penny-drop verify → `POST /v1/bank-accounts/{id}/verify`; primary change `POST /v1/bank-accounts/{id}/set-primary`. (⚠️ inventory `/tmp/implemented_endpoints_v2.txt` me bare GET/POST `/bank-accounts` rows missing the — mechanical extractor bare `""` routes chhod deta hai; code `routers/bank_accounts.py` me `@router.get("")`/`@router.post("")` verify kiya.)
4. Apply → `POST /v1/finance/loans/apply` (§11; `{amount: 40000, tenureMonths: 9, purpose: "inputs", bankAccountId}` — galat id → 404 `BANK_ACCOUNT_NOT_FOUND`; applicationNumber `LN-2026-####` ⚠️ human-readable spec) — 201 `{applicationId, status: "submitted"}`.
5. Status track → `GET /v1/finance/loans` (§11) / `GET /v1/loans/{applicationId}` (§11b; timeline ke saath). Bank manager `POST /loans/{id}/info-request` kare → mujhe notification → jawab → `POST /v1/loans/{id}/respond` (§11b; sirf owner farmer). Documents maange toh → `POST /v1/loans/{id}/documents` (§11b; multipart ≤5 MB).
6. EMI schedule → `GET /v1/loans/{applicationId}/schedule` (§11b; reducing-balance, due 1st monthly ⚠️). Man kare toh cancel → `POST /v1/loans/{id}/cancel` (§11b; submitted/infoRequested se hi).
7. KCC → `GET /v1/finance/kcc` (§11; `{bankName, cardNumberMasked, kccLimit, availableLimit}`).
8. Disbursal ke baad paisa seedha bank account me (bankManager `POST /loans/{id}/disburse` §11b — uska kaam, mujhe FCM).

### Journey 10: Bima — PMFBY apply, claim, appeal (goal: muhavza pakka)
1. Kaunsa policy chahiye → `GET /v1/insurance/schemes` (§12; PMFBY/RWBCIS/Pashu Dhan/Solar Pump Shield) — premium rate → `GET /v1/insurance/rates?season=kharif&crop=soybean` (§12); calculator → `POST /v1/insurance/premium-calculator` (inventory).
2. Apply → `POST /v1/insurance/policies/apply` (§12; `{cropName: "soybean", season: "kharif", landAreaAcres: 6}`) — automated risk scoring se underwriting ⚠️ (§12).
3. Meri policies → `GET /v1/insurance/policies` (§12; `{policyNumber, sumInsured, farmerPremium, status, coverageStartDate}`) — certificate PDF → `GET /v1/insurance/policies/{id}/certificate` (§12).
4. Achanak ole (hail) ne 40% crop maari — **72 ghante ke andar intimation** ⚠️ (§12) → `POST /v1/insurance/claims` (§12; multipart `damagePhotos[]`, `{policyId, calamityType: "hailstorm", dateOfDamage, cropStage, estimatedLossPercent: 40, gpsCoordinates, village}`) — claimNumber `CLM-2026-KH-####` ⚠️, status `intimated`, surveyor assigned.
5. Tracker → `GET /v1/insurance/claims` / `GET /v1/insurance/claims/{id}` (§12; surveyorName/phone ⚠️ numbers visible here, visitDate, timeline, approvedAmount, `dbtTransactionId`, `bankAccountLast4` — isiliye bank account zaroori).
6. Company ne reject kar diya → **appeal** → `POST /v1/insurance/claims/{id}/appeal` (§12; justification + naye evidence). Provider side (`/insurance/provider/*` §12) company ka hai; >₹50,000 payout pe admin maker-checker ⚠️ (§28 header).

### Journey 11: Saat-baarah (7/12) — zameen ka record (goal: profile auto-fill + proof)
1. Gat number se dhoondo → `GET /v1/land-records/search?gatNumber=112&district=Nashik&type=712` (§13; ya village fuzzy min-3-char) — `LandRecord712[]`: ownerName "Ram Patil", area 2.5 hectare, khata, cropHistory; multi-match → disambiguation ⚠️ (§13). Source: mahabhulekh/Aaple Sarkar ⚠️ external integration (§Ext).
2. PDF dekho/download → `GET /v1/land-records/{id}/pdf` (§13).
3. Profile me auto-store → `POST /v1/land-records/{id}/import` (§13; area/owner/soil/crop-history → farm profile & P&L) — baad me admin audit `GET /admin/land-records/audit-log` (§28.16).

### Journey 12: Sarkari yojana + vault (goal: PM-KISAN jaisi scheme pakadna, kagaz ek jagah)
1. Meri eligibility → `GET /v1/schemes?eligibleOnly=true` (§10; server-side eligibility from profile) ya AI matches → `GET /v1/schemes/matches` (inventory; ai.B15) — `{name, benefitAmount, documentsRequired, nextDeadline}`.
2. Detail → `GET /v1/schemes/{scheme_id}` (§10-adjacent; inventory); apply in-app → `POST /v1/schemes/{scheme_id}/apply` (§10; `{documentIds[]}` vault docs se).
3. Bahar ki portal links → `GET /v1/schemes/portals` (§10; pmkisan.gov.in, pmfby.gov.in, pmkusum…).
4. Vault me kagaz → `POST /v1/vault/documents` (§10; multipart, AES-256 at rest, Aadhaar kabhi log nahi ⚠️ §10), list `GET /v1/vault/documents`, delete `DELETE /v1/vault/documents/{id}`. KYC status → `GET /v1/kyc/status` (inventory); KYC case → `POST /v1/kyc/cases` + doc upload `POST /v1/kyc/cases/{case_id}/docs/{doc_id}/upload` (inventory) — admin verify karta hai `POST /admin/kyc/{id}/verify` (§28.3).

### Journey 13: Paani — water intelligence (goal: borewell + canal slot sahi)
1. Plot-wise sinchai → `GET /v1/water/schedule` (§9; `[{plotName, moisturePercent, recommendedMinutes, method}]` — soybean plot 41%, 90 min drip.
2. Groundwater → `GET /v1/water/groundwater?district=Nashik` (§9; CGWB `{depthMeters, zone}` — semi-critical dikha toh wheat pe drip).
3. Canal rotation → `GET /v1/water/canal-rotation?canal=Gangapur` (§9; nextDate + slotTime).
4. PM-KUSUM drip subsidy → `POST /v1/water/pmksy-calculator` (§9; `{acres: 6}` — 55% subsidy ⚠️ fixed rate) — `{totalCost, subsidyAmount, farmerShare}`.
5. Soil health — test book → `POST /v1/soil-tests/book` (inventory; §28.11 admin lab result `POST /admin/soil-tests/{id}/results` se report aati hai, mujhe notify).

### Journey 14: Sunita ka women mode + gruh udyog (goal: SHG + papad unit mall me)
1. Women mode toggle → `PUT /v1/users/me/settings` (§2; `{womenMode: true, language: "mr"}`).
2. SHG — "Saykhed Mahila Bachat Gat" → `GET /v1/women/shg` (§20; `{memberCount, corpus, loanFund, monthlyDeposit}`), meeting deposit → `POST /v1/women/shg/deposit` (§20; `{amount}`), meetings `GET /v1/women/shg/meetings` (inventory; attendance/collections centre-side). SHG registration → `POST /v1/women/shg` (inventory) — admin verify `POST /admin/women/shgs/{id}/verify` (§28.24).
3. Nutrition garden → `GET /v1/women/garden-plans` (§24; palak/methi/tandul categories) — plan save `POST /v1/women/garden-plans` (inventory); backyard pashu → `GET /v1/women/backyard-livestock` (§24; cow/buffalo/hen/goat + vaccineDue dates).
4. Papad unit register → `POST /v1/gruh-udyog/units` (§27; 409 `UNIT_ALREADY_EXISTS` — ek user ek unit) — `{name: "Sunita Papad Ghar", category, village}`; meri unit → `GET /v1/gruh-udyog/units/me` (§27).
5. Product add → `POST /v1/gruh-udyog/units/{id}/products` (§27; draft) — batch record `POST /v1/gruh-udyog/products/{id}/batches` (§27; `addToStock: true` se stock++).
6. **Food category = FSSAI gate** ⚠️ (§27): publish se pehle verified FSSAI cert chahiye → `POST /v1/gruh-udyog/units/{id}/certifications` (§27; `{type: "fssai", number, validUntil}`, status pending) — publish → `POST /v1/gruh-udyog/products/{id}/publish` (§27; stock>0 422 `STOCK_REQUIRED`, food without FSSAI → 403 `FSSAI_REQUIRED` ⚠️) — product ab `GET /v1/products` (§6) me `source: "gruh_udyog"` ke saath dikhta hai, cart/orders normal.
7. Uska order aaya → `GET /v1/gruh-udyog/units/{id}/orders` (§27) → accept `POST /v1/gruh-udyog/orders/{id}/accept` (§27; price-lock `itemsTotal`) → status chain `POST /v1/gruh-udyog/orders/{id}/status` (§27; accepted→packed→shipped→delivered, skip → 409 `BAD_TRANSITION` ⚠️). Offer/discount → `POST /v1/gruh-udyog/products/{id}/offers` (§27; 1–90%, live price turant reprice ⚠️). Dashboard → `GET /v1/gruh-udyog/units/{id}/dashboard` (§27).
8. Ghar ka chhota kharcha mall se → `GET /v1/products?category=seeds` (§6) → cart `POST /v1/cart/items` (§6) → coupon `GET /v1/coupons` + validate `POST /v1/coupons/validate` (§22) → order `POST /v1/orders` (§6/§22; `paymentMethod: upi/cod/bnpl`, couponCode, stock check 409 `OUT_OF_STOCK` ⚠️) — payment `POST /v1/payments/order` + `POST /v1/payments/verify` (inventory). Track → `GET /v1/orders/{id}` + timeline `GET /v1/orders/{id}/timeline` (§22); cancel `POST /v1/orders/{id}/cancel` (§22), return `POST /v1/orders/{id}/return` (§22; delivered-only 409 `RETURN_NOT_ALLOWED` ⚠️). Certificate scan → `GET /v1/products/{id}/certificate` (§6; QR Agmark authenticity).

### Journey 15: Dairy + pashu (goal: doodh ka paisa + bhains ka ilaaj)
1. Meri membership center ne banayi (`POST /livestock/dairy/members` dairyManager §16 — secretary ka kaam ⚠️; `farmerUid` link) — mera dairy home → `GET /v1/dairy/farmer/home` (inventory).
2. Rate pata karo → `GET /v1/livestock/dairy/rate-chart?species=buffalo` (§16; mere center ka chart pehle ⚠️ resolution rule) — preview → `POST /v1/livestock/procurement/rate-calc` (§16; `{milkType, fatPercent, snfPercent, liters}` → `{ratePerLiter, totalAmount, formula}`).
3. Aaj ka slip → `GET /v1/livestock/dairy/farmer/slips?dateFrom=&dateTo=` (§16; `memberCode` + SLIP-… numbers, FAT/SNF) — khud bhi record kar sakta hoon `POST /v1/livestock/procurement/collections` (§16) / `GET /v1/livestock/procurement/collections?farmerCode=` (own scope ⚠️).
4. Paisa aaya? → `GET /v1/livestock/dairy/farmer/payments` (§16; payment entries) — 6-mahine analytics → `GET /v1/livestock/dairy/farmer/analytics` (§16; `{monthly[], totals{liters, amount, paid, pending}}`). Center batch `POST /livestock/dairy/payments/batches/{id}/mark-paid` (§16) se FCM aata hai.
5. Bhains bimaar → `GET /v1/vets?lat=&lng=&emergency=true` (§16; 24×7 flag) → book `POST /v1/vets/{id}/book` (§16; `{visitType: farm, slot, animalType}`) ya appointment API `POST /v1/livestock/appointments` (§16; vet schedule validate, FCM vet ko). Mere appointments → `GET /v1/livestock/appointments` (§16); cancel `POST /v1/livestock/appointments/{id}/status` (§16; sirf requested/confirmed ⚠️).
6. Pashu register → `POST /v1/livestock/animals` (inventory; `{tagNo, species, breed}`) — vaccination campaign → `GET /v1/livestock/vet/campaigns` (§16) → enroll `POST /v1/livestock/vet/campaigns/{id}/enroll` (§16; own animal only 403, 409 `ALREADY_ENROLLED` ⚠️). Prescription → `GET /v1/livestock/prescriptions?animalId=` (§16; owner allowed).
7. Gaushala se khad → `GET /v1/gaushalas?district=Nashik` (§16) → order `POST /v1/gaushalas/{id}/manure-order` (§16; `{product, quantity}`). Dairy products bhi `GET /v1/dairy-products?category=` + `POST /v1/dairy-products/{id}/order` (§16).

### Journey 16: Profile switching, coins, referrals (goal: ek phone, saare kaam)
1. Ek aur profile jodna (jaise Sunita seller banegi) → `POST /v1/users/me/profiles` (§2; `{profileType}`) — switch → `POST /v1/users/me/profiles/{type}/activate` (§2; `defaultHomeRoute` milta hai); star primary → `PUT /v1/users/me/profiles/{type}/primary`; unlink → `DELETE /v1/users/me/profiles/{type}` — **aakhri profile nahi hat sakti → 409** ⚠️ "कम से कम एक प्रोफाइल आवश्यक है" (§2).
2. Persona home per profile → **⚠️ MISSING — `GET /v1/users/me/dashboard/{profileType}`** (§2; metric pills + quick actions + live activity — code me users.py me aisa route nahi).
3. Mera hisaab → `GET /v1/gamification/status` (§19; agriCoins, tier bronze→diamond ⚠️ thresholds, streak, badges[8]) — redeem → `POST /v1/gamification/redeem` (§19; catalog costs 300/500/800/1000 ⚠️; 400 `INSUFFICIENT_COINS`); history `GET /v1/gamification/ledger` (§19); leaderboard `GET /v1/gamification/leaderboard?period=month` (§19).
4. Vilas jaise kisan ko bulao → `POST /v1/referrals/invite` (§19; `{name, phone}` E.164) — turant +100 coins ⚠️; duplicate phone → 409 `ALREADY_INVITED`. Mera code/stats/leaderboard → `GET /v1/referrals` (§19; `{referralCode, shareLink, milestones 1→50/5→150/10→500 ⚠️}`).
5. Offline me likha kaam baad me sync → `POST /v1/sync` (§20 conventions; `{operations: [{idempotencyKey, method, path, body}]}` per-op results ⚠️). Sab writes pe `Idempotency-Key` header ⚠️ (conventions).

### Journey 17: Jab gadbad ho — support, dispute, privacy (goal: insaaf + control)
1. Kisan Mitra se poochho → `POST /v1/chatbot/messages` (§5; `{text, language: "mr", sessionId}` — OpenRouter LLM + Sarvam STT, 24 h session memory ⚠️ §5; quickReplies/richCard aate hain). History → `GET /v1/chatbot/history?sessionId=` (§5).
2. Bot kaam nahi aaya → human expert → `POST /v1/chatbot/expert-handoff` (§5; `{sessionId, reason}` — §5 me path `/chatbot/handoff` likha hai, implemented `/chatbot/expert-handoff` hai ⚠️ divergence) — `{expertName, contactChannel, etaMinutes}` + meri history/farm data expert ko. Ticket → `GET /v1/chatbot/expert-tickets` (inventory) / messages `POST /v1/chatbot/expert-tickets/{ticket_id}/messages` (inventory) — admin SLA queue `GET /admin/chatbot/handoffs` + assign (§28.12).
3. Seedha support ticket → `POST /v1/support/ask` (inventory). FAQ → `GET /v1/faq` (inventory; extractor me bare route nahi, code me `@router.get("")`).
4. Galat vyakti report → `POST /v1/users/{user_id}/report` (inventory); block → `POST /v1/users/me/blocks` (inventory) / list `GET /v1/users/me/blocks` / unblock `DELETE /v1/users/me/blocks/{user_id}`.
5. Mera data export (DPDP) → `POST /v1/users/me/data-export` (inventory) — latest → `GET /v1/users/me/data-export/latest`.
6. Profile update → `PUT /v1/users/me` (§2; village/crops/soil); full profile → `GET /v1/users/me` (§2/§24; hydration fields guaranteed even purane doc pe ⚠️ §24).

### Journey 18: Paisa bank tak — settlement/payout (goal: har rupaye ka pata)
1. B2B sale ka balance → `POST /v1/purchases/{id}/pay` (§23; kind balance/full) — Razorpay order `POST /v1/payments/razorpay/order` → verify `POST /v1/payments/razorpay/verify` (inventory); webhook server-side `POST /v1/payments/webhook` (inventory). Refund case → admin `POST /admin/marketplace/orders/{id}/refund` (§28.6; >₹10,000 maker-checker ⚠️).
2. Loan disbursal → bankManager `POST /loans/{id}/disburse` (§11b; `{disbursementRef}` — mujhe FCM + timeline).
3. Insurance payout → provider `POST /insurance/provider/claims/{id}/disburse` (§12; DBT `dbtTransactionId` + `bankAccountLast4` mere tracker me dikhta hai).
4. Doodh ka payment → center `POST /livestock/dairy/payments/batches/{id}/mark-paid` (§16; entries `paid` + FCM) — mera view `GET /livestock/dairy/farmer/payments` (§16).
5. Transport penalties/dues → `GET /v1/transport/ledger/mine` (§FT-8; `platformDuesPaisa` mera, compensation transporter ka).
6. Nightly settlement aggregation cron `POST /jobs/settlements/run` (§21; `X-Cron-Secret`) — transporter/equipment/broker ko `GET /{transport|equipment|broker}/settlements` (§21) milta hai; **farmer ko apna settlement statement endpoint nahi** — mera paisa purchases/dairy/loans ke apne trackers se hi dikhta hai ⚠️ (spec observation, not a farmer-blocking gap — farmer role §21 settlements me listed hi nahi).
7. Saal ka certificate/record — workshop certificate `GET /v1/courses/{course_id}/certificate` (inventory; agar koi workshop kiya), insurance certificate (§12), bilty (Journey 6), diary report (§8) — sab PDF/URL bank ke kagaz ban jaate hain.

---

## 2. Farm Landlord
> 58, village Khandala (taluka Wai, district Satara, Maharashtra). Owns 14 acres in 3 gat plots — गट 127 (4 acres, self-cultivated turmeric), गट 214 (6 acres, leased to Rajaram Pawar), गट 312 (4 acres, leased to Viju Jadhav). Also lists गट 312 for lease in the off-season. Speaks Marathi, trusts paper more than apps but keeps every receipt.

### Journey 1: Onboarding & KYC (becoming a verified landlord)

1. My nephew installs the app and enters my mobile number; OTP arrives by SMS → `POST /v1/auth/otp/send` (endpoints.md §1) — screen shows "OTP sent, valid 5 min". ⚠️ The 5-minute OTP TTL (`expiresInSec: 300`) and 30-sec resend lock are spec-level details; the endpoints don't expose how resend is enforced, I just see the countdown.
2. I enter the OTP → `POST /v1/auth/otp/verify` (§1) — app shows me as a new user, opens the registration wizard.
3. I fill my name "Sakharam Bhosale", village Khandala, tehsil Wai, district Satara, 14 acres, medium-black soil, borewell irrigation, crops turmeric/bajra/harbhara, and pick profiles: farmer + farmLandlord (farmer first, since I still farm गट 127 myself) → `POST /v1/auth/register` (§1) — logged in, ₹0 agriCoins.
4. The app asks for landlord KYC: Aadhaar, PAN, 7/12 extracts for all three gats, latest property-tax receipt, bank details → I open a KYC case → `POST /v1/kyc/cases` + `POST /v1/kyc/cases/{case_id}/docs/{doc_id}/upload` (implemented; §10 vault family) and keep the 7/12 PDFs in my vault → `POST /v1/vault/documents` (§10). I check status → `GET /v1/kyc/status`. The app says "Pending — title verification takes 48–72 hrs" (spec B.4 SLA).
5. I add my SBI account for payouts → `POST /v1/bank-accounts` + `POST /v1/bank-accounts/{account_id}/verify` (§21) — penny-drop verification flips it to `verified`; app shows only `XXXX4382`.
6. The agreement PDF, rent receipts and analytics are locked behind Pro (₹299/mo — the 402 `UPGRADE_REQUIRED` tells me so when I tap them), so I subscribe → `GET /v1/billing/plans` then `POST /v1/billing/subscribe` (implemented billing router). My invoices live at `GET /v1/billing/invoices`.

### Journey 2: Registering my plots and linking 7/12 records

1. I create my three plots one by one — name, village, acres, gat number, soil → `POST /v1/land/plots` (endpoints.md §21) ×3 — each comes back `status: vacant`. The app warns me my plan caps plot count (402 `ENTITLEMENT_EXCEEDED` if I exceed it).
2. On the 7/12 screen I search my gat numbers → `GET /v1/land-records/search?gatNumber=214&village=Khandala` (§13) — shows owner "Sakharam Bhosale", area 2.43 ha matching my 6 acres, crop history bajra/jowar. I import each record into my profile → `POST /v1/land-records/{record_id}/import` (§13), and download the official PDF for my file → `GET /v1/land-records/{record_id}/pdf` (§13).
3. I fix a spelling mistake in plot गट 312 ("Khndala" typo) → `PUT /v1/land/plots/{plot_id}` (§21). When I try deleting गट 214 after Rajaram's lease starts, the app refuses — 409 `PLOT_HAS_ACTIVE_LEASE` (§21) — good, that saved me from a mess.
4. Home screen every morning → `GET /v1/land/summary` (implemented landlord dashboard) — "14 acres owned, 10 acres leased, 2 active leases, ₹37,000 rent due this month, 1 pending request". (The generic persona home `GET /v1/users/me/dashboard/{profileType}` from §2 is not in the implemented inventory — landlord home is served by `/land/summary` instead.)

### Journey 3: Listing गट 312 for lease (and getting inquiries)

1. Ahead of rabi, I list गट 312: village, lat/lng pin on the boundary, 4 acres, expected rent ₹15,000/mo, water source borewell, soil medium-black, linked to my plot → `POST /v1/land/listings` (endpoints.md §21) — status `open`.
2. I upload 6 photos of the plot boundary and the borewell → `POST /v1/land/listings/{listing_id}/photos` (implemented) — app warns "no phone numbers visible in photos" (spec moderation).
3. I mark the months the land is available → `PUT /v1/land/listings/{listing_id}/availability` (implemented).
4. Unsure whether ₹15,000 is right, I tap "AI bhav suchana" → `GET /v1/land/price-suggestion` (implemented) — suggests ₹14,200–₹16,800 for 4 acres near Wai in this season; I keep ₹15,000.
5. Views aren't picking up in the sowing rush, so I boost the listing (paid) → `POST /v1/land/listings/{listing_id}/boost` (implemented) — it shows higher in `GET /v1/land/listings?near=17.95,73.70&acres=3` (§21) results.
6. Interested farmers save or waitlist my plot → `POST /v1/land/listings/{listing_id}/save` / `POST /v1/land/listings/{listing_id}/waitlist` (implemented); I see them under `GET /v1/land/waitlist/mine`-adjacent surfaces and my leads → `GET /v1/land/leads` + `POST /v1/land/leads/{lead_id}/notes` (implemented landlord CRM), so I note "call back after Diwali" — in-app only, no numbers shared (spec compliance C1–C4).

### Journey 4: Lease-request inbox, negotiation (max 5 rounds), and accepting

1. A request comes from Prakash Mane, wants गट 312 for 11 months → notification → `GET /v1/notifications` (§24; implemented in `notifications.py`, though the mechanical inventory only lists its read/mark-read siblings) — deep link opens the inbox → `GET /v1/land/lease-requests?status=pending` (§21) — his name, village, duration, message "will pay on 5th every month".
2. He offered ₹12,000 in his message; my listing says ₹15,000. I counter at ₹14,500 for 11 months → `POST /v1/land/lease-requests/{request_id}/counter` (implemented; §21 documents only accept/reject — inventory confirms counter exists) — the app shows "Round 1 of 5". ⚠️ Spec C4/E7: max 5 counter rounds then auto-close with 48-hr re-apply lock — the endpoint enforces 422 `MAX_ROUNDS_REACHED` at 5, but the 48-hr anti-spam re-apply timer is a spec detail I can't see in any response field.
3. Prakash counters twice more (rounds 2–3); we settle at ₹14,000. I accept → `POST /v1/land/lease-requests/{request_id}/accept` (§21) — app shows "Lease created: ₹14,000/mo, 11 months, plot marked leased", other pending requests auto-rejected, and a task "पट्टा ई-साइन बाकी" lands in my tasks.
4. ⚠️ MISSING — E-sign: the app tells me e-sign is pending, but there is no endpoint to actually sign the lease. The spec (L4, F5, C8) requires in-app e-sign with consent + audit trail; equipment bookings have `POST /v1/equipment/bookings/{booking_id}/contract/esign`, land leases have only the reminder task (`esign_pending` emitted at accept). → `POST /v1/land/leases/{lease_id}/esign` (suggested `{signatureData, consentTimestamp, mpin}`).
5. I download the lease agreement PDF (कृषि भूमि पट्टा अनुबंध) for my records → `GET /v1/land/leases/{lease_id}/agreement-pdf` (§21) — returns `{agreementUrl}`. Works only because I'm on Pro; on the free plan I'd get 402 `UPGRADE_REQUIRED`.
6. I also register my old tenant Rajaram directly (he doesn't use the app) → `POST /v1/land/leases` with his name and phone (§21) — plot गट 214 flips to `leased`, `verified: false`.

### Journey 5: Handover day and escrow milestones

1. On handover day I walk गट 312 with Prakash, tick the checklist — boundary stones, borewell motor, drip lines — attach 4 photos → `POST /v1/land/leases/{lease_id}/handover` (implemented; type `checkin`, checklist items with status) — Prakash gets an FCM "Handover inspection recorded". I review past inspections anytime → `GET /v1/land/leases/{lease_id}/handover` (implemented).
2. The escrow card shows three milestones: "Land Handover & Soil Verification 30%", "Mid-Season Cultivation Inspection 40%", "Harvest & Plot Handover 30%" → `GET /v1/land/leases/{lease_id}/milestones` (implemented) — amounts computed as 30/40/40… 30/40/30 of annual rent (₹50,400 / ₹67,200 / ₹50,400 on ₹14,000/mo). First milestone auto-shows `released` on startDate.
3. ⚠️ MISSING — Real escrow money: the milestones are only status labels I flip by hand → `POST /v1/land/leases/{lease_id}/milestones` with `{milestoneIndex, status: released}` marks them released, but **no rupees move**: there is no tenant-side escrow funding for leases (the only fund endpoint is `POST /v1/purchases/{purchase_id}/escrow/fund` for B2B produce), no payout to my bank, no commission deduction. Spec F6/C5/L5 (features/farm_farmlandlord.md) requires wallet-funded escrow released on milestones minus commission. → `POST /v1/land/leases/{lease_id}/escrow/fund` (tenant) and `POST /v1/land/leases/{lease_id}/milestones/{index}/release` (moves money + commission).
4. For my crop-share arrangement on गट 127 (I give a share to the labour family that works it), I log the harvest and settle → `POST /v1/land/leases/{lease_id}/harvest-declarations` + `POST /v1/land/leases/{lease_id}/harvest-declarations/{decl_id}/settle` (implemented) — the app computes the share split. (Covered, so no gap here.)

### Journey 6: Rent collection, dues, and reminders

1. 5th of every month: Rajaram pays ₹22,000 by UPI at my doorstep; I record it → `POST /v1/land/leases/{lease_id}/payments` `{amountRupees: 22000, month: "2026-10", method: upi}` (§21) — I try to record October twice by mistake and get 409 `DUPLICATE_PAYMENT_MONTH`. Prakash's ₹14,000 comes in-app… ⚠️ actually only as a manual record too (see Journey 5 escrow gap — no in-app rent payment endpoint exists; everything is landlord-entered).
2. I show Rajaram the receipt PDF → `GET /v1/land/rent-payments/{payment_id}/receipt` (implemented, Pro-gated) — he keeps it for his loan file.
3. My month-end accounting export for the CA → `GET /v1/land/leases/{lease_id}/ledger?format=pdf` (implemented, Pro-gated; CSV also available).
4. The app nags me about pending rent → `GET /v1/land/rent/dues` (implemented) — "₹14,000 pending from Prakash Mane for 2026-10". A nightly job → `POST /v1/jobs/rent-reminders/run` (implemented cron) — ⚠️ notifies only ME (the landlord); the code carries a TODO for the tenant SMS path, so Prakash gets no reminder unless he's an app user watching his own screen.
5. Notifications pile up → `GET /v1/notifications` + `POST /v1/notifications/{id}/read` (§24).

### Journey 7: Exceptions — dispute, non-payment, and walking away

1. Prakash misses October and November rent. I file a dispute → `POST /v1/land/leases/{lease_id}/disputes` (implemented) with `{category: "payment_default", note}` — app demands an `Idempotency-Key` (400 otherwise) and returns `dsp_…` status `open`. The record is consumable by the admin console → `GET /v1/admin/disputes` + `POST /v1/admin/disputes/{dispute_id}/resolve` (§28 console paths).
2. Spec C10/E5 wants evidence windows and escrow split per verdict (0/25/50/75/100%) — ⚠️ the admin resolve endpoint exists, but escrow-split mechanics don't (no lease escrow funds exist to split — same gap as Journey 5).
3. No resolution; admin arbitrates termination → `PUT /v1/admin/land/leases/{id}/terminate` (§28.10) — plot reverts to vacant, my listing reopens, waitlist auto-promotes the next farmer (I see `GET /v1/land/waitlist/mine` shrink). If I terminate myself instead → `POST /v1/land/leases/{lease_id}/terminate` (implemented) — same side effects, and a rating prompt opens so I can rate Prakash.
4. Renewal, the happier path: Rajaram's lease ends next month → he requests renewal → `POST /v1/land/leases/{lease_id}/renew` (implemented) shows up in `GET /v1/land/leases/{lease_id}/renewals`; I respond → `POST /v1/land/lease-renewals/{renewal_id}/respond` with new rent ₹23,500 — lease extended, no new paperwork trip.
5. Two-way ratings close the loop: Prakash rates my land → `POST /v1/land/listings/{listing_id}/reviews` (implemented; stars + aspects like water/soil/boundary, moderation-scanned); my prompt to rate him → `GET /v1/ratings/pending` then `POST /v1/ratings` `{bookingKind: "land_lease"}` (implemented rating-prompt flow).

### Journey 8: Money overview, settlement, and support

1. Year-end: is leasing worth it? → `GET /v1/land/profit-dashboard` (implemented) — rent collected ₹4,18,000, crop-share ₹62,000, plot expenses (repairs, fence ₹48,500 logged via `POST /v1/land/plots/{plot_id}/expenses`), net profit, month-wise CSV → `GET /v1/land/profit-dashboard/export` (implemented).
2. ⚠️ MISSING — Payout/settlement view: spec L5 promises "Escrow releases, commission breakdown, bank settlement history". `/land/profit-dashboard` is rent accounting only; the `/settlements` family (`/v1/transport/settlements`, `/v1/equipment/settlements`, `/v1/broker/settlements`) has no landlord member. → `GET /v1/land/settlements` (suggested).
3. Listing analytics → `GET /v1/land/analytics` (implemented, Pro-gated) — occupancy rate 67%, ₹36,000/mo active rent, reviews aggregate. ⚠️ But the `demandTrend` block (May–Oct demandScore/avgAcreRate) is hardcoded constants in the code, not platform events as spec L7 demands — the endpoint exists, the data behind it is fabricated.
4. My P&L and diary as a cultivator (गट 127 turmeric) → `GET /v1/pnl/summary`, `POST /v1/diary/entries` (§8, landlord role included).
5. Problems I can't solve: Kisan Mitra chatbot → `POST /v1/chatbot/messages`, and "connect me to a human" → `POST /v1/chatbot/handoff` (§5). To talk to Prakash about the borewell schedule — ⚠️ MISSING — there is no lease-bound chat: `POST /v1/chat/direct` accepts lotId/demandId/vehicleId/bookingId/quoteId/purchaseId, and its `listingId` branch resolves *resale* listings, not land listings. Spec L6/C6/D requires a locked→unlocked chat on lease confirmation. → `POST /v1/land/leases/{lease_id}/chat-room` (following the `GET /v1/purchases/{purchase_id}/chat-room` convention).
6. If my account ever gets locked or I want my data → support goes through the admin side (`GET /v1/admin/users/{uid}`, SOP-01/02); in-app I raise it via the chatbot handoff ticket.

---

## 3. Transporter

> Dattaram Shinde, 35, Ahmednagar (MH-16). Owns 1 tractor-trailer (12T, MH-16-AB-4471) + 1 pickup (1.5T, MH-16-CD-9034). Runs 8–12 trips/month: onion to Lasalgaon/Nashik APMC, maize to Pune Marketyard, sugarcane-season rush. Bids on load-board auctions when the rate smells right. Marathi-first, thumbs everything in the tractor cabin.

---

### Journey 1: Onboarding aur KYC — "पैसे मिळायचे असतील तर कागद पत्र पूर्ण" (money needs papers)

1. पहिल्यांदा app उघडतो — माझा नंबर टाकतो, OTP फोनवर येतो. ⚠️ OTP पाठवण्याचा/तपासण्याचा `POST /v1/auth/otp/send` + `/auth/otp/verify` (endpoints.md §1) हा रास्ता backend मध्ये नाही — OTP Firebase phone auth देतो आणि मी तो बदलतो `POST /v1/auth/firebase-verify` ने (implementation; inventory). Tokens + user मिळतो.
2. नाव-गाव भरतो — Dattaram Shinde, Ahmednagar — `POST /v1/auth/register` (endpoints.md §1) → user + JWT.
3. Transporter profile जोडतो: `POST /v1/users/me/profiles` `{profileType: "transport"}` (endpoints.md §2), मग `POST /v1/users/me/profiles/transport/activate` — app transport home उघडतो.
4. माझं business profile: `PUT /v1/transport/profile` — `businessName: "Shinde AgriFleet"`, `transporterType: "owner_driver"`, `operatingRoutes: ["Ahmednagar ➔ Lasalgaon", "Ahmednagar ➔ Pune Marketyard", "Ahmednagar ➔ Vashi"]`, `operatingStates: ["Maharashtra"]`, `specializations: ["कांदा", "मका", "धान्य"]`, `experienceYears: 9` (implemented; endpoints.md §7 मध्ये नाही — features/farmer-transporter_features.md baseline). ⚠️ T3 नुसार "home base radius" सेट करायचा असतो, पण profile मध्ये फक्त routes list आहे — radius चा पर्यायच नाही.
5. दोन्ही गाड्या नोंदवतो, एकदम:
   - `POST /v1/transport/vehicles` — tractor-trailer, `registrationNo MH-16-AB-4471`, `capacityTonnes 12`, `rcDocUrl` + `insuranceDocUrl` (vault मधल्या uploaded papers चे URL), `fitnessExpiry`, `insuranceExpiry`, `permitType: "State Permit"` (endpoints.md §7 `GET /transport/vehicles` catalog साठी; CRUD implemented).
   - पुन्हा `POST /v1/transport/vehicles` — pickup MH-16-CD-9034, 1.5T.
   - दोन्ही `docStatus: "pending"` ने जन्मतात — app वर "Docs under review" बॅज. ⚠️ Free plan वर vehicle-count entitlement check लागतो (`402 ENTITLEMENT_EXCEEDED` — Pro नंतर).
6. Personal KYC: `POST /v1/kyc/cases` (DL, Aadhaar, PAN case उघडतो) + `POST /v1/kyc/cases/{case_id}/docs/{doc_id}/upload` प्रत्येक कागदाचं photo; extra copies `POST /v1/vault/documents` (encrypted vault, endpoints.md §10). Admin कडून `POST /v1/admin/transport/vehicles/{id}/verify` (endpoints.md §28.8, SOP-08) — verified झाल्याशिवाय गाडी accept करू शकत नाही (खाली पहा).
7. Bank account जोडतो — `POST /v1/bank-accounts` `{accountHolder, accountNumber, ifsc, bankName}` → `POST /v1/bank-accounts/{id}/verify` penny-drop (endpoints.md §21) → `POST /v1/bank-accounts/{id}/set-primary`. हाच account नंतर settlements साठी. Profile ला `settlementUpi` पण टाकतो.
8. ⚠️ Verification ची वाट पाहतो: `GET /v1/transport/vehicles/my` वर `docStatus` रोज तपासतो. **Verified नसताना `POST /v1/transport/bookings/{id}/accept` → `422 VEHICLE_NOT_VERIFIED`** — म्हणजे KYC पूर्ण न करता एक रुपयाचं काम मिळत नाही. हे शहाणपणाचं आहे.
9. पहिला home: `GET /v1/transport/dashboard` (implemented, WS-02) — आजच्या trips, नवीन job requests, fleet status, `documentExpiries` (pickup चा insurance 23 दिवसात संपतोय — renewal ला हिरवी टीप), next settlement.

---

### Journey 2: काम शोधणं — load board वर बोली (the auction)

1. सकाळचा 7:30 चा चहा झाला की load board: `GET /v1/transport/loads?pickup=ahmednagar&crop=onion` (implemented; endpoints.md §7 मध्ये फक्त bookings आहेत — हा load-board/auction रास्ता inventory मध्ये आहे). 80 क्विंटल कांदा, Ahmednagar → Lasalgaon, उद्या सकाळची loading. ⚠️ Board **सगळ्यांसाठी एकच** — माझ्या गाडीच्या प्रकारानुसार/माझ्या गावच्या radius मध्ये match करून दिलेला personalised feed नाही (T3/T4 पूर्ण नाही); सगळं हाताने filter करावं लागतं.
2. बोली टाकण्याआधी माझा हिशेब: `POST /v1/transport/fare-estimate` `{vehicleType: "Tractor Trailer", distanceKm: 118}` → base ₹700 + ₹38/km × 118 + tollEstimate ₹230, surge 1.0 — breakdown card दाखवतो (endpoints.md §7; S11 surge cap ≤1.5 backend वर).
3. बोली: `POST /v1/transport/loads/{load_id}/bid` `{quotedFare: 4800, vehicleId: veh_tractor_trailer, etaHours: 5}` — `Idempotency-Key` header टाकतो (नाहीतर नेटवर्क गेल्यावर दुप्पट bid). 201 → bid `pending`.
4. `GET /v1/transport/loads/{load_id}/bids` — मी सर्वात कमी आहे का? 3 bids दिसतात (names + rating only — phone कुठेही नाही, T15).
5. Counter आलाच: FCM notification `bid_countered` — "मालकाने ₹4,300 चा counter प्रस्ताव पाठवला". ⚠️ counter हा **farmer-driven** आहे (`POST /loads/{id}/bids/{bid_id}/counter` फक्त load owner चालवू शकतो); मी counter price explicitly accept करण्याचा button नाही — accept झाल्यावर माझ्या मुळ `quotedFare` वरच booking उभी राहते, त्यामुळे counter वर चर्चा करायची असल्यास फक्त `POST /v1/chat/direct` (load-level negotiation chat, bidder↔owner) किंवा नंतरची trip chat.
6. जिंकलो! `booking_confirmed` notification — "आपकी ₹4,800 की बोली स्वीकृत हुई। ट्रिप तैयार है।" Booking थेट `accepted` मध्ये जन्मलेली: `GET /v1/transport/bookings/{booking_id}` — pickup/drop, 80 qtl कांदा, fare ₹4,800, `pickupTime` उद्या 06:30 (FT-1 slot — मला high-priority pickup reminder task येईल).
7. त्याच दिवशी instant job: job inbox `GET /v1/transport/bookings?status=requested` (endpoints.md §7) — 12 qtl मका, Ahmednagar → Pune Marketyard, ₹5,200, pickup चालू. `POST /v1/transport/bookings/{id}/accept` `{vehicleId: veh_pickup}` → booking `accepted`, `chat_unlocked` notification दोघांनाही. (नाही म्हटलं तर `POST …/reject` `{reason}` — पण cancel/reject pickup window मध्ये केलं तर strike लागतो; 3 strikes = load board बंद, `403 SUSPENDED_FROM_LOAD_BOARD`. ⚠️ माझी strike count कुठेही दिसत नाही — T11 चा penalty matrix/cooldown पाहण्याचा endpoint नाही.)
8. Chat: `GET /v1/chat/rooms` — `kind: "transport"` room booking शी बांधलेला; `POST /v1/chat/rooms/{room_id}/messages` — "साहेब, सकाळी ६ वाजता गाठ" (phone number टाकलो तर message block — D.3 regex).

---

### Journey 3: ट्रिप चालवणं — milestones, waiting, weighbridge, POD

1. सकाळी 05:45: `PATCH /v1/transport/bookings/{booking_id}` `{status: "enRoute"}` (endpoints.md §7) — farmer ला `trip_enroute` "गाड़ी निकली" notification.
2. Gate वर पोहोचलो: `POST /v1/transport/bookings/{id}/location` `{waypoint: "at_pickup", lat, lng}` — manual ping (S16: telematics नाही, हाताची टॅप). `loaded` ping नंतर — farmer ला milestone notifications.
3. मंडई gate च्या रांगेत 130 मिनिटं वाट पाहावी लागली → waiting timer: `POST /v1/transport/bookings/{id}/waiting` `{action: "start", phase: "pickup"}` … शेवटी `{action: "stop"}` (FT-2). हिशेब: 60 free + 70 min → 3 slabs × ₹150 = **₹450 detention**, cap ₹2,000. Farmer ला `detention_recorded` notification; हे रक्कम P&L आणि bilty दोघांत येतं.
4. Weighbridge: `POST /v1/transport/bookings/{id}/weighbridge` — slip photo, 80 qtl loaded; farmer notified `weighbridge_recorded`.
5. रस्त्यात in_transit pings: `POST …/location` `{waypoint: "in_transit", lat, lng}` — farmer `GET /v1/transport/bookings/{id}/location` वर माझा last ping + waypoint timeline पाहतो. (`GET /v1/transport/bookings/{id}` चं waypointsLog हेच सत्य.) कुटुंबाला tracking link: `POST /v1/transport/bookings/{id}/share` → `GET /v1/transport/shared/{token}` — fare/phone नाहीत, status + route + last ping only, 48h TTL (FT-7).
6. Lasalgaon येथे unloading ping `{waypoint: "unloading"}` → farmer ला notification. Drop waiting झाली तर `waiting` `{phase: "drop"}` (FT-2: फक्त `enRoute` मध्येच चालतं).
7. **POD**: app मध्ये 6-अंकी OTP दिसतो; farmer चा माणूस तो मला सांगतो, मी `POST /v1/transport/bookings/{id}/verify-pod-otp` `{otp}` टाकतो (FT: OTP-verified delivery, F8). Photos + receiver नाव शिवाय delivered होत नाही: `PATCH …` `{status: "delivered", podPhotos: [storage urls], receiverName: "संजय भोसले"}` — नाहीतर `422 POD_REQUIRED`. दोघांनाही rating prompts उघडतात.
8. मी farmer ला rate करतो: `POST /v1/transport/bookings/{id}/rate-farmer` `{stars: 5, review: "वजन बरोबर, loading वेळेवर", tags: ["accurate_weight", "load_ready_on_time"]}` (FT-3) — delivered-only, एकदाच. Farmer ची aggregate reputation `users` doc वर update होते — पुढच्या transporter ला `GET /v1/transport/farmers/{uid}/reputation` वर दिसेल.
9. रिकाम्या tractor ने परत नाही: `GET /v1/transport/trips/{trip_id}/return-loads` (T12) — drop district च्या आसपासचे open loads. Nashik मधून 6 qtl कांदा + काही Miscellaneous पुण्याला — `POST /v1/transport/loads/{id}/bid` ने तो return load घेतो; dashboard वरच्या `returnLoads` मध्ये हेच matches दिसतात.

---

### Journey 4: पैसे — खर्च, P&L, बिल्टी, settlement (10% कमिशन)

1. प्रत्येक खर्च त्या त्या वेळी: `POST /v1/transport/bookings/{id}/expenses` — diesel ₹2,300 → `POST …/expenses` toll ₹230 → `POST …/expenses` माझी bata ₹150. (endpoints.md §7 चं bookings shell; expenses implemented.)
2. ट्रिप P&L: `GET /v1/transport/bookings/{id}/expenses` — fare ₹4,800 + detention ₹450 = gross ₹5,250 − expenses ₹2,680 − **10% commission ₹480** (fare वरच) = **net ₹2,090** डोळ्यासमोर.
3. बिल्टी: `GET /v1/transport/bookings/{id}/bilty` (digital lorry receipt) — freight lines + detention + `balancePayable` + insurance block (farmer ने declared ₹40,000 केलं होतं, premium ₹320 recorded — FT-6). Phone numbers masked.
4. GST/compliance साठी: `GET /v1/transport/bookings/{id}/commission-invoice` — platform commission चा PDF invoice (₹480 @ 10%).
5. आठवड्याची तारीख: `POST /v1/jobs/settlements/run` हा रोज रात्री cron चालतो (Cloud Scheduler; मी हाताने call करत नाही). मग `GET /v1/transport/settlements` (endpoints.md §21) — 12–18 Oct: gross ₹38,400, commission ₹3,840, **net ₹34,560**, `sourceIds` मध्ये 9 trips, status `pending → approved → paid`.
6. माझी सगळी उधार-पेढी एका ठिकाणी: `GET /v1/transport/ledger/mine` (FT-8) — मंगळवारच्या farmer-cancel मधलं माझं compensation ₹600 (₹4,800 च्या 25% penalty ची 50% — `platform_ledger` मध्ये `comp_…` line), summaries: `compensationEarnedPaisa`, `platformDuesPaisa`.
7. **⚠️ MISSING — पैसे अजून हाताने येतात:** transport booking चा fare **कोणताही in-app payment/escrow नाही** — `POST /v1/transport/bookings/{id}/pay` सारखा endpoint अस्तित्वात नाही. Spec F10/S4 नुसार farmer ने confirm वेळी पैसे escrow मध्ये टाकायचे आणि POD वर release व्हायचे (T+48h auto-release) — ते backend मध्ये नाहीच (plan/transporters_plan.md §11; FT-6 ची honest scope note: "payments/escrow module — spec F10 still backend-absent"). प्रत्यक्षात मी मंडईत farmer कडून cash/UPI ने घेतो — platform वर फक्त fare चा आकडा. Payment dispute (E7) चा तर प्रश्नच नाही. **P0 gap.** Payout सुद्धा: bank account + settlement rows असले तरी `POST /v1/transport/payouts` सारखी "पैसे bank मध्ये पाठव" विनंत नाही — settlement `paid` हा finance admin `POST /v1/admin/settlements/{id}/mark-paid` ने offline mark करतो (endpoints.md §28.25). Wallet balance/TDS summary (T9) — नाहीच. **P0 gap.**

---

### Journey 5: अडचणी — cancel, dispute, no-show, breakdown

1. मीच cancel: तापाने अंथरुनात — `POST /v1/transport/bookings/{id}/cancel` `{reason: "आजारी — उद्या परत येईल"}` (implemented; farmer notify). पण pickup window मध्ये cancel = **strike** (`noShowStrikes` +1; 3 strikes = load-board suspension). ⚠️ strike count / cooldown कुठेही दिसत नाही (T11 gap).
2. Farmer cancel: शुक्रवारची Pune ची booking T−1h वर cancel — notification मध्ये "compensation credit ₹600" नावासकट; `GET /v1/transport/ledger/mine` वर `comp_…` line + farmer च्या `platformDuesPaisa` मध्ये penalty (FT-8 tiers: 24h च्या आत 10%, 2h च्या आत 25%).
3. Load तयारच नाही (E4): `waiting` start करून 2 तास झाले, `POST …/cancel` — farmer penalty चा उल्लेख notification मध्ये.
4. Damage claim: रस्त्यात पाऊस, 2 क्विंटल कांद्याच्या पोती ओली — farmer ने 24h च्या आत `POST /v1/transport/bookings/{id}/damage-disputes` `{claimPaisa: 180000, photos: [...]}` उघडला (F9; trip insured होता ⇒ dispute `insuranceClaim: true` auto-tag, coverage snapshot जोडला). मला notification; मी booking chat मध्ये माझी बाजू + tarpaulin photos टाकतो. ⚠️ माझे counter-evidence dispute record वर जोडण्याचा अलग endpoint नाही — chat/evidence हाच एकमेव रास्ता. Admin `POST /v1/admin/transport/bookings/{id}/status` family + dispute desk (`GET /v1/admin/disputes`, endpoints.md §28) मधून arbitrate करतो; `POST …/damage-disputes/{dispute_id}/resolve` हा admin-only lane.
5. **Breakdown (E11)**: tractor चा belt Sinnar जवळ तुटला — state machine मध्ये `breakdown` statusच नाही. ⚠️ MISSING — `POST /v1/transport/bookings/{id}/breakdown` सारखा endpoint नाही; re-match/pro-rata हे admin ला `PUT /v1/admin/transport/bookings/{id}/status` ने हाताने करावं लागतं. मी trip chat + `POST /v1/chatbot/messages` (Kisan Mitra) ने situation सांगतो. **P2 gap.**
6. Support touchpoints: booking-scoped च असतं (spec नुसार SOS/help-section बांधलेलाच नाही — तो violation आहे, gap म्हणून नको). Kisan Mitra `POST /v1/chatbot/messages` (endpoints.md §5), human expert `POST /v1/chatbot/expert-handoff`; abusive message वर `POST /v1/users/{user_id}/report`. Admin infrastructure जवळ आहे: vehicle re-verify (SOP-08), `PUT /v1/admin/transport/bookings/{id}/status` manual intervention (endpoints.md §28.8), strikes/suspension `POST /v1/admin/transport/transporters/{id}/suspend`.

---

### Journey 6: Fleet वाढवणं — driver sub-account (Pro)

1. माझी मेहुणी Rahul — चांगला driver, tractor चालवतो. `POST /v1/transport/drivers` `{name: "Rahul Pawar", phone: "91…"}` → `drv_…` user doc, `linkedProfiles: ["driver"]`, `fleetOwnerId: मी`. ⚠️ हा **Pro tier** feature — Free वर `402 ENTITLEMENT_EXCEEDED` (plan upgrade ला पैसे लागतात — ही product decision, gap नाही).
2. Trip सोपवतो: `POST /v1/transport/bookings/{id}/assign-driver` — Rahul ला फक्त तो trip दिसतो; milestones/location तो चालवू शकतो. **Settlements कधीच नाही** — `GET /v1/transport/settlements` driver ला `403 DRIVERS_CANNOT_VIEW_SETTLEMENTS` (backend ने स्वतःहून रोखलं, T14-compliant).
3. Rahul ची कामगिरी: `GET /v1/transport/drivers/{driver_id}/analytics` (Pro).
4. Rahul चा login: driver user doc + त्याच्या फोनचा Firebase OTP → `POST /v1/auth/firebase-verify`. ⚠️ sub-account self-login चा documented रास्ता नाही — flow "works" पण explicitly spec केलेला नाही.
5. बोली टाकण्याआधी farmer तपासतो: `GET /v1/transport/farmers/{uid}/reputation` (FT-3) — 4.1★, `delayed_loading` tag दोनदा → fare ₹200 जास्त टाकतो किंवा trip सोडतो.
6. माझा performance: `GET /v1/transport/analytics` — vehicles, completed trips, gross, diesel estimate. ⚠️ `averageRating: 4.9`, `onTimeDeliveryPct: 98.2`, `fleetUtilizationRate: 85.5` हे **hardcoded** आहेत (plan §12 risk #4) — खरे reviews मला कुठेही दिसत नाहीत (T10 gap: farmer `POST /v1/ratings` ने मला rate करतो — bookingKind `transport` — पण received ratings वाचण्याचा endpoint transport साठी नाही).

---

**Notes for the reader**
- endpoints.md §7 documents only the booking shell (`vehicles`/`fare-estimate`/`bookings`/PATCH). The load board, bids, waiting, POD-OTP, waypoints, bilty, disputes, strikes, settlements-transport — all implemented in `backend/app/routers/transport.py`, tracked feature-by-feature in `features/farmer-transporter_features.md` (baseline + FT-1…FT-8). Steps above cite both.
- Inventory (`/tmp/implemented_endpoints_v2.txt`) misses bare-path routes that exist in code: `GET /v1/notifications` (list, notifications.py:40) and `GET /v1/intelligence` (intelligence.py:462, transport digest per endpoints.md §26). Treated as implemented after code verification.
- Farmer-side surfaces (favorites, rebook, load-templates, instant-bookings, nearby-vehicles) — not mine; skipped deliberately.

---

## 4. Seller / Vyapari

> 48, agri-input dealer at "Rao Krishi Seva Kendra", Jalgaon (MH). Sells seeds, pesticide, sprayer parts on the Krishi Mall; also buys cotton, soybean and banana bunches straight from farmers. Two helpers — Subhash (counter) and Dilip (pickup agent) — but no proper team login yet.

### Journey 1: Onboarding aur dukkaan ki pehchaan (getting verified)

1. I put my mobile number, OTP aata hai SMS mein → `POST /v1/auth/otp/send` (endpoints.md §1) — phir OTP daal ke andar ghusa → `POST /v1/auth/otp/verify` (§1). New user, toh registration wizard: naam, gaon, language Marathi → `POST /v1/auth/register` (§1) with `profiles: ["seller"]`.
2. App ne meri location se district khud bhara → `GET /v1/geo/reverse?lat=&lng=` (§3). Jalgaon aaya, language suggestion Marathi — theek hai.
3. Seller profile ka business detail bhara — shop name "Rao Krishi Seva Kendra", trader type, mandis (Jalgaon APMC, Bhusawal) → role profile `PUT /v1/users/me/persona-setup` (backend mein implemented; endpoints.md §2 ke roleProfiles registration ke saath).
4. Business KYC: GSTIN, PAN, shop licence upload → `POST /v1/kyc/cases` + `POST /v1/kyc/cases/{case_id}/docs/{doc_id}/upload` (implemented; Vyapari spec §2.2 step 4–5). Status dekhne ko → `GET /v1/kyc/status` (implemented). ⚠️ Spec §2.2 kehta hai two-level verification `PENDING → L2_REVIEW → VERIFIED` 48–72h mein — yeh state machine UI mein kaise dikhti hai, koi endpoint nahi batata; status sirf `kyc/status` se milta hai.
5. Business bank account for escrow funding → `POST /v1/bank-accounts` + `POST /v1/bank-accounts/{id}/verify` (penny-drop) (§21). `GET /v1/bank-accounts` (implemented) se list.
6. ⚠️ Spec §2.2 step 7: main apne **2 helper accounts (Subhash, Dilip)** yahin invite karna chahta tha — **team sub-accounts (V10) ka koi seller-side endpoint nahi hai**. `/v1/buyer-org/invite` exist karta hai but sirf `directBuyer` Enterprise plan ke liye hai (entitlement `orgMembers`). ⚠️ MISSING — `POST /v1/seller/team/invites` (V10). Abhi dono helpers mere phone se hi kaam karte hain — audit attribution adhoora.

### Journey 2: Roz subah — home aur bhaav dekho

1. Uthte hi seller dashboard: aaj ki POS turnover, khata outstanding, open offers, pending procurement payouts → `GET /v1/seller/dashboard` (implemented; §22-adjacent). Purana spec §2 ka `GET /v1/users/me/dashboard/{profileType}` backend mein nahi mila — lekin seller dashboard isse cover hota hai, gap nahi.
2. Mandi bhaav: kal raat Jalgaon APMC mein kapas kya bika → `GET /v1/mandi/prices?crop=kapas&district=Jalgaon` (§4), aur "aaj ke bhav" widget → `GET /v1/mandi/vyapari-rates?crops=` (§4). ⚠️ F7 kehta hai MSP card bhi — mandi rows mein `msp` field hai, theek hai.
3. Notification bell: raat ko koi offer aaya kya → `GET /v1/notifications?page=` (§24), padh ke → `POST /v1/notifications/{id}/read` (§24).
4. Apne khet ke mausam ke liye → `GET /v1/weather?lat=&lng=` (§5).

### Journey 3: Dukaan ka saamaan — storefront products, stock, low-stock

1. Naya product daala: "Hybrid Cotton Seeds BG-II 450g" MRP ₹940, discounted ₹865, stock 120 → `POST /v1/seller/products` (§22) — 201, product mall mein live. (Generic route `POST /v1/my-products` (§22) bhi hai, main seller route use karta hoon.)
2. Meri poori list dekhni ho → `GET /v1/seller/products` (§22). Price ya stock badalna → `PUT /v1/seller/products/{id}` (§22).
3. Godown stock register → `GET /v1/seller/stock` + `POST /v1/seller/stock` + adjustment `POST /v1/seller/stock/{stock_id}/adjust` (implemented). ⚠️ Low-stock alert: `GET /v1/analytics/seller` (§22) mein `lowStock: []` (stock < 10) aata hai — but yeh alert *bhejne* wala (push jab stock < threshold) endpoint nahi hai, sirf dashboard pe dikhta hai. Spec mein explicit threshold-push nahi, toh chalta hai.
4. Bulk listing ek saath → `POST /v1/seller/bulk-orders`?? Nahi — woh wholesale buyer ka requirement-board hai (S5): main requirement post karu ya aayi hui dekhun → `GET /v1/seller/bulk-orders` (implemented).

### Journey 4: Mall order aayi — pack karo, ship karo ( fulfilment )

1. Order aayi 2 sprayer nozzle + 1 knapsack, ₹2,340 COD — dekhne ko → `GET /v1/orders` + `GET /v1/orders/{id}` (§6/§22).
2. Packing ke baad "shipped" mark karna hai — **nahi kar sakta!** `PATCH /v1/orders/{id}/status` (§22) sirf admin ko allowed hai (`FORBIDDEN_ADMIN`, backend `order_tracking.py`). Maine Subhash ko bola app khol, 403 aaya. ⚠️ MISSING — `PATCH /v1/seller/orders/{order_id}/status` (seller ke apne orders, `confirmed→shipped→out_for_delivery→delivered`). Abhi order status sirf admin console se badalta hai — customer ko "confirmed" atka rehta hai jabki maal nikal gaya.
3. Customer ne cancel kiya → event `cancelled`, stock wapas → `POST /v1/orders/{id}/cancel` (§22, order owner). Timeline → `GET /v1/orders/{id}/timeline` (§22).
4. Mera POS bill print karna ho (over-the-counter sale, alag se) → `POST /v1/seller/sales` + `GET /v1/seller/sales/{sale_id}/invoice.pdf` (implemented, V11 POS). Buyer ne udhaar liya → `POST /v1/seller/ledgers` (khata) (implemented).

### Journey 5: Kisan se kapas khareedna — discovery se escrow tak (core money)

1. Soyabean lot dhoondha: filters crop/price/qty/harvest → `GET /v1/market/lots/browse?crop=soyabean&state=Maharashtra` (implemented; §23-adjacent — spec V3). Card pe mandi benchmark delta — `GET /v1/mandi/compare?crop=&quantityQuintals=` (§4, F7) — 100 quintal @ ₹4,600 vs Jalgaon modal ₹4,750. Sasta hai, theek.
2. Do raaste: **Book-Now** → `POST /v1/purchases {lotId, quantity}` (§23) ya **Offer** → `POST /v1/offers {targetType: lot, targetId, pricePerUnit, quantity, message}` (§23). Maine offer maara ₹4,550 × 80 q.
3. Kisan ne counter kiya ₹4,580 → notification aayi → `GET /v1/offers/mine?filter=received` (§23) — maine accept kiya → `POST /v1/offers/{id}/accept` (§23) → **purchase ban gaya** (status `confirmed`, booking chat room khul gaya: `GET /v1/chat/rooms` (implemented v2 chat; spec §4 G1 — ⚠️ note: product owner ne pre-booking negotiation chat allow karwaya hai, seller_summary §7 — spec G1 se hatke). ⚠️ Spec V6/V5 kehta hai 3-round negotiation + 24–48h expiry — backend mein **single counter + 24h expiry** hai (`OFFER_EXPIRED`, lazy flip) — seller_summary §6 verified. Yeh spec deviation hai, chhota.
4. **Escrow fund** — booking confirm hote hi paisa hold karana hai (G3: personal UPI nahi) → `POST /v1/purchases/{id}/escrow/fund` (implemented v2, C4) — ₹3,66,400. App dikhata hai "Held by FarmLink". ⚠️ Spec §2.2 step 10: naye vyapari ko probation (max 3 concurrent bookings, ₹50k escrow cap 30 din) — backend mein `probation_gate_booking/escrow` implemented hai, theek.
5. Pickup schedule: Dilip ko pickup pe bhejna → `POST /v1/purchases/{id}/pickup {date, vehicleType, address, notes}` (§23; V8 — agent ka naam `notes` mein, structured field nahi). ⚠️ Spec V8 kehta hai "agent identified in-app by agent's own login if team account" — team account hi nahi hai (Journey 1), toh yeh bhi adhoora.
6. Dispatch → `POST /v1/purchases/{id}/dispatch`, delivered → `POST /v1/purchases/{id}/deliver` (§23).
7. **Handover OTP (F11)** — kisan ke phone pe 6-digit OTP hai; Dilip ne kisan se OTP suna aur verify kiya → `POST /v1/purchases/{id}/handover/verify` (implemented v2). ⚠️ OTP sirf farmer reveal kar sakta hai (`GET /v1/purchases/{id}/handover-otp`, buyer ko 403 — redacted), 15-min validity, single-use, 5-attempt cap, galat OTP pe `HANDOVER_REQUIRED` gate. Verify ke bina QC nahi hota. Offline bhi chalta hai (HMAC, E13) — ⚠️ spec detail, endpoint pe nahi dikhta.
8. **Inspection (V9/F10)**: weighbridge slip ki photo + moisture → `POST /v1/purchases/{id}/qc/photos` + `POST /v1/purchases/{id}/qc {grade, acceptedQty, rejectedQty, note}` (§23). ⚠️ **Weigh-slip scan reuse** — J-form mein slip scan karke auto-fill: **DEFERRED 2026-10-08** (docs/deferral-ledger.md `deferral.weighslip`) — "reuse services/receipt_scan.py when wired". `receipt-scan` endpoint exist karta hai (`POST /v1/diary/receipt-scan`) par sirf farmer/landlord role ke liye — mere procurement J-form pe kaam nahi aata.
9. QC full-accept → auto `completed`, invoice → `GET /v1/purchases/{id}/invoice` (§23, V11) — `INV-XXXXXXXX-YYMM`. Receipt → `GET /v1/purchases/{id}/receipt` (implemented).
10. **Escrow release**: completion pe auto-release minus commission 2% (min ₹50) → purchase ke `escrow` object mein dikhta hai; T+24h dispute-window release scheduler → `POST /v1/jobs/escrow/release-due` (cron) (implemented). ⚠️ Commission ka **invoice nahi milta** — sirf deduction dikhta hai (gap, see gap_parts).
11. Rating: kisan ko 5★ → `POST /v1/purchases/{id}/rate {target: farmer, ...}` (§23 — Option B se seller allowed). Uska rating mujhe bhi laga.

### Journey 6: Khud ki "wanted" demand — reverse listing (V4)

1. Banana bunches chahiye 500 dozen, max ₹18/dozen, weekly → `POST /v1/demands {crop: banana, quantity, maxPrice, frequency: weekly, ...}` (§23 — seller ko allow hai, Option B). ⚠️ Spec V4 kehta hai matching farm-profile wale farmers ko **offers-inbox alerts** jayenge — notification (`POST /v1/notifications` internal writer + FCM) se hota hai, direct endpoint nahi.
2. Farmers ke offers mere Received inbox mein → `GET /v1/offers/mine?filter=received&targetType=demand` (§23) → accept → purchase. Demand khud `fulfilled`/`closed` → `POST /v1/demands/{id}/close` / `reopen` (§23); edit → `PUT /v1/demands/{id}`; delete (live offers pe 409 `DEMAND_HAS_OFFERS`) → `DELETE /v1/demands/{id}` (§23). Standing/recurring → `GET /v1/demands/standing` (implemented).
3. Open demand board sab dekh sakte hain → `GET /v1/demands/browse` (implemented).

### Journey 7: Shop pe aaya maal — procurement J-form + khata + POS (business suite)

1. Ramesh kisan apni soybean leke counter pe aaya: gross 4,620 kg, tare 120 kg, net 45 quintal, rate ₹4,700 → `POST /v1/seller/procurement` (J-form; implemented, V11) — `JFORM-20261017-XXXX`, quality deduction 2%, final ₹2,11,500. Slip number/url manual field hai (`weighbridgeSlipNo/Url`) — scan nahi (deferred, upar).
2. Payment udhaar pe → `POST /v1/seller/procurement/{lot_id}/payment-status {status: udhaar}` ya paid → `POST /v1/seller/procurement/{lot_id}/pay` (implemented). Receipt → `GET /v1/seller/procurement/mine/{payment_id}/receipt` (implemented). ⚠️ Spec F12/TDS: farmer payout pe TDS 194-O — TDS ledger neeche.
3. Kharida maal seedha godown stock mein → `POST /v1/seller/stock/from-purchase/{purchase_id}` (implemented — procurement → stock reuse, achha hai).
4. Udhaar khata by buyer → `GET/POST /v1/seller/ledgers` (implemented); cashflow → `GET /v1/seller/cashflow`; season demand forecast → `GET /v1/seller/forecast`; buyer directory → `GET /v1/seller/buyer-directory` (implemented).
5. Mandi rate post karna: Jalgaon mein kapas ₹5,900-6,100 → `POST /v1/seller/rates` (implemented) — ±25% band validation (`RATE_OUT_OF_BAND`); mere pending → `GET /v1/seller/rates/my`; admin approve → §28.4 `POST /v1/admin/rates/{id}/approve`.

### Journey 8: Analytics, intelligence, benchmarks

1. Storefront dashboard: revenue, AOV, top products, lowStock, returnRate → `GET /v1/analytics/seller` (§22).
2. Procurement control tower: spend, crop mix vs mandi modal (`avgPriceVsMandi`), QC rejection rate, top suppliers → `GET /v1/direct-buyer/analytics` (§23 — Option B se seller allowed).
3. One-glance digest → `GET /v1/intelligence` (§26 — seller → procurement digest: `buying_below_mandi`, `balance_due` insights).
4. Price watcher: soybean ₹5,000 cross ho toh alert → `POST /v1/price-alerts {crop, targetPrice, above}` (implemented, §26) — list `GET /v1/price-alerts`, delete `DELETE /v1/price-alerts/{id}`. ⚠️ Yeh **price** alert hai; V12 ka **harvest-window alert** (saved crop ki harvest date aane pe push) nahi hai — P2 gap.
5. Favorite kisan network → `POST/GET/DELETE /v1/direct-buyer/saved-farmers[/{farmerId}]` (§23, V12) — feed inhi se → `GET /v1/direct-buyer/feed` (§23). ⚠️ V12 ka **saved searches** (filters save karna) kahi nahi — P2 gap.
6. P&L: `GET /v1/pnl/summary` + `GET /v1/pnl/crops` (§8) aur Tally export → `GET /v1/pnl/export/tally` (implemented). CSV exports web pe client-side hain (seller_summary §7).

### Journey 9: Compliance — TDS, invoices, settlement, support

1. **TDS 194-O**: mere gross GMV pe 1% TDS ka statement → `GET /v1/seller/tds-statements` (implemented) + PDF → `GET /v1/seller/tds-statements/statement.pdf?periodStart=&periodEnd=` (implemented). ⚠️ **Pro plan gate** — `_plan_feature_guard(uid, "tdsStatements")`: Free plan pe PDF 402/429 maangega. Spec F12 kehta hai statements downloadable; plan-paywall spec mein nahi likha.
2. **GST/commission invoice**: purchase invoice mila (Journey 5), POS bill mila (Journey 4), but platform commission ka invoice aur GSTR-style GST report export **nahi hai** → ⚠️ MISSING (V11; transport ko `/transport/bookings/{id}/commission-invoice` milta hai, mujhe nahi).
3. Settlement/payout lines agar hold hon → finance admin dekhta hai `GET /v1/settlements/holds` (admin-only, maker-checker >₹10k) — mujhe sirf purchase ke `escrow` status mein dikhta hai.
4. Kuch gadbad ho toh booking-scoped dispute → **sirf QC dispute hai** (`qc` → `qcDisputed` → `resolve`). General "raise dispute" (V15/C8 — photos + inspection + chat evidence, escrow freeze, 5-din SLA) **nahi hai** → ⚠️ MISSING. Abhi Kisan Mitra se poochna → `POST /v1/chatbot/messages` (§5) ya admin console `/v1/admin/disputes` (§28 — admin side exist karta hai, user side nahi).
5. Referral: padosi dealer ko invite → `POST /v1/referrals/invite` (§19, C11) — +100 coins; stats → `GET /v1/referrals` (implemented).
6. Scheme check: `GET /v1/schemes/matches` (implemented) — Udyam/msme interest subsidy waghaira.

### Journey 10: Jab deal ulat-pher ho — exceptions

1. **Maine cancel kiya** (pickup se pehle) → `POST /v1/purchases/{id}/cancel {reason}` (§23) — escrow auto-refund, event append. ⚠️ Spec E2 kehta hai <24h to pickup pe 1% fee + PG charges — backend plain `cancelled` hai, fee slabs nahi (plan §11).
2. **Kisan no-show** pickup pe: booking `NO_SHOW` — ⚠️ spec E3 kehta hai ₹300 inconvenience credit + farmer ko **"Relist with priority"** (F16) boost — **dono endpoint nahi hain** (F16 farmer-side bhi). Kisan ka lot dobara list karna uska manual kaam hai.
3. **Quality jhagda**: QC mein rejected qty → `qcDisputed` → resolution → `POST /v1/purchases/{id}/resolve {resolution}` (§23) — adjusted `finalAmount`, phir invoice. Yeh kaam chalta hai.
4. **Offer expire**: 24h na accept karu → lazy expiry, `OFFER_EXPIRED` (implemented) — naya offer allowed.
5. **Order return** mall pe: customer ne return maanga → `POST /v1/orders/{id}/return` (§22) — mujhe (seller) iska status timeline mein dikhta hai; refund admin/processed end se.
6. Mera khud ka accountMPIN bhool gaya → `POST /v1/auth/mpin/reset` (§1).

---

> **Anna Pawar (अण्णा पवार), 51, village Kawtha, Ausa taluka, Latur district, Maharashtra.**
> Owns a Mahindra 575 DI tractor, a rotavator, a thresher (थ्रेशर) and an agri sprayer drone.
> Rents them out in 4-hour yantra slots (6–10, 10–2, 2–6, 6–10) during soybean/tur/jowar season.
> Her son Datta drives the tractor; she runs the business from her phone.

> Verification note: this flow was checked against the mechanical inventory
> (`/tmp/implemented_endpoints_v2.txt`). Two owner-critical routes — `POST /v1/equipment`
> (add machine) and `POST /v1/ratings` (submit rating) — are **implemented in code**
> (`backend/app/routers/equipment_owner.py:117`, `backend/app/routers/ratings.py:106`) but are
> missing from the extracted inventory. I verified them in source and treat them as implemented;
> the inventory itself appears to have dropped bare-path (`""`) POST routes.

---

## 5. Equipment Owner

1. My nephew installs the app and opens it in Marathi. I type my mobile number; the OTP comes on SMS.
   ⚠️ The OTP itself is done through **Firebase phone auth**, not a REST endpoint — the app verifies
   the OTP in the SDK and then calls `POST /v1/auth/firebase-verify` (endpoints.md §1 documents
   `/auth/otp/send` + `/auth/otp/verify`, but those are NOT in the implemented inventory; Firebase
   covers the step). → `POST /v1/auth/firebase-verify` — I land in a fresh account.
2. I fill my name (Anna Pawar), village Kawtha, district Latur, and tick the profile "Equipment Owner
   (यंत्र मालक)". → `POST /v1/auth/register` (endpoints.md §1) with `profiles: ["equipmentRental"]`.
3. I set a 4-digit MPIN — the app says this is my signature for contracts and payments later.
   → `POST /v1/auth/mpin/set` — MPIN hash saved. ⚠️ Spec (§Conventions) says MPIN is the second
   factor for sensitive actions; that holds — e-sign and payments ask for it.
4. I accept the marketplace rules — in-app chat only, damage liability, cancellation rules.
   → `PUT /v1/users/me/consents` — timestamped consent record.
5. KYC: I upload my PAN and Aadhaar (via DigiLocker), plus a selfie. → `POST /v1/kyc/cases`
   opens my equipmentRental case, then `POST /v1/kyc/cases/{case_id}/docs/{doc_id}/upload`
   for each document. I check where it stands → `GET /v1/kyc/status`.
   Extra copies go to my document vault → `POST /v1/vault/documents` (endpoints.md §10).
6. Payout bank: I add my Latur District Central Co-op Bank account so earnings can come in.
   → `POST /v1/bank-accounts`, then penny-drop check → `POST /v1/bank-accounts/{account_id}/verify`
   (endpoints.md §21). First account becomes primary automatically.

### Journey 2: Building my fleet — four machines, slot templates, papers

1. First machine: the Mahindra 575. Name, type "tractor", ₹350/hour, ₹1,400 per 4-hour slot,
   RC photo and insurance certificate attached, service every 250 hours.
   → `POST /v1/equipment` (endpoints.md §14 "POST /equipment"; **in code but missing from the
   extracted inventory — verified at equipment_owner.py:117**) → 201, machine id `eq_…`,
   `docStatus: "pending"`.
2. Same for the rotavator (₹800/slot), the thresher (₹1,800/day package) and my drone
   (₹250/acre spraying). I edit the rotavator's rate mid-season when diesel goes up.
   → `PUT /v1/equipment/{equipment_id}` (§14). My pricing block supports hourly / per-acre / package;
   the app's price calculator uses it → `POST /v1/equipment/{equipment_id}/quote` (implemented;
   not in endpoints.md §14).
3. Slot templates: I keep the default 4 slots a day but mark Sundays blocked for servicing —
   the `slotTemplate` rides on the machine create/update. ⚠️ There is no separate endpoint to block
   arbitrary seasonal dates (e.g. "my own soybean harvest, 12–18 Oct"); I fake it by declining
   requests those days. See gap #7.
4. Owner papers for the badge: PAN (DigiLocker), RC, insurance, and Datta's operator licence.
   → `POST /v1/equipment-rental/verification/documents` (implemented; not in endpoints.md §14),
   one call per docType — it writes onto my KYC case as `pending`.
5. I watch the badge state → `GET /v1/equipment-rental/verification/status` and
   `GET /v1/equipment-rental/badge` (both implemented; not in endpoints.md §14). On the admin
   side, the superadmin checks my machine papers and flips each machine
   → `PUT /v1/admin/equipment/{equipment_id}/verify` (§28.9) so it appears to farmers.
6. My fleet overview → `GET /v1/equipment/owner/fleet` (§14): booked hours this week, weekly
   income, `docStatus` per machine, insurance/RC expiry dates. The app nags me at 30/7/1 days
   before insurance expiry — those reminders also surface under → `GET /v1/equipment-rental/reminders`.

### Journey 3: Reading the market before I price the week

1. What do farmers around Latur need? → `GET /v1/equipment/demand-posts?machineType=tractor`
   (implemented; not in §14) shows open farmer demand-posts ("threshing needed, 5 acres, Udgir side,
   budget ₹1,500"). I can read the board — but ⚠️ there is no endpoint to answer a demand post with a
   structured quote; I can only wait for a slot booking. See gap #6.
2. Season heat → `GET /v1/equipment-rental/demand-heatmap` and
   `GET /v1/equipment-rental/recommendations` tell me drone spraying demand spikes with soybean
   pest outbreaks. Why do I rank where I rank? → `GET /v1/equipment-rental/ranking/explain`.
3. Before committing a rate I check the platform's cut and cancellation rules:
   → `GET /v1/equipment-rental/commission` (equipmentRental 12%), `GET /v1/equipment-rental/policies`
   (cancellation matrix, surge caps). Commission config is read by everyone; superadmin edits it
   via `PUT /v1/admin/platform-config/commissions` (§28.25).
4. Should I trust this farmer? Before the season I skim risk flags → `GET /v1/equipment-rental/risk/farmers`
   (implemented; not in §14).

### Journey 4: The booking inbox — approve, reject, counter (my daily bread)

1. Morning chai: who asked for my machines? → `GET /v1/equipment/bookings/pending` (§14 shape;
   implemented as owner inbox with farmer name, slot, price, and an AI `recommendationScore`).
   Full live picture → `GET /v1/equipment-rental/monitoring/bookings?status=pending` (implemented;
   not in §14).
2. Suresh Borate wants the tractor tomorrow 6–10 at ₹1,400. Good farmer, good rate → accept.
   → `POST /v1/equipment/bookings/{booking_id}/approve` — status `pending → booked`, Suresh gets
   FCM, the slot flips to booked.
3. Another one asks the drone at ₹200/acre for 12 acres — my rate is ₹250. I don't reject; I counter.
   → `POST /v1/equipment/bookings/{booking_id}/counter` with `{revisedRateRupees: 250, rateType:
   "perAcre", reason: "drone_service_4_acres", validityHours: 24}` → booking status `countered`,
   `counterExpiresAt` stamped. ⚠️ Two holes: (a) nothing ever enforces that expiry — no cron
   expires counters; (b) there is **no farmer-side endpoint to accept or decline my counter**
   (`counterRateRupees` is written but never read back into a booking). The quote lifecycle is
   one-legged. See gap #2.
4. A third request is for a date my thresher is booked → reject with reason.
   → `POST /v1/equipment/bookings/{booking_id}/reject` — farmer is notified and can rebook.
5. Contract: for the approved booking I generate the rental contract (scope = machine, slot, rate,
   terms; versioned). → `POST /v1/equipment/bookings/{booking_id}/contract` (owner only; implemented;
   not in §14). Suresh signs with his MPIN → `POST /v1/equipment/bookings/{booking_id}/contract/esign`
   (MPIN + consent timestamp — spec §A allows "e-sign or OTP"; MPIN is the implemented method), then I
   sign the same way. Signed PDF → `GET /v1/equipment/bookings/{booking_id}/contract/pdf`.
   ⚠️ Spec §D says a chat room should open at confirmation + contract — but no chat room is ever
   created for equipment bookings (services/chat.py has room creation for purchases, offers,
   transport and dairy batches only). Suresh and I have no way to exchange field photos/pins.
   See gap #3.

### Journey 5: Job day — dispatch, status events, completion, verification

1. Datta leaves with the tractor at 5:30. At dispatch I drop a manual location pin (Kawtha
   chowk) → `POST /v1/equipment/bookings/{booking_id}/check-in` `{event: "dispatch", lat, lng}`
   — event pins only, no GPS tracking (spec hard constraint, compliant). Pins visible to both sides
   via `GET /v1/equipment/bookings/{booking_id}/check-in`.
2. I open the job card → `GET /v1/equipment/bookings/{booking_id}/execution` — checklist:
   mobilization photos, pre-work field condition, operator dispatched, completion proof, farmer
   sign-off. Status starts at `assigned`.
3. Status events as the day moves (spec's exact ladder):
   → `POST /v1/equipment/bookings/{booking_id}/execution` with `jobStatus: "en_route"` → app shows
   Suresh "यंत्र निघालं" (machine left). Then `"on_site"` at arrival, `"work_started"` when the
   rotavator bites, each stamped into `statusTimeline` (this timeline is the settlement/dispute
   evidence per spec). I log hours and acres in the same call as they happen.
4. Work done: I set `"completed"` with an evidence photo URL and hoursLogged. The booking flips
   `completed`, and the app opens a rating prompt for Suresh → server-side `open_rating_prompt`;
   he rates me via `POST /v1/ratings` (**implemented at ratings.py:106 but missing from the
   extracted inventory — verified**; pending prompts listed at `GET /v1/ratings/pending`).
5. Suresh confirms — the same execution endpoint with `jobStatus: "verified"` (farmer sign-off).
   ⚠️ The endpoint lets either party set any status; there is no OTP/handover confirmation gate
   between "completed" and "verified" — the spec's farmer-confirms-completion is just a status string.
   Not a missing endpoint, but a weak handover (flagged inline per instructions).

### Journey 6: Money — advance + completion split, invoice, settlement, payout

1. Suresh paid ₹600 advance when he booked (recorded on the booking);
   after verification he pays the ₹800 balance → `POST /v1/equipment/bookings/{booking_id}/payments`
   `{kind: "balance", amountRupees: 800}` (implemented; not in §14). I get a notification
   "भुगतान मिला ₹800". ⚠️ This is a ledger entry with a free-text `reference` — no Razorpay order is
   bound to the booking. Generic PSP calls exist (`POST /v1/payments/order`, `POST /v1/payments/verify`,
   §-less in endpoints.md but in the inventory) but nothing links a captured payment to the booking
   ledger, so the "escrow-like authorized hold" of spec §A is not really there. See gap #4.
2. If I have to return money (rain, machine breakdown) → `POST /v1/equipment/bookings/{booking_id}/refund`
   `{amountRupees, reason}` — owner-issued, capped at paid-minus-refunded, farmer notified.
   Farmer-side cancellation itself is `DELETE /v1/equipment/bookings/{booking_id}` (§14, ≤2 h before
   start, `CANCEL_NOTICE_HOURS`; SMS to me). Admin force-cancel with auto-refund:
   `DELETE /v1/admin/equipment/bookings/{booking_id}` (§28.9).
3. Tax invoice for the job → `GET /v1/equipment/bookings/{booking_id}/invoice` — rental line,
   payments, refunds, 12% platform commission, my net. I keep these for my GST record book.
4. Week's earnings: → `GET /v1/equipment/settlements` (§21) and the richer
   `GET /v1/equipment-rental/settlements` (gross → commission → net, payout status, hold flags,
   current-week preview). Say gross ₹24,600 → commission ₹2,952 → net ₹21,648 for the ISO week.
   The nightly cron aggregates completed bookings → `POST /v1/jobs/settlements/run`; payouts batch
   → `POST /v1/jobs/settlements/payouts`; finance marks paid → `POST /v1/admin/settlements/{id}/mark-paid`
   (§28.25). Money lands in my verified bank account from Journey 1.
5. ⚠️ TDS: the spec wants TDS/GST handling for owners, but TDS statements exist only for sellers
   (`/seller/tds-statements`). I export nothing. See gap #8 (P2).

### Journey 7: The drone crash — damage claim, deposit, dispute

1. Diwali-week job in a Udgir field: farmer's nephew flies my drone into a tree — gimbal, tank,
   two propellers gone. Repair estimate from the Latur service centre: ₹18,500.
2. I open the damage claim same evening with before/after photos, the booking reference and the
   estimate → `POST /v1/equipment/owner/damage-claims` (implemented; not in §14) → 201, `claim_…`,
   status `open`. The AI gives a damage estimate with `suggestedDeductionPaisa` from my photos.
   My claims list → `GET /v1/equipment/owner/damage-claims`.
3. I confirm what I'll actually deduct → `POST /v1/equipment/owner/damage-claims/{claim_id}/confirm-estimate`
   `{deductionPaisa: 1850000}`. ⚠️ **And then — nothing to deduct from.** The spec's whole deposit
   idea (owner must-have "Deposit rules", edge-case matrix "deposit/hold if enabled", my workflow
   "damage claim + deposit forfeiture") has no endpoint: there is no deposit collected at booking,
   no wallet, no hold line tied to the claim. `confirmedDeductionPaisa` is a number in a doc.
   → **⚠️ MISSING — `POST /v1/equipment/bookings/{booking_id}/deposit` (collect) +
   `POST /v1/equipment/bookings/{booking_id}/deposit/forfeit` (or deposit movement inside the
   claim-resolve lane).** See gap #1 (P0).
4. The arbitration lane: admin resolves the claim → `POST /v1/equipment/owner/damage-claims/{claim_id}/resolve`
   (admin-gated `RESOLVE_EQUIPMENT_CLAIM`). ⚠️ But the superadmin console has **no list endpoint for
   equipment damage claims** (SOP-09 §3 promises "handle machinery damage reports and security deposit
   forfeitures") — an admin can only resolve a claim if someone hands them the id.
   → **⚠️ MISSING — `GET /v1/admin/equipment/damage-claims`.** See gap #5.
5. If the farmer argues ("the field was full of wires, not my fault"), either of us opens a dispute
   on the booking → `POST /v1/equipment/bookings/{booking_id}/disputes` `{category, description,
   claimRupees}` → 72-h SLA case. Evidence → `POST /v1/equipment/disputes/{dispute_id}/evidence`;
   my cases → `GET /v1/equipment/disputes`, `GET /v1/equipment/disputes/{dispute_id}` (hours-left
   SLA shown). Superadmin triage → `GET /v1/admin/disputes` + `POST /v1/admin/disputes/{dispute_id}/resolve`
   (§28); stuck booking → `POST /v1/admin/equipment/bookings/{booking_id}/escalate` (§28.9 area).
6. Depending on outcome, money moves only as a refund (`/refund`) or as settlement hold adjustments
   (`GET /v1/settlements/holds`, `POST /v1/settlements/holds/{line_id}/release|reject` — admin-side).
   Without gap #1, "forfeit his deposit" stays a sentence in a dispute note.

### Journey 8: Trouble cases — no-shows, bad actors, support

1. Farmer no-show: Datta waits 45 min at the pin, nobody comes, no access. I log waiting time in
   the execution notes; there is no owner "no-show mark" endpoint — the platform's no-show handling
   is farmer-side (`/customer/orders/{id}/no-show` belongs to another module) or admin. I eat the
   slot, or cancel with the refund endpoint as goodwill. ⚠️ inline.
2. Repeat troublemaker who broke a trolley last season: blacklist him so he can't keep pinging me.
   → `POST /v1/equipment-rental/blacklist`, review → `GET /v1/equipment-rental/blacklist`,
   forgive → `DELETE /v1/equipment-rental/blacklist/{user_id}`.
3. Report abusive chat/media → `POST /v1/users/{user_id}/report`; block → `POST /v1/users/me/blocks`.
4. Something broken in the app or a booking stuck: → `POST /v1/support/ask`. Kisan Mitra answers
   small doubts → `POST /v1/chatbot/messages`, `GET /v1/chatbot/history`; for a real person
   → `POST /v1/chatbot/expert-handoff`. My notifications inbox → `GET /v1/notifications`,
   mark read → `POST /v1/notifications/{id}/read` (§24).
5. Mid-season scare: my KYC PAN expires → booking restrictions + payout pause until I re-upload —
   the doc expiry scheduler nudges me in-app (spec §E "KYC expiry mid-season"; I re-submit through
   `POST /v1/equipment-rental/verification/documents` with a new `expiresAt`).

### Journey 9: Daily home & the business wrap

1. Home screen → `GET /v1/equipment/owner/dashboard` (implemented; not in §14): machines + today's
   utilization, pending approvals count, machines out now, open damage claims, next service due,
   weekly income + next payout. (endpoints.md §2's generic `GET /users/me/dashboard/{profileType}`
   is **not implemented** — the persona dashboard above covers it; noted, not a gap.)
2. Deeper numbers → `GET /v1/equipment/owner/analytics`, and my whole-farm P&L (I also farm 6 acres
   of soybean) → `GET /v1/pnl/summary` / `GET /v1/pnl/crops` (§8 explicitly allows equipOwner).
3. Maintenance discipline: after every service → `POST /v1/equipment/{equipment_id}/maintenance`
   (hours at service, cost, parts) which resets the service clock; overdue alerts via
   `GET /v1/equipment/owner/maintenance` + reminders. This is a Pro-plan feature (`maintenanceSuite`)
   — I'm on Pro ₹399/mo so it works for my 4 machines.
4. Month-end: settlements (Journey 6), badge re-check, and I glance at the demand-heatmap to decide
   whether to buy a second rotavator before rabi.

---

> **Bhujang Jadhav**, 45, commodity broker at APMC Vashi. Soybean (Beed side), onion (Nashik/Jalgaon), cotton (Solapur mills). 20 years on the mandi floor, now running his *dalali* book from the phone. Works from leads — every farmer and buyer in his pipeline is a contact he personally knows.

**Verification note:** paths below were checked against `/tmp/implemented_endpoints_v2.txt` **and** the backend source. The mechanical inventory drops routes registered at a router's bare root (e.g. `GET /v1/notifications`, `GET|POST /v1/bank-accounts`, `POST /v1/ratings`, `GET /v1/intelligence`, `GET|POST /v1/offers`, `POST /v1/sync`, `GET /v1/faq`) — those exist in code and are treated as covered. Several broker endpoints (`/broker/dashboard`, `/broker/buyer-requirements`, `/broker/trust-tier`, deal `disputes`/`escalate`/`payment-capture`/`vault`) are **implemented but not documented in endpoints.md §25** — cited as *(inventory-only)*.

---

## 6. Broker / Dalal

1. I download the app at my Vashi godown, enter my mobile → the OTP screen appears. ⚠️ The spec'd `POST /v1/auth/otp/send` + `POST /v1/auth/otp/verify` (endpoints.md §1) are **not implemented** — OTP actually runs through the Firebase SDK and lands as `POST /v1/auth/firebase-verify` *(inventory)*. Same outcome: I get my 6-digit code.
2. First open, the app asks who I am → I complete registration with my name, village (Vashi, Navi Mumbai), crops → `POST /v1/auth/register` (§1).
3. I add the Broker/Dalal profile to my account → `POST /v1/users/me/profiles` `{profileType:"broker"}` then `POST /v1/users/me/profiles/broker/activate` (§2). App flips to the broker home.
4. Service profile — my mandis (APMC Vashi, APMC Kalamboli), crops (soybean, onion, cotton), my 2% commission rate card → `PUT /v1/users/me/persona-setup` with `roleProfiles.broker` *(inventory; supersedes the missing `GET /users/me/dashboard/{profileType}` home composer — the broker dashboard is its own endpoint now)*.
5. Business KYC — PAN, APMC arhtiya licence, GST certificate. I open a KYC case → `POST /v1/kyc/cases` and upload each document → `POST /v1/kyc/cases/{case_id}/docs/{doc_id}/upload` *(inventory §28.3-adjacent; broker B2 requires arhtiya licence + GST)*. ⚠️ Spec B3/§B2 says **I cannot trade until approved** — the app only hard-blocks me at payment capture, not at deal creation (see Journey 3, step 8).
6. I watch my approval clock → `GET /v1/broker/trust-tier` *(inventory-only)* — shows case status and the 48–72h SLA (⚠️ spec §B3, config `platform_config/broker_kyc_sla`, default 72h). If they breach it, it auto-escalates to admin.
7. Payout account — my ICICI current account, IFSC, penny-drop verify → `POST /v1/bank-accounts` + `POST /v1/bank-accounts/{id}/verify` (§21; both verified against code — the inventory only lists the sub-paths).
8. ⚠️ The app tells me the **free plan allows only 5 deals**; unlimited deals cost ₹799 → `GET /v1/billing/plans` → `POST /v1/billing/subscribe` *(inventory §billing)*. I pay — cheap against one onion deal's ₹2,200 commission.

### Journey 2: Daily home — "mandi bhav before chai"

1. Morning: broker home → `GET /v1/broker/dashboard` *(inventory-only)* — pipeline counts by stage, offers awaiting farmer reply with the TTL countdown, deals missing evidence, commission earned/pending/paid in paisa, my network size (farmers/buyers).
2. "Aaj ka bhav" — soybean at Vashi → `GET /v1/mandi/vyapari-rates?crops=soybean` (§4), full board → `GET /v1/mandi/prices?crop=onion&district=Nashik` (§4), and where a 50q onion lot nets most → `GET /v1/mandi/compare?crop=onion&quantityQuintals=50&lat=&lng=` (§4).
3. My AI digest → `GET /v1/intelligence` (§26 — broker persona renders the deal funnel; verified in code, bare root path).
4. I set a watcher — "tell me when soybean crosses ₹5,000/q" → `POST /v1/price-alerts` (§26). It fires once → shows in `GET /v1/notifications` (§24 — verified in code).
5. Notifications inbox → `GET /v1/notifications?page=1` (§24; bare root path verified in code) — counter-offers, contracts accepted, pickup reminders. Mark all read → `PUT /v1/notifications/read-all` (§24).

### Journey 3: Lead → deal → contract — the 50-quintal onion sauda (core money workflow)

1. Yesterday at Vashi gate I met Ramesh Bhau, a Nashik onion grower — into the CRM → `POST /v1/broker/leads` `{name:"Ramesh Pawar", type:"farmer", commodity:"Onion", quantityExpected:50, targetRate:2100, location:"Nashik"}` (§25). My pipeline → `GET /v1/broker/leads?status=` (§25); I move him `active → contacted → negotiating` via `PUT /v1/broker/leads/{id}` (§25).
2. A wholesale buyer has also posted "need 50q onion @ ₹2,300" on the requirements board → `GET /v1/broker/buyer-requirements` *(inventory-only)*. I tap respond → `POST /v1/broker/buyer-requirements/{requirement_id}/respond` *(inventory-only)* — the app prefills a **buyer lead** into my CRM linked to the requirement (AI lead score attached, ai.B12).
3. I could also discover farmer lots directly → `GET /v1/market/lots/browse?crop=onion` (§23-adjacent trade module, inventory) — but honestly, my book runs on phone contacts, not browsing.
4. Both sides exist now — I record the deal: buyer = Sanjay Trader (Vashi), seller = Ramesh Pawar, 50q Grade A onion @ ₹2,200/q, delivery "APMC Vashi Gate 4", my commission 2% → `POST /v1/broker/deals` (§25). Server computes **gross ₹1,10,000, commission ₹2,200** and stamps `expiresAt` = now + 24h. ⚠️ TTL is the spec's C6 24–48h window (`platform_config/broker_offer_ttl`, default 24h) — visible only as a countdown, no user setting.
5. Ramesh's registered mobile matched by last-10-digits → he gets an in-app ping `deal_offer_received`. He counters ₹2,150 — I see it in the negotiation thread → `GET /v1/broker/deals/{id}/messages` (§25).
6. I reply with a structured counter card → `POST /v1/broker/deals/{id}/messages` `{senderRole:"broker", text:"final", amountOffer:2180}` (§25). ⚠️ Spec C6/plan §5.3 details not obvious from the endpoint: **max 3 counter rounds** then the deal locks to accept/decline (409 `COUNTER_LIMIT_REACHED`); at round 2 an AI deadlock-risk score runs and may suggest a mediator; every message passes a server-side phone/UPI/URL blocklist with a 3-strike ladder (D4 — now enforced in `moderate_deal_text`).
7. He accepts ₹2,180 — well, he can't accept a raw offer; I first flip the deal → `PUT /v1/broker/deals/{id}` `{status:"contract_issued"}` (§25). ⚠️ **MISSING — e-contract document + MPIN e-sign.** The spec's C5/F6 e-contract (acceptance log, digital acceptance) has no endpoint — no `GET /v1/broker/deals/{id}/contract`, and the farmer's `respond` takes no MPIN (unlike buyer contracts' e-sign `POST /v1/contracts/{id}/accept` with `{mpin}` in §7/§26). The app shows a client-rendered contract card only.
8. Farmer one-taps accept → `POST /v1/farmer/deals/{id}/respond` `{action:"accept"}` (§25 — phone-matched seller, sets `accepted`). I get `deal_accepted`. The typed document vault opens to both of us → `GET /v1/broker/deals/{id}/vault` *(inventory-only: weigh_slip / quality_report / payment_proof, gated to accepted+; 409 `VAULT_LOCKED` before)*.
9. Money: the buyer's payment is ready, so I capture — gross splits into farmer leg ₹1,06,964 + my commission leg ₹2,180×… precisely: `POST /v1/broker/deals/{id}/payment-capture` *(inventory-only)*. ⚠️ Two spec details bite here: (a) capture **requires verified arhtiya_licence + GST KYC** else 403 `BROKER_KYC_REQUIRED`; (b) ⚠️ **MISSING — B12/E7 escrow release:** capture pays the farmer leg **immediately** (allowed from `accepted`/`in_transit`), with no delivery-confirmation + 48h silent window and no dispute pause — the existing `POST /v1/jobs/escrow/release-due` cron only releases *purchase* escrows, not broker deals. Spec: features/farm_brokerdalal.md B12, E7.
10. Lead hygiene: Ramesh's lead → `PUT /v1/broker/leads/{id}` `{status:"converted"}`; if the deal dies, `DELETE /v1/broker/leads/{id}` drops it (§25).

### Journey 4: Pickup & delivery day — "gaadi ravaan"

1. Vehicle booking for the pickup — tempo from Vashi to Nashik → `GET /v1/transport/vehicles` → `POST /v1/transport/fare-estimate` → `POST /v1/transport/bookings` (§7). Trip tracked on the transporter side via `PATCH /v1/transport/bookings/{id}` — not mine.
2. ⚠️ **MISSING — vehicle details on the deal (B8).** Spec wants vehicle type + masked plate (`MH 12 •• 3456`) + driver name stored on the deal; `DealUpdate` has no vehicle fields and no `PUT /v1/broker/deals/{id}/vehicle` exists. I cram "MH12 AB 3345, driver Suresh" into `notes` via `PUT /v1/broker/deals/{id}` — and the plate shows unmasked, which the spec's B8 explicitly forbids.
3. ⚠️ **MISSING — milestone events (F9/B9).** The spec's farmer-facing chain — departed → arrived → loading → in-transit → arrived-at-mandi → **weighed** → delivered — has no endpoint. No `POST /v1/broker/deals/{id}/milestones`. All I can do is flip the coarse blob `PUT /v1/broker/deals/{id}` `{status:"in_transit"}` (§25) — farmer gets "गाड़ी रवाना"; then `{status:"completed"}` — farmer gets the delivered notice with gross + commission. The weighment moment (E6 pro-rata adjustment!) has nowhere to live except notes.
4. What *does* exist: photo evidence. Loading photo at Nashik → `POST /v1/broker/deals/{id}/evidence` multipart, `kind=loading` (§25); weighbridge slip at Vashi → same call, `kind=weighbridge` — wait, the typed vault uses `kind=weigh_slip`/`quality_report`/`payment_proof` (MAX 5 per kind, MAX 20 total, 409 `EVIDENCE_LIMIT_REACHED`). The farmer uploads his own from his side → `POST /v1/farmer/deals/{id}/evidence` (§25). Dispute freezes evidence (`evidenceFrozenAt`).
5. ⚠️ **MISSING — deal chat room (B7/F7/D1).** Spec: chat unlocks on acceptance. `POST /v1/chat/direct` *(inventory)* requires lotId/demandId/vehicleId/bookingId/listingId/quoteId/purchaseId — **no dealId** — and no room is created when the farmer accepts. Free-text coordination with Ramesh inside the platform is impossible; we're pushed back onto the (moderated) deal-message thread, which the plan's log confirms ("lights up fully when backend creates deal rooms").

### Journey 5: Commissions & settlement — "मेरी दलाली कहाँ है"

1. My running money → `GET /v1/broker/commissions` (§25): totalEarned (completed deals), pendingPayout (live deals), counts, per-deal rows.
2. Every Sunday the platform's cron aggregates my completed deals at 2% → `POST /v1/jobs/settlements/run` (§21, cron-only). My weekly statement → `GET /v1/broker/settlements` (§21): `{periodStart, periodEnd, grossRupees, commissionRupees, netRupees, status: pending→approved→paid, sourceIds}`.
3. Payout — RazorpayX to my penny-drop-verified ICICI account → `POST /v1/jobs/settlements/payouts` (cron; onHold when no verified account). Admin marks paid → visible in my settlements; held lines surface at `GET /v1/settlements/holds` + release/reject *(inventory §SOP-25)*.
4. My books → `GET /v1/pnl/summary` + `GET /v1/pnl/crops` (§8, broker role allowed) — dalali income as a business. Export for my CA → `GET /v1/pnl/export/tally` *(inventory)*. ⚠️ **MISSING — deal receipt/invoice PDF** (`GET /v1/broker/deals/{id}/receipt`): spec F12 has downloadable receipts for the *farmer*; on my side the GST trail (B2 income trail) is manual.

### Journey 6: When things go wrong

1. Ramesh declines the contract → `POST /v1/farmer/deals/{id}/respond` `{action:"decline", reason}` flips the deal `cancelled` (§25) — I see it in `GET /v1/broker/deals?status=cancelled` with `cancelReason`. My onion buyer is still waiting; TTL also auto-kills stalled offers nightly via `POST /v1/jobs/broker/offers/expire` *(inventory-only; sets `expired` + notifies me)* — that's the C6 TTL actually enforced, good.
2. Three counters deep and nobody's moving → the deal locks (409 `COUNTER_LIMIT_REACHED`). I call the mediator → `POST /v1/broker/deals/{id}/escalate` *(inventory-only)* — lands in the admin task queue (`GET /v1/admin/deals` / `POST /v1/admin/deals/{id}/escalate` *(inventory)*; ⚠️ noticed: the admin console list reads the legacy `deals` collection, not `broker_deals`, so my deal may not show there).
3. Weighbridge shows 47q against 50q booked (E6) — I want a pro-rata adjustment *before* completing. ⚠️ No structured mechanism: no milestone, no adjustment field; only `notes` on `PUT /v1/broker/deals/{id}`. Full auto-adjustment is explicitly deferred in plan §8.
4. Payment not released / quality fight (C9) — **broker side exists**: I open a dispute → `POST /v1/broker/deals/{id}/disputes` `{category:"payment"|"quality"|"delivery"|"other", reason}` *(inventory-only)* — evidence freezes, 72h SLA, lands in admin queue → admin rules via `GET|POST /v1/admin/disputes[/{id}/resolve]` *(inventory §28)*. ⚠️ **MISSING — farmer-side dispute open**: Ramesh has evidence upload but **no** `POST /v1/farmer/deals/{id}/disputes` — C9 says either party opens; today only I can. He'd have to pester me or support.
5. Cancellation discipline: I cancel my own mistake → `DELETE /v1/broker/deals/{id}` `{reason}` (§25) → `{ok:true, status:"cancelled"}`. ⚠️ Spec E2 strike system (warning → 48h freeze → review) is policy, not an endpoint — no strikes surface anywhere in the API.
6. Blocking a trouble contact → `POST /v1/users/me/blocks` *(inventory)* — blocked brokers' deals vanish from the farmer's list (farmer-side filter), so it also protects my counterparties from bad actors.

### Journey 7: Trust, ratings & support

1. Deal completed, both paid → I rate Ramesh → `POST /v1/ratings` `{kind:"deal", bookingId:"deal_…", rating:5, review:"sahi tol-mol, samay pe loading"}` (§ratings — verified in code: `kind:"deal"` two-sided, completed-only, updates trust tier). He rates me back — my **Proven Broker** tier → `GET /v1/broker/trust-tier` flips `proven:true` (volume + rating, spec B1/B3).
2. Stuck somewhere → `POST /v1/support/ask` *(inventory)*; FAQ → `GET /v1/faq` *(verified in code)*; Kisan Mitra chat → `POST /v1/chatbot/messages` + human expert → `POST /v1/chatbot/handoff` (§5). No phone support — spec rejects call buttons (❌ rules 1–2), tickets only.

---

**Surfaces I never touch (and why):** farm diary/7-12/insurance/schemes/e-market/dairy/equipment/land — I'm a trader, not a grower; `GET /v1/contracts` I can *view* (§7, broker role) but targeted contracts with MPIN e-sign are a farmer–buyer thing, my deals live in `/broker/deals`. Women-mode, tree, content — not my day.

---

## 7. Dairy Manager

> Milind Ghorpade, 40 — runs the Ghorpade Dudh Sangh, a milk collection center at Ozar (Nashik district, Maharashtra); 60 member farmers, morning + evening shifts; supplies 2 wholesalers in Nashik/Sinnar and sells curd–paneer locally.

### Journey 1: Getting on the platform and getting verified

1. I download the app at the center after the evening shift. I enter my mobile number; the SMS OTP is actually handled by Firebase on the phone, and my verified number reaches the backend when I send the firebase id-token → `POST /v1/auth/firebase-verify` (endpoints.md §1 — ⚠️ §1 documents `/auth/otp/send` + `/auth/otp/verify`, but neither exists in the backend; the real OTP step is Firebase-side and invisible to the API. Trust the inventory.) — app creates my session and shows me the registration wizard.
2. I complete the wizard — name Milind Ghorpade, state Maharashtra, district Nashik, village Ozar, and I tick the profiles I need → `POST /v1/auth/register` (§1) — returns my user + tokens; I set my 4-digit MPIN → `POST /v1/auth/mpin/set` (§1). From now on morning login is phone + MPIN → `POST /v1/auth/login` (§1).
3. My account is born as a farmer, so I link the dairy-manager persona → `POST /v1/users/me/profiles` with `{profileType: "dairyManager"}` (§2) and switch to it → `POST /v1/users/me/profiles/dairyManager/activate` (§2) — app opens the dairy console home.
4. Dairy handling needs FSSAI — the app won't let me post a demand or publish a rate chart without it (the endpoints call `assert_fssai_kyc`). So I open KYC and file my case → `POST /v1/kyc/cases` (§28.3) and upload my FSSAI license, PAN, GST and center electricity bill against the doc slots → `POST /v1/kyc/cases/{case_id}/docs/{doc_id}/upload` (§28.3) — status moves to pending; I keep checking → `GET /v1/kyc/status` (§10) until the ops team verifies it in their queue (their side: §28.3).
5. For farmer payouts I add the center's current account → `POST /v1/bank-accounts` (implemented in `backend/app/routers/bank_accounts.py:66` — ⚠️ the inventory extractor missed the empty-path `POST ""` route; verified in code) and trigger the ₹1 penny-drop → `POST /v1/bank-accounts/{account_id}/verify` (same router) — status shows verified; I set it primary → `POST /v1/bank-accounts/{account_id}/set-primary`.

### Journey 2: My morning — the center dashboard and today's rates

1. 5:45 AM, I open the console. The home board pulls today's live demands, open standing orders, live bids and today's liters → `GET /v1/dairy/dashboard` (⚠️ NOT in endpoints.md — implemented in `backend/app/routers/dairy_hub.py:349`; endpoints.md §2 documents a generic `GET /users/me/dashboard/{profileType}` which does not exist; the dairy-specific dashboard covers it) — I see 1,240 L collected yesterday and 3 bids waiting.
2. Before the queue starts I check my two rate charts — buffalo and cow, FAT/SNF based → `GET /v1/livestock/dairy/rate-chart?species=cow` and `?species=buffalo` (§16) — my active charts show baseRate buffalo ₹64, cow ₹38.
3. Last week a wholesaler in Nashik raised his rate by ₹2, so I revise my buffalo chart → `POST /v1/livestock/dairy/rate-chart` (§16) with the new `baseRate: 66`, `fatBase: 6.0`, `snfBase: 9.0`, `fatStep: 0.40` — activating it auto-deactivates the old one; I confirm the history → `GET /v1/livestock/dairy/rate-chart/versions?species=cow` (§16) — farmers asking "आजचा भाव काय?" can see the same chart via their own view.
4. ⚠️ There is a second, older rate-chart surface — `GET /v1/dairy-manager/rate-chart` / `PUT /v1/dairy-manager/rate-chart` — that edits ONE global doc (`dairy_rate_chart/default_chart`) shared by every dairy on the platform, not my center's chart. It also carries mandi benchmark rates and a seasonal alert string, which is genuinely useful (M12/M13), but writing to it means editing a platform-wide default. I use it read-only for the benchmark and keep my real rates in `/livestock/dairy/rate-chart`.

### Journey 3: Adding and managing my 60 member farmers

1. New farmer Ramdas Pawar from Dindori village walks in with his passbook. I add him → `POST /v1/livestock/dairy/members` (§16) with name, phone, village, bank details, `defaultSpecies: "buffalo"` and a ₹200/month can-rent deduction — app returns member `mem_…` with auto memberCode `M-482913`; I write the code on his plastic member card.
2. Every few weeks someone changes a bank account or stops supplying. I list the roster → `GET /v1/livestock/dairy/members?status=active` (§16), edit → `PUT /v1/livestock/dairy/members/{member_id}` (§16), or deactivate a member who moved to Pune → `DELETE /v1/livestock/dairy/members/{member_id}` (§16 — soft delete to inactive).
3. Ramdas questions his September payment. I open his ledger → `GET /v1/livestock/dairy/members/{member_id}/statement?date_from=2026-09-01&date_to=2026-09-30` (§16) — every slip, every payment entry, totals `{liters, amount, paid}`; the response even counts slips the adulteration AI flagged against his 30-day FAT/SNF baseline (`flaggedCount` + `flagNote`). For his bank file I download the same statement as PDF by passing `format=pdf` (same endpoint, §16) — I hand him the printout; he goes away satisfied.
4. ⚠️ His son, who also milks, wants to see slips on his own phone — that works only because I linked `farmerUid` when adding the member; the son then reads `GET /v1/livestock/dairy/farmer/slips` and `GET /v1/livestock/dairy/farmer/payments` (§16) himself. No farmerUid link, no self-view.

### Journey 4: The collection queue — recording milk (my highest-frequency screen)

1. 6:00–8:30 AM shift. For each farmer at the queue I open entry: pick member (name + memberCode prefilled), shift morning, liters, FAT %, SNF % → `POST /v1/livestock/procurement/rate-calc` (§16) first for a live preview — `{ratePerLiter, totalAmount, formula}` — so the farmer sees the rate before the can pours.
2. I save the slip → `POST /v1/livestock/procurement/collections` (§16) with `{memberId, farmerName, farmerCode, date, shift: "morning", milkType: "buffalo", liters: 14.5, fatPercent: 6.4, snfPercent: 9.2}` — server applies MY active chart (`rateChartId` is stored on the slip, below `minFat`/`minSnf` floors at `minRate`), generates `slipNumber = SLIP-20261017-M-M482913`, returns rate ₹66.80/L, amount ₹968.60. I read the slip number aloud; farmer nods.
3. Repeat for ~35 morning members; then the evening shift 5:30–7:30 PM with `shift: "evening"`. End of day I check the totals → `GET /v1/livestock/procurement/summary?date=2026-10-17` (§16) — `{totalMorningLiters, totalEveningLiters, avgFat, avgSnf, totalPayoutAmount, collectionsCount}`, scoped to MY center only.
4. If a slip was typed wrong I can see it in the day ledger → `GET /v1/livestock/procurement/collections?date=2026-10-17&shift=morning` (§16) — ⚠️ but there is no edit/delete endpoint for a recorded slip (status is always `recorded`); corrections are a new adjusting entry, not a fix. The seed/demo data quirk noted in the plan (global scans) is fixed — the list is center-scoped now.
5. ⚠️ Spec detail with no endpoint: the blueprint's F10 says the manager SCANS A QR on the farmer's card at pickup. No QR generate/scan endpoint exists anywhere in the inventory — the flow is a typed form. (Gap — see gap_parts.) Same for the "offline dead-zone QR signing" (E12): nothing to sign offline with.

### Journey 5: Paying the 60 members — settlement batches

1. On the 16th morning I generate the fortnight batch → `POST /v1/livestock/dairy/payments/batches` (§16) with `{periodFrom: "2026-10-01", periodTo: "2026-10-15"}` — server sums each member's collections, applies each member's flat deduction, writes `payment_entries`; returns the batch in `draft` with per-member liters, gross, deduction, net. Requires my FSSAI KYC (enforced).
2. I review rows (top member: Bhausaheb Thorat — 612 L, ₹40,866 gross, ₹200 deduction, ₹40,666 net), then mark the batch paid → `POST /v1/livestock/dairy/payments/batches/{batch_id}/mark-paid` (§16) with the UTR `payoutRef` from my bank app — entries flip to `paid`, every linked farmer gets an FCM push. Retrying the same button gives 409 `ALREADY_PAID`. History → `GET /v1/livestock/dairy/payments/batches` (§16).
3. ⚠️ Money reality: there is NO payout-rail endpoint — mark-paid is a ledger assertion; the actual NEFT/UPI transfer happens in my bank app outside the platform and I paste the reference. `plan/dairy_plan.md` §11 explicitly defers escrow integration for member payouts, so this is a documented deferral, not an oversight — but it means the platform cannot detect a lying `payoutRef`.

### Journey 6: Winning new supply — demands, standing orders, RFQ bids, and the 3-round negotiation

1. I need +150 L/day buffalo milk for the Diwali rush. Quick post → `POST /v1/dairy-manager/demands` (⚠️ NOT in endpoints.md — `backend/app/routers/dairy_manager.py:176`; inventory-verified) with `{milkType: "Buffalo", minFatPercent: 6.5, minSnfPercent: 9.0, dailyQuantityLiters: 150, targetRatePerLiter: 66, recurringFrequency: "Daily"}` — blocked until FSSAI verified; once live it appears to every farmer on → `GET /v1/dairy/demands/browse` (dairy_hub.py:426).
2. For my two steady wholesalers I create a full-spec standing order instead → `POST /v1/dairy/standing-orders` (⚠️ NOT in endpoints.md — `dairy_hub.py:531`) with fat/SNF bands, `minRatePerLiter: 64`, `maxRatePerLiter: 68`, `startDate/endDate` window, `frequency: "daily"` and a `pickupSlot` string — farmers browse all standing orders via `GET /v1/dairy/standing/browse` (dairy_hub.py:600). I manage my posts via `GET /v1/dairy/standing-orders` (same file), tweak → `PUT /v1/dairy/standing-orders/{order_id}`, and close when the season ends → `POST /v1/dairy/standing-orders/{order_id}/close`.
3. A farmer in Sinnar posts an offer of 75 L/day buffalo @ ₹65.5 — I spot it on → `GET /v1/dairy/bids/browse` (⚠️ NOT in endpoints.md — `dairy_hub.py:457`), check his card → `GET /v1/dairy/farmers/{farmer_id}` (dairy_hub.py:200 — rating + reviews from other dairies), then submit my bid → `POST /v1/dairy-manager/bids` with `{offeredRatePerLiter: 64.5, dailyLiters: 75, transportIncluded: true, pickupSlot: "Morning (06:00–08:30)"}`. My bids inbox → `GET /v1/dairy-manager/bids`.
4. He counters at ₹65 — I counter back → `POST /v1/dairy-manager/bids/{bid_id}/counter` — the server enforces the max-3-round rule (F7/M3/E7): a 4th counter returns 422 `MAX_ROUNDS_REACHED`, so I make my ₹64.75 counter count. He accepts.
5. I close the loop → `POST /v1/dairy-manager/bids/{bid_id}/accept` — server creates the `purchases` doc (source `dairy`, 3% buyer-side commission), opens the post-acceptance chat room, notifies the farmer, and marks my demand `fulfilled`. Chat with him now works → `GET /v1/dairy/purchases/{purchase_id}/chat-room` (dairy_hub.py:713) then `GET/POST /v1/chat/rooms/{room_id}/messages` (§24/§28.28 — chat exists ONLY after acceptance, per guardrail G2).

### Journey 7: Escrow, pickup and the money handshake on that trade

1. I pre-fund the escrow for the 75 L/day contract — spec E15: funds locked at confirmation, platform never pays from its pocket → `POST /v1/purchases/{purchase_id}/escrow/fund` (§23) — purchase moves to `advancePaid` (PAYMENT_HELD) and the farmer's 6-digit handover OTP is minted.
2. Day 1 of pickup: my agent Santosh collects the milk; the farmer reveals his OTP in his app → `GET /v1/purchases/{purchase_id}/handover-otp` (§23 — farmer-side; single-use, 15-min TTL); Santosh types it into mine → `POST /v1/purchases/{purchase_id}/handover/verify` (§23) — handover becomes `verified`, QC unlocks.
3. Santosh measures FAT 6.3 / SNF 9.1 and files inspection → `POST /v1/purchases/{purchase_id}/qc` (§23) with accepted/rejected quantities (must sum to the order qty) + photos → `POST /v1/purchases/{purchase_id}/qc/photos` — within spec, so escrow releases on completion.
4. I release the balance → `POST /v1/purchases/{purchase_id}/pay` (§23) and pull the GST-side invoice → `GET /v1/purchases/{purchase_id}/invoice` (§23) and the dairy receipt showing the 3% commission charged to MY side → `GET /v1/dairy/purchases/{purchase_id}/receipt` (dairy_hub.py:649 — commission rule also readable at `GET /v1/dairy/commission-structure`, dairy_hub.py:699). The farmer was never docked commission — that was the deal.
5. Deal done, I rate the farmer → `POST /v1/purchases/{purchase_id}/rate` (§23, `target: "farmer"`) — stars + tags feed his public card. My own reputation I check at → `GET /v1/dairy/ratings` (dairy_hub.py:413).
6. ⚠️ Spec detail not in any endpoint: F8/S10 say acceptance produces a digital booking note with OTP e-sign stored as PDF. Bid-accept only creates the purchase — there is no contract/e-sign step for dairy trades. (Gap — see gap_parts.)

### Journey 8: Farm-gate collection with my agent — routes, teams, quality flags

1. I plan tomorrow's Dindori–Ozar pickup run → `POST /v1/dairy-manager/routes` (⚠️ NOT in endpoints.md — `dairy_manager.py:362`) — `{routeName: "Morning Route Alpha", assignedAgentName: "Santosh Bhamare", scheduledDate, stops: [{farmerId, farmerName, locationPin, expectedLiters, pickupWindow, sequence}…]}` — server totals ~285 estimated liters. My routes list → `GET /v1/dairy-manager/routes` (same router). ⚠️ there is no endpoint to advance a route planned→dispatched→completed; status changes only exist in seeded demo docs.
2. Santosh works for me as a pickup agent (M5). I onboarded him when he registered on the app → `POST /v1/livestock/dairy/agents` (§16 — Pro-tier `agentSeats` entitlement, invite by uid), roster → `GET /v1/livestock/dairy/agents` (§16), deactivate when he leaves → `DELETE /v1/livestock/dairy/agents/{agent_uid}` (§16). ⚠️ No PUT — his `routeIds` are frozen from invite time; I can't reassign routes without deleting and re-adding him.
3. At each farm Santosh does the quality-checked collection → `POST /v1/dairy-manager/collection-check` (⚠️ NOT in endpoints.md — `dairy_manager.py:388`; agents allowed via `_manager_or_agent`) with liters, FAT/SNF, `ratePerLiter`, `qualityStatus: accepted|regraded|rejected`, `evidencePhotoUrl`, notes. Rejected/adjusted milk is visible to the farmer in real time (M7). Day's checks → `GET /v1/dairy-manager/collection-check`, and slip-style view → `GET /v1/dairy-manager/milk-slips` (payoutStatus per slip).
4. ⚠️ THE big hole: M6/F10 say the farmer CONFIRMS BY OTP and "the same QR anchors both ledgers". The endpoint just takes `farmerOtpVerified: true` — a boolean the caller asserts. No OTP send/verify endpoint exists for collections (the only real OTP flows are purchase handover and transport POD). Anyone can tick the box. (P0 gap — see gap_parts.)
5. The platform's adulteration AI (`dairy.adulteration.v1`, WS-07/M17) annotates every `milk_collections` slip against the member's 30-day FAT/SNF baseline; if an anomaly flag appears I review it → `POST /v1/dairy-manager/collections/{collection_id}/flag-review` (⚠️ NOT in endpoints.md — `dairy_manager.py:414`) with `action: confirm|dismiss` — advisory only, it never changes the slip's amounts, but it writes the audit log and retrains the model. Weekly route-level rollup runs as → `POST /v1/jobs/dairy/adulteration/route-summary` (§28 jobs — admin/cron side).

### Journey 9: Selling onward — customers, orders, stock, curd & paneer

1. My two wholesalers (Nashik Dairy Traders, Sinnar Milk Depot) and the local households are in the customer book → `POST /v1/livestock/dairy/sales/customers` (§16) with type shop/household, `dailyLitersAM/PM`, `ratePerLiter`; edits → `PUT /v1/livestock/dairy/sales/customers/{customer_id}`; list → `GET /v1/livestock/dairy/sales/customers`.
2. I schedule tomorrow's deliveries → `POST /v1/livestock/dairy/sales/orders` (§16) `{customerId, orderDate, shift: "am", liters: 200}` — amount auto = liters × customer rate; status `scheduled`. As cans leave I advance the machine one step at a time → `POST /v1/livestock/dairy/sales/orders/{order_id}/status` (§16) `delivered` → `billed` → `paid` (skipping returns 409 `INVALID_TRANSITION`). Outstanding vs collected → `GET /v1/livestock/dairy/sales/summary?date_from=&date_to=` and `GET /v1/livestock/dairy/sales/orders?status=billed`.
3. Curd and paneer stock → `POST /v1/livestock/dairy/stock/items` (§16) and adjust after today's paneer batch sold out → `POST /v1/livestock/dairy/stock/items/{item_id}/adjust` (§16) `{delta: -12, reason: "sold"}`; levels → `GET /v1/livestock/dairy/stock/items`.

### Journey 10: Month-end — reports, P&L, dues, and market intelligence

1. Daily close report → `GET /v1/livestock/dairy/reports/daily?date=2026-10-17` (§16) — procurement vs sales vs closing stock in one sheet.
2. The money question — is the center earning? → `GET /v1/livestock/dairy/reports/pl?month=2026-10` (§16) `{procurementCost, salesIncome, grossProfit}` and the deep dive → `GET /v1/livestock/dairy/analytics?month=2026-10` (§16 — species/shift splits, daily series, top-10 members, pending dues with `pendingNet`, previous-month comparison). ⚠️ There's also `GET /v1/dairy-manager/analytics` (`dairy_manager.py:106`) but it returns hardcoded demo trend values (e.g. `sevenDayTrend`, `routeEfficiencyPercent: 94.6`) when collections are empty — I don't trust it for decisions; `/livestock/dairy/analytics` is computed from real docs (dairy_hub header says so explicitly).
3. Before the Diwali price war I check where the market is heading → `POST /v1/ai-power/demand/forecast` (§26-adjacent — `backend/app/routers/ai_power.py:102`, ai.C4 demand.forecast.v1: low/expected/high band + stock-up/hold/reduce hint) and district benchmarks → `GET /v1/mandi/prices?crop=&district=Nashik` (§4) plus the milk benchmark table embedded in → `GET /v1/dairy-manager/rate-chart` (`mandiBenchmarkRates` + `seasonalAlert` string — the only M12/M13 surfaces that actually mention milk; mandi ticks are crop-minded, milk is not an Agmarknet commodity).

### Journey 11: My milk-seller hat (selling MY OWN milk to wholesalers)

1. The center's surplus beyond member commitments I sell as myself, so I link the milkSeller profile → `POST /v1/users/me/profiles` `{profileType: "milkSeller"}` (§2) + activate (§2).
2. My two wholesale buyers become clients → `POST /v1/milk-seller/clients`; deliveries logged individually → `POST /v1/milk-seller/deliveries` or in one shot → `POST /v1/milk-seller/deliveries/bulk` (§16-adjacent milk-seller module — inventory lines 940–942); a client's month → `GET /v1/milk-seller/clients/{client_id}/calendar?month=2026-10`; monthly bill → `POST /v1/milk-seller/bills/generate` → send → `POST /v1/milk-seller/bills/{bill_id}/send` → record his UPI settlement → `POST /v1/milk-seller/bills/{bill_id}/payments`; revenue check → `GET /v1/milk-seller/analytics?month=2026-10`.

### Journey 12: When things go wrong — disputes, flags, support

1. A farmer insists his milk was 6.8 FAT but my lactometer read 6.2 (E9 quality disagreement). On the marketplace purchase the fight has a lane: QC fails → purchase lands in `qcDisputed` and either party calls → `POST /v1/purchases/{purchase_id}/resolve` (§23) while escrow stays locked; if it escalates, ops mediates in the console (their side: `GET /admin/disputes`, verdict + `POST /admin/disputes/{dispute_id}/resolve`, §28.26/§C5 — 72-hr SLA). ⚠️ For plain member-collection slips (Journey 4) there is NO dispute-raise endpoint at all — only the AI-flag review; a grade fight on a member slip is settled by me showing the statement PDF. (Noted in gap_parts as covered-for-trades / missing-for-member-slips.)
2. Someone's agent is rude at the gate → I report the user → `POST /v1/users/{user_id}/report` (§24-adjacent) and it lands in the moderation queue (`GET /admin/reports`, §28.26).
3. For everything else there is a plain support ask → `POST /v1/support/ask` (inventory line 1000) — the only user-facing help surface (blueprint G4 bans an SOS/help section; dispute tickets + this ask are all there is).
4. My pings: bid received, batch paid, flag reviewed — inbox → `GET /v1/notifications` (implemented — `backend/app/routers/notifications.py:40` `@router.get("")`; ⚠️ again missed by the inventory extractor, verified in code), mark read → `POST /v1/notifications/{notification_id}/read`, tune → `PUT /v1/notifications/preferences`.
5. Year-end for my accountant: my data archive → `POST /v1/users/me/data-export` and `GET /v1/users/me/data-export/latest` (§2).

---

## 8. Instructor / Teacher
> Dr. Vaishali Kulkarni, 38, M.Sc. Agriculture (MPKV Rahuri), agronomist from Phaltan, Satara district, Maharashtra. Teaches paid courses on soil health & micronutrients and organic-certification prep, runs an audio podcast ("कृषी विद्या"), does on-farm visits across Satara–Pune–Solapur. Serves farmers in Marathi + Hindi.

---

### Journey 1: Onboarding & credential KYC (getting approved to publish)

1. I download the app and enter my mobile number. The OTP itself is verified inside the app's Firebase SDK — there is no platform OTP-send endpoint, the backend just takes my Firebase ID token → `POST /v1/auth/firebase-verify` (implemented; endpoints.md §1 documents `/auth/otp/send` + `/auth/otp/verify` instead — ⚠️ inventory shows Firebase-verify is the real handshake). I get back my Agrovercity session.
2. Registration wizard: name *Dr. Vaishali Kulkarni*, Phaltan/Satara/Maharashtra, profiles `["instructor"]`, `roleProfiles.instructor = {expertise: ["soil-health", "organic-farming", "drone-spraying-basics"], qualification: "M.Sc. Agriculture (MPKV Rahuri)"}` → `POST /v1/auth/register` (§1; SOP-27 §2 requires non-empty expertise for the instructor persona). I set MPIN and Marathi as preferred language → `PUT /v1/users/me/settings` (§2).
3. I build my teaching profile — headline "माती आरोग्य तज्ञ | Soil Health Specialist", 12 years' experience, institution "Agrovercity Gurukul", bio → `PUT /v1/teachers/me` (§28.27/SOP-27 §5 reference table; implemented). My public card will later be `GET /v1/teachers/{teacher_id}/card`.
4. Credential upload per the instructor checklist: my M.Sc. degree (qualification_certificate) + two experience letters (experience_letter, from Jain Agro Services and KVK Satara) → `POST /v1/teachers/me/credentials` (201; creates a KYC case `kyc_{uid}_instructor` with docs `pending`; features/farm_instructorteacher.md B2). For the identity document itself I open a case → `POST /v1/kyc/cases` and upload the PDF/Aadhaar XML via `POST /v1/kyc/cases/{case_id}/docs/{doc_id}/upload` (§10/§28.3; multipart). ⚠️ The credential call takes a `fileUrl` string, but the only multipart upload in the platform is the KYC-scoped one — course media has no uploader at all (see Journey 2, step 3).
5. Payout bank account: SBIN0001234, my savings account → `POST /v1/bank-accounts` then penny-drop → `POST /v1/bank-accounts/{account_id}/verify` (§21). Until it verifies, every payout shows `onHold`.
6. I check my verification gate → `GET /v1/kyc/status` (§10). Publishing is blocked server-side until my case is `approved` AND every specialization-required doc is verified — if I try early, `POST /v1/courses` answers 403 `KYC_NOT_APPROVED` (features/farm_instructorteacher.md B3: 48–72 h SLA, stricter than farmer).
7. The compliance officer works the queue → `GET /admin/kyc/pending` → `POST /admin/kyc/{doc_id}/verify` (§28.3). My app pings me — approval notification lands in → `GET /v1/notifications` (§24; code-verified — the mechanical inventory missed this bare route, but `notifications.py` mounts `GET /v1/notifications`).
8. My licences re-verify at expiry automatically via the cron → `POST /jobs/kyc/reverify-expired-instructor-licences` (B3 "recurring re-verification").

### Journey 2: Building my paid course (draft → pendingReview → published)

1. New course: "सूक्ष्म अन्नद्रव्ये व माती आरोग्य प्रशिक्षण" (Soil Health & Micronutrients), 8 sessions, on-farm mode, fee ₹1,499 (original ₹2,999), certificate enabled → `POST /v1/courses` (SOP-27 §5: instructor-only create; `autoPublish` defaults false so it lands in `pendingReview`). ⚠️ Two moderation wrinkles: the sibling endpoint `POST /v1/teachers/courses/create` hardcodes `status: "published"` (only `moderationStatus: pending_review`, which nothing gates on), and `/courses` with `autoPublish: true` also self-publishes — both violate SOP-27 §6.1 "nothing goes live unmoderated, instructors cannot self-publish". I use `/courses` without autoPublish.
2. Curriculum: I add 3 modules with lessons (soil sampling demo video 12 min, NPK calculation PDF, field-practice checklist) → `POST /v1/courses/{course_id}/modules`, fix typos via `PUT /v1/courses/{course_id}/modules/{module_id}`, drop one via `DELETE /v1/courses/{course_id}/modules/{module_id}` (implemented; matches T2 "syllabus, session plan"). Gated content is enforced server-side: unentitled browsers of `GET /v1/courses/{course_id}/curriculum` see lesson mediaUrls stripped unless `isPreviewFree`.
3. Media: the create body wants `thumbnailUrl` / `mediaUrl` / `previewUrl`. ⚠️ MISSING — there is **no** multipart media-upload endpoint for course material, lesson videos, or PDFs anywhere in the inventory (uploads exist only for KYC docs, diary photos, loan docs, broker evidence). I have no way to obtain a Storage URL in-app → `POST /v1/uploads` ⚠️ MISSING.
4. Rejected once ("module 2 lacks practical duration") — I see the reason in → `GET /v1/courses/mine` (`rejectedReason` is owner-visible). Edit + resubmit → `PUT /v1/courses/{course_id}` — any edit flips status back to `pendingReview` and clears the reason. `draft` also exists in the status enum if I want to park it (C12 offline drafts).
5. Admin publishes from the queue → `GET /admin/courses/queue?status=pendingReview` → `POST /admin/courses/{course_id}/review` `{action: publish}` (§28.27; reject requires a reason, writes `audit_logs`). A week later my course is featured → `POST /admin/courses/{course_id}/feature` (409 unless published).
6. I watch module KPIs through the admin lens → `GET /admin/courses/report` (§28.27: GMV, commission, instructor earnings aggregates).

### Journey 3: Podcast episode (SOP-27's podcasts)

1. I record a 15-minute Marathi audio episode "खतांची गणिते — DAP vs 12:32:16" and list it as a podcast item, kind `audioPodcast`, price ₹99, category "Soil-Fertility" → `POST /v1/courses` (SOP-27 §2: `kind` = `courseMaterial | audioPodcast | videoPodcast`; same review pipeline). Farmers browse podcasts via `GET /v1/courses?kind=audioPodcast`.
2. ⚠️ Same blocker as Journey 2 step 3 — the audio file itself cannot be uploaded (no media upload endpoint), and there is no episode/RSS listing beyond the course storefront.

### Journey 4: Structured enquiries & my fee quote (F4/T5/T6)

1. A farmer in Koregaon wants to know "Is this course suitable for 2-acre pomegranate farmers?" — that enquiry should arrive as a structured template card → ⚠️ MISSING `POST /v1/courses/{course_id}/enquiries` (the `EnquiryCreateIn` model with `questionTemplate` exists in code but **no route creates it**; features/farm_instructorteacher.md F4). My inbox → `GET /v1/teachers/enquiries` would stay empty forever without this.
2. I answer with a structured fee quote: proposed fee ₹1,499, terms "2 instalments, materials included, refund 50% ≥48h before batch" → `POST /v1/teachers/enquiries/{enquiry_id}/quote` (T6 offer/fee-quote card; sets `quotedFeeRupees` + `status: quoted`).
3. The farmer counters at ₹1,200. ⚠️ MISSING — there is no counter-offer, accept, or expiry endpoint on enquiries (features/farm_instructorteacher.md F6/T7/C6: bid → counter → accept/expire with **TTL 24–48 h**; the quote has no `ttlHours` and no expiry job either) → suggested `POST /v1/teachers/enquiries/{enquiry_id}/counter` + `.../accept`.

### Journey 5: Booking confirmed → e-contract → chat unlock (T8/C5/C7)

1. Ramesh Bhilare from Wai enrolls: `POST /v1/courses/{course_id}/enroll` (coins allowed — `coinsDiscountAllowed` caps AgriCoins redemption, max 50% of fee) or paid → `POST /v1/courses/{course_id}/purchase` → Razorpay → `POST /v1/courses/purchases/verify` (SOP-27 §5; signature-verified, idempotent `{userId}_{courseId}`). Verification auto-generates our e-contract (fee, curriculum scope, refund policy from `platform_config/course_refund`) and pings me a `course_booking` notification.
2. I pull the contract → `GET /v1/courses/purchases/{purchase_id}/contract` (C5 e-contract: parties, fee ₹1,499, module list, refund terms; 409 until paid).
3. Chat is locked before booking by design (D1) — now it unlocks because Ramesh holds a paid purchase. I open the doubt-solving room → `POST /v1/teachers/chat/open` (`studentId`; 403 `CHAT_LOCKED_FOR_ENROLLMENT` otherwise), my rooms → `GET /v1/teachers/chat/rooms`, messages → `GET /v1/chat/rooms/{room_id}/messages` / `POST /v1/chat/rooms/{room_id}/messages` (C7; text+image with D4 moderation). His side is `POST /v1/courses/{course_id}/chat`.
4. Roster: all my students → `GET /v1/teachers/students` (paid purchases joined with progress/certificate), per course → `GET /v1/teachers/courses/{course_id}/students`, one farmer's full file → `GET /v1/teachers/students/{student_id}` (village, active crops, open lots, his courses with me).
5. Batch-wide notice ("Saturday session shifted to 9 AM due to heat") → `POST /v1/teachers/courses/{course_id}/announcements`, list → `GET /v1/teachers/courses/{course_id}/announcements`.

### Journey 6: Batch, sessions & QR attendance (T3/T10/F8)

1. I schedule the June batch → `POST /v1/teachers/batches` `{courseId, batchName: "जून-2026 बॅच", startDate, endDate, locationPin, maxSeats: 25, scheduleDays: "Mon-Wed-Fri"}` (KYC-gated like publishing), list → `GET /v1/teachers/batches`.
2. Harvest-season blackouts and 1-on-1 slots: ⚠️ MISSING — no availability/blackout-calendar endpoint (T3); batches carry only batch schedules → suggested `PUT /v1/teachers/availability`.
3. Sessions: ⚠️ MISSING — nothing creates a `session` under a batch; attendance hangs off a bare `session_id` → suggested `POST /v1/teachers/batches/{batch_id}/sessions`.
4. Session day: I want a QR code farmers scan at check-in → ⚠️ MISSING — no QR generation endpoint and no farmer self check-in (`POST /v1/sessions/{session_id}/check-in`) even though F8 mandates QR scan at session start and `AttendanceMarkIn` already carries `verificationMethod: "qr_scan"`. What exists: I mark manually → `POST /v1/teachers/sessions/{session_id}/attendance` `{studentId, status}`, view → `GET /v1/teachers/sessions/{session_id}/attendance`. ⚠️ That GET **seeds three fake students** (Kishor Mahajan, Vilas Patil, Nilesh Borse) on first call — a demo-fallback in a module whose header claims "no synthetic fallbacks".

### Journey 7: Practical assignments & assessment (F9/T11)

1. I post the field assignment ("collect 3 soil samples, photograph the pit + bag label") → ⚠️ MISSING `POST /v1/courses/{course_id}/assignments`.
2. Ramesh submits photo-only evidence → ⚠️ MISSING submission endpoint (F9 is explicitly photo-only; `AssignmentSubmitIn` with `evidencePhotoUrls` exists as a model but has no route) → suggested `POST /v1/assignments/{assignment_id}/submissions`.
3. What works: my grading queue → `GET /v1/teachers/assignments` — on first view it pre-computes an AI grade suggestion (`aiSuggestion`, a prefill I must confirm), and I publish the grade → `POST /v1/teachers/assignments/{assignment_id}/grade` `{grade: "A", feedback, passed}` (T11; outcome hook records my grade vs the AI suggestion).

### Journey 8: Student Q&A

1. Ramesh asks a doubt on the course wall → `POST /v1/courses/{course_id}/questions` (his step). I read → `GET /v1/courses/{course_id}/questions` and answer → `POST /v1/courses/{course_id}/questions/{question_id}/answers` (flagged `isInstructor: true`, capped 2000 chars).

### Journey 9: Certificate issuance & public verification (T12/C13/E19)

1. He finished all lessons; I issue the completion certificate → `POST /v1/teachers/courses/{course_id}/students/{student_id}/certificate` (T12; sets `isCompleted`, mints `CERT-GS-XXXX-…`, attaches an AI learning-path suggestion, notifies him `certificate_issued`).
2. The certificate payload with the QR + SHA-256 tamper fingerprint → `GET /v1/teachers/certificates/{certificate_id}/download` (co-branded "GyanSetu Digital Krishi Gurukul"; `qrPayload` = `{verificationUrl, cert, sha256}`).
3. His employer verifies it publicly — no login, cert ID + name only (C13 privacy guardrail: no phone) → `GET /v1/teachers/certificates/verify/{certificate_id}` → `{isValid, recipientName, courseTitle, issuedAt}`.
4. If a certificate is ever forged or must be pulled: ⚠️ MISSING — no revocation endpoint (E19's revocation list; D5's `certificate.revoked` audit event) → suggested `POST /v1/teachers/certificates/{certificate_id}/revoke`.

### Journey 10: Earnings, commission & Monday payout (T14/E7)

1. My ledger → `GET /v1/teachers/earnings`: gross − commission = net in paisa, per-course breakdown, `nextPayoutDate` (next Monday), `onHold: true` until my bank account is penny-drop verified (phase-00 hold rule). June closes at 42 sales × ₹1,499 = ₹62,958 gross; commission is config-driven (`courseGMVPct`, band 15–20%) → ₹9,444 at 15% → ₹53,514 net.
2. Per-booking payment history → `GET /v1/teachers/payments/history` (each purchase with commission split + `payoutStatus: scheduled|onHold`, totals).
3. Before quoting fees I check what the platform takes → `GET /v1/teachers/commission-structure` (T14 transparency: 15–20% band, charged from instructor side).
4. Performance → `GET /v1/teachers/analytics` — ⚠️ the full set (earnings, completion rate, ratings) requires the `analytics_full` Pro entitlement; free tier shows only course/student counts. Ratings land in → `GET /v1/teachers/feedback` (course reviews + enrollment ratings).
5. Monday payout runs as cron → `POST /jobs/settlements/run` (accrues my payable from paid purchases) → `POST /jobs/settlements/payouts` (releases to my verified bank; E7 escrow: session completed + silent window). ⚠️ I can see accruals but never the settlement rows/UTR refs → MISSING `GET /v1/instructor/settlements` (transport/equipment/broker personas all have their own `/settlements` view; P2).

### Journey 11: When things go wrong (E1/E2/E4/C9)

1. Ramesh cancels 3 days before the batch (family emergency) — E1 promises tiered refund (free ≥48 h; 50% 24–48 h; 0% <24 h) and the e-contract already carries the refund policy. ⚠️ MISSING — there is no cancel endpoint for a course purchase at all (orders have `POST /orders/{id}/cancel`; courses don't) → suggested `POST /v1/courses/purchases/{purchase_id}/cancel`. The raw rails exist (`POST /payments/razorpay/refund`) but nothing booking-aware ties them to the policy, slot reopen, or my strike.
2. A dispute — say a farmer claims I never showed up (E4 no-show) while my attendance sheet says otherwise. C9 promises an in-app evidence dispute that auto-freezes my payout. ⚠️ MISSING — no user-side dispute creation for course bookings (equipment/transport/land/broker bookings each have one; only the admin desk `GET /admin/disputes` → `POST /admin/disputes/{dispute_id}/resolve` exists) → suggested `POST /v1/courses/purchases/{purchase_id}/disputes`. P0: without it, C3's freeze/refund/appeal workflow can't start.
3. Chat abuse (someone typing phone numbers) — I report the user → `POST /v1/users/{user_id}/report` (moderation queue `GET /admin/reports`; penalty ladder D4).

### Journey 12: Daily home, support & plumbing

1. My morning screen → `GET /v1/teachers/home` (identity header with verified letters, latest course, all courses, rated list, stats: totalStudents 42, completedStudents 31, totalEarningsRupees, unreadNotifications).
2. Notification inbox → `GET /v1/notifications` (type/unread filters; mark one read `POST /v1/notifications/{id}/read`, all → `PUT /v1/notifications/read-all`; preferences `GET/PUT /v1/notifications/preferences`; T16 events: enquiry, booking, payout, dispute).
3. Poor network at the farm — queued writes replay via → `POST /v1/sync` (C12 offline tolerance; Idempotency-Key on all writes).
4. Escalation to a human expert when Kisan Mitra can't help → `POST /v1/chatbot/handoff` (sends my farm/teaching context; `GET /v1/chatbot/expert-tickets/{ticket_id}/messages` for the thread).
5. My coin side-income (referrals, streaks) → `GET /v1/gamification/ledger` (§19).
6. Workshops I teach: §17 workshops are admin-curated content (`POST /admin/content/workshops` creates them; `GET /admin/workshops/{workshop_id}/roster` lists my batch roster; farmers enroll via `POST /v1/workshops/{id}/enroll`). There is no instructor-side workshop roster/earnings surface — I see my workshop only when admin lists me as the instructor (§17 `PaidWorkshop.instructor`).
7. Logout → `POST /v1/auth/logout` (§1).

**Inventory notes:** `GET /v1/notifications`, `POST /v1/notifications`, `GET /v1/teachers` (directory) and `GET/POST /v1/bank-accounts` are implemented in code but absent from `/tmp/implemented_endpoints_v2.txt` (the extractor skipped bare `""` routes); I verified them against the router sources. Conversely, endpoints.md §1's `/auth/otp/send` + `/auth/otp/verify` do not exist — Firebase-verify replaces them.

---

## 9. Direct Buyer
> Sneha Kulkarni, 33, procurement head at **Shree Foods Pvt Ltd** (Nashik — tomato paste & ketchup factory), buys ~200T/month of tomato, onion and pulses (toor, chana) from farmers across Maharashtra, Karnataka and Gujarat; company GSTIN 27AAKCS1234F1Z5, net-30 payment terms, three delivery warehouses.

**Verification note (read first):** the mechanical inventory in `/tmp/implemented_endpoints_v2.txt` drops every bare-collection route (FastAPI paths registered as `""`). Against the live router sources, these ARE implemented and mounted under `/v1` in `backend/app/main.py`: `POST/GET /v1/demands`, `POST /v1/offers`, `POST/GET /v1/purchases`, `POST/GET /v1/contracts`, `GET /v1/contracts/mine`, `GET/POST /v1/addresses`, `GET /v1/buyer-org`, `GET/POST /v1/specs`. I cite them below as implemented (code-verified); where only the inventory was ambiguous I say so.

---

### Journey 1: Company onboarding & KYC — "get Shree Foods verified so farmers trust us"

1. I download the app on my office phone (+91 92222 22222 — the company's quick-login demo number) and sign in with OTP → `POST /v1/auth/otp/send` then `POST /v1/auth/otp/verify` (endpoints.md §1) — I get `{ accessToken, refreshToken, isNewUser: true }`. I set my 4-digit MPIN for payments/contract signing → `POST /v1/auth/mpin/set`.
2. Registration wizard: name "Sneha Kulkarni", language English+Marathi, and profiles `["directBuyer"]` → `POST /v1/auth/register` (§1). The app then collects my business identity — companyName "Shree Foods Pvt Ltd", buyerType `processor`, GSTIN `27AAKCS1234F1Z5`, categories [tomato, onion, pulses], capacityPerMonth 200 (tonnes), operatingStates [Maharashtra, Karnataka, Gujarat], creditTermsDays 30 — via `PUT /v1/users/me/persona-setup` (§2 extension; saves `roleProfiles.directBuyer`). The GSTIN is format-validated server-side (`services/gstin.py` regex + GSTN provider hook). ⚠️ The spec's B.2 onboarding gate says **unverified buyers cannot bid or post demand** — the verified badge appears only after step 6; nothing in the API enforces a hard "unverified = read-only" flag, so treat the gate as a product rule, not an API 403.
3. I register our three delivery points — Nashik plant (default), Dhule godown, Hubballi collection centre — with geo-pins from the map → `POST /v1/addresses` ×3, `GET /v1/addresses` to review (§21-adjacent; `backend/app/routers/addresses.py`). This is the **B15 multi-address warehouse registry** that radius-matching reads. I can edit → `PUT /v1/addresses/{address_id}`, retire → `DELETE /v1/addresses/{address_id}`.
4. Escrow money rail: I add Shree Foods' current account → `POST /v1/bank-accounts` and run the ₹1 penny-drop → `POST /v1/bank-accounts/{account_id}/verify` (§21). ⚠️ Spec B.2 step 6 says "bank + escrow setup (penny-drop) … escrow mandate" — there is no separate escrow-mandate endpoint; escrow is funded per purchase later (Journey 5).
5. KYC pack for a processor: PAN (firm + proprietor), GST certificate, Udyam registration, cancelled cheque → `POST /v1/kyc/cases` then upload each scan → `POST /v1/kyc/cases/{case_id}/docs/{doc_id}/upload`; I track status → `GET /v1/kyc/status` (SOP-03 / `routers/kyc.py`). Copies also go in my document vault → `POST /v1/vault/documents` (§10).
6. The compliance team reviews in the console → `GET /admin/kyc/pending`, `POST /admin/kyc/{id}/verify` (§28.3) and flips our buyer record → `POST /admin/buyers/{buyer_id}/verify` (§28.5-area, `admin_sop_trade.py`). My profile now carries the verified badge → `GET /v1/direct-buyer/profile` (§23) shows `roleProfile` + stats `{totalPurchases, totalSpend, activeDemands}`. **B1 done.**

### Journey 2: Daily cockpit — "what do I buy today, and at what भाव?"

1. Home → `GET /v1/direct-buyer/dashboard` (§23-area) — today's live demands, last 5 purchases, recent posts, open standing orders, my farmer-facing rating, unread notifications. The persona shell also hydrates → `GET /v1/users/me/dashboard/directBuyer` (§2).
2. Market intel before I commit a rupee: Lasalgaon/Nashik modal for onion → `GET /v1/mandi/prices?crop=onion&district=Nashik` (§4 — directBuyer is in `MANDI_ROLES`), the 2-hourly "Aaj ke Bhav" strip → `GET /v1/mandi/vyapari-rates?crops=onion,tomato`, best-mandi math incl. transport → `GET /v1/mandi/compare` (§4), and the 7/30-day band for planning → `GET /v1/mandi/forecast?crop=tomato` (§26-area). **B12 market ticker** ✓. I set a watcher "alert me if Nashik tomato modal ≤ ₹700" → `POST /v1/price-alerts`, list → `GET /v1/price-alerts` (§26).
3. The cross-persona digest → `GET /v1/intelligence` (§26) — my spend/volume KPIs, monthly procurement series, crop breakdown, and insights like `buying_below_mandi` / `balance_due`. Full dashboard for the month → `GET /v1/direct-buyer/analytics` (§23): `{totalSpend, totalVolume, activeDemands, openOffers, purchasesByStatus, monthlyProcurement, cropBreakdown, topSuppliers, avgPriceVsMandi, qcRejectionRate, completionRate, pendingBalance}` — this is my **analytics-vs-mandi** proof for the CFO.
4. News that moves sourcing (monsoon delay in Kolar tomato arrivals) → `GET /v1/news?category=market` (§17); weather at my suppliers' districts → `GET /v1/weather?lat=&lng=` (§5).
5. My alerts inbox: offer received, escrow funded, QC disputed → `GET /v1/notifications?page=`, mark read → `POST /v1/notifications/{id}/read`, `PUT /v1/notifications/read-all` (§24).

### Journey 3: Spot procurement — post a demand, take farmer bids, haggle, close

1. Monsoon gap at Kolar means I need 200 q of Grade A tomato by Friday, ceiling ₹900/q, delivered to Nashik plant → `POST /v1/demands` `{crop: tomato, quantity: 200, qualityGrade: A, maxPrice: 900, deliveryLocation: "Nashik plant", neededBy: 2026-10-23, frequency: oneTime, notes}` (§23) → 201 `dem_…`, status `open`, `offersCount: 0`, stamped `buyerCompany: "Shree Foods Pvt Ltd"`.
2. Farmers discover it on the public board → `GET /v1/demands/browse` (all roles) and bid → `POST /v1/offers` `{targetType: demand, targetId: dem_…, pricePerUnit: 880, quantity: 120, message}` (§23). ⚠️ Spec E15 says escrow **pre-funding is mandatory before bidding** — implemented flow funds escrow only *after* a deal is confirmed (Journey 5); the anti-default protection is weaker than the spec's wording. ⚠️ Offers lazily expire after **24 h** (`_expiry_iso`) — I don't have to micro-manage stale bids.
3. I compare incoming bids → `GET /v1/offers/mine?filter=received&targetType=demand` (§23) — Ramchandra Patil (Malegaon, ★4.7) at ₹880/q for 120 q; Dattu Bhise (Dhule, ★4.4) at ₹895/q for the full 200 q. I check each farmer before committing → `GET /v1/direct-buyer/farmers/{farmer_id}` (farmer 360: village, rating, deal history) and read reviews → `GET /v1/direct-buyer/ratings` is my own; his public aggregate shows in the feed enrichment.
4. Counter round 1: I counter Patil at ₹860/q → `POST /v1/offers/{offer_id}/counter` `{pricePerUnit: 860, note: "120 q, cash-and-carry कांटा at your farm"}` (§23). He counters back ₹872 → status `countered`. Round 2 → I counter ₹870. **Three counter rounds max** (`MAX_NEGOTIATION_ROUNDS = 3`, full `negotiationLog` kept — spec F7/B3/E7 "max 3 rounds" ✓); a 4th → 400 `NEGOTIATION_CLOSED`, accept/reject/withdraw only. He accepts my counter → `POST /v1/offers/{offer_id}/accept` (§23) → 200 `{offer, purchase}` — a **purchase is auto-created** (`status: confirmed`, `agreedPricePerUnit: 870`, `source.type: offer`), demand flips `fulfilled`. ⚠️ The e-sign term sheet (spec F8/S10 "auto-generated term sheet, OTP e-sign") is not a separate endpoint for spot purchases — the purchase doc + events are the legal record; MPIN e-sign exists only on contracts (Journey 4).
5. Alternative lane — buy-now off a farmer's lot without haggling: my for-you feed shows a matching lot → `GET /v1/direct-buyer/feed?limit=20` (§23, matches my active demand crops + saved farmers) or the full browse → `GET /v1/direct-buyer/farmer-posts?crop=tomato` (with farmer name/village/rating/verified badge). Lot detail → `GET /v1/market/lots/{lot_id}` (§7-area). One tap → `POST /v1/purchases` `{lotId, quantity}` (§23) at the lot's `expectedRate`; the lot decrements and marks `sold` when consumed. Chat with the farmer opens only now (spec G2 post-booking) → `GET /v1/purchases/{purchase_id}/chat-room` → `GET/POST /v1/chat/rooms/{room_id}/messages` (§23/`chat.py`); ⚠️ phone numbers/URLs are regex-blocked in chat (spec D.3) — by design.
6. Demand hygiene: bought elsewhere → `POST /v1/demands/{demand_id}/close` (idempotent); price crashed and I want bids again → `POST /v1/demands/{demand_id}/reopen`; fix quantity → `PUT /v1/demands/{demand_id}` (open only, else 400 `DEMAND_CLOSED`); delete → `DELETE /v1/demands/{demand_id}` — 409 `DEMAND_HAS_OFFERS` while pending offers reference it (§23).

### Journey 4: Contract farming — "lock 500 q of tomatoes for the paste line, mandi-linked"

1. Our QA head Mahesh builds the quality spec once → `POST /v1/specs` `{crop: tomato, name: "Ketchup Grade", params: [BRIX % ≥4.5 adj +₹150/unit, size mm 55–70, defect % ≤5 adj −₹120/unit]}`; template library → `GET /v1/specs?crop=tomato` (§26-area P9, `routers/specs.py`).
2. I pick Ramchandra (already in my trusted network — added via `POST /v1/direct-buyer/saved-farmers {farmerId}`, listed → `GET /v1/direct-buyer/saved-farmers`, dropped → `DELETE /v1/direct-buyer/saved-farmers/{farmer_id}`, §23) and send a targeted supply contract → `POST /v1/contracts` (§26): `{farmerId, crop: tomato, specId, quantityTotal: 500, priceType: "mandiLinked", mandiName: "Nashik", premiumPerQuintal: 160, schedule: {startDate: 2026-11-02, endDate: 2026-12-28, frequency: weekly, qtyPerDelivery: 25}, deliveryLocation: "Nashik plant", paymentTermsDays: 30, termsText}` → 201 `con_…`, status `offered`; the farmer is notified (`contract_offer_received`). My contracts → `GET /v1/contracts/mine?role=buyer` (each enriched with **currentPrice** = live mandi modal + premium), pipeline KPIs → `GET /v1/contracts/analytics`, reusable drafts → `GET /v1/contracts/templates`.
3. Farmer signs with MPIN e-sign → `POST /v1/contracts/{contract_id}/accept` (§26, targeted: only that farmer, `offered → active`, acceptance record with `signatureData`+`consentTimestamp`). He can instead decline → `POST /v1/contracts/{contract_id}/decline` {reason} (notifies me; I can re-offer once) or ask me to tweak terms while `offered` → I `PUT /v1/contracts/{contract_id}`. Walk away → `POST /v1/contracts/{contract_id}/cancel`.
4. Every Monday slot: "create purchase order" → `POST /v1/contracts/{contract_id}/deliveries` `{slotDate}` (§26) → 201 a real purchase (`status: confirmed`, `source.type: "contract"`, `contractId`, `deliverySlot`, quantity 25 q, rate = Nashik modal + ₹160). Idempotent per slot — replay returns the same purchase. Track fulfilment → `GET /v1/contracts/{contract_id}/deliveries` → `{data: [{slotDate, purchaseId, status}], fulfilment: {total, completed, cancelled, pending}}`. ⚠️ If Agmarknet data is missing for the slot date, 422 `NO_MANDI_DATA` — I fall back to a fixed-rate contract or wait for the nightly mandi sync (`POST /admin/mandi/sync`, §28.4).

### Journey 5: Money & handover per delivery — escrow → OTP → sliding QC → invoice

1. Prashant (finance seat) pre-funds the deal into escrow so the farmer sees "paisa held — safe to load" → `POST /v1/purchases/{purchase_id}/escrow/fund` `{amount}` (§23) — 25 q × ₹2,300 = ₹57,500 held; purchase → `advancePaid`; farmer gets `escrow_funded` push. ⚠️ Org-gated: only a `finance`/`admin` org member can fund (403 `ORG_ROLE_REQUIRED` otherwise — Journey 6). ⚠️ Money here is a ledger entry (`method`/`reference` strings); the spec's true gateway payout to farmer bank/UPI is deferred (plan §11) — release = escrow ledger flip, farmer sees payout on his side of the receipt.
2. Kavita (procurement) schedules the pickup with mode + slot → `POST /v1/purchases/{purchase_id}/pickup` `{date: 2026-10-20, mode: "buyerPicksup", slot: "06:00–09:00", vehicleType: "pickup_1t", address: "Ramchandra's farm pin, Malegaon"}` (§23, P4 mode/slot shipped). If I need a hired truck instead of our own: fare first → `POST /v1/transport/fare-estimate`, book → `POST /v1/transport/bookings` (§7 — directBuyer is a valid booker), track → `GET /v1/transport/bookings?status=` (spec B4/B5 fleet-route/agent app is deliberately out of scope, plan §11 — one booking per purchase it is).
3. Truck loaded: Kavita marks dispatch → `POST /v1/purchases/{purchase_id}/dispatch`, gate-in at the plant → `POST /v1/purchases/{purchase_id}/deliver` (§23) — status `delivered`.
4. **Handover lock (spec F10/B6, E17 OTP = farmer's power button):** at the farm gate Ramchandra reveals his OTP → `GET /v1/purchases/{purchase_id}/handover-otp` (farmer-side; fresh ~15-min window, regenerates on expiry — ⚠️ TTL is server-held, not in the API doc); Mahesh (QA) enters it → `POST /v1/purchases/{purchase_id}/handover/verify` `{otp}` — wrong/expired → attempt-capped error. ⚠️ Spec B6/E12 want a **scannable QR** (incl. offline-signed QR in rural dead zones); v1 is OTP-only — plan §9/§11 explicitly defers QR, so this is a documented deviation, and OTP verify is the anchor both ledgers share.
5. **QC with sliding price (B7 + E9/E18):** Mahesh measures the spec on the कांटा → `POST /v1/purchases/{purchase_id}/qc` `{grade: A, acceptedQty: 25, rejectedQty: 0, measurements: [{name: "BRIX %", value: 5.1}], photos: [...]}` (§23). With the contract's `specSnapshot`, the server computes per-parameter deviation × adjustment: BRIX 5.1 vs ≥4.5 → +₹90/q … final rate = agreed + Σ adjustments → `finalAmount`. Photo evidence uploads separately → `POST /v1/purchases/{purchase_id}/qc/photos` (multipart, ≤5, `delivered|qcDisputed` only). Full accept → `completed`, **escrow released**, invoice auto-issued. ⚠️ Release happens at **QC-complete, not at OTP** (plan §9 documented deviation from B9's "release on farmer OTP" wording — one-line backend flip if product insists).
6. **Partial reject path (E18 split ledger):** 3 q of the 25 q rot-damaged → same `qc` call with `acceptedQty: 22, rejectedQty: 3` → status `qcDisputed`, escrow release paused (`disputeOpenedAt`), farmer sees the flag + photos in real time (`qc_disputed` push). We settle on a call → either party records → `POST /v1/purchases/{purchase_id}/resolve` `{resolution: "22 q at ₹2,390 incl. BRIX bonus; 3 q rejected, no payment"}` → `completed` at adjusted `finalAmount`, invoice issued, `dispute_resolved` push. The silent-window cron auto-releases if nobody acts → `POST /v1/jobs/escrow/release-due` (§23-area, cron-secret).
7. Balance money: any residual due → `POST /v1/purchases/{purchase_id}/pay` `{amount, kind: balance|full, method, reference}` — 409 `PAYMENT_EXCEEDS_DUE` if I overpay; the full ledger (`payments[]`: escrow/advance/balance) lives on → `GET /v1/purchases/{purchase_id}` (§23).
8. Paperwork: tax invoice → `GET /v1/purchases/{purchase_id}/invoice` (§23) → `{number: "INV-XXXXXXXX-YYMM", issuedAt, lines, totalAmount}` incl. the platform commission line (1–2%, buyer-side, never deducted from farmer payout). Trade receipt with both parties + commission math → `GET /v1/purchases/{purchase_id}/receipt`. ⚠️ **Invoice is JSON only — no GSTIN/CGST/SGST breakdown, no PDF download** (see Gap P1; the seller persona already has `GET /seller/sales/{sale_id}/invoice.pdf` as the in-platform precedent).
9. We rate each other → `POST /v1/purchases/{purchase_id}/rate` `{target: farmer, rating: 5, review: "कांटा honest, graded true"}` (§23, `completed` only, one per side, 409 `ALREADY_RATED`); Ramchandra rates Shree Foods back — my public average → `GET /v1/direct-buyer/ratings` (feeds my standing on every future bid).

### Journey 6: Team sub-accounts — Prashant pays, Mahesh inspects, Kavita contracts (B16)

1. I invite my three colleagues by their registered numbers → `POST /v1/buyer-org/invite` `{phone: "+91…", role: "finance"|"qa"|"procurement"}` (§23-area P12, `routers/buyer_org.py`). ⚠️ They must **already be registered users** (404 `USER_NOT_FOUND` otherwise — no SMS invite yet, plan R4); ⚠️ inviting seats is entitlement-gated (402/429 if our plan has no org-member seats).
2. Roster → `GET /v1/buyer-org` (auto-creates a single-member admin org on first call). Remove → `DELETE /v1/buyer-org/members/{member_uid}` (admin only, 400 `CANNOT_REMOVE_ADMIN`).
3. RBAC in action: Prashant funds escrow (Journey 5.1), Mahesh files QC (5.5), Kavita creates/edits contracts (Journey 4.2 — `POST/PUT /contracts` require `procurement|admin` org role); cross-role attempts → 403 `ORG_ROLE_REQUIRED`. Every money/contract/QC action carries the actor's role badge in the UI.

### Journey 7: Standing orders — my daily tomato line (B2)

1. The paste line consumes 40 q of Grade B tomato **daily**; I post it once as a template → `POST /v1/direct-buyer/standing-orders` `{crop: tomato, qualityGrade: B, quantityPerSlot: 40, minPrice: 550, maxPrice: 780, frequency: daily, startDate, endDate, serviceArea: {address: "Nashik plant", lat, lng, radiusKm: 40}, deliveryLocation: "Nashik plant, gate 2, before 6 AM"}` (§23-area) → 201 `sod_…` with the price band validated (422 `INVALID_PRICE_BAND` if min > max). Farmers see it on the standing board → `GET /v1/demands/standing` (all roles).
2. Manage: list → `GET /v1/direct-buyer/standing-orders?status=open`, tweak the band → `PUT /v1/direct-buyer/standing-orders/{order_id}`, pause the line → `POST /v1/direct-buyer/standing-orders/{order_id}/close`. My home shows open standing count → `GET /v1/direct-buyer/dashboard`.
3. ⚠️ **The recurring half is manual**: standing orders are a registry farmers can browse, but **no job turns them into per-period demands** — the recurring planner (`POST /v1/jobs/subscriptions/planner/run`) only serves e-market `customer_subscriptions`. Either I clone demands by hand (`POST /v1/demands`) or this stays a Gap (see P1 gap #3).

### Journey 8: When things go wrong — cancellations & disputes

1. Supplier falls through before pickup: cancel → `POST /v1/purchases/{purchase_id}/cancel` `{reason: "farmer asked to postpone, rabi spraying"}` — allowed from `confirmed|advancePaid|pickupScheduled` (400 from `inTransit` on); escrow refunds, farmer notified, my buyer score takes the hit (spec E2 compensation math is admin-side, not an endpoint).
2. Quality fight at the gate → the Journey 5.6 path (qc → `qcDisputed` → `resolve`).
3. **Everything else — farmer no-show (E3), payment-not-received (E6), transit damage claim (E5), buyer-agent no-show (E4): there is no way for me to raise a dispute ticket on a purchase.** The unified dispute pipeline exists server-side (`services/disputes.py` → `disputes` collection → AI triage → `GET /admin/disputes` queue → `POST /admin/disputes/{dispute_id}/resolve`, §28) but its only writer is a broker-deal escalation — purchase parties can't reach it. ⚠️ MISSING — `POST /v1/purchases/{purchase_id}/disputes` (Gap P0 #1). My only fallback today: cancel with reason + `POST /v1/users/{user_id}/report` (report the counterparty, §2-area) and hope ops picks it up.
4. Spec G4 reminder: there is deliberately **no SOS/help section** — `POST /v1/support/ask` exists for how-do-I questions, but transaction fights must route via dispute tickets… which don't exist for purchases (above).

### Journey 9: Month-end — books, benchmarks & the CFO pack

1. Where did we land vs the mandi? → `GET /v1/direct-buyer/analytics` — `avgPriceVsMandi` per crop (my ₹2,310 realized vs Nashik modal ₹2,150 — we paid the ₹160 contract premium and saved the mandi commission + freight), `qcRejectionRate` (4.1%), `topSuppliers` (Patil, Bhise, FPO Sinnar), `pendingBalance` for net-30 accruals.
2. Commission transparency (B14): rate card → `GET /v1/direct-buyer/commission-structure` (1–2% band, charged to buyer, floor ₹50); per-trade commission lines → `GET /v1/purchases/{purchase_id}/receipt`. ⚠️ **No monthly exportable statement** (sellers have `/seller/tds-statements` + PDF; I don't) — Gap P2 #4. Workaround: page purchases → `GET /v1/purchases?role=buyer&page=` (§23) and export client-side.
3. Farmer bench strength: saved network → `GET /v1/direct-buyer/saved-farmers` (ratings averaged from my purchases), a farmer's 360 → `GET /v1/direct-buyer/farmers/{farmer_id}`. ⚠️ **B10's composite reliability score** (show-up rate, grade consistency, dispute history driving bid priority) is not an endpoint — only the star average exists; cf. transporters' `/v1/transport/farmers/{farmer_id}/reputation`. Gap P2 #5.
4. Rates I still owe ratings for → `GET /v1/ratings/pending` (`routers/ratings.py`).
5. My credit line for input financing → `GET /v1/finance/credit-score` (§11); loan EMI math if I bridge a big procurement → `POST /v1/finance/loan-calculator`.

### Journey 10: Platform touchpoints — chatbot, content, coins, referrals

1. "GST on commission line kaisa dikhega?" → `POST /v1/chatbot/messages` `{text, language: "hi"}` (§5, Kisan Mitra LLM), history → `GET /v1/chatbot/history?sessionId=`; need a human → `POST /v1/chatbot/handoff` (§5) / expert tickets → `GET /v1/chatbot/expert-tickets`.
2. Agronomy content for our contract growers (Kolar tomato spacing for paste varieties) → `GET /v1/videos?category=`, `GET /v1/blogs?category=`, workshops for my QC team → `GET /v1/workshops`, enroll → `POST /v1/workshops/{workshop_id}/enroll` (§17). Expert talks → `GET /v1/expert-talks`, register → `POST /v1/expert-talks/{talk_id}/register`.
3. Coins from referrals of farmer-suppliers → `GET /v1/referrals`, invite → `POST /v1/referrals/invite` (§19); status → `GET /v1/gamification/status`, ledger → `GET /v1/gamification/ledger`, redeem → `POST /v1/gamification/redeem`.
4. Settings & privacy: `PUT /v1/users/me/settings` (language/women-mode/contrast), consent → `PUT /v1/users/me/consents`, data export → `POST /v1/users/me/data-export`, sessions → `GET /v1/auth/sessions`, revoke → `DELETE /v1/auth/sessions/{jti}`, logout → `POST /v1/auth/logout` (§1).
5. Admin-side moments I never see but depend on: ops can force-cancel my purchases/audit them → `GET /admin/procurements` (§28.5), flip a lot → `PUT /admin/lots/{lot_id}/status`, suspend a fraudulent counterparty → `POST /admin/users/{uid}/status` (§28.2), broadcast a region force-majeure (E16) → `POST /admin/broadcast` (§28.26).

---

**Surfaces I never touch (and why):** farm diary/P&L, land leasing, equipment rental, livestock/dairy, insurance, loans-as-borrower, post-harvest provider console, cold-storage provider, gaushala, gruh-udyog, courses-as-teacher, broker deal desk (ProcurePro buys direct), e-market customer storefront (that's B2C retail, I'm B2B), exporter RFQs (we process domestically).

---

## 10. e-Market Customer

> Kavita Deshmukh, 29, urban homemaker in Kothrud, Pune (pin 411038). Shops the Krishi Shopping Mall for fresh produce, A2 dairy and Mahila Gruh Udyog items (pickles, masala, papad) for her household of four; keeps a wishlist, hunts coupons, sometimes pays "baad-mein" (BNPL). Marathi-speaking, uses women-mode UI.

### Journey 1: Onboarding & first login (getting my customer profile)

1. I install the app and type my mobile +91 98xxxxxx21; the OTP SMS arrives and the app verifies it on the handset through Firebase phone auth. ⚠️ endpoints.md §1 documents backend routes `POST /auth/otp/send` + `POST /auth/otp/verify`, but **neither is in the implemented inventory nor the app's OpenAPI schema** — the real exchange is: client-side Firebase OTP → `POST /v1/auth/firebase-verify` (inventory) with the ID token → the app shows `{ accessToken, refreshToken, isNewUser: true, user }`.
2. I complete the registration wizard — name "Kavita Deshmukh", state Maharashtra, district Pune, tehsil Haveli, village Kothrud, land 0 acres (I'm a shopper, not a farmer), language mr, gender female, pincode 411038, email, MPIN, `profiles: ["customer"]`, `primaryProfile: "customer"`, `roleProfiles.customer = { interests: ["fresh-vegetables","dairy","gruh-udyog"], preferredCategories: ["vegetables","dairy","gruh_udyog"] }` → `POST /v1/auth/register` (endpoints.md §1) — returns user + tokens. (The `customer` profile is the valid FarmGate registration profile, endpoints.md §22.)
3. I check my profile hydrated correctly → `GET /v1/users/me` (endpoints.md §2/§24) — name, phone, district, `linkedProfiles: ["customer"]`, `activeProfile: "customer"`.
4. App looks best in Marathi with women mode on → `PUT /v1/users/me/settings` with `{ language: "mr", womenMode: true }` (endpoints.md §2).
5. I save my home address (B-Wing, Dahanukar Colony, Kothrud) → `POST /v1/addresses` — ⚠️ this route exists in code and in the app's OpenAPI but the extracted inventory missed it (the extractor skips bare `""` paths; same for `GET /v1/wishlist`, `GET /v1/coupons`, `GET /v1/notifications`, `GET /v1/faq` below — all verified present in `backend/app/routers/*` and `app.openapi()`) — returns 201 `addr_…` with `isDefault: true`. I add my mother's Baner address too, and list them → `GET /v1/addresses`.
6. Day-to-day login is MPIN → `POST /v1/auth/login` with `{ phone, mpin }` (endpoints.md §1); token dies mid-week → `POST /v1/auth/refresh` (§1). I check which devices hold my sessions → `GET /v1/auth/sessions` and revoke my old phone → `DELETE /v1/auth/sessions/{jti}` (both inventory-only; endpoints.md §1 lists only login/refresh/logout).

### Journey 2: Daily home & browsing the Krishi Mall (with gruh-udyog)

1. App opens on my home board → `GET /v1/dashboard/home` (endpoints.md §20) — Pune weather strip, banners, quick actions.
2. I browse the mall → `GET /v1/products?query=आंबा&page=1` (endpoints.md §6; the `customer` role is in `MARKET_ROLES`, `marketplace.py`) — mango baskets, Gir cow ghee, Solapur chutney. Gruh-udyog items appear here naturally: a mahila's live listing is a real `products` doc with `source: "gruh_udyog"` (endpoints.md §27), so papad/pickles/masala show up beside mall SKUs. Sellers I've blocked never appear (server hides them, `marketplace.py`).
3. I check what gruh-udyog categories exist → `GET /v1/gruh-udyog/categories` (endpoints.md §27) — Papad & Fryums, Pickles & Chutneys, Spices & Masala, Dairy & Sweets (FSSAI-gated)…
4. Into the Ratnagiri alphonso mango listing → `GET /v1/products/{id}` (endpoints.md §6) — price ₹420/dozen, `inStock: true`, rating 4.6, dealer distance.
5. "Asli ki nakli?" — I tap the QR authenticity certificate → `GET /v1/products/{id}/certificate` (endpoints.md §6) — `{ batchNo, certifier: "Agmark", certificateNo, valid: true, verifiedAt }`.
6. For the gruh-udyog masala, I open the unit's brand card → `GET /v1/gruh-udyog/units/{unit_id}` (endpoints.md §27) — unit name, SHG name, live product count, verified FSSAI/Udyam certs (others see verified certs only), and any active offer repricing the mall listing.
7. What do other buyers say? → `GET /v1/products/{id}/reviews` (inventory; endpoints.md §22-adjacent) — newest reviews with ratings.
8. Not buying the ghee today — heart it for later → `POST /v1/wishlist/items` with `{ productId }` (endpoints.md §22; 201, idempotent). My wishlist tab → `GET /v1/wishlist` (code/OpenAPI-verified; inventory extraction gap) — `{ data: Product[], total }` with live `inStock`. I remove a stale item → `DELETE /v1/wishlist/items/{product_id}` (endpoints.md §22) → 204.
9. Into the basket: 2 dozen mangoes + 1 kg ghee + Shengdana chutney → `POST /v1/cart/items` with `{ productId, quantity }` (endpoints.md §6); adjust the ghee to 2 → `PUT /v1/cart/items/{product_id}`; drop the chutney → `DELETE /v1/cart/items/{product_id}`; review → `GET /v1/cart` — `{ data: [{productId, quantity, product}], cartTotal: 1660 }`.
10. Quick price-vs-mandi sanity check on tomatoes for the week → `POST /v1/mandi/compare` is farmer/seller/broker only, so as a customer I just rely on mall prices; skip. (Not my surface.)

### Journey 3: Coupons & BNPL checkout (the monthly big basket)

1. Cart says ₹1,660. Before paying I open the coupon sheet → `GET /v1/coupons?cartTotal=1660` (endpoints.md §22; code/OpenAPI-verified) — `{ code: "GRUHA10", type: "flat", value: 100, minOrder: 500, maxDiscount: 100, validUntil }`, with `applicable: true` computed for my cart.
2. I test it before applying → `POST /v1/coupons/validate` with `{ code: "GRUHA10", cartTotal: 1660 }` (endpoints.md §22) → 200 `{ valid: true, discount: 100, finalTotal: 1560, message }`. A dead code returns `valid: false` with the reason (minOrder, expired…) — still 200, never a crash.
3. This month's budget is tight after school fees, so I choose "pay later in 2 parts" → `POST /v1/orders` (endpoints.md §6/§22) — body `{ items[], couponCode: "GRUHA10", paymentMethod: "bnpl", addressId: "addr_…", idempotencyKey }` → `{ orderId: "ord_…", total: 1660, discount: 100, finalTotal: 1560, bnplSchedule: [{installment: 1, dueInDays: 30, amount: 780}, {installment: 2, dueInDays: 60, amount: 780}] }`. ⚠️ Two flow details invisible in the API: (a) the BNPL *partner* integration is deferred (docs/deferral-ledger.md `deferral.BNPL`, 2026-10-08) — this is an in-app computed schedule, no lender credit check; (b) `bnplSchedule` is **only in this response — it is never stored on the order doc** (`orders.py`), so I cannot re-view my dues later (see gap_parts). Stock was decremented at order write; a replayed idempotency key returns the same response without double-using the coupon.
4. My sister's birthday basket is paid upfront instead: UPI via Razorpay → `POST /v1/payments/razorpay/order` with `{ orderId }` (endpoints.md §22) → `{ razorpayOrderId, amount, keyId }`; the SDK pays; app confirms → `POST /v1/payments/razorpay/verify` with `{ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }` → order flips to `paid` (bad signature → 400 `PAYMENT_SIGNATURE_INVALID`). (Generic gateway twins: `POST /v1/payments/order` + `POST /v1/payments/verify`; the gateway callback lands on `POST /v1/payments/webhook`.)
5. My orders list → `GET /v1/orders` (endpoints.md §6); one order's full state (status, `returnStatus`, `refundStatus`, razorpay ids) → `GET /v1/orders/{order_id}`.

### Journey 4: Order lifecycle, tracking, delivery & the chat that unlocks only after confirmation

1. I watch the mango order move: `placed → paid → confirmed → shipped → out_for_delivery → delivered` → `GET /v1/orders/{order_id}/timeline` (endpoints.md §22) — `{ orderId, data: [{status, at, note}], total }`. ⚠️ This timeline **is** the tracking: there is no live courier map for mall orders (and G3 forbids telematics); status also lands as in-app notifications.
2. Notifications → `GET /v1/notifications?page=1&pageSize=20` (endpoints.md §24; code/OpenAPI-verified — the inventory only shows the preferences/read routes, another bare-path extraction gap) — `{ data: [{id, title, body, type, read, createdAt}] }`; mark one read → `POST /v1/notifications/{notification_id}/read` (404 on someone else's id); mark all → `PUT /v1/notifications/read-all`; I tune which pushes I get → `GET /v1/notifications/preferences` → `PUT /v1/notifications/preferences` (all in the inventory).
3. Chat with the seller: before my order is confirmed there is **no chat box at all** — and I can't force one: `POST /v1/chat/direct` only accepts `lotId / demandId / vehicleId / bookingId / listingId / quoteId / purchaseId` (`chat.py`) — no `productId` — so a mall seller can't be messaged pre-order, and poking a room I'm not part of returns **403 `CHAT_LOCKED_FOR_BOOKING`** (`chat.py:110`) — exactly the lock my spec promises (features/farm_e-market_customer.md §D.1 `LOCKED_NO_THREAD`). Once ops confirms my order, the thread is created **server-side**: `POST /v1/threads` with `{ orderId }` (endpoints.md §28.28 — admin/system-only, I can never call it myself; 409 `THREAD_NOT_CONFIRMED` while the e-market order is still `created`/`cancelled`, 409 `THREAD_EXISTS` on duplicate). ⚠️ Note: nothing in the codebase auto-invokes this on confirmation — an ops admin/system job must call it; the endpoint and its gate are exactly per spec. Now I see the thread → `GET /v1/chat/rooms` (my deal threads only — no user directory exists, per G1) → open → `GET /v1/chat/rooms/{room_id}/messages` → send "आंबे कल सकाळी येतील का?" → `POST /v1/chat/rooms/{room_id}/messages` (text ≤ 2000 chars; phone numbers, URLs, UPI handles are rejected by the banned-phrase filter; images get EXIF-stripped + scan) → `POST /v1/chat/rooms/{room_id}/read` marks read.
4. Delivered! A rating prompt pops → `GET /v1/ratings/pending` — my open `marketplace_order` prompt (opened automatically on `delivered`, `order_tracking.py`) → I rate the seller → `POST /v1/ratings` `{ rating: 5, review: "उत्तम दर्जा" }` (kind `marketplace_order`, prompts close after) and write the product review other shoppers will read → `POST /v1/products/{product_id}/reviews` (endpoints.md §22).

### Journey 5: Exceptions — cancel, return, refund, support & safety

1. Ghee order placed an hour ago — husband says Amul is enough 😤. Within the free window I cancel → `POST /v1/orders/{order_id}/cancel` (endpoints.md §22) — appends a `cancelled` event, **restores product stock**; since it was a Razorpay-paid order, `refundStatus: "requested"` goes on the doc. (The penalty ladders in my spec — 4h free / 5% / 10% — are platform policy enforced server-side on the e-market order flow; the mall cancel is a straight cancel + stock restore, `orders.py`.)
2. The mango basket arrives with 4 rotten pieces — I photograph them and request a return → `POST /v1/orders/{order_id}/return` with `{ reason: "4 damaged mangoes out of 24, photo attached" }` (endpoints.md §22) — sets `returnStatus: "requested"`, appends `return_requested` to the timeline, `refundStatus: "requested"` (Razorpay id exists). Too early (not delivered) → 409 `RETURN_NOT_ALLOWED`; second attempt → 409 `RETURN_ALREADY_REQUESTED`. ⚠️ There is no customer-facing return *status* endpoint — I watch `GET /v1/orders/{order_id}` for `returnStatus`/`refundStatus` changes, and the actual money-back is an ops action: `POST /v1/payments/razorpay/refund` for online payments or console `POST /v1/admin/orders/{order_id}/refund` (endpoints.md §28.6; > ₹10,000 needs a second admin's approval, §28 maker-checker). COD/ BNPL refunds are manual via the console. Returns ride the same stock-restore path once ops marks `returned` (`PATCH /v1/orders/{id}/status`, admin-only).
3. Refund not showing after 5 days → Support tab. First the FAQ → `GET /v1/faq` (code/OpenAPI-verified; inventory gap) — published help articles. Then I ask → `POST /v1/support/ask` with `{ question: "Refund kiti divyat yeil?", lang: "mr" }` (inventory; WS-05 AI support) — it answers from the FAQ corpus with citations; because it's a **money** question it always escalates in code → I get `{ kind: "ticket", ticketId }`. I follow my tickets → `GET /v1/chatbot/expert-tickets` → open the thread → `GET /v1/chatbot/expert-tickets/{ticket_id}/messages` → reply with my order id → `POST /v1/chatbot/expert-tickets/{ticket_id}/messages`. (The admin side assigns/resolves the same queue, §28.12.)
4. A seller gets rude and tries to move me to WhatsApp → I report → `POST /v1/users/{user_id}/report` (inventory) and block → `POST /v1/users/me/blocks` (inventory) — from then on their listings vanish from my `GET /v1/products` (server-side hide, `marketplace.py`).
5. My data, my rules: I request an export → `POST /v1/users/me/data-export` (inventory) and check consent state → `GET /v1/users/me/consents` → update → `PUT /v1/users/me/consents` (inventory).

### Journey 6: My weekly sabzi standing order (customer_subscriptions)

1. Every Tuesday I order 3 kg vegetables + 2 L milk from Santosh Kaka's farm near Hinjawadi — the app calls this a subscription → `POST /v1/customer/subscriptions` (inventory; `customer_subscriptions` collection) — `{ farmerIds: ["uid-santosh-kaka"], crop: "mixed-vegetables", grade: "A", qtyKg: 5, targetPriceBandPaisa: {min: 30000, max: 42000}, deliveryWindow: "Tue 7-10 AM", frequency: "weekly" }` → 201 `sub_…`, `status: "active"`, `nextRunAt` auto-computed. (The daily/weekly/seasonal frequencies and price band mirror spec C2's recurring demand.)
2. I review my standing orders → `GET /v1/customer/subscriptions` (paged `{data, total}`); the week we're in Goa I cancel it → `DELETE /v1/customer/subscriptions/{subscription_id}` — sets `status: "cancelled"` (404 `SUBSCRIPTION_NOT_FOUND` on someone else's). ⚠️ There is **no pause/skip-one-week or edit** — cancel + recreate only, which mints a new id (see gap_parts P2).
3. The platform's planner turns my subscription into a real quote on schedule (cron `POST /v1/jobs/subscriptions/planner/run`, inventory — ops/cron-only, not me) → I see a fresh `quote_pending` entry → `GET /v1/customer/quotes` (inventory) — with `expiresAt` + `priceLockUntil` (24h expiry & price-lock are server config, `emarket_customer.py`). If the price is inside my band I accept → `POST /v1/customer/quotes/{quote_id}/accept` (inventory; creates the confirmed order + escrow deposit) — else I counter once → `POST /v1/customer/quotes/{quote_id}/counter` with `{ counterPricePerQuintal, reason }`. The resulting FarmGate order shows in → `GET /v1/customer/orders` (inventory) with its `statusTimeline`, escrow state, and at delivery I inspect it → `POST /v1/customer/orders/{order_id}/inspection` with `{ damagePct, gradeMatch, photoUrls, notes }` (inventory — spec C8 checklist). My monthly statement for the family file → `GET /v1/customer/invoices/consolidated?period=2026-10` (inventory).
4. Farm-gate browsing when I feel like hand-picking: produce lots near me → `GET /v1/customer/browse/near-me?lat=18.507&lng=73.807&crop=tomato&sort=distance` (inventory; S3 discovery) — open lots with `distanceKm`, freshness days, farmer rating; a farmer I like → his storefront → `GET /v1/customer/storefronts/{farmer_id}` (inventory) — his open lots + verified credentials. I favourite him → `POST /v1/customer/suppliers/favorites` (inventory) and plan around price history → `GET /v1/customer/planner` (inventory — C13 seasonal planner: historical prices by crop/city).

### Journey 7: My money overview (settlement is refunds, not payouts)

1. Where did my salary go? → `GET /v1/analytics/customer` (endpoints.md §22) — `{ totalSpent: 18420, totalOrders: 23, ordersByStatus, monthlySpend[12m], categorySpend, topProducts[5], wishlistCount: 7, activeCoupons: 3, pendingReturns: 1 }`.
2. For the FarmGate side of my wallet → `GET /v1/customer/analytics` (inventory) — spend vs mandi benchmark, order states, credit ledger. (The B2B credit ledger, TDS reports etc. from spec C9 belong to GST-verified business buyers — not me, a homemaker; I never touch them, per the spec's own gating.)
3. Settlement for a shopper = money coming **back**: refund lands to the original Razorpay source (`refundStatus: "processed"` on `GET /v1/orders/{id}`); BNPL installments are collected by the deferred-partner flow (deferral-ledger) — until then, the schedule is the receipt I screenshot at checkout. My bank account on file (`POST /v1/bank-accounts`) is only needed if the original source dies — the platform's retry/fallback rule (spec E14) is a payout-ops concern, not mine.
4. Coins & streaks for fun → `GET /v1/gamification/status` (endpoints.md §19) — my AgriCoins and tier after all that diary… err, shopping.

---

## 11. Bank Manager

> Ravindra Joshi, 52, branch manager at the Pandharpur District Central Co-operative Bank (Solapur district, Maharashtra). Reviews KCC renewals and input ( crop-loan ) applications filed by farmers on Agrovercity. ₹2,000/seat/mo Enterprise CreditDesk console at his branch; two field officers under him.

### Journey 1: Branch onboarding & first login (getting my CreditDesk seat)

1. Our bank ties up with Agrovercity; I install the app and sign in with my branch mobile number. The OTP SMS comes through Firebase phone auth on the handset (endpoints.md §1 lists `POST /auth/otp/send` + `POST /auth/otp/verify`, but those backend routes are **not in the implemented inventory** — the real flow is: client gets a Firebase ID token from the SMS OTP and exchanges it) → `POST /v1/auth/firebase-verify` (inventory; endpoints.md §1 §-adjacent) — the app shows me my fresh session: `{ accessToken, refreshToken, isNewUser: true, user }`.
2. I complete my profile — name "Ravindra Joshi", branch at Pandharpur, district Solapur → `POST /v1/auth/register` (endpoints.md §1) — returns user + tokens. (Village/tehsil fields from §1 body; the geo hint `GET /v1/geo/reverse` (§3) fills district/state from my branch GPS pin.)
3. Head office asks me to link the bankManager persona to my login → `POST /v1/users/me/profiles` with `{ profileType: "bankManager" }` (endpoints.md §2) — then `POST /v1/users/me/profiles/bankManager/activate` (endpoints.md §2) — app switches me to the CreditDesk console home route.
4. My branch's Enterprise subscription must cover my seat (₹2,000/seat/mo, robust.md §6.11). I check plans and subscribe → `GET /v1/billing/plans` → `POST /v1/billing/subscribe` (inventory only — billing is not in endpoints.md) — the first banker call I make later consumes one seat server-side and raises **402 `ENTITLEMENT_EXCEEDED`** if the branch is over its seat count (`backend/app/routers/loans.py:_enforce_banker_seat`).
5. I pull my subscription and invoices for the branch file → `GET /v1/billing/subscription` · `GET /v1/billing/invoices` (inventory only).
6. When my session expires between chai breaks → `POST /v1/auth/refresh` (endpoints.md §1) — new access token without re-login; end of day → `POST /v1/auth/logout` (§1).

### Journey 2: Morning queue triage (my daily home)

1. 10:30 AM, after the branch opens. My CreditDesk home board needs queue depth, SLA buckets, today's approvals, this week's disbursals, NPA watch → `GET /v1/loans/stats` (endpoints.md §11b) — app shows `{ byStatus, pendingReview, queueDepthBySla {onTrack/dueSoon/breach}, approvalsToday, disbursalsThisWeek, atRiskAccounts, portfolioTotals, npaWatch, emiCollectionRate }`. ⚠️ SLA rules are server constants, not visible in the API: due-soon at 24 h, breach at 48 h, at-risk at 7 days age or credit score < 550 (`loans.py` constants).
2. I open the review queue, oldest first → `GET /v1/loans/queue?status=submitted&page=1&pageSize=20` (endpoints.md §11b) — envelope with each `LoanApplicationOut`: application number like `LN-2026-0147`, farmer name/phone, amount, purpose, credit score + tier snapshotted at apply-time, AI prescreen annotation (`loans.prescreen.v1`, deferral-ledger ai.B7 SHIPPED) risk-sorts the page. ⚠️ The prescreen flag is a server-side queue annotation; there is no standalone prescreen endpoint.
3. A farmer calls: "Saheb, mazi application kuth ahe?" I search his name/phone/application number → `GET /v1/loans/queue?q=98600xxxxx` (endpoints.md §11b, substring search on farmerName/farmerPhone/applicationNumber) — his file comes up.

### Journey 3: Underwriting a soybean input loan (the approve-and-disburse day)

1. I open `LN-2026-0147` — Vilas Pawar, Nimgaon (taluka Malshiras), ₹40,000 for soybean seed + DAP, 9 months → `GET /v1/loans/{applicationId}` (endpoints.md §11b; owner-farmer or bankManager only, else 404 `LOAN_NOT_FOUND`) — full file: amount, tenure, purpose, bank account last-4 + IFSC snapshot, timeline, documents list, `farmerCreditScore: 612 / tier: silver`.
2. I formally pick the file up so the audit trail shows an owner → `POST /v1/loans/{applicationId}/review` (endpoints.md §11b) — status `submitted → underReview`, stamps `assignedOfficerId/Name` = me; farmer gets an FCM nudge; audit row written.
3. Before sanctioning I want the full farmer picture — KCC limit, credit score, land holding, prior loans → `GET /v1/loans/{applicationId}/farmer360` (endpoints.md §11b-adjacent; implemented, inventory) — shows his profile, `{ kisanCreditScore: 612, creditTier: "silver" }`, KCC card (limit ₹1,60,000, masked `XXXX-XXXX`+phone last-4), land/crop data, `repaymentHistory` (his earlier ₹25,000 onion loan, repaid), and the documents array. This is the banker-scoped aggregate the farmer-only `/finance/kcc` + `/finance/loans` can't give me directly.
4. I check his passbook copy and 7/12 upload… and here the console stops: the `documents[]` entries carry only a GCS `storagePath` — there is **no endpoint to view/download the file** → ⚠️ MISSING — `GET /v1/loans/{applicationId}/documents/{documentId}/download` (signed URL). Today I phone the farmer and ask him to WhatsApp the 7/12. (Verified: `LoanDocument` model has only `documentId/name/storagePath/uploadedAt`; inventory has no loan-doc GET.)
5. I sanity-check the EMI he'll bear at our 7% crop-loan rate → `POST /v1/finance/loan-calculator` with `{ amount: 40000, tenureMonths: 9, interestRate: 7 }` (endpoints.md §11) — `{ emi, totalInterest, totalPayable }`. (Calculator is open to all roles; handy on the same screen.)
6. Sanction: ₹40,000 @ 7%, 9 months, note "Soybean Kharif 2026, land verified by phone" → `POST /v1/loans/{applicationId}/approve` with `{ sanctionedAmount: 40000, interestRate: 7, tenureMonths: 9, note }` (endpoints.md §11b) — `underReview → approved`; illegal jump would 409 `LOAN_INVALID_TRANSITION`; audit + farmer FCM. Server records the origination fee for Agrovercity (R4 revenue share, robust.md §6.11).
7. I eyeball the reducing-balance schedule before releasing money → `GET /v1/loans/{applicationId}/schedule` (endpoints.md §11b) — 9 rows `{ installmentNo, dueDate (1st monthly), emi, principal, interest, outstanding }`, final outstanding exactly 0.
8. Disbursement day — our bank releases ₹40,000 to his verified account, UTR `SBIN426188730` → `POST /v1/loans/{applicationId}/disburse` with `{ disbursementRef: "SBIN426188730", disbursedAmount: 40000 }` (endpoints.md §11b) — `approved → disbursed`, `disbursedAt` stamped. ⚠️ One-shot release: the spec has no partial/tranche disbursement, and no maker-checker second sign-off on the banker side (only the superadmin console has maker-checker for > ₹10,000 admin money moves, §28). The server auto-schedules one EMI reminder task per installment (WS-03 task 3.12) — a flow detail invisible in any endpoint response.

### Journey 4: Info-request round trip (the "papers missing" exception)

1. `LN-2026-0152` — Sunita Mane, Korti, ₹50,000 for pomegranate spray & fertigation, but her passbook photo is unreadable. Instead of rejecting, I ask → `POST /v1/loans/{applicationId}/info-request` with `{ message: "कृपया स्पष्ट पासबुक पान अपलोड करा" }` (endpoints.md §11b) — `underReview → infoRequested`, message stored as `note`, farmer notified with a deep link to upload.
2. She re-uploads from her app → `POST /v1/loans/{applicationId}/documents` (farmer-only, multipart; endpoints.md §11b) and answers → `POST /v1/loans/{applicationId}/respond` with `{ message }` (endpoints.md §11b) — `infoRequested → underReview`, notifies me (assigned officer).
3. I want to see "what changed since I asked" in my console inbox → ⚠️ MISSING — `GET /v1/notifications?page=&pageSize=` (endpoints.md §24 claims it shipped; the inventory has only `PUT /notifications/read-all` and `POST /notifications/{id}/read`, no list). The FCM push does reach my phone, so I manage; but the in-app list endpoint every other module assumes isn't there. I re-pull the file → `GET /v1/loans/{applicationId}` — new doc + her response in the timeline → then approve as in Journey 3.

### Journey 5: Rejection, NPA watch & the repayment I cannot post

1. `LN-2026-0155` — ₹50,000 top-up for a farmer whose score dropped to 480 after last season's failed onion crop. I reject with a humane reason → `POST /v1/loans/{applicationId}/reject` with `{ reason: "कर्जपुनर्भरण क्षमता नाही; KCC आधी नियमित करा" }` (endpoints.md §11b; also legal from `approved` if we haven't disbursed) — `rejectionReason` stored, farmer notified, audit row.
2. Monday portfolio review → `GET /v1/loans/stats` — `npaWatch` flags files aged > 7 days or score < 550; `emiCollectionRate` tells me collection health. But here's the hole: after disbursal there is **no endpoint to record EMI collections** → ⚠️ MISSING — `POST /v1/loans/{applicationId}/repayments` (+ `GET …/repayments`). The code itself admits it (`loans.py`: "No EMI repayment ledger in this phase: released principal stands as the outstanding amount"), so `outstandingPaisa` is just total sanctioned and `emiCollectionRate` is a proxy, not real collections. SOP-14 §3 promises "Track loan repayment milestones and default risk indicators" — that capability has no API.
3. An EMI reminder fires from the platform's task engine on the 1st; the farmer pays at my counter in cash+UPI. I write it in my bank's CBS ledger; Agrovercity's console has nowhere to reflect it. ⚠️ (same gap as step 2).

### Journey 6: Warehouse-receipt collateral (post-harvest pledge)

1. Vilas wants ₹60,000 against his 18-quintal soybean e-NWR stored at the Akluj cold store. From the loan detail screen I attach the receipt number as a collateral reference → `POST /v1/loans/{applicationId}/documents` with form field `reference_no` (banker-only path; applicant file-upload is farmer-only — `loans.py`) — appends a `Warehouse Receipt` document, audit action `LOAN_WAREHOUSE_RECEIPT_ATTACH`.
2. Before accepting it as security I verify the receipt is genuine and see its valuation → `GET /v1/post-harvest/receipts/{receipt_number}` (endpoints.md §20) — e-NWR details + pledge valuation. (The same attach-and-verify loop is specced in phase-03 WS-05/WS-03: farmer attaches receipt, banker sees it in the document list.)
3. Still can't open the actual receipt PDF he uploaded as a file — same ⚠️ MISSING document-download as Journey 3 step 4; the `reference_no` path saves me here because the number itself is the reference.

### Journey 7: Support touchpoints, superadmin oversight & my own audit trail

1. The console mis-sorts the queue one day; I raise it with Agrovercity support via the in-app Kisan Mitra chat → `POST /v1/chatbot/messages` (endpoints.md §5) and ask for a human → `POST /v1/chatbot/handoff` (endpoints.md §5) — `{ expertName, contactChannel, etaMinutes }`.
2. My unread badges pile up; I mark all read → `PUT /v1/notifications/read-all` (endpoints.md §24) — `{ updated: n }`. (Listing them first is the ⚠️ MISSING step from Journey 4.)
3. RBI inspection next month — I need every decision my branch took on `LN-2026-0147` with reasons. Every approve/reject/info-request/disburse I made wrote an `audit_logs` doc server-side (§11b contract), but reading it back: `GET /v1/admin/audit` exists **only for admin tiers**, not bankManager → ⚠️ MISSING — `GET /v1/loans/audit-logs?applicationId=` (bankManager-scoped). As a stopgap I export my own account data → `POST /v1/users/me/data-export` (inventory) — though that covers my user doc, not the loan audit rows.
4. Head-office compliance also wants district-level credit-score tier spread to plan next season's limits (SOP-14 §3: "Monitor Kisan Credit Score algorithm factors and tier distributions"). The endpoint implied by SOP-14 doesn't exist → ⚠️ MISSING — `GET /v1/admin/finance/credit-scores` (tier histogram + factor aggregates). `GET /v1/finance/credit-score` (§11) only returns the *caller's own* score, and `farmer360` shows one applicant at a time — fine for files, useless for portfolio-tier analytics.
5. Agrovercity's own superadmin watches over me: they underwrite from the same queue → `GET /v1/admin/finance/loans?status=` (endpoints.md §11c/§28.14) and can force-status any file along the same state machine → `PUT /v1/admin/finance/loans/{applicationId}/status` with `{ status, note? }` (endpoints.md §11c; 409 `LOAN_INVALID_TRANSITION` on illegal jumps, 403 `FORBIDDEN_ADMIN` for non-admins). They also audit penny-drop failures and can override-verify a farmer's bank account → `GET /v1/admin/finance/accounts` · `POST /v1/admin/finance/accounts/{id}/override-verify` (endpoints.md §28.14; alias `/admin/finance/bank-accounts/…` also implemented). When their override exceeds ₹10,000 it routes via maker-checker (§28 header) — a flow detail, not an endpoint I call.
6. Season over: my branch's seat count and origination fees get reconciled through the platform settlement console (`GET /v1/admin/settlements` family, §28.25, admin-side); my side of the money is only the monthly seat invoice (`GET /v1/billing/invoices`) — there is no banker-facing settlement/payout endpoint, which is correct: we are the lender, not a payee.

**Surfaces I never touch:** mandi prices, marketplace orders, equipment slots, dairy, land leases, insurance claims (ClaimsDesk is a different console), content/gamification. My whole working life here is `/loans/*` + one collateral lookup + billing.

---

## 12. Insurance Provider

> Claims head at ClaimsDesk Assurance LLP, a crop-insurance partner desk on Agrovercity handling PMFBY + RWBCIS business across Maharashtra in association with AIC of India, HDFC ERGO and SBI General. I sit in Pune; my surveyors cover Ahmednagar, Nashik and Solapur districts. 15 years in crop insurance, zero patience for claims files missing geotags.

---

### Journey 1: Getting our desk onto the platform (onboarding)

1. My ops lead created my mobile login and I sign in with phone + MPIN. The spec's OTP flow (`POST /auth/otp/send`, `POST /auth/otp/verify`, endpoints.md §1) is not what ships — the platform actually runs MPIN + Firebase auth. → `POST /v1/auth/login` (§1) — I get my access token, and it already knows Meenaxi Iyer, phone 98220••••3.
   ⚠️ Divergence: OTP send/verify documented in endpoints.md §1 are absent from the implemented inventory; the real flow is `POST /v1/auth/login` / `POST /v1/auth/mpin/set` / `POST /v1/auth/mpin/verify` / `POST /v1/auth/quick-login`.
2. First login asks me to complete registration — name, state (Maharashtra), district (Pune), our office pin — and I tick the **insuranceProvider** persona. → `POST /v1/auth/register` (§1) — my user doc is created with `linkedProfiles: ["insuranceProvider"]`.
3. The app asks me to link the persona profile so the workspace unlocks. → `POST /v1/users/me/profiles` with `{ profileType: "insuranceProvider" }` (§2) — profile linked; then → `POST /v1/users/me/profiles/insuranceProvider/activate` (§2) — my home becomes the ClaimsDesk console.
4. Before I can touch a single claim file, compliance requires our **IRDAI licence** on record. The KYC service mandates `irdai_licence` for my persona, so I open a KYC case and upload the licence scan. → `POST /v1/kyc/cases` then `POST /v1/kyc/cases/{case_id}/docs/irdai_licence/upload` (§2/§28.3 pattern) — case created; I poll → `GET /v1/kyc/status` (§28.3) — shows `pending` until the superadmin desk verifies it via `POST /v1/admin/kyc/{doc_id}/verify`.
   ⚠️ Flow detail not visible in any endpoint: the actual verify/reject human step happens on the superadmin side; I just wait on `kyc/status`.
5. The provider console is a paid workspace — ₹2,000/month, 2 seats (billing catalog: `("insuranceProvider", "console", 2000, {seats: 2})`). I pick the plan and subscribe so my underwriter Pranav gets seat #2. → `GET /v1/billing/plans?persona=insuranceProvider` then `POST /v1/billing/subscribe` (billing) — subscription `active`; GST invoice lands in → `GET /v1/billing/invoices`.

### Journey 2: Morning command centre (daily home)

1. First thing after chai: the KPI wall — how many policies are pending underwriting, how many claims are sitting with surveyors, what got disbursed yesterday, and my loss ratio (keep it under 65% or the reinsurer calls). → `GET /v1/insurance/provider/stats` (§12) — shows `totalPolicies`, `pendingPolicies`, `pendingClaims`, `totalClaimDisbursed`, `lossRatioPercent`, plus `avgCycleTimeHours` so I can prove intimation-to-DBT stays inside our 30-day promise.
   ⚠️ MISSING — `GET /v1/users/me/dashboard/insuranceProvider` (endpoints.md §2 promises a persona home payload for every role; not in the implemented inventory). `provider/stats` covers the KPI half, but there is no unified "metric pills + quick actions + live activity" home — I stitch it together myself.
2. Overnight, farmers appealed two rejected claims and a surveyor uploaded readings in Solapur — the app pings my phone over FCM, but when I open the bell icon in the console there is **no inbox**. → ⚠️ MISSING — `GET /v1/notifications?page=&pageSize=` (endpoints.md §24; only `…/preferences` and the mark-read endpoints exist in the inventory). I can mark things read (`POST /v1/notifications/{notification_id}/read`, §24) but I can never list them — so my team tracks alerts from a WhatsApp group instead. Noted as a gap.

### Journey 3: Underwriting queue — kharif rush (core money workflow)

1. Kharif cutoff is 31 July; it's 21 July and 140 applications are pending from Nashik alone. I open the underwriting queue, filtered to `pending_approval`. → `GET /v1/insurance/provider/policies?status=pending_approval&page=1&pageSize=50` (§12) — each row: farmer name, village, crop, acres, sum insured, farmer premium, govt subsidy, `riskScore`, `riskCategory`.
2. A 6-acre grape grower from Chandanapuri, Ahmednagar — Ram Patil — applied for ₹68,000/acre cover under PMFBY. Risk score 41, category "moderate". I open his file. → `GET /v1/insurance/provider/policies/{policy_id}` (§12) — full application with risk factors, his linked 7/12 area and KCC bank tail `…4521`.
3. I check the season rate card to confirm the premium math his quote used. → `GET /v1/insurance/rates?season=kharif&crop=grapes` (§12) and cross-check with → `POST /v1/insurance/premium-calculator` (§12) — sum insured ₹4.08 lakh, farmer share 5% = ₹2,750/acre, subsidy balance picks up the rest. Correct.
4. Everything is clean — I approve; the e-certificate must be in his hand before cutoff. → `POST /v1/insurance/provider/policies/{policy_id}/review` with `{ action: "approve", insuranceCompany: "AIC of India", underwriterNotes: "…" }` (§12) — status flips `active`, the server builds the policy certificate PDF, stores it, and pushes a Marathi FCM to Ram: "फसल बीमा स्वीकृत! 🎉". He can pull the same PDF himself from → `GET /v1/insurance/policies/{policy_id}/certificate` (§12).
5. A second file, cotton on dryland in Solapur with risk score 78 ("high") and 2 acres of boundary dispute in the 7/12 — I reject with a written reason; the platform won't accept a bare no. → `POST /v1/insurance/provider/policies/{policy_id}/review` with `{ action: "reject", rejectionReason: "Land parcel mismatch…" }` (§12) — 422 if I leave the reason out; farmer gets notified with my reason.
   ⚠️ Flow detail not visible in any endpoint: certificate generation + FCM notification happen server-side inside the review call; there is no separate "issue certificate" or "notify" endpoint for me.

### Journey 4: The cyclone claim — intimation to DBT (core money workflow)

1. 14 October, unseasonal rain + wind flattens kharif jowar around Chichondi village. By evening 22 claims land in my adjudication queue with status `intimated`. → `GET /v1/insurance/provider/claims?status=intimated&page=1&pageSize=50` (§12) — claim numbers like `CLM-2026-MH-0042`, each with calamity type, estimated loss % and village.
2. I open Suresh Jadhav's file — 4 acres jowar, estimated loss 60%, geotagged photos attached. → `GET /v1/insurance/provider/claims/{claim_id}` (§12) — the full case file: `damagePhotos[]` with GPS stamps, his policy link, timeline, plus an AI triage annotation flagging the photo set as consistent (the `insurance.triage.v1` model, ai.B8, runs server-side and attaches to the file). His claim says 72-hour intimation was met — `submittedAt` vs `dateOfDamage` is 31 hours. Good boy, Suresh.
3. I assign our Ahmednagar surveyor. I keep my panel on the roster first. → `GET /v1/insurance/provider/surveyors` (implemented, provider-scoped roster) — Shankar Pawar is free; I book him. → `POST /v1/insurance/provider/claims/{claim_id}/schedule_survey` with `{ surveyorName: "Shankar Pawar", surveyorPhone: "…", surveyorVisitDate: "2026-10-17" }` (§12) — status moves `intimated → surveyorAssigned`, Suresh gets an FCM with the surveyor's name, phone and visit date. (New panelist? `POST /v1/insurance/provider/surveyors`; exits? `DELETE /v1/insurance/provider/surveyors/{surveyor_id}` — both implemented, though not listed in endpoints.md §12.)
4. Shankar walks the plot next morning, measures 55% loss against the cce cuts, and phones me the readings. I key in his assessment on his behalf — surveyors don't get logins on this platform, so the desk uploads the report. → `POST /v1/insurance/provider/claims/{claim_id}/survey_report` with `{ assessedLossPercent: 55, cropStageAtVisit: "maturity", surveyorNotes: "…" }` (§12) — status `surveyorAssigned → fieldAssessed`.
5. Approved amount: 55% of requested ₹49,600 = ₹27,280. I adjudicate. → `POST /v1/insurance/provider/claims/{claim_id}/review` with `{ action: "approve", approvedAmount: 27280, notes: "Surveyor-verified 55% loss" }` (§12) — status `fieldAssessed → dbtApproved`; Suresh is told "दावा राशि स्वीकृत! 💰".
6. Our accounts team pushes the DBT batch in the morning; I record the transaction reference against the claim so the farmer can trace it. → `POST /v1/insurance/provider/claims/{claim_id}/disburse` with `{ dbtTransactionId: "DBT20261017093412", bankAccountLast4: "4521" }` (§12) — status `dbtApproved → disbursed`, `disbursedAt` stamped, the claim fee hits our settlements ledger, and Suresh gets the money with the reference number in FCM.
7. Suresh can watch all of this himself on his tracker. → `GET /v1/insurance/claims/{claim_id}` (§12, farmer-side) — same timeline, amounts and DBT ref.

### Journey 5: The ₹62,000 payout that worried me (exceptions / compliance)

1. A vineyard hail-damage claim from Nashik assesses out at ₹62,000. Company rule — and the platform's own SOP — says **any payout above ₹50,000 needs dual sign-off** (SOP-15 §6.3: "Payout approvals exceeding ₹50,000 require dual-admin sign-off"; endpoints.md §28: maker-checker via `admin_approvals` for insurance payouts > ₹50,000).
2. I approve it on the provider console out of habit. → `POST /v1/insurance/provider/claims/{claim_id}/review` (§12) — the call sails through; no `requiresApproval` flag, no second-sign-off stop. Same on → `POST /v1/insurance/provider/claims/{claim_id}/disburse` (§12) — I could push ₹6.2 lakh and nothing would blink.
   ⚠️ MISSING — maker-checker enforcement on the provider path. In code, `PAYOUT_DUAL_SIGNOFF_PAISE` (5,000,000 paisa = ₹50,000) is applied **only** on the superadmin desk route `PUT /v1/admin/claims/{userId}/{claimId}` (admin_sop_finance.py); `/insurance/provider/…/review` and `/disburse` have no threshold check. If the claim is advanced through the admin desk instead — → `PUT /v1/admin/claims/{userId}/{claimId}` (§28.15) — then → `GET /v1/admin/approvals` → `POST /v1/admin/approvals/{approval_id}/approve` by a **different** admin (§28) properly holds it. The provider console bypasses the guardrail entirely. Logged as my P0 gap.
3. I raise it with the platform. → `POST /v1/support/ask` (support) — my question goes to the expert-handoff desk; I quote SOP-15 and ask whether large payouts should be forced through the admin approvals queue.

### Journey 6: Appeal on my own rejection (disputes)

1. Last month I rejected Mahadev Shinde's bajra claim — photos had no geotags, loss self-estimated at 90%, policy listed irrigated land. He appealed with fresh geotagged photos and a sarpanch letter. The appeal endpoint is the farmer's: → `POST /v1/insurance/claims/{claim_id}/appeal` (§12, F15) — his claim flips back from `rejected` to `intimated`, `appealCount` becomes 1, and it re-enters my queue automatically.
2. I spot it in the morning queue. → `GET /v1/insurance/provider/claims?status=intimated` (§12) — `CLM-2026-MH-0018` is back. I open → `GET /v1/insurance/provider/claims/{claim_id}` (§12) — the case file now shows `appealCount: 1`, the new photos appended, and a timeline note "Appeal submitted: …". There is no separate appeals queue — appealed claims masquerade as fresh intimations, so I work them by `appealCount` (adequate, but a filter would help; not blocking).
3. I schedule the same surveyor for a re-visit (Journey 4, steps 3–6): → `POST /v1/insurance/provider/claims/{claim_id}/schedule_survey` → `POST /v1/insurance/provider/claims/{claim_id}/survey_report` (assessed 48%) → `POST /v1/insurance/provider/claims/{claim_id}/review` (`approve`, ₹23,040) → `POST /v1/insurance/provider/claims/{claim_id}/disburse`. The appeal audit trail (`aud_claim_appeal_…`) stays attached for the government audit.

### Journey 7: Publishing the rabi rate card (seasonal money workflow)

1. Actuarial sends the rabi 2026–27 table — onion actuarial 12.5%, farmer share capped 5% under PMFBY norms, sum insured ₹55,000/acre. I publish row by row. → `POST /v1/insurance/provider/rates` (§12) with `{ cropName, category, season: "rabi", sumInsuredPerAcre: 55000, farmerSharePercent: 5, totalActuarialRatePercent: 12.5, cutoffDate: "2026-11-30" }` — the row goes live for the premium calculator (`POST /v1/insurance/premium-calculator`) that every farmer quotes from.
2. Corrections after publishing go through the superadmin desk because rate edits always need a second admin. → `PUT /v1/admin/insurance/rates` (§28.15) — 409/`requiresApproval` unless a different admin confirms via the approvals queue (§28 maker-checker). Good — this one *is* guarded.
   ⚠️ Flow detail: `POST /v1/insurance/provider/rates` silently overwrites an existing `{crop}-{season}` row (set_doc with deterministic id) — there is no version history on the provider path.

### Journey 8: Month-end — reinsurer pack, invoices, audit (settlement/payout & admin touchpoints)

1. Reinsurer wants the pack: policies by status, claims by calamity, loss ratio, average cycle time. → `GET /v1/insurance/provider/stats` (§12) — `lossRatioPercent`, `byCalamity`, `avgCycleTimeHours`, disbursed totals; exports to my spreadsheet by hand.
   ⚠️ MISSING (quality-of-life) — no export endpoint (e.g. `GET /v1/insurance/provider/stats/export`); the superadmin grid has Export but my provider console doesn't. P2.
2. Seat subscription renews; finance wants the invoice. → `GET /v1/billing/subscription` + `GET /v1/billing/invoices` (billing) — ₹2,000 console plan, GST invoice PDF.
3. The IRDAI inspection next month needs our decision audit trail. The platform already writes it — every review/disburse/appeal lands in the audit log server-side, and the superadmin console can pull it (SOP-15 §6.2). My own console has no audit-read endpoint, so I ask compliance to pull it from → `GET /v1/admin/claims?status=…` / the admin drawer (§28.15) — acceptable since ClaimsDesk sits next to the platform's compliance desk.
4. Sign out at the end of the day. → `POST /v1/auth/logout` (§1).

---

**Surfaces I never touch:** mandi prices, equipment rental, e-market orders, transport bookings, gruh-udyog — a claims desk doesn't buy tractors or sell onions; skip.

---

## 13. Cold Storage Provider

> Haribhau Chavan, 60, Solapur (Mohol side, onion belt) — runs "Chavan Krupa Cold Storage", a WDRA-registered 500 MT cold store with 3 chambers (Chamber A: onion 0–5°C 200 MT, Chamber B: potato 2–4°C 150 MT, Chamber C: dry godown 150 MT). Stores onion at ₹10/quintal/month, potato at ₹12. Speaks Marathi; his grandson set the app to Marathi. Rent is settled at the gate — cash/UPI — and he still keeps a bahi-khata.

### Journey 1: Onboarding & WDRA KYC (getting my store onto the platform)

1. My grandson installs the app and enters my mobile number; OTP aata → `POST /v1/auth/otp/send` + `POST /v1/auth/otp/verify` (endpoints.md §1) — I get a 6-digit OTP, 5-minute validity, and since I am new, a registration form. ⚠️ The OTP itself travels by SMS — that step is outside any endpoint.
2. Registration wizard — name Haribhau Chavan, village Kegaon, tehsil Mohol, district Solapur, profiles: `coldStorageProvider` (I also keep my own 4-acre kanda field as `farmer`) → `POST /v1/auth/register` (§1) — my account is created with MPIN, tokens come back.
3. On my old phone the app opens on the farmer home; my grandson switches me to the store profile → `POST /v1/users/me/profiles/coldStorageProvider/activate` (§2) — home flips to `coldStorageHome` with postHarvest, finance, bankAccounts, settlements in my drawer.
4. KYC: Aadhaar (masked), PAN, and my **WDRA certificate** — the app says `wdra_certificate` is mandatory for my persona → `POST /v1/kyc/cases` `{persona: "coldStorageProvider", docs: [...]}` (§28.3 queue; body per `/kyc/cases`) — a case `kyc_…` opens; each document goes up via `POST /v1/kyc/cases/{case_id}/docs/{doc_id}/upload` (multipart). I poll `GET /v1/kyc/status` until it shows verified — on the admin side a compliance officer approves at `POST /v1/admin/kyc/{id}/verify` (§28.3). ⚠️ Nothing in the cold-storage flow *blocks* on KYC being verified — the flag is informational.
5. I keep a scanned copy of the WDRA certificate in the vault as well → `POST /v1/vault/documents` (§10) — encrypted, never leaves my account.
6. Bank account for any refunds/platform charges → `POST /v1/bank-accounts` + `POST /v1/bank-accounts/{id}/verify` (§21) — penny-drop confirms my account, masked last-4 shown.

### Journey 2: Registering my facility & the 3 chambers (and paying for Pro)

1. First I check what the platform costs → `GET /v1/billing/plans?persona=coldStorageProvider` — Free (one facility, **read-only console**) vs Pro ₹1,999/month per facility. ⚠️ Free tier blocks every console write with 402 `ENTITLEMENT_EXCEEDED` — I cannot approve a single booking without Pro, so this is not optional for my business.
2. I pay for Pro → `POST /v1/billing/subscribe` `{planId: "coldStorageProvider_pro"}` — active for 30 days; I check `GET /v1/billing/subscription` and later `GET /v1/billing/invoices` for the GST bill. (§billing; tier documented in robust.md §6.13.)
3. Register "Chavan Krupa Cold Storage" — 500 MT, address Barshi Road, Solapur, `wdraRegistered: true`, `wdraRegNo: "WDRA/MH/2019/01234"`, supported crops Onion & Potato, my son's phone as contact → `POST /v1/post-harvest/provider/facilities` (§20) — 201, facility `cs_…` created with full capacity free.
4. My three chambers go in one by one → `POST /v1/post-harvest/provider/facilities/{facility_id}/chambers` ×3 (§20) `{name: "Chamber A — Onion", chamberType: "cold_storage", capacityMT: 200, tempRange: "0-5°C"}` etc. — each add increases facility capacity. (Dry godown Chamber C is `chamberType: "godown"`.)
5. Rate revision before the kharif onion rush (₹10 → ₹11/quintal/month) → `PUT /v1/post-harvest/provider/facilities/{facility_id}` (§20).
6. I check what a farmer sees → `GET /v1/post-harvest/cold-storage?lat=&lng=` and `GET /v1/post-harvest/cold-storage/{facility_id}` (§20) — my name, distance, available MT, WDRA badge all show.
7. ⚠️ My `wdraRegistered: true` is **self-declared** — no admin endpoint verifies a facility before it appears in the directory or issues e-NWRs. A verification step exists for equipment (§28.9) and vets (§28.19) but not for cold storage — see gap #2.

### Journey 3: Daily home — watching the bookings queue

1. Morning chai, open the app → `GET /v1/users/me/dashboard/coldStorageProvider` (§2) — my metric pills: pending bookings, stored lots; recent cold-storage activity feed.
2. The real picture → `GET /v1/post-harvest/provider/stats` (§20) — total capacity 500 MT, occupied MT, occupancy %, pending bookings, inwarded lots, **accrued rent**, total valuation stored. ⚠️ "Accrued rent" is the sum of estimated rents, not month-wise accrual — see gap #3.
3. Before advising farmers I peek at the market → `GET /v1/mandi/prices?crop=Onion&district=Solapur` (§4) — when Lasalgaon rates are poor I tell farmers "sambhala, store it, hold for July."
4. New booking requests → `GET /v1/post-harvest/provider/bookings?status=pending&page=1` (§20) — e.g. Ramchandra Pawar (Malshiras), 40 quintal onion, 6 months; I open the file → `GET /v1/post-harvest/provider/bookings/{booking_id}` — crop, dates, bags, estimated value, his phone.
5. I approve with Chamber A allocated → `POST /v1/post-harvest/provider/bookings/{booking_id}/review` `{action: "approve", allocatedChamberId: "ch-A", notes: "गुरुवारी सकाळी ९ ते ५ येणे"}` (§20) — Ramchandra gets an FCM "आरक्षण स्वीकृत", capacity is locked (atomic — two farmers can't oversell my godown, F11). If his lot looked wet/diseased I reject with a reason `{action: "reject", rejectionReason: "ओलावा जास्त — वाळवून आणा"}` — capacity is restored automatically and he is notified.
6. ⚠️ If a farmer books and **never turns up**, nothing auto-expires — his capacity stays blocked; I have to phone him. There is no TTL/release-for-no-show endpoint.

### Journey 4: Inward at the gate & the e-NWR (the document that matters)

1. Ramchandra's tractor-trolley arrives Thursday; weighbridge slip in hand → `POST /v1/post-harvest/provider/bookings/{booking_id}/inward` (§20) `{grossWeightKg: 4180, tareWeightKg: 180, netQuintals: 40, actualBags: 80, moisturePercent: 6.5, qcGrade: "A", chamberId: "ch-A", photo: <gate photo>}` — booking becomes `inwarded`; lot number `LOT-2026-…` and an **e-NWR receipt number `NWR-2026-…`** are generated; he gets FCM "गोदाम रसीद जारी (e-NWR)".
2. The receipt is the paper that gets him a pledge loan → `GET /v1/post-harvest/receipts/{receipt_number}` (§20) — depositor name, net quintals, grade, chamber, lot, valuation ₹88,000 (40 q × ₹2,200), `pledgeFinancingEligible: true`. Owner = him or me only; anyone else gets 404 so receipt numbers can't be probed.
3. ⚠️ `GET /v1/post-harvest/receipts` (list) reads only the caller's own bookings — for me, the provider, it returns **empty**; I must look the number up from the booking file. Minor quirk, not a missing endpoint.
4. ⚠️ MISSING — the receipt exists only as JSON. There is no downloadable e-NWR document/certificate and no public/verify path, so my bank manager in Mohol cannot independently verify it for a pledge. Suggested: `GET /v1/post-harvest/receipts/{receipt_number}/certificate`. See gap #1.
5. Sometimes I run the lot through the AI grader for a fair grade → `POST /v1/post-harvest/grade` (§20, multipart photos) — grade/uniformity/shelf-life/recommended price. ⚠️ It is a grading stub behind a confidence threshold — low-confidence grades are meant to go to human review; I am the human here.
6. ⚠️ Inward takes a chamberId but the platform tracks occupancy only at **facility** level — chamber `currentOccupancyMT` stays 0 in the doc; I keep chamber-wise registers in my bahi.

### Journey 5: Release, gate pass & rent collection

1. In July, Ramchandra asks to lift 25 q → he calls `POST /v1/post-harvest/bookings/{booking_id}/request-release` `{requestedQuintals: 25, pickupDate, vehicleNumber: "MH-13-AB-1234"}` (§20, farmer-side). I see it in my queue → `GET /v1/post-harvest/provider/bookings?status=release_requested`.
2. At the gate he pays ₹1,100 (25 q × 6 weeks-equivalent settled mutually) by UPI; I hand over the gate pass → `POST /v1/post-harvest/provider/bookings/{booking_id}/release` `{releaseQuintals: 25, vehicleNumber, driverName, amountPaid: 1100}` (§20) — status flips `partially_released`, gate pass `GP-2026-…` is issued, capacity freed, he gets FCM, and the platform ledger books its ₹50 booking fee against me.
3. The remaining 15 q sit until October → second release `{releaseQuintals: 15, amountPaid: 900}` — now `released`, `paymentStatus: "paid"`, timeline complete.
4. ⚠️ Rent itself accrues month-by-month in reality, but the platform only stores `estimatedMonthlyRent`/`totalEstimatedRent` and whatever `amountPaid` I type at release. The rent-reminder cron (`POST /v1/jobs/rent-reminders/run`) chases **land leases only** — no cold-storage rent invoice, due list, or monthly reminder exists. MISSING — see gap #3. My bahi-khata still rules here.

### Journey 6: Month-end, exceptions & support

1. Month-end check → `GET /v1/post-harvest/provider/stats` (§20) — occupancy %, accrued rent, valuation. My P&L → `GET /v1/pnl/summary` + `POST /v1/pnl/crops/{id}/expenses` (§8; electricity bill for the compressors goes in as an expense — cold storage is a power-guzzling business).
2. Facility tune-up between seasons → `GET /v1/post-harvest/provider/facilities?mine_only=true` and `PUT /v1/post-harvest/provider/facilities/{facility_id}` (§20) — Chamber C flipped to onion for the rabi glut, rate updated.
3. Notifications (booking approved/inwarded pings land here) → `GET /v1/notifications`, `POST /v1/notifications/{id}/read`, `PUT /v1/notifications/read-all` (§24).
4. When a farmer claims "5 bags short" or rot in Chamber A, there is no in-app dispute/claim flow for cold storage — I call him, we sort it at the godown, and if it escalates it goes to the platform's support/moderation lane (`user_reports` via §28.26 — admin resolves at `POST /v1/admin/reports/{id}/resolve`). ⚠️ MISSING a cold-storage-specific dispute endpoint with the booking timeline as evidence.
5. Small doubts ("how do I change the chamber temperature range?") → `POST /v1/chatbot/messages` in Marathi; for anything serious `POST /v1/chatbot/handoff` (§5) — a human expert calls back.
6. ⚠️ Spoilage/insurance: my stock-in-trade risk (power cut, compressor failure) has no policy surface in the app — crop insurance (§12) covers standing crops, not stored goods.

### Journey 7: Platform & superadmin touchpoints

1. My KYC approval/disputes surface at `POST /v1/admin/kyc/{id}/verify|reject` (§28.3).
2. The superadmin's cold-chain console reads `GET /v1/admin/cold-storage/facilities` and can onboard partners via `POST /v1/admin/cold-storage/facilities` (SOP-23, §28.23). ⚠️ Implementation split-brain: the admin directory reads the `cold_storages` collection while my facility (registered via §20) lives in `cold_storage` — admin-onboarded stores don't appear in the farmer directory and vice versa. ⚠️ SOP-23 §3 also promises "audit cold storage reservations and prevent overbooking", but no admin endpoint reads `cold_storage_bookings` — see gap #5.

### Journey 8: What the platform costs me & settlement

1. Pro renewal bills → `GET /v1/billing/invoices` + `GET /v1/billing/subscription` (§billing).
2. The ₹50/booking platform fee accrues per released booking in `platform_fees` (status `pending`) — but ⚠️ MISSING there is no endpoint for me to *see* or *pay* these fees; unlike transporters/equipment owners/brokers (§21 `GET /v1/transport/settlements`, `/equipment/settlements`, `/broker/settlements`), cold storage has no settlement surface at all. Acceptable for rent (farmers pay me directly at the gate), but the fee ledger is invisible — see gap #4. Suggested: `GET /v1/post-harvest/provider/fees`.
3. Bank account for any money movement → `GET /v1/bank-accounts` (§21); refresh tokens die at `POST /v1/auth/logout` when my grandson logs out on my behalf (§1).

---

> Two sub-identities, one phone-number world: **Kamalnath Maharaj**, 63, manager of **Shri Gokul Gaushala Trust**, Chhaumuhan, Mathura (UP) — 180 cattle, mostly desi Gir & Sahiwal, trust registered with 80G — and **Dr. Priya Sharma**, 34, B.V.Sc & A.H., who claimed her vet profile to do farm-visit consultations around Mathura district. Kamalnath runs the gaushala back-office on the `dairyManager` profile; Dr. Priya works the claimed-vet workspace on her own login.

---

## 14. Gaushala Manager + Vet

### Journey 1: Onboarding and gaushala profile setup (October 2026)

1. My nephew Devki Nandan installs Agrovercity on my JioPhone-smartphone and enters my number **+91 94100 12345**. The OTP itself comes from the Firebase SMS on the app screen — ⚠️ the app talks to Firebase directly for OTP; the backend session is made by exchanging that Firebase token → `POST /v1/auth/firebase-verify` (endpoints.md §1 — §1's `/auth/otp/send`+`/auth/otp/verify` are not in the implemented inventory; `/auth/firebase-verify` is the real handshake. Covered, different path). I get back `accessToken` + `refreshToken`.
2. I complete registration with my village Chhaumuhan, tehsil Chhata, Mathura, UP → `POST /v1/auth/register` (§1). I set my 4-digit MPIN → `POST /v1/auth/mpin/set` (implemented inventory).
3. The gaushala console is not a beginner profile — first I link the manager persona: → `POST /v1/users/me/profiles` body `{ profileType: "dairyManager" }` (§2), then activate it → `POST /v1/users/me/profiles/dairyManager/activate` (§2). ⚠️ Onboarding guardrail from the blueprint (features/farm_dairy&livestock manage.md B.2): unverified managers are browse-only; trust KYC docs (80G certificate, trust deed) go to the admin queue — there is no user-facing KYC-status endpoint in the inventory, I only see the badge on my profile → `GET /v1/users/me` (§2).
4. Now I create the gaushala file: name "Shri Gokul Gaushala Trust", trust name, address Chhaumuhan, district Mathura, phone, capacity 250, certifications `["80G","AWBI"]`, trust bank account (SBI Chhata, IFSC SBIN0001234) → `POST /v1/livestock/gaushala/profile` (endpoints.md §16) — 201. If I tap twice by mistake it would 409 `GAUSHALA_EXISTS`, so I check first → `GET /v1/livestock/gaushala/mine` (§16, 404 until created).
5. Later I correct the office phone number → `PUT /v1/livestock/gaushala/profile` (§16).

### Journey 2: Morning dashboard — the day's darshan in numbers

1. After aarti and feeding, I open the gaushala console home: headcount 180, by category (calf/heifer/milch/dry/old/bull), occupancy vs capacity 250 (72%), active adoptions 14, this month's donations ₹41,500, this month's expenses ₹63,200 → `GET /v1/livestock/gaushala/dashboard` (endpoints.md §16).
2. The 6-month trend — intakes rising after Diwali, donations dipping — → `GET /v1/livestock/gaushala/analytics?month=2026-10` (§16).
3. Any overnight system news — adoption approvals, donation receipts, vet bookings FCM'd to the trust → `GET /v1/notifications?page=1` (§24). ⚠️ Not captured in `/tmp/implemented_endpoints_v2.txt` (empty-path route), but it exists in code at `backend/app/routers/notifications.py:40`. Mark read → `POST /v1/notifications/{id}/read` (§24).
4. I switch my profile back to plain `farmer` sometimes to check mandi bhav for our fodder maize → `POST /v1/users/me/profiles/farmer/activate` (§2) → `GET /v1/mandi/prices?crop=Maize&district=Mathura` (§4). (Not gaushala money, but I buy 40 quintal maize a month.)

### Journey 3: Cattle inventory — intake, events, the old cow Gangotri

1. A truck from Highway NH-19 brings 6 rescued cattle from the district magistrate's seizure. I register each one: tag, breed, sex, approximate age, with `gaushalaId` set so it lands in our shelter → `POST /v1/livestock/animals` `{ gaushalaId, tagId, breed, … }` (§16) — 201, and the platform itself records the intake event (`cattleStatus: "in-shelter"`). Offline in the shed? I queue the writes and replay with `Idempotency-Key` (§Conventions).
2. I check the shelter list, filter by category → `GET /v1/livestock/gaushala/cattle?category=milch` (§16).
3. Gangotri, our 16-year-old Gir cow (tag GKT-0042), is adopted by a family in Vrindavan — I mark her out → `POST /v1/livestock/gaushala/cattle/GKT-0042/events` `{ type: "adopted-out", note: "Sharma family Vrindavan", date: "2026-10-11" }` (§16) — sets her `cattleStatus`.
4. Two weeks later sad news: old Nandini passed in her sleep → `POST /v1/livestock/gaushala/cattle/GKT-0019/events` `{ type: "deceased", note: "natural, age ~18" }` (§16). (Transfer-out works the same with `type: "transferred"`.)
5. Milk yield of our 22 milking cows goes in the animal log → `POST /v1/livestock/animals/{animal_id}/logs` and the herd book → `GET /v1/livestock/animals/{animal_id}/logs` (§16 area, implemented).

### Journey 4: Adoptions and donations — the 80G receipt machine

1. Ramesh Agarwal ji from Barsana pledges ₹11,000/month "godaan" for cow GKT-0077 (Kamadhenu). He files it from his app → his side: `POST /v1/livestock/gaushala/adoptions` (§16). My queue shows it → `GET /v1/livestock/gaushala/adoptions` (§16). ⚠️ I check his photo ID against the donor name manually — there is no in-app verification step; also ⚠️ **no payment is collected in-app**: `amountInr` is typed by the donor, money actually arrives by UPI/bank transfer to the trust account outside the app. The app issues the tax document regardless (see Gap 1).
2. I verify the pledge on our bank statement (SBI alert), then approve → `PUT /v1/livestock/gaushala/adoptions/{adoption_id}/status` `{ status: "approved" }` (§16). The app **auto-creates the 80G receipt** — `certificateNumber` like `80G/2026-27/…`, financial-year sequenced per gaushala, PDF built server-side (`certificateUrl`) — and FCMs Ramesh ji: "गोदत्तक स्वीकृत… रसीद क्र. … जारी की गई है।" When the year's sponsorship ends I mark `completed`; a bad-faith pledge → `rejected` (409 `INVALID_TRANSITION` if I try to jump states wrongly).
3. One-time donations queue the same way: `GET /v1/livestock/gaushala/donations` (§16); I acknowledge the ₹5,100 fodder donation from the Baradwari mandir → `PUT /v1/livestock/gaushala/donations/{donation_id}/status` `{ status: "acknowledged" }` (§16) → 80G receipt auto-issued, `receiptNumber` + `receiptPdfRef` attached, donor FCM'd. (`rejected` for a fake entry.)
4. At year-end my CA wants the receipt register: → `GET /v1/livestock/gaushala/receipts` (§16) — newest first, `eightyGEligible: true`, certificate numbers, amounts. The PDF URL is already on each receipt doc (generated at issuance). ⚠️ There is no donor-facing "my receipts" page for Ramesh ji in the inventory — he only sees the FCM + PDF link; a re-download for a lost receipt means asking me.
5. Public trust page (donor confidence): → `GET /v1/livestock/gaushala/{gaushala_id}/transparency` (implemented inventory) shows our headcount, intake/outflow and receipt counts to anyone.

### Journey 5: Expenses and month-end books

1. Every purchase is entered the same day — 40 quintal maize ₹36,000 (fodder), Dr. Priya's visit ₹1,500 (medical), diesel for the tractor ₹2,800 (transport), panchayat water bill (utilities) → `POST /v1/livestock/gaushala/expenses` `{ category, amount, note, expenseDate }` (§16) — 201.
2. Typo on the diesel entry → `PUT /v1/livestock/gaushala/expenses/{expense_id}` (§16); a duplicated entry → `DELETE /v1/livestock/gaushala/expenses/{expense_id}` (§16).
3. Month view for the managing-committee meeting → `GET /v1/livestock/gaushala/expenses?month=2026-10` + category totals → `GET /v1/livestock/gaushala/expenses/summary?month=2026-10` (§16).

### Journey 6: Running the vet network and vaccination campaigns

1. I onboard Dr. Priya into the Mathura directory — name, phone, B.V.Sc qualification, specializations (bovine fertility, mastitis), clinic address, 9 years experience, fees ₹300 clinic / ₹500 farm / ₹200 tele, farm visits yes, emergency no, vet council reg no → `POST /v1/livestock/vets/managed` (§16) — 201. Later she calls with a new fee → `PUT /v1/livestock/vets/managed/{vet_id}` (§16). Directory overview with claimed flags and ratings → `GET /v1/livestock/vets/managed` (§16).
2. A quack listing sneaks in — I deactivate it so no new appointments land → `DELETE /v1/livestock/vets/managed/{vet_id}` (§16, soft `inactive`). Her registration certificate update → `POST /v1/livestock/vets/managed/{vet_id}/credential` (implemented).
3. **HS (हैजा-सानक) vaccination drive**, 15 Oct–30 Nov 2026, target districts Mathura & Bharatpur: → `POST /v1/livestock/vet/campaigns` `{ title: "HS Tika Abhiyan", vaccine: "HS", fromDate, toDate, targetDistricts }` (§16) — 201. (Dr. Priya can also create campaigns from her own workspace — the creator may be manager or vet.)
4. Progress check → `GET /v1/livestock/vet/campaigns/{campaign_id}` (§16) — enrollments + count. Farmers enroll their own animals (`POST …/enroll`); on the ground, after vaccinating GKT-0031 I mark it → `POST /v1/livestock/vet/campaigns/{campaign_id}/mark-vaccinated` `{ animalId }` (§16) — enrollment flips to `vaccinated`, farmer FCM'd (404 `ENROLLMENT_NOT_FOUND` if the animal wasn't enrolled first).
5. Oversight of the whole appointment board of the district network → `GET /v1/livestock/appointments?status=&date=` (§16 — manager sees all).
6. Her B.V.Sc registration goes for official verification → the superadmin stamps it → `POST /v1/admin/livestock/vets/{vet_id}/verify` (§28.19 / SOP-19 §5 — admin-side; I only see the verified flag appear).

### Journey 7: Exceptions, support, and admin touchpoints

1. An adoption donor disputes a receipt amount (he typed ₹11,000 but meant ₹1,100). I cannot edit an issued receipt (by design — tax doc, never alter) so I ask platform support → `POST /v1/support/ask` (implemented inventory) with the receipt number; the superadmin can audit our orders and receipts from the SOP-19 console (`GET /v1/admin/livestock/orders`, §28.19) and advises me to reject-and-reissue. ⚠️ No livestock-specific dispute ticket type exists — support/ask is the only lane, and cancellation disputes SOP-19 promises to "mediate" land on the same admin console.
2. A farmer reports a no-show for Dr. Priya's farm visit → she had cancelled the slot in the appointment lifecycle (`POST /v1/livestock/appointments/{id}/status` `{status:"cancelled"}`, §16) but the farmer says he never got the FCM. I check the board → `GET /v1/livestock/appointments?date=2026-10-16` (§16) and confirm; the farmer's recourse is again the support lane.
3. Data compliance: a devotee asks what data the app holds on him → I point him to export → `POST /v1/users/me/data-export` (implemented inventory) and consent flags → `GET/PUT /v1/users/me/consents` (implemented).

---

### Part 2 — Dr. Priya Sharma (Claimed Vet)

### Journey 1: Claiming my vet profile

1. I register on my own phone (+91 98970 55521), same Firebase-OTP dance → `POST /v1/auth/firebase-verify`, then `POST /v1/auth/register` with role profiles (§1).
2. Kamalnath ji has already listed me in the directory, so my claim matches my **registered phone number** to that `vets` doc → `POST /v1/livestock/vets/claim` (§16) — sets `claimedByUid`. If my number in his listing was wrong → 404 `VET_NOT_FOUND` (that's exactly what happened the first time; he fixed it with `PUT /v1/livestock/vets/managed/{vet_id}`). Someone else claiming → 409 `ALREADY_CLAIMED`.
3. My workspace: profile, schedule, total appointments, month earnings, rating → `GET /v1/livestock/vets/me` (§16). My profile fields (fee ₹500 farm visit, clinic in Mathura city) were set by Kamalnath ji's onboarding; visible to farmers in the public directory → `GET /v1/vets?lat=&lng=` (§16).

### Journey 2: Schedule management

1. I set my week: Tue/Thu/Sat farm-visit slots 09:00–13:00 around Chhata & Chhaumuhan, Mon–Fri clinic 17:00–20:00, teleconsultation on, emergency off → `PUT /v1/livestock/vets/me/schedule` `{ weeklySlots, emergencyAvailable, teleAvailable }` (§16).
2. Diwali week off → add leave dates (leaves merge additively, so I just append) → same `PUT` (§16). Review → `GET /v1/livestock/vets/me/schedule` (§16). ⚠️ The app validates bookings against these slots server-side — a farmer can't book my Tuesday afternoon because no slot exists.

### Journey 3: Appointment lifecycle — Suresh's buffalo with mastitis

1. Suresh Chaudhary (farmer, Govardhan) books a farm visit for his buffalo, slot validated against my schedule → his side `POST /v1/livestock/appointments` (§16) — fee defaults to my farm-visit ₹500, and I get an FCM ping. ⚠️ **The fee is only recorded, never collected** — there is no pay step at booking, no wallet hold, no refund on cancel (see Gap 2).
2. Morning inbox: requested visits → `GET /v1/livestock/vets/me/appointments?status=requested` (§16). I confirm Suresh's → `POST /v1/livestock/appointments/{appt_id}/status` `{ status: "confirmed" }` (§16) — he gets FCM.
3. Driving to Govardhan, I start the visit → same endpoint `{ status: "in-progress" }`.
4. At the farm: mastitis, 5-day course — I complete with notes and the prescription inline → same endpoint `{ status: "completed", vetNotes: "…", prescription: { diagnosis, medicines: [{name:"Intramammary cephalexin", dosage, frequency, durationDays:5}], milkWithdrawalDays: 4, followUpDate } }` (§16). The platform auto-creates the `prescriptions` doc and FCMs Suresh. (A prescription without an appointment, e.g. follow-up at the gaushala for GKT-0088, goes separately → `POST /v1/livestock/prescriptions` (§16) — 404 `ANIMAL_NOT_FOUND` if the animal isn't in the system.)
5. Suresh can later pull that prescription → `GET /v1/livestock/prescriptions?animalId=…` (§16; access: me, any dairyManager, or the animal's owner — 403 otherwise).
6. If Suresh cancels before I start, he may (`requested|confirmed → cancelled`); once I'm `in-progress`, only I can complete or cancel (403/409 otherwise).

### Journey 4: Campaigns in the field

1. I co-run the HS drive Kamalnath ji created → `GET /v1/livestock/vet/campaigns?status=active` (§16).
2. In Baradwari village I vaccinate enrolled animals one by one → `POST /v1/livestock/vet/campaigns/{campaign_id}/mark-vaccinated` `{ animalId }` (§16) — farmer gets the "vaccinated" FCM with withdrawal guidance. Duplicate dose on the same animal → 409 `ALREADY_ENROLLED` won't fire (enrollment exists) but the mark is idempotent-ish: 404 if never enrolled, so I ask the farmer to enroll first (`POST …/enroll` is owner-only — I can't enroll for him). ⚠️ Enrollment is strictly per-owner; for gaushala cattle Kamalnath ji enrolls our 180 head himself.
3. If I run my own foot-and-mouth camp in my panchayat area, I create it myself → `POST /v1/livestock/vet/campaigns` (§16 — vet may create).

### Journey 5: Earnings — and the payout that never comes

1. Month-end: → `GET /v1/livestock/vets/me/earnings?month=2026-10` (§16) — completed appointments (14 farm visits × ₹500 + 9 tele × ₹200 = ₹8,800) and totals. All-time → same endpoint without month.
2. But that ₹8,800 is a screen number. Suresh paid me ₹500 in cash at the farm (the app never moved money), and there is **no settlement, no payout request, no vet wallet** anywhere — ⚠️ MISSING — `GET /v1/livestock/vets/me/settlements` + `POST /v1/livestock/vets/me/payouts` (Gap 3). The settlement batch engine (`/jobs/settlements/run`) doesn't know the `vet` role.
3. For what it's worth, my bank account is on file the generic way → `POST /v1/bank-accounts` + penny-drop `POST /v1/bank-accounts/{account_id}/verify` (implemented inventory; ⚠️ not captured in the inventory file — empty-path routes — but live in `backend/app/routers/bank_accounts.py:54,66`). Nothing in the vet module reads it.

### Journey 6: Ratings, support, and staying verified

1. After each completed visit farmers rate me; my average shows on my workspace (`GET /v1/livestock/vets/me`) and in the directory (`GET /v1/livestock/vets/managed` rating aggregates). I cannot reply to ratings — read-only.
2. A cancellation dispute reaches me via the manager → I put my side in `POST /v1/support/ask` (implemented); the superadmin mediates from the SOP-19 console (`GET /v1/admin/livestock/orders` audit + vet list `GET /v1/admin/livestock/vets`, §28.19). My verification stays green as long as my council registration (no. UP-VCI-44821) is on file — updated via `POST /v1/livestock/vets/managed/{vet_id}/credential`.
3. Devotee-hours: I also write the gaushala cattle's vet records (treatment history per animal) → `POST /v1/livestock/vet/records` + vaccination schedules → `POST /v1/livestock/vet/vaccinations` (implemented inventory), read back via the matching GETs — this is the per-animal health chart Kamalnath ji audits at month-end.

---

## 15. Superadmin / Platform Ops

> Nikhil Verma, 34, platform operations lead at AGROVERCITY HQ, Pune — also wears the compliance-officer hat. His "farm" is the platform itself: 14 personas, 27 SOP modules, one Firestore backend. He thinks in queues, SLA timers and maker-checker thresholds, and his village is whichever one today's escalation comes from.

### Journey 0: Getting my admin access (onboarding)

1. My admin account isn't something I sign up for in the app — HQ provisioning sets the `admin: true` Firebase claim and my `adminRole: superadmin` on the user doc, out-of-band → ⚠️ no endpoint — admin provisioning itself is a manual ops step (no `POST /v1/admin/admins`)
2. First login is the normal user flow with my work number → `POST /v1/auth/otp/send` then `POST /v1/auth/otp/verify` (endpoints.md §1) — the console web app sees the admin claim and routes me to `/console` instead of the farmer home
3. Before any destructive action (ban, refund, payout release) the console makes me re-verify my MPIN as a step-up check → `POST /v1/admin/verify-mpin` (§28) — wrong MPIN gives 403 `INVALID_MPIN` in Hindi ("अमान्य MPIN"), three tries and I step away for coffee

### Journey 1: Morning chai and platform health (daily home)

1. 8:45 AM — open the console home. KPI wall: user/persona counts, marketplace + e-market GMV, active leases, pending KYC/claims/settlements, transport bookings, open reports → `GET /v1/admin/analytics/summary` (§28.26); the older unified view → `GET /v1/admin/overview` (§28)
2. Check overnight cron hygiene: settlement batch, escrow releases, mandi sync — every row of `cron_job_logs` → `GET /v1/admin/jobs/cron-logs` (§28.25). Last night's Agmarknet sync failed at 03:12 with a timeout — noted for Journey 3
3. AI stack heartbeat (OpenRouter, Sarvam, vision gateway latency) → `GET /v1/admin/ai/health` (§28)
4. The copilot briefing my team wired up summarises yesterday's anomalies → `GET /v1/admin/copilot/briefing` (§28) — today it flags 3 held settlement lines and a KYC device-farm cluster
5. ⚠️ The SOP-26 §3 "real-time system health — DB latency, Redis hit-rates, Sentry error logs" screen is only partially real: `GET /v1/admin/overview` returns a hardcoded `"platformHealth": "100% Operational"` string, not measured latency — the honest bits are the AI gateway health and cron logs

### Journey 2: KYC queue duty (compliance)

1. Open the pending pile → `GET /v1/admin/kyc/pending` (§28.3) — 41 docs this morning, AI extraction and risk reasons attached (PAN-name mismatch, duplicate device)
2. First case: Ramesh Bhoyar, soybean farmer, Yavatmal — Aadhaar + PAN uploaded. The queue row carries the OCR extraction and the document image URL for the side-by-side preview with zoom/rotate → ⚠️ that preview is pure console UI reading the `docUrl` field; there is no dedicated endpoint, fine, but Aadhaar redaction masking (SOP-03 §3 "redaction masking checks") is a console-side render rule, not enforced by any endpoint
3. Approve, badge issued instantly → `POST /v1/admin/kyc/{id}/verify` (§28.3) — console forces the `X-Audit-Reason: "Matched OCR PAN with registered profile"` header or the API 422s ⚠️ (header contract from §28 preamble)
4. Second case: a vyapari from Amravati with a blurry GST certificate — reject with reason → `POST /v1/admin/kyc/{id}/reject` (§28.3) — reason min 3 chars, farmer sees it in-app and re-uploads
5. Compliance audit trail for the state inspection next week → `GET /v1/admin/kyc/history` (§28.3)
6. DPDP consent records for the user who filed an RTI → `GET /v1/admin/consents/{uid}` (§28)

### Journey 3: Mandi rates and the Agmarknet firefighting

1. Trader-submitted rates waiting for me → `GET /v1/admin/rates/pending` (§28.4) — each row flagged when it breaches the ±15% Agmarknet sanity band. Santosh Vyapari's cotton rate is +18% over modal → reject → `POST /v1/admin/rates/{id}/reject` (§28.4) with an explanation that lands back on his feed
2. Approve the sane ones → `POST /v1/admin/rates/{id}/approve` (§28.4) — goes live on the farmer "Aaj ke Bhav" widget, cache invalidated
3. The 03:12 sync failure from Journey 1: re-trigger the Agmarknet/eNAM pull → `POST /v1/admin/mandi/sync` (§28.4) — writes a `cron_job_logs` row either way
4. But the Nagpur cotton mandi's government feed has been dead for two days — SOP-04 §3 says I should key in a manual rate or override. There is no create/override endpoint → ⚠️ MISSING — `POST /v1/admin/mandi/rates` (manual rate entry). Right now I phone the mandi secretary and put the number in the broadcast instead — ugly
5. Cross-check flagged outliers → `GET /v1/admin/rates/flagged` (§28) for anything the band-catch missed

### Journey 4: Marketplace ops — orders, refunds, catalog

1. Order desk → `GET /v1/admin/marketplace/orders` (§28.6) — delivery status and payment status columns; Sunita's ₹12,400 urea + pesticide order from Akola never got picked by the dealer
2. Dealer never shipped, customer wants money back → refund → `POST /v1/admin/marketplace/orders/{id}/refund` (§28.6). ₹12,400 > ₹10,000 maker-checker threshold ⚠️ so the API returns `{requiresApproval: true}` and parks a pending `admin_approvals` doc — my junior (maker) can't complete it; I must second it → `GET /v1/admin/approvals` then `POST /v1/admin/approvals/{id}/approve` (§28) — Razorpay reversal fires on approval for the online-paid leg
3. Catalog work: add the new ADM-batch nano-urea SKU → `POST /v1/admin/marketplace/products` (§28.6); fix MRP vs discounted-price error on a listed bio-fertilizer → `PUT /v1/admin/marketplace/products/{id}` (§28.6) — 422 if discounted > MRP
4. SOP-06 §3 wants Agmark/Ministry QR authenticity certificates uploaded per SKU so farmers can verify genuine inputs → ⚠️ MISSING — `POST /v1/admin/marketplace/products/{id}/certificates`. The product doc has no certificate field at all; counterfeits are a phone-in complaint today
5. Abusive review on a pesticide listing reported by the seller → the moderation queue → `GET /v1/admin/moderation-queue` then `POST /v1/admin/moderation/{item_id}/action` (§28); a defamatory 1★ on a transporter → soft delete → `DELETE /v1/admin/ratings/{rating_id}` (§28.22) and the provider's public aggregate is re-curated

### Journey 5: Transport and equipment interventions (exceptions)

1. Live ops board: all active trips → `GET /v1/admin/transport/bookings` (§28.8) — the "live dispatch map" is the console plotting these rows ⚠️ (client-side, no geo endpoint). One trip Pune→Nashik shows `accepted` 30 hours, driver not moving
2. I intervene with the same state machine the transporter uses → `PUT /v1/admin/transport/bookings/{id}/status` (§28.8) — force-cancel with reason, or re-drive the transition; illegal transitions 409 `ILLEGAL_TRANSITION`. For a no-show I can also reassign by passing a different `transporterId` in the body — that's how the C4 "reassign transporter" spec is covered
3. Fleet side: new truck registrations → `GET /v1/admin/transport/vehicles` (§28.8); approve RC + fitness + commercial insurance → `POST /v1/admin/transport/vehicles/{id}/verify` (§28.8). A fraud-y transporter gets suspended → `POST /v1/admin/transport/transporters/{transporter_id}/suspend` (§28)
4. Equipment: tractor KYC → `GET /v1/admin/equipment` (§28.9) → `PUT /v1/admin/equipment/{id}/verify` (§28.9). A double-booked rotavator slot in Beed → force-cancel with auto-refund → `DELETE /v1/admin/equipment/bookings/{id}` (§28.9) — slot released, waitlist head promoted, farmer + owner notified
5. SOP-09 §3 damage reports with security-deposit forfeiture: no endpoint — damage notes ride along in the booking status body ⚠️ MISSING — `POST /v1/admin/equipment/bookings/{id}/damage-claims` (forfeit/waive deposit decision)
6. Transporter C5 wants me to manage base fares, per-km bands and seasonal surge (wheat harvest Apr–May) → ⚠️ MISSING — `GET/PUT /v1/admin/transport/pricing-rules`. The fare engine only reads per-vehicle rates set by owners; surge today is a client-supplied multiplier capped server-side — no admin pricing surface exists

### Journey 6: The money desk — settlements, penny-drop, claims (settlement/payout)

1. Monday settlement batch: review pending payout lines → `GET /v1/admin/settlements` (§28.25); re-run a batch with a custom period → `POST /v1/admin/jobs/settlements/run` (§28.25)
2. The copilot's 3 held lines → `GET /v1/settlements/holds` (§28/§25 family) — release or reject → `POST /v1/settlements/holds/{line_id}/release` / `reject` (§28). Lines auto-hold via the payout-anomaly scorer; but when *I* smell fraud SOP-25 §3 says I should be able to place a line on legal hold myself → ⚠️ MISSING — `POST /v1/admin/settlements/holds` (only list/release/reject exist; no create)
3. Commission structure → `GET /v1/admin/platform-config/commissions`, tweak transport % → `PUT /v1/admin/platform-config/commissions` (§28.25)
4. Penny-drop failure pile from the bank → `GET /v1/admin/finance/accounts` (§28.14, masked XXXX+last4 only — compliance-safe). A genuine account failed because the farmer typo'd IFSC; override → `POST /v1/admin/finance/accounts/{id}/override-verify` (§28.14) — again maker-checker above ₹10k
5. Loan underwriting queue → `GET /v1/admin/finance/loans` (§28.14); approve along the LOAN_TRANSITIONS machine → `PUT /v1/admin/finance/loans/{id}/status` (§28.14). KCC score factor distribution → `GET /v1/admin/finance/kcc` (§28). ⚠️ Repayment-milestone/default tracking (SOP-14 §3) has no endpoint — no `GET /v1/admin/finance/loans/{id}/repayments` anywhere
6. Insurance claims desk → `GET /v1/admin/claims` (§28.15); assign surveyor → `POST /v1/admin/claims/{id}/assign-surveyor` (§28.15); Dattaram Pawar's soybean hail-damage claim approved at ₹86,000 → `PUT /v1/admin/claims/{userId}/{claimId}` (§28.15) with payout amount + DBT txn id — ₹86,000 > ₹50,000 dual-signoff ⚠️ so it routes to a second finance admin via `admin_approvals`. Seasonal premium tables → `PUT /v1/admin/insurance/rates` (§28.15, always second-admin)
7. GST audit of our service-fee invoices (SOP-25 §3) → ⚠️ MISSING — `GET /v1/admin/reports/financial` (GST/TDS reports). I export nothing today; finance pulls numbers by hand from settlements rows

### Journey 7: Disputes and arbitration (exceptions)

1. Unified dispute inbox across bookings/lots/deals/equipment/land → `GET /v1/admin/disputes` (§28), triaged by category → routed role and SLA clock already stamped by the triage job; open one → `GET /v1/admin/disputes/{dispute_id}` (§28)
2. The Nashik trip from Journey 5 became a full dispute — produce damaged, escrow frozen. Per features/farm_transporter.md C6 I should rule: release-to-farmer / split / release-to-transporter / partial refund / penalty. The resolve endpoint only accepts free text → `POST /v1/admin/disputes/{dispute_id}/resolve` (§28) with `"resolution": "Split 70/30 favouring farmer"` — ⚠️ MISSING the money movement: no structured outcome fields, escrow release/split/penalty is not executed by this endpoint (only the nightly silent-window job ever releases held escrows). My ruling is a note in a doc, not a financial action
3. Broker-deal escalation → `GET /v1/admin/deals` (§28), escalate a collusive deal → `POST /v1/admin/deals/{deal_id}/escalate` (§28)

### Journey 8: Users, sessions, fraud (support/admin touchpoints)

1. "My account got hacked" call via the helpline ticket → find the user → `GET /v1/admin/users?q=` (§28.2), full persona view → `GET /v1/admin/users/{uid}` (§28.2)
2. Kill every session → `POST /v1/admin/auth/users/{uid}/revoke-sessions` (§28.1); force MPIN reset — issues a 6-digit `mpinResetOtp` on the user doc → `POST /v1/admin/auth/users/{uid}/reset-mpin` (§28.1) ⚠️ the OTP delivery is via the SMS provider webhook, not an API response field the console can show; account status → `PUT /v1/admin/auth/users/{uid}/status` (§28.1)
3. Auth audit: login history + IPs → `GET /v1/admin/auth/users` (§28.1); the immutable admin-action trail → `GET /v1/admin/audit` (§28)
4. Device-farm cluster from the briefing → `GET /v1/admin/fraud-queue` (§28); referral fraud report (duplicate phones, top referrers, open holds) → `GET /v1/admin/referrals/audit` (§28.22); platform UGC reports → `GET /v1/admin/reports` then resolve with warning/ban/dismiss → `POST /v1/admin/reports/{id}/resolve` (§28.26)
5. SOP-01 §3 says I can toggle 2FA/MPIN enforcement flags → `PUT /v1/admin/feature-flags` (§28) takes them, ⚠️ but nothing in the auth path reads `featureFlags` — the flag is write-only. Enforcement of the MPIN gate itself is hardcoded, not flag-driven

### Journey 9: Field ops, water, land, FPO, livestock, women (verification sweeps)

1. Land desk: listings with AI quality flags → `GET /v1/admin/land/listings` (§28.10); a lease rent dispute → `GET /v1/admin/land/leases` (§28.10), read the generated agreement PDF → `GET /v1/admin/land/leases/{id}/agreement` (§28.10), arbitrate termination → `PUT /v1/admin/land/leases/{id}/terminate` (§28.10). 7/12 gateway health → `GET /v1/admin/land-records/status` (§28.16); seed records during portal downtime → `POST /v1/admin/land-records/seed` (§28.16); import audit → `GET /v1/admin/land-records/audit-log` (§28.16). Exporting the verification log for the revenue office (SOP-16 §3) → ⚠️ MISSING — `GET /v1/admin/land-records/audit-log/export`
2. Water: Waghad canal rotation update → `PUT /v1/admin/water/canal-schedule` (§28.17); CGWB station readings ingested → `POST /v1/admin/water/groundwater-readings` (§28.17); PMKSY subsidy caps → `PUT /v1/admin/water/subsidy-rules` (§28.17). Water-usage efficiency stats (SOP-17 §3) → ⚠️ MISSING — `GET /v1/admin/water/usage-stats`
3. FPOs: pending list → `GET /v1/admin/fpo` (§28.18); verify ROC/NABARD/SFAC docs → `POST /v1/admin/fpo/verify/{id}` (§28.18); sponsor a group-buy pool for onion seed → `POST /v1/admin/fpo/pools` (§28.18), close it → `PUT /v1/admin/fpo/pools/{id}/status` (§28.18). FPO turnover/patronage-dividend oversight (SOP-18 §3) → ⚠️ MISSING — `GET /v1/admin/fpo/{id}/financials`
4. Livestock: vet credentials queue → `GET /v1/admin/livestock/vets` (§28.19) → `POST /v1/admin/livestock/vets/{id}/verify` (§28.19); gaushala audit → `GET /v1/admin/livestock/gaushalas` (§28.19); dairy/manure orders → `GET /v1/admin/livestock/orders` (§28.19). Nursery approvals (SOP-19 §3) → ⚠️ MISSING — `POST /v1/admin/nurseries/{id}/verify` (only `GET /v1/admin/nurseries` exists). FAT/SNF rate-chart oversight + 80G receipt issuance (SOP-19 §3) → ⚠️ MISSING — `GET /v1/admin/livestock/dairy/rate-charts`
5. Women/SHG: verification queue → `GET /v1/admin/women/shgs/queue` (§28.24) → `POST /v1/admin/women/shgs/{id}/verify` (§28.24); interest-subvention subsidy to a group bank account → `POST /v1/admin/women/subsidies/disburse` (§28.24); curate home-enterprise storefront → `GET /v1/admin/women/enterprise-products` (§28.24); SHG corpus totals → `GET /v1/admin/women/shg` (§28.24). Socio-economic impact metrics (SOP-24 §3) → ⚠️ MISSING — `GET /v1/admin/women/impact-report`
6. Cold chain: facility directory → `GET /v1/admin/cold-storage/facilities` (§28.23); onboard a partner → `POST /v1/admin/cold-storage/facilities` (§28.23). But auditing `cold_storage_bookings` and overbooking (SOP-23 §3) → ⚠️ MISSING — `GET /v1/admin/cold-storage/bookings`

### Journey 10: Knowledge, advisory and content ops

1. Kisan Mitra transcripts with handoff filter → `GET /v1/admin/chatbot/transcripts` (§28.12); the 24-h SLA expert queue → `GET /v1/admin/chatbot/handoffs` (§28.12); assign Dr. Kelkar (agronomist) → `POST /v1/admin/chatbot/handoffs/{id}/assign` (§28.12). Conversation satisfaction scores (SOP-12 §3) → ⚠️ no field/endpoint — transcripts carry message counts, not CSAT
2. Tweak the LLM system prompt → `PUT /v1/admin/chatbot/prompt-config` (§28.12) — always maker-checker; expert roster → `GET /v1/admin/experts`, edit → `PUT /v1/admin/experts/{expert_id}` (§28)
3. Disease-scan accuracy watch → `GET /v1/admin/advisory/scans` (§28.11) with <0.7 confidence flags; geofenced pest alert for pink bollworm in Vidarbha → `POST /v1/admin/advisory/pest-alerts` (§28.11); soil-test queue → `GET /v1/admin/soil-tests` (§28.11); upload lab PDF + NPK → `POST /v1/admin/soil-tests/{id}/results` (§28.11)
4. Diary/P&L: regional spend stats → `GET /v1/admin/diary/summary` (§28.13); set cotton benchmark costs → `PUT /v1/admin/pnl/benchmarks/cotton` (§28.13)
5. CMS: publish a kharif advisory article → `POST /v1/admin/content/{collection}` (§28.20), edit → `PUT /v1/admin/content/{collection}/{id}` (§28.20), kill a stale one → `DELETE /v1/admin/content/{collection}/{id}` (§28.20); workshop roster → `GET /v1/admin/workshops/{id}/roster` (§28.20); live-channel chat abuse → `POST /v1/admin/content/channels/{channel_id}/moderate` (§28)
6. Courses: review queue → `GET /v1/admin/courses/queue` (§28.27); publish/reject (reason mandatory) → `POST /v1/admin/courses/{id}/review` (§28.27); feature the drip-irrigation course → `POST /v1/admin/courses/{id}/feature` (§28.27); sales/GMV aggregates → `GET /v1/admin/courses/report` (§28.27)

### Journey 11: Trees, climate, gamification

1. Sapling requests → `GET /v1/admin/tree/requests` (§28.21); approve/dispatch → `PUT /v1/admin/tree/requests/{id}/status` (§28.21); NGO directory → `GET /v1/admin/tree/ngos` (§28.21) + `POST /v1/admin/ngos/{ngo_id}/verify` (§28). Delivery logistics + planting survival rates (SOP-21 §3) → ⚠️ MISSING — `GET /v1/admin/tree/requests/{id}/survival` (status stops at `dispatched`); biofuel crop economics update (SOP-21 §3) → ⚠️ MISSING — `PUT /v1/admin/biofuel-trees/{id}` (read-only today)
2. Carbon credit desk → `GET /v1/admin/climate/carbon-audit` (§28.23); certified variety specs → `PUT /v1/admin/climate/varieties/{id}` (§28.23)
3. AgriCoins: circulation → `GET /v1/admin/gamification/ledger` (§28.22); correct a wrongly-burned wallet (maker-checker above ₹10k market value) → `POST /v1/admin/gamification/adjust` (§28); new reward voucher → `POST /v1/admin/gamification/rewards` (§28.22). Configuring earn rates for diary/booking/invite activities (SOP-22 §3) → ⚠️ MISSING — `GET/PUT /v1/admin/platform-config/coins` (the coins service reads `platform_config/coins` and its own docstring promises an admin-editable, maker-checker surface — but no route writes it)

### Journey 12: Config, broadcasts, closing the day

1. Force-update gate for the old Android 9 handsets → `GET /v1/admin/app-config` / `PUT /v1/admin/app-config` (§28.26); feature flags → `PUT /v1/admin/feature-flags` (§28.26)
2. Hailstorm warning to all Maharashtra farmers → `POST /v1/admin/broadcast` (§28.26) — persona/state/district filters, persisted with sent counts
3. Export the user roster CSV for the state agriculture department audit (SOP-02 §3) → ⚠️ MISSING — `GET /v1/admin/users/export`. I page `GET /v1/admin/users` and my analyst scrapes JSON to CSV — works, but the SOP promises a server-side export, and transporter admin C10 wants CSV/PDF financial + GST reports too
4. Notification-template management (transporter C11) → ⚠️ MISSING — `GET/PUT /v1/admin/notification-templates` — today's copy edits are code deploys
5. Sign-off: approvals inbox cleared → `GET /v1/admin/approvals` (§28); audit log reviewed → `GET /v1/admin/audit` (§28). Every mutation I made today carried `X-Audit-Reason` ⚠️ — that header is mandatory (min 3 chars, else 422) and writes immutable `audit_logs` rows with my admin id, IP, before/after state
