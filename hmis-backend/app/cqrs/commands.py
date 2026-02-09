"""
Command handlers for write operations (CQRS pattern).

Commands modify state and are always executed against the primary database.
After successful execution, they publish domain events for projections.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, date
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.models import Invoice, Payment, ChargeItem
from app.modules.emr.models import Encounter, Diagnosis, ClinicalNote
from app.modules.patients.models import Patient, PatientInsurance
from app.modules.pharmacy.models import Prescription, DispensationRecord
from app.shared.events import publish, DomainEvent, EVENT_TYPES


# ─── Command Models ──────────────────────────────────────────────


@dataclass
class CreateInvoiceCommand:
    """Command to create a new invoice (write operation)."""

    patient_id: uuid.UUID
    encounter_id: uuid.UUID | None
    charge_items: list[dict[str, Any]]
    tax_rate: Decimal
    tenant_id: str
    user_id: uuid.UUID


@dataclass
class RecordPaymentCommand:
    """Command to record a payment (write operation)."""

    invoice_id: uuid.UUID
    amount: Decimal
    payment_method: str
    reference_number: str | None
    tenant_id: str
    user_id: uuid.UUID


@dataclass
class CreateEncounterCommand:
    """Command to create a clinical encounter (write operation)."""

    patient_id: uuid.UUID
    provider_id: uuid.UUID
    encounter_type: str
    reason: str
    start_datetime: datetime
    tenant_id: str
    user_id: uuid.UUID


@dataclass
class AddDiagnosisCommand:
    """Command to add a diagnosis to an encounter (write operation)."""

    encounter_id: uuid.UUID
    icd10_code: str
    description: str
    is_primary: bool
    tenant_id: str
    user_id: uuid.UUID


@dataclass
class DispenseMedicationCommand:
    """Command to dispense medication (write operation)."""

    prescription_id: uuid.UUID
    quantity_dispensed: int
    dispensed_by: uuid.UUID
    notes: str | None
    tenant_id: str
    user_id: uuid.UUID


# ─── Command Handlers ────────────────────────────────────────────


class InvoiceCommandHandler:
    """Handles invoice-related commands (writes)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_invoice(self, command: CreateInvoiceCommand) -> Invoice:
        """
        Create a new invoice and publish INVOICE_GENERATED event.
        """
        # Calculate totals
        subtotal = sum(Decimal(str(item["total"])) for item in command.charge_items)
        tax_amount = subtotal * command.tax_rate
        grand_total = subtotal + tax_amount

        # Create invoice
        invoice = Invoice(
            tenant_id=command.tenant_id,
            patient_id=command.patient_id,
            encounter_id=command.encounter_id,
            invoice_number=f"INV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
            subtotal=subtotal,
            tax_amount=tax_amount,
            grand_total=grand_total,
            balance_due=grand_total,
            status="pending",
            created_by=command.user_id,
        )

        self.db.add(invoice)
        await self.db.flush()

        # Create charge items
        for item_data in command.charge_items:
            charge = ChargeItem(
                tenant_id=command.tenant_id,
                invoice_id=invoice.id,
                encounter_id=command.encounter_id,
                description=item_data["description"],
                quantity=item_data["quantity"],
                unit_price=Decimal(str(item_data["unit_price"])),
                total=Decimal(str(item_data["total"])),
                status="invoiced",
                created_by=command.user_id,
            )
            self.db.add(charge)

        await self.db.commit()
        await self.db.refresh(invoice)

        # Publish event for projections
        await publish(
            DomainEvent(
                event_type=EVENT_TYPES["INVOICE_GENERATED"],
                aggregate_type="Invoice",
                aggregate_id=str(invoice.id),
                tenant_id=command.tenant_id,
                payload={
                    "invoice_id": str(invoice.id),
                    "patient_id": str(command.patient_id),
                    "grand_total": float(grand_total),
                    "status": "pending",
                },
                user_id=str(command.user_id),
            )
        )

        return invoice

    async def record_payment(self, command: RecordPaymentCommand) -> Payment:
        """
        Record a payment and update invoice balance.
        """
        # Create payment
        payment = Payment(
            tenant_id=command.tenant_id,
            invoice_id=command.invoice_id,
            amount=command.amount,
            payment_method=command.payment_method,
            reference_number=command.reference_number,
            received_at=datetime.now(),
            status="completed",
            created_by=command.user_id,
        )

        self.db.add(payment)

        # Update invoice balance (simplified - should fetch invoice first)
        # In production, you'd query the invoice and update balance_due
        await self.db.commit()
        await self.db.refresh(payment)

        # Publish event
        await publish(
            DomainEvent(
                event_type=EVENT_TYPES["PAYMENT_RECEIVED"],
                aggregate_type="Payment",
                aggregate_id=str(payment.id),
                tenant_id=command.tenant_id,
                payload={
                    "payment_id": str(payment.id),
                    "invoice_id": str(command.invoice_id),
                    "amount": float(command.amount),
                    "payment_method": command.payment_method,
                },
                user_id=str(command.user_id),
            )
        )

        return payment


class EncounterCommandHandler:
    """Handles encounter-related commands (writes)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_encounter(self, command: CreateEncounterCommand) -> Encounter:
        """
        Create a new clinical encounter.
        """
        encounter = Encounter(
            tenant_id=command.tenant_id,
            patient_id=command.patient_id,
            provider_id=command.provider_id,
            encounter_type=command.encounter_type,
            reason=command.reason,
            start_datetime=command.start_datetime,
            status="in_progress",
            created_by=command.user_id,
        )

        self.db.add(encounter)
        await self.db.commit()
        await self.db.refresh(encounter)

        # Publish event
        await publish(
            DomainEvent(
                event_type=EVENT_TYPES["ENCOUNTER_CREATED"],
                aggregate_type="Encounter",
                aggregate_id=str(encounter.id),
                tenant_id=command.tenant_id,
                payload={
                    "encounter_id": str(encounter.id),
                    "patient_id": str(command.patient_id),
                    "provider_id": str(command.provider_id),
                    "encounter_type": command.encounter_type,
                },
                user_id=str(command.user_id),
            )
        )

        return encounter

    async def add_diagnosis(self, command: AddDiagnosisCommand) -> Diagnosis:
        """
        Add a diagnosis to an encounter.
        """
        diagnosis = Diagnosis(
            tenant_id=command.tenant_id,
            encounter_id=command.encounter_id,
            icd10_code=command.icd10_code,
            description=command.description,
            is_primary=command.is_primary,
            created_by=command.user_id,
        )

        self.db.add(diagnosis)
        await self.db.commit()
        await self.db.refresh(diagnosis)

        # Publish event
        await publish(
            DomainEvent(
                event_type=EVENT_TYPES["DIAGNOSIS_ADDED"],
                aggregate_type="Diagnosis",
                aggregate_id=str(diagnosis.id),
                tenant_id=command.tenant_id,
                payload={
                    "diagnosis_id": str(diagnosis.id),
                    "encounter_id": str(command.encounter_id),
                    "icd10_code": command.icd10_code,
                    "is_primary": command.is_primary,
                },
                user_id=str(command.user_id),
            )
        )

        return diagnosis


class PharmacyCommandHandler:
    """Handles pharmacy-related commands (writes)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def dispense_medication(
        self, command: DispenseMedicationCommand
    ) -> DispensationRecord:
        """
        Dispense medication from a prescription.
        """
        dispensation = DispensationRecord(
            tenant_id=command.tenant_id,
            prescription_id=command.prescription_id,
            quantity_dispensed=command.quantity_dispensed,
            dispensed_at=datetime.now(),
            dispensed_by=command.dispensed_by,
            notes=command.notes,
            status="dispensed",
            created_by=command.user_id,
        )

        self.db.add(dispensation)
        await self.db.commit()
        await self.db.refresh(dispensation)

        # Publish event
        await publish(
            DomainEvent(
                event_type=EVENT_TYPES.get("PRESCRIPTION_DISPENSED", "prescription.dispensed"),
                aggregate_type="DispensationRecord",
                aggregate_id=str(dispensation.id),
                tenant_id=command.tenant_id,
                payload={
                    "dispensation_id": str(dispensation.id),
                    "prescription_id": str(command.prescription_id),
                    "quantity_dispensed": command.quantity_dispensed,
                },
                user_id=str(command.user_id),
            )
        )

        return dispensation
