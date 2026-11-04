# Troubleshoot — Plant Nursery

> Persona: **Plant Nursery** (nursery)
> Roleplay: PW Test Nursery, plant nursery owner managing inventory, batches and orders.
> Target: http://localhost:5173 · Walked: 2026-11-02T18:02:22.591Z

## Login recipe used by the test

- Mode: `onboard` — +919100000106
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 15 ✅ pass · 0 ⚠️ warn · 4 ❌ fail (19 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/nursery` | ✅ | — | 0 | — | `nursery/screenshots/00-nursery.png` |
| `/nursery/profile` | ✅ | — | 0 | — | `nursery/screenshots/01-nursery_profile.png` |
| `/nursery/inventory` | ✅ | — | 0 | — | `nursery/screenshots/02-nursery_inventory.png` |
| `/nursery/batches` | ✅ | — | 0 | — | `nursery/screenshots/03-nursery_batches.png` |
| `/nursery/orders` | ✅ | — | 0 | — | `nursery/screenshots/04-nursery_orders.png` |
| `/nursery/ratings` | ✅ | — | 0 | — | `nursery/screenshots/05-nursery_ratings.png` |
| `/nursery/offers` | ✅ | — | 0 | — | `nursery/screenshots/06-nursery_offers.png` |
| `/nursery/payouts` | ✅ | — | 0 | — | `nursery/screenshots/07-nursery_payouts.png` |
| `/nursery/ai` | ✅ | — | 0 | — | `nursery/screenshots/08-nursery_ai.png` |
| `/nursery/diary` | ✅ | — | 0 | — | `nursery/screenshots/09-nursery_diary.png` |
| `/nursery/finance` | ✅ | — | 0 | — | `nursery/screenshots/10-nursery_finance.png` |
| `/nursery/shop` | ✅ | — | 0 | — | `nursery/screenshots/11-nursery_shop.png` |
| `/nursery/gyan` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×3: GET http://localhost:5173/v1/teachers/home (403) | 1 | 403 /v1/teachers/home<br>403 /v1/teachers/home<br>net::ERR_BLOCKED_BY_ORB /photo-1527153857715-3908f2ae5e81?w=800&q=80 | `nursery/screenshots/12-nursery_gyan.png` |
| `/nursery/news` | ✅ | — | 0 | — | `nursery/screenshots/13-nursery_news.png` |
| `/nursery/coins` | ✅ | — | 0 | — | `nursery/screenshots/14-nursery_coins.png` |
| `/nursery/referrals` | ✅ | — | 0 | — | `nursery/screenshots/15-nursery_referrals.png` |
| `/nursery/trees` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×6: GET http://localhost:5173/v1/tree/sapling-requests/mine (403) | 1 | 403 /v1/tree/sapling-requests/mine<br>403 /v1/tree/plantations/mine<br>403 /v1/tree/articles<br>403 /v1/tree/sapling-requests/mine<br>403 /v1/tree/plantations/mine<br>403 /v1/tree/articles | `nursery/screenshots/16-nursery_trees.png` |
| `/nursery/land-records` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/land-records/search (403) | 1 | 403 /v1/land-records/search<br>403 /v1/land-records/search | `nursery/screenshots/17-nursery_land-records.png` |
| `/nursery/settings` | ❌ | console.error ×2: Failed to load resource: the server responded with a status of 404 (Not Found); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/users/me/data-export/latest (404) | 2 | 404 /v1/users/me/data-export/latest<br>404 /v1/users/me/data-export/latest | `nursery/screenshots/18-nursery_settings.png` |

## Failures — evidence & likely cause

### ❌ `/nursery/gyan` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /nursery/gyan · content: 2101 chars · load: 6955ms
- Screenshot: `results/nursery/screenshots/12-nursery_gyan.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/teachers/home:0
- network: GET http://localhost:5173/v1/teachers/home → 403
- network: GET http://localhost:5173/v1/teachers/home → 403
- network: GET https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=800&q=80 → net::ERR_BLOCKED_BY_ORB
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/nursery/gyan` — HTTP >=400 / failed requests ×3: GET http://localhost:5173/v1/teachers/home (403)

- Final URL: /nursery/gyan · content: 2101 chars · load: 6955ms
- Screenshot: `results/nursery/screenshots/12-nursery_gyan.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/teachers/home:0
- network: GET http://localhost:5173/v1/teachers/home → 403
- network: GET http://localhost:5173/v1/teachers/home → 403
- network: GET https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=800&q=80 → net::ERR_BLOCKED_BY_ORB
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/nursery/trees` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /nursery/trees · content: 1125 chars · load: 5668ms
- Screenshot: `results/nursery/screenshots/16-nursery_trees.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/tree/sapling-requests/mine:0
- network: GET http://localhost:5173/v1/tree/sapling-requests/mine → 403
- network: GET http://localhost:5173/v1/tree/plantations/mine → 403
- network: GET http://localhost:5173/v1/tree/articles → 403
- network: GET http://localhost:5173/v1/tree/sapling-requests/mine → 403
- network: GET http://localhost:5173/v1/tree/plantations/mine → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/nursery/trees` — HTTP >=400 / failed requests ×6: GET http://localhost:5173/v1/tree/sapling-requests/mine (403)

- Final URL: /nursery/trees · content: 1125 chars · load: 5668ms
- Screenshot: `results/nursery/screenshots/16-nursery_trees.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/tree/sapling-requests/mine:0
- network: GET http://localhost:5173/v1/tree/sapling-requests/mine → 403
- network: GET http://localhost:5173/v1/tree/plantations/mine → 403
- network: GET http://localhost:5173/v1/tree/articles → 403
- network: GET http://localhost:5173/v1/tree/sapling-requests/mine → 403
- network: GET http://localhost:5173/v1/tree/plantations/mine → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/nursery/land-records` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /nursery/land-records · content: 1195 chars · load: 2905ms
- Screenshot: `results/nursery/screenshots/17-nursery_land-records.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/land-records/search:0
- network: GET http://localhost:5173/v1/land-records/search → 403
- network: GET http://localhost:5173/v1/land-records/search → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/nursery/land-records` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/land-records/search (403)

- Final URL: /nursery/land-records · content: 1195 chars · load: 2905ms
- Screenshot: `results/nursery/screenshots/17-nursery_land-records.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/land-records/search:0
- network: GET http://localhost:5173/v1/land-records/search → 403
- network: GET http://localhost:5173/v1/land-records/search → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/nursery/settings` — console.error ×2: Failed to load resource: the server responded with a status of 404 (Not Found)

- Final URL: /nursery/settings · content: 1979 chars · load: 4358ms
- Screenshot: `results/nursery/screenshots/18-nursery_settings.png`
- console.error: `Failed to load resource: the server responded with a status of 404 (Not Found)` at http://localhost:5173/v1/users/me/data-export/latest:0
- console.error: `Warning: Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.%s   Check the render method of `SettingsPage`.       at button     at` at http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=13b937fd:63
- network: GET http://localhost:5173/v1/users/me/data-export/latest → 404
- network: GET http://localhost:5173/v1/users/me/data-export/latest → 404
- **Likely cause / first fix to try:** Endpoint not found: http://localhost:5173/v1/users/me/data-export/latest — router not registered in backend/app/main.py or path renamed. Compare with website/src/lib/api/* call sites.

### ❌ `/nursery/settings` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/users/me/data-export/latest (404)

- Final URL: /nursery/settings · content: 1979 chars · load: 4358ms
- Screenshot: `results/nursery/screenshots/18-nursery_settings.png`
- console.error: `Failed to load resource: the server responded with a status of 404 (Not Found)` at http://localhost:5173/v1/users/me/data-export/latest:0
- console.error: `Warning: Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.%s   Check the render method of `SettingsPage`.       at button     at` at http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=13b937fd:63
- network: GET http://localhost:5173/v1/users/me/data-export/latest → 404
- network: GET http://localhost:5173/v1/users/me/data-export/latest → 404
- **Likely cause / first fix to try:** Endpoint not found: http://localhost:5173/v1/users/me/data-export/latest — router not registered in backend/app/main.py or path renamed. Compare with website/src/lib/api/* call sites.

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "nursery"
npm run report   # regenerate this doc
```
