from dataclasses import asdict, dataclass

from app.modules.practice.constants import (
    OCTAVE_CONNECTION_COUNT_IN_BEATS,
    OCTAVE_CONNECTION_EXERCISE_KEY,
    OCTAVE_CONNECTION_NOTE_BEATS,
    OCTAVE_CONNECTION_PATTERN,
    OCTAVE_CONNECTION_PHRASE_REST_BEATS,
    OCTAVE_CONNECTION_TEMPO_BPM,
    OCTAVE_CONNECTION_VERSION,
    MASTER_PIANO_RANGE,
    VOICE_PLAYBACK_RANGES,
)


@dataclass(frozen=True)
class TargetNoteEvent:
    """One expected sung note on the accompaniment's authoritative timeline."""

    start: float
    end: float
    midi: int


@dataclass(frozen=True)
class PracticeScore:
    """Versioned symbolic score used by both audio rendering and Canvas targets."""

    exercise_key: str
    version: int
    voice: str
    tempo_bpm: int
    range_start_midi: int
    range_end_midi: int
    duration: float
    target_notes: tuple[TargetNoteEvent, ...]

    def manifest(self, audio_path: str) -> dict[str, object]:
        return {
            "exerciseKey": self.exercise_key,
            "version": self.version,
            "voice": self.voice,
            "tempoBpm": self.tempo_bpm,
            "range": {"minimumMidi": self.range_start_midi, "maximumMidi": self.range_end_midi},
            "duration": self.duration,
            "audioPath": audio_path,
            "targetNotes": [asdict(note) for note in self.target_notes],
        }


def build_octave_connection_score(voice: str) -> PracticeScore:
    """Build the fixed male C3-C5 or female F3-F5 octave-connection score.

    The first pitch of each phrase rises chromatically. The final phrase starts
    one octave below the configured upper boundary, so the entire fixed range is
    covered without allowing an unsafe client-side transposition.
    """

    if voice not in VOICE_PLAYBACK_RANGES:
        raise ValueError(f"Unsupported voice preset: {voice}")

    range_start, range_end = VOICE_PLAYBACK_RANGES[voice]
    master_start, master_end = MASTER_PIANO_RANGE
    if range_start < master_start or range_end > master_end:
        raise ValueError("Voice playback range exceeds the C3-F5 master piano range")
    seconds_per_beat = 60 / OCTAVE_CONNECTION_TEMPO_BPM
    cursor_beats = float(OCTAVE_CONNECTION_COUNT_IN_BEATS)
    events: list[TargetNoteEvent] = []

    for phrase_root in range(range_start, range_end - 12 + 1):
        for offset in OCTAVE_CONNECTION_PATTERN:
            start = cursor_beats * seconds_per_beat
            cursor_beats += OCTAVE_CONNECTION_NOTE_BEATS
            events.append(TargetNoteEvent(
                start=round(start, 6),
                end=round(cursor_beats * seconds_per_beat, 6),
                midi=phrase_root + offset,
            ))
        cursor_beats += OCTAVE_CONNECTION_PHRASE_REST_BEATS

    return PracticeScore(
        exercise_key=OCTAVE_CONNECTION_EXERCISE_KEY,
        version=OCTAVE_CONNECTION_VERSION,
        voice=voice,
        tempo_bpm=OCTAVE_CONNECTION_TEMPO_BPM,
        range_start_midi=range_start,
        range_end_midi=range_end,
        duration=round(cursor_beats * seconds_per_beat, 6),
        target_notes=tuple(events),
    )
