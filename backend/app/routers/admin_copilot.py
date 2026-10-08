"""Admin copilot endpoints (phase-07 WS-07, brief M31).

Read-only natural-language ops queries + the nightly briefing. Every query is
audit-logged; the AI call itself is logged to `ai_decisions` by the gateway.
"""
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.db import get_doc
from app.services import copilot
from app.services.admin_auth import current_admin_user
from app.services.audit import log_admin_action

router = APIRouter(prefix="/admin", tags=["admin-copilot"])


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code, detail={"code": code, "message": message, "fieldErrors": {}}
    )


class QueryIn(BaseModel):
    prompt: str = Field(..., min_length=3)


@router.post("/copilot/query")
async def copilot_query(
    body: QueryIn,
    user: dict = Depends(current_admin_user),
    x_audit_reason: str | None = Header(None, alias="X-Audit-Reason"),
):
    result = await copilot.answer_query(body.prompt, role=user.get("adminRole") or "")
    await log_admin_action(
        user,
        "copilot",
        "query",
        result.get("tool") or "none",
        None,
        {"prompt": body.prompt, "tool": result.get("tool"), "dataSource": result.get("dataSource")},
        x_audit_reason or "copilot query",
        None,
    )
    return result


@router.get("/copilot/briefing")
async def copilot_briefing(user: dict = Depends(current_admin_user)):
    doc = await get_doc("admin_briefings", "latest")
    if doc is None:
        _error(404, "NOT_FOUND", "no briefing has been generated yet")
    return doc
