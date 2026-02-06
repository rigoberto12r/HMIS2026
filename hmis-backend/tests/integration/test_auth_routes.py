"""
Tests de integracion para las rutas de autenticacion (/api/v1/auth).
Valida login, refresh tokens, cambio de contrasena y endpoints protegidos.
"""

import uuid
from unittest.mock import patch, AsyncMock

import pytest
from httpx import AsyncClient


class TestLoginEndpoint:
    """Tests para POST /api/v1/auth/login."""

    @pytest.mark.asyncio
    async def test_login_exitoso_retorna_tokens(self, client: AsyncClient, admin_user):
        """Login con credenciales correctas retorna tokens JWT."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "admin@test.hmis.app",
                "password": "TestAdmin2026!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0
        assert data["user"]["email"] == "admin@test.hmis.app"

    @pytest.mark.asyncio
    async def test_login_email_incorrecto_retorna_401(self, client: AsyncClient):
        """Login con email inexistente retorna 401."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "noexiste@hmis.app",
                "password": "CualquierClave1!",
            },
        )
        assert response.status_code == 401
        assert "Credenciales invalidas" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_contrasena_incorrecta_retorna_401(
        self, client: AsyncClient, admin_user
    ):
        """Login con contrasena incorrecta retorna 401."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "admin@test.hmis.app",
                "password": "ContrasenaIncorrecta!",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_valida_formato_email(self, client: AsyncClient):
        """Login con email invalido retorna 422 (validacion)."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "no-es-email",
                "password": "CualquierClave1!",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_contrasena_muy_corta_retorna_422(self, client: AsyncClient):
        """Login con contrasena menor a 8 caracteres retorna 422."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "admin@test.hmis.app",
                "password": "corta",
            },
        )
        assert response.status_code == 422


class TestRefreshEndpoint:
    """Tests para POST /api/v1/auth/refresh."""

    @pytest.mark.asyncio
    async def test_refresh_exitoso_retorna_nuevos_tokens(
        self, client: AsyncClient, admin_user
    ):
        """Refresh con token valido retorna nuevos tokens."""
        # Primero hacer login
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "admin@test.hmis.app",
                "password": "TestAdmin2026!",
            },
        )
        refresh_token = login_resp.json()["refresh_token"]

        # Luego hacer refresh
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    @pytest.mark.asyncio
    async def test_refresh_token_invalido_retorna_401(self, client: AsyncClient):
        """Refresh con token invalido retorna 401."""
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "token.completamente.invalido"},
        )
        assert response.status_code == 401


class TestMeEndpoint:
    """Tests para GET /api/v1/auth/me."""

    @pytest.mark.asyncio
    async def test_me_retorna_perfil_usuario(
        self, client: AsyncClient, admin_auth_headers
    ):
        """GET /me retorna el perfil del usuario autenticado."""
        response = await client.get(
            "/api/v1/auth/me",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@test.hmis.app"
        assert data["first_name"] == "Admin"
        assert data["last_name"] == "Test"

    @pytest.mark.asyncio
    async def test_me_sin_token_retorna_403(self, client: AsyncClient):
        """GET /me sin token retorna 403."""
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 403


class TestChangePassword:
    """Tests para POST /api/v1/auth/change-password."""

    @pytest.mark.asyncio
    async def test_cambio_contrasena_exitoso(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Cambio de contrasena con contrasena actual correcta."""
        response = await client.post(
            "/api/v1/auth/change-password",
            headers=admin_auth_headers,
            json={
                "current_password": "TestAdmin2026!",
                "new_password": "NuevaContrasena2026!",
            },
        )
        assert response.status_code == 200
        assert "actualizada" in response.json()["mensaje"].lower()

    @pytest.mark.asyncio
    async def test_cambio_contrasena_actual_incorrecta(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Cambio de contrasena con contrasena actual incorrecta retorna 400."""
        response = await client.post(
            "/api/v1/auth/change-password",
            headers=admin_auth_headers,
            json={
                "current_password": "ContrasenaIncorrecta!",
                "new_password": "NuevaContrasena2026!",
            },
        )
        assert response.status_code == 400
