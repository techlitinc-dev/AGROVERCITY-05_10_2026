# Troubleshoot — Cold Storage Owner

> Persona: **Cold Storage Owner** (coldStorageProvider)
> Roleplay: Vikram Shinde, WDRA-licensed cold chain operator with IoT chambers.
> Target: http://localhost:5173 · Walked: 2026-11-02T18:01:41.433Z

## Login recipe used by the test

- Mode: `quick-login` — coldStorageProvider
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 4 ✅ pass · 0 ⚠️ warn · 0 ❌ fail (4 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/coldStorageProvider` | ✅ | — | 0 | — | `coldStorageProvider/screenshots/00-coldStorageProvider.png` |
| `/coldStorageProvider/facilities` | ✅ | — | 0 | — | `coldStorageProvider/screenshots/01-coldStorageProvider_facilities.png` |
| `/coldStorageProvider/bookings` | ✅ | — | 0 | — | `coldStorageProvider/screenshots/02-coldStorageProvider_bookings.png` |
| `/coldStorageProvider/fees` | ✅ | — | 0 | — | `coldStorageProvider/screenshots/03-coldStorageProvider_fees.png` |

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "coldStorageProvider"
npm run report   # regenerate this doc
```
