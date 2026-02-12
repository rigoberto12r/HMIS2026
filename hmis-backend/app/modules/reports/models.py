"""
Database models for the Custom Reporting System.
Stores report definitions, schedules, and execution history.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.base_models import BaseEntity, TimestampMixin, UUIDMixin


class ReportDefinition(Base, BaseEntity):
    """
    Report definition with query configuration and metadata.
    Supports clinical, financial, and operational report types.
    """

    __tablename__ = "report_definitions"

    tenant_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_type: Mapped[str] = mapped_column(
        String(30), nullable=False, index=True
    )  # clinical, financial, operational
    category: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # patient_demographics, diagnosis_trends, revenue_analysis, etc.

    # Query configuration stored as JSON
    # Example: {
    #   "data_source": "patients",
    #   "fields": ["mrn", "full_name", "age", "gender"],
    #   "filters": [{"field": "status", "operator": "equals", "value": "active"}],
    #   "group_by": ["gender"],
    #   "sort": [{"field": "created_at", "direction": "desc"}],
    #   "limit": 1000
    # }
    query_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Ownership and access control
    is_public: Mapped[bool] = mapped_column(
        default=False
    )  # Public templates vs user-created
    is_template: Mapped[bool] = mapped_column(
        default=False
    )  # Predefined templates vs custom

    # Metadata
    tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # For search/filter

    # Relaciones
    executions: Mapped[list["ReportExecution"]] = relationship(
        back_populates="report_definition", cascade="all, delete-orphan"
    )
    schedules: Mapped[list["ScheduledReport"]] = relationship(
        back_populates="report_definition", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_report_definitions_type", "report_type"),)


class ScheduledReport(Base, BaseEntity):
    """
    Scheduled recurring report with recipient list.
    Supports daily, weekly, and monthly schedules.
    """

    __tablename__ = "scheduled_reports"

    tenant_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    report_definition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("report_definitions.id"), nullable=False, index=True
    )

    schedule_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # daily, weekly, monthly
    schedule_config: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True
    )  # {day_of_week: 1, hour: 9, minute: 0}

    # Recipients as list of emails
    recipients: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # Execution tracking
    last_run: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    next_run: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_status: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # success, failed

    # Parameters to use for execution
    execution_params: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relaciones
    report_definition: Mapped["ReportDefinition"] = relationship(
        back_populates="schedules"
    )

    __table_args__ = (Index("ix_scheduled_reports_next_run", "next_run", "is_active"),)


class ReportExecution(Base, BaseEntity):
    """
    Individual report execution record with results and performance metrics.
    """

    __tablename__ = "report_executions"

    tenant_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    report_definition_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("report_definitions.id"), nullable=True, index=True
    )

    executed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Execution parameters used
    parameters: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Result metadata
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending, running, completed, failed
    row_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    execution_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Output file paths
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_format: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )  # csv, excel, pdf
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Error information
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Cached results (for small reports)
    result_data: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True
    )  # Cache small result sets

    # Relaciones
    report_definition: Mapped["ReportDefinition"] = relationship(
        back_populates="executions"
    )

    __table_args__ = (
        Index("ix_report_executions_definition_date", "report_definition_id", "executed_at"),
    )
