"""Integración de almacenamiento de objetos (S3/MinIO)."""

from app.integrations.storage.s3_service import S3StorageService, get_storage_service

__all__ = ["S3StorageService", "get_storage_service"]
