"""
Medication Reconciliation models.

Tracks home medications, prescription review decisions (continue/discontinue),
new medications, and full audit trail per encounter. Joint Commission compliant.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.shared.base_models import BaseEntity


class MedicationReconciliation(Base, BaseEntity):
    """
    Medication reconciliation record — one per encounter.

    Captures the full reconciliation workflow:
    1. Home medications reported by the patient
    2. Active prescriptions reviewed (continue/discontinue)
    3. New medications added
    4. Changes audit trail with timestamps and user IDs
    """

    __tablename__ = "medication_reconciliations"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    reconciliation_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # admission, transfer, discharge

    status: Mapped[str] = mapped_column(
        String(20), default="in_progress", nullable=False
    )  # not_started, in_progress, completed

    # Home medications reported by patient/caregiver
    home_medications: Mapped[list | None] = mapped_column(
        JSONB, nullable=True, default=list
    )  # [{name, dose, frequency, route, source, last_taken}]

    # Active prescriptions marked as "continue"
    continue_medications: Mapped[list | None] = mapped_column(
        JSONB, nullable=True, default=list
    )  # [{prescription_id, medication_name, dosage, frequency, reason}]

    # Active prescriptions marked as "discontinue"
    discontinue_medications: Mapped[list | None] = mapped_column(
        JSONB, nullable=True, default=list
    )  # [{prescription_id, medication_name, reason}]

    # New medications to be prescribed
    new_medications: Mapped[list | None] = mapped_column(
        JSONB, nullable=True, default=list
    )  # [{medication_name, dosage, frequency, route, reason}]

    # Full audit trail of all decisions
    changes: Mapped[list | None] = mapped_column(
        JSONB, nullable=True, default=list
    )  # [{action, medication, timestamp, user}]

    reconciled_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    reconciled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_med_rec_patient_type", "patient_id", "reconciliation_type"),
    )
