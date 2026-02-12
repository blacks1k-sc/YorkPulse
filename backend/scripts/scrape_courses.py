#!/usr/bin/env python3
"""
York University Course Scraper
Scrapes course data from York's Kuali catalog API and outputs structured JSON.
"""

import json
import re
import time
import logging
from typing import Any
from pathlib import Path

import requests

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Kuali API configuration
CATALOG_ID = "6634ddfc480d8a001cce25ab"
BASE_URL = "https://york.kuali.co/api/v1/catalog"
COURSES_URL = f"{BASE_URL}/courses/{CATALOG_ID}"
COURSE_DETAIL_URL = f"{BASE_URL}/course/{CATALOG_ID}"

# Rate limiting
REQUEST_DELAY = 0.5  # seconds between requests

# Faculty prefix to name mapping
FACULTY_MAP = {
    "LE": "Lassonde School of Engineering",
    "AP": "Faculty of Liberal Arts & Professional Studies",
    "SC": "Faculty of Science",
    "HH": "Faculty of Health",
    "FA": "School of the Arts, Media, Performance & Design",
    "ES": "Faculty of Environmental & Urban Change",
    "ED": "Faculty of Education",
    "SB": "Schulich School of Business",
    "GL": "Glendon College",  # Will be filtered out
    "GS": "Graduate Studies",  # Will be filtered out
}

# Campus mapping based on faculty prefix
# Keele campus: Most faculties
# Markham campus: Some programs (mainly newer tech programs)
# Glendon: GL prefix (exclude)
KEELE_FACULTIES = {"LE", "AP", "SC", "HH", "FA", "ES", "ED", "SB"}
GLENDON_FACULTIES = {"GL"}

# Course codes that are at Markham (subset of LE courses)
MARKHAM_SUBJECT_CODES = {
    "LE/DIGT",  # Digital Technologies
    "LE/CSSD",  # Computer Science for Software Development
}


def extract_year_level(course_code: str) -> int | None:
    """Extract year level from course code (first digit of number)."""
    # Course codes like "LE/EECS3101" -> extract "3101" -> year 3
    match = re.search(r'/\w+(\d)\d{3}', course_code)
    if match:
        return int(match.group(1))
    return None


def extract_course_number(course_code: str) -> str | None:
    """Extract the course number from full code."""
    # "LE/EECS3101" -> "3101"
    match = re.search(r'/\w+(\d{4})', course_code)
    if match:
        return match.group(1)
    return None


def get_faculty_prefix(course_code: str) -> str | None:
    """Extract faculty prefix from course code."""
    # "LE/EECS3101" -> "LE"
    if "/" in course_code:
        return course_code.split("/")[0]
    return None


def get_subject_code(course_code: str) -> str | None:
    """Extract subject code from course code."""
    # "LE/EECS3101" -> "LE/EECS"
    match = re.match(r'([A-Z]+/[A-Z]+)', course_code)
    if match:
        return match.group(1)
    return None


def determine_campus(course_code: str) -> str | None:
    """Determine campus based on course code."""
    faculty = get_faculty_prefix(course_code)
    subject = get_subject_code(course_code)

    if faculty in GLENDON_FACULTIES:
        return None  # Exclude Glendon

    # Check for Markham-specific programs
    if subject in MARKHAM_SUBJECT_CODES:
        return "Markham"

    if faculty in KEELE_FACULTIES:
        return "Keele"

    return None


def is_graduate_course(year_level: int | None) -> bool:
    """Check if course is graduate level (5000-9000)."""
    return year_level is not None and year_level >= 5


def fetch_all_courses() -> list[dict[str, Any]]:
    """Fetch all courses from Kuali API."""
    logger.info("Fetching course list from Kuali API...")

    # The Kuali API returns all courses in one request (doesn't properly paginate)
    url = f"{COURSES_URL}?limit=50000"
    logger.info(f"Fetching all courses from API...")

    try:
        response = requests.get(url, timeout=120)
        response.raise_for_status()
        courses = response.json()
        logger.info(f"Fetched {len(courses)} total courses")
        return courses
    except requests.RequestException as e:
        logger.error(f"Error fetching courses: {e}")
        return []


def fetch_course_details(pid: str) -> dict[str, Any] | None:
    """Fetch detailed course information by PID."""
    url = f"{COURSE_DETAIL_URL}/{pid}"

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.warning(f"Error fetching course {pid}: {e}")
        return None


def extract_programs_from_description(description: str, subject_code: str) -> list[str]:
    """Extract program names from course description and subject code."""
    programs = set()

    # Map subject codes to programs
    SUBJECT_TO_PROGRAMS = {
        "LE/EECS": ["Computer Science", "Computer Engineering", "Software Engineering"],
        "LE/CIVL": ["Civil Engineering"],
        "LE/MECH": ["Mechanical Engineering"],
        "LE/ESSE": ["Earth and Space Science Engineering", "Geomatics Engineering"],
        "LE/DIGT": ["Digital Technologies"],
        "LE/CSSD": ["Computer Science for Software Development"],
        "SC/MATH": ["Mathematics", "Statistics"],
        "SC/PHYS": ["Physics"],
        "SC/CHEM": ["Chemistry"],
        "SC/BIOL": ["Biology"],
        "AP/ADMS": ["Business Administration", "Commerce"],
        "AP/ECON": ["Economics"],
        "AP/POLS": ["Political Science"],
        "AP/PSYC": ["Psychology"],
        "AP/SOCI": ["Sociology"],
        "AP/EN": ["English"],
        "AP/HIST": ["History"],
        "AP/PHIL": ["Philosophy"],
        "AP/HUMA": ["Humanities"],
        "AP/ITEC": ["Information Technology"],
        "HH/KINE": ["Kinesiology", "Health Science"],
        "HH/NURS": ["Nursing"],
        "HH/PSYC": ["Psychology"],
        "HH/HLST": ["Health Studies"],
        "FA/FILM": ["Film Studies", "Cinema"],
        "FA/VISA": ["Visual Arts"],
        "FA/MUSI": ["Music"],
        "FA/DANC": ["Dance"],
        "FA/THEA": ["Theatre"],
        "FA/DATT": ["Digital Arts"],
        "SB/ACTG": ["Accounting"],
        "SB/FINE": ["Finance"],
        "SB/MKTG": ["Marketing"],
        "SB/OMIS": ["Operations Management", "Information Systems"],
        "SB/MGMT": ["Management"],
        "ES/ENVS": ["Environmental Studies"],
        "ES/GEOG": ["Geography"],
        "ED/EDUC": ["Education"],
    }

    if subject_code in SUBJECT_TO_PROGRAMS:
        programs.update(SUBJECT_TO_PROGRAMS[subject_code])

    return list(programs) if programs else ["General"]


def process_course(course: dict[str, Any], detailed: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Process a course and extract relevant information."""
    course_code = course.get("__catalogCourseId", "")

    if not course_code:
        return None

    # Extract year level
    year_level = extract_year_level(course_code)

    # Skip graduate courses
    if is_graduate_course(year_level):
        return None

    # Determine campus
    campus = determine_campus(course_code)
    if campus is None:
        return None  # Skip Glendon or unknown

    # Get faculty prefix and subject code
    faculty_prefix = get_faculty_prefix(course_code)
    subject_code = get_subject_code(course_code)

    # Get faculty name
    faculty_name = FACULTY_MAP.get(faculty_prefix, "Unknown")

    # Use detailed info if available, otherwise use basic
    data = detailed if detailed else course

    # Extract credits
    credits_data = data.get("credits", {})
    credits_value = credits_data.get("value", "3.00") if isinstance(credits_data, dict) else "3.00"
    try:
        credits = float(credits_value)
    except (ValueError, TypeError):
        credits = 3.0

    # Extract title
    title = data.get("title", "").strip()
    if not title:
        return None

    # Clean up course code for output (remove prefix slash)
    # "LE/EECS3101" -> "EECS3101"
    clean_code = course_code.split("/")[-1] if "/" in course_code else course_code

    # Get programs
    description = data.get("description", "")
    programs = extract_programs_from_description(description, subject_code)

    return {
        "code": clean_code,
        "name": title,
        "faculty": faculty_name,
        "programs": programs,
        "year": year_level,
        "credits": credits,
        "campus": campus,
        "full_code": course_code,  # Keep original for reference
    }


def scrape_courses(fetch_details: bool = False) -> list[dict[str, Any]]:
    """
    Main function to scrape all courses.

    Args:
        fetch_details: If True, fetch detailed info for each course (slower but more complete)
    """
    # Fetch all courses
    raw_courses = fetch_all_courses()
    logger.info(f"Total raw courses fetched: {len(raw_courses)}")

    processed_courses = []
    skipped = {"graduate": 0, "glendon": 0, "invalid": 0}

    for i, course in enumerate(raw_courses):
        course_code = course.get("__catalogCourseId", "")

        # Quick filters before fetching details
        year_level = extract_year_level(course_code)
        if is_graduate_course(year_level):
            skipped["graduate"] += 1
            continue

        faculty = get_faculty_prefix(course_code)
        if faculty in GLENDON_FACULTIES:
            skipped["glendon"] += 1
            continue

        # Fetch details if requested
        detailed = None
        if fetch_details:
            pid = course.get("pid")
            if pid:
                detailed = fetch_course_details(pid)
                time.sleep(REQUEST_DELAY)

        # Process course
        processed = process_course(course, detailed)
        if processed:
            processed_courses.append(processed)
        else:
            skipped["invalid"] += 1

        # Progress logging
        if (i + 1) % 500 == 0:
            logger.info(f"Processed {i + 1}/{len(raw_courses)} courses...")

    logger.info(f"\n=== Scraping Complete ===")
    logger.info(f"Total processed: {len(processed_courses)}")
    logger.info(f"Skipped graduate: {skipped['graduate']}")
    logger.info(f"Skipped Glendon: {skipped['glendon']}")
    logger.info(f"Skipped invalid: {skipped['invalid']}")

    return processed_courses


def validate_results(courses: list[dict[str, Any]]) -> None:
    """Validate scraped results."""
    logger.info("\n=== Validation ===")

    # Count by faculty
    faculty_counts = {}
    for course in courses:
        faculty = course["faculty"]
        faculty_counts[faculty] = faculty_counts.get(faculty, 0) + 1

    logger.info("Courses by faculty:")
    for faculty, count in sorted(faculty_counts.items(), key=lambda x: -x[1]):
        logger.info(f"  {faculty}: {count}")

    # Count by year
    year_counts = {}
    for course in courses:
        year = course["year"]
        year_counts[year] = year_counts.get(year, 0) + 1

    logger.info("\nCourses by year level:")
    for year in sorted([y for y in year_counts.keys() if y is not None]):
        logger.info(f"  Year {year}: {year_counts[year]}")
    if None in year_counts:
        logger.info(f"  Unknown year: {year_counts[None]}")

    # Count by campus
    campus_counts = {}
    for course in courses:
        campus = course["campus"]
        campus_counts[campus] = campus_counts.get(campus, 0) + 1

    logger.info("\nCourses by campus:")
    for campus, count in campus_counts.items():
        logger.info(f"  {campus}: {count}")

    # Check expected range
    total = len(courses)
    if 2000 <= total <= 4000:
        logger.info(f"\n✓ Total courses ({total}) is within expected range (2000-4000)")
    else:
        logger.warning(f"\n⚠ Total courses ({total}) is outside expected range (2000-4000)")


def main():
    """Main entry point."""
    logger.info("Starting York University course scraper...")

    # Scrape courses (without fetching individual details for speed)
    courses = scrape_courses(fetch_details=False)

    # Validate
    validate_results(courses)

    # Remove full_code from output (was for debugging)
    for course in courses:
        del course["full_code"]

    # Save to file
    output_path = Path(__file__).parent.parent / "courses_seed.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(courses, f, indent=2, ensure_ascii=False)

    logger.info(f"\n✓ Saved {len(courses)} courses to {output_path}")

    # Also print sample output
    logger.info("\nSample courses:")
    for course in courses[:5]:
        logger.info(f"  {course['code']}: {course['name']} ({course['faculty']}, {course['credits']} credits)")


if __name__ == "__main__":
    main()
