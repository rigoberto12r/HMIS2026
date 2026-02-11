"""
SMART on FHIR OAuth2 routes.

Endpoints:
- GET  /.well-known/smart-configuration  (mounted in main.py)
- GET  /jwks                             Public JWKS endpoint
- GET  /authorize                        Authorization code issuance
- POST /token                            Code → token exchange
- POST /introspect                       Token introspection (RFC 7662)
- POST /revoke                           Token revocation
- POST /clients                          Register SMART app (admin)
- GET  /clients                          List SMART apps (admin)
- DELETE /clients/{id}                   Deactivate SMART app (admin)
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user, require_roles
from app.modules.auth.models import User
from app.modules.smart.keys import get_jwks
from app.modules.smart.schemas import (
    AuthorizationRequest,
    IntrospectionRequest,
    OAuth2ClientCreate,
    OAuth2ClientListResponse,
    OAuth2ClientResponse,
    RevocationRequest,
    SMARTConfiguration,
    TokenRequest,
    TokenResponse,
)
from app.modules.smart.scopes import ALL_SUPPORTED_SCOPES
from app.modules.smart.service import SMARTAuthService
from app.shared.exceptions import DomainException

router = APIRouter()


# ================================================================== #
# Discovery + JWKS
# ================================================================== #


def build_smart_configuration(base_url: str) -> dict:
    """Build the .well-known/smart-configuration response."""
    config = SMARTConfiguration(
        issuer=settings.SMART_ISSUER,
        jwks_uri=f"{base_url}/api/v1/smart/jwks",
        authorization_endpoint=f"{base_url}/api/v1/smart/authorize",
        token_endpoint=f"{base_url}/api/v1/smart/token",
        introspection_endpoint=f"{base_url}/api/v1/smart/introspect",
        revocation_endpoint=f"{base_url}/api/v1/smart/revoke",
        registration_endpoint=f"{base_url}/api/v1/smart/clients",
        scopes_supported=ALL_SUPPORTED_SCOPES,
        response_types_supported=["code"],
        grant_types_supported=["authorization_code", "refresh_token"],
        code_challenge_methods_supported=["S256"],
        token_endpoint_auth_methods_supported=[
            "client_secret_post",
            "private_key_jwt",
        ],
        capabilities=[
            "launch-ehr",
            "launch-standalone",
            "client-public",
            "client-confidential-symmetric",
            "context-ehr-patient",
            "context-ehr-encounter",
            "context-standalone-patient",
            "sso-openid-connect",
            "permission-v2",
        ],
    )
    return config.model_dump()


@router.get("/jwks", status_code=status.HTTP_200_OK)
async def jwks_endpoint():
    """Public JWKS endpoint. Returns RS256 public key(s) for token verification."""
    return JSONResponse(content=get_jwks())


# ================================================================== #
# OAuth2 Authorization Code Flow
# ================================================================== #


@router.get("/authorize", status_code=status.HTTP_200_OK)
async def authorize(
    response_type: str = Query("code"),
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    scope: str = Query(""),
    state: str | None = Query(None),
    code_challenge: str | None = Query(None),
    code_challenge_method: str | None = Query(None),
    launch: str | None = Query(None),
    aud: str | None = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Authorization endpoint. Requires authenticated user (internal JWT).

    In a real EHR, this would show a consent screen. Here we auto-approve
    since the user is already authenticated and the scopes are validated.
    """
    if response_type != "code":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only response_type=code is supported",
        )

    try:
        service = SMARTAuthService(db)

        # Parse launch context
        launch_patient = None
        launch_encounter = None
        if launch:
            # Launch context can encode patient and encounter IDs
            launch_patient = launch

        code = await service.create_authorization_code(
            client_id=client_id,
            user_id=current_user.id,
            redirect_uri=redirect_uri,
            scope=scope,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            launch_patient=launch_patient,
            launch_encounter=launch_encounter,
        )

        # Return authorization code (in production, redirect to redirect_uri)
        response = {"code": code}
        if state:
            response["state"] = state

        return JSONResponse(content=response)

    except DomainException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/token", status_code=status.HTTP_200_OK)
async def token_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Token endpoint. Exchanges authorization code for access + refresh tokens.

    Supports grant_type: authorization_code, refresh_token.
    Accepts form-encoded or JSON body.
    """
    # Accept both form data and JSON
    content_type = request.headers.get("content-type", "")
    if "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        data = dict(form)
    else:
        data = await request.json()

    grant_type = data.get("grant_type")
    service = SMARTAuthService(db)

    try:
        if grant_type == "authorization_code":
            result = await service.exchange_code_for_tokens(
                code=data.get("code", ""),
                client_id=data.get("client_id", ""),
                client_secret=data.get("client_secret"),
                redirect_uri=data.get("redirect_uri"),
                code_verifier=data.get("code_verifier"),
            )
            return JSONResponse(content=result)

        elif grant_type == "refresh_token":
            result = await service.refresh_access_token(
                refresh_token=data.get("refresh_token", ""),
                client_id=data.get("client_id", ""),
                client_secret=data.get("client_secret"),
            )
            return JSONResponse(content=result)

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported grant_type: {grant_type}",
            )

    except DomainException as e:
        return JSONResponse(
            status_code=e.status_code,
            content={"error": "invalid_grant", "error_description": e.message},
        )


@router.post("/introspect", status_code=status.HTTP_200_OK)
async def introspect_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Token introspection (RFC 7662). Returns active status and token metadata."""
    content_type = request.headers.get("content-type", "")
    if "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        token = form.get("token", "")
    else:
        body = await request.json()
        token = body.get("token", "")

    if not token:
        return JSONResponse(content={"active": False})

    service = SMARTAuthService(db)
    result = await service.introspect_token(token)
    return JSONResponse(content=result)


@router.post("/revoke", status_code=status.HTTP_200_OK)
async def revoke_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Token revocation. Accepts access or refresh token."""
    content_type = request.headers.get("content-type", "")
    if "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        token = form.get("token", "")
    else:
        body = await request.json()
        token = body.get("token", "")

    if token:
        service = SMARTAuthService(db)
        await service.revoke_token(token)

    # RFC 7009: always return 200 regardless of whether token existed
    return JSONResponse(content={"status": "ok"})


# ================================================================== #
# Client Management (Admin only)
# ================================================================== #


@router.post("/clients", status_code=status.HTTP_201_CREATED)
async def register_client(
    body: OAuth2ClientCreate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Register a new SMART on FHIR application (admin only)."""
    service = SMARTAuthService(db)
    client, raw_secret = await service.create_client(
        client_name=body.client_name,
        redirect_uris=body.redirect_uris,
        scope=body.scope,
        client_type=body.client_type,
        launch_uri=body.launch_uri,
        tenant_id=current_user.tenant_id,
    )

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "id": str(client.id),
            "client_id": client.client_id,
            "client_secret": raw_secret,  # Only returned once
            "client_name": client.client_name,
            "redirect_uris": client.redirect_uris,
            "scope": client.scope,
            "client_type": client.client_type,
            "launch_uri": client.launch_uri,
            "is_active": client.is_active,
        },
    )


@router.get("/clients", status_code=status.HTTP_200_OK)
async def list_clients(
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List all registered SMART apps (admin only)."""
    service = SMARTAuthService(db)
    clients = await service.list_clients(tenant_id=current_user.tenant_id)
    return JSONResponse(
        content=[
            {
                "id": str(c.id),
                "client_id": c.client_id,
                "client_name": c.client_name,
                "client_type": c.client_type,
                "scope": c.scope,
                "is_active": c.is_active,
            }
            for c in clients
        ]
    )


@router.delete("/clients/{client_db_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_client(
    client_db_id: str,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate (soft-delete) a SMART app (admin only)."""
    try:
        client_uuid = uuid.UUID(client_db_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid client ID"
        )

    service = SMARTAuthService(db)
    try:
        await service.deactivate_client(client_uuid)
    except DomainException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
