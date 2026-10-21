"""Seed dedicated Superadmin RBAC accounts in Firestore users collection."""
from app.core.firebase import init_firebase
from app.core.db import get_doc, set_doc
from app.core.security import hash_mpin

ADMIN_USERS = [
    {
        "id": "admin-super",
        "name": "Super Admin Root",
        "phone": "+919000000001",
        "email": "superadmin@agrovercity.in",
        "adminRole": "superadmin",
        "isAdmin": True,
        "activeProfile": "admin",
        "primaryProfile": "admin",
        "status": "active",
        "language": "en",
        "preferredLanguage": "en",
    },
    {
        "id": "admin-ops",
        "name": "Vikram Shinde (Operations Lead)",
        "phone": "+919000000002",
        "email": "operations@agrovercity.in",
        "adminRole": "operations_lead",
        "isAdmin": True,
        "activeProfile": "admin",
        "primaryProfile": "admin",
        "status": "active",
        "language": "en",
        "preferredLanguage": "en",
    },
    {
        "id": "admin-finance",
        "name": "Ramesh Kulkarni (Finance Admin)",
        "phone": "+919000000003",
        "email": "finance@agrovercity.in",
        "adminRole": "finance_admin",
        "isAdmin": True,
        "activeProfile": "admin",
        "primaryProfile": "admin",
        "status": "active",
        "language": "en",
        "preferredLanguage": "en",
    },
    {
        "id": "admin-compliance",
        "name": "Pooja Deshmukh (Compliance Officer)",
        "phone": "+919000000004",
        "email": "compliance@agrovercity.in",
        "adminRole": "compliance_officer",
        "isAdmin": True,
        "activeProfile": "admin",
        "primaryProfile": "admin",
        "status": "active",
        "language": "en",
        "preferredLanguage": "en",
    },
    {
        "id": "admin-agronomy",
        "name": "Dr. Arvind Joshi (Chief Agronomist)",
        "phone": "+919000000005",
        "email": "agronomist@agrovercity.in",
        "adminRole": "agronomist",
        "isAdmin": True,
        "activeProfile": "admin",
        "primaryProfile": "admin",
        "status": "active",
        "language": "en",
        "preferredLanguage": "en",
    },
    {
        "id": "admin-moderator",
        "name": "Sunita Patil (Content & Grievances)",
        "phone": "+919000000006",
        "email": "moderation@agrovercity.in",
        "adminRole": "content_moderator",
        "isAdmin": True,
        "activeProfile": "admin",
        "primaryProfile": "admin",
        "status": "active",
        "language": "en",
        "preferredLanguage": "en",
    },
]

async def seed_superadmin():
    try:
        init_firebase()
        hashed_1234 = hash_mpin("1234")
        
        root_doc = await get_doc("users", "admin-root")
        if root_doc:
            root_doc["adminRole"] = "superadmin"
            root_doc["isAdmin"] = True
            root_doc["mpinHash"] = hashed_1234
            await set_doc("users", "admin-root", root_doc)

        for u in ADMIN_USERS:
            doc = await get_doc("users", u["id"])
            if not doc:
                doc = {}
            doc.update({
                "id": u["id"],
                "name": u["name"],
                "phone": u["phone"],
                "email": u["email"],
                "adminRole": u["adminRole"],
                "isAdmin": u["isAdmin"],
                "activeProfile": u["activeProfile"],
                "primaryProfile": u["primaryProfile"],
                "status": u["status"],
                "language": u["language"],
                "preferredLanguage": u["preferredLanguage"],
                "mpinHash": hashed_1234,
            })
            await set_doc("users", u["id"], doc)
    except Exception as e:
        print(f"Warning: seed_superadmin error: {e}")
