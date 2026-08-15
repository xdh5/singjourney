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


def build_octave_connection_master_score() -> PracticeScore:
    """Build one authoritative C3-F5 score shared by every voice preset."""

    range_start, range_end = MASTER_PIANO_RANGE
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
        voice="master",
        tempo_bpm=OCTAVE_CONNECTION_TEMPO_BPM,
        range_start_midi=range_start,
        range_end_midi=range_end,
        duration=round(cursor_beats * seconds_per_beat, 6),
        target_notes=tuple(events),
    )


def build_octave_connection_manifest(voice: str, audio_path: str) -> dict[str, object]:
    """Slice one voice preset from the shared master score without duplicating audio."""

    if voice not in VOICE_PLAYBACK_RANGES:
        raise ValueError(f"Unsupported voice preset: {voice}")
    score = build_octave_connection_master_score()
    range_start, range_end = VOICE_PLAYBACK_RANGES[voice]
    phrase_size = len(OCTAVE_CONNECTION_PATTERN)
    phrases = [
        score.target_notes[index:index + phrase_size]
        for index in range(0, len(score.target_notes), phrase_size)
    ]
    selected = [
        phrase
        for phrase in phrases
        if phrase and min(note.midi for note in phrase) >= range_start
        and max(note.midi for note in phrase) <= range_end
    ]
    if not selected:
        raise ValueError(f"Voice preset has no playable phrases: {voice}")

    first_event = selected[0][0]
    last_event = selected[-1][-1]
    segment_start = 0.0 if first_event is score.target_notes[0] else first_event.start
    phrase_rest_seconds = OCTAVE_CONNECTION_PHRASE_REST_BEATS * 60 / score.tempo_bpm
    segment_end = min(score.duration, last_event.end + phrase_rest_seconds)
    notes = [note for phrase in selected for note in phrase]
    return {
        "exercise_key": score.exercise_key,
        "version": score.version,
        "voice": voice,
        "tempo_bpm": score.tempo_bpm,
        "range": {"minimum_midi": range_start, "maximum_midi": range_end},
        "duration": round(segment_end - segment_start, 6),
        "audio_path": audio_path,
        "audio_offset": round(segment_start, 6),
        "target_notes": [
            {
                "start": round(note.start - segment_start, 6),
                "end": round(note.end - segment_start, 6),
                "midi": note.midi,
            }
            for note in notes
        ],
    }
