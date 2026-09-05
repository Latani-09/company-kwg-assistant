from uuid import uuid4

from app.db.models.qa_entry import QAEntry, EMBEDDING_DIM
from app.db.models.knowledge_gap import KnowledgeGap
from app.services import chat_service


def add_entry(db_session, user, sector):
    entry = QAEntry(
        id=uuid4(),
        sector_id=sector.id,
        question="How are releases approved?",
        answer="The product team approves releases after review.",
        source="handbook.md",
        embedding=[0.1] * EMBEDDING_DIM,
        created_by=user.id,
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)
    return entry


def test_ask_creates_gap_when_retrieval_has_no_matches(db_session, seeded_user, monkeypatch):
    monkeypatch.setattr(chat_service, "embed_text", lambda question: [0.1] * EMBEDDING_DIM)
    monkeypatch.setattr(chat_service.retrieval, "search", lambda db, embedding, top_k: [])

    response = chat_service.ask(db_session, seeded_user, "Where is the release checklist?")

    gap = db_session.query(KnowledgeGap).one()
    assert response.answer is None
    assert response.is_gap is True
    assert response.sources == []
    assert gap.question_text == "Where is the release checklist?"
    assert gap.asker_id == seeded_user.id


def test_ask_generates_answer_and_sources_for_confident_match(
    db_session, seeded_user, seeded_sector, monkeypatch
):
    entry = add_entry(db_session, seeded_user, seeded_sector)
    monkeypatch.setattr(chat_service, "embed_text", lambda question: [0.1] * EMBEDDING_DIM)
    monkeypatch.setattr(chat_service.retrieval, "search", lambda db, embedding, top_k: [(entry, 0.9)])
    monkeypatch.setattr(
        chat_service.generation,
        "generate",
        lambda question, matches: {
            "answer": "Releases require product review.",
            "used_source_ids": [str(entry.id)],
            "sufficient": True,
        },
    )

    response = chat_service.ask(db_session, seeded_user, "How are releases approved?")

    assert response.answer == "Releases require product review."
    assert response.is_gap is False
    assert response.confidence == 0.9
    assert [source.id for source in response.sources] == [entry.id]
    assert db_session.query(KnowledgeGap).count() == 0
