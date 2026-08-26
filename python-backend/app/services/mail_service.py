import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str) -> None:
    """Send a plain-text email. Logs and swallows failures so callers
    (e.g. gap assignment) never fail their own transaction because the
    mail server is unreachable or unconfigured."""
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_from_email:
        logger.warning("SMTP not configured; skipping email to %s (subject=%r)", to, subject)
        return

    message = EmailMessage()
    message["From"] = settings.smtp_from_email
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError):
        logger.exception("Failed to send email to %s (subject=%r)", to, subject)
