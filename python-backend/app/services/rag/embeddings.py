from google import genai
from google.genai import types

from app.core.config import get_settings
from app.db.models.qa_entry import EMBEDDING_DIM

EMBEDDING_MODEL = "gemini-embedding-001"

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=get_settings().gemini_api_key)
    return _client


def embed_text(text: str, task_type: str = "RETRIEVAL_QUERY") -> list[float]:
    response = _get_client().models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM, task_type=task_type),
    )
    return list(response.embeddings[0].values)
