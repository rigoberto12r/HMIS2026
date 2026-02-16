"""
C-CDA REST API Routes.

Endpoints for generating and downloading C-CDA documents.
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user
from app.modules.auth.models import User
from app.modules.ccda.service import CCDAService
from app.shared.exceptions import NotFoundError


router = APIRouter()


@router.get(
    "/patients/{patient_id}/ccd",
    status_code=status.HTTP_200_OK,
    name="get_patient_ccd",
    responses={
        200: {
            "content": {"application/xml": {}},
            "description": "C-CDA R2.1 CCD XML document",
        },
        404: {"description": "Patient not found"},
    },
)
async def get_patient_ccd(
    patient_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    encounter_id: str | None = None,
    download: bool = True,
):
    """
    Generate and download C-CDA R2.1 CCD for a patient.

    Returns a Continuity of Care Document containing:
    - Patient demographics
    - Allergies and intolerances
    - Medications
    - Problem list (diagnoses + chronic conditions)
    - Vital signs
    - Laboratory results
    - Procedures

    Path Parameters:
        patient_id: Patient UUID

    Query Parameters:
        encounter_id: Optional - Include only specific encounter
        download: Optional - Set Content-Disposition attachment (default: true)

    Returns:
        XML document with C-CDA R2.1 CCD

    Example:
        GET /api/v1/ccda/patients/abc-123/ccd
        GET /api/v1/ccda/patients/abc-123/ccd?encounter_id=xyz-456
        GET /api/v1/ccda/patients/abc-123/ccd?download=false (preview in browser)
    """
    try:
        # Validate UUIDs
        try:
            patient_uuid = UUID(patient_id)
            encounter_uuid = UUID(encounter_id) if encounter_id else None
        except ValueError:
            return Response(
                content="Invalid patient_id or encounter_id format",
                status_code=status.HTTP_400_BAD_REQUEST,
                media_type="text/plain",
            )

        # Create service
        service = CCDAService(db)

        # Generate CCD
        include_all = encounter_uuid is None
        ccd_xml = await service.generate_patient_ccd(
            patient_id=patient_uuid,
            author_user_id=current_user.id,
            include_all_encounters=include_all,
            encounter_id=encounter_uuid,
        )

        # Prepare response headers
        headers = {
            "X-Document-Type": "C-CDA-R2.1-CCD",
            "X-Generated-At": datetime.now(timezone.utc).isoformat(),
        }

        # Content-Disposition header
        if download:
            # Get patient MRN for filename
            # For now, use patient_id
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            filename = f"CCD_{patient_id[:8]}_{timestamp}.xml"
            headers["Content-Disposition"] = f'attachment; filename="{filename}"'
        else:
            headers["Content-Disposition"] = "inline"

        # Return XML response
        return Response(
            content=ccd_xml,
            status_code=status.HTTP_200_OK,
            media_type="application/xml",
            headers=headers,
        )

    except NotFoundError as e:
        return Response(
            content=f"Patient not found: {str(e.message)}",
            status_code=status.HTTP_404_NOT_FOUND,
            media_type="text/plain",
        )
    except Exception as e:
        return Response(
            content=f"Error generating CCD: {str(e)}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            media_type="text/plain",
        )


@router.get(
    "/patients/{patient_id}/ccd/preview",
    status_code=status.HTTP_200_OK,
    name="preview_patient_ccd",
    responses={
        200: {
            "content": {"text/xml": {}},
            "description": "C-CDA R2.1 CCD XML document (preview)",
        },
    },
)
async def preview_patient_ccd(
    patient_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    encounter_id: str | None = None,
):
    """
    Preview C-CDA R2.1 CCD in browser.

    Same as get_patient_ccd but with inline Content-Disposition
    for viewing in browser instead of downloading.

    Useful for testing and debugging.

    Path Parameters:
        patient_id: Patient UUID

    Query Parameters:
        encounter_id: Optional - Include only specific encounter

    Returns:
        XML document with C-CDA R2.1 CCD (inline)
    """
    # Reuse get_patient_ccd with download=False
    return await get_patient_ccd(
        patient_id=patient_id,
        current_user=current_user,
        db=db,
        encounter_id=encounter_id,
        download=False,
    )
