from pydantic import BaseModel


class AddressRequest(BaseModel):
    label: str
    line1: str
    village: str
    district: str
    state: str
    pincode: str
    lat: float | None = None
    lng: float | None = None
    isDefault: bool = False
