from enum import StrEnum


class TelemetryPlatform(StrEnum):
    WEB = "web"
    IOS = "ios"
    ANDROID = "android"
    HARMONY = "harmony"
    WX = "wx"
    DEVELOPMENT = "development"


class TelemetryEventName(StrEnum):
    APP_OPENED = "app_opened"
    FEATURE_OPENED = "feature_opened"
    RECORDING_STARTED = "recording_started"
    RECORDING_PAUSED = "recording_paused"
    RECORDING_RESUMED = "recording_resumed"
    RECORDING_COMPLETED = "recording_completed"
    RECORDING_SAVED = "recording_saved"
    RECORDING_SAVE_FAILED = "recording_save_failed"
    RECORDING_SHARE_CLICKED = "recording_share_clicked"
    RECORDING_SHARE_SUCCEEDED = "recording_share_succeeded"
    RECORDING_SHARE_FAILED = "recording_share_failed"
    RECORDING_PLAY_FAILED = "recording_play_failed"
    CLIENT_ERROR = "client_error"


MAXIMUM_BATCH_EVENTS = 20
MAXIMUM_RECORDING_DURATION_SECONDS = 10 * 60
TELEMETRY_RATE_LIMIT_WINDOW_SECONDS = 60
TELEMETRY_RATE_LIMIT_REQUESTS_PER_CLIENT = 30
TELEMETRY_RATE_LIMIT_CACHE_ENTRIES = 10_000
