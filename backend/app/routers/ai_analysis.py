"""Unified per-persona AI Analysis (womenhub xlsx Sr 9.0 pattern, platform-wide).

GET /ai-analysis — deterministic "overall analysis + suggestions" computed
from the caller's OWN in-platform data for the active persona (override with
?persona=<type>). No external AI call — the same rule-based approach as the
existing /transport/ai-insights: read the persona's work, summarise it, and
emit concrete next-step suggestions.
"""
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query

from app.core.db import query
from app.core.deps import current_user_id
from app.services.users import get_user

router = APIRouter(tags=["ai-analysis"])

# Canonical persona ids handled by the analyser (website PersonaType values).
_SUPPORTED = {
    "farmer", "landlord", "transporter", "seller", "equipmentOwner",
    "milkSeller", "womenHub", "agriMarketSeller", "exporter", "instructor",
    "directBuyer", "gaushalaManager", "coldStorageProvider", "nursery",
}

_ALIASES = {
    "farmLandlord": "landlord", "transport": "transporter",
    "equipmentRental": "equipmentOwner", "womanHub": "womenHub",
    "womenhub": "womenHub", "directbuyer": "directBuyer",
    "coldstorage": "coldStorageProvider", "gaushala": "gaushalaManager",
    "teacher": "instructor", "milkVendor": "milkSeller",
    "agrimarketseller": "agriMarketSeller",
}

_OWNER_KEYS = (
    "ownerUid", "ownerId", "userId", "uid", "sellerId", "buyerId", "farmerId",
    "managerId", "instructorId", "transporterId", "vendorId", "nurseryId",
)


def _owned(docs: list[dict], uid: str, extra: tuple[str, ...] = ()) -> list[dict]:
    keys = list(extra) + [k for k in _OWNER_KEYS if k not in extra]
    return [d for d in docs if any(d.get(k) == uid for k in keys)]


async def _load(collection: str, uid: str, extra: tuple[str, ...] = (), limit: int = 2000) -> list[dict]:
    return _owned(await query(collection, None, limit=limit), uid, extra)


def _m(d: dict, *keys: str) -> int:
    for k in keys:
        v = d.get(k)
        if isinstance(v, (int, float)):
            return int(v)
    return 0


def _month() -> str:
    return date.today().isoformat()[:7]


def _suggestion(title: str, detail: str, priority: str = "medium") -> dict:
    return {"title": title, "detail": detail, "priority": priority}


# --------------------------------------------------------------------------
# Per-persona analysers — each returns (overall, suggestions).
# --------------------------------------------------------------------------

async def _farmer(uid: str, user: dict):
    lots = await _load("market_lots", uid)
    open_lots = [l for l in lots if l.get("status") == "open"]
    sold = [l for l in lots if l.get("status") in ("sold", "matched", "deal_done")]
    coins = _m(user, "agriCoins")
    streak = _m(user, "streakDays")
    overall = [
        {"label": "Produce lots posted", "value": str(len(lots)), "hint": f"{len(open_lots)} open · {len(sold)} sold"},
        {"label": "AgriCoins balance", "value": str(coins), "hint": "redeem in Coins & Rewards"},
        {"label": "Daily streak", "value": f"{streak} days", "hint": "open the app daily to grow it"},
    ]
    suggestions = []
    if not lots:
        suggestions.append(_suggestion("Post your first produce lot", "Buyers and vyaparis near you cannot see your crop until you list it in My Produce.", "high"))
    elif open_lots and not sold:
        suggestions.append(_suggestion("Boost visibility of open lots", f"{len(open_lots)} lot(s) still unsold — refresh quantities, add clear photos, or check today's Mandi Prices before re-pricing.", "high"))
    if streak < 7:
        suggestions.append(_suggestion("Grow your daily streak", "A longer streak raises your Krishi Ratna level and coin earnings."))
    if (user.get("kycStatus") or "") != "verified":
        suggestions.append(_suggestion("Complete KYC verification", "Verified farmers unlock contact sharing, payments and priority buyer reach."))
    return overall, suggestions


async def _landlord(uid: str, user: dict):
    listings = await _load("land_listings", uid)
    requests = await _load("lease_requests", uid)
    open_listings = [l for l in listings if l.get("status") in ("open", "active", "available")]
    pending = [r for r in requests if r.get("status") in ("pending", "new", "requested")]
    overall = [
        {"label": "Land listings", "value": str(len(listings)), "hint": f"{len(open_listings)} open"},
        {"label": "Pending lease requests", "value": str(len(pending)), "hint": "waiting for your response"},
    ]
    suggestions = []
    if not listings:
        suggestions.append(_suggestion("List your first plot", "Add acreage, expected rent and 7/12 proof so farmers near you can discover the land.", "high"))
    if pending:
        suggestions.append(_suggestion(f"Respond to {len(pending)} lease request(s)", "Fast replies convert interest into signed leases.", "high"))
    if (user.get("kycStatus") or "") != "verified":
        suggestions.append(_suggestion("Verify your identity", "Only verified landowners can accept lease requests and share contact."))
    return overall, suggestions


async def _transporter(uid: str, user: dict):
    bookings = await query("transport_bookings", [("transporterId", "==", uid)], limit=1000)
    vehicles = await _load("vehicles", uid)
    delivered = [b for b in bookings if b.get("status") == "delivered"]
    active = [b for b in bookings if b.get("status") not in ("delivered", "cancelled", "declined")]
    earnings = sum(_m(b, "farePaise", "agreedFarePaise", "finalFarePaise") for b in delivered)
    overall = [
        {"label": "Delivered trips", "value": str(len(delivered)), "hint": f"₹{earnings / 100:,.0f} earned".rstrip("0").rstrip(".")},
        {"label": "Active bookings", "value": str(len(active)), "hint": "in progress right now"},
        {"label": "Vehicles on fleet", "value": str(len(vehicles)), "hint": "verified and ready"},
    ]
    suggestions = []
    if not vehicles:
        suggestions.append(_suggestion("Add your first vehicle", "The load board only matches transporters with at least one listed vehicle.", "high"))
    if active and not vehicles:
        suggestions.append(_suggestion("Keep documents ready", "Pending bookings move faster when RC and permit are uploaded."))
    if delivered and len(active) == 0:
        suggestions.append(_suggestion("Check the load board today", "Your last trips are done — booking the next load early keeps the truck earning.", "medium"))
    return overall, suggestions


async def _seller(uid: str, user: dict):
    orders = await query("orders", [("sellerId", "==", uid)], limit=1000)
    demands = await query("demands", [("buyerId", "==", uid)], limit=1000)
    open_demands = [d for d in demands if d.get("status") in ("open", "active", "live")]
    completed = [o for o in orders if o.get("status") in ("delivered", "completed")]
    overall = [
        {"label": "Buy orders received", "value": str(len(orders)), "hint": f"{len(completed)} completed"},
        {"label": "Open requirements", "value": str(len(open_demands)), "hint": "posted by you"},
    ]
    suggestions = []
    if not demands:
        suggestions.append(_suggestion("Post a buying requirement", "Tell farmers what you procure — they apply directly to your requirement.", "high"))
    if open_demands:
        suggestions.append(_suggestion("Review applications on your requirements", "Responding quickly builds a reliable farmer supply circle."))
    return overall, suggestions


async def _equipment(uid: str, user: dict):
    machines = await _load("equipment", uid)
    bookings = await _load("equipment_bookings", uid)
    pending = [b for b in bookings if b.get("status") in ("pending", "requested", "new")]
    done = [b for b in bookings if b.get("status") in ("completed", "confirmed", "accepted", "done")]
    overall = [
        {"label": "Machines listed", "value": str(len(machines)), "hint": "tractors, harvesters, tools"},
        {"label": "Booking requests", "value": str(len(bookings)), "hint": f"{len(pending)} pending"},
        {"label": "Jobs completed", "value": str(len(done)), "hint": "accepted bookings"},
    ]
    suggestions = []
    if not machines:
        suggestions.append(_suggestion("List your first machine", "Farmers book by machine type and date — add photos and daily rates.", "high"))
    if pending:
        suggestions.append(_suggestion(f"Answer {len(pending)} booking request(s)", "Fast accept/decline keeps your schedule accurate and ratings high.", "high"))
    return overall, suggestions


async def _milk_seller(uid: str, user: dict):
    clients = await query("milk_clients", [("vendorId", "==", uid)], limit=1000)
    active = [c for c in clients if c.get("status") == "active"]
    paused = [c for c in clients if c.get("status") == "paused"]
    deliveries = await query("milk_deliveries", [("vendorId", "==", uid)], limit=2000)
    month = _month()
    month_litres = sum(_m(d, "quantityMl") for d in deliveries if str(d.get("date") or "").startswith(month)) / 1000
    bills = await query("milk_bills", [("vendorId", "==", uid)], limit=500)
    outstanding = [b for b in bills if _m(b, "balancePaisa") > 0]
    due = sum(_m(b, "balancePaisa") for b in outstanding)
    overall = [
        {"label": "Active clients", "value": str(len(active)), "hint": f"{len(paused)} paused"},
        {"label": "Milk delivered this month", "value": f"{month_litres:,.0f} L", "hint": "across all clients"},
        {"label": "Outstanding bills", "value": str(len(outstanding)), "hint": f"₹{due / 100:,.0f} to collect"},
    ]
    suggestions = []
    if not clients:
        suggestions.append(_suggestion("Add your first client", "Create client cards with morning/evening quantities to start the punch sheet.", "high"))
    if paused:
        suggestions.append(_suggestion(f"Follow up {len(paused)} paused client(s)", "Paused clients are the quickest win — a call usually restarts the route."))
    if outstanding:
        suggestions.append(_suggestion("Collect outstanding bills", f"₹{due / 100:,.0f} pending across {len(outstanding)} bill(s).", "high"))
    return overall, suggestions


async def _women_hub(uid: str, user: dict):
    crops = await query("garden_crops", [("ownerUid", "==", uid)], limit=500)
    harvested = [c for c in crops if c.get("stage") == "harvest"]
    yields = [
        (c.get("name") or "Crop", sum(float(y.get("quantity") or 0) for y in c.get("yieldLog") or []))
        for c in crops
    ]
    avg_yield = sum(v for _, v in yields) / len(yields) if yields else 0
    lines = await query("home_enterprises", [("ownerUid", "==", uid)], limit=200)
    best = max(lines, key=lambda l: _m(l, "monthlyProfitPaisa"), default=None)
    businesses = await query("women_businesses", [("ownerUid", "==", uid)], limit=200)
    orders = await query("women_business_orders", [("ownerUid", "==", uid)], limit=500)
    open_orders = [o for o in orders if o.get("status") not in ("delivered", "cancelled")]
    animals = await _load("livestock_animals", uid)
    overall = [
        {"label": "Kitchen garden crops", "value": str(len(crops)), "hint": f"{len(harvested)} harvested"},
        {"label": "Garden yield prediction", "value": f"{avg_yield * max(len(crops) - len(harvested), 0):,.1f}", "hint": "expected units from active crops"},
        {"label": "Livestock tracked", "value": str(len(animals)), "hint": "backyard productivity"},
        {"label": "Enterprise product lines", "value": str(len(lines)), "hint": f"best: {best.get('product') if best else '—'}"},
        {"label": "Active businesses", "value": str(len(businesses)), "hint": f"{len(open_orders)} open orders"},
    ]
    suggestions = []
    if not crops:
        suggestions.append(_suggestion("Start a kitchen garden plan", "Spinach and methi mature in 30–45 days — the planner tracks stages and reminders.", "high"))
    if lines and best:
        price = _m(best, "pricePaisa")
        profit = _m(best, "monthlyProfitPaisa")
        if price and profit * 10 < price:
            suggestions.append(_suggestion(f"Re-price “{best.get('product')}”", "Its monthly profit is under 10% of price — a small increase lifts your ledger total."))
        suggestions.append(_suggestion(f"Push your best-seller: {best.get('product')}", "Highest-profit line — feature it in My Seller Store and ads."))
    if businesses and not orders:
        suggestions.append(_suggestion("Share your business store link", "Businesses with orders build ratings faster — share with nearby farmers."))
    return overall, suggestions


async def _agri_market_seller(uid: str, user: dict):
    products = await query("products", [("sellerId", "==", uid)], limit=1000)
    live = [p for p in products if p.get("status", "live") in ("live", "active")]
    low_stock = [p for p in live if _m(p, "stock") <= 5]
    orders = await query("orders", [("sellerId", "==", uid)], limit=1000)
    delivered = [o for o in orders if o.get("status") in ("delivered", "completed")]
    ratings = await query("ratings", [("targetUserId", "==", uid)], limit=500)
    avg = round(sum(float(r.get("rating") or 0) for r in ratings) / len(ratings), 1) if ratings else 0
    overall = [
        {"label": "Live products", "value": str(len(live)), "hint": f"{len(low_stock)} low stock"},
        {"label": "Orders", "value": str(len(orders)), "hint": f"{len(delivered)} delivered"},
        {"label": "Average rating", "value": f"{avg} ★" if ratings else "—", "hint": f"{len(ratings)} reviews"},
    ]
    suggestions = []
    if not products:
        suggestions.append(_suggestion("List your first product", "Complete shop profile + products unlock orders from the Krishi Mall.", "high"))
    if low_stock:
        suggestions.append(_suggestion(f"Restock {len(low_stock)} product(s)", "Items with stock ≤ 5 risk lost orders — update stock or add batches.", "high"))
    if ratings and avg < 4:
        suggestions.append(_suggestion("Improve rating to 4★+", "Reply to recent reviews and resolve pending complaints."))
    return overall, suggestions


async def _exporter(uid: str, user: dict):
    rfqs = await _load("export_rfqs", uid)
    orders = await _load("export_orders", uid)
    open_rfqs = [r for r in rfqs if r.get("status") in ("open", "active", "live")]
    overall = [
        {"label": "Export requirements", "value": str(len(rfqs)), "hint": f"{len(open_rfqs)} open"},
        {"label": "Export orders", "value": str(len(orders)), "hint": "confirmed shipments"},
    ]
    suggestions = []
    if not rfqs:
        suggestions.append(_suggestion("Post your first export requirement", "Name the crop, grade and destination — suppliers apply with quotes.", "high"))
    if open_rfqs:
        suggestions.append(_suggestion("Review quotes on open RFQs", "Open requirements with unanswered quotes stall your sourcing pipeline."))
    return overall, suggestions


async def _instructor(uid: str, user: dict):
    courses = await query("courses", [("instructorId", "==", uid)], limit=500)
    published = [c for c in courses if c.get("status") in ("published", "live", "active")]
    ids = {c.get("id") for c in published}
    purchases = [p for p in await query("course_purchases", None, limit=2000) if p.get("courseId") in ids]
    overall = [
        {"label": "Courses created", "value": str(len(courses)), "hint": f"{len(published)} published"},
        {"label": "Total enrollments", "value": str(len(purchases)), "hint": "across published courses"},
    ]
    suggestions = []
    if not courses:
        suggestions.append(_suggestion("Create your first course", "Use the Course Builder — batches, assignments and certificates are built in.", "high"))
    elif published and len(purchases) < 10:
        suggestions.append(_suggestion("Promote your published course(s)", "Enrollments are low — share the course on the demand board and WhatsApp groups."))
    return overall, suggestions


async def _direct_buyer(uid: str, user: dict):
    demands = await query("demands", [("buyerId", "==", uid)], limit=1000)
    open_demands = [d for d in demands if d.get("status") in ("open", "active", "live")]
    offers = await _load("offers", uid)
    overall = [
        {"label": "Requirements posted", "value": str(len(demands)), "hint": f"{len(open_demands)} open"},
        {"label": "Offers received", "value": str(len(offers)), "hint": "from farmers & suppliers"},
    ]
    suggestions = []
    if not demands:
        suggestions.append(_suggestion("Post your first requirement", "Crop, quantity, grade and delivery window — farmers apply directly.", "high"))
    if open_demands and not offers:
        suggestions.append(_suggestion("Boost open requirements", "Requirements without offers need a wider price band or bigger quantity."))
    return overall, suggestions


async def _gaushala(uid: str, user: dict):
    gaushalas = await query("gaushalas", [("managerId", "==", uid)], limit=10)
    gid = gaushalas[0].get("id") if gaushalas else None
    animals = await query("livestock_animals", [("gaushalaId", "==", gid)], limit=500) if gid else []
    adoptions = await query("cow_adoptions", [("gaushalaId", "==", gid)], limit=500) if gid else []
    donations = await query("fodder_donations", [("gaushalaId", "==", gid)], limit=500) if gid else []
    overall = [
        {"label": "Cattle in herd", "value": str(len(animals)), "hint": "registered animals"},
        {"label": "Adoptions", "value": str(len(adoptions)), "hint": "80G supported"},
        {"label": "Fodder donations", "value": str(len(donations)), "hint": "received"},
    ]
    suggestions = []
    if not gaushalas:
        suggestions.append(_suggestion("Create your gaushala profile", "Register the trust to unlock herd, adoption and 80G receipt tools.", "high"))
    elif not animals:
        suggestions.append(_suggestion("Register your first animals", "The herd registry drives vaccination alerts and adoption listings.", "high"))
    if adoptions and not donations:
        suggestions.append(_suggestion("Enable fodder donations", "Adopters often contribute fodder — turn the program on from the profile."))
    return overall, suggestions


async def _cold_storage(uid: str, user: dict):
    facilities = await _load("cold_storage", uid, extra=("ownerId", "managerId"))
    fids = {f.get("id") for f in facilities}
    bookings = [b for b in await query("cold_storage_bookings", None, limit=2000) if b.get("facilityId") in fids]
    pending = [b for b in bookings if b.get("status") in ("pending", "requested", "new")]
    occupied = [b for b in bookings if b.get("status") in ("active", "occupied", "stored", "inward")]
    overall = [
        {"label": "Warehouses / chambers", "value": str(len(facilities)), "hint": "listed facilities"},
        {"label": "Active storages", "value": str(len(occupied)), "hint": "currently occupied"},
        {"label": "Pending bookings", "value": str(len(pending)), "hint": "awaiting review"},
    ]
    suggestions = []
    if not facilities:
        suggestions.append(_suggestion("Register your cold storage", "Add chamber capacity and temperature ranges to appear in farmer search.", "high"))
    if pending:
        suggestions.append(_suggestion(f"Review {len(pending)} pending booking(s)", "Quick inward approvals keep chambers full and fees accruing.", "high"))
    return overall, suggestions


async def _nursery(uid: str, user: dict):
    nurseries = await _load("nurseries", uid)
    nid = nurseries[0].get("id") if nurseries else None
    plants = await query("nursery_plants", [("nurseryId", "==", nid)], limit=500) if nid else []
    batches = await query("nursery_batches", [("nurseryId", "==", nid)], limit=500) if nid else []
    orders = [o for o in await query("orders", None, limit=2000) if o.get("nurseryId") == nid]
    low = [p for p in plants if _m(p, "stock") <= 5]
    overall = [
        {"label": "Plant varieties", "value": str(len(plants)), "hint": f"{len(low)} low stock"},
        {"label": "Active batches", "value": str(len(batches)), "hint": "propagation & stock in/out"},
        {"label": "Orders received", "value": str(len(orders)), "hint": "all time"},
    ]
    suggestions = []
    if not plants:
        suggestions.append(_suggestion("Add your first plants", "List saplings with species, age and stock to appear in farmer search.", "high"))
    if low:
        suggestions.append(_suggestion(f"Restock {len(low)} plant type(s)", "Low-stock plants are hidden from recommendations — add batches to replenish.", "high"))
    return overall, suggestions


_ANALYSERS = {
    "farmer": _farmer,
    "landlord": _landlord,
    "transporter": _transporter,
    "seller": _seller,
    "equipmentOwner": _equipment,
    "milkSeller": _milk_seller,
    "womenHub": _women_hub,
    "agriMarketSeller": _agri_market_seller,
    "exporter": _exporter,
    "instructor": _instructor,
    "directBuyer": _direct_buyer,
    "gaushalaManager": _gaushala,
    "coldStorageProvider": _cold_storage,
    "nursery": _nursery,
}

_PERSONA_LABELS = {
    "farmer": "Farmer / Kisan", "landlord": "Farm Landlord", "transporter": "Transporter / Gadi",
    "seller": "Agri Vyapari", "equipmentOwner": "Equipment Owner", "milkSeller": "Milk Vendor / Doodh Vala",
    "womenHub": "Woman Hub", "agriMarketSeller": "Agri Market Seller", "exporter": "Agri Exporter",
    "instructor": "Gurukul Instructor", "directBuyer": "Industrial / Direct Buyer",
    "gaushalaManager": "Gaushala & Sanctuary", "coldStorageProvider": "Cold Storage Owner",
    "nursery": "Plant Nursery",
}


@router.get("/ai-analysis")
async def ai_analysis(
    persona: str | None = Query(None),
    uid: str = Depends(current_user_id),
):
    user = await get_user(uid) or {}
    raw = (persona or user.get("activeProfile") or "farmer").strip()
    canonical = _ALIASES.get(raw, raw)
    if canonical not in _SUPPORTED:
        canonical = "farmer"

    overall, suggestions = await _ANALYSERS[canonical](uid, user)
    empty = not overall or all(o.get("value") in ("0", "—", "0 ★") for o in overall)
    if empty and not suggestions:
        suggestions = [
            _suggestion(
                "Start using your workspace",
                "Analysis and suggestions appear here once you add data to this persona's features.",
                "high",
            )
        ]
    return {
        "persona": canonical,
        "personaLabel": _PERSONA_LABELS[canonical],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "empty": empty,
        "overall": overall,
        "suggestions": suggestions,
    }
