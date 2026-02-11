"""
Pydantic schemas for Medication Reconciliation.

Covers creation, updates, completion workflow, and response serialization.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ─── Sub-models ──────────────────────────────────────────


class HomeMedication(BaseModel):
    """A medication the patient reports taking at home."""
    name: str = Field(..., min_length=1, max_length=300)
    dose: str | None = Field(None, max_length=100)
    frequency: str | None = Field(None, max_length=100)
    route: str | None = Field(None, max_length=50)
    source: str = Field(
        default="patient",
        description="Who provided this info: patient, pharmacy, provider",
    )
    last_taken: str | None = Field(
        None, description="When the patient last took this medication"
    )


class MedicationDecision(BaseModel):
    """Decision to continue or discontinue an active prescription."""
    prescription_id: uuid.UUID
    action: str = Field(..., pattern="^(continue|discontinue)$")
    reason: str | None = None


class NewMedicationEntry(BaseModel):
    """A new medication to add during reconciliation."""
    medication_name: str = Field(..., min_length=1, max_length=300)
    dosage: str = Field(..., min_length=1, max_length=100)
    frequency: str = Field(..., min_length=1, max_length=100)
    route: str = Field(default="oral", max_length=50)
    reason: str | None = None


# ─── Request schemas ─────────────────────────────────────


class MedRecCreate(BaseModel):
    """Start a new medication reconciliation for an encounter."""
    encounter_id: uuid.UUID
    patient_id: uuid.UUID
    reconciliation_type: str = Field(
        ..., pattern="^(admission|transfer|discharge)$"
    )
    home_medications: list[HomeMedication] = Field(default_factory=list)


class MedRecUpdateHomeMeds(BaseModel):
    """Update the home medications list."""
    home_medications: list[HomeMedication]


class MedRecComplete(BaseModel):
    """Complete the reconciliation with decisions and optional new meds."""
    decisions: list[MedicationDecision] = Field(default_factory=list)
    new_medications: list[NewMedicationEntry] = Field(default_factory=list)
    notes: str | None = None


# ─── Response schema ─────────────────────────────────────


class MedRecResponse(BaseModel):
    """Full medication reconciliation record."""
    id: uuid.UUID
    encounter_id: uuid.UUID
    patient_id: uuid.UUID
    reconciliation_type: str
    status: str
    home_medications: list[dict] | None = None
    continue_medications: list[dict] | None = None
    discontinue_medications: list[dict] | None = None
    new_medications: list[dict] | None = None
    changes: list[dict] | None = None
    reconciled_by: uuid.UUID | None = None
    reconciled_at: datetime | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID | None = None

    model_config = {"from_attributes": True}
