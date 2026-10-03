from enum import Enum
from pydantic import BaseModel, Field


class CourseKind(str, Enum):
    course_material = "courseMaterial"
    audio_podcast = "audioPodcast"
    video_podcast = "videoPodcast"
    video_course = "videoCourse"
    workshop_masterclass = "workshopMasterclass"


class CourseLevel(str, Enum):
    all_levels = "all_levels"
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"
    masterclass = "masterclass"


class LessonKind(str, Enum):
    video = "video"
    audio = "audio"
    pdf = "pdf"
    quiz = "quiz"
    text = "text"


class CourseStatus(str, Enum):
    draft = "draft"
    pending_review = "pendingReview"
    published = "published"
    rejected = "rejected"
    archived = "archived"


class LessonResource(BaseModel):
    title: str
    downloadUrl: str
    fileType: str = "pdf"


class CourseLesson(BaseModel):
    id: str
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    kind: LessonKind = LessonKind.video
    durationMinutes: int = Field(default=10, ge=1)
    mediaUrl: str | None = None
    previewUrl: str | None = None
    isPreviewFree: bool = False
    order: int = 1
    resources: list[LessonResource] = []


class CourseModule(BaseModel):
    id: str
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    order: int = 1
    lessons: list[CourseLesson] = []


class CourseCreateIn(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    subtitle: str = Field(default="", max_length=255)
    description: str = Field(default="", max_length=10000)
    kind: CourseKind = CourseKind.video_course
    level: CourseLevel = CourseLevel.beginner
    language: str = "hi"
    category: str = Field(default="General", max_length=60)
    priceRupees: float = Field(default=0, ge=0)
    originalPriceRupees: float = Field(default=0, ge=0)
    coinsDiscountAllowed: int = Field(default=0, ge=0)
    thumbnailUrl: str | None = None
    mediaUrl: str | None = None
    previewUrl: str | None = None
    promoVideoUrl: str | None = None
    whatYouWillLearn: list[str] = []
    requirements: list[str] = []
    targetAudience: list[str] = []
    certificateEnabled: bool = True
    certificateTitle: str = ""
    modules: list[CourseModule] = []
    tags: list[str] = []
    autoPublish: bool = False


class CourseUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=140)
    subtitle: str | None = None
    description: str | None = None
    kind: CourseKind | None = None
    level: CourseLevel | None = None
    language: str | None = None
    category: str | None = None
    priceRupees: float | None = Field(default=None, ge=0)
    originalPriceRupees: float | None = Field(default=None, ge=0)
    coinsDiscountAllowed: int | None = Field(default=None, ge=0)
    thumbnailUrl: str | None = None
    mediaUrl: str | None = None
    previewUrl: str | None = None
    promoVideoUrl: str | None = None
    whatYouWillLearn: list[str] | None = None
    requirements: list[str] | None = None
    targetAudience: list[str] | None = None
    certificateEnabled: bool | None = None
    certificateTitle: str | None = None
    modules: list[CourseModule] | None = None
    tags: list[str] | None = None
    status: CourseStatus | None = None


class CoursePurchaseVerifyIn(BaseModel):
    razorpayOrderId: str
    razorpayPaymentId: str
    razorpaySignature: str


class CourseEnrollIn(BaseModel):
    useCoins: bool = False
    coinsToRedeem: int = 0


class LessonProgressIn(BaseModel):
    completed: bool = True


class CourseReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    reviewText: str = Field(min_length=2, max_length=1000)


class CourseQuestionIn(BaseModel):
    question: str = Field(min_length=4, max_length=1000)


class CourseAnswerIn(BaseModel):
    answer: str = Field(min_length=2, max_length=2000)


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    message: str = Field(min_length=5, max_length=2000)
