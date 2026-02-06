"""
Motor fiscal multi-pais.
Abstraccion para generar comprobantes fiscales electronicos segun el pais.
Cada pais implementa su propia clase con las reglas de su ente regulador.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class FiscalDocument:
    """Documento fiscal generado."""
    fiscal_number: str
    document_type: str
    xml_content: str | None = None
    pdf_url: str | None = None
    qr_code: str | None = None
    response_data: dict | None = None
    status: str = "generated"  # generated, sent, accepted, rejected


class FiscalEngine(ABC):
    """Clase base abstracta para motores fiscales por pais."""

    @abstractmethod
    async def generate_invoice(self, invoice_data: dict) -> FiscalDocument:
        """Genera comprobante fiscal electronico."""
        pass

    @abstractmethod
    async def cancel_invoice(self, fiscal_number: str, reason: str) -> FiscalDocument:
        """Anula un comprobante fiscal."""
        pass

    @abstractmethod
    async def generate_credit_note(self, original_fiscal_number: str, data: dict) -> FiscalDocument:
        """Genera nota de credito."""
        pass

    @abstractmethod
    async def validate_tax_id(self, tax_id: str) -> dict:
        """Valida un RNC/RFC/NIT/RUT."""
        pass


class DominicanRepublicFiscal(FiscalEngine):
    """
    Motor fiscal para Republica Dominicana.
    Integra con DGII para NCF/e-CF.
    Reportes: 607 (ventas), 608 (compras), 609 (anulaciones), IT-1.
    """

    NCF_TYPES = {
        "consumidor_final": "02",
        "credito_fiscal": "01",
        "regimenes_especiales": "14",
        "gubernamental": "15",
        "nota_debito": "03",
        "nota_credito": "04",
    }

    async def generate_invoice(self, invoice_data: dict) -> FiscalDocument:
        """Genera NCF o e-CF segun configuracion."""
        ncf_type = invoice_data.get("fiscal_type", "consumidor_final")
        type_code = self.NCF_TYPES.get(ncf_type, "02")

        # TODO: Integrar con API de DGII para e-CF
        # Por ahora genera NCF local con secuencia
        sequence = invoice_data.get("sequence", 1)
        fiscal_number = f"B{type_code}{sequence:08d}"

        return FiscalDocument(
            fiscal_number=fiscal_number,
            document_type=f"NCF-{type_code}",
            status="generated",
            response_data={"ncf_type": ncf_type, "type_code": type_code},
        )

    async def cancel_invoice(self, fiscal_number: str, reason: str) -> FiscalDocument:
        # TODO: Registrar anulacion en secuencia 609
        return FiscalDocument(
            fiscal_number=fiscal_number,
            document_type="anulacion",
            status="cancelled",
            response_data={"reason": reason},
        )

    async def generate_credit_note(self, original_fiscal_number: str, data: dict) -> FiscalDocument:
        sequence = data.get("sequence", 1)
        fiscal_number = f"B04{sequence:08d}"
        return FiscalDocument(
            fiscal_number=fiscal_number,
            document_type="NCF-04",
            status="generated",
            response_data={"original_ncf": original_fiscal_number},
        )

    async def validate_tax_id(self, tax_id: str) -> dict:
        """Valida RNC o Cedula contra DGII."""
        # TODO: Consulta API DGII
        clean_id = tax_id.replace("-", "").strip()
        is_valid = len(clean_id) in (9, 11)  # RNC=9, Cedula=11
        return {"tax_id": tax_id, "valid": is_valid, "type": "RNC" if len(clean_id) == 9 else "Cedula"}


class ColombiaFiscal(FiscalEngine):
    """Motor fiscal para Colombia. Factura electronica DIAN UBL 2.1."""

    async def generate_invoice(self, invoice_data: dict) -> FiscalDocument:
        # TODO: Integrar con DIAN API
        return FiscalDocument(
            fiscal_number=f"FE-{invoice_data.get('sequence', 1):010d}",
            document_type="factura_electronica",
            status="generated",
        )

    async def cancel_invoice(self, fiscal_number: str, reason: str) -> FiscalDocument:
        return FiscalDocument(fiscal_number=fiscal_number, document_type="anulacion", status="cancelled")

    async def generate_credit_note(self, original_fiscal_number: str, data: dict) -> FiscalDocument:
        return FiscalDocument(
            fiscal_number=f"NC-{data.get('sequence', 1):010d}",
            document_type="nota_credito",
            status="generated",
        )

    async def validate_tax_id(self, tax_id: str) -> dict:
        clean_id = tax_id.replace("-", "").strip()
        return {"tax_id": tax_id, "valid": len(clean_id) >= 9, "type": "NIT"}


class MexicoFiscal(FiscalEngine):
    """Motor fiscal para Mexico. CFDI 4.0 con SAT."""

    async def generate_invoice(self, invoice_data: dict) -> FiscalDocument:
        # TODO: Integrar con PAC certificado para timbrado CFDI
        return FiscalDocument(
            fiscal_number=f"CFDI-{invoice_data.get('sequence', 1):010d}",
            document_type="CFDI_4.0",
            status="generated",
        )

    async def cancel_invoice(self, fiscal_number: str, reason: str) -> FiscalDocument:
        return FiscalDocument(fiscal_number=fiscal_number, document_type="cancelacion", status="cancelled")

    async def generate_credit_note(self, original_fiscal_number: str, data: dict) -> FiscalDocument:
        return FiscalDocument(
            fiscal_number=f"NC-{data.get('sequence', 1):010d}",
            document_type="nota_credito_cfdi",
            status="generated",
        )

    async def validate_tax_id(self, tax_id: str) -> dict:
        clean_id = tax_id.strip().upper()
        is_valid = len(clean_id) in (12, 13)
        return {"tax_id": tax_id, "valid": is_valid, "type": "RFC"}


def get_fiscal_engine(country_code: str) -> FiscalEngine:
    """Fabrica de motor fiscal segun codigo de pais."""
    engines = {
        "DO": DominicanRepublicFiscal,
        "CO": ColombiaFiscal,
        "MX": MexicoFiscal,
    }
    engine_class = engines.get(country_code)
    if not engine_class:
        raise ValueError(f"Motor fiscal no disponible para pais: {country_code}")
    return engine_class()
