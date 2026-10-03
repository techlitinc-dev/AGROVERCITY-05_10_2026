from pydantic import BaseModel, Field


class PaidWorkshop(BaseModel):
    id: str
    title: str
    instructor: str
    instructorRole: str
    institution: str
    feeRupees: float
    coinsDiscountAllowed: int
    duration: str
    batchDate: str
    timing: str
    rating: float
    enrolledCount: int
    totalSeats: int
    isCertified: bool
    certificateTitle: str
    syllabusModules: list[str]
    deliverables: list[str]
    isEnrolled: bool = False


class EnrollIn(BaseModel):
    useCoins: bool = False
    coinsToRedeem: int = 0


class ExpertTalk(BaseModel):
    id: str
    expertName: str
    institution: str
    topic: str
    scheduledTime: str
    isLive: bool
    registeredCount: int
    description: str


class QuestionIn(BaseModel):
    question: str = Field(min_length=5, max_length=500)


class VideoGuide(BaseModel):
    id: str
    title: str
    instructor: str
    duration: str
    views: str
    category: str
    videoUrl: str
    summary: str
    keyPoints: list[str]


class BlogArticle(BaseModel):
    id: str
    title: str
    author: str
    authorRole: str
    readTimeMinutes: str
    category: str
    summary: str
    content: str
    publishedDate: str
    likesCount: int
    isBookmarked: bool = False
