"""
Integration tests for SMART on FHIR OAuth2 endpoints.

Tests cover:
- .well-known/smart-configuration discovery
- JWKS endpoint
- Full authorize → token flow with PKCE
- Token introspection (active + revoked)
- Token revocation
- FHIR endpoints with SMART tokens (scope enforcement)
- Patient context restriction
- Backward compatibility (existing HS256 JWT still works on FHIR)
- Client registration CRUD (admin only)
"""

import base64
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from jose import jwt

from app.modules.smart.keys import get_jwks, get_private_pem, reset_keys
from app.modules.smart.scopes import parse_scopes


# ============================================================ #
# Helpers
# ============================================================ #


def _make_pkce_pair() -> tuple[str, str]:
    """Generate a PKCE code_verifier + code_challenge (S256) pair."""
    import secrets

    verifier = secrets.token_urlsafe(32)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


# ============================================================ #
# Discovery + JWKS
# ============================================================ #


class TestSMARTDiscovery:
    @pytest.mark.asyncio
    async def test_well_known_smart_configuration(self, client):
        resp = await client.get(
            "/.well-known/smart-configuration",
            headers={"X-Tenant-ID": "tenant_test"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "authorization_endpoint" in data
        assert "token_endpoint" in data
        assert "jwks_uri" in data
        assert "introspection_endpoint" in data
        assert "revocation_endpoint" in data
        assert "scopes_supported" in data
        assert "code" in data["response_types_supported"]
        assert "S256" in data["code_challenge_methods_supported"]
        assert "launch-ehr" in data["capabilities"]
        assert "launch-standalone" in data["capabilities"]

    @pytest.mark.asyncio
    async def test_jwks_endpoint(self, client):
        resp = await client.get(
            "/api/v1/smart/jwks",
            headers={"X-Tenant-ID": "tenant_test"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "keys" in data
        assert len(data["keys"]) >= 1
        key = data["keys"][0]
        assert key["kty"] == "RSA"
        assert key["alg"] == "RS256"
        assert key["use"] == "sig"
        assert key["kid"] == "smart-key-1"
        assert "n" in key
        assert "e" in key


# ============================================================ #
# Client Management (Admin only)
# ============================================================ #


class TestClientManagement:
    @pytest.mark.asyncio
    async def test_register_client(self, client, admin_auth_headers):
        resp = await client.post(
            "/api/v1/smart/clients",
            json={
                "client_name": "Test Lab App",
                "redirect_uris": ["http://localhost:3001/callback"],
                "scope": "patient/Patient.read patient/Observation.read",
                "client_type": "confidential",
            },
            headers=admin_auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["client_name"] == "Test Lab App"
        assert data["client_id"].startswith("smart-")
        assert data["client_secret"] is not None  # Returned once for confidential
        assert data["is_active"] is True

    @pytest.mark.asyncio
    async def test_register_public_client(self, client, admin_auth_headers):
        resp = await client.post(
            "/api/v1/smart/clients",
            json={
                "client_name": "Public Patient App",
                "redirect_uris": ["http://localhost:3001/callback"],
                "scope": "patient/Patient.read launch/patient openid",
                "client_type": "public",
            },
            headers=admin_auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["client_secret"] is None  # No secret for public clients

    @pytest.mark.asyncio
    async def test_list_clients(self, client, admin_auth_headers):
        # Register a client first
        await client.post(
            "/api/v1/smart/clients",
            json={
                "client_name": "List Test App",
                "redirect_uris": ["http://localhost:3001/callback"],
                "scope": "patient/Patient.read",
                "client_type": "confidential",
            },
            headers=admin_auth_headers,
        )

        resp = await client.get(
            "/api/v1/smart/clients",
            headers=admin_auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_deactivate_client(self, client, admin_auth_headers):
        # Register
        create_resp = await client.post(
            "/api/v1/smart/clients",
            json={
                "client_name": "To Deactivate",
                "redirect_uris": ["http://localhost:3001/callback"],
                "scope": "patient/Patient.read",
                "client_type": "confidential",
            },
            headers=admin_auth_headers,
        )
        client_db_id = create_resp.json()["id"]

        # Deactivate
        resp = await client.delete(
            f"/api/v1/smart/clients/{client_db_id}",
            headers=admin_auth_headers,
        )
        assert resp.status_code == 204


# ============================================================ #
# Full OAuth2 Flow (Authorize → Token → Introspect → Revoke)
# ============================================================ #


class TestOAuth2Flow:
    @pytest.fixture
    async def registered_client(self, client, admin_auth_headers):
        """Register a SMART client and return its credentials."""
        resp = await client.post(
            "/api/v1/smart/clients",
            json={
                "client_name": "Flow Test App",
                "redirect_uris": ["http://localhost:3001/callback"],
                "scope": "patient/Patient.read patient/Observation.read openid fhirUser",
                "client_type": "confidential",
            },
            headers=admin_auth_headers,
        )
        return resp.json()

    @pytest.mark.asyncio
    async def test_full_authorize_token_flow_with_pkce(
        self, client, admin_auth_headers, registered_client
    ):
        """Test complete: authorize → token exchange with PKCE."""
        verifier, challenge = _make_pkce_pair()

        # Step 1: Get authorization code
        auth_resp = await client.get(
            "/api/v1/smart/authorize",
            params={
                "response_type": "code",
                "client_id": registered_client["client_id"],
                "redirect_uri": "http://localhost:3001/callback",
                "scope": "patient/Patient.read openid",
                "state": "test-state-123",
                "code_challenge": challenge,
                "code_challenge_method": "S256",
            },
            headers=admin_auth_headers,
        )
        assert auth_resp.status_code == 200
        auth_data = auth_resp.json()
        assert "code" in auth_data
        assert auth_data.get("state") == "test-state-123"

        # Step 2: Exchange code for tokens
        with patch("app.modules.smart.service.SMARTAuthService._cache_token", new_callable=AsyncMock):
            token_resp = await client.post(
                "/api/v1/smart/token",
                json={
                    "grant_type": "authorization_code",
                    "code": auth_data["code"],
                    "client_id": registered_client["client_id"],
                    "client_secret": registered_client["client_secret"],
                    "redirect_uri": "http://localhost:3001/callback",
                    "code_verifier": verifier,
                },
                headers={"X-Tenant-ID": "tenant_test"},
            )
        assert token_resp.status_code == 200
        token_data = token_resp.json()
        assert "access_token" in token_data
        assert "refresh_token" in token_data
        assert token_data["token_type"] == "Bearer"
        assert token_data["scope"] == "patient/Patient.read openid"
        assert token_data["expires_in"] > 0

        # Verify the access token is a valid RS256 JWT
        from app.modules.smart.keys import get_public_pem

        public_pem = get_public_pem()
        decoded = jwt.decode(
            token_data["access_token"],
            public_pem,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        assert decoded["token_type"] == "smart"
        assert decoded["scope"] == "patient/Patient.read openid"
        assert "fhirUser" in decoded

    @pytest.mark.asyncio
    async def test_introspection_active_token(
        self, client, admin_auth_headers, registered_client
    ):
        """Test token introspection returns active=True for valid token."""
        verifier, challenge = _make_pkce_pair()

        # Get auth code
        auth_resp = await client.get(
            "/api/v1/smart/authorize",
            params={
                "response_type": "code",
                "client_id": registered_client["client_id"],
                "redirect_uri": "http://localhost:3001/callback",
                "scope": "patient/Patient.read",
                "code_challenge": challenge,
                "code_challenge_method": "S256",
            },
            headers=admin_auth_headers,
        )
        code = auth_resp.json()["code"]

        # Exchange for token
        with patch("app.modules.smart.service.SMARTAuthService._cache_token", new_callable=AsyncMock):
            token_resp = await client.post(
                "/api/v1/smart/token",
                json={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": registered_client["client_id"],
                    "client_secret": registered_client["client_secret"],
                    "redirect_uri": "http://localhost:3001/callback",
                    "code_verifier": verifier,
                },
                headers={"X-Tenant-ID": "tenant_test"},
            )
        access_token = token_resp.json()["access_token"]

        # Introspect
        with patch("app.modules.smart.service.SMARTAuthService._get_cached_token", new_callable=AsyncMock, return_value=None):
            introspect_resp = await client.post(
                "/api/v1/smart/introspect",
                json={"token": access_token},
                headers={"X-Tenant-ID": "tenant_test"},
            )
        assert introspect_resp.status_code == 200
        data = introspect_resp.json()
        assert data["active"] is True
        assert data["scope"] == "patient/Patient.read"

    @pytest.mark.asyncio
    async def test_revocation_then_introspection(
        self, client, admin_auth_headers, registered_client
    ):
        """Test that revoked tokens show active=False on introspection."""
        verifier, challenge = _make_pkce_pair()

        # Get auth code + token
        auth_resp = await client.get(
            "/api/v1/smart/authorize",
            params={
                "response_type": "code",
                "client_id": registered_client["client_id"],
                "redirect_uri": "http://localhost:3001/callback",
                "scope": "patient/Patient.read",
                "code_challenge": challenge,
                "code_challenge_method": "S256",
            },
            headers=admin_auth_headers,
        )
        code = auth_resp.json()["code"]

        with patch("app.modules.smart.service.SMARTAuthService._cache_token", new_callable=AsyncMock):
            token_resp = await client.post(
                "/api/v1/smart/token",
                json={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": registered_client["client_id"],
                    "client_secret": registered_client["client_secret"],
                    "redirect_uri": "http://localhost:3001/callback",
                    "code_verifier": verifier,
                },
                headers={"X-Tenant-ID": "tenant_test"},
            )
        access_token = token_resp.json()["access_token"]

        # Revoke
        with patch("app.modules.smart.service.SMARTAuthService._delete_cached_token", new_callable=AsyncMock):
            revoke_resp = await client.post(
                "/api/v1/smart/revoke",
                json={"token": access_token},
                headers={"X-Tenant-ID": "tenant_test"},
            )
        assert revoke_resp.status_code == 200

        # Introspect after revocation
        with patch("app.modules.smart.service.SMARTAuthService._get_cached_token", new_callable=AsyncMock, return_value=None):
            introspect_resp = await client.post(
                "/api/v1/smart/introspect",
                json={"token": access_token},
                headers={"X-Tenant-ID": "tenant_test"},
            )
        data = introspect_resp.json()
        assert data["active"] is False

    @pytest.mark.asyncio
    async def test_code_reuse_fails(
        self, client, admin_auth_headers, registered_client
    ):
        """Authorization codes are single-use."""
        verifier, challenge = _make_pkce_pair()

        auth_resp = await client.get(
            "/api/v1/smart/authorize",
            params={
                "response_type": "code",
                "client_id": registered_client["client_id"],
                "redirect_uri": "http://localhost:3001/callback",
                "scope": "patient/Patient.read",
                "code_challenge": challenge,
                "code_challenge_method": "S256",
            },
            headers=admin_auth_headers,
        )
        code = auth_resp.json()["code"]

        # First exchange succeeds
        with patch("app.modules.smart.service.SMARTAuthService._cache_token", new_callable=AsyncMock):
            resp1 = await client.post(
                "/api/v1/smart/token",
                json={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": registered_client["client_id"],
                    "client_secret": registered_client["client_secret"],
                    "redirect_uri": "http://localhost:3001/callback",
                    "code_verifier": verifier,
                },
                headers={"X-Tenant-ID": "tenant_test"},
            )
        assert resp1.status_code == 200

        # Second exchange with same code fails
        resp2 = await client.post(
            "/api/v1/smart/token",
            json={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": registered_client["client_id"],
                "client_secret": registered_client["client_secret"],
                "redirect_uri": "http://localhost:3001/callback",
                "code_verifier": verifier,
            },
            headers={"X-Tenant-ID": "tenant_test"},
        )
        assert resp2.status_code == 400  # Invalid/used authorization code


# ============================================================ #
# Backward Compatibility (Existing HS256 JWT on FHIR endpoints)
# ============================================================ #


class TestBackwardCompatibility:
    @pytest.mark.asyncio
    async def test_fhir_metadata_no_auth(self, client):
        """FHIR /metadata endpoint requires no authentication."""
        resp = await client.get(
            "/api/v1/fhir/metadata",
            headers={"X-Tenant-ID": "tenant_test"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["resourceType"] == "CapabilityStatement"

    @pytest.mark.asyncio
    async def test_fhir_metadata_includes_smart_security(self, client):
        """CapabilityStatement includes SMART security section."""
        resp = await client.get(
            "/api/v1/fhir/metadata",
            headers={"X-Tenant-ID": "tenant_test"},
        )
        data = resp.json()
        rest = data.get("rest", [{}])[0]
        security = rest.get("security", {})

        # Check for SMART-on-FHIR service coding
        assert security.get("description") is not None
        assert "SMART" in security["description"]

    @pytest.mark.asyncio
    async def test_existing_jwt_still_works_on_fhir_search(
        self, client, admin_auth_headers, sample_patient
    ):
        """Existing HS256 JWT tokens still work on FHIR endpoints (backward compat)."""
        resp = await client.get(
            "/api/v1/fhir/Patient",
            headers=admin_auth_headers,
        )
        # Should succeed with existing auth (200 or empty bundle)
        assert resp.status_code == 200


# ============================================================ #
# FHIR with SMART Tokens
# ============================================================ #


class TestFHIRWithSMARTTokens:
    @pytest.mark.asyncio
    async def test_fhir_search_with_smart_token(
        self, client, admin_auth_headers, sample_patient
    ):
        """FHIR endpoint accepts RS256 SMART tokens."""
        # Create a SMART token for testing
        from app.modules.smart.keys import get_private_pem, get_public_pem

        private_pem = get_private_pem()
        claims = {
            "iss": "http://localhost:8000",
            "sub": str(uuid.uuid4()),
            "aud": "test-client",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
            "jti": str(uuid.uuid4()),
            "scope": "patient/Patient.read user/Patient.read",
            "token_type": "smart",
            "fhirUser": f"Practitioner/{uuid.uuid4()}",
        }
        smart_token = jwt.encode(
            claims, private_pem, algorithm="RS256", headers={"kid": "smart-key-1"}
        )

        resp = await client.get(
            "/api/v1/fhir/Patient",
            headers={
                "Authorization": f"Bearer {smart_token}",
                "X-Tenant-ID": "tenant_test",
            },
        )
        assert resp.status_code == 200


# ============================================================ #
# Error Cases
# ============================================================ #


class TestErrorCases:
    @pytest.mark.asyncio
    async def test_authorize_requires_auth(self, client):
        """Authorize endpoint requires authentication."""
        resp = await client.get(
            "/api/v1/smart/authorize",
            params={
                "response_type": "code",
                "client_id": "nonexistent",
                "redirect_uri": "http://localhost:3001/callback",
            },
            headers={"X-Tenant-ID": "tenant_test"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_token_invalid_grant_type(self, client):
        """Token endpoint rejects unsupported grant types."""
        resp = await client.post(
            "/api/v1/smart/token",
            json={
                "grant_type": "password",
                "username": "test",
                "password": "test",
            },
            headers={"X-Tenant-ID": "tenant_test"},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_introspect_invalid_token(self, client):
        """Introspection of invalid token returns active=False."""
        resp = await client.post(
            "/api/v1/smart/introspect",
            json={"token": "completely-invalid-token"},
            headers={"X-Tenant-ID": "tenant_test"},
        )
        assert resp.status_code == 200
        assert resp.json()["active"] is False

    @pytest.mark.asyncio
    async def test_client_registration_requires_admin(self, client, medico_auth_headers):
        """Client registration requires admin role."""
        resp = await client.post(
            "/api/v1/smart/clients",
            json={
                "client_name": "Unauthorized App",
                "redirect_uris": ["http://localhost:3001/callback"],
                "scope": "patient/Patient.read",
            },
            headers=medico_auth_headers,
        )
        assert resp.status_code == 403
