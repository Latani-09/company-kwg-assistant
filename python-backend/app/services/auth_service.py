import re
import uuid
from datetime import datetime, timedelta, timezone
from html import escape
from urllib.parse import quote

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
)
from app.db.models.password_reset import PasswordReset
from app.db.models.sector import Sector
from app.db.models.user import User, UserStatus
from app.db.models.user_sector import UserSector
from app.schemas.user import UserSignup
from app.services.mail_service import send_email


def _slugify(label: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", label.strip().lower()).strip("-")
    return slug or uuid.uuid4().hex[:8]


def _resolve_sector(db: Session, key: str, label: str | None) -> Sector:
    sector = db.query(Sector).filter(Sector.key == key).first()
    if sector:
        return sector

    # Unknown key means a custom "Other" sector — create it on demand.
    display_label = label or key
    slug_key = _slugify(display_label)
    sector = db.query(Sector).filter(Sector.key == slug_key).first()
    if sector:
        return sector

    sector = Sector(key=slug_key, label=display_label, is_custom=True)
    db.add(sector)
    db.flush()
    return sector


def signup(db: Session, payload: UserSignup) -> User:
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    user = User(
        name=payload.name,
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        position=payload.position,
        status=UserStatus.pending,
    )
    db.add(user)
    db.flush()

    for entry in payload.sectors:
        sector = _resolve_sector(db, entry.key, entry.label)
        db.add(UserSector(user_id=user.id, sector_id=sector.id))

    db.commit()
    db.refresh(user)
    return user


def login(db: Session, username: str, password: str) -> str:
    user = db.query(User).filter(User.username == username).first()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")

    if user.status == UserStatus.pending:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="pending_access")
    if user.status == UserStatus.revoked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="access_revoked")

    return create_access_token(user.id)


def request_password_reset(db: Session, email: str) -> None:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        # Don't reveal whether the email is registered.
        return

    settings = get_settings()

    # Invalidate any reset links already in flight for this user.
    db.query(PasswordReset).filter(
        PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None)
    ).delete()

    token = generate_reset_token()
    db.add(
        PasswordReset(
            user_id=user.id,
            token_hash=hash_reset_token(token),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.password_reset_expire_minutes),
        )
    )
    db.commit()

    app_base_url = settings.app_base_url.rstrip("/")
    deep_link = (
        f"{app_base_url}/reset-password?uid={user.id}&username={quote(user.username)}&token={token}"
        if app_base_url
        else None
    )

    body_lines = [f"Hi {user.name},", "", "We received a request to reset your KnowledgeAssistant password."]
    html_body = None
    if deep_link:
        body_lines += [
            "",
            f"This link expires in {settings.password_reset_expire_minutes} minutes and can only be used once:",
            "",
            deep_link,
        ]
        html_body = (
            f"<p>Hi {escape(user.name)},</p>"
            "<p>We received a request to reset your KnowledgeAssistant password.</p>"
            f'<p><a href="{escape(deep_link)}">Reset your password</a> '
            f"(expires in {settings.password_reset_expire_minutes} minutes, single use).</p>"
        )
    body_lines += ["", "If you didn't request this, you can safely ignore this email."]

    send_email(
        to=user.email,
        subject="Reset your KnowledgeAssistant password",
        body="\n".join(body_lines),
        html_body=html_body,
    )


def reset_password(db: Session, user_id: uuid.UUID, username: str, token: str, new_password: str) -> None:
    invalid = HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")

    user = db.get(User, user_id)
    if user is None or user.username != username:
        raise invalid

    reset = (
        db.query(PasswordReset)
        .filter(PasswordReset.user_id == user_id, PasswordReset.token_hash == hash_reset_token(token))
        .first()
    )
    if reset is None or reset.used_at is not None or reset.expires_at < datetime.now(timezone.utc):
        raise invalid

    user.password_hash = hash_password(new_password)
    reset.used_at = datetime.now(timezone.utc)
    db.commit()


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    user.password_hash = hash_password(new_password)
    db.commit()
