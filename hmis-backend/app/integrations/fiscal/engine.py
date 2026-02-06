"""
Motor fiscal multi-pais para HMIS SaaS.

Abstraccion para generar comprobantes fiscales electronicos segun el pais.
Cada pais implementa su propia clase con las reglas de su ente regulador.

Paises soportados:
  - Republica Dominicana (DGII): NCF, e-CF, reportes 607/608/609
  - Colombia (DIAN): Factura electronica UBL 2.1 (stub)
  - Mexico (SAT): CFDI 4.0 (stub)

Autor: Equipo HMIS SaaS
"""

from __future__ import annotations

import hashlib
import logging
import xml.etree.ElementTree as ET
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from xml.dom import minidom

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Dataclass central: documento fiscal generado por cualquier motor
# ---------------------------------------------------------------------------

@dataclass
class FiscalDocument:
    """Documento fiscal generado por el motor."""

    fiscal_number: str
    document_type: str
    xml_content: str | None = None
    pdf_url: str | None = None
    qr_code: str | None = None
    response_data: dict | None = None
    status: str = "generated"  # generated, sent, accepted, rejected, cancelled


# ---------------------------------------------------------------------------
# Dataclass para configuracion de secuencias NCF por tipo
# ---------------------------------------------------------------------------

@dataclass
class NCFSequenceConfig:
    """
    Configuracion de secuencias NCF por tipo de comprobante.
    Cada tipo de comprobante mantiene su propia secuencia independiente.
    """

    tipo: str                   # Codigo de tipo (ej: "01", "02")
    nombre: str                 # Nombre legible (ej: "Credito Fiscal")
    secuencia_actual: int = 0   # Ultima secuencia emitida
    secuencia_maxima: int = 0   # Secuencia maxima autorizada por DGII
    fecha_vencimiento: str = "" # Fecha limite de uso (YYYY-MM-DD)
    serie: str = "B"            # Prefijo de serie (B para NCF, E para e-CF)


# ---------------------------------------------------------------------------
# Dataclass para resultado de validacion de RNC/Cedula
# ---------------------------------------------------------------------------

@dataclass
class TaxIdValidationResult:
    """Resultado detallado de la validacion de un identificador fiscal."""

    tax_id: str
    tax_id_limpio: str
    tipo: str                    # "RNC" | "Cedula" | "Desconocido"
    valido: bool
    digito_verificador: int | None = None
    digito_esperado: int | None = None
    mensaje: str = ""
    datos_contribuyente: dict | None = None  # Datos de DGII si se consulta API


# ---------------------------------------------------------------------------
# Dataclass para registro de anulacion (formato 609)
# ---------------------------------------------------------------------------

@dataclass
class AnulacionRecord:
    """Registro de anulacion para reporte 609 de DGII."""

    ncf_anulado: str
    tipo_comprobante: str
    fecha_anulacion: str  # YYYY-MM-DD
    motivo: str
    secuencia_anulacion: int = 0


# ---------------------------------------------------------------------------
# Clase base abstracta: FiscalEngine
# ---------------------------------------------------------------------------

class FiscalEngine(ABC):
    """
    Clase base abstracta para motores fiscales por pais.

    Cada pais debe implementar los metodos de generacion de comprobantes,
    anulacion, notas de credito y validacion de identificacion fiscal.
    """

    @abstractmethod
    async def generate_invoice(self, invoice_data: dict) -> FiscalDocument:
        """Genera comprobante fiscal electronico."""
        pass

    @abstractmethod
    async def cancel_invoice(self, fiscal_number: str, reason: str) -> FiscalDocument:
        """Anula un comprobante fiscal."""
        pass

    @abstractmethod
    async def generate_credit_note(
        self, original_fiscal_number: str, data: dict
    ) -> FiscalDocument:
        """Genera nota de credito."""
        pass

    @abstractmethod
    async def validate_tax_id(self, tax_id: str) -> dict:
        """Valida un RNC/RFC/NIT/RUT."""
        pass


# ===========================================================================
# REPUBLICA DOMINICANA - Motor Fiscal DGII
# ===========================================================================

class DominicanRepublicFiscal(FiscalEngine):
    """
    Motor fiscal para Republica Dominicana.

    Integra con la Direccion General de Impuestos Internos (DGII) para:
      - Generacion de NCF (Numero de Comprobante Fiscal)
      - Generacion de e-CF (Comprobante Fiscal Electronico) en XML
      - Validacion de RNC (Registro Nacional del Contribuyente) y Cedulas
      - Registro de anulaciones para reporte 609
      - Notas de credito (tipo B04)

    Formato NCF: B{tipo}{secuencia:08d}
    Tipos de comprobante segun Norma 06-2018 DGII:
      01 - Comprobante de Credito Fiscal (B2B con credito fiscal)
      02 - Comprobante de Consumidor Final (venta a persona fisica sin credito)
      03 - Nota de Debito
      04 - Nota de Credito
      14 - Comprobante para Regimenes Especiales (zonas francas, etc.)
      15 - Comprobante Gubernamental (ventas al Estado)
    """

    # Mapeo de tipos de NCF segun normativa DGII
    NCF_TYPES: dict[str, str] = {
        "credito_fiscal": "01",
        "consumidor_final": "02",
        "nota_debito": "03",
        "nota_credito": "04",
        "regimenes_especiales": "14",
        "gubernamental": "15",
    }

    # Nombres legibles de los tipos de NCF
    NCF_TYPE_NAMES: dict[str, str] = {
        "01": "Comprobante de Credito Fiscal",
        "02": "Comprobante de Consumidor Final",
        "03": "Nota de Debito",
        "04": "Nota de Credito",
        "14": "Comprobante para Regimenes Especiales",
        "15": "Comprobante Gubernamental",
    }

    # Tasa ITBIS estandar en Republica Dominicana
    ITBIS_RATE: float = 0.18

    # Factores de peso para validacion de RNC (9 digitos)
    RNC_WEIGHT_FACTORS: list[int] = [7, 9, 8, 6, 5, 4, 3, 2]

    # Factores de peso para validacion de Cedula (11 digitos, tipo Luhn)
    CEDULA_WEIGHT_FACTORS: list[int] = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2]

    def __init__(
        self,
        rnc_emisor: str = "",
        nombre_emisor: str = "",
        direccion_emisor: str = "",
        secuencias: dict[str, NCFSequenceConfig] | None = None,
    ):
        """
        Inicializa el motor fiscal dominicano.

        Args:
            rnc_emisor: RNC del emisor (empresa que factura).
            nombre_emisor: Razon social del emisor.
            direccion_emisor: Direccion fiscal del emisor.
            secuencias: Configuracion de secuencias NCF por tipo.
                        Si no se provee, se inicializan secuencias vacias.
        """
        self.rnc_emisor = rnc_emisor
        self.nombre_emisor = nombre_emisor
        self.direccion_emisor = direccion_emisor

        # Secuencias NCF por tipo de comprobante
        if secuencias is not None:
            self._secuencias = secuencias
        else:
            # Inicializar secuencias por defecto para todos los tipos
            self._secuencias: dict[str, NCFSequenceConfig] = {}
            for nombre_tipo, codigo in self.NCF_TYPES.items():
                self._secuencias[codigo] = NCFSequenceConfig(
                    tipo=codigo,
                    nombre=self.NCF_TYPE_NAMES.get(codigo, nombre_tipo),
                    secuencia_actual=0,
                    secuencia_maxima=99999999,  # Maximo posible con 8 digitos
                )

        # Registro interno de anulaciones para reporte 609
        self._anulaciones: list[AnulacionRecord] = []

    # -------------------------------------------------------------------
    # Generacion de NCF
    # -------------------------------------------------------------------

    def _generar_ncf(self, tipo_codigo: str, secuencia: int | None = None) -> str:
        """
        Genera un NCF con el formato oficial de DGII.

        Formato: B{tipo}{secuencia:08d}
        Ejemplo: B0100000001 (primer credito fiscal)

        Args:
            tipo_codigo: Codigo del tipo de comprobante (01, 02, etc.)
            secuencia: Numero de secuencia explicito. Si es None, se
                       auto-incrementa desde la configuracion interna.

        Returns:
            NCF generado en formato B{tipo}{secuencia:08d}

        Raises:
            ValueError: Si el tipo de comprobante no es valido o la
                        secuencia excede el maximo autorizado.
        """
        if tipo_codigo not in self.NCF_TYPE_NAMES:
            raise ValueError(
                f"Tipo de comprobante '{tipo_codigo}' no valido. "
                f"Tipos permitidos: {list(self.NCF_TYPE_NAMES.keys())}"
            )

        config_seq = self._secuencias.get(tipo_codigo)
        if config_seq is None:
            # Crear configuracion por defecto si no existe
            config_seq = NCFSequenceConfig(
                tipo=tipo_codigo,
                nombre=self.NCF_TYPE_NAMES[tipo_codigo],
            )
            self._secuencias[tipo_codigo] = config_seq

        if secuencia is not None:
            # Usar secuencia explicita proporcionada
            numero_secuencia = secuencia
        else:
            # Auto-incrementar la secuencia interna
            config_seq.secuencia_actual += 1
            numero_secuencia = config_seq.secuencia_actual

        # Validar que no se exceda la secuencia maxima autorizada
        if config_seq.secuencia_maxima > 0 and numero_secuencia > config_seq.secuencia_maxima:
            raise ValueError(
                f"Secuencia {numero_secuencia} excede el maximo autorizado "
                f"({config_seq.secuencia_maxima}) para tipo {tipo_codigo}. "
                f"Debe solicitar nueva autorizacion a DGII."
            )

        # Validar que la secuencia quepa en 8 digitos
        if numero_secuencia > 99999999:
            raise ValueError(
                f"Secuencia {numero_secuencia} excede el maximo de 8 digitos "
                f"permitidos en formato NCF."
            )

        serie = config_seq.serie if hasattr(config_seq, "serie") else "B"
        ncf = f"{serie}{tipo_codigo}{numero_secuencia:08d}"

        logger.info(
            "NCF generado: %s (tipo: %s, secuencia: %d)",
            ncf, self.NCF_TYPE_NAMES.get(tipo_codigo, tipo_codigo), numero_secuencia,
        )

        return ncf

    # -------------------------------------------------------------------
    # Generacion de e-CF (Comprobante Fiscal Electronico) en XML
    # -------------------------------------------------------------------

    def _generar_ecf_xml(
        self,
        ncf: str,
        invoice_data: dict,
        tipo_codigo: str,
    ) -> str:
        """
        Genera el XML del e-CF siguiendo el esquema de DGII.

        Estructura del XML:
          <ECF>
            <Encabezado>
              <Version>1.0</Version>
              <IdDoc>
                <TipoeCF>{tipo}</TipoeCF>
                <eNCF>{ncf}</eNCF>
                <FechaVencimientoSecuencia>...</FechaVencimientoSecuencia>
              </IdDoc>
              <Emisor>
                <RNCEmisor>...</RNCEmisor>
                <RazonSocialEmisor>...</RazonSocialEmisor>
                <DireccionEmisor>...</DireccionEmisor>
                <FechaEmision>...</FechaEmision>
              </Emisor>
              <Comprador>
                <RNCComprador>...</RNCComprador>
                <RazonSocialComprador>...</RazonSocialComprador>
              </Comprador>
            </Encabezado>
            <DetallesItem>
              <Item>...</Item>
            </DetallesItem>
            <Subtotales>
              <MontoGravadoTotal>...</MontoGravadoTotal>
              <MontoGravadoI1>...</MontoGravadoI1>  <!-- Gravado ITBIS 18% -->
              <TotalITBIS>...</TotalITBIS>
              <TotalITBIS1>...</TotalITBIS1>         <!-- ITBIS 18% -->
              <MontoExento>...</MontoExento>
            </Subtotales>
            <Totales>
              <MontoTotal>...</MontoTotal>
              <TotalITBIS>...</TotalITBIS>
              <MontoGravadoTotal>...</MontoGravadoTotal>
              <MontoAPagar>...</MontoAPagar>
            </Totales>
            <FirmaDigital>
              <!-- Placeholder para certificado digital -->
            </FirmaDigital>
          </ECF>

        Args:
            ncf: Numero de comprobante fiscal generado.
            invoice_data: Diccionario con datos de la factura.
            tipo_codigo: Codigo del tipo de comprobante.

        Returns:
            Cadena XML del e-CF formateado.
        """
        # Namespace del e-CF segun DGII
        nsmap = "https://dgii.gov.do/ecf"

        # Elemento raiz
        root = ET.Element("ECF")
        root.set("xmlns", nsmap)

        # --- Encabezado ---
        encabezado = ET.SubElement(root, "Encabezado")

        # Version del esquema
        version_elem = ET.SubElement(encabezado, "Version")
        version_elem.text = "1.0"

        # Identificacion del documento
        id_doc = ET.SubElement(encabezado, "IdDoc")

        tipo_ecf = ET.SubElement(id_doc, "TipoeCF")
        tipo_ecf.text = tipo_codigo

        encf = ET.SubElement(id_doc, "eNCF")
        encf.text = ncf

        # Indicador de monto gravado
        indicador_monto = ET.SubElement(id_doc, "IndicadorMontoGravado")
        indicador_monto.text = "0"  # 0 = Incluye ITBIS en el precio

        # Tipo de ingreso (01 = Ingresos por operaciones, normal)
        tipo_ingreso = ET.SubElement(id_doc, "TipoIngresos")
        tipo_ingreso.text = invoice_data.get("tipo_ingreso", "01")

        # Tipo de pago
        tipo_pago = ET.SubElement(id_doc, "TipoPago")
        tipo_pago_val = invoice_data.get("tipo_pago", "1")  # 1=Contado, 2=Credito
        tipo_pago.text = str(tipo_pago_val)

        # Si es a credito, incluir fecha de vencimiento
        if str(tipo_pago_val) == "2":
            fecha_limite = invoice_data.get("fecha_limite_pago", "")
            if fecha_limite:
                fl_elem = ET.SubElement(id_doc, "FechaLimitePago")
                fl_elem.text = fecha_limite

        # --- Emisor ---
        emisor = ET.SubElement(encabezado, "Emisor")

        rnc_emisor_elem = ET.SubElement(emisor, "RNCEmisor")
        rnc_emisor_elem.text = self.rnc_emisor or invoice_data.get("rnc_emisor", "")

        razon_social_emisor = ET.SubElement(emisor, "RazonSocialEmisor")
        razon_social_emisor.text = self.nombre_emisor or invoice_data.get(
            "nombre_emisor", ""
        )

        direccion_emisor_elem = ET.SubElement(emisor, "DireccionEmisor")
        direccion_emisor_elem.text = self.direccion_emisor or invoice_data.get(
            "direccion_emisor", ""
        )

        fecha_emision = ET.SubElement(emisor, "FechaEmision")
        fecha_emision.text = invoice_data.get(
            "fecha_emision",
            datetime.now(timezone.utc).strftime("%d-%m-%Y"),
        )

        # Municipio del emisor (opcional pero recomendado por DGII)
        municipio = invoice_data.get("municipio_emisor", "")
        if municipio:
            mun_elem = ET.SubElement(emisor, "MunicipioEmisor")
            mun_elem.text = municipio

        # Provincia del emisor (opcional)
        provincia = invoice_data.get("provincia_emisor", "")
        if provincia:
            prov_elem = ET.SubElement(emisor, "ProvinciaEmisor")
            prov_elem.text = provincia

        # --- Comprador ---
        comprador = ET.SubElement(encabezado, "Comprador")

        rnc_comprador = ET.SubElement(comprador, "RNCComprador")
        rnc_comprador.text = invoice_data.get("rnc_comprador", "")

        razon_social_comprador = ET.SubElement(comprador, "RazonSocialComprador")
        razon_social_comprador.text = invoice_data.get("nombre_comprador", "")

        # Direccion del comprador (opcional)
        dir_comprador = invoice_data.get("direccion_comprador", "")
        if dir_comprador:
            dir_elem = ET.SubElement(comprador, "DireccionComprador")
            dir_elem.text = dir_comprador

        # --- Detalles de Items ---
        detalles = ET.SubElement(root, "DetallesItem")

        items = invoice_data.get("items", [])
        monto_gravado_total = 0.0
        itbis_total = 0.0
        monto_exento_total = 0.0

        for idx, item in enumerate(items, start=1):
            item_elem = ET.SubElement(detalles, "Item")

            # Numero de linea
            num_linea = ET.SubElement(item_elem, "NumeroLinea")
            num_linea.text = str(idx)

            # Indicador de facturacion (1=Bien, 2=Servicio, 3=Bien+Servicio)
            ind_fact = ET.SubElement(item_elem, "IndicadorFacturacion")
            ind_fact.text = str(item.get("indicador_facturacion", 2))  # Default: servicio medico

            # Descripcion del bien o servicio
            desc_elem = ET.SubElement(item_elem, "NombreItem")
            desc_elem.text = item.get("descripcion", "Servicio medico")

            # Cantidad
            cantidad = float(item.get("cantidad", 1))
            cant_elem = ET.SubElement(item_elem, "CantidadItem")
            cant_elem.text = f"{cantidad:.2f}"

            # Unidad de medida
            unidad = ET.SubElement(item_elem, "UnidadMedida")
            unidad.text = item.get("unidad_medida", "Unidad")

            # Precio unitario
            precio = float(item.get("precio_unitario", 0))
            precio_elem = ET.SubElement(item_elem, "PrecioUnitarioItem")
            precio_elem.text = f"{precio:.2f}"

            # Descuento por linea
            descuento = float(item.get("descuento", 0))
            if descuento > 0:
                desc_monto = ET.SubElement(item_elem, "DescuentoMonto")
                desc_monto.text = f"{descuento:.2f}"

            # Subtotal de la linea (cantidad * precio - descuento)
            subtotal_linea = cantidad * precio - descuento

            # Indicador ITBIS: 1=Gravado 18%, 2=Gravado 16%, 3=Exento
            indicador_itbis = int(item.get("indicador_itbis", 1))

            # Calcular ITBIS segun indicador
            if indicador_itbis == 1:
                # Gravado al 18%
                tasa_itbis = 0.18
                itbis_linea = subtotal_linea * tasa_itbis
                monto_gravado_total += subtotal_linea
            elif indicador_itbis == 2:
                # Gravado al 16%
                tasa_itbis = 0.16
                itbis_linea = subtotal_linea * tasa_itbis
                monto_gravado_total += subtotal_linea
            else:
                # Exento
                tasa_itbis = 0.0
                itbis_linea = 0.0
                monto_exento_total += subtotal_linea

            itbis_total += itbis_linea

            # Monto del item
            monto_item = ET.SubElement(item_elem, "MontoItem")
            monto_item.text = f"{subtotal_linea:.2f}"

            # ITBIS del item (solo si es gravado)
            if itbis_linea > 0:
                itbis_item_elem = ET.SubElement(item_elem, "MontoITBIS")
                itbis_item_elem.text = f"{itbis_linea:.2f}"

        # --- Subtotales ---
        subtotales = ET.SubElement(root, "Subtotales")

        # Monto gravado total (base imponible)
        mg_total = ET.SubElement(subtotales, "MontoGravadoTotal")
        mg_total.text = f"{monto_gravado_total:.2f}"

        # Monto gravado a tasa 1 (18%) - tasa estandar ITBIS
        mg_i1 = ET.SubElement(subtotales, "MontoGravadoI1")
        mg_i1.text = f"{monto_gravado_total:.2f}"

        # Total ITBIS
        total_itbis_elem = ET.SubElement(subtotales, "TotalITBIS")
        total_itbis_elem.text = f"{itbis_total:.2f}"

        # ITBIS a tasa 1 (18%)
        total_itbis1 = ET.SubElement(subtotales, "TotalITBIS1")
        total_itbis1.text = f"{itbis_total:.2f}"

        # Monto exento
        me_elem = ET.SubElement(subtotales, "MontoExento")
        me_elem.text = f"{monto_exento_total:.2f}"

        # --- Totales ---
        totales = ET.SubElement(root, "Totales")

        monto_total = monto_gravado_total + monto_exento_total + itbis_total
        monto_a_pagar = monto_total  # Sin retenciones por defecto

        mt_elem = ET.SubElement(totales, "MontoTotal")
        mt_elem.text = f"{monto_total:.2f}"

        ti_elem = ET.SubElement(totales, "TotalITBIS")
        ti_elem.text = f"{itbis_total:.2f}"

        mgt_elem = ET.SubElement(totales, "MontoGravadoTotal")
        mgt_elem.text = f"{monto_gravado_total:.2f}"

        # Monto no facturable (propinas, etc.)
        monto_no_facturable = float(invoice_data.get("monto_no_facturable", 0))
        if monto_no_facturable > 0:
            mnf_elem = ET.SubElement(totales, "MontoNoFacturable")
            mnf_elem.text = f"{monto_no_facturable:.2f}"

        # Retenciones ITBIS (si aplica, normalmente B01 puede tener retencion)
        retencion_itbis = float(invoice_data.get("retencion_itbis", 0))
        if retencion_itbis > 0:
            ret_elem = ET.SubElement(totales, "TotalITBISRetenido")
            ret_elem.text = f"{retencion_itbis:.2f}"
            monto_a_pagar -= retencion_itbis

        # Retenciones ISR (si aplica)
        retencion_isr = float(invoice_data.get("retencion_isr", 0))
        if retencion_isr > 0:
            ret_isr = ET.SubElement(totales, "TotalISRRetencion")
            ret_isr.text = f"{retencion_isr:.2f}"
            monto_a_pagar -= retencion_isr

        map_elem = ET.SubElement(totales, "MontoAPagar")
        map_elem.text = f"{monto_a_pagar:.2f}"

        # --- Firma Digital (placeholder) ---
        # En produccion, aqui se inserta la firma XML-DSig usando el
        # certificado digital emitido por una entidad certificadora
        # autorizada por DGII (ej: CertiSign, DigiCert).
        firma = ET.SubElement(root, "FirmaDigital")

        # Valor de firma placeholder (hash SHA-256 del contenido)
        contenido_previo = ET.tostring(root, encoding="unicode")
        hash_firma = hashlib.sha256(contenido_previo.encode("utf-8")).hexdigest()

        valor_firma = ET.SubElement(firma, "ValorFirma")
        valor_firma.text = hash_firma

        certificado = ET.SubElement(firma, "Certificado")
        certificado.text = "PLACEHOLDER_CERTIFICADO_DIGITAL"

        algoritmo = ET.SubElement(firma, "AlgoritmoFirma")
        algoritmo.text = "SHA256withRSA"

        nota_firma = ET.SubElement(firma, "Nota")
        nota_firma.text = (
            "Firma digital placeholder. En produccion se usa certificado "
            "digital emitido por entidad certificadora autorizada por DGII."
        )

        # Formatear XML con indentacion para legibilidad
        xml_crudo = ET.tostring(root, encoding="unicode", xml_declaration=False)
        xml_parseado = minidom.parseString(xml_crudo)
        xml_formateado = xml_parseado.toprettyxml(indent="  ", encoding=None)

        # Remover la declaracion XML duplicada que agrega minidom
        lineas = xml_formateado.split("\n")
        if lineas and lineas[0].startswith("<?xml"):
            lineas = lineas[1:]
        xml_final = '<?xml version="1.0" encoding="UTF-8"?>\n' + "\n".join(lineas)

        return xml_final

    # -------------------------------------------------------------------
    # Validacion de RNC (9 digitos) - Algoritmo oficial DGII
    # -------------------------------------------------------------------

    @staticmethod
    def _validar_rnc(rnc: str) -> TaxIdValidationResult:
        """
        Valida un RNC (Registro Nacional del Contribuyente) de 9 digitos.

        Algoritmo oficial de validacion DGII:
        1. Tomar los primeros 8 digitos del RNC.
        2. Multiplicar cada digito por su factor de peso correspondiente:
           Factores: [7, 9, 8, 6, 5, 4, 3, 2]
        3. Sumar todos los productos.
        4. Calcular el residuo de la suma modulo 11.
        5. Si residuo == 0, digito verificador = 2.
           Si residuo == 1, digito verificador = 1.
           En otro caso, digito verificador = 11 - residuo.
        6. Comparar con el noveno digito del RNC.

        Args:
            rnc: Cadena con el RNC (puede incluir guiones).

        Returns:
            TaxIdValidationResult con el resultado detallado.
        """
        limpio = rnc.replace("-", "").replace(" ", "").strip()

        # Verificar que tenga exactamente 9 digitos
        if len(limpio) != 9:
            return TaxIdValidationResult(
                tax_id=rnc,
                tax_id_limpio=limpio,
                tipo="RNC",
                valido=False,
                mensaje=f"RNC debe tener 9 digitos, se recibieron {len(limpio)}.",
            )

        # Verificar que todos sean digitos
        if not limpio.isdigit():
            return TaxIdValidationResult(
                tax_id=rnc,
                tax_id_limpio=limpio,
                tipo="RNC",
                valido=False,
                mensaje="RNC debe contener solo digitos numericos.",
            )

        # Factores de peso para RNC segun DGII
        factores = [7, 9, 8, 6, 5, 4, 3, 2]

        # Calcular suma ponderada de los primeros 8 digitos
        suma = 0
        for i in range(8):
            suma += int(limpio[i]) * factores[i]

        # Calcular digito verificador
        residuo = suma % 11

        if residuo == 0:
            digito_esperado = 2
        elif residuo == 1:
            digito_esperado = 1
        else:
            digito_esperado = 11 - residuo

        digito_real = int(limpio[8])
        es_valido = digito_real == digito_esperado

        return TaxIdValidationResult(
            tax_id=rnc,
            tax_id_limpio=limpio,
            tipo="RNC",
            valido=es_valido,
            digito_verificador=digito_real,
            digito_esperado=digito_esperado,
            mensaje=(
                "RNC valido." if es_valido
                else f"RNC invalido: digito verificador esperado {digito_esperado}, "
                     f"recibido {digito_real}."
            ),
        )

    # -------------------------------------------------------------------
    # Validacion de Cedula (11 digitos) - Algoritmo tipo Luhn
    # -------------------------------------------------------------------

    @staticmethod
    def _validar_cedula(cedula: str) -> TaxIdValidationResult:
        """
        Valida una Cedula de Identidad dominicana de 11 digitos.

        Algoritmo de verificacion (variante Luhn usada por JCE):
        1. Tomar los primeros 10 digitos de la cedula.
        2. Multiplicar cada digito por factores alternados [1, 2, 1, 2, ...].
        3. Si el producto es >= 10, sumar los digitos del producto.
        4. Sumar todos los resultados.
        5. Tomar el digito de las decenas siguiente (redondear arriba a
           proxima decena) y restar la suma. Eso da el digito verificador.
        6. Si el resultado es 10, el digito verificador es 0.
        7. Comparar con el undecimo digito de la cedula.

        Args:
            cedula: Cadena con la cedula (puede incluir guiones).

        Returns:
            TaxIdValidationResult con el resultado detallado.
        """
        limpio = cedula.replace("-", "").replace(" ", "").strip()

        # Verificar longitud exacta de 11 digitos
        if len(limpio) != 11:
            return TaxIdValidationResult(
                tax_id=cedula,
                tax_id_limpio=limpio,
                tipo="Cedula",
                valido=False,
                mensaje=f"Cedula debe tener 11 digitos, se recibieron {len(limpio)}.",
            )

        # Verificar que todos sean digitos
        if not limpio.isdigit():
            return TaxIdValidationResult(
                tax_id=cedula,
                tax_id_limpio=limpio,
                tipo="Cedula",
                valido=False,
                mensaje="Cedula debe contener solo digitos numericos.",
            )

        # Factores alternados tipo Luhn
        factores = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2]

        # Calcular suma verificadora
        suma = 0
        for i in range(10):
            producto = int(limpio[i]) * factores[i]
            # Si el producto tiene dos digitos, sumar los digitos individuales
            if producto >= 10:
                producto = (producto // 10) + (producto % 10)
            suma += producto

        # Calcular digito verificador
        # Redondear la suma hacia arriba a la proxima decena y restar
        decena_siguiente = ((suma // 10) + 1) * 10
        digito_esperado = decena_siguiente - suma

        # Si el resultado es 10, el digito verificador es 0
        if digito_esperado == 10:
            digito_esperado = 0

        digito_real = int(limpio[10])
        es_valido = digito_real == digito_esperado

        return TaxIdValidationResult(
            tax_id=cedula,
            tax_id_limpio=limpio,
            tipo="Cedula",
            valido=es_valido,
            digito_verificador=digito_real,
            digito_esperado=digito_esperado,
            mensaje=(
                "Cedula valida." if es_valido
                else f"Cedula invalida: digito verificador esperado {digito_esperado}, "
                     f"recibido {digito_real}."
            ),
        )

    # -------------------------------------------------------------------
    # Implementacion de metodos abstractos
    # -------------------------------------------------------------------

    async def generate_invoice(self, invoice_data: dict) -> FiscalDocument:
        """
        Genera un comprobante fiscal (NCF o e-CF) para Republica Dominicana.

        Flujo de generacion:
        1. Determina el tipo de comprobante segun fiscal_type.
        2. Genera el NCF con secuencia auto-incrementada o explicita.
        3. Si se solicita e-CF, genera el XML completo.
        4. Retorna el FiscalDocument con toda la informacion.

        Args:
            invoice_data: Diccionario con los datos de la factura:
                - fiscal_type (str): Tipo de comprobante (ver NCF_TYPES).
                - sequence (int, opcional): Secuencia explicita.
                - generar_ecf (bool): Si True, genera XML del e-CF.
                - rnc_emisor (str): RNC del emisor.
                - rnc_comprador (str): RNC del comprador.
                - nombre_comprador (str): Razon social del comprador.
                - items (list[dict]): Lista de items de la factura.
                  Cada item: {descripcion, cantidad, precio_unitario,
                              descuento, indicador_itbis}
                - tipo_pago (str): "1"=Contado, "2"=Credito.
                - fecha_emision (str): Fecha DD-MM-YYYY.

        Returns:
            FiscalDocument con NCF, tipo y opcionalmente XML del e-CF.

        Raises:
            ValueError: Si el tipo de comprobante no es valido.
        """
        # Determinar tipo de NCF
        ncf_type = invoice_data.get("fiscal_type", "consumidor_final")
        tipo_codigo = self.NCF_TYPES.get(ncf_type)

        if tipo_codigo is None:
            raise ValueError(
                f"Tipo fiscal '{ncf_type}' no reconocido. "
                f"Tipos validos: {list(self.NCF_TYPES.keys())}"
            )

        # Obtener secuencia (explicita o auto-incrementada)
        secuencia = invoice_data.get("sequence")

        # Generar NCF
        ncf = self._generar_ncf(tipo_codigo, secuencia)

        # Generar XML del e-CF si se solicita
        xml_content = None
        generar_ecf = invoice_data.get("generar_ecf", False)
        if generar_ecf:
            xml_content = self._generar_ecf_xml(ncf, invoice_data, tipo_codigo)

        # Generar QR code (contenido para generar el QR)
        qr_data = (
            f"https://dgii.gov.do/ecf/consulta?"
            f"rnc={self.rnc_emisor}&ncf={ncf}"
        )

        # Construir datos de respuesta detallados
        response_data = {
            "ncf_type": ncf_type,
            "type_code": tipo_codigo,
            "type_name": self.NCF_TYPE_NAMES.get(tipo_codigo, ""),
            "rnc_emisor": self.rnc_emisor,
            "rnc_comprador": invoice_data.get("rnc_comprador", ""),
            "fecha_emision": invoice_data.get(
                "fecha_emision",
                datetime.now(timezone.utc).strftime("%d-%m-%Y"),
            ),
            "tiene_ecf": generar_ecf,
            "itbis_rate": self.ITBIS_RATE,
        }

        # Calcular totales si hay items
        items = invoice_data.get("items", [])
        if items:
            subtotal = sum(
                float(it.get("cantidad", 1)) * float(it.get("precio_unitario", 0))
                - float(it.get("descuento", 0))
                for it in items
            )
            itbis = sum(
                (
                    float(it.get("cantidad", 1)) * float(it.get("precio_unitario", 0))
                    - float(it.get("descuento", 0))
                )
                * (0.18 if int(it.get("indicador_itbis", 1)) in (1,) else
                   0.16 if int(it.get("indicador_itbis", 1)) == 2 else 0.0)
                for it in items
            )
            response_data["subtotal"] = round(subtotal, 2)
            response_data["itbis_total"] = round(itbis, 2)
            response_data["total"] = round(subtotal + itbis, 2)

        logger.info(
            "Factura generada: NCF=%s, tipo=%s, e-CF=%s",
            ncf, ncf_type, generar_ecf,
        )

        return FiscalDocument(
            fiscal_number=ncf,
            document_type=f"NCF-{tipo_codigo}",
            xml_content=xml_content,
            qr_code=qr_data if generar_ecf else None,
            status="generated",
            response_data=response_data,
        )

    async def cancel_invoice(self, fiscal_number: str, reason: str) -> FiscalDocument:
        """
        Anula un comprobante fiscal y registra la anulacion para reporte 609.

        Segun normativa DGII, la anulacion de un NCF debe reportarse en el
        formato 609 (Reporte de Comprobantes Anulados) del periodo fiscal
        correspondiente.

        Args:
            fiscal_number: NCF del comprobante a anular.
            reason: Motivo de la anulacion.

        Returns:
            FiscalDocument con estado 'cancelled' y datos de la anulacion.

        Raises:
            ValueError: Si el formato del NCF no es valido.
        """
        # Validar formato basico del NCF
        if not fiscal_number or len(fiscal_number) < 3:
            raise ValueError(
                f"NCF '{fiscal_number}' no tiene un formato valido."
            )

        # Extraer tipo de comprobante del NCF
        # Formato: B{tipo:2}{secuencia:8} o E{tipo:2}{secuencia:8}
        serie = fiscal_number[0]
        tipo_codigo = fiscal_number[1:3] if len(fiscal_number) >= 3 else "00"

        tipo_nombre = self.NCF_TYPE_NAMES.get(tipo_codigo, "Desconocido")

        # Registrar anulacion para reporte 609
        fecha_anulacion = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        registro_anulacion = AnulacionRecord(
            ncf_anulado=fiscal_number,
            tipo_comprobante=tipo_codigo,
            fecha_anulacion=fecha_anulacion,
            motivo=reason,
            secuencia_anulacion=len(self._anulaciones) + 1,
        )
        self._anulaciones.append(registro_anulacion)

        logger.info(
            "NCF anulado: %s (tipo: %s, motivo: %s)",
            fiscal_number, tipo_nombre, reason,
        )

        return FiscalDocument(
            fiscal_number=fiscal_number,
            document_type="anulacion",
            status="cancelled",
            response_data={
                "reason": reason,
                "tipo_comprobante": tipo_codigo,
                "tipo_nombre": tipo_nombre,
                "fecha_anulacion": fecha_anulacion,
                "secuencia_anulacion": registro_anulacion.secuencia_anulacion,
                "registrado_609": True,
            },
        )

    async def generate_credit_note(
        self, original_fiscal_number: str, data: dict
    ) -> FiscalDocument:
        """
        Genera una Nota de Credito (tipo B04) referenciando un NCF original.

        Las notas de credito en RD usan el tipo de comprobante 04 y deben
        referenciar el NCF original al que aplican. Son usadas para:
        - Devolucion total o parcial de mercancias.
        - Anulacion parcial de servicios.
        - Correccion de errores en facturacion.
        - Descuentos posteriores a la emision.

        Args:
            original_fiscal_number: NCF del comprobante original.
            data: Diccionario con datos adicionales:
                - sequence (int, opcional): Secuencia explicita.
                - generar_ecf (bool): Si generar XML del e-CF.
                - monto_credito (float): Monto total de la nota de credito.
                - motivo (str): Motivo de la nota de credito.
                - items (list[dict]): Items afectados.
                - Otros campos de invoice_data para e-CF.

        Returns:
            FiscalDocument con NCF tipo B04 y datos de referencia.
        """
        tipo_codigo = "04"  # Nota de Credito
        secuencia = data.get("sequence")

        # Generar NCF de nota de credito
        ncf = self._generar_ncf(tipo_codigo, secuencia)

        # Generar XML si se solicita
        xml_content = None
        generar_ecf = data.get("generar_ecf", False)
        if generar_ecf:
            # Agregar referencia al NCF original en los datos del e-CF
            ecf_data = dict(data)
            ecf_data["ncf_referencia"] = original_fiscal_number
            xml_content = self._generar_ecf_xml(ncf, ecf_data, tipo_codigo)

        # QR code para la nota de credito
        qr_data = (
            f"https://dgii.gov.do/ecf/consulta?"
            f"rnc={self.rnc_emisor}&ncf={ncf}"
        )

        logger.info(
            "Nota de credito generada: NCF=%s, referencia=%s",
            ncf, original_fiscal_number,
        )

        return FiscalDocument(
            fiscal_number=ncf,
            document_type="NCF-04",
            xml_content=xml_content,
            qr_code=qr_data if generar_ecf else None,
            status="generated",
            response_data={
                "original_ncf": original_fiscal_number,
                "tipo_comprobante": tipo_codigo,
                "tipo_nombre": self.NCF_TYPE_NAMES[tipo_codigo],
                "monto_credito": data.get("monto_credito", 0),
                "motivo": data.get("motivo", ""),
                "tiene_ecf": generar_ecf,
            },
        )

    async def validate_tax_id(self, tax_id: str) -> dict:
        """
        Valida un RNC o Cedula dominicana usando los algoritmos oficiales.

        Detecta automaticamente si es RNC (9 digitos) o Cedula (11 digitos)
        basandose en la longitud despues de limpiar guiones y espacios.

        Algoritmos:
        - RNC: Factores de peso [7,9,8,6,5,4,3,2], modulo 11.
        - Cedula: Variante Luhn con factores alternados [1,2,1,2,...].

        Args:
            tax_id: RNC o Cedula a validar (puede contener guiones).

        Returns:
            Diccionario con resultado detallado de la validacion:
            {
                "tax_id": str (original),
                "tax_id_limpio": str (sin guiones/espacios),
                "tipo": "RNC" | "Cedula" | "Desconocido",
                "valido": bool,
                "digito_verificador": int | None,
                "digito_esperado": int | None,
                "mensaje": str,
            }
        """
        # Limpiar el identificador
        limpio = tax_id.replace("-", "").replace(" ", "").strip()

        # Determinar tipo por longitud
        if len(limpio) == 9:
            resultado = self._validar_rnc(tax_id)
        elif len(limpio) == 11:
            resultado = self._validar_cedula(tax_id)
        else:
            resultado = TaxIdValidationResult(
                tax_id=tax_id,
                tax_id_limpio=limpio,
                tipo="Desconocido",
                valido=False,
                mensaje=(
                    f"Longitud invalida ({len(limpio)} digitos). "
                    f"RNC debe tener 9 digitos, Cedula debe tener 11 digitos."
                ),
            )

        logger.info(
            "Validacion %s: %s -> %s (%s)",
            resultado.tipo, tax_id, resultado.valido, resultado.mensaje,
        )

        # Retornar como diccionario para compatibilidad con la interfaz abstracta
        return {
            "tax_id": resultado.tax_id,
            "tax_id_limpio": resultado.tax_id_limpio,
            "tipo": resultado.tipo,
            "valido": resultado.valido,
            "digito_verificador": resultado.digito_verificador,
            "digito_esperado": resultado.digito_esperado,
            "mensaje": resultado.mensaje,
        }

    # -------------------------------------------------------------------
    # Metodos auxiliares publicos
    # -------------------------------------------------------------------

    def obtener_anulaciones(self) -> list[AnulacionRecord]:
        """
        Retorna la lista de anulaciones registradas.
        Util para generar el reporte 609.
        """
        return list(self._anulaciones)

    def obtener_secuencia_actual(self, tipo_codigo: str) -> int:
        """
        Retorna la secuencia actual para un tipo de comprobante.

        Args:
            tipo_codigo: Codigo del tipo (ej: "01", "02").

        Returns:
            Numero de secuencia actual.
        """
        config = self._secuencias.get(tipo_codigo)
        if config is None:
            return 0
        return config.secuencia_actual

    def configurar_secuencia(
        self,
        tipo_codigo: str,
        secuencia_actual: int = 0,
        secuencia_maxima: int = 0,
        fecha_vencimiento: str = "",
    ) -> None:
        """
        Configura la secuencia NCF para un tipo de comprobante.

        Usado cuando se recibe autorizacion de DGII para un rango
        de secuencias. Por ejemplo, DGII autoriza del 1 al 500
        para comprobantes de credito fiscal.

        Args:
            tipo_codigo: Codigo del tipo (ej: "01").
            secuencia_actual: Secuencia desde la cual comenzar.
            secuencia_maxima: Secuencia maxima autorizada.
            fecha_vencimiento: Fecha limite de uso (YYYY-MM-DD).
        """
        if tipo_codigo not in self.NCF_TYPE_NAMES:
            raise ValueError(f"Tipo de comprobante '{tipo_codigo}' no valido.")

        self._secuencias[tipo_codigo] = NCFSequenceConfig(
            tipo=tipo_codigo,
            nombre=self.NCF_TYPE_NAMES[tipo_codigo],
            secuencia_actual=secuencia_actual,
            secuencia_maxima=secuencia_maxima,
            fecha_vencimiento=fecha_vencimiento,
        )

        logger.info(
            "Secuencia configurada: tipo=%s, actual=%d, maxima=%d, vencimiento=%s",
            tipo_codigo, secuencia_actual, secuencia_maxima, fecha_vencimiento,
        )


# ===========================================================================
# COLOMBIA - Motor Fiscal DIAN (Stub)
# ===========================================================================

class ColombiaFiscal(FiscalEngine):
    """
    Motor fiscal para Colombia - Factura Electronica DIAN UBL 2.1.

    Stub: pendiente de integracion con el sistema de facturacion electronica
    de la DIAN (Direccion de Impuestos y Aduanas Nacionales).

    Documentos soportados (pendientes de implementacion):
    - Factura Electronica de Venta (FEV)
    - Nota Credito Electronica
    - Nota Debito Electronica
    - Documento Soporte Electronico

    Referencia tecnica:
    - UBL 2.1 (ISO/IEC 19845:2015)
    - Resolucion DIAN 000042 de 2020
    - Formato XML firmado con certificado digital
    """

    # Prefijos para documentos electronicos DIAN
    DOCUMENT_PREFIXES: dict[str, str] = {
        "factura": "FE",
        "nota_credito": "NC",
        "nota_debito": "ND",
        "documento_soporte": "DS",
    }

    async def generate_invoice(self, invoice_data: dict) -> FiscalDocument:
        """
        Genera factura electronica DIAN.

        TODO: Implementar integracion con API DIAN para:
        - Generacion de XML UBL 2.1
        - Firma digital con certificado autorizado
        - Envio al sistema de validacion previa DIAN
        - Recepcion de CUFE (Codigo Unico de Factura Electronica)
        """
        secuencia = invoice_data.get("sequence", 1)
        prefijo = invoice_data.get("prefijo", "FE")
        fiscal_number = f"{prefijo}{secuencia:010d}"

        return FiscalDocument(
            fiscal_number=fiscal_number,
            document_type="factura_electronica_dian",
            status="generated",
            response_data={
                "pais": "CO",
                "sistema": "DIAN",
                "formato": "UBL 2.1",
                "nota": "Stub - pendiente integracion con API DIAN",
            },
        )

    async def cancel_invoice(self, fiscal_number: str, reason: str) -> FiscalDocument:
        """
        Registra anulacion de factura electronica DIAN.

        TODO: En Colombia no se anulan facturas directamente; se emite
        una Nota Credito que referencia la factura original.
        """
        return FiscalDocument(
            fiscal_number=fiscal_number,
            document_type="anulacion_dian",
            status="cancelled",
            response_data={
                "reason": reason,
                "nota": "En Colombia se usa Nota Credito para anular facturas",
            },
        )

    async def generate_credit_note(
        self, original_fiscal_number: str, data: dict
    ) -> FiscalDocument:
        """
        Genera Nota Credito Electronica DIAN.

        TODO: Implementar XML UBL 2.1 para nota credito con referencia
        a la factura original via DiscrepancyResponse.
        """
        secuencia = data.get("sequence", 1)
        fiscal_number = f"NC{secuencia:010d}"

        return FiscalDocument(
            fiscal_number=fiscal_number,
            document_type="nota_credito_dian",
            status="generated",
            response_data={
                "original_fiscal_number": original_fiscal_number,
                "pais": "CO",
                "nota": "Stub - pendiente integracion con API DIAN",
            },
        )

    async def validate_tax_id(self, tax_id: str) -> dict:
        """
        Valida un NIT (Numero de Identificacion Tributaria) colombiano.

        TODO: Implementar algoritmo de digito de verificacion NIT:
        - 9 digitos + 1 digito de verificacion
        - Factores: [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3]
        - Modulo 11
        """
        limpio = tax_id.replace("-", "").replace(".", "").strip()
        # Validacion basica de longitud (NIT tiene 9-10 digitos)
        es_valido = limpio.isdigit() and len(limpio) in (9, 10)

        return {
            "tax_id": tax_id,
            "tax_id_limpio": limpio,
            "tipo": "NIT",
            "valido": es_valido,
            "mensaje": "Validacion basica de longitud (stub)" if es_valido
                       else "NIT debe tener 9 o 10 digitos",
            "pais": "CO",
        }


# ===========================================================================
# MEXICO - Motor Fiscal SAT (Stub)
# ===========================================================================

class MexicoFiscal(FiscalEngine):
    """
    Motor fiscal para Mexico - CFDI 4.0 con SAT.

    Stub: pendiente de integracion con PAC (Proveedor Autorizado de
    Certificacion) para timbrado de CFDI.

    Documentos soportados (pendientes de implementacion):
    - CFDI de Ingreso (factura)
    - CFDI de Egreso (nota de credito)
    - CFDI de Traslado
    - CFDI de Pago (complemento de pago)

    Referencia tecnica:
    - CFDI version 4.0 (vigente desde 01/01/2022)
    - Anexo 20 del SAT
    - XML firmado con CSD (Certificado de Sello Digital)
    - Timbrado a traves de PAC autorizado por SAT
    """

    # Tipos de CFDI
    CFDI_TYPES: dict[str, str] = {
        "ingreso": "I",
        "egreso": "E",
        "traslado": "T",
        "pago": "P",
    }

    # Regimenes fiscales comunes en Mexico
    REGIMENES: dict[str, str] = {
        "601": "General de Ley Personas Morales",
        "603": "Personas Morales con Fines No Lucrativos",
        "605": "Sueldos y Salarios",
        "606": "Arrendamiento",
        "612": "Personas Fisicas con Actividades Empresariales y Profesionales",
        "616": "Sin Obligaciones Fiscales",
        "621": "Incorporacion Fiscal",
        "626": "Regimen Simplificado de Confianza",
    }

    async def generate_invoice(self, invoice_data: dict) -> FiscalDocument:
        """
        Genera CFDI 4.0.

        TODO: Implementar integracion con PAC para:
        - Generacion de XML CFDI 4.0 segun Anexo 20
        - Sellado con CSD del emisor
        - Envio a PAC para timbrado
        - Recepcion de UUID (folio fiscal) y Timbre Fiscal Digital
        """
        secuencia = invoice_data.get("sequence", 1)
        serie = invoice_data.get("serie", "A")
        tipo_cfdi = invoice_data.get("tipo", "ingreso")
        tipo_codigo = self.CFDI_TYPES.get(tipo_cfdi, "I")

        fiscal_number = f"CFDI-{serie}{secuencia:010d}"

        return FiscalDocument(
            fiscal_number=fiscal_number,
            document_type=f"CFDI_4.0_{tipo_codigo}",
            status="generated",
            response_data={
                "pais": "MX",
                "sistema": "SAT",
                "version_cfdi": "4.0",
                "tipo_cfdi": tipo_cfdi,
                "tipo_codigo": tipo_codigo,
                "serie": serie,
                "nota": "Stub - pendiente integracion con PAC autorizado",
            },
        )

    async def cancel_invoice(self, fiscal_number: str, reason: str) -> FiscalDocument:
        """
        Cancela un CFDI.

        TODO: Implementar solicitud de cancelacion via PAC/SAT:
        - Motivo de cancelacion (01=Con relacion, 02=Sin relacion,
          03=No se llevo, 04=Operacion nominativa)
        - CFDI sustituto si motivo es 01
        - Aceptacion del receptor si monto > $5,000 MXN
        """
        return FiscalDocument(
            fiscal_number=fiscal_number,
            document_type="cancelacion_cfdi",
            status="cancelled",
            response_data={
                "reason": reason,
                "pais": "MX",
                "nota": "Stub - pendiente integracion con SAT para cancelacion",
            },
        )

    async def generate_credit_note(
        self, original_fiscal_number: str, data: dict
    ) -> FiscalDocument:
        """
        Genera CFDI de Egreso (nota de credito).

        TODO: Implementar CFDI tipo E (Egreso) con referencia al CFDI
        original via CfdiRelacionados (TipoRelacion=01).
        """
        secuencia = data.get("sequence", 1)
        serie = data.get("serie", "NC")
        fiscal_number = f"CFDI-{serie}{secuencia:010d}"

        return FiscalDocument(
            fiscal_number=fiscal_number,
            document_type="CFDI_4.0_E",
            status="generated",
            response_data={
                "original_fiscal_number": original_fiscal_number,
                "pais": "MX",
                "tipo_cfdi": "egreso",
                "nota": "Stub - pendiente integracion con PAC autorizado",
            },
        )

    async def validate_tax_id(self, tax_id: str) -> dict:
        """
        Valida un RFC (Registro Federal de Contribuyentes) mexicano.

        TODO: Implementar validacion completa del RFC:
        - Personas fisicas: 13 caracteres (4 letras + 6 fecha + 3 homoclave)
        - Personas morales: 12 caracteres (3 letras + 6 fecha + 3 homoclave)
        - Validar estructura con regex
        - Verificar homoclave contra algoritmo SAT
        """
        limpio = tax_id.strip().upper()

        # Validacion basica de estructura RFC
        es_persona_moral = len(limpio) == 12
        es_persona_fisica = len(limpio) == 13
        es_valido = es_persona_moral or es_persona_fisica

        tipo_persona = (
            "Persona Moral" if es_persona_moral
            else "Persona Fisica" if es_persona_fisica
            else "Desconocido"
        )

        return {
            "tax_id": tax_id,
            "tax_id_limpio": limpio,
            "tipo": "RFC",
            "valido": es_valido,
            "tipo_persona": tipo_persona,
            "mensaje": f"Validacion basica de estructura (stub) - {tipo_persona}"
                       if es_valido
                       else "RFC debe tener 12 digitos (moral) o 13 (fisica)",
            "pais": "MX",
        }


# ===========================================================================
# Fabrica de motores fiscales
# ===========================================================================

# Registro de motores disponibles por codigo de pais ISO 3166-1 alpha-2
_ENGINE_REGISTRY: dict[str, type[FiscalEngine]] = {
    "DO": DominicanRepublicFiscal,
    "CO": ColombiaFiscal,
    "MX": MexicoFiscal,
}


def get_fiscal_engine(country_code: str, **kwargs: Any) -> FiscalEngine:
    """
    Fabrica de motor fiscal segun codigo de pais ISO 3166-1 alpha-2.

    Crea e inicializa la instancia del motor fiscal correspondiente
    al pais solicitado. Parametros adicionales se pasan al constructor
    del motor especifico.

    Args:
        country_code: Codigo ISO del pais (ej: "DO", "CO", "MX").
        **kwargs: Parametros adicionales para el constructor del motor.
                  Para "DO": rnc_emisor, nombre_emisor, direccion_emisor, secuencias.
                  Para "CO" y "MX": sin parametros adicionales por ahora.

    Returns:
        Instancia del motor fiscal correspondiente.

    Raises:
        ValueError: Si el codigo de pais no tiene motor fiscal disponible.

    Ejemplo:
        >>> engine = get_fiscal_engine("DO", rnc_emisor="123456789")
        >>> doc = await engine.generate_invoice({...})
    """
    engine_class = _ENGINE_REGISTRY.get(country_code.upper())

    if engine_class is None:
        paises_disponibles = ", ".join(sorted(_ENGINE_REGISTRY.keys()))
        raise ValueError(
            f"Motor fiscal no disponible para pais: '{country_code}'. "
            f"Paises soportados: {paises_disponibles}"
        )

    return engine_class(**kwargs)


def get_available_countries() -> list[str]:
    """
    Retorna la lista de codigos de pais con motor fiscal disponible.

    Returns:
        Lista de codigos ISO 3166-1 alpha-2 (ej: ["CO", "DO", "MX"]).
    """
    return sorted(_ENGINE_REGISTRY.keys())
