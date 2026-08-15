"""Add generic upload metadata to audio assets."""

import sqlalchemy as sa
from alembic import op


revision = "20260720_0002"
down_revision = "20260720_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("audio_assets")}
    indexes = {index["name"] for index in inspector.get_indexes("audio_assets")}
    if "storage_provider" not in columns:
        op.add_column(
            "audio_assets",
            sa.Column("storage_provider", sa.String(length=32), nullable=False, server_default="local"),
        )
    if "upload_status" not in columns:
        op.add_column(
            "audio_assets",
            sa.Column("upload_status", sa.String(length=24), nullable=False, server_default="ready"),
        )
    op.alter_column("audio_assets", "sha256", existing_type=sa.String(length=64), nullable=True)
    if "ix_audio_assets_storage_provider" not in indexes:
        op.create_index("ix_audio_assets_storage_provider", "audio_assets", ["storage_provider"])
    if "ix_audio_assets_upload_status" not in indexes:
        op.create_index("ix_audio_assets_upload_status", "audio_assets", ["upload_status"])


def downgrade() -> None:
    op.drop_index("ix_audio_assets_upload_status", table_name="audio_assets")
    op.drop_index("ix_audio_assets_storage_provider", table_name="audio_assets")
    op.alter_column("audio_assets", "sha256", existing_type=sa.String(length=64), nullable=False)
    op.drop_column("audio_assets", "upload_status")
    op.drop_column("audio_assets", "storage_provider")
