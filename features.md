# AGROVERCITY / Kisan Setu — Feature Specification

> Extracted from the Flutter prototype at `flutter-prototype/` (package `kisan_setu_app`).
> Use this document to rebuild the same application. All features below exist in the
> prototype UI (backed by demo data) unless marked **[planned]** (documented in the
> Change Request Document v1.1 or PBR roadmap, UI partially mocked).

---

## 1. Product Overview

- **Product:** AGROVERCITY — "Kisan Setu" (किसान सेतु, "Farmer's Bridge"), a smart agriculture & farming **super app** for India.
- **Audience:** Farmers plus 5 adjacent agri-business personas (landlord, transporter, seller/trader, equipment owner, broker).
- **Language-first:** Hindi/Marathi-first UX; vernacular labels throughout; designed for semi-literate users (large tap targets, audio readouts, icon-heavy navigation).
- **Scale:** 24 feature modules + 6 persona home dashboards + full onboarding flow.
- **Design language:** Light theme (background `#F5F7FA`, cards `#FFFFFF`, primary green `#43A047`, accent `#E8F5E9`); glassmorphic cards; Mukta font (Devanagari); heavy micro-animations (staggered fades, pulsing beacons, shimmering badges).
- **Architecture note:** The prototype is a single `MaterialApp` with a state-machine router (`AppState.currentRoute` + `AnimatedSwitcher`, no Navigator routes). All data is mock/demo; there is no HTTP client, database, or backend yet — persistence is limited to 5 `shared_preferences` keys.

---

## 2. Onboarding Flow

State machine: `splash → language → profileSelect → auth/register → map → dashboard`.

| Step | Screen | Features |
|---|---|---|
| 1 | Splash (2-phase) | Phase 1: parent company ("DDS") logo elastic pop-up (~750 ms, tap to skip). Phase 2: AGROVERCITY brand reveal with gradient shader title and "Get Started" CTA; auto-advances after ~1.8 s. |
| 2 | Language selection | Step 1 of 3. GPS-detected region suggestion (e.g. Nashik → Marathi first, Hindi second) **[planned: reverse-geocoding]**; full regional-language grid grouped by Indian region; per-language audio preview button ("Namaste, Kisan Setu mein aapka swagat hai"); manual override always available. |
| 3 | Profile selection | Step 2 of 4. 2-column grid of the 6 persona cards (icon, Hindi label, English subtitle, tagline); **multi-select with one starred "primary" profile**; ≥1 selection enforced; staggered fade-in animation. |
| 4 | Auth / Register | Segmented Login ↔ Register switcher; language dropdown, women-mode toggle, Kisan Mitra help popup in the top bar. |
| 5 | Farm map marker | Step 3 of 3. Farm geofencing: simulated satellite canvas, 4 draggable corner pins (lat/lng), polygon area calculation (acres/hectares), soil-moisture layer toggle, soil type + khasra number display, "locate via GPS" + "confirm farm" actions. |

### 2.1 Login
- Mobile number + 4-digit MPIN.
- Forgot-MPIN flow (bottom sheet): mobile → OTP → set new MPIN twice with live match indicator.
- Quick demo logins in prototype (remove in production).
- **[planned]** Biometric login; phone + OTP login.

### 2.2 Registration wizard (3 steps)
1. **Identity & contact:** full name, state dropdown (MH/MP/GJ/UP/Punjab/Rajasthan), mobile + OTP send/verify with 30 s resend countdown and 1-tap autofill.
2. **Security:** set 4-digit MPIN twice, live match/mismatch indicator.
3. **Farm details:** village/tehsil, land-area slider (0.5–25 acres), soil-type chips (Black Cotton / Red / Sandy / Alluvial), irrigation chips (Drip / Sprinkler / Canal / Borewell / Rainfed), crop multi-select (9 common crops) + custom crop adder with specialty suggestions (dragon fruit, strawberry…).

### 2.3 Region-wise crop suggestions **[planned, partially mocked]**
- During farm setup, suggest crops by district using agro-climatic zone data (ICRISAT / State Agri Dept).
- Example mapping in prototype: Nashik → Tomato/Onion/Grape/Wheat; Nagpur → Orange/Cotton/Soybean; Ludhiana → Wheat/Rice/Potato; etc. (8 districts mapped).
- Smart defaults pre-select top 2–3; seasonal awareness (Kharif vs Rabi priority); voice-guided setup.

---

## 3. Multi-Profile System (Personas)

Six roles; one account can link multiple roles; exactly one is active at a time.

| # | Persona | Hindi label | Color | Default home | Focus |
|---|---|---|---|---|---|
| 1 | Farmer | किसान | Green `#43A047` | Farmer home | Crop mgmt, mandi, advisory — **super-user, access to ALL modules** |
| 2 | Farm Landlord | खेत मालिक | Purple `#8B5CF6` | Landlord home | Land lease, 7/12 records, rent tracking |
| 3 | Transporter | परिवहन | Blue `#0284C7` | Transport home | Vehicle booking, trips, freight |
| 4 | Seller / Vyapari | व्यापारी | Orange `#EA580C` | Seller home | Mandi buy-sell, stock ledger, procurement |
| 5 | Equipment Owner | यंत्र किराया | Amber `#F59E0B` | Equipment home | Tractor/harvester rentals, fleet |
| 6 | Broker / Dalal | दलाल | Teal `#14B8A6` | Broker home | Deal mediation, commission ledger |

### 3.1 Profile management rules
- Link/unlink profiles from a bottom sheet; **minimum 1 linked profile enforced**; already-linked entries shown greyed with check.
- Switching: instant (<200 ms), changes active profile + default home route, Hindi toast confirmation, no re-auth; tools grid re-filters immediately.
- Active-profile capsule in the dashboard header opens the profile switcher sheet; quick-switch chip row embedded in each dashboard.

### 3.2 Route access control matrix
Enforced at navigation guard + UI filtering (inaccessible modules fully hidden).

| Module route | Farmer | Landlord | Transporter | Seller | Equip. Owner | Broker |
|---|---|---|---|---|---|---|
| home (farmer dashboard) | ✅ | — | — | — | — | — |
| mandi | ✅ | — | — | ✅ | — | ✅ |
| marketplace | ✅ | ✅ | ✅ | ✅ | — | — |
| buyers | ✅ | — | — | ✅ | — | ✅ |
| advisory | ✅ | — | — | — | — | — |
| profitLoss | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| water | ✅ | — | — | — | — | — |
| schemes | ✅ | ✅ | — | — | — | — |
| finance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| womenFarmer | ✅ | — | — | — | — | — |
| fpo | ✅ | — | — | — | — | — |
| equipment | ✅ | — | — | — | ✅ | — |
| landLegal | ✅ | ✅ | — | — | — | — |
| climate | ✅ | — | — | — | — | — |
| postHarvest | ✅ | — | ✅ | ✅ | — | — |
| treePlantation | ✅ | ✅ | — | ✅ | — | — |
| liveChannels | ✅ | — | ✅ | — | ✅ | ✅ |
| agriNews | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| livestockDairy | ✅ | — | — | ✅ | — | — |
| farmDiary | ✅ | ✅ | — | — | — | — |
| referEarn | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| krishiRatna | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| gyanHub | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| cropInsurance | ✅ | ✅ | — | — | — | — |

### 3.3 Persona home dashboards
Shared template: gradient persona banner + switch button, 3 metric pills, profile-switcher bar, 4 quick-action cards to allowed modules, live activity list.

- **Landlord** (route `landlordHome`): metrics (18.5 acres, 3 tenants, ₹42k/month); actions: 7/12 records, govt schemes, rent P&L, marketplace; active lease list (plot, tenant, rent, verified status).
- **Transporter** (route `transportHome`): metrics (4 vehicles, 6 trips today, ₹28.5k daily freight); actions: post-harvest logistics, marketplace orders, vehicle loan, Gyan Hub (e-way bill/RTO rules); live trips list (vehicle no., route farm→mandi, fare, status).
- **Seller** (route `sellerHome`): metrics (₹1.45L turnover, 280 q stock, 14 buyers); actions: live mandi rates, buyer directory, P&L ledger, marketplace; procurement ledger with rates & trends.
- **Equipment Owner** (route `equipmentOwnerHome`): metrics (6 machines, 8 booked hrs, ₹52k weekly income); actions: equipment slot hub, machinery loan/EMI, profit & maintenance, Krishi Ratna AI; fleet status list (booking/fare/status per machine).
- **Broker** (route `brokerHome`): metrics (12 active deals, 38 farmer leads, ₹34,800 commission); actions: buyer directory, mandi trends, commission/P&L, finance/credit; deal pipeline list with commission + status.

### 3.4 Women-mode overlay
- Global toggle (rose theme `#BE123C`); not a profile type. Opens the Women Farmer hub features.

---

## 4. Farmer Home Dashboard

1. Hero header: greeting + farmer name/village/land area, "LIVE APMC" beacon, spinning vinyl emblem, chat + notification icons, active-role capsule, search bar with mic (voice assistant).
2. Horizontal profile-switcher chips for linked roles + "add role" chip.
3. Weather strip: temperature, rain probability, "Rain Radar" pulsing badge.
4. **Our Services** 4-card grid: Transportation, Market Price, Chat (Kisan Mitra), Agricultural Loan — each with live badge.
5. **Special Modules** 7-tile grid: Crop Insurance (PMFBY), Tree Plantation, Live Channels, Livestock & Dairy, Farm Diary, Agri News, Gyan Hub.
6. Hot-offer banner ("50% OFF first grab services & seeds") → marketplace.
7. **"Aaj ke Bhav" live vyapari-rate widget** — animated equalizer waveform; per-crop trader rate with up/down/flat change vs yesterday, mandi name, "N vyapari updated" count; offline shows cached rates with timestamp; tap → mandi screen. **[planned data source: vyapari partner portal + Agmarknet/eNAM fallback, refresh every 2 h between 6 AM–8 PM, filtered to farmer's profile crops]**
8. **Today's Action** urgent task card (e.g. Mancozeb spray 6–9 AM); marking done awards +50 AgriCoins.
9. Refer & Earn banner (+100 coins/friend, free soil test).

---

## 5. Feature Modules (24)

### 5.1 Mandi Prices (route `mandi`)
- Live mandi price cards: mandi name, distance, updated time, commodity/variety, modal/min/max price, MSP, arrivals (quintals), trend % (up/down).
- Crop filter chips (all / tomato / onion / wheat).
- Audio readout per card.
- **Smart Mandi Selection calculator:** produce-quantity slider comparing nearby mandis (e.g. Pimpalgaon vs Nashik APMC) on **net profit after transport cost**.

### 5.2 AI Advisory (route `advisory`) — 5 tabs
1. **Market Saturation (demand forecasting):** farmer states sowing intent → anonymized nearby sowing counts (5–20 km radius), expected mandi arrival spike, 3-month price risk meter (green/yellow/red), predicted price, AI alternative-crop recommendation (2–3 options), chatbot handoff. Privacy: opt-in data sharing, counts only.
2. **Leaf Disease Scan:** camera viewfinder; results with disease name, crop, pathogen, confidence %, symptoms, chemical + organic treatment, dosage, estimated cost.
3. **NPK Soil Calculator:** N/P/K sliders (kg/ha) with recommendations.
4. **5 km Pest Radar:** nearby outbreak alerts with risk levels.
5. **Kisan Mitra chatbot launcher.**

### 5.3 Marketplace (route `marketplace`)
- Agri-input e-commerce: search bar with mic; 5 categories (Seeds, Vehicles, Fertilizer, Pesticide, Tools).
- Product cards: vernacular title, brand, dealer, distance, batch no., rating + reviews, MRP/discounted price, delivery time, BNPL availability.
- **QR authenticity certificate dialog** (Agmark / Ministry certified) with add-to-cart.
- Cart bar: item count, total, 0% BNPL, confirm order.

### 5.4 Buyers & Contracts (route `buyers`) — 2 tabs
1. **Pre-sowing price-lock contracts:** buyer company + rating, crop, locked rate/quintal, premium above MSP, min quantity, delivery location, payment terms, duration; terms dialog; **E-sign digital acceptance**.
2. **Agri vehicle booking:** vehicle dropdown (Tata Ace / Bolero Maxi / tractor trolley) with base + per-km rates, distance slider, live fare estimate, book button.

### 5.5 Profit & Loss / Farm CEO (route `profitLoss`)
- 3 KPI cards: gross income, production cost, net profit.
- Crop selector pills; per-crop statement (yield, sale rate, net profit, itemized expense breakdown by category).
- Add-expense dialog.
- **Pre-sowing break-even calculator:** cost & yield sliders → minimum safe price/quintal.

### 5.6 Water Intelligence (route `water`)
- Plot-wise irrigation schedule (soil moisture %, recommended 90-min drip, 1-tap drip timer).
- CGWB groundwater gauge (depth in m, safe zone indicator).
- Canal rotation schedule (canal name + next date).
- **PMKSY 55% drip-subsidy calculator:** acreage slider → total cost, subsidy, farmer share.

### 5.7 Government Schemes (route `schemes`)
- Scheme cards: category, name, benefit amount, description, eligibility flag, status, next deadline, documents required.
- **Dual apply paths:** "Apply via App" (in-app flow) or "Official Portal →" (deep-link to portal: PM-KISAN, PMFBY, Soil Health Card, PM-KUSUM, eNAM…). **[planned: Chrome Custom Tabs/WebView with security banner, JS-bridge auto-fill, session-cookie clearing, never cache Aadhaar]**
- **Encrypted document vault:** Aadhaar, 7/12, bank passbook, soil health card — "AES-256" badging; attach vault docs to scheme applications.

### 5.8 Finance (route `finance`)
- **Kisan credit score card:** score (e.g. 785), tier, credit limit, RBI-compliance note.
- **Instant input-loan calculator:** amount slider (₹5k–50k), tenure (3–12 months), interest (7%), live EMI.
- Digital Kisan Credit Card visual (bank, card no., limit).

### 5.9 Crop Insurance (PMFBY/RWBCIS) (route `cropInsurance`) — 4 tabs
1. **Policies:** digital policy passbook cards (policy no., scheme, crop, season/year, sum insured, farmer premium share vs govt subsidy, insurer, validity, linked bank/KCC account); e-certificate PDF download; quick-apply for new crop coverage; PMFBY portal launcher.
2. **72-hour Claim Intimation:** policy/crop selection, calamity reason grid, date of loss, crop-stage dropdown (sowing→post-harvest), estimated loss % slider, geo-tagged photo capture, submit → claim number generated (`CLM-YYYY-ST-####`), jumps to tracker; emergency claim banner + helpline.
3. **Premium Calculator:** season switcher (Kharif/Rabi/Annual), crop dropdown, acreage slider → live sum insured, farmer premium, govt share, cutoff date; "issue policy on PMFBY portal".
4. **Claim Tracker:** multi-stage timeline (intimation → surveyor assigned → field assessed → DBT approved → disbursed / rejected) with surveyor contact box and DBT transaction id.

### 5.10 Land & Legal — 7/12 Records (route `landLegal`)
- Search by **Gat number** (गट क्रमांक, alphanumeric 1–20 chars) or **village name** (min 3 chars, fuzzy); district auto-detect with override.
- 7/12 vs 8A record-type toggle; multi-match disambiguation list.
- Record cards: owner, khata/ferfar no., area (Ha + acres), land class, soil, irrigation, crop history.
- PDF view/zoom/download/share; **Auto-Store Area** into farm profile & P&L; offline vault storage.
- **[planned integrations: mahabhulekh.maharashtra.gov.in / Aaple Sarkar APIs; extensible to Gujarat 7/12, Karnataka RTC, UP Khatauni]**

### 5.11 FPO Engine (route `fpo`)
- FPO banner (name, member count).
- **Bulk procurement pool:** group-buy listing (e.g. nano urea, 380/500 booked, 18% discount, progress bar, join with N units).
- **Shared machinery calendar:** bookable machines (tractor ₹650/hr, combine, drone sprayer ₹350/acre) with availability.

### 5.12 Women Farmer Hub (route `womenFarmer`) — 4 tabs
1. **SHG savings group:** member count, corpus, loan fund, monthly deposit action.
2. **Kitchen garden planner:** nutrition-focused vegetable list with growth stage.
3. **Livestock health:** milk yield, egg count, vaccination dates.
4. **Home enterprise income:** pickle/papad/A2 ghee monthly profit lines + total.

### 5.13 Climate & Carbon (route `climate`)
- Hero card: annual carbon income potential (₹9,200/yr), CO2e sequestered (4.6 MT) via biochar/zero-till/green manure.
- Climate-resilient variety list (heat-tolerant bajra, flood-tolerant Swarna Sub-1 rice).

### 5.14 Post-Harvest (route `postHarvest`)
- **Cold storage cards:** name, distance, temperature range, available capacity (MT), rate (₹/q/month).
- **AI quality grading card:** AGMARK grade, uniformity %, shelf life, recommended price.

### 5.15 Krishi Ratna — Gamification (route `krishiRatna`)
- Level banner (level, title e.g. "Krishi Daksh", coin balance, streak days, XP to next level).
- **Rewards store:** redeem AgriCoins for vouchers (₹200 IFFCO voucher = 300 coins, free soil test = 500, 1-on-1 scientist video call = 800).
- Coins earned across the app (+50 urgent task, +15 diary entry, +50 equipment booking, +25 expert-talk registration, +100/referral).

### 5.16 Refer & Earn (route `referEarn`)
- Personal referral code (e.g. `RAMSINGH2026`) with copy-to-clipboard + WhatsApp share.
- Invite-friend dialog (name + phone → +100 coins).
- Milestone rewards: 1/5/10 referrals → coins, free soil test, ₹500 equipment discount.
- Referred-farmers list with status (Joined/Verified/Active) and coins earned.

### 5.17 Farm Diary (route `farmDiary`)
- Financial summary card (income / expense / net, entry count, PDF report).
- Add-entry dialog: type (expense / income / activity), category (fertilizer, seeds, spraying, labor, irrigation, mandi sale, dairy sale…), amount, crop, notes; +15 coins per entry.
- Filter pills + timeline list with delete.

### 5.18 Agri News (route `agriNews`)
- Breaking-news red banner with audio readout.
- Category filter pills (market policy, weather alert, govt subsidy, agri tech).
- News cards: category, impact rating, source, timestamp, summary, audio button.
- Detail bottom sheet: full content + share-to-WhatsApp.

### 5.19 Live Channels (route `liveChannels`)
- Live video player (LIVE badge, viewer count, play/pause, HD/fullscreen).
- Channel info: speaker, broadcaster, schedule.
- **Live chat box** with send.
- Channel list: DD Kisan, KVK, live mandi auctions, state agri TV.

### 5.20 Livestock & Dairy (route `livestockDairy`) — 4 tabs
1. **Gaushala:** trust, district, cow count, breeds, facilities, rating; contact + book cow-dung manure / slurry dialog with priced options; cow-adoption flag.
2. **Nursery:** govt-certified badge, saplings list, price range, call for availability.
3. **Dr. for Cow (vet):** 24×7 emergency helpline bar; doctor cards (qualification, specialization, clinic, next slot, fee); booking dialog (farm visit vs clinic, slot dropdown, consultation fee).
4. **Dairy marketplace:** A2 ghee/milk/paneer/butter with purity certification, rating, direct buy.

### 5.21 Gyan Hub — Knowledge (route `gyanHub`) — 4 tabs
1. **Paid workshops:** ICAR-certified badge, instructor/institution, seats filled/total, fee with AgriCoins discount; detail sheet (batch date, syllabus modules, deliverables, certificate); enroll with coin redemption.
2. **Expert talks:** live badge, registered-farmer count, register (+25 coins), "ask the scientist" question dialog.
3. **Video tutorials:** thumbnail, duration, views, player modal with key takeaways.
4. **Agronomy blogs:** bookmark toggle, read time, likes, audio readout.

### 5.22 Tree Plantation & Biofuel (route `treePlantation`) — 4 tabs
1. **Articles:** category, read time, detail sheet (benefits + full content + request-saplings CTA).
2. **NGOs:** rating, trees planted, services chips, free-saplings badge, call + request-saplings dialog (tree type: timber/biofuel/fruit/bamboo + count).
3. **Biofuel/fuel trees:** oil content %, expected return/acre, gestation period, soil suitability, subsidy scheme, buyer market.
4. **Care guides:** step cards (watering rule, fertilizer schedule, pest protection).

### 5.23 Equipment Rental (route `equipment`) — Time-slot Yantra Booking
- Weekly calendar with 4 default 4-hour slots/day (6–10, 10–2, 2–6, 6–10; owner-configurable).
- Slot status: available / booked / pending; per-slot pricing (e.g. ₹800/4 h tractor); recommended task per slot.
- Rules: **max 2 slots/farmer/day**, cancel up to 2 h before (SMS to owner), auto-confirm for FPO-owned machines vs manual for private, push+SMS reminder 30 min prior, **waitlist** when full.
- Booking awards +50 coins.

### 5.24 (Cross-module) All Tools launcher
- Blurred bottom-sheet 3-column grid of all modules, filtered by active-profile access; active route highlighted.

---

## 6. Kisan Mitra — AI Voice & Chat Assistant

Three UI surfaces, FAB available on every screen:

1. **KisanMitraFab:** floating orb (breathing pulse, rotating halo, online beacon); first tap opens intro card ("Kisan Mitra AI • 24×7 Assistant") with "start chat" CTA.
2. **VoiceAssistantSheet** (branded "Bhashini AI"): pulsing mic orb (tap to toggle listening), "You said" transcript box, AI reply box with speaker icon, 5 quick-prompt chips (mandi bhav, weather/spray advice, PM-Kisan installment, disease remedy, tractor rent).
3. **KisanMitraChatbotSheet:** full chat (message bubbles, voice-mic toggle, quick-reply chips), rich cards (market saturation card with sowing count / arrival increase / risk meter / predicted price / alternative crop; weather, mandi, pest card types), **human expert handoff banner** → sends chat history + farm data to an agronomist for WhatsApp/voice call.

**[planned backend]** OpenRouter API with fine-tuned agri prompts; 24 h session context memory; offline message queue; Sarvam AI speech-to-text (15+ dialects); mid-chat language switching; 20sp bot text with audio playback per response.

---

## 7. Cross-Cutting Capabilities

- **Auth:** mobile + OTP, mobile + 4-digit MPIN (set/confirm/reset via OTP), biometric **[planned]**. Phones normalized to `+91`.
- **i18n:** 7 languages declared (hi, mr, gu, pa, te, ta, en); hi/mr/en have real string tables; **[planned: 15+ languages]**. Regional language mapping: North (Punjabi/Hindi/Haryanvi), Central (Hindi/Bhojpuri/Bundelkhandi), West (Marathi/Gujarati/Rajasthani), East (Bengali/Odia/Maithili), NE (Assamese/Bengali), South (Tamil/Malayalam/Kannada/Telugu).
- **Offline-first intent:** offline/sync status pill + sync-queue counter; cached rates with timestamps; **[backend should support idempotent queued writes for diary, claims, bookings]**.
- **AgriCoins economy:** earn via tasks/diary/bookings/referrals; spend in rewards store & workshop discounts.
- **Audio readouts ("सुनिए"):** TTS-simulation buttons across nearly every screen; news items carry pre-written `audioText` scripts — plan real TTS integration.
- **Video/live streaming:** video_player dependency present; all URLs are placeholders — plan HLS streams for channels and hosted videos for tutorials.
- **Accessibility:** 48×48dp min tap targets, WCAG 2.1 AA contrast, sunlight-optimized light palette, high-contrast mode flag, respects prefers-reduced-motion.
- **Navigation shell:** animated glass background, luxury top bar (back, brand, village, spray-alert capsule, coins pill, logout), floating dock opening All Tools sheet, back-stack history.

---

## 8. Data Entities (backend payload reference)

Defined in `lib/models/app_models.dart` — 30 entities:

| Entity | Key fields |
|---|---|
| FarmerProfile | id, name, vernacularName, phone, village, tehsil, district, state, landAreaAcres, soilType, irrigationType, kisanCreditScore, creditTier, krishiRatnaLevel, krishiRatnaTitle, streakDays, agriCoins, bankName, kccLimit, activeCrops[], farmBoundaryPoints[{lat,lng}] |
| CropPandL | id, name, season, area, yieldQuintals, marketAvgRate, grossRevenue, totalExpenses, netProfit, roiPercent, expensesBreakdown[{category, amount}] |
| MandiPrice | id, mandiName, distanceKm, commodity, variety, minPrice, maxPrice, modalPrice, msp, trend, changePercent, arrivalsQuintals, updatedAt |
| VyapariRate | id, crop, rateDisplay, priceChange, changeDir, mandiName, vyapariCount, lastUpdated |
| PestDisease | id, diseaseName, crop, pathogen, confidence, symptoms, chemicalTreatment, organicTreatment, dosage, estimatedCost |
| InputProduct | id, title, vernacularTitle, category, brand, rating, reviewsCount, dealerName, distanceKm, mrp, discountedPrice, bnplAvailable, batchNo, quantity |
| BuyerContract | id, buyerCompany, buyerRating, crop, lockedRateQuintal, mspCurrentRate, premiumAboveMSP, minQuantityQuintals, deliveryLocation, paymentTerms, status, contractDuration |
| GovtScheme | id, name, category, eligible, benefitAmount, documentsRequired[], status, nextDeadline, description |
| BlogArticle | id, title, vernacularTitle, author, authorRole, readTimeMinutes, category, summary, content, publishedDate, likesCount, isBookmarked |
| VideoGuide | id, title, vernacularTitle, instructor, duration, views, category, videoUrl, summary, keyPoints[] |
| ExpertTalk | id, expertName, institution, topic, vernacularTopic, scheduledTime, isLive, registeredCount, expertAvatar, description |
| KisanMitraMessage | id, sender (bot/user), text, timestamp, quickReplies[], richCardType (saturation/weather/mandi/pest), richCardData{} |
| YantraSlot | id, equipmentId, slotName, duration, status (available/booked/pending), bookedByName, priceRupees, recommendedTask |
| LandRecord712 | gatNumber, village, district, ownerName, khataNumber, totalAreaHectares, totalAreaAcres, landClass, ferfarNumber, cropHistory |
| TreeArticle | id, title, vernacularTitle, category, author, readTime, summary, fullContent, benefits, publishedDate |
| NgoOrganization | id, name, vernacularName, focusArea, location, contactPhone, email, treesPlantedCount, rating, servicesOffered[], providesFreeSaplings, websiteUrl |
| BiofuelTree | id, name, botanicalName, vernacularName, oilContentPercent, gestationPeriod, expectedReturnPerAcre, suitability, uses, buyerMarket, subsidyScheme |
| TreeCareGuide | id, title, vernacularTitle, stepNumber, stage, instructions, wateringRule, fertilizerSchedule, pestProtection |
| AgriLiveChannel | id, channelName, vernacularName, broadcaster, programTitle, vernacularProgram, currentSpeaker, liveViewersCount, isLiveNow, category, streamThumbnail, streamUrl, scheduleTime |
| AgriNewsItem | id, title, vernacularTitle, category, source, timestamp, summary, content, isBreaking, audioText, impactRating |
| GaushalaItem | id, name, vernacularName, trustName, address, district, distanceKm, cowCount, breeds[], phone, providesOrganicManure, offersCowAdoption, rating, facilities |
| PlantNursery | id, name, vernacularName, ownerName, location, distanceKm, phone, rating, isGovtCertified, availableSaplings[], priceRange |
| VetDoctor | id, name, qualification, specialization, clinicAddress, distanceKm, phone, experienceYears, consultationFeeRupees, rating, availableForFarmVisit, nextAvailableSlot |
| DairyProductItem | id, title, vernacularTitle, farmName, category, price, rating, unit, reviewsCount, purityCertification, inStock, description |
| PaidWorkshop | id, title, vernacularTitle, instructor, instructorRole, institution, feeRupees, coinsDiscountAllowed, duration, batchDate, timing, rating, enrolledCount, totalSeats, isCertified, certificateTitle, syllabusModules[], deliverables[], isEnrolled |
| FarmDiaryEntry | id, title, category, type (expense/income/farmActivity), amount, date, cropName, notes |
| ReferralUser | id, farmerName, village, phone, joinDate, status (Joined/Verified/Active), rewardCoins |
| CropInsurancePolicy | id, policyNumber, schemeName, vernacularSchemeName, cropName, vernacularCropName, season, year, landAreaAcres, sumInsured, farmerPremium, govtSubsidy, status, insuranceCompany, coverageStartDate, coverageEndDate, bankName, kccAccountNo, certificateUrl |
| InsuranceClaimRecord | id, claimNumber, policyId, cropName, vernacularCropName, calamityType, dateOfDamage, estimatedLossPercent, requestedAmount, approvedAmount, status (intimated→surveyorAssigned→fieldAssessed→dbtApproved→disbursed/rejected), statusText, surveyorName, surveyorPhone, surveyorVisitDate, gpsCoordinates, village, damagePhotos[], submittedAt, dbtTransactionId, bankAccountLast4 |
| CropPremiumRate | id, cropName, vernacularCropName, category, season, sumInsuredPerAcre, farmerSharePercent, totalActuarialRatePercent, cutoffDate |

---

## 9. Approved Change Requests (CRD v1.1, 27 Aug 2026)

11 approved changes with a 5-sprint roadmap (weeks 1–10):

1. **Font update** — Mukta primary (Baloo 2 headings, Hind body); 15+ language support; keep type scale 28sp→12sp; test on Android 6+/2 GB devices.
2. **Two-step splash** — Group logo (2 s) → 300 ms cross-fade → Kisan Setu logo + tagline "Aapki Zameen, Aapka Business Aapka Control"; ~4.5 s total; logos bundled locally.
3. **Light theme migration** — palette above; replaces earth-brown; full component audit; WCAG AA.
4. **Region-wise language selection** — GPS → reverse-geocode → top-2 regional languages, then full list; audio preview per language.
5. **Region-wise crop suggestions** — district crop mapping, smart defaults, seasonal priority.
6. **Government scheme deep-linking** — hybrid apply (in-app or official portal via Custom Tabs/WebView); portal mapping (PM-KISAN, PMFBY, SHC, KCC, eNAM); vault attachment; security rules.
7. **Live vyapari rate widget** — "Aaj ke Bhav" dashboard card; vyapari portal + Agmarknet/eNAM fallback; 2 h refresh 6 AM–8 PM; crop-filtered; offline cache.
8. **Kisan Mitra chatbot** — see §6.
9. **Market saturation advisory** — see §5.2.
10. **Time-slot yantra booking** — see §5.23.
11. **7/12 search by Gat/village** — see §5.10.

**Roadmap:** Sprint 1 (wk 1–2) changes 1–3 · Sprint 2 (wk 3–4) 4–5 · Sprint 3 (wk 5–7) 6+8 · Sprint 4 (wk 6–8) 7+9 · Sprint 5 (wk 8–10) 10+11.

## 10. Product Roadmap (PBR phases)

- **Phase 1 (done in prototype):** multi-profile system — registry, onboarding selection, switching, access control, persona home stubs, local persistence.
- **Phase 2:** backend profile sync, rich persona dashboards with real data, profile unlinking, persona-specific notifications.
- **Phase 3 (monetization):** seller analytics, broker CRM, transporter fleet management, broker commission payments, persona marketplace listings.
- **Phase 4 (intelligence):** role-based AI advisory, per-persona demand forecasting, cross-persona recommendations (e.g. broker suggests transporter to farmer).
- **Phase 5:** team/organization accounts (cooperatives, FPO admin/member roles).

**Success metrics:** >15% of new users choose non-farmer profile; non-farmer onboarding completion 45%→60%+; avg 2 profile switches/week; module depth 2.3→3.0+; time to first relevant action <30 s.
