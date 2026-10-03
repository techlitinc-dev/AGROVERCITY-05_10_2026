# AGROVERCITY Web — Complete Feature Atlas & the Missing-Features Master List

*The road to a million-dollar SaaS — and a website no Indian farmer can live without.*
*Verified against code on 2026-10-02: backend `pytest` 688 passed · website `pnpm build` green.*

---

## 0. How to read this document

Every claim here was checked against the actual code, not the docs:

- **Backend ground truth**: `backend/app/routers/*.py` — **70 routers, 535 endpoints**, catalogued in `endpoints.md`
- **Website ground truth**: `website/src/views/*` — **16 view modules, 130 page files, 77 routes**, `website/src/lib/api/*` — 24 API modules
- **Status symbols**
  - ✅ **Live** — real UI on the website, wired to the backend
  - 🔌 **Backend-ready** — the API exists and is tested; the website has NO UI for it (highest-leverage gaps)
  - ❌ **Greenfield** — nothing exists yet; pure build

**The one-line summary:** the backend is a 70-module agri-platform; the website currently surfaces roughly a third of it. The cheapest growth in product value is wiring what already works — and the biggest prize is the money layer that turns this into a business.

---

## 1. What the website IS today

A mobile-shell-width (480px), vernacular-first (30 registered languages, full English/Hindi parity on the new dairy suite) web app with OTP auth, MPIN, 13 personas, and role-gated dashboards. Real, working surfaces:

| Domain | What's live |
|---|---|
| **Auth & identity** | Phone-OTP login, MPIN, registration wizard, language picker, 13-persona profile activation, legal pages |
| **Farmer ↔ Vyapari trade** (17 tool pages) | Produce lots (create/edit/browse), demand posting, dual-target offers with negotiation, purchases with status pipeline, in-app chat, khata ledger, POS, procurement, mandi prices + rates analytics, saved farmers, bank accounts, notifications |
| **Transport** (10 tool pages) | Load board, bookings inbox, vehicle management + calendar, live tracking, bilty, settlements |
| **Broker / Dalal** (5 pages) | Deal pipeline, leads (buyers), commissions, profile |
| **Direct buyer & contracts** | Buyer home, contract drafting/negotiation for buyers and farmers |
| **Dairy & Gaushala suite** (5 tool pages, 39 routes) | Milk collection with chart-based FAT/SNF pricing, member book + statements, payment batches with FCM payout notifications, milk sales + stock + P&L, deep analytics cockpit; farmer "My Dairy" with slips/payments/rate transparency; full gaushala console (cattle, adoptions/donations with 80G receipts, expenses, byproducts); vet network (appointments, campaigns, prescriptions); herd registry (yield, breeding, vaccinations) |
| **Money basics** | Farm diary cashbook, profit & loss, persona intelligence digest |
| **Platform** | Onboarding flow, profiles switcher, notifications inbox, CSV exports |

**Genuinely hard problems already solved on the backend:** chart-driven milk pricing, center-scoped privacy isolation, escrow-style payment batch lifecycle, 80G receipt automation, appointment/prescription state machines, KYC review queues, and role enforcement on all 535 endpoints.

---

## 2. ✅ COMPLETE — what the website has (verified)

| # | Module | Web surface | Backend depth |
|---|---|---|---|
| 1 | Auth/session | OTP, MPIN, refresh-token interceptor, profile activation | `auth.py`, `users.py` |
| 2 | Trade marketplace | 17 pages incl. negotiation, chat, khata, POS | `lots.py`, `offers.py`, `demands.py`, `purchases.py`, `chat.py`, `mandi.py` |
| 3 | Transport | 10 pages incl. bilty + tracking | `transport.py`, `settlements.py` |
| 4 | Broker | deals/leads/commissions | `broker.py` |
| 5 | Direct buyer + contracts | contract lifecycle both sides | `direct_buyer.py`, `contracts.py` |
| 6 | Dairy console | full center management + analytics | `livestock_dairy.py`, `livestock.py` |
| 7 | Gaushala console | full trust management + 80G receipts | `livestock_gaushala.py` |
| 8 | Vet network | appointments/campaigns/prescriptions | `livestock_vets.py` |
| 9 | Herd registry | animals/yield/breeding/vaccinations | `livestock.py` |
| 10 | Cashbook + P&L | farm diary, profit/loss | `diary.py`, `pnl.py` |
| 11 | Intelligence | persona digest dashboards | `intelligence.py` |
| 12 | Notifications inbox | FCM-backed list | `notifications.py` |

---

## 3. 🔌 MISSING ON THE WEBSITE — backend-ready, no UI (the leverage list)

**39 backend router families have zero website surface.** Each row is a shipped, tested API waiting for a screen. Ordered by business value:

### 3.1 Money, credit & protection *(turns users into revenue)*

| Router | What it does | Web needs | Value |
|---|---|---|---|
| `loans.py` + `finance.py` | Loan applications, eligibility, bank-manager review queues, KCC | Farmer loan apply/track UI; bank manager dashboard (tools `loanDashboard`, `loanReview`, `loanTracking` exist as placeholders) | Fintech referral revenue; stickiness |
| `insurance.py` + `insurance_claims.py` (689 lines) | Crop insurance policies, premiums, claim filing + review | Farmer buy/claim UI; insurer review consoles (`cropInsurance`, `insurancePolicyReview`, `insuranceClaimReview` placeholders) | High-trust money product |
| `schemes.py` | Govt schemes directory + eligibility | `schemes` tool page with filter by state/category + eligibility checker | Traffic magnet; SEO heaven |
| `coupons.py` | Coupon engine | Coupons wallet (`coupons` placeholder) | Promotions |
| `settlements.py` / `purchase_settlement.py` detail | Settlement breakdowns beyond transport | Settlement detail pages | Money transparency |
| `vault.py` | Document vault (KYC docs, policies, receipts) | Vault page with upload/status | Compliance + retention |

### 3.2 Knowledge & advisory *(daily-habit moat)*

| Router | What it does | Web needs | Value |
|---|---|---|---|
| `courses.py` (769 lines) + `teachers.py` + `jobs.py` | Courses, lessons, instructors, course jobs, enrollments, progress | `courses` + `myLibrary` pages: catalog, player, progress, instructor studio | EdTech revenue share |
| `advisory.py` | Crop advisories, sowing intent, saturation guidance | Advisory feed + sowing-intent capture | Agronomist credibility |
| `chatbot.py` | **AI chatbot backend already exists** | Chat UI (floating assistant) | 24×7 "heaven" factor |
| `content.py` + `gyan.py` | Agri news, articles, videos | `agriNews`, `gyanHub`, `liveChannels` pages | Daily retention loop |
| `disease_model` + `grading_model` (services) | Disease detection + produce grading models | Scan/upload UI wired to services | AI differentiation |
| `weather.py` + `climate.py` | Weather + climate advisories | Weather detail (7-day), spray windows, alerts | Daily open reason |
| `soil_tests.py` + `post_harvest.py` | Soil test booking + post-harvest guidance/tools | Booking flow + guidance pages | Service commerce |

### 3.3 Commerce & marketplace breadth *(GMV growth)*

| Router | What it does | Web needs | Value |
|---|---|---|---|
| `marketplace.py` + `orders.py` + `order_tracking.py` | E-market: products, cart, orders, tracking | `marketplace`, `orderTracking` pages | Consumer revenue stream |
| `user_products.py` + `seller_products.py` | Product management for sellers | `myProducts`, `sellerProducts` pages | Supply onboarding |
| `wishlist.py`, `price_alerts.py`, `ratings.py` | Wishlist, price alerts, review system | Small widgets across marketplace | Conversion + trust |
| `ads.py` | Ad serving | Sponsored slots in feeds | Ad revenue |
| `addresses.py` | Address book | `addressBook` page | Checkout hygiene |
| `equipment.py` + `equipment_owner.py` | Equipment rental marketplace + owner console | `equipment`, `machineManage`, `slotCalendarManage` pages | Second vertical, already half-wired on backend |
| `fpo.py` | FPO profiles, group buys, machinery pools | `fpo` page (join pools) | Institution linkage |

### 3.4 Land, water & assets *(asset-heavy farmers)*

| Router | What it does | Web needs | Value |
|---|---|---|---|
| `land.py` (408 lines) + `land_records.py` | Land listings, lease requests, plots, rent tracking, 7/12 records | `landlordPlots`, `landListings`, `leaseRequests`, `landLegal` pages | Landlord persona completeness |
| `water.py` | Water schemes/budgeting | `water` page | Scheme money |
| `tree.py` | Tree plantation tracking | `treePlantation` page | Carbon/CSR story |

### 3.5 People & engagement *(growth loops)*

| Router | What it does | Web needs | Value |
|---|---|---|---|
| `referrals.py` | Referral codes, attribution, rewards | `referEarn` page + code entry at registration | Viral loop (currently broken UX-wise) |
| `gamification.py` (371 lines) | AgriCoins, badges, streaks, leaderboards | Coins/badges surfaces, streak nudges | Retention mechanics |
| `women.py` | Women-farmer programs (SHG, livestock, garden, enterprise) | `womenFarmer` hub | Inclusive-growth segment |
| `admin.py` (483 lines) | **Full back-office: KYC queue, course review, loan status, user management, e-market analytics, expert handoffs** | Entire admin console | Ops cost + trust & safety |

---

## 4. ❌ GREENFIELD — must be built (backend + UI)

These are the million-dollar gaps. Nothing exists yet.

| # | Gap | Why it's the money |
|---|---|---|
| G1 | **Payments & escrow** — no user-facing payment router; `services/payments.py` exists but isn't exposed. UPI intent, escrow hold/release, refunds, TDS/GST invoicing | Every module above records money but can't move it. Commission = revenue |
| G2 | **SaaS subscriptions** — per-center pricing for dairies/gaushalas (per-member/month), premium tiers, trial management | The actual "SaaS" in SaaS; predictable MRR |
| G3 | **Admin console** (backend ready — needs UI) | Ops, KYC TAT, dispute mediation, commission config |
| G4 | **Global search** (`GET /search?q=` across schemes/news/products/crops) | Utility glue for a 90-tool app |
| G5 | **Task engine** — "Today's Action" from crop cycles + weather + payment due dates | The daily-habit hook |
| G6 | **Notification preferences + templates center** | Transactional trust |
| G7 | **PWA + performance** — 1.4 MB single bundle, no code-splitting, no service worker; add installability + offline shell | Rural connectivity reality |
| G8 | **Full vernacular rollout** — 30 locales registered but only en/hi are complete; crowdsource/translate pipeline | Bharat-scale TAM |
| G9 | **Report/block + trust & safety surfaces** | Marketplace legitimacy |
| G10 | **Data export & accounting integration** (Tally CSV, GST reports) | Professional users pay for this |
| G11 | **API platform / B2B integrations** (FPO ERP, dairy union software, govt DBT sync) | Enterprise moat |

---

## 5. The Million-Dollar SaaS Blueprint

### 5.1 Positioning

**"The income operating system for Bharat agriculture."** Not another advisory app — the place where a farmer's *money* lives: milk payouts, produce sales, khata, loans, insurance, scheme benefits — in his language, on his phone.

The unfair advantage already in the code: **13 interlinked personas on one backend**. A milk collection center (dairyManager) brings 200 farmer members; those farmers trade produce; the trader needs transport; the transporter needs settlements — every persona recruited pulls the others. Network effects are structural.

### 5.2 Revenue model (five engines)

| Engine | Who pays | Built on |
|---|---|---|
| **SaaS tiers** | Dairies/gaushalas/cold-storages/FPOs — per-member or per-center monthly | The dairy/gaushala consoles we just shipped (meter on members/collections) |
| **Transaction commission** | Trade + transport + equipment bookings (2–5%, capped) | G1 escrow; existing purchase/settlement pipelines |
| **Fintech referral** | Banks/NBFCs/insurers per disbursal/policy | `loans.py`, `insurance.py` (ready) |
| **Ads & featured listings** | Input brands, nurseries, equipment dealers | `ads.py` (ready) |
| **Data insights (aggregated, opt-in)** | Processors, govt, insurers — mandi/demand benchmarks | `intelligence.py`, dairy analytics (exists) |

### 5.3 Roadmap (quarters, sequenced by leverage)

**Q1 — "Wire the backend" (highest ROI: APIs already work)**
1. Admin console (backend ready) → KYC TAT, ops unlock
2. Money trio: loans UI (both sides) + insurance + schemes → monetizable from day one
3. Weather detail + task engine + global search → daily habit
4. Courses + content (news/gyan) → retention + edTech share

**Q2 — "The money layer"**
5. Escrow payments (UPI), commission engine, GST invoices, TDS
6. SaaS billing for dairy/gaushala consoles + subscriptions
7. Marketplace (e-market) + wishlist/alerts/ratings → GMV
8. Referrals fixed end-to-end + gamification surfaces → growth loop

**Q3 — "The heaven layer" (AI + vernacular depth)**
9. Chatbot UI (backend ready) + disease-scan/grading model surfaces
10. Advisory copilot: sowing intent → task plan → spray windows → mandi timing suggestions
11. Full 30-language rollout pipeline
12. Women-farmer hub, FPO pools, land suite, equipment rental → persona completeness

**Q4 — "The moat"**
13. PWA + offline + code-splitting (perf budget < 300 KB first load)
14. B2B API platform + data insights product
15. Trust & safety center + dispute mediation console

### 5.4 North-star metrics

- **Weekly transacting farmers** (collection slip, sale, khata entry, or payment) — the real heartbeat
- GMV through escrow · dairy centers on paid tier · KYC approval TAT < 24 h · D30 retention by persona · referrals per new user

### 5.5 Why farmers will call it heaven

1. **Money in, daily** — milk slips → payout in bank, visible to the last rupee (already true)
2. **No middleman can cheat him** — chart-based FAT/SNF pricing, immutable slips, statements (already true)
3. **His language, his people** — 30 locales, every agri persona in the family covered
4. **One app for the whole village economy** — dairy, mandi, transport, loans, insurance, schemes
5. **An expert in his pocket** — AI chatbot + vet network + advisory (Q1–Q3)

---

## 6. Appendix — verify it yourself

```bash
# Backend: 688 tests green
cd backend && .venv/bin/python -m pytest -q

# Website: typecheck + production build
cd website && pnpm build

# Count the surface
ls backend/app/routers/*.py | wc -l          # 70 routers
grep -c "@router\." backend/app/routers/*.py | awk -F: '{s+=$2} END {print s}'   # 535 endpoints
find website/src/views -name "*.tsx" | wc -l # 130 page files
grep -cE "<Route\b" website/src/App.tsx  # 76 routes
```

*End of atlas. The backend is the empire; the website is the map — §3 is the fastest territory to claim, §4 is the treasure.*
