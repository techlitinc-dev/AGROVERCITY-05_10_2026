from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.db import get_doc, set_doc
from app.models.app_config import AppConfigOut
from app.services.admin_auth import admin_mutation_context, current_admin_user
from app.services.audit import log_admin_action

router = APIRouter(tags=["app-config"])

_VEGGIE_BOX_DOC = "veggie_box"


def _version_tuple(v: str) -> tuple[int, ...]:
    parts = []
    for p in v.split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(0)
    return tuple(parts)


@router.get("/app-config", response_model=AppConfigOut)
async def get_app_config(version: str | None = None, platform: str | None = None):
    doc = await get_doc("app_config", "current")
    if doc is None:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "APP_CONFIG_MISSING",
                    "message": "app config not found",
                    "fieldErrors": {},
                }
            },
        )
    if version:
        force_update = _version_tuple(version) < _version_tuple(doc["minSupportedVersion"])
    else:
        force_update = doc["forceUpdate"]
    return AppConfigOut(
        minSupportedVersion=doc["minSupportedVersion"],
        forceUpdate=force_update,
        featureFlags=doc["featureFlags"],
        maintenanceMode=doc["maintenanceMode"],
    )


# ---------------------------------------------------------------------------
# Admin feature toggles
# ---------------------------------------------------------------------------


class VeggieBoxConfigIn(BaseModel):
    enabled: bool


@router.get("/admin/app-config/veggie-box")
async def get_veggie_box_config(user: dict = Depends(current_admin_user)):
    """Customer veggie-box subscription feature toggle. Defaults to enabled."""
    doc = await get_doc("app_config", _VEGGIE_BOX_DOC) or {}
    return {
        "id": _VEGGIE_BOX_DOC,
        "enabled": doc.get("enabled", True),
        "updatedAt": doc.get("updatedAt"),
        "updatedBy": doc.get("updatedBy"),
    }


@router.put("/admin/app-config/veggie-box")
async def update_veggie_box_config(
    body: VeggieBoxConfigIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Flip the veggie-box toggle. Mutating admin action — audited per rule 8."""
    existing = await get_doc("app_config", _VEGGIE_BOX_DOC) or {}
    new_cfg = {
        **existing,
        "id": _VEGGIE_BOX_DOC,
        "enabled": body.enabled,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "updatedBy": ctx["admin"].get("id"),
    }
    await set_doc("app_config", _VEGGIE_BOX_DOC, new_cfg)
    await log_admin_action(
        ctx["admin"], "app-config", "veggie_box.config.update", _VEGGIE_BOX_DOC,
        existing, new_cfg, ctx["reason"], ctx["ip"],
    )
    return new_cfg
