"""Remove the unused server-side recording share data."""

import sqlalchemy as sa
from alembic import op


revision = "20260815_0006"
down_revision = "20260815_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "recording_shares" in inspector.get_table_names():
        op.drop_table("recording_shares")
    if "audio_assets" in inspector.get_table_names():
        bind.execute(sa.text("DELETE FROM audio_assets WHERE purpose = 'share'"))


def downgrade() -> None:
    pass
