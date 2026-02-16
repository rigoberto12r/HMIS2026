/**
 * Internationalization (i18n) Configuration for HMIS 2026
 * Supports: Spanish (es), English (en), Portuguese (pt)
 */

import { parseFloatSafe } from '@/lib/utils/safe-parse';

export const locales = ['es', 'en', 'pt'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'es';

export const localeNames: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
};

export const localeFlags: Record<Locale, string> = {
  es: '🇪🇸',
  en: '🇺🇸',
  pt: '🇧🇷',
};

/**
 * Get translations for a specific locale
 */
export async function getTranslations(locale: Locale) {
  try {
    const translations = await import(`@/i18n/${locale}.json`);
    return translations.default;
  } catch (error) {
    console.error(`Failed to load translations for locale: ${locale}`, error);
    // Fallback to default locale
    if (locale !== defaultLocale) {
      return getTranslations(defaultLocale);
    }
    return {};
  }
}

/**
 * Get locale from Accept-Language header (server-side)
 */
export function getLocaleFromHeader(header: string | null): Locale {
  if (!header) return defaultLocale;

  // Parse Accept-Language header (e.g., "es-ES,es;q=0.9,en;q=0.8")
  const languages = header
    .split(',')
    .map((lang) => {
      const [code, qValue] = lang.trim().split(';');
      const q = qValue ? parseFloatSafe(qValue.split('=')[1], 1.0, 'Accept-Language q-value') : 1.0;
      return { code: code.split('-')[0].toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);

  // Find first matching locale
  for (const { code } of languages) {
    if (locales.includes(code as Locale)) {
      return code as Locale;
    }
  }

  return defaultLocale;
}

/**
 * Get locale from browser (client-side)
 */
export function getLocaleFromBrowser(): Locale {
  if (typeof window === 'undefined') return defaultLocale;

  const browserLocale = navigator.language.split('-')[0].toLowerCase();
  return locales.includes(browserLocale as Locale)
    ? (browserLocale as Locale)
    : defaultLocale;
}

/**
 * Get locale from localStorage
 */
export function getLocaleFromStorage(): Locale | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem('hmis_locale');
  return stored && locales.includes(stored as Locale) ? (stored as Locale) : null;
}

/**
 * Save locale to localStorage
 */
export function saveLocaleToStorage(locale: Locale): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('hmis_locale', locale);
}

/**
 * Get current locale (priority: storage > browser > default)
 */
export function getCurrentLocale(): Locale {
  return getLocaleFromStorage() || getLocaleFromBrowser() || defaultLocale;
}

/**
 * Format date according to locale
 */
export function formatDate(date: Date | string, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };

  const localeMap: Record<Locale, string> = {
    es: 'es-ES',
    en: 'en-US',
    pt: 'pt-BR',
  };

  return new Intl.DateTimeFormat(localeMap[locale], defaultOptions).format(dateObj);
}

/**
 * Format number according to locale
 */
export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  const localeMap: Record<Locale, string> = {
    es: 'es-ES',
    en: 'en-US',
    pt: 'pt-BR',
  };

  return new Intl.NumberFormat(localeMap[locale], options).format(value);
}

/**
 * Format currency according to locale
 */
export function formatCurrency(value: number, locale: Locale, currency: string = 'DOP'): string {
  return formatNumber(value, locale, {
    style: 'currency',
    currency,
  });
}

/**
 * Simple translation function (client-side)
 */
export function useTranslation(translations: Record<string, any>) {
  const t = (key: string, variables?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations;

    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string: ${key}`);
      return key;
    }

    // Replace variables (e.g., "Hello {{name}}" with variables = { name: "John" })
    if (variables) {
      return value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
        return variables[varName]?.toString() ?? `{{${varName}}}`;
      });
    }

    return value;
  };

  return { t };
}
