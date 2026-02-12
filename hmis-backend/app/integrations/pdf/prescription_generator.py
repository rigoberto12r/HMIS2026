"""
Generador de prescripciones medicas en PDF.

Genera documentos PDF profesionales para recetas medicas,
cumpliendo con los requisitos legales de Republica Dominicana
y otros paises de Latinoamerica.

Reutiliza la paleta de colores y estilos del generador de facturas.
"""

import io
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# ---------------------------------------------------------------------------
# Paleta de colores (consistente con invoice_generator.py)
# ---------------------------------------------------------------------------
COLOR_PRIMARY = colors.HexColor("#1a5276")
COLOR_SECONDARY = colors.HexColor("#2980b9")
COLOR_ACCENT = colors.HexColor("#27ae60")
COLOR_LIGHT_BG = colors.HexColor("#eaf2f8")
COLOR_HEADER_BG = colors.HexColor("#1a5276")
COLOR_BORDER = colors.HexColor("#bdc3c7")
COLOR_TEXT = colors.HexColor("#2c3e50")
COLOR_MUTED = colors.HexColor("#7f8c8d")
COLOR_WARNING = colors.HexColor("#e67e22")
COLOR_DANGER = colors.HexColor("#c0392b")


def _fmt_date(value: str | datetime | None) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except (ValueError, TypeError):
            return value
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    return str(value)


def _get_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "RxTitle", parent=base["Title"],
            fontSize=18, textColor=COLOR_PRIMARY,
            spaceAfter=2 * mm, alignment=TA_LEFT,
            fontName="Helvetica-Bold",
        ),
        "subtitle": ParagraphStyle(
            "RxSubtitle", parent=base["Normal"],
            fontSize=10, textColor=COLOR_MUTED,
            spaceAfter=1 * mm, fontName="Helvetica",
        ),
        "section_header": ParagraphStyle(
            "RxSectionHeader", parent=base["Heading2"],
            fontSize=11, textColor=COLOR_PRIMARY,
            spaceBefore=4 * mm, spaceAfter=2 * mm,
            fontName="Helvetica-Bold",
        ),
        "normal": ParagraphStyle(
            "RxNormal", parent=base["Normal"],
            fontSize=9, textColor=COLOR_TEXT,
            fontName="Helvetica", leading=12,
        ),
        "normal_bold": ParagraphStyle(
            "RxNormalBold", parent=base["Normal"],
            fontSize=9, textColor=COLOR_TEXT,
            fontName="Helvetica-Bold", leading=12,
        ),
        "small": ParagraphStyle(
            "RxSmall", parent=base["Normal"],
            fontSize=7, textColor=COLOR_MUTED,
            fontName="Helvetica", leading=9,
        ),
        "rx_symbol": ParagraphStyle(
            "RxSymbol", parent=base["Normal"],
            fontSize=24, textColor=COLOR_PRIMARY,
            fontName="Helvetica-Bold", alignment=TA_LEFT,
        ),
        "table_header": ParagraphStyle(
            "RxTableHeader", parent=base["Normal"],
            fontSize=8, textColor=colors.white,
            fontName="Helvetica-Bold", alignment=TA_CENTER,
        ),
        "table_cell": ParagraphStyle(
            "RxTableCell", parent=base["Normal"],
            fontSize=8, textColor=COLOR_TEXT,
            fontName="Helvetica", leading=10,
        ),
        "table_cell_right": ParagraphStyle(
            "RxTableCellRight", parent=base["Normal"],
            fontSize=8, textColor=COLOR_TEXT,
            fontName="Helvetica", leading=10,
            alignment=TA_RIGHT,
        ),
        "footer": ParagraphStyle(
            "RxFooter", parent=base["Normal"],
            fontSize=7, textColor=COLOR_MUTED,
            fontName="Helvetica", alignment=TA_CENTER, leading=9,
        ),
        "warning": ParagraphStyle(
            "RxWarning", parent=base["Normal"],
            fontSize=9, textColor=COLOR_DANGER,
            fontName="Helvetica-Bold", leading=12,
        ),
    }


class PrescriptionPDFGenerator:
    """
    Generador de prescripciones medicas en PDF.

    Produce recetas profesionales con encabezado institucional,
    datos del paciente, tabla de medicamentos, instrucciones
    y advertencias para sustancias controladas.
    """

    def __init__(self, config: dict) -> None:
        self.hospital_name: str = config.get("hospital_name", "")
        self.rnc: str = config.get("rnc", "")
        self.address: str = config.get("address", "")
        self.phone: str = config.get("phone", "")
        self.logo_path: str | None = config.get("logo_path")
        self._styles = _get_styles()

    async def generate_prescription_pdf(self, data: dict) -> bytes:
        """
        Genera un PDF de prescripcion medica.

        Args:
            data: Diccionario con:
                - prescription_number: Numero de prescripcion
                - date: Fecha de la prescripcion
                - patient_name: Nombre del paciente
                - patient_dob: Fecha de nacimiento
                - patient_document: Cedula/pasaporte
                - patient_gender: Genero (M/F)
                - prescriber_name: Nombre del medico
                - prescriber_specialty: Especialidad
                - prescriber_license: Numero de exequatur
                - medications: lista de dicts con:
                    - name: Nombre del medicamento
                    - dose: Dosis (ej: 500mg)
                    - frequency: Frecuencia (ej: cada 8 horas)
                    - duration: Duracion (ej: 7 dias)
                    - quantity: Cantidad a despachar
                    - instructions: Instrucciones especiales
                    - is_controlled: bool
                - diagnosis: Diagnostico asociado (opcional)
                - notes: Notas adicionales (opcional)

        Returns:
            Bytes del PDF generado.
        """
        return self._render_pdf(data)

    def _render_pdf(self, data: dict) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=letter,
            leftMargin=1.5 * cm, rightMargin=1.5 * cm,
            topMargin=1.5 * cm, bottomMargin=2.5 * cm,
        )

        elements: list[Any] = []

        # Header
        elements.extend(self._build_header(data))

        # Separator
        elements.append(Spacer(1, 3 * mm))
        elements.append(HRFlowable(
            width="100%", thickness=0.5,
            color=COLOR_BORDER, spaceAfter=4 * mm,
        ))

        # Rx symbol + patient info
        elements.extend(self._build_patient_section(data))

        # Controlled substance warning
        medications = data.get("medications") or []
        has_controlled = any(m.get("is_controlled") for m in medications)
        if has_controlled:
            elements.extend(self._build_controlled_warning())

        # Medications table
        elements.append(Spacer(1, 4 * mm))
        elements.append(self._build_medications_table(data))

        # Diagnosis
        diagnosis = data.get("diagnosis")
        if diagnosis:
            elements.append(Spacer(1, 4 * mm))
            elements.extend(self._build_diagnosis_section(diagnosis))

        # Notes
        notes = data.get("notes")
        if notes:
            elements.append(Spacer(1, 3 * mm))
            elements.extend(self._build_notes_section(notes))

        # Signature area
        elements.append(Spacer(1, 10 * mm))
        elements.extend(self._build_signature_section(data))

        # Legal notes
        elements.append(Spacer(1, 4 * mm))
        elements.extend(self._build_legal_notes(has_controlled))

        doc.build(
            elements,
            onFirstPage=lambda c, d: self._draw_page_footer(c, d, data),
            onLaterPages=lambda c, d: self._draw_page_footer(c, d, data),
        )

        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def _build_header(self, data: dict) -> list[Any]:
        elements: list[Any] = []
        s = self._styles

        hospital_name = data.get("hospital_name") or self.hospital_name
        hospital_rnc = data.get("hospital_rnc") or self.rnc
        hospital_address = data.get("hospital_address") or self.address
        hospital_phone = data.get("hospital_phone") or self.phone

        left_parts: list[Any] = []
        left_parts.append(Paragraph(hospital_name, s["title"]))
        left_parts.append(Paragraph(f"RNC: {hospital_rnc}", s["normal_bold"]))
        left_parts.append(Paragraph(hospital_address, s["normal"]))
        left_parts.append(Paragraph(f"Tel: {hospital_phone}", s["normal"]))

        prescription_number = data.get("prescription_number", "")
        date_str = _fmt_date(data.get("date"))

        right_parts: list[Any] = []
        right_parts.append(Paragraph(
            "PRESCRIPCI\u00d3N M\u00c9DICA",
            ParagraphStyle(
                "RxDocType", parent=s["normal_bold"],
                fontSize=12, textColor=COLOR_PRIMARY,
                alignment=TA_RIGHT,
            ),
        ))
        right_parts.append(Spacer(1, 2 * mm))
        right_parts.append(Paragraph(
            f"No.: {prescription_number}",
            ParagraphStyle("RxNum", parent=s["normal"], alignment=TA_RIGHT, fontSize=9, fontName="Helvetica-Bold"),
        ))
        right_parts.append(Paragraph(
            f"Fecha: {date_str}",
            ParagraphStyle("RxDate", parent=s["normal"], alignment=TA_RIGHT, fontSize=9),
        ))

        header_table = Table(
            [[left_parts, right_parts]],
            colWidths=[10 * cm, 8.5 * cm],
        )
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        elements.append(header_table)
        return elements

    def _build_patient_section(self, data: dict) -> list[Any]:
        elements: list[Any] = []
        s = self._styles

        # Rx symbol
        elements.append(Paragraph("\u211e", s["rx_symbol"]))
        elements.append(Spacer(1, 2 * mm))
        elements.append(Paragraph("DATOS DEL PACIENTE", s["section_header"]))

        patient_name = data.get("patient_name", "")
        patient_dob = _fmt_date(data.get("patient_dob"))
        patient_document = data.get("patient_document", "")
        patient_gender = data.get("patient_gender", "")
        gender_display = {"M": "Masculino", "F": "Femenino", "O": "Otro"}.get(patient_gender, patient_gender)

        info_data = [
            [
                Paragraph("Paciente:", s["normal_bold"]),
                Paragraph(patient_name, s["normal"]),
                Paragraph("C\u00e9dula:", s["normal_bold"]),
                Paragraph(patient_document, s["normal"]),
            ],
            [
                Paragraph("Fecha Nac.:", s["normal_bold"]),
                Paragraph(patient_dob, s["normal"]),
                Paragraph("G\u00e9nero:", s["normal_bold"]),
                Paragraph(gender_display, s["normal"]),
            ],
        ]

        info_table = Table(
            info_data, colWidths=[3 * cm, 7 * cm, 2.5 * cm, 6 * cm],
        )
        info_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_LIGHT_BG),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_BORDER),
        ]))
        elements.append(info_table)
        return elements

    def _build_controlled_warning(self) -> list[Any]:
        elements: list[Any] = []
        s = self._styles

        elements.append(Spacer(1, 3 * mm))
        warning_data = [[
            Paragraph(
                "\u26a0 PRESCRIPCI\u00d3N CONTIENE SUSTANCIA(S) CONTROLADA(S) \u2014 "
                "Requiere identificaci\u00f3n del paciente para su despacho.",
                s["warning"],
            )
        ]]
        warning_table = Table(warning_data, colWidths=[18.5 * cm])
        warning_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fdedec")),
            ("BOX", (0, 0), (-1, -1), 1, COLOR_DANGER),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(warning_table)
        return elements

    def _build_medications_table(self, data: dict) -> Table:
        s = self._styles
        medications = data.get("medications") or []

        headers = [
            Paragraph("Medicamento", s["table_header"]),
            Paragraph("Dosis", s["table_header"]),
            Paragraph("Frecuencia", s["table_header"]),
            Paragraph("Duraci\u00f3n", s["table_header"]),
            Paragraph("Cant.", s["table_header"]),
            Paragraph("Instrucciones", s["table_header"]),
        ]

        table_data = [headers]

        for med in medications:
            name = str(med.get("name", ""))
            if med.get("is_controlled"):
                name = f"\u26a0 {name}"

            row = [
                Paragraph(name, s["table_cell"]),
                Paragraph(str(med.get("dose", "")), s["table_cell"]),
                Paragraph(str(med.get("frequency", "")), s["table_cell"]),
                Paragraph(str(med.get("duration", "")), s["table_cell"]),
                Paragraph(str(med.get("quantity", "")), s["table_cell_right"]),
                Paragraph(str(med.get("instructions", "")), s["table_cell"]),
            ]
            table_data.append(row)

        if not medications:
            empty_row = [Paragraph("", s["table_cell"])] * 6
            table_data.append(empty_row)

        col_widths = [4.5 * cm, 2 * cm, 3 * cm, 2 * cm, 1.5 * cm, 5.5 * cm]
        table = Table(table_data, colWidths=col_widths, repeatRows=1)

        style_commands: list[Any] = [
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_HEADER_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ("LINEBELOW", (0, 0), (-1, 0), 1, COLOR_PRIMARY),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]

        for i in range(1, len(table_data)):
            if i % 2 == 0:
                style_commands.append(("BACKGROUND", (0, i), (-1, i), COLOR_LIGHT_BG))

        table.setStyle(TableStyle(style_commands))
        return table

    def _build_diagnosis_section(self, diagnosis: str) -> list[Any]:
        elements: list[Any] = []
        s = self._styles
        elements.append(Paragraph("DIAGN\u00d3STICO", s["section_header"]))
        elements.append(Paragraph(diagnosis, s["normal"]))
        return elements

    def _build_notes_section(self, notes: str) -> list[Any]:
        elements: list[Any] = []
        s = self._styles
        elements.append(Paragraph("OBSERVACIONES", s["section_header"]))
        elements.append(Paragraph(notes, s["normal"]))
        return elements

    def _build_signature_section(self, data: dict) -> list[Any]:
        elements: list[Any] = []
        s = self._styles

        prescriber_name = data.get("prescriber_name", "")
        prescriber_specialty = data.get("prescriber_specialty", "")
        prescriber_license = data.get("prescriber_license", "")

        # Signature line
        sig_data = [
            [Paragraph("", s["normal"])],
            [Paragraph("_" * 50, ParagraphStyle(
                "SigLine", parent=s["normal"], alignment=TA_CENTER,
            ))],
            [Paragraph(f"Dr(a). {prescriber_name}", ParagraphStyle(
                "SigName", parent=s["normal_bold"], alignment=TA_CENTER, fontSize=10,
            ))],
            [Paragraph(prescriber_specialty, ParagraphStyle(
                "SigSpec", parent=s["normal"], alignment=TA_CENTER,
            ))],
            [Paragraph(f"Exequatur: {prescriber_license}", ParagraphStyle(
                "SigLic", parent=s["normal"], alignment=TA_CENTER,
            ))],
        ]

        sig_table = Table(sig_data, colWidths=[10 * cm])
        sig_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]))
        sig_table.hAlign = "CENTER"
        elements.append(sig_table)
        return elements

    def _build_legal_notes(self, has_controlled: bool) -> list[Any]:
        elements: list[Any] = []
        s = self._styles

        elements.append(HRFlowable(
            width="100%", thickness=0.5,
            color=COLOR_BORDER, spaceAfter=2 * mm,
        ))

        notes = [
            "Esta prescripci\u00f3n es v\u00e1lida \u00fanicamente para el paciente indicado.",
            "Prescripci\u00f3n v\u00e1lida por 30 d\u00edas a partir de la fecha de emisi\u00f3n.",
        ]

        if has_controlled:
            notes.append(
                "<b>Sustancias controladas:</b> La dispensaci\u00f3n requiere presentaci\u00f3n "
                "de c\u00e9dula de identidad. No se permiten despachos parciales sin autorizaci\u00f3n m\u00e9dica."
            )
            notes.append(
                "Ley 50-88 sobre Drogas y Sustancias Controladas de la Rep\u00fablica Dominicana."
            )

        notes.append(
            "Documento generado electr\u00f3nicamente por el sistema HMIS. "
            "Conservar para fines de auditor\u00eda m\u00e9dica."
        )

        for note in notes:
            elements.append(Paragraph(note, s["small"]))
            elements.append(Spacer(1, 1 * mm))

        return elements

    def _draw_page_footer(self, canvas: Any, doc: Any, data: dict) -> None:
        canvas.saveState()
        page_width = letter[0]
        footer_y = 1.5 * cm

        canvas.setStrokeColor(COLOR_BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(1.5 * cm, footer_y + 5 * mm, page_width - 1.5 * cm, footer_y + 5 * mm)

        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(COLOR_MUTED)

        hospital_name = data.get("hospital_name") or self.hospital_name
        footer_text = f"{hospital_name} \u2014 Prescripci\u00f3n M\u00e9dica Electr\u00f3nica HMIS"
        canvas.drawCentredString(page_width / 2, footer_y, footer_text)

        page_num = canvas.getPageNumber()
        canvas.drawRightString(page_width - 1.5 * cm, footer_y - 3 * mm, f"P\u00e1gina {page_num}")

        now = datetime.now().strftime("%d/%m/%Y %H:%M")
        canvas.drawString(1.5 * cm, footer_y - 3 * mm, f"Generado: {now}")

        canvas.restoreState()
