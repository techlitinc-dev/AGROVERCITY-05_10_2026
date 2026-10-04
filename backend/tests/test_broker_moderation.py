"""WS-05 step 17: server-side deal-message moderation — phone numbers, UPI
IDs and external links are rejected with a per-sender strike ladder."""
from tests.test_broker_deals import DEAL_BODY, _seed_broker, _seed_farmer
from tests.test_diary import auth


async def _deal(client, user_store):
    broker = _seed_broker(user_store)
    farmer = _seed_farmer(user_store)
    deal = (
        await client.post("/v1/broker/deals", json=DEAL_BODY, headers=auth(broker))
    ).json()
    return broker, farmer, deal


async def _broker_msg(client, token, deal_id, text):
    return await client.post(
        f"/v1/broker/deals/{deal_id}/messages",
        json={"text": text},
        headers=auth(token),
    )


async def test_clean_message_passes(client, user_store):
    broker, farmer, deal = await _deal(client, user_store)
    resp = await _broker_msg(client, broker, deal["id"], "pickup kal subah 7 baje")
    assert resp.status_code == 201


async def test_phone_number_rejected_with_strike(client, user_store):
    broker, farmer, deal = await _deal(client, user_store)
    resp = await _broker_msg(client, broker, deal["id"], "call me on 9876543210")
    assert resp.status_code == 422
    error = resp.json()["error"]
    assert error["code"] == "MESSAGE_BLOCKED"
    assert "phone" in error["fieldErrors"]["text"]
    assert user_store["users/uid-b1"]["moderationStrikes"] == 1


async def test_upi_id_and_external_link_rejected(client, user_store):
    broker, farmer, deal = await _deal(client, user_store)
    resp = await _broker_msg(client, broker, deal["id"], "pay to ramkisan@okhdfcbank")
    assert resp.status_code == 422
    assert "upi_id" in resp.json()["error"]["fieldErrors"]["text"]

    resp = await _broker_msg(client, broker, deal["id"], "details at https://example.com/deal")
    assert resp.status_code == 422
    assert "external_link" in resp.json()["error"]["fieldErrors"]["text"]


async def test_farmer_side_moderated(client, user_store):
    broker, farmer, deal = await _deal(client, user_store)
    resp = await client.post(
        f"/v1/farmer/deals/{deal['id']}/messages",
        json={"text": "mera number 9123456789 hai"},
        headers=auth(farmer),
    )
    assert resp.status_code == 422
    assert user_store["users/uid-f1"]["moderationStrikes"] == 1


async def test_strike_ladder_restricts_at_three(client, user_store):
    broker, farmer, deal = await _deal(client, user_store)
    for _ in range(2):
        resp = await _broker_msg(client, broker, deal["id"], "call 9876543210")
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "MESSAGE_BLOCKED"

    # third strike flips the restriction
    resp = await _broker_msg(client, broker, deal["id"], "call 9876543210")
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "MESSAGING_RESTRICTED"
    assert user_store["users/uid-b1"]["messagingRestricted"] is True
