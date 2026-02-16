"""
Servicio de Contabilidad General (General Ledger).
Partida doble, asientos automaticos, reportes financieros.
"""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.shared.utils import parse_float_safe

from app.modules.billing.models import (
    Account,
    CreditNote,
    CreditNoteLine,
    Invoice,
    InvoiceLine,
    JournalEntry,
    JournalEntryLine,
    Payment,
)


# =============================================
# Cuentas predefinidas del plan contable hospitalario
# =============================================

DEFAULT_ACCOUNTS = [
    # Activos
    ("1", "Activos", "activo", "grupo", None, False, "debit"),
    ("1.1", "Activos Corrientes", "activo", "grupo", "1", False, "debit"),
    ("1.1.01", "Caja General", "activo", "caja", "1.1", True, "debit"),
    ("1.1.02", "Bancos", "activo", "banco", "1.1", True, "debit"),
    ("1.1.03", "Cuentas por Cobrar Pacientes", "activo", "cuentas_por_cobrar", "1.1", True, "debit"),
    ("1.1.04", "Cuentas por Cobrar Aseguradoras", "activo", "cuentas_por_cobrar_seguros", "1.1", True, "debit"),
    # Pasivos
    ("2", "Pasivos", "pasivo", "grupo", None, False, "credit"),
    ("2.1", "Pasivos Corrientes", "pasivo", "grupo", "2", False, "credit"),
    ("2.1.01", "ITBIS por Pagar", "pasivo", "impuesto_por_pagar", "2.1", True, "credit"),
    ("2.1.02", "Anticipos de Pacientes", "pasivo", "anticipos", "2.1", True, "credit"),
    # Patrimonio
    ("3", "Patrimonio", "patrimonio", "grupo", None, False, "credit"),
    ("3.1", "Capital Social", "patrimonio", "capital", "3", True, "credit"),
    ("3.2", "Resultados Acumulados", "patrimonio", "resultados", "3", True, "credit"),
    # Ingresos
    ("4", "Ingresos", "ingreso", "grupo", None, False, "credit"),
    ("4.1", "Ingresos por Servicios Medicos", "ingreso", "ingreso_servicios", "4", True, "credit"),
    ("4.2", "Ingresos por Laboratorio", "ingreso", "ingreso_laboratorio", "4", True, "credit"),
    ("4.3", "Ingresos por Farmacia", "ingreso", "ingreso_farmacia", "4", True, "credit"),
    ("4.4", "Ingresos por Imagenes", "ingreso", "ingreso_imagenes", "4", True, "credit"),
    ("4.9", "Otros Ingresos", "ingreso", "otros_ingresos", "4", True, "credit"),
    # Gastos
    ("5", "Gastos", "gasto", "grupo", None, False, "debit"),
    ("5.1", "Gastos Operativos", "gasto", "gasto_operativo", "5", True, "debit"),
    ("5.2", "Descuentos Otorgados", "gasto", "descuentos", "5", True, "debit"),
    ("5.3", "Devoluciones (Notas de Credito)", "gasto", "devoluciones", "5", True, "debit"),
]


class AccountingService:
    """Servicio del libro mayor y asientos contables."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def seed_chart_of_accounts(self) -> int:
        """Crea el plan contable predeterminado si no existe."""
        result = await self.db.execute(select(func.count()).select_from(Account))
        if (result.scalar() or 0) > 0:
            return 0

        count = 0
        for code, name, category, acct_type, parent, is_detail, normal in DEFAULT_ACCOUNTS:
            account = Account(
                code=code,
                name=name,
                category=category,
                account_type=acct_type,
                parent_code=parent,
                is_detail=is_detail,
                normal_balance=normal,
            )
            self.db.add(account)
            count += 1
        await self.db.flush()
        return count

    async def get_account_by_type(self, account_type: str) -> Account | None:
        """Obtiene cuenta por tipo (ej: 'cuentas_por_cobrar')."""
        stmt = select(Account).where(
            Account.account_type == account_type,
            Account.is_detail == True,
            Account.is_active == True,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_account_by_code(self, code: str) -> Account | None:
        """Obtiene cuenta por codigo."""
        stmt = select(Account).where(Account.code == code, Account.is_active == True)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_accounts(self, category: str | None = None) -> list[Account]:
        """Lista cuentas contables, opcionalmente filtradas por categoria."""
        stmt = select(Account).where(Account.is_active == True)
        if category:
            stmt = stmt.where(Account.category == category)
        stmt = stmt.order_by(Account.code)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_account(self, **kwargs) -> Account:
        """Crea una cuenta contable."""
        account = Account(**kwargs)
        self.db.add(account)
        await self.db.flush()
        return account

    # =============================================
    # Asientos Contables
    # =============================================

    async def _generate_entry_number(self) -> str:
        """Genera numero secuencial de asiento."""
        stmt = select(func.count()).select_from(JournalEntry)
        result = await self.db.execute(stmt)
        count = (result.scalar() or 0) + 1
        return f"AST-{count:08d}"

    async def create_journal_entry(
        self,
        description: str,
        lines: list[dict],
        entry_date: date | None = None,
        reference_type: str | None = None,
        reference_id: uuid.UUID | None = None,
        posted_by: uuid.UUID | None = None,
    ) -> JournalEntry:
        """
        Crea un asiento contable de partida doble.
        Valida que debitos == creditos antes de registrar.

        lines: [{"account_id": UUID, "debit": float, "credit": float, "description": str}]
        """
        total_debit = sum(line.get("debit", 0) for line in lines)
        total_credit = sum(line.get("credit", 0) for line in lines)

        if abs(total_debit - total_credit) > 0.01:
            raise ValueError(
                f"Asiento desbalanceado: debitos ({total_debit}) != creditos ({total_credit})"
            )

        entry_number = await self._generate_entry_number()

        entry = JournalEntry(
            entry_number=entry_number,
            entry_date=entry_date or date.today(),
            description=description,
            reference_type=reference_type,
            reference_id=reference_id,
            total_debit=round(total_debit, 2),
            total_credit=round(total_credit, 2),
            status="posted",
            posted_by=posted_by,
            created_by=posted_by,
        )
        self.db.add(entry)
        await self.db.flush()

        for line_data in lines:
            line = JournalEntryLine(
                journal_entry_id=entry.id,
                account_id=line_data["account_id"],
                description=line_data.get("description"),
                debit=round(line_data.get("debit", 0), 2),
                credit=round(line_data.get("credit", 0), 2),
            )
            self.db.add(line)

        await self.db.flush()
        return entry

    async def reverse_journal_entry(
        self, entry_id: uuid.UUID, reason: str, posted_by: uuid.UUID | None = None
    ) -> JournalEntry:
        """Reversa un asiento contable creando uno inverso."""
        stmt = (
            select(JournalEntry)
            .where(JournalEntry.id == entry_id)
            .options(selectinload(JournalEntry.lines))
        )
        result = await self.db.execute(stmt)
        original = result.scalar_one_or_none()

        if not original:
            raise ValueError("Asiento no encontrado")
        if original.status == "reversed":
            raise ValueError("Este asiento ya fue reversado")

        # Crear asiento inverso (intercambiar debito/credito)
        reversal_lines = [
            {
                "account_id": line.account_id,
                "debit": parse_float_safe(line.credit, fallback=0.0, field_name="line.credit"),
                "credit": parse_float_safe(line.debit, fallback=0.0, field_name="line.debit"),
                "description": f"Reversa: {line.description or ''}",
            }
            for line in original.lines
        ]

        reversal = await self.create_journal_entry(
            description=f"Reversa de {original.entry_number}: {reason}",
            lines=reversal_lines,
            reference_type="reversal",
            reference_id=original.id,
            posted_by=posted_by,
        )
        reversal.reversal_of = original.id
        original.status = "reversed"
        original.reversed_by = reversal.id

        await self.db.flush()
        return reversal

    async def get_journal_entry(self, entry_id: uuid.UUID) -> JournalEntry | None:
        """Obtiene un asiento contable con sus lineas."""
        stmt = (
            select(JournalEntry)
            .where(JournalEntry.id == entry_id)
            .options(selectinload(JournalEntry.lines))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_journal_entries(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        reference_type: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[JournalEntry], int]:
        """Lista asientos contables con filtros."""
        stmt = select(JournalEntry).where(JournalEntry.is_active == True)
        count_stmt = select(func.count()).select_from(JournalEntry).where(JournalEntry.is_active == True)

        if start_date:
            stmt = stmt.where(JournalEntry.entry_date >= start_date)
            count_stmt = count_stmt.where(JournalEntry.entry_date >= start_date)
        if end_date:
            stmt = stmt.where(JournalEntry.entry_date <= end_date)
            count_stmt = count_stmt.where(JournalEntry.entry_date <= end_date)
        if reference_type:
            stmt = stmt.where(JournalEntry.reference_type == reference_type)
            count_stmt = count_stmt.where(JournalEntry.reference_type == reference_type)

        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar() or 0

        stmt = (
            stmt.options(selectinload(JournalEntry.lines))
            .offset(offset).limit(limit)
            .order_by(JournalEntry.entry_date.desc(), JournalEntry.entry_number.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    # =============================================
    # Asientos Automaticos por Eventos de Facturacion
    # =============================================

    async def record_invoice_entry(
        self, invoice: "Invoice", posted_by: uuid.UUID | None = None
    ) -> JournalEntry | None:
        """
        Asiento automatico al emitir factura:
        Debito: Cuentas por Cobrar (subtotal + ITBIS)
        Credito: Ingresos por Servicios (subtotal)
        Credito: ITBIS por Pagar (tax_total)
        """
        cxc = await self.get_account_by_type("cuentas_por_cobrar")
        ingreso = await self.get_account_by_type("ingreso_servicios")
        itbis = await self.get_account_by_type("impuesto_por_pagar")

        if not all([cxc, ingreso, itbis]):
            return None  # Plan contable no inicializado

        lines = [
            {
                "account_id": cxc.id,
                "debit": parse_float_safe(invoice.grand_total, fallback=0.0, field_name="invoice.grand_total"),
                "credit": 0,
                "description": f"CxC Factura {invoice.invoice_number}",
            },
            {
                "account_id": ingreso.id,
                "debit": 0,
                "credit": parse_float_safe(invoice.subtotal, fallback=0.0, field_name="invoice.subtotal"),
                "description": f"Ingreso Factura {invoice.invoice_number}",
            },
        ]

        if parse_float_safe(invoice.tax_total, fallback=0.0, field_name="invoice.tax_total") > 0:
            lines.append({
                "account_id": itbis.id,
                "debit": 0,
                "credit": parse_float_safe(invoice.tax_total, fallback=0.0, field_name="invoice.tax_total"),
                "description": f"ITBIS Factura {invoice.invoice_number}",
            })

        return await self.create_journal_entry(
            description=f"Factura {invoice.invoice_number} - {invoice.customer_name or 'Paciente'}",
            lines=lines,
            entry_date=invoice.created_at.date() if invoice.created_at else date.today(),
            reference_type="invoice",
            reference_id=invoice.id,
            posted_by=posted_by,
        )

    async def record_payment_entry(
        self, payment: "Payment", invoice: "Invoice",
        posted_by: uuid.UUID | None = None,
    ) -> JournalEntry | None:
        """
        Asiento automatico al registrar pago:
        Debito: Caja/Banco (monto pagado)
        Credito: Cuentas por Cobrar (monto pagado)
        """
        method_account_map = {
            "cash": "caja",
            "efectivo": "caja",
            "card": "banco",
            "tarjeta": "banco",
            "transfer": "banco",
            "transferencia": "banco",
            "check": "banco",
            "cheque": "banco",
        }
        acct_type = method_account_map.get(payment.payment_method, "banco")
        cash_account = await self.get_account_by_type(acct_type)
        cxc = await self.get_account_by_type("cuentas_por_cobrar")

        if not all([cash_account, cxc]):
            return None

        return await self.create_journal_entry(
            description=f"Pago Factura {invoice.invoice_number} ({payment.payment_method})",
            lines=[
                {
                    "account_id": cash_account.id,
                    "debit": parse_float_safe(payment.amount, fallback=0.0, field_name="payment.amount"),
                    "credit": 0,
                    "description": f"Cobro {payment.payment_method} ref:{payment.reference_number or 'N/A'}",
                },
                {
                    "account_id": cxc.id,
                    "debit": 0,
                    "credit": parse_float_safe(payment.amount, fallback=0.0, field_name="payment.amount"),
                    "description": f"Aplicacion pago a Factura {invoice.invoice_number}",
                },
            ],
            reference_type="payment",
            reference_id=payment.id,
            posted_by=posted_by,
        )

    async def record_credit_note_entry(
        self, credit_note: "CreditNote", posted_by: uuid.UUID | None = None
    ) -> JournalEntry | None:
        """
        Asiento automatico al emitir nota de credito:
        Debito: Devoluciones/Descuentos (subtotal)
        Debito: ITBIS por Pagar (tax)
        Credito: Cuentas por Cobrar (total)
        """
        devoluciones = await self.get_account_by_type("devoluciones")
        itbis = await self.get_account_by_type("impuesto_por_pagar")
        cxc = await self.get_account_by_type("cuentas_por_cobrar")

        if not all([devoluciones, cxc]):
            return None

        lines = [
            {
                "account_id": devoluciones.id,
                "debit": parse_float_safe(credit_note.subtotal, fallback=0.0, field_name="credit_note.subtotal"),
                "credit": 0,
                "description": f"NC {credit_note.credit_note_number} - {credit_note.reason}",
            },
            {
                "account_id": cxc.id,
                "debit": 0,
                "credit": parse_float_safe(credit_note.grand_total, fallback=0.0, field_name="credit_note.grand_total"),
                "description": f"Reduccion CxC por NC {credit_note.credit_note_number}",
            },
        ]

        if parse_float_safe(credit_note.tax_total, fallback=0.0, field_name="credit_note.tax_total") > 0 and itbis:
            lines.insert(1, {
                "account_id": itbis.id,
                "debit": parse_float_safe(credit_note.tax_total, fallback=0.0, field_name="credit_note.tax_total"),
                "credit": 0,
                "description": f"Reversa ITBIS NC {credit_note.credit_note_number}",
            })

        return await self.create_journal_entry(
            description=f"Nota de Credito {credit_note.credit_note_number}",
            lines=lines,
            reference_type="credit_note",
            reference_id=credit_note.id,
            posted_by=posted_by,
        )

    # =============================================
    # Reportes Financieros
    # =============================================

    async def get_trial_balance(self, as_of_date: date | None = None) -> dict:
        """
        Balance de comprobacion: saldos deudores y acreedores por cuenta.
        """
        if not as_of_date:
            as_of_date = date.today()

        # Obtener todas las cuentas de detalle
        accounts = await self.list_accounts()
        detail_accounts = [a for a in accounts if a.is_detail]

        lines = []
        total_debits = 0.0
        total_credits = 0.0

        for account in detail_accounts:
            # Sumar debitos y creditos de todas las lineas de asientos
            stmt = select(
                func.coalesce(func.sum(JournalEntryLine.debit), 0),
                func.coalesce(func.sum(JournalEntryLine.credit), 0),
            ).join(
                JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id
            ).where(
                JournalEntryLine.account_id == account.id,
                JournalEntry.entry_date <= as_of_date,
                JournalEntry.status == "posted",
            )
            result = await self.db.execute(stmt)
            row = result.one()
            debit_sum = parse_float_safe(row[0], fallback=0.0, field_name="debit_sum")
            credit_sum = parse_float_safe(row[1], fallback=0.0, field_name="credit_sum")

            if debit_sum > 0 or credit_sum > 0:
                # Calcular saldo neto
                net = debit_sum - credit_sum
                debit_balance = max(net, 0)
                credit_balance = max(-net, 0)

                lines.append({
                    "account_code": account.code,
                    "account_name": account.name,
                    "category": account.category,
                    "debit_balance": round(debit_balance, 2),
                    "credit_balance": round(credit_balance, 2),
                })
                total_debits += debit_balance
                total_credits += credit_balance

        return {
            "as_of_date": as_of_date,
            "currency": "DOP",
            "lines": lines,
            "total_debits": round(total_debits, 2),
            "total_credits": round(total_credits, 2),
        }

    async def get_ar_aging_report(self) -> dict:
        """
        Reporte de antiguedad de cuentas por cobrar.
        Clasifica facturas pendientes por dias de vencimiento.
        """
        today = date.today()

        stmt = (
            select(Invoice)
            .where(
                Invoice.is_active == True,
                Invoice.status.in_(["issued", "partial"]),
            )
            .options(selectinload(Invoice.payments))
            .order_by(Invoice.created_at)
        )
        result = await self.db.execute(stmt)
        invoices = list(result.scalars().all())

        items = []
        buckets = {
            "corriente": 0.0,
            "1_30": 0.0,
            "31_60": 0.0,
            "61_90": 0.0,
            "90_plus": 0.0,
        }

        for inv in invoices:
            total_paid = sum(parse_float_safe(p.amount, fallback=0.0, field_name="payment.amount") for p in inv.payments)
            balance = parse_float_safe(inv.grand_total, fallback=0.0, field_name="inv.grand_total") - total_paid

            if balance <= 0:
                continue

            ref_date = inv.due_date or inv.created_at.date()
            days = (today - ref_date).days

            if days <= 0:
                bucket = "corriente"
            elif days <= 30:
                bucket = "1_30"
            elif days <= 60:
                bucket = "31_60"
            elif days <= 90:
                bucket = "61_90"
            else:
                bucket = "90_plus"

            buckets[bucket] += balance

            bucket_labels = {
                "corriente": "Corriente",
                "1_30": "1-30 dias",
                "31_60": "31-60 dias",
                "61_90": "61-90 dias",
                "90_plus": "90+ dias",
            }

            items.append({
                "patient_id": str(inv.patient_id),
                "patient_name": inv.customer_name or "N/A",
                "invoice_id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "fiscal_number": inv.fiscal_number,
                "invoice_date": inv.created_at.date().isoformat(),
                "due_date": inv.due_date.isoformat() if inv.due_date else None,
                "grand_total": parse_float_safe(inv.grand_total, fallback=0.0, field_name="inv.grand_total"),
                "total_paid": total_paid,
                "balance": round(balance, 2),
                "days_outstanding": max(days, 0),
                "aging_bucket": bucket_labels[bucket],
            })

        total_receivable = sum(item["balance"] for item in items)

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "currency": "DOP",
            "items": items,
            "summary": {
                "Corriente": round(buckets["corriente"], 2),
                "1-30 dias": round(buckets["1_30"], 2),
                "31-60 dias": round(buckets["31_60"], 2),
                "61-90 dias": round(buckets["61_90"], 2),
                "90+ dias": round(buckets["90_plus"], 2),
            },
            "total_receivable": round(total_receivable, 2),
        }


class CreditNoteService:
    """Servicio de notas de credito."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_credit_note(
        self,
        original_invoice_id: uuid.UUID,
        reason: str,
        lines: list[dict] | None = None,
        full_reversal: bool = False,
        created_by: uuid.UUID | None = None,
        tenant_id: str | None = None,
    ) -> CreditNote:
        """
        Crea una nota de credito.
        Si full_reversal=True, revierte todas las lineas de la factura original.
        """
        # Obtener factura original
        stmt = (
            select(Invoice)
            .where(Invoice.id == original_invoice_id, Invoice.is_active == True)
            .options(selectinload(Invoice.lines))
        )
        result = await self.db.execute(stmt)
        invoice = result.scalar_one_or_none()

        if not invoice:
            raise ValueError("Factura original no encontrada")
        if invoice.status == "cancelled":
            raise ValueError("No se puede crear nota de credito para factura anulada")

        # Generar numero de NC
        cn_number = await self._generate_cn_number()

        if full_reversal:
            # Reversa completa: copiar todas las lineas
            cn_lines_data = [
                {
                    "original_invoice_line_id": line.id,
                    "description": line.description,
                    "quantity": line.quantity,
                    "unit_price": parse_float_safe(line.unit_price, fallback=0.0, field_name="line.unit_price"),
                    "tax": parse_float_safe(line.tax, fallback=0.0, field_name="line.tax"),
                }
                for line in invoice.lines
            ]
            subtotal = parse_float_safe(invoice.subtotal, fallback=0.0, field_name="invoice.subtotal")
            tax_total = parse_float_safe(invoice.tax_total, fallback=0.0, field_name="invoice.tax_total")
        else:
            cn_lines_data = lines or []
            subtotal = sum(
                l["quantity"] * l["unit_price"] for l in cn_lines_data
            )
            tax_total = sum(l.get("tax", 0) for l in cn_lines_data)

        grand_total = subtotal + tax_total

        # Generar NCF de nota de credito (tipo 04)
        fiscal_number = None
        if invoice.country_code == "DO":
            from app.integrations.fiscal.engine import get_fiscal_engine
            engine = get_fiscal_engine("DO")
            fiscal_doc = await engine.generate_credit_note(
                invoice.fiscal_number or "",
                {"sequence": await self._get_next_sequence(tenant_id)},
            )
            fiscal_number = fiscal_doc.fiscal_number

        credit_note = CreditNote(
            credit_note_number=cn_number,
            fiscal_number=fiscal_number,
            original_invoice_id=original_invoice_id,
            patient_id=invoice.patient_id,
            reason=reason,
            subtotal=round(subtotal, 2),
            tax_total=round(tax_total, 2),
            grand_total=round(grand_total, 2),
            currency=invoice.currency,
            country_code=invoice.country_code,
            created_by=created_by,
        )
        self.db.add(credit_note)
        await self.db.flush()

        # Crear lineas
        for line_data in cn_lines_data:
            line = CreditNoteLine(
                credit_note_id=credit_note.id,
                original_invoice_line_id=line_data.get("original_invoice_line_id"),
                description=line_data["description"],
                quantity=line_data.get("quantity", 1),
                unit_price=line_data["unit_price"],
                tax=line_data.get("tax", 0),
                line_total=round(
                    line_data.get("quantity", 1) * line_data["unit_price"] + line_data.get("tax", 0), 2
                ),
            )
            self.db.add(line)

        # Si es reversa completa, marcar factura como credit_note
        if full_reversal:
            invoice.status = "credit_note"

        await self.db.flush()

        # Generar asiento contable automatico
        accounting = AccountingService(self.db)
        await accounting.record_credit_note_entry(credit_note, posted_by=created_by)

        return credit_note

    async def get_credit_note(self, cn_id: uuid.UUID) -> CreditNote | None:
        """Obtiene nota de credito con lineas."""
        stmt = (
            select(CreditNote)
            .where(CreditNote.id == cn_id, CreditNote.is_active == True)
            .options(selectinload(CreditNote.lines))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_credit_notes(
        self,
        patient_id: uuid.UUID | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[CreditNote], int]:
        """Lista notas de credito."""
        stmt = select(CreditNote).where(CreditNote.is_active == True)
        count_stmt = select(func.count()).select_from(CreditNote).where(CreditNote.is_active == True)

        if patient_id:
            stmt = stmt.where(CreditNote.patient_id == patient_id)
            count_stmt = count_stmt.where(CreditNote.patient_id == patient_id)

        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar() or 0

        stmt = stmt.offset(offset).limit(limit).order_by(CreditNote.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def _generate_cn_number(self) -> str:
        """Genera numero secuencial de nota de credito."""
        stmt = select(func.count()).select_from(CreditNote)
        result = await self.db.execute(stmt)
        count = (result.scalar() or 0) + 1
        return f"NC-{count:08d}"

    async def _get_next_sequence(self, tenant_id: str | None) -> int:
        """Obtiene siguiente secuencia para NCF tipo 04."""
        from app.modules.billing.models import FiscalConfig
        if not tenant_id:
            stmt = select(func.count()).select_from(CreditNote)
            result = await self.db.execute(stmt)
            return (result.scalar() or 0) + 1

        stmt = select(FiscalConfig).where(
            FiscalConfig.tenant_id == tenant_id,
            FiscalConfig.country_code == "DO",
        )
        result = await self.db.execute(stmt)
        config = result.scalar_one_or_none()
        if config:
            config.current_sequence += 1
            return config.current_sequence
        return 1
