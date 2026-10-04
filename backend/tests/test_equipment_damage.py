"""E5: damage-deposit claims — before/after photos, integer paisa, owner-filed
→ admin-arbitrable (open → resolved)."""
from tests.test_equipment_owner import _owner_token
from tests.test_transport_disputes import ADMIN_HEADERS
from tests.test_users import _auth

CLAIM_BODY = {
    "bookingId": "bk-claim-1",
    "incidentDate": "2026-10-01",
    "description": "rotavator blade bent on buried rock",
    "estimatedRepairCostRupees": 4500,
    "beforePhotoUrls": ["https://storage.example/before/1.jpg"],
    "afterPhotoUrls": ["https://storage.example/after/1.jpg"],
    "claimPaisa": 450000,
}


async def _machine(client, token):
    resp = await client.post(
        "/v1/equipment",
        json={"name": "Mahindra Rotavator", "type": "rotavator", "hourlyRate": 600},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    return resp.json()


async def _claim(client, token, machine_id, key=None):
    body = {**CLAIM_BODY, "equipmentId": machine_id}
    return await client.post("/v1/equipment/owner/damage-claims", json=body, headers=_auth(token))


async def test_owner_files_claim_with_photos_and_paisa(client, user_store):
    token = await _owner_token(client)
    machine = await _machine(client, token)

    resp = await _claim(client, token, machine["id"])
    assert resp.status_code == 201
    claim = resp.json()
    assert claim["status"] == "open"
    assert claim["claimPaisa"] == 450000
    assert claim["beforePhotoUrls"] == ["https://storage.example/before/1.jpg"]
    assert claim["afterPhotoUrls"] == ["https://storage.example/after/1.jpg"]

    # paisa falls back to converting the rupee estimate when omitted
    body = {**CLAIM_BODY, "equipmentId": machine["id"]}
    del body["claimPaisa"]
    resp = await client.post("/v1/equipment/owner/damage-claims", json=body, headers=_auth(token))
    assert resp.status_code == 201
    assert resp.json()["claimPaisa"] == 450000


async def test_admin_resolves_open_claim(client, user_store):
    token = await _owner_token(client)
    machine = await _machine(client, token)
    claim = (await _claim(client, token, machine["id"])).json()

    # admin arbitration without the audit headers is refused (rule 8)
    resp = await client.post(
        f"/v1/equipment/owner/damage-claims/{claim['id']}/resolve",
        json={"resolution": "deposit partially withheld"},
        headers={"Authorization": "Bearer admin-token"},
    )
    assert resp.status_code == 400

    resp = await client.post(
        f"/v1/equipment/owner/damage-claims/{claim['id']}/resolve",
        json={"resolution": "deposit partially withheld"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    resolved = resp.json()
    assert resolved["status"] == "resolved"
    assert resolved["resolution"] == "deposit partially withheld"
    assert resolved["resolvedBy"]

    # double-resolution is rejected
    resp = await client.post(
        f"/v1/equipment/owner/damage-claims/{claim['id']}/resolve",
        json={"resolution": "again"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CLAIM_NOT_OPEN"


async def test_resolve_unknown_claim_404(client, user_store):
    resp = await client.post(
        "/v1/equipment/owner/damage-claims/claim_missing/resolve",
        json={"resolution": "x"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CLAIM_NOT_FOUND"


async def test_owner_cannot_resolve_own_claim(client, user_store):
    token = await _owner_token(client)
    machine = await _machine(client, token)
    claim = (await _claim(client, token, machine["id"])).json()
    resp = await client.post(
        f"/v1/equipment/owner/damage-claims/{claim['id']}/resolve",
        json={"resolution": "self"},
        headers=_auth(token),
    )
    assert resp.status_code == 403
