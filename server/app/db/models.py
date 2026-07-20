"""Single import point used by Alembic to register every table."""

from app.modules.accounts.models import AuthIdentity, AuthSession, User
from app.modules.evaluations.models import Evaluation, EvaluationDimension
from app.modules.media.models import AudioAsset, Recording
from app.modules.practice.models import Accompaniment, PracticeSession
from app.modules.sharing.models import RecordingShare

__all__ = [
    "Accompaniment",
    "AudioAsset",
    "AuthIdentity",
    "AuthSession",
    "Evaluation",
    "EvaluationDimension",
    "PracticeSession",
    "Recording",
    "RecordingShare",
    "User",
]

