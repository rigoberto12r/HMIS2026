"""
Custom domain exceptions for consistent error handling across the application.

These exceptions replace generic ValueError/KeyError with semantic, HTTP-aware exceptions
that are automatically converted to proper HTTP responses by the global exception handler.
"""

from typing import Optional


class DomainException(Exception):
    """Base exception for all domain-level errors with HTTP status code awareness."""

    def __init__(self, message: str, status_code: int = 400, details: Optional[dict] = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class NotFoundError(DomainException):
    """Raised when a requested resource does not exist (HTTP 404)."""

    def __init__(self, resource: str, identifier: str):
        message = f"{resource} '{identifier}' no encontrado"
        super().__init__(message, status_code=404)


class ConflictError(DomainException):
    """Raised when an operation conflicts with existing state (HTTP 409)."""

    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(message, status_code=409, details=details)


class ValidationError(DomainException):
    """Raised when business validation fails (HTTP 400)."""

    def __init__(self, message: str, field: Optional[str] = None):
        details = {"field": field} if field else {}
        super().__init__(message, status_code=400, details=details)


class UnauthorizedError(DomainException):
    """Raised when authentication fails or is missing (HTTP 401)."""

    def __init__(self, message: str = "No autenticado"):
        super().__init__(message, status_code=401)


class ForbiddenError(DomainException):
    """Raised when user lacks permissions for an action (HTTP 403)."""

    def __init__(self, message: str = "Acceso denegado"):
        super().__init__(message, status_code=403)


class BusinessRuleViolation(DomainException):
    """Raised when a business rule is violated (HTTP 422)."""

    def __init__(self, rule: str, message: str):
        super().__init__(message, status_code=422, details={"rule": rule})


class ExternalServiceError(DomainException):
    """Raised when an external service (payment gateway, email, etc.) fails (HTTP 502)."""

    def __init__(self, service: str, message: str):
        super().__init__(
            f"Error en servicio externo '{service}': {message}",
            status_code=502,
            details={"service": service},
        )
