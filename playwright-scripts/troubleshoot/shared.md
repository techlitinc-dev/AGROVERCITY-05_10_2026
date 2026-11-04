# Troubleshoot — Shared account surfaces

> Persona: **Shared account surfaces** (shared)
> Roleplay: Any signed-in user opening the common account pages from the app shell.
> Target: http://localhost:5173 · Walked: 2026-11-02T18:03:07.955Z

## Login recipe used by the test

- Mode: `quick-login` — farmer
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 9 ✅ pass · 0 ⚠️ warn · 2 ❌ fail (11 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/notifications` | ✅ | — | 0 | — | `shared/screenshots/00-notifications.png` |
| `/support` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 500 (Internal Server Error); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/faq (500) | 1 | 500 /v1/faq<br>500 /v1/faq | `shared/screenshots/01-support.png` |
| `/settings` | ❌ | console.error ×2: Failed to load resource: the server responded with a status of 404 (Not Found); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/users/me/data-export/latest (404) | 2 | 404 /v1/users/me/data-export/latest<br>404 /v1/users/me/data-export/latest | `shared/screenshots/02-settings.png` |
| `/billing` | ✅ | — | 0 | — | `shared/screenshots/03-billing.png` |
| `/kyc` | ✅ | — | 0 | — | `shared/screenshots/04-kyc.png` |
| `/bank-accounts` | ✅ | — | 0 | — | `shared/screenshots/05-bank-accounts.png` |
| `/chat` | ✅ | — | 0 | — | `shared/screenshots/06-chat.png` |
| `/payments` | ✅ | — | 0 | — | `shared/screenshots/07-payments.png` |
| `/ratings` | ✅ | — | 0 | — | `shared/screenshots/08-ratings.png` |
| `/profile` | ✅ | — | 0 | — | `shared/screenshots/09-profile.png` |
| `/saved` | ✅ | — | 0 | — | `shared/screenshots/10-saved.png` |

## Failures — evidence & likely cause

### ❌ `/support` — console.error ×1: Failed to load resource: the server responded with a status of 500 (Internal Server Error)

- Final URL: /support · content: 1561 chars · load: 3570ms
- Screenshot: `results/shared/screenshots/01-support.png`
- console.error: `Failed to load resource: the server responded with a status of 500 (Internal Server Error)` at http://localhost:5173/v1/faq:0
- network: GET http://localhost:5173/v1/faq → 500
- network: GET http://localhost:5173/v1/faq → 500
- **Likely cause / first fix to try:** Backend exception on GET http://localhost:5173/v1/faq. Reproduce with curl against :8000, then read logs/backend.log for the traceback.

### ❌ `/support` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/faq (500)

- Final URL: /support · content: 1561 chars · load: 3570ms
- Screenshot: `results/shared/screenshots/01-support.png`
- console.error: `Failed to load resource: the server responded with a status of 500 (Internal Server Error)` at http://localhost:5173/v1/faq:0
- network: GET http://localhost:5173/v1/faq → 500
- network: GET http://localhost:5173/v1/faq → 500
- **Likely cause / first fix to try:** Backend exception on GET http://localhost:5173/v1/faq. Reproduce with curl against :8000, then read logs/backend.log for the traceback.

### ❌ `/settings` — console.error ×2: Failed to load resource: the server responded with a status of 404 (Not Found)

- Final URL: /settings · content: 2782 chars · load: 5082ms
- Screenshot: `results/shared/screenshots/02-settings.png`
- console.error: `Failed to load resource: the server responded with a status of 404 (Not Found)` at http://localhost:5173/v1/users/me/data-export/latest:0
- console.error: `Warning: Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.%s   Check the render method of `SettingsPage`.       at button     at` at http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=13b937fd:63
- network: GET http://localhost:5173/v1/users/me/data-export/latest → 404
- network: GET http://localhost:5173/v1/users/me/data-export/latest → 404
- **Likely cause / first fix to try:** Endpoint not found: http://localhost:5173/v1/users/me/data-export/latest — router not registered in backend/app/main.py or path renamed. Compare with website/src/lib/api/* call sites.

### ❌ `/settings` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/users/me/data-export/latest (404)

- Final URL: /settings · content: 2782 chars · load: 5082ms
- Screenshot: `results/shared/screenshots/02-settings.png`
- console.error: `Failed to load resource: the server responded with a status of 404 (Not Found)` at http://localhost:5173/v1/users/me/data-export/latest:0
- console.error: `Warning: Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.%s   Check the render method of `SettingsPage`.       at button     at` at http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=13b937fd:63
- network: GET http://localhost:5173/v1/users/me/data-export/latest → 404
- network: GET http://localhost:5173/v1/users/me/data-export/latest → 404
- **Likely cause / first fix to try:** Endpoint not found: http://localhost:5173/v1/users/me/data-export/latest — router not registered in backend/app/main.py or path renamed. Compare with website/src/lib/api/* call sites.

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "shared"
npm run report   # regenerate this doc
```
