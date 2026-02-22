"""Supabase Auth service for OTP verification."""

import random
import string
from datetime import datetime, timedelta

from supabase import create_client, Client
from supabase_auth.errors import AuthApiError

from app.core.config import settings
from app.services.email import email_service


# In-memory OTP storage (used for both dev mode and Resend-based OTP)
_otps: dict[str, tuple[str, datetime]] = {}


class SupabaseAuthService:
    """Service for handling Supabase Auth OTP operations."""

    def __init__(self):
        self._client: Client | None = None

    @property
    def client(self) -> Client:
        """Lazy initialization of Supabase client."""
        if self._client is None:
            if not settings.supabase_url or not settings.supabase_key:
                raise ValueError("Supabase URL and key must be configured")
            self._client = create_client(settings.supabase_url, settings.supabase_key)
        return self._client

    def is_configured(self) -> bool:
        """Check if Supabase is properly configured."""
        return bool(settings.supabase_url and settings.supabase_key)

    def _generate_otp(self, email: str) -> str:
        """Generate a 6-digit OTP and store it."""
        otp = ''.join(random.choices(string.digits, k=6))
        _otps[email.lower()] = (otp, datetime.utcnow() + timedelta(minutes=10))
        return otp

    def _verify_stored_otp(self, email: str, code: str) -> bool:
        """Verify OTP against stored value."""
        email_lower = email.lower()
        if email_lower not in _otps:
            return False
        stored_otp, expiry = _otps[email_lower]
        if datetime.utcnow() > expiry:
            del _otps[email_lower]
            return False
        if stored_otp == code:
            del _otps[email_lower]
            return True
        return False

    async def send_otp(self, email: str, force_dev_mode: bool = False) -> tuple[bool, str]:
        """
        Send OTP code to email.

        Priority:
        1. Dev mode (debug or force_dev_mode): Returns OTP directly for testing
        2. Resend configured: Sends OTP via Resend email
        3. Fallback: Uses Supabase magic link

        Args:
            email: The user's email
            force_dev_mode: If True, use local OTP even if DEBUG=false

        Returns:
            tuple: (success, message)
        """
        # Development mode or forced dev mode: generate OTP locally and return it
        if settings.debug or force_dev_mode:
            otp = self._generate_otp(email)
            return True, f"[DEV MODE] Your verification code is: {otp}"

        # If Resend is configured, use it to send OTP emails
        if email_service.is_configured():
            otp = self._generate_otp(email)
            success, message = await email_service.send_otp_email(email, otp)
            return success, message

        # Fallback to Supabase (sends magic link, not ideal)
        try:
            response = self.client.auth.sign_in_with_otp({
                "email": email,
                "options": {
                    "should_create_user": True,
                }
            })
            return True, "Verification code sent to your email"
        except AuthApiError as e:
            return False, str(e.message)
        except Exception as e:
            return False, f"Failed to send verification code: {str(e)}"

    async def verify_otp(self, email: str, token: str, force_dev_mode: bool = False) -> tuple[bool, str, dict | None]:
        """
        Verify OTP code.

        Args:
            email: The user's email
            token: The 6-digit OTP code
            force_dev_mode: If True, verify against local OTP even if DEBUG=false

        Returns:
            tuple: (success, message, session_data)
        """
        # Development mode or forced dev mode: verify against local OTP storage
        if settings.debug or force_dev_mode:
            if self._verify_stored_otp(email, token):
                return True, "Email verified successfully", {
                    "dev_mode": True,
                }
            else:
                return False, "Invalid or expired verification code.", None

        # If Resend is configured, verify against our stored OTPs
        if email_service.is_configured():
            if self._verify_stored_otp(email, token):
                return True, "Email verified successfully", {
                    "verified_via": "resend",
                }
            else:
                return False, "Invalid or expired verification code.", None

        # Fallback to Supabase verification
        try:
            response = self.client.auth.verify_otp({
                "email": email,
                "token": token,
                "type": "email"
            })

            if response.session:
                return True, "Email verified successfully", {
                    "access_token": response.session.access_token,
                    "refresh_token": response.session.refresh_token,
                    "expires_in": response.session.expires_in,
                }
            else:
                return False, "Verification failed", None

        except AuthApiError as e:
            error_msg = str(e.message)
            if "expired" in error_msg.lower():
                return False, "Verification code has expired. Please request a new one.", None
            elif "invalid" in error_msg.lower():
                return False, "Invalid verification code. Please check and try again.", None
            return False, error_msg, None
        except Exception as e:
            return False, f"Verification failed: {str(e)}", None

    async def resend_otp(self, email: str, force_dev_mode: bool = False) -> tuple[bool, str]:
        """
        Resend OTP code.

        This is the same as send_otp but with a clearer name for the resend flow.
        """
        return await self.send_otp(email, force_dev_mode)


# Singleton instance
supabase_auth_service = SupabaseAuthService()
