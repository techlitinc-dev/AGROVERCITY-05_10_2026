"""WS-04 DPDP data-export tests."""
from app.routers.privacy import assemble_export
from tests.test_diary import auth, seed_user


async def test_data_export_flow(client, user_store, monkeypatch):
    monkeypatch.setattr(
        "app.routers.privacy.upload_user_file", lambda *a, **k: ("exports/uid-1/x.json", 42)
    )
    monkeypatch.setattr(
        "app.routers.privacy.signed_download_url", lambda p, minutes=60: "https://example.test/x.json"
    )
    token = seed_user(user_store)
    user_store["users/uid-1/consents/current"] = {
        "dataSharing": True, "location": False, "marketing": True, "updatedAt": "x",
    }
    user_store["users/uid-1/diary_entries/e1"] = {"id": "e1", "title": "Urea"}

    resp = await client.post("/v1/users/me/data-export", headers=auth(token))
    assert resp.status_code == 201
    doc = user_store["data_exports/uid-1"]
    assert doc["status"] == "ready" and doc["url"]
    assert any(
        k.startswith("audit_logs/") and v.get("action") == "data_export"
        for k, v in user_store.items()
    )

    archive = await assemble_export("uid-1")
    assert archive["profile"]["id"] == "uid-1"
    assert archive["consents"]["dataSharing"] is True
    assert archive["collections"]["diary_entries"][0]["id"] == "e1"

    # Immediate second export → rate limited.
    resp = await client.post("/v1/users/me/data-export", headers=auth(token))
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "EXPORT_RATE_LIMITED"

    resp = await client.get("/v1/users/me/data-export/latest", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "ready"
