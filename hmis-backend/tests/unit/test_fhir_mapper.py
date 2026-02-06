"""
Tests unitarios para el mapeador FHIR R4.
"""

from datetime import date, datetime, timezone
from types import SimpleNamespace

from app.integrations.fhir.mapper import (
    patient_to_fhir,
    encounter_to_fhir,
    diagnosis_to_fhir,
)


def _mock_patient():
    return SimpleNamespace(
        id="p-123",
        mrn="HMIS-00000001",
        document_type="cedula",
        document_number="00112345678",
        first_name="Juan",
        last_name="Perez",
        birth_date=date(1985, 3, 15),
        gender="M",
        is_active=True,
        phone="809-555-0100",
        mobile_phone="829-555-0200",
        email="juan@email.com",
        address_line1="Calle 1",
        city="Santo Domingo",
        state_province="DN",
        postal_code="10100",
        country="DO",
    )


def test_patient_to_fhir():
    patient = _mock_patient()
    fhir = patient_to_fhir(patient)

    assert fhir["resourceType"] == "Patient"
    assert fhir["id"] == "p-123"
    assert fhir["gender"] == "male"
    assert fhir["birthDate"] == "1985-03-15"
    assert len(fhir["identifier"]) == 2
    assert fhir["name"][0]["family"] == "Perez"
    assert "telecom" in fhir
    assert "address" in fhir


def test_encounter_to_fhir():
    encounter = SimpleNamespace(
        id="e-456",
        status="in_progress",
        encounter_type="ambulatory",
        patient_id="p-123",
        provider_id="prov-789",
        start_datetime=datetime(2026, 2, 6, 10, 0, tzinfo=timezone.utc),
        end_datetime=None,
        chief_complaint="Dolor de cabeza",
    )
    fhir = encounter_to_fhir(encounter)

    assert fhir["resourceType"] == "Encounter"
    assert fhir["status"] == "in-progress"
    assert fhir["class"]["code"] == "AMB"
    assert "reasonCode" in fhir


def test_diagnosis_to_fhir():
    diagnosis = SimpleNamespace(
        id="d-001",
        icd10_code="J06.9",
        description="Infeccion aguda de vias respiratorias superiores",
        status="active",
        onset_date=date(2026, 2, 1),
    )
    fhir = diagnosis_to_fhir(diagnosis, "p-123")

    assert fhir["resourceType"] == "Condition"
    assert fhir["code"]["coding"][0]["code"] == "J06.9"
    assert fhir["subject"]["reference"] == "Patient/p-123"
