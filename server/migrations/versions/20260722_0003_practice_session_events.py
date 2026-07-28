"""Add idempotent client event identifiers to practice sessions."""

import sqlalchemy as sa
from alembic import op


revision = "20260722_0003"
down_revision = "20260720_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("practice_sessions")}
    constraints = {
        constraint["name"]
        for constraint in inspector.get_unique_constraints("practice_sessions")
        if constraint["name"]
    }
    if "client_event_id" not in columns:
        op.add_column("practice_sessions", sa.Column("client_event_id", sa.String(length=80), nullable=True))
    if "uq_practice_session_user_event" not in constraints:
        op.create_unique_constraint(
            "uq_practice_session_user_event",
            "practice_sessions",
            ["user_id", "client_event_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    constraints = {
        constraint["name"]
        for constraint in inspector.get_unique_constraints("practice_sessions")
        if constraint["name"]
    }
    columns = {column["name"] for column in inspector.get_columns("practice_sessions")}
    if "uq_practice_session_user_event" in constraints:
        op.drop_constraint("uq_practice_session_user_event", "practice_sessions", type_="unique")
    if "client_event_id" in columns:
        op.drop_column("practice_sessions", "client_event_id")
