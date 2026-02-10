"""
Rutas API del modulo de Pacientes.
CRUD completo con busqueda, paginacion y gestion de seguros.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user, require_permissions
from app.modules.auth.models import User
from app.modules.patients.schemas import (
    PatientCreate,
    PatientInsuranceCreate,
    PatientInsuranceResponse,
    PatientListResponse,
    PatientResponse,
    PatientSearchParams,
    PatientStatsResponse,
    PatientUpdate,
)
from app.modules.patients.service import PatientService
from app.shared.schemas import MessageResponse, PaginatedResponse, PaginationParams

router = APIRouter()


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    data: PatientCreate,
    current_user: User = Depends(require_permissions("patients:write")),
    db: AsyncSession = Depends(get_db),
):
    """
    Registrar un nuevo paciente.
    Valida duplicados por tipo y numero de documento.
    Genera MRN unico automaticamente.
    """
    service = PatientService(db)
    try:
        patient = await service.create_patient(data, created_by=current_user.id)
        # Recargar con relaciones
        patient = await service.get_patient(patient.id)
        return PatientResponse.model_validate(patient)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/search", response_model=PaginatedResponse[PatientListResponse])
async def search_patients(
    query: str | None = Query(default=None, description="Buscar por nombre, documento o MRN"),
    document_type: str | None = None,
    gender: str | None = None,
    patient_status: str | None = Query(default="active", alias="status"),
    pagination: Annotated[PaginationParams, Depends()] = None,
    current_user: User = Depends(require_permissions("patients:read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Buscar pacientes con filtros multiples.
    Soporta busqueda full-text por nombre, documento y MRN.
    """
    if pagination is None:
        pagination = PaginationParams()

    service = PatientService(db)
    params = PatientSearchParams(
        query=query,
        document_type=document_type,
        gender=gender,
        status=patient_status,
    )
    patients, total = await service.search_patients(
        params, offset=pagination.offset, limit=pagination.page_size
    )
    return PaginatedResponse.create(
        items=[PatientListResponse.model_validate(p) for p in patients],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/stats", response_model=PatientStatsResponse)
async def get_patient_stats(
    current_user: User = Depends(require_permissions("patients:read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Obtener estadisticas de pacientes.
    Retorna total de pacientes, nuevos este mes y activos.
    """
    service = PatientService(db)
    stats = await service.get_stats()
    return PatientStatsResponse(**stats)


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: uuid.UUID,
    current_user: User = Depends(require_permissions("patients:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener paciente por ID con toda su informacion incluyendo seguros."""
    service = PatientService(db)
    patient = await service.get_patient(patient_id)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paciente no encontrado",
        )
    return PatientResponse.model_validate(patient)


@router.get("/mrn/{mrn}", response_model=PatientResponse)
async def get_patient_by_mrn(
    mrn: str,
    current_user: User = Depends(require_permissions("patients:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener paciente por numero de historia clinica (MRN)."""
    service = PatientService(db)
    patient = await service.get_patient_by_mrn(mrn)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paciente no encontrado con ese MRN",
        )
    return PatientResponse.model_validate(patient)


@router.patch("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: uuid.UUID,
    data: PatientUpdate,
    current_user: User = Depends(require_permissions("patients:write")),
    db: AsyncSession = Depends(get_db),
):
    """Actualizar datos de un paciente."""
    service = PatientService(db)
    patient = await service.update_patient(patient_id, data, updated_by=current_user.id)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paciente no encontrado",
        )
    patient = await service.get_patient(patient.id)
    return PatientResponse.model_validate(patient)


@router.post(
    "/{patient_id}/insurances",
    response_model=PatientInsuranceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_patient_insurance(
    patient_id: uuid.UUID,
    data: PatientInsuranceCreate,
    current_user: User = Depends(require_permissions("patients:write")),
    db: AsyncSession = Depends(get_db),
):
    """Agregar una poliza de seguro a un paciente."""
    service = PatientService(db)
    patient = await service.get_patient(patient_id)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paciente no encontrado",
        )

    policy = await service.add_insurance(
        patient_id=patient_id,
        **data.model_dump(),
    )
    return PatientInsuranceResponse.model_validate(policy)


@router.delete("/{patient_id}", response_model=MessageResponse)
async def deactivate_patient(
    patient_id: uuid.UUID,
    current_user: User = Depends(require_permissions("patients:write")),
    db: AsyncSession = Depends(get_db),
):
    """Desactivar un paciente (borrado logico)."""
    service = PatientService(db)
    patient = await service.get_patient(patient_id)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paciente no encontrado",
        )

    from app.modules.patients.schemas import PatientUpdate
    await service.update_patient(
        patient_id,
        PatientUpdate(status="inactive"),
        updated_by=current_user.id,
    )
    return MessageResponse(mensaje="Paciente desactivado correctamente")
