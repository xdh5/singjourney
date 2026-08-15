"""Enable every practice exercise now backed by a generated accompaniment."""

import sqlalchemy as sa
from alembic import op


revision = "20260815_0011"
down_revision = "20260815_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text(
        "DELETE FROM practice_exercises WHERE id = 'natural-lip-trill-octave'"
    ))
    bind.execute(sa.text("UPDATE practice_exercises SET enabled = true"))


def downgrade() -> None:
    op.get_bind().execute(sa.text(
        "UPDATE practice_exercises SET enabled = (id = 'connection-mum-octave')"
    ))
