"""
Rutas API del modulo de Historia Clinica Electronica (EMR).
Encuentros, notas clinicas, diagnosticos, signos vitales, alergias y ordenes.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user, require_permissions, require_roles
from app.modules.auth.models import User
from app.modules.emr.models import EncounterAttachment
from app.modules.emr.schemas import (
    AllergyCreate,
    AllergyResponse,
    AllergyUpdate,
    AttachmentResponse,
    ClinicalNoteCreate,
    ClinicalNoteResponse,
    ClinicalTemplateCreate,
    ClinicalTemplateResponse,
    ClinicalTemplateUpdate,
    DiagnosisCreate,
    DiagnosisResponse,
    DiagnosisUpdate,
    EncounterCreate,
    EncounterListResponse,
    EncounterResponse,
    EncounterUpdate,
    MedicalOrderCreate,
    MedicalOrderResponse,
    MedicalOrderStatusUpdate,
    ProblemListCreate,
    ProblemListResponse,
    ProblemListUpdate,
    VitalSignsCreate,
    VitalSignsResponse,
)
from app.integrations.storage import get_storage_service
from app.modules.emr.service import (
    AllergyService,
    ClinicalNoteService,
    ClinicalTemplateService,
    DiagnosisService,
    EncounterService,
    MedicalOrderService,
    ProblemListService,
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


@router.patch("/encounters/{encounter_id}", response_model=EncounterResponse)
async def update_encounter(
    encounter_id: uuid.UUID,
    data: EncounterUpdate,
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Actualizar un encuentro en progreso."""
    service = EncounterService(db)
    try:
        encounter = await service.update_encounter(
            encounter_id, data, updated_by=current_user.id
        )
        if not encounter:
            raise HTTPException(status_code=404, detail="Encuentro no encontrado")
        encounter = await service.get_encounter(encounter.id)
        return EncounterResponse.model_validate(encounter)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/encounters/{encounter_id}/cancel", response_model=EncounterResponse)
async def cancel_encounter(
    encounter_id: uuid.UUID,
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Cancelar un encuentro clinico."""
    service = EncounterService(db)
    try:
        encounter = await service.cancel_encounter(
            encounter_id, updated_by=current_user.id
        )
        if not encounter:
            raise HTTPException(status_code=404, detail="Encuentro no encontrado")
        return EncounterResponse.model_validate(encounter)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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


@router.get("/notes/{note_id}", response_model=ClinicalNoteResponse)
async def get_clinical_note(
    note_id: uuid.UUID,
    current_user: User = Depends(require_permissions("encounters:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener una nota clinica por ID."""
    service = ClinicalNoteService(db)
    note = await service.get_note(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return ClinicalNoteResponse.model_validate(note)


@router.get("/encounters/{encounter_id}/notes", response_model=list[ClinicalNoteResponse])
async def get_encounter_notes(
    encounter_id: uuid.UUID,
    current_user: User = Depends(require_permissions("encounters:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar notas de un encuentro."""
    service = ClinicalNoteService(db)
    notes = await service.get_encounter_notes(encounter_id)
    return [ClinicalNoteResponse.model_validate(n) for n in notes]


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


@router.patch("/diagnoses/{diagnosis_id}", response_model=DiagnosisResponse)
async def update_diagnosis(
    diagnosis_id: uuid.UUID,
    data: DiagnosisUpdate,
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Actualizar un diagnostico (ej: marcar como resuelto)."""
    service = DiagnosisService(db)
    diagnosis = await service.update_diagnosis(
        diagnosis_id, data, updated_by=current_user.id
    )
    if not diagnosis:
        raise HTTPException(status_code=404, detail="Diagnostico no encontrado")
    return DiagnosisResponse.model_validate(diagnosis)


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


@router.patch("/allergies/{allergy_id}", response_model=AllergyResponse)
async def update_allergy(
    allergy_id: uuid.UUID,
    data: AllergyUpdate,
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Actualizar una alergia."""
    service = AllergyService(db)
    allergy = await service.update_allergy(
        allergy_id, data, updated_by=current_user.id
    )
    if not allergy:
        raise HTTPException(status_code=404, detail="Alergia no encontrada")
    return AllergyResponse.model_validate(allergy)


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


@router.get("/orders/{order_id}", response_model=MedicalOrderResponse)
async def get_medical_order(
    order_id: uuid.UUID,
    current_user: User = Depends(require_permissions("orders:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener una orden medica por ID."""
    service = MedicalOrderService(db)
    order = await service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return MedicalOrderResponse.model_validate(order)


@router.get("/encounters/{encounter_id}/orders", response_model=list[MedicalOrderResponse])
async def get_encounter_orders(
    encounter_id: uuid.UUID,
    current_user: User = Depends(require_permissions("orders:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar ordenes de un encuentro."""
    service = MedicalOrderService(db)
    orders = await service.get_encounter_orders(encounter_id)
    return [MedicalOrderResponse.model_validate(o) for o in orders]


# =============================================
# Lista de Problemas
# =============================================

@router.post("/problem-list", response_model=ProblemListResponse, status_code=status.HTTP_201_CREATED)
async def add_problem(
    data: ProblemListCreate,
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Agregar un problema a la lista del paciente."""
    service = ProblemListService(db)
    problem = await service.add_problem(data, created_by=current_user.id)
    return ProblemListResponse.model_validate(problem)


@router.get("/patients/{patient_id}/problem-list", response_model=list[ProblemListResponse])
async def get_patient_problems(
    patient_id: uuid.UUID,
    problem_status: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(require_permissions("encounters:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener la lista de problemas activos de un paciente."""
    service = ProblemListService(db)
    problems = await service.get_patient_problems(patient_id, status=problem_status)
    return [ProblemListResponse.model_validate(p) for p in problems]


@router.patch("/problem-list/{problem_id}", response_model=ProblemListResponse)
async def update_problem(
    problem_id: uuid.UUID,
    data: ProblemListUpdate,
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Actualizar un problema (ej: marcar como resuelto)."""
    service = ProblemListService(db)
    problem = await service.update_problem(
        problem_id, data, updated_by=current_user.id
    )
    if not problem:
        raise HTTPException(status_code=404, detail="Problema no encontrado")
    return ProblemListResponse.model_validate(problem)


@router.delete("/problem-list/{problem_id}", response_model=MessageResponse)
async def remove_problem(
    problem_id: uuid.UUID,
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Eliminar un problema de la lista."""
    service = ProblemListService(db)
    removed = await service.remove_problem(problem_id, updated_by=current_user.id)
    if not removed:
        raise HTTPException(status_code=404, detail="Problema no encontrado")
    return MessageResponse(message="Problema eliminado de la lista")


# =============================================
# Plantillas Clinicas
# =============================================

@router.post("/templates", response_model=ClinicalTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: ClinicalTemplateCreate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Crear una plantilla clinica (solo admin)."""
    service = ClinicalTemplateService(db)
    template = await service.create_template(
        data.model_dump(), created_by=current_user.id
    )
    return ClinicalTemplateResponse.model_validate(template)


@router.get("/templates", response_model=list[ClinicalTemplateResponse])
async def list_templates(
    specialty_code: str | None = None,
    template_type: str | None = None,
    current_user: User = Depends(require_permissions("encounters:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar plantillas clinicas con filtros opcionales."""
    service = ClinicalTemplateService(db)
    templates = await service.list_templates(
        specialty_code=specialty_code, template_type=template_type
    )
    return [ClinicalTemplateResponse.model_validate(t) for t in templates]


@router.get("/templates/{template_id}", response_model=ClinicalTemplateResponse)
async def get_template(
    template_id: uuid.UUID,
    current_user: User = Depends(require_permissions("encounters:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener una plantilla clinica por ID."""
    service = ClinicalTemplateService(db)
    template = await service.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return ClinicalTemplateResponse.model_validate(template)


@router.patch("/templates/{template_id}", response_model=ClinicalTemplateResponse)
async def update_template(
    template_id: uuid.UUID,
    data: ClinicalTemplateUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Actualizar una plantilla clinica (solo admin)."""
    service = ClinicalTemplateService(db)
    update_data = data.model_dump(exclude_unset=True)
    template = await service.update_template(template_id, update_data, updated_by=current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return ClinicalTemplateResponse.model_validate(template)


@router.delete("/templates/{template_id}", response_model=MessageResponse)
async def delete_template(
    template_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Eliminar una plantilla clinica (solo admin)."""
    service = ClinicalTemplateService(db)
    deleted = await service.delete_template(template_id, updated_by=current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return MessageResponse(message="Plantilla eliminada")


# =============================================
# Archivos Adjuntos
# =============================================

@router.post(
    "/encounters/{encounter_id}/attachments",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    encounter_id: uuid.UUID,
    file: UploadFile = File(...),
    description: str | None = Query(default=None),
    category: str = Query(default="general"),
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Subir un archivo adjunto a un encuentro clínico."""
    from app.core.database import current_tenant

    # Validar que el encuentro existe
    service = EncounterService(db)
    encounter = await service.get_encounter(encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encuentro no encontrado")

    # Leer contenido
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    storage = get_storage_service()
    tenant_id = current_tenant.get() or "public"
    key = storage.generate_key(tenant_id, "attachments", file.filename or "file")

    try:
        result = await storage.upload_file(
            file_content=content,
            key=key,
            content_type=file.content_type or "application/octet-stream",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Crear registro en BD
    attachment = EncounterAttachment(
        encounter_id=encounter_id,
        file_key=result["file_key"],
        file_name=file.filename or "file",
        file_type=file.content_type or "application/octet-stream",
        file_size=result["file_size"],
        description=description,
        category=category,
        uploaded_by=current_user.id,
        created_by=current_user.id,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return AttachmentResponse.model_validate(attachment)


@router.get(
    "/encounters/{encounter_id}/attachments",
    response_model=list[AttachmentResponse],
)
async def list_attachments(
    encounter_id: uuid.UUID,
    current_user: User = Depends(require_permissions("encounters:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar archivos adjuntos de un encuentro."""
    result = await db.execute(
        select(EncounterAttachment)
        .where(
            EncounterAttachment.encounter_id == encounter_id,
            EncounterAttachment.is_active == True,
        )
        .order_by(EncounterAttachment.created_at.desc())
    )
    attachments = result.scalars().all()
    return [AttachmentResponse.model_validate(a) for a in attachments]


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: uuid.UUID,
    current_user: User = Depends(require_permissions("encounters:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener URL pre-firmada para descargar un archivo adjunto."""
    result = await db.execute(
        select(EncounterAttachment).where(EncounterAttachment.id == attachment_id)
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    storage = get_storage_service()
    url = await storage.get_presigned_url(attachment.file_key, expires_in=3600)
    return RedirectResponse(url=url, status_code=307)


@router.delete("/attachments/{attachment_id}", response_model=MessageResponse)
async def delete_attachment(
    attachment_id: uuid.UUID,
    current_user: User = Depends(require_permissions("encounters:write")),
    db: AsyncSession = Depends(get_db),
):
    """Eliminar un archivo adjunto (soft delete + eliminar de S3)."""
    result = await db.execute(
        select(EncounterAttachment).where(EncounterAttachment.id == attachment_id)
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    # Eliminar de S3
    storage = get_storage_service()
    await storage.delete_file(attachment.file_key)

    # Soft delete en BD
    attachment.is_active = False
    await db.commit()

    return MessageResponse(message="Archivo eliminado")
