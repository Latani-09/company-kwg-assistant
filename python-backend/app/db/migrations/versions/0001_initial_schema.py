"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-08-15

"""
import uuid

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql as pg

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

EMBEDDING_DIM = 768

FIXED_SECTORS = [
    {"key": "onboarding", "label": "Onboarding"},
    {"key": "company", "label": "Company"},
    {"key": "product", "label": "Product"},
    {"key": "project", "label": "Project"},
]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    user_role = pg.ENUM("user", "superAdmin", name="user_role", create_type=False)
    user_status = pg.ENUM("pending", "granted", "revoked", name="user_status", create_type=False)
    gap_status = pg.ENUM("open", "assigned", "resolved", name="gap_status", create_type=False)
    user_role.create(op.get_bind())
    user_status.create(op.get_bind())
    gap_status.create(op.get_bind())

    op.create_table(
        "users",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("username", sa.String(), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("position", sa.String(), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="user"),
        sa.Column("status", user_status, nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "sectors",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(), nullable=False, unique=True),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("is_custom", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "user_sectors",
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "sector_id", pg.UUID(as_uuid=True), sa.ForeignKey("sectors.id", ondelete="CASCADE"), primary_key=True
        ),
    )

    op.create_table(
        "qa_entries",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("sector_id", pg.UUID(as_uuid=True), sa.ForeignKey("sectors.id"), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=False),
        sa.Column("created_by", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.execute(
        "CREATE INDEX qa_entries_embedding_idx ON qa_entries "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )

    op.create_table(
        "chat_queries",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("asker_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("matched_entry_id", pg.UUID(as_uuid=True), sa.ForeignKey("qa_entries.id"), nullable=True),
        sa.Column("similarity_score", sa.Float(), nullable=True),
        sa.Column("is_gap", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "knowledge_gaps",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_query_id", pg.UUID(as_uuid=True), sa.ForeignKey("chat_queries.id"), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("asker_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", gap_status, nullable=False, server_default="open"),
        sa.Column("assigned_to_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("assigned_sector_id", pg.UUID(as_uuid=True), sa.ForeignKey("sectors.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )

    sectors_table = sa.table(
        "sectors",
        sa.column("id", pg.UUID(as_uuid=True)),
        sa.column("key", sa.String()),
        sa.column("label", sa.String()),
        sa.column("is_custom", sa.Boolean()),
    )
    op.bulk_insert(
        sectors_table,
        [{"id": uuid.uuid4(), "key": s["key"], "label": s["label"], "is_custom": False} for s in FIXED_SECTORS],
    )


def downgrade() -> None:
    op.drop_table("knowledge_gaps")
    op.drop_table("chat_queries")
    op.execute("DROP INDEX IF EXISTS qa_entries_embedding_idx")
    op.drop_table("qa_entries")
    op.drop_table("user_sectors")
    op.drop_table("sectors")
    op.drop_table("users")

    pg.ENUM(name="gap_status").drop(op.get_bind())
    pg.ENUM(name="user_status").drop(op.get_bind())
    pg.ENUM(name="user_role").drop(op.get_bind())

    op.execute("DROP EXTENSION IF EXISTS vector")
