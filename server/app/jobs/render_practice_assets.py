import argparse
from pathlib import Path

from app.modules.practice.renderer import render_practice_score
from app.modules.practice.score import build_octave_connection_score


def main() -> None:
    parser = argparse.ArgumentParser(description="Render versioned SingJourney practice assets")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--soundfont", type=Path, required=True)
    args = parser.parse_args()
    for voice in ("male", "female"):
        render_practice_score(build_octave_connection_score(voice), args.output, args.soundfont)


if __name__ == "__main__":
    main()
