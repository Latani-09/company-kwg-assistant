import json

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.db.models.qa_entry import QAEntry

GENERATION_MODEL = "gemini-2.0-flash"

SYSTEM_PROMPT = (
    "You are a company knowledge assistant. Answer the user's question using ONLY the "
    "provided Q&A entries as context, and never outside knowledge. Respond with strict JSON "
    'matching this shape: {"answer": string, "used_source_ids": string[], "sufficient": boolean}. '
    "Set sufficient=false whenever the provided entries do not actually answer the question, "
    "even if they are topically related."
)

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=get_settings().gemini_api_key)
    return _client


def generate(question: str, matches: list[tuple[QAEntry, float]]) -> dict:
    context = "\n\n".join(f"[{entry.id}] Q: {entry.question}\nA: {entry.answer}" for entry, _ in matches)
    prompt = f"{SYSTEM_PROMPT}\n\nContext entries:\n{context}\n\nQuestion: {question}"

    response = _get_client().models.generate_content(
        model=GENERATION_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    return json.loads(response.text)
