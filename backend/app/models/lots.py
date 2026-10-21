from typing import Any
from pydantic import BaseModel


class LotRequest(BaseModel):
    crop: str
    quantityQuintals: float | None = None
    quantityQuintal: float | None = None
    expectedRate: int | None = None
    expectedPricePerQuintal: int | None = None
    variety: str | None = None
    grade: str | None = "A"
    harvestDate: str | None = None
    photos: list[str] = []
    location: Any = None
    lat: float | None = None
    lng: float | None = None
    village: str | None = None
    # Create the lot straight into the admin review queue.
    submitForReview: bool = False


class LotOut(BaseModel):
    id: str
    farmerId: str
    crop: str
    variety: str | None = None
    grade: str | None = "A"
    quantityQuintals: float = 0.0
    quantityQuintal: float = 0.0
    expectedRate: int = 0
    expectedPricePerQuintal: int = 0
    harvestDate: str | None = None
    photos: list[str] = []
    location: Any = None
    lat: float | None = None
    lng: float | None = None
    village: str | None = None
    status: str = "open"
    createdAt: str
