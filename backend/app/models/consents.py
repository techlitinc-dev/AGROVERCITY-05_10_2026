from pydantic import BaseModel


class ConsentsIn(BaseModel):
    dataSharing: bool
    location: bool
    marketing: bool


class ConsentsOut(ConsentsIn):
    updatedAt: str
