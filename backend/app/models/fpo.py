from pydantic import BaseModel, Field


class JoinPoolRequest(BaseModel):
    units: int = Field(ge=1)
