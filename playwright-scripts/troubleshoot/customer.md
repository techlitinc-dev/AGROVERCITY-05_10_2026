# Troubleshoot — E-Market Customer

> Persona: **E-Market Customer** (customer)
> Roleplay: PW Test Customer, agri-mall buyer browsing produce, mall catalog and academy courses.
> Target: http://localhost:5173 · Walked: 2026-11-02T18:02:44.564Z

## Login recipe used by the test

- Mode: `onboard` — +919100000107
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 15 ✅ pass · 0 ⚠️ warn · 3 ❌ fail (18 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/customer` | ✅ | — | 0 | — | `customer/screenshots/00-customer.png` |
| `/customer/orders` | ✅ | — | 0 | — | `customer/screenshots/01-customer_orders.png` |
| `/customer/subscriptions` | ✅ | — | 0 | — | `customer/screenshots/02-customer_subscriptions.png` |
| `/customer/wallet` | ✅ | — | 0 | — | `customer/screenshots/03-customer_wallet.png` |
| `/customer/demands` | ✅ | — | 0 | — | `customer/screenshots/04-customer_demands.png` |
| `/customer/quotes` | ✅ | — | 0 | — | `customer/screenshots/05-customer_quotes.png` |
| `/customer/procurements` | ✅ | — | 0 | — | `customer/screenshots/06-customer_procurements.png` |
| `/customer/produce` | ✅ | — | 0 | — | `customer/screenshots/07-customer_produce.png` |
| `/customer/seasonal` | ✅ | — | 0 | — | `customer/screenshots/08-customer_seasonal.png` |
| `/customer/diary` | ✅ | — | 0 | — | `customer/screenshots/09-customer_diary.png` |
| `/customer/finance` | ✅ | — | 0 | — | `customer/screenshots/10-customer_finance.png` |
| `/customer/coins` | ✅ | — | 0 | — | `customer/screenshots/11-customer_coins.png` |
| `/customer/news` | ✅ | — | 0 | — | `customer/screenshots/12-customer_news.png` |
| `/customer/trees` | ✅ | — | 0 | — | `customer/screenshots/13-customer_trees.png` |
| `/customer/712` | ❌ | page looks blank (only 0 chars of text); uncaught exception: TypeError: Cannot read properties of undefined (reading 'join'); console.error ×1: The above error occurred in the <LandRecordsView> component:      at LandRecordsView (http://localhost:5173/src/views/farmer/LandRecordsView | 1 | — | `customer/screenshots/14-customer_712.png` |
| `/mall` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/gruh-udyog/categories (403) | 1 | 403 /v1/gruh-udyog/categories<br>403 /v1/gruh-udyog/categories | `customer/screenshots/15-mall.png` |
| `/academy` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×3: GET http://localhost:5173/v1/teachers/home (403) | 1 | 403 /v1/teachers/home<br>403 /v1/teachers/home<br>net::ERR_BLOCKED_BY_ORB /photo-1527153857715-3908f2ae5e81?w=800&q=80 | `customer/screenshots/16-academy.png` |
| `/academy/my-learning` | ✅ | — | 0 | — | `customer/screenshots/17-academy_my-learning.png` |

## Failures — evidence & likely cause

### ❌ `/customer/712` — page looks blank (only 0 chars of text)

- Final URL: /customer/712 · content: 0 chars · load: 5215ms
- Screenshot: `results/customer/screenshots/14-customer_712.png`
- console.error: `The above error occurred in the <LandRecordsView> component:      at LandRecordsView (http://localhost:5173/src/views/farmer/LandRecordsView.tsx?t=1793513768618:24:41)     at RenderedRoute (http://loc` at http://localhost:5173/node_modules/.vite/deps/chunk-OEMKBGIU.js?v=13b937fd:14031
- **Likely cause / first fix to try:** React render crash or empty data path. Reproduce manually, read the uncaught exception above, and check the view component for unguarded undefined (optional chaining) around API data.

### ❌ `/customer/712` — uncaught exception: TypeError: Cannot read properties of undefined (reading 'join')

- Final URL: /customer/712 · content: 0 chars · load: 5215ms
- Screenshot: `results/customer/screenshots/14-customer_712.png`
- console.error: `The above error occurred in the <LandRecordsView> component:      at LandRecordsView (http://localhost:5173/src/views/farmer/LandRecordsView.tsx?t=1793513768618:24:41)     at RenderedRoute (http://loc` at http://localhost:5173/node_modules/.vite/deps/chunk-OEMKBGIU.js?v=13b937fd:14031
- **Likely cause / first fix to try:** See the console/network evidence for this row; reproduce manually on the route with DevTools open.

### ❌ `/customer/712` — console.error ×1: The above error occurred in the <LandRecordsView> component:      at LandRecordsView (http://localhost:5173/src/views/farmer/LandRecordsView

- Final URL: /customer/712 · content: 0 chars · load: 5215ms
- Screenshot: `results/customer/screenshots/14-customer_712.png`
- console.error: `The above error occurred in the <LandRecordsView> component:      at LandRecordsView (http://localhost:5173/src/views/farmer/LandRecordsView.tsx?t=1793513768618:24:41)     at RenderedRoute (http://loc` at http://localhost:5173/node_modules/.vite/deps/chunk-OEMKBGIU.js?v=13b937fd:14031
- **Likely cause / first fix to try:** Application code logged an error (failed fetch, unhandled rejection). Open the screenshot, then reproduce with DevTools console to find the call site.

### ❌ `/mall` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /mall · content: 1025 chars · load: 5442ms
- Screenshot: `results/customer/screenshots/15-mall.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/gruh-udyog/categories:0
- network: GET http://localhost:5173/v1/gruh-udyog/categories → 403
- network: GET http://localhost:5173/v1/gruh-udyog/categories → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/mall` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/gruh-udyog/categories (403)

- Final URL: /mall · content: 1025 chars · load: 5442ms
- Screenshot: `results/customer/screenshots/15-mall.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/gruh-udyog/categories:0
- network: GET http://localhost:5173/v1/gruh-udyog/categories → 403
- network: GET http://localhost:5173/v1/gruh-udyog/categories → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/academy` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /academy · content: 2874 chars · load: 2988ms
- Screenshot: `results/customer/screenshots/16-academy.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/teachers/home:0
- network: GET http://localhost:5173/v1/teachers/home → 403
- network: GET http://localhost:5173/v1/teachers/home → 403
- network: GET https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=800&q=80 → net::ERR_BLOCKED_BY_ORB
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/academy` — HTTP >=400 / failed requests ×3: GET http://localhost:5173/v1/teachers/home (403)

- Final URL: /academy · content: 2874 chars · load: 2988ms
- Screenshot: `results/customer/screenshots/16-academy.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/teachers/home:0
- network: GET http://localhost:5173/v1/teachers/home → 403
- network: GET http://localhost:5173/v1/teachers/home → 403
- network: GET https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=800&q=80 → net::ERR_BLOCKED_BY_ORB
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "customer"
npm run report   # regenerate this doc
```
