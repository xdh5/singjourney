from dataclasses import dataclass

from app.modules.practice.constants import (
    CUE_REST_BEATS,
    MASTER_PIANO_RANGE,
    PHRASE_LEAD_IN_SECONDS,
    PIANO_CUE_DURATION_BEATS,
    PRACTICE_ASSET_VERSION,
    PRACTICE_EXERCISES_BY_KEY,
    VOICE_PLAYBACK_RANGES,
    guide_note_beats_for,
)


@dataclass(frozen=True)
class TargetNoteEvent:
    """One expected sung note on the accompaniment's authoritative timeline."""

    start: float
    end: float
    midi: int


@dataclass(frozen=True)
class CueNoteEvent:
    """One short reference note played before a phrase begins."""

    start: float
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
    cue_notes: tuple[CueNoteEvent, ...]
    target_notes: tuple[TargetNoteEvent, ...]

def build_practice_master_score(exercise_key: str) -> PracticeScore:
    """Build one authoritative C3-F5 accompaniment for an exercise."""

    definition = PRACTICE_EXERCISES_BY_KEY[exercise_key]
    range_start, range_end = MASTER_PIANO_RANGE
    maximum_offset = max(definition.pattern)
    seconds_per_beat = 60 / definition.tempo_bpm
    cursor_seconds = 0.0
    cue_duration_seconds = PIANO_CUE_DURATION_BEATS * seconds_per_beat
    cue_rest_seconds = CUE_REST_BEATS * seconds_per_beat
    guide_note_seconds = guide_note_beats_for(exercise_key) * seconds_per_beat
    cues: list[CueNoteEvent] = []
    events: list[TargetNoteEvent] = []

    for phrase_root in range(range_start, range_end - maximum_offset + 1):
        cursor_seconds += PHRASE_LEAD_IN_SECONDS
        cues.append(CueNoteEvent(start=round(cursor_seconds, 6), midi=phrase_root))
        cursor_seconds += cue_duration_seconds + cue_rest_seconds
        for offset in definition.pattern:
            start = cursor_seconds
            cursor_seconds += guide_note_seconds
            events.append(TargetNoteEvent(
                start=round(start, 6),
                end=round(cursor_seconds, 6),
                midi=phrase_root + offset,
            ))

    return PracticeScore(
        exercise_key=definition.exercise_key,
        version=PRACTICE_ASSET_VERSION,
        voice="master",
        tempo_bpm=definition.tempo_bpm,
        range_start_midi=range_start,
        range_end_midi=range_end,
        duration=round(cursor_seconds, 6),
        cue_notes=tuple(cues),
        target_notes=tuple(events),
    )


def build_practice_manifest(exercise_key: str, voice: str, audio_path: str) -> dict[str, object]:
    """生成指定声线的练习播放清单。"""

    if voice not in VOICE_PLAYBACK_RANGES:
        raise ValueError(f"Unsupported voice preset: {voice}")
    definition = PRACTICE_EXERCISES_BY_KEY[exercise_key]
    if definition.progression_mode == "round_trip":
        score = build_practice_round_trip_score(exercise_key, voice)
        range_start, range_end = VOICE_PLAYBACK_RANGES[voice]
        return {
            "exercise_key": score.exercise_key,
            "version": score.version,
            "voice": voice,
            "tempo_bpm": score.tempo_bpm,
            "range": {"minimum_midi": range_start, "maximum_midi": range_end},
            "duration": score.duration,
            "audio_path": audio_path,
            "audio_offset": 0,
            "target_notes": [
                {"start": note.start, "end": note.end, "midi": note.midi}
                for note in score.target_notes
            ],
        }
    score = build_practice_master_score(exercise_key)
    pattern = PRACTICE_EXERCISES_BY_KEY[exercise_key].pattern
    range_start, range_end = VOICE_PLAYBACK_RANGES[voice]
    phrase_size = len(pattern)
    phrases = [
        score.target_notes[index:index + phrase_size]
        for index in range(0, len(score.target_notes), phrase_size)
    ]
    selected = [
        phrase
        for phrase in phrases
        if phrase
        and min(note.midi for note in phrase) >= range_start
        and max(note.midi for note in phrase) <= range_end
    ]
    if not selected:
        raise ValueError(f"Voice preset has no playable phrases: {exercise_key}/{voice}")

    first_event = selected[0][0]
    last_event = selected[-1][-1]
    cue_duration_seconds = PIANO_CUE_DURATION_BEATS * 60 / score.tempo_bpm
    cue_rest_seconds = CUE_REST_BEATS * 60 / score.tempo_bpm
    segment_start = max(
        0.0,
        first_event.start - PHRASE_LEAD_IN_SECONDS - cue_duration_seconds - cue_rest_seconds,
    )
    segment_end = min(score.duration, last_event.end)
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


def build_practice_round_trip_score(exercise_key: str, voice: str) -> PracticeScore:
    """构建从声线低端上行到高端、再完整回行的独立乐谱。"""

    if voice not in VOICE_PLAYBACK_RANGES:
        raise ValueError(f"Unsupported voice preset: {voice}")
    definition = PRACTICE_EXERCISES_BY_KEY[exercise_key]
    range_start, range_end = VOICE_PLAYBACK_RANGES[voice]
    highest_root = range_end - max(definition.pattern)
    ascending_roots = list(range(range_start, highest_root + 1))
    phrase_roots = ascending_roots + list(range(highest_root - 1, range_start - 1, -1))
    return _build_practice_score(definition, voice, range_start, range_end, phrase_roots)


def _build_practice_score(
    definition,
    voice: str,
    range_start: int,
    range_end: int,
    phrase_roots: list[int],
) -> PracticeScore:
    """按给定根音顺序建立完整练习乐谱。"""

    seconds_per_beat = 60 / definition.tempo_bpm
    cursor_seconds = 0.0
    cue_duration_seconds = PIANO_CUE_DURATION_BEATS * seconds_per_beat
    cue_rest_seconds = CUE_REST_BEATS * seconds_per_beat
    guide_note_seconds = guide_note_beats_for(definition.exercise_key) * seconds_per_beat
    cues: list[CueNoteEvent] = []
    events: list[TargetNoteEvent] = []
    for phrase_root in phrase_roots:
        cursor_seconds += PHRASE_LEAD_IN_SECONDS
        cues.append(CueNoteEvent(start=round(cursor_seconds, 6), midi=phrase_root))
        cursor_seconds += cue_duration_seconds + cue_rest_seconds
        for offset in definition.pattern:
            start = cursor_seconds
            cursor_seconds += guide_note_seconds
            events.append(TargetNoteEvent(
                start=round(start, 6),
                end=round(cursor_seconds, 6),
                midi=phrase_root + offset,
            ))
    return PracticeScore(
        exercise_key=definition.exercise_key,
        version=PRACTICE_ASSET_VERSION,
        voice=voice,
        tempo_bpm=definition.tempo_bpm,
        range_start_midi=range_start,
        range_end_midi=range_end,
        duration=round(cursor_seconds, 6),
        cue_notes=tuple(cues),
        target_notes=tuple(events),
    )
