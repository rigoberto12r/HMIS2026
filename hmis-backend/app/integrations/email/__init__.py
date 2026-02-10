"""
Email integration module.
Supports SMTP and SendGrid for sending transactional emails.
"""

from .service import EmailService
from .templates import EmailTemplate

__all__ = ["EmailService", "EmailTemplate"]
