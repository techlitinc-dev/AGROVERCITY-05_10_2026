"""Seasonal produce + nutrition seed for the customer seasonal calendar (SR 14).

Mirrors tree_seed.py: module constants hold the canonical content and
`seed_seasonal()` writes them to Firestore only when the collection is empty.
The router always falls back to these constants when the store has no doc, so
the endpoint works on a fresh database without any seeding step.
"""
from app.core.db import query, set_doc

SEASONAL_MONTHS = [
    {
        "month": "January",
        "produce": [
            "Cauliflower", "Cabbage", "Carrot", "Beetroot", "Spinach (Palak)",
            "Fenugreek (Methi)", "Green Peas (Vatana)", "Brinjal", "Tomato",
            "Radish (Mooli)", "Guava (Peru)", "Orange (Santra)", "Custard Apple (Sitaphal)",
            "Strawberry", "Wheat", "Jowar", "Bengal Gram (Chana)", "Milk", "A2 Ghee",
        ],
    },
    {
        "month": "February",
        "produce": [
            "Cauliflower", "Cabbage", "Carrot", "Beetroot", "Spinach (Palak)",
            "Fenugreek (Methi)", "Green Peas (Vatana)", "Spring Onion", "Radish (Mooli)",
            "Watermelon", "Musk Melon (Kharbuja)", "Papaya", "Guava (Peru)",
            "Sapota (Chikoo)", "Wheat", "Jowar", "Gram", "Milk", "A2 Ghee",
        ],
    },
    {
        "month": "March",
        "produce": [
            "Mango (Early)", "Watermelon", "Musk Melon (Kharbuja)", "Papaya",
            "Cucumber", "Bottle Gourd (Dudhi)", "Ridge Gourd (Dodka)", "Lady Finger (Bhendi)",
            "Tomato", "Brinjal", "Drumstick (Shevga)", "Wheat", "Bengal Gram (Chana)",
            "Maize", "Milk", "A2 Ghee",
        ],
    },
    {
        "month": "April",
        "produce": [
            "Alphonso Mango (Hapus)", "Watermelon", "Musk Melon (Kharbuja)",
            "Jackfruit (Phanas)", "Wood Apple (Bel)", "Raw Mango (Kairi)",
            "Amla (Avla)", "Bottle Gourd (Dudhi)", "Ridge Gourd (Dodka)", "Lady Finger (Bhendi)",
            "Cucumber", "Raw Cashew", "Karvand", "Milk", "A2 Ghee",
        ],
    },
    {
        "month": "May",
        "produce": [
            "Mango (Alphonso / Kesar)", "Jackfruit (Phanas)", "Watermelon",
            "Wood Apple (Bel)", "Amla (Avla)", "Kokum", "Raw Cashew", "Bottle Gourd (Dudhi)",
            "Bitter Gourd (Karela)", "Green Chilli", "Pumpkin (Bhopla)", "Drumstick (Shevga)",
            "Milk", "A2 Ghee",
        ],
    },
    {
        "month": "June",
        "produce": [
            "Bottle Gourd (Dudhi)", "Ridge Gourd (Dodka)", "Bitter Gourd (Karela)",
            "Cucumber", "Lady Finger (Bhendi)", "Pumpkin (Bhopla)", "Colocasia Leaves (Alu)",
            "Spinach (Palak)", "Fenugreek (Methi)", "Fresh Ginger (Aad)", "Lime (Limbu)",
            "Banana (Keli)", "Papaya", "Milk", "A2 Ghee",
        ],
    },
    {
        "month": "July",
        "produce": [
            "Bitter Gourd (Karela)", "Ridge Gourd (Dodka)", "Bottle Gourd (Dudhi)",
            "Pumpkin (Bhopla)", "Cucumber", "Lady Finger (Bhendi)", "Colocasia (Alu)",
            "Cluster Beans (Gawar)", "Spinach (Palak)", "Jamun (Jambhul)", "Banana (Keli)",
            "Papaya", "Fresh Turmeric", "Lime (Limbu)", "Milk",
        ],
    },
    {
        "month": "August",
        "produce": [
            "Bottle Gourd (Dudhi)", "Pumpkin (Bhopla)", "Ridge Gourd (Dodka)",
            "Cluster Beans (Gawar)", "Flat Beans (Val Papdi)", "Lady Finger (Bhendi)",
            "Colocasia (Alu)", "Spinach (Palak)", "Fenugreek (Methi)", "Sapota (Chikoo)",
            "Banana (Keli)", "Pomegranate (Dalimb)", "Jamun (Jambhul)", "Milk", "A2 Ghee",
        ],
    },
    {
        "month": "September",
        "produce": [
            "Green Chilli", "Cluster Beans (Gawar)", "Flat Beans (Val Papdi)",
            "Ivy Gourd (Tondli)", "Pointed Gourd (Parwal)", "Brinjal", "Tomato",
            "Pomegranate (Dalimb)", "Sapota (Chikoo)", "Banana (Keli)", "Papaya",
            "Lime (Limbu)", "Milk", "A2 Ghee",
        ],
    },
    {
        "month": "October",
        "produce": [
            "Brinjal", "Tomato", "Green Chilli", "Onion (New)", "Cabbage (Early)",
            "Cauliflower (Early)", "Pomegranate (Dalimb)", "Guava (Peru)",
            "Orange (Santra)", "Grapes (New)", "Sapota (Chikoo)", "Rice (New Harvest)",
            "Maize", "Tur / Arhar Dal", "Soybean", "Milk", "A2 Ghee",
        ],
    },
    {
        "month": "November",
        "produce": [
            "Cauliflower", "Cabbage", "Carrot", "Beetroot", "Spinach (Palak)",
            "Fenugreek (Methi)", "Green Peas (Vatana)", "Radish (Mooli)", "Turnip (Shalgam)",
            "Brinjal", "Tomato", "Pomegranate (Dalimb)", "Guava (Peru)",
            "Orange (Santra)", "Sweet Lime (Mosambi)", "Grapes", "Custard Apple (Sitaphal)",
            "Wheat", "Jowar", "Tur / Arhar Dal", "Milk", "A2 Ghee",
        ],
    },
    {
        "month": "December",
        "produce": [
            "Cauliflower", "Cabbage", "Carrot", "Beetroot", "Spinach (Palak)",
            "Fenugreek (Methi)", "Green Peas (Vatana)", "Tomato", "Brinjal",
            "Guava (Peru)", "Orange (Santra)", "Sweet Lime (Mosambi)", "Grapes",
            "Strawberry", "Custard Apple (Sitaphal)", "Wheat", "Jowar",
            "Bengal Gram (Chana)", "Milk", "A2 Ghee",
        ],
    },
]

SEASONAL_GUIDES = [
    {
        "id": "guide-iron",
        "title": "Iron-Rich Foods",
        "items": [
            "Spinach (Palak)", "Fenugreek (Methi)", "Beetroot", "Jaggery (Gul)",
            "Dates (Khajur)", "Garden Cress Seeds (Halim)", "Bajra", "Pomegranate (Dalimb)",
        ],
        "note": "Pair iron-rich foods with lime or amla — vitamin C triples iron absorption from vegetarian sources.",
    },
    {
        "id": "guide-protein",
        "title": "Protein-Rich Foods",
        "items": [
            "Moong Sprouts", "Bengal Gram (Chana)", "Milk", "Curd (Dahi)", "Paneer",
            "Soybean", "Groundnut (Shengdana)", "Jowar",
        ],
        "note": "Sprouting moong for 24 hours multiplies protein quality and vitamin C — a near-complete plant protein.",
    },
    {
        "id": "guide-calcium",
        "title": "Calcium-Rich Foods",
        "items": [
            "Milk", "Curd (Dahi)", "Paneer", "Ragi (Nachni)", "Sesame Seeds (Til)",
            "Amaranth Leaves (Math)", "Jaggery (Gul)",
        ],
        "note": "Ragi and til deliver more calcium per serving than milk — rotate them into winter and festival cooking.",
    },
    {
        "id": "guide-immunity",
        "title": "Vitamin C & Immunity",
        "items": [
            "Amla (Avla)", "Orange (Santra)", "Sweet Lime (Mosambi)", "Guava (Peru)",
            "Turmeric (Haldi)", "Ginger (Aad)", "Garlic (Lasun)",
        ],
        "note": "Citrus and amla peak in winter exactly when immunity needs support; turmeric-ginger with warm milk is a proven evening tonic.",
    },
]

SEASONAL_RECIPES = [
    {
        "id": "recipe-palak-methi",
        "title": "Palak Methi Bhaji",
        "produce": ["Spinach (Palak)", "Fenugreek (Methi)", "Garlic", "Lime"],
        "steps": "Wash and chop the greens. Temper mustard, cumin and garlic in oil, sauté greens 6-8 min on high flame, finish with grated coconut or a pinch of jaggery.",
        "nutritionNote": "One of the richest vegetarian iron sources; a squeeze of lime at the table triples iron absorption.",
    },
    {
        "id": "recipe-moong-usal",
        "title": "Moong Sprout Usal",
        "produce": ["Moong Sprouts", "Onion", "Tomato", "Lime", "Coriander"],
        "steps": "Soak moong 8 hours, sprout 24 hours. Steam 10 min, then toss with chopped onion, tomato, lime, coriander and salt.",
        "nutritionNote": "~24g plant protein per bowl; sprouting multiplies vitamin C and B-vitamins and eases digestion.",
    },
    {
        "id": "recipe-bajra-rotla",
        "title": "Bajra Rotla with Lasun Chutney",
        "produce": ["Bajra", "Garlic", "Green Chilli", "Jaggery"],
        "steps": "Knead bajra flour with warm water, pat into a thick rotla and cook on a clay tawa. Serve hot with garlic-thecha and a piece of jaggery.",
        "nutritionNote": "Warm gluten-free millet, high in iron and magnesium — the classic Maharashtra winter dinner.",
    },
    {
        "id": "recipe-kanda-tomato",
        "title": "Kanda-Tomato Rassa Bhaji",
        "produce": ["Onion", "Tomato", "Green Chilli", "Brinjal"],
        "steps": "Slow-cook sliced onions till golden, add chopped tomatoes, chilli and brinjal, simmer 10 min into a rustic rassa. Serve with jowar bhakri.",
        "nutritionNote": "Cooking tomatoes concentrates lycopene (heart-protective); onion prebiotics feed gut bacteria.",
    },
    {
        "id": "recipe-gud-chikki",
        "title": "Gud-Peanut Chikki",
        "produce": ["Jaggery (Gul)", "Groundnut (Shengdana)", "A2 Ghee"],
        "steps": "Melt jaggery with a spoon of A2 ghee, fold in roasted peanuts, spread on a greased tray and cut while still warm.",
        "nutritionNote": "Energy-dense winter snack: iron from jaggery plus protein and good fats from groundnuts.",
    },
]

SEASONAL_DEFAULT_DOC = {
    "id": "default",
    "months": SEASONAL_MONTHS,
    "guides": SEASONAL_GUIDES,
    "recipes": SEASONAL_RECIPES,
}


async def seed_seasonal():
    """Seed the customer seasonal calendar only when the collection is empty."""
    if not await query("customer_seasonal", [], limit=1):
        await set_doc("customer_seasonal", "default", SEASONAL_DEFAULT_DOC)
