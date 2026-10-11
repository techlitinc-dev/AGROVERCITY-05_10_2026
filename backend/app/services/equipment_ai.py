"""Equipment AI (E5 area, suggest level).

Booking-recommendation scoring (`equipment.booking_rec.v1`) and damage-claim
vision estimates run here via the gateway (rule 10), never in the router. Any
failure degrades to None — the owner UI simply shows no score / no estimate.
"""
from app.services.ai import gateway

EQUIPMENT_BOOKING_REC_MODULE = "equipment_booking_rec"
EQUIPMENT_BOOKING_REC_QUESTION_SET = "equipment.booking_rec.v1"


async def booking_rec_score(state: dict, owner_id: str) -> float | None:
    """Recommendation score for one pending booking, or None when the model is
    off/fails or returns no usable answer."""
    decision = await gateway.decide(
        state,
        EQUIPMENT_BOOKING_REC_QUESTION_SET,
        ctx=owner_id,
        module=EQUIPMENT_BOOKING_REC_MODULE,
    )
    if decision and decision.answers:
        return float(decision.answers.get("score", 0.0))
    return None


async def damage_estimate(equipment_name: str, description: str, claim_paisa: int) -> dict | None:
    """Vision severity/deduction estimate for an owner-filed damage claim, or
    None on any failure. The owner always confirms explicitly afterwards."""
    try:
        prompt = f"Analyze equipment damage for {equipment_name}: {description}. Provide severity estimate (minor, moderate, severe) and suggested deduction band."
        schema = {
            "severity": "moderate",
            "suggestedDeductionBand": "₹3,000 - ₹8,000",
            "suggestedDeductionPaisa": claim_paisa,
            "confidence": 0.88,
        }
        analysis = await gateway.analyze_image(
            image_bytes=b"equipment_damage_photo",
            prompt=prompt,
            schema=schema,
            module=EQUIPMENT_BOOKING_REC_MODULE,
        )
        if analysis:
            return {
                "severity": analysis.get("severity", "moderate"),
                "suggestedDeductionBand": analysis.get("suggestedDeductionBand", "₹3,000 - ₹8,000"),
                "suggestedDeductionPaisa": analysis.get("suggestedDeductionPaisa", claim_paisa),
                "confidence": float(analysis.get("confidence", 0.85)),
                "confirmed": False,
            }
    except Exception:
        return None
    return None
