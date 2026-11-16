# Agrovercity — Overall Website Summary

_Last updated: 2026-11-16_

## 1. Platform Overview

Agrovercity (Kisan Setu) is a multi-persona agricultural platform — one codebase serving
role-specific "cockpits" (farmer, transporter, seller, etc.) with shared infrastructure
for KYC, escrow payments, chat, ratings, notifications, and an AI copilot.

### Repo layout

| Path | Purpose |
|---|---|
| `website/` | Main customer-facing web app (React + Vite + TypeScript + Tailwind) |
| `backend/` | FastAPI backend on Google Firestore (Python, `backend/app/main.py`) |
| `superadmin/` | Platform-operations console (separate Vite app, port 5174) |
| `e2e/`, `playwright-scripts/` | Playwright end-to-end test suites |
| `sim/` | Persona-flow simulation harness |
| `manual_test/` | Manual UAT scripts per persona |

## 2. Frontend (`website/`)

- **Stack**: Vite 5, React 18, TypeScript, Tailwind CSS 3, zustand (auth store),
  react-router-dom v6, axios API client, recharts.
- **Entry**: `src/App.tsx` → route groups under `src/views/<domain>/routes.tsx`.
  Home page (`/`, `/landing`) = `src/views/public/LandingPage.tsx`.
- **Personas**: canonical list in `src/lib/personas.ts` (`ALL_PERSONAS`, `PERSONA_HOME`),
  type union in `src/types/index.ts` (21 persona ids). Persona alias normalization
  maps backend/mobile names (e.g. `farmLandlord` → `landlord`).
- **i18n**: 9 Indian languages in `src/lib/i18n.ts`.
- **Build/run**: `pnpm build` (tsc --noEmit + vite build), `pnpm dev` (port 5173).
  Dev servers for website (5173) and superadmin (5174) run via `run.sh`.

## 3. Home Page Persona Matrix — 9 Personas (updated 2026-11-16)

The "Explore Personas" ecosystem matrix on the landing page (`#personas-matrix`,
cards defined in `personasList`, `LandingPage.tsx`) now presents **9 personas**.

**Kept cards (9):**

| Persona | Card title | Category |
|---|---|---|
| `farmer` | Kisan / Farmer 🌾 | Producers & Land |
| `landlord` | Agricultural Landlord 🏡 | Producers & Land |
| `equipmentOwner` | Equipment Owner (CHC) 🚜 | Producers & Land |
| `womenShg` | Mahila Gruh Udyog & SHG 🪔 | Producers & Land |
| `transporter` | Freight Transporter 🚚 | Trade & Logistics |
| `seller` | Agri Vyapari & Dealer 🏪 | Trade & Logistics |
| `milkSeller` | Milk Vendor / Doodh Vala 🫗 | Dairy & Livestock |
| `instructor` | Gurukul Academy Instructor 🎓 | Fintech & Public |
| `customer` | E-Market Consumer 🛍️ | Fintech & Public |

**Removed cards (frontend only):** International Agri Exporter (`exporter`),
Industrial Buyer (`directBuyer`), Cold Storage & Warehousing (`coldStorageProvider`),
Gaushala & Sanctuary (`gaushalaManager`).

**Labels fixed to match:** hero button "Explore 9 Personas"; badge
"Comprehensive 9-Role Agricultural Stack"; tab counts — All 9 Personas (सभी),
Producers & Land (4), Trade & Logistics (2), Dairy & Livestock (1), Fintech & Public (2).

### Women hub (Mahila Gruh Udyog) — restored 2026-11-16

The `womenShg` frontend was re-enabled after being unwired on 2026-11-06 (commit
`4249398`). The views and API client survived on disk; only routing/nav wiring
had to be restored:

- Routes: `/womenShg` (+ `/products` `/batches` `/certs` `/savings`), `/community/women`,
  `/gruhUdyog` → `WomenGruhUdyogView`; `/women/directory` → `DirectoryView`
  (mounted via `WomenRouteElements` in `App.tsx`).
- Persona plumbing: `PERSONA_HOME.womenShg` → `/womenShg` in `personas.ts` and
  `ProfileSwitchPage.tsx`; `womenShg`/`womenshg` aliases back in `PERSONA_ALIASES`;
  `ALL_PERSONAS` entries restored in `personas.ts` + `ProfileSwitchPage.tsx`;
  onboarding role card restored in `RegisterPage.tsx`.
- Navigation: full `womenShg` sidebar section (6 items), farmer "Mahila Bachat Gat"
  item, Navbar persona entry, landing card + footer link, deep-link cases
  (`women`/`womenShg`/`gruhUdyog`) in `DeepLinkRedirect.tsx`, mall "Explore the
  women hub" link in `CustomerHomeView.tsx`.
- Tests: `playwright-scripts/lib/personas.ts` womenShg persona walk restored;
  `specs/removed-pages.spec.ts` updated — women URLs are now expected to render,
  the other 6 removed pages stay asserted as removed.

### Live Mandi Price Radar — genuine gov feed (2026-11-16)

The landing radar previously rendered hardcoded benchmark rows and silently
fell back to mock data (its `mandi.prices()` call needs auth, so anonymous
visitors always got mocks). It now shows **real government open-data prices**:

- Backend: additive anonymous endpoint `GET /v1/mandi/public/live`
  (`backend/app/routers/mandi.py`) — same payload as `/mandi/live`
  (`MandiLiveResponse` with `reportedDate`/`source`/`stale`), restricted to a
  whitelist of 6 showcase districts (Pune, Nashik, Indore, Rajkot, Karnal,
  Ludhiana) with limit ≤ 12. No auth, no writes; the gov-feed cache is shared
  with the authenticated endpoints.
- Frontend: `mandi.publicLive()` in `website/src/lib/api/mandi.ts`; the landing
  effect rotates across the showcase districts, maps live rows onto the radar
  cards (modal price + min–max range + variety/grade), shows a
  "Live feed · reported \<date\> · Open Government Data Platform India" label
  (with a "cached snapshot" note when `stale`), and keeps the hardcoded
  benchmark only as a last-resort error fallback. The farmer Mandi Desk
  (`/farmer/mandi`) flow is unchanged.
- Guard: `playwright-scripts/specs/landing-mandi-live.spec.ts` asserts the
  anonymous landing page renders the live label and a 200 from the endpoint.

### Landing FAQ — searchable, 9-persona accordion (2026-11-16)

"Got Questions? We Have Answers." was a static 6-item accordion; it is now a
dynamic, searchable dataset organized around the 9 finalized personas
(`FAQ_PERSONAS` + `FAQ_DATA` in `LandingPage.tsx`): 18 Q&As (2 per persona),
persona filter chips (All + 9), live text search over question/answer text,
persona tag on every item, and an empty state. The **All filter shows only the
5 latest questions** (with a "Showing the 5 latest questions — filter by a
persona…" hint); persona chips still show that persona's full set. 5 old
answers were reused verbatim where they fit (escrow→Farmer, PMFBY→Farmer,
7/12→Landlord, bilty→Transporter, doodhwala→Milk Vendor); the gaushala
question (persona no longer on the page) was replaced. Guard:
`specs/landing-faq.spec.ts`.


### What was deliberately NOT changed

- **Backend** — all 21 persona ids, routers, and data untouched.
- **Routing** — `/exporter`, `/directbuyer`, `/coldStorageProvider`, `/gaushalaManager`
  routes still exist and work; existing users of those personas keep full access.
- **Shared persona registries** — `personas.ts` `ALL_PERSONAS` and `i18n.ts` persona
  labels still list every persona (they drive register, profile-switch, and settings).
- **Landing page body/footer** — tech-engine tabs, FAQ, and footer links that mention
  the removed personas remain as-is (out of scope for this change).

## 4. Backend (`backend/`)

- FastAPI app (`backend/app/main.py`) with Sentry, CORS, Firebase App Check,
  Firestore persistence, and seed data (schemes, mandi, courses, insurance, etc.).
- `backend/secrets/` holds service-account keys (never commit changes there).

## 5. Verification (2026-11-16 changes)

- `pnpm build` in `website/` — TypeScript check + Vite production build passed;
  women hub chunks (`WomenGruhUdyogView`, `women-*`) emitted; "Explore 9 Personas",
  "All 9 Personas", and the 🪔 card content confirmed in the bundle.
- Playwright `removed-pages.spec.ts` — 6/6 passed (incl. new "women hub renders
  again": `/womenShg` and `/women/directory` render with zero page errors; the
  other removed pages still redirect).
- Playwright `00-smoke.spec.ts` — 3/3 passed (backend, website, superadmin serve).
- Playwright `landing-mandi-live.spec.ts` — 1/1 passed (anonymous landing renders
  the live gov-feed label; `GET /mandi/public/live` → 200 without a token).
- App flow intact — login/register/profile-switch restored for womenShg; all
  previously removed pages (loans, insurance, vault, livestock, bank accounts,
  carbon) remain removed; authenticated `/mandi/live` and the Mandi Desk
  unchanged; superadmin untouched.
