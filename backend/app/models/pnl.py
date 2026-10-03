from pydantic import BaseModel, Field


class ExpenseBreakdown(BaseModel):
    category: str
    amount: float


class CropPandL(BaseModel):
    id: str
    name: str
    season: str
    area: float
    yieldQuintals: float
    marketAvgRate: float
    grossRevenue: float
    totalExpenses: float
    netProfit: float
    roiPercent: float
    expensesBreakdown: list[ExpenseBreakdown]


class PnlSummary(BaseModel):
    grossIncome: float
    productionCost: float
    netProfit: float


class ExpenseIn(BaseModel):
    category: str
    amount: float = Field(gt=0)


class BreakEvenIn(BaseModel):
    totalCost: float = Field(gt=0)
    expectedYieldQuintals: float = Field(gt=0)


class BreakEvenOut(BaseModel):
    minSafePricePerQuintal: float
