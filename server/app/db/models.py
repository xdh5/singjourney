"""Single import point that registers every table with SQLAlchemy metadata."""

from app.modules.accounts.models import AuthIdentity, AuthSession, User
from app.modules.evaluations.models import Evaluation, EvaluationDimension
from app.modules.media.models import AudioAsset, Recording
from app.modules.practice.models import (
    Accompaniment,
    DailyPracticeMessage,
    PracticeCategory,
    PracticeExercise,
    PracticeExerciseCategory,
    PracticeFavorite,
    PracticeSession,
)

__all__ = [
    "Accompaniment",
    "AudioAsset",
    "AuthIdentity",
    "AuthSession",
    "Evaluation",
    "EvaluationDimension",
    "DailyPracticeMessage",
    "PracticeSession",
    "PracticeCategory",
    "PracticeExercise",
    "PracticeExerciseCategory",
    "PracticeFavorite",
    "Recording",
    "User",
]
