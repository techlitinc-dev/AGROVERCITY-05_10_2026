# Agrovercity — Headless Persona UAT (Playwright)

Human-like, headless Playwright suite that walks **every option of every persona**
on the Agrovercity website, captures browser console errors / failed API calls /
screenshots per page, and generates per-persona `troubleshoot/*.md` repair docs
you can hand to an AI agent.

## Prerequisites

- `./run.sh` (or `run.sh prod`) started: website `:5173`, API `:8000`, superadmin `:5174`
- Node 20+

## Setup

```bash
cd playwright-scripts
npm install
npx playwright install chromium   # already satisfied if ~/.cache/ms-playwright has chromium-*
```

## Run

```bash
npx playwright test                 # everything (4 headless workers)
npx playwright test -g farmer       # one persona only
npx playwright test specs/auth.spec.ts   # real UI login journeys
npx playwright show-report          # HTML report
```

## What runs

| Spec | Covers |
|---|---|
| `00-smoke` | API `/v1/health`, both SPAs serve |
| `auth` | Real UI login: MPIN, OTP registration, 1-Click Demo |
| `personas` | One walk per persona — all routes, tabs, create-dialogs (never submits payments) |
| `shared` | Common pages: notifications, KYC, chat, billing, settings… |
| `superadmin` | All 17 governance panels on `:5174` |
| `cross-persona` | One story across 5 actors: farmer lot → buyer requirement → vyapari/trade → transporter loads → customer mall/cart |

## Outputs

- `results/<persona>/report.json` — machine-readable per-page verdicts
- `results/<persona>/screenshots/*.png` — one screenshot per page
- `troubleshoot/<persona>.md` — repair docs (regenerate with `npm run report`)

## How personas log in

The dev backend exposes `POST /v1/auth/quick-login` (seeded personas) and
`POST /v1/auth/onboard` (any persona, creates a full account) with dev MPIN
`1234`. The suite mints the session through those endpoints, injects it into the
website's auth store, and then drives the browser exactly like a user. The real
UI login journeys are separately covered by `auth.spec.ts`.

Test accounts created by onboard personas: `+919100000101…107` ("PW Test …").

## Note: rendering shim

The landing/login pages render a full-screen particle canvas; on this GPU-less
VPS the page janks (~15fps) and Playwright's actionability checks starve. Every
browser context therefore installs a tiny init script that (a) disables CSS
animations/transitions and (b) caps `requestAnimationFrame` at ~30fps. It only
affects decorative rendering — all application JavaScript still executes, and
console/page errors are still captured. See `perfShim()` in `lib/harness.ts`.
