from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
from jose import jwt

from app.core import security
from app.core import deps
from app.db import base
from app.db.models.user import UserStatus


def test_decode_access_token_rejects_token_without_subject():
    token = jwt.encode({"exp": datetime.now(timezone.utc) + timedelta(minutes=5)}, "dev-secret-change-me", algorithm="HS256")

    assert security.decode_access_token(token) is None


def test_decode_access_token_rejects_invalid_subject():
    token = jwt.encode(
        {"sub": "not-a-uuid", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        "dev-secret-change-me",
        algorithm="HS256",
    )

    assert security.decode_access_token(token) is None


def test_decode_access_token_rejects_expired_token():
    token = jwt.encode(
        {"sub": str(uuid4()), "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        "dev-secret-change-me",
        algorithm="HS256",
    )

    assert security.decode_access_token(token) is None


def test_get_db_closes_session_after_success(monkeypatch):
    class FakeSession:
        def __init__(self):
            self.closed = False

        def close(self):
            self.closed = True

    session = FakeSession()
    monkeypatch.setattr(base, "SessionLocal", lambda: session)

    yielded = base.get_db()
    assert next(yielded) is session
    yielded.close()

    assert session.closed is True


def test_get_db_closes_session_after_exception(monkeypatch):
    class FakeSession:
        def __init__(self):
            self.closed = False

        def close(self):
            self.closed = True

    session = FakeSession()
    monkeypatch.setattr(base, "SessionLocal", lambda: session)

    yielded = base.get_db()
    next(yielded)
    try:
        yielded.throw(RuntimeError("request failed"))
    except RuntimeError:
        pass

    assert session.closed is True


def test_current_user_rejects_missing_database_user(db_session, monkeypatch):
    monkeypatch.setattr(deps, "decode_access_token", lambda token: uuid4())

    try:
        deps.get_current_user("token", db_session)
    except HTTPException as error:
        assert error.status_code == 401
    else:
        raise AssertionError("Expected missing users to be rejected")


def test_current_user_rejects_non_granted_user(db_session, seeded_user, monkeypatch):
    seeded_user.status = UserStatus.pending
    db_session.commit()
    monkeypatch.setattr(deps, "decode_access_token", lambda token: seeded_user.id)

    try:
        deps.get_current_user("token", db_session)
    except HTTPException as error:
        assert error.status_code == 403
        assert error.detail == "Account access is not granted"
    else:
        raise AssertionError("Expected non-granted users to be rejected")
