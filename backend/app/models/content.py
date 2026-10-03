from pydantic import BaseModel, Field


class AgriNewsItem(BaseModel):
    id: str
    title: str
    vernacularTitle: str
    category: str
    source: str
    timestamp: str
    summary: str
    content: str
    isBreaking: bool
    audioText: str
    impactRating: str


class AgriLiveChannel(BaseModel):
    id: str
    channelName: str
    broadcaster: str
    programTitle: str
    currentSpeaker: str
    liveViewersCount: int
    isLiveNow: bool
    category: str
    streamThumbnail: str
    streamUrl: str
    scheduleTime: str
    pinnedAnnouncement: str = ""
    isBroadcasterHost: bool = False


class LiveChannelIn(BaseModel):
    channelName: str = Field(min_length=2, max_length=100)
    broadcaster: str = Field(min_length=2, max_length=100)
    programTitle: str = Field(min_length=2, max_length=150)
    currentSpeaker: str = Field(default="", max_length=100)
    category: str = "Advisory"
    streamThumbnail: str = ""
    streamUrl: str = Field(min_length=5)
    scheduleTime: str = "Live Now"


class ScheduledBroadcast(BaseModel):
    id: str
    channelName: str
    programTitle: str
    speakerName: str
    speakerRole: str
    scheduledStart: str
    topic: str
    reminderCount: int = 0
    hasReminder: bool = False
    thumbnailUrl: str = ""


class ChatMessageIn(BaseModel):
    # empty text allowed so viewer join/leave pings (?joined/?left) reuse this body
    text: str = Field(default="", max_length=300)


class ChatMessageOut(BaseModel):
    id: str
    userId: str = ""
    userName: str
    text: str
    sentAt: str


class LivePollIn(BaseModel):
    question: str = Field(min_length=3, max_length=200)
    options: list[str] = Field(min_length=2, max_length=5)


class LivePoll(BaseModel):
    id: str
    channelId: str
    question: str
    options: list[str]
    votes: dict[str, int] = Field(default_factory=dict)
    totalVotes: int = 0
    userVotedOption: int | None = None
    isActive: bool = True
    createdAt: str


class PollVoteIn(BaseModel):
    optionIndex: int = Field(ge=0, le=4)


class LiveQuestionIn(BaseModel):
    questionText: str = Field(min_length=3, max_length=300)


class LiveQuestion(BaseModel):
    id: str
    channelId: str
    userId: str
    userName: str
    questionText: str
    upvotesCount: int = 0
    isAnswered: bool = False
    userHasUpvoted: bool = False
    createdAt: str


class ChannelGiftIn(BaseModel):
    giftType: str = "green_sprout"  # green_sprout, golden_wheat, tractor_salute
    coins: int = Field(ge=1, le=500)
    note: str = Field(default="", max_length=100)


class ChannelPinIn(BaseModel):
    pinnedText: str = Field(default="", max_length=250)

