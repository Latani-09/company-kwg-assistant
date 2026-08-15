import uuid

from pydantic import BaseModel


class ChatQueryRequest(BaseModel):
    question: str


class ChatSource(BaseModel):
    id: uuid.UUID
    question: str
    answer: str
    source: str | None


class ChatQueryResponse(BaseModel):
    answer: str | None
    sources: list[ChatSource] = []
    is_gap: bool
    confidence: float | None = None
