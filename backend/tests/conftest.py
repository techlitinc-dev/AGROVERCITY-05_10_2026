import firebase_admin.auth as firebase_auth
import httpx
import pytest

from app.main import app


@pytest.fixture
def user_store():
    return {}


@pytest.fixture
async def client(monkeypatch, user_store):
    def _key(collection, doc_id):
        return f"{collection}/{doc_id}"

    async def fake_get_doc(collection, doc_id):
        return user_store.get(_key(collection, doc_id))

    async def fake_set_doc(collection, doc_id, data):
        user_store[_key(collection, doc_id)] = data

    async def fake_query(collection, filters, limit=100):
        prefix = f"{collection}/"
        out = []
        for key, doc in user_store.items():
            if not key.startswith(prefix) or "/" in key[len(prefix):]:
                continue
            if all(doc.get(field) == value for field, op, value in filters if op == "=="):
                out.append(doc)
        return out[:limit]

    async def fake_delete_doc(collection, doc_id):
        user_store.pop(_key(collection, doc_id), None)

    def fake_verify_id_token(id_token):
        return {"uid": "uid-1", "phone_number": "+919812345678"}

    for module in (
        "app.services.users",
        "app.routers.auth",
        "app.routers.users",
        "app.routers.lots",
        "app.routers.marketplace",
        "app.routers.orders",
        "app.routers.addresses",
        "app.routers.contracts",
        "app.routers.transport",
        "app.routers.equipment",
        "app.routers.equipment_owner",
        "app.routers.fpo",
    ):
        monkeypatch.setattr(f"{module}.get_doc", fake_get_doc)
        monkeypatch.setattr(f"{module}.set_doc", fake_set_doc)
    monkeypatch.setattr("app.routers.seller.set_doc", fake_set_doc)
    monkeypatch.setattr("app.services.notifications.set_doc", fake_set_doc)
    for module in (
        "app.routers.auth",
        "app.routers.mandi",
        "app.routers.lots",
        "app.routers.seller",
        "app.routers.orders",
        "app.routers.addresses",
        "app.routers.contracts",
        "app.routers.transport",
        "app.routers.equipment",
        "app.routers.equipment_owner",
        "app.routers.fpo",
    ):
        monkeypatch.setattr(f"{module}.query", fake_query)
    monkeypatch.setattr("app.routers.marketplace.db_query", fake_query)
    monkeypatch.setattr("app.routers.addresses.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.equipment.delete_doc", fake_delete_doc)
    monkeypatch.setattr(firebase_auth, "verify_id_token", fake_verify_id_token)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
