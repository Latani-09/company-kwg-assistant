import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models.chat_query import ChatQuery
from app.db.models.knowledge_gap import GapStatus, KnowledgeGap
from app.schemas.gap import GapAssignRequest


def create_gap(db: Session, chat_query: ChatQuery) -> KnowledgeGap:
    gap = KnowledgeGap(
        source_query_id=chat_query.id,
        question_text=chat_query.question_text,
        asker_id=chat_query.asker_id,
        status=GapStatus.open,
    )
    db.add(gap)
    db.flush()
    return gap


def list_gaps(db: Session, status_filter: GapStatus | None) -> list[KnowledgeGap]:
    query = db.query(KnowledgeGap)
    if status_filter is not None:
        query = query.filter(KnowledgeGap.status == status_filter)
    return query.order_by(KnowledgeGap.created_at.desc()).all()


def assign_gap(db: Session, gap_id: uuid.UUID, payload: GapAssignRequest) -> KnowledgeGap:
    gap = db.get(KnowledgeGap, gap_id)
    if gap is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gap not found")

    gap.assigned_to_id = payload.assigned_to_id
    gap.assigned_sector_id = payload.assigned_sector_id
    gap.status = GapStatus.assigned
    gap.assigned_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(gap)
    return gap
