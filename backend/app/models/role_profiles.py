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
    serviceRadiusKm: int = 0
    products: list[str] = []


class MilkSellerRoleProfile(BaseModel):
    businessName: str = ""
    deliveryArea: str = ""
    milkTypesSold: list[str] = []
    avgDailyLiters: float = 0.0
    homeDelivery: bool = True
    shopSales: bool = False
    settlementUpi: str | None = None


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
    serviceRadiusKm: int = 0
    capacityPerDay: float = 0.0
    products: list[str] = []
    serviceAreaAddress: str = ""


class ExporterRoleProfile(BaseModel):
    companyName: str
    iecNumber: str
    gstNumber: str | None = None
    apedaCertificateNo: str | None = None
    exportMarkets: list[str] = []
    preferredCrops: list[str] = []
    portOfExport: str | None = None


class BankManagerRoleProfile(BaseModel):
    bankName: str | None = None
    branch: str | None = None
    employeeId: str | None = None


ROLE_PROFILE_MODELS: dict[str, type[BaseModel]] = {
    "transport": TransportRoleProfile,
    "transporter": TransportRoleProfile,
    "seller": SellerRoleProfile,
    "farmLandlord": FarmLandlordRoleProfile,
    "landlord": FarmLandlordRoleProfile,
    "farm landlord": FarmLandlordRoleProfile,
    "broker": BrokerRoleProfile,
    "equipmentRental": EquipmentRentalRoleProfile,
    "equipmentOwner": EquipmentRentalRoleProfile,
    "instructor": InstructorRoleProfile,
    "dairyManager": DairyManagerRoleProfile,
    "milkSeller": MilkSellerRoleProfile,
    "customer": CustomerRoleProfile,
    "directBuyer": DirectBuyerRoleProfile,
    "exporter": ExporterRoleProfile,
    "bankManager": BankManagerRoleProfile,
}
