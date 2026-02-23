"""Professor models for tracking instructors and their course assignments."""

import uuid
from datetime import datetime

from sqlalchemy import (
    String,
    ForeignKey,
    DateTime,
    Integer,
    Boolean,
    Index,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class Professor(Base, UUIDMixin, TimestampMixin):
    """Professor/Instructor information."""

    __tablename__ = "professors"

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )
    name_normalized: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        unique=True,
        index=True,
    )
    department: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        index=True,
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    york_exclusive: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    # Track how many times this professor was found in schedule data
    occurrence_count: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    # Relationships
    course_assignments: Mapped[list["ProfessorCourse"]] = relationship(
        "ProfessorCourse",
        back_populates="professor",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_professors_department", "department"),
    )

    def __repr__(self) -> str:
        return f"<Professor {self.name}>"


class ProfessorCourse(Base, UUIDMixin):
    """Join table linking professors to courses with semester/year info."""

    __tablename__ = "professor_courses"

    professor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("professors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    semester: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    year: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    section: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )

    # Relationships
    professor: Mapped["Professor"] = relationship(
        "Professor",
        back_populates="course_assignments",
    )
    course: Mapped["Course"] = relationship(
        "Course",
        back_populates="professor_assignments",
    )

    __table_args__ = (
        UniqueConstraint(
            "professor_id", "course_id", "semester", "year", "section",
            name="uq_professor_courses_assignment"
        ),
        Index("ix_professor_courses_semester_year", "semester", "year"),
    )

    def __repr__(self) -> str:
        return f"<ProfessorCourse {self.professor_id} -> {self.course_id} ({self.semester} {self.year})>"


# Import for type hints
from app.models.course import Course  # noqa: E402, F401
