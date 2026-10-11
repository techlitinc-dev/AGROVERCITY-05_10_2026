"""Land-listing quality AI (suggest level).

Scores completeness and the rent band of a lease listing via
`land.listing_quality.v1`; the village-lease stats that feed the state stay in
the router (plain queries). Failures degrade to no assessment — the listing
write is never blocked.
"""
from app.services.ai import gateway

LAND_LISTING_QUALITY_MODULE = "land_listing_quality"
LAND_LISTING_QUALITY_QUESTION_SET = "land.listing_quality.v1"


async def assess_listing_quality(state: dict, landlord_id: str) -> dict | None:
    """Returns the qualityAssessment dict, or None when the model is off or
    returns no usable answer."""
    decision = await gateway.decide(
        state,
        LAND_LISTING_QUALITY_QUESTION_SET,
        ctx=landlord_id,
        module=LAND_LISTING_QUALITY_MODULE,
    )
    if not (decision and decision.answers):
        return None
    return {
        "completeness": float(decision.answers.get("completeness", 0.8)),
        "rentBandOk": bool(decision.answers.get("rent_band_ok", True)),
        "tips": decision.answers.get("tips", []),
        "bandSource": decision.answers.get("band_source", "district_benchmark_default"),
    }
