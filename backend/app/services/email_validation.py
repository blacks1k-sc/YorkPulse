"""Email validation and name matching service."""

import re


class EmailValidationService:
    """Service for validating York University emails and matching names."""

    VALID_DOMAINS = ("@yorku.ca", "@my.yorku.ca")

    def is_valid_york_email(self, email: str) -> bool:
        """Check if email is a valid York University email."""
        email_lower = email.lower()
        return any(email_lower.endswith(domain) for domain in self.VALID_DOMAINS)

    def extract_email_parts(self, email: str) -> tuple[str, str]:
        """Extract local part and domain from email.

        Returns:
            Tuple of (local_part, domain)
        """
        email_lower = email.lower()
        local_part, domain = email_lower.rsplit("@", 1)
        return local_part, domain

    def extract_name_parts_from_email(self, email: str) -> list[str]:
        """Extract potential name parts from email local part.

        Examples:
            john.smith@yorku.ca -> ["john", "smith"]
            sarah.m.jones@my.yorku.ca -> ["sarah", "m", "jones"]
            js1234@yorku.ca -> ["js"]  # Numbers stripped
            kartik.7777xyz@yorku.ca -> ["kartik", "xyz"]
        """
        local_part, _ = self.extract_email_parts(email)

        # Split by common separators
        parts = re.split(r"[._\-]", local_part)

        # Clean each part: remove numbers, keep only letters
        cleaned_parts = []
        for part in parts:
            # Remove digits
            letters_only = re.sub(r"\d+", "", part)
            if letters_only and len(letters_only) >= 1:
                cleaned_parts.append(letters_only.lower())

        return cleaned_parts

    def name_matches_email(self, name: str, email: str) -> tuple[bool, str]:
        """Check if the provided name matches patterns in the email.

        The first name MUST appear in the email. Surname is optional.

        Args:
            name: User's full name (e.g., "John Smith")
            email: York email address

        Returns:
            Tuple of (matches, reason)

        Examples:
            ("John Smith", "john.smith@yorku.ca") -> (True, "Name verified from email")
            ("John Smith", "john@yorku.ca") -> (True, "First name verified from email")
            ("John Smith", "js1234@yorku.ca") -> (False, "First name not found in email")
            ("Sarah Jones", "sarah.m.jones@yorku.ca") -> (True, "Name verified from email")
        """
        # Extract name parts
        name_parts = name.lower().split()
        if not name_parts:
            return False, "Invalid name provided"

        first_name = name_parts[0]
        email_parts = self.extract_name_parts_from_email(email)

        if not email_parts:
            return False, "Could not extract name from email"

        # Check if first name appears in email parts
        first_name_found = any(
            first_name == part or first_name.startswith(part) or part.startswith(first_name)
            for part in email_parts
            if len(part) >= 2  # Ignore single-letter parts for matching
        )

        if not first_name_found:
            # Also check if first name is contained within any email part
            first_name_found = any(first_name in part or part in first_name for part in email_parts if len(part) >= 3)

        if not first_name_found:
            return False, "First name not found in email. ID verification required."

        # Check if surname also matches (optional, but nice to confirm)
        if len(name_parts) > 1:
            surname = name_parts[-1]
            surname_found = any(
                surname == part or surname.startswith(part) or part.startswith(surname)
                for part in email_parts
                if len(part) >= 2
            )
            if surname_found:
                return True, "Full name verified from email"

        return True, "First name verified from email"

    def suggest_name_from_email(self, email: str) -> str | None:
        """Try to suggest a name from the email pattern.

        Returns:
            Suggested name or None if can't determine
        """
        parts = self.extract_name_parts_from_email(email)

        if not parts:
            return None

        # Filter out very short parts (likely initials)
        meaningful_parts = [p for p in parts if len(p) >= 3]

        if not meaningful_parts:
            return None

        # Capitalize each part
        return " ".join(p.capitalize() for p in meaningful_parts)


# Singleton instance
email_validation_service = EmailValidationService()
