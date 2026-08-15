import json
import subprocess
from pathlib import Path

import mido

from app.modules.practice.constants import (
    ACCOMPANIMENT_LOUDNESS_FILTER,
    MIDI_CUE_VELOCITY,
    MIDI_GUIDE_VELOCITY,
    MIDI_PIANO_PROGRAM,
    MIDI_TICKS_PER_BEAT,
    OPUS_BITRATE,
    PIANO_CUE_DURATION_BEATS,
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
    stem = f"{score.exercise_key}-v{score.version}-master"
    midi_path = output_directory / f"{stem}.mid"
    wav_path = output_directory / f"{stem}.wav"
    opus_path = output_directory / f"{stem}.opus"
    manifest_path = output_directory / f"{stem}.json"

    _write_midi(score, midi_path)
    subprocess.run([
        "fluidsynth", "-ni", "-R", "0", "-C", "0", "-g", "0.8",
        "-F", str(wav_path), "-r", str(RENDER_SAMPLE_RATE),
        str(soundfont), str(midi_path),
    ], check=True)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path),
        "-t", str(score.duration), "-af", ACCOMPANIMENT_LOUDNESS_FILTER,
        "-ac", "1", "-c:a", "libopus", "-b:a", OPUS_BITRATE,
        "-vbr", "on", "-application", "audio", str(opus_path),
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

    scheduled_notes = [
        (event.start, event.midi, MIDI_CUE_VELOCITY, PIANO_CUE_DURATION_BEATS)
        for event in score.cue_notes
    ] + [
        (event.start, event.midi, MIDI_GUIDE_VELOCITY, PIANO_NOTE_DURATION_BEATS)
        for event in score.target_notes
    ]
    previous_end_ticks = 0
    for start, midi_note, velocity, duration_beats in sorted(scheduled_notes):
        start_ticks = round(start * score.tempo_bpm / 60 * MIDI_TICKS_PER_BEAT)
        note_ticks = max(1, round(duration_beats * MIDI_TICKS_PER_BEAT))
        track.append(mido.Message(
            "note_on", note=midi_note, velocity=velocity,
            time=max(0, start_ticks - previous_end_ticks),
        ))
        track.append(mido.Message("note_off", note=midi_note, velocity=0, time=note_ticks))
        previous_end_ticks = start_ticks + note_ticks

    final_ticks = round(score.duration * score.tempo_bpm / 60 * MIDI_TICKS_PER_BEAT)
    track.append(mido.MetaMessage("end_of_track", time=max(0, final_ticks - previous_end_ticks)))
    midi.save(output_path)
