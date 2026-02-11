"""
C-CDA Service Layer.

Business logic for generating C-CDA documents from patient records.
Orchestrates data fetching from multiple repositories and document generation.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ccda.generator import generate_ccd_document
from app.modules.emr.models import Diagnosis, PatientProblemList, VitalSigns, Allergy, Encounter
from app.modules.emr.repository import (
    DiagnosisRepository,
    ProblemListRepository,
    VitalSignsRepository,
    AllergyRepository,
    EncounterRepository,
)
from app.modules.patients.models import Patient
from app.modules.patients.repository import PatientRepository
from app.modules.pharmacy.models import Prescription
from app.modules.pharmacy.repository import PrescriptionRepository
from app.shared.exceptions import NotFoundError


class CCDAService:
    """
    C-CDA business logic service.

    Fetches patient data from repositories and generates C-CDA documents.
    """

    def __init__(self, db: AsyncSession):
        """
        Initialize CCDA service with database session.

        Args:
            db: Async database session
        """
        self.db = db
        self.patient_repo = PatientRepository(Patient, db)
        self.encounter_repo = EncounterRepository(Encounter, db)
        self.vital_signs_repo = VitalSignsRepository(VitalSigns, db)
        self.diagnosis_repo = DiagnosisRepository(Diagnosis, db)
        self.problem_list_repo = ProblemListRepository(PatientProblemList, db)
        self.prescription_repo = PrescriptionRepository(Prescription, db)
        self.allergy_repo = AllergyRepository(Allergy, db)

    async def generate_patient_ccd(
        self,
        patient_id: UUID,
        author_user_id: UUID,
        include_all_encounters: bool = True,
        encounter_id: UUID | None = None,
    ) -> str:
        """
        Generate C-CDA R2.1 CCD for a patient.

        Fetches all patient clinical data and generates a complete
        Continuity of Care Document.

        Args:
            patient_id: Patient UUID
            author_user_id: User generating the document (provider)
            include_all_encounters: Include all encounters or just one
            encounter_id: Specific encounter to include (if not all)

        Returns:
            C-CDA R2.1 CCD XML string

        Raises:
            NotFoundError: If patient not found
        """
        # Step 1: Fetch patient with insurance
        patient = await self.patient_repo.get_with_insurance(patient_id)
        if not patient:
            raise NotFoundError("Patient", str(patient_id))

        # Step 2: Fetch encounters
        if include_all_encounters:
            encounters, _ = await self.encounter_repo.find_by_patient(patient_id)
        elif encounter_id:
            encounter = await self.encounter_repo.get(encounter_id)
            encounters = [encounter] if encounter else []
        else:
            encounters = []

        # Step 3: Fetch vital signs
        vital_signs = await self.vital_signs_repo.find_recent_by_patient(patient_id, limit=50)

        # Step 4: Fetch diagnoses (encounter-based)
        diagnoses = await self.diagnosis_repo.find_by_patient(patient_id)

        # Step 5: Fetch problem list (chronic conditions)
        problems = await self.problem_list_repo.find_active_by_patient(patient_id)

        # Step 6: Fetch prescriptions
        prescriptions = await self.prescription_repo.find_by_patient(patient_id)

        # Step 7: Fetch allergies
        allergies = await self.allergy_repo.find_active_by_patient(patient_id)

        # Step 8: Prepare author info (provider)
        author_info = await self._get_author_info(author_user_id)

        # Step 9: Prepare custodian info (organization)
        custodian_info = await self._get_custodian_info(patient.tenant_id if hasattr(patient, "tenant_id") else "default")

        # Step 10: Prepare encounter info (if specific encounter)
        encounter_info = None
        if not include_all_encounters and encounter_id and encounters:
            encounter_info = {
                "id": str(encounters[0].id),
                "start_time": encounters[0].start_datetime,
                "end_time": encounters[0].end_datetime,
                "type": encounters[0].encounter_type,
            }

        # Step 11: Generate CCD document
        ccd_xml = generate_ccd_document(
            patient=patient,
            vital_signs=vital_signs,
            diagnoses=diagnoses,
            problems=problems,
            prescriptions=prescriptions,
            allergies=allergies,
            author_info=author_info,
            custodian_info=custodian_info,
            encounter_info=encounter_info,
            effective_time=datetime.utcnow(),
        )

        return ccd_xml

    async def _get_author_info(self, user_id: UUID) -> dict:
        """
        Get author (provider) information for CCD header.

        Args:
            user_id: Provider/user UUID

        Returns:
            Dictionary with author details
        """
        # Placeholder - will fetch from User table in Task #37
        # For now, return mock data
        return {
            "id": str(user_id),
            "id_root": "2.16.840.1.113883.3.HMIS.PROVIDER",  # HMIS provider ID OID
            "given_name": "Provider",
            "family_name": "HMIS",
            "specialty": "General Practice",
            "organization_name": "HMIS Clinic",
            "organization_addr": {
                "streetAddressLine": "123 Health St",
                "city": "Santo Domingo",
                "state": "Distrito Nacional",
                "postalCode": "10101",
                "country": "DO",
            },
            "organization_telecom": {
                "value": "tel:+1-809-555-0100",
                "use": "WP",  # Work place
            },
        }

    async def _get_custodian_info(self, tenant_id: str) -> dict:
        """
        Get custodian (organization) information for CCD header.

        Args:
            tenant_id: Tenant ID

        Returns:
            Dictionary with custodian organization details
        """
        # Placeholder - will fetch from Organization/Tenant table in Task #37
        # For now, return mock data
        return {
            "id": tenant_id,
            "id_root": "2.16.840.1.113883.3.HMIS.ORG",  # HMIS organization OID
            "name": "HMIS Healthcare Organization",
            "addr": {
                "streetAddressLine": "456 Hospital Ave",
                "city": "Santo Domingo",
                "state": "Distrito Nacional",
                "postalCode": "10102",
                "country": "DO",
            },
            "telecom": {
                "value": "tel:+1-809-555-0200",
                "use": "WP",
            },
        }
