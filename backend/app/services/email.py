"""Email service using Gmail SMTP for sending OTP codes."""

import ssl
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings


class EmailService:
    """Service for sending emails via Gmail SMTP (async)."""

    def is_configured(self) -> bool:
        """Check if SMTP is properly configured."""
        return bool(
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

        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Your YorkPulse Verification Code"
            msg["From"] = f"YorkPulse <{settings.email_from}>"
            msg["To"] = to_email

            # Plain text version
            text_content = f"""
Your YorkPulse verification code is: {otp_code}

This code expires in 10 minutes.

If you didn't request this code, you can safely ignore this email.
            """

            # HTML version
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333; margin-bottom: 20px;">Your YorkPulse verification code</h2>
                <p style="color: #666; margin-bottom: 20px;">Enter this code to verify your email:</p>
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
                    <h1 style="font-size: 40px; letter-spacing: 10px; font-family: 'Courier New', monospace; color: #fff; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                        {otp_code}
                    </h1>
                </div>
                <p style="color: #666; margin-bottom: 10px;">This code expires in <strong>10 minutes</strong>.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px;">If you didn't request this code, you can safely ignore this email.</p>
                <p style="color: #999; font-size: 12px;">- The YorkPulse Team</p>
            </div>
            """

            # Attach parts
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            # Create SSL context that doesn't verify certificates (for macOS compatibility)
            tls_context = ssl.create_default_context()
            tls_context.check_hostname = False
            tls_context.verify_mode = ssl.CERT_NONE

            # Send via async SMTP
            await aiosmtplib.send(
                msg,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user,
                password=settings.smtp_password,
                start_tls=True,
                tls_context=tls_context,
            )

            print(f"OTP email sent to {to_email}")
            return True, "Verification code sent to your email"

        except aiosmtplib.SMTPAuthenticationError as e:
            print(f"SMTP Auth Error: {e}")
            return False, "Email authentication failed. Please contact support."
        except aiosmtplib.SMTPException as e:
            print(f"SMTP Error: {e}")
            return False, f"Failed to send email: {str(e)}"
        except Exception as e:
            print(f"Email Error: {e}")
            return False, f"Failed to send email: {str(e)}"


# Singleton instance
email_service = EmailService()
