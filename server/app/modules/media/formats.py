from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AudioFormat:
    suffix: str
    container: str
    codec: str


AUDIO_FORMATS_BY_MIME = {
    "audio/aac": AudioFormat(suffix=".aac", container="aac", codec="aac"),
    "audio/mp4": AudioFormat(suffix=".m4a", container="m4a", codec="aac"),
    "audio/mpeg": AudioFormat(suffix=".mp3", container="mp3", codec="mp3"),
    "audio/ogg": AudioFormat(suffix=".opus", container="ogg", codec="opus"),
    "audio/opus": AudioFormat(suffix=".opus", container="opus", codec="opus"),
    "audio/wav": AudioFormat(suffix=".wav", container="wav", codec="pcm_s16le"),
    "audio/webm": AudioFormat(suffix=".webm", container="webm", codec="opus"),
    "audio/x-wav": AudioFormat(suffix=".wav", container="wav", codec="pcm_s16le"),
}
ALLOWED_AUDIO_SUFFIXES = frozenset(item.suffix for item in AUDIO_FORMATS_BY_MIME.values()) | {".ogg"}
UNKNOWN_AUDIO_SUFFIX = ".audio"


def audio_format_for_mime(mime_type: str) -> AudioFormat | None:
    return AUDIO_FORMATS_BY_MIME.get(normalize_audio_mime(mime_type))


def safe_audio_suffix(filename: str | None, mime_type: str | None) -> str:
    audio_format = AUDIO_FORMATS_BY_MIME.get(normalize_audio_mime(mime_type or ""))
    if audio_format:
        return audio_format.suffix
    suffix = Path(filename or "").suffix.lower()
    return suffix if suffix in ALLOWED_AUDIO_SUFFIXES else UNKNOWN_AUDIO_SUFFIX


def normalize_audio_mime(mime_type: str) -> str:
    return mime_type.partition(";")[0].strip().lower()
