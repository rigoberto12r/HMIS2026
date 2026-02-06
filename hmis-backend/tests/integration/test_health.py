"""
Tests de integracion para los endpoints de salud y raiz de la API.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Verifica que el endpoint de salud responde correctamente."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["servicio"] == "HMIS SaaS"


@pytest.mark.asyncio
async def test_api_root(client: AsyncClient):
    """Verifica que la raiz de la API lista los modulos."""
    response = await client.get("/api/v1")
    assert response.status_code == 200
    data = response.json()
    assert "modulos" in data
    assert "pacientes" in data["modulos"]
    assert "citas" in data["modulos"]
    assert "historia_clinica" in data["modulos"]
    assert "facturacion" in data["modulos"]
    assert "farmacia" in data["modulos"]


@pytest.mark.asyncio
async def test_health_check_rate_limit_headers(client: AsyncClient):
    """Verifica que /health no tiene headers de rate limit (excluido)."""
    response = await client.get("/health")
    assert response.status_code == 200
    # /health esta excluido del rate limiting
    assert "X-RateLimit-Limit" not in response.headers


@pytest.mark.asyncio
async def test_api_endpoint_has_rate_limit_headers(client: AsyncClient):
    """Verifica que un endpoint normal incluye headers de rate limit."""
    response = await client.get("/api/v1")
    assert response.status_code == 200
    assert "X-RateLimit-Limit" in response.headers
    assert "X-RateLimit-Remaining" in response.headers
