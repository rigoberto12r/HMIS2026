"""
Clinical Decision Support models.

DrugInteraction: local knowledge base of drug-drug interactions.
CDSAlertOverride: audit trail for overridden clinical alerts.
"""

import uuid

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.shared.base_models import BaseEntity


class DrugInteraction(Base, BaseEntity):
    """
    Drug-drug interaction from local knowledge base.
    Each row represents a known interaction between two drugs.
    Lookups are bidirectional: (A,B) and (B,A) are checked.
    """

    __tablename__ = "drug_interactions"

    drug_a_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    drug_a_atc_code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    drug_b_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    drug_b_atc_code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    severity: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # critical, major, moderate, minor

    interaction_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # pharmacokinetic, pharmacodynamic, additive, antagonistic

    description: Mapped[str] = mapped_column(Text, nullable=False)
    clinical_significance: Mapped[str] = mapped_column(Text, nullable=False)
    management: Mapped[str | None] = mapped_column(Text, nullable=True)

    evidence_level: Mapped[str] = mapped_column(
        String(20), default="established"
    )  # established, probable, suspected, possible

    source: Mapped[str] = mapped_column(String(100), default="local_kb")

    __table_args__ = (
        Index("ix_drug_interactions_pair", "drug_a_name", "drug_b_name"),
    )


class CDSAlertOverride(Base, BaseEntity):
    """
    Audit trail for CDS alert overrides.
    Records when a clinician overrides a safety alert, with the reason.
    Required for healthcare regulatory compliance.
    """

    __tablename__ = "cds_alert_overrides"

    prescription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prescriptions.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    overridden_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )

    alert_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # drug_interaction, allergy, duplicate_therapy

    alert_severity: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # critical, major, moderate, minor

    alert_summary: Mapped[str] = mapped_column(Text, nullable=False)
    override_reason: Mapped[str] = mapped_column(Text, nullable=False)

    alert_details_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
