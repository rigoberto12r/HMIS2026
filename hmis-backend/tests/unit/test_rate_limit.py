"""
Tests unitarios para el middleware de rate limiting.
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.rate_limit import RateLimitMiddleware


def _make_request(path: str = "/api/v1/patients", ip: str = "192.168.1.100") -> MagicMock:
    """Crea un mock de Request."""
    request = MagicMock(spec=Request)
    request.url = MagicMock()
    request.url.path = path
    request.headers = {}
    request.client = MagicMock()
    request.client.host = ip
    return request


class TestRateLimitMiddleware:
    """Tests para la logica de rate limiting."""

    def test_obtener_ip_from_client(self):
        request = _make_request(ip="10.0.0.1")
        ip = RateLimitMiddleware._obtener_ip(request)
        assert ip == "10.0.0.1"

    def test_obtener_ip_from_x_forwarded_for(self):
        request = _make_request()
        request.headers = {"x-forwarded-for": "1.2.3.4, 10.0.0.1"}
        ip = RateLimitMiddleware._obtener_ip(request)
        assert ip == "1.2.3.4"

    def test_obtener_ip_no_client(self):
        request = _make_request()
        request.client = None
        request.headers = {}
        ip = RateLimitMiddleware._obtener_ip(request)
        assert ip == "desconocido"

    def test_verificar_limite_first_request(self):
        """La primera peticion no excede el limite."""
        mw = RateLimitMiddleware(MagicMock())
        almacen: dict = {}
        excedido, restantes = mw._verificar_limite(almacen, "1.1.1.1", 5, 60)
        assert excedido is False
        assert restantes == 4

    def test_verificar_limite_at_threshold(self):
        """Peticion en el limite exacto no excede."""
        mw = RateLimitMiddleware(MagicMock())
        almacen: dict = {"1.1.1.1": (4, time.time())}
        excedido, restantes = mw._verificar_limite(almacen, "1.1.1.1", 5, 60)
        assert excedido is False
        assert restantes == 0

    def test_verificar_limite_exceeded(self):
        """Peticion que excede el limite."""
        mw = RateLimitMiddleware(MagicMock())
        almacen: dict = {"1.1.1.1": (5, time.time())}
        excedido, restantes = mw._verificar_limite(almacen, "1.1.1.1", 5, 60)
        assert excedido is True
        assert restantes == 0

    def test_verificar_limite_window_expired(self):
        """Ventana expirada reinicia el contador."""
        mw = RateLimitMiddleware(MagicMock())
        almacen: dict = {"1.1.1.1": (100, time.time() - 120)}  # 120s ago
        excedido, restantes = mw._verificar_limite(almacen, "1.1.1.1", 5, 60)
        assert excedido is False
        assert restantes == 4

    def test_limpiar_entradas_expiradas(self):
        """Limpia entradas cuya ventana ya expiro."""
        mw = RateLimitMiddleware(MagicMock())
        ahora = time.time()
        almacen: dict = {
            "old": (10, ahora - 120),  # expirada
            "new": (2, ahora - 10),     # activa
        }
        mw._limpiar_entradas_expiradas(almacen, 60)
        assert "old" not in almacen
        assert "new" in almacen

    def test_rutas_estrictas_include_login(self):
        """Verifica que las rutas de login estan en el set de rutas estrictas."""
        assert "/api/v1/auth/login" in RateLimitMiddleware.RUTAS_ESTRICTAS
        assert "/api/v1/auth/token" in RateLimitMiddleware.RUTAS_ESTRICTAS
