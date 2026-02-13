#!/usr/bin/env python3
"""
Seed courses from courses_seed.json into the database.
Run this after migrations to populate the courses table.
"""

import asyncio
import json
import uuid
from pathlib import Path

from sqlalchemy import select, text

# Add parent directory to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import async_session_maker
from app.models.course import Course, CourseChannel, ChannelType


async def seed_courses() -> dict:
    """Seed courses from courses_seed.json."""
    seed_path = Path(__file__).parent.parent / "courses_seed.json"

    if not seed_path.exists():
        print(f"Error: {seed_path} not found")
        print("Run scrape_courses.py first to generate the seed file")
        return {"error": "courses_seed.json not found"}

    print(f"Loading courses from {seed_path}...")
    with open(seed_path, "r", encoding="utf-8") as f:
        courses_data = json.load(f)

    print(f"Found {len(courses_data)} courses to seed")

    # Filter valid courses (year 1-4) and deduplicate by code
    seen_codes = set()
    valid_courses = []
    for c in courses_data:
        year = c.get("year")
        code = c.get("code")
        if year and 1 <= year <= 4 and code and code not in seen_codes:
            valid_courses.append(c)
            seen_codes.add(code)

    print(f"Valid courses (year 1-4, deduplicated): {len(valid_courses)}")

    courses_created = 0
    channels_created = 0

    async with async_session_maker() as db:
        # Get existing course codes
        result = await db.execute(select(Course.code))
        existing_codes = {row[0] for row in result.fetchall()}
        print(f"Existing courses in DB: {len(existing_codes)}")

        # Filter out existing courses
        new_courses = [c for c in valid_courses if c["code"] not in existing_codes]
        print(f"New courses to add: {len(new_courses)}")

        if not new_courses:
            print("Nothing to add!")
            return {"courses_created": 0, "channels_created": 0}

        # Batch insert
        batch_size = 100
        for i in range(0, len(new_courses), batch_size):
            batch = new_courses[i:i+batch_size]

            for course_data in batch:
                course_id = uuid.uuid4()

                course = Course(
                    id=course_id,
                    code=course_data["code"],
                    name=course_data["name"],
                    faculty=course_data["faculty"],
                    programs=course_data["programs"],
                    year=course_data["year"],
                    credits=course_data.get("credits"),
                    campus=course_data.get("campus"),
                )
                db.add(course)
                courses_created += 1

                general_channel = CourseChannel(
                    id=uuid.uuid4(),
                    course_id=course_id,
                    name="general",
                    type=ChannelType.GENERAL,
                )
                db.add(general_channel)
                channels_created += 1

            await db.commit()
            print(f"Committed batch {i//batch_size + 1}/{(len(new_courses) + batch_size - 1)//batch_size} ({courses_created} courses)")

    result = {
        "courses_created": courses_created,
        "channels_created": channels_created,
    }

    print(f"\n=== Seeding Complete ===")
    print(f"Courses created: {courses_created}")
    print(f"Channels created: {channels_created}")

    return result


async def main():
    """Main entry point."""
    print("Starting course seed...")
    result = await seed_courses()
    print(f"\nResult: {result}")


if __name__ == "__main__":
    # Disable SQLAlchemy logging
    import logging
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

    asyncio.run(main())
