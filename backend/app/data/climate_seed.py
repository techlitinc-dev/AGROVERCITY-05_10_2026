"""Climate & carbon seed data (phase-05 WS-07, robust.md §7.13).

This data used to be hardcoded in `app/routers/climate.py` (global rule 1). It is
moved here **verbatim** and read from Firestore collections by the router:

- `climate_varieties` — the resilient / climate-smart variety catalog.
- `carbon_factors`     — per-practice and per-land carbon factors plus the
                       plantation→tonne conversion used to join the tree module.

`backend/scripts/seed_climate_data.py` writes these docs idempotently (dev).
"""

CLIMATE_VARIETIES: list[dict] = [
    {
        "id": "swarna-sub-1",
        "variety": "Swarna Sub-1",
        "crop": "rice",
        "trait": "flood-tolerant (14 days submergence)",
        "source": "IRRI",
        "order": 0,
    },
    {
        "id": "hhb-67",
        "variety": "HHB-67",
        "crop": "bajra",
        "trait": "heat-tolerant, early maturing",
        "source": "ICRISAT",
        "order": 1,
    },
    {
        "id": "hd-2967",
        "variety": "HD-2967",
        "crop": "wheat",
        "trait": "heat-tolerant, rust-resistant",
        "source": "ICAR-IARI",
        "order": 2,
    },
    {
        "id": "pusa-basmati-1509",
        "variety": "Pusa Basmati 1509",
        "crop": "rice",
        "trait": "short duration, water-saving",
        "source": "ICAR-IARI",
        "order": 3,
    },
    {
        "id": "phule-gadgil",
        "variety": "Phule Gadgil",
        "crop": "tomato",
        "trait": "drought-tolerant",
        "source": "MPKV Rahuri",
        "order": 4,
    },
    {
        "id": "jg-11",
        "variety": "JG-11",
        "crop": "gram",
        "trait": "wilt-resistant, drought-tolerant",
        "source": "JNKVV",
        "order": 5,
    },
]

# `kind` discriminates the roles: `land` (tCO2e/acre/yr), `income` (paisa per
# tonne — money is integer paisa), `conversion` (kg per tonne) and `practice`
# (the eligible carbon-farming practices).
CARBON_FACTORS: list[dict] = [
    {
        "id": "co2e-per-acre",
        "kind": "land",
        "factor": 0.92,
        "unit": "tCO2e/acre/yr",
        "order": 0,
    },
    {
        "id": "income-per-tonne",
        "kind": "income",
        "valuePaisa": 200000,
        "unit": "INR/tonne",
        "order": 1,
    },
    {
        "id": "kg-per-tonne",
        "kind": "conversion",
        "value": 1000,
        "unit": "kg/tonne",
        "order": 2,
    },
    {"id": "practice-biochar", "kind": "practice", "practice": "biochar", "order": 10},
    {"id": "practice-zero-till", "kind": "practice", "practice": "zero-till", "order": 11},
    {"id": "practice-green-manure", "kind": "practice", "practice": "green-manure", "order": 12},
]
