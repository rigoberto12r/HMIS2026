"""
Unit tests for FHIR converters.

Tests bidirectional conversion between internal Patient and Encounter models and FHIR resources.
"""

from datetime import date, datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fhir.resources.encounter import Encounter as FHIREncounter
from fhir.resources.patient import Patient as FHIRPatient

from app.modules.fhir.converters import (
    encounter_to_fhir,
    fhir_to_encounter_data,
    fhir_to_patient_data,
    patient_to_fhir,
    validate_fhir_encounter,
    validate_fhir_patient,
)
from app.shared.exceptions import ValidationError


class TestPatientToFHIR:
    """Tests for patient_to_fhir converter (internal → FHIR)."""

    def test_patient_to_fhir_basic(self):
        """Convert internal Patient to FHIR Patient with basic fields."""
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

        assert isinstance(fhir_patient, FHIRPatient)
        assert fhir_patient.id == str(patient.id)
        assert fhir_patient.active is True
        assert fhir_patient.gender == "male"
        assert fhir_patient.birthDate == patient.birth_date

        # Check identifiers
        assert len(fhir_patient.identifier) == 2
        mrn_id = next(i for i in fhir_patient.identifier if i.system == "urn:hmis:mrn")
        assert mrn_id.value == "MRN00000001"

        doc_id = next(i for i in fhir_patient.identifier if "document" in i.system)
        assert doc_id.value == "00112345678"

        # Check name
        assert len(fhir_patient.name) == 1
        assert fhir_patient.name[0].family == "Perez"
        assert "Juan" in fhir_patient.name[0].given

        # Check telecom
        assert len(fhir_patient.telecom) == 3
        phone_values = [t.value for t in fhir_patient.telecom if t.system == "phone"]
        assert "809-555-0100" in phone_values
        assert "829-555-0200" in phone_values

        email_contacts = [t for t in fhir_patient.telecom if t.system == "email"]
        assert len(email_contacts) == 1
        assert email_contacts[0].value == "juan.perez@example.com"

        # Check address
        assert len(fhir_patient.address) == 1
        assert fhir_patient.address[0].city == "Santo Domingo"
        assert "Calle Principal #123" in fhir_patient.address[0].line

    def test_patient_to_fhir_deceased(self):
        """Convert deceased patient sets deceasedBoolean."""
        patient = SimpleNamespace(
            id=uuid4(),
            mrn="MRN00000002",
            document_type="cedula",
            document_number="00198765432",
            first_name="Maria",
            last_name="Garcia",
            birth_date=date(1960, 5, 20),
            gender="F",
            status="deceased",
            is_active=False,
            phone=None,
            mobile_phone=None,
            email=None,
            address_line1=None,
            address_line2=None,
            city=None,
            state_province=None,
            postal_code=None,
            country="DO",
        )

        fhir_patient = patient_to_fhir(patient)

        assert fhir_patient.active is False
        assert fhir_patient.deceasedBoolean is True
        assert fhir_patient.gender == "female"

        # No telecom or address
        assert fhir_patient.telecom is None
        assert fhir_patient.address is None

    def test_patient_to_fhir_gender_mapping(self):
        """Gender codes map correctly (M→male, F→female, otro→other)."""
        test_cases = [
            ("M", "male"),
            ("F", "female"),
            ("otro", "other"),
            ("invalid", "unknown"),
        ]

        for internal_gender, fhir_gender in test_cases:
            patient = SimpleNamespace(
                id=uuid4(),
                mrn="MRN00000003",
                document_type="cedula",
                document_number="00100000000",
                first_name="Test",
                last_name="Patient",
                birth_date=date(1990, 1, 1),
                gender=internal_gender,
                status="active",
                is_active=True,
                phone=None,
                mobile_phone=None,
                email=None,
                address_line1=None,
                address_line2=None,
                city=None,
                state_province=None,
                postal_code=None,
                country="DO",
            )

            fhir_patient = patient_to_fhir(patient)
            assert fhir_patient.gender == fhir_gender


class TestFHIRToPatientData:
    """Tests for fhir_to_patient_data converter (FHIR → internal)."""

    def test_fhir_to_patient_data_basic(self):
        """Convert FHIR Patient to internal patient data dict."""
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
                    "postalCode": "51000",
                    "country": "DO",
                }
            ],
        )

        patient_data = fhir_to_patient_data(fhir_patient)

        assert patient_data["first_name"] == "Carlos"
        assert patient_data["last_name"] == "Rodriguez"
        assert patient_data["birth_date"] == date(1995, 6, 10)
        assert patient_data["gender"] == "M"
        assert patient_data["document_type"] == "cedula"
        assert patient_data["document_number"] == "00112345678"
        assert patient_data["mrn"] == "MRN00000010"
        assert patient_data["status"] == "active"
        assert patient_data["mobile_phone"] == "809-555-9999"
        assert patient_data["email"] == "carlos@example.com"
        assert patient_data["address_line1"] == "Av. Test #100"
        assert patient_data["city"] == "Santiago"

    def test_fhir_to_patient_data_missing_name_raises_error(self):
        """Missing name raises ValidationError."""
        fhir_patient = FHIRPatient(
            id=str(uuid4()),
            identifier=[{"system": "urn:hmis:document:cedula", "value": "00100000000"}],
            gender="male",
            birthDate=date(1990, 1, 1),
            active=True,
        )

        # Remove name to trigger error
        fhir_patient.name = None

        with pytest.raises(ValidationError) as exc_info:
            fhir_to_patient_data(fhir_patient)

        assert "name" in str(exc_info.value.message).lower()

    def test_fhir_to_patient_data_missing_identifier_raises_error(self):
        """Missing identifier raises ValidationError."""
        fhir_patient = FHIRPatient(
            id=str(uuid4()),
            name=[{"use": "official", "family": "Test", "given": ["Patient"]}],
            gender="male",
            birthDate=date(1990, 1, 1),
            active=True,
        )

        # Remove identifier
        fhir_patient.identifier = None

        with pytest.raises(ValidationError) as exc_info:
            fhir_to_patient_data(fhir_patient)

        assert "identifier" in str(exc_info.value.message).lower()

    def test_fhir_to_patient_data_missing_birthdate_raises_error(self):
        """Missing birthDate raises ValidationError."""
        fhir_patient = FHIRPatient(
            id=str(uuid4()),
            identifier=[{"system": "urn:hmis:document:cedula", "value": "00100000000"}],
            name=[{"use": "official", "family": "Test", "given": ["Patient"]}],
            gender="male",
            active=True,
        )

        # Remove birthDate
        fhir_patient.birthDate = None

        with pytest.raises(ValidationError) as exc_info:
            fhir_to_patient_data(fhir_patient)

        assert "birthdate" in str(exc_info.value.message).lower()

    def test_fhir_to_patient_data_deceased_status(self):
        """deceasedBoolean maps to internal status='deceased'."""
        fhir_patient = FHIRPatient(
            id=str(uuid4()),
            identifier=[{"system": "urn:hmis:document:cedula", "value": "00100000000"}],
            name=[{"use": "official", "family": "Deceased", "given": ["Test"]}],
            gender="male",
            birthDate=date(1950, 1, 1),
            active=False,
            deceasedBoolean=True,
        )

        patient_data = fhir_to_patient_data(fhir_patient)

        assert patient_data["status"] == "deceased"

    def test_fhir_to_patient_data_inactive_status(self):
        """active=False maps to internal status='inactive'."""
        fhir_patient = FHIRPatient(
            id=str(uuid4()),
            identifier=[{"system": "urn:hmis:document:cedula", "value": "00100000000"}],
            name=[{"use": "official", "family": "Inactive", "given": ["Test"]}],
            gender="male",
            birthDate=date(1980, 1, 1),
            active=False,
        )

        patient_data = fhir_to_patient_data(fhir_patient)

        assert patient_data["status"] == "inactive"

    def test_fhir_to_patient_data_gender_mapping(self):
        """FHIR gender maps correctly to internal codes."""
        test_cases = [
            ("male", "M"),
            ("female", "F"),
            ("other", "otro"),
            ("unknown", "otro"),
        ]

        for fhir_gender, internal_gender in test_cases:
            fhir_patient = FHIRPatient(
                id=str(uuid4()),
                identifier=[{"system": "urn:hmis:document:cedula", "value": "00100000000"}],
                name=[{"use": "official", "family": "Test", "given": ["Gender"]}],
                gender=fhir_gender,
                birthDate=date(1990, 1, 1),
                active=True,
            )

            patient_data = fhir_to_patient_data(fhir_patient)
            assert patient_data["gender"] == internal_gender


class TestValidateFHIRPatient:
    """Tests for validate_fhir_patient function."""

    def test_validate_fhir_patient_valid(self):
        """Valid FHIR Patient JSON passes validation."""
        fhir_json = {
            "resourceType": "Patient",
            "identifier": [{"system": "urn:hmis:document:cedula", "value": "00100000000"}],
            "name": [{"use": "official", "family": "Valid", "given": ["Test"]}],
            "gender": "male",
            "birthDate": "1990-01-01",
            "active": True,
        }

        fhir_patient = validate_fhir_patient(fhir_json)

        assert isinstance(fhir_patient, FHIRPatient)
        assert fhir_patient.name[0].family == "Valid"

    def test_validate_fhir_patient_invalid_raises_error(self):
        """Invalid FHIR Patient JSON with malformed data raises ValidationError."""
        invalid_fhir = {
            "resourceType": "Patient",
            "gender": "invalid_gender_code",  # Invalid enum value
            "birthDate": "not-a-date",  # Invalid date format
        }

        with pytest.raises(ValidationError) as exc_info:
            validate_fhir_patient(invalid_fhir)

        assert "Invalid FHIR Patient" in str(exc_info.value.message)


# ============================================================================
# ENCOUNTER CONVERTER TESTS
# ============================================================================


class TestEncounterToFHIR:
    """Tests for encounter_to_fhir converter (internal → FHIR)."""

    def test_encounter_to_fhir_basic(self):
        """Convert internal Encounter to FHIR Encounter with basic fields."""
        patient_id = uuid4()
        provider_id = uuid4()
        start_time = datetime(2026, 2, 10, 10, 0, 0, tzinfo=timezone.utc)

        encounter = SimpleNamespace(
            id=uuid4(),
            patient_id=patient_id,
            provider_id=provider_id,
            encounter_type="ambulatory",
            status="in_progress",
            start_datetime=start_time,
            end_datetime=None,
            chief_complaint="Dolor de cabeza persistente",
            disposition=None,
            appointment_id=None,
            location_id=None,
            diagnoses=[],
        )

        fhir_encounter = encounter_to_fhir(encounter)

        assert isinstance(fhir_encounter, FHIREncounter)
        assert fhir_encounter.id == str(encounter.id)
        assert fhir_encounter.status == "in-progress"

        # Check class (encounter type)
        assert len(fhir_encounter.class_fhir) == 1
        assert fhir_encounter.class_fhir[0].coding[0].code == "AMB"
        assert fhir_encounter.class_fhir[0].coding[0].system == "http://terminology.hl7.org/CodeSystem/v3-ActCode"

        # Check subject (patient reference)
        assert fhir_encounter.subject.reference == f"Patient/{patient_id}"

        # Check participant (provider reference)
        assert len(fhir_encounter.participant) == 1
        assert fhir_encounter.participant[0].actor.reference == f"Practitioner/{provider_id}"

        # Check period
        assert fhir_encounter.actualPeriod.start == start_time
        assert fhir_encounter.actualPeriod.end is None

        # Check reason (chief complaint)
        assert len(fhir_encounter.reason) == 1
        assert fhir_encounter.reason[0].value[0].concept.text == "Dolor de cabeza persistente"

    def test_encounter_to_fhir_encounter_type_mapping(self):
        """Encounter type codes map correctly (ambulatory→AMB, emergency→EMER, inpatient→IMP)."""
        test_cases = [
            ("ambulatory", "AMB"),
            ("emergency", "EMER"),
            ("inpatient", "IMP"),
        ]

        for internal_type, fhir_code in test_cases:
            encounter = SimpleNamespace(
                id=uuid4(),
                patient_id=uuid4(),
                provider_id=uuid4(),
                encounter_type=internal_type,
                status="in_progress",
                start_datetime=datetime.now(timezone.utc),
                end_datetime=None,
                chief_complaint="Test",
                disposition=None,
                appointment_id=None,
                location_id=None,
                diagnoses=[],
            )

            fhir_encounter = encounter_to_fhir(encounter)
            assert fhir_encounter.class_fhir[0].coding[0].code == fhir_code

    def test_encounter_to_fhir_status_mapping(self):
        """Status codes map correctly (in_progress→in-progress, completed→finished)."""
        test_cases = [
            ("in_progress", "in-progress"),
            ("completed", "finished"),
            ("cancelled", "cancelled"),
        ]

        for internal_status, fhir_status in test_cases:
            encounter = SimpleNamespace(
                id=uuid4(),
                patient_id=uuid4(),
                provider_id=None,
                encounter_type="ambulatory",
                status=internal_status,
                start_datetime=datetime.now(timezone.utc),
                end_datetime=datetime.now(timezone.utc) if internal_status == "completed" else None,
                chief_complaint="Test",
                disposition=None,
                appointment_id=None,
                location_id=None,
                diagnoses=[],
            )

            fhir_encounter = encounter_to_fhir(encounter)
            assert fhir_encounter.status == fhir_status

    def test_encounter_to_fhir_completed_with_disposition(self):
        """Completed encounter with disposition includes admission details."""
        encounter = SimpleNamespace(
            id=uuid4(),
            patient_id=uuid4(),
            provider_id=uuid4(),
            encounter_type="emergency",
            status="completed",
            start_datetime=datetime(2026, 2, 10, 8, 0, 0, tzinfo=timezone.utc),
            end_datetime=datetime(2026, 2, 10, 12, 0, 0, tzinfo=timezone.utc),
            chief_complaint="Dolor torácico",
            disposition="alta",
            appointment_id=None,
            location_id=None,
            diagnoses=[],
        )

        fhir_encounter = encounter_to_fhir(encounter)

        assert fhir_encounter.status == "finished"
        assert fhir_encounter.actualPeriod.end is not None

        # Check admission/discharge disposition
        assert fhir_encounter.admission is not None
        assert fhir_encounter.admission.dischargeDisposition.coding[0].code == "home"

    def test_encounter_to_fhir_with_diagnoses(self):
        """Encounter with diagnoses includes diagnosis list."""
        diagnosis1 = SimpleNamespace(
            id=uuid4(),
            diagnosis_type="principal",
        )
        diagnosis2 = SimpleNamespace(
            id=uuid4(),
            diagnosis_type="secondary",
        )

        encounter = SimpleNamespace(
            id=uuid4(),
            patient_id=uuid4(),
            provider_id=uuid4(),
            encounter_type="inpatient",
            status="in_progress",
            start_datetime=datetime.now(timezone.utc),
            end_datetime=None,
            chief_complaint="Fiebre alta",
            disposition=None,
            appointment_id=None,
            location_id=None,
            diagnoses=[diagnosis1, diagnosis2],
        )

        fhir_encounter = encounter_to_fhir(encounter)

        assert fhir_encounter.diagnosis is not None
        assert len(fhir_encounter.diagnosis) == 2

        # Check principal diagnosis
        principal = fhir_encounter.diagnosis[0]
        assert principal.condition[0].reference.reference == f"Condition/{diagnosis1.id}"
        assert principal.use[0].coding[0].code == "AD"  # Admission diagnosis

        # Check secondary diagnosis
        secondary = fhir_encounter.diagnosis[1]
        assert secondary.condition[0].reference.reference == f"Condition/{diagnosis2.id}"
        assert secondary.use[0].coding[0].code == "DD"  # Discharge diagnosis


class TestFHIRToEncounterData:
    """Tests for fhir_to_encounter_data converter (FHIR → internal)."""

    def test_fhir_to_encounter_data_basic(self):
        """Convert FHIR Encounter to internal encounter data dict."""
        patient_id = uuid4()
        provider_id = uuid4()
        start_time = datetime(2026, 2, 10, 14, 30, 0, tzinfo=timezone.utc)

        fhir_encounter = FHIREncounter(
            id=str(uuid4()),
            status="in-progress",
            class_fhir=[
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                            "code": "AMB",
                        }
                    ]
                }
            ],
            subject={"reference": f"Patient/{patient_id}"},
            participant=[
                {
                    "actor": {"reference": f"Practitioner/{provider_id}"}
                }
            ],
            actualPeriod={"start": start_time},
            reason=[
                {
                    "value": [
                        {
                            "concept": {"text": "Consulta de seguimiento"}
                        }
                    ]
                }
            ],
        )

        encounter_data = fhir_to_encounter_data(fhir_encounter)

        assert encounter_data["patient_id"] == patient_id
        assert encounter_data["provider_id"] == provider_id
        assert encounter_data["encounter_type"] == "ambulatory"
        assert encounter_data["status"] == "in_progress"
        assert encounter_data["start_datetime"] == start_time
        assert encounter_data["end_datetime"] is None
        assert encounter_data["chief_complaint"] == "Consulta de seguimiento"

    def test_fhir_to_encounter_data_missing_subject_raises_error(self):
        """Missing subject (patient reference) raises ValidationError."""
        fhir_encounter = FHIREncounter(
            id=str(uuid4()),
            status="in-progress",
            class_fhir=[{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "AMB"}]}],
            actualPeriod={"start": datetime.now(timezone.utc)},
        )

        # Remove subject
        fhir_encounter.subject = None

        with pytest.raises(ValidationError) as exc_info:
            fhir_to_encounter_data(fhir_encounter)

        assert "subject" in str(exc_info.value.message).lower()

    def test_fhir_to_encounter_data_missing_period_raises_error(self):
        """Missing actualPeriod.start raises ValidationError."""
        fhir_encounter = FHIREncounter(
            id=str(uuid4()),
            status="in-progress",
            class_fhir=[{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "AMB"}]}],
            subject={"reference": f"Patient/{uuid4()}"},
        )

        # Remove period
        fhir_encounter.actualPeriod = None

        with pytest.raises(ValidationError) as exc_info:
            fhir_to_encounter_data(fhir_encounter)

        assert "period" in str(exc_info.value.message).lower() or "start" in str(exc_info.value.message).lower()

    def test_fhir_to_encounter_data_status_mapping(self):
        """FHIR status maps correctly to internal codes."""
        test_cases = [
            ("in-progress", "in_progress"),
            ("finished", "completed"),
            ("cancelled", "cancelled"),
            ("planned", "in_progress"),  # Edge case
            ("arrived", "in_progress"),  # Edge case
        ]

        for fhir_status, internal_status in test_cases:
            fhir_encounter = FHIREncounter(
                id=str(uuid4()),
                status=fhir_status,
                class_fhir=[{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "AMB"}]}],
                subject={"reference": f"Patient/{uuid4()}"},
                actualPeriod={"start": datetime.now(timezone.utc)},
            )

            encounter_data = fhir_to_encounter_data(fhir_encounter)
            assert encounter_data["status"] == internal_status

    def test_fhir_to_encounter_data_encounter_type_mapping(self):
        """FHIR class codes map correctly to internal encounter types."""
        test_cases = [
            ("AMB", "ambulatory"),
            ("EMER", "emergency"),
            ("IMP", "inpatient"),
        ]

        for fhir_code, internal_type in test_cases:
            fhir_encounter = FHIREncounter(
                id=str(uuid4()),
                status="in-progress",
                class_fhir=[
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                                "code": fhir_code,
                            }
                        ]
                    }
                ],
                subject={"reference": f"Patient/{uuid4()}"},
                actualPeriod={"start": datetime.now(timezone.utc)},
            )

            encounter_data = fhir_to_encounter_data(fhir_encounter)
            assert encounter_data["encounter_type"] == internal_type

    def test_fhir_to_encounter_data_with_disposition(self):
        """Admission with dischargeDisposition maps to internal disposition."""
        fhir_encounter = FHIREncounter(
            id=str(uuid4()),
            status="finished",
            class_fhir=[{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "EMER"}]}],
            subject={"reference": f"Patient/{uuid4()}"},
            actualPeriod={
                "start": datetime(2026, 2, 10, 8, 0, 0, tzinfo=timezone.utc),
                "end": datetime(2026, 2, 10, 12, 0, 0, tzinfo=timezone.utc),
            },
            admission={
                "dischargeDisposition": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/discharge-disposition",
                            "code": "home",
                            "display": "Alta",
                        }
                    ]
                }
            },
        )

        encounter_data = fhir_to_encounter_data(fhir_encounter)

        assert encounter_data["disposition"] == "alta"
        assert encounter_data["end_datetime"] is not None


class TestValidateFHIREncounter:
    """Tests for validate_fhir_encounter function."""

    def test_validate_fhir_encounter_valid(self):
        """Valid FHIR Encounter JSON passes validation."""
        fhir_json = {
            "resourceType": "Encounter",
            "status": "in-progress",
            "class": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                            "code": "AMB",
                        }
                    ]
                }
            ],
            "subject": {"reference": f"Patient/{uuid4()}"},
            "actualPeriod": {"start": "2026-02-10T10:00:00Z"},
        }

        fhir_encounter = validate_fhir_encounter(fhir_json)

        assert isinstance(fhir_encounter, FHIREncounter)
        assert fhir_encounter.status == "in-progress"

    def test_validate_fhir_encounter_invalid_raises_error(self):
        """Invalid FHIR Encounter JSON with malformed data raises ValidationError."""
        invalid_fhir = {
            "resourceType": "Encounter",
            "status": "invalid_status_code",  # Invalid enum value
            "class": "not-a-list",  # Invalid structure
        }

        with pytest.raises(ValidationError) as exc_info:
            validate_fhir_encounter(invalid_fhir)

        assert "Invalid FHIR Encounter" in str(exc_info.value.message)



# ============================================================================
# OBSERVATION CONVERTER TESTS (Vital Signs)
# ============================================================================


class TestVitalSignsToObservations:
    """Tests for vital_signs_to_fhir_observations converter."""

    def test_vital_signs_to_observations_all_vitals(self):
        """Convert VitalSigns with all measurements to FHIR Observations."""
        from app.modules.fhir.converters import vital_signs_to_fhir_observations

        vital_signs = SimpleNamespace(
            id=uuid4(),
            patient_id=uuid4(),
            encounter_id=uuid4(),
            measured_at=datetime(2026, 2, 10, 10, 0, 0, tzinfo=timezone.utc),
            temperature=37.2,
            heart_rate=75,
            blood_pressure_sys=120,
            blood_pressure_dia=80,
            respiratory_rate=16,
            oxygen_saturation=98.0,
            weight=70.5,
            height=175.0,
            bmi=23.0,
            pain_scale=2,
            glucose=95.0,
        )

        observations = vital_signs_to_fhir_observations(vital_signs)

        # Should create 10 observations (11 vitals, but BP is 1 panel)
        assert len(observations) == 10

        # Check all observations are valid
        for obs in observations:
            assert obs.status == "final"
            assert obs.subject.reference == f"Patient/{vital_signs.patient_id}"
            assert obs.encounter.reference == f"Encounter/{vital_signs.encounter_id}"
            assert obs.effectiveDateTime == vital_signs.measured_at

    def test_vital_signs_to_observations_partial_vitals(self):
        """Convert VitalSigns with only some measurements."""
        from app.modules.fhir.converters import vital_signs_to_fhir_observations

        vital_signs = SimpleNamespace(
            id=uuid4(),
            patient_id=uuid4(),
            encounter_id=uuid4(),
            measured_at=datetime.now(timezone.utc),
            temperature=37.2,
            heart_rate=75,
            blood_pressure_sys=None,
            blood_pressure_dia=None,
            respiratory_rate=None,
            oxygen_saturation=None,
            weight=None,
            height=None,
            bmi=None,
            pain_scale=None,
            glucose=None,
        )

        observations = vital_signs_to_fhir_observations(vital_signs)

        # Should only create 2 observations (temp + HR)
        assert len(observations) == 2

        # Check correct LOINC codes
        codes = [obs.code.coding[0].code for obs in observations]
        assert "8310-5" in codes  # Temperature
        assert "8867-4" in codes  # Heart rate

    def test_temperature_observation_structure(self):
        """Temperature observation has correct LOINC code and units."""
        from app.modules.fhir.converters import vital_signs_to_fhir_observations

        vital_signs = SimpleNamespace(
            id=uuid4(),
            patient_id=uuid4(),
            encounter_id=uuid4(),
            measured_at=datetime.now(timezone.utc),
            temperature=37.5,
            heart_rate=None,
            blood_pressure_sys=None,
            blood_pressure_dia=None,
            respiratory_rate=None,
            oxygen_saturation=None,
            weight=None,
            height=None,
            bmi=None,
            pain_scale=None,
            glucose=None,
        )

        observations = vital_signs_to_fhir_observations(vital_signs)
        temp_obs = observations[0]

        assert temp_obs.code.coding[0].system == "http://loinc.org"
        assert temp_obs.code.coding[0].code == "8310-5"
        assert temp_obs.valueQuantity.value == 37.5
        assert temp_obs.valueQuantity.unit == "Cel"
        assert temp_obs.valueQuantity.system == "http://unitsofmeasure.org"
        assert temp_obs.category[0].coding[0].code == "vital-signs"

    def test_blood_pressure_panel_structure(self):
        """Blood pressure creates panel observation with components."""
        from app.modules.fhir.converters import vital_signs_to_fhir_observations

        vital_signs = SimpleNamespace(
            id=uuid4(),
            patient_id=uuid4(),
            encounter_id=uuid4(),
            measured_at=datetime.now(timezone.utc),
            temperature=None,
            heart_rate=None,
            blood_pressure_sys=120,
            blood_pressure_dia=80,
            respiratory_rate=None,
            oxygen_saturation=None,
            weight=None,
            height=None,
            bmi=None,
            pain_scale=None,
            glucose=None,
        )

        observations = vital_signs_to_fhir_observations(vital_signs)
        bp_obs = observations[0]

        # Check it's a panel
        assert bp_obs.code.coding[0].code == "85354-9"  # BP panel
        assert bp_obs.component is not None
        assert len(bp_obs.component) == 2

        # Check systolic component
        sys_component = bp_obs.component[0]
        assert sys_component.code.coding[0].code == "8480-6"
        assert sys_component.valueQuantity.value == 120
        assert sys_component.valueQuantity.unit == "mm[Hg]"

        # Check diastolic component
        dia_component = bp_obs.component[1]
        assert dia_component.code.coding[0].code == "8462-4"
        assert dia_component.valueQuantity.value == 80

    def test_glucose_has_laboratory_category(self):
        """Glucose observation has laboratory category, not vital-signs."""
        from app.modules.fhir.converters import vital_signs_to_fhir_observations

        vital_signs = SimpleNamespace(
            id=uuid4(),
            patient_id=uuid4(),
            encounter_id=uuid4(),
            measured_at=datetime.now(timezone.utc),
            temperature=None,
            heart_rate=None,
            blood_pressure_sys=None,
            blood_pressure_dia=None,
            respiratory_rate=None,
            oxygen_saturation=None,
            weight=None,
            height=None,
            bmi=None,
            pain_scale=None,
            glucose=110.0,
        )

        observations = vital_signs_to_fhir_observations(vital_signs)
        glucose_obs = observations[0]

        assert glucose_obs.code.coding[0].code == "2339-0"
        assert glucose_obs.category[0].coding[0].code == "laboratory"
        assert glucose_obs.valueQuantity.value == 110.0
        assert glucose_obs.valueQuantity.unit == "mg/dL"

    def test_pain_scale_uses_integer(self):
        """Pain scale uses valueInteger, not valueQuantity."""
        from app.modules.fhir.converters import vital_signs_to_fhir_observations

        vital_signs = SimpleNamespace(
            id=uuid4(),
            patient_id=uuid4(),
            encounter_id=uuid4(),
            measured_at=datetime.now(timezone.utc),
            temperature=None,
            heart_rate=None,
            blood_pressure_sys=None,
            blood_pressure_dia=None,
            respiratory_rate=None,
            oxygen_saturation=None,
            weight=None,
            height=None,
            bmi=None,
            pain_scale=5,
            glucose=None,
        )

        observations = vital_signs_to_fhir_observations(vital_signs)
        pain_obs = observations[0]

        assert pain_obs.code.coding[0].code == "72514-3"
        assert pain_obs.valueInteger == 5
        assert pain_obs.valueQuantity is None

    def test_observation_ids_are_composite(self):
        """Observation IDs follow {vital_signs_id}-{type} pattern."""
        from app.modules.fhir.converters import vital_signs_to_fhir_observations

        vs_id = uuid4()
        vital_signs = SimpleNamespace(
            id=vs_id,
            patient_id=uuid4(),
            encounter_id=uuid4(),
            measured_at=datetime.now(timezone.utc),
            temperature=37.0,
            heart_rate=70,
            blood_pressure_sys=None,
            blood_pressure_dia=None,
            respiratory_rate=None,
            oxygen_saturation=None,
            weight=None,
            height=None,
            bmi=None,
            pain_scale=None,
            glucose=None,
        )

        observations = vital_signs_to_fhir_observations(vital_signs)

        # Check composite IDs
        temp_obs = observations[0]
        assert temp_obs.id == f"{vs_id}-temp"

        hr_obs = observations[1]
        assert hr_obs.id == f"{vs_id}-hr"


class TestObservationToVitalSignField:
    """Tests for fhir_observation_to_vital_sign_field converter."""

    def test_extract_temperature_from_observation(self):
        """Extract temperature field from FHIR Observation."""
        from fhir.resources.observation import Observation as FHIRObservation
        from app.modules.fhir.converters import fhir_observation_to_vital_sign_field

        obs = FHIRObservation(
            status="final",
            code={
                "coding": [
                    {"system": "http://loinc.org", "code": "8310-5"}
                ]
            },
            valueQuantity={"value": 37.2, "unit": "Cel"},
        )

        field_name, value = fhir_observation_to_vital_sign_field(obs)

        assert field_name == "temperature"
        assert value == 37.2

    def test_extract_blood_pressure_from_panel(self):
        """Extract blood pressure from panel observation with components."""
        from fhir.resources.observation import Observation as FHIRObservation
        from app.modules.fhir.converters import fhir_observation_to_vital_sign_field

        obs = FHIRObservation(
            status="final",
            code={
                "coding": [
                    {"system": "http://loinc.org", "code": "85354-9"}
                ]
            },
            component=[
                {
                    "code": {
                        "coding": [
                            {"system": "http://loinc.org", "code": "8480-6"}
                        ]
                    },
                    "valueQuantity": {"value": 120, "unit": "mm[Hg]"}
                },
                {
                    "code": {
                        "coding": [
                            {"system": "http://loinc.org", "code": "8462-4"}
                        ]
                    },
                    "valueQuantity": {"value": 80, "unit": "mm[Hg]"}
                }
            ],
        )

        field_name, value = fhir_observation_to_vital_sign_field(obs)

        assert field_name == "blood_pressure"
        assert value == {"sys": 120, "dia": 80}


class TestValidateObservation:
    """Tests for validate_fhir_observation function."""

    def test_validate_valid_observation(self):
        """Valid FHIR Observation JSON passes validation."""
        from app.modules.fhir.converters import validate_fhir_observation

        fhir_json = {
            "resourceType": "Observation",
            "status": "final",
            "code": {
                "coding": [
                    {"system": "http://loinc.org", "code": "8310-5"}
                ]
            },
            "subject": {"reference": "Patient/123"},
            "effectiveDateTime": "2026-02-10T10:00:00Z",
            "valueQuantity": {
                "value": 37.2,
                "unit": "Cel",
                "system": "http://unitsofmeasure.org",
            },
        }

        observation = validate_fhir_observation(fhir_json)

        assert observation.status == "final"
        assert observation.code.coding[0].code == "8310-5"

    def test_validate_invalid_observation_raises_error(self):
        """Invalid FHIR Observation JSON raises ValidationError."""
        from app.modules.fhir.converters import validate_fhir_observation

        invalid_fhir = {
            "resourceType": "Observation",
            "status": "invalid_status",  # Invalid status
            # Missing required fields
        }

        with pytest.raises(ValidationError) as exc_info:
            validate_fhir_observation(invalid_fhir)

        assert "Invalid FHIR Observation" in str(exc_info.value.message)
