"""
Generacion de documentos PDF.
Facturas, notas de credito y otros documentos fiscales en formato PDF.
"""

from app.integrations.pdf.invoice_generator import InvoicePDFGenerator

__all__ = ["InvoicePDFGenerator"]
