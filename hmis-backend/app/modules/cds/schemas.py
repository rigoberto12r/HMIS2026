"""
Pydantic schemas for Clinical Decision Support.

Includes CDS check request/response, override audit, interaction CRUD,
and CDS Hooks standard schemas (HL7 CDS Hooks 2.0).
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ============================================================
# Drug Interaction CRUD
# ============================================================


class DrugInteractionCreate(BaseModel):
    drug_a_name: str = Field(max_length=200)
    drug_a_atc_code: str | None = None
    drug_b_name: str = Field(max_length=200)
    drug_b_atc_code: str | None = None
    severity: str = Field(description="critical, major, moderate, minor")
    interaction_type: str = Field(
        description="pharmacokinetic, pharmacodynamic, additive, antagonistic"
    )
    description: str
    clinical_significance: str
    management: str | None = None
    evidence_level: str = "established"
    source: str = "local_kb"


class DrugInteractionResponse(BaseModel):
    id: uuid.UUID
    drug_a_name: str
    drug_b_name: str
    drug_a_atc_code: str | None = None
    drug_b_atc_code: str | None = None
    severity: str
    interaction_type: str
    description: str
    clinical_significance: str
    management: str | None = None
    evidence_level: str
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# CDS Check Request / Response
# ============================================================


class CDSCheckRequest(BaseModel):
    """Request to check a medication for CDS alerts before prescribing."""

    patient_id: uuid.UUID
    medication_name: str
    product_id: uuid.UUID | None = None
    encounter_id: uuid.UUID | None = None


class CDSAlert(BaseModel):
    """A single CDS alert (interaction, allergy, or duplicate)."""

    alert_type: str  # drug_interaction, allergy, duplicate_therapy
    severity: str  # critical, major, moderate, minor
    summary: str
    detail: str
    source: str  # local_kb, allergy_record
    interacting_drug: str | None = None
    management: str | None = None


class CDSCheckResponse(BaseModel):
    """Response containing all CDS alerts for a medication check."""

    medication_name: str
    patient_id: uuid.UUID
    alerts: list[CDSAlert] = []
    has_critical: bool = False
    has_major: bool = False
    checked_at: datetime
    total_alerts: int = 0


# ============================================================
# CDS Alert Override (audit trail)
# ============================================================


class CDSAlertOverrideCreate(BaseModel):
    """Record an override of a CDS alert."""

    prescription_id: uuid.UUID
    patient_id: uuid.UUID
    alert_type: str
    alert_severity: str
    alert_summary: str
    override_reason: str = Field(min_length=10, max_length=500)
    alert_details_json: dict | None = None


class CDSAlertOverrideResponse(BaseModel):
    id: uuid.UUID
    prescription_id: uuid.UUID
    patient_id: uuid.UUID
    overridden_by: uuid.UUID
    alert_type: str
    alert_severity: str
    alert_summary: str
    override_reason: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# CDS Hooks Standard (HL7 CDS Hooks 2.0)
# ============================================================


class CDSCardSource(BaseModel):
    label: str
    url: str | None = None


class CDSCard(BaseModel):
    """CDS Hooks card in the response."""

    uuid: str | None = None
    summary: str
    detail: str | None = None
    indicator: str  # critical, warning, info
    source: CDSCardSource
    suggestions: list[dict] | None = None
    links: list[dict] | None = None


class CDSHooksService(BaseModel):
    """Describes an available CDS service."""

    hook: str  # order-select, order-sign, patient-view
    title: str
    description: str
    id: str
    prefetch: dict | None = None


class CDSHooksDiscoveryResponse(BaseModel):
    services: list[CDSHooksService]


class CDSHooksRequest(BaseModel):
    """CDS Hooks standard request body."""

    hookInstance: str
    hook: str
    fhirServer: str | None = None
    context: dict
    prefetch: dict | None = None


class CDSHooksResponse(BaseModel):
    cards: list[CDSCard] = []
