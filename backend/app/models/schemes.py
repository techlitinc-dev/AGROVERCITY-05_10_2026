from pydantic import BaseModel


class GovtScheme(BaseModel):
    id: str
    name: str
    category: str
    eligible: bool
    benefitAmount: str
    documentsRequired: list[str]
    status: str
    nextDeadline: str
    description: str


class SchemeApplyIn(BaseModel):
    documentIds: list[str] = []


class SchemeApplyOut(BaseModel):
    applicationId: str
    status: str


class PortalEntry(BaseModel):
    schemeId: str
    portalUrl: str
