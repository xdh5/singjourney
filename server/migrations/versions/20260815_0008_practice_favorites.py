"""Store authenticated users' favorite practice exercises."""

import sqlalchemy as sa
from alembic import op


revision = "20260815_0008"
down_revision = "20260815_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "practice_favorites",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("exercise_id", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exercise_id"], ["practice_exercises.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "exercise_id"),
    )


def downgrade() -> None:
    op.drop_table("practice_favorites")
