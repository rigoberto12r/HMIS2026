'use client';

import { useState, useEffect } from 'react';
import {
  locales,
  type Locale,
  localeNames,
  localeFlags,
  getCurrentLocale,
  saveLocaleToStorage,
} from '@/lib/i18n';

interface LanguageSwitcherProps {
  onLocaleChange?: (locale: Locale) => void;
  className?: string;
}

export function LanguageSwitcher({ onLocaleChange, className = '' }: LanguageSwitcherProps) {
  const [currentLocale, setCurrentLocale] = useState<Locale>('es');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setCurrentLocale(getCurrentLocale());
  }, []);

  const handleLocaleChange = (locale: Locale) => {
    setCurrentLocale(locale);
    saveLocaleToStorage(locale);
    setIsOpen(false);

    // Notify parent component
    if (onLocaleChange) {
      onLocaleChange(locale);
    }

    // Reload page to apply new locale
    // (In a production app, you might want to use a more sophisticated approach)
    window.location.reload();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Current Language Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        aria-label="Change language"
      >
        <span className="text-xl">{localeFlags[currentLocale]}</span>
        <span className="text-sm font-medium text-gray-700">
          {localeNames[currentLocale]}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            {locales.map((locale) => (
              <button
                key={locale}
                onClick={() => handleLocaleChange(locale)}
                className={`
                  w-full flex items-center gap-3 px-4 py-2 text-sm text-left
                  hover:bg-gray-50 transition-colors
                  ${currentLocale === locale ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                `}
              >
                <span className="text-xl">{localeFlags[locale]}</span>
                <span className="font-medium">{localeNames[locale]}</span>
                {currentLocale === locale && (
                  <svg
                    className="w-4 h-4 ml-auto text-blue-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Compact Language Switcher (for mobile/header)
 */
export function CompactLanguageSwitcher({ className = '' }: { className?: string }) {
  const [currentLocale, setCurrentLocale] = useState<Locale>('es');

  useEffect(() => {
    setCurrentLocale(getCurrentLocale());
  }, []);

  const handleNext = () => {
    const currentIndex = locales.indexOf(currentLocale);
    const nextIndex = (currentIndex + 1) % locales.length;
    const nextLocale = locales[nextIndex];

    setCurrentLocale(nextLocale);
    saveLocaleToStorage(nextLocale);
    window.location.reload();
  };

  return (
    <button
      onClick={handleNext}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors ${className}`}
      aria-label="Change language"
      title={`Current: ${localeNames[currentLocale]}`}
    >
      <span className="text-xl">{localeFlags[currentLocale]}</span>
      <span className="text-sm font-medium text-gray-700 hidden sm:inline">
        {localeNames[currentLocale]}
      </span>
    </button>
  );
}
