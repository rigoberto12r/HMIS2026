/**
 * Safe parsing utilities to prevent NaN bugs.
 *
 * CRITICAL: Always use these instead of parseInt/parseFloat to prevent:
 * - Silent NaN propagation causing data corruption
 * - Crashes in calculations (NaN + 5 = NaN)
 * - Invalid data saved to database
 * - Confusing UX (empty fields become 0 or NaN)
 */

/**
 * Safely parse an integer with validation and fallback.
 *
 * @param value - String or number to parse
 * @param fallback - Value to return if parsing fails (default: 0)
 * @param fieldName - Optional field name for error messages
 * @returns Parsed integer or fallback value
 *
 * @example
 * ```ts
 * const age = parseIntSafe("25", 0); // 25
 * const invalid = parseIntSafe("abc", 0); // 0
 * const quantity = parseIntSafe(input.value, 1, "Quantity"); // With field name
 * ```
 */
export function parseIntSafe(
  value: string | number | null | undefined,
  fallback: number = 0,
  fieldName?: string
): number {
  // Handle null/undefined
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  // If already a number, validate it
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      if (fieldName && process.env.NODE_ENV === 'development') {
        console.warn(`[parseIntSafe] Invalid number for ${fieldName}: ${value}, using fallback: ${fallback}`);
      }
      return fallback;
    }
    return Math.floor(value);
  }

  // Parse string
  const parsed = parseInt(String(value), 10);

  if (isNaN(parsed)) {
    if (fieldName && process.env.NODE_ENV === 'development') {
      console.warn(`[parseIntSafe] Failed to parse ${fieldName}: "${value}", using fallback: ${fallback}`);
    }
    return fallback;
  }

  return parsed;
}

/**
 * Safely parse a float with validation and fallback.
 *
 * @param value - String or number to parse
 * @param fallback - Value to return if parsing fails (default: 0.0)
 * @param fieldName - Optional field name for error messages
 * @returns Parsed float or fallback value
 *
 * @example
 * ```ts
 * const price = parseFloatSafe("19.99", 0); // 19.99
 * const invalid = parseFloatSafe("abc", 0); // 0
 * const temp = parseFloatSafe(input.value, 36.5, "Temperature"); // With field name
 * ```
 */
export function parseFloatSafe(
  value: string | number | null | undefined,
  fallback: number = 0,
  fieldName?: string
): number {
  // Handle null/undefined
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  // If already a number, validate it
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      if (fieldName && process.env.NODE_ENV === 'development') {
        console.warn(`[parseFloatSafe] Invalid number for ${fieldName}: ${value}, using fallback: ${fallback}`);
      }
      return fallback;
    }
    return value;
  }

  // Parse string
  const parsed = parseFloat(String(value));

  if (isNaN(parsed) || !isFinite(parsed)) {
    if (fieldName && process.env.NODE_ENV === 'development') {
      console.warn(`[parseFloatSafe] Failed to parse ${fieldName}: "${value}", using fallback: ${fallback}`);
    }
    return fallback;
  }

  return parsed;
}

/**
 * Safely parse an integer with range validation.
 *
 * @param value - String or number to parse
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param fallback - Value to return if parsing fails or out of range
 * @param fieldName - Optional field name for error messages
 * @returns Parsed integer within range or fallback value
 *
 * @example
 * ```ts
 * const age = parseIntRange("25", 0, 120, 0, "Age"); // 25
 * const invalid = parseIntRange("150", 0, 120, 0, "Age"); // 0 (out of range)
 * const quantity = parseIntRange("-5", 1, 100, 1, "Quantity"); // 1 (below min)
 * ```
 */
export function parseIntRange(
  value: string | number | null | undefined,
  min: number,
  max: number,
  fallback: number,
  fieldName?: string
): number {
  const parsed = parseIntSafe(value, fallback, fieldName);

  if (parsed < min || parsed > max) {
    if (fieldName && process.env.NODE_ENV === 'development') {
      console.warn(
        `[parseIntRange] ${fieldName} value ${parsed} is out of range [${min}, ${max}], using fallback: ${fallback}`
      );
    }
    return fallback;
  }

  return parsed;
}

/**
 * Safely parse a float with range validation.
 *
 * @param value - String or number to parse
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param fallback - Value to return if parsing fails or out of range
 * @param fieldName - Optional field name for error messages
 * @returns Parsed float within range or fallback value
 *
 * @example
 * ```ts
 * const temp = parseFloatRange("36.6", 35.0, 42.0, 36.5, "Temperature"); // 36.6
 * const invalid = parseFloatRange("50", 35.0, 42.0, 36.5, "Temperature"); // 36.5 (out of range)
 * ```
 */
export function parseFloatRange(
  value: string | number | null | undefined,
  min: number,
  max: number,
  fallback: number,
  fieldName?: string
): number {
  const parsed = parseFloatSafe(value, fallback, fieldName);

  if (parsed < min || parsed > max) {
    if (fieldName && process.env.NODE_ENV === 'development') {
      console.warn(
        `[parseFloatRange] ${fieldName} value ${parsed} is out of range [${min}, ${max}], using fallback: ${fallback}`
      );
    }
    return fallback;
  }

  return parsed;
}

/**
 * Validate if a value can be parsed as a valid number.
 *
 * @param value - Value to validate
 * @returns true if value is a valid number, false otherwise
 *
 * @example
 * ```ts
 * isValidNumber("123") // true
 * isValidNumber("abc") // false
 * isValidNumber("") // false
 * isValidNumber(null) // false
 * ```
 */
export function isValidNumber(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }

  if (typeof value === 'number') {
    return !isNaN(value) && isFinite(value);
  }

  const parsed = parseFloat(String(value));
  return !isNaN(parsed) && isFinite(parsed);
}
