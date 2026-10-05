from pydantic import BaseModel, Field


class SpecParam(BaseModel):
    name: str
    unit: str = ""
    min: float | None = None
    max: float | None = None
    testMethod: str = ""
    adjustmentPerUnit: int = 0  # ₹/unit premium(+)/deduction(-) in integer paisa


class CropSpecCreate(BaseModel):
    crop: str
    name: str
    params: list[SpecParam] = Field(default_factory=list)


class CropSpec(BaseModel):
    id: str
    crop: str
    name: str
    params: list[SpecParam] = Field(default_factory=list)
    createdBy: str
    createdAt: str = ""
    updatedAt: str = ""
