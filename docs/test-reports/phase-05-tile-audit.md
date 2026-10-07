# Phase-05 WS-09 — All-Tools launcher tile audit

**Date:** 2026-10-06
**Scope:** every module tile in the persona-filtered dashboard grid
(`website/src/lib/dashboard.ts` → `TOOL_BY_ID` / `PERSONA_HOME_CONFIG`) mapped to
a real page in `website/src/App.tsx` (via the generic
`/dashboard/p/:toolId` route + the per-module `*_PAGES` registries).
24 modules = robust.md §7.1–§7.24.

**Result:** 24/24 modules resolve to a real page. **Zero "coming soon" tiles
remain** (`grep -rniE "coming soon|comingSoon" website/src/views/ website/src/lib/dashboard.ts`
returns no hits).

| # | Module (robust §7) | toolId | route | page | status |
|---|---|---|---|---|---|
| 1 | §7.1 Mandi & price intelligence | `mandi` | `/dashboard/p/mandi` | `views/trade/MandiPage.tsx` (`TRADE_PAGES.mandi`) | ✅ real page |
| 2 | §7.2 Advisory hub (M9/M13) | `advisory` | `/dashboard/p/advisory` | `views/advisory/AdvisoryHubPage.tsx` (`ADVISORY_PAGES.advisory`) | ✅ real page |
| 3 | §7.3 Marketplace e-commerce | `marketplace` | `/dashboard/p/marketplace` | `views/marketplace/CatalogPage.tsx` (`MARKETPLACE_PAGES.marketplace`) | ✅ real page |
| 4 | §7.4 Direct contracts | `myContracts` | `/dashboard/p/myContracts` | `views/farmer/FarmerContractsPage.tsx` (`FARMER_PAGES.myContracts`) | ✅ real page |
| 5 | §7.5 Farm P&L / Farm CEO | `profitLoss` | `/dashboard/p/profitLoss` | `views/pnl/FarmCeoPage.tsx` (`PNL_PAGES.profitLoss`) | ✅ real page |
| 6 | §7.6 Water & irrigation | `water` | `/dashboard/p/water` | `views/water/WaterHomePage.tsx` (`WATER_PAGES.water`) | ✅ real page |
| 7 | §7.7 Government schemes | `schemes` | `/dashboard/p/schemes` | `views/schemes/SchemesListPage.tsx` (`SCHEMES_PAGES.schemes`) | ✅ real page |
| 8 | §7.8 Finance / credit / loans | `finance` | `/dashboard/p/finance` | `views/finance/CreditScorePage.tsx` (`FINANCE_PAGES.finance`) | ✅ real page |
| 9 | §7.9 Crop insurance (PMFBY) | `cropInsurance` | `/dashboard/p/cropInsurance` | `views/farmer/FarmerClaimTrackerPage.tsx` (`INSURANCE_PAGES.cropInsurance`) | ✅ real page |
| 10 | §7.10 Land records (7/12) | `landLegal` | `/dashboard/p/landLegal` | `views/land/LandRecordsPage.tsx` (`LAND_PAGES.landLegal`) | ✅ real page |
| 11 | §7.11 FPO | `fpo` | `/dashboard/p/fpo` | `views/fpo/FpoDirectoryPage.tsx` (`FPO_PAGES.fpo`) | ✅ real page |
| 12 | §7.12 Women Farmer Hub | `womenFarmer` | `/dashboard/p/womenFarmer` | `views/women/WomenHubPage.tsx` (`WOMEN_PAGES.womenFarmer`) | ✅ real page |
| 13 | §7.13 Climate & carbon | `climate` | `/dashboard/p/climate` | `views/climate/ClimateHomePage.tsx` (`CLIMATE_PAGES.climate`) | ✅ real page |
| 14 | §7.14 Post-harvest / cold storage | `postHarvest` | `/dashboard/p/postHarvest` | `views/postharvest/ColdStoragePage.tsx` (`POSTHARVEST_PAGES.postHarvest`) | ✅ real page |
| 15 | §7.15 Krishi Ratna (gamification) | `krishiRatna` | `/dashboard/p/krishiRatna` | `views/rewards/WalletPage.tsx` (`REWARDS_PAGES.krishiRatna`) | ✅ real page |
| 16 | §7.16 Refer & Earn | `referEarn` | `/dashboard/p/referEarn` | `views/referrals/ReferralHubPage.tsx` (`REFERRALS_PAGES.referEarn`) | ✅ real page |
| 17 | §7.17 Farm Diary / Cashbook | `farmDiary` | `/dashboard/p/farmDiary` | `views/diary/CashbookPage.tsx` (`DIARY_PAGES.farmDiary`) | ✅ real page |
| 18 | §7.18 News | `agriNews` | `/dashboard/p/agriNews` | `views/news/NewsFeedPage.tsx` (`NEWS_PAGES.agriNews`) | ✅ real page |
| 19 | §7.19 Live channels | `liveChannels` | `/dashboard/p/liveChannels` | `views/channels/ChannelGridPage.tsx` (`CHANNEL_PAGES.liveChannels`) | ✅ real page |
| 20 | §7.20 Livestock hub | `livestockDairy` | `/dashboard/p/livestockDairy` (+ tile deep-link `/dairy/me`) | `views/dairy/DairyHubPage.tsx` (`DAIRY_PAGES.livestockDairy`) | ✅ real page |
| 21 | §7.21 Gyan Hub (knowledge) | `gyanHub` | `/dashboard/p/gyanHub` | `views/gyan/GyanHubHome.tsx` (`GYAN_PAGES.gyanHub`) | ✅ real page |
| 22 | §7.22 Tree plantation & biofuel | `treePlantation` | `/dashboard/p/treePlantation` | `views/trees/PlantationPage.tsx` (`TREE_PAGES.treePlantation`) | ✅ real page |
| 23 | §7.23 Equipment rental | `equipment` | `/dashboard/p/equipment` | `views/farmer/EquipmentBrowsePage.tsx` (`EQUIPMENT_PAGES.equipment`) | ✅ real page |
| 24 | §7.24 All-Tools launcher & global search | n/a (launcher) + `search` | `/search?q=` | `components/dashboard/AllToolsSheet.tsx` + `views/dashboard/SearchResultsPage.tsx` | ✅ real page |

## Tiles owned by other phases (verification only)

Per WS-09 step 1, phases 02–04 own their persona tiles: this workstream only
verifies the launcher tile resolves, and files a dated blocker only when it does
not. Both cross-phase tiles below **resolve**, so **no blocker is filed**:

- **Equipment farmer face (7.23)** — owned by phase-02 WS-04 item 2.
  `EQUIPMENT_PAGES.equipment` → `EquipmentBrowsePage` for the farmer persona
  (`views/farmer/EquipmentBrowsePage.tsx`). Resolves; no blocker.
- **Livestock hub (7.20)** — owned by phase-03. `DAIRY_PAGES.livestockDairy` →
  `DairyHubPage`; the dashboard tile also deep-links to `/dairy/me`
  (`MyDairyPage`). Both routes are registered in `App.tsx`. Resolves; no blocker.

## Remediation log

The sweep removed the last reachable placeholder copy from `views/` so that no
launcher tile lands on a "coming soon" screen:

- Deleted the orphan `views/dairy/components/ComingSoon.tsx` (unreferenced — the
  dairy console ships real section pages; grep confirmed no importers).
- `views/broker/index.tsx`: the non-broker `buyers` empty state now uses the
  neutral `buyersWorkspace` / `buyersWorkspaceBody` keys (broker CRM is part of
  the broker workspace) instead of a "coming soon" promise. Key renamed in
  `en.broker.ts` + `hi.broker.ts` (parity preserved).
- `views/advisory/AdvisoryHubPage.tsx`: reworded a code comment that mentioned a
  "coming soon" state.
- Renamed the generic placeholder i18n keys that carried the identifier:
  `dashComingSoon` → `dashLiveSoon` and `dashWeatherComingSoon` →
  `dashWeatherLiveSoon` across every locale dictionary, updated the two call
  sites in `components/dashboard/tiles.tsx`, and removed the now-unused
  `dairyComingSoon` / `dairyComingSoonBody` keys from `en.dairy.ts` + `hi.dairy.ts`.
  `grep -rniE "comingSoon|coming_soon" website/src/lib/ website/src/views/` is now
  clean (task 9.3).

## Verification

```bash
# Task 9.2 — no reachable "coming soon" from any tile (exit 1 == pass)
grep -rniE "coming soon" website/src/views/ website/src/lib/dashboard.ts; test $? -eq 1
# → exit 1 (clean)

# Task 9.3 — no "comingSoon"/"coming_soon" identifier in lib/ or views/ (exit 1 == pass)
grep -rniE "comingSoon|coming_soon" website/src/lib/ website/src/views/; test $? -eq 1
# → exit 1 (clean)

# WS-09 gate grep
grep -rniE "coming soon|comingSoon" website/src/views/ website/src/lib/dashboard.ts; test $? -eq 1
# → exit 1 (clean)
```
