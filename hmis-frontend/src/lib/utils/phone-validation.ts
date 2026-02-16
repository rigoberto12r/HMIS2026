import { parsePhoneNumber, CountryCode } from 'libphonenumber-js';

export const validatePhone = (
  phone: string,
  country: CountryCode = 'DO'
): { valid: boolean; formatted?: string; error?: string } => {
  if (!phone || phone.trim() === '') {
    return { valid: false, error: 'Teléfono es requerido' };
  }

  try {
    const phoneNumber = parsePhoneNumber(phone, country);

    if (!phoneNumber.isValid()) {
      return { valid: false, error: 'Número de teléfono inválido' };
    }

    return {
      valid: true,
      formatted: phoneNumber.formatInternational(),
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Formato de teléfono inválido',
    };
  }
};

export const formatPhoneInput = (phone: string, country: CountryCode = 'DO'): string => {
  try {
    const phoneNumber = parsePhoneNumber(phone, country);
    return phoneNumber.formatInternational();
  } catch {
    return phone;
  }
};
