from pydantic import BaseModel


class LotRequest(BaseModel):
    crop: str
    quantityQuintals: float
    expectedRate: int
    harvestDate: str
    photos: list[str] = []
    location: dict


class LotOut(LotRequest):
    id: str
    farmerId: str
    status: str
    createdAt: str
