from typing import Literal

from pydantic import BaseModel, Field


class SoilTestBookIn(BaseModel):
    plotId: str | None = None
    address: str = Field(min_length=10)
    slot: str = Field(pattern=r"^\d{4}-\d{2}-\d{2} (am|pm)$")


class SoilTestOut(SoilTestBookIn):
    id: str
    status: Literal["booked", "sampleCollected", "reportReady"]
    resultPdfUrl: str | None = None
    bookedAt: str
