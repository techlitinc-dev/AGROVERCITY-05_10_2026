# Troubleshoot — Farmer / Kisan

> Persona: **Farmer / Kisan** (farmer)
> Roleplay: Ram Singh, grape & tomato farmer from Nashik checking mandi rates, posting produce lots and booking transport.
> Target: http://localhost:5173 · Walked: 2026-11-02T17:58:03.022Z

## Login recipe used by the test

- Mode: `quick-login` — farmer
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 29 ✅ pass · 0 ⚠️ warn · 2 ❌ fail (31 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/farmer` | ✅ | — | 0 | — | `farmer/screenshots/00-farmer.png` |
| `/farmer/crop-doctor` | ✅ | — | 0 | — | `farmer/screenshots/01-farmer_crop-doctor.png` |
| `/farmer/mandi` | ✅ | — | 0 | — | `farmer/screenshots/02-farmer_mandi.png` |
| `/farmer/lots` | ✅ | — | 0 | — | `farmer/screenshots/03-farmer_lots.png` |
| `/farmer/land` | ✅ | — | 0 | — | `farmer/screenshots/04-farmer_land.png` |
| `/farmer/demands` | ✅ | — | 0 | — | `farmer/screenshots/05-farmer_demands.png` |
| `/farmer/industrial` | ✅ | — | 0 | — | `farmer/screenshots/06-farmer_industrial.png` |
| `/farmer/industrial/applications` | ✅ | — | 0 | — | `farmer/screenshots/07-farmer_industrial_applications.png` |
| `/farmer/connections` | ✅ | — | 0 | — | `farmer/screenshots/08-farmer_connections.png` |
| `/farmer/transport` | ✅ | — | 0 | — | `farmer/screenshots/09-farmer_transport.png` |
| `/farmer/diary` | ✅ | — | 0 | — | `farmer/screenshots/10-farmer_diary.png` |
| `/farmer/pnl` | ✅ | — | 0 | — | `farmer/screenshots/11-farmer_pnl.png` |
| `/farmer/equipment` | ✅ | — | 0 | — | `farmer/screenshots/12-farmer_equipment.png` |
| `/farmer/loans` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 404 (Not Found); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/finance/kcc (404) | 1 | 404 /v1/finance/kcc<br>404 /v1/finance/kcc | `farmer/screenshots/13-farmer_loans.png` |
| `/farmer/bank-accounts` | ✅ | — | 0 | — | `farmer/screenshots/14-farmer_bank-accounts.png` |
| `/farmer/insurance` | ✅ | — | 0 | — | `farmer/screenshots/15-farmer_insurance.png` |
| `/farmer/insurance/policies` | ✅ | — | 0 | — | `farmer/screenshots/16-farmer_insurance_policies.png` |
| `/farmer/712` | ❌ | page looks blank (only 0 chars of text); uncaught exception: TypeError: Cannot read properties of undefined (reading 'join'); console.error ×1: The above error occurred in the <LandRecordsView> component:      at LandRecordsView (http://localhost:5173/src/views/farmer/LandRecordsView | 1 | — | `farmer/screenshots/17-farmer_712.png` |
| `/farmer/schemes` | ✅ | — | 0 | — | `farmer/screenshots/18-farmer_schemes.png` |
| `/farmer/water` | ✅ | — | 0 | — | `farmer/screenshots/19-farmer_water.png` |
| `/farmer/vault` | ✅ | — | 0 | — | `farmer/screenshots/20-farmer_vault.png` |
| `/farmer/referrals` | ✅ | — | 0 | — | `farmer/screenshots/21-farmer_referrals.png` |
| `/farmer/coins` | ✅ | — | 0 | — | `farmer/screenshots/22-farmer_coins.png` |
| `/farmer/dairy` | ✅ | — | 0 | — | `farmer/screenshots/23-farmer_dairy.png` |
| `/farmer/livestock` | ✅ | — | 0 | — | `farmer/screenshots/24-farmer_livestock.png` |
| `/farmer/crops` | ✅ | — | 0 | — | `farmer/screenshots/25-farmer_crops.png` |
| `/farmer/crop-plan` | ✅ | — | 0 | — | `farmer/screenshots/26-farmer_crop-plan.png` |
| `/farmer/export` | ✅ | — | 0 | — | `farmer/screenshots/27-farmer_export.png` |
| `/farmer/export/applications` | ✅ | — | 0 | — | `farmer/screenshots/28-farmer_export_applications.png` |
| `/farmer/export/connections` | ✅ | — | 0 | — | `farmer/screenshots/29-farmer_export_connections.png` |
| `/farmer/export/readiness` | ✅ | — | 0 | — | `farmer/screenshots/30-farmer_export_readiness.png` |

## Failures — evidence & likely cause

### ❌ `/farmer/loans` — console.error ×1: Failed to load resource: the server responded with a status of 404 (Not Found)

- Final URL: /farmer/loans · content: 1457 chars · load: 8105ms
- Screenshot: `results/farmer/screenshots/13-farmer_loans.png`
- console.error: `Failed to load resource: the server responded with a status of 404 (Not Found)` at http://localhost:5173/v1/finance/kcc:0
- network: GET http://localhost:5173/v1/finance/kcc → 404
- network: GET http://localhost:5173/v1/finance/kcc → 404
- **Likely cause / first fix to try:** Endpoint not found: http://localhost:5173/v1/finance/kcc — router not registered in backend/app/main.py or path renamed. Compare with website/src/lib/api/* call sites.

### ❌ `/farmer/loans` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/finance/kcc (404)

- Final URL: /farmer/loans · content: 1457 chars · load: 8105ms
- Screenshot: `results/farmer/screenshots/13-farmer_loans.png`
- console.error: `Failed to load resource: the server responded with a status of 404 (Not Found)` at http://localhost:5173/v1/finance/kcc:0
- network: GET http://localhost:5173/v1/finance/kcc → 404
- network: GET http://localhost:5173/v1/finance/kcc → 404
- **Likely cause / first fix to try:** Endpoint not found: http://localhost:5173/v1/finance/kcc — router not registered in backend/app/main.py or path renamed. Compare with website/src/lib/api/* call sites.

### ❌ `/farmer/712` — page looks blank (only 0 chars of text)

- Final URL: /farmer/712 · content: 0 chars · load: 2923ms
- Screenshot: `results/farmer/screenshots/17-farmer_712.png`
- console.error: `The above error occurred in the <LandRecordsView> component:      at LandRecordsView (http://localhost:5173/src/views/farmer/LandRecordsView.tsx?t=1793513768618:24:41)     at RenderedRoute (http://loc` at http://localhost:5173/node_modules/.vite/deps/chunk-OEMKBGIU.js?v=13b937fd:14031
- **Likely cause / first fix to try:** React render crash or empty data path. Reproduce manually, read the uncaught exception above, and check the view component for unguarded undefined (optional chaining) around API data.

### ❌ `/farmer/712` — uncaught exception: TypeError: Cannot read properties of undefined (reading 'join')

- Final URL: /farmer/712 · content: 0 chars · load: 2923ms
- Screenshot: `results/farmer/screenshots/17-farmer_712.png`
- console.error: `The above error occurred in the <LandRecordsView> component:      at LandRecordsView (http://localhost:5173/src/views/farmer/LandRecordsView.tsx?t=1793513768618:24:41)     at RenderedRoute (http://loc` at http://localhost:5173/node_modules/.vite/deps/chunk-OEMKBGIU.js?v=13b937fd:14031
- **Likely cause / first fix to try:** See the console/network evidence for this row; reproduce manually on the route with DevTools open.

### ❌ `/farmer/712` — console.error ×1: The above error occurred in the <LandRecordsView> component:      at LandRecordsView (http://localhost:5173/src/views/farmer/LandRecordsView

- Final URL: /farmer/712 · content: 0 chars · load: 2923ms
- Screenshot: `results/farmer/screenshots/17-farmer_712.png`
- console.error: `The above error occurred in the <LandRecordsView> component:      at LandRecordsView (http://localhost:5173/src/views/farmer/LandRecordsView.tsx?t=1793513768618:24:41)     at RenderedRoute (http://loc` at http://localhost:5173/node_modules/.vite/deps/chunk-OEMKBGIU.js?v=13b937fd:14031
- **Likely cause / first fix to try:** Application code logged an error (failed fetch, unhandled rejection). Open the screenshot, then reproduce with DevTools console to find the call site.

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "farmer"
npm run report   # regenerate this doc
```
