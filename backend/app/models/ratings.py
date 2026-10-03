from typing import Literal

from pydantic import BaseModel, Field


class RatingIn(BaseModel):
    bookingKind: Literal["transport", "vet", "equipment"]
    bookingId: str
    stars: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)


class RatingOut(RatingIn):
    id: str
    providerId: str
    createdAt: str
