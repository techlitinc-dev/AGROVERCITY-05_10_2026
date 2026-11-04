# Troubleshoot — Agri Vyapari (Trader)

> Persona: **Agri Vyapari (Trader)** (seller)
> Roleplay: Amit Agarwal, mandi vyapari procuring from farmers and running a inputs storefront.
> Target: http://localhost:5173 · Walked: 2026-11-02T17:58:56.230Z

## Login recipe used by the test

- Mode: `quick-login` — seller
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 6 ✅ pass · 0 ⚠️ warn · 0 ❌ fail (6 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/seller` | ✅ | — | 0 | — | `seller/screenshots/00-seller.png` |
| `/seller/lots` | ✅ | — | 0 | — | `seller/screenshots/01-seller_lots.png` |
| `/seller/demands` | ✅ | — | 0 | — | `seller/screenshots/02-seller_demands.png` |
| `/seller/connections` | ✅ | — | 0 | — | `seller/screenshots/03-seller_connections.png` |
| `/seller/rates` | ✅ | — | 0 | — | `seller/screenshots/04-seller_rates.png` |
| `/seller/profile` | ✅ | — | 0 | — | `seller/screenshots/05-seller_profile.png` |

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "seller"
npm run report   # regenerate this doc
```
