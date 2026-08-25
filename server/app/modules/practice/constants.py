from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path


FREE_PRACTICE_EXERCISE_KEY = "free-practice"
FREE_PRACTICE_CATEGORY_KEY = "natural"
FREE_PRACTICE_MODE = "free"


@dataclass(frozen=True)
class PracticeExerciseDefinition:
    exercise_key: str
    tempo_bpm: int
    pattern: tuple[int, ...]
    progression_mode: str = "one_way"
    guide_note_beats: float = 0.45
    piano_note_duration_beats: float = 0.1848


FIVE_NOTE_PATTERN = (0, 2, 4, 5, 7, 5, 4, 2, 0)
OCTAVE_ARPEGGIO_PATTERN = (0, 4, 7, 12, 7, 4, 0)
OCTAVE_REPEAT_FOUR_PATTERN = (0, 4, 7, 12, 12, 12, 12, 7, 4, 0)
OCTAVE_GLIDE_PATTERN = (0, 12, 0)

_PRACTICE_EXERCISE_DEFINITIONS = (
    PracticeExerciseDefinition("natural-lip-trill-five", 72, FIVE_NOTE_PATTERN),
    PracticeExerciseDefinition("natural-tongue-trill-five", 72, FIVE_NOTE_PATTERN),
    PracticeExerciseDefinition("natural-hum-five", 68, FIVE_NOTE_PATTERN),
    PracticeExerciseDefinition("natural-mnn-third-hum", 68, (0, 2, 4, 2, 0)),
    PracticeExerciseDefinition("natural-mnn-third-hum-round-trip", 68, (0, 2, 4, 2, 0), "round_trip"),
    PracticeExerciseDefinition("natural-ng-octave-glide", 66, OCTAVE_GLIDE_PATTERN),
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
    PracticeExerciseDefinition("register-woo-octave-glide", 66, OCTAVE_GLIDE_PATTERN),
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

# 每种完整音型独立登记时值，同音型的全部练习共用配置。
_PATTERN_TIMINGS: dict[tuple[int, ...], tuple[float, float]] = {
    FIVE_NOTE_PATTERN: (0.45, 0.2772),
    (0, 2, 4, 2, 0): (0.45, 0.1848),
    OCTAVE_GLIDE_PATTERN: (1.25, 1.1),
    OCTAVE_ARPEGGIO_PATTERN: (0.45, 0.1848),
    OCTAVE_REPEAT_FOUR_PATTERN: (0.45, 0.1848),
    (0, 0, 0, 4, 4, 4, 7, 7, 7, 4, 0): (0.45, 0.1848),
    (0, 7, 7, 7, 0): (0.45, 0.1848),
    (0, 4, 7, 7, 7, 4, 0): (0.45, 0.1848),
    (0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 14, 12, 11, 9, 7, 5, 4, 2, 0): (0.45, 0.1848),
    (0, 7, 12, 7, 0): (0.45, 0.1848),
    (12, 11, 9, 7, 5, 4, 2, 0): (0.45, 0.1848),
    (0, 4, 7, 12, 16, 19, 16, 12, 7, 4, 0): (0.45, 0.1848),
    (0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0): (0.45, 0.1848),
    (24, 23, 21, 19, 17, 16, 14, 12, 11, 9, 7, 5, 4, 2, 0): (0.45, 0.1848),
    (0, 4, 2, 5, 4, 7, 5, 9, 7, 11, 9, 12): (0.45, 0.1848),
    (0, 1, 2, 3, 4, 3, 2, 1, 0): (0.45, 0.1848),
    (0, 4, 7, 12, 12, 12, 7, 4, 0): (0.45, 0.1848),
    (0, 4, 7, 12, 16, 12, 7, 4, 0): (0.45, 0.1848),
}

# 其余相同音型沿用原来的标准速度和共享伴奏策略。
_STANDARD_PATTERN_TEMPOS = {
    FIVE_NOTE_PATTERN: 72,
    OCTAVE_ARPEGGIO_PATTERN: 76,
}
_resolved_pattern_tempos: dict[tuple[int, ...], int] = {}
PRACTICE_EXERCISE_DEFINITIONS = tuple(
    PracticeExerciseDefinition(
        definition.exercise_key,
        _resolved_pattern_tempos.setdefault(
            definition.pattern,
            _STANDARD_PATTERN_TEMPOS.get(definition.pattern, definition.tempo_bpm),
        ),
        definition.pattern,
        progression_mode=definition.progression_mode,
        guide_note_beats=_PATTERN_TIMINGS[definition.pattern][0],
        piano_note_duration_beats=_PATTERN_TIMINGS[definition.pattern][1],
    )
    for definition in _PRACTICE_EXERCISE_DEFINITIONS
)
PRACTICE_EXERCISES_BY_KEY = {
    definition.exercise_key: definition for definition in PRACTICE_EXERCISE_DEFINITIONS
}
PRACTICE_ASSET_VERSION = 15

PHRASE_LEAD_IN_SECONDS = 1.0
CUE_REST_BEATS = 1.0
PIANO_CUE_DURATION_BEATS = 0.45
MIDI_TICKS_PER_BEAT = 480
MIDI_PIANO_PROGRAM = 1
MIDI_GUIDE_VELOCITY = 90
MIDI_CUE_VELOCITY = 112
MIDI_MINIMUM = 0
MIDI_MAXIMUM = 127
RENDER_SAMPLE_RATE = 44_100
OPUS_BITRATE = "16k"
ACCOMPANIMENT_LOUDNESS_FILTER = "highpass=f=55,treble=g=3:f=2800,loudnorm=I=-16:LRA=7:TP=-1.5"

MASTER_PIANO_RANGE = (48, 77)  # C3-F5
VOICE_PLAYBACK_RANGES: dict[str, tuple[int, int]] = {
    "male": (48, 72),   # C3-C5
    "female": (53, 77), # F3-F5
}

GENERATED_ASSET_DIRECTORY = Path("/app/practice-assets")

PRACTICE_MODE_GUIDED = "guided"
MINIMUM_PRACTICE_DURATION_SECONDS = 1
MAXIMUM_PRACTICE_DURATION_SECONDS = 10 * 60
PRACTICE_EVENT_CLOCK_TOLERANCE_SECONDS = 5
MINIMUM_TIMEZONE_OFFSET_MINUTES = -14 * 60
MAXIMUM_TIMEZONE_OFFSET_MINUTES = 14 * 60


def master_accompaniment_filename(exercise_key: str) -> str:
    definition = PRACTICE_EXERCISES_BY_KEY[exercise_key]
    render_signature = (
        PRACTICE_ASSET_VERSION,
        definition.tempo_bpm,
        definition.pattern,
        PHRASE_LEAD_IN_SECONDS,
        CUE_REST_BEATS,
        definition.guide_note_beats,
        definition.piano_note_duration_beats,
        PIANO_CUE_DURATION_BEATS,
        MIDI_PIANO_PROGRAM,
        MIDI_GUIDE_VELOCITY,
        MIDI_CUE_VELOCITY,
        MASTER_PIANO_RANGE,
        RENDER_SAMPLE_RATE,
        OPUS_BITRATE,
        ACCOMPANIMENT_LOUDNESS_FILTER,
    )
    digest = sha256(repr(render_signature).encode("utf-8")).hexdigest()[:16]
    return f"accompaniment-{digest}.opus"


def accompaniment_filename(exercise_key: str, voice: str) -> str:
    """返回练习对应声线的伴奏文件名。"""

    definition = PRACTICE_EXERCISES_BY_KEY[exercise_key]
    if definition.progression_mode == "one_way":
        return master_accompaniment_filename(exercise_key)
    render_signature = (
        PRACTICE_ASSET_VERSION,
        definition.tempo_bpm,
        definition.pattern,
        definition.progression_mode,
        voice,
        VOICE_PLAYBACK_RANGES[voice],
        PHRASE_LEAD_IN_SECONDS,
        CUE_REST_BEATS,
        definition.guide_note_beats,
        definition.piano_note_duration_beats,
        PIANO_CUE_DURATION_BEATS,
        MIDI_PIANO_PROGRAM,
        MIDI_GUIDE_VELOCITY,
        MIDI_CUE_VELOCITY,
        RENDER_SAMPLE_RATE,
        OPUS_BITRATE,
        ACCOMPANIMENT_LOUDNESS_FILTER,
    )
    digest = sha256(repr(render_signature).encode("utf-8")).hexdigest()[:16]
    return f"accompaniment-{digest}.opus"


def guide_note_beats_for(exercise_key: str) -> float:
    """返回指定练习每个目标音占用的拍数。"""

    return PRACTICE_EXERCISES_BY_KEY[exercise_key].guide_note_beats


def piano_note_duration_beats_for(exercise_key: str) -> float:
    """返回指定练习中钢琴引导音的持续拍数。"""

    return PRACTICE_EXERCISES_BY_KEY[exercise_key].piano_note_duration_beats
