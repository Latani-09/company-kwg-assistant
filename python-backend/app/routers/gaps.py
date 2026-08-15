import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.base import get_db
from app.db.models.knowledge_gap import GapStatus
from app.schemas.gap import GapAssignRequest, GapOut
from app.services import gap_service

router = APIRouter(prefix="/admin/gaps", tags=["gaps"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[GapOut])
def list_gaps(status: GapStatus | None = None, db: Session = Depends(get_db)):
    return gap_service.list_gaps(db, status)


@router.post("/{gap_id}/assign", response_model=GapOut)
def assign_gap(gap_id: uuid.UUID, payload: GapAssignRequest, db: Session = Depends(get_db)):
    return gap_service.assign_gap(db, gap_id, payload)
