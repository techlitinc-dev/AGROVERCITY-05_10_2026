"""Government open-data mandi feed tests — upstream HTTP is fully mocked.

Covers the /mandi/live contract: normalization, DD/MM/YYYY conversion, name
trimming, district default/override, commodity/pagination metadata, malformed
record rejection, empty responses, timeout/5xx retry-once, 4xx no-retry,
stale fallback, no-cache failure, cache-key isolation, idempotent snapshots,
and the deprecated movers endpoint. No test touches the live PHP service.
"""
import pytest

from app.services import mandi_gov_data
from app.services.mandi_gov_data import GovFeedError

from tests.test_users import _auth, _register

EXAMPLE_RECORDS = [
    {
        "state": "Maharashtra",
        "district": "Nashik",
        "market": "APMC Sinner ",
        "commodity": "Onion",
        "variety": "Unhali",
        "grade": "Local",
        "arrival_date": "28/10/2026",
        "min_price": 2000,
        "max_price": 4290,
        "modal_price": 3950,
    },
    {
        "state": "Maharashtra",
        "district": "Nashik",
        "market": "APMC Lasalgaon",
        "commodity": "Onion",
        "variety": "Garwa",
        "grade": "",
        "arrival_date": "27/10/2026",
        # numeric strings are accepted and converted
        "min_price": "2100",
        "max_price": "4100",
        "modal_price": "3800",
    },
]

EXAMPLE_UPSTREAM = {
    "source": "Open Government Data Platform India",
    "fetched_at": "2026-10-29T06:30:00+00:00",
    "count": 2,
    "total": 2,
    "limit": 100,
    "offset": 0,
    "records": EXAMPLE_RECORDS,
}


class FakeUpstream:
    """Stand-in for mandi_gov_data._fetch_once (one upstream HTTP GET)."""

    def __init__(self):
        self.calls: list[dict] = []
        self.payload: dict = {**EXAMPLE_UPSTREAM, "records": list(EXAMPLE_RECORDS)}
        self.error: GovFeedError | None = None

    async def fetch(self, params: dict) -> dict:
        self.calls.append(dict(params))
        if self.error is not None:
            raise self.error
        return self.payload


@pytest.fixture
def upstream(monkeypatch):
    fake = FakeUpstream()
    monkeypatch.setattr(mandi_gov_data, "_fetch_once", fake.fetch)
    return fake


async def _farmer_token(client):
    resp = await _register(client, profiles=["farmer"], primaryProfile="farmer")
    assert resp.status_code == 200
    return resp.json()["accessToken"]


# ---------------- normalization (unit) ----------------


def test_normalize_record_trims_and_converts_date():
    rec = mandi_gov_data.normalize_record(EXAMPLE_RECORDS[0])
    assert rec is not None
    assert rec["mandiName"] == "APMC Sinner"  # whitespace trimmed
    assert rec["priceDate"] == "2026-10-28"  # DD/MM/YYYY → YYYY-MM-DD
    assert rec["modalPrice"] == 3950
    assert rec["unit"] == "INR_PER_QUINTAL"
    assert rec["grade"] == "Local"
    assert rec["id"].startswith("gov-")


def test_normalize_record_deterministic_id_uses_all_fields():
    a = mandi_gov_data.normalize_record(EXAMPLE_RECORDS[0])
    b = mandi_gov_data.normalize_record({**EXAMPLE_RECORDS[0], "variety": "Other"})
    c = mandi_gov_data.normalize_record(EXAMPLE_RECORDS[0])
    assert a["id"] == c["id"]
    assert a["id"] != b["id"]  # not deduplicated by commodity/market alone


def test_normalize_record_rejects_malformed():
    base = dict(EXAMPLE_RECORDS[0])
    # bad date
    assert mandi_gov_data.normalize_record({**base, "arrival_date": "not-a-date"}) is None
    # missing modal price must not become zero
    assert mandi_gov_data.normalize_record({**base, "modal_price": None}) is None
    assert mandi_gov_data.normalize_record({**base, "modal_price": "NaN"}) is None
    # unparseable min price
    assert mandi_gov_data.normalize_record({**base, "min_price": "ab-cd"}) is None
    # missing market
    assert mandi_gov_data.normalize_record({**base, "market": "  "}) is None
    # non-dict
    assert mandi_gov_data.normalize_record(["x"]) is None


# ---------------- /mandi/live ----------------


async def test_live_success_normalization(client, upstream):
    token = await _farmer_token(client)
    resp = await client.get("/v1/mandi/live", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "Open Government Data Platform India"
    assert body["stale"] is False
    assert body["reportedDate"] == "2026-10-28"  # latest valid priceDate
    assert body["fetchedAt"] == "2026-10-29T06:30:00+00:00"
    assert body["district"] == "Nashik"
    assert body["count"] == 2
    names = [r["mandiName"] for r in body["data"]]
    assert names == ["APMC Sinner", "APMC Lasalgaon"]  # whitespace trimmed
    row = body["data"][0]
    assert row["commodity"] == "Onion"
    assert row["variety"] == "Unhali"
    assert row["modalPrice"] == 3950


async def test_live_profile_district_default(client, upstream):
    token = await _farmer_token(client)
    resp = await client.get("/v1/mandi/live", headers=_auth(token))
    assert resp.status_code == 200
    assert upstream.calls[0]["district"] == "Nashik"  # from the registered profile


async def test_live_explicit_district_override(client, upstream):
    token = await _farmer_token(client)
    resp = await client.get(
        "/v1/mandi/live", params={"district": "Pune"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    assert upstream.calls[0]["district"] == "Pune"


async def test_live_commodity_filter_and_pagination_metadata(client, upstream):
    token = await _farmer_token(client)
    resp = await client.get(
        "/v1/mandi/live",
        params={"commodity": "Onion", "limit": 5, "offset": 10},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert upstream.calls[0]["commodity"] == "Onion"
    assert upstream.calls[0]["limit"] == "5"
    assert upstream.calls[0]["offset"] == "10"
    assert body["limit"] == 5
    assert body["offset"] == 10
    assert body["total"] == 2  # upstream metadata passed through


async def test_live_limit_is_clamped(client, upstream):
    token = await _farmer_token(client)
    resp = await client.get("/v1/mandi/live", params={"limit": 9999}, headers=_auth(token))
    assert resp.status_code == 200
    assert upstream.calls[0]["limit"] == "200"


async def test_live_rejects_negative_offset(client, upstream):
    token = await _farmer_token(client)
    resp = await client.get("/v1/mandi/live", params={"offset": -1}, headers=_auth(token))
    assert resp.status_code == 422
    assert upstream.calls == []  # rejected before any upstream call


async def test_live_malformed_records_are_dropped(client, upstream):
    upstream.payload["records"] = list(EXAMPLE_RECORDS) + [
        {**EXAMPLE_RECORDS[0], "modal_price": None},  # no price → reject
        {**EXAMPLE_RECORDS[0], "arrival_date": "31/02/2026"},  # invalid date → reject
    ]
    token = await _farmer_token(client)
    resp = await client.get("/v1/mandi/live", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["count"] == 2


async def test_live_empty_valid_response(client, upstream):
    upstream.payload = {**EXAMPLE_UPSTREAM, "records": [], "total": 0}
    token = await _farmer_token(client)
    resp = await client.get("/v1/mandi/live", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"] == []
    assert body["count"] == 0
    assert body["reportedDate"] is None


async def test_live_upstream_timeout_retries_once_then_503(client, upstream):
    upstream.error = GovFeedError("timed out", kind="transport")
    token = await _farmer_token(client)
    resp = await client.get("/v1/mandi/live", headers=_auth(token))
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"
    assert len(upstream.calls) == 2  # one retry only


async def test_live_upstream_5xx_retried_once(client, upstream):
    upstream.error = GovFeedError("bad gateway", kind="http", status=502)
    token = await _farmer_token(client)
    resp = await client.get("/v1/mandi/live", headers=_auth(token))
    assert resp.status_code == 503
    assert len(upstream.calls) == 2


async def test_live_upstream_4xx_not_retried(client, upstream):
    upstream.error = GovFeedError("bad request", kind="http", status=400)
    token = await _farmer_token(client)
    resp = await client.get("/v1/mandi/live", headers=_auth(token))
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "UPSTREAM_REJECTED"
    assert len(upstream.calls) == 1  # no retry on 4xx


async def test_live_upstream_malformed_502(client, upstream):
    upstream.error = GovFeedError("bad payload", kind="malformed")
    token = await _farmer_token(client)
    resp = await client.get("/v1/mandi/live", headers=_auth(token))
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "UPSTREAM_MALFORMED"


async def test_live_stale_fallback_after_success(client, upstream):
    token = await _farmer_token(client)
    first = await client.get("/v1/mandi/live", headers=_auth(token))
    assert first.status_code == 200

    upstream.error = GovFeedError("timed out", kind="transport")
    # refresh invalidates the live cache and forces an upstream fetch
    second = await client.post("/v1/mandi/live/refresh", headers=_auth(token))
    assert second.status_code == 200
    body = second.json()
    assert body["stale"] is True
    assert body["data"] == first.json()["data"]


async def test_refresh_failure_without_cache_is_503(client, upstream):
    upstream.error = GovFeedError("timed out", kind="transport")
    token = await _farmer_token(client)
    resp = await client.post("/v1/mandi/live/refresh", headers=_auth(token))
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"


async def test_refresh_success_returns_refreshed_payload(client, upstream):
    token = await _farmer_token(client)
    resp = await client.post("/v1/mandi/live/refresh", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["refreshed"] is True
    assert body["stale"] is False
    assert body["count"] == 2


async def test_cache_keys_isolate_districts(client, upstream):
    token = await _farmer_token(client)
    await client.get("/v1/mandi/live", params={"district": "Nashik"}, headers=_auth(token))
    await client.get("/v1/mandi/live", params={"district": "Pune"}, headers=_auth(token))
    await client.get("/v1/mandi/live", params={"district": "Nashik"}, headers=_auth(token))
    assert len(upstream.calls) == 2  # third call served from cache


# ---------------- history snapshots ----------------


async def test_snapshots_are_idempotent(client, upstream, user_store):
    token = await _farmer_token(client)
    await client.get("/v1/mandi/live", headers=_auth(token))
    history_keys = [k for k in user_store if k.startswith("mandi_price_history/")]
    assert len(history_keys) == 2

    doc = user_store[history_keys[0]]
    assert doc["source"] == "gov-data"
    assert doc["priceDate"] == doc["date"]  # legacy alias for /prices/history
    assert doc["modalPrice"] > 0

    # refetch the same upstream records → same deterministic ids, no duplicates
    await client.post("/v1/mandi/live/refresh", headers=_auth(token))
    history_keys_after = [k for k in user_store if k.startswith("mandi_price_history/")]
    assert sorted(history_keys_after) == sorted(history_keys)


async def test_snapshot_failure_does_not_block_live_response(client, upstream, monkeypatch):
    async def broken_set_doc(collection, doc_id, data):
        raise RuntimeError("firestore down")

    monkeypatch.setattr(mandi_gov_data, "set_doc", broken_set_doc)
    token = await _farmer_token(client)
    resp = await client.get("/v1/mandi/live", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["count"] == 2


async def test_live_filters_come_from_snapshots(client, upstream):
    token = await _farmer_token(client)
    await client.get("/v1/mandi/live", headers=_auth(token))
    resp = await client.get("/v1/mandi/live/filters", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert "Nashik" in body["districts"]
    assert "Onion" in body["commodities"]
    assert any(m["name"] == "APMC Sinner" for m in body["mandis"])


# ---------------- deprecated analytics ----------------


async def test_movers_is_explicitly_unsupported(client, upstream):
    token = await _farmer_token(client)
    resp = await client.get("/v1/mandi/analytics/movers", headers=_auth(token))
    assert resp.status_code == 501
    assert resp.json()["error"]["code"] == "UNSUPPORTED_ANALYTICS"
    assert upstream.calls == []  # never touches the upstream feed
