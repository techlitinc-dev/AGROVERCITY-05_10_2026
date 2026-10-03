from typing import Literal

from pydantic import BaseModel


class TransportRoleProfile(BaseModel):
    vehicleType: str = "Tata Ace"
    rcNumber: str = ""
    businessName: str = ""
    transporterType: str = "owner_driver"  # "owner_driver", "fleet_owner", "logistics_partner"
    contactPhone: str = ""
    gstin: str | None = None
    panNumber: str | None = None
    transportLicense: str | None = None
    operatingRoutes: list[str] = []
    operatingStates: list[str] = []
    specializations: list[str] = []
    fleetSize: int = 1
    experienceYears: int = 1
    emergencyAvailable: bool = True
    settlementUpi: str | None = None


class SellerRoleProfile(BaseModel):
    shopName: str
    gstNumber: str | None = None
    apmcLicense: str | None = None


class FarmLandlordRoleProfile(BaseModel):
    totalLandAcres: float


class BrokerRoleProfile(BaseModel):
    marketsServed: list[str]


class EquipmentRentalRoleProfile(BaseModel):
    machineType: str
    machineCount: int = 1


class InstructorRoleProfile(BaseModel):
    expertise: list[str]
    qualification: str = ""


class DairyManagerRoleProfile(BaseModel):
    centerName: str = "श्री गणेश डेअरी व गोसेवा"
    licenseNumber: str = ""
    dailyCapacityLiters: float = 1000.0
    isGaushalaOperator: bool = True
    isVetPractitioner: bool = True


class CustomerRoleProfile(BaseModel):
    interests: list[str] = []
    preferredCategories: list[str] = []


class DirectBuyerRoleProfile(BaseModel):
    companyName: str
    buyerType: Literal["retailer", "wholesaler", "processor", "exporter", "hotel", "institutional"]
    gstin: str = ""
    licenseNo: str = ""
    capacityPerMonth: int = 0
    categories: list[str] = []
    operatingStates: list[str] = []
    creditTermsDays: int = 0


class BankManagerRoleProfile(BaseModel):
    bankName: str | None = None
    branch: str | None = None
    employeeId: str | None = None


ROLE_PROFILE_MODELS: dict[str, type[BaseModel]] = {
    "transport": TransportRoleProfile,
    "seller": SellerRoleProfile,
    "farmLandlord": FarmLandlordRoleProfile,
    "broker": BrokerRoleProfile,
    "equipmentRental": EquipmentRentalRoleProfile,
    "instructor": InstructorRoleProfile,
    "dairyManager": DairyManagerRoleProfile,
    "customer": CustomerRoleProfile,
    "directBuyer": DirectBuyerRoleProfile,
    "bankManager": BankManagerRoleProfile,
}
