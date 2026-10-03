import re

import pytest

from app.services.claims import advance_status
from tests.test_diary import auth, seed_user

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 512

POLICY = {
    "id": "pol-1",
    "policyNumber": "PMFBY-2026-0001",
    "schemeName": "PMFBY",
    "cropName": "Wheat",
    "season": "Kharif",
    "year": 2026,
    "landAreaAcres": 2.0,
    "sumInsured": 80000,
    "farmerPremium": 1600.0,
    "govtSubsidy": 8400.0,
    "status": "active",
    "insuranceCompany": "AIC of India",
    "coverageStartDate": "2026-07-01",
    "coverageEndDate": "2026-12-31",
    "bankName": "SBI",
    "kccAccountNo": "XXXX4521",
    "certificateUrl": None,
}

CLAIM_FIELDS = {
    "policyId": "pol-1",
    "cropName": "Wheat",
    "calamityType": "hailstorm",
    "dateOfDamage": "2026-09-10",
    "cropStage": "flowering",
    "estimatedLossPercent": "40",
    "gpsCoordinates": "20.0,73.8",
    "village": "Ozarkhed",
}

APPEAL_REASON = "सर्वेयर ने गलत फसल स्टेज दर्ज की थी, नई फोटो संलग्न हैं"


def _fake_storage(monkeypatch):
    monkeypatch.setattr(
        "app.services.storage.upload_user_file",
        lambda uid, data, filename, content_type, prefix="vault": (
            f"{prefix}/{uid}/fake_{filename}",
            len(data),
        ),
    )
    monkeypatch.setattr(
        "app.services.storage.signed_download_url",
        lambda blob_path, minutes=60: f"https://storage.example.com/{blob_path}?sig=x",
    )


def _farmer(user_store, uid="uid-1", **overrides):
    return seed_user(
        user_store, uid=uid, state="Maharashtra", district="Nashik", **overrides
    )


def _seed_policy(user_store, uid="uid-1"):
    user_store[f"users/{uid}/insurance_policies/pol-1"] = dict(POLICY)


def _photos(n=2, content=PNG_BYTES, content_type="image/png"):
    ext = "png" if content_type == "image/png" else "jpg"
    return [("damagePhotos", (f"p{i}.{ext}", content, content_type)) for i in range(n)]


async def _submit(client, token, fields=None, files=None):
    return await client.post(
        "/v1/insurance/claims",
        data=fields or CLAIM_FIELDS,
        files=_photos() if files is None else files,
        headers=auth(token),
    )


def _claim_key(user_store, uid="uid-1"):
    return next(k for k in user_store if k.startswith(f"users/{uid}/insurance_claims/"))


def _drive_to_rejected(user_store, uid="uid-1"):
    key = _claim_key(user_store, uid)
    claim = user_store[key]
    for step in ("surveyorAssigned", "fieldAssessed", "rejected"):
        claim = advance_status(claim, step)
    claim["rejectionReason"] = "अपर्याप्त फोटो साक्ष्य"
    user_store[key] = claim
    return claim["id"]


async def test_submit_claim_with_photos(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)
    resp = await _submit(client, token)
    assert resp.status_code == 201
    body = resp.json()
    assert re.fullmatch(r"CLM-\d{4}-[A-Z]{2}-\d{4}", body["claimNumber"])
    assert body["status"] == "intimated"
    assert len(body["damagePhotos"]) == 2
    assert body["surveyorName"]
    assert body["requestedAmount"] == 80000 * 40 / 100


async def test_claim_foreign_policy_404(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store, uid="uid-2")
    resp = await _submit(client, token)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "POLICY_NOT_FOUND"


async def test_claim_no_photos_422(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)
    resp = await client.post(
        "/v1/insurance/claims", data=CLAIM_FIELDS, headers=auth(token)
    )
    assert resp.status_code == 422


async def test_state_machine_legal():
    claim = {"status": "intimated", "timeline": [{"status": "intimated", "at": "t", "note": ""}]}
    updated = advance_status(claim, "surveyorAssigned", "assigned")
    assert updated["status"] == "surveyorAssigned"
    assert len(updated["timeline"]) == 2


async def test_state_machine_illegal():
    claim = {"status": "intimated", "timeline": []}
    with pytest.raises(ValueError):
        advance_status(claim, "dbtApproved")


async def test_claim_list_and_detail(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)
    created = (await _submit(client, token)).json()
    resp = await client.get("/v1/insurance/claims", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["claimNumber"] == created["claimNumber"]
    resp = await client.get(f"/v1/insurance/claims/{created['id']}", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["claimNumber"] == created["claimNumber"]
    resp = await client.get("/v1/insurance/claims/nope", headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CLAIM_NOT_FOUND"


async def test_claim_numbers_increment(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)
    first = (await _submit(client, token)).json()
    second = (await _submit(client, token)).json()
    assert first["claimNumber"].endswith("0001")
    assert second["claimNumber"].endswith("0002")


async def test_claim_oversize_photo_413(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)
    big = b"\x00" * (6 * 1024 * 1024)
    resp = await _submit(
        client, token, files=[("damagePhotos", ("big.jpg", big, "image/jpeg"))]
    )
    assert resp.status_code == 413
    assert resp.json()["error"]["code"] == "FILE_TOO_LARGE"


async def test_claim_loss_percent_bounds_422(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)
    resp = await _submit(client, token, fields={**CLAIM_FIELDS, "estimatedLossPercent": "120"})
    assert resp.status_code == 422


async def test_claim_list_excludes_other_users(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token_a = _farmer(user_store)
    _seed_policy(user_store)
    await _submit(client, token_a)
    token_b = _farmer(user_store, uid="uid-2")
    resp = await client.get("/v1/insurance/claims", headers=auth(token_b))
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


async def test_appeal_rejected_claim_returns_to_intimated(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)
    created = (await _submit(client, token)).json()
    claim_id = _drive_to_rejected(user_store)
    before = len(created["timeline"]) + 3
    resp = await client.post(
        f"/v1/insurance/claims/{claim_id}/appeal",
        json={"reason": APPEAL_REASON},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "intimated"
    assert body["appealCount"] == 1
    assert len(body["timeline"]) == before + 1


async def test_appeal_non_rejected_409(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)
    created = (await _submit(client, token)).json()
    resp = await client.post(
        f"/v1/insurance/claims/{created['id']}/appeal",
        json={"reason": APPEAL_REASON},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CLAIM_NOT_REJECTED"


async def test_appeal_reason_too_short_422(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)
    created = (await _submit(client, token)).json()
    resp = await client.post(
        f"/v1/insurance/claims/{created['id']}/appeal",
        json={"reason": "short"},
        headers=auth(token),
    )
    assert resp.status_code == 422


async def test_appeal_photo_cap_422(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)
    created = (await _submit(client, token, files=_photos(4))).json()
    assert len(created["damagePhotos"]) == 4
    claim_id = _drive_to_rejected(user_store)
    resp = await client.post(
        f"/v1/insurance/claims/{claim_id}/appeal",
        json={"reason": APPEAL_REASON, "photos": ["https://storage.example/a.jpg", "https://storage.example/b.jpg"]},
        headers=auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "TOO_MANY_PHOTOS"


async def test_submit_response_has_photo_guidelines(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)
    resp = await _submit(client, token)
    assert resp.status_code == 201
    assert len(resp.json()["photoGuidelines"]) > 0
