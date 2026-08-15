"""Allow each practice exercise to carry multiple scientific category tags."""

import sqlalchemy as sa
from alembic import op


revision = "20260815_0009"
down_revision = "20260815_0008"
branch_labels = None
depends_on = None


EXTRA_TAGS = {
    "natural-lip-trill-octave": ("passaggio", "range"),
    "natural-tongue-trill-five": ("passaggio",),
    "natural-ng-octave-glide": ("passaggio",),
    "natural-v-five": ("connection",),
    "connection-gug-five": ("mix",),
    "mix-gee-staccato-arpeggio": ("mix",),
    "closure-vee-fifth": ("natural",),
    "closure-mum-triad-repeat": ("mix",),
    "closure-gug-octave": ("passaggio", "mix"),
    "connection-mum-octave": ("mix",),
    "passaggio-gee-long-scale": ("range",),
    "register-woo-octave-glide": ("natural",),
    "register-ng-ah-octave": ("natural",),
    "register-mum-fifth-octave": ("mix",),
    "register-noo-descending-octave": ("range",),
    "range-lip-trill-twelfth": ("natural", "passaggio"),
    "range-noo-octave-scale": ("passaggio",),
    "range-two-octave-descending": ("passaggio",),
    "mix-nay-five": ("connection",),
    "mix-mum-octave-repeat": ("passaggio",),
    "passaggio-nay-octave": ("connection", "passaggio"),
    "mix-no-octave": ("passaggio",),
    "mix-yeah-five": ("connection",),
    "mix-mum-tenth": ("passaggio", "range"),
}


def upgrade() -> None:
    bind = op.get_bind()
    tags = op.create_table(
        "practice_exercise_categories",
        sa.Column("exercise_id", sa.String(length=80), nullable=False),
        sa.Column("category_key", sa.String(length=40), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["exercise_id"], ["practice_exercises.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_key"], ["practice_categories.key"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("exercise_id", "category_key"),
    )
    primary_tags = bind.execute(
        sa.text("SELECT id, category_key FROM practice_exercises ORDER BY sort_order, id")
    ).all()
    rows = []
    for exercise_id, primary_category in primary_tags:
        rows.append({"exercise_id": exercise_id, "category_key": primary_category, "sort_order": 0})
        rows.extend(
            {"exercise_id": exercise_id, "category_key": category_key, "sort_order": index * 10}
            for index, category_key in enumerate(EXTRA_TAGS.get(exercise_id, ()), start=1)
            if category_key != primary_category
        )
    op.bulk_insert(tags, rows)
    op.drop_column("practice_exercises", "category_key")


def downgrade() -> None:
    op.add_column(
        "practice_exercises",
        sa.Column("category_key", sa.String(length=40), nullable=True),
    )
    bind = op.get_bind()
    bind.execute(sa.text("""
        UPDATE practice_exercises AS exercise
        SET category_key = tags.category_key
        FROM practice_exercise_categories AS tags
        WHERE tags.exercise_id = exercise.id AND tags.sort_order = 0
    """))
    op.alter_column("practice_exercises", "category_key", nullable=False)
    op.create_foreign_key(
        "practice_exercises_category_key_fkey",
        "practice_exercises",
        "practice_categories",
        ["category_key"],
        ["key"],
        ondelete="RESTRICT",
    )
    op.drop_table("practice_exercise_categories")
