"""allow deleting qa_entries referenced by past chat_queries

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-06

"""
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # chat_queries.matched_entry_id had no ON DELETE action, so Postgres
    # defaulted to NO ACTION and blocked deleting any qa_entries row ever
    # cited by a chat query. chat_queries is a log, not a hard reference —
    # deleting the entry should just null out the pointer, not fail.
    op.drop_constraint("chat_queries_matched_entry_id_fkey", "chat_queries", type_="foreignkey")
    op.create_foreign_key(
        "chat_queries_matched_entry_id_fkey",
        "chat_queries",
        "qa_entries",
        ["matched_entry_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("chat_queries_matched_entry_id_fkey", "chat_queries", type_="foreignkey")
    op.create_foreign_key(
        "chat_queries_matched_entry_id_fkey",
        "chat_queries",
        "qa_entries",
        ["matched_entry_id"],
        ["id"],
    )
