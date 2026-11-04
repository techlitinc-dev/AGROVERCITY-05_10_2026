# Troubleshoot — Mahila Gruh Udyog & SHG

> Persona: **Mahila Gruh Udyog & SHG** (womenShg)
> Roleplay: PW Test SHG, women self-help group managing product batches, savings and FSSAI certificates.
> Target: http://localhost:5173 · Walked: 2026-11-02T18:00:41.309Z

## Login recipe used by the test

- Mode: `onboard` — +919100000103
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 4 ✅ pass · 0 ⚠️ warn · 1 ❌ fail (5 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/womenShg` | ✅ | — | 0 | — | `womenShg/screenshots/00-womenShg.png` |
| `/womenShg/products` | ✅ | — | 0 | — | `womenShg/screenshots/01-womenShg_products.png` |
| `/womenShg/batches` | ✅ | — | 0 | — | `womenShg/screenshots/02-womenShg_batches.png` |
| `/womenShg/certs` | ❌ | page looks blank (only 32 chars of text) | 0 | — | `womenShg/screenshots/03-womenShg_certs.png` |
| `/womenShg/savings` | ✅ | — | 0 | — | `womenShg/screenshots/04-womenShg_savings.png` |

## Failures — evidence & likely cause

### ❌ `/womenShg/certs` — page looks blank (only 32 chars of text)

- Final URL: /womenShg/certs · content: 32 chars · load: 4601ms
- Screenshot: `results/womenShg/screenshots/03-womenShg_certs.png`
- **Likely cause / first fix to try:** React render crash or empty data path. Reproduce manually, read the uncaught exception above, and check the view component for unguarded undefined (optional chaining) around API data.

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "womenShg"
npm run report   # regenerate this doc
```
