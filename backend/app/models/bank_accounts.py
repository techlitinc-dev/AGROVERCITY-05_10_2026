from typing import Literal

from pydantic import BaseModel, Field


class BankAccountIn(BaseModel):
    accountHolder: str = Field(min_length=3)
    accountNumber: str = Field(pattern=r"^\d{9,18}$")
    ifsc: str = Field(pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$")
    bankName: str


class BankAccountOut(BaseModel):
    id: str
    accountHolder: str
    accountNumberMasked: str
    ifsc: str
    bankName: str
    isPrimary: bool
    verifyStatus: Literal["unverified", "pending", "verified", "failed"]
    createdAt: str
