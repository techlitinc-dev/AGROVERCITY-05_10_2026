# Troubleshoot — Agri Exporter

> Persona: **Agri Exporter** (exporter)
> Roleplay: PW Test Exporter, APEDA-certified exporter answering global RFQs.
> Target: http://localhost:5173 · Walked: 2026-11-02T18:00:24.290Z

## Login recipe used by the test

- Mode: `onboard` — +919100000101
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 6 ✅ pass · 0 ⚠️ warn · 1 ❌ fail (7 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/exporter` | ✅ | — | 0 | — | `exporter/screenshots/00-exporter.png` |
| `/exporter/rfqs` | ✅ | — | 0 | — | `exporter/screenshots/01-exporter_rfqs.png` |
| `/exporter/applications` | ✅ | — | 0 | — | `exporter/screenshots/02-exporter_applications.png` |
| `/exporter/connections` | ✅ | — | 0 | — | `exporter/screenshots/03-exporter_connections.png` |
| `/exporter/orders` | ✅ | — | 0 | — | `exporter/screenshots/04-exporter_orders.png` |
| `/exporter/suppliers` | ✅ | — | 0 | — | `exporter/screenshots/05-exporter_suppliers.png` |
| `/exporter/analytics` | ❌ | page looks blank (only 32 chars of text) | 0 | — | `exporter/screenshots/06-exporter_analytics.png` |

## Failures — evidence & likely cause

### ❌ `/exporter/analytics` — page looks blank (only 32 chars of text)

- Final URL: /exporter/analytics · content: 32 chars · load: 7723ms
- Screenshot: `results/exporter/screenshots/06-exporter_analytics.png`
- **Likely cause / first fix to try:** React render crash or empty data path. Reproduce manually, read the uncaught exception above, and check the view component for unguarded undefined (optional chaining) around API data.

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "exporter"
npm run report   # regenerate this doc
```
