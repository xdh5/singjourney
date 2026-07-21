from app.modules.practice.score import build_octave_connection_score


def test_male_octave_connection_uses_fixed_c3_c5_range() -> None:
    score = build_octave_connection_score("male")

    assert score.range_start_midi == 48
    assert score.range_end_midi == 72
    assert min(note.midi for note in score.target_notes) == 48
    assert max(note.midi for note in score.target_notes) == 72
    assert len(score.target_notes) == 130


def test_female_octave_connection_uses_fixed_f3_f5_range() -> None:
    score = build_octave_connection_score("female")

    assert score.range_start_midi == 53
    assert score.range_end_midi == 77
    assert min(note.midi for note in score.target_notes) == 53
    assert max(note.midi for note in score.target_notes) == 77
    assert len(score.target_notes) == 130
