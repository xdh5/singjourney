import argparse
from pathlib import Path

from practice.constants import (
    PRACTICE_EXERCISE_DEFINITIONS,
    master_accompaniment_filename,
)
from practice.renderer import render_practice_score
from practice.score import build_practice_master_score


def main() -> None:
    parser = argparse.ArgumentParser(description="Render versioned SingJourney practice assets")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--soundfont", type=Path, required=True)
    args = parser.parse_args()
    rendered_filenames: set[str] = set()
    for definition in PRACTICE_EXERCISE_DEFINITIONS:
        filename = master_accompaniment_filename(definition.exercise_key)
        if filename not in rendered_filenames:
            render_practice_score(build_practice_master_score(definition.exercise_key), args.output, args.soundfont)
            rendered_filenames.add(filename)


if __name__ == "__main__":
    main()
