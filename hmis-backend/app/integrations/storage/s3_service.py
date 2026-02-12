"""
Servicio de almacenamiento de objetos compatible con S3/MinIO.
Soporta upload, download (presigned URL) y delete de archivos clínicos.
"""

import logging
import uuid
from functools import lru_cache

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Tipos de archivo permitidos para documentos clínicos
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/dicom",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class S3StorageService:
    """Servicio de almacenamiento S3/MinIO para documentos clínicos."""

    def __init__(self):
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=Config(signature_version="s3v4"),
        )
        self._bucket = settings.S3_BUCKET_NAME

    def _ensure_bucket(self) -> None:
        """Crea el bucket si no existe (solo desarrollo/MinIO)."""
        try:
            self._client.head_bucket(Bucket=self._bucket)
        except ClientError:
            try:
                self._client.create_bucket(Bucket=self._bucket)
                logger.info("Bucket '%s' creado", self._bucket)
            except ClientError as e:
                logger.error("No se pudo crear bucket '%s': %s", self._bucket, e)

    def generate_key(self, tenant_id: str, folder: str, filename: str) -> str:
        """Genera una clave S3 con estructura tenant/folder/uuid_filename."""
        unique = uuid.uuid4().hex[:12]
        safe_name = filename.replace(" ", "_")
        return f"{tenant_id}/{folder}/{unique}_{safe_name}"

    async def upload_file(
        self,
        file_content: bytes,
        key: str,
        content_type: str = "application/octet-stream",
    ) -> dict:
        """
        Sube un archivo a S3.

        Returns:
            dict con file_key, file_size, content_type
        """
        if len(file_content) > MAX_FILE_SIZE:
            raise ValueError(f"El archivo excede el tamaño máximo de {MAX_FILE_SIZE // (1024*1024)} MB")

        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ValueError(f"Tipo de archivo no permitido: {content_type}")

        try:
            self._ensure_bucket()
            self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=file_content,
                ContentType=content_type,
            )
            logger.info("Archivo subido: %s (%d bytes)", key, len(file_content))
            return {
                "file_key": key,
                "file_size": len(file_content),
                "content_type": content_type,
            }
        except ClientError as e:
            logger.error("Error al subir archivo %s: %s", key, e)
            raise RuntimeError(f"Error al subir archivo: {e}") from e

    async def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """
        Genera una URL pre-firmada para descargar un archivo.

        Args:
            key: Clave del archivo en S3
            expires_in: Tiempo de expiración en segundos (default 1 hora)

        Returns:
            URL pre-firmada para descarga
        """
        try:
            url = self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires_in,
            )
            return url
        except ClientError as e:
            logger.error("Error al generar URL pre-firmada para %s: %s", key, e)
            raise RuntimeError(f"Error al generar URL de descarga: {e}") from e

    async def delete_file(self, key: str) -> bool:
        """
        Elimina un archivo de S3.

        Returns:
            True si se eliminó exitosamente
        """
        try:
            self._client.delete_object(Bucket=self._bucket, Key=key)
            logger.info("Archivo eliminado: %s", key)
            return True
        except ClientError as e:
            logger.error("Error al eliminar archivo %s: %s", key, e)
            return False

    async def file_exists(self, key: str) -> bool:
        """Verifica si un archivo existe en S3."""
        try:
            self._client.head_object(Bucket=self._bucket, Key=key)
            return True
        except ClientError:
            return False


@lru_cache(maxsize=1)
def get_storage_service() -> S3StorageService:
    """Singleton del servicio de almacenamiento."""
    return S3StorageService()
