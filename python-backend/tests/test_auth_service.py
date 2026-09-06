from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core.security import decode_access_token, hash_password, hash_reset_token, verify_password
from app.db.models.password_reset import PasswordReset
from app.db.models.sector import Sector
from app.db.models.user import User, UserStatus
from app.schemas.user import SignupSectorInput, UserSignup
from app.services import auth_service


def signup_payload(**overrides) -> UserSignup:
    values = {
        "name": "New User",
        "email": "new.user@example.com",
        "username": "new-user",
        "password": "correct-password",
        "position": "Analyst",
        "sectors": [SignupSectorInput(key="product")],
    }
    return UserSignup(**{**values, **overrides})


def add_login_user(db_session, *, status: UserStatus = UserStatus.granted) -> User:
    user = User(
        name="Login User",
        email="login.user@example.com",
        username="login-user",
        password_hash=hash_password("correct-password"),
        position="Analyst",
        status=status,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_signup_creates_pending_user_and_assigns_existing_sector(db_session, seeded_sector):
    user = auth_service.signup(db_session, signup_payload())

    assert user.status == UserStatus.pending
    assert user.password_hash != "correct-password"
    assert [sector.id for sector in user.sectors] == [seeded_sector.id]


def test_signup_creates_custom_other_sector(db_session):
    user = auth_service.signup(
        db_session,
        signup_payload(
            sectors=[SignupSectorInput(key="other", label="People Operations")],
        ),
    )

    sector = db_session.query(Sector).filter(Sector.key == "people-operations").one()

    assert sector.label == "People Operations"
    assert sector.is_custom is True
    assert [item.id for item in user.sectors] == [sector.id]


def test_signup_rejects_duplicate_email(db_session, seeded_user):
    with pytest.raises(HTTPException) as error:
        auth_service.signup(
            db_session,
            signup_payload(email=seeded_user.email, username="different-user"),
        )

    assert error.value.status_code == 400
    assert error.value.detail == "Email already registered"


def test_signup_rejects_duplicate_username(db_session, seeded_user):
    with pytest.raises(HTTPException) as error:
        auth_service.signup(
            db_session,
            signup_payload(email="different@example.com", username=seeded_user.username),
        )

    assert error.value.status_code == 400
    assert error.value.detail == "Username already taken"


def test_login_returns_access_token_for_granted_user(db_session):
    user = add_login_user(db_session)

    token = auth_service.login(db_session, user.username, "correct-password")

    assert decode_access_token(token) == user.id


def test_login_rejects_invalid_password(db_session):
    user = add_login_user(db_session)

    with pytest.raises(HTTPException) as error:
        auth_service.login(db_session, user.username, "wrong-password")

    assert error.value.status_code == 401
    assert error.value.detail == "Incorrect username or password"


def test_change_password_updates_hash(db_session):
    user = add_login_user(db_session)

    auth_service.change_password(db_session, user, "correct-password", "new-password")

    assert auth_service.login(db_session, user.username, "new-password")


def test_change_password_rejects_incorrect_current_password(db_session):
    user = add_login_user(db_session)

    with pytest.raises(HTTPException) as error:
        auth_service.change_password(db_session, user, "wrong-password", "new-password")

    assert error.value.status_code == 400
    assert error.value.detail == "Current password is incorrect"


def test_login_rejects_missing_user(db_session):
    with pytest.raises(HTTPException) as error:
        auth_service.login(db_session, "missing-user", "correct-password")

    assert error.value.status_code == 401
    assert error.value.detail == "Incorrect username or password"


@pytest.mark.parametrize(
    ("status", "detail"),
    [
        (UserStatus.pending, "pending_access"),
        (UserStatus.revoked, "access_revoked"),
    ],
)
def test_login_rejects_unavailable_accounts(db_session, status, detail):
    user = add_login_user(db_session, status=status)

    with pytest.raises(HTTPException) as error:
        auth_service.login(db_session, user.username, "correct-password")

    assert error.value.status_code == 403
    assert error.value.detail == detail


def test_request_password_reset_sends_email_with_deep_link(db_session, seeded_user, monkeypatch):
    monkeypatch.setattr(
        auth_service,
        "get_settings",
        lambda: SimpleNamespace(app_base_url="https://app.example.com", password_reset_expire_minutes=30),
    )
    sent = []
    monkeypatch.setattr(auth_service, "send_email", lambda **message: sent.append(message))

    auth_service.request_password_reset(db_session, seeded_user.email)

    reset = db_session.query(PasswordReset).filter(PasswordReset.user_id == seeded_user.id).one()
    assert reset.used_at is None
    assert reset.expires_at > datetime.now(timezone.utc)

    assert len(sent) == 1
    assert sent[0]["to"] == seeded_user.email
    assert f"uid={seeded_user.id}" in sent[0]["body"]
    assert f"username={seeded_user.username}" in sent[0]["body"]


def test_request_password_reset_is_silent_for_unknown_email(db_session, monkeypatch):
    sent = []
    monkeypatch.setattr(auth_service, "send_email", lambda **message: sent.append(message))

    auth_service.request_password_reset(db_session, "nobody@example.com")

    assert sent == []
    assert db_session.query(PasswordReset).count() == 0


def test_request_password_reset_invalidates_previous_tokens(db_session, seeded_user, monkeypatch):
    monkeypatch.setattr(auth_service, "send_email", lambda **message: None)

    auth_service.request_password_reset(db_session, seeded_user.email)
    first = db_session.query(PasswordReset).filter(PasswordReset.user_id == seeded_user.id).one()

    auth_service.request_password_reset(db_session, seeded_user.email)

    remaining = db_session.query(PasswordReset).filter(PasswordReset.user_id == seeded_user.id).all()
    assert len(remaining) == 1
    assert remaining[0].id != first.id


def test_reset_password_updates_hash_and_consumes_token(db_session, seeded_user):
    token = "a-valid-token"
    reset = PasswordReset(
        user_id=seeded_user.id,
        token_hash=hash_reset_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    db_session.add(reset)
    db_session.commit()

    auth_service.reset_password(db_session, seeded_user.id, seeded_user.username, token, "brand-new-password")

    db_session.refresh(seeded_user)
    db_session.refresh(reset)
    assert verify_password("brand-new-password", seeded_user.password_hash)
    assert reset.used_at is not None


def test_reset_password_rejects_wrong_token(db_session, seeded_user):
    reset = PasswordReset(
        user_id=seeded_user.id,
        token_hash=hash_reset_token("correct-token"),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    db_session.add(reset)
    db_session.commit()

    with pytest.raises(HTTPException) as error:
        auth_service.reset_password(db_session, seeded_user.id, seeded_user.username, "wrong-token", "new-password")

    assert error.value.status_code == 400


def test_reset_password_rejects_expired_token(db_session, seeded_user):
    token = "expired-token"
    reset = PasswordReset(
        user_id=seeded_user.id,
        token_hash=hash_reset_token(token),
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
    )
    db_session.add(reset)
    db_session.commit()

    with pytest.raises(HTTPException) as error:
        auth_service.reset_password(db_session, seeded_user.id, seeded_user.username, token, "new-password")

    assert error.value.status_code == 400


def test_reset_password_rejects_reused_token(db_session, seeded_user):
    token = "single-use-token"
    reset = PasswordReset(
        user_id=seeded_user.id,
        token_hash=hash_reset_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        used_at=datetime.now(timezone.utc),
    )
    db_session.add(reset)
    db_session.commit()

    with pytest.raises(HTTPException) as error:
        auth_service.reset_password(db_session, seeded_user.id, seeded_user.username, token, "new-password")

    assert error.value.status_code == 400


def test_reset_password_rejects_username_mismatch(db_session, seeded_user):
    token = "mismatched-username-token"
    reset = PasswordReset(
        user_id=seeded_user.id,
        token_hash=hash_reset_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    db_session.add(reset)
    db_session.commit()

    with pytest.raises(HTTPException) as error:
        auth_service.reset_password(db_session, seeded_user.id, "someone-else", token, "new-password")

    assert error.value.status_code == 400
