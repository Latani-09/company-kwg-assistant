import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.db.models.user import UserRole, UserStatus
from app.schemas.sector import SectorOut


class SignupSectorInput(BaseModel):
    key: str
    label: str | None = None


class UserSignup(BaseModel):
    name: str
    email: EmailStr
    username: str
    password: str
    position: str
    sectors: list[SignupSectorInput]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: EmailStr
    username: str
    position: str
    role: UserRole
    status: UserStatus
    created_at: datetime
    sectors: list[SectorOut] = []


class AdminUserOut(UserOut):
    granted: bool


class AccessUpdate(BaseModel):
    status: UserStatus
