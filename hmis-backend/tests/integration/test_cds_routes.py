"""
Integration tests for CDS (Clinical Decision Support) API endpoints.

Tests cover:
- POST /api/v1/cds/check — medication safety check
- POST /api/v1/cds/overrides — record alert override
- GET /api/v1/cds/overrides/patient/{id} — override history
- GET /api/v1/cds/interactions — list interactions
- POST /api/v1/cds/interactions — create interaction (admin only)
- DELETE /api/v1/cds/interactions/{id} — delete interaction (admin only)
- GET /api/v1/cds/cds-services — CDS Hooks discovery
- POST /api/v1/cds/cds-services/{id} — CDS Hooks invocation
"""

import uuid

import pytest


# ============================================================
# CDS Hooks Discovery (no auth required)
# ============================================================


class TestCDSHooksDiscovery:
    @pytest.mark.asyncio
    async def test_cds_services_discovery(self, client):
        """GET /cds-services returns valid CDS Hooks discovery JSON."""
        resp = await client.get(
            "/api/v1/cds/cds-services",
            headers={"X-Tenant-ID": "tenant_test"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "services" in data
        assert len(data["services"]) == 2

        service_ids = [s["id"] for s in data["services"]]
        assert "hmis-drug-interaction-check" in service_ids
        assert "hmis-prescription-safety-check" in service_ids

        # Verify structure per CDS Hooks spec
        for svc in data["services"]:
            assert "hook" in svc
            assert "title" in svc
            assert "description" in svc
            assert "id" in svc

    @pytest.mark.asyncio
    async def test_cds_hooks_invoke_unknown_service(self, client):
        """Invoking unknown CDS service returns empty cards."""
        resp = await client.post(
            "/api/v1/cds/cds-services/unknown-service",
            json={
                "hookInstance": str(uuid.uuid4()),
                "hook": "order-select",
                "context": {"patientId": str(uuid.uuid4())},
            },
            headers={"X-Tenant-ID": "tenant_test"},
        )
        assert resp.status_code == 200
        assert resp.json()["cards"] == []

    @pytest.mark.asyncio
    async def test_cds_hooks_invoke_no_patient_id(self, client):
        """Invoking CDS hook without patientId returns empty cards."""
        resp = await client.post(
            "/api/v1/cds/cds-services/hmis-drug-interaction-check",
            json={
                "hookInstance": str(uuid.uuid4()),
                "hook": "order-select",
                "context": {},
            },
            headers={"X-Tenant-ID": "tenant_test"},
        )
        assert resp.status_code == 200
        assert resp.json()["cards"] == []

    @pytest.mark.asyncio
    async def test_cds_hooks_invoke_with_draft_orders(self, client, db_session):
        """CDS Hooks invocation processes draftOrders and returns cards."""
        from app.modules.cds.models import DrugInteraction
        from app.modules.pharmacy.models import Prescription

        patient_id = uuid.uuid4()
        prescriber_id = uuid.uuid4()

        # Create active prescription
        rx = Prescription(
            encounter_id=uuid.uuid4(),
            patient_id=patient_id,
            prescribed_by=prescriber_id,
            product_id=uuid.uuid4(),
            medication_name="Warfarina",
            dosage="5mg",
            frequency="daily",
            route="oral",
            quantity_prescribed=30,
            status="active",
            created_by=prescriber_id,
        )
        db_session.add(rx)

        # Create interaction
        interaction = DrugInteraction(
            drug_a_name="Warfarina",
            drug_b_name="Aspirina",
            severity="major",
            interaction_type="pharmacodynamic",
            description="Increased bleeding risk",
            clinical_significance="Monitor INR closely",
            management="Use with caution",
            evidence_level="established",
            source="local_kb",
        )
        db_session.add(interaction)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/cds/cds-services/hmis-drug-interaction-check",
            json={
                "hookInstance": str(uuid.uuid4()),
                "hook": "order-select",
                "context": {
                    "patientId": str(patient_id),
                    "draftOrders": {
                        "resourceType": "Bundle",
                        "entry": [
                            {
                                "resource": {
                                    "resourceType": "MedicationRequest",
                                    "medicationCodeableConcept": {
                                        "text": "Aspirina",
                                    },
                                }
                            }
                        ],
                    },
                },
            },
            headers={"X-Tenant-ID": "tenant_test"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["cards"]) >= 1
        assert any("Warfarina" in c.get("summary", "") or "Warfarina" in c.get("detail", "") for c in data["cards"])


# ============================================================
# CDS Medication Check (requires auth)
# ============================================================


class TestCDSCheck:
    @pytest.mark.asyncio
    async def test_check_requires_auth(self, client):
        """POST /cds/check returns 401 without auth."""
        resp = await client.post(
            "/api/v1/cds/check",
            json={
                "patient_id": str(uuid.uuid4()),
                "medication_name": "Aspirina",
            },
            headers={"X-Tenant-ID": "tenant_test"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_check_no_alerts(self, client, medico_auth_headers):
        """POST /cds/check returns 200 with no alerts for unknown patient."""
        resp = await client.post(
            "/api/v1/cds/check",
            json={
                "patient_id": str(uuid.uuid4()),
                "medication_name": "Vitamina C",
            },
            headers=medico_auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_alerts"] == 0
        assert data["alerts"] == []
        assert data["has_critical"] is False
        assert data["has_major"] is False
        assert data["medication_name"] == "Vitamina C"

    @pytest.mark.asyncio
    async def test_check_detects_interaction(self, client, medico_auth_headers, db_session):
        """POST /cds/check detects seeded drug interaction."""
        from app.modules.cds.models import DrugInteraction
        from app.modules.pharmacy.models import Prescription

        patient_id = uuid.uuid4()
        prescriber_id = uuid.uuid4()

        # Active Rx for Warfarina
        rx = Prescription(
            encounter_id=uuid.uuid4(),
            patient_id=patient_id,
            prescribed_by=prescriber_id,
            product_id=uuid.uuid4(),
            medication_name="Warfarina",
            dosage="5mg",
            frequency="daily",
            route="oral",
            quantity_prescribed=30,
            status="active",
            created_by=prescriber_id,
        )
        db_session.add(rx)

        interaction = DrugInteraction(
            drug_a_name="Warfarina",
            drug_b_name="Aspirina",
            severity="major",
            interaction_type="pharmacodynamic",
            description="Increased bleeding risk",
            clinical_significance="Monitor INR closely",
            management="Use with caution",
            evidence_level="established",
            source="local_kb",
        )
        db_session.add(interaction)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/cds/check",
            json={
                "patient_id": str(patient_id),
                "medication_name": "Aspirina",
            },
            headers=medico_auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_alerts"] >= 1
        assert data["has_major"] is True

        interaction_alerts = [a for a in data["alerts"] if a["alert_type"] == "drug_interaction"]
        assert len(interaction_alerts) >= 1
        assert interaction_alerts[0]["severity"] == "major"


# ============================================================
# CDS Alert Override (audit trail)
# ============================================================


class TestCDSOverrides:
    @pytest.mark.asyncio
    async def test_override_requires_auth(self, client):
        """POST /cds/overrides returns 401 without auth."""
        resp = await client.post(
            "/api/v1/cds/overrides",
            json={
                "prescription_id": str(uuid.uuid4()),
                "patient_id": str(uuid.uuid4()),
                "alert_type": "drug_interaction",
                "alert_severity": "major",
                "alert_summary": "Test override",
                "override_reason": "Clinical necessity - patient stable on this combination",
            },
            headers={"X-Tenant-ID": "tenant_test"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_record_override(self, client, medico_auth_headers):
        """POST /cds/overrides returns 201 with override record."""
        patient_id = str(uuid.uuid4())
        resp = await client.post(
            "/api/v1/cds/overrides",
            json={
                "prescription_id": str(uuid.uuid4()),
                "patient_id": patient_id,
                "alert_type": "drug_interaction",
                "alert_severity": "major",
                "alert_summary": "Warfarina + Aspirina interaction",
                "override_reason": "Clinical necessity - patient stable on this combination for 2 years",
            },
            headers=medico_auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["alert_type"] == "drug_interaction"
        assert data["alert_severity"] == "major"
        assert data["patient_id"] == patient_id
        assert "id" in data
        assert "overridden_by" in data

    @pytest.mark.asyncio
    async def test_override_history(self, client, medico_auth_headers):
        """GET /cds/overrides/patient/{id} returns override history."""
        patient_id = str(uuid.uuid4())

        # Create 2 overrides
        for i in range(2):
            await client.post(
                "/api/v1/cds/overrides",
                json={
                    "prescription_id": str(uuid.uuid4()),
                    "patient_id": patient_id,
                    "alert_type": "drug_interaction",
                    "alert_severity": "major",
                    "alert_summary": f"Override {i}",
                    "override_reason": f"Clinical reason for override number {i} is documented",
                },
                headers=medico_auth_headers,
            )

        resp = await client.get(
            f"/api/v1/cds/overrides/patient/{patient_id}",
            headers=medico_auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2


# ============================================================
# Drug Interactions CRUD
# ============================================================


class TestInteractionsCRUD:
    @pytest.mark.asyncio
    async def test_list_interactions(self, client, medico_auth_headers):
        """GET /cds/interactions returns paginated list."""
        resp = await client.get(
            "/api/v1/cds/interactions",
            headers=medico_auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data

    @pytest.mark.asyncio
    async def test_create_interaction_admin_only(self, client, medico_auth_headers):
        """POST /cds/interactions requires admin role."""
        resp = await client.post(
            "/api/v1/cds/interactions",
            json={
                "drug_a_name": "TestDrugA",
                "drug_b_name": "TestDrugB",
                "severity": "moderate",
                "interaction_type": "pharmacokinetic",
                "description": "Test interaction",
                "clinical_significance": "Test significance",
            },
            headers=medico_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_create_interaction_as_admin(self, client, admin_auth_headers):
        """POST /cds/interactions creates interaction (admin)."""
        resp = await client.post(
            "/api/v1/cds/interactions",
            json={
                "drug_a_name": "TestDrugA",
                "drug_b_name": "TestDrugB",
                "severity": "moderate",
                "interaction_type": "pharmacokinetic",
                "description": "Test interaction for integration test",
                "clinical_significance": "Test clinical significance",
                "management": "Monitor closely",
                "evidence_level": "established",
            },
            headers=admin_auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["drug_a_name"] == "TestDrugA"
        assert data["drug_b_name"] == "TestDrugB"
        assert data["severity"] == "moderate"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_delete_interaction_as_admin(self, client, admin_auth_headers):
        """DELETE /cds/interactions/{id} soft-deletes (admin)."""
        # Create first
        create_resp = await client.post(
            "/api/v1/cds/interactions",
            json={
                "drug_a_name": "ToDeleteA",
                "drug_b_name": "ToDeleteB",
                "severity": "minor",
                "interaction_type": "additive",
                "description": "To be deleted",
                "clinical_significance": "Test",
            },
            headers=admin_auth_headers,
        )
        assert create_resp.status_code == 201
        interaction_id = create_resp.json()["id"]

        # Delete
        delete_resp = await client.delete(
            f"/api/v1/cds/interactions/{interaction_id}",
            headers=admin_auth_headers,
        )
        assert delete_resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_nonexistent_interaction(self, client, admin_auth_headers):
        """DELETE /cds/interactions/{id} returns 404 for unknown ID."""
        resp = await client.delete(
            f"/api/v1/cds/interactions/{uuid.uuid4()}",
            headers=admin_auth_headers,
        )
        assert resp.status_code == 404
