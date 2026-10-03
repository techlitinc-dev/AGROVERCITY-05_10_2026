from pydantic import BaseModel


class LandRecord712(BaseModel):
    id: str
    gatNumber: str
    village: str
    district: str
    ownerName: str
    khataNumber: str
    totalAreaHectares: float
    totalAreaAcres: float
    landClass: str
    ferfarNumber: str
    cropHistory: str
