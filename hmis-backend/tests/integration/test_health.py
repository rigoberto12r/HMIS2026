"""
Tests de integracion para el endpoint de salud.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_check():
    """Verifica que el endpoint de salud responde correctamente."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["servicio"] == "HMIS SaaS"


@pytest.mark.asyncio
async def test_api_root():
    """Verifica que la raiz de la API lista los modulos."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1")
        assert response.status_code == 200
        data = response.json()
        assert "modulos" in data
        assert "pacientes" in data["modulos"]
        assert "citas" in data["modulos"]
        assert "historia_clinica" in data["modulos"]
        assert "facturacion" in data["modulos"]
        assert "farmacia" in data["modulos"]
