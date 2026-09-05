"""record the user who resolved a knowledge gap

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "knowledge_gaps",
        sa.Column("resolved_by_id", pg.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_knowledge_gaps_resolved_by_id_users",
        "knowledge_gaps",
        "users",
        ["resolved_by_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_knowledge_gaps_resolved_by_id_users",
        "knowledge_gaps",
        type_="foreignkey",
    )
    op.drop_column("knowledge_gaps", "resolved_by_id")