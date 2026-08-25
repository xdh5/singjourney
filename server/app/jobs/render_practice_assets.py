import argparse
from pathlib import Path

from app.modules.practice.constants import (
    PRACTICE_EXERCISE_DEFINITIONS,
    VOICE_PLAYBACK_RANGES,
    accompaniment_filename,
)
from app.modules.practice.renderer import render_practice_score
from app.modules.practice.score import build_practice_master_score, build_practice_round_trip_score


def main() -> None:
    parser = argparse.ArgumentParser(description="Render versioned SingJourney practice assets")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--soundfont", type=Path, required=True)
    args = parser.parse_args()
    rendered_filenames: set[str] = set()
    for definition in PRACTICE_EXERCISE_DEFINITIONS:
        if definition.progression_mode == "round_trip":
            for voice in VOICE_PLAYBACK_RANGES:
                filename = accompaniment_filename(definition.exercise_key, voice)
                if filename in rendered_filenames:
                    continue
                render_practice_score(
                    build_practice_round_trip_score(definition.exercise_key, voice),
                    args.output,
                    args.soundfont,
                )
                rendered_filenames.add(filename)
            continue
        filename = accompaniment_filename(definition.exercise_key, "male")
        if filename not in rendered_filenames:
            render_practice_score(build_practice_master_score(definition.exercise_key), args.output, args.soundfont)
            rendered_filenames.add(filename)


if __name__ == "__main__":
    main()
