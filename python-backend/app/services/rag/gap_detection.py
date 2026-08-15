from app.core.config import get_settings


def decide(similarity_score: float | None, llm_sufficient: bool | None) -> bool:
    """Either signal can veto an answer; neither alone can force one through."""
    floor = get_settings().rag_similarity_floor

    if similarity_score is None or similarity_score < floor:
        return True
    if llm_sufficient is False:
        return True
    return False
