# Farmer ↔ Landlord connections in the farmer's "My Connections"

## Goal

Connections between a farmer and farm landlords were only visible inside the
farmer's **Lease Farm Land** page (`/farmer/land`). The farmer persona's
**My Connections** page (`/farmer/connections`, sidebar: "My Connections /
माझे संपर्क") showed only produce-trade leads (vyaparis, industrial buyers).
This change surfaces farmer–landlord connections in My Connections too, making
the farmer side symmetric with the landlord's "My Connections / Leases" page.

## What changed

### Backend — `backend/app/routers/land.py`

- `GET /land/lease-requests/mine` (farmer's sent interest requests) now joins
  the **landlord's display name** onto each row as `landlordName` (same join
  style `GET /land/requirements/mine` already used for response landlord
  names). Purely additive — response shape, ordering, and the contact-hiding
  rule (contacts omitted until `contactRevealedAt`) are unchanged.

### Frontend — new `website/src/views/farmer/FarmerLandConnectionsSection.tsx`

A self-contained "Farm Land / जमीन भाडे" section, rendered inside
`website/src/views/trade/MyConnectionsView.tsx` only when `persona ===
'farmer'`. It fetches the two existing farmer-side endpoints:

- `GET /land/lease-requests/mine` — interest the farmer sent on landlord
  listings. Each row shows: listing (acres · village), landlord name,
  Verified Landlord / Land Docs Verified badges, status badge, duration /
  start date / crop / offered rent, the farmer's message, counter-offer note
  (`countered` status), user-reported final rent, decline reason, and
  timestamp. Actions (same rules as `/farmer/land`):
  - pending → **Withdraw**
  - contacted / dealDone / dismissed → **Update Outcome**
  - after contact unlock → Call / WhatsApp / **Chat** (contacts stay hidden
    until the landlord accepts, enforced server-side as before)
  - dealDone → **Rate landlord**, **Report**
- `GET /land/requirements/mine` — landlord responses to the farmer's posted
  "I need land" requirements. Each response renders as a connection row with
  the landlord's name, verification badge, the requirement summary (acres ·
  district · duration · crop), the landlord's message, and **Chat with
  landlord**.
- Ends with the shared `NegotiationChecklist` guidance block.

The section renders **nothing** when the farmer has no land activity, so the
page is pixel-identical to before for everyone else. Failures are contained:
an error in the land endpoints shows an inline dismissible banner and never
breaks the trade-leads list below.

### Test — `backend/tests/test_land_direct_connect.py`

New `test_farmer_mine_includes_landlord_name`: asserts `landlordName` is
present after contact acceptance and on pending requests, and that pending
requests still omit `landlordContact`.

## What was deliberately NOT changed (flow safety)

- `leads.py` (trade leads) and the seller/exporter personas untouched.
- `/farmer/land` (`FarmlandView`) untouched — land connections still show
  there as before; both views read the same endpoints.
- Landlord views (`LandlordConnectionsView`, Interest Requests) untouched.
- No changes to notification deep links, chat, ratings backend, or the
  outcome/contact-unlock endpoints.
- Contact privacy rule unchanged: phone/WhatsApp appear only after the
  landlord's accept-contact (or the stored reveal on legacy records).

## Verification

- `pytest tests/test_land_direct_connect.py tests/test_land_requirements.py
  tests/test_leads.py` → **40 passed** (includes the new test).
- `pytest tests/test_land.py tests/test_land_market.py
  tests/test_land_missing_endpoints.py` → **29 passed**.
- `pnpm build` (website) → `tsc --noEmit` + vite production build succeed.
- Live smoke on the running dev stack: backend reloaded clean (`/v1/health`
  → ok), vite dev server transforms both the new section and the edited
  `MyConnectionsView` without error (HTTP 200).

## Assumptions made (questions weren't answered)

- Scope includes **both** directions: lease interest requests on listings AND
  landlord responses to farmer-posted land requirements.
- Land rows appear as a clearly headed section **above** the existing trade
  leads (which are unchanged), rather than one interleaved list — keeps the
  two flows visually distinct and zero-risk for the existing list.
