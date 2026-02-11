"""
FHIR R4 REST API endpoints.

Implements FHIR-compliant HTTP operations for Patient resource.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.smart.dependencies import FHIRAuthContext, get_fhir_auth, require_smart_scope
from app.modules.fhir.capability import generate_capability_statement
from app.modules.fhir.converters import validate_fhir_encounter, validate_fhir_patient
from app.modules.fhir.schemas import FHIROperationOutcome, PatientSearchParams
from app.modules.fhir.service import FHIRService
from app.shared.exceptions import ConflictError, DomainException, NotFoundError, ValidationError

router = APIRouter()


def get_base_url(request: Request) -> str:
    """Extract base URL from request."""
    url = str(request.url_for("search_patients"))
    return url.replace("/Patient", "")


@router.get("/metadata", status_code=status.HTTP_200_OK)
async def get_capability_statement(request: Request):
    """
    Get FHIR CapabilityStatement.

    This endpoint describes the server's capabilities, supported resources,
    and operations. It does not require authentication per FHIR spec.

    Returns:
        CapabilityStatement resource
    """
    base_url = get_base_url(request)
    capability = generate_capability_statement(base_url)
    return JSONResponse(content=capability.model_dump(mode="json", exclude_none=True))


@router.get("/Patient", status_code=status.HTTP_200_OK, name="search_patients")
async def search_patients(
    id: str | None = Query(None, alias="_id"),
    identifier: str | None = None,
    family: str | None = None,
    given: str | None = None,
    birthdate: str | None = None,
    gender: str | None = None,
    count: int = Query(20, alias="_count"),
    offset: int = Query(0, alias="_offset"),
    request: Request = None,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Search patients with FHIR parameters.

    Supports FHIR search parameters:
    - _id: Logical ID
    - identifier: Patient identifier (MRN or document)
    - family: Family name
    - given: Given name
    - birthdate: Birth date (YYYY-MM-DD)
    - gender: male, female, other, unknown
    - _count: Results per page (max 100)
    - _offset: Skip results

    Returns:
        Bundle of Patient resources
    """
    try:
        # Build search params
        params = PatientSearchParams(
            id=id,
            identifier=identifier,
            family=family,
            given=given,
            birthdate=birthdate,
            gender=gender,
            count=min(count, 100),  # Enforce max
            offset=offset,
        )

        # Search
        base_url = get_base_url(request)
        service = FHIRService(db, base_url)
        bundle = await service.search_patients(params)

        return JSONResponse(content=bundle.model_dump(mode="json", exclude_none=True))

    except ValidationError as e:
        outcome = FHIROperationOutcome.error(e.message, "invalid")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


@router.get("/Patient/{patient_id}", status_code=status.HTTP_200_OK)
async def get_patient(
    patient_id: str,
    request: Request = None,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Get single patient by ID.

    Args:
        patient_id: Patient UUID

    Returns:
        Patient resource

    Raises:
        404: Patient not found
    """
    try:
        # Parse UUID
        try:
            patient_uuid = uuid.UUID(patient_id)
        except ValueError:
            outcome = FHIROperationOutcome.error(f"Invalid patient ID: {patient_id}", "invalid")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=outcome.model_dump(mode="json", exclude_none=True),
            )

        # Get patient
        base_url = get_base_url(request)
        service = FHIRService(db, base_url)
        fhir_patient = await service.get_patient_by_id(patient_uuid)

        return JSONResponse(content=fhir_patient.model_dump(mode="json", exclude_none=True))

    except NotFoundError as e:
        outcome = FHIROperationOutcome.error(e.message, "not-found")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


@router.post("/Patient", status_code=status.HTTP_201_CREATED)
async def create_patient(
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Create new patient from FHIR Patient resource.

    Expects FHIR Patient JSON in request body.

    Returns:
        201 Created with Location header and Patient resource

    Raises:
        400: Invalid FHIR resource
        409: Patient already exists
    """
    try:
        # Parse request body
        body = await request.json()

        # Validate FHIR Patient
        fhir_patient = validate_fhir_patient(body)

        # Create patient
        base_url = get_base_url(request)
        service = FHIRService(db, base_url)
        created_patient = await service.create_patient(fhir_patient, auth.user_id)

        # Build response with Location header
        location = f"{base_url}/Patient/{created_patient.id}"
        headers = {"Location": location}

        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content=created_patient.model_dump(mode="json", exclude_none=True),
            headers=headers,
        )

    except ValidationError as e:
        outcome = FHIROperationOutcome.error(e.message, "invalid")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except ConflictError as e:
        outcome = FHIROperationOutcome.error(e.message, "duplicate")
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


@router.put("/Patient/{patient_id}", status_code=status.HTTP_200_OK)
async def update_patient(
    patient_id: str,
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Update existing patient from FHIR Patient resource.

    Note: MRN and document cannot be changed (business rule).

    Args:
        patient_id: Patient UUID

    Returns:
        200 OK with updated Patient resource

    Raises:
        400: Invalid FHIR resource
        404: Patient not found
    """
    try:
        # Parse UUID
        try:
            patient_uuid = uuid.UUID(patient_id)
        except ValueError:
            outcome = FHIROperationOutcome.error(f"Invalid patient ID: {patient_id}", "invalid")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=outcome.model_dump(mode="json", exclude_none=True),
            )

        # Parse request body
        body = await request.json()

        # Validate FHIR Patient
        fhir_patient = validate_fhir_patient(body)

        # Update patient
        base_url = get_base_url(request)
        service = FHIRService(db, base_url)
        updated_patient = await service.update_patient(patient_uuid, fhir_patient, auth.user_id)

        return JSONResponse(content=updated_patient.model_dump(mode="json", exclude_none=True))

    except ValidationError as e:
        outcome = FHIROperationOutcome.error(e.message, "invalid")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except NotFoundError as e:
        outcome = FHIROperationOutcome.error(e.message, "not-found")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


@router.delete("/Patient/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: str,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete (soft delete) patient.

    Args:
        patient_id: Patient UUID

    Returns:
        204 No Content

    Raises:
        404: Patient not found
    """
    try:
        # Parse UUID
        try:
            patient_uuid = uuid.UUID(patient_id)
        except ValueError:
            outcome = FHIROperationOutcome.error(f"Invalid patient ID: {patient_id}", "invalid")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=outcome.model_dump(mode="json", exclude_none=True),
            )

        # Delete patient
        service = FHIRService(db)
        await service.delete_patient(patient_uuid, auth.user_id)

        return Response(status_code=status.HTTP_204_NO_CONTENT)

    except NotFoundError as e:
        outcome = FHIROperationOutcome.error(e.message, "not-found")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
# This content will be appended to routes.py

# ============================================================================
# ENCOUNTER ENDPOINTS
# ============================================================================


@router.get("/Encounter", status_code=status.HTTP_200_OK, name="search_encounters")
async def search_encounters(
    patient: str | None = None,
    date: str | None = None,
    type: str | None = Query(None, alias="type"),
    encounter_status: str | None = Query(None, alias="status"),
    count: int = Query(20, alias="_count"),
    offset: int = Query(0, alias="_offset"),
    request: Request = None,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Search encounters with FHIR parameters.

    Supports FHIR search parameters:
    - patient: Reference to patient (Patient/{id})
    - date: Date range (ge2024-01-01 or 2024-01-01)
    - type: Encounter type (ambulatory, emergency, inpatient)
    - status: Encounter status (in-progress, finished, cancelled)
    - _count: Results per page (max 100)
    - _offset: Skip results

    Returns:
        Bundle of Encounter resources
    """
    try:
        # Parse patient reference
        patient_id = None
        if patient:
            if "/" in patient:
                patient_id = uuid.UUID(patient.split("/")[-1])
            else:
                patient_id = uuid.UUID(patient)

        # Parse date parameter (simplified - just single date for now)
        date_from = None
        date_to = None
        if date:
            # Remove FHIR prefixes (ge, le, etc.)
            clean_date = date.replace("ge", "").replace("le", "")
            try:
                from datetime import datetime
                parsed_date = datetime.strptime(clean_date, "%Y-%m-%d").date()
                if "ge" in date:
                    date_from = parsed_date
                elif "le" in date:
                    date_to = parsed_date
                else:
                    date_from = parsed_date
                    date_to = parsed_date
            except ValueError:
                pass

        # Search
        base_url = get_base_url(request)
        service = FHIRService(db, base_url)
        bundle = await service.search_encounters(
            patient_id=patient_id,
            date_from=date_from,
            date_to=date_to,
            encounter_type=type,
            status=encounter_status,
            count=min(count, 100),
            offset=offset,
        )

        return JSONResponse(content=bundle.model_dump(mode="json", exclude_none=True))

    except ValidationError as e:
        outcome = FHIROperationOutcome.error(e.message, "invalid")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


@router.get("/Encounter/{encounter_id}", status_code=status.HTTP_200_OK)
async def get_encounter(
    encounter_id: str,
    request: Request = None,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Get single encounter by ID.

    Args:
        encounter_id: Encounter UUID

    Returns:
        Encounter resource

    Raises:
        404: Encounter not found
    """
    try:
        # Parse UUID
        try:
            encounter_uuid = uuid.UUID(encounter_id)
        except ValueError:
            outcome = FHIROperationOutcome.error(f"Invalid encounter ID: {encounter_id}", "invalid")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=outcome.model_dump(mode="json", exclude_none=True),
            )

        # Get encounter
        base_url = get_base_url(request)
        service = FHIRService(db, base_url)
        fhir_encounter = await service.get_encounter_by_id(encounter_uuid)

        return JSONResponse(content=fhir_encounter.model_dump(mode="json", exclude_none=True))

    except NotFoundError as e:
        outcome = FHIROperationOutcome.error(e.message, "not-found")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


@router.post("/Encounter", status_code=status.HTTP_201_CREATED)
async def create_encounter(
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Create new encounter from FHIR Encounter resource.

    Expects FHIR Encounter JSON in request body.

    Returns:
        201 Created with Location header and Encounter resource

    Raises:
        400: Invalid FHIR resource
        404: Referenced patient not found
    """
    try:
        # Parse request body
        body = await request.json()

        # Validate FHIR Encounter
        fhir_encounter = validate_fhir_encounter(body)

        # Create encounter
        base_url = get_base_url(request)
        service = FHIRService(db, base_url)
        created_encounter = await service.create_encounter(fhir_encounter, auth.user_id)

        # Build response with Location header
        location = f"{base_url}/Encounter/{created_encounter.id}"
        headers = {"Location": location}

        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content=created_encounter.model_dump(mode="json", exclude_none=True),
            headers=headers,
        )

    except ValidationError as e:
        outcome = FHIROperationOutcome.error(e.message, "invalid")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except NotFoundError as e:
        outcome = FHIROperationOutcome.error(e.message, "not-found")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


@router.put("/Encounter/{encounter_id}", status_code=status.HTTP_200_OK)
async def update_encounter(
    encounter_id: str,
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Update existing encounter from FHIR Encounter resource.

    Note: Patient reference cannot be changed (business rule).

    Args:
        encounter_id: Encounter UUID

    Returns:
        200 OK with updated Encounter resource

    Raises:
        400: Invalid FHIR resource
        404: Encounter not found
    """
    try:
        # Parse UUID
        try:
            encounter_uuid = uuid.UUID(encounter_id)
        except ValueError:
            outcome = FHIROperationOutcome.error(f"Invalid encounter ID: {encounter_id}", "invalid")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=outcome.model_dump(mode="json", exclude_none=True),
            )

        # Parse request body
        body = await request.json()

        # Validate FHIR Encounter
        fhir_encounter = validate_fhir_encounter(body)

        # Update encounter
        base_url = get_base_url(request)
        service = FHIRService(db, base_url)
        updated_encounter = await service.update_encounter(encounter_uuid, fhir_encounter, auth.user_id)

        return JSONResponse(content=updated_encounter.model_dump(mode="json", exclude_none=True))

    except ValidationError as e:
        outcome = FHIROperationOutcome.error(e.message, "invalid")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except NotFoundError as e:
        outcome = FHIROperationOutcome.error(e.message, "not-found")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )



# ============================================================================
# OBSERVATION RESOURCE (Vital Signs)
# ============================================================================


@router.get("/Observation", status_code=status.HTTP_200_OK, name="search_observations")
async def search_observations(
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
    patient: str | None = None,
    encounter: str | None = None,
    category: str | None = None,
    code: str | None = None,
    date: str | None = None,
    count: int = Query(20, alias="_count", ge=1, le=100),
    offset: int = Query(0, alias="_offset", ge=0),
):
    """
    Search FHIR Observations (vital signs).

    Query Parameters:
        patient: Patient reference (Patient/{id})
        encounter: Encounter reference (Encounter/{id})
        category: vital-signs or laboratory
        code: LOINC code (e.g., 8310-5 for temperature)
        date: Observation date (ISO format)
        _count: Results per page (1-100, default 20)
        _offset: Pagination offset (default 0)

    Returns:
        FHIR Bundle with Observation resources
    """
    base_url = get_base_url(request)
    service = FHIRService(db, base_url)

    try:
        # Parse patient reference
        patient_id = None
        if patient:
            if "/" in patient:
                patient_id = UUID(patient.split("/")[-1])
            else:
                patient_id = UUID(patient)

        # Parse encounter reference
        encounter_id = None
        if encounter:
            if "/" in encounter:
                encounter_id = UUID(encounter.split("/")[-1])
            else:
                encounter_id = UUID(encounter)

        # Parse date parameter
        date_from = None
        date_to = None
        if date:
            # Simple date parsing (could be enhanced for ranges)
            from datetime import date as dt_date
            date_from = dt_date.fromisoformat(date)
            date_to = date_from

        # Search observations
        bundle = await service.search_observations(
            patient_id=patient_id,
            encounter_id=encounter_id,
            category=category,
            code=code,
            date_from=date_from,
            date_to=date_to,
            count=count,
            offset=offset,
        )

        return JSONResponse(content=bundle.model_dump(mode="json", exclude_none=True))

    except ValueError as e:
        outcome = FHIROperationOutcome.error(f"Invalid parameter: {str(e)}", "value")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


@router.get("/Observation/{observation_id}", status_code=status.HTTP_200_OK, name="get_observation")
async def get_observation(
    observation_id: str,
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Get FHIR Observation by composite ID.

    Observation IDs are composite: {vital_signs_id}-{type}
    Example: abc123-temp, abc123-bp

    Path Parameters:
        observation_id: Composite observation ID

    Returns:
        FHIR Observation resource
    """
    base_url = get_base_url(request)
    service = FHIRService(db, base_url)

    try:
        observation = await service.get_observation_by_id(observation_id)
        return JSONResponse(content=observation.model_dump(mode="json", exclude_none=True))

    except NotFoundError as e:
        outcome = FHIROperationOutcome.error(str(e.message), "not-found")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


# =============================================
# Condition Resource Endpoints
# =============================================

@router.get("/Condition", status_code=status.HTTP_200_OK, name="search_conditions")
async def search_conditions(
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
    patient: str | None = None,
    encounter: str | None = None,
    category: str | None = None,
    clinical_status: str | None = Query(None, alias="clinical-status"),
    code: str | None = None,
    onset_date: str | None = Query(None, alias="onset-date"),
    count: int = Query(20, alias="_count", ge=1, le=100),
    offset: int = Query(0, alias="_offset", ge=0),
):
    """
    Search FHIR Conditions (diagnoses and problem list items).
    
    Query Parameters:
        patient: Patient reference (Patient/{id})
        encounter: Encounter reference (Encounter/{id})
        category: encounter-diagnosis or problem-list-item
        clinical-status: active, resolved, inactive
        code: ICD-10 code (e.g., J00 for acute nasopharyngitis)
        onset-date: Onset date (ISO format)
        _count: Results per page (1-100, default 20)
        _offset: Pagination offset (default 0)
        
    Returns:
        FHIR Bundle with Condition resources
    """
    base_url = get_base_url(request)
    service = FHIRService(db, base_url)
    
    try:
        # Parse patient reference
        patient_id = None
        if patient:
            if "/" in patient:
                patient_id = UUID(patient.split("/")[-1])
            else:
                patient_id = UUID(patient)
        
        # Parse encounter reference
        encounter_id = None
        if encounter:
            if "/" in encounter:
                encounter_id = UUID(encounter.split("/")[-1])
            else:
                encounter_id = UUID(encounter)
        
        # Parse onset date parameter
        onset_date_from = None
        onset_date_to = None
        if onset_date:
            from datetime import date as dt_date
            onset_date_from = dt_date.fromisoformat(onset_date)
            onset_date_to = onset_date_from
        
        # Search conditions
        bundle = await service.search_conditions(
            patient_id=patient_id,
            encounter_id=encounter_id,
            category=category,
            clinical_status=clinical_status,
            code=code,
            onset_date_from=onset_date_from,
            onset_date_to=onset_date_to,
            count=count,
            offset=offset,
        )
        
        return JSONResponse(content=bundle.model_dump(mode="json", exclude_none=True))
    
    except ValueError as e:
        outcome = FHIROperationOutcome.error(f"Invalid parameter: {str(e)}", "value")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


@router.get("/Condition/{condition_id}", status_code=status.HTTP_200_OK, name="get_condition")
async def get_condition(
    condition_id: str,
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Get FHIR Condition by ID.
    
    Path Parameters:
        condition_id: Condition UUID
        
    Returns:
        FHIR Condition resource
    """
    base_url = get_base_url(request)
    service = FHIRService(db, base_url)
    
    try:
        # Parse UUID
        try:
            condition_uuid = UUID(condition_id)
        except ValueError:
            outcome = FHIROperationOutcome.error(f"Invalid condition ID: {condition_id}", "invalid")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=outcome.model_dump(mode="json", exclude_none=True),
            )
        
        condition = await service.get_condition_by_id(condition_uuid)
        return JSONResponse(content=condition.model_dump(mode="json", exclude_none=True))
    
    except NotFoundError as e:
        outcome = FHIROperationOutcome.error(str(e.message), "not-found")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


# =============================================
# MedicationRequest Resource Endpoints
# =============================================

@router.get("/MedicationRequest", status_code=status.HTTP_200_OK, name="search_medication_requests")
async def search_medication_requests(
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
    patient: str | None = None,
    encounter: str | None = None,
    status_param: str | None = Query(None, alias="status"),
    intent: str | None = None,
    authoredon: str | None = None,
    count: int = Query(20, alias="_count", ge=1, le=100),
    offset: int = Query(0, alias="_offset", ge=0),
):
    """
    Search FHIR MedicationRequests (prescriptions).
    
    Query Parameters:
        patient: Patient reference (Patient/{id})
        encounter: Encounter reference (Encounter/{id})
        status: active, completed, cancelled, stopped
        intent: order (all prescriptions are orders)
        authoredon: Prescription date (ISO format)
        _count: Results per page (1-100, default 20)
        _offset: Pagination offset (default 0)
        
    Returns:
        FHIR Bundle with MedicationRequest resources
    """
    base_url = get_base_url(request)
    service = FHIRService(db, base_url)
    
    try:
        # Parse patient reference
        patient_id = None
        if patient:
            if "/" in patient:
                patient_id = UUID(patient.split("/")[-1])
            else:
                patient_id = UUID(patient)
        
        # Parse encounter reference
        encounter_id = None
        if encounter:
            if "/" in encounter:
                encounter_id = UUID(encounter.split("/")[-1])
            else:
                encounter_id = UUID(encounter)
        
        # Parse authoredon date parameter
        authoredon_from = None
        authoredon_to = None
        if authoredon:
            from datetime import date as dt_date
            authoredon_from = dt_date.fromisoformat(authoredon)
            authoredon_to = authoredon_from
        
        # Search medication requests
        bundle = await service.search_medication_requests(
            patient_id=patient_id,
            encounter_id=encounter_id,
            status=status_param,
            intent=intent,
            authoredon_from=authoredon_from,
            authoredon_to=authoredon_to,
            count=count,
            offset=offset,
        )
        
        return JSONResponse(content=bundle.model_dump(mode="json", exclude_none=True))
    
    except ValueError as e:
        outcome = FHIROperationOutcome.error(f"Invalid parameter: {str(e)}", "value")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


@router.get("/MedicationRequest/{medication_request_id}", status_code=status.HTTP_200_OK, name="get_medication_request")
async def get_medication_request(
    medication_request_id: str,
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Get FHIR MedicationRequest by ID.
    
    Path Parameters:
        medication_request_id: MedicationRequest UUID
        
    Returns:
        FHIR MedicationRequest resource
    """
    base_url = get_base_url(request)
    service = FHIRService(db, base_url)
    
    try:
        # Parse UUID
        try:
            med_request_uuid = UUID(medication_request_id)
        except ValueError:
            outcome = FHIROperationOutcome.error(f"Invalid medication request ID: {medication_request_id}", "invalid")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=outcome.model_dump(mode="json", exclude_none=True),
            )
        
        medication_request = await service.get_medication_request_by_id(med_request_uuid)
        return JSONResponse(content=medication_request.model_dump(mode="json", exclude_none=True))
    
    except NotFoundError as e:
        outcome = FHIROperationOutcome.error(str(e.message), "not-found")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


# =============================================
# AllergyIntolerance Resource Endpoints
# =============================================

@router.get("/AllergyIntolerance", status_code=status.HTTP_200_OK, name="search_allergy_intolerances")
async def search_allergy_intolerances(
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
    patient: str | None = None,
    clinical_status: str | None = Query(None, alias="clinical-status"),
    category: str | None = None,
    allergy_type: str | None = Query(None, alias="type"),
    count: int = Query(20, alias="_count", ge=1, le=100),
    offset: int = Query(0, alias="_offset", ge=0),
):
    """
    Search FHIR AllergyIntolerances (patient allergies).
    
    Query Parameters:
        patient: Patient reference (Patient/{id}) - REQUIRED
        clinical-status: active, inactive
        category: medication, food, environment, biologic
        type: allergy (all entries are allergies)
        _count: Results per page (1-100, default 20)
        _offset: Pagination offset (default 0)
        
    Returns:
        FHIR Bundle with AllergyIntolerance resources
    """
    base_url = get_base_url(request)
    service = FHIRService(db, base_url)
    
    try:
        # Parse patient reference
        patient_id = None
        if patient:
            if "/" in patient:
                patient_id = UUID(patient.split("/")[-1])
            else:
                patient_id = UUID(patient)
        
        # Search allergy intolerances
        bundle = await service.search_allergy_intolerances(
            patient_id=patient_id,
            clinical_status=clinical_status,
            category=category,
            allergy_type=allergy_type,
            count=count,
            offset=offset,
        )
        
        return JSONResponse(content=bundle.model_dump(mode="json", exclude_none=True))
    
    except ValueError as e:
        outcome = FHIROperationOutcome.error(f"Invalid parameter: {str(e)}", "value")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


@router.get("/AllergyIntolerance/{allergy_id}", status_code=status.HTTP_200_OK, name="get_allergy_intolerance")
async def get_allergy_intolerance(
    allergy_id: str,
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Get FHIR AllergyIntolerance by ID.
    
    Path Parameters:
        allergy_id: AllergyIntolerance UUID
        
    Returns:
        FHIR AllergyIntolerance resource
    """
    base_url = get_base_url(request)
    service = FHIRService(db, base_url)
    
    try:
        # Parse UUID
        try:
            allergy_uuid = UUID(allergy_id)
        except ValueError:
            outcome = FHIROperationOutcome.error(f"Invalid allergy ID: {allergy_id}", "invalid")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=outcome.model_dump(mode="json", exclude_none=True),
            )
        
        allergy_intolerance = await service.get_allergy_intolerance_by_id(allergy_uuid)
        return JSONResponse(content=allergy_intolerance.model_dump(mode="json", exclude_none=True))

    except NotFoundError as e:
        outcome = FHIROperationOutcome.error(str(e.message), "not-found")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


# =============================================
# Bundle Operations
# =============================================

@router.post("", status_code=status.HTTP_200_OK, name="process_bundle")
async def process_bundle(
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Process FHIR Bundle (batch or transaction).

    FHIR Batch: Process all entries independently, continue on error.
    FHIR Transaction: Atomic operation, rollback all changes on any error.

    Request Body:
        FHIR Bundle with type "batch" or "transaction"

    Returns:
        FHIR Bundle with type "batch-response" or "transaction-response"
        containing entry.response for each request
    """
    from fhir.resources.bundle import Bundle
    from app.modules.fhir.bundle_processor import BundleProcessor

    base_url = get_base_url(request)
    service = FHIRService(db, base_url)

    try:
        # Parse request body as FHIR Bundle
        body = await request.json()
        bundle = Bundle(**body)

        # Process bundle
        processor = BundleProcessor(db, service, auth.user_id)
        response_bundle = await processor.process_bundle(bundle)

        return JSONResponse(content=response_bundle.model_dump(mode="json", exclude_none=True))

    except ValidationError as e:
        outcome = FHIROperationOutcome.error(str(e.message), "invalid")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )


@router.get("/Patient/{patient_id}/$everything", status_code=status.HTTP_200_OK, name="patient_everything")
async def patient_everything(
    patient_id: str,
    request: Request,
    auth: FHIRAuthContext = Depends(get_fhir_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    FHIR $everything operation for Patient resource.

    Returns a comprehensive Bundle containing the Patient and all related resources:
    - Patient resource
    - All Encounters
    - All Observations (vital signs)
    - All Conditions (diagnoses + problem list)
    - All MedicationRequests (prescriptions)
    - All AllergyIntolerances

    This operation is useful for exporting a complete patient record.

    Path Parameters:
        patient_id: Patient UUID

    Returns:
        FHIR Bundle of type "searchset" with all patient-related resources
    """
    base_url = get_base_url(request)
    service = FHIRService(db, base_url)

    try:
        # Parse UUID
        try:
            patient_uuid = UUID(patient_id)
        except ValueError:
            outcome = FHIROperationOutcome.error(f"Invalid patient ID: {patient_id}", "invalid")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=outcome.model_dump(mode="json", exclude_none=True),
            )

        # Get comprehensive patient record
        bundle = await service.get_patient_everything(patient_uuid)
        return JSONResponse(content=bundle.model_dump(mode="json", exclude_none=True))

    except NotFoundError as e:
        outcome = FHIROperationOutcome.error(str(e.message), "not-found")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
    except Exception as e:
        outcome = FHIROperationOutcome.error(str(e), "exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=outcome.model_dump(mode="json", exclude_none=True),
        )
