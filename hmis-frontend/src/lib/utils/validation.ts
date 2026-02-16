/**
 * Global Validation Utilities for HMIS Forms
 * Centralized validation functions with consistent error messages
 */

export const validators = {
  /**
   * Validate email format
   */
  email: (value: string): boolean => {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(value);
  },

  /**
   * Check if value is required (not empty/null)
   */
  required: (value: any): boolean => {
    if (typeof value === 'string') return value.trim().length > 0;
    return value != null && value !== '';
  },

  /**
   * Check minimum string length
   */
  minLength: (value: string, min: number): boolean => {
    return value.length >= min;
  },

  /**
   * Check maximum string length
   */
  maxLength: (value: string, max: number): boolean => {
    return value.length <= max;
  },

  /**
   * Check if value is numeric
   */
  numeric: (value: string): boolean => {
    return !isNaN(parseFloat(value)) && isFinite(Number(value));
  },

  /**
   * Check if value is a positive number
   */
  positiveNumber: (value: string | number): boolean => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return !isNaN(num) && num > 0;
  },

  /**
   * Check if value is a non-negative number (>= 0)
   */
  nonNegativeNumber: (value: string | number): boolean => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return !isNaN(num) && num >= 0;
  },

  /**
   * Check if value is within a numeric range
   */
  inRange: (value: string | number, min: number, max: number): boolean => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return !isNaN(num) && num >= min && num <= max;
  },

  /**
   * Validate date is not in the future
   */
  notFutureDate: (dateStr: string): boolean => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    return date <= today;
  },

  /**
   * Validate date is not too far in the past (for birth dates - 120 years)
   */
  validBirthDate: (dateStr: string): boolean => {
    const date = new Date(dateStr);
    const today = new Date();
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 120);

    return date >= minDate && date <= today;
  },

  /**
   * Validate age is within range (from birth date)
   */
  ageInRange: (birthDateStr: string, minAge: number, maxAge: number): boolean => {
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Adjust age if birthday hasn't occurred this year yet
    const adjustedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ? age - 1
      : age;

    return adjustedAge >= minAge && adjustedAge <= maxAge;
  },
};

/**
 * Error message generators
 */
export const validationMessages = {
  required: (field: string) => `${field} es requerido`,
  email: () => 'Correo electrónico inválido',
  minLength: (field: string, min: number) => `${field} debe tener al menos ${min} caracteres`,
  maxLength: (field: string, max: number) => `${field} no puede exceder ${max} caracteres`,
  numeric: (field: string) => `${field} debe ser un número válido`,
  positiveNumber: (field: string) => `${field} debe ser un número positivo`,
  nonNegativeNumber: (field: string) => `${field} no puede ser negativo`,
  inRange: (field: string, min: number, max: number) =>
    `${field} debe estar entre ${min} y ${max}`,
  notFutureDate: (field: string) => `${field} no puede ser una fecha futura`,
  validBirthDate: () => 'Fecha de nacimiento inválida (edad máxima 120 años)',
};

/**
 * Date utility functions
 */
export const dateUtils = {
  /**
   * Get today's date in YYYY-MM-DD format
   */
  getToday: (): string => {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Get minimum birth date (120 years ago) in YYYY-MM-DD format
   */
  getMinBirthDate: (): string => {
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 120);
    return minDate.toISOString().split('T')[0];
  },

  /**
   * Get maximum birth date (today) in YYYY-MM-DD format
   */
  getMaxBirthDate: (): string => {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Calculate age from birth date
   */
  calculateAge: (birthDateStr: string): number => {
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  },
};

/**
 * Vital signs ranges for validation
 */
export const vitalRanges = {
  systolic_bp: { min: 70, max: 250, unit: 'mmHg', name: 'Presión Sistólica' },
  diastolic_bp: { min: 40, max: 150, unit: 'mmHg', name: 'Presión Diastólica' },
  heart_rate: { min: 30, max: 220, unit: 'bpm', name: 'Frecuencia Cardíaca' },
  respiratory_rate: { min: 8, max: 60, unit: 'rpm', name: 'Frecuencia Respiratoria' },
  temperature: { min: 32, max: 43, unit: '°C', name: 'Temperatura' },
  oxygen_saturation: { min: 70, max: 100, unit: '%', name: 'Saturación O₂' },
  weight: { min: 0.5, max: 500, unit: 'kg', name: 'Peso' },
  height: { min: 30, max: 250, unit: 'cm', name: 'Altura' },
  glucose: { min: 20, max: 800, unit: 'mg/dL', name: 'Glucosa' },
};

/**
 * Validate vital sign value and return warning message if out of range
 */
export const validateVitalSign = (
  field: keyof typeof vitalRanges,
  value: number
): { valid: boolean; warning?: string } => {
  const range = vitalRanges[field];

  if (!range) {
    return { valid: true };
  }

  if (value < range.min || value > range.max) {
    return {
      valid: false,
      warning: `${range.name}: Valor fuera del rango normal (${range.min}-${range.max} ${range.unit})`,
    };
  }

  return { valid: true };
};
