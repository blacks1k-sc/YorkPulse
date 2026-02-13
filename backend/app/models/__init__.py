"""SQLAlchemy models for YorkPulse."""

from app.models.base import UUIDMixin, TimestampMixin
from app.models.user import User
from app.models.vault import VaultPost, VaultComment, VaultCategory, VaultPostStatus
from app.models.marketplace import (
    MarketplaceListing,
    MarketplaceCategory,
    ListingStatus,
    ListingCondition,
)
from app.models.buddy import (
    BuddyRequest,
    BuddyParticipant,
    BuddyCategory,
    BuddyRequestStatus,
    ParticipantStatus,
    VibeLevel,
)
from app.models.messaging import (
    Conversation,
    Message,
    ConversationStatus,
)
from app.models.review import Review, ReviewType
from app.models.transaction import MarketplaceTransaction
from app.models.marketplace_review import MarketplaceReview
from app.models.report import UserReport, ReportReason, ReportStatus
from app.models.course import (
    Course,
    CourseChannel,
    CourseMember,
    ChannelMember,
    CourseMessage,
    ChannelCreationVote,
    ChannelType,
)

__all__ = [
    # Base
    "UUIDMixin",
    "TimestampMixin",
    # User
    "User",
    # Vault
    "VaultPost",
    "VaultComment",
    "VaultCategory",
    "VaultPostStatus",
    # Marketplace
    "MarketplaceListing",
    "MarketplaceCategory",
    "ListingStatus",
    "ListingCondition",
    # Buddy
    "BuddyRequest",
    "BuddyParticipant",
    "BuddyCategory",
    "BuddyRequestStatus",
    "ParticipantStatus",
    "VibeLevel",
    # Messaging
    "Conversation",
    "Message",
    "ConversationStatus",
    # Review
    "Review",
    "ReviewType",
    # Transaction
    "MarketplaceTransaction",
    # Marketplace Review
    "MarketplaceReview",
    # Report
    "UserReport",
    "ReportReason",
    "ReportStatus",
    # Course
    "Course",
    "CourseChannel",
    "CourseMember",
    "ChannelMember",
    "CourseMessage",
    "ChannelCreationVote",
    "ChannelType",
]
