from typing import Literal

from pydantic import BaseModel, Field


class RatingIn(BaseModel):
    bookingKind: Literal["transport", "vet", "equipment", "deal"]
    bookingId: str
    stars: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)
    # two-sided deal ratings (WS-05 step 8): which party is being rated —
    # required when bookingKind == "deal".
    targetRole: Literal["broker", "farmer"] | None = None


class RatingOut(RatingIn):
    id: str
    providerId: str
    createdAt: str
