"""
C-CDA R2.1 Export Module.

Generates Consolidated Clinical Document Architecture (C-CDA) Release 2.1
compliant XML documents for clinical document exchange.

Supported Documents:
- CCD (Continuity of Care Document) - Primary use case

Main Components:
- templates.py: OIDs, LOINC codes, and constants
- header.py: CCD header generator (patient demographics, metadata)
- sections.py: Clinical section generators (allergies, medications, etc.)
- generator.py: Main CCD document assembler
- service.py: Business logic for patient record export
- routes.py: REST API endpoints for CCD download
"""

__version__ = "1.0.0"
__author__ = "HMIS 2026 Development Team"

from app.modules.ccda.service import CCDAService

__all__ = ["CCDAService"]
