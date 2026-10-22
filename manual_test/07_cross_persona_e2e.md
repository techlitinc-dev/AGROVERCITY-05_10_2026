# Cross-Persona E2E — Multi-User Roleplay Script (Final UAT)

> This is the **final document of the manual UAT suite** and the **release gate**. The six persona
> scripts prove that each persona works alone; this script proves the **marketplace works between
> personas**: a farmer's onion reaches a vyapari's shop, a gadi carries it, a customer in Pune buys
> a papad made by a Nashik SHG and a sapling from a nursery, and every rupee and every notification
> is correct on **both** sides of every hand-off.
>
> Run this with **3 human testers acting simultaneously**, each holding one device per persona
> (see §0). Two testers are the minimum (then run personas sequentially where noted). These are the
> P0 scenarios: **a P0 failure here blocks release**, no matter how green the solo scripts are.
>
> Read `manual_test/README.md` first — environment, defect template (§5), priority meaning (§4)
> and the sign-off matrix (§7) all apply. Character names, phones and test values are reused from
> the six persona docs (`01`–`06`); where those docs gave placeholders this doc fixes concrete
> values (see §0 note).

---

## 0. Cast & devices

| Tester | Persona (roleplay) | Account / phone | MPIN | Device & surface |
|--------|--------------------|-----------------|------|------------------|
| **A** | **Ramesh Patil** — Farmer (Kisan), Nashik | +91 98220 00001 | 4321 | Android phone — Flutter app (primary); laptop browser for farmer web views (`/farmer/*`) |
| **A** | **Meena Deshmukh** — E-Market Customer, Pune | +91 98220 70001 | 1234 | Second phone (or phone browser) — app **and** `/mall` website |
| **B** | **Suresh Jadhav** — Transporter, Nashik | +91 98220 44710 | 1234 | Android phone — app; laptop browser — Transporter Logistics Cockpit (`/transporter/*`) |
| **B** | **Sunita Patil** — Mahila Graha Udyog, "Mauli SHG" | +91 98220 11101 | 2468 | Laptop browser — Women hub / Gruh Udyog Studio (`/community/women`) |
| **B** | **Prakash Bhosale** — Nursery, "Bhosale Fruit Nursery" | +91 98220 00005 | 1234 | Laptop browser — Nursery hub (`/nursery/*`, separate Chrome profile) |
| **C** | **Anil Agrawal** — Vyapari, "Anil Agro Traders", Lasalgaon APMC | +91 98220 40001 | 1234 | Laptop browser — Seller web panel (`/seller/*`) |
| **C** | **Broker second account** (Anil's `broker`-role profile) | +91 98220 40008 | 1234 | Same laptop, second browser profile (Broker desk `/broker/*`) — used in XP-11 only |
| **C** | **[ADMIN]** Super-Admin panel | admin account | — | Super-admin web panel, second tab |

> **Cast consistency note.** All persona docs and this doc use one canonical cast: Ramesh Patil
> **+91 98220 00001**, Meena Deshmukh **+91 98220 70001**, Suresh Jadhav **+91 98220 44710**,
> Sunita Patil **+91 98220 11101**, Prakash Bhosale **+91 98220 00005**, Anil Agrawal **+91 98220 40001**
> (broker profile **+91 98220 40008**).
> One phone = one account; never share accounts between testers.

**All six accounts must be fully ready before Day 1** (checklist): KYC **verified** [ADMIN];
bank account penny-drop **verified** and **primary**; MPIN set as in the table; Sunita's FSSAI
certificate **verified** [ADMIN] (needed to publish food products); Prakash's nursery profile saved
with bank + settlement UPI `prakash.bhosale@okaxis`; Anil's shop KYC verified (APMC licence +
GSTIN `27ABCDE1234F1Z5`); demo MPIN users use `1234`, Ramesh uses `4321`.

**Balance snapshot (do this first, use in every money table):** before XP-01 starts, every tester
writes down their current wallet / bank / coins balance in their notes. Money tables below give the
exact **Change** per step; the tester computes **After = Before + Change** and verifies it on screen.

**Shared sandbox values:** UPI IDs — ramesh.patil@upi, anil.agrawal@upi, suresh.jadhav@okhdfcbank,
sunita.mauli@okaxis, meena.deshmukh@upibank. Razorpay in test mode (dev fallback signature `dev`;
payouts auto-`processed` when keys unset). Test outside quiet hours 21:00–06:30 or disable quiet
hours in notification preferences, or push notifications will be silently digested.

---

## 1. Ground rules for simultaneous roleplay

1. **Stay in character, on your own device.** Use only the screens/menus your persona would see.
   Seeing another persona's private data, buttons, fares or phone numbers = **defect** (permission
   leak) — file it per README §5.
2. **Hand-off steps are marked 🔔.** After every 🔔 step the *receiving* actor must open their
   **bell / notification list** (or the named screen) and confirm within **2 minutes** before the
   sender moves on. The expected text is given in the step and summarised in XP-08.
3. **Blocked hand-off = ⛔.** If the receiver sees nothing: mark `⛔ BLOCKED (step #, expected)`,
   take a screenshot, and skip only the steps that depend on it. A scenario with a blocked **P0**
   hand-off cannot be marked Pass.
4. **Timeboxing.** Each scenario has a "~Duration" in §2. If a waiting step exceeds 10 minutes,
   call a huddle; do not improvise test data — the flows depend on exact values.
5. **Money on both sides.** For every money step, both parties verify their own number *first*,
   then cross-check the other side in the next hand-off. Commission/TDS math is worked out in the
   money tables — challenge any number that does not match.
6. **Admin steps [ADMIN]** are done by Tester C on the super-admin panel, announced out loud
   ("Admin approved KYC, continue"), never silently.
7. **Chat discipline (XP-07).** From the moment an offer/bid exists until delivery, all
   coordination happens **in-app** (statuses + in-app chat). Never type phone numbers, UPI IDs or
   links into chat — that is exactly what XP-07 must prove the app blocks.
8. **Date discipline.** "Today" = the test day. Use `2026-10-23` for tomorrow's pickup dates unless
   the test day changes; all "needed-by" dates ≥ today.

---

## 2. Scenario summary table

| ID | Title | Personas acting | ~Duration | Priority | Depends on |
|----|-------|-----------------|-----------|----------|------------|
| XP-01 | Farmer → Vyapari produce sale via demand (negotiate 3 rounds → escrow → QC → payout) | Ramesh, Anil, [ADMIN] | 60–75 min | **P0** | — |
| XP-02 | Farmer books transport (load board → bids → trip → POD → payout) | Ramesh, Suresh, [ADMIN] | 60–75 min | **P0** | — (runs parallel to XP-01) |
| XP-03 | Customer buys from Vyapari Krishi Mall storefront (+ return/refund variant) | Meena, Anil, [ADMIN] | 45 min | **P0** | Anil's SKU listed |
| XP-04 | Customer buys Mahila Graha Udyog (SHG) product from the mall | Meena, Sunita | 30 min | **P0** | Sunita's product published |
| XP-05 | Customer orders plants from Nursery (batch FEFO, coupon, stock-exhaustion edge) | Meena, Prakash | 40 min | **P0** | Prakash's plant + batch |
| XP-06 | Cross-seller dispute → [ADMIN] resolution → refund on both sides | Meena, Prakash, [ADMIN] | 25 min | P1 | XP-05 |
| XP-07 | Chat compliance mid-deal (phone / UPI / URL blocked, deal still completes) | Ramesh, Anil (reuse XP-01 chat) | 15 min | **P0** | XP-01 steps 7–8 |
| XP-08 | Notification matrix run (bell check after every trigger) | all | runs inside XP-01/02/03/05 | P1 | XP-01, XP-02, XP-03, XP-05 |
| XP-09 | Vyapari books transport (seller as booker) for the purchased onions | Anil, Suresh | 25 min | P1 | XP-01 |
| XP-10 | Farmer ↔ Nursery: nursery directory + farmer buys saplings from the mall | Ramesh, Prakash | 20 min | P2 | XP-05 (plant listed) |
| XP-11 | Broker (dalal) deal with farmer: e-sign with MPIN, milestones, escrow, payout | Ramesh, Anil-broker, [ADMIN] | 35 min | P1 | — |
| FM-01 | Transporter cancels inside pickup window → no-show strike (+ farmer late-cancel penalty) | Suresh, Ramesh | 15 min | P1 | XP-02 |
| FM-02 | Seller rejects a paid order → buyer refund path | Sunita, Meena | 10 min | P1 | XP-04 |
| FM-03 | Customer cancels after dispatch → blocked; cancel of a paid placed order → refund | Meena, Anil | 10 min | P1 | XP-03 |

---

## 3. Scenarios

---

### XP-01: Farmer → Vyapari produce sale via demand — negotiation, escrow, QC, payout
- **Priority:** P0      **Personas:** Ramesh (A), Anil (C), [ADMIN] not needed after KYC
- **Story:** Anil Agrawal needs 500 q of Nashik Red onions for his Lasalgaon shop this week and
  posts a demand. Ramesh Patil has 20 q ready at his farmgate. They haggle through the structured
  offer counter (3-round cap), Anil books via escrow, his pickup agent collects against a handover
  OTP, QC passes, and the escrow releases to Ramesh minus the 2% platform commission.
- **Setup/preconditions:** Both KYC-verified; bank accounts verified+primary; balances snapshotted.
  Anil's demand and Ramesh's offer values are exact — do not round.
- **Test data:** Demand = Onion, grade A, **500 q**, max **₹1,500/q**, delivery Lasalgaon (Nashik),
  frequency weekly, needed-by 2026-10-25. Offer = **20 q @ ₹1,450/q**. Negotiation: counter 1
  ₹1,400 → counter 2 ₹1,430 → counter 3 ₹1,420 (cap) → **accept @ ₹1,420**. Purchase total =
  20 × 1,420 = **₹28,400**. Advance 15% = **₹4,260** (escrow). Balance = **₹24,140**. Commission
  2% (min ₹50) = **₹568**. Farmer payout = **₹27,832**.

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 1 | Anil (C) | Open `/seller/demands` → **Post Demand** → crop Onion, variety Nashik Red, qty 500, unit quintal, grade A, max price ₹1,500/q, delivery location "Lasalgaon APMC, Nashik", frequency weekly, needed-by 2026-10-25 → Submit | Demand saved, status **open**, appears in "Open Buyer Demands" with buyer summary (verified badge, capacity, rating). No notification is sent for posting — farmers find it by browsing (verified in step 3) |
| 2 | Anil (C) | Keep the demand card open on screen | — |
| 3 | Ramesh (A) | Mobile app → Sell Produce / **Demands browse** (web: BuyerDemandsView) → filter crop Onion | Anil's demand visible with verified badge, max price ₹1,500/q, valid-until; buyer identity = business summary only, **no phone number shown** |
| 4 | Ramesh (A) | Tap the demand → **Send Offer / Make Offer**: price ₹1,450/q, qty **20**, message "Grade A Nashik Red, harvested 2026-10-20, farmgate pickup", pickup date 2026-10-23, payment terms 0 days, transport mode farmerDelivers → Submit | Offer status **pending**. 24 h expiry shown. One live offer per demand (re-submit returns the same offer, no duplicate) |
| 5 | 🔔 Anil (C) | Open bell (and `/seller/demands` → Offers Received) | Notification **offer_received** containing "New offer / नया ऑफर", Onion, ₹1,450/q, 20 q; `new_offers` task card on dashboard |
| 6 | Anil (C) | On the offer → **Counter**: price **₹1,400/q** → Submit (round 1/3) | Offer status **countered**; expiry clock restarts (24 h) |
| 7 | 🔔 Ramesh (A) | Open bell → open the offer | Notification **offer_countered** containing "round 1/3" and ₹1,400/q |
| 8 | Ramesh (A) | **Counter** back: **₹1,430/q** (round 2/3) → Submit | Offer status countered again (round 2/3) |
| 9 | 🔔 Anil (C) | Bell | **offer_countered** "round 2/3", ₹1,430/q |
| 10 | Anil (C) | **Counter**: **₹1,420/q** (round 3/3 = cap) → Submit | Offer countered, "3/3 rounds" shown; UI must show negotiation is at cap |
| 11 | Ramesh (A) | Try to **counter a 4th time** | **Blocked** — 400 `NEGOTIATION_CLOSED` / "negotiation closed"; counter button disabled |
| 12 | Ramesh (A) | Accept the offer at **₹1,420/q** (full 20 q) | **Purchase created**, status **confirmed**, total **₹28,400**. Lot-free logic n/a (demand target). Chat room created but composer **locked** until confirmation (check: chat shows "unlocks after confirmation") |
| 13 | 🔔 Anil (C) | Bell | **booking_confirmed** (₹28,400, Onion 20 q) AND **request_accepted** containing "chat is now open"; chat composer now enabled |
| 14 | Anil (C) | Purchase card → **Deposit Advance Escrow** → amount **₹4,260** (15% prefilled; min ₹100, max ₹28,400), channel "Kisan Setu Escrow Wallet" (or UPI), Submit | Payment captured; purchase status **advancePaid**; escrow banner **held ₹4,260** |
| 15 | 🔔 Ramesh (A) | Bell | **payment_received** containing ₹4,260 and "advance"; purchase visible in My Purchases as advancePaid with escrow banner held |
| 16 | Anil (C) | **Schedule Pickup Slot & Agent**: date 2026-10-23, slot **06-07**, agent **pa_sham** (from agent list), grace **60** min, vehicle MH-12-AB-1234 (Bolero Pickup), address "Gate 312, Pimpalgaon Baswant, Nashik" → Submit | Status **pickupScheduled**; pickup banner shows date/slot/agent/grace; 24 h & 2 h FCM alerts armed |
| 17 | 🔔 Ramesh (A) | Bell | **pickup_scheduled** containing date 2026-10-23, slot 06-07, agent name, grace 60 |
| 18 | Ramesh (A) | Open purchase chat → try the compliance probes (XP-07 steps 1–6 run **here**, inside this purchase chat) | Chat blocks phone/UPI/URL; deal continues in-app (see XP-07) |
| 19 | Anil (C) | On pickup day (or when Ramesh confirms ready): **Mark Dispatch** | Status **inTransit** |
| 20 | 🔔 Ramesh (A) | Bell | **dispatched** notification |
| 21 | Anil (C) | Agent reaches farmgate → **Mark Delivered** | Status **delivered**; handover OTP verify field enabled |
| 22 | 🔔 Ramesh (A) | Bell | **delivered** containing "share the handover OTP now" |
| 23 | Ramesh (A) | Purchase detail → **Handover OTP** (GET reveal) → read the **6-digit OTP** aloud to Tester C (voice, not chat) | OTP screen shows 6-digit code, 15-minute validity, 5 attempts max. OTP is **never** visible in Anil's app (redacted from buyer API) |
| 24 | Anil (C) | **Verify Handover OTP** → type the OTP → Submit | **handover_verified**; escrow release clock starts (release = finalAmount − commission) |
| 25 | 🔔 Ramesh (A) | Bell | **handover_verified** notification |
| 26 | Anil (C) | **Conduct Digital QC Inspection**: grade A, accepted qty **20**, rejected qty **0**, notes "Dry, well-cured onions" → **Approve & Release Settlement** | Status **completed**; escrow **released**; events log shows QC + release |
| 27 | 🔔 Ramesh (A) | Bell + wallet/bank screen | **deal_completed** (with invoice number); payout **₹27,832** credited (₹28,400 − ₹568 commission); verify amount against the money table below |
| 28 | Anil (C) | Purchase card → **Pay Balance** → amount **₹24,140** (max due), method bank_transfer, UTR auto → Submit | Balance payment recorded; payments[] shows advance + balance; **no double-pay** (replay returns same result) |
| 29 | Anil (C) | **Invoice (PDF)** → download `GET /purchases/{id}/invoice.pdf` | GST invoice opens: 5% agri slab, intra-state CGST+SGST split, total ₹28,400; **Commission Invoice** (2% = ₹568, `GET /purchases/{id}/commission-invoice`) also opens |
| 30 | Anil (C) | **Rate Farmer**: 5 stars, tags fair_price + on_time + honest_weight, comment "Clean lot, accurate weight" → Submit | Rating saved; `rated` notification fires to Ramesh |
| 31 | 🔔 Ramesh (A) | Bell → then Ratings → pending prompt | **rated** "You got a rating ⭐"; open prompt kind **lot_sale** |
| 32 | Ramesh (A) | Rate Anil: 5 stars, comment "Payment on time, fair negotiation" → Submit | Rating saved; duplicate attempt blocked 409 `ALREADY_RATED` |
| 33 | Anil (C) | `/seller/ratings` → Reviews Received | Ramesh's review visible; **Reply** once (≤500 chars) → posted; second reply blocked |
| 34 | Ramesh (A) | `/ratings/mine` (web) | Aggregate shows Anil's rating; trust tier refreshed |

**Money check — XP-01 (escrow direct trade, commission 2% min ₹50, charged on the trade):**

| Party | Before | Change | After | Notes |
|-------|--------|--------|-------|-------|
| Anil — escrow wallet/UPI | snapshot | **−₹4,260** (advance) then **−₹24,140** (balance) | snapshot − 28,400 | Advance held in escrow, then released to Ramesh side; balance paid post-completion |
| Platform commission | — | **+₹568** (2% × 28,400 ≥ ₹50 floor) | — | Shown on Anil's commission-invoice PDF and Ramesh's receipt |
| Ramesh — bank/wallet payout | snapshot | **+₹27,832** | snapshot + 27,832 | = ₹28,400 − ₹568. Verify credit amount exactly; note in Notes how much arrived via escrow release vs balance settlement |
| Escrow state | unfunded | held ₹4,260 → **released** | released | Cancel would have refunded — not exercised here (see FM flows) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### XP-02: Farmer books transport — load board, bids, trip lifecycle, detention, POD, payout
- **Priority:** P0      **Personas:** Ramesh (A), Suresh (B), [C plays a second demo transporter for one step — fallback noted]
- **Story:** Ramesh's 20 q of onions (the XP-01 lot, or any test lot) must reach Nashik APMC
  tomorrow at 6 AM. Instead of hiring a known truck, he posts an open-auction load; Suresh bids,
  they haggle once, and the trip runs milestone-by-milestone with a weighbridge slip, a 90-minute
  loading detention, and a POD OTP at the mandi gate.
- **Setup/preconditions:** Suresh has ≥1 **verified** vehicle (rc+dl KYC verified, PUC/fitness/
  insurance unexpired) — else accept is blocked 422 `VEHICLE_NOT_VERIFIED`. Ramesh KYC-verified,
  bank primary, balance snapshotted. Second transporter account (any demo `dev-*` transport
  account) optional for step 6.
- **Test data:** Load = Onion 20 q (≈2.5 t incl. packing), route **Pimpalgaon Baswant → Nashik
  APMC (Gangapur), ≈35 km**, pickup 2026-10-23 **06:00**, window 60 min, target fare **₹2,300**,
  declared value ₹50,000, **insurance opt-in**. Vehicle needed: Tractor Trolley 3T. Suresh bids
  **₹2,500** → Ramesh counters **₹2,300** → accept. Fare **₹2,300**; insurance premium 0.8% ×
  ₹50,000 = **₹400**; detention: 90 min loading − 60 free = 1 slab × ₹150 = **₹150**. Commission
  10% = **₹230**; TDS 194-O 1% = **₹23**.

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 1 | Suresh (B) | Web cockpit `/transporter` → tab **Load Board** → card **Fare Estimate**: vehicleType Tractor Trolley, distanceKm 35 → Get estimate | Estimate ≈ base ₹1,000 + 30×35 ₹1,050 + loading labour ₹300 (>10 km) + toll ₹0 (<50 km) = **₹2,350** shown with full breakdown; Suresh notes it as his bidding anchor |
| 2 | Ramesh (A) | Laptop, logged in as farmer → `/farmer/transport` → **Post Load** (open auction): crop Onion, qty 20 q, packaging jute bags, route Pimpalgaon Baswant → Nashik APMC Gangapur, pickup 2026-10-23 06:00 (window 60), vehicle type Tractor Trolley, target fare **₹2,300**, declared value ₹50,000, **insurance ON** → Submit | Load born status **open**, visible in My Loads; insurance premium ₹400 pre-computed on the card (coverage = min(declared, ₹5L)) |
| 3 | 🔔 Suresh (B) | Load Board (web or mobile "लोड बाज़ार") → open the load | Load card shows crop, 20 q, route + km, pickup date, target ₹2,300, bid count 0, "Place Bid" enabled |
| 4 | Suresh (B) | **Place Bid**: quoted fare **₹2,500**, vehicle Tractor Trolley (attach own trolley or "No vehicle attached"), note "At gate by 5:45, tarpaulin available" → Submit | Bid accepted, status pending; FCM fired to load owner |
| 5 | 🔔 Ramesh (A) | Bell + load detail → **Bids** tab | FCM/in-app **"नया भाड़ा प्रस्ताव (Bid Received)"** containing ₹2,500; bid list sorted by quoted fare with Suresh's trust card (verified badge, trips, rating) — **no phone number shown** |
| 6 | (C, demo 2nd transporter — optional) | Log in as demo transporter #2 → bid **₹2,450** on the same load → log out | Ramesh sees 2 bids: ₹2,450 lowest, ₹2,500; "Lowest bid ₹2,450" chip updates. *If no demo account exists, skip and note "compare UI exercised with 1 bid"* |
| 7 | Ramesh (A) | On Suresh's ₹2,500 bid → **Counter**: ₹2,300 → Submit | Counter recorded (one-round cap); FCM to Suresh |
| 8 | 🔔 Suresh (B) | Bell / app | FCM **"काउंटर ऑफर (Counter Offer)"** containing ₹2,300. A second counter from Ramesh is impossible (one counter per bid) |
| 9 | Ramesh (A) | **Accept Bid** (Suresh's) | **Booking born status `accepted`** with fare **₹2,300**, Suresh's vehicle attached; load → `booked`; chat room created |
| 10 | 🔔 Suresh (B) | Bell | **"बोली स्वीकृत! (Bid Accepted)"** + `trip_pickup_reminder` + **chat_unlocked** (deep link to `/chat`) |
| 11 | 🔔 Ramesh (A) | Bell | **booking_confirmed** + chat_unlocked |
| 12 | Ramesh (A) | Booking detail → **Pay fare** (Razorpay test UPI ramesh.patil@upi): amount = fare ₹2,300 **+ insurance premium ₹400** = **₹2,700** → pay → verify signature | Escrow **held ₹2,700** (`fare_payment_captured`); paying again blocked 409 (duplicate capture returns `{ok, duplicate}`) |
| 13 | 🔔 Suresh (B) | Bell | **fare_payment_captured** containing ₹2,700 |
| 14 | Suresh (B) | Trip detail → **Mark Reached pickup** (`arrivedPickup`) | Status updated; farmer notified |
| 15 | 🔔 Ramesh (A) | Bell | **trip_arrived_pickup** (Hindi + English title, deep link to trip) |
| 16 | Suresh (B) | **Detention / Waiting card** → phase **Pickup** → **Start Timer** | Waiting event open (pickup phase allowed from accepted/arrivedPickup/loading/enRoute) |
| 17 | Suresh (B) | **Mark Loading** → wait — simulate the 90-minute loading (huddle: agree the loading took 90 min; do not actually wait; note "simulated delay" in Notes) | Status `loading` → farmer notified `trip_loading` |
| 18 | Suresh (B) | Mobile live-tracking → ping waypoint **"खेत पर पहुंचे / at_pickup"** then **"धर्मकांटा वजन / weighbridge"** → enter weighbridge slip: slipNo **DK-9842**, name "धर्मकांटा", tare **1420**, gross **4680** → net auto 3260 kg → Save | Waypoints appended to waypointsLog; farmer notified for milestone pings |
| 19 | 🔔 Ramesh (A) | Bell + live map | **weighbridge_recorded** containing net weight **3260 kg**; map shows last ping + waypoint trail (manual pings only — assert no continuous GPS claim) |
| 20 | Suresh (B) | **Stop Timer** (90 min elapsed) | Detention computed: 90 − 60 free = 30 min → **1 slab × ₹150 = ₹150** (cap ₹2,000); booking `detention` block shows ₹150 |
| 21 | 🔔 Ramesh (A) | Bell | **detention_recorded** containing "Waiting charges" and **₹150** |
| 22 | Suresh (B) | **Mark In transit** (`enRoute`) → ping **"हाईवे ट्रांजिट / in_transit"** | Status `enRoute`; farmer notified `trip_enroute` |
| 23 | Suresh (B) | At mandi → **Mark Reached destination** → **Mark Unloading** | Farmer notified `trip_reached_destination` then `trip_unloading` (bell each time) |
| 24 | Suresh (B) | **Digital Bilty** → View/Print | LR opens: `LR-2026-…`, consignor Ramesh / consignee line, freight lines (gross ₹2,300, loading ₹300, detention ₹150, advance 40%, balancePayable = 60% + 300 + 150), insurance block, weighbridge slip DK-9842, QR `AGRO-TMS-VERIFY-…`; Download PDF works |
| 25 | Ramesh (A) | Booking detail → **POD OTP** → reveal 6-digit OTP → say it aloud to Suresh (voice, not chat) | OTP visible to booker only, 15-min validity, 5 attempts |
| 26 | Suresh (B) | **Verify POD OTP** → enter OTP, receiver name **"Ramesh Patil"**, upload ≥1 delivery photo → Submit | OTP verified → status **delivered**; `pod` block (photos, receiver, deliveredAt); two rating prompts open (`transport_delivery` for Ramesh, `transport_shipper` for Suresh) |
| 27 | 🔔 Ramesh (A) | Bell | **trip_delivered** "inspect and rate your transporter" |
| 28 | Suresh (B) | **Trip Expenses**: add diesel ₹800, toll ₹0 → view net-profit card | netProfit = gross 2,300 + detention 150 − expenses 800 − commission 230 = **₹1,420** (green card) |
| 29 | Suresh (B) | **Escrow release** (manual `POST …/escrow/release`, or wait for auto-release job) | Escrow ₹2,700 released: commission 10% of fare ₹230 → platform; **TDS 194-O 1% ₹23** ledger line; net credited to Suresh's **wallet ₹2,047**; platform ledger line written |
| 30 | Suresh (B) | Wallet → **Request Payout**: amount ₹2,000, MPIN **1234** → Submit | Payout `tpay_…` to primary HDFC a/c …7890; status **processed** (sandbox); wallet balance reduced; UTR shown |
| 31 | Ramesh (A) | Ratings → pending **transport_delivery** → rate Suresh **5 stars**, tags load_ready_on_time + accurate_weight → Submit | Rating saved; Suresh's aggregate rating updates |
| 32 | 🔔 Suresh (B) | `/transporter/ratings` → Pending | **transport_shipper** prompt → rate Ramesh 5 stars, tag good_communication → Submit; duplicate blocked 409 `ALREADY_RATED` |
| 33 | Suresh (B) | Settlements tab | Weekly settlement line (role=transport): gross ₹2,300, commission ₹230 (10%), TDS ₹23, net ₹2,047, status pending→paid; **Commission Invoice** PDF opens per trip |

**Money check — XP-02 (transport escrow, commission 10%, TDS 194-O 1%, detention ₹150/30-min slab after 60 free, cap ₹2,000):**

| Party | Before | Change | After | Notes |
|-------|--------|--------|-------|-------|
| Ramesh — bank/UPI | snapshot | **−₹2,700** (fare + premium at booking) | snapshot − 2,700 | Detention ₹150 accrues as his liability (bilty balancePayable) — verify how it settles in Notes (added to Suresh's settlement or invoiced separately) |
| Insurance pool | — | **+₹400** premium (0.8% × 50,000, coverage ≤ ₹5L) | — | Recorded on booking; claim path = damage-dispute with `insuranceClaim:true` (not exercised here) |
| Suresh — wallet | snapshot | **+₹2,047** (2,300 − 230 commission − 23 TDS) then **−₹2,000** payout | snapshot + 47 | Net credit ₹2,047; payout of ₹2,000 to bank; detention ₹150 shown in trip P&L (receivable) — record actual settlement behaviour in Notes |
| Platform | — | **+₹230** commission | — | TDS ₹23 remittance line visible on `/transporter/wallet` "TDS Deducted" card |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### XP-03: E-Market customer buys from Vyapari Krishi Mall storefront (+ return/refund variant)
- **Priority:** P0      **Personas:** Meena (A), Anil (C), [ADMIN]
- **Story:** Meena Deshmukh in Pune buys inputs for her family farm gate in Nashik and
  finds Anil's "Kisan Urea 45kg" on the Krishi Mall. She checks the batch QR certificate, applies
  a coupon, pays by UPI, and tracks the parcel. Anil sees the order in his seller panel and fulfils
  it. A second, small order is used for the return/refund variant.
- **Setup/preconditions:** Meena's account (customer primary), addresses saved (Flat 502, Sunshine
  Residency, Baner Road, Pune 411045), sandbox UPI meena.deshmukh@upibank. Anil has listed the
  test SKU (from `03_vyapari.md`): **Kisan Urea 45kg, AgroGrow, Fertilizers, price ₹280, MRP ₹300,
  stock 100**; plus a second SKU for the return run: **AgroGrow Cattle Feed 5kg, ₹340, stock 50**.
  Coupon `WELCOME10` active (10%, min ₹0). Balances snapshotted.
- **Test data (order 1):** 2 × urea ₹280 = ₹560; coupon −₹56; delivery fee ₹99 (< ₹1,500) →
  **payable ₹603 via UPI**.

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 1 | Meena (A) | `/mall` → search "urea" → open **Kisan Urea 45kg** | Product page: price ₹280, MRP ₹300 struck through, "Sold by Anil Agro Traders", **View shop** works, stock not exposed (only inStock), "Ask seller" disabled with caption "Chat unlocks after order confirmation" |
| 2 | Meena (A) | **View QR Certificate** → modal | Quality certificate shown (batch fields); "Certificate unavailable" must NOT appear for this SKU |
| 3 | Meena (A) | Qty **2** → **Add to Cart** → View Cart | Cart = 2 × 280 = ₹560; qty steppers work; server cart is source of truth |
| 4 | Meena (A) | Checkout: address Flat 502 Baner (default), slot **4–7 PM**, coupon **WELCOME10** → Apply | Coupon valid: **−₹56**; delivery fee **₹99** (free-above-₹1,500 rule not met); coins line optional (redeem 20 coins → −₹20, if balance allows); "Plant a tree (₹0)" checkbox visible — tick it (tree_adoption written on order, XP note) |
| 5 | Meena (A) | Payment method **Instant UPI** → Pay **₹603** (Razorpay test) → verify | Razorpay signature verified → order **paid**; success screen "Order Placed Successfully!" with Track Order Timeline. Order id noted |
| 6 | 🔔 Anil (C) | `/seller` → Mall Orders tab + bell | New order card (items, ₹603, status **placed/paid**) + **"New order {id}"** notification: "You received a new Krishi Mall order (upi) for 1 item(s)…" + `new_order` task |
| 7 | Anil (C) | Order detail → **Confirm** (status advance placed/paid → **confirmed**, note "Packed 45kg bags") | Status confirmed |
| 8 | 🔔 Meena (A) | Bell + `/customer/orders/:id` timeline | **order_confirmed** "…is confirmed and is being packed by the seller"; timeline event appended |
| 9 | Anil (C) | **Mark shipped** | Status **shipped** |
| 10 | 🔔 Meena (A) | Bell | **order_shipped** "packed and handed over to pickup agent" |
| 11 | Anil (C) | **Mark out_for_delivery** | Status **out_for_delivery** |
| 12 | 🔔 Meena (A) | Bell | **out_for_delivery** "delivering today — keep your phone reachable" |
| 13 | Anil (C) | **Mark delivered** | Status **delivered** → rating prompt `marketplace_order` opened for Meena |
| 14 | 🔔 Meena (A) | Bell | **order_delivered**; order page shows **Invoice PDF** button and per-item **Rate** buttons enabled |
| 15 | Meena (A) | Download **Invoice PDF** (`/orders/{id}/invoice.pdf`) | "Agrovercity Krishi Mall - Order Invoice" opens with GST breakup and finalTotal ₹603 |
| 16 | Meena (A) | Rate the urea product: **5 stars**, comment "Genuine batch" → Submit | Review saved (one per user per product — second submit updates, not duplicates) |
| 17 | Anil (C) | `/seller/ratings` / product reviews | Meena's review visible; **Reply** posted once; second reply blocked 409 |
| 18 | Meena (A) | **Reorder** check: button enabled only on delivered order → tap → items re-added to cart | Reorder works (cart refilled); remove items to keep cart clean |

**Return/refund variant — XP-03b (second order):**

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 19 | Meena (A) | Order 1 × Cattle Feed 5kg (₹340) + fee ₹99 = **₹439**, UPI pay | Order paid; stock 50 → 49 |
| 20 | Anil (C) | Confirm → ship → out_for_delivery → **delivered** | Meena gets the 4 status notifications (bell each time) |
| 21 | Meena (A) | Order detail → **Request Return** → reason "Packet torn, feed spilled" (≥3 chars) → Submit | **returnStatus = requested**, **refundStatus = requested** (paid order); return badge on order list; notification to seller (verify type `return_requested`) |
| 22 | Anil (C) | Order shows **return_requested** flag | Seller sees the return request on the order card |
| 23 | [ADMIN] (C) | Super-admin → order tracking console → open order → approve return → status **returned**; then trigger refund `POST /payments/razorpay/refund` | Admin transition accepted; **refundStatus → processed** with `razorpayRefundId`; audit row written. *If refund endpoint answers 409 `REFUND_NOT_APPLICABLE` on a returned order, record actual behaviour as a defect note* |
| 24 | 🔔 Meena (A) | Bell + Wallet → Transactions | Refund notification/status line: **+₹439**, "Refunds Pending" → processed; receipt PDF downloads per row |
| 25 | Anil (C) | `/seller/orders/:id` | Order status **returned**; settlement line for it must NOT appear in `/seller/settlements` |

**Money check — XP-03 (mall order; seller commission 2% min ₹50, TDS 194-O 1% on marketplace GMV):**

| Party | Before | Change | After | Notes |
|-------|--------|--------|-------|-------|
| Meena — UPI | snapshot | **−₹603** (order 1) | snapshot − 603 | = 560 + 99 fee − 56 coupon |
| Anil — seller settlement (order 1) | — | gross ₹560 − commission **₹56** (2%) − TDS 194-O **₹5.60** (1%, Pro TDS statement) = **+₹498.40** net | — | Weekly settlement line role=seller; delivery fee ₹99 is platform logistics revenue, not seller gross — record actual split in Notes |
| Meena — UPI (order 2) | snapshot | −₹439 then **+₹439 refund** | snapshot + 0 | Refund to source; verify `razorpayRefundId` |
| Platform | — | +₹56 commission + ₹99 delivery fee (order 1) | — | Stock 100 → 98 on order 1 |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### XP-04: E-Market customer buys a Mahila Graha Udyog (SHG) product from the mall
- **Priority:** P0      **Personas:** Meena (A), Sunita (B)
- **Story:** Sunita's "Mauli Gruh Udyog" has published **Methi Papad 200g** (₹70, stock 20) with a
  verified FSSAI badge. Meena turns on **Women mode**, finds the listing via the **Women-led**
  chip, orders 3 packs, and Sunita fulfils it from her Gruh Udyog Studio. This proves the SHG
  reaches the marketplace and the money lands in the unit's ledger.
- **Setup/preconditions:** Sunita's unit **Mauli Gruh Udyog** active; product **Methi Papad 200g**,
  MRP ₹80 / selling ₹70 / stock 20, **published** and live (FSSAI cert verified by [ADMIN] — a
  pending cert still allows publishing with a visible pending badge); Sunita's bank account added.
  Meena logged in. Balances snapshotted.
- **Test data:** 3 × ₹70 = **₹210**; delivery fee ₹99 (< ₹1,500) → **payable ₹309**; gruh
  commission **5%** → settlement on delivery: revenue ₹210 − ₹10.50 = **net ₹199.50**.

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 1 | Sunita (B) | `/community/women` → Gruh Udyog Studio → Products card | Methi Papad 200g status **live** (published); mall sync fields shown (title, price ₹70, stock 20) |
| 2 | Meena (A) | Customer home → toggle **Women mode ON** → open `/mall` → tap **Women-led** chip | Women-mode lifts gruh/women_enterprise listings to the top; "Mauli Gruh Udyog" brand card shows unit name, category, village (Pimpalgaon Baswant, Nashik), "Women-led enterprise"; FSSAI **verified** badge visible (not "pending") |
| 3 | Meena (A) | Open Methi Papad 200g → qty **3** → Add to Cart → checkout (Flat 502 Baner, slot 10–1 PM) → UPI pay **₹309** | Order **paid**; 3 packs reserved (stock 20 → 17 on Sunita's side at accept latest) |
| 4 | 🔔 Sunita (B) | Studio → **Orders card** + bell | Order row appears: item count 3, "Krishi Mall customer", status **placed**, ₹309; (notification arrives per channel prefs — gruh fulfilment itself has no push; the order row is the source of truth) |
| 5 | Sunita (B) | **Accept** | Fulfilment **accepted** (order status placed/paid → accepted) |
| 6 | 🔔 Meena (A) | Bell | **order_confirmed** "…is confirmed and is being packed by the seller" |
| 7 | Sunita (B) | **Mark Packed** | Fulfilment **packed** |
| 8 | 🔔 Meena (A) | Bell | **order_shipped** "packed and handed over to the pickup agent" |
| 9 | Sunita (B) | **Mark Shipped** | Fulfilment **shipped** |
| 10 | 🔔 Meena (A) | Bell | **order_out_for_delivery** "delivering today. Please keep your phone reachable." |
| 11 | Sunita (B) | **Mark Delivered** | Fulfilment **delivered** → `_accrue_settlement` runs: one `gru_settlements` line (unit+order): revenue ₹210, commission 5% = ₹10.50, **net ₹199.50, status `accrued`** |
| 12 | 🔔 Meena (A) | Bell + order page | **order_delivered**; Rate button enabled |
| 13 | Meena (A) | Rate product 5 stars "Crisp, homemade taste" | Review saved on the product |
| 14 | Sunita (B) | Studio → **Earnings & Payouts card** | Delivered revenue **₹210**, platform commission **₹10.50 (5%)**, **Available ₹199.50**, Paid out ₹0 |
| 15 | Sunita (B) | **Request Payout**: amount **₹150**, MPIN **2468** → Submit | Payout accepted → status **processed** (dev auto-process); Available reduces to ~₹49.50; payout row with id in ledger |
| 16 | Sunita (B) | Wrong-MPIN probe: request another payout with MPIN **9999** | **Rejected** 401 `WRONG_MPIN`; no ledger entry |

**Money check — XP-04 (gruh settlement: accrued only on delivered; commission 5%, `gruhCommissionPct`; payout MPIN-gated):**

| Party | Before | Change | After | Notes |
|-------|--------|--------|-------|-------|
| Meena — UPI | snapshot | **−₹309** | snapshot − 309 | 210 + 99 fee |
| Sunita — unit available | snapshot | **+₹199.50** (accrual) − **₹150** (payout) | snapshot + 49.50 | revenue ₹210 − 5% ₹10.50; SHG group corpus unaffected (this is the unit ledger, not the SHG savings ledger) |
| Platform | — | **+₹10.50** commission + ₹99 delivery fee | — | Verify 5% figure exactly; gruh products are `bnplAvailable:false` — COD/BNPL must not be offered for this SKU |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### XP-05: E-Market customer orders plants from Nursery — batch FEFO, coupon, stock-exhaustion edge
- **Priority:** P0      **Personas:** Meena (A), Prakash (B)
- **Story:** Monsoon planting season: Meena orders 10 **Kesar Mango Grafted Saplings** from
  Prakash's nursery and uses his `GREEN15` coupon. Prakash watches the order decrement his oldest
  batch (FEFO), dispatches via AgroExpress, and gets paid net of the flat 5% nursery commission.
  The scenario ends with a hard stock check: ordering more saplings than the batch holds.
- **Setup/preconditions:** Prakash's **Kesar Mango Grafted Sapling** live (price ₹160, MRP ₹200,
  plant stock 100, min order qty 5, mirror product in the mall); **batch BATCH-2026-…. logged**
  (initial 200 → plant/product stock now 300); coupon **GREEN15** active (15%, min ₹500, cap ₹200).
  Meena logged in; balances snapshotted.
- **Test data:** 10 × ₹160 = ₹1,600; GREEN15 discount = min(15% × 1,600 = 240, cap 200) = **−₹200**;
  1,400 < ₹1,500 → fee ₹99 → **payable ₹1,499**. Nursery commission 5% on finalTotal = **₹74.95** →
  net ₹1,424.05. FEFO batch 200 → **190**.

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 1 | Prakash (B) | `/nursery` home → KPIs; `/nursery/batches` | Kesar Mango stock **300** (100 + batch 200); batch table shows BATCH-2026-…. current stock 200 |
| 2 | Meena (A) | `/mall` → category **plants** → open Kesar Mango Grafted Sapling | Price ₹160 (MRP ₹200 struck), "Sold by Bhosale Fruit Nursery", min order qty shown |
| 3 | Meena (A) | Qty **3** → Add to Cart | **Blocked at checkout/placement** — 422 `MIN_ORDER_QTY` (min 5). Edge verified |
| 4 | Meena (A) | Qty **10** → Add to Cart → checkout → apply coupon **GREEN15** | Discount capped at **₹200** (15% would be ₹240); subtotal ₹1,400; fee ₹99 → payable **₹1,499** |
| 5 | Meena (A) | Pay by UPI (sandbox) | Order **paid**; coupon `usedCount` +1 |
| 6 | 🔔 Prakash (B) | `/nursery/orders` (New Orders tab) + bell | New order card: 10 × Kesar Mango, ₹1,499, "Includes ₹200 coupon discount", payment UPI, status **placed**; task + **"New order {id}"** notification "…for 1 item(s). Pack and confirm it from your seller dashboard." |
| 7 | Prakash (B) | `/nursery/batches` | **FEFO decrement already applied**: oldest batch 200 → **190**; plant stock 300 → **290**; mirror product stock 290 |
| 8 | Prakash (B) | **Accept Order** | Status **accepted** |
| 9 | 🔔 Meena (A) | Bell | **confirmed** "Your sapling order was accepted by the nursery" (bilingual) |
| 10 | Prakash (B) | **Mark as Packed** | Status **packed** |
| 11 | 🔔 Meena (A) | Bell | **shipped** "Order packed / ऑर्डर पैक हुआ" |
| 12 | Prakash (B) | **Dispatch Saplings** → courier **AgroExpress Logistics**, tracking auto `TRK-######`, notes default → Submit | Status **dispatched**; tracking row on order card |
| 13 | 🔔 Meena (A) | Bell | **out_for_delivery** "Order out for delivery / ऑर्डर रवाना हुआ" |
| 14 | Prakash (B) | **Mark Delivered** | Status **delivered** → P&L auto-income entry `nursery_order_revenue` ₹1,499; commission accrual 5% |
| 15 | 🔔 Meena (A) | Bell + order page | **delivered** "Order delivered / ऑर्डर पहुँच गया"; Rate enabled; Invoice PDF available (`/orders/{id}/invoice.pdf`) |
| 16 | Meena (A) | Rate product 5 stars, tag **HEALTHY_PLANTS** | Review in Prakash's `/nursery/ratings` |
| 17 | Prakash (B) | `/nursery/orders/:id` → **Tax Invoice** | `INV-NUR-…`: taxable = 1,499/1.05 = **₹1,427.62**, "CGST + SGST (5%)" = **₹71.38**, total ₹1,499; Print + Download (JSON) work |
| 18 | Prakash (B) | `/nursery/payouts` | Gross sales ₹1,499; platform fee 5% = **₹74.95**; net earnings **₹1,424.05**; available ₹1,424.05 |
| 19 | Prakash (B) | **Withdraw Earnings**: ₹100 (min), UPI override `rohit.bhosale@okhdfc` → Submit | Payout status **processed** (sandbox); ledger row; available reduces |
| 20 | Prakash (B) | **Reply to review** on Meena's rating | Reply posted (1–500 chars, once — second reply 409 `ALREADY_REPLIED`) |
| 21 | Meena (A) | Stock-exhaustion edge: open Kesar Mango → qty **500** → Add to Cart → checkout | **Blocked** — 409 `OUT_OF_STOCK` ("only N left", N ≈ 280 after dispatch-stock moves); order not created |
| 22 | Prakash (B) | Stock-out probe (optional): `/nursery/batches` → Stock Out qty > batch currentStock | 422 `INSUFFICIENT_STOCK` "Batch has only 190 saplings remaining" — server-side guard |

**Money check — XP-05 (nursery: flat 5% commission on delivered gross, payout UPI, GST 5% shown tax-inclusive on invoice):**

| Party | Before | Change | After | Notes |
|-------|--------|--------|-------|-------|
| Meena — UPI | snapshot | **−₹1,499** | snapshot − 1,499 | 1,600 − 200 coupon + 99 fee |
| Prakash — earnings | snapshot | +₹1,424.05 net (−5% ₹74.95) − ₹100 payout | snapshot + 1,324.05 | available = net − requested; verify KPI cards match |
| Platform | — | **+₹74.95** commission + ₹99 delivery fee | — | delivery fee is platform logistics revenue |
| Batch stock | 200 | **−10 (FEFO)** | 190 | mirror product + plant stock also 300 → 290; cancel would restore (FM-03) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### XP-06: Cross-seller dispute → [ADMIN] console resolution → refund on both sides
- **Priority:** P1      **Personas:** Meena (A), Prakash (B), [ADMIN]
- **Story:** Meena's second nursery order (Chikoo saplings) arrives with dry root-balls. She opens
  a return; the nursery disagrees but cannot resolve it alone; the admin console settles it: order
  returned, refund processed — and both sides see the same money outcome.
- **Setup/preconditions:** XP-05 done (coupons + payouts verified). Meena delivered order #2
  (placed below). Prakash's Chikoo (Sapodilla) Sapling live: price ₹120, stock 12, min qty 5.
- **Test data:** 5 × ₹120 = ₹600; GREEN15 (min ₹500): 15% = **−₹90** (< cap 200) → ₹510; fee ₹99
  → **payable ₹609**.

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 1 | Meena (A) | Order 5 × Chikoo Sapling (qty 5 = min order) → apply GREEN15 → UPI pay **₹609** | Order **paid**; Chikoo stock 12 → 7 |
| 2 | Prakash (B) | Accept → Packed → Dispatch (AgroExpress, TRK-…) → **Delivered** | Statuses advance; Meena notified each step (bell 4×) |
| 3 | Meena (A) | Order detail → **Request Return** → reason "Saplings arrived with dry root-balls" → Submit | **returnStatus = requested**, **refundStatus = requested**; order list badge `return_requested`; seller notified (verify notification type; if none arrives, note it — see Notes) |
| 4 | Prakash (B) | `/nursery/orders` | Order shows return flag; Prakash **cannot** mark anything further (delivered is terminal for fulfilment actions) |
| 5 | [ADMIN] (C) | Super-admin → orders/dispute console → open the order → evidence/reason visible → set status **returned** (transition map honoured) | Console accepts; audit row written; dispute triage queue shows the case closed |
| 6 | [ADMIN] (C) | Trigger refund `POST /payments/razorpay/refund` for the order | **refundStatus → processed** + `razorpayRefundId`; failure retried per policy |
| 7 | 🔔 Meena (A) | Bell + `/customer/wallet` Transactions | Return/notification line; **+₹609** refund row, status processed; "Refunds Pending" total back to ₹0 |
| 8 | Prakash (B) | `/nursery/orders/:id` + `/nursery/payouts` | Order **returned**; earnings KPIs exclude this order (gross unchanged vs step-18 of XP-05); commission NOT accrued on the returned order |
| 9 | Meena (A) | Product review attempt for the returned order | Allowed but comment moderation applies; rating of a disputed/returned order must not inflate seller aggregate — record actual behaviour in Notes |

**Money check — XP-06:**

| Party | Before | Change | After | Notes |
|-------|--------|--------|-------|-------|
| Meena | snapshot | −₹609 then **+₹609** | snapshot + 0 | Refund to source; refund id recorded |
| Prakash | snapshot | **no accrual** (order returned, not delivered-settled) | unchanged | Proves commission/settlement only on `delivered` |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### XP-07: Chat compliance mid-deal — phone / UPI / URL blocked, deal still completes
- **Priority:** P0      **Personas:** Ramesh (A), Anil (C) — runs **inside** XP-01 (steps 12–13) and
  XP-02 (step 10 chat)
- **Story:** Mid-deal, both parties try to take the negotiation off-platform — exactly what the
  platform forbids. Every attempt must be blocked with a warning, nobody is locked out, and the
  deal still completes using only in-app chat, statuses and the handover OTP.

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 1 | Ramesh (A) | In the XP-01 purchase chat (before acceptance, if reachable): try to open chat from the offer | Chat composer **locked** — caption/tooltip "Chat unlocks after confirmation"; no thread pre-confirmation (G1) |
| 2 | Ramesh (A) | After acceptance (chat unlocked): send "मेरा मोबाइल 9822000001 है, सीधे कॉल करो" | **Blocked** — message rejected with a warning (phone-number regex); warning tells user to keep dealings on-platform; message not stored/delivered |
| 3 | Ramesh (A) | Send "पैसे सीधे ramesh.patil@upi पर भेज देना" | **Blocked** — UPI-handle regex; same warning |
| 4 | Ramesh (A) | Send "https://wa.me/919822000001 से बात करो" | **Blocked** — URL regex |
| 5 | Anil (C) | Send "मेरा नंबर 98220 40001, मंडी पर फोन करना" | **Blocked** on the buyer side too — same moderation both directions |
| 6 | Anil (C) | Check Anil's profile / Ramesh's profile inside the chat header | Only **first names** shown; no phone number rendered anywhere in the chat or trust card (anonymity preserved) |
| 7 | Ramesh (A) | Send a clean message "ऑनियन तैयार है, OTP बाद में दूंगा" | Delivered normally — moderation is targeted, chat itself works |
| 8 | Ramesh (A) | Continue XP-01: reveal handover OTP in-app and speak it aloud (voice) to Tester C; **never type it in chat** | Deal completes with zero off-platform contact data in the chat log |
| 9 | Suresh (B) | In the XP-02 trip chat (after bid accept): send his phone number | **Blocked** with warning (same regex set on transport chat) |
| 10 | All | After completion, open the chat history | All blocked attempts show the warning state or are absent; the completed deal needed no off-platform contact |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### XP-08: Notification matrix run — bell check after every trigger
- **Priority:** P1      **Personas:** all — executed **during** XP-01/02/03/04/05 (the 🔔 steps)
- **Story:** A marketplace lives on its notifications. After **every** triggering action above, the
  receiving actor opens the bell and confirms the exact notification before moving on. This section
  is the master matrix; tick each row when verified live.

| # | Trigger action | Sender | Receiver | Channel | Expected text contains |
|---|----------------|--------|----------|---------|------------------------|
| 1 | Offer on demand (XP-01 step 4) | Ramesh | Anil | in-app + push | "New offer / नया ऑफर", Onion, ₹1,450/q, 20 q |
| 2 | Counter round 1 (step 6) | Anil | Ramesh | in-app + push | "countered", "1/3", ₹1,400/q |
| 3 | Counter round 2 (step 8) | Ramesh | Anil | in-app + push | "countered", "2/3", ₹1,430/q |
| 4 | Counter round 3 (step 10) | Anil | Ramesh | in-app + push | "countered", "3/3", ₹1,420/q |
| 5 | Offer accepted (step 12) | system | both | in-app + push | **booking_confirmed** ₹28,400 + **request_accepted** "chat is now open" |
| 6 | Advance escrow funded (step 14) | Anil | Ramesh | in-app + push | **payment_received**, ₹4,260, "advance" |
| 7 | Pickup scheduled (step 16) | Anil | Ramesh | in-app + push (24h/2h reminders follow) | **pickup_scheduled**, 2026-10-23, 06-07, agent, grace 60 |
| 8 | Dispatch (step 19) | Anil | Ramesh | in-app + push | **dispatched** |
| 9 | Delivered (step 21) | Anil | Ramesh | in-app + push | **delivered**, "share the handover OTP now" |
| 10 | Handover OTP verified (step 24) | Anil | Ramesh | in-app | **handover_verified** |
| 11 | QC pass (step 26) | system | both | in-app + push | **deal_completed** (invoice no.) |
| 12 | Rating given (steps 30–32) | each | the other | in-app | **rated** "You got a rating ⭐" |
| 13 | Load bid placed (XP-02 step 4) | Suresh | Ramesh | FCM + in-app | "नया भाड़ा प्रस्ताव (Bid Received)", ₹2,500 |
| 14 | Bid countered (step 7) | Ramesh | Suresh | FCM + in-app | "काउंटर ऑफर (Counter Offer)", ₹2,300 |
| 15 | Bid accepted (step 9) | system | both | FCM + in-app | "बोली स्वीकृत! (Bid Accepted)" + **chat_unlocked** |
| 16 | Fare paid (step 12) | Ramesh | Suresh | in-app | **fare_payment_captured**, ₹2,700 |
| 17 | Milestone taps (steps 14–23) | Suresh | Ramesh | push + in-app | **trip_arrived_pickup / trip_loading / trip_enroute / trip_reached_destination / trip_unloading** (each) |
| 18 | Waypoint pings (step 18/22) | Suresh | Ramesh | push | **trip_milestone** (at_pickup / loaded / unloading) |
| 19 | Weighbridge slip (step 18) | Suresh | Ramesh | push + in-app | **weighbridge_recorded**, net 3260 kg |
| 20 | Detention stop (step 20) | Suresh | Ramesh | push + in-app | **detention_recorded**, "Waiting charges", ₹150 |
| 21 | POD verified (step 26) | Suresh | Ramesh | push + in-app | **trip_delivered**, "inspect and rate your transporter" |
| 22 | Rating prompts (steps 31–32) | system | both | in-app prompt | **transport_delivery** (Ramesh) / **transport_shipper** (Suresh) |
| 23 | Mall order placed (XP-03 step 5) | Meena | Anil | push + in-app + task | "New order {id}", "new Krishi Mall order (upi)", 1 item(s), deep link `/dashboard/p/seller/orders` |
| 24 | Order confirmed/shipped/OFD/delivered (XP-03 steps 7–13) | Anil | Meena | push + in-app | **order_confirmed** "being packed" / **order_shipped** "handed over to the pickup agent" / **out_for_delivery** "delivering today" / **order_delivered** |
| 25 | Return requested (XP-03b step 21 / XP-06 step 3) | Meena | seller | in-app (verify) | return flag / `return_requested` (raise a note if no notification fires) |
| 26 | Gruh order accepted→delivered (XP-04 steps 5–11) | Sunita | Meena | push + in-app | **order_confirmed** "being packed by the seller" / **order_shipped** / **order_out_for_delivery** / **order_delivered** |
| 27 | Nursery order accepted→delivered (XP-05 steps 8–14) | Prakash | Meena | push + in-app (bilingual) | **confirmed** "accepted by the nursery" / **shipped** "ऑर्डर पैक हुआ" / **out_for_delivery** "ऑर्डर रवाना हुआ" / **delivered** "ऑर्डर पहुँच गया" |

*Known gaps to verify as "expected absent" (record behaviour in Notes): no notification on gruh
payout (UI flash only), no nursery payout/KYC-rejection notification, no notification when a demand
is posted (farmers discover by browse), no deposit-success notification in SHG.*

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### XP-09: Vyapari books transport (seller as booker) for the purchased onions
- **Priority:** P1      **Personas:** Anil (C), Suresh (B)
- **Story:** The 20 q of onions Ramesh sold are sitting at the farmgate. Anil books a gadi himself
  — the backend explicitly allows `seller` as a booker — and Suresh runs the trip with the same
  milestone discipline. This proves the transport module is not farmer-only.
- **Setup/preconditions:** XP-01 completed (onions at Gate 312). Suresh has a free **verified**
  vehicle (Eicher MH-12-GH-8820, 6T — 2.5 t load). Balances snapshotted.
- **Test data:** Route Pimpalgaon Baswant → Lasalgaon APMC ≈ 25 km (≈35 km driven), date today,
  window 120 min, commodity Onion 20 q, no insurance this time. Catalog fare for Eicher 6-wheeler:
  base ₹1,800 + ₹55 × 35 = **₹3,725** (+ loading ₹300 if >10 km = **₹4,025**). Accepted fare
  **₹4,025**. Commission 10% = **₹402.50**; TDS 1% = **₹40.25**; net to wallet **₹3,582.25**.

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 1 | Anil (C) | Try the web booking UI as seller: open the transport booking screen from the seller panel | If the UI is farmer-routed and hidden for seller, note it and use the API docs "Try it" with Anil's token: `POST /transport/bookings` {vehicleType "Eicher 6-Wheeler", route, pickupTime, timeWindowMinutes 120, commodity Onion, weightQuintals 20, packaging "jute bags"} — the backend `_booker` guard explicitly allows `seller`; a 403 here is a **defect** |
| 2 | Anil (C) | Create the booking (UI or API) | Booking born status **requested**; fare from catalog ₹4,025; `trip_pickup_reminder` task emitted for the booker |
| 3 | 🔔 Suresh (B) | `/transporter/inbox` (Job Inbox) | The booking appears as a new job request with route, commodity, fare ₹4,025, noshowRisk/fit scores; **Chat disabled** with tooltip "Chat unlocks after you accept" |
| 4 | Suresh (B) | **Accept Job** → select vehicle MH-12-GH-8820 → Confirm | Booking **accepted**, vehicle attached; other pending offers auto-declined; chat unlocked both sides |
| 5 | 🔔 Anil (C) | Bell | **booking_confirmed** + chat_unlocked |
| 6 | Anil (C) | Pay fare escrow (Razorpay test UPI anil.agrawal@upi) ₹4,025 | Escrow **held**; Suresh notified `fare_payment_captured` |
| 7 | Suresh (B) | Run milestones: arrivedPickup → loading → enRoute (ping waypoint at_pickup + weighbridge) → reachedDestination → unloading | Each transition notifies Anil (bell: trip_arrived_pickup, trip_loading, trip_enroute, trip_reached_destination, trip_unloading); no detention this time |
| 8 | Anil (C) | Reveal **POD OTP** → say aloud to Suresh | OTP booker-only, 15-min, 5 attempts |
| 9 | Suresh (B) | **Verify POD OTP** + receiver "Anil's agent, Lasalgaon gate" + photo | Status **delivered**; rating prompts open both ways |
| 10 | Suresh (B) | Escrow release | Commission 10% ₹402.50 → platform; TDS 194-O ₹40.25 ledger line; **net ₹3,582.25** to wallet |
| 11 | Anil (C) | Rate Suresh (transport_delivery) 5 stars | Saved; Suresh rates Anil (transport_shipper) |
| 12 | Suresh (B) | Bilty + receipt PDF (`GET …/receipt`: receiptNo, fare, commission 10%, net, escrowStatus) | Both documents open; numbers match the money table |

**Money check — XP-09:**

| Party | Before | Change | After | Notes |
|-------|--------|--------|-------|-------|
| Anil | snapshot | **−₹4,025** | snapshot − 4,025 | Escrow funded from Anil's UPI/wallet |
| Suresh — wallet | snapshot | **+₹3,582.25** | snapshot + 3,582.25 | 4,025 − 402.50 (10%) − 40.25 (TDS 1%) |
| Platform | — | +₹402.50 | — | Same engine as farmer-booked trips — no persona-specific pricing |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### XP-10: Farmer ↔ Nursery — nursery directory and farmer-as-buyer mall order
- **Priority:** P2      **Personas:** Ramesh (A), Prakash (B)
- **Story:** Ramesh wants 5 Kesar mango saplings for his bund. He finds Prakash's nursery in the
  farmer-facing nursery directory, then buys through the Krishi Mall with his farmer account
  (market roles include farmer). Note: tree-plantation **sapling requests go to NGOs, not
  nurseries** (deferred phase-07) — the directory + mall are the real farmer↔nursery links.
- **Setup/preconditions:** Prakash's Kesar Mango listing live (XP-05). Ramesh's KYC done, UPI ready.

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 1 | Ramesh (A) | Mobile → Livestock hub → nursery directory (`GET /livestock/nurseries`) | **Bhosale Fruit Nursery** listed: rating, availableSaplings, price range ₹120–200, distance km, isGovtCertified flag; sorted by distance |
| 2 | Ramesh (A) | Tap **Call** on the nursery card | Farmer-facing directory is the one surface where a call button exists (mobile `NurseryCard`) — call dials Prakash's profile phone; **no other persona flow may expose numbers** |
| 3 | Ramesh (A) | Tree Plantation module → sapling request | Request targets **NGOs only**; no nursery linkage exists — assert Prakash does NOT receive anything (expected absence; NGO approval is deferred phase-07) |
| 4 | Ramesh (A) | Open Krishi Mall (farmer account) → plants → Kesar Mango Grafted Sapling → qty **5** (= min order) → checkout, farmgate address (House No 42, Ganesh Chowk, Pimpalgaon Baswant 422209) → UPI pay 5 × 160 + 99 = **₹899** | Order **paid** placed by a farmer account — market roles include farmer |
| 5 | 🔔 Prakash (B) | `/nursery/orders` | New order from Ramesh visible (buyer name Ramesh Patil); batch FEFO decrements 190 → **185** |
| 6 | Prakash (B) | Accept → Packed → Dispatch → Delivered | Ramesh notified each step |
| 7 | Ramesh (A) | Order page → Invoice PDF + rate product 5 stars tag HEALTHY_PLANTS | Invoice opens; review appears in Prakash's ratings |
| 8 | Prakash (B) | `/nursery/payouts` | Second accrual line; available grows by 5% net of ₹899 (= ₹854.05) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

### XP-11: Broker (dalal) deal with the farmer — MPIN e-sign, milestones, escrow, payout
- **Priority:** P1      **Personas:** Ramesh (A), Anil's **broker** account (C), [ADMIN]
- **Story:** Anil also holds a broker (dalal) licence. He brokers Ramesh's remaining onions to a
  Delhi buyer: contract issued, Ramesh e-signs with his MPIN, milestones push the deal forward,
  payment is captured into escrow, and the payout releases after the 48-hour silent window.
- **Setup/preconditions:** Broker account (+91 98220 40008) with role `broker`; broker KYC
  **verified** with `arhtiya_licence` + GST (else 403 `BROKER_KYC_REQUIRED` at payment capture).
  Ramesh MPIN 4321 set. Balances snapshotted.
- **Test data:** Deal = buyer "Delhi Trading Co", seller Ramesh Patil (phone +91 98220 00001),
  commodity Onion, grade A, **20 q**, agreed rate **₹1,430/q**, commission **2%**, TTL 24–48 h.
  Gross = 28,600; commission ₹572; farmer leg **₹28,028**.

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 1 | Anil-broker (C) | `/broker/deals` → New Deal → fill test data → Submit | Deal created status **negotiating**, `expiresAt` = now + TTL (24–48 h); gross ₹28,600, commission ₹572 computed; farmer task + **deal_offer_received** notification |
| 2 | 🔔 Ramesh (A) | Bell → `/farmer/deals` | New deal card "Delhi Trading Co — Onion 20 q @ ₹1,430/q", status negotiating, TTL countdown |
| 3 | Ramesh (A) | Open deal → **Vault** | 409 `VAULT_LOCKED` (vault opens only after acceptance) |
| 4 | Ramesh (A) | **Messages** → send "भाव ठीक है, वजन ठीक रहेगा" → then try "मेरा नंबर 9822000001" | First message delivered; phone-number attempt **blocked** 422 `MESSAGE_BLOCKED` (moderation regexes; 3 strikes would restrict messaging) |
| 5 | Ramesh (A) | Send an amount offer (counter): ₹1,440/q | Counter round recorded (cap 3); broker notified **deal_counter_offer** |
| 6 | Anil-broker (C) | Negotiation thread → accept farmer's counter → **Issue Contract** | Deal status **contract_issued**; farmer notified **deal_contract_issued**; contract PDF available (`GET …/contract` with SHA-256 integrity hash, accessible by phone match) |
| 7 | Ramesh (A) | `/farmer/deals/{id}` → **Accept** with MPIN **9999** (wrong) | 401 `WRONG_MPIN`; deal unchanged |
| 8 | Ramesh (A) | **Accept** with MPIN **4321** → confirm consent | E-signature recorded (signatureData + consentTimestamp); deal **accepted**; farmer notified; **vault now opens** |
| 9 | Anil-broker (C) | Add milestones: departed → arrived → loading → **weighed** (weight within 2% of agreed) → delivered | Each milestone notifies Ramesh (deal_in_transit etc.); "delivered" sets deliveredAt + releaseAt = deliveredAt + 48 h |
| 10 | Ramesh (A) | Deal milestones view | Milestone trail visible; no divergence proposal (≤2% weight divergence) |
| 11 | Anil-broker (C) | **Capture Payment**: amount ₹28,600, method upi, reference → Submit | Razorpay split: farmer leg ₹28,028 + commission leg ₹572; escrow **held**; audit `DEAL_PAYMENT_CAPTURE`; 409 `ALREADY_CAPTURED` on retry |
| 12 | Anil-broker (C) | **Release Payout** immediately | 409 `RELEASE_WINDOW_OPEN` — payout blocked inside the 48 h silent window (expected). Ask the dev team to simulate the window close (sandbox clock override) — or verify the block and note "payout deferred" |
| 13 | [ADMIN]/dev | Fast-forward 48 h (sandbox) | — |
| 14 | Anil-broker (C) | **Release Payout** again | Escrow released: farmer settlement row ₹28,028 written; platform keeps ₹572; audit row; farmer notified **deal_payout_released** |
| 15 | 🔔 Ramesh (A) | Bell + settlements view | **deal_payout_released**; **Receipt PDF** (`GET …/receipt`) shows net of commission, adjustment-aware |
| 16 | Anil-broker (C) | `/broker/commissions` + `/broker/settlements` | Commission earned ₹572; weekly broker settlement line pending→paid via RazorpayX |

**Money check — XP-11:**

| Party | Before | Change | After | Notes |
|-------|--------|--------|-------|-------|
| Delhi buyer leg (broker-captured) | — | ₹28,600 in escrow | released | Split farmer ₹28,028 + platform/broker ₹572 (2%) |
| Ramesh — settlement | snapshot | **+₹28,028** | snapshot + 28,028 | Net of broker commission; receipt PDF matches |
| Platform + broker | — | ₹572 commission | — | Broker desk settlement pays the dalal his share per weekly settlement |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

## 4. Failure-mode scenarios

Short, sharp checks of what each side sees when a deal breaks. Run after the main scenarios.

### FM-01: Transporter cancels inside the pickup window → no-show strike; farmer late-cancel penalty
- **Priority:** P1      **Personas:** Suresh (B), Ramesh (A)

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 1 | Ramesh (A) | Create a quick **Book Now** booking (Tata Ace, 10 km local run, tomorrow 06:00 slot) — do NOT pay escrow yet | Booking **requested** |
| 2 | Suresh (B) | Job Inbox → **Accept** | Booking **accepted** |
| 3 | Suresh (B) | Inside the 24 h pickup window: cancel the trip (cancel modal, reason "vehicle clutch failure") | Booking **cancelled**; **no-show strike +1** recorded on Suresh (`noShowStrikes`); farmer notified **booking_cancelled** with reason; escrow never held → nothing to refund |
| 4 | Suresh (B) | `/transporter/compliance` → Strike Ledger | Strike row (reason, date, bookingId); compliance card shows "3 = suspension" and current count 1 |
| 5 | Ramesh (A) | Create a second booking → Suresh accepts → Ramesh **cancels inside 2 h of the slot** | Farmer-cancel path: penalty **25% of fare** (<2 h tier); split **50% transporter compensation / 50% platform**; ledger lines `pen_{id}` / `comp_{id}`; Ramesh's `platformDuesPaisa` accrues the penalty |
| 6 | 🔔 Suresh (B) | Bell + `/transport/ledger/mine` | **booking_cancelled** with **compensation amount** (50% of 25%); ledger shows compensation credit |
| 7 | Ramesh (A) | `/transport/ledger/mine` | Penalty debit visible; dues summary updated |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### FM-02: Seller rejects a paid order → buyer sees refund path
- **Priority:** P1      **Personas:** Sunita (B), Meena (A)

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 1 | Meena (A) | Place a third small order on Mauli Gruh Udyog (1 × Goda Masala 100g ₹110 + fee ₹99 = **₹209**), pay UPI | Order **paid** |
| 2 | 🔔 Sunita (B) | Studio → Orders | Order **placed** |
| 3 | Sunita (B) | **Reject** → prompt "Why are you rejecting this order?" → answer "Batch expired, cannot ship" (min 3 chars) → confirm | Fulfilment **rejected**; mall stock restored (masala stock back +1); buyer notified **order_cancelled** "cancelled by the seller. Any payment made will be refunded." |
| 4 | 🔔 Meena (A) | Bell + order page | **order_cancelled**; **refundStatus = requested** (paid order) |
| 5 | [ADMIN] (C) | Trigger `POST /payments/razorpay/refund` | **refundStatus → processed** + refund id |
| 6 | Meena (A) | Wallet → Transactions | **+₹209** refund row; Refunds Pending → 0 |
| 7 | Sunita (B) | Earnings card | No accrual for the rejected order (settlement only on delivered) |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

### FM-03: Customer cancels after dispatch → blocked; a paid placed order cancels cleanly
- **Priority:** P1      **Personas:** Meena (A), Anil (C)

| # | Actor | Action | Expected result |
|---|-------|--------|-----------------|
| 1 | Meena (A) | Take any **shipped** order (XP-03 order 1 if still open, else place + have Anil ship a ₹439 cattle-feed order) → tap **Cancel Order** | **Blocked** — 409 `ORDER_NOT_CANCELLABLE` (cancel allowed only from placed/paid). Status stays shipped; no refund created |
| 2 | Anil (C) | Order continues to delivered | Normal lifecycle resumes |
| 3 | Meena (A) | Now place a fresh order (1 × Cattle Feed ₹340 + 99 = **₹439**), pay UPI, and cancel **immediately** while status is placed/paid, reason "ordered by mistake" | Cancel accepted from placed/paid: **stock restored** (49 → 50), **refundStatus = requested** |
| 4 | [ADMIN] (C) | Trigger refund | **processed** + refund id; audit row |
| 5 | Meena (A) | Transactions | +₹439 refund row |
| 6 | Anil (C) | `/seller/orders` + stock | Order **cancelled**; SKU stock back to 50; no settlement line |

- **Result:** ☐ Pass ☐ Fail   **Notes:** ______________

---

## 5. Final cross-persona regression checklist

One line per hand-off type ever exercised in this suite (solo docs or here). Re-run and tick before
sign-off; any unticked P0 line blocks release.

- [ ] **Offer on lot / demand** — sender→receiver, 24 h expiry, one live offer per target (XP-01)
- [ ] **Counter-offer negotiation** — 3-round cap, 4th blocked `NEGOTIATION_CLOSED`, clock restart (XP-01)
- [ ] **Offer accept → purchase** — booking_confirmed ×2, chat unlocked, sibling offers rejected on full lot (XP-01; partial accept + sibling rejection in 01_farmer TC-FRM-48/49)
- [ ] **Escrow fund (advance)** — held, payment_received to farmer, double-fund 409 (XP-01)
- [ ] **Pickup schedule / dispatch / deliver** — pickup_scheduled, dispatched, delivered notifications (XP-01)
- [ ] **Handover OTP** — farmer-only reveal, 6-digit/15-min/5-attempts, buyer verify, release clock (XP-01)
- [ ] **QC pass / qcDisputed branch** — accepted+rejected must equal qty; resolve path (XP-01 pass branch; dispute branch in 03_vyapari)
- [ ] **Escrow release & commission 2% min ₹50** — both sides verified (XP-01)
- [ ] **Balance payment + GST invoice PDF + commission-invoice PDF** (XP-01)
- [ ] **Rating both directions + reply-once** — lot_sale / farmer rated / product review (XP-01, XP-03)
- [ ] **Load post → load board** — bid, bid FCM, one-round counter, accept → booking born accepted (XP-02)
- [ ] **Trip milestones + manual pings** — all six transitions + waypoint pings notify the booker (XP-02)
- [ ] **Weighbridge slip** — net weight notification (XP-02)
- [ ] **Detention** — 60 free + ₹150/30-min slab + ₹2,000 cap + detention_recorded (XP-02)
- [ ] **POD OTP + photos + receiver** — delivered, rating prompts open both ways (XP-02/XP-09)
- [ ] **Transport escrow release — 10% commission + TDS 194-O ledger + weekly settlement + payout MPIN→bank** (XP-02/XP-09)
- [ ] **Farmer cancel tiers >24 h free / 10% / 25%, 50-50 compensation split** (FM-01)
- [ ] **Transporter no-show strike ladder** — 3 strikes = load-board suspension (FM-01)
- [ ] **Mall order placed → seller new-order task + notification** (XP-03/04/05)
- [ ] **UPI payment — Razorpay order/signature verify, paid status, retry endpoint** (XP-03)
- [ ] **Coupon — server re-validation, min order, % cap** (XP-03/05)
- [ ] **Delivery fee ₹99 / free > ₹1,500, charged before coupon math** (XP-03/04/05)
- [ ] **Seller fulfilment chain placed→confirmed→shipped→out_for_delivery→delivered (vyapari), accepted→packed→shipped→delivered (gruh), placed→accepted→packed→dispatched→delivered (nursery)** (XP-03/04/05)
- [ ] **Invoice PDFs** — mall order invoice, nursery GST invoice (tax-inclusive 5%), bilty, trip receipt (XP-02/03/05)
- [ ] **Return → [ADMIN] → refund processed, verified buyer + seller** (XP-03b, XP-06)
- [ ] **Seller reject → stock restored → refund** (FM-02)
- [ ] **Cancel legality — placed/paid only; after dispatch blocked; stock restored; refund requested→processed** (FM-03)
- [ ] **Gruh settlement on delivered — 5% commission, accrual line, MPIN payout** (XP-04)
- [ ] **Nursery settlement — 5% flat, payout, batch FEFO decrement + restore-on-cancel** (XP-05/FM-03)
- [ ] **Stock guards — min order qty, OUT_OF_STOCK, INSUFFICIENT_STOCK** (XP-05)
- [ ] **Chat compliance — phone/UPI/URL blocked both directions, pre-confirmation lock, anonymised identity** (XP-07)
- [ ] **Seller-as-booker transport (vyapari)** (XP-09)
- [ ] **Farmer↔nursery directory + farmer mall purchase; NGO-only sapling requests (expected absence)** (XP-10)
- [ ] **Broker deal — negotiate, contract, MPIN e-sign, milestones, capture split, 48 h window, payout** (XP-11)
- [ ] **Notification matrix — every XP-08 row ticked** (XP-08)

---

## 6. Sign-off

**Release gate (README §7): all P0 pass, ≥95% P1 pass, zero open Blocker defects.**

| Scenario | Priority | Pass/Fail | Defects raised | Tester signatures & date |
|----------|----------|-----------|----------------|--------------------------|
| XP-01 Farmer→Vyapari sale | P0 | ☐/☐ | | A: ____ C: ____ / ____ |
| XP-02 Farmer books transport | P0 | ☐/☐ | | A: ____ B: ____ / ____ |
| XP-03 Customer→Vyapari mall (+return) | P0 | ☐/☐ | | A: ____ C: ____ / ____ |
| XP-04 Customer→SHG mall | P0 | ☐/☐ | | A: ____ B: ____ / ____ |
| XP-05 Customer→Nursery | P0 | ☐/☐ | | A: ____ B: ____ / ____ |
| XP-06 Dispute + admin refund | P1 | ☐/☐ | | A: ____ B: ____ C: ____ / ____ |
| XP-07 Chat compliance | P0 | ☐/☐ | | A: ____ C: ____ / ____ |
| XP-08 Notification matrix | P1 | ☐/☐ | | all / ____ |
| XP-09 Vyapari books transport | P1 | ☐/☐ | | C: ____ B: ____ / ____ |
| XP-10 Farmer↔Nursery | P2 | ☐/☐ | | A: ____ B: ____ / ____ |
| XP-11 Broker deal | P1 | ☐/☐ | | A: ____ C: ____ / ____ |
| FM-01 Transport cancel/strike | P1 | ☐/☐ | | B: ____ A: ____ / ____ |
| FM-02 Seller reject refund | P1 | ☐/☐ | | B: ____ A: ____ / ____ |
| FM-03 Cancel-after-dispatch | P1 | ☐/☐ | | A: ____ C: ____ / ____ |

*Cross-persona E2E complete. Fill the "07 Cross-persona E2E" row of the README §7 sign-off matrix
with the totals from this table.*
