import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class QAEntryCreate(BaseModel):
    sector_id: uuid.UUID
    question: str
    answer: str
    source: str | None = None


class QAEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sector_id: uuid.UUID
    question: str
    answer: str
    source: str | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
