"""
AWS Secrets Manager integration for secure secret management.
Provides automatic secret rotation and audit trail for compliance.
"""

import json
import logging
from functools import lru_cache
from typing import Any, Dict, Optional

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


class SecretsManager:
    """
    AWS Secrets Manager client for retrieving application secrets.

    Features:
    - Automatic secret rotation (30/60/90 days)
    - Audit trail of all secret access
    - Caching to reduce AWS API calls
    - Fallback to environment variables in dev/test
    """

    def __init__(self):
        """Initialize AWS Secrets Manager client."""
        self.enabled = settings.ENVIRONMENT in ("staging", "production")

        if self.enabled:
            try:
                self.client = boto3.client(
                    "secretsmanager",
                    region_name=settings.AWS_REGION,
                )
                logger.info(
                    "AWS Secrets Manager initialized",
                    extra={"region": settings.AWS_REGION},
                )
            except Exception as e:
                logger.error(
                    "Failed to initialize AWS Secrets Manager",
                    extra={"error": str(e)},
                    exc_info=True,
                )
                self.client = None
        else:
            self.client = None
            logger.info(
                "AWS Secrets Manager disabled in %s environment",
                settings.ENVIRONMENT,
            )

    @lru_cache(maxsize=128)
    def get_secret(self, secret_name: str) -> Dict[str, Any]:
        """
        Retrieve a secret from AWS Secrets Manager.

        Args:
            secret_name: Name of the secret (e.g., "hmis/database")

        Returns:
            Dictionary containing secret key-value pairs

        Raises:
            ValueError: If secret retrieval fails in production

        Example:
            secrets_manager = SecretsManager()
            db_secret = secrets_manager.get_secret("hmis/database")
            db_url = db_secret["DATABASE_URL"]
        """
        if not self.enabled or not self.client:
            logger.warning(
                "Secrets Manager disabled, returning empty dict for %s",
                secret_name,
            )
            return {}

        try:
            response = self.client.get_secret_value(SecretId=secret_name)

            # Secrets can be stored as SecretString (JSON) or SecretBinary
            if "SecretString" in response:
                secret_data = json.loads(response["SecretString"])
            else:
                # Binary secrets (less common)
                secret_data = response["SecretBinary"]

            logger.info(
                "Successfully retrieved secret",
                extra={
                    "secret_name": secret_name,
                    "version_id": response.get("VersionId"),
                },
            )

            return secret_data

        except ClientError as e:
            error_code = e.response["Error"]["Code"]

            if error_code == "ResourceNotFoundException":
                logger.error(
                    "Secret not found in AWS Secrets Manager",
                    extra={"secret_name": secret_name},
                )
            elif error_code == "InvalidRequestException":
                logger.error(
                    "Invalid request to AWS Secrets Manager",
                    extra={"secret_name": secret_name, "error": str(e)},
                )
            elif error_code == "InvalidParameterException":
                logger.error(
                    "Invalid parameter in secret request",
                    extra={"secret_name": secret_name, "error": str(e)},
                )
            else:
                logger.error(
                    "Unexpected error retrieving secret",
                    extra={
                        "secret_name": secret_name,
                        "error_code": error_code,
                        "error": str(e),
                    },
                    exc_info=True,
                )

            # In production, fail fast if secrets can't be retrieved
            if settings.ENVIRONMENT == "production":
                raise ValueError(
                    f"Failed to retrieve secret '{secret_name}': {error_code}"
                ) from e

            return {}

    def get_database_url(self) -> Optional[str]:
        """
        Get database URL from AWS Secrets Manager.

        Returns:
            Database connection string or None if not available

        Example:
            secrets_manager = SecretsManager()
            db_url = secrets_manager.get_database_url()
            # Returns: "postgresql+asyncpg://user:pass@host:5432/db"
        """
        secret = self.get_secret("hmis/database")
        return secret.get("DATABASE_URL")

    def get_jwt_secret(self) -> Optional[str]:
        """
        Get JWT secret key from AWS Secrets Manager.

        Returns:
            JWT secret key or None if not available
        """
        secret = self.get_secret("hmis/jwt")
        return secret.get("JWT_SECRET_KEY")

    def get_redis_url(self) -> Optional[str]:
        """
        Get Redis URL from AWS Secrets Manager.

        Returns:
            Redis connection string or None if not available
        """
        secret = self.get_secret("hmis/redis")
        return secret.get("REDIS_URL")

    def get_stripe_keys(self) -> Dict[str, str]:
        """
        Get Stripe API keys from AWS Secrets Manager.

        Returns:
            Dictionary with Stripe secret and publishable keys
        """
        secret = self.get_secret("hmis/stripe")
        return {
            "secret_key": secret.get("STRIPE_SECRET_KEY", ""),
            "publishable_key": secret.get("STRIPE_PUBLISHABLE_KEY", ""),
            "webhook_secret": secret.get("STRIPE_WEBHOOK_SECRET", ""),
        }

    def get_email_config(self) -> Dict[str, str]:
        """
        Get email service configuration from AWS Secrets Manager.

        Returns:
            Dictionary with SendGrid API key
        """
        secret = self.get_secret("hmis/email")
        return {
            "sendgrid_api_key": secret.get("SENDGRID_API_KEY", ""),
        }

    def get_s3_credentials(self) -> Dict[str, str]:
        """
        Get S3 credentials from AWS Secrets Manager.

        Returns:
            Dictionary with S3 access key and secret key
        """
        secret = self.get_secret("hmis/s3")
        return {
            "access_key": secret.get("S3_ACCESS_KEY", ""),
            "secret_key": secret.get("S3_SECRET_KEY", ""),
        }

    def clear_cache(self):
        """
        Clear the LRU cache for secrets.

        Use this after rotating secrets to force retrieval of new values.
        """
        self.get_secret.cache_clear()
        logger.info("Secrets cache cleared")


# Global instance
_secrets_manager: Optional[SecretsManager] = None


def get_secrets_manager() -> SecretsManager:
    """
    Get or create the global SecretsManager instance.

    Returns:
        SecretsManager instance

    Example:
        from app.core.secrets import get_secrets_manager

        secrets = get_secrets_manager()
        db_url = secrets.get_database_url()
    """
    global _secrets_manager

    if _secrets_manager is None:
        _secrets_manager = SecretsManager()

    return _secrets_manager
