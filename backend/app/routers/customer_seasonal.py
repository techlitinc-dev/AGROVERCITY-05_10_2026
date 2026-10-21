"""Customer produce browse filters (SR 4) + nutrition & seasonal calendar (SR 14).

`/customer/produce` reuses the FarmGate near-me query style (open `market_lots`)
but adds category (vegetable/fruit/grain/dairy/a2_ghee via a crop-name mapping)
and organic filtering that `/customer/browse/near-me` does not expose.

`/customer/seasonal` serves the 12-month Maharashtra seasonal produce calendar,
nutrition guides and recipes from the `customer_seasonal` doc, falling back to
the module constants in app.data.seasonal_seed when the collection is empty.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query
from app.core.deps import current_user_id
from app.data.seasonal_seed import SEASONAL_DEFAULT_DOC
from app.routers.users import require_role
from app.services.geo import freshness_days, haversine_km
from app.services.users import get_user

router = APIRouter(prefix="/customer", tags=["customer-seasonal"])

# Crop-name → category heuristic for common Maharashtra crops (English +
# Marathi/Hindi names). Anything unmatched lands in "other".
CROP_CATEGORIES: dict[str, tuple[str, ...]] = {
    "vegetable": (
        "tomato", "onion", "potato", "spinach", "palak", "fenugreek", "methi",
        "brinjal", "eggplant", "baingan", "okra", "bhendi", "bhindi", "lady finger",
        "ladyfinger", "cabbage", "cauliflower", "carrot", "beans", "beetroot",
        "beet", "cucumber", "bottle gourd", "dudhi", "doodhi", "lauki",
        "bitter gourd", "karela", "ridge gourd", "dodka", "turai", "radish",
        "mooli", "muli", "capsicum", "bell pepper", "shimla mirch", "chilli",
        "chili", "mirchi", "garlic", "lasun", "ginger", "adrak", "peas", "vatana",
        "mattar", "sweet potato", "pumpkin", "bhopla", "drumstick", "shevga",
        "moringa", "ivy gourd", "tondli", "tindora", "pointed gourd", "parwal",
        "parval", "cluster beans", "gawar", "gavar", "flat beans", "val papdi",
        "valpapdi", "amaranth", "math", "tambdi bhaji", "colocasia", "arbi",
        "raw banana", "plantain", "lettuce", "salad", "spring onion", "green onion",
        "turnip", "shalgam", "coriander", "kothimbir", "dill", "shepu", "sowa",
        "yam", "suran", "jimikand", "zucchini", "squash", "chow chow", "chayote",
        "snake gourd", "padwal", "ash gourd", "petha", "kohlrabi", "navalkol",
        "leek", "celery", "turmeric", "haldi",
    ),
    "fruit": (
        "banana", "keli", "mango", "alphonso", "hapus", "kesar", "papaya", "papai",
        "peru", "guava", "pomegranate", "dalimb", "anar", "orange", "santra",
        "sweet lime", "mosambi", "musambi", "mausambi", "grapes", "draksha",
        "watermelon", "kalingad", "tarbuj", "muskmelon", "cantaloupe", "kharbuja",
        "chibda", "pineapple", "ananas", "custard apple", "sitaphal", "jackfruit",
        "phanas", "fig", "anjeer", "apple", "sapota", "chikoo", "chiku", "sapodilla",
        "lemon", "limbu", "lime", "bel", "bael", "wood apple", "aamla", "amla",
        "avla", "jamun", "jambhul", "java plum", "bor", "ber", "jujube", "plum",
        "alubukhara", "peach", "cashew", "kaju", "strawberry", "litchi", "lychee",
        "dragon fruit", "kiwi", "pear", "tamarind", "chinch", "coconut", "naral",
        "kokum", "apricot", "khumani", "mulberry",
    ),
    "grain": (
        "wheat", "gehu", "gahu", "paddy", "rice", "dhaan", "jowar", "sorghum",
        "bajra", "pearl millet", "ragi", "nachni", "finger millet", "maize", "corn",
        "makka", "barley", "jau", "oats", "tur dal", "toor", "tuvar", "arhar",
        "pigeon pea", "chana", "chickpea", "bengal gram", "harbara", "moong", "mung",
        "green gram", "urad", "udid", "black gram", "masoor", "lentil", "lentils",
        "soybean", "soya", "peanut", "groundnut", "shengdana", "matki", "kulith",
        "horse gram", "dal", "pulses", "cereal", "millets", "little millet", "kutki",
        "foxtail millet", "kangni", "barnyard millet", "sawa", "kodo millet",
    ),
    "dairy": (
        "milk", "doodh", "dudh", "curd", "dahi", "yogurt", "paneer", "butter",
        "makhan", "buttermilk", "chaas", "taak", "cheese", "khoya", "mawa",
        "cream", "malai", "shrikhand", "amrakhand", "lassi",
    ),
    "a2_ghee": (
        "a2 ghee", "ghee", "clarified butter",
    ),
}

CATEGORY_PARAM_MAP = {
    "a2ghee": "a2_ghee",
    "a2-ghee": "a2_ghee",
    "ghee": "a2_ghee",
}


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def _any_user(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return user


async def _customer(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    profiles = user.get("linkedProfiles") or [user.get("activeProfile") or "customer"]
    if "customer" not in profiles and not user.get("isAdmin"):
        require_role(user, "customer", "directBuyer")
    return user


def _category_for_crop(crop: str) -> str:
    name = (crop or "").lower()
    for category, keywords in CROP_CATEGORIES.items():
        for keyword in keywords:
            if keyword in name:
                return category
    return "other"


def _is_organic(lot: dict) -> bool:
    if lot.get("organic") is True:
        return True
    tags = lot.get("tags") or []
    return any(str(tag).strip().lower() == "organic" for tag in tags)


@router.get("/seasonal")
async def get_seasonal(user: dict = Depends(_any_user)):
    """SR 14: 12-month Maharashtra seasonal calendar + nutrition guides + recipes.

    Served from the `customer_seasonal` doc when present; otherwise falls back
    to the seed constants so a fresh database still gets the full calendar."""
    doc = await get_doc("customer_seasonal", "default")
    if not doc:
        return SEASONAL_DEFAULT_DOC
    months = doc.get("months") or SEASONAL_DEFAULT_DOC["months"]
    guides = doc.get("guides") or SEASONAL_DEFAULT_DOC["guides"]
    recipes = doc.get("recipes") or SEASONAL_DEFAULT_DOC["recipes"]
    return {"months": months, "guides": guides, "recipes": recipes}


@router.get("/produce")
async def browse_produce(
    category: str | None = None,
    organic: bool | None = None,
    crop: str | None = None,
    sort: str = "distance",
    page: int = 1,
    pageSize: int = 20,
    lat: float | None = None,
    lng: float | None = None,
    user: dict = Depends(_customer),
):
    """SR 4: open market lots with category + organic filters on top of the
    near-me query style. `category` accepts vegetable|fruit|grain|dairy|a2_ghee
    (anything else falls through to `other`)."""
    lots = await query("market_lots", [("status", "==", "open")], limit=1000)

    wanted_category = None
    if category:
        normalized = CATEGORY_PARAM_MAP.get(category.strip().lower()) or category.strip().lower()
        wanted_category = normalized if normalized in CROP_CATEGORIES or normalized == "other" else "other"

    items = []
    for lot in lots:
        lot_crop = lot.get("crop") or ""
        if crop and crop.lower() not in lot_crop.lower():
            continue
        lot_category = _category_for_crop(lot_crop)
        if wanted_category and lot_category != wanted_category:
            continue
        lot_organic = _is_organic(lot)
        if organic is not None and lot_organic != organic:
            continue

        distance_km = None
        if lat is not None and lng is not None and lot.get("latitude") is not None and lot.get("longitude") is not None:
            distance_km = round(
                haversine_km(lat, lng, float(lot["latitude"]), float(lot["longitude"])), 2
            )

        farmer = await get_user(lot.get("farmerId") or "") or {}
        harvest_date = lot.get("harvestDate") or ""
        items.append(
            {
                "id": lot.get("id"),
                "crop": lot_crop,
                "grade": lot.get("grade") or "",
                "quantityQuintals": float(lot.get("quantityQuintals") or 0),
                "pricePaisa": int(round(float(lot.get("expectedRate") or 0) * 100)),
                "distanceKm": distance_km,
                "harvestDate": harvest_date,
                "freshnessDays": freshness_days(harvest_date),
                "organic": lot_organic,
                "category": lot_category,
                "farmerId": lot.get("farmerId"),
                "farmerName": farmer.get("name") or "",
                "farmerRating": farmer.get("rating"),
            }
        )

    if sort == "price":
        items.sort(key=lambda i: (i["pricePaisa"], i["distanceKm"] is None, i["distanceKm"] or 0))
    elif sort == "grade":
        items.sort(key=lambda i: i["grade"])
    elif sort == "freshness":
        items.sort(key=lambda i: i["harvestDate"], reverse=True)
    else:  # distance — lots without coordinates sink to the bottom
        items.sort(key=lambda i: (i["distanceKm"] is None, i["distanceKm"] or 0, i["pricePaisa"]))

    total = len(items)
    start = (page - 1) * pageSize
    return {"data": items[start:start + pageSize], "total": total, "page": page, "pageSize": pageSize}
