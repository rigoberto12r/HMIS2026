"""
Integration tests for C-CDA R2.1 API endpoints (/api/v1/ccda).

Tests CCD generation, download, and preview endpoints.
"""

import uuid

import pytest
from httpx import AsyncClient


class TestCCDGeneration:
    """Tests for GET /api/v1/ccda/patients/{id}/ccd."""

    @pytest.mark.asyncio
    async def test_get_patient_ccd_download(
        self, client: AsyncClient, admin_auth_headers, sample_patient
    ):
        """Generate and download CCD for a patient."""
        patient_id = str(sample_patient.id)
        response = await client.get(
            f"/api/v1/ccda/patients/{patient_id}/ccd",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        assert "application/xml" in response.headers["content-type"]
        assert "attachment" in response.headers["content-disposition"]
        assert "X-Document-Type" in response.headers
        assert response.headers["X-Document-Type"] == "C-CDA-R2.1-CCD"

        # Verify XML content
        xml_content = response.text
        assert xml_content.startswith('<?xml version=')
        assert 'encoding=' in xml_content[:100]  # Check encoding in first 100 chars
        assert "<ClinicalDocument" in xml_content
        assert 'xmlns="urn:hl7-org:v3"' in xml_content
        assert "</ClinicalDocument>" in xml_content

        # Check for required sections
        assert "<section>" in xml_content  # Has sections
        assert "<structuredBody>" in xml_content

    @pytest.mark.asyncio
    async def test_get_patient_ccd_preview(
        self, client: AsyncClient, admin_auth_headers, sample_patient
    ):
        """Preview CCD in browser (inline disposition)."""
        patient_id = str(sample_patient.id)
        response = await client.get(
            f"/api/v1/ccda/patients/{patient_id}/ccd/preview",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        assert "application/xml" in response.headers["content-type"]
        # Preview should use inline disposition
        assert "inline" in response.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_get_patient_ccd_not_found(
        self, client: AsyncClient, admin_auth_headers
    ):
        """CCD generation fails for non-existent patient."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/v1/ccda/patients/{fake_id}/ccd",
            headers=admin_auth_headers,
        )

        assert response.status_code == 404
        assert "not found" in response.text.lower()

    @pytest.mark.asyncio
    async def test_get_patient_ccd_invalid_uuid(
        self, client: AsyncClient, admin_auth_headers
    ):
        """CCD generation fails for invalid patient ID format."""
        response = await client.get(
            "/api/v1/ccda/patients/invalid-id/ccd",
            headers=admin_auth_headers,
        )

        assert response.status_code == 400
        assert "Invalid" in response.text

    @pytest.mark.asyncio
    async def test_get_patient_ccd_requires_auth(self, client: AsyncClient, sample_patient):
        """CCD endpoint requires authentication."""
        patient_id = str(sample_patient.id)
        response = await client.get(
            f"/api/v1/ccda/patients/{patient_id}/ccd",
            # No auth headers
        )

        assert response.status_code == 401
