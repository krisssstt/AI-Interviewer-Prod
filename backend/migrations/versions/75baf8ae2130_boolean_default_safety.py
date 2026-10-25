"""Normalize SQLite boolean defaults from early local schema generation.

Revision ID: 75baf8ae2130
Revises: 601e54d12d35
"""
import sqlalchemy as sa
from alembic import op

revision = '75baf8ae2130'
down_revision = '601e54d12d35'
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name == 'sqlite':
        # A literal string 'false' is truthy to ORM conversion on SQLite; never
        # allow an old operator-created record to gain privileges from that value.
        op.execute("UPDATE users SET is_admin = 0 WHERE typeof(is_admin) = 'text' AND lower(is_admin) = 'false'")
        with op.batch_alter_table('users') as batch:
            batch.alter_column('is_admin', existing_type=sa.Boolean(), server_default=sa.false(), nullable=False)


def downgrade():
    pass  # Safety normalization is intentionally not reversed.
