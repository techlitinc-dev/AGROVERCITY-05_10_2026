# E-Market Seller — Implementation Instructions

**Source document:** `Agri_market_seller 21 nov.xlsx` (Sheet1, single section: *"E-Market seller can see these pages"*, columns `Sr. no. | Pages | Data`).

**Scope rules (as instructed):**
1. Every feature below is taken **only** from `Agri_market_seller 21 nov.xlsx`. No external/third-party features are added.
2. The features described in the file are **not altered, extended, or re-interpreted** — they are implemented exactly as written. Fields, statuses, and buttons are the ones named in the file.
3. Where the file is silent (tech stack, auth, hosting), reuse the existing Agrovercity platform conventions — not new external services. Where the file says *"reuse existing module"*, map to the existing backend module (named per feature below).

**Numbering note:** In the file's list, Sr. no. 21 is absent (1–20, then 22–27). The numbering below keeps the file's own Sr. no. so the doc maps 1:1 to the sheet. Sr. 21 is a gap in the source file, not an omission to "fix".

---

## Seller-facing pages

### 1. Seller Profile & Shop KYC (Sr. 1.0)
File says: Shop name, bank details, delivery area, pickup address, documents (source inventory). Note: KYC/verification workflow is excluded from this module; reuse existing profile/business data and do not build new KYC.

Implementation:
- Shop profile screen holding exactly: **shop name, bank details, delivery area, pickup address, documents**.
- Per the file's note: **no new KYC/verification workflow** — reuse existing profile/business data and existing verification artifacts (backend `registration.py`, `users.py`, `bank_accounts.py`, `vault.py`).

### 2. Seller Dashboard (Sr. 2.0)
File says: Revenue, orders received, product stats, ad performance, alerts; marketplace KPIs including enquiries, pending quotations, low stock and order status.

Implementation:
- Single dashboard screen with widgets: **revenue, orders received, product stats, ad performance, alerts**.
- Marketplace KPI strip: **enquiries, pending quotations, low stock, order status** — each tile deep-links into its module.

### 3. My Products / Inventory (Sr. 3.0)
File says: Product catalog: title, photos, price, stock, category, status; variants, units, specifications, MOQ, batch/expiry and compliance attributes where applicable.

Implementation:
- Catalog CRUD with exactly: **title, photos, price, stock, category, status**.
- Per product: **variants, units, specifications, MOQ**; **batch/expiry and compliance attributes where applicable** (optional fields, not mandatory).
- Extends existing `seller_products.py` / `user_products.py` + `specs.py`.

### 4. Stock Management (Sr. 4.0)
File says: Stock in/out entries, low-stock alerts, availability, reserved stock, stock movements and stock adjustment history.

Implementation:
- **Stock in/out entries**; per-product **availability** and **reserved stock** counters.
- **Low-stock alerts**; **stock movements** log; **stock adjustment history**.
- Feeds the **low stock** KPI on the Dashboard (Sr. 2) and the **low stock** alert in the Notification Center (Sr. 20).

### 5. Orders Received (Sr. 5.0)
File says: Accept/reject, process, pack, ship, deliver, cancellation handling and invoice download.

Implementation:
- Order list + detail with actions exactly: **accept / reject**, progression **process → pack → ship → deliver**, **cancellation handling**, **invoice download**.
- Statuses named by the file: accept/reject, process, pack, ship, deliver, cancelled. Align these labels with the existing order engine (`orders.py`, `order_tracking.py`, `emarket_customer.py`) — the file's words stay in the UI.

### 6. Offers & Discounts (Sr. 6.0)
File says: Seller offers, coupon codes, validity, usage stats, bulk/quantity pricing and discount rules.

Implementation:
- **Seller offers** and **coupon codes** with **validity** window and **usage stats**.
- **Bulk/quantity pricing** and **discount rules**.
- Reuse/extend existing `coupons.py` and `offers.py`.

### 7. Earnings & Payouts (Sr. 7.0)
File says: Sales revenue, commission deduction, payout history; reconcile with existing payment/settlement system.

Implementation:
- Earnings screen with exactly: **sales revenue, commission deduction, payout history**.
- File constraint: **reconcile with the existing payment/settlement system** — no new payment provider (backend `payments.py`, `settlements.py`, `purchase_settlement.py`, `escrow.py`).

### 8. Advertisement Manager (Sr. 8.0)
File says: Campaigns to promote shop/products, targeting, performance; integrate existing ad approval flow.

Implementation:
- Ad campaigns to promote **shop/products** with **targeting** selector and **performance** stats.
- Integrate the **existing ad approval flow** (backend `ads.py` + `services/approvals.py`).

### 9. AI Analysis (Sr. 9.0)
File says: Demand forecast, pricing suggestions, sales insights; use only after reliable marketplace data is available.

Implementation:
- Three analysis blocks computed from the seller's own marketplace data only: **demand forecast**, **pricing suggestions**, **sales insights**.
- File constraint: enable **only after reliable marketplace data is available** — in-platform AI layer (`intelligence.py`, `demand_forecast.py`, `fair_price.py`, `services/seller_ai.py`, `services/seller_forecast.py`), no external AI service.

### 10. Farm Diary (Sr. 10.0)
File says: Daily activity log, expense/income entries, photos; existing shared module, not core marketplace dependency.

Implementation:
- Reuse existing shared diary module (`diary.py` + `diary_analytics.py`): **daily activity log, expense/income entries, photos**.
- Not a core dependency of the marketplace flow.

### 11. Gyansetu Learning Hub (Sr. 11.0)
File says: Courses, videos, articles, progress tracking; reuse existing learning module.

Implementation:
- Reuse existing learning module (`courses.py`, `gyan.py`, `teachers.py`): **courses, videos, articles, progress tracking**.

### 12. Agri News (Sr. 12.0)
File says: Category-wise agricultural news and schemes; reuse existing content module.

Implementation:
- Reuse existing content module (`content.py`): **category-wise agricultural news and schemes**.

### 13. Refer & Earn (Sr. 13.0)
File says: Referral code, share links, referred users, reward status; reuse existing rewards module.

Implementation:
- Reuse existing rewards module (`referrals.py`): **referral code, share links, referred users, reward status**.

### 14. Coin Rewards – Krushi Ratna (Sr. 14.0)
File says: Coin balance, earn/redeem history, redemption catalog; reuse existing rewards module.

Implementation:
- Reuse existing rewards module (`gamification.py` + `services/coins.py`): **coin balance, earn/redeem history, redemption catalog**.

### 15. Tree Hub (Sr. 15.0)
File says: Plantation records, growth tracking, verification status; reuse existing Tree Hub module.

Implementation:
- Reuse existing Tree Hub module (`tree.py`, `nursery.py`): **plantation records, growth tracking, verification status**.

### 16. E-Market Shopping (Sr. 16.0)
File says: Agricultural inputs and products catalog, cart; clarify whether seller can also shop as a farmer persona or whether this is a separate shared page.

Implementation:
- Shopping catalog of **agricultural inputs and products** with **cart**.
- The file itself flags an **open question — can the seller also shop as a farmer persona, or is this a separate shared page?** Until confirmed: reuse the existing customer shopping pages (`marketplace.py`, `emarket_customer.py`, `wishlist.py`); build no new seller-only catalog.

### 17. Profit & Loss (Sr. 17.0)
File says: Shop P&L, cash flow, expenses, party ledgers; reuse existing accounting functionality if available.

Implementation:
- Reuse existing accounting (`pnl.py`, `finance.py`): **shop P&L, cash flow, expenses, party ledgers**.
- File says *"if available"* — if an existing accounting module already covers these, surface it scoped to the shop; no new accounting engine.

### 18. 7/12 & Land Records (Sr. 18.0)
File says: Land records linked to profile; unrelated to core seller marketplace transaction flow; reuse existing module.

Implementation:
- Reuse existing module (`land.py`): **land records linked to profile** only.
- Explicitly **outside the seller transaction flow** — a profile-linked utility, per the file.

### 19. Chatbot (Sr. 19.0)
File says: AI chat for selling, schemes and feature queries; reuse existing chatbot; not a substitute for farmer-seller chat.

Implementation:
- Reuse existing chatbot (`chatbot.py`) answering **selling, schemes and feature queries**.
- File constraint: **not a substitute for farmer-seller chat** — that remains the in-app chat module (`chat.py`).

### 20. Notification Center (Sr. 20.0)
File says: Alerts: new orders, payouts, ad approvals; add enquiries, messages, quotations, low stock and cancellations.

Implementation:
- Notification center producing exactly these alert types: **new orders, payouts, ad approvals** + **enquiries, messages, quotations, low stock, cancellations** (backend `notifications.py` + `services/notify.py` / `services/fcm.py`).

### 22. Enquiry Management (Sr. 22.0)
File says: Farmer enquiries, requested quantity, product context, response status and conversion to quotation/order.

Implementation:
- Enquiry inbox: **farmer enquiries** each with **requested quantity** and **product context**.
- **Response status** per enquiry; actions **convert to quotation** / **convert to order**.

### 23. Quotation Management (Sr. 23.0)
File says: Quotation number, items, unit price, quantity, discounts, taxes, delivery, validity and status.

Implementation:
- Quotation records with exactly: **quotation number, items, unit price, quantity, discounts, taxes, delivery, validity, status**.
- Quotations originate from Enquiry conversion (Sr. 22); accepted quotations become orders (Sr. 5).

### 24. Bulk Pricing & Product Variants (Sr. 24.0)
File says: Variant-specific pricing, quantity slabs, minimum/maximum order quantities and units.

Implementation:
- Pricing editor with: **variant-specific pricing**, **quantity slabs**, **minimum/maximum order quantities**, **units**.
- Same underlying variant/unit/bulk fields as Sr. 3 (products) and Sr. 6 (bulk/quantity pricing) — this is the dedicated pricing view on those fields, nothing new.

### 25. Delivery & Dispatch (Sr. 25.0)
File says: Packing, dispatch date, delivery partner/reference and tracking status where available.

Implementation:
- Dispatch screen: **packing** confirmation, **dispatch date**, **delivery partner/reference**, **tracking status where available** (optional where the platform has no tracking source).
- Fulfillment detail of the order flow (Sr. 5) — the pack/ship steps link here.

### 26. Customer Reviews (Sr. 26.0)
File says: View verified-purchase reviews and submit seller response subject to moderation rules.

Implementation:
- Reviews list showing **verified-purchase reviews only**.
- Seller can **submit a response** to a review; the response is held **subject to moderation rules** before display (`ratings.py` + moderation via `services/chat_moderation.py`-style rules).

### 27. Sales Reports (Sr. 27.0)
File says: Daily/monthly sales, top products, order status, discounts, cancellations, returns and revenue.

Implementation:
- Reports screen with exactly: **daily/monthly sales, top products, order status** breakdown, **discounts, cancellations, returns, revenue** (`analytics.py` + `services/reports.py`).

---

## Cross-cutting data implied by the file (shared entities)

These entities connect the listed features; fields are only those the file names:

| Entity | Fields (from file) | Used by |
|---|---|---|
| Shop profile | shop name, bank details, delivery area, pickup address, documents | 1 |
| Product | title, photos, price, stock, category, status, variants, units, specifications, MOQ, batch/expiry, compliance attributes | 2, 3, 4, 24, 27 |
| Stock ledger | in/out entries, availability, reserved stock, movements, adjustment history | 2, 4, 20 |
| Order | items, status (accept/reject, process, pack, ship, deliver, cancelled), invoice download | 2, 5, 20, 25, 27 |
| Offer / coupon | offer, coupon code, validity, usage stats, bulk/quantity pricing, discount rules | 2, 6 |
| Payout | sales revenue, commission deduction, payout history | 2, 7, 20 |
| Ad campaign | shop/product promoted, targeting, performance, approval status | 2, 8, 20 |
| Enquiry | farmer, requested quantity, product context, response status | 2, 20, 22 |
| Quotation | quotation number, items, unit price, quantity, discounts, taxes, delivery, validity, status | 2, 20, 22, 23 |
| Dispatch | packing, dispatch date, delivery partner/reference, tracking status | 5, 25 |
| Review | verified-purchase flag, review text, seller response, moderation status | 26 |
| Notification | type: new order, payout, ad approval, enquiry, message, quotation, low stock, cancellation | 20 |

**Status pipelines (as named in the file):**
- Order: `accept → process → pack → ship → deliver`, with `reject` at acceptance and **cancellation handling**.
- Enquiry: **response status**, convertible to quotation or order.
- Quotation: **status** + **validity** window; originates from enquiry, accepted ones become orders.
- Stock: availability vs **reserved stock**; low-stock threshold triggers alert.

## Explicitly out of scope (not in the file — do not add)

- **New KYC/verification workflow** — the file explicitly excludes it from this module.
- **New payment gateway or settlement engine** — the file says reconcile with the existing payment/settlement system.
- **External AI services** — AI Analysis uses only in-platform marketplace data, and only once that data is reliable.
- **External chat/communication apps or phone-number exposure** — chatbot is not a substitute for farmer-seller chat; platform chat stays in-app.
- **Any feature not listed above** (e.g., auctions/bidding, multi-warehouse management, tax filing, courier-aggregator booking, seller loans/insurance).

## Assumptions (to confirm before implementation)

1. These screens live inside the existing Agrovercity app (backend `backend/app`, web `website`, admin `superadmin`), reusing its auth and data layer — no new external services.
2. The existing marketplace order engine (`emarket_customer.py`, `orders.py`, `order_tracking.py`) is the same flow the seller "orders received" screens read/write; the file's step labels (process/pack/ship/deliver) are the UI labels on that engine.
3. **E-Market Shopping (Sr. 16)** needs a product decision per the file's own note — seller shops under the farmer persona vs a separate shared page. Until decided, reuse existing customer shopping pages.
4. **Sr. 21 is absent from the file**; the gap is preserved as-is.
5. **AI Analysis (Sr. 9)** ships only after marketplace data volume is reliable — the file's own precondition.
6. Where the file says *"where applicable"* / *"where available"* (compliance attributes, tracking status), implement as optional fields, not mandatory.
