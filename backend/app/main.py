import logging

import sentry_sdk
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.firebase import init_firebase, verify_app_check_token
from app.data.content_seed import seed_content
from app.data.cold_storage_seed import seed_cold_storage
from app.data.courses_seed import seed_courses
from app.data.gyan_seed import seed_gyan
from app.data.insurance_seed import seed_insurance_rates, seed_insurance_schemes
from app.data.livestock_seed import seed_livestock
from app.data.schemes_seed import seed_schemes
from app.data.tree_seed import seed_tree
from app.data.seasonal_seed import seed_seasonal
from app.data.superadmin_seed import seed_superadmin
from app.services.ai.config_store import seed_ai_config
from app.services.billing import seed_plans
from app.routers import (
    addresses,
    admin,
    admin_console,
    admin_copilot,
    admin_sop_chatbot,
    admin_sop_economy,
    admin_sop_farm,
    admin_sop_farmers,
    admin_sop_finance,
    admin_sop_logistics,
    admin_sop_org,
    admin_sop_platform,
    admin_sop_trade,
    admin_sop_users,
    ads,
    advisory,
    agent_rules,
    ai_power,
    analytics,
    app_config,
    auth,
    bank_accounts,
    billing,
    broker,
    calls,
    chat,
    chatbot,
    climate,
    content,
    contracts,
    courses,
    coupons,
    customer_hub,
    customer_seasonal,
    dairy_manager,
    dairy_hub,
    dashboard,
    demands,
    diary,
    direct_buyer,
    emarket_customer,
    exporter,
    equipment,
    equipment_owner,
    equipment_rental,
    finance,
    follows,
    geo,
    farmer_crops,
    farmer_deals,
    faq,
    fpo,
    gamification,
    gruh_udyog,
    gyan,
    health,
    insurance,
    insurance_claims,
    intelligence,
    jobs,
    kyc,
    land,
    land_ops,
    land_records,
    leads,
    livestock,
    livestock_dairy,
    livestock_gaushala,
    livestock_vets,
    loans,
    lots,
    mandi,
    marketplace,
    milk_seller,
    notifications,
    nursery,
    orders,
    order_tracking,
    partner_api,
    offers,
    purchases,
    purchase_settlement,
    payments,
    pickup,
    product_alerts,
    privacy,
    user_products,
    pnl,
    ratings,
    reference,
    referrals,
    registration,
    resale,
    saved_searches,
    schemes,
    search,
    seller,
    seller_products,
    settlements,
    soil_tests,
    specs,
    support,
    buyer_org,
    post_harvest,
    uploads,
    price_alerts,
    sync,
    tasks,
    teachers,
    transport,
    tree,
    users,
    vault,
    water,
    weather,
    wishlist,
    women,
)

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[FastapiIntegration()],
        traces_sample_rate=0.2,
        environment=settings.env,
    )

app = FastAPI(title="AGROVERCITY API", version="0.1.0")


@app.middleware("http")
async def app_check_middleware(request: Request, call_next):
    if settings.env != "dev" and request.url.path.startswith("/v1"):
        token = request.headers.get("X-Firebase-AppCheck")
        if token and not verify_app_check_token(token):
            return JSONResponse(
                status_code=401,
                content={"error": {"code": "APPCHECK_INVALID", "message": "invalid Firebase App Check token", "fieldErrors": {}}},
            )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.web_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health.router, prefix="/v1")
app.include_router(app_config.router, prefix="/v1")
app.include_router(auth.router, prefix="/v1")
app.include_router(users.router, prefix="/v1")
app.include_router(users.devices_router, prefix="/v1")
app.include_router(reference.router, prefix="/v1")
app.include_router(weather.router, prefix="/v1")
app.include_router(mandi.router, prefix="/v1")
app.include_router(seller.router, prefix="/v1")
app.include_router(resale.seller_router, prefix="/v1")
app.include_router(resale.router, prefix="/v1")
app.include_router(lots.router, prefix="/v1")
app.include_router(marketplace.router, prefix="/v1")
app.include_router(notifications.router, prefix="/v1")
app.include_router(orders.router, prefix="/v1")
app.include_router(order_tracking.router, prefix="/v1")
app.include_router(demands.router, prefix="/v1")
app.include_router(offers.router, prefix="/v1")
app.include_router(purchases.router, prefix="/v1")
app.include_router(pickup.router, prefix="/v1")
app.include_router(pickup.admin_router, prefix="/v1")
app.include_router(nursery.router, prefix="/v1")
app.include_router(nursery.admin_router, prefix="/v1")
app.include_router(purchase_settlement.router, prefix="/v1")
app.include_router(payments.router, prefix="/v1")
app.include_router(chat.router, prefix="/v1")
app.include_router(calls.router, prefix="/v1")
app.include_router(direct_buyer.router, prefix="/v1")
app.include_router(emarket_customer.router, prefix="/v1")
app.include_router(customer_hub.router, prefix="/v1")
app.include_router(customer_seasonal.router, prefix="/v1")
app.include_router(product_alerts.router, prefix="/v1")
app.include_router(exporter.router, prefix="/v1")
app.include_router(dairy_manager.router, prefix="/v1")
app.include_router(dairy_hub.router, prefix="/v1")
app.include_router(milk_seller.router, prefix="/v1")
app.include_router(wishlist.router, prefix="/v1")
app.include_router(coupons.router, prefix="/v1")
app.include_router(analytics.router, prefix="/v1")
app.include_router(seller_products.router, prefix="/v1")
app.include_router(user_products.router, prefix="/v1")
app.include_router(addresses.router, prefix="/v1")
app.include_router(contracts.router, prefix="/v1")
app.include_router(specs.router, prefix="/v1")
app.include_router(buyer_org.router, prefix="/v1")
app.include_router(courses.router, prefix="/v1")
app.include_router(teachers.router, prefix="/v1")
app.include_router(ads.router, prefix="/v1")
app.include_router(broker.router, prefix="/v1")
app.include_router(farmer_crops.router, prefix="/v1")
app.include_router(farmer_deals.router, prefix="/v1")
app.include_router(transport.router, prefix="/v1")
app.include_router(geo.router, prefix="/v1")
app.include_router(equipment.router, prefix="/v1")
app.include_router(equipment_owner.router, prefix="/v1")
app.include_router(equipment_rental.router, prefix="/v1")
app.include_router(equipment_rental.owner_router, prefix="/v1")
app.include_router(fpo.router, prefix="/v1")
app.include_router(diary.router, prefix="/v1")
app.include_router(pnl.router, prefix="/v1")
app.include_router(finance.router, prefix="/v1")
app.include_router(follows.router, prefix="/v1")
app.include_router(loans.router, prefix="/v1")
app.include_router(land.router, prefix="/v1")
app.include_router(land_ops.router, prefix="/v1")
app.include_router(bank_accounts.router, prefix="/v1")
app.include_router(kyc.router, prefix="/v1")
app.include_router(registration.router, prefix="/v1")
app.include_router(billing.router, prefix="/v1")
app.include_router(billing.admin_router, prefix="/v1")
app.include_router(jobs.router, prefix="/v1")
app.include_router(settlements.router, prefix="/v1")
app.include_router(schemes.router, prefix="/v1")
app.include_router(search.router, prefix="/v1")
app.include_router(saved_searches.router, prefix="/v1")
app.include_router(vault.router, prefix="/v1")
app.include_router(land_records.router, prefix="/v1")
app.include_router(leads.router, prefix="/v1")
app.include_router(agent_rules.router, prefix="/v1")
app.include_router(partner_api.router, prefix="/v1")
app.include_router(water.router, prefix="/v1")
app.include_router(soil_tests.router, prefix="/v1")
app.include_router(insurance.router, prefix="/v1")
app.include_router(insurance_claims.router, prefix="/v1")
app.include_router(intelligence.router, prefix="/v1")
app.include_router(content.router, prefix="/v1")
app.include_router(gyan.router, prefix="/v1")
app.include_router(livestock.router, prefix="/v1")
app.include_router(livestock_dairy.router, prefix="/v1")
app.include_router(livestock_gaushala.router, prefix="/v1")
app.include_router(livestock_vets.router, prefix="/v1")
app.include_router(tree.router, prefix="/v1")
app.include_router(ratings.router, prefix="/v1")
app.include_router(advisory.router, prefix="/v1")
app.include_router(women.router, prefix="/v1")
app.include_router(gruh_udyog.router, prefix="/v1")
app.include_router(climate.router, prefix="/v1")
app.include_router(post_harvest.router, prefix="/v1")
app.include_router(uploads.router, prefix="/v1")
app.include_router(dashboard.router, prefix="/v1")
app.include_router(price_alerts.router, prefix="/v1")
app.include_router(sync.router, prefix="/v1")
app.include_router(privacy.router, prefix="/v1")
app.include_router(faq.router, prefix="/v1")
app.include_router(support.router, prefix="/v1")
app.include_router(tasks.router, prefix="/v1")
app.include_router(chatbot.router, prefix="/v1")
app.include_router(gamification.router, prefix="/v1")
app.include_router(referrals.router, prefix="/v1")
app.include_router(admin.router, prefix="/v1")
app.include_router(admin_console.router, prefix="/v1")
app.include_router(admin_copilot.router, prefix="/v1")
app.include_router(ai_power.router, prefix="/v1")
# SOP superadmin console routers (docs/superadmin-instructions) — mounted after
# admin/admin_console so their static routes win over the SOP wildcard routes
# (e.g. /admin/content/news over /admin/content/{collection}).
app.include_router(admin_sop_users.legacy_sop_router, prefix="/v1")
app.include_router(admin_sop_users.router, prefix="/api/v1/admin/users", tags=["Superadmin - Users"])
app.include_router(admin_sop_users.router, prefix="/v1/admin/users", tags=["Superadmin - Users"])
app.include_router(admin_sop_farmers.router, prefix="/api/v1/admin/farmers", tags=["Superadmin - Farmers"])
app.include_router(admin_sop_farmers.router, prefix="/v1/admin/farmers", tags=["Superadmin - Farmers"])
app.include_router(admin_sop_farmers.modules_router, prefix="/api/v1/admin/farmer-modules", tags=["Superadmin - Farmer Modules"])
app.include_router(admin_sop_farmers.modules_router, prefix="/v1/admin/farmer-modules", tags=["Superadmin - Farmer Modules"])
app.include_router(admin_sop_trade.router, prefix="/v1")
app.include_router(admin_sop_logistics.router, prefix="/v1")
app.include_router(admin_sop_farm.router, prefix="/v1")
app.include_router(admin_sop_finance.router, prefix="/v1")
app.include_router(admin_sop_org.router, prefix="/v1")
app.include_router(admin_sop_economy.router, prefix="/v1")
app.include_router(admin_sop_platform.router, prefix="/v1")
app.include_router(admin_sop_platform.threads_router, prefix="/v1")
app.include_router(admin_sop_chatbot.router, prefix="/v1")


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": str(exc.detail),
                "fieldErrors": {},
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def request_validation_handler(request: Request, exc: RequestValidationError):
    field_errors = {}
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path")]
        field_errors[".".join(loc) or "body"] = err.get("msg", "invalid value")
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "request validation failed",
                "fieldErrors": field_errors,
            }
        },
    )


@app.on_event("startup")
async def startup():
    init_firebase()
    # Content seeds are idempotent dev fixtures. A transient Firestore error
    # (e.g. a quota window) must not take the whole API down — log and continue;
    # the failed seed retries on the next boot.
    seeds = (
        seed_schemes,
        seed_insurance_rates,
        seed_insurance_schemes,
        seed_content,
        seed_gyan,
        seed_livestock,
        seed_tree,
        seed_seasonal,
        seed_cold_storage,
        seed_courses,
        seed_ai_config,
        seed_plans,
        seed_superadmin,
    )
    for seed in seeds:
        try:
            await seed()
        except Exception as exc:  # noqa: BLE001 — startup seeds never block boot
            logging.getLogger(__name__).warning("startup seed %s skipped: %s", seed.__name__, exc)


# TODO(day-later): remove or keep env-gated permanently before release.
@app.get("/v1/debug/sentry-test")
def sentry_test():
    if settings.env != "dev":
        raise HTTPException(status_code=404)
    raise RuntimeError("sentry smoke test")
