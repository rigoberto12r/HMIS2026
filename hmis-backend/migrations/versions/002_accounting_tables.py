"""Add accounting and credit note tables.

Revision ID: 002_accounting
Revises: 001_initial
Create Date: 2026-02-06

Agrega tablas de contabilidad general (GL):
- accounts: Plan de cuentas contable
- journal_entries: Asientos contables (libro diario)
- journal_entry_lines: Lineas de asientos (partida doble)
- credit_notes: Notas de credito
- credit_note_lines: Detalle de notas de credito
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002_accounting"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Plan de Cuentas ────────────────────────────────────

    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(20), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("account_type", sa.String(50), nullable=False),
        sa.Column("parent_code", sa.String(20), nullable=True, index=True),
        sa.Column("is_detail", sa.Boolean, server_default="true"),
        sa.Column("normal_balance", sa.String(10), server_default="'debit'"),
        sa.Column("currency", sa.String(3), server_default="'DOP'"),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_accounts_category", "accounts", ["category"])

    # ── Asientos Contables (Libro Diario) ──────────────────

    op.create_table(
        "journal_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entry_number", sa.String(30), unique=True, nullable=False, index=True),
        sa.Column("entry_date", sa.Date, nullable=False, index=True),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("reference_type", sa.String(30), nullable=True),
        sa.Column("reference_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("total_debit", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_credit", sa.Numeric(14, 2), nullable=False),
        sa.Column("status", sa.String(20), server_default="'posted'"),
        sa.Column("reversed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reversal_of", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("posted_by", postgresql.UUID(as_uuid=True), nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_journal_entries_ref", "journal_entries", ["reference_type", "reference_id"])

    # ── Lineas de Asientos ─────────────────────────────────

    op.create_table(
        "journal_entry_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("journal_entry_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("journal_entries.id"), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("description", sa.String(300), nullable=True),
        sa.Column("debit", sa.Numeric(14, 2), server_default="0.0"),
        sa.Column("credit", sa.Numeric(14, 2), server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_jel_journal", "journal_entry_lines", ["journal_entry_id"])
    op.create_index("ix_jel_account", "journal_entry_lines", ["account_id"])

    # ── Notas de Credito ───────────────────────────────────

    op.create_table(
        "credit_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("credit_note_number", sa.String(50), unique=True, nullable=False),
        sa.Column("fiscal_number", sa.String(50), nullable=True, index=True),
        sa.Column("original_invoice_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("invoices.id"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("subtotal", sa.Numeric(14, 2), nullable=False),
        sa.Column("tax_total", sa.Numeric(14, 2), server_default="0.0"),
        sa.Column("grand_total", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="'DOP'"),
        sa.Column("status", sa.String(20), server_default="'issued'"),
        sa.Column("country_code", sa.String(2), server_default="'DO'"),
        sa.Column("fiscal_response", postgresql.JSONB, nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "credit_note_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("credit_note_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("credit_notes.id"), nullable=False),
        sa.Column("original_invoice_line_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.String(300), nullable=False),
        sa.Column("quantity", sa.Integer, server_default="1"),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("tax", sa.Numeric(12, 2), server_default="0.0"),
        sa.Column("line_total", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("credit_note_lines")
    op.drop_table("credit_notes")
    op.drop_index("ix_jel_account", "journal_entry_lines")
    op.drop_index("ix_jel_journal", "journal_entry_lines")
    op.drop_table("journal_entry_lines")
    op.drop_index("ix_journal_entries_ref", "journal_entries")
    op.drop_table("journal_entries")
    op.drop_index("ix_accounts_category", "accounts")
    op.drop_table("accounts")
