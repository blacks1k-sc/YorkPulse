"""Course chat room API routes."""

import re
import uuid
from datetime import datetime, timezone
from typing import Annotated
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import AdminUser, CurrentUser, VerifiedUser
from app.models.course import (
    Course,
    CourseChannel,
    CourseMember,
    ChannelMember,
    CourseMessage,
    ChannelCreationVote,
    ChannelType,
)
from app.models.user import User
from app.schemas.course import (
    ChannelListResponse,
    ChannelResponse,
    ChannelJoinResponse,
    CourseInHierarchy,
    CourseResponse,
    CourseSearchResponse,
    CourseSearchResult,
    FacultyNode,
    HierarchyResponse,
    JoinCourseResponse,
    LeaveCourseResponse,
    MessageAuthor,
    MessageCreate,
    MessageListResponse,
    MessageResponse,
    MyCoursesResponse,
    CourseMembershipResponse,
    ProgramNode,
    SeedCoursesResponse,
    VoteCreate,
    VoteResponse,
    VoteStatus,
    VoteStatusResponse,
    YearNode,
)

router = APIRouter(prefix="/courses", tags=["Courses"])

# Vote threshold for creating professor channel
VOTE_THRESHOLD = 5


def get_current_semester() -> str:
    """Get current semester code (e.g., W2025, F2024, S2025)."""
    now = datetime.now(timezone.utc)
    year = now.year
    month = now.month

    if month >= 9:  # September - December: Fall
        return f"F{year}"
    elif month >= 5:  # May - August: Summer
        return f"S{year}"
    else:  # January - April: Winter
        return f"W{year}"


def normalize_prof_name(name: str) -> str:
    """Normalize professor name for consistent matching."""
    # Lowercase, trim, remove extra spaces
    normalized = " ".join(name.lower().strip().split())
    return normalized


def _course_to_response(course: Course) -> CourseResponse:
    """Convert course model to response."""
    return CourseResponse(
        id=str(course.id),
        code=course.code,
        name=course.name,
        faculty=course.faculty,
        programs=course.programs,
        year=course.year,
        credits=course.credits,
        campus=course.campus,
        member_count=course.member_count,
        created_at=course.created_at,
    )


def _channel_to_response(channel: CourseChannel) -> ChannelResponse:
    """Convert channel model to response."""
    return ChannelResponse(
        id=str(channel.id),
        course_id=str(channel.course_id),
        name=channel.name,
        type=channel.type,
        member_count=channel.member_count,
        is_active=channel.is_active,
        prof_name=channel.prof_name,
        semester=channel.semester,
        created_at=channel.created_at,
    )


def _message_to_response(msg: CourseMessage, user: User) -> MessageResponse:
    """Convert message model to response."""
    return MessageResponse(
        id=str(msg.id),
        channel_id=str(msg.channel_id),
        message=msg.message,
        author=MessageAuthor(
            id=str(user.id),
            name=user.name,
            avatar_url=user.avatar_url,
        ),
        created_at=msg.created_at,
    )


# ============ Course Discovery ============


@router.get("/hierarchy", response_model=HierarchyResponse)
async def get_course_hierarchy(
    db: Annotated[AsyncSession, Depends(get_db)],
    campus: str | None = None,
):
    """Get complete course hierarchy for mind map navigation."""
    query = select(Course).order_by(Course.faculty, Course.code)

    if campus:
        query = query.where(Course.campus == campus)

    result = await db.execute(query)
    courses = result.scalars().all()

    # Build hierarchy: Faculty → Program → Year → Courses
    faculty_data: dict[str, dict[str, dict[int, list[CourseInHierarchy]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )

    for course in courses:
        course_info = CourseInHierarchy(
            id=str(course.id),
            code=course.code,
            name=course.name,
            member_count=course.member_count,
        )

        # Add to each program
        for program in course.programs:
            faculty_data[course.faculty][program][course.year].append(course_info)

    # Convert to response format
    faculties = []
    for faculty_name in sorted(faculty_data.keys()):
        programs = []
        for program_name in sorted(faculty_data[faculty_name].keys()):
            years = []
            for year in sorted(faculty_data[faculty_name][program_name].keys()):
                courses_in_year = faculty_data[faculty_name][program_name][year]
                years.append(YearNode(year=year, courses=courses_in_year))
            programs.append(ProgramNode(name=program_name, years=years))
        faculties.append(FacultyNode(name=faculty_name, programs=programs))

    return HierarchyResponse(faculties=faculties)


@router.get("/search", response_model=CourseSearchResponse)
async def search_courses(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str, Query(min_length=1)],
    limit: Annotated[int, Query(ge=1, le=50)] = 50,
):
    """Search courses by code or name with fuzzy matching."""
    # Normalize query: remove spaces and lowercase for code matching
    normalized_query = q.replace(" ", "").lower()
    normalized_search_term = f"%{normalized_query}%"
    starts_with_term = f"{normalized_query}%"

    # Original query for name matching (preserve spaces)
    name_search_term = f"%{q.lower()}%"

    # Normalized code column for reuse
    normalized_code = func.lower(func.replace(Course.code, " ", ""))

    query = (
        select(Course)
        .where(
            or_(
                # Code search: normalize both sides by removing spaces
                normalized_code.like(normalized_search_term),
                # Name search: keep original spacing
                func.lower(Course.name).like(name_search_term),
            )
        )
        .order_by(
            # Exact code match first
            (normalized_code == normalized_query).desc(),
            # Then codes starting with query
            normalized_code.like(starts_with_term).desc(),
            # Then by popularity
            Course.member_count.desc(),
            Course.code,
        )
        .limit(limit)
    )

    result = await db.execute(query)
    courses = result.scalars().all()

    return CourseSearchResponse(
        results=[
            CourseSearchResult(
                id=str(c.id),
                code=c.code,
                name=c.name,
                faculty=c.faculty,
                year=c.year,
                member_count=c.member_count,
            )
            for c in courses
        ],
        total=len(courses),
    )


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get course details."""
    result = await db.execute(
        select(Course).where(Course.id == course_id)
    )
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    return _course_to_response(course)


# ============ Course Membership ============


@router.get("/my/courses", response_model=MyCoursesResponse)
async def get_my_courses(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get user's joined courses."""
    result = await db.execute(
        select(CourseMember)
        .options(selectinload(CourseMember.course).selectinload(Course.channels))
        .where(CourseMember.user_id == user.id)
        .order_by(CourseMember.joined_at.desc())
    )
    memberships = result.scalars().all()

    courses = []
    for membership in memberships:
        course = membership.course
        channel_count = len([c for c in course.channels if c.is_active])

        courses.append(CourseMembershipResponse(
            course=_course_to_response(course),
            joined_at=membership.joined_at,
            channel_count=channel_count,
        ))

    return MyCoursesResponse(courses=courses)


@router.post("/{course_id}/join", response_model=JoinCourseResponse)
async def join_course(
    course_id: str,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Join a course and its #general channel."""
    # Get course
    result = await db.execute(
        select(Course)
        .options(selectinload(Course.channels))
        .where(Course.id == course_id)
    )
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check if already a member
    existing = await db.execute(
        select(CourseMember)
        .where(CourseMember.user_id == user.id)
        .where(CourseMember.course_id == course.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already a member of this course")

    # Find or create #general channel
    general_channel = next(
        (c for c in course.channels if c.type == ChannelType.GENERAL),
        None
    )

    if not general_channel:
        general_channel = CourseChannel(
            id=uuid.uuid4(),
            course_id=course.id,
            name="general",
            type=ChannelType.GENERAL,
            member_count=0,
        )
        db.add(general_channel)
        await db.flush()

    # Add course membership
    course_member = CourseMember(
        id=uuid.uuid4(),
        user_id=user.id,
        course_id=course.id,
    )
    db.add(course_member)

    # Add channel membership
    channel_member = ChannelMember(
        id=uuid.uuid4(),
        user_id=user.id,
        channel_id=general_channel.id,
    )
    db.add(channel_member)

    # Update counts
    course.member_count += 1
    general_channel.member_count += 1

    await db.commit()
    await db.refresh(course)
    await db.refresh(general_channel)

    return JoinCourseResponse(
        course=_course_to_response(course),
        general_channel=_channel_to_response(general_channel),
        message=f"Welcome to {course.code}!",
    )


@router.post("/{course_id}/leave", response_model=LeaveCourseResponse)
async def leave_course(
    course_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Leave a course and all its channels."""
    # Get course membership
    result = await db.execute(
        select(CourseMember)
        .where(CourseMember.user_id == user.id)
        .where(CourseMember.course_id == course_id)
    )
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(status_code=404, detail="Not a member of this course")

    # Get course
    course_result = await db.execute(
        select(Course)
        .options(selectinload(Course.channels))
        .where(Course.id == course_id)
    )
    course = course_result.scalar_one()

    # Remove from all channel memberships in this course
    for channel in course.channels:
        await db.execute(
            delete(ChannelMember)
            .where(ChannelMember.user_id == user.id)
            .where(ChannelMember.channel_id == channel.id)
        )
        channel.member_count = max(0, channel.member_count - 1)

    # Remove course membership
    await db.delete(membership)

    # Update course member count
    course.member_count = max(0, course.member_count - 1)

    # Remove any votes for this course
    await db.execute(
        delete(ChannelCreationVote)
        .where(ChannelCreationVote.course_id == course.id)
        .where(ChannelCreationVote.voter_user_id == user.id)
    )

    await db.commit()

    return LeaveCourseResponse(message=f"Left {course.code}")


# ============ Channel Management ============


@router.get("/{course_id}/channels", response_model=ChannelListResponse)
async def get_course_channels(
    course_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get all channels in a course."""
    # Verify user is a member
    membership = await db.execute(
        select(CourseMember)
        .where(CourseMember.user_id == user.id)
        .where(CourseMember.course_id == course_id)
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Join the course first")

    result = await db.execute(
        select(CourseChannel)
        .where(CourseChannel.course_id == course_id)
        .where(CourseChannel.is_active == True)
        .order_by(CourseChannel.type, CourseChannel.name)
    )
    channels = result.scalars().all()

    return ChannelListResponse(
        channels=[_channel_to_response(c) for c in channels]
    )


@router.post("/channels/{channel_id}/join", response_model=ChannelJoinResponse)
async def join_channel(
    channel_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Join a specific channel (mainly for professor channels)."""
    # Get channel
    result = await db.execute(
        select(CourseChannel)
        .options(selectinload(CourseChannel.course))
        .where(CourseChannel.id == channel_id)
        .where(CourseChannel.is_active == True)
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Verify user is a course member
    membership = await db.execute(
        select(CourseMember)
        .where(CourseMember.user_id == user.id)
        .where(CourseMember.course_id == channel.course_id)
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Join the course first")

    # Check if already a channel member
    existing = await db.execute(
        select(ChannelMember)
        .where(ChannelMember.user_id == user.id)
        .where(ChannelMember.channel_id == channel.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already a member of this channel")

    # Add channel membership
    channel_member = ChannelMember(
        id=uuid.uuid4(),
        user_id=user.id,
        channel_id=channel.id,
    )
    db.add(channel_member)

    channel.member_count += 1

    await db.commit()
    await db.refresh(channel)

    return ChannelJoinResponse(
        channel=_channel_to_response(channel),
        message=f"Joined #{channel.name}",
    )


# ============ Professor Voting ============


@router.get("/{course_id}/vote-status", response_model=VoteStatusResponse)
async def get_vote_status(
    course_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get current vote counts for professor channel creation."""
    current_semester = get_current_semester()

    # Verify user is a member
    membership = await db.execute(
        select(CourseMember)
        .where(CourseMember.user_id == user.id)
        .where(CourseMember.course_id == course_id)
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Join the course first")

    # Get all votes for this course and semester
    result = await db.execute(
        select(
            ChannelCreationVote.prof_name_normalized,
            func.count(ChannelCreationVote.id).label("vote_count"),
        )
        .where(ChannelCreationVote.course_id == course_id)
        .where(ChannelCreationVote.semester == current_semester)
        .group_by(ChannelCreationVote.prof_name_normalized)
        .order_by(func.count(ChannelCreationVote.id).desc())
    )
    vote_counts = result.all()

    # Get user's own votes
    user_votes_result = await db.execute(
        select(ChannelCreationVote.prof_name_normalized)
        .where(ChannelCreationVote.course_id == course_id)
        .where(ChannelCreationVote.voter_user_id == user.id)
        .where(ChannelCreationVote.semester == current_semester)
    )
    user_voted_profs = {v for v in user_votes_result.scalars().all()}

    votes = []
    for prof_name_normalized, count in vote_counts:
        # Get original prof name from a vote
        orig_result = await db.execute(
            select(ChannelCreationVote)
            .where(ChannelCreationVote.course_id == course_id)
            .where(ChannelCreationVote.prof_name_normalized == prof_name_normalized)
            .where(ChannelCreationVote.semester == current_semester)
            .limit(1)
        )
        # Use title case for display
        display_name = prof_name_normalized.title()

        votes.append(VoteStatus(
            prof_name=display_name,
            prof_name_normalized=prof_name_normalized,
            vote_count=count,
            threshold=VOTE_THRESHOLD,
            has_voted=prof_name_normalized in user_voted_profs,
            semester=current_semester,
        ))

    return VoteStatusResponse(votes=votes, current_semester=current_semester)


@router.post("/{course_id}/vote-professor", response_model=VoteResponse)
async def vote_for_professor(
    course_id: str,
    request: VoteCreate,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Vote for creating a professor-specific channel."""
    semester = request.semester or get_current_semester()
    prof_name_normalized = normalize_prof_name(request.prof_name)

    if len(prof_name_normalized) < 2:
        raise HTTPException(status_code=400, detail="Professor name too short")

    # Verify user is a member
    membership = await db.execute(
        select(CourseMember)
        .where(CourseMember.user_id == user.id)
        .where(CourseMember.course_id == course_id)
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Join the course first")

    # Check if user already voted for this professor this semester
    existing_vote = await db.execute(
        select(ChannelCreationVote)
        .where(ChannelCreationVote.course_id == course_id)
        .where(ChannelCreationVote.voter_user_id == user.id)
        .where(ChannelCreationVote.prof_name_normalized == prof_name_normalized)
        .where(ChannelCreationVote.semester == semester)
    )
    if existing_vote.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already voted for this professor")

    # Check if channel already exists
    channel_name = f"prof-{prof_name_normalized.replace(' ', '-')}-{semester.lower()}"
    existing_channel = await db.execute(
        select(CourseChannel)
        .where(CourseChannel.course_id == course_id)
        .where(CourseChannel.name == channel_name)
    )
    if existing_channel.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Channel already exists for this professor")

    # Add vote
    vote = ChannelCreationVote(
        id=uuid.uuid4(),
        course_id=uuid.UUID(course_id),
        prof_name_normalized=prof_name_normalized,
        voter_user_id=user.id,
        semester=semester,
    )
    db.add(vote)
    await db.flush()

    # Count current votes
    count_result = await db.execute(
        select(func.count())
        .select_from(ChannelCreationVote)
        .where(ChannelCreationVote.course_id == course_id)
        .where(ChannelCreationVote.prof_name_normalized == prof_name_normalized)
        .where(ChannelCreationVote.semester == semester)
    )
    vote_count = count_result.scalar() or 0

    channel_created = False
    new_channel = None

    # Check if threshold met
    if vote_count >= VOTE_THRESHOLD:
        # Create the professor channel
        new_channel = CourseChannel(
            id=uuid.uuid4(),
            course_id=uuid.UUID(course_id),
            name=channel_name,
            type=ChannelType.PROFESSOR,
            prof_name=prof_name_normalized.title(),
            semester=semester,
            member_count=0,
        )
        db.add(new_channel)
        await db.flush()

        # Auto-add all voters to the channel
        voters_result = await db.execute(
            select(ChannelCreationVote.voter_user_id)
            .where(ChannelCreationVote.course_id == course_id)
            .where(ChannelCreationVote.prof_name_normalized == prof_name_normalized)
            .where(ChannelCreationVote.semester == semester)
        )
        voter_ids = [v for v in voters_result.scalars().all()]

        for voter_id in voter_ids:
            channel_member = ChannelMember(
                id=uuid.uuid4(),
                user_id=voter_id,
                channel_id=new_channel.id,
            )
            db.add(channel_member)
            new_channel.member_count += 1

        channel_created = True

    await db.commit()

    if new_channel:
        await db.refresh(new_channel)

    return VoteResponse(
        vote_count=vote_count,
        threshold=VOTE_THRESHOLD,
        channel_created=channel_created,
        channel=_channel_to_response(new_channel) if new_channel else None,
        message=(
            f"Channel #{channel_name} created! You've been auto-added."
            if channel_created
            else f"Vote recorded ({vote_count}/{VOTE_THRESHOLD})"
        ),
    )


# ============ Messaging ============


@router.get("/channels/{channel_id}/messages", response_model=MessageListResponse)
async def get_channel_messages(
    channel_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    before: datetime | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    """Get messages in a channel."""
    # Get channel
    result = await db.execute(
        select(CourseChannel)
        .where(CourseChannel.id == channel_id)
        .where(CourseChannel.is_active == True)
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Verify user is a course member
    membership = await db.execute(
        select(CourseMember)
        .where(CourseMember.user_id == user.id)
        .where(CourseMember.course_id == channel.course_id)
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Join the course first")

    # Build query
    query = (
        select(CourseMessage)
        .options(selectinload(CourseMessage.user))
        .where(CourseMessage.channel_id == channel.id)
    )

    if before:
        query = query.where(CourseMessage.created_at < before)

    query = query.order_by(CourseMessage.created_at.desc()).limit(limit + 1)

    result = await db.execute(query)
    messages = list(result.scalars().all())

    has_more = len(messages) > limit
    if has_more:
        messages = messages[:limit]

    # Reverse to chronological order
    messages = list(reversed(messages))

    return MessageListResponse(
        messages=[_message_to_response(m, m.user) for m in messages],
        has_more=has_more,
    )


@router.post("/channels/{channel_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_channel_message(
    channel_id: str,
    request: MessageCreate,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send a message in a channel."""
    # Get channel
    result = await db.execute(
        select(CourseChannel)
        .where(CourseChannel.id == channel_id)
        .where(CourseChannel.is_active == True)
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Verify user is a course member
    membership = await db.execute(
        select(CourseMember)
        .where(CourseMember.user_id == user.id)
        .where(CourseMember.course_id == channel.course_id)
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Join the course first")

    # For professor channels, verify user is a channel member
    if channel.type == ChannelType.PROFESSOR:
        channel_membership = await db.execute(
            select(ChannelMember)
            .where(ChannelMember.user_id == user.id)
            .where(ChannelMember.channel_id == channel.id)
        )
        if not channel_membership.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Join this channel first")

    # Create message
    message = CourseMessage(
        id=uuid.uuid4(),
        channel_id=channel.id,
        user_id=user.id,
        message=request.message,
    )
    db.add(message)

    await db.commit()
    await db.refresh(message)

    return _message_to_response(message, user)


# ============ Admin Endpoints ============


@router.post("/admin/seed", response_model=SeedCoursesResponse)
async def seed_courses(
    user: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Seed courses from courses_seed.json (admin only)."""
    import json
    from pathlib import Path

    # Load seed data
    seed_path = Path(__file__).parent.parent.parent.parent / "courses_seed.json"

    if not seed_path.exists():
        raise HTTPException(status_code=404, detail="courses_seed.json not found")

    with open(seed_path, "r", encoding="utf-8") as f:
        courses_data = json.load(f)

    courses_created = 0
    channels_created = 0

    for course_data in courses_data:
        # Check if course already exists
        existing = await db.execute(
            select(Course).where(Course.code == course_data["code"])
        )
        if existing.scalar_one_or_none():
            continue

        # Create course
        course = Course(
            id=uuid.uuid4(),
            code=course_data["code"],
            name=course_data["name"],
            faculty=course_data["faculty"],
            programs=course_data["programs"],
            year=course_data["year"],
            credits=course_data.get("credits"),
            campus=course_data.get("campus"),
        )
        db.add(course)
        await db.flush()
        courses_created += 1

        # Create #general channel
        general_channel = CourseChannel(
            id=uuid.uuid4(),
            course_id=course.id,
            name="general",
            type=ChannelType.GENERAL,
        )
        db.add(general_channel)
        channels_created += 1

    await db.commit()

    return SeedCoursesResponse(
        courses_created=courses_created,
        channels_created=channels_created,
        message=f"Seeded {courses_created} courses with {channels_created} channels",
    )
