from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class DiaryEntryIn(BaseModel):
    title: str
    category: str
    type: Literal["expense", "income", "farmActivity"]
    amount: float = 0
    date: str
    cropName: str | None = None
    notes: str | None = None
    photos: list[str] = Field(default_factory=list)
    quantity: float | None = None
    unit: str | None = None
    party: str = ""  # counterparty — who paid / who was paid (accounting-grade)


class DiaryEntryOut(DiaryEntryIn):
    id: str
    createdAt: str
    updatedAt: str


class DiaryEntryCreated(BaseModel):
    entry: DiaryEntryOut
    agriCoinsEarned: int


class DiaryTotals(BaseModel):
    income: float
    expense: float
    net: float
    entryCount: int
    incomeCount: int
    expenseCount: int
    activityCount: int


class DiaryCategorySummary(BaseModel):
    category: str
    type: str
    amount: float
    count: int


class DiaryCropSummary(BaseModel):
    cropName: str
    income: float
    expense: float
    net: float
    count: int


class DiaryMonthSummary(BaseModel):
    month: str
    income: float
    expense: float
    net: float
    count: int


class DiaryDaySummary(BaseModel):
    date: str
    income: float
    expense: float
    count: int


class DiaryAnalyticsOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_: str | None = Field(default=None, alias="from")
    to: str | None = None
    totals: DiaryTotals
    byCategory: list[DiaryCategorySummary]
    byCrop: list[DiaryCropSummary]
    byMonth: list[DiaryMonthSummary]
    byDay: list[DiaryDaySummary]


class DiaryPhotoUploadOut(BaseModel):
    photoUrls: list[str]
