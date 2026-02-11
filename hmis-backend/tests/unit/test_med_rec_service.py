"""
Unit tests for Medication Reconciliation Service.

Tests business logic: start, update home meds, complete, decisions, audit trail.
"""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.pharmacy.med_rec_models import MedicationReconciliation
from app.modules.pharmacy.med_rec_schemas import (
    HomeMedication,
    MedRecComplete,
    MedRecCreate,
    MedicationDecision,
    NewMedicationEntry,
)
from app.modules.pharmacy.med_rec_service import MedicationReconciliationService
from app.modules.pharmacy.models import Prescription, Product
from app.shared.exceptions import ConflictError, NotFoundError, ValidationError


# ─── Fixtures ─────────────────────────────────────────────


@pytest.fixture
async def product(db_session: AsyncSession):
    """Create a test product."""
    p = Product(
        name="Metformina 500mg",
        product_type="medication",
        unit_of_measure="tableta",
        requires_prescription=True,
    )
    db_session.add(p)
    await db_session.flush()
    await db_session.commit()
    return p


@pytest.fixture
async def prescription(db_session: AsyncSession, sample_patient, sample_encounter, medico_user, product):
    """Create a test active prescription."""
    rx = Prescription(
        encounter_id=sample_encounter.id,
        patient_id=sample_patient.id,
        prescribed_by=medico_user.id,
        product_id=product.id,
        medication_name="Metformina 500mg",
        dosage="500mg",
        frequency="cada 12 horas",
        route="oral",
        quantity_prescribed=60,
        status="active",
        created_by=medico_user.id,
        updated_by=medico_user.id,
    )
    db_session.add(rx)
    await db_session.flush()
    await db_session.commit()
    return rx


@pytest.fixture
def med_rec_create_data(sample_patient, sample_encounter):
    """Standard creation data."""
    return MedRecCreate(
        encounter_id=sample_encounter.id,
        patient_id=sample_patient.id,
        reconciliation_type="admission",
        home_medications=[
            HomeMedication(
                name="Aspirina 100mg",
                dose="100mg",
                frequency="diario",
                route="oral",
                source="patient",
            )
        ],
    )


# ─── Tests ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_start_reconciliation_populates_active_rx(
    db_session, med_rec_create_data, prescription, medico_user
):
    """Start should pre-populate continue_medications from active prescriptions."""
    service = MedicationReconciliationService(db_session)
    med_rec = await service.start_reconciliation(med_rec_create_data, started_by=medico_user.id)

    assert med_rec.status == "in_progress"
    assert med_rec.reconciliation_type == "admission"
    assert len(med_rec.continue_medications) == 1
    assert med_rec.continue_medications[0]["medication_name"] == "Metformina 500mg"
    assert len(med_rec.home_medications) == 1
    assert med_rec.home_medications[0]["name"] == "Aspirina 100mg"


@pytest.mark.asyncio
async def test_start_reconciliation_conflict_if_exists(
    db_session, med_rec_create_data, medico_user
):
    """Starting a second reconciliation for the same encounter should raise ConflictError."""
    service = MedicationReconciliationService(db_session)
    await service.start_reconciliation(med_rec_create_data, started_by=medico_user.id)

    with pytest.raises(ConflictError):
        await service.start_reconciliation(med_rec_create_data, started_by=medico_user.id)


@pytest.mark.asyncio
async def test_start_reconciliation_no_active_rx(
    db_session, med_rec_create_data, medico_user
):
    """Start with no active prescriptions should have empty continue list."""
    service = MedicationReconciliationService(db_session)
    med_rec = await service.start_reconciliation(med_rec_create_data, started_by=medico_user.id)

    assert med_rec.continue_medications == []


@pytest.mark.asyncio
async def test_get_reconciliation_not_found(db_session):
    """Getting a non-existent reconciliation should raise NotFoundError."""
    service = MedicationReconciliationService(db_session)
    with pytest.raises(NotFoundError):
        await service.get_reconciliation(uuid.uuid4())


@pytest.mark.asyncio
async def test_get_by_encounter(
    db_session, med_rec_create_data, medico_user
):
    """Should retrieve reconciliation by encounter ID."""
    service = MedicationReconciliationService(db_session)
    created = await service.start_reconciliation(med_rec_create_data, started_by=medico_user.id)

    found = await service.get_by_encounter(med_rec_create_data.encounter_id)
    assert found is not None
    assert found.id == created.id


@pytest.mark.asyncio
async def test_get_by_encounter_returns_none(db_session):
    """Should return None for encounter with no reconciliation."""
    service = MedicationReconciliationService(db_session)
    result = await service.get_by_encounter(uuid.uuid4())
    assert result is None


@pytest.mark.asyncio
async def test_update_home_medications(
    db_session, med_rec_create_data, medico_user
):
    """Should update home medications while in_progress."""
    service = MedicationReconciliationService(db_session)
    med_rec = await service.start_reconciliation(med_rec_create_data, started_by=medico_user.id)

    new_home_meds = [
        HomeMedication(name="Ibuprofeno 400mg", dose="400mg", frequency="cada 8h", route="oral"),
        HomeMedication(name="Omeprazol 20mg", dose="20mg", frequency="diario", route="oral"),
    ]
    updated = await service.update_home_medications(med_rec.id, new_home_meds)

    assert len(updated.home_medications) == 2
    assert updated.home_medications[0]["name"] == "Ibuprofeno 400mg"


@pytest.mark.asyncio
async def test_complete_reconciliation_discontinues_rx(
    db_session, med_rec_create_data, prescription, medico_user
):
    """Completing with discontinue decision should mark Rx as discontinued."""
    service = MedicationReconciliationService(db_session)
    med_rec = await service.start_reconciliation(med_rec_create_data, started_by=medico_user.id)

    complete_data = MedRecComplete(
        decisions=[
            MedicationDecision(
                prescription_id=prescription.id,
                action="discontinue",
                reason="No longer needed",
            )
        ],
        notes="Reconciliation completed",
    )

    completed = await service.complete_reconciliation(
        med_rec.id, complete_data, reconciled_by=medico_user.id
    )

    assert completed.status == "completed"
    assert completed.reconciled_by == medico_user.id
    assert completed.reconciled_at is not None
    assert len(completed.discontinue_medications) == 1
    assert completed.notes == "Reconciliation completed"

    # Verify the prescription was actually discontinued
    await db_session.refresh(prescription)
    assert prescription.status == "discontinued"


@pytest.mark.asyncio
async def test_complete_reconciliation_stores_changes_audit(
    db_session, med_rec_create_data, prescription, medico_user
):
    """Completion should build a changes audit trail."""
    service = MedicationReconciliationService(db_session)
    med_rec = await service.start_reconciliation(med_rec_create_data, started_by=medico_user.id)

    complete_data = MedRecComplete(
        decisions=[
            MedicationDecision(prescription_id=prescription.id, action="continue"),
        ],
        new_medications=[
            NewMedicationEntry(
                medication_name="Losartan 50mg",
                dosage="50mg",
                frequency="diario",
                route="oral",
                reason="New hypertension treatment",
            )
        ],
    )

    completed = await service.complete_reconciliation(
        med_rec.id, complete_data, reconciled_by=medico_user.id
    )

    assert len(completed.changes) == 2  # 1 continue + 1 new_medication
    actions = [c["action"] for c in completed.changes]
    assert "continue" in actions
    assert "new_medication" in actions
    assert len(completed.continue_medications) == 1
    assert len(completed.new_medications) == 1


@pytest.mark.asyncio
async def test_cannot_complete_already_completed(
    db_session, med_rec_create_data, medico_user
):
    """Completing an already-completed reconciliation should raise ValidationError."""
    service = MedicationReconciliationService(db_session)
    med_rec = await service.start_reconciliation(med_rec_create_data, started_by=medico_user.id)

    complete_data = MedRecComplete()
    await service.complete_reconciliation(
        med_rec.id, complete_data, reconciled_by=medico_user.id
    )

    with pytest.raises(ValidationError):
        await service.complete_reconciliation(
            med_rec.id, complete_data, reconciled_by=medico_user.id
        )


@pytest.mark.asyncio
async def test_cannot_update_home_meds_after_completion(
    db_session, med_rec_create_data, medico_user
):
    """Updating home meds after completion should raise ValidationError."""
    service = MedicationReconciliationService(db_session)
    med_rec = await service.start_reconciliation(med_rec_create_data, started_by=medico_user.id)

    await service.complete_reconciliation(
        med_rec.id, MedRecComplete(), reconciled_by=medico_user.id
    )

    with pytest.raises(ValidationError):
        await service.update_home_medications(
            med_rec.id, [HomeMedication(name="Test", dose="10mg")]
        )


@pytest.mark.asyncio
async def test_list_by_patient(
    db_session, sample_patient, sample_encounter, medico_user
):
    """Should return patient reconciliation history in chronological order."""
    service = MedicationReconciliationService(db_session)

    data = MedRecCreate(
        encounter_id=sample_encounter.id,
        patient_id=sample_patient.id,
        reconciliation_type="admission",
    )
    await service.start_reconciliation(data, started_by=medico_user.id)

    records = await service.list_by_patient(sample_patient.id)
    assert len(records) == 1
    assert records[0].patient_id == sample_patient.id


@pytest.mark.asyncio
async def test_events_published_on_start_and_complete(
    db_session, med_rec_create_data, medico_user, mock_event_publish
):
    """Domain events should be published for start and complete."""
    service = MedicationReconciliationService(db_session)
    await service.start_reconciliation(med_rec_create_data, started_by=medico_user.id)

    # Check MED_REC_STARTED event was published
    assert mock_event_publish.call_count >= 1
    start_call = mock_event_publish.call_args_list[0]
    assert start_call[0][0].event_type == "med_rec.started"

    # Now complete
    med_rec = await service.get_by_encounter(med_rec_create_data.encounter_id)
    await service.complete_reconciliation(
        med_rec.id, MedRecComplete(), reconciled_by=medico_user.id
    )

    # Check MED_REC_COMPLETED event was published
    complete_calls = [
        c for c in mock_event_publish.call_args_list
        if c[0][0].event_type == "med_rec.completed"
    ]
    assert len(complete_calls) == 1
