# Troubleshoot — Transporter / Gadi

> Persona: **Transporter / Gadi** (transporter)
> Roleplay: Rajesh Kumar, fleet owner running the FT-1 bilty desk from Nashik APMC hub.
> Target: http://localhost:5173 · Walked: 2026-11-02T17:58:35.192Z

## Login recipe used by the test

- Mode: `quick-login` — transport
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 7 ✅ pass · 0 ⚠️ warn · 5 ❌ fail (12 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/transporter` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 402 (Payment Required); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/transport/analytics (402) | 1 | 402 /v1/transport/analytics<br>402 /v1/transport/analytics | `transporter/screenshots/00-transporter.png` |
| `/transporter/loads` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 402 (Payment Required); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/transport/analytics (402) | 1 | 402 /v1/transport/analytics<br>402 /v1/transport/analytics | `transporter/screenshots/01-transporter_loads.png` |
| `/transporter/trips` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 402 (Payment Required); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/transport/analytics (402) | 1 | 402 /v1/transport/analytics<br>402 /v1/transport/analytics | `transporter/screenshots/02-transporter_trips.png` |
| `/transporter/bilty` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 402 (Payment Required); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/transport/analytics (402) | 1 | 402 /v1/transport/analytics<br>402 /v1/transport/analytics | `transporter/screenshots/03-transporter_bilty.png` |
| `/transporter/settlements` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 402 (Payment Required); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/transport/analytics (402) | 1 | 402 /v1/transport/analytics<br>402 /v1/transport/analytics | `transporter/screenshots/04-transporter_settlements.png` |
| `/transporter/inbox` | ✅ | — | 0 | — | `transporter/screenshots/05-transporter_inbox.png` |
| `/transporter/fleet` | ✅ | — | 0 | — | `transporter/screenshots/06-transporter_fleet.png` |
| `/transporter/compliance` | ✅ | — | 0 | — | `transporter/screenshots/07-transporter_compliance.png` |
| `/transporter/profile` | ✅ | — | 0 | — | `transporter/screenshots/08-transporter_profile.png` |
| `/transporter/ratings` | ✅ | — | 0 | — | `transporter/screenshots/09-transporter_ratings.png` |
| `/transporter/ads` | ✅ | — | 0 | — | `transporter/screenshots/10-transporter_ads.png` |
| `/transporter/diary` | ✅ | — | 0 | — | `transporter/screenshots/11-transporter_diary.png` |

## Failures — evidence & likely cause

### ❌ `/transporter` — console.error ×1: Failed to load resource: the server responded with a status of 402 (Payment Required)

- Final URL: /transporter · content: 1389 chars · load: 9270ms
- Screenshot: `results/transporter/screenshots/00-transporter.png`
- console.error: `Failed to load resource: the server responded with a status of 402 (Payment Required)` at http://localhost:5173/v1/transport/analytics:0
- network: GET http://localhost:5173/v1/transport/analytics → 402
- network: GET http://localhost:5173/v1/transport/analytics → 402
- **Likely cause / first fix to try:** Application code logged an error (failed fetch, unhandled rejection). Open the screenshot, then reproduce with DevTools console to find the call site.

### ❌ `/transporter` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/transport/analytics (402)

- Final URL: /transporter · content: 1389 chars · load: 9270ms
- Screenshot: `results/transporter/screenshots/00-transporter.png`
- console.error: `Failed to load resource: the server responded with a status of 402 (Payment Required)` at http://localhost:5173/v1/transport/analytics:0
- network: GET http://localhost:5173/v1/transport/analytics → 402
- network: GET http://localhost:5173/v1/transport/analytics → 402
- **Likely cause / first fix to try:** See the console/network evidence for this row; reproduce manually on the route with DevTools open.

### ❌ `/transporter/loads` — console.error ×1: Failed to load resource: the server responded with a status of 402 (Payment Required)

- Final URL: /transporter/loads · content: 1341 chars · load: 5611ms
- Screenshot: `results/transporter/screenshots/01-transporter_loads.png`
- console.error: `Failed to load resource: the server responded with a status of 402 (Payment Required)` at http://localhost:5173/v1/transport/analytics:0
- network: GET http://localhost:5173/v1/transport/analytics → 402
- network: GET http://localhost:5173/v1/transport/analytics → 402
- **Likely cause / first fix to try:** Application code logged an error (failed fetch, unhandled rejection). Open the screenshot, then reproduce with DevTools console to find the call site.

### ❌ `/transporter/loads` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/transport/analytics (402)

- Final URL: /transporter/loads · content: 1341 chars · load: 5611ms
- Screenshot: `results/transporter/screenshots/01-transporter_loads.png`
- console.error: `Failed to load resource: the server responded with a status of 402 (Payment Required)` at http://localhost:5173/v1/transport/analytics:0
- network: GET http://localhost:5173/v1/transport/analytics → 402
- network: GET http://localhost:5173/v1/transport/analytics → 402
- **Likely cause / first fix to try:** See the console/network evidence for this row; reproduce manually on the route with DevTools open.

### ❌ `/transporter/trips` — console.error ×1: Failed to load resource: the server responded with a status of 402 (Payment Required)

- Final URL: /transporter/trips · content: 1185 chars · load: 4629ms
- Screenshot: `results/transporter/screenshots/02-transporter_trips.png`
- console.error: `Failed to load resource: the server responded with a status of 402 (Payment Required)` at http://localhost:5173/v1/transport/analytics:0
- network: GET http://localhost:5173/v1/transport/analytics → 402
- network: GET http://localhost:5173/v1/transport/analytics → 402
- **Likely cause / first fix to try:** Application code logged an error (failed fetch, unhandled rejection). Open the screenshot, then reproduce with DevTools console to find the call site.

### ❌ `/transporter/trips` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/transport/analytics (402)

- Final URL: /transporter/trips · content: 1185 chars · load: 4629ms
- Screenshot: `results/transporter/screenshots/02-transporter_trips.png`
- console.error: `Failed to load resource: the server responded with a status of 402 (Payment Required)` at http://localhost:5173/v1/transport/analytics:0
- network: GET http://localhost:5173/v1/transport/analytics → 402
- network: GET http://localhost:5173/v1/transport/analytics → 402
- **Likely cause / first fix to try:** See the console/network evidence for this row; reproduce manually on the route with DevTools open.

### ❌ `/transporter/bilty` — console.error ×1: Failed to load resource: the server responded with a status of 402 (Payment Required)

- Final URL: /transporter/bilty · content: 1184 chars · load: 5375ms
- Screenshot: `results/transporter/screenshots/03-transporter_bilty.png`
- console.error: `Failed to load resource: the server responded with a status of 402 (Payment Required)` at http://localhost:5173/v1/transport/analytics:0
- network: GET http://localhost:5173/v1/transport/analytics → 402
- network: GET http://localhost:5173/v1/transport/analytics → 402
- **Likely cause / first fix to try:** Application code logged an error (failed fetch, unhandled rejection). Open the screenshot, then reproduce with DevTools console to find the call site.

### ❌ `/transporter/bilty` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/transport/analytics (402)

- Final URL: /transporter/bilty · content: 1184 chars · load: 5375ms
- Screenshot: `results/transporter/screenshots/03-transporter_bilty.png`
- console.error: `Failed to load resource: the server responded with a status of 402 (Payment Required)` at http://localhost:5173/v1/transport/analytics:0
- network: GET http://localhost:5173/v1/transport/analytics → 402
- network: GET http://localhost:5173/v1/transport/analytics → 402
- **Likely cause / first fix to try:** See the console/network evidence for this row; reproduce manually on the route with DevTools open.

### ❌ `/transporter/settlements` — console.error ×1: Failed to load resource: the server responded with a status of 402 (Payment Required)

- Final URL: /transporter/settlements · content: 1800 chars · load: 6250ms
- Screenshot: `results/transporter/screenshots/04-transporter_settlements.png`
- console.error: `Failed to load resource: the server responded with a status of 402 (Payment Required)` at http://localhost:5173/v1/transport/analytics:0
- network: GET http://localhost:5173/v1/transport/analytics → 402
- network: GET http://localhost:5173/v1/transport/analytics → 402
- **Likely cause / first fix to try:** Application code logged an error (failed fetch, unhandled rejection). Open the screenshot, then reproduce with DevTools console to find the call site.

### ❌ `/transporter/settlements` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/transport/analytics (402)

- Final URL: /transporter/settlements · content: 1800 chars · load: 6250ms
- Screenshot: `results/transporter/screenshots/04-transporter_settlements.png`
- console.error: `Failed to load resource: the server responded with a status of 402 (Payment Required)` at http://localhost:5173/v1/transport/analytics:0
- network: GET http://localhost:5173/v1/transport/analytics → 402
- network: GET http://localhost:5173/v1/transport/analytics → 402
- **Likely cause / first fix to try:** See the console/network evidence for this row; reproduce manually on the route with DevTools open.

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "transporter"
npm run report   # regenerate this doc
```
