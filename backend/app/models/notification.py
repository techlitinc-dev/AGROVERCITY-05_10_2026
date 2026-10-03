from pydantic import BaseModel, Field


class NotificationCreate(BaseModel):
    userId: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=2000)
    type: str = Field(default="general", min_length=1, max_length=50)
