from datetime import datetime

from pydantic import BaseModel, Field


class WeChatLoginRequest(BaseModel):
    code: str = Field(min_length=1, max_length=256)
    locale: str | None = Field(default=None, max_length=16)


class AuthUser(BaseModel):
    id: str
    display_name: str | None
    avatar_data_url: str | None
    locale: str | None


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    avatar_data_url: str | None = Field(default=None, max_length=750_000)


class AuthSessionResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_at: datetime
    user: AuthUser


class CurrentSessionResponse(BaseModel):
    expires_at: datetime
    user: AuthUser
