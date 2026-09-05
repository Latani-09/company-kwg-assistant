from types import SimpleNamespace

import smtplib
from unittest.mock import Mock

from app.services import mail_service


def smtp_settings(**overrides):
    values = {
        "smtp_host": "smtp.example.com",
        "smtp_port": 587,
        "smtp_from_email": "assistant@example.com",
        "smtp_use_tls": True,
        "smtp_username": "smtp-user",
        "smtp_password": "smtp-password",
    }
    return SimpleNamespace(**{**values, **overrides})


def test_send_email_skips_when_smtp_is_not_configured(monkeypatch, caplog):
    smtp_factory = Mock()
    monkeypatch.setattr(mail_service, "get_settings", lambda: smtp_settings(smtp_host=""))
    monkeypatch.setattr(mail_service.smtplib, "SMTP", smtp_factory)

    mail_service.send_email("user@example.com", "Subject", "Body")

    assert "SMTP not configured" in caplog.text
    smtp_factory.assert_not_called()


def test_send_email_uses_tls_authentication_and_message(monkeypatch):
    class FakeSMTP:
        def __init__(self, host, port, timeout):
            self.connection = (host, port, timeout)
            self.tls_started = False
            self.credentials = None
            self.message = None

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def starttls(self):
            self.tls_started = True

        def login(self, username, password):
            self.credentials = (username, password)

        def send_message(self, message):
            self.message = message

    smtp_instances = []

    def smtp_factory(host, port, timeout):
        smtp = FakeSMTP(host, port, timeout)
        smtp_instances.append(smtp)
        return smtp

    monkeypatch.setattr(mail_service, "get_settings", lambda: smtp_settings())
    monkeypatch.setattr(mail_service.smtplib, "SMTP", smtp_factory)

    mail_service.send_email("user@example.com", "Subject", "Body")

    smtp = smtp_instances[0]
    assert smtp.connection == ("smtp.example.com", 587, 10)
    assert smtp.tls_started is True
    assert smtp.credentials == ("smtp-user", "smtp-password")
    assert smtp.message["To"] == "user@example.com"
    assert smtp.message["From"] == "assistant@example.com"
    assert smtp.message["Subject"] == "Subject"
    assert smtp.message.get_content().strip() == "Body"


def test_send_email_can_skip_tls_and_auth(monkeypatch):
    calls = []

    class FakeSMTP:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def starttls(self):
            calls.append("tls")

        def login(self, username, password):
            calls.append("login")

        def send_message(self, message):
            calls.append("send")

    monkeypatch.setattr(
        mail_service,
        "get_settings",
        lambda: smtp_settings(smtp_use_tls=False, smtp_username=""),
    )
    monkeypatch.setattr(mail_service.smtplib, "SMTP", lambda *args, **kwargs: FakeSMTP())

    mail_service.send_email("user@example.com", "Subject", "Body")

    assert calls == ["send"]


def test_send_email_swallows_smtp_failures(monkeypatch, caplog):
    class FailingSMTP:
        def __enter__(self):
            raise smtplib.SMTPException("connection failed")

        def __exit__(self, exc_type, exc_value, traceback):
            return False

    monkeypatch.setattr(mail_service, "get_settings", lambda: smtp_settings())
    monkeypatch.setattr(mail_service.smtplib, "SMTP", lambda *args, **kwargs: FailingSMTP())

    mail_service.send_email("user@example.com", "Subject", "Body")

    assert "Failed to send email" in caplog.text
