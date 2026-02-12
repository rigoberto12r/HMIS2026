"""
Background task scheduler for periodic jobs.
Uses APScheduler for scheduling appointment reminders and other background tasks.
"""

import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.database import AsyncSessionLocal
from app.core.cache import redis_client
from app.integrations.email.service import email_service
from app.integrations.email.templates import EmailTemplate

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = AsyncIOScheduler()


async def send_appointment_reminders():
    """
    Send email reminders for appointments scheduled for tomorrow.
    Runs daily at 6 PM.
    """
    logger.info("Starting appointment reminder job...")

    try:
        from app.modules.appointments.models import Appointment
        from app.modules.patients.models import Patient
        from sqlalchemy import select, and_

        async with AsyncSessionLocal() as db:
            # Get appointments for tomorrow
            tomorrow = datetime.now().date() + timedelta(days=1)
            tomorrow_start = datetime.combine(tomorrow, datetime.min.time())
            tomorrow_end = datetime.combine(tomorrow, datetime.max.time())

            stmt = (
                select(Appointment)
                .where(
                    and_(
                        Appointment.start_datetime >= tomorrow_start,
                        Appointment.start_datetime <= tomorrow_end,
                        Appointment.status.in_(["scheduled", "confirmed"]),
                        Appointment.is_active == True,
                    )
                )
                .options(
                    __import__("sqlalchemy.orm").selectinload(Appointment.patient),
                    __import__("sqlalchemy.orm").selectinload(Appointment.provider),
                )
            )

            result = await db.execute(stmt)
            appointments = result.scalars().all()

            logger.info(f"Found {len(appointments)} appointments for tomorrow")

            for appt in appointments:
                try:
                    if not appt.patient or not appt.patient.email:
                        logger.warning(f"No email for patient {appt.patient_id}, skipping")
                        continue

                    # Prepare email data
                    email_data = {
                        "patient_name": f"{appt.patient.first_name} {appt.patient.last_name}",
                        "appointment_date": appt.start_datetime.strftime("%d/%m/%Y"),
                        "appointment_time": appt.start_datetime.strftime("%I:%M %p"),
                        "provider_name": (
                            f"{appt.provider.first_name} {appt.provider.last_name}"
                            if appt.provider
                            else "Por confirmar"
                        ),
                        "specialty": appt.provider.specialty if appt.provider else "",
                        "location": "Hospital Principal",  # TODO: Get from config
                    }

                    html, text = EmailTemplate.render_appointment_reminder(email_data)

                    # Send email
                    success = await email_service.send_email(
                        to=appt.patient.email,
                        subject="Recordatorio: Cita Medica Mañana",
                        html_body=html,
                        text_body=text,
                    )

                    if success:
                        logger.info(f"Reminder sent to {appt.patient.email} for appointment {appt.id}")
                    else:
                        logger.error(f"Failed to send reminder for appointment {appt.id}")

                except Exception as e:
                    logger.error(f"Error sending reminder for appointment {appt.id}: {e}")
                    continue

            logger.info(f"Appointment reminder job completed. Sent {len(appointments)} reminders.")

    except Exception as e:
        logger.error(f"Appointment reminder job failed: {e}")


async def cleanup_expired_sessions():
    """Clean up expired refresh tokens and inactive sessions. Runs daily at 3 AM."""
    logger.info("Running session cleanup job...")

    try:
        from app.modules.auth.models import User
        from sqlalchemy import update, and_, delete

        async with AsyncSessionLocal() as db:
            # Clean up expired refresh tokens from Redis
            try:
                # Remove expired session keys (pattern: session:*)
                cursor = 0
                cleaned_count = 0
                while True:
                    cursor, keys = await redis_client.scan(
                        cursor, match="session:*", count=100
                    )
                    for key in keys:
                        ttl = await redis_client.ttl(key)
                        if ttl == -1:
                            # Key has no expiry - set a 7-day TTL or delete
                            await redis_client.delete(key)
                            cleaned_count += 1
                    if cursor == 0:
                        break

                logger.info(f"Cleaned {cleaned_count} orphaned session keys from Redis")
            except Exception as redis_err:
                logger.warning(f"Redis cleanup failed (non-critical): {redis_err}")

            # Deactivate users who haven't logged in for 180 days
            cutoff = datetime.now() - timedelta(days=180)
            result = await db.execute(
                update(User)
                .where(
                    and_(
                        User.is_active == True,
                        User.last_login_at != None,
                        User.last_login_at < cutoff,
                    )
                )
                .values(is_active=False)
            )
            inactive_count = result.rowcount
            await db.commit()

            if inactive_count > 0:
                logger.info(f"Deactivated {inactive_count} users inactive for 180+ days")

            logger.info("Session cleanup job completed successfully")

    except Exception as e:
        logger.error(f"Session cleanup job failed: {e}")


async def generate_daily_reports():
    """Generate and email daily summary reports. Runs daily at 8 AM."""
    logger.info("Generating daily reports...")

    try:
        from app.modules.appointments.models import Appointment
        from app.modules.billing.models import Invoice, Payment
        from sqlalchemy import select, func, and_

        async with AsyncSessionLocal() as db:
            yesterday = datetime.now().date() - timedelta(days=1)
            yesterday_start = datetime.combine(yesterday, datetime.min.time())
            yesterday_end = datetime.combine(yesterday, datetime.max.time())

            # Appointment stats for yesterday
            appt_total = await db.scalar(
                select(func.count(Appointment.id)).where(
                    and_(
                        Appointment.scheduled_start >= yesterday_start,
                        Appointment.scheduled_start <= yesterday_end,
                    )
                )
            ) or 0

            appt_completed = await db.scalar(
                select(func.count(Appointment.id)).where(
                    and_(
                        Appointment.scheduled_start >= yesterday_start,
                        Appointment.scheduled_start <= yesterday_end,
                        Appointment.status == "completed",
                    )
                )
            ) or 0

            appt_no_show = await db.scalar(
                select(func.count(Appointment.id)).where(
                    and_(
                        Appointment.scheduled_start >= yesterday_start,
                        Appointment.scheduled_start <= yesterday_end,
                        Appointment.status == "no_show",
                    )
                )
            ) or 0

            # Billing stats for yesterday
            invoices_created = await db.scalar(
                select(func.count(Invoice.id)).where(
                    and_(
                        Invoice.created_at >= yesterday_start,
                        Invoice.created_at <= yesterday_end,
                    )
                )
            ) or 0

            revenue = await db.scalar(
                select(func.coalesce(func.sum(Payment.amount), 0)).where(
                    and_(
                        Payment.payment_date >= yesterday_start,
                        Payment.payment_date <= yesterday_end,
                    )
                )
            ) or 0

            report_data = {
                "date": yesterday.isoformat(),
                "appointments": {
                    "total": appt_total,
                    "completed": appt_completed,
                    "no_show": appt_no_show,
                    "completion_rate": round(appt_completed / appt_total * 100, 1) if appt_total > 0 else 0,
                },
                "billing": {
                    "invoices_created": invoices_created,
                    "revenue_collected": float(revenue),
                },
            }

            logger.info(
                f"Daily report for {yesterday.isoformat()}: "
                f"Appointments={appt_total} (completed={appt_completed}, no_show={appt_no_show}), "
                f"Invoices={invoices_created}, Revenue={float(revenue):.2f}"
            )

            # Try to send email report
            try:
                html_body = f"""
                <h2>Resumen Diario - {yesterday.strftime('%d/%m/%Y')}</h2>
                <h3>Citas</h3>
                <ul>
                    <li>Total: {appt_total}</li>
                    <li>Completadas: {appt_completed}</li>
                    <li>No Show: {appt_no_show}</li>
                    <li>Tasa de cumplimiento: {report_data['appointments']['completion_rate']}%</li>
                </ul>
                <h3>Facturación</h3>
                <ul>
                    <li>Facturas creadas: {invoices_created}</li>
                    <li>Ingresos recaudados: RD$ {float(revenue):,.2f}</li>
                </ul>
                """

                await email_service.send_email(
                    to="admin@hmis.app",
                    subject=f"HMIS - Resumen Diario {yesterday.strftime('%d/%m/%Y')}",
                    html_body=html_body,
                    text_body=f"Resumen: {appt_total} citas, RD$ {float(revenue):,.2f} ingresos",
                )
                logger.info("Daily report email sent successfully")
            except Exception as email_err:
                logger.warning(f"Could not send daily report email (non-critical): {email_err}")

            logger.info("Daily report generation completed")

    except Exception as e:
        logger.error(f"Daily report generation failed: {e}")


async def monitor_dead_letter_queue():
    """
    Monitor Dead Letter Queue for failed events and alert if threshold exceeded.
    Runs every 5 minutes.

    Alerts when:
    - DLQ has more than 10 events (warning)
    - DLQ has more than 50 events (critical)
    """
    logger.info("Checking Dead Letter Queue...")

    try:
        # Get DLQ stream info
        dlq_stream = "events:dlq"

        # Count entries in DLQ
        try:
            dlq_info = await redis_client.xinfo_stream(dlq_stream)
            dlq_count = dlq_info.get("length", 0)
        except Exception:
            # Stream doesn't exist yet (no failed events)
            dlq_count = 0
            logger.info("DLQ stream does not exist yet (no failed events)")
            return

        logger.info(f"Dead Letter Queue contains {dlq_count} failed events")

        # Alert based on thresholds
        if dlq_count > 50:
            logger.critical(
                "CRÍTICO: Dead Letter Queue tiene más de 50 eventos fallidos",
                extra={
                    "dlq_count": dlq_count,
                    "threshold": 50,
                    "action_required": "Investigar y reprocessar eventos fallidos urgentemente",
                },
            )

            # Get latest failed events for context
            latest_entries = await redis_client.xrevrange(dlq_stream, count=5)
            failed_event_types = []

            for entry_id, entry_data in latest_entries:
                event_type = entry_data.get(b"event_type", b"unknown").decode("utf-8")
                handler = entry_data.get(b"handler", b"unknown").decode("utf-8")
                failed_event_types.append(f"{event_type} ({handler})")

            logger.critical(
                f"Últimos 5 eventos fallidos: {', '.join(failed_event_types)}",
                extra={"failed_events": failed_event_types},
            )

            # TODO: Send alert to Slack/PagerDuty/Email

        elif dlq_count > 10:
            logger.warning(
                "ADVERTENCIA: Dead Letter Queue tiene más de 10 eventos fallidos",
                extra={
                    "dlq_count": dlq_count,
                    "threshold": 10,
                    "action_required": "Revisar eventos fallidos pronto",
                },
            )

            # TODO: Send warning to monitoring channel

        else:
            logger.info(f"DLQ health OK: {dlq_count} eventos (threshold: 10)")

    except Exception as e:
        logger.error(f"Error monitoring Dead Letter Queue: {e}", exc_info=True)


def start_scheduler():
    """Start the background task scheduler."""
    try:
        # Schedule appointment reminders - daily at 6 PM
        scheduler.add_job(
            send_appointment_reminders,
            CronTrigger(hour=18, minute=0),
            id="appointment_reminders",
            name="Send appointment reminders for tomorrow",
            replace_existing=True,
        )

        # Schedule session cleanup - daily at 3 AM
        scheduler.add_job(
            cleanup_expired_sessions,
            CronTrigger(hour=3, minute=0),
            id="cleanup_sessions",
            name="Clean up expired sessions",
            replace_existing=True,
        )

        # Schedule daily reports - daily at 8 AM
        scheduler.add_job(
            generate_daily_reports,
            CronTrigger(hour=8, minute=0),
            id="daily_reports",
            name="Generate daily reports",
            replace_existing=True,
        )

        # Monitor Dead Letter Queue - every 5 minutes
        scheduler.add_job(
            monitor_dead_letter_queue,
            "interval",
            minutes=5,
            id="monitor_dlq",
            name="Monitor Dead Letter Queue for failed events",
            replace_existing=True,
        )

        scheduler.start()
        logger.info("Background task scheduler started successfully (including DLQ monitoring)")

    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")


def stop_scheduler():
    """Stop the background task scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Background task scheduler stopped")
