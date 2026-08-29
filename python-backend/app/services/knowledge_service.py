import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models.qa_entry import QAEntry
from app.db.models.user import User, UserRole
from app.db.models.user_sector import UserSector
from app.schemas.knowledge import QAEntryCreate
from app.services import gap_service
from app.services.rag.embeddings import embed_text

logger = logging.getLogger(__name__)


def _assert_sector_access(db: Session, user: User, sector_id: uuid.UUID) -> None:
    if user.role == UserRole.superAdmin:
        return
    owns_sector = (
        db.query(UserSector)
        .filter(UserSector.user_id == user.id, UserSector.sector_id == sector_id)
        .first()
    )
    if owns_sector is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not assigned to this sector")


def list_entries(db: Session, sector_id: uuid.UUID) -> list[QAEntry]:
    return db.query(QAEntry).filter(QAEntry.sector_id == sector_id).order_by(QAEntry.created_at.desc()).all()


def create_entry(db: Session, user: User, payload: QAEntryCreate) -> QAEntry:
    _assert_sector_access(db, user, payload.sector_id)

    embedding = embed_text(f"{payload.question}\n{payload.answer}")

    entry = QAEntry(
        sector_id=payload.sector_id,
        question=payload.question,
        answer=payload.answer,
        source=payload.source,
        embedding=embedding,
        created_by=user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    if payload.gap_id is not None:
        # Resolving the gap is a side effect of the entry we already saved,
        # so a stale/already-resolved gap_id shouldn't fail this request.
        try:
            gap_service.resolve_gap(db, payload.gap_id, user)
        except HTTPException as exc:
            logger.warning("Could not resolve gap %s for QA entry %s: %s", payload.gap_id, entry.id, exc.detail)

    return entry


def delete_entry(db: Session, user: User, entry_id: uuid.UUID) -> None:
    entry = db.get(QAEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    _assert_sector_access(db, user, entry.sector_id)

    db.delete(entry)
    db.commit()
