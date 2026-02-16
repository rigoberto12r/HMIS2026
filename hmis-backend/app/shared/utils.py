"""
Shared utility functions for HMIS backend.
"""

from typing import Any


def parse_int_safe(
    value: Any,
    fallback: int = 0,
    field_name: str | None = None
) -> int:
    """
    Safely parse an integer with validation and fallback.

    CRITICAL: Always use this instead of int() to prevent:
    - ValueError crashes from invalid input
    - Data corruption from NaN/None values
    - Silent bugs in calculations

    Args:
        value: Value to parse (str, int, float, None)
        fallback: Value to return if parsing fails (default: 0)
        field_name: Optional field name for logging

    Returns:
        Parsed integer or fallback value

    Example:
        >>> parse_int_safe("25", 0)
        25
        >>> parse_int_safe("abc", 0)
        0
        >>> parse_int_safe(None, 1, "quantity")
        1
    """
    if value is None or value == "":
        return fallback

    try:
        # Handle float strings like "25.5"
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return fallback
            # Try float first to handle decimal strings
            return int(float(value))
        elif isinstance(value, (int, float)):
            if not isinstance(value, bool):  # bool is subclass of int
                return int(value)
        return fallback
    except (ValueError, TypeError, OverflowError) as e:
        if field_name:
            from app.core.logging import get_logger
            logger = get_logger("hmis.utils")
            logger.warning(
                f"Failed to parse {field_name}: {value!r}, using fallback: {fallback}",
                extra={"error": str(e)}
            )
        return fallback


def parse_float_safe(
    value: Any,
    fallback: float = 0.0,
    field_name: str | None = None
) -> float:
    """
    Safely parse a float with validation and fallback.

    Args:
        value: Value to parse (str, int, float, None)
        fallback: Value to return if parsing fails (default: 0.0)
        field_name: Optional field name for logging

    Returns:
        Parsed float or fallback value

    Example:
        >>> parse_float_safe("19.99", 0.0)
        19.99
        >>> parse_float_safe("abc", 0.0)
        0.0
        >>> parse_float_safe(None, 36.5, "temperature")
        36.5
    """
    if value is None or value == "":
        return fallback

    try:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return fallback
            return float(value)
        elif isinstance(value, (int, float)):
            if not isinstance(value, bool):
                result = float(value)
                # Check for infinity and NaN
                if not (result == result):  # NaN check
                    return fallback
                if result in (float('inf'), float('-inf')):
                    return fallback
                return result
        return fallback
    except (ValueError, TypeError, OverflowError) as e:
        if field_name:
            from app.core.logging import get_logger
            logger = get_logger("hmis.utils")
            logger.warning(
                f"Failed to parse {field_name}: {value!r}, using fallback: {fallback}",
                extra={"error": str(e)}
            )
        return fallback


def escape_like_pattern(pattern: str) -> str:
    """
    Escape special characters in LIKE pattern to prevent SQL injection.

    SQLAlchemy's ilike() is parameterized, but wildcards (%, _) need escaping
    to prevent attackers from bypassing filters.

    Args:
        pattern: User input to use in LIKE query

    Returns:
        Escaped pattern safe for LIKE queries

    Example:
        >>> query = "test%' OR '1'='1"
        >>> safe = escape_like_pattern(query)
        >>> # Result: "test\\%' OR '1'='1" (% is escaped)
        >>> stmt = select(Item).where(Item.name.ilike(f"%{safe}%", escape="\\"))
    """
    if not pattern:
        return pattern

    # Escape backslash first (it's our escape character)
    escaped = pattern.replace("\\", "\\\\")

    # Escape LIKE wildcards
    escaped = escaped.replace("%", "\\%")
    escaped = escaped.replace("_", "\\_")

    return escaped
