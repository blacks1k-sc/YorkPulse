#!/usr/bin/env python3
"""
York University Web Scraper for RAG Data Collection.

Scrapes York University pages, cleans content, chunks text, and saves as JSON.
"""

import json
import logging
import re
import time
import urllib3
from datetime import datetime, timezone
from pathlib import Path
from typing import TypedDict

import requests
from bs4 import BeautifulSoup, NavigableString

# Suppress SSL warnings when falling back to unverified requests
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Constants
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
REQUEST_DELAY = 2  # seconds between requests
REQUEST_TIMEOUT = 30  # seconds

# User agent to identify our scraper
USER_AGENT = "YorkPulse-RAG-Scraper/1.0 (Educational; York University Student Project)"

# URLs to scrape
URLS = [
    # ===== EXISTING 10 PAGES =====
    # Academic Calendar
    "https://calendars.students.yorku.ca/",
    "https://calendars.students.yorku.ca/2025-2026/sessional-dates",
    # About York
    "https://www.yorku.ca/about/",
    # Enrollment & Registration
    "https://registrar.yorku.ca/enrol/guide",
    "https://registrar.yorku.ca/enrol/dates/",
    # Fees
    "https://sfs.yorku.ca/fees/courses",
    # Academic Records
    "https://myacademicrecord.students.yorku.ca/transcripts",
    "https://myacademicrecord.students.yorku.ca/grades",
    # Library
    "https://www.library.yorku.ca/web/ask-services/hours/",
    "https://www.library.yorku.ca/web/",

    # ===== NEW: COMPUTER SCIENCE / LASSONDE =====
    "https://lassonde.yorku.ca/eecs/",
    "https://lassonde.yorku.ca/students/",
    "https://lassonde.yorku.ca/",
    "https://lassonde.yorku.ca/undergraduate-programs/",

    # ===== NEW: STUDENT SERVICES =====
    "https://sfs.yorku.ca/",
    "https://sfs.yorku.ca/fees/",
    "https://careers.yorku.ca/",
    "https://www.yorku.ca/students/",  # Main student hub

    # ===== NEW: STUDENT LIFE & RESOURCES =====
    "https://yfs.ca/",
    "https://www.yorku.ca/health/",
    "https://www.yorku.ca/foodservices/",
    "https://www.yorku.ca/parking/",

    # ===== NEW: ACADEMIC SUPPORT =====
    "https://www.yorku.ca/laps/",
    "https://www.yorku.ca/science/",

    # ===== NEW: ADDITIONAL STUDENT SERVICES (4 URLs) =====
    "https://www.yorku.ca/housing/",
    "https://uit.yorku.ca/help/",  # IT services (backup URL)
    "https://sfs.yorku.ca/scholarships/",  # Scholarships and awards
    "https://www.yorku.ca/news/",  # York news (backup URL)
]

# Elements to remove (navigation, footers, etc.)
REMOVE_SELECTORS = [
    "nav",
    "header",
    "footer",
    "script",
    "style",
    "noscript",
    "iframe",
    ".nav",
    ".navbar",
    ".navigation",
    ".menu",
    ".sidebar",
    ".footer",
    ".header",
    ".breadcrumb",
    ".breadcrumbs",
    ".ad",
    ".ads",
    ".advertisement",
    ".social-share",
    ".social-links",
    ".search-form",
    ".skip-link",
    ".cookie-notice",
    ".cookie-banner",
    "#nav",
    "#navbar",
    "#menu",
    "#footer",
    "#header",
    "#sidebar",
    "[role='navigation']",
    "[role='banner']",
    "[role='contentinfo']",
    "[aria-hidden='true']",
]

# Content selectors to prioritize (in order of preference)
CONTENT_SELECTORS = [
    "main",
    "article",
    "[role='main']",
    ".main-content",
    ".content",
    ".page-content",
    "#main",
    "#content",
    ".entry-content",
    ".post-content",
]


class Chunk(TypedDict):
    """A text chunk with metadata."""
    text: str
    chunk_index: int
    char_start: int
    char_end: int


class ScrapedPage(TypedDict):
    """A scraped page with content and chunks."""
    url: str
    title: str
    scraped_at: str
    content: str
    chunks: list[Chunk]


def fetch_page(url: str) -> str | None:
    """
    Fetch a page with proper headers and error handling.

    Args:
        url: The URL to fetch.

    Returns:
        The page HTML content, or None if the fetch failed.
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
    }

    try:
        logger.info(f"Fetching: {url}")
        # Try with SSL verification first, fall back to without if needed
        try:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        except requests.exceptions.SSLError:
            logger.warning(f"SSL error for {url}, retrying without verification")
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT, verify=False)
        response.raise_for_status()
        return response.text
    except requests.exceptions.Timeout:
        logger.error(f"Timeout fetching {url}")
        return None
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error {e.response.status_code} for {url}")
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error for {url}: {e}")
        return None


def clean_text(text: str) -> str:
    """
    Clean extracted text by normalizing whitespace and removing artifacts.

    Args:
        text: Raw text to clean.

    Returns:
        Cleaned text.
    """
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)

    # Remove leading/trailing whitespace
    text = text.strip()

    # Remove multiple consecutive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Remove lines that are just punctuation or very short
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        line = line.strip()
        if len(line) > 2 and not re.match(r'^[^\w\s]+$', line):
            cleaned_lines.append(line)

    return '\n'.join(cleaned_lines)


def extract_content(html: str, url: str) -> tuple[str, str]:
    """
    Extract and clean main content from HTML.

    Args:
        html: Raw HTML content.
        url: The source URL (for logging).

    Returns:
        Tuple of (title, cleaned_content).
    """
    soup = BeautifulSoup(html, 'lxml')

    # Get the page title
    title_tag = soup.find('title')
    title = title_tag.get_text(strip=True) if title_tag else "Untitled"

    # Remove unwanted elements
    for selector in REMOVE_SELECTORS:
        for element in soup.select(selector):
            element.decompose()

    # Try to find the main content area
    main_content = None
    for selector in CONTENT_SELECTORS:
        main_content = soup.select_one(selector)
        if main_content:
            logger.debug(f"Found content using selector: {selector}")
            break

    # Fall back to body if no main content area found
    if not main_content:
        main_content = soup.body or soup
        logger.debug("Using body as content container")

    # Extract text while preserving structure
    content_parts = []
    current_heading = ""

    for element in main_content.descendants:
        if isinstance(element, NavigableString):
            continue

        # Track headings for context
        if element.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            heading_text = element.get_text(strip=True)
            if heading_text:
                current_heading = heading_text
                # Add heading with markdown-style formatting
                level = int(element.name[1])
                content_parts.append(f"\n{'#' * level} {heading_text}\n")

        # Extract paragraphs
        elif element.name == 'p':
            text = element.get_text(strip=True)
            if text and len(text) > 10:
                content_parts.append(text)

        # Extract list items
        elif element.name == 'li':
            text = element.get_text(strip=True)
            if text:
                content_parts.append(f"- {text}")

        # Extract table cells (for FAQ-style content)
        elif element.name in ['td', 'th']:
            text = element.get_text(strip=True)
            if text and len(text) > 5:
                content_parts.append(text)

        # Extract definition lists
        elif element.name == 'dt':
            text = element.get_text(strip=True)
            if text:
                content_parts.append(f"**{text}**")
        elif element.name == 'dd':
            text = element.get_text(strip=True)
            if text:
                content_parts.append(text)

    # Join and clean the content
    raw_content = '\n'.join(content_parts)
    cleaned_content = clean_text(raw_content)

    # If we got very little content, try a more aggressive extraction
    if len(cleaned_content) < 200:
        logger.warning(f"Limited content extracted ({len(cleaned_content)} chars), trying fallback")
        fallback_content = main_content.get_text(separator='\n', strip=True)
        fallback_cleaned = clean_text(fallback_content)
        if len(fallback_cleaned) > len(cleaned_content):
            cleaned_content = fallback_cleaned

    logger.info(f"Extracted {len(cleaned_content)} characters from {url}")
    return title, cleaned_content


def find_sentence_boundary(text: str, position: int, direction: str = "forward") -> int:
    """
    Find the nearest sentence boundary from a position.

    Args:
        text: The text to search.
        position: Starting position.
        direction: "forward" or "backward".

    Returns:
        Position of the sentence boundary.
    """
    sentence_endings = re.compile(r'[.!?]\s+')

    if direction == "forward":
        # Look forward for sentence end
        match = sentence_endings.search(text, position)
        if match:
            return match.end()
        return len(text)
    else:
        # Look backward for sentence end
        text_before = text[:position]
        matches = list(sentence_endings.finditer(text_before))
        if matches:
            return matches[-1].end()
        return 0


def chunk_text(content: str, current_heading: str = "") -> list[Chunk]:
    """
    Split text into overlapping chunks, respecting sentence boundaries.

    Args:
        content: The text to chunk.
        current_heading: Current section heading for context.

    Returns:
        List of chunks with metadata.
    """
    chunks: list[Chunk] = []

    if not content:
        return chunks

    # Track the current position
    position = 0
    chunk_index = 0
    content_length = len(content)

    # Track the current section heading
    heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)

    while position < content_length:
        # Determine chunk end position
        chunk_end = min(position + CHUNK_SIZE, content_length)

        # If not at the end, find a sentence boundary
        if chunk_end < content_length:
            # Try to find a sentence boundary near the target chunk size
            boundary = find_sentence_boundary(content, chunk_end, "forward")

            # Don't extend too far beyond target size
            if boundary - position > CHUNK_SIZE * 1.5:
                # Look backward instead
                boundary = find_sentence_boundary(content, chunk_end, "backward")
                if boundary <= position:
                    boundary = chunk_end  # Just use the position if no good boundary

            chunk_end = boundary

        # Extract the chunk text
        chunk_content = content[position:chunk_end].strip()

        # Find any heading in this chunk to use as context
        heading_match = heading_pattern.search(chunk_content)
        if heading_match:
            current_heading = heading_match.group(2)

        # Prepend section heading for context if available and not already in chunk
        if current_heading and current_heading not in chunk_content:
            chunk_content = f"[Section: {current_heading}]\n{chunk_content}"

        if chunk_content and len(chunk_content) > 50:  # Skip tiny chunks
            chunks.append({
                "text": chunk_content,
                "chunk_index": chunk_index,
                "char_start": position,
                "char_end": chunk_end,
            })
            chunk_index += 1

        # Calculate next position - move forward by chunk size minus overlap
        # But ensure we always make progress
        next_position = chunk_end - CHUNK_OVERLAP
        if next_position <= position:
            next_position = chunk_end  # No overlap if chunk was small

        # If remaining content is less than minimum chunk size, include it in current chunk
        if content_length - next_position < 100:
            break

        position = next_position

    logger.info(f"Created {len(chunks)} chunks")
    return chunks


def scrape_page(url: str) -> ScrapedPage | None:
    """
    Scrape a single page and return structured data.

    Args:
        url: The URL to scrape.

    Returns:
        ScrapedPage data, or None if scraping failed.
    """
    html = fetch_page(url)
    if not html:
        return None

    title, content = extract_content(html, url)
    chunks = chunk_text(content)

    return {
        "url": url,
        "title": title,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "content": content,
        "chunks": chunks,
    }


def scrape_all(urls: list[str], output_path: Path) -> list[ScrapedPage]:
    """
    Scrape all URLs and save results.

    Args:
        urls: List of URLs to scrape.
        output_path: Path to save the JSON output.

    Returns:
        List of scraped pages.
    """
    results: list[ScrapedPage] = []
    failed_urls: list[str] = []

    for i, url in enumerate(urls):
        logger.info(f"Processing {i + 1}/{len(urls)}: {url}")

        page_data = scrape_page(url)

        if page_data:
            results.append(page_data)
            logger.info(f"Successfully scraped: {page_data['title']}")
        else:
            failed_urls.append(url)
            logger.warning(f"Failed to scrape: {url}")

        # Respectful delay between requests
        if i < len(urls) - 1:
            logger.debug(f"Waiting {REQUEST_DELAY}s before next request...")
            time.sleep(REQUEST_DELAY)

    # Save results
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved {len(results)} pages to {output_path}")

    # Report failures
    if failed_urls:
        logger.warning(f"Failed URLs: {failed_urls}")

    return results


def main():
    """Main entry point."""
    output_path = Path(__file__).parent.parent / "data" / "scraped" / "york_data.json"

    logger.info("Starting York University web scraper...")
    logger.info(f"Target URLs: {len(URLS)}")
    logger.info(f"Output: {output_path}")

    results = scrape_all(URLS, output_path)

    # Print summary
    print("\n" + "=" * 60)
    print("SCRAPING COMPLETE")
    print("=" * 60)
    print(f"Pages scraped: {len(results)}/{len(URLS)}")
    print(f"Output file: {output_path}")

    total_content = sum(len(p['content']) for p in results)
    total_chunks = sum(len(p['chunks']) for p in results)
    print(f"Total content: {total_content:,} characters")
    print(f"Total chunks: {total_chunks}")

    for page in results:
        print(f"\n  - {page['title']}")
        print(f"    URL: {page['url']}")
        print(f"    Content: {len(page['content']):,} chars")
        print(f"    Chunks: {len(page['chunks'])}")


if __name__ == "__main__":
    main()
