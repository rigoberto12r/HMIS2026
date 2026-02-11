"""
Patient Portal Models.
Database models specific to patient portal functionality.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.base_models import BaseEntity


class PatientPortalAccount(Base, BaseEntity):
    """
    Patient portal account - links Patient to User for authentication.
    Patients can self-register and manage their own accounts.
    """

    __tablename__ = "patient_portal_accounts"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False, index=True
    )

    # Portal-specific settings
    email_notifications: Mapped[bool] = mapped_column(default=True)
    sms_notifications: Mapped[bool] = mapped_column(default=False)
    appointment_reminders: Mapped[bool] = mapped_column(default=True)
    lab_result_notifications: Mapped[bool] = mapped_column(default=True)

    # Account status
    is_verified: Mapped[bool] = mapped_column(default=False)
    verification_token: Mapped[str | None] = mapped_column(String(100), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)


class PortalNotification(Base, BaseEntity):
    """
    Notifications for patient portal users.
    Displayed in dashboard and can trigger emails/SMS.
    """

    __tablename__ = "portal_notifications"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

    notification_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # appointment_reminder, lab_result, prescription_ready, payment_due, general

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(
        String(20), default="info"
    )  # info, warning, urgent

    # Links and metadata
    action_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    related_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Status
    is_read: Mapped[bool] = mapped_column(default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Delivery status
    email_sent: Mapped[bool] = mapped_column(default=False)
    email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sms_sent: Mapped[bool] = mapped_column(default=False)
    sms_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PrescriptionRefillRequest(Base, BaseEntity):
    """
    Patient requests for prescription refills via portal.
    Reviewed and approved by providers.
    """

    __tablename__ = "prescription_refill_requests"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    prescription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

    request_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, approved, denied, fulfilled

    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
