"""
Dual-auth dependencies for FHIR endpoints.

Supports both:
1. Internal HS256 JWT (existing frontend/API auth) — full access
2. SMART RS256 JWT (third-party apps) — scope-restricted access

Existing frontend auth is completely unchanged. SMART tokens are validated
via the RSA public key and scope-checked per endpoint.
"""

import uuid
from dataclasses import dataclass, field

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.modules.auth.models import User
from app.modules.auth.service import UserService
from app.modules.smart.scopes import has_patient_context, parse_scopes, scope_allows

security_scheme = HTTPBearer(auto_error=False)


@dataclass
class FHIRAuthContext:
    """Authentication context for FHIR endpoints (works with both auth methods)."""

    user_id: uuid.UUID
    user: User | None = None
    auth_type: str = "internal"  # "internal" or "smart"
    scopes: list[str] = field(default_factory=list)
    patient_context: str | None = None
    encounter_context: str | None = None
    tenant_id: str | None = None


async def get_fhir_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> FHIRAuthContext:
    """
    Dual-auth dependency: tries internal HS256 first, then SMART RS256.
    Returns FHIRAuthContext regardless of which auth method succeeded.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # --- Try 1: Internal HS256 JWT ---
    payload = decode_token(token)
    if payload and payload.get("type") == "access":
        user_id = payload.get("sub")
        if user_id:
            user_service = UserService(db)
            user = await user_service.get_user(uuid.UUID(user_id))
            if user and user.is_active:
                return FHIRAuthContext(
                    user_id=user.id,
                    user=user,
                    auth_type="internal",
                    tenant_id=payload.get("tenant_id"),
                )

    # --- Try 2: SMART RS256 JWT ---
    try:
        from app.modules.smart.keys import get_public_pem

        public_pem = get_public_pem()

        smart_payload = jwt.decode(
            token,
            public_pem,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )

        if smart_payload.get("token_type") == "smart":
            scopes = parse_scopes(smart_payload.get("scope", ""))
            return FHIRAuthContext(
                user_id=uuid.UUID(smart_payload["sub"]),
                auth_type="smart",
                scopes=scopes,
                patient_context=smart_payload.get("patient"),
                encounter_context=smart_payload.get("encounter"),
                tenant_id=smart_payload.get("tenant_id"),
            )
    except (JWTError, KeyError, ValueError, Exception):
        pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_smart_scope(resource_type: str, action: str):
    """
    Dependency factory that enforces SMART scope for a specific resource + action.

    Internal auth bypasses scope checks (backward compatible).
    SMART auth requires matching scope (e.g. patient/Patient.read).
    Patient context is enforced when patient/* scopes are used.
    """

    async def _check_scope(
        auth: FHIRAuthContext = Depends(get_fhir_auth),
    ) -> FHIRAuthContext:
        # Internal auth: full access (backward compatible with existing JWT)
        if auth.auth_type == "internal":
            return auth

        # SMART auth: verify scope grants access to this resource + action
        if not scope_allows(auth.scopes, resource_type, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient scope: requires {resource_type}.{action}",
            )

        return auth

    return _check_scope


def enforce_patient_context(auth: FHIRAuthContext, patient_id: str | None) -> None:
    """
    Raise 403 if SMART token has patient context and it doesn't match.

    Call this in route handlers where a patient ID is available:
        enforce_patient_context(auth, str(patient_uuid))
    """
    if (
        auth.auth_type == "smart"
        and auth.patient_context
        and patient_id
        and str(patient_id) != auth.patient_context
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient context restriction: access denied for this patient",
        )
