from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class WeChatLoginRequest(BaseModel):
    code: str = Field(min_length=1, max_length=256)
    locale: str | None = Field(default=None, max_length=16)
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    avatar_data_url: str | None = Field(default=None, max_length=750_000)


class AuthUser(BaseModel):
    id: str
    display_name: str | None
    avatar_data_url: str | None
    locale: str | None
    preferred_voice_preset: Literal["female", "male"] | None


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    avatar_data_url: str | None = Field(default=None, max_length=750_000)
    preferred_voice_preset: Literal["female", "male"] | None = None


class AuthSessionResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_at: datetime
    user: AuthUser


class CurrentSessionResponse(BaseModel):
    expires_at: datetime
    user: AuthUser
