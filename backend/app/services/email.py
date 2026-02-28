"""Email service — Resend API (primary) with Gmail SMTP fallback."""

import logging
import ssl
import certifi
import aiosmtplib
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via Resend API or Gmail SMTP."""

    def is_configured(self) -> bool:
        """Check if any email method is configured."""
        return bool(settings.resend_api_key) or bool(
            settings.smtp_host
            and settings.smtp_user
            and settings.smtp_password
            and settings.email_from
        )

    async def send_otp_email(self, to_email: str, otp_code: str) -> tuple[bool, str]:
        """
        Send OTP code via email using Gmail SMTP (async).

        Args:
            to_email: Recipient email address
            otp_code: The 6-digit OTP code

        Returns:
            tuple: (success, message)
        """
        if not self.is_configured():
            return False, "Email service not configured"

        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; margin-bottom: 20px;">Your YorkPulse verification code</h2>
            <p style="color: #666; margin-bottom: 20px;">Enter this code to verify your email:</p>
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
                <h1 style="font-size: 40px; letter-spacing: 10px; font-family: 'Courier New', monospace; color: #fff; margin: 0;">
                    {otp_code}
                </h1>
            </div>
            <p style="color: #666; margin-bottom: 10px;">This code expires in <strong>10 minutes</strong>.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">If you didn't request this code, you can safely ignore this email.</p>
            <p style="color: #999; font-size: 12px;">- The YorkPulse Team</p>
        </div>
        """
        text_content = f"Your YorkPulse verification code is: {otp_code}\n\nThis code expires in 10 minutes."

        # Try Resend API first (works on all hosting platforms)
        if settings.resend_api_key:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                        json={
                            "from": f"YorkPulse <{settings.email_from or 'onboarding@resend.dev'}>",
                            "to": [to_email],
                            "subject": "Your YorkPulse Verification Code",
                            "html": html_content,
                            "text": text_content,
                        },
                        timeout=10,
                    )
                if response.status_code in (200, 201):
                    logger.info("OTP email sent via Resend to %s", to_email)
                    return True, "Verification code sent to your email"
                logger.warning("Resend API error %s: %s", response.status_code, response.text)
            except Exception as e:
                logger.warning("Resend send failed, trying SMTP: %s", e)

        # Fallback: Gmail SMTP
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Your YorkPulse Verification Code"
            msg["From"] = f"YorkPulse <{settings.email_from}>"
            msg["To"] = to_email
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            tls_context = ssl.create_default_context(cafile=certifi.where())
            await aiosmtplib.send(
                msg,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user,
                password=settings.smtp_password,
                start_tls=True,
                tls_context=tls_context,
            )
            logger.info("OTP email sent via SMTP to %s", to_email)
            return True, "Verification code sent to your email"

        except aiosmtplib.SMTPAuthenticationError as e:
            logger.error("SMTP authentication error: %s", e)
            return False, "Email authentication failed. Please contact support."
        except aiosmtplib.SMTPException as e:
            logger.error("SMTP error: %s", e)
            return False, f"Failed to send email: {str(e)}"
        except Exception as e:
            logger.error("Email send error: %s", e)
            return False, f"Failed to send email: {str(e)}"


# Singleton instance
email_service = EmailService()
