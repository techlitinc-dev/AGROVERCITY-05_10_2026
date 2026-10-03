import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.data.schemes_seed import PORTALS
from app.models.schemes import PortalEntry, SchemeApplyIn, SchemeApplyOut
from app.routers.users import require_role
from app.services.eligibility import is_eligible
from app.services.users import get_user

router = APIRouter(prefix="/schemes", tags=["schemes"])


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def _user(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "farmLandlord")
    return user


def _public(scheme: dict, user: dict) -> dict:
    return {
        "id": scheme["id"],
        "name": scheme["name"],
        "category": scheme["category"],
        "eligible": is_eligible(user, scheme.get("eligibilityRules") or {}),
        "benefitAmount": scheme["benefitAmount"],
        "documentsRequired": scheme.get("documentsRequired", []),
        "status": scheme["status"],
        "nextDeadline": scheme["nextDeadline"],
        "description": scheme["description"],
    }


@router.get("")
async def list_schemes(
    category: str | None = None,
    eligibleOnly: bool = False,
    user: dict = Depends(_user),
):
    schemes = await query("schemes", [], limit=200)
    items = [_public(s, user) for s in schemes]
    if category:
        items = [s for s in items if s["category"] == category]
    if eligibleOnly:
        items = [s for s in items if s["eligible"]]
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


@router.get("/portals")
async def list_portals(user: dict = Depends(_user)):
    return {"data": [PortalEntry(**p).model_dump() for p in PORTALS]}


@router.post("/{scheme_id}/apply", status_code=201, response_model=SchemeApplyOut)
async def apply_scheme(scheme_id: str, body: SchemeApplyIn, user: dict = Depends(_user)):
    scheme = await get_doc("schemes", scheme_id)
    if scheme is None:
        _error(404, "SCHEME_NOT_FOUND", "scheme not found")
    uid = user["id"]
    existing = await get_doc(f"users/{uid}/scheme_applications", scheme_id)
    if existing is not None:
        _error(409, "ALREADY_APPLIED", "पहले से आवेदन किया हुआ")
    if not is_eligible(user, scheme.get("eligibilityRules") or {}):
        _error(403, "NOT_ELIGIBLE", "आप इस योजना के लिए पात्र नहीं हैं")
    for doc_id in body.documentIds:
        if await get_doc(f"users/{uid}/vault_documents", doc_id) is None:
            _error(400, "INVALID_DOCUMENT_ID", "document not found in vault")
    application = {
        "id": uuid.uuid4().hex,
        "applicationId": scheme_id,
        "status": "submitted",
        "documentIds": body.documentIds,
        "submittedAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(f"users/{uid}/scheme_applications", scheme_id, application)
    return SchemeApplyOut(applicationId=scheme_id, status="submitted")
