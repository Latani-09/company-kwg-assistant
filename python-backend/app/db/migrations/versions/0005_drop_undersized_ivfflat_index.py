"""drop undersized ivfflat index on qa_entries.embedding

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-06

"""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # lists=100 was sized for a dataset far larger than what exists in
    # practice. IVFFlat only probes 1 of `lists` clusters per query by
    # default, so with a small table almost every row lands alone in its
    # own cluster and true nearest neighbors in other clusters are silently
    # skipped rather than being found. An exact scan is both correct and
    # fast at this table's scale, so drop the index rather than trying to
    # keep `lists` tuned to row count.
    op.execute("DROP INDEX IF EXISTS qa_entries_embedding_idx")


def downgrade() -> None:
    op.execute(
        "CREATE INDEX qa_entries_embedding_idx ON qa_entries "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
