"""
CDS API routes.

Endpoints for medication safety checks, drug interaction CRUD,
alert override auditing, and CDS Hooks standard (HL7 CDS Hooks 2.0).
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import require_roles
from app.modules.auth.models import User
from app.modules.cds.schemas import (
    CDSAlertOverrideCreate,
    CDSAlertOverrideResponse,
    CDSCard,
    CDSCardSource,
    CDSCheckRequest,
    CDSCheckResponse,
    CDSHooksDiscoveryResponse,
    CDSHooksRequest,
    CDSHooksResponse,
    CDSHooksService,
    DrugInteractionCreate,
    DrugInteractionResponse,
)
from app.modules.cds.service import CDSService

router = APIRouter()


# ============================================================
# CDS Medication Check
# ============================================================


@router.post("/check", response_model=CDSCheckResponse)
async def check_medication_cds(
    data: CDSCheckRequest,
    current_user: User = Depends(require_roles("medico", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Run CDS checks for a medication before prescribing.
    Returns drug interactions, allergy alerts, and duplicate therapy warnings.
    """
    service = CDSService(db)
    return await service.check_medication(
        patient_id=data.patient_id,
        medication_name=data.medication_name,
        product_id=data.product_id,
    )


# ============================================================
# CDS Alert Override (audit trail)
# ============================================================


@router.post("/overrides", response_model=CDSAlertOverrideResponse, status_code=201)
async def record_alert_override(
    data: CDSAlertOverrideCreate,
    current_user: User = Depends(require_roles("medico", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Record a CDS alert override with mandatory reason (audit trail)."""
    service = CDSService(db)
    override = await service.record_override(data, overridden_by=current_user.id)
    return CDSAlertOverrideResponse.model_validate(override)


@router.get(
    "/overrides/patient/{patient_id}",
    response_model=list[CDSAlertOverrideResponse],
)
async def get_patient_overrides(
    patient_id: uuid.UUID,
    current_user: User = Depends(require_roles("medico", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get CDS alert override history for a patient."""
    service = CDSService(db)
    overrides = await service.override_repo.find_by_patient(patient_id)
    return [CDSAlertOverrideResponse.model_validate(o) for o in overrides]


# ============================================================
# Drug Interactions CRUD
# ============================================================


@router.get("/interactions", response_model=dict)
async def list_interactions(
    query: str | None = Query(None, description="Search drug name"),
    severity: str | None = Query(None, description="Filter by severity"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_roles("medico", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """List drug interactions with optional filters."""
    service = CDSService(db)
    offset = (page - 1) * page_size
    items, total = await service.list_interactions(
        query=query, severity=severity, offset=offset, limit=page_size
    )
    return {
        "items": [DrugInteractionResponse.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post(
    "/interactions", response_model=DrugInteractionResponse, status_code=201
)
async def create_interaction(
    data: DrugInteractionCreate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Add a new drug interaction to the local knowledge base (admin only)."""
    service = CDSService(db)
    interaction = await service.create_interaction(
        data.model_dump(), created_by=current_user.id
    )
    return DrugInteractionResponse.model_validate(interaction)


@router.delete("/interactions/{interaction_id}", status_code=204)
async def delete_interaction(
    interaction_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a drug interaction (admin only)."""
    service = CDSService(db)
    result = await service.delete_interaction(interaction_id)
    if not result:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Interaction not found")


# ============================================================
# CDS Hooks Standard (HL7 CDS Hooks 2.0)
# ============================================================


CDS_SERVICES = [
    CDSHooksService(
        hook="order-select",
        title="Drug Interaction Check",
        description="Checks drug-drug interactions and allergies when ordering medication",
        id="hmis-drug-interaction-check",
        prefetch={
            "patient": "Patient/{{context.patientId}}",
            "medications": "MedicationRequest?patient={{context.patientId}}&status=active",
        },
    ),
    CDSHooksService(
        hook="order-sign",
        title="Prescription Safety Check",
        description="Final safety check before signing a medication order",
        id="hmis-prescription-safety-check",
        prefetch={
            "patient": "Patient/{{context.patientId}}",
        },
    ),
]

_INDICATOR_MAP = {
    "critical": "critical",
    "major": "warning",
    "moderate": "info",
    "minor": "info",
}


@router.get("/cds-services", response_model=CDSHooksDiscoveryResponse)
async def cds_hooks_discovery():
    """CDS Hooks discovery endpoint (HL7 CDS Hooks 2.0)."""
    return CDSHooksDiscoveryResponse(services=CDS_SERVICES)


@router.post("/cds-services/{service_id}", response_model=CDSHooksResponse)
async def invoke_cds_hook(
    service_id: str,
    request: CDSHooksRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    CDS Hooks invocation endpoint.
    Processes hook context and returns CDS cards.
    """
    if service_id not in (
        "hmis-drug-interaction-check",
        "hmis-prescription-safety-check",
    ):
        return CDSHooksResponse(cards=[])

    patient_id_str = request.context.get("patientId")
    if not patient_id_str:
        return CDSHooksResponse(cards=[])

    try:
        patient_uuid = uuid.UUID(patient_id_str)
    except (ValueError, TypeError):
        return CDSHooksResponse(cards=[])

    # Extract medications from draftOrders (FHIR Bundle)
    draft_orders = request.context.get("draftOrders", {})
    entries = draft_orders.get("entry", [])

    cards: list[CDSCard] = []
    service = CDSService(db)

    for entry in entries:
        resource = entry.get("resource", {})
        med_concept = resource.get("medicationCodeableConcept", {})
        med_name = med_concept.get("text", "")

        if not med_name:
            continue

        result = await service.check_medication(
            patient_id=patient_uuid,
            medication_name=med_name,
        )

        for alert in result.alerts:
            cards.append(
                CDSCard(
                    uuid=str(uuid.uuid4()),
                    summary=alert.summary,
                    detail=alert.detail,
                    indicator=_INDICATOR_MAP.get(alert.severity, "info"),
                    source=CDSCardSource(
                        label="HMIS Clinical Decision Support",
                    ),
                )
            )

    return CDSHooksResponse(cards=cards)
