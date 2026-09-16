from pydantic import BaseModel


class TransportRoleProfile(BaseModel):
    vehicleType: str
    rcNumber: str


class SellerRoleProfile(BaseModel):
    shopName: str
    gstNumber: str | None = None
    apmcLicense: str | None = None


class FarmLandlordRoleProfile(BaseModel):
    totalLandAcres: float


class BrokerRoleProfile(BaseModel):
    marketsServed: list[str]


ROLE_PROFILE_MODELS: dict[str, type[BaseModel]] = {
    "transport": TransportRoleProfile,
    "seller": SellerRoleProfile,
    "farmLandlord": FarmLandlordRoleProfile,
    "broker": BrokerRoleProfile,
}
