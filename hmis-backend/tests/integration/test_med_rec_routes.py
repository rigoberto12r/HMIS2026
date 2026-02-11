"""
Integration tests for Medication Reconciliation API routes.

Tests the full HTTP request/response cycle via the pharmacy router.
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.pharmacy.models import Product, Prescription


# ─── Fixtures ─────────────────────────────────────────────


@pytest.fixture
async def product(db_session: AsyncSession):
    """Create a test pharmacy product."""
    p = Product(
        name="Amoxicilina 500mg",
        product_type="medication",
        unit_of_measure="capsula",
    )
    db_session.add(p)
    await db_session.flush()
    await db_session.commit()
    return p


@pytest.fixture
async def active_prescription(
    db_session: AsyncSession, sample_patient, sample_encounter, medico_user, product
):
    """Create an active prescription for the test patient."""
    rx = Prescription(
        encounter_id=sample_encounter.id,
        patient_id=sample_patient.id,
        prescribed_by=medico_user.id,
        product_id=product.id,
        medication_name="Amoxicilina 500mg",
        dosage="500mg",
        frequency="cada 8 horas",
        route="oral",
        quantity_prescribed=21,
        status="active",
        created_by=medico_user.id,
        updated_by=medico_user.id,
    )
    db_session.add(rx)
    await db_session.flush()
    await db_session.commit()
    return rx


# ─── Test: Create Reconciliation ──────────────────────────


@pytest.mark.asyncio
async def test_create_reconciliation_201(
    client: AsyncClient,
    medico_auth_headers: dict,
    sample_patient,
    sample_encounter,
):
    """POST /pharmacy/medication-reconciliation should return 201."""
    response = await client.post(
        "/api/v1/pharmacy/medication-reconciliation",
        json={
            "encounter_id": str(sample_encounter.id),
            "patient_id": str(sample_patient.id),
            "reconciliation_type": "admission",
            "home_medications": [
                {
                    "name": "Aspirina 100mg",
                    "dose": "100mg",
                    "frequency": "diario",
                    "route": "oral",
                    "source": "patient",
                }
            ],
        },
        headers=medico_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "in_progress"
    assert data["reconciliation_type"] == "admission"
    assert len(data["home_medications"]) == 1


@pytest.mark.asyncio
async def test_create_reconciliation_duplicate_409(
    client: AsyncClient,
    medico_auth_headers: dict,
    sample_patient,
    sample_encounter,
):
    """POST duplicate reconciliation for same encounter should return 409."""
    body = {
        "encounter_id": str(sample_encounter.id),
        "patient_id": str(sample_patient.id),
        "reconciliation_type": "admission",
    }
    resp1 = await client.post(
        "/api/v1/pharmacy/medication-reconciliation",
        json=body,
        headers=medico_auth_headers,
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        "/api/v1/pharmacy/medication-reconciliation",
        json=body,
        headers=medico_auth_headers,
    )
    assert resp2.status_code == 409


# ─── Test: Get by ID ──────────────────────────────────────


@pytest.mark.asyncio
async def test_get_reconciliation_by_id(
    client: AsyncClient,
    medico_auth_headers: dict,
    sample_patient,
    sample_encounter,
):
    """GET /pharmacy/medication-reconciliation/{id} should return the record."""
    create_resp = await client.post(
        "/api/v1/pharmacy/medication-reconciliation",
        json={
            "encounter_id": str(sample_encounter.id),
            "patient_id": str(sample_patient.id),
            "reconciliation_type": "discharge",
        },
        headers=medico_auth_headers,
    )
    med_rec_id = create_resp.json()["id"]

    response = await client.get(
        f"/api/v1/pharmacy/medication-reconciliation/{med_rec_id}",
        headers=medico_auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["id"] == med_rec_id


# ─── Test: Get by Encounter ───────────────────────────────


@pytest.mark.asyncio
async def test_get_reconciliation_by_encounter(
    client: AsyncClient,
    medico_auth_headers: dict,
    sample_patient,
    sample_encounter,
):
    """GET /pharmacy/medication-reconciliation/encounter/{id} should return record."""
    await client.post(
        "/api/v1/pharmacy/medication-reconciliation",
        json={
            "encounter_id": str(sample_encounter.id),
            "patient_id": str(sample_patient.id),
            "reconciliation_type": "admission",
        },
        headers=medico_auth_headers,
    )

    response = await client.get(
        f"/api/v1/pharmacy/medication-reconciliation/encounter/{sample_encounter.id}",
        headers=medico_auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["encounter_id"] == str(sample_encounter.id)


@pytest.mark.asyncio
async def test_get_by_encounter_not_found(
    client: AsyncClient,
    medico_auth_headers: dict,
):
    """GET by encounter with no reconciliation should return 404."""
    response = await client.get(
        f"/api/v1/pharmacy/medication-reconciliation/encounter/{uuid.uuid4()}",
        headers=medico_auth_headers,
    )
    assert response.status_code == 404


# ─── Test: Update Home Medications ────────────────────────


@pytest.mark.asyncio
async def test_update_home_medications(
    client: AsyncClient,
    medico_auth_headers: dict,
    sample_patient,
    sample_encounter,
):
    """PUT /medication-reconciliation/{id}/home-medications should update."""
    create_resp = await client.post(
        "/api/v1/pharmacy/medication-reconciliation",
        json={
            "encounter_id": str(sample_encounter.id),
            "patient_id": str(sample_patient.id),
            "reconciliation_type": "admission",
        },
        headers=medico_auth_headers,
    )
    med_rec_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/v1/pharmacy/medication-reconciliation/{med_rec_id}/home-medications",
        json={
            "home_medications": [
                {"name": "Losartan 50mg", "dose": "50mg", "frequency": "diario", "route": "oral"},
                {"name": "Metformina 850mg", "dose": "850mg", "frequency": "cada 12h", "route": "oral"},
            ]
        },
        headers=medico_auth_headers,
    )
    assert response.status_code == 200
    assert len(response.json()["home_medications"]) == 2


# ─── Test: Complete Reconciliation ────────────────────────


@pytest.mark.asyncio
async def test_complete_reconciliation(
    client: AsyncClient,
    medico_auth_headers: dict,
    sample_patient,
    sample_encounter,
    active_prescription,
):
    """PUT /medication-reconciliation/{id}/complete should transition to completed."""
    create_resp = await client.post(
        "/api/v1/pharmacy/medication-reconciliation",
        json={
            "encounter_id": str(sample_encounter.id),
            "patient_id": str(sample_patient.id),
            "reconciliation_type": "discharge",
        },
        headers=medico_auth_headers,
    )
    med_rec_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/v1/pharmacy/medication-reconciliation/{med_rec_id}/complete",
        json={
            "decisions": [
                {
                    "prescription_id": str(active_prescription.id),
                    "action": "continue",
                    "reason": "Patient still needs it",
                }
            ],
            "new_medications": [
                {
                    "medication_name": "Omeprazol 20mg",
                    "dosage": "20mg",
                    "frequency": "diario",
                    "route": "oral",
                    "reason": "Gastric protection",
                }
            ],
            "notes": "All reconciled",
        },
        headers=medico_auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["reconciled_by"] is not None
    assert data["reconciled_at"] is not None
    assert len(data["continue_medications"]) == 1
    assert len(data["new_medications"]) == 1
    assert data["notes"] == "All reconciled"


# ─── Test: Auth Required ──────────────────────────────────


@pytest.mark.asyncio
async def test_reconciliation_requires_auth(client: AsyncClient):
    """Endpoints should return 401/403 without proper auth."""
    response = await client.post(
        "/api/v1/pharmacy/medication-reconciliation",
        json={
            "encounter_id": str(uuid.uuid4()),
            "patient_id": str(uuid.uuid4()),
            "reconciliation_type": "admission",
        },
    )
    assert response.status_code in (401, 403)


# ─── Test: Patient History ────────────────────────────────


@pytest.mark.asyncio
async def test_list_patient_reconciliations(
    client: AsyncClient,
    medico_auth_headers: dict,
    sample_patient,
    sample_encounter,
):
    """GET /medication-reconciliation/patient/{id} should return history."""
    await client.post(
        "/api/v1/pharmacy/medication-reconciliation",
        json={
            "encounter_id": str(sample_encounter.id),
            "patient_id": str(sample_patient.id),
            "reconciliation_type": "admission",
        },
        headers=medico_auth_headers,
    )

    response = await client.get(
        f"/api/v1/pharmacy/medication-reconciliation/patient/{sample_patient.id}",
        headers=medico_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["patient_id"] == str(sample_patient.id)
