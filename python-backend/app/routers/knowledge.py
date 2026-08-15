import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.base import get_db
from app.db.models.user import User
from app.schemas.knowledge import QAEntryCreate, QAEntryOut
from app.services import knowledge_service

router = APIRouter(prefix="/knowledge", tags=["knowledge"], dependencies=[Depends(get_current_user)])


@router.get("/qa", response_model=list[QAEntryOut])
def list_qa(sector: uuid.UUID, db: Session = Depends(get_db)):
    return knowledge_service.list_entries(db, sector)


@router.post("/qa", response_model=QAEntryOut, status_code=201)
def create_qa(
    payload: QAEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return knowledge_service.create_entry(db, current_user, payload)


@router.delete("/qa/{entry_id}", status_code=204)
def delete_qa(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    knowledge_service.delete_entry(db, current_user, entry_id)
