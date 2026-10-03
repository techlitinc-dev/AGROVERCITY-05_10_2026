import fakeredis.aioredis
import firebase_admin.auth as firebase_auth
import httpx
import pytest

from app.main import app


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

    async def fake_delete_doc(collection, doc_id):
        user_store.pop(_key(collection, doc_id), None)

    def fake_verify_id_token(id_token):
        return {"uid": "uid-1", "phone_number": "+919812345678"}

    for module in (
        "app.services.users",
        "app.routers.loans",
        "app.services.loans",
        "app.routers.finance",
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
        "app.routers.pnl",
        "app.routers.land",
        "app.services.coins",
        "app.routers.bank_accounts",
        "app.services.settlements",
        "app.routers.schemes",
        "app.routers.vault",
        "app.routers.land_records",
        "app.routers.soil_tests",
        "app.services.consents",
        "app.routers.insurance",
        "app.routers.insurance_claims",
        "app.services.claims",
        "app.routers.content",
        "app.routers.gyan",
        "app.routers.livestock",
        "app.routers.livestock_dairy",
        "app.routers.livestock_gaushala",
        "app.routers.livestock_vets",
        "app.routers.tree",
        "app.routers.ratings",
        "app.routers.advisory",
        "app.routers.women",
        "app.routers.post_harvest",
        "app.services.sync",
        "app.routers.chatbot",
        "app.services.chatbot",
        "app.routers.gamification",
        "app.services.referrals",
        "app.routers.admin",
        "app.routers.courses",
        "app.routers.teachers",
        "app.routers.ads",
        "app.data.courses_seed",
        "app.routers.seller",
        "app.routers.broker",
        "app.routers.farmer_deals",
        "app.routers.demands",
        "app.routers.offers",
        "app.routers.purchases",
        "app.routers.direct_buyer",
        "app.routers.price_alerts",
        "app.routers.notifications",
        "app.routers.emarket_customer",
        "app.routers.dairy_manager",
        "app.core.db",
    ):
        monkeypatch.setattr(f"{module}.get_doc", fake_get_doc)
        monkeypatch.setattr(f"{module}.set_doc", fake_set_doc)
    monkeypatch.setattr("app.services.blocks.get_doc", fake_get_doc)
    monkeypatch.setattr("app.data.insurance_seed.set_doc", fake_set_doc)
    monkeypatch.setattr("app.services.purge.set_doc", fake_set_doc)
    monkeypatch.setattr("app.routers.seller.set_doc", fake_set_doc)
    monkeypatch.setattr("app.routers.seller.get_doc", fake_get_doc)
    monkeypatch.setattr("app.routers.seller.query", fake_query)
    for module in (
        "app.routers.coupons",
        "app.routers.seller_products",
    ):
        monkeypatch.setattr(f"{module}.get_doc", fake_get_doc)
        monkeypatch.setattr(f"{module}.query", fake_query)
    monkeypatch.setattr("app.routers.seller_products.set_doc", fake_set_doc)
    monkeypatch.setattr("app.routers.user_products.get_doc", fake_get_doc)
    monkeypatch.setattr("app.routers.user_products.set_doc", fake_set_doc)
    monkeypatch.setattr("app.routers.user_products.query", fake_query)
    monkeypatch.setattr("app.routers.user_products.delete_doc", fake_delete_doc)
    for module in (
        "app.routers.wishlist",
        "app.routers.order_tracking",
    ):
        monkeypatch.setattr(f"{module}.get_doc", fake_get_doc)
        monkeypatch.setattr(f"{module}.set_doc", fake_set_doc)
    monkeypatch.setattr("app.routers.analytics.get_doc", fake_get_doc)
    monkeypatch.setattr("app.routers.analytics.query", fake_query)
    monkeypatch.setattr("app.routers.broker.get_doc", fake_get_doc)
    monkeypatch.setattr("app.routers.broker.set_doc", fake_set_doc)
    monkeypatch.setattr("app.routers.broker.query", fake_query)
    monkeypatch.setattr("app.routers.referrals.get_doc", fake_get_doc)
    monkeypatch.setattr("app.routers.referrals.query", fake_query)
    monkeypatch.setattr("app.routers.diary.set_doc", fake_set_doc)
    monkeypatch.setattr("app.routers.finance.set_doc", fake_set_doc)
    monkeypatch.setattr("app.services.notifications.set_doc", fake_set_doc)
    monkeypatch.setattr("app.services.notify.set_doc", fake_set_doc)
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
        "app.routers.diary",
        "app.routers.pnl",
        "app.routers.land",
        "app.routers.finance",
        "app.routers.loans",
        "app.routers.bank_accounts",
        "app.routers.settlements",
        "app.services.settlements",
        "app.routers.schemes",
        "app.routers.vault",
        "app.routers.soil_tests",
        "app.services.purge",
        "app.services.rent_reminders",
        "app.routers.users",
        "app.routers.insurance",
        "app.routers.insurance_claims",
        "app.data.insurance_seed",
        "app.routers.content",
        "app.routers.gyan",
        "app.routers.livestock",
        "app.routers.livestock_dairy",
        "app.routers.livestock_gaushala",
        "app.routers.livestock_vets",
        "app.routers.tree",
        "app.routers.ratings",
        "app.data.content_seed",
        "app.data.gyan_seed",
        "app.data.livestock_seed",
        "app.data.tree_seed",
        "app.services.advisory",
        "app.routers.post_harvest",
        "app.data.cold_storage_seed",
        "app.services.blocks",
        "app.routers.chatbot",
        "app.routers.admin",
        "app.routers.courses",
        "app.routers.teachers",
        "app.routers.ads",
        "app.services.coins",
        "app.routers.gamification",
        "app.routers.referrals",
        "app.services.referrals",
        "app.routers.demands",
        "app.routers.offers",
        "app.routers.purchases",
        "app.routers.direct_buyer",
        "app.routers.intelligence",
        "app.routers.price_alerts",
        "app.routers.notifications",
        "app.routers.farmer_deals",
        "app.routers.emarket_customer",
        "app.routers.dairy_manager",
        "app.core.db",
    ):
        monkeypatch.setattr(f"{module}.query", fake_query)
    monkeypatch.setattr("app.routers.marketplace.db_query", fake_query)
    for module in (
        "app.data.content_seed",
        "app.data.gyan_seed",
        "app.data.livestock_seed",
        "app.data.tree_seed",
        "app.data.cold_storage_seed",
        "app.data.courses_seed",
    ):
        monkeypatch.setattr(f"{module}.set_doc", fake_set_doc)
    monkeypatch.setattr("app.routers.gyan.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.courses.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.ads.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.content.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.livestock_gaushala.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.demands.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.direct_buyer.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.price_alerts.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.emarket_customer.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.purchase_settlement.set_doc", fake_set_doc)
    monkeypatch.setattr("app.data.courses_seed.get_doc", fake_get_doc)

    async def fake_get_redis():
        return fake_redis

    monkeypatch.setattr("app.routers.content.get_redis", fake_get_redis)
    monkeypatch.setattr("app.routers.addresses.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.equipment.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.diary.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.land.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.bank_accounts.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.users.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.routers.vault.delete_doc", fake_delete_doc)
    monkeypatch.setattr("app.services.purge.delete_doc", fake_delete_doc)
    monkeypatch.setattr(firebase_auth, "verify_id_token", fake_verify_id_token)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
