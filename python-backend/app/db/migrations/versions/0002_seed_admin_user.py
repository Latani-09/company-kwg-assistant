"""seed initial super admin user

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-15

"""
import secrets
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

from app.core.security import hash_password

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@kwg-assistant.com"


def upgrade() -> None:
    password = secrets.token_urlsafe(16)

    users_table = sa.table(
        "users",
        sa.column("id", pg.UUID(as_uuid=True)),
        sa.column("name", sa.String()),
        sa.column("email", sa.String()),
        sa.column("username", sa.String()),
        sa.column("password_hash", sa.String()),
        sa.column("position", sa.String()),
        sa.column("role", pg.ENUM("user", "superAdmin", name="user_role", create_type=False)),
        sa.column("status", pg.ENUM("pending", "granted", "revoked", name="user_status", create_type=False)),
    )
    op.bulk_insert(
        users_table,
        [
            {
                "id": uuid.uuid4(),
                "name": "Admin",
                "email": ADMIN_EMAIL,
                "username": ADMIN_USERNAME,
                "password_hash": hash_password(password),
                "position": "Administrator",
                "role": "superAdmin",
                "status": "granted",
            }
        ],
    )

    print("=" * 60)
    print(f"Seeded super admin user — username: {ADMIN_USERNAME}")
    print(f"Generated password: {password}")
    print("Log in and change this password as soon as possible.")
    print("=" * 60)


def downgrade() -> None:
    op.execute(f"DELETE FROM users WHERE username = '{ADMIN_USERNAME}'")
