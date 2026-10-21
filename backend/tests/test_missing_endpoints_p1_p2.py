"""Comprehensive tests for P0, P1, and P2 missing endpoints.

Tests all endpoints with real data, roles, and lifecycles based on agent_missing_endpoints.md
and userflow.md personas:
- Farmer (lots relist, persona dashboard)
- Seller / Vyapari (team sub-accounts, mall order status, GST reports & commission invoice)
- Direct Buyer (standing demands planner, monthly statements PDF/JSON, farmer reliability)
- Broker / Dalal & Farmer (deal acceptance with MPIN)
- Superadmin Dispute Settlement (disputes money movement: refunds, escrow release)
- Admin SOP Platform & Operations (mandi rates, transport pricing, penalties, coins, nursery verify,
  product certificates, security policy, settlement hold, users export, land records export,
  financial report, water usage, FPO financials, women impact, chatbot satisfaction, sapling survival,
  biofuel trees, dairy rate charts, notification templates)
- Insurance Provider (compliance stats export CSV/JSON)
- Cold Storage Provider & Admin (facility verification, booking audit, rent accrual ledger)
- Saved Searches (CRUD & alerts toggle)
"""
import pytest
from datetime import datetime, timezone
from app.services.tokens import create_access_token
from tests.test_admin import _seed_admin, admin_headers


def _auth(uid: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(uid)}"}


def _seed_persona(user_store: dict, uid: str, role: str, name: str = "Test User", **kwargs) -> str:
    user_doc = {
        "id": uid,
        "name": name,
        "phone": f"+9198{uid[-8:]}".ljust(13, "0"),
        "linkedProfiles": [role],
        "activeProfile": role,
        "primaryProfile": role,
        "state": "Maharashtra",
        "district": "Nashik",
        **kwargs,
    }
    user_store[f"users/{uid}"] = user_doc
    return uid


# ============================================================================
# P0-6 & P0-15: Farmer Deal Accept & Admin Dispute Settlement
# ============================================================================


async def test_p0_farmer_deal_accept_mpin(client, user_store):
    """P0-6: Farmer e-signs and accepts broker deal contract with MPIN."""
    farmer_id = _seed_persona(user_store, "farmer_p0_1", "farmer", name="Kisan Ram")
    broker_id = _seed_persona(user_store, "broker_p0_1", "broker", name="Dalal Shyam")

    deal_id = "deal_p0_101"
    user_store[f"broker_deals/{deal_id}"] = {
        "id": deal_id,
        "brokerId": broker_id,
        "farmerId": farmer_id,
        "status": "contract_issued",
        "commodity": "Onion",
        "quantityQuintals": 50,
        "agreedRate": 2200,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    # Accept via /deals/{deal_id}/accept
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/accept",
        json={"mpin": "1234", "signatureData": "sig_data_base64", "consentTimestamp": "2026-10-17T10:00:00Z"},
        headers=_auth(farmer_id),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "accepted"


async def test_p0_admin_dispute_settlement_refund_execution(client, user_store):
    """P0-15: Superadmin executes dispute settlement with money movement."""
    _seed_admin(user_store, "admin_root")
    buyer_id = _seed_persona(user_store, "buyer_disp_1", "directBuyer")
    seller_id = _seed_persona(user_store, "seller_disp_1", "seller")

    purchase_id = "purchase_disp_1"
    user_store[f"purchases/{purchase_id}"] = {
        "id": purchase_id,
        "buyerId": buyer_id,
        "sellerId": seller_id,
        "status": "disputed",
        "totalAmount": 10000,
        "escrowStatus": "frozen",
    }

    dispute_id = "disp_test_01"
    user_store[f"disputes/{dispute_id}"] = {
        "id": dispute_id,
        "purchaseId": purchase_id,
        "status": "open",
        "raisedBy": buyer_id,
        "reason": "Damaged goods delivered",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    resp = await client.post(
        f"/v1/admin/disputes/{dispute_id}/settlement",
        json={
            "releaseTo": "buyer",
            "refundAmountPaise": 500000,
            "penaltyPaise": 50000,
            "resolutionNotes": "50% refund to buyer; penalty on seller for transit defect.",
        },
        headers=admin_headers(),
    )
    assert resp.status_code == 200
    res = resp.json()
    assert res["success"] is True
    assert res["settlement"]["releaseTo"] == "buyer"
    assert res["settlement"]["refundAmountPaise"] == 500000


# ============================================================================
# P1: Seller Team, Order Fulfilment, GST Reports & Standing Demands Planner
# ============================================================================


async def test_p1_seller_team_management(client, user_store):
    """P1-2: Seller team invites, listing, role changes, and member removal."""
    seller_id = _seed_persona(user_store, "seller_team_mgr", "seller", name="Suresh Vyapari")
    headers = _auth(seller_id)

    # 1. Invite team member (role: agent, accountant, manager, procurement)
    resp = await client.post(
        "/v1/seller/team/invites",
        json={"phone": "+919876543210", "name": "Mohan Clerk", "role": "accountant"},
        headers=headers,
    )
    assert resp.status_code == 201
    member = resp.json()
    member_id = member["id"]
    assert member["role"] == "accountant"

    # 2. List members
    list_resp = await client.get("/v1/seller/team/members", headers=headers)
    assert list_resp.status_code == 200
    assert any(m["id"] == member_id for m in list_resp.json()["data"])

    # 3. Update role
    put_resp = await client.put(
        f"/v1/seller/team/members/{member_id}/role",
        json={"role": "manager"},
        headers=headers,
    )
    assert put_resp.status_code == 200
    assert put_resp.json()["role"] == "manager"

    # 4. Remove member
    del_resp = await client.delete(f"/v1/seller/team/members/{member_id}", headers=headers)
    assert del_resp.status_code == 200


async def test_p1_seller_order_fulfilment_lifecycle(client, user_store):
    """P1-3: Seller order fulfillment status progression."""
    seller_id = _seed_persona(user_store, "seller_ord_mgr", "seller")
    buyer_id = _seed_persona(user_store, "customer_ord_1", "customer")
    headers = _auth(seller_id)

    order_id = "ord_seller_777"
    user_store[f"orders/{order_id}"] = {
        "id": order_id,
        "sellerId": seller_id,
        "userId": buyer_id,
        "status": "confirmed",
        "totalAmount": 1500,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    # Step: confirmed -> shipped
    resp1 = await client.patch(
        f"/v1/seller/orders/{order_id}/status",
        json={"status": "shipped", "note": "Dispatched via AgroExpress"},
        headers=headers,
    )
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "shipped"

    # Step: shipped -> out_for_delivery
    resp2 = await client.patch(
        f"/v1/seller/orders/{order_id}/status",
        json={"status": "out_for_delivery", "note": "Out for local delivery"},
        headers=headers,
    )
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "out_for_delivery"

    # Step: out_for_delivery -> delivered
    resp3 = await client.patch(
        f"/v1/seller/orders/{order_id}/status",
        json={"status": "delivered", "note": "Delivered to customer"},
        headers=headers,
    )
    assert resp3.status_code == 200
    assert resp3.json()["status"] == "delivered"


async def test_p1_seller_gst_report_and_commission_invoice(client, user_store):
    """P1-4: Seller GST sales register and commission invoice PDF."""
    seller_id = _seed_persona(user_store, "seller_gst_user", "seller")
    headers = _auth(seller_id)

    # Seed a POS sale the way POST /seller/sales stores it —
    # users/{uid}/seller_sales with netAmount/quantity/unit.
    sale_id = "sale_gst_1"
    user_store[f"users/{seller_id}/seller_sales/{sale_id}"] = {
        "id": sale_id,
        "sellerId": seller_id,
        "buyerName": "Direct Foods",
        "item": "Tomato",
        "quantity": 10.0,
        "unit": "Quintal",
        "netAmount": 23600.0,
        "createdAt": "2026-10-05T10:00:00Z",
    }
    # shop GSTIN comes from the seller role profile (fallback "—")
    user_store[f"users/{seller_id}/role_profiles/seller"] = {
        "shopName": "GST Test Shop",
        "gstNumber": "27AAACV1234A1Z5",
    }

    purchase_id = "purch_gst_1"
    user_store[f"purchases/{purchase_id}"] = {
        "id": purchase_id,
        "sellerId": seller_id,
        "buyerId": "buyer_123",
        "status": "completed",
        "finalAmount": 20000,
        "createdAt": "2026-10-01T10:00:00Z",
    }

    # 1. GST register
    gst_resp = await client.get("/v1/seller/gst-reports?from=2026-10-01&to=2026-10-31", headers=headers)
    assert gst_resp.status_code == 200
    gst_data = gst_resp.json()
    assert gst_data["summary"]["totalSales"] >= 20000
    assert len(gst_data["records"]) >= 1
    assert gst_data["sellerGstin"] == "27AAACV1234A1Z5"
    record = gst_data["records"][0]
    assert record["crop"] == "Tomato"
    assert record["quantity"] == 10.0
    assert record["invoiceValue"] == 23600.0

    # 2. Commission invoice PDF
    inv_resp = await client.get(f"/v1/seller/purchases/{purchase_id}/commission-invoice", headers=headers)
    assert inv_resp.status_code == 200
    assert inv_resp.headers["content-type"] == "application/pdf"
    assert len(inv_resp.content) > 100



async def test_p1_standing_demands_planner_job(client, user_store):
    """P1-22: Direct buyer standing demand planner cron."""
    buyer_id = _seed_persona(user_store, "buyer_standing", "directBuyer")
    order_id = "std_ord_01"
    user_store[f"standing_orders/{order_id}"] = {
        "id": order_id,
        "buyerId": buyer_id,
        "crop": "Tomato",
        "quantityPerPeriod": 20.0,
        "period": "weekly",
        "frequency": "weekly",
        "status": "open",
        "startDate": "2026-10-01",
        "endDate": "2026-12-31",
        "minPrice": 1500,
        "maxPrice": 2200,
        "createdAt": "2026-10-10T00:00:00Z",
    }

    resp = await client.post("/v1/jobs/demands/standing/run")
    assert resp.status_code == 200
    res = resp.json()
    assert res["generated"] >= 1


# ============================================================================
# Admin SOP Writes (P1-30 to P1-38, P2-24 to P2-35)
# ============================================================================


async def test_admin_sop_writes_and_oversight(client, user_store):
    """P1-30..38 and P2-24..35 Admin SOP operations."""
    _seed_admin(user_store, "admin_sop")
    headers = admin_headers()

    # P1-30: Cold storage facility trust verify
    fac_id = "cs_fac_01"
    user_store[f"cold_storage/{fac_id}"] = {"id": fac_id, "name": "Nashik Cold Storage", "status": "pending"}
    resp = await client.post(f"/v1/admin/cold-storage/facilities/{fac_id}/verify", headers=headers)
    assert resp.status_code == 200

    # P2-24: Cold storage bookings audit
    bk_resp = await client.get("/v1/admin/cold-storage/bookings", headers=headers)
    assert bk_resp.status_code == 200

    # P1-31: Mandi manual rates override
    mandi_resp = await client.post(
        "/v1/admin/mandi/rates",
        json={"crop": "Onion", "mandi": "Lasalgaon", "modalPrice": 2450.0, "district": "Nashik"},
        headers=headers,
    )
    assert mandi_resp.status_code in (200, 201)

    # P1-32: Transport pricing rules
    put_trans_resp = await client.put(
        "/v1/admin/transport/pricing-rules",
        json={"baseFares": {"small": 500.0, "truck": 2000.0}, "freeWaitingMinutes": 45},
        headers=headers,
    )
    assert put_trans_resp.status_code == 200

    # P1-33: Penalty matrix config & waiver
    pen_resp = await client.put(
        "/v1/admin/platform-config/penalties",
        json={"noShowPenaltyPaisa": 30000},
        headers=headers,
    )
    assert pen_resp.status_code == 200

    waive_resp = await client.post(
        "/v1/admin/platform-config/penalties/waive",
        json={"penaltyId": "pen_123", "userId": "usr_99", "reason": "First-time medical emergency"},
        headers=headers,
    )
    assert waive_resp.status_code == 200

    # P1-34: AgriCoins economy config
    coins_resp = await client.put(
        "/v1/admin/platform-config/coins",
        json={"tiers": {"bronze": 1.0, "silver": 1.2, "gold": 1.5}},
        headers=headers,
    )
    assert coins_resp.status_code == 200

    # P1-35: Nursery verify
    nursery_id = "nur_01"
    user_store[f"nurseries/{nursery_id}"] = {"id": nursery_id, "name": "Green Earth Nursery", "status": "pending"}
    nur_resp = await client.post(f"/v1/admin/nurseries/{nursery_id}/verify", headers=headers)
    assert nur_resp.status_code == 200

    # P1-36: Product authenticity certificates
    prod_id = "prod_cert_01"
    user_store[f"products/{prod_id}"] = {"id": prod_id, "title": "Organic Neem Oil"}
    cert_resp = await client.post(
        f"/v1/admin/marketplace/products/{prod_id}/certificates",
        json={
            "certType": "agmark",
            "certNumber": "AGM-9988",
            "issuer": "Ministry of Agriculture",
            "certUrl": "https://storage.googleapis.com/certs/agm9988.pdf",
        },
        headers=headers,
    )
    assert cert_resp.status_code in (200, 201)

    cert_list_resp = await client.get(f"/v1/admin/marketplace/products/{prod_id}/certificates", headers=headers)
    assert cert_list_resp.status_code == 200
    assert len(cert_list_resp.json()["data"]) >= 1

    # P1-37: Security policy config
    sec_resp = await client.put(
        "/v1/admin/auth/security-policy",
        json={"enforceMpin": True, "maxFailedMpinAttempts": 5},
        headers=headers,
    )
    assert sec_resp.status_code == 200

    # P1-38: Settlement legal hold
    hold_resp = await client.post(
        "/v1/admin/settlements/holds",
        json={"lineId": "stl_line_01", "reason": "Suspicious GSTIN match"},
        headers=headers,
    )
    assert hold_resp.status_code in (200, 201)

    # P2-25: Users export
    usr_exp = await client.get("/v1/admin/users/export?format=csv", headers=headers)
    assert usr_exp.status_code == 200
    assert "text/csv" in usr_exp.headers["content-type"]

    # P2-26: Land records audit export
    land_exp = await client.get("/v1/admin/land-records/audit-log/export", headers=headers)
    assert land_exp.status_code == 200

    # P2-27: Financial reporting
    fin_rep = await client.get("/v1/admin/reports/financial", headers=headers)
    assert fin_rep.status_code == 200

    # P2-28: Water usage stats
    water_stats = await client.get("/v1/admin/water/usage-stats", headers=headers)
    assert water_stats.status_code == 200

    # P2-29: FPO financials
    fpo_id = "fpo_test_01"
    user_store[f"fpos/{fpo_id}"] = {"id": fpo_id, "name": "Nashik Grape Growers FPO", "annualTurnoverInr": 5000000}
    fpo_fin = await client.get(f"/v1/admin/fpo/{fpo_id}/financials", headers=headers)
    assert fpo_fin.status_code == 200
    assert fpo_fin.json()["turnoverRupees"] >= 5000000

    # P2-30: Women impact report
    w_rep = await client.get("/v1/admin/women/impact-report", headers=headers)
    assert w_rep.status_code == 200

    # P2-31: Chatbot satisfaction
    csat_resp = await client.get("/v1/admin/chatbot/satisfaction", headers=headers)
    assert csat_resp.status_code == 200
    assert "averageCsatScore" in csat_resp.json()

    # P2-32: Sapling survival
    tree_req_id = "treq_01"
    user_store[f"tree_requests/{tree_req_id}"] = {"id": tree_req_id, "survivalRatePercent": 88.0}
    surv_resp = await client.get(f"/v1/admin/tree/requests/{tree_req_id}/survival", headers=headers)
    assert surv_resp.status_code == 200

    # P2-33: Biofuel trees update
    bio_id = "bio_01"
    user_store[f"biofuel_trees/{bio_id}"] = {"id": bio_id, "cropName": "Pongamia", "yieldPerAcreKg": 2500}
    bio_resp = await client.put(f"/v1/admin/biofuel-trees/{bio_id}", json={"yieldPerAcreKg": 2800}, headers=headers)
    assert bio_resp.status_code == 200

    # P2-34: Dairy rate charts oversight
    dairy_rc = await client.get("/v1/admin/livestock/dairy/rate-charts", headers=headers)
    assert dairy_rc.status_code == 200
    assert "rateCharts" in dairy_rc.json()

    # P2-35: Notification templates
    tmpl_resp = await client.put(
        "/v1/admin/notification-templates",
        json={
            "templates": [
                {
                    "templateKey": "booking_confirmed",
                    "title": "Booking confirmed",
                    "body": "Booking confirmed for {farmer}",
                    "category": "transactional",
                }
            ]
        },
        headers=headers,
    )
    assert tmpl_resp.status_code == 200


# ============================================================================
# P2: Persona Dashboard, Saved Searches, Lot Relist, Statements & Insurance Export
# ============================================================================


async def test_p2_persona_dashboard(client, user_store):
    """P2-1: Unified persona home dashboard."""
    uid = _seed_persona(user_store, "dash_farmer_01", "farmer", name="Babu Farmer")
    resp = await client.get("/v1/users/me/dashboard/farmer", headers=_auth(uid))
    assert resp.status_code == 200
    data = resp.json()
    assert data["profileType"] == "farmer"
    assert "metricPills" in data
    assert "quickActions" in data


async def test_p2_saved_searches_lifecycle(client, user_store):
    """P2-3: Saved searches CRUD and harvest-window alerts."""
    uid = _seed_persona(user_store, "vyapari_saved_srch", "seller")
    headers = _auth(uid)

    # 1. Create saved search
    post_resp = await client.post(
        "/v1/saved-searches",
        json={"name": "Nashik Red Onion", "commodity": "Onion", "district": "Nashik", "maxPrice": 2500},
        headers=headers,
    )
    assert post_resp.status_code == 201
    search_id = post_resp.json()["id"]

    # 2. List saved searches
    get_resp = await client.get("/v1/saved-searches", headers=headers)
    assert get_resp.status_code == 200
    assert any(s["id"] == search_id for s in get_resp.json()["data"])

    # 3. Toggle alerts
    alert_resp = await client.post(f"/v1/saved-searches/{search_id}/alerts", json={"enabled": True}, headers=headers)
    assert alert_resp.status_code == 200
    assert alert_resp.json()["savedSearch"]["alertsEnabled"] is True

    # 4. Delete saved search
    del_resp = await client.delete(f"/v1/saved-searches/{search_id}", headers=headers)
    assert del_resp.status_code == 200


async def test_p2_farmer_lot_relist_priority(client, user_store):
    """P2-4: Farmer relists lot with priority boost after no-show."""
    farmer_id = _seed_persona(user_store, "lot_relist_farmer", "farmer")
    lot_id = "lot_relist_77"
    user_store[f"market_lots/{lot_id}"] = {
        "id": lot_id,
        "farmerId": farmer_id,
        "crop": "Pomegranate",
        "quantityQuintals": 30.0,
        "expectedRate": 6000,
        "status": "withdrawn",
        "createdAt": "2026-10-15T00:00:00Z",
    }

    resp = await client.post(
        f"/v1/market/lots/{lot_id}/relist",
        json={"priority": True, "expectedRate": 5800, "note": "Relisted after buyer no-show"},
        headers=_auth(farmer_id),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "open"
    assert data["priority"] is True
    assert data["expectedRate"] == 5800
    assert data.get("priorityBoost") is True


async def test_p2_direct_buyer_statements_and_reliability(client, user_store):
    """P2-15 & P2-16: Direct buyer monthly statements (JSON/PDF) and farmer reliability."""
    buyer_id = _seed_persona(user_store, "buyer_stmt_usr", "directBuyer", name="Penta Foods")
    farmer_id = _seed_persona(user_store, "farmer_reliable_usr", "farmer", name="Santosh Farmer")
    headers = _auth(buyer_id)

    purch_id = "purch_stmt_01"
    user_store[f"purchases/{purch_id}"] = {
        "id": purch_id,
        "buyerId": buyer_id,
        "sellerId": farmer_id,
        "farmerId": farmer_id,
        "commodity": "Wheat",
        "quantity": 100,
        "finalAmount": 250000,
        "commissionAmount": 5000,
        "status": "completed",
        "createdAt": "2026-10-12T10:00:00Z",
    }

    # 1. Statement JSON
    stmt_json = await client.get("/v1/direct-buyer/statements?month=2026-10", headers=headers)
    assert stmt_json.status_code == 200
    data = stmt_json.json()
    assert data["totalPurchases"] >= 1
    assert data["grossSpendRupees"] >= 250000

    # 2. Statement PDF
    stmt_pdf = await client.get("/v1/direct-buyer/statements?month=2026-10&format=pdf", headers=headers)
    assert stmt_pdf.status_code == 200
    assert stmt_pdf.headers["content-type"] == "application/pdf"
    assert len(stmt_pdf.content) > 100

    # 3. Farmer reliability score
    rel_resp = await client.get(f"/v1/direct-buyer/farmers/{farmer_id}/reliability", headers=headers)
    assert rel_resp.status_code == 200
    rel_data = rel_resp.json()
    assert rel_data["reliabilityScore"] >= 0
    assert rel_data["tier"] in ("elite", "reliable", "probation")
    assert rel_data["metrics"]["completedTrades"] >= 1


async def test_p2_insurance_provider_stats_export(client, user_store):
    """P2-21: Insurance provider compliance export (CSV/JSON)."""
    prov_id = _seed_persona(user_store, "ins_prov_01", "insuranceProvider")
    headers = _auth(prov_id)

    # 1. JSON
    json_resp = await client.get("/v1/insurance/provider/stats/export?format=json", headers=headers)
    assert json_resp.status_code == 200
    assert "lossRatioPercent" in json_resp.json()

    # 2. CSV
    csv_resp = await client.get("/v1/insurance/provider/stats/export?format=csv", headers=headers)
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert b"Agrovercity Insurance Provider" in csv_resp.content


async def test_p2_cold_storage_rent_ledger(client, user_store):
    """P2-22: Cold storage provider rent accrual & invoicing ledger."""
    prov_id = _seed_persona(user_store, "cs_prov_01", "coldStorageProvider")
    headers = _auth(prov_id)

    fac_id = "cs_fac_99"
    user_store[f"cold_storage/{fac_id}"] = {"id": fac_id, "ownerUid": prov_id, "name": "Cold Hub"}

    bk_id = "cs_bk_01"
    user_store[f"cold_storage_bookings/{bk_id}"] = {
        "id": bk_id,
        "facilityId": fac_id,
        "farmerName": "Ganesh Patil",
        "cropName": "Potato",
        "quantityBags": 200,
        "totalEstimatedRent": 12000.0,
        "paidRent": 4000.0,
        "status": "inwarded",
        "inwardDate": "2026-10-05T00:00:00Z",
    }

    resp = await client.get("/v1/post-harvest/provider/rent-ledger?month=2026-10", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["totalAccruedRupees"] >= 12000.0
    assert data["summary"]["totalOutstandingRupees"] >= 8000.0
    assert len(data["entries"]) >= 1
