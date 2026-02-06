"""
Rutas API del modulo de Historia Clinica Electronica (EMR).
Encuentros, notas clinicas, diagnosticos, signos vitales, alergias y ordenes.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user, require_permissions, require_roles
from app.modules.auth.models import User
from app.modules.emr.schemas import (
    AllergyCreate,
    AllergyResponse,
    ClinicalNoteCreate,
    ClinicalNoteResponse,
    DiagnosisCreate,
    DiagnosisResponse,
    EncounterCreate,
    EncounterListResponse,
    EncounterResponse,
    EncounterUpdate,
    MedicalOrderCreate,
    MedicalOrderResponse,
    MedicalOrderStatusUpdate,
    ProblemListCreate,
    ProblemListResponse,
    VitalSignsCreate,
    VitalSignsResponse,
)
from app.modules.emr.service import (
    AllergyService,
    ClinicalNoteService,
    DiagnosisService,
    EncounterService,
    MedicalOrderService,
    VitalSignsService,
)
from app.shared.schemas import MessageResponse, PaginatedResponse, PaginationParams

router = APIRouter()


# =============================================
# Encuentros
# =============================================

@router.post("/encounters", response_model=EncounterResponse, status_code=status.HTTP_201_CREATED)
async def create_encounter(
    data: EncounterCreate,
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Crear un nuevo encuentro clinico."""
    service = EncounterService(db)
    encounter = await service.create_encounter(data, created_by=current_user.id)
    encounter = await service.get_encounter(encounter.id)
    return EncounterResponse.model_validate(encounter)


@router.get("/encounters", response_model=PaginatedResponse[EncounterListResponse])
async def list_encounters(
    patient_id: uuid.UUID | None = None,
    provider_id: uuid.UUID | None = None,
    encounter_type: str | None = None,
    encounter_status: str | None = Query(default=None, alias="status"),
    pagination: Annotated[PaginationParams, Depends()] = None,
    current_user: User = Depends(require_permissions("encounters:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar encuentros con filtros."""
    if pagination is None:
        pagination = PaginationParams()
    service = EncounterService(db)
    encounters, total = await service.list_encounters(
        patient_id=patient_id,
        provider_id=provider_id,
        encounter_type=encounter_type,
        status=encounter_status,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    return PaginatedResponse.create(
        items=[EncounterListResponse.model_validate(e) for e in encounters],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/encounters/{encounter_id}", response_model=EncounterResponse)
async def get_encounter(
    encounter_id: uuid.UUID,
    current_user: User = Depends(require_permissions("encounters:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener encuentro completo con notas, diagnosticos, vitales y ordenes."""
    service = EncounterService(db)
    encounter = await service.get_encounter(encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encuentro no encontrado")
    return EncounterResponse.model_validate(encounter)


@router.post("/encounters/{encounter_id}/complete", response_model=EncounterResponse)
async def complete_encounter(
    encounter_id: uuid.UUID,
    disposition: str | None = Query(default=None, description="alta, hospitalizacion, referencia"),
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Completar un encuentro clinico."""
    service = EncounterService(db)
    encounter = await service.complete_encounter(
        encounter_id, disposition=disposition, updated_by=current_user.id
    )
    if not encounter:
        raise HTTPException(status_code=404, detail="Encuentro no encontrado")
    encounter = await service.get_encounter(encounter.id)
    return EncounterResponse.model_validate(encounter)


# =============================================
# Notas Clinicas
# =============================================

@router.post("/notes", response_model=ClinicalNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_clinical_note(
    data: ClinicalNoteCreate,
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Crear una nota clinica (SOAP, procedimiento, egreso o enmienda)."""
    service = ClinicalNoteService(db)
    try:
        note = await service.create_note(data, created_by=current_user.id)
        return ClinicalNoteResponse.model_validate(note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/notes/{note_id}/sign", response_model=ClinicalNoteResponse)
async def sign_clinical_note(
    note_id: uuid.UUID,
    current_user: User = Depends(require_roles("medico", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Firmar una nota clinica.
    Solo medicos pueden firmar. Una vez firmada es inmutable.
    """
    service = ClinicalNoteService(db)
    try:
        note = await service.sign_note(note_id, signed_by=current_user.id)
        if not note:
            raise HTTPException(status_code=404, detail="Nota no encontrada")
        return ClinicalNoteResponse.model_validate(note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================
# Diagnosticos
# =============================================

@router.post("/diagnoses", response_model=DiagnosisResponse, status_code=status.HTTP_201_CREATED)
async def create_diagnosis(
    data: DiagnosisCreate,
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Registrar un diagnostico codificado CIE-10."""
    service = DiagnosisService(db)
    diagnosis = await service.create_diagnosis(data, created_by=current_user.id)
    return DiagnosisResponse.model_validate(diagnosis)


@router.get("/patients/{patient_id}/diagnoses", response_model=list[DiagnosisResponse])
async def get_patient_diagnoses(
    patient_id: uuid.UUID,
    diagnosis_status: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(require_permissions("encounters:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener todos los diagnosticos de un paciente."""
    service = DiagnosisService(db)
    diagnoses = await service.get_patient_diagnoses(patient_id, status=diagnosis_status)
    return [DiagnosisResponse.model_validate(d) for d in diagnoses]


# =============================================
# Signos Vitales
# =============================================

@router.post("/vitals", response_model=VitalSignsResponse, status_code=status.HTTP_201_CREATED)
async def record_vital_signs(
    data: VitalSignsCreate,
    current_user: User = Depends(require_permissions("vitals:write")),
    db: AsyncSession = Depends(get_db),
):
    """Registrar signos vitales con calculo automatico de BMI."""
    service = VitalSignsService(db)
    vitals = await service.record_vitals(data, measured_by=current_user.id)
    return VitalSignsResponse.model_validate(vitals)


@router.get("/patients/{patient_id}/vitals", response_model=list[VitalSignsResponse])
async def get_patient_vitals_history(
    patient_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_permissions("vitals:read")),
    db: AsyncSession = Depends(get_db),
):
    """Historial de signos vitales del paciente para graficas de tendencia."""
    service = VitalSignsService(db)
    vitals = await service.get_patient_vitals_history(patient_id, limit=limit)
    return [VitalSignsResponse.model_validate(v) for v in vitals]


# =============================================
# Alergias
# =============================================

@router.post("/allergies", response_model=AllergyResponse, status_code=status.HTTP_201_CREATED)
async def create_allergy(
    data: AllergyCreate,
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Registrar una alergia del paciente."""
    service = AllergyService(db)
    allergy = await service.create_allergy(**data.model_dump(), created_by=current_user.id)
    return AllergyResponse.model_validate(allergy)


@router.get("/patients/{patient_id}/allergies", response_model=list[AllergyResponse])
async def get_patient_allergies(
    patient_id: uuid.UUID,
    current_user: User = Depends(require_permissions("encounters:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener todas las alergias activas de un paciente."""
    service = AllergyService(db)
    allergies = await service.get_patient_allergies(patient_id)
    return [AllergyResponse.model_validate(a) for a in allergies]


# =============================================
# Ordenes Medicas
# =============================================

@router.post("/orders", response_model=MedicalOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_medical_order(
    data: MedicalOrderCreate,
    current_user: User = Depends(require_roles("medico", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Crear una orden medica (laboratorio, imagen, procedimiento, etc.)."""
    service = MedicalOrderService(db)
    order = await service.create_order(data, ordered_by=current_user.id)
    return MedicalOrderResponse.model_validate(order)


@router.patch("/orders/{order_id}/status", response_model=MedicalOrderResponse)
async def update_order_status(
    order_id: uuid.UUID,
    data: MedicalOrderStatusUpdate,
    current_user: User = Depends(require_permissions("orders:write")),
    db: AsyncSession = Depends(get_db),
):
    """Actualizar estado de una orden medica."""
    service = MedicalOrderService(db)
    order = await service.update_order_status(
        order_id, data, updated_by=current_user.id
    )
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return MedicalOrderResponse.model_validate(order)
