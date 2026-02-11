"""
Integration tests for FHIR R4 API endpoints (/api/v1/fhir).

Tests Patient resource CRUD operations, search, and FHIR compliance.
"""

import uuid

import pytest
from httpx import AsyncClient


class TestCapabilityStatement:
    """Tests for GET /api/v1/fhir/metadata."""

    @pytest.mark.asyncio
    async def test_get_capability_statement(self, client: AsyncClient):
        """CapabilityStatement endpoint returns valid FHIR resource without auth."""
        response = await client.get("/api/v1/fhir/metadata")

        assert response.status_code == 200
        data = response.json()
        assert data["resourceType"] == "CapabilityStatement"
        assert data["status"] == "active"
        assert data["fhirVersion"] == "4.0.1"
        assert data["kind"] == "instance"
        assert "rest" in data
        assert len(data["rest"]) > 0
        assert data["rest"][0]["mode"] == "server"

        # Check Patient resource is advertised
        resources = data["rest"][0]["resource"]
        patient_resource = next((r for r in resources if r["type"] == "Patient"), None)
        assert patient_resource is not None
        assert "read" in [i["code"] for i in patient_resource["interaction"]]
        assert "create" in [i["code"] for i in patient_resource["interaction"]]
        assert "update" in [i["code"] for i in patient_resource["interaction"]]
        assert "delete" in [i["code"] for i in patient_resource["interaction"]]
        assert "search-type" in [i["code"] for i in patient_resource["interaction"]]


class TestSearchPatients:
    """Tests for GET /api/v1/fhir/Patient (search)."""

    @pytest.mark.asyncio
    async def test_search_patients_empty(self, client: AsyncClient, admin_auth_headers):
        """Search with no patients returns empty Bundle."""
        response = await client.get(
            "/api/v1/fhir/Patient",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["resourceType"] == "Bundle"
        assert data["type"] == "searchset"
        assert data["total"] == 0
        assert data["entry"] == []

    @pytest.mark.asyncio
    async def test_search_patients_by_family(
        self, client: AsyncClient, admin_auth_headers, sample_patient
    ):
        """Search by family name returns matching patients."""
        response = await client.get(
            "/api/v1/fhir/Patient?family=Perez",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["resourceType"] == "Bundle"
        assert data["total"] >= 1
        assert len(data["entry"]) >= 1

        # Check first result
        patient = data["entry"][0]["resource"]
        assert patient["resourceType"] == "Patient"
        assert patient["name"][0]["family"] == "Perez"

    @pytest.mark.asyncio
    async def test_search_patients_by_given(
        self, client: AsyncClient, admin_auth_headers, sample_patient
    ):
        """Search by given name returns matching patients."""
        response = await client.get(
            "/api/v1/fhir/Patient?given=Juan",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        patient = data["entry"][0]["resource"]
        assert "Juan" in patient["name"][0]["given"]

    @pytest.mark.asyncio
    async def test_search_patients_by_gender(
        self, client: AsyncClient, admin_auth_headers, sample_patient
    ):
        """Search by gender returns matching patients."""
        response = await client.get(
            "/api/v1/fhir/Patient?gender=male",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        patient = data["entry"][0]["resource"]
        assert patient["gender"] == "male"

    @pytest.mark.asyncio
    async def test_search_patients_pagination(
        self, client: AsyncClient, admin_auth_headers, sample_patient
    ):
        """Search respects _count and _offset parameters."""
        response = await client.get(
            "/api/v1/fhir/Patient?_count=1&_offset=0",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["entry"]) <= 1

    @pytest.mark.asyncio
    async def test_search_patients_without_auth_returns_403(self, client: AsyncClient):
        """Search without authentication returns 403."""
        response = await client.get("/api/v1/fhir/Patient")
        assert response.status_code == 403


class TestGetPatient:
    """Tests for GET /api/v1/fhir/Patient/{id}."""

    @pytest.mark.asyncio
    async def test_get_patient_by_id(
        self, client: AsyncClient, admin_auth_headers, sample_patient
    ):
        """Get patient by ID returns valid FHIR Patient."""
        patient_id = str(sample_patient.id)

        response = await client.get(
            f"/api/v1/fhir/Patient/{patient_id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["resourceType"] == "Patient"
        assert data["id"] == patient_id
        assert data["active"] is True
        assert len(data["identifier"]) >= 2  # MRN + document

        # Validate identifiers
        identifiers = {i["system"]: i["value"] for i in data["identifier"]}
        assert "urn:hmis:mrn" in identifiers
        assert identifiers["urn:hmis:mrn"] == sample_patient.mrn

        # Validate name
        assert len(data["name"]) == 1
        assert data["name"][0]["family"] == sample_patient.last_name
        assert sample_patient.first_name in data["name"][0]["given"]

        # Validate demographics
        assert data["gender"] == "male"
        assert data["birthDate"] == str(sample_patient.birth_date)

        # Validate telecom
        if data.get("telecom"):
            phone_values = [t["value"] for t in data["telecom"] if t["system"] == "phone"]
            assert sample_patient.mobile_phone in phone_values or sample_patient.phone in phone_values

    @pytest.mark.asyncio
    async def test_get_patient_not_found(self, client: AsyncClient, admin_auth_headers):
        """Get non-existent patient returns 404 OperationOutcome."""
        fake_id = str(uuid.uuid4())

        response = await client.get(
            f"/api/v1/fhir/Patient/{fake_id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["resourceType"] == "OperationOutcome"
        assert data["issue"][0]["severity"] == "error"
        assert "not-found" in data["issue"][0]["code"]

    @pytest.mark.asyncio
    async def test_get_patient_invalid_id(self, client: AsyncClient, admin_auth_headers):
        """Get patient with invalid UUID returns 400 OperationOutcome."""
        response = await client.get(
            "/api/v1/fhir/Patient/not-a-uuid",
            headers=admin_auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["resourceType"] == "OperationOutcome"
        assert data["issue"][0]["severity"] == "error"


class TestCreatePatient:
    """Tests for POST /api/v1/fhir/Patient."""

    @pytest.mark.asyncio
    async def test_create_patient_fhir(self, client: AsyncClient, admin_auth_headers):
        """Create patient from FHIR Patient resource returns 201 with Location."""
        fhir_patient = {
            "resourceType": "Patient",
            "identifier": [
                {"system": "urn:hmis:document:cedula", "value": "40112345678"}
            ],
            "name": [{"use": "official", "family": "Doe", "given": ["John"]}],
            "gender": "male",
            "birthDate": "1990-01-01",
            "active": True,
            "telecom": [
                {"system": "phone", "value": "809-555-1234", "use": "mobile"},
                {"system": "email", "value": "john.doe@example.com"},
            ],
            "address": [
                {
                    "use": "home",
                    "line": ["Calle Test #456"],
                    "city": "Santo Domingo",
                    "state": "Distrito Nacional",
                    "country": "DO",
                }
            ],
        }

        response = await client.post(
            "/api/v1/fhir/Patient",
            headers=admin_auth_headers,
            json=fhir_patient,
        )

        assert response.status_code == 201
        assert "Location" in response.headers

        data = response.json()
        assert data["resourceType"] == "Patient"
        assert "id" in data
        assert data["name"][0]["family"] == "Doe"
        assert "John" in data["name"][0]["given"]
        assert data["gender"] == "male"

        # Check MRN was generated
        mrn_identifiers = [i for i in data["identifier"] if i["system"] == "urn:hmis:mrn"]
        assert len(mrn_identifiers) == 1
        assert mrn_identifiers[0]["value"].startswith("MRN")

    @pytest.mark.asyncio
    async def test_create_patient_invalid_fhir(self, client: AsyncClient, admin_auth_headers):
        """Create patient with invalid FHIR returns 400 OperationOutcome."""
        invalid_fhir = {
            "resourceType": "Patient",
            # Missing required fields: name, identifier, birthDate
            "gender": "male",
        }

        response = await client.post(
            "/api/v1/fhir/Patient",
            headers=admin_auth_headers,
            json=invalid_fhir,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["resourceType"] == "OperationOutcome"
        assert data["issue"][0]["severity"] == "error"

    @pytest.mark.asyncio
    async def test_create_patient_duplicate_returns_409(
        self, client: AsyncClient, admin_auth_headers, sample_patient
    ):
        """Create patient with duplicate document returns 409 OperationOutcome."""
        fhir_patient = {
            "resourceType": "Patient",
            "identifier": [
                {
                    "system": f"urn:hmis:document:{sample_patient.document_type}",
                    "value": sample_patient.document_number,
                }
            ],
            "name": [{"use": "official", "family": "Duplicate", "given": ["Test"]}],
            "gender": "male",
            "birthDate": "1990-01-01",
            "active": True,
        }

        response = await client.post(
            "/api/v1/fhir/Patient",
            headers=admin_auth_headers,
            json=fhir_patient,
        )

        assert response.status_code == 409
        data = response.json()
        assert data["resourceType"] == "OperationOutcome"
        assert data["issue"][0]["severity"] == "error"
        assert "duplicate" in data["issue"][0]["code"]


class TestUpdatePatient:
    """Tests for PUT /api/v1/fhir/Patient/{id}."""

    @pytest.mark.asyncio
    async def test_update_patient_fhir(
        self, client: AsyncClient, admin_auth_headers, sample_patient
    ):
        """Update patient with FHIR Patient resource returns 200."""
        patient_id = str(sample_patient.id)

        # Get current patient
        get_response = await client.get(
            f"/api/v1/fhir/Patient/{patient_id}",
            headers=admin_auth_headers,
        )
        fhir_patient = get_response.json()

        # Modify address
        fhir_patient["address"] = [
            {
                "use": "home",
                "line": ["New Address #789"],
                "city": "Santiago",
                "state": "Santiago",
                "country": "DO",
            }
        ]

        # Update
        response = await client.put(
            f"/api/v1/fhir/Patient/{patient_id}",
            headers=admin_auth_headers,
            json=fhir_patient,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["resourceType"] == "Patient"
        assert data["id"] == patient_id
        assert data["address"][0]["city"] == "Santiago"
        assert "New Address #789" in data["address"][0]["line"]

    @pytest.mark.asyncio
    async def test_update_patient_not_found(self, client: AsyncClient, admin_auth_headers):
        """Update non-existent patient returns 404 OperationOutcome."""
        fake_id = str(uuid.uuid4())

        fhir_patient = {
            "resourceType": "Patient",
            "identifier": [{"system": "urn:hmis:document:cedula", "value": "99999999999"}],
            "name": [{"use": "official", "family": "NotFound", "given": ["Test"]}],
            "gender": "male",
            "birthDate": "1990-01-01",
            "active": True,
        }

        response = await client.put(
            f"/api/v1/fhir/Patient/{fake_id}",
            headers=admin_auth_headers,
            json=fhir_patient,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["resourceType"] == "OperationOutcome"
        assert data["issue"][0]["severity"] == "error"


class TestDeletePatient:
    """Tests for DELETE /api/v1/fhir/Patient/{id}."""

    @pytest.mark.asyncio
    async def test_delete_patient_fhir(
        self, client: AsyncClient, admin_auth_headers, sample_patient
    ):
        """Delete patient returns 204 No Content."""
        patient_id = str(sample_patient.id)

        response = await client.delete(
            f"/api/v1/fhir/Patient/{patient_id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 204

        # Verify patient is soft-deleted (not found in subsequent GET)
        get_response = await client.get(
            f"/api/v1/fhir/Patient/{patient_id}",
            headers=admin_auth_headers,
        )
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_patient_not_found(self, client: AsyncClient, admin_auth_headers):
        """Delete non-existent patient returns 404 OperationOutcome."""
        fake_id = str(uuid.uuid4())

        response = await client.delete(
            f"/api/v1/fhir/Patient/{fake_id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["resourceType"] == "OperationOutcome"
        assert data["issue"][0]["severity"] == "error"


# ============================================================================
# ENCOUNTER RESOURCE TESTS
# ============================================================================


class TestCapabilityStatementEncounter:
    """Tests that Encounter resource is advertised in CapabilityStatement."""

    @pytest.mark.asyncio
    async def test_capability_statement_includes_encounter(self, client: AsyncClient):
        """CapabilityStatement advertises Encounter resource with operations."""
        response = await client.get("/api/v1/fhir/metadata")

        assert response.status_code == 200
        data = response.json()

        # Check Encounter resource is advertised
        resources = data["rest"][0]["resource"]
        encounter_resource = next((r for r in resources if r["type"] == "Encounter"), None)
        assert encounter_resource is not None

        # Check operations
        interactions = [i["code"] for i in encounter_resource["interaction"]]
        assert "read" in interactions
        assert "create" in interactions
        assert "update" in interactions
        assert "search-type" in interactions

        # Check search parameters
        search_params = [p["name"] for p in encounter_resource["searchParam"]]
        assert "patient" in search_params
        assert "date" in search_params
        assert "type" in search_params
        assert "status" in search_params


class TestSearchEncounters:
    """Tests for GET /api/v1/fhir/Encounter (search)."""

    @pytest.mark.asyncio
    async def test_search_encounters_by_patient(
        self, client: AsyncClient, admin_auth_headers, sample_patient, sample_encounter
    ):
        """Search encounters by patient returns matching encounters."""
        response = await client.get(
            f"/api/v1/fhir/Encounter?patient=Patient/{sample_patient.id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["resourceType"] == "Bundle"
        assert data["type"] == "searchset"
        assert data["total"] >= 1
        assert len(data["entry"]) >= 1

        # Check first result
        encounter = data["entry"][0]["resource"]
        assert encounter["resourceType"] == "Encounter"
        assert encounter["subject"]["reference"] == f"Patient/{sample_patient.id}"

    @pytest.mark.asyncio
    async def test_search_encounters_by_status(
        self, client: AsyncClient, admin_auth_headers, sample_patient, sample_encounter
    ):
        """Search encounters by status returns matching encounters."""
        response = await client.get(
            f"/api/v1/fhir/Encounter?patient=Patient/{sample_patient.id}&status=in-progress",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

        # Check status mapping
        encounter = data["entry"][0]["resource"]
        assert encounter["status"] == "in-progress"

    @pytest.mark.asyncio
    async def test_search_encounters_by_type(
        self, client: AsyncClient, admin_auth_headers, sample_patient, sample_encounter
    ):
        """Search encounters by type returns matching encounters."""
        response = await client.get(
            f"/api/v1/fhir/Encounter?patient=Patient/{sample_patient.id}&type=ambulatory",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_search_encounters_pagination(
        self, client: AsyncClient, admin_auth_headers, sample_patient, sample_encounter
    ):
        """Search respects _count and _offset parameters."""
        response = await client.get(
            f"/api/v1/fhir/Encounter?patient=Patient/{sample_patient.id}&_count=1&_offset=0",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["entry"]) <= 1

    @pytest.mark.asyncio
    async def test_search_encounters_without_auth_returns_403(self, client: AsyncClient):
        """Search without authentication returns 403."""
        response = await client.get("/api/v1/fhir/Encounter")
        assert response.status_code == 403


class TestGetEncounter:
    """Tests for GET /api/v1/fhir/Encounter/{id}."""

    @pytest.mark.asyncio
    async def test_get_encounter_by_id(
        self, client: AsyncClient, admin_auth_headers, sample_encounter
    ):
        """Get encounter by ID returns valid FHIR Encounter."""
        encounter_id = str(sample_encounter.id)

        response = await client.get(
            f"/api/v1/fhir/Encounter/{encounter_id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["resourceType"] == "Encounter"
        assert data["id"] == encounter_id
        assert data["status"] in ["in-progress", "finished", "cancelled"]

        # Validate class (encounter type)
        assert "class" in data
        assert len(data["class"]) > 0
        assert data["class"][0]["coding"][0]["code"] in ["AMB", "EMER", "IMP"]

        # Validate subject (patient reference)
        assert "subject" in data
        assert "reference" in data["subject"]
        assert "Patient/" in data["subject"]["reference"]

        # Validate period
        assert "actualPeriod" in data
        assert "start" in data["actualPeriod"]

    @pytest.mark.asyncio
    async def test_get_encounter_not_found(self, client: AsyncClient, admin_auth_headers):
        """Get non-existent encounter returns 404 OperationOutcome."""
        fake_id = str(uuid.uuid4())

        response = await client.get(
            f"/api/v1/fhir/Encounter/{fake_id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["resourceType"] == "OperationOutcome"
        assert data["issue"][0]["severity"] == "error"
        assert "not-found" in data["issue"][0]["code"]

    @pytest.mark.asyncio
    async def test_get_encounter_invalid_id(self, client: AsyncClient, admin_auth_headers):
        """Get encounter with invalid UUID returns 400 OperationOutcome."""
        response = await client.get(
            "/api/v1/fhir/Encounter/not-a-uuid",
            headers=admin_auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["resourceType"] == "OperationOutcome"
        assert data["issue"][0]["severity"] == "error"


class TestCreateEncounter:
    """Tests for POST /api/v1/fhir/Encounter."""

    @pytest.mark.asyncio
    async def test_create_encounter_fhir(
        self, client: AsyncClient, admin_auth_headers, sample_patient
    ):
        """Create encounter from FHIR Encounter resource returns 201 with Location."""
        fhir_encounter = {
            "resourceType": "Encounter",
            "status": "in-progress",
            "class": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                            "code": "AMB",
                            "display": "Ambulatory",
                        }
                    ]
                }
            ],
            "subject": {"reference": f"Patient/{sample_patient.id}"},
            "actualPeriod": {"start": "2026-02-10T10:00:00Z"},
            "reason": [
                {
                    "value": [
                        {
                            "concept": {"text": "Consulta de rutina"}
                        }
                    ]
                }
            ],
        }

        response = await client.post(
            "/api/v1/fhir/Encounter",
            headers=admin_auth_headers,
            json=fhir_encounter,
        )

        assert response.status_code == 201
        assert "Location" in response.headers

        data = response.json()
        assert data["resourceType"] == "Encounter"
        assert "id" in data
        assert data["status"] == "in-progress"
        assert data["class"][0]["coding"][0]["code"] == "AMB"

    @pytest.mark.asyncio
    async def test_create_encounter_invalid_fhir(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Create encounter with invalid FHIR returns 400 OperationOutcome."""
        invalid_fhir = {
            "resourceType": "Encounter",
            "status": "invalid-status",  # Invalid status
            # Missing required fields: class, subject
        }

        response = await client.post(
            "/api/v1/fhir/Encounter",
            headers=admin_auth_headers,
            json=invalid_fhir,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["resourceType"] == "OperationOutcome"
        assert data["issue"][0]["severity"] == "error"

    @pytest.mark.asyncio
    async def test_create_encounter_nonexistent_patient_returns_404(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Create encounter with non-existent patient returns 404 OperationOutcome."""
        fake_patient_id = str(uuid.uuid4())

        fhir_encounter = {
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
            "subject": {"reference": f"Patient/{fake_patient_id}"},
            "actualPeriod": {"start": "2026-02-10T10:00:00Z"},
        }

        response = await client.post(
            "/api/v1/fhir/Encounter",
            headers=admin_auth_headers,
            json=fhir_encounter,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["resourceType"] == "OperationOutcome"
        assert data["issue"][0]["severity"] == "error"


class TestUpdateEncounter:
    """Tests for PUT /api/v1/fhir/Encounter/{id}."""

    @pytest.mark.asyncio
    async def test_update_encounter_fhir(
        self, client: AsyncClient, admin_auth_headers, sample_encounter
    ):
        """Update encounter with FHIR Encounter resource returns 200."""
        encounter_id = str(sample_encounter.id)

        # Get current encounter
        get_response = await client.get(
            f"/api/v1/fhir/Encounter/{encounter_id}",
            headers=admin_auth_headers,
        )
        fhir_encounter = get_response.json()

        # Modify status to finished
        fhir_encounter["status"] = "finished"
        fhir_encounter["actualPeriod"]["end"] = "2026-02-10T11:00:00Z"

        # Update
        response = await client.put(
            f"/api/v1/fhir/Encounter/{encounter_id}",
            headers=admin_auth_headers,
            json=fhir_encounter,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["resourceType"] == "Encounter"
        assert data["id"] == encounter_id
        assert data["status"] == "finished"
        assert data["actualPeriod"]["end"] is not None

    @pytest.mark.asyncio
    async def test_update_encounter_not_found(
        self, client: AsyncClient, admin_auth_headers, sample_patient
    ):
        """Update non-existent encounter returns 404 OperationOutcome."""
        fake_id = str(uuid.uuid4())

        fhir_encounter = {
            "resourceType": "Encounter",
            "status": "finished",
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
            "subject": {"reference": f"Patient/{sample_patient.id}"},
            "actualPeriod": {
                "start": "2026-02-10T10:00:00Z",
                "end": "2026-02-10T11:00:00Z",
            },
        }

        response = await client.put(
            f"/api/v1/fhir/Encounter/{fake_id}",
            headers=admin_auth_headers,
            json=fhir_encounter,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["resourceType"] == "OperationOutcome"
        assert data["issue"][0]["severity"] == "error"


class TestObservationSearch:
    """Tests for GET /api/v1/fhir/Observation (search)."""

    @pytest.mark.asyncio
    async def test_search_observations_by_patient(
        self, client: AsyncClient, admin_auth_headers, sample_vital_signs
    ):
        """Search observations by patient returns FHIR Bundle with observations."""
        patient_ref = f"Patient/{sample_vital_signs.patient_id}"
        response = await client.get(
            f"/api/v1/fhir/Observation?patient={patient_ref}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["resourceType"] == "Bundle"
        assert data["type"] == "searchset"
        assert data["total"] == 10  # 10 vital sign observations
        assert len(data["entry"]) == 10

        # Verify first observation structure
        obs = data["entry"][0]["resource"]
        assert obs["resourceType"] == "Observation"
        assert "id" in obs
        assert "code" in obs
        assert "subject" in obs
        assert obs["subject"]["reference"] == patient_ref

    @pytest.mark.asyncio
    async def test_search_observations_by_encounter(
        self, client: AsyncClient, admin_auth_headers, sample_vital_signs
    ):
        """Search observations by encounter returns matching observations."""
        encounter_ref = f"Encounter/{sample_vital_signs.encounter_id}"
        response = await client.get(
            f"/api/v1/fhir/Observation?encounter={encounter_ref}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 10

        # Verify all observations have correct encounter reference
        for entry in data["entry"]:
            obs = entry["resource"]
            assert obs["encounter"]["reference"] == encounter_ref

    @pytest.mark.asyncio
    async def test_search_observations_by_category(
        self, client: AsyncClient, admin_auth_headers, sample_vital_signs
    ):
        """Search observations by category filters correctly."""
        patient_ref = f"Patient/{sample_vital_signs.patient_id}"

        # Search for vital-signs category only
        response = await client.get(
            f"/api/v1/fhir/Observation?patient={patient_ref}&category=vital-signs",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 9  # All except glucose

        # Verify all are vital-signs category
        for entry in data["entry"]:
            obs = entry["resource"]
            categories = [cat["coding"][0]["code"] for cat in obs["category"]]
            assert "vital-signs" in categories

    @pytest.mark.asyncio
    async def test_search_observations_by_loinc_code(
        self, client: AsyncClient, admin_auth_headers, sample_vital_signs
    ):
        """Search observations by LOINC code returns specific observation type."""
        patient_ref = f"Patient/{sample_vital_signs.patient_id}"

        # Search for temperature (LOINC 8310-5)
        response = await client.get(
            f"/api/v1/fhir/Observation?patient={patient_ref}&code=8310-5",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

        # Verify it's temperature
        obs = data["entry"][0]["resource"]
        assert obs["code"]["coding"][0]["code"] == "8310-5"
        assert obs["code"]["coding"][0]["display"] == "Body temperature"

    @pytest.mark.asyncio
    async def test_search_observations_with_pagination(
        self, client: AsyncClient, admin_auth_headers, sample_vital_signs
    ):
        """Pagination parameters work correctly."""
        patient_ref = f"Patient/{sample_vital_signs.patient_id}"

        # Get first page (5 items)
        response = await client.get(
            f"/api/v1/fhir/Observation?patient={patient_ref}&_count=5&_offset=0",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 10
        assert len(data["entry"]) == 5

        # Get second page (5 items)
        response = await client.get(
            f"/api/v1/fhir/Observation?patient={patient_ref}&_count=5&_offset=5",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 10
        assert len(data["entry"]) == 5

    @pytest.mark.asyncio
    async def test_search_observations_requires_auth(
        self, client: AsyncClient, sample_vital_signs
    ):
        """Search observations without auth returns 401."""
        patient_ref = f"Patient/{sample_vital_signs.patient_id}"
        response = await client.get(
            f"/api/v1/fhir/Observation?patient={patient_ref}",
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_search_observations_empty_result(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Search with no matching observations returns empty Bundle."""
        fake_patient_id = uuid.uuid4()
        response = await client.get(
            f"/api/v1/fhir/Observation?patient=Patient/{fake_patient_id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["resourceType"] == "Bundle"
        assert data["total"] == 0
        assert data["entry"] == []


class TestObservationGet:
    """Tests for GET /api/v1/fhir/Observation/{id}."""

    @pytest.mark.asyncio
    async def test_get_observation_by_id(
        self, client: AsyncClient, admin_auth_headers, sample_vital_signs
    ):
        """Get single observation by composite ID returns FHIR Observation."""
        obs_id = f"{sample_vital_signs.id}-temp"
        response = await client.get(
            f"/api/v1/fhir/Observation/{obs_id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["resourceType"] == "Observation"
        assert data["id"] == obs_id
        assert data["code"]["coding"][0]["code"] == "8310-5"  # Temperature LOINC
        assert data["valueQuantity"]["value"] == 37.2
        assert data["valueQuantity"]["unit"] == "Cel"

    @pytest.mark.asyncio
    async def test_get_blood_pressure_observation(
        self, client: AsyncClient, admin_auth_headers, sample_vital_signs
    ):
        """Blood pressure observation is returned as panel with components."""
        obs_id = f"{sample_vital_signs.id}-bp"
        response = await client.get(
            f"/api/v1/fhir/Observation/{obs_id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["code"]["coding"][0]["code"] == "85354-9"  # BP panel LOINC
        assert data["component"] is not None
        assert len(data["component"]) == 2

        # Check systolic component
        sys_component = data["component"][0]
        assert sys_component["code"]["coding"][0]["code"] == "8480-6"
        assert sys_component["valueQuantity"]["value"] == 120

    @pytest.mark.asyncio
    async def test_get_observation_not_found(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Get observation with non-existent ID returns 404."""
        fake_id = f"{uuid.uuid4()}-temp"
        response = await client.get(
            f"/api/v1/fhir/Observation/{fake_id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["resourceType"] == "OperationOutcome"
        assert data["issue"][0]["severity"] == "error"

    @pytest.mark.asyncio
    async def test_get_observation_requires_auth(self, client: AsyncClient, sample_vital_signs):
        """Get observation without auth returns 401."""
        obs_id = f"{sample_vital_signs.id}-temp"
        response = await client.get(f"/api/v1/fhir/Observation/{obs_id}")

        assert response.status_code == 401
