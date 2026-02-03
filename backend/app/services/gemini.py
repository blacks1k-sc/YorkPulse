"""Gemini AI service for ID verification and content moderation."""

import base64
import re
from typing import Literal

import google.generativeai as genai
import httpx

from app.core.config import settings


class GeminiService:
    """Service for Gemini AI operations."""

    def __init__(self):
        self.api_key = settings.gemini_api_key
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel("gemini-2.0-flash")
        else:
            self.model = None

    async def extract_name_from_id(self, image_url: str) -> tuple[bool, str | None, str]:
        """Extract name from student ID photo using Gemini Vision.

        Args:
            image_url: URL to the student ID image (S3 presigned URL)

        Returns:
            Tuple of (success, extracted_name, message)
        """
        if not self.model:
            return False, None, "Gemini API not configured"

        try:
            # Download image
            async with httpx.AsyncClient() as client:
                response = await client.get(image_url)
                if response.status_code != 200:
                    return False, None, "Failed to download image"
                image_data = response.content

            # Encode image to base64
            image_base64 = base64.b64encode(image_data).decode("utf-8")

            # Determine mime type from URL or default to JPEG
            mime_type = "image/jpeg"
            if ".png" in image_url.lower():
                mime_type = "image/png"
            elif ".webp" in image_url.lower():
                mime_type = "image/webp"

            # Create the prompt for name extraction
            prompt = """Analyze this student ID card image and extract the student's full name.

Rules:
1. Look for the name field on the ID card
2. The name is typically near the photo or at the top of the card
3. Ignore student numbers, expiry dates, and other fields
4. Return ONLY the full name, nothing else
5. If you cannot find a clear name, respond with "UNABLE_TO_EXTRACT"
6. Format the name with proper capitalization (e.g., "John Smith" not "JOHN SMITH")

Respond with ONLY the name or "UNABLE_TO_EXTRACT". No explanations."""

            # Call Gemini Vision API
            response = self.model.generate_content(
                [
                    prompt,
                    {"mime_type": mime_type, "data": image_base64},
                ]
            )

            extracted_text = response.text.strip()

            # Validate the response
            if extracted_text == "UNABLE_TO_EXTRACT" or not extracted_text:
                return False, None, "Could not extract name from ID. Please ensure the image is clear."

            # Clean and validate the name
            name = self._clean_extracted_name(extracted_text)
            if not name:
                return False, None, "Extracted text does not appear to be a valid name"

            return True, name, "Name successfully extracted from ID"

        except Exception as e:
            return False, None, f"Error processing ID: {str(e)}"

    def _clean_extracted_name(self, text: str) -> str | None:
        """Clean and validate an extracted name."""
        # Remove any non-letter characters except spaces, hyphens, apostrophes
        cleaned = re.sub(r"[^a-zA-Z\s\-']", "", text)
        cleaned = " ".join(cleaned.split())  # Normalize whitespace

        # Validate: should have at least 2 parts (first and last name)
        parts = cleaned.split()
        if len(parts) < 2:
            return None

        # Should be reasonable length
        if len(cleaned) < 3 or len(cleaned) > 100:
            return None

        # Capitalize properly
        return " ".join(part.capitalize() for part in parts)

    async def moderate_content(
        self, content: str
    ) -> tuple[bool, list[str]]:
        """Check content for policy violations.

        Args:
            content: Text content to moderate

        Returns:
            Tuple of (is_safe, list_of_violations)
        """
        if not self.model:
            # If no API key, allow content (will rely on community moderation)
            return True, []

        try:
            prompt = f"""Analyze the following content for policy violations. Check for:
1. Personal information (email addresses, phone numbers, addresses)
2. Explicit sexual content
3. Hate speech or slurs
4. Threats of violence
5. Spam or advertising

Content to analyze:
---
{content}
---

Respond in this exact format:
SAFE: true/false
VIOLATIONS: [list each violation type found, or "none"]

Be strict about personal information but lenient on casual language."""

            response = self.model.generate_content(prompt)
            result = response.text.strip()

            # Parse response
            is_safe = "SAFE: true" in result.lower()
            violations = []

            if "VIOLATIONS:" in result:
                violations_text = result.split("VIOLATIONS:")[-1].strip()
                if violations_text.lower() != "none" and violations_text != "[]":
                    # Extract violations
                    violations = [v.strip() for v in violations_text.strip("[]").split(",") if v.strip()]

            return is_safe, violations

        except Exception:
            # On error, allow content
            return True, []

    async def check_for_pii(self, content: str) -> tuple[bool, list[str]]:
        """Quick check for personal identifiable information.

        Args:
            content: Text to check

        Returns:
            Tuple of (has_pii, list_of_pii_types_found)
        """
        pii_found = []

        # Email pattern
        if re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", content):
            pii_found.append("email")

        # Phone pattern (various formats)
        if re.search(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b", content):
            pii_found.append("phone")

        # Address patterns (simplified)
        if re.search(r"\b\d+\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd)\b", content, re.I):
            pii_found.append("address")

        return len(pii_found) > 0, pii_found


# Singleton instance
gemini_service = GeminiService()
