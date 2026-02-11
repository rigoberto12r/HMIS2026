"""
Unit tests for Clinical Decision Support service.
"""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cds.models import DrugInteraction
from app.modules.cds.repository import CDSRepository
from app.modules.cds.service import CDSService


# ============================================================
# Helpers
# ============================================================


async def _create_interaction(
    db: AsyncSession,
    drug_a: str,
    drug_b: str,
    severity: str = "major",
    interaction_type: str = "pharmacodynamic",
) -> DrugInteraction:
    """Helper to create a drug interaction in the test DB."""
    interaction = DrugInteraction(
        drug_a_name=drug_a,
        drug_b_name=drug_b,
        severity=severity,
        interaction_type=interaction_type,
        description=f"Test interaction between {drug_a} and {drug_b}",
        clinical_significance=f"Clinically significant for testing",
        management=f"Monitor closely when combining {drug_a} and {drug_b}",
        evidence_level="established",
        source="local_kb",
    )
    db.add(interaction)
    await db.flush()
    return interaction


async def _create_prescription(
    db: AsyncSession,
    patient_id: uuid.UUID,
    medication_name: str,
    prescribed_by: uuid.UUID,
) -> None:
    """Helper to create an active prescription in the test DB."""
    from app.modules.pharmacy.models import Prescription

    rx = Prescription(
        encounter_id=uuid.uuid4(),
        patient_id=patient_id,
        prescribed_by=prescribed_by,
        product_id=uuid.uuid4(),
        medication_name=medication_name,
        dosage="500mg",
        frequency="cada 8 horas",
        route="oral",
        quantity_prescribed=30,
        status="active",
        created_by=prescribed_by,
    )
    db.add(rx)
    await db.flush()
    return rx


# ============================================================
# CDSRepository tests
# ============================================================


class TestCDSRepository:
    @pytest.mark.asyncio
    async def test_find_interaction_between_both_orderings(self, db_session):
        """Should find interaction queried as (A,B) or (B,A)."""
        await _create_interaction(db_session, "Warfarina", "Aspirina")
        await db_session.commit()

        repo = CDSRepository(DrugInteraction, db_session)

        # Forward order
        results = await repo.find_interaction_between("Warfarina", "Aspirina")
        assert len(results) >= 1

        # Reverse order
        results = await repo.find_interaction_between("Aspirina", "Warfarina")
        assert len(results) >= 1

    @pytest.mark.asyncio
    async def test_find_interaction_case_insensitive(self, db_session):
        """Should match regardless of case."""
        await _create_interaction(db_session, "Warfarina", "Aspirina")
        await db_session.commit()

        repo = CDSRepository(DrugInteraction, db_session)

        results = await repo.find_interaction_between("warfarina", "aspirina")
        assert len(results) >= 1

        results = await repo.find_interaction_between("WARFARINA", "ASPIRINA")
        assert len(results) >= 1

    @pytest.mark.asyncio
    async def test_find_interactions_for_drug_ordered_by_severity(self, db_session):
        """Results should be ordered critical > major > moderate > minor."""
        await _create_interaction(db_session, "DrugX", "DrugA", severity="moderate")
        await _create_interaction(db_session, "DrugX", "DrugB", severity="critical")
        await _create_interaction(db_session, "DrugX", "DrugC", severity="minor")
        await db_session.commit()

        repo = CDSRepository(DrugInteraction, db_session)
        results = await repo.find_interactions_for_drug("DrugX")

        assert len(results) == 3
        assert results[0].severity == "critical"
        assert results[1].severity == "moderate"
        assert results[2].severity == "minor"

    @pytest.mark.asyncio
    async def test_no_results_for_unknown_drug(self, db_session):
        """Should return empty list for drugs not in knowledge base."""
        repo = CDSRepository(DrugInteraction, db_session)
        results = await repo.find_interaction_between("UnknownDrug", "AnotherUnknown")
        assert results == []


# ============================================================
# CDSService tests
# ============================================================


class TestCDSServiceInteractionCheck:
    @pytest.mark.asyncio
    async def test_no_alerts_when_no_active_prescriptions(self, db_session):
        """Patient with no active Rx should get zero interaction alerts."""
        service = CDSService(db_session)
        patient_id = uuid.uuid4()

        result = await service.check_medication(
            patient_id=patient_id,
            medication_name="Ibuprofeno",
        )

        assert result.total_alerts == 0
        assert result.alerts == []
        assert result.has_critical is False
        assert result.has_major is False

    @pytest.mark.asyncio
    async def test_detects_major_interaction(self, db_session):
        """Should detect major drug-drug interaction."""
        patient_id = uuid.uuid4()
        prescriber_id = uuid.uuid4()

        # Create an active prescription for Warfarina
        await _create_prescription(db_session, patient_id, "Warfarina", prescriber_id)
        # Create the interaction record
        await _create_interaction(db_session, "Warfarina", "Aspirina", severity="major")
        await db_session.commit()

        service = CDSService(db_session)
        result = await service.check_medication(
            patient_id=patient_id,
            medication_name="Aspirina",
        )

        assert result.total_alerts >= 1
        assert result.has_major is True
        interaction_alerts = [a for a in result.alerts if a.alert_type == "drug_interaction"]
        assert len(interaction_alerts) >= 1
        assert interaction_alerts[0].severity == "major"
        assert interaction_alerts[0].interacting_drug == "Warfarina"

    @pytest.mark.asyncio
    async def test_detects_critical_interaction(self, db_session):
        """Should detect critical drug-drug interaction."""
        patient_id = uuid.uuid4()
        prescriber_id = uuid.uuid4()

        await _create_prescription(db_session, patient_id, "Fluoxetina", prescriber_id)
        await _create_interaction(db_session, "Fluoxetina", "Fenelzina", severity="critical")
        await db_session.commit()

        service = CDSService(db_session)
        result = await service.check_medication(
            patient_id=patient_id,
            medication_name="Fenelzina",
        )

        assert result.has_critical is True
        critical_alerts = [a for a in result.alerts if a.severity == "critical"]
        assert len(critical_alerts) >= 1

    @pytest.mark.asyncio
    async def test_detects_duplicate_therapy(self, db_session):
        """Prescribing same drug twice should flag duplicate."""
        patient_id = uuid.uuid4()
        prescriber_id = uuid.uuid4()

        await _create_prescription(db_session, patient_id, "Metformina", prescriber_id)
        await db_session.commit()

        service = CDSService(db_session)
        result = await service.check_medication(
            patient_id=patient_id,
            medication_name="Metformina",
        )

        dup_alerts = [a for a in result.alerts if a.alert_type == "duplicate_therapy"]
        assert len(dup_alerts) == 1
        assert dup_alerts[0].severity == "moderate"

    @pytest.mark.asyncio
    async def test_has_critical_and_major_flags(self, db_session):
        """Flags should correctly reflect alert severities."""
        patient_id = uuid.uuid4()
        prescriber_id = uuid.uuid4()

        await _create_prescription(db_session, patient_id, "DrugA", prescriber_id)
        await _create_interaction(db_session, "DrugA", "DrugNew", severity="moderate")
        await db_session.commit()

        service = CDSService(db_session)
        result = await service.check_medication(
            patient_id=patient_id,
            medication_name="DrugNew",
        )

        assert result.has_critical is False
        assert result.has_major is False
        assert result.total_alerts >= 1


class TestCDSServiceOverride:
    @pytest.mark.asyncio
    async def test_record_override_creates_audit_entry(self, db_session):
        """Override should persist to cds_alert_overrides table."""
        from app.modules.cds.schemas import CDSAlertOverrideCreate

        service = CDSService(db_session)
        user_id = uuid.uuid4()
        prescription_id = uuid.uuid4()
        patient_id = uuid.uuid4()

        data = CDSAlertOverrideCreate(
            prescription_id=prescription_id,
            patient_id=patient_id,
            alert_type="drug_interaction",
            alert_severity="major",
            alert_summary="Test interaction override",
            override_reason="Clinical necessity - patient has been stable on this combination",
        )

        override = await service.record_override(data, overridden_by=user_id)

        assert override.id is not None
        assert override.prescription_id == prescription_id
        assert override.patient_id == patient_id
        assert override.overridden_by == user_id
        assert override.alert_type == "drug_interaction"
        assert override.alert_severity == "major"

    @pytest.mark.asyncio
    async def test_override_history_by_patient(self, db_session):
        """Should retrieve override history for a patient."""
        from app.modules.cds.schemas import CDSAlertOverrideCreate

        service = CDSService(db_session)
        user_id = uuid.uuid4()
        patient_id = uuid.uuid4()

        for i in range(3):
            data = CDSAlertOverrideCreate(
                prescription_id=uuid.uuid4(),
                patient_id=patient_id,
                alert_type="drug_interaction",
                alert_severity="major",
                alert_summary=f"Override {i}",
                override_reason=f"Clinical reason for override number {i}",
            )
            await service.record_override(data, overridden_by=user_id)

        await db_session.commit()

        overrides = await service.override_repo.find_by_patient(patient_id)
        assert len(overrides) == 3
