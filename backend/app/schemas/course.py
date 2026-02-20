"""Course chat room schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field

from app.models.course import ChannelType


# ============ Course Schemas ============


class CourseBase(BaseModel):
    """Base course info."""

    id: str
    code: str
    name: str
    faculty: str
    programs: list[str]
    year: int
    credits: Decimal | None
    campus: str | None
    member_count: int

    class Config:
        from_attributes = True


class CourseResponse(CourseBase):
    """Full course response."""

    created_at: datetime


class CourseSearchResult(BaseModel):
    """Minimal course info for search results."""

    id: str
    code: str
    name: str
    faculty: str
    year: int
    member_count: int

    class Config:
        from_attributes = True


class CourseSearchResponse(BaseModel):
    """Search results."""

    results: list[CourseSearchResult]
    total: int


# ============ Hierarchy Schemas ============


class CourseInHierarchy(BaseModel):
    """Course in hierarchy view."""

    id: str
    code: str
    name: str
    member_count: int


class YearNode(BaseModel):
    """Year level in hierarchy."""

    year: int
    courses: list[CourseInHierarchy]


class ProgramNode(BaseModel):
    """Program in hierarchy."""

    name: str
    years: list[YearNode]


class FacultyNode(BaseModel):
    """Faculty in hierarchy."""

    name: str
    programs: list[ProgramNode]


class HierarchyResponse(BaseModel):
    """Complete hierarchy for mind map."""

    faculties: list[FacultyNode]


# ============ Channel Schemas ============


class ChannelBase(BaseModel):
    """Base channel info."""

    id: str
    name: str
    type: ChannelType
    member_count: int
    is_active: bool

    class Config:
        from_attributes = True


class ChannelResponse(ChannelBase):
    """Full channel response."""

    course_id: str
    prof_name: str | None
    semester: str | None
    created_at: datetime
    unread_count: int = 0


class ChannelListResponse(BaseModel):
    """List of channels in a course."""

    channels: list[ChannelResponse]


class ChannelJoinResponse(BaseModel):
    """Response after joining a channel."""

    channel: ChannelResponse
    message: str


# ============ Message Schemas ============


class MessageAuthor(BaseModel):
    """Minimal user info for message author."""

    id: str
    name: str
    avatar_url: str | None


class ReplyInfo(BaseModel):
    """Minimal info about a replied message."""

    id: str
    message: str | None
    image_url: str | None
    author: MessageAuthor

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    """Message in chat."""

    id: str
    channel_id: str
    message: str | None
    image_url: str | None
    author: MessageAuthor
    reply_to: ReplyInfo | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    """Create a new message."""

    message: Annotated[str | None, Field(default=None, max_length=500)] = None
    image_url: Annotated[str | None, Field(default=None, max_length=500)] = None
    reply_to_id: str | None = None

    def model_post_init(self, __context) -> None:
        """Validate that at least one of message or image_url is provided."""
        if not self.message and not self.image_url:
            raise ValueError("Message must have either text or an image (or both)")


class ChatImageUploadRequest(BaseModel):
    """Request for chat image upload URL."""

    filename: str
    content_type: Annotated[str, Field(pattern=r"^image/(jpeg|png|gif|webp)$")]


class ChatImageUploadResponse(BaseModel):
    """Response with presigned upload URL."""

    upload_url: str
    file_url: str
    expires_in: int


class MessageListResponse(BaseModel):
    """Paginated messages."""

    messages: list[MessageResponse]
    has_more: bool


# ============ Voting Schemas ============


class VoteCreate(BaseModel):
    """Vote for professor channel creation."""

    prof_name: Annotated[str, Field(min_length=2, max_length=100)]
    semester: str | None = None  # Auto-detect if not provided


class VoteStatus(BaseModel):
    """Current vote status for a professor."""

    prof_name: str
    prof_name_normalized: str
    vote_count: int
    threshold: int
    has_voted: bool
    semester: str


class VoteStatusResponse(BaseModel):
    """All current vote statuses for a course."""

    votes: list[VoteStatus]
    current_semester: str


class VoteResponse(BaseModel):
    """Response after voting."""

    vote_count: int
    threshold: int
    channel_created: bool
    channel: ChannelResponse | None
    message: str


# ============ Membership Schemas ============


class CourseMembershipResponse(BaseModel):
    """Course membership info."""

    course: CourseResponse
    joined_at: datetime
    channel_count: int
    unread_count: int = 0


class MyCoursesResponse(BaseModel):
    """User's joined courses."""

    courses: list[CourseMembershipResponse]


class JoinCourseResponse(BaseModel):
    """Response after joining a course."""

    course: CourseResponse
    general_channel: ChannelResponse
    message: str


class LeaveCourseResponse(BaseModel):
    """Response after leaving a course."""

    message: str


# ============ Admin Schemas ============


class SeedCoursesResponse(BaseModel):
    """Response from seeding courses."""

    courses_created: int
    channels_created: int
    message: str
