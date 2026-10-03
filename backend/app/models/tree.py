from typing import Literal

from pydantic import BaseModel, Field


class TreeArticle(BaseModel):
    id: str
    title: str
    category: str
    author: str
    readTime: str
    summary: str
    fullContent: str
    benefits: str
    publishedDate: str


class NgoOrganization(BaseModel):
    id: str
    name: str
    focusArea: str
    location: str
    contactPhone: str
    email: str
    treesPlantedCount: int
    rating: float
    servicesOffered: list[str]
    providesFreeSaplings: bool
    websiteUrl: str


class SaplingRequestIn(BaseModel):
    treeType: Literal["timber", "biofuel", "fruit", "bamboo"]
    count: int = Field(ge=1, le=500)


class BiofuelTree(BaseModel):
    id: str
    name: str
    botanicalName: str
    oilContentPercent: str
    gestationPeriod: str
    expectedReturnPerAcre: str
    suitability: str
    uses: str
    buyerMarket: str
    subsidyScheme: str


class TreeCareGuide(BaseModel):
    id: str
    title: str
    stepNumber: int
    stage: str
    instructions: str
    wateringRule: str
    fertilizerSchedule: str
    pestProtection: str


class TreePlantationIn(BaseModel):
    parcelName: str = Field(min_length=2, max_length=120)
    treeSpecies: str = Field(min_length=2, max_length=100)
    vernacularSpecies: str = Field(default="", max_length=100)
    treeCount: int = Field(ge=1, le=50000)
    plantingDate: str
    landType: str = "bund"  # bund, block, agroforestry, wasteland
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    initialHeightCm: float = Field(default=30.0, ge=1.0)
    photoUrl: str = ""
    irrigationType: str = "drip"  # drip, rainfed, flood, sprinkler


class TreePlantation(BaseModel):
    id: str
    farmerId: str
    farmerName: str
    parcelName: str
    treeSpecies: str
    vernacularSpecies: str
    treeCount: int
    plantingDate: str
    landType: str
    latitude: float
    longitude: float
    initialHeightCm: float
    photoUrl: str
    irrigationType: str
    status: str = "active"
    survivalRate: float = 100.0
    currentAvgHeightCm: float = 30.0
    estimatedCo2KgPerYear: float = 0.0
    logsCount: int = 0
    createdAt: str


class PlantationLogEntryIn(BaseModel):
    heightCm: float = Field(ge=1.0)
    girthCm: float = Field(default=0.0, ge=0.0)
    survivalCount: int = Field(ge=0)
    healthStatus: str = "healthy"  # healthy, average, pest_attack, drought_stressed
    notes: str = ""
    photoUrl: str = ""
    auditDate: str = ""


class PlantationLogEntry(BaseModel):
    id: str
    plantationId: str
    heightCm: float
    girthCm: float
    survivalCount: int
    healthStatus: str
    notes: str
    photoUrl: str
    auditDate: str
    loggedAt: str


class CarbonEstimateIn(BaseModel):
    treeSpecies: str
    treeCount: int = Field(ge=1, le=100000)
    ageYears: int = Field(default=1, ge=1, le=50)


class CarbonEstimateOut(BaseModel):
    treeSpecies: str
    treeCount: int
    ageYears: int
    co2PerTreePerYearKg: float
    annualCo2Kg: float
    tenYearCo2Kg: float
    carbonCredits10Yr: float
    estimatedEarningsInr: float
    formulaExplanation: str


class AgroforestryScheme(BaseModel):
    id: str
    name: str
    vernacularName: str
    department: str
    subsidyAmount: str
    eligibility: str
    documentsRequired: list[str]
    applicationProcess: str
    portalUrl: str
    status: str = "active"


class TreeAdoption(BaseModel):
    id: str
    farmerId: str
    sponsorName: str
    csrPartner: str
    treeSpecies: str
    treesSponsored: int
    fundsGranted: int
    survivalBonusInr: int
    adoptionDate: str
    status: str = "active"


class SpeciesSuitabilityIn(BaseModel):
    soilType: str = "black_cotton"  # black_cotton, red_loamy, sandy_arid, rocky_murrum
    waterAvailability: str = "limited_drip"  # canal_borewell, limited_drip, rainfed_dryland


class SpeciesRecommendation(BaseModel):
    id: str
    name: str
    vernacularName: str
    suitabilityScore: int  # 0 to 100
    recommendedSpacing: str
    gestationYears: str
    expectedAnnualRevenue: str
    carbonPotential: str
    careSummary: str

