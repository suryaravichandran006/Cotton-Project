"""Persist immutable cotton quality result snapshots independently of cultivar results."""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    # Development startup can already have created this ORM table before a managed upgrade.
    if inspector.has_table("quality_analyses"):
        columns = {column["name"] for column in inspector.get_columns("quality_analyses")}
        if columns != {"id", "created_at", "image_key", "snapshot"}:
            raise RuntimeError("Existing quality_analyses table does not match the quality schema")
        if not any(index["name"] == "ix_quality_analyses_created_at" for index in inspector.get_indexes("quality_analyses")):
            op.create_index("ix_quality_analyses_created_at", "quality_analyses", ["created_at"])
        return
    op.create_table("quality_analyses", sa.Column("id", sa.String(32), primary_key=True),
                    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
                    sa.Column("image_key", sa.String(255), nullable=False), sa.Column("snapshot", sa.JSON(), nullable=False))
    op.create_index("ix_quality_analyses_created_at", "quality_analyses", ["created_at"])


def downgrade():
    op.drop_index("ix_quality_analyses_created_at", table_name="quality_analyses")
    op.drop_table("quality_analyses")
