from enum import Enum
from pydantic import BaseModel, Field


class AdPlacement(str, Enum):
    home_hero = "home_hero"
    course_banner = "course_banner"
    sidebar_card = "sidebar_card"
    store_spotlight = "store_spotlight"


class AdTargetType(str, Enum):
    course = "course"
    workshop = "workshop"
    external = "external"


class AdCampaignStatus(str, Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"
    pending_approval = "pending_approval"


class AdCampaignCreateIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    headline: str = Field(min_length=5, max_length=140)
    description: str = Field(default="", max_length=500)
    bannerUrl: str = Field(min_length=5)
    ctaText: str = Field(default="Enroll Now", max_length=40)
    placement: AdPlacement = AdPlacement.course_banner
    targetType: AdTargetType = AdTargetType.course
    targetId: str = Field(default="", max_length=500)
    budgetRupees: float = Field(default=1000.0, ge=0)
    dailyBudgetRupees: float = Field(default=100.0, ge=0)
    startDate: str | None = None
    endDate: str | None = None
    autoActivate: bool = True


class AdCampaignUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=120)
    headline: str | None = Field(default=None, min_length=5, max_length=140)
    description: str | None = None
    bannerUrl: str | None = None
    ctaText: str | None = None
    placement: AdPlacement | None = None
    targetType: AdTargetType | None = None
    targetId: str | None = None
    status: AdCampaignStatus | None = None
    budgetRupees: float | None = Field(default=None, ge=0)
    dailyBudgetRupees: float | None = Field(default=None, ge=0)
    startDate: str | None = None
    endDate: str | None = None
