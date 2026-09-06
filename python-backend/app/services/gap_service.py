import uuid
from datetime import datetime, timezone
from html import escape

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models.chat_query import ChatQuery
from app.db.models.knowledge_gap import GapStatus, KnowledgeGap
from app.db.models.sector import Sector
from app.db.models.user import User
from app.schemas.gap import GapAssignRequest
from app.services.mail_service import send_email


def create_gap(db: Session, chat_query: ChatQuery) -> KnowledgeGap:
    """One open work item per distinct question, no matter how many times it's asked.

    Without this check, every failed chat query for the same wording (e.g. someone
    re-asking after seeing "I don't know") piled up as its own gap row instead of
    surfacing as one item for an admin to act on.
    """
    normalized_question = chat_query.question_text.strip().lower()
    existing = (
        db.query(KnowledgeGap)
        .filter(
            KnowledgeGap.status != GapStatus.resolved,
            func.lower(func.trim(KnowledgeGap.question_text)) == normalized_question,
        )
        .first()
    )
    if existing is not None:
        return existing

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
        sector_label = sector.label if sector else "assigned"
        app_base_url = get_settings().app_base_url.rstrip("/")
        deep_link = (
            f"{app_base_url}/dashboard?sector={gap.assigned_sector_id}&gap={gap.id}&addDoc=1"
            if app_base_url
            else None
        )

        body_lines = [
            f"Hi {assignee.name},",
            "",
            f"You have been assigned a knowledge gap in the {sector_label} sector:",
            "",
            f'"{gap.question_text}"',
            "",
            "Please add a Q&A entry to close this gap.",
        ]
        html_body = None
        if deep_link:
            body_lines += ["", deep_link]
            html_body = (
                f"<p>Hi {escape(assignee.name)},</p>"
                f"<p>You have been assigned a knowledge gap in the <strong>{escape(sector_label)}</strong> sector:</p>"
                f'<blockquote>{escape(gap.question_text)}</blockquote>'
                f'<p><a href="{escape(deep_link)}">Add a Q&amp;A entry</a> to close this gap.</p>'
            )

        send_email(
            to=assignee.email,
            subject="A knowledge gap has been assigned to you",
            body="\n".join(body_lines),
            html_body=html_body,
        )

    return gap