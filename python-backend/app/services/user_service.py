import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models.sector import Sector
from app.db.models.user import User, UserStatus
from app.db.models.user_sector import UserSector


def list_users(db: Session, status_filter: UserStatus | None, sector_key: str | None) -> list[User]:
    query = db.query(User)
    if status_filter is not None:
        query = query.filter(User.status == status_filter)
    if sector_key is not None:
        query = (
            query.join(UserSector, UserSector.user_id == User.id)
            .join(Sector, Sector.id == UserSector.sector_id)
            .filter(Sector.key == sector_key)
        )
    return query.order_by(User.created_at.desc()).all()


def update_access(db: Session, user_id: uuid.UUID, new_status: UserStatus) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.status = new_status
    db.commit()
    db.refresh(user)
    return user
