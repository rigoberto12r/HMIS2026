"""
Email service implementation.
Supports both SMTP and SendGrid backends.
"""

import os
from typing import List, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import logging

logger = logging.getLogger(__name__)


class EmailService:
    """
    Unified email service supporting multiple backends.
    Automatically detects configuration and uses appropriate backend.
    """

    def __init__(self):
        self.backend = self._detect_backend()
        self.from_email = os.getenv("EMAIL_FROM", "noreply@hmis.com")
        self.from_name = os.getenv("EMAIL_FROM_NAME", "HMIS Hospital")

    def _detect_backend(self) -> str:
        """Detect which email backend to use based on environment variables."""
        if os.getenv("SENDGRID_API_KEY"):
            return "sendgrid"
        elif os.getenv("SMTP_HOST"):
            return "smtp"
        else:
            logger.warning("No email backend configured. Emails will be logged only.")
            return "console"

    async def send_email(
        self,
        to: str | List[str],
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
    ) -> bool:
        """
        Send an email using the configured backend.

        Args:
            to: Recipient email(s)
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text email body (fallback)
            cc: CC recipients
            bcc: BCC recipients

        Returns:
            True if email was sent successfully, False otherwise
        """
        if isinstance(to, str):
            to = [to]

        try:
            if self.backend == "sendgrid":
                return await self._send_via_sendgrid(to, subject, html_body, text_body, cc, bcc)
            elif self.backend == "smtp":
                return await self._send_via_smtp(to, subject, html_body, text_body, cc, bcc)
            else:
                # Console backend for development
                logger.info(
                    f"\n{'='*60}\n"
                    f"EMAIL (Console Mode)\n"
                    f"From: {self.from_name} <{self.from_email}>\n"
                    f"To: {', '.join(to)}\n"
                    f"Subject: {subject}\n"
                    f"{'='*60}\n"
                    f"{text_body or html_body}\n"
                    f"{'='*60}"
                )
                return True

        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False

    async def _send_via_sendgrid(
        self,
        to: List[str],
        subject: str,
        html_body: str,
        text_body: Optional[str],
        cc: Optional[List[str]],
        bcc: Optional[List[str]],
    ) -> bool:
        """Send email via SendGrid API."""
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail, Email, To, Cc, Bcc, Content

            sg = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))

            from_email = Email(self.from_email, self.from_name)
            to_emails = [To(email) for email in to]

            message = Mail(
                from_email=from_email,
                to_emails=to_emails,
                subject=subject,
                html_content=Content("text/html", html_body),
            )

            if text_body:
                message.add_content(Content("text/plain", text_body))

            if cc:
                for email in cc:
                    message.add_cc(Cc(email))

            if bcc:
                for email in bcc:
                    message.add_bcc(Bcc(email))

            response = sg.send(message)
            return response.status_code in [200, 201, 202]

        except ImportError:
            logger.error("SendGrid library not installed. Run: pip install sendgrid")
            return False
        except Exception as e:
            logger.error(f"SendGrid error: {e}")
            return False

    async def _send_via_smtp(
        self,
        to: List[str],
        subject: str,
        html_body: str,
        text_body: Optional[str],
        cc: Optional[List[str]],
        bcc: Optional[List[str]],
    ) -> bool:
        """Send email via SMTP."""
        try:
            smtp_host = os.getenv("SMTP_HOST", "localhost")
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            smtp_user = os.getenv("SMTP_USER", "")
            smtp_password = os.getenv("SMTP_PASSWORD", "")
            use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = ", ".join(to)

            if cc:
                msg["Cc"] = ", ".join(cc)

            # Attach plain text and HTML
            if text_body:
                msg.attach(MIMEText(text_body, "plain", "utf-8"))
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            # Send via SMTP
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                if use_tls:
                    server.starttls()
                if smtp_user and smtp_password:
                    server.login(smtp_user, smtp_password)

                recipients = to + (cc or []) + (bcc or [])
                server.sendmail(self.from_email, recipients, msg.as_string())

            return True

        except Exception as e:
            logger.error(f"SMTP error: {e}")
            return False


# Singleton instance
email_service = EmailService()
