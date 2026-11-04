# Troubleshoot — Farm Landlord

> Persona: **Farm Landlord** (landlord)
> Roleplay: Suresh Patel, landowner leasing 45 acres around Nashik with 7/12-synced listings.
> Target: http://localhost:5173 · Walked: 2026-11-02T17:58:28.999Z

## Login recipe used by the test

- Mode: `quick-login` — farmLandlord
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 4 ✅ pass · 1 ⚠️ warn · 0 ❌ fail (5 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/landlord` | ✅ | — | 0 | — | `landlord/screenshots/00-landlord.png` |
| `/landlord/listings` | ✅ | — | 0 | — | `landlord/screenshots/01-landlord_listings.png` |
| `/landlord/verification` | ⚠️ | — | 0 | — | `landlord/screenshots/02-landlord_verification.png` |
| `/landlord/requests` | ✅ | — | 0 | — | `landlord/screenshots/03-landlord_requests.png` |
| `/landlord/connections` | ✅ | — | 0 | — | `landlord/screenshots/04-landlord_connections.png` |

## Warnings (non-blocking, fix after failures)

- ⚠️ `/landlord/verification` — note: redirected /landlord/verification → /landlord/listings → See the console/network evidence for this row; reproduce manually on the route with DevTools open.

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "landlord"
npm run report   # regenerate this doc
```
