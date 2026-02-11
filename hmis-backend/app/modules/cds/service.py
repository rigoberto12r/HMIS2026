"""
Clinical Decision Support Service.

Orchestrates drug interaction checks, allergy cross-references,
duplicate therapy detection, and CDS alert override auditing.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cds.models import CDSAlertOverride, DrugInteraction
from app.modules.cds.repository import CDSAlertOverrideRepository, CDSRepository
from app.modules.cds.schemas import (
    CDSAlert,
    CDSAlertOverrideCreate,
    CDSCheckResponse,
)
from app.modules.pharmacy.models import Prescription
from app.modules.pharmacy.repository import PrescriptionRepository
from app.shared import events as event_bus
from app.shared.events import (
    CDS_ALERT_GENERATED,
    CDS_ALERT_OVERRIDDEN,
    DomainEvent,
)


# Allergy severity → CDS severity mapping
_ALLERGY_SEVERITY_MAP = {
    "life_threatening": "critical",
    "severe": "critical",
    "moderate": "major",
    "mild": "moderate",
}


class CDSService:
    """
    Clinical Decision Support Service.

    Provides medication safety checks:
    1. Drug-drug interaction checking (local knowledge base)
    2. Allergy cross-reference (enhanced)
    3. Duplicate therapy detection
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.interaction_repo = CDSRepository(DrugInteraction, db)
        self.override_repo = CDSAlertOverrideRepository(CDSAlertOverride, db)

    async def check_medication(
        self,
        patient_id: uuid.UUID,
        medication_name: str,
        product_id: uuid.UUID | None = None,
    ) -> CDSCheckResponse:
        """
        Run all CDS checks for a medication against patient context.

        Returns CDSCheckResponse with all detected alerts.
        """
        alerts: list[CDSAlert] = []
        now = datetime.now(timezone.utc)

        # 1. Get patient's active prescriptions
        rx_repo = PrescriptionRepository(Prescription, self.db)
        active_rx = await rx_repo.find_active_by_patient(patient_id)

        # 2. Drug-drug interaction checks
        for rx in active_rx:
            interactions = await self.interaction_repo.find_interaction_between(
                medication_name, rx.medication_name
            )
            for interaction in interactions:
                # Determine which drug is the "other" one
                other_drug = rx.medication_name
                alerts.append(
                    CDSAlert(
                        alert_type="drug_interaction",
                        severity=interaction.severity,
                        summary=(
                            f"Interaccion {interaction.severity}: "
                            f"{medication_name} + {other_drug}"
                        ),
                        detail=interaction.description,
                        source=interaction.source,
                        interacting_drug=other_drug,
                        management=interaction.management,
                    )
                )

        # 3. Allergy cross-reference
        from app.modules.emr.service import AllergyService

        allergy_service = AllergyService(self.db)
        drug_allergies = await allergy_service.check_drug_allergy(
            patient_id, medication_name
        )
        for allergy in drug_allergies:
            mapped_severity = _ALLERGY_SEVERITY_MAP.get(allergy.severity, "major")
            alerts.append(
                CDSAlert(
                    alert_type="allergy",
                    severity=mapped_severity,
                    summary=f"Alergia a {allergy.allergen} ({allergy.severity})",
                    detail=f"Reaccion: {allergy.reaction or 'No especificada'}",
                    source="allergy_record",
                    management="Considerar alternativa terapeutica",
                )
            )

        # 4. Duplicate therapy detection
        med_lower = medication_name.lower()
        for rx in active_rx:
            if rx.medication_name.lower() == med_lower:
                alerts.append(
                    CDSAlert(
                        alert_type="duplicate_therapy",
                        severity="moderate",
                        summary=f"Terapia duplicada: {medication_name} ya prescrito",
                        detail=(
                            f"Prescripcion activa: {rx.dosage} {rx.frequency} "
                            f"(ID: {rx.id})"
                        ),
                        source="local_kb",
                        management="Verificar si la prescripcion existente debe cancelarse",
                    )
                )

        has_critical = any(a.severity == "critical" for a in alerts)
        has_major = any(a.severity == "major" for a in alerts)

        # Publish domain event if alerts found
        if alerts:
            await event_bus.publish(
                DomainEvent(
                    event_type=CDS_ALERT_GENERATED,
                    aggregate_type="cds_check",
                    aggregate_id=str(patient_id),
                    data={
                        "medication": medication_name,
                        "alert_count": len(alerts),
                        "has_critical": has_critical,
                        "has_major": has_major,
                        "severities": [a.severity for a in alerts],
                    },
                )
            )

        return CDSCheckResponse(
            medication_name=medication_name,
            patient_id=patient_id,
            alerts=alerts,
            has_critical=has_critical,
            has_major=has_major,
            checked_at=now,
            total_alerts=len(alerts),
        )

    async def record_override(
        self,
        data: CDSAlertOverrideCreate,
        overridden_by: uuid.UUID,
    ) -> CDSAlertOverride:
        """Record a CDS alert override in the audit trail."""
        override = CDSAlertOverride(
            prescription_id=data.prescription_id,
            patient_id=data.patient_id,
            overridden_by=overridden_by,
            alert_type=data.alert_type,
            alert_severity=data.alert_severity,
            alert_summary=data.alert_summary,
            override_reason=data.override_reason,
            alert_details_json=data.alert_details_json,
            created_by=overridden_by,
        )
        created = await self.override_repo.create(override)

        await event_bus.publish(
            DomainEvent(
                event_type=CDS_ALERT_OVERRIDDEN,
                aggregate_type="cds_override",
                aggregate_id=str(created.id),
                data={
                    "prescription_id": str(data.prescription_id),
                    "patient_id": str(data.patient_id),
                    "alert_type": data.alert_type,
                    "alert_severity": data.alert_severity,
                    "override_reason": data.override_reason,
                },
                user_id=str(overridden_by),
            )
        )

        return created

    # --- Drug Interaction CRUD ---

    async def create_interaction(
        self, data: dict, created_by: uuid.UUID | None = None
    ) -> DrugInteraction:
        """Add a new drug interaction to the knowledge base."""
        interaction = DrugInteraction(**data, created_by=created_by)
        return await self.interaction_repo.create(interaction)

    async def list_interactions(
        self,
        query: str | None = None,
        severity: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[DrugInteraction], int]:
        """List drug interactions with optional filters."""
        from sqlalchemy import func, or_, select

        stmt = select(DrugInteraction).where(
            DrugInteraction.is_active == True  # noqa: E712
        )
        count_stmt = (
            select(func.count())
            .select_from(DrugInteraction)
            .where(DrugInteraction.is_active == True)  # noqa: E712
        )

        if query:
            q_filter = or_(
                func.lower(DrugInteraction.drug_a_name).contains(query.lower()),
                func.lower(DrugInteraction.drug_b_name).contains(query.lower()),
            )
            stmt = stmt.where(q_filter)
            count_stmt = count_stmt.where(q_filter)

        if severity:
            stmt = stmt.where(DrugInteraction.severity == severity)
            count_stmt = count_stmt.where(DrugInteraction.severity == severity)

        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        stmt = (
            stmt.order_by(DrugInteraction.drug_a_name)
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())

        return items, total

    async def delete_interaction(
        self, interaction_id: uuid.UUID
    ) -> DrugInteraction | None:
        """Soft-delete a drug interaction."""
        interaction = await self.interaction_repo.get(interaction_id)
        if not interaction:
            return None
        return await self.interaction_repo.soft_delete(interaction)
