"""
Modulo de reportes DGII para Republica Dominicana.

Genera los formatos oficiales requeridos por la Direccion General de
Impuestos Internos (DGII) para la presentacion mensual de informacion
fiscal:

  - Formato 607: Reporte de Ventas de Bienes y Servicios
  - Formato 608: Reporte de Compras de Bienes y Servicios
  - Formato 609: Reporte de Comprobantes Anulados

Cada reporte se genera en formato de texto delimitado por pipes (|),
que es el formato aceptado por el portal de la DGII para carga masiva.

Estructura comun de los reportes:
  Linea 1: Encabezado con RNC del contribuyente y periodo (YYYYMM)
  Lineas 2..N: Registros de datos (campos delimitados por |)
  Ultima linea: Resumen con cantidad de registros y totales

Referencia:
  Norma General 06-2018 DGII
  Manual de Formatos de Envio de Datos (version vigente)

Autor: Equipo HMIS SaaS
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constantes compartidas entre reportes
# ---------------------------------------------------------------------------

# Delimitador oficial usado por DGII en archivos de texto
DGII_DELIMITER = "|"

# Tipos de comprobante reconocidos por DGII
TIPOS_COMPROBANTE = {
    "01": "Comprobante de Credito Fiscal",
    "02": "Comprobante de Consumidor Final",
    "03": "Nota de Debito",
    "04": "Nota de Credito",
    "11": "Comprobante de Compras",
    "12": "Registro Unico de Ingresos",
    "13": "Comprobante para Gastos Menores",
    "14": "Comprobante para Regimenes Especiales",
    "15": "Comprobante Gubernamental",
    "16": "Comprobante para Exportaciones",
    "17": "Comprobante para Pagos al Exterior",
}


# ---------------------------------------------------------------------------
# Dataclass base para encabezado de reportes DGII
# ---------------------------------------------------------------------------

@dataclass
class DGIIReportHeader:
    """
    Encabezado comun para todos los reportes DGII.

    Contiene la informacion del contribuyente y periodo de reporte.
    """

    rnc_contribuyente: str          # RNC de la empresa que reporta (9 digitos)
    periodo: str                    # Periodo en formato YYYYMM (ej: "202601")
    nombre_contribuyente: str = ""  # Razon social (opcional, para referencia interna)


# ---------------------------------------------------------------------------
# Formato 607 - Reporte de Ventas de Bienes y Servicios
# ---------------------------------------------------------------------------

@dataclass
class Registro607:
    """
    Registro individual del formato 607 (ventas).

    Cada registro representa una factura o comprobante de venta emitido
    durante el periodo fiscal reportado.
    """

    rnc_cedula_comprador: str       # RNC o Cedula del comprador
    tipo_identificacion: int        # 1=RNC, 2=Cedula, 3=Pasaporte
    ncf: str                        # Numero de Comprobante Fiscal emitido
    ncf_modificado: str = ""        # NCF que modifica (para notas de credito/debito)
    tipo_ingreso: str = "01"        # 01=Ingresos por operaciones
    fecha_comprobante: str = ""     # Fecha del comprobante (YYYYMMDD)
    fecha_retencion: str = ""       # Fecha de retencion (YYYYMMDD)
    monto_facturado: float = 0.0    # Monto total facturado
    itbis_facturado: float = 0.0    # ITBIS facturado
    itbis_retenido_terceros: float = 0.0  # ITBIS retenido por terceros
    itbis_percibido: float = 0.0    # ITBIS percibido
    retencion_renta_terceros: float = 0.0  # Retencion ISR por terceros
    isr_percibido: float = 0.0      # ISR percibido
    impuesto_selectivo: float = 0.0 # Impuesto Selectivo al Consumo (ISC)
    otros_impuestos: float = 0.0    # Otros impuestos/tasas
    monto_propina_legal: float = 0.0  # Propina legal (10%)
    efectivo: float = 0.0           # Forma de pago: efectivo
    cheque_transferencia: float = 0.0  # Forma de pago: cheque/transferencia
    tarjeta_debito_credito: float = 0.0  # Forma de pago: tarjeta
    venta_credito: float = 0.0      # Forma de pago: credito
    bonos_certificados: float = 0.0 # Forma de pago: bonos/certificados
    permuta: float = 0.0            # Forma de pago: permuta
    otras_formas_venta: float = 0.0 # Otras formas de venta


class Reporte607:
    """
    Generador del Formato 607 - Reporte de Ventas.

    Este reporte debe ser presentado mensualmente ante la DGII y contiene
    el detalle de todas las ventas de bienes y servicios realizadas durante
    el periodo fiscal. Es obligatorio para todos los contribuyentes que
    emiten comprobantes fiscales.

    Campos principales por registro:
    - RNC/Cedula del comprador
    - Tipo de comprobante y NCF
    - Fecha del comprobante
    - Monto facturado y ITBIS
    - Retenciones e impuestos aplicados
    - Formas de pago

    Formato de salida: texto delimitado por pipes (|)
    """

    def __init__(self, header: DGIIReportHeader):
        """
        Inicializa el generador del reporte 607.

        Args:
            header: Encabezado con RNC y periodo del contribuyente.
        """
        self.header = header
        self._registros: list[Registro607] = []

    def agregar_registro(self, registro: Registro607) -> None:
        """
        Agrega un registro de venta al reporte.

        Args:
            registro: Registro607 con los datos de la venta.
        """
        self._registros.append(registro)

    def agregar_desde_dict(self, datos: dict) -> None:
        """
        Agrega un registro de venta a partir de un diccionario.

        Facilita la integracion con datos de facturacion existentes.
        Los campos no proporcionados usan sus valores por defecto.

        Args:
            datos: Diccionario con campos del registro.
                   Claves: rnc_cedula_comprador, tipo_identificacion,
                   ncf, fecha_comprobante, monto_facturado, itbis_facturado, etc.
        """
        registro = Registro607(
            rnc_cedula_comprador=str(datos.get("rnc_cedula_comprador", "")),
            tipo_identificacion=int(datos.get("tipo_identificacion", 1)),
            ncf=str(datos.get("ncf", "")),
            ncf_modificado=str(datos.get("ncf_modificado", "")),
            tipo_ingreso=str(datos.get("tipo_ingreso", "01")),
            fecha_comprobante=str(datos.get("fecha_comprobante", "")),
            fecha_retencion=str(datos.get("fecha_retencion", "")),
            monto_facturado=float(datos.get("monto_facturado", 0)),
            itbis_facturado=float(datos.get("itbis_facturado", 0)),
            itbis_retenido_terceros=float(datos.get("itbis_retenido_terceros", 0)),
            itbis_percibido=float(datos.get("itbis_percibido", 0)),
            retencion_renta_terceros=float(datos.get("retencion_renta_terceros", 0)),
            isr_percibido=float(datos.get("isr_percibido", 0)),
            impuesto_selectivo=float(datos.get("impuesto_selectivo", 0)),
            otros_impuestos=float(datos.get("otros_impuestos", 0)),
            monto_propina_legal=float(datos.get("monto_propina_legal", 0)),
            efectivo=float(datos.get("efectivo", 0)),
            cheque_transferencia=float(datos.get("cheque_transferencia", 0)),
            tarjeta_debito_credito=float(datos.get("tarjeta_debito_credito", 0)),
            venta_credito=float(datos.get("venta_credito", 0)),
            bonos_certificados=float(datos.get("bonos_certificados", 0)),
            permuta=float(datos.get("permuta", 0)),
            otras_formas_venta=float(datos.get("otras_formas_venta", 0)),
        )
        self._registros.append(registro)

    def cargar_lote(self, lista_datos: list[dict]) -> int:
        """
        Carga multiples registros desde una lista de diccionarios.

        Args:
            lista_datos: Lista de diccionarios, cada uno representando una venta.

        Returns:
            Cantidad de registros cargados exitosamente.
        """
        cargados = 0
        for datos in lista_datos:
            try:
                self.agregar_desde_dict(datos)
                cargados += 1
            except (ValueError, TypeError) as e:
                logger.warning(
                    "Error al cargar registro 607: %s (datos: %s)", e, datos
                )
        return cargados

    def _formatear_monto(self, monto: float) -> str:
        """Formatea un monto numerico con 2 decimales para el reporte."""
        return f"{monto:.2f}"

    def generar(self) -> str:
        """
        Genera el contenido completo del reporte 607 en formato DGII.

        Estructura:
          Linea 1: 607|RNC|YYYYMM|cantidad_registros
          Lineas 2..N: campos delimitados por pipes
          Ultima linea: totales

        Returns:
            Cadena con el reporte completo listo para enviar a DGII.
        """
        lineas: list[str] = []
        d = DGII_DELIMITER

        # --- Linea de encabezado ---
        encabezado = d.join([
            "607",
            self.header.rnc_contribuyente,
            self.header.periodo,
            str(len(self._registros)),
        ])
        lineas.append(encabezado)

        # --- Lineas de detalle ---
        total_monto_facturado = 0.0
        total_itbis_facturado = 0.0
        total_itbis_retenido = 0.0
        total_itbis_percibido = 0.0
        total_retencion_renta = 0.0
        total_isr_percibido = 0.0
        total_isc = 0.0
        total_otros = 0.0
        total_propina = 0.0

        for reg in self._registros:
            campos = [
                reg.rnc_cedula_comprador,
                str(reg.tipo_identificacion),
                reg.ncf,
                reg.ncf_modificado,
                reg.tipo_ingreso,
                reg.fecha_comprobante,
                reg.fecha_retencion,
                self._formatear_monto(reg.monto_facturado),
                self._formatear_monto(reg.itbis_facturado),
                self._formatear_monto(reg.itbis_retenido_terceros),
                self._formatear_monto(reg.itbis_percibido),
                self._formatear_monto(reg.retencion_renta_terceros),
                self._formatear_monto(reg.isr_percibido),
                self._formatear_monto(reg.impuesto_selectivo),
                self._formatear_monto(reg.otros_impuestos),
                self._formatear_monto(reg.monto_propina_legal),
                self._formatear_monto(reg.efectivo),
                self._formatear_monto(reg.cheque_transferencia),
                self._formatear_monto(reg.tarjeta_debito_credito),
                self._formatear_monto(reg.venta_credito),
                self._formatear_monto(reg.bonos_certificados),
                self._formatear_monto(reg.permuta),
                self._formatear_monto(reg.otras_formas_venta),
            ]
            lineas.append(d.join(campos))

            # Acumular totales
            total_monto_facturado += reg.monto_facturado
            total_itbis_facturado += reg.itbis_facturado
            total_itbis_retenido += reg.itbis_retenido_terceros
            total_itbis_percibido += reg.itbis_percibido
            total_retencion_renta += reg.retencion_renta_terceros
            total_isr_percibido += reg.isr_percibido
            total_isc += reg.impuesto_selectivo
            total_otros += reg.otros_impuestos
            total_propina += reg.monto_propina_legal

        # --- Linea de resumen ---
        resumen = d.join([
            str(len(self._registros)),
            self._formatear_monto(total_monto_facturado),
            self._formatear_monto(total_itbis_facturado),
            self._formatear_monto(total_itbis_retenido),
            self._formatear_monto(total_itbis_percibido),
            self._formatear_monto(total_retencion_renta),
            self._formatear_monto(total_isr_percibido),
            self._formatear_monto(total_isc),
            self._formatear_monto(total_otros),
            self._formatear_monto(total_propina),
        ])
        lineas.append(resumen)

        logger.info(
            "Reporte 607 generado: periodo=%s, registros=%d, total_facturado=%.2f",
            self.header.periodo, len(self._registros), total_monto_facturado,
        )

        return "\n".join(lineas)

    @property
    def cantidad_registros(self) -> int:
        """Retorna la cantidad de registros cargados."""
        return len(self._registros)


# ---------------------------------------------------------------------------
# Formato 608 - Reporte de Compras de Bienes y Servicios
# ---------------------------------------------------------------------------

@dataclass
class Registro608:
    """
    Registro individual del formato 608 (compras).

    Cada registro representa una factura o comprobante de compra recibido
    durante el periodo fiscal reportado.
    """

    rnc_cedula_proveedor: str       # RNC o Cedula del proveedor
    tipo_identificacion: int        # 1=RNC, 2=Cedula, 3=Pasaporte
    tipo_bienes_servicios: str      # 01=Gastos de personal, 02=Gastos por trabajos, etc.
    ncf: str                        # NCF del comprobante recibido
    ncf_modificado: str = ""        # NCF que modifica (notas de credito/debito)
    fecha_comprobante: str = ""     # Fecha del comprobante (YYYYMMDD)
    fecha_pago: str = ""            # Fecha del pago (YYYYMMDD)
    monto_facturado_servicios: float = 0.0   # Monto facturado en servicios
    monto_facturado_bienes: float = 0.0      # Monto facturado en bienes
    total_monto_facturado: float = 0.0       # Monto total facturado
    itbis_facturado: float = 0.0             # ITBIS total facturado
    itbis_retenido: float = 0.0              # ITBIS retenido al proveedor
    itbis_sujeto_proporcionalidad: float = 0.0  # ITBIS sujeto a proporcionalidad
    itbis_llevado_costo: float = 0.0         # ITBIS llevado al costo
    itbis_por_adelantar: float = 0.0         # ITBIS por adelantar
    itbis_percibido_compras: float = 0.0     # ITBIS percibido en compras
    tipo_retencion_isr: str = ""             # Tipo de retencion ISR
    monto_retencion_renta: float = 0.0       # Monto retenido ISR
    isr_percibido_compras: float = 0.0       # ISR percibido en compras
    impuesto_selectivo: float = 0.0          # ISC
    otros_impuestos: float = 0.0             # Otros impuestos/tasas
    monto_propina_legal: float = 0.0         # Propina legal
    forma_pago: str = "01"                   # 01=Efectivo, 02=Cheque, etc.


class Reporte608:
    """
    Generador del Formato 608 - Reporte de Compras.

    Este reporte debe ser presentado mensualmente ante la DGII y contiene
    el detalle de todas las compras de bienes y servicios realizadas durante
    el periodo fiscal. Es obligatorio para todos los contribuyentes.

    Campos principales por registro:
    - RNC/Cedula del proveedor
    - Tipo de bien o servicio comprado
    - NCF del comprobante recibido
    - Fecha del comprobante y del pago
    - Montos facturados (bienes y servicios)
    - ITBIS facturado, retenido y llevado al costo
    - Retenciones ISR

    Formato de salida: texto delimitado por pipes (|)
    """

    def __init__(self, header: DGIIReportHeader):
        """
        Inicializa el generador del reporte 608.

        Args:
            header: Encabezado con RNC y periodo del contribuyente.
        """
        self.header = header
        self._registros: list[Registro608] = []

    def agregar_registro(self, registro: Registro608) -> None:
        """
        Agrega un registro de compra al reporte.

        Args:
            registro: Registro608 con los datos de la compra.
        """
        self._registros.append(registro)

    def agregar_desde_dict(self, datos: dict) -> None:
        """
        Agrega un registro de compra a partir de un diccionario.

        Args:
            datos: Diccionario con campos del registro.
        """
        registro = Registro608(
            rnc_cedula_proveedor=str(datos.get("rnc_cedula_proveedor", "")),
            tipo_identificacion=int(datos.get("tipo_identificacion", 1)),
            tipo_bienes_servicios=str(datos.get("tipo_bienes_servicios", "02")),
            ncf=str(datos.get("ncf", "")),
            ncf_modificado=str(datos.get("ncf_modificado", "")),
            fecha_comprobante=str(datos.get("fecha_comprobante", "")),
            fecha_pago=str(datos.get("fecha_pago", "")),
            monto_facturado_servicios=float(datos.get("monto_facturado_servicios", 0)),
            monto_facturado_bienes=float(datos.get("monto_facturado_bienes", 0)),
            total_monto_facturado=float(datos.get("total_monto_facturado", 0)),
            itbis_facturado=float(datos.get("itbis_facturado", 0)),
            itbis_retenido=float(datos.get("itbis_retenido", 0)),
            itbis_sujeto_proporcionalidad=float(
                datos.get("itbis_sujeto_proporcionalidad", 0)
            ),
            itbis_llevado_costo=float(datos.get("itbis_llevado_costo", 0)),
            itbis_por_adelantar=float(datos.get("itbis_por_adelantar", 0)),
            itbis_percibido_compras=float(datos.get("itbis_percibido_compras", 0)),
            tipo_retencion_isr=str(datos.get("tipo_retencion_isr", "")),
            monto_retencion_renta=float(datos.get("monto_retencion_renta", 0)),
            isr_percibido_compras=float(datos.get("isr_percibido_compras", 0)),
            impuesto_selectivo=float(datos.get("impuesto_selectivo", 0)),
            otros_impuestos=float(datos.get("otros_impuestos", 0)),
            monto_propina_legal=float(datos.get("monto_propina_legal", 0)),
            forma_pago=str(datos.get("forma_pago", "01")),
        )
        self._registros.append(registro)

    def cargar_lote(self, lista_datos: list[dict]) -> int:
        """
        Carga multiples registros desde una lista de diccionarios.

        Args:
            lista_datos: Lista de diccionarios, cada uno representando una compra.

        Returns:
            Cantidad de registros cargados exitosamente.
        """
        cargados = 0
        for datos in lista_datos:
            try:
                self.agregar_desde_dict(datos)
                cargados += 1
            except (ValueError, TypeError) as e:
                logger.warning(
                    "Error al cargar registro 608: %s (datos: %s)", e, datos
                )
        return cargados

    def _formatear_monto(self, monto: float) -> str:
        """Formatea un monto numerico con 2 decimales para el reporte."""
        return f"{monto:.2f}"

    def generar(self) -> str:
        """
        Genera el contenido completo del reporte 608 en formato DGII.

        Estructura:
          Linea 1: 608|RNC|YYYYMM|cantidad_registros
          Lineas 2..N: campos delimitados por pipes
          Ultima linea: totales

        Returns:
            Cadena con el reporte completo listo para enviar a DGII.
        """
        lineas: list[str] = []
        d = DGII_DELIMITER

        # --- Linea de encabezado ---
        encabezado = d.join([
            "608",
            self.header.rnc_contribuyente,
            self.header.periodo,
            str(len(self._registros)),
        ])
        lineas.append(encabezado)

        # --- Lineas de detalle ---
        total_facturado_servicios = 0.0
        total_facturado_bienes = 0.0
        total_monto_facturado = 0.0
        total_itbis_facturado = 0.0
        total_itbis_retenido = 0.0
        total_retencion_renta = 0.0

        for reg in self._registros:
            campos = [
                reg.rnc_cedula_proveedor,
                str(reg.tipo_identificacion),
                reg.tipo_bienes_servicios,
                reg.ncf,
                reg.ncf_modificado,
                reg.fecha_comprobante,
                reg.fecha_pago,
                self._formatear_monto(reg.monto_facturado_servicios),
                self._formatear_monto(reg.monto_facturado_bienes),
                self._formatear_monto(reg.total_monto_facturado),
                self._formatear_monto(reg.itbis_facturado),
                self._formatear_monto(reg.itbis_retenido),
                self._formatear_monto(reg.itbis_sujeto_proporcionalidad),
                self._formatear_monto(reg.itbis_llevado_costo),
                self._formatear_monto(reg.itbis_por_adelantar),
                self._formatear_monto(reg.itbis_percibido_compras),
                reg.tipo_retencion_isr,
                self._formatear_monto(reg.monto_retencion_renta),
                self._formatear_monto(reg.isr_percibido_compras),
                self._formatear_monto(reg.impuesto_selectivo),
                self._formatear_monto(reg.otros_impuestos),
                self._formatear_monto(reg.monto_propina_legal),
                reg.forma_pago,
            ]
            lineas.append(d.join(campos))

            # Acumular totales
            total_facturado_servicios += reg.monto_facturado_servicios
            total_facturado_bienes += reg.monto_facturado_bienes
            total_monto_facturado += reg.total_monto_facturado
            total_itbis_facturado += reg.itbis_facturado
            total_itbis_retenido += reg.itbis_retenido
            total_retencion_renta += reg.monto_retencion_renta

        # --- Linea de resumen ---
        resumen = d.join([
            str(len(self._registros)),
            self._formatear_monto(total_facturado_servicios),
            self._formatear_monto(total_facturado_bienes),
            self._formatear_monto(total_monto_facturado),
            self._formatear_monto(total_itbis_facturado),
            self._formatear_monto(total_itbis_retenido),
            self._formatear_monto(total_retencion_renta),
        ])
        lineas.append(resumen)

        logger.info(
            "Reporte 608 generado: periodo=%s, registros=%d, total_facturado=%.2f",
            self.header.periodo, len(self._registros), total_monto_facturado,
        )

        return "\n".join(lineas)

    @property
    def cantidad_registros(self) -> int:
        """Retorna la cantidad de registros cargados."""
        return len(self._registros)


# ---------------------------------------------------------------------------
# Formato 609 - Reporte de Comprobantes Anulados
# ---------------------------------------------------------------------------

@dataclass
class Registro609:
    """
    Registro individual del formato 609 (anulaciones).

    Cada registro representa un comprobante fiscal que fue anulado
    durante el periodo fiscal reportado.
    """

    tipo_comprobante: str       # Codigo del tipo de comprobante anulado
    ncf_anulado: str            # NCF del comprobante anulado
    fecha_anulacion: str = ""   # Fecha de la anulacion (YYYYMMDD)


class Reporte609:
    """
    Generador del Formato 609 - Reporte de Comprobantes Anulados.

    Este reporte debe ser presentado mensualmente ante la DGII y contiene
    el detalle de todos los comprobantes fiscales que fueron anulados
    durante el periodo fiscal. Es obligatorio reportar cualquier NCF
    que haya sido anulado.

    Campos por registro:
    - Tipo de comprobante anulado (01, 02, 03, 04, 14, 15)
    - NCF del comprobante anulado
    - Fecha de la anulacion

    Formato de salida: texto delimitado por pipes (|)
    """

    def __init__(self, header: DGIIReportHeader):
        """
        Inicializa el generador del reporte 609.

        Args:
            header: Encabezado con RNC y periodo del contribuyente.
        """
        self.header = header
        self._registros: list[Registro609] = []

    def agregar_registro(self, registro: Registro609) -> None:
        """
        Agrega un registro de anulacion al reporte.

        Args:
            registro: Registro609 con los datos de la anulacion.
        """
        self._registros.append(registro)

    def agregar_desde_dict(self, datos: dict) -> None:
        """
        Agrega un registro de anulacion a partir de un diccionario.

        Args:
            datos: Diccionario con campos del registro.
                   Claves: tipo_comprobante, ncf_anulado, fecha_anulacion.
        """
        # Inferir tipo de comprobante del NCF si no se provee explicitamente
        tipo = str(datos.get("tipo_comprobante", ""))
        ncf = str(datos.get("ncf_anulado", ""))

        if not tipo and len(ncf) >= 3:
            # Extraer tipo del NCF: B{tipo:2}{secuencia:8}
            tipo = ncf[1:3]

        registro = Registro609(
            tipo_comprobante=tipo,
            ncf_anulado=ncf,
            fecha_anulacion=str(datos.get("fecha_anulacion", "")),
        )
        self._registros.append(registro)

    def cargar_lote(self, lista_datos: list[dict]) -> int:
        """
        Carga multiples registros desde una lista de diccionarios.

        Args:
            lista_datos: Lista de diccionarios, cada uno representando una anulacion.

        Returns:
            Cantidad de registros cargados exitosamente.
        """
        cargados = 0
        for datos in lista_datos:
            try:
                self.agregar_desde_dict(datos)
                cargados += 1
            except (ValueError, TypeError) as e:
                logger.warning(
                    "Error al cargar registro 609: %s (datos: %s)", e, datos
                )
        return cargados

    def cargar_desde_anulaciones(self, anulaciones: list[Any]) -> int:
        """
        Carga registros desde una lista de objetos AnulacionRecord.

        Facilita la integracion con el motor fiscal dominicano que
        mantiene un registro interno de anulaciones.

        Args:
            anulaciones: Lista de AnulacionRecord del motor fiscal.

        Returns:
            Cantidad de registros cargados exitosamente.
        """
        cargados = 0
        for anulacion in anulaciones:
            try:
                # Convertir fecha de YYYY-MM-DD a YYYYMMDD
                fecha = getattr(anulacion, "fecha_anulacion", "")
                fecha_formateada = fecha.replace("-", "") if fecha else ""

                registro = Registro609(
                    tipo_comprobante=getattr(anulacion, "tipo_comprobante", ""),
                    ncf_anulado=getattr(anulacion, "ncf_anulado", ""),
                    fecha_anulacion=fecha_formateada,
                )
                self._registros.append(registro)
                cargados += 1
            except (AttributeError, TypeError) as e:
                logger.warning(
                    "Error al cargar anulacion para reporte 609: %s", e
                )
        return cargados

    def generar(self) -> str:
        """
        Genera el contenido completo del reporte 609 en formato DGII.

        Estructura:
          Linea 1: 609|RNC|YYYYMM|cantidad_registros
          Lineas 2..N: tipo_comprobante|ncf_anulado|fecha_anulacion
          Ultima linea: cantidad total de registros

        Returns:
            Cadena con el reporte completo listo para enviar a DGII.
        """
        lineas: list[str] = []
        d = DGII_DELIMITER

        # --- Linea de encabezado ---
        encabezado = d.join([
            "609",
            self.header.rnc_contribuyente,
            self.header.periodo,
            str(len(self._registros)),
        ])
        lineas.append(encabezado)

        # --- Contadores por tipo de comprobante ---
        conteo_por_tipo: dict[str, int] = {}

        # --- Lineas de detalle ---
        for reg in self._registros:
            campos = [
                reg.tipo_comprobante,
                reg.ncf_anulado,
                reg.fecha_anulacion,
            ]
            lineas.append(d.join(campos))

            # Contar por tipo
            tipo = reg.tipo_comprobante
            conteo_por_tipo[tipo] = conteo_por_tipo.get(tipo, 0) + 1

        # --- Linea de resumen ---
        # Formato: cantidad_total seguido de conteos por tipo
        partes_resumen = [str(len(self._registros))]
        for tipo in sorted(conteo_por_tipo.keys()):
            nombre_tipo = TIPOS_COMPROBANTE.get(tipo, tipo)
            partes_resumen.append(f"{tipo}:{conteo_por_tipo[tipo]}")
        resumen = d.join(partes_resumen)
        lineas.append(resumen)

        logger.info(
            "Reporte 609 generado: periodo=%s, anulaciones=%d, tipos=%s",
            self.header.periodo, len(self._registros), conteo_por_tipo,
        )

        return "\n".join(lineas)

    @property
    def cantidad_registros(self) -> int:
        """Retorna la cantidad de registros cargados."""
        return len(self._registros)


# ---------------------------------------------------------------------------
# Funciones de utilidad para generacion rapida de reportes
# ---------------------------------------------------------------------------

def generar_reporte_607(
    rnc: str,
    periodo: str,
    ventas: list[dict],
    nombre_contribuyente: str = "",
) -> str:
    """
    Funcion de conveniencia para generar un reporte 607 en un solo paso.

    Args:
        rnc: RNC del contribuyente (9 digitos).
        periodo: Periodo fiscal en formato YYYYMM (ej: "202601").
        ventas: Lista de diccionarios con datos de ventas.
        nombre_contribuyente: Razon social (opcional).

    Returns:
        Cadena con el reporte 607 completo en formato DGII.

    Ejemplo:
        >>> ventas = [
        ...     {
        ...         "rnc_cedula_comprador": "131234567",
        ...         "tipo_identificacion": 1,
        ...         "ncf": "B0100000001",
        ...         "fecha_comprobante": "20260115",
        ...         "monto_facturado": 10000.00,
        ...         "itbis_facturado": 1800.00,
        ...     },
        ... ]
        >>> reporte = generar_reporte_607("101234567", "202601", ventas)
    """
    header = DGIIReportHeader(
        rnc_contribuyente=rnc,
        periodo=periodo,
        nombre_contribuyente=nombre_contribuyente,
    )
    reporte = Reporte607(header)
    reporte.cargar_lote(ventas)
    return reporte.generar()


def generar_reporte_608(
    rnc: str,
    periodo: str,
    compras: list[dict],
    nombre_contribuyente: str = "",
) -> str:
    """
    Funcion de conveniencia para generar un reporte 608 en un solo paso.

    Args:
        rnc: RNC del contribuyente (9 digitos).
        periodo: Periodo fiscal en formato YYYYMM (ej: "202601").
        compras: Lista de diccionarios con datos de compras.
        nombre_contribuyente: Razon social (opcional).

    Returns:
        Cadena con el reporte 608 completo en formato DGII.

    Ejemplo:
        >>> compras = [
        ...     {
        ...         "rnc_cedula_proveedor": "101987654",
        ...         "tipo_identificacion": 1,
        ...         "tipo_bienes_servicios": "02",
        ...         "ncf": "B0100000050",
        ...         "fecha_comprobante": "20260110",
        ...         "total_monto_facturado": 5000.00,
        ...         "itbis_facturado": 900.00,
        ...     },
        ... ]
        >>> reporte = generar_reporte_608("101234567", "202601", compras)
    """
    header = DGIIReportHeader(
        rnc_contribuyente=rnc,
        periodo=periodo,
        nombre_contribuyente=nombre_contribuyente,
    )
    reporte = Reporte608(header)
    reporte.cargar_lote(compras)
    return reporte.generar()


def generar_reporte_609(
    rnc: str,
    periodo: str,
    anulaciones: list[dict],
    nombre_contribuyente: str = "",
) -> str:
    """
    Funcion de conveniencia para generar un reporte 609 en un solo paso.

    Args:
        rnc: RNC del contribuyente (9 digitos).
        periodo: Periodo fiscal en formato YYYYMM (ej: "202601").
        anulaciones: Lista de diccionarios con datos de anulaciones.
        nombre_contribuyente: Razon social (opcional).

    Returns:
        Cadena con el reporte 609 completo en formato DGII.

    Ejemplo:
        >>> anulaciones = [
        ...     {
        ...         "tipo_comprobante": "02",
        ...         "ncf_anulado": "B0200000015",
        ...         "fecha_anulacion": "20260120",
        ...     },
        ... ]
        >>> reporte = generar_reporte_609("101234567", "202601", anulaciones)
    """
    header = DGIIReportHeader(
        rnc_contribuyente=rnc,
        periodo=periodo,
        nombre_contribuyente=nombre_contribuyente,
    )
    reporte = Reporte609(header)
    reporte.cargar_lote(anulaciones)
    return reporte.generar()
