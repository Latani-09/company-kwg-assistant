import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models.chat_query import ChatQuery
from app.db.models.knowledge_gap import GapStatus, KnowledgeGap
from app.db.models.sector import Sector
from app.db.models.user import User
from app.schemas.gap import GapAssignRequest
from app.services.mail_service import send_email


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


def resolve_gap(db: Session, gap_id: uuid.UUID, resolved_by: User) -> KnowledgeGap:
    gap = db.get(KnowledgeGap, gap_id)
    if gap is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gap not found")
    if gap.status == GapStatus.resolved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gap already resolved")

    gap.status = GapStatus.resolved
    gap.resolved_at = datetime.now(timezone.utc)
    gap.resolved_by_id = resolved_by.id
    db.commit()
    db.refresh(gap)
    return gap


def auto_resolve_assigned_gaps(db: Session, resolver: User, sector_id: uuid.UUID) -> list[KnowledgeGap]:
    """Called when someone adds a QA entry to a sector.

    Any gap that was assigned to *this* user in *this* sector is treated as
    answered by that new entry, so it's closed out automatically instead of
    waiting on an admin to click "Resolve".
    """
    gaps = (
        db.query(KnowledgeGap)
        .filter(
            KnowledgeGap.status == GapStatus.assigned,
            KnowledgeGap.assigned_sector_id == sector_id,
            KnowledgeGap.assigned_to_id == resolver.id,
        )
        .all()
    )
    if not gaps:
        return []

    now = datetime.now(timezone.utc)
    for gap in gaps:
        gap.status = GapStatus.resolved
        gap.resolved_at = now
        gap.resolved_by_id = resolver.id

    db.commit()
    for gap in gaps:
        db.refresh(gap)
    return gaps


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

    assignee = db.get(User, gap.assigned_to_id)
    sector = db.get(Sector, gap.assigned_sector_id)
    if assignee is not None:
        send_email(
            to=assignee.email,
            subject="A knowledge gap has been assigned to you",
            body=(
                f"Hi {assignee.name},\n\n"
                f"You have been assigned a knowledge gap in the "
                f"{sector.label if sector else 'assigned'} sector:\n\n"
                f'"{gap.question_text}"\n\n'
                "Please add a Q&A entry to close this gap."
            ),
        )

    return gap