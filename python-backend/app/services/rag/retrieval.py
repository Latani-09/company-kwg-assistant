from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models.qa_entry import QAEntry


def search(db: Session, embedding: list[float], top_k: int | None = None) -> list[tuple[QAEntry, float]]:
    k = top_k or get_settings().rag_top_k

    distance = QAEntry.embedding.cosine_distance(embedding)
    rows = db.query(QAEntry, distance.label("distance")).order_by(distance).limit(k).all()

    # pgvector cosine_distance = 1 - cosine_similarity
    return [(entry, 1 - dist) for entry, dist in rows]
