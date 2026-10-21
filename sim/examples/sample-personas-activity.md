# SAMPLE — Persona Activity Report (illustrative fictional output)

> ⚠️ **Format demo with invented run data.** The analyzer emits
> `reports/personas.md` after each suite. This shows what "what did each
> persona do" looks like for the sample smoke run
> (`smoke-2026-10-28T06-12-33`, 9 runs executed, 1 blocked).

---

# Persona Activity — smoke-2026-10-28T06-12-33

Suite cost $0.083 · 247 steps · 9 personas active · 1 blocked identity

---

## 🧑‍🌾 farmer — Ramesh Patel · `farmer-sell-wheat`
**done · 22 steps · 6 retries · 3/5 · 610ms p95**

1. OTP login via dev flow — in as `farmer` (1 step, cached token reused).
2. `GET /v1/mandi/prices?district=Anand&crop=wheat` → ₹4,120/q. *"Thoda kam hai, phir bhi theek."*
3. Searched "sell my produce" → found `market_lots`; `POST /v1/market/lots` with grade "good" → **400** (enum).
4. Retried same body ×2 (watchdog counted), then searched "grade meaning" → FAQ not helpful.
5. Guessed grade "A" → accepted. **Lot `lot_7f3a` created.**
6. Waited for offers (2 `GET /v1/market/lots/{id}/offers` polls) — none; seeded world had no active buyers in Anand. Marked `data-gap` suspicion.
7. Used chatbot "how to get buyers fast" → got generic answer, no boost/listing feature found → **captured as gap #8**.
8. Ended: lot live, no sale. Satisfied-ish with effort, unhappy with result.

**Touched:** auth, mandi, market, offers, chatbot, faq
**Proved:** price-check → listing works, but the lot form rejects anyone who
doesn't know grade codes, and a listed lot with no demand dies silently.

---

## 🧑‍🌾 farmer · `farmer-evening-round`
**done · 17 steps · 1 retry · 4/5**

1. Mandi check (Anand: wheat ₹4,120, cotton ₹5,860).
2. `POST /v1/farmer/diary` — wrote today's entry (sprayed urea, 2hr).
3. Crop doctor: uploaded leaf-spot photo → advisory returned with treatment in
   Hinglish. *"Ye accha hai, samajh aaya."*
4. Schemes: 2 matches; opened PM-Kisan detail — eligibility matched profile.
5. Tried `POST /v1/schemes/pm-kisan/apply` → **404** (apply endpoint absent) →
   gap #7 (apply flow incomplete vs. catalog claims).
6. Ended satisfied; noted the scheme dead-end.

**Touched:** mandi, diary, advisory, schemes, notifications
**Proved:** advisory + diary + scheme matching feel easy; scheme application is
a dead end at the last step — worst possible place for one.

---

## 🧑‍🌾 farmer (low literacy) · `farmer-low-literacy-sale`
**gave_up at step 14 · 7 retries · 2/5** ⚠️

1. Logged in; searched "sell wheat" — same lot form.
2. Didn't know quantity in quintals ("20 bags?") — quantity field unit unclear.
3. Grade question again — typed "achhi gehu"; 400.
4. Retried 3× (watchdog flagged), then opened chatbot: *"form bharna mushkil hai"*
   → bot replied with generic help article, no human handoff.
5. Gave up: *"It asks 'grade' — I don't know English grades, my wheat is just good wheat."*

**Touched:** auth, market, chatbot, support
**Proved:** the exact same form that merely annoyed run #1 **ends** the session
for a low-literacy user. Form guidance + language are P1, not polish.

---

## 🚚 transporter — Suresh Vaghela · `transporter-run-trip`
**done · 19 steps · 2 retries · 5/5 · 480ms p95**

1. Inbox: filtered Rajkot→Ahmedabad pickup loads; found 3.
2. Accepted load `load_221` — quote matched fare shown; booking `bk_90` created.
3. Trip start → maps rendered (key present); marked pickup; OTP handover at
   destination — POD verified first try.
4. Wallet: fare ₹4,800 credited **after 2 polls** (`async_wait`, ~40s) — flagged
   as async-settlement note, not a failure.
5. *"Seedha kaam, seedha paisa. Accha laga."*

**Touched:** transport, wallet, notifications, diary
**Proved:** the core logistics loop is the smoothest journey in the suite —
protect it from regressions (it becomes the golden trace first, specs §18e).

---

## 🚚 transporter · `transporter-race-and-recover`
**done · 16 steps · 3 retries · 4/5**

1. Tried to accept `load_224` → **409 GONE** (another run's transporter took it —
   real race, good).
2. Frustrated retry → then searched "more loads near Rajkot" → filter worked.
3. Accepted `load_229`, completed trip, wallet credited.
4. Quote: *"Load was gone when I pressed accept. Show me the next one fast,
   don't make me search again."* → ease finding: auto-suggest next-best on 409.

**Touched:** transport, wallet, search
**Proved:** race handling is correct but the recovery path costs 3 extra steps —
one-tap "next load" would close it.

---

## 🏪 seller — Vyapari · `seller-procure-and-sell`
**done · 24 steps · 4 retries · 3/5 · 655ms p95**

1. Rates: onion mandi price viewed; updated own rate card.
2. Searched wheat lots → **did NOT see farmer's `lot_7f3a`** (same district!) →
   expectation mismatch #3 → later confirmed as the cross-scope visibility bug.
3. Proceeded with a seeded lot instead: countered, offer accepted, purchase `pur_55`.
4. POS: recorded 3 sales (cash/UPI/credit) — credit buyer needed 2 lookups.
5. Settlement view: yesterday's payout visible.

**Touched:** seller, market, offers, purchases, pos, settlements
**Proved:** seller daily loop holds together; the farmer↔seller visibility seam
is broken — the single most valuable bug this run.

---

## 🛒 customer — Priya · `customer-buy-basket`
**done · 21 steps · 5 retries · 3/5 · 880ms p95** ⚠️ latency

1. Browsed mall, built basket (₹486), checkout.
2. Wallet short by ₹200 → no top-up shortcut at checkout (expectation mismatch
   #4) → navigated to wallet, top-up hit **payment boundary stop** (§18d
   documented), agent noted it and continued with balance math.
3. Order `ord_118` placed; tracking page `/track/<token>` opened — understood it.
4. Rated delivery 5★.

**Touched:** marketplace, orders, wallet, payments(boundary), ratings
**Proved:** checkout is the slowest, most-retried flow in the suite — top-up at
checkout + payment-boundary UX are the fixes.

---

## 🛒 customer · `customer-late-delivery`
**gave_up at step 9 · 4 retries · 1/5** ⚠️

1. Tracking stale 2h → opened support chatbot.
2. Bot: 3 identical "I understand your concern" intents; no escalation path.
3. Searched "talk to human" → no result (gap #5).
4. Gave up angry: *"Bot kept saying 'I understand your concern' but nobody came.
   My order is still missing."*

**Touched:** orders, order_tracking, chatbot, support
**Proved:** worst satisfaction in the suite; escalation absence turns a
recoverable delay into a churn event.

---

## 🏦 bankManager · `bank-loan-pipeline`
**done · 18 steps · 1 retry · 5/5**

1. Queue: opened application `app_77` (KCC, ₹1L, tractor).
2. farmer360 profile: credit score, history, land records — all on one view;
   decided approve with conditions.
3. `POST /v1/loans/app_77/decision` + disbursement → schedule visible.
4. Audit trail auto-written (`X-Audit-Reason` present).
5. *"Everything I need is on one screen."*

**Touched:** loans, finance, kyc, admin(audit read)
**Proved:** the CreditDesk console is the best-designed surface in the suite —
use it as the internal benchmark for the other desks.

---

## 🏦 bankManager · `bank-incomplete-kyc`
**done · 14 steps · 0 retries · 4/5**

1. Flagged blurry KYC + missing doc → sent back with **specific field list**
   (flow supports it — good).
2. Second application had velocity anomaly (3 apps, 2 phones, same device) →
   fraud flag raised; fraud queue accepted it.

**Touched:** loans, kyc, vault
**Proved:** rejection-with-instructions and fraud flagging both work — the
"exactly what to fix" loop the farmer needs everywhere else.

---

## ⛔ blocked — womenShg identity

`shg-low-confidence-user` did not run: persona has no `quick-login` seed and
OTP fallback created a generic user without SHG linkage. Recorded as
`blocked: no-test-identity` → exactly the harness gap specs §18(i) predicts;
add `seed_sim_identities.py` before the next full run.

---

*Generated by sim analyzer v0.1. Timelines are compressed from run JSONL;
quotes are unedited debrief output.*
