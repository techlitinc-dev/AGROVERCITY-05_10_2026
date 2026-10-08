"""M33 district-crop reference (phase-08 WS-01).

The 8-district region-crop mapping the spec ships is extended by an AI proposal
job, but proposals are written ONLY as `status: "pending"` rows for admin review:
AI proposes, admin disposes (never serve raw Gemini output — rule 10/AI safety).
Only `status: "active"` rows are served to users.
"""
import json
import logging
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.data.district_crops import DISTRICT_CROPS
from app.services.ai import gateway

log = logging.getLogger(__name__)

COLLECTION = "district_crops"
MODULE = "onboarding_copilot"


class DistrictCropProposal(BaseModel):
    district: str = Field(min_length=1)
    crops: list[str] = Field(default_factory=list)
    reasoning: str = ""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_active_crops(district: str) -> dict:
    """Active curated crops for a district (raw AI proposals never served)."""
    key = str(district or "").strip().lower()
    if not key:
        return {"district": district, "crops": [], "status": "none"}
    docs = await query(COLLECTION, [("district", "==", key)], limit=20)
    active = next((d for d in docs if d.get("status") == "active"), None)
    if active is None:
        return {"district": district, "crops": [], "status": "none"}
    return {"district": district, "crops": list(active.get("crops") or []), "status": "active"}


async def upsert_curated(district: str, crops: list[str], updated_by: str, *, status: str = "active") -> dict:
    """Admin write: create/replace the curated row for a district."""
    key = str(district or "").strip().lower()
    doc = {
        "district": key,
        "crops": list(crops or []),
        "source": "curated",
        "status": status,
        "updatedBy": updated_by,
        "updatedAt": _now(),
    }
    await set_doc(COLLECTION, key, doc)
    return doc


async def set_status(district: str, status: str) -> dict:
    key = str(district or "").strip().lower()
    doc = await get_doc(COLLECTION, key)
    if doc is None:
        raise ValueError("district not found")
    doc["status"] = status
    doc["updatedAt"] = _now()
    await set_doc(COLLECTION, key, doc)
    return doc


def _parse_proposal(text: str, district: str) -> DistrictCropProposal | None:
    try:
        payload = json.loads(text)
    except (TypeError, ValueError):
        return None
    if isinstance(payload, list):
        payload = {"district": district, "crops": payload}
    if not isinstance(payload, dict):
        return None
    payload.setdefault("district", district)
    try:
        return DistrictCropProposal(**payload)
    except Exception:  # noqa: BLE001 — invalid proposal is dropped, never served
        return None


async def propose_district_crops() -> dict:
    """Propose crops for districts beyond the spec's 8-district mapping.

    Writes ONLY `status: "pending"`, `source: "ai_proposed"` rows. One repair
    retry per district; unparseable output is skipped.
    """
    known = set(DISTRICT_CROPS.keys())
    users = await query("users", limit=5000)
    candidate = sorted(
        {
            str(u.get("district") or "").strip().lower()
            for u in users
            if str(u.get("district") or "").strip()
        }
        - known
    )
    proposed = 0
    for district in candidate:
        prompt = (
            "You are an agro-climatic advisor. Given the Indian district "
            f"'{district}', list the 3-5 most suitable kharif and rabi crops as JSON "
            '{"district": "...", "crops": ["..."], "reasoning": "..."} using soil, '
            "rainfall, and irrigation context. Return JSON only."
        )
        schema = {
            "type": "object",
            "properties": {
                "district": {"type": "string"},
                "crops": {"type": "array", "items": {"type": "string"}},
                "reasoning": {"type": "string"},
            },
            "required": ["district", "crops"],
        }
        text = await gateway.generate(prompt, {"module": MODULE, "json_schema": schema})
        parsed = _parse_proposal(text, district)
        if parsed is None:
            # One repair retry with an explicit JSON-only instruction.
            text = await gateway.generate(
                f"Return ONLY valid JSON for district {district}: "
                '{"district": "...", "crops": ["..."]}',
                {"module": MODULE, "json_schema": schema},
            )
            parsed = _parse_proposal(text, district)
        if parsed is None or not parsed.crops:
            continue
        await set_doc(
            COLLECTION,
            district,
            {
                "district": district,
                "crops": parsed.crops,
                "source": "ai_proposed",
                "status": "pending",
                "reasoning": parsed.reasoning,
                "updatedBy": "ai",
                "updatedAt": _now(),
            },
        )
        proposed += 1
    return {"proposed": proposed, "candidates": len(candidate)}
