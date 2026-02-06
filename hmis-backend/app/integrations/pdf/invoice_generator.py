"""
Generador de facturas en PDF para hospitales.

Genera documentos PDF profesionales para facturas y notas de credito,
cumpliendo con los requisitos fiscales de Republica Dominicana (NCF/DGII)
y otros paises de Latinoamerica.

Utiliza reportlab para la generacion de PDFs con diseno profesional
orientado al sector salud.
"""

import io
from datetime import datetime
from decimal import Decimal
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, inch, mm
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# ---------------------------------------------------------------------------
# Paleta de colores institucional
# ---------------------------------------------------------------------------
COLOR_PRIMARY = colors.HexColor("#1a5276")       # Azul oscuro - encabezados
COLOR_SECONDARY = colors.HexColor("#2980b9")      # Azul medio - acentos
COLOR_ACCENT = colors.HexColor("#27ae60")          # Verde - totales
COLOR_LIGHT_BG = colors.HexColor("#eaf2f8")        # Azul claro - filas alternas
COLOR_HEADER_BG = colors.HexColor("#1a5276")       # Fondo encabezado tabla
COLOR_BORDER = colors.HexColor("#bdc3c7")          # Bordes suaves
COLOR_TEXT = colors.HexColor("#2c3e50")             # Texto principal
COLOR_MUTED = colors.HexColor("#7f8c8d")           # Texto secundario
COLOR_DANGER = colors.HexColor("#c0392b")           # Rojo - notas de credito

# ---------------------------------------------------------------------------
# Simbolos de moneda
# ---------------------------------------------------------------------------
CURRENCY_SYMBOLS: dict[str, str] = {
    "DOP": "RD$",
    "USD": "US$",
    "COP": "COL$",
    "MXN": "MX$",
    "EUR": "\u20ac",
}


def _fmt_currency(amount: float | Decimal | None, currency: str = "DOP") -> str:
    """Formatea un monto con simbolo de moneda."""
    if amount is None:
        return ""
    symbol = CURRENCY_SYMBOLS.get(currency, currency)
    return f"{symbol} {float(amount):,.2f}"


def _fmt_date(value: str | datetime | None) -> str:
    """Formatea una fecha a dd/mm/aaaa."""
    if value is None:
        return ""
    if isinstance(value, str):
        # Intenta ISO 8601
        try:
            value = datetime.fromisoformat(value)
        except (ValueError, TypeError):
            return value
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    return str(value)


# ---------------------------------------------------------------------------
# Estilos de parrafo reutilizables
# ---------------------------------------------------------------------------
def _get_styles() -> dict[str, ParagraphStyle]:
    """Retorna diccionario de estilos personalizados para el PDF."""
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "InvoiceTitle",
            parent=base["Title"],
            fontSize=20,
            textColor=COLOR_PRIMARY,
            spaceAfter=2 * mm,
            alignment=TA_LEFT,
            fontName="Helvetica-Bold",
        ),
        "subtitle": ParagraphStyle(
            "InvoiceSubtitle",
            parent=base["Normal"],
            fontSize=10,
            textColor=COLOR_MUTED,
            spaceAfter=1 * mm,
            fontName="Helvetica",
        ),
        "section_header": ParagraphStyle(
            "SectionHeader",
            parent=base["Heading2"],
            fontSize=11,
            textColor=COLOR_PRIMARY,
            spaceBefore=4 * mm,
            spaceAfter=2 * mm,
            fontName="Helvetica-Bold",
        ),
        "normal": ParagraphStyle(
            "InvoiceNormal",
            parent=base["Normal"],
            fontSize=9,
            textColor=COLOR_TEXT,
            fontName="Helvetica",
            leading=12,
        ),
        "normal_bold": ParagraphStyle(
            "InvoiceNormalBold",
            parent=base["Normal"],
            fontSize=9,
            textColor=COLOR_TEXT,
            fontName="Helvetica-Bold",
            leading=12,
        ),
        "small": ParagraphStyle(
            "InvoiceSmall",
            parent=base["Normal"],
            fontSize=7,
            textColor=COLOR_MUTED,
            fontName="Helvetica",
            leading=9,
        ),
        "ncf": ParagraphStyle(
            "NCFStyle",
            parent=base["Normal"],
            fontSize=12,
            textColor=COLOR_PRIMARY,
            fontName="Helvetica-Bold",
            alignment=TA_RIGHT,
        ),
        "grand_total": ParagraphStyle(
            "GrandTotal",
            parent=base["Normal"],
            fontSize=14,
            textColor=colors.white,
            fontName="Helvetica-Bold",
            alignment=TA_RIGHT,
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            parent=base["Normal"],
            fontSize=8,
            textColor=colors.white,
            fontName="Helvetica-Bold",
            alignment=TA_CENTER,
        ),
        "table_cell": ParagraphStyle(
            "TableCell",
            parent=base["Normal"],
            fontSize=8,
            textColor=COLOR_TEXT,
            fontName="Helvetica",
            leading=10,
        ),
        "table_cell_right": ParagraphStyle(
            "TableCellRight",
            parent=base["Normal"],
            fontSize=8,
            textColor=COLOR_TEXT,
            fontName="Helvetica",
            leading=10,
            alignment=TA_RIGHT,
        ),
        "footer": ParagraphStyle(
            "FooterStyle",
            parent=base["Normal"],
            fontSize=7,
            textColor=COLOR_MUTED,
            fontName="Helvetica",
            alignment=TA_CENTER,
            leading=9,
        ),
        "credit_note_title": ParagraphStyle(
            "CreditNoteTitle",
            parent=base["Title"],
            fontSize=20,
            textColor=COLOR_DANGER,
            spaceAfter=2 * mm,
            alignment=TA_LEFT,
            fontName="Helvetica-Bold",
        ),
    }


class InvoicePDFGenerator:
    """
    Generador de facturas en PDF para hospitales.

    Produce documentos PDF profesionales con encabezado institucional,
    datos del paciente/cliente, tabla de lineas de detalle, totales,
    informacion de pagos y pie de pagina con notas fiscales.

    Soporta facturas de credito fiscal, consumidor final y notas de credito
    segun la normativa dominicana (DGII/NCF).
    """

    def __init__(self, config: dict) -> None:
        """
        Inicializa el generador con la configuracion del hospital.

        Args:
            config: Diccionario con:
                - hospital_name: Nombre del hospital.
                - rnc: RNC del hospital.
                - address: Direccion del hospital.
                - phone: Telefono del hospital.
                - logo_path: Ruta al archivo del logo (opcional).
        """
        self.hospital_name: str = config.get("hospital_name", "")
        self.rnc: str = config.get("rnc", "")
        self.address: str = config.get("address", "")
        self.phone: str = config.get("phone", "")
        self.logo_path: str | None = config.get("logo_path")
        self._styles = _get_styles()

    # ------------------------------------------------------------------
    # API publica
    # ------------------------------------------------------------------

    async def generate_invoice_pdf(self, invoice_data: dict) -> bytes:
        """
        Genera un PDF de factura hospitalaria.

        Args:
            invoice_data: Diccionario con toda la informacion de la factura.
                Claves esperadas:
                - invoice_number, fiscal_number, date, due_date
                - customer_name, customer_tax_id, customer_address
                - lines: lista de dicts con description, quantity, unit_price,
                  discount, tax, line_total
                - subtotal, discount_total, tax_total, grand_total, currency
                - payments: lista de dicts con date, method, amount, reference
                - fiscal_type, country_code

        Returns:
            Bytes del PDF generado.
        """
        return self._render_pdf(invoice_data, is_credit_note=False)

    async def generate_credit_note_pdf(self, credit_note_data: dict) -> bytes:
        """
        Genera un PDF de nota de credito.

        Args:
            credit_note_data: Diccionario similar a invoice_data con campos
                adicionales:
                - original_invoice_number: Numero de la factura original.
                - original_fiscal_number: NCF de la factura original.
                - reason: Motivo de la nota de credito.

        Returns:
            Bytes del PDF generado.
        """
        return self._render_pdf(credit_note_data, is_credit_note=True)

    # ------------------------------------------------------------------
    # Renderizado principal
    # ------------------------------------------------------------------

    def _render_pdf(self, data: dict, *, is_credit_note: bool = False) -> bytes:
        """Construye el documento PDF completo y retorna bytes."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=1.5 * cm,
            rightMargin=1.5 * cm,
            topMargin=1.5 * cm,
            bottomMargin=2.5 * cm,
        )

        elements: list[Any] = []
        currency = data.get("currency", "DOP")

        # --- Encabezado institucional ---
        elements.extend(self._build_header_section(data, is_credit_note=is_credit_note))

        # --- Separador ---
        elements.append(Spacer(1, 3 * mm))
        elements.append(
            HRFlowable(
                width="100%",
                thickness=0.5,
                color=COLOR_BORDER,
                spaceAfter=4 * mm,
            )
        )

        # --- Datos del cliente ---
        elements.extend(self._build_customer_section(data))

        # --- Referencia a factura original (solo notas de credito) ---
        if is_credit_note:
            elements.extend(self._build_credit_note_reference(data))

        # --- Tabla de lineas ---
        elements.append(Spacer(1, 4 * mm))
        elements.append(self._build_items_table(data))

        # --- Totales ---
        elements.append(Spacer(1, 3 * mm))
        elements.append(self._build_totals(data))

        # --- Informacion de pagos ---
        payments = data.get("payments") or []
        if payments:
            elements.append(Spacer(1, 4 * mm))
            elements.extend(self._build_payments_section(data))

        # --- Area para codigo QR ---
        elements.append(Spacer(1, 5 * mm))
        elements.extend(self._build_qr_placeholder())

        # --- Notas fiscales al pie ---
        elements.append(Spacer(1, 4 * mm))
        elements.extend(self._build_fiscal_notes(data, is_credit_note=is_credit_note))

        # Construir documento con pie de pagina
        doc.build(
            elements,
            onFirstPage=lambda c, d: self._draw_page_footer(c, d, data),
            onLaterPages=lambda c, d: self._draw_page_footer(c, d, data),
        )

        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    # ------------------------------------------------------------------
    # Secciones del documento
    # ------------------------------------------------------------------

    def _build_header_section(
        self, data: dict, *, is_credit_note: bool = False
    ) -> list[Any]:
        """Construye la seccion de encabezado con datos del hospital y NCF."""
        elements: list[Any] = []
        s = self._styles

        # Fila superior: logo/nombre + NCF
        hospital_name = data.get("hospital_name") or self.hospital_name
        hospital_rnc = data.get("hospital_rnc") or self.rnc
        hospital_address = data.get("hospital_address") or self.address
        hospital_phone = data.get("hospital_phone") or self.phone

        # Columna izquierda: info del hospital
        left_parts: list[Any] = []

        # Logo si esta disponible
        logo_path = self.logo_path
        if logo_path:
            try:
                logo = Image(logo_path, width=4 * cm, height=1.5 * cm)
                logo.hAlign = "LEFT"
                left_parts.append(logo)
                left_parts.append(Spacer(1, 2 * mm))
            except Exception:
                pass  # Logo no disponible, continuar sin el

        title_style = s["credit_note_title"] if is_credit_note else s["title"]
        left_parts.append(Paragraph(hospital_name, title_style))
        left_parts.append(
            Paragraph(f"RNC: {hospital_rnc}", s["normal_bold"])
        )
        left_parts.append(Paragraph(hospital_address, s["normal"]))
        left_parts.append(Paragraph(f"Tel: {hospital_phone}", s["normal"]))

        left_cell = left_parts

        # Columna derecha: tipo de documento y NCF
        doc_type = "NOTA DE CR\u00c9DITO" if is_credit_note else "FACTURA"
        fiscal_number = data.get("fiscal_number", "")
        invoice_number = data.get("invoice_number", "")
        date_str = _fmt_date(data.get("date"))
        due_date_str = _fmt_date(data.get("due_date"))

        right_parts: list[Any] = []
        right_parts.append(Paragraph(doc_type, s["ncf"]))
        right_parts.append(Spacer(1, 2 * mm))
        if fiscal_number:
            right_parts.append(
                Paragraph(f"NCF: {fiscal_number}", s["ncf"])
            )
            right_parts.append(Spacer(1, 1 * mm))
        right_parts.append(
            Paragraph(
                f"No.: {invoice_number}",
                ParagraphStyle(
                    "InvNum",
                    parent=s["normal"],
                    alignment=TA_RIGHT,
                    fontSize=9,
                    fontName="Helvetica-Bold",
                ),
            )
        )
        right_parts.append(
            Paragraph(
                f"Fecha: {date_str}",
                ParagraphStyle(
                    "InvDate",
                    parent=s["normal"],
                    alignment=TA_RIGHT,
                    fontSize=9,
                ),
            )
        )
        if due_date_str:
            right_parts.append(
                Paragraph(
                    f"Vencimiento: {due_date_str}",
                    ParagraphStyle(
                        "InvDue",
                        parent=s["normal"],
                        alignment=TA_RIGHT,
                        fontSize=9,
                    ),
                )
            )

        right_cell = right_parts

        # Tabla de 2 columnas para el encabezado
        header_table = Table(
            [[left_cell, right_cell]],
            colWidths=[10 * cm, 8.5 * cm],
        )
        header_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        elements.append(header_table)
        return elements

    def _build_customer_section(self, data: dict) -> list[Any]:
        """Construye la seccion con datos del cliente/paciente."""
        elements: list[Any] = []
        s = self._styles

        elements.append(Paragraph("DATOS DEL CLIENTE", s["section_header"]))

        customer_name = data.get("customer_name", "")
        customer_tax_id = data.get("customer_tax_id", "")
        customer_address = data.get("customer_address", "")

        info_data = [
            [
                Paragraph("Nombre / Raz\u00f3n Social:", s["normal_bold"]),
                Paragraph(customer_name, s["normal"]),
                Paragraph("RNC / C\u00e9dula:", s["normal_bold"]),
                Paragraph(customer_tax_id, s["normal"]),
            ],
            [
                Paragraph("Direcci\u00f3n:", s["normal_bold"]),
                Paragraph(customer_address, s["normal"]),
                Paragraph("", s["normal"]),
                Paragraph("", s["normal"]),
            ],
        ]

        info_table = Table(
            info_data,
            colWidths=[3.8 * cm, 6.2 * cm, 3 * cm, 5.5 * cm],
        )
        info_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ("BACKGROUND", (0, 0), (-1, -1), COLOR_LIGHT_BG),
                    ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                    ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_BORDER),
                ]
            )
        )
        elements.append(info_table)
        return elements

    def _build_credit_note_reference(self, data: dict) -> list[Any]:
        """Construye la seccion de referencia a factura original en notas de credito."""
        elements: list[Any] = []
        s = self._styles

        elements.append(Spacer(1, 3 * mm))
        elements.append(
            Paragraph("REFERENCIA A DOCUMENTO ORIGINAL", s["section_header"])
        )

        original_invoice = data.get("original_invoice_number", "")
        original_ncf = data.get("original_fiscal_number", "")
        reason = data.get("reason", "")

        ref_data = [
            [
                Paragraph("Factura Original:", s["normal_bold"]),
                Paragraph(original_invoice, s["normal"]),
                Paragraph("NCF Original:", s["normal_bold"]),
                Paragraph(original_ncf, s["normal"]),
            ],
            [
                Paragraph("Motivo:", s["normal_bold"]),
                Paragraph(reason, s["normal"]),
                Paragraph("", s["normal"]),
                Paragraph("", s["normal"]),
            ],
        ]

        ref_table = Table(
            ref_data,
            colWidths=[3.8 * cm, 6.2 * cm, 3 * cm, 5.5 * cm],
        )
        ref_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fdedec")),
                    ("BOX", (0, 0), (-1, -1), 0.5, COLOR_DANGER),
                    ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_DANGER),
                ]
            )
        )
        elements.append(ref_table)
        return elements

    def _build_items_table(self, data: dict) -> Table:
        """
        Construye la tabla de lineas de detalle de la factura.

        Columnas: Descripcion, Cant., Precio Unit., Desc., ITBIS, Total
        """
        s = self._styles
        currency = data.get("currency", "DOP")
        lines = data.get("lines") or []

        # Encabezados
        headers = [
            Paragraph("Descripci\u00f3n", s["table_header"]),
            Paragraph("Cant.", s["table_header"]),
            Paragraph("Precio Unit.", s["table_header"]),
            Paragraph("Desc.", s["table_header"]),
            Paragraph("ITBIS", s["table_header"]),
            Paragraph("Total", s["table_header"]),
        ]

        table_data = [headers]

        for line in lines:
            row = [
                Paragraph(str(line.get("description", "")), s["table_cell"]),
                Paragraph(str(line.get("quantity", 0)), s["table_cell_right"]),
                Paragraph(
                    _fmt_currency(line.get("unit_price", 0), currency),
                    s["table_cell_right"],
                ),
                Paragraph(
                    _fmt_currency(line.get("discount", 0), currency),
                    s["table_cell_right"],
                ),
                Paragraph(
                    _fmt_currency(line.get("tax", 0), currency),
                    s["table_cell_right"],
                ),
                Paragraph(
                    _fmt_currency(line.get("line_total", 0), currency),
                    s["table_cell_right"],
                ),
            ]
            table_data.append(row)

        # Si no hay lineas, agregar fila vacia
        if not lines:
            empty_row = [Paragraph("", s["table_cell"])] * 6
            table_data.append(empty_row)

        col_widths = [7 * cm, 1.5 * cm, 2.8 * cm, 2.2 * cm, 2.2 * cm, 2.8 * cm]
        table = Table(table_data, colWidths=col_widths, repeatRows=1)

        # Estilo de la tabla
        style_commands: list[Any] = [
            # Encabezado
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_HEADER_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            # Celdas de datos
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ("ALIGN", (0, 1), (0, -1), "LEFT"),
            # Bordes
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ("LINEBELOW", (0, 0), (-1, 0), 1, COLOR_PRIMARY),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_BORDER),
            # Padding
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]

        # Filas alternas con fondo claro
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                style_commands.append(
                    ("BACKGROUND", (0, i), (-1, i), COLOR_LIGHT_BG)
                )

        table.setStyle(TableStyle(style_commands))
        return table

    def _build_totals(self, data: dict) -> Table:
        """
        Construye la seccion de totales: Subtotal, Descuento, ITBIS, Total General.
        """
        s = self._styles
        currency = data.get("currency", "DOP")
        subtotal = data.get("subtotal", 0)
        discount_total = data.get("discount_total", 0)
        tax_total = data.get("tax_total", 0)
        grand_total = data.get("grand_total", 0)

        # Tabla alineada a la derecha
        totals_data = [
            [
                Paragraph("Subtotal:", s["normal_bold"]),
                Paragraph(
                    _fmt_currency(subtotal, currency), s["table_cell_right"]
                ),
            ],
            [
                Paragraph("Descuento:", s["normal_bold"]),
                Paragraph(
                    f"- {_fmt_currency(discount_total, currency)}"
                    if discount_total
                    else _fmt_currency(0, currency),
                    s["table_cell_right"],
                ),
            ],
            [
                Paragraph("ITBIS (18%):", s["normal_bold"]),
                Paragraph(
                    _fmt_currency(tax_total, currency), s["table_cell_right"]
                ),
            ],
            [
                Paragraph("TOTAL GENERAL:", s["grand_total"]),
                Paragraph(
                    _fmt_currency(grand_total, currency), s["grand_total"]
                ),
            ],
        ]

        totals_table = Table(
            totals_data,
            colWidths=[4 * cm, 4 * cm],
            hAlign="RIGHT",
        )

        style_commands: list[Any] = [
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (0, -1), "RIGHT"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            # Linea encima del total general
            ("LINEABOVE", (0, -1), (-1, -1), 1, COLOR_PRIMARY),
            # Fondo del total general
            ("BACKGROUND", (0, -1), (-1, -1), COLOR_PRIMARY),
            ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
            # Borde exterior
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ]

        totals_table.setStyle(TableStyle(style_commands))
        return totals_table

    def _build_payments_section(self, data: dict) -> list[Any]:
        """Construye la seccion de informacion de pagos."""
        elements: list[Any] = []
        s = self._styles
        currency = data.get("currency", "DOP")
        payments = data.get("payments") or []

        elements.append(
            Paragraph("INFORMACI\u00d3N DE PAGOS", s["section_header"])
        )

        # Encabezados de la tabla de pagos
        pay_headers = [
            Paragraph("Fecha", s["table_header"]),
            Paragraph("M\u00e9todo", s["table_header"]),
            Paragraph("Monto", s["table_header"]),
            Paragraph("Referencia", s["table_header"]),
        ]

        pay_data = [pay_headers]

        method_labels: dict[str, str] = {
            "cash": "Efectivo",
            "credit_card": "Tarjeta de Cr\u00e9dito",
            "debit_card": "Tarjeta de D\u00e9bito",
            "transfer": "Transferencia",
            "check": "Cheque",
            "insurance": "Seguro M\u00e9dico",
        }

        for payment in payments:
            method_raw = payment.get("method", "")
            method_display = method_labels.get(method_raw, method_raw)
            row = [
                Paragraph(_fmt_date(payment.get("date")), s["table_cell"]),
                Paragraph(method_display, s["table_cell"]),
                Paragraph(
                    _fmt_currency(payment.get("amount", 0), currency),
                    s["table_cell_right"],
                ),
                Paragraph(
                    str(payment.get("reference", "")), s["table_cell"]
                ),
            ]
            pay_data.append(row)

        pay_table = Table(
            pay_data,
            colWidths=[3.5 * cm, 4 * cm, 3.5 * cm, 7.5 * cm],
            repeatRows=1,
        )
        pay_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), COLOR_SECONDARY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("ALIGN", (2, 1), (2, -1), "RIGHT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                    ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_BORDER),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        elements.append(pay_table)
        return elements

    def _build_qr_placeholder(self) -> list[Any]:
        """Construye el area reservada para codigo QR fiscal."""
        elements: list[Any] = []
        s = self._styles

        # Recuadro placeholder para QR
        qr_data = [
            [
                Paragraph(
                    "[C\u00f3digo QR Fiscal]",
                    ParagraphStyle(
                        "QRPlaceholder",
                        parent=s["normal"],
                        fontSize=8,
                        textColor=COLOR_MUTED,
                        alignment=TA_CENTER,
                    ),
                )
            ]
        ]
        qr_table = Table(qr_data, colWidths=[3.5 * cm], rowHeights=[3.5 * cm])
        qr_table.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8f9fa")),
                ]
            )
        )
        qr_table.hAlign = "LEFT"
        elements.append(qr_table)
        return elements

    def _build_fiscal_notes(
        self, data: dict, *, is_credit_note: bool = False
    ) -> list[Any]:
        """Construye las notas fiscales al pie del documento."""
        elements: list[Any] = []
        s = self._styles

        elements.append(
            HRFlowable(
                width="100%",
                thickness=0.5,
                color=COLOR_BORDER,
                spaceAfter=2 * mm,
            )
        )

        fiscal_type = data.get("fiscal_type", "consumidor_final")
        country_code = data.get("country_code", "DO")

        notes: list[str] = []

        if country_code == "DO":
            notes.append(
                "<b>Valor Fiscal</b> \u2014 Documento con validez fiscal "
                "seg\u00fan la Direcci\u00f3n General de Impuestos Internos (DGII)."
            )

            if fiscal_type == "credito_fiscal":
                notes.append(
                    "Comprobante v\u00e1lido para fines de cr\u00e9dito fiscal "
                    "(Tipo 01 - Cr\u00e9dito Fiscal)."
                )
            elif fiscal_type == "consumidor_final":
                notes.append(
                    "Factura de consumidor final (Tipo 02). "
                    "No genera cr\u00e9dito fiscal."
                )
            elif fiscal_type == "regimenes_especiales":
                notes.append(
                    "Comprobante para reg\u00edmenes especiales de tributaci\u00f3n "
                    "(Tipo 14)."
                )
            elif fiscal_type == "gubernamental":
                notes.append(
                    "Comprobante gubernamental (Tipo 15)."
                )

            if is_credit_note:
                notes.append(
                    "Nota de cr\u00e9dito fiscal (Tipo 04). Aplica como "
                    "reducci\u00f3n del valor facturado en el NCF de referencia."
                )

            notes.append(
                "ITBIS incluido donde aplica (18% seg\u00fan Ley 253-12)."
            )
            notes.append(
                "Este documento debe conservarse por un m\u00ednimo de "
                "10 a\u00f1os seg\u00fan Art. 50 del C\u00f3digo Tributario."
            )
        elif country_code == "CO":
            notes.append(
                "<b>Factura Electr\u00f3nica</b> \u2014 Documento generado "
                "conforme a la Resoluci\u00f3n DIAN."
            )
        elif country_code == "MX":
            notes.append(
                "<b>CFDI</b> \u2014 Comprobante Fiscal Digital por Internet, "
                "generado conforme a las disposiciones del SAT."
            )

        for note in notes:
            elements.append(Paragraph(note, s["small"]))
            elements.append(Spacer(1, 1 * mm))

        return elements

    # ------------------------------------------------------------------
    # Pie de pagina (dibujado en canvas)
    # ------------------------------------------------------------------

    def _draw_page_footer(self, canvas: Any, doc: Any, data: dict) -> None:
        """Dibuja el pie de pagina con numero de pagina e informacion del hospital."""
        canvas.saveState()

        page_width = letter[0]
        footer_y = 1.5 * cm

        # Linea separadora
        canvas.setStrokeColor(COLOR_BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(
            1.5 * cm, footer_y + 5 * mm,
            page_width - 1.5 * cm, footer_y + 5 * mm,
        )

        # Texto del pie
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(COLOR_MUTED)

        hospital_name = data.get("hospital_name") or self.hospital_name
        footer_text = (
            f"{hospital_name} \u2014 Sistema de Facturaci\u00f3n Hospitalaria HMIS"
        )
        canvas.drawCentredString(page_width / 2, footer_y, footer_text)

        # Numero de pagina
        page_num = canvas.getPageNumber()
        canvas.drawRightString(
            page_width - 1.5 * cm,
            footer_y - 3 * mm,
            f"P\u00e1gina {page_num}",
        )

        # Fecha y hora de generacion
        now = datetime.now().strftime("%d/%m/%Y %H:%M")
        canvas.drawString(
            1.5 * cm,
            footer_y - 3 * mm,
            f"Generado: {now}",
        )

        canvas.restoreState()

    # ------------------------------------------------------------------
    # Metodos auxiliares legacy (compatibilidad con interfaz documentada)
    # ------------------------------------------------------------------

    def _build_header(self, canvas: Any, doc: Any, data: dict) -> None:
        """
        Dibuja el encabezado en el canvas (metodo legacy).
        En la implementacion actual el encabezado se construye como flowables.
        Este metodo se mantiene para compatibilidad con la interfaz documentada.
        """
        pass  # Encabezado construido via _build_header_section

    def _build_footer(self, canvas: Any, doc: Any, data: dict) -> None:
        """
        Dibuja el pie de pagina (metodo legacy).
        Delega a _draw_page_footer.
        """
        self._draw_page_footer(canvas, doc, data)
