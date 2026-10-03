from pydantic import BaseModel, Field


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)


class ReviewOut(ReviewIn):
    id: str
    userId: str
    userName: str
    createdAt: str
    updatedAt: str
