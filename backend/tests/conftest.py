import importlib
import pkgutil

import fakeredis.aioredis
import firebase_admin.auth as firebase_auth
import httpx
import pytest

import app.core as core_pkg
import app.data as data_pkg
import app.routers as routers_pkg
import app.services as services_pkg
from app.main import app


def _discover_db_modules():
    """Modules that hold direct references to Firestore helpers.

    WS-06: auto-discovery replaces the manual monkeypatch lists so adding a new
    router/service module needs zero conftest edits.
    """
    modules = []
    for package in (routers_pkg, services_pkg, data_pkg, core_pkg):
        for found in pkgutil.walk_packages(package.__path__, prefix=f"{package.__name__}."):
            try:
                modules.append(importlib.import_module(found.name))
            except Exception:
                continue
    return modules


_DB_MODULES = _discover_db_modules()


@pytest.fixture
def user_store():
    return {}


@pytest.fixture
def fake_redis():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


@pytest.fixture
async def client(monkeypatch, user_store, fake_redis):
    def _key(collection, doc_id):
        return f"{collection}/{doc_id}"

    async def fake_get_doc(collection, doc_id):
        return user_store.get(_key(collection, doc_id))

    async def fake_set_doc(collection, doc_id, data):
        user_store[_key(collection, doc_id)] = data

    async def fake_query(collection, filters=None, limit=100):
        if filters is None:
            filters = []
        prefix = f"{collection}/"
        out = []
        for key, doc in user_store.items():
            if not key.startswith(prefix) or "/" in key[len(prefix):]:
                continue
            if all(doc.get(field) == value for field, op, value in filters if op == "=="):
                out.append(doc)
        return out[:limit]

    async def fake_query_cursor(
        collection, filters=None, order_field="createdAt", descending=True, cursor_value=None, limit=20
    ):
        if filters is None:
            filters = []
        prefix = f"{collection}/"
        out = []
        for key, doc in user_store.items():
            if not key.startswith(prefix) or "/" in key[len(prefix):]:
                continue
            if all(doc.get(field) == value for field, op, value in filters if op == "=="):
                out.append(doc)
        out.sort(key=lambda d: d.get(order_field) or "", reverse=descending)
        if cursor_value is not None:
            if descending:
                out = [d for d in out if (d.get(order_field) or "") < cursor_value]
            else:
                out = [d for d in out if (d.get(order_field) or "") > cursor_value]
        return out[:limit]

    async def fake_delete_doc(collection, doc_id):
        user_store.pop(_key(collection, doc_id), None)

    def fake_verify_id_token(id_token, check_revoked=False):
        if id_token == "admin-token":
            return {"uid": "uid-admin-test", "phone_number": "+919800000000", "admin": True, "role": "superadmin"}
        if id_token == "plain-token":
            return {"uid": "uid-plain", "phone_number": "+919800000001"}
        return {"uid": "uid-1", "phone_number": "+919812345678"}

    for mod in _DB_MODULES:
        for name, fake in (
            ("get_doc", fake_get_doc),
            ("set_doc", fake_set_doc),
            ("query", fake_query),
            ("query_cursor", fake_query_cursor),
            ("delete_doc", fake_delete_doc),
            ("db_query", fake_query),
        ):
            if hasattr(mod, name):
                monkeypatch.setattr(mod, name, fake)

    async def fake_get_redis():
        return fake_redis

    monkeypatch.setattr("app.routers.content.get_redis", fake_get_redis)
    monkeypatch.setattr(firebase_auth, "verify_id_token", fake_verify_id_token)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
