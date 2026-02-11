'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { Search, ChevronDown, X, Loader2 } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  subtitle?: string;
}

interface SearchableSelectProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  loading?: boolean;
  onSearch?: (query: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  emptyMessage?: string;
}

export function SearchableSelect({
  label,
  placeholder = 'Seleccionar...',
  value,
  onChange,
  options,
  loading = false,
  onSearch,
  required = false,
  disabled = false,
  error,
  emptyMessage = 'No hay opciones disponibles',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle search
  useEffect(() => {
    if (onSearch && searchQuery) {
      const timer = setTimeout(() => {
        onSearch(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, onSearch]);

  // Filter options based on search
  const filteredOptions = searchQuery
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opt.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  };

  return (
    <div className="w-full" ref={containerRef}>
      <label className="block text-sm font-medium text-neutral-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={`
            w-full flex items-center justify-between gap-2 px-3 py-2.5
            border rounded-lg text-left transition-colors
            ${disabled ? 'bg-neutral-100 cursor-not-allowed' : 'bg-white hover:border-neutral-400'}
            ${error ? 'border-red-300' : 'border-neutral-300'}
            ${isOpen ? 'border-primary-500 ring-2 ring-primary-100' : ''}
          `}
        >
          <span className={`flex-1 truncate ${!selectedOption ? 'text-neutral-400' : 'text-neutral-900'}`}>
            {selectedOption ? (
              <span>
                <span className="font-medium">{selectedOption.label}</span>
                {selectedOption.subtitle && (
                  <span className="text-xs text-neutral-500 ml-2">({selectedOption.subtitle})</span>
                )}
              </span>
            ) : (
              placeholder
            )}
          </span>

          <div className="flex items-center gap-1">
            {loading && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
            {selectedOption && !disabled && (
              <X
                className="w-4 h-4 text-neutral-400 hover:text-neutral-600"
                onClick={handleClear}
              />
            )}
            <ChevronDown
              className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b border-neutral-100 sticky top-0 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </div>
            </div>

            {/* Options list */}
            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-neutral-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Cargando...
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-4 py-8 text-center text-neutral-500 text-sm">
                  {emptyMessage}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`
                      w-full px-4 py-2.5 text-left hover:bg-neutral-50 transition-colors
                      ${option.value === value ? 'bg-primary-50' : ''}
                    `}
                  >
                    <div className="font-medium text-neutral-900">{option.label}</div>
                    {option.subtitle && (
                      <div className="text-xs text-neutral-500 mt-0.5">{option.subtitle}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
