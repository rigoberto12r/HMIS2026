'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QuickFilter {
  id: string;
  label: string;
  params: Record<string, string>;
  count?: number;
}

const quickFilters: QuickFilter[] = [
  {
    id: 'active',
    label: 'Activos',
    params: { status: 'active' },
  },
  {
    id: 'all',
    label: 'Todos',
    params: {},
  },
  {
    id: 'with_alerts',
    label: 'Con Alertas',
    params: { has_alert: 'true' },
  },
  {
    id: 'with_appointments',
    label: 'Con Citas',
    params: { has_appointment: 'true' },
  },
  {
    id: 'with_debt',
    label: 'Con Deuda',
    params: { has_debt: 'true' },
  },
];

export function PatientSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');
  const [isFocused, setIsFocused] = useState(false);

  // Debounced search
  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      if (!cancelled) {
        const params = new URLSearchParams(searchParams.toString());
        if (searchValue) {
          params.set('search', searchValue);
        } else {
          params.delete('search');
        }
        params.set('page', '1');
        router.push(`/patients?${params.toString()}`);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchValue, router, searchParams]);

  const handleClearSearch = () => {
    setSearchValue('');
  };

  const handleQuickFilter = (filter: QuickFilter) => {
    const params = new URLSearchParams();

    // Keep search if exists
    const currentSearch = searchParams.get('search');
    if (currentSearch) {
      params.set('search', currentSearch);
    }

    // Apply quick filter params
    Object.entries(filter.params).forEach(([key, value]) => {
      params.set(key, value);
    });

    params.set('page', '1');
    router.push(`/patients?${params.toString()}`);
  };

  const isQuickFilterActive = (filter: QuickFilter) => {
    return Object.entries(filter.params).every(([key, value]) => {
      return searchParams.get(key) === value;
    });
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div
          className={cn(
            'relative transition-all duration-200',
            isFocused && 'transform scale-[1.01]'
          )}
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, documento, teléfono, email..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              'w-full h-14 pl-12 pr-12 text-base',
              'bg-white dark:bg-surface-100',
              'border-2 border-surface-200 dark:border-surface-700',
              'rounded-xl',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              'placeholder:text-surface-400',
              isFocused && 'shadow-lg'
            )}
          />
          {searchValue && (
            <button
              onClick={handleClearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-100 dark:hover:bg-surface-200 rounded-full transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-5 h-5 text-surface-400" />
            </button>
          )}
        </div>

        {/* Search hint */}
        {isFocused && !searchValue && (
          <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-white dark:bg-surface-100 border border-surface-200 dark:border-surface-700 rounded-xl shadow-lg z-10">
            <p className="text-xs text-surface-500">
              Busca por nombre, número de documento, teléfono o correo electrónico
            </p>
          </div>
        )}
      </div>

      {/* Quick Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-surface-600 dark:text-surface-400">
          Filtros rápidos:
        </span>
        {quickFilters.map((filter) => {
          const isActive = isQuickFilterActive(filter);
          return (
            <button
              key={filter.id}
              onClick={() => handleQuickFilter(filter)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                'border',
                isActive
                  ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                  : 'bg-white dark:bg-surface-100 text-surface-700 dark:text-surface-300 border-surface-300 dark:border-surface-600 hover:border-primary-500 hover:text-primary-600'
              )}
            >
              {filter.label}
              {filter.count !== undefined && (
                <span className="ml-1.5 opacity-75">({filter.count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active filters indicator */}
      {searchValue && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-surface-500">Buscando:</span>
          <Badge variant="primary" className="gap-1.5">
            {searchValue}
            <button
              onClick={handleClearSearch}
              className="hover:bg-primary-600 rounded-full p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        </div>
      )}
    </div>
  );
}
