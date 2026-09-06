from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.db.models.chat_query import ChatQuery
from app.db.models.qa_entry import QAEntry, EMBEDDING_DIM
from app.db.models.user import User, UserRole, UserStatus
from app.db.models.user_sector import UserSector
from app.schemas.knowledge import QAEntryCreate
from app.services import knowledge_service


def assign_user_to_sector(db_session, user, sector):
    db_session.add(UserSector(user_id=user.id, sector_id=sector.id))
    db_session.commit()


def add_user(db_session, *, role=UserRole.user):
    user = User(
        id=uuid4(),
        name="Knowledge User",
        email=f"knowledge-{uuid4()}@example.com",
        username=f"knowledge-{uuid4()}",
        password_hash="test-password-hash",
        position="Analyst",
        role=role,
        status=UserStatus.granted,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def entry_payload(sector_id):
    return QAEntryCreate(
        sector_id=sector_id,
        question="What is the product release process?",
        answer="The product team reviews and approves each release.",
        source="handbook.md",
    )


def test_assert_sector_access_allows_super_admin(db_session, seeded_sector):
    admin = add_user(db_session, role=UserRole.superAdmin)

    knowledge_service._assert_sector_access(db_session, admin, seeded_sector.id)


def test_assert_sector_access_allows_assigned_member(db_session, seeded_user, seeded_sector):
    assign_user_to_sector(db_session, seeded_user, seeded_sector)

    knowledge_service._assert_sector_access(db_session, seeded_user, seeded_sector.id)


def test_assert_sector_access_rejects_non_member(db_session, seeded_user, seeded_sector):
    with pytest.raises(HTTPException) as error:
        knowledge_service._assert_sector_access(db_session, seeded_user, seeded_sector.id)

    assert error.value.status_code == 403
    assert error.value.detail == "Not assigned to this sector"


def test_create_entry_persists_metadata_and_embedding(db_session, seeded_user, seeded_sector, monkeypatch):
    assign_user_to_sector(db_session, seeded_user, seeded_sector)
    embedding = [0.25] * EMBEDDING_DIM
    calls = {}

    def fake_embed_text(text, task_type=None):
        calls["task_type"] = task_type
        return embedding

    monkeypatch.setattr(knowledge_service, "embed_text", fake_embed_text)

    entry = knowledge_service.create_entry(db_session, seeded_user, entry_payload(seeded_sector.id))

    assert entry.sector_id == seeded_sector.id
    assert entry.created_by == seeded_user.id
    assert entry.question == "What is the product release process?"
    assert entry.answer == "The product team reviews and approves each release."
    assert entry.source == "handbook.md"
    assert entry.embedding == embedding
    assert calls["task_type"] == "RETRIEVAL_DOCUMENT"


def test_create_entry_allows_super_admin_without_sector_membership(
    db_session, seeded_sector, monkeypatch
):
    admin = add_user(db_session, role=UserRole.superAdmin)
    monkeypatch.setattr(knowledge_service, "embed_text", lambda text, task_type=None: [0.1] * EMBEDDING_DIM)

    entry = knowledge_service.create_entry(db_session, admin, entry_payload(seeded_sector.id))

    assert entry.created_by == admin.id
    assert entry.sector_id == seeded_sector.id


def test_delete_entry_allows_assigned_member(db_session, seeded_user, seeded_sector, monkeypatch):
    assign_user_to_sector(db_session, seeded_user, seeded_sector)
    monkeypatch.setattr(knowledge_service, "embed_text", lambda text, task_type=None: [0.1] * EMBEDDING_DIM)
    entry = knowledge_service.create_entry(db_session, seeded_user, entry_payload(seeded_sector.id))

    knowledge_service.delete_entry(db_session, seeded_user, entry.id)

    assert db_session.get(QAEntry, entry.id) is None


def test_delete_entry_rejects_non_owner_without_sector_access(db_session, seeded_user, seeded_sector, monkeypatch):
    assign_user_to_sector(db_session, seeded_user, seeded_sector)
    monkeypatch.setattr(knowledge_service, "embed_text", lambda text, task_type=None: [0.1] * EMBEDDING_DIM)
    entry = knowledge_service.create_entry(db_session, seeded_user, entry_payload(seeded_sector.id))
    other_user = add_user(db_session)

    with pytest.raises(HTTPException) as error:
        knowledge_service.delete_entry(db_session, other_user, entry.id)

    assert error.value.status_code == 403
    assert db_session.get(QAEntry, entry.id) is not None


def test_delete_entry_nulls_matched_entry_id_on_past_chat_queries(
    db_session, seeded_user, seeded_sector, monkeypatch
):
    assign_user_to_sector(db_session, seeded_user, seeded_sector)
    monkeypatch.setattr(knowledge_service, "embed_text", lambda text, task_type=None: [0.1] * EMBEDDING_DIM)
    entry = knowledge_service.create_entry(db_session, seeded_user, entry_payload(seeded_sector.id))

    chat_query = ChatQuery(
        id=uuid4(),
        asker_id=seeded_user.id,
        question_text="What is the product release process?",
        matched_entry_id=entry.id,
    )
    db_session.add(chat_query)
    db_session.commit()

    knowledge_service.delete_entry(db_session, seeded_user, entry.id)

    db_session.refresh(chat_query)
    assert chat_query.matched_entry_id is None
