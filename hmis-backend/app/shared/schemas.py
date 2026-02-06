"""
Schemas Pydantic compartidos: paginacion, respuestas, errores.
"""

import uuid
from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Parametros de paginacion para consultas."""
    page: int = Field(default=1, ge=1, description="Numero de pagina")
    page_size: int = Field(default=20, ge=1, le=100, description="Elementos por pagina")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    """Respuesta paginada generica."""
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def create(cls, items: list[T], total: int, page: int, page_size: int):
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
        )


class MessageResponse(BaseModel):
    """Respuesta simple con mensaje."""
    mensaje: str
    detalle: str | None = None


class ErrorResponse(BaseModel):
    """Respuesta de error estandarizada."""
    error: str
    detalle: str | None = None
    codigo: str | None = None


class BaseEntitySchema(BaseModel):
    """Schema base con campos comunes de entidad."""
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    is_active: bool = True

    model_config = {"from_attributes": True}
