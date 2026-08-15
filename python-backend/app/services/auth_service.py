import re
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.models.sector import Sector
from app.db.models.user import User, UserStatus
from app.db.models.user_sector import UserSector
from app.schemas.user import UserSignup


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
