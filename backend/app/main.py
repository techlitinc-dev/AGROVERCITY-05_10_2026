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
from app.services.ai.config_store import seed_ai_config
from app.services.billing import seed_plans
from app.routers import (
    addresses,
    admin,
    ads,
    advisory,
    analytics,
    app_config,
    auth,
    bank_accounts,
    billing,
    broker,
    chat,
    chatbot,
    climate,
    content,
    contracts,
    courses,
    coupons,
    dairy_manager,
    demands,
    diary,
    direct_buyer,
    emarket_customer,
    equipment,
    equipment_owner,
    finance,
    farmer_deals,
    fpo,
    gamification,
    gyan,
    health,
    insurance,
    insurance_claims,
    intelligence,
    jobs,
    kyc,
    land,
    land_records,
    livestock,
    livestock_dairy,
    livestock_gaushala,
    livestock_vets,
    loans,
    lots,
    mandi,
    marketplace,
    notifications,
    orders,
    order_tracking,
    offers,
    purchases,
    purchase_settlement,
    payments,
    user_products,
    pnl,
    ratings,
    reference,
    referrals,
    schemes,
    search,
    seller,
    seller_products,
    settlements,
    soil_tests,
    specs,
    buyer_org,
    post_harvest,
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
app.include_router(lots.router, prefix="/v1")
app.include_router(marketplace.router, prefix="/v1")
app.include_router(notifications.router, prefix="/v1")
app.include_router(orders.router, prefix="/v1")
app.include_router(order_tracking.router, prefix="/v1")
app.include_router(demands.router, prefix="/v1")
app.include_router(offers.router, prefix="/v1")
app.include_router(purchases.router, prefix="/v1")
app.include_router(purchase_settlement.router, prefix="/v1")
app.include_router(payments.router, prefix="/v1")
app.include_router(chat.router, prefix="/v1")
app.include_router(direct_buyer.router, prefix="/v1")
app.include_router(emarket_customer.router, prefix="/v1")
app.include_router(dairy_manager.router, prefix="/v1")
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
app.include_router(farmer_deals.router, prefix="/v1")
app.include_router(transport.router, prefix="/v1")
app.include_router(equipment.router, prefix="/v1")
app.include_router(equipment_owner.router, prefix="/v1")
app.include_router(fpo.router, prefix="/v1")
app.include_router(diary.router, prefix="/v1")
app.include_router(pnl.router, prefix="/v1")
app.include_router(finance.router, prefix="/v1")
app.include_router(loans.router, prefix="/v1")
app.include_router(land.router, prefix="/v1")
app.include_router(bank_accounts.router, prefix="/v1")
app.include_router(kyc.router, prefix="/v1")
app.include_router(billing.router, prefix="/v1")
app.include_router(jobs.router, prefix="/v1")
app.include_router(settlements.router, prefix="/v1")
app.include_router(schemes.router, prefix="/v1")
app.include_router(search.router, prefix="/v1")
app.include_router(vault.router, prefix="/v1")
app.include_router(land_records.router, prefix="/v1")
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
app.include_router(climate.router, prefix="/v1")
app.include_router(post_harvest.router, prefix="/v1")
app.include_router(price_alerts.router, prefix="/v1")
app.include_router(sync.router, prefix="/v1")
app.include_router(tasks.router, prefix="/v1")
app.include_router(chatbot.router, prefix="/v1")
app.include_router(gamification.router, prefix="/v1")
app.include_router(referrals.router, prefix="/v1")
app.include_router(admin.router, prefix="/v1")


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
    await seed_schemes()
    await seed_insurance_rates()
    await seed_insurance_schemes()
    await seed_content()
    await seed_gyan()
    await seed_livestock()
    await seed_tree()
    await seed_cold_storage()
    await seed_courses()
    await seed_ai_config()
    await seed_plans()


# TODO(day-later): remove or keep env-gated permanently before release.
@app.get("/v1/debug/sentry-test")
def sentry_test():
    if settings.env != "dev":
        raise HTTPException(status_code=404)
    raise RuntimeError("sentry smoke test")
