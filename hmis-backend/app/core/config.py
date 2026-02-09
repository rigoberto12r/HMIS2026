"""
Configuracion central de la aplicacion HMIS SaaS.
Usa variables de entorno con valores por defecto para desarrollo.
"""

from typing import ClassVar

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuracion de la aplicacion cargada desde variables de entorno."""

    # --- Aplicacion ---
    APP_NAME: str = "HMIS SaaS"
    ENVIRONMENT: str = "development"  # development | staging | production
    DEBUG: bool = True
    SECRET_KEY: str = "dev-secret-key-change-in-production"

    # --- Base de Datos ---
    DATABASE_URL: str = "postgresql+asyncpg://hmis_admin:hmis_dev_2026@localhost:5432/hmis"
    DATABASE_ECHO: bool = False
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # --- Redis ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- JWT / Autenticacion ---
    JWT_SECRET_KEY: str = "jwt-secret-dev-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- CORS (origenes por defecto para desarrollo; staging/produccion leen de CORS_ORIGINS) ---
    CORS_ORIGINS: str = ""
    ALLOWED_HOSTS: list[str] = []

    # --- Limite de peticiones (Rate Limiting) ---
    RATE_LIMIT_GENERAL: int = 100  # peticiones por minuto para endpoints generales
    RATE_LIMIT_LOGIN: int = 5      # peticiones por minuto para endpoint de login
    RATE_LIMIT_WINDOW_SECONDS: int = 60  # ventana de tiempo en segundos

    # --- Busqueda (Meilisearch) ---
    MEILISEARCH_URL: str = "http://localhost:7700"
    MEILISEARCH_KEY: str = "hmis_meili_dev_key"

    # --- Almacenamiento de Objetos (S3/MinIO) ---
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "hmis_minio"
    S3_SECRET_KEY: str = "hmis_minio_2026"
    S3_BUCKET_NAME: str = "hmis-documents"
    S3_REGION: str = "us-east-1"

    # --- Multi-Tenancy ---
    DEFAULT_SCHEMA: str = "public"
    TENANT_HEADER: str = "X-Tenant-ID"
    TENANT_SUBDOMAIN_ENABLED: bool = True

    # --- Observabilidad (Sentry + Logging) ---
    SENTRY_DSN: str = ""  # Dejar vacio para desactivar Sentry
    LOG_LEVEL: str = "INFO"

    # --- Distributed Tracing (OpenTelemetry) ---
    OTLP_ENDPOINT: str = ""  # e.g., "http://localhost:4317" for Jaeger
    OTLP_INSECURE: bool = True  # Use False with TLS in production
    TRACING_EXCLUDED_URLS: str = "/health,/health/live,/health/ready,/metrics"  # Skip health checks

    # --- Paginacion ---
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # --- Constantes de negocio ---
    SUPPORTED_COUNTRIES: ClassVar[list[str]] = ["DO", "CO", "MX", "CL", "PE"]
    SUPPORTED_CURRENCIES: ClassVar[list[str]] = ["DOP", "COP", "MXN", "CLP", "PEN", "USD"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "case_sensitive": True}

    # --- Metodos para origenes y hosts segun entorno ---

    def get_allowed_origins(self) -> list[str]:
        """
        Devuelve los origenes CORS permitidos segun el entorno:
        - development: origenes locales fijos para desarrollo rapido.
        - staging: lee de la variable CORS_ORIGINS (separados por coma).
        - production: lee de CORS_ORIGINS (obligatorio; vacio si no se configura).
        """
        if self.ENVIRONMENT == "development":
            return ["http://localhost:3000", "http://localhost:8000"]

        if self.ENVIRONMENT in ("staging", "production"):
            raw = self.CORS_ORIGINS.strip()
            if not raw:
                if self.ENVIRONMENT == "production":
                    # En produccion los origenes deben configurarse explicitamente
                    return []
                return []
            return [origen.strip() for origen in raw.split(",") if origen.strip()]

        # Entorno desconocido: no permitir origenes por seguridad
        return []

    def get_allowed_hosts(self) -> list[str]:
        """
        Devuelve los hosts permitidos segun el entorno:
        - development: sin restriccion (lista vacia = todo permitido en TrustedHostMiddleware).
        - staging/production: lee de ALLOWED_HOSTS o construye a partir de CORS_ORIGINS.
        """
        if self.ENVIRONMENT == "development":
            return []

        if self.ALLOWED_HOSTS:
            return self.ALLOWED_HOSTS

        # Derivar hosts desde los origenes CORS configurados
        origenes = self.get_allowed_origins()
        hosts: list[str] = []
        for origen in origenes:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(origen)
                if parsed.hostname:
                    hosts.append(parsed.hostname)
            except Exception:
                continue
        return hosts


settings = Settings()
