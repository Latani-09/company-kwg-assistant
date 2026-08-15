import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.db.models.knowledge_gap import GapStatus


class GapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_query_id: uuid.UUID
    question_text: str
    asker_id: uuid.UUID
    status: GapStatus
    assigned_to_id: uuid.UUID | None
    assigned_sector_id: uuid.UUID | None
    created_at: datetime
    assigned_at: datetime | None
    resolved_at: datetime | None


class GapAssignRequest(BaseModel):
    assigned_to_id: uuid.UUID
    assigned_sector_id: uuid.UUID
