"""
Pydantic schemas for the Custom Reporting System.
Request/response models for report API endpoints.
"""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


# ─── Report Definition Schemas ───────────────────────────────


class QueryFilter(BaseModel):
    """Individual query filter."""

    field: str
    operator: Literal["equals", "not_equals", "contains", "gt", "gte", "lt", "lte", "in", "between"]
    value: Any


class QuerySort(BaseModel):
    """Sort specification."""

    field: str
    direction: Literal["asc", "desc"] = "asc"


class QueryConfig(BaseModel):
    """Query configuration for report."""

    data_source: Literal["patients", "appointments", "billing", "pharmacy", "emr"]
    fields: list[str] = Field(default_factory=list)
    filters: list[QueryFilter] = Field(default_factory=list)
    group_by: list[str] = Field(default_factory=list)
    sort: list[QuerySort] = Field(default_factory=list)
    limit: int | None = None


class ReportDefinitionCreate(BaseModel):
    """Create new report definition."""

    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    report_type: Literal["clinical", "financial", "operational"]
    category: str | None = None
    query_config: QueryConfig
    is_public: bool = False
    is_template: bool = False
    tags: list[str] = Field(default_factory=list)


class ReportDefinitionUpdate(BaseModel):
    """Update existing report definition."""

    name: str | None = None
    description: str | None = None
    query_config: QueryConfig | None = None
    is_active: bool | None = None
    tags: list[str] | None = None


class ReportDefinitionResponse(BaseModel):
    """Report definition response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    name: str
    description: str | None
    report_type: str
    category: str | None
    query_config: dict
    is_public: bool
    is_template: bool
    is_active: bool
    tags: list | None
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime


# ─── Scheduled Report Schemas ────────────────────────────────


class ScheduleConfig(BaseModel):
    """Schedule configuration."""

    day_of_week: int | None = Field(None, ge=0, le=6)  # 0=Monday, 6=Sunday
    day_of_month: int | None = Field(None, ge=1, le=31)
    hour: int = Field(default=9, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)


class ScheduledReportCreate(BaseModel):
    """Create scheduled report."""

    report_definition_id: UUID
    schedule_type: Literal["daily", "weekly", "monthly"]
    schedule_config: ScheduleConfig | None = None
    recipients: list[str] = Field(..., min_length=1)  # Email addresses
    execution_params: dict | None = None


class ScheduledReportUpdate(BaseModel):
    """Update scheduled report."""

    schedule_type: Literal["daily", "weekly", "monthly"] | None = None
    schedule_config: ScheduleConfig | None = None
    recipients: list[str] | None = None
    execution_params: dict | None = None
    is_active: bool | None = None


class ScheduledReportResponse(BaseModel):
    """Scheduled report response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    report_definition_id: UUID
    schedule_type: str
    schedule_config: dict | None
    recipients: list
    last_run: datetime | None
    next_run: datetime | None
    last_status: str | None
    execution_params: dict | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ─── Report Execution Schemas ────────────────────────────────


class ReportExecutionRequest(BaseModel):
    """Request to execute a report."""

    report_definition_id: UUID | None = None  # For saved reports
    query_config: QueryConfig | None = None  # For ad-hoc reports
    parameters: dict | None = None  # Runtime parameters (date ranges, etc.)
    export_format: Literal["json", "csv", "excel", "pdf"] = "json"


class PredefinedReportRequest(BaseModel):
    """Request for predefined report template."""

    template_name: Literal[
        "patient_demographics",
        "diagnosis_trends",
        "provider_productivity",
        "revenue_analysis",
        "insurance_claims",
        "appointment_statistics",
    ]
    parameters: dict = Field(default_factory=dict)
    export_format: Literal["json", "csv", "excel", "pdf"] = "json"


class ReportExecutionResponse(BaseModel):
    """Report execution response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    report_definition_id: UUID | None
    executed_by: UUID | None
    executed_at: datetime
    status: str
    row_count: int | None
    execution_time_ms: int | None
    file_path: str | None
    file_format: str | None
    file_size_bytes: int | None
    error_message: str | None
    parameters: dict | None


class ReportResultResponse(BaseModel):
    """Report execution result with data."""

    execution: ReportExecutionResponse
    data: list[dict] | None = None
    columns: list[str] | None = None


# ─── Report Template Schemas ─────────────────────────────────


class ReportTemplate(BaseModel):
    """Predefined report template metadata."""

    name: str
    display_name: str
    description: str
    category: Literal["clinical", "financial", "operational"]
    parameters: list[dict] = Field(default_factory=list)
    # Parameter example: {"name": "start_date", "type": "date", "required": true, "label": "Start Date"}


class ReportTemplatesResponse(BaseModel):
    """List of available report templates."""

    clinical: list[ReportTemplate]
    financial: list[ReportTemplate]
    operational: list[ReportTemplate]


# ─── Export Schemas ──────────────────────────────────────────


class ExportRequest(BaseModel):
    """Export execution results to file."""

    execution_id: UUID
    format: Literal["csv", "excel", "pdf"]


class ExportResponse(BaseModel):
    """Export result."""

    execution_id: UUID
    format: str
    file_path: str
    file_size_bytes: int
    download_url: str
