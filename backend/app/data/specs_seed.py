from app.core.db import set_doc

TEMPLATES = [
    {
        "id": "spec_tomato_standard",
        "crop": "Tomato",
        "name": "Standard Tomato Processing & Table Spec",
        "params": [
            {
                "name": "BRIX",
                "unit": "%",
                "min": 4.5,
                "max": None,
                "testMethod": "Refractometer",
                "adjustmentPerUnit": 7500,  # +₹75/q
            },
            {
                "name": "Firmness",
                "unit": "kg/cm2",
                "min": 3.0,
                "max": None,
                "testMethod": "Penetrometer",
                "adjustmentPerUnit": 2000,
            },
            {
                "name": "Size",
                "unit": "mm",
                "min": 55.0,
                "max": 70.0,
                "testMethod": "Caliper",
                "adjustmentPerUnit": 3000,
            },
            {
                "name": "Defect",
                "unit": "%",
                "min": None,
                "max": 5.0,
                "testMethod": "Visual/Sorting",
                "adjustmentPerUnit": -5000,
            },
        ],
        "createdBy": "system",
        "createdAt": "2026-10-01T00:00:00+00:00",
        "updatedAt": "2026-10-01T00:00:00+00:00",
    },
    {
        "id": "spec_sugarcane_standard",
        "crop": "Sugarcane",
        "name": "Standard Sugarcane Mill Procurement Spec",
        "params": [
            {
                "name": "Sucrose",
                "unit": "%",
                "min": 10.0,
                "max": None,
                "testMethod": "Polarimeter",
                "adjustmentPerUnit": 10000,
            },
            {
                "name": "Trash",
                "unit": "%",
                "min": None,
                "max": 3.0,
                "testMethod": "Manual deduction",
                "adjustmentPerUnit": -3000,
            },
            {
                "name": "Weight",
                "unit": "kg",
                "min": 1.0,
                "max": None,
                "testMethod": "Scale",
                "adjustmentPerUnit": 1500,
            },
        ],
        "createdBy": "system",
        "createdAt": "2026-10-01T00:00:00+00:00",
        "updatedAt": "2026-10-01T00:00:00+00:00",
    },
    {
        "id": "spec_wheat_standard",
        "crop": "Wheat",
        "name": "Standard Milling Wheat Spec",
        "params": [
            {
                "name": "Moisture",
                "unit": "%",
                "min": None,
                "max": 12.0,
                "testMethod": "Moisture meter",
                "adjustmentPerUnit": -2000,  # -₹20/q
            },
            {
                "name": "Foreign Matter",
                "unit": "%",
                "min": None,
                "max": 1.5,
                "testMethod": "Sieve analysis",
                "adjustmentPerUnit": -4000,
            },
            {
                "name": "Hectolitre Weight",
                "unit": "kg/hl",
                "min": 76.0,
                "max": None,
                "testMethod": "Chondrometer",
                "adjustmentPerUnit": 5000,
            },
        ],
        "createdBy": "system",
        "createdAt": "2026-10-01T00:00:00+00:00",
        "updatedAt": "2026-10-01T00:00:00+00:00",
    },
    {
        "id": "spec_onion_standard",
        "crop": "Onion",
        "name": "Standard Red Onion Mandi & Export Spec",
        "params": [
            {
                "name": "Size",
                "unit": "mm",
                "min": 50.0,
                "max": 70.0,
                "testMethod": "Grading rings",
                "adjustmentPerUnit": 3500,
            },
            {
                "name": "Rot",
                "unit": "%",
                "min": None,
                "max": 2.0,
                "testMethod": "Visual inspection",
                "adjustmentPerUnit": -8000,
            },
            {
                "name": "Moisture",
                "unit": "%",
                "min": None,
                "max": 14.0,
                "testMethod": "Moisture meter",
                "adjustmentPerUnit": -2500,
            },
        ],
        "createdBy": "system",
        "createdAt": "2026-10-01T00:00:00+00:00",
        "updatedAt": "2026-10-01T00:00:00+00:00",
    },
]


async def seed_specs() -> None:
    for spec in TEMPLATES:
        await set_doc("crop_specs", spec["id"], spec)
