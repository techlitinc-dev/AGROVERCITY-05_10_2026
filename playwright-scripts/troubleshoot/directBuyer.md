# Troubleshoot — Industrial / Direct Buyer

> Persona: **Industrial / Direct Buyer** (directBuyer)
> Roleplay: Shree Foods Pvt Ltd, processor posting bulk escrow demands and running gate QC.
> Target: http://localhost:5173 · Walked: 2026-11-02T18:01:32.516Z

## Login recipe used by the test

- Mode: `quick-login` — directBuyer
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 14 ✅ pass · 0 ⚠️ warn · 1 ❌ fail (15 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/directBuyer` | ✅ | — | 0 | — | `directBuyer/screenshots/00-directBuyer.png` |
| `/directBuyer/demands` | ✅ | — | 0 | — | `directBuyer/screenshots/01-directBuyer_demands.png` |
| `/directBuyer/qc` | ✅ | — | 0 | — | `directBuyer/screenshots/02-directBuyer_qc.png` |
| `/directBuyer/requirements` | ✅ | — | 0 | — | `directBuyer/screenshots/03-directBuyer_requirements.png` |
| `/directBuyer/requirements/new` | ✅ | — | 0 | — | `directBuyer/screenshots/04-directBuyer_requirements_new.png` |
| `/directBuyer/applications` | ✅ | — | 0 | — | `directBuyer/screenshots/05-directBuyer_applications.png` |
| `/directBuyer/suppliers` | ✅ | — | 0 | — | `directBuyer/screenshots/06-directBuyer_suppliers.png` |
| `/directBuyer/contracts` | ✅ | — | 0 | — | `directBuyer/screenshots/07-directBuyer_contracts.png` |
| `/directBuyer/intel` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 422 (Unprocessable Content); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/mandi/forecast (422) | 1 | 422 /v1/mandi/forecast<br>422 /v1/mandi/forecast | `directBuyer/screenshots/08-directBuyer_intel.png` |
| `/directBuyer/offers` | ✅ | — | 0 | — | `directBuyer/screenshots/09-directBuyer_offers.png` |
| `/directBuyer/feed` | ✅ | — | 0 | — | `directBuyer/screenshots/10-directBuyer_feed.png` |
| `/directBuyer/standing` | ✅ | — | 0 | — | `directBuyer/screenshots/11-directBuyer_standing.png` |
| `/directBuyer/analytics` | ✅ | — | 0 | — | `directBuyer/screenshots/12-directBuyer_analytics.png` |
| `/directBuyer/team` | ✅ | — | 0 | — | `directBuyer/screenshots/13-directBuyer_team.png` |
| `/directBuyer/org` | ✅ | — | 0 | — | `directBuyer/screenshots/14-directBuyer_org.png` |

## Failures — evidence & likely cause

### ❌ `/directBuyer/intel` — console.error ×1: Failed to load resource: the server responded with a status of 422 (Unprocessable Content)

- Final URL: /directBuyer/intel · content: 578 chars · load: 5817ms
- Screenshot: `results/directBuyer/screenshots/08-directBuyer_intel.png`
- console.error: `Failed to load resource: the server responded with a status of 422 (Unprocessable Content)` at http://localhost:5173/v1/mandi/forecast:0
- network: GET http://localhost:5173/v1/mandi/forecast → 422
- network: GET http://localhost:5173/v1/mandi/forecast → 422
- **Likely cause / first fix to try:** Application code logged an error (failed fetch, unhandled rejection). Open the screenshot, then reproduce with DevTools console to find the call site.

### ❌ `/directBuyer/intel` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/mandi/forecast (422)

- Final URL: /directBuyer/intel · content: 578 chars · load: 5817ms
- Screenshot: `results/directBuyer/screenshots/08-directBuyer_intel.png`
- console.error: `Failed to load resource: the server responded with a status of 422 (Unprocessable Content)` at http://localhost:5173/v1/mandi/forecast:0
- network: GET http://localhost:5173/v1/mandi/forecast → 422
- network: GET http://localhost:5173/v1/mandi/forecast → 422
- **Likely cause / first fix to try:** See the console/network evidence for this row; reproduce manually on the route with DevTools open.

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "directBuyer"
npm run report   # regenerate this doc
```
