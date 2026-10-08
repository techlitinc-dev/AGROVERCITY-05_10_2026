"""FAQ CMS (WS-05 F20) — public published list + admin CRUD on `faq_articles`."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.core.db import delete_doc, get_doc, set_doc
from app.core.deps import admin_action
from app.core.pagination import fetch_page
from app.services import idempotency

router = APIRouter(prefix="/faq", tags=["faq"])


class FaqIn(BaseModel):
    category: str
    lang: str
    title: str
    body: str
    status: str = "draft"


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


@router.get("")
async def list_faq(
    category: str | None = None,
    lang: str | None = None,
    cursor: str | None = None,
    limit: int = 20,
):
    filters = [("status", "==", "published")]
    if category:
        filters.append(("category", "==", category))
    if lang:
        filters.append(("lang", "==", lang))
    page = await fetch_page(
        "faq_articles",
        filters,
        order_field="createdAt",
        descending=True,
        cursor=cursor,
        page_size=limit,
    )
    return {"data": page["items"], "nextCursor": page["nextCursor"]}


@router.post("", status_code=201)
async def create_faq(
    body: FaqIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    user: dict = Depends(admin_action("FAQ_CREATE")),
):
    stored = await idempotency.replay("faq.create", idempotency_key)
    if stored is not None:
        return stored
    doc = {
        "id": f"faq_{uuid.uuid4().hex[:12]}",
        **body.model_dump(),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("faq_articles", doc["id"], doc)
    if idempotency_key:
        await idempotency.store("faq.create", idempotency_key, doc)
    return doc


@router.put("/{article_id}")
async def update_faq(
    article_id: str,
    body: FaqIn,
    user: dict = Depends(admin_action("FAQ_UPDATE")),
):
    doc = await get_doc("faq_articles", article_id)
    if doc is None:
        _error(404, "FAQ_NOT_FOUND", "article not found")
    doc.update(body.model_dump())
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("faq_articles", article_id, doc)
    return doc


@router.delete("/{article_id}", status_code=204)
async def delete_faq(article_id: str, user: dict = Depends(admin_action("FAQ_DELETE"))):
    if await get_doc("faq_articles", article_id) is None:
        _error(404, "FAQ_NOT_FOUND", "article not found")
    await delete_doc("faq_articles", article_id)
