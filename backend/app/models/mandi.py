from pydantic import BaseModel


class MandiPriceOut(BaseModel):
    id: str
    mandiName: str
    distanceKm: float
    commodity: str
    variety: str
    minPrice: float
    maxPrice: float
    modalPrice: float
    msp: float
    trend: str
    changePercent: str
    arrivalsQuintals: int
    updatedAt: str


class VyapariRateOut(BaseModel):
    id: str
    crop: str
    rateDisplay: str
    priceChange: str
    changeDir: str
    mandiName: str
    vyapariCount: int
    lastUpdated: str


class CompareResultItem(BaseModel):
    mandiName: str
    modalPrice: float
    transportCost: float
    netProfit: float


class SellerRateRequest(BaseModel):
    crop: str
    ratePerKg: float
    mandiName: str
