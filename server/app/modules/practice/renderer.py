import json
import subprocess
from pathlib import Path

import mido

from app.modules.practice.constants import (
    ACCOMPANIMENT_LOUDNESS_FILTER,
    MIDI_COUNT_IN_VELOCITY,
    MIDI_GUIDE_VELOCITY,
    MIDI_PIANO_PROGRAM,
    MIDI_TICKS_PER_BEAT,
    OCTAVE_CONNECTION_COUNT_IN_BEATS,
    OPUS_BITRATE,
    PIANO_NOTE_DURATION_BEATS,
    RENDER_SAMPLE_RATE,
)
from app.modules.practice.score import PracticeScore


def render_practice_score(score: PracticeScore, output_directory: Path, soundfont: Path) -> None:
    """Render a score to MIDI, mono Opus and its matching target manifest.

    FluidSynth and FFmpeg are intentionally invoked as pinned Docker build tools.
    They are not used on each playback request. A failure aborts the build so an
    audio file can never be published with a stale target curve.
    """

    output_directory.mkdir(parents=True, exist_ok=True)
    stem = f"{score.exercise_key}-v{score.version}-{score.voice}"
    midi_path = output_directory / f"{stem}.mid"
    wav_path = output_directory / f"{stem}.wav"
    opus_path = output_directory / f"{stem}.opus"
    manifest_path = output_directory / f"{stem}.json"

    _write_midi(score, midi_path)
    subprocess.run([
        "fluidsynth", "-ni", "-F", str(wav_path), "-r", str(RENDER_SAMPLE_RATE),
        str(soundfont), str(midi_path),
    ], check=True)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path),
        "-t", str(score.duration), "-af", ACCOMPANIMENT_LOUDNESS_FILTER,
        "-ac", "1", "-c:a", "libopus", "-b:a", OPUS_BITRATE, str(opus_path),
    ], check=True)
    manifest_path.write_text(
        json.dumps(score.manifest(f"/static/practice/{opus_path.name}"), ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    midi_path.unlink()
    wav_path.unlink()


def _write_midi(score: PracticeScore, output_path: Path) -> None:
    midi = mido.MidiFile(ticks_per_beat=MIDI_TICKS_PER_BEAT)
    track = mido.MidiTrack()
    midi.tracks.append(track)
    track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(score.tempo_bpm), time=0))
    track.append(mido.Message("program_change", program=MIDI_PIANO_PROGRAM, time=0))

    count_in_root = score.range_start_midi
    for _ in range(OCTAVE_CONNECTION_COUNT_IN_BEATS):
        _append_short_note(track, count_in_root, MIDI_COUNT_IN_VELOCITY, 1.0)

    previous_end_ticks = OCTAVE_CONNECTION_COUNT_IN_BEATS * MIDI_TICKS_PER_BEAT
    for event in score.target_notes:
        start_ticks = round(event.start * score.tempo_bpm / 60 * MIDI_TICKS_PER_BEAT)
        note_ticks = max(1, round(PIANO_NOTE_DURATION_BEATS * MIDI_TICKS_PER_BEAT))
        track.append(mido.Message(
            "note_on", note=event.midi, velocity=MIDI_GUIDE_VELOCITY,
            time=max(0, start_ticks - previous_end_ticks),
        ))
        track.append(mido.Message("note_off", note=event.midi, velocity=0, time=note_ticks))
        previous_end_ticks = start_ticks + note_ticks

    final_ticks = round(score.duration * score.tempo_bpm / 60 * MIDI_TICKS_PER_BEAT)
    track.append(mido.MetaMessage("end_of_track", time=max(0, final_ticks - previous_end_ticks)))
    midi.save(output_path)


def _append_short_note(track: mido.MidiTrack, note: int, velocity: int, spacing_beats: float) -> None:
    note_ticks = max(1, round(PIANO_NOTE_DURATION_BEATS * MIDI_TICKS_PER_BEAT))
    track.append(mido.Message("note_on", note=note, velocity=velocity, time=0))
    track.append(mido.Message("note_off", note=note, velocity=0, time=note_ticks))
    rest_ticks = max(0, round(spacing_beats * MIDI_TICKS_PER_BEAT) - note_ticks)
    track.append(mido.MetaMessage("marker", text="count-in", time=rest_ticks))
