"""Add idempotent client event identifiers to practice sessions."""

import sqlalchemy as sa
from alembic import op


revision = "20260722_0003"
down_revision = "20260720_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("practice_sessions", sa.Column("client_event_id", sa.String(length=80), nullable=True))
    op.create_unique_constraint(
        "uq_practice_session_user_event",
        "practice_sessions",
        ["user_id", "client_event_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_practice_session_user_event", "practice_sessions", type_="unique")
    op.drop_column("practice_sessions", "client_event_id")
