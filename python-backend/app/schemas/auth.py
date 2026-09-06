import uuid

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    user_id: uuid.UUID
    username: str
    token: str
    new_password: str


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
