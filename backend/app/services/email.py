"""Email service using Resend for sending OTP codes."""

import resend
from app.core.config import settings


class EmailService:
    """Service for sending emails via Resend."""

    def __init__(self):
        if settings.resend_api_key:
            resend.api_key = settings.resend_api_key

    def is_configured(self) -> bool:
        """Check if Resend is properly configured."""
        return bool(settings.resend_api_key)

    async def send_otp_email(self, to_email: str, otp_code: str) -> tuple[bool, str]:
        """
        Send OTP code via email using Resend.

        Args:
            to_email: Recipient email address
            otp_code: The 6-digit OTP code

        Returns:
            tuple: (success, message)
        """
        if not self.is_configured():
            return False, "Email service not configured"

        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333; margin-bottom: 20px;">Your YorkPulse verification code</h2>
                <p style="color: #666; margin-bottom: 20px;">Enter this code to verify your email:</p>
                <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
                    <h1 style="font-size: 36px; letter-spacing: 8px; font-family: monospace; color: #333; margin: 0;">
                        {otp_code}
                    </h1>
                </div>
                <p style="color: #666; margin-bottom: 10px;">This code expires in 10 minutes.</p>
                <p style="color: #999; font-size: 12px;">If you didn't request this code, you can safely ignore this email.</p>
            </div>
            """

            params = {
                "from": "YorkPulse <onboarding@resend.dev>",
                "to": [to_email],
                "subject": "Your YorkPulse Verification Code",
                "html": html_content,
            }

            email = resend.Emails.send(params)

            if email and email.get("id"):
                return True, "Verification code sent to your email"
            else:
                return False, "Failed to send email"

        except Exception as e:
            return False, f"Failed to send email: {str(e)}"


# Singleton instance
email_service = EmailService()
