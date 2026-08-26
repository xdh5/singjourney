from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


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
    preferred_range_min_midi: int | None
    preferred_range_max_midi: int | None


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    avatar_data_url: str | None = Field(default=None, max_length=750_000)
    preferred_voice_preset: Literal["female", "male"] | None = None
    preferred_range_min_midi: int | None = Field(default=None, ge=48, le=77)
    preferred_range_max_midi: int | None = Field(default=None, ge=48, le=77)

    @model_validator(mode="after")
    def validate_preferred_range(self):
        """音域必须成对提交，且最低音低于最高音。"""

        values = (self.preferred_range_min_midi, self.preferred_range_max_midi)
        if (values[0] is None) != (values[1] is None):
            raise ValueError("Preferred range endpoints must be provided together")
        if values[0] is not None and values[0] >= values[1]:
            raise ValueError("Preferred range minimum must be below maximum")
        return self


class AuthSessionResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_at: datetime
    user: AuthUser


class CurrentSessionResponse(BaseModel):
    expires_at: datetime
    user: AuthUser
