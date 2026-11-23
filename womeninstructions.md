# Women Hub — Implementation Instructions

**Source document:** `womenhub 21nov.xlsx` (Sheet1, two sections: *"Women Hub — Can See These Pages"* and *"Farmer — Can See These Pages"*).

**Scope rules (as instructed):**
1. Every feature below is taken **only** from `womenhub 21nov.xlsx`. No external/third-party features are added.
2. The features described in the file are **not altered, extended, or re-interpreted** — they are implemented exactly as written. Fields, statuses, and buttons are the ones named in the file.
3. Where the file is silent (tech stack, auth, hosting, payments), the instruction is to reuse the existing Agrovercity platform conventions — not to introduce new external services.

**Numbering note:** In the file's Women Hub list, Sr. no. 3.0 and 8.0 are absent (1, 2, 4, 5, 6, 7, 9 … 23). The numbering below keeps the file's own Sr. no. so the doc maps 1:1 to the sheet.

---

## PART A — Women Hub (woman-facing pages)

### A1. Dashboard (Sr. 1.0)
File says: kitchen garden growth stages, Total business, enterprise profit total, notifications, Indian calendar, remainders (reminders).

Implementation:
- Single home screen with widgets/cards pulling **only** from other Women Hub modules listed in this file:
  - Kitchen Garden Planner → current growth stages of her crops.
  - My Business & Management → count of her businesses ("Total business").
  - Home Enterprise Income / Finance CEO → enterprise profit total.
  - Notifications page → latest alerts.
  - Indian calendar widget (month/date display per Indian calendar).
  - Reminders widget (from garden water/fertilizer reminders and notification alerts).

### A2. My Business & Management (Sr. 2.0)
File says: Create multiple businesses (e.g., tiffin/dabba service, tailoring, pickle-papad unit) using 'Create Business' option; business list of all her created businesses; search bar to search her own businesses; business details = business name, category, what the business does, photo, service area, working days/time; edit/pause/delete business; per-business products, orders, enquiries, ratings.

Implementation:
- "Create Business" form → business record with fields exactly: **business name, category, what the business does, photo, service area, working days/time**. A woman can own **multiple** businesses.
- "My Businesses" list screen + search bar (searches only her own businesses).
- Business detail/edit screen with **edit / pause / delete** actions.
- Per-business sub-sections showing that business's **products, orders, enquiries, ratings** (data sourced from My Seller Store, Requirements/Demand Board responses, and Ratings & Reviews modules).

### A3. Kitchen Garden Planner (Sr. 4.0)
File says: Nutrition-focused vegetable list (spinach, methi, tomato, carrot, drumstick etc. with iron/vitamin tags), sowing → sprout → vegetative → flowering → harvest growth stage tracker, seasonal planner, water/fertilizer reminders, yield log.

Implementation:
- Vegetable catalog; each vegetable carries **nutrition tags** (iron/vitamin etc.). Seed list includes at minimum: spinach, methi, tomato, carrot, drumstick.
- Crop tracker with the exact stage pipeline: **sowing → sprout → vegetative → flowering → harvest** (stage advances manually or on schedule).
- Seasonal planner (planting plan per season).
- Reminders for **water / fertilizer** (feeds Dashboard reminders widget + Notifications).
- **Yield log** per crop (harvest quantity recorded).

### A4. Home Enterprise Income (Sr. 5.0)
File says: Product lines: pickle, papad, ghee (add/edit product, quantity, price), monthly profit line per product (revenue − cost), auto-calculated monthly total profit, expense entries, profit graph, export ledger.

Implementation:
- Product line manager for **pickle, papad, ghee** — add/edit product with **quantity, price**.
- For each product, monthly figures: revenue, cost → **profit = revenue − cost** per product per month.
- **Auto-calculated monthly total profit** across products.
- **Expense entries** (record business expenses).
- **Profit graph** (monthly profit visualization).
- **Export ledger** (download the income ledger).

### A5. Requirements / Demand Board (Sr. 6.0)
File says: View customer buy demands (vegetables, ghee, papad etc.), respond with offer/price, accept/decline, chat window.

Implementation:
- Board listing customer buy demands (product, quantity, etc. — as posted by farmers via their Demand Board).
- Woman can **respond with an offer/price**.
- **Accept / decline** controls on demand/offer states.
- **Chat window** opens between the two parties (in-app).

### A6. My Orders & Track (Sr. 7.0)
File says: Order list (from farmers/e-market), packed → pickup → in transit → delivered.

Implementation:
- Orders list where the woman is the seller, sourced from farmer orders and e-market orders.
- Tracking status pipeline exactly: **packed → pickup → in transit → delivered**.

### A7. AI Analysis (Sr. 9.0)
File says: Saving grp savings trend, loan repayment health, garden yield prediction, livestock productivity insights, enterprise best-seller & price suggestion.

Implementation:
- Analysis screen with five report blocks, each computed from in-platform data:
  1. Savings group savings trend.
  2. Loan repayment health.
  3. Garden yield prediction (from Kitchen Garden yield log).
  4. Livestock productivity insights.
  5. Enterprise best-seller & price suggestion (from Home Enterprise Income / My Seller Store sales data).

### A8. Give Advertisement (Sr. 10.0)
File says: Create/update/delete ad for own enterprise products, target village/district.

Implementation:
- Ad CRUD for the woman's own enterprise products.
- Targeting selector: **village / district**.

### A9. Gyansetu (Sr. 11.0)
File says: Create/view courses & articles (tailoring, food processing, SHG bookkeeping); enroll, progress tracking.

Implementation:
- Course/article catalog with topics per file: **tailoring, food processing, SHG bookkeeping**.
- Create + view courses/articles.
- **Enroll** in a course; **progress tracking** per enrolled user.

### A10. Agri News (Sr. 12.0)
File says: View all news, share.

Implementation:
- News feed (view all).
- **Share** action on a news item.

### A11. (Women Hub) Diary (Sr. 13.0)
File says: Add note calendar-wise, search, note = name, quantity, price, Buy OR Sell product, delete.

Implementation:
- Calendar-based diary; notes attached to dates.
- Note fields exactly: **name, quantity, price, Buy or Sell product**.
- Search notes; **delete** note.

### A12. Refer & Earn (Sr. 14.0)
File says: Referral code, share, rewards, referred users.

Implementation:
- Screen showing the woman's **referral code**.
- **Share** the code.
- **Rewards** earned via referrals.
- **Referred users** list.

### A13. Coin Rewards / Krushi Ratna (Sr. 15.0)
File says: Coin balance, earn/redeem history.

Implementation:
- Coin balance display.
- **Earn history** and **redeem history** lists.

### A14. Tree Hub (Sr. 16.0)
File says: Search by tree name/place/NGO-nursery, saved, request, add note, nursery profile, chat after accepted request.

Implementation:
- Search trees by **name / place / NGO-nursery**.
- **Save** trees; **request** a tree; **add note** to a tree.
- **Nursery profile** view.
- **Chat unlocks only after the request is accepted.**

### A15. Agri Market / Shopping (Sr. 17.0)
File says: Search, saved, order, chat window, shopping profile = address, name, history, ratings, reviews.

Implementation:
- Marketplace browsing: **search, save items, place order, chat window** with seller.
- Shopping profile fields exactly: **address, name, history, ratings, reviews**.

### A16. My Seller Store (Sr. 18.0)
File says: List enterprise products (pickle/papad/ghee), stock, pricing, orders, ratings.

Implementation:
- Seller storefront listing her enterprise products (**pickle / papad / ghee**).
- Manage **stock** and **pricing**.
- View store **orders** and **ratings**.

### A17. Finance CEO / Accounting App (Sr. 19.0)
File says: Dashboard = profit/loss graph, add note, search, history, purchase/sell, automatic calculations.

Implementation:
- Accounting dashboard with: **profit/loss graph**.
- **Add note**, **search**, **history**.
- Record **purchase / sell** entries.
- **Automatic calculations** (totals derived from entries).

### A18. 7/12 & Land Records (Sr. 20.0)
File says: View & download PDF linked to profile.

Implementation:
- Screen to **view** and **download** the 7/12 land-record PDF.
- The PDF is **linked to the user's profile** (no external lookup — only what is attached to the profile).

### A19. Chatbot (Sr. 21.0)
File says: Ask questions; has access of women hub info (garden, livestock, enterprise) then gives responses; history, mic, keypad, camera, upload image.

Implementation:
- Q&A chatbot that can read the woman's own Women Hub data — **garden, livestock, enterprise** — and answer using it.
- Conversation **history**.
- Input modes: **mic, keypad, camera, upload image**.

### A20. Ratings & Reviews (Sr. 22.0)
File says: Self rating view, my given ratings to farmer buyers, reply to reviews.

Implementation:
- View **her own rating** (self rating view).
- View **ratings she gave to farmer buyers**.
- **Reply** to reviews she received.

### A21. Notifications (Sr. 23.0)
File says: Deposit due reminder, vaccination due alert, loan approve/repay alert, order/payment alerts.

Implementation:
- Notification center producing exactly these alert types:
  - Deposit due reminder.
  - Vaccination due alert.
  - Loan approve / repay alert.
  - Order / payment alerts.

---

## PART B — Farmer-facing pages (cross-persona, marked NEW in file)

### B1. Discover Women Hub Businesses (Sr. 1.0, NEW)
File says: Browse & search businesses created by Women Hub members (tiffin/dabba service, tailoring, pickle-papad, ghee, dairy etc.), filter by category & distance, search bar, business cards = photo, name, category, rating, location.

Implementation:
- Browse/search directory of all Women Hub businesses (from Part A2 data).
- **Filters: category and distance.** Search bar.
- Business card shows exactly: **photo, name, category, rating, location**.

### B2. Women Hub Business Profile / Store (Sr. 2.0, NEW)
File says: View a business created by the woman: what the business does, products/services with photos, price, stock, ratings & reviews, working days/time; buttons = Enquire, Order, Chat (in-app only, no phone number).

Implementation:
- Public business page showing: what the business does, products/services (photos, price, stock), ratings & reviews, working days/time.
- Action buttons exactly: **Enquire, Order, Chat**.
- Constraint from file: **in-app only — no phone number exposed.**

### B3. Post Buy Demand / Demand Board (Sr. 3.0)
File says: Post buy requirement (vegetables, ghee, papad etc.) = product name, quantity, expected price, needed-by date; view offers/price responses from Women Hub, accept/decline, chat window.

Implementation:
- Form fields exactly: **product name, quantity, expected price, needed-by date**.
- Responses view: offers/prices from Women Hub members; **accept / decline**.
- **Chat window** with the responding woman.

### B4. My Orders & Track (Sr. 4.0)
File says: Orders placed to Women Hub businesses / e-market, status: placed → accepted → packed → pickup → in transit → delivered; cancel before acceptance.

Implementation:
- Farmer's order list (Women Hub businesses + e-market).
- Status pipeline exactly: **placed → accepted → packed → pickup → in transit → delivered**.
- **Cancel allowed only before acceptance.**

### B5. Post Requirement (Sr. 5.0)
File says: Send requirement on any Women Hub product/service (product + quantity + message), enquiry history with status (pending/responded).

Implementation:
- Requirement form on a Women Hub product/service: **product + quantity + message**.
- Enquiry history with status values exactly: **pending / responded**.

### B6. Chat (Sr. 6.0)
File says: 1:1 in-app chat with Women Hub sellers; text, images, documents, product sharing; conversation history; no external apps.

Implementation:
- 1:1 in-app chat between farmer and Women Hub seller.
- Message types: **text, images, documents, product sharing**.
- **Conversation history** persisted.
- Constraint: **no external apps** — chat stays inside the platform.

---

## Cross-cutting data implied by the file (shared entities)

These entities are required to connect the listed features; fields are only those the file names:

| Entity | Fields (from file) | Used by |
|---|---|---|
| Business | name, category, description ("what it does"), photo, service area, working days/time, status (active/paused) | A2, B1, B2 |
| Product | name, quantity, price, stock, photo, type (pickle/papad/ghee/vegetable/service) | A2, A4, A5, A16, B2, B3, B5 |
| Order | product(s), buyer, seller, status pipelines as listed | A2, A6, A16, B2, B4 |
| Demand (buy requirement) | product name, quantity, expected price, needed-by date, status (open/offer/accepted/declined) | A5, B3 |
| Enquiry/Requirement | product, quantity, message, status (pending/responded) | A2, B2, B5 |
| Garden crop | vegetable, nutrition tags, stage (sowing→sprout→vegetative→flowering→harvest), season, water/fertilizer reminders, yield log | A1, A3, A7, A19 |
| Diary note | name, quantity, price, Buy/Sell, date | A11 |
| Rating/Review | rating value, review text, reply, from/to (woman ↔ farmer buyer) | A2, A16, A20, B1, B2 |
| Ad | product, target village/district | A8 |
| Referral | referral code, rewards, referred users | A12 |
| Coins | balance, earn history, redeem history | A13 |
| Land record | 7/12 PDF linked to profile | A18 |
| Notification | type (deposit due, vaccination due, loan approve/repay, order/payment) | A1, A21 |

**Status pipelines (exactly as in file):**
- Woman's order tracking: `packed → pickup → in transit → delivered`
- Farmer's order tracking: `placed → accepted → packed → pickup → in transit → delivered` (cancel allowed before `accepted`)
- Crop growth: `sowing → sprout → vegetative → flowering → harvest`
- Enquiry: `pending → responded`
- Demand: `open → offer made → accepted / declined`

## Explicitly out of scope (not in the file — do not add)

- Online payment gateway / UPI / card payments (file says "order/payment **alerts**", not payment processing).
- Phone-number exposure or calls/SMS/WhatsApp (file says in-app chat only, no external apps).
- Any feature not listed above (e.g., logistics booking, weather, mandi prices, insurance, etc.).
- Changes to the file's feature definitions, field names, or statuses.

## Assumptions (to confirm before implementation)

1. These screens live inside the existing Agrovercity app (backend `backend/app`, web `website`, admin `superadmin`), reusing its auth and data layer — no new external services.
2. "NEW" tags in Part B mean those farmer-facing screens do not exist yet; Part A screens exist in some form and need to be completed/corrected to match the file exactly.
3. Distance filter (B1) uses location data already on the platform; no external maps API is added by this spec.
4. AI Analysis (A7) reads only in-platform data listed in the file (savings, loans, garden, livestock, enterprise).

---

## Implementation status (2026-11-23)

### Built this pass (backend `women_businesses.py` + `women.py` extensions, all registered in `main.py`)

| xlsx item | What was built | Verification |
|---|---|---|
| A2 My Business & Management | `women_businesses` collection + full CRUD (`POST/GET/PUT /v1/women/businesses`, pause/resume, DELETE w/ cascade), search `q`, per-business products/orders/enquiries/ratings in `GET /v1/women/businesses/{id}` | 22 new tests in `backend/tests/test_women_hub_businesses.py` |
| B1 Discover Women Hub Businesses (NEW) | `GET /v1/women-hub/businesses` — browse/search, `category` + `distanceKm` (haversine on owner profile coords) filters, cards = photo/name/category/rating/location | tests: cards, filters incl. distance |
| B2 Business Profile / Store (NEW) | `GET /v1/women-hub/businesses/{id}` — description, products (photo/price/stock, out-of-stock hidden), ratings & reviews, working days/time, Enquire/Order/Chat; **no phone number exposed** | test asserts no phone in payload |
| B5 post requirement | `POST /v1/women-hub/businesses/{id}/enquiries` (product+quantity+message), `GET /v1/women-hub/enquiries` history, woman responds → `pending`/`responded` | tests: full pending→responded flow |
| A6/B4 My Orders & Track | `women_business_orders` with exact pipelines: farmer `placed→accepted→packed→pickup→in_transit→delivered`, woman fulfils from `packed`; cancel only before acceptance (stock restored) | tests: full pipeline, invalid transitions, cancel rules |
| A3 Kitchen Garden Planner | `garden_crops`: stage tracker `sowing→sprout→vegetative→flowering→harvest` (validated), season, water/fertilizer reminders (due list feeds dashboard), yield log | tests: lifecycle, invalid stage, reminders, yield |
| A4 Home Enterprise Income | lines extended with quantity+price; `home_enterprise_months` (profit = revenue − cost per product per month), `home_enterprise_expenses`; auto monthly total (`GET /v1/women/home-enterprise/ledger`), profit graph (`/graph`), CSV export (`/export`) | tests: ledger math, expenses reduce total, graph, CSV content-type |
| A1 Dashboard | `/v1/women/dashboard` now includes `businesses.count/activeCount` + `calendar` (Indian/Saka date, computed in-app ±1 day) | test asserts both blocks |
| A7 AI Analysis | `/v1/women/insights` garden block now includes `yieldPrediction` (avg yield per crop × active crops, deterministic) | test asserts prediction values |

### Frontend (website)

- API client: `website/src/lib/api/womenHub.ts` (exported from `lib/api/index.ts`).
- Woman side: `views/women/MyBusinessesView.tsx` (`/women/hub/businesses`), `GardenPlannerView.tsx` (`/women/hub/garden`), `EnterpriseIncomeView.tsx` (`/women/hub/enterprise`); routes in `views/women/routes.tsx`; sidebar entries under womenShg persona.
- Farmer side: `views/farmer/WomenHubDirectoryView.tsx` (`/farmer/women-hub`), `WomenHubBusinessProfileView.tsx` (`/farmer/women-hub/businesses/:id` — Enquire/Order/Chat, Chat opens in-app room via `/chat/direct`), `WomenHubOrdersView.tsx` (`/farmer/women-hub/orders` — pipeline tracker + requirements tab); routes in `views/farmer/routes.tsx`; sidebar entries under farmer persona.
- Verified: `npm run build` (tsc + vite) passes; 43 backend tests green (22 new + 21 existing women tests, no regressions).

### Already covered by existing platform modules (not rebuilt, per "no external features")

Demand Board offers/chat (A5/B3, `demands.py`+`offers.py`+`chat.py`), Ads (A8, `ads.py`), Gyansetu (A9, `courses.py`/`gyan.py`), Agri News (A10, `content.py`), Diary (A11, `diary.py`), Refer & Earn (A12, `referrals.py`), Coin Rewards (A13, `gamification.py`), Tree Hub (A14, `tree.py`/`nursery.py`), Agri Market (A15, `marketplace.py`/`wishlist.py`), My Seller Store (A16, `seller_products.py`/`user_products.py`), Finance CEO (A17, `finance.py`/`pnl.py`), 7/12 & Land Records (A18, `land_records.py`), Chatbot (A19, `chatbot.py`), Ratings & Reviews platform-wide (A20, `ratings.py`), Notifications (A21, `notifications.py`), farmer↔woman Chat (B6, `chat.py`).

### Not built (needs your call)

- A2's "orders" for a business currently come only from the new Women Hub order flow; e-market orders into the same business view are not merged (xlsx says order list "from farmers/e-market").
- The woman-side Dashboard UI widget wiring (backend fields are ready; the community WomenGruhUdyogView dashboard does not yet render `businesses`/`calendar` blocks).
