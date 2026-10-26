"""Dev fixture — reference crop catalog for the crop typeahead.

Seeds the `crops` reference collection with common Maharashtra crops
(vernacular names + search aliases) so `/v1/reference/crops-suggest` and the
global-search crops group have real data on a dev instance. Dev-only and
idempotent — existing docs are never overwritten.

    cd backend && APP_ENV=dev .venv/bin/python scripts/seed_crop_catalog.py
"""

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.core.db import get_doc, set_doc

CROPS = [
    {"id": "soybean", "name": "Soybean", "vernacularName": "सोयाबीन (Soyabean)", "category": "oilseed", "aliases": ["soya", "soyabean"]},
    {"id": "wheat", "name": "Wheat", "vernacularName": "गहू (Gehu)", "category": "cereal", "aliases": ["gehu", "gahu"]},
    {"id": "onion", "name": "Onion", "vernacularName": "कांदा (Kanda)", "category": "vegetable", "aliases": ["pyaz", "kanda"]},
    {"id": "cotton", "name": "Cotton", "vernacularName": "कापूस (Kapus)", "category": "fibre", "aliases": ["kapas", "kapus"]},
    {"id": "tomato", "name": "Tomato", "vernacularName": "टमाटर (Tamatar)", "category": "vegetable", "aliases": ["tamatar"]},
    {"id": "maize", "name": "Maize", "vernacularName": "मका (Maka)", "category": "cereal", "aliases": ["corn", "makka", "bhutta"]},
    {"id": "chickpea", "name": "Chickpea (Gram)", "vernacularName": "हरभरा (Harbhara)", "category": "pulse", "aliases": ["chana", "gram", "chhole"]},
    {"id": "pigeonpea", "name": "Pigeonpea (Tur)", "vernacularName": "तूर (Tur)", "category": "pulse", "aliases": ["tur", "arhar", "toor"]},
    {"id": "mustard", "name": "Mustard", "vernacularName": "मोहरी (Mohari)", "category": "oilseed", "aliases": ["sarson", "rai"]},
    {"id": "sugarcane", "name": "Sugarcane", "vernacularName": "ऊस (Uss)", "category": "cash", "aliases": ["ganna", "us"]},
    {"id": "rice", "name": "Rice (Paddy)", "vernacularName": "भात (Bhat)", "category": "cereal", "aliases": ["paddy", "dhan", "dhana"]},
    {"id": "jowar", "name": "Sorghum (Jowar)", "vernacularName": "ज्वारी (Jwari)", "category": "cereal", "aliases": ["jwari", "sorghum"]},
    {"id": "bajra", "name": "Pearl Millet (Bajra)", "vernacularName": "बाजरी (Bajri)", "category": "cereal", "aliases": ["bajri", "pearl millet"]},
    {"id": "groundnut", "name": "Groundnut", "vernacularName": "शेंगदाणा (Shengdana)", "category": "oilseed", "aliases": ["peanut", "moongphali", "badam"]},
    {"id": "sunflower", "name": "Sunflower", "vernacularName": "सूर्यफूल (Suryaphul)", "category": "oilseed", "aliases": ["suryamukhi"]},
    {"id": "potato", "name": "Potato", "vernacularName": "बटाटा (Batata)", "category": "vegetable", "aliases": ["aloo", "batata"]},
    {"id": "brinjal", "name": "Brinjal (Eggplant)", "vernacularName": "वांगी (Vangi)", "category": "vegetable", "aliases": ["baingan", "eggplant", "vangi"]},
    {"id": "okra", "name": "Okra (Ladies Finger)", "vernacularName": "भेंडी (Bhendi)", "category": "vegetable", "aliases": ["bhendi", "bhindi", "ladyfinger"]},
    {"id": "cabbage", "name": "Cabbage", "vernacularName": "कोबी (Kobi)", "category": "vegetable", "aliases": ["kobi", "patta gobi"]},
    {"id": "cauliflower", "name": "Cauliflower", "vernacularName": "फुलकोबी (Phulkobi)", "category": "vegetable", "aliases": ["phool gobi", "gobi"]},
    {"id": "garlic", "name": "Garlic", "vernacularName": "लसूण (Lasun)", "category": "vegetable", "aliases": ["lasoon", "lehsun"]},
    {"id": "chilli", "name": "Chilli", "vernacularName": "मिरची (Mirchi)", "category": "spice", "aliases": ["mirchi", "haldi mirchi"]},
    {"id": "turmeric", "name": "Turmeric", "vernacularName": "हळद (Halad)", "category": "spice", "aliases": ["haldi", "halad"]},
    {"id": "coriander", "name": "Coriander", "vernacularName": "कोथिंबीर (Kothimbir)", "category": "spice", "aliases": ["dhania", "cilantro"]},
    {"id": "cumin", "name": "Cumin", "vernacularName": "जिरे (Jire)", "category": "spice", "aliases": ["jeera", "jira"]},
    {"id": "fenugreek", "name": "Fenugreek (Methi)", "vernacularName": "मेथी (Methi)", "category": "leafy", "aliases": ["methi"]},
    {"id": "spinach", "name": "Spinach (Palak)", "vernacularName": "पालक (Palak)", "category": "leafy", "aliases": ["palak"]},
    {"id": "watermelon", "name": "Watermelon", "vernacularName": "कलिंगड (Kalingad)", "category": "fruit", "aliases": ["kalingad", "tarbooz"]},
    {"id": "muskmelon", "name": "Muskmelon", "vernacularName": "खरबूज (Kharbuj)", "category": "fruit", "aliases": ["kharbuja", "cantaloupe"]},
    {"id": "papaya", "name": "Papaya", "vernacularName": "पपई (Papai)", "category": "fruit", "aliases": ["papita"]},
    {"id": "banana", "name": "Banana", "vernacularName": "केळी (Keli)", "category": "fruit", "aliases": ["keli", "kela"]},
    {"id": "mango", "name": "Mango", "vernacularName": "आंबा (Amba)", "category": "fruit", "aliases": ["amba", "aam"]},
    {"id": "pomegranate", "name": "Pomegranate", "vernacularName": "डाळिंब (Dalimb)", "category": "fruit", "aliases": ["dalim", "anar"]},
    {"id": "grapes", "name": "Grapes", "vernacularName": "द्राक्ष (Draksha)", "category": "fruit", "aliases": ["draksh", "angoor"]},
    {"id": "guava", "name": "Guava", "vernacularName": "पेरू (Peru)", "category": "fruit", "aliases": ["peru", "amrood"]},
    {"id": "orange", "name": "Orange (Sweet Lime)", "vernacularName": "संत्रा (Santra)", "category": "fruit", "aliases": ["santra", "mosambi"]},
    {"id": "sapota", "name": "Sapota (Chikoo)", "vernacularName": "चिकू (Chiku)", "category": "fruit", "aliases": ["chikoo", "sapodilla"]},
    {"id": "mung", "name": "Green Gram (Moong)", "vernacularName": "मूग (Mug)", "category": "pulse", "aliases": ["moong", "mug", "green gram"]},
    {"id": "urd", "name": "Black Gram (Urad)", "vernacularName": "उडीद (Udid)", "category": "pulse", "aliases": ["urad", "udid"]},
    {"id": "lentil", "name": "Lentil (Masoor)", "vernacularName": "मसूर (Masur)", "category": "pulse", "aliases": ["masoor", "masur"]},
    {"id": "pea", "name": "Pea (Matar)", "vernacularName": "वाटाणा (Vatana)", "category": "pulse", "aliases": ["matar", "vatana"]},
    {"id": "sesame", "name": "Sesame (Til)", "vernacularName": "तिळ (Til)", "category": "oilseed", "aliases": ["til"]},
    {"id": "safflower", "name": "Safflower (Kardi)", "vernacularName": "कारडी (Kardi)", "category": "oilseed", "aliases": ["kardi", "kusum"]},
    {"id": "napier", "name": "Napier Grass (Fodder)", "vernacularName": "नेपियर (Napier)", "category": "fodder", "aliases": ["fodder grass"]},
    {"id": "berseem", "name": "Berseem (Fodder)", "vernacularName": "बरसीम (Barseem)", "category": "fodder", "aliases": ["barsim", "clover"]},
    {"id": "marigold", "name": "Marigold (Flower)", "vernacularName": "झेंडू (Zhendu)", "category": "flower", "aliases": ["zendu", "genda"]},
    {"id": "rose", "name": "Rose (Flower)", "vernacularName": "गुलाब (Gulab)", "category": "flower", "aliases": ["gulab"]},
    {"id": "gerbera", "name": "Gerbera (Flower)", "vernacularName": "गरबेरा (Gerbera)", "category": "flower", "aliases": ["gerbara"]},
]


async def main():
    if settings.env != "dev":
        print("refusing to seed: APP_ENV is not dev")
        return
    seeded = 0
    for crop in CROPS:
        if await get_doc("crops", crop["id"]) is None:
            await set_doc("crops", crop["id"], crop)
            seeded += 1
    print(
        f"seeded {seeded}/{len(CROPS)} crop catalog rows at "
        f"{datetime.now(timezone.utc).isoformat()}"
    )


if __name__ == "__main__":
    asyncio.run(main())
