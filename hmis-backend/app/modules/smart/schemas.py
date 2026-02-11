"""
SMART on FHIR Pydantic schemas for request/response validation.
"""

from datetime import datetime

from pydantic import BaseModel, Field


# --- Client Management ---


class OAuth2ClientCreate(BaseModel):
    client_name: str = Field(..., max_length=255)
    redirect_uris: list[str]
    scope: str = ""
    client_type: str = Field("confidential", pattern=r"^(public|confidential)$")
    launch_uri: str | None = None


class OAuth2ClientResponse(BaseModel):
    id: str
    client_id: str
    client_secret: str | None = None  # Only returned on creation
    client_name: str
    redirect_uris: list[str]
    scope: str
    client_type: str
    launch_uri: str | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class OAuth2ClientListResponse(BaseModel):
    id: str
    client_id: str
    client_name: str
    client_type: str
    scope: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- OAuth2 Flow ---


class AuthorizationRequest(BaseModel):
    response_type: str = "code"
    client_id: str
    redirect_uri: str
    scope: str = ""
    state: str | None = None
    code_challenge: str | None = None
    code_challenge_method: str | None = Field(None, pattern=r"^(plain|S256)$")
    launch: str | None = None  # EHR Launch context
    aud: str | None = None  # FHIR server URL


class TokenRequest(BaseModel):
    grant_type: str
    code: str | None = None
    redirect_uri: str | None = None
    client_id: str | None = None
    client_secret: str | None = None
    code_verifier: str | None = None
    refresh_token: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    scope: str
    refresh_token: str | None = None
    patient: str | None = None
    encounter: str | None = None
    id_token: str | None = None
    need_patient_banner: bool = True
    smart_style_url: str | None = None


# --- Introspection / Revocation ---


class IntrospectionRequest(BaseModel):
    token: str


class IntrospectionResponse(BaseModel):
    active: bool
    scope: str | None = None
    client_id: str | None = None
    username: str | None = None
    token_type: str | None = None
    exp: int | None = None
    iat: int | None = None
    sub: str | None = None
    aud: str | None = None
    iss: str | None = None
    patient: str | None = None


class RevocationRequest(BaseModel):
    token: str


# --- Discovery ---


class SMARTConfiguration(BaseModel):
    """SMART on FHIR .well-known configuration document."""

    issuer: str
    jwks_uri: str
    authorization_endpoint: str
    token_endpoint: str
    introspection_endpoint: str
    revocation_endpoint: str
    registration_endpoint: str | None = None
    scopes_supported: list[str]
    response_types_supported: list[str]
    grant_types_supported: list[str]
    code_challenge_methods_supported: list[str]
    token_endpoint_auth_methods_supported: list[str]
    capabilities: list[str]
