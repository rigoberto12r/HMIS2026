"""
API routes for the Custom Reporting System.
Endpoints for creating, executing, and managing reports.
"""

import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user, require_permissions
from app.modules.auth.models import User
from app.modules.reports.schemas import (
    ExportRequest,
    ExportResponse,
    PredefinedReportRequest,
    ReportDefinitionCreate,
    ReportDefinitionResponse,
    ReportDefinitionUpdate,
    ReportExecutionRequest,
    ReportExecutionResponse,
    ReportResultResponse,
    ReportTemplate,
    ReportTemplatesResponse,
    ScheduledReportCreate,
    ScheduledReportResponse,
    ScheduledReportUpdate,
)
from app.modules.reports.service import ReportService
from app.shared.schemas import MessageResponse, PaginatedResponse

router = APIRouter()


# ─── Report Definitions ──────────────────────────────────────


@router.post("/definitions", response_model=ReportDefinitionResponse, status_code=status.HTTP_201_CREATED)
async def create_report_definition(
    data: ReportDefinitionCreate,
    current_user: User = Depends(require_permissions("reports:create")),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a custom report definition.
    Allows users to save query configurations for reuse.
    """
    service = ReportService(db, current_user.tenant_id)
    definition = await service.create_report_definition(
        data.model_dump(), created_by=current_user.id
    )
    return ReportDefinitionResponse.model_validate(definition)


@router.get("/definitions", response_model=list[ReportDefinitionResponse])
async def list_report_definitions(
    report_type: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_permissions("reports:read")),
    db: AsyncSession = Depends(get_db),
):
    """
    List all report definitions.
    Filter by report type (clinical, financial, operational).
    """
    service = ReportService(db, current_user.tenant_id)
    definitions = await service.list_report_definitions(
        report_type=report_type, skip=skip, limit=limit
    )
    return [ReportDefinitionResponse.model_validate(d) for d in definitions]


@router.get("/definitions/{definition_id}", response_model=ReportDefinitionResponse)
async def get_report_definition(
    definition_id: uuid.UUID,
    current_user: User = Depends(require_permissions("reports:read")),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific report definition by ID."""
    service = ReportService(db, current_user.tenant_id)
    definition = await service.get_report_definition(definition_id)

    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report definition not found"
        )

    return ReportDefinitionResponse.model_validate(definition)


@router.put("/definitions/{definition_id}", response_model=ReportDefinitionResponse)
async def update_report_definition(
    definition_id: uuid.UUID,
    data: ReportDefinitionUpdate,
    current_user: User = Depends(require_permissions("reports:create")),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing report definition."""
    service = ReportService(db, current_user.tenant_id)
    definition = await service.get_report_definition(definition_id)

    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report definition not found"
        )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(definition, field, value)

    definition.updated_by = current_user.id
    await db.commit()
    await db.refresh(definition)

    return ReportDefinitionResponse.model_validate(definition)


@router.delete("/definitions/{definition_id}", response_model=MessageResponse)
async def delete_report_definition(
    definition_id: uuid.UUID,
    current_user: User = Depends(require_permissions("reports:create")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a report definition (soft delete)."""
    service = ReportService(db, current_user.tenant_id)
    definition = await service.get_report_definition(definition_id)

    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report definition not found"
        )

    definition.is_active = False
    definition.updated_by = current_user.id
    await db.commit()

    return MessageResponse(message="Report definition deleted successfully")


# ─── Report Execution ────────────────────────────────────────


@router.post("/execute", response_model=ReportResultResponse)
async def execute_report(
    request: ReportExecutionRequest,
    current_user: User = Depends(require_permissions("reports:execute")),
    db: AsyncSession = Depends(get_db),
):
    """
    Execute a report and return results.
    Can execute saved definitions or ad-hoc queries.
    """
    service = ReportService(db, current_user.tenant_id)

    # Create execution record
    execution = await service.create_report_execution(
        definition_id=request.report_definition_id,
        executed_by=current_user.id,
        parameters=request.parameters,
    )

    start_time = datetime.now()

    try:
        # Determine what to execute
        if request.report_definition_id:
            # Execute saved definition
            definition = await service.get_report_definition(request.report_definition_id)
            if not definition:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Report definition not found",
                )
            from app.modules.reports.schemas import QueryConfig

            query_config = QueryConfig(**definition.query_config)
        elif request.query_config:
            # Execute ad-hoc query
            query_config = request.query_config
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either report_definition_id or query_config must be provided",
            )

        # Execute query
        data, columns = await service.execute_custom_report(query_config, current_user.id)

        # Calculate execution time
        execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        # Handle export if requested
        file_path = None
        file_format = None
        file_size = None

        if request.export_format != "json":
            filename = f"report_{execution.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

            if request.export_format == "csv":
                file_path, file_size = await service.export_to_csv(data, columns, filename)
                file_format = "csv"
            elif request.export_format == "excel":
                report_title = (
                    definition.name if request.report_definition_id and definition else "Report"
                )
                file_path, file_size = await service.export_to_excel(
                    data, columns, filename, report_title
                )
                file_format = "excel"
            elif request.export_format == "pdf":
                report_title = (
                    definition.name if request.report_definition_id and definition else "Report"
                )
                file_path, file_size = await service.export_to_pdf(
                    data, columns, filename, report_title
                )
                file_format = "pdf"

        # Update execution record
        await service.update_report_execution(
            execution.id,
            status="completed",
            row_count=len(data),
            execution_time_ms=execution_time_ms,
            file_path=file_path,
            file_format=file_format,
            file_size_bytes=file_size,
            result_data={"data": data[:1000], "columns": columns} if len(data) <= 1000 else None,
        )

        # Reload execution
        await db.refresh(execution)

        return ReportResultResponse(
            execution=ReportExecutionResponse.model_validate(execution),
            data=data if request.export_format == "json" else None,
            columns=columns,
        )

    except Exception as e:
        # Update execution with error
        execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        await service.update_report_execution(
            execution.id,
            status="failed",
            execution_time_ms=execution_time_ms,
            error_message=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Report execution failed: {str(e)}"
        )


@router.get("/executions/{execution_id}", response_model=ReportResultResponse)
async def get_execution_results(
    execution_id: uuid.UUID,
    current_user: User = Depends(require_permissions("reports:read")),
    db: AsyncSession = Depends(get_db),
):
    """Get report execution results."""
    from sqlalchemy import select
    from app.modules.reports.models import ReportExecution

    query = select(ReportExecution).where(
        ReportExecution.id == execution_id,
        ReportExecution.tenant_id == current_user.tenant_id,
        ReportExecution.is_active == True,
    )
    result = await db.execute(query)
    execution = result.scalar_one_or_none()

    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found"
        )

    # Return cached data if available
    data = None
    columns = None
    if execution.result_data:
        data = execution.result_data.get("data")
        columns = execution.result_data.get("columns")

    return ReportResultResponse(
        execution=ReportExecutionResponse.model_validate(execution),
        data=data,
        columns=columns,
    )


@router.get("/executions/{execution_id}/download")
async def download_execution_file(
    execution_id: uuid.UUID,
    current_user: User = Depends(require_permissions("reports:read")),
    db: AsyncSession = Depends(get_db),
):
    """Download report execution file."""
    from sqlalchemy import select
    from app.modules.reports.models import ReportExecution
    from pathlib import Path

    query = select(ReportExecution).where(
        ReportExecution.id == execution_id,
        ReportExecution.tenant_id == current_user.tenant_id,
        ReportExecution.is_active == True,
    )
    result = await db.execute(query)
    execution = result.scalar_one_or_none()

    if not execution or not execution.file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
        )

    file_path = Path(execution.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File no longer exists"
        )

    # Determine media type
    media_types = {
        "csv": "text/csv",
        "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pdf": "application/pdf",
    }
    media_type = media_types.get(execution.file_format, "application/octet-stream")

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=file_path.name,
    )


# ─── Predefined Report Templates ─────────────────────────────


@router.get("/templates", response_model=ReportTemplatesResponse)
async def list_report_templates(
    current_user: User = Depends(require_permissions("reports:read")),
):
    """
    List all predefined report templates.
    These are built-in reports organized by category.
    """
    clinical_templates = [
        ReportTemplate(
            name="patient_demographics",
            display_name="Patient Demographics",
            description="Patient statistics by age, gender, and insurance coverage",
            category="clinical",
            parameters=[
                {
                    "name": "start_date",
                    "type": "date",
                    "required": False,
                    "label": "Start Date",
                },
                {"name": "end_date", "type": "date", "required": False, "label": "End Date"},
            ],
        ),
        ReportTemplate(
            name="diagnosis_trends",
            display_name="Diagnosis Trends",
            description="Top diagnoses over time with frequency analysis",
            category="clinical",
            parameters=[
                {
                    "name": "start_date",
                    "type": "date",
                    "required": False,
                    "label": "Start Date",
                },
                {"name": "end_date", "type": "date", "required": False, "label": "End Date"},
                {
                    "name": "limit",
                    "type": "number",
                    "required": False,
                    "label": "Number of Results",
                    "default": 20,
                },
            ],
        ),
        ReportTemplate(
            name="provider_productivity",
            display_name="Provider Productivity",
            description="Provider statistics including appointments, encounters, and completion rates",
            category="clinical",
            parameters=[
                {
                    "name": "start_date",
                    "type": "date",
                    "required": False,
                    "label": "Start Date",
                },
                {"name": "end_date", "type": "date", "required": False, "label": "End Date"},
            ],
        ),
    ]

    financial_templates = [
        ReportTemplate(
            name="revenue_analysis",
            display_name="Revenue Analysis",
            description="Revenue breakdown by service category, payment method, and time period",
            category="financial",
            parameters=[
                {
                    "name": "start_date",
                    "type": "date",
                    "required": False,
                    "label": "Start Date",
                },
                {"name": "end_date", "type": "date", "required": False, "label": "End Date"},
            ],
        ),
        ReportTemplate(
            name="insurance_claims",
            display_name="Insurance Claims Report",
            description="Insurance claims by status, insurer, and approval rates",
            category="financial",
            parameters=[
                {
                    "name": "start_date",
                    "type": "date",
                    "required": False,
                    "label": "Start Date",
                },
                {"name": "end_date", "type": "date", "required": False, "label": "End Date"},
            ],
        ),
    ]

    operational_templates = [
        ReportTemplate(
            name="appointment_statistics",
            display_name="Appointment Statistics",
            description="Appointment breakdown by status, type, and specialty",
            category="operational",
            parameters=[
                {
                    "name": "start_date",
                    "type": "date",
                    "required": False,
                    "label": "Start Date",
                },
                {"name": "end_date", "type": "date", "required": False, "label": "End Date"},
            ],
        ),
    ]

    return ReportTemplatesResponse(
        clinical=clinical_templates,
        financial=financial_templates,
        operational=operational_templates,
    )


@router.post("/templates/execute", response_model=dict)
async def execute_predefined_report(
    request: PredefinedReportRequest,
    current_user: User = Depends(require_permissions("reports:execute")),
    db: AsyncSession = Depends(get_db),
):
    """
    Execute a predefined report template.
    """
    service = ReportService(db, current_user.tenant_id)

    # Create execution record
    execution = await service.create_report_execution(
        definition_id=None, executed_by=current_user.id, parameters=request.parameters
    )

    start_time = datetime.now()

    try:
        # Get date parameters
        start_date = None
        end_date = None
        if "start_date" in request.parameters:
            start_date = date.fromisoformat(request.parameters["start_date"])
        if "end_date" in request.parameters:
            end_date = date.fromisoformat(request.parameters["end_date"])

        # Execute appropriate template
        if request.template_name == "patient_demographics":
            data = await service.generate_patient_demographics_report(start_date, end_date)
        elif request.template_name == "diagnosis_trends":
            limit = request.parameters.get("limit", 20)
            data = await service.generate_diagnosis_trends_report(start_date, end_date, limit)
        elif request.template_name == "provider_productivity":
            data = await service.generate_provider_productivity_report(start_date, end_date)
        elif request.template_name == "revenue_analysis":
            data = await service.generate_revenue_analysis_report(start_date, end_date)
        elif request.template_name == "insurance_claims":
            data = await service.generate_insurance_claims_report(start_date, end_date)
        elif request.template_name == "appointment_statistics":
            data = await service.generate_appointment_statistics_report(start_date, end_date)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown template: {request.template_name}",
            )

        # Calculate execution time
        execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        # Handle export if requested
        file_path = None
        file_format = None
        file_size = None

        if request.export_format != "json":
            filename = f"{request.template_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

            # Flatten data for export
            flat_data = []
            columns = []

            # This is simplified - in production, you'd want more sophisticated flattening
            if isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, list):
                        flat_data.extend(value)
                        if flat_data and not columns:
                            columns = list(flat_data[0].keys())

            if request.export_format == "csv" and flat_data:
                file_path, file_size = await service.export_to_csv(
                    flat_data, columns, filename
                )
                file_format = "csv"
            elif request.export_format == "excel" and flat_data:
                file_path, file_size = await service.export_to_excel(
                    flat_data, columns, filename, request.template_name.replace("_", " ").title()
                )
                file_format = "excel"
            elif request.export_format == "pdf" and flat_data:
                file_path, file_size = await service.export_to_pdf(
                    flat_data, columns, filename, request.template_name.replace("_", " ").title()
                )
                file_format = "pdf"

        # Update execution record
        await service.update_report_execution(
            execution.id,
            status="completed",
            execution_time_ms=execution_time_ms,
            file_path=file_path,
            file_format=file_format,
            file_size_bytes=file_size,
            result_data={"data": data},
        )

        return {
            "execution_id": str(execution.id),
            "template_name": request.template_name,
            "data": data,
            "execution_time_ms": execution_time_ms,
            "file_path": file_path,
            "file_format": file_format,
        }

    except Exception as e:
        execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        await service.update_report_execution(
            execution.id,
            status="failed",
            execution_time_ms=execution_time_ms,
            error_message=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report execution failed: {str(e)}",
        )


# ─── Scheduled Reports ───────────────────────────────────────


@router.post("/schedule", response_model=ScheduledReportResponse, status_code=status.HTTP_201_CREATED)
async def create_scheduled_report(
    data: ScheduledReportCreate,
    current_user: User = Depends(require_permissions("reports:create")),
    db: AsyncSession = Depends(get_db),
):
    """
    Schedule a recurring report.
    Reports will be executed and emailed to recipients automatically.
    """
    from app.modules.reports.models import ScheduledReport
    from datetime import datetime, timedelta

    service = ReportService(db, current_user.tenant_id)

    # Verify report definition exists
    definition = await service.get_report_definition(data.report_definition_id)
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report definition not found"
        )

    # Calculate next run time
    now = datetime.now()
    schedule_config = data.schedule_config.model_dump() if data.schedule_config else {}

    if data.schedule_type == "daily":
        next_run = now.replace(
            hour=schedule_config.get("hour", 9),
            minute=schedule_config.get("minute", 0),
            second=0,
            microsecond=0,
        )
        if next_run <= now:
            next_run += timedelta(days=1)
    elif data.schedule_type == "weekly":
        # Implement weekly logic
        next_run = now + timedelta(days=7)
    else:  # monthly
        # Implement monthly logic
        next_run = now + timedelta(days=30)

    scheduled_report = ScheduledReport(
        tenant_id=current_user.tenant_id,
        report_definition_id=data.report_definition_id,
        schedule_type=data.schedule_type,
        schedule_config=schedule_config,
        recipients=data.recipients,
        execution_params=data.execution_params,
        next_run=next_run,
        created_by=current_user.id,
    )

    db.add(scheduled_report)
    await db.commit()
    await db.refresh(scheduled_report)

    return ScheduledReportResponse.model_validate(scheduled_report)


@router.get("/scheduled", response_model=list[ScheduledReportResponse])
async def list_scheduled_reports(
    current_user: User = Depends(require_permissions("reports:read")),
    db: AsyncSession = Depends(get_db),
):
    """List all scheduled reports."""
    from sqlalchemy import select
    from app.modules.reports.models import ScheduledReport

    query = (
        select(ScheduledReport)
        .where(
            ScheduledReport.tenant_id == current_user.tenant_id,
            ScheduledReport.is_active == True,
        )
        .order_by(ScheduledReport.next_run)
    )

    result = await db.execute(query)
    scheduled_reports = result.scalars().all()

    return [ScheduledReportResponse.model_validate(sr) for sr in scheduled_reports]


@router.put("/scheduled/{schedule_id}", response_model=ScheduledReportResponse)
async def update_scheduled_report(
    schedule_id: uuid.UUID,
    data: ScheduledReportUpdate,
    current_user: User = Depends(require_permissions("reports:create")),
    db: AsyncSession = Depends(get_db),
):
    """Update a scheduled report."""
    from sqlalchemy import select
    from app.modules.reports.models import ScheduledReport

    query = select(ScheduledReport).where(
        ScheduledReport.id == schedule_id,
        ScheduledReport.tenant_id == current_user.tenant_id,
        ScheduledReport.is_active == True,
    )
    result = await db.execute(query)
    scheduled_report = result.scalar_one_or_none()

    if not scheduled_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled report not found"
        )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(scheduled_report, field, value)

    scheduled_report.updated_by = current_user.id
    await db.commit()
    await db.refresh(scheduled_report)

    return ScheduledReportResponse.model_validate(scheduled_report)


@router.delete("/scheduled/{schedule_id}", response_model=MessageResponse)
async def delete_scheduled_report(
    schedule_id: uuid.UUID,
    current_user: User = Depends(require_permissions("reports:create")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a scheduled report."""
    from sqlalchemy import select
    from app.modules.reports.models import ScheduledReport

    query = select(ScheduledReport).where(
        ScheduledReport.id == schedule_id,
        ScheduledReport.tenant_id == current_user.tenant_id,
        ScheduledReport.is_active == True,
    )
    result = await db.execute(query)
    scheduled_report = result.scalar_one_or_none()

    if not scheduled_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled report not found"
        )

    scheduled_report.is_active = False
    scheduled_report.updated_by = current_user.id
    await db.commit()

    return MessageResponse(message="Scheduled report deleted successfully")
