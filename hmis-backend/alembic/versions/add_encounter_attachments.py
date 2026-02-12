"""Add encounter_attachments table for clinical file uploads

Revision ID: add_encounter_attachments
Revises: add_reports_tables
Create Date: 2026-02-11 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_encounter_attachments'
down_revision = 'add_reports_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'encounter_attachments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('encounter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('file_key', sa.String(length=500), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.String(length=100), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=30), server_default='general', nullable=False),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), nullable=False),
        # BaseEntity fields
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_encounter_attachments_encounter',
        'encounter_attachments',
        ['encounter_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_encounter_attachments_encounter', table_name='encounter_attachments')
    op.drop_table('encounter_attachments')
