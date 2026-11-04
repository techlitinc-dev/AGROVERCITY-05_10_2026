# Troubleshoot — Milk Vendor / Doodh Vala

> Persona: **Milk Vendor / Doodh Vala** (milkSeller)
> Roleplay: PW Test Milk Vendor, door-collection dairy vendor with FAT/SNR billing.
> Target: http://localhost:5173 · Walked: 2026-11-02T18:00:20.665Z

## Login recipe used by the test

- Mode: `onboard` — +919100000102
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 3 ✅ pass · 0 ⚠️ warn · 6 ❌ fail (9 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/milkSeller` | ✅ | — | 0 | — | `milkSeller/screenshots/00-milkSeller.png` |
| `/milkSeller/clients` | ✅ | — | 0 | — | `milkSeller/screenshots/01-milkSeller_clients.png` |
| `/milkSeller/bills` | ✅ | — | 0 | — | `milkSeller/screenshots/02-milkSeller_bills.png` |
| `/milkSeller/analytics` | ❌ | page looks blank (only 32 chars of text) | 0 | — | `milkSeller/screenshots/03-milkSeller_analytics.png` |
| `/milkSeller/vendor` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×4: GET http://localhost:5173/v1/milk-vendor/products (403) | 1 | 403 /v1/milk-vendor/products<br>403 /v1/milk-vendor/clients?status=all<br>403 /v1/milk-vendor/products<br>403 /v1/milk-vendor/clients?status=all | `milkSeller/screenshots/04-milkSeller_vendor.png` |
| `/milkSeller/vendor/clients` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×6: GET http://localhost:5173/v1/milk-vendor/products (403) | 1 | 403 /v1/milk-vendor/products<br>403 /v1/milk-vendor/clients?status=all<br>403 /v1/milk-vendor/products<br>403 /v1/milk-vendor/clients?status=all<br>403 /v1/milk-vendor/clients?status=all<br>403 /v1/milk-vendor/clients?status=all | `milkSeller/screenshots/05-milkSeller_vendor_clients.png` |
| `/milkSeller/vendor/bills` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×8: GET http://localhost:5173/v1/milk-vendor/products (403) | 1 | 403 /v1/milk-vendor/products<br>403 /v1/milk-vendor/clients?status=all<br>403 /v1/milk-vendor/products<br>403 /v1/milk-vendor/clients?status=all<br>403 /v1/milk-vendor/bills<br>403 /v1/milk-vendor/payments<br>403 /v1/milk-vendor/bills<br>403 /v1/milk-vendor/payments | `milkSeller/screenshots/06-milkSeller_vendor_bills.png` |
| `/milkSeller/vendor/rates` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×4: GET http://localhost:5173/v1/milk-vendor/products (403) | 1 | 403 /v1/milk-vendor/products<br>403 /v1/milk-vendor/clients?status=all<br>403 /v1/milk-vendor/products<br>403 /v1/milk-vendor/clients?status=all | `milkSeller/screenshots/07-milkSeller_vendor_rates.png` |
| `/milkSeller/vendor/settings` | ❌ | console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden); HTTP >=400 / failed requests ×4: GET http://localhost:5173/v1/milk-vendor/products (403) | 1 | 403 /v1/milk-vendor/products<br>403 /v1/milk-vendor/clients?status=all<br>403 /v1/milk-vendor/clients?status=all<br>403 /v1/milk-vendor/products | `milkSeller/screenshots/08-milkSeller_vendor_settings.png` |

## Failures — evidence & likely cause

### ❌ `/milkSeller/analytics` — page looks blank (only 32 chars of text)

- Final URL: /milkSeller/analytics · content: 32 chars · load: 5504ms
- Screenshot: `results/milkSeller/screenshots/03-milkSeller_analytics.png`
- **Likely cause / first fix to try:** React render crash or empty data path. Reproduce manually, read the uncaught exception above, and check the view component for unguarded undefined (optional chaining) around API data.

### ❌ `/milkSeller/vendor` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /milkSeller/vendor · content: 749 chars · load: 6069ms
- Screenshot: `results/milkSeller/screenshots/04-milkSeller_vendor.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/milk-vendor/products:0
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/milkSeller/vendor` — HTTP >=400 / failed requests ×4: GET http://localhost:5173/v1/milk-vendor/products (403)

- Final URL: /milkSeller/vendor · content: 749 chars · load: 6069ms
- Screenshot: `results/milkSeller/screenshots/04-milkSeller_vendor.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/milk-vendor/products:0
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/milkSeller/vendor/clients` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /milkSeller/vendor/clients · content: 821 chars · load: 6311ms
- Screenshot: `results/milkSeller/screenshots/05-milkSeller_vendor_clients.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/milk-vendor/products:0
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/milkSeller/vendor/clients` — HTTP >=400 / failed requests ×6: GET http://localhost:5173/v1/milk-vendor/products (403)

- Final URL: /milkSeller/vendor/clients · content: 821 chars · load: 6311ms
- Screenshot: `results/milkSeller/screenshots/05-milkSeller_vendor_clients.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/milk-vendor/products:0
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/milkSeller/vendor/bills` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /milkSeller/vendor/bills · content: 965 chars · load: 5811ms
- Screenshot: `results/milkSeller/screenshots/06-milkSeller_vendor_bills.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/milk-vendor/products:0
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/bills → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/milkSeller/vendor/bills` — HTTP >=400 / failed requests ×8: GET http://localhost:5173/v1/milk-vendor/products (403)

- Final URL: /milkSeller/vendor/bills · content: 965 chars · load: 5811ms
- Screenshot: `results/milkSeller/screenshots/06-milkSeller_vendor_bills.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/milk-vendor/products:0
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/bills → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/milkSeller/vendor/rates` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /milkSeller/vendor/rates · content: 959 chars · load: 6084ms
- Screenshot: `results/milkSeller/screenshots/07-milkSeller_vendor_rates.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/milk-vendor/products:0
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/milkSeller/vendor/rates` — HTTP >=400 / failed requests ×4: GET http://localhost:5173/v1/milk-vendor/products (403)

- Final URL: /milkSeller/vendor/rates · content: 959 chars · load: 6084ms
- Screenshot: `results/milkSeller/screenshots/07-milkSeller_vendor_rates.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/milk-vendor/products:0
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/milkSeller/vendor/settings` — console.error ×1: Failed to load resource: the server responded with a status of 403 (Forbidden)

- Final URL: /milkSeller/vendor/settings · content: 1161 chars · load: 5413ms
- Screenshot: `results/milkSeller/screenshots/08-milkSeller_vendor_settings.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/milk-vendor/products:0
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

### ❌ `/milkSeller/vendor/settings` — HTTP >=400 / failed requests ×4: GET http://localhost:5173/v1/milk-vendor/products (403)

- Final URL: /milkSeller/vendor/settings · content: 1161 chars · load: 5413ms
- Screenshot: `results/milkSeller/screenshots/08-milkSeller_vendor_settings.png`
- console.error: `Failed to load resource: the server responded with a status of 403 (Forbidden)` at http://localhost:5173/v1/milk-vendor/products:0
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/clients?status=all → 403
- network: GET http://localhost:5173/v1/milk-vendor/products → 403
- **Likely cause / first fix to try:** Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "milkSeller"
npm run report   # regenerate this doc
```
