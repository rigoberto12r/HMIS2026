"""
Manual verification script for FHIR R4 implementation.

Run this to verify FHIR functionality without integration test infrastructure.
Usage: python tests/manual_fhir_verification.py
"""

import asyncio
from datetime import date
from uuid import uuid4

# Test converters
from app.modules.fhir.converters import patient_to_fhir, fhir_to_patient_data
from app.modules.fhir.capability import generate_capability_statement
from fhir.resources.patient import Patient as FHIRPatient
from types import SimpleNamespace


def test_capability_statement():
    """Test CapabilityStatement generation."""
    print("✓ Testing CapabilityStatement generation...")

    cap = generate_capability_statement("http://localhost:8000/api/v1/fhir")

    assert cap.status == "active"
    assert cap.fhirVersion == "4.0.1"
    assert cap.kind == "instance"
    assert len(cap.rest) > 0
    assert cap.rest[0].mode == "server"

    # Check Patient resource
    patient_resource = next(r for r in cap.rest[0].resource if r.type == "Patient")
    interactions = [i.code for i in patient_resource.interaction]
    assert "read" in interactions
    assert "create" in interactions
    assert "search-type" in interactions

    print(f"  ✓ Status: {cap.status}")
    print(f"  ✓ FHIR Version: {cap.fhirVersion}")
    print(f"  ✓ Software: {cap.software.name} v{cap.software.version}")
    print(f"  ✓ Patient interactions: {', '.join(interactions)}")


def test_patient_to_fhir_conversion():
    """Test internal Patient → FHIR Patient conversion."""
    print("\n✓ Testing Patient → FHIR conversion...")

    patient = SimpleNamespace(
        id=uuid4(),
        mrn="MRN00000001",
        document_type="cedula",
        document_number="00112345678",
        first_name="Juan",
        last_name="Perez",
        birth_date=date(1985, 3, 15),
        gender="M",
        status="active",
        is_active=True,
        phone="809-555-0100",
        mobile_phone="829-555-0200",
        email="juan.perez@example.com",
        address_line1="Calle Principal #123",
        address_line2=None,
        city="Santo Domingo",
        state_province="Distrito Nacional",
        postal_code="10100",
        country="DO",
    )

    fhir_patient = patient_to_fhir(patient)

    assert fhir_patient.__class__.__name__ == "Patient"
    assert fhir_patient.id == str(patient.id)
    assert fhir_patient.gender == "male"
    assert fhir_patient.birthDate == patient.birth_date
    assert len(fhir_patient.identifier) == 2
    assert fhir_patient.name[0].family == "Perez"

    print(f"  ✓ Resource Type: {fhir_patient.__class__.__name__}")
    print(f"  ✓ Gender mapping: M → {fhir_patient.gender}")
    print(f"  ✓ Name: {fhir_patient.name[0].given[0]} {fhir_patient.name[0].family}")
    print(f"  ✓ Identifiers: {len(fhir_patient.identifier)}")
    print(f"  ✓ Telecom: {len(fhir_patient.telecom)} contact points")


def test_fhir_to_patient_conversion():
    """Test FHIR Patient → internal data conversion."""
    print("\n✓ Testing FHIR → Patient data conversion...")

    fhir_patient = FHIRPatient(
        id=str(uuid4()),
        identifier=[
            {"system": "urn:hmis:mrn", "value": "MRN00000010"},
            {"system": "urn:hmis:document:cedula", "value": "00112345678"},
        ],
        name=[{"use": "official", "family": "Rodriguez", "given": ["Carlos"]}],
        gender="male",
        birthDate=date(1995, 6, 10),
        active=True,
        telecom=[
            {"system": "phone", "value": "809-555-9999", "use": "mobile"},
            {"system": "email", "value": "carlos@example.com"},
        ],
        address=[
            {
                "use": "home",
                "line": ["Av. Test #100"],
                "city": "Santiago",
                "state": "Santiago",
                "country": "DO",
            }
        ],
    )

    patient_data = fhir_to_patient_data(fhir_patient)

    assert patient_data["first_name"] == "Carlos"
    assert patient_data["last_name"] == "Rodriguez"
    assert patient_data["gender"] == "M"
    assert patient_data["document_type"] == "cedula"
    assert patient_data["mrn"] == "MRN00000010"

    print(f"  ✓ Name: {patient_data['first_name']} {patient_data['last_name']}")
    print(f"  ✓ Gender mapping: male → {patient_data['gender']}")
    print(f"  ✓ Document: {patient_data['document_type']} {patient_data['document_number']}")
    print(f"  ✓ MRN: {patient_data['mrn']}")
    print(f"  ✓ City: {patient_data['city']}")


def test_bidirectional_conversion():
    """Test round-trip conversion."""
    print("\n✓ Testing bidirectional conversion (round-trip)...")

    # Start with internal patient
    original = SimpleNamespace(
        id=uuid4(),
        mrn="MRN00000099",
        document_type="passport",
        document_number="AB123456",
        first_name="Maria",
        last_name="Garcia",
        birth_date=date(1990, 12, 25),
        gender="F",
        status="active",
        is_active=True,
        phone=None,
        mobile_phone="849-555-7777",
        email="maria.garcia@example.com",
        address_line1="Calle Nueva #456",
        address_line2="Apt 2B",
        city="La Vega",
        state_province="La Vega",
        postal_code="41000",
        country="DO",
    )

    # Convert to FHIR
    fhir_patient = patient_to_fhir(original)

    # Convert back to internal
    patient_data = fhir_to_patient_data(fhir_patient)

    # Verify key fields preserved
    assert patient_data["first_name"] == original.first_name
    assert patient_data["last_name"] == original.last_name
    assert patient_data["birth_date"] == original.birth_date
    assert patient_data["gender"] == original.gender
    assert patient_data["email"] == original.email
    assert patient_data["city"] == original.city

    print("  ✓ Round-trip conversion successful!")
    print(f"    Original: {original.first_name} {original.last_name}")
    print(f"    After FHIR: {patient_data['first_name']} {patient_data['last_name']}")
    print(f"    Birth date preserved: {original.birth_date} == {patient_data['birth_date']}")


if __name__ == "__main__":
    print("=" * 70)
    print("FHIR R4 Implementation Verification")
    print("=" * 70)

    try:
        test_capability_statement()
        test_patient_to_fhir_conversion()
        test_fhir_to_patient_conversion()
        test_bidirectional_conversion()

        print("\n" + "=" * 70)
        print("✅ ALL VERIFICATION TESTS PASSED!")
        print("=" * 70)
        print("\nFHIR R4 implementation is working correctly.")
        print("\nNext steps:")
        print("1. Start the server: uvicorn app.main:app --reload")
        print("2. Test endpoints:")
        print("   - GET http://localhost:8000/api/v1/fhir/metadata")
        print("   - GET http://localhost:8000/api/docs (see FHIR section)")
        print("3. Run unit tests: pytest tests/unit/test_fhir_converters.py -v")

    except AssertionError as e:
        print(f"\n❌ VERIFICATION FAILED: {e}")
        raise
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        raise
