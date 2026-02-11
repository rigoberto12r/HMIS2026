"""
Medication Reconciliation Service.

Orchestrates the reconciliation workflow: start, update home meds,
complete with decisions (continue/discontinue), CDS checks on new meds,
and full audit trail generation.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.pharmacy.med_rec_models import MedicationReconciliation
from app.modules.pharmacy.med_rec_schemas import (
    MedRecComplete,
    MedRecCreate,
    HomeMedication,
)
from app.modules.pharmacy.models import Prescription
from app.modules.pharmacy.repository import PrescriptionRepository
from app.shared import events as event_bus
from app.shared.events import (
    DomainEvent,
    MED_REC_STARTED,
    MED_REC_COMPLETED,
)
from app.shared.exceptions import ConflictError, NotFoundError, ValidationError


class MedicationReconciliationService:
    """Handles the full medication reconciliation lifecycle."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.rx_repo = PrescriptionRepository(Prescription, db)

    async def start_reconciliation(
        self,
        data: MedRecCreate,
        started_by: uuid.UUID,
    ) -> MedicationReconciliation:
        """
        Start a new medication reconciliation for an encounter.

        1. Checks no existing med rec for encounter
        2. Gets active prescriptions and pre-populates continue list
        3. Creates record and publishes MED_REC_STARTED event
        """
        # Check for existing reconciliation on this encounter
        existing = await self._get_by_encounter(data.encounter_id)
        if existing:
            raise ConflictError(
                "Ya existe una reconciliacion para este encuentro",
                details={"encounter_id": str(data.encounter_id), "existing_id": str(existing.id)},
            )

        # Get active prescriptions to pre-populate continue list
        active_rx = await self.rx_repo.find_active_by_patient(data.patient_id)
        continue_meds = [
            {
                "prescription_id": str(rx.id),
                "medication_name": rx.medication_name,
                "dosage": rx.dosage,
                "frequency": rx.frequency,
                "reason": None,
            }
            for rx in active_rx
        ]

        home_meds = [med.model_dump() for med in data.home_medications]

        med_rec = MedicationReconciliation(
            encounter_id=data.encounter_id,
            patient_id=data.patient_id,
            reconciliation_type=data.reconciliation_type,
            status="in_progress",
            home_medications=home_meds,
            continue_medications=continue_meds,
            discontinue_medications=[],
            new_medications=[],
            changes=[],
            created_by=started_by,
            updated_by=started_by,
        )
        self.db.add(med_rec)
        await self.db.flush()
        await self.db.refresh(med_rec)

        # Publish domain event
        await event_bus.publish(
            DomainEvent(
                event_type=MED_REC_STARTED,
                aggregate_type="medication_reconciliation",
                aggregate_id=str(med_rec.id),
                data={
                    "encounter_id": str(data.encounter_id),
                    "patient_id": str(data.patient_id),
                    "reconciliation_type": data.reconciliation_type,
                    "active_prescriptions": len(active_rx),
                    "home_medications": len(home_meds),
                },
                user_id=str(started_by),
            )
        )

        return med_rec

    async def get_reconciliation(self, med_rec_id: uuid.UUID) -> MedicationReconciliation:
        """Get reconciliation by ID. Raises NotFoundError if not found."""
        stmt = (
            select(MedicationReconciliation)
            .where(MedicationReconciliation.id == med_rec_id)
            .where(MedicationReconciliation.is_active == True)  # noqa: E712
        )
        result = await self.db.execute(stmt)
        med_rec = result.scalar_one_or_none()
        if not med_rec:
            raise NotFoundError("MedicationReconciliation", str(med_rec_id))
        return med_rec

    async def get_by_encounter(self, encounter_id: uuid.UUID) -> MedicationReconciliation | None:
        """Get reconciliation for an encounter. Returns None if not found."""
        return await self._get_by_encounter(encounter_id)

    async def update_home_medications(
        self,
        med_rec_id: uuid.UUID,
        home_meds: list[HomeMedication],
    ) -> MedicationReconciliation:
        """Update home medications. Only allowed while status is in_progress."""
        med_rec = await self.get_reconciliation(med_rec_id)

        if med_rec.status != "in_progress":
            raise ValidationError(
                "Solo se pueden actualizar medicamentos del hogar en reconciliaciones en progreso"
            )

        med_rec.home_medications = [med.model_dump() for med in home_meds]
        await self.db.flush()
        await self.db.refresh(med_rec)
        return med_rec

    async def complete_reconciliation(
        self,
        med_rec_id: uuid.UUID,
        data: MedRecComplete,
        reconciled_by: uuid.UUID,
    ) -> MedicationReconciliation:
        """
        Complete the reconciliation workflow.

        1. Validates status is in_progress
        2. Processes continue/discontinue decisions on active prescriptions
        3. Runs CDS checks on new medications (non-blocking)
        4. Builds audit trail
        5. Publishes MED_REC_COMPLETED event
        """
        med_rec = await self.get_reconciliation(med_rec_id)

        if med_rec.status != "in_progress":
            raise ValidationError("Esta reconciliacion ya fue completada")

        now = datetime.now(timezone.utc)
        changes: list[dict] = list(med_rec.changes or [])
        continue_meds: list[dict] = []
        discontinue_meds: list[dict] = []

        # Process decisions on existing prescriptions
        for decision in data.decisions:
            rx = await self._get_prescription(decision.prescription_id)
            if not rx:
                continue

            if decision.action == "continue":
                continue_meds.append({
                    "prescription_id": str(rx.id),
                    "medication_name": rx.medication_name,
                    "dosage": rx.dosage,
                    "frequency": rx.frequency,
                    "reason": decision.reason,
                })
                changes.append({
                    "action": "continue",
                    "medication": rx.medication_name,
                    "prescription_id": str(rx.id),
                    "timestamp": now.isoformat(),
                    "user": str(reconciled_by),
                })
            elif decision.action == "discontinue":
                # Mark the prescription as discontinued
                rx.status = "discontinued"
                await self.db.flush()

                discontinue_meds.append({
                    "prescription_id": str(rx.id),
                    "medication_name": rx.medication_name,
                    "reason": decision.reason,
                })
                changes.append({
                    "action": "discontinue",
                    "medication": rx.medication_name,
                    "prescription_id": str(rx.id),
                    "reason": decision.reason,
                    "timestamp": now.isoformat(),
                    "user": str(reconciled_by),
                })

        # Run CDS checks on new medications (non-blocking — store alerts but don't fail)
        new_meds_data: list[dict] = []
        for new_med in data.new_medications:
            med_entry = new_med.model_dump()
            try:
                from app.modules.cds.service import CDSService
                cds = CDSService(self.db)
                cds_result = await cds.check_medication(
                    patient_id=med_rec.patient_id,
                    medication_name=new_med.medication_name,
                )
                if cds_result.alerts:
                    med_entry["cds_alerts"] = [
                        {"type": a.alert_type, "severity": a.severity, "summary": a.summary}
                        for a in cds_result.alerts
                    ]
            except Exception:
                # CDS check failure should not block reconciliation
                pass

            new_meds_data.append(med_entry)
            changes.append({
                "action": "new_medication",
                "medication": new_med.medication_name,
                "dosage": new_med.dosage,
                "frequency": new_med.frequency,
                "timestamp": now.isoformat(),
                "user": str(reconciled_by),
            })

        # Update the reconciliation record
        med_rec.continue_medications = continue_meds
        med_rec.discontinue_medications = discontinue_meds
        med_rec.new_medications = new_meds_data
        med_rec.changes = changes
        med_rec.status = "completed"
        med_rec.reconciled_by = reconciled_by
        med_rec.reconciled_at = now
        med_rec.notes = data.notes
        med_rec.updated_by = reconciled_by

        await self.db.flush()
        await self.db.refresh(med_rec)

        # Publish domain event
        await event_bus.publish(
            DomainEvent(
                event_type=MED_REC_COMPLETED,
                aggregate_type="medication_reconciliation",
                aggregate_id=str(med_rec.id),
                data={
                    "encounter_id": str(med_rec.encounter_id),
                    "patient_id": str(med_rec.patient_id),
                    "continued": len(continue_meds),
                    "discontinued": len(discontinue_meds),
                    "new_medications": len(new_meds_data),
                },
                user_id=str(reconciled_by),
            )
        )

        return med_rec

    async def list_by_patient(
        self,
        patient_id: uuid.UUID,
        limit: int = 50,
    ) -> list[MedicationReconciliation]:
        """Get reconciliation history for a patient, newest first."""
        stmt = (
            select(MedicationReconciliation)
            .where(MedicationReconciliation.patient_id == patient_id)
            .where(MedicationReconciliation.is_active == True)  # noqa: E712
            .order_by(MedicationReconciliation.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ─── Internal helpers ────────────────────────────────

    async def _get_by_encounter(
        self, encounter_id: uuid.UUID
    ) -> MedicationReconciliation | None:
        """Get reconciliation by encounter ID."""
        stmt = (
            select(MedicationReconciliation)
            .where(MedicationReconciliation.encounter_id == encounter_id)
            .where(MedicationReconciliation.is_active == True)  # noqa: E712
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_prescription(self, rx_id: uuid.UUID) -> Prescription | None:
        """Get a prescription by ID."""
        stmt = select(Prescription).where(Prescription.id == rx_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
