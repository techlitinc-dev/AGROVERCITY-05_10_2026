from typing import Literal

from pydantic import BaseModel, Field, field_validator


class RatingIn(BaseModel):
    # course_enrollment / lot_sale / lot_purchase resolve through WS-03 rating
    # prompts; vet_booking is the mobile-side alias of vet.
    bookingKind: Literal[
        "transport",
        "vet",
        "vet_booking",
        "equipment",
        "deal",
        "nursery",
        "marketplace_order",
        "course_enrollment",
        "lot_sale",
        "lot_purchase",
    ]
    bookingId: str
    stars: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)
    # two-sided deal ratings (WS-05 step 8): which party is being rated —
    # required when bookingKind == "deal".
    targetRole: Literal["broker", "farmer"] | None = None
    # short review tags, e.g. ["fair_price", "on_time"] — stored as-is.
    tags: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("tags")
    @classmethod
    def _tag_shape(cls, tags: list[str]) -> list[str]:
        for tag in tags:
            if not 2 <= len(tag) <= 24:
                raise ValueError("each tag must be 2-24 characters")
        return tags


class RatingOut(RatingIn):
    id: str
    providerId: str
    createdAt: str
