# AGROVERCITY (Kisan Setu) — Go-To-Market & Launch Plan

**Timeline:** Month 0 = Nov 2026 → Month 12 = Oct 2027 (rolling — start the week Phase 0 completes)
**Budget:** ₹1,00,000/month founder cash (M1–M3), then 80% of subscription revenue reinvested; fully revenue-funded from M4 onward
**Channels:** Google Ads + Meta (Facebook/Instagram/WhatsApp) only. No government reliance. No commissions.
**Pricing:** Free tier + flat **₹99/month per persona** (all 20 personas). On-platform paid advertising sold to users as second revenue stream.

---

## 1. Executive Summary

AGROVERCITY is a 20-persona Indian agriculture super-app (farmer at the center, 19 business counterparties orbiting). The launch strategy:

1. **Farmer = free magnet.** Core utility (mandi prices, advisory, diary) is free forever. Free farmers create the supply and liquidity that the paying personas come for.
2. **₹99/month per persona, everyone pays the same.** One price for all 20 personas — no confusion, UPI-friendly, defensible for price-sensitive India ("₹3.3/day for your entire business").
3. **B2B personas monetize from day 1** via paid ads we run (Google/Meta) + zero-cash founder-led WhatsApp/phone sales: vyapari, transporter, equipment owner, broker, dairy manager.
4. **On-platform advertising** (users paying us to boost listings/shops/loads/courses) opens at Month 4 once the audience is worth paying to reach.
5. **Growth = paid acquisition (₹12 CAC target) × 1.55 referral multiplier**, with YouTube Shorts/Reels + mandi-price SEO as the zero-cost compounding layer.

**Headline trajectory (planning targets, assumptions in §4):**

| Milestone | When |
|---|---|
| Revenue ≥ ad spend (profitable) | Month 1–2 |
| ₹5 lakh/month | Month 4 |
| ₹31 lakh/month | Month 6 |
| ₹1 crore/month | Month 8–9 |
| ₹2 crore/month | Month 11–12 |
| ₹20 crore/month | Month 20–24 (scale phase, §15) |

---

## 2. Revenue Model

### 2.1 Subscriptions — ₹99/month per persona

| Tier | Price | What you get |
|---|---|---|
| **Free** | ₹0 | Core utility per persona. Uses the free-tier limits already coded in `backend/app/services/billing.py` (e.g., landlord 1 plot/1 lease, seller 20 listings, transport 1 vehicle, dairy 25 members). Mandi prices, advisory, farm diary, browsing, referrals — free forever. |
| **Pro (per persona)** | **₹99/mo** | That persona's limits fully removed + pro features. Billed monthly via Razorpay UPI/AutoPay. Each persona subscribes separately — a vyapari who is also a landlord pays ₹99 twice. |

**Product work (Phase 0):** remap existing billing tiers (`backend/app/services/billing.py:15-64`, currently ₹299–₹24,999) to a flat ₹99 Pro plan per persona; build public pricing page + in-app upgrade screens; activate Razorpay live keys (`backend/app/services/payments.py` has dev fallbacks today); AutoPay/UPI mandate for frictionless renewal.

**Later lever (not at launch):** annual plan ₹999 (2 months free) — introduce at M6 once monthly renewals prove out.

### 2.2 On-platform advertising — users pay us (opens Month 4)

Users promote themselves to other users. Backend exists (`backend/app/routers/ads.py`); Phase 0 adds the self-serve UI + Razorpay checkout.

| Ad product | Price | Buyer |
|---|---|---|
| Sponsored listing (7 days) | ₹99 | Seller/vyapari, equipment owner, SHG products |
| Featured shop/profile (30 days) | ₹499 | Vyapari, instructor, vet |
| Boosted load / demand (per boost) | ₹49 | Transporter, direct buyer, FPO |
| Course/class promotion | ₹199 | Instructor |
| Marketplace banner (weekly) | ₹999 | Input brands, later regional brands |

Fill-rate assumptions: M4 ₹30k, M6 ₹1.5L, M9 ₹6L, M12 ₹20L per month (grows with MAU; ~1.5% of MAU advertisers paying avg ₹150).

### 2.3 What we deliberately do NOT monetize (per founder decision)

- **No transaction commission** — transport/equipment/broker take-rates stay off.
- **No government schemes/DBT dependency.**
- **No Google/social paid ads as a revenue line** — those are our acquisition cost, not income.

---

## 3. The 20 Personas — Launch Waves

All 20 personas ship in product, but marketing attacks them in waves (you cannot sell 20 stories at once on ₹1L/month):

| Wave | Personas | Role |
|---|---|---|
| **Wave 1 (M1)** | **farmer** (free magnet), **seller/vyapari**, **transporter**, **equipmentOwner** | Hero ads + hero landing pages. Vyapari/transporter/equipment pay ₹99. |
| **Wave 2 (M3–4)** | **broker**, **dairyManager**, **milkSeller** | Added to ads once Wave 1 CAC is proven; dairy suite is strong for Maharashtra |
| **Wave 3 (M5–6)** | **landlord**, **instructor**, **vet**, **womenShg**, **fpoManager**, **customer** | Content-led organic launch; instructor/vet/SHG are natural creators |
| **Wave 4 (M7+, scale phase)** | **directBuyer**, **exporter**, **gaushalaManager**, **bankManager**, **insuranceProvider**, **coldStorageProvider** | High-touch direct sales; these monetize at scale, not before |

---

## 4. Unit Economics & Assumptions (the honest math)

| Assumption | Value | Basis |
|---|---|---|
| Blended CAC (paid) per free signup | ₹12 | Rural India Meta CPC ₹0.5–2, landing conversion ~12% |
| Referral/organic multiplier | 1.55× | `referrals.py` + AgriCoins reward = free months (zero cash cost); WhatsApp share loops |
| Free → ₹99 paid conversion | **10% blended** | Farmer ~6–8%, vyapari/transporter/equipment/broker/dairy 15–20% (they earn through the app) |
| Paying churn | 5%/month | Mitigated by AutoPay + daily-utility lock-in (khata, rates) |
| ARPU (subscriptions) | ₹99 | Flat |
| Founder cash | ₹1L/month M1–M3, then 80% of revenue reinvested | Per founder directive |

**Per ₹1L of ad spend:** ~8,300 paid signups → ×1.55 = **~13,000 free users** → 10% = **~1,300 paying** → **~₹1.29L MRR created**. Subscriptions fund their own re-acquisition from the first cohort — that is the entire engine.

### Revenue trajectory (planning targets; rounded, 5% churn applied)

| Month | Ad budget (source) | Paying subs | Subs revenue | On-platform ads | **Total revenue** |
|---|---|---|---|---|---|
| M1 | ₹1.0L (cash) | ~1,300 | ₹1.3L | — | **₹1.3L** |
| M2 | ₹1.0L (cash) | ~2,600 | ₹2.6L | — | **₹2.6L** |
| M3 | ₹1.0L (cash) | ~3,900 | ₹3.9L | — | **₹3.9L** |
| M4 | ₹4.1L (₹1L + ₹3.1L rev) | ~9,000 | ₹8.9L | ₹0.3L | **₹9.2L** |
| M5 | ₹8.4L (rev-funded) | ~19,000 | ₹18.8L | ₹1.0L | **₹19.8L** |
| M6 | ₹17.2L (rev-funded) | ~31,000 | ₹30.7L | ₹1.5L | **₹32L** |
| M8–9 | ~₹55–90L | ~95,000 | ₹94L | ₹6L | **~₹1cr** |
| M12 | ~₹2.2cr | ~2,00,000 | ₹1.98cr | ₹20L | **~₹2.2cr** |

**Sensitivity:** every 1-point drop in free→paid (10%→9%) delays the ₹1cr crossing by ~5–6 weeks. This is why Months 1–3 obsess over activation and the ₹99 value story, not raw signups. If CAC drifts to ₹15, M6 revenue lands at ~₹26L instead of ₹32L — plan still holds.

---

## 5. Phase 0 — Month 0: Launch Checklist (3 weeks, pre-M1)

**Theme: make the machine sellable before buying a single click.**

### Week -3: Money plumbing
- [ ] Remap `backend/app/services/billing.py` tiers → flat ₹99 Pro per persona; keep free-tier limits; migration-safe for existing data
- [ ] Public **pricing page** (`/pricing`) + per-persona "Why ₹99" blocks; Razorpay live keys + webhook verification (`backend/app/services/payments.py`); UPI + AutoPay mandates; renewal dunning SMS/WhatsApp
- [ ] Free-tier audit per Wave 1–2 persona: generous enough to be useful daily, capped where a business hits the wall (listings, vehicles, members)

### Week -2: Conversion surfaces
- [ ] 4 hero **persona landing pages** (farmer, vyapari, transporter, equipment) — Marathi + Hindi, <3s load, WhatsApp-login first
- [ ] On-platform ads self-serve UI on top of `routers/ads.py` (create → pay ₹99/499 via Razorpay → live)
- [ ] Referral program config: referrer gets 1 free Pro month, referee gets 15 days Pro trial at ₹99 plan (reward = zero cash)
- [ ] Analytics: GA4 + Firebase + PostHog funnels (signup → activation → paywall view → purchase → renewal); UTM discipline for every campaign

### Week -1: Content & soft launch
- [ ] Creative pipeline live: AI image tool + video tool + CapCut template; brand kit (kisan green + white, Devanagari-friendly)
- [ ] **Content bank: 30 YouTube Shorts / Reels** queued (per prompt library §12)
- [ ] **B2B lead list: 300 vyapari/transporters/equipment owners** in Maharashtra (mandi directories, JustDial, district transport unions, dairy societies)
- [ ] Soft launch to 500 friendly users (village networks, family, existing testers); fix top-10 friction bugs; verify paywall → Razorpay → entitlement → invoice loop end-to-end
- [ ] Google Ads + Meta Business accounts, ₹1L loaded, campaigns built (paused)

**Exit criteria for Phase 0:** a stranger can land → signup in OTP+30s → hit paywall → pay ₹99 via UPI → get Pro, all while you watch it in the funnel dashboard. Only then does Month 1 start.

---

## 6. Marketing Engine — Google + Meta Structure (fixed for all 6 months)

### 6.1 Google Ads (40–50% of budget)

| Campaign | Type | Targeting | Landing | Budget share |
|---|---|---|---|---|
| G1 "Aaj ka Bhav" | Search | Hindi/Marathi keywords: मंडी भाव, आज के भाव, wheat/cotton/soybean price today + district modifiers | Free mandi page (soft paywall on saved alerts) | 15% |
| G2 "Business App" | Search | High-intent B2B: खाता ऐप, माल बुकिंग, ट्रैक्टर किराया, dairy collection software, mandi accounting | Persona landing page (Wave 1–2) | 15% |
| G3 "YouTube Bharat" | Video (skippable 30s + 15s cutdowns) | Interests: agriculture, farming, tractors, dairy; placements on krishi channels; Maharashtra 18–55 | Persona landing page | 50% |
| G4 "Remarketing" | Display/YT | All site visitors + video viewers 30d who didn't signup | Signup offer (15 days Pro free at ₹99 plan) | 10% |
| G5 "Play/Store + Brand" (M4+) | Search | "Agrovercity", "kisan app", competitor app names | Home | 10% |

Rules: exact/phrase match only (no broad until M4), negative keyword list (jobs, sarkari yojana, free laptop), dayparting 6am–10pm IST, district-level geo (Wave 1: Nashik, Pune, Ahmednagar, Jalgaon, Kolhapur, Aurangabad/Sambhajinagar).

### 6.2 Meta (50–60% of budget) — Facebook + Instagram + WhatsApp

| Campaign | Objective | Audience | Creative | Budget share |
|---|---|---|---|---|
| M1 "Farmer Free" | Landing page views → signup | Maharashtra rural 18–55; interests: agriculture, Krishi, mandi; Marathi + Hindi | Short/Reel of the day (farmer) | 25% |
| M2 "Vyapari Pro ₹99" | Leads (WhatsApp click-to-message) | Mandi towns; interests: trading, wholesale, kirana, agriculture business | Vyapari creative + caption bank §13 | 20% |
| M3 "Transporter/Equipment" | Leads + LPV | Transport/diesel/truck/tractor interests | Transporter + equipment creatives | 20% |
| M4 Boost winners | (from M2) | — | Top organic post of the week, ₹300/boost | 10% |
| M5 Retargeting (M3+) | Conversions | Site engagers, video viewers 75% | Testimonial/proof creative | 15% |
| M6 Lookalike (M4+) | Conversions | LAL 1–3% of payers + free signups | Winning M2/M3 creative | 10% |

**WhatsApp click-to-message is the literacy-safe funnel:** ad → WhatsApp chat with pre-filled "₹99 plan jaanna hai" → chatbot/founder replies with voice note + link. Rural India converts on voice, not forms.

### 6.3 Organic layer (zero cash — the compounding half)

- **1 Short + 1 Reel per day** per active wave (created in batch Sundays, prompt library §12)
- **Mandi-price SEO:** district × crop pages ("कापसाचे भाव नाशिक", "soybean rate Indore") auto-published from `routers/mandi.py` data — farmers search daily
- **WhatsApp virality:** every invoice, bilty, rate card, receipt gets "WhatsApp pe share karo" with referral deep-link; group-forward templates in §13
- **Referral program:** "5 kisan lao = 3 mahine Pro free" (coins + free months, zero cash), weekly leaderboard banner in-app
- **YouTube long-form (M3+):** 2×/month "₹99 mein business kaise chalaye" walkthroughs per Wave 1 persona

---

## 7. Months 1–6 — Detailed Plans

Each month: theme → targets → budget split → week-by-week with **day-by-day actions**. The **Daily Operating Rhythm** below applies every single day (all 6 months) unless a week table overrides it.

### DAILY OPERATING RHYTHM (default Mon–Sun)

| Time | Activity |
|---|---|
| 07:30 | Check dashboards (spend, CAC, signups, free→paid, renewals, churn) — 15 min, logged in KPI sheet §14 |
| 08:00 | Publish today's Short + Reel (from Sunday batch); reply to all comments from yesterday |
| 09:00–13:00 | **B2B outreach block:** 50 WhatsApp/calls to lead list (vyapari/transporter/equipment); log in CRM sheet; voice notes in Marathi |
| 13:00–14:00 | Community: post in 10 WhatsApp groups (value post, not spam — mandi tip of the day); reply to app-store reviews |
| 14:00–16:00 | Ads optimization per kill/scale rules §14; build tomorrow's ad variations |
| 16:00–17:00 | Referral check: top referrers thank-you message + leaderboard update |
| 17:00–18:00 | Content/CRO: 1 improvement to landing page, paywall, or onboarding (A/B one thing at a time) |
| Sun | Full-day batch: create 7 Shorts + 7 Reels (3h), write 5 ad variations (1h), weekly review + next-week plan (1h), CRM hygiene |

**Minimum team: 1 founder-operator + 1 content/ads person + 1 B2B outreach person (₹25–35k/month each, or founder + 2 interns).**

---

## 8. MONTH 1 — "₹99 mein poora business" (Nov 2026)

**Theme:** prove the funnel: stranger → ₹99 payer. Diwali timing = farmers/vyapari online, phone gifting, new-year resolutions for business.
**Targets:** 13k signups | 1,300 paying (₹1.3L) | CAC ≤ ₹12 | free→paid ≥ 9% (ramp)

**Budget ₹1L:** Google ₹40k (G1 12k, G2 12k, G3 16k) · Meta ₹60k (M1 15k, M2 15k, M3 15k, M4 boost 3k, M5 12k)

**Week 1 — Ignition (Diwali week)**
| Day | Specific actions (on top of daily rhythm) |
|---|---|
| Mon | Launch G1+G2 Search at 50% budget; WhatsApp status + 20 groups announcement; first Short: "Diwali gift — apne papa ko digital khata" |
| Tue | Launch Meta M1 farmer campaign; Diwali offer live: "₹99 plan pe 15 din extra free" (codes via `routers/coupons.py`) |
| Wed | B2B sprint: 100 vyapari contacted with Diwali greeting + demo voice note |
| Thu | YouTube G3 campaign on (16k); first landing-page A/B: headline "Free mandi bhav" vs "₹99 mein vyapar" |
| Fri | Kill/scale review #1: pause ad sets CAC > ₹20, scale < ₹10 |
| Sat | Diwali Bhaubeej post (womenShg teaser); referral push "parivaar ko jodo" |
| Sun | Batch content; review week 1 numbers vs targets; write 5 new ad variations |

**Week 2 — First payers**
| Day | Specific actions |
|---|---|
| Mon | Call every free user who hit paywall but didn't pay (from funnel dashboard) — 20 calls, script: "kya problem hua? UPI tha ya plan samajh nahi aaya?" |
| Tue | Publish first payer testimonial (record 30s voice note → subtitled video) |
| Wed | Transporter campaign M3 live; join 20 transport WhatsApp groups (value posts) |
| Thu | A/B paywall: monthly ₹99 vs "₹99 — roz ₹3.3" framing |
| Fri | Kill/scale review #2 |
| Sat | DairyManager teaser content (Wave 2 warm-up) |
| Sun | Batch + monthly ledger: CAC by campaign, best creative, signup→pay time |

**Week 3 — Referral ignition**
| Day | Specific actions |
|---|---|
| Mon | Referral leaderboard live in-app; push: "5 kisan lao, 3 mahine Pro free" |
| Tue | WhatsApp-share prompt added to every invoice/rate card (dev task from Phase 0 list — verify) |
| Wed | B2B sprint: 100 equipment owners (sugar belt: Kolhapur, Sangli) |
| Thu | Retargeting pool check — need 1k viewers before M5 starts |
| Fri | Kill/scale review #3 |
| Sat | Testimonial #2 (transporter); district expansion check: which district CAC lowest → double down |
| Sun | Batch + weekly review |

**Week 4 — Lock the playbook**
| Day | Specific actions |
|---|---|
| Mon | Move 20% budget to best campaign; draft M2 plan from data |
| Tue | First churn-saver calls: payers day-25 renewal reminder + help offer |
| Wed | Publish "Month 1 in numbers" internal memo: CAC, conversion, best persona |
| Thu | Google Search query report → add negatives, new exact keywords |
| Fri | Kill/scale review #4 |
| Sat | Farmer success story long-form (YouTube 3-min) |
| Sun | Batch + M1 retrospective: keep/kill creative list, M2 budget map |

**M1 AI creative prompts**
- Image: *"Photorealistic vertical 9:16 shot, golden hour: Indian trader (vyapari, 40s, white kurta, cotton tote) at a busy Maharashtra mandi, smiling at smartphone showing a clean green-and-white agri trading app with a ₹99/month badge, Hindi text overlay space top-third, warm Diwali lanterns bokeh, documentary style, no watermark"*
- Video (30s): *"Vertical 9:16 documentary style: Day-in-life of a Nashik onion trader — morning mandi chaos, paper khata getting soaked, cut to same man using the app: listing loads, 3 order notifications, evening UPI payment received. Marathi voiceover (warm male): '₹99. Ek din ka chai-se kam.' End card: logo + 'Abhi download karo'."*

**M1 captions (Hindi / Marathi / English)**
- HI: *"मंडी का खाता, माल की बिक्री, गाड़ी की बुकिंग — सब एक ऐप में। सिर्फ ₹99/महीना। पहले 15 दिन फ्री कोड: DIWALI99"*
- MR: *"मंडीचे खातं, विक्री, वाहन बुकिंग — सगळं एकाच ॲपमध्ये। फक्त ₹99/महिना। डाउनलोड करा आजच!"*
- EN (B2B): *"Mandi khata, sales, load booking — one app for your entire agri business. ₹99/month. Join 1,000+ traders."*

---

## 9. MONTH 2 — "Gaon gaon mein echo" (Dec 2026)

**Theme:** Rabi sowing (wheat/chana/mustard) — farmer utility content peaks; double down on what M1 proved; push free→paid from 9% → 11%.
**Targets:** 13k new signups (cum. 26k) | 2,600 paying (₹2.6L) | referral share ≥ 25% of signups | churn ≤ 5%

**Budget ₹1L:** Google ₹45k (G1 15k — crop price searches spike, G2 12k, G3 15k, G4 3k) · Meta ₹55k (M1 12k, M2 15k, M3 15k, M4 4k, M5 9k)

**Week 5 — Double down on winners**
| Day | Specific actions |
|---|---|
| Mon | Reallocate: top-3 M1 ad sets get 60% of budget; losing audiences killed |
| Tue | 3 new farmer creatives around rabi: "buwai ka kharcha" (sowing cost calculator hook) |
| Wed | B2B sprint: 100 vyapari (rest of Nashik + Pune belt); pitch shifts to "saison shuru — abhi listing daalo" |
| Thu | Mandi-SEO batch #1: 50 district×crop pages published & indexed request |
| Fri | Kill/scale review #5; renewal dunning test (SMS vs WhatsApp) |
| Sat | Customer testimonial #3 (equipment owner — sugar belt) |
| Sun | Batch + review |

**Week 6 — Retargeting engine on**
| Day | Specific actions |
|---|---|
| Mon | M5 retargeting live (15% Meta budget): "Aapne dekha, ab ₹99 mein shuru karo" |
| Tue | Onboarding fix sprint: activation metric = Day-1 mandi alert set + 1 listing/khata entry; anything blocking this is a P0 bug |
| Wed | B2B sprint: 100 transporters (return-load pitch) |
| Thu | WhatsApp group program: 50 groups now; daily 10:00 "aaj ke bhav" auto-share value post |
| Fri | Kill/scale review #6 |
| Sat | Short: "3 din mein 50 listing — vyapari ka sach" (real user footage, phone-shot) |
| Sun | Batch + weekly review |

**Week 7 — Referral rocket**
| Day | Specific actions |
|---|---|
| Mon | Referral push week: 2× coins; push notification + banner to all free users |
| Tue | "Gaon champion" pilot: 5 villages, pick 1 lead farmer, give free Pro 6 months for 50 referrals |
| Wed | B2B sprint: 100 dairy-adjacent (Wardha, Amravati — cotton belt milk societies) |
| Thu | Churn-saver v2: day-20 "kya dikkat?" call script for all payers |
| Fri | Kill/scale review #7 |
| Sat | Year-end post: "2026 ka hisaab — app mein, register mein nahi" (P&L feature demo from `routers/pnl.py`) |
| Sun | Batch + review |

**Week 8 — Conversion push**
| Day | Specific actions |
|---|---|
| Mon | Paywall experiment: show "₹3.3/day" + 15-day free unlock for stalled free users |
| Tue | Wave 2 warm-up: broker + dairyManager teaser ads (5% budget probe) |
| Wed | B2B sprint: 100 equipment owners (Vidarbha) |
| Thu | Query mining: Google search terms → 20 new exact keywords added |
| Fri | Kill/scale review #8 |
| Sat | Testimonial #4 (milkSeller pilot user) |
| Sun | Batch + **M2 retrospective**: referral share vs 25%, free→paid vs 11%, decide M3 budget map (₹1L cash + prep for M4 reinvestment) |

**M2 AI creative prompts**
- Image: *"Vertical 9:16 photorealistic: Maharashtra farmer in wheat field holding seed bag in one hand, phone in other showing rabi crop plan screen in a green agri app, morning fog, hopeful expression, space for Hindi headline top-third, brand colors kisan-green #1B7A3D + white, no text rendering in image"*
- Video (30s): *"Vertical 9:16: split-screen — left: farmer writing expenses in paper diary, pages fly in wind; right: same farmer tapping 'Farm Diary' in app, expense auto-added, P&L chart appears. Marathi voiceover (elderly female, warm): 'Buwai ka kharcha, bikri, hisaab — saglyancha hisaab ekdum saaf.' End: ₹99/month card."*

**M2 captions**
- HI: *"बुवाई का खर्चा, बिक्री, मंडी भाव — किसान डायरी अब फोन में। मुफ़्त शुरू करो, ₹99 में पूरा पावर।"*
- MR: *"पेरणीचा खर्च, विक्री, बाजारभाव — शेतकरी डायरी आता फोनमध्ये। आजच फुकट सुरू करा."*
- EN (B2B): *"Rabi season is your busiest quarter. Mandi khata + listings + load booking in one ₹99 app. 15 days free — code RABI26"*

---

## 10. MONTH 3 — "Proof & polish" (Jan 2027)

**Theme:** Makar Sankranti (Jan 14) + rabi care + harvest prep. Last month of ₹1L-only spend — M4 flips to revenue-funded. Goal: lock free→paid ≥ 10% and CAC ≤ ₹12 so the reinvestment machine starts strong.
**Targets:** 13k signups (cum. 39k) | 3,900 paying (₹3.9L) | D30 retention ≥ 35% | referral share ≥ 30%

**Budget ₹1L:** Google ₹50k (G1 15k, G2 12k, G3 15k, G4 5k, G5 brand test 3k) · Meta ₹50k (M1 10k, M2 14k, M3 14k, M4 4k, M5 8k)

**Week 9 — Sankranti wave**
| Day | Specific actions |
|---|---|
| Mon | Sankranti campaign live: "Naye saal, naya vyapar" — tilgul visual hook; 15-day-free codes SANKRANTI |
| Tue | YouTube: 2-min "₹99 mein pura dairy kaise chalaye" walkthrough (Wave 2 dairy teaser) |
| Wed | B2B sprint: 100 vyapari (harvest prep pitch — "mandi ready rakho") |
| Thu | SEO batch #2: 100 pages (harvest-season queries: "moong rate", "harvester booking near me") |
| Fri | Kill/scale review #9 |
| Sat | Community post: Sankranti kite-festival creative (regional pride) |
| Sun | Batch + review |

**Week 10 — Activation week**
| Day | Specific actions |
|---|---|
| Mon | Funnel audit: biggest drop step identified (expect: signup→activation); one big fix shipped |
| Tue | DairyManager + broker campaigns live (Wave 2, 10% budget) |
| Wed | B2B sprint: 100 brokers (commission-ledger pitch — they still earn 2%, we don't charge it... our pitch: "commission ka hisaab app khud rakhega") |
| Thu | WhatsApp Business broadcast lists: segmented (vyapari / farmer / transporter) value messages, 2/week cap (no spam) |
| Fri | Kill/scale review #10 |
| Sat | Testimonial #5 (dairyManager pilot) |
| Sun | Batch + review |

**Week 11 — Retention hardening**
| Day | Specific actions |
|---|---|
| Mon | AutoPay push: 1-tap UPI mandate onboarding for all payers (churn insurance) |
| Tue | Win-back script v1 for churned payers (offer: 1 month free on return) |
| Wed | B2B sprint: 100 milkSellers (door-to-door pitch: "bill book khatam, UPI invoice") |
| Thu | Referral leaderboard month-end: top 3 get featured shop for free (feeds the future ads product!) |
| Fri | Kill/scale review #11 |
| Sat | Long-form YouTube: farmer P&L story (year-in-review) |
| Sun | Batch + review |

**Week 12 — M4 launchpad**
| Day | Specific actions |
|---|---|
| Mon | M4 budget model final: expected ₹4.1L (₹1L cash + ~₹3.1L from 80% of M3 revenue) — pre-build campaigns, paused |
| Tue | On-platform ads product UAT: 10 friendly vyapari buy a ₹99 sponsored listing; verify end-to-end |
| Wed | B2B sprint: 100 mixed follow-ups (no-shows from M1–2 lists) |
| Thu | Lookalike seed prep: payer list ≥ 2,000 required — verify quality |
| Fri | Kill/scale review #12 |
| Sat | Case-study post: "3 mahine, 3,900 vyapari-kisan — aankde bolein" (proof post for M4 ads) |
| Sun | Batch + **M3 retrospective → M4 plan locked**: target ₹9.2L revenue |

**M3 AI creative prompts**
- Image: *"Vertical 9:16 photorealistic: Makar Sankranti morning — farmer on rooftop terrace with kites, holding phone showing mandi price alerts, marigold + sugarcane in frame, festive but authentic rural Maharashtra, warm sunrise light, headline space top-third, kisan-green brand accents"*
- Video (30s): *"Vertical 9:16: dairy collection center — manager weighing milk can, FAT/SNF chart on wall, cut to app showing auto rate-chart, member passbook, DBT batch '₹4.2 lakh paid to 68 members'. Marathi voiceover (confident male 30s): 'Dudh, paise, hisaab — sab digital. ₹99 mahina, poora dairy set.' End card: logo + Sankranti greeting."*

**M3 captions**
- HI: *"संक्रांति के नए साल में नया हिसाब। मंडी भाव, खाता, बिक्री, गाड़ी — ₹99/महीना में पूरा व्यापार डिजिटल।"*
- MR: *"संक्रांतीच्या शुभेच्छा! नवीन वर्षात नवीन हिशेब — भाव, खातं, विक्री, वाहन. फक्त ₹99 मध्ये संपूर्ण व्यवसाय डिजिटल."*
- EN (B2B): *"Harvest season won't wait. Mandi rates, khata, listings, load booking — one app, ₹99/month. 15 days free."*

---

## 11. MONTH 4 — "The machine feeds itself" (Feb 2027)

**Theme:** Rabi harvest begins (wheat/mustard/chana) — the app's busiest, most valuable season. Revenue flips to funding ads (₹4.1L budget). First renewal cohort hits — churn battle begins in earnest. On-platform ads open.
**Targets:** 53k signups (cum. 92k) | 9,000 paying (₹8.9L) | ads revenue ₹30k | **total ₹9.2L** | renewal rate ≥ 85% | lookalike campaigns live

**Budget ₹4.1L** (₹1L cash + ₹3.1L reinvested): Google ₹1.8L (G1 50k, G2 45k, G3 60k, G4 15k, G5 10k) · Meta ₹2.3L (M1 45k, M2 50k, M3 45k, M4 15k, M5 30k, M6 LAL 35k)

**Week 13 — Flip the switch**
| Day | Specific actions |
|---|---|
| Mon | Revenue-funded campaigns on: 100% budget live; hiring check — add 1 outreach person (funded by M3 revenue) |
| Tue | Lookalike M6 live: LAL 2% payers + 3% signups |
| Wed | B2B sprint: 150 (larger lists now — referral of existing payers: "apna commission agent bhai ko batao") |
| Thu | On-platform ads launch: in-app banner "Apni dukaan dikhao — ₹99 mein 7 din top pe"; first 20 sellers onboarded |
| Fri | Kill/scale review #13 (now weekly budget shifts up to ₹50k between campaigns) |
| Sat | Harvest creative wave: mandi-arrival rush videos |
| Sun | Batch + review |

**Week 14 — Renewal battle**
| Day | Specific actions |
|---|---|
| Mon | Renewal war-room: all M1 payers hit day-25–30; WhatsApp personal thank-you + AutoPay link; defector offer: pause instead of cancel |
| Tue | Harvest load campaign (transporter): "fasal uthane ki gadi abhi chahiye? 200 loads live" — liquidity pitch |
| Wed | B2B sprint: 150 equipment owners (harvester slots — the single hottest seasonal SKU) |
| Thu | Retargeting pool now huge: M5 30k budget; creative = payer testimonials montage |
| Fri | Kill/scale review #14 |
| Sat | First sponsored-listening case: "₹99 boost pe 3× calls aaye" — use as ads-product proof |
| Sun | Batch + review |

**Week 15 — Basant + liquidity**
| Day | Specific actions |
|---|---|
| Mon | Basant Panchami creative; Wave 3 landlord teaser (post-harvest leasing season starts) |
| Tue | Liquidity metric on dashboard: listings per district per persona — marketing pushes only liquid categories |
| Wed | B2B sprint: 150 dairy managers (summer milk peak prep) |
| Thu | SEO batch #3: 150 pages (harvest queries + "combine harvester rent <district>") |
| Fri | Kill/scale review #15 |
| Sat | Testimonial #6 (transporter harvest story) |
| Sun | Batch + review |

**Week 16 — Consolidate**
| Day | Specific actions |
|---|---|
| Mon | M5 budget model: expected ₹8.4L; pre-build paused campaigns |
| Tue | Win-back wave: all churned with "1 month free, wapas aao" |
| Wed | B2B sprint: 150 mixed |
| Thu | Ads product v1.1: featured shop ₹499 pushed to top 50 sellers by GMV... by listing volume |
| Fri | Kill/scale review #16 |
| Sat | Case-study: "Month 4: gaon-gaon mein Agrovercity" (numbers post) |
| Sun | Batch + **M4 retrospective**: renewal %, ads revenue vs ₹30k, LAL CAC vs ₹12 |

**M4 AI creative prompts**
- Image: *"Vertical 9:16 photorealistic: wheat harvest morning — combine harvester in golden field, farmer (30s, checked shirt) showing phone to another farmer, screen visible with load-booking map + 3 driver bids, dust + morning light, energetic, headline space top, kisan-green accents"*
- Video (30s): *"Vertical 9:16: mandi arrival rush — tractor trolleys queuing, trader opens app: 'aaj 14 trucks aa gaye', approves 6 loads with one tap, drivers get notifications. Voiceover Hindi energetic male: 'Fasal ki race mein 5 minute = 5 hazaar rupaye. ₹99 ka app, har season ka saathi.' End: on-screen 'Abhi karo'."*

**M4 captions**
- HI: *"कटाई शुरू, मंडी भरी। गाड़ी, भाव, खाता, भुगतान — ₹99 में सब। आज ही जुड़ें, फसल का फायदा न छूटे।"*
- MR: *"कापणी सुरू, मंडी भरली. वाहन, भाव, खातं, पैसे — ₹99 मध्ये सर्व. आजच सामील व्हा!"*
- EN (B2B): *"Harvest season = your money season. Trucks, rates, khata, payments — one ₹99 app. 2,000+ traders already on."*

---

## 12. MONTH 5 — "Gudi Padwa scale-up" (Mar 2027)

**Theme:** **Gudi Padwa (Maharashtra New Year, ~Mar 19)** — the single biggest Marathi marketing moment of the year. Plus Holi, FY-end (Mar 31: *"financial year ka hisaab, 1 ghante mein"* — the P&L pitch is gold), harvest peak.
**Targets:** 108k signups (cum. 2.0L) | 19,000 paying (₹18.8L) | ads ₹1L | **total ₹19.8L** | 2nd state GO decision

**Budget ₹8.4L:** Google ₹3.6L · Meta ₹4.8L. Wave 3 personas (landlord, instructor, vet, womenShg) get real budget for the first time (15%).

**Week 17 — Gudi Padwa blitz**
| Day | Specific actions |
|---|---|
| Mon | Gudi Padwa campaign live: "Naya saal, naya vyapar — Gudi Padwa offer: ₹99 pe 2 mahine Pro" |
| Tue | Marathi-first creative takeover: 70% Marathi / 30% Hindi split this fortnight |
| Wed | B2B sprint 200; pitch: "naya saal, naya hisaab" |
| Thu | YouTube: Gudi Padwa long-form — "2027 ka naya vyapar setup, 10 minute mein" |
| Fri | Kill/scale review #17 |
| Sat | Holi creative (consumer angle — SHG food products, customer persona teaser) |
| Sun | Batch + review |

**Week 18 — FY-end gold**
| Day | Specific actions |
|---|---|
| Mon | FY-end campaign: "31 March ka hisaab — P&L ready. CA ko app dikhao" (target: every payer opens P&L, share screenshot = free month) |
| Tue | Wave 3 push: landlord campaign live (post-harvest leasing: "fasal ke baad zameen se kamai") |
| Wed | B2B sprint 200 (FY-end = collection season, traders have cash + urgency) |
| Thu | 2nd state analysis: MP vs Gujarat vs Karnataka — CAC test ₹25k each, decide by numbers |
| Fri | Kill/scale review #18 |
| Sat | Testimonial #7 (landlord pilot) |
| Sun | Batch + review |

**Week 19 — Expansion prep**
| Day | Specific actions |
|---|---|
| Mon | If 2nd state GO: replicate district playbook (6 districts, mandi list, 300-lead B2B list, regional keywords) |
| Tue | instructor + vet organic wave: "Gurukul mein padhao online" + "pashu doctor ab gaon mein" |
| Wed | B2B sprint 200 |
| Thu | Ads product: banner ₹999 SKU live for input brands (pilot 2 regional brands) |
| Fri | Kill/scale review #19 |
| Sat | womenShG story: pickle/papad catalog → first 100 orders celebration post |
| Sun | Batch + review |

**Week 20 — Lock M6**
| Day | Specific actions |
|---|---|
| Mon | M6 budget model: ₹17.2L expected; if revenue < ₹17L, hold at 80% of actual |
| Tue | Renewal wave 2 (M2 cohort) + AutoPay coverage push to 70% |
| Wed | B2B sprint 200; referral push: "Gudi Padwa gift — dost ko Pro do" (gift-a-plan feature via coupons) |
| Thu | Creative refresh: 10 new harvest-season videos; kill fatigued ones (frequency > 3) |
| Fri | Kill/scale review #20 |
| Sat | Case-study: "5 mahine, 19,000 paying — sach ka saamna" internal + investor-grade summary |
| Sun | Batch + **M5 retrospective** |

**M5 AI creative prompts**
- Image: *"Vertical 9:16 photorealistic: Gudi Padwa morning — Maharashtrian family in front of decorated gudi (garlanded pole), father in white kurta-nehru jacket showing smartphone with agri app dashboard to grandfather, festive marigold, new-year ledger book motif in background, warm sunrise, headline space top-third"*
- Video (30s): *"Vertical 9:16: FY-end night — trader at desk surrounded by paper registers, frustrated; phone buzzes: 'Aapka saal: bikri ₹42L, kharch ₹31L, labh ₹11L'. He smiles, forwards P&L PDF to CA on WhatsApp. Voiceover Marathi: '31 मार्चचा हिशेब, एका तासात. ₹99 महिना — नवीन वर्षाची नवी सुरुवात.' End: Gudi Padwa greeting + logo."*

**M5 captions**
- HI: *"नया वित्तीय वर्ष, नया हिसाब। पूरे साल की बिक्री-खर्च की किताब एक क्लिक में — ₹99/महीना।"*
- MR: *"गुढी पाडव्याच्या शुभेच्छा! नवीन वर्षात संपूर्ण व्यवसाय डिजिटल — फक्त ₹99 मध्ये. आजच सुरू करा!"*
- EN (B2B): *"New FY, new books. Your entire year's P&L in one click. Flat ₹99/month — no commission, ever."*

---

## 13. MONTH 6 — "Harvest machine at full throttle" (Apr 2027)

**Theme:** Peak harvest + MSP procurement + kharif planning + marriage/wedding season (equipment bookings boom). Prove the ₹32L month and the repeatable district playbook.
**Targets:** 222k signups (cum. 4.2L) | 31,000 paying (₹30.7L) | ads ₹1.5L | **total ₹32L** | 2nd state live | team: 6–8 people

**Budget ₹17.2L:** Google ₹7.5L · Meta ₹9.7L. If any week runs >20% behind CAC target, freeze budget growth (protect unit economics over vanity).

**Week 21 — Peak season attack**
| Day | Specific actions |
|---|---|
| Mon | Kharif planning content wave: "kya boyega 2027?" — crop planner + mandi price history content |
| Tue | Equipment gold-rush: harvester/drone-sprayer slot booking campaign (per-acre pricing content) |
| Wed | B2B sprint 250; 2nd-state lead lists built |
| Thu | Lookalike refresh + district expansion: top-5 Maharashtra districts by payer density get 2× budget |
| Fri | Kill/scale review #21 |
| Sat | MSP procurement explainer video (wheat MSP, selling tips) — trust content |
| Sun | Batch + review |

**Week 22 — 2nd state launch**
| Day | Specific actions |
|---|---|
| Mon | 2nd state campaigns on (chosen by Week-18 data): district cluster #1, regional language creatives |
| Tue | Referral milestone push: "4 lakh kisan-bhai" celebration — 2× coins week |
| Wed | B2B sprint 250 (both states) |
| Thu | Ads product scale: every district's top seller gets "featured shop" offer call |
| Fri | Kill/scale review #22 |
| Sat | Wedding-season campaign: equipment + tent-house-adjacent... tractor parade content (cultural, shareable) |
| Sun | Batch + review |

**Week 23 — Retention + upsell**
| Day | Specific actions |
|---|---|
| Mon | Multi-persona upsell: payers shown "aap landlord bhi hain? ₹99 mein kiraya track karo" (cross-persona, codebase supports one account many profiles) |
| Tue | Churn deep-dive: cohort table by persona; fix top-3 churn causes product-side |
| Wed | B2B sprint 250 |
| Thu | Annual plan test (₹999) to 500 oldest payers: "2 mahine free" |
| Fri | Kill/scale review #23 |
| Sat | Testimonial #8 (multi-persona user story — one account, 3 personas) |
| Sun | Batch + review |

**Week 24 — Prove the model**
| Day | Specific actions |
|---|---|
| Mon | Scale winners 30%; prepare M7 budget (₹35L) |
| Tue | Case-study mega-post: 6-month numbers (signups, payers, revenue, renewal, CAC) |
| Wed | B2B sprint 250 + first 2 "district partner" micro-influencers (krishi YouTubers, ₹5k/fix video from ads budget) |
| Thu | Ads product: first agency-style report to pilot brands (₹999 banners) |
| Fri | Kill/scale review #24 |
| Sat | Team retro + M7–12 scale plan workshop (§15) |
| Sun | Batch + **M6 retrospective → Phase-2 plan locked** |

**M6 AI creative prompts**
- Image: *"Vertical 9:16 photorealistic: Indian wedding-season village scene — decorated tractor with flowers, proud owner showing phone screen with 14 booking requests for the month, laughing, late-afternoon golden light, celebratory mood, headline space top-third, kisan-green accents"*
- Video (30s): *"Vertical 9:16: drone spraying a cotton field at sunrise, cut to equipment owner phone: slot calendar fully booked for April, ₹ deposits credited via UPI. Voiceover Hindi proud male: 'Machine khadi thi, kamaai nahi thi. Ab calendar full, jeb full. ₹99 ka app — malik banne ka app.' End: logo + 'kharif booking khuli'."*

**M6 captions**
- HI: *"कटाई, मंडी, खरीफ की तैयारी — एक ऐप में पूरा साल का व्यापार। ₹99/महीना। 31,000 किसान-व्यापारी पहले से जुड़े।"*
- MR: *"कापणी, मंडी, खरीप तयारी — एकाच ॲपमध्ये वर्षभराचा व्यवसाय. फक्त ₹99. ३१,००० शेतकरी-व्यापारी आधीच सामील!"*
- EN (B2B): *"Harvest, mandi, next-season planning — your whole business year in one ₹99 app. No commission. 31,000+ agri businesses inside."*

---

## 14. Evergreen AI Prompt Library (reusable across all months)

**Format rules for every prompt:** vertical 9:16, photorealistic/documentary (not corporate stock), real Indian rural Maharashtra setting, authentic clothing, kisan-green (#1B7A3D) + white brand accents, empty headline space top-third, no text rendered inside the image (add text in CapCut), warm natural light, no watermarks.

| # | Use | Prompt |
|---|---|---|
| P1 | Farmer (free magnet) | "Photorealistic vertical 9:16: 55-year-old Indian farmer in white kurta-pajama and Gandhi topi in lush green soybean field at sunrise, holding smartphone showing a mandi price screen of a clean agri app, smiling at camera, distant village + temple, headline space top-third, warm golden light" |
| P2 | Vyapari | "Vertical 9:16 photorealistic: busy APMC mandi, onion sacks, 40-year-old trader in white kurta with cotton shoulder bag checking phone — screen shows ledger entries and 3 new order notifications, steel tiffin + brass scale on desk, morning chaos blurred behind, confident expression" |
| P3 | Transporter | "Vertical 9:16 photorealistic: highway dhaba at dawn, 35-year-old truck owner with phone showing a load-board map with 5 route bids, Tata truck with tarpaulin behind, chai glass steaming, determined look, orange-pink sky" |
| P4 | Equipment owner | "Vertical 9:16 photorealistic: tractor + rotavator parked at village home, proud 45-year-old owner showing phone calendar fully booked with green slots, son polishing machine, coconut tree + well in background, afternoon light" |
| P5 | Dairy manager | "Vertical 9:16 photorealistic: village dairy collection center, stainless steel milk cans, 40-year-old manager with phone showing FAT/SNF rate chart + member payout list, women members with cans queuing, early morning light" |
| P6 | Broker | "Vertical 9:16 photorealistic: mandi broker desk with 3 phones, rate slips, 50-year-old broker in kurta showing phone — deal pipeline screen with farmer/buyer names, chai, ceiling fan, shrewd friendly smile" |
| P7 | Landlord | "Vertical 9:16 photorealistic: elderly landlord with land records (7/12 papers) in one hand, phone in other showing lease agreement + rent collection screen, green farmland boundary behind, satisfied expression" |
| P8 | Instructor | "Vertical 9:16 photorealistic: young agri-graduate woman in front of blackboard with crop diagram, phone showing her online course with 500 students enrolled, confident teacher pose, daylight classroom" |
| P9 | womenShG | "Vertical 9:16 photorealistic: 3 women in colorful nauvari sarees packing pickle/papad jars, phone showing their SHG online shop with 42 orders, FSSAI certificate framed on wall, bright courtyard" |
| P10 | Milk seller | "Vertical 9:16 photorealistic: morning doorstep milk delivery, 30-year-old doodhwala with cans + phone showing 68 customer punch-sheet + UPI collections marked paid, apartment/rural lane mix, sunrise" |

**Video formula (30s, text-to-video or CapCut from P-shots):** day-in-life pain (5s, paper/chaos) → app moment (15s, screen close-ups) → money/relief payoff (7s) → end card "₹99/mahina — [CTA]" (3s). Voiceover: warm regional voice, one sentence per act. Export 9:16, burn Marathi/Hindi subtitles (rural viewers watch muted).

---

## 15. Caption Bank ( evergreen, rotate by persona/month)

**Farmer (free tier hook)**
- HI: *"मंडी भाव सुबह 7 बजे, फोन पर। मुफ़्त। बाकी सब — ₹99 में।"*
- MR: *"सकाळी ७ वाजता बाजारभाव, फोनवर. फुकट. बाकी सगळं ₹99 मध्ये."*

**Vyapari**
- HI: *"खाता, लिस्टिंग, माल, पैसा — ₹99 में पूरा मंडी ऑफिस। कमीशन? कभी नहीं।"*
- MR: *"खातं, लिस्टिंग, माल, पैसे — ₹99 मध्ये संपूर्ण मंडी ऑफिस. कमिशन? कधीच नाही."*

**Transporter**
- HI: *"खाली जाने से पहले ही ढूंढो माल। ₹99/महीना — एक ट्रिप में वसूल।"*
- MR: *"रिकाम्या प्रवासाची चिंता संपवा. ₹99/महिना — एकाच प्रवासात परत."*

**Equipment**
- HI: *"ट्रैक्टर खड़ा है तो कमाई भी खड़ी है। कैलेंडर भरो — ₹99 में।"*
- MR: *"ट्रॅक्टर रिकामा तर नफा रिकामा. कॅलेंडर भरा — ₹99 मध्ये."*

**Dairy**
- HI: *"FAT/SNF से payout तक — पूरा दूध कारोबार ₹99 में।"*
- MR: *"FAT/SNF पासून पेमेंट पर्यंत — संपूर्ण दूध व्यवसाय ₹99 मध्ये."*

**B2B proof (English)**
- *"No commission. No setup fee. Flat ₹99/month. Your data stays yours. 31,000+ agri businesses and counting."*

**Referral forward template (WhatsApp)**
- HI: *"भाई, ये ऐप देख — मंडी भाव + पूरा व्यापार ₹99 में। मेरे लिंक से डाउनलोड कर, दोनों को 15 दिन Pro फ्री: [link]"*
- MR: *"बघा हे ॲप — भाव + संपूर्ण व्यवसाय ₹99 मध्ये. माझ्या लिंकवर डाउनलोड करा, दोघांनाही १५ दिवस Pro फुकट: [link]"*

---

## 16. KPI Dashboard & Operating Rules

**Daily dashboard (one Google Sheet, 15-min update):** spend by campaign · CAC · signups · activation % (Day-1: mandi alert set OR first listing/khata entry) · paywall views · purchases · free→paid % · MRR · renewals due/paid · churn · referral share · ads-product revenue · district-level CAC heatmap.

**Weekly review (Fri, 1h):** cohort table by signup week; creative leaderboard; district leaderboard.

**Kill/scale rules (non-negotiable):**
- Ad set CAC > ₹20 for 3 days → kill. CAC ₹12–15 → hold. < ₹12 for 3 days → +30% budget every 3 days (max 2×/week).
- Creative frequency > 3 on Meta → refresh creative.
- Free→paid < 8% for 2 consecutive weeks → pause acquisition, fix activation/paywall first (acquiring into a leaking funnel is burning money).
- Renewal rate < 80% → freeze budget growth; churn war-room.
- Any district CAC < ₹10 → clone its campaign to next-nearest district.

**North-star metric:** weekly new payers (₹99). Every activity maps to it.

---

## 17. Months 7–12 — Scale to ₹2cr/month, then ₹20cr trajectory

**M7–9 (₹35L → ₹90L/month budget, all revenue-funded):** add remaining Wave-4 personas via direct sales (directBuyer, coldStorage, FPO); 3rd state; instructor/vet/SHG content engines mature; ads product self-serve fully automated; CAC drifts ₹15–18 — counter with referral share ≥ 35% and SEO compounding (target 300k organic/mo). Exit M9 at **~₹1cr/month**.

**M10–12 (₹1.3cr → ₹2.2cr/month budget):** 5–6 states, Hindi heartland scale (MP/UP/Rajasthan), Kannada + Gujarati UI, micro-influencer network (100 krishi creators on revenue-share, zero upfront), first regional brand ad deals (₹50k–2L/month each). Exit M12 at **~₹2.2cr/month run-rate**.

**The ₹20cr/month path (M13–24, honest timeline):**

| Lever | What it adds |
|---|---|
| Volume | 2.0M+ paying subs @ ₹99 = ₹20cr needs ~2.02M payers; M12 base ~2L paying → 10× in 12–18 months |
| States | 10+ states, 8 languages (UI + support + content localization) |
| CAC realism | ₹20–25 blended at scale; referral 40%+ mandatory — invest in coins/gamification (`routers/gamification.py`) |
| Ads revenue | ₹20cr/month subscription implies ~15–20M MAU → on-platform ads ₹3–5cr/month (marketplace-standard: ~15–20% of sub revenue) |
| Team | 40–60 people: growth pods per region, creator network, B2B sales, support (Marathi/Hindi), ops |
| Funding | Revenue ₹2.2cr/mo covers ~₹1.7cr marketing; beyond that either raise or keep growth at reinvestment rate — **do not buy growth ahead of renewals** |

**Milestone glide path:** ₹5cr M14 → ₹10cr M16–17 → ₹15cr M19 → **₹20cr M20–24** + ₹3–5cr ads revenue on top.

---

## 18. Risks & Contingencies

| Risk | Signal | Response |
|---|---|---|
| Free→paid stuck < 8% | M2 dashboard | Enrich ₹99 value (bundle 2 personas for ₹149), add UPI AutoPay incentive, re-test paywall copy before scaling spend |
| CAC inflates in harvest season | W13+ | Shift weight to SEO/referral; pause non-brand Search; harvest content was pre-built in M2–3 for this |
| Renewal rate < 80% | W14+ | Churn war-room: day-20 calls, AutoPay push, pause-instead-of-cancel, win-back offers |
| Razorpay/UPI failures at paywall | funnel drop | Add UPI intent + QR fallback, cashierless retry flow, SMS fallback link |
| Referral gaming (fake accounts) | coin ledger anomalies | Device-fingerprint + KYC-lite gate on referral rewards (`routers/admin_sop_*.py` fraud queues) |
| Meta/Google account bans (agri is a flagged category) | disapprovals | Pre-verified Business Manager, compliant copy (no income claims), backup ad account |
| Team bandwidth (founder-led everything breaks ~M4) | missed daily rhythm | Hire from M3 revenue: outreach person first, then content person |
| Seasonality lull (Jul–Aug) | signups dip | Kharif planning + insurance/loan content pre-built; use lull for retention + ads-product sales |

---

## 19. Appendix — 20 Personas & Free-Tier Design (₹99 unlocks the rest)

| # | Persona | Free tier (the magnet) | ₹99 unlocks |
|---|---|---|---|
| 1 | farmer | Mandi prices, advisory, diary, P&L | Unlimited listings, buyer connections, priority alerts |
| 2 | landlord | 1 plot, 1 lease, 5 listings | Unlimited plots/leases, escrow, rent auto-reminders |
| 3 | transporter | 1 vehicle, view load board | Unlimited vehicles, bid on loads, GST bilty, GPS |
| 4 | seller/vyapari | 20 listings, basic khata | Unlimited listings, digital POS khata, J-Form, mall orders |
| 5 | equipmentOwner | View bookings | List machines, slot booking engine, damage escrow |
| 6 | broker | 5 active deals | Unlimited deals, commission ledger, dispute desk |
| 7 | dairyManager | 25 members, 20 animals | Unlimited members/animals, FAT/SNF charts, DBT batches |
| 8 | milkSeller | 10 customers | Unlimited punch-sheet, UPI invoicing |
| 9 | vet | View consults | Tele-consult queue, health passports, campaigns |
| 10 | gaushalaManager | Basic inventory | Adoptions, 80G receipts, donation campaigns |
| 11 | fpoManager | View demands | Aggregation pools, shared machinery, tenders |
| 12 | womenShg | 10 products | Unlimited catalog, FSSAI vault, savings ledger |
| 13 | instructor | 1 free course | Course studio, certificates, royalty payouts |
| 14 | directBuyer | View lots | Post demands, contracts, gate QC, escrow |
| 15 | exporter | View RFQs | RFQ bids, certificates, reefer tracking |
| 16 | customer | Browse mall | Subscriptions, KisanCoins cashback |
| 17 | bankManager | Console view | Full underwriting console seats |
| 18 | insuranceProvider | Claims view | Full claims processing console |
| 19 | coldStorageProvider | 1 chamber | Chamber IoT, e-NWR, bookings |
| 20 | superadmin | — | (platform ops — never sold) |

**Free-tier design principle:** free is *daily-useful* (keeps MAU and referral loops alive); ₹99 is *business-critical* (unlocks the money-making capacity). Every free user sees the lock daily.

---

*Document owner: founder. Review cadence: weekly (Fri review), monthly (last Sun retrospective). Next revision: end of M1 with real numbers replacing assumptions.*
