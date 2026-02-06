"""
Tests unitarios para el servicio de prescripciones (PrescriptionService).
Valida la logica de negocio: creacion de prescripciones y verificacion de alergias.
"""

import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.emr.models import Allergy
from app.modules.pharmacy.models import Prescription, Product
from app.modules.pharmacy.schemas import PrescriptionCreate
from app.modules.pharmacy.service import PrescriptionService


# =============================================
# Helpers
# =============================================

def _crear_schema_prescripcion(**overrides) -> PrescriptionCreate:
    """Crea un schema PrescriptionCreate con datos de prueba."""
    datos = {
        "encounter_id": uuid.uuid4(),
        "patient_id": uuid.uuid4(),
        "product_id": uuid.uuid4(),
        "medication_name": "Amoxicilina",
        "dosage": "500mg",
        "frequency": "cada 8 horas",
        "route": "oral",
        "duration_days": 7,
        "quantity_prescribed": 21,
        "instructions": "Tomar con alimentos. Completar el tratamiento.",
        "substitution_allowed": True,
    }
    datos.update(overrides)
    return PrescriptionCreate(**datos)


def _crear_alergia_mock(
    allergen: str = "Penicilina",
    severity: str = "severe",
    reaction: str = "Anafilaxia",
    allergen_type: str = "drug",
) -> Allergy:
    """Crea un objeto Allergy simulado."""
    allergy = MagicMock(spec=Allergy)
    allergy.id = uuid.uuid4()
    allergy.allergen = allergen
    allergy.allergen_type = allergen_type
    allergy.severity = severity
    allergy.reaction = reaction
    allergy.status = "active"
    allergy.is_active = True
    return allergy


# =============================================
# Tests de creacion de prescripciones
# =============================================

class TestPrescriptionServiceCreacion:
    """Grupo de tests para la creacion de prescripciones electronicas."""

    @pytest.mark.asyncio
    async def test_crear_prescripcion_exitosa(self):
        """Verifica que se puede crear una prescripcion sin alertas."""
        data = _crear_schema_prescripcion()
        medico_id = uuid.uuid4()

        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()

        service = PrescriptionService(db)

        # Mock del AllergyService - sin alergias
        with patch(
            "app.modules.pharmacy.service.AllergyService"
        ) as MockAllergyService:
            mock_allergy_service = MockAllergyService.return_value
            mock_allergy_service.check_drug_allergy = AsyncMock(return_value=[])

            with patch(
                "app.modules.pharmacy.service.publish", new_callable=AsyncMock
            ):
                prescription = await service.create_prescription(data, prescribed_by=medico_id)

        assert prescription is not None, "Debe crear la prescripcion exitosamente"
        assert prescription.medication_name == "Amoxicilina", (
            "El nombre del medicamento debe ser correcto"
        )
        assert prescription.dosage == "500mg", "La dosis debe ser correcta"
        assert prescription.frequency == "cada 8 horas", (
            "La frecuencia debe ser correcta"
        )
        assert prescription.route == "oral", "La via debe ser correcta"
        assert prescription.quantity_prescribed == 21, (
            "La cantidad prescrita debe ser correcta"
        )
        db.add.assert_called_once(), "Debe agregar la prescripcion a la sesion"

    @pytest.mark.asyncio
    async def test_crear_prescripcion_sin_alertas_tiene_alerts_json_none(self):
        """Verifica que sin alergias detectadas, alerts_json es None."""
        data = _crear_schema_prescripcion(medication_name="Paracetamol")
        medico_id = uuid.uuid4()

        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()

        service = PrescriptionService(db)

        with patch(
            "app.modules.pharmacy.service.AllergyService"
        ) as MockAllergyService:
            mock_allergy_service = MockAllergyService.return_value
            mock_allergy_service.check_drug_allergy = AsyncMock(return_value=[])

            with patch(
                "app.modules.pharmacy.service.publish", new_callable=AsyncMock
            ):
                prescription = await service.create_prescription(data, prescribed_by=medico_id)

        assert prescription.alerts_json is None, (
            "Sin alergias detectadas, alerts_json debe ser None"
        )


# =============================================
# Tests de verificacion de alergias
# =============================================

class TestPrescriptionServiceAlergias:
    """Grupo de tests para la verificacion de alergias en prescripciones."""

    @pytest.mark.asyncio
    async def test_prescripcion_genera_alerta_por_alergia(self):
        """
        Verifica que al prescribir un medicamento al que el paciente es
        alergico, se genera una alerta en alerts_json.
        """
        patient_id = uuid.uuid4()
        data = _crear_schema_prescripcion(
            patient_id=patient_id,
            medication_name="Amoxicilina",
        )
        medico_id = uuid.uuid4()

        # Simular alergia a Penicilina (familia de Amoxicilina)
        alergia = _crear_alergia_mock(
            allergen="Amoxicilina",
            severity="severe",
            reaction="Rash cutaneo severo",
        )

        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()

        service = PrescriptionService(db)

        with patch(
            "app.modules.pharmacy.service.AllergyService"
        ) as MockAllergyService:
            mock_allergy_service = MockAllergyService.return_value
            mock_allergy_service.check_drug_allergy = AsyncMock(
                return_value=[alergia]
            )

            with patch(
                "app.modules.pharmacy.service.publish", new_callable=AsyncMock
            ):
                prescription = await service.create_prescription(
                    data, prescribed_by=medico_id
                )

        assert prescription.alerts_json is not None, (
            "Debe generar alertas cuando hay alergia"
        )
        assert "allergy_warning" in prescription.alerts_json, (
            "Debe contener la clave 'allergy_warning'"
        )
        alertas_alergia = prescription.alerts_json["allergy_warning"]
        assert len(alertas_alergia) == 1, "Debe haber exactamente 1 alerta de alergia"
        assert alertas_alergia[0]["allergen"] == "Amoxicilina", (
            "La alerta debe indicar el alergeno"
        )
        assert alertas_alergia[0]["severity"] == "severe", (
            "La alerta debe indicar la severidad"
        )

    @pytest.mark.asyncio
    async def test_prescripcion_multiples_alergias(self):
        """Verifica que se registran multiples alertas de alergia."""
        patient_id = uuid.uuid4()
        data = _crear_schema_prescripcion(
            patient_id=patient_id,
            medication_name="Penicilina",
        )

        alergia_1 = _crear_alergia_mock(
            allergen="Penicilina",
            severity="severe",
            reaction="Anafilaxia",
        )
        alergia_2 = _crear_alergia_mock(
            allergen="Penicilina V",
            severity="moderate",
            reaction="Urticaria",
        )

        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()

        service = PrescriptionService(db)

        with patch(
            "app.modules.pharmacy.service.AllergyService"
        ) as MockAllergyService:
            mock_allergy_service = MockAllergyService.return_value
            mock_allergy_service.check_drug_allergy = AsyncMock(
                return_value=[alergia_1, alergia_2]
            )

            with patch(
                "app.modules.pharmacy.service.publish", new_callable=AsyncMock
            ):
                prescription = await service.create_prescription(
                    data, prescribed_by=uuid.uuid4()
                )

        alertas = prescription.alerts_json["allergy_warning"]
        assert len(alertas) == 2, (
            "Debe registrar todas las alergias encontradas (2)"
        )

    @pytest.mark.asyncio
    async def test_prescripcion_publica_evento(self):
        """Verifica que al crear prescripcion se publica evento de dominio."""
        data = _crear_schema_prescripcion()
        medico_id = uuid.uuid4()

        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()

        service = PrescriptionService(db)

        with patch(
            "app.modules.pharmacy.service.AllergyService"
        ) as MockAllergyService:
            mock_allergy_service = MockAllergyService.return_value
            mock_allergy_service.check_drug_allergy = AsyncMock(return_value=[])

            with patch(
                "app.modules.pharmacy.service.publish", new_callable=AsyncMock
            ) as mock_publish:
                prescription = await service.create_prescription(
                    data, prescribed_by=medico_id
                )

        mock_publish.assert_called_once(), (
            "Debe publicar un evento al crear la prescripcion"
        )
        evento = mock_publish.call_args[0][0]
        assert evento.event_type == "prescription.created", (
            "El tipo de evento debe ser 'prescription.created'"
        )
        assert evento.data["medication"] == "Amoxicilina", (
            "El evento debe contener el nombre del medicamento"
        )

    @pytest.mark.asyncio
    async def test_prescripcion_con_alergia_publica_evento_con_alertas(self):
        """Verifica que el evento indica que hay alertas cuando hay alergia."""
        data = _crear_schema_prescripcion(medication_name="Ibuprofeno")

        alergia = _crear_alergia_mock(
            allergen="Ibuprofeno",
            severity="moderate",
            reaction="Broncoespasmo",
        )

        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()

        service = PrescriptionService(db)

        with patch(
            "app.modules.pharmacy.service.AllergyService"
        ) as MockAllergyService:
            mock_allergy_service = MockAllergyService.return_value
            mock_allergy_service.check_drug_allergy = AsyncMock(
                return_value=[alergia]
            )

            with patch(
                "app.modules.pharmacy.service.publish", new_callable=AsyncMock
            ) as mock_publish:
                prescription = await service.create_prescription(
                    data, prescribed_by=uuid.uuid4()
                )

        evento = mock_publish.call_args[0][0]
        assert evento.data["has_alerts"] is True, (
            "El evento debe indicar que hay alertas activas"
        )

    @pytest.mark.asyncio
    async def test_prescripcion_datos_posologia_correctos(self):
        """Verifica que todos los datos de posologia se almacenan correctamente."""
        data = _crear_schema_prescripcion(
            medication_name="Metformina",
            dosage="850mg",
            frequency="cada 12 horas",
            route="oral",
            duration_days=30,
            quantity_prescribed=60,
            instructions="Tomar con la cena. No consumir alcohol.",
            substitution_allowed=False,
        )

        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()

        service = PrescriptionService(db)

        with patch(
            "app.modules.pharmacy.service.AllergyService"
        ) as MockAllergyService:
            mock_allergy_service = MockAllergyService.return_value
            mock_allergy_service.check_drug_allergy = AsyncMock(return_value=[])

            with patch(
                "app.modules.pharmacy.service.publish", new_callable=AsyncMock
            ):
                prescription = await service.create_prescription(
                    data, prescribed_by=uuid.uuid4()
                )

        assert prescription.medication_name == "Metformina"
        assert prescription.dosage == "850mg"
        assert prescription.frequency == "cada 12 horas"
        assert prescription.route == "oral"
        assert prescription.duration_days == 30
        assert prescription.quantity_prescribed == 60
        assert prescription.substitution_allowed is False, (
            "La sustitucion no debe estar permitida si se especifica asi"
        )
