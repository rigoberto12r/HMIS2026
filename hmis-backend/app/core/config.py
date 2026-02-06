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

    # --- CORS ---
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
    ]
    ALLOWED_HOSTS: list[str] = []

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

    # --- Paginacion ---
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # --- Constantes de negocio ---
    SUPPORTED_COUNTRIES: ClassVar[list[str]] = ["DO", "CO", "MX", "CL", "PE"]
    SUPPORTED_CURRENCIES: ClassVar[list[str]] = ["DOP", "COP", "MXN", "CLP", "PEN", "USD"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "case_sensitive": True}


settings = Settings()
