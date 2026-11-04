# Troubleshoot — Equipment Owner / CHC

> Persona: **Equipment Owner / CHC** (equipmentOwner)
> Roleplay: Harpreet Singh, CHC owner renting tractors and harvesters per hour.
> Target: http://localhost:5173 · Walked: 2026-11-02T17:59:40.734Z

## Login recipe used by the test

- Mode: `quick-login` — equipmentRental
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 5 ✅ pass · 0 ⚠️ warn · 0 ❌ fail (5 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/equipmentOwner` | ✅ | — | 0 | — | `equipmentOwner/screenshots/00-equipmentOwner.png` |
| `/equipment/machines` | ✅ | — | 0 | — | `equipmentOwner/screenshots/01-equipment_machines.png` |
| `/equipment/availability` | ✅ | — | 0 | — | `equipmentOwner/screenshots/02-equipment_availability.png` |
| `/equipment/requests` | ✅ | — | 0 | — | `equipmentOwner/screenshots/03-equipment_requests.png` |
| `/equipment/jobs` | ✅ | — | 0 | — | `equipmentOwner/screenshots/04-equipment_jobs.png` |

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "equipmentOwner"
npm run report   # regenerate this doc
```
