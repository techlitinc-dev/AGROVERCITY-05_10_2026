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

---

# My Land Listings — 7/12 upload removed, Photo → Farm Land Photo (2026-11-05)

## Goal

In the **Farm Landlord** persona's **My Land Listings** page
(`/landlord/listings`), stop asking landlords to upload 7/12/ownership
documents: the "Land Verification (private)" panel's upload + "Submit for
Review" button and the Add/Edit form's "Private Document (7/12, ownership)"
field are removed. The verification panel remains as a **status-only**
display (Docs Not Submitted / Under Review / Verified / Rejected). The
form's **Photo** field is renamed to **Farm Land Photo (optional)** — it was
already optional in code (no `required` mark; backend defaults to an empty
list), and the label now says so.

## What changed

### Frontend — `website/src/views/landlord/LandlordListingsView.tsx`

- "Land Verification (private)" panel is now status-only: file input,
  "Choose 7/12 or ownership doc" label, and "Submit for Review" button
  removed; the panel keeps its header and renders the existing
  `verificationChip(l)` plus the privacy note.
- Add/Edit form: "Private Document (7/12, ownership)" upload block removed.
- Form state cleaned up: `documentUrl` removed from `EMPTY_FORM`/`openEdit`,
  the `landDocuments` payload line dropped, and the now-dead
  `submitDocuments` handler deleted along with the unused `Upload` icon
  import.
- "Photo" label → "Farm Land Photo (optional)"; button text
  "Upload/Change Farm Land Photo"; image `alt` updated.
- Page subtitle updated ("…a farm land photo (optional). …document review by
  verification personnel — identity KYC alone never earns it."); view
  docblock comment updated to match.

### Frontend — `website/src/views/landlord/LandlordHome.tsx`

- "Add Land" card copy no longer mentions "private documents".

### Backend — none

- `photos` and `landDocuments` were already optional
  (`LandListingIn`, `backend/app/models/land.py`), and `update_listing`
  uses `exclude_unset`, so editing a listing no longer sending
  `landDocuments` cannot wipe previously stored documents.

## What was deliberately NOT changed (flow safety)

- The verification status chips and the **admin review path** are intact —
  listings can still reach "Land Docs Verified" via admin verification; the
  badge is never inferred from KYC or an upload.
- Sidebar "Land Verification" still redirects to `/landlord/listings`.
- The farmer side (`FarmlandView`, `/farmer/land`) is untouched — it only
  reads listings and badges.
- `LandlordPlotsView`'s "Search 7/12 Record" is a separate (legacy,
  redirected) plots-registry feature and was left alone.
- The `land.submitLandDocuments` API client function remains in
  `website/src/lib/api/land.ts` (now unused by the UI) to keep the change
  surface minimal.

## Verification

- `pnpm build` (website) → `tsc --noEmit` + vite production build succeed.
- Live headless-browser smoke on the running dev stack (temporary script,
  removed after the run) → **22/22 checks passed**:
  - No 7/12 upload control anywhere on My Land Listings; panel shows the
    status chip only.
  - Created a real listing with **no photo and no document** — succeeds,
    card renders with "Docs Not Submitted".
  - Edit modal opens/saves cleanly (no references to removed fields);
    Withdraw status action works.
  - Farmer persona `/farmer/land` still lists landlord listings — the
    landlord→farmer connection flow is intact.
  - No page errors on either flow.
- No e2e spec depends on the removed UI (the 7/12 e2e tests cover the
  farmer's land vault, a different feature).
- Smoke listings deleted from the DB afterwards; no stray files left.

## Assumptions confirmed with the requester

- Remove the 7/12 upload from **both** the verification panel and the
  Add/Edit form.
- Keep the "Land Verification (private)" panel, showing **status only**.
- No persona label renaming — "farmer landlord to farmer" referred to the
  landlord→farmer listing connection, which was verified still working.

---

# Transporter Job Inbox — farmer booking requests, apply/reject (2026-11-05)

## Goal

A farmer's transport requirement (posted on `/farmer/transport` → "Post a
Transport Requirement"), including one with the vehicle type set to **"Any
suitable vehicle"** (`preferredVehicleType: "Any"`), reached the transporter
only via the Load Board tab of Transporter Home. The **Job Inbox**
(`/transporter/inbox`) — the surface labelled "Direct booking requests from
farmers/shippers" — showed only direct bookings, so a farmer's request was
invisible there ("Inbox zero"). This change surfaces farmer booking requests
in the Job Inbox with full details and filters, and lets the transporter
**apply with a quoted fare** or **reject** a request — the farmer is notified
in real time either way.

## What changed

### Frontend — `website/src/views/transporter/JobInboxView.tsx`

- New **"Farmer Booking Requests"** section at the top of the Job Inbox:
  lists open load-board requirements (`GET /transport/loads`) with crop +
  quantity, route, pickup date/time, packaging, wanted vehicle ("Any suitable
  vehicle" or a specific type), target fare, notes, urgent badge and
  application count.
- **Filter bar** (all server-side via `GET /transport/loads` params): crop,
  pickup-contains, drop-contains, vehicle type (incl. an "Any suitable
  vehicle" option), pickup date, urgent-only — with Filter/Reset.
- **Apply — Quote Fare** per request: quote → vehicle (verified fleet
  vehicles free on the pickup date) → direct-connect terms → MPIN → done.
  Reuses the existing bid flow; the card then shows "Applied — awaiting
  farmer". Disabled with a hint when no vehicle is free on the pickup date.
- **Reject** per request: optional reason → confirm. The request disappears
  from this transporter's board and inbox and stays open for everyone else.
- New API client methods in `website/src/lib/api/transport.ts`:
  `declineLoad`, `myLoadDeclines`.

### Backend — `backend/app/routers/transport.py` + `backend/app/models/transport.py`

- `POST /transport/loads/{id}/decline` (new): records the decline (subcollection
  + per-transporter index), idempotent per transporter, and notifies the
  farmer in real time (in-app notification + FCM push, `type: load_declined`).
- `GET /transport/loads/declines/mine` (new): load ids this transporter
  declined (only still-open ones), registered before `/loads/{load_id}` so it
  is not shadowed.
- `GET /transport/loads` `vehicleType` filter now also surfaces **"Any
  suitable vehicle"** requests — a filtered board (e.g. "Tata Ace") includes
  them, since that vehicle type can carry them.
- `GET /transport/loads/matched` scoring fix: an "Any suitable vehicle"
  request now scores `vehicle_match` (+2) when the fleet's max capacity can
  carry the load in one trip (same rule as the `matchingFleet` filter); it
  previously never matched (exact string compare) and sank with score 0.

## What was deliberately NOT changed (flow safety)

- The existing **bid/apply contract is untouched** — same bid endpoint,
  capacity gate, MPIN step-up, duplicate-bid guard and contact-reveal rules.
  Apply notifications to the farmer (`load_bid_received`) already existed.
- Direct bookings in the Job Inbox (accept/reject/negotiate/chat), the Load
  Board tab, fleet, templates — all unchanged.
- Farmer side unchanged: requests still live in "My Posted Requirements" with
  Applications → accept to reveal contact.
- No FCM infrastructure changes (see note below).

## Verification

- `pnpm build` (website) → `tsc --noEmit` + vite production build succeed.
- Backend: `pytest tests/test_transport.py tests/test_transport_bids.py
  tests/test_transport_direct_connect.py tests/test_transport_missing_endpoints.py
  tests/test_ai_transport_match.py` → **73 passed**.
- Live headless-browser smoke on the running dev stack (temporary script,
  removed after the run) → **29/29 checks passed**: two "Any" requests
  (incl. one urgent) posted by the farmer appear in the transporter's Job
  Inbox with full details; crop filter narrows and resets; apply-with-quote
  through the real modal + MPIN → farmer gets `load_bid_received` in real
  time and sees the quote (Applications (1)); reject → farmer gets
  `load_declined`, request hides from the inbox and stays hidden after
  reload; matched-loads now reports `vehicle_match` for "Any" loads; no page
  errors on either persona.
- Smoke data cleaned up (loads cancelled, test vehicle deleted).

## Notes / assumptions

- "Approve" from the transporter side maps to **applying with a quoted fare**
  (the load-board model has the farmer accept an application; contact reveal
  rules unchanged).
- **Pre-existing environment issue, not introduced by this change:** any
  endpoint that sends an FCM push (bid, decline, cancel, …) blocks ~25-30 s
  in this dev environment because `send_fcm_to_user` calls the synchronous
  Firebase SDK inline and FCM is unreachable here. In-app notifications land
  normally; with working FCM credentials the delay disappears.
- The dev DB had no vehicle rate card (`vehicle_catalog` collection); it was
  seeded with `scripts/seed_vehicle_catalog.py` (6 types) so the farmer's
  vehicle-type dropdown and the transporter filters work.
