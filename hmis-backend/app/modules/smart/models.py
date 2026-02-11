"""
SMART on FHIR OAuth2 database models.

Three models support the full OAuth2 authorization code flow:
- OAuth2Client: Registered third-party SMART apps
- OAuth2AuthorizationCode: Short-lived authorization codes (PKCE supported)
- OAuth2Token: Issued access/refresh tokens (hashed for security)
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.shared.base_models import BaseEntity, TimestampMixin, UUIDMixin


class OAuth2Client(Base, BaseEntity):
    """Registered SMART on FHIR application."""

    __tablename__ = "oauth2_clients"

    client_id: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    client_secret_hash: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    redirect_uris: Mapped[list] = mapped_column(JSONB, default=list)
    scope: Mapped[str] = mapped_column(Text, nullable=False, default="")
    client_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="confidential"
    )  # "public" or "confidential"
    launch_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tenant_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )


class OAuth2AuthorizationCode(Base, UUIDMixin, TimestampMixin):
    """Short-lived authorization code for OAuth2 code flow with PKCE."""

    __tablename__ = "oauth2_authorization_codes"

    code: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    client_id: Mapped[str] = mapped_column(String(100), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    redirect_uri: Mapped[str] = mapped_column(String(500), nullable=False)
    scope: Mapped[str] = mapped_column(Text, nullable=False)
    code_challenge: Mapped[str | None] = mapped_column(String(255), nullable=True)
    code_challenge_method: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )
    launch_patient: Mapped[str | None] = mapped_column(String(100), nullable=True)
    launch_encounter: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    is_used: Mapped[bool] = mapped_column(default=False)


class OAuth2Token(Base, UUIDMixin, TimestampMixin):
    """Issued OAuth2 access/refresh tokens (stored as SHA-256 hashes)."""

    __tablename__ = "oauth2_tokens"

    access_token_hash: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    refresh_token_hash: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True
    )
    client_id: Mapped[str] = mapped_column(String(100), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    scope: Mapped[str] = mapped_column(Text, nullable=False)
    patient_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    encounter_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fhir_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    access_token_expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    tenant_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
