from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.db.models.chat_query import ChatQuery
from app.db.models.knowledge_gap import GapStatus, KnowledgeGap
from app.db.models.sector import Sector
from app.db.models.user import User, UserStatus
from app.schemas.gap import GapAssignRequest
from app.services import gap_service


def add_user(db_session, suffix: str) -> User:
    user = User(
        id=uuid4(),
        name=f"Gap User {suffix}",
        email=f"gap-{suffix}-{uuid4()}@example.com",
        username=f"gap-{suffix}-{uuid4()}",
        password_hash="test-password-hash",
        position="Analyst",
        status=UserStatus.granted,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_create_gap_copies_chat_query_metadata(db_session, seeded_user):
    query = ChatQuery(
        id=uuid4(),
        asker_id=seeded_user.id,
        question_text="Where is the release checklist?",
        is_gap=True,
    )
    db_session.add(query)
    db_session.flush()

    gap, is_new = gap_service.create_gap(db_session, query)

    assert gap.status == GapStatus.open
    assert gap.source_query_id == query.id
    assert gap.asker_id == seeded_user.id
    assert gap.question_text == query.question_text
    assert gap.id is not None
    assert is_new is True


def test_create_gap_reuses_existing_open_gap_for_same_question(db_session, seeded_user):
    first_query = ChatQuery(
        id=uuid4(), asker_id=seeded_user.id, question_text="Where is the release checklist?", is_gap=True
    )
    second_query = ChatQuery(
        id=uuid4(), asker_id=seeded_user.id, question_text="  WHERE IS THE release checklist?  ", is_gap=True
    )
    db_session.add_all([first_query, second_query])
    db_session.flush()

    first_gap, first_is_new = gap_service.create_gap(db_session, first_query)
    second_gap, second_is_new = gap_service.create_gap(db_session, second_query)

    assert second_gap.id == first_gap.id
    assert db_session.query(KnowledgeGap).count() == 1
    assert first_is_new is True
    assert second_is_new is False


def test_create_gap_opens_new_gap_when_prior_one_is_resolved(db_session, seeded_user):
    first_query = ChatQuery(
        id=uuid4(), asker_id=seeded_user.id, question_text="Where is the release checklist?", is_gap=True
    )
    db_session.add(first_query)
    db_session.flush()
    first_gap, _ = gap_service.create_gap(db_session, first_query)
    gap_service.resolve_gap(db_session, first_gap.id, seeded_user)

    second_query = ChatQuery(
        id=uuid4(), asker_id=seeded_user.id, question_text="Where is the release checklist?", is_gap=True
    )
    db_session.add(second_query)
    db_session.flush()
    second_gap, second_is_new = gap_service.create_gap(db_session, second_query)

    assert second_gap.id != first_gap.id
    assert db_session.query(KnowledgeGap).count() == 2
    assert second_is_new is True


def test_resolve_gap_rejects_missing_gap(db_session, seeded_user):
    with pytest.raises(HTTPException) as error:
        gap_service.resolve_gap(db_session, uuid4(), seeded_user)

    assert error.value.status_code == 404
    assert error.value.detail == "Gap not found"


def test_assign_gap_updates_status_timestamps_and_sends_email(
    db_session, seeded_gap, seeded_sector, monkeypatch
):
    assignee = add_user(db_session, "assignee")
    sent = []
    monkeypatch.setattr(gap_service, "send_email", lambda **message: sent.append(message))

    assigned = gap_service.assign_gap(
        db_session,
        seeded_gap.id,
        GapAssignRequest(assigned_to_id=assignee.id, assigned_sector_id=seeded_sector.id),
    )

    assert assigned.status == GapStatus.assigned
    assert assigned.assigned_to_id == assignee.id
    assert assigned.assigned_sector_id == seeded_sector.id
    assert isinstance(assigned.assigned_at, datetime)
    assert len(sent) == 1
    assert sent[0]["to"] == assignee.email
    assert seeded_gap.question_text in sent[0]["body"]


def test_assign_gap_rejects_missing_gap(db_session, seeded_sector, seeded_user):
    with pytest.raises(HTTPException) as error:
        gap_service.assign_gap(
            db_session,
            uuid4(),
            GapAssignRequest(assigned_to_id=seeded_user.id, assigned_sector_id=seeded_sector.id),
        )

    assert error.value.status_code == 404
    assert error.value.detail == "Gap not found"


def test_resolve_gap_sets_status_timestamp_and_resolver(db_session, seeded_gap, seeded_user):
    resolved = gap_service.resolve_gap(db_session, seeded_gap.id, seeded_user)

    assert resolved.status == GapStatus.resolved
    assert isinstance(resolved.resolved_at, datetime)
    assert resolved.resolved_by_id == seeded_user.id


def test_resolve_gap_rejects_already_resolved_gap(db_session, seeded_gap, seeded_user):
    gap_service.resolve_gap(db_session, seeded_gap.id, seeded_user)

    with pytest.raises(HTTPException) as error:
        gap_service.resolve_gap(db_session, seeded_gap.id, seeded_user)

    assert error.value.status_code == 400
    assert error.value.detail == "Gap already resolved"


def test_auto_resolve_assigned_gaps_closes_matching_gaps(db_session, seeded_gap, seeded_user, seeded_sector):
    seeded_gap.status = GapStatus.assigned
    seeded_gap.assigned_to_id = seeded_user.id
    seeded_gap.assigned_sector_id = seeded_sector.id
    db_session.commit()

    resolved = gap_service.auto_resolve_assigned_gaps(db_session, seeded_user, seeded_sector.id)

    assert [gap.id for gap in resolved] == [seeded_gap.id]
    assert resolved[0].status == GapStatus.resolved
    assert isinstance(resolved[0].resolved_at, datetime)


def test_auto_resolve_assigned_gaps_returns_empty_when_no_match(db_session, seeded_user, seeded_sector):
    assert gap_service.auto_resolve_assigned_gaps(db_session, seeded_user, seeded_sector.id) == []
