"""Phase 4 Automated Tests for Superadmin Farmer Management Module (admin_sop_farmers).

Validates:
- Farmer directory search with multi-dimensional filters (district, crop type, query).
- Datetime filtering and Recent entered farmer 1st sorting (descending createdAt).
- Superadmin approval of land records updates the farmer's global KYC status to VERIFIED.
- Unauthorized access by standard/non-admin users returns 403 Forbidden.
- Farmer suspension invalidates authentication tokens (Redis blacklist).
- Farmer 360° summary schema validation against Farmer360DetailResponse.
- Lot moderation takedown.
- Farmer impersonation token generation with scoped claims.
"""
from datetime import datetime, timedelta, timezone
import pytest
from pydantic import ValidationError
from app.models.user import Farmer360DetailResponse, FarmerCommonFeatures360Response


ADMIN_HEADERS = {"Authorization": "Bearer admin-token"}
PLAIN_HEADERS = {"Authorization": "Bearer plain-token"}


def seed_farmer(
    user_store,
    uid,
    phone="+919812345678",
    name="Test Kisan",
    district="Pune",
    state="Maharashtra",
    crops=None,
    land_area=4.5,
    created_at=None,
    status="active",
    kyc_status="PENDING",
):
    if not created_at:
        created_at = datetime.now(timezone.utc).isoformat()
    if crops is None:
        crops = ["Wheat", "Soybean"]

    user_doc = {
        "id": uid,
        "uid": uid,
        "name": name,
        "fullName": name,
        "phone": phone,
        "email": f"{uid}@example.com",
        "primaryProfile": "farmer",
        "activeProfile": "farmer",
        "linkedProfiles": ["farmer"],
        "status": status,
        "is_suspended": status in ("suspended", "banned"),
        "kycStatus": kyc_status,
        "createdAt": created_at,
        "created_at": created_at,
        "state": state,
        "district": district,
        "village": "Baramati",
        "landAreaAcres": land_area,
        "crops": crops,
        "activeCrops": crops,
        "trustScore": 85.0,
        "landRecords": [
            {
                "id": f"rec_{uid}_1",
                "gatNumber": "GAT-101",
                "village": "Baramati",
                "district": district,
                "state": state,
                "acreage": land_area,
                "status": kyc_status,
                "verificationStatus": kyc_status,
                "documentUrls": ["https://example.com/712.pdf"],
            }
        ],
    }
    user_store[f"users/{uid}"] = user_doc
    return user_doc


# ---------------------------------------------------------------------------
# 1. Unauthorized Access Rejection (403 Forbidden)
# ---------------------------------------------------------------------------
async def test_farmer_unauthorized_access_rejected(client, user_store):
    """Non-admin callers must be rejected with 403 Forbidden."""
    resp = await client.get("/api/v1/admin/farmers", headers=PLAIN_HEADERS)
    assert resp.status_code == 403
    err_body = resp.json()
    code = (err_body.get("detail") or err_body.get("error", {})).get("code")
    assert code == "ADMIN_REQUIRED"

    resp_summary = await client.get("/api/v1/admin/farmers/any_farmer/summary", headers=PLAIN_HEADERS)
    assert resp_summary.status_code == 403


# ---------------------------------------------------------------------------
# 2. Search Filters (District, Crop Type, Query)
# ---------------------------------------------------------------------------
async def test_farmer_search_and_district_filters(client, user_store):
    """Search filters correctly return farmers by district, crop type, and text query."""
    seed_farmer(user_store, "f1", name="Ramesh Pawar", district="Pune", crops=["Sugarcane", "Wheat"])
    seed_farmer(user_store, "f2", name="Suresh Patil", district="Nashik", crops=["Grapes", "Onion"])
    seed_farmer(user_store, "f3", name="Ganesh Deshmukh", district="Nagpur", crops=["Cotton", "Oranges"])

    # Search by district: Nashik
    resp_dist = await client.get("/api/v1/admin/farmers?district=Nashik", headers=ADMIN_HEADERS)
    assert resp_dist.status_code == 200
    dist_farmers = resp_dist.json()["farmers"]
    assert len(dist_farmers) == 1
    assert dist_farmers[0]["id"] == "f2"

    # Search by crop type: Sugarcane
    resp_crop = await client.get("/api/v1/admin/farmers?crop_type=Sugarcane", headers=ADMIN_HEADERS)
    assert resp_crop.status_code == 200
    crop_farmers = resp_crop.json()["farmers"]
    assert len(crop_farmers) == 1
    assert crop_farmers[0]["id"] == "f1"

    # Query by name: Ganesh
    resp_q = await client.get("/api/v1/admin/farmers?q=Ganesh", headers=ADMIN_HEADERS)
    assert resp_q.status_code == 200
    assert resp_q.json()["farmers"][0]["id"] == "f3"


# ---------------------------------------------------------------------------
# 3. Datetime Filtering and Recent Entered Farmer 1st Sorting
# ---------------------------------------------------------------------------
async def test_farmer_datetime_filtering_and_recent_entered_first(client, user_store):
    """Farmers must be sorted by default with the most recently entered farmer 1st.
    Datetime range filter must correctly filter by start_date and end_date.
    """
    now = datetime.now(timezone.utc)
    t_old = (now - timedelta(days=15)).isoformat()
    t_mid = (now - timedelta(days=5)).isoformat()
    t_recent = now.isoformat()

    seed_farmer(user_store, "f_old", name="Old Farmer", created_at=t_old)
    seed_farmer(user_store, "f_mid", name="Mid Farmer", created_at=t_mid)
    seed_farmer(user_store, "f_recent", name="Recent Farmer", created_at=t_recent)

    # Default sort: recent entered farmer 1st (descending createdAt)
    resp = await client.get("/api/v1/admin/farmers", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    farmers = resp.json()["farmers"]
    ids = [f["id"] for f in farmers]
    # f_recent must appear before f_mid and f_old
    assert ids.index("f_recent") < ids.index("f_mid")
    assert ids.index("f_mid") < ids.index("f_old")

    # Datetime range filter: only farmers registered in the last 7 days
    start_filter = (now - timedelta(days=7)).isoformat()
    resp_date = await client.get(f"/api/v1/admin/farmers?start_date={start_filter}", headers=ADMIN_HEADERS)
    assert resp_date.status_code == 200
    filtered_ids = [f["id"] for f in resp_date.json()["farmers"]]
    assert "f_recent" in filtered_ids
    assert "f_mid" in filtered_ids
    assert "f_old" not in filtered_ids


# ---------------------------------------------------------------------------
# 4. Superadmin Land Record Approval Updates Global Farmer KYC to VERIFIED
# ---------------------------------------------------------------------------
async def test_superadmin_land_record_approval_updates_kyc(client, user_store):
    """Superadmin approval of land records updates the farmer's global KYC status to VERIFIED."""
    seed_farmer(user_store, "f_kyc_1", kyc_status="PENDING")

    # Initial KYC status must be PENDING
    assert user_store["users/f_kyc_1"]["kycStatus"] == "PENDING"

    # Approve land record
    resp = await client.put(
        "/api/v1/admin/farmers/f_kyc_1/land-records/rec_f_kyc_1_1/verify",
        json={"status": "VERIFIED", "remarks": "Approved 7/12 extract matches revenue records"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["status"] == "VERIFIED"
    assert body["farmerKycStatus"] == "VERIFIED"

    # Global KYC status of user in store must now be VERIFIED
    updated_user = user_store["users/f_kyc_1"]
    assert updated_user["kycStatus"] == "VERIFIED"


# ---------------------------------------------------------------------------
# 5. Farmer 360° Summary Schema Validation
# ---------------------------------------------------------------------------
async def test_farmer_360_summary_schema_validation(client, user_store):
    """Summary endpoint must validate against Farmer360DetailResponse schema."""
    seed_farmer(user_store, "f_sum_1", name="Balasaheb Shinde", land_area=8.2)

    resp = await client.get("/api/v1/admin/farmers/f_sum_1/summary", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()

    # Schema validation against Pydantic model
    validated = Farmer360DetailResponse.model_validate(data)
    assert validated.id == "f_sum_1"
    assert validated.full_name == "Balasaheb Shinde"
    assert len(validated.land_records) >= 1
    assert validated.land_records[0].acreage == 8.2
    assert validated.content_summary is not None
    assert isinstance(validated.recent_activities, list)


# ---------------------------------------------------------------------------
# 6. Farmer Status Governance & Redis Token Invalidation
# ---------------------------------------------------------------------------
async def test_farmer_suspension_invalidates_tokens(client, user_store, fake_redis):
    """Suspending a farmer updates status and revokes token in Redis blacklist."""
    seed_farmer(user_store, "f_gov_1", status="active")

    resp = await client.post(
        "/api/v1/admin/farmers/f_gov_1/status",
        json={"status": "SUSPENDED", "reason": "Suspected fraudulent listings"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "SUSPENDED"
    assert data["is_suspended"] is True

    # User in store must now be suspended
    user = user_store["users/f_gov_1"]
    assert user["status"] == "suspended"
    assert user["is_suspended"] is True

    # Redis blacklist check
    blacklisted = await fake_redis.get("token_blacklist:user:f_gov_1")
    assert blacklisted == "revoked"


# ---------------------------------------------------------------------------
# 7. Produce Lot Moderation Takedown
# ---------------------------------------------------------------------------
async def test_farmer_lot_moderation_takedown(client, user_store):
    """Moderation takedown of fraudulent or illicit produce lots."""
    seed_farmer(user_store, "f_mod_1")
    user_store["produce_lots/lot_123"] = {
        "id": "lot_123",
        "farmerId": "f_mod_1",
        "crop": "Cotton",
        "quantityQuintals": 50.0,
        "status": "open",
    }

    resp = await client.delete(
        "/api/v1/admin/farmers/f_mod_1/lots/lot_123?reason=Misleading grade certificate",
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["status"] == "taken_down"

    lot_doc = user_store["produce_lots/lot_123"]
    assert lot_doc["status"] == "taken_down"


# ---------------------------------------------------------------------------
# 8. Farmer Impersonation Token Generation
# ---------------------------------------------------------------------------
async def test_farmer_impersonation(client, user_store):
    """Admin impersonation generates a scoped JWT token for farmer role."""
    seed_farmer(user_store, "f_imp_1")

    resp = await client.post("/api/v1/admin/farmers/f_imp_1/impersonate", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "token" in body
    assert body["userId"] == "f_imp_1"
    assert body["expiresIn"] == 900


# ---------------------------------------------------------------------------
# 9. Farmer Common Features 360 Aggregated Snapshot Validation
# ---------------------------------------------------------------------------
async def test_farmer_common_features_360(client, user_store):
    """Snapshot endpoint validates against FarmerCommonFeatures360Response."""
    seed_farmer(user_store, "f_c360_1", name="Kisan Vitthal", district="Solapur", land_area=6.0)

    # Seed mock records in user subcollections / stores
    user_store["orders/ord_1"] = {
        "id": "ord_1",
        "buyerId": "f_c360_1",
        "status": "DELIVERED",
        "totalAmount": 4500.0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    user_store["disease_scans/scan_1"] = {
        "id": "scan_1",
        "farmerId": "f_c360_1",
        "crop": "Pomegranate",
        "diagnosis": "Bacterial Blight",
        "confidence": 0.94,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    resp = await client.get("/api/v1/admin/farmers/f_c360_1/common-features-360", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()

    # Schema validation against FarmerCommonFeatures360Response
    validated = FarmerCommonFeatures360Response.model_validate(data)
    assert validated.user_id == "f_c360_1"
    assert validated.full_name == "Kisan Vitthal"
    assert validated.metrics.mall_orders_count >= 1
    assert validated.metrics.ai_scans_total >= 1
    assert validated.metrics.land_records_verified_acreage >= 0.0
    assert isinstance(validated.recent_cross_feature_activities, list)


# ---------------------------------------------------------------------------
# 10. Farmer Sub-Feature Drill Downs & Administrative Overrides
# ---------------------------------------------------------------------------
async def test_farmer_sub_features_and_admin_overrides(client, user_store):
    """Sub-feature endpoints for Mall, Tree Verification, Coin Adjust, and AI Scanner."""
    seed_farmer(user_store, "f_sub_1")

    # 1. Mall order override
    user_store["orders/ord_test_99"] = {
        "id": "ord_test_99",
        "buyerId": "f_sub_1",
        "status": "PLACED",
        "totalAmount": 1200.0,
    }
    resp_mall = await client.post(
        "/api/v1/admin/farmers/f_sub_1/mall/orders/ord_test_99/override",
        json={"status": "REFUNDED", "reason": "Defective seeds batch reported"},
        headers=ADMIN_HEADERS,
    )
    assert resp_mall.status_code == 200
    assert resp_mall.json()["status"] == "REFUNDED"
    assert user_store["orders/ord_test_99"]["status"] == "REFUNDED"

    # 2. Tree verification with coin reward
    user_store["users/f_sub_1/tree_plantations/tree_55"] = {
        "id": "tree_55",
        "farmerId": "f_sub_1",
        "species": "Neem",
        "status": "PLANTED",
    }
    resp_tree = await client.put(
        "/api/v1/admin/farmers/f_sub_1/trees/tree_55/verify",
        json={"status": "VERIFIED", "reward_coins": 50, "remarks": "Survival verified via geotag photo"},
        headers=ADMIN_HEADERS,
    )
    assert resp_tree.status_code == 200
    assert resp_tree.json()["status"] == "VERIFIED"
    assert resp_tree.json()["reward_coins"] == 50
    # Coins awarded to user
    assert user_store["users/f_sub_1"]["kisanCoins"] >= 50

    # 3. Kisan coins manual mint / burn
    resp_coin = await client.post(
        "/api/v1/admin/farmers/f_sub_1/coins/adjust",
        json={"amount": 100, "operation": "MINT", "reason": "Community agroforestry incentive"},
        headers=ADMIN_HEADERS,
    )
    assert resp_coin.status_code == 200
    assert resp_coin.json()["operation"] == "MINT"
    assert resp_coin.json()["balance"] >= 150

    # 4. AI Scanner review override
    user_store["disease_scans/dscan_77"] = {
        "id": "dscan_77",
        "farmerId": "f_sub_1",
        "crop": "Tomato",
        "diagnosis": "Early Blight",
    }
    resp_ai = await client.put(
        "/api/v1/admin/farmers/f_sub_1/ai-scanner/scans/dscan_77/review",
        json={
            "corrected_diagnosis": "Late Blight",
            "corrected_treatment": "Apply Copper Oxychloride 50 WP @ 3g/L",
            "notify_farmer": True,
        },
        headers=ADMIN_HEADERS,
    )
    assert resp_ai.status_code == 200
    assert resp_ai.json()["status"] == "REVIEWED"
    assert user_store["disease_scans/dscan_77"]["diagnosis"] == "Late Blight"


# ---------------------------------------------------------------------------
# 11. Global Farmer Modules Persona Management
# ---------------------------------------------------------------------------
async def test_global_farmer_modules_management(client, user_store):
    """Global persona endpoints (/api/v1/admin/farmer-modules/...)."""
    # Overview
    resp_ov = await client.get("/api/v1/admin/farmer-modules/overview", headers=ADMIN_HEADERS)
    assert resp_ov.status_code == 200
    ov_data = resp_ov.json()
    assert "mandi_prices_count" in ov_data
    assert "schemes_catalog_count" in ov_data
    assert "gurukul_courses_count" in ov_data

    # Mandi rate override
    resp_mandi = await client.post(
        "/api/v1/admin/farmer-modules/mandi/rates/override",
        json={
            "mandi_id": "mandi_pune",
            "commodity": "Onion",
            "min_price": 1800,
            "max_price": 2500,
            "modal_price": 2200,
        },
        headers=ADMIN_HEADERS,
    )
    assert resp_mandi.status_code == 200
    assert resp_mandi.json()["success"] is True
    rate_doc = user_store["mandi_prices/mandi_pune_onion"]
    assert rate_doc["modalPrice"] == 2200


# ---------------------------------------------------------------------------
# 12. Superadmin Farmer Common Five Features Suite Specification Tests
# ---------------------------------------------------------------------------
async def test_farmer_common_five_features_suite(client, user_store):
    """Test 360 common-5-summary aggregator and all 5 core modules."""
    seed_farmer(user_store, "farmer_suite_1", name="Ramesh Pawar", phone="+919800112233")
    user_store["users/farmer_suite_1"]["walletBalance"] = 4500.0
    user_store["users/farmer_suite_1"]["trustScore"] = 82.0
    user_store["users/farmer_suite_1"]["referralCode"] = "KISAN_RAMESH"

    # Seed data across the 5 domains
    user_store["transactions/txn_01"] = {
        "id": "txn_01", "userId": "farmer_suite_1", "amount": 1200.0, "type": "credit", "status": "SUCCESS"
    }
    user_store["settlements/stl_01"] = {
        "id": "stl_01", "entityId": "farmer_suite_1", "netRupees": 3500.0, "status": "pending"
    }
    user_store["users/farmer_suite_1/bank_accounts/acc_01"] = {
        "id": "acc_01", "bankName": "SBI", "accountNumber": "1234567890", "status": "PENDING"
    }
    user_store["reviews/rev_01"] = {
        "id": "rev_01", "targetUserId": "farmer_suite_1", "authorId": "buyer_01", "rating": 5, "comment": "Excellent quality wheat"
    }
    user_store["users/farmer_suite_1/follows/f_01"] = {
        "id": "f_01", "targetUserId": "trans_01", "personaRole": "transporter"
    }
    user_store["users/farmer_suite_1/wishlist/w_01"] = {
        "id": "w_01", "title": "DAP Fertilizer", "itemType": "mall_product"
    }
    user_store["referral_attributions/ref_01"] = {
        "id": "ref_01", "referrerUid": "farmer_suite_1", "referredUid": "farmer_sub_1", "status": "converted", "rewardCoins": 100
    }
    user_store["users/farmer_suite_1/vault_documents/vdoc_01"] = {
        "id": "vdoc_01", "title": "Aadhaar Card", "docType": "kyc", "status": "PENDING", "sizeBytes": 204800
    }

    # 1. Test Aggregator: GET /common-5-summary
    resp_agg = await client.get("/api/v1/admin/farmers/farmer_suite_1/common-5-summary", headers=ADMIN_HEADERS)
    assert resp_agg.status_code == 200
    agg_data = resp_agg.json()
    assert agg_data["user_id"] == "farmer_suite_1"
    assert agg_data["payments"]["wallet_balance_inr"] == 4500.0
    assert agg_data["payments"]["lifetime_credit_inr"] == 1200.0
    assert agg_data["ratings"]["total_reviews_received"] == 1
    assert agg_data["saved_following"]["following_count"] == 1
    assert agg_data["referrals"]["converted_referrals_count"] == 1
    assert agg_data["document_vault"]["total_documents"] == 1

    # 2. Payments: overview, transactions, settlements, bank accounts, verify, reconcile
    resp_pay_ov = await client.get("/api/v1/admin/farmers/farmer_suite_1/payments/overview", headers=ADMIN_HEADERS)
    assert resp_pay_ov.status_code == 200
    assert resp_pay_ov.json()["wallet_balance_inr"] == 4500.0

    resp_pay_tx = await client.get("/api/v1/admin/farmers/farmer_suite_1/payments/transactions", headers=ADMIN_HEADERS)
    assert resp_pay_tx.status_code == 200
    assert len(resp_pay_tx.json()["transactions"]) >= 1

    resp_pay_stl = await client.get("/api/v1/admin/farmers/farmer_suite_1/payments/settlements", headers=ADMIN_HEADERS)
    assert resp_pay_stl.status_code == 200
    assert len(resp_pay_stl.json()["settlements"]) >= 1

    resp_bank_verify = await client.post(
        "/api/v1/admin/farmers/farmer_suite_1/payments/bank-accounts/acc_01/verify",
        json={"status": "VERIFIED", "admin_note": "Verified via penny drop"},
        headers=ADMIN_HEADERS,
    )
    assert resp_bank_verify.status_code == 200
    assert resp_bank_verify.json()["status"] == "VERIFIED"

    resp_pay_rec = await client.post(
        "/api/v1/admin/farmers/farmer_suite_1/payments/reconcile",
        json={"settlement_id": "stl_01", "action": "RELEASE_ESCROW", "utr_number": "UTR99887766"},
        headers=ADMIN_HEADERS,
    )
    assert resp_pay_rec.status_code == 200
    assert resp_pay_rec.json()["status"] == "ESCROW_RELEASED"

    # 3. Ratings: overview, list, moderate
    resp_rat_ov = await client.get("/api/v1/admin/farmers/farmer_suite_1/ratings/overview", headers=ADMIN_HEADERS)
    assert resp_rat_ov.status_code == 200
    assert resp_rat_ov.json()["avg_rating_received"] == 5.0

    resp_rat_mod = await client.patch(
        "/api/v1/admin/farmers/farmer_suite_1/ratings/rev_01/moderate",
        json={"status": "APPROVED", "recalculate_trust": True, "reason": "Authentic deal review"},
        headers=ADMIN_HEADERS,
    )
    assert resp_rat_mod.status_code == 200
    assert resp_rat_mod.json()["status"] == "APPROVED"

    # 4. Saved & Following: overview, connections, wishlist, cleanup
    resp_sav_ov = await client.get("/api/v1/admin/farmers/farmer_suite_1/saved-following/overview", headers=ADMIN_HEADERS)
    assert resp_sav_ov.status_code == 200
    assert resp_sav_ov.json()["following_count"] == 1

    resp_sav_conns = await client.get("/api/v1/admin/farmers/farmer_suite_1/saved-following/connections", headers=ADMIN_HEADERS)
    assert resp_sav_conns.status_code == 200
    assert len(resp_sav_conns.json()["connections"]) == 1

    resp_sav_del = await client.delete(
        "/api/v1/admin/farmers/farmer_suite_1/saved-following/wishlist/w_01",
        headers=ADMIN_HEADERS,
    )
    assert resp_sav_del.status_code == 200
    assert resp_sav_del.json()["success"] is True

    # 5. Referrals: overview, action, campaign rules
    resp_ref_ov = await client.get("/api/v1/admin/farmers/farmer_suite_1/referrals/overview", headers=ADMIN_HEADERS)
    assert resp_ref_ov.status_code == 200
    assert resp_ref_ov.json()["referral_code"] == "KISAN_RAMESH"

    resp_ref_act = await client.post(
        "/api/v1/admin/farmers/farmer_suite_1/referrals/ref_01/action",
        json={"action": "APPROVE_REWARD", "reward_coins": 150, "reason": "KYC verified"},
        headers=ADMIN_HEADERS,
    )
    assert resp_ref_act.status_code == 200
    assert resp_ref_act.json()["action"] == "APPROVE_REWARD"

    resp_ref_rules = await client.put(
        "/api/v1/admin/farmer-modules/referrals/campaign-rules",
        json={"referrer_coins": 100, "referee_coins": 50, "milestone_trigger": "KYC_VERIFIED", "is_active": True},
        headers=ADMIN_HEADERS,
    )
    assert resp_ref_rules.status_code == 200
    assert resp_ref_rules.json()["rules"]["referrer_coins"] == 100

    # 6. Vault: overview, documents, activity, verify, upload
    resp_vlt_ov = await client.get("/api/v1/admin/farmers/farmer_suite_1/vault/overview", headers=ADMIN_HEADERS)
    assert resp_vlt_ov.status_code == 200
    assert resp_vlt_ov.json()["total_documents"] == 1

    resp_vlt_act = await client.get("/api/v1/admin/farmers/farmer_suite_1/vault/documents/vdoc_01/activity", headers=ADMIN_HEADERS)
    assert resp_vlt_act.status_code == 200
    assert "activity" in resp_vlt_act.json()

    resp_vlt_ver = await client.put(
        "/api/v1/admin/farmers/farmer_suite_1/vault/documents/vdoc_01/verify",
        json={"status": "VERIFIED", "notes": "Aadhaar verified"},
        headers=ADMIN_HEADERS,
    )
    assert resp_vlt_ver.status_code == 200
    assert resp_vlt_ver.json()["status"] == "VERIFIED"

    resp_vlt_up = await client.post(
        "/api/v1/admin/farmers/farmer_suite_1/vault/documents",
        json={"title": "Official Soil Health Card", "doc_type": "soil", "category": "soil"},
        headers=ADMIN_HEADERS,
    )
    assert resp_vlt_up.status_code == 200
    assert resp_vlt_up.json()["document"]["title"] == "Official Soil Health Card"

    # 7. Non-admin RBAC check returns 403 Forbidden
    resp_unauth = await client.get("/api/v1/admin/farmers/farmer_suite_1/common-5-summary", headers=PLAIN_HEADERS)
    assert resp_unauth.status_code == 403


