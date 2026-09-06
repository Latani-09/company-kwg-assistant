from app.core.config import get_settings
from app.db.models.chat_query import ChatQuery
from app.db.models.user import User
from app.schemas.chat import ChatQueryResponse, ChatSource
from app.services import gap_service
from app.services.rag import generation, retrieval
from app.services.rag.embeddings import embed_text
from app.services.rag.gap_detection import decide
from sqlalchemy.orm import Session


def ask(db: Session, user: User, question: str) -> ChatQueryResponse:
    settings = get_settings()

    embedding = embed_text(question, task_type="RETRIEVAL_QUERY")
    matches = retrieval.search(db, embedding, top_k=settings.rag_top_k)

    best_score = matches[0][1] if matches else None

    llm_sufficient: bool | None = None
    answer_text: str | None = None
    used_source_ids: set[str] = set()

    if best_score is not None and best_score >= settings.rag_similarity_floor:
        result = generation.generate(question, matches)
        answer_text = result.get("answer")
        llm_sufficient = result.get("sufficient")
        used_source_ids = set(result.get("used_source_ids") or [])

    is_gap = decide(best_score, llm_sufficient)

    chat_query = ChatQuery(
        asker_id=user.id,
        question_text=question,
        answer_text=None if is_gap else answer_text,
        matched_entry_id=matches[0][0].id if matches else None,
        similarity_score=best_score,
        is_gap=is_gap,
    )
    db.add(chat_query)
    db.flush()

    if is_gap:
        gap_service.create_gap(db, chat_query)
        db.commit()
        return ChatQueryResponse(answer=None, sources=[], is_gap=True, confidence=best_score)

    db.commit()

    used_entries = [entry for entry, _ in matches if str(entry.id) in used_source_ids] or [
        entry for entry, _ in matches[:1]
    ]
    sources = [
        ChatSource(id=entry.id, question=entry.question, answer=entry.answer, source=entry.source)
        for entry in used_entries
    ]

    return ChatQueryResponse(answer=answer_text, sources=sources, is_gap=False, confidence=best_score)
