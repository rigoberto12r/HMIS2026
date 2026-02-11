"""
SMART on FHIR OAuth2 service layer.

Handles the full OAuth2 authorization code flow:
- Client registration and management
- Authorization code creation with PKCE
- Code-to-token exchange (RS256 JWT)
- Token introspection (Redis cache → DB fallback)
- Token revocation
- Refresh token rotation
"""

import base64
import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import ph  # Argon2 hasher for client secrets
from app.modules.smart.keys import get_private_pem
from app.modules.smart.models import OAuth2AuthorizationCode, OAuth2Client, OAuth2Token
from app.modules.smart.scopes import parse_scopes, validate_scopes
from app.shared.exceptions import NotFoundError, ValidationError


def _hash_token(token: str) -> str:
    """SHA-256 hash of a token for secure storage and lookup."""
    return hashlib.sha256(token.encode()).hexdigest()


def _ensure_utc(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware (SQLite strips tzinfo)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class SMARTAuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------ #
    # Client Management
    # ------------------------------------------------------------------ #

    async def create_client(
        self,
        client_name: str,
        redirect_uris: list[str],
        scope: str = "",
        client_type: str = "confidential",
        launch_uri: str | None = None,
        tenant_id: str | None = None,
    ) -> tuple[OAuth2Client, str | None]:
        """Register a new SMART app. Returns (client, raw_secret_or_None)."""
        client_id = f"smart-{secrets.token_urlsafe(16)}"
        raw_secret = None
        secret_hash = None

        if client_type == "confidential":
            raw_secret = secrets.token_urlsafe(32)
            secret_hash = ph.hash(raw_secret)

        client = OAuth2Client(
            client_id=client_id,
            client_secret_hash=secret_hash,
            client_name=client_name,
            redirect_uris=redirect_uris,
            scope=scope,
            client_type=client_type,
            launch_uri=launch_uri,
            tenant_id=tenant_id,
        )
        self.db.add(client)
        await self.db.flush()

        return client, raw_secret

    async def get_client(self, client_id: str) -> OAuth2Client | None:
        """Look up an active client by its client_id string."""
        result = await self.db.execute(
            select(OAuth2Client).where(
                OAuth2Client.client_id == client_id,
                OAuth2Client.is_active == True,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    async def list_clients(self, tenant_id: str | None = None) -> list[OAuth2Client]:
        """List all active clients, optionally filtered by tenant."""
        q = select(OAuth2Client).where(OAuth2Client.is_active == True)  # noqa: E712
        if tenant_id:
            q = q.where(OAuth2Client.tenant_id == tenant_id)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def deactivate_client(self, client_db_id: uuid.UUID) -> None:
        """Soft-delete a client by its database UUID."""
        result = await self.db.execute(
            select(OAuth2Client).where(OAuth2Client.id == client_db_id)
        )
        client = result.scalar_one_or_none()
        if not client:
            raise NotFoundError("Client not found")
        client.is_active = False
        await self.db.flush()

    def verify_client_secret(self, client: OAuth2Client, client_secret: str) -> bool:
        """Verify a client secret against the stored Argon2 hash."""
        if not client.client_secret_hash:
            return False
        try:
            return ph.verify(client.client_secret_hash, client_secret)
        except Exception:
            return False

    # ------------------------------------------------------------------ #
    # Authorization Code
    # ------------------------------------------------------------------ #

    async def create_authorization_code(
        self,
        client_id: str,
        user_id: uuid.UUID,
        redirect_uri: str,
        scope: str,
        code_challenge: str | None = None,
        code_challenge_method: str | None = None,
        launch_patient: str | None = None,
        launch_encounter: str | None = None,
    ) -> str:
        """Create a short-lived authorization code. Returns the raw code string."""
        client = await self.get_client(client_id)
        if not client:
            raise ValidationError("Unknown client_id")

        if redirect_uri not in client.redirect_uris:
            raise ValidationError("Invalid redirect_uri")

        scopes = parse_scopes(scope)
        valid, invalid = validate_scopes(scopes)
        if not valid:
            raise ValidationError(f"Invalid scopes: {', '.join(invalid)}")

        # PKCE required for public clients
        if client.client_type == "public" and not code_challenge:
            raise ValidationError("PKCE code_challenge required for public clients")

        code = secrets.token_urlsafe(32)

        auth_code = OAuth2AuthorizationCode(
            code=code,
            client_id=client_id,
            user_id=user_id,
            redirect_uri=redirect_uri,
            scope=scope,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method or ("S256" if code_challenge else None),
            launch_patient=launch_patient,
            launch_encounter=launch_encounter,
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=settings.SMART_AUTH_CODE_EXPIRE_MINUTES),
        )
        self.db.add(auth_code)
        await self.db.flush()

        return code

    # ------------------------------------------------------------------ #
    # Token Exchange
    # ------------------------------------------------------------------ #

    async def exchange_code_for_tokens(
        self,
        code: str,
        client_id: str,
        client_secret: str | None = None,
        redirect_uri: str | None = None,
        code_verifier: str | None = None,
    ) -> dict:
        """Exchange authorization code for access + refresh tokens (RS256 JWT)."""
        # Find unused authorization code
        result = await self.db.execute(
            select(OAuth2AuthorizationCode).where(
                OAuth2AuthorizationCode.code == code,
                OAuth2AuthorizationCode.is_used == False,  # noqa: E712
            )
        )
        auth_code = result.scalar_one_or_none()

        if not auth_code:
            raise ValidationError("Invalid or expired authorization code")

        if _ensure_utc(auth_code.expires_at) < datetime.now(timezone.utc):
            raise ValidationError("Authorization code expired")

        # Mark as used immediately (one-time use)
        auth_code.is_used = True
        await self.db.flush()

        if auth_code.client_id != client_id:
            raise ValidationError("Client ID mismatch")

        client = await self.get_client(client_id)
        if not client:
            raise ValidationError("Unknown client")

        # Confidential clients must authenticate
        if client.client_type == "confidential":
            if not client_secret or not self.verify_client_secret(client, client_secret):
                raise ValidationError("Invalid client credentials")

        if redirect_uri and auth_code.redirect_uri != redirect_uri:
            raise ValidationError("Redirect URI mismatch")

        # PKCE verification
        if auth_code.code_challenge:
            if not code_verifier:
                raise ValidationError("code_verifier required")
            if not self._verify_pkce(
                code_verifier, auth_code.code_challenge, auth_code.code_challenge_method
            ):
                raise ValidationError("PKCE verification failed")

        # Build RS256 JWT
        now = datetime.now(timezone.utc)
        access_token_exp = now + timedelta(minutes=settings.SMART_ACCESS_TOKEN_EXPIRE_MINUTES)
        fhir_user = f"Practitioner/{auth_code.user_id}"
        jti = str(uuid.uuid4())

        claims = {
            "iss": settings.SMART_ISSUER,
            "sub": str(auth_code.user_id),
            "aud": client_id,
            "exp": access_token_exp,
            "iat": now,
            "jti": jti,
            "scope": auth_code.scope,
            "token_type": "smart",
            "fhirUser": fhir_user,
        }
        if auth_code.launch_patient:
            claims["patient"] = auth_code.launch_patient
        if auth_code.launch_encounter:
            claims["encounter"] = auth_code.launch_encounter

        private_pem = get_private_pem()
        access_token = jwt.encode(
            claims, private_pem, algorithm="RS256", headers={"kid": "smart-key-1"}
        )

        # Refresh token (opaque)
        refresh_token = secrets.token_urlsafe(48)

        # Persist token record (hashed)
        token_record = OAuth2Token(
            access_token_hash=_hash_token(access_token),
            refresh_token_hash=_hash_token(refresh_token),
            client_id=client_id,
            user_id=auth_code.user_id,
            scope=auth_code.scope,
            patient_id=auth_code.launch_patient,
            encounter_id=auth_code.launch_encounter,
            fhir_user=fhir_user,
            access_token_expires_at=access_token_exp,
            tenant_id=client.tenant_id,
        )
        self.db.add(token_record)
        await self.db.flush()

        # Cache in Redis
        await self._cache_token(access_token, token_record)

        return {
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": settings.SMART_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "scope": auth_code.scope,
            "refresh_token": refresh_token,
            "patient": auth_code.launch_patient,
            "encounter": auth_code.launch_encounter,
            "need_patient_banner": True,
        }

    # ------------------------------------------------------------------ #
    # Token Introspection (RFC 7662)
    # ------------------------------------------------------------------ #

    async def introspect_token(self, token: str) -> dict:
        """Introspect a token. Redis cache → DB fallback (cache-aside)."""
        token_hash = _hash_token(token)

        # Try Redis first
        cached = await self._get_cached_token(token_hash)
        if cached:
            if cached.get("revoked"):
                return {"active": False}
            return {
                "active": True,
                "scope": cached.get("scope"),
                "client_id": cached.get("client_id"),
                "sub": cached.get("user_id"),
                "token_type": "Bearer",
                "exp": cached.get("exp"),
                "iss": settings.SMART_ISSUER,
                "patient": cached.get("patient_id"),
            }

        # DB fallback
        result = await self.db.execute(
            select(OAuth2Token).where(OAuth2Token.access_token_hash == token_hash)
        )
        token_record = result.scalar_one_or_none()

        if not token_record:
            return {"active": False}

        if token_record.revoked_at:
            return {"active": False}

        if _ensure_utc(token_record.access_token_expires_at) < datetime.now(timezone.utc):
            return {"active": False}

        # Populate cache on miss
        await self._cache_token_from_record(token_hash, token_record)

        return {
            "active": True,
            "scope": token_record.scope,
            "client_id": token_record.client_id,
            "sub": str(token_record.user_id),
            "token_type": "Bearer",
            "exp": int(token_record.access_token_expires_at.timestamp()),
            "iss": settings.SMART_ISSUER,
            "patient": token_record.patient_id,
        }

    # ------------------------------------------------------------------ #
    # Token Revocation
    # ------------------------------------------------------------------ #

    async def revoke_token(self, token: str) -> None:
        """Revoke a token (access or refresh). Removes from Redis immediately."""
        token_hash = _hash_token(token)

        # Try as access token first
        result = await self.db.execute(
            select(OAuth2Token).where(OAuth2Token.access_token_hash == token_hash)
        )
        token_record = result.scalar_one_or_none()

        # Try as refresh token
        if not token_record:
            result = await self.db.execute(
                select(OAuth2Token).where(OAuth2Token.refresh_token_hash == token_hash)
            )
            token_record = result.scalar_one_or_none()

        if token_record:
            token_record.revoked_at = datetime.now(timezone.utc)
            await self.db.flush()
            await self._delete_cached_token(token_record.access_token_hash)

    # ------------------------------------------------------------------ #
    # Refresh Token
    # ------------------------------------------------------------------ #

    async def refresh_access_token(
        self,
        refresh_token: str,
        client_id: str,
        client_secret: str | None = None,
    ) -> dict:
        """Rotate refresh token and issue a new access token."""
        refresh_hash = _hash_token(refresh_token)

        result = await self.db.execute(
            select(OAuth2Token).where(
                OAuth2Token.refresh_token_hash == refresh_hash,
                OAuth2Token.revoked_at == None,  # noqa: E711
            )
        )
        token_record = result.scalar_one_or_none()

        if not token_record:
            raise ValidationError("Invalid refresh token")

        if token_record.client_id != client_id:
            raise ValidationError("Client ID mismatch")

        client = await self.get_client(client_id)
        if not client:
            raise ValidationError("Unknown client")

        if client.client_type == "confidential":
            if not client_secret or not self.verify_client_secret(client, client_secret):
                raise ValidationError("Invalid client credentials")

        # Revoke old token pair
        token_record.revoked_at = datetime.now(timezone.utc)
        await self._delete_cached_token(token_record.access_token_hash)

        # Issue new tokens
        now = datetime.now(timezone.utc)
        access_token_exp = now + timedelta(minutes=settings.SMART_ACCESS_TOKEN_EXPIRE_MINUTES)

        claims = {
            "iss": settings.SMART_ISSUER,
            "sub": str(token_record.user_id),
            "aud": client_id,
            "exp": access_token_exp,
            "iat": now,
            "jti": str(uuid.uuid4()),
            "scope": token_record.scope,
            "token_type": "smart",
        }
        if token_record.patient_id:
            claims["patient"] = token_record.patient_id
        if token_record.encounter_id:
            claims["encounter"] = token_record.encounter_id
        if token_record.fhir_user:
            claims["fhirUser"] = token_record.fhir_user

        private_pem = get_private_pem()
        access_token = jwt.encode(
            claims, private_pem, algorithm="RS256", headers={"kid": "smart-key-1"}
        )
        new_refresh = secrets.token_urlsafe(48)

        new_record = OAuth2Token(
            access_token_hash=_hash_token(access_token),
            refresh_token_hash=_hash_token(new_refresh),
            client_id=client_id,
            user_id=token_record.user_id,
            scope=token_record.scope,
            patient_id=token_record.patient_id,
            encounter_id=token_record.encounter_id,
            fhir_user=token_record.fhir_user,
            access_token_expires_at=access_token_exp,
            tenant_id=token_record.tenant_id,
        )
        self.db.add(new_record)
        await self.db.flush()

        await self._cache_token(access_token, new_record)

        return {
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": settings.SMART_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "scope": token_record.scope,
            "refresh_token": new_refresh,
            "patient": token_record.patient_id,
            "encounter": token_record.encounter_id,
        }

    # ------------------------------------------------------------------ #
    # PKCE
    # ------------------------------------------------------------------ #

    @staticmethod
    def _verify_pkce(verifier: str, challenge: str, method: str | None) -> bool:
        """Verify PKCE code_verifier against stored challenge."""
        if method == "S256" or method is None:
            digest = hashlib.sha256(verifier.encode()).digest()
            computed = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
            return computed == challenge
        elif method == "plain":
            return verifier == challenge
        return False

    # ------------------------------------------------------------------ #
    # Redis Token Caching (Task 7)
    # ------------------------------------------------------------------ #

    async def _cache_token(self, raw_token: str, token_record: OAuth2Token) -> None:
        """Cache token metadata in Redis with TTL matching token lifetime."""
        try:
            from app.core.cache import redis_client

            token_hash = _hash_token(raw_token)
            ttl = settings.SMART_ACCESS_TOKEN_EXPIRE_MINUTES * 60
            data = json.dumps({
                "scope": token_record.scope,
                "client_id": token_record.client_id,
                "user_id": str(token_record.user_id),
                "patient_id": token_record.patient_id,
                "encounter_id": token_record.encounter_id,
                "fhir_user": token_record.fhir_user,
                "exp": int(token_record.access_token_expires_at.timestamp()),
                "tenant_id": token_record.tenant_id,
            })
            await redis_client.set(f"smart:token:{token_hash}", data, ex=ttl)
        except Exception:
            pass  # Redis failure must not block token issuance

    async def _cache_token_from_record(
        self, token_hash: str, token_record: OAuth2Token
    ) -> None:
        """Populate Redis cache from DB record on cache miss (cache-aside)."""
        try:
            from app.core.cache import redis_client

            remaining = (
                _ensure_utc(token_record.access_token_expires_at) - datetime.now(timezone.utc)
            ).total_seconds()
            if remaining <= 0:
                return
            data = json.dumps({
                "scope": token_record.scope,
                "client_id": token_record.client_id,
                "user_id": str(token_record.user_id),
                "patient_id": token_record.patient_id,
                "encounter_id": token_record.encounter_id,
                "fhir_user": token_record.fhir_user,
                "exp": int(token_record.access_token_expires_at.timestamp()),
                "tenant_id": token_record.tenant_id,
            })
            await redis_client.set(f"smart:token:{token_hash}", data, ex=int(remaining))
        except Exception:
            pass

    async def _get_cached_token(self, token_hash: str) -> dict | None:
        """Look up cached token data from Redis."""
        try:
            from app.core.cache import redis_client

            data = await redis_client.get(f"smart:token:{token_hash}")
            if data:
                return json.loads(data)
        except Exception:
            pass
        return None

    async def _delete_cached_token(self, token_hash: str) -> None:
        """Remove cached token from Redis (called on revocation)."""
        try:
            from app.core.cache import redis_client

            await redis_client.delete(f"smart:token:{token_hash}")
        except Exception:
            pass
