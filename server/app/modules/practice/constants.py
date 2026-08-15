from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class PracticeExerciseDefinition:
    exercise_key: str
    tempo_bpm: int
    pattern: tuple[int, ...]


FIVE_NOTE_PATTERN = (0, 2, 4, 5, 7, 5, 4, 2, 0)
OCTAVE_ARPEGGIO_PATTERN = (0, 4, 7, 12, 7, 4, 0)
OCTAVE_REPEAT_FOUR_PATTERN = (0, 4, 7, 12, 12, 12, 12, 7, 4, 0)

PRACTICE_EXERCISE_DEFINITIONS = (
    PracticeExerciseDefinition("natural-lip-trill-five", 72, FIVE_NOTE_PATTERN),
    PracticeExerciseDefinition("natural-tongue-trill-five", 72, FIVE_NOTE_PATTERN),
    PracticeExerciseDefinition("natural-hum-five", 68, FIVE_NOTE_PATTERN),
    PracticeExerciseDefinition("natural-ng-octave-glide", 66, (0, 12, 0)),
    PracticeExerciseDefinition("natural-v-five", 70, FIVE_NOTE_PATTERN),
    PracticeExerciseDefinition("natural-vowel-five", 72, FIVE_NOTE_PATTERN),
    PracticeExerciseDefinition("connection-gug-five", 76, FIVE_NOTE_PATTERN),
    PracticeExerciseDefinition("mix-gee-staccato-arpeggio", 84, OCTAVE_ARPEGGIO_PATTERN),
    PracticeExerciseDefinition("closure-buh-repeat", 72, (0, 0, 0, 4, 4, 4, 7, 7, 7, 4, 0)),
    PracticeExerciseDefinition("closure-vee-fifth", 68, (0, 7, 7, 7, 0)),
    PracticeExerciseDefinition("closure-mum-triad-repeat", 72, (0, 4, 7, 7, 7, 4, 0)),
    PracticeExerciseDefinition("closure-gug-octave", 76, OCTAVE_ARPEGGIO_PATTERN),
    PracticeExerciseDefinition("connection-mum-octave", 70, OCTAVE_REPEAT_FOUR_PATTERN),
    PracticeExerciseDefinition(
        "passaggio-gee-long-scale",
        80,
        (0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 14, 12, 11, 9, 7, 5, 4, 2, 0),
    ),
    PracticeExerciseDefinition("register-woo-octave-glide", 66, (0, 12, 0)),
    PracticeExerciseDefinition("register-ng-ah-octave", 70, OCTAVE_ARPEGGIO_PATTERN),
    PracticeExerciseDefinition("register-mum-fifth-octave", 72, (0, 7, 12, 7, 0)),
    PracticeExerciseDefinition("register-noo-descending-octave", 74, (12, 11, 9, 7, 5, 4, 2, 0)),
    PracticeExerciseDefinition("range-lip-trill-twelfth", 72, (0, 4, 7, 12, 16, 19, 16, 12, 7, 4, 0)),
    PracticeExerciseDefinition("range-noo-octave-scale", 78, (0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0)),
    PracticeExerciseDefinition("range-twelfth-arpeggio", 76, (0, 4, 7, 12, 16, 19, 16, 12, 7, 4, 0)),
    PracticeExerciseDefinition(
        "range-two-octave-descending",
        72,
        (24, 23, 21, 19, 17, 16, 14, 12, 11, 9, 7, 5, 4, 2, 0),
    ),
    PracticeExerciseDefinition("range-thirds-ladder", 76, (0, 4, 2, 5, 4, 7, 5, 9, 7, 11, 9, 12)),
    PracticeExerciseDefinition("range-chromatic-five", 66, (0, 1, 2, 3, 4, 3, 2, 1, 0)),
    PracticeExerciseDefinition("mix-nay-five", 82, FIVE_NOTE_PATTERN),
    PracticeExerciseDefinition("mix-mum-octave-repeat", 76, (0, 4, 7, 12, 12, 12, 7, 4, 0)),
    PracticeExerciseDefinition("passaggio-nay-octave", 76, OCTAVE_ARPEGGIO_PATTERN),
    PracticeExerciseDefinition("mix-no-octave", 78, OCTAVE_ARPEGGIO_PATTERN),
    PracticeExerciseDefinition("mix-yeah-five", 80, FIVE_NOTE_PATTERN),
    PracticeExerciseDefinition("mix-mum-tenth", 76, (0, 4, 7, 12, 16, 12, 7, 4, 0)),
)
PRACTICE_EXERCISES_BY_KEY = {
    definition.exercise_key: definition for definition in PRACTICE_EXERCISE_DEFINITIONS
}
PRACTICE_ASSET_VERSION = 4

PHRASE_LEAD_IN_SECONDS = 1.0
CUE_REST_BEATS = 1.0
GUIDE_NOTE_BEATS = 0.75
PIANO_NOTE_DURATION_BEATS = 0.28
PIANO_CUE_DURATION_BEATS = 0.45
MIDI_TICKS_PER_BEAT = 480
MIDI_PIANO_PROGRAM = 1
MIDI_GUIDE_VELOCITY = 90
MIDI_CUE_VELOCITY = 112
MIDI_MINIMUM = 0
MIDI_MAXIMUM = 127
RENDER_SAMPLE_RATE = 44_100
OPUS_BITRATE = "12k"
ACCOMPANIMENT_LOUDNESS_FILTER = "loudnorm=I=-16:LRA=7:TP=-1.5"

MASTER_PIANO_RANGE = (48, 77)  # C3-F5
VOICE_PLAYBACK_RANGES: dict[str, tuple[int, int]] = {
    "male": (48, 72),   # C3-C5
    "female": (53, 77), # F3-F5
}

GENERATED_ASSET_DIRECTORY = Path("/app/practice-assets")

PRACTICE_MODE_GUIDED = "guided"
PRACTICE_ACTIVITY_WEEKS = 20
PRACTICE_ACTIVITY_DAYS_PER_WEEK = 7
PRACTICE_ACTIVITY_DAY_COUNT = PRACTICE_ACTIVITY_WEEKS * PRACTICE_ACTIVITY_DAYS_PER_WEEK
MINIMUM_PRACTICE_DURATION_SECONDS = 1
MAXIMUM_PRACTICE_DURATION_SECONDS = 10 * 60
PRACTICE_EVENT_CLOCK_TOLERANCE_SECONDS = 5
MINIMUM_TIMEZONE_OFFSET_MINUTES = -14 * 60
MAXIMUM_TIMEZONE_OFFSET_MINUTES = 14 * 60


def master_accompaniment_filename(exercise_key: str) -> str:
    return f"{exercise_key}-v{PRACTICE_ASSET_VERSION}-master.opus"
