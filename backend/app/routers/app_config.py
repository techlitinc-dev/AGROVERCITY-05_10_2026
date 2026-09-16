from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.db import get_doc
from app.models.app_config import AppConfigOut

router = APIRouter(tags=["app-config"])


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
