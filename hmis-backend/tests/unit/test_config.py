"""
Tests unitarios para la configuracion del sistema (CORS, hosts, rate limit).
"""

from unittest.mock import patch

from app.core.config import Settings


class TestGetAllowedOrigins:
    """Tests para el metodo get_allowed_origins segun entorno."""

    def test_development_returns_localhost(self):
        s = Settings(ENVIRONMENT="development")
        origins = s.get_allowed_origins()
        assert "http://localhost:3000" in origins
        assert "http://localhost:8000" in origins

    def test_production_empty_if_no_cors_origins(self):
        s = Settings(ENVIRONMENT="production", CORS_ORIGINS="")
        origins = s.get_allowed_origins()
        assert origins == []

    def test_production_parses_cors_origins(self):
        s = Settings(
            ENVIRONMENT="production",
            CORS_ORIGINS="https://hmis.example.com,https://api.hmis.example.com",
        )
        origins = s.get_allowed_origins()
        assert "https://hmis.example.com" in origins
        assert "https://api.hmis.example.com" in origins
        assert len(origins) == 2

    def test_staging_parses_cors_origins(self):
        s = Settings(
            ENVIRONMENT="staging",
            CORS_ORIGINS="https://staging.hmis.app",
        )
        origins = s.get_allowed_origins()
        assert origins == ["https://staging.hmis.app"]

    def test_staging_empty_if_no_cors(self):
        s = Settings(ENVIRONMENT="staging", CORS_ORIGINS="")
        origins = s.get_allowed_origins()
        assert origins == []

    def test_unknown_environment_returns_empty(self):
        s = Settings(ENVIRONMENT="unknown")
        origins = s.get_allowed_origins()
        assert origins == []


class TestGetAllowedHosts:
    """Tests para el metodo get_allowed_hosts."""

    def test_development_returns_empty(self):
        s = Settings(ENVIRONMENT="development")
        hosts = s.get_allowed_hosts()
        assert hosts == []

    def test_uses_allowed_hosts_if_set(self):
        s = Settings(
            ENVIRONMENT="production",
            ALLOWED_HOSTS=["hmis.example.com", "api.hmis.example.com"],
        )
        hosts = s.get_allowed_hosts()
        assert "hmis.example.com" in hosts

    def test_derives_hosts_from_cors_origins(self):
        s = Settings(
            ENVIRONMENT="production",
            CORS_ORIGINS="https://hmis.example.com",
            ALLOWED_HOSTS=[],
        )
        hosts = s.get_allowed_hosts()
        assert "hmis.example.com" in hosts


class TestRateLimitSettings:
    """Tests para las configuraciones de rate limiting."""

    def test_defaults(self):
        s = Settings()
        assert s.RATE_LIMIT_GENERAL == 100
        assert s.RATE_LIMIT_LOGIN == 5
        assert s.RATE_LIMIT_WINDOW_SECONDS == 60

    def test_custom_values(self):
        s = Settings(
            RATE_LIMIT_GENERAL=200,
            RATE_LIMIT_LOGIN=10,
            RATE_LIMIT_WINDOW_SECONDS=120,
        )
        assert s.RATE_LIMIT_GENERAL == 200
        assert s.RATE_LIMIT_LOGIN == 10
        assert s.RATE_LIMIT_WINDOW_SECONDS == 120
