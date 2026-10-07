"""Women Farmer Hub seed data (phase-05 WS-08 task 8.15).

These payloads used to be hardcoded in `app/routers/women.py` (global rule 1).
They are now the dev seed written to real Firestore collections by
`backend/scripts/seed_women_data.py`:
    - `garden_plans`       — the kitchen-garden catalog (plan templates)
    - `shg_groups`         — one demo SHG group for the dev farmer persona
    - `shg_meetings`       — demo meetings for that group
    - `home_enterprises`   — demo home-enterprise income lines

Money is integer paisa. `template: true` marks catalog rows (no owner).
"""

# Kitchen-garden planner catalog — moved verbatim from routers/women.py.
GARDEN_PLAN_TEMPLATES: list[dict] = [
    {
        "id": "gp_leafy",
        "category": "Leafy Greens",
        "template": True,
        "order": 1,
        "items": [
            {"name": "Spinach", "vernacularName": "पालक", "nutrition": "Iron, Vitamin A, Folate", "companion": "Tomato, Cauliflower", "daysToHarvest": 45},
            {"name": "Fenugreek", "vernacularName": "मेथी", "nutrition": "Iron, Calcium, Fibre", "companion": "Coriander, Spinach", "daysToHarvest": 30},
            {"name": "Coriander", "vernacularName": "धनिया", "nutrition": "Vitamin K, Vitamin C", "companion": "Fenugreek, Spinach", "daysToHarvest": 40},
            {"name": "Amaranth", "vernacularName": "तांदूळ", "nutrition": "Iron, Calcium, Protein", "companion": "Tomato, Bean", "daysToHarvest": 35},
        ],
    },
    {
        "id": "gp_vegetables",
        "category": "Vegetables",
        "template": True,
        "order": 2,
        "items": [
            {"name": "Tomato", "vernacularName": "टमाटर", "nutrition": "Lycopene, Vitamin C", "companion": "Spinach, Onion", "daysToHarvest": 90},
            {"name": "Carrot", "vernacularName": "गाजर", "nutrition": "Beta-carotene, Vitamin K", "companion": "Tomato, Pea", "daysToHarvest": 75},
            {"name": "Brinjal", "vernacularName": "वांगी", "nutrition": "Fibre, Potassium", "companion": "Bean, Spinach", "daysToHarvest": 80},
            {"name": "Okra", "vernacularName": "भेंडी", "nutrition": "Folate, Magnesium", "companion": "Tomato, Pepper", "daysToHarvest": 55},
        ],
    },
    {
        "id": "gp_trees",
        "category": "Trees/Perennials",
        "template": True,
        "order": 3,
        "items": [
            {"name": "Drumstick", "vernacularName": "शेवगा", "nutrition": "Vitamin C, Calcium, Iron", "companion": "Turmeric, Curry leaf", "daysToHarvest": 180},
            {"name": "Papaya", "vernacularName": "पपई", "nutrition": "Vitamin A, Vitamin C", "companion": "Banana, Bean", "daysToHarvest": 270},
            {"name": "Guava", "vernacularName": "पेरू", "nutrition": "Vitamin C, Lycopene", "companion": "Papaya, Drumstick", "daysToHarvest": 365},
            {"name": "Curry leaf", "vernacularName": "कढीपत्ता", "nutrition": "Iron, Vitamin A", "companion": "Drumstick, Citrus", "daysToHarvest": 240},
        ],
    },
]

# Dev farmer persona uid (matches backend/app/routers/auth.py quick-login).
DEV_FARMER_UID = "dev-user-1"
DEV_SHG_GROUP_ID = "shg_demo_1"

SHG_GROUPS: list[dict] = [
    {
        "id": DEV_SHG_GROUP_ID,
        "name": "Jai Kisan Mahila Bachat Gat",
        "memberUid": DEV_FARMER_UID,
        "memberCount": 12,
        "corpusPaisa": 4_850_000,
        "loanFundPaisa": 3_000_000,
        "monthlyDepositPaisa": 50_000,
        "members": [
            {"memberUid": DEV_FARMER_UID, "name": "Ram Patil", "role": "president"},
        ],
    },
]

SHG_MEETINGS: list[dict] = [
    {
        "id": "shgm_demo_1",
        "groupId": DEV_SHG_GROUP_ID,
        "date": "2026-09-05",
        "agenda": "Monthly savings collection",
        "attendance": [{"memberUid": DEV_FARMER_UID, "present": True}],
        "collections": [{"memberUid": DEV_FARMER_UID, "amountPaisa": 50_000}],
    },
    {
        "id": "shgm_demo_2",
        "groupId": DEV_SHG_GROUP_ID,
        "date": "2026-10-05",
        "agenda": "Loan review + collection",
        "attendance": [{"memberUid": DEV_FARMER_UID, "present": True}],
        "collections": [{"memberUid": DEV_FARMER_UID, "amountPaisa": 50_000}],
    },
]

# Home-enterprise income lines — moved verbatim (rupees → integer paisa).
HOME_ENTERPRISES: list[dict] = [
    {"id": "he_achar", "ownerUid": DEV_FARMER_UID, "product": "अचार", "monthlyProfitPaisa": 320_000},
    {"id": "he_papad", "ownerUid": DEV_FARMER_UID, "product": "पापड़", "monthlyProfitPaisa": 210_000},
    {"id": "he_ghee", "ownerUid": DEV_FARMER_UID, "product": "A2 घी", "monthlyProfitPaisa": 450_000},
]
