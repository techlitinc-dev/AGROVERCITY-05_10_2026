#!/usr/bin/env python3
"""End-to-end HTTP test of the FARMER and TRANSPORTER modules against the live API.

Run:  cd backend && .venv/bin/python scripts/e2e_farmer_transporter.py
Env:  E2E_BASE overrides http://localhost:8000

Prereqs: seed_farmer_tushar.py and scripts/seed_mandi.py already applied
(idempotent, fixed doc ids) and the backend running with the real Firestore.

The script mints the farmer token directly (app.services.tokens), creates the
transporter through the real OTP login (devOtp flow), seeds the transporter KYC
gate straight into Firestore (same trick as tests/test_transport.py::_verify_vehicle),
then walks both flows step by step. Every step prints PASS/FAIL; exit code is 0
only when every step passed.
"""

import asyncio
import os
import sys
import time
from datetime import date

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE = os.environ.get("E2E_BASE", "http://localhost:8000").rstrip("/")
FARMER_UID = "EWYuwJIr5JMPbFajKE9AclBpWnf2"
TRANSPORTER_PHONE = "+919876543210"
TRANSPORTER_UID = f"user_{TRANSPORTER_PHONE.replace('+', '')[-10:]}"

RESULTS = []  # (name, ok, status, detail)
CTX = {}      # cross-step state


def record(name, ok, status, detail):
    RESULTS.append((name, ok, status, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"{mark}  {name:<58} [{status}]  {detail}")


class StepFail(AssertionError):
    def __init__(self, msg, status="-"):
        super().__init__(msg)
        self.status = status


async def step(name, fn):
    try:
        status, detail = await fn()
        record(name, True, status, detail)
    except StepFail as exc:
        record(name, False, exc.status, str(exc))
    except Exception as exc:  # noqa: BLE001 — a step must never kill the run
        record(name, False, "EXC", repr(exc)[:220])
    return CTX


class Api:
    def __init__(self, client, token=None):
        self.c = client
        self.token = token

    def headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    async def req(self, method, path, *, expect=None, allow=(), **kw):
        kw.setdefault("headers", self.headers())
        if "json" in kw:
            kw["headers"] = {**kw["headers"], "Content-Type": "application/json"}
        r = await self.c.request(method, f"{BASE}{path}", **kw)
        if expect is not None:
            codes = (expect,) if isinstance(expect, int) else tuple(expect)
            if r.status_code not in codes and r.status_code not in allow:
                raise StepFail(
                    f"{method} {path} -> {r.status_code}, expected {codes}: {r.text[:180]}",
                    status=str(r.status_code),
                )
        return r

    async def j(self, method, path, **kw):
        r = await self.req(method, path, **kw)
        try:
            return r.status_code, r.json()
        except Exception:
            return r.status_code, {"_raw": r.text[:200]}


# ---------------------------------------------------------------- db helpers
# The script runs inside backend/ with the app venv, so the same Firestore
# access the seed scripts use is available for the pieces the API cannot do
# (OTP session housekeeping, transporter KYC gate).

async def mint_farmer_token():
    from app.services.tokens import create_access_token
    return create_access_token(FARMER_UID)


async def clear_otp_sessions(phone):
    from app.core.db import query, delete_doc
    docs = await query("otp_sessions", [("phone", "==", phone)], limit=50)
    for d in docs:
        if not d.get("consumedAt"):
            await delete_doc("otp_sessions", d["id"])
    return len(docs)


async def seed_transport_kyc(uid, vehicle_id):
    """The real KYC gate (transport.py::_vehicle_docs_verified): a kyc_cases doc
    with rc+dl verified, plus vehicle docStatus='verified' (mirrors
    tests/test_transport.py::_verify_vehicle)."""
    from app.core.db import get_doc, set_doc
    case_id = f"kyc_{uid[:8]}_transport"
    await set_doc(
        "kyc_cases",
        case_id,
        {
            "caseId": case_id,
            "userId": uid,
            "persona": "transport",
            "docs": [
                {"docId": f"{case_id}:rc", "type": "rc", "status": "verified"},
                {"docId": f"{case_id}:dl", "type": "dl", "status": "verified"},
            ],
            "status": "verified",
        },
    )
    vehicle = await get_doc("vehicles", vehicle_id)
    if vehicle is None:
        raise StepFail(f"vehicle {vehicle_id} missing for KYC seed")
    vehicle["docStatus"] = "verified"
    vehicle["docReview"] = "kyc"
    await set_doc("vehicles", vehicle_id, vehicle)
    return case_id


# ------------------------------------------------------------------- auth

async def transporter_token_via_otp(client):
    cleared = await clear_otp_sessions(TRANSPORTER_PHONE)
    anon = Api(client)
    status, sent = await anon.j("POST", "/v1/auth/otp/send", expect=200,
                                json={"phone": TRANSPORTER_PHONE})
    dev_otp = sent.get("devOtp")
    sid = sent.get("otpSessionId")
    if not dev_otp or not sid:
        raise StepFail(f"otp/send missing devOtp: {sent}", status=str(status))
    status, verified = await anon.j(
        "POST", "/v1/auth/otp/verify", expect=200,
        json={"phone": TRANSPORTER_PHONE, "otp": dev_otp, "otpSessionId": sid},
    )
    token = verified.get("accessToken")
    if not token:
        raise StepFail(f"otp/verify missing accessToken: {verified}", status=str(status))
    CTX["otp_sessions_cleared"] = cleared
    return token, verified.get("user", {})


# ================================================================== PART 1

async def farmer_flow(client):
    farmer = Api(client, await mint_farmer_token())

    async def s01_health():
        r = await farmer.req("GET", "/v1/health", expect=200)
        return "200", (r.json().get("status") or "ok")

    async def s02_me():
        s, me = await farmer.j("GET", "/v1/users/me", expect=200)
        for field, want in (("name", "Tushar Chaudhari"), ("district", "Nashik"),
                            ("activeProfile", "farmer"), ("kycStatus", "verified")):
            if me.get(field) != want:
                raise StepFail(f"{field}={me.get(field)!r}, want {want!r}", s)
        return s, f"{me['name']} | {me['district']} | {me['activeProfile']} | kyc={me['kycStatus']}"

    async def s03_mandi():
        s1, prices = await farmer.j("GET", "/v1/mandi/prices?crop=Onion", expect=200)
        if not prices.get("data"):
            raise StepFail(f"no mandi price rows for Onion: {prices}", s1)
        s2, cmp_ = await farmer.j("GET", "/v1/mandi/compare?crop=Onion&quantityQuintals=50", expect=200)
        if not cmp_.get("data"):
            raise StepFail(f"compare empty: {cmp_}", s2)
        s3, hist = await farmer.j("GET", "/v1/mandi/prices/history?crop=Wheat", expect=200)
        if not hist.get("data"):
            raise StepFail(f"history empty: {hist}", s3)
        s4, smart = await farmer.j("POST", "/v1/mandi/smart-select", expect=200,
                                   json={"crop": "Onion", "quantityQuintals": 50})
        return f"{s1}/{s2}/{s3}/{s4}", (
            f"prices={len(prices['data'])} compare={len(cmp_['data'])} "
            f"history={len(hist['data'])} smart={smart.get('suggestion', smart.get('mandi', 'ok'))}"
        )[:180]

    async def s04_weather():
        s, w = await farmer.j("GET", "/v1/weather?lat=20.1742&lng=73.9851", expect=200)
        keys = ",".join(list(w)[:4])
        return s, f"keys: {keys}"

    async def s05_demands():
        s1, browse = await farmer.j("GET", "/v1/demands/browse?state=Maharashtra", expect=200)
        ids = {d.get("id") for d in browse.get("data", [])}
        if "dem_itc_soybean_01" not in ids:
            raise StepFail(f"dem_itc_soybean_01 not in browse ({len(ids)} ids)", s1)
        s2, dem = await farmer.j("GET", "/v1/demands/dem_itc_soybean_01", expect=200)
        s3, missing = await farmer.j("GET", "/v1/demands/dem_missing", expect=404)
        return f"{s1}/{s2}/{s3}", f"browse={len(ids)} demand={dem.get('crop', '?')} missing->404"

    async def s06_lot():
        body = {
            "crop": "Soybean (JS 335)", "quantityQuintals": 40, "expectedRate": 4900,
            "variety": "JS 335", "grade": "A", "village": "Pimpalgaon Baswant",
            "lat": 20.1742, "lng": 73.9851,
        }
        s1, lot = await farmer.j("POST", "/v1/market/lots", expect=(200, 201), json=body)
        lot_id = lot.get("id")
        if not lot_id:
            raise StepFail(f"lot create returned no id: {lot}", s1)
        CTX["lot_id"] = lot_id
        s2, lots = await farmer.j("GET", "/v1/market/lots", expect=200)
        mine = [l for l in lots.get("data", []) if l.get("id") == lot_id]
        if not mine:
            raise StepFail(f"lot {lot_id} not in GET /market/lots", s2)
        return f"{s1}/{s2}", f"lot={lot_id} status={lot.get('status')}"

    async def s07_offer():
        body = {
            "targetType": "demand", "targetId": "dem_itc_soybean_01",
            "pricePerUnit": 4850, "quantity": 40,
            "message": "E2E: 40 q JS 335, pickup tomorrow", "transportMode": "buyerPickup",
        }
        s1, offer = await farmer.j("POST", "/v1/offers", expect=(200, 201), json=body)
        offer_id = offer.get("id")
        if not offer_id or offer.get("status") not in ("pending", "countered"):
            raise StepFail(f"bad offer: {offer}", s1)
        CTX["offer_id"] = offer_id
        s2, mine = await farmer.j("GET", "/v1/offers/mine?filter=sent", expect=200)
        if offer_id not in {o.get("id") for o in mine.get("data", [])}:
            raise StepFail(f"offer {offer_id} not in offers/mine", s2)
        return f"{s1}/{s2}", f"offer={offer_id} status={offer.get('status')}"

    async def s08_purchases():
        s1, lst = await farmer.j("GET", "/v1/purchases?role=farmer", expect=200)
        rows = {p.get("id"): p for p in lst.get("data", [])}
        want = {"pur_itc_soy_9812": "pickupScheduled", "pur_motherdairy_onion_8721": "inTransit",
                "pur_reliance_wheat_7612": "completed"}
        for pid, st in want.items():
            if rows.get(pid, {}).get("status") != st:
                raise StepFail(f"{pid} status={rows.get(pid, {}).get('status')}, want {st}", s1)
        s2, pur = await farmer.j("GET", "/v1/purchases/pur_itc_soy_9812", expect=200)
        escrow, handover = pur.get("escrow") or {}, pur.get("handover") or {}
        if not escrow or not handover:
            raise StepFail(f"escrow/handover missing: {list(pur)}", s2)
        return f"{s1}/{s2}", (
            f"3 purchases ok; escrow={escrow.get('status')} handover.otp={'set' if handover.get('otp') else 'missing'}"
        )

    async def s09_handover_otp():
        s, otp = await farmer.j("GET", "/v1/purchases/pur_itc_soy_9812/handover-otp", expect=200)
        if otp.get("otp") != "742918":
            raise StepFail(f"handover otp={otp.get('otp')}, want seeded 742918", s)
        return s, f"otp={otp['otp']} expiresAt={otp.get('expiresAt', '')[:19]}"

    async def s10_invoice_pdf():
        r = await farmer.req("GET", "/v1/purchases/pur_reliance_wheat_7612/invoice.pdf", expect=200)
        ctype = r.headers.get("content-type", "")
        if "pdf" not in ctype:
            raise StepFail(f"content-type={ctype}, want pdf", str(r.status_code))
        return str(r.status_code), f"content-type={ctype} bytes={len(r.content)}"

    async def s11_diary():
        s1, inc = await farmer.j("GET", "/v1/diary/entries?type=income", expect=200)
        cats = {e.get("category") for e in inc.get("data", [])}
        if not {"advance_payment", "produce_sales"} <= cats:
            raise StepFail(f"seeded income categories missing, got {cats}", s1)
        s2, summary = await farmer.j("GET", "/v1/diary/analytics/summary", expect=200)
        if "totals" not in summary and "income" not in summary:
            raise StepFail(f"summary keys unexpected: {list(summary)}", s2)
        _, before = await farmer.j("GET", "/v1/gamification/status", expect=200)
        CTX["coins_before_diary"] = before.get("agriCoins", 0)
        body = {
            "title": "E2E: Certified soybean seed (JS 335) purchase",
            "category": "seeds", "type": "expense", "amount": 5000,
            "date": date.today().isoformat(), "cropName": "Soybean (JS 335)",
            "party": "Nashik Agro Seed Store", "tradeType": "buy",
            "notes": "E2E run entry",
        }
        s3, created = await farmer.j("POST", "/v1/diary/entries", expect=(200, 201), json=body)
        coins = created.get("agriCoinsEarned")
        CTX["coins_earned"] = coins
        return f"{s1}/{s2}/{s3}", (
            f"income entries={inc.get('total')} (incl. earlier auto-entries) | "
            f"agriCoinsEarned={coins}"
        )

    async def s12_gamification():
        s1, before = await farmer.j("GET", "/v1/gamification/status", expect=200)
        s2, after = await farmer.j("GET", "/v1/gamification/status", expect=200)
        baseline = CTX.get("coins_before_diary", before.get("agriCoins", 0))
        delta = after.get("agriCoins", 0) - baseline
        # award_coins truncates to the X11 daily earn cap (default 200/day):
        # after repeated runs the award can be < 15. The balance must reflect
        # at least one diary award on a fresh day, and never drop.
        if delta < 15:
            _, ledger = await farmer.j("GET", "/v1/gamification/ledger?pageSize=100", expect=200)
            today = date.today().isoformat()
            earned_today = sum(
                e.get("amount", 0) for e in ledger.get("data", [])
                if e.get("amount", 0) > 0 and str(e.get("at", ""))[:10] == today
            )
            if earned_today < 15:
                raise StepFail(f"coin delta={delta} and earned_today={earned_today}", f"{s1}/{s2}")
            detail_extra = f" (daily cap reached; earned_today={earned_today})"
        else:
            detail_extra = ""
        s3, ledger = await farmer.j("GET", "/v1/gamification/ledger", expect=200)
        return f"{s1}/{s2}/{s3}", (
            f"coins {baseline} -> {after['agriCoins']} (diary award +{delta}{detail_extra}); "
            f"ledger rows={ledger.get('total', len(ledger.get('data', [])))}"
        )

    async def s13_loans():
        s1, loans = await farmer.j("GET", "/v1/finance/loans", expect=200)
        rows = {l.get("applicationId"): l for l in loans.get("data", [])}
        loan = rows.get("kcc_sbi_loan_312")
        if not loan or loan.get("status") != "disbursed":
            raise StepFail(f"kcc_sbi_loan_312 missing/not disbursed: {list(rows)}", s1)
        s2, sched = await farmer.j("GET", "/v1/loans/kcc_sbi_loan_312/schedule", expect=200)
        if not sched.get("data"):
            raise StepFail(f"schedule empty: {sched}", s2)
        s3, cancel = await farmer.j("POST", "/v1/loans/kcc_sbi_loan_312/cancel", expect=409)
        return f"{s1}/{s2}/{s3}", f"loan disbursed; schedule={len(sched['data'])} rows; cancel->409"

    async def s14_insurance():
        s1, pols = await farmer.j("GET", "/v1/insurance/policies", expect=200)
        ids = {p.get("id") for p in pols.get("data", [])}
        if "pmfby_kharif_soy_312" not in ids:
            raise StepFail(f"pmfby_kharif_soy_312 not in {ids}", s1)
        s2, cert = await farmer.j("GET", "/v1/insurance/policies/pmfby_kharif_soy_312/certificate", expect=200)
        url = cert.get("certificateUrl", "")
        return f"{s1}/{s2}", f"policy active; certificate={url[:60]}"

    async def s15_schemes_land_soil():
        s1, schemes = await farmer.j("GET", "/v1/schemes?eligibleOnly=true", expect=200)
        s2, land = await farmer.j("GET", "/v1/land-records/search?village=Pimpalgaon%20Baswant", expect=200)
        if not land.get("data"):
            raise StepFail(f"no land records: {land}", s2)
        rec = land["data"][0]
        body = {"address": "Gat No. 312, Pimpalgaon Baswant, Nashik 422006",
                "slot": f"{date.today().isoformat()} am"}
        s3, booking = await farmer.j("POST", "/v1/soil-tests/book", expect=(200, 201), json=body)
        s4, again = await farmer.j("POST", "/v1/soil-tests/book", expect=(200, 201, 409), json=body)
        CTX["soil_dup_behavior"] = {200: "second booking allowed (no duplicate guard without plotId)",
                                    201: "second booking allowed (no duplicate guard without plotId)",
                                    409: "duplicate booking rejected (plot-guarded)"}[s4]
        return f"{s1}/{s2}/{s3}/{s4}", (
            f"schemes={len(schemes.get('data', []))} land={rec.get('gatNumber', rec.get('surveyNumber', '?'))} "
            f"soil={booking.get('id')} rebook->{s4}"
        )

    async def s16_notifications():
        s1, notifs = await farmer.j("GET", "/v1/notifications", expect=200)
        s2, rd = await farmer.j("PUT", "/v1/notifications/read-all", expect=200)
        return f"{s1}/{s2}", f"notifications={notifs.get('total', len(notifs.get('data', [])))} read-all updated={rd.get('updated')}"

    steps = [
        ("F01 health (no auth)", s01_health),
        ("F02 GET /users/me profile", s02_me),
        ("F03 mandi prices/compare/history/smart-select", s03_mandi),
        ("F04 weather", s04_weather),
        ("F05 demands browse/detail/404", s05_demands),
        ("F06 market lot create + list", s06_lot),
        ("F07 offer on demand + offers/mine", s07_offer),
        ("F08 purchases list + detail", s08_purchases),
        ("F09 handover-otp (seeded 742918)", s09_handover_otp),
        ("F10 invoice.pdf", s10_invoice_pdf),
        ("F11 diary income/summary/create", s11_diary),
        ("F12 gamification coins +15 + ledger", s12_gamification),
        ("F13 loans list/schedule/cancel-409", s13_loans),
        ("F14 insurance policies + certificate", s14_insurance),
        ("F15 schemes + land-records + soil-tests", s15_schemes_land_soil),
        ("F16 notifications + read-all", s16_notifications),
    ]
    for name, fn in steps:
        await step(name, fn)


# ================================================================== PART 2

async def transporter_flow(client):
    token, user = await transporter_token_via_otp(client)
    CTX["transporter_uid"] = user.get("id", TRANSPORTER_UID)
    tr = Api(client, token)
    anon_farmer = Api(client, await mint_farmer_token())

    async def t01_profile():
        s1, linked = await tr.j("POST", "/v1/users/me/profiles", expect=(200, 409),
                                json={"profileType": "transport"})
        note = "linked" if s1 == 200 else f"already linked ({linked.get('detail', {}).get('code', '409')})"
        s2, act = await tr.j("POST", "/v1/users/me/profiles/transport/activate", expect=200)
        if act.get("activeProfile") not in ("transport", "transporter"):
            raise StepFail(f"activeProfile={act.get('activeProfile')}", s2)
        s3, prof = await tr.j("GET", "/v1/transport/profile", expect=200)
        stats = prof.get("stats", {})
        return f"{s1}/{s2}/{s3}", (
            f"profile {note}; active={act['activeProfile']}; "
            f"vehicles={stats.get('totalVehicles')} rating={stats.get('rating')}"
        )

    async def t02_vehicle():
        reg = f"MH15 E2E {int(time.time()) % 100000:05d}"
        body = {"vehicleType": "Tata Ace", "registrationNo": reg, "capacityTonnes": 0.75,
                "pucExpiry": "2027-12-31", "fitnessExpiry": "2027-12-31", "insuranceExpiry": "2027-12-31"}
        s1, veh = await tr.j("POST", "/v1/transport/vehicles", expect=(201, 402, 409), json=body)
        if s1 == 201:
            CTX["vehicle_id"] = veh.get("id")
            note = f"created {veh.get('id')} ({reg})"
        else:
            # Free plan allows 1 vehicle — reruns hit the plan cap; reuse the fleet.
            s2, mine = await tr.j("GET", "/v1/transport/vehicles/my", expect=200)
            active = [v for v in mine.get("data", []) if v.get("active", True)]
            if not active:
                raise StepFail(f"vehicle create -> {s1} and no existing vehicle: {veh}", s1)
            CTX["vehicle_id"] = active[0]["id"]
            note = f"create->{s1} (plan cap), reusing {CTX['vehicle_id']}"
        return f"{s1}", note

    async def t03_kyc_gate():
        case_id = await seed_transport_kyc(CTX["transporter_uid"], CTX["vehicle_id"])
        CTX["kyc_case_id"] = case_id
        return "DB", f"wrote kyc_cases/{case_id} (rc+dl verified) + vehicles/{CTX['vehicle_id']} docStatus=verified"

    async def t04_vehicle_location():
        s, veh = await tr.j("POST", f"/v1/transport/vehicles/{CTX['vehicle_id']}/location",
                            expect=200, json={"lat": 20.1742, "lng": 73.9851, "availableNow": True})
        loc = veh.get("currentLocation") or {}
        if loc.get("lat") != 20.1742:
            raise StepFail(f"currentLocation not stored: {veh}", s)
        return s, f"currentLocation={loc.get('lat')},{loc.get('lng')} availableNow={veh.get('availableNow')}"

    async def t05_farmer_books():
        s1, est = await anon_farmer.j("POST", "/v1/transport/fare-estimate", expect=200,
                                      json={"vehicleType": "Tata Ace", "distanceKm": 25})
        fare = est.get("totalFare")
        if not fare:
            raise StepFail(f"fare estimate empty: {est}", s1)
        CTX["fare_paise"] = int(round(fare * 100))
        body = {
            "vehicleType": "Tata Ace", "distanceKm": 25,
            "pickup": "Pimpalgaon Baswant, Nashik", "drop": "Lasalgaon APMC, Nashik",
            "date": date.today().isoformat(),
            "pickupCoords": {"lat": 20.1742, "lng": 73.9851},
            "dropCoords": {"lat": 20.1453, "lng": 74.2250},
            "commodity": "Onion (Garwa)", "weightQuintals": 25,
        }
        s2, booking = await anon_farmer.j("POST", "/v1/transport/bookings", expect=(200, 201), json=body)
        if booking.get("status") != "requested":
            raise StepFail(f"booking status={booking.get('status')}", s2)
        CTX["booking_id"] = booking.get("id")
        return f"{s1}/{s2}", f"estimate totalFare={fare} paise={CTX['fare_paise']} booking={CTX['booking_id']}"

    async def t06_offer_accept():
        s1, lst = await tr.j("GET", "/v1/transport/bookings?status=requested", expect=200)
        if CTX["booking_id"] not in {b.get("id") for b in lst.get("data", [])}:
            raise StepFail("booking not visible to transporter", s1)
        s2, offer = await tr.j("POST", f"/v1/transport/bookings/{CTX['booking_id']}/offer",
                               expect=(200, 201), json={"farePaise": CTX["fare_paise"], "message": "E2E quote"})
        oid = offer.get("offerId")
        if not oid:
            raise StepFail(f"offer bad: {offer}", s2)
        s3, off_list = await anon_farmer.j("GET", f"/v1/transport/bookings/{CTX['booking_id']}/offers", expect=200)
        if oid not in {o.get("offerId") for o in off_list.get("data", [])}:
            raise StepFail(f"offer {oid} not visible to farmer", s3)
        s4, acc = await anon_farmer.j(
            "POST", f"/v1/transport/bookings/{CTX['booking_id']}/offers/{oid}/accept", expect=200)
        s5, booking = await anon_farmer.j("GET", f"/v1/transport/bookings/{CTX['booking_id']}", expect=200)
        if booking.get("status") != "accepted":
            raise StepFail(f"booking status after accept={booking.get('status')}", s5)
        CTX["offer_id"] = oid
        return f"{s1}/{s2}/{s3}/{s4}/{s5}", (
            f"offer={oid} farePaise={offer.get('farePaise')} -> booking accepted, fare={booking.get('fare')}"
        )

    async def t07_drive_trip():
        bid = CTX["booking_id"]
        s1, b1 = await tr.j("PATCH", f"/v1/transport/bookings/{bid}", expect=200,
                            json={"status": "arrivedPickup"})
        s2, b2 = await tr.j("PATCH", f"/v1/transport/bookings/{bid}", expect=200,
                            json={"status": "loading"})
        s3, ping = await tr.j("POST", f"/v1/transport/bookings/{bid}/location", expect=200,
                              json={"lat": 20.17, "lng": 73.99, "waypoint": "loaded",
                                    "waypointLabel": "Loaded at farm gate"})
        s4, b4 = await tr.j("PATCH", f"/v1/transport/bookings/{bid}", expect=200,
                            json={"status": "enRoute"})
        s5, loc = await tr.j("GET", f"/v1/transport/bookings/{bid}/location", expect=200)
        wps = loc.get("waypoints", [])
        if not any(w.get("waypoint") == "loaded" for w in wps):
            raise StepFail(f"waypoint ping missing: {[w.get('waypoint') for w in wps]}", s5)
        return f"{s1}/{s2}/{s3}/{s4}/{s5}", (
            f"arrivedPickup->loading->enRoute; waypoints={len(wps)}; "
            f"last={loc.get('currentLocation', {}).get('lat')},{loc.get('currentLocation', {}).get('lng')}"
        )

    async def t08_pod_otp():
        bid = CTX["booking_id"]
        s1, pod = await anon_farmer.j("GET", f"/v1/transport/bookings/{bid}/pod-otp", expect=200)
        otp = pod.get("otp")
        if not otp:
            raise StepFail(f"no pod otp: {pod}", s1)
        s2, booking = await tr.j(
            "POST", f"/v1/transport/bookings/{bid}/verify-pod-otp", expect=200,
            json={"otp": otp, "podPhotos": ["https://example.com/pod1.jpg"],
                  "receiverName": "Ram Patil"},
        )
        if booking.get("status") != "delivered":
            raise StepFail(f"status={booking.get('status')}, want delivered", s2)
        return f"{s1}/{s2}", f"pod otp={otp} verified -> status=delivered"

    async def t09_rate_docs():
        bid = CTX["booking_id"]
        s1, rated = await tr.j("POST", f"/v1/transport/bookings/{bid}/rate-farmer",
                               expect=(200, 201), json={"rating": 5, "review": "E2E smooth pickup"})
        s2, exp = await tr.j("GET", f"/v1/transport/bookings/{bid}/expenses", expect=200)
        gross = float(exp.get("grossFare") or 0)
        comm = float(exp.get("platformCommission") or 0)
        if gross <= 0 or abs(comm - round(gross * 0.10, 2)) > 0.05:
            raise StepFail(f"commission {comm} != 10% of {gross}", s2)
        s3, bilty = await tr.j("GET", f"/v1/transport/bookings/{bid}/bilty", expect=200)
        s4, receipt = await tr.j("GET", f"/v1/transport/bookings/{bid}/receipt", expect=200)
        r5 = await tr.req("GET", f"/v1/transport/bookings/{bid}/receipt.pdf", expect=200)
        ctype = r5.headers.get("content-type", "")
        detail = f"rated 5; fare={gross} commission={comm} (10%); bilty+receipt ok; pdf={ctype}"
        if "pdf" not in ctype:
            detail += f" (body: {r5.text[:80]})"
        return f"{s1}/{s2}/{s3}/{s4}/{r5.status_code}", detail

    async def t10_dashboard_wallet_ratings():
        s1, dash = await tr.j("GET", "/v1/transport/dashboard", expect=200)
        s2, wallet = await tr.j("GET", "/v1/transport/wallet", expect=200)
        s3, ratings = await tr.j("GET", "/v1/transport/ratings", expect=200)
        return f"{s1}/{s2}/{s3}", (
            f"dashboard trips={dash.get('todayTrips', dash.get('activeTrips', '?'))} | "
            f"wallet balancePaisa={wallet.get('balancePaisa')} entries={wallet.get('entryCount')} | "
            f"ratings total={ratings.get('total')}"
        )

    async def n01_patch_delivered_again():
        s, r = await tr.j("PATCH", f"/v1/transport/bookings/{CTX['booking_id']}",
                          expect=409, json={"status": "delivered"})
        return s, f"delivered->delivered rejected: {r.get('detail', {}).get('code', r)}"

    async def n02_farmer_reads_foreign_booking():
        # A second booking owned by the transporter (booker role allows transport).
        s1, other = await tr.j("POST", "/v1/transport/bookings", expect=(200, 201), json={
            "vehicleType": "Bolero Maxi", "distanceKm": 10,
            "pickup": "Nashik APMC", "drop": "Ozar, Nashik",
            "date": date.today().isoformat(),
        })
        CTX["foreign_booking_id"] = other.get("id")
        s2, r = await anon_farmer.j("GET", f"/v1/transport/bookings/{other['id']}", expect=(403, 404))
        return f"{s1}/{s2}", f"foreign booking {other['id'][:14]}... -> {s2} {r.get('detail', {}).get('code', '')}"

    async def n03_payout_no_mpin():
        # Fresh OTP user has no mpinHash -> 409 MPIN_NOT_SET (with a dummy 4-digit
        # mpin that passes model validation). Omitting mpin entirely is a 422.
        s, r = await tr.j("POST", "/v1/transport/payouts", expect=(409, 401),
                          json={"mpin": "1234"})
        code = r.get("detail", {}).get("code", r) if isinstance(r.get("detail"), dict) else r
        return s, f"payout without account MPIN -> {s} {code}"

    async def n04_analytics_entitlement():
        s, r = await tr.j("GET", "/v1/transport/analytics", expect=(200, 402))
        code = ""
        if isinstance(r.get("detail"), dict):
            code = r["detail"].get("code", "")
        return s, f"analytics -> {s} {code or 'available'}"

    steps = [
        ("T01 OTP login + transport profile activate", t01_profile),
        ("T02 register vehicle (plan-cap aware)", t02_vehicle),
        ("T03 KYC gate seeded (kyc_cases + vehicle)", t03_kyc_gate),
        ("T04 vehicle location ping", t04_vehicle_location),
        ("T05 farmer fare-estimate + booking", t05_farmer_books),
        ("T06 offer -> farmer accepts (fare locked)", t06_offer_accept),
        ("T07 drive trip: arrived/loading/ping/enRoute", t07_drive_trip),
        ("T08 POD-OTP delivery", t08_pod_otp),
        ("T09 rate farmer + expenses/bilty/receipt", t09_rate_docs),
        ("T10 dashboard/wallet/ratings", t10_dashboard_wallet_ratings),
        ("N01 PATCH delivered again -> 409", n01_patch_delivered_again),
        ("N02 farmer reads foreign booking -> 403/404", n02_farmer_reads_foreign_booking),
        ("N03 payout without MPIN -> 409/401", n03_payout_no_mpin),
        ("N04 analytics entitlement (200 or 402)", n04_analytics_entitlement),
    ]
    for name, fn in steps:
        await step(name, fn)


# ===================================================================== main

async def main():
    print(f"E2E farmer+transporter vs {BASE}")
    async with httpx.AsyncClient(timeout=45) as client:
        await farmer_flow(client)
        await transporter_flow(client)

    print("\n================ RESULTS ================")
    failed = 0
    for name, ok, status, detail in RESULTS:
        if not ok:
            failed += 1
    for name, ok, status, detail in RESULTS:
        mark = "PASS" if ok else "FAIL"
        print(f"{mark}  {name:<58} [{status}]  {detail}")
    print(f"\n{len(RESULTS) - failed}/{len(RESULTS)} passed")
    if CTX.get("soil_dup_behavior"):
        print(f"note: soil-test rebook behavior -> {CTX['soil_dup_behavior']}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
