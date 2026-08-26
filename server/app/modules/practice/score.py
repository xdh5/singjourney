from dataclasses import dataclass

from app.modules.practice.constants import (
    CUE_REST_BEATS,
    LEGACY_VOICE_PLAYBACK_RANGES,
    MASTER_PIANO_RANGE,
    PHRASE_LEAD_IN_SECONDS,
    PIANO_CUE_DURATION_BEATS,
    PRACTICE_ASSET_VERSION,
    PRACTICE_EXERCISES_BY_KEY,
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
    """构建一份覆盖完整音域的权威伴奏。"""

    definition = PRACTICE_EXERCISES_BY_KEY[exercise_key]
    range_start, range_end = MASTER_PIANO_RANGE
    maximum_offset = max(definition.pattern)
    if definition.progression_mode == "round_trip":
        ascending_roots = list(range(range_start, range_end + 1))
        descending_roots = list(range(range_end, range_start - 1, -1))
        return _build_practice_score(
            definition,
            "master",
            range_start,
            range_end,
            ascending_roots + descending_roots,
        )
    return _build_practice_score(
        definition,
        "master",
        range_start,
        range_end,
        list(range(range_start, range_end - maximum_offset + 1)),
    )


def build_practice_manifest(
    exercise_key: str,
    minimum_midi: int,
    maximum_midi: int,
    audio_path: str,
    legacy_voice: str | None = None,
) -> dict[str, object]:
    """生成指定声线的练习播放清单。"""

    definition = PRACTICE_EXERCISES_BY_KEY[exercise_key]
    if definition.progression_mode == "round_trip":
        return _build_round_trip_manifest(
            exercise_key,
            minimum_midi,
            maximum_midi,
            audio_path,
            legacy_voice,
        )
    score = build_practice_master_score(exercise_key)
    pattern = PRACTICE_EXERCISES_BY_KEY[exercise_key].pattern
    phrase_size = len(pattern)
    phrases = [
        score.target_notes[index:index + phrase_size]
        for index in range(0, len(score.target_notes), phrase_size)
    ]
    selected = [
        phrase
        for phrase in phrases
        if phrase
        and min(note.midi for note in phrase) >= minimum_midi
        and max(note.midi for note in phrase) <= maximum_midi
    ]
    if not selected:
        raise ValueError(f"Selected range has no playable phrases: {exercise_key}")

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
        "voice": legacy_voice or "custom",
        "tempo_bpm": score.tempo_bpm,
        "range": {"minimum_midi": minimum_midi, "maximum_midi": maximum_midi},
        "duration": round(segment_end - segment_start, 6),
        "audio_path": audio_path,
        "audio_offset": round(segment_start, 6),
        "audio_segments": [{
            "source_offset": round(segment_start, 6),
            "duration": round(segment_end - segment_start, 6),
        }],
        "target_notes": [
            {
                "start": round(note.start - segment_start, 6),
                "end": round(note.end - segment_start, 6),
                "midi": note.midi,
            }
            for note in notes
        ],
    }


def _build_round_trip_manifest(
    exercise_key: str,
    minimum_midi: int,
    maximum_midi: int,
    audio_path: str,
    legacy_voice: str | None,
) -> dict[str, object]:
    """从上、下行母带中裁出两个片段并拼成一条虚拟时间轴。"""

    score = build_practice_master_score(exercise_key)
    definition = PRACTICE_EXERCISES_BY_KEY[exercise_key]
    phrase_size = len(definition.pattern)
    master_start, master_end = MASTER_PIANO_RANGE
    ascending_count = master_end - master_start + 1
    phrases = [
        score.target_notes[index:index + phrase_size]
        for index in range(0, len(score.target_notes), phrase_size)
    ]
    ascending = phrases[:ascending_count]
    descending = phrases[ascending_count:]
    maximum_offset = max(definition.pattern)
    highest_root = maximum_midi - maximum_offset
    ascending_selected = ascending[
        minimum_midi - master_start:highest_root - master_start + 1
    ]
    descending_start_root = highest_root - 1
    descending_selected = [] if descending_start_root < minimum_midi else descending[
        master_end - descending_start_root:master_end - minimum_midi + 1
    ]
    selected_groups = [ascending_selected, descending_selected]
    audio_segments: list[dict[str, float]] = []
    target_notes: list[dict[str, float | int]] = []
    virtual_cursor = 0.0
    for selected in selected_groups:
        if not selected:
            continue
        segment_start = _phrase_segment_start(score, selected[0][0])
        segment_end = selected[-1][-1].end
        segment_duration = round(segment_end - segment_start, 6)
        audio_segments.append({
            "source_offset": round(segment_start, 6),
            "duration": segment_duration,
        })
        for phrase in selected:
            for note in phrase:
                target_notes.append({
                    "start": round(virtual_cursor + note.start - segment_start, 6),
                    "end": round(virtual_cursor + note.end - segment_start, 6),
                    "midi": note.midi,
                })
        virtual_cursor += segment_duration
    return {
        "exercise_key": score.exercise_key,
        "version": score.version,
        "voice": legacy_voice or "custom",
        "tempo_bpm": score.tempo_bpm,
        "range": {"minimum_midi": minimum_midi, "maximum_midi": maximum_midi},
        "duration": round(virtual_cursor, 6),
        "audio_path": audio_path,
        "audio_offset": audio_segments[0]["source_offset"],
        "audio_segments": audio_segments,
        "target_notes": target_notes,
    }


def _phrase_segment_start(score: PracticeScore, first_event: TargetNoteEvent) -> float:
    cue_duration_seconds = PIANO_CUE_DURATION_BEATS * 60 / score.tempo_bpm
    cue_rest_seconds = CUE_REST_BEATS * 60 / score.tempo_bpm
    return max(
        0.0,
        first_event.start - PHRASE_LEAD_IN_SECONDS - cue_duration_seconds - cue_rest_seconds,
    )


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
