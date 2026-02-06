"""
Configuracion de logging estructurado en formato JSON.
Ideal para ambientes cloud (ELK, CloudWatch, Datadog).

Uso:
    from app.core.logging import get_logger
    logger = get_logger("hmis.modulo")
    logger.info("Paciente creado", extra={"patient_id": "...", "tenant": "..."})
"""

import json
import logging
import sys
from datetime import datetime, timezone

from app.core.config import settings


class JSONFormatter(logging.Formatter):
    """Formateador que emite cada log como una linea JSON."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Agregar campos extra si existen
        for key in ("tenant_id", "user_id", "request_id", "patient_id",
                     "encounter_id", "method", "path", "status_code",
                     "duration_ms", "ip_address", "error_type"):
            value = getattr(record, key, None)
            if value is not None:
                log_entry[key] = value

        # Agregar excepcion si existe
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
            }

        return json.dumps(log_entry, ensure_ascii=False, default=str)


class DevFormatter(logging.Formatter):
    """Formateador legible para desarrollo local."""

    COLORS = {
        "DEBUG": "\033[36m",     # cyan
        "INFO": "\033[32m",      # green
        "WARNING": "\033[33m",   # yellow
        "ERROR": "\033[31m",     # red
        "CRITICAL": "\033[35m",  # magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        timestamp = datetime.now().strftime("%H:%M:%S")
        base = f"{color}{timestamp} [{record.levelname:>7}]{self.RESET} {record.name}: {record.getMessage()}"

        # Agregar extras relevantes
        extras = []
        for key in ("tenant_id", "user_id", "request_id", "duration_ms"):
            value = getattr(record, key, None)
            if value is not None:
                extras.append(f"{key}={value}")
        if extras:
            base += f"  ({', '.join(extras)})"

        if record.exc_info and record.exc_info[1]:
            base += f"\n  {record.exc_info[0].__name__}: {record.exc_info[1]}"

        return base


def setup_logging() -> None:
    """
    Configura el logging de la aplicacion.
    - Produccion/staging: JSON estructurado a stdout
    - Desarrollo: formato legible con colores
    """
    root_logger = logging.getLogger()

    # Limpiar handlers existentes
    root_logger.handlers.clear()

    # Nivel base
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO
    root_logger.setLevel(log_level)

    # Handler a stdout
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)

    if settings.ENVIRONMENT in ("production", "staging"):
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(DevFormatter())

    root_logger.addHandler(handler)

    # Reducir ruido de librerias externas
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.DATABASE_ECHO else logging.WARNING
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Obtiene un logger con el nombre especificado."""
    return logging.getLogger(name)
