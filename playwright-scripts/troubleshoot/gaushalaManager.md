# Troubleshoot — Gaushala & Sanctuary

> Persona: **Gaushala & Sanctuary** (gaushalaManager)
> Roleplay: PW Test Gaushala, cattle-shelter manager tracking inventory, adoptions and expenses.
> Target: http://localhost:5173 · Walked: 2026-11-02T18:01:46.899Z

## Login recipe used by the test

- Mode: `onboard` — +919100000105
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 0 ✅ pass · 0 ⚠️ warn · 7 ❌ fail (7 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/gaushalaManager` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/livestock/gaushala/mine (403) | 1 | 403 /v1/livestock/gaushala/mine<br>403 /v1/livestock/gaushala/mine | `gaushalaManager/screenshots/00-gaushalaManager.png` |
| `/gaushalaManager/profile` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/livestock/gaushala/mine (403) | 1 | 403 /v1/livestock/gaushala/mine<br>403 /v1/livestock/gaushala/mine | `gaushalaManager/screenshots/01-gaushalaManager_profile.png` |
| `/gaushalaManager/cattle` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/livestock/gaushala/cattle (403) | 1 | 403 /v1/livestock/gaushala/cattle<br>403 /v1/livestock/gaushala/cattle | `gaushalaManager/screenshots/02-gaushalaManager_cattle.png` |
| `/gaushalaManager/adoptions` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×6: GET http://localhost:5173/v1/livestock/gaushala/adoptions (403) | 1 | 403 /v1/livestock/gaushala/adoptions<br>403 /v1/livestock/gaushala/mine<br>403 /v1/livestock/gaushala/donations<br>403 /v1/livestock/gaushala/adoptions<br>403 /v1/livestock/gaushala/mine<br>403 /v1/livestock/gaushala/donations | `gaushalaManager/screenshots/03-gaushalaManager_adoptions.png` |
| `/gaushalaManager/receipts` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/livestock/gaushala/receipts (403) | 1 | 403 /v1/livestock/gaushala/receipts<br>403 /v1/livestock/gaushala/receipts | `gaushalaManager/screenshots/04-gaushalaManager_receipts.png` |
| `/gaushalaManager/expenses` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×4: GET http://localhost:5173/v1/livestock/gaushala/expenses (403) | 1 | 403 /v1/livestock/gaushala/expenses<br>403 /v1/livestock/gaushala/expenses/summary<br>403 /v1/livestock/gaushala/expenses<br>403 /v1/livestock/gaushala/expenses/summary | `gaushalaManager/screenshots/05-gaushalaManager_expenses.png` |
| `/gaushalaManager/vets` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/livestock/vets/managed (403) | 1 | 403 /v1/livestock/vets/managed<br>403 /v1/livestock/vets/managed | `gaushalaManager/screenshots/06-gaushalaManager_vets.png` |

## Failures — evidence & likely cause

### ❌ `/gaushalaManager` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /gaushalaManager · content: 1178 chars · load: 11154ms
- Screenshot: `results/gaushalaManager/screenshots/00-gaushalaManager.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/gaushala/mine:0
- network: GET http://localhost:5173/v1/livestock/gaushala/mine → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/mine → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/gaushalaManager` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/livestock/gaushala/mine (403)

- Final URL: /gaushalaManager · content: 1178 chars · load: 11154ms
- Screenshot: `results/gaushalaManager/screenshots/00-gaushalaManager.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/gaushala/mine:0
- network: GET http://localhost:5173/v1/livestock/gaushala/mine → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/mine → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/gaushalaManager/profile` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /gaushalaManager/profile · content: 872 chars · load: 8081ms
- Screenshot: `results/gaushalaManager/screenshots/01-gaushalaManager_profile.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/gaushala/mine:0
- network: GET http://localhost:5173/v1/livestock/gaushala/mine → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/mine → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/gaushalaManager/profile` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/livestock/gaushala/mine (403)

- Final URL: /gaushalaManager/profile · content: 872 chars · load: 8081ms
- Screenshot: `results/gaushalaManager/screenshots/01-gaushalaManager_profile.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/gaushala/mine:0
- network: GET http://localhost:5173/v1/livestock/gaushala/mine → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/mine → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/gaushalaManager/cattle` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /gaushalaManager/cattle · content: 669 chars · load: 6557ms
- Screenshot: `results/gaushalaManager/screenshots/02-gaushalaManager_cattle.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/gaushala/cattle:0
- network: GET http://localhost:5173/v1/livestock/gaushala/cattle → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/cattle → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/gaushalaManager/cattle` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/livestock/gaushala/cattle (403)

- Final URL: /gaushalaManager/cattle · content: 669 chars · load: 6557ms
- Screenshot: `results/gaushalaManager/screenshots/02-gaushalaManager_cattle.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/gaushala/cattle:0
- network: GET http://localhost:5173/v1/livestock/gaushala/cattle → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/cattle → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/gaushalaManager/adoptions` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /gaushalaManager/adoptions · content: 646 chars · load: 7520ms
- Screenshot: `results/gaushalaManager/screenshots/03-gaushalaManager_adoptions.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/gaushala/adoptions:0
- network: GET http://localhost:5173/v1/livestock/gaushala/adoptions → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/mine → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/donations → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/adoptions → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/mine → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/gaushalaManager/adoptions` — HTTP >=400 / failed requests ×6: GET http://localhost:5173/v1/livestock/gaushala/adoptions (403)

- Final URL: /gaushalaManager/adoptions · content: 646 chars · load: 7520ms
- Screenshot: `results/gaushalaManager/screenshots/03-gaushalaManager_adoptions.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/gaushala/adoptions:0
- network: GET http://localhost:5173/v1/livestock/gaushala/adoptions → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/mine → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/donations → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/adoptions → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/mine → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/gaushalaManager/receipts` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /gaushalaManager/receipts · content: 726 chars · load: 7916ms
- Screenshot: `results/gaushalaManager/screenshots/04-gaushalaManager_receipts.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/gaushala/receipts:0
- network: GET http://localhost:5173/v1/livestock/gaushala/receipts → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/receipts → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/gaushalaManager/receipts` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/livestock/gaushala/receipts (403)

- Final URL: /gaushalaManager/receipts · content: 726 chars · load: 7916ms
- Screenshot: `results/gaushalaManager/screenshots/04-gaushalaManager_receipts.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/gaushala/receipts:0
- network: GET http://localhost:5173/v1/livestock/gaushala/receipts → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/receipts → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/gaushalaManager/expenses` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /gaushalaManager/expenses · content: 644 chars · load: 6465ms
- Screenshot: `results/gaushalaManager/screenshots/05-gaushalaManager_expenses.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/gaushala/expenses:0
- network: GET http://localhost:5173/v1/livestock/gaushala/expenses → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/expenses/summary → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/expenses → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/expenses/summary → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/gaushalaManager/expenses` — HTTP >=400 / failed requests ×4: GET http://localhost:5173/v1/livestock/gaushala/expenses (403)

- Final URL: /gaushalaManager/expenses · content: 644 chars · load: 6465ms
- Screenshot: `results/gaushalaManager/screenshots/05-gaushalaManager_expenses.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/gaushala/expenses:0
- network: GET http://localhost:5173/v1/livestock/gaushala/expenses → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/expenses/summary → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/expenses → 403
- network: GET http://localhost:5173/v1/livestock/gaushala/expenses/summary → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/gaushalaManager/vets` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /gaushalaManager/vets · content: 754 chars · load: 8064ms
- Screenshot: `results/gaushalaManager/screenshots/06-gaushalaManager_vets.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/vets/managed:0
- network: GET http://localhost:5173/v1/livestock/vets/managed → 403
- network: GET http://localhost:5173/v1/livestock/vets/managed → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/gaushalaManager/vets` — HTTP >=400 / failed requests ×2: GET http://localhost:5173/v1/livestock/vets/managed (403)

- Final URL: /gaushalaManager/vets · content: 754 chars · load: 8064ms
- Screenshot: `results/gaushalaManager/screenshots/06-gaushalaManager_vets.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/livestock/vets/managed:0
- network: GET http://localhost:5173/v1/livestock/vets/managed → 403
- network: GET http://localhost:5173/v1/livestock/vets/managed → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "gaushalaManager"
npm run report   # regenerate this doc
```
