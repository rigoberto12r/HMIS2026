"""
Modulo de integracion fiscal multi-pais para HMIS SaaS.

Provee motores fiscales para generacion de comprobantes electronicos
y reportes regulatorios segun la normativa de cada pais.

Paises soportados:
  - DO (Republica Dominicana): NCF, e-CF, reportes DGII 607/608/609
  - CO (Colombia): Factura electronica DIAN UBL 2.1 (stub)
  - MX (Mexico): CFDI 4.0 con SAT (stub)

Uso basico:
    from app.integrations.fiscal import get_fiscal_engine, FiscalDocument

    engine = get_fiscal_engine("DO", rnc_emisor="101234567")
    doc = await engine.generate_invoice({
        "fiscal_type": "credito_fiscal",
        "generar_ecf": True,
        "items": [...],
    })

Reportes DGII:
    from app.integrations.fiscal import generar_reporte_607

    reporte = generar_reporte_607("101234567", "202601", ventas)
"""

# --- Motor fiscal: clases base y fabrica ---
from app.integrations.fiscal.engine import (
    AnulacionRecord,
    ColombiaFiscal,
    DominicanRepublicFiscal,
    FiscalDocument,
    FiscalEngine,
    MexicoFiscal,
    NCFSequenceConfig,
    TaxIdValidationResult,
    get_available_countries,
    get_fiscal_engine,
)

# --- Reportes DGII (Republica Dominicana) ---
from app.integrations.fiscal.dgii_reports import (
    DGIIReportHeader,
    Registro607,
    Registro608,
    Registro609,
    Reporte607,
    Reporte608,
    Reporte609,
    generar_reporte_607,
    generar_reporte_608,
    generar_reporte_609,
)

__all__ = [
    # Motor fiscal
    "FiscalDocument",
    "FiscalEngine",
    "DominicanRepublicFiscal",
    "ColombiaFiscal",
    "MexicoFiscal",
    "NCFSequenceConfig",
    "TaxIdValidationResult",
    "AnulacionRecord",
    "get_fiscal_engine",
    "get_available_countries",
    # Reportes DGII
    "DGIIReportHeader",
    "Registro607",
    "Registro608",
    "Registro609",
    "Reporte607",
    "Reporte608",
    "Reporte609",
    "generar_reporte_607",
    "generar_reporte_608",
    "generar_reporte_609",
]
