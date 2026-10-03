from pydantic import BaseModel, Field


class TeacherProfileUpdateIn(BaseModel):
    name: str | None = None
    headline: str | None = Field(default=None, max_length=140)
    bio: str | None = Field(default=None, max_length=5000)
    institution: str | None = Field(default=None, max_length=120)
    qualification: str | None = Field(default=None, max_length=120)
    expertise: list[str] | None = None
    experienceYears: int | None = Field(default=None, ge=0)
    avatarUrl: str | None = None
    websiteUrl: str | None = None
    email: str | None = None
    phone: str | None = None
    bankAccountName: str | None = None
    bankAccountNumber: str | None = None
    bankIfsc: str | None = None


class TeacherCertificateIssueIn(BaseModel):
    customNote: str | None = None


class TeacherAnnouncementIn(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    message: str = Field(min_length=5, max_length=2000)


class CourseCreateIn(BaseModel):
    title: str
    category: str = "Agri-Skills"
    syllabus: list[str] = []
    sessionCount: int = Field(default=6, ge=1, le=50)
    practicalHours: float = Field(default=12.0, ge=0)
    mode: str = "hybrid"  # on-farm, centre, hybrid
    feeRupees: float = Field(gt=0)
    batchCapacity: int = Field(default=20, ge=1, le=100)
    prerequisites: str = ""
    materialsList: list[str] = []


class BatchCreateIn(BaseModel):
    courseId: str
    batchName: str
    startDate: str
    endDate: str
    locationPin: str = "Farm Training Center"
    maxSeats: int = 25
    scheduleDays: str = "Mon-Wed-Fri 10:00 AM"


class EnquiryCreateIn(BaseModel):
    courseId: str
    questionTemplate: str
    details: str = ""


class EnquiryAnswerIn(BaseModel):
    answerTemplate: str
    customNote: str = ""


class FeeQuoteIn(BaseModel):
    enquiryId: str
    proposedFeeRupees: float = Field(gt=0)
    terms: str = ""


class AttendanceMarkIn(BaseModel):
    sessionId: str
    studentId: str
    status: str = "present"  # present, absent, excused
    verificationMethod: str = "qr_scan"


class AssignmentSubmitIn(BaseModel):
    courseId: str
    title: str
    evidencePhotoUrls: list[str] = []
    notes: str = ""


class AssignmentGradeIn(BaseModel):
    grade: str  # A+, A, B, Pass, Incomplete
    feedback: str = ""
    passed: bool = True
