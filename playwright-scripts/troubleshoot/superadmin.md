# Troubleshoot — Superadmin master console

> Target: http://localhost:5174 · Walked: 2026-11-02T18:04:34.358Z

## Result: 16 ✅ pass · 1 ❌ fail (17 panels)

### ❌ Overview & Analytics
- console.error: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- **Likely cause / first fix to try:** Unauthorized API call: token expired or restricted onboarding token used on a protected endpoint. Check how the client attaches Authorization headers (website/src/lib/api/client.ts).
- HTTP 401 on http://localhost:5174/v1/admin/analytics/summary
- **Likely cause / first fix to try:** Unauthorized API call: token expired or restricted onboarding token used on a protected endpoint. Check how the client attaches Authorization headers (website/src/lib/api/client.ts).

### ✅ Farmer Pages & CMS

### ✅ 1. Farmer Governance

### ✅ 2. Farm Landlord Desk

### ✅ 3. Transport & Logistics

### ✅ 4. Vyapari Trader Desk

### ✅ 5. Machinery & Yantra

### ✅ Export & Trade Desk

### ✅ Livestock Hub

### ✅ FPO & Cooperatives

### ✅ Mahila Graha Udyog

### ✅ Gurukul Academy

### ✅ Banking & Insurance

### ✅ Cold Storage Hub

### ✅ Nursery & Agroforestry

### ✅ eMarket Customer Mall

### ✅ Multi-User & RBAC Desk

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test specs/superadmin.spec.ts
```
