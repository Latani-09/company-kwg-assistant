import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.base import get_db
from app.db.models.user import UserStatus
from app.schemas.user import AccessUpdate, AdminUserOut
from app.services import user_service

router = APIRouter(prefix="/admin/users", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[AdminUserOut])
def list_users(
    status: UserStatus | None = None,
    sector: str | None = None,
    db: Session = Depends(get_db),
):
    users = user_service.list_users(db, status, sector)
    return [
        AdminUserOut.model_validate(u, from_attributes=True).model_copy(
            update={"granted": u.status == UserStatus.granted, "sectors": [us.sector for us in u.user_sectors]}
        )
        for u in users
    ]


@router.patch("/{user_id}/access", response_model=AdminUserOut)
def update_access(user_id: uuid.UUID, payload: AccessUpdate, db: Session = Depends(get_db)):
    user = user_service.update_access(db, user_id, payload.status)
    return AdminUserOut.model_validate(user, from_attributes=True).model_copy(
        update={"granted": user.status == UserStatus.granted, "sectors": [us.sector for us in user.user_sectors]}
    )
