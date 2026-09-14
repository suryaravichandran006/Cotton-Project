"""create predictions table

Revision ID: 0001
Revises:
Create Date: 2025-01-01
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "predictions",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("image_key", sa.String(length=255), nullable=False),
        sa.Column("image_original_name", sa.String(length=255)),
        sa.Column("image_width", sa.Integer()),
        sa.Column("image_height", sa.Integer()),
        sa.Column("image_size_bytes", sa.Integer()),
        sa.Column("image_format", sa.String(length=16)),
        sa.Column("model_name", sa.String(length=128), nullable=False),
        sa.Column("model_version", sa.String(length=64), nullable=False),
        sa.Column("architecture", sa.String(length=64)),
        sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("predicted_class", sa.String(length=128), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("raw_probability", sa.Float(), nullable=False),
        sa.Column("confidence_level", sa.String(length=16), nullable=False),
        sa.Column("is_unknown", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("unknown_reason", sa.Text()),
        sa.Column("top_predictions", sa.JSON(), nullable=False),
        sa.Column("ood_scores", sa.JSON()),
        sa.Column("preprocess_ms", sa.Float()),
        sa.Column("inference_ms", sa.Float()),
        sa.Column("explainability_ms", sa.Float()),
        sa.Column("total_ms", sa.Float()),
        sa.Column("device", sa.String(length=16)),
        sa.Column("gradcam_key", sa.String(length=255)),
        sa.Column("explanation_error", sa.Text()),
        sa.Column("client_metadata", sa.JSON()),
    )
    op.create_index("ix_predictions_created_at", "predictions", ["created_at"])
    op.create_index("ix_predictions_model_name", "predictions", ["model_name"])
    op.create_index("ix_predictions_predicted_class", "predictions", ["predicted_class"])
    op.create_index("ix_predictions_is_unknown", "predictions", ["is_unknown"])
    op.create_index("ix_predictions_created_class", "predictions", ["created_at", "predicted_class"])


def downgrade() -> None:
    for name in ("ix_predictions_created_class", "ix_predictions_is_unknown", "ix_predictions_predicted_class", "ix_predictions_model_name", "ix_predictions_created_at"):
        op.drop_index(name, table_name="predictions")
    op.drop_table("predictions")
