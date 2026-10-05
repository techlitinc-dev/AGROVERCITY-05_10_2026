from app.data.specs_seed import seed_specs
from tests.test_diary import auth, seed_user


async def test_specs_list_and_filter(client, user_store):
    await seed_specs()

    # GET with crop=Tomato
    resp = await client.get("/v1/specs?crop=Tomato")
    assert resp.status_code == 200
    data = resp.json()
    template = data[0] if isinstance(data, list) else data
    assert template["crop"].lower() == "tomato"
    assert len(template["params"]) == 4

    param_names = {p["name"] for p in template["params"]}
    assert "BRIX" in param_names
    assert "Firmness" in param_names
    assert "Size" in param_names
    assert "Defect" in param_names


async def test_create_custom_spec_and_auth(client, user_store):
    token = seed_user(user_store, uid="buyer-1", active_profile="directBuyer")

    # Unauthenticated POST is rejected with 401
    unauth_resp = await client.post(
        "/v1/specs",
        json={
            "crop": "Cotton",
            "name": "Custom Cotton Spec",
            "params": [{"name": "Staple Length", "unit": "mm", "min": 28.0, "adjustmentPerUnit": 5000}],
        },
    )
    assert unauth_resp.status_code == 401

    # Authenticated POST creates a custom template
    spec_payload = {
        "crop": "Cotton",
        "name": "Custom Cotton Spec",
        "params": [
            {
                "name": "Staple Length",
                "unit": "mm",
                "min": 28.0,
                "max": None,
                "testMethod": "HVI",
                "adjustmentPerUnit": 5000,
            }
        ],
    }
    create_resp = await client.post(
        "/v1/specs",
        json=spec_payload,
        headers={**auth(token), "Idempotency-Key": "spec-create-1"},
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["crop"] == "Cotton"
    assert created["createdBy"] == "buyer-1"

    # Visible in subsequent GET
    get_resp = await client.get("/v1/specs?crop=Cotton")
    assert get_resp.status_code == 200
    data = get_resp.json()
    matching = [s for s in (data if isinstance(data, list) else [data]) if s["id"] == created["id"]]
    assert len(matching) == 1
    assert matching[0]["name"] == "Custom Cotton Spec"
