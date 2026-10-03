from typing import Literal

from pydantic import BaseModel


class SettlementOut(BaseModel):
    id: str
    role: Literal["transport", "equipmentRental", "broker"]
    entityId: str
    periodStart: str
    periodEnd: str
    grossRupees: int
    commissionRupees: int
    netRupees: int
    status: Literal["pending", "approved", "paid"]
    sourceIds: list[str]
    createdAt: str


class SettlementRunIn(BaseModel):
    periodStart: str | None = None
    periodEnd: str | None = None
